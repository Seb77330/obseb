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
let modeApercu = 'live';

const presets = $('#presets');
for (const [id, t] of Object.entries(THEMES)) {
  const b = document.createElement('button');
  b.className = 'preset'; b.dataset.preset = id; b.type = 'button';
  b.innerHTML = `<div class="pas"><i style="background:${t.bg}"></i><i style="background:${t.accent}"></i><i style="background:${t.bg2}"></i></div>${esc(t.nom)}`;
  b.onclick = () => { brouillon.theme = { preset: id }; remplirForm(); apercu(); };
  presets.appendChild(b);
}
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
  $$('.preset').forEach(b => b.classList.toggle('actif', b.dataset.preset === brouillon.theme.preset));
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

function urlApercu(s, mode) {
  const p = { intro: 'demo=3&scene=intro', live: 'demo=3', live6: 'demo=6', fin: 'demo=3&scene=fin', vertical: 'demo=3&format=vertical' }[mode];
  return `sortie.html?${p}#s=${b64e(Object.assign({}, s, { titre: s.titre || 'Titre de ton live' }))}`;
}
function apercu() {
  clearTimeout(apercu.t);
  apercu.t = setTimeout(() => { $('#apercu-theme').src = urlApercu(brouillon, modeApercu); }, 200);
}

$('#btn-creer').onclick = () => {
  if (!brouillon.titre.trim()) { $('#f-titre').focus(); return toast('Donne un titre à ton live'); }
  const l = lire();
  if (enEdition) {
    const i = l.findIndex(x => x.session.room === enEdition);
    if (i >= 0) l[i].session = brouillon;
    toast('Live modifié');
  } else {
    l.unshift({ session: brouillon, cle: rnd(12) });
    toast('Live créé : clique sur « Ouvrir la régie »');
  }
  ecrire(l);
  annuler();
  afficherSessions();
};
function annuler() {
  enEdition = null;
  brouillon = nouvelleSession('', 'minimal');
  $('#titre-form').textContent = 'Nouveau live';
  $('#btn-creer').textContent = 'Créer le live';
  $('#btn-annuler').hidden = true; $('#note-modif').hidden = true;
  remplirForm(); apercu();
}
$('#btn-annuler').onclick = annuler;

