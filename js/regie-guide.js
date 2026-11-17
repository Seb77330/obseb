/* OBSeb : guide « Pour bien démarrer » en haut de la régie.
   Quatre étapes qui se cochent toutes seules ; un clic sur une étape la fait. Disparaît quand tout est fait. */
'use strict';
(() => {
  const CLE_GUIDE = 'studioSeb:guide:' + session.room;
  let g = {};
  try { g = JSON.parse(localStorage.getItem(CLE_GUIDE) || '{}'); } catch (e) { /* rien */ }
  const sauver = () => { try { localStorage.setItem(CLE_GUIDE, JSON.stringify(g)); } catch (e) { /* rien */ } };
  const boite = $('#demarrage');

  const fait = {
    camera: () => !$('#cam-direct').hidden,
    invite: () => !!g.invite,
    obs: () => !!g.obs,
    live: () => !!etat.direct,
  };
  const agir = {
    camera: () => { $('.carte-moi').scrollIntoView({ block: 'center', behavior: 'smooth' }); },
    invite: () => $('#btn-invite').click(),
    obs: () => $('#btn-obs').click(),
    live: () => $('#btn-direct').click(),
  };
  $('#btn-invite').addEventListener('click', () => { g.invite = true; sauver(); maj(); });
  ['#btn-obs', '#btn-vertical', '#btn-sortie'].forEach(s => $(s).addEventListener('click', () => { g.obs = true; sauver(); maj(); }));
  $$('#demarrage [data-etape]').forEach(b => b.onclick = () => { agir[b.dataset.etape](); setTimeout(maj, 300); });
  $('#demarrage-fermer').onclick = () => { g.masque = true; sauver(); maj(); };

  function maj() {
    let tout = true;
    $$('#demarrage [data-etape]').forEach(b => { const ok = fait[b.dataset.etape](); b.classList.toggle('fait', ok); tout = tout && ok; });
    boite.hidden = !!g.masque || tout;
  }
  maj();
  setInterval(maj, 1500);
})();
