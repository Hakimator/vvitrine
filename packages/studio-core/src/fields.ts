import type { ContentEditorHints, ContentModel, CustomWidget, JsonSchema, SectionModel } from '@vvitrine/core';

/** What kind of control edits a field. */
export type FieldKind =
  | 'text'
  | 'long-text'
  | 'markdown'
  | 'date'
  | 'url'
  | 'email'
  | 'image'
  | 'select'
  | 'boolean'
  | 'number'
  | 'list'
  | 'object'
  | 'custom'
  | 'unknown';

/** A position in a content key: field names, and `*` for any position in a list. */
export type FieldPath = readonly (string | '*')[];

/** One field of a form, built from a JSON Schema (US-131). */
export interface FieldDescriptor {
  /** Where the field is, inside its content key (empty for the key itself). */
  readonly path: FieldPath;
  readonly kind: FieldKind;
  /** From the schema's `title`, or the field name made readable ("startDate" -> "Start date"). */
  readonly label: string;
  /** From the schema's `description` (the `.describe()` texts). */
  readonly help?: string;
  readonly required: boolean;
  readonly default?: unknown;
  /** The choices of a `select`. */
  readonly options?: readonly (string | number | boolean)[];
  readonly constraints?: Readonly<Record<string, number | string>>;
  /** The fields of an `object`, in schema order. */
  readonly fields?: readonly FieldDescriptor[];
  /** What each item of a `list` is. */
  readonly item?: FieldDescriptor;
  /** For a list of objects: the fields that name an item, the first one with a value wins. */
  readonly itemTitle?: readonly string[];
  /** The plugin's control for a `custom` field. */
  readonly widget?: CustomWidget;
}

type Schema = Record<string, unknown>;

const EDITOR_KINDS = new Set<FieldKind>(['long-text', 'markdown', 'date', 'image']);
const CONSTRAINTS = ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems'] as const;

/** Words written in capitals in labels. */
const ACRONYMS: Readonly<Record<string, string>> = { url: 'URL', urls: 'URLs', pdf: 'PDF', cv: 'CV', id: 'ID' };

