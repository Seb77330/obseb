/* Injecté dans l'onglet du film, seulement quand tu cliques sur « Suivre le film de cet onglet ».
   Lit la position du lecteur vidéo deux fois par seconde (jamais l'image ni le son) et l'envoie à l'extension.
   Chez un invité, cale aussi le lecteur sur le film de l'animateur. */
'use strict';
(() => {
  if (window.__watchPartyLecteur) return;          // déjà en place dans ce cadre
  window.__watchPartyLecteur = true;

  const SITES = [[/netflix\./, 'Netflix'], [/primevideo\.|amazon\./, 'Prime Video'], [/disneyplus\./, 'Disney+'], [/youtube\.|youtu\.be/, 'YouTube'],
    [/canalplus\.|mycanal\./, 'Canal+'], [/max\.com|hbomax\./, 'Max'], [/apple\.com/, 'Apple TV+'], [/paramountplus\./, 'Paramount+'],
    [/crunchyroll\./, 'Crunchyroll'], [/twitch\.tv/, 'Twitch'], [/arte\.tv/, 'Arte'], [/france\.tv/, 'france.tv'], [/molotov\.tv/, 'Molotov']];
  const hote = location.hostname;
  const site = (SITES.find(([r]) => r.test(hote)) || [null, hote.replace(/^www\./, '') || 'ce fichier'])[1];
  const estNetflix = /netflix\./.test(hote);

  /* Le film, c'est la plus grande vidéo de la page qui dure plus d'une minute (pas une pub ni une vignette) */
  function film() {
    let meilleur = null, aire = 0;
    for (const v of document.querySelectorAll('video')) {
      if (!(v.duration > 60) && v.duration !== Infinity) continue;
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a > aire) { aire = a; meilleur = v; }
    }
    return meilleur;
  }
  function titre() {
    const el = document.querySelector('[data-uia="video-title"], .atvwebplayersdk-title-text, h1.title-field, #title h1, h1');
    let t = (el && el.textContent.trim()) || document.title || '';
    t = t.replace(/\s*[|\-–·]\s*(Netflix|YouTube|Prime Video|Disney\+|Max|CANAL\+|Apple TV\+?)\s*$/i, '').replace(/^Regarder\s+/i, '').replace(/^\(\d+\)\s*/, '').trim();
    return /^(netflix|youtube|prime video)$/i.test(t) ? '' : t.slice(0, 60);
  }

  let port = null, arrete = false;
  function brancher() {
    try { port = chrome.runtime.connect({ name: 'lecteur' }); } catch (e) { port = null; arrete = true; return; }
    port.onMessage.addListener(m => {
      if (m.type === 'arret') { arrete = true; window.__watchPartyLecteur = false; try { port.disconnect(); } catch (e) { /* rien */ } }
      if (m.type === 'cible') caler(m.cible);
    });
    port.onDisconnect.addListener(() => { port = null; if (!arrete) setTimeout(brancher, 1000); });
  }
  brancher();

  setInterval(() => {
    if (arrete || !port) return;
    const v = film();
    if (!v) return;                                 // pas de film dans ce cadre : on se tait (un autre cadre répondra peut-être)
    try {
      port.postMessage({ type: 'film', film: { pos: v.currentTime, lecture: !v.paused && !v.ended, duree: isFinite(v.duration) ? v.duration : 0, titre: titre(), site } });
    } catch (e) { /* port fermé */ }
  }, 500);

  /* Chez un invité : on suit le film de l'animateur (lecture, pause, et un saut si l'écart dépasse 1,5 s) */
  let dernierSaut = 0;
  function caler(c) {
    const v = film();
    if (!v || !c) return;
    if (c.lecture && v.paused) v.play().catch(() => {});
    if (!c.lecture && !v.paused) v.pause();
    const ecart = Math.abs(v.currentTime - c.pos);
    if (ecart > (c.lecture ? 1.5 : 0.5) && Date.now() - dernierSaut > 3000) {
      dernierSaut = Date.now();
      // Netflix plante si on déplace la vidéo directement : le saut passe par son propre lecteur (fait par l'extension)
      if (estNetflix) { try { port.postMessage({ type: 'saut-netflix', pos: c.pos }); } catch (e) { /* rien */ } }
      else { try { v.currentTime = c.pos; } catch (e) { /* lecteur verrouillé */ } }
    }
  }
})();
