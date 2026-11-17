/* OBSeb : page Sortie (source navigateur OBS, aperçus régie et invités) */
'use strict';

const Q = queryParams();
const PREVIEW = Q.has('preview');           // aperçu léger : basse qualité, sans son
const DEMO = parseInt(Q.get('demo') || '0', 10); // tuiles factices pour tester la mise en page
const SCENE_FORCEE = Q.get('scene');
const VERTICAL = Q.get('format') === 'vertical';
const LARG = VERTICAL ? SCENE_VW : SCENE_W, HAUT = VERTICAL ? SCENE_VH : SCENE_H;
if (VERTICAL) document.body.classList.add('vertical');
/* « Je garde mon OBS » : les caméras seules sur fond transparent, l'habillage reste dans OBS */
if (Q.get('decor') === '0') document.body.classList.add('sans-decor');
if (VERTICAL && Q.get('zones')) addEventListener('DOMContentLoaded', () => {
  const z = document.createElement('div'); z.id = 'zones-sures';
  z.innerHTML = `<div style="left:0;right:0;top:0;height:${SURES_V.haut}px">Profil et spectateurs<br>(TikTok, Instagram)</div>
    <div style="left:0;right:0;top:${SURES_V.bas}px;bottom:0">Commentaires et cadeaux</div>
    <div style="right:0;width:${SURES_V.droite}px;top:${SURES_V.bas - 420}px;height:420px;font-size:16px">Boutons</div>`;
  ($('#scale') || document.body).appendChild(z);
});
const session = lireSession();

const $ = s => document.querySelector(s);
const tuiles = new Map();   // id -> { el, iframe, niveau, ecran }
let etat = null;
let hote = null;

/* ----- Mise à l'échelle 1920x1080 dans la fenêtre ----- */
function echelle() {
  const k = Math.min(innerWidth / LARG, innerHeight / HAUT);
  const el = $('#scale');
  el.style.transform = `translate(${(innerWidth - LARG * k) / 2}px, ${(innerHeight - HAUT * k) / 2}px) scale(${k})`;
}
addEventListener('resize', echelle);
echelle();

if (!session) {
  document.body.innerHTML = '<p style="color:#fff;font:20px Arial;padding:40px">Lien incomplet : ouvre la sortie depuis la régie (bouton « Copier le lien OBS »).</p>';
  throw new Error('Pas de session');
}

const theme = themeComplet(session);
const MUR = plateauDe(theme) === 'mur';   // plateau en un seul écran partagé (voir common.js)
appliquerTheme(theme);
if (theme.pack && theme.packJs) chargerPack(theme.pack, true);
document.querySelectorAll('[data-champ="titre"]').forEach(e => {
  e.textContent = session.titre;
  const n = (session.titre || '').length;
  e.classList.toggle('long', n > 26 && n <= 44);
  e.classList.toggle('tres-long', n > 44);
});
/* Titre toujours entier à l'écran : on réduit la taille s'il déborde (titres longs) */
function ajusterTitres() {
  document.querySelectorAll('.plein .grand-titre').forEach(e => {
    e.style.fontSize = '';
    let taille = parseFloat(getComputedStyle(e).fontSize), max = e.parentElement.clientWidth - 40;
    for (let i = 0; i < 30 && (e.scrollWidth > max || e.offsetHeight > taille * 3.3) && taille > 40; i++) { taille -= 4; e.style.fontSize = taille + 'px'; }
  });
}
addEventListener('load', ajusterTitres);
if (document.fonts) document.fonts.ready.then(ajusterTitres);
document.querySelectorAll('[data-champ="hote"]').forEach(e => e.textContent = session.hote);
document.querySelectorAll('[data-champ="handle"]').forEach(e => e.textContent = session.handle || HANDLE_DEFAUT);
$('#logo').innerHTML = theme.logo ? `<img src="${esc(theme.logo)}" alt="">` : esc(theme.logoTexte || 'SEB');
$('#logo').classList.toggle('image', !!theme.logo);
/* le même logo, pour les coins du haut : il sort alors du bandeau et se pose sur l'image, comme le logo d'une chaîne */
$('#logo-coin').innerHTML = $('#logo').innerHTML;
$('#logo-coin').classList.toggle('image', !!theme.logo);
document.title = `${session.titre} · Sortie`;

