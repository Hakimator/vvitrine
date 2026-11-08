import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ContentOwnershipError,
  createKernel,
  definePlugin,
  defineSection,
  DuplicatePluginError,
  DuplicateSectionError,
  IncompatiblePluginError,
  InvalidConfigError,
  InvalidContentError,
  InvalidPluginOptionsError,
  MissingCapabilityError,
  MissingRendererError,
  RouteConflictError,
  ThemeCountError,
  UnknownSectionError,
  type BuiltSite,
  type Plugin,
  type VVitrineConfig,
} from '../src/index.ts';
import { memorySource, stringTheme } from '../src/testing.ts';

const silent = { info: () => {}, warn: () => {} };

const Jobs = z.array(z.object({ name: z.string(), startDate: z.string() })).default([]);

const work = defineSection({
  name: 'section-work',
  kind: 'section',
  apiVersion: 1,
  id: 'work',
  content: { key: 'work', schema: Jobs },
  optionsSchema: z.object({ limit: z.number().int().positive().default(10) }),
  messages: { en: { 'section.work.title': 'Experience' }, fr: { 'section.work.title': 'Expérience' } },
  present: ({ content }, { limit }, { t }) =>
    content.length ? { title: t('section.work.title'), items: content.slice(0, limit) } : null,
});

const hero = defineSection({
  name: 'section-hero',
  kind: 'section',
  apiVersion: 1,
  id: 'hero',
  present: ({ basics }) => ({ name: basics.name }),
});

const content = {
  en: {
    basics: { name: 'Jane Doe' },
    work: [
      { name: 'ACME', startDate: '2025-06' },
      { name: 'Old', startDate: '2020' },
    ],
  },
  fr: { basics: { name: 'Jeanne Doe' }, work: [{ name: 'ACME', startDate: '2025-06' }] },
};

const theme = stringTheme({ hero: 'Hero', work: 'Work' });

function config(overrides: Partial<VVitrineConfig> = {}): VVitrineConfig {
  return {
    site: { defaultLocale: 'en', locales: ['en', 'fr'] },
    plugins: [memorySource(content), theme, hero, work],
    pages: [{ path: '/', sections: ['hero', { id: 'work', options: { limit: 1 } }] }],
    ...overrides,
  };
}

const build = (c: VVitrineConfig, opts = {}) => createKernel(c, { root: '/', logger: silent, ...opts }).build();

describe('pages and sections', () => {
  it('renders the configured sections in order, with validated options and translated titles', async () => {
    const site = await build(config());
    const en = site.routes.find((r) => r.key === 'en:/')!;
    expect(en.sections.map((s) => s.id)).toEqual(['hero', 'work']);
    expect(en.sections[1]!.view).toEqual({ title: 'Experience', items: [{ name: 'ACME', startDate: '2025-06' }] });
    const fr = site.routes.find((r) => r.key === 'fr:/')!;
    expect((fr.sections[1]!.view as { title: string }).title).toBe('Expérience');
  });

  it('prefixes non-default locales and keeps the default locale at the root', async () => {
    const site = await build(config());
    expect(site.routes.map((r) => r.path)).toEqual(['/', '/fr/']);
  });

  it('defaults to one home page with every section when no pages are configured', async () => {
    const site = await build(config({ pages: undefined }));
    expect(site.routes[0]!.sections.map((s) => s.id)).toEqual(['hero', 'work']);
  });

  it('supports several pages and rejects duplicated paths', async () => {
    const twoPages = config({
      pages: [
        { path: '/', sections: ['hero'] },
        { path: '/cv', title: 'CV', sections: ['work'] },
      ],
    });
    const site = await build(twoPages);
    expect(site.routes.filter((r) => r.locale === 'en').map((r) => [r.path, r.title])).toEqual([
      ['/', 'Jane Doe'],
      ['/cv', 'CV'],
    ]);
    const duplicated = config({
      pages: [
        { path: '/', sections: [] },
        { path: '/', sections: [] },
      ],
    });
    await expect(build(duplicated)).rejects.toThrow(RouteConflictError);
  });

  it('skips a section with nothing to show', async () => {
    const empty = config({ plugins: [memorySource({ en: { basics: { name: 'X' } } }), theme, hero, work] });
    const site = await build({ ...empty, site: { defaultLocale: 'en' } });
    expect(site.routes[0]!.sections.map((s) => s.id)).toEqual(['hero']);
  });

  it('fails with the available ids when a section is unknown', async () => {
    await expect(build(config({ pages: [{ path: '/', sections: ['talks'] }] }))).rejects.toThrow(UnknownSectionError);
    await expect(build(config({ pages: [{ path: '/', sections: ['talks'] }] }))).rejects.toThrow(
      /Available sections: hero, work/,
    );
  });

  it('rejects invalid section options', async () => {
    const bad = config({ pages: [{ path: '/', sections: [{ id: 'work', options: { limit: 0 } }] }] });
    await expect(build(bad)).rejects.toThrow(InvalidPluginOptionsError);
  });
});

