/* MESA : l'accueil en « une seule page » (vitrine seulement).
   Un écran par partie : la molette passe d'une partie à la suivante (défilement aimanté, css/vitrine.css),
   la couleur d'ambiance change avec la partie, le contenu apparaît en douceur, et des points sur le côté
   permettent de sauter directement à une partie. Rien de tout ça dans l'espace perso (Mes lives). */
'use strict';
(function () {
  const Qs = new URLSearchParams(location.search);
  if (Qs.get('visuel') || Qs.get('embed')) return;
  const BARRE = 68;
  const doux = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parties = [
    { el: document.querySelector('.v-hero'), nom: 'Accueil', a: '#FFD21F', b: '#FF8A00' },
    { el: document.getElementById('v-plus-titre')?.closest('section'), nom: 'Ce que tu peux faire', a: '#22C3A6', b: '#3B76DB' },
    { el: document.querySelector('.v-themes'), nom: 'Les looks', a: '#A855F7', b: '#EC4899' },
    { el: document.getElementById('v-comment')?.closest('section'), nom: 'Comment ça marche', a: '#F97316', b: '#FFD21F' },
    { el: document.getElementById('formules'), nom: 'Formules', a: '#7C55E8', b: '#17A2BD' }
  ].filter(p => p.el);
  if (!parties.length) return;
  parties.forEach(p => p.el.classList.add('chapitre'));
  document.documentElement.classList.add('onepage');

  /* les points sur le côté */
  const nav = document.createElement('nav');
  nav.className = 'chapitres-nav'; nav.setAttribute('aria-label', 'Parties de la page');
  nav.innerHTML = parties.map((p, i) => `<button type="button" data-i="${i}" title="${esc(p.nom)}" aria-label="${esc(p.nom)}"><span>${esc(p.nom)}</span></button>`).join('');
  document.body.appendChild(nav);
  nav.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i;
    if (i === parties.length - 1) scrollTo({ top: document.documentElement.scrollHeight, behavior: doux ? 'auto' : 'smooth' });   // le dernier point : tout en bas, mentions comprises
    else parties[i].el.scrollIntoView({ behavior: doux ? 'auto' : 'smooth', block: 'start' });
  });

  /* Sur un grand écran, le contenu de chaque partie grandit pour remplir l'écran (sinon tout paraît vide). */
  const remplir = () => {
    parties.slice(0, -1).forEach((p, k) => {
      const enfants = [...p.el.children].filter(c => getComputedStyle(c).position !== 'absolute');
      enfants.forEach(c => { c.style.zoom = ''; });
      if (innerWidth < 1100 || innerHeight < 700) return;
      const haut = enfants[0].getBoundingClientRect().top, bas = Math.max(...enfants.map(c => c.getBoundingClientRect().bottom));
      const dispo = innerHeight - BARRE - (k === 0 ? 40 : 110);
      const z = Math.min(k === 0 ? 1.3 : k === 1 ? 1.5 : 1.9, dispo / (bas - haut), innerWidth / (k === 0 ? 1250 : k === 1 ? 1150 : 900));
      if (z > 1.03) enfants.forEach(c => { c.style.zoom = z.toFixed(3); });
    });
  };
  let attente; addEventListener('resize', () => { clearTimeout(attente); attente = setTimeout(remplir, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remplir); else remplir();

  /* la partie à l'écran donne sa couleur et allume son point */
  const poser = i => {
    const p = parties[i]; if (!p) return;
    document.body.style.setProperty('--amb-a', p.a); document.body.style.setProperty('--amb-b', p.b);
    nav.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  };
  poser(0);
  if (!('IntersectionObserver' in window)) return;
  const ratios = new Map();
  const io = new IntersectionObserver(l => {
    l.forEach(x => ratios.set(x.target, x.intersectionRatio));
    let meilleur = 0, i = 0;
    parties.forEach((p, k) => { const r = ratios.get(p.el) || 0; if (r > meilleur) { meilleur = r; i = k; } });
    poser(i);
  }, { threshold: [0, .15, .3, .5, .7, .9] });
  parties.forEach(p => io.observe(p.el));

  /* La molette passe d'une partie à la suivante. Une partie plus haute que l'écran (les formules) se lit d'abord
     jusqu'au bout, puis la molette continue. Au clavier et au doigt, le défilement reste libre. */
  const grandEcran = () => innerWidth > 760 && innerHeight > 560;
  let verrou = 0, cumul = 0;
  const actuelle = () => { let k = 0; parties.forEach((p, i) => { if (p.el.getBoundingClientRect().top < innerHeight / 2) k = i; }); return k; };
  const aller = i => { verrou = Date.now() + 850; cumul = 0; parties[i].el.scrollIntoView({ behavior: doux ? 'auto' : 'smooth', block: 'start' }); };
  addEventListener('wheel', e => {
    if (document.body.dataset.page !== 'vitrine' || !grandEcran() || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (e.target.closest && e.target.closest('.aide-racine, .affichage-pop, dialog')) return;
    if (Date.now() < verrou) { e.preventDefault(); return; }
    const i = actuelle(), r = parties[i].el.getBoundingClientRect();
    if (e.deltaY > 0) {
      if (r.bottom > innerHeight + 4 || i === parties.length - 1) return;   // il reste à lire dans cette partie (ou c'est la dernière : le pied de page)
      e.preventDefault(); cumul += e.deltaY; if (cumul > 30) aller(i + 1);
    } else {
      if (r.top < BARRE - 4) {                                                 // le haut de la partie n'est pas encore à l'écran
        if (r.top > BARRE - innerHeight * .9 || r.bottom < BARRE + 40) return;
        return;
      }
      if (i === 0) return;
      e.preventDefault(); cumul += e.deltaY; if (cumul < -30) aller(i - 1);
    }
  }, { passive: false });

  /* apparition douce du contenu de chaque partie (pas les formules, qui ont déjà la leur) */
  if (doux) return;
  const revele = new IntersectionObserver(l => l.forEach(x => { if (x.isIntersecting) { x.target.classList.add('chapitre-vu'); revele.unobserve(x.target); } }), { threshold: .2 });
  parties.slice(1, -1).forEach(p => { p.el.classList.add('chapitre-cache'); revele.observe(p.el); });
})();
