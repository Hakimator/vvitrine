import { resolveConfig, type PageConfig, type ResolvedConfig, type SectionRef, type VVitrineConfig } from './config.ts';
import { loadContent, type ValidatedContent } from './content/pipeline.ts';
import { toIssues } from './content/zod-issues.ts';
import {
  InvalidPluginOptionsError,
  MissingRendererError,
  RouteConflictError,
  UnknownSectionError,
  VVitrineError,
} from './errors.ts';
import { coreMessages } from './i18n/core-messages.ts';
import { formatPartialDate, formatPeriod } from './i18n/dates.ts';
import { Translator, type Locale } from './i18n/translator.ts';
import type { HeadTag } from './render/head.ts';
import { tokensToCss } from './render/tokens.ts';
import type { ImageProvider, ResponsiveImage } from './images.ts';
import { viewKindKey } from './views.ts';
import type {
  ComponentRef,
  GeneratedFile,
  Logger,
  Navigation,
  NavItem,
  Plugin,
  PageContext,
  RenderContext,
  SectionInput,
  SectionPlugin,
  ThemePlugin,
} from './plugin.ts';
import { PluginRegistry } from './registry.ts';

/** 'https://...', 'data:...', '//cdn...': used as they are, never prefixed or optimised. */
const FULL_URL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

export interface KernelOptions {
  /** Absolute path of the user's project (where content/ lives). */
  readonly root: string;
  /** Deployment base path, e.g. '/vvitrine' for GitHub project pages. Default '/'. */
  readonly base?: string;
  /** Absolute site URL, e.g. 'https://jane.dev'. Needed for canonical URLs and sitemaps. */
  readonly siteUrl?: string;
  readonly logger?: Logger;
}

export interface BuiltSection {
  readonly id: string;
  readonly component: unknown;
  readonly view: unknown;
}

export interface BuiltRoute {
  /** Unique key, e.g. 'en:/projects/my-app'. */
  readonly key: string;
  /** Path with locale prefix and without base, e.g. '/en/projects/my-app' or '/'. */
  readonly path: string;
  /** Internal link: base path + localized path + trailing slash, e.g. '/demo/en/projects/my-app/'. */
  readonly href: string;
  readonly locale: Locale;
  readonly title: string;
  readonly sections: readonly BuiltSection[];
  readonly head: readonly HeadTag[];
  readonly bodyEnd: readonly ComponentRef[];
  readonly context: PageContext;
}

export interface BuiltSite {
  readonly theme: ThemePlugin;
  /** Site icon URL with base path, or null when disabled. */
  readonly favicon: string | null;
  readonly tokensCss: string;
  readonly defaultLocale: Locale;
  readonly locales: readonly Locale[];
  readonly routes: readonly BuiltRoute[];
  readonly files: readonly GeneratedFile[];
}

const consoleLogger: Logger = {
  info: (m) => console.info(`[vvitrine] ${m}`),
  warn: (m) => console.warn(`[vvitrine] ${m}`),
};

interface PendingRoute {
  readonly basePath: string;
  readonly locale: Locale;
  readonly title: string;
  readonly sections: readonly BuiltSection[];
  readonly basics: ValidatedContent['basics'];
  readonly render: RenderContext;
  readonly nav: Navigation;
  /** Page title to render as the <h1>, when no section on the page renders one. */
  readonly heading?: string;
}

/**
 * Microkernel facade (ADR-007): validates the config, registers plugins, loads and validates
 * content per locale, resolves pages and plugin-contributed routes, collects hook output and
 * runs generators. It is framework-free; the Astro integration only renders what it returns.
 */
export class Kernel {
  private readonly config: ResolvedConfig;
  readonly registry: PluginRegistry;
  private readonly translator: Translator;
  private readonly logger: Logger;
  private readonly options: KernelOptions;

