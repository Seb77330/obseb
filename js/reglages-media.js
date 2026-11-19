/* MESA : réglage caméra + micro, avant de rejoindre le live (régie et coulisses invité).
   On choisit ici ses appareils avec un vrai aperçu et un indicateur de son,
   puis la caméra démarre toute seule dans la salle avec ces appareils (plus d'écran de réglage compliqué). */
'use strict';

function nomAppareil(label) {
  // « Par défaut - Micro (Cam Link 4K) (0fd9:0066) » -> « Micro (Cam Link 4K) »
  return String(label || '')
    .replace(/^(par défaut|default|communications)\s*-\s*/i, '')
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '')
    .trim();
}
function paramAppareil(label) { return nomAppareil(label).replace(/\s+/g, '_'); }

function ReglagesMedia({ boite, cle, texteBouton = 'Démarrer ma caméra', surDemarrer }) {
  boite.innerHTML = `
    <div class="rm">
      <div class="rm-video"><video autoplay muted playsinline></video><div class="rm-vide">Autorise la caméra et le micro dans la fenêtre du navigateur</div><span class="rm-res"></span></div>
      <label class="rm-champ">Caméra</label>
      <select class="rm-cam"></select>
      <label class="rm-champ">Micro</label>
      <select class="rm-mic"></select>
      <div class="rm-vu" title="Parle : la barre doit bouger"><i></i></div>
      <p class="rm-aide"></p>
      <button class="primaire rm-go">${texteBouton}</button>
    </div>`;
  const video = boite.querySelector('video'), selCam = boite.querySelector('.rm-cam'), selMic = boite.querySelector('.rm-mic');
  const vu = boite.querySelector('.rm-vu i'), aide = boite.querySelector('.rm-aide'), res = boite.querySelector('.rm-res');
  let flux = null, ctx = null, boucle = null;
  let choix = {};
  try { choix = JSON.parse(localStorage.getItem(cle) || '{}'); } catch (e) { /* rien */ }

  function arreter() {
    if (flux) flux.getTracks().forEach(t => t.stop());
    flux = null;
    if (boucle) cancelAnimationFrame(boucle);
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
  }
  async function ouvrir() {
    arreter();
    aide.textContent = '';
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: choix.cam ? { exact: choix.cam } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { deviceId: choix.mic ? { exact: choix.mic } : undefined }
      });
    } catch (e) {
      // appareil retenu débranché : on réessaie avec ceux par défaut
      if (choix.cam || choix.mic) { choix = {}; return ouvrir(); }
      boite.querySelector('.rm-vide').textContent = e.name === 'NotReadableError'
        ? 'La caméra est déjà utilisée par un autre logiciel (OBS, Teams…). Ferme-la là-bas puis clique ici.'
        : 'Caméra ou micro refusé. Clique sur le cadenas à gauche de l\'adresse pour autoriser, puis ici.';
      boite.querySelector('.rm-vide').onclick = ouvrir;
      return;
    }
    boite.querySelector('.rm-vide').hidden = true;
    video.srcObject = flux;
    const vt = flux.getVideoTracks()[0], at = flux.getAudioTracks()[0];
    const s = vt && vt.getSettings();
    if (s) {
      // la définition se lit sur le petit côté : un téléphone tenu debout (1080 × 1920) filme en 1080p, pas en « 1920p »
      const def = s.width && s.height ? Math.min(s.width, s.height) : s.height;
      const debout = s.width && s.height && s.height > s.width;
      res.textContent = def ? `${def}p${debout ? ' debout' : ''}${s.frameRate ? ' · ' + Math.round(s.frameRate) + ' i/s' : ''}` : '';
      res.title = s.width && s.height ? `${s.width} × ${s.height}${debout ? ' : caméra tenue à la verticale, l\'image sera recadrée en 16:9 dans le live' : ''}` : '';
      if (def && def < 1080) aide.textContent = `Cette caméra donne ${def}p. Pour du 1080p, choisis ta Cam Link.`;
    }
    choix.cam = s && s.deviceId; choix.mic = at && at.getSettings().deviceId;
    choix.h = (s && (s.width && s.height ? Math.min(s.width, s.height) : s.height)) || 0;   // ce que la caméra donne ici (pour l'affichage seulement : la salle demande toujours le mieux, voir urlPublier)
    // liste des appareils (les noms n'apparaissent qu'une fois l'accès autorisé)
    const app = await navigator.mediaDevices.enumerateDevices();
    const remplir = (sel, type, actuel) => {
      sel.innerHTML = '';
      app.filter(d => d.kind === type && d.deviceId !== 'communications').forEach((d, i) => {
        const o = document.createElement('option');
        o.value = d.deviceId; o.textContent = (d.deviceId === 'default' ? 'Par défaut : ' : '') + (nomAppareil(d.label) || (type === 'videoinput' ? 'Caméra ' : 'Micro ') + (i + 1));
        o.selected = d.deviceId === actuel;
        sel.appendChild(o);
      });
    };
    remplir(selCam, 'videoinput', choix.cam);
    remplir(selMic, 'audioinput', choix.mic);
    // indicateur de son
    if (at) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(new MediaStream([at])).connect(an);
      const d = new Uint8Array(an.fftSize);
      const tic = () => {
        an.getByteTimeDomainData(d);
        let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128));
        vu.style.width = Math.min(100, m / 128 * 220) + '%';
        boucle = requestAnimationFrame(tic);
      };
      tic();
    }
  }
  selCam.onchange = () => { choix.cam = selCam.value; ouvrir(); };
  selMic.onchange = () => { choix.mic = selMic.value; ouvrir(); };
  boite.querySelector('.rm-go').onclick = () => {
    const cam = selCam.selectedOptions[0], mic = selMic.selectedOptions[0];
    const appCam = cam ? cam.textContent.replace(/^Par défaut : /, '') : '';
    const appMic = mic ? mic.textContent.replace(/^Par défaut : /, '') : '';
    choix.nomCam = appCam; choix.nomMic = appMic;
    try { localStorage.setItem(cle, JSON.stringify(choix)); } catch (e) { /* rien */ }
    arreter();   // libère la caméra avant que la salle l'ouvre (évite le conflit Cam Link)
    surDemarrer({ vd: appCam ? paramAppareil(appCam) : '1', ad: appMic ? paramAppareil(appMic) : '1', nomCam: appCam, nomMic: appMic, h: choix.h || 0 });
  };
  return { ouvrir, arreter, choix: () => choix };
}

/* Appareils retenus la dernière fois (pour redémarrer sans repasser par le réglage) */
function appareilsRetenus(cle) {
  try {
    const c = JSON.parse(localStorage.getItem(cle) || '{}');
    if (!c.nomCam && !c.nomMic) return null;
    return { vd: c.nomCam ? paramAppareil(c.nomCam) : '1', ad: c.nomMic ? paramAppareil(c.nomMic) : '1', nomCam: c.nomCam, nomMic: c.nomMic, h: c.h || 0 };
  } catch (e) { return null; }
}
