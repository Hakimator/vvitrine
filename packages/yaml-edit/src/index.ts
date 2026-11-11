import { applyChange, type ContentChange } from '@vvitrine/core';
import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  stringify,
  type Document,
  type Node,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml';

/**
 * @vvitrine/yaml-edit: a library shared by the YAML and Markdown sources and the Studio (for site.yaml).
 *
 * Edits YAML text the way a person would: only the lines a change touches are rewritten, so comments, blank lines,
 * quotes, line breaks in long texts and the `{ a: 1 }` / `[a, b]` styles stay as they were (readable diffs, ADR-016).
 *
 * Each change is applied to the text, then the text is parsed again and compared with the expected content
 * (`applyChange` on the data). If they differ, which a layout this editor does not know could cause, the document is
 * rewritten by the yaml library instead: still correct and with its comments, only reformatted.
 */
export function editYaml(text: string, changes: readonly ContentChange[]): string {
  return changes.reduce(editOnce, text);
}

// The repository's style (Prettier): single quotes, `[a, b]` lists and `{ a: 1 }` maps on one line.
const STRINGIFY = { lineWidth: 0, flowCollectionPadding: false, singleQuote: true } as const;

function editOnce(text: string, change: ContentChange): string {
  const doc = parseDocument(text);
  const expected = applyChange(toData(doc), change);
  let edited: string | undefined;
  try {
    edited = surgical(text, doc, change);
  } catch {
    edited = undefined;
  }
  if (edited !== undefined && same(toData(parseDocument(edited)), expected)) return edited;
  return rewrite(doc, change);
}

const toData = (doc: Document) => (doc.toJS() ?? {}) as Record<string, unknown>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The safety net: apply the change with the yaml library and print the whole document. */
function rewrite(doc: Document, change: ContentChange): string {
  const path: (string | number)[] = [...change.path];
  if (change.op === 'set') doc.setIn(path, change.value);
  else if (change.op === 'remove') doc.deleteIn(path);
  else {
    const seq = doc.getIn(path, true) as YAMLSeq;
    if (change.op === 'insert') seq.items.splice(change.index, 0, doc.createNode(change.value));
    else seq.items.splice(change.to, 0, ...seq.items.splice(change.from, 1));
  }
  return doc.toString(STRINGIFY);
}

// ---------- Text positions ----------

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1;
const lineEnd = (text: string, at: number) => {
  const end = text.indexOf('\n', at);
  return end === -1 ? text.length : end + 1;
};
const column = (text: string, at: number) => at - lineStart(text, at);
/** Spaces at the start of the line that holds `at`. */
const indentOf = (text: string, at: number) => /^ */.exec(text.slice(lineStart(text, at)))![0].length;
const isCommentLine = (line: string) => /^\s*#/.test(line);
const eolOf = (text: string) => (text.includes('\r\n') ? '\r\n' : '\n');

/** Start of an entry's text: its first line, with the comment lines just above it (they describe it). */
function blockStart(text: string, at: number, floor: number): number {
  let start = lineStart(text, at);
  while (start > floor) {
    const above = lineStart(text, start - 1);
    if (!isCommentLine(text.slice(above, start))) break;
    start = above;
  }
  return start;
}

const range = (node: unknown) => (node as Node | null | undefined)?.range ?? undefined;
const keyNode = (pair: unknown) => (pair as { key: Node }).key;
const keyOf = (pair: unknown) => {
  const key = keyNode(pair) as unknown;
  return isScalar(key) ? key.value : key;
};
const toJs = (node: unknown) => (node as { toJSON(): unknown }).toJSON();

interface Entry {
  /** Where the entry's text starts (comment lines above included) and ends (after its last line). */
  readonly start: number;
  readonly end: number;
}

/** The text of each entry of a block map or sequence, in order. */
function entries(text: string, collection: YAMLMap | YAMLSeq): Entry[] {
  const starts = collection.items.map((item) => range(isMap(collection) ? keyNode(item) : item)![0]);
  const end = lineEnd(text, Math.max(range(collection)![1] - 1, 0));
  return starts.map((start, index) => ({
    // The first entry stops at its parent's key line, which is no comment.
    start: blockStart(text, start, index === 0 ? 0 : lineEnd(text, starts[index - 1]!)),
    end: index + 1 < starts.length ? blockStart(text, starts[index + 1]!, lineEnd(text, start)) : end,
  }));
}

