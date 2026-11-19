/* MESA : page de connexion (Google, ou code reçu par e-mail) */
'use strict';
(async function () {
  const $ = s => document.querySelector(s);
  if (typeof boutonAffichage === 'function') boutonAffichage($('#place-affichage'));
  if (!Comptes.actif) { $('#pas-pret').hidden = false; return; }

  const suite = new URLSearchParams(location.search).get('suite') || '';
  const versAccueil = () => { location.href = Comptes.accueil(suite); };
  if (await Comptes.session()) { versAccueil(); return; }
  $('#pret').hidden = false;
  if (suite === 'nouveau') $('#pourquoi').textContent = 'Connecte-toi pour créer ton live. Tes invités, eux, n\'ont pas besoin de compte.';

  const message = (t, ko) => { const m = $('#message'); m.textContent = t || ''; m.classList.toggle('ko', !!ko); };
  const occupe = (b, oui, texte) => { b.disabled = oui; if (texte) b.textContent = texte; };
  const traduire = err => {
    const t = String((err && (err.message || err.error_description)) || '');
    if ((err && err.status === 429) || /rate limit|security purposes|seconds/i.test(t)) return 'Trop d\'essais d\'un coup. Attends une minute, puis réessaie.';
    if (/expired|invalid|otp/i.test(t)) return 'Ce code ne marche pas ou a expiré. Vérifie les chiffres, ou demande un nouveau code.';
    if (/fetch|network|failed/i.test(t)) return 'Pas de connexion au service des comptes. Vérifie ton internet et réessaie.';
    return 'Ça n\'a pas marché. Réessaie dans un instant.';
  };

  $('#btn-google').onclick = async () => {
    occupe($('#btn-google'), true); message('On t\'emmène chez Google…');
    const { error } = await Comptes.google(suite);
    if (error) { occupe($('#btn-google'), false); message(traduire(error), true); }
  };

  let email = '', minuteur = 0;
  function attendreRenvoi() {
    const b = $('#btn-renvoyer'); let reste = 60; clearInterval(minuteur);
    b.disabled = true; b.textContent = 'Renvoyer le code (60 s)';
    minuteur = setInterval(() => {
      reste--; b.textContent = reste > 0 ? `Renvoyer le code (${reste} s)` : 'Renvoyer le code';
      if (reste <= 0) { clearInterval(minuteur); b.disabled = false; }
    }, 1000);
  }
  async function envoyer() {
    const { error } = await Comptes.envoyerCode(email);
    if (error) { message(traduire(error), true); return false; }
    message(''); attendreRenvoi(); return true;
  }

  $('#form-email').onsubmit = async e => {
    e.preventDefault();
    email = $('#email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { message('Cette adresse e-mail a l\'air incomplète.', true); $('#email').focus(); return; }
    occupe($('#btn-envoyer'), true, 'Envoi…');
    const ok = await envoyer();
    occupe($('#btn-envoyer'), false, 'Recevoir un code');
    if (!ok) return;
    $('#email-vu').textContent = email;
    $('#etape-choix').hidden = true; $('#etape-code').hidden = false; $('#code').value = ''; $('#code').focus();
  };

  $('#code').oninput = () => { $('#code').value = $('#code').value.replace(/\D/g, '').slice(0, 10); };
  $('#form-code').onsubmit = async e => {
    e.preventDefault();
    const code = $('#code').value;
    if (code.length < 6) { message('Le code fait 6 chiffres.', true); return; }
    occupe($('#btn-valider'), true, 'Vérification…');
    const { error } = await Comptes.verifierCode(email, code);
    if (error) { occupe($('#btn-valider'), false, 'Me connecter'); message(traduire(error), true); return; }
    message('C\'est bon, connexion réussie.'); versAccueil();
  };
  $('#btn-renvoyer').onclick = async () => { message('Nouvel envoi…'); if (await envoyer()) message('Nouveau code envoyé.'); };
  $('#btn-autre').onclick = () => { clearInterval(minuteur); $('#etape-code').hidden = true; $('#etape-choix').hidden = false; message(''); $('#email').focus(); };
})();
