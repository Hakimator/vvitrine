import { describe, expect, it } from 'vitest';
import {
  createKernel,
  InvalidContentError,
  InvalidPluginOptionsError,
  type BuiltSite,
  type EntriesView,
  type FiguresView,
  type QuotesView,
  type TagsView,
  type PageConfig,
} from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import {
  allSections,
  hero,
  initialsOf,
  timeline,
  work,
  type ProjectDetailView,
  type ProjectsView,
  type EducationView,
  type WorkView,
  type HeroView,
} from '../src/index.ts';

const content = {
  basics: {
    name: 'Jane Doe',
    label: 'Engineer',
    location: { city: 'Lyon', countryCode: 'FR' },
    profiles: [{ network: 'GitHub', url: 'https://github.com/example' }, { network: 'Mastodon' }],
    'x-vvitrine': { availability: 'Open to internships' },
  },
  work: [
    { name: 'Old Co', position: 'Intern', startDate: '2022-06', endDate: '2022-08' },
    { name: 'Now Co', position: 'Dev', startDate: '2025-01' },
  ],
  education: [{ institution: 'School', studyType: 'MSc', area: 'CS', startDate: '2023-09' }],
  skills: [{ name: 'Languages', keywords: ['TypeScript'] }],
  languages: [{ language: 'French', fluency: 'Native' }],
  projects: [
    { name: 'Café Été', startDate: '2024' },
    {
      name: 'Star',
      description: 'Best',
      'x-vvitrine': { featured: true, slug: 'star', repository: 'https://github.com/x/y' },
    },
  ],
};

const theme = stringTheme({}, 'Fallback');
const build = (
  data: Record<string, unknown>,
  pages: readonly PageConfig[] = [
    { path: '/', sections: ['hero', 'projects', 'work', 'education', 'skills', 'languages'] },
  ],
  base = '/',
) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [memorySource({ en: data, fr: data }), theme, ...allSections()],
      pages,
    },
    { root: '/', base, logger: { info: () => {}, warn: () => {} } },
  ).build();

const view = <T>(site: BuiltSite, key: string, id: string) =>
  site.routes.find((r) => r.key === key)!.sections.find((s) => s.id === id)!.view as T;

