// Framework file: you normally never edit it. Your settings live in vvitrine.config.ts.
// SITE_URL and BASE_PATH are set automatically by the GitHub Pages workflow
// (e.g. https://user.github.io and /repo-name); leave them empty for a custom domain at the root.
import { defineConfig } from 'astro/config';
import vvitrine from '@vvitrine/astro';

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [vvitrine()],
});
