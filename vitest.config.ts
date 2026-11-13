import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'themes/*/test/**/*.test.ts',
      'examples/plugins/*/test/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      // Browser scripts (*.browser.ts) and the Studio's screen run in the page: the e2e suite covers them.
      exclude: ['packages/astro/src/**', 'packages/*/src/**/*.browser.ts', 'packages/studio/src/app/**'],
      reporter: ['text-summary', 'text', 'lcov'],
      // NFR-08: >= 80 % on the kernel and plugins. The Astro glue is covered by e2e tests.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
