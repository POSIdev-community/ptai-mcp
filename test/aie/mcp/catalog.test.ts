import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import { aieCatalog } from '../../../src/aie/mcp/catalog.js';
import { parseToolCall } from '../../../src/aie/mcp/validation.js';
import { AieToolName } from '../../../src/aie/tool-names.js';

describe('AIE public tool metadata', () => {
  it('defines every named tool once and compiles all argument schemas in strict mode', () => {
    const names = aieCatalog.map((tool) => tool.name);
    expect([...names].sort()).toEqual(Object.values(AieToolName).sort());
    expect(new Set(names).size).toBe(names.length);
    const ajv = new Ajv({ strict: true });
    ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    for (const definition of aieCatalog) {
      expect(() => ajv.compile(definition.inputSchema), definition.name).not.toThrow();
    }
  });

  it('keeps branch selection optional for historical findings and validates target IDs', () => {
    const args = {
      project_id: '11111111-1111-1111-1111-111111111111',
      scan_id: '22222222-2222-2222-2222-222222222222',
    };
    expect(parseToolCall(AieToolName.ListIssues, args)).toEqual({ name: AieToolName.ListIssues, args });
    expect(() => parseToolCall(AieToolName.ListIssues, { ...args, project_id: 'invalid' })).toThrow();
    expect(() => parseToolCall(AieToolName.ListIssues, { ...args, unexpected: true })).toThrow();
  });
});
