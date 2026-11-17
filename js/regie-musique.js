/* OBSeb : régie, onglet Musique.
   Tu ajoutes un fichier depuis ton ordinateur (ou un lien). Le fichier reste dans ce navigateur ;
   la sortie le reçoit par le canal de la régie, puis le garde chez elle.
   Chaque morceau peut être lié à une scène : il démarre tout seul quand tu passes sur cette scène. */
'use strict';

const SCENES_MUSIQUE = [['intro', 'Intro', 'Intro'], ['live', 'Plateau', 'Plateau'], ['partage', 'Partage', 'Écran partagé'], ['watch', 'Watch', 'Watch Party'], ['fin', 'Fin', 'Fin'], ['quiz', 'Quiz', 'Quiz']];
const TAILLE_MAX_MUSIQUE = 15 * 1024 * 1024;
const idMusique = () => 'm' + Math.random().toString(36).slice(2, 10);
const maxMusiques = () => LIMITES[formuleActuelle()].musiques;

etat.playlist.forEach(m => { if (!m.id) m.id = idMusique(); });
etat.musiqueScenes = etat.musiqueScenes || {};
/* Une playlist par scène : etat.musiqueScenes[scène] = les morceaux (ids) liés à cette scène.
   Ils jouent à la suite, dans l'ordre de la liste, puis reprennent au début. (Avant le 17/11 : un seul morceau par scène.) */
for (const s of Object.keys(etat.musiqueScenes)) { const v = etat.musiqueScenes[s]; etat.musiqueScenes[s] = Array.isArray(v) ? v : v ? [v] : []; }
const idsScene = s => { const v = etat.musiqueScenes[s] || []; return etat.playlist.filter(x => v.includes(x.id)).map(x => x.id); };
/* Musiques d'intro et de fin choisies à la création du live : elles arrivent ici une fois, déjà liées à leur scène */
etat.musiquesTheme = etat.musiquesTheme || {};
for (const [scene, cle] of [['intro', 'musIntro'], ['fin', 'musFin']]) {
  const liste = [].concat(theme[cle] || []).filter(x => x && x.id);
  const signature = liste.map(x => x.id).join(',');
  if (!liste.length || etat.musiquesTheme[scene] === signature) continue;
  etat.musiquesTheme[scene] = signature;
  etat.musiqueScenes[scene] = etat.musiqueScenes[scene] || [];
  for (const x of liste) {
    if (!etat.playlist.some(y => y.id === x.id)) etat.playlist.push({ id: x.id, nom: x.nom || 'Musique', fichier: 1, type: x.type || 'audio/mpeg', taille: x.taille || 0, theme: 1 });
    if (!etat.musiqueScenes[scene].includes(x.id)) etat.musiqueScenes[scene].push(x.id);
  }
}
/* La durée de chaque morceau : elle permet à tous les lecteurs (le live, ton retour, celui des invités) de savoir
   quel morceau de la suite est en cours, même en arrivant au milieu. */
const mesures = new Set();
async function mesurerDuree(x) {
  if (x.d > 0 || mesures.has(x.id)) return;
  mesures.add(x.id);
  let adresse = x.url, aLiberer = '';
  if (!adresse) { const blob = await fichiers.lire(x.id).catch(() => null); if (!blob) return; adresse = aLiberer = URL.createObjectURL(blob); }
  const a = new Audio(); a.preload = 'metadata';
  const fin = () => { if (aLiberer) URL.revokeObjectURL(aLiberer); a.removeAttribute('src'); };
  a.onloadedmetadata = () => { if (isFinite(a.duration) && a.duration > 0) { x.d = Math.round(a.duration * 100) / 100; envoyerBientot(); } fin(); };
  a.onerror = fin;
  a.src = adresse;
}
/* Le morceau qui joue en ce moment (la suite avance toute seule dans les lecteurs : la régie le retrouve par le calcul) */
const idEnCours = () => { if (!etat.musique.lecture) return ''; const p = positionMusique(etat, Date.now()); return p ? p.id : ''; };
const fichiersPerdus = new Set();      // morceaux dont le fichier n'est plus dans ce navigateur
const envoisMusique = new Map();       // id -> { t: dernier envoi, pct }

