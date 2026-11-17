/* OBSeb : fonctions communes (sessions, thèmes, liens vdo.ninja) */
'use strict';

const VDO = 'https://vdo.ninja/';
const HANDLE_DEFAUT = '@sebastian_cineserie';

/* ---------- Thèmes prêts à l'emploi ---------- */
const THEMES = {
  minimal: {
    nom: 'Sebastian (noir et jaune)',
    bg: '#0b0b0d', bg2: '#1a1a1f', accent: '#FFD21F', text: '#ffffff', muted: '#a8a8b0',
    fontTitle: 'Outfit', fontBody: 'Inter', deco: 'minimal'
  },
  bond: {
    nom: 'Espion (noir et or)',
    bg: '#050505', bg2: '#17130a', accent: '#D4AF37', text: '#f5f1e6', muted: '#9c9480',
    fontTitle: 'Cinzel', fontBody: 'Inter', deco: 'barillet'
  },
  heros: {
    nom: 'Super-héros (rouge et bleu)',
    bg: '#070b1a', bg2: '#13214a', accent: '#E62429', text: '#ffffff', muted: '#9fb0d8',
    fontTitle: 'Bangers', fontBody: 'Inter', deco: 'trame'
  },
  horreur: {
    nom: 'Horreur (rouge sang)',
    bg: '#070000', bg2: '#250303', accent: '#C1121F', text: '#f2e9e9', muted: '#a07a7a',
    fontTitle: 'Creepster', fontBody: 'Inter', deco: 'brume'
  },
  polar: {
    nom: 'Polar (noir et blanc)',
    bg: '#0a0a0a', bg2: '#262626', accent: '#EDEDED', text: '#ffffff', muted: '#9a9a9a',
    fontTitle: 'Special Elite', fontBody: 'Inter', deco: 'stores'
  },
  arene: {
    nom: 'Arène (façon Hunger Games)',
    bg: '#0c0a08', bg2: '#2a1608', accent: '#E0892B', text: '#f4ead9', muted: '#a8977f',
    fontTitle: 'Cinzel Decorative', fontBody: 'Inter', deco: 'aucun', pack: 'arene', packJs: true
  },
  anime: {
    nom: 'Animation (orange vif)',
    bg: '#120a1f', bg2: '#2b1650', accent: '#FF8A00', text: '#ffffff', muted: '#c6b5e8',
    fontTitle: 'Luckiest Guy', fontBody: 'Inter', deco: 'bulles'
  }
};
// Polices fines en premier ; les plus grasses restent disponibles pour certains thèmes
const FONTS = ['Outfit', 'Inter', 'Cormorant Garamond', 'Marcellus', 'Italiana', 'Cinzel', 'Josefin Sans', 'DM Serif Display',
  'Fraunces', 'Space Grotesk', 'Playfair Display', 'Cinzel Decorative', 'Bebas Neue', 'Oswald', 'Montserrat',
  'Special Elite', 'Creepster', 'Bangers', 'Luckiest Guy', 'Anton', 'Abril Fatface', 'Righteous'];
const POIDS_POLICES = { Inter: '400;500;600;700', Outfit: '300;400;500;600', Montserrat: '500;700;800', 'Josefin Sans': '300;400;600',
  'Cormorant Garamond': '400;500;600', 'Space Grotesk': '400;500;600', Fraunces: '300;400;600' };

