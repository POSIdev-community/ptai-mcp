import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { Effects } from '../shared/effects.js';
import { ErrorCode } from '../shared/error-codes.js';
import { ToolError } from '../shared/errors.js';
import { revision } from '../shared/json.js';
import { localCatalog } from './catalog.js';

const expectedTools = toolFingerprint(localCatalog.tools);
const expectedDescriptors = descriptorFingerprint(
  localCatalog.resources,
  localCatalog.resourceTemplates,
  localCatalog.prompts,
);

export async function assertCompatibleCatalog(client: Client): Promise<void> {
  const tools = await client.listTools();

  if (toolFingerprint(tools.tools) !== expectedTools) {
    throw new ToolError(
      ErrorCode.LocalBundleIncompatible,
      'The installed proxy tool schemas do not match the bundled catalog.',
      {
        next_action: 'Use a verified npm/bundle pair or update the bundle, then restart MCP.',
        effects: Effects.NotApplied,
      },
    );
  }

  const resources = await client.listResources();
  const templates = await client.listResourceTemplates();
  const prompts = await client.listPrompts();
  const actualDescriptors = descriptorFingerprint(resources.resources, templates.resourceTemplates, prompts.prompts);

  if (actualDescriptors !== expectedDescriptors) {
    throw new ToolError(
      ErrorCode.LocalBundleIncompatible,
      'The installed proxy resources or prompts do not match the bundled catalog.',
      { effects: Effects.NotApplied },
    );
  }
}

function toolFingerprint(tools: ReadonlyArray<{ name: string; inputSchema: unknown }>): string {
  const schemas = tools.map(({ name, inputSchema }) => ({ name, inputSchema }));

  return revision(schemas.sort((left, right) => left.name.localeCompare(right.name)));
}

function sortedEntries(entries: unknown[]): unknown[] {
  return entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function descriptorFingerprint(
  resources: readonly Resource[],
  templates: readonly ResourceTemplate[],
  prompts: ReadonlyArray<{ name: string; arguments?: readonly unknown[] }>,
): string {
  return revision({
    resources: sortedEntries(resources.map(({ name, uri, mimeType }) => ({ name, uri, mimeType }))),
    templates: sortedEntries(templates.map(({ name, uriTemplate, mimeType }) => ({ name, uriTemplate, mimeType }))),
    prompts: sortedEntries(prompts.map(({ name, arguments: args }) => ({ name, arguments: args ?? [] }))),
  });
}
