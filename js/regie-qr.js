/* MESA : régie, onglet QR et fenêtre « Inviter ».
   Onglet QR : tes codes (un lien + un petit texte) sont gardés dans ce navigateur, pour tous tes lives.
   Un clic en pose un à l'écran (jusqu'à quatre, un par coin) ; la sortie redessine chaque code à partir de son lien. */
'use strict';

const CLE_QR = 'studioSeb:qr';
let codesQR = [];
try { const l = JSON.parse(localStorage.getItem(CLE_QR) || '[]'); if (Array.isArray(l)) codesQR = l.filter(c => c && typeof c.lien === 'string').slice(0, 30); } catch (e) { /* rien */ }
const sauverQR = () => { try { localStorage.setItem(CLE_QR, JSON.stringify(codesQR)); } catch (e) { /* rien */ } };
etat.qrPlace = Object.assign({ coin: 'hd', taille: 'm', duree: 30 }, etat.qrPlace || {});
/* Plusieurs codes à l'écran en même temps (un par coin). L'ancien format (un seul code) est repris. */
if (!Array.isArray(etat.qrs)) etat.qrs = etat.qr ? [Object.assign({ id: 'ancien' }, etat.qr)] : [];
etat.qr = undefined;
etat.qrs = etat.qrs.filter(q => q && (q.jouer || codesQR.some(c => c.lien === q.lien)));      // codes restés affichés d'un ancien live
const COINS = ['hd', 'hg', 'bd', 'bg'];

/* « youtube.com/@moi » -> « https://youtube.com/@moi » ; un texte sans lien (numéro, mot) reste tel quel */
function lienQR(t) {
  t = String(t || '').trim().slice(0, 600);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) t = 'https://' + t;
  return t;
}
const courtQR = l => l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function ajouterQR(lien, titre) {
  lien = lienQR(lien);
  if (!lien) { toast('Colle d\'abord un lien'); return false; }
  if (!svgQR(lien)) { toast('Ce lien est trop long pour un code QR'); return false; }
  if (codesQR.some(c => c.lien === lien)) { toast('Ce code est déjà dans ta liste'); return false; }
  codesQR.push({ id: rnd(6), lien, titre: String(titre || '').trim().slice(0, 40) });
  sauverQR(); majQR();
  return true;
}
$('#qr-ajouter').onclick = () => { if (ajouterQR($('#qr-lien').value, $('#qr-titre').value)) { $('#qr-lien').value = ''; $('#qr-titre').value = ''; } };
for (const id of ['#qr-lien', '#qr-titre']) $(id).onkeydown = e => { if (e.key === 'Enter') $('#qr-ajouter').click(); };

/* Raccourcis : tes réseaux, d'après le nom de ta chaîne */
{
  const nom = String(session.handle || HANDLE_DEFAUT).replace(/^@/, '').trim();
  const idees = !nom ? [] : [
    ['YouTube', `https://www.youtube.com/@${nom}`, 'Abonne-toi sur YouTube'],
    ['TikTok', `https://www.tiktok.com/@${nom}`, 'Suis-moi sur TikTok'],
    ['Instagram', `https://www.instagram.com/${nom}`, 'Suis-moi sur Instagram']
  ];
  $('#qr-idees').innerHTML = idees.map(([n], i) => `<button class="petit" data-i="${i}" title="Ajoute le code de ta page ${n} (@${esc(nom)})">+ ${n}</button>`).join('');
  $$('#qr-idees button').forEach(b => b.onclick = () => { const [, lien, titre] = idees[+b.dataset.i]; ajouterQR(lien, titre); });
}

/* Le code « Jouer avec nous » du quiz (voir regie-public.js) se range en tête de liste quand le public peut jouer */
const codeJouer = () => (typeof lienJouer === 'function' && lienJouer()) ? { id: 'jouer', lien: lienJouer(), titre: 'Joue avec nous au quiz', jouer: true } : null;
const codesListe = () => { const j = codeJouer(); return j ? [j, ...codesQR] : codesQR; };
const qrActif = c => etat.qrs.find(q => (c.jouer ? q.jouer : !q.jouer && q.lien === c.lien));
const minuteursQR = new Map();

