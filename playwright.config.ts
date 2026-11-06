import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the static builds (run `pnpm build:all` first):
 *   site/dist       corporate theme, served at /
 *   site/dist-bold  bold theme (e2e/fixtures/bold.config.ts)
 *   site/dist-base  corporate theme under a base path, like GitHub project pages
 */
const serve = (dir: string, port: number, base = '') => ({
  command: `node e2e/serve.mjs site/${dir} ${port} ${base}`,
  url: `http://localhost:${port}${base}/`,
  reuseExistingServer: !process.env.CI,
});

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  webServer: [serve('dist', 4321), serve('dist-bold', 4322), serve('dist-base', 4323, '/demo')],
  projects: [
    {
      name: 'corporate',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' },
      testIgnore: /base-path/,
    },
    { name: 'bold', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322' }, testIgnore: /base-path/ },
    {
      name: 'base-path',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4323' },
      testMatch: /base-path/,
    },
  ],
});
