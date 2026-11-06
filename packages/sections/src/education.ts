import { defineSection, PartialDate, Url } from '@vvitrine/core';
import { z } from 'zod';
import { byMostRecent, ListOptions, take } from './shared.ts';

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

export interface EducationView {
  readonly title: string;
  readonly items: readonly {
    institution: string;
    degree: string;
    period: string;
    url?: string;
    courses: readonly string[];
  }[];
}

export const education = () =>
  defineSection({
    name: '@vvitrine/section-education',
    kind: 'section',
    apiVersion: 1,
    id: 'education',
    content: { key: 'education', schema: EducationContent },
    optionsSchema: ListOptions,
    messages: { fr: { 'section.education.title': 'Formation' }, en: { 'section.education.title': 'Education' } },
    present: ({ content }, options, { t, formatPeriod }): EducationView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.education.title'),
            items: take([...content].sort(byMostRecent), options.limit).map((e) => ({
              institution: e.institution,
              degree: [e.studyType, e.area].filter(Boolean).join(', '),
              period: formatPeriod(e.startDate, e.endDate),
              ...(e.url ? { url: e.url } : {}),
              courses: e.courses,
            })),
          },
  });
