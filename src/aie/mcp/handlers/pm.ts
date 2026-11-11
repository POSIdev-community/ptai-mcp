import { record } from '../../../shared/json.js';
import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const pmHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.ListPmCatalog]: async (args, context) => {
    const data = await context.list(
      AieToolName.ListPmCatalog,
      { kind: args.kind, include_create_schema: args.include_create_schema },
      args,
      async () => {
        const entries = await context.pm.list(args.kind);

        return entries.map((item) => {
          const entry = record(item);

          return {
            id: entry.id,
            name: entry.name,
            description: entry.description,
            level: entry.level,
            rules_count: entry.rulesCount,
            modified_date: entry.modifiedDate,
          };
        });
      },
    );

    return {
      ...data,
      kind: args.kind,
      create_schema: args.include_create_schema ? context.pm.schema(args.kind) : undefined,
    };
  },
  [AieToolName.GetPmCatalogEntry]: (args, context) => context.pm.entry(args.kind, args.id),
  [AieToolName.SavePmCatalogEntry]: (args, context) =>
    context.pm.save(args.kind, args.action, args.id, args.value, args.changes, args.base_revision),
};

type Names =
  typeof AieToolName.ListPmCatalog | typeof AieToolName.GetPmCatalogEntry | typeof AieToolName.SavePmCatalogEntry;
