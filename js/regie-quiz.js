/* MESA : régie, mode quiz (les invités répondent sur leur écran, chronométrés).
   La banque de questions est commune à tous tes lives (jusqu'à 50), rangée par catégories.
   Les images sont réduites (800 px, ~40 Ko) et gardées dans ce navigateur. */
'use strict';

const MAX_QUESTIONS = 50;
const CLE_BANQUE = 'studioSeb:quiz';
etat.quiz = Object.assign({ active: null, scores: {}, afficherScores: false, style: 'theme', dispo: 'centre', partie: false, dernier: null }, etat.quiz || {});

/* ----- Banque de questions (partagée entre les lives) ----- */
let banque = [];
try { banque = JSON.parse(localStorage.getItem(CLE_BANQUE) || '[]'); } catch (e) { banque = []; }
if (Array.isArray(etat.quiz.questions) && etat.quiz.questions.length) {     // anciennes questions de ce live
  for (const q of etat.quiz.questions) if (!banque.some(b => b.id === q.id)) banque.push(Object.assign({ cat: 'Général' }, q));
  banque = banque.slice(0, MAX_QUESTIONS);
}
delete etat.quiz.questions;
const sauverBanque = () => { try { localStorage.setItem(CLE_BANQUE, JSON.stringify(banque)); } catch (e) { toast('Stockage plein : retire quelques questions'); } };
sauverBanque();

