/* Régie : ce qui s'affiche à l'écran (nom des personnes, titre, logo, « En direct », message)
   et les caméras dans un cadre ou en plein écran. La sortie lit etat.masquer et etat.camPlein. */
(function () {
  const $ = s => document.querySelector(s);
  etat.masquer = etat.masquer || {};
  const boutons = [...document.querySelectorAll('#ecran-elements [data-el]')];
  function maj() {
    for (const b of boutons) {
      const visible = !etat.masquer[b.dataset.el];
      b.setAttribute('aria-pressed', visible ? 'true' : 'false');
      b.classList.toggle('masque', !visible);
    }
    for (const b of document.querySelectorAll('#cam-mode [data-plein]')) b.classList.toggle('actif', (b.dataset.plein === '1') === !!etat.camPlein);
    const c = $('#cam-plein'); if (c) c.checked = !!etat.camPlein;
    const bb = $('#btn-bandeau');
    if (bb) { bb.classList.toggle('masque', !!etat.masquer.bandeau); bb.setAttribute('aria-pressed', etat.masquer.bandeau ? 'false' : 'true'); }
  }
  for (const b of boutons) b.onclick = () => {
    const k = b.dataset.el;
    if (etat.masquer[k]) delete etat.masquer[k]; else etat.masquer[k] = true;
    maj(); envoyer();
  };
  // le bouton « Bandeau » au-dessus de l'aperçu : enlève ou remet tout le bandeau du bas en un clic
  const bb = $('#btn-bandeau');
  if (bb) bb.onclick = () => { if (etat.masquer.bandeau) delete etat.masquer.bandeau; else etat.masquer.bandeau = true; maj(); envoyer(); toast(etat.masquer.bandeau ? 'Bandeau enlevé' : 'Bandeau remis'); };
  function plein(v) { etat.camPlein = !!v; maj(); envoyer(); }
  for (const b of document.querySelectorAll('#cam-mode [data-plein]')) b.onclick = () => plein(b.dataset.plein === '1');
  const c = $('#cam-plein'); if (c) c.onchange = e => plein(e.target.checked);
  maj();
})();
