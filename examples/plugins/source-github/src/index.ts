/**
 * Example source plugin: lists your public GitHub repositories as `projects`, at build time.
 *
 * What it shows:
 * - a source returns plain data for content keys; the section that owns the key (`projects`) validates it;
 * - options are validated with zod and reported with `InvalidPluginOptionsError`;
 * - network access happens at build time only: visitors' browsers never contact GitHub.
 */
import { InvalidPluginOptionsError, toIssues, type SourcePlugin } from '@vvitrine/core';
import { z } from 'zod';

const Options = z.object({
  /** Your GitHub user name. */
  user: z.string().regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i, { message: 'expected a GitHub user name' }),
  /** Keep only repositories with this topic, e.g. 'portfolio'. */
  topic: z.string().optional(),
  /** At most this many, most recently updated first. */
  limit: z.number().int().positive().default(6),
  /** Leave out forks (default) and archived repositories (default). */
  forks: z.boolean().default(false),
  archived: z.boolean().default(false),
  /** For tests, or a proxy: the function used to call the GitHub API. */
  fetch: z.custom<typeof fetch>((value) => typeof value === 'function').optional(),
});

export type GitHubSourceOptions = z.input<typeof Options>;

/** The fields of the GitHub REST API "list repositories for a user" response that we use. */
interface Repository {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  created_at: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

export default function githubSource(options: GitHubSourceOptions): SourcePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('source-github', toIssues(parsed.error));
  const { user, topic, limit, forks, archived } = parsed.data;
  const request = parsed.data.fetch ?? fetch;
  let repositories: Promise<Repository[]> | undefined;

  return {
    name: 'example-source-github',
    kind: 'source',
    apiVersion: 1,
    async load(ctx) {
      // One request per build, shared by every language: repository data is not translated.
      repositories ??= (async () => {
        const token = process.env.GITHUB_TOKEN;
        const response = await request(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, {
          headers: {
            accept: 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
            // Optional: raises the limit from 60 to 5,000 requests an hour (GitHub Actions provides one).
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok) throw new Error(`GitHub answered ${response.status} for the repositories of "${user}".`);
        return (await response.json()) as Repository[];
      })();
      const projects = (await repositories)
        .filter((repo) => (forks || !repo.fork) && (archived || !repo.archived))
        .filter((repo) => !topic || (repo.topics ?? []).includes(topic))
        .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
        .slice(0, limit)
        .map((repo) => ({
          name: repo.name,
          ...(repo.description ? { description: repo.description } : {}),
          // GitHub accepts any text as a homepage: keep it only when it is a full web address.
          url: repo.homepage && /^https?:\/\//.test(repo.homepage) ? repo.homepage : repo.html_url,
          startDate: repo.created_at.slice(0, 7),
          keywords: [...(repo.language ? [repo.language] : []), ...(repo.topics ?? []).filter((t) => t !== topic)],
        }));
      ctx.logger.info(`${projects.length} GitHub repositories of ${user} as projects.`);
      return { data: { projects }, origin: { projects: `github.com/${user}` } };
    },
  };
}
