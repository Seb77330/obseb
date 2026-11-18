/* OBSeb : régie, les trois modes du studio.
   Plateau : le live comme avant (caméras, et ce qui est partagé à côté).
   Réaction : ce qui est partagé (une bande-annonce dans un onglet YouTube, un lien) prend tout l'écran,
              ta caméra se pose dans un coin (horizontal) ou dans la moitié de l'écran (vertical).
   Jeu : pareil avec la console (boîtier d'acquisition), une fenêtre Remote Play ou un lien, facecam encadrée.
   etat.mode = 'plateau' | 'reaction' | 'jeu' ; etat.reaction = { coin, taille, cote } (voir common.js). */
'use strict';

if (!MODES.includes(etat.mode)) etat.mode = 'plateau';
etat.reaction = reglageReaction(etat);

const IC_MODE = {
  plateau: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M17.5 14.2a5.5 5.5 0 0 1 3 4.8"/></svg>',
  reaction: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M10 8v5l4-2.5z"/><rect x="13.5" y="12.5" width="6" height="3.5" rx=".8" fill="currentColor" stroke="none"/><path d="M8 20.5h8"/></svg>',
  jeu: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.9 4l.8 4a2.3 2.3 0 0 1-4 2l-1.7-2H7l-1.7 2a2.3 2.3 0 0 1-4-2l.8-4A5 5 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3M16 11.5h.01M18 13.5h.01"/></svg>'
};
const LISTE_MODES = [
  ['plateau', 'Plateau', 'Le live classique : les caméras, et ce que tu partages à côté'],
  ['reaction', 'Réaction', 'Bande-annonce en plein écran, ta caméra dans un coin (ou en dessous en vertical)'],
  ['jeu', 'Jeu', 'Ta console ou ton jeu en plein écran, ta facecam encadrée dans un coin']
];
const NOMS_COINS = { hg: 'en haut à gauche', hd: 'en haut à droite', bg: 'en bas à gauche', bd: 'en bas à droite' };

$('#modes').innerHTML = LISTE_MODES.map(([m, nom, aide]) => `<button type="button" data-mode="${m}" title="${aide}">${IC_MODE[m]}<b>${nom}</b></button>`).join('');
$$('#modes [data-mode]').forEach(b => b.onclick = () => changerMode(b.dataset.mode));

function changerMode(m) {
  if (!MODES.includes(m)) return;
  const avant = etat.mode;
  etat.mode = m;
  // en Réaction et en Jeu, on se met sur une scène de caméras (pas l'intro ni l'outro) pour voir le résultat tout de suite
  if (m !== 'plateau' && (etat.scene === 'intro' || etat.scene === 'fin')) {
    if (typeof allerPlan === 'function' && etat.plans && etat.plans.length) allerPlan(etat.plan || etat.plans[0].id); else changerScene('live');
  }
  if (m === 'jeu' && avant !== 'jeu' && !etat.reactionJeu) { etat.reaction.taille = 'p'; etat.reactionJeu = true; }   // la facecam d'un jeu est un peu plus petite au départ
  envoyer();
  majModes();
}