/* ----- Images (IndexedDB : plus de place que le stockage simple) ----- */
const idb = new Promise(res => {
  try {
    const r = indexedDB.open('obseb', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  } catch (e) { res(null); }
});
async function imgPoser(id, data) { const db = await idb; if (!db) return; db.transaction('images', 'readwrite').objectStore('images').put(data, id); }
async function imgLire(id) {
  const db = await idb; if (!db) return null;
  return new Promise(res => { const r = db.transaction('images').objectStore('images').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
}
async function imgSuppr(id) { const db = await idb; if (db) db.transaction('images', 'readwrite').objectStore('images').delete(id); }
async function reduireImage(fichier) {
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, 800 / bmp.width, 450 / bmp.height);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.78);
}
const miniatures = new Map();   // id -> data URL (cache pour la liste)

/* ----- Liste, catégories ----- */
const reponsesQuiz = new Map();   // qid -> Map(idInvité -> { choix, ms })
let filtreCat = '';
function invitesPresents() { return [...presents.keys()].filter(id => !estEcran(id)); }
const categories = () => [...new Set(banque.map(q => q.cat || 'Général'))].sort((a, b) => a.localeCompare(b, 'fr'));

function afficherQuiz() {
  const cats = categories();
  if (filtreCat && !cats.includes(filtreCat)) filtreCat = '';
  const zc = $('#qz-cats'); zc.innerHTML = '';
  if (cats.length > 1 || filtreCat) {
    [['', 'Toutes', banque.length], ...cats.map(c => [c, c, banque.filter(q => (q.cat || 'Général') === c).length])].forEach(([v, nom, n]) => {
      const b = document.createElement('button');
      b.className = filtreCat === v ? 'actif' : ''; b.textContent = nom;
      b.insertAdjacentHTML('beforeend', `<small>${n}</small>`);
      b.onclick = () => { filtreCat = v; afficherQuiz(); };
      zc.appendChild(b);
    });
  }
  $('#qz-cats-liste').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  $('#qz-compte').textContent = `${banque.length}/${MAX_QUESTIONS}`;

  const box = $('#qz-liste');
  const qz = etat.quiz;
  const liste = banque.filter(q => !filtreCat || (q.cat || 'Général') === filtreCat);
  box.innerHTML = liste.length ? '' : '<div class="vide">Aucune question pour l\'instant.</div>';
  if (!banque.length) $('#qz-form').open = true;
  liste.forEach((q, i) => {
    const enCours = qz.active && qz.active.qid === q.id;
    const el = document.createElement('div');
    el.className = 'elt' + (enCours ? ' on' : '');
    el.innerHTML = `${q.imgId || q.imgUrl ? '<img alt="">' : ''}<div class="txt"><b></b><small></small></div>
      <button class="petit" title="Poser cette question maintenant">${enCours ? 'À l\'écran' : 'Poser'}</button>
      <button class="petit" title="Supprimer la question">✕</button>`;
    el.querySelector('b').textContent = `${i + 1}. ${q.q}`;
    el.querySelector('small').textContent = `${q.cat || 'Général'} · réponse ${'ABCD'[q.bonne]} · ${q.duree === 60 ? '1 min' : q.duree + ' s'}`;
    const img = el.querySelector('img');
    if (img) {
      if (q.imgUrl) img.src = q.imgUrl;
      else if (miniatures.has(q.imgId)) img.src = miniatures.get(q.imgId);
      else imgLire(q.imgId).then(d => { if (d) { miniatures.set(q.imgId, d); img.src = d; } });
    }
    const [lancer, sup] = el.querySelectorAll('button');
    lancer.onclick = () => lancerQuestion(q);
    sup.onclick = () => {
      if (!confirm(`Supprimer la question « ${q.q} » ?`)) return;
      banque = banque.filter(x => x.id !== q.id); sauverBanque();
      if (q.imgId) { imgSuppr(q.imgId); miniatures.delete(q.imgId); }
      // une question supprimée disparaît aussi de l'écran
      if (qz.active && qz.active.qid === q.id) { qz.active = null; if (typeof pubRetire === 'function') pubRetire(); }
      envoyer(); afficherQuiz();
    };
    box.appendChild(el);
  });
  majStatutQuiz();
}

async function lancerQuestion(q) {
  let img = q.imgUrl || null;
  if (q.imgId) img = miniatures.get(q.imgId) || await imgLire(q.imgId);
  reponsesQuiz.set(q.id, new Map());
  etat.quiz.active = { qid: q.id, q: q.q, choix: q.choix, duree: q.duree, debut: Date.now(), revele: false, bonne: null, resultats: [], img: img || null };
  etat.quiz.afficherScores = false;
  etat.quiz.dernier = q.id;
  if (typeof pubQuestion === 'function') pubQuestion(etat.quiz.active);     // le public joue aussi (regie-public.js)
  envoyer(); afficherQuiz();
  toast('Question à l\'écran');
}

/* ----- La partie : un seul gros bouton qui avance (lancer, question, réponse, question suivante, classement) ----- */
const listeJeu = () => banque.filter(q => !filtreCat || (q.cat || 'Général') === filtreCat);
function questionSuivante() {
  const l = listeJeu();
  const i = l.findIndex(q => q.id === etat.quiz.dernier);
  return l[i + 1] || null;
}
function majStatutQuiz() {
  const a = etat.quiz.active, enJeu = !!etat.quiz.partie;
  const st = $('#qz-statut'), btn = $('#qz-p-suivant');
  const l = listeJeu(), num = a ? l.findIndex(q => q.id === a.qid) + 1 : 0;
  $('#qz-partie').classList.toggle('actif', enJeu);
  $('#qz-p-arreter').hidden = !enJeu;
  $('#qz-p-plus').hidden = !enJeu;
  $('#qz-p-titre').textContent = !enJeu ? 'Partie de quiz' : a && num ? `Question ${num} sur ${l.length}` : 'Partie en cours';
  if (!enJeu) {
    st.innerHTML = 'Lance la partie\u202f: le code QR s\u2019affiche à l\u2019écran, ton public le scanne et joue depuis son téléphone. Tu poses la 1<sup>re</sup> question quand tout le monde est prêt.';
    btn.textContent = 'Lancer la partie'; btn.disabled = !banque.length;
    if (!banque.length) st.textContent = 'Ajoute d\u2019abord une question (plus bas), puis lance la partie.';
  } else if (!a) {
    const suiv = questionSuivante();
    st.textContent = suiv ? (etat.quiz.dernier ? 'Prêt pour la suite\u202f: la question part en même temps à l\u2019écran et sur les téléphones.' : (typeof qrJouerVisible === 'function' && qrJouerVisible() ? 'Le code QR est à l\u2019écran. Laisse à ton public le temps de le scanner, puis pose la 1re question.' : 'Le code QR est caché. Ton public peut aussi rejoindre avec le lien du jeu (dans les réglages).')) : 'Plus de questions\u202f: montre le classement, puis arrête la partie.';
    btn.textContent = suiv ? (etat.quiz.dernier ? 'Question suivante' : 'Poser la 1re question') : (etat.quiz.afficherScores ? 'Arrêter la partie' : 'Montrer le classement');
    btn.disabled = false;
  } else {
    const n = (reponsesQuiz.get(a.qid) || new Map()).size, total = Math.max(n, invitesPresents().length);
    const reste = Math.max(0, Math.ceil((a.debut + a.duree * 1000 - Date.now()) / 1000));
    st.textContent = a.revele ? `«\u202f${a.q}\u202f» · réponse montrée` : `«\u202f${a.q}\u202f» · ${reste ? 'encore ' + reste + '\u202fs' : 'temps écoulé'} · invités\u202f: ${n}/${total}`;
    btn.textContent = !a.revele ? 'Montrer la réponse' : questionSuivante() ? 'Question suivante' : 'Montrer le classement';
    btn.disabled = false;
  }
  const qrOn = typeof qrJouerVisible === 'function' && qrJouerVisible();
  $('#qz-p-qr').textContent = qrOn ? 'Code QR\u202f: affiché' : 'Code QR\u202f: caché';
  $('#qz-p-qr').classList.toggle('actif', qrOn);
  $('#qz-scores').classList.toggle('actif', !!etat.quiz.afficherScores);
  $('#qz-fermer').disabled = !a;
}
function montrerClassement(oui) {
  etat.quiz.afficherScores = oui;
  if (oui) etat.quiz.classement = Object.entries(etat.quiz.scores)
    .map(([id, pts]) => ({ nom: etat.noms[id] || 'Invité', pts })).sort((x, y) => y.pts - x.pts).slice(0, 10);
  envoyer(); majStatutQuiz();
}
async function lancerPartie() {
  if (typeof activerPublic === 'function' && !(await activerPublic(true))) return;
  etat.quiz.partie = true; etat.quiz.dernier = null; etat.quiz.active = null;
  if (typeof qrJouer === 'function') qrJouer(true);
  envoyer(); afficherQuiz();
  toast('Partie lancée : le code QR est à l\'écran');
}
function arreterPartie() {
  etat.quiz.partie = false; etat.quiz.active = null; etat.quiz.afficherScores = false;
  if (typeof qrJouer === 'function') qrJouer(false);
  if (typeof activerPublic === 'function') activerPublic(false);
  envoyer(); afficherQuiz();
}
$('#qz-p-suivant').onclick = () => {
  const a = etat.quiz.active;
  if (!etat.quiz.partie) return lancerPartie();
  if (a && !a.revele) return $('#qz-reveler').click();
  const suiv = questionSuivante();
  if (suiv) { if (etat.quiz.afficherScores) etat.quiz.afficherScores = false; return lancerQuestion(suiv); }
  if (!etat.quiz.afficherScores) { etat.quiz.active = null; if (typeof pubRetire === 'function') pubRetire(); montrerClassement(true); afficherQuiz(); return; }
  arreterPartie();
};
$('#qz-p-arreter').onclick = arreterPartie;
$('#qz-p-qr').onclick = () => { if (typeof qrJouer === 'function') qrJouer(!qrJouerVisible()); majStatutQuiz(); };
setInterval(majStatutQuiz, 1000);

/* ----- Nouvelle question ----- */
let imageForm = null;     // { data } ou { url }
function majImageForm() {
  const ap = $('#qz-img-apercu');
  ap.hidden = !imageForm; $('#qz-img-choix').hidden = !!imageForm;
  if (imageForm) ap.querySelector('img').src = imageForm.data || imageForm.url;
}
$('#qz-img-btn').onclick = () => $('#qz-img-fichier').click();
$('#qz-img-fichier').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { imageForm = { data: await reduireImage(f) }; majImageForm(); }
  catch (err) { toast('Image illisible'); }
};
$('#qz-img-url').onchange = e => {
  const u = e.target.value.trim(); e.target.value = '';
  if (/^https:\/\//.test(u)) { imageForm = { url: u }; majImageForm(); } else if (u) toast('Le lien doit commencer par https://');
};
$('#qz-img-retirer').onclick = () => { imageForm = null; majImageForm(); };

$('#qz-ajouter').onclick = async () => {
  if (banque.length >= MAX_QUESTIONS) return toast(`${MAX_QUESTIONS} questions maximum : supprime-en quelques-unes`);
  const q = $('#qz-q').value.trim();
  const champs = [...document.querySelectorAll('.qz-r')].map(x => x.value.trim());
  let bonne = +document.querySelector('input[name=qz-bonne]:checked').value;
  if (!q) return toast('Écris la question');
  if (!champs[0] || !champs[1]) return toast('Il faut au moins les réponses A et B');
  if (!champs[bonne]) return toast('La bonne réponse cochée est vide');
  const choix = [], map = {};
  champs.forEach((c, i) => { if (c) { map[i] = choix.length; choix.push(c); } });
  bonne = map[bonne];
  const cat = $('#qz-cat').value.trim() || filtreCat || 'Général';
  const nouvelle = { id: rnd(6), q, choix, bonne, duree: +$('#qz-duree').value, cat };
  if (imageForm && imageForm.url) nouvelle.imgUrl = imageForm.url;
  if (imageForm && imageForm.data) { nouvelle.imgId = 'img' + nouvelle.id; await imgPoser(nouvelle.imgId, imageForm.data); miniatures.set(nouvelle.imgId, imageForm.data); }
  banque.push(nouvelle); sauverBanque();
  $('#qz-q').value = ''; document.querySelectorAll('.qz-r').forEach(x => x.value = '');
  document.querySelector('input[name=qz-bonne][value="0"]').checked = true;
  imageForm = null; majImageForm();
  filtreCat = cat;
  afficherQuiz();
  toast('Question ajoutée dans « ' + cat + ' »');
};

/* ----- Style du quiz à l'écran ----- */
function majStyles() { $$('#qz-styles button').forEach(b => b.classList.toggle('actif', b.dataset.qstyle === (etat.quiz.style || 'theme'))); }
$$('#qz-styles button').forEach(b => b.onclick = () => { etat.quiz.style = b.dataset.qstyle; majStyles(); envoyer(); });
majStyles();

/* ----- Place de la question à l'écran ----- */
function majDispos() { $$('#qz-dispos button').forEach(b => b.classList.toggle('actif', b.dataset.qdispo === (etat.quiz.dispo || 'centre'))); }
$$('#qz-dispos button').forEach(b => b.onclick = () => { etat.quiz.dispo = b.dataset.qdispo; majDispos(); envoyer(); });
majDispos();

/* Révéler : points pour les bonnes réponses, plus on est rapide plus on gagne (500 à 1000) */
$('#qz-reveler').onclick = () => {
  const a = etat.quiz.active; if (!a || a.revele) return;
  const q = banque.find(x => x.id === a.qid); if (!q) return;
  const reps = [...(reponsesQuiz.get(a.qid) || new Map()).entries()];
  const bons = reps.filter(([, r]) => r.choix === q.bonne).sort((x, y) => x[1].ms - y[1].ms);
  a.resultats = bons.map(([id, r], rang) => {
    const pts = Math.round(1000 - Math.min(1, r.ms / (q.duree * 1000)) * 500) + (rang === 0 ? 100 : 0);
    etat.quiz.scores[id] = (etat.quiz.scores[id] || 0) + pts;
    return { id, nom: etat.noms[id] || 'Invité', ms: r.ms, pts };
  });
  a.votes = a.choix.map((_, i) => reps.filter(([, r]) => r.choix === i).length);
  a.revele = true; a.bonne = q.bonne;
  if (typeof pubRevele === 'function') pubRevele();
  envoyer(); afficherQuiz();
  if (etat.quiz.public && etat.quiz.public.actif && !(a.public && a.public.revele)) $('#qz-reveler-public').click();
};
$('#qz-fermer').onclick = () => { etat.quiz.active = null; if (typeof pubRetire === 'function') pubRetire(); envoyer(); afficherQuiz(); };
$('#qz-scores').onclick = () => montrerClassement(!etat.quiz.afficherScores);
$('#qz-zero').onclick = () => { if (confirm('Remettre tous les scores à zéro ?')) { etat.quiz.scores = {}; etat.quiz.classement = []; envoyer(); } };

/* Réponses des invités (envoyées par leur page de coulisses) */
addEventListener('message', e => {
  if (e.source !== maCamera.contentWindow) return;
  const r = e.data && e.data.dataReceived && e.data.dataReceived.studioSebQuiz;
  const a = etat.quiz.active;
  if (!r || !a || a.revele || r.qid !== a.qid || typeof r.id !== 'string' || !r.id.startsWith(session.room + '_')) return;
  // un invité ne peut répondre qu'en son nom (pas de réponse envoyée au nom d'un autre)
  if (typeof e.data.streamID === 'string' && e.data.streamID !== r.id) return;
  const m = reponsesQuiz.get(a.qid) || new Map();
  if (m.has(r.id)) return;                       // seule la première réponse compte
  m.set(r.id, { choix: +r.choix, ms: Math.max(0, Math.min(+r.ms || 0, a.duree * 1000)) });
  reponsesQuiz.set(a.qid, m);
  a.nbRep = m.size; envoyerBientot();   // « 3 réponses » à l'écran, sans dire lesquelles
  majStatutQuiz();
});

afficherQuiz();
