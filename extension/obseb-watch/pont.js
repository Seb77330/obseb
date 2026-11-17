/* Tourne sur les pages du studio (régie et page invité). Fait le pont entre la page et l'extension :
   - la page dit qui elle est (animateur ou invité) et, chez un invité, où le film doit en être ;
   - l'extension renvoie le minuteur du film suivi. */
'use strict';
(() => {
  let port = null;
  function brancher() {
    try {
      port = chrome.runtime.connect({ name: 'pont' });
    } catch (e) { port = null; return; }          // extension rechargée : la page doit être rechargée aussi
    port.onMessage.addListener(m => {
      if (m && m.type === 'film') window.postMessage({ source: 'obseb-watch-ext', film: m.film }, location.origin);
    });
    port.onDisconnect.addListener(() => { port = null; setTimeout(brancher, 1000); });
  }
  brancher();
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.source !== 'obseb-watch-page' || !port) return;
    const d = e.data, cible = d.cible && typeof d.cible.pos === 'number' && isFinite(d.cible.pos)
      ? { pos: Math.max(0, d.cible.pos), lecture: !!d.cible.lecture } : null;
    try { port.postMessage({ type: 'page', role: d.role === 'hote' ? 'hote' : 'invite', cible }); } catch (err) { /* port fermé */ }
  });
})();