/* ----- Tuiles ----- */
/* Aperçus sans caméra : une silhouette au format 16:9, recadrée comme le sera la vraie image */
const TEINTES_DEMO = [42, 205, 268, 152, 14, 322, 186, 96, 232, 28, 292];
function silhouette(i) {
  const h = TEINTES_DEMO[i % TEINTES_DEMO.length], dx = [0, -46, 38, 22, -30, 12, -18, 44, -8, 30, -40][i % 11];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},26%,27%)"/><stop offset="1" stop-color="hsl(${h},32%,12%)"/></linearGradient></defs>`
    + `<rect width="1600" height="900" fill="url(#g)"/><g fill="hsl(${h},24%,43%)" transform="translate(${dx} 0)"><circle cx="800" cy="392" r="122"/><path d="M470 900c0-196 134-326 330-326s330 130 330 326z"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function creerTuile(id, nom, { ecran = false, demo = false } = {}) {
  if (tuiles.has(id)) return tuiles.get(id);
  const el = document.createElement('div');
  el.className = 'tuile horsantenne' + (demo ? ' demo' : '');
  el.innerHTML = `<div class="attente">${demo ? (ecran ? '' : '') : 'Connexion…'}</div><div class="nom"></div>`;
  if (demo && !ecran) { el.classList.add('silhouette'); el.querySelector('.attente').style.backgroundImage = silhouette(tuiles.size); }
  el.querySelector('.nom').textContent = nom || '';
  let iframe = null;
  if (!demo) {
    iframe = document.createElement('iframe');
    iframe.allow = IFRAME_ALLOW;
    const nb = etat ? etat.onair.length : 1;
    // Aperçu : l'hôte reste net (flux local), les invités en qualité réduite pour ne pas saturer leur connexion
    const estHote = id === idHote(session) || estCamLocale(id);     // tes caméras passent par ton propre PC
    // aperçus : basse qualité pour tout le monde, toi compris (chaque fenêtre qui te regarde coûte un encodage à ton PC)
    const debitApercu = estHote ? 1500 : (Q.get('preview') === 'regie' ? 900 : (nb > 6 ? 150 : 300));
    const opts = PREVIEW
      ? { bitrate: ecran ? 1500 : debitApercu, noaudio: true }
      // Sortie OBS : ta caméra passe par ton propre PC, donc on peut monter très haut sans coût internet
      // scale=100 : la sortie OBS reçoit la définition d'origine (1080p), sans la réduction automatique à la taille de la tuile
      : { bitrate: ecran ? 10000 : (estHote ? 20000 : 8000), audiobitrate: 128, codec: 'vp9,h264', scale: 100 };
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
/* Sources : partage d'écran (flux vdo.ninja), image, vidéo, page web */
const sourcesEl = new Map();   // clé -> { el, type, ref, video }
function cleSource(src) { return src.type === 'ecran' ? src.ref : src.type + ':' + src.ref; }
function creerSource(src) {
  const cle = cleSource(src);
  if (src.type === 'ecran') {
    const t = creerTuile(src.ref, src.nom || 'Partage', { ecran: true, demo: !!src.demo });
    if (src.demo) t.el.querySelector('.attente').textContent = src.nom;
    return t;
  }
  if (sourcesEl.has(cle)) return sourcesEl.get(cle);
  const el = document.createElement('div');
  el.className = 'tuile source horsantenne';
  let video = null;
  if (src.type === 'image') {
    // image donnée par un lien, ou fichier choisi dans la régie (il arrive par le canal de la régie)
    const adresse = idFichierSource(src) ? adresseFichier(idFichierSource(src)) : src.ref;
    el.innerHTML = `<img ${adresse ? `src="${esc(adresse)}"` : ''} alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000">`;
  }
  else if (src.type === 'video') {
    video = document.createElement('video');
    Object.assign(video, { src: src.ref, loop: true, playsInline: true, muted: PREVIEW, autoplay: true });
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
    el.appendChild(video);
  } else if (src.type === 'web') {
    const f = document.createElement('iframe'); f.src = src.ref; f.allow = 'autoplay *; fullscreen *';
    el.appendChild(f);
  }
  $('#ecran').appendChild(el);
  const o = { el, type: src.type, ref: src.ref, video };
  sourcesEl.set(cle, o);
  return o;
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
      const visible = sceneCameras(etat.scene);
      // ton micro reste ouvert quand c'est une autre de tes caméras qui est à l'écran
      const enDirect = t.ecran ? (etat.scene === 'partage' && sourcesActives().some(x => x.ref === t.id))
        : (etat.onair.includes(t.id) || (t.id === idHote(session) && etat.onair.some(estCamLocale)));
      v = visible && enDirect ? (etat.vol[t.id] ?? 1) : 0;
      if (etat.muet && etat.muet[t.id]) v = 0;
    }
    ordre(t.iframe, { volume: v });
  }
  for (const [cle, o] of sourcesEl) {
    if (!o.video) continue;
    const actif = etat.scene === 'partage' && sourcesActives().some(x => cleSource(x) === cle);
    o.video.volume = PREVIEW || !actif ? 0 : Math.min(1, etat.vol[cle] ?? 1);
    if (actif && o.video.paused) o.video.play().catch(() => {});
  }
}
function sourcesActives() { return ((etat && etat.sources) || []).filter(x => x && x.actif && x.ref).slice(0, 4); }

