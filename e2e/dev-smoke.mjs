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
// The demo with a probe plugin that adds development endpoints (e2e/fixtures/dev.config.ts).
process.env.VVITRINE_CONFIG = '../e2e/fixtures/dev.config.ts';
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

  // Development endpoints (US-153): they get the site, methods and bodies arrive, other sites' pages are refused.
  if (!failure) {
    const endpoint = (path, init) => fetch(`http://localhost:${port}/__vvitrine/probe/${path}`, init);
    const site = await (await endpoint('site')).json().catch(() => undefined);
    const echo = await (
      await endpoint('echo', { method: 'POST', body: 'hello', headers: { origin: `http://localhost:${port}` } })
    ).text();
    const foreign = await endpoint('echo', { method: 'POST', body: 'x', headers: { origin: 'https://evil.example' } });
    if (JSON.stringify(site?.locales) !== '["fr","en"]') failure = 'a development endpoint did not get the site';
    else if (echo !== 'POST hello') failure = `a development endpoint answered "${echo}" to a POST`;
    else if (foreign.status !== 403) failure = `a request from another site got ${foreign.status}, not 403`;
  }

  // Saving a content file tells the open page to reload. The file is written back with the same bytes.
  if (!failure) {
    const client = await (await fetch(`http://localhost:${port}/@vite/client`)).text();
    const token = /wsToken = "([^"]+)"/.exec(client)?.[1] ?? '';
    const socket = new WebSocket(`ws://localhost:${port}/?token=${token}`, 'vite-hmr');
    const reloaded = new Promise((resolve) => {
      socket.addEventListener('message', (event) => {
        if (JSON.parse(String(event.data)).type === 'full-reload') resolve(true);
      });
      setTimeout(() => resolve(false), 10_000);
    });
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    const content = new URL('../site/content/resume.en.yaml', import.meta.url);
    writeFileSync(content, readFileSync(content));
    if (!(await reloaded)) failure = 'saving a content file did not reload the page in dev';
    socket.close();
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
