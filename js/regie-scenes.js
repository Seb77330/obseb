/* MESA : régie, scènes et cadrages.
   Les scènes de caméras (« Solo », « Duo », « Plateau », et celles que tu ajoutes) retiennent chacune leur cadrage
   et qui elles montrent : etat.plans = [{ id, nom, layout, qui }], qui = 'tous', un nombre (les N premières personnes
   à l'antenne) ou une liste de personnes. Celles qu'une scène ne montre pas restent à l'antenne : on les entend. */
'use strict';

const MAX_PLANS = 6;
/* Depuis le 19/11 : une seule scène de caméras au départ. Elle montre tout le monde à l'antenne et change de nom
   toute seule (Solo, Duo, À 3, À 4…) : on met les invités à l'antenne d'un clic sur leur carte, la mise en page suit. */
const plansParDefaut = () => [{ id: 'plateau', nom: 'Plateau', layout: 'grille', qui: 'tous' }];
if (!Array.isArray(etat.plans) || !etat.plans.length || !etat.scenesAuto) {
  etat.plans = plansParDefaut();
  etat.plan = 'plateau';
  etat.layout = 'grille';
  etat.scenesAuto = true;
}
etat.plans = etat.plans.filter(p => p && p.id).slice(0, MAX_PLANS).map(p => ({
  id: String(p.id), nom: String(p.nom || 'Scène').slice(0, 18), layout: CADRAGES.includes(p.layout) ? p.layout : 'grille',
  qui: p.qui === 'tous' || (Number.isInteger(p.qui) && p.qui > 0) || Array.isArray(p.qui) ? p.qui : 'tous'
}));
if (etat.scene === 'partage') etat.scene = 'live';   // l'ancienne scène « Partage » : ce qui est partagé s'affiche maintenant dans les scènes de caméras
const planActif = () => etat.plans.find(p => p.id === etat.plan) || etat.plans[0];
if (!etat.plans.some(p => p.id === etat.plan)) etat.plan = etat.plans[0].id;
if (!CADRAGES.includes(etat.layout)) etat.layout = planActif().layout;

/* Qui la scène montre, parmi les personnes à l'antenne (null : tout le monde) */
function visiblesPlan(onair) {
  if (etat.scene !== 'live') return null;
  if (etat.layout === 'solo' && etat.focus && onair.includes(etat.focus)) return [etat.focus];   // « plein cadre » demandé sur une personne
  const p = planActif();
  if (!p || p.qui === 'tous') return null;
  if (typeof p.qui === 'number') return onair.slice(0, p.qui);
  const v = onair.filter(id => p.qui.includes(id));
  return v.length ? v : null;
}
function allerPlan(id, garderMode) {
  const p = etat.plans.find(x => x.id === id);
  if (!p) return;
  if (!garderMode) etat.mode = 'plateau';
  etat.plan = id; etat.focus = null; etat.layout = p.layout;
  changerScene('live');
  if (typeof majModes === 'function') majModes();
  majInfosScene();
}

