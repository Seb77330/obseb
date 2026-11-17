/* OBSeb : page Sortie (source navigateur OBS, aperçus régie et invités) */
'use strict';

const Q = queryParams();
const PREVIEW = Q.has('preview');           // aperçu léger : basse qualité, sans son
const DEMO = parseInt(Q.get('demo') || '0', 10); // tuiles factices pour tester la mise en page
const SCENE_FORCEE = Q.get('scene');
const VERTICAL = Q.get('format') === 'vertical';
const LARG = VERTICAL ? SCENE_VW : SCENE_W, HAUT = VERTICAL ? SCENE_VH : SCENE_H;
if (VERTICAL) document.body.classList.add('vertical');
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
  if (src.type === 'image') el.innerHTML = `<img src="${esc(src.ref)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000">`;
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
  const disp = quizEnCours ? dispositionQuiz(ids, VERTICAL, st.quiz.dispo || 'centre') : VERTICAL
    ? (scene === 'partage' ? dispositionPartageV(ids, clesActives) : calculerDispositionV(st.layout, ids, st.focus))
    : (scene === 'partage' ? dispositionPartage(ids, clesActives) : calculerDisposition(st.layout, ids, st.focus));
  if (scene === 'watch' && !quizEnCours) Object.assign(disp, VERTICAL ? calculerDispositionV(st.layout, ids, st.focus, ZONE_WATCH_V) : calculerDisposition(st.layout, ids, st.focus, ZONE_WATCH));
  for (const t of tuiles.values()) {
    if (t.ecran) placer(t, scene === 'partage' ? disp[t.id] : null);
    else placer(t, disp[t.id]);
  }
  for (const [cle, o] of sourcesEl) placer(o, scene === 'partage' ? disp[cle] : null);
  placerPanneauQuiz(quizEnCours ? disp.__panneau : null);
  gererPlaylist();
  gererQuiz();
  gererChat();
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
    const active = nom === scene;
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

/* ----- Playlist de la régie ----- */
const lecteur = new Audio(); lecteur.preload = 'auto';
let pisteLocale = { idx: -1, n: -1 };
lecteur.addEventListener('ended', () => {
  const l = (etat && etat.playlist) || [];
  if (!l.length) return;
  pisteLocale.idx = (pisteLocale.idx + 1) % l.length;
  lecteur.src = l[pisteLocale.idx].url; lecteur.play().catch(() => {});
});
function gererPlaylist() {
  if (PREVIEW || DEMO || !etat) return;
  const l = etat.playlist || [], m = etat.musique || {};
  if (!l.length) { lecteur.pause(); return; }
  if (m.idx !== pisteLocale.idx || m.n !== pisteLocale.n) {
    pisteLocale = { idx: m.idx, n: m.n };
    const piste = l[m.idx] || l[0];
    if (lecteur.src !== piste.url) lecteur.src = piste.url;
  }
  lecteur.volume = Math.min(1, etat.volMusique ?? 0.5);
  if (m.lecture && lecteur.paused) lecteur.play().catch(() => {});
  if (!m.lecture && !lecteur.paused) lecteur.pause();
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
if (!PREVIEW && !DEMO) setInterval(() => { if (hote) ordre(hote.iframe, { sendData: { studioSebSortie: { v: VERTICAL ? 1 : 0 } }, type: 'rpcs' }); }, 3000);

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
  if (Q.get('watch')) st.watch = { titre: 'Dune : Deuxième Partie', pos: 2537, ref: Date.now(), lecture: Q.get('watch') !== 'pause', duree: 9960, top: Q.get('watch') === 'top' ? Date.now() + 3600 : null, pastille: true };
  if (Q.get('chat')) st.chatAffiche = { p: Q.get('chat'), auteur: 'BondFan_007', texte: 'Daniel Craig reste le meilleur Bond, Casino Royale est un chef-d\'œuvre !', ts: 1 };
  if (Q.get('classement')) st.quiz = { dispo: Q.get('qdispo') || 'centre', afficherScores: true, classement: ['Antho', 'Landri', 'Camille', 'Yanis', 'Léa', 'Malik', 'Inès', 'Hugo'].slice(0, +Q.get('classement') > 1 ? +Q.get('classement') : 3).map((nom, i) => ({ nom, pts: 2850 - i * 310 })) };
  st.message = 'Pose tes questions dans le chat';
  appliquerEtat(st);
} else {
  hote = creerTuile(idHote(session), session.hote);
  appliquerEtat(etatParDefaut(session));
}
