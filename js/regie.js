/* OBSeb : la régie */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const session = lireSession();
const cle = hashParams().get('k');
const MAX_ANTENNE = 10;          // toi + 9 invités

if (!session || !cle) {
  $('#bloque').hidden = false;
  throw new Error('Lien de régie incomplet');
}
$('#app').hidden = false;

const ID_HOTE = idHote(session), ID_ECRAN = idEcran(session);
const L = liens(session, cle);
const theme = themeComplet(session);
const CLE_STOCKAGE = 'studioSeb:etat:' + session.room;

/* ----- État (restauré si la page est rechargée) ----- */
let etat = etatParDefaut(session);
try {
  const sauve = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
  if (sauve) etat = Object.assign(etat, sauve);
} catch (e) { /* stockage indisponible */ }
etat.muet = etat.muet || {};
etat.noms[ID_HOTE] = etat.noms[ID_HOTE] || session.hote;

const presents = new Map();   // id -> { vu: timestamp } (connectés en ce moment)
const cartes = new Map();     // id -> { el, iframe, vu }
let listeRecue = false;
const qualites = new Map();   // id -> { w, h, kbps } envoyé par chaque invité       // vdo.ninja a-t-il déjà répondu à getStreamIDs ?

/* ----- En-tête ----- */
$('#titre-session').textContent = session.titre;
$('#sous-session').textContent = `Thème : ${theme.nom || 'perso'} · salle ${session.room}`;
document.title = `${session.titre} · Régie`;
$('#bandeau').value = etat.bandeau || session.titre;
$('#message').value = etat.message || '';
$('#surbrillance').checked = etat.surbrillance !== false;

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('vu');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('vu'), 2200);
}
async function copier(txt, msg) {
  try { await navigator.clipboard.writeText(txt); toast(msg); }
  catch (e) { prompt('Copie ce lien :', txt); }
}
$('#btn-invite').onclick = () => copier(L.invite, 'Lien invités copié : envoie-le à tes invités');
$('#btn-obs').onclick = () => copier(L.sortie, 'Lien OBS copié : colle-le dans une source navigateur 1920x1080');
$('#btn-sortie').onclick = () => window.open(L.sortie, 'sortie', 'width=960,height=540');

/* ----- Ma caméra (le seul endroit qui ouvre la Cam Link) ----- */
const maCamera = $('#ma-camera');
maCamera.src = urlPublier(session, ID_HOTE, session.hote, { noaudio: true });

/* ----- Aperçu de l'antenne ----- */
const apercu = $('#apercu');
apercu.src = `sortie.html?preview=regie${location.hash.replace(/&k=[^&]*/, '')}`;
apercu.addEventListener('load', () => envoyer());

/* ----- Partage d'écran ----- */
$('#btn-ecran').onclick = () => {
  const f = $('#mon-ecran');
  f.src = vdo({ room: session.room, push: ID_ECRAN, label: 'Partage', screenshare: true, quality: 0,
    novideo: true, noaudio: true, ln: 'fr', cleanish: true });
  f.hidden = false; $('#btn-ecran').hidden = true; $('#btn-ecran-stop').hidden = false;
  partageActif = true;
};
$('#btn-ecran-stop').onclick = () => {
  const f = $('#mon-ecran'); f.src = 'about:blank'; f.hidden = true;
  $('#btn-ecran').hidden = false; $('#btn-ecran-stop').hidden = true;
  partageActif = false; presents.delete(ID_ECRAN);
  if (etat.scene === 'partage') changerScene('live');
};

/* ----- Envoi de l'état vers la sortie OBS et les invités ----- */
function envoyer() {
  etat.ts = Date.now();
  const st = JSON.parse(JSON.stringify(etat));
  // garder uniquement les personnes présentes (et toi)
  st.noms = {};
  for (const [id, nom] of Object.entries(etat.noms)) if (id === ID_HOTE || presents.has(id)) st.noms[id] = nom;
  st.onair = etat.onair.filter(id => id in st.noms);
  ordre(maCamera, { sendData: { [CANAL]: st }, type: 'pcs' });     // vers OBS et les coulisses
  ordre(apercu, { [CANAL]: st });                                  // vers l'aperçu de la régie
  try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat)); } catch (e) { /* rien */ }
  majInterface();
}
setInterval(envoyer, 2000);   // renvoi régulier : un OBS relancé retrouve l'état tout seul

