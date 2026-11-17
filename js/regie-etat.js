/* Régie : horloge, niveau de ton micro, et barre d'état en bas de l'écran.
   Chaque voyant dit en un coup d'œil si la chose marche (vert), demande ton attention (orange),
   est en panne (rouge) ou n'est pas utilisée (gris). Un clic ouvre le bon réglage. */
'use strict';

/* ----- Horloge ----- */
const elHorloge = $('#horloge');
function majHorloge() { elHorloge.textContent = new Date().toLocaleTimeString('fr-FR', { hour12: false }); }
setInterval(majHorloge, 500); majHorloge();

/* ----- Niveau de ton micro (mesuré ici, sans rien changer à ce qui part dans le live) ----- */
let microFlux = null, microCtx = null, microVu = 0, microEtat = 'off', microBoucle = null;
async function ecouterMicro() {
  if (microFlux || microEtat === 'ouverture') return;
  microEtat = 'ouverture';
  let choix = {};
  try { choix = JSON.parse(localStorage.getItem(CLE_CAM) || '{}'); } catch (e) { /* rien */ }
  try {
    microFlux = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: choix.mic ? { exact: choix.mic } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    microCtx = new (window.AudioContext || window.webkitAudioContext)();
    const an = microCtx.createAnalyser(); an.fftSize = 1024;
    microCtx.createMediaStreamSource(microFlux).connect(an);
    const d = new Float32Array(an.fftSize);
    microEtat = 'ok';
    microBoucle = setInterval(() => {
      an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      const db = 20 * Math.log10(Math.sqrt(s / d.length) || 1e-6);          // -60 dB (silence) à 0 dB (saturation)
      const n = Math.max(0, Math.min(50, (db + 60) / 60 * 50));
      const c = cartes.get(ID_HOTE);
      if (c && !etat.muet[ID_HOTE]) c.niveau = Math.max(c.niveau, n);
      if (db > -45) microVu = Date.now();
    }, 80);
  } catch (e) { microEtat = 'ko'; }
}
function lacherMicro() {
  clearInterval(microBoucle);
  if (microFlux) microFlux.getTracks().forEach(t => t.stop());
  if (microCtx) microCtx.close().catch(() => {});
  microFlux = microCtx = null; microEtat = 'off';
}
const cameraDemarree = () => !$('#cam-direct').hidden;

/* ----- Barre d'état ----- */
const barre = $('#etat-studio');
const VOYANTS = ['camera', 'micro', 'sortie', 'invites', 'chat', 'diffusion', 'serveur'];
const NOMS_VOYANTS = { camera: 'Caméra', micro: 'Micro', sortie: 'Sortie OBS', invites: 'Invités', chat: 'Chat', diffusion: 'Diffusion', serveur: 'Serveur' };
const elsVoyant = {};
for (const id of VOYANTS) {
  const b = document.createElement('button');
  b.dataset.court = NOMS_VOYANTS[id];
  b.innerHTML = '<span class="voyant"></span><span class="txt"></span>';
  barre.appendChild(b); elsVoyant[id] = b;
}
const elDirect = document.createElement('button');
elDirect.className = 'pousse'; elDirect.innerHTML = '<span class="voyant"></span><span class="txt"></span>';
elDirect.onclick = () => $('#btn-direct').click();
barre.appendChild(elDirect);

