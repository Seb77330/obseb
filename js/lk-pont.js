/* MESA : pont LiveKit.
   Cette page remplace une fenêtre vdo.ninja : mêmes paramètres d'adresse, mêmes messages (postMessage),
   mais la vidéo passe par le serveur LiveKit de MESA. Si le serveur ne répond pas, elle bascule
   toute seule sur vdo.ninja (roue de secours), avec exactement les mêmes paramètres. */
'use strict';
const LK = window.LivekitClient;
const P = new URLSearchParams(location.search);
const has = k => P.has(k);
const SERVEUR = (P.get('lk') || '').replace(/\/+$/, '');
const ROOM = P.get('room') || '';
const PUSH = P.get('push');
const VIEW = P.get('view');
const LABEL = P.get('label') || '';
const ECRAN = has('screenshare');
const video = document.getElementById('v');
const etatEl = document.getElementById('etat');
const parent = window.parent !== window ? window.parent : null;
const dire = msg => { if (parent) parent.postMessage(msg, '*'); };
const etat = t => { etatEl.textContent = t || ''; };

document.body.classList.toggle('cover', has('cover'));
document.body.classList.toggle('fond', !has('transparent') && !PUSH);

function secours(raison) {
  console.warn('MESA : bascule sur vdo.ninja', raison);
  const q = new URLSearchParams(location.search);
  ['lk', 'cle'].forEach(k => q.delete(k));
  location.replace('https://vdo.ninja/?' + q.toString().replace(/=(?=&|$)/g, ''));
}

/* Choix d'un appareil par morceau de nom (Cam_Link_4K -> « Cam Link 4K ») */
async function appareil(type, voulu) {
  if (!voulu || voulu === '1') return undefined;
  const nom = voulu.replace(/_/g, ' ').toLowerCase();
  const liste = await LK.Room.getLocalDevices(type, true);
  const d = liste.find(x => x.label.toLowerCase().startsWith(nom)) || liste.find(x => x.deviceId === voulu) || liste.find(x => x.label.toLowerCase().includes(nom));
  return d && d.deviceId;
}

let room = null, volume = 1, envoiNiveau = null;

async function jeton(identite) {
  const r = await fetch(SERVEUR + '/jeton', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: ROOM, identite, nom: LABEL, publier: !!PUSH, cle: P.get('cle') || undefined, pour: P.get('pour') || undefined })
  });
  if (!r.ok) {
    const e = new Error('jeton ' + r.status); e.refus = r.status === 403;
    try { const j = await r.json(); e.message = j.erreur || e.message; e.attente = !!j.attente; } catch (err) { /* rien */ }
    throw e;
  }
  return r.json();
}

function appliquerVolume() {
  if (!room) return;
  for (const p of room.remoteParticipants.values()) p.setVolume(has('noaudio') ? 0 : volume);
}

