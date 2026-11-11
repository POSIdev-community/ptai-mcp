import type { AieApi } from './api.js';
import { AieError, validation } from './errors.js';
import {
  record,
  writable,
  writeSchema,
  validateWrite,
  merge,
  revision,
  verifyRevision,
  checkReadback,
  type Data,
} from './schema.js';

export type Kind = 'rules' | 'groups' | 'types';
const models: Record<Kind, string> = {
  rules: 'PmRuleCreateUpdateModel',
  groups: 'PMGroupUpsertModel',
  types: 'PmRuleVulnTypeCreatingModel',
};

export class PmCatalog {
  constructor(private readonly api: AieApi) {}
  schema(kind: Kind) {
    return writeSchema(this.model(kind));
  }

  async list(kind: Kind): Promise<unknown[]> {
    this.model(kind);
    switch (kind) {
      case 'rules':
        return this.api.json(this.api.configs.apiConfigsPmRulesGetRaw());
      case 'groups':
        return this.api.json(this.api.groups.apiConfigsPmGroupsGetRaw());
      case 'types':
        return this.api.json(this.api.types.apiPmRuleVulnTypesGetRaw());
    }
  }

  async entry(kind: Kind, id: string) {
    const value = await this.read(kind, id);
    return {
      kind,
      id,
      values: value,
      write_schema: kind === 'types' ? null : this.schema(kind),
      revision: revision(value),
      scope: 'shared_catalog',
    };
  }

  async save(
    kind: Kind,
    action: 'create' | 'update',
    id?: string,
    value?: Data,
    changes?: Data,
    baseRevision?: string,
  ) {
    const model = this.model(kind);
    if (action === 'create') {
      if (!value || id || changes) validation('create requires value, without id or changes.');
      validateWrite(model, value);
      const before = kind === 'types' ? [] : await this.list(kind);
      const known = new Set(before.map((item) => record(item).id));
      let created: string | undefined;
      switch (kind) {
        case 'rules':
          await this.api.empty(this.api.configs.apiConfigsPmRulesPostRaw({ pmRuleCreateUpdateModel: value }));
          break;
        case 'groups':
          await this.api.empty(
            this.api.groups.apiConfigsPmGroupsPostRaw({
              pMGroupUpsertModel: value as unknown as { name: string; rules: string[] },
            }),
          );
          break;
        case 'types':
          created = await this.api.json(
            this.api.types.apiPmRuleVulnTypesPostRaw({ pmRuleVulnTypeCreatingModel: value }),
          );
          break;
      }
      if (!created) {
        let candidates: Data[];
        try {
          candidates = (await this.list(kind))
            .map(record)
            .filter((entry) => !known.has(entry.id) && entry.name === value.name);
        } catch {
          return {
            kind,
            action,
            effects: 'applied',
            id: null,
            id_resolution: 'readback_unavailable',
            next_action: 'Inspect the shared catalog. Do not repeat create.',
          };
        }
        if (candidates.length !== 1 || typeof candidates[0].id !== 'string') {
          return {
            kind,
            action,
            effects: 'applied',
            id: null,
            id_resolution: 'ambiguous',
            candidate_ids: candidates.map((entry) => entry.id),
            next_action: 'Inspect the shared catalog. Do not repeat create.',
          };
        }
        created = candidates[0].id;
      }
      const saved = await this.readAfterWrite(kind, created);
      checkReadback(this.toWrite(kind, saved), value);
      return { kind, action, id: created, values: saved, verified: true, effects: 'applied', scope: 'shared_catalog' };
    }
    if (action !== 'update') validation('Select explicit create or update.');
    if (kind === 'types') validation('Finding types support create only.');
    if (!id || !changes || value) validation('update requires id and changes, without value.');
    const current = await this.read(kind, id);
    verifyRevision(current, baseRevision);
    const updated = record(merge(this.toWrite(kind, current), changes));
    validateWrite(model, updated);
    if (kind === 'rules')
      await this.api.empty(this.api.configs.apiConfigsPmRulesIdPutRaw({ id, pmRuleCreateUpdateModel: updated }));
    else
      await this.api.empty(
        this.api.groups.apiConfigsPmGroupsIdPatchRaw({
          id,
          pMGroupUpsertModel: updated as unknown as { name: string; rules: string[] },
        }),
      );
    const saved = await this.readAfterWrite(kind, id);
    checkReadback(this.toWrite(kind, saved), updated);
    return {
      kind,
      action,
      id,
      values: saved,
      revision: revision(saved),
      verified: true,
      effects: 'applied',
      scope: 'shared_catalog',
    };
  }

  private model(kind: Kind) {
    const model = models[kind];
    if (!model) validation('Select catalog kind rules, groups or types.');
    return model;
  }

  private async read(kind: Kind, id: string): Promise<Data> {
    this.model(kind);
    if (kind === 'rules') return record(await this.api.json(this.api.configs.apiConfigsPmRulesIdGetRaw({ id })));
    if (kind === 'types')
      return record(await this.api.json(this.api.types.apiPmRuleVulnTypesTypeIdGetRaw({ typeId: id })));
    const value = await this.api.json(this.api.groups.apiConfigsPmGroupsIdGetRaw({ id }));
    const rules = await this.api.json(this.api.groups.apiConfigsPmGroupsIdRulesGetRaw({ id }));
    if (!rules.every((rule) => typeof rule.id === 'string'))
      throw new AieError('AIE_INVALID_RESPONSE', 'A PM group contains a rule without an ID.');
    return { ...value, rules: rules.map((rule) => rule.id) };
  }
  private toWrite(kind: Kind, value: Data) {
    const body = writable(this.model(kind), value);
    if (kind === 'rules')
      body.vulnerabilityTypeId = value.vulnerabilityType ? record(value.vulnerabilityType).id : null;
    return body;
  }
  private async readAfterWrite(kind: Kind, id: string) {
    try {
      return await this.read(kind, id);
    } catch {
      throw new AieError('AIE_READBACK_UNAVAILABLE', 'PM write was accepted but readback failed.', {
        effects: 'applied',
        target: { kind, id },
      });
    }
  }
}
