/* Régie : sous-titres en direct.
   Chaque personne est transcrite par son propre navigateur, puis son texte arrive ici avec son nom.
   La régie l'affiche à l'écran (si tu le veux) et garde les répliques du direct, avec leur minutage,
   pour que tu puisses les corriger et les télécharger depuis « Lives terminés ». */
'use strict';

etat.st = Object.assign({ actif: false, ecran: true, parCouleur: true, couleurs: {}, moteur: 'navigateur' }, etat.st || {});
/* Couleurs lisibles sur fond sombre, bien distinctes entre elles. La première personne (toi) est en blanc. */
const PALETTE_ST = ['#FFFFFF', '#FFD84D', '#5FD4FF', '#7BE08A', '#FF9ECF', '#FFA95C', '#B9A5FF', '#6FE3C8', '#FF8A80'];
function couleurST(id) {
  const c = etat.st.couleurs;
  if (!c[id]) { const prises = Object.values(c); c[id] = PALETTE_ST.find(x => !prises.includes(x)) || PALETTE_ST[Object.keys(c).length % PALETTE_ST.length]; }
  return c[id];
}
const CLE_ST = 'studioSeb:st:' + session.room;
const stLignes = new Map();     // id -> { t, f, vu } : ce que chacun est en train de dire
const stDebuts = new Map();     // id -> heure du début de la phrase en cours
let stArchive = null;           // { debut: heure de début du direct, segs: [{ a, b, id, nom, t }] }
try { stArchive = JSON.parse(localStorage.getItem(CLE_ST) || 'null'); } catch (e) { stArchive = null; }

const hoteALAntenne = () => etat.onair.some(estMaCamera);

/* Un texte arrive (de toi ou d'un invité) */
function sousTitreRecu(id, st) {
  if (!etat.st.actif || !st || typeof st.t !== 'string') return;
  const moi = id === ID_HOTE;
  if (etat.muet[id] || !(moi ? hoteALAntenne() : etat.onair.includes(id))) return;      // hors antenne ou en muet : rien
  const t = st.t.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!t) return;
  if (!stDebuts.has(id)) stDebuts.set(id, Date.now());
  stLignes.set(id, { t, f: !!st.f, vu: Date.now() });
  if (st.f) {
    const debut = stDebuts.get(id); stDebuts.delete(id);
    garderReplique(id, debut, Date.now(), t);
  }
  diffuserST();
}
/* Les répliques ne sont gardées que pendant le direct : leur minutage suit alors le replay */
function garderReplique(id, debut, fin, t) {
  const d = etat.direct; if (!d) return;
  if (!stArchive || stArchive.debut !== d.debut) stArchive = { debut: d.debut, segs: [] };
  stArchive.segs.push({ a: Math.max(0, debut - d.debut - 300), b: Math.max(0, fin - d.debut), id, nom: etat.noms[id] || '', t });
  sauverST();
}
function sauverST() {
  clearTimeout(sauverST.t);
  sauverST.t = setTimeout(() => { try { localStorage.setItem(CLE_ST, JSON.stringify(stArchive)); } catch (e) { /* plus de place */ } majST(); }, 800);
}
/* Envoi à l'écran : les deux dernières personnes qui parlent */
function diffuserST() {
  if (diffuserST.t) return;
  diffuserST.t = setTimeout(() => {
    diffuserST.t = null;
    const maintenant = Date.now();
    for (const [id, l] of stLignes) if (maintenant - l.vu > (l.f ? 4500 : 7000)) { stLignes.delete(id); stDebuts.delete(id); }
    const l = [...stLignes].sort((a, b) => a[1].vu - b[1].vu).slice(-2).map(([id, x]) => ({ nom: etat.noms[id] || '', t: x.t, c: etat.st.parCouleur ? couleurST(id) : '' }));
    const msg = { ecran: !!(etat.st.actif && etat.st.ecran), l };
    ordre(maCamera, { sendData: { studioSebST: msg }, type: 'pcs' });
    ordre(apercu, { studioSebST: msg });
  }, 150);
}
setInterval(() => { if (stLignes.size) diffuserST(); }, 1000);

/* Ta voix : écoutée ici, sur le micro choisi quand le navigateur le permet */
let stEtatHote = 'arret', stDetailHote = '';
const ecouteHote = creerEcoute(st => sousTitreRecu(ID_HOTE, st), (e, d) => { stEtatHote = e; stDetailHote = d ?? ''; majST(); },
  () => { const p = typeof microFlux !== 'undefined' && microFlux && microFlux.getAudioTracks()[0]; return p && p.readyState === 'live' ? p : null; },
  () => etat.st.moteur);
function reglerEcouteHote() {
  const veut = etat.st.actif && !$('#cam-direct').hidden && !etat.muet[ID_HOTE];
  if (veut && !ecouteHote.actif()) ecouteHote.demarrer();
  if (!veut && ecouteHote.actif()) ecouteHote.arreter();
  ecouteHote.suivreMoteur();
}
setInterval(reglerEcouteHote, 1000);

