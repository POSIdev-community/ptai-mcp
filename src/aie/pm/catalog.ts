import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { type JsonObject, merge, record, revision } from '../../shared/json.js';
import type { AieApi } from '../api/client.js';
import { WriteModelName } from '../api/models.js';
import { checkReadback, validateWrite, verifyRevision, writable, writeDto, writeSchema } from '../api/write-schema.js';
import { PmAction, PmKind } from './models.js';

const models: Record<PmKind, string> = {
  rules: 'PmRuleCreateUpdateModel',
  groups: WriteModelName.PmGroup,
  types: 'PmRuleVulnTypeCreatingModel',
};

export class PmCatalog {

  public constructor(private readonly api: AieApi) {}

  public schema(kind: PmKind) {
    return writeSchema(this.model(kind));
  }

  public async list(kind: PmKind): Promise<unknown[]> {
    this.model(kind);

    switch (kind) {
      case PmKind.Rules:
        return this.api.json(this.api.configs.apiConfigsPmRulesGetRaw());
      case PmKind.Groups:
        return this.api.json(this.api.groups.apiConfigsPmGroupsGetRaw());
      case PmKind.Types:
        return this.api.json(this.api.types.apiPmRuleVulnTypesGetRaw());
    }
  }

  public async entry(kind: PmKind, id: string) {
    const value = await this.read(kind, id);

    return {
      kind,
      id,
      values: value,
      write_schema: kind === PmKind.Types ? null : this.schema(kind),
      revision: revision(value),
      scope: 'shared_catalog',
    };
  }

  public async save(
    kind: PmKind,
    action: 'create' | 'update',
    id?: string,
    value?: JsonObject,
    changes?: JsonObject,
    baseRevision?: string,
  ) {
    const model = this.model(kind);

    if (action === PmAction.Create) {
      if (!value || id || changes) {
        validation('create requires value, without id or changes.');
      }

      return this.create(kind, model, value);
    }

    if (action !== PmAction.Update) {
      validation('Select explicit create or update.');
    }

    if (kind === PmKind.Types) {
      validation('Finding types support create only.');
    }

    if (!id || !changes || value) {
      validation('update requires id and changes, without value.');
    }

    return this.update(kind, id, model, changes, baseRevision);
  }

  private async create(kind: PmKind, model: string, value: JsonObject) {
    const action = PmAction.Create;

    validateWrite(model, value);
    const before = kind === PmKind.Types ? [] : await this.list(kind);
    const known = new Set(before.map((item) => record(item).id));
    let created = await this.createEntry(kind, value);

    if (!created) {
      let candidates: JsonObject[];

      try {
        candidates = (await this.list(kind))
          .map(record)
          .filter((entry) => !known.has(entry.id) && entry.name === value.name);
      } catch {
        return {
          kind,
          action,
          effects: Effects.Applied,
          id: null,
          id_resolution: 'readback_unavailable',
          next_action: 'Inspect the shared catalog. Do not repeat create.',
        };
      }

      if (candidates.length !== 1 || typeof candidates[0].id !== 'string') {
        return {
          kind,
          action,
          effects: Effects.Applied,
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

    return {
      kind,
      action,
      id: created,
      values: saved,
      verified: true,
      effects: Effects.Applied,
      scope: 'shared_catalog',
    };
  }

  private model(kind: PmKind) {
    const model = models[kind];

    if (!model) {
      validation('Select catalog kind rules, groups or types.');
    }

    return model;
  }

  private async read(kind: PmKind, id: string): Promise<JsonObject> {
    this.model(kind);

    if (kind === PmKind.Rules) {
      return record(await this.api.json(this.api.configs.apiConfigsPmRulesIdGetRaw({ id })));
    }

    if (kind === PmKind.Types) {
      return record(await this.api.json(this.api.types.apiPmRuleVulnTypesTypeIdGetRaw({ typeId: id })));
    }

    const value = await this.api.json(this.api.groups.apiConfigsPmGroupsIdGetRaw({ id }));
    const rules = await this.api.json(this.api.groups.apiConfigsPmGroupsIdRulesGetRaw({ id }));

    if (!rules.every((rule) => typeof rule.id === 'string')) {
      throw new ToolError(ErrorCode.InvalidResponse, 'A PM group contains a rule without an ID.');
    }

    return { ...value, rules: rules.map((rule) => rule.id) };
  }

  private toWrite(kind: PmKind, value: JsonObject) {
    const body = writable(this.model(kind), value);

    if (kind === PmKind.Rules) {
      body.vulnerabilityTypeId = value.vulnerabilityType ? record(value.vulnerabilityType).id : null;
    }

    return body;
  }

  private async readAfterWrite(kind: PmKind, id: string) {
    try {
      return await this.read(kind, id);
    } catch {
      throw new ToolError(ErrorCode.ReadbackUnavailable, 'PM write was accepted but readback failed.', {
        effects: Effects.Applied,
        target: { kind, id },
      });
    }
  }

  private async update(kind: PmKind, id: string, model: string, changes: JsonObject, baseRevision?: string) {
    const action = PmAction.Update;
    const current = await this.read(kind, id);
    verifyRevision(current, baseRevision);
    const updated = record(merge(this.toWrite(kind, current), changes));
    validateWrite(model, updated);

    if (kind === PmKind.Rules) {
      await this.api.empty(this.api.configs.apiConfigsPmRulesIdPutRaw({ id, pmRuleCreateUpdateModel: updated }));
    } else {
      await this.api.empty(
        this.api.groups.apiConfigsPmGroupsIdPatchRaw({
          id,
          pMGroupUpsertModel: writeDto(WriteModelName.PmGroup, updated),
        }),
      );
    }

    const saved = await this.readAfterWrite(kind, id);
    checkReadback(this.toWrite(kind, saved), updated);

    return {
      kind,
      action,
      id,
      values: saved,
      revision: revision(saved),
      verified: true,
      effects: Effects.Applied,
      scope: 'shared_catalog',
    };
  }

  private async createEntry(kind: PmKind, value: JsonObject): Promise<string | undefined> {
    let created: string | undefined;

    switch (kind) {
      case PmKind.Rules:
        await this.api.empty(this.api.configs.apiConfigsPmRulesPostRaw({ pmRuleCreateUpdateModel: value }));
        break;
      case PmKind.Groups:
        await this.api.empty(
          this.api.groups.apiConfigsPmGroupsPostRaw({
            pMGroupUpsertModel: writeDto(WriteModelName.PmGroup, value),
          }),
        );
        break;
      case PmKind.Types:
        created = await this.api.json(this.api.types.apiPmRuleVulnTypesPostRaw({ pmRuleVulnTypeCreatingModel: value }));
        break;
    }

    return created;
  }
}
