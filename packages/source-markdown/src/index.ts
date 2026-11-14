import {
  InvalidPluginOptionsError,
  toIssues,
  VVitrineError,
  type ContentChange,
  type RawContent,
  type SaveContext,
  type SourceContext,
  type SourcePlugin,
} from '@vvitrine/core';
import { editYaml } from '@vvitrine/yaml-edit';
import { parse } from 'yaml';
import { z } from 'zod';

const Options = z.object({
  /** Folder that holds the Markdown files, relative to the project root. */
  dir: z.string().default('content/projects'),
  /** Content key the files fill, e.g. 'projects'. Each file becomes one item of that list. */
  key: z
    .string()
    .regex(/^[a-z][\w-]*$/, { message: 'expected a content key such as "projects"' })
    .default('projects'),
});

export type MarkdownSourceOptions = z.input<typeof Options>;

/** "bibliotheque.en.md" -> { slug: 'bibliotheque', locale: 'en' }; "bibliotheque.md" -> no locale. */
const FILE = /^(?<slug>[a-z0-9-]+)(?:\.(?<locale>[a-z]{2}(?:-[A-Z]{2})?))?\.md$/;
const FRONT_MATTER = /^---\n(?<data>[\s\S]*?)\n---\n?(?<body>[\s\S]*)$/;

/**
 * Reads one Markdown file per item. For locale "en", `name.en.md` wins over `name.md`; files for other locales are
 * ignored. The YAML front matter holds the item's fields; the text below it becomes `x-vvitrine.body` and the file
 * name the default `x-vvitrine.slug`. The key it provides replaces the same key from earlier sources.
 * Files are read through `ctx.files`, so the source works wherever the files are (disk, memory, a repository).
 *
 * It can save (the Studio), one file per item:
 * - a field change edits the front matter in place (comments and layout kept); `x-vvitrine.body` is the text below it;
 * - a new item becomes a new file named after its slug (or name): `slug.md` for the default locale, `slug.<locale>.md`
 *   for the others; removing an item deletes its file;
 * - items are ordered by file name, so they cannot be moved;
 * - a locale without its own file for an item shares `slug.md`: saving it changes the shared file.
 */
interface Entry {
  readonly slug: string;
  /** Path from the project root, e.g. "content/projects/library.en.md". */
  readonly path: string;
  readonly fields: Record<string, unknown>;
  readonly frontMatter: string;
  /** The text below the front matter, as written. */
  readonly rawBody: string;
  readonly crlf: boolean;
}

