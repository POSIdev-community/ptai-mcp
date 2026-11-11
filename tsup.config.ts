import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  // Ship only the SDK modules used by stdio; its optional HTTP adapter requires Node20.
  noExternal: ['@modelcontextprotocol/sdk'],
  shims: true,
  banner: {
    js: "import { createRequire as createBundleRequire } from 'node:module'; const require = createBundleRequire(import.meta.url);",
  },
  metafile: true,
  clean: true,
  sourcemap: true,
  minify: true,
  dts: false,
});