function afficherQR(c, coinVoulu) {
  if (qrActif(c)) return;
  const p = etat.qrPlace;
  // le coin choisi ; s'il est déjà pris, le premier coin libre ; tout est pris : on remplace celui du coin choisi
  let coin = coinVoulu || p.coin;
  if (etat.qrs.some(q => q.coin === coin)) coin = [coin, ...COINS].find(k => !etat.qrs.some(q => q.coin === k)) || coin;
  etat.qrs = etat.qrs.filter(q => q.coin !== coin);
  const q = { id: c.id, lien: c.lien, titre: c.titre, coin, taille: p.taille, ts: Date.now(), jouer: !!c.jouer };
  etat.qrs.push(q);
  // le code « Jouer » reste tant que tu ne le retires pas ; les autres se retirent après le temps choisi
  if (p.duree && !c.jouer) minuteursQR.set(q.id, setTimeout(() => masquerQR(q), p.duree * 1000));
  envoyer(); majQR();
}
function masquerQR(q) {
  if (!q) return;
  clearTimeout(minuteursQR.get(q.id)); minuteursQR.delete(q.id);
  const avant = etat.qrs.length;
  etat.qrs = etat.qrs.filter(x => x !== q);
  if (etat.qrs.length !== avant) { envoyer(); majQR(); }
}
function masquerTousQR() { for (const t of minuteursQR.values()) clearTimeout(t); minuteursQR.clear(); if (!etat.qrs.length) return; etat.qrs = []; envoyer(); majQR(); }
$('#qr-masquer').onclick = masquerTousQR;
/* pour le quiz : poser ou retirer le code « Jouer avec nous » */
function qrJouer(montrer) { const j = codeJouer(); if (!j) return; const a = qrActif(j); if (montrer && !a) afficherQR(j); else if (!montrer && a) masquerQR(a); }
const qrJouerVisible = () => etat.qrs.some(q => q.jouer);

const COIN_NOM = { hg: 'en haut à gauche', hd: 'en haut à droite', bg: 'en bas à gauche', bd: 'en bas à droite' };
function majQR() {
  const box = $('#qr-liste');
  const liste = codesListe();
  box.innerHTML = liste.length ? '' : '<div class="vide">Ajoute ton premier code : ta chaîne, un événement, une billetterie…</div>';
  for (const c of liste) {
    const q = qrActif(c);
    const el = document.createElement('div');
    el.className = 'qr-item' + (q ? ' actif' : '') + (c.jouer ? ' jouer' : '');
    el.innerHTML = `<div class="qr-mini">${svgQR(c.lien)}</div>
      <div class="qr-info">${c.jouer ? '<b class="qr-jouer-nom">Jouer avec nous (quiz)</b>' : `<input type="text" class="qr-nom" maxlength="40" placeholder="Texte sous le code" value="${esc(c.titre)}" title="Le texte affiché sous le code">`}<span title="${esc(c.lien)}">${c.jouer ? 'Le public répond depuis son téléphone' : esc(courtQR(c.lien))}</span>
      ${q ? `<span class="qr-mini-coins" role="group" aria-label="Coin de ce code">${['hg', 'hd', 'bg', 'bd'].map(k => `<button data-k="${k}" class="${q.coin === k ? 'actif' : ''}" title="Mettre ce code ${COIN_NOM[k]}"></button>`).join('')}</span>` : ''}</div>
      <button class="${q ? '' : 'primaire '}petit qr-voir">${q ? 'Masquer' : 'Afficher'}</button>
      ${c.jouer ? '' : '<button class="petit qr-oter" title="Retirer ce code de ta liste">✕</button>'}`;
    el.querySelector('.qr-voir').onclick = () => q ? masquerQR(q) : afficherQR(c);
    const nomEl = el.querySelector('.qr-nom');
    if (nomEl) nomEl.onchange = e => { c.titre = e.target.value.trim().slice(0, 40); sauverQR(); if (q) { q.titre = c.titre; envoyer(); } };
    const oter = el.querySelector('.qr-oter');
    if (oter) oter.onclick = () => { if (q) masquerQR(q); codesQR = codesQR.filter(x => x !== c); sauverQR(); majQR(); };
    // changer le coin d'un code déjà à l'écran : s'il y en a un autre là, ils échangent leur place
    el.querySelectorAll('.qr-mini-coins button').forEach(b => b.onclick = () => {
      const k = b.dataset.k, autre = etat.qrs.find(x => x !== q && x.coin === k);
      if (autre) autre.coin = q.coin;
      q.coin = k; envoyer(); majQR();
    });
    box.appendChild(el);
  }
  $('#qr-masquer').disabled = !etat.qrs.length;
  $('#qr-masquer').textContent = etat.qrs.length > 1 ? 'Tout masquer' : 'Masquer';
  $('#qr-point').hidden = !etat.qrs.length;
  $$('#qr-coins button').forEach(b => b.classList.toggle('actif', b.dataset.coin === etat.qrPlace.coin));
  $$('#qr-tailles button').forEach(b => b.classList.toggle('actif', b.dataset.taille === etat.qrPlace.taille));
  if (typeof majPublic === 'function') majPublic();
}
/* Le coin choisi vaut pour le prochain code affiché ; la taille change tous les codes à l'écran */
$$('#qr-coins button').forEach(b => b.onclick = () => { etat.qrPlace.coin = b.dataset.coin; majQR(); });
$$('#qr-tailles button').forEach(b => b.onclick = () => { etat.qrPlace.taille = b.dataset.taille; etat.qrs.forEach(q => { q.taille = b.dataset.taille; }); envoyer(); majQR(); });
$('#qr-duree').value = String(etat.qrPlace.duree);
$('#qr-duree').onchange = e => { etat.qrPlace.duree = +e.target.value; envoyer(); };
majQR();

