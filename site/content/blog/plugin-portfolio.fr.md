---
title: Construire un portfolio à base de plugins
date: 2026-11-07
summary: Pourquoi chaque partie de ce site, des sections au thème, est un plugin.
tags: [Architecture, Astro]
---

> Article de démonstration fictif : remplacez les fichiers de `content/blog/` par les vôtres.

# Pourquoi tout est un plugin

La plupart des modèles de portfolio mélangent votre contenu et leur code. Mettre le modèle à jour revient alors à
fusionner votre CV dans les composants de quelqu'un d'autre. Ici, le framework ne connaît que des plugins : les
sources chargent le contenu, les sections le transforment en vues, et un thème les dessine.

# Un contenu qui appartient aux plugins

Chaque section possède la partie du contenu qu'elle affiche et la vérifie. Une faute dans une date fait échouer la
construction en indiquant le fichier et la ligne, au lieu de produire une page vide.

```ts
plugins: [yamlSource(), corporate(), hero(), projects(), blog()],
```

# Des formes partagées

La plupart des sections sont des listes d'entrées datées, des groupes de mots-clés ou des citations. Un thème dessine
chaque forme une seule fois, et toute nouvelle section qui en utilise une s'affiche bien dans tous les thèmes.

# Ce que j'en retiens

Écrire les contrats d'abord a pris plus de temps, mais ajouter une section prend maintenant une heure au lieu d'une
journée.
