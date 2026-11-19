/* MESA : page de confidentialité (adresse de contact = celle de l'aide) */
'use strict';
if (typeof boutonAffichage === 'function') boutonAffichage(document.getElementById('place-affichage'));
if (typeof AIDE_EMAIL === 'string' && AIDE_EMAIL) {
  const a = document.createElement('a');
  a.href = 'mailto:' + AIDE_EMAIL; a.textContent = AIDE_EMAIL;
  document.getElementById('contact').replaceChildren(a);
}