describe('navigation', () => {
  it('links every placed section that has a title, in order, with locale and base path', async () => {
    const site = await build(config(), { base: '/demo/' });
    const en = site.routes.find((r) => r.key === 'en:/')!;
    expect(en.context.nav).toEqual({
      home: '/demo/',
      items: [{ id: 'work', label: 'Experience', href: '/demo/#work' }],
      footer: [],
    });
    const fr = site.routes.find((r) => r.key === 'fr:/')!;
    expect(fr.context.nav.items).toEqual([{ id: 'work', label: 'Expérience', href: '/demo/fr/#work' }]);
  });

  it('points to the page that holds the section and is shared by every route of the locale', async () => {
    const site = await build(
      config({
        pages: [
          { path: '/', sections: ['hero'] },
          { path: '/cv', sections: ['work'] },
        ],
      }),
    );
    const routes = site.routes.filter((r) => r.locale === 'en');
    for (const route of routes) {
      expect(route.context.nav).toEqual({
        home: '/',
        items: [{ id: 'work', label: 'Experience', href: '/cv/#work' }],
        footer: [],
      });
    }
  });

  it('leaves out sections without a title, with nothing to show, or with nav: false', async () => {
    const optOut = await build(config({ pages: [{ path: '/', sections: ['hero', { id: 'work', nav: false }] }] }));
    expect(optOut.routes[0]!.context.nav.items).toEqual([]);
    const empty = await build({
      ...config({ plugins: [memorySource({ en: { basics: { name: 'X' } } }), theme, hero, work] }),
      site: { defaultLocale: 'en' },
    });
    expect(empty.routes[0]!.context.nav.items).toEqual([]);
  });

  it('links footer pages from the footer instead of the header', async () => {
    const site = await build(
      config({
        pages: [
          { path: '/', sections: ['hero'] },
          { path: '/legal', title: 'Legal notice', footer: true, sections: ['work'] },
        ],
      }),
    );
    const fr = site.routes.find((r) => r.key === 'fr:/')!.context.nav;
    expect(fr.items).toEqual([]);
    expect(fr.footer).toEqual([{ id: '/legal', label: 'Legal notice', href: '/fr/legal/' }]);
  });

  it('rejects a nav value that is not a boolean', () => {
    const bad = config({ pages: [{ path: '/', sections: [{ id: 'work', nav: 'no' as unknown as boolean }] }] });
    expect(() => createKernel(bad, { root: '/', logger: silent })).toThrow(InvalidConfigError);
  });
});

