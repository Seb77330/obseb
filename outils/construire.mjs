// Construit la version publiée de MESA dans dist/ :
// JS et CSS compactés et brouillés (noms locaux raccourcis, commentaires retirés),
// HTML sans commentaires. Les fichiers internes (serveur/, outils Python, notes) ne sont pas publiés.
// Les noms globaux partagés entre fichiers sont gardés : esbuild ne renomme que les noms locaux.
//
// Protection du code :
//   - chaque fichier publié porte une bannière « tous droits réservés » et une empreinte unique ;
//   - option --obfusquer : brouille à fond les fichiers clés (régie, sortie, commun, diffusion)
//     avec javascript-obfuscator. Désactivée par défaut (plus lourde à exécuter) ; à mesurer
//     sur une vraie machine avant de la mettre en ligne.
//
//   node outils/construire.mjs                (compact simple, comme avant)
//   node outils/construire.mjs --obfusquer    (fichiers clés brouillés à fond)
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

// --- Protection ---------------------------------------------------------
// Bannière légale (preuve d'auteur), posée en tête de chaque fichier publié.
const ANNEE = new Date().getFullYear();
const BANNIERE = `/* MESA (c) ${ANNEE} Sebastian — Tous droits réservés. Reproduction, réutilisation et redistribution interdites. */\n`;
// Empreinte unique et discrète, propre à ce projet. Elle sert à reconnaître ton code
// dans un clone : cherche cette chaîne dans n'importe quelle copie suspecte.
const EMPREINTE = 'MESA-3b7331c2f62dd20b';
const marqueJs = `\n/*#${EMPREINTE}#*/\n`;

// Option --obfusquer : fichiers clés brouillés à fond (le reste reste en compact simple).
const OBFUSQUER = process.argv.includes('--obfusquer');
const FICHIERS_CLES = new Set(['js/regie.js', 'js/sortie.js', 'js/common.js', 'js/diffusion.js']);
let obfusque = null;
if (OBFUSQUER) {
  try {
    obfusque = (await import('javascript-obfuscator')).default;
  } catch {
    console.error('javascript-obfuscator introuvable. Lance d\'abord : npm install');
    process.exit(1);
  }
}
// Réglages volontairement légers : pas de controlFlowFlattening ni de debugProtection,
// qui ralentissent beaucoup une page vivante comme la régie. On brouille les noms et les
// chaînes, on garde la vitesse.
const reglagesObf = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  deadCodeInjection: false,
  controlFlowFlattening: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
};
// ------------------------------------------------------------------------

let n = { js: 0, css: 0, html: 0, autres: 0 }, obf = 0, avant = 0, apres = 0;

async function traiter(rel) {
  const src = path.join(RACINE, rel), dst = path.join(SORTIE, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  const ext = path.extname(rel);
  if ((ext === '.js' || ext === '.css') && !deja(rel)) {
    const code = await fs.readFile(src, 'utf8');
    let out = (await transform(code, { loader: ext.slice(1), minify: true, legalComments: 'none', charset: 'utf8', target: 'es2020' })).code;
    if (ext === '.js' && obfusque && FICHIERS_CLES.has(rel)) {
      out = obfusque.obfuscate(out, reglagesObf).getObfuscatedCode();
      obf++;
    }
    out = BANNIERE + out + (ext === '.js' ? marqueJs : '');
    await fs.writeFile(dst, out); avant += code.length; apres += out.length; n[ext.slice(1)]++;
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
console.log(`dist/ prêt : ${n.js} JS, ${n.css} CSS, ${n.html} HTML, ${n.autres} autres`
  + (OBFUSQUER ? `, dont ${obf} fichiers clés brouillés à fond` : '')
  + `. Code : ${Math.round(avant / 1024)} Ko → ${Math.round(apres / 1024)} Ko.`);
