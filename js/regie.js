/* OBSeb : la régie */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const session = lireSession();
const cle = hashParams().get('k');
const MAX_ANTENNE = 11;          // toi + 10 invités

if (!session || !cle) {
  $('#bloque').hidden = false;
  throw new Error('Lien de régie incomplet');
}
$('#app').hidden = false;

const ID_HOTE = idHote(session);
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
const nomsEcrans = new Map();  // id d'écran -> nom affiché
const qualites = new Map();   // id -> { w, h, kbps } envoyé par chaque invité       // vdo.ninja a-t-il déjà répondu à getStreamIDs ?

/* ----- En-tête ----- */
$('#titre-session').textContent = session.titre;
$('#sous-session').textContent = `Thème : ${theme.nom || 'perso'}`;
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
$('#btn-vertical').onclick = () => copier(L.vertical, 'Lien vertical copié : source navigateur 1080x1920');
$('#btn-sortie').onclick = () => window.open(L.sortie, 'sortie', 'width=960,height=540');

/* ----- Ma caméra (le seul endroit qui ouvre la Cam Link) ----- */
const maCamera = $('#ma-camera');
const CLE_CAM = 'studioSeb:appareils:hote';
const reglageCam = ReglagesMedia({ boite: $('#cam-reglage'), cle: CLE_CAM, texteBouton: 'Démarrer ma caméra', surDemarrer: demarrerCamera });
function demarrerCamera(app) {
  $('#cam-reglage').hidden = true; $('#cam-direct').hidden = false;
  $('#cam-appareils').textContent = [app.nomCam, app.nomMic].filter(Boolean).join(' · ');
  // la salle démarre directement avec les appareils choisis, sans son propre écran de réglage
  maCamera.src = urlPublier(session, ID_HOTE, session.hote, { noaudio: true, vd: app.vd, ad: app.ad, autostart: true, proaudio: true, width: 1920, height: 1080, maxframerate: 30, contenthint: 'detail' });   // 1080p tenu : le navigateur baisse les images/s plutôt que la définition   // son pro : stéréo, sans anti-écho (casque)
}
$('#btn-cam-changer').onclick = () => {
  if (etat.scene !== 'intro' && etat.onair.includes(ID_HOTE) && !confirm('Ta caméra va se couper quelques secondes pendant le changement. Continuer ?')) return;
  maCamera.src = 'about:blank';
  $('#cam-direct').hidden = true; $('#cam-reglage').hidden = false;
  reglageCam.ouvrir();
};
const retenus = appareilsRetenus(CLE_CAM);
if (retenus) demarrerCamera(retenus);
else { $('#cam-reglage').hidden = false; reglageCam.ouvrir(); }

/* ----- Aperçu de l'antenne ----- */
const apercu = $('#apercu');
apercu.src = `sortie.html?preview=regie${location.hash.replace(/&k=[^&]*/, '')}`;
apercu.addEventListener('load', () => envoyer());
let apercuVertical = false;
$('#btn-apercu-format').onclick = () => {
  apercuVertical = !apercuVertical;
  apercu.src = `sortie.html?preview=regie${apercuVertical ? '&format=vertical&zones=1' : ''}${location.hash.replace(/&k=[^&]*/, '')}`;
  apercu.parentElement.style.aspectRatio = apercuVertical ? '9/16' : '16/9';
  apercu.parentElement.style.maxHeight = apercuVertical ? '640px' : '';
  apercu.parentElement.style.margin = apercuVertical ? '0 auto' : '';
  apercu.parentElement.style.width = apercuVertical ? '360px' : '';
  $('#btn-apercu-format').textContent = apercuVertical ? 'Voir en horizontal' : 'Voir en vertical';
};

/* ----- Envoi de l'état vers la sortie OBS et les invités ----- */
function envoyer() {
  etat.ts = Date.now();
  const st = JSON.parse(JSON.stringify(etat));
  // garder uniquement les personnes présentes (et toi)
  st.noms = {};
  for (const [id, nom] of Object.entries(etat.noms)) if (id === ID_HOTE || presents.has(id)) st.noms[id] = nom;
  st.onair = etat.onair.filter(id => id in st.noms);
  // les questions préparées (avec les bonnes réponses) restent dans la régie
  if (st.quiz) st.quiz = { active: st.quiz.active, afficherScores: st.quiz.afficherScores, classement: st.quiz.classement, style: st.quiz.style };
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
  // limiteur : le compte part au premier passage en Live, et repart de zéro si on revient à l'intro après la fin
  if ((s === 'live' || s === 'partage') && !etat.debutLive) etat.debutLive = Date.now();
  if (s === 'intro' && etat.scene === 'fin') { etat.debutLive = 0; limiteAtteinte = false; }
  if (s === 'partage' && !(etat.sources || []).some(x => x && x.actif && x.ref)) toast('Aucune source affichée : active au moins une source (colonne de gauche)');
  etat.scene = s; envoyer();
}
function changerLayout(l) { etat.layout = l; envoyer(); }
$$('[data-scene]').forEach(b => b.onclick = () => changerScene(b.dataset.scene));

