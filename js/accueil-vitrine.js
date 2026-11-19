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

  /* ----- L'aperçu : quelques plans du vrai rendu, en horizontal et en vertical côte à côte -----
     Un plan peut avoir plusieurs étapes (ex. le quiz puis le classement) : elles s'enchaînent dans le même plan. */
  const H = 'img/demo/film-horizon.svg', N = 'img/demo/film-neon.svg';
  const PLANS = [
    { nom: 'Tes invités', theme: 'plateau3d', q: ['demo=4&sources=0'] },
    { nom: 'Réaction', theme: 'cinema', q: [`demo=1&mode=reaction&petit=partage&coin=bg&taille=m&vdispo=coin&srcimg=${N}&srcnom=Bande-annonce`] },
    { nom: 'Jeu vidéo', theme: 'arcade', q: ['demo=1&mode=jeu&coin=mg&taille=p&vdispo=coin&srcimg=img/demo/jeu-course.svg&srcnom=Jeu'] },
    { nom: 'Quiz et classement', theme: 'studio', q: ['demo=3&sources=0&quiz=1&qecoule=6&qstyle=plateau&qimg=img/demo/quiz-casino.svg', 'demo=3&sources=0&classement=5&qstyle=plateau'] },
    { nom: 'Le chat à l\'écran', theme: 'neon', q: ['demo=3&sources=0&chat=youtube&cstyle=bulle', 'demo=3&sources=0&chat=twitch&cstyle=affiche', 'demo=3&sources=0&chat=youtube&cstyle=notif', 'demo=3&sources=0&chat=twitch&cstyle=postit'] },
    { nom: 'Sous-titres', theme: 'studio', q: ['demo=2&sources=0&st=1&ststyle=cinema'] },
    { nom: 'Intros et outros', theme: 'cinema', q: ['demo=3&scene=intro&intro=pellicule', 'demo=3&scene=intro&intro=neon', 'demo=3&scene=fin&outro=rideau', 'demo=3&scene=fin&outro=generique'] },
    { nom: 'Soirée film', theme: 'bond', q: [`demo=3&scene=watch&watch=1&wstyle=bandeau&wmode=double&srcimg=${H}&wtitre=Horizon%20Rouge`] }
  ];
  const ETAPE = 3400, DUREE = 5600;
  const dureePlan = p => p.q.length > 1 ? p.q.length * ETAPE : DUREE;
  const boites = [$('#v-scenes'), $('#v-scenes-v')], barre = $('#v-plans');
  const url = (p, q, vertical) => {
    const s = Object.assign(nouvelleSession('Le grand débat ciné', p.theme), { hote: 'Alex', handle: '@ta_chaine', theme: { preset: p.theme, logoTexte: 'MESA' } });
    return `sortie.html?${q}&vivant=1&musique=0${vertical ? '&format=vertical' : ''}#s=${b64e(s)}`;
  };
  let actuel = -1, etape = 0, minuteur = 0, fixe = doux, lance = false;
  const boutons = PLANS.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = p.nom; b.setAttribute('aria-selected', 'false');
    b.onclick = () => { fixe = true; barre.classList.add('fixe'); montrer(i); };
    barre.appendChild(b); return b;
  });
  if (fixe) barre.classList.add('fixe');
  function charger(boite, src, titre) {
    const f = document.createElement('iframe');
    f.tabIndex = -1; f.title = 'Aperçu : ' + titre; f.setAttribute('aria-hidden', 'true');
    f.onload = () => setTimeout(() => {
      f.classList.add('vu');
      // l'ancien plan reste derrière le temps du fondu, puis on le retire
      Array.from(boite.children).forEach(x => { if (x !== f) setTimeout(() => { if (x.parentNode) boite.removeChild(x); }, 800); });
    }, 350);
    f.src = src;
    boite.appendChild(f);
  }
  function montrer(i, k = 0) {
    clearTimeout(minuteur);
    const p = PLANS[i];
    if (i !== actuel || k === 0) {
      boutons.forEach((b, n) => b.setAttribute('aria-selected', String(n === i)));
      const b = boutons[i]; b.style.setProperty('--v-duree', dureePlan(p) + 'ms');
      b.classList.remove('relance'); void b.offsetWidth; b.classList.add('relance');
    }
    actuel = i; etape = k;
    boites.forEach((boite, v) => charger(boite, url(p, p.q[k], !!v), p.nom));
    if (k + 1 < p.q.length) minuteur = setTimeout(() => montrer(i, k + 1), ETAPE);
    else if (!fixe) minuteur = setTimeout(() => montrer((i + 1) % PLANS.length), p.q.length > 1 ? ETAPE : DUREE);
    else if (p.q.length > 1) minuteur = setTimeout(() => montrer(i, 0), ETAPE);
  }
  function demarrer() { if (lance) return; lance = true; montrer(actuel < 0 ? 0 : actuel); }
  function arreter() { if (!lance) return; lance = false; clearTimeout(minuteur); boites.forEach(b => { b.textContent = ''; }); }
  // onglet caché : on arrête de faire tourner
  document.addEventListener('visibilitychange', () => {
    if (!lance) return;
    clearTimeout(minuteur);
    if (!document.hidden) montrer(actuel, etape);
  });

  /* ----- Les thèmes qui défilent ----- */
  // chaque look avec sa soirée : une vraie image du rendu (img/vitrine/<id>.webp)
  const LOOKS = [['cinema', 'Soirée ciné'], ['arcade', 'Spécial jeux vidéo'], ['jt', 'Le JT de la semaine'], ['neon', 'L\'after du vendredi'],
    ['bond', 'Nuit des espions'], ['stade', 'Soir de match'], ['manga', 'Spécial anime'], ['plateau3d', 'Le grand débat'], ['retro', 'Soirée années 80'],
    ['horreur', 'Nuit d\'Halloween'], ['pastel', 'Le talk du dimanche'], ['ceremonie', 'La remise des prix'], ['western', 'Soirée western'], ['cosmos', 'Soirée SF']];
  const rail = document.createElement('div'); rail.className = 'v-rail';
  const carte = ([id, soiree], double) => {
    const t = THEMES[id]; if (!t) return '';
    const nom = String(t.nom || id).replace(/\s*\(.*\)$/, '');
    return `<figure class="v-theme"${double ? ' aria-hidden="true"' : ''}><img src="img/vitrine/${id}.webp" alt="${double ? '' : esc(soiree) + ', look ' + esc(nom)}" loading="lazy" width="800" height="450"><figcaption><b>${esc(soiree)}</b><span>${esc(nom)}</span></figcaption></figure>`;
  };
  // la liste deux fois de suite : le défilement boucle sans à-coup
  rail.innerHTML = LOOKS.map(l => carte(l, false)).join('') + LOOKS.map(l => carte(l, true)).join('');
  $('#v-defile').appendChild(rail);

  page();
})();
