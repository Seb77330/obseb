/* OBSeb : coulisses des invités */
'use strict';

const $ = s => document.querySelector(s);
const session = lireSession();
if (!session) {
  document.body.innerHTML = '<p style="color:#fff;font:18px Arial;padding:40px">Ce lien d\'invitation est incomplet. Demande à l\'animateur de te le renvoyer.</p>';
  throw new Error('Pas de session');
}
const theme = themeComplet(session);
appliquerTheme(theme);
document.title = `Invitation · ${session.titre}`;
$('#titre').textContent = session.titre;
$('#hote').textContent = session.hote;
$('#hote2').textContent = session.hote;
$('#chaine').textContent = session.handle || HANDLE_DEFAUT;
$('#pastille').innerHTML = theme.logo ? `<img src="${esc(theme.logo)}" alt="" style="height:28px;display:block">` : esc(theme.logoTexte || 'SEB');

/* Lien « caméra à distance » (invite.html?cam=1) : ce téléphone ou ce PC devient une caméra de l'animateur */
const CAM_DISTANTE = new URLSearchParams(location.search).get('cam') === '1';
if (CAM_DISTANTE) {
  document.body.classList.add('camera-distante');
  document.title = `Caméra · ${session.titre}`;
  $('#accueil .sur').textContent = 'Caméra à distance';
  $('#accueil p').textContent = `Cet appareil devient une caméra du live de ${session.hote}. Donne-lui un nom pour la reconnaître en régie.`;
  $('#prenom').placeholder = 'Ex. Caméra salon, Plan large';
  $('#form button').textContent = 'Brancher cette caméra';
}
const CLE = 'studioSeb:' + (CAM_DISTANTE ? 'camdist:' : 'invite:') + session.room;
let moi = null;
try { moi = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { /* rien */ }
if (moi && moi.nom) $('#prenom').value = moi.nom;

$('#form').onsubmit = e => {
  e.preventDefault();
  const nom = $('#prenom').value.trim();
  if (!nom) return;
  if (!moi || moi.nom !== nom) moi = { nom, id: CAM_DISTANTE ? `${session.room}_rc_${rnd(6)}` : `${session.room}_${slug(nom, 8)}${rnd(4)}` };
  try { localStorage.setItem(CLE, JSON.stringify(moi)); } catch (err) { /* rien */ }
  entrer();
};

let maCamera, apercu;
function entrer() {
  $('#accueil').hidden = true;
  $('#coulisses').hidden = false;
  // réglage caméra + micro avec aperçu, puis la caméra rejoint le live avec ces appareils
  const cle = 'studioSeb:appareils:invite';
  const reglage = ReglagesMedia({ boite: $('#cam-reglage'), cle, texteBouton: 'Entrer en coulisses', surDemarrer: demarrer });
  function demarrer(app) {
    $('#cam-reglage').hidden = true; $('#cam-direct').hidden = false;
    $('#cam-appareils').textContent = [app.nomCam, app.nomMic].filter(Boolean).join(' · ');
    maCamera = $('#ma-camera');
    maCamera.src = urlPublier(session, moi.id, moi.nom, { vd: app.vd, ad: app.ad, autostart: true });   // l'invité entend tout le monde ici
  }
  $('#btn-cam-changer').onclick = () => {
    $('#ma-camera').src = 'about:blank'; maCamera = null;
    $('#cam-direct').hidden = true; $('#cam-reglage').hidden = false; reglage.ouvrir();
  };
  reglage.ouvrir();
  apercu = $('#apercu');
  apercu.src = `sortie.html?preview=1#s=${hashParams().get('s')}`;
  $('#mon-nom').value = moi.nom;
}

/* L'invité peut changer le nom affiché sous sa caméra (sans changer d'identifiant) */
$('#form-nom').onsubmit = e => {
  e.preventDefault();
  const nom = $('#mon-nom').value.trim().slice(0, 28);
  if (!nom || nom === moi.nom) return;
  moi.nom = nom;
  try { localStorage.setItem(CLE, JSON.stringify(moi)); } catch (err) { /* rien */ }
  ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom, q: maQualite, ecran: ecranActif ? moi.id + 'ecr' : null } }, type: 'rpcs' });
  const b = e.submitter || $('#form-nom button'); b.textContent = 'C\'est fait ✓'; setTimeout(() => b.textContent = 'Renommer', 2000);
};

