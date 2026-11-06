# Changesets

Every pull request that changes a package adds a changeset: run `pnpm changeset`, pick the packages and the
SemVer bump (patch / minor / major), and describe the change for users. Versions and `CHANGELOG.md` files are
generated from these notes when a release is prepared (`pnpm changeset version`).
