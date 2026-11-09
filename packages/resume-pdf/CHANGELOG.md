# @vvitrine/resume-pdf

## 1.0.0

### Major Changes

- 0333ef5: First stable release. The plugin API (source, section, theme, service and generator plugins, view kinds, page and
  render contexts), the configuration and the content format are now covered by semantic versioning: a breaking change
  to any of them needs a new major version.

### Minor Changes

- a81ebf1: Printable resume and PDF. New `@vvitrine/resume-pdf` generator: an A4, tagged PDF of your resume page in each
  language, built from the same data. Both themes print on A4 without navigation or buttons, and printing always uses the
  light colours. Generators now receive each route's `page` and section views. The hero's `cv` option accepts `{locale}`.

### Patch Changes

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
