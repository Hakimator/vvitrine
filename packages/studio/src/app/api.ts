import type {
  ContentChange,
  ContentIssue,
  EditingModel,
  Locale,
  SavedContent,
  WrittenContent,
  WrittenLayout,
} from '@vvitrine/core';

/** The Studio's API as the page sees it, over HTTP, with the token of this run. */
export interface StudioApi {
  model(): Promise<EditingModel>;
  content(locale: Locale): Promise<WrittenContent>;
  checkContent(locale: Locale, content: Readonly<Record<string, unknown>>): Promise<readonly ContentIssue[]>;
  saveContent(locale: Locale, changes: readonly ContentChange[]): Promise<SavedContent>;
  layout(): Promise<WrittenLayout>;
  checkLayout(layout: Readonly<Record<string, unknown>>): Promise<readonly ContentIssue[]>;
  saveLayout(changes: readonly ContentChange[]): Promise<SavedContent>;
}

export function studioApi(base: string, token: string): StudioApi {
  const call = async <T>(name: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${base}api/${name}`, {
      ...init,
      headers: { 'x-vvitrine-studio-token': token, 'content-type': 'application/json', ...init.headers },
    });
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `The Studio answered ${response.status}.`);
    return body;
  };
  const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  return {
    model: () => call('model'),
    content: (locale) => call(`content?locale=${encodeURIComponent(locale)}`),
    checkContent: async (locale, content) =>
      (await call<{ issues: ContentIssue[] }>('check', post({ locale, content }))).issues,
    saveContent: (locale, changes: readonly ContentChange[]) => call('save', post({ locale, changes })),
    layout: () => call('layout'),
    checkLayout: async (layout) => (await call<{ issues: ContentIssue[] }>('check-layout', post({ layout }))).issues,
    saveLayout: (changes) => call('save-layout', post({ changes })),
  };
}
