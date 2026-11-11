import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { HttpHeader } from '../../shared/http-constants.js';
import { LIMITS } from '../../shared/limits.js';

export async function boundedBody(response: Response, maximum = LIMITS.jsonBytes): Promise<Buffer> {
  if (Number(response.headers.get(HttpHeader.ContentLength)) > maximum) {
    await response.body?.cancel();
    throw new ToolError(ErrorCode.UpstreamLimit, 'The server response exceeds the configured limit.');
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];
  let bytes = 0;

  try {
    while (true) {
      const item = await reader.read();

      if (item.done) {
        break;
      }

      bytes += item.value.byteLength;

      if (bytes > maximum) {
        throw new ToolError(ErrorCode.UpstreamLimit, 'The server response exceeds the configured limit.');
      }

      chunks.push(Buffer.from(item.value));
    }

    return Buffer.concat(chunks, bytes);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
