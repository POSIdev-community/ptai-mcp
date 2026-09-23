import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 90,
        branches: 80,
      },
    },
  },
});
