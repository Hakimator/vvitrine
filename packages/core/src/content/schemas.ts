import { z } from 'zod';

/**
 * Shared building blocks for content schemas. Only `basics` is owned by the core: identity is
 * needed by every page (title, SEO, contact). Every other content key is owned by the plugin
 * that uses it (ADR-008), so the core never has to change when a new section appears.
 */

const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

export const PartialDate = z
  .string()
  .regex(PARTIAL_DATE, { message: 'expected a date as YYYY, YYYY-MM or YYYY-MM-DD' });

export const Url = z.url({ message: 'expected a full URL starting with https://' });

export const Profile = z.object({
  network: z.string().min(1),
  username: z.string().optional(),
  url: Url.optional(),
});

export const Basics = z.object({
  name: z.string().min(1, { message: 'name is required' }),
  label: z.string().optional(),
  image: z.string().optional(),
  email: z.email({ message: 'expected an email address' }).optional(),
  url: Url.optional(),
  summary: z.string().optional(),
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
      availability: z.string().optional(),
    })
    .optional(),
});

export type Basics = z.infer<typeof Basics>;

/** Content keys that no plugin may claim. */
export const RESERVED_KEYS = ['$schemaVersion', 'basics', 'meta'] as const;

export const CONTENT_SCHEMA_VERSION = 1;
