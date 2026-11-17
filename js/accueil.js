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

/* Première visite : une session James Bond prête, comme le live du 16/11 */
if (!lire().length) {
  const s = nouvelleSession('Spécial James Bond : qui pour succéder à Daniel Craig ?', 'bond');
  ecrire([{ session: s, cle: rnd(12) }]);
}

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
$$('[data-apercu]').forEach(b => b.onclick = () => {
  modeApercu = b.dataset.apercu;
  $$('[data-apercu]').forEach(x => x.classList.toggle('actif', x === b));
  apercu();
});

function urlApercu(s, mode) {
  const p = { intro: 'demo=3&scene=intro', live: 'demo=3', live6: 'demo=6', fin: 'demo=3&scene=fin' }[mode];
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
    toast('Session modifiée');
  } else {
    l.unshift({ session: brouillon, cle: rnd(12) });
    toast('Session créée');
  }
  ecrire(l);
  annuler();
  afficherSessions();
};
function annuler() {
  enEdition = null;
  brouillon = nouvelleSession('', 'minimal');
  $('#titre-form').textContent = 'Nouvelle session';
  $('#btn-creer').textContent = 'Créer la session';
  $('#btn-annuler').hidden = true; $('#note-modif').hidden = true;
  remplirForm(); apercu();
}
$('#btn-annuler').onclick = annuler;

/* ----- Liste des sessions ----- */
function afficherSessions() {
  const box = $('#sessions');
  box.innerHTML = '';
  const l = lire();
  if (!l.length) box.innerHTML = '<p class="aide">Aucune session. Crée ton premier live à droite.</p>';
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
        <div class="ligne-boutons">
          <a href="${esc(L.regie)}"><button class="primaire">Ouvrir la régie</button></a>
          <button data-a="invite">Copier le lien invités</button>
          <button data-a="obs">Copier le lien OBS</button>
          <button class="petit" data-a="modifier">Modifier</button>
          <button class="petit" data-a="dupliquer" title="Nouveau live avec le même thème">Dupliquer</button>
          <button class="petit" data-a="suppr">Retirer</button>
        </div>
      </div>`;
    el.querySelector('[data-a=invite]').onclick = () => copier(L.invite, 'Lien invités copié');
    el.querySelector('[data-a=obs]').onclick = () => copier(L.sortie, 'Lien OBS copié');
    el.querySelector('[data-a=modifier]').onclick = () => {
      enEdition = session.room; brouillon = JSON.parse(JSON.stringify(session));
      $('#titre-form').textContent = 'Modifier la session';
      $('#btn-creer').textContent = 'Enregistrer';
      $('#btn-annuler').hidden = false; $('#note-modif').hidden = false;
      remplirForm(); apercu(); scrollTo({ top: 0, behavior: 'smooth' });
    };
    el.querySelector('[data-a=dupliquer]').onclick = () => {
      enEdition = null;
      brouillon = Object.assign(nouvelleSession('', session.theme.preset), { theme: JSON.parse(JSON.stringify(session.theme)), hote: session.hote, handle: session.handle });
      $('#titre-form').textContent = 'Nouvelle session (même thème)';
      $('#btn-creer').textContent = 'Créer la session';
      $('#btn-annuler').hidden = false; $('#note-modif').hidden = true;
      remplirForm(); apercu(); $('#f-titre').focus();
    };
    el.querySelector('[data-a=suppr]').onclick = () => {
      if (!confirm(`Retirer « ${session.titre} » de la liste ?`)) return;
      ecrire(lire().filter(x => x.session.room !== session.room)); afficherSessions();
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
        <h3>${esc(session.titre)}</h3>
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
    box.appendChild(el);
  });
}

remplirForm();
apercu();
afficherSessions();
afficherLives();
