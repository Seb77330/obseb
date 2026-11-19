/* MESA : la page « Joue avec nous » du public (ouverte en scannant le code QR du live).
   Sans nom, sans compte : la question arrive par le relais ntfy.sh, signée par la régie (on vérifie la signature),
   et le vote repart par le même relais. Un vote par question ; il est gardé sur ce téléphone. */
'use strict';

const RELAIS = 'https://ntfy.sh';
const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.hash.slice(1));
const CANAL = P.get('t') || '', CLE = P.get('k') || '';

if (!/^[a-z0-9]{12,40}$/.test(CANAL) || !/^[A-Za-z0-9_-]{80,100}$/.test(CLE)) {
  $('#jeu').hidden = true; $('#j-erreur').hidden = false;
  throw new Error('Lien incomplet');
}

/* ----- Ce téléphone : un identifiant au hasard (pas de nom), ses votes et son score ----- */
const STOCK = 'mesa:jouer:' + CANAL;
let moi = { u: '', votes: {}, bons: {} };
try { moi = Object.assign(moi, JSON.parse(localStorage.getItem(STOCK) || '{}')); } catch (e) { /* rien */ }
if (!/^[a-z0-9]{16}$/.test(moi.u)) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  moi.u = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => a[x % a.length]).join('');
}
const sauver = () => { try { localStorage.setItem(STOCK, JSON.stringify(moi)); } catch (e) { /* rien */ } };
sauver();