/* ----- Vignettes : le vrai cadrage, en tout petit ----- */
function vignetteCadrage(layout, n, mur = true) {
  const ids = Array.from({ length: Math.max(1, Math.min(n, 8)) }, (_, i) => 'p' + i);
  const d = dispositionCadrage(layout, ids, null, { x: 0, y: 0, w: 1780, h: 1000 }, { mur });
  const formes = ids.filter(id => d[id]).map((id, i) => {
    const r = d[id], c = i === 0 ? ' class="q"' : r.z ? ' class="m"' : '';
    if (r.pts) return `<polygon${c} points="${r.pts.map(([x, y]) => `${(r.x + x).toFixed(0)},${(r.y + y).toFixed(0)}`).join(' ')}"/>`;
    return `<rect${c} x="${r.x.toFixed(0)}" y="${r.y.toFixed(0)}" width="${r.w.toFixed(0)}" height="${r.h.toFixed(0)}" rx="46"/>`;
  }).join('');
  return `<svg viewBox="-70 -60 1920 1120" aria-hidden="true">${formes}</svg>`;
}
const VIGNETTES = {
  intro: '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="14" y="9" width="36" height="5" rx="1.5"/><rect class="q" x="22" y="18" width="20" height="9" rx="2"/></svg>',
  partage: '<svg viewBox="0 0 64 36" aria-hidden="true"><rect class="q" x="4" y="5" width="40" height="26" rx="2"/><rect x="47" y="5" width="13" height="8" rx="1.5"/><rect x="47" y="14" width="13" height="8" rx="1.5"/><rect x="47" y="23" width="13" height="8" rx="1.5"/></svg>',
  watch: '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="9" y="4" width="22" height="15" rx="1.5"/><rect x="33" y="4" width="22" height="15" rx="1.5"/><rect class="q" x="4" y="23" width="56" height="9" rx="2"/></svg>',
  fin: '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="14" y="10" width="36" height="5" rx="1.5"/><rect x="24" y="18" width="16" height="2.5" rx="1"/><rect class="q" x="20" y="24" width="24" height="4" rx="2"/></svg>'
};
const NOMS_SCENES = { intro: ['Intro', 'Intro : le compte à rebours avant le live'], partage: ['Partage', 'Écran partagé : écran, image, vidéo ou console'], watch: ['Watch', 'Watch Party : le minuteur du film'], fin: ['Outro', 'Outro : l\'écran de fin'] };
const nbAntenne = () => etat.onair.filter(id => id === ID_HOTE || presents.has(id)).length;
const nbPlan = p => p.qui === 'tous' ? Math.max(1, Math.min(nbAntenne(), 8)) : typeof p.qui === 'number' ? p.qui : Math.max(1, p.qui.length);
/* la scène de départ porte le nombre de personnes à l'antenne : Solo, Duo, À 3… */
const nomPlan = p => {
  if (p.id !== 'plateau' || p.qui !== 'tous') return p.nom;
  const n = nbAntenne();
  return n <= 1 ? 'Solo' : n === 2 ? 'Duo' : 'À ' + n;
};
/* Réaction et Jeu sont des scènes : la vidéo (ou le jeu) en grand, ta caméra dans un coin */
const SCENES_MODE = {
  reaction: ['Réaction', 'Réaction : la bande-annonce en grand, ta caméra dans un coin', '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="4" y="4" width="56" height="28" rx="2"/><path class="q" d="M27 11v14l11-7z"/><rect class="q" x="44" y="22" width="13" height="7" rx="1.5"/></svg>'],
  jeu: ['Jeu', 'Jeu : ta console ou ton jeu en grand, ta facecam dans un coin', '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="4" y="4" width="56" height="28" rx="2"/><path class="q" d="M22 14h20a5 5 0 0 1 4.8 3.8l.8 3.5a2 2 0 0 1-3.5 1.7L42 21H22l-2.1 2a2 2 0 0 1-3.5-1.7l.8-3.5A5 5 0 0 1 22 14z"/><rect class="q" x="44" y="6" width="13" height="7" rx="1.5"/></svg>']
};
const modeCourant = () => (etat.mode === 'reaction' || etat.mode === 'jeu') ? etat.mode : 'plateau';
function allerSceneMode(m) {
  etat.mode = m;
  if (m === 'jeu' && !etat.reactionJeu && etat.reaction) { etat.reaction.taille = 'p'; etat.reactionJeu = true; }
  allerPlan(etat.plan || etat.plans[0].id, true);
}