/* ----- Appliquer l'état envoyé par la régie ----- */
function appliquerEtat(st) {
  if (!st || (etat && st.ts && etat.ts && st.ts < etat.ts)) return;
  etat = st;
  calerHorloge(st.ts);
  const scene = SCENE_FORCEE || st.scene;

  // créer les tuiles des personnes connues, retirer les absents
  if (!DEMO) {
    for (const [id, nom] of Object.entries(st.noms || {})) creerTuile(id, nom);
    for (const id of [...tuiles.keys()]) {
      const t = tuiles.get(id);
      if (!t.ecran && !(id in (st.noms || {}))) supprimerTuile(id);
      if (t.ecran && !sourcesActives().some(x => x.ref === id) && !(st.sources || []).some(x => x && x.ref === id)) supprimerTuile(id);
    }
  }
  for (const t of tuiles.values()) {
    if (!t.ecran) t.el.querySelector('.nom').textContent = (st.noms || {})[t.id] || '';
  }

  $('#intro').classList.toggle('cachee', scene !== 'intro');
  $('#fin').classList.toggle('cachee', scene !== 'fin');
  $('#tuiles').classList.toggle('cachee', !sceneCameras(scene));
  $('#logo-coin').classList.toggle('cachee', !sceneCameras(scene));
  $('#ecran').classList.toggle('cachee', scene !== 'partage');
  $('#bandeau').classList.toggle('cachee', !(scene === 'live' || scene === 'partage'));
  document.body.dataset.scene = scene;
  // bandeau : celui de la bibliothèque s'il y en a un d'affiché, sinon le titre du live
  const ba = st.bandeauActif;
  const titre = ba ? ba.titre : (st.bandeau || session.titre), sous = ba ? (ba.sous || '') : (st.message || '');
  const bt = $('#bandeau-titre');
  if (bt.textContent !== titre) { bt.textContent = titre; bt.classList.remove('entree'); void bt.offsetWidth; bt.classList.add('entree'); }
  $('#bandeau-msg').textContent = sous;
  // texte défilant
  const def = st.defilant || {};
  $('#defilant').classList.toggle('cachee', !(def.actif && def.texte && sceneCameras(scene)));
  const piste = $('#defilant .piste');
  if (piste.dataset.texte !== (def.texte || '')) {
    piste.dataset.texte = def.texte || '';
    piste.textContent = def.texte ? (def.texte + '   ✦   ').repeat(6) : '';
    piste.style.animationDuration = Math.max(20, (def.texte || '').length * 0.9) + 's';
  }

  // sources de la scène Partage
  const actives = sourcesActives();
  if (scene === 'partage') actives.forEach(creerSource);
  const clesActives = actives.map(cleSource);

  const ids = (st.onair || []).filter(id => tuiles.has(id) && !tuiles.get(id).ecran);
  const quizEnCours = st.quiz && (st.quiz.active || st.quiz.afficherScores) && (scene === 'live' || scene === 'partage');
  document.body.classList.toggle('quiz-on', !!quizEnCours);
  // sous-titres à l'écran : les caméras laissent une bande libre en dessous, les sous-titres ne passent jamais sur une image
  const bandeST = !!(st.st && st.st.actif && st.st.ecran) && !quizEnCours && sceneCameras(scene);
  document.body.classList.toggle('st-on', bandeST);
  const retrait = (z, bas) => bandeST ? Object.assign({}, z, { h: Math.min(z.h, bas - z.y) }) : z;
  // tout le chat à l'écran : les caméras lui laissent une colonne (ou une bande en vertical), il ne passe jamais sur une image
  const filChat = !!(st.chatFil && st.chatFil.actif) && !quizEnCours && sceneCameras(scene);
  const cote = z => !filChat ? z : VERTICAL ? Object.assign({}, z, { h: z.h - 300 }) : Object.assign({}, z, { w: z.w - 400 });
  const zone = cote(VERTICAL ? retrait(ZONE_V, 1180) : retrait(MUR ? ZONE_MUR : ZONE, 720));
  const zoneWatch = cote(VERTICAL ? retrait(ZONE_WATCH_V, 1180) : retrait(ZONE_WATCH, 690));
  const disp = quizEnCours ? dispositionQuiz(ids, VERTICAL, st.quiz.dispo || 'centre') : VERTICAL
    ? (scene === 'partage' ? dispositionPartageV(ids, clesActives, zone) : MUR ? dispositionMur(st.layout, ids, st.focus, zone, true) : calculerDispositionV(st.layout, ids, st.focus, zone))
    : (scene === 'partage' ? dispositionPartage(ids, clesActives, zone) : MUR ? dispositionMur(st.layout, ids, st.focus, zone) : calculerDisposition(st.layout, ids, st.focus, zone));
  if (scene === 'watch' && !quizEnCours) Object.assign(disp, VERTICAL ? calculerDispositionV(st.layout, ids, st.focus, zoneWatch) : calculerDisposition(st.layout, ids, st.focus, zoneWatch));
  for (const t of tuiles.values()) {
    if (t.ecran) placer(t, scene === 'partage' ? disp[t.id] : null);
    else placer(t, disp[t.id]);
  }
  for (const [cle, o] of sourcesEl) placer(o, scene === 'partage' ? disp[cle] : null);
  placerPanneauQuiz(quizEnCours ? disp.__panneau : null);
  gererPlaylist();
  gererQuiz();
  gererChat();
  gererFilChat(filChat, scene === 'watch' ? zoneWatch : zone);
  gererWatch();
  appliquerVolumes();
  compteARebours();
  gererMusique(scene);
}

