/* OBSeb : fonctions communes (sessions, thèmes, liens vdo.ninja) */
'use strict';

const VDO = 'https://vdo.ninja/';
const HANDLE_DEFAUT = '@sebastian_cineserie';

/* ---------- Thèmes prêts à l'emploi ---------- */
const THEMES = {
  minimal: {
    nom: 'Sebastian', desc: 'Ta signature : noir et jaune, net et lisible.',
    bg: '#0b0b0d', bg2: '#1a1a1f', accent: '#FFD21F', text: '#ffffff', muted: '#a8a8b0',
    fontTitle: 'Outfit', fontBody: 'Inter', deco: 'minimal'
  },
  bond: {
    nom: 'Espion', desc: 'Noir et or, façon générique de film d\'espionnage.',
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
  studio: {
    nom: 'Studio', desc: 'Sobre et moderne : gris anthracite, touche bleue.',
    bg: '#0e1013', bg2: '#1b2129', accent: '#5AB0FF', text: '#f4f6f8', muted: '#9aa4b1',
    fontTitle: 'Space Grotesk', fontBody: 'Inter', deco: 'aucun'
  },
  cinema: {
    nom: 'Cinéma', desc: 'Élégant : noir profond, rouge velours, titres fins.',
    bg: '#0a0607', bg2: '#2a0b10', accent: '#D7263D', text: '#f6efe6', muted: '#b39f97',
    fontTitle: 'Cormorant Garamond', fontBody: 'Inter', deco: 'aucun'
  },
  neon: {
    nom: 'Néon', desc: 'Nuit électrique : rose et violet.',
    bg: '#07051a', bg2: '#22104a', accent: '#FF3EA5', text: '#ffffff', muted: '#b6a8e0',
    fontTitle: 'Outfit', fontBody: 'Inter', deco: 'aucun'
  },
  clair: {
    nom: 'Clair', desc: 'Lumineux et éditorial : fond crème, texte noir.',
    bg: '#f4f1ea', bg2: '#e4ddcf', accent: '#1d1d1f', text: '#141414', muted: '#6b6559',
    fontTitle: 'Fraunces', fontBody: 'Inter', deco: 'aucun'
  },
  anime: {
    nom: 'Animation (orange vif)',
    bg: '#120a1f', bg2: '#2b1650', accent: '#FF8A00', text: '#ffffff', muted: '#c6b5e8',
    fontTitle: 'Luckiest Guy', fontBody: 'Inter', deco: 'bulles'
  },
  /* Chaque thème ci-dessous change aussi la forme des cadres (forme), l'étiquette des noms (etiquette),
     le bandeau du bas (bandeau), le fond (fond, deco) et la casse des titres (casse). */
  jt: {
    nom: 'Journal télé', desc: 'Façon JT : bleu nuit, grand bandeau en bas, rouge direct.',
    bg: '#071226', bg2: '#12305f', accent: '#E11D2E', accent2: '#3B82F6', text: '#ffffff', muted: '#a9b8d4',
    fontTitle: 'Barlow Condensed', fontBody: 'Barlow', deco: 'monde', forme: 'net', etiquette: 'bas', bandeau: 'barre'
  },
  retro: {
    nom: 'Rétro 80', desc: 'Synthwave : soleil couchant et grille néon.',
    bg: '#12021f', bg2: '#3b0a57', accent: '#FF2E97', accent2: '#21E6F0', text: '#ffffff', muted: '#c9a7e8',
    fontTitle: 'Audiowide', fontBody: 'Inter', deco: 'grille', forme: 'neon', etiquette: 'plein', bandeau: 'ligne', fond: 'horizon'
  },
  vaisseau: {
    nom: 'Vaisseau', desc: 'Passerelle de vaisseau : affichage tête haute, angles coupés.',
    bg: '#03121a', bg2: '#0a2c3a', accent: '#22D3EE', accent2: '#F59E0B', text: '#e6fbff', muted: '#7fb4c2',
    fontTitle: 'Orbitron', fontBody: 'Rajdhani', deco: 'hud', forme: 'biseau', etiquette: 'plein', bandeau: 'boite'
  },
  cosmos: {
    nom: 'Cosmos', desc: 'Ciel étoilé, titres larges et fins.',
    bg: '#04040c', bg2: '#141433', accent: '#B9A6FF', accent2: '#4f46e5', text: '#f3f1ff', muted: '#9c98c4',
    fontTitle: 'Michroma', fontBody: 'Inter', deco: 'etoiles', forme: 'doux', etiquette: 'ligne', bandeau: 'centre', fond: 'uni'
  },
  terminal: {
    nom: 'Terminal', desc: 'Écran de hacker : vert sur noir, police machine.',
    bg: '#020603', bg2: '#06170b', accent: '#39FF7A', text: '#d6ffe3', muted: '#5fae79',
    fontTitle: 'VT323', fontBody: 'IBM Plex Mono', deco: 'scan', forme: 'ecran', etiquette: 'console', bandeau: 'ligne'
  },
  arcade: {
    nom: 'Arcade', desc: 'Borne de jeu rétro : pixels et gros scores.',
    bg: '#0d0221', bg2: '#261447', accent: '#FFE600', accent2: '#00E5FF', text: '#ffffff', muted: '#a99bd6',
    fontTitle: 'Press Start 2P', fontBody: 'Inter', deco: 'pixels', forme: 'pixel', etiquette: 'pixel', bandeau: 'classique', fond: 'uni'
  },
  manga: {
    nom: 'Manga', desc: 'Lignes de vitesse, noir, blanc et rouge.',
    bg: '#0a0a0a', bg2: '#1c1c1c', accent: '#ff1f3d', text: '#ffffff', muted: '#b5b5b5',
    fontTitle: 'Dela Gothic One', fontBody: 'Inter', deco: 'vitesse', forme: 'incline', etiquette: 'plein', bandeau: 'etiquette', fond: 'uni'
  },
  pop: {
    nom: 'Pop art', desc: 'Jaune vif et traits noirs épais, comme une case de BD.',
    bg: '#ffd93b', bg2: '#ffb703', accent: '#e4002b', text: '#111111', muted: '#5a4a00',
    fontTitle: 'Bungee', fontBody: 'Inter', deco: 'rayons', forme: 'dur', etiquette: 'plein', bandeau: 'etiquette', fond: 'uni'
  },
  western: {
    nom: 'Western', desc: 'Affiche de saloon : bois, cuir et lettres à empattements.',
    bg: '#1c0f07', bg2: '#4a2710', accent: '#E2A64B', text: '#f3e2c4', muted: '#b89a72',
    fontTitle: 'Rye', fontBody: 'Inter', deco: 'papier', forme: 'photo', etiquette: 'plein', bandeau: 'classique', fond: 'lineaire'
  },
  fantasy: {
    nom: 'Fantasy', desc: 'Parchemin et enluminures, pour les grandes sagas.',
    bg: '#e8d9b8', bg2: '#d2bd90', accent: '#7a1f1f', text: '#2a1a0e', muted: '#6f5a3d',
    fontTitle: 'Almendra', fontBody: 'Inter', deco: 'parchemin', forme: 'photo', etiquette: 'ligne', bandeau: 'centre', casse: 'normal', fond: 'lineaire'
  },
  artdeco: {
    nom: 'Gala', desc: 'Art déco, émeraude et or : soirée de remise de prix.',
    bg: '#04160f', bg2: '#0d3a2a', accent: '#E3C16F', text: '#f6efd9', muted: '#9fb3a5',
    fontTitle: 'Poiret One', fontBody: 'Inter', deco: 'artdeco', forme: 'cadre', etiquette: 'ligne', bandeau: 'centre'
  },
  gazette: {
    nom: 'Gazette', desc: 'La une d\'un journal : papier, encre noire et filets.',
    bg: '#efeae0', bg2: '#e2dccd', accent: '#111111', accent2: '#b3261e', text: '#141414', muted: '#5d574c',
    fontTitle: 'Abril Fatface', fontBody: 'Inter', deco: 'colonnes', forme: 'net', etiquette: 'plein', bandeau: 'ligne', casse: 'normal', fond: 'uni'
  },
  pastel: {
    nom: 'Douceur', desc: 'Pastel et tout en rondeurs.',
    bg: '#fdeff4', bg2: '#e6e0ff', accent: '#ff6fa3', accent2: '#7c9cff', text: '#3a2a4a', muted: '#8a7a9a',
    fontTitle: 'Fredoka', fontBody: 'Nunito', deco: 'confettis', forme: 'doux', etiquette: 'capsule', bandeau: 'boite', casse: 'normal', fond: 'lineaire'
  },
  stade: {
    nom: 'Stade', desc: 'Soir de match : pelouse et tableau d\'affichage.',
    bg: '#062414', bg2: '#0f4a26', accent: '#C6FF3D', text: '#ffffff', muted: '#9cc4a7',
    fontTitle: 'Teko', fontBody: 'Barlow', deco: 'pelouse', etiquette: 'bas', bandeau: 'barre'
  }
};
// Polices fines en premier ; les plus grasses restent disponibles pour certains thèmes
/* Thèmes mis en avant dans la galerie ; les autres restent dans « Plus de thèmes » */
const GALERIE = ['minimal', 'studio', 'cinema', 'bond', 'neon', 'clair', 'jt', 'retro', 'vaisseau'];
/* L'ordre de toute la galerie (les thèmes mis en avant, puis les autres) */
const ORDRE_THEMES = [...GALERIE, 'cosmos', 'terminal', 'arcade', 'manga', 'pop', 'heros', 'anime', 'horreur', 'polar', 'western', 'fantasy', 'artdeco', 'arene', 'gazette', 'pastel', 'stade'];
const FONTS = ['Outfit', 'Inter', 'Cormorant Garamond', 'Marcellus', 'Italiana', 'Cinzel', 'Josefin Sans', 'DM Serif Display',
  'Fraunces', 'Space Grotesk', 'Playfair Display', 'Cinzel Decorative', 'Bebas Neue', 'Oswald', 'Montserrat',
  'Special Elite', 'Creepster', 'Bangers', 'Luckiest Guy', 'Anton', 'Abril Fatface', 'Righteous',
  'Barlow Condensed', 'Teko', 'Poiret One', 'Almendra', 'Rye', 'Fredoka', 'Audiowide', 'Orbitron', 'Michroma', 'VT323', 'Bungee', 'Dela Gothic One', 'Press Start 2P'];
/* Certaines polices sont très larges ou très étroites : on ajuste la taille des titres, et leur graisse */
const ECHELLE_POLICES = { 'Press Start 2P': .44, Michroma: .64, Orbitron: .76, Audiowide: .78, Bungee: .76, 'Dela Gothic One': .78, Rye: .84, Fredoka: .92,
  'Abril Fatface': .92, 'Barlow Condensed': 1.14, Teko: 1.22, VT323: 1.2 };
const POIDS_TITRE = { 'Barlow Condensed': 700, Orbitron: 700, Teko: 600, Fredoka: 600 };
const POIDS_POLICES = { 'Barlow Condensed': '500;600;700', Barlow: '400;500;600;700', 'IBM Plex Mono': '400;500;600', Orbitron: '500;700', Rajdhani: '500;600;700', Fredoka: '400;500;600', Nunito: '400;600;700', Teko: '400;500;600',
  Inter: '400;500;600;700', Outfit: '300;400;500;600', Montserrat: '500;700;800', 'Josefin Sans': '300;400;600',
  'Cormorant Garamond': '400;500;600', 'Space Grotesk': '400;500;600', Fraunces: '300;400;500' };

/* ---------- Affichage de l'interface : auto / sombre / clair, daltonien, contraste, taille ---------- */
const CLE_AFFICHAGE = 'studioSeb:affichage';
function lireAffichage() {
  try { return Object.assign({ mode: 'sombre', couleur: 'jaune', daltonien: false, contraste: false, taille: 'normal' }, JSON.parse(localStorage.getItem(CLE_AFFICHAGE) || '{}')); }
  catch (e) { return { mode: 'sombre', couleur: 'jaune', daltonien: false, contraste: false, taille: 'normal' }; }
}
function appliquerAffichage(a = lireAffichage()) {
  const r = document.documentElement;
  const clair = a.mode === 'clair' || (a.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  if (clair) r.dataset.mode = 'clair'; else delete r.dataset.mode;
  if (/^(bleu|gris|blanc)$/.test(a.couleur)) r.dataset.couleur = a.couleur; else delete r.dataset.couleur;     // jaune : la couleur d'origine
  if (a.daltonien) r.dataset.daltonien = ''; else delete r.dataset.daltonien;
  if (a.contraste) r.dataset.contraste = ''; else delete r.dataset.contraste;
  r.dataset.taille = a.taille;
}
/* Bouton « Affichage » : petit menu avec les réglages, mémorisés dans ce navigateur */
function boutonAffichage(conteneur) {
  const box = document.createElement('div'); box.className = 'bouton-affichage';
  box.innerHTML = `<button type="button" title="Affichage : mode clair, sombre, daltonien…"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none"/></svg><span>Affichage</span></button>
    <div class="affichage-pop" hidden>
      <div class="titre-pop">Thème de l'interface</div>
      <div class="segment" data-r="mode"><button data-v="auto">Auto</button><button data-v="sombre">Sombre</button><button data-v="clair">Clair</button></div>
      <div class="titre-pop">Couleur des boutons</div>
      <div class="couleurs" data-r="couleur"><button type="button" data-v="jaune" style="--c:#FFD21F"><i></i>Jaune</button><button type="button" data-v="bleu" style="--c:#4DA3FF"><i></i>Bleu</button><button type="button" data-v="gris" style="--c:#AEB6C2"><i></i>Gris</button><button type="button" data-v="blanc" style="--c:#ffffff"><i></i><span>Blanc</span></button></div>
      <label><span>Mode daltonien<small>Bleu et orange au lieu de vert et rouge</small></span><input type="checkbox" data-r="daltonien"></label>
      <label><span>Contraste élevé<small>Textes et contours plus marqués</small></span><input type="checkbox" data-r="contraste"></label>
      <div class="titre-pop">Taille du texte</div>
      <div class="segment" data-r="taille"><button data-v="normal">Normale</button><button data-v="grand">Grande</button></div>
    </div>`;
  const pop = box.querySelector('.affichage-pop');
  const maj = () => {
    const a = lireAffichage();
    pop.querySelectorAll('.segment, .couleurs').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('actif', a[sg.dataset.r] === b.dataset.v)));
    pop.querySelectorAll('input[data-r]').forEach(i => { i.checked = !!a[i.dataset.r]; });
    pop.querySelector('.couleurs [data-v=blanc] span').textContent = document.documentElement.dataset.mode === 'clair' ? 'Noir' : 'Blanc';     // sur fond clair, le blanc devient noir
  };
  const changer = (k, v) => { const a = lireAffichage(); a[k] = v; try { localStorage.setItem(CLE_AFFICHAGE, JSON.stringify(a)); } catch (e) { /* rien */ } appliquerAffichage(a); maj(); };
  pop.querySelectorAll('.segment button, .couleurs button').forEach(b => b.onclick = () => changer(b.parentElement.dataset.r, b.dataset.v));
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
/* Sécurité : le nom de la salle est tiré de la clé de la régie (PBKDF2, 100 000 tours ; même calcul dans serveur/moteur.js).
   Le serveur peut ainsi vérifier que c'est bien l'animateur, sans rien retenir, et personne ne peut lui prendre sa place. */
async function salleDepuisCle(cle) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(cle), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('obseb-salle-v1'), iterations: 100000, hash: 'SHA-256' }, base, 96));
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  return 'sebk' + Array.from(bits, x => a[x % 32]).join('');
}
function nouvelleSession(titre, preset = 'minimal') {
  return {
    v: 1, titre: titre ?? 'Mon live', hote: 'Sebastian', handle: HANDLE_DEFAUT, limite: 135,
    room: 'sebcs' + rnd(10), theme: { preset }, cree: Date.now()
  };
}
/* ----- Un live programmé : sa date en clair, le temps qu'il reste, et le rendez-vous pour l'agenda ----- */
function quandTexte(ts) {
  const d = new Date(ts), j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return j.charAt(0).toUpperCase() + j.slice(1) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function dansTexte(ts) {
  const min = Math.round((ts - Date.now()) / 60000);
  if (min < -10) return 'heure dépassée';
  if (min <= 5) return 'c\'est l\'heure';
  if (min < 60) return `dans ${min} min`;
  const jour = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const jours = Math.round((jour(ts) - jour(Date.now())) / 86400000);
  if (jours === 0) return `aujourd'hui, dans ${Math.round(min / 60)} h`;
  return jours === 1 ? 'demain' : `dans ${jours} jours`;
}
function telechargerAgenda(session, lien) {
  if (!session.debut) return;
  const z = t => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const echap = s => String(s).replace(/([\;,])/g, '\\$1').replace(/\n/g, '\\n');
  const plier = l => l.match(/.{1,72}/g).join('\r\n ');          // une ligne d'agenda ne dépasse pas 75 caractères
  const fin = session.debut + Math.min(session.limite || 120, 240) * 60000;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OBSeb//Live//FR', 'BEGIN:VEVENT', `UID:${session.room}@obseb`, `DTSTAMP:${z(Date.now())}`,
    `DTSTART:${z(session.debut)}`, `DTEND:${z(fin)}`, `SUMMARY:${echap('Live : ' + session.titre)}`,
    `DESCRIPTION:${echap('Avec ' + session.hote + (lien ? '\nTon lien : ' + lien : ''))}`, lien ? `URL:${lien}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Le live commence dans 15 minutes', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR']
    .filter(Boolean).map(plier).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = `live-${slug(session.titre, 30) || 'obseb'}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/* Un code QR en SVG (js/vendor/qrcode.js). Vide si le texte est trop long pour un code. */
function svgQR(texte, niveau = 'M') {
  if (typeof qrcode !== 'function' || !texte) return '';
  let q;
  try { q = qrcode(0, niveau); q.addData(String(texte)); q.make(); } catch (e) { return ''; }
  const n = q.getModuleCount(), m = 2;       // marge blanche de 2 cases : la carte blanche autour fait le reste
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c)) continue;
    let l = 1; while (c + l < n && q.isDark(r, c + l)) l++;      // les cases voisines sont dessinées d'un seul trait
    d += `M${c + m} ${r + m}h${l}v1h-${l}z`; c += l - 1;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img" aria-label="Code QR"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
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
    // la sortie (OBS) porte la clé : avec le serveur OBSeb, seul l'animateur peut regarder les coulisses sans être vu
    sortie: `${baseUrl()}sortie.html#s=${s}&k=${cle}`,
    vertical: `${baseUrl()}sortie.html?format=vertical#s=${s}&k=${cle}`,
    // « Je garde mon OBS » : les caméras seules, sur fond transparent
    cameras: `${baseUrl()}sortie.html?decor=0#s=${s}&k=${cle}`,
    camerasVertical: `${baseUrl()}sortie.html?decor=0&format=vertical#s=${s}&k=${cle}`
  };
}
const idHote = s => s.room + '_seb';
const idCam = (s, n) => s.room + '_cam' + n;             // tes autres caméras, branchées sur ce PC : 2 à 4
const estCamLocale = id => /_cam\d$/.test(id);
const estCamDistante = id => /_rc_[a-z0-9]{6}$/.test(id);   // caméra à distance (téléphone, autre PC)
const estMaCamera = id => /_seb$/.test(id) || estCamLocale(id) || estCamDistante(id);
/* Scènes où l'on voit les caméras */
const sceneCameras = sc => sc === 'live' || sc === 'partage' || sc === 'watch';
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
  // fond clair : pas d'ombres sombres ni de vignette
  const m = /^#?([0-9a-f]{6})$/i.exec(theme.bg || '');
  const lum = m ? (parseInt(m[1].slice(0, 2), 16) * 299 + parseInt(m[1].slice(2, 4), 16) * 587 + parseInt(m[1].slice(4, 6), 16) * 114) / 255000 : 0;
  if (lum > 0.6) el.dataset.clair = ''; else delete el.dataset.clair;
  // forme des cadres, étiquette des noms, bandeau, casse des titres, style de fond
  el.dataset.forme = theme.forme || 'arrondi'; el.dataset.etiquette = theme.etiquette || 'barre'; el.dataset.bandeau = theme.bandeau || 'classique';
  el.dataset.casse = theme.casse || 'maj'; el.dataset.fond = theme.fond || 'radial';
  const ma = /^#?([0-9a-f]{6})$/i.exec(theme.accent || '');
  const lumA = ma ? (parseInt(ma[1].slice(0, 2), 16) * 299 + parseInt(ma[1].slice(2, 4), 16) * 587 + parseInt(ma[1].slice(4, 6), 16) * 114) / 255000 : 0;
  el.style.setProperty('--sur-accent', lumA > 0.6 ? '#111111' : '#ffffff');
  el.style.setProperty('--accent2', theme.accent2 || theme.accent);
  el.style.setProperty('--kt', ECHELLE_POLICES[theme.fontTitle] || 1);
  el.style.setProperty('--pt', POIDS_TITRE[theme.fontTitle] || 400);
  el.dataset.pack = theme.pack || '';
  el.dataset.plateau = plateauDe(theme);
  el.dataset.logo = /^(hg|hd|bg|bd)$/.test(theme.logoPlace) ? theme.logoPlace : 'bg';   // coin où se pose le logo
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
    // l'animateur (sa caméra, ses écrans, sa régie, sa sortie OBS) prouve qui il est avec la clé de la régie ;
    // l'aperçu d'un invité dit pour qui il regarde (le serveur vérifie que cet invité a bien été admis)
    const h = hashParams(), k = h.get('k'), moi = h.get('moi');
    if (k && (!p.push || /_(seb|ecran\d|cam\d)$/.test(p.push))) p.cle = k;
    else if (moi && !p.push) p.pour = moi;
  }
  const parts = [];
  for (const [k, val] of Object.entries(p)) {
    if (val === false || val === null || val === undefined) continue;
    parts.push(val === true ? k : `${k}=${encodeURIComponent(val)}`);
  }
  return (t ? baseUrl() + 'lk.html' : VDO) + '?' + parts.join('&');
}
/* Publier sa caméra dans la salle (invité ou hôte). */
/* La même demande pour TOUTES les caméras, sans rien supposer de l'appareil : quality=0, « du 1080p si tu peux ».
   La salle essaie le 1080p et, si la caméra refuse, redescend toute seule (720p, puis 360p…). Vérifié le 17/11 avec
   six fausses caméras (4K, 1080p, capteur large, webcam 720p, vieille 640 x 480, 4/3) : chacune démarre, au mieux
   de ce qu'elle sait faire.
   JAMAIS de width / height ni de qualité choisie d'après une mesure : imposés, ils bloquent la caméra qui ne sait
   pas les faire (panne du 17/11 au matin) ; devinés, ils brident celle qui sait faire mieux. */
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
  return [4, 3];   // jusqu'à 11 : toi + 10 invités
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
/* ---------- Plateau « mur » : la signature du studio ----------
   Un seul écran partagé au lieu de cartes flottantes : les caméras remplissent toute la zone, collées les unes
   aux autres par un joint fin (elles sont recadrées, jamais déformées), et chaque rangée occupe toute la largeur.
   C'est le plateau de tous les thèmes qui n'ont pas de cadre à eux (forme, pack). */
