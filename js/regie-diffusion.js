/* MESA : check-up avant le direct, et aiguillage automatique de l'envoi (version sans OBS).
   Le check-up regarde le navigateur, l'appareil, la puissance (vrai essai d'encodage) et le débit montant,
   puis choisit tout seul le meilleur chemin pour chaque plateforme :
     - « direct »  : le navigateur monte le live et l'envoie tout droit (Twitch accepte le WebRTC : rien ne passe par nos serveurs) ;
     - « relais »  : le navigateur monte le live une seule fois et l'envoie au relais MESA, qui le recopie sans le réencoder
                     vers YouTube et les autres (le serveur ne fait que le facteur, donc il coûte très peu) ;
     - « serveur » : l'ordinateur ou le navigateur ne suivent pas (téléphone, Safari, vieux PC, petite connexion),
                     le serveur MESA monte tout (ancien mode, le plus cher, gardé en secours).
   Le client ne voit qu'un verdict simple ; le détail des chemins est replié sous « Détails ». */
'use strict';

const WHIP_PLATEFORMES = { twitch: 'https://g.webrtc.live-video.net:4443/v2/offer' };   // ingestion WebRTC officielle de Twitch
const DEBIT = { 1080: 6000000, 720: 3500000 };          // débit vidéo envoyé (Twitch plafonne à 6 Mb/s)
const DEBIT60 = { 1080: 6000000, 720: 4500000 };        // en 60 images/s (mode Jeu) : 720p a besoin de plus ; 1080p reste au plafond de Twitch
const RESERVE_CAMERA = 3;                                 // Mb/s gardés pour ta propre caméra (elle part aussi vers la salle)
const CLE_CHECKUP = 'obseb:checkup';
const serveurOBSeb = () => (session.serveur || '').replace(/\/+$/, '');
let checkup = null;   // dernier résultat
try { const c = JSON.parse(sessionStorage.getItem(CLE_CHECKUP) || 'null'); if (c && Date.now() - c.t < 15 * 60000) checkup = c; } catch (e) { /* rien */ }

