/* Régie : multicam. Tes autres caméras (2 à 4), branchées sur ce PC, et les caméras à distance.
   Chaque caméra est une source comme une autre : tu peux l'afficher à côté de toi (duplex)
   ou basculer de l'une à l'autre d'un clic (commutation, comme un mélangeur vidéo).
   Elles n'envoient que l'image : ton micro reste celui de ta caméra principale, même quand elle n'est pas à l'écran. */
'use strict';

const CLE_CAMS = 'studioSeb:cams:' + session.room;
const NUMEROS_CAM = [2, 3, 4];

function sauverCams() {
  try { localStorage.setItem(CLE_CAMS, JSON.stringify([...camsLocales].map(([id, c]) => ({ n: +id.slice(-1), nom: c.nom, appareil: c.appareil })))); } catch (e) { /* rien */ }
}
function brancherCam(n, appareil, nom) {
  const id = idCam(session, n);
  if (camsLocales.has(id)) return;
  const f = document.createElement('iframe');
  f.allow = IFRAME_ALLOW;
  // image seule (ad=0), en 1080p si la caméra le peut (jamais de taille imposée : une caméra plus modeste refuserait de démarrer) ; la fenêtre sert aussi d'aperçu dans la carte
  f.src = urlPublier(session, id, nom || 'Caméra ' + n, { noaudio: true, vd: paramAppareil(appareil), ad: 0, autostart: true, maxframerate: 30, contenthint: 'detail' });
  camsLocales.set(id, { iframe: f, nom: nom || '', appareil });
  presents.set(id, { vu: Date.now() });
  etat.noms[id] = nom || '';
  sauverCams(); envoyer();
}
function retirerCam(id) {
  const c = camsLocales.get(id); if (!c) return;
  c.iframe.src = 'about:blank';
  camsLocales.delete(id); presents.delete(id);
  etat.onair = etat.onair.filter(x => x !== id);
  if (etat.focus === id) { etat.focus = null; if (etat.layout === 'solo') etat.layout = 'grille'; }
  delete etat.noms[id];
  // ne jamais laisser l'antenne vide parce qu'on débranche une caméra
  if (!etat.onair.some(estMaCamera)) etat.onair.unshift(ID_HOTE);
  sauverCams(); envoyer();
}

/* ----- Commutation : passer d'une de tes caméras à l'autre, au même endroit de l'écran ----- */
function mesCameras() { return [ID_HOTE, ...camsLocales.keys(), ...[...presents.keys()].filter(estCamDistante)]; }
function commuter(id) {
  const miennes = mesCameras();
  const place = etat.onair.findIndex(x => miennes.includes(x));
  etat.onair = etat.onair.filter(x => !miennes.includes(x));
  etat.onair.splice(place < 0 ? 0 : Math.min(place, etat.onair.length), 0, id);
  if (etat.layout === 'solo' && miennes.includes(etat.focus)) etat.focus = id;
  envoyer();
}
function majCommutation() {
  const box = $('#commutation'), miennes = mesCameras();
  box.hidden = miennes.length < 2;
  if (box.hidden) return;
  const cle = miennes.map(id => id + '|' + (etat.noms[id] || '')).join(',');
  if (box.dataset.cle !== cle) {
    box.dataset.cle = cle; box.innerHTML = '';
    miennes.forEach((id, i) => {
      const b = document.createElement('button');
      b.dataset.cam = id;
      b.textContent = id === ID_HOTE ? 'CAM 1' : estCamLocale(id) ? 'CAM ' + id.slice(-1) : (etat.noms[id] || 'À distance');
      b.title = 'Passer sur cette caméra (elle remplace l\'autre à l\'écran)';
      b.onclick = () => commuter(id);
      box.appendChild(b);
    });
  }
  box.querySelectorAll('button').forEach(b => b.classList.toggle('actif', etat.onair.includes(b.dataset.cam)));
}

/* ----- Ajouter une caméra ----- */
const camAjout = $('#cam-ajout');
async function ouvrirAjoutCam() {
  camAjout.hidden = false;
  const sel = $('#cam-choix'); sel.innerHTML = '';
  let principale = '';
  try { principale = JSON.parse(localStorage.getItem(CLE_CAM) || '{}').nomCam || ''; } catch (e) { /* rien */ }
  const prises = new Set([principale, ...[...camsLocales.values()].map(c => c.appareil)]);
  let appareils = [];
  try { appareils = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { /* rien */ }
  const libres = appareils.map(d => nomAppareil(d.label)).filter(n => n && !prises.has(n));
  libres.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
  const complet = camsLocales.size >= NUMEROS_CAM.length;
  if (!libres.length || complet) {
    const o = document.createElement('option'); o.value = '';
    o.textContent = complet ? '4 caméras maximum sur ce PC' : (appareils.length ? 'Aucune autre caméra branchée sur ce PC' : 'Démarre d\'abord ta caméra principale');
    sel.appendChild(o);
  }
  $('#cam-valider').disabled = !libres.length || complet;
  $('#cam-nom').value = '';
}
$('#cam-ajouter').onclick = () => { if (camAjout.hidden) ouvrirAjoutCam(); else camAjout.hidden = true; };
$('#cam-annuler').onclick = () => { camAjout.hidden = true; };
$('#cam-valider').onclick = () => {
  const appareil = $('#cam-choix').value; if (!appareil) return;
  const n = NUMEROS_CAM.find(x => !camsLocales.has(idCam(session, x)));
  if (!n) return toast('4 caméras maximum sur ce PC');
  brancherCam(n, appareil, $('#cam-nom').value.trim());
  camAjout.hidden = true;
  toast(`Caméra ${n} branchée : « Mettre à l'antenne » pour l'afficher`);
};
/* Caméra à distance : un téléphone ou un autre PC ouvre ce lien et devient une caméra du live (avec son micro) */
$('#cam-distance').onclick = () => copier(L.invite.replace('invite.html#', 'invite.html?cam=1#'), 'Lien caméra copié : ouvre-le sur le téléphone ou le PC à distance');

/* Au rechargement de la régie : on rebranche les caméras de ce live */
try {
  for (const c of JSON.parse(localStorage.getItem(CLE_CAMS) || '[]')) {
    if (NUMEROS_CAM.includes(c.n) && typeof c.appareil === 'string' && c.appareil) brancherCam(c.n, c.appareil, String(c.nom || '').slice(0, 28));
  }
} catch (e) { /* rien */ }
majCommutation();
