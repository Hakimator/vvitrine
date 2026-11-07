import { defineSection, PartialDate, Url, type EntriesView } from '@vvitrine/core';
import { z } from 'zod';
import { byMostRecent, isText, ListOptions, take } from './shared.ts';

export const EducationContent = z
  .array(
    z.object({
      institution: z.string().min(1),
      url: Url.optional(),
      area: z.string().optional(),
      studyType: z.string().optional(),
      startDate: PartialDate.optional(),
      endDate: PartialDate.optional(),
      score: z.string().optional(),
      courses: z.array(z.string()).default([]),
    }),
  )
  .default([]);

/** Drawn as the shared `entries` view kind, like work: title = degree, subtitle = institution. */
export type EducationView = EntriesView;

export const education = () =>
  defineSection({
    name: '@vvitrine/section-education',
    kind: 'section',
    apiVersion: 1,
    id: 'education',
    viewKind: 'entries',
    content: { key: 'education', schema: EducationContent },
    optionsSchema: ListOptions,
    messages: { fr: { 'section.education.title': 'Formation' }, en: { 'section.education.title': 'Education' } },
    present: ({ content }, options, { t, formatPeriod }): EducationView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.education.title'),
            items: take([...content].sort(byMostRecent), options.limit).map((e) => {
              const degree = [e.studyType, e.area].filter(isText).join(', ');
              return {
                ...(degree ? { title: degree, subtitle: e.institution } : { title: e.institution }),
                ...(e.url ? { url: e.url } : {}),
                meta: [formatPeriod(e.startDate, e.endDate), e.score].filter(isText),
                notes: e.courses,
              };
            }),
          },
  });
