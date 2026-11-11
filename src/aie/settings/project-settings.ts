import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { type JsonObject, merge, record, revision } from '../../shared/json.js';
import { parseJsonc } from '../../utils/jsonc.js';
import type { AieApi } from '../api/client.js';
import { WriteModelName } from '../api/models.js';
import {
  checkReadback,
  preserveReadExtras,
  validateWrite,
  verifyRevision,
  writable,
  writeDto,
  writeSchema,
} from '../api/write-schema.js';
import { Findings } from '../projects/findings.js';
import { preserveBlackboxSecrets, verifyBlackboxReadback } from './blackbox-credentials.js';
import { SettingsSection } from './models.js';

const models: Record<SettingsSection, string> = {
  scan: 'ProjectSettingsUpdateModel',
  pm_groups: WriteModelName.AnalysisRules,
  policies: 'SecurityPoliciesModel',
  blackbox: 'BlackBoxSettingsModel',
  preferred_agents: 'PreferredAgentsSettingsModel',
};

const blackboxCredentialSemantics = {
  http_form_password: 'Omission/null preserves; explicit empty string clears.',
  proxy_password: 'Omission/null/empty string preserves; disabling proxy does not claim to erase its stored secret.',
  raw_cookie:
    'Omission/null/empty string clears. A hidden existing RawCookie cannot be preserved without an explicit replacement; unsafe writes are refused.',
  readback:
    'AIE hides credential values; explicit replacements may return verified=false with verification.unverified_fields.',
};

export class Settings {

  public constructor(private readonly api: AieApi) {}

  public async get(projectId: string, section: SettingsSection, scanId?: string, template = false) {
    const model = this.model(section);
    const value = await this.readSelected(projectId, section, scanId);

    const policyTemplate =
      template && section === SettingsSection.Policies
        ? await this.api.json(this.api.configs.apiConfigsSecurityPoliciesTemplateGetRaw())
        : undefined;

    const schema = this.schema(section, model);

    return {
      project_id: projectId,
      section,
      values: value,
      revision: revision(value),
      write_schema: schema,
      settings_source: scanId && section === SettingsSection.Scan ? 'historical_scan' : 'current_project',
      scan_id: scanId,
      scope: 'project',
      affects_all_branches: true,
      policy_template: policyTemplate,
      credential_semantics: section === SettingsSection.Blackbox ? { ...blackboxCredentialSemantics } : undefined,
      atomic_revision: false,
    };
  }

  public async update(projectId: string, section: SettingsSection, changes: JsonObject, baseRevision?: string) {
    const model = this.model(section);
    const current = record(await this.read(projectId, section));
    verifyRevision(current, baseRevision);
    const writeValue = this.prepareUpdate(section, model, current, changes);

    await this.write(projectId, section, writeValue);
    let saved: unknown;

    try {
      saved = await this.read(projectId, section);
    } catch {
      throw new ToolError(ErrorCode.ReadbackUnavailable, 'Write was accepted but readback failed.', {
        effects: Effects.Applied,
        target: { project_id: projectId, section },
      });
    }

    const blackboxVerification = this.verifyUpdate(section, saved, changes);

    return {
      project_id: projectId,
      section,
      values: saved,
      revision: revision(saved),
      effects: Effects.Applied,
      verified: blackboxVerification?.verified ?? true,
      verification: blackboxVerification,
      scope: 'project',
      affects_all_branches: true,
    };
  }

  private model(section: SettingsSection) {
    const model = models[section];

    if (!model) {
      validation('Select one of the five supported settings sections.');
    }

    return model;
  }

  private read(projectId: string, section: SettingsSection): Promise<unknown> {
    switch (section) {
      case SettingsSection.Scan:
        return this.api.json(this.api.projects.apiProjectsProjectIdSettingsGetRaw({ projectId }));
      case SettingsSection.PmGroups:
        return this.api.json(this.api.projects.apiProjectsProjectIdAnalysisRulesGetRaw({ projectId }));
      case SettingsSection.Policies:
        return this.api.json(this.api.projects.apiProjectsProjectIdSecurityPoliciesGetRaw({ projectId }));
      case SettingsSection.Blackbox:
        return this.api.json(this.api.projects.apiProjectsProjectIdBlackBoxSettingsGetRaw({ projectId }));
      case SettingsSection.PreferredAgents:
        return this.api.json(this.api.projects.apiProjectsProjectIdPreferredAgentsSettingsGetRaw({ projectId }));
    }
  }