/* ----- Vérifier que le message vient bien de la régie de ce live ----- */
const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const cleRegie = crypto.subtle ? crypto.subtle.importKey('raw', b64(CLE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']).catch(() => null) : Promise.resolve(null);
async function lireMessage(texte) {
  try {
    const { d, s } = JSON.parse(texte);
    const k = await cleRegie;
    if (!k || typeof d !== 'string' || typeof s !== 'string') return null;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, b64(s), new TextEncoder().encode(d));
    return ok ? JSON.parse(d) : null;
  } catch (e) { return null; }
}

/* ----- État reçu ----- */
let st = null, dernierTs = 0, decalage = 0, connecte = false;
const maintenant = () => Date.now() + decalage;      // l'heure du relais (celle de la régie), même si l'horloge du téléphone dérive

const source = new EventSource(`${RELAIS}/${CANAL}/sse?since=30m`);
function heureRelais(m) { if (m && m.time) { const d = m.time * 1000 - Date.now(); decalage = Math.abs(d) > 2000 ? d : 0; } }
source.addEventListener('open', e => {
  connecte = true;
  if (e.data) { try { heureRelais(JSON.parse(e.data)); } catch (err) { /* rien */ } }
  afficher();
});
source.onerror = () => { connecte = false; afficher(); };
source.onmessage = async e => {
  let m;
  try { m = JSON.parse(e.data); } catch (err) { return; }
  if (m.event === 'open') { connecte = true; heureRelais(m); afficher(); return; }
  if (m.event && m.event !== 'message') return;
  const data = await lireMessage(m.message);
  if (!data || !(+data.ts > dernierTs)) return;      // une fausse question, ou un ancien message rejoué
  dernierTs = +data.ts;
  st = data;
  afficher();
};

/* ----- Voter ----- */
let envoi = '';     // '', 'envoi', 'erreur'
async function voter(i) {
  if (!st || !st.qid || moi.votes[st.qid] != null || st.bonne != null || maintenant() > st.fin) return;
  moi.votes[st.qid] = i; sauver();
  if (navigator.vibrate) navigator.vibrate(30);
  envoi = 'envoi'; afficher();
  const corps = JSON.stringify({ q: st.qid, c: i, u: moi.u });
  for (let essai = 0; essai < 3; essai++) {
    try { const r = await fetch(`${RELAIS}/${CANAL}v`, { method: 'POST', body: corps }); if (r.ok) { envoi = ''; afficher(); return; } } catch (e) { /* on réessaie */ }
    await new Promise(res => setTimeout(res, 700 * (essai + 1)));
  }
  envoi = 'erreur'; afficher();
}

/* ----- Affichage ----- */
let qAffichee = null;
function afficher() {
  const jeu = $('#jeu');
  $('#j-direct').classList.toggle('off', !connecte);
  if (st && st.titre) $('#j-live').textContent = st.titre;
  const nb = Object.keys(moi.bons).length, bons = Object.values(moi.bons).filter(Boolean).length;
  $('#j-score').textContent = nb ? `Ton score : ${bons} sur ${nb}` : '';

  if (!st || !st.qid) {
    jeu.dataset.etat = 'attente';
    $('#j-attente').hidden = false; $('#j-question').hidden = true;
    $('#j-attente-titre').textContent = connecte ? 'La prochaine question arrive…' : 'Connexion au live…';
    $('#j-attente-txt').textContent = connecte ? 'Garde cette page ouverte : elle s\'affiche ici dès qu\'elle est lancée.' : 'Vérifie que ton téléphone a bien internet.';
    qAffichee = null;
    return;
  }
  $('#j-attente').hidden = true; $('#j-question').hidden = false;
  const choix = Array.isArray(st.choix) ? st.choix.slice(0, 4) : [];
  if (qAffichee !== st.qid) {
    qAffichee = st.qid;
    $('#j-q').textContent = String(st.q || '');
    const box = $('#j-choix'); box.innerHTML = '';
    choix.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'j-c'; b.style.setProperty('--i', i);
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = 'ABCD'[i];
      b.querySelector('span').textContent = String(c);
      b.onclick = () => voter(i);
      box.appendChild(b);
    });
    const q = $('#j-question'); q.classList.remove('entree'); void q.offsetWidth; q.classList.add('entree');
  }
  const mien = moi.votes[st.qid], revele = st.bonne != null, fini = revele || maintenant() > st.fin;
  // le score se compte une fois, quand la bonne réponse arrive
  if (revele && mien != null && !(st.qid in moi.bons)) { moi.bons[st.qid] = mien === st.bonne; sauver(); afficher(); return; }
  jeu.dataset.etat = revele ? 'revele' : mien != null ? 'vote' : fini ? 'fini' : 'question';
  [...document.querySelectorAll('.j-c')].forEach((b, i) => {
    b.disabled = mien != null || fini;
    b.classList.toggle('choisi', mien === i);
    b.classList.toggle('bonne', revele && i === st.bonne);
    b.classList.toggle('fausse', revele && i !== st.bonne);
  });
  const v = $('#j-verdict');
  const lettre = revele ? 'ABCD'[st.bonne] + ' · ' + (choix[st.bonne] || '') : '';
  v.className = 'j-verdict';
  if (revele && mien === st.bonne) { v.textContent = 'Bravo, bonne réponse !'; v.classList.add('ok'); }
  else if (revele && mien != null) { v.textContent = 'Raté… c\'était ' + lettre; v.classList.add('ko'); }
  else if (revele) v.textContent = 'La bonne réponse : ' + lettre;
  else if (envoi === 'erreur') { v.textContent = 'Ta réponse n\'est pas partie. Vérifie internet.'; v.classList.add('ko'); }
  else if (envoi === 'envoi') v.textContent = 'Envoi…';
  else if (mien != null) v.textContent = 'Réponse envoyée ✓ Regarde le live pour le résultat.';
  else if (fini) v.textContent = 'Temps écoulé ! Réponds plus vite à la prochaine.';
  else v.textContent = 'Touche ta réponse';
  const c = st.chat;
  $('#j-chat').hidden = !c;
  if (c) {
    const n = +c.n || 0, pct = Math.round(+c.pct || 0);
    $('#j-chat-pct').textContent = n ? pct + ' % de bonnes réponses' : 'Personne n\'a voté';
    $('#j-chat-n').textContent = n ? `(${n} vote${n > 1 ? 's' : ''})` : '';
    requestAnimationFrame(() => { $('#j-chat-barre').style.width = pct + '%'; });
  } else $('#j-chat-barre').style.width = '0%';
}

/* le chrono */
setInterval(() => {
  if (!st || !st.qid) return;
  const fini = st.bonne != null || maintenant() > st.fin;
  const reste = Math.max(0, st.fin - maintenant());
  const total = Math.max(1, st.fin - st.ts);
  $('#j-temps').textContent = fini ? '' : Math.ceil(reste / 1000);
  $('#j-anneau').style.strokeDashoffset = (119.4 * (1 - Math.min(1, reste / total))).toFixed(1);
  $('#jeu').classList.toggle('urgent', !fini && reste <= 5000);
  if (fini && $('#jeu').dataset.etat === 'question') afficher();
}, 250);

/* l'écran reste allumé pendant le jeu (si le téléphone le permet) */
if (navigator.wakeLock) {
  const garder = () => navigator.wakeLock.request('screen').catch(() => {});
  garder(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') garder(); });
}
afficher();
