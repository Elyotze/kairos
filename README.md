# Kairos · site portfolio

Site statique de présentation du projet **Kairos**, une planification prédictive dynamique pour une ligne d'assemblage. Il contient :

- la page principale ;
- un simulateur d'impact ;
- une démo interactive, dont le moteur tourne dans le navigateur ;
- les mentions légales.

Pas de framework ni d'étape de build, et aucune dépendance : HTML, CSS et JavaScript.

```
site/                      ← dossier publié tel quel
  index.html               page principale
  impact/index.html        simulateur
  demo/index.html          démo interactive
  mentions-legales/        mentions légales
  404.html
  _headers                 en-têtes de sécurité (CSP, HSTS…) appliqués par Cloudflare
  robots.txt, sitemap.xml, .well-known/security.txt
  assets/css|js|fonts|img
tools/
  check.mjs                vérifications avant publication
  og.html                  source de l'image de partage LinkedIn (assets/img/og.png)
```

## 1. Voir le site en local

```bash
npm run dev            # ou : python3 -m http.server 8080 --directory site
```

Ouvre ensuite http://localhost:8080. Les en-têtes de `_headers` ne s'appliquent qu'en ligne.

## 2. Avant la première mise en ligne

1. Remplace les champs `A-COMPLETER` par ton profil LinkedIn, ton e-mail et ton GitHub. Ils se trouvent dans `site/index.html`, `site/mentions-legales/index.html` et `site/.well-known/security.txt`.
2. Si ton domaine n'est pas `kairos.elliotpostel.com`, remplace-le partout. Il apparaît dans les balises `canonical` et `og:` des pages, ainsi que dans `robots.txt`, `sitemap.xml` et `security.txt`.
3. Lance `npm run check`. Le script vérifie :
   - les liens et les ancres ;
   - la compatibilité avec la CSP ;
   - les champs `A-COMPLETER` restants ;
   - les termes confidentiels, à partir de la liste locale `.confidential-terms.txt`. Cette liste n'est jamais publiée.

## 3. Publier sur GitHub

Crée un dépôt, par exemple `kairos`. Il peut être public, ce qui donne aussi le lien GitHub du site. Ensuite :

```bash
git init -b main
git add .
git commit -m "Site Kairos v1"
git remote add origin https://github.com/<ton-compte>/kairos.git
git push -u origin main
```

Vérifie que `.confidential-terms.txt` n'apparaît pas dans `git status` : il est exclu par `.gitignore`.

## 4. Héberger sur Cloudflare Pages (gratuit)

1. Crée un compte sur dash.cloudflare.com.
2. Va dans **Workers & Pages**, puis **Create**, onglet **Pages** et **Connect to Git**. Choisis le dépôt `kairos`.
3. Renseigne les réglages de build :
   - **Framework preset** : None ;
   - **Build command** : `node tools/check.mjs` (la mise en ligne échoue si un lien est cassé) ;
   - **Build output directory** : `site`.
4. Lance le déploiement. Le site est alors en ligne sur `https://<projet>.pages.dev`. Cette adresse n'est pas indexée, grâce à `_headers`.

Chaque `git push` sur `main` redéploie le site automatiquement.

## 5. Nom de domaine

Choix recommandé : `elliotpostel.com`, avec le site Kairos sur `kairos.elliotpostel.com`. Le reste du domaine reste libre pour un futur portfolio.

**Cas 1 : domaine en `.com` acheté chez Cloudflare** (prix coûtant, environ 10 à 11 $ par an)

1. Achète le domaine dans **Domain Registration** puis **Register Domains**. Il est géré automatiquement par Cloudflare.
2. Dans le projet Pages, ouvre **Custom domains**, puis **Set up a custom domain**, et saisis `kairos.elliotpostel.com`.
3. Cloudflare crée l'enregistrement DNS et le certificat HTTPS tout seul, en quelques minutes.

**Cas 2 : domaine en `.fr`** (Cloudflare ne vend pas de `.fr`)

1. Achète-le chez un registrar français, par exemple OVHcloud ou Gandi.
2. Ajoute le domaine dans Cloudflare (offre gratuite), puis remplace les serveurs DNS chez le registrar par ceux que Cloudflare indique.
3. Fais ensuite l'étape 2 du cas 1.
4. Variante sans changer de serveurs DNS : crée chez le registrar un `CNAME kairos → <projet>.pages.dev`, puis ajoute le domaine dans **Custom domains**.

Cloudflare fournit aussi une redirection par e-mail gratuite (Email Routing). Elle permet d'utiliser par exemple `contact@elliotpostel.com` comme adresse publique, transférée vers ta boîte personnelle.

## 6. Après la mise en ligne

- **Sécurité** : lance https://securityheaders.com et https://developer.mozilla.org/en-US/observatory sur ton domaine. Objectif : note A ou mieux.
- **Aperçu LinkedIn** : colle l'URL dans https://www.linkedin.com/post-inspector/ pour vérifier l'image et le titre de partage.
- **Indexation** (facultatif) : ajoute le site dans Google Search Console et soumets `sitemap.xml`.

## Licences

- Polices Geist et Geist Mono : SIL Open Font License 1.1, voir `site/assets/fonts/OFL.txt`.
- Contenu et code : © Elliot Postel.
