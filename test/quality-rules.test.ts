import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

function createLinter(fix = false, typed = false) {
  return new ESLint({
    fix,
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: typed } },
      rules: {
        'prettier/prettier': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        'project/function-size': ['warn', { reportAll: true }],
        'project/file-size': ['warn', { reportAll: true }],
      },
    },
  });
}

const eslint = createLinter();

async function messages(code: string, filePath = 'src/shared/errors.ts') {
  return (await eslint.lintText(code, { filePath }))[0].messages;
}

describe('repository readability rules', () => {
  it('keeps vocabulary values beside their types and initialization before the public API', async () => {
    const result = await messages(
      [
        "export const Mode = { Read: 'read' } as const;",
        'export type Mode = (typeof Mode)[keyof typeof Mode];',
        'const defaultMode = Mode.Read;',
        'export function read(): LocalResult { return normalize(defaultMode); }',
        'function normalize(mode: Mode): LocalResult { return { mode }; }',
        'interface LocalResult { mode: Mode; }',
      ].join('\n'),
    );
    expect(result.filter((message) => message.ruleId === 'project/module-order')).toEqual([]);
  });

  it.each([
    'function helper() {}\nexport function api() { helper(); }',
    'export function api() {}\nconst cache = new Map();',
    'interface LocalResult {}\nexport function api(): LocalResult { return {}; }',
    'export function api() {}\nexport type PublicResult = string;',
  ])('rejects mixed declaration groups without reordering initializers: %s', async (code) => {
    const [result] = await createLinter(true).lintText(code, { filePath: 'src/shared/errors.ts' });
    const ordering = result.messages.filter((message) => message.ruleId === 'project/module-order');
    expect(ordering.length).toBeGreaterThan(0);
    expect(ordering.every((message) => message.fix === undefined)).toBe(true);
  });

  it('allows private base-class initialization before exported values and classes', async () => {
    const result = await messages(
      'class Base {}\nexport const instance = new Base();\nexport class Public extends Base {}',
    );
    expect(result.filter((message) => message.ruleId === 'project/module-order')).toEqual([]);
  });

  // The first typed lint call loads the TypeScript project, including under coverage.
  it('distinguishes schema property references from typed business values', async () => {
    const [result] = await createLinter(false, true).lintText(
      [
        'const properties = { mode: {} };',
        "export const schema: { properties: typeof properties; required: Array<keyof typeof properties> } = { properties, required: ['mode'] };",
        "export const runtimeMode: 'read' | 'write' = 'read';",
      ].join('\n'),
      { filePath: 'src/shared/errors.ts' },
    );
    const literals = result.messages.filter((message) => message.ruleId === 'project/no-magic-protocol-strings');
    expect(literals).toHaveLength(1);
    expect(literals[0].message).toContain('"read"');
  }, 15_000);
  it('keeps handler implementations independent of the registry assembly', async () => {
    const file = 'src/aie/mcp/handlers/findings.ts';
    const registry = await messages("import { invokeHandler } from '../handlers.js';\nexport { invokeHandler };", file);
    expect(registry.some((message) => message.ruleId === 'no-restricted-imports')).toBe(true);
    const contract = await messages(
      "import type { ToolHandlers } from '../handler-contract.js';\nexport type Handlers = ToolHandlers;",
      file,
    );
    expect(contract.some((message) => message.ruleId === 'no-restricted-imports')).toBe(false);
  });
  const groupedImports = [
    "import { createHash } from 'node:crypto';",
    "import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';",
    "import type { Attributes } from '@opentelemetry/api';",
    "import { Effects } from '../shared/effects.js';",
    "import type { FlusConfig } from './types.js';",
    '',
    'export { createHash, Effects };',
    'export type { CallToolResult, Attributes, FlusConfig };',
    '',
  ].join('\n');

  it('keeps ordered origins, type imports and project modules in one compact block', async () => {
    const result = await messages(groupedImports, 'src/telemetry/attributes.ts');
    expect(result.filter((message) => message.ruleId === 'simple-import-sort/imports')).toEqual([]);
  });

  it.each([
    [
      'extra gap between external packages',
      groupedImports.replace('import type { Attributes }', '\nimport type { Attributes }'),
    ],
    [
      'extra gap between parent and sibling modules',
      groupedImports.replace('import type { FlusConfig }', '\nimport type { FlusConfig }'),
    ],
    [
      'extra gap between external packages and project modules',
      groupedImports.replace("@opentelemetry/api';\n", "@opentelemetry/api';\n\n"),
    ],
  ])('rejects %s', async (_description, code) => {
    const result = await messages(code, 'src/telemetry/attributes.ts');
    expect(result.some((message) => message.ruleId === 'padding-line-between-statements')).toBe(true);
    const [fixed] = await createLinter(true).lintText(code, { filePath: 'src/telemetry/attributes.ts' });
    expect(fixed.output).toBe(groupedImports);
    const [secondPass] = await createLinter(true).lintText(fixed.output ?? code, {
      filePath: 'src/telemetry/attributes.ts',
    });
    expect(secondPass.output).toBeUndefined();
  });

  it('permits quoted SDK member names inside indexed types', async () => {
    const result = await messages(
      [
        "import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';",
        '',
        "export type MetricExportCallback = Parameters<PushMetricExporter['export']>[1];",
      ].join('\n'),
    );
    expect(result.filter((message) => message.ruleId === 'project/no-magic-protocol-strings')).toEqual([]);
  });

  it('keeps equal text with different meanings separate and reports duplicates only as advice', async () => {
    const result = await messages(
      [
        "export const displayPlaceholder = 'unknown';",
        "export const externalLabel = 'unknown';",
        "export const importedStatus = 'unknown';",
      ].join('\n'),
    );
    expect(result.filter((message) => message.ruleId === 'project/no-magic-protocol-strings')).toEqual([]);
    expect(result.find((message) => message.ruleId === 'project/no-duplicate-strings')).toMatchObject({ severity: 1 });
  });

  it('enforces a blank opening line and separates field visibility groups', async () => {
    const code =
      'export class Example {\npublic value = 1;\nprivate enabled = true;\npublic read() { return this.enabled; }\n}';
    const result = await messages(code);
    expect(
      result.filter((message) => message.ruleId === 'project/member-spacing').map((message) => message.messageId),
    ).toEqual(expect.arrayContaining(['opening', 'blank']));
  });

  it('enforces class order without offering an unsafe member-reordering fix', async () => {
    const result = await messages(
      'export class Example {\nprivate enabled = true;\npublic value = 1;\npublic read() { return this.enabled; }\n}',
    );
    const ordering = result.find((message) => message.ruleId === '@typescript-eslint/member-ordering');
    expect(ordering?.severity).toBe(2);
    expect(ordering?.fix).toBeUndefined();
  });

  it('limits constructors to 40 code lines', async () => {
    const body = Array.from({ length: 39 }, () => 'void 0;').join('\n');
    const result = await messages(`export class Example {\npublic constructor() {\n${body}\n}\n}`);
    expect(result.some((message) => message.ruleId === 'project/constructor-size')).toBe(true);
  });

  it('keeps class spacing stable between Prettier and ESLint, including nested classes and comments', async () => {
    const options = await prettier.resolveConfig('src/shared/errors.ts');
    const code =
      'export class Example { /** State */ public value = { enabled: true }; public read() { return class Nested {}; } }';
    const formatted = await prettier.format(code, { ...options, parser: 'typescript' });
    expect(formatted).toContain('class Example {\n\n');
    expect(formatted).toContain('public value = { enabled: true };');
    expect(formatted).toContain('class Nested {}');
    expect(await prettier.format(formatted, { ...options, parser: 'typescript' })).toBe(formatted);
    const [linted] = await createLinter(true).lintText(formatted, { filePath: 'src/shared/errors.ts' });
    const fixed = linted.output ?? formatted;
    expect(await prettier.format(fixed, { ...options, parser: 'typescript' })).toBe(fixed);
    const [secondPass] = await createLinter(true).lintText(fixed, { filePath: 'src/shared/errors.ts' });
    expect(secondPass.output ?? fixed).toBe(fixed);
  });

  it('rejects platform values in a typed comparison and installer IDs embedded in templates', async () => {
    const [typed] = await createLinter(false, true).lintText("export const supported = process.platform === 'linux';", {
      filePath: 'src/shared/errors.ts',
    });
    expect(typed.messages.some((message) => message.ruleId === 'project/no-magic-protocol-strings')).toBe(true);
    const template = await messages('export const filename = `AI.INFRASTRUCTURE.INSTALLATOR.${version}.zip`;');
    expect(template.some((message) => message.ruleId === 'project/no-magic-protocol-strings')).toBe(true);
  });
  it.each(['Map', 'Set', 'WeakMap', 'WeakSet'])('rejects an exported module-level mutable %s', async (collection) => {
    const result = await messages(`export const sharedState = new ${collection}();`);
    expect(result.map((message) => message.ruleId)).toContain('no-restricted-syntax');
  });

  it('allows a private collection behind an operation', async () => {
    const result = await messages(
      'const values = new Set<string>();\nexport function includes(value: string) { return values.has(value); }',
    );
    expect(result.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(false);
  });
  it('autofixes import ordering without group gaps and keeps the gap before module declarations', async () => {
    const code = [
      "import { revision } from './json.js';",
      '',
      '',
      "import { Ajv } from 'ajv';",
      "import { readFile } from 'node:fs/promises';",
      "import type { Stats } from 'node:fs';",
      '',
      "import { Effects } from './effects.js';",
      'export const values = { revision, Ajv, readFile, Effects };',
      'export type FileStats = Stats;',
      '',
    ].join('\n');
    expect((await messages(code)).map((message) => message.ruleId)).toContain('simple-import-sort/imports');
    const [fixed] = await createLinter(true).lintText(code, { filePath: 'src/shared/errors.ts' });
    expect(fixed.output).toBe(
      [
        "import type { Stats } from 'node:fs';",
        "import { readFile } from 'node:fs/promises';",
        "import { Ajv } from 'ajv';",
        "import { Effects } from './effects.js';",
        "import { revision } from './json.js';",
        '',
        'export const values = { revision, Ajv, readFile, Effects };',
        'export type FileStats = Stats;',
        '',
      ].join('\n'),
    );
    expect(fixed.messages.filter((message) => message.severity === 2)).toEqual([]);
  });

  it('preserves the relative order of side-effect imports', async () => {
    const code = "import './z-register.js';\nimport './a-start.js';\nimport path from 'node:path';\nexport { path };\n";
    const [fixed] = await createLinter(true).lintText(code, { filePath: 'src/shared/errors.ts' });
    expect(fixed.output).toContain("import './z-register.js';\nimport './a-start.js';\nimport path");
  });

  it('rejects imports below executable declarations', async () => {
    const result = await messages(
      "export const value = 1;\nimport { readFile } from 'node:fs/promises';\nexport { readFile };\n",
    );
    expect(result.map((message) => message.ruleId)).toContain('no-restricted-syntax');
  });
  it.each([
    ['curly', 'export function check(ok: boolean) { if (ok) return true; }'],
    ['curly', 'export function loop(items: number[]) { for (const item of items) console.log(item); }'],
    ['@typescript-eslint/explicit-member-accessibility', 'export class Example { run() {} }'],
    ['project/member-spacing', 'export class Example {\npublic one() {}\npublic two() {}\n}'],
    ['max-depth', 'export function deep(ok: boolean) { if(ok) { while(ok) { for(;;) { if(ok) { break; } } } } }'],
    ['max-len', `export const ${'a'.repeat(121)} = 1;`],
    ['no-nested-ternary', 'export const value = a ? b : c ? d : e;'],
    ['padding-line-between-statements', 'export function check() {\nconst value = 1;\nreturn value;\n}'],
  ])('enforces %s', async (rule, code) => {
    expect((await messages(code)).map((message) => message.ruleId)).toContain(rule);
  });

  it('rejects protocol duplication even inside another constants module', async () => {
    const [result] = await createLinter(false, true).lintText(
      "import { AuthAction } from '../aie/auth/models.js';\nexport const actions = new Set<(typeof AuthAction)[keyof typeof AuthAction]>(['login', 'logout']);",
      { filePath: 'src/telemetry/constants.ts' },
    );
    expect(result.messages.filter((message) => message.ruleId === 'project/no-magic-protocol-strings')).toHaveLength(2);
  });

  it('permits the owning declaration and references to it', async () => {
    const declaration = await messages(
      "export const AuthAction = { Login: 'login', Logout: 'logout' } as const;",
      'src/aie/auth/models.ts',
    );
    expect(declaration.some((message) => message.ruleId === 'project/no-magic-protocol-strings')).toBe(false);
    const reference = await messages(
      "import { AuthAction } from '../aie/auth/models.js';\nexport const actions = new Set([AuthAction.Login]);",
      'src/telemetry/constants.ts',
    );
    expect(reference.some((message) => message.ruleId === 'project/no-magic-protocol-strings')).toBe(false);
  });

  it.each([
    [20, 'optimal'],
    [21, 'normal'],
    [35, 'normal'],
    [36, 'acceptable'],
    [50, 'acceptable'],
    [51, 'oversized'],
  ])('classifies %s code lines as %s and blocks methods above 50', async (lines, band) => {
    const body = Array.from({ length: Number(lines) - 2 }, () => '  void 0;').join('\n');
    const result = await messages(`export function example() {\n${body}\n}`);
    expect(result.find((message) => message.ruleId === 'project/function-size')?.messageId).toBe(band);
    expect(result.some((message) => message.ruleId === 'max-lines-per-function' && message.severity === 2)).toBe(
      Number(lines) > 50,
    );
  });

  it('excludes empty lines and comments from the method size', async () => {
    const body = Array.from({ length: 100 }, () => '\n// explanation').join('\n');
    const result = await messages(`export function example() {\n${body}\nvoid 0;\n}`);
    expect(result.find((message) => message.ruleId === 'project/function-size')?.messageId).toBe('optimal');
    expect(result.some((message) => message.ruleId === 'max-lines-per-function')).toBe(false);
  });

  it.each([
    [150, 'optimal'],
    [151, 'normal'],
    [300, 'normal'],
    [301, 'review'],
    [500, 'review'],
    [501, 'oversized'],
  ])('classifies a file of %s code lines as %s', async (lines, band) => {
    const code = Array.from({ length: Number(lines) }, () => 'void 0;').join('\n');
    const result = await messages(code);
    expect(result.find((message) => message.ruleId === 'project/file-size')?.messageId).toBe(band);
    expect(result.some((message) => message.ruleId === 'project/file-size-limit')).toBe(Number(lines) > 500);
  });

  it('requires an explicit architectural reason for an oversized file', async () => {
    const body = Array.from({ length: 501 }, () => 'void 0;').join('\n');
    const reason = '// file-size-exception: This external contract is reviewed as a single versioned snapshot.\n';
    const accepted = await messages(reason + body);
    expect(accepted.find((message) => message.ruleId === 'project/file-size')?.messageId).toBe('exception');
    expect(accepted.some((message) => message.ruleId === 'project/file-size-limit')).toBe(false);
    const short = await messages('// file-size-exception: too long\n' + body);
    expect(short.find((message) => message.ruleId === 'project/file-size-limit')?.messageId).toBe('reason');
    const late = await messages('void 0;\n'.repeat(6) + reason + body);
    expect(late.some((message) => message.ruleId === 'project/file-size-limit')).toBe(true);
  });

  it('excludes comments and empty lines from file size and still reports physical lines', async () => {
    const result = await messages('// explanation\n\n'.repeat(600) + 'void 0;');
    const size = result.find((message) => message.ruleId === 'project/file-size');
    expect(size?.messageId).toBe('optimal');
    expect(size?.message).toContain('1 code lines, 1201 physical lines');
    expect(result.some((message) => message.ruleId === 'project/file-size-limit')).toBe(false);
  });
});