// au chargement : vérifier que les fichiers sont toujours là
etat.playlist.filter(m => m.fichier).forEach(m => fichiers.lire(m.id).then(b => { if (!b) { fichiersPerdus.add(m.id); afficherMusiques(); } }).catch(() => {}));

/* ---------- Ajouter ---------- */
async function ajouterFichiersMusique(liste) {
  for (const f of liste) {
    if (etat.playlist.length >= maxMusiques()) { toast(`${maxMusiques()} morceaux au maximum avec ta formule`); break; }
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(f.name)) { toast(`« ${f.name} » n'est pas un fichier audio`); continue; }
    if (f.size > TAILLE_MAX_MUSIQUE) { toast(`« ${f.name} » dépasse 15 Mo`); continue; }
    const id = idMusique();
    try { await fichiers.mettre(id, f); } catch (e) { toast('Ce navigateur refuse de garder le fichier'); continue; }
    etat.playlist.push({ id, nom: f.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'Musique', fichier: 1, type: f.type || 'audio/mpeg', taille: f.size });
  }
  envoyer(); afficherMusiques();
}
$('#mu-ajouter').onclick = () => {
  if (etat.playlist.length >= maxMusiques()) return toast(`${maxMusiques()} morceaux au maximum avec ta formule`);
  $('#mu-fichier').click();
};
$('#mu-fichier').onchange = e => { ajouterFichiersMusique([...e.target.files]); e.target.value = ''; };
{
  // glisser un fichier sur l'onglet
  const zone = $('[data-onglet="musique"]');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('depot'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('depot'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('depot'); ajouterFichiersMusique([...e.dataTransfer.files]); });
}
$('#mu-lien').onclick = () => {
  const url = $('#mu-url').value.trim(), nom = $('#mu-nom').value.trim();
  if (etat.playlist.length >= maxMusiques()) return toast(`${maxMusiques()} morceaux au maximum avec ta formule`);
  if (!/^https:\/\//.test(url)) return toast('Colle un lien qui commence par https://');
  etat.playlist.push({ id: idMusique(), nom: nom || decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.\w+$/, '') || 'Musique', url });
  $('#mu-url').value = ''; $('#mu-nom').value = '';
  envoyer(); afficherMusiques();
};

