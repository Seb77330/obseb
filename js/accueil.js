/* MESA : accueil (sessions et thèmes) */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const CLE = 'studioSeb:sessions';

function lire() { try { return JSON.parse(localStorage.getItem(CLE) || '[]'); } catch (e) { return []; } }
function ecrire(l) { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch (e) { toast('Impossible d\'enregistrer sur ce navigateur'); } }
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('vu');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('vu'), 2200);
}
async function copier(txt, msg) {
  try { await navigator.clipboard.writeText(txt); toast(msg); } catch (e) { prompt('Copie ce lien :', txt); }
}

/* Une régie ouverte depuis un autre PC : on l'ajoute à la liste */
(function importerDepuisLien() {
  const s = lireSession(), k = hashParams().get('k');
  if (!s || !k) return;
  const l = lire();
  if (!l.some(x => x.session.room === s.room)) { l.unshift({ session: s, cle: k }); ecrire(l); }
  history.replaceState(null, '', location.pathname);
})();


/* ----- Formulaire ----- */
let enEdition = null;            // room de la session modifiée, sinon null
let brouillon = nouvelleSession('', 'minimal');
let modeApercu = 'live';      // le moment montré : intro, live, live6, quiz, fin
let formatApercu = 'deux';    // deux (horizontal et vertical côte à côte), h, v

