// Dev-mode smoke test: `astro dev` loads TypeScript differently from `astro build`
// (Node type stripping), so a page that builds can still fail in dev. Run: pnpm e2e:dev
import { execFileSync } from 'node:child_process';

const port = 4330;
const astro = (...args) =>
  execFileSync('pnpm', ['--filter', 'site', 'exec', 'astro', ...args], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

astro('dev', '--port', String(port));
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
} finally {
  astro('dev', 'stop');
}
if (failure) {
  console.error(`dev smoke test failed: ${failure}`);
  process.exit(1);
}
console.info('dev smoke test passed');