describe('page heading', () => {
  it('gives the page title as heading only to pages where no section renders the <h1>', async () => {
    const headed = { ...hero, pageHeading: true };
    const site = await build(
      config({
        plugins: [memorySource(content), theme, headed, work],
        pages: [
          { path: '/', sections: ['hero', 'work'] },
          { path: '/cv', title: 'My CV', sections: ['work'] },
        ],
      }),
    );
    const route = (key: string) => site.routes.find((r) => r.key === key)!;
    expect(route('en:/').context.heading).toBeUndefined();
    expect(route('en:/cv').context.heading).toBe('My CV');
  });

  it('gives a contributed page the heading it asks for, and none otherwise', async () => {
    const lists = defineSection({
      ...work,
      routes: () => [
        { path: '/tag/astro', title: 'Astro', component: 'work', view: { title: 'Work' }, heading: 'Work with Astro' },
        { path: '/job', title: 'Job', component: 'work', view: { title: 'Job' } },
      ],
    });
    const site = await build(
      config({ plugins: [memorySource(content), theme, lists], pages: [{ path: '/', sections: ['work'] }] }),
    );
    const route = (key: string) => site.routes.find((r) => r.key === key)!;
    expect(route('en:/tag/astro').context.heading).toBe('Work with Astro');
    expect(route('en:/job').context.heading).toBeUndefined();
  });
});

describe('view kinds', () => {
  const entriesSection = (id: string, extra: object = {}) =>
    defineSection({
      name: `test-${id}`,
      kind: 'section',
      apiVersion: 1,
      id,
      viewKind: 'entries',
      present: () => ({ title: id, items: [] }),
      ...extra,
    });
  const componentOf = (site: BuiltSite, id: string) => site.routes[0]!.sections.find((s) => s.id === id)!.component;

  it('draws a section with the theme component for its kind, unless the theme has one for its id', async () => {
    const kindTheme = {
      ...theme,
      components: { ...theme.components, 'kind:entries': 'EntriesComponent', b: 'BComponent' },
    };
    const site = await build(
      config({
        plugins: [memorySource(content), kindTheme, hero, entriesSection('a'), entriesSection('b')],
        pages: [{ path: '/', sections: ['a', 'b'] }],
      }),
    );
    expect(componentOf(site, 'a')).toBe('EntriesComponent');
    expect(componentOf(site, 'b')).toBe('BComponent');
  });

  it('prefers the theme kind component over the section default, and falls back otherwise', async () => {
    const withDefault = entriesSection('a', { defaultComponents: { a: 'OwnComponent' } });
    const pages = [{ path: '/', sections: ['a'] }];
    const kindTheme = { ...theme, components: { ...theme.components, 'kind:entries': 'EntriesComponent' } };
    const themed = await build(config({ plugins: [memorySource(content), kindTheme, hero, withDefault], pages }));
    expect(componentOf(themed, 'a')).toBe('EntriesComponent');
    const plain = await build(config({ plugins: [memorySource(content), theme, hero, withDefault], pages }));
    expect(componentOf(plain, 'a')).toBe('OwnComponent');
  });

  it('rejects an unknown view kind', () => {
    const odd = entriesSection('a', { viewKind: 'gallery' });
    expect(() =>
      createKernel(config({ plugins: [memorySource(content), theme, hero, odd] }), { root: '/', logger: silent }),
    ).toThrow(/unknown view kind "gallery"\. Known kinds: entries, tags, quotes, figures/);
  });
});

