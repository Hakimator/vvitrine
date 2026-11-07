import { z } from 'zod';

/** Options shared by list sections. `title` overrides the translated default title. */
export const ListOptions = z.object({
  title: z.string().optional(),
  limit: z.number().int().positive().optional(),
});
export type ListOptions = z.infer<typeof ListOptions>;

/** Sort key so that ongoing items come first, then most recent first. */
export const byMostRecent = <T extends { startDate?: string | undefined; endDate?: string | undefined }>(
  a: T,
  b: T,
): number =>
  (b.endDate ?? '9999').localeCompare(a.endDate ?? '9999') || (b.startDate ?? '').localeCompare(a.startDate ?? '');

/** Type guard that drops undefined and empty strings, for optional `meta` facts. */
export const isText = (value: string | undefined): value is string => typeof value === 'string' && value !== '';

export const take = <T>(items: readonly T[], limit?: number): T[] => (limit ? items.slice(0, limit) : [...items]);

export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
