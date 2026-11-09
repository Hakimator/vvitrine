/**
 * JSON Resume sections about interests and references, drawn with the shared `tags` and `quotes` view kinds.
 */
import { defineSection, type QuoteItem, type QuotesView, type TagsView } from '@vvitrine/core';
import { z } from 'zod';
import { ListOptions, take } from './shared.ts';

// ---------- Interests ----------

export const InterestsContent = z
  .array(z.object({ name: z.string().min(1), keywords: z.array(z.string()).default([]) }))
  .default([]);

export const interests = () =>
  defineSection({
    name: '@vvitrine/section-interests',
    kind: 'section',
    apiVersion: 1,
    id: 'interests',
    viewKind: 'tags',
    content: { key: 'interests', schema: InterestsContent },
    optionsSchema: ListOptions.omit({ limit: true }),
    messages: {
      fr: { 'section.interests.title': 'Centres d’intérêt' },
      en: { 'section.interests.title': 'Interests' },
    },
    present: ({ content }, options, { t }): TagsView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.interests.title'),
            groups: content.map(({ name, keywords }) => ({ name, keywords })),
          },
  });

// ---------- References ----------

export const ReferencesContent = z
  .array(
    z.object({
      name: z.string().min(1),
      reference: z.string().min(1),
      /** VVitrine extension: who the person is, e.g. "Team lead at Acme". */
      'x-vvitrine': z
        .object({ role: z.string().optional().describe('Who the person is, e.g. "Team lead at Acme".') })
        .optional(),
    }),
  )
  .default([]);

export const references = () =>
  defineSection({
    name: '@vvitrine/section-references',
    kind: 'section',
    apiVersion: 1,
    id: 'references',
    viewKind: 'quotes',
    content: { key: 'references', schema: ReferencesContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.references.title': 'Recommandations' },
      en: { 'section.references.title': 'References' },
    },
    present: ({ content }, options, { t }): QuotesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.references.title'),
            items: take(content, options.limit).map((r): QuoteItem => {
              const role = r['x-vvitrine']?.role;
              return { quote: r.reference, author: r.name, ...(role ? { role } : {}) };
            }),
          },
  });
