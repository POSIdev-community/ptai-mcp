import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';
import type { DirectoryContent } from '../../vendor/aie-v63/src/models/index.js';
import { boundedBody } from '../api/body.js';
import type { AieApi } from '../api/client.js';
import { Findings } from '../projects/findings.js';
import { archiveFile, archiveTree, type DirectoryRead, SourceFetch } from './archive-reader.js';

export const SourceKind = { Tree: 'tree', File: 'file' } as const;
export interface SourceRequest {
  project_id: string;
  branch_id: string;
  kind: (typeof SourceKind)[keyof typeof SourceKind];
  path?: string;
  scan_id?: string;
  start_line?: number;
  end_line?: number;
  depth?: number;
}

export function sourcePath(value = ''): string {
  const path = value.replace(/\\/g, '/');

  if (
    path.startsWith('/') ||
    path.includes(':') ||
    path.includes(String.fromCharCode(0)) ||
    path.split('/').some((part) => part === '..' || part === '.')
  ) {
    validation('Source path must be relative and must not contain parent segments.');
  }

  return path;
}

export async function readDirectory(
  api: AieApi,
  projectId: string,
  branchId: string,
  path = '',
  depth = 1,
): Promise<DirectoryRead> {
  const target = { projectId, branchId, depth };

  try {
    return await api.json(
      path
        ? api.directories.apiDirectoryContentProjectIdBranchesBranchIdPathGetRaw({ ...target, path })
        : api.directories.apiDirectoryContentProjectIdBranchesBranchIdGetRaw(target),
    );
  } catch (error) {
    if (!(error instanceof ToolError) || error.code !== ErrorCode.NotFound) {
      throw error;
    }

    return archiveTree(api, projectId, branchId, path, depth);
  }
}

export async function sourcesReady(api: AieApi, projectId: string, branchId: string, uploadedFiles?: number) {
  await new Findings(api).branch(projectId, branchId);
  const branch = await api.json(api.branches.apiBranchesBranchIdGetRaw({ branchId }));
  const settings = await api.json(api.branches.apiBranchesBranchIdSourcesSettingsGetRaw({ branchId }));

  if (!settings.scanTargetName || !(Date.parse(branch.sourcesChangingDate ?? '') > 0)) {
    throw new ToolError(ErrorCode.SourcesNotReady, 'The selected branch has no confirmed populated source target.', {
      effects: Effects.NotApplied,
      target: { project_id: projectId, branch_id: branchId },
    });
  }

  let directoryVerified = false;

  try {
    // Readiness must not download an entire archive on older AIE releases.
    const tree = await api.json(
      api.directories.apiDirectoryContentProjectIdBranchesBranchIdGetRaw({ projectId, branchId, depth: 1 }),
    );

    if (!tree._files?.length && !tree._directories?.length) {
      throw new ToolError(ErrorCode.SourcesNotReady, 'The selected branch source target is empty.', {
        effects: Effects.NotApplied,
      });
    }

    directoryVerified = true;
  } catch (error) {
    if (!(error instanceof ToolError) || error.code !== ErrorCode.NotFound) {
      throw error;
    }
  }

  const metadataProof = uploadedFiles
    ? 'accepted_nonempty_upload_and_branch_readback'
    : 'configured_target_and_branch_readback';

  return {
    ...branch,
    source_directory_verified: directoryVerified,
    source_readiness: directoryVerified ? 'nonempty_directory_and_branch_readback' : metadataProof,
  };
}

export class SourceReader {

  public constructor(private readonly api: AieApi) {}

  public async tree(request: SourceRequest) {
    await this.validate(request);
    const path = sourcePath(request.path);
    const tree = await readDirectory(this.api, request.project_id, request.branch_id, path, request.depth ?? 1);

    return {
      items: treeEntries(tree, path),
      metadata: {
        ...sourceOrigin(request),
        depth: request.depth ?? 1,
        tree_scope: 'requested_depth_only',
        fetch_source: tree.fetch_source ?? SourceFetch.Direct,
      },
    };
  }

  public async file(request: SourceRequest) {
    await this.validate(request);
    const file = sourcePath(request.path);

    if (!file) {
      validation('path is required for file reads.');
    }

    const from = request.start_line ?? 1;
    const to = request.end_line ?? from + 199;

    if (to < from) {
      validation('end_line must not precede start_line.');
    }

    const loaded = await this.loadFile(request, file);
    const text = sourceText(loaded.body);
    const lines = text.length ? text.split(/\r?\n/) : [];
    const selected = lines.slice(from - 1, to);
    const bytes = Buffer.from(selected.join('\n'));
    const content = new TextDecoder().decode(bytes.subarray(0, LIMITS.sourceResponseBytes), {
      stream: bytes.length > LIMITS.sourceResponseBytes,
    });

    const returnedLines = selected.length ? content.split('\n').length : 0;

    return {
      ...sourceOrigin(request),
      path: file,
      start_line: from,
      end_line: returnedLines ? from + returnedLines - 1 : null,
      returned_lines: returnedLines,
      total_lines: lines.length,
      content,
      truncated: bytes.length > LIMITS.sourceResponseBytes || to < lines.length,
      byte_limit: LIMITS.sourceResponseBytes,
      fetch_source: loaded.fetch_source,
    };
  }

  private async validate(request: SourceRequest) {
    await new Findings(this.api).branch(request.project_id, request.branch_id);

    if (request.scan_id) {
      await new Findings(this.api).scan(request.project_id, request.scan_id, request.branch_id);
    }
  }

  private async loadFile(request: SourceRequest, file: string) {
    try {
      const response = await this.api.response(
        this.api.files.apiFileContentProjectIdBranchesBranchIdFileGetRaw({
          projectId: request.project_id,
          branchId: request.branch_id,
          file,
        }),
      );

      return { body: await boundedBody(response, LIMITS.sourceReadBytes), fetch_source: SourceFetch.Direct };
    } catch (error) {
      if (!(error instanceof ToolError) || error.code !== ErrorCode.NotFound) {
        throw error;
      }

      return {
        body: await archiveFile(this.api, request.project_id, request.branch_id, file),
        fetch_source: SourceFetch.Archive,
      };
    }
  }
}

function sourceOrigin(request: SourceRequest) {
  return {
    project_id: request.project_id,
    branch_id: request.branch_id,
    scan_id: request.scan_id,
    content_source: 'current_branch_sources_or_temp',
    snapshot_match: 'unknown',
  };
}

function sourceText(body: Buffer): string {
  const bom = body.subarray(0, 2).toString('hex');
  let encoding = 'utf-8';

  if (bom === 'fffe') {
    encoding = 'utf-16le';
  }

  if (bom === 'feff') {
    encoding = 'utf-16be';
  }

  let text: string;

  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(body);
  } catch {
    validation('Source encoding is unsupported or malformed. Use UTF-8 or BOM-marked UTF-16.');
  }

  if (text.includes(String.fromCharCode(0))) {
    validation('Binary source files cannot be returned as text.');
  }

  return text;
}

function treeEntries(tree: DirectoryContent, prefix: string): Array<{ path: string; kind: string }> {
  const entries: Array<{ path: string; kind: string }> = (tree._files ?? []).map((file) => ({
    path: [prefix, file].filter(Boolean).join('/'),
    kind: SourceKind.File,
  }));

  for (const child of tree._directories ?? []) {
    const path = [prefix, child.name].filter(Boolean).join('/');
    entries.push({ path, kind: SourceKind.Tree }, ...treeEntries(child, path));
  }

  return entries;
}