/* Galerie : une carte par thème, avec une vraie image de son intro (le plateau au survol) */
function carteTheme(id) {
  const t = THEMES[id];
  const b = document.createElement('button');
  b.className = 'theme-carte'; b.dataset.preset = id; b.type = 'button';
  const nom = t.nom.replace(/\s*\(.*\)$/, ''), desc = t.desc || (t.nom.match(/\((.*)\)/) || [, ''])[1];
  b.innerHTML = `<span class="theme-img"><img src="img/themes/${id}-intro.webp" alt="" loading="lazy"><img class="alt" src="img/themes/${id}-live.webp" alt="" loading="lazy"></span>
    <span class="theme-txt"><b>${esc(nom)}</b><small>${esc(desc.charAt(0).toUpperCase() + desc.slice(1))}</small></span>`;
  b.onclick = () => { brouillon.theme = { preset: id }; remplirForm(); apercu(); };
  return b;
}
/* Les thèmes rangés par catégorie (common.js : CATEGORIES_THEMES), un onglet par catégorie */
CATEGORIES_THEMES.forEach(c => c.themes.filter(id => THEMES[id]).forEach(id => { const k = carteTheme(id); k.dataset.cat = c.id; $('#galerie').appendChild(k); }));
Object.keys(THEMES).filter(id => !$(`#galerie .theme-carte[data-preset="${id}"]`)).forEach(id => { const k = carteTheme(id); k.dataset.cat = 'essentiels'; $('#galerie').appendChild(k); });
CATEGORIES_THEMES.forEach(c => $('#cats-themes').insertAdjacentHTML('beforeend',
  `<button type="button" role="tab" data-cat="${c.id}">${esc(c.nom)}<small>${$$(`#galerie .theme-carte[data-cat="${c.id}"]`).length}</small></button>`));
$('#cats-themes').insertAdjacentHTML('beforeend', `<button type="button" role="tab" data-cat="tous">Tous<small>${Object.keys(THEMES).length}</small></button>`);
function choisirCategorie(cat) {
  $$('#cats-themes button').forEach(b => b.setAttribute('aria-selected', b.dataset.cat === cat ? 'true' : 'false'));
  $$('#galerie .theme-carte').forEach(k => { k.hidden = cat !== 'tous' && k.dataset.cat !== cat; });
}
$$('#cats-themes button').forEach(b => { b.onclick = () => choisirCategorie(b.dataset.cat); });
choisirCategorie('essentiels');
FONTS.forEach(f => $('#f-font').insertAdjacentHTML('beforeend', `<option>${esc(f)}</option>`));

function remplirForm() {
  const t = themeComplet(brouillon);
  $('#f-titre').value = brouillon.titre;
  $('#f-accent').value = t.accent; $('#f-bg').value = t.bg; $('#f-bg2').value = t.bg2; $('#f-text').value = t.text;
  $('#f-font').value = t.fontTitle; $('#f-image').value = t.bgImage || ''; $('#f-logo').value = t.logo || '';
  $('#f-logotexte').value = t.logoTexte || '';
  $('#f-mintro').value = t.musiqueIntro || ''; $('#f-mfin').value = t.musiqueFin || '';
  $('#f-hote').value = brouillon.hote; $('#f-handle').value = brouillon.handle;
  $('#f-limite').value = String(brouillon.limite || 0);
  if (typeof majQuand === 'function') majQuand();
  const perso = Object.keys(brouillon.theme).some(k => k !== 'preset');
  const carteActive = $(`#galerie .theme-carte[data-preset="${brouillon.theme.preset}"]`);
  if (carteActive && carteActive.hidden) choisirCategorie(carteActive.dataset.cat);
  const styleActif = typeof styleCorrespondant === 'function' ? styleCorrespondant(brouillon.theme) : null;
  $$('.theme-carte').forEach(b => b.classList.toggle('actif', styleActif ? b.dataset.style === styleActif.id : (!b.dataset.style && b.dataset.preset === brouillon.theme.preset)));
  if (perso) $('#opt-perso').open = true;
}
function surcharge(champ, valeur) {
  const base = THEMES[brouillon.theme.preset] || THEMES.minimal;
  if (!valeur || valeur === base[champ]) delete brouillon.theme[champ]; else brouillon.theme[champ] = valeur;
  apercu();
}
$('#f-titre').oninput = e => { brouillon.titre = e.target.value; apercu(); };
$('#f-accent').oninput = e => surcharge('accent', e.target.value);
$('#f-bg').oninput = e => surcharge('bg', e.target.value);
$('#f-bg2').oninput = e => surcharge('bg2', e.target.value);
$('#f-text').oninput = e => surcharge('text', e.target.value);
$('#f-font').onchange = e => surcharge('fontTitle', e.target.value);
$('#f-image').onchange = e => surcharge('bgImage', e.target.value.trim());
$('#f-logo').onchange = e => surcharge('logo', e.target.value.trim());
$('#f-mintro').onchange = e => surcharge('musiqueIntro', e.target.value.trim());
$('#f-mfin').onchange = e => surcharge('musiqueFin', e.target.value.trim());
$('#f-logotexte').oninput = e => surcharge('logoTexte', e.target.value.trim());
$('#f-hote').oninput = e => { brouillon.hote = e.target.value.trim() ? e.target.value : ''; retenirIdentite('hote', brouillon.hote); apercu(); };
$('#f-handle').oninput = e => { brouillon.handle = e.target.value.trim() ? e.target.value : ''; retenirIdentite('handle', brouillon.handle); apercu(); };
$('#f-limite').onchange = e => { brouillon.limite = +e.target.value || 0; };
$$('[data-apercu]').forEach(b => b.onclick = () => {
  modeApercu = b.dataset.apercu;
  $$('[data-apercu]').forEach(x => x.classList.toggle('actif', x === b));
  apercu();
});

/* Les deux formats se voient en même temps, pour chaque moment du live (l'intro et la fin existent aussi en vertical) */
$$('[data-format]').forEach(b => b.onclick = () => {
  formatApercu = b.dataset.format;
  try { localStorage.setItem('studioSeb:apercuFormat', formatApercu); } catch (e) { /* rien */ }
  majFormatApercu(); apercu();
});
function majFormatApercu() {
  $$('[data-format]').forEach(x => x.classList.toggle('actif', x.dataset.format === formatApercu));
  $('#apercu-scene').dataset.format = formatApercu;
  taillerApercu();
}
/* Les écrans prennent toute la place disponible, sans jamais déborder */
function taillerApercu() {
  const sc = $('#apercu-scene');
  const W = sc.clientWidth, H = sc.clientHeight - 58;      // la légende sous l'écran : le format et les plateformes
  if (W <= 0 || H <= 0) return;
  const gap = parseFloat(getComputedStyle(sc).columnGap) || 20;
  const h = formatApercu === 'deux' ? (W - gap) / (16 / 9 + 9 / 16) : formatApercu === 'h' ? W / (16 / 9) : W / (9 / 16);
  sc.style.setProperty('--h', Math.max(80, Math.floor(Math.min(H, h))) + 'px');
}
new ResizeObserver(taillerApercu).observe($('#apercu-scene'));

function urlApercu(s, mode, vertical) {
  const p = { intro: 'demo=3&scene=intro', live: 'demo=3', live6: 'demo=6', quiz: 'demo=3&quiz=1', fin: 'demo=3&scene=fin' }[mode] || 'demo=3';
  return `sortie.html?${p}${vertical ? '&format=vertical' : ''}#s=${b64e(Object.assign({}, s, { titre: s.titre || 'Titre de ton live' }))}`;
}
function apercu() {
  clearTimeout(apercu.t);
  if ($('#vue-creation').hidden) return;
  apercu.t = setTimeout(() => {
    taillerApercu();
    const n = ++apercu.n;
    if (formatApercu !== 'v') $('#apercu-h').src = urlApercu(brouillon, modeApercu, false).replace('?', `?n=${n}&`);
    if (formatApercu !== 'h') $('#apercu-v').src = urlApercu(brouillon, modeApercu, true).replace('?', `?n=${n}&`);
  }, 200);
}
try { const f = localStorage.getItem('studioSeb:apercuFormat'); if (['deux', 'h', 'v'].includes(f)) formatApercu = f; } catch (e) { /* rien */ }
apercu.n = 0;

/* ----- Deux vues : la liste de mes lives, et la création ----- */
function montrerVue(v, pousser = true) {
  $('#vue-liste').hidden = v !== 'liste'; $('#vue-creation').hidden = v !== 'creation';
  $('#btn-nouveau').hidden = v === 'creation';
  document.body.classList.toggle('en-creation', v === 'creation');
  if (pousser) history.pushState(null, '', v === 'creation' ? '#nouveau' : location.pathname);
  scrollTo(0, 0);
  if (v === 'creation') { majFormatApercu(); apercu(); if (!enEdition) setTimeout(() => $('#f-titre').focus(), 50); }
}
function ouvrirCreation(titre, bouton, modif) {
  $('#titre-form').textContent = titre; $('#btn-creer').textContent = bouton; $('#note-modif').hidden = !modif;
  $$('.option').forEach(d => { d.open = false; });
  remplirForm(); montrerVue('creation');
}
addEventListener('popstate', () => montrerVue(location.hash === '#nouveau' ? 'creation' : 'liste', false));
/* Test du matériel : la carte graphique peut-elle faire tourner les visuels 3D sans saccades ? (refait au plus une fois par semaine) */
function verifierMateriel3D() {
  const el = $('#materiel-3d');
  const montrer = r => {
    el.hidden = false; el.classList.toggle('juste', !r.ok);
    el.textContent = r.ok ? 'Ton ordinateur fait tourner les intros et outros en 3D (Bande-annonce, Plateau TV, Motion).'
      : enBeta() ? 'Ton ordinateur est un peu juste pour les intros et outros en 3D : elles restent disponibles pendant la bêta, mais peuvent saccader.'
      : 'Ton ordinateur est un peu juste pour les intros et outros en 3D : on les a masquées pour que ton live reste fluide. Tous les autres visuels restent là.';
  };
  const r = resultatMateriel3D();
  if (r && Date.now() - (r.quand || 0) < 7 * 864e5) return montrer(r);
  el.hidden = false; el.classList.remove('juste'); el.textContent = 'Petit test de ton ordinateur pour les visuels 3D…';
  setTimeout(() => testerMateriel3D().then(montrer), 400);
}
$('#btn-nouveau').addEventListener('click', verifierMateriel3D);
$('#btn-nouveau').onclick = () => { enEdition = null; brouillon = nouvelleSession('', 'minimal'); if (typeof appliquerStyleDefaut === 'function') appliquerStyleDefaut(brouillon); ouvrirCreation('Nouveau live', 'Créer le live', false); };

$('#btn-creer').onclick = async () => {
  if (!brouillon.titre.trim()) { $('#f-titre').focus(); return toast('Donne un titre à ton live'); }
  if (brouillon.debut && brouillon.debut < Date.now() && !enEdition) return toast('L\'heure choisie est déjà passée');
  const programme = brouillon.debut && brouillon.debut > Date.now() ? brouillon.debut : 0;
  const l = lire();
  if (enEdition) {
    const i = l.findIndex(x => x.session.room === enEdition);
    if (i >= 0) l[i].session = brouillon;
    toast('Live modifié');
  } else {
    const cle = rnd(20);                         // 100 bits : impossible à deviner
    brouillon.room = await salleDepuisCle(cle);  // la salle est liée à cette clé (voir common.js)
    l.unshift({ session: brouillon, cle });
    toast(programme ? `Live programmé : ${quandTexte(programme)}` : 'Live créé : clique sur « Ouvrir la régie »');
  }
  ecrire(l);
  annuler();
};
function annuler() {
  enEdition = null;
  brouillon = nouvelleSession('', 'minimal');
  afficherSessions(); afficherLives();
  montrerVue('liste');
}
$('#btn-annuler').onclick = annuler;
$('#btn-retour').onclick = annuler;

/* ----- Liste des sessions ----- */
function afficherSessions() {
  const box = $('#sessions');
  box.innerHTML = '';
  const l = lire();
  $('#bloc-lives').hidden = !l.length; $('#bloc-vide').hidden = !!l.length;
  majBonjour(l);
  // la première case : créer un live (le même que le bouton du haut)
  if (l.length) {
    const n = document.createElement('button');
    n.type = 'button'; n.className = 'session-nouveau';
    n.innerHTML = '<span class="sn-plus" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><b>Nouveau live</b><small>Un clic, et tu es dans la régie</small>';
    n.onclick = () => $('#btn-nouveau').click();
    box.appendChild(n);
  }
  // les lives programmés d'abord, le plus proche en premier ; les autres gardent leur ordre
  const proche = s => (s.debut && s.debut > Date.now() - 6 * 3600e3 ? s.debut : Infinity);
  l.map((x, i) => [x, i]).sort((a, b) => (proche(a[0].session) - proche(b[0].session)) || (a[1] - b[1])).forEach(([{ session, cle }]) => {
    const L = liens(session, cle);
    const t = themeComplet(session);
    const el = document.createElement('div');
    el.className = 'session'; el.dataset.room = session.room;
    if (/^#[0-9a-f]{3,8}$/i.test(t.accent || '')) el.style.setProperty('--c', t.accent);
    const prog = session.debut && session.debut > Date.now();
    el.innerHTML = `
      <a class="mini" href="${esc(L.regie)}" title="Ouvrir la régie"><iframe loading="lazy" tabindex="-1" src="${esc(urlApercu(session, 'intro'))}"></iframe>
        <span class="mini-voile"><span class="mini-ouvrir"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Ouvrir la régie</span></span>
        <span class="etat-live${prog ? ' prog' : ''}">${prog ? 'Programmé' : 'Prêt'}</span></a>
      <div class="corps">
        <h3 title="${esc(session.titre)}">${esc(session.titre)}</h3>
        <div class="meta">${esc((t.nom || 'perso').replace(/\s*\(.*\)$/, ''))} · ${new Date(session.cree || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
        <div class="prog-zone" hidden></div>
        <div class="actions">
          <a class="ouvrir" href="${esc(L.regie)}"><button class="primaire">Ouvrir la régie</button></a>
          <button class="ic-btn" data-a="invite" title="Copier le lien à envoyer à tes invités" aria-label="Copier le lien invités"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button>
          <button class="ic-btn" data-a="modifier" title="Modifier le visuel (thème, couleurs, textes, date)" aria-label="Modifier le visuel"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.6-.9-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></svg></button>
          <details class="plus">
            <summary class="ic-btn" title="Plus d'options" aria-label="Plus d'options">•••</summary>
            <div class="menu">
              <div class="menu-titre">Liens pour OBS</div>
              <button data-a="obs" title="Source navigateur 1920 × 1080"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="2"/></svg><span class="lib">Horizontal</span><small>1920 × 1080</small></button>
              <button data-a="vertical" title="Source navigateur 1080 × 1920 (TikTok, Shorts, Reels)"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7.5" y="3" width="9" height="18" rx="2"/></svg><span class="lib">Vertical</span><small>1080 × 1920</small></button>
              <hr>
              <button data-a="programmer" title="Le jour et l'heure, puis les miniatures"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span class="lib">Programmer</span></button>
              <button data-a="agenda" hidden title="Un rappel 15 minutes avant"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg><span class="lib">Ajouter à mon agenda</span></button>
              <button data-a="dupliquer" title="Nouveau live avec le même thème"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span class="lib">Dupliquer</span></button>
              <hr>
              <button data-a="suppr" class="danger"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg><span class="lib">Supprimer</span></button>
            </div>
          </details>
        </div>
      </div>`;
    el.querySelector('[data-a=invite]').onclick = () => copier(L.invite, 'Lien invités copié');
    el.querySelector('[data-a=obs]').onclick = () => copier(L.sortie, 'Lien OBS horizontal copié');
    el.querySelector('[data-a=vertical]').onclick = () => copier(L.vertical, 'Lien vertical copié (source 1080x1920)');
    el.querySelector('[data-a=programmer]').onclick = () => ouvrirProgrammation(session.room);
    el.querySelector('[data-a=agenda]').onclick = () => telechargerAgenda(session, baseUrl());
    // Modifier : la régie s'ouvre sur son panneau « Visuel » (plus de page à part)
    el.querySelector('[data-a=modifier]').onclick = () => { location.href = L.regie + '&visuel=1'; };
    el.querySelector('[data-a=dupliquer]').onclick = () => { if (typeof creerEtOuvrir === 'function') creerEtOuvrir(session); };
    el.querySelector('[data-a=suppr]').onclick = async () => {
      if (!await confirmer(`Supprimer « ${session.titre} » ? Sa régie et ses liens ne seront plus dans ta liste.`, { oui: 'Oui, supprimer', non: 'Non' })) return;
      if (typeof oublierMinis === 'function') oublierMinis(session.room);
      ecrire(lire().filter(x => x.session.room !== session.room)); afficherSessions(); afficherLives();
    };
    box.appendChild(el);
    if (typeof garnirProg === 'function') garnirProg(el, session);
  });
}

/* Mes lives sur une ligne : on fait défiler à la molette, en glissant (souris ou doigt) ou avec les flèches */
(function railLives() {
  const rail = $('#sessions');
  if (!rail) return;
  const zone = document.createElement('div'); zone.className = 'rail-lives';
  rail.replaceWith(zone); zone.appendChild(rail);
  const fl = (c, d, t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rail-fleche ' + c; b.title = t; b.setAttribute('aria-label', t); b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`; zone.appendChild(b); return b; };
  const g = fl('g', 'M15 5l-7 7 7 7', 'Lives précédents'), d = fl('d', 'M9 5l7 7-7 7', 'Lives suivants');
  const pas = () => Math.max(320, rail.clientWidth * .8);
  g.onclick = () => rail.scrollBy({ left: -pas(), behavior: 'smooth' });
  d.onclick = () => rail.scrollBy({ left: pas(), behavior: 'smooth' });
  const maj = () => { const max = rail.scrollWidth - rail.clientWidth; g.hidden = rail.scrollLeft < 8; d.hidden = rail.scrollLeft > max - 8 || max < 8; };
  rail.addEventListener('scroll', maj, { passive: true });
  new ResizeObserver(maj).observe(rail);
  new MutationObserver(maj).observe(rail, { childList: true });
  // la molette (haut / bas) fait défiler vers la droite / la gauche, sauf si un menu est ouvert
  rail.addEventListener('wheel', e => {
    if (document.body.dataset.page !== 'espace' || rail.querySelector('details.plus[open]')) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || rail.scrollWidth <= rail.clientWidth) return;
    e.preventDefault(); rail.scrollLeft += e.deltaY;
  }, { passive: false });
  // glisser avec la souris (le doigt, lui, défile tout seul) ; un vrai glissé n'ouvre pas la carte
  let x0 = 0, s0 = 0, appui = false, bouge = false;
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button, input, select, summary, .menu, .prog-zone')) return;
    appui = true; bouge = false; x0 = e.clientX; s0 = rail.scrollLeft;
  });
  addEventListener('pointermove', e => {
    if (!appui) return;
    if (!bouge && Math.abs(e.clientX - x0) > 6) { bouge = true; rail.classList.add('glisse'); }
    if (bouge) rail.scrollLeft = s0 - (e.clientX - x0);
  });
  addEventListener('pointerup', () => { if (!appui) return; appui = false; setTimeout(() => rail.classList.remove('glisse'), 0); });
  rail.addEventListener('click', e => { if (bouge) { e.preventDefault(); e.stopPropagation(); bouge = false; } }, true);
  rail.addEventListener('dragstart', e => e.preventDefault());
  maj();
})();

/* Le haut de l'accueil perso : bonjour, et ce qui arrive */
function majBonjour(l) {
  $('#espace-tete').hidden = !l.length;
  document.body.classList.toggle('a-des-lives', !!l.length);   // la case « Nouveau live » remplace alors le bouton du haut   // sans live, le bloc « Ton studio est prêt » suffit
  const h = new Date().getHours();
  const nom = (l[0] && l[0].session.hote) || '';
  $('#espace-bonjour').textContent = (h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour') + (nom ? ' ' + nom : '');
  const prochain = l.map(x => x.session).filter(s => s.debut && s.debut > Date.now()).sort((a, b) => a.debut - b.debut)[0];
  const heure = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  $('#espace-resume').textContent = prochain ? `Prochain direct : « ${prochain.titre} », ${dansTexte(prochain.debut)} à ${heure(prochain.debut)}.`
    : l.length ? 'Tes lives sont prêts. Tu passes en direct quand tu veux.' : 'Ton studio est prêt.';
}

/* ----- Mes lives (sessions terminées) ----- */
function afficherLives() {
  const box = $('#lives');
  box.innerHTML = '';
  const l = lire().filter(x => x.live && x.live.date).sort((a, b) => b.live.date - a.live.date);
  $('#bloc-termines').hidden = !l.length; $('#nb-termines').textContent = l.length ? `(${l.length})` : '';
  if (!l.length) return;
  l.forEach(entree => {
    const { session, live } = entree;
    const jours = Math.floor((Date.now() - live.date) / 86400000);
    const el = document.createElement('div');
    el.className = 'termine';
    el.innerHTML = `
      <div class="mini"><img src="img/themes/${THEMES[session.theme && session.theme.preset] ? session.theme.preset : 'minimal'}-intro.webp" alt=""></div>
      <div>
        <div style="display:flex;gap:10px;align-items:flex-start"><h3 style="flex:1">${esc(session.titre)}</h3><button class="petit btn-corbeille" data-a="suppr-live" title="Supprimer ce live terminé"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>Supprimer</button></div>
        <div class="meta">Diffusé le ${new Date(live.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${new Date(live.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${jours === 0 ? "aujourd'hui" : 'il y a ' + jours + ' jour' + (jours > 1 ? 's' : '')}</div>
        <label class="champ" style="margin-top:4px">Replay YouTube</label>
        <div class="ligne-boutons" style="flex-wrap:nowrap"><input type="url" class="replay" placeholder="Colle le lien du replay"><a class="ouvrir" target="_blank" rel="noopener"><button class="petit">Ouvrir</button></a></div>
        <label class="champ">Fichier enregistré par OBS</label>
        <input type="text" class="fichier" placeholder="Ex. C:\\Users\\sebou\\Videos\\…\\live.mkv">
      </div>`;
    if (typeof ligneSousTitres === 'function') { const st = ligneSousTitres(session, live); if (st) el.children[1].appendChild(st); }
    const replay = el.querySelector('.replay'), fichier = el.querySelector('.fichier'), ouvrir = el.querySelector('.ouvrir');
    replay.value = live.replay || ''; fichier.value = live.fichier || '';
    const majLien = () => { const ok = /^https:\/\//.test(replay.value); ouvrir.hidden = !ok; if (ok) ouvrir.href = replay.value; };
    majLien();
    const sauver = () => {
      const tout = lire(); const e = tout.find(x => x.session.room === session.room);
      if (e) { e.live = Object.assign({}, e.live, { replay: replay.value.trim(), fichier: fichier.value.trim() }); ecrire(tout); }
      majLien();
    };
    replay.onchange = sauver; fichier.onchange = sauver;
    el.querySelector('[data-a=suppr-live]').onclick = async () => {
      if (!await confirmer(`Supprimer « ${session.titre} » des lives terminés ? Le live reste dans « Mes lives » si tu veux le refaire.`, { oui: 'Oui, supprimer', non: 'Non' })) return;
      const tout = lire(); const e = tout.find(x => x.session.room === session.room);
      if (e) { delete e.live; ecrire(tout); }
      afficherLives(); toast('Live terminé supprimé');
    };
    box.appendChild(el);
  });
}

remplirForm();
afficherSessions();
afficherLives();
$('#vide-creer').onclick = () => $('#btn-nouveau').click();
if (location.hash === '#nouveau') montrerVue('creation', false);

/* Menus « ••• » : se ferment au clic ailleurs ou après un choix */
document.addEventListener('click', e => {
  $$('details.plus[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.menu button')) d.open = false; });
});

