/* OBSeb : accueil (sessions et thèmes) */
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
[...ORDRE_THEMES, ...Object.keys(THEMES).filter(id => !ORDRE_THEMES.includes(id))].filter(id => THEMES[id]).forEach(id => {
  const c = carteTheme(id); if (!GALERIE.includes(id)) c.classList.add('suite'); $('#galerie').appendChild(c);
});
/* On montre d'abord 9 thèmes ; le bouton déplie toute la galerie */
function deplierGalerie(tout) {
  $('#galerie').classList.toggle('tout', tout);
  $('#galerie-tout').textContent = tout ? 'Réduire' : `Voir les ${Object.keys(THEMES).length} thèmes`;
}
$('#galerie-tout').onclick = () => deplierGalerie(!$('#galerie').classList.contains('tout'));
deplierGalerie(false);
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
  if (!GALERIE.includes(brouillon.theme.preset)) deplierGalerie(true);
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
$('#f-hote').oninput = e => { brouillon.hote = e.target.value || 'Sebastian'; apercu(); };
$('#f-handle').oninput = e => { brouillon.handle = e.target.value || HANDLE_DEFAUT; apercu(); };
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
$('#btn-nouveau').onclick = () => { enEdition = null; brouillon = nouvelleSession('', 'minimal'); if (typeof appliquerStyleDefaut === 'function') appliquerStyleDefaut(brouillon); ouvrirCreation('Nouveau live', 'Créer le live', false); };

$('#btn-creer').onclick = () => {
  if (!brouillon.titre.trim()) { $('#f-titre').focus(); return toast('Donne un titre à ton live'); }
  if (brouillon.debut && brouillon.debut < Date.now() && !enEdition) return toast('L\'heure choisie est déjà passée');
  const programme = brouillon.debut && brouillon.debut > Date.now() ? brouillon.debut : 0;
  const l = lire();
  if (enEdition) {
    const i = l.findIndex(x => x.session.room === enEdition);
    if (i >= 0) l[i].session = brouillon;
    toast('Live modifié');
  } else {
    l.unshift({ session: brouillon, cle: rnd(12) });
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
  $('#nb-lives').textContent = l.length > 1 ? `${l.length} lives` : '';
  // les lives programmés d'abord, le plus proche en premier ; les autres gardent leur ordre
  const proche = s => (s.debut && s.debut > Date.now() - 6 * 3600e3 ? s.debut : Infinity);
  l.map((x, i) => [x, i]).sort((a, b) => (proche(a[0].session) - proche(b[0].session)) || (a[1] - b[1])).forEach(([{ session, cle }]) => {
    const L = liens(session, cle);
    const t = themeComplet(session);
    const el = document.createElement('div');
    el.className = 'session'; el.dataset.room = session.room;
    el.innerHTML = `
      <div class="mini"><iframe loading="lazy" src="${esc(urlApercu(session, 'intro'))}"></iframe></div>
      <div class="corps">
        <h3>${esc(session.titre)}</h3>
        <div class="meta">Thème ${esc((t.nom || 'perso').replace(/\s*\(.*\)$/, ''))} · créé le ${new Date(session.cree || Date.now()).toLocaleDateString('fr-FR')}</div>
        <div class="prog-zone" hidden></div>
        <div class="actions">
          <a href="${esc(L.regie)}"><button class="primaire">Ouvrir la régie</button></a>
          <button data-a="invite" title="Copier le lien à envoyer à tes invités">Lien invités</button>
          <details class="plus">
            <summary title="Plus d'options">•••</summary>
            <div class="menu">
              <button data-a="obs">Copier le lien OBS<small>Source navigateur 1920 × 1080</small></button>
              <button data-a="vertical">Copier le lien vertical<small>Source navigateur 1080 × 1920 (TikTok, Shorts, Reels)</small></button>
              <button data-a="programmer">Programmer<small>Le jour et l'heure, puis les miniatures</small></button>
              <button data-a="agenda" hidden>Ajouter à mon agenda<small>Un rappel 15 minutes avant</small></button>
              <button data-a="modifier">Modifier<small>Titre, thème, durée maximale</small></button>
              <button data-a="dupliquer">Dupliquer<small>Nouveau live avec le même thème</small></button>
              <button data-a="suppr" class="danger">Supprimer</button>
            </div>
          </details>
        </div>
      </div>`;
    el.querySelector('[data-a=invite]').onclick = () => copier(L.invite, 'Lien invités copié');
    el.querySelector('[data-a=obs]').onclick = () => copier(L.sortie, 'Lien OBS copié');
    el.querySelector('[data-a=vertical]').onclick = () => copier(L.vertical, 'Lien vertical copié (source 1080x1920)');
    el.querySelector('[data-a=programmer]').onclick = () => ouvrirProgrammation(session.room);
    el.querySelector('[data-a=agenda]').onclick = () => telechargerAgenda(session, baseUrl());
    el.querySelector('[data-a=modifier]').onclick = () => {
      enEdition = session.room; brouillon = JSON.parse(JSON.stringify(session));
      ouvrirCreation('Modifier le live', 'Enregistrer', true);
    };
    el.querySelector('[data-a=dupliquer]').onclick = () => {
      enEdition = null;
      brouillon = Object.assign(nouvelleSession('', session.theme.preset), { theme: JSON.parse(JSON.stringify(session.theme)), hote: session.hote, handle: session.handle, limite: session.limite || 0 });
      ouvrirCreation('Nouveau live (même thème)', 'Créer le live', false);
    };
    el.querySelector('[data-a=suppr]').onclick = async () => {
      if (!await confirmer(`Supprimer « ${session.titre} » ? Sa régie et ses liens ne seront plus dans ta liste.`, { oui: 'Oui, supprimer', non: 'Non' })) return;
      if (typeof oublierMinis === 'function') oublierMinis(session.room);
      ecrire(lire().filter(x => x.session.room !== session.room)); afficherSessions(); afficherLives();
    };
    box.appendChild(el);
    if (typeof garnirProg === 'function') garnirProg(el, session);
  });
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
  if (b.dataset.formule === 'entreprise') { toast("L'offre Entreprises est en préparation. Elle n'est pas encore ouverte."); return; }
  // le paiement n'est pas encore branché : on le dit, et on ne bloque rien
  toast("Cette formule n'est pas encore ouverte. Pendant la bêta, tout le studio est gratuit.");
});
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
