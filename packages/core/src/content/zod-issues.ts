import type { z } from 'zod';
import type { ContentIssue } from '../errors.ts';

const DATE_KEY = /date$/i;

/** Format a path like ['work', 0, 'startDate'] as `work[0].startDate`. */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

/** Convert Zod issues into readable, path-addressed issues. */
export function toIssues(error: z.ZodError, prefix: readonly PropertyKey[] = [], file?: string): ContentIssue[] {
  return error.issues.map((issue) => {
    const last = issue.path.at(-1);
    const hint = last !== undefined && DATE_KEY.test(String(last)) ? 'example: 2024-09' : undefined;
    const at = [...prefix, ...issue.path].filter((key) => typeof key !== 'symbol') as (string | number)[];
    return {
      path: formatPath([...prefix, ...issue.path]) || '(root)',
      at,
      message: issue.message,
      ...(hint ? { hint } : {}),
      ...(file ? { file } : {}),
    };
  });
}