  private write(projectId: string, section: SettingsSection, value: JsonObject) {
    switch (section) {
      case SettingsSection.Scan:
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdSettingsPutRaw({ projectId, projectSettingsUpdateModel: value }),
        );
      case SettingsSection.PmGroups:
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdAnalysisRulesPutRaw({
            projectId,
            analysisRulesUpdateSettingsModel: writeDto(WriteModelName.AnalysisRules, value),
          }),
        );
      case SettingsSection.Policies:
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdSecurityPoliciesPutRaw({ projectId, securityPoliciesModel: value }),
        );
      case SettingsSection.Blackbox:
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdBlackBoxSettingsPutRaw({ projectId, blackBoxSettingsModel: value }),
        );
      case SettingsSection.PreferredAgents:
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdPreferredAgentsSettingsPutRaw({
            projectId,
            preferredAgentsSettingsModel: value,
          }),
        );
    }
  }

  private rejectMasks(value: JsonObject, changes: JsonObject) {
    function visit(node: unknown, patch: unknown) {
      if (!node || typeof node !== 'object') {
        return;
      }

      for (const [key, child] of Object.entries(node)) {
        if ((/password|secret/i.test(key) || key === 'cookie') && typeof child === 'string' && /^[*•]+$/.test(child)) {
          // Sending a read mask can destroy the real credential. Until a live
          // fixture proves the server's preserve sentinel, refuse this write.
          throw new ToolError(
            ErrorCode.CredentialsPreservationRequired,
            'A hidden BlackBox credential cannot be safely round-tripped with this response. Supply an explicit replacement or verify the server preservation contract.',
            { effects: Effects.NotApplied },
          );
        }

        visit(child, patch && typeof patch === 'object' ? (patch as JsonObject)[key] : undefined);
      }
    }

    visit(value, changes);
  }

  private async readSelected(projectId: string, section: SettingsSection, scanId?: string): Promise<unknown> {
    let value: unknown;

    if (scanId && section === SettingsSection.Scan) {
      const scan = await new Findings(this.api).scan(projectId, scanId);

      if (!scan.settingsId) {
        throw new ToolError(ErrorCode.NotFound, 'Historical scan settings ID is unavailable.');
      }

      value = await this.api.json(
        this.api.projects.apiProjectsProjectIdScanSettingsScanSettingsIdGetRaw({
          projectId,
          scanSettingsId: scan.settingsId,
        }),
      );

      if (record(value).id !== scan.settingsId) {
        throw new ToolError(ErrorCode.TargetMismatch, 'Historical settings do not match the selected scan.', {
          effects: Effects.NotApplied,
        });
      }
    } else {
      value = await this.read(projectId, section);
    }

    return value;
  }

  private schema(section: SettingsSection, model: string) {
    const schema = writeSchema(model);

    if (section === SettingsSection.Policies) {
      const policy = record(record(schema.$defs).SecurityPoliciesModel);
      record(policy.properties).securityPolicies = {
        type: 'string',
        minLength: 1,
        description: 'AIE policy document in JSONC syntax; use include_template for an initial document.',
      };
      policy.required = ['securityPolicies'];
    }

    return schema;
  }

  private prepareUpdate(section: SettingsSection, model: string, current: JsonObject, changes: JsonObject): JsonObject {
    const allowed = writable(model, current);
    const value = record(merge(allowed, changes));
    validateWrite(model, value);

    if (
      section === SettingsSection.Policies &&
      (typeof value.securityPolicies !== 'string' || !value.securityPolicies.trim())
    ) {
      throw new ToolError(
        ErrorCode.ValidationError,
        'AIE requires a nonempty policy document even when enforcement is disabled.',
        {
          effects: Effects.NotApplied,
          next_action:
            'Read aie_get_project_settings(section=policies, include_template=true), then explicitly supply the policy document.',
        },
      );
    }

    const writeValue = preserveReadExtras(model, current, value, changes);

    if (section === SettingsSection.Blackbox) {
      preserveBlackboxSecrets(writeValue, changes);
      this.rejectMasks(writeValue, changes);
    }

    return writeValue;
  }

  private verifyUpdate(section: SettingsSection, saved: unknown, changes: JsonObject) {
    let blackboxVerification: ReturnType<typeof verifyBlackboxReadback> | undefined;

    if (section === SettingsSection.Blackbox) {
      blackboxVerification = verifyBlackboxReadback(saved, changes);
    } else if (
      section === SettingsSection.Policies &&
      typeof changes.securityPolicies === 'string' &&
      typeof record(saved).securityPolicies === 'string'
    ) {
      // AIE parses and reserializes the JSON policy document. Whitespace and
      // key order are not a policy change; other requested fields stay exact.
      try {
        checkReadback(
          { ...record(saved), securityPolicies: parseJsonc(record(saved).securityPolicies as string) },
          { ...changes, securityPolicies: parseJsonc(changes.securityPolicies) },
        );
      } catch (error) {
        if (error instanceof ToolError) {
          throw error;
        }

        throw new ToolError(
          ErrorCode.ReadbackMismatch,
          'Policy write was accepted but its JSON document could not be verified.',
          { effects: Effects.Applied },
        );
      }
    } else {
      checkReadback(saved, changes);
    }

    return blackboxVerification;
  }
}
