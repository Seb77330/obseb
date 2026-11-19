/* MESA : régie, le public joue au quiz (code QR « Jouer avec nous »).
   Les spectateurs ouvrent jouer.html sur leur téléphone et répondent sans donner leur nom.
   Le site n'a pas de serveur : questions et votes passent par ntfy.sh, un relais de messages gratuit, sans compte.
   - la régie publie l'état du quiz sur un canal secret propre à ce live, signé avec une clé gardée dans ce navigateur
     (la page du public vérifie la signature : personne d'autre ne peut y glisser une fausse question) ;
   - les téléphones envoient leur vote sur un second canal ; la régie compte un vote par téléphone et par question,
     d'après l'heure du relais (un vote arrivé après la fin du temps ne compte pas). */
'use strict';

const RELAIS = 'https://ntfy.sh';
const CLE_PUBLIC = 'studioSeb:public:' + session.room;
etat.quiz.public = Object.assign({ actif: false, marge: 10 }, etat.quiz.public || {});

let canalPublic = null;     // { topic, k (clé publique), priv (clé privée JWK) }
try { const c = JSON.parse(localStorage.getItem(CLE_PUBLIC) || 'null'); if (c && /^[a-z0-9]{12,40}$/.test(c.topic) && c.k && c.priv) canalPublic = c; } catch (e) { /* rien */ }
let clePrivee = null;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };

async function preparerPublic() {
  if (clePrivee) return true;
  try {
    if (canalPublic) { clePrivee = await crypto.subtle.importKey('jwk', canalPublic.priv, ECDSA, false, ['sign']); return true; }
    const kp = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
    canalPublic = { topic: 'mesa' + rnd(20), k: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), priv: await crypto.subtle.exportKey('jwk', kp.privateKey) };
    try { localStorage.setItem(CLE_PUBLIC, JSON.stringify(canalPublic)); } catch (e) { /* rien */ }
    clePrivee = kp.privateKey;
    return true;
  } catch (e) { toast('Ce navigateur ne sait pas préparer le quiz du public'); return false; }
}
/* Le lien du code « Jouer avec nous » (vide tant que le public ne joue pas) */
function lienJouer() { return etat.quiz.public.actif && canalPublic && clePrivee ? `${baseUrl()}jouer.html#t=${canalPublic.topic}&k=${canalPublic.k}` : ''; }

/* ----- Envoyer l'état du quiz aux téléphones ----- */
let dernierTs = 0, relaisOk = null;
async function publierPublic(data) {
  if (!etat.quiz.public.actif || !(await preparerPublic())) return;
  data.ts = dernierTs = Math.max(Date.now(), dernierTs + 1);
  data.titre = String(session.titre || '').slice(0, 60);
  const d = JSON.stringify(data);
  const s = b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clePrivee, new TextEncoder().encode(d)));
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(`${RELAIS}/${canalPublic.topic}`, { method: 'POST', body: JSON.stringify({ d, s }) });
      if (r.ok) { relaisOk = true; majPublic(); return; }
    } catch (e) { /* on réessaie */ }
    await new Promise(res => setTimeout(res, 800 * (essai + 1)));
  }
  relaisOk = false; majPublic();
  toast('Le public n\'a pas reçu le quiz : relais injoignable');
}
const finPublic = a => a.debut + (a.duree + (+etat.quiz.public.marge || 0)) * 1000;
/* ce que voit un téléphone : la question, le temps qu'il reste, et la bonne réponse une fois le temps du chat passé */
function etatPourPublic() {
  const a = etat.quiz.active;
  if (!a) return { qid: null };
  const p = a.public || {};
  const fin = p.fermeA || finPublic(a);
  const connue = (a.revele || p.revele) && Date.now() >= fin;
  return { qid: a.qid, q: a.q, choix: a.choix, fin, bonne: connue ? a.bonne : null, chat: p.revele ? { pct: p.pct, n: p.n } : null };
}
let minuteurBonne = 0;
function envoyerPublic() {
  clearTimeout(minuteurBonne);
  const a = etat.quiz.active;
  publierPublic(etatPourPublic());
  // la réponse est révélée en régie avant la fin du temps du chat : les téléphones la reçoivent à la fin de ce temps
  if (a && (a.revele || (a.public && a.public.revele))) {
    const reste = ((a.public && a.public.fermeA) || finPublic(a)) - Date.now();
    if (reste > 0) minuteurBonne = setTimeout(() => publierPublic(etatPourPublic()), reste + 300);
  }
}

/* ----- Recevoir les votes ----- */
const votesPublic = new Map();     // qid -> Map(téléphone -> choix)
let fluxVotes = null, fluxQid = null;
function ecouterVotes(a) {
  if (fluxVotes) { fluxVotes.close(); fluxVotes = null; }
  fluxQid = a ? a.qid : null;
  if (!a || !etat.quiz.public.actif || !canalPublic) return;
  // depuis le lancement de la question : si la connexion saute, le relais renvoie ce qui a été manqué (un vote par téléphone)
  fluxVotes = new EventSource(`${RELAIS}/${canalPublic.topic}v/sse?since=${Math.floor(a.debut / 1000) - 2}`);
  fluxVotes.onopen = () => { relaisOk = true; majPublic(); };
  fluxVotes.onerror = () => { relaisOk = false; majPublic(); };
  fluxVotes.onmessage = e => {
    let m, v;
    try { m = JSON.parse(e.data); if (m.event && m.event !== 'message') return; v = JSON.parse(m.message); } catch (err) { return; }
    const act = etat.quiz.active;
    if (!act || !v || v.q !== act.qid || act.qid !== fluxQid) return;
    const c = +v.c, u = String(v.u || '');
    if (!Number.isInteger(c) || c < 0 || c >= act.choix.length || !/^[a-z0-9]{8,24}$/.test(u)) return;
    const fin = (act.public && act.public.fermeA) || finPublic(act);
    if (+m.time * 1000 > fin + 1500) return;             // arrivé après la fin du temps du chat
    const box = votesPublic.get(act.qid) || new Map();
    if (box.has(u)) return;                              // un seul vote par téléphone
    box.set(u, c); votesPublic.set(act.qid, box);
    majPublic();
  };
}

