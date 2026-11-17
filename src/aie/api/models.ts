import type { AnalysisRulesUpdateSettingsModel, BaseCreateProjectModel, PMGroupUpsertModel } from './contracts.js';

export const WriteModelName = {
  CreateProject: 'BaseCreateProjectModel',
  PmGroup: 'PMGroupUpsertModel',
  AnalysisRules: 'AnalysisRulesUpdateSettingsModel',
} as const;

export interface WriteModels {
  [WriteModelName.CreateProject]: BaseCreateProjectModel;
  [WriteModelName.PmGroup]: PMGroupUpsertModel;
  [WriteModelName.AnalysisRules]: AnalysisRulesUpdateSettingsModel;
}