/* ---------- Les mesures ---------- */
function mesureNavigateur() {
  const ua = navigator.userAgent, uad = navigator.userAgentData;
  let nom = 'Autre', version = 0;
  const marques = uad && uad.brands ? uad.brands.map(b => ({ n: b.brand, v: parseInt(b.version, 10) })) : [];
  const m = n => marques.find(b => b.n === n);
  if (m('Microsoft Edge')) ({ v: version } = m('Microsoft Edge')), nom = 'Edge';
  else if (m('Opera')) ({ v: version } = m('Opera')), nom = 'Opera';
  else if (m('Brave')) ({ v: version } = m('Brave')), nom = 'Brave';
  else if (m('Google Chrome')) ({ v: version } = m('Google Chrome')), nom = 'Chrome';
  else if (m('Chromium')) ({ v: version } = m('Chromium')), nom = 'Chromium';
  else if (/Edg\/(\d+)/.test(ua)) { nom = 'Edge'; version = +RegExp.$1; }
  else if (/Firefox\/(\d+)/.test(ua)) { nom = 'Firefox'; version = +RegExp.$1; }
  else if (/Chrome\/(\d+)/.test(ua)) { nom = 'Chrome'; version = +RegExp.$1; }
  else if (/Version\/(\d+).*Safari/.test(ua)) { nom = 'Safari'; version = +RegExp.$1; }
  const chromium = marques.some(b => b.n === 'Chromium') || (/Chrome\//.test(ua) && !/Firefox/.test(ua));
  const moteur = chromium && version === 0 ? parseInt((marques.find(b => b.n === 'Chromium') || {}).v || 0, 10) : version;
  let h264 = false;
  try { h264 = RTCRtpSender.getCapabilities('video').codecs.some(c => /h264/i.test(c.mimeType)); } catch (e) { /* rien */ }
  const outils = {
    capture: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    sceneSeule: 'RestrictionTarget' in window || 'CropTarget' in window,
    imageFixe: 'MediaStreamTrackProcessor' in window,
    encodeur: 'VideoEncoder' in window,
    h264
  };
  const ok = chromium && (moteur || version) >= 116 && outils.capture && h264;
  let aide = '';
  if (nom === 'Safari') aide = 'Safari ne sait pas encore envoyer un live monté : le serveur s\'en charge.';
  else if (nom === 'Firefox') aide = 'Firefox ne sait pas encore capturer la scène seule : le serveur s\'en charge.';
  else if (!ok) aide = 'Navigateur trop ancien ou incomplet : mets Chrome ou Edge à jour.';
  return { nom, version, chromium, outils, ok, aide };
}
function mesureAppareil() {
  const ua = navigator.userAgent, uad = navigator.userAgentData;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const mobile = (uad && uad.mobile) || /Android|iPhone|iPod|Mobi/i.test(ua) || ipad || /iPad|Tablet/i.test(ua);
  const dpr = window.devicePixelRatio || 1;
  const ecran = { w: Math.round(screen.width * dpr), h: Math.round(screen.height * dpr) };
  return { ordinateur: !mobile, type: mobile ? (ipad || /iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobi/.test(ua)) ? 'tablette' : 'téléphone') : 'ordinateur', ecran };
}
function nomCarteGraphique() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return String(r).replace(/^ANGLE \((.*)\)$/, '$1').replace(/ Direct3D.*$/, '').replace(/,? ?\(0x[0-9a-f]+\)/i, '').split(',').slice(-1)[0].trim().slice(0, 60);
  } catch (e) { return ''; }
}
/* Vrai essai : encoder 2 à 3 secondes de vidéo en H.264, aussi vite que possible, et compter les images par seconde */
async function bancEncodage(w, h, n = 90) {
  if (!('VideoEncoder' in window)) return null;
  const cfg = { codec: h > 720 ? 'avc1.42E028' : 'avc1.42E01F', width: w, height: h, bitrate: DEBIT[h > 720 ? 1080 : 720], framerate: 30,
    latencyMode: 'realtime', avc: { format: 'annexb' } };
  try { if (!(await VideoEncoder.isConfigSupported(cfg)).supported) return null; } catch (e) { return null; }
  let recues = 0, erreur = null;
  const enc = new VideoEncoder({ output: () => { recues++; }, error: e => { erreur = e; } });
  enc.configure(cfg);
  const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d');
  const t0 = performance.now();
  for (let i = 0; i < n && !erreur; i++) {
    // une image qui bouge vraiment (dégradé, formes, texte), sinon l'encodeur triche
    const g = cx.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${i * 4},70%,40%)`); g.addColorStop(1, `hsl(${i * 4 + 120},70%,20%)`);
    cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    for (let k = 0; k < 24; k++) { cx.fillStyle = `hsla(${(k * 37 + i * 9) % 360},80%,60%,.7)`; cx.fillRect((k * 173 + i * 11) % w, (k * 97 + i * 7) % h, w / 9, h / 9); }
    cx.fillStyle = '#fff'; cx.font = `${h / 12}px sans-serif`; cx.fillText('MESA ' + i, w / 3, h / 2);
    const f = new VideoFrame(cv, { timestamp: i * 33333 });
    enc.encode(f, { keyFrame: i % 60 === 0 }); f.close();
    while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 1));
    if (performance.now() - t0 > 8000) break;   // trop lent : inutile d'attendre davantage
  }
  try { await enc.flush(); } catch (e) { /* rien */ }
  const ms = performance.now() - t0;
  try { enc.close(); } catch (e) { /* déjà fermé */ }
  if (erreur || !recues) return null;
  let materiel = null;
  try {
    const i = await navigator.mediaCapabilities.encodingInfo({ type: 'webrtc', video: { contentType: 'video/H264', width: w, height: h, bitrate: cfg.bitrate, framerate: 30 } });
    materiel = !!i.powerEfficient;
  } catch (e) { /* rien */ }
  return { fps: Math.round(recues / (ms / 1000)), materiel };
}
async function mesurePuissance() {
  const coeurs = navigator.hardwareConcurrency || 0, memoire = navigator.deviceMemory || 0;
  const gpu = nomCarteGraphique();
  const b1080 = await bancEncodage(1920, 1080);
  let b720 = null;
  if (!b1080 || b1080.fps < 75) b720 = await bancEncodage(1280, 720);
  // 75 images/s encodées au banc = 2,5 fois le temps réel : la marge pour afficher les caméras et capturer la fenêtre
  let fps1080 = b1080 ? b1080.fps : 0, fps720 = b720 ? b720.fps : (b1080 ? Math.round(b1080.fps * 2.1) : 0);
  if (!b1080 && !b720) { fps1080 = coeurs >= 8 ? 80 : coeurs >= 6 ? 60 : 30; fps720 = fps1080 * 2; }   // pas d'essai possible : estimation prudente
  const pour = formats => fps1080 >= 75 * formats && coeurs >= 4 ? 1080 : fps720 >= 75 * formats ? 720 : 0;
  return { coeurs, memoire, gpu, fps1080, fps720, materiel: (b1080 || b720 || {}).materiel, essai: !!(b1080 || b720), hauteur1: pour(1), hauteur2: pour(2) };
}
/* Débit montant : 4 secondes d'envoi de données au hasard (rien n'est gardé) */
async function mesureDebit() {
  const srv = serveurOBSeb();
  const url = srv ? srv + '/debit' : 'https://speed.cloudflare.com/__up';
  // des envois de 4 Mo : assez gros pour mesurer une fibre, assez peu nombreux pour ne pas faire sonner l'anti-abus du serveur
  const bloc = new Uint8Array(4 * 1024 * 1024);
  for (let i = 0; i < bloc.length; i += 65536) crypto.getRandomValues(bloc.subarray(i, i + 65536));
  const t0 = performance.now(), fin = t0 + 4000;
  let octets = 0, rate = 0;
  const tache = async () => {
    while (performance.now() < fin) {
      try {
        // sans serveur MESA : envoi « opaque » (on ne lit pas la réponse, on chronomètre seulement)
        await fetch(url, srv ? { method: 'POST', body: bloc, cache: 'no-store' } : { method: 'POST', body: bloc, mode: 'no-cors', cache: 'no-store', headers: { 'Content-Type': 'text/plain' } });
        octets += bloc.length;
      } catch (e) { if (++rate > 2) return; }
    }
  };
  await Promise.race([Promise.all([tache(), tache()]), new Promise(r => setTimeout(r, 9000))]);
  const s = (performance.now() - t0) / 1000;
  if (!octets) return { mbps: null, source: srv ? 'serveur' : 'public' };
  return { mbps: Math.round(octets * 8 / s / 1e5) / 10, source: srv ? 'serveur' : 'public' };
}

/* ---------- L'aiguillage ---------- */
/* Destinations demandées : une par plateforme et par format (« les deux » = horizontal + vertical) */
function destinations(ids) {
  const liste = [];
  for (const id of ids) {
    const p = PLATEFORMES_LIVE.find(x => x.id === id); if (!p) continue;
    const c = compte(p); if (!comptePret(c)) continue;
    const formats = c.format === 'deux' ? [['horizontal', c.cle], ['vertical', c.cle2]] : [[c.format === 'vertical' ? 'vertical' : 'horizontal', c.cle]];
    for (const [format, cle] of formats) {
      const base = c.serveur.replace(/\/+$/, '');
      const whip = WHIP_PLATEFORMES[p.id] ? { url: WHIP_PLATEFORMES[p.id], jeton: cle } : /^https:\/\/.*whip/i.test(base) ? { url: base, jeton: cle } : null;
      liste.push({ cle: `${p.id}:${format}`, plateforme: p, format, rtmp: /^rtmps?:\/\//i.test(base) ? `${base}/${cle}` : null, whip });
    }
  }
  return liste;
}
function aiguiller(ck, dests) {
  const srv = !!serveurOBSeb();
  const formats = [...new Set(dests.map(d => d.format))];
  const plan = { mode: 'navigateur', hauteur: 1080, debit: DEBIT[1080], fps: 30, routes: {}, formats, raisons: [], envois: 0 };
  const navOk = ck && ck.navigateur.ok && ck.appareil.ordinateur;
  let hauteur = ck ? (formats.length > 1 ? ck.puissance.hauteur2 : ck.puissance.hauteur1) : 0;
  if (!ck) plan.raisons.push('Check-up pas encore fait');
  else if (!ck.appareil.ordinateur) plan.raisons.push(`Sur ${ck.appareil.type}, le serveur monte le live pour garder la qualité`);
  else if (!ck.navigateur.ok) plan.raisons.push(ck.navigateur.aide);
  else if (!hauteur) plan.raisons.push('Ordinateur trop juste pour monter le live sans saccades');
  // combien d'envois partent de l'ordinateur : un par format qui passe par le relais, plus un par plateforme en direct
  const compter = h => {
    let n = 0;
    for (const f of formats) {
      const ds = dests.filter(d => d.format === f);
      const parRelais = srv && ds.some(d => !d.whip);
      n += parRelais ? 1 : ds.filter(d => d.whip).length;
    }
    return { n, besoin: n * DEBIT[h] / 1e6 * 1.3 + RESERVE_CAMERA };
  };
  if (navOk && hauteur) {
    const up = ck.debit.mbps;
    if (up != null) {
      if (hauteur === 1080 && compter(1080).besoin > up) hauteur = 720;
      if (hauteur === 720 && compter(720).besoin > up) { hauteur = 0; plan.raisons.push(`Connexion montante trop faible (${up} Mb/s) pour envoyer depuis le navigateur`); }
    } else if (hauteur === 1080) { hauteur = 720; plan.raisons.push('Débit non mesuré : 720p par prudence'); }
  }
  if (!navOk || !hauteur) {
    plan.mode = srv ? 'serveur' : 'aucun';
    for (const d of dests) plan.routes[d.cle] = srv ? 'serveur' : 'impossible';
    return plan;
  }
  plan.hauteur = hauteur; plan.debit = DEBIT[hauteur];
  /* Mode Jeu : 60 images par seconde, si l'ordinateur encode assez vite (le double du 30 i/s, avec la même marge)
     et si la connexion suit. Sinon on reste en 30 i/s, toujours fluide pour les caméras. */
  if (etat.mode === 'jeu') {
    const vitesse = hauteur === 1080 ? ck.puissance.fps1080 : ck.puissance.fps720;
    const up = ck.debit.mbps, besoin60 = compter(hauteur).besoin - compter(hauteur).n * DEBIT[hauteur] / 1e6 * 1.3 + compter(hauteur).n * DEBIT60[hauteur] / 1e6 * 1.3;
    if (vitesse >= 150 * formats.length && up != null && besoin60 <= up) { plan.fps = 60; plan.debit = DEBIT60[hauteur]; }
    else plan.note60 = vitesse < 150 * formats.length ? 'ordinateur trop juste pour 60 images/s' : 'connexion trop juste pour 60 images/s';
  }
  for (const f of formats) {
    const ds = dests.filter(d => d.format === f);
    // dès qu'une plateforme a besoin du relais, tout ce format passe par lui : une seule vidéo encodée, un seul envoi depuis l'ordinateur
    const parRelais = srv && ds.some(d => !d.whip);
    for (const d of ds) plan.routes[d.cle] = parRelais ? 'relais' : d.whip ? 'direct' : 'impossible';
  }
  plan.envois = compter(hauteur).n;
  if (Object.values(plan.routes).includes('impossible')) plan.raisons.push('YouTube et les autres passent par le relais MESA, pas encore branché');
  return plan;
}

/* ---------- Le check-up animé ---------- */
const ETAPES = [
  { id: 'navigateur', nom: 'Navigateur', ico: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  { id: 'appareil', nom: 'Appareil', ico: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
  { id: 'puissance', nom: 'Puissance', ico: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  { id: 'debit', nom: 'Connexion', ico: '<path d="M12 20V6M6 12l6-6 6 6"/><path d="M4 21h16"/>' },
];
function texteEtape(id, r) {
  if (!r) return '';
  if (id === 'navigateur') return `${r.nom}${r.version ? ' ' + r.version : ''}${r.ok ? '' : ' · ' + (r.nom === 'Safari' || r.nom === 'Firefox' ? 'passe par le serveur' : 'à mettre à jour')}`;
  if (id === 'appareil') return `${r.type[0].toUpperCase() + r.type.slice(1)} · écran ${r.ecran.w} × ${r.ecran.h}`;
  if (id === 'puissance') return `${r.coeurs ? r.coeurs + ' cœurs' : 'Processeur'}${r.memoire ? ' · ' + r.memoire + ' Go' : ''}${r.essai ? ` · encode ${r.fps1080 || r.fps720} i/s en ${r.fps1080 ? '1080p' : '720p'}` : ''}${r.materiel ? ' · accélération matérielle' : ''}`;
  if (id === 'debit') return r.mbps == null ? 'Débit montant non mesuré' : `${r.mbps} Mb/s en envoi`;
  return '';
}
function noteEtape(id, r) {
  if (!r) return 'ko';
  if (id === 'navigateur') return r.ok ? 'ok' : 'moyen';
  if (id === 'appareil') return r.ordinateur ? 'ok' : 'moyen';
  if (id === 'puissance') return r.hauteur1 === 1080 ? 'ok' : r.hauteur1 ? 'moyen' : 'ko';
  if (id === 'debit') return r.mbps == null ? 'moyen' : r.mbps >= 12 ? 'ok' : r.mbps >= 7 ? 'moyen' : 'ko';
}

let ckFenetre = null;
function boiteCheckup() {
  if (ckFenetre) return ckFenetre;
  ckFenetre = document.createElement('div');
  ckFenetre.id = 'checkup'; ckFenetre.hidden = true;
  ckFenetre.innerHTML = `<div class="ck-boite" role="dialog" aria-modal="true" aria-labelledby="ck-titre">
      <div class="ck-tete"><b id="ck-titre">Check-up avant le direct</b><span class="ck-beta" title="Le studio est en bêta : dis-nous si quelque chose cloche">Bêta</span><button class="ck-x" id="ck-x" aria-label="Fermer">✕</button></div>
      <div class="ck-radar" aria-hidden="true">
        <svg viewBox="0 0 120 120"><circle class="ck-piste" cx="60" cy="60" r="52"/><circle class="ck-jauge" id="ck-jauge" cx="60" cy="60" r="52"/>
          <g class="ck-balai"><path d="M60 60 L60 8 A52 52 0 0 1 104 34 Z"/></g></svg>
        <div class="ck-centre"><b id="ck-pct">0 %</b><span id="ck-quoi">Analyse…</span></div>
      </div>
      <ul class="ck-liste">${ETAPES.map(e => `<li data-e="${e.id}"><svg class="ck-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${e.ico}</svg><div><b>${e.nom}</b><small></small></div><i class="ck-etat"></i></li>`).join('')}</ul>
      <div class="ck-verdict" id="ck-verdict" hidden></div>
      <div class="ck-bas"><button id="ck-refaire">Refaire</button><button class="primaire" id="ck-ok">Continuer</button></div>
      <p class="ck-note">Studio en bêta : le direct sans OBS marche le mieux sur Chrome ou Edge, sur ordinateur.</p>
    </div>`;
  document.body.appendChild(ckFenetre);
  ckFenetre.querySelector('#ck-x').onclick = () => fermerCheckup();
  ckFenetre.querySelector('#ck-refaire').onclick = () => lancerCheckup(ckFenetre.suite);
  ckFenetre.querySelector('#ck-ok').onclick = () => fermerCheckup(true);
  ckFenetre.addEventListener('click', e => { e.stopPropagation(); if (e.target === ckFenetre) fermerCheckup(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ckFenetre.hidden) fermerCheckup(); });
  return ckFenetre;
}
function fermerCheckup(continuer) {
  if (!ckFenetre) return;
  ckFenetre.hidden = true;
  const s = ckFenetre.suite; ckFenetre.suite = null;
  // le check-up conseille, il ne bloque jamais : même fermé, le menu du direct s'ouvre
  if (typeof s === 'function') setTimeout(s, 0);   // après le clic, sinon il refermerait aussitôt le menu
}
let ckEnCours = false;
async function lancerCheckup(suite) {
  const b = boiteCheckup();
  b.suite = suite || null;
  if (ckEnCours) { b.hidden = false; return; }
  ckEnCours = true;
  b.hidden = false; b.classList.add('en-cours'); b.classList.remove('fini');
  const jauge = b.querySelector('#ck-jauge'), pct = b.querySelector('#ck-pct'), quoi = b.querySelector('#ck-quoi');
  const L = 2 * Math.PI * 52;
  jauge.style.strokeDasharray = L;
  let cible = 0, affiche = 0;
  const anim = setInterval(() => { affiche += (cible - affiche) * 0.12; jauge.style.strokeDashoffset = L * (1 - affiche / 100); pct.textContent = Math.round(affiche) + ' %'; }, 30);
  b.querySelector('#ck-verdict').hidden = true;
  b.querySelector('#ck-ok').disabled = true;
  b.querySelector('#ck-refaire').disabled = true;
  b.querySelectorAll('.ck-liste li').forEach(li => { li.className = ''; li.querySelector('small').textContent = 'En attente'; });
  const res = { t: Date.now() };
  const poids = { navigateur: 8, appareil: 8, puissance: 52, debit: 32 };
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const mesures = { navigateur: async () => mesureNavigateur(), appareil: async () => mesureAppareil(), puissance: mesurePuissance, debit: mesureDebit };
  for (const e of ETAPES) {
    const li = b.querySelector(`li[data-e="${e.id}"]`);
    li.className = 'actif'; li.querySelector('small').textContent = { navigateur: 'Lecture du navigateur…', appareil: 'Identification de l\'appareil…', puissance: 'Essai d\'encodage vidéo…', debit: 'Mesure de l\'envoi…' }[e.id];
    quoi.textContent = e.nom;
    const debut = cible, monte = setInterval(() => { cible = Math.min(debut + poids[e.id] * 0.92, cible + poids[e.id] / 40); }, 100);
    try { res[e.id] = await mesures[e.id](); } catch (err) { res[e.id] = null; }
    clearInterval(monte);
    cible = debut + poids[e.id];
    await pause(e.id === 'navigateur' || e.id === 'appareil' ? 420 : 150);   // le temps de voir passer la ligne
    li.className = 'fait ' + noteEtape(e.id, res[e.id]);
    li.querySelector('small').textContent = texteEtape(e.id, res[e.id]) || 'Mesure impossible';
  }
  if (!res.puissance) res.puissance = { hauteur1: 0, hauteur2: 0, coeurs: 0 };
  if (!res.debit) res.debit = { mbps: null };
  if (!res.navigateur) res.navigateur = mesureNavigateur();
  if (!res.appareil) res.appareil = mesureAppareil();
  checkup = res;
  try { sessionStorage.setItem(CLE_CHECKUP, JSON.stringify(res)); } catch (e) { /* rien */ }
  await pause(300);
  clearInterval(anim); jauge.style.strokeDashoffset = 0; pct.textContent = '100 %'; quoi.textContent = 'Terminé';
  b.classList.remove('en-cours'); b.classList.add('fini');
  afficherVerdict();
  b.querySelector('#ck-ok').disabled = false;
  b.querySelector('#ck-refaire').disabled = false;
  ckEnCours = false;
  majCarteEnvoi();
}
function phraseVerdict(plan) {
  if (plan.mode === 'navigateur') {
    const imp = Object.values(plan.routes).includes('impossible');
    return { ton: imp ? 'moyen' : 'ok', titre: imp ? 'Presque prêt' : 'Tout est bon', texte: `Ton live partira en ${plan.hauteur}p, ${plan.fps || 30} images par seconde${plan.fps === 60 ? ' (mode Jeu)' : plan.note60 ? ` (mode Jeu : ${plan.note60}, on reste à 30)` : ''}.` };
  }
  if (plan.mode === 'serveur') return { ton: 'ok', titre: 'C\'est bon', texte: 'Le serveur MESA s\'occupe de l\'envoi pour garder la meilleure qualité.' };
  return { ton: 'moyen', titre: 'Direct sans OBS pas encore possible ici', texte: plan.raisons[0] || '' };
}
const NOM_ROUTE = { direct: 'en direct depuis ton navigateur', relais: 'par le relais MESA (le navigateur monte, le serveur recopie)', serveur: 'monté par le serveur MESA', impossible: 'pas encore possible' };
function afficherVerdict() {
  const v = ckFenetre && ckFenetre.querySelector('#ck-verdict'); if (!v) return;
  const dests = destinations(plateformesPretes().map(x => x.p.id));
  const plan = aiguiller(checkup, dests);
  const ph = phraseVerdict(plan);
  v.hidden = false;
  v.className = 'ck-verdict ' + ph.ton;
  v.innerHTML = `<b>${esc(ph.titre)}</b><p>${esc(ph.texte)}</p>
    ${dests.length ? `<details><summary>Détails</summary><ul>${dests.map(d => `<li><i style="background:${d.plateforme.couleur};color:${d.plateforme.texte || '#fff'}">${esc(d.plateforme.court)}</i>${esc(d.plateforme.nom)}${d.format === 'vertical' ? ' (vertical)' : ''} : ${NOM_ROUTE[plan.routes[d.cle]]}</li>`).join('')}</ul>${plan.raisons.length ? `<p>${plan.raisons.map(esc).join('<br>')}</p>` : ''}</details>` : '<p class="aide">Aucune plateforme configurée dans l\'onglet Diffusion : le check-up servira dès que tu en ajoutes une.</p>'}`;
}

/* ---------- Fenêtres de diffusion (une par format) ---------- */
const fenetres = {};   // format -> { win, etat, vu }
const canauxDiff = {};
function canalDiff(format) {
  if (!canauxDiff[format]) {
    canauxDiff[format] = new BroadcastChannel(`obseb-diffusion-${session.room}-${format}`);
    canauxDiff[format].onmessage = ev => {
      const m = ev.data || {}; if (m.type !== 'etat') return;
      const f = fenetres[format] || (fenetres[format] = {});
      f.etat = m; f.vu = Date.now();
      majEnvoiDirect();
    };
  }
  return canauxDiff[format];
}
['horizontal', 'vertical'].forEach(canalDiff);
function fenetrePrete(format) { const f = fenetres[format]; return !!(f && f.etat && f.vu && Date.now() - f.vu < 7000 && (f.etat.phase === 'prete' || f.etat.phase === 'direct')); }
function ouvrirFenetreDiffusion(format) {
  const url = `sortie.html?diffuser=1${format === 'vertical' ? '&format=vertical' : ''}${location.hash}`;
  const w = Math.max(960, screen.availWidth || 1280), h = Math.max(540, screen.availHeight || 720);
  const win = window.open(url, `obseb-diffusion-${format}`, `popup,width=${w},height=${h},left=0,top=0`);
  if (!win) { toast('Le navigateur a bloqué la fenêtre : autorise les fenêtres pop-up pour ce site'); return; }
  (fenetres[format] || (fenetres[format] = {})).win = win;
}
setInterval(() => {
  for (const f of ['horizontal', 'vertical']) { try { canauxDiff[f].postMessage({ type: 'ping' }); } catch (e) { /* rien */ } }
  surveiller();
}, 2000);

/* ---------- Démarrer, modifier, arrêter l'envoi ---------- */
let envoiActif = null;   // { plan, relais: {format: {chemin, jeton, whip, plateformes}}, ids }
async function appelRelais(action, corpsReq) {
  const r = await fetch(`${serveurOBSeb()}/relais/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ room: session.room, cle: hashParams().get('k') }, corpsReq)) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || 'Relais injoignable');
  return j;
}
/* Ce qu'il faut avant de cliquer sur « Démarrer » (affiché dans le menu du direct) */
function preparationEnvoi(ids) {
  const dests = destinations(ids);
  const plan = aiguiller(checkup, dests);
  const formatsNav = plan.mode === 'navigateur' ? [...new Set(dests.filter(d => ['direct', 'relais'].includes(plan.routes[d.cle])).map(d => d.format))] : [];
  return { dests, plan, formatsNav, manque: formatsNav.filter(f => !fenetrePrete(f)) };
}
function ciblesFormat(format, dests, plan, relais) {
  const ds = dests.filter(d => d.format === format && ['direct', 'relais'].includes(plan.routes[d.cle]));
  const cibles = ds.filter(d => plan.routes[d.cle] === 'direct').map(d => ({ id: d.cle, nom: d.plateforme.nom, url: d.whip.url, jeton: d.whip.jeton }));
  if (relais[format]) cibles.push({ id: 'relais:' + format, nom: 'Relais MESA · ' + ds.filter(d => plan.routes[d.cle] === 'relais').map(d => d.plateforme.nom).join(', '), url: serveurOBSeb() + relais[format].whip, jeton: relais[format].jeton });
  return cibles;
}
async function diffusionDemarrer(ids) {
  const prep = preparationEnvoi(ids);
  if (prep.plan.mode !== 'navigateur' || !prep.formatsNav.length) return null;   // OBS ou serveur : rien à faire ici
  if (prep.manque.length) throw new Error('Ouvre d\'abord la fenêtre de diffusion et autorise l\'envoi');
  const relais = {};
  for (const f of prep.formatsNav) {
    const rtmp = prep.dests.filter(d => d.format === f && prep.plan.routes[d.cle] === 'relais').map(d => d.rtmp).filter(Boolean);
    if (rtmp.length) relais[f] = Object.assign(await appelRelais('ouvrir', { destinations: rtmp, format: f }), { rtmp });
  }
  envoiActif = { plan: prep.plan, dests: prep.dests, relais, ids: ids.slice() };
  for (const f of prep.formatsNav) canalDiff(f).postMessage({ type: 'go', hauteur: prep.plan.hauteur, debit: prep.plan.debit, fps: prep.plan.fps || 30, cibles: ciblesFormat(f, prep.dests, prep.plan, relais) });
  return envoiActif;
}
/* Couper ou relancer une plateforme pendant le direct */
async function diffusionMaj(actifs) {
  if (!envoiActif) return;
  const { plan, dests, relais } = envoiActif;
  const garde = dests.filter(d => actifs.includes(d.plateforme.id));
  for (const f of Object.keys(relais).concat(plan.formats.filter(f => !relais[f]))) {
    if (relais[f]) {
      const rtmp = garde.filter(d => d.format === f && plan.routes[d.cle] === 'relais').map(d => d.rtmp).filter(Boolean);
      if (rtmp.length && rtmp.join() !== relais[f].rtmp.join()) { try { await appelRelais('modifier', { chemin: relais[f].chemin, destinations: rtmp }); relais[f].rtmp = rtmp; } catch (e) { toast(e.message); } }
      relais[f].coupe = !rtmp.length;
    }
    const r = Object.fromEntries(Object.entries(relais).filter(([, x]) => !x.coupe));
    canalDiff(f).postMessage({ type: 'go', hauteur: plan.hauteur, debit: plan.debit, fps: plan.fps || 30, cibles: ciblesFormat(f, garde, plan, r) });
  }
}
async function diffusionArreter() {
  if (!envoiActif) return;
  const { relais, plan } = envoiActif; envoiActif = null;
  for (const f of plan.formats) { try { canalDiff(f).postMessage({ type: 'stop' }); } catch (e) { /* rien */ } }
  for (const r of Object.values(relais)) { try { await appelRelais('fermer', { chemin: r.chemin }); } catch (e) { /* déjà fermé */ } }
}
function passerEn30() {
  if (!envoiActif) return;
  envoiActif.plan.fps = 30; envoiActif.plan.debit = DEBIT[envoiActif.plan.hauteur];
  diffusionMaj(envoiActif.ids.filter(id => !(etat.direct && etat.direct.coupees.includes(id))));
  toast('Le live passe en 30 images par seconde');
}
function passerEn720() {
  if (!envoiActif) return;
  envoiActif.plan.hauteur = 720; envoiActif.plan.debit = (envoiActif.plan.fps === 60 ? DEBIT60 : DEBIT)[720];
  diffusionMaj(envoiActif.ids.filter(id => !(etat.direct && etat.direct.coupees.includes(id))));
  toast('Le live passe en 720p');
}

