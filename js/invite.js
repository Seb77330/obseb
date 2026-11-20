/* MESA : coulisses des invités */
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
// live programmé : le rendez-vous, à l'heure de l'invité (pas affiché une fois l'heure passée depuis longtemps)
if (session.debut && session.debut > Date.now() - 6 * 3600e3) {
  $('#rdv').hidden = false;
  $('#rdv b').textContent = quandTexte(session.debut);
  const majRdv = () => { $('#rdv span').textContent = dansTexte(session.debut); };
  majRdv(); setInterval(majRdv, 30000);
  $('#rdv-agenda').onclick = () => telechargerAgenda(session, location.href);
}
$('#hote2').textContent = session.hote;
$('#chaine').textContent = session.handle || HANDLE_DEFAUT;
$('#pastille').innerHTML = theme.logo ? `<img src="${esc(theme.logo)}" alt="" style="height:28px;display:block">` : (theme.logoTexte ? esc(theme.logoTexte) : MESA_M);
$('#pastille').classList.toggle('mesa', !theme.logo && !theme.logoTexte);

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
/* « Vue invité » de la régie (invite.html?essai=1) : la même page, sans caméra, reliée à la régie ouverte dans ce navigateur.
   L'animateur voit ce que voit un invité et peut répondre au quiz lui-même. */
const ESSAI = !CAM_DISTANTE && new URLSearchParams(location.search).get('essai') === '1';
const CLE = 'studioSeb:' + (CAM_DISTANTE ? 'camdist:' : 'invite:') + session.room;
let moi = null;
try { moi = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { /* rien */ }
if (moi && moi.nom) $('#prenom').value = moi.nom;
// les conditions d'utilisation : l'invité les accepte une fois (retenu pour ce live) ; inutile pour ta propre vue d'essai ou ton téléphone-caméra
const caseCgu = $('#cgu-ok');
if (ESSAI || CAM_DISTANTE) { $('#cgu-case').hidden = true; caseCgu.required = false; caseCgu.checked = true; }
else if (moi && moi.cgu) caseCgu.checked = true;
caseCgu.addEventListener('invalid', () => $('#cgu-case').classList.add('oubli'));
const majCgu = () => caseCgu.setCustomValidity(caseCgu.checked ? '' : 'Coche la case pour accepter les conditions d\'utilisation.');
majCgu();
caseCgu.addEventListener('change', () => { $('#cgu-case').classList.remove('oubli'); majCgu(); });

$('#form').onsubmit = e => {
  e.preventDefault();
  const nom = $('#prenom').value.trim();
  if (!nom) return;
  if (caseCgu.required && !caseCgu.checked) { $('#cgu-case').classList.add('oubli'); return; }
  if (!moi || moi.nom !== nom) moi = { nom, id: CAM_DISTANTE ? `${session.room}_rc_${rnd(6)}` : `${session.room}_${slug(nom, 8)}${rnd(4)}` };
  if (caseCgu.checked) moi.cgu = Date.now();
  try { localStorage.setItem(CLE, JSON.stringify(moi)); } catch (err) { /* rien */ }
  entrer();
};

let maCamera, apercu;
function entrer() {
  $('#accueil').hidden = true;
  $('#coulisses').hidden = false;
  if (ESSAI) {
    document.body.classList.add('essai'); $('#bandeau-essai').hidden = false;
    maCamera = $('#ma-camera');   // cadre vide : rien n'est filmé ni envoyé
    const canal = new BroadcastChannel('obseb-essai-' + session.room);
    // ce que la page enverrait à la salle part vers la régie, et ce que la régie envoie arrive comme si la salle l'apportait
    maCamera.contentWindow.addEventListener('message', e => { if (e.data && e.data.sendData) canal.postMessage({ sendData: e.data.sendData }); });
    canal.onmessage = e => dispatchEvent(new MessageEvent('message', { data: e.data, source: maCamera.contentWindow }));
    apercu = $('#apercu');
    apercu.src = `sortie.html?preview=1&musique=0#s=${hashParams().get('s')}`;
    ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom } }, type: 'rpcs' });   // « je suis là » : la régie répond avec l'état du live
    return;
  }
  // réglage caméra + micro avec aperçu, puis la caméra rejoint le live avec ces appareils
  const cle = 'studioSeb:appareils:invite';
  const reglage = ReglagesMedia({ boite: $('#cam-reglage'), cle, texteBouton: 'Entrer en coulisses', surDemarrer: demarrer, effets: !CAM_DISTANTE });
  function demarrer(app) {
    $('#cam-reglage').hidden = true; $('#cam-direct').hidden = false;
    $('#cam-appareils').textContent = [app.nomCam, app.nomMic, app.flou ? 'fond flou' : '', app.antibruit ? 'anti-bruit' : ''].filter(Boolean).join(' · ');
    maCamera = $('#ma-camera');
    // l'invité entend tout le monde ici ; flou et anti-bruit sont traduits pour le transport du live (voir vdo() dans common.js)
    maCamera.src = urlPublier(session, moi.id, moi.nom, { vd: app.vd, ad: app.ad, autostart: true, flou: app.flou || false, antibruit: !!app.antibruit });
  }
  $('#btn-cam-changer').onclick = () => {
    $('#ma-camera').src = 'about:blank'; maCamera = null; majCoupe({ mic: false, cam: false });
    $('#cam-direct').hidden = true; $('#cam-reglage').hidden = false; reglage.ouvrir();
  };
  reglage.ouvrir();
  apercu = $('#apercu');
  apercu.src = `sortie.html?preview=1${CAM_DISTANTE ? '&musique=0' : ''}#s=${hashParams().get('s')}&moi=${encodeURIComponent(moi.id)}`;   // « moi » : avec le serveur MESA, l'aperçu s'ouvre une fois l'invité admis
  $('#mon-nom').value = moi.nom;
}

