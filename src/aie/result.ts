import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AieError, safeError } from './errors.js';
import { LIMITS } from './limits.js';

export function result(value: Record<string, unknown>, isError = false): CallToolResult {
  const response: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };
  if (Buffer.byteLength(JSON.stringify(response)) > LIMITS.resultBytes) {
    const effects = ['not_applied', 'applied', 'partial', 'unknown'].includes(String(value.effects))
      ? (value.effects as 'not_applied' | 'applied' | 'partial' | 'unknown')
      : undefined;
    const ids = Object.fromEntries(
      ['operation_id', 'project_id', 'branch_id', 'queue_id', 'scan_id', 'id', 'kind', 'section'].flatMap((key) =>
        typeof value[key] === 'string' && value[key].length <= 1024 ? [[key, value[key]]] : [],
      ),
    );
    const error = new AieError('AIE_RESULT_LIMIT', 'Result exceeds the MCP response limit. Narrow the query.', {
      next_action: 'Request fewer records or one issue detail.',
      effects,
      target: ids,
    });
    return result({ error: safeError(error, 'serialize_result') }, true);
  }
  return response;
}
