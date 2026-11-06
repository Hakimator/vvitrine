## What and why

<!-- Link the issue / user story: Closes #123 -->

## Definition of Done

- [ ] Title follows Conventional Commits (`feat(sections): ...`, `fix: ...`)
- [ ] Unit tests added or updated; `pnpm test:coverage` stays above the thresholds
- [ ] Works in every configured language; new UI strings are in plugin `messages` (fr + en)
- [ ] No accessibility regression (`pnpm e2e` includes axe checks)
- [ ] Docs updated (`docs/`) if behaviour or configuration changed
- [ ] Changeset added (`pnpm changeset`) if a package changed
- [ ] `pnpm check` passes locally
