/* OBSeb : page Sortie (source navigateur OBS, aperçus régie et invités) */
'use strict';

const Q = queryParams();
const PREVIEW = Q.has('preview');           // aperçu léger : basse qualité, sans son
const DEMO = parseInt(Q.get('demo') || '0', 10); // tuiles factices pour tester la mise en page
const SCENE_FORCEE = Q.get('scene');
const session = lireSession();

const $ = s => document.querySelector(s);
const tuiles = new Map();   // id -> { el, iframe, niveau, ecran }
let etat = null;
let hote = null;

/* ----- Mise à l'échelle 1920x1080 dans la fenêtre ----- */
function echelle() {
  const k = Math.min(innerWidth / SCENE_W, innerHeight / SCENE_H);
  const el = $('#scale');
  el.style.transform = `translate(${(innerWidth - SCENE_W * k) / 2}px, ${(innerHeight - SCENE_H * k) / 2}px) scale(${k})`;
}
addEventListener('resize', echelle);
echelle();

if (!session) {
  document.body.innerHTML = '<p style="color:#fff;font:20px Arial;padding:40px">Lien incomplet : ouvre la sortie depuis la régie (bouton « Copier le lien OBS »).</p>';
  throw new Error('Pas de session');
}

const theme = themeComplet(session);
appliquerTheme(theme);
if (theme.pack && theme.packJs) chargerPack(theme.pack, true);
document.querySelectorAll('[data-champ="titre"]').forEach(e => e.textContent = session.titre);
document.querySelectorAll('[data-champ="hote"]').forEach(e => e.textContent = session.hote);
document.querySelectorAll('[data-champ="handle"]').forEach(e => e.textContent = session.handle || HANDLE_DEFAUT);
$('#logo').innerHTML = theme.logo ? `<img src="${esc(theme.logo)}" alt="">` : esc(theme.logoTexte || 'SEB');
document.title = `${session.titre} · Sortie`;

