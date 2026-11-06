# Contributing to VVitrine

Thank you for helping. This guide explains how to set up the project, the rules we follow and how changes are reviewed.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # once, for end-to-end tests
pnpm dev                                # demo site at http://localhost:4321
```

## Before opening a pull request

```bash
pnpm check
```

This runs, in order: formatting, lint, type checks, architecture rules, unit tests with coverage, the three demo
builds and the end-to-end tests (including accessibility). CI runs the same steps on Linux and Windows, plus Lighthouse.

## Rules

- **Plugins first.** A new feature should be a plugin whenever possible. The kernel (`packages/core`) changes only
  when a capability cannot be expressed with the plugin API; open an issue first.
- **Architecture boundaries** (checked by `pnpm boundaries`):
  - `@vvitrine/core` imports nothing from Astro, Node file APIs or other VVitrine packages.
  - Plugins and themes import `@vvitrine/core` only through its public entry point.
  - Framework code never imports from `site/`.
- **Clean code:** small functions, intention-revealing names, typed errors with an actionable message (what, where, how
  to fix), no `console.log`.
- **Tests:** every behaviour change comes with a unit test; user-visible changes with an end-to-end test.
  Coverage thresholds: 80 % lines and functions.
- **i18n:** never hard-code a visible string. Add it to the plugin `messages` for every supported locale (fr, en).
- **Accessibility:** WCAG 2.2 AA. axe must report no violations in light and dark mode.
- **Commits and PR titles:** [Conventional Commits](https://www.conventionalcommits.org), e.g.
  `feat(sections): add awards section`, `fix(seo): respect base path in sitemap`.
- **Changesets:** run `pnpm changeset` when a package changes, to record the SemVer bump and the changelog entry.

## Workflow

GitHub Flow: branch from `main` (`feat/<issue>-short-name`), open a pull request, get one review, squash-merge.
`main` is always deployable.

## Reporting a security problem

See [SECURITY.md](SECURITY.md). Please do not open a public issue.
