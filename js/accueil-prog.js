/* OBSeb : accueil, programmer un live (jour et heure) et lui donner ses miniatures.
   La date est rangée dans le live (session.debut) : elle voyage avec le lien des invités, qui la voient à leur heure.
   Les miniatures sont mises aux tailles demandées par les plateformes (horizontale 1280 × 720 en 16:9, moins de 2 Mo,
   la règle de YouTube ; verticale 1080 × 1920) et gardées dans ce navigateur, prêtes à télécharger.
   Honnêteté : programmer ici ne crée pas encore le direct sur YouTube ou Twitch (la connexion directe n'existe pas encore). */
'use strict';

const RESTE_A_VENIR = 6 * 3600e3;   // un live programmé reste « à venir » jusqu'à 6 h après son heure
const aVenir = s => !!(s && s.debut && s.debut > Date.now() - RESTE_A_VENIR);
const deux = n => String(n).padStart(2, '0');
const valDate = ts => { const d = new Date(ts); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; };
const valHeure = ts => { const d = new Date(ts); return `${deux(d.getHours())}:${deux(d.getMinutes())}`; };
function lireDateHeure(date, heure) {
  if (!date || !heure) return 0;
  const t = new Date(`${date}T${heure}`).getTime();
  return isFinite(t) ? t : 0;
}
// ce soir à 21 h si c'est encore possible, sinon demain
function soirProchain() { const d = new Date(); d.setHours(21, 0, 0, 0); if (d.getTime() < Date.now() + 15 * 60000) d.setDate(d.getDate() + 1); return d.getTime(); }

/* ----- Dans le formulaire de création : « Tout de suite » ou « Programmer » ----- */
function majQuand() {
  const prog = !!brouillon.debut;
  $$('#f-quand button').forEach(b => b.classList.toggle('actif', (b.dataset.q === 'plus-tard') === prog));
  $('#f-quand-date').hidden = !prog;
  if (prog) { $('#f-date').value = valDate(brouillon.debut); $('#f-heure').value = valHeure(brouillon.debut); }
  $('#f-date').min = valDate(Date.now());
  $('#f-quand-resume').textContent = prog ? `${quandTexte(brouillon.debut)} · ${dansTexte(brouillon.debut)}` : '';
}
$$('#f-quand button').forEach(b => b.onclick = () => {
  if (b.dataset.q === 'plus-tard') { if (!brouillon.debut) brouillon.debut = soirProchain(); } else delete brouillon.debut;
  majQuand();
});
const lireQuand = () => { const t = lireDateHeure($('#f-date').value, $('#f-heure').value); if (t) brouillon.debut = t; majQuand(); };
$('#f-date').onchange = lireQuand; $('#f-heure').onchange = lireQuand;

/* ----- Sur la carte du live : la date, et les miniatures ----- */
const FORMATS_MINI = {
  h: { w: 1280, h: 720, nom: 'Horizontale', detail: '1280 × 720', pour: 'YouTube, Twitch, Facebook', fichier: 'horizontale' },
  v: { w: 1080, h: 1920, nom: 'Verticale', detail: '1080 × 1920', pour: 'Shorts, TikTok, Reels', fichier: 'verticale' },
};
const POIDS_MAX_MINI = 2e6;   // YouTube refuse une miniature de plus de 2 Mo
const cleMini = (room, f) => `mini:${room}:${f}`;

