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
  maCamera = $('#ma-camera');
  maCamera.src = urlPublier(session, moi.id, moi.nom);   // l'invité entend tout le monde ici
  apercu = $('#apercu');
  apercu.src = `sortie.html?preview=1#s=${hashParams().get('s')}`;
}

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
  const enDirect = (st.onair || []).includes(moi.id) && (st.scene === 'live' || st.scene === 'partage');
  const statut = $('#statut');
  statut.textContent = enDirect ? '● À L\'ANTENNE' : ((st.onair || []).includes(moi.id) ? 'PRÊT(E), À L\'ANTENNE AU PROCHAIN PLAN' : 'EN COULISSES');
  statut.classList.toggle('direct', enDirect);
});