/* ----- Liste des sessions ----- */
function afficherSessions() {
  const box = $('#sessions');
  box.innerHTML = '';
  const l = lire();
  if (!l.length) {
    box.innerHTML = '<div class="vide-accueil"><b>Aucun live pour le moment</b><span>Donne un titre, choisis un style, et ta régie est prête.</span><button class="primaire" id="vide-creer">Créer mon premier live</button></div>';
    $('#vide-creer').onclick = () => { $('#titre-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#f-titre').focus(); };
  }
  l.forEach(({ session, cle }) => {
    const L = liens(session, cle);
    const t = themeComplet(session);
    const el = document.createElement('div');
    el.className = 'session';
    el.innerHTML = `
      <div class="mini"><iframe loading="lazy" src="${esc(urlApercu(session, 'intro'))}"></iframe></div>
      <div>
        <h3>${esc(session.titre)}</h3>
        <div class="meta">Thème ${esc(t.nom || 'perso')} · créée le ${new Date(session.cree || Date.now()).toLocaleDateString('fr-FR')}</div>
        <div class="ligne-boutons" style="align-items:center">
          <a href="${esc(L.regie)}"><button class="primaire">Ouvrir la régie</button></a>
          <button data-a="invite">Copier le lien invités</button>
          <details class="plus">
            <summary title="Plus d'options">•••</summary>
            <div class="menu">
              <button data-a="obs">Copier le lien OBS<small>Source navigateur 1920 × 1080</small></button>
              <button data-a="vertical">Copier le lien vertical<small>Source navigateur 1080 × 1920 (TikTok, Shorts, Reels)</small></button>
              <button data-a="modifier">Modifier<small>Titre, style, durée maximale</small></button>
              <button data-a="dupliquer">Dupliquer<small>Nouveau live avec le même style</small></button>
              <button data-a="suppr" class="danger">Supprimer</button>
            </div>
          </details>
        </div>
      </div>`;
    el.querySelector('[data-a=invite]').onclick = () => copier(L.invite, 'Lien invités copié');
    el.querySelector('[data-a=obs]').onclick = () => copier(L.sortie, 'Lien OBS copié');
    el.querySelector('[data-a=vertical]').onclick = () => copier(L.vertical, 'Lien vertical copié (source 1080x1920)');
    el.querySelector('[data-a=modifier]').onclick = () => {
      enEdition = session.room; brouillon = JSON.parse(JSON.stringify(session));
      $('#titre-form').textContent = 'Modifier le live';
      $('#btn-creer').textContent = 'Enregistrer';
      $('#btn-annuler').hidden = false; $('#note-modif').hidden = false;
      remplirForm(); apercu(); scrollTo({ top: 0, behavior: 'smooth' });
    };
    el.querySelector('[data-a=dupliquer]').onclick = () => {
      enEdition = null;
      brouillon = Object.assign(nouvelleSession('', session.theme.preset), { theme: JSON.parse(JSON.stringify(session.theme)), hote: session.hote, handle: session.handle, limite: session.limite || 0 });
      $('#titre-form').textContent = 'Nouveau live (même style)';
      $('#btn-creer').textContent = 'Créer le live';
      $('#btn-annuler').hidden = false; $('#note-modif').hidden = true;
      remplirForm(); apercu(); $('#f-titre').focus();
    };
    el.querySelector('[data-a=suppr]').onclick = async () => {
      if (!await confirmer(`Supprimer « ${session.titre} » ? Sa régie et ses liens ne seront plus dans ta liste.`, { oui: 'Oui, supprimer', non: 'Non' })) return;
      ecrire(lire().filter(x => x.session.room !== session.room)); afficherSessions(); afficherLives();
    };
    box.appendChild(el);
  });
}

/* ----- Mes lives (sessions terminées) ----- */
function afficherLives() {
  const box = $('#lives');
  box.innerHTML = '';
  const l = lire().filter(x => x.live && x.live.date).sort((a, b) => b.live.date - a.live.date);
  if (!l.length) { box.innerHTML = '<p class="aide">Aucun live terminé pour le moment.</p>'; return; }
  l.forEach(entree => {
    const { session, live } = entree;
    const jours = Math.floor((Date.now() - live.date) / 86400000);
    const el = document.createElement('div');
    el.className = 'session';
    el.innerHTML = `
      <div class="mini"><iframe loading="lazy" src="${esc(urlApercu(session, 'fin'))}"></iframe></div>
      <div>
        <div style="display:flex;gap:10px;align-items:flex-start"><h3 style="flex:1">${esc(session.titre)}</h3><button class="petit btn-corbeille" data-a="suppr-live" title="Supprimer ce live terminé"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>Supprimer</button></div>
        <div class="meta">Diffusé le ${new Date(live.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${new Date(live.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${jours === 0 ? "aujourd'hui" : 'il y a ' + jours + ' jour' + (jours > 1 ? 's' : '')}</div>
        <label class="champ" style="margin-top:4px">Replay YouTube</label>
        <div class="ligne-boutons" style="flex-wrap:nowrap"><input type="url" class="replay" placeholder="Colle le lien du replay"><a class="ouvrir" target="_blank" rel="noopener"><button class="petit">Ouvrir</button></a></div>
        <label class="champ">Fichier enregistré par OBS</label>
        <input type="text" class="fichier" placeholder="Ex. C:\\Users\\sebou\\Videos\\…\\live.mkv">
      </div>`;
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
apercu();
afficherSessions();
afficherLives();

/* Menus « ••• » : se ferment au clic ailleurs ou après un choix */
document.addEventListener('click', e => {
  $$('details.plus[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.menu button')) d.open = false; });
});
