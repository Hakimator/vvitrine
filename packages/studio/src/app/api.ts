import type { ContentChange, ContentIssue, EditingModel, Locale, WrittenContent } from '@vvitrine/core';
import type { ContentChecker, ContentStore } from '@vvitrine/studio-core';

/** The Studio's API as the page sees it: the session's store and checker, over HTTP, with the token of this run. */
export interface StudioApi extends ContentStore, ContentChecker {
  model(): Promise<EditingModel>;
  content(locale: Locale): Promise<WrittenContent>;
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
  };
}
