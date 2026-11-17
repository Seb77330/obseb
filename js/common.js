/* OBSeb : fonctions communes (sessions, thèmes, liens vdo.ninja) */
'use strict';

const VDO = 'https://vdo.ninja/';
const HANDLE_DEFAUT = '@sebastian_cineserie';

/* ---------- Thèmes prêts à l'emploi ---------- */
const THEMES = {
  minimal: {
    nom: 'Sebastian (noir et jaune)',
    bg: '#0b0b0d', bg2: '#1a1a1f', accent: '#FFD21F', text: '#ffffff', muted: '#a8a8b0',
    fontTitle: 'Anton', fontBody: 'Montserrat', deco: 'minimal'
  },
  bond: {
    nom: 'Espion (noir et or)',
    bg: '#050505', bg2: '#17130a', accent: '#D4AF37', text: '#f5f1e6', muted: '#9c9480',
    fontTitle: 'Cinzel', fontBody: 'Montserrat', deco: 'barillet'
  },
  heros: {
    nom: 'Super-héros (rouge et bleu)',
    bg: '#070b1a', bg2: '#13214a', accent: '#E62429', text: '#ffffff', muted: '#9fb0d8',
    fontTitle: 'Bangers', fontBody: 'Montserrat', deco: 'trame'
  },
  horreur: {
    nom: 'Horreur (rouge sang)',
    bg: '#070000', bg2: '#250303', accent: '#C1121F', text: '#f2e9e9', muted: '#a07a7a',
    fontTitle: 'Creepster', fontBody: 'Montserrat', deco: 'brume'
  },
  polar: {
    nom: 'Polar (noir et blanc)',
    bg: '#0a0a0a', bg2: '#262626', accent: '#EDEDED', text: '#ffffff', muted: '#9a9a9a',
    fontTitle: 'Special Elite', fontBody: 'Montserrat', deco: 'stores'
  },
  arene: {
    nom: 'Arène (façon Hunger Games)',
    bg: '#0c0a08', bg2: '#2a1608', accent: '#E0892B', text: '#f4ead9', muted: '#a8977f',
    fontTitle: 'Cinzel Decorative', fontBody: 'Montserrat', deco: 'aucun', pack: 'arene', packJs: true
  },
  anime: {
    nom: 'Animation (orange vif)',
    bg: '#120a1f', bg2: '#2b1650', accent: '#FF8A00', text: '#ffffff', muted: '#c6b5e8',
    fontTitle: 'Luckiest Guy', fontBody: 'Montserrat', deco: 'bulles'
  }
};
const FONTS = ['Anton', 'Cinzel Decorative', 'Bebas Neue', 'Cinzel', 'Bangers', 'Creepster', 'Special Elite', 'Luckiest Guy',
  'Playfair Display', 'Oswald', 'Montserrat', 'Abril Fatface', 'Righteous'];

