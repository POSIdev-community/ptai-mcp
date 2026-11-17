import { type ToolContext } from './context.js';
import { type ToolHandlers } from './handler-contract.js';
import { findingHandlers } from './handlers/findings.js';
import { operationHandlers } from './handlers/operations.js';
import { pmHandlers } from './handlers/pm.js';
import { projectHandlers } from './handlers/projects.js';
import { scanHandlers } from './handlers/scans.js';
import { settingsHandlers } from './handlers/settings.js';
import { sourceHandlers } from './handlers/sources.js';
import type { ConnectedToolCall, ConnectedToolName } from './tool-contract.js';

const handlers: ToolHandlers = {
  ...projectHandlers,
  ...findingHandlers,
  ...settingsHandlers,
  ...pmHandlers,
  ...sourceHandlers,
  ...scanHandlers,
  ...operationHandlers,
};

export function invokeHandler<Name extends ConnectedToolName>(call: ConnectedToolCall<Name>, context: ToolContext) {
  return handlers[call.name](call.args, context);
}
