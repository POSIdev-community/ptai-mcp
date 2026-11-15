import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import type { DirectoryContent } from '../../vendor/aie-v63/src/models/index.js';

const maxDirectoryDepth = 64;

/** Normalize the confirmed legacy FileStore and current BFF JSON contracts at the boundary. */
export function directoryContent(value: unknown): DirectoryContent {
  return readNode(value, 0);
}

function readNode(value: unknown, depth: number, legacyParent = false): DirectoryContent {
  if (depth > maxDirectoryDepth) {
    throw new ToolError(ErrorCode.UpstreamLimit, 'Source directory nesting exceeds the supported limit.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidDirectory();
  }

  const node = value as Record<string, unknown>;
  const current = ['fileNames', 'directories', 'hasContent'].some((key) => Object.hasOwn(node, key));
  const legacy =
    ['_files', '_directories', '_hasContent'].some((key) => Object.hasOwn(node, key)) || (legacyParent && !current);

  const files = current ? node.fileNames : node._files;
  const children = current ? node.directories : node._directories;
  const populated = current ? node.hasContent : node._hasContent;
  const name = legacy && depth === 0 && node.name == null ? '' : node.name;

  if (
    legacy === current ||
    typeof name !== 'string' ||
    (typeof populated !== 'boolean' && !(legacy && populated === undefined)) ||
    (!Array.isArray(files) && !(legacy && files == null)) ||
    (!Array.isArray(children) && !(legacy && children == null))
  ) {
    return invalidDirectory();
  }

  const names = (files ?? []) as unknown[];

  if (!names.every((name): name is string => typeof name === 'string')) {
    return invalidDirectory();
  }

  return {
    name,
    _files: names,
    _directories: ((children ?? []) as unknown[]).map((child) => readNode(child, depth + 1, legacy)),
    _hasContent: populated,
  };
}

function invalidDirectory(): never {
  throw new ToolError(ErrorCode.InvalidResponse, 'AIE returned an unsupported or malformed source directory.', {
    effects: Effects.NotApplied,
  });
}