/* ---------- Outils ---------- */
function rnd(n = 8) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x => a[x % a.length]).join('');
}
function slug(s, max = 12) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '').slice(0, max) || 'invite';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function b64e(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64d(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}
function hashParams() {
  return new URLSearchParams(location.hash.replace(/^#/, ''));
}
function queryParams() {
  return new URLSearchParams(location.search);
}

/* ---------- Session ----------
   Une session = un live. Tout est dans le lien (aucun serveur) :
   { v, titre, hote, handle, room, theme:{preset,...surcharges} } */
function nouvelleSession(titre, preset = 'minimal') {
  return {
    v: 1, titre: titre ?? 'Mon live', hote: 'Sebastian', handle: HANDLE_DEFAUT,
    room: 'sebcs' + rnd(10), theme: { preset }, cree: Date.now()
  };
}
function lireSession() {
  const s = hashParams().get('s');
  if (!s) return null;
  try { return b64d(s); } catch (e) { console.error('Lien de session illisible', e); return null; }
}
function themeComplet(session) {
  const t = session.theme || {};
  return Object.assign({}, THEMES[t.preset] || THEMES.minimal, t);
}
function baseUrl() {
  return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
}
function liens(session, cle) {
  const s = b64e(session);
  return {
    regie: `${baseUrl()}regie.html#s=${s}&k=${cle}`,
    invite: `${baseUrl()}invite.html#s=${s}`,
    sortie: `${baseUrl()}sortie.html#s=${s}`
  };
}
const idHote = s => s.room + '_seb';
const idEcran = s => s.room + '_ecran';

/* ---------- Thème -> page ---------- */
function appliquerTheme(theme, el = document.documentElement) {
  const v = {
    '--bg': theme.bg, '--bg2': theme.bg2, '--accent': theme.accent, '--text': theme.text,
    '--muted': theme.muted, '--font-title': `'${theme.fontTitle}', Impact, sans-serif`,
    '--font-body': `'${theme.fontBody}', Arial, sans-serif`
  };
  for (const k in v) el.style.setProperty(k, v[k]);
  el.style.setProperty('--bg-image', theme.bgImage ? `url("${theme.bgImage}")` : 'none');
  el.dataset.deco = theme.deco || 'minimal';
  el.dataset.pack = theme.pack || '';
  chargerPolices([theme.fontTitle, theme.fontBody]);
  if (theme.pack) chargerPack(theme.pack, false);
}
/* Pack de thème : un dossier packs/<nom>/ avec pack.css (et pack.js pour les animations) */
function chargerPack(nom, avecJs) {
  const n = String(nom).replace(/[^a-z0-9-]/gi, '');
  if (!document.getElementById('pack-css-' + n)) {
    const l = document.createElement('link');
    l.id = 'pack-css-' + n; l.rel = 'stylesheet'; l.href = `packs/${n}/pack.css`;
    document.head.appendChild(l);
  }
  if (avecJs && !document.getElementById('pack-js-' + n)) {
    const sc = document.createElement('script');
    sc.id = 'pack-js-' + n; sc.src = `packs/${n}/pack.js`;
    document.body.appendChild(sc);
  }
}
function chargerPolices(liste) {
  const fams = [...new Set(liste.filter(Boolean))];
  const id = 'gf-' + fams.join('-').replace(/\s/g, '');
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' +
    fams.map(f => 'family=' + f.replace(/ /g, '+') + (f === 'Montserrat' ? ':wght@500;700;800;900' : '')).join('&') + '&display=swap';
  document.head.appendChild(l);
}

/* ---------- Liens vdo.ninja ---------- */
function vdo(params) {
  const parts = [];
  for (const [k, val] of Object.entries(params)) {
    if (val === false || val === null || val === undefined) continue;
    parts.push(val === true ? k : `${k}=${encodeURIComponent(val)}`);
  }
  return VDO + '?' + parts.join('&');
}
/* Publier sa caméra dans la salle (invité ou hôte). */
function urlPublier(session, streamId, label, opts = {}) {
  return vdo(Object.assign({
    room: session.room, push: streamId, label, webcam: true, quality: 0, ln: 'fr',
    novideo: true,          // ne reçoit pas la vidéo des autres (économise la connexion)
    cleanish: true
  }, opts));
}
/* Regarder un seul flux (programme, vignettes de régie, aperçu invité). */
function urlVoir(session, streamId, opts = {}) {
  return vdo(Object.assign({
    room: session.room, view: streamId, solo: true, cleanoutput: true, cover: true,
    ln: 'fr', transparent: true
  }, opts));
}
const IFRAME_ALLOW = 'camera *; microphone *; autoplay *; display-capture *; fullscreen *; encrypted-media *';

/* Envoie un ordre à une iframe vdo.ninja */
function ordre(iframe, msg) {
  try { iframe?.contentWindow?.postMessage(msg, '*'); } catch (e) { /* iframe pas prête */ }
}
function niveauSonore(data) {
  // data.loudness peut être un nombre ou un objet {streamID: niveau}
  const l = data.loudness;
  if (typeof l === 'number') return l;
  if (l && typeof l === 'object') return Math.max(0, ...Object.values(l).map(Number).filter(n => !isNaN(n)));
  return 0;
}

/* ---------- Mises en page (scène 1920x1080) ---------- */
const SCENE_W = 1920, SCENE_H = 1080;
const ZONE = { x: 70, y: 70, w: 1780, h: 790 };   // zone vidéo (laisse la place au bandeau)

function grilleCols(n) {
  if (n <= 1) return [1, 1];
  if (n === 2) return [2, 1];
  if (n <= 4) return [2, 2];
  if (n <= 6) return [3, 2];
  if (n <= 9) return [3, 3];
  return [4, 3];
}
/* Rectangle 16:9 le plus grand qui tient dans (w,h), centré */
function fit169(x, y, w, h) {
  let rw = w, rh = w * 9 / 16;
  if (rh > h) { rh = h; rw = h * 16 / 9; }
  return { x: x + (w - rw) / 2, y: y + (h - rh) / 2, w: rw, h: rh };
}
function calculerDisposition(layout, ids, focus, zone = ZONE, gap = 22) {
  const r = {};
  const n = ids.length;
  if (!n) return r;
  if (layout === 'solo') {
    const id = ids.includes(focus) ? focus : ids[0];
    r[id] = fit169(zone.x, zone.y, zone.w, zone.h);
    return r;
  }
  if (layout === 'interview' && n >= 2) {
    const grandW = (zone.w - gap) * 0.7;
    r[ids[0]] = fit169(zone.x, zone.y, grandW, zone.h);
    const reste = ids.slice(1);
    const colX = zone.x + grandW + gap, colW = zone.w - grandW - gap;
    const cellH = (zone.h - gap * (reste.length - 1)) / reste.length;
    reste.forEach((id, i) => { r[id] = fit169(colX, zone.y + i * (cellH + gap), colW, cellH); });
    return r;
  }
  // grille (par défaut) : rangées centrées, dernière rangée centrée
  const [cols, rows] = grilleCols(n);
  const cellW = (zone.w - gap * (cols - 1)) / cols;
  const cellH = (zone.h - gap * (rows - 1)) / rows;
  const t = fit169(0, 0, cellW, cellH);
  const totalH = rows * t.h + (rows - 1) * gap;
  const y0 = zone.y + (zone.h - totalH) / 2;
  ids.forEach((id, i) => {
    const row = Math.floor(i / cols);
    const dansRangee = row === rows - 1 ? n - row * cols : cols;
    const col = i - row * cols;
    const largeur = dansRangee * t.w + (dansRangee - 1) * gap;
    const x0 = zone.x + (zone.w - largeur) / 2;
    r[id] = { x: x0 + col * (t.w + gap), y: y0 + row * (t.h + gap), w: t.w, h: t.h };
  });
  return r;
}
function dispositionPartage(ids, zone = ZONE, gap = 22) {
  const r = {};
  const colW = ids.length ? 360 : 0;
  const ecranW = zone.w - (colW ? colW + gap : 0);
  r.__ecran = fit169(zone.x, zone.y, ecranW, zone.h);
  const max = Math.min(ids.length, 4);
  const cellH = colW * 9 / 16;
  const totalH = max * cellH + (max - 1) * gap;
  const y0 = zone.y + (zone.h - totalH) / 2;
  ids.slice(0, max).forEach((id, i) => {
    r[id] = { x: zone.x + ecranW + gap, y: y0 + i * (cellH + gap), w: colW, h: cellH };
  });
  return r;
}

/* ---------- État envoyé par la régie ---------- */
function etatParDefaut(session) {
  return {
    scene: 'intro', layout: 'grille', onair: [idHote(session)], noms: { [idHote(session)]: session.hote },
    vol: {}, focus: null, bandeau: session.titre, message: '', fin: null, surbrillance: true, ts: Date.now()
  };
}
const CANAL = 'studioSeb';

/* Résumé des statistiques vdo.ninja (format variable selon les versions) :
   on cherche la plus grande résolution « L x H » et le plus grand débit en kbps */
function resumeStats(stats) {
  const r = { w: 0, h: 0, kbps: 0 };
  const racine = (stats && (stats.outbound || stats.outbound_stats)) || stats;
  (function parcourir(o, prof) {
    if (!o || typeof o !== 'object' || prof > 6) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') {
        const m = v.match(/(\d{3,4})\s*x\s*(\d{3,4})/);
        if (m && +m[2] > r.h) { r.w = +m[1]; r.h = +m[2]; }
      } else if (typeof v === 'number' && /bitrate|kbps/i.test(k) && !/audio|target|max/i.test(k)) {
        if (v > r.kbps && v < 100000) r.kbps = Math.round(v);
      } else if (typeof v === 'object') parcourir(v, prof + 1);
      if (/^(height|frameHeight)$/.test(k) && typeof v === 'number' && v > r.h) r.h = v;
      if (/^(width|frameWidth)$/.test(k) && typeof v === 'number' && v > r.w) r.w = v;
    }
  })(racine, 0);
  return r;
}