/* Couper son micro, sa caméra, ou quitter le live : l'invité garde la main sur ce qu'il envoie.
   L'ordre part à sa fenêtre caméra (vdo.ninja ou serveur MESA, mêmes mots : mic, camera, close),
   et la régie l'apprend avec le prochain « je suis là » (champ coupe). */
let coupe = { mic: false, cam: false };
function majCoupe(c) {
  coupe = Object.assign({}, coupe, c);
  const bm = $('#btn-mon-micro'), bc = $('#btn-ma-cam');
  bm.setAttribute('aria-pressed', String(coupe.mic)); bm.textContent = coupe.mic ? '🔇 Micro coupé' : '🎤 Couper mon micro'; bm.title = coupe.mic ? 'Clique pour remettre ton micro' : '';
  bc.setAttribute('aria-pressed', String(coupe.cam)); bc.textContent = coupe.cam ? '🚫 Caméra coupée' : '📷 Couper ma caméra'; bc.title = coupe.cam ? 'Clique pour remettre ta caméra' : '';
}
$('#btn-mon-micro').onclick = () => {
  if (!maCamera) return;
  majCoupe({ mic: !coupe.mic }); ordre(maCamera, { mic: !coupe.mic }); direBonjour();
  if (coupe.mic) monEcoute.arreter();   // les sous-titres reprendront avec le prochain état du live
};
$('#btn-ma-cam').onclick = () => {
  if (!maCamera) return;
  majCoupe({ cam: !coupe.cam }); ordre(maCamera, { camera: !coupe.cam }); direBonjour();
};
$('#btn-quitter').onclick = () => {
  if (!confirm('Quitter le live ? Ta caméra et ton micro s\'éteignent tout de suite.')) return;
  if (maCamera) { ordre(maCamera, { close: true }); maCamera.src = 'about:blank'; }
  maCamera = null;
  const f = $('#mon-ecran'); f.src = 'about:blank'; f.hidden = true; ecranActif = false; $('#btn-mon-ecran').textContent = '🖥️ Partager mon écran';
  if (apercu) apercu.src = 'about:blank';
  monEcoute.arreter();
  $('#cam-direct').hidden = true; $('#cam-reglage').hidden = true; $('#parti').hidden = false;
  $('#statut').textContent = 'TU AS QUITTÉ LE LIVE';
};
$('#btn-revenir').onclick = () => location.reload();

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
function direBonjour() {
  if (!maCamera) return;
  ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom, q: maQualite, ecran: ecranActif ? moi.id + 'ecr' : null, besoin: besoinApercu, coupe } }, type: 'rpcs' });
  besoinApercu = '';
}
setInterval(() => {
  if (!maCamera) return;
  ordre(maCamera, { getStats: true });
  direBonjour();
}, 3000);

