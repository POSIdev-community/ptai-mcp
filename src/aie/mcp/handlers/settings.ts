import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { ToolArguments } from '../tool-contract.js';

export const settingsHandlers: Pick<ToolHandlers, SettingsToolNames> = {
  [AieToolName.GetProjectSettings]: getProjectSettings,
  [AieToolName.UpdateProjectSettings]: updateProjectSettings,
};

function getProjectSettings(args: GetProjectSettingsArguments, context: ToolContext) {
  return context.settings.get(args.project_id, args.section, args.scan_id, args.include_template);
}

function updateProjectSettings(args: UpdateProjectSettingsArguments, context: ToolContext) {
  return context.settings.update(args.project_id, args.section, args.changes, args.base_revision);
}

type SettingsToolNames = typeof AieToolName.GetProjectSettings | typeof AieToolName.UpdateProjectSettings;

type GetProjectSettingsArguments = ToolArguments[typeof AieToolName.GetProjectSettings];
type UpdateProjectSettingsArguments = ToolArguments[typeof AieToolName.UpdateProjectSettings];
