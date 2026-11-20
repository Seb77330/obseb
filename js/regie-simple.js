/* MESA : régie « Simple » ou « Complète ».
   Rien n'est enlevé : en Simple, ce qui sert rarement pendant un live se replie (ta caméra en petit, qui est déjà
   en grand dans l'aperçu ; les autres caméras tant qu'il n'y en a pas ; les invités de test ; les réglages fins).
   Un clic sur « Complète » remet tout. Le choix est gardé dans ce navigateur. */
'use strict';
(() => {
  const CLE = 'studioSeb:regieMode';
  let mode = 'simple';
  try { mode = localStorage.getItem(CLE) || 'simple'; } catch (e) { /* rien */ }
  const seg = document.createElement('div');
  seg.className = 'segment regie-mode'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Affichage de la régie');
  seg.innerHTML = '<button type="button" data-m="simple" title="L\'essentiel pour faire ton live. Le reste se replie, rien n\'est enlevé.">Simple</button><button type="button" data-m="complet" title="Tous les réglages affichés">Complète</button>';
  const appliquer = () => {
    document.body.classList.toggle('regie-simple', mode === 'simple');
    seg.querySelectorAll('button').forEach(b => { const on = b.dataset.m === mode; b.classList.toggle('actif', on); b.setAttribute('aria-pressed', String(on)); });
  };
  seg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.m; try { localStorage.setItem(CLE, mode); } catch (err) { /* rien */ }
    appliquer(); majPlis();
    if (typeof toast === 'function') toast(mode === 'simple' ? 'Régie simple : l\'essentiel, le reste est replié' : 'Régie complète : tout est affiché');
  };
  /* Les plis : fermés en Simple, ouverts en Complète (un clic les ouvre toujours) */
  const plis = () => document.querySelectorAll('#col-droite details.pli-simple');
  const majPlis = () => plis().forEach(d => { d.open = mode !== 'simple'; });
  /* Partage : la petite phrase sous chaque carte passe en info-bulle */
  const bulles = () => document.querySelectorAll('.src-choix-grille button').forEach(b => { const sm = b.querySelector('small'); if (sm && !b.title) b.title = sm.textContent; });
  /* Chat : 3 styles en Simple (et celui choisi), « Voir les 15 styles » pour le reste */
  const cs = document.getElementById('chat-styles');
  if (cs) {
    const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'petit voir-styles';
    const n = cs.querySelectorAll('button').length;
    const maj = () => { plus.textContent = cs.classList.contains('tout') ? 'Moins de styles' : `Voir les ${n} styles`; };
    plus.onclick = () => { cs.classList.toggle('tout'); maj(); };
    cs.after(plus); maj();
  }
  const visuel = document.getElementById('btn-visuel');
  if (visuel) visuel.before(seg);
  appliquer(); majPlis(); bulles();
  new MutationObserver(bulles).observe(document.getElementById('sources') || document.body, { childList: true, subtree: true });
})();
