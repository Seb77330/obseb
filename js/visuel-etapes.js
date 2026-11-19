/* MESA : le visuel du live, réglé par étapes dans la régie.
   La régie ouvre cette page dans un panneau sur le côté (index.html?visuel=<salle>&embed=1&panneau=1) :
   l'aperçu de la régie reste visible au centre et change à chaque choix.
   Les étapes suivent l'ordre logique : 1 Thème, 2 Couleurs, 3 Police, 4 Logo et fond, 5 Musiques, 6 Textes, 7 Quand (date et durée).
   Chaque choix est envoyé à la régie (message « apercu ») ; « Appliquer au live » l'enregistre pour de bon. */
'use strict';
(() => {
  const Q = new URLSearchParams(location.search);
  if (Q.get('panneau') !== '1' || !document.body.classList.contains('page-visuel') || window.parent === window) return;
  document.body.classList.add('vp-etapes');

  const parler = m => window.parent.postMessage(m, location.origin);

  /* L'aperçu de cette page ne sert plus : c'est celui de la régie qui montre le résultat */
  window.apercu = function () {
    clearTimeout(apercu.t);
    apercu.t = setTimeout(() => { try { parler({ obsebVisuel: 'apercu', s: b64e(brouillon) }); } catch (e) { /* rien */ } }, 250);
  };

  const blocDe = sel => { const el = $(sel); return el ? el.closest('.bloc') || el : null; };
  const ETAPES = [
    { id: 'theme', nom: 'Thème', titre: 'Choisis un thème', aide: 'Le décor de ton live. Tu peux tout ajuster dans les étapes suivantes.',
      els: ['#mes-styles', '#materiel-3d', '#cats-themes', '#galerie', '#opt-obs'] },
    { id: 'couleurs', nom: 'Couleurs', titre: 'Tes couleurs', aide: 'L\'accent colore les titres et les noms ; le fond et le halo font l\'ambiance.',
      els: [blocDe('.nuancier')] },
    { id: 'police', nom: 'Police', titre: 'La police des titres', aide: 'Elle sert pour le titre, l\'intro et l\'outro.',
      els: [blocDe('#polices')] },
    { id: 'logo', nom: 'Logo et fond', titre: 'Ton logo et ton fond', aide: 'Facultatif. Un PNG transparent rend mieux pour le logo.',
      els: [blocDe('.depots')] },
    { id: 'musiques', nom: 'Musiques', titre: 'Les musiques', aide: 'Facultatif. Elles jouent pendant l\'intro et l\'outro.',
      els: [blocDe('.sons')] },
    { id: 'textes', nom: 'Textes', titre: 'Les textes de l\'intro et de l\'outro', aide: 'Chaque texte se change ici. Laisse une case vide pour garder le texte proposé.',
      els: [] },
    { id: 'titre', nom: 'Quand', titre: 'Quand a lieu le live ?', aide: 'Facultatif : programmer prévient tes invités.',
      els: ['.quand', '#f-limite'] }
  ];

  // un live tout neuf : on commence par son nom (le reste peut attendre), et on peut terminer à tout moment
  const nouveau = !!brouillon.choixVisuel;
  if (nouveau) ETAPES.unshift({ id: 'depart', nom: 'Nom', titre: 'Comment s\'appelle ton live ?', aide: 'Ton public le voit dans l\'intro et en bas de l\'écran. Tu pourras le changer quand tu veux.', els: [] });
  const iTheme = ETAPES.findIndex(e => e.id === 'theme');

  const corps = $('.creation-choix .choix-corps');
  const tete = document.createElement('div');
  tete.className = 'vp-tete';
  tete.innerHTML = `<h1>${nouveau ? 'Ton nouveau live' : 'Visuel du live'}</h1><button type="button" class="vp-fermer" title="Fermer sans rien changer" aria-label="Fermer sans rien changer">✕</button>`;
  const nav = document.createElement('ol');
  nav.className = 'vp-nav';
  nav.setAttribute('aria-label', 'Les étapes du visuel');
  const panes = document.createElement('div');
  panes.className = 'vp-panes';

  ETAPES.forEach((e, i) => {
    nav.insertAdjacentHTML('beforeend', `<li><button type="button" data-etape="${i}" title="${esc(e.titre)}"><span class="vp-num">${i + 1}</span><span class="vp-nom">${esc(e.nom)}</span></button></li>`);
    const p = document.createElement('section');
    p.className = 'vp-pane'; p.dataset.etape = i; p.hidden = true;
    p.innerHTML = `<h2>${esc(e.titre)}</h2><p class="aide">${esc(e.aide)}</p>`;
    e.els.forEach(x => { const el = typeof x === 'string' ? $(x) : x; if (el) p.appendChild(el); });
    panes.appendChild(p);
  });
  /* L'étape « Nom » d'un nouveau live : un grand champ et quelques idées */
  if (nouveau) {
    const pane = panes.querySelector('.vp-pane[data-etape="0"]');
    const defaut = brouillon.titre === 'Mon live';
    pane.insertAdjacentHTML('beforeend', `<input type="text" class="vp-nom-live" maxlength="70" placeholder="Ex. Spécial Marvel : on refait la phase 6" aria-label="Le nom de ton live">
      <p class="vp-idees-titre">Besoin d'une idée ?</p>
      <div class="vp-idees">${['Soirée ciné', 'Quiz entre potes', 'Le débrief de la semaine', 'Watch party', 'On réagit aux bandes-annonces', 'Live chill'].map(t => `<button type="button">${esc(t)}</button>`).join('')}</div>`);
    const champ = pane.querySelector('.vp-nom-live');
    champ.value = defaut ? '' : brouillon.titre;
    const poser = v => { brouillon.titre = v.trim() ? v : 'Mon live'; const f = $('#f-titre'); if (f) f.value = brouillon.titre; apercu(); };
    champ.oninput = () => poser(champ.value);
    champ.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); aller(cur + 1); } };
    pane.querySelectorAll('.vp-idees button').forEach(b => b.onclick = () => { champ.value = b.textContent; poser(champ.value); champ.focus(); });
    setTimeout(() => champ.focus(), 300);
  }
  /* L'étape « Textes » : un champ par texte affiché, rangé comme à l'écran (intro, puis outro) */
  const champTexte = (k, label) => `<label class="vp-champ"><span>${esc(label)}</span><input type="text" maxlength="60" data-texte="${k}" placeholder="${esc(TEXTES_DEFAUT[k])}"></label>`;
  const paneTextes = panes.querySelector('.vp-pane[data-etape="' + ETAPES.findIndex(e => e.id === 'textes') + '"]');
  paneTextes.insertAdjacentHTML('beforeend', `
    <div class="vp-groupe"><h3>Intro</h3>
      ${champTexte('introSur', 'Au-dessus du titre')}
      <div class="vp-place" data-place="titre"></div>
      ${champTexte('introInfo', 'Sous le titre')}
      ${champTexte('introCompte', 'Avant le compte à rebours')}
      ${champTexte('introAvec', 'Devant ton nom')}
      <div class="vp-place" data-place="hote"></div>
    </div>
    <div class="vp-groupe"><h3>Outro</h3>
      ${champTexte('finSur', 'Au-dessus du titre')}
      ${champTexte('finInfo', 'Sous le titre')}
      <div class="vp-place" data-place="handle"></div>
    </div>
    <details class="vp-groupe vp-plus"><summary>Textes de certains visuels</summary>
      ${champTexte('introParti', 'Fin du compte à rebours')}
      ${champTexte('introBandeau', 'Bandeau défilant de l\'intro (Plateau TV)')}
      ${champTexte('finBandeau', 'Bandeau défilant de l\'outro (Plateau TV)')}
      ${champTexte('finTypo', 'Mot répété (outro Typo)')}
      ${champTexte('finPresente', 'Générique : avant ton nom')}
      ${champTexte('finAvec', 'Générique : avant les invités')}
      ${champTexte('finRetrouve', 'Générique : avant ton compte')}
      ${champTexte('finAdieu', 'Générique : le mot de la fin')}
    </details>`);
  // le titre, ton nom et ton compte existent déjà dans la page : on les range à leur place, avec un intitulé
  const placer = (place, sel, label) => {
    const cible = paneTextes.querySelector(`[data-place="${place}"]`), el = $(sel);
    if (!cible || !el) return;
    const l = document.createElement('label'); l.className = 'vp-champ'; l.innerHTML = `<span>${esc(label)}</span>`;
    l.appendChild(el); cible.replaceWith(l);
  };
  placer('titre', '#f-titre', 'Titre du live');
  placer('hote', '#f-hote', 'Ton nom');
  placer('handle', '#f-handle', 'Ton compte');
  paneTextes.querySelectorAll('input[data-texte]').forEach(inp => {
    const k = inp.dataset.texte;
    inp.value = (brouillon.textes && brouillon.textes[k]) || '';
    inp.oninput = () => {
      const v = inp.value.trim();
      brouillon.textes = Object.assign({}, brouillon.textes);
      if (v) brouillon.textes[k] = inp.value; else delete brouillon.textes[k];
      if (!Object.keys(brouillon.textes).length) delete brouillon.textes;
      apercu();
    };
  });
  // la durée maximale : une seule ligne, l'explication au survol
  const lim = panes.querySelector('#f-limite');   // déjà rangé dans l'étape (pas encore dans la page)
  if (lim) {
    const l = document.createElement('label'); l.className = 'vp-duree';
    l.title = '20 minutes avant la fin, un minuteur rouge apparaît dans ta régie (toi seul le vois). À l\'heure dite, le live passe sur l\'écran de fin.';
    l.innerHTML = '<span class="vp-duree-ic" aria-hidden="true">⏱</span><span>Arrêt automatique</span>';
    lim.replaceWith(l); l.appendChild(lim);
    const o = lim.querySelector('option[value="0"]'); if (o) o.textContent = 'Jamais';
  }
  // « Garder ce style » va avec le thème, pas avec la date : un pli discret en bas de l'étape Thème
  const blocStyle = blocDe('#style-nom'), paneTheme = panes.querySelector(`.vp-pane[data-etape="${iTheme}"]`);
  if (blocStyle && paneTheme) {
    const d = document.createElement('details'); d.className = 'vp-plus vp-style';
    d.innerHTML = '<summary>Garder ce style pour plus tard</summary>';
    blocStyle.querySelector('.bloc-titre')?.remove();
    d.appendChild(blocStyle); paneTheme.appendChild(d);
  }

  // ce qui reste de l'ancienne page (titres d'étapes, plis vides, retour) est caché par la feuille de style
  corps.prepend(tete, nav, panes);
  // les plis « Reprendre mon habillage OBS » et « Mon nom et la durée » : le premier reste un pli, le second s'ouvre à plat
  const obs = $('#opt-obs'); if (obs) obs.open = false;

  /* Le pied : Précédent, Suivant, et Appliquer à la dernière étape */
  const pied = $('.pied-form');
  const prec = document.createElement('button'); prec.type = 'button'; prec.id = 'vp-prec'; prec.textContent = 'Précédent';
  const suiv = document.createElement('button'); suiv.type = 'button'; suiv.id = 'vp-suiv'; suiv.className = 'primaire'; suiv.textContent = 'Suivant';
  const creer = $('#btn-creer');
  $('#btn-annuler').hidden = true;
  pied.prepend(prec); pied.appendChild(suiv); pied.appendChild(creer);

  let cur = 0;
  function aller(i) {
    cur = Math.max(0, Math.min(ETAPES.length - 1, i));
    $$('.vp-pane').forEach(p => { p.hidden = +p.dataset.etape !== cur; });
    $$('.vp-nav button').forEach(b => { const n = +b.dataset.etape; b.classList.toggle('actif', n === cur); b.classList.toggle('fait', n < cur); b.setAttribute('aria-current', n === cur ? 'step' : 'false'); });
    prec.style.visibility = cur === 0 ? 'hidden' : '';
    const dernier = cur === ETAPES.length - 1;
    suiv.hidden = dernier;
    suiv.textContent = dernier ? '' : `Suivant : ${ETAPES[cur + 1].nom}`;
    // on peut finir à n'importe quelle étape : « Terminer » discret, puis le vrai bouton à la dernière
    creer.classList.toggle('primaire', dernier); creer.classList.toggle('vp-terminer', !dernier);
    creer.textContent = dernier ? (nouveau ? 'C\'est parti' : 'Appliquer au live') : 'Terminer';
    creer.title = nouveau ? 'Garder ces choix et aller dans la régie. Tout se change ensuite avec le bouton Visuel.' : 'Garder ces choix pour le live';
    corps.scrollTop = 0;
    try { sessionStorage.setItem('obseb:vpEtape', String(cur)); } catch (e) { /* rien */ }
  }
  $$('.vp-nav button').forEach(b => b.onclick = () => aller(+b.dataset.etape));
  prec.onclick = () => aller(cur - 1);
  suiv.onclick = () => aller(cur + 1);
  tete.querySelector('.vp-fermer').onclick = () => parler({ obsebVisuel: 'fermer' });
  // la régie peut demander une étape précise (ex. clic sur le titre du live → « Titre et date »)
  const demande = ETAPES.findIndex(e => e.id === Q.get('etape'));
  aller(demande >= 0 ? demande : 0);

  // le test du matériel pour les visuels 3D se faisait au clic sur « Nouveau live » : on le fait ici
  if (typeof verifierMateriel3D === 'function') verifierMateriel3D();
  apercu();
})();
