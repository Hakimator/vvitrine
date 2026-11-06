import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

export interface VVitrineIntegrationOptions {
  /** Path of the VVitrine config, relative to the project root. Overridden by the VVITRINE_CONFIG env variable. */
  readonly config?: string;
  /** Folder watched in dev mode to reload the page when content changes. */
  readonly contentDir?: string;
}

const CONFIG_ID = 'virtual:vvitrine/config';
const RUNTIME_ID = 'virtual:vvitrine/runtime';
const RESOLVED_RUNTIME_ID = '\0vvitrine-runtime';

/**
 * Composition root (ADR-009). Users never write pages: this integration injects one catch-all
 * page route (every page and plugin-contributed route) and one route for generated files.
 * The user's project only contains vvitrine.config.ts, content/, plugins/ and public/.
 */
export default function vvitrine(options: VVitrineIntegrationOptions = {}): AstroIntegration {
  return {
    name: '@vvitrine/astro',
    hooks: {
      'astro:config:setup': ({ config, command, injectRoute, updateConfig, logger }) => {
        const root = fileURLToPath(config.root);
        const configFile = process.env.VVITRINE_CONFIG ?? options.config ?? 'vvitrine.config.ts';
        const configPath = resolve(root, configFile);
        if (!existsSync(configPath)) {
          throw new Error(
            `VVitrine config not found: ${configFile}. Create it at the root of your site (see docs/getting-started.md).`,
          );
        }
        const contentDir = resolve(root, options.contentDir ?? 'content');
        const runtime = {
          root,
          base: config.base,
          siteUrl: config.site ?? process.env.SITE_URL ?? null,
          dev: command === 'dev',
        };
        logger.info(`config: ${configFile}`);

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vvitrine:virtual-modules',
                resolveId(id: string) {
                  if (id === CONFIG_ID) return configPath;
                  if (id === RUNTIME_ID) return RESOLVED_RUNTIME_ID;
                  return undefined;
                },
                load(id: string) {
                  if (id !== RESOLVED_RUNTIME_ID) return undefined;
                  return Object.entries(runtime)
                    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`)
                    .join('\n');
                },
                configureServer(server: {
                  watcher: { add(p: string): void; on(e: string, cb: (file: string) => void): void };
                  ws: { send(m: { type: string }): void };
                }) {
                  server.watcher.add(contentDir);
                  server.watcher.on('change', (file) => {
                    if (resolve(file).startsWith(contentDir)) server.ws.send({ type: 'full-reload' });
                  });
                },
              },
            ],
          },
        });

        injectRoute({ pattern: '/[...path]', entrypoint: '@vvitrine/astro/routes/page.astro', prerender: true });
        injectRoute({ pattern: '/[...file]', entrypoint: '@vvitrine/astro/routes/file.ts', prerender: true });
      },
    },
  };
}
