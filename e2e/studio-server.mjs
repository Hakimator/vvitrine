// The dev server of the Studio tests (Playwright starts and stops it): the demo, reading a copy of its content and of
// its layout file, so that the tests can save without touching site/. Each start begins from a fresh copy.
import { spawn } from 'node:child_process';
import { copyFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [port = '4325'] = process.argv.slice(2);
// The same folder as e2e/studio.spec.ts, which reads the files the Studio wrote.
const folder = join(tmpdir(), 'vvitrine-studio-e2e');
rmSync(folder, { recursive: true, force: true });
cpSync(new URL('../site/content', import.meta.url), folder, { recursive: true });
copyFileSync(new URL('../site/site.yaml', import.meta.url), join(folder, 'site.yaml'));

const server = spawn(
  'pnpm',
  // In the foreground, whatever the environment (Astro may choose the background), and beside any `pnpm dev` running.
  ['--filter', 'site', 'exec', 'astro', 'dev', '--port', port, '--ignore-lock'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      VVITRINE_CONFIG: '../e2e/fixtures/studio.config.ts',
      VVITRINE_LAYOUT: join(folder, 'site.yaml'),
      VVITRINE_STUDIO_CONTENT: folder,
    },
  },
);
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