/* L'animateur envoie l'état du live : on affiche « À l'antenne » ou « En coulisses » */
/* Partage d'écran de l'invité (l'animateur décide s'il l'affiche) */
let ecranActif = false;
document.getElementById('btn-mon-ecran').onclick = () => {
  const f = $('#mon-ecran'), b = $('#btn-mon-ecran');
  if (ecranActif) { f.src = 'about:blank'; f.hidden = true; ecranActif = false; b.textContent = '🖥️ Partager mon écran'; return; }
  f.src = vdo({ room: session.room, push: moi.id + 'ecr', label: moi.nom + ' (écran)', screenshare: true, quality: 0,
    novideo: true, noaudio: true, ln: 'fr', cleanish: true });
  f.hidden = false; ecranActif = true; b.textContent = 'Arrêter le partage d\'écran';
};

/* Toutes les 3 s : on mesure sa qualité d'envoi et on dit « je suis là » à l'animateur */
let maQualite = null;
setInterval(() => {
  if (!maCamera) return;
  ordre(maCamera, { getStats: true });
  ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom, q: maQualite, ecran: ecranActif ? moi.id + 'ecr' : null, besoin: besoinApercu } }, type: 'rpcs' });
  besoinApercu = '';
}, 3000);

let besoinApercu = '';   // fichier que mon aperçu attend de la régie
addEventListener('message', e => {
  if (!maCamera || e.source !== maCamera.contentWindow) return;
  if (e.data && e.data.stats) {
    maQualite = resumeStats(e.data.stats);
    const el = $('#ma-qualite');
    if (el && maQualite.h) el.textContent = `Ton image part en ${maQualite.h}p${maQualite.kbps ? ' · ' + (maQualite.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}`;
  }
  // une image choisie dans la régie : les morceaux vont à mon aperçu ; s'il lui en manque une, je la demande à la régie
  if (e.source === apercu.contentWindow && e.data && typeof e.data.studioSebBesoin === 'string') { besoinApercu = e.data.studioSebBesoin.slice(0, 40); return; }
  const morceau = e.data && e.data.dataReceived && e.data.dataReceived.studioSebFichier;
  if (morceau && !(typeof e.data.streamID === 'string' && e.data.streamID !== idHote(session))) { ordre(apercu, { studioSebFichier: morceau }); return; }
  const sousT = e.data && e.data.dataReceived && e.data.dataReceived.studioSebST;
  if (sousT && !(typeof e.data.streamID === 'string' && e.data.streamID !== idHote(session))) { ordre(apercu, { studioSebST: sousT }); return; }
  const st = e.data && e.data.dataReceived && e.data.dataReceived[CANAL];
  if (!st) return;
  // seul l'animateur pilote les coulisses : un autre invité ne peut pas envoyer de faux ordres
  if (typeof e.data.streamID === 'string' && e.data.streamID !== idHote(session)) return;
  ordre(apercu, { [CANAL]: st });
  calerHorloge(st.ts);
  gererQuiz(st.quiz);
  filmHote = st.watch && (st.scene === 'watch' || st.watch.lecture || st.watch.pastille || (st.watch.top && maintenantHote() < st.watch.top + 1500)) ? st.watch : null;
  majWatchInvite();
  const enDirect = (st.onair || []).includes(moi.id) && sceneCameras(st.scene);
  reglerSousTitres(!!(st.st && st.st.actif), enDirect && !(st.muet || {})[moi.id]);
  const statut = $('#statut');
  statut.textContent = enDirect ? '● À L\'ANTENNE' : ((st.onair || []).includes(moi.id) ? 'PRÊT(E), À L\'ANTENNE AU PROCHAIN PLAN' : 'EN COULISSES');
  statut.classList.toggle('direct', enDirect);
});

/* ----- Sous-titres : ma voix est transcrite ici, puis envoyée à l'animateur avec mon nom ----- */
const monEcoute = creerEcoute(st => { if (maCamera) ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom, st } }, type: 'rpcs' }); });
function reglerSousTitres(actifs, jeParle) {
  $('#st-info').hidden = !(actifs && monEcoute.dispo) || CAM_DISTANTE;
  if (actifs && jeParle && monEcoute.dispo && !CAM_DISTANTE) monEcoute.demarrer(); else monEcoute.arreter();
}