/* ----- Les formules ----- */
$('#btn-formules').onclick = () => { if ($('#vue-liste').hidden) montrerVue('liste'); $('#formules').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$$('#formules [data-formule]').forEach(b => b.onclick = () => {
  if (b.dataset.formule === 'gratuit') { $('#btn-nouveau').click(); return; }
  // le paiement n'est pas encore branché : on garde le contact des gens intéressés (page Contact, sans serveur)
  const nom = { essentiel: 'Essentiel', pro: 'Pro', entreprise: 'Entreprises' }[b.dataset.formule] || '';
  const msg = b.dataset.formule === 'entreprise' ? 'Bonjour, l\'offre Entreprises m\'intéresse. Mon équipe : ' : `Préviens-moi quand la formule ${nom} ouvre, s'il te plaît.`;
  location.href = `contact.html?sujet=${b.dataset.formule === 'entreprise' ? 'Entreprises' : 'Formules'}&msg=${encodeURIComponent(msg)}`;
});
/* « Voir tout le détail » : les cartes montrent l'essentiel, le détail complet s'ouvre pour toutes à la fois */
(function () {
  const b = $('#offres-detail'), zone = $('#formules'); if (!b || !zone) return;
  b.onclick = () => { const ouvert = zone.classList.toggle('detail'); b.setAttribute('aria-expanded', String(ouvert)); b.textContent = ouvert ? 'Voir moins' : 'Voir tout le détail des formules'; };
})();
/* Avec OBS ou sans OBS : les prix et quelques lignes changent ; le choix est gardé dans ce navigateur */
(function () {
  const zone = $('#formules'), boutons = $$('#choix-obs button'); if (!zone || !boutons.length) return;
  const poser = (v, anime) => {
    zone.dataset.obs = v;
    boutons.forEach(b => b.setAttribute('aria-pressed', b.dataset.obs === v));
    // la formule mise en avant change avec la version : Essentiel sans OBS, Pro avec OBS
    zone.querySelectorAll('[data-vedette]').forEach(o => {
      const oui = o.dataset.vedette === v;
      o.classList.toggle('vedette', oui);
      o.querySelector('button[data-formule]').classList.toggle('primaire', oui);
    });
    if (anime) { zone.classList.remove('bascule'); void zone.offsetWidth; zone.classList.add('bascule'); }
  };
  boutons.forEach(b => b.onclick = () => { poser(b.dataset.obs, true); try { localStorage.setItem('studioSeb:formulesObs', b.dataset.obs); } catch (e) { /* navigation privée */ } });
  let garde = ''; try { garde = localStorage.getItem('studioSeb:formulesObs') || ''; } catch (e) { /* navigation privée */ }
  if (garde === 'avec') poser('avec', false);
})();
(function () {
  const zone = $('#formules'); if (!zone) return;
  zone.addEventListener('pointermove', e => {
    const c = e.target.closest('.offre, .entreprises'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px'); c.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
  });
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  zone.classList.add('a-venir');
  const vu = new IntersectionObserver(l => { if (l.some(x => x.isIntersecting)) { zone.classList.add('visible'); vu.disconnect(); } }, { threshold: .1 });
  vu.observe(zone.querySelector('.offres'));
})();