function dessinerScenes() {
  const cle = JSON.stringify([etat.plans, nbAntenne(), etat.introStyle, etat.outroStyle]);
  if (cle !== dessinerScenes.cle) {
    dessinerScenes.cle = cle;
    let i = 0;
    const fixe = s => `<button data-scene="${s}" data-i="${i++}" title="${NOMS_SCENES[s][1]} (touche ${i})"><span class="sc-vue">${VIGNETTES[s]}</span><b${NOMS_SCENES[s][2] ? ` data-court="${NOMS_SCENES[s][2]}"` : ''}>${NOMS_SCENES[s][0]}</b><kbd>${i}</kbd>${s === 'intro' || s === 'fin' ? `<span class="sc-mod" data-hb="${s}" role="button" tabindex="0" title="Changer le visuel de ${s === 'intro' ? 'l\'intro' : 'l\'outro'}">✎</span>` : ''}</button>`;
    const auto = p => p.id === 'plateau' && p.qui === 'tous';
    const plan = p => `<button data-plan="${esc(p.id)}" data-i="${i++}" title="${auto(p) ? 'Les caméras : tout le monde à l\'antenne. Clique sur la carte d\'un invité pour le mettre à l\'antenne, la mise en page suit toute seule' : esc(p.nom) + ' : ' + descriptionPlan(p)} (touche ${i})"><span class="sc-vue">${vignetteCadrage(p.layout, nbPlan(p))}</span><b>${esc(nomPlan(p))}</b><kbd>${i}</kbd>${auto(p) ? '' : '<span class="sc-mod" role="button" tabindex="0" title="Renommer cette scène, choisir qui elle montre, ou la supprimer">✎</span>'}</button>`;
    const sceneMode = m => `<button data-modescene="${m}" data-i="${i++}" title="${SCENES_MODE[m][1]} (touche ${i})"><span class="sc-vue">${SCENES_MODE[m][2]}</span><b>${SCENES_MODE[m][0]}</b><kbd>${i}</kbd></button>`;
    $('#scenes').innerHTML = fixe('intro') + etat.plans.map(plan).join('') + sceneMode('reaction') + sceneMode('jeu') + fixe('watch') + fixe('fin')
      + (etat.plans.length < MAX_PLANS ? '<button class="sc-plus" id="sc-plus" title="Ajouter une scène de caméras : son nom, son cadrage, qui elle montre"><span class="sc-vue">+</span><b>Scène</b></button>' : '');
    $$('#scenes [data-scene]').forEach(b => b.onclick = () => { if (b.dataset.scene === 'watch') etat.mode = 'plateau'; changerScene(b.dataset.scene); if (typeof majModes === 'function') majModes(); majInfosScene(); });
    $$('#scenes [data-modescene]').forEach(b => b.onclick = () => allerSceneMode(b.dataset.modescene));
    $$('#scenes [data-hb]').forEach(m => {
      m.onclick = e => { e.stopPropagation(); ouvrirChoixHabillage(m.dataset.hb); };
      m.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.click(); } };
    });
    $$('#scenes [data-plan]').forEach(b => {
      b.onclick = () => allerPlan(b.dataset.plan);
      const m = b.querySelector('.sc-mod');
      if (!m) return;
      m.onclick = e => { e.stopPropagation(); ouvrirEditionScene(b.dataset.plan, b); };
      m.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.click(); } };
      b.oncontextmenu = e => { e.preventDefault(); ouvrirEditionScene(b.dataset.plan, b); };
    });
    if ($('#sc-plus')) $('#sc-plus').onclick = ajouterScene;
  }
  $$('#scenes [data-scene]').forEach(b => b.classList.toggle('actif', b.dataset.scene === etat.scene));
  $$('#scenes [data-plan]').forEach(b => b.classList.toggle('actif', etat.scene === 'live' && modeCourant() === 'plateau' && b.dataset.plan === etat.plan));
  $$('#scenes [data-modescene]').forEach(b => b.classList.toggle('actif', etat.scene === 'live' && modeCourant() === b.dataset.modescene));
  majInfosScene();
  $$('#cadrages button').forEach(b => b.classList.toggle('actif', b.dataset.layout === etat.layout));
}
/* Sous les scènes : les réglages de celle qui est choisie. Caméras : le cadrage ; Réaction et Jeu : le coin et la taille
   (js/regie-modes.js) ; Intro et Outro : le visuel et le compte à rebours ; Watch : le film. */
