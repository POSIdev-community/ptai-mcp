import type { JsonObject } from '../../shared/json.js';
import type { ToolContext } from './context.js';
import type { ConnectedToolName, ToolArguments } from './tool-contract.js';

export type ToolHandler<Name extends ConnectedToolName> = (
  args: ToolArguments[Name],
  context: ToolContext,
) => JsonObject | Promise<JsonObject>;

export type ToolHandlers = { [Name in ConnectedToolName]: ToolHandler<Name> };