/* ---------- Affichage de l'interface : auto / sombre / clair, daltonien, contraste, taille ---------- */
const CLE_AFFICHAGE = 'studioSeb:affichage';
function lireAffichage() {
  try { return Object.assign({ mode: 'sombre', daltonien: false, contraste: false, taille: 'normal' }, JSON.parse(localStorage.getItem(CLE_AFFICHAGE) || '{}')); }
  catch (e) { return { mode: 'sombre', daltonien: false, contraste: false, taille: 'normal' }; }
}
function appliquerAffichage(a = lireAffichage()) {
  const r = document.documentElement;
  const clair = a.mode === 'clair' || (a.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  if (clair) r.dataset.mode = 'clair'; else delete r.dataset.mode;
  if (a.daltonien) r.dataset.daltonien = ''; else delete r.dataset.daltonien;
  if (a.contraste) r.dataset.contraste = ''; else delete r.dataset.contraste;
  r.dataset.taille = a.taille;
}
/* Bouton « Affichage » : petit menu avec les réglages, mémorisés dans ce navigateur */
function boutonAffichage(conteneur) {
  const box = document.createElement('div'); box.className = 'bouton-affichage';
  box.innerHTML = `<button type="button" title="Affichage : mode clair, sombre, daltonien…">Affichage</button>
    <div class="affichage-pop" hidden>
      <div class="titre-pop">Thème de l'interface</div>
      <div class="segment" data-r="mode"><button data-v="auto">Auto</button><button data-v="sombre">Sombre</button><button data-v="clair">Clair</button></div>
      <label><span>Mode daltonien<small>Bleu et orange au lieu de vert et rouge</small></span><input type="checkbox" data-r="daltonien"></label>
      <label><span>Contraste élevé<small>Textes et contours plus marqués</small></span><input type="checkbox" data-r="contraste"></label>
      <div class="titre-pop">Taille du texte</div>
      <div class="segment" data-r="taille"><button data-v="normal">Normale</button><button data-v="grand">Grande</button></div>
    </div>`;
  const pop = box.querySelector('.affichage-pop');
  const maj = () => {
    const a = lireAffichage();
    pop.querySelectorAll('.segment').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('actif', a[sg.dataset.r] === b.dataset.v)));
    pop.querySelectorAll('input[data-r]').forEach(i => { i.checked = !!a[i.dataset.r]; });
  };
  const changer = (k, v) => { const a = lireAffichage(); a[k] = v; try { localStorage.setItem(CLE_AFFICHAGE, JSON.stringify(a)); } catch (e) { /* rien */ } appliquerAffichage(a); maj(); };
  pop.querySelectorAll('.segment button').forEach(b => b.onclick = () => changer(b.parentElement.dataset.r, b.dataset.v));
  pop.querySelectorAll('input[data-r]').forEach(i => i.onchange = () => changer(i.dataset.r, i.checked));
  box.firstElementChild.onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; maj(); };
  document.addEventListener('click', e => { if (!box.contains(e.target)) pop.hidden = true; });
  conteneur.appendChild(box);
  return box;
}
if (!/sortie\.html/.test(location.pathname)) {
  appliquerAffichage();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => appliquerAffichage());
}

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
/* Images importées depuis le PC : gardées dans le lien OBS et la régie, retirées du lien invités (trop long à partager) */
function sansImagesLocales(session) {
  const t = Object.assign({}, session.theme);
  for (const k of Object.keys(t)) if (typeof t[k] === 'string' && t[k].startsWith('data:')) delete t[k];
  return Object.assign({}, session, { theme: t });
}
function liens(session, cle) {
  const s = b64e(session);
  const sInvite = b64e(sansImagesLocales(session));
  return {
    regie: `${baseUrl()}regie.html#s=${s}&k=${cle}`,
    invite: `${baseUrl()}invite.html#s=${sInvite}`,
    sortie: `${baseUrl()}sortie.html#s=${s}`,
    vertical: `${baseUrl()}sortie.html?format=vertical#s=${s}`
  };
}
const idHote = s => s.room + '_seb';
const idEcran = (s, n = 1) => s.room + '_ecran' + n;   // tes partages d'écran : 1 à 4
const estEcran = id => /_ecran\d$|ecr$/.test(id);

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
    fams.map(f => 'family=' + f.replace(/ /g, '+') + (POIDS_POLICES[f] ? ':wght@' + POIDS_POLICES[f] : '')).join('&') + '&display=swap';
  document.head.appendChild(l);
}

/* ---------- Transport vidéo : serveur OBSeb (LiveKit) ou vdo.ninja ----------
   Avec un serveur OBSeb dans la session (session.serveur), les fenêtres vidéo passent par lk.html,
   qui parle le même langage que vdo.ninja et y bascule tout seul si le serveur ne répond pas. */