/* ---------- La liste ---------- */
function jouerMorceau(i, options) {
  const meme = etat.musique.idx === i && !etat.musique.suite;
  // t0 et pos0 : quand la lecture est partie, et d'où. Les retours du studio s'en servent pour se caler sur le live.
  etat.musique = Object.assign({ idx: i, lecture: true, n: (etat.musique.n || 0) + (meme ? 0 : 1), t0: Date.now(), pos0: meme && !etat.musique.lecture ? etat.musique.pos0 || 0 : 0 }, options || {});
}
function pauseMusique(plus) {
  const m = etat.musique;
  if (m.lecture && m.t0) m.pos0 = (m.pos0 || 0) + (Date.now() - m.t0) / 1000;
  etat.musique = Object.assign({}, m, { lecture: false }, plus || {});
}
function afficherMusiques() {
  const box = $('#mu-liste'), max = maxMusiques(), n = etat.playlist.length;
  box.innerHTML = n ? '' : '<div class="vide">Aucune musique pour l\'instant. Elles passeront dans le son du live.</div>';
  const enCoursId = idEnCours();
  dernierAffiche = enCoursId;
  etat.playlist.forEach(mesurerDuree);
  etat.playlist.forEach((m, i) => {
    const on = !!enCoursId && m.id === enCoursId;
    const el = document.createElement('div');
    el.className = 'mu-piste' + (on ? ' on' : '');
    const envoi = envoisMusique.get(m.id);
    const note = fichiersPerdus.has(m.id) ? '<span class="mu-note ko">Fichier introuvable : retire-le et ajoute-le à nouveau</span>'
      : envoi && envoi.pct < 100 ? `<span class="mu-note">Envoi vers la sortie : ${envoi.pct} %</span>` : '';
    el.innerHTML = `
      <div class="mu-ligne">
        <button class="petit mu-jouer" title="${on ? 'Pause' : 'Lancer ce morceau'}">${on ? '⏸' : '▶'}</button>
        <input type="text" class="mu-titre" maxlength="60" aria-label="Nom du morceau">
        ${i ? '<button class="petit mu-monter" title="Monter dans la liste : les morceaux d\'une scène jouent dans cet ordre">↑</button>' : ''}
        <button class="petit mu-retirer" title="Retirer">✕</button>
      </div>
      <div class="mu-scenes">${SCENES_MUSIQUE.map(([s, nom, long]) => {
        const ids = idsScene(s), rang = ids.indexOf(m.id), plusieurs = rang >= 0 && ids.length > 1;
        return `<button type="button" data-s="${s}" title="${plusieurs ? `Morceau ${rang + 1} sur ${ids.length} pendant : ${long}` : `Démarre tout seul pendant : ${long}`}" class="${rang >= 0 ? 'actif' : ''}">${nom}${plusieurs ? `<i>${rang + 1}</i>` : ''}</button>`;
      }).join('')}</div>${note}`;
    const titre = el.querySelector('.mu-titre');
    titre.value = m.nom;
    titre.onchange = () => { m.nom = titre.value.trim() || m.nom; titre.value = m.nom; envoyer(); majEtatMusique(); };
    el.querySelector('.mu-jouer').onclick = () => {
      if (on) pauseMusique(); else jouerMorceau(i);
      envoyer(); afficherMusiques();
    };
    const monter = el.querySelector('.mu-monter');
    if (monter) monter.onclick = () => {
      const enCours = etat.playlist[etat.musique.idx];
      etat.playlist.splice(i - 1, 2, etat.playlist[i], etat.playlist[i - 1]);
      etat.musique.idx = Math.max(0, etat.playlist.indexOf(enCours));     // le morceau lancé reste le même
      envoyer(); afficherMusiques();
    };
    el.querySelector('.mu-retirer').onclick = () => {
      const enCours = etat.playlist[etat.musique.idx];
      etat.playlist.splice(i, 1);
      for (const s of Object.keys(etat.musiqueScenes)) etat.musiqueScenes[s] = etat.musiqueScenes[s].filter(id => id !== m.id);
      if (m.fichier && !m.theme) fichiers.oter(m.id).catch(() => {});   // une musique venue du thème peut servir à d'autres lives : son fichier reste
      fichiersPerdus.delete(m.id); envoisMusique.delete(m.id);
      // le morceau en cours garde sa place ; si c'est lui qu'on retire, la musique s'arrête
      const idx = enCours && enCours !== m ? etat.playlist.indexOf(enCours) : -1;
      etat.musique = idx >= 0 ? Object.assign({}, etat.musique, { idx }) : { idx: 0, lecture: false, n: (etat.musique.n || 0) + 1 };
      envoyer(); afficherMusiques();
    };
    el.querySelectorAll('.mu-scenes button').forEach(b => b.onclick = () => {
      const s = b.dataset.s;
      const liste = etat.musiqueScenes[s] = etat.musiqueScenes[s] || [];
      if (liste.includes(m.id)) liste.splice(liste.indexOf(m.id), 1); else liste.push(m.id);
      // tu es déjà sur cette scène : la musique suit tout de suite
      if (s === etat.scene) { contexteMusique = null; musiqueAuto(true); }
      envoyer(); afficherMusiques();
    });
    box.appendChild(el);
  });
  $('#mu-compte').textContent = (n >= max ? `${n} sur ${max}. Plus de morceaux avec une formule au-dessus.` : `${n} sur ${max}`) + (n ? ' Coche les scènes de chaque morceau : plusieurs morceaux sur une scène jouent à la suite.' : '');
  $('#mu-ajouter').classList.toggle('plein', n >= max);
  majEtatMusique();
}
let dernierAffiche = '';
function majEtatMusique() {
  const m = etat.playlist.find(x => x.id === idEnCours()) || etat.playlist[etat.musique.idx];
  $('#mu-lecture').textContent = etat.musique.lecture ? '⏸ Pause' : '▶ Lecture';
  $('#mu-etat').textContent = m ? (etat.musique.lecture ? 'En cours : ' : 'Prêt : ') + m.nom : '';
}
$('#mu-lecture').onclick = () => {
  if (!etat.playlist.length) return toast('Ajoute d\'abord une musique');
  if (etat.musique.lecture) pauseMusique(); else Object.assign(etat.musique, { lecture: true, t0: Date.now() });
  envoyer(); afficherMusiques();
};
$('#mu-suivante').onclick = () => {
  if (!etat.playlist.length) return;
  // le suivant dans la suite en cours (la playlist de la scène, sinon toute la liste) ; les lecteurs enchaînent en fondu
  const suite = suiteMusique(etat), actuel = idEnCours() || (etat.playlist[etat.musique.idx] || {}).id;
  const i = suite.indexOf(actuel), tour = suite.slice(i + 1).concat(suite.slice(0, i + 1));
  etat.musique = Object.assign({}, etat.musique, { idx: Math.max(0, etat.playlist.findIndex(x => x.id === tour[0])), lecture: true, n: (etat.musique.n || 0) + 1, t0: Date.now(), pos0: 0, suite: Array.isArray(etat.musique.suite) ? tour : undefined });
  envoyer(); afficherMusiques();
};
/* Qui entend la musique : tout le studio (toi et tes invités, par l'aperçu de chacun) ou seulement le live.
   Dans les deux cas elle part dans le son du live. */
