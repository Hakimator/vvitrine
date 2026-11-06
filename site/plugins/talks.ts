/**
 * Example of a LOCAL plugin: a "talks" section that is not part of the framework.
 * It owns the `talks` key of your content (validated by its own schema) and ships its own
 * component, so it works with every theme. Copy this file to create your own sections.
 */
import { defineSection, PartialDate, Url } from '@vvitrine/core';
import { z } from 'zod';
import Talks from './Talks.astro';

const TalksContent = z
  .array(z.object({ title: z.string().min(1), event: z.string().min(1), date: PartialDate, url: Url.optional() }))
  .default([]);

export default function talks() {
  return defineSection({
    name: 'local-talks',
    kind: 'section',
    apiVersion: 1,
    id: 'talks',
    content: { key: 'talks', schema: TalksContent },
    messages: { fr: { 'section.talks.title': 'Interventions' }, en: { 'section.talks.title': 'Talks' } },
    present: ({ content }, _options, { t, formatDate }) =>
      content.length === 0
        ? null
        : { title: t('section.talks.title'), items: content.map((talk) => ({ ...talk, date: formatDate(talk.date) })) },
    defaultComponents: { talks: Talks },
  });
}
