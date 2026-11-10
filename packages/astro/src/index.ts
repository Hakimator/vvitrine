import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { parse } from 'yaml';

export interface VVitrineIntegrationOptions {
  /** Path of the VVitrine config, relative to the project root. Overridden by the VVITRINE_CONFIG env variable. */
  readonly config?: string;
  /** Folder watched in dev mode to reload the page when content changes. */
  readonly contentDir?: string;
  /**
   * Layout file (ADR-016), relative to the project root. Overridden by the VVITRINE_LAYOUT env variable.
   * Default: site.yaml, site.yml or site.json next to the config, when one exists.
   */
  readonly layout?: string;
}

const LAYOUT_NAMES = ['site.yaml', 'site.yml', 'site.json'];

/** The layout file to read, or undefined when there is none (the layout file is optional). */
function findLayout(root: string, configPath: string, option?: string): string | undefined {
  const chosen = process.env.VVITRINE_LAYOUT ?? option;
  if (chosen) {
    const path = resolve(root, chosen);
    if (!existsSync(path)) throw new Error(`VVitrine layout file not found: ${chosen}.`);
    return path;
  }
  return LAYOUT_NAMES.map((name) => resolve(dirname(configPath), name)).find((path) => existsSync(path));
}

/**
 * The code of the layout module: the file's data and, when it names one (`theme.use`), the theme, created with its
 * options. This module is the only place the theme is imported: Astro ships the CSS of every imported theme, so the
 * themes that are installed but not chosen must never be imported.
 */
export async function layoutModule(path: string | undefined, root: string): Promise<string> {
  if (!path) return 'export default null;';
  const layout = await readLayout(path, root);
  const theme = (layout.data as { theme?: { use?: unknown; options?: unknown } } | null)?.theme;
  if (typeof theme?.use !== 'string' || theme.use === '') return `export default ${JSON.stringify(layout)};`;
  // A file next to the layout ("./plugins/my-theme.ts") or an installed package ("@vvitrine/theme-bold").
  const local = theme.use.startsWith('.') || isAbsolute(theme.use);
  const specifier = local ? resolve(dirname(path), theme.use).replaceAll('\\', '/') : theme.use;
  return [
    `import * as themeModule from ${JSON.stringify(specifier)};`,
    `const layout = ${JSON.stringify(layout)};`,
    `if (typeof themeModule.default !== 'function') {`,
    `  throw new Error(${JSON.stringify(`${layout.origin}: theme.use "${theme.use}" has no default export that creates the theme.`)});`,
    `}`,
    `export default { ...layout, theme: themeModule.default(${JSON.stringify(theme.options ?? {})}) };`,
  ].join('\n');
}

/** Parse the layout file as JSON or YAML (by extension), with the file name and position in syntax errors. */
export async function readLayout(path: string, root: string): Promise<{ data: unknown; origin: string }> {
  const origin = relative(root, path).replaceAll('\\', '/');
  const text = await readFile(path, 'utf8');
  try {
    return { data: path.endsWith('.json') ? JSON.parse(text) : parse(text, { prettyErrors: true }), origin };
  } catch (error) {
    throw new Error(`${origin} is not valid ${path.endsWith('.json') ? 'JSON' : 'YAML'}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}

const CONFIG_ID = 'virtual:vvitrine/config';
const RUNTIME_ID = 'virtual:vvitrine/runtime';
const RESOLVED_RUNTIME_ID = '\0vvitrine-runtime';
const LAYOUT_ID = 'virtual:vvitrine/layout';
const RESOLVED_LAYOUT_ID = '\0vvitrine-layout';

interface DevModuleGraph {
  getModuleById(id: string): unknown;
  invalidateModule(module: never): void;
}

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
        const layoutPath = findLayout(root, configPath, options.layout);
        const runtime = {
          root,
          base: config.base,
          siteUrl: config.site ?? process.env.SITE_URL ?? null,
          dev: command === 'dev',
        };
        logger.info(`config: ${configFile}${layoutPath ? `, layout: ${relative(root, layoutPath)}` : ''}`);

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vvitrine:virtual-modules',
                resolveId(id: string) {
                  if (id === CONFIG_ID) return configPath;
                  if (id === RUNTIME_ID) return RESOLVED_RUNTIME_ID;
                  if (id === LAYOUT_ID) return RESOLVED_LAYOUT_ID;
                  return undefined;
                },
                async load(id: string) {
                  // { data, origin, theme? } for the kernel, or null without a layout file.
                  if (id === RESOLVED_LAYOUT_ID) return layoutModule(layoutPath, root);
                  if (id !== RESOLVED_RUNTIME_ID) return undefined;
                  return Object.entries(runtime)
                    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`)
                    .join('\n');
                },
                configureServer(server: {
                  watcher: { add(p: string): void; on(e: string, cb: (file: string) => void): void };
                  ws: { send(m: { type: string }): void };
                  environments?: Record<string, { moduleGraph: DevModuleGraph }>;
                }) {
                  server.watcher.add(contentDir);
                  if (layoutPath) server.watcher.add(layoutPath);
                  server.watcher.on('change', (file) => {
                    const changed = resolve(file);
                    if (changed === layoutPath) {
                      // The layout module is virtual: drop it so the next request reads the file again.
                      for (const environment of Object.values(server.environments ?? {})) {
                        const module = environment.moduleGraph.getModuleById(RESOLVED_LAYOUT_ID);
                        if (module) environment.moduleGraph.invalidateModule(module as never);
                      }
                    }
                    if (changed === layoutPath || changed.startsWith(contentDir))
                      server.ws.send({ type: 'full-reload' });
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
