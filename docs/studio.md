# The Studio

The Studio edits your site from your own computer, without an account: start `pnpm dev`, then open
**http://localhost:4321/\_\_vvitrine/studio/**.

It is being built in steps. Today it edits your content and arranges your pages; the live preview comes next.

## Arrange your pages

**Pages**, at the top of the list, shows every page of your site with its sections in order. Each section has a menu
(the `⋯` button) with everything you can do to it:

- move it up, down, to the top or the bottom of its page, or to another page (with its options);
- hide it: it stays on the page with its options, but is not shown until you show it again;
- leave it out of the header menu, or put it back (pages linked from the footer have no header links);
- take it off the page.

"Add a section" lists the installed section plugins that are not on that page yet. You can also drag a section by its
handle (`⠿`), on its page or to another one: it does the same as the menu. Every move is announced, and Undo takes it
back.

Saving writes `site.yaml` in place: only the lines that moved change, and your comments stay with the section they
describe. The Studio arranges the pages only when they are in the layout file: if `vvitrine.config.ts` sets them, or
there is no `site.yaml`, it shows them read-only and says why.

## Edit your content

The list on the left has every piece of content of your site: your profile, jobs, projects, articles, and the content
of any section plugin you install. Pick one to see its form, with every language side by side, each with the file it
is saved to.

- Each field says what it expects (a date such as `2025-06`, an address, an image path).
- Lists (jobs, skills, their keywords...) have an "Add" button, and each item a menu (the `⋯` button) to move it up,
  down, to the top or the bottom, to duplicate it or to remove it; you can also drag it by its handle (`⠿`). These
  change every language at once, so that your languages keep the same items in the same order: only their texts
  differ. Each action is announced, and Undo takes it back.
- Projects and articles are a Markdown file each, per language, listed in the order of their file names: they cannot
  be moved, and adding, duplicating or removing one changes the language you do it in only. After saving, the Studio
  shows them in the order of their files.
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
