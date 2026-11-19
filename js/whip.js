/* MESA : envoi d'une vidéo en WebRTC selon la norme WHIP (RFC 9725).
   Sert à deux choses : envoyer le live tout droit à Twitch, ou l'envoyer au relais MESA (qui le recopie vers YouTube et les autres).
   Toujours en H.264 : c'est ce que Twitch exige, et ce que le relais peut recopier vers le RTMP sans rien réencoder. */
'use strict';

/* Son du live en stéréo, 128 kb/s (par défaut, le navigateur envoie du mono à 32 kb/s, fait pour la voix) */
function sdpSonStereo(sdp) {
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!m) return sdp;
  const pt = m[1];
  return sdp.replace(new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`), (l, p) => {
    const garde = p.split(';').filter(x => !/^(stereo|sprop-stereo|maxaveragebitrate|usedtx)=/.test(x.trim()));
    return `a=fmtp:${pt} ${garde.concat(['stereo=1', 'sprop-stereo=1', 'maxaveragebitrate=128000', 'usedtx=0']).join(';')}`;
  });
}
/* Démarrage plus rapide en bonne qualité : sans ça, le navigateur commence vers 300 kb/s et met 20 s à monter */
function sdpDebitDepart(sdp, kbps) {
  return sdp.replace(/a=fmtp:(\d+) ([^\r\n]*profile-level-id[^\r\n]*)/gi,
    (l, pt, p) => /x-google-start-bitrate/.test(p) ? l : `a=fmtp:${pt} ${p};x-google-start-bitrate=${kbps};x-google-min-bitrate=${Math.round(kbps / 3)}`);
}
function attendreCandidats(pc, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(ok => {
    const fini = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', verif); ok(); };
    const verif = () => { if (pc.iceGatheringState === 'complete') fini(); };
    const t = setTimeout(fini, ms);
    pc.addEventListener('icegatheringstatechange', verif);
  });
}

/* Publie video (+ audio) vers une adresse WHIP. Renvoie { pc, arreter }. */
async function publierWhip({ url, jeton, video, audio, debit = 6000000, fps = 30, garderTaille = false }) {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const tv = pc.addTransceiver(video, { direction: 'sendonly', sendEncodings: [{ maxBitrate: debit, maxFramerate: fps }] });
  if (audio) pc.addTransceiver(audio, { direction: 'sendonly', sendEncodings: [{ maxBitrate: 160000 }] });
  try {
    const codecs = RTCRtpSender.getCapabilities('video').codecs;
    const h264 = codecs.filter(c => /video\/h264/i.test(c.mimeType) && /packetization-mode=1/.test(c.sdpFmtpLine || ''));
    // le profil le plus répandu d'abord (42e01f), puis les autres
    h264.sort((a, b) => (/42e01f/i.test(b.sdpFmtpLine) ? 1 : 0) - (/42e01f/i.test(a.sdpFmtpLine) ? 1 : 0));
    if (!h264.length) throw new Error('H.264 indisponible');
    tv.setCodecPreferences(h264.concat(codecs.filter(c => /video\/rtx/i.test(c.mimeType))));
  } catch (e) { if (/H.264/.test(e.message)) { pc.close(); throw new Error('Ce navigateur ne sait pas encoder en H.264'); } }
  try {
    const p = tv.sender.getParameters();
    // Twitch (WebRTC) : si la connexion faiblit, image un peu moins nette mais jamais saccadée.
    // Relais vers le RTMP : la taille ne doit jamais changer en cours de route (YouTube n'aime pas), on baisse plutôt la cadence.
    p.degradationPreference = garderTaille ? 'maintain-resolution' : 'maintain-framerate';
    await tv.sender.setParameters(p);
  } catch (e) { /* réglage facultatif */ }

  const offre = await pc.createOffer();
  offre.sdp = sdpSonStereo(offre.sdp);
  await pc.setLocalDescription(offre);
  await attendreCandidats(pc);

  let rep;
  try {
    rep = await fetch(url, {
      method: 'POST', body: pc.localDescription.sdp,
      headers: Object.assign({ 'Content-Type': 'application/sdp' }, jeton ? { Authorization: 'Bearer ' + jeton } : {})
    });
  } catch (e) { pc.close(); throw new Error('Plateforme injoignable (réseau ou blocage du navigateur)'); }
  if (rep.status !== 201 && rep.status !== 200) {
    pc.close();
    throw new Error(rep.status === 401 || rep.status === 403 ? 'Clé refusée par la plateforme' : `La plateforme a refusé l'envoi (${rep.status})`);
  }
  const loc = rep.headers.get('Location');
  const ressource = loc ? new URL(loc, url).href : null;
  const reponse = sdpDebitDepart(sdpSonStereo(await rep.text()), Math.round(Math.min(debit, 4000000) / 1000));
  await pc.setRemoteDescription({ type: 'answer', sdp: reponse });

  return {
    pc,
    async arreter() {
      try { if (ressource) await fetch(ressource, { method: 'DELETE', headers: jeton ? { Authorization: 'Bearer ' + jeton } : {} }); } catch (e) { /* tant pis */ }
      try { pc.close(); } catch (e) { /* déjà fermé */ }
    }
  };
}

/* Mesures d'envoi, toutes les 2 s : débit réel, taille, images par seconde, et ce qui freine (processeur ou connexion) */
async function mesurerEnvoi(pc, avant) {
  const r = await pc.getStats();
  let v = null;
  r.forEach(s => { if (s.type === 'outbound-rtp' && s.kind === 'video') v = s; });
  if (!v) return { avant };
  const kbps = avant && avant.t ? Math.round((v.bytesSent - avant.octets) * 8 / (v.timestamp - avant.t)) : 0;
  return {
    kbps, fps: Math.round(v.framesPerSecond || 0), w: v.frameWidth || 0, h: v.frameHeight || 0,
    limite: v.qualityLimitationReason && v.qualityLimitationReason !== 'none' ? v.qualityLimitationReason : '',
    encodeur: v.encoderImplementation || '',
    avant: { t: v.timestamp, octets: v.bytesSent }
  };
}
