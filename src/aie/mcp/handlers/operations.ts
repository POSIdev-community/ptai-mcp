import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const operationHandlers: Pick<
  ToolHandlers,
  typeof AieToolName.GetOperation | typeof AieToolName.CancelOperation
> = {
  [AieToolName.GetOperation]: (args, context) => context.operations.get(context.session.identity, args.operation_id),
  [AieToolName.CancelOperation]: (args, context) =>
    context.operations.cancel(context.session.identity, args.operation_id),
};
