/**
 * Tags that service plugins contribute to <head> (SEO, analytics, verification...). They are
 * rendered by the integration as escaped HTML, so plugins never write raw markup.
 */
export interface HeadTag {
  readonly tag: 'meta' | 'link' | 'script' | 'style';
  readonly attrs?: Readonly<Record<string, string | boolean>>;
  /** Text content (script/style only). `</` sequences are escaped. */
  readonly content?: string;
}

const ATTR_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHeadTag({ tag, attrs = {}, content }: HeadTag): string {
  const attributes = Object.entries(attrs)
    .filter((entry): entry is [string, string | true] => entry[1] !== false)
    .map(([name, value]) => {
      if (!ATTR_NAME.test(name)) throw new Error(`Invalid attribute name in head tag: ${name}`);
      return value === true ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
    })
    .join('');
  if (tag === 'meta' || tag === 'link') return `<${tag}${attributes}>`;
  const body = (content ?? '').replace(/<\//g, '<\\/');
  return `<${tag}${attributes}>${body}</${tag}>`;
}

export const renderHeadTags = (tags: readonly HeadTag[]): string => tags.map(renderHeadTag).join('\n');
