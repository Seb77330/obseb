/* OBSeb : les visuels de l'intro et de l'outro (motion design en CSS, aux couleurs du thème).
   Partagé par la régie (liste, noms, formules) et par la sortie (ce qui passe à l'écran).
   Chaque visuel tourne en boucle ; le compte à rebours, lui, vient de la régie (etat.fin, etat.debutCompte).
   L'ordre compte : la formule Gratuite a le premier, Essentiel les 3 premiers, Pro les 8. */
'use strict';

const HABILLAGES = {
  intro: [
    { id: 'classique', nom: 'Classique', desc: 'Le titre au centre, le compte à rebours en dessous' },
    { id: 'pellicule', nom: 'Pellicule', desc: 'Bandes de film qui défilent, amorce de projection qui tourne' },
    { id: 'neon', nom: 'Néon', desc: 'Sol en grille qui file vers toi, soleil couchant, titre lumineux' },
    { id: 'orbite', nom: 'Orbite', desc: 'Anneaux qui tournent, le temps restant se vide autour du chiffre' },
    { id: 'typo', nom: 'Typo', desc: 'Ton titre en géant qui défile, le chiffre posé dans un bloc' },
    { id: 'aurore', nom: 'Aurore', desc: 'Lumières douces qui dérivent, carte claire et fine' },
    { id: 'mosaique', nom: 'Mosaïque', desc: 'Un mur de carrés qui s\'allume par vagues' },
    { id: 'premiere', nom: 'Avant-première', desc: 'Projecteurs qui balaient, poussière dans la lumière' },
    { id: 'bandeannonce', nom: 'Bande-annonce', desc: 'En 3D : faisceaux dans la brume, reflet d\'objectif, titre en métal', d3: 'a' },
    { id: 'plateau', nom: 'Plateau TV', desc: 'En 3D : studio avec mur LED et sol qui brille, ouverture en lames', d3: 'b' },
    { id: 'motion', nom: 'Motion', desc: 'En 3D : gouttes de métal liquide derrière une carte en verre', d3: 'c' }
  ],
  fin: [
    { id: 'classique', nom: 'Classique', desc: 'Merci, le titre et ton compte' },
    { id: 'generique', nom: 'Générique', desc: 'Le générique qui monte, avec le nom de chaque invité' },
    { id: 'neon', nom: 'Néon', desc: 'Une enseigne MERCI qui s\'allume, le soleil se couche' },
    { id: 'iris', nom: 'Iris', desc: 'Le cercle de fin des vieux films, qui se referme' },
    { id: 'typo', nom: 'Typo', desc: 'MERCI en géant qui défile, ton compte dans un bloc' },
    { id: 'aurore', nom: 'Aurore', desc: 'Lumières douces, À bientôt écrit en fin' },
    { id: 'mosaique', nom: 'Mosaïque', desc: 'Les carrés s\'éteignent un à un autour du merci' },
    { id: 'rideau', nom: 'Rideau', desc: 'Le rideau rouge se ferme, un projecteur sur le merci' },
    { id: 'bandeannonce', nom: 'Bande-annonce', desc: 'En 3D : faisceaux dans la brume, générique en métal', d3: 'a' },
    { id: 'plateau', nom: 'Plateau TV', desc: 'En 3D : studio avec mur LED, MERCI géant, ouverture en lames', d3: 'b' },
    { id: 'motion', nom: 'Motion', desc: 'En 3D : gouttes de métal liquide, À très vite sur verre', d3: 'c' }
  ]
};
/* Nombre de visuels par formule (le même pour l'intro et l'outro).
   Les 3 derniers sont en 3D : réservés à la Pro (ouverts à tous pendant la bêta). */
