import { defineSection, PartialDate, Url, type RenderContext, type ResponsiveImage } from '@vvitrine/core';
import { z } from 'zod';
import { renderMarkdown } from './markdown.ts';
import { byMostRecent, ListOptions, slugify, take } from './shared.ts';

export const ProjectsContent = z
  .array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      highlights: z.array(z.string()).default([]),
      keywords: z.array(z.string()).default([]),
      roles: z.array(z.string()).default([]),
      startDate: PartialDate.optional(),
      endDate: PartialDate.optional(),
      url: Url.optional(),
      'x-vvitrine': z
        .object({
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/, { message: 'expected lowercase letters, digits and dashes' })
            .optional()
            .describe('Address of the project page, /projects/<slug>; default: made from the name.'),
          repository: Url.optional().describe('Source code, linked from the project page.'),
          featured: z.boolean().default(false).describe('Shown first, with a "Featured" label.'),
          image: z
            .object({
              src: z.string().describe('Picture in public/, e.g. /projects/app.png.'),
              alt: z
                .string()
                .min(1, { message: 'alt text is required (accessibility)' })
                .describe('What the picture shows, for people who cannot see it.'),
            })
            .optional(),
          /** Long write-up in Markdown (case study), shown on the project page. */
          body: z
            .string()
            .optional()
            .describe('Write-up in Markdown, shown on the project page (the text of a Markdown file).'),
        })
        .default({ featured: false }),
    }),
  )
  .default([]);

type Project = z.infer<typeof ProjectsContent>[number];

export interface ProjectSummary {
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly keywords: readonly string[];
  /** Address-safe form of each keyword, in the same order, e.g. 'c-plus-plus' for 'C++' (for `data-tags`). */
  readonly keywordSlugs: readonly string[];
  readonly period: string;
  readonly href: string;
  readonly featured: boolean;
  /** The project image, with responsive variants and size when an image plugin is installed. */
  readonly image?: ResponsiveImage & { readonly alt: string };
}

/** One link of the technology filter. */
export interface TagLink {
  readonly name: string;
  /** Empty for "All". */
  readonly slug: string;
  readonly href: string;
  /** Number of projects with this tag (all projects for "All"). */
  readonly count: number;
  readonly current: boolean;
}

/** Links that filter the projects by technology: "All", then one per keyword, most used first. */
export interface TagFilter {
  /** Accessible name of the filter, e.g. "Filter by technology". */
  readonly label: string;
  readonly links: readonly TagLink[];
  /**
   * True when every project is on the page: the theme can then add `tagFilterScript` to filter in place. Otherwise
   * the links simply open the tag pages.
   */
  readonly instant: boolean;
  /** Announcement after an instant filter; `{count}` is the number of projects shown. */
  readonly status: { readonly one: string; readonly other: string };
}

export interface ProjectsView {
  readonly title: string;
  readonly moreLabel: string;
  /** Label for featured projects, e.g. "Featured". */
  readonly featuredLabel: string;
  readonly items: readonly ProjectSummary[];
  /** Present when the placement sets `filter: true`. */
  readonly filter?: TagFilter;
}

export interface ProjectDetailView extends ProjectSummary {
  readonly highlights: readonly string[];
  readonly roles: readonly string[];
  readonly url?: string;
  readonly repository?: string;
  /** The Markdown write-up as HTML (headings start at <h2>; local links have the base path). */
  readonly body?: string;
  readonly labels: {
    readonly back: string;
    readonly demo: string;
    readonly code: string;
    readonly role: string;
    readonly stack: string;
  };
  readonly backHref: string;
}

const slugOf = (p: Project) => p['x-vvitrine'].slug ?? slugify(p.name);

/** 'C++' -> 'c-plus-plus', 'C#' -> 'c-sharp', 'Node.js' -> 'node-js'; a name without latin letters or digits gets a
 * stable code instead, e.g. 'tag-65e5-672c'. */
export const tagSlug = (keyword: string): string =>
  slugify(keyword.replaceAll('+', ' plus ').replaceAll('#', ' sharp ')) ||
  `tag-${[...keyword].map((c) => c.codePointAt(0)!.toString(16)).join('-')}`;

/** Every keyword once (spelled as first met), most used first, then alphabetically. */
const tagsOf = (content: readonly Project[], locale: string) => {
  const tags = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of content) {
    for (const slug of new Set(p.keywords.map(tagSlug))) {
      const name = p.keywords.find((k) => tagSlug(k) === slug)!;
      const tag = tags.get(slug) ?? { name, slug, count: 0 };
      tags.set(slug, { ...tag, count: tag.count + 1 });
    }
  }
  return [...tags.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
};

export interface ProjectsSettings {
  /**
   * Address of the page that lists every project, where "All projects" links lead. Default '/' (the home page).
   */
  readonly path?: string;
  /** Contribute one page per technology, `/projects/tag/<tag>`, for the filter (`filter: true`). Default false. */
  readonly tags?: boolean;
}

/** Featured first, then most recent. */
const order = (a: Project, b: Project) =>
  Number(b['x-vvitrine'].featured) - Number(a['x-vvitrine'].featured) || byMostRecent(a, b);

