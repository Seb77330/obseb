/* OBSeb : régie, onglet QR et fenêtre « Inviter ».
   Onglet QR : tes codes (un lien + un petit texte) sont gardés dans ce navigateur, pour tous tes lives.
   Un clic en pose un à l'écran, dans le coin choisi ; la sortie du live redessine le code à partir du lien. */
'use strict';

const CLE_QR = 'studioSeb:qr';
let codesQR = [];
try { const l = JSON.parse(localStorage.getItem(CLE_QR) || '[]'); if (Array.isArray(l)) codesQR = l.filter(c => c && typeof c.lien === 'string').slice(0, 30); } catch (e) { /* rien */ }
const sauverQR = () => { try { localStorage.setItem(CLE_QR, JSON.stringify(codesQR)); } catch (e) { /* rien */ } };
etat.qrPlace = Object.assign({ coin: 'hd', taille: 'm', duree: 30 }, etat.qrPlace || {});
if (etat.qr && !codesQR.some(c => c.lien === etat.qr.lien)) etat.qr = null;      // un code resté affiché d'un ancien live

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

function afficherQR(c) {
  const p = etat.qrPlace;
  etat.qr = { lien: c.lien, titre: c.titre, coin: p.coin, taille: p.taille, ts: Date.now() };
  clearTimeout(afficherQR.t);
  if (p.duree) afficherQR.t = setTimeout(masquerQR, p.duree * 1000);
  envoyer(); majQR();
}
function masquerQR() { clearTimeout(afficherQR.t); if (!etat.qr) return; etat.qr = null; envoyer(); majQR(); }
$('#qr-masquer').onclick = masquerQR;

function majQR() {
  const box = $('#qr-liste');
  box.innerHTML = codesQR.length ? '' : '<div class="vide">Ajoute ton premier code : ta chaîne, un événement, une billetterie…</div>';
  for (const c of codesQR) {
    const actif = !!etat.qr && etat.qr.lien === c.lien;
    const el = document.createElement('div');
    el.className = 'qr-item' + (actif ? ' actif' : '');
    el.innerHTML = `<div class="qr-mini">${svgQR(c.lien)}</div>
      <div class="qr-info"><input type="text" class="qr-nom" maxlength="40" placeholder="Texte sous le code" value="${esc(c.titre)}" title="Le texte affiché sous le code"><span title="${esc(c.lien)}">${esc(courtQR(c.lien))}</span></div>
      <button class="${actif ? '' : 'primaire '}petit qr-voir">${actif ? 'Masquer' : 'Afficher'}</button>
      <button class="petit qr-oter" title="Retirer ce code de ta liste">✕</button>`;
    el.querySelector('.qr-voir').onclick = () => actif ? masquerQR() : afficherQR(c);
    el.querySelector('.qr-nom').onchange = e => { c.titre = e.target.value.trim().slice(0, 40); sauverQR(); if (actif) { etat.qr.titre = c.titre; envoyer(); } };
    el.querySelector('.qr-oter').onclick = () => { if (actif) masquerQR(); codesQR = codesQR.filter(x => x !== c); sauverQR(); majQR(); };
    box.appendChild(el);
  }
  $('#qr-masquer').disabled = !etat.qr;
  $('#qr-point').hidden = !etat.qr;
  $$('#qr-coins button').forEach(b => b.classList.toggle('actif', b.dataset.coin === etat.qrPlace.coin));
  $$('#qr-tailles button').forEach(b => b.classList.toggle('actif', b.dataset.taille === etat.qrPlace.taille));
}
/* Changer de coin ou de taille déplace aussi le code déjà à l'écran */
$$('#qr-coins button').forEach(b => b.onclick = () => { etat.qrPlace.coin = b.dataset.coin; if (etat.qr) etat.qr.coin = b.dataset.coin; envoyer(); majQR(); });
$$('#qr-tailles button').forEach(b => b.onclick = () => { etat.qrPlace.taille = b.dataset.taille; if (etat.qr) etat.qr.taille = b.dataset.taille; envoyer(); majQR(); });
$('#qr-duree').value = String(etat.qrPlace.duree);
$('#qr-duree').onchange = e => { etat.qrPlace.duree = +e.target.value; if (etat.qr) { clearTimeout(afficherQR.t); if (etat.qrPlace.duree) afficherQR.t = setTimeout(masquerQR, etat.qrPlace.duree * 1000); } envoyer(); };
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
  addEventListener('click', e => { if (!e.target.closest('#zone-invite') && Date.now() - ouvertA > 80) pop.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });
  addEventListener('blur', () => { pop.hidden = true; });      // un clic dans l'aperçu (une autre page) ne remonte pas jusqu'ici
}
