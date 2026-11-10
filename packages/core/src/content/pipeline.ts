import { InvalidContentError, type ContentIssue } from '../errors.ts';
import type { Logger, ProjectFiles } from '../plugin.ts';
import type { PluginRegistry } from '../registry.ts';
import { Basics, RESERVED_KEYS } from './schemas.ts';
import { toIssues } from './zod-issues.ts';

export interface ValidatedContent {
  readonly basics: Basics;
  /** Validated value per owned key (defaults applied). */
  readonly byKey: ReadonlyMap<string, unknown>;
}

/**
 * Load -> merge -> transform -> validate, for one locale.
 * Sources are merged in registration order (later sources override earlier keys). Each key is
 * validated by the schema of the plugin that owns it; all problems are reported at once.
 */
export async function loadContent(
  registry: PluginRegistry,
  ctx: { locale: string; defaultLocale: string; root: string; logger: Logger; files: ProjectFiles },
): Promise<ValidatedContent> {
  const raw: Record<string, unknown> = {};
  const origin: Record<string, string> = {};

  for (const source of registry.ofKind('source')) {
    const loaded = await source.load(ctx);
    Object.assign(raw, loaded.data);
    Object.assign(origin, loaded.origin);
  }

  for (const plugin of registry.all()) {
    await plugin.hooks?.contentLoaded?.(raw, { locale: ctx.locale, logger: ctx.logger });
  }

  const issues: ContentIssue[] = [];
  const byKey = new Map<string, unknown>();

  const basics = Basics.safeParse(raw.basics);
  if (!basics.success) issues.push(...toIssues(basics.error, ['basics'], origin.basics));

  for (const key of registry.ownedKeys()) {
    const { schema } = registry.owner(key)!.content!;
    const result = schema.safeParse(raw[key]);
    if (result.success) byKey.set(key, result.data);
    else issues.push(...toIssues(result.error, [key], origin[key]));
  }

  if (issues.length > 0 || !basics.success) throw new InvalidContentError(ctx.locale, issues);

  const known = new Set<string>([...RESERVED_KEYS, ...registry.ownedKeys()]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      ctx.logger.warn(`Content key "${key}" (${origin[key] ?? 'unknown file'}) is not used by any section plugin.`);
    }
  }

  return { basics: basics.data, byKey };
}