/* ----- Musiques d'intro et de fin (liens dans le thème, son seul) ----- */
const musiques = {};
if (!PREVIEW && !DEMO) {
  for (const [scene, url] of [['intro', theme.musiqueIntro], ['fin', theme.musiqueFin]]) {
    if (!url) continue;
    const a = new Audio(url); a.loop = true; a.volume = 0; a.preload = 'auto';
    musiques[scene] = a;
  }
}
function gererMusique(scene) {
  const cible = etat ? (etat.volMusique ?? 0.5) : 0.5;
  for (const [nom, a] of Object.entries(musiques)) {
    const active = nom === scene && !((etat && etat.musiqueScenes) || {})[nom];
    if (active && a.paused) { if (nom === 'fin') a.currentTime = 0; a.play().catch(() => {}); }
    clearInterval(a._fondu);
    a._fondu = setInterval(() => {
      const but = active ? cible : 0;
      const pas = 0.04;
      a.volume = Math.abs(a.volume - but) <= pas ? but : a.volume + (a.volume < but ? pas : -pas);
      if (a.volume === but) { clearInterval(a._fondu); if (!active) a.pause(); }
    }, 60);
  }
}

/* ----- Message du chat mis en avant ----- */
const COULEURS_CHAT = { twitch: ['#9146FF', 'Twitch'], youtube: ['#FF0000', 'YouTube'], facebook: ['#1877F2', 'Facebook'] };
let chatAfficheTs = 0;
function gererChat() {
  const c = etat && etat.chatAffiche;
  const visible = !!c && sceneCameras(etat.scene);
  $('#chat-bulle').classList.toggle('cachee', !visible);
  document.body.classList.toggle('chat-on', visible);
  if (!c || c.ts === chatAfficheTs) return;
  chatAfficheTs = c.ts;
  const [coul, nom] = COULEURS_CHAT[c.p] || ['#555', ''];
  $('#cb-p').style.background = coul; $('#cb-p').textContent = nom;
  $('#cb-auteur').textContent = c.auteur;
  $('#cb-texte').textContent = c.texte;
}

/* ----- Tout le chat à l'écran : une colonne à côté des caméras ----- */
let filVu = '';
function gererFilChat(visible, z) {
  const el = $('#chat-fil');
  el.classList.toggle('cachee', !visible);
  if (!visible) return;
  if (VERTICAL) Object.assign(el.style, { left: z.x + 'px', top: (z.y + z.h + 14) + 'px', width: z.w + 'px', height: '286px' });
  else Object.assign(el.style, { left: (z.x + z.w + 20) + 'px', top: z.y + 'px', width: '380px', height: z.h + 'px' });
  const msgs = (etat.chatFil && Array.isArray(etat.chatFil.msgs) ? etat.chatFil.msgs : []).slice(-8);
  const cle = JSON.stringify(msgs);
  if (cle === filVu) return;
  filVu = cle;
  el.innerHTML = msgs.length ? '' : '<div class="cf-vide">Le chat s\'affiche ici</div>';
  for (const m of msgs) {
    const d = document.createElement('div'); d.className = 'cf-msg';
    const i = document.createElement('i'); i.style.background = (COULEURS_CHAT[m.p] || ['#888'])[0];
    const b = document.createElement('b'); b.textContent = String(m.a || '').slice(0, 30);
    d.append(i, b, document.createTextNode(String(m.t || '').slice(0, 200)));
    el.appendChild(d);
  }
}

/* ----- Sous-titres en direct : une ligne par personne qui parle, avec son nom ----- */
let stVus = 0;
function finDeTexte(t, max) {      // on garde la fin de la phrase, coupée à un mot
  t = String(t || '');
  if (t.length <= max) return t;
  const c = t.slice(t.length - max);
  return '… ' + c.slice(c.indexOf(' ') + 1);
}
function afficherST(m) {
  const box = $('#sous-titres');
  const scene = SCENE_FORCEE || (etat && etat.scene);
  const l = m && m.ecran && Array.isArray(m.l) && document.body.classList.contains('st-on') ? m.l.slice(-2) : [];
  box.classList.toggle('cachee', !l.length);
  if (l.length) {
    stVus = Date.now();
    // une ligne par personne, dans sa couleur ; on garde la fin de la phrase pour tenir sur une ligne
    box.innerHTML = l.map(x => {
      const c = /^#[0-9a-f]{6}$/i.test(x.c || '') ? x.c : '';
      const nom = String(x.nom || '').slice(0, 16);
      return `<div${c ? ` style="color:${c}"` : ''}>${nom ? `<b${c ? '' : ' class="accent"'}>${esc(nom)}</b>` : ''}<span>${esc(finDeTexte(x.t, (VERTICAL ? 60 : 96) - nom.length))}</span></div>`;
    }).join('');
  }
}
setInterval(() => { if (stVus && Date.now() - stVus > 8000) { stVus = 0; $('#sous-titres').classList.add('cachee'); } }, 1000);

