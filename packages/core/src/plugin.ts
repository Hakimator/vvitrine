import type { ContentChange } from './content/changes.ts';
import type { z } from 'zod';
import type { Basics } from './content/schemas.ts';
import type { Locale, Messages, Translate } from './i18n/translator.ts';
import type { HeadTag } from './render/head.ts';
import type { ThemeTokens } from './render/tokens.ts';
import type { ImageProvider, ResponsiveImage } from './images.ts';
import type { ViewKind } from './views.ts';

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
  /**
   * URL of a file from public/ (image, PDF...) with the deployment base path, e.g. '/me.jpg' ->
   * '/repo/me.jpg'. Full URLs (https://...) and data: URLs are returned unchanged.
   */
  asset(path: string): string;
  /**
   * An image from public/ (or a full URL) ready to draw: `src` with the base path, plus responsive variants and
   * dimensions when an image plugin such as `@vvitrine/images` is installed.
   */
  image(path: string): ResponsiveImage;
  /**
   * Absolute site URL without trailing slash when known (set at deploy time), e.g. 'https://jane.dev'. Add
   * `url(path)` to it for a full address, e.g. a page a third-party service sends visitors back to.
   */
  readonly siteUrl?: string;
  /** What every plugin in use declares about personal data (see `BasePlugin.privacy`), in this locale. */
  dataProcessing(): readonly DataProcessing[];
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
  /**
   * Pages configured with `footer: true`, in page order, labelled with their title (`id` is the page path), then the
   * links plugins add with `hooks.footerLinks`.
   */
  readonly footer: readonly NavItem[];
}

export interface PageContext extends RenderContext {
  readonly path: string;
  readonly title: string;
  readonly basics: Basics;
  readonly alternates: readonly { locale: Locale; href: string }[];
  readonly nav: Navigation;
  /**
   * Text for the page's main heading (<h1>), set when no section on the page renders one (see
   * `SectionPlugin.pageHeading`). Layouts render it at the top of the main content. Undefined otherwise.
   */
  readonly heading?: string;
  /**
   * Set when the theme offers a light/dark switch. Render a button with `data-color-scheme-toggle`, `hidden` and
   * `aria-pressed="false"`, labelled with `label`: the script shows it and keeps `aria-pressed` true in dark mode.
   */
  readonly colorScheme?: { readonly label: string };
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
  /** Links added to the footer of every page, after the footer pages (e.g. "Manage cookies"). */
  footerLinks?(ctx: RenderContext): readonly NavItem[];
}

/**
 * Personal data a plugin sends to a third party or stores, as visitors should read it on the privacy page (texts in
 * the reader's language). Declared by every plugin that handles visitor data: a form provider, analytics...
 */
export interface DataProcessing {
  /** Who receives the data, e.g. 'Web3Forms'. */
  readonly service: string;
  /** Why, e.g. "Sending me the messages of the contact form". */
  readonly purpose: string;
  /** When it happens, e.g. "Only when you send the form". */
  readonly when: string;
  /** What is sent, e.g. ["your name", "your e-mail address"]. */
  readonly data: readonly string[];
  /** How long it is kept, e.g. "Up to 3 years". */
  readonly retention?: string;
  /** Where the service is based or stores data, e.g. "Company based in India". */
  readonly location?: string;
  /** Whether it sets cookies or similar trackers in the visitor's browser. */
  readonly cookies: boolean;
  /** The service's own privacy or data processing page. */
  readonly url: string;
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
  /**
   * Personal data this plugin handles, for the privacy page. Asked only for plugins in use (a section counts when it
   * is placed on a page).
   */
  privacy?(ctx: RenderContext): readonly DataProcessing[];
}

// ---------- Source ----------

/**
 * The project's files, as sources see them (a port: the composition root gives the implementation). At build time and
 * in `astro dev` they are the files on disk; tests use `memoryFiles()`; the Studio can give files from elsewhere (a
 * Git repository). Sources that read through it work everywhere, which `node:fs` would not.
 */
export interface ProjectFiles {
  /** Text of a file (UTF-8), or undefined when there is none. `path` is relative to the project root, with `/`. */
  read(path: string): Promise<string | undefined>;
  /** Names of the files and folders in a folder, sorted, or undefined when there is no such folder. */
  list(dir: string): Promise<readonly string[] | undefined>;
}

/** Writing to the project's files, for sources that can save (kept apart: loading never needs it). */
export interface ProjectFileWriter {
  /** Create or replace a file (UTF-8). Folders on the way are created. */
  write(path: string, text: string): Promise<void>;
  /** Delete a file. */
  remove(path: string): Promise<void>;
}