/* Met une image à la taille exacte du format : recadrée au centre si ses proportions diffèrent, en JPEG sous 2 Mo */
async function conformerMiniature(fichier, f) {
  const F = FORMATS_MINI[f];
  const bmp = await createImageBitmap(fichier);
  const k = Math.max(F.w / bmp.width, F.h / bmp.height);
  const c = document.createElement('canvas'); c.width = F.w; c.height = F.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, F.w, F.h);
  ctx.drawImage(bmp, (F.w - bmp.width * k) / 2, (F.h - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
  let blob = null;
  for (const q of [0.92, 0.85, 0.78, 0.7, 0.6]) {
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= POIDS_MAX_MINI) break;
  }
  if (!blob) throw new Error('image illisible');
  return { blob, recadree: Math.abs(bmp.width / bmp.height - F.w / F.h) > 0.02, agrandie: k > 1.4 };
}
async function poserMiniature(room, f, fichier) {
  if (!fichier) return;
  if (!/^image\//.test(fichier.type)) return toast('Ce fichier n\'est pas une image');
  let r;
  try { r = await conformerMiniature(fichier, f); } catch (e) { return toast('Impossible de lire cette image'); }
  try { await fichiers.mettre(cleMini(room, f), r.blob); } catch (e) { return toast('Ce navigateur refuse de garder l\'image'); }
  const tout = lire(), e = tout.find(x => x.session.room === room);
  if (!e) return;
  e.minis = Object.assign({}, e.minis, { [f]: { poids: r.blob.size, ts: Date.now() } });
  ecrire(tout); afficherSessions();
  const F = FORMATS_MINI[f];
  toast(`Miniature ${F.nom.toLowerCase()} prête en ${F.detail}` + (r.agrandie ? '. L\'image était petite : elle a été agrandie.' : r.recadree ? '. Elle a été recadrée au centre.' : ''));
}
async function oterMiniature(room, f) {
  try { await fichiers.oter(cleMini(room, f)); } catch (e) { /* rien */ }
  const tout = lire(), e = tout.find(x => x.session.room === room);
  if (e && e.minis) { delete e.minis[f]; ecrire(tout); }
  afficherSessions();
}
function oublierMinis(room) { for (const f of Object.keys(FORMATS_MINI)) fichiers.oter(cleMini(room, f)).catch(() => {}); }
async function telechargerMiniature(session, f) {
  const blob = await fichiers.lire(cleMini(session.room, f)).catch(() => null);
  if (!blob) return toast('Cette miniature n\'est plus dans ce navigateur : ajoute-la à nouveau');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `miniature-${slug(session.titre, 30) || 'live'}-${FORMATS_MINI[f].fichier}.jpg`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function garnirProg(el, session) {
  const zone = el.querySelector('.prog-zone');
  if (!zone) return;
  const entree = lire().find(x => x.session.room === session.room) || {};
  const menu = el.querySelector('[data-a=programmer]');
  if (menu) menu.firstChild.textContent = session.debut ? 'Changer la date' : 'Programmer';
  const agenda = el.querySelector('[data-a=agenda]');
  if (agenda) agenda.hidden = !aVenir(session);
  if (!aVenir(session)) { zone.hidden = true; return; }
  zone.hidden = false;
  zone.innerHTML = `
    <button type="button" class="prog-badge" title="Changer le jour ou l'heure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.500" y="5" width="17" height="15" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/></svg><b></b><span></span></button>
    <div class="minis-tete"><span>Miniatures</span><small>mises à la bonne taille toutes seules</small></div>
    <div class="minis">${Object.entries(FORMATS_MINI).map(([f, F]) => `
      <div class="mini-case ${f}" data-f="${f}" title="${F.nom} : ${F.detail} (${F.pour})">
        <button type="button" class="mini-ajout"><i>+</i><b>${F.nom}</b><small>${F.detail}</small></button>
        <img alt="" hidden>
        <div class="mini-actions" hidden><button type="button" data-m="dl" title="Télécharger la miniature ${F.nom.toLowerCase()} (${F.detail}, JPEG)">Télécharger</button><button type="button" data-m="oter" title="Retirer cette miniature">✕</button></div>
        <input type="file" accept="image/*" hidden>
      </div>`).join('')}</div>`;
  zone.querySelector('.prog-badge b').textContent = quandTexte(session.debut);
  zone.querySelector('.prog-badge span').textContent = dansTexte(session.debut);
  zone.querySelector('.prog-badge').onclick = () => ouvrirProgrammation(session.room);
  zone.querySelectorAll('.mini-case').forEach(boite => {
    const f = boite.dataset.f, champ = boite.querySelector('input'), img = boite.querySelector('img');
    const choisir = () => champ.click();
    boite.querySelector('.mini-ajout').onclick = choisir; img.onclick = choisir;
    champ.onchange = () => { poserMiniature(session.room, f, champ.files[0]); champ.value = ''; };
    boite.ondragover = e => { e.preventDefault(); boite.classList.add('survol'); };
    boite.ondragleave = () => boite.classList.remove('survol');
    boite.ondrop = e => { e.preventDefault(); boite.classList.remove('survol'); poserMiniature(session.room, f, e.dataTransfer.files[0]); };
    boite.querySelector('[data-m=dl]').onclick = () => telechargerMiniature(session, f);
    boite.querySelector('[data-m=oter]').onclick = () => oterMiniature(session.room, f);
    if (entree.minis && entree.minis[f]) fichiers.lire(cleMini(session.room, f)).then(blob => {
      if (!blob) return;
      img.src = URL.createObjectURL(blob); img.hidden = false; img.title = 'Cliquer pour changer d\'image';
      boite.querySelector('.mini-ajout').hidden = true; boite.querySelector('.mini-actions').hidden = false; boite.classList.add('pleine');
    }).catch(() => {});
  });
}

/* ----- La fenêtre « Programmer » ----- */
function ouvrirProgrammation(room) {
  const entree = lire().find(x => x.session.room === room);
  if (!entree) return;
  const s = entree.session, depart = aVenir(s) ? s.debut : soirProchain();
  const f = document.createElement('div');
  f.className = 'confirmation';
  f.innerHTML = `<div class="confirmation-boite prog-boite" role="dialog" aria-modal="true">
    <h3></h3>
    <div class="prog-champs"><label>Le jour<input type="date" class="p-date"></label><label>L'heure<input type="time" class="p-heure" step="300"></label></div>
    <div class="prog-raccourcis"></div>
    <p class="prog-resume"></p>
    <p class="aide">Tes invités verront la date dans leur lien, à leur heure. Sur YouTube ou Twitch, programme aussi ton direct de ton côté : la connexion directe n'est pas encore ouverte.</p>
    <div class="confirmation-boutons"><button class="retirer" ${s.debut ? '' : 'hidden'}>Retirer la date</button><span style="flex:1"></span><button class="non">Annuler</button><button class="oui primaire">Programmer</button></div>
  </div>`;
  f.querySelector('h3').textContent = `Programmer « ${s.titre} »`;
  const pd = f.querySelector('.p-date'), ph = f.querySelector('.p-heure'), resume = f.querySelector('.prog-resume');
  pd.min = valDate(Date.now());
  const poser = ts => { pd.value = valDate(ts); ph.value = valHeure(ts); maj(); };
  const maj = () => {
    const t = lireDateHeure(pd.value, ph.value);
    resume.textContent = !t ? 'Choisis le jour et l\'heure.' : t < Date.now() ? 'Cette heure est déjà passée.' : `${quandTexte(t)} · ${dansTexte(t)}`;
    resume.classList.toggle('ko', !!t && t < Date.now());
  };
  pd.oninput = maj; ph.oninput = maj;
  // raccourcis : ce soir, demain, samedi, à 21 h
  const a21 = j => { const d = new Date(); d.setDate(d.getDate() + j); d.setHours(21, 0, 0, 0); return d.getTime(); };
  const jusquaSamedi = (6 - new Date().getDay() + 7) % 7 || 7;
  [['Ce soir, 21 h', a21(0)], ['Demain, 21 h', a21(1)], ['Samedi, 21 h', a21(jusquaSamedi)]].filter(([, t]) => t > Date.now() + 10 * 60000).forEach(([nom, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'petit'; b.textContent = nom; b.onclick = () => poser(t);
    f.querySelector('.prog-raccourcis').appendChild(b);
  });
  const fin = () => { f.remove(); document.removeEventListener('keydown', touche); };
  const touche = e => { if (e.key === 'Escape') fin(); };
  const enregistrer = t => {
    const tout = lire(), e = tout.find(x => x.session.room === room);
    if (e) { if (t) e.session.debut = t; else delete e.session.debut; ecrire(tout); }
    fin(); afficherSessions();
  };
  f.querySelector('.oui').onclick = () => {
    const t = lireDateHeure(pd.value, ph.value);
    if (!t) return toast('Choisis le jour et l\'heure');
    if (t < Date.now()) return toast('Cette heure est déjà passée');
    enregistrer(t); toast(`Live programmé : ${quandTexte(t)}`);
  };
  f.querySelector('.retirer').onclick = () => { enregistrer(0); toast('Date retirée'); };
  f.querySelector('.non').onclick = fin;
  f.addEventListener('click', e => { if (e.target === f) fin(); });
  document.addEventListener('keydown', touche);
  document.body.appendChild(f);
  poser(depart); ph.focus();
}

/* le compte à rebours des cartes se met à jour tout seul */
setInterval(() => {
  const l = lire();
  $$('#sessions .session').forEach(el => {
    const e = l.find(x => x.session.room === el.dataset.room), b = el.querySelector('.prog-badge span');
    if (e && b && e.session.debut) b.textContent = dansTexte(e.session.debut);
  });
}, 30000);

majQuand();
afficherSessions();
