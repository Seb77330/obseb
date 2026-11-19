/* MESA : le visuel du live, réglé par étapes dans la régie.
   La régie ouvre cette page dans un panneau sur le côté (index.html?visuel=<salle>&embed=1&panneau=1) :
   l'aperçu de la régie reste visible au centre et change à chaque choix.
   Les étapes suivent l'ordre logique : 1 Thème, 2 Couleurs, 3 Police, 4 Logo et fond, 5 Musiques, 6 Titre et date.
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
    { id: 'titre', nom: 'Titre et date', titre: 'Le titre et la date', aide: 'Le titre s\'affiche dans l\'intro et le bandeau. Programme le live si tu veux prévenir tes invités.',
      els: ['#f-titre', '.quand', '#opt-toi .option-corps', blocDe('#style-nom')] }
  ];

  const corps = $('.creation-choix .choix-corps');
  const tete = document.createElement('div');
  tete.className = 'vp-tete';
  tete.innerHTML = `<h1>Visuel du live</h1><button type="button" class="vp-fermer" title="Fermer sans rien changer" aria-label="Fermer sans rien changer">✕</button>`;
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
  // ce qui reste de l'ancienne page (titres d'étapes, plis vides, retour) est caché par la feuille de style
  corps.prepend(tete, nav, panes);
  // les plis « Reprendre mon habillage OBS » et « Mon nom et la durée » : le premier reste un pli, le second s'ouvre à plat
  const obs = $('#opt-obs'); if (obs) obs.open = false;
  const toi = $('#opt-toi .option-corps'); if (toi) toi.classList.add('vp-a-plat');

  /* Le pied : Précédent, Suivant, et Appliquer à la dernière étape */
  const pied = $('.pied-form');
  const prec = document.createElement('button'); prec.type = 'button'; prec.id = 'vp-prec'; prec.textContent = 'Précédent';
  const suiv = document.createElement('button'); suiv.type = 'button'; suiv.id = 'vp-suiv'; suiv.className = 'primaire'; suiv.textContent = 'Suivant';
  const creer = $('#btn-creer'); creer.textContent = 'Appliquer au live';
  $('#btn-annuler').hidden = true;
  pied.prepend(prec); pied.appendChild(suiv); pied.appendChild(creer);

  let cur = 0;
  function aller(i) {
    cur = Math.max(0, Math.min(ETAPES.length - 1, i));
    $$('.vp-pane').forEach(p => { p.hidden = +p.dataset.etape !== cur; });
    $$('.vp-nav button').forEach(b => { const n = +b.dataset.etape; b.classList.toggle('actif', n === cur); b.classList.toggle('fait', n < cur); b.setAttribute('aria-current', n === cur ? 'step' : 'false'); });
    prec.style.visibility = cur === 0 ? 'hidden' : '';
    const dernier = cur === ETAPES.length - 1;
    suiv.hidden = dernier; creer.hidden = !dernier;
    suiv.textContent = dernier ? '' : `Suivant : ${ETAPES[cur + 1].nom}`;
    corps.scrollTop = 0;
    if (ETAPES[cur].id === 'titre') setTimeout(() => { const t = $('#f-titre'); if (t && !t.value.trim()) t.focus(); }, 50);
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
