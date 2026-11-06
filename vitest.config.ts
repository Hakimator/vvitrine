import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'themes/*/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/astro/src/**'],
      reporter: ['text-summary', 'text', 'lcov'],
      // NFR-08: >= 80 % on the kernel and plugins. The Astro glue is covered by e2e tests.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
