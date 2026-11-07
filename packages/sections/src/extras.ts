/**
 * Portfolio extras that are not part of JSON Resume: testimonials, key figures and a combined timeline.
 * Their content keys are VVitrine keys; they use the shared view kinds, so themes need no new component
 * apart from `figures`.
 */
import {
  defineSection,
  PartialDate,
  Url,
  type EntriesView,
  type EntryItem,
  type FiguresView,
  type QuotesView,
} from '@vvitrine/core';
import { z } from 'zod';
import type { EducationContent } from './education.ts';
import type { VolunteerContent } from './entries.ts';
import { isText, ListOptions, take } from './shared.ts';
import type { WorkContent } from './work.ts';

// ---------- Testimonials ----------

export const TestimonialsContent = z
  .array(z.object({ quote: z.string().min(1), author: z.string().min(1), role: z.string().optional() }))
  .default([]);

export const testimonials = () =>
  defineSection({
    name: '@vvitrine/section-testimonials',
    kind: 'section',
    apiVersion: 1,
    id: 'testimonials',
    viewKind: 'quotes',
    content: { key: 'testimonials', schema: TestimonialsContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.testimonials.title': 'Témoignages' },
      en: { 'section.testimonials.title': 'Testimonials' },
    },
    present: ({ content }, options, { t }): QuotesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.testimonials.title'),
            items: take(content, options.limit).map((q) => ({
              quote: q.quote,
              author: q.author,
              ...(q.role ? { role: q.role } : {}),
            })),
          },
  });

// ---------- Key figures ----------

export const StatsContent = z
  .array(
    z.object({
      /** '12', '3+', '98 %'... Numbers are accepted and shown as written. */
      value: z.union([z.string().min(1), z.number()]).transform(String),
      label: z.string().min(1),
    }),
  )
  .default([]);

export const stats = () =>
  defineSection({
    name: '@vvitrine/section-stats',
    kind: 'section',
    apiVersion: 1,
    id: 'stats',
    viewKind: 'figures',
    content: { key: 'stats', schema: StatsContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.stats.title': 'En chiffres' },
      en: { 'section.stats.title': 'Key figures' },
    },
    present: ({ content }, options, { t }): FiguresView | null =>
      content.length === 0
        ? null
        : { title: options.title ?? t('section.stats.title'), items: take(content, options.limit) },
  });

// ---------- Timeline ----------

/** Keys the timeline can merge. Each one must be owned by an installed section. */
export type TimelineSource = 'work' | 'education' | 'volunteer';

/** Milestones that belong to no other section, e.g. "Moved to Lyon". */
export const TimelineContent = z
  .array(
    z.object({
      title: z.string().min(1),
      date: PartialDate,
      endDate: PartialDate.optional(),
      summary: z.string().optional(),
      url: Url.optional(),
    }),
  )
  .default([]);

interface Event {
  readonly start: string;
  readonly item: EntryItem;
}

/**
 * One chronological list, most recent first, merging the keys listed in `from` with the section's own `timeline`
 * milestones. Nothing is written twice: work and education entries come from their own sections.
 */
export const timeline = (settings: { readonly from?: readonly TimelineSource[] } = {}) => {
  const from = settings.from ?? (['work', 'education'] as const);
  return defineSection({
    name: '@vvitrine/section-timeline',
    kind: 'section',
    apiVersion: 1,
    id: 'timeline',
    viewKind: 'entries',
    content: { key: 'timeline', schema: TimelineContent },
    reads: from,
    optionsSchema: ListOptions,
    messages: {
      fr: {
        'section.timeline.title': 'Parcours',
        'section.timeline.work': 'Expérience',
        'section.timeline.education': 'Formation',
        'section.timeline.volunteer': 'Bénévolat',
      },
      en: {
        'section.timeline.title': 'Timeline',
        'section.timeline.work': 'Experience',
        'section.timeline.education': 'Education',
        'section.timeline.volunteer': 'Volunteering',
      },
    },
    present: ({ content, reads }, options, { t, formatPeriod, formatDate }): EntriesView | null => {
      const events: Event[] = content.map((m) => ({
        start: m.date,
        item: {
          title: m.title,
          ...(m.url ? { url: m.url } : {}),
          meta: [m.endDate ? formatPeriod(m.date, m.endDate) : formatDate(m.date)],
          ...(m.summary ? { summary: m.summary } : {}),
          notes: [],
        },
      }));
      const dated = <T extends { startDate?: string | undefined }>(items: readonly T[], toItem: (i: T) => EntryItem) =>
        items.flatMap((i) => (i.startDate ? [{ start: i.startDate, item: toItem(i) }] : []));
      if (from.includes('work')) {
        events.push(
          ...dated(reads['work'] as z.infer<typeof WorkContent>, (w) => ({
            title: w.position,
            subtitle: w.name,
            ...(w.url ? { url: w.url } : {}),
            meta: [formatPeriod(w.startDate, w.endDate), t('section.timeline.work')],
            notes: [],
          })),
        );
      }
      if (from.includes('education')) {
        events.push(
          ...dated(reads['education'] as z.infer<typeof EducationContent>, (e) => {
            const degree = [e.studyType, e.area].filter(isText).join(', ');
            return {
              ...(degree ? { title: degree, subtitle: e.institution } : { title: e.institution }),
              ...(e.url ? { url: e.url } : {}),
              meta: [formatPeriod(e.startDate, e.endDate), t('section.timeline.education')],
              notes: [],
            };
          }),
        );
      }
      if (from.includes('volunteer')) {
        events.push(
          ...dated(reads['volunteer'] as z.infer<typeof VolunteerContent>, (v) => ({
            ...(v.position ? { title: v.position, subtitle: v.organization } : { title: v.organization }),
            ...(v.url ? { url: v.url } : {}),
            meta: [formatPeriod(v.startDate, v.endDate), t('section.timeline.volunteer')],
            notes: [],
          })),
        );
      }
      if (events.length === 0) return null;
      return {
        title: options.title ?? t('section.timeline.title'),
        items: take(
          events.sort((a, b) => b.start.localeCompare(a.start)).map((e) => e.item),
          options.limit,
        ),
      };
    },
  });
};
