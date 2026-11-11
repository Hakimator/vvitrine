/**
 * Dev-mode fixture (pnpm e2e:dev): the demo site, with a probe plugin that adds development endpoints, as the Studio
 * will. The theme and pages come from the demo's site.yaml (VVITRINE_LAYOUT).
 */
import type { Plugin } from '@vvitrine/core';
import config from '../../site/vvitrine.config.ts';

const probe: Plugin = {
  name: 'dev-probe',
  kind: 'service',
  apiVersion: 1,
  hooks: {
    devEndpoints: () => [
      // Tells which languages the site has: proof that the endpoint gets the site.
      { path: '/__vvitrine/probe/site', handle: (_request, { site }) => Response.json({ locales: site.locales }) },
      // Sends back what it gets: proof that methods and bodies arrive.
      {
        path: '/__vvitrine/probe/echo',
        handle: async (request) => new Response(`${request.method} ${await request.text()}`),
      },
    ],
  },
};

export default { ...config, plugins: [...config.plugins, probe] };
