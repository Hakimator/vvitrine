# The Studio

The Studio edits your site from your own computer, without an account: start `pnpm dev`, then open
**http://localhost:4321/\_\_vvitrine/studio/**.

It is being built in steps. Today it shows what it will edit (every piece of content, its file, and whether it can be
saved) and offers the API the editing screens will use. Forms, the page builder and the live preview come next.

## Install or remove it

The Studio is a plugin, installed in the template:

```ts
import studio from '@vvitrine/studio';

export default defineConfig({
  plugins: [, /* ... */ studio()],
});
```

Remove `studio()` and every Studio address is gone. Either way, the built site never contains it: the Studio exists
only while `pnpm dev` runs.

## How it saves

- Changes are saved by the plugin that reads each file (YAML, Markdown), in place: your comments and layout stay, and
  `git diff` shows only what changed.
- Content a build would refuse is never saved: the Studio shows the problem next to the field instead.
- Content from a source that cannot save (for example GitHub repositories) is shown read-only.

## Security

The Studio can change your files, so it only answers:

- on `localhost`: other computers cannot reach it, even when the server is started with `--host`;
- to its own page: other websites open in your browser cannot use it;
- with the token of this run, which only the Studio's page receives. The token changes each time `pnpm dev` starts, so
  reopen the page after a restart.

Its page forbids scripts and styles from anywhere else, cannot be shown inside another site, and is never cached.
