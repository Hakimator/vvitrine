import { createKernel, type ContentModel, type JsonSchema } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { allSections } from '@vvitrine/sections';
import { describe, expect, it } from 'vitest';
import { describeContent, describeOptions, humanise, itemTitle, type FieldDescriptor } from '../src/index.ts';

const model = createKernel(
  { plugins: [memorySource({ en: { basics: { name: 'Jane' } } }), stringTheme({}, ''), ...allSections()] },
  { root: '/', logger: { info: () => {}, warn: () => {} } },
).editingModel();
const content = (key: string) => describeContent(model.content.find((c) => c.key === key)!);
const field = (form: FieldDescriptor, ...path: string[]): FieldDescriptor =>
  path.reduce((at, name) => (name === '*' ? at.item! : at.fields!.find((f) => f.path.at(-1) === name)!), form);
const walk = (form: FieldDescriptor): FieldDescriptor[] => [
  form,
  ...(form.fields ?? []).flatMap(walk),
  ...(form.item ? walk(form.item) : []),
];

describe('forms from the plugins’ schemas (US-131)', () => {
  it('gives every field of every built-in content key and section option a control and a label', () => {
    const forms = [
      ...model.content.map(describeContent),
      ...model.sections.flatMap((section) => describeOptions(section) ?? []),
    ];
    expect(forms.length).toBeGreaterThan(20);
    for (const form of forms) {
      for (const one of walk(form)) {
        expect(one.kind, `${form.label}: ${one.path.join('.')}`).not.toBe('unknown');
        expect(one.label, `${form.label}: ${one.path.join('.')}`).not.toBe('');
      }
    }
  });

  it('chooses the control from the schema and the core’s field types', () => {
    const basics = content('basics');
    expect(['name', 'email', 'url', 'image', 'summary'].map((name) => field(basics, name).kind)).toEqual([
      'text',
      'email',
      'url',
      'image',
      'long-text',
    ]);
    expect(field(basics, 'name')).toMatchObject({ label: 'Name', required: true, constraints: { minLength: 1 } });
    expect(field(basics, 'email').help).toBe('Never written plainly in the pages (protected from spam harvesters).');
    expect(field(basics, 'location', 'countryCode')).toMatchObject({ label: 'Country code', kind: 'text' });
    expect(field(basics, 'x-vvitrine')).toMatchObject({ label: 'Site options', kind: 'object' });

    const work = content('work');
    expect(work).toMatchObject({ kind: 'list', path: [], itemTitle: ['name'], item: { kind: 'object', path: ['*'] } });
    expect(field(work, '*', 'startDate')).toMatchObject({ kind: 'date', path: ['*', 'startDate'], required: true });
    expect(field(work, '*', 'highlights')).toMatchObject({ kind: 'list', required: false, default: [] });
    expect(field(work, '*', 'highlights', '*').kind).toBe('text');
    expect(field(content('projects'), '*', 'x-vvitrine', 'body').kind).toBe('markdown');
    expect(field(content('projects'), '*', 'x-vvitrine', 'image', 'src').kind).toBe('image');
    expect(field(content('stats'), '*', 'value').kind).toBe('text');
  });

  it('names list items with the plugin’s hint, or the first one-line text', () => {
    expect(content('testimonials').itemTitle).toEqual(['author']);
    expect(content('stats').itemTitle).toEqual(['label']);
    expect(content('education').itemTitle).toEqual(['institution']);
    const list = content('work');
    expect(itemTitle({ name: 'Acme', position: 'Developer' }, list)).toBe('Acme');
    expect(itemTitle({ name: ' ', position: 'Developer' }, list)).toBeUndefined();
    expect(itemTitle('TypeScript', field(list, '*', 'highlights'))).toBe('TypeScript');
    expect(itemTitle(null, list)).toBeUndefined();
  });

  it('describes section options, with choices and defaults', () => {
    const projects = describeOptions(model.sections.find((s) => s.id === 'projects')!)!;
    expect(field(projects, 'featuredOnly')).toMatchObject({ kind: 'boolean', default: false, required: false });
    expect(describeOptions({ id: 'x', plugin: 'x' })).toBeUndefined();
  });

  it('reads the JSON Schema forms zod writes: references, nullable unions, enums and constants', () => {
    const schema: JsonSchema = {
      type: 'object',
      $defs: { Level: { type: 'string', enum: ['beginner', 'expert'] } },
      properties: {
        level: { $ref: '#/$defs/Level', description: 'How well' },
        note: { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] },
        mode: { anyOf: [{ const: 'list' }, { const: 'grid' }] },
        fixed: { const: 1 },
        count: { type: ['integer', 'null'], minimum: 0 },
        texts: { type: 'object', additionalProperties: { type: 'string' } },
        title: { type: 'string', title: 'Heading' },
      },
      required: ['level'],
    };
    const form = describeContent({ key: 'x', owner: 'test', schema } as ContentModel);
    expect(field(form, 'level')).toMatchObject({ kind: 'select', options: ['beginner', 'expert'], required: true });
    expect(field(form, 'level').help).toBe('How well');
    expect(field(form, 'note')).toMatchObject({ kind: 'text', constraints: { maxLength: 80 } });
    expect(field(form, 'mode').options).toEqual(['list', 'grid']);
    expect(field(form, 'fixed').options).toEqual([1]);
    expect(field(form, 'count')).toMatchObject({ kind: 'number', constraints: { minimum: 0 } });
    expect(field(form, 'texts').kind).toBe('unknown');
    expect(field(form, 'title').label).toBe('Heading');
  });

  it('uses the plugin’s own control where it declares one', () => {
    const widget = { element: 'my-date', module: "customElements.define('my-date', class extends HTMLElement {})" };
    const form = describeContent({
      key: 'now',
      owner: 'test',
      schema: { type: 'array', items: { type: 'object', properties: { since: { type: 'string' } } } },
      editor: { widgets: { '*.since': widget } },
    });
    expect(field(form, '*', 'since')).toMatchObject({ kind: 'custom', widget });
  });

  it('makes field names readable', () => {
    expect(['startDate', 'countryCode', 'x-vvitrine', 'x-my_field', 'url'].map(humanise)).toEqual([
      'Start date',
      'Country code',
      'Site options',
      'My field',
      'Url',
    ]);
  });
});
