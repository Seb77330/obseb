/* OBSeb : la page faq.html. Toutes les questions par catégorie, et une recherche qui comprend les questions formulées autrement. */
'use strict';
(() => {
  const moteur = AideRecherche.index(FAQ);
  const liste = document.getElementById('faq-liste');
  const champ = document.getElementById('faq-cherche');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bloc = (e, ouvert) => `<details${ouvert ? ' open' : ''}><summary>${esc(e.q)}</summary><p>${esc(e.r)}</p></details>`;

  document.getElementById('faq-cats').innerHTML = FAQ_CATEGORIES.map(([id, nom]) => `<a href="#cat-${id}">${esc(nom)}</a>`).join('');
  function tout() {
    liste.innerHTML = FAQ_CATEGORIES.map(([id, nom]) => {
      const qs = FAQ.filter(e => e.c === id);
      return qs.length ? `<section class="faq-section"><h2 id="cat-${id}">${esc(nom)}</h2>${qs.map(e => bloc(e)).join('')}</section>` : '';
    }).join('');
  }
  let minuterie;
  champ.addEventListener('input', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      const q = champ.value.trim();
      if (!q) return tout();
      const res = moteur.chercher(q, 8).filter((r, i, a) => r.score >= a[0].score * .35);
      liste.innerHTML = res.length
        ? `<section class="faq-section"><h2>Les plus proches</h2>${res.map((r, i) => bloc(r.e, i === 0 && AideRecherche.sur(res))).join('')}</section>`
        : `<p class="faq-vide">Rien de proche dans l'aide. Essaie avec d'autres mots, ou écris-nous juste en dessous.</p>`;
    }, 120);
  });
  tout();

  const email = (typeof AIDE_EMAIL === 'string' && /.+@.+\..+/.test(AIDE_EMAIL.trim())) ? AIDE_EMAIL.trim() : '';
  const mail = document.getElementById('faq-mail');
  if (email) {
    const a = document.createElement('a');
    a.className = 'aide-mail'; a.textContent = '✉ Écrire au support';
    a.href = `mailto:${email}?subject=${encodeURIComponent('Aide OBSeb')}&body=${encodeURIComponent('Ma question :\n\n\n---\nNavigateur : ' + navigator.userAgent)}`;
    mail.appendChild(a);
  } else mail.innerHTML = `<p class="aide-bientot">L'adresse e-mail du support arrive très bientôt.</p>`;

  if (typeof boutonAffichage === 'function') boutonAffichage(document.getElementById('place-affichage'));
})();