export const projects = (settings: ProjectsSettings = {}) => {
  const listPath = settings.path ?? '/';
  const tagPath = (slug: string) => `/projects/tag/${slug}`;
  const listHref = (ctx: Pick<RenderContext, 'url'>) => `${ctx.url(listPath)}#projects`;

  const filterOf = (content: readonly Project[], current: string, instant: boolean, ctx: RenderContext): TagFilter => ({
    label: ctx.t('section.projects.filter'),
    links: [
      {
        name: ctx.t('section.projects.all'),
        slug: '',
        href: listHref(ctx),
        count: content.length,
        current: current === '',
      },
      ...tagsOf(content, ctx.locale).map((tag) => ({
        ...tag,
        href: ctx.url(tagPath(tag.slug)),
        current: tag.slug === current,
      })),
    ],
    instant,
    status: { one: ctx.t('section.projects.shown.one'), other: ctx.t('section.projects.shown.other') },
  });

  return defineSection({
    name: '@vvitrine/section-projects',
    kind: 'section',
    apiVersion: 1,
    id: 'projects',
    content: { key: 'projects', schema: ProjectsContent },
    optionsSchema: ListOptions.extend({
      featuredOnly: z.boolean().default(false).describe('Show featured projects only.'),
      /** Show links that filter the projects by technology (needs `projects({ tags: true })`). */
      filter: z
        .boolean()
        .default(false)
        .describe('Show links that filter by technology; needs projects({ tags: true }).'),
    }),
    messages: {
      fr: {
        'section.projects.title': 'Projets',
        'section.projects.more': 'Voir le projet',
        'section.projects.featured': 'À la une',
        'section.projects.demo': 'Démo',
        'section.projects.code': 'Code source',
        'section.projects.role': 'Mon rôle',
        'section.projects.stack': 'Technologies',
        'section.projects.back': 'Tous les projets',
        'section.projects.filter': 'Filtrer par technologie',
        'section.projects.all': 'Tous',
        'section.projects.tagged': 'Projets avec {tag}',
        'section.projects.shown.one': '{count} projet affiché',
        'section.projects.shown.other': '{count} projets affichés',
      },
      en: {
        'section.projects.title': 'Projects',
        'section.projects.more': 'View project',
        'section.projects.featured': 'Featured',
        'section.projects.demo': 'Demo',
        'section.projects.code': 'Source code',
        'section.projects.role': 'My role',
        'section.projects.stack': 'Technologies',
        'section.projects.back': 'All projects',
        'section.projects.filter': 'Filter by technology',
        'section.projects.all': 'All',
        'section.projects.tagged': 'Projects with {tag}',
        'section.projects.shown.one': '{count} project shown',
        'section.projects.shown.other': '{count} projects shown',
      },
    },
    present: ({ content }, options, ctx): ProjectsView | null => {
      const selected = [...content].sort(order).filter((p) => !options.featuredOnly || p['x-vvitrine'].featured);
      if (selected.length === 0) return null;
      if (options.filter && !settings.tags) {
        throw new Error('The projects filter needs the tag pages: install the section as projects({ tags: true }).');
      }
      const shown = take(selected, options.limit);
      return {
        title: options.title ?? ctx.t('section.projects.title'),
        moreLabel: ctx.t('section.projects.more'),
        featuredLabel: ctx.t('section.projects.featured'),
        items: shown.map((p) => summary(p, ctx)),
        ...(options.filter ? { filter: filterOf(content, '', shown.length === content.length, ctx) } : {}),
      };
    },
    routes: ({ content }, ctx) => {
      const seen = new Set<string>();
      const details = content.map((p) => {
        const slug = slugOf(p);
        if (seen.has(slug)) throw new Error(`Two projects have the slug "${slug}". Set a unique x-vvitrine.slug.`);
        seen.add(slug);
        const view: ProjectDetailView = {
          ...summary(p, ctx),
          highlights: p.highlights,
          roles: p.roles,
          ...(p.url ? { url: p.url } : {}),
          ...(p['x-vvitrine'].repository ? { repository: p['x-vvitrine'].repository } : {}),
          ...(p['x-vvitrine'].body
            ? { body: renderMarkdown(p['x-vvitrine'].body, ctx, `Project "${p.name}" (${ctx.locale})`) }
            : {}),
          labels: {
            back: ctx.t('section.projects.back'),
            demo: ctx.t('section.projects.demo'),
            code: ctx.t('section.projects.code'),
            role: ctx.t('section.projects.role'),
            stack: ctx.t('section.projects.stack'),
          },
          backHref: listHref(ctx),
        };
        return { path: `/projects/${slug}`, title: p.name, component: 'projects:detail', view };
      });
      if (!settings.tags) return details;

      const sorted = [...content].sort(order);
      const tagPages = tagsOf(content, ctx.locale).map((tag) => {
        const view: ProjectsView = {
          title: ctx.t('section.projects.title'),
          moreLabel: ctx.t('section.projects.more'),
          featuredLabel: ctx.t('section.projects.featured'),
          items: sorted.filter((p) => p.keywords.some((k) => tagSlug(k) === tag.slug)).map((p) => summary(p, ctx)),
          filter: filterOf(content, tag.slug, false, ctx),
        };
        const heading = ctx.t('section.projects.tagged', { tag: tag.name });
        return { path: tagPath(tag.slug), title: heading, heading, component: 'projects', view };
      });
      return [...details, ...tagPages];
    },
  });
};

function summary(p: Project, ctx: Pick<RenderContext, 'url' | 'image' | 'formatPeriod'>): ProjectSummary {
  const slug = slugOf(p);
  const image = p['x-vvitrine'].image;
  return {
    slug,
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    keywords: p.keywords,
    keywordSlugs: p.keywords.map(tagSlug),
    period: ctx.formatPeriod(p.startDate, p.endDate),
    href: ctx.url(`/projects/${slug}`),
    featured: p['x-vvitrine'].featured,
    ...(image ? { image: { ...ctx.image(image.src), alt: image.alt } } : {}),
  };
}
