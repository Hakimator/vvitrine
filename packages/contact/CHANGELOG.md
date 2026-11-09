# @vvitrine/contact

## 1.0.0

### Major Changes

- 0333ef5: First stable release. The plugin API (source, section, theme, service and generator plugins, view kinds, page and
  render contexts), the configuration and the content format are now covered by semantic versioning: a breaking change
  to any of them needs a new major version.

### Minor Changes

- c3c5dd3: New `@vvitrine/contact` package: a contact section with a plain HTML form (no JavaScript, nothing sent until the visitor
  presses "Send") delivered through Web3Forms by default, a honeypot against spam, a privacy notice, a "Message sent"
  page, and the e-mail address as a fallback. Other providers implement the small `ContactProvider` interface. Sections
  now receive the absolute site URL (`ctx.siteUrl`).
- f9534af: The e-mail address is no longer written plainly in the pages. New `protectEmail()` in `@vvitrine/core` returns a
  percent-encoded `mailto:` link and the visible text with hidden decoy parts, so harvesters miss it while visitors still
  see, click, copy and hear the real address, without JavaScript. `HeroView.email` and `ContactView.email` now use this
  shape (breaking for custom themes that drew `email.address`).
- 0eff61b: Privacy page generated from the plugins. Plugins declare the visitor data they handle with `privacy(ctx)` (service,
  purpose, when, data, retention, location, cookies, terms), and the new `privacy` section lists them with the host and
  the person responsible. Pages with `footer: true` are linked from the footer (`nav.footer`) instead of the header. Both
  themes now have a footer with these links and a copyright line. The contact form declares what it sends to Web3Forms.

### Patch Changes

- ed5e219: Generated reference. `docs/reference.md` (every configuration, content and option field) and
  `docs/content.schema.json` (for editors that check YAML as you type) are generated from the schemas with
  `pnpm reference`, and a test fails when they are out of date. `@vvitrine/core` exports `ConfigSchema`, and the schemas
  now describe their fields.
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