async function demarrer() {
  if (!SERVEUR || !LK) return secours('pas de serveur');
  const identite = PUSH || `${ROOM}_v${Math.random().toString(36).slice(2, 8)}`;
  /* Règle d'or : tout le studio est sur le même transport. On ne bascule sur vdo.ninja que si le serveur
     est injoignable (alors il l'est pour tout le monde). Un refus ou un réseau difficile ne fait jamais
     basculer une seule fenêtre : sinon un invité serait connecté mais invisible à l'antenne. */
  let acces;
  try { acces = await jeton(identite); }
  catch (e) {
    // aperçu d'un invité pas encore admis : on réessaie tout seul jusqu'à ce que l'animateur le fasse entrer
    if (e.attente) { etat('En salle d\'attente…'); setTimeout(demarrer, 4000); return; }
    if (e.refus) { etat(e.message && !/^jeton/.test(e.message) ? e.message : 'Accès refusé par le serveur MESA (lien incomplet ?)'); dire({ obsebRefus: e.message }); return; }
    return secours(e.message);
  }

  room = new LK.Room({
    // chaque fenêtre reçoit la couche adaptée à sa taille réelle à l'écran : 1080p pour un invité seul en grand,
    // 360p/720p pour une vignette dans une grille de 13 (le serveur ne décode pas 13 flux 1080p pour rien)
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: {
      simulcast: !ECRAN,
      videoSimulcastLayers: [LK.VideoPresets.h360, LK.VideoPresets.h720],
      videoEncoding: { maxBitrate: ECRAN ? 6_000_000 : 6_000_000, maxFramerate: 30 },
      screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 30 },
      audioPreset: has('proaudio') ? LK.AudioPresets.musicHighQualityStereo : { maxBitrate: 64_000 },
      dtx: false, red: true,
      // animateur : garder la 1080p quoi qu'il arrive (le navigateur baisse les images/s plutôt que la définition)
      degradationPreference: has('proaudio') ? 'maintain-resolution' : 'balanced',              // DTX coupe les souffles et les fins de mots : jamais
    },
  });

  // Qui je reçois : en mode « voir », seulement la personne regardée
  const veutRecevoir = (pub, participant) => {
    if (VIEW) return participant.identity === VIEW;
    if (pub.kind === LK.Track.Kind.Video) return false;      // en publication, on n'affiche que soi
    return !has('noaudio');
  };
  room.on(LK.RoomEvent.TrackPublished, (pub, participant) => { pub.setSubscribed(veutRecevoir(pub, participant)); });
  room.on(LK.RoomEvent.TrackSubscribed, (track, pub, participant) => {
    if (track.kind === LK.Track.Kind.Video) {
      if (VIEW && participant.identity === VIEW) {
        // un écran partagé passe devant la caméra s'il existe
        if (pub.source === LK.Track.Source.ScreenShare || !video.srcObject || video.dataset.source !== 'screen_share') {
          track.attach(video); video.dataset.source = pub.source; video.muted = true; video.classList.remove('miroir');
        }
      }
    } else if (track.kind === LK.Track.Kind.Audio) {
      const a = track.attach(); a.style.display = 'none'; document.body.appendChild(a);
      appliquerVolume();
    }
  });
  room.on(LK.RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => { if (el !== video) el.remove(); }));
  room.on(LK.RoomEvent.ParticipantConnected, p => {
    appliquerVolume();
    dire({ action: 'guest-connected', streamID: p.identity, value: { label: p.name || '' } });
  });
  room.on(LK.RoomEvent.ParticipantDisconnected, p => dire({ action: 'push-connection', streamID: p.identity, value: false }));
  room.on(LK.RoomEvent.DataReceived, (payload, participant, kind, topic) => {
    if (!participant) return;
    if (VIEW && participant.identity !== VIEW) return;       // la sortie n'écoute que la personne regardée (l'animateur)
    let obj; try { obj = JSON.parse(new TextDecoder().decode(payload)); } catch (e) { return; }
    dire({ dataReceived: obj, UUID: participant.identity, streamID: participant.identity });
  });
  room.on(LK.RoomEvent.Disconnected, () => { etat('Connexion perdue, reconnexion…'); setTimeout(() => location.reload(), 3000); });

  try {
    await room.connect(acces.url, acces.token, { autoSubscribe: false });
  } catch (e) {
    // LiveKit a déjà essayé UDP, TCP puis le relais TURN : on réessaie plutôt que de changer de transport
    etat('Connexion difficile, nouvel essai…'); setTimeout(() => location.reload(), 4000); return;
  }
  for (const p of room.remoteParticipants.values()) for (const pub of p.trackPublications.values()) pub.setSubscribed(veutRecevoir(pub, p));

  /* Salle d'attente : un invité entre sans caméra ni micro, et ne voit ni n'entend rien, jusqu'à ce que l'animateur le fasse entrer */
  if (PUSH && acces.attente) {
    etat('Salle d\'attente : l\'animateur va te faire entrer');
    dire({ obsebAttente: true });
    room.on(LK.RoomEvent.ParticipantPermissionsChanged, async (avant, participant) => {
      const pm = room.localParticipant.permissions;
      if (participant && participant !== room.localParticipant) return;
      if (pm && pm.canPublish && !(avant && avant.canPublish)) {
        dire({ obsebAttente: false });
        for (const p of room.remoteParticipants.values()) for (const pub of p.trackPublications.values()) pub.setSubscribed(veutRecevoir(pub, p));
        await publier();
        etat('');
      }
    });
    return;
  }
  if (PUSH) await publier();
  etat('');
}