/* ----- Watch Party : le minuteur du film ----- */
function gererWatch() {
  const w = etat && etat.watch, scene = SCENE_FORCEE || (etat && etat.scene);
  const grand = !!w && scene === 'watch';
  const petit = !!w && !grand && w.pastille && (scene === 'live' || scene === 'partage') && !document.body.classList.contains('quiz-on');
  const el = $('#watch');
  el.classList.toggle('cachee', !(grand || petit));
  el.classList.toggle('pastille', petit);
  const top = $('#watch-top');
  if (!w) { top.classList.add('cachee'); return; }
  const t = maintenantHote(), pos = positionFilm(w, t);
  $('#wp-titre').textContent = w.titre || 'Le film';
  $('#wp-temps').textContent = texteFilm(pos);
  const enCompte = w.top && t < w.top;
  el.classList.toggle('lecture', !!w.lecture && !enCompte);
  $('#wp-etat span').textContent = enCompte ? 'Top départ' : w.lecture ? 'Lecture' : 'En pause';
  $('#wp-barre').style.width = w.duree ? Math.min(100, pos / w.duree * 100) + '%' : '0%';
  $('#watch .wp-barre').style.visibility = w.duree ? '' : 'hidden';
  // top départ : 5, 4, 3, 2, 1 puis « Lecture ! » pendant une seconde et demie
  const voirTop = w.top && t < w.top + 1500 && sceneCameras(scene);
  top.classList.toggle('cachee', !voirTop);
  if (voirTop) {
    const n = Math.ceil((w.top - t) / 1000);
    $('#wt-n').textContent = n > 0 ? n : 'Lecture !';
    top.classList.toggle('go', n <= 0);
    $('#wt-sous').textContent = n > 0 ? `à ${texteFilm(w.pos)}` : '';
  }
}
setInterval(() => { if (etat && etat.watch) gererWatch(); }, 200);

/* ----- Quiz ----- */
/* Place de la question : calculée avec celle des caméras (dispositions « centre » et « plein ») ;
   sans rectangle (disposition « bas », vertical), le panneau reprend sa place fixe en bas */
function placerPanneauQuiz(rect) {
  document.body.dataset.quizDispo = rect ? 'libre' : 'bas';
  for (const el of document.querySelectorAll('#quiz .qz-panneau, #classement .qz-panneau')) {
    if (!rect) { el.style.cssText = ''; continue; }
    Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
    el.style.setProperty('--ph', rect.h + 'px');
  }
  ajusterQuiz();
}
/* Une question très longue : on réduit le texte jusqu'à ce que tout tienne dans le panneau */
let qk = 1;
function ajusterQuiz(depuisLeDebut = true) {
  const p = $('#quiz .qz-panneau'), corps = p.querySelector('.qz-corps'), texte = p.querySelector('.qz-texte');
  if (depuisLeDebut !== false) { qk = 1; p.style.setProperty('--qk', 1); }
  if (document.body.dataset.quizDispo !== 'libre') return;
  while (qk > 0.4 && texte.offsetHeight > corps.clientHeight) { qk -= 0.06; p.style.setProperty('--qk', qk.toFixed(2)); }
}
/* police ou image arrivée après coup : on resserre encore si ça ne tient plus */
if (window.ResizeObserver) new ResizeObserver(() => ajusterQuiz(false)).observe($('#quiz .qz-texte'));
if (document.fonts) { document.fonts.ready.then(() => ajusterQuiz()); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => ajusterQuiz()); }
let quizAffiche = null;
function gererQuiz() {
  const qz = (etat && etat.quiz) || {};
  const a = qz.active;
  document.body.dataset.quizStyle = qz.style || 'theme';
  $('#quiz').classList.toggle('cachee', !a || !!qz.afficherScores);
  $('#classement').classList.toggle('cachee', !qz.afficherScores);
  if (qz.afficherScores) {
    $('#classement-liste').innerHTML = (qz.classement || []).length
      ? qz.classement.map(c => `<li><span>${esc(c.nom)}</span><em>${c.pts} pts</em></li>`).join('')
      : '<li><span>Pas encore de points</span></li>';
  }
  if (!a) { quizAffiche = null; return; }
  if (quizAffiche !== a.qid) {
    quizAffiche = a.qid;
    $('#qz-q').textContent = a.q;
    const im = $('#qz-img');
    im.hidden = !a.img; if (a.img) im.src = a.img; else im.removeAttribute('src');
    $('#quiz').classList.toggle('avec-image', !!a.img);
    $('#qz-choix').innerHTML = a.choix.map((c, i) => `<div class="qz-c"><b>${'ABCD'[i]}</b><span>${esc(c)}</span></div>`).join('');
    im.onload = () => ajusterQuiz();
    ajusterQuiz();
  }
  [...document.querySelectorAll('.qz-c')].forEach((el, i) => {
    el.classList.toggle('bonne', !!a.revele && i === a.bonne);
    el.classList.toggle('fausse', !!a.revele && i !== a.bonne);
  });
  const res = $('#qz-res');
  if (a.revele) {
    const r = a.resultats || [];
    res.innerHTML = r.length
      ? `Le plus rapide : <b>${esc(r[0].nom)}</b> en ${(r[0].ms / 1000).toFixed(1).replace('.', ',')} s` + (r.length > 1 ? ` · ${r.length} bonnes réponses` : '')
      : 'Personne n\'a trouvé !';
  } else res.textContent = '';
  if (!!a.revele !== quizRevele) { quizRevele = !!a.revele; ajusterQuiz(); }
}
let quizRevele = false;
setInterval(() => {
  const a = etat && etat.quiz && etat.quiz.active;
  if (!a) return;
  ajusterQuiz(false);   // filet de sécurité : police ou image arrivée après coup
  if (a.revele) { $('#qz-temps').textContent = ''; $('#qz-barre').style.width = '0%'; return; }
  const ms = Math.max(0, a.duree * 1000 - (Date.now() - a.debut));
  $('#qz-temps').textContent = Math.ceil(ms / 1000);
  $('#qz-barre').style.width = (ms / (a.duree * 10)) + '%';
}, 250);

