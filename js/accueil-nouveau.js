/* MESA : accueil, créer un live en un clic, et la page « Visuel du live » ouverte depuis la régie.
   Nouveau live : le live est créé tout de suite et on part dans la régie (titre, date et visuel s'y règlent).
   Le visuel se règle par étapes dans un panneau de la régie, qui ouvre cette page
   (index.html?visuel=<salle>&embed=1&panneau=1, voir js/visuel-etapes.js). « Appliquer » renvoie le live modifié à la régie. */
'use strict';
(() => {
  const Qs = new URLSearchParams(location.search);

  /* ----- Accueil : deux onglets ----- */
  const ongletsAccueil = $$('[data-onglet-accueil]');
  function ouvrirOngletAccueil(v) {
    ongletsAccueil.forEach(b => { b.classList.toggle('actif', b.dataset.ongletAccueil === v); b.setAttribute('aria-selected', b.dataset.ongletAccueil === v); });
    $$('[data-vue-accueil]').forEach(x => { x.hidden = x.dataset.vueAccueil !== v; });
    try { localStorage.setItem('studioSeb:ongletAccueil', v); } catch (e) { /* rien */ }
  }
  ongletsAccueil.forEach(b => b.onclick = () => ouvrirOngletAccueil(b.dataset.ongletAccueil));
  try { if (localStorage.getItem('studioSeb:ongletAccueil') === 'recs') ouvrirOngletAccueil('recs'); } catch (e) { /* rien */ }

  /* ----- Nouveau live : on le crée tout de suite et on part dans la régie -----
     Le titre, la date, le thème, les couleurs : tout se règle ensuite dans la régie, bouton « Visuel », par étapes. */
  let enCours = false;
  async function creerEtOuvrir(modele) {
    if (enCours) return;
    enCours = true;
    const s = nouvelleSession('Mon live', 'minimal');
    if (modele) Object.assign(s, { theme: JSON.parse(JSON.stringify(modele.theme)), hote: modele.hote, handle: modele.handle, limite: modele.limite || 0 });
    else if (typeof appliquerStyleDefaut === 'function') appliquerStyleDefaut(s);   // ton style par défaut, s'il y en a un
    s.choixVisuel = true;                       // la régie ouvre le visuel, par étapes, à sa première ouverture
    const cle = rnd(20);
    s.room = await salleDepuisCle(cle);
    const l = lire(); l.unshift({ session: s, cle }); ecrire(l);
    location.href = liens(s, cle).regie;
  }
  const ouvrirNouveau = () => creerEtOuvrir();
  window.creerEtOuvrir = creerEtOuvrir;
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
