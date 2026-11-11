import { InvalidContentError, type ContentIssue } from '../errors.ts';
import type { Logger, ProjectFiles, SourcePlugin } from '../plugin.ts';
import type { PluginRegistry } from '../registry.ts';
import { Basics, RESERVED_KEYS } from './schemas.ts';
import { toIssues } from './zod-issues.ts';

export interface ValidatedContent {
  readonly basics: Basics;
  /** Validated value per owned key (defaults applied). */
  readonly byKey: ReadonlyMap<string, unknown>;
}

type LoadContext = { locale: string; defaultLocale: string; root: string; logger: Logger; files: ProjectFiles };

/** Content as the sources gave it (merged, before hooks and defaults), with the file and the source of each key. */
export interface RawSiteContent {
  readonly raw: Record<string, unknown>;
  readonly origin: Record<string, string>;
  /** The source that provides each key: the last one that gave it. */
  readonly providers: ReadonlyMap<string, SourcePlugin>;
}

/** Load and merge, for one locale: sources in registration order, later sources override earlier keys. */
export async function loadRawContent(registry: PluginRegistry, ctx: LoadContext): Promise<RawSiteContent> {
  const raw: Record<string, unknown> = {};
  const origin: Record<string, string> = {};
  const providers = new Map<string, SourcePlugin>();

  for (const source of registry.ofKind('source')) {
    const loaded = await source.load(ctx);
    Object.assign(raw, loaded.data);
    Object.assign(origin, loaded.origin);
    for (const key of Object.keys(loaded.data)) providers.set(key, source);
  }
  return { raw, origin, providers };
}

/**
 * Load -> merge -> transform -> validate, for one locale.
 * Each key is validated by the schema of the plugin that owns it; all problems are reported at once.
 */
export async function loadContent(registry: PluginRegistry, ctx: LoadContext): Promise<ValidatedContent> {
  const { raw, origin } = await loadRawContent(registry, ctx);
  return validateContent(registry, raw, origin, ctx);
}

/** Transform (the `contentLoaded` hooks, which may change `raw`) -> validate. */
export async function validateContent(
  registry: PluginRegistry,
  raw: Record<string, unknown>,
  origin: Readonly<Record<string, string>>,
  ctx: { locale: string; logger: Logger },
): Promise<ValidatedContent> {
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