const ZONE_MUR = { x: 70, y: 70, w: 1780, h: 826 };   // descend jusqu'au socle du titre, qui s'y colle
const JOINT_MUR = 6;
const plateauDe = theme => theme.plateau || (theme.forme || theme.pack ? 'cartes' : 'mur');   // un thème qui dessine ses propres cadres les garde
/* Combien de caméras par rangée : le découpage où la caméra la plus recadrée l'est le moins
   (une image trop large coupe les têtes : elle compte un peu plus qu'une image trop étroite) */
function rangeesMur(n, w, h, gap) {
  let mieux = null;
  for (let R = 1; R <= n; R++) {
    const base = Math.floor(n / R), plus = n % R, ch = (h - gap * (R - 1)) / R;
    const rangs = Array.from({ length: R }, (_, i) => base + (i >= R - plus ? 1 : 0));   // les rangées les moins pleines en haut : toi en plus grand
    const pire = Math.max(...rangs.map(k => {
      const ratio = (w - gap * (k - 1)) / k / ch;
      return ratio > 16 / 9 ? Math.log(ratio / (16 / 9)) * 1.3 : Math.log(16 / 9 / ratio);
    }));
    if (!mieux || pire < mieux.pire - 1e-9) mieux = { rangs, pire };
  }
  return mieux.rangs;
}
function mosaique(ids, zone, gap) {
  const r = {};
  if (!ids.length) return r;
  const rangs = rangeesMur(ids.length, zone.w, zone.h, gap);
  const ch = (zone.h - gap * (rangs.length - 1)) / rangs.length;
  let i = 0;
  rangs.forEach((k, row) => {
    const cw = (zone.w - gap * (k - 1)) / k;
    for (let col = 0; col < k; col++) r[ids[i++]] = { x: zone.x + col * (cw + gap), y: zone.y + row * (ch + gap), w: cw, h: ch };
  });
  return r;
}
function dispositionMur(layout, ids, focus, zone, vertical = false, gap = JOINT_MUR) {
  const n = ids.length;
  if (!n) return {};
  if (layout === 'solo') return { [ids.includes(focus) ? focus : ids[0]]: { x: zone.x, y: zone.y, w: zone.w, h: zone.h } };
  // une grande image et les autres à côté : en interview, et à trois (trois colonnes couperaient les épaules)
  if (n >= 2 && (layout === 'interview' || (n === 3 && !vertical))) {
    const reste = ids.slice(1);
    if (vertical) {
      const hautH = Math.round((zone.h - gap) * 0.56);
      return Object.assign({ [ids[0]]: { x: zone.x, y: zone.y, w: zone.w, h: hautH } }, mosaique(reste, { x: zone.x, y: zone.y + hautH + gap, w: zone.w, h: zone.h - hautH - gap }, gap));
    }
    const grandW = Math.round((zone.w - gap) * 0.62);
    return Object.assign({ [ids[0]]: { x: zone.x, y: zone.y, w: grandW, h: zone.h } }, mosaique(reste, { x: zone.x + grandW + gap, y: zone.y, w: zone.w - grandW - gap, h: zone.h }, gap));
  }
  return mosaique(ids, zone, gap);
}