/* ----- Inviter : le lien, un code à scanner, un message tout prêt ----- */
{
  const pop = $('#invite-pop');
  let ouvertA = 0;      // un autre bouton de la régie peut l'ouvrir : son propre clic ne doit pas la refermer aussitôt
  const quand = session.debut && session.debut > Date.now() - 6 * 3600e3 ? ' ' + quandTexte(session.debut).replace(/^./, c => c.toLowerCase()) : '';
  const message = `Tu es invité(e) à mon live « ${session.titre} »${quand}.\nOuvre ce lien avec Chrome ou Edge, mets un casque, et tu arrives d'abord en coulisses :\n${L.invite}`;
  const code = svgQR(L.invite, 'L');
  $('#inv-qr').innerHTML = code || '';
  $('#inv-qr-bloc').hidden = !code;
  $('#inv-lien').value = L.invite;
  const copie = (txt, quoi, b) => navigator.clipboard.writeText(txt).then(() => { toast(quoi); if (b) { const t = b.textContent; b.textContent = 'Copié ✓'; setTimeout(() => { b.textContent = t; }, 1600); } }).catch(() => prompt('Copie ce texte :', txt));
  $('#btn-invite').onclick = e => {
    e.stopPropagation();
    pop.hidden = !pop.hidden; ouvertA = Date.now();
    if (!pop.hidden) copie(L.invite, 'Lien invités copié');       // comme avant : un clic, et le lien est déjà copié
  };
  $('#inv-copier').onclick = e => copie(L.invite, 'Lien invités copié', e.currentTarget);
  $('#inv-message').onclick = e => copie(message, 'Invitation copiée : colle-la dans ta messagerie', e.currentTarget);
  $('#inv-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(message);
  $('#inv-mail').href = `mailto:?subject=${encodeURIComponent('Invitation au live « ' + session.titre + ' »')}&body=${encodeURIComponent(message)}`;
  $('#inv-partager').hidden = !navigator.share;
  $('#inv-partager').onclick = () => navigator.share({ title: session.titre, text: message }).catch(() => {});
  $('#inv-essai').onclick = () => { pop.hidden = true; if (typeof ouvrirVueInvite === 'function' && $('#vue-invite').hidden) ouvrirVueInvite(); };
  $('#inv-lien').onfocus = e => e.target.select();
  addEventListener('click', e => { if (!e.target.isConnected) return; if (!e.target.closest('#zone-invite') && Date.now() - ouvertA > 80) pop.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });
  addEventListener('blur', () => { pop.hidden = true; });      // un clic dans l'aperçu (une autre page) ne remonte pas jusqu'ici
}