async function publier() {
  const lp = room.localParticipant;
  if (ECRAN) {
    try {
      await lp.setScreenShareEnabled(true, { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }, resolution: { width: 1920, height: 1080, frameRate: 30 }, contentHint: 'detail' });
    } catch (e) { etat('Partage d\'écran annulé'); return; }
    const pub = [...lp.trackPublications.values()].find(x => x.source === LK.Track.Source.ScreenShare);
    if (pub && pub.track) { pub.track.attach(video); video.classList.remove('miroir'); }
    return;
  }
  if (!has('novideo-envoi')) {
    const deviceId = await appareil('videoinput', P.get('vd'));
    await lp.setCameraEnabled(true, { deviceId, resolution: LK.VideoPresets.h1080.resolution, frameRate: 30 })
      .catch(e => etat(e.name === 'NotReadableError' ? 'Caméra déjà utilisée par un autre logiciel' : 'Caméra indisponible'));
    const pub = lp.getTrackPublication(LK.Track.Source.Camera);
    if (pub && pub.track) { pub.track.attach(video); video.classList.add('miroir'); }
  }
  if (P.get('ad') === '0') return;        // caméra supplémentaire : image seule, pas de micro
  const pro = has('proaudio');
  const deviceId = await appareil('audioinput', P.get('ad'));
  await lp.setMicrophoneEnabled(true, {
    deviceId, channelCount: pro ? 2 : 1,
    echoCancellation: !pro, noiseSuppression: !pro, autoGainControl: !pro,   // casque + bon micro : aucun traitement
  }).catch(() => etat('Micro indisponible'));
}

/* ----- Messages de la page parente (mêmes noms que vdo.ninja) ----- */
addEventListener('message', async e => {
  if (e.source !== parent) return;
  const d = e.data; if (!d || typeof d !== 'object' || !room) return;
  if (d.sendData !== undefined) {
    const data = new TextEncoder().encode(JSON.stringify(d.sendData));
    const cible = d.UUID || d.streamID;
    room.localParticipant.publishData(data, { reliable: true, destinationIdentities: cible ? [cible] : undefined }).catch(() => {});
  }
  if (typeof d.volume === 'number') { volume = Math.max(0, Math.min(1, d.volume)); appliquerVolume(); }
  if (d.getStreamIDs) {
    const ids = {};
    for (const p of room.remoteParticipants.values()) ids[p.identity] = p.name || '';
    dire({ streamIDs: ids });
  }
  if (d.getLoudness && !envoiNiveau) {
    envoiNiveau = setInterval(() => {
      const p = VIEW ? room.remoteParticipants.get(VIEW) : room.localParticipant;
      if (p) dire({ loudness: Math.round((p.audioLevel || 0) * 100) });
    }, 100);
  }
  if (d.style && typeof d.style === 'string') {
    // cadrage demandé par la sortie : seulement remplir ou tout voir
    if (/object-fit:\s*contain/.test(d.style)) document.body.classList.remove('cover');
    else if (/object-fit:\s*cover/.test(d.style)) document.body.classList.add('cover');
  }
  if (d.getStats && VIEW) {
    dire({ stats: { resolution: video.videoWidth ? `${video.videoWidth} x ${video.videoHeight}` : '' } });
    return;
  }
  if (d.getStats) {
    const pub = room.localParticipant.getTrackPublication(ECRAN ? LK.Track.Source.ScreenShare : LK.Track.Source.Camera);
    const t = pub && pub.track;
    const s = t && t.mediaStreamTrack ? t.mediaStreamTrack.getSettings() : {};
    dire({ stats: { outbound: { resolution: s.width ? `${s.width}x${s.height}` : '', bitrate_kbps: t && t.currentBitrate ? Math.round(t.currentBitrate / 1000) : 0 } } });
  }
});

demarrer();
