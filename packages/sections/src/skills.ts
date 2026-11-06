import { defineSection } from '@vvitrine/core';
import { z } from 'zod';
import { ListOptions } from './shared.ts';

export const SkillsContent = z
  .array(z.object({ name: z.string().min(1), level: z.string().optional(), keywords: z.array(z.string()).default([]) }))
  .default([]);

export interface SkillsView {
  readonly title: string;
  readonly groups: readonly { name: string; level?: string; keywords: readonly string[] }[];
}

export const skills = () =>
  defineSection({
    name: '@vvitrine/section-skills',
    kind: 'section',
    apiVersion: 1,
    id: 'skills',
    content: { key: 'skills', schema: SkillsContent },
    optionsSchema: ListOptions.omit({ limit: true }),
    messages: { fr: { 'section.skills.title': 'Compétences' }, en: { 'section.skills.title': 'Skills' } },
    present: ({ content }, options, { t }): SkillsView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.skills.title'),
            groups: content.map(({ name, level, keywords }) => ({ name, ...(level ? { level } : {}), keywords })),
          },
  });
