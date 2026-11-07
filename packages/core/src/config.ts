import { z } from 'zod';
import { toIssues } from './content/zod-issues.ts';
import { InvalidConfigError } from './errors.ts';
import type { Messages } from './i18n/translator.ts';
import type { Plugin } from './plugin.ts';

/**
 * User configuration (vvitrine.config.ts). Everything a user can change without touching code:
 * locales, plugins (including the single theme), pages and their sections, message overrides.
 */

export type SectionRef =
  | string
  | {
      readonly id: string;
      readonly options?: unknown;
      /** Show a link to this section in the site navigation (default true when it has a title). */
      readonly nav?: boolean;
    };

export interface PageConfig {
  /** Path without locale prefix, e.g. '/' or '/cv'. */
  readonly path: string;
  /** Message key or literal title. Defaults to the person's name. */
  readonly title?: string;
  readonly sections: readonly SectionRef[];
}

export interface VVitrineConfig {
  readonly site?: {
    readonly defaultLocale?: string;
    readonly locales?: readonly string[];
    /** Path of the site icon in public/, e.g. '/favicon.svg' (default). Set to false to disable. */
    readonly favicon?: string | false;
  };
  readonly plugins: readonly Plugin[];
  /** Defaults to a single home page with every registered section, in registration order. */
  readonly pages?: readonly PageConfig[];
  /** Override any UI string, e.g. { en: { 'section.work.title': 'Career' } }. */
  readonly messages?: Messages;
}

const Locale = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'expected a locale like "fr" or "en-GB"' });
const Path = z
  .string()
  .regex(/^\/[a-z0-9\-/]*$/, { message: 'expected a path like "/" or "/cv" (lowercase, no trailing slash)' });

const ConfigSchema = z.object({
  site: z
    .object({
      defaultLocale: Locale.default('en'),
      locales: z.array(Locale).min(1).optional(),
      favicon: z
        .union([z.string().regex(/^\//, { message: 'expected a path starting with /' }), z.literal(false)])
        .default('/favicon.svg'),
    })
    .default({ defaultLocale: 'en', favicon: '/favicon.svg' })
    .refine((s) => !s.locales || s.locales.includes(s.defaultLocale), {
      message: 'site.locales must include site.defaultLocale',
    }),
  plugins: z.array(
    z.custom<Plugin>((p) => typeof p === 'object' && p !== null && 'name' in p && 'kind' in p, {
      message: 'expected a plugin object (did you forget to call the plugin factory, e.g. corporate()?)',
    }),
  ),
  pages: z
    .array(
      z.object({
        path: Path,
        title: z.string().optional(),
        sections: z.array(
          z.union([
            z.string(),
            z.object({ id: z.string(), options: z.unknown().optional(), nav: z.boolean().optional() }),
          ]),
        ),
      }),
    )
    .optional(),
  messages: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

export interface ResolvedConfig {
  readonly defaultLocale: string;
  readonly favicon: string | false;
  readonly locales: readonly string[];
  readonly plugins: readonly Plugin[];
  readonly pages?: readonly PageConfig[];
  readonly messages?: Messages;
}

export function resolveConfig(config: VVitrineConfig): ResolvedConfig {
  const result = ConfigSchema.safeParse(config);
  if (!result.success) throw new InvalidConfigError(toIssues(result.error));
  const { site, plugins, pages, messages } = result.data;
  return {
    defaultLocale: site.defaultLocale,
    favicon: site.favicon,
    locales: site.locales ?? [site.defaultLocale],
    plugins,
    ...(pages ? { pages } : {}),
    ...(messages ? { messages } : {}),
  };
}

export const defineConfig = (config: VVitrineConfig): VVitrineConfig => config;
