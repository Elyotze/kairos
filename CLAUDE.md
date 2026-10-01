# Kairos · notes pour Claude Code

Site statique de présentation d'un projet de planification prédictive dynamique (RCPSP multi-compétences, hub de données, solveur, IA, agent). Il est déployé sur Cloudflare Pages depuis `site/`, sans étape de build. Le contenu est en français.

## Règles impératives

- **Confidentialité.** Le projet est présenté de façon générique. N'ajoute jamais de nom d'entreprise, de site, de programme ou de produit réel, de code interne ni de chiffre réel. Lance `npm run check` après toute modification de texte : ce script compare le site à la liste locale `.confidential-terms.txt`. Ne cite jamais le contenu de cette liste dans un fichier publié, un commit ou une issue.
- **Honnêteté.** Aucun gain, client ou déploiement inventé. Les tableaux de bord, les scénarios et le simulateur Impact restent marqués « illustration » ou « hypothèses à calibrer ».
- **CSP stricte** (`site/_headers`) :
  - pas de `<script>` inline ni d'attributs `onclick=` : le JavaScript va dans `site/assets/js/` et se branche par `addEventListener` ;
  - aucune ressource externe : les polices sont auto-hébergées et il n'y a ni CDN ni analytics ;
  - les attributs `style` inline sont autorisés.
- **Données personnelles.** Pas de cookie, de traceur ni de formulaire. Seul `localStorage` est autorisé, pour la préférence d'animation (`kx-motion`). Toute nouveauté sur ce point impose de mettre à jour les mentions légales.

## Conventions

- **Style.** Fond `#0A0A0B`, textes `#EDEDEC`, `#9A9A97` et `#8A8A87`, bordures `#1F1F22` et `#2E2E33`. L'accent `#E5484D` est réservé aux aléas et aux points saillants. Polices Geist et Geist Mono.
- **Animations.** Elles passent par les classes `a-*` de `site/assets/css/site.css`, actives seulement sous `.kx-on`. Le bouton `[data-motion-toggle]` (`assets/js/common.js`) bascule `.kx-on` / `.kx-off`, et `prefers-reduced-motion` est respecté.
- **Accessibilité.** Cibles tactiles d'au moins 44 px, `:focus-visible` visible, `aria-label` sur les schémas, contrastes AA. Pas de défilement horizontal à 390 px de large.
- **Simulateur.** `site/impact/index.html` lie ses valeurs par `data-t` (texte), `data-b` (attributs) et `data-s` (styles), calculées dans `assets/js/impact.js`.
- **Démo.** `assets/js/demo-engine.js` contient le moteur, sans DOM, et `assets/js/demo-app.js` l'interface. Toutes les données sont fictives. La prévision d'absence reste agrégée par équipe, jamais nominative.

## Commandes

- `npm run dev` : serveur local sur http://localhost:8080.
- `npm run check` : liens, ancres, CSP, termes confidentiels, champs `A-COMPLETER` (`--strict` en fait des erreurs).
- Image de partage : régénérer `site/assets/img/og.png` en capturant `tools/og.html` à 1200 × 630.
