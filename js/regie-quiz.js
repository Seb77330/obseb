/* OBSeb : régie, mode quiz (les invités répondent sur leur écran, chronométrés) */
'use strict';

etat.quiz = Object.assign({ questions: [], active: null, scores: {}, afficherScores: false }, etat.quiz || {});
const reponsesQuiz = new Map();   // qid -> Map(idInvité -> { choix, ms })

function invitesPresents() { return [...presents.keys()].filter(id => !estEcran(id)); }

function afficherQuiz() {
  const box = $('#qz-liste');
  const qz = etat.quiz;
  box.innerHTML = qz.questions.length ? '' : '<div class="vide">Prépare tes questions ici avant le live. Pendant le live, clique sur « Lancer » : tes invités répondent sur leur écran, le plus rapide gagne le plus de points.</div>';
  qz.questions.forEach((q, i) => {
    const enCours = qz.active && qz.active.qid === q.id;
    const el = document.createElement('div');
    el.className = 'elt' + (enCours ? ' on' : '');
    el.innerHTML = `<div class="txt"><b></b><small></small></div>
      <button class="petit ${enCours ? '' : 'primaire'}">${enCours ? 'En cours' : 'Lancer'}</button>
      <button class="petit" title="Supprimer">✕</button>`;
    el.querySelector('b').textContent = `${i + 1}. ${q.q}`;
    el.querySelector('small').textContent = `Réponse : ${'ABCD'[q.bonne]} · ${q.duree} s`;
    const [lancer, sup] = el.querySelectorAll('button');
    lancer.onclick = () => {
      reponsesQuiz.set(q.id, new Map());
      qz.active = { qid: q.id, q: q.q, choix: q.choix, duree: q.duree, debut: Date.now(), revele: false, bonne: null, resultats: [] };
      qz.afficherScores = false;
      envoyer(); afficherQuiz();
      toast('Question lancée');
    };
    sup.onclick = () => { qz.questions.splice(i, 1); envoyer(); afficherQuiz(); };
    box.appendChild(el);
  });
  majStatutQuiz();
}
function majStatutQuiz() {
  const a = etat.quiz.active;
  const st = $('#qz-statut');
  if (!a) { st.textContent = ''; return; }
  const n = (reponsesQuiz.get(a.qid) || new Map()).size, total = invitesPresents().length;
  st.textContent = a.revele ? '· réponse révélée' : `· ${n}/${total} ont répondu`;
}
setInterval(majStatutQuiz, 1000);

$('#qz-ajouter').onclick = () => {
  const q = $('#qz-q').value.trim();
  const champs = [...document.querySelectorAll('.qz-r')].map(x => x.value.trim());
  let bonne = +document.querySelector('input[name=qz-bonne]:checked').value;
  if (!q) return toast('Écris la question');
  if (!champs[0] || !champs[1]) return toast('Il faut au moins les réponses A et B');
  if (!champs[bonne]) return toast('La bonne réponse cochée est vide');
  // on garde les réponses non vides, dans l'ordre, en recalant l'index de la bonne réponse
  const choix = [], map = {};
  champs.forEach((c, i) => { if (c) { map[i] = choix.length; choix.push(c); } });
  bonne = map[bonne];
  etat.quiz.questions.push({ id: rnd(6), q, choix, bonne, duree: +$('#qz-duree').value });
  $('#qz-q').value = ''; document.querySelectorAll('.qz-r').forEach(x => x.value = '');
  envoyer(); afficherQuiz();
};

/* Révéler : points pour les bonnes réponses, plus on est rapide plus on gagne (500 à 1000) */
$('#qz-reveler').onclick = () => {
  const a = etat.quiz.active; if (!a || a.revele) return;
  const q = etat.quiz.questions.find(x => x.id === a.qid); if (!q) return;
  const reps = [...(reponsesQuiz.get(a.qid) || new Map()).entries()];
  const bons = reps.filter(([, r]) => r.choix === q.bonne).sort((x, y) => x[1].ms - y[1].ms);
  a.resultats = bons.map(([id, r], rang) => {
    const pts = Math.round(1000 - Math.min(1, r.ms / (q.duree * 1000)) * 500) + (rang === 0 ? 100 : 0);
    etat.quiz.scores[id] = (etat.quiz.scores[id] || 0) + pts;
    return { id, nom: etat.noms[id] || 'Invité', ms: r.ms, pts };
  });
  a.revele = true; a.bonne = q.bonne;
  envoyer(); afficherQuiz();
};
$('#qz-fermer').onclick = () => { etat.quiz.active = null; envoyer(); afficherQuiz(); };
$('#qz-scores').onclick = () => {
  etat.quiz.afficherScores = !etat.quiz.afficherScores;
  if (etat.quiz.afficherScores) etat.quiz.classement = Object.entries(etat.quiz.scores)
    .map(([id, pts]) => ({ nom: etat.noms[id] || 'Invité', pts })).sort((a, b) => b.pts - a.pts).slice(0, 10);
  $('#qz-scores').textContent = etat.quiz.afficherScores ? 'Masquer le classement' : 'Afficher le classement';
  envoyer();
};
$('#qz-zero').onclick = () => { if (confirm('Remettre tous les scores à zéro ?')) { etat.quiz.scores = {}; etat.quiz.classement = []; envoyer(); } };

/* Réponses des invités (envoyées par leur page de coulisses) */
addEventListener('message', e => {
  if (e.source !== maCamera.contentWindow) return;
  const r = e.data && e.data.dataReceived && e.data.dataReceived.studioSebQuiz;
  const a = etat.quiz.active;
  if (!r || !a || a.revele || r.qid !== a.qid || typeof r.id !== 'string' || !r.id.startsWith(session.room + '_')) return;
  const m = reponsesQuiz.get(a.qid) || new Map();
  if (m.has(r.id)) return;                       // seule la première réponse compte
  m.set(r.id, { choix: +r.choix, ms: Math.max(0, Math.min(+r.ms || 0, a.duree * 1000)) });
  reponsesQuiz.set(a.qid, m);
  majStatutQuiz();
});

afficherQuiz();