const HABILLAGES_FORMULE = { gratuit: 1, essentiel: 3, pro: 11, regie: 11, entreprise: 11, beta: 11 };
const NOMS_FORMULES_HB = { 1: 'Gratuit', 3: 'Essentiel', 8: 'Pro' };
function nbHabillages() {
  const f = typeof formuleActuelle === 'function' ? formuleActuelle() : 'beta';
  return HABILLAGES_FORMULE[f] || 1;
}
/* La formule qu'il faut pour le visuel numéro i (à partir de 0) */
function formulePourHabillage(i) { return i < 1 ? 'Gratuit' : i < 3 ? 'Essentiel' : 'Pro'; }
/* Visuel en 3D (calculé par la carte graphique) ? Renvoie la lettre du fond (a, b, c) ou '' */
function habillage3D(scene, id) { const h = HABILLAGES[scene].find(x => x.id === id); return (h && h.d3) || ''; }
function habillageAutorise(scene, id) {
  const i = HABILLAGES[scene].findIndex(h => h.id === id);
  if (i >= 0 && HABILLAGES[scene][i].d3 && typeof fonds3dDispo === 'function' && !fonds3dDispo()) return false;
  return i >= 0 && i < nbHabillages();
}
/* Le visuel à montrer : celui choisi s'il existe, sinon le classique */
function habillageDe(scene, id) { return HABILLAGES[scene].some(h => h.id === id) ? id : 'classique'; }

/* ----- Sortie : décor de chaque visuel (le texte, lui, reste celui de la page) ----- */
function decorHabillage(scene, id, ctx) {
  const e = s => (typeof esc === 'function' ? esc(s) : String(s));
  const titre = e(ctx.titre || ''), v = !!ctx.vertical;
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const bande = cls => `<div class="hb-bande ${cls}"><div class="hb-film">${rep(2, () => `<div class="hb-cases">${rep(12, () => '<i></i>')}</div>`)}</div></div>`;
  const carres = () => {
    const col = v ? 9 : 16, lig = v ? 16 : 9;
    // intro : une vague en diagonale ; outro : les carrés s'éteignent du bord vers le centre
    const d = i => { const x = i % col, y = Math.floor(i / col); return scene === 'fin' ? -Math.hypot(x - (col - 1) / 2, y - (lig - 1) / 2) * 0.35 : (x + y) * 0.09; };
    return `<div class="hb-carres" style="--col:${col};--lig:${lig}">${rep(col * lig, i => `<i style="--d:${d(i).toFixed(2)}s"></i>`)}</div>`;
  };
  const poussiere = n => rep(n, i => {
    const r = (k) => ((Math.sin((i + 1) * k) + 1) / 2);      // toujours les mêmes positions, d'une page à l'autre
    return `<i style="left:${(r(12.9898) * 100).toFixed(1)}%;top:${(r(78.233) * 100).toFixed(1)}%;--t:${(8 + r(3.7) * 10).toFixed(1)}s;--d:-${(r(5.1) * 12).toFixed(1)}s;--s:${(2 + r(9.3) * 5).toFixed(1)}px"></i>`;
  });
  const lignes = (texte, n) => rep(n, i => `<div class="hb-ligne" style="--i:${i}"><span>${rep(4, () => `${texte}<em>✦</em>`)}</span><span aria-hidden="true">${rep(4, () => `${texte}<em>✦</em>`)}</span></div>`);
  const D = {
    intro: {
      classique: '',
      pellicule: `${bande('haut')}${bande('bas')}<div class="hb-grain"></div>`,
      neon: `<div class="hb-ciel"></div><div class="hb-soleil"></div><div class="hb-sol"><div class="hb-grille"></div></div>`,
      orbite: `<div class="hb-etoiles">${poussiere(60)}</div>`,
      typo: `<div class="hb-lignes">${lignes(titre || 'LIVE', v ? 9 : 6)}</div>`,
      aurore: `<div class="hb-lueurs"><b></b><b></b><b></b><b></b></div>`,
      mosaique: carres(),
      premiere: `<div class="hb-faisceaux"><b></b><b></b><b></b></div><div class="hb-poussiere">${poussiere(46)}</div><div class="hb-sol-lum"></div>`,
      bandeannonce: `<canvas class="hb-3d"></canvas><div class="hb-cache h"></div><div class="hb-cache b"></div>`,
      plateau: `<canvas class="hb-3d"></canvas><div class="hb-lames"><b></b><b></b><b></b></div>`,
      motion: `<canvas class="hb-3d"></canvas><div class="hb-verre"></div>`
    },
    fin: {
      classique: '',
      generique: `${bande('gauche')}${bande('droite')}<div class="hb-grain"></div>`,
      neon: `<div class="hb-ciel"></div><div class="hb-soleil"></div><div class="hb-sol"><div class="hb-grille"></div></div>`,
      iris: `<div class="hb-iris"></div>`,
      typo: `<div class="hb-lignes">${lignes('MERCI', v ? 9 : 6)}</div>`,
      aurore: `<div class="hb-lueurs"><b></b><b></b><b></b><b></b></div>`,
      mosaique: carres(),
      rideau: `<div class="hb-rideau g"></div><div class="hb-rideau d"></div><div class="hb-lambrequin"></div><div class="hb-spot"></div>`,
      bandeannonce: `<canvas class="hb-3d"></canvas><div class="hb-cache h"></div><div class="hb-cache b"></div>`,
      plateau: `<canvas class="hb-3d"></canvas><div class="hb-lames"><b></b><b></b><b></b></div>`,
      motion: `<canvas class="hb-3d"></canvas><div class="hb-verre"></div>`
    }
  };
  return D[scene][id] || '';
}