/* ----- Watch Party : le minuteur du film de l'animateur, pour se caler dessus ----- */
let filmHote = null, extInvite = 0;
function majWatchInvite() {
  const box = $('#watch-invite'), w = filmHote;
  box.hidden = !w;
  if (!w) return;
  const t = maintenantHote(), pos = positionFilm(w, t), enCompte = w.top && t < w.top;
  $('#wi-temps').textContent = enCompte ? Math.ceil((w.top - t) / 1000) : texteFilm(pos);
  $('#wi-titre').textContent = enCompte ? `Lance ton film à ${texteFilm(w.pos)} quand ça arrive à zéro` : (w.titre || '');
  const e = $('#wi-etat');
  e.textContent = enCompte ? 'TOP DÉPART' : w.lecture ? '● LECTURE' : 'EN PAUSE';
  e.classList.toggle('lecture', !!w.lecture && !enCompte); e.classList.toggle('top', !!enCompte);
  $('#wi-aide').textContent = Date.now() - extInvite < 5000
    ? 'L\'extension cale ton film toute seule sur celui de l\'animateur.'
    : 'Mets ton film au même endroit que ce minuteur. Le film n\'est pas diffusé : chacun le regarde chez soi.';
}
/* Avec l'extension, le film de l'invité suit tout seul : on lui donne la position voulue deux fois par seconde */
setInterval(() => {
  majWatchInvite();
  const w = filmHote, t = maintenantHote();
  window.postMessage({ source: 'obseb-watch-page', role: 'invite', cible: w && !(w.top && t < w.top) ? { pos: positionFilm(w, t), lecture: !!w.lecture } : null }, location.origin);
}, 500);
addEventListener('message', e => { if (e.source === window && e.data && e.data.source === 'obseb-watch-ext') extInvite = Date.now(); });

/* ----- Mode quiz : répondre le plus vite possible ----- */
let quizVu = null;      // { qid, vuA (heure locale d'affichage), choix, envoye }
function gererQuiz(qz) {
  const box = $('#quiz');
  const a = qz && qz.active;
  if (!a) { box.hidden = true; quizVu = null; return; }
  box.hidden = false;
  if (!quizVu || quizVu.qid !== a.qid) {
    quizVu = { qid: a.qid, vuA: performance.now(), choix: null, duree: a.duree, revele: false };
    $('#qz-question').textContent = a.q;
    const im = $('#qz-image'); im.hidden = !a.img; if (a.img) im.src = a.img;
    const c = $('#qz-choix'); c.innerHTML = '';
    a.choix.forEach((txt, i) => {
      const b = document.createElement('button');
      b.className = 'qz-btn'; b.innerHTML = `<b>${'ABCD'[i]}</b>`; b.append(txt);
      b.onclick = () => repondre(i);
      c.appendChild(b);
    });
    $('#qz-retour').textContent = 'Réponds le plus vite possible !';
  }
  const btns = [...document.querySelectorAll('.qz-btn')];
  quizVu.revele = !!a.revele;
  if (a.revele) {
    btns.forEach((b, i) => { b.disabled = true; b.classList.toggle('bonne', i === a.bonne); b.classList.toggle('fausse', i !== a.bonne); });
    const moi_r = (a.resultats || []).find(r => r.id === moi.id);
    $('#qz-retour').textContent = moi_r ? `Bonne réponse ! +${moi_r.pts} points` : (quizVu.choix === null ? 'Temps écoulé.' : 'Raté, ce sera pour la prochaine !');
    $('#qz-temps').textContent = '';
  }
}
function repondre(i) {
  if (!quizVu || quizVu.choix !== null) return;
  const ms = Math.round(performance.now() - quizVu.vuA);
  quizVu.choix = i;
  document.querySelectorAll('.qz-btn').forEach((b, k) => { b.disabled = true; b.classList.toggle('choisi', k === i); });
  $('#qz-retour').textContent = `Réponse envoyée en ${(ms / 1000).toFixed(1).replace('.', ',')} s. Attends la révélation…`;
  const msg = { studioSebQuiz: { qid: quizVu.qid, choix: i, ms, id: moi.id } };
  // envoyé 3 fois pour être sûr qu'il arrive (seule la première réception compte)
  [0, 700, 1600].forEach(d => setTimeout(() => ordre(maCamera, { sendData: msg, type: 'rpcs' }), d));
}
setInterval(() => {
  if (!quizVu || quizVu.revele || $('#quiz').hidden) return;
  const reste = Math.max(0, Math.ceil(quizVu.duree - (performance.now() - quizVu.vuA) / 1000));
  $('#qz-temps').textContent = reste + ' s';
  if (reste === 0 && quizVu.choix === null) {
    document.querySelectorAll('.qz-btn').forEach(b => b.disabled = true);
    $('#qz-retour').textContent = 'Temps écoulé.';
  }
}, 250);
garderEcranAllume();