let besoinApercu = '';   // fichier que mon aperçu attend de la régie
addEventListener('message', e => {
  // un fichier choisi dans la régie (musique, image) manque à mon aperçu : je le demande à la régie avec mon prochain « je suis là »
  if (apercu && e.source === apercu.contentWindow && e.data && typeof e.data.studioSebBesoin === 'string') { besoinApercu = e.data.studioSebBesoin.slice(0, 40); return; }
  if (!maCamera || e.source !== maCamera.contentWindow) return;
  if (e.data && typeof e.data.obsebAttente === 'boolean') {    // salle d'attente du serveur MESA
    const statut = $('#statut');
    statut.textContent = e.data.obsebAttente ? 'SALLE D\'ATTENTE · L\'ANIMATEUR VA TE FAIRE ENTRER' : 'EN COULISSES';
    return;
  }
  if (e.data && typeof e.data.obsebRefus === 'string') { $('#statut').textContent = e.data.obsebRefus.toUpperCase(); return; }
  if (e.data && e.data.stats) {
    maQualite = resumeStats(e.data.stats);
    const el = $('#ma-qualite');
    if (el && maQualite.h) el.textContent = `Ton image part en ${maQualite.h}p${maQualite.kbps ? ' · ' + (maQualite.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}`;
  }
  // les morceaux d'un fichier envoyé par la régie vont à mon aperçu
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
  filmHote = st.watch && (st.scene === 'watch' || st.watch.lecture || (st.watch.pastille && st.watch.pos > 0) || (st.watch.top && maintenantHote() < st.watch.top + 1500)) ? st.watch : null;
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
  // micro coupé par l'invité : on n'écoute plus rien, même pour les sous-titres
  if (actifs && jeParle && monEcoute.dispo && !CAM_DISTANTE && !coupe.mic) monEcoute.demarrer(); else monEcoute.arreter();
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
  window.postMessage({ source: 'obseb-watch-page', role: 'invite', cible: w && (w.lecture || w.pos > 0) && !(w.top && t < w.top) ? { pos: positionFilm(w, t), lecture: !!w.lecture } : null }, location.origin);
}, 500);
addEventListener('message', e => { if (e.source === window && e.data && e.data.source === 'obseb-watch-ext') extInvite = Date.now(); });

