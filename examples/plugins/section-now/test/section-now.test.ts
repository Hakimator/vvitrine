import { describe, expect, it } from 'vitest';
import { InvalidContentError, createKernel, InvalidPluginOptionsError, type EntriesView } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { describeContent } from '@vvitrine/studio-core';
import now from '../src/index.ts';
import { monthInputModule } from '../src/month-input.browser.ts';

const content = {
  basics: { name: 'Jane' },
  now: {
    updated: '2026-11',
    items: [{ text: 'Looking for an internship' }, { text: 'Writing a framework', details: 'Astro and TypeScript' }],
  },
};

const build = (data: Record<string, unknown>, options: object = {}) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [memorySource({ en: data, fr: data }), stringTheme({ 'kind:entries': 'Entries' }), now()],
      pages: [{ path: '/', sections: [{ id: 'now', options }] }],
    },
    { root: '/', logger: { info: () => {}, warn: () => {} } },
  ).build();

const section = async (data: Record<string, unknown>, options: object = {}, locale = 'en') =>
  (await build(data, options)).routes.find((r) => r.locale === locale)!.sections.find((s) => s.id === 'now');

describe('example section-now', () => {
  it('lists what you are doing now, dated once, in the page language', async () => {
    const fr = await section(content, {}, 'fr');
    // No component of its own: the theme draws it as a list of entries.
    expect(fr!.component).toBe('Entries');
    expect(fr!.view as EntriesView).toEqual({
      title: 'En ce moment',
      items: [
        { title: 'Looking for an internship', meta: ['Mis à jour : nov. 2026'], notes: [] },
        { title: 'Writing a framework', meta: [], summary: 'Astro and TypeScript', notes: [] },
      ],
    });
  });

  it('follows its options, and disappears without content', async () => {
    const view = (await section(content, { title: 'Lately', limit: 1 }))!.view as EntriesView;
    expect(view.title).toBe('Lately');
    expect(view.items).toHaveLength(1);
    expect(await section({ basics: { name: 'Jane' } })).toBeUndefined();
    await expect(build(content, { limit: 0 })).rejects.toThrow(InvalidPluginOptionsError);
  });

  it('rejects content that does not match its schema', async () => {
    await expect(build({ ...content, now: { updated: 'soon', items: [] } })).rejects.toThrow(InvalidContentError);
  });

  it('tells the Studio how to edit it: items named by their text, the month with its own control', () => {
    const model = createKernel(
      { plugins: [memorySource({ en: content }), stringTheme({}, ''), now()] },
      { root: '/', logger: { info: () => {}, warn: () => {} } },
    ).editingModel();
    const form = describeContent(model.content.find((c) => c.key === 'now')!);
    const updated = form.fields!.find((f) => f.path.join('.') === 'updated')!;
    expect(updated).toMatchObject({ kind: 'custom', widget: { element: 'now-month' } });
    expect(form.fields!.find((f) => f.path.join('.') === 'items')!.itemTitle).toEqual(['text']);
  });

  it('defines <now-month>: a value in YYYY-MM, and a change event when it changes', () => {
    // Small stand-ins for the browser: enough to run the module and use the element.
    const defined = new Map<string, new () => HTMLElement & { value: string }>();
    const input = {
      type: '',
      value: '',
      isConnected: false,
      label: '',
      listener: () => {},
      addEventListener(_type: string, listener: () => void) {
        this.listener = listener;
      },
      setAttribute(_name: string, label: string) {
        this.label = label;
      },
    };
    const events: string[] = [];
    class Element {
      getAttribute = () => 'Updated';
      append = () => {};
      dispatchEvent = (event: { type: string }) => events.push(event.type);
    }
    const browser = {
      customElements: {
        get: (name: string) => defined.get(name),
        define: (name: string, c: never) => defined.set(name, c),
      },
      HTMLElement: Element,
      document: { createElement: () => input },
      Event: class {
        readonly type: string;
        constructor(type: string) {
          this.type = type;
        }
      },
    };
    new Function(...Object.keys(browser), monthInputModule)(...Object.values(browser));
    const element = new (defined.get('now-month')!)();
    (element as unknown as { connectedCallback(): void }).connectedCallback();
    element.value = '2026-11';
    expect([input.type, input.value, element.value, input.label]).toEqual(['month', '2026-11', '2026-11', 'Updated']);
    input.listener();
    expect(events).toEqual(['change']);
  });
});
