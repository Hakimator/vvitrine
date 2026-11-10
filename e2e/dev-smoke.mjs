// Dev-mode smoke test: `astro dev` loads TypeScript differently from `astro build`
// (Node type stripping), so a page that builds can still fail in dev. Run: pnpm e2e:dev
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = 4330;
// The server reads a copy of the demo's layout file, so the test can change it without touching site/site.yaml.
const folder = mkdtempSync(join(tmpdir(), 'vvitrine-dev-'));
const layout = join(folder, 'site.yaml');
copyFileSync(new URL('../site/site.yaml', import.meta.url), layout);
process.env.VVITRINE_LAYOUT = layout;
// Each command must return quickly: a hung command fails the test instead of blocking CI.
const astro = (...args) =>
  execFileSync('pnpm', ['--filter', 'site', 'exec', 'astro', ...args], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
    timeout: 60_000,
  });

// `--background` is explicit: without it, Astro chooses foreground or background
// from the environment, and a foreground server never returns here.
astro('dev', '--background', '--port', String(port));
let failure = null;
try {
  const deadline = Date.now() + 30_000;
  let response;
  while (Date.now() < deadline) {
    response = await fetch(`http://localhost:${port}/en/projects/bibliotheque/`).catch(() => undefined);
    if (response) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!response) failure = 'dev server did not answer within 30 s';
  else if (response.status !== 200) failure = `dev server answered ${response.status}`;
  else if (!(await response.text()).includes('Library manager')) failure = 'project page content missing in dev';

  // A change to the layout file shows on the next request, without restarting the server.
  if (!failure) {
    writeFileSync(
      layout,
      readFileSync(layout, 'utf8').replace('section.work.title: Experience', 'section.work.title: Career path'),
    );
    let seen = false;
    const until = Date.now() + 15_000;
    while (!seen && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 500));
      const page = await fetch(`http://localhost:${port}/en/`).catch(() => undefined);
      seen = page?.status === 200 && (await page.text()).includes('Career path');
    }
    if (!seen) failure = 'a change to the layout file did not show in dev';
  }
} finally {
  astro('dev', 'stop');
  rmSync(folder, { recursive: true, force: true });
}
if (failure) {
  console.error(`dev smoke test failed: ${failure}`);
  process.exit(1);
}
console.info('dev smoke test passed');