  constructor(userConfig: VVitrineConfig, options: KernelOptions) {
    this.options = options;
    this.logger = options.logger ?? consoleLogger;
    this.config = resolveConfig(userConfig);
    this.registry = new PluginRegistry(this.config.plugins);
    this.checkReads();
    const imagePlugins = this.registry.ofKind('generator').filter((g) => g.images);
    if (imagePlugins.length > 1) {
      throw new VVitrineError(
        `Only one image plugin is allowed, found ${imagePlugins.map((p) => `"${p.name}"`).join(' and ')}.`,
      );
    }

    this.translator = new Translator({
      defaultLocale: this.config.defaultLocale,
      onMissing: (key, locale) => this.logger.warn(`Missing message "${key}" for locale "${locale}".`),
    });
    this.translator.add(coreMessages);
    for (const plugin of this.registry.all()) this.translator.add(plugin.messages);
    this.translator.add(this.config.messages);
  }

  get locales(): readonly Locale[] {
    return this.config.locales;
  }

  async build(): Promise<BuiltSite> {
    await this.imageProvider?.prepare({
      root: this.options.root,
      base: `${(this.options.base ?? '/').replace(/\/$/, '')}/`,
      logger: this.logger,
    });
    const pending: PendingRoute[] = [];
    for (const locale of this.config.locales) pending.push(...(await this.buildLocale(locale)));

    const routes = this.finalize(pending);
    const theme = this.registry.theme;
    const files = await this.runGenerators(routes);
    const base = (this.options.base ?? '/').replace(/\/$/, '');
    return {
      theme,
      favicon: this.config.favicon ? `${base}${this.config.favicon}` : null,
      tokensCss: tokensToCss(theme.tokens),
      defaultLocale: this.config.defaultLocale,
      locales: this.config.locales,
      routes,
      files,
    };
  }

  /** Render helpers for one locale. Exposed for tests and for plugin authors' tooling. */
  renderContext(locale: Locale): RenderContext {
    const t = this.translator.forLocale(locale);
    const context: RenderContext = {
      locale,
      defaultLocale: this.config.defaultLocale,
      t,
      formatDate: (value) => formatPartialDate(value, locale),
      formatPeriod: (start, end) => formatPeriod(start, end, locale, t),
      url: (path, targetLocale = locale) => this.url(path, targetLocale),
      asset: (path) => this.asset(path),
      image: (path) => this.image(path),
      ...(this.options.siteUrl ? { siteUrl: this.options.siteUrl.replace(/\/$/, '') } : {}),
      dataProcessing: () => this.pluginsInUse().flatMap((plugin) => plugin.privacy?.(context) ?? []),
    };
    return context;
  }

  /** Every plugin except sections that are not placed on any page. */
  private pluginsInUse(): Plugin[] {
    const placed = new Set(
      (this.config.pages ?? []).flatMap((page) => page.sections.map((ref) => (typeof ref === 'string' ? ref : ref.id))),
    );
    return this.registry
      .all()
      .filter((plugin) => plugin.kind !== 'section' || !this.config.pages || placed.has(plugin.id));
  }

