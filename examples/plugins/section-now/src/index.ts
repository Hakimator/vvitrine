/**
 * Example section plugin: "now", a short list of what you are doing at the moment (see nownownow.com), with the date
 * it was last updated.
 *
 * What it shows:
 * - a section owns a content key (`now`) and validates it with its own zod schema;
 * - it has options (`title`, `limit`) and messages in each language;
 * - it returns a shared view kind (`entries`), so every theme draws it without a component of its own.
 */
import { defineSection, PartialDate, type EntriesView } from '@vvitrine/core';
import { z } from 'zod';

export const NowContent = z
  .object({
    /** When you last updated the list, e.g. 2026-11. */
    updated: PartialDate,
    items: z.array(z.object({ text: z.string().min(1), details: z.string().optional() })).min(1),
  })
  .optional();

export default function now() {
  return defineSection({
    name: 'example-section-now',
    kind: 'section',
    apiVersion: 1,
    id: 'now',
    viewKind: 'entries',
    content: { key: 'now', schema: NowContent },
    optionsSchema: z.object({ title: z.string().optional(), limit: z.number().int().positive().optional() }),
    messages: {
      fr: { 'section.now.title': 'En ce moment', 'section.now.updated': 'Mis à jour : {date}' },
      en: { 'section.now.title': 'Now', 'section.now.updated': 'Updated {date}' },
    },
    present: ({ content }, options, { t, formatDate }): EntriesView | null => {
      if (!content) return null;
      const items = content.items.slice(0, options.limit);
      const updated = t('section.now.updated', { date: formatDate(content.updated) });
      return {
        title: options.title ?? t('section.now.title'),
        items: items.map((item, i) => ({
          title: item.text,
          // The date once, on the first line: the list as a whole was updated then.
          meta: i === 0 ? [updated] : [],
          ...(item.details ? { summary: item.details } : {}),
          notes: [],
        })),
      };
    },
  });
}
