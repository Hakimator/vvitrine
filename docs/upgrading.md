# Upgrading

Your portfolio only lives in `site/site.yaml`, `site/vvitrine.config.ts`, `site/content/`, `site/plugins/` and
`site/public/`. Framework
files (`packages/`, `themes/`, root configuration) are never edited by users, so updates merge without conflicts.

## From the template repository

```bash
git remote add upstream https://github.com/Hakimator/vvitrine.git   # once
git fetch upstream
git merge upstream/main
pnpm install
pnpm check
```

Read `CHANGELOG.md` files for breaking changes. Major versions come with a migration section below.

## Content schema versions

Content files declare `$schemaVersion: 1`. A new major schema version will document every renamed or removed field here.

## Migration notes

None yet.
