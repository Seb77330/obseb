/* MESA : une seule régie ouverte par live.
   Deux onglets de la même régie se disputent la caméra (elle s'allume et s'éteint en boucle).
   Le premier onglet garde la main ; le nouveau lâche tout et propose « Utiliser plutôt cet onglet ». */
'use strict';
(() => {
  if (!('BroadcastChannel' in window) || !navigator.mediaDevices) return;
  const flux = [];
  const md = navigator.mediaDevices, gum = md.getUserMedia && md.getUserMedia.bind(md), gdm = md.getDisplayMedia && md.getDisplayMedia.bind(md);
  if (gum) md.getUserMedia = async c => { if (lache) throw new DOMException('Régie ouverte dans un autre onglet', 'AbortError'); const s = await gum(c); flux.push(s); if (lache) s.getTracks().forEach(t => t.stop()); return s; };
  if (gdm) md.getDisplayMedia = async c => { if (lache) throw new DOMException('Régie ouverte dans un autre onglet', 'AbortError'); const s = await gdm(c); flux.push(s); return s; };
  let lache = false;

  function lacher(texte, bouton, action) {
    if (lache) return; lache = true;
    flux.forEach(s => s.getTracks().forEach(t => t.stop()));
    document.querySelectorAll('video, audio').forEach(v => { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); });
    document.querySelectorAll('iframe').forEach(f => { f.src = 'about:blank'; });
    Array.from(document.body.children).forEach(el => { el.style.display = 'none'; });
    const d = document.createElement('div');
    d.className = 'onglet-double';
    d.innerHTML = `<div><h1>Ta régie est déjà ouverte</h1><p></p><button type="button" class="primaire"></button></div>`;
    d.querySelector('p').textContent = texte;
    d.querySelector('button').textContent = bouton;
    d.querySelector('button').onclick = action;
    document.body.appendChild(d);
    document.title = 'Régie ouverte ailleurs';
  }

  const demarrer = () => {
    const salle = typeof session === 'object' && session && session.room;
    if (!salle) return;
    const canal = new BroadcastChannel('mesa-regie:' + salle);
    const moi = Math.random().toString(36).slice(2);
    canal.onmessage = e => {
      const m = e.data || {};
      if (m.de === moi || lache) return;
      if (m.t === 'qui') canal.postMessage({ t: 'moi', de: moi });
      else if (m.t === 'moi') lacher('Elle tourne dans un autre onglet de ce navigateur. Deux régies ouvertes en même temps se disputent ta caméra : on garde celle de l\'autre onglet.',
        'Utiliser plutôt cet onglet', () => { canal.postMessage({ t: 'prends', de: moi }); setTimeout(() => location.reload(), 600); });
      else if (m.t === 'prends') lacher('Tu l\'as reprise dans un autre onglet : celui-ci a lâché ta caméra.',
        'Reprendre ici', () => { canal.postMessage({ t: 'prends', de: moi }); setTimeout(() => location.reload(), 600); });
    };
    canal.postMessage({ t: 'qui', de: moi });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