/* Pièces ajoutées au texte selon le visuel (anneau du temps, amorce, générique…) */
function piecesHabillage(scene, id, ctx) {
  const e = s => (typeof esc === 'function' ? esc(s) : String(s));
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  if (scene === 'intro' && id === 'orbite') return `<svg class="hb-anneaux" viewBox="0 0 600 600" aria-hidden="true">
      <circle class="a1" cx="300" cy="300" r="290"/><circle class="a2" cx="300" cy="300" r="262"/>
      <circle class="a3" cx="300" cy="300" r="236"/><circle class="reste" cx="300" cy="300" r="214" pathLength="1000"/>
      <g class="a4"><circle cx="300" cy="10" r="9"/></g></svg>`;
  if (scene === 'intro' && id === 'pellicule') return `<div class="hb-amorce" aria-hidden="true"><svg viewBox="0 0 600 600"><circle cx="300" cy="300" r="280"/><circle cx="300" cy="300" r="236"/><path d="M300 0v600M0 300h600"/></svg><div class="hb-balayage"></div></div>`;
  if (scene === 'intro' && id === 'plateau') {
    const fil = [ctx.titre, ctx.hote ? `Avec ${ctx.hote}` : '', ctx.handle].filter(Boolean).map(t => `<span>${e(t)}</span>`).join('');
    return `<div class="hb-bandeau" aria-hidden="true"><b>À SUIVRE</b><div class="hb-fil"><div>${fil}${fil}${fil}${fil}</div></div></div>`;
  }
  if (scene === 'fin' && id === 'plateau') return `<div class="hb-bandeau" aria-hidden="true"><b>ABONNE-TOI</b><div class="hb-fil"><div>${rep(8, () => `<span>${e(ctx.handle || '')}</span>`)}</div></div></div>`;
  if (scene === 'fin' && id === 'generique') {
    const autres = (ctx.invites || []).filter(n => n && n !== ctx.hote);
    const bloc = `<div class="hb-g-bloc">
      <div class="hb-g-sur">Merci d'avoir regardé</div>
      <div class="hb-g-titre">${e(ctx.titre || '')}</div>
      <div class="hb-g-role">Présenté par</div><div class="hb-g-nom">${e(ctx.hote || '')}</div>
      ${autres.length ? `<div class="hb-g-role">Avec</div>${autres.map(n => `<div class="hb-g-nom">${e(n)}</div>`).join('')}` : ''}
      <div class="hb-g-role">Retrouve-nous</div><div class="hb-g-nom accent">${e(ctx.handle || '')}</div>
      <div class="hb-g-fin">À très vite</div></div>`;
    return `<div class="hb-generique" aria-hidden="true"><div class="hb-g-piste" style="--n:${autres.length}">${bloc}${bloc}</div></div>`;
  }
  return '';
}

