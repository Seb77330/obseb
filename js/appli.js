/* MESA : l'appli. Le site s'installe comme une application (ordinateur et téléphone), au choix :
   on peut aussi rester sur le site. C'est le même studio, mis à jour en même temps.
   - Chrome, Edge, Android : le navigateur propose l'installation ; le bouton « Installer l'appli » la lance.
   - iPhone et iPad (Safari) : le bouton explique « Partager », puis « Sur l'écran d'accueil ».
   - Déjà dans l'appli, ou navigateur qui ne sait pas installer : pas de bouton. */
'use strict';
(function () {
  const enAppli = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
  if (enAppli) { document.documentElement.classList.add('en-appli'); return; }
  const btn = document.getElementById('btn-appli');
  if (!btn) return;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const t = s => (window.typoFr ? typoFr(s) : s);
  let invite = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); invite = e; btn.hidden = false; });
  addEventListener('appinstalled', () => { btn.hidden = true; invite = null; });
  if (ios) btn.hidden = false;

  const dlg = document.createElement('dialog');
  dlg.className = 'appli-dlg';
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-fermer]')) dlg.close(); });
  document.body.appendChild(dlg);
  btn.addEventListener('click', async () => {
    if (invite) {
      invite.prompt();
      const { outcome } = await invite.userChoice.catch(() => ({}));
      if (outcome === 'accepted') btn.hidden = true;
      invite = null;
      return;
    }
    dlg.innerHTML = `<div class="appli-boite">
      <button type="button" class="appli-x" data-fermer aria-label="Fermer">×</button>
      <img src="img/mesa-192.png" alt="" width="56" height="56">
      <h2>${t('Installer MESA sur ton téléphone')}</h2>
      <ol>
        <li>${t('Touche le bouton Partager de Safari (le carré avec une flèche vers le haut).')}</li>
        <li>${t('Choisis « Sur l’écran d’accueil », puis « Ajouter ».')}</li>
      </ol>
      <p>${t('MESA s’ouvre alors en plein écran, comme une appli. Tu peux toujours utiliser le site.')}</p>
      <button type="button" class="appli-ok" data-fermer>J'ai compris</button>
    </div>`;
    dlg.showModal();
  });
})();
