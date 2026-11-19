/* MESA, accueil : le bouton du compte dans la barre, et « Nouveau live » réservé aux comptes connectés.
   Sans configuration des comptes (bêta), rien ne change et ce fichier ne fait rien. */
'use strict';
(function () {
  if (typeof Comptes === 'undefined' || !Comptes.actif) return;
  const place = document.getElementById('place-compte');
  let maSession, sessionConnue = false;

  // « Nouveau live » (et tout ce qui le déclenche) : sans compte, on passe d'abord par la connexion
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#btn-nouveau, #vide-creer, button[data-formule="gratuit"]');
    if (!b || (sessionConnue && maSession)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    location.href = 'connexion.html?suite=nouveau';
  }, true);

  function initiale(s) {
    const m = s.user.user_metadata || {};
    return ((m.full_name || m.name || s.user.email || '?').trim()[0] || '?').toUpperCase();
  }
  function dessiner(s, p) {
    if (!place) return;
    if (!s) { place.innerHTML = '<a class="lien-barre" href="connexion.html">Se connecter</a>'; return; }
    const m = s.user.user_metadata || {};
    const photo = m.avatar_url || m.picture || '';
    place.innerHTML = `<div class="compte-menu">
      <button type="button" class="compte-bouton" aria-haspopup="true" aria-expanded="false" title="Mon compte">
        ${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(initiale(s))}</span>`}
      </button>
      <div class="compte-volet" hidden>
        <p class="compte-qui"><b>${esc(m.full_name || m.name || 'Mon compte')}</b><small>${esc(s.user.email || '')}</small></p>
        <p class="compte-formule">Formule : <b>${esc(Comptes.NOMS[p && p.formule] || 'Bêta')}</b></p>
        <button type="button" data-action="formules">Voir les formules</button>
        <button type="button" data-action="deconnexion">Se déconnecter</button>
        <button type="button" data-action="supprimer" class="danger">Supprimer mon compte</button>
        <a href="confidentialite.html">Confidentialité</a>
      </div></div>`;
    const bouton = place.querySelector('.compte-bouton'), volet = place.querySelector('.compte-volet');
    const ouvrir = oui => { volet.hidden = !oui; bouton.setAttribute('aria-expanded', oui); };
    bouton.onclick = e => { e.stopPropagation(); ouvrir(volet.hidden); };
    document.addEventListener('click', e => { if (!e.target.isConnected) return; if (!place.contains(e.target)) ouvrir(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrir(false); });
    volet.onclick = async e => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      if (a.dataset.action === 'formules') { ouvrir(false); const f = document.getElementById('btn-formules'); if (f) f.click(); }
      if (a.dataset.action === 'deconnexion') { await Comptes.deconnexion(); location.href = 'index.html'; }
      if (a.dataset.action === 'supprimer') {
        if (!confirm('Supprimer ton compte ? Ton adresse et ta formule seront effacées tout de suite. Les lives rangés dans ce navigateur restent sur cet ordinateur.')) return;
        try { await Comptes.supprimer(); alert('Ton compte est supprimé.'); location.href = 'index.html'; }
        catch (err) { alert('La suppression n\'a pas marché. Réessaie dans un instant.'); }
      }
    };
  }

  async function demarrer() {
    maSession = await Comptes.session(); sessionConnue = true;
    const p = maSession ? await Comptes.profil() : null;
    dessiner(maSession, p);
    // retour de Google (ou de la page de connexion) : on nettoie l'adresse, puis on reprend ce que la personne voulait faire
    const q = new URLSearchParams(location.search);
    if (q.has('code') || q.has('apres') || q.has('error')) {
      const suite = q.get('apres');
      history.replaceState(null, '', location.pathname + location.hash);
      if (maSession && suite === 'nouveau') { const b = document.getElementById('btn-nouveau'); if (b) b.click(); }
      if (q.has('error')) alert('La connexion n\'a pas abouti. Réessaie, ou reçois un code par e-mail.');
    }
  }
  Comptes.surChangement(s => { maSession = s; sessionConnue = true; });
  demarrer();
})();