/* ----- Mode quiz : répondre le plus vite possible ----- */
let quizVu = null;      // { qid, vuA (heure locale d'affichage), choix, duree, revele }
const vibrer = v => { try { if (navigator.vibrate) navigator.vibrate(v); } catch (e) { /* rien */ } };
const CLAVIER = matchMedia('(hover: hover) and (pointer: fine)').matches;
function gererQuiz(qz) {
  const box = $('#quiz');
  const a = qz && qz.active;
  if (!a) { box.hidden = true; quizVu = null; return; }
  const style = qz.style || 'theme';
  box.dataset.style = style;                       // la carte prend l'ambiance choisie en régie
  if (style === 'arcade') chargerPolices(['Press Start 2P']);
  if (style === 'bd') chargerPolices(['Bangers']);
  if (!quizVu || quizVu.qid !== a.qid) {
    quizVu = { qid: a.qid, vuA: performance.now(), choix: null, duree: a.duree, revele: false };
    box.hidden = true; void box.offsetWidth;        // nouvelle question : la carte rejoue son arrivée
    box.className = '';
    $('#qz-question').textContent = a.q;
    const im = $('#qz-image'); im.hidden = !a.img; if (a.img) im.src = a.img; else im.removeAttribute('src');
    const c = $('#qz-choix'); c.innerHTML = '';
    a.choix.forEach((txt, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qz-btn'; b.style.setProperty('--i', i);
      b.innerHTML = `<b>${'ABCD'[i]}</b><span></span>`; b.querySelector('span').textContent = txt;
      b.onclick = () => repondre(i);
      c.appendChild(b);
    });
    $('#qz-retour').textContent = CLAVIER ? 'Clique, ou tape A, B, C, D' : 'Touche ta réponse';
    $('#qz-verdict').className = ''; $('#qz-verdict').textContent = '';
    $('#qz-anneau').style.strokeDashoffset = 0;
    box.hidden = false;
    const r = box.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * .5) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    vibrer(40);
  }
  box.hidden = false;
  if (a.revele && !quizVu.revele) {
    quizVu.revele = true;
    box.classList.add('revele'); box.classList.remove('urgent');
    [...document.querySelectorAll('.qz-btn')].forEach((b, i) => { b.disabled = true; b.classList.toggle('bonne', i === a.bonne); b.classList.toggle('fausse', i !== a.bonne); });
    const res = a.resultats || [], rang = res.findIndex(r => r.id === moi.id), v = $('#qz-verdict');
    const bonne = a.choix[a.bonne] === undefined ? '' : `C'était ${'ABCD'[a.bonne]} : ${esc(a.choix[a.bonne])}`;
    if (rang >= 0) {
      v.className = 'gagne';
      v.innerHTML = `<b>+${res[rang].pts}</b><span>Bonne réponse !<small>${rang === 0 ? 'Tu es le plus rapide' : `${rang + 1}e plus rapide`}${res.length > 1 ? ` sur ${res.length}` : ''}</small></span>`;
      vibrer([60, 40, 140]);
    } else if (quizVu.choix === null) { v.className = 'temps'; v.innerHTML = `<span>Pas de réponse<small>${bonne}</small></span>`; }
    else { v.className = 'perdu'; v.innerHTML = `<span>Raté !<small>${bonne}</small></span>`; vibrer(180); }
    $('#qz-retour').textContent = ''; $('#qz-temps').textContent = '';
  }
}
function repondre(i) {
  if (!quizVu || quizVu.choix !== null || quizVu.revele) return;
  const ms = Math.round(performance.now() - quizVu.vuA);
  if (ms > quizVu.duree * 1000) return;
  quizVu.choix = i;
  $('#quiz').classList.add('repondu'); $('#quiz').classList.remove('urgent');
  document.querySelectorAll('.qz-btn').forEach((b, k) => { b.disabled = true; b.classList.toggle('choisi', k === i); });
  $('#qz-retour').textContent = `Envoyé en ${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  vibrer(30);
  const msg = { studioSebQuiz: { qid: quizVu.qid, choix: i, ms, id: moi.id } };
  // envoyé 3 fois pour être sûr qu'il arrive (seule la première réception compte)
  [0, 700, 1600].forEach(d => setTimeout(() => ordre(maCamera, { sendData: msg, type: 'rpcs' }), d));
}
/* au clavier : A, B, C, D ou 1, 2, 3, 4 */
addEventListener('keydown', e => {
  if (!quizVu || quizVu.choix !== null || quizVu.revele || $('#quiz').hidden || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = (e.key || '').toLowerCase(), i = 'abcd'.indexOf(k) >= 0 && k ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
  const b = document.querySelectorAll('.qz-btn')[i];
  if (k.length === 1 && b && !b.disabled) { e.preventDefault(); repondre(i); }
});
setInterval(() => {
  if (!quizVu || quizVu.revele || $('#quiz').hidden) return;
  const ms = Math.max(0, quizVu.duree * 1000 - (performance.now() - quizVu.vuA));
  $('#qz-temps').textContent = Math.ceil(ms / 1000);
  $('#qz-anneau').style.strokeDashoffset = (119.4 * (1 - ms / (quizVu.duree * 1000))).toFixed(1);
  $('#quiz').classList.toggle('urgent', quizVu.choix === null && ms > 0 && ms <= 5000);
  if (ms === 0 && quizVu.choix === null) {
    document.querySelectorAll('.qz-btn').forEach(b => b.disabled = true);
    $('#quiz').classList.add('fini');
    $('#qz-retour').textContent = 'Temps écoulé';
  }
}, 250);
garderEcranAllume();
if (ESSAI) { moi = { nom: 'Invité d\'essai', id: session.room + '_essai' }; entrer(); }