/* ----- Les réglages du mode : le coin, la taille, et en vertical le côté de la bande-annonce ----- */
function coinSvg(c) {
  const x = c[1] === 'd' ? 23 : 3, y = c[0] === 'b' ? 13 : 3;
  return `<svg viewBox="0 0 40 24" aria-hidden="true"><rect class="f" x="1" y="1" width="38" height="22" rx="2.5"/><rect class="q" x="${x}" y="${y}" width="14" height="8" rx="1.5"/></svg>`;
}
function coteSvg(c) {
  return `<svg viewBox="0 0 16 26" aria-hidden="true"><rect class="f" x="1" y="1" width="14" height="24" rx="2"/><rect class="${c === 'haut' ? 'p' : 'q'}" x="2.5" y="2.5" width="11" height="10" rx="1"/><rect class="${c === 'haut' ? 'q' : 'p'}" x="2.5" y="13.5" width="11" height="10" rx="1"/></svg>`;
}
function dessinerReglagesMode() {
  const box = $('#mode-reglages');
  const m = etat.mode, r = etat.reaction;
  box.hidden = m === 'plateau';
  box.dataset.mode = m;
  if (m === 'plateau') return;
  const actives = (etat.sources || []).filter(s => s && s.actif && s.ref);
  const appel = m === 'reaction'
    ? `<div class="md-appel"><span>${actives.length ? 'Ta bande-annonce est à l\'écran.' : 'Choisis ta bande-annonce :'}</span>
         <button type="button" class="petit ${actives.length ? '' : 'primaire'}" data-src="monecran" title="Ouvre ta bande-annonce sur YouTube dans un autre onglet, puis choisis cet onglet et coche « Partager l'audio »">Partager l'onglet YouTube</button>
         <button type="button" class="petit" data-src="lien" title="Colle le lien de la vidéo (YouTube, Vimeo, MP4…)">Coller un lien</button></div>`
    : `<div class="md-appel"><span>${actives.length ? 'Ton jeu est à l\'écran.' : 'Branche ton jeu :'}</span>
         ${TEL_SOURCES ? '' : '<button type="button" class="petit ' + (actives.length ? '' : 'primaire') + '" data-src="console" title="PS5, Xbox, Switch : avec un boîtier d\'acquisition (Cam Link, Elgato…)">Console</button>'}
         ${TEL_SOURCES ? '' : '<button type="button" class="petit" data-src="monecran" title="PS Remote Play, Xbox, GeForce Now, un jeu sur PC : choisis sa fenêtre">Fenêtre de jeu</button>'}
         <button type="button" class="petit" data-src="lien" title="Le flux d'un lien : une chaîne Twitch, une vidéo…">Lien</button></div>`;
  box.innerHTML = `
    <div class="md-ligne">
      <span class="md-tit">Horizontal</span>
      <div class="md-coins" role="group" aria-label="Coin de la caméra">${['hg', 'hd', 'bg', 'bd'].map(c => `<button type="button" data-coin="${c}" class="${r.coin === c ? 'actif' : ''}" title="Caméra ${NOMS_COINS[c]}">${coinSvg(c)}</button>`).join('')}</div>
      <div class="md-tailles" role="group" aria-label="Taille de la caméra">${[['p', 'Petite'], ['m', 'Moyenne'], ['g', 'Grande']].map(([t, n]) => `<button type="button" data-taille="${t}" class="${r.taille === t ? 'actif' : ''}" title="Caméra ${n.toLowerCase()}${t === 'm' ? ' (environ un huitième de l\'écran)' : ''}">${n}</button>`).join('')}</div>
      <span class="md-tit">Vertical</span>
      <div class="md-cotes" role="group" aria-label="Où va la bande-annonce en vertical">${[['haut', 'en haut'], ['bas', 'en bas']].map(([c, n]) => `<button type="button" data-cote="${c}" class="${r.cote === c ? 'actif' : ''}" title="${m === 'jeu' ? 'Le jeu' : 'La bande-annonce'} ${n}, la caméra ${c === 'haut' ? 'en bas' : 'en haut'}">${coteSvg(c)}<span>${m === 'jeu' ? 'Jeu' : 'B.-A.'} ${n}</span></button>`).join('')}</div>
    </div>
    ${appel}`;
  box.querySelectorAll('[data-coin]').forEach(b => b.onclick = () => { etat.reaction.coin = b.dataset.coin; envoyer(); dessinerReglagesMode(); });
  box.querySelectorAll('[data-taille]').forEach(b => b.onclick = () => { etat.reaction.taille = b.dataset.taille; envoyer(); dessinerReglagesMode(); });
  box.querySelectorAll('[data-cote]').forEach(b => b.onclick = () => { etat.reaction.cote = b.dataset.cote; envoyer(); dessinerReglagesMode(); });
  box.querySelectorAll('[data-src]').forEach(b => b.onclick = () => choisirSourceMode(b.dataset.src));
}
/* Un raccourci vers l'onglet Partage : on l'ouvre et on choisit la bonne source, comme si tu avais cliqué dedans */
function choisirSourceMode(ui) {
  ouvrirOnglet('sources');
  const deja = (etat.sources || []).findIndex(s => s && s.ui === ui && (ui !== 'lien' || !s.ref));
  if (deja >= 0 && ui !== 'monecran') {      // déjà là : on y amène juste le regard
    const el = slotsEl[deja]; if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const c = el.querySelector('.src-lien'); if (c) c.focus(); }
    return;
  }
  const b = document.querySelector(`#src-choix [data-ui="${ui}"]`);
  if (b) b.click(); else toast('Ouvre l\'onglet Partage pour choisir ce que tu montres');
}

let cleModes = '';
function majModes() {
  $$('#modes [data-mode]').forEach(b => b.classList.toggle('actif', b.dataset.mode === etat.mode));
  document.body.dataset.modeStudio = etat.mode;
  const actives = (etat.sources || []).filter(s => s && s.actif && s.ref).length;
  const cle = JSON.stringify([etat.mode, etat.reaction, actives > 0]);
  if (cle !== cleModes) { cleModes = cle; dessinerReglagesMode(); }
}
majModes();
setInterval(majModes, 800);   // une source branchée ou retirée dans l'onglet Partage met à jour le raccourci
