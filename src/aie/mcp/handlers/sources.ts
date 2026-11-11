import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const sourceHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.CreateProject]: (args, context) =>
    context.startOperation(AieToolName.CreateProject, (job) =>
      context.sources.create(
        args.source_directory,
        args.name,
        args.branch_name,
        args.description,
        args.scan_changes,
        job,
      ),
    ),
  [AieToolName.UploadSources]: (args, context) =>
    context.startOperation(AieToolName.UploadSources, (job) =>
      context.sources.upload(args.project_id, args.branch_id, args.source_directory, job),
    ),
  [AieToolName.DownloadProject]: (args, context) =>
    context.startOperation(AieToolName.DownloadProject, (job) =>
      context.sources.download(args.project_id, args.branch_id, args.destination, args.scan_id, job),
    ),
};

type Names = typeof AieToolName.CreateProject | typeof AieToolName.UploadSources | typeof AieToolName.DownloadProject;