const frais = (t, ms) => !!t && Date.now() - t < ms;
function poser(el, niveau, texte, aide) {
  el.querySelector('.voyant').className = 'voyant' + (niveau === 'off' ? '' : ' ' + niveau);
  el.dataset.niveau = niveau;
  // tout va bien, ou pas utilisé : juste le nom. Le détail s'affiche au survol, et en clair dès qu'il y a un souci.
  const calme = niveau === 'ok' || niveau === 'off', court = el.dataset.court;
  el.querySelector('.txt').innerHTML = court && calme ? court : texte;
  el.title = [court && calme ? texte.replace(/<[^>]+>/g, '') : '', aide || ''].filter(Boolean).join('. ');
}
function majEtatStudio() {
  // le micro n'est écouté que quand ta caméra tourne (et relâché si tu changes d'appareil)
  if (cameraDemarree()) ecouterMicro(); else if (microFlux) lacherMicro();

  // Caméra
  if (!cameraDemarree()) poser(elsVoyant.camera, 'off', 'Caméra : pas démarrée', 'Démarre ta caméra dans la colonne de gauche');
  else if (!statsCamera || !frais(statsCamera.vu, 10000)) poser(elsVoyant.camera, 'att', 'Caméra : démarrage…', 'En attente des premières mesures');
  else poser(elsVoyant.camera, 'ok', `<b>Caméra</b>${statsCamera.h ? ' ' + statsCamera.h + 'p' : ''}${statsCamera.kbps ? ' · ' + (statsCamera.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}`,
    statsCamera.h && statsCamera.h < 1000 ? 'Les aperçus reçoivent une image réduite : la 1080p part dès que la sortie OBS est branchée.' : 'Ta caméra part bien');

  // Micro
  if (!cameraDemarree()) poser(elsVoyant.micro, 'off', 'Micro : pas démarré');
  else if (etat.muet[ID_HOTE]) poser(elsVoyant.micro, 'ko', '<b>Micro coupé</b>', 'Tu es en muet : clique pour remettre le son');
  else if (microEtat === 'ko') poser(elsVoyant.micro, 'off', 'Micro : niveau non mesuré', 'Le micro part dans le live, mais je ne peux pas afficher son niveau ici');
  else if (frais(microVu, 15000)) poser(elsVoyant.micro, 'ok', '<b>Micro</b> · ça capte', 'Ton micro capte du son');
  else poser(elsVoyant.micro, 'att', '<b>Micro</b> : aucun son', 'Rien entendu depuis 15 secondes : parle, ou vérifie le micro choisi');

  // Sortie OBS
  const h = frais(sortieVue.horizontal, 10000), v = frais(sortieVue.vertical, 10000);
  if (h || v) poser(elsVoyant.sortie, 'ok', `<b>Sortie OBS</b> · ${h && v ? 'horizontal et vertical' : h ? 'horizontal' : 'vertical'}`, 'La source navigateur d\'OBS reçoit bien le programme');
  else if (statsCamera && statsCamera.n !== null && statsCamera.n <= 1) poser(elsVoyant.sortie, 'att', 'Sortie OBS : pas branchée', 'Aucune source OBS ne reçoit le programme. Clique pour copier le lien OBS.');
  else poser(elsVoyant.sortie, 'off', 'Sortie OBS : non détectée', 'Clique pour copier le lien à mettre dans une source navigateur d\'OBS');

  // Invités
  const invites = [...presents.keys()].filter(id => id !== ID_HOTE && !estEcran(id) && !camsLocales.has(id));
  const faibles = invites.filter(id => { const q = qualites.get(id); return q && (q.h < 480 || q.kbps < 600); });
  if (!invites.length) poser(elsVoyant.invites, 'off', 'Invités : aucun', 'Clique pour copier le lien à envoyer à tes invités');
  else if (faibles.length) poser(elsVoyant.invites, 'att', `<b>${invites.length} invité${invites.length > 1 ? 's' : ''}</b> · ${faibles.length} connexion${faibles.length > 1 ? 's' : ''} faible${faibles.length > 1 ? 's' : ''}`, faibles.map(id => etat.noms[id]).join(', ') + ' : image dégradée');
  else poser(elsVoyant.invites, 'ok', `<b>${invites.length} invité${invites.length > 1 ? 's' : ''}</b>`, 'Tous tes invités ont une bonne connexion');

  // Chat
  const chats = ['twitch', 'youtube'].filter(p => $('#chat-etat-' + p).classList.contains('ok'));
  const chatKo = ['twitch', 'youtube'].filter(p => $('#chat-etat-' + p).classList.contains('ko'));
  if (chats.length) poser(elsVoyant.chat, chatKo.length ? 'att' : 'ok', `<b>Chat</b> · ${chats.map(p => p[0].toUpperCase() + p.slice(1)).join(', ')}`, 'Les messages arrivent dans l\'onglet Chat');
  else if (chatKo.length) poser(elsVoyant.chat, 'ko', '<b>Chat</b> : connexion perdue', 'Ouvre l\'onglet Chat pour voir le détail');
  else poser(elsVoyant.chat, 'off', 'Chat : non connecté', 'Connecte Twitch ou YouTube dans l\'onglet Chat');

  // Diffusion
  const pretes = plateformesPretes().length;
  poser(elsVoyant.diffusion, pretes ? 'ok' : 'off', pretes ? `<b>Diffusion</b> · ${pretes} plateforme${pretes > 1 ? 's' : ''} prête${pretes > 1 ? 's' : ''}` : 'Diffusion : aucune plateforme', 'Les plateformes où ton direct partira (onglet Diffusion)');

  // Serveur
  poser(elsVoyant.serveur, session.serveur ? 'ok' : 'off', session.serveur ? '<b>Serveur</b> branché' : 'Envoi par OBS',
    session.serveur ? 'La vidéo passe par ton serveur' : 'Pas de serveur pour ce live : c\'est OBS qui envoie l\'image aux plateformes');

  // Direct
  const d = etat.direct;
  poser(elDirect, d ? 'ko' : 'off', d ? `<b>EN DIRECT</b> depuis <span class="tc">${hms(Date.now() - d.debut)}</span>` : 'Hors antenne · rien ne part', d ? 'Clique pour couper une plateforme ou arrêter le direct' : 'Tu peux tout régler tranquillement : rien ne part tant que tu n\'as pas démarré le direct');
}
/* Les sept chevrons : un par voyant. Un chevron s'enclenche si la chose marche, ou si tu ne t'en sers pas
   (pas de chat, pas d'invité : ça ne bloque rien). La caméra et le micro, eux, doivent être démarrés. */
const NOMS_CHEVRON = { camera: 'Caméra', micro: 'Micro', sortie: 'Sortie OBS', invites: 'Invités', chat: 'Chat', diffusion: 'Diffusion', serveur: 'Serveur' };
function chevrons() {
  majEtatStudio();
  return VOYANTS.map(id => {
    const el = elsVoyant[id], niveau = el.dataset.niveau;
    const ok = niveau === 'ok' || (niveau === 'off' && id !== 'camera' && id !== 'micro');
    return { id, nom: NOMS_CHEVRON[id], ok, texte: el.querySelector('.txt').textContent, aide: el.title };
  });
}
elsVoyant.camera.onclick = () => { montrerPlateau(); $('.carte-moi').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
elsVoyant.micro.onclick = () => { if (etat.muet[ID_HOTE]) { etat.muet[ID_HOTE] = false; envoyer(); majEtatStudio(); toast('Micro rouvert'); } else { montrerPlateau(); $('.carte-moi').scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
elsVoyant.sortie.onclick = () => $('#btn-obs').click();
elsVoyant.invites.onclick = () => $('#btn-invite').click();
elsVoyant.chat.onclick = () => ouvrirOnglet('chat');
elsVoyant.diffusion.onclick = () => ouvrirOnglet('comptes');
elsVoyant.serveur.onclick = () => toast(session.serveur ? 'Ce live passe par ton serveur' : 'Sans serveur, c\'est OBS qui envoie le direct aux plateformes');
setInterval(majEtatStudio, 1000); majEtatStudio();
