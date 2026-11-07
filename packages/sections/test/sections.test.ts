import { describe, expect, it } from 'vitest';
import { createKernel, InvalidContentError, type BuiltSite } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { allSections, type ProjectDetailView, type ProjectsView, type WorkView, type HeroView } from '../src/index.ts';

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
  pages = [{ path: '/', sections: ['hero', 'projects', 'work', 'education', 'skills', 'languages'] }],
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
      links: [{ label: 'GitHub', url: 'https://github.com/example' }],
    });
  });

  it('work is ordered with ongoing jobs first, localized titles and periods', async () => {
    const site = await build(content);
    const en = view<WorkView>(site, 'en:/', 'work');
    expect(en.title).toBe('Experience');
    expect(en.items.map((i) => [i.organization, i.period])).toEqual([
      ['Now Co', 'Jan 2025 – present'],
      ['Old Co', 'Jun 2022 – Aug 2022'],
    ]);
    const fr = view<WorkView>(site, 'fr:/', 'work');
    expect(fr.title).toBe('Expérience');
    expect(fr.items[0]!.period).toBe('janv. 2025 – aujourd’hui');
  });

  it('applies list options (title override and limit)', async () => {
    const site = await build(content, [
      { path: '/', sections: [{ id: 'work', options: { title: 'Career', limit: 1 } }] } as never,
    ]);
    expect(view<WorkView>(site, 'en:/', 'work')).toMatchObject({
      title: 'Career',
      items: [{ organization: 'Now Co' }],
    });
  });

  it('projects lists featured first and contributes one detail page per project', async () => {
    const site = await build(content);
    const list = view<ProjectsView>(site, 'en:/', 'projects');
    expect(list.items.map((p) => [p.name, p.slug, p.href])).toEqual([
      ['Star', 'star', '/projects/star/'],
      ['Café Été', 'cafe-ete', '/projects/cafe-ete/'],
    ]);
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