export interface SourceContext {
  readonly locale: Locale;
  readonly defaultLocale: Locale;
  /** Absolute path of the user's project. */
  readonly root: string;
  readonly logger: Logger;
  /** Read the project's files through this, not `node:fs` (see `ProjectFiles`). */
  readonly files: ProjectFiles;
}

export interface RawContent {
  /** Top-level content keys, e.g. { basics, work, projects }. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Where each key came from, for error messages, e.g. { work: 'content/resume.fr.yaml' }. */
  readonly origin?: Readonly<Record<string, string>>;
}

/** What a source receives to save: the same context as `load`, with files it can write. */
export interface SaveContext extends SourceContext {
  readonly files: ProjectFiles & ProjectFileWriter;
}

export interface SourcePlugin extends BasePlugin {
  readonly kind: 'source';
  load(ctx: SourceContext): Promise<RawContent>;
  /**
   * Optional: write content changes back, in the source's own format (keeping comments and layout where it can).
   * The kernel calls it only with changes to keys this source provides (or `accepts`), after checking that the
   * changed content is valid. A source without `save` is read-only: the Studio shows its content read-only.
   */
  save?(changes: readonly ContentChange[], ctx: SaveContext): Promise<void>;
  /** Optional, for writable sources: whether a key no source provides yet may be created here. Default: no. */
  accepts?(key: string): boolean;
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
  /**
   * Main heading (<h1>) for the layout to render, when the component does not render one itself (e.g. a list of
   * projects for one technology). Leave it out when the component renders the <h1>, like a project page.
   */
  readonly heading?: string;
}

export interface SectionPlugin<TContent = unknown, TOptions = unknown, TView = unknown> extends BasePlugin {
  readonly kind: 'section';
  /** Id used in `pages[].sections`. */
  readonly id: string;
  /** Content key this plugin owns and validates (ADR-008). */
  readonly content?: { readonly key: string; readonly schema: z.ZodType<TContent> };
  /**
   * True when the section renders the page's main heading (<h1>), like the hero. Pages without such a section get
   * their title as `PageContext.heading`, so every page has exactly one <h1>.
   */
  readonly pageHeading?: boolean;
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
  /**
   * Shared view shape returned by `present` (see views.ts). The theme then draws the section with its component for
   * that kind when it has none for the section id, so the section needs no component of its own.
   */
  readonly viewKind?: ViewKind;
  /** Components used when the active theme has none for a key (e.g. { talks: TalksComponent }). */
  readonly defaultComponents?: Readonly<Record<string, unknown>>;
}

// ---------- Theme ----------

export interface ThemePlugin extends BasePlugin {
  readonly kind: 'theme';
  /**
   * Layout contract: props { lang, title, path, t, url, alternates, locales, siteName, nav, heading?, colorScheme? },
   * slots: head, default (inside <main id="main">), body-end.
   */
  readonly layout: unknown;
  /**
   * One component per key: section id ('work'), contributed page ('projects:detail') or view kind
   * ('kind:entries'). Lookup order for a section: its id, then its view kind, then the section's own default
   * component, then `fallback`.
   */
  readonly components: Readonly<Record<string, unknown>>;
  /** Renders any section without a dedicated component. */
  readonly fallback?: unknown;
  readonly tokens: ThemeTokens;
  /**
   * Offer a light/dark switch: the kernel then adds a small inline script to every page and gives the layout
   * `colorScheme` (see `PageContext`). Needs dark tokens. Off by default, so pages keep zero JavaScript.
   */
  readonly colorSchemeToggle?: boolean;
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
  readonly routes: readonly GeneratorRoute[];
}

export interface GeneratorRoute {
  /** Localized path without base, e.g. '/en/resume'. */
  readonly path: string;
  /** Internal link with base path and trailing slash. */
  readonly href: string;
  /** The page path as configured, the same in every locale, e.g. '/resume'. */
  readonly page: string;
  readonly locale: Locale;
  readonly title: string;
  /** What the page shows: each section's view, with its view kind when it has one (see views.ts). */
  readonly sections: readonly { readonly id: string; readonly viewKind?: string; readonly view: unknown }[];
}

export interface GeneratorPlugin extends BasePlugin {
  readonly kind: 'generator';
  /** Set by image plugins: answers `ctx.image()` for local images (at most one per site). */
  readonly images?: ImageProvider;
  generate(ctx: GeneratorContext): Promise<readonly GeneratedFile[]>;
}

export type Plugin = SourcePlugin | SectionPlugin<any, any, any> | ThemePlugin | ServicePlugin | GeneratorPlugin;

/** Identity helpers: autocompletion for authors without coupling them to kernel internals. */
export const definePlugin = <P extends Plugin>(plugin: P): P => plugin;
export const defineSection = <TContent, TOptions, TView>(
  plugin: SectionPlugin<TContent, TOptions, TView>,
): SectionPlugin<TContent, TOptions, TView> => plugin;