export default function markdownSource(options: MarkdownSourceOptions = {}): SourcePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/source-markdown', toIssues(parsed.error));
  const { dir, key } = parsed.data;
  const folder = dir.replace(/[\\/]+$/, '');

  /** The files of this locale, in item order (by file name), or undefined without the folder. */
  async function scan(ctx: SourceContext): Promise<Entry[] | undefined> {
    const names = await ctx.files.list(folder);
    if (!names) return undefined;
    const chosen = new Map<string, string>();
    for (const name of [...names].sort()) {
      const match = FILE.exec(name)?.groups;
      if (!match?.slug) continue;
      if (match.locale === ctx.locale || (!match.locale && !chosen.has(match.slug))) chosen.set(match.slug, name);
    }
    return Promise.all([...chosen].map(([slug, name]) => read(ctx, slug, `${folder}/${name}`)));
  }

  async function read(ctx: SourceContext, slug: string, path: string): Promise<Entry> {
    const shown = path.replaceAll('\\', '/');
    const original = (await ctx.files.read(path)) ?? '';
    // Windows checkouts may use CRLF line endings: normalise so the result is the same everywhere.
    const text = original.replaceAll('\r\n', '\n');
    const parts = FRONT_MATTER.exec(text)?.groups;
    if (!parts) throw new Error(`${shown} must start with front matter between two "---" lines.`);
    let data: unknown;
    try {
      data = parse(parts.data ?? '') ?? {};
    } catch (error) {
      throw new Error(`Could not parse the front matter of ${shown}: ${(error as Error).message}`, { cause: error });
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`The front matter of ${shown} must contain fields such as "name".`);
    }
    return {
      slug,
      path,
      fields: data as Record<string, unknown>,
      frontMatter: `${parts.data ?? ''}\n`,
      rawBody: parts.body ?? '',
      crlf: original.includes('\r\n'),
    };
  }

  /** The item a file gives: its fields, with the slug from the file name and the body. */
  function item(entry: Entry): Record<string, unknown> {
    const extension = (entry.fields['x-vvitrine'] ?? {}) as Record<string, unknown>;
    const body = entry.rawBody.trim();
    return { ...entry.fields, 'x-vvitrine': { slug: entry.slug, ...extension, ...(body ? { body } : {}) } };
  }

  async function write(ctx: SaveContext, path: string, frontMatter: string, body: string, crlf: boolean) {
    const text = `---\n${frontMatter.trimEnd()}\n---\n${body}`;
    await ctx.files.write(path, crlf ? text.replaceAll('\n', '\r\n') : text);
  }

  /** A new file for a new item, at a free name. */
  async function create(ctx: SaveContext, value: unknown, taken: readonly Entry[]): Promise<Entry> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new VVitrineError(`A new item of "${key}" must be an object with fields such as "name".`);
    }
    const { 'x-vvitrine': extension = {}, ...fields } = value as Record<string, unknown>;
    const { slug: wanted, body, ...rest } = extension as Record<string, unknown>;
    const base = slugify(typeof wanted === 'string' ? wanted : String(fields.name ?? fields.title ?? 'item'));
    const existing = new Set([
      ...((await ctx.files.list(folder)) ?? []),
      ...taken.map((e) => e.path.split('/').pop()!),
    ]);
    const used = (slug: string) => [...existing].some((name) => FILE.exec(name)?.groups?.slug === slug);
    let slug = base;
    for (let n = 2; used(slug); n += 1) slug = `${base}-${n}`;
    const name = ctx.locale === ctx.defaultLocale ? `${slug}.md` : `${slug}.${ctx.locale}.md`;
    // The slug comes from the file name; only a different wanted slug is written.
    const own = { ...rest, ...(typeof wanted === 'string' && wanted !== slug ? { slug: wanted } : {}) };
    const all = Object.keys(own).length > 0 ? { ...fields, 'x-vvitrine': own } : fields;
    const frontMatter = editYaml(
      '',
      Object.entries(all).map(([field, v]) => ({ op: 'set', path: [field], value: v })),
    );
    const text = typeof body === 'string' && body !== '' ? `\n${body}\n` : '';
    const path = `${folder}/${name}`;
    await write(ctx, path, frontMatter, text, false);
    return read(ctx, slug, path);
  }

  /** Apply a change inside one item: to its front matter, or to its body. */
  async function editItem(ctx: SaveContext, entry: Entry, change: ContentChange, rest: (string | number)[]) {
    if (rest[0] === 'x-vvitrine' && rest[1] === 'body' && rest.length === 2) {
      const body = change.op === 'set' && typeof change.value === 'string' && change.value !== '' ? change.value : '';
      await write(ctx, entry.path, entry.frontMatter, body ? `\n${body.trim()}\n` : '', entry.crlf);
      return read(ctx, entry.slug, entry.path);
    }
    // The default slug is the file name: setting it to that changes nothing in the file.
    const defaultSlug = rest.join('.') === 'x-vvitrine.slug' && change.op === 'set' && change.value === entry.slug;
    if (defaultSlug && (entry.fields['x-vvitrine'] as { slug?: unknown } | undefined)?.slug === undefined) return entry;
    const [field, ...more] = rest;
    if (typeof field !== 'string') throw new VVitrineError(`Cannot ${change.op} ${change.path.join('.')}.`);
    const frontMatter = editYaml(entry.frontMatter, [{ ...change, path: [field, ...more] }]);
    await write(ctx, entry.path, frontMatter, entry.rawBody, entry.crlf);
    return read(ctx, entry.slug, entry.path);
  }

  return {
    // One instance per content key (projects, posts...): the key keeps plugin names unique.
    name: `@vvitrine/source-markdown:${key}`,
    kind: 'source',
    apiVersion: 1,
    // Items are read by file name: the Studio does not offer to move them.
    fixedOrder: true,
    async load(ctx: SourceContext): Promise<RawContent> {
      const entries = await scan(ctx);
      if (!entries) {
        ctx.logger.info(`No folder ${dir}/: "${key}" comes from the other sources.`);
        return { data: {} };
      }
      if (entries.length === 0) return { data: {} };
      return { data: { [key]: entries.map(item) }, origin: { [key]: folder.replaceAll('\\', '/') } };
    },
    async save(changes: readonly ContentChange[], ctx: SaveContext): Promise<void> {
      // The entries follow the list as the changes see it, so the positions of later changes stay right.
      const entries = (await scan(ctx)) ?? [];
      for (const change of changes) {
        const [, index, ...rest] = change.path;
        if (index === undefined) {
          if (change.op === 'insert') entries.splice(change.index, 0, await create(ctx, change.value, entries));
          else if (change.op === 'move') {
            throw new VVitrineError(
              `"${key}" items are ordered by their file names in ${folder}/: they cannot be moved.`,
            );
          } else throw new VVitrineError(`Change "${key}" item by item: each item is a file in ${folder}/.`);
          continue;
        }
        const entry = typeof index === 'number' ? entries[index] : undefined;
        if (!entry) throw new VVitrineError(`Cannot ${change.op} ${change.path.join('.')}: there is no such item.`);
        if (rest.length > 0) entries[index as number] = await editItem(ctx, entry, change, rest);
        else if (change.op === 'remove') {
          await ctx.files.remove(entry.path);
          entries.splice(index as number, 1);
        } else if (change.op === 'set') {
          await ctx.files.remove(entry.path);
          entries[index as number] = await create(
            ctx,
            change.value,
            entries.filter((e) => e !== entry),
          );
        } else throw new VVitrineError(`Cannot ${change.op} ${change.path.join('.')}: an item is no list.`);
      }
    },
    accepts: (candidate) => candidate === key,
  };
}

/** "Ma Bibliothèque!" -> "ma-bibliotheque". */
function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'item' : slug;
}
