# INFO — Infomaniak Stock Ticker

Extension navigateur (Chrome + Firefox, Manifest V3) qui affiche en permanence le cours de l'action **Infomaniak** (ticker `INFO`, SIX Swiss Exchange) :

- **Icône** : pastille bleue avec le logotype « info », badge du prix sur fond **vert** (hausse) / **rouge** (baisse)
- **Popup** : prix, variation absolue et %, ouverture, clôture veille, plus haut/bas, volume, heure de marché, lien vers la page SIX
- **Actualisation** : toutes les **15 minutes** via `chrome.alarms` (au rythme du différé SIX)
- **Données** : API publiques SIX (`fqs/movie.json` + `share_details`), sans clé — cours **différés d'environ 15 minutes**

## Installation

### Chrome / Edge / Brave

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. « Charger l'extension non empaquetée » → sélectionner le dossier `chrome/`

### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`
2. « Charger un module complémentaire temporaire » → sélectionner `firefox/manifest.json`

> Firefox recharge l'extension à chaque redémarrage du navigateur (module temporaire).

## Structure

```
chrome/     variante Chrome (service worker MV3)
firefox/    variante Firefox (event page MV3, min. Firefox 115)
lib/        logique partagée (parsing FQS, formats fr-CH, tendance)
popup/      popup (cours détaillé + actualisation manuelle)
tools/      tests (node tools/test-quote.mjs) et génération d'icônes
fixtures/   réponse FQS d'exemple pour les tests
```

## Tests

```bash
node tools/test-quote.mjs
```

## Notes

- Projet personnel, non affilié à Infomaniak ni à SIX.
- Les variantes `chrome/` et `firefox/` sont volontairement autonomes (chargement direct sans étape de build).
