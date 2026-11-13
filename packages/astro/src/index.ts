import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AstroIntegration } from 'astro';
import { parse } from 'yaml';

export interface VVitrineIntegrationOptions {
  /** Path of the VVitrine config, relative to the project root. Overridden by the VVITRINE_CONFIG env variable. */
  readonly config?: string;
  /**
   * An extra folder to watch in dev mode, for content kept outside the project. Files inside the project are always
   * watched: the page reloads when any file that is not code changes.
   */
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
  getModulesByFile(file: string): { size: number } | undefined;
  invalidateModule(module: never): void;
}

export { diskFiles } from './files.ts';
import { DEV_PREFIX, refusal, send, toRequest } from './dev-server.ts';

/**
 * The Studio's app, when the site has the Studio (@vvitrine/studio): the development server scans it for the
 * browser libraries it uses (Preact) when it starts. Found later, while the Studio loads, they would be prepared
 * again under new names, and the page would get two copies of them (and stay blank).
 */
function studioApp(root: string): string | undefined {
  try {
    return createRequire(resolve(root, 'package.json')).resolve('@vvitrine/studio/app').replaceAll('\\', '/');
  } catch {
    return undefined;
  }
}

/** Loaded through Vite by the development server: it answers the plugins' development endpoints. */
const DEV_ENTRY = fileURLToPath(new URL('./dev.ts', import.meta.url));

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
        const extraDir = options.contentDir ? resolve(root, options.contentDir) : undefined;
        const outDir = fileURLToPath(config.outDir);
        const layoutPath = findLayout(root, configPath, options.layout);
        const studio = command === 'dev' ? studioApp(root) : undefined;
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
                name: 'vvitrine:studio-dependencies',
                configEnvironment(name: string) {
                  // Added to the entries Astro gives the browser's environment (Vite merges the lists).
                  return studio && name === 'client' ? { optimizeDeps: { entries: [studio] } } : undefined;
                },
              },
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
                  middlewares: {
                    use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): void;
                  };
                  ssrLoadModule(path: string): Promise<Record<string, unknown>>;
                }) {
                  // The plugins' development endpoints (US-153), only here: a build has no /__vvitrine/ route.
                  server.middlewares.use((req, res, next) => {
                    if (!req.url?.startsWith(DEV_PREFIX)) return next();
                    const refused = refusal(req.headers.host, req.headers.origin);
                    if (refused) {
                      res.statusCode = 403;
                      res.end(refused);
                      return;
                    }
                    void (async () => {
                      try {
                        const dev = (await server.ssrLoadModule(DEV_ENTRY)) as {
                          handleDevRequest(request: Request): Promise<Response | undefined>;
                        };
                        const response = await dev.handleDevRequest(await toRequest(req));
                        if (response) await send(res, response);
                        else next();
                      } catch (error) {
                        res.statusCode = 500;
                        res.end((error as Error).message);
                      }
                    })();
                  });
                  if (extraDir) server.watcher.add(extraDir);
                  if (layoutPath) server.watcher.add(layoutPath);
                  const environments = Object.values(server.environments ?? {});
                  // Code is reloaded by Vite itself; any other file may be content a source reads (wherever its
                  // folder is), so its change reloads the page. Built files are left out.
                  const isCode = (file: string) =>
                    environments.some((environment) => (environment.moduleGraph.getModulesByFile(file)?.size ?? 0) > 0);
                  const reload = (file: string) => {
                    const changed = resolve(file);
                    if (changed === layoutPath) {
                      // The layout module is virtual: drop it so the next request reads the file again.
                      for (const environment of environments) {
                        const module = environment.moduleGraph.getModuleById(RESOLVED_LAYOUT_ID);
                        if (module) environment.moduleGraph.invalidateModule(module as never);
                      }
                    } else if (changed.startsWith(outDir) || /[\\/]\.astro[\\/]/.test(changed) || isCode(changed)) {
                      return;
                    }
                    server.ws.send({ type: 'full-reload' });
                  };
                  // New and deleted files count too (a new project page, a removed article).
                  for (const event of ['change', 'add', 'unlink']) server.watcher.on(event, reload);
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