describe('built-in sections', () => {
  it('hero shows identity, location, availability and only profiles with a URL', async () => {
    const site = await build(content);
    expect(view<HeroView>(site, 'en:/', 'hero')).toEqual({
      name: 'Jane Doe',
      label: 'Engineer',
      location: 'Lyon, FR',
      availability: 'Open to internships',
      initials: 'JD',
      actions: [],
      links: [{ label: 'GitHub', url: 'https://github.com/example' }],
    });
  });

  it('hero provides the page heading', async () => {
    expect(hero().pageHeading).toBe(true);
    const site = await build(content);
    expect(site.routes.find((r) => r.key === 'en:/')!.context.heading).toBeUndefined();
  });

  it('hero shows the photo with the base path, and initials otherwise', async () => {
    const withPhoto = { ...content, basics: { ...content.basics, image: '/me.jpg' } };
    const site = await build(withPhoto, undefined, '/demo/');
    expect(view<HeroView>(site, 'fr:/', 'hero').photo).toEqual({ src: '/demo/me.jpg', alt: 'Photo de Jane Doe' });
    expect(view<HeroView>(await build(content), 'en:/', 'hero').photo).toBeUndefined();
    expect(initialsOf('Jeanne Martin')).toBe('JM');
    expect(initialsOf('  Abdel-Hakim   Atmani ')).toBe('AA');
    expect(initialsOf('Ada')).toBe('A');
    expect(initialsOf('élodie durand', 'fr')).toBe('ÉD');
  });

  it('hero offers the CV download first, then contact (mailto or a custom target)', async () => {
    const withEmail = { ...content, basics: { ...content.basics, email: 'jane@example.dev' } };
    const placed = (options: Record<string, string>) => [{ path: '/', sections: [{ id: 'hero', options }] }];
    const site = await build(withEmail, placed({ cv: '/cv.pdf' }), '/demo/');
    expect(view<HeroView>(site, 'en:/', 'hero').actions).toEqual([
      { id: 'cv', label: 'Download CV (PDF)', href: '/demo/cv.pdf', download: true },
      { id: 'contact', label: 'Contact me', href: 'mailto:jane@example.dev' },
    ]);
    const custom = await build(withEmail, placed({ cv: 'https://cdn.example.com/cv.pdf', contact: '#contact' }));
    expect(view<HeroView>(custom, 'fr:/', 'hero').actions).toEqual([
      { id: 'cv', label: 'Télécharger le CV (PDF)', href: 'https://cdn.example.com/cv.pdf' },
      { id: 'contact', label: 'Me contacter', href: '#contact' },
    ]);
    await expect(build(withEmail, placed({ cv: '' }))).rejects.toThrow(InvalidPluginOptionsError);
  });

  it('work is ordered with ongoing jobs first, localized titles and periods', async () => {
    const site = await build(content);
    const en = view<WorkView>(site, 'en:/', 'work');
    expect(en.title).toBe('Experience');
    expect(en.items.map((i) => [i.subtitle, i.meta[0]])).toEqual([
      ['Now Co', 'Jan 2025 – present'],
      ['Old Co', 'Jun 2022 – Aug 2022'],
    ]);
    const fr = view<WorkView>(site, 'fr:/', 'work');
    expect(fr.title).toBe('Expérience');
    expect(fr.items[0]!.meta[0]).toBe('janv. 2025 – aujourd’hui');
  });

  it('work and education produce the shared entries shape', async () => {
    const detailed = {
      ...content,
      work: [
        {
          name: 'Acme',
          position: 'Developer',
          location: 'Lyon',
          url: 'https://acme.example',
          startDate: '2025-01',
          summary: 'Web apps.',
          highlights: ['Shipped v2'],
        },
      ],
      education: [
        { institution: 'School', studyType: 'MSc', area: 'CS', score: '16/20', startDate: '2023-09', courses: ['AI'] },
      ],
    };
    const site = await build(detailed);
    expect(view<WorkView>(site, 'en:/', 'work').items).toEqual([
      {
        title: 'Developer',
        subtitle: 'Acme',
        url: 'https://acme.example',
        meta: ['Jan 2025 – present', 'Lyon'],
        summary: 'Web apps.',
        notes: ['Shipped v2'],
      },
    ]);
    expect(view<EducationView>(site, 'en:/', 'education').items).toEqual([
      { title: 'MSc, CS', subtitle: 'School', meta: ['Sep 2023 – present', '16/20'], notes: ['AI'] },
    ]);
    const noDegree = { ...content, education: [{ institution: 'School', startDate: '2023-09' }] };
    expect(view<EducationView>(await build(noDegree), 'en:/', 'education').items).toEqual([
      { title: 'School', meta: ['Sep 2023 – present'], notes: [] },
    ]);
  });

  it('volunteer, awards, certificates and publications produce entries, most recent first', async () => {
    const more = {
      ...content,
      volunteer: [
        { organization: 'Food bank', startDate: '2021-01', endDate: '2021-06' },
        {
          organization: 'Code club',
          position: 'Mentor',
          url: 'https://club.example',
          startDate: '2024-09',
          highlights: ['10 pupils'],
        },
      ],
      awards: [
        { title: 'Hackathon winner', awarder: 'City of Lyon', date: '2024-05', summary: 'First of 40 teams.' },
        { title: 'Dean list', date: '2025' },
      ],
      certificates: [{ name: 'AWS Cloud Practitioner', issuer: 'AWS', date: '2025-03', url: 'https://aws.example/c' }],
      publications: [
        { name: 'On plugins', publisher: 'Blog', releaseDate: '2025-10-02', url: 'https://blog.example/p' },
      ],
    };
    const sections = ['volunteer', 'awards', 'certificates', 'publications'];
    const site = await build(more, [{ path: '/', sections }]);
    const items = (id: string) => view<EntriesView>(site, 'en:/', id).items;
    expect(items('volunteer')).toEqual([
      {
        title: 'Mentor',
        subtitle: 'Code club',
        url: 'https://club.example',
        meta: ['Sep 2024 – present'],
        notes: ['10 pupils'],
      },
      { title: 'Food bank', meta: ['Jan 2021 – Jun 2021'], notes: [] },
    ]);
    expect(items('awards')).toEqual([
      { title: 'Dean list', meta: ['2025'], notes: [] },
      {
        title: 'Hackathon winner',
        subtitle: 'City of Lyon',
        meta: ['May 2024'],
        summary: 'First of 40 teams.',
        notes: [],
      },
    ]);
    expect(items('certificates')).toEqual([
      { title: 'AWS Cloud Practitioner', subtitle: 'AWS', url: 'https://aws.example/c', meta: ['Mar 2025'], notes: [] },
    ]);
    expect(items('publications')[0]).toMatchObject({
      title: 'On plugins',
      subtitle: 'Blog',
      meta: ['October 2, 2025'],
    });
    expect(sections.map((id) => view<EntriesView>(site, 'fr:/', id).title)).toEqual([
      'Bénévolat',
      'Distinctions',
      'Certifications',
      'Publications',
    ]);
  });

  it('interests produce tags and references produce quotes', async () => {
    const more = {
      ...content,
      interests: [{ name: 'Climbing', keywords: ['bouldering'] }, { name: 'Chess' }],
      references: [
        { name: 'Alex Martin', reference: 'Reliable and curious.', 'x-vvitrine': { role: 'Team lead at Acme' } },
        { name: 'Sam Lee', reference: 'Great teammate.' },
      ],
    };
    const site = await build(more, [{ path: '/', sections: ['interests', 'references'] }]);
    expect(view<TagsView>(site, 'en:/', 'interests')).toEqual({
      title: 'Interests',
      groups: [
        { name: 'Climbing', keywords: ['bouldering'] },
        { name: 'Chess', keywords: [] },
      ],
    });
    expect(view<QuotesView>(site, 'fr:/', 'references')).toEqual({
      title: 'Recommandations',
      items: [
        { quote: 'Reliable and curious.', author: 'Alex Martin', role: 'Team lead at Acme' },
        { quote: 'Great teammate.', author: 'Sam Lee' },
      ],
    });
    await expect(build({ ...content, references: [{ name: 'No text' }] })).rejects.toThrow(InvalidContentError);
  });

  it('testimonials produce quotes and stats produce figures', async () => {
    const more = {
      ...content,
      testimonials: [{ quote: 'Shipped on time.', author: 'A client', role: 'Founder' }],
      stats: [
        { value: 12, label: 'projects' },
        { value: '3+', label: 'years of code' },
      ],
    };
    const site = await build(more, [{ path: '/', sections: ['testimonials', 'stats'] }]);
    expect(view<QuotesView>(site, 'fr:/', 'testimonials')).toEqual({
      title: 'Témoignages',
      items: [{ quote: 'Shipped on time.', author: 'A client', role: 'Founder' }],
    });
    expect(view<FiguresView>(site, 'en:/', 'stats')).toEqual({
      title: 'Key figures',
      items: [
        { value: '12', label: 'projects' },
        { value: '3+', label: 'years of code' },
      ],
    });
  });

  it('timeline merges the keys it reads with its own milestones, most recent first', async () => {
    const more = {
      ...content,
      volunteer: [{ organization: 'Code club', position: 'Mentor', startDate: '2024-09' }],
      timeline: [{ title: 'Moved to Lyon', date: '2022-09' }],
    };
    const kernel = createKernel(
      {
        site: { defaultLocale: 'en', locales: ['en'] },
        plugins: [
          memorySource({ en: more }),
          theme,
          ...allSections(),
          timeline({ from: ['work', 'education', 'volunteer'] }),
        ],
        pages: [{ path: '/', sections: ['timeline'] }],
      },
      { root: '/', base: '/', logger: { info: () => {}, warn: () => {} } },
    );
    const items = view<EntriesView>(await kernel.build(), 'en:/', 'timeline').items;
    expect(items.map((i) => [i.title, i.meta])).toEqual([
      ['Dev', ['Jan 2025 – present', 'Experience']],
      ['Mentor', ['Sep 2024 – present', 'Volunteering']],
      ['MSc, CS', ['Sep 2023 – present', 'Education']],
      ['Moved to Lyon', ['Sep 2022']],
      ['Intern', ['Jun 2022 – Aug 2022', 'Experience']],
    ]);
  });

  it('timeline keeps links, summaries and ranges, and skips undated entries', async () => {
    const more = {
      ...content,
      work: [{ name: 'Acme', position: 'Dev', url: 'https://acme.example', startDate: '2025-01' }],
      education: [{ institution: 'School', url: 'https://school.example', startDate: '2023-09', endDate: '2024-06' }],
      volunteer: [
        { organization: 'Food bank', url: 'https://food.example', startDate: '2021-01' },
        { organization: 'Undated club' },
      ],
      timeline: [
        { title: 'Exchange year', date: '2022-09', endDate: '2023-06', summary: 'Montreal.', url: 'https://u.example' },
      ],
      testimonials: [{ quote: 'Great.', author: 'B' }],
    };
    const kernel = createKernel(
      {
        site: { defaultLocale: 'en', locales: ['en'] },
        plugins: [
          memorySource({ en: more }),
          theme,
          ...allSections(),
          timeline({ from: ['work', 'education', 'volunteer'] }),
        ],
        pages: [{ path: '/', sections: ['timeline', 'testimonials'] }],
      },
      { root: '/', base: '/', logger: { info: () => {}, warn: () => {} } },
    );
    const site = await kernel.build();
    expect(view<EntriesView>(site, 'en:/', 'timeline').items).toEqual([
      {
        title: 'Dev',
        subtitle: 'Acme',
        url: 'https://acme.example',
        meta: ['Jan 2025 – present', 'Experience'],
        notes: [],
      },
      { title: 'School', url: 'https://school.example', meta: ['Sep 2023 – Jun 2024', 'Education'], notes: [] },
      {
        title: 'Exchange year',
        url: 'https://u.example',
        meta: ['Sep 2022 – Jun 2023'],
        summary: 'Montreal.',
        notes: [],
      },
      { title: 'Food bank', url: 'https://food.example', meta: ['Jan 2021 – present', 'Volunteering'], notes: [] },
    ]);
    expect(view<QuotesView>(site, 'en:/', 'testimonials').items).toEqual([{ quote: 'Great.', author: 'B' }]);
    const empty = await build({ ...content, work: [], education: [] }, [{ path: '/', sections: ['hero'] }]);
    expect(empty.routes[0]!.sections.map((s) => s.id)).toEqual(['hero']);
  });

  it('timeline refuses to read a key that no installed section owns', () => {
    expect(() =>
      createKernel(
        {
          site: { defaultLocale: 'en' },
          plugins: [memorySource({ en: content }), theme, hero(), work(), timeline({ from: ['work', 'volunteer'] })],
        },
        { root: '/', logger: { info: () => {}, warn: () => {} } },
      ),
    ).toThrow(/reads content key "volunteer", but no plugin owns it/);
  });

  it('rejects an award without a title', async () => {
    await expect(build({ ...content, awards: [{ date: '2024' }] })).rejects.toThrow(InvalidContentError);
  });

  it('applies list options (title override and limit)', async () => {
    const site = await build(content, [
      { path: '/', sections: [{ id: 'work', options: { title: 'Career', limit: 1 } }] } as never,
    ]);
    expect(view<WorkView>(site, 'en:/', 'work')).toMatchObject({
      title: 'Career',
      items: [{ subtitle: 'Now Co' }],
    });
  });

  it('projects lists featured first and contributes one detail page per project', async () => {
    const site = await build(content);
    const list = view<ProjectsView>(site, 'en:/', 'projects');
    expect(list.items.map((p) => [p.name, p.slug, p.href])).toEqual([
      ['Star', 'star', '/projects/star/'],
      ['Café Été', 'cafe-ete', '/projects/cafe-ete/'],
    ]);
    expect(list.items.map((p) => p.featured)).toEqual([true, false]);
    expect(list.featuredLabel).toBe('Featured');
    expect(view<ProjectsView>(site, 'fr:/', 'projects').featuredLabel).toBe('À la une');
    const detail = site.routes.find((r) => r.key === 'fr:/projects/star')!;
    expect(detail.path).toBe('/fr/projects/star');
    const d = detail.sections[0]!.view as ProjectDetailView;
    expect(d.repository).toBe('https://github.com/x/y');
    expect(d.labels.code).toBe('Code source');
    expect(d.backHref).toBe('/fr/#projects');
  });

  it('resolves project images from public/ with the base path', async () => {
    const withImages = {
      ...content,
      projects: [
        { name: 'Local', 'x-vvitrine': { image: { src: '/images/local.png', alt: 'Local screenshot' } } },
        { name: 'Remote', 'x-vvitrine': { image: { src: 'https://cdn.example.com/r.png', alt: 'Remote' } } },
      ],
    };
    const site = await build(withImages, undefined, '/demo/');
    const list = view<ProjectsView>(site, 'en:/', 'projects');
    expect(list.items.map((p) => p.image?.src)).toEqual(['/demo/images/local.png', 'https://cdn.example.com/r.png']);
    const detail = site.routes.find((r) => r.key === 'en:/projects/local')!.sections[0]!.view as ProjectDetailView;
    expect(detail.image).toEqual({ src: '/demo/images/local.png', alt: 'Local screenshot' });
  });

  it('renders a Markdown write-up on the project page', async () => {
    const body = [
      '# Context',
      'A **small** app. See [the docs](/docs/guide.pdf) or [MDN](https://developer.mozilla.org).',
      '',
      '![Screenshot of the app](/images/app.png)',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '| Before | After |',
      '| ------ | ----- |',
      '| 3 min  | 20 s  |',
    ].join('\n');
    const withBody = { ...content, projects: [{ name: 'Star', 'x-vvitrine': { body } }] };
    const site = await build(withBody, undefined, '/demo/');
    const detail = site.routes.find((r) => r.key === 'en:/projects/star')!.sections[0]!.view as ProjectDetailView;
    expect(detail.body).toContain('<h2>Context</h2>');
    expect(detail.body).toContain('<strong>small</strong>');
    expect(detail.body).toContain('href="/demo/docs/guide.pdf"');
    expect(detail.body).toContain('href="https://developer.mozilla.org"');
    expect(detail.body).toContain('<img src="/demo/images/app.png" alt="Screenshot of the app">');
    expect(detail.body).toContain('<pre tabindex="0"><code class="language-ts">const x = 1;');
    expect(detail.body).toContain('<table tabindex="0">');
    const plain = await build({ ...content, projects: [{ name: 'Star' }] });
    expect(
      (plain.routes.find((r) => r.key === 'en:/projects/star')!.sections[0]!.view as ProjectDetailView).body,
    ).toBeUndefined();
  });

  it('refuses a Markdown image without alt text', async () => {
    const bad = { ...content, projects: [{ name: 'Star', 'x-vvitrine': { body: '![](/images/app.png)' } }] };
    await expect(build(bad)).rejects.toThrow(
      /Project "Star" \((en|fr)\): the image "\/images\/app.png" has no alt text/,
    );
  });

  it('featuredOnly keeps only featured projects', async () => {
    const site = await build(content, [
      { path: '/', sections: [{ id: 'projects', options: { featuredOnly: true } }] } as never,
    ]);
    expect(view<ProjectsView>(site, 'en:/', 'projects').items.map((p) => p.name)).toEqual(['Star']);
  });

  it('rejects duplicate project slugs and project images without alt text', async () => {
    await expect(build({ ...content, projects: [{ name: 'A' }, { name: 'a' }] })).rejects.toThrow(/slug "a"/);
    const error = await build({
      ...content,
      projects: [{ name: 'A', 'x-vvitrine': { image: { src: 'a.png', alt: '' } } }],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(InvalidContentError);
    expect(String(error)).toContain('projects[0].x-vvitrine.image.alt');
  });

  it('skips every section without content', async () => {
    const site = await build({ basics: { name: 'Only Me' } });
    expect(site.routes[0]!.sections.map((s) => s.id)).toEqual(['hero']);
  });

  it('validates dates in every dated section', async () => {
    const error = await build({ ...content, education: [{ institution: 'S', startDate: '2023-13' }] }).catch((e) => e);
    expect(String(error)).toContain('education[0].startDate');
  });
});
