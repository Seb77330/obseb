/* MESA : régie, onglets d'outils, menu des liens et recherche (Ctrl+K) */
'use strict';

/* ----- Onglets ----- */
const CLE_ONGLET = 'studioSeb:onglet';
/* Sur téléphone, un seul volet à la fois : le plateau (caméras, invités) ou l'outil choisi dans la barre du bas */
const PETIT_ECRAN = matchMedia('(max-width: 1000px)');
function montrerPlateau() { document.body.classList.add('volet-plateau'); }
let nonLus = 0;   // déclaré avant le premier ouvrirOnglet : la régie rouverte sur l'onglet Chat plantait ici
function ouvrirOnglet(nom, auDepart) {
  if (nom === 'plateau') return montrerPlateau();
  if (!auDepart) document.body.classList.remove('volet-plateau');
  if (nom === 'bandeaux') nom = 'habillage';   // les bandeaux sont rangés dans l'onglet Titres
  $$('.onglets button').forEach(b => b.classList.toggle('actif', b.dataset.tab === nom));
  $$('.onglet').forEach(o => { o.hidden = o.dataset.onglet !== nom; });
  try { localStorage.setItem(CLE_ONGLET, nom); } catch (e) { /* rien */ }
  if (nom === 'chat') { nonLus = 0; majNonLus(); const l = $('#chat-liste'); l.scrollTop = l.scrollHeight; }
}
$$('.onglets button').forEach(b => b.onclick = () => { ouvrirOnglet(b.dataset.volet || b.dataset.tab); if (PETIT_ECRAN.matches) window.scrollTo(0, 0); });
montrerPlateau();   // sur téléphone, on arrive sur le plateau : la caméra d'abord
let ongletDepart = 'habillage';
try { ongletDepart = localStorage.getItem(CLE_ONGLET) || ongletDepart; } catch (e) { /* rien */ }
ouvrirOnglet($(`.onglets [data-tab="${ongletDepart}"]`) ? ongletDepart : 'habillage', true);

