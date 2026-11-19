/* MESA : la vitrine de l'accueil (css/vitrine.css).
   Premier passage (aucun live) ou lien « Découvrir » : la vitrine, avec les formules tout en bas.
   Sinon : l'espace perso (Mes lives / Mes enregistrements), sans les formules.
   L'aperçu du haut est le vrai rendu du studio (sortie.html en démo), qui change de plan toutes les 5 secondes. */
'use strict';
(function () {
  const Qs = new URLSearchParams(location.search);
  if (Qs.get('visuel') || Qs.get('embed')) return; // le panneau Visuel de la régie : pas de vitrine
  const doux = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Vitrine ou espace perso ----- */
  function page() {
    const h = location.hash;
    const p = h === '#decouvrir' || h === '#formules' ? 'vitrine' : h === '#mes-lives' ? 'espace' : (lire().length ? 'espace' : 'vitrine');
    const avant = document.body.dataset.page;
    document.body.dataset.page = p;
    if (p === 'vitrine') demarrer(); else arreter();
    if (avant && avant !== p) scrollTo(0, 0);
    if (h === '#formules') requestAnimationFrame(() => $('#formules').scrollIntoView({ behavior: doux ? 'auto' : 'smooth', block: 'start' }));
  }
  addEventListener('hashchange', page);
  const allerFormules = () => {
    if (!$('#vue-liste').hidden && document.body.dataset.page === 'vitrine') $('#formules').scrollIntoView({ behavior: doux ? 'auto' : 'smooth', block: 'start' });
    else { if ($('#vue-liste').hidden) montrerVue('liste'); if (location.hash === '#formules') page(); else location.hash = 'formules'; }
  };
  $('#btn-formules').onclick = allerFormules;
  $$('[data-v-formules]').forEach(b => { b.onclick = allerFormules; });
  // « Essayer gratuitement » = Nouveau live (crée le live et ouvre la régie)
  $$('[data-v-essayer]').forEach(b => { b.onclick = () => $('#btn-nouveau').click(); });

  /* ----- L'aperçu : quelques plans du vrai rendu ----- */
  const PLANS = [
    { nom: 'Tes invités', theme: 'plateau3d', q: 'demo=4&sources=0&vivant=1' },
    { nom: 'Le quiz', theme: 'pop', q: 'demo=3&sources=0&quiz=1&qecoule=6&vivant=1' },
    { nom: 'Le chat à l\'écran', theme: 'neon', q: 'demo=3&sources=0&chat=youtube&vivant=1' },
    { nom: 'Soirée film', theme: 'bond', q: 'demo=3&watch=1&srcnom=Le%20film&vivant=1' },
    { nom: 'Le générique', theme: 'cinema', q: 'demo=3&scene=intro' }
  ];
  const DUREE = 5200;
  const boite = $('#v-scenes'), barre = $('#v-plans');
  barre.style.setProperty('--v-duree', DUREE + 'ms');
  const url = p => {
    const s = Object.assign(nouvelleSession('Le grand débat ciné', p.theme), { hote: 'Alex', handle: '@ta_chaine', theme: { preset: p.theme, logoTexte: 'MESA' } });
    return `sortie.html?${p.q}&musique=0#s=${b64e(s)}`;
  };
  let actuel = -1, minuteur = 0, fixe = doux, lance = false;
  const boutons = PLANS.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = p.nom; b.setAttribute('aria-selected', 'false');
    b.onclick = () => { fixe = true; barre.classList.add('fixe'); montrer(i); };
    barre.appendChild(b); return b;
  });
  if (fixe) barre.classList.add('fixe');
  function suivant() { if (!fixe) minuteur = setTimeout(() => montrer((actuel + 1) % PLANS.length), DUREE); }
  function montrer(i) {
    clearTimeout(minuteur);
    actuel = i;
    boutons.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    const f = document.createElement('iframe');
    f.tabIndex = -1; f.title = 'Aperçu : ' + PLANS[i].nom; f.setAttribute('aria-hidden', 'true');
    f.onload = () => setTimeout(() => {
      f.classList.add('vu');
      // l'ancien plan reste derrière le temps du fondu, puis on le retire
      Array.from(boite.children).forEach(x => { if (x !== f) setTimeout(() => { if (x.parentNode) boite.removeChild(x); }, 800); });
    }, 350);
    f.src = url(PLANS[i]);
    boite.appendChild(f);
    suivant();
  }
  function demarrer() { if (lance) return; lance = true; montrer(actuel < 0 ? 0 : actuel); }
  function arreter() { if (!lance) return; lance = false; clearTimeout(minuteur); boite.textContent = ''; }
  // onglet caché : on arrête de faire tourner
  document.addEventListener('visibilitychange', () => {
    if (!lance) return;
    clearTimeout(minuteur);
    if (!document.hidden) suivant();
  });

  /* ----- Les thèmes qui défilent ----- */
  const IDS = ['cinema', 'arcade', 'jt', 'neon', 'bond', 'stade', 'manga', 'plateau3d', 'retro', 'horreur', 'pastel', 'ceremonie', 'western', 'cosmos'];
  const rail = document.createElement('div'); rail.className = 'v-rail';
  const carte = (id, double) => {
    const t = THEMES[id]; if (!t) return '';
    const nom = String(t.nom || id).replace(/\s*\(.*\)$/, '');
    return `<figure class="v-theme"${double ? ' aria-hidden="true"' : ''}><img src="img/themes/${id}-live.webp" alt="${double ? '' : 'Thème ' + esc(nom)}" loading="lazy" width="640" height="360"><figcaption>${esc(nom)}</figcaption></figure>`;
  };
  // la liste deux fois de suite : le défilement boucle sans à-coup
  rail.innerHTML = IDS.map(id => carte(id, false)).join('') + IDS.map(id => carte(id, true)).join('');
  $('#v-defile').appendChild(rail);

  page();
})();
