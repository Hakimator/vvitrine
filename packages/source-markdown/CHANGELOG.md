# @vvitrine/source-markdown

## 1.0.0

### Major Changes

- 0333ef5: First stable release. The plugin API (source, section, theme, service and generator plugins, view kinds, page and
  render contexts), the configuration and the content format are now covered by semantic versioning: a breaking change
  to any of them needs a new major version.

### Minor Changes

- 03f8552: Projects can carry a Markdown case study (`x-vvitrine.body`), shown on their page with styled headings, code, tables and
  images. The new `@vvitrine/source-markdown` reads one Markdown file per project (`content/projects/<slug>.md`, or one per
  language), with the fields in the front matter.

### Patch Changes

- f5dc00e: New `blog` section: articles written in Markdown, listed newest first, each on its own page with its date, reading
  time, tags and a table of contents. Drafts are not published. `@vvitrine/source-markdown` can now be installed once per
  content key (for example projects and posts).
- Updated dependencies [ed5e219]
- Updated dependencies [89d0992]
- Updated dependencies [c3c5dd3]
- Updated dependencies [604893b]
- Updated dependencies [f9534af]
- Updated dependencies [8c0714c]
- Updated dependencies [a815a94]
- Updated dependencies [2fdad94]
- Updated dependencies [8dbb9ab]
- Updated dependencies [0eff61b]
- Updated dependencies [a81ebf1]
- Updated dependencies [1d44e87]
- Updated dependencies [e790d6b]
- Updated dependencies [0333ef5]
  - @vvitrine/core@1.0.0
