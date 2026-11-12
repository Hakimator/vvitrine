import { z } from 'zod';

/**
 * Shared building blocks for content schemas. Only `basics` is owned by the core: identity is
 * needed by every page (title, SEO, contact). Every other content key is owned by the plugin
 * that uses it (ADR-008), so the core never has to change when a new section appears.
 */

const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

/*
 * Field types with an editor hint (`x-editor` in their JSON Schema): the Studio picks a control from it (US-131).
 * Plain strings are one-line texts; the JSON Schema `format` already says url and email.
 */

export const PartialDate = z
  .string()
  .regex(PARTIAL_DATE, { message: 'expected a date as YYYY, YYYY-MM or YYYY-MM-DD' })
  .meta({ 'x-editor': 'date' });

export const Url = z.url({ message: 'expected a full URL starting with https://' });

/** A text of a few sentences or paragraphs (a summary, a description): edited in a text area. */
export const LongText = z.string().meta({ 'x-editor': 'long-text' });

/** Markdown (the text of an article or a project page): edited as Markdown. */
export const MarkdownText = z.string().meta({ 'x-editor': 'markdown' });

/** A picture, by its path in public/ (e.g. /photo.jpg): chosen or uploaded as an image. */
export const ImagePath = z.string().meta({ 'x-editor': 'image' });

export const Profile = z.object({
  network: z.string().min(1),
  username: z.string().optional(),
  url: Url.optional(),
});

export const Basics = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  label: z.string().optional(),
  image: ImagePath.optional().describe('Your photo in public/, e.g. /photo.jpg; initials are shown without it.'),
  email: z
    .email({ message: 'expected an email address' })
    .optional()
    .describe('Never written plainly in the pages (protected from spam harvesters).'),
  url: Url.optional(),
  summary: LongText.optional(),
  location: z
    .object({
      city: z.string().optional(),
      region: z.string().optional(),
      countryCode: z.string().length(2, { message: 'expected a 2-letter country code, e.g. FR' }).optional(),
    })
    .optional(),
  profiles: z.array(Profile).default([]),
  'x-vvitrine': z
    .object({
      availability: z.string().optional().describe('Shown under your name, e.g. "Looking for an internship".'),
    })
    .optional(),
});

export type Basics = z.infer<typeof Basics>;

/** Content keys that no plugin may claim. */
export const RESERVED_KEYS = ['$schemaVersion', 'basics', 'meta'] as const;

export const CONTENT_SCHEMA_VERSION = 1;
