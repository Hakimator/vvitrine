import { z } from 'zod';
import { toIssues } from './content/zod-issues.ts';
import { InvalidConfigError } from './errors.ts';
import type { Messages } from './i18n/translator.ts';
import type { Plugin } from './plugin.ts';
import { TokenValuesSchema, type ThemeTokens } from './render/tokens.ts';

/**
 * User configuration. Two places hold it (ADR-016):
 * - vvitrine.config.ts, the code part: plugins (including the theme) and options that need code or secrets;
 * - the layout file (site.yaml or site.json), the data part: languages, pages and their sections, texts and design
 *   token overrides. People, the Studio and the CLI can all edit it, because it is plain data.
 * A setting lives in one place only: the same key in both is an error.
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
  /**
   * Link this page from the footer of every page, with its title as the label (e.g. a privacy page). Its sections
   * then get no header link.
   */
  readonly footer?: boolean;
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

const SiteSchema = z
  .object({
    defaultLocale: Locale.default('en').describe('Language of the site root, e.g. "fr": its pages have no prefix.'),
    locales: z
      .array(Locale)
      .min(1)
      .optional()
      .describe('Every language of the site; the others live under /en/, /de/... Must include defaultLocale.'),
    favicon: z
      .union([z.string().regex(/^\//, { message: 'expected a path starting with /' }), z.literal(false)])
      .default('/favicon.svg')
      .describe('Site icon in public/, or false for none.'),
  })
  .refine((s) => !s.locales || s.locales.includes(s.defaultLocale), {
    message: 'site.locales must include site.defaultLocale',
  })
  .describe('Languages and icon.');

const PagesSchema = z.array(
  z.object({
    path: Path.describe('Address without the language prefix, e.g. "/" or "/resume".'),
    title: z.string().optional().describe('Message key or text; default: your name.'),
    footer: z.boolean().optional().describe('Link the page from the footer instead of the header (e.g. privacy).'),
    sections: z
      .array(
        z.union([
          z.string(),
          z.object({ id: z.string(), options: z.unknown().optional(), nav: z.boolean().optional() }),
        ]),
      )
      .describe('Section ids in order, or { id, options, nav } to set options or leave out the header link.'),
  }),
);

const MessagesSchema = z.record(z.string(), z.record(z.string(), z.string()));

export const ConfigSchema = z.object({
  site: SiteSchema.default({ defaultLocale: 'en', favicon: '/favicon.svg' }),
  plugins: z
    .array(
      z.custom<Plugin>((p) => typeof p === 'object' && p !== null && 'name' in p && 'kind' in p, {
        message: 'expected a plugin object (did you forget to call the plugin factory, e.g. corporate()?)',
      }),
    )
    .describe('Plugin instances: sources, sections, exactly one theme, services, generators. Call the factories.'),
  pages: PagesSchema.optional().describe('Pages and the sections on each. Default: one page with every section.'),
  messages: MessagesSchema.optional().describe(
    "Replace any text, per language: { en: { 'section.work.title': 'Career' } }.",
  ),
});

/** The layout file (site.yaml or site.json): the data part of the configuration. Unknown keys are refused. */
export const LayoutSchema = z.strictObject({
  site: SiteSchema.optional(),
  theme: z
    .strictObject({
      tokens: z
        .strictObject({ light: TokenValuesSchema.optional(), dark: TokenValuesSchema.optional() })
        .optional()
        .describe('Design token overrides, applied over the active theme, for light and dark mode.'),
    })
    .optional()
    .describe('Look of the site, whatever the theme.'),
  pages: PagesSchema.optional().describe('Pages and the sections on each. Default: one page with every section.'),
  messages: MessagesSchema.optional().describe(
    "Replace any text, per language: { en: { 'section.work.title': 'Career' } }.",
  ),
});

/** The layout file as read by the composition root: its parsed data, and its name for messages. */
export interface LayoutFile {
  readonly data: unknown;
  /** File name shown in errors, e.g. 'site.yaml'. */
  readonly origin: string;
}

export interface ResolvedConfig {
  readonly defaultLocale: string;
  readonly favicon: string | false;
  readonly locales: readonly string[];
  readonly plugins: readonly Plugin[];
  readonly pages?: readonly PageConfig[];
  readonly messages?: Messages;
  /** Design token overrides from the layout file, applied over the theme's tokens. */
  readonly tokens?: Partial<ThemeTokens>;
}

/** Keys that the layout file and vvitrine.config.ts can both hold, but not both at once. */
const SHARED_KEYS = ['site', 'pages', 'messages'] as const;

/**
 * Validate the configuration, merged with the layout file when there is one. Each setting comes from one place:
 * a key set in both fails, naming both files, rather than one silently winning.
 */
export function resolveConfig(config: VVitrineConfig, layoutFile?: LayoutFile): ResolvedConfig {
  let layout: z.infer<typeof LayoutSchema> = {};
  if (layoutFile) {
    const parsed = LayoutSchema.safeParse(layoutFile.data ?? {});
    if (!parsed.success) throw new InvalidConfigError(toIssues(parsed.error, [], layoutFile.origin), layoutFile.origin);
    layout = parsed.data;
    const both = SHARED_KEYS.filter((key) => layout[key] !== undefined && config[key] !== undefined);
    if (both.length > 0) {
      throw new InvalidConfigError(
        both.map((key) => ({
          path: key,
          message: `set in both vvitrine.config.ts and ${layoutFile.origin}; keep it in one place (the Studio edits ${layoutFile.origin})`,
        })),
        `vvitrine.config.ts and ${layoutFile.origin}`,
      );
    }
  }
  const merged = {
    ...config,
    ...Object.fromEntries(SHARED_KEYS.filter((key) => layout[key] !== undefined).map((key) => [key, layout[key]])),
  };
  const result = ConfigSchema.safeParse(merged);
  if (!result.success) throw new InvalidConfigError(toIssues(result.error));
  const { site, plugins, pages, messages } = result.data;
  const tokens = layout.theme?.tokens;
  return {
    defaultLocale: site.defaultLocale,
    favicon: site.favicon,
    locales: site.locales ?? [site.defaultLocale],
    plugins,
    ...(pages ? { pages } : {}),
    ...(messages ? { messages } : {}),
    ...(tokens ? { tokens: tokens as Partial<ThemeTokens> } : {}),
  };
}

export const defineConfig = (config: VVitrineConfig): VVitrineConfig => config;
