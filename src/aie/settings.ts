import { AieError, validation } from './errors.js';
import {
  record,
  writable,
  preserveReadExtras,
  writeSchema,
  validateWrite,
  merge,
  revision,
  verifyRevision,
  checkReadback,
  type Data,
} from './schema.js';
import type { AieApi } from './api.js';
import { parseJsonc } from '../utils/jsonc.js';
import { preserveBlackboxSecrets, verifyBlackboxReadback } from './blackbox.js';
import { Findings } from './findings.js';

export type Section = 'scan' | 'pm_groups' | 'policies' | 'blackbox' | 'preferred_agents';
const models: Record<Section, string> = {
  scan: 'ProjectSettingsUpdateModel',
  pm_groups: 'AnalysisRulesUpdateSettingsModel',
  policies: 'SecurityPoliciesModel',
  blackbox: 'BlackBoxSettingsModel',
  preferred_agents: 'PreferredAgentsSettingsModel',
};

export class Settings {
  constructor(private readonly api: AieApi) {}

  async get(projectId: string, section: Section, scanId?: string, template = false) {
    const model = this.model(section);
    let value: unknown;
    if (scanId && section === 'scan') {
      const scan = await new Findings(this.api).scan(projectId, scanId);
      if (!scan.settingsId) throw new AieError('AIE_NOT_FOUND', 'Historical scan settings ID is unavailable.');
      value = await this.api.json(
        this.api.projects.apiProjectsProjectIdScanSettingsScanSettingsIdGetRaw({
          projectId,
          scanSettingsId: scan.settingsId,
        }),
      );
      if (record(value).id !== scan.settingsId)
        throw new AieError('AIE_TARGET_MISMATCH', 'Historical settings do not match the selected scan.', {
          effects: 'not_applied',
        });
    } else value = await this.read(projectId, section);
    const policyTemplate =
      template && section === 'policies'
        ? await this.api.json(this.api.configs.apiConfigsSecurityPoliciesTemplateGetRaw())
        : undefined;
    const schema = writeSchema(model);
    if (section === 'policies') {
      const policy = record(record(schema.$defs).SecurityPoliciesModel);
      record(policy.properties).securityPolicies = {
        type: 'string',
        minLength: 1,
        description: 'AIE policy document in JSONC syntax; use include_template for an initial document.',
      };
      policy.required = ['securityPolicies'];
    }
    return {
      project_id: projectId,
      section,
      values: value,
      revision: revision(value),
      write_schema: schema,
      settings_source: scanId && section === 'scan' ? 'historical_scan' : 'current_project',
      scan_id: scanId,
      scope: 'project',
      affects_all_branches: true,
      policy_template: policyTemplate,
      credential_semantics:
        section === 'blackbox'
          ? {
              http_form_password: 'Omission/null preserves; explicit empty string clears.',
              proxy_password:
                'Omission/null/empty string preserves; disabling proxy does not claim to erase its stored secret.',
              raw_cookie:
                'Omission/null/empty string clears. A hidden existing RawCookie cannot be preserved without an explicit replacement; unsafe writes are refused.',
              readback:
                'AIE hides credential values; explicit replacements may return verified=false with verification.unverified_fields.',
            }
          : undefined,
      atomic_revision: false,
    };
  }