function majEcouteMusique() { $$('#mu-ecoute button').forEach(b => b.classList.toggle('actif', (b.dataset.v === 'studio') === (etat.musiqueStudio !== false))); }
$$('#mu-ecoute button').forEach(b => b.onclick = () => {
  etat.musiqueStudio = b.dataset.v === 'studio';
  envoyer(); majEcouteMusique();
  toast(etat.musiqueStudio ? 'Tout le monde entend la musique' : 'La musique ne passe plus que dans le live');
});
majEcouteMusique();
$('#vol-musique').value = Math.round((etat.volMusique ?? 0.5) * 100);
$('#vol-musique').oninput = e => { etat.volMusique = e.target.value / 100; envoyerBientot(); };

/* ---------- Une playlist par scène ----------
   Appelé à chaque envoi de l'état : dès que la scène change (ou qu'un quiz commence), les morceaux liés à la scène
   démarrent à la suite ; si la nouvelle scène n'en a pas, la musique lancée par une scène s'arrête.
   L'intro a un réglage à elle (etat.musiqueIntro) : « direct » (d'office), elle attend « Démarrer le direct » et part
   une seconde après ; « auto », elle part dès que la scène Intro est à l'écran. */
const introAvecDirect = () => etat.musiqueIntro !== 'auto';
let contexteMusique = null;
function musiqueAuto(force) {
  const ctx = etat.quiz && etat.quiz.active && idsScene('quiz').length ? 'quiz' : etat.scene;
  const attente = ctx === 'intro' && introAvecDirect() && !(etat.direct && Date.now() - etat.direct.debut >= 900);
  const cle = ctx + (attente ? ':attente' : '');
  if (cle === contexteMusique) return;
  const premier = contexteMusique === null && !force;
  contexteMusique = cle;
  const ids = attente ? [] : idsScene(ctx);
  // à l'ouverture de la régie on ne touche à rien, sauf pour l'intro « dès l'intro » d'un live pas encore démarré
  if (premier && !(ctx === 'intro' && ids.length && !etat.musique.lecture && !etat.direct)) return;
  const m = etat.musique;
  if (ids.length) {
    const deja = m.lecture && m.auto && Array.isArray(m.suite) && m.suite.join() === ids.join();
    if (!deja) etat.musique = { idx: Math.max(0, etat.playlist.findIndex(x => x.id === ids[0])), lecture: true, n: (m.n || 0) + 1, t0: Date.now(), pos0: 0, suite: ids, auto: true };
  } else if (m.auto) {
    pauseMusique({ auto: false, boucle: false, suite: undefined });
  } else return;
  setTimeout(afficherMusiques, 0);
}
function majIntroMusique() { $$('#mu-intro button').forEach(b => b.classList.toggle('actif', (b.dataset.v === 'direct') === introAvecDirect())); }
$$('#mu-intro button').forEach(b => b.onclick = () => {
  etat.musiqueIntro = b.dataset.v;
  contexteMusique = null; musiqueAuto(true);      // s'applique tout de suite si tu es sur l'intro
  envoyer(); majIntroMusique(); afficherMusiques();
});
majIntroMusique();
// l'affichage suit la suite : le morceau en cours change tout seul d'une ligne à l'autre
setInterval(() => { if (etat.musique.lecture && idEnCours() !== dernierAffiche && !(document.activeElement && document.activeElement.classList.contains('mu-titre'))) afficherMusiques(); }, 1000);

