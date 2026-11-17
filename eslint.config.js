import { fileURLToPath, URL } from 'node:url';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';
import constructorSize from './scripts/eslint/constructor-size.mjs';
import fileSize, { fileSizeLimit } from './scripts/eslint/file-size.mjs';
import functionSize from './scripts/eslint/function-size.mjs';
import memberSpacing from './scripts/eslint/member-spacing.mjs';
import moduleOrder from './scripts/eslint/module-order.mjs';
import noDuplicateStrings from './scripts/eslint/no-duplicate-strings.mjs';
import noExportedMutableCollections from './scripts/eslint/no-exported-mutable-collections.mjs';
import noMagicProtocolStrings from './scripts/eslint/no-magic-protocol-strings.mjs';
import objectFunctionSize from './scripts/eslint/object-function-size.mjs';
import restrictedModuleImports from './scripts/eslint/restricted-module-imports.mjs';

const classLayout = {
  memberTypes: [
    'public-static-field',
    'protected-static-field',
    ['private-static-field', '#private-static-field'],
    'public-instance-field',
    'protected-instance-field',
    ['private-instance-field', '#private-instance-field'],
    'constructor',
    ['public-get', 'public-set', 'public-method'],
    ['protected-get', 'protected-set', 'protected-method'],
    ['private-get', 'private-set', 'private-method', '#private-get', '#private-set', '#private-method'],
  ],
  order: 'as-written',
};

export default tseslint.config(
  { linterOptions: { noInlineConfig: true } },
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      '.cursor/',
      'src/vendor/',
      '.runtime/',
      '.cache/',
      'scripts/bootstrap-live-session.mjs',
      'scripts/live-*.mjs',
      'scripts/probe-*.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ['assets/**/*.js'],
    languageOptions: {
      globals: Object.fromEntries(
        ['document', 'fetch', 'setInterval', 'clearInterval'].map((name) => [name, 'readonly']),
      ),
    },
  },
  {
    files: ['scripts/**/*.mjs', 'bin/**/*.js'],
    languageOptions: {
      globals: Object.fromEntries(
        [
          'process',
          'console',
          'Buffer',
          'URL',
          'fetch',
          'Response',
          'AbortController',
          'setTimeout',
          'clearTimeout',
        ].map((name) => [name, 'readonly']),
      ),
    },
  },
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      curly: ['error', 'all'],
      'max-depth': ['error', 3],
      'max-statements-per-line': ['error', { max: 1 }],
      'no-nested-ternary': 'error',
      'no-duplicate-imports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          // Ordered subgroups inside one compact block, including type-only imports.
          groups: [['^\\u0000', '^node:', '^@?\\w', '^', '^\\.']],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program > :not(ImportDeclaration) ~ ImportDeclaration',
          message: 'Place imports at the beginning of the module, before declarations and exports.',
        },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'never', prev: 'import', next: 'import' },
      ],
      'no-unneeded-ternary': 'error',
      'no-else-return': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'max-len': [
        'error',
        {
          code: 120,
          comments: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'no-console': 'off', // This is a CLI app
    },
  },
  {
    files: ['src/**/*.{ts,js}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)) },
    },
    plugins: {
      project: {
        rules: {
          'no-magic-protocol-strings': noMagicProtocolStrings,
          'member-spacing': memberSpacing,
          'module-order': moduleOrder,
          'function-size': functionSize,
          'object-function-size': objectFunctionSize,
          'no-exported-mutable-collections': noExportedMutableCollections,
          'restricted-module-imports': restrictedModuleImports,
          'constructor-size': constructorSize,
          'file-size': fileSize,
          'file-size-limit': fileSizeLimit,
          'no-duplicate-strings': noDuplicateStrings,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'project/no-magic-protocol-strings': 'error',
      'project/member-spacing': 'error',
      'project/module-order': 'error',
      'project/function-size': 'warn',
      'project/object-function-size': 'error',
      'project/no-exported-mutable-collections': 'error',
      complexity: ['warn', 15],
      'max-nested-callbacks': ['error', 2],
      'project/constructor-size': 'error',
      'project/file-size': 'warn',
      'project/file-size-limit': 'error',
      'project/no-duplicate-strings': 'warn',
      '@typescript-eslint/member-ordering': [
        'error',
        { default: 'never', classes: classLayout, classExpressions: classLayout },
      ],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: ['multiline-const', 'multiline-let'], next: '*' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'never', prev: 'import', next: 'import' },
      ],
    },
  },
  {
    files: ['src/aie/mcp/handlers/**/*.ts'],
    rules: {
      'project/restricted-module-imports': [
        'error',
        [
          {
            path: fileURLToPath(new URL('./src/aie/mcp/handlers.ts', import.meta.url)),
            reason:
              'Handler implementations import shared types from handler-contract.js; the registry assembles implementations.',
          },
        ],
      ],
    },
  },
  {
    // Snapshot generated from the external analyzer catalog, like src/vendor.
    files: ['src/local/catalog.ts'],
    rules: { 'project/no-magic-protocol-strings': 'off', 'project/no-duplicate-strings': 'off' },
  },
  {
    files: ['src/aie/sources/extract.ts'],
    // ZIP entry validation deliberately rejects control characters in untrusted names.
    rules: { 'no-control-regex': 'off' },
  },
);
