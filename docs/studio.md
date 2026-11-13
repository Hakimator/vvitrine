# The Studio

The Studio edits your site from your own computer, without an account: start `pnpm dev`, then open
**http://localhost:4321/\_\_vvitrine/studio/**.

It is being built in steps. Today it edits your content; the page builder and the live preview come next.

## Edit your content

The list on the left has every piece of content of your site: your profile, jobs, projects, articles, and the content
of any section plugin you install. Pick one to see its form, with every language side by side, each with the file it
is saved to.

- Each field says what it expects (a date such as `2025-06`, an address, an image path). Lists have an "Add" button
  and each item a "Remove" button.
- A field filled in one language and empty in another is marked "Missing in FR" (or the language concerned), so that
  no translation is forgotten.
- What you type is checked after a short pause, by the same rules as the build: a problem shows under its field, and
  the content is marked "(to fix)" in the list.
- **Undo** (Ctrl+Z) and **Redo** (Ctrl+Shift+Z) go back and forth through your changes, and **Save** (Ctrl+S) writes
  them all at once. Leaving the page with unsaved changes asks you first.
- Fields the Studio has no form for (rare: a plugin's own structure) are shown as they are, to edit in their file.

A plugin can give its fields their own controls (see [Make a section editable in the Studio](plugins.md#make-a-section-editable-in-the-studio)): the Studio
loads them only when their field is shown.

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