/* ---------- Les six cadrages ----------
   grille, interview, solo (plus haut) et trois autres : vedette (une personne en grand, les autres en bande dessous),
   incrust (une personne en plein cadre, les autres en médaillons posés dessus) et duel (deux personnes face à face,
   séparées par une diagonale). Une case peut porter `z` (elle passe au-dessus) et `pts` (son contour, en pixels
   depuis son coin : la sortie en fait une découpe). `mur` : caméras collées et recadrées ; sinon cartes 16:9. */
const CADRAGES = ['grille', 'interview', 'solo', 'vedette', 'incrust', 'duel'];
function dispositionCadrage(layout, ids, focus, zone, { vertical = false, mur = false } = {}) {
  const n = ids.length, gap = mur ? JOINT_MUR : vertical ? 18 : 22;
  const classique = l => vertical ? (mur ? dispositionMur(l, ids, focus, zone, true) : calculerDispositionV(l, ids, focus, zone))
    : (mur ? dispositionMur(l, ids, focus, zone) : calculerDisposition(l, ids, focus, zone));
  if (!['vedette', 'incrust', 'duel'].includes(layout)) return classique(layout);
  if (n < 2) return classique('solo');
  const r = {};
  const plein = z => mur || vertical ? { x: z.x, y: z.y, w: z.w, h: z.h } : fit169(z.x, z.y, z.w, z.h);
  /* les autres, en bande sous la grande image */
  const bande = (reste, y, h) => {
    if (!reste.length) return;
    if (vertical) { const c = Math.min(reste.length, 3); Object.assign(r, grilleCellules(reste, zone.x, y, zone.w, h, gap, [c, Math.ceil(reste.length / c)])); return; }
    const w = Math.min((zone.w - gap * (reste.length - 1)) / reste.length, h * (mur ? 2.1 : 16 / 9)), hh = mur ? h : Math.min(h, w * 9 / 16);
    const x0 = zone.x + (zone.w - (reste.length * w + (reste.length - 1) * gap)) / 2;
    reste.forEach((id, i) => { r[id] = { x: x0 + i * (w + gap), y: y + (h - hh) / 2, w, h: hh }; });
  };
  if (layout === 'vedette') {
    const hautH = Math.round((zone.h - gap) * (vertical ? 0.62 : 0.72));
    r[ids[0]] = plein({ x: zone.x, y: zone.y, w: zone.w, h: hautH });
    bande(ids.slice(1), zone.y + hautH + gap, zone.h - hautH - gap);
    return r;
  }
  if (layout === 'incrust') {
    const g = r[ids[0]] = plein(zone), reste = ids.slice(1), marge = vertical ? 18 : 26, e = vertical ? 12 : 16;
    const parRang = vertical ? 3 : 4, k = Math.min(reste.length, parRang);      // jamais jusqu'au nom de la personne en grand, en bas à gauche
    const w = Math.min(g.w * (vertical ? 0.3 : 0.2), (g.w - 2 * marge - e * (k - 1)) / k), h = w * (vertical ? 1 : 9 / 16);
    reste.forEach((id, i) => {
      const rang = Math.floor(i / parRang), dans = Math.min(parRang, reste.length - rang * parRang), col = i - rang * parRang;
      r[id] = { x: g.x + g.w - marge - (dans - col) * w - (dans - 1 - col) * e, y: g.y + g.h - marge - (rang + 1) * h - rang * e, w, h, z: 2 };
    });
    return r;
  }
  // duel : les deux premières personnes face à face ; s'il y en a d'autres, elles passent en bande dessous
  const reste = ids.slice(2), H = reste.length ? Math.round((zone.h - gap) * 0.72) : zone.h, j = Math.max(gap, 8) / 2;
  if (vertical) {
    const d = Math.round(H * 0.08), a = (H + d) / 2;
    r[ids[0]] = { x: zone.x, y: zone.y, w: zone.w, h: a, pts: [[0, 0], [zone.w, 0], [zone.w, a - d - j], [0, a - j]] };
    r[ids[1]] = { x: zone.x, y: zone.y + H - a, w: zone.w, h: a, pts: [[0, d + j], [zone.w, j], [zone.w, a], [0, a]] };
  } else {
    const d = Math.round(zone.w * 0.09), a = (zone.w + d) / 2;
    r[ids[0]] = { x: zone.x, y: zone.y, w: a, h: H, pts: [[0, 0], [a - j, 0], [a - d - j, H], [0, H]] };
    r[ids[1]] = { x: zone.x + zone.w - a, y: zone.y, w: a, h: H, pts: [[d + j, 0], [a, 0], [a, H], [j, H]] };
  }
  bande(reste, zone.y + H + gap, zone.h - H - gap);
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
  const max = Math.min(ids.length, 11);
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
    const m = Math.min(ids.length, 11);
    const nc = m <= 2 ? m : m <= 6 ? 2 : m <= 9 ? 3 : 4;
    Object.assign(r, grilleCellules(ids.slice(0, m), zone.x, y, zone.w, h, gap, [nc, Math.ceil(m / nc)]));
  }
  return r;
}