/** "startDate" -> "Start date", "countryCode" -> "Country code", "url" -> "URL", "x-vvitrine" -> "Site options". */
export function humanise(name: string): string {
  if (name === 'x-vvitrine') return 'Site options';
  const words = name
    .replace(/^x-/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  const written = words
    .split(' ')
    .map((word) => ACRONYMS[word] ?? word)
    .join(' ');
  return written.charAt(0).toUpperCase() + written.slice(1);
}

/** The form of a content key: its schema, with the plugin's hints (item titles, custom widgets). */
export function describeContent(model: ContentModel): FieldDescriptor {
  return describe(model.schema, model.schema, [], model.key, false, model.editor);
}

/** The form of a section's options on a page, or undefined when the section has none. */
export function describeOptions(section: SectionModel): FieldDescriptor | undefined {
  return section.options ? describe(section.options, section.options, [], section.id, false) : undefined;
}

function describe(
  input: JsonSchema,
  root: JsonSchema,
  path: FieldPath,
  name: string,
  required: boolean,
  hints?: ContentEditorHints,
): FieldDescriptor {
  const schema = resolve(input as Schema, root as Schema);
  const base = {
    path,
    label: typeof schema.title === 'string' ? schema.title : humanise(name),
    ...(typeof schema.description === 'string' ? { help: schema.description } : {}),
    required,
    ...('default' in schema ? { default: schema.default } : {}),
  };
  const constraints = Object.fromEntries(
    CONSTRAINTS.filter((key) => typeof schema[key] === 'number' || typeof schema[key] === 'string').map((key) => [
      key,
      schema[key] as number | string,
    ]),
  );
  const extra = Object.keys(constraints).length > 0 ? { constraints } : {};

  const widget = hints?.widgets?.[path.join('.')];
  if (widget) return { ...base, ...extra, kind: 'custom', widget };

  const options = choices(schema);
  if (options) return { ...base, kind: 'select', options };

  switch (typeOf(schema)) {
    case 'string': {
      const editor = schema['x-editor'] as FieldKind | undefined;
      const kind: FieldKind =
        editor && EDITOR_KINDS.has(editor)
          ? editor
          : schema.format === 'email'
            ? 'email'
            : schema.format === 'uri'
              ? 'url'
              : 'text';
      return { ...base, ...extra, kind };
    }
    case 'number':
    case 'integer':
      return { ...base, ...extra, kind: 'number' };
    case 'boolean':
      return { ...base, kind: 'boolean' };
    case 'array': {
      const item = describe((schema.items ?? {}) as JsonSchema, root, [...path, '*'], name, true, hints);
      const titles = item.kind === 'object' ? titleFields(item, hints) : undefined;
      return { ...base, ...extra, kind: 'list', item, ...(titles ? { itemTitle: titles } : {}) };
    }
    case 'object': {
      const properties = schema.properties as Record<string, JsonSchema> | undefined;
      // A free-form map (e.g. texts by key) has no fields to show.
      if (!properties) return { ...base, kind: 'unknown' };
      const needed = new Set((schema.required as string[] | undefined) ?? []);
      const fields = Object.entries(properties).map(([field, sub]) => {
        const resolved = resolve(sub as Schema, root as Schema);
        // A field with a default is not required in the files: the default fills it in.
        return describe(sub, root, [...path, field], field, needed.has(field) && !('default' in resolved), hints);
      });
      return { ...base, kind: 'object', fields };
    }
    default:
      return { ...base, kind: typeOf(schema) === 'text-or-number' ? 'text' : 'unknown' };
  }
}

const without = (schema: Schema, ...keys: string[]): Schema =>
  Object.fromEntries(Object.entries(schema).filter(([key]) => !keys.includes(key)));

/** Follow `$ref` (to `$defs`), and keep the one non-null branch of a nullable union. */
function resolve(schema: Schema, root: Schema): Schema {
  if (typeof schema.$ref === 'string') {
    const target = schema.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce<unknown>((at, part) => (at as Schema)?.[part], root);
    return resolve({ ...(target as Schema), ...without(schema, '$ref') }, root);
  }
  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined;
  if (branches) {
    const real = branches.filter((branch) => branch.type !== 'null');
    if (real.length === 1) {
      return resolve({ ...real[0], ...without(schema, 'anyOf', 'oneOf') }, root);
    }
  }
  return schema;
}

/** The JSON type, with a union of text and number (e.g. a figure, "12" or 12) seen as one kind. */
function typeOf(schema: Schema): string | undefined {
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((type) => type !== 'null');
    return types.length === 1 ? types[0] : undefined;
  }
  if (typeof schema.type === 'string') return schema.type;
  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined;
  if (branches?.every((branch) => ['string', 'number', 'integer'].includes(branch.type as string))) {
    return 'text-or-number';
  }
  if (schema.properties) return 'object';
  return undefined;
}

/** The choices of an enum, a const, or a union of consts. */
function choices(schema: Schema): (string | number | boolean)[] | undefined {
  if (Array.isArray(schema.enum)) return schema.enum as (string | number | boolean)[];
  if ('const' in schema) return [schema.const as string | number | boolean];
  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined;
  if (branches?.length && branches.every((branch) => 'const' in branch || Array.isArray(branch.enum))) {
    return branches.flatMap((branch) => (Array.isArray(branch.enum) ? branch.enum : [branch.const])) as (
      string | number | boolean
    )[];
  }
  return undefined;
}

/** The fields that name a list item: the plugin's hint, or the first one-line text field. */
function titleFields(item: FieldDescriptor, hints?: ContentEditorHints): string[] | undefined {
  if (hints?.itemTitle !== undefined)
    return typeof hints.itemTitle === 'string' ? [hints.itemTitle] : [...hints.itemTitle];
  const first = item.fields?.find((field) => field.kind === 'text');
  return first ? [first.path.at(-1) as string] : undefined;
}

/** How the Studio names one item of a list: its first title field with a value, or the value itself. */
export function itemTitle(item: unknown, list: FieldDescriptor): string | undefined {
  if (typeof item === 'string' || typeof item === 'number') return String(item) || undefined;
  if (typeof item !== 'object' || item === null) return undefined;
  for (const field of list.itemTitle ?? []) {
    const value = (item as Record<string, unknown>)[field];
    if ((typeof value === 'string' && value.trim() !== '') || typeof value === 'number') return String(value);
  }
  return undefined;
}
