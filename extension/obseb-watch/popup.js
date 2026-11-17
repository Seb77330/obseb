'use strict';
const $ = s => document.querySelector(s);
const hms = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const envoyer = m => new Promise(r => chrome.runtime.sendMessage(m, x => r(x || {})));
function erreur(t) { $('#erreur').textContent = t || ''; $('#erreur').hidden = !t; }

async function maj() {
  const e = await envoyer({ type: 'etat' });
  $('#arreter').hidden = !e.mode;
  $('#temps').textContent = e.film ? hms(e.film.pos) : '–:––:––';
  const ou = e.mode === 'vlc' ? 'VLC' : (e.film && e.film.site) || 'cet onglet';
  $('#etat').innerHTML = '';
  if (!e.mode) $('#etat').textContent = 'Rien n\'est suivi pour l\'instant.';
  else if (!e.film) $('#etat').textContent = e.mode === 'vlc' ? 'VLC ne répond pas, ou aucun film n\'est ouvert.' : 'Je cherche le film dans l\'onglet… lance la lecture.';
  else {
    const b = document.createElement('b'); b.textContent = e.film.lecture ? '● Lecture' : 'En pause';
    $('#etat').append(b, ' · ' + ou + (e.film.titre ? ' · ' + e.film.titre : ''));
  }
  $('#v-studio').className = 'voyant' + (e.studio ? ' ok' : '');
  $('#t-studio').textContent = e.studio ? 'Studio : relié à ta régie.' : 'Studio : ouvre ta régie (ou ta page invité) dans ce navigateur.';
}
$('#suivre').onclick = async () => {
  erreur('');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const r = await envoyer({ type: 'suivre-onglet', tabId: tab.id, titre: tab.title });
  if (!r.ok) erreur(r.erreur);
  maj();
};
$('#vlc').onclick = async () => {
  erreur('');
  const r = await envoyer({ type: 'suivre-vlc', mdp: $('#mdp').value });
  if (!r.ok) erreur(r.erreur);
  maj();
};
$('#arreter').onclick = async () => { erreur(''); await envoyer({ type: 'arreter' }); maj(); };
chrome.storage.local.get(['mdp', 'mode']).then(o => { if (o.mdp) $('#mdp').value = o.mdp; if (o.mode === 'vlc') $('#bloc-vlc').open = true; });
maj(); setInterval(maj, 500);
