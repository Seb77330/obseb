// Construit la version publiée de MESA dans dist/ :
// JS et CSS compactés et brouillés (noms locaux raccourcis, commentaires retirés),
// HTML sans commentaires. Les fichiers internes (serveur/, outils Python, notes) ne sont pas publiés.
// Les noms globaux partagés entre fichiers sont gardés : esbuild ne renomme que les noms locaux.
import { transform } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SORTIE = path.join(RACINE, 'dist');
const EXCLUS = new Set(['.git', '.github', 'dist', 'node_modules', 'serveur', 'package.json', 'package-lock.json', '.gitignore']);
const exclu = (rel) => {
  const base = rel.split('/')[0];
  if (EXCLUS.has(base)) return true;
  if (rel.endsWith('.md') || rel.endsWith('.py')) return true;
  if (rel === 'outils/construire.mjs') return true;
  return false;
};
const deja = (rel) => rel.startsWith('js/vendor/') || /\.min\.(js|css)$/.test(rel);

let n = { js: 0, css: 0, html: 0, autres: 0 }, avant = 0, apres = 0;

async function traiter(rel) {
  const src = path.join(RACINE, rel), dst = path.join(SORTIE, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  const ext = path.extname(rel);
  if ((ext === '.js' || ext === '.css') && !deja(rel)) {
    const code = await fs.readFile(src, 'utf8');
    const r = await transform(code, { loader: ext.slice(1), minify: true, legalComments: 'none', charset: 'utf8', target: 'es2020' });
    await fs.writeFile(dst, r.code); avant += code.length; apres += r.code.length; n[ext.slice(1)]++;
  } else if (ext === '.html') {
    let h = await fs.readFile(src, 'utf8');
    const t = h.length;
    h = h.replace(/<!--(?!\[if)[\s\S]*?-->/g, '').replace(/\n\s*\n+/g, '\n').replace(/^[ \t]+/gm, '');
    await fs.writeFile(dst, h); avant += t; apres += h.length; n.html++;
  } else { await fs.copyFile(src, dst); n.autres++; }
}

async function parcourir(dir = '') {
  for (const e of await fs.readdir(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (exclu(rel)) continue;
    if (e.isDirectory()) await parcourir(rel); else await traiter(rel);
  }
}

await fs.rm(SORTIE, { recursive: true, force: true });
await parcourir();
// En-têtes de sécurité et de cache (Cloudflare Pages)
await fs.writeFile(path.join(SORTIE, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
/js/*
  Cache-Control: public, max-age=31536000, immutable
/css/*
  Cache-Control: public, max-age=31536000, immutable
`);
console.log(`dist/ prêt : ${n.js} JS, ${n.css} CSS, ${n.html} HTML, ${n.autres} autres. Code : ${Math.round(avant / 1024)} Ko → ${Math.round(apres / 1024)} Ko.`);