  async update(projectId: string, section: Section, changes: Data, baseRevision?: string) {
    const model = this.model(section);
    const current = record(await this.read(projectId, section));
    verifyRevision(current, baseRevision);
    const allowed = writable(model, current);
    const value = record(merge(allowed, changes));
    validateWrite(model, value);
    if (section === 'policies' && (typeof value.securityPolicies !== 'string' || !value.securityPolicies.trim())) {
      throw new AieError(
        'AIE_VALIDATION_ERROR',
        'AIE requires a nonempty policy document even when enforcement is disabled.',
        {
          effects: 'not_applied',
          next_action:
            'Read aie_get_project_settings(section=policies, include_template=true), then explicitly supply the policy document.',
        },
      );
    }
    const writeValue = preserveReadExtras(model, current, value, changes);
    if (section === 'blackbox') {
      preserveBlackboxSecrets(writeValue, changes);
      this.rejectMasks(writeValue, changes);
    }
    await this.write(projectId, section, writeValue);
    let saved: unknown;
    try {
      saved = await this.read(projectId, section);
    } catch {
      throw new AieError('AIE_READBACK_UNAVAILABLE', 'Write was accepted but readback failed.', {
        effects: 'applied',
        target: { project_id: projectId, section },
      });
    }
    let blackboxVerification: ReturnType<typeof verifyBlackboxReadback> | undefined;
    if (section === 'blackbox') blackboxVerification = verifyBlackboxReadback(saved, changes);
    else if (
      section === 'policies' &&
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
        if (error instanceof AieError) throw error;
        throw new AieError(
          'AIE_READBACK_MISMATCH',
          'Policy write was accepted but its JSON document could not be verified.',
          { effects: 'applied' },
        );
      }
    } else checkReadback(saved, changes);
    return {
      project_id: projectId,
      section,
      values: saved,
      revision: revision(saved),
      effects: 'applied',
      verified: blackboxVerification?.verified ?? true,
      verification: blackboxVerification,
      scope: 'project',
      affects_all_branches: true,
    };
  }

  private model(section: Section) {
    const model = models[section];
    if (!model) validation('Select one of the five supported settings sections.');
    return model;
  }

  private read(projectId: string, section: Section): Promise<unknown> {
    switch (section) {
      case 'scan':
        return this.api.json(this.api.projects.apiProjectsProjectIdSettingsGetRaw({ projectId }));
      case 'pm_groups':
        return this.api.json(this.api.projects.apiProjectsProjectIdAnalysisRulesGetRaw({ projectId }));
      case 'policies':
        return this.api.json(this.api.projects.apiProjectsProjectIdSecurityPoliciesGetRaw({ projectId }));
      case 'blackbox':
        return this.api.json(this.api.projects.apiProjectsProjectIdBlackBoxSettingsGetRaw({ projectId }));
      case 'preferred_agents':
        return this.api.json(this.api.projects.apiProjectsProjectIdPreferredAgentsSettingsGetRaw({ projectId }));
    }
  }

  private write(projectId: string, section: Section, value: Data) {
    switch (section) {
      case 'scan':
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdSettingsPutRaw({ projectId, projectSettingsUpdateModel: value }),
        );
      case 'pm_groups':
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdAnalysisRulesPutRaw({
            projectId,
            analysisRulesUpdateSettingsModel: value as unknown as { applyAllPmRules: boolean; pmGroupIds: string[] },
          }),
        );
      case 'policies':
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdSecurityPoliciesPutRaw({ projectId, securityPoliciesModel: value }),
        );
      case 'blackbox':
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdBlackBoxSettingsPutRaw({ projectId, blackBoxSettingsModel: value }),
        );
      case 'preferred_agents':
        return this.api.empty(
          this.api.projects.apiProjectsProjectIdPreferredAgentsSettingsPutRaw({
            projectId,
            preferredAgentsSettingsModel: value,
          }),
        );
    }
  }

  private rejectMasks(value: Data, changes: Data) {
    function visit(node: unknown, patch: unknown) {
      if (!node || typeof node !== 'object') return;
      for (const [key, child] of Object.entries(node)) {
        if ((/password|secret/i.test(key) || key === 'cookie') && typeof child === 'string' && /^[*•]+$/.test(child)) {
          // Sending a read mask can destroy the real credential. Until a live
          // fixture proves the server's preserve sentinel, refuse this write.
          throw new AieError(
            'AIE_CREDENTIALS_PRESERVATION_REQUIRED',
            'A hidden BlackBox credential cannot be safely round-tripped with this response. Supply an explicit replacement or verify the server preservation contract.',
            { effects: 'not_applied' },
          );
        }
        visit(child, patch && typeof patch === 'object' ? (patch as Data)[key] : undefined);
      }
    }
    visit(value, changes);
  }
}