/* ----- Musiques de la régie -----
   Un morceau a soit un lien, soit un fichier ajouté depuis l'ordinateur de la régie.
   Le fichier est cherché dans ce navigateur ; s'il n'y est pas (OBS est un autre navigateur),
   la sortie le demande à la régie, le reçoit en morceaux et le garde pour les prochaines fois. */
const adressesMusique = new Map();     // id -> adresse locale du fichier
const recherchesMusique = new Map();   // id -> 'cherche' | 'absent'
const recuMusique = { id: '', n: 0, parts: [], nb: 0 };
// adresse locale d'un fichier (musique ou image) ; vide tant qu'il n'est pas arrivé
function adresseFichier(id) {
  if (!id) return '';
  if (adressesMusique.has(id)) return adressesMusique.get(id);
  if (!recherchesMusique.has(id)) {
    recherchesMusique.set(id, 'cherche');
    fichiers.lire(id).then(b => {
      if (b) { adressesMusique.set(id, URL.createObjectURL(b)); fichierPret(id); }
      else recherchesMusique.set(id, 'absent');
    }).catch(() => recherchesMusique.set(id, 'absent'));
  }
  return '';
}
function fichierPret(id) {
  for (const o of sourcesEl.values()) if (o.ref === 'fichier:' + id) { const img = o.el.querySelector('img'); if (img) img.src = adressesMusique.get(id); }
  gererPlaylist();
}
function adressePiste(p) { return !p ? '' : p.url ? p.url : adresseFichier(p.id); }
const idFichierSource = s => s && typeof s.ref === 'string' && s.ref.startsWith('fichier:') ? s.ref.slice(8) : '';
// les fichiers annoncés par la régie : les musiques (sauf dans un aperçu, qui est muet) et les images de la scène Partage
function fichiersAnnonces() {
  const ids = ((etat && etat.sources) || []).map(idFichierSource).filter(Boolean);
  if (!PREVIEW) for (const m of (etat && etat.playlist) || []) if (m.fichier && m.id) ids.push(m.id);
  return ids;
}
// le premier fichier qui manque ici : la régie l'envoie quand elle voit cette demande
function fichierDemande() {
  return fichiersAnnonces().find(id => !adressesMusique.has(id) && recherchesMusique.get(id) === 'absent') || '';
}
function recevoirMorceau(f) {
  if (!f || typeof f.id !== 'string' || typeof f.d !== 'string' || adressesMusique.has(f.id)) return;
  if (!fichiersAnnonces().includes(f.id)) return;     // seulement un fichier annoncé par la régie
  if (!Number.isInteger(f.i) || !Number.isInteger(f.n) || f.n < 1 || f.n > 700 || f.i < 0 || f.i >= f.n || f.d.length > 40000) return;
  if (recuMusique.id !== f.id || recuMusique.n !== f.n) Object.assign(recuMusique, { id: f.id, n: f.n, parts: new Array(f.n), nb: 0 });
  if (recuMusique.parts[f.i]) return;
  let bin;
  try { bin = atob(f.d); } catch (e) { return; }
  const o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  recuMusique.parts[f.i] = o; recuMusique.nb++;
  if (recuMusique.nb < recuMusique.n) return;
  const blob = new Blob(recuMusique.parts, { type: /^(audio|image)\/[\w.+-]+$/.test(f.type) ? f.type : 'application/octet-stream' });
  Object.assign(recuMusique, { id: '', n: 0, parts: [], nb: 0 });
  adressesMusique.set(f.id, URL.createObjectURL(blob));
  fichiers.mettre(f.id, blob).catch(() => {});
  fichierPret(f.id);
}