/* Pendant un quiz, trois dispositions au choix (etat.quiz.dispo) :
   « centre » (par défaut) : jusqu'à 4 personnes, les caméras en rangée et la question juste dessous, de la même largeur ;
                             à partir de 5, la question au milieu, les caméras réparties au-dessus et en dessous ;
   « plein »  : la question en très grand, les caméras en petite rangée en bas ;
   « bas »    : les caméras en grand, la question en bandeau en bas.
   Renvoie la place de chaque caméra, plus `__panneau` : la place de la question (absente en « bas » et en vertical). */
const ZONE_QUIZ = { x: 70, y: 40, w: 1780, h: 620 };   // disposition « bas »
const ZONE_QUIZ_V = { x: 40, y: 240, w: 1080 - 40 - SURES_V.droite, h: 560 };
function rangeeCentree(ids, y, w, h, gap, r) {
  const total = ids.length * w + (ids.length - 1) * gap, x0 = (SCENE_W - total) / 2;
  ids.forEach((id, i) => { r[id] = { x: x0 + i * (w + gap), y, w, h }; });
  return total;
}
function dispositionQuiz(ids, vertical, dispo = 'centre') {
  const n = ids.length; if (!n) return {};
  const r = {};
  if (vertical || dispo === 'bas') {
    const z = vertical ? ZONE_QUIZ_V : ZONE_QUIZ, gap = 12;
    const rows = vertical ? (n <= 4 ? 1 : n <= 8 ? 2 : 3) : (n <= 7 ? 1 : 2);
    const cols = Math.ceil(n / rows);
    if (vertical) return grilleCellules(ids, z.x, z.y, z.w, z.h, gap, [cols, rows]);
    const cw = (z.w - gap * (cols - 1)) / cols, ch = (z.h - gap * (rows - 1)) / rows;
    const t = fit169(0, 0, cw, ch);
    const yc = z.y + (z.h - (rows * t.h + (rows - 1) * gap)) / 2;   // rangées centrées dans la hauteur disponible
    ids.forEach((id, i) => {
      const row = Math.floor(i / cols), dans = row === rows - 1 ? n - row * cols : cols, col = i - row * cols;
      const x0 = z.x + (z.w - (dans * t.w + (dans - 1) * gap)) / 2;
      r[id] = { x: x0 + col * (t.w + gap), y: yc + row * (t.h + gap), w: t.w, h: t.h };
    });
    return r;
  }
  const X = 70, W = 1780, HAUT = 40, BAS = 1032, gap = 20, esp = 24;
  const largeur = (nb, hMax) => Math.min((W - gap * (nb - 1)) / nb, hMax * 16 / 9);
  if (dispo === 'plein') {
    const w = largeur(n, 200), h = w * 9 / 16;
    rangeeCentree(ids, BAS - h, w, h, n > 7 ? 12 : gap, r);
    r.__panneau = { x: X, y: HAUT, w: W, h: BAS - h - esp - HAUT };
    return r;
  }
  if (n <= 4) {
    // caméras en rangée, la question dessous, alignée sur la même largeur
    const w = largeur(n, 380), h = w * 9 / 16;
    const total = rangeeCentree(ids, HAUT, w, h, gap, r);
    const pw = Math.max(total, 1180);
    r.__panneau = { x: (SCENE_W - pw) / 2, y: HAUT + h + esp, w: pw, h: BAS - (HAUT + h + esp) };
    return r;
  }
  // 5 personnes et plus : la question au milieu, une rangée au-dessus, une rangée en dessous
  const haut = ids.slice(0, Math.ceil(n / 2)), bas = ids.slice(haut.length);
  const w = largeur(haut.length, 240), h = w * 9 / 16;
  const ph = Math.min(BAS - HAUT - 2 * h - 2 * esp, 520);
  const y0 = HAUT + (BAS - HAUT - (2 * h + 2 * esp + ph)) / 2;
  const total = rangeeCentree(haut, y0, w, h, gap, r);
  rangeeCentree(bas, y0 + h + esp + ph + esp, w, h, gap, r);
  const pw = Math.max(total, 1300);
  r.__panneau = { x: (SCENE_W - pw) / 2, y: y0 + h + esp, w: pw, h: ph };
  return r;
}