// ---------- Rendering ----------

/** A scalar as YAML text; a text with line breaks becomes a literal block ("|-" and its lines, not indented). */
function scalarText(value: unknown): string {
  if (typeof value === 'string' && value.includes('\n')) {
    const node = new Scalar(value);
    node.type = Scalar.BLOCK_LITERAL;
    return stringify(node, STRINGIFY).trimEnd();
  }
  return stringify(value, STRINGIFY).trimEnd();
}

/** A value on one line, in the repository's flow style (`[a, b]`, `{ a: 1 }`), or undefined if it needs lines. */
function flowText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const items = value.map(flowText);
    return items.includes(undefined) ? undefined : `[${items.join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const pairs = Object.entries(value).map(([key, item]) => {
      const text = flowText(item);
      return text === undefined ? undefined : `${flowText(key)}: ${text}`;
    });
    if (pairs.includes(undefined)) return undefined;
    return pairs.length === 0 ? '{}' : `{ ${pairs.join(', ')} }`;
  }
  if (typeof value === 'string' && value.includes('\n')) return undefined;
  // Inside [ ] and { }, commas and brackets need quotes: the yaml library decides, in a flow list of one.
  return stringify([value], { ...STRINGIFY, collectionStyle: 'flow' })
    .trim()
    .slice(1, -1);
}

/** YAML lines for a value, indented by `indent` spaces (no final line break). */
function block(value: unknown, indent: number, eol: string): string {
  return stringify(value, STRINGIFY)
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? line : ' '.repeat(indent) + line))
    .join(eol);
}

/** A value written after "key:": inline for scalars, on the next lines for non-empty collections. */
function afterKey(value: unknown, indent: number, eol: string): string {
  const isCollection = typeof value === 'object' && value !== null;
  if (isCollection && Object.keys(value).length > 0) return eol + block(value, indent, eol);
  return (
    ' ' +
    scalarText(value)
      .split('\n')
      .join(eol + ' '.repeat(indent))
  );
}

// ---------- The edits ----------

function surgical(text: string, doc: Document, change: ContentChange): string | undefined {
  const eol = eolOf(text);
  const path: (string | number)[] = [...change.path];

  if (change.op === 'insert' || change.op === 'move') {
    const seq = doc.getIn(path, true);
    if (!isSeq(seq)) return undefined;
    if (seq.flow) return replaceFlow(text, seq, listAfter(seq, change));
    return change.op === 'insert'
      ? insertItem(text, seq, change.index, change.value, eol)
      : moveItem(text, seq, change);
  }

  const parentPath = path.slice(0, -1);
  const last = path.at(-1)!;
  const parent = parentPath.length === 0 ? doc.contents : doc.getIn(parentPath, true);

  if (change.op === 'remove') {
    if (!(isMap(parent) || isSeq(parent))) return undefined;
    if (parent.flow) return replaceFlow(text, parent, without(parent, last));
    const index = isMap(parent) ? parent.items.findIndex((pair) => keyOf(pair) === last) : (last as number);
    const entry = entries(text, parent)[index];
    return entry ? text.slice(0, entry.start) + text.slice(entry.end) : undefined;
  }

  const existing = doc.getIn(path, true);
  if (range(existing)) return replaceValue(text, existing as Node, change.value, eol);
  return addKey(text, doc, path, change.value, eol);
}

function listAfter(seq: YAMLSeq, change: ContentChange): unknown[] {
  const items = [...(toJs(seq) as unknown[])];
  if (change.op === 'insert') items.splice(change.index, 0, change.value);
  else if (change.op === 'move') items.splice(change.to, 0, ...items.splice(change.from, 1));
  return items;
}

function without(collection: YAMLMap | YAMLSeq, last: string | number): unknown {
  const value = toJs(collection);
  if (Array.isArray(value)) return value.filter((_, index) => index !== last);
  return Object.fromEntries(Object.entries(value as object).filter(([key]) => key !== last));
}

/** Replace a flow collection written on one line by the new value, on one line too. */
function replaceFlow(text: string, node: Node, value: unknown): string | undefined {
  const [start, end] = range(node)!;
  const flow = flowText(value);
  if (text.slice(start, end).includes('\n') || flow === undefined) return undefined;
  return text.slice(0, start) + flow + text.slice(end);
}

function replaceValue(text: string, node: Node, value: unknown, eol: string): string | undefined {
  const [nodeStart, end] = range(node)!;
  let start = nodeStart;
  if (isScalar(node) && (node.type === Scalar.BLOCK_FOLDED || node.type === Scalar.BLOCK_LITERAL)) {
    // The range starts after the "|-" or ">-" header, which is on the key's line: replace the header too.
    const header = Math.max(text.lastIndexOf('|', start), text.lastIndexOf('>', start));
    if (header < lineStart(text, Math.max(start - 1, 0))) return undefined;
    start = header;
  }
  const simple = value === null || ['string', 'number', 'boolean'].includes(typeof value);
  if (isScalar(node) && simple) {
    // Keep the line break that ends a block scalar; indent the lines of a new block under the key.
    const ending = text.slice(start, end).endsWith('\n') ? eol : '';
    const written = scalarText(value)
      .split('\n')
      .join(eol + ' '.repeat(indentOf(text, start) + 2));
    return text.slice(0, start) + written + ending + text.slice(end);
  }
  if ((isScalar(node) || (node as { flow?: boolean }).flow) && !text.slice(start, end).includes('\n')) {
    const flow = flowText(value);
    if (flow !== undefined && flow.length <= 80) return text.slice(0, start) + flow + text.slice(end);
  }
  if (isMap(node) || isSeq(node)) {
    // A block collection: the new value as a block, at the same indentation.
    const stop = lineEnd(text, Math.max(end - 1, start));
    return text.slice(0, start) + block(value, column(text, start), eol).trimStart() + eol + text.slice(stop);
  }
  return undefined;
}

/** Add a key to the deepest block map that exists on the path; the rest of the path becomes nested objects. */
function addKey(
  text: string,
  doc: Document,
  path: (string | number)[],
  value: unknown,
  eol: string,
): string | undefined {
  let depth = path.length - 1;
  while (depth > 0 && !isMap(doc.getIn(path.slice(0, depth), true))) depth -= 1;
  const map = depth === 0 ? doc.contents : doc.getIn(path.slice(0, depth), true);
  const key = path[depth];
  if (typeof key !== 'string') return undefined;
  let nested: unknown = value;
  for (const segment of path.slice(depth + 1).reverse()) {
    if (typeof segment !== 'string') return undefined;
    nested = { [segment]: nested };
  }
  if (map === null || map === undefined) {
    // An empty document: the new key is its first line.
    const separator = text === '' || text.endsWith('\n') ? '' : eol;
    return text + separator + block({ [key]: nested }, 0, eol) + eol;
  }
  if (!isMap(map)) return undefined;
  if (map.flow) return replaceFlow(text, map, { ...(toJs(map) as object), [key]: nested });
  if (map.items.length === 0) return undefined;
  const after = entries(text, map).at(-1)!.end;
  const indent = column(text, range(keyNode(map.items[0]))![0]);
  const line = ' '.repeat(indent) + scalarText(key) + ':' + afterKey(nested, indent + 2, eol);
  const before = after > 0 && !text.slice(0, after).endsWith('\n') ? eol : '';
  return text.slice(0, after) + before + line + eol + text.slice(after);
}

function insertItem(text: string, seq: YAMLSeq, index: number, value: unknown, eol: string): string | undefined {
  const all = entries(text, seq);
  if (all.length === 0) return undefined;
  const dash = text.lastIndexOf('-', range(seq.items[0])![0]);
  const item = block([value], column(text, dash), eol) + eol;
  const at = index < all.length ? all[index]!.start : all.at(-1)!.end;
  const before = at > 0 && !text.slice(0, at).endsWith('\n') ? eol : '';
  return text.slice(0, at) + before + item + text.slice(at);
}

function moveItem(text: string, seq: YAMLSeq, change: { from: number; to: number }): string | undefined {
  const all = entries(text, seq);
  const blocks = all.map((entry) => text.slice(entry.start, entry.end));
  const lastBlock = blocks.length - 1;
  // Every block ends with a line break, the last one too, so they can be reordered freely.
  const endsFile = !blocks[lastBlock]!.endsWith('\n');
  if (endsFile) blocks[lastBlock] += eolOf(text);
  const [moved] = blocks.splice(change.from, 1);
  blocks.splice(change.to, 0, moved!);
  const joined = blocks.join('');
  return (
    text.slice(0, all[0]!.start) +
    (endsFile ? joined.slice(0, -eolOf(text).length) : joined) +
    text.slice(all.at(-1)!.end)
  );
}