/* Pose le visuel sur une section (#intro ou #fin) ; ne refait rien si rien n'a changé */
function poserHabillage(section, scene, id, ctx) {
  if (!section) return;
  id = habillageDe(scene, id);
  const cle = JSON.stringify([id, ctx.titre, ctx.hote, ctx.handle, ctx.invites, ctx.vertical]);
  if (section.dataset.hbCle === cle) return;
  const change = section.dataset.style !== id;
  section.dataset.hbCle = cle;
  section.dataset.style = id;
  section.querySelectorAll('.hb-fond, .hb-piece').forEach(x => x.remove());
  if (id === 'classique') return;
  section.insertAdjacentHTML('afterbegin', `<div class="hb-fond" aria-hidden="true">${decorHabillage(scene, id, ctx)}</div>`);
  const p = piecesHabillage(scene, id, ctx);
  if (p) section.insertAdjacentHTML('beforeend', `<div class="hb-piece">${p}</div>`);
  // le générique défile à vitesse constante, quelle que soit sa longueur
  const piste = section.querySelector('.hb-g-piste');
  if (piste) piste.style.animationDuration = Math.max(20, piste.offsetHeight / 2 / 85).toFixed(1) + 's';
  // visuels 3D : la carte graphique dessine le fond ; sinon le dégradé CSS de repli reste affiché
  const cv = section.querySelector('canvas.hb-3d');
  if (cv) {
    const d3 = habillage3D(scene, id);
    const ok = typeof lancerFond3D === 'function' && lancerFond3D(cv, d3, 1);
    section.classList.toggle('hb-sans-3d', !ok);
  }
  if (change) rejouerEntree(section);
}
function rejouerEntree(section) { section.classList.remove('hb-entree'); void section.offsetWidth; section.classList.add('hb-entree'); }