describe('images', () => {
  const fakeImages = (name = 'fake-images') => {
    const prepared: string[] = [];
    const plugin = definePlugin({
      name,
      kind: 'generator',
      apiVersion: 1,
      images: {
        prepare: async ({ base }) => {
          prepared.push(base);
        },
        describe: (path: string) =>
          path === '/me.jpg' ? { srcset: '/demo/_images/me-480.webp 480w', width: 800, height: 600 } : undefined,
      },
      generate: async () => [],
    });
    return { plugin, prepared };
  };

  it('returns the plain file when no image plugin is installed', () => {
    const image = createKernel(config(), { root: '/', logger: silent, base: '/demo/' }).renderContext('en').image;
    expect(image('/me.jpg')).toEqual({ src: '/demo/me.jpg' });
  });

  it('asks the image plugin, prepared once before rendering, for local images only', async () => {
    const { plugin, prepared } = fakeImages();
    const kernel = createKernel(config({ plugins: [memorySource(content), theme, hero, work, plugin] }), {
      root: '/',
      logger: silent,
      base: '/demo/',
    });
    await kernel.build();
    expect(prepared).toEqual(['/demo/']);
    const image = kernel.renderContext('en').image;
    expect(image('/me.jpg')).toEqual({
      src: '/demo/me.jpg',
      srcset: '/demo/_images/me-480.webp 480w',
      width: 800,
      height: 600,
    });
    expect(image('me.jpg')).toEqual(image('/me.jpg'));
    expect(image('/other.png')).toEqual({ src: '/demo/other.png' });
    expect(image('https://cdn.example.com/me.jpg')).toEqual({ src: 'https://cdn.example.com/me.jpg' });
    expect(image('//cdn.example.com/me.jpg')).toEqual({ src: '//cdn.example.com/me.jpg' });
  });

  it('refuses two image plugins', () => {
    const plugins = [memorySource(content), theme, hero, fakeImages('a').plugin, fakeImages('b').plugin];
    expect(() => createKernel(config({ plugins }), { root: '/', logger: silent })).toThrow(
      'Only one image plugin is allowed, found "a" and "b".',
    );
  });
});

