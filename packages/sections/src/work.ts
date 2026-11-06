import { defineSection, PartialDate, Url } from '@vvitrine/core';
import { z } from 'zod';
import { byMostRecent, ListOptions, take } from './shared.ts';

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

export interface WorkView {
  readonly title: string;
  readonly items: readonly {
    organization: string;
    position: string;
    location?: string;
    url?: string;
    period: string;
    summary?: string;
    highlights: readonly string[];
  }[];
}

export const work = () =>
  defineSection({
    name: '@vvitrine/section-work',
    kind: 'section',
    apiVersion: 1,
    id: 'work',
    content: { key: 'work', schema: WorkContent },
    optionsSchema: ListOptions,
    messages: { fr: { 'section.work.title': 'Expérience' }, en: { 'section.work.title': 'Experience' } },
    present: ({ content }, options, { t, formatPeriod }): WorkView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.work.title'),
            items: take([...content].sort(byMostRecent), options.limit).map((w) => ({
              organization: w.name,
              position: w.position,
              ...(w.location ? { location: w.location } : {}),
              ...(w.url ? { url: w.url } : {}),
              period: formatPeriod(w.startDate, w.endDate),
              ...(w.summary ? { summary: w.summary } : {}),
              highlights: w.highlights,
            })),
          },
  });
