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
  const meme = etat.musique.idx === i;
  etat.musique = Object.assign({ idx: i, lecture: true, n: (etat.musique.n || 0) + (meme ? 0 : 1) }, options || {});
}
function afficherMusiques() {
  const box = $('#mu-liste'), max = maxMusiques(), n = etat.playlist.length;
  box.innerHTML = n ? '' : '<div class="vide">Aucune musique pour l\'instant. Elles passeront dans le son du live.</div>';
  etat.playlist.forEach((m, i) => {
    const on = etat.musique.idx === i && etat.musique.lecture;
    const el = document.createElement('div');
    el.className = 'mu-piste' + (on ? ' on' : '');
    const envoi = envoisMusique.get(m.id);
    const note = fichiersPerdus.has(m.id) ? '<span class="mu-note ko">Fichier introuvable : retire-le et ajoute-le à nouveau</span>'
      : envoi && envoi.pct < 100 ? `<span class="mu-note">Envoi vers la sortie : ${envoi.pct} %</span>` : '';
    el.innerHTML = `
      <div class="mu-ligne">
        <button class="petit mu-jouer" title="${on ? 'Pause' : 'Lancer ce morceau'}">${on ? '⏸' : '▶'}</button>
        <input type="text" class="mu-titre" maxlength="60" aria-label="Nom du morceau">
        <button class="petit mu-retirer" title="Retirer">✕</button>
      </div>
      <div class="mu-scenes">${SCENES_MUSIQUE.map(([s, nom, long]) => `<button type="button" data-s="${s}" title="Démarre tout seul pendant : ${long}" class="${etat.musiqueScenes[s] === m.id ? 'actif' : ''}">${nom}</button>`).join('')}</div>${note}`;
    const titre = el.querySelector('.mu-titre');
    titre.value = m.nom;
    titre.onchange = () => { m.nom = titre.value.trim() || m.nom; titre.value = m.nom; envoyer(); majEtatMusique(); };
    el.querySelector('.mu-jouer').onclick = () => {
      if (on) etat.musique.lecture = false; else jouerMorceau(i);
      envoyer(); afficherMusiques();
    };
    el.querySelector('.mu-retirer').onclick = () => {
      const enCours = etat.playlist[etat.musique.idx];
      etat.playlist.splice(i, 1);
      for (const s of Object.keys(etat.musiqueScenes)) if (etat.musiqueScenes[s] === m.id) delete etat.musiqueScenes[s];
      if (m.fichier) fichiers.oter(m.id).catch(() => {});
      fichiersPerdus.delete(m.id); envoisMusique.delete(m.id);
      // le morceau en cours garde sa place ; si c'est lui qu'on retire, la musique s'arrête
      const idx = enCours && enCours !== m ? etat.playlist.indexOf(enCours) : -1;
      etat.musique = idx >= 0 ? Object.assign({}, etat.musique, { idx }) : { idx: 0, lecture: false, n: (etat.musique.n || 0) + 1 };
      envoyer(); afficherMusiques();
    };
    el.querySelectorAll('.mu-scenes button').forEach(b => b.onclick = () => {
      const s = b.dataset.s;
      if (etat.musiqueScenes[s] === m.id) delete etat.musiqueScenes[s]; else etat.musiqueScenes[s] = m.id;
      // tu es déjà sur cette scène : la musique suit tout de suite
      if (s === etat.scene) { contexteMusique = null; musiqueAuto(true); }
      envoyer(); afficherMusiques();
    });
    box.appendChild(el);
  });
  $('#mu-compte').textContent = (n >= max ? `${n} sur ${max}. Plus de morceaux avec une formule au-dessus.` : `${n} sur ${max}`) + (n ? ' Coche les scènes où un morceau doit démarrer tout seul.' : '');
  $('#mu-ajouter').classList.toggle('plein', n >= max);
  majEtatMusique();
}
function majEtatMusique() {
  const m = etat.playlist[etat.musique.idx];
  $('#mu-lecture').textContent = etat.musique.lecture ? '⏸ Pause' : '▶ Lecture';
  $('#mu-etat').textContent = m ? (etat.musique.lecture ? 'En cours : ' : 'Prêt : ') + m.nom : '';
}
$('#mu-lecture').onclick = () => {
  if (!etat.playlist.length) return toast('Ajoute d\'abord une musique');
  etat.musique.lecture = !etat.musique.lecture; envoyer(); afficherMusiques();
};
$('#mu-suivante').onclick = () => {
  if (!etat.playlist.length) return;
  etat.musique = { idx: (etat.musique.idx + 1) % etat.playlist.length, lecture: true, n: (etat.musique.n || 0) + 1 };
  envoyer(); afficherMusiques();
};
$('#vol-musique').value = Math.round((etat.volMusique ?? 0.5) * 100);
$('#vol-musique').oninput = e => { etat.volMusique = e.target.value / 100; envoyerBientot(); };

/* ---------- Un morceau par scène ----------
   Appelé à chaque envoi de l'état : dès que la scène change (ou qu'un quiz commence),
   le morceau lié démarre en boucle ; si la nouvelle scène n'en a pas, celui lancé par une scène s'arrête. */
let contexteMusique = null;
function musiqueAuto(force) {
  const liens = etat.musiqueScenes || {};
  const ctx = etat.quiz && etat.quiz.active && liens.quiz ? 'quiz' : etat.scene;
  if (ctx === contexteMusique) return;
  const premier = contexteMusique === null && !force;
  contexteMusique = ctx;
  if (premier) return;                       // à l'ouverture de la régie, on ne touche à rien
  const idx = etat.playlist.findIndex(m => m.id === liens[ctx]);
  if (idx >= 0) {
    if (!(etat.musique.lecture && etat.musique.idx === idx)) jouerMorceau(idx, { boucle: true, auto: true });
    else Object.assign(etat.musique, { boucle: true, auto: true });
  } else if (etat.musique.auto) {
    etat.musique = Object.assign({}, etat.musique, { lecture: false, auto: false, boucle: false });
  } else return;
  setTimeout(afficherMusiques, 0);
}

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
