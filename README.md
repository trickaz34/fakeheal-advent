# Calendrier de l'Avent · Fakeheal66

Calendrier de l'Avent pour le stream de Fakeheal66 : 24 cases à ouvrir du 1er au 24 décembre, chacune révélant une récompense pour la communauté.

**MVP** : les récompenses de `rewards.js` sont des exemples, sans logique métier.

## Utilisation

Ouvrir `index.html` dans un navigateur (aucune installation, aucun build).

- Une case ne s'ouvre qu'à partir de son jour (minuit, heure locale).
- Clic sur la case → le cadeau apparaît → clic sur le cadeau pour l'ouvrir.
- Musique d'ambiance et effets sonores générés en direct (Web Audio), réglables en haut à droite.

## Mode test

`Ctrl + Maj + D`, 5 clics rapides sur le logo, ou `?dev` dans l'adresse :
date simulée, toutes les cases ouvrables, animations forcées, aperçu par rareté, remise à zéro.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | structure de la page |
| `style.css` | design et animations |
| `app.js` | calendrier, ouverture, mode test |
| `rewards.js` | configuration et liste des récompenses (graine du tirage) |
| `music.js` | musique d'ambiance (« Douce nuit », domaine public) |
| `sfx.js` | effets sonores de l'ouverture |