/* ---------- Surveillance pendant le direct ---------- */
let alerteVue = '';
function surveiller() {
  if (!envoiActif || !etat.direct) return montrerAlerte('');
  const formats = [...new Set(envoiActif.dests.filter(d => ['direct', 'relais'].includes(envoiActif.plan.routes[d.cle])).map(d => d.format))];
  for (const f of formats) {
    const x = fenetres[f];
    if (!x || !x.vu || Date.now() - x.vu > 7000 || (x.etat && x.etat.phase === 'fermee')) return montrerAlerte(`La fenêtre de diffusion${formats.length > 1 ? ' (' + f + ')' : ''} est fermée : le live ne part plus.`, 'rouvrir:' + f);
    if (x.etat && x.etat.phase === 'prete') return montrerAlerte('La fenêtre de diffusion n\'envoie plus (capture arrêtée ?). Relance l\'envoi.', 'relancer');
    const frein = (x.etat.cibles || []).map(c => c.mesure && c.mesure.frein).find(Boolean);
    if (frein && envoiActif.plan.fps === 60) return montrerAlerte(frein === 'cpu' ? 'Ton ordinateur peine à suivre en 60 images/s.' : 'Ta connexion peine à suivre en 60 images/s.', '30');
    if (frein && envoiActif.plan.hauteur === 1080) return montrerAlerte(frein === 'cpu' ? 'Ton ordinateur peine à suivre en 1080p.' : 'Ta connexion peine à suivre en 1080p.', '720');
  }
  montrerAlerte('');
}
function montrerAlerte(texte, action) {
  let a = document.getElementById('envoi-alerte');
  if (!texte) { if (a) a.hidden = true; alerteVue = ''; return; }
  if (!a) { a = document.createElement('div'); a.id = 'envoi-alerte'; a.setAttribute('role', 'alert'); document.body.appendChild(a); }
  if (alerteVue === texte + action && !a.hidden) return;
  alerteVue = texte + action;
  const bouton = action === '30' ? '<button data-a="30">Passer en 30 images/s</button>' : action === '720' ? '<button data-a="720">Passer en 720p</button>' : action && action.startsWith('rouvrir') ? '<button data-a="rouvrir">Rouvrir la fenêtre</button>' : action === 'relancer' ? '<button data-a="relancer">Relancer l\'envoi</button>' : '';
  a.innerHTML = `<span>${esc(texte)}</span>${bouton}<button data-a="x" aria-label="Masquer">✕</button>`;
  a.hidden = false;
  a.onclick = e => {
    const k = e.target.dataset.a; if (!k) return;
    if (k === 'x') { a.hidden = true; return; }
    if (k === '720') passerEn720();
    if (k === '30') passerEn30();
    if (k === 'rouvrir') ouvrirFenetreDiffusion(action.split(':')[1]);
    if (k === 'relancer') diffusionMaj(envoiActif.ids.filter(id => !(etat.direct && etat.direct.coupees.includes(id))));
  };
}

