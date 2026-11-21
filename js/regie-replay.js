/* MESA : « Revoir l'action » dans la régie.
   Deux petits boutons à côté de « Bandeau » : Revoir (rejoue les 15 dernières secondes à l'image)
   et Marquer (garde ce moment : à la fin du live, chaque moment marqué devient un petit clip dans « Mes enregistrements »).
   Ils n'apparaissent que quand le live part de la fenêtre de diffusion (direct sans OBS, ou enregistrement) :
   c'est elle qui garde les dernières secondes et les rejoue à l'image. Avec OBS, le « Replay Buffer » d'OBS fait la même chose. */
'use strict';
(() => {
  if (session.ent) return;   // pas de replay ni de clips dans un événement MESA Entreprises
  const bandeau = document.getElementById('btn-bandeau'); if (!bandeau) return;
  const boite = document.createElement('span');
  boite.className = 'replay-boutons'; boite.hidden = true;
  boite.innerHTML = `<button type="button" class="btn-bandeau" data-r="normal" title="Rejouer à l'image les 15 dernières secondes du live (touche R)"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor"/></svg><span>Revoir</span></button><button type="button" class="btn-bandeau" data-r="marquer" title="Garder ce moment : à la fin du live, il devient un clip d'environ 35 s (touche M)"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg><span>Marquer</span></button>`;
  bandeau.after(boite);
  const formatsPrets = () => ['horizontal', 'vertical'].filter(f => typeof fenetrePrete === 'function' && fenetrePrete(f));
  function infos() {
    let secondes = 0, enCours = '', marques = 0;
    for (const f of formatsPrets()) {
      const r = fenetres[f].etat && fenetres[f].etat.replay; if (!r) continue;
      secondes = Math.max(secondes, r.secondes || 0); if (r.enCours) enCours = r.enCours;
      marques = Math.max(marques, (fenetres[f].etat.clips && fenetres[f].etat.clips.marques) || 0);
    }
    return { secondes, enCours, marques, formats: formatsPrets().filter(f => fenetres[f].etat && fenetres[f].etat.replay) };
  }
  function maj() {
    const i = infos();
    // visible dès que la fenêtre garde des images (direct ou enregistrement en cours)
    boite.hidden = !i.formats.length || (i.secondes < 3 && !i.enCours);
    const rv = boite.querySelector('[data-r="normal"]'), mq = boite.querySelector('[data-r="marquer"]');
    rv.classList.toggle('actif', !!i.enCours);
    rv.querySelector('span').textContent = i.enCours ? 'Arrêter' : 'Revoir';
    mq.querySelector('span').textContent = i.marques ? `Marquer (${i.marques})` : 'Marquer';
  }
  function lancer(mode) {
    const i = infos(); if (!i.formats.length) return;
    if (mode === 'marquer') {
      for (const f of i.formats) canalDiff(f).postMessage({ type: 'marquer' });
      toast('Moment marqué : il deviendra un clip à la fin du live');
      return setTimeout(maj, 300);
    }
    const stop = i.enCours === mode;
    for (const f of i.formats) canalDiff(f).postMessage(stop ? { type: 'replay', action: 'stop' } : { type: 'replay' });
    if (!stop) toast('Replay à l\'image');
    setTimeout(maj, 300);
  }
  /* « Moments forts » (js/regie-parole.js) : un clip marqué tout seul, sans message */
  window.marquerMoment = () => { const i = infos(); if (!i.formats.length) return false; for (const f of i.formats) canalDiff(f).postMessage({ type: 'marquer' }); setTimeout(maj, 300); return true; };
  boite.addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (b) lancer(b.dataset.r); });
  addEventListener('keydown', e => {
    const t = e.key.toLowerCase(); if (t !== 'r' && t !== 'm') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (boite.hidden) return;
    e.preventDefault(); lancer(t === 'm' ? 'marquer' : 'normal');
  });
  setInterval(maj, 1000);
})();
