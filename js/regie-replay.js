/* MESA : « Revoir l'action » dans la régie.
   Deux petits boutons à côté de « Bandeau » : Revoir (les 15 dernières secondes) et Ralenti (les 8 dernières, à mi-vitesse).
   Ils n'apparaissent que quand le live part de la fenêtre de diffusion (direct sans OBS, ou enregistrement) :
   c'est elle qui garde les dernières secondes et les rejoue à l'image. Avec OBS, le « Replay Buffer » d'OBS fait la même chose. */
'use strict';
(() => {
  const bandeau = document.getElementById('btn-bandeau'); if (!bandeau) return;
  const boite = document.createElement('span');
  boite.className = 'replay-boutons'; boite.hidden = true;
  boite.innerHTML = `<button type="button" class="btn-bandeau" data-r="normal" title="Rejouer à l'image les 15 dernières secondes du live (touche R)"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor"/></svg><span>Revoir</span></button><button type="button" class="btn-bandeau" data-r="ralenti" title="Rejouer les 8 dernières secondes au ralenti (Maj + R)"><span>Ralenti</span></button>`;
  bandeau.after(boite);
  const formatsPrets = () => ['horizontal', 'vertical'].filter(f => typeof fenetrePrete === 'function' && fenetrePrete(f));
  function infos() {
    let secondes = 0, enCours = '';
    for (const f of formatsPrets()) {
      const r = fenetres[f].etat && fenetres[f].etat.replay; if (!r) continue;
      secondes = Math.max(secondes, r.secondes || 0); if (r.enCours) enCours = r.enCours;
    }
    return { secondes, enCours, formats: formatsPrets().filter(f => fenetres[f].etat && fenetres[f].etat.replay) };
  }
  function maj() {
    const i = infos();
    // visible dès que la fenêtre garde des images (direct ou enregistrement en cours)
    boite.hidden = !i.formats.length || (i.secondes < 3 && !i.enCours);
    boite.querySelectorAll('button').forEach(b => {
      const actif = i.enCours === b.dataset.r;
      b.classList.toggle('actif', actif);
      b.querySelector('span').textContent = actif ? 'Arrêter' : (b.dataset.r === 'ralenti' ? 'Ralenti' : 'Revoir');
    });
  }
  function lancer(mode) {
    const i = infos(); if (!i.formats.length) return;
    const stop = i.enCours === mode;
    for (const f of i.formats) canalDiff(f).postMessage(stop ? { type: 'replay', action: 'stop' } : { type: 'replay', ralenti: mode === 'ralenti' });
    if (!stop) toast(mode === 'ralenti' ? 'Ralenti à l\'image' : 'Replay à l\'image');
    setTimeout(maj, 300);
  }
  boite.addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (b) lancer(b.dataset.r); });
  addEventListener('keydown', e => {
    if (e.key !== 'r' && e.key !== 'R') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (boite.hidden) return;
    e.preventDefault(); lancer(e.shiftKey ? 'ralenti' : 'normal');
  });
  setInterval(maj, 1000);
})();
