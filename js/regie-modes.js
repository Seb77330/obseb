/* MESA : régie, les trois modes du studio.
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
  if (c === 'coin') return `<svg viewBox="0 0 16 26" aria-hidden="true"><rect class="f" x="1" y="1" width="14" height="24" rx="2"/><rect class="p" x="2.5" y="2.5" width="11" height="21" rx="1"/><rect class="q" x="7.5" y="15" width="5.5" height="5" rx=".8"/></svg>`;
  // la bande du haut reste libre (profil TikTok), la vidéo (pleine) et la caméra (claire) l'une sur l'autre
  const v = c === 'haut' ? [5, 10] : [13.5, 10], k = c === 'haut' ? [16, 7.5] : [5, 7.5];
  return `<svg viewBox="0 0 16 26" aria-hidden="true"><rect class="f" x="1" y="1" width="14" height="24" rx="2"/><rect class="q" x="2.5" y="${v[0]}" width="11" height="${v[1]}" rx="1"/><rect class="p" x="2.5" y="${k[0]}" width="11" height="${k[1]}" rx="1"/></svg>`;
}
/* Ce qui se pose en petit : ta caméra (sur la bande-annonce) ou l'inverse, la bande-annonce en petit sur ta caméra */
function petitSvg(q) {
  const cam = (x, y, s) => `<circle cx="${x}" cy="${y - s * .18}" r="${s * .2}"/><path d="M${x - s * .38} ${y + s * .42}a${s * .38} ${s * .32} 0 0 1 ${s * .76} 0z"/>`;
  const play = (x, y, s) => `<path d="M${x - s * .22} ${y - s * .3}v${s * .6}l${s * .5}-${s * .3}z"/>`;
  return `<svg viewBox="0 0 40 24" aria-hidden="true"><rect class="f" x="1" y="1" width="38" height="22" rx="2.5"/>
    <g class="g">${q === 'camera' ? play(15, 11, 14) : cam(15, 12, 14)}</g>
    <rect class="q" x="23" y="13" width="14" height="8" rx="1.5"/><g class="i">${q === 'camera' ? cam(30, 17, 7) : play(30, 17, 7)}</g></svg>`;
}
function inverserReaction() {
  etat.reaction.petit = etat.reaction.petit === 'partage' ? 'camera' : 'partage';
  envoyer(); dessinerReglagesMode();
  toast(etat.reaction.petit === 'partage' ? 'Ta caméra en grand, le partage en petit dans le coin' : 'Le partage en grand, ta caméra en petit dans le coin');
}
/* Les réglages du mode tiennent sur une seule ligne, sans phrase : la vidéo, le coin, la taille, le vertical, Inverser.
   Le détail de chaque bouton est au survol. */