/* ---------- Watch Party ----------
   etat.watch = { titre, pos, ref, lecture, duree, top, pastille } : le film en est à `pos` secondes à l'instant `ref`
   (heure de l'animateur) ; s'il est en lecture, il avance depuis. `top` : instant du top départ, s'il y en a un.
   Les horloges des ordinateurs ne sont pas à la même heure : on mesure le décalage avec celle de l'animateur. */
let decalageHote = Infinity;
function calerHorloge(ts) { if (typeof ts === 'number' && isFinite(ts)) decalageHote = Math.min(decalageHote, Date.now() - ts); }
const maintenantHote = () => Date.now() - (isFinite(decalageHote) ? decalageHote : 0);
function positionFilm(w, t = maintenantHote()) {
  if (!w) return 0;
  return Math.max(0, (+w.pos || 0) + (w.lecture ? Math.max(0, (t - w.ref) / 1000) : 0));
}
function texteFilm(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/* Scène Watch Party : les caméras en haut, le minuteur du film en grand en bas */
const ZONE_WATCH = { x: 70, y: 50, w: 1780, h: 770 };
const ZONE_WATCH_V = { x: 40, y: 420, w: 1080 - 40 - SURES_V.droite, h: 900 };

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

/* ---------- Musique : la suite des morceaux à jouer, et où on en est ----------
   Partagé par la régie (qui décide) et par chaque lecteur (la sortie du live, les retours du studio) :
   tous trouvent le même morceau au même moment.
   etat.musique = { idx, lecture, n, t0, pos0, suite, boucle, auto }
     suite : les morceaux d'une scène (ids), joués à la suite puis repris au début ;
     sans suite : toute la liste à partir du morceau lancé ; t0 / pos0 : quand la lecture est partie, et d'où. */
function suiteMusique(st) {
  const l = (st && st.playlist) || [], m = (st && st.musique) || {};
  if (!l.length) return [];
  if (Array.isArray(m.suite)) { const ids = m.suite.filter(id => l.some(p => p.id === id)); if (ids.length) return ids; }
  const i = l[m.idx] ? m.idx : 0;
  if (m.boucle) return [l[i].id];
  return l.slice(i).concat(l.slice(0, i)).map(p => p.id);
}
/* Le morceau en cours à l'instant t (heure de la régie) et la position dedans. Sans les durées, on ne connaît que le premier. */
function positionMusique(st, t) {
  const suite = suiteMusique(st), m = (st && st.musique) || {};
  if (!suite.length) return null;
  const durees = suite.map(id => +((st.playlist.find(p => p.id === id) || {}).d) || 0);
  if (durees.some(d => !(d > 0))) return { id: suite[0], t: 0, connu: false };
  let p = Math.max(0, (+m.pos0 || 0) + (m.lecture && m.t0 ? (t - m.t0) / 1000 : 0)) % durees.reduce((a, b) => a + b, 0);
  for (let i = 0; i < suite.length; i++) { if (p < durees[i]) return { id: suite[i], t: p, connu: true }; p -= durees[i]; }
  return { id: suite[0], t: 0, connu: true };
}

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

/* ---------- Fenêtre de confirmation « Oui / Non » (remplace confirm()) ---------- */
function confirmer(texte, { oui = 'Oui', non = 'Non', danger = true } = {}) {
  return new Promise(ok => {
    const f = document.createElement('div');
    f.className = 'confirmation';
    f.innerHTML = `<div class="confirmation-boite" role="alertdialog" aria-modal="true"><p></p><div class="confirmation-boutons"><button class="non"></button><button class="oui ${danger ? 'rouge' : 'primaire'}"></button></div></div>`;
    f.querySelector('p').textContent = texte;
    f.querySelector('.oui').textContent = oui; f.querySelector('.non').textContent = non;
    const fin = v => { f.remove(); document.removeEventListener('keydown', touche); ok(v); };
    const touche = e => { if (e.key === 'Escape') fin(false); };
    f.querySelector('.oui').onclick = () => fin(true);
    f.querySelector('.non').onclick = () => fin(false);
    f.addEventListener('click', e => { if (e.target === f) fin(false); });
    document.addEventListener('keydown', touche);
    document.body.appendChild(f);
    f.querySelector('.non').focus();
  });
}

/* ----- Petits fichiers gardés dans ce navigateur (les musiques ajoutées depuis l'ordinateur) ----- */
const fichiers = (() => {
  let base = null;
  const ouvrir = () => base || (base = new Promise((ok, ko) => {
    const r = indexedDB.open('studioSeb', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fichiers');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { base = null; ko(r.error); };
  }));
  const op = (mode, f) => ouvrir().then(db => new Promise((ok, ko) => {
    const t = db.transaction('fichiers', mode), q = f(t.objectStore('fichiers'));
    t.oncomplete = () => ok(q.result);
    t.onerror = t.onabort = () => ko(t.error);
  }));
  return {
    mettre: (id, blob) => op('readwrite', s => s.put(blob, id)),
    lire: id => op('readonly', s => s.get(id)).then(b => b || null),
    oter: id => op('readwrite', s => s.delete(id)),
  };
})();

/* ----- Ce que chaque formule permet.
   « beta » : la formule de Sebastian et des bêta-testeurs, tout au maximum. Tant que les comptes n'existent pas,
   c'est celle de tout le monde (demande de Sebastian, 17/11). ----- */
const LIMITES = { beta: { musiques: 50 }, gratuit: { musiques: 3 }, essentiel: { musiques: 10 }, pro: { musiques: 25 }, regie: { musiques: 50 } };
function formuleActuelle() {
  try { const f = localStorage.getItem('studioSeb:formule'); return LIMITES[f] ? f : 'beta'; } catch (e) { return 'beta'; }
}

/* ---------- Téléphone et tablette : l'écran ne se met pas en veille pendant le live ---------- */
function garderEcranAllume() {
  if (!('wakeLock' in navigator)) return;
  let verrou = null;
  const demander = async () => { if (verrou || document.visibilityState !== 'visible') return; try { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } catch (e) { /* refusé : tant pis */ } };
  document.addEventListener('visibilitychange', demander);
  document.addEventListener('pointerdown', demander);
  demander();
}
