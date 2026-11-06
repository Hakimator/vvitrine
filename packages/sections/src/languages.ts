import { defineSection } from '@vvitrine/core';
import { z } from 'zod';
import { ListOptions } from './shared.ts';

export const LanguagesContent = z
  .array(z.object({ language: z.string().min(1), fluency: z.string().optional() }))
  .default([]);

export interface LanguagesView {
  readonly title: string;
  readonly items: readonly { language: string; fluency?: string }[];
}

export const languages = () =>
  defineSection({
    name: '@vvitrine/section-languages',
    kind: 'section',
    apiVersion: 1,
    id: 'languages',
    content: { key: 'languages', schema: LanguagesContent },
    optionsSchema: ListOptions.omit({ limit: true }),
    messages: { fr: { 'section.languages.title': 'Langues' }, en: { 'section.languages.title': 'Languages' } },
    present: ({ content }, options, { t }): LanguagesView | null =>
      content.length === 0 ? null : { title: options.title ?? t('section.languages.title'), items: content },
  });