describe('assets', () => {
  it('prefixes files from public/ with the base path and leaves full URLs alone', () => {
    const asset = createKernel(config(), { root: '/', logger: silent, base: '/demo/' }).renderContext('en').asset;
    expect(asset('/me.jpg')).toBe('/demo/me.jpg');
    expect(asset('docs/cv.pdf')).toBe('/demo/docs/cv.pdf');
    expect(asset('https://cdn.example.com/me.jpg')).toBe('https://cdn.example.com/me.jpg');
    expect(asset('//cdn.example.com/me.jpg')).toBe('//cdn.example.com/me.jpg');
    expect(asset('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    const atRoot = createKernel(config(), { root: '/', logger: silent }).renderContext('en').asset;
    expect(atRoot('/me.jpg')).toBe('/me.jpg');
  });
});

describe('content ownership (ADR-008)', () => {
  it('validates each key with the schema of its owner and reports every problem', async () => {
    const broken = memorySource({ en: { basics: { name: '' }, work: [{ name: 'ACME' }] } });
    const error = await build(config({ plugins: [broken, theme, hero, work], site: { defaultLocale: 'en' } })).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(InvalidContentError);
    expect((error as InvalidContentError).issues.map((i) => i.path)).toEqual(['basics.name', 'work[0].startDate']);
  });

  it('refuses two owners for the same key and points to "reads"', () => {
    const twin = { ...work, name: 'other-work', id: 'work2' };
    expect(() => createKernel(config({ plugins: [memorySource(content), theme, work, twin] }), { root: '/' })).toThrow(
      ContentOwnershipError,
    );
  });

  it('gives a section read-only access to keys it declared, and nothing else', async () => {
    const timeline = defineSection({
      name: 'section-timeline',
      kind: 'section',
      apiVersion: 1,
      id: 'timeline',
      reads: ['work'],
      present: ({ reads, content: own }) => ({ count: (reads.work as unknown[]).length, own }),
    });
    const site = await build(
      config({
        plugins: [memorySource(content), stringTheme({}, 'F'), work, timeline],
        pages: [{ path: '/', sections: ['timeline'] }],
        site: { defaultLocale: 'en' },
      }),
    );
    expect(site.routes[0]!.sections[0]!.view).toEqual({ count: 2, own: undefined });
  });

  it('warns about content keys no plugin uses', async () => {
    const warn = vi.fn();
    const extra = memorySource({ en: { basics: { name: 'X' }, awards: [] } });
    await createKernel({ plugins: [extra, theme, hero] }, { root: '/', logger: { info: () => {}, warn } }).build();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"awards"'));
  });

  it('lets hooks transform raw content before validation', async () => {
    const migrate: Plugin = {
      name: 'migrate',
      kind: 'service',
      apiVersion: 1,
      hooks: {
        contentLoaded: (raw) => {
          (raw.basics as { name: string }).name = 'Renamed';
        },
      },
    };
    const site = await build(
      config({ plugins: [memorySource(content), theme, hero, migrate], pages: [{ path: '/', sections: ['hero'] }] }),
    );
    expect(site.routes[0]!.sections[0]!.view).toEqual({ name: 'Renamed' });
  });
});

describe('plugin contract', () => {
  it('rejects unsupported API versions, duplicate names and duplicate section ids', () => {
    const k = (plugins: Plugin[]) => createKernel({ plugins: [theme, ...plugins] }, { root: '/' });
    expect(() => k([{ ...hero, apiVersion: 2 }])).toThrow(IncompatiblePluginError);
    expect(() => k([hero, hero])).toThrow(DuplicatePluginError);
    expect(() => k([hero, { ...hero, name: 'hero-2' }])).toThrow(DuplicateSectionError);
  });

  it('requires exactly one theme', () => {
    expect(() => createKernel({ plugins: [hero] }, { root: '/' })).toThrow(ThemeCountError);
    expect(() => createKernel({ plugins: [theme, { ...theme, name: 't2' }] }, { root: '/' })).toThrow(/found 2/);
  });

  it('checks required capabilities', () => {
    const ga: Plugin = { name: 'ga4', kind: 'service', apiVersion: 1, requires: ['consent'] };
    const consent: Plugin = { name: 'consent', kind: 'service', apiVersion: 1, provides: ['consent'] };
    expect(() => createKernel({ plugins: [theme, ga] }, { root: '/' })).toThrow(MissingCapabilityError);
    expect(() => createKernel({ plugins: [theme, ga, consent] }, { root: '/' })).not.toThrow();
  });

  it('validates the config itself', () => {
    expect(() =>
      createKernel({ site: { defaultLocale: 'de', locales: ['fr'] }, plugins: [theme] }, { root: '/' }),
    ).toThrow(InvalidConfigError);
    // a factory that was not called is a common mistake
    expect(() => createKernel({ plugins: [theme, (() => hero) as unknown as Plugin] }, { root: '/' })).toThrow(
      /plugin factory/,
    );
  });

  it('refuses reads of keys nobody owns', () => {
    const reader = defineSection({
      name: 'r',
      kind: 'section',
      apiVersion: 1,
      id: 'r',
      reads: ['nothing'],
      present: () => ({}),
    });
    expect(() => createKernel({ plugins: [theme, reader] }, { root: '/' })).toThrow(/no plugin owns it/);
  });
});

describe('component resolution', () => {
  it('prefers the theme, then the plugin default component, then the theme fallback', async () => {
    const talks = defineSection({
      name: 'talks',
      kind: 'section',
      apiVersion: 1,
      id: 'talks',
      present: () => ({}),
      defaultComponents: { talks: 'TalksDefault' },
    });
    const bare = defineSection({ name: 'bare', kind: 'section', apiVersion: 1, id: 'bare', present: () => ({}) });
    const page = { pages: [{ path: '/', sections: ['hero', 'talks', 'bare'] }], site: { defaultLocale: 'en' } };
    const withFallback = await build(
      config({
        plugins: [memorySource(content), stringTheme({ hero: 'Hero' }, 'Fallback'), hero, talks, bare],
        ...page,
      }),
    );
    expect(withFallback.routes[0]!.sections.map((s) => s.component)).toEqual(['Hero', 'TalksDefault', 'Fallback']);
    await expect(
      build(config({ plugins: [memorySource(content), stringTheme({ hero: 'Hero' }), hero, talks, bare], ...page })),
    ).rejects.toThrow(MissingRendererError);
  });
});

describe('contributed routes, hooks and generators', () => {
  const projects = defineSection({
    name: 'section-projects',
    kind: 'section',
    apiVersion: 1,
    id: 'projects',
    content: { key: 'projects', schema: z.array(z.object({ slug: z.string(), name: z.string() })).default([]) },
    present: ({ content }, _o, { url }) => ({
      items: content.map((p) => ({ name: p.name, href: url(`/projects/${p.slug}`) })),
    }),
    routes: ({ content }) =>
      content.map((p) => ({ path: `/projects/${p.slug}`, title: p.name, component: 'projects:detail', view: p })),
  });
  const data = {
    en: { basics: { name: 'J' }, projects: [{ slug: 'app', name: 'App' }] },
    fr: { basics: { name: 'J' }, projects: [{ slug: 'app', name: 'Appli' }] },
  };
  const t = stringTheme({ projects: 'List', 'projects:detail': 'Detail' });
  const base = { site: { defaultLocale: 'en', locales: ['en', 'fr'] }, pages: [{ path: '/', sections: ['projects'] }] };

  it('adds the pages a section contributes, with locale prefixes, alternates and base path', async () => {
    const site = await build({ ...base, plugins: [memorySource(data), t, projects] }, { base: '/vvitrine/' });
    const detail = site.routes.find((r) => r.key === 'fr:/projects/app')!;
    expect(detail.path).toBe('/fr/projects/app');
    expect(detail.title).toBe('Appli');
    expect(detail.sections[0]!.component).toBe('Detail');
    expect(detail.context.alternates).toEqual([
      { locale: 'en', href: '/vvitrine/projects/app/' },
      { locale: 'fr', href: '/vvitrine/fr/projects/app/' },
    ]);
    const home = site.routes.find((r) => r.key === 'en:/')!;
    expect(home.sections[0]!.view).toEqual({ items: [{ name: 'App', href: '/vvitrine/projects/app/' }] });
  });

  it('does not contribute pages for sections that are not placed on any page', async () => {
    const site = await build({
      ...base,
      pages: [{ path: '/', sections: [] }],
      plugins: [memorySource(data), t, projects],
    });
    expect(site.routes.map((r) => r.key)).toEqual(['en:/', 'fr:/']);
  });

  it('collects head tags and body-end components from every plugin', async () => {
    const seo: Plugin = {
      name: 'seo',
      kind: 'service',
      apiVersion: 1,
      hooks: {
        head: (ctx) => [{ tag: 'meta', attrs: { name: 'description', content: `${ctx.basics.name} ${ctx.locale}` } }],
        bodyEnd: () => [{ component: 'Banner', props: { x: 1 } }],
      },
    };
    const site = await build(
      { ...base, plugins: [memorySource(data), t, projects, seo] },
      { siteUrl: 'https://jane.dev/' },
    );
    const home = site.routes[0]!;
    expect(home.head).toEqual([{ tag: 'meta', attrs: { name: 'description', content: 'J en' } }]);
    expect(home.bodyEnd).toEqual([{ component: 'Banner', props: { x: 1 } }]);
    expect(home.context.siteUrl).toBe('https://jane.dev');
  });

  it('collects what the plugins in use declare about personal data, in the page language', async () => {
    const processing = (service: string) => ({
      service,
      purpose: '',
      when: '',
      data: [],
      cookies: false,
      url: `https://${service}.example`,
    });
    const tracker: Plugin = {
      name: 'tracker',
      kind: 'service',
      apiVersion: 1,
      privacy: (ctx) => [{ ...processing('stats'), purpose: ctx.locale }],
    };
    const form = defineSection({
      name: 'form',
      kind: 'section',
      apiVersion: 1,
      id: 'form',
      present: () => ({}),
      privacy: () => [processing('forms')],
    });
    let seen: unknown;
    const reader = defineSection({
      name: 'reader',
      kind: 'section',
      apiVersion: 1,
      id: 'reader',
      present: (_input, _options, ctx) => {
        seen = ctx.dataProcessing().map((p) => [p.service, p.purpose]);
        return {};
      },
    });
    const theme = stringTheme({}, 'Any');
    const pages = (...sections: string[]) => [{ path: '/', sections }];
    await build({
      ...base,
      plugins: [memorySource(data), theme, tracker, form, reader],
      pages: pages('form', 'reader'),
    });
    expect(seen).toEqual([
      ['stats', 'fr'],
      ['forms', ''],
    ]);
    // A section that is not placed on any page handles no data.
    await build({ ...base, plugins: [memorySource(data), theme, tracker, form, reader], pages: pages('reader') });
    expect(seen).toEqual([['stats', 'fr']]);
  });

  it('gives sections the absolute site URL when it is known', async () => {
    const seen: (string | undefined)[] = [];
    const probe = defineSection({
      name: 'probe',
      kind: 'section',
      apiVersion: 1,
      id: 'probe',
      present: (_input, _options, ctx) => {
        seen.push(ctx.siteUrl && `${ctx.siteUrl}${ctx.url('/sent')}`);
        return {};
      },
    });
    const plugins = [memorySource(data), stringTheme({ probe: 'Probe' }), probe];
    const pages = [{ path: '/', sections: ['probe'] }];
    await build({ ...base, pages, plugins }, { siteUrl: 'https://jane.dev/', base: '/demo/' });
    await build({ ...base, pages, plugins });
    expect(seen).toEqual(['https://jane.dev/demo/sent/', 'https://jane.dev/demo/fr/sent/', undefined, undefined]);
  });

  it('runs generators with every route and rejects two generators writing the same file', async () => {
    const gen = (name: string): Plugin => ({
      name,
      kind: 'generator',
      apiVersion: 1,
      generate: async ({ routes }) => [{ path: '/routes.txt', contents: routes.map((r) => r.path).join('\n') }],
    });
    const site = await build({ ...base, plugins: [memorySource(data), t, projects, gen('g1')] });
    expect(site.files).toEqual([{ path: '/routes.txt', contents: '/\n/projects/app\n/fr/\n/fr/projects/app' }]);
    await expect(build({ ...base, plugins: [memorySource(data), t, projects, gen('g1'), gen('g2')] })).rejects.toThrow(
      /same file/,
    );
  });

  it('resolves the favicon with the base path, and allows disabling it', async () => {
    expect((await build({ ...base, plugins: [memorySource(data), t, projects] }, { base: '/demo/' })).favicon).toBe(
      '/demo/favicon.svg',
    );
    const off = await build({
      ...base,
      site: { ...base.site, favicon: false },
      plugins: [memorySource(data), t, projects],
    });
    expect(off.favicon).toBeNull();
  });

  it('exposes theme tokens as CSS custom properties', async () => {
    const site = await build({ ...base, plugins: [memorySource(data), t, projects] });
    expect(site.tokensCss).toBe(':root{--vv-color-primary:#000000}');
  });
});

describe('messages', () => {
  it('lets the user override any plugin string and warns once about missing keys', async () => {
    const warn = vi.fn();
    const missing = defineSection({
      name: 'm',
      kind: 'section',
      apiVersion: 1,
      id: 'm',
      present: (_i, _o, { t }) => ({ a: t('nope'), b: t('nope') }),
    });
    const site = await createKernel(
      config({
        messages: { en: { 'section.work.title': 'Career' } },
        plugins: [memorySource(content), stringTheme({}, 'F'), work, missing],
        pages: [{ path: '/', sections: ['work', 'm'] }],
      }),
      { root: '/', logger: { info: () => {}, warn } },
    ).build();
    const en = site.routes.find((r) => r.key === 'en:/')!;
    expect((en.sections[0]!.view as { title: string }).title).toBe('Career');
    expect(en.sections[1]!.view).toEqual({ a: 'nope', b: 'nope' });
    expect(warn.mock.calls.filter(([m]) => String(m).includes('"nope"') && String(m).includes('"en"'))).toHaveLength(1);
  });
});
