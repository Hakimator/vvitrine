import type { z } from 'zod';
import type { Basics } from './content/schemas.ts';
import type { Locale, Messages, Translate } from './i18n/translator.ts';
import type { HeadTag } from './render/head.ts';
import type { ThemeTokens } from './render/tokens.ts';

/**
 * Public plugin contracts (ADR-007). The kernel depends only on these interfaces, never on a
 * concrete plugin (Dependency Inversion). UI components are typed as `unknown` on purpose: the
 * core must not depend on Astro or any UI framework; the theme layer decides what a component is.
 */

export const SUPPORTED_API_VERSIONS = [1] as const;
export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export type PluginKind = 'source' | 'section' | 'theme' | 'service' | 'generator';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

/** Values available to every hook and presenter. */
export interface RenderContext {
  readonly locale: Locale;
  readonly defaultLocale: Locale;
  readonly t: Translate;
  formatDate(value: string): string;
  formatPeriod(start?: string, end?: string): string;
  /** Build an internal URL that respects the locale prefix and the deployment base path. */
  url(path: string, locale?: Locale): string;
}

/** One link of the site navigation, e.g. { id: 'work', label: 'Experience', href: '/#work' }. */
export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

/** Site navigation for one locale, computed by the kernel from the configured pages. */
export interface Navigation {
  /** Link to the first configured page in this locale. */
  readonly home: string;
  /** One item per placed section whose view has a `title`, in page and section order. */
  readonly items: readonly NavItem[];
}

export interface PageContext extends RenderContext {
  readonly path: string;
  readonly title: string;
  readonly basics: Basics;
  /** Absolute site URL when known (set at deploy time), e.g. https://jane.dev */
  readonly siteUrl?: string;
  readonly alternates: readonly { locale: Locale; href: string }[];
  readonly nav: Navigation;
}

/** A component to render plus its props; used for body-end injections (banners, widgets). */
export interface ComponentRef {
  readonly component: unknown;
  readonly props?: Readonly<Record<string, unknown>>;
}

/** Generic escape hatches: a plugin can do things no plugin kind anticipated. */
export interface PluginHooks {
  /** Transform raw content before validation (e.g. enrich, migrate). */
  contentLoaded?(raw: Record<string, unknown>, ctx: { locale: Locale; logger: Logger }): void | Promise<void>;
  /** Tags added to <head> of every page. */
  head?(ctx: PageContext): readonly HeadTag[];
  /** Components rendered at the end of <body> of every page. */
  bodyEnd?(ctx: PageContext): readonly ComponentRef[];
}

export interface BasePlugin {
  readonly name: string;
  readonly kind: PluginKind;
  readonly apiVersion: number;
  /** Capabilities this plugin offers to others, e.g. 'consent'. */
  readonly provides?: readonly string[];
  /** Capabilities that must be provided by another plugin, e.g. 'consent' for GA4. */
  readonly requires?: readonly string[];
  /** UI strings per locale; keys should be namespaced, e.g. 'section.work.title'. */
  readonly messages?: Messages;
  readonly hooks?: PluginHooks;
}

// ---------- Source ----------

export interface SourceContext {
  readonly locale: Locale;
  readonly defaultLocale: Locale;
  /** Absolute path of the user's project. */
  readonly root: string;
  readonly logger: Logger;
}

export interface RawContent {
  /** Top-level content keys, e.g. { basics, work, projects }. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Where each key came from, for error messages, e.g. { work: 'content/resume.fr.yaml' }. */
  readonly origin?: Readonly<Record<string, string>>;
}

export interface SourcePlugin extends BasePlugin {
  readonly kind: 'source';
  load(ctx: SourceContext): Promise<RawContent>;
}

// ---------- Section ----------

/** What a section receives: identity, its own validated content, and keys it declared in `reads`. */
export interface SectionInput<TContent> {
  readonly basics: Basics;
  readonly content: TContent;
  readonly reads: Readonly<Record<string, unknown>>;
}

export interface RouteContribution<TView = unknown> {
  /** Path without locale prefix, e.g. '/projects/my-app'. */
  readonly path: string;
  readonly title: string;
  /** Theme component key used to render it, e.g. 'projects:detail'. */
  readonly component: string;
  readonly view: TView;
}

export interface SectionPlugin<TContent = unknown, TOptions = unknown, TView = unknown> extends BasePlugin {
  readonly kind: 'section';
  /** Id used in `pages[].sections`. */
  readonly id: string;
  /** Content key this plugin owns and validates (ADR-008). */
  readonly content?: { readonly key: string; readonly schema: z.ZodType<TContent> };
  /** Content keys owned by other plugins that this section needs (read-only). */
  readonly reads?: readonly string[];
  readonly optionsSchema?: z.ZodType<TOptions>;
  /**
   * Pure function: content -> view model consumed by a theme component. `null` = nothing to show.
   * A view with a string `title` gets a link in the site navigation (unless the page sets `nav: false`).
   */
  present(input: SectionInput<TContent>, options: TOptions, ctx: RenderContext): TView | null;
  /** Extra pages contributed by the section (e.g. one page per project). */
  routes?(input: SectionInput<TContent>, ctx: RenderContext): readonly RouteContribution[];
  /** Components used when the active theme has none for a key (e.g. { talks: TalksComponent }). */
  readonly defaultComponents?: Readonly<Record<string, unknown>>;
}

// ---------- Theme ----------

export interface ThemePlugin extends BasePlugin {
  readonly kind: 'theme';
  /**
   * Layout contract: props { lang, title, path, t, url, alternates, locales, siteName, nav },
   * slots: head, default (inside <main id="main">), body-end.
   */
  readonly layout: unknown;
  /** One component per key: section id ('work') or contributed page ('projects:detail'). */
  readonly components: Readonly<Record<string, unknown>>;
  /** Renders any section without a dedicated component. */
  readonly fallback?: unknown;
  readonly tokens: ThemeTokens;
}

// ---------- Service & generator ----------

export interface ServicePlugin extends BasePlugin {
  readonly kind: 'service';
}

export interface GeneratedFile {
  readonly path: string;
  readonly contents: string | Uint8Array;
}

export interface GeneratorContext {
  readonly locales: readonly Locale[];
  /** Deployment base path, always ending with '/', e.g. '/' or '/repo/'. */
  readonly base: string;
  readonly siteUrl?: string;
  /** `path` is without base; `href` is the internal link with base path and trailing slash. */
  readonly routes: readonly { path: string; href: string; locale: Locale; title: string }[];
}

export interface GeneratorPlugin extends BasePlugin {
  readonly kind: 'generator';
  generate(ctx: GeneratorContext): Promise<readonly GeneratedFile[]>;
}

export type Plugin = SourcePlugin | SectionPlugin<any, any, any> | ThemePlugin | ServicePlugin | GeneratorPlugin;

/** Identity helpers: autocompletion for authors without coupling them to kernel internals. */
export const definePlugin = <P extends Plugin>(plugin: P): P => plugin;
export const defineSection = <TContent, TOptions, TView>(
  plugin: SectionPlugin<TContent, TOptions, TView>,
): SectionPlugin<TContent, TOptions, TView> => plugin;
