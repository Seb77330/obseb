/* MESA : la page Contact. Pas de serveur : le message est préparé dans l'application d'e-mail de la personne,
   vers l'adresse du support (js/aide-config.js, AIDE_EMAIL). Tant qu'elle est vide, on propose de copier le message. */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  if (typeof boutonAffichage === 'function') boutonAffichage($('#place-affichage'));
  const adresse = typeof AIDE_EMAIL === 'string' ? AIDE_EMAIL.trim() : '';
  if (!adresse) $('#c-note').textContent = 'L\'adresse du support arrive très bientôt. En attendant, tu pourras copier ton message.';
  const qs = new URLSearchParams(location.search);
  const sujetDemande = qs.get('sujet');
  if (sujetDemande) { const r = document.querySelector(`input[name=sujet][value="${CSS.escape(sujetDemande)}"]`); if (r) r.checked = true; }
  const erreur = t => { const e = $('#c-erreur'); e.textContent = t; e.hidden = !t; };
  $('#form-contact').addEventListener('submit', async ev => {
    ev.preventDefault();
    const nom = $('#c-nom').value.trim(), email = $('#c-email').value.trim(), msg = $('#c-message').value.trim();
    const sujet = (document.querySelector('input[name=sujet]:checked') || {}).value || 'Question';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erreur('Ton e-mail ne semble pas complet : on en a besoin pour te répondre.'); $('#c-email').focus(); return; }
    if (msg.length < 5) { erreur('Écris quelques mots dans ton message.'); $('#c-message').focus(); return; }
    erreur('');
    const corps = `${msg}\n\n---\n${nom || 'Sans prénom'} · ${email}\nNavigateur : ${navigator.userAgent}`;
    const objet = `[MESA] ${sujet}${nom ? ' · ' + nom : ''}`;
    $('#form-contact').hidden = true; $('#c-merci').hidden = false;
    if (adresse) {
      location.href = `mailto:${encodeURIComponent(adresse)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
      $('#c-merci-txt').textContent = `Ton application d'e-mail vient de s'ouvrir avec le message pour ${adresse}. Il ne reste qu'à appuyer sur Envoyer.`;
    } else {
      let copie = false;
      try { await navigator.clipboard.writeText(objet + '\n\n' + corps); copie = true; } catch (e) { /* rien */ }
      $('#c-merci-txt').textContent = copie ? 'Ton message est copié. L\'adresse du support arrive très bientôt : tu pourras le coller dans un e-mail.' : 'L\'adresse du support arrive très bientôt. Garde ton message de côté en attendant.';
    }
  });
})();
