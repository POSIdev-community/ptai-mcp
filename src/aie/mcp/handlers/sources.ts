import { CreateKind } from '../../sources/models.js';
import { SourceKind, SourceReader } from '../../sources/source-reader.js';
import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { CreateArguments, ToolArguments } from '../tool-contract.js';

export const sourceHandlers: Pick<ToolHandlers, SourceToolNames> = {
  [AieToolName.Create]: create,
  [AieToolName.UploadSources]: uploadSources,
  [AieToolName.DownloadProject]: downloadProject,
  [AieToolName.GetSources]: getSources,
};

function create(args: CreateArguments, context: ToolContext) {
  return context.startOperation(AieToolName.Create, (job) =>
    args.kind === CreateKind.Branch
      ? context.sources.createBranch(args.project_id, args.branch_name, args.source_directory, args.description, job)
      : context.sources.create(
          args.source_directory,
          args.name,
          args.branch_name,
          args.description,
          args.scan_changes,
          job,
        ),
  );
}

function uploadSources(args: UploadSourcesArguments, context: ToolContext) {
  return context.startOperation(AieToolName.UploadSources, (job) =>
    context.sources.upload(args.project_id, args.branch_id, args.source_directory, job),
  );
}

function downloadProject(args: DownloadProjectArguments, context: ToolContext) {
  return context.startOperation(AieToolName.DownloadProject, (job) =>
    context.sources.download(args.project_id, args.branch_id, args.destination, args.scan_id, job),
  );
}

function getSources(args: GetSourcesArguments, context: ToolContext) {
  const reader = new SourceReader(context.session.api);

  if (args.kind === SourceKind.File) {
    return reader.file(args);
  }

  const query = {
    project_id: args.project_id,
    branch_id: args.branch_id,
    scan_id: args.scan_id,
    kind: args.kind,
    path: args.path,
    depth: args.depth,
  };

  return context.list(AieToolName.GetSources, query, args, () => reader.tree(args));
}

type SourceToolNames =
  | typeof AieToolName.Create
  | typeof AieToolName.UploadSources
  | typeof AieToolName.DownloadProject
  | typeof AieToolName.GetSources;

type UploadSourcesArguments = ToolArguments[typeof AieToolName.UploadSources];
type DownloadProjectArguments = ToolArguments[typeof AieToolName.DownloadProject];
type GetSourcesArguments = ToolArguments[typeof AieToolName.GetSources];