function transportSession() {
  const s = (typeof lireSession === 'function' && location.hash.includes('s=')) ? lireSession() : null;
  return s && s.serveur ? { serveur: s.serveur } : null;
}
function vdo(params) {
  const t = transportSession();
  const p = Object.assign({}, params);
  if (t) {
    p.lk = t.serveur;
    // l'animateur et ses partages d'écran prouvent qu'ils sont bien l'animateur avec la clé de la régie
    const k = hashParams().get('k');
    if (k && p.push && /_(seb|ecran\d)$/.test(p.push)) p.cle = k;
  }
  const parts = [];
  for (const [k, val] of Object.entries(p)) {
    if (val === false || val === null || val === undefined) continue;
    parts.push(val === true ? k : `${k}=${encodeURIComponent(val)}`);
  }
  return (t ? baseUrl() + 'lk.html' : VDO) + '?' + parts.join('&');
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
    room: session.room, view: streamId, scene: true, cleanoutput: true, cover: true,
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
  if (n <= 12) return [4, 3];
  return [5, 3];   // jusqu'à 13 : toi + 12 invités
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
    const nc = reste.length > 4 ? 2 : 1, nr = Math.ceil(reste.length / nc);
    const cw = (colW - gap * (nc - 1)) / nc, cellH = (zone.h - gap * (nr - 1)) / nr;
    reste.forEach((id, i) => { r[id] = fit169(colX + (i % nc) * (cw + gap), zone.y + Math.floor(i / nc) * (cellH + gap), cw, cellH); });
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
/* Scène Partage : jusqu'à 4 sources (écrans, images, vidéos, pages web) + colonne de caméras */
function dispositionPartage(ids, sources = ['__ecran'], zone = ZONE, gap = 22) {
  const r = {};
  const nc = Math.min(3, Math.ceil(ids.length / 4));
  const colW = ids.length ? [360, 480, 540][nc - 1] : 0;
  const zoneW = zone.w - (colW ? colW + gap : 0);
  const n = sources.length;
  if (n === 1) r[sources[0]] = fit169(zone.x, zone.y, zoneW, zone.h);
  else if (n === 2) {
    const w = (zoneW - gap) / 2;
    sources.forEach((k, i) => { r[k] = fit169(zone.x + i * (w + gap), zone.y, w, zone.h); });
  } else if (n > 2) {
    const w = (zoneW - gap) / 2, h = (zone.h - gap) / 2;
    const t = fit169(0, 0, w, h);
    const x0 = zone.x + (zoneW - (2 * t.w + gap)) / 2, y0 = zone.y + (zone.h - (2 * t.h + gap)) / 2;
    sources.slice(0, 4).forEach((k, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      // 3 sources : la dernière centrée sur la 2e ligne
      const dx = n === 3 && i === 2 ? (t.w + gap) / 2 : 0;
      r[k] = { x: x0 + col * (t.w + gap) + dx, y: y0 + row * (t.h + gap), w: t.w, h: t.h };
    });
  }
  const max = Math.min(ids.length, 13);
  const g2 = 12, cw = (colW - g2 * (nc - 1)) / (nc || 1), cellH = cw * 9 / 16;
  const nr = Math.ceil(max / (nc || 1));
  const totalH = nr * cellH + (nr - 1) * g2;
  const y0 = zone.y + (zone.h - totalH) / 2;
  ids.slice(0, max).forEach((id, i) => {
    r[id] = { x: zone.x + zoneW + gap + (i % nc) * (cw + g2), y: y0 + Math.floor(i / nc) * (cellH + g2), w: cw, h: cellH };
  });
  return r;
}

/* ---------- Format vertical (1080x1920, TikTok, Shorts) ---------- */
const SCENE_VW = 1080, SCENE_VH = 1920;
/* Zones sûres du vertical : en haut, TikTok/Instagram affichent ton profil et les spectateurs (0-230 px) ;
   en bas, les commentaires et le champ de saisie (à partir de ~1360 px) ; à droite, les boutons (cadeaux, partage).
   Les visages restent entre 400 et 1320 px, le bandeau juste en dessous de l'en-tête. */
const SURES_V = { haut: 230, bas: 1360, droite: 120 };
const ZONE_V = { x: 40, y: 400, w: 1080 - 40 - SURES_V.droite, h: 920 };   // marge à droite pour les boutons
function grilleV(n) {
  if (n <= 1) return [1, 1];
  if (n <= 3) return [1, n];
  if (n === 4) return [2, 2];
  if (n <= 6) return [2, 3];
  if (n <= 8) return [2, 4];
  if (n === 9) return [3, 3];
  if (n <= 12) return [3, 4];
  return [4, 4];
}
/* Grille de cellules qui remplissent la zone (les vidéos sont recadrées) */
function grilleCellules(ids, x, y, w, h, gap, [cols, rows]) {
  const r = {};
  const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  ids.forEach((id, i) => {
    const row = Math.floor(i / cols);
    const dansRangee = row === rows - 1 ? ids.length - row * cols : cols;
    const col = i - row * cols;
    const x0 = x + (w - (dansRangee * cw + (dansRangee - 1) * gap)) / 2;
    r[id] = { x: x0 + col * (cw + gap), y: y + row * (ch + gap), w: cw, h: ch };
  });
  return r;
}
function calculerDispositionV(layout, ids, focus, zone = ZONE_V, gap = 18) {
  const n = ids.length;
  if (!n) return {};
  if (layout === 'solo') {
    const id = ids.includes(focus) ? focus : ids[0];
    return { [id]: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
  }
  if (layout === 'interview' && n >= 2) {
    const hautH = zone.h * 0.56;
    const r = { [ids[0]]: { x: zone.x, y: zone.y, w: zone.w, h: hautH } };
    const reste = ids.slice(1);
    const g = reste.length <= 2 ? [reste.length, 1] : [2, Math.ceil(reste.length / 2)];
    return Object.assign(r, grilleCellules(reste, zone.x, zone.y + hautH + gap, zone.w, zone.h - hautH - gap, gap, g));
  }
  return grilleCellules(ids, zone.x, zone.y, zone.w, zone.h, gap, grilleV(n));
}
function dispositionPartageV(ids, sources, zone = ZONE_V, gap = 18) {
  const r = {};
  const n = sources.length;
  let hautH = 0;
  if (n === 1) { hautH = zone.w * 9 / 16; r[sources[0]] = { x: zone.x, y: zone.y, w: zone.w, h: hautH }; }
  else if (n >= 2) {
    const w = (zone.w - gap) / 2, h = w * 9 / 16;
    const rows = Math.ceil(Math.min(n, 4) / 2);
    hautH = rows * h + (rows - 1) * gap;
    sources.slice(0, 4).forEach((k, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const dx = n === 3 && i === 2 ? (w + gap) / 2 : 0;
      r[k] = { x: zone.x + col * (w + gap) + dx, y: zone.y + row * (h + gap), w, h };
    });
  }
  if (ids.length) {
    const y = zone.y + hautH + (hautH ? gap : 0), h = zone.h - (y - zone.y);
    const m = Math.min(ids.length, 13);
    const nc = m <= 2 ? m : m <= 6 ? 2 : m <= 9 ? 3 : 4;
    Object.assign(r, grilleCellules(ids.slice(0, m), zone.x, y, zone.w, h, gap, [nc, Math.ceil(m / nc)]));
  }
  return r;
}

/* Pendant un quiz : tout le monde en rangée(s) en haut, le panneau du quiz dessous (jamais sur un visage) */
const ZONE_QUIZ = { x: 70, y: 40, w: 1780, h: 620 };   // les visages gardent presque la moitié de l'écran
const ZONE_QUIZ_V = { x: 40, y: 240, w: 1080 - 40 - SURES_V.droite, h: 560 };
function dispositionQuiz(ids, vertical) {
  const n = ids.length; if (!n) return {};
  const z = vertical ? ZONE_QUIZ_V : ZONE_QUIZ, gap = 12;
  const rows = vertical ? (n <= 4 ? 1 : n <= 8 ? 2 : 3) : (n <= 7 ? 1 : 2);
  const cols = Math.ceil(n / rows);
  if (vertical) return grilleCellules(ids, z.x, z.y, z.w, z.h, gap, [cols, rows]);
  const cw = (z.w - gap * (cols - 1)) / cols, ch = (z.h - gap * (rows - 1)) / rows;
  const t = fit169(0, 0, cw, ch), r = {};
  ids.forEach((id, i) => {
    const row = Math.floor(i / cols), dans = row === rows - 1 ? n - row * cols : cols, col = i - row * cols;
    const x0 = z.x + (z.w - (dans * t.w + (dans - 1) * gap)) / 2;
    r[id] = { x: x0 + col * (t.w + gap), y: z.y + row * (t.h + gap), w: t.w, h: t.h };
  });
  return r;
}

/* ---------- État envoyé par la régie ---------- */
function etatParDefaut(session) {
  return {
    scene: 'intro', layout: 'grille', onair: [idHote(session)], noms: { [idHote(session)]: session.hote },
    vol: {}, focus: null, bandeau: session.titre, message: '', fin: null, surbrillance: true,
    sources: [], bandeaux: [], bandeauActif: null, defilant: { texte: '', actif: false },
    playlist: [], musique: { idx: 0, lecture: false, n: 0 }, ts: Date.now()
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
