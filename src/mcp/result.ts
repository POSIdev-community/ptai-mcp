import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Effects } from '../shared/effects.js';
import { ErrorCode } from '../shared/error-codes.js';
import { safeError, ToolError } from '../shared/errors.js';
import { LIMITS } from '../shared/limits.js';
import { McpContentType } from './constants.js';

export function result(value: Record<string, unknown>, isError = false): CallToolResult {
  const response: CallToolResult = {
    content: [{ type: McpContentType.Text, text: JSON.stringify(value) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };

  if (Buffer.byteLength(JSON.stringify(response)) > LIMITS.resultBytes) {
    const effects = Object.values(Effects).find((effect) => effect === value.effects);
    const ids = Object.fromEntries(
      ['operation_id', 'project_id', 'branch_id', 'queue_id', 'scan_id', 'id', 'kind', 'section'].flatMap((key) =>
        typeof value[key] === 'string' && value[key].length <= 1024 ? [[key, value[key]]] : [],
      ),
    );

    const error = new ToolError(ErrorCode.ResultLimit, 'Result exceeds the MCP response limit. Narrow the query.', {
      next_action: 'Request fewer records or one issue detail.',
      effects,
      target: ids,
    });

    return result({ error: safeError(error, 'serialize_result') }, true);
  }

  return response;
}