  private async buildLocale(locale: Locale): Promise<PendingRoute[]> {
    const content = await loadContent(this.registry, {
      locale,
      defaultLocale: this.config.defaultLocale,
      root: this.options.root,
      logger: this.logger,
    });
    const render = this.renderContext(locale);
    const pages = this.config.pages ?? [{ path: '/', sections: this.registry.sectionIds() }];
    const usedSections = new Set<string>();
    const routes: PendingRoute[] = [];
    const navItems: NavItem[] = [];
    const footer = pages
      .filter((page) => page.footer)
      .map((page) => ({ id: page.path, label: this.pageTitle(page, content, render), href: render.url(page.path) }));
    const nav: Navigation = { home: render.url(pages[0]?.path ?? '/'), items: navItems, footer };

    for (const page of pages) {
      const sections: BuiltSection[] = [];
      for (const ref of page.sections) {
        const section = this.buildSection(ref, page, content, render, usedSections);
        if (!section) continue;
        sections.push(section);
        const item = page.footer ? null : this.navItem(ref, section, render.url(page.path));
        if (item && !navItems.some((i) => i.id === item.id)) navItems.push(item);
      }
      const title = this.pageTitle(page, content, render);
      const hasHeading = sections.some((s) => this.registry.section(s.id)?.pageHeading === true);
      routes.push({
        basePath: page.path,
        locale,
        title,
        sections,
        basics: content.basics,
        render,
        nav,
        ...(hasHeading ? {} : { heading: title }),
      });
    }

    for (const id of usedSections) {
      const section = this.registry.section(id)!;
      for (const contribution of section.routes?.(this.sectionInput(section, content), render) ?? []) {
        const component = this.component(contribution.component, section);
        routes.push({
          basePath: contribution.path,
          locale,
          title: contribution.title,
          sections: [{ id: contribution.component, component, view: contribution.view }],
          basics: content.basics,
          render,
          nav,
          ...(contribution.heading ? { heading: contribution.heading } : {}),
        });
      }
    }
    return routes;
  }

  /** A placed section gets a navigation link when its view has a title and the page does not opt out. */
  private navItem(ref: SectionRef, section: BuiltSection, pageHref: string): NavItem | null {
    if (typeof ref !== 'string' && ref.nav === false) return null;
    const title = (section.view as { title?: unknown } | null)?.title;
    if (typeof title !== 'string' || title === '') return null;
    return { id: section.id, label: title, href: `${pageHref}#${section.id}` };
  }

  private buildSection(
    ref: SectionRef,
    page: PageConfig,
    content: ValidatedContent,
    render: RenderContext,
    used: Set<string>,
  ): BuiltSection | null {
    const { id, options } = typeof ref === 'string' ? { id: ref, options: undefined } : ref;
    const section = this.registry.section(id);
    if (!section) throw new UnknownSectionError(id, page.path, this.registry.sectionIds());
    used.add(id);

    const parsedOptions = this.parseOptions(section, options, page.path);
    const view = section.present(this.sectionInput(section, content), parsedOptions, render);
    if (view === null) return null;
    return { id, component: this.component(id, section), view };
  }

  private sectionInput(section: SectionPlugin<any, any, any>, content: ValidatedContent): SectionInput<unknown> {
    const reads = Object.fromEntries((section.reads ?? []).map((key) => [key, content.byKey.get(key)]));
    return {
      basics: content.basics,
      content: section.content ? content.byKey.get(section.content.key) : undefined,
      reads,
    };
  }

  private parseOptions(section: SectionPlugin<any, any, any>, options: unknown, page: string): unknown {
    if (!section.optionsSchema) return options ?? {};
    const result = section.optionsSchema.safeParse(options ?? {});
    if (!result.success) {
      throw new InvalidPluginOptionsError(`section "${section.id}" on page "${page}"`, toIssues(result.error));
    }
    return result.data;
  }

  private component(key: string, section: SectionPlugin<any, any, any>): unknown {
    const theme = this.registry.theme;
    // The view kind applies to the section's own key only, not to the pages it contributes.
    const byKind = key === section.id && section.viewKind ? theme.components[viewKindKey(section.viewKind)] : undefined;
    const component = theme.components[key] ?? byKind ?? section.defaultComponents?.[key] ?? theme.fallback;
    if (!component) throw new MissingRendererError(key, theme.name);
    return component;
  }

  private pageTitle(page: PageConfig, content: ValidatedContent, render: RenderContext): string {
    if (!page.title) return content.basics.name;
    const translated = render.t(page.title);
    return translated === page.title ? page.title : translated;
  }

