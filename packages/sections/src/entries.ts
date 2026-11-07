/**
 * JSON Resume sections drawn with the shared `entries` view kind: volunteer, awards, certificates, publications.
 * Each one owns its content key and validates it; themes need no dedicated component.
 */
import { defineSection, PartialDate, Url, type EntriesView, type EntryItem } from '@vvitrine/core';
import { z } from 'zod';
import { byMostRecent, isText, ListOptions, take } from './shared.ts';

/** Most recent first; undated items last. */
const byDateDesc =
  <T>(date: (item: T) => string | undefined) =>
  (a: T, b: T): number =>
    (date(b) ?? '').localeCompare(date(a) ?? '');

const optional = <K extends string>(key: K, value: string | undefined) =>
  (value ? { [key]: value } : {}) as Partial<Record<K, string>>;

// ---------- Volunteer ----------

export const VolunteerContent = z
  .array(
    z.object({
      organization: z.string().min(1),
      position: z.string().optional(),
      url: Url.optional(),
      startDate: PartialDate.optional(),
      endDate: PartialDate.optional(),
      summary: z.string().optional(),
      highlights: z.array(z.string()).default([]),
    }),
  )
  .default([]);

export const volunteer = () =>
  defineSection({
    name: '@vvitrine/section-volunteer',
    kind: 'section',
    apiVersion: 1,
    id: 'volunteer',
    viewKind: 'entries',
    content: { key: 'volunteer', schema: VolunteerContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.volunteer.title': 'Bénévolat' },
      en: { 'section.volunteer.title': 'Volunteering' },
    },
    present: ({ content }, options, { t, formatPeriod }): EntriesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.volunteer.title'),
            items: take([...content].sort(byMostRecent), options.limit).map((v): EntryItem => ({
              ...(v.position ? { title: v.position, subtitle: v.organization } : { title: v.organization }),
              ...optional('url', v.url),
              meta: [formatPeriod(v.startDate, v.endDate)].filter(isText),
              ...optional('summary', v.summary),
              notes: v.highlights,
            })),
          },
  });

// ---------- Awards ----------

export const AwardsContent = z
  .array(
    z.object({
      title: z.string().min(1),
      date: PartialDate.optional(),
      awarder: z.string().optional(),
      summary: z.string().optional(),
    }),
  )
  .default([]);

export const awards = () =>
  defineSection({
    name: '@vvitrine/section-awards',
    kind: 'section',
    apiVersion: 1,
    id: 'awards',
    viewKind: 'entries',
    content: { key: 'awards', schema: AwardsContent },
    optionsSchema: ListOptions,
    messages: { fr: { 'section.awards.title': 'Distinctions' }, en: { 'section.awards.title': 'Awards' } },
    present: ({ content }, options, { t, formatDate }): EntriesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.awards.title'),
            items: take([...content].sort(byDateDesc((a) => a.date)), options.limit).map((a): EntryItem => ({
              title: a.title,
              ...optional('subtitle', a.awarder),
              meta: [a.date ? formatDate(a.date) : undefined].filter(isText),
              ...optional('summary', a.summary),
              notes: [],
            })),
          },
  });

// ---------- Certificates ----------

export const CertificatesContent = z
  .array(
    z.object({
      name: z.string().min(1),
      date: PartialDate.optional(),
      issuer: z.string().optional(),
      url: Url.optional(),
    }),
  )
  .default([]);

export const certificates = () =>
  defineSection({
    name: '@vvitrine/section-certificates',
    kind: 'section',
    apiVersion: 1,
    id: 'certificates',
    viewKind: 'entries',
    content: { key: 'certificates', schema: CertificatesContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.certificates.title': 'Certifications' },
      en: { 'section.certificates.title': 'Certifications' },
    },
    present: ({ content }, options, { t, formatDate }): EntriesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.certificates.title'),
            items: take([...content].sort(byDateDesc((c) => c.date)), options.limit).map((c): EntryItem => ({
              title: c.name,
              ...optional('subtitle', c.issuer),
              ...optional('url', c.url),
              meta: [c.date ? formatDate(c.date) : undefined].filter(isText),
              notes: [],
            })),
          },
  });

// ---------- Publications ----------

export const PublicationsContent = z
  .array(
    z.object({
      name: z.string().min(1),
      publisher: z.string().optional(),
      releaseDate: PartialDate.optional(),
      url: Url.optional(),
      summary: z.string().optional(),
    }),
  )
  .default([]);

export const publications = () =>
  defineSection({
    name: '@vvitrine/section-publications',
    kind: 'section',
    apiVersion: 1,
    id: 'publications',
    viewKind: 'entries',
    content: { key: 'publications', schema: PublicationsContent },
    optionsSchema: ListOptions,
    messages: {
      fr: { 'section.publications.title': 'Publications' },
      en: { 'section.publications.title': 'Publications' },
    },
    present: ({ content }, options, { t, formatDate }): EntriesView | null =>
      content.length === 0
        ? null
        : {
            title: options.title ?? t('section.publications.title'),
            items: take([...content].sort(byDateDesc((p) => p.releaseDate)), options.limit).map((p): EntryItem => ({
              title: p.name,
              ...optional('subtitle', p.publisher),
              ...optional('url', p.url),
              meta: [p.releaseDate ? formatDate(p.releaseDate) : undefined].filter(isText),
              ...optional('summary', p.summary),
              notes: [],
            })),
          },
  });
