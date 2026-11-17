/* OBSeb : régie, onglets d'outils, menu des liens et recherche (Ctrl+K) */
'use strict';

/* ----- Onglets ----- */
const CLE_ONGLET = 'studioSeb:onglet';
function ouvrirOnglet(nom) {
  $$('.onglets button').forEach(b => b.classList.toggle('actif', b.dataset.tab === nom));
  $$('.onglet').forEach(o => { o.hidden = o.dataset.onglet !== nom; });
  try { localStorage.setItem(CLE_ONGLET, nom); } catch (e) { /* rien */ }
  if (nom === 'chat') { nonLus = 0; majNonLus(); const l = $('#chat-liste'); l.scrollTop = l.scrollHeight; }
}
$$('.onglets button').forEach(b => b.onclick = () => ouvrirOnglet(b.dataset.tab));
let ongletDepart = 'habillage';
try { ongletDepart = localStorage.getItem(CLE_ONGLET) || ongletDepart; } catch (e) { /* rien */ }
ouvrirOnglet($(`.onglets [data-tab="${ongletDepart}"]`) ? ongletDepart : 'habillage');

/* Messages du chat non lus quand l'onglet Chat est fermé */
let nonLus = 0;
function majNonLus() { const p = $('#chat-non-lus'); p.hidden = !nonLus; p.textContent = nonLus > 99 ? '99+' : nonLus; }
new MutationObserver(muts => {
  if (!$('[data-onglet="chat"]').hidden) return;
  for (const m of muts) nonLus += [...m.addedNodes].filter(n => n.classList && n.classList.contains('chat-msg')).length;
  majNonLus();
}).observe($('#chat-liste'), { childList: true });

/* ----- Menu « Autres liens » ----- */
$('#btn-liens').onclick = e => { e.stopPropagation(); $('#menu-liens').hidden = !$('#menu-liens').hidden; };
addEventListener('click', e => { if (!e.target.closest('.menu-liens')) $('#menu-liens').hidden = true; });
$$('#menu-liens button').forEach(b => b.addEventListener('click', () => { $('#menu-liens').hidden = true; }));

/* ----- Recherche ----- */
const sansAccents = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cliquer = sel => () => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.click(); };
const champ = (onglet, sel) => () => { ouvrirOnglet(onglet); const el = $(sel); el.scrollIntoView({ block: 'center' }); el.focus(); };