  private finalize(pending: readonly PendingRoute[]): BuiltRoute[] {
    const seen = new Set<string>();
    const localesByPath = new Map<string, Locale[]>();
    for (const route of pending) {
      const key = `${route.locale}:${route.basePath}`;
      if (seen.has(key)) throw new RouteConflictError(this.localizedPath(route.basePath, route.locale));
      seen.add(key);
      localesByPath.set(route.basePath, [...(localesByPath.get(route.basePath) ?? []), route.locale]);
    }

    return pending.map((route) => {
      const alternates = (localesByPath.get(route.basePath) ?? []).map((locale) => ({
        locale,
        href: this.url(route.basePath, locale),
      }));
      const path = this.localizedPath(route.basePath, route.locale);
      const context: PageContext = {
        ...route.render,
        path,
        title: route.title,
        basics: route.basics,
        alternates,
        nav: route.nav,
        ...(route.heading ? { heading: route.heading } : {}),
      };
      const plugins = this.registry.all();
      return {
        key: `${route.locale}:${route.basePath}`,
        path,
        href: this.url(route.basePath, route.locale),
        locale: route.locale,
        title: route.title,
        sections: route.sections,
        head: plugins.flatMap((p) => p.hooks?.head?.(context) ?? []),
        bodyEnd: plugins.flatMap((p) => p.hooks?.bodyEnd?.(context) ?? []),
        context,
      };
    });
  }

  private async runGenerators(routes: readonly BuiltRoute[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const paths = new Set<string>();
    for (const generator of this.registry.ofKind('generator')) {
      const output = await generator.generate({
        locales: this.config.locales,
        base: `${(this.options.base ?? '/').replace(/\/$/, '')}/`,
        ...(this.options.siteUrl ? { siteUrl: this.options.siteUrl.replace(/\/$/, '') } : {}),
        routes: routes.map(({ path, href, locale, title }) => ({ path, href, locale, title })),
      });
      for (const file of output) {
        if (paths.has(file.path)) throw new VVitrineError(`Two generators produce the same file "${file.path}".`);
        paths.add(file.path);
        files.push(file);
      }
    }
    return files;
  }

  private checkReads(): void {
    for (const section of this.registry.ofKind('section')) {
      for (const key of section.reads ?? []) {
        if (!this.registry.owner(key)) {
          throw new VVitrineError(
            `Section "${section.id}" reads content key "${key}", but no plugin owns it.\n` +
              `  hint: add the section plugin that owns "${key}".`,
          );
        }
      }
    }
  }

  /** '/projects/x' + 'en' -> '/en/projects/x' (default locale has no prefix). */
  private localizedPath(path: string, locale: Locale): string {
    const prefix = locale === this.config.defaultLocale ? '' : `/${locale}`;
    if (path === '/') return prefix ? `${prefix}/` : '/';
    return `${prefix}${path}`;
  }

  /** Local images go through the image plugin, if any; full URLs are used as they are. */
  private image(path: string): ResponsiveImage {
    const src = this.asset(path);
    if (FULL_URL.test(path)) return { src };
    const described = this.imageProvider?.describe(path.startsWith('/') ? path : `/${path}`);
    return described ? { src, ...described } : { src };
  }

  private get imageProvider(): ImageProvider | undefined {
    return this.registry.ofKind('generator').find((g) => g.images)?.images;
  }

  /** File from public/ with the base path; full and data: URLs are left as they are. */
  private asset(path: string): string {
    if (FULL_URL.test(path)) return path;
    const base = (this.options.base ?? '/').replace(/\/$/, '');
    return `${base}/${path.replace(/^\//, '')}`;
  }

  /** Internal link with base path and trailing slash (directory-style static output). */
  private url(path: string, locale: Locale): string {
    const base = (this.options.base ?? '/').replace(/\/$/, '');
    const localized = this.localizedPath(path, locale);
    const withSlash = localized.endsWith('/') ? localized : `${localized}/`;
    return `${base}${withSlash}` || '/';
  }
}

export const createKernel = (config: VVitrineConfig, options: KernelOptions): Kernel => new Kernel(config, options);