/* ---------- Envoi d'un fichier (musique ou image) à la sortie qui le demande ---------- */
async function envoyerFichier(id) {
  // un morceau de la liste, ou une image de l'onglet Partage
  const p = etat.playlist.find(m => m.id === id && m.fichier) || (etat.sources.find(s => s.fichier && s.fichier.id === id) || {}).fichier;
  if (!p) return;
  const suivi = envoisMusique.get(id);
  if (suivi && Date.now() - suivi.t < 20000) return;     // un envoi sert toutes les sorties : pas de doublon
  envoisMusique.set(id, { t: Date.now(), pct: 0 });
  const blob = await fichiers.lire(id).catch(() => null);
  if (!blob) { fichiersPerdus.add(id); envoisMusique.delete(id); afficherMusiques(); return; }
  const octets = new Uint8Array(await blob.arrayBuffer());
  const PAS = 24000, n = Math.ceil(octets.length / PAS);
  let i = 0, avant = Date.now();
  while (i < n) {
    // environ 300 ko par seconde, pour ne pas gêner la vidéo ; si l'onglet est en arrière-plan, on rattrape par paquets
    await new Promise(r => setTimeout(r, 80));
    const lot = Math.max(1, Math.min(16, Math.floor((Date.now() - avant) * 300 / PAS)));
    avant = Date.now();
    for (let k = 0; k < lot && i < n; k++, i++) {
      const bout = octets.subarray(i * PAS, (i + 1) * PAS);
      let bin = '';
      for (let j = 0; j < bout.length; j += 8000) bin += String.fromCharCode.apply(null, bout.subarray(j, j + 8000));
      ordre(maCamera, { sendData: { studioSebFichier: { id, i, n, type: p.type || 'audio/mpeg', d: btoa(bin) } }, type: 'pcs' });
    }
    const pct = Math.round(i / n * 100), s = envoisMusique.get(id);
    if (!s) return;                           // morceau retiré pendant l'envoi
    const change = s.pct !== pct;
    s.t = Date.now(); s.pct = pct;
    if (change && pct % 10 === 0) afficherMusiques();
  }
  afficherMusiques();
}

afficherMusiques();