/* ----- Régie : petites vignettes de chaque visuel (dessin simple, aux couleurs du thème) ----- */
const VIGNETTES_HB = {
  classique: '<rect class="t" x="18" y="12" width="28" height="4" rx="1"/><rect class="a" x="24" y="21" width="16" height="6" rx="1.5"/>',
  pellicule: '<rect class="f" x="0" y="0" width="64" height="6"/><rect class="f" x="0" y="30" width="64" height="6"/><circle class="l" cx="44" cy="18" r="9"/><path class="l" d="M44 9v18M35 18h18"/><rect class="t" x="8" y="14" width="18" height="3" rx="1"/><rect class="t" x="8" y="19" width="12" height="2" rx="1"/>',
  neon: '<circle class="a" cx="32" cy="17" r="8"/><path class="l" d="M0 22h64M8 36l14-14M24 36l5-14M40 36l-5-14M56 36L42 22"/><rect class="t" x="20" y="6" width="24" height="3" rx="1"/>',
  orbite: '<circle class="l" cx="32" cy="18" r="13"/><circle class="l d" cx="32" cy="18" r="10"/><path class="a s" d="M32 6a12 12 0 0 1 12 12"/><rect class="t" x="26" y="16" width="12" height="4" rx="1"/>',
  typo: '<rect class="f" x="-4" y="4" width="40" height="5" rx="1"/><rect class="f" x="20" y="13" width="48" height="5" rx="1"/><rect class="f" x="-6" y="22" width="44" height="5" rx="1"/><rect class="a" x="22" y="12" width="20" height="12" rx="1" transform="rotate(-4 32 18)"/>',
  aurore: '<circle class="a b" cx="16" cy="12" r="12"/><circle class="t b" cx="50" cy="26" r="12"/><rect class="v" x="16" y="10" width="32" height="16" rx="3"/>',
  mosaique: '<g class="m"><rect x="2" y="2" width="8" height="8"/><rect x="12" y="2" width="8" height="8" class="a"/><rect x="22" y="2" width="8" height="8"/><rect x="32" y="2" width="8" height="8"/><rect x="42" y="2" width="8" height="8" class="a"/><rect x="52" y="2" width="8" height="8"/><rect x="2" y="12" width="8" height="8" class="a"/><rect x="52" y="12" width="8" height="8"/><rect x="2" y="22" width="8" height="8"/><rect x="12" y="22" width="8" height="8"/><rect x="22" y="22" width="8" height="8" class="a"/><rect x="32" y="22" width="8" height="8"/><rect x="42" y="22" width="8" height="8"/><rect x="52" y="22" width="8" height="8" class="a"/></g><rect class="t" x="14" y="13" width="36" height="6" rx="1"/>',
  premiere: '<path class="a b" d="M6 36L20 0h6zM58 36L44 0h-6z"/><rect class="t" x="20" y="14" width="24" height="4" rx="1"/><rect class="a" x="26" y="21" width="12" height="4" rx="1"/>',
  generique: '<rect class="f" x="0" y="0" width="6" height="36"/><rect class="f" x="58" y="0" width="6" height="36"/><rect class="t" x="22" y="4" width="20" height="2" rx="1"/><rect class="t" x="18" y="10" width="28" height="4" rx="1"/><rect class="t" x="25" y="18" width="14" height="2" rx="1"/><rect class="a" x="22" y="23" width="20" height="2" rx="1"/><rect class="t" x="25" y="29" width="14" height="2" rx="1"/>',
  iris: '<path class="n" d="M0 0h64v36H0zM32 6a12 12 0 1 0 0.1 0z" fill-rule="evenodd"/><circle class="l" cx="32" cy="18" r="12"/><rect class="t" x="24" y="16" width="16" height="4" rx="1"/>',
  bandeannonce: '<rect class="n" x="0" y="0" width="64" height="5"/><rect class="n" x="0" y="31" width="64" height="5"/><path class="a b" d="M10 5L18 31h6zM54 5L46 31h-6z"/><path class="l" d="M4 17h56"/><rect class="t" x="20" y="14" width="24" height="5" rx="1"/>',
  plateau: '<path class="f" d="M0 24L64 24L64 36L0 36z"/><path class="l" d="M0 30h64M12 24L4 36M32 24v12M52 24l8 12"/><rect class="v" x="6" y="6" width="34" height="14" rx="1"/><circle class="a s" cx="51" cy="13" r="7"/><rect class="t" x="9" y="9" width="22" height="4" rx="1"/>',
  motion: '<circle class="a b" cx="14" cy="10" r="9"/><circle class="t b" cx="52" cy="27" r="8"/><circle class="a" cx="46" cy="9" r="5"/><rect class="v" x="14" y="11" width="36" height="16" rx="5"/><rect class="t" x="19" y="16" width="20" height="4" rx="1"/>',
  rideau: '<path class="r" d="M0 0h28c-3 12 -1 24 -6 36H0z"/><path class="r" d="M64 0H36c3 12 1 24 6 36h22z"/><rect class="r" x="0" y="0" width="64" height="5"/><ellipse class="a b" cx="32" cy="30" rx="12" ry="3"/><rect class="t" x="25" y="16" width="14" height="4" rx="1"/>'
};
function vignetteHabillage(id) {
  return `<svg viewBox="0 0 64 36" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${VIGNETTES_HB[id] || VIGNETTES_HB.classique}</svg>`;
}
