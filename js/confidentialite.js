/* MESA : pages Confidentialité et Conditions d'utilisation (adresse de contact = celle de l'aide) */
'use strict';
if (typeof boutonAffichage === 'function') boutonAffichage(document.getElementById('place-affichage'));
if (typeof AIDE_EMAIL === 'string' && AIDE_EMAIL && document.getElementById('contact')) {
  const a = document.createElement('a');
  a.href = 'mailto:' + AIDE_EMAIL; a.textContent = AIDE_EMAIL;
  document.getElementById('contact').replaceChildren(a);
}
