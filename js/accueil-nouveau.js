/* OBSeb : accueil, créer un live en une étape, et la page « Visuel du live » ouverte depuis la régie.
   Nouveau live : une petite fenêtre (le titre, tout de suite ou programmé), puis on part dans la régie.
   Le visuel (thème, couleurs, police, logo) se choisit dans la régie, avant le direct : la régie ouvre
   cette page en surimpression (index.html?visuel=<salle>&embed=1). « Appliquer » renvoie le live modifié à la régie. */
'use strict';
(() => {
  const Qs = new URLSearchParams(location.search);
  const dlg = $('#nouveau-live');

  /* ----- Accueil : deux onglets ----- */
  const ongletsAccueil = $$('[data-onglet-accueil]');
  function ouvrirOngletAccueil(v) {
    ongletsAccueil.forEach(b => { b.classList.toggle('actif', b.dataset.ongletAccueil === v); b.setAttribute('aria-selected', b.dataset.ongletAccueil === v); });
    $$('[data-vue-accueil]').forEach(x => { x.hidden = x.dataset.vueAccueil !== v; });
    try { localStorage.setItem('studioSeb:ongletAccueil', v); } catch (e) { /* rien */ }
  }
  ongletsAccueil.forEach(b => b.onclick = () => ouvrirOngletAccueil(b.dataset.ongletAccueil));
  try { if (localStorage.getItem('studioSeb:ongletAccueil') === 'recs') ouvrirOngletAccueil('recs'); } catch (e) { /* rien */ }

  /* ----- Nouveau live : la petite fenêtre ----- */
  let quand = 'maintenant';
  function ouvrirNouveau() {
    $('#nl-nom').value = '';
    quand = 'maintenant';
    $$('#nl-quand button').forEach(b => b.classList.toggle('actif', b.dataset.q === quand));
    $('#nl-date-bloc').hidden = true;
    dlg.showModal();
    setTimeout(() => $('#nl-nom').focus(), 30);
  }
  $$('#nl-quand button').forEach(b => b.onclick = () => {
    quand = b.dataset.q;
    $$('#nl-quand button').forEach(x => x.classList.toggle('actif', x === b));
    $('#nl-date-bloc').hidden = quand !== 'plus-tard';
    if (quand === 'plus-tard' && !$('#nl-date').value) {
      const d = new Date(Date.now() + 864e5); d.setHours(20, 0, 0, 0);
      const z = n => String(n).padStart(2, '0');
      $('#nl-date').value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; $('#nl-heure').value = '20:00';
    }
  });
  $('#nl-annuler').onclick = () => dlg.close();
  $('#nl-form').onsubmit = async e => {
    e.preventDefault();
    const titre = $('#nl-nom').value.trim();
    if (!titre) { $('#nl-nom').focus(); return; }
    let debut = 0;
    if (quand === 'plus-tard') {
      debut = new Date(`${$('#nl-date').value}T${$('#nl-heure').value || '20:00'}`).getTime();
      if (!(debut > Date.now())) return toast('Choisis un jour et une heure à venir');
    }
    $('#nl-ok').disabled = true;
    const s = nouvelleSession(titre, 'minimal');
    if (typeof appliquerStyleDefaut === 'function') appliquerStyleDefaut(s);   // ton style par défaut, s'il y en a un
    if (debut) s.debut = debut;
    s.choixVisuel = true;                       // la régie ouvre le choix du visuel à sa première ouverture
    const cle = rnd(20);
    s.room = await salleDepuisCle(cle);
    const l = lire(); l.unshift({ session: s, cle }); ecrire(l);
    location.href = liens(s, cle).regie;
  };
  // tous les boutons qui créaient un live ouvrent maintenant la petite fenêtre
  $('#btn-nouveau').onclick = ouvrirNouveau;
  $('#vide-creer').onclick = ouvrirNouveau;
  $$('#formules [data-formule="gratuit"]').forEach(b => b.onclick = ouvrirNouveau);
  if (location.hash === '#nouveau' && !Qs.get('visuel')) { history.replaceState(null, '', location.pathname); montrerVue('liste', false); ouvrirNouveau(); }

  /* ----- « Visuel du live », dans la régie ----- */
  const salle = Qs.get('visuel');
  if (!salle) return;
  const embed = Qs.get('embed') === '1' && window.parent !== window;
  const e = lire().find(x => x.session.room === salle);
  const parler = m => { if (embed) window.parent.postMessage(m, location.origin); };
  if (!e) { parler({ obsebVisuel: 'introuvable' }); return; }
  document.body.classList.add('page-visuel');
  if (embed) document.body.classList.add('embed');
  enEdition = salle;
  brouillon = JSON.parse(JSON.stringify(e.session));
  ouvrirCreation('Visuel du live', 'Appliquer au live', false);
  history.replaceState(null, '', location.pathname + location.search + '#nouveau');
  const retour = () => { if (embed) parler({ obsebVisuel: 'fermer' }); else location.href = liens(e.session, e.cle).regie; };
  $('#btn-retour').textContent = '← Retour à la régie';
  $('#btn-retour').onclick = retour;
  $('#btn-annuler').onclick = retour;
  // « Appliquer » : on enregistre (comme avant), puis on rend la main à la régie avec le live à jour
  $('#btn-creer').onclick = () => {
    if (!brouillon.titre.trim()) { $('#f-titre').focus(); return toast('Donne un titre à ton live'); }
    delete brouillon.choixVisuel;
    const l = lire(), i = l.findIndex(x => x.session.room === salle);
    if (i >= 0) { l[i].session = brouillon; ecrire(l); }
    if (embed) parler({ obsebVisuel: 'applique', s: b64e(brouillon) });
    else location.href = liens(brouillon, e.cle).regie;
  };
})();