/* ----- Appelé par le quiz (regie-quiz.js) ----- */
function pubQuestion(a) {
  if (!etat.quiz.public.actif) return;
  a.public = { revele: false };
  votesPublic.set(a.qid, new Map());
  ecouterVotes(a); envoyerPublic(); majPublic();
}
function pubRevele() { if (etat.quiz.public.actif) envoyerPublic(); }
function pubRetire() { if (etat.quiz.public.actif) { ecouterVotes(null); envoyerPublic(); } majPublic(); }

/* « Révéler le chat » : 50 % de bonnes réponses (13 votes) à l'écran */
$('#qz-reveler-public').onclick = () => {
  const a = etat.quiz.active; if (!a) return;
  const q = banque.find(x => x.id === a.qid);
  const bonne = q ? q.bonne : a.bonne;      // sans toucher à la question : les invités ne voient la réponse qu'à « Révéler »
  if (bonne == null) return;
  const box = votesPublic.get(a.qid) || new Map();
  const votes = a.choix.map((_, i) => [...box.values()].filter(c => c === i).length);
  const n = box.size;
  a.public = Object.assign(a.public || {}, { revele: true, n, pct: n ? Math.round(votes[bonne] * 100 / n) : 0, votes });
  if (Date.now() < finPublic(a) && !a.public.fermeA) a.public.fermeA = Date.now();     // plus de votes après la révélation
  envoyer(); envoyerPublic(); majPublic();
};

/* ----- Réglages dans l'onglet Quiz ----- */
$('#qzp-actif').checked = !!etat.quiz.public.actif;
$('#qzp-actif').onchange = async e => {
  etat.quiz.public.actif = e.target.checked;
  if (etat.quiz.public.actif) {
    if (!(await preparerPublic())) { etat.quiz.public.actif = false; e.target.checked = false; return; }
    const a = etat.quiz.active;
    if (a && !a.revele) pubQuestion(a); else envoyerPublic();
    toast('Le public peut jouer : affiche le code « Jouer avec nous »');
  } else {
    qrJouer(false); ecouterVotes(null);
  }
  envoyer(); majQR(); majPublic();
};
$('#qzp-marge').value = String(etat.quiz.public.marge);
$('#qzp-marge').onchange = e => { etat.quiz.public.marge = +e.target.value; envoyer(); if (etat.quiz.active) envoyerPublic(); };
$('#qzp-qr').onclick = () => { qrJouer(!qrJouerVisible()); majPublic(); };
$('#qzp-ouvrir').onclick = () => { const l = lienJouer(); if (l) window.open(l, '_blank', 'noopener'); };
$('#qzp-copier').onclick = () => { const l = lienJouer(); if (l) navigator.clipboard.writeText(l).then(() => toast('Lien du public copié : colle-le dans le chat')).catch(() => prompt('Copie ce lien :', l)); };

function majPublic() {
  const p = etat.quiz.public, a = etat.quiz.active;
  $('#qzp-reglages').hidden = !p.actif;
  $('#qzp-qr').textContent = qrJouerVisible() ? 'Masquer le QR' : 'Afficher le QR';
  $('#qzp-qr').classList.toggle('primaire', !qrJouerVisible());
  const btn = $('#qz-reveler-public');
  btn.hidden = !p.actif;
  btn.disabled = !a || !!(a.public && a.public.revele);
  let txt = '';
  if (p.actif) {
    if (relaisOk === false) txt = 'Relais injoignable : nouvel essai…';
    else if (a && a.public) {
      const n = (votesPublic.get(a.qid) || new Map()).size;
      const reste = Math.ceil((((a.public.fermeA) || finPublic(a)) - Date.now()) / 1000);
      txt = `Chat : ${n} vote${n > 1 ? 's' : ''}` + (a.public.revele ? ' · révélé' : reste > 0 ? ` · encore ${reste} s` : ' · temps écoulé');
    } else txt = 'Prêt : lance une question, les téléphones la reçoivent.';
  }
  $('#qzp-statut').textContent = txt;
}
setInterval(() => { if (etat.quiz.public.actif && etat.quiz.active) majPublic(); }, 1000);

/* au rechargement de la régie, le quiz du public reprend où il en était */
if (etat.quiz.public.actif) preparerPublic().then(ok => {
  if (!ok) return;
  majQR();
  const a = etat.quiz.active;
  if (a && a.public && !a.public.revele) { if (!votesPublic.has(a.qid)) votesPublic.set(a.qid, new Map()); ecouterVotes(a); }
  majPublic();
});
majPublic();
