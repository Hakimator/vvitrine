---
name: Library manager
description: Book lending web app for a non-profit, with online booking.
startDate: 2025-10
endDate: 2026-01
keywords: [TypeScript, Astro, PostgreSQL]
roles: [Lead developer (team of 4)]
highlights:
  - Hexagonal architecture, 85% test coverage
  - WCAG 2.2 AA compliant
x-vvitrine: { featured: true, repository: https://github.com/example/library }
---

> Fictional demo project: replace this file with your own case study.

# The problem

The non-profit lent about 300 books a month from a paper register. Volunteers could not tell which books were out,
and members had to come in person to reserve one.

# What we built

A web app where members browse the catalogue and book a title, and volunteers record loans and returns from a phone.

- **Domain first**: loans, reservations and late fees live in a core module with no framework code, tested on its own.
- **Adapters** connect it to PostgreSQL and to the web interface, so either can change without touching the rules.
- **Accessibility** was checked at every pull request with axe and with a screen reader before each release.

```ts
// A loan cannot start while the book is reserved by someone else.
export function canLend(book: Book, member: Member): boolean {
  return book.reservedBy === undefined || book.reservedBy === member.id;
}
```

# Results

| Measure                  | Before | After |
| ------------------------ | ------ | ----- |
| Time to record a loan    | 3 min  | 20 s  |
| Reservations made online | 0 %    | 65 %  |
| Test coverage            | none   | 85 %  |

# What I learned

Keeping the business rules away from the framework made the late change of database painless: only one adapter
changed, and every rule kept its tests.
