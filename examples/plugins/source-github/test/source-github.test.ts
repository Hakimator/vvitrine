import { describe, expect, it, vi } from 'vitest';
import { InvalidPluginOptionsError } from '@vvitrine/core';
import { checkSourceContract } from '@vvitrine/core/testing';
import githubSource from '../src/index.ts';

const repo = (name: string, extra: object = {}) => ({
  name,
  description: `About ${name}`,
  html_url: `https://github.com/jane/${name}`,
  homepage: null,
  language: 'TypeScript',
  topics: ['portfolio', 'astro'],
  created_at: '2025-03-14T10:00:00Z',
  pushed_at: '2026-01-01T00:00:00Z',
  fork: false,
  archived: false,
  ...extra,
});

const api = (repositories: object[], status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(repositories), { status }));
const ctx = (locale = 'en') => ({ locale, defaultLocale: 'en', root: '/', logger: { info: () => {}, warn: () => {} } });

describe('example source-github', () => {
  it('turns repositories into projects, most recently updated first', async () => {
    const fetch = api([
      repo('old', { pushed_at: '2024-01-01T00:00:00Z' }),
      repo('site', { homepage: 'https://jane.dev', language: null, topics: ['portfolio'] }),
      repo('fork', { fork: true }),
      repo('archive', { archived: true }),
      repo('bare', { homepage: 'jane.dev', pushed_at: '2023-01-01T00:00:00Z', topics: ['portfolio'] }),
    ]);
    const result = await githubSource({ user: 'jane', topic: 'portfolio', fetch }).load(ctx());
    expect(result.data).toEqual({
      projects: [
        {
          name: 'site',
          description: 'About site',
          url: 'https://jane.dev',
          startDate: '2025-03',
          keywords: [],
        },
        {
          name: 'old',
          description: 'About old',
          url: 'https://github.com/jane/old',
          startDate: '2025-03',
          keywords: ['TypeScript', 'astro'],
        },
        // A homepage without "https://" would not be a valid URL: the repository page is used instead.
        {
          name: 'bare',
          description: 'About bare',
          url: 'https://github.com/jane/bare',
          startDate: '2025-03',
          keywords: ['TypeScript'],
        },
      ],
    });
    expect(result.origin).toEqual({ projects: 'github.com/jane' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/users/jane/repos?per_page=100&sort=pushed',
      expect.objectContaining({ headers: expect.objectContaining({ accept: 'application/vnd.github+json' }) }),
    );
  });

  it('keeps the topic filter, limit, forks and archived options', async () => {
    const all = [repo('a'), repo('b', { topics: [] }), repo('c', { fork: true }), repo('d', { archived: true })];
    const names = async (options: object) =>
      (
        (await githubSource({ user: 'jane', fetch: api(all), ...options }).load(ctx())).data.projects as {
          name: string;
        }[]
      ).map((p) => p.name);
    expect(await names({})).toEqual(['a', 'b']);
    expect(await names({ topic: 'portfolio' })).toEqual(['a']);
    expect(await names({ forks: true, archived: true, limit: 3 })).toEqual(['a', 'b', 'c']);
  });

  it('asks GitHub once per build, whatever the number of languages', async () => {
    const fetch = api([repo('a')]);
    expect(
      await checkSourceContract(githubSource({ user: 'jane', fetch }), { root: '/', locales: ['en', 'fr'] }),
    ).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('explains a failed request and invalid options', async () => {
    await expect(githubSource({ user: 'ghost', fetch: api([], 404) }).load(ctx())).rejects.toThrow(
      'GitHub answered 404 for the repositories of "ghost".',
    );
    expect(() => githubSource({ user: 'not a user' })).toThrow(InvalidPluginOptionsError);
  });
});
