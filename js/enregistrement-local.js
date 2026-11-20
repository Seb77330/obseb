/* MESA : enregistrement local de chaque caméra (« pistes séparées »).
   Quand l'animateur lance l'enregistrement, chaque personne enregistre SA caméra et SON micro chez elle,
   en pleine qualité (pas l'image compressée par la connexion). Le fichier reste sur son ordinateur :
   rien ne passe par un serveur, rien ne coûte. Les morceaux sont écrits au fur et à mesure sur le disque
   (espace de stockage du site), puis le fichier est téléchargé tout seul à l'arrêt.
   Utilisé par les coulisses (invite.js) et la régie (regie.js). */
'use strict';

function EnregistreurCamera() {
  let rec = null;        // { recorder, flux, ecrivain, fichier, morceaux, ecritures, nom, debut, octets, erreur, type }
  let dernier = null;    // { nom, octets, erreur, fin, fichier }
  const nettoie = s => String(s || 'MESA').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .,()'-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'MESA';

  function format() {
    const essais = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const t = essais.find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    return { type: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  // retrouve l'appareil choisi dans le réglage par son nom (les identifiants changent d'une page à l'autre)
  async function idAppareil(genre, nom) {
    if (!nom) return null;
    try {
      const l = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === genre);
      const d = l.find(x => x.label === nom) || l.find(x => nomAppareil(x.label) === nomAppareil(nom));
      return d ? d.deviceId : null;
    } catch (e) { return null; }
  }

  /* app : { nomCam, nomMic, antibruit } ; nom : nom du fichier sans extension ; coupe : { mic, cam } */
  async function demarrer({ app = {}, nom, coupe = {}, sansVideo = false, sansSon = false }) {
    if (rec) return;
    if (!window.MediaRecorder || !navigator.mediaDevices) { dernier = { erreur: 'Ce navigateur ne sait pas enregistrer : utilise Chrome ou Edge.', fin: Date.now() }; return; }
    const debut = Date.now();
    const place = { debut, octets: 0, demarrage: true };
    rec = place;     // réservé : un deuxième ordre pendant le démarrage ne relance rien
    let flux;
    try {
      const [cam, mic] = await Promise.all([idAppareil('videoinput', app.nomCam), idAppareil('audioinput', app.nomMic)]);
      flux = await navigator.mediaDevices.getUserMedia({
        video: sansVideo ? false : Object.assign({ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, cam ? { deviceId: { exact: cam } } : {}),
        audio: sansSon ? false : Object.assign({ echoCancellation: true, noiseSuppression: !!app.antibruit, autoGainControl: false }, mic ? { deviceId: { exact: mic } } : {})
      });
    } catch (e) {
      if (rec === place) rec = null;
      dernier = { erreur: 'Caméra ou micro indisponible pour l\'enregistrement (' + (e.name || e.message) + ')', fin: Date.now() };
      return;
    }
    if (rec !== place) { flux.getTracks().forEach(t => t.stop()); return; }   // arrêté pendant le démarrage
    const { type, ext } = format();
    const nomFichier = `${nettoie(nom)}.${ext}`;
    let ecrivain = null, fichier = null;
    try {
      try { await navigator.storage.persist(); } catch (e) { /* facultatif */ }
      const dossier = await (await navigator.storage.getDirectory()).getDirectoryHandle('enregistrements', { create: true });
      fichier = await dossier.getFileHandle(encodeURIComponent(nomFichier), { create: true });
      ecrivain = await fichier.createWritable();
    } catch (e) { ecrivain = null; fichier = null; }   // pas d'espace de stockage : on garde en mémoire
    if (rec !== place) { flux.getTracks().forEach(t => t.stop()); if (ecrivain) ecrivain.abort().catch(() => {}); return; }
    let recorder;
    try {
      const h = (flux.getVideoTracks()[0] && flux.getVideoTracks()[0].getSettings().height) || 720;
      recorder = new MediaRecorder(flux, Object.assign({ videoBitsPerSecond: h >= 1080 ? 10000000 : 6000000, audioBitsPerSecond: 192000 }, type ? { mimeType: type } : {}));
    } catch (e) {
      flux.getTracks().forEach(t => t.stop()); if (ecrivain) ecrivain.abort().catch(() => {});
      if (rec === place) rec = null; dernier = { erreur: 'Impossible de démarrer l\'enregistrement : ' + e.message, fin: Date.now() };
      return;
    }
    rec = { recorder, flux, ecrivain, fichier, morceaux: [], ecritures: Promise.resolve(), nom: nomFichier, debut, octets: 0, erreur: '', type: type || 'video/webm' };
    couper(coupe);
    recorder.ondataavailable = ev => {
      const r = rec; if (!ev.data || !ev.data.size || !r || r.recorder !== recorder) return;
      r.octets += ev.data.size;
      if (r.ecrivain) r.ecritures = r.ecritures.then(() => r.ecrivain.write(ev.data)).catch(err => { r.erreur = 'Disque plein ou fichier refusé : ' + err.message; });
      else r.morceaux.push(ev.data);
    };
    recorder.onstop = () => terminer();
    recorder.start(2000);
  }
  function arreter() {
    if (!rec) return;
    if (rec.demarrage) { rec = null; return; }   // pas encore commencé : on annule
    if (rec.recorder.state !== 'inactive') rec.recorder.stop();
  }
  async function terminer() {
    const r = rec; if (!r) return;
    r.flux.getTracks().forEach(t => t.stop());
    await r.ecritures;
    let blob = null;
    try {
      if (r.ecrivain) { await r.ecrivain.close(); blob = await r.fichier.getFile(); }
      else blob = new Blob(r.morceaux, { type: r.type });
    } catch (e) { r.erreur = 'Le fichier n\'a pas pu être fermé : ' + e.message; }
    rec = null;
    dernier = { nom: r.nom, octets: blob ? blob.size : r.octets, duree: Date.now() - r.debut, erreur: r.erreur, fin: Date.now(), blob };
    if (blob && blob.size) telecharger();
  }
  // retélécharger le dernier fichier (bouton « Télécharger encore »)
  function telecharger() {
    if (!dernier || !dernier.blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(dernier.blob); a.download = dernier.nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  }
  // micro ou caméra coupé par la personne : l'enregistrement aussi (silence, image noire)
  function couper(c = {}) {
    if (!rec || !rec.flux) return;
    rec.flux.getAudioTracks().forEach(t => { t.enabled = !c.mic; });
    rec.flux.getVideoTracks().forEach(t => { t.enabled = !c.cam; });
  }
  // fermer la page en plein enregistrement : on prévient (le début du fichier reste dans « Mes enregistrements » de la régie)
  addEventListener('beforeunload', e => { if (rec && !rec.demarrage) { e.preventDefault(); e.returnValue = ''; } });

  return {
    demarrer, arreter, couper, telecharger,
    get actif() { return !!rec; },
    get debut() { return rec ? rec.debut : 0; },
    etat() { return rec ? { actif: true, debut: rec.debut, octets: rec.octets || 0, erreur: rec.erreur || '' } : dernier ? { actif: false, octets: dernier.octets, erreur: dernier.erreur || '', fin: dernier.fin } : null; }
  };
}

/* « 12:34 » ou « 1:02:03 » et « 850 Mo » pour l'affichage */
function dureeEnr(ms) { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
function tailleEnr(o) { return o > 1e9 ? (o / 1e9).toFixed(2).replace('.', ',') + ' Go' : Math.max(0, Math.round(o / 1e6)) + ' Mo'; }
