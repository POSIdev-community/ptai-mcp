import { Ajv } from 'ajv';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { AieToolName } from '../tool-names.js';
import { aieCatalog } from './catalog.js';
import { type ToolCall } from './tool-contract.js';

const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const validators = new Map(aieCatalog.map((tool) => [tool.name, ajv.compile(tool.inputSchema)]));
const toolNames = new Set<string>(Object.values(AieToolName));

export function parseToolCall(name: string, args: unknown): ToolCall {
  const validate = validators.get(name);

  if (!toolNames.has(name) || !validate || !validate(args)) {
    throw new ToolError(ErrorCode.ValidationError, 'Tool arguments do not match its schema.', {
      effects: Effects.NotApplied,
    });
  }

  // JSON Schema is the runtime contract for this discriminated command union.
  // Keep the assertion at this boundary; handlers receive typed arguments.
  return { name, args } as ToolCall;
}