/* ---------- Ce que montrent le menu du direct et l'onglet Diffusion ---------- */
/* Bloc « Envoi » dans le menu « Démarrer le direct » */
function blocEnvoi(ids) {
  const prep = preparationEnvoi(ids);
  if (!prep.dests.length) return '';
  if (!checkup) return `<div class="envoi-bloc"><b>Avant de partir</b><p>Un check-up rapide choisit le meilleur chemin pour ton live.</p><button id="envoi-checkup">Faire le check-up</button></div>`;
  const ph = phraseVerdict(prep.plan);
  let fen = '';
  for (const f of prep.formatsNav) {
    const pret = fenetrePrete(f), x = fenetres[f] && fenetres[f].etat;
    fen += `<div class="envoi-fen ${pret ? 'ok' : ''}"><span>${pret ? '✓ ' : ''}Fenêtre de diffusion${prep.formatsNav.length > 1 ? ' ' + f : ''}${pret && x && x.son === false ? ' · sans le son !' : ''}</span>${pret ? '' : `<button data-ouvrir="${f}">Ouvrir</button>`}</div>`;
  }
  return `<div class="envoi-bloc ${ph.ton}"><b>${esc(ph.titre)}</b><p>${esc(ph.texte)} <a href="#" id="envoi-checkup">Refaire le check-up</a></p>${fen}</div>`;
}
function brancherBlocEnvoi(racine, relancer) {
  const b = racine.querySelector('#envoi-checkup');
  if (b) b.onclick = e => { e.preventDefault(); lancerCheckup(relancer); };
  racine.querySelectorAll('[data-ouvrir]').forEach(x => x.onclick = () => ouvrirFenetreDiffusion(x.dataset.ouvrir));
}
/* Mise à jour en direct du menu quand une fenêtre de diffusion change d'état */
function majEnvoiDirect() {
  const pop = document.getElementById('direct-pop');
  if (pop && !pop.hidden && typeof dessinerPop === 'function' && !pop.contains(document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement : null)) {
    const bloc = pop.querySelector('.envoi-bloc, .envoi-suivi');
    if (bloc) {
      const avant = bloc.outerHTML;
      const tmp = document.createElement('div');
      tmp.innerHTML = etat.direct ? suiviEnvoi() : blocEnvoi([...pop.querySelectorAll('[data-pf]:checked')].map(x => x.dataset.pf));
      if (tmp.firstElementChild && tmp.innerHTML !== avant) { bloc.replaceWith(tmp.firstElementChild); brancherBlocEnvoi(pop, () => { pop.hidden = false; dessinerPop(); }); }
    }
    const go = pop.querySelector('#pop-go');
    if (go && !etat.direct) majBoutonGo(go);
  }
}
function majBoutonGo(go) {
  const ids = [...document.querySelectorAll('#direct-pop [data-pf]:checked')].map(x => x.dataset.pf);
  const prep = preparationEnvoi(ids);
  const attente = prep.plan.mode === 'navigateur' && prep.manque.length > 0;
  go.disabled = attente;
  go.title = attente ? 'Ouvre d\'abord la fenêtre de diffusion' : '';
}
/* Pendant le direct : l'état de chaque envoi */
function suiviEnvoi() {
  if (!envoiActif) return '';
  const lignes = [];
  for (const f of Object.keys(fenetres)) {
    const x = fenetres[f].etat; if (!x || !x.cibles || !x.cibles.length) continue;
    for (const c of x.cibles) lignes.push(`<li class="${c.statut}"><b>${esc(c.nom)}</b><span>${c.statut === 'en-direct' ? (c.mesure && c.mesure.kbps ? `${(c.mesure.kbps / 1000).toFixed(1)} Mb/s · ${c.mesure.h}p · ${c.mesure.fps} i/s` : 'envoi…') : c.statut === 'erreur' ? esc(c.erreur || 'refusé') : 'connexion…'}</span></li>`);
  }
  return `<div class="envoi-suivi"><b>Envoi depuis ton navigateur</b><ul>${lignes.join('') || '<li>Connexion…</li>'}</ul></div>`;
}
/* Carte en haut de l'onglet Diffusion */
function majCarteEnvoi() {
  const el = document.getElementById('envoi-carte'); if (!el) return;
  const ph = checkup ? phraseVerdict(aiguiller(checkup, destinations(plateformesPretes().map(x => x.p.id)))) : null;
  el.innerHTML = `<div class="envoi-carte-tete"><b>Check-up du direct</b><span class="ck-beta">Bêta</span></div>
    <p${ph ? '' : ' class="ck-intro"'}>${ph ? `${esc(ph.titre)} : ${esc(ph.texte)}` : 'Vérifie ton navigateur, ton ordinateur et ta connexion avant le live : le studio choisit tout seul le meilleur chemin.'}</p>
    <button class="petit" id="envoi-carte-go">${checkup ? 'Refaire le check-up' : 'Faire le check-up'}</button>`;
  el.querySelector('#envoi-carte-go').onclick = () => lancerCheckup();
}
setTimeout(majCarteEnvoi, 0);   // après le chargement des autres scripts de la régie (plateformesPretes)
