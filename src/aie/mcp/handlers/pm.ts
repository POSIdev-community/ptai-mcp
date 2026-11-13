import { record } from '../../../shared/json.js';
import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { ToolArguments } from '../tool-contract.js';

export const pmHandlers: Pick<ToolHandlers, PmToolNames> = {
  [AieToolName.ListPmCatalog]: listPmCatalog,
  [AieToolName.GetPmCatalogEntry]: getPmCatalogEntry,
  [AieToolName.SavePmCatalogEntry]: savePmCatalogEntry,
};

async function listPmCatalog(args: ListPmCatalogArguments, context: ToolContext) {
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
}

function getPmCatalogEntry(args: GetPmCatalogEntryArguments, context: ToolContext) {
  return context.pm.entry(args.kind, args.id);
}

function savePmCatalogEntry(args: SavePmCatalogEntryArguments, context: ToolContext) {
  return context.pm.save(args.kind, args.action, args.id, args.value, args.changes, args.base_revision);
}

type PmToolNames =
  typeof AieToolName.ListPmCatalog | typeof AieToolName.GetPmCatalogEntry | typeof AieToolName.SavePmCatalogEntry;

type ListPmCatalogArguments = ToolArguments[typeof AieToolName.ListPmCatalog];
type GetPmCatalogEntryArguments = ToolArguments[typeof AieToolName.GetPmCatalogEntry];
type SavePmCatalogEntryArguments = ToolArguments[typeof AieToolName.SavePmCatalogEntry];