/* Téléphone : cinq outils en bas et « Plus » pour les autres (Watch, QR, Musique, Diffusion) */
(() => {
  const plus = $('#onglet-plus'), pop = $('#plus-pop');
  if (!plus || !pop) return;
  const caches = $$('.onglets .tel-plus');
  pop.innerHTML = caches.map(b => `<button type="button" data-vers="${b.dataset.tab}">${b.querySelector('svg').outerHTML}<span>${b.querySelector('span').textContent}</span>${b.querySelector('.point') ? '<span class="point" hidden></span>' : ''}</button>`).join('');
  const fermer = () => { pop.hidden = true; plus.setAttribute('aria-expanded', 'false'); };
  // la bulle d'aide ne flotte plus sur la page (elle cachait des boutons) : elle se range ici, sur téléphone
  const ajouterAide = () => {
    const bulle = document.querySelector('.aide-bulle');
    if (!bulle || pop.querySelector('[data-aide]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.aide = '1';
    b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg><span>Aide</span>';
    b.onclick = () => { fermer(); bulle.click(); };
    pop.appendChild(b);
  };
  plus.onclick = e => { e.stopPropagation(); ajouterAide(); pop.hidden = !pop.hidden; plus.setAttribute('aria-expanded', String(!pop.hidden)); maj(); };
  pop.querySelectorAll('[data-vers]').forEach(b => b.onclick = () => { fermer(); ouvrirOnglet(b.dataset.vers); window.scrollTo(0, 0); maj(); });
  document.addEventListener('click', e => { if (!e.target.isConnected) return; if (!pop.hidden && !pop.contains(e.target) && !plus.contains(e.target)) fermer(); });
  function maj() {
    const actif = caches.find(b => b.classList.contains('actif'));
    plus.classList.toggle('actif', !!actif && !document.body.classList.contains('volet-plateau'));
    let alerte = false;
    caches.forEach(b => {
      const pt = b.querySelector('.point'), v = pop.querySelector(`[data-vers="${b.dataset.tab}"]`);
      v.classList.toggle('actif', b === actif);
      if (pt) { const vu = !pt.hidden; alerte = alerte || vu; const p2 = v.querySelector('.point'); if (p2) p2.hidden = !vu; }
    });
    $('#plus-point').hidden = !alerte;
  }
  setInterval(maj, 700); maj();
})();

/* Messages du chat non lus quand l'onglet Chat est fermé */
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
const champ = (onglet, sel) => () => { ouvrirOnglet(onglet); const el = $(sel); const pli = el.closest('details'); if (pli) pli.open = true; el.scrollIntoView({ block: 'center' }); el.focus(); };

function actions() {
  const A = [];
  const add = (groupe, titre, faire, mots = '') => A.push({ groupe, titre, faire, mots });
  // Scènes et mises en page
  [['intro', 'Intro'], ['watch', 'Watch Party'], ['fin', 'Outro']]
    .forEach(([s, n]) => add('Scène', `Passer en scène ${n}`, () => changerScene(s), 'scene fin'));
  etat.plans.forEach(p => add('Scène', `Passer en scène ${p.nom}`, () => allerPlan(p.id), 'scene plateau cameras'));
  add('Scène', 'Ajouter une scène de caméras', () => ajouterScene(), 'plateau nouvelle scene');
  LISTE_CADRAGES.forEach(([l, n, aide]) => add('Cadrage', `Cadrage ${n}`, () => changerLayout(l), 'disposition layout mise en page ' + aide));
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
  add('Habillage', 'Ajouter une minute au compte à rebours', cliquer('[data-ajout="60"]'), 'plus minuteur timer temps');
  if (typeof HABILLAGES === 'object') for (const sc of ['intro', 'fin']) HABILLAGES[sc].forEach(h => add('Habillage', `${sc === 'intro' ? 'Intro' : 'Outro'} : ${h.nom}`, () => { ouvrirChoixHabillage(sc); choisirHabillage(sc, h.id); }, `visuel style animation ${sc === 'fin' ? 'outro fin' : 'intro'} ${h.desc}`));
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
  add('Quiz', 'Afficher ou masquer le classement', cliquer('#qz-scores'), 'classement scores jeu');
  // Watch Party, caméras
  add('Watch Party', 'Régler le minuteur du film', () => ouvrirOnglet('watch'), 'film timer netflix vlc regarder ensemble');
  add('Watch Party', 'Top départ (5, 4, 3, 2, 1)', cliquer('#wp-top'), 'film lecture ensemble');
  add('Caméras', 'Brancher une autre caméra', cliquer('#cam-ajouter'), 'multicam duplex camera');
  $$('#commutation button').forEach(b => add('Caméras', `Passer sur ${b.textContent}`, cliquer(b), 'multicam commuter'));
  // Musique
  add('Musique', $('#mu-lecture').textContent.replace(/^\S+\s/, '') + ' la musique', cliquer('#mu-lecture'), 'play pause playlist');
  add('Musique', 'Morceau suivant', cliquer('#mu-suivante'), 'playlist next');
  for (const [id, nom] of EFFETS) add('Musique', 'Effet sonore : ' + nom, cliquer(`#mu-effets [data-effet="${id}"]`), 'son bruitage jingle effet');
  add('Musique', 'Ajouter une musique', () => { ouvrirOnglet('musique'); $('#mu-ajouter').click(); }, 'mp3 playlist fichier morceau');
  add('Musique', 'Régler le volume de la musique', champ('musique', '#vol-musique'), 'son');
  // Chat
  add('QR', 'Afficher un code QR à l\'écran', () => ouvrirOnglet('qr'), 'qrcode scanner lien chaine evenement');
  add('Chat', 'Ouvrir le chat', () => ouvrirOnglet('chat'), 'twitch youtube messages');
  add('Chat', 'Masquer le message affiché', cliquer('#chat-masquer'), 'chat ecran');
  add('Chat', 'Connecter Twitch', champ('chat', '#chat-twitch'), 'chat');
  add('Chat', 'Afficher tout le chat à l\'écran', () => { ouvrirOnglet('chat'); $('#chat-fil').click(); }, 'chat ecran colonne');
  add('Chat', 'Connecter YouTube', champ('chat', '#chat-youtube'), 'chat cle');
  // Comptes
  add('Comptes', 'Gérer les plateformes de diffusion', () => ouvrirOnglet('comptes'), 'multistream cle stream youtube twitch facebook x kick tiktok instagram');
  PLATEFORMES_LIVE.forEach((p, i) => add('Comptes', `Connecter ${p.nom}`, () => { ouvrirOnglet('comptes'); const el = $(`#comptes-liste .compte[data-id="${p.id}"]`); const repli = el.closest('details'); if (repli) repli.open = true; el.classList.add('ouvert'); el.querySelector('.c-cle').focus(); }, 'cle stream compte diffusion'));
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

/* Bouton Affichage dans l'en-tête */
boutonAffichage($('#place-affichage'));
/* Téléphone : le cadrage se range avec le plateau ; pendant qu'on écrit, l'aperçu ne reste plus collé en haut (le clavier prend la place) */
(() => {
  const placer = () => { const r = $('#rangee-cadrage'); if (!r) return; if (PETIT_ECRAN.matches) $('.carte-moi').after(r); else $('#scene-tiroir').append(r); };
  placer(); PETIT_ECRAN.addEventListener('change', placer);
  const ecrit = el => el && el.matches && el.matches('input[type=text], input[type=url], input[type=password], input[type=time], input:not([type]), textarea');
  document.addEventListener('focusin', e => { if (PETIT_ECRAN.matches && ecrit(e.target)) document.body.classList.add('saisie'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!ecrit(document.activeElement)) document.body.classList.remove('saisie'); }, 150));
})();
