/* MESA : la fenêtre de diffusion (sortie.html?diffuser=1).
   C'est la même page que la sortie OBS. Ici, c'est le navigateur de l'animateur qui en fait UNE vidéo finie
   (capture de cette fenêtre, découpée sur la scène seule), puis qui l'envoie :
     - tout droit à Twitch (WHIP, rien ne passe par nos serveurs),
     - ou au relais MESA, qui la recopie telle quelle vers YouTube et les autres.
   La régie pilote cette fenêtre (canal BroadcastChannel, même navigateur) : elle envoie « go » avec les destinations, puis « stop ».
   Une fenêtre capturée reste dessinée même derrière la régie : le navigateur ne la met pas en veille. */
'use strict';
(() => {
  if (!Q.get('diffuser') || PREVIEW || !session) return;
  const FORMAT = VERTICAL ? 'vertical' : 'horizontal';
  const canal = new BroadcastChannel(`obseb-diffusion-${session.room}-${FORMAT}`);
  document.body.classList.add('diffusion');

  let capture = null;      // MediaStream de la capture de la fenêtre
  let sortie = null;       // { video, audio, arreter } : image à taille fixe, 30 i/s
  let mode = '';           // 'element' (capture de la scène seule) ou 'zone' (découpe)
  let enDirect = false;
  let reglages = { hauteur: 1080, debit: 6000000, fps: 30 };   // fps 60 : mode Jeu, si l'ordinateur et la connexion suivent
  const cibles = new Map(); // id -> { nom, url, jeton, envoi, statut, mesure, essais, erreur }
  let verrouEcran = null;

  /* ----- Le petit panneau (jamais à l'image : la capture ne prend que la scène) ----- */
  const ui = document.createElement('div');
  ui.id = 'diffusion-ui';
  ui.innerHTML = `<div class="df-carte">
      <div class="df-marque"><svg class="marque-ic" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--ui-accent)"/><path d="M8 23.5V9.5h4.2L16 15.6l3.8-6.1H24v14" fill="none" stroke="var(--ui-sur-accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg><span>MESA</span> · fenêtre de diffusion</div>
      <h1 id="df-titre">Prête à envoyer ou enregistrer</h1>
      <p id="df-texte">Clique sur le bouton, puis sur <b>Partager</b> dans la fenêtre du navigateur. Laisse « Partager aussi le son de l'onglet » coché.</p>
      <button id="df-go" class="df-bouton">Autoriser cette fenêtre</button>
      <ul class="df-conseils">
        <li>Garde cette fenêtre ouverte pendant tout le live. Tu peux la mettre derrière la régie, mais ne la réduis pas.</li>
        <li>Plus elle est grande, plus l'image est nette : agrandis-la au maximum, ou passe en plein écran sur un deuxième écran.</li>
      </ul>
      <div id="df-cibles"></div>
      <p class="df-beta">Studio en bêta : l'envoi depuis le navigateur marche le mieux sur Chrome ou Edge, sur ordinateur.</p>
    </div>
    <div class="df-pastille" id="df-pastille" hidden></div>`;
  document.body.appendChild(ui);
  const titre = ui.querySelector('#df-titre'), texte = ui.querySelector('#df-texte'), bouton = ui.querySelector('#df-go');

  function dire(t, x) { titre.textContent = t; if (x !== undefined) texte.innerHTML = x; }

  /* ----- Image à taille fixe et à cadence fixe -----
     La capture d'une fenêtre ne fournit une image que quand quelque chose bouge, et à la taille de la fenêtre.
     Les plateformes veulent du régulier : on redessine la dernière image 30 fois par seconde, en 1920 x 1080 (ou 1280 x 720). */
  function tailleSortie() {
    const h = reglages.hauteur === 720 ? 720 : 1080, w = Math.round(h * 16 / 9);
    return VERTICAL ? { w: h, h: w } : { w, h };
  }
  function horloge(fps, fn) {
    // un minuteur dans un « worker » n'est jamais ralenti par le navigateur, même fenêtre cachée
    try {
      const w = new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${1000 / fps})`], { type: 'text/javascript' })));
      w.onmessage = fn; return () => w.terminate();
    } catch (e) { const t = setInterval(fn, 1000 / fps); return () => clearInterval(t); }
  }
  function normaliser(piste) {
    const { w, h } = tailleSortie(), fps = reglages.fps === 60 ? 60 : 30;
    const dessiner = (cx, src, sw, sh) => {
      // l'image entière, sans déformation (bandes noires si la fenêtre n'a pas les bonnes proportions)
      const k = Math.min(w / sw, h / sh), dw = sw * k, dh = sh * k;
      cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
      cx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    if ('MediaStreamTrackProcessor' in window && 'MediaStreamTrackGenerator' in window && 'VideoFrame' in window) {
      const lecteur = new MediaStreamTrackProcessor({ track: piste }).readable.getReader();
      const gen = new MediaStreamTrackGenerator({ kind: 'video' });
      const ecrivain = gen.writable.getWriter();
      const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d', { alpha: false });
      let derniere = null, fini = false;
      (async () => { while (!fini) { const { value, done } = await lecteur.read(); if (done) break; if (derniere) derniere.close(); derniere = value; } })().catch(() => {});
      const stop = horloge(fps, () => {
        if (fini) return;
        if (derniere) { dessiner(cx, derniere, derniere.displayWidth, derniere.displayHeight); derniere.close(); derniere = null; }
        if (ecrivain.desiredSize <= 0) return;   // l'encodeur est en retard : on saute une image plutôt que d'accumuler
        const f = new VideoFrame(cv, { timestamp: Math.round(performance.now() * 1000) });
        ecrivain.write(f).catch(() => {}).finally(() => f.close());
      });
      return { video: gen, arreter() { fini = true; stop(); try { lecteur.cancel(); } catch (e) { /* rien */ } if (derniere) derniere.close(); gen.stop(); } };
    }
    // navigateurs sans « breakout box » : une balise vidéo cachée et un canvas
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([piste]); v.play().catch(() => {});
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { alpha: false });
    const flux = cv.captureStream(0), p = flux.getVideoTracks()[0];
    const stop = horloge(fps, () => { if (v.videoWidth) dessiner(cx, v, v.videoWidth, v.videoHeight); p.requestFrame && p.requestFrame(); });
    return { video: p, arreter() { stop(); p.stop(); v.srcObject = null; } };
  }

  /* ----- Capture de la fenêtre, découpée sur la scène ----- */
  async function autoriser() {
    bouton.disabled = true;
    try {
      capture = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },   // monté à 60 avec le mode Jeu (voir « go »)
        audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude', systemAudio: 'exclude'
      });
    } catch (e) {
      bouton.disabled = false;
      dire('Fenêtre pas autorisée', 'Sans ton accord, le navigateur ne peut ni envoyer ni enregistrer le live. Clique à nouveau et choisis <b>Partager</b>.');
      return publier();
    }
    const piste = capture.getVideoTracks()[0];
    const surface = piste.getSettings().displaySurface;
    if (surface && surface !== 'browser') {
      capture.getTracks().forEach(t => t.stop()); capture = null; bouton.disabled = false;
      dire('Mauvais choix', 'Il faut partager <b>cet onglet</b> (la fenêtre de diffusion), pas l\'écran entier ni une autre fenêtre.');
      return publier();
    }
    piste.contentHint = 'motion';
    const scene = document.getElementById('stage');
    try {
      if (window.RestrictionTarget && piste.restrictTo) { await piste.restrictTo(await RestrictionTarget.fromElement(scene)); mode = 'element'; }
      else if (window.CropTarget && piste.cropTo) { await piste.cropTo(await CropTarget.fromElement(scene)); mode = 'zone'; }
    } catch (e) { mode = ''; }
    // sans capture de la scène seule, le panneau serait à l'image : on le cache
    document.body.classList.toggle('df-discret', mode !== 'element');
    piste.onended = () => { arreterRec(); arreterTout('La capture a été arrêtée (bouton « Arrêter le partage » du navigateur).'); capture = null; publier(); };
    sortie = normaliser(piste);
    sortie.audio = capture.getAudioTracks()[0] || null;
    try { verrouEcran = await navigator.wakeLock.request('screen'); } catch (e) { /* facultatif */ }
    dire('Fenêtre prête', sortie.audio ? 'Retourne dans la régie : démarre le direct ou l\'enregistrement. Rien ne part et rien n\'est enregistré avant.'
      : 'Prête, mais <b>sans le son</b> : la case « Partager aussi le son de l\'onglet » était décochée. Clique sur « Arrêter le partage » puis recommence.');
    bouton.hidden = true;
    publier();
  }
  bouton.onclick = autoriser;

  /* ----- Envoi vers chaque destination, avec reconnexion automatique ----- */
  async function connecter(id) {
    const c = cibles.get(id); if (!c || !sortie || !enDirect) return;
    c.statut = c.essais ? 'reconnexion' : 'connexion'; publier();
    try {
      c.envoi = await publierWhip({ url: c.url, jeton: c.jeton, video: sortie.video, audio: sortie.audio, debit: reglages.debit, fps: reglages.fps, garderTaille: id.startsWith('relais') });
      c.erreur = ''; c.mesure = null;
      const pc = c.envoi.pc;
      pc.onconnectionstatechange = () => {
        if (!cibles.has(id) || cibles.get(id) !== c) return;
        if (pc.connectionState === 'connected') { c.statut = 'en-direct'; c.essais = 0; publier(); }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') relancer(id, 'Connexion perdue');
        if (pc.connectionState === 'disconnected') { clearTimeout(c.coupure); c.coupure = setTimeout(() => pc.connectionState === 'disconnected' && relancer(id, 'Connexion perdue'), 6000); }
      };
    } catch (e) { relancer(id, e.message); }
  }
  function relancer(id, raison) {
    const c = cibles.get(id); if (!c) return;
    if (c.envoi) { c.envoi.arreter(); c.envoi = null; }
    c.erreur = raison; c.statut = 'reconnexion'; c.essais = (c.essais || 0) + 1;
    publier();
    if (!enDirect) return;
    // clé refusée : inutile d'insister
    if (/refusée/.test(raison) && c.essais > 2) { c.statut = 'erreur'; return publier(); }
    clearTimeout(c.minuteur);
    c.minuteur = setTimeout(() => connecter(id), Math.min(30000, 2000 * c.essais));
  }
  function retirer(id) {
    const c = cibles.get(id); if (!c) return;
    clearTimeout(c.minuteur); clearTimeout(c.coupure);
    if (c.envoi) c.envoi.arreter();
    cibles.delete(id);
  }
  function arreterTout(raison) {
    enDirect = false;
    for (const id of [...cibles.keys()]) retirer(id);
    if (raison) dire('Envoi arrêté', raison);
  }
  function appliquer(liste) {
    const voulues = new Map(liste.map(c => [c.id, c]));
    for (const id of [...cibles.keys()]) {
      const a = cibles.get(id), n = voulues.get(id);
      if (!n || n.url !== a.url || n.jeton !== a.jeton) retirer(id);
    }
    for (const [id, c] of voulues) if (!cibles.has(id)) { cibles.set(id, { nom: c.nom, url: c.url, jeton: c.jeton, statut: 'connexion', essais: 0 }); connecter(id); }
  }

  /* ----- Mesures toutes les 2 s, envoyées à la régie ----- */
  setInterval(async () => {
    for (const c of cibles.values()) {
      if (!c.envoi) continue;
      try {
        const m = await mesurerEnvoi(c.envoi.pc, c.mesure && c.mesure.avant);
        // ce qui freine doit durer 6 s pour compter (un à-coup n'est pas un problème)
        c.freins = m.limite ? (c.freins || 0) + 1 : 0;
        c.mesure = Object.assign(m, { frein: c.freins >= 3 ? m.limite : '' });
      } catch (e) { /* fenêtre en train de se fermer */ }
    }
    publier();
  }, 2000);

  /* ----- Enregistrement : la même image que le live, écrite dans un fichier sur ton PC -----
     Les morceaux partent au fur et à mesure dans l'espace de stockage du site (sur le disque, pas en mémoire),
     donc même un enregistrement de plusieurs heures ne remplit pas la mémoire. À l'arrêt, le fichier est
     téléchargé tout seul (dossier Téléchargements) et reste dans « Mes enregistrements » de la régie. */
  let rec = null;   // { recorder, ecrivain, nom, debut, octets, file, erreur }
  let dernierRec = null;
  function formatRec() {
    const essais = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const t = essais.find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    return { type: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  async function dossierRec() {
    const racine = await navigator.storage.getDirectory();
    return racine.getDirectoryHandle('enregistrements', { create: true });
  }
  async function demarrerRec(nomVoulu) {
    if (rec || !sortie) return;
    const { type, ext } = formatRec();
    if (!window.MediaRecorder) { dernierRec = { erreur: 'Ce navigateur ne sait pas enregistrer : utilise Chrome ou Edge.' }; return publier(); }
    const nom = `${String(nomVoulu || 'MESA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .,()'-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'MESA'} ${FORMAT === 'vertical' ? 'vertical' : 'horizontal'}.${ext}`;
    let ecrivain = null, fichier = null;
    try {
      try { await navigator.storage.persist(); } catch (e) { /* facultatif */ }
      // le nom sur le disque est écrit sans accents ni espaces (certains systèmes les refusent) ; la régie le relit en clair
      fichier = await (await dossierRec()).getFileHandle(encodeURIComponent(nom), { create: true });
      ecrivain = await fichier.createWritable();
    } catch (e) { ecrivain = null; }       // pas d'espace de stockage : on garde en mémoire (moins long possible)
    const morceaux = [];
    const pistes = [sortie.video, sortie.audio].filter(Boolean);
    const h = tailleSortie().h > tailleSortie().w ? tailleSortie().w : tailleSortie().h;
    let recorder;
    try {
      recorder = new MediaRecorder(new MediaStream(pistes), Object.assign({ videoBitsPerSecond: h >= 1080 ? 12000000 : 7000000, audioBitsPerSecond: 192000 }, type ? { mimeType: type } : {}));
    } catch (e) { dernierRec = { erreur: 'Impossible de démarrer l\'enregistrement : ' + e.message }; if (ecrivain) ecrivain.abort().catch(() => {}); return publier(); }
    rec = { recorder, ecrivain, fichier, nom, nomAffiche: String(nomVoulu || '').slice(0, 80), debut: Date.now(), octets: 0, morceaux, ecritures: Promise.resolve(), type: type || 'video/webm' };
    recorder.ondataavailable = ev => {
      if (!ev.data || !ev.data.size || !rec) return;
      const r = rec; r.octets += ev.data.size;
      if (r.ecrivain) r.ecritures = r.ecritures.then(() => r.ecrivain.write(ev.data)).catch(err => { r.erreur = 'Disque plein ou fichier refusé : ' + err.message; });
      else r.morceaux.push(ev.data);
    };
    recorder.onstop = () => terminerRec();
    recorder.onerror = ev => { if (rec) rec.erreur = (ev.error && ev.error.message) || 'Erreur pendant l\'enregistrement'; };
    recorder.start(2000);    // un morceau toutes les 2 s
    publier();
  }
  function arreterRec() { if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop(); }
  async function terminerRec() {
    const r = rec; if (!r) return;
    await r.ecritures;
    let blob = null;
    try {
      if (r.ecrivain) { await r.ecrivain.close(); blob = await r.fichier.getFile(); }
      else blob = new Blob(r.morceaux, { type: r.type });
    } catch (e) { r.erreur = 'Le fichier n\'a pas pu être fermé : ' + e.message; }
    rec = null;
    dernierRec = { nom: r.nom, octets: blob ? blob.size : r.octets, duree: Date.now() - r.debut, erreur: r.erreur || '', fin: Date.now() };
    // une petite fiche à côté du fichier : la page « Mes enregistrements » y lit la durée, le format et le live d'origine
    if (r.fichier && blob) {
      try {
        const t = tailleSortie();
        const fiche = await (await dossierRec()).getFileHandle(r.fichier.name + '.json', { create: true });
        const w = await fiche.createWritable();
        await w.write(JSON.stringify({ nom: r.nom, nomAffiche: r.nomAffiche, duree: dernierRec.duree, format: FORMAT, w: t.w, h: t.h, debut: r.debut, titre: session.titre || '', theme: (session.theme && session.theme.preset) || '' }));
        await w.close();
      } catch (e) { /* la fiche est facultative */ }
    }
    if (blob && blob.size) telecharger(blob, r.nom);
    publier();
  }
  function telecharger(blob, nom) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  }


  /* ----- « Revoir l'action » : les dernières secondes du live, rejouées à l'image -----
     Pendant le direct (ou l'enregistrement), la fenêtre garde en mémoire les ~20 dernières secondes de l'image finie,
     en petits morceaux de 5 s (un seul encodage en plus, sans le son). Sur ordre de la régie, elle les rejoue par-dessus
     la scène, avec un badge « REPLAY » : comme la scène est ce qui est capturé, le replay part dans le live et dans le fichier.
     Le son du live (micros) continue pendant le replay ; le replay lui-même est muet. Rien ne quitte l'ordinateur. */
  const MORCEAU = 5000, GARDE = 8;   // 8 morceaux : de quoi faire un clip de ~35 s
  let tampon = null;            // { recorder, debut } : le morceau en cours
  const morceauxReplay = [];    // [{ blob, debut, fin }] du plus ancien au plus récent
  let replay = null;            // { el, arreter } : replay à l'image
  function formatReplay() {
    const essais = sortie && sortie.audio ? ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=h264', 'video/webm;codecs=vp8', 'video/webm'];
    return essais.find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
  }
  function nouveauMorceau() {
    if (!sortie || !window.MediaRecorder) return null;
    const type = formatReplay();
    let r;
    // le son est gardé aussi (pour les clips) ; le replay à l'image, lui, reste muet
    try { r = new MediaRecorder(new MediaStream([sortie.video, sortie.audio].filter(Boolean)), Object.assign({ videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 }, type ? { mimeType: type } : {})); }
    catch (e) { return null; }
    const m = { recorder: r, debut: Date.now(), type: type || 'video/webm', fini: null };
    m.fini = new Promise(ok => {
      r.ondataavailable = ev => {
        if (ev.data && ev.data.size) { morceauxReplay.push({ blob: ev.data, debut: m.debut, fin: Date.now(), type: m.type }); while (morceauxReplay.length > GARDE) morceauxReplay.shift(); }
        ok();
      };
      r.onerror = () => ok();
    });
    r.start();
    return m;
  }
  // le suivant démarre avant que l'ancien s'arrête : pas de trou entre deux morceaux
  function couperMorceau() {
    const ancien = tampon;
    tampon = nouveauMorceau();
    if (ancien && ancien.recorder.state !== 'inactive') { ancien.recorder.stop(); return ancien.fini; }
    return Promise.resolve();
  }
  let arretTampon = null;
  setInterval(() => {
    const voulu = !!sortie && (enDirect || !!rec);
    if (voulu && (!tampon || Date.now() - tampon.debut >= MORCEAU)) couperMorceau();
    else if (!voulu && tampon && !arretTampon) {
      // fin du live : le dernier morceau sert encore aux moments marqués juste avant
      const t = tampon; tampon = null;
      if (t.recorder.state !== 'inactive') t.recorder.stop();
      arretTampon = t.fini.then(() => Promise.all(marques.filter(m => !m.garde).map(garderMarque))).finally(() => { morceauxReplay.length = 0; arretTampon = null; });
    }
  }, 500);

  /* ----- Clips : « Marquer » pendant le live, une petite vidéo par moment à la fin -----
     Un moment marqué garde ~25 s avant et ~10 s après (les morceaux du tampon, avec le son), écrits tout de suite sur le disque
     (espace de stockage du site). Quand le live et l'enregistrement sont finis, la fenêtre les recolle en un vrai fichier par
     moment (en les rejouant sans son ni image visibles : ça prend la durée du clip) et les range dans « Mes enregistrements ». */
  const AVANT = 25000, APRES = 10000;
  const marques = [];        // { n, t, garde: bool, fichiers: [noms], fait: bool }
  let nbMarques = 0, clipEnCours = 0, clipsFaits = 0, clipErreur = '';
  async function dossierClips() { return (await navigator.storage.getDirectory()).getDirectoryHandle('clips-attente', { create: true }); }
  function marquer() {
    if (!tampon && !morceauxReplay.length) return;
    const m = { n: ++nbMarques, t: Date.now(), garde: false, fichiers: [], fait: false };
    marques.push(m);
    m.minuteur = setTimeout(() => { if (tampon) couperMorceau().then(() => garderMarque(m)); }, APRES);
    publier();
  }
  async function garderMarque(m) {
    if (m.garde) return; m.garde = true; clearTimeout(m.minuteur);
    const pris = morceauxReplay.filter(x => x.fin > m.t - AVANT && x.debut < m.t + APRES);
    try {
      const d = await dossierClips();
      for (let i = 0; i < pris.length; i++) {
        const nom = `${m.n}-${i}`, f = await d.getFileHandle(nom, { create: true }), w = await f.createWritable();
        await w.write(pris[i].blob); await w.close(); m.fichiers.push(nom);
      }
      m.type = pris[0] && pris[0].type;
    } catch (e) { m.blobs = pris.map(x => x.blob); m.type = pris[0] && pris[0].type; }   // pas de stockage : en mémoire
    publier();
  }
  async function fabriquerClip(m) {
    const d = await dossierClips().catch(() => null);
    const blobs = m.blobs || (d ? await Promise.all(m.fichiers.map(async n => (await d.getFileHandle(n)).getFile())) : []);
    if (!blobs.length) return;
    const { w, h } = tailleSortie();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { alpha: false });
    const v = document.createElement('video'); v.playsInline = true;
    v.style.cssText = 'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(v);
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(v).connect(dest);   // le son va seulement dans le fichier, pas aux haut-parleurs
    const flux = cv.captureStream(30);
    const type = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(x => MediaRecorder.isTypeSupported(x)) || '';
    const rec2 = new MediaRecorder(new MediaStream([...flux.getVideoTracks(), ...dest.stream.getAudioTracks()]), Object.assign({ videoBitsPerSecond: 8000000, audioBitsPerSecond: 160000 }, type ? { mimeType: type } : {}));
    const morceaux = []; rec2.ondataavailable = e => { if (e.data && e.data.size) morceaux.push(e.data); };
    const fini = new Promise(ok => { rec2.onstop = ok; });
    const stop = horloge(30, () => { if (v.videoWidth) { const k = Math.min(w / v.videoWidth, h / v.videoHeight); cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h); cx.drawImage(v, (w - v.videoWidth * k) / 2, (h - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k); } });
    await ac.resume().catch(() => {});
    let debutRec = false;
    for (const b of blobs) {
      const url = URL.createObjectURL(b);
      v.src = url;
      await new Promise(ok => { v.onloadeddata = ok; v.onerror = ok; setTimeout(ok, 4000); });
      if (!debutRec) { rec2.start(1000); debutRec = true; }
      await v.play().catch(() => {});
      await new Promise(ok => { v.onended = ok; v.onerror = ok; setTimeout(ok, 9000); });   // un morceau dure ~5 s
      URL.revokeObjectURL(url);
    }
    rec2.stop(); await fini; stop(); v.remove(); ac.close().catch(() => {}); flux.getTracks().forEach(t => t.stop());
    const blob = new Blob(morceaux, { type: type || 'video/webm' });
    const heure = new Date(m.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const titreLive = String(session.titre || 'MESA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .,()'-]+/g, ' ').trim().slice(0, 40) || 'MESA';
    const nom = `Clip ${m.n} ${titreLive} ${heure}${FORMAT === 'vertical' ? ' vertical' : ''}.webm`;
    try {
      const dr = await dossierRec(), f = await dr.getFileHandle(encodeURIComponent(nom), { create: true }), wr = await f.createWritable();
      await wr.write(blob); await wr.close();
      const fiche = await dr.getFileHandle(f.name + '.json', { create: true }), wf = await fiche.createWritable();
      await wf.write(JSON.stringify({ nom, nomAffiche: `Clip ${m.n} · ${heure}`, duree: blobs.length * MORCEAU, format: FORMAT, w, h, debut: m.t, titre: session.titre || '', clip: true }));
      await wf.close();
    } catch (e) { telecharger(blob, nom); }   // pas de stockage : on le télécharge
    if (d) for (const n of m.fichiers) d.removeEntry(n).catch(() => {});
  }
  // les clips se fabriquent une fois tout fini (rien ne part plus, l'ordinateur est libre)
  setInterval(async () => {
    if (clipEnCours || enDirect || rec || tampon || arretTampon) return;
    const m = marques.find(x => x.garde && !x.fait); if (!m) return;
    clipEnCours = m.n; publier();
    try { await fabriquerClip(m); clipsFaits++; } catch (e) { clipErreur = 'Un clip n\'a pas pu être fabriqué : ' + e.message; }
    m.fait = true; clipEnCours = 0;
    dire(marques.some(x => !x.fait) ? 'Clips en préparation…' : 'Clips prêts', marques.some(x => !x.fait) ? 'Garde cette fenêtre ouverte : chaque clip prend environ 40 secondes.' : 'Ils sont dans « Mes enregistrements », dans la régie. Tu peux fermer cette fenêtre.');
    publier();
  }, 1000);
  function secondesGardees() { return morceauxReplay.reduce((t, m) => t + (m.fin - m.debut), 0) / 1000 + (tampon ? (Date.now() - tampon.debut) / 1000 : 0); }

  async function rejouer(ralenti) {
    if (replay) arreterReplay();
    await couperMorceau();
    const voulu = (ralenti ? 8 : 15) * 1000;
    const liste = []; let t = 0;
    for (let i = morceauxReplay.length - 1; i >= 0 && t < voulu; i--) { liste.unshift(morceauxReplay[i]); t += morceauxReplay[i].fin - morceauxReplay[i].debut; }
    if (!liste.length) return publier();
    const el = document.createElement('div');
    el.id = 'replay';
    el.innerHTML = `<video muted playsinline></video><video muted playsinline></video><div class="replay-badge">${ralenti ? 'RALENTI' : 'REPLAY'}</div>`;
    document.getElementById('stage').appendChild(el);
    const lecteurs = [...el.querySelectorAll('video')], urls = liste.map(m => URL.createObjectURL(m.blob));
    let i = 0, fin = false;
    const charger = (v, k) => { v.src = urls[k]; v.playbackRate = ralenti ? 0.5 : 1; v.defaultPlaybackRate = v.playbackRate; v.load(); };
    const suivant = () => {
      if (fin) return;
      const v = lecteurs[i % 2], autre = lecteurs[(i + 1) % 2];
      v.classList.add('vu'); autre.classList.remove('vu');
      v.playbackRate = ralenti ? 0.5 : 1;
      v.play().catch(() => {});
      if (i + 1 < urls.length) charger(autre, i + 1);
      v.onended = () => { i++; if (i < urls.length) suivant(); else arreterReplay(); };
    };
    charger(lecteurs[0], 0);
    const securite = setTimeout(() => arreterReplay(), t / (ralenti ? 0.5 : 1) + 4000);
    replay = { el, ralenti, arreter() { fin = true; clearTimeout(securite); el.classList.add('sortie'); setTimeout(() => { el.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }, 300); } };
    requestAnimationFrame(() => el.classList.add('vu'));
    suivant();
    publier();
  }
  function arreterReplay() { if (!replay) return; replay.arreter(); replay = null; publier(); }

  function etat() {
    const s = sortie && sortie.video.getSettings ? sortie.video.getSettings() : {};
    const src = capture ? capture.getVideoTracks()[0].getSettings() : {};
    return {
      type: 'etat', format: FORMAT, t: Date.now(),
      phase: !capture ? 'attente' : enDirect ? 'direct' : 'prete',
      rec: rec ? { actif: true, debut: rec.debut, octets: rec.octets, nom: rec.nom, erreur: rec.erreur || '' } : null,
      dernierRec,
      replay: { secondes: Math.floor(secondesGardees()), enCours: replay ? (replay.ralenti ? 'ralenti' : 'normal') : '' },
      clips: { marques: nbMarques, attente: marques.filter(x => !x.fait).length, enCours: clipEnCours, faits: clipsFaits, erreur: clipErreur },
      son: !!(sortie && sortie.audio), mode,
      source: src.width ? { w: src.width, h: src.height } : null,
      sortie: Object.assign(tailleSortie(), s.frameRate ? { fps: Math.round(s.frameRate) } : {}),
      cibles: [...cibles.entries()].map(([id, c]) => ({ id, nom: c.nom, statut: c.statut, erreur: c.erreur || '', mesure: c.mesure ? { kbps: c.mesure.kbps, fps: c.mesure.fps, w: c.mesure.w, h: c.mesure.h, frein: c.mesure.frein } : null }))
    };
  }
  function publier() {
    const e = etat();
    document.body.classList.toggle('prete', e.phase !== 'attente');
    document.body.classList.toggle('en-cours', e.phase === 'direct');
    try { canal.postMessage(e); } catch (err) { /* rien */ }
    const pas = ui.querySelector('#df-pastille');
    pas.hidden = !enDirect && !rec;
    pas.textContent = [enDirect ? `● En direct · ${e.cibles.filter(c => c.statut === 'en-direct').length}/${e.cibles.length}` : '', rec ? '⏺ Enregistrement' : ''].filter(Boolean).join('   ');
    ui.querySelector('#df-cibles').innerHTML = e.cibles.map(c => `<div class="df-cible ${c.statut}"><b>${esc(c.nom)}</b><span>${{ connexion: 'connexion…', reconnexion: 'reconnexion…', 'en-direct': c.mesure && c.mesure.kbps ? `${(c.mesure.kbps / 1000).toFixed(1)} Mb/s · ${c.mesure.h}p` : 'en direct', erreur: 'refusé' }[c.statut] || ''}</span>${c.erreur && c.statut !== 'en-direct' ? `<small>${esc(c.erreur)}</small>` : ''}</div>`).join('');
  }

  canal.onmessage = ev => {
    const m = ev.data || {};
    if (m.type === 'ping') return publier();
    if (m.type === 'go') {
      if (!sortie) return publier();
      if (m.hauteur || m.debit) {
        const avant = reglages.hauteur, fpsAvant = reglages.fps;
        reglages = { hauteur: m.hauteur === 720 ? 720 : 1080, debit: Math.min(9000000, Math.max(1500000, +m.debit || 6000000)), fps: +m.fps === 60 ? 60 : (rec ? fpsAvant : 30) };
        if (rec) reglages.fps = fpsAvant;   // jamais de changement de cadence pendant un enregistrement
        if (reglages.fps !== fpsAvant) capture.getVideoTracks()[0].applyConstraints({ frameRate: { ideal: reglages.fps, max: 60 } }).catch(() => {});
        if ((avant !== reglages.hauteur || fpsAvant !== reglages.fps) && !rec) {   // nouvelle taille (jamais pendant un enregistrement : le fichier serait coupé) : on refait l'image fixe, et on la glisse dans les envois en cours sans couper
          const audio = sortie.audio, ancienne = sortie;
          sortie = normaliser(capture.getVideoTracks()[0]); sortie.audio = audio;
          for (const c of cibles.values()) {
            if (!c.envoi) continue;
            for (const s of c.envoi.pc.getSenders()) if (s.track && s.track.kind === 'video') {
              s.replaceTrack(sortie.video).catch(() => {});
              const pr = s.getParameters(); if (pr.encodings && pr.encodings[0]) { pr.encodings[0].maxBitrate = reglages.debit; pr.encodings[0].maxFramerate = reglages.fps; s.setParameters(pr).catch(() => {}); }
            }
          }
          setTimeout(() => ancienne.arreter(), 500);
        }
      }
      enDirect = true;
      dire('En direct', 'Le live part d\'ici. Garde cette fenêtre ouverte jusqu\'à la fin (tu peux la mettre derrière la régie).');
      appliquer(Array.isArray(m.cibles) ? m.cibles : []);
      return publier();
    }
    if (m.type === 'stop') {
      arreterTout();
      dire('Direct terminé', 'Tu peux fermer cette fenêtre, ou la garder pour le prochain direct.');
      return publier();
    }
    if (m.type === 'rec') {
      if (m.action === 'start') demarrerRec(m.nom); else if (m.action === 'stop') arreterRec();
      return publier();
    }
    if (m.type === 'marquer') { if (sortie && (enDirect || rec)) marquer(); return publier(); }
    if (m.type === 'replay') { if (m.action === 'stop') arreterReplay(); else if (sortie && (enDirect || rec)) rejouer(!!m.ralenti); return publier(); }
    if (m.type === 'fermer') { arreterTout(); if (capture) capture.getTracks().forEach(t => t.stop()); window.close(); }
  };
  // la régie sait tout de suite que la fenêtre est là, puis toutes les 2 s (battement de cœur)
  publier();
  addEventListener('beforeunload', e => { if (enDirect || rec || marques.some(x => !x.fait)) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('pagehide', () => { arreterTout(); arreterRec(); try { canal.postMessage({ type: 'etat', format: FORMAT, phase: 'fermee', t: Date.now(), cibles: [] }); } catch (e) { /* rien */ } });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && capture && (!verrouEcran || verrouEcran.released)) { try { verrouEcran = await navigator.wakeLock.request('screen'); } catch (e) { /* facultatif */ } }
  });
})();