function majInfosScene() {
  const box = $('#scene-infos'); if (!box) return;
  const sc = etat.scene;
  const cle = JSON.stringify([sc, etat.introStyle, etat.outroStyle, !!etat.fin]);
  box.hidden = !['intro', 'fin', 'watch'].includes(sc);
  if (box.hidden || cle === majInfosScene.cle) return;
  majInfosScene.cle = cle;
  const nomHb = (scene, id) => { const h = (typeof HABILLAGES !== 'undefined' && HABILLAGES[scene] || []).find(x => x.id === id); return h ? h.nom : 'Classique'; };
  box.innerHTML = sc === 'watch'
    ? '<span class="si-tit">Watch Party</span><button type="button" class="petit" data-si="watch" title="Le minuteur du film, la lecture, l\'habillage">Régler le film</button>'
    : `<span class="si-tit">${sc === 'intro' ? 'Intro' : 'Outro'}</span><button type="button" class="petit" data-si="${sc}" title="Choisir un autre visuel">${esc(nomHb(sc, sc === 'intro' ? etat.introStyle : etat.outroStyle))} · Changer</button>`
      + (sc === 'intro' ? `<span class="si-sep"></span><span class="si-tit">Compte à rebours</span>${[2, 5, 10].map(m => `<button type="button" class="petit" data-si-min="${m}" title="L'intro tourne ${m} minutes">${m} min</button>`).join('')}${etat.fin ? '<button type="button" class="petit" data-si="sans" title="Arrêter le compte à rebours">Aucun</button>' : ''}` : '');
  box.querySelectorAll('[data-si]').forEach(b => b.onclick = () => {
    const q = b.dataset.si;
    if (q === 'watch') ouvrirOnglet('watch');
    else if (q === 'sans') { etat.fin = null; etat.debutCompte = null; envoyer(); majInfosScene(); }
    else if (typeof ouvrirChoixHabillage === 'function') ouvrirChoixHabillage(q);
  });
  box.querySelectorAll('[data-si-min]').forEach(b => b.onclick = () => { const m = +b.dataset.siMin; etat.debutCompte = Date.now(); etat.fin = etat.debutCompte + m * 60000; envoyer(); majInfosScene(); toast(`Compte à rebours : ${m} min`); });
}
function descriptionPlan(p) {
  return p.qui === 'tous' ? 'toutes les personnes à l\'antenne' : typeof p.qui === 'number' ? (p.qui === 1 ? 'la première personne à l\'antenne' : `les ${p.qui} premières personnes à l'antenne`) : `${p.qui.length} personne${p.qui.length > 1 ? 's' : ''} choisie${p.qui.length > 1 ? 's' : ''}`;
}

/* ----- Cadrages ----- */
const LISTE_CADRAGES = [
  ['grille', 'Grille', 'Tout le monde à la même taille', 'G', 3], ['solo', 'Solo', 'Une seule personne, en plein cadre', 'S', 1],
  ['interview', 'Interview', 'Une personne en grand, les autres à côté', 'I', 3], ['vedette', 'Vedette', 'Une personne en grand, les autres en bande dessous', 'V', 4],
  ['incrust', 'Médaillon', 'Une personne en plein cadre, les autres en médaillons posés dessus', 'M', 3], ['duel', 'Duel', 'Deux personnes face à face, séparées par une diagonale', 'D', 2]
];
$('#cadrages').innerHTML = LISTE_CADRAGES.map(([l, nom, aide, t, n]) => `<button data-layout="${l}" title="${aide} (touche ${t})"><span class="sc-vue">${vignetteCadrage(l, n, false)}</span><b>${nom}</b></button>`).join('');
$$('#cadrages button').forEach(b => b.onclick = () => changerLayout(b.dataset.layout));

