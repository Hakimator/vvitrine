/**
 * Builds the configuration reference (docs/reference.md) and the JSON Schemas of the content files
 * (docs/content.schema.json) and of the layout file (docs/layout.schema.json) from the zod schemas themselves, so the documentation cannot drift from the code. Run `pnpm reference` to update them;
 * the test next to this file fails when they are out of date.
 */
import { z } from 'zod';
import { Basics, ConfigSchema, LayoutSchema, type SectionPlugin } from '@vvitrine/core';
import { contact } from '@vvitrine/contact';
import { allSections, privacy, timeline } from '@vvitrine/sections';

type Json = Record<string, unknown>;
interface Row {
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly default?: unknown;
  readonly description?: string;
}

const toJson = (schema: z.ZodType): Json =>
  // `input`: what you write (before defaults and transforms); plugins are objects zod cannot describe.
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Json;

const DATE = '^\\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\\d|3[01]))?)?$';

/** A short, readable type name for one JSON Schema node. */
function typeOf(node: Json): string {
  const anyOf = (node.anyOf ?? node.oneOf) as Json[] | undefined;
  if (anyOf) return [...new Set(anyOf.map(typeOf))].join(' or ');
  if (node.const !== undefined) return `\`${JSON.stringify(node.const)}\``;
  if (Array.isArray(node.enum)) return node.enum.map((v) => `\`${JSON.stringify(v)}\``).join(', ');
  if (node.format === 'uri') return 'URL';
  if (node.pattern === DATE) return 'date (YYYY, YYYY-MM or YYYY-MM-DD)';
  switch (node.type) {
    case 'string':
      return 'text';
    case 'integer':
      return 'whole number';
    case 'number':
      return 'number';
    case 'boolean':
      return '`true` or `false`';
    case 'array':
      return `list of ${typeOf((node.items as Json) ?? {})}`;
    case 'object':
      return node.properties ? 'object' : 'map';
    default:
      return 'any';
  }
}

/** One row per field, nested fields as `a.b`, list items as `a[].b`. */
function rows(node: Json, path: string, required: boolean, out: Row[] = []): Row[] {
  if (path) {
    out.push({
      path,
      type: typeOf(node),
      // A field with a default can be left out.
      required: required && node.default === undefined,
      ...(node.default !== undefined ? { default: node.default } : {}),
      ...(typeof node.description === 'string' ? { description: node.description } : {}),
    });
  }
  const item = node.type === 'array' ? (node.items as Json | undefined) : node;
  const props = item?.properties as Record<string, Json> | undefined;
  if (props) {
    const req = new Set((item!.required as string[] | undefined) ?? []);
    const prefix = node.type === 'array' ? `${path}[]` : path;
    for (const [key, child] of Object.entries(props)) rows(child, prefix ? `${prefix}.${key}` : key, req.has(key), out);
  }
  return out;
}

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
function table(list: readonly Row[]): string {
  if (list.length === 0) return '_No fields._\n';
  return (
    [
      '| Field | Type | Required | Default | Description |',
      '| --- | --- | --- | --- | --- |',
      ...list.map((r) =>
        [
          `\`${r.path}\``,
          r.type,
          r.required ? 'yes' : '',
          r.default !== undefined ? `\`${JSON.stringify(r.default)}\`` : '',
          r.description ?? '',
        ]
          .map(cell)
          .join(' | ')
          .replace(/^/, '| ')
          .concat(' |'),
      ),
    ].join('\n') + '\n'
  );
}

/** Every built-in section, as installed by the demo. */
export const builtInSections = (): readonly SectionPlugin[] =>
  [...allSections(), timeline({ from: ['work', 'education'] }), privacy(), contact()] as readonly SectionPlugin[];

export function generateReference() {
  const sections = [...builtInSections()].sort((a, b) => a.id.localeCompare(b.id));
  const content: Record<string, Json> = { basics: toJson(Basics) };
  const owners: Record<string, string> = { basics: 'core' };
  for (const s of sections) {
    if (!s.content) continue;
    content[s.content.key] = toJson(s.content.schema as z.ZodType);
    owners[s.content.key] = s.id;
  }

  const layoutJson = toJson(LayoutSchema);
  const md: string[] = [
    '# Configuration reference',
    '',
    '<!-- Generated from the schemas by `pnpm reference`. Do not edit by hand: change the schema and run it again. -->',
    '',
    'Every field VVitrine reads, with its type, whether it is required, and its default. The guides explain how to use',
    'them: [Configuration](configuration.md), [Content](content.md), [Themes](themes.md).',
    '',
    '## `vvitrine.config.ts`',
    '',
    'The plugins, and the options that need code. `site`, `pages` and `messages` can live here or in `site.yaml`,',
    'not in both.',
    '',
    table(rows(toJson(ConfigSchema), '', true)),
    '## `site.yaml`',
    '',
    'The layout of the site, as plain data: languages, pages, texts and design tokens. It sits next to',
    '`vvitrine.config.ts` (`site.yaml`, `site.yml` or `site.json`). Editors can check it with',
    '[`layout.schema.json`](layout.schema.json): add `# yaml-language-server: $schema=<path to it>` at the top.',
    '',
    table(rows(layoutJson, '', true)),
    '## Content',
    '',
    'Each key of your content files is owned and checked by one section. Fields of the',
    '[JSON Resume](https://jsonresume.org/schema) standard keep their usual meaning; `x-vvitrine` holds the extensions.',
    'Editors that read JSON Schema (VS Code with the YAML extension, for example) can check your files with',
    '[`content.schema.json`](content.schema.json): add `# yaml-language-server: $schema=<path to it>` at the top.',
    '',
  ];
  for (const key of Object.keys(content).sort((a, b) =>
    a === 'basics' ? -1 : b === 'basics' ? 1 : a.localeCompare(b),
  )) {
    md.push(
      `### \`${key}\``,
      '',
      `Owner: ${owners[key] === 'core' ? 'the core' : `the \`${owners[key]}\` section`}.`,
      '',
    );
    md.push(table(rows(content[key]!, '', true).length ? rows(content[key]!, key, true) : []));
  }
  md.push('## Section options', '', "Set per placement: `{ id: 'work', options: { limit: 3 } }`.", '');
  for (const s of sections) {
    md.push(`### \`${s.id}\``, '');
    md.push(s.optionsSchema ? table(rows(toJson(s.optionsSchema as z.ZodType), '', true)) : '_No options._\n');
  }

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'VVitrine content file',
    description: 'One content file (content/<name>.<locale>.yaml). Generated from the schemas by `pnpm reference`.',
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(content).map(([key, value]) => [
        key,
        Object.fromEntries(Object.entries(value).filter(([name]) => name !== '$schema')),
      ]),
    ),
  };
  const layout = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'VVitrine layout file',
    description: 'The layout file (site.yaml or site.json). Generated from the schemas by `pnpm reference`.',
    ...Object.fromEntries(Object.entries(layoutJson).filter(([name]) => name !== '$schema')),
  };
  return {
    markdown: md.join('\n'),
    schema: `${JSON.stringify(schema, null, 2)}\n`,
    layoutSchema: `${JSON.stringify(layout, null, 2)}\n`,
  };
}
