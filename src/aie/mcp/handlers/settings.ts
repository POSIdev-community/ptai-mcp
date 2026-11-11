import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const settingsHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.GetProjectSettings]: (args, context) =>
    context.settings.get(args.project_id, args.section, args.scan_id, args.include_template),
  [AieToolName.UpdateProjectSettings]: (args, context) =>
    context.settings.update(args.project_id, args.section, args.changes, args.base_revision),
};

type Names = typeof AieToolName.GetProjectSettings | typeof AieToolName.UpdateProjectSettings;