/* ----- Ajouter, renommer, supprimer une scène ----- */
function ajouterScene() {
  if (etat.plans.length >= MAX_PLANS) return;
  let n = 2; while (etat.plans.some(p => p.nom === 'Scène ' + n)) n++;
  const p = { id: 'p' + rnd(5), nom: 'Scène ' + n, layout: 'vedette', qui: 'tous' };
  etat.plans.push(p);
  allerPlan(p.id);
  ouvrirEditionScene(p.id, $(`#scenes [data-plan="${p.id}"]`), true);
}
let planEdite = null;
function ouvrirEditionScene(id, ancre, nouveau) {
  const p = etat.plans.find(x => x.id === id), box = $('#scene-edit');
  if (!p) return;
  planEdite = p;
  box.hidden = false;
  const r = (ancre || $('#scenes')).getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left)) + 'px';
  box.style.bottom = Math.max(8, innerHeight - r.top + 8) + 'px';
  $('#se-nom').value = p.nom;
  $('#se-suppr').hidden = etat.plans.length < 2;
  majEditionScene();
  if (nouveau) { $('#se-nom').focus(); $('#se-nom').select(); }
}
function fermerEditionScene() { $('#scene-edit').hidden = true; planEdite = null; }
function majEditionScene() {
  const p = planEdite; if (!p) return;
  const mode = p.qui === 'tous' ? 'tous' : typeof p.qui === 'number' ? String(p.qui) : 'choix';
  $$('#se-qui button').forEach(b => b.classList.toggle('actif', b.dataset.q === mode));
  const gens = $('#se-gens');
  gens.hidden = mode !== 'choix';
  if (mode === 'choix') {
    const ids = Object.keys(etat.noms).filter(id => id === ID_HOTE || presents.has(id));
    gens.innerHTML = ids.map(id => `<button data-id="${esc(id)}" class="${p.qui.includes(id) ? 'actif' : ''}">${esc(etat.noms[id] || 'Invité')}</button>`).join('');
    $$('#se-gens button').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      p.qui = p.qui.includes(id) ? p.qui.filter(x => x !== id) : p.qui.concat(id);
      envoyer(); majEditionScene();
    });
  }
  $('#se-aide').textContent = mode === 'choix' ? (p.qui.length ? 'Seules ces personnes sont à l\'image. Les autres restent entendues.' : 'Clique sur les personnes à montrer.')
    : mode === 'tous' ? 'Toutes les personnes à l\'antenne sont à l\'image.' : `${descriptionPlan(p).replace(/^./, c => c.toUpperCase())} : les autres restent entendues.`;
}
$$('#se-qui button').forEach(b => b.onclick = () => {
  if (!planEdite) return;
  const q = b.dataset.q;
  planEdite.qui = q === 'tous' ? 'tous' : q === 'choix' ? (Array.isArray(planEdite.qui) ? planEdite.qui : etat.onair.slice(0, 2)) : +q;
  envoyer(); majEditionScene();
});
$('#se-nom').oninput = e => { if (planEdite) { planEdite.nom = e.target.value.trim().slice(0, 18) || 'Scène'; envoyerBientot(); } };
$('#se-nom').onkeydown = e => { if (e.key === 'Enter') fermerEditionScene(); };
$('#se-ok').onclick = fermerEditionScene;
$('#se-suppr').onclick = () => {
  const p = planEdite; if (!p || etat.plans.length < 2) return;
  etat.plans = etat.plans.filter(x => x !== p);
  if (etat.plan === p.id) { etat.plan = etat.plans[0].id; if (etat.scene === 'live') etat.layout = etat.plans[0].layout; }
  fermerEditionScene(); envoyer();
  toast(`Scène « ${p.nom} » supprimée`);
};
addEventListener('click', e => { if (!e.target.isConnected) return; if (planEdite && !e.target.closest('#scene-edit') && !e.target.closest('.sc-mod') && !e.target.closest('#sc-plus')) fermerEditionScene(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && planEdite) fermerEditionScene(); });

/* ----- Clavier : 1 à 9 pour les scènes (dans l'ordre des boutons), une lettre par cadrage ----- */
addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=radio]), textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const i = '123456789'.indexOf(e.key) >= 0 ? '123456789'.indexOf(e.key) : '&é"\'(-è_ç'.indexOf(e.key);   // la rangée de chiffres d'un clavier français, sans Maj
  if (i >= 0) { const b = $(`#scenes [data-i="${i}"]`); if (b) b.click(); return; }
  const c = LISTE_CADRAGES.find(x => x[3].toLowerCase() === e.key.toLowerCase());
  if (c) changerLayout(c[0]);
});
dessinerScenes();

/* Sur téléphone, si les scènes ne tiennent pas toutes sur la largeur, un fondu au bord montre qu'on peut glisser */
function majDebordScenes() {
  const el = $('#scenes');
  if (el) el.classList.toggle('deborde', el.scrollWidth > el.clientWidth + 2 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
}
addEventListener('resize', majDebordScenes);
$('#scenes').addEventListener('scroll', majDebordScenes, { passive: true });
setInterval(majDebordScenes, 1000);