const lecteur = new Audio(); lecteur.preload = 'auto';
let pisteLocale = { idx: -1, n: -1 }, adresseLecteur = '', fonduLecteur = null;
function chargerPiste(p) {
  const a = adressePiste(p);
  if (a && a !== adresseLecteur) { adresseLecteur = a; lecteur.src = a; }
  return !!a;
}
lecteur.addEventListener('ended', () => {
  const l = (etat && etat.playlist) || [];
  if (!l.length) return;
  if (etat.musique && etat.musique.boucle) { lecteur.currentTime = 0; lecteur.play().catch(() => {}); return; }   // morceau lié à une scène : en boucle
  pisteLocale.idx = (pisteLocale.idx + 1) % l.length;
  adresseLecteur = '';
  if (chargerPiste(l[pisteLocale.idx])) lecteur.play().catch(() => {});
});
function gererPlaylist() {
  if (PREVIEW || DEMO || !etat) return;
  const l = etat.playlist || [], m = etat.musique || {};
  l.forEach(p => { if (!p.url) adressePiste(p); });     // prépare les fichiers avant d'en avoir besoin

  if (!l.length) { lecteur.pause(); return; }
  if (m.idx !== pisteLocale.idx || m.n !== pisteLocale.n) pisteLocale = { idx: m.idx, n: m.n };
  const pret = chargerPiste(l[pisteLocale.idx] || l[0]);
  const volume = Math.min(1, etat.volMusique ?? 0.5);
  if (m.lecture && pret) {
    if (fonduLecteur) { clearInterval(fonduLecteur); fonduLecteur = null; }
    lecteur.volume = volume;
    if (lecteur.paused) lecteur.play().catch(() => {});
  } else if (!lecteur.paused && !fonduLecteur) {
    // arrêt en fondu, pour ne pas couper net au changement de scène
    fonduLecteur = setInterval(() => {
      lecteur.volume = Math.max(0, lecteur.volume - 0.07);
      if (lecteur.volume <= 0.001) { clearInterval(fonduLecteur); fonduLecteur = null; lecteur.pause(); }
    }, 50);
  }
}

/* ----- Compte à rebours de l'intro ----- */
function compteARebours() {
  const el = $('#compte'), info = $('#intro-info');
  if (!etat || !etat.fin) { el.textContent = ''; info.textContent = 'Installe-toi, on arrive'; return; }
  const ms = etat.fin - Date.now();
  if (ms <= 0) { el.textContent = "C'est parti"; info.textContent = ''; return; }
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60, d2 = n => String(n).padStart(2, '0');
  el.textContent = h ? `${h}:${d2(m)}:${d2(sec)}` : `${m}:${d2(sec)}`;   // 3:59:08 au-delà d'une heure
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
  // le cadre ne change de personne qu'après 1,2 s de parole continue (pas de clignotement)
  const candidat = (etat.surbrillance && etat.onair.length > 1) ? max : null;
  if (candidat !== parleCandidat) { parleCandidat = candidat; parleDepuis = Date.now(); }
  if (Date.now() - parleDepuis >= 1200 || (parleActuel && !etat.onair.includes(parleActuel.id))) parleActuel = parleCandidat;
  for (const t of tuiles.values()) t.el.classList.toggle('parle', parleActuel === t);
}, 200);
let parleCandidat = null, parleDepuis = 0, parleActuel = null;

