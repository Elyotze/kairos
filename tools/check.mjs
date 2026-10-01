#!/usr/bin/env node
// Vérifications avant mise en ligne (aucune dépendance) :
//   - liens internes et ancres valides
//   - compatibilité avec la CSP stricte (_headers) : pas de script inline, pas de onclick=…, pas de ressource externe
//   - termes confidentiels (liste locale .confidential-terms.txt, jamais publiée)
//   - champs « A-COMPLETER » restants (avertissement ; erreur avec --strict)
// Usage : node tools/check.mjs [--strict]
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const strict = process.argv.includes('--strict');
const errors = [];
const warnings = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(SITE);
const htmlFiles = files.filter((f) => extname(f) === '.html');
const textFiles = files.filter((f) => ['.html', '.css', '.js', '.txt', '.xml', ''].includes(extname(f)) && !f.endsWith('OFL.txt'));
const rel = (f) => relative(ROOT, f);

function resolveTarget(fromFile, url) {
  const clean = url.split('#')[0].split('?')[0];
  let p = clean.startsWith('/') ? join(SITE, clean) : join(dirname(fromFile), clean);
  if (clean === '' ) p = fromFile;
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  return p;
}
const idsCache = new Map();
function idsOf(file) {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  // CSP: no inline scripts or inline event handlers
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\ssrc=/.test(m[1]) && m[2].trim()) errors.push(`${rel(file)} : script inline (bloqué par la CSP)`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*\son[a-z]+\s*=/gi)) errors.push(`${rel(file)} : gestionnaire inline « ${m[0].slice(0, 60)}… » (bloqué par la CSP)`);
  // external resources (src / stylesheet / preload) are blocked by the CSP
  for (const m of html.matchAll(/<(?:script|img|iframe|source|video|audio)\b[^>]*\ssrc="(https?:)?\/\/[^"]+"/g)) errors.push(`${rel(file)} : ressource externe « ${m[0].slice(0, 80)} »`);
  for (const m of html.matchAll(/<link\b[^>]*\shref="(https?:)?\/\/[^"]+"[^>]*>/g)) {
    if (/rel="(stylesheet|preload|preconnect|icon|apple-touch-icon)"/.test(m[0])) errors.push(`${rel(file)} : ressource externe « ${m[0].slice(0, 80)} »`);
  }
  // internal links and anchors
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
    if (url.startsWith('#')) {
      if (url.length > 1 && !idsOf(file).has(url.slice(1))) errors.push(`${rel(file)} : ancre introuvable ${url}`);
      continue;
    }
    const target = resolveTarget(file, url);
    if (!existsSync(target)) { errors.push(`${rel(file)} : lien cassé ${url}`); continue; }
    const hash = url.split('#')[1];
    if (hash && extname(target) === '.html' && !idsOf(target).has(hash)) errors.push(`${rel(file)} : ancre introuvable ${url}`);
  }
}

// confidential terms: local list only (gitignored), one term or regex per line
const termsFile = join(ROOT, '.confidential-terms.txt');
if (existsSync(termsFile)) {
  const terms = readFileSync(termsFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const scanned = [...textFiles, join(ROOT, 'README.md'), join(ROOT, 'CLAUDE.md')].filter(existsSync);
  for (const file of scanned) {
    const text = readFileSync(file, 'utf8');
    for (const t of terms) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
      if (re.test(text)) errors.push(`${rel(file)} : terme confidentiel « ${t} »`);
    }
  }
} else {
  warnings.push('.confidential-terms.txt absent : contrôle de confidentialité ignoré (normal sur Cloudflare)');
}

// placeholders
for (const file of textFiles) {
  const n = (readFileSync(file, 'utf8').match(/A-COMPLETER/g) || []).length;
  if (n) (strict ? errors : warnings).push(`${rel(file)} : ${n} champ(s) A-COMPLETER à renseigner`);
}

warnings.forEach((w) => console.log('⚠ ' + w));
errors.forEach((e) => console.log('✖ ' + e));
console.log(errors.length ? `\n${errors.length} erreur(s).` : `\nOK : ${htmlFiles.length} pages vérifiées, aucune erreur.`);
process.exit(errors.length ? 1 : 0);
