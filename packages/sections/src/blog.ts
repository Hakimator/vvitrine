/**
 * Blog: articles written in Markdown. The section lists them (shared `entries` view kind, so themes need no list
 * component) and contributes one page per article (`blog:post` component).
 */
import {
  defineSection,
  type EntriesView,
  type EntryItem,
  LongText,
  MarkdownText,
  PartialDate,
  type RenderContext,
} from '@vvitrine/core';
import { z } from 'zod';
import { renderMarkdownDocument, type Heading } from './markdown.ts';
import { ListOptions, slugify, take } from './shared.ts';

export const PostsContent = z
  .array(
    z.object({
      title: z.string().min(1),
      /** Publication date, e.g. 2026-11-07. */
      date: PartialDate,
      summary: LongText.optional(),
      tags: z.array(z.string().min(1)).default([]),
      /** Drafts are never published. */
      draft: z.boolean().default(false).describe('Keep the article out of the site.'),
      'x-vvitrine': z
        .object({
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/, { message: 'lowercase letters, digits and dashes only' })
            .optional()
            .describe('Address of the article, /blog/<slug>; default: the file name.'),
          /** The article, in Markdown. */
          body: MarkdownText.optional().describe('The article in Markdown (the text of the Markdown file).'),
        })
        .default({}),
    }),
  )
  .default([]);
type Post = z.infer<typeof PostsContent>[number];

export interface ArticleView {
  readonly title: string;
  readonly summary?: string;
  /** Formatted for display, e.g. "7 Nov 2026". */
  readonly date: string;
  /** Machine-readable, for <time datetime>. */
  readonly dateTime: string;
  /** e.g. "6 min read". */
  readonly readingTime: string;
  readonly tags: readonly string[];
  /** The article as HTML (headings start at <h2> and have ids). */
  readonly body: string;
  /** Second-level headings, for a table of contents. Empty when the article has fewer than three. */
  readonly toc: readonly Heading[];
  readonly backHref: string;
  readonly labels: { readonly back: string; readonly toc: string; readonly tags: string };
}

/** Average adult reading speed for screen text; 1 minute at least. */
const WORDS_PER_MINUTE = 200;
export const readingMinutes = (markdown: string): number =>
  Math.max(1, Math.ceil(markdown.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length / WORDS_PER_MINUTE));

const slugOf = (post: Post) => post['x-vvitrine'].slug ?? slugify(post.title);

export interface BlogSettings {
  /** Address of the blog page, where you place the `blog` section; articles live below it. Default '/blog'. */
  readonly path?: string;
}

export const blog = (settings: BlogSettings = {}) => {
  const path = (settings.path ?? '/blog').replace(/\/$/, '');
  const published = (content: readonly Post[]) =>
    content.filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date));
  const readingTime = (post: Post, t: RenderContext['t']) =>
    t('section.blog.readingTime', { minutes: readingMinutes(post['x-vvitrine'].body ?? '') });

  return defineSection({
    name: '@vvitrine/section-blog',
    kind: 'section',
    apiVersion: 1,
    id: 'blog',
    viewKind: 'entries',
    content: { key: 'posts', schema: PostsContent },
    optionsSchema: ListOptions,
    messages: {
      fr: {
        'section.blog.title': 'Articles',
        'section.blog.readingTime': '{minutes} min de lecture',
        'section.blog.back': 'Tous les articles',
        'section.blog.toc': 'Sur cette page',
        'section.blog.tags': 'Thèmes',
      },
      en: {
        'section.blog.title': 'Articles',
        'section.blog.readingTime': '{minutes} min read',
        'section.blog.back': 'All articles',
        'section.blog.toc': 'On this page',
        'section.blog.tags': 'Topics',
      },
    },
    present: ({ content }, options, ctx): EntriesView | null => {
      const posts = published(content);
      if (posts.length === 0) return null;
      return {
        title: options.title ?? ctx.t('section.blog.title'),
        items: take(posts, options.limit).map((p): EntryItem => ({
          title: p.title,
          url: ctx.url(`${path}/${slugOf(p)}`),
          meta: [ctx.formatDate(p.date), readingTime(p, ctx.t), ...(p.tags.length ? [p.tags.join(', ')] : [])],
          ...(p.summary ? { summary: p.summary } : {}),
          notes: [],
        })),
      };
    },
    routes: ({ content }, ctx) => {
      const seen = new Set<string>();
      return published(content).map((p) => {
        const slug = slugOf(p);
        if (seen.has(slug)) throw new Error(`Two articles have the slug "${slug}". Set a unique x-vvitrine.slug.`);
        seen.add(slug);
        const { html, headings } = renderMarkdownDocument(
          p['x-vvitrine'].body ?? '',
          ctx,
          `Article "${p.title}" (${ctx.locale})`,
        );
        const view: ArticleView = {
          title: p.title,
          ...(p.summary ? { summary: p.summary } : {}),
          date: ctx.formatDate(p.date),
          dateTime: p.date,
          readingTime: readingTime(p, ctx.t),
          tags: p.tags,
          body: html,
          toc: headings.length >= 3 ? headings : [],
          backHref: ctx.url(path),
          labels: {
            back: ctx.t('section.blog.back'),
            toc: ctx.t('section.blog.toc'),
            tags: ctx.t('section.blog.tags'),
          },
        };
        return { path: `${path}/${slug}`, title: p.title, component: 'blog:post', view };
      });
    },
  });
};