function dessinerReglagesMode() {
  const box = $('#mode-reglages');
  const m = etat.mode, r = etat.reaction;
  box.hidden = m === 'plateau';
  box.dataset.mode = m;
  if (m === 'plateau') return;
  const actives = (etat.sources || []).filter(s => s && s.actif && s.ref);
  const jeu = m === 'jeu', nomVideo = jeu ? 'Le jeu' : 'La bande-annonce';
  const choix = jeu
    ? [!TEL_SOURCES && ['console', 'Console', 'PS5, Xbox, Switch : avec un boîtier d\'acquisition (Cam Link, Elgato…)'],
       !TEL_SOURCES && ['monecran', 'Fenêtre', 'PS Remote Play, Xbox, GeForce Now, un jeu sur PC : choisis sa fenêtre'],
       ['lien', 'Lien', 'Le flux d\'un lien : une chaîne Twitch, une vidéo…']].filter(Boolean)
    : [['monecran', 'YouTube', 'Ouvre ta bande-annonce sur YouTube dans un autre onglet, puis choisis cet onglet et coche « Partager l\'audio »'],
       ['lien', 'Lien', 'Colle le lien de la vidéo (YouTube, Vimeo, MP4…)']];
  const video = actives.length
    ? `<button type="button" class="md-video ok" data-src="change" title="${nomVideo} est à l'écran. Clique pour la changer dans l'onglet Partage"><i></i>${jeu ? 'Jeu' : 'Vidéo'} à l'écran</button>`
    : `<div class="md-groupe md-video-choix" role="group" aria-label="${nomVideo}">${choix.map(([u, n, t], i) => `<button type="button" data-src="${u}" class="${i === 0 ? 'primaire' : ''}" title="${t}">${n}</button>`).join('')}</div>`;
  const inv = r.petit === 'partage', quoi = inv ? (jeu ? 'Le jeu' : 'Le partage') : 'Ta caméra';
  box.innerHTML = `
    ${video}
    <span class="md-sep" aria-hidden="true"></span>
    <div class="md-groupe md-coins" role="group" aria-label="Coin de ce qui est en petit" title="${quoi} en petit : choisis le coin">${['hg', 'hd', 'bg', 'bd'].map(c => `<button type="button" data-coin="${c}" class="${r.coin === c ? 'actif' : ''}" title="${quoi} ${NOMS_COINS[c]}">${coinSvg(c)}</button>`).join('')}</div>
    <div class="md-groupe md-tailles" role="group" aria-label="Taille de ce qui est en petit">${[['p', 'S', 'petite'], ['m', 'M', 'moyenne'], ['g', 'L', 'grande']].map(([t, n, l]) => `<button type="button" data-taille="${t}" class="${r.taille === t ? 'actif' : ''}" title="${quoi} : taille ${l}">${n}</button>`).join('')}</div>
    <div class="md-groupe md-cotes" role="group" aria-label="En vertical (TikTok, Reels, Shorts)">${[['haut', `En vertical : ${nomVideo.toLowerCase()} en haut, ta caméra en bas, sous la zone du profil TikTok`], ['bas', `En vertical : ta caméra en haut, ${nomVideo.toLowerCase()} en bas, au-dessus des commentaires`], ['coin', `En vertical : ${quoi.toLowerCase()} en petit dans le coin choisi`]].map(([c, t]) => `<button type="button" data-cote="${c}" class="${(c === 'coin' ? r.vdispo === 'coin' : r.vdispo !== 'coin' && r.cote === c) ? 'actif' : ''}" title="${t}">${coteSvg(c)}</button>`).join('')}</div>
    <button type="button" class="md-inverser${inv ? ' actif' : ''}" aria-pressed="${inv}" title="${inv ? 'Ta caméra est en grand, ' + nomVideo.toLowerCase() + ' en petit' : nomVideo + ' est en grand, ta caméra en petit'}. Clique pour échanger (en vertical empilé : celui qui est en petit prend le bloc le plus petit)">${petitSvg(r.petit === 'partage' ? 'partage' : 'camera')}<span>Inverser</span></button>`;
  box.querySelector('.md-inverser').onclick = inverserReaction;
  box.querySelectorAll('[data-coin]').forEach(b => b.onclick = () => { etat.reaction.coin = b.dataset.coin; envoyer(); dessinerReglagesMode(); });
  box.querySelectorAll('[data-taille]').forEach(b => b.onclick = () => { etat.reaction.taille = b.dataset.taille; envoyer(); dessinerReglagesMode(); });
  box.querySelectorAll('[data-cote]').forEach(b => b.onclick = () => {
    const c = b.dataset.cote;
    if (c === 'coin') etat.reaction.vdispo = 'coin'; else { etat.reaction.vdispo = 'pile'; etat.reaction.cote = c; }
    envoyer(); dessinerReglagesMode();
  });
  box.querySelectorAll('[data-src]').forEach(b => b.onclick = () => b.dataset.src === 'change' ? ouvrirOnglet('sources') : choisirSourceMode(b.dataset.src));
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
  // le cadrage ne sert qu'aux caméras seules : caché en Réaction et en Jeu, et pendant l'intro et l'outro
  const rc = $('#rangee-cadrage'); if (rc) rc.hidden = etat.mode !== 'plateau' || etat.scene === 'intro' || etat.scene === 'fin';
  const actives = (etat.sources || []).filter(s => s && s.actif && s.ref).length;
  const cle = JSON.stringify([etat.mode, etat.reaction, actives > 0]);
  if (cle !== cleModes) { cleModes = cle; dessinerReglagesMode(); }
}
majModes();
setInterval(majModes, 800);   // une source branchée ou retirée dans l'onglet Partage met à jour le raccourci