/* ----- Messages reçus ----- */
addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  // 1) état envoyé par la régie via la caméra de l'hôte (seule source acceptée dans OBS)
  if (hote && e.source === hote.iframe?.contentWindow && d.dataReceived && d.dataReceived[CANAL]) {
    appliquerEtat(d.dataReceived[CANAL]);
    return;
  }
  if (hote && e.source === hote.iframe?.contentWindow && d.dataReceived && d.dataReceived.studioSebFichier) { recevoirMorceau(d.dataReceived.studioSebFichier); return; }
  if (e.source === window.parent && window.parent !== window && d.studioSebFichier) { recevoirMorceau(d.studioSebFichier); return; }
  // sous-titres : envoyés par la régie (par la caméra de l'hôte, ou par la page qui m'intègre)
  if ((hote && e.source === hote.iframe?.contentWindow && d.dataReceived && d.dataReceived.studioSebST) || (e.source === window.parent && window.parent !== window && d.studioSebST)) {
    afficherST(d.studioSebST || d.dataReceived.studioSebST);
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

/* ----- La sortie OBS signale sa présence à la régie (voyant « Sortie OBS ») ----- */
if (!PREVIEW && !DEMO) setInterval(() => { if (hote) ordre(hote.iframe, { sendData: { studioSebSortie: { v: VERTICAL ? 1 : 0, besoin: fichierDemande() } }, type: 'rpcs' }); }, 3000);
// dans un aperçu (chez un invité), c'est la page qui m'intègre qui demande le fichier à la régie
if (PREVIEW && window.parent !== window) setInterval(() => { const b = fichierDemande(); if (b) window.parent.postMessage({ studioSebBesoin: b }, location.origin); }, 3000);

/* ----- Démarrage ----- */
if (DEMO) {
  const noms = [session.hote, 'Antho', 'Landri', 'Camille', 'Yanis', 'Léa', 'Malik', 'Inès', 'Hugo', 'Sarah', 'Nora', 'Théo', 'Jade'];
  const st = etatParDefaut(session);
  st.scene = SCENE_FORCEE || 'live';
  st.noms = {}; st.onair = [];
  for (let i = 0; i < Math.min(DEMO, 11); i++) { const id = 'demo' + i; st.noms[id] = noms[i]; st.onair.push(id); creerTuile(id, noms[i], { demo: true }); }
  const nSrc = Math.min(4, parseInt(Q.get('sources') || '1', 10));
  st.sources = Array.from({ length: nSrc }, (_, i) => ({ type: 'ecran', ref: 'demoecran' + i, nom: 'Source ' + (i + 1), actif: true, demo: true }));
  if (Q.get('defilant')) st.defilant = { texte: Q.get('defilant'), actif: true };
  st.layout = Q.get('layout') || 'grille';
  if (Q.get('quiz')) st.quiz = { dispo: Q.get('qdispo') || 'centre', active: { qid: 'd', q: Q.get('qlong') ? 'Dans quel film, sorti en 2006 et réalisé par Martin Campbell, Daniel Craig enfile-t-il pour la toute première fois le smoking de James Bond ?' : 'Dans quel film Daniel Craig devient-il 007 ?', choix: ['Casino Royale', 'Skyfall', 'Spectre', 'Quantum of Solace'], duree: 15, debut: Date.now(), revele: Q.get('quiz') === 'revele', bonne: 0, resultats: [{ nom: 'Antho', ms: 2300, pts: 950 }], img: Q.get('qimg') || null }, style: Q.get('qstyle') || 'theme' };
  if (Q.get('st')) setTimeout(() => afficherST({ ecran: true, l: [{ nom: 'Antho', c: Q.get('st') === 'neutre' ? '' : '#FFD84D', t: 'Franchement, le deuxième film est encore meilleur que le premier.' }, { nom: 'Sebastian', c: Q.get('st') === 'neutre' ? '' : '#FFFFFF', t: 'Attends, tu oublies la scène du ver des sables, elle est folle' }] }), 600);
  if (Q.get('st')) st.st = { actif: true, ecran: true };
  if (Q.get('watch')) st.watch = { titre: 'Dune : Deuxième Partie', pos: 2537, ref: Date.now(), lecture: Q.get('watch') !== 'pause', duree: 9960, top: Q.get('watch') === 'top' ? Date.now() + 3600 : null, pastille: true };
  if (Q.get('fil')) st.chatFil = { actif: true, msgs: [{ p: 'youtube', a: 'Camille', t: 'Salut tout le monde !' }, { p: 'twitch', a: 'BondFan_007', t: 'Daniel Craig reste le meilleur Bond, Casino Royale est un chef-d\'œuvre.' }, { p: 'youtube', a: 'Malik', t: 'Vous parlez de Skyfall à quelle heure ?' }, { p: 'twitch', a: 'lea_cine', t: 'Team Sean Connery ici' }, { p: 'youtube', a: 'Hugo', t: 'La scène du train est incroyable' }] };
  if (Q.get('chat')) st.chatAffiche = { p: Q.get('chat'), auteur: 'BondFan_007', texte: 'Daniel Craig reste le meilleur Bond, Casino Royale est un chef-d\'œuvre !', ts: 1 };
  if (Q.get('classement')) st.quiz = { dispo: Q.get('qdispo') || 'centre', afficherScores: true, classement: ['Antho', 'Landri', 'Camille', 'Yanis', 'Léa', 'Malik', 'Inès', 'Hugo'].slice(0, +Q.get('classement') > 1 ? +Q.get('classement') : 3).map((nom, i) => ({ nom, pts: 2850 - i * 310 })) };
  st.message = 'Pose tes questions dans le chat';
  appliquerEtat(st);
} else {
  hote = creerTuile(idHote(session), session.hote);
  appliquerEtat(etatParDefaut(session));
}