/* ----- Réglages (onglet Titres) ----- */
$('#st-actif').checked = !!etat.st.actif;
if (etat.st.actif) $('#pli-st').open = true;   // sous-titres en marche : la partie s'ouvre toute seule
$('#st-ecran').checked = !!etat.st.ecran;
$('#st-actif').onchange = e => {
  etat.st.actif = e.target.checked;
  if (!etat.st.actif) { stLignes.clear(); stDebuts.clear(); }
  envoyer(); reglerEcouteHote(); diffuserST(); majST();
  toast(etat.st.actif ? 'Sous-titres activés : chacun est transcrit sur son ordinateur' : 'Sous-titres arrêtés');
};
$('#st-moteur').value = etat.st.moteur === 'whisper' ? 'whisper' : 'navigateur';
$('#st-moteur').onchange = e => {
  etat.st.moteur = e.target.value;
  envoyer(); reglerEcouteHote(); majST();
  toast(etat.st.moteur === 'whisper' ? 'Whisper : chacun est transcrit par son ordinateur, sans rien envoyer' : 'Transcription par le navigateur (Chrome, Edge)');
};
$('#st-ecran').onchange = e => { etat.st.ecran = e.target.checked; envoyer(); diffuserST(); majST(); };
$('#st-couleurs').checked = !!etat.st.parCouleur;
$('#st-couleurs').onchange = e => { etat.st.parCouleur = e.target.checked; envoyer(); diffuserST(); majST(); };
/* Les pastilles : toi, puis chaque invité présent */
let stPaletteCle = '';
function majPaletteST() {
  const box = $('#st-palette');
  const ids = etat.st.actif && etat.st.parCouleur ? [ID_HOTE, ...[...presents.keys()].filter(id => !estCamDistante(id) && !estCamLocale(id) && id !== ID_HOTE)] : [];
  const cle = ids.map(id => id + ':' + (etat.noms[id] || '')).join('|');
  if (cle === stPaletteCle) return;      // rien n'a changé : on ne redessine pas (un choix de couleur peut être ouvert)
  stPaletteCle = cle; box.innerHTML = '';
  for (const id of ids) {
    const el = document.createElement('label');
    el.className = 'st-pers';
    el.innerHTML = '<input type="color"><span></span>';
    el.querySelector('span').textContent = etat.noms[id] || 'Invité';
    const champ = el.querySelector('input');
    champ.value = couleurST(id); champ.title = 'Couleur des sous-titres de ' + (etat.noms[id] || 'cet invité');
    champ.oninput = () => { etat.st.couleurs[id] = champ.value; diffuserST(); };
    champ.onchange = () => envoyer();
    box.appendChild(el);
  }
}
function majST() {
  majPaletteST();
  $('#st-couleurs').disabled = !etat.st.actif;
  const el = $('#st-etat'), v = $('#st-voyant');
  $('#st-ecran').disabled = !etat.st.actif;
  const n = stArchive && etat.direct && stArchive.debut === etat.direct.debut ? stArchive.segs.length : 0;
  let niveau = '', txt;
  const wh = etat.st.moteur === 'whisper';
  $('#st-moteur-info').textContent = wh
    ? 'La voix ne quitte pas l\'ordinateur et ça marche aussi dans Firefox et Safari. Le modèle (environ 80\u00a0Mo) se télécharge une fois par ordinateur. Il faut un ordinateur assez récent.'
    : 'Le plus léger. Tes invités doivent être sur Chrome ou Edge.';
  if (!ecouteHote.dispo) { niveau = 'att'; txt = 'Ce navigateur ne sait pas transcrire : ouvre la régie dans Chrome ou Edge, ou choisis Whisper.'; }
  else if (etat.st.actif && stEtatHote === 'chargement') { niveau = 'att'; txt = `Préparation de Whisper : ${stDetailHote || 0}\u00a0% (une seule fois sur cet ordinateur).`; }
  else if (etat.st.actif && stEtatHote === 'erreur') { niveau = 'ko'; txt = 'Whisper n\'a pas pu démarrer : ' + stDetailHote; }
  else if (!etat.st.actif) txt = 'Arrêtés. Rien n\'est transcrit.';
  else if (stEtatHote === 'refuse') { niveau = 'ko'; txt = 'Le navigateur a refusé l\'accès au micro pour la transcription.'; }
  else if ($('#cam-direct').hidden) { niveau = 'att'; txt = 'En attente : démarre ta caméra.'; }
  else if (!etat.direct) { niveau = 'ok'; txt = 'En marche. Les répliques seront gardées à partir du début du direct.'; }
  else { niveau = 'ok'; txt = `En marche · ${n} réplique${n > 1 ? 's' : ''} gardée${n > 1 ? 's' : ''} pour le replay.`; }
  v.className = 'voyant' + (niveau ? ' ' + niveau : '');
  el.textContent = txt;
}
setInterval(majST, 2000); majST();