/* ----- Scènes et mises en page ----- */
/* Quand tu passes sur la scène Fin, le live est rangé dans « Mes lives » */
function noterLiveTermine() {
  try {
    const l = JSON.parse(localStorage.getItem('studioSeb:sessions') || '[]');
    let e = l.find(x => x.session.room === session.room);
    if (!e) { e = { session, cle }; l.unshift(e); }
    e.live = Object.assign({ fichier: '', replay: '' }, e.live, { date: Date.now() });
    localStorage.setItem('studioSeb:sessions', JSON.stringify(l));
  } catch (err) { /* stockage indisponible */ }
}
function changerScene(s) {
  if (s === 'fin' && etat.scene !== 'fin') noterLiveTermine();
  if (s === 'partage' && !presents.has(ID_ECRAN)) toast("Lance d'abord le partage d'écran (colonne de gauche)");
  etat.scene = s; envoyer();
}
function changerLayout(l) { etat.layout = l; envoyer(); }
$$('[data-scene]').forEach(b => b.onclick = () => changerScene(b.dataset.scene));
$$('[data-layout]').forEach(b => b.onclick = () => changerLayout(b.dataset.layout));
$('#auto-antenne').checked = !!etat.autoAntenne;
$('#auto-antenne').onchange = e => { etat.autoAntenne = e.target.checked; envoyer(); };
$('#vol-musique').value = Math.round((etat.volMusique ?? 0.5) * 100);
$('#vol-musique').oninput = e => { etat.volMusique = e.target.value / 100; envoyerBientot(); };
$('#surbrillance').onchange = e => { etat.surbrillance = e.target.checked; envoyer(); };
$('#bandeau').oninput = e => { etat.bandeau = e.target.value; envoyerBientot(); };
$('#message').oninput = e => { etat.message = e.target.value; envoyerBientot(); };
function envoyerBientot() { clearTimeout(envoyerBientot.t); envoyerBientot.t = setTimeout(envoyer, 250); }

$$('[data-minutes]').forEach(b => b.onclick = () => { etat.fin = Date.now() + b.dataset.minutes * 60000; envoyer(); toast(`Compte à rebours : ${b.dataset.minutes} min`); });
$('#btn-heure').onclick = () => {
  const v = $('#heure-debut').value; if (!v) return toast("Choisis d'abord une heure");
  const [h, m] = v.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
  if (d < Date.now()) d.setDate(d.getDate() + 1);
  etat.fin = d.getTime(); envoyer(); toast(`Compte à rebours jusqu'à ${v}`);
};
$('#btn-sans-compte').onclick = () => { etat.fin = null; envoyer(); };

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const scenes = { '1': 'intro', '2': 'live', '3': 'partage', '4': 'fin', '&': 'intro', 'é': 'live', '"': 'partage', "'": 'fin' };
  const layouts = { g: 'grille', i: 'interview', s: 'solo' };
  if (scenes[e.key]) changerScene(scenes[e.key]);
  else if (layouts[e.key.toLowerCase()]) changerLayout(layouts[e.key.toLowerCase()]);
});

