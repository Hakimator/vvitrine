import { defineSection, PartialDate, Url, type RenderContext } from '@vvitrine/core';
import { z } from 'zod';
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
            .optional(),
          repository: Url.optional(),
          featured: z.boolean().default(false),
          image: z
            .object({ src: z.string(), alt: z.string().min(1, { message: 'alt text is required (accessibility)' }) })
            .optional(),
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
  readonly period: string;
  readonly href: string;
  readonly featured: boolean;
  readonly image?: { src: string; alt: string };
}

export interface ProjectsView {
  readonly title: string;
  readonly moreLabel: string;
  readonly items: readonly ProjectSummary[];
}

export interface ProjectDetailView extends ProjectSummary {
  readonly highlights: readonly string[];
  readonly roles: readonly string[];
  readonly url?: string;
  readonly repository?: string;
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

/** Featured first, then most recent. */
const order = (a: Project, b: Project) =>
  Number(b['x-vvitrine'].featured) - Number(a['x-vvitrine'].featured) || byMostRecent(a, b);

export const projects = () =>
  defineSection({
    name: '@vvitrine/section-projects',
    kind: 'section',
    apiVersion: 1,
    id: 'projects',
    content: { key: 'projects', schema: ProjectsContent },
    optionsSchema: ListOptions.extend({ featuredOnly: z.boolean().default(false) }),
    messages: {
      fr: {
        'section.projects.title': 'Projets',
        'section.projects.more': 'Voir le projet',
        'section.projects.demo': 'Démo',
        'section.projects.code': 'Code source',
        'section.projects.role': 'Mon rôle',
        'section.projects.stack': 'Technologies',
        'section.projects.back': 'Tous les projets',
      },
      en: {
        'section.projects.title': 'Projects',
        'section.projects.more': 'View project',
        'section.projects.demo': 'Demo',
        'section.projects.code': 'Source code',
        'section.projects.role': 'My role',
        'section.projects.stack': 'Technologies',
        'section.projects.back': 'All projects',
      },
    },
    present: ({ content }, options, ctx): ProjectsView | null => {
      const selected = [...content].sort(order).filter((p) => !options.featuredOnly || p['x-vvitrine'].featured);
      if (selected.length === 0) return null;
      return {
        title: options.title ?? ctx.t('section.projects.title'),
        moreLabel: ctx.t('section.projects.more'),
        items: take(selected, options.limit).map((p) => summary(p, ctx)),
      };
    },
    routes: ({ content }, ctx) => {
      const seen = new Set<string>();
      return content.map((p) => {
        const slug = slugOf(p);
        if (seen.has(slug)) throw new Error(`Two projects have the slug "${slug}". Set a unique x-vvitrine.slug.`);
        seen.add(slug);
        const view: ProjectDetailView = {
          ...summary(p, ctx),
          highlights: p.highlights,
          roles: p.roles,
          ...(p.url ? { url: p.url } : {}),
          ...(p['x-vvitrine'].repository ? { repository: p['x-vvitrine'].repository } : {}),
          labels: {
            back: ctx.t('section.projects.back'),
            demo: ctx.t('section.projects.demo'),
            code: ctx.t('section.projects.code'),
            role: ctx.t('section.projects.role'),
            stack: ctx.t('section.projects.stack'),
          },
          backHref: `${ctx.url('/')}#projects`,
        };
        return { path: `/projects/${slug}`, title: p.name, component: 'projects:detail', view };
      });
    },
  });

function summary(p: Project, ctx: Pick<RenderContext, 'url' | 'asset' | 'formatPeriod'>): ProjectSummary {
  const slug = slugOf(p);
  const image = p['x-vvitrine'].image;
  return {
    slug,
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    keywords: p.keywords,
    period: ctx.formatPeriod(p.startDate, p.endDate),
    href: ctx.url(`/projects/${slug}`),
    featured: p['x-vvitrine'].featured,
    ...(image ? { image: { src: ctx.asset(image.src), alt: image.alt } } : {}),
  };
}
