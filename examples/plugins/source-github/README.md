# Example: a source plugin (`source-github`)

Lists your public GitHub repositories as **projects**, at build time.

```ts
import githubSource from './plugins/source-github/src/index.ts';

plugins: [
  yamlSource(),
  // After the YAML source: its `projects` replace the ones from your files.
  githubSource({ user: 'your-name', topic: 'portfolio', limit: 6 }),
  /* ... */
],
```

- **Options:** `user`, `topic` (keep only repositories with this topic; the topic itself is not shown as a keyword),
  `limit` (default 6), `forks` and `archived` (both left out by default).
- **Each project:** name, description, homepage (or the repository page), creation month, and the language and
  topics as keywords. The `projects` section validates them like any other content.
- **Rate limit:** GitHub allows 60 anonymous requests an hour. Set `GITHUB_TOKEN` (GitHub Actions provides one) to
  raise it. The plugin makes one request per build, shared by every language.
- **Privacy:** only the build contacts GitHub; the published pages make no request to it.

What it shows: the `SourcePlugin` contract (`load()` returns data per content key), option validation with zod, and a
testable network call (the `fetch` option). Tests: `test/source-github.test.ts`, which also runs
`checkSourceContract()` from `@vvitrine/core/testing`.
