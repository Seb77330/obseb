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

const CLE = 'studioSeb:invite:' + session.room;
let moi = null;
try { moi = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { /* rien */ }
if (moi && moi.nom) $('#prenom').value = moi.nom;

$('#form').onsubmit = e => {
  e.preventDefault();
  const nom = $('#prenom').value.trim();
  if (!nom) return;
  if (!moi || moi.nom !== nom) moi = { nom, id: `${session.room}_${slug(nom, 8)}${rnd(4)}` };
  try { localStorage.setItem(CLE, JSON.stringify(moi)); } catch (err) { /* rien */ }
  entrer();
};

let maCamera, apercu;
function entrer() {
  $('#accueil').hidden = true;
  $('#coulisses').hidden = false;
  // réglage caméra + micro avec aperçu, puis la caméra rejoint le live avec ces appareils
  const cle = 'studioSeb:appareils:invite';
  const reglage = ReglagesMedia({ boite: $('#cam-reglage'), cle, texteBouton: 'Rejoindre les coulisses avec cette caméra', surDemarrer: demarrer });
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
  ordre(maCamera, { sendData: { studioSebSalut: { id: moi.id, nom: moi.nom, q: maQualite, ecran: ecranActif ? moi.id + 'ecr' : null } }, type: 'rpcs' });
}, 3000);

addEventListener('message', e => {
  if (!maCamera || e.source !== maCamera.contentWindow) return;
  if (e.data && e.data.stats) {
    maQualite = resumeStats(e.data.stats);
    const el = $('#ma-qualite');
    if (el && maQualite.h) el.textContent = `Ton image part en ${maQualite.h}p${maQualite.kbps ? ' · ' + (maQualite.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}`;
  }
  const st = e.data && e.data.dataReceived && e.data.dataReceived[CANAL];
  if (!st) return;
  ordre(apercu, { [CANAL]: st });
  gererQuiz(st.quiz);
  const enDirect = (st.onair || []).includes(moi.id) && (st.scene === 'live' || st.scene === 'partage');
  const statut = $('#statut');
  statut.textContent = enDirect ? '● À L\'ANTENNE' : ((st.onair || []).includes(moi.id) ? 'PRÊT(E), À L\'ANTENNE AU PROCHAIN PLAN' : 'EN COULISSES');
  statut.classList.toggle('direct', enDirect);
});

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
