/* Régie : Watch Party. Tout le monde regarde le même film chacun chez soi ; le film n'est jamais diffusé.
   Ce qui passe à l'écran, c'est son minuteur, pour que les spectateurs et les invités se calent dessus.
   Le minuteur est manuel (lecture, pause, caler), ou suit tout seul le lecteur du film grâce à l'extension
   (Netflix, Prime Video, Disney+, YouTube… ou VLC). */
'use strict';

etat.watch = Object.assign({ titre: '', pos: 0, ref: Date.now(), lecture: false, duree: 0, top: null, pastille: false }, etat.watch || {});
// au rechargement de la régie, un minuteur resté en lecture est figé là où il en était
if (etat.watch.lecture) { etat.watch.pos = positionFilm(etat.watch, Date.now()); etat.watch.lecture = false; etat.watch.top = null; }

const wpTexte = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
/* « 1:02:03 », « 62:03 » ou « 3723 » -> secondes */
function wpLire(txt) {
  const p = String(txt).trim().split(/[:h m]+/).filter(Boolean).map(Number);
  if (!p.length || p.some(n => !isFinite(n) || n < 0)) return null;
  return p.reduce((a, n) => a * 60 + n, 0);
}
const wpPos = () => positionFilm(etat.watch, Date.now());
function wpPoser(pos, lecture = etat.watch.lecture) {
  Object.assign(etat.watch, { pos: Math.max(0, pos), ref: Date.now(), lecture, top: null });
  envoyer(); majWatch();
}
$('#wp-jouer').onclick = () => wpPoser(wpPos(), !etat.watch.lecture);
$$('[data-wp-saut]').forEach(b => b.onclick = () => wpPoser(wpPos() + +b.dataset.wpSaut));
$('#wp-caler-btn').onclick = () => {
  const s = wpLire($('#wp-caler').value);
  if (s === null) return toast('Écris la position comme 0:42:17');
  wpPoser(s); $('#wp-caler').value = '';
};
$('#wp-caler').onkeydown = e => { if (e.key === 'Enter') $('#wp-caler-btn').click(); };
/* Top départ : 5, 4, 3, 2, 1 à l'écran et chez les invités ; le minuteur démarre tout seul à zéro du compte */
$('#wp-top').onclick = () => {
  const t = Date.now() + 5000;
  Object.assign(etat.watch, { pos: wpPos(), ref: t, lecture: true, top: t });
  envoyer(); majWatch();
  toast('Top départ dans 5 secondes : appuie sur lecture à zéro');
};
$('#wp-titre').value = etat.watch.titre || '';
$('#wp-titre').oninput = e => { etat.watch.titre = e.target.value.slice(0, 60); envoyerBientot(); };
$('#wp-pastille').checked = !!etat.watch.pastille;
$('#wp-pastille').onchange = e => { etat.watch.pastille = e.target.checked; envoyer(); };
$('#wp-scene').onclick = () => changerScene(etat.scene === 'watch' ? 'live' : 'watch');

/* ----- Extension : le vrai minuteur du lecteur ----- */
let extVue = 0, extSite = '';
addEventListener('message', e => {
  if (e.source !== window || !e.data || e.data.source !== 'obseb-watch-ext') return;
  const f = e.data.film;
  extVue = Date.now();
  if (!f || typeof f.pos !== 'number' || !isFinite(f.pos)) { extSite = ''; return; }
  extSite = String(f.site || '').slice(0, 40);
  const w = etat.watch, pos = Math.max(0, f.pos), lecture = !!f.lecture;
  const titre = String(f.titre || '').slice(0, 60);
  let change = false;
  if (w.top && Date.now() < w.top) return;                         // pendant un top départ, on laisse le compte aller au bout
  if (lecture !== w.lecture || Math.abs(pos - wpPos()) > 0.7) { Object.assign(w, { pos, ref: Date.now(), lecture, top: null }); change = true; }
  const duree = isFinite(f.duree) && f.duree > 0 ? Math.round(f.duree) : 0;
  if (duree !== w.duree) { w.duree = duree; change = true; }
  if (titre && !$('#wp-titre').matches(':focus') && !w.titreManuel && titre !== w.titre) { w.titre = titre; $('#wp-titre').value = titre; change = true; }
  if (change) { envoyer(); majWatch(); }
});
$('#wp-titre').addEventListener('change', () => { etat.watch.titreManuel = !!$('#wp-titre').value.trim(); });
/* On dit à l'extension qu'on est la régie (elle nous envoie alors le minuteur du film) */
setInterval(() => window.postMessage({ source: 'obseb-watch-page', role: 'hote' }, location.origin), 2000);

function majWatch() {
  const w = etat.watch, pos = wpPos(), enCompte = w.top && Date.now() < w.top;
  $('#wp-temps').textContent = wpTexte(pos);
  $('#wp-ecran').classList.toggle('lecture', w.lecture && !enCompte);
  $('#wp-etat').textContent = enCompte ? `Top départ dans ${Math.ceil((w.top - Date.now()) / 1000)}…` : w.lecture ? 'Lecture' : 'En pause';
  $('#wp-barre').style.width = w.duree ? Math.min(100, pos / w.duree * 100) + '%' : '0%';
  const j = $('#wp-jouer');
  j.textContent = w.lecture ? 'Pause' : 'Lecture'; j.classList.toggle('primaire', !w.lecture);
  $('#wp-scene').textContent = etat.scene === 'watch' ? 'Revenir au plateau' : 'Scène Watch Party';
  $('#wp-scene').classList.toggle('primaire', etat.scene !== 'watch');
  $('#watch-point').hidden = !(w.lecture || etat.scene === 'watch');
  const auto = Date.now() - extVue < 5000;
  $('#wp-source .voyant').className = 'voyant' + (auto ? (extSite ? ' ok' : ' att') : '');
  $('#wp-source-txt').innerHTML = !auto ? 'Minuteur manuel'
    : extSite ? `<b>Minuteur automatique</b> : il suit ${esc(extSite)}.` : 'Extension détectée. Ouvre ton film et clique sur « Suivre le film de cet onglet ».';
}
setInterval(majWatch, 250); majWatch();
