---
name: Gestionnaire de bibliothèque
description: Application web de prêt de livres pour une association, avec réservation en ligne.
startDate: 2025-10
endDate: 2026-01
keywords: [TypeScript, Astro, PostgreSQL]
roles: [Développeuse principale (équipe de 4)]
highlights:
  - Architecture hexagonale, 85 % de couverture de tests
  - Conforme RGAA niveau AA
x-vvitrine: { featured: true, repository: https://github.com/example/library }
---

> Projet de démonstration fictif : remplacez ce fichier par votre propre étude de cas.

# Le problème

L'association prêtait environ 300 livres par mois à partir d'un registre papier. Les bénévoles ne savaient pas quels
livres étaient sortis, et les adhérents devaient venir sur place pour en réserver un.

# Ce que nous avons construit

Une application web où les adhérents parcourent le catalogue et réservent un titre, et où les bénévoles enregistrent
prêts et retours depuis un téléphone.

- **Le métier d'abord** : prêts, réservations et pénalités vivent dans un module sans code de framework, testé seul.
- **Des adaptateurs** le relient à PostgreSQL et à l'interface web : l'un ou l'autre peut changer sans toucher aux
  règles.
- **L'accessibilité** a été vérifiée à chaque pull request avec axe, et avec un lecteur d'écran avant chaque version.

```ts
// Un prêt ne peut pas commencer si le livre est réservé par quelqu'un d'autre.
export function canLend(book: Book, member: Member): boolean {
  return book.reservedBy === undefined || book.reservedBy === member.id;
}
```

# Résultats

| Mesure                         | Avant  | Après |
| ------------------------------ | ------ | ----- |
| Temps pour enregistrer un prêt | 3 min  | 20 s  |
| Réservations faites en ligne   | 0 %    | 65 %  |
| Couverture de tests            | aucune | 85 %  |

# Ce que j'en retiens

Garder les règles métier à l'écart du framework a rendu indolore le changement tardif de base de données : un seul
adaptateur a changé, et chaque règle a gardé ses tests.