function actions() {
  const A = [];
  const add = (groupe, titre, faire, mots = '') => A.push({ groupe, titre, faire, mots });
  // Scènes et mises en page
  [['intro', 'Intro', '1'], ['live', 'Live', '2'], ['partage', 'Partage', '3'], ['fin', 'Fin', '4']]
    .forEach(([s, n, k]) => add('Scène', `Passer en scène ${n}`, () => changerScene(s), `touche ${k} scene`));
  [['grille', 'Grille'], ['interview', 'Interview'], ['solo', 'Une personne']]
    .forEach(([l, n]) => add('Mise en page', `Mise en page ${n}`, () => changerLayout(l), 'disposition layout'));
  add('Aperçu', 'Voir l\'aperçu en vertical / horizontal', cliquer('#btn-apercu-format'), 'tiktok shorts reels format');
  // Liens
  add('Liens', 'Copier le lien invités', cliquer('#btn-invite'), 'inviter partager url');
  add('Liens', 'Copier le lien OBS', cliquer('#btn-obs'), 'sortie url 1080');
  add('Liens', 'Copier le lien vertical', cliquer('#btn-vertical'), 'tiktok shorts reels url');
  add('Liens', 'Ouvrir la sortie', cliquer('#btn-sortie'), 'fenetre');
  // Participants
  for (const [id, c] of cartes) {
    const nom = etat.noms[id] || 'Invité';
    const b = c.el.querySelector('.antenne-btn');
    add('Participant', `${b.textContent} : ${nom}`, cliquer(b), 'antenne invite');
    add('Participant', `${c.el.querySelector('.muet-btn').textContent} : ${nom}`, cliquer(c.el.querySelector('.muet-btn')), 'muet micro volume couper');
    add('Participant', `Afficher en grand : ${nom}`, cliquer(c.el.querySelector('.focus-btn')), 'focus plein');
    add('Participant', `Renommer : ${nom}`, () => { const i = c.el.querySelector('.nom'); i.focus(); i.select(); }, 'nom');
  }
  // Habillage
  add('Habillage', 'Modifier le titre du bandeau', champ('habillage', '#bandeau'), 'titre');
  add('Habillage', 'Modifier le message sous le titre', champ('habillage', '#message'), 'sous-titre');
  [2, 5, 10].forEach(m => add('Habillage', `Compte à rebours de ${m} minutes`, cliquer(`[data-minutes="${m}"]`), 'intro minuteur timer'));
  add('Habillage', 'Enlever le compte à rebours', cliquer('#btn-sans-compte'), 'minuteur');
  // Bandeaux
  add('Bandeaux', 'Créer un bandeau', champ('bandeaux', '#bd-titre'), 'ajouter lower third');
  $$('#bd-liste .elt').forEach(el => add('Bandeaux', `Bandeau : ${el.querySelector('.txt').textContent.trim()}`, cliquer(el.querySelector('button')), 'afficher'));
  add('Bandeaux', 'Texte défilant', champ('bandeaux', '#defilant-txt'), 'ticker bas');
  // Sources
  add('Sources', 'Gérer les sources (écrans, images, vidéos)', () => ouvrirOnglet('sources'), 'partage ecran image video web');
  // Quiz
  add('Quiz', 'Préparer une question', champ('quiz', '#qz-q'), 'ajouter jeu');
  $$('#qz-liste .elt').forEach(el => { const b = el.querySelector('button'); add('Quiz', `Lancer : ${el.querySelector('b').textContent}`, cliquer(b), 'question jeu'); });
  add('Quiz', 'Révéler la réponse', cliquer('#qz-reveler'), 'jeu');
  add('Quiz', 'Fermer la question', cliquer('#qz-fermer'), 'jeu');
  add('Quiz', $('#qz-scores').textContent, cliquer('#qz-scores'), 'classement scores jeu');
  // Musique
  add('Musique', $('#mu-lecture').textContent.replace(/^\S+\s/, '') + ' la musique', cliquer('#mu-lecture'), 'play pause playlist');
  add('Musique', 'Morceau suivant', cliquer('#mu-suivante'), 'playlist next');
  add('Musique', 'Ajouter un morceau', champ('musique', '#mu-nom'), 'mp3 playlist');
  add('Musique', 'Régler le volume de la musique', champ('musique', '#vol-musique'), 'son');
  // Chat
  add('Chat', 'Ouvrir le chat', () => ouvrirOnglet('chat'), 'twitch youtube messages');
  add('Chat', 'Masquer le message affiché', cliquer('#chat-masquer'), 'chat ecran');
  add('Chat', 'Connecter Twitch', champ('chat', '#chat-twitch'), 'chat');
  add('Chat', 'Connecter YouTube', champ('chat', '#chat-youtube'), 'chat cle');
  // Comptes
  add('Comptes', 'Gérer les plateformes de diffusion', () => ouvrirOnglet('comptes'), 'multistream cle stream youtube twitch facebook x kick tiktok instagram');
  PLATEFORMES_LIVE.forEach((p, i) => add('Comptes', `Connecter ${p.nom}`, () => { ouvrirOnglet('comptes'); const el = $$('#comptes-liste .compte')[i]; el.classList.add('ouvert'); el.querySelector('.c-cle').focus(); }, 'cle stream compte diffusion'));
  return A;
}

let resultats = [], choix = 0;
function filtrer() {
  const q = sansAccents($('#palette-champ').value).split(/\s+/).filter(Boolean);
  resultats = actions().filter(a => { const t = sansAccents(`${a.groupe} ${a.titre} ${a.mots}`); return q.every(m => t.includes(m)); }).slice(0, 40);
  choix = 0; dessiner();
}
function dessiner() {
  const l = $('#palette-liste');
  l.innerHTML = resultats.length ? '' : '<div class="vide" style="padding:14px">Rien trouvé. Essaie « bandeau », « quiz », « musique » ou le nom d\'un invité.</div>';
  resultats.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'palette-item' + (i === choix ? ' choisi' : '');
    el.innerHTML = '<span></span><small></small>';
    el.querySelector('span').textContent = a.titre;
    el.querySelector('small').textContent = a.groupe;
    el.onmousemove = () => { if (choix !== i) { choix = i; dessiner(); } };
    el.onclick = () => lancer(i);
    l.appendChild(el);
  });
  const c = l.querySelector('.choisi'); if (c) c.scrollIntoView({ block: 'nearest' });
}
function lancer(i) { const a = resultats[i]; fermerPalette(); if (a) a.faire(); }
function ouvrirPalette() { $('#palette').hidden = false; $('#palette-champ').value = ''; filtrer(); $('#palette-champ').focus(); }
function fermerPalette() { $('#palette').hidden = true; }
$('#btn-recherche').onclick = ouvrirPalette;
$('#palette').onclick = e => { if (e.target.id === 'palette') fermerPalette(); };
$('#palette-champ').oninput = filtrer;
$('#palette-champ').onkeydown = e => {
  if (e.key === 'ArrowDown') { choix = Math.min(resultats.length - 1, choix + 1); dessiner(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { choix = Math.max(0, choix - 1); dessiner(); e.preventDefault(); }
  else if (e.key === 'Enter') { lancer(choix); e.preventDefault(); }
  else if (e.key === 'Escape') fermerPalette();
};
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? ouvrirPalette() : fermerPalette(); }
  else if (e.key === '/' && !e.target.matches('input, textarea, select')) { e.preventDefault(); ouvrirPalette(); }
});
