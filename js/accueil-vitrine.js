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
    { nom: 'Tes invités', court: 'Invités', theme: 'plateau3d', q: ['demo=4&sources=0'] },
    { nom: 'Réaction', theme: 'cinema', q: [`demo=1&mode=reaction&petit=partage&coin=bg&taille=m&vdispo=coin&srcimg=${N}&srcnom=Bande-annonce`] },
    { nom: 'Jeu vidéo', theme: 'arcade', q: ['demo=1&mode=jeu&coin=mg&taille=p&vdispo=coin&srcimg=img/demo/jeu-course.svg&srcnom=Jeu'] },
    { nom: 'Quiz et classement', court: 'Quiz', theme: 'studio', q: ['demo=3&sources=0&quiz=1&qecoule=6&qstyle=plateau&qimg=img/demo/quiz-casino.svg', 'demo=3&sources=0&classement=5&qstyle=plateau'] },
    { nom: 'Le chat à l\'écran', court: 'Chat', theme: 'neon', q: ['demo=3&sources=0&chat=youtube&cstyle=bulle', 'demo=3&sources=0&chat=twitch&cstyle=affiche', 'demo=3&sources=0&chat=youtube&cstyle=notif', 'demo=3&sources=0&chat=twitch&cstyle=postit'] },
    { nom: 'Sous-titres', theme: 'studio', q: ['demo=2&sources=0&st=1&ststyle=cinema'] },
    { nom: 'Intros et outros', court: 'Intros', theme: 'cinema', q: ['demo=3&scene=intro&intro=pellicule', 'demo=3&scene=intro&intro=neon', 'demo=3&scene=fin&outro=rideau', 'demo=3&scene=fin&outro=generique'] },
    { nom: 'Soirée film', theme: 'bond', q: [`demo=3&scene=watch&watch=1&wstyle=bandeau&wmode=double&srcimg=${H}&wtitre=Horizon%20Rouge`] }
  ];
  /* un picto par plan ; le nom ne s'affiche que sur le plan choisi */
  const PICTOS = [
    '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z"/>',
    '<path d="M7 8h10a5 5 0 0 1 4.9 4l.8 4a2.3 2.3 0 0 1-4 2l-1.7-2H7l-1.7 2a2.3 2.3 0 0 1-4-2l.8-4A5 5 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3M16 11.5h.01M18 13.5h.01"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>',
    '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 15h4M13 15h4M7 11.5h10"/>',
    '<path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 10l1.2-4.2 14-1.8.6 3.9z"/><path d="M8.6 5.4l2 3.6M13.2 4.8l2 3.6"/>',
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'
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
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
    b.title = p.nom; b.setAttribute('aria-label', p.nom);
    b.innerHTML = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PICTOS[i] || ''}</svg><span>${esc(p.court || p.nom)}</span>`;
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
