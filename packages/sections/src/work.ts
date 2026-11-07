import { defineSection, PartialDate, Url, type EntriesView } from '@vvitrine/core';
import { z } from 'zod';
import { byMostRecent, isText, ListOptions, take } from './shared.ts';

export const WorkContent = z
  .array(
    z.object({
      name: z.string().min(1),
      position: z.string().min(1),
      location: z.string().optional(),
      url: Url.optional(),
      startDate: PartialDate,
      endDate: PartialDate.optional(),
      summary: z.string().optional(),
      highlights: z.array(z.string()).default([]),
    }),
  )
  .default([]);

/** Drawn as the shared `entries` view kind: title = position, subtitle = organisation. */
export type WorkView = EntriesView;

export const work = () =>
  defineSection({
    name: '@vvitrine/section-work',
    kind: 'section',
    apiVersion: 1,
    id: 'work',
    viewKind: 'entries',
    content: { key: 'work', schema: WorkContent },
    optionsSchema: ListOptions,
    messages: { fr: { 'section.work.title': 'Expérience' }, en: { 'section.work.title': 'Experience' } },
    present: ({ content }, options, { t, formatPeriod }): WorkView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.work.title'),
            items: take([...content].sort(byMostRecent), options.limit).map((w) => ({
              title: w.position,
              subtitle: w.name,
              ...(w.url ? { url: w.url } : {}),
              meta: [formatPeriod(w.startDate, w.endDate), w.location].filter(isText),
              ...(w.summary ? { summary: w.summary } : {}),
              notes: w.highlights,
            })),
          },
  });