/* ----- Limiteur de durée : visible dans la régie seulement (ni les invités ni les spectateurs) ----- */
const LIMITE_MS = (+session.limite || 0) * 60000;
let limiteAtteinte = false;
const hms = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); };
const dureeTexte = min => (min >= 60 ? Math.floor(min / 60) + ' h' : '') + (min % 60 ? ' ' + (min % 60) + (min >= 60 ? '' : ' min') : '');
function majLimiteur() {
  const el = $('#limiteur');
  if (!LIMITE_MS) { el.hidden = true; return; }
  el.hidden = false;
  if (!etat.debutLive) { el.className = 'limiteur'; el.textContent = `Limite ${dureeTexte(+session.limite).trim()} · démarre au passage en Live`; return; }
  const reste = etat.debutLive + LIMITE_MS - Date.now();
  if (etat.scene === 'fin') { el.className = 'limiteur'; el.textContent = 'Live terminé'; return; }
  if (reste <= 0) {
    el.className = 'limiteur alerte'; el.textContent = 'Temps écoulé';
    if (!limiteAtteinte) { limiteAtteinte = true; changerScene('fin'); toast('Durée maximale atteinte : le live passe sur l\'écran de fin'); }
    return;
  }
  const alerte = reste <= 20 * 60000;
  el.className = 'limiteur' + (alerte ? ' alerte' : '');
  el.textContent = alerte ? `Attention : plus que ${hms(reste)}` : `Fin du live dans ${hms(reste)}`;
}
setInterval(majLimiteur, 250); majLimiteur();
$$('[data-layout]').forEach(b => b.onclick = () => changerLayout(b.dataset.layout));
$('#auto-antenne').checked = !!etat.autoAntenne;
$('#auto-antenne').onchange = e => { etat.autoAntenne = e.target.checked; envoyer(); };
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
  if (e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=radio]), textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
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
    <div class="vignette"></div>
    <div>
      <input type="text" class="nom" title="Nom affiché à l'écran">
      <div class="reglages"><span title="Volume dans le live">🔊</span><input type="range" min="0" max="100" step="1" class="vol"><span class="pct"></span></div>
      <div class="vu"><i></i></div>
      ${estHote ? '' : '<div class="qualite aide"></div>'}
    </div>
    <div class="actions">
      <button class="petit antenne-btn"></button>
      <button class="petit muet-btn">Muet</button>
      <button class="petit focus-btn" title="Afficher cette personne seule à l'écran">Seul</button>
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
  nom.oninput = () => { etat.noms[id] = nom.value; renommesParMoi.add(id); envoyerBientot(); };
  const vol = el.querySelector('.vol');
  vol.value = Math.round((etat.vol[id] ?? 1) * 100);
  vol.oninput = () => { etat.vol[id] = vol.value / 100; volumeCasque(id); majCarte(id); envoyerBientot(); };
  el.querySelector('.antenne-btn').onclick = () => {
    if (estHote && etat.onair.includes(id) && etat.scene !== 'intro' && !confirm('Te retirer de l\'antenne ? Les spectateurs ne te verront plus.')) return;
    basculerAntenne(id);
  };
  if (estHote) el.classList.add('hote');
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
  b.textContent = enDirect ? "✓ À l'antenne" : "Mettre à l'antenne";
  b.title = enDirect ? "Cliquer pour retirer de l'antenne" : '';
  b.className = 'petit antenne-btn' + (enDirect ? '' : ' primaire');
  c.el.querySelector('.muet-btn').textContent = etat.muet[id] ? 'Son coupé' : 'Muet';
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
  const ids = [ID_HOTE, ...[...presents.keys()].filter(id => id !== ID_HOTE && !estEcran(id))];
  for (const id of ids) if (!cartes.has(id)) (id === ID_HOTE ? $('#hote-controles') : liste).appendChild(creerCarte(id).el);
  for (const [id, c] of cartes) if (!ids.includes(id)) { c.el.remove(); cartes.delete(id); }
  // ordre : à l'antenne d'abord (dans l'ordre d'affichage), puis coulisses
  const tri = [...ids].sort((a, b) => {
    const ia = etat.onair.indexOf(a), ib = etat.onair.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  tri.forEach(id => { if (id !== ID_HOTE) liste.appendChild(cartes.get(id).el); });
  ids.forEach(majCarte);
  const nbInvites = ids.length - 1;
  $('#nb-part').textContent = `${nbInvites} invité${nbInvites > 1 ? 's' : ''} · ${etat.onair.filter(id => ids.includes(id)).length} à l'antenne`;
  if (!$('#liste .vide') && nbInvites === 0) {
    liste.insertAdjacentHTML('beforeend', '<div class="vide">Tes invités arriveront ici. Tu les mets à l\'antenne d\'un clic.<button class="primaire petit" id="vide-inviter">Copier le lien invités</button></div>');
    $('#vide-inviter').onclick = () => $('#btn-invite').click();
  }
  if (nbInvites > 0) $('#liste .vide')?.remove();
  $$('[data-scene]').forEach(b => b.classList.toggle('actif', b.dataset.scene === etat.scene));
  $$('[data-layout]').forEach(b => b.classList.toggle('actif', b.dataset.layout === etat.layout));
  $('#badge-scene').textContent = { intro: 'Intro', live: 'En direct', partage: 'Écran partagé', fin: 'Fin' }[etat.scene];
  $('#badge-scene').classList.toggle('rouge-direct', etat.scene === 'live' || etat.scene === 'partage');
}

/* ----- Qui est connecté ? (liste fournie par vdo.ninja) ----- */
const nomsInvites = new Map();      // dernier nom choisi par chaque invité
const renommesParMoi = new Set();   // invités que tu as renommés : leur propre nom ne t'écrase plus
function arrivee(id, label) {
  if (!id || id === ID_HOTE) return;
  const nouveau = !presents.has(id);
  presents.set(id, { vu: Date.now() });
  if (estEcran(id)) { if (label) nomsEcrans.set(id, label); if (nouveau && typeof majSources === 'function') majSources(); }
  else {
    if (label && !etat.noms[id]) etat.noms[id] = label;
    if (!etat.noms[id]) etat.noms[id] = 'Invité';
  }
  if (nouveau && !estEcran(id) && etat.autoAntenne && !etat.onair.includes(id) && etat.onair.length < MAX_ANTENNE) etat.onair.push(id);
  if (nouveau) {
    if (estEcran(id)) toast(`Nouvel écran partagé : ${nomsEcrans.get(id) || 'écran'} (voir Sources)`);
    else toast(`${etat.noms[id]} est en coulisses`);
    envoyer();
  }
}
setInterval(() => {
  ordre(maCamera, { getStreamIDs: true });
  ordre(maCamera, { getStats: true });
  if (typeof ecransActifs !== 'undefined') for (const id of ecransActifs) presents.set(id, { vu: Date.now() });
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
      if (typeof n === 'number' && n === 0) el.innerHTML = '<span style="color:var(--ui-red)">●</span> Personne ne reçoit ta caméra pour l\'instant (ouvre la sortie ou vérifie la source OBS)';
      else if (q.h || n) el.innerHTML = `<span style="color:var(--ui-green)">●</span> Ta caméra part${q.h ? ' en ' + q.h + 'p' : ''}${q.kbps ? ' · ' + (q.kbps / 1000).toFixed(1).replace('.', ',') + ' Mb/s' : ''}${typeof n === 'number' ? ' · reçue par ' + n + ' écran' + (n > 1 ? 's' : '') : ''}`
        // les aperçus reçoivent volontairement une image réduite ; seule la sortie OBS demande la 1080p
        + (q.h && q.h < 1000 ? '<br><span class="aide">Aperçus en qualité réduite : la 1080p part dès que la sortie OBS est ouverte.</span>' : '');
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
      const nomInvite = String(salut.nom || '').trim().slice(0, 28);
      arrivee(salut.id, nomInvite);
      // l'invité s'est renommé lui-même : on suit, sauf si tu l'as renommé toi-même
      if (nomInvite && !renommesParMoi.has(salut.id) && nomsInvites.has(salut.id) && nomsInvites.get(salut.id) !== nomInvite) {
        etat.noms[salut.id] = nomInvite;
        const c = cartes.get(salut.id); if (c) c.el.querySelector('.nom').value = nomInvite;
        toast(`Un invité s'appelle maintenant ${nomInvite}`); envoyerBientot();
      }
      if (nomInvite) nomsInvites.set(salut.id, nomInvite);
      if (salut.q) { qualites.set(salut.id, salut.q); majCarte(salut.id); }
      if (typeof salut.ecran === 'string' && salut.ecran.startsWith(session.room + '_')) arrivee(salut.ecran, String(salut.nom || '').slice(0, 28) + ' (écran)');
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