/* ----- Participants ----- */
function basculerAntenne(id) {
  const i = etat.onair.indexOf(id);
  if (i >= 0) etat.onair.splice(i, 1);
  else {
    if (etat.onair.length >= MAX_ANTENNE) return toast(`${MAX_ANTENNE} personnes maximum à l'antenne`);
    etat.onair.push(id);
  }
  envoyer();
}
function creerCarte(id) {
  const estHote = id === ID_HOTE;
  const el = document.createElement('div');
  el.className = 'participant';
  el.innerHTML = `
    <div class="vignette">${estHote ? '<div class="moi">Toi<br>(ta caméra est à gauche)</div>' : ''}</div>
    <div>
      <input type="text" class="nom" title="Nom affiché à l'écran">
      <div class="reglages"><span title="Volume dans le live">🔊</span><input type="range" min="0" max="100" step="1" class="vol"><span class="pct"></span></div>
      <div class="vu"><i></i></div>
      ${estHote ? '' : '<div class="qualite aide"></div>'}
    </div>
    <div class="actions">
      <button class="petit antenne-btn"></button>
      <button class="petit muet-btn">Couper le son</button>
      <button class="petit focus-btn" title="Afficher cette personne seule">En grand</button>
      ${estHote ? '' : '<button class="petit haut-btn" title="Monter dans l\'ordre d\'affichage">▲</button>'}
    </div>`;
  let iframe = null;
  if (!estHote) {
    iframe = document.createElement('iframe');
    iframe.allow = IFRAME_ALLOW;
    iframe.src = urlVoir(session, id, { bitrate: 250, transparent: false });
    iframe.addEventListener('load', () => { ordre(iframe, { getLoudness: true }); volumeCasque(id); });
    el.querySelector('.vignette').appendChild(iframe);
  }
  const nom = el.querySelector('.nom');
  nom.value = etat.noms[id] || '';
  nom.oninput = () => { etat.noms[id] = nom.value; envoyerBientot(); };
  const vol = el.querySelector('.vol');
  vol.value = Math.round((etat.vol[id] ?? 1) * 100);
  vol.oninput = () => { etat.vol[id] = vol.value / 100; volumeCasque(id); majCarte(id); envoyerBientot(); };
  el.querySelector('.antenne-btn').onclick = () => basculerAntenne(id);
  el.querySelector('.muet-btn').onclick = () => { etat.muet[id] = !etat.muet[id]; volumeCasque(id); envoyer(); };
  el.querySelector('.focus-btn').onclick = () => {
    if (!etat.onair.includes(id)) etat.onair.push(id);
    etat.focus = id; etat.layout = 'solo'; envoyer();
  };
  const haut = el.querySelector('.haut-btn');
  if (haut) haut.onclick = () => {
    const i = etat.onair.indexOf(id);
    if (i > 0) { [etat.onair[i - 1], etat.onair[i]] = [etat.onair[i], etat.onair[i - 1]]; envoyer(); }
  };
  const c = { el, iframe, niveau: 0 };
  cartes.set(id, c);
  return c;
}
/* Ce que tu entends dans ton casque suit le même volume que le live */
function volumeCasque(id) {
  const c = cartes.get(id); if (!c || !c.iframe) return;
  ordre(c.iframe, { volume: etat.muet[id] ? 0 : (etat.vol[id] ?? 1) });
}
function majCarte(id) {
  const c = cartes.get(id); if (!c) return;
  const enDirect = etat.onair.includes(id);
  c.el.classList.toggle('antenne', enDirect);
  c.el.classList.toggle('parti', id !== ID_HOTE && !presents.has(id));
  const b = c.el.querySelector('.antenne-btn');
  b.textContent = enDirect ? "Retirer de l'antenne" : "Mettre à l'antenne";
  b.className = 'petit antenne-btn' + (enDirect ? ' rouge' : ' primaire');
  c.el.querySelector('.muet-btn').textContent = etat.muet[id] ? 'Rétablir le son' : 'Couper le son';
  c.el.querySelector('.muet-btn').classList.toggle('actif', !!etat.muet[id]);
  const qe = c.el.querySelector('.qualite'), q = qualites.get(id);
  if (qe) {
    if (!q) qe.textContent = 'Qualité : en attente…';
    else {
      const res = q.h ? `${q.h}p` : '?', debit = q.kbps ? `${(q.kbps / 1000).toFixed(1).replace('.', ',')} Mb/s` : '';
      const bon = q.h >= 720 && q.kbps >= 1500, moyen = q.h >= 480 && q.kbps >= 600;
      qe.innerHTML = `<span style="color:${bon ? 'var(--ui-green)' : moyen ? 'var(--ui-accent)' : 'var(--ui-red)'}">●</span> ${res} ${debit} · ${bon ? 'bonne image' : moyen ? 'image moyenne' : 'connexion faible'}`;
    }
  }
  c.el.querySelector('.pct').textContent = (etat.muet[id] ? 0 : Math.round((etat.vol[id] ?? 1) * 100)) + '%';
}
function majInterface() {
  const liste = $('#liste');
  const ids = [ID_HOTE, ...[...presents.keys()].filter(id => id !== ID_HOTE && id !== ID_ECRAN)];
  for (const id of ids) if (!cartes.has(id)) liste.appendChild(creerCarte(id).el);
  for (const [id, c] of cartes) if (!ids.includes(id)) { c.el.remove(); cartes.delete(id); }
  // ordre : à l'antenne d'abord (dans l'ordre d'affichage), puis coulisses
  const tri = [...ids].sort((a, b) => {
    const ia = etat.onair.indexOf(a), ib = etat.onair.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  tri.forEach(id => liste.appendChild(cartes.get(id).el));
  ids.forEach(majCarte);
  const nbInvites = ids.length - 1;
  $('#nb-part').textContent = `· ${nbInvites} invité${nbInvites > 1 ? 's' : ''} · ${etat.onair.filter(id => ids.includes(id)).length} à l'antenne`;
  if (!$('#liste .vide') && nbInvites === 0) liste.insertAdjacentHTML('beforeend', '<div class="vide">Personne en coulisses pour le moment. Envoie le lien invités.</div>');
  if (nbInvites > 0) $('#liste .vide')?.remove();
  $$('[data-scene]').forEach(b => b.classList.toggle('actif', b.dataset.scene === etat.scene));
  $$('[data-layout]').forEach(b => b.classList.toggle('actif', b.dataset.layout === etat.layout));
  $('#badge-scene').textContent = { intro: 'INTRO', live: 'LIVE', partage: 'PARTAGE', fin: 'FIN' }[etat.scene];
}

/* ----- Qui est connecté ? (liste fournie par vdo.ninja) ----- */
function arrivee(id, label) {
  if (!id || id === ID_HOTE) return;
  const nouveau = !presents.has(id);
  presents.set(id, { vu: Date.now() });
  if (id !== ID_ECRAN && label && !etat.noms[id]) etat.noms[id] = label;
  if (id !== ID_ECRAN && !etat.noms[id]) etat.noms[id] = 'Invité';
  if (nouveau && id !== ID_ECRAN && etat.autoAntenne && !etat.onair.includes(id) && etat.onair.length < MAX_ANTENNE) etat.onair.push(id);
  if (nouveau) {
    if (id === ID_ECRAN) toast("Partage d'écran prêt : touche 3 pour l'afficher");
    else toast(`${etat.noms[id]} est en coulisses`);
    envoyer();
  }
}
let partageActif = false;
setInterval(() => {
  ordre(maCamera, { getStreamIDs: true });
  ordre(maCamera, { getStats: true });
  if (partageActif) presents.set(ID_ECRAN, { vu: Date.now() });
  // retire ceux qui ne répondent plus depuis 12 s (seulement si vdo.ninja fournit bien la liste)
  if (!listeRecue) return;
  let change = false;
  for (const [id, p] of presents) if (Date.now() - p.vu > 12000) { presents.delete(id); change = true; }
  if (change) envoyer();
}, 2000);

addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (e.source === maCamera.contentWindow) {
    if (d.stats) {
      const q = resumeStats(d.stats);
      const n = d.stats.total_outbound_connections;
      const el = $('#etat-camera');
      if (typeof n === 'number' && n === 0) el.innerHTML = '<span style="color:var(--ui-red)">●</span> Personne ne reçoit ta caméra pour l\'instant (clique sur Démarrer, puis vérifie la source OBS)';
      else if (q.h || n) el.innerHTML = `<span style="color:var(--ui-green)">●</span> Ta caméra part${q.h ? ' en ' + q.h + 'p' : ''}${q.kbps ? ' · ' + (q.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}${typeof n === 'number' ? ' · reçue par ' + n + ' écran' + (n > 1 ? 's' : '') : ''}`;
    }
    if (d.streamIDs) {
      listeRecue = true;
      const liste = Array.isArray(d.streamIDs) ? Object.fromEntries(d.streamIDs.map(x => [x, ''])) : d.streamIDs;
      for (const [id, label] of Object.entries(liste)) if (presents.has(id) || id) arrivee(id, typeof label === 'string' ? label : label?.label);
    }
    if (d.action === 'guest-connected' && d.streamID) arrivee(d.streamID, d.value && d.value.label);
    const salut = d.dataReceived && d.dataReceived.studioSebSalut;
    if (salut && typeof salut.id === 'string' && salut.id.startsWith(session.room + '_')) {
      listeRecue = true;
      arrivee(salut.id, String(salut.nom || '').slice(0, 28));
      if (salut.q) { qualites.set(salut.id, salut.q); majCarte(salut.id); }
    }
    if (d.action === 'push-connection' && d.streamID && d.value === false) {
      presents.delete(d.streamID); envoyer();
    }
    return;
  }
  if (d.loudness !== undefined) {
    for (const c of cartes.values()) {
      if (c.iframe && e.source === c.iframe.contentWindow) { c.niveau = Math.max(c.niveau, niveauSonore(d)); break; }
    }
  }
});
setInterval(() => {
  for (const c of cartes.values()) {
    c.niveau *= 0.7;
    const bar = c.el.querySelector('.vu i');
    if (bar) bar.style.width = Math.min(100, c.niveau * 2) + '%';
  }
}, 120);

envoyer();