/* ----- Tuiles ----- */
function creerTuile(id, nom, { ecran = false, demo = false } = {}) {
  if (tuiles.has(id)) return tuiles.get(id);
  const el = document.createElement('div');
  el.className = 'tuile horsantenne' + (demo ? ' demo' : '');
  el.innerHTML = `<div class="attente">${demo ? esc(nom.slice(0, 1)) : 'Connexion…'}</div><div class="nom"></div>`;
  el.querySelector('.nom').textContent = nom || '';
  let iframe = null;
  if (!demo) {
    iframe = document.createElement('iframe');
    iframe.allow = IFRAME_ALLOW;
    const nb = etat ? etat.onair.length : 1;
    const opts = PREVIEW
      ? { bitrate: nb > 6 ? 150 : 300, noaudio: true }
      : { bitrate: ecran ? 8000 : 6000, audiobitrate: 128 };
    iframe.src = urlVoir(session, id, opts);
    iframe.addEventListener('load', () => {
      if (!PREVIEW) ordre(iframe, { getLoudness: true });
      appliquerVolumes();
    });
    el.appendChild(iframe);
  }
  (ecran ? $('#ecran') : $('#tuiles')).appendChild(el);
  const t = { id, el, iframe, niveau: 0, ecran };
  tuiles.set(id, t);
  return t;
}
function supprimerTuile(id) {
  const t = tuiles.get(id);
  if (!t) return;
  t.el.remove();
  tuiles.delete(id);
}
function placer(t, r) {
  if (!r) { t.el.classList.add('horsantenne'); return; }
  Object.assign(t.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  t.el.classList.toggle('petite', r.w < 560);
  t.el.classList.remove('horsantenne');
}

/* ----- Volumes : réglés par la régie, appliqués ici (donc dans OBS) ----- */
function appliquerVolumes() {
  if (!etat) return;
  for (const t of tuiles.values()) {
    if (!t.iframe) continue;
    let v = 0;
    if (!PREVIEW) {
      const visible = etat.scene === 'live' || etat.scene === 'partage';
      const enDirect = t.ecran ? etat.scene === 'partage' : etat.onair.includes(t.id);
      v = visible && enDirect ? (etat.vol[t.id] ?? 1) : 0;
      if (etat.muet && etat.muet[t.id]) v = 0;
    }
    ordre(t.iframe, { volume: v });
  }
}

/* ----- Appliquer l'état envoyé par la régie ----- */
function appliquerEtat(st) {
  if (!st || (etat && st.ts && etat.ts && st.ts < etat.ts)) return;
  etat = st;
  const scene = SCENE_FORCEE || st.scene;

  // créer les tuiles des personnes connues, retirer les absents
  if (!DEMO) {
    for (const [id, nom] of Object.entries(st.noms || {})) creerTuile(id, nom);
    for (const id of [...tuiles.keys()]) {
      const t = tuiles.get(id);
      if (!t.ecran && !(id in (st.noms || {}))) supprimerTuile(id);
    }
  }
  for (const t of tuiles.values()) {
    if (!t.ecran) t.el.querySelector('.nom').textContent = (st.noms || {})[t.id] || '';
  }

  $('#intro').classList.toggle('cachee', scene !== 'intro');
  $('#fin').classList.toggle('cachee', scene !== 'fin');
  $('#tuiles').classList.toggle('cachee', !(scene === 'live' || scene === 'partage'));
  $('#ecran').classList.toggle('cachee', scene !== 'partage');
  $('#bandeau').classList.toggle('cachee', !(scene === 'live' || scene === 'partage'));
  $('#bandeau-titre').textContent = st.bandeau || session.titre;
  $('#bandeau-msg').textContent = st.message || '';

  const ids = (st.onair || []).filter(id => tuiles.has(id));
  const disp = scene === 'partage' ? dispositionPartage(ids) : calculerDisposition(st.layout, ids, st.focus);
  for (const t of tuiles.values()) {
    if (t.ecran) placer(t, scene === 'partage' ? disp.__ecran : null);
    else placer(t, disp[t.id]);
  }
  appliquerVolumes();
  compteARebours();
}

/* ----- Compte à rebours de l'intro ----- */
function compteARebours() {
  const el = $('#compte'), info = $('#intro-info');
  if (!etat || !etat.fin) { el.textContent = ''; info.textContent = 'Installe-toi, on arrive'; return; }
  const ms = etat.fin - Date.now();
  if (ms <= 0) { el.textContent = "C'est parti"; info.textContent = ''; return; }
  const s = Math.ceil(ms / 1000);
  el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  info.textContent = 'Début du live dans';
}
setInterval(compteARebours, 250);

/* ----- Qui parle : cadre de couleur sur la personne qui parle ----- */
setInterval(() => {
  if (!etat || PREVIEW) return;
  let max = null;
  for (const t of tuiles.values()) {
    t.niveau *= 0.6;
    if (!t.ecran && etat.onair.includes(t.id) && t.niveau > 6 && (!max || t.niveau > max.niveau)) max = t;
  }
  for (const t of tuiles.values()) t.el.classList.toggle('parle', !!(etat.surbrillance && max === t && etat.onair.length > 1));
}, 200);

/* ----- Messages reçus ----- */
addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  // 1) état envoyé par la régie via la caméra de l'hôte (seule source acceptée dans OBS)
  if (hote && e.source === hote.iframe?.contentWindow && d.dataReceived && d.dataReceived[CANAL]) {
    appliquerEtat(d.dataReceived[CANAL]);
    return;
  }
  // 2) état poussé directement par la page qui m'intègre (aperçu dans la régie ou chez l'invité)
  if (e.source === window.parent && window.parent !== window && d[CANAL]) {
    appliquerEtat(d[CANAL]);
    return;
  }
  // 3) niveaux sonores des tuiles
  if (d.loudness !== undefined) {
    for (const t of tuiles.values()) {
      if (t.iframe && e.source === t.iframe.contentWindow) { t.niveau = Math.max(t.niveau, niveauSonore(d)); break; }
    }
  }
});

/* ----- Démarrage ----- */
if (DEMO) {
  const noms = [session.hote, 'Antho', 'Landri', 'Camille', 'Yanis', 'Léa', 'Malik', 'Inès', 'Hugo', 'Sarah'];
  const st = etatParDefaut(session);
  st.scene = SCENE_FORCEE || 'live';
  st.noms = {}; st.onair = [];
  for (let i = 0; i < Math.min(DEMO, 10); i++) { const id = 'demo' + i; st.noms[id] = noms[i]; st.onair.push(id); creerTuile(id, noms[i], { demo: true }); }
  const ec = creerTuile('__ecran', 'Partage', { demo: true, ecran: true });
  ec.el.querySelector('.attente').textContent = 'Partage d’écran';
  st.layout = Q.get('layout') || 'grille';
  st.message = 'Pose tes questions dans le chat';
  appliquerEtat(st);
} else {
  hote = creerTuile(idHote(session), session.hote);
  creerTuile(idEcran(session), 'Partage', { ecran: true });
  appliquerEtat(etatParDefaut(session));
}
