# Example plugins

One small, working plugin of each kind, written only against the public API of `@vvitrine/core`, as you would write
your own. Each folder has a README (what it shows and how to use it), the plugin in `src/`, and tests in `test/` that
run in CI with the rest of the project.

| Kind      | Example                                   | What it does                                                                |
| --------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| source    | [`source-github`](source-github/)         | Lists your public GitHub repositories as projects, at build time.           |
| section   | [`section-now`](section-now/)             | A "what I am doing now" section, drawn by any theme.                        |
| theme     | [`theme-minimal`](theme-minimal/)         | The smallest complete theme: a layout, a fallback and design tokens.        |
| service   | [`service-plausible`](service-plausible/) | Plausible Analytics, which sets no cookies, so no consent banner is needed. |
| generator | [`generator-vcard`](generator-vcard/)     | A contact card (`contact.vcf`) that phones can import.                      |

To use one, copy its folder into your project (for example `plugins/`), or install it from this repository, then add
it to `plugins` in `vvitrine.config.ts`. See `docs/plugins.md` for the plugin API.
