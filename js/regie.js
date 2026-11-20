/* MESA : la régie */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const session = lireSession();
const cle = hashParams().get('k');
const MAX_ANTENNE = (LIMITES[formuleActuelle()] || {}).antenne || 11;   // toi compris : 18 pendant la bêta et en Entreprises

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
delete etat.debutLive;          // ancien minuteur lié aux scènes
delete etat.enrCams;            // un enregistrement des caméras ne survit pas à un rechargement (pas de relance surprise chez les invités)
etat.noms[ID_HOTE] = etat.noms[ID_HOTE] || session.hote;

const presents = new Map();   // id -> { vu: timestamp } (connectés en ce moment)
const camsLocales = new Map(); // id -> { iframe, nom, appareil } : tes autres caméras branchées sur ce PC (voir regie-cams.js)
const cartes = new Map();     // id -> { el, iframe, vu }
let listeRecue = false;
const nomsEcrans = new Map();  // id d'écran -> nom affiché
/* Ce que ta caméra filme (mesuré au réglage). À ne pas confondre avec les mesures de la salle (statsCamera.h) : celles-ci
   donnent la plus grande image ENVOYÉE, et un aperçu ne demande que la taille de sa case (1780 px de large = « 1001p »
   tant que la sortie du live n'est pas ouverte, ce qui a fait croire à une caméra bridée le 17/11). */
let hauteurCamera = 0;
function infoEnvoiCamera() {
  const h = statsCamera && statsCamera.h;
  if (!h || !hauteurCamera || h >= hauteurCamera - 8) return 'Ta caméra part bien, en pleine définition.';
  return `Ta caméra filme en ${hauteurCamera}p. Pour l'instant seuls des aperçus la regardent, et ils en reçoivent une version allégée (${h}p). La sortie du live, elle, reçoit la pleine définition.`;
}
let statsCamera = null;        // dernière mesure de ta caméra { h, kbps, n, vu }
const sortieVue = {};          // dernière fois que la sortie OBS a dit « je suis là » : { horizontal, vertical }
const enrInvites = new Map();      // id -> état de l'enregistrement local de l'invité (pistes séparées)
const coupesInvites = new Map();   // id -> { mic, cam } : ce que l'invité a coupé lui-même depuis ses coulisses
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
$('#btn-obs').onclick = () => copier(L.sortie, 'Lien OBS copié : colle-le dans une source navigateur 1920x1080');
$('#btn-vertical').onclick = () => copier(L.vertical, 'Lien vertical copié : source navigateur 1080x1920');
$('#btn-cameras').onclick = () => copier(L.cameras, 'Lien copié : source navigateur 1920x1080, posée au-dessus de ton décor dans OBS');
$('#btn-cameras-v').onclick = () => copier(L.camerasVertical, 'Lien copié : source navigateur 1080x1920, posée au-dessus de ton décor dans OBS');
$('#btn-sortie').onclick = () => window.open(L.sortie, 'sortie', 'width=960,height=540');

/* ----- Ma caméra (le seul endroit qui ouvre la Cam Link) ----- */
const maCamera = $('#ma-camera');
const CLE_CAM = 'studioSeb:appareils:hote';
// effets aussi pour l'animateur ; anti-bruit décoché d'office (micro et casque de qualité : son brut, voir proaudio)
const reglageCam = ReglagesMedia({ boite: $('#cam-reglage'), cle: CLE_CAM, texteBouton: 'Démarrer ma caméra', surDemarrer: demarrerCamera, effets: true, antibruitDefaut: false });
let appHote = null;
const enrHote = EnregistreurCamera();   // ta caméra enregistrée chez toi pendant « Enregistrer » (pistes séparées)
function demarrerCamera(app) {
  appHote = app;
  hauteurCamera = app.h || 0;
  $('#cam-reglage').hidden = true; $('#cam-direct').hidden = false;
  $('#cam-appareils').textContent = [app.nomCam, app.nomMic, app.flou ? 'fond flou' : '', app.antibruit ? 'anti-bruit' : ''].filter(Boolean).join(' · ');
  // la salle démarre directement avec les appareils choisis, sans son propre écran de réglage
  // la meilleure image que la caméra sait donner (1080p avec une Cam Link, 720p avec une webcam) ; « detail » : le navigateur baisse les images/s plutôt que la définition
  // son brut (proaudio) sauf si tu as coché l'anti-bruit ; flou d'arrière-plan calculé sur ton ordinateur
  maCamera.src = urlPublier(session, ID_HOTE, session.hote, { noaudio: true, vd: app.vd, ad: app.ad, autostart: true, proaudio: !app.antibruit, maxframerate: 30, contenthint: 'detail',
    flou: app.flou || false, antibruit: !!app.antibruit });
}
$('#btn-cam-changer').onclick = () => {
  if (etat.direct && etat.onair.includes(ID_HOTE) && !confirm('Ta caméra va se couper quelques secondes pendant le changement. Continuer ?')) return;
  maCamera.src = 'about:blank';
  $('#cam-direct').hidden = true; $('#cam-reglage').hidden = false;
  reglageCam.ouvrir();
};
/* Tant que la caméra n'est pas démarrée, l'aperçu ne peut rien montrer : un gros bouton le dit, et la démarre d'un geste */
const majAppelCam = () => { $('#cam-appel').hidden = $('#cam-reglage').hidden; };
new MutationObserver(majAppelCam).observe($('#cam-reglage'), { attributes: true, attributeFilter: ['hidden'] });
$('#cam-appel').onclick = () => { const go = $('#cam-reglage .rm-go'); if (go) go.click(); };
const retenus = appareilsRetenus(CLE_CAM);
if (retenus && retenus.h) demarrerCamera(retenus);   // sans mesure de la caméra (choix retenu avant le 17/11), on repasse une fois par le réglage : il sert à afficher ce qu'elle filme vraiment
else {
  $('#cam-reglage').hidden = false;
  // un live tout juste créé : on choisit d'abord son visuel ; la caméra (et la demande d'autorisation) vient après
  let creation = false;
  try { creation = !!session.choixVisuel && !localStorage.getItem('studioSeb:visuelVu:' + session.room); } catch (e) { /* rien */ }
  if (creation) {
    const attente = document.createElement('div'); attente.id = 'cam-attente';
    attente.innerHTML = '<p class="aide" style="margin:6px 0 10px">Ta caméra s\'allume quand tu as fini de choisir le visuel de ton live.</p><button type="button" class="primaire" id="cam-maintenant" style="width:100%">Allumer ma caméra maintenant</button>';
    $('#cam-reglage').before(attente); $('#cam-reglage').hidden = true;
    let fait = false;
    const allumer = () => { if (fait) return; fait = true; attente.remove(); $('#cam-reglage').hidden = false; reglageCam.ouvrir(); };
    $('#cam-maintenant').onclick = allumer;
    addEventListener('mesa:visuel-ferme', allumer, { once: true });
  } else reglageCam.ouvrir();
}
majAppelCam();

/* ----- Aperçu de l'antenne ----- */
const apercu = $('#apercu');
apercu.src = `sortie.html?preview=regie${location.hash}`;
apercu.addEventListener('load', () => envoyer());
let apercuVertical = false;
$('#btn-apercu-format').onclick = () => {
  apercuVertical = !apercuVertical;
  apercu.src = `sortie.html?preview=regie${apercuVertical ? '&format=vertical&zones=1' : ''}${location.hash}`;
  $('#moniteur').classList.toggle('vertical', apercuVertical);
  $('#btn-apercu-format').classList.toggle('vertical', apercuVertical);
  $('#btn-apercu-format').title = apercuVertical ? 'Aperçu vertical. Clique pour revenir à l\'horizontal.' : 'Aperçu horizontal. Clique pour voir le vertical (TikTok, Shorts, Reels).';
};

/* ----- Envoi de l'état vers la sortie OBS et les invités ----- */
let envoiSigne = 0;
function envoyer() {
  if (typeof musiqueAuto === 'function') musiqueAuto();   // un morceau lié à la scène démarre avec elle
  etat.ts = Date.now();
  const st = JSON.parse(JSON.stringify(etat));
  // garder uniquement les personnes présentes (et toi)
  st.noms = {};
  for (const [id, nom] of Object.entries(etat.noms)) if (id === ID_HOTE || presents.has(id)) st.noms[id] = nom;
  st.onair = etat.onair.filter(id => id in st.noms);
  if (typeof visiblesPlan === 'function') st.visibles = visiblesPlan(st.onair);   // la scène peut ne montrer qu'une partie des personnes à l'antenne
  delete st.plans;
  // les questions préparées (avec les bonnes réponses) restent dans la régie
  if (st.quiz) st.quiz = { active: st.quiz.active, afficherScores: st.quiz.afficherScores, classement: st.quiz.classement, style: st.quiz.style, dispo: st.quiz.dispo };
  // vers OBS et les coulisses : l'état part signé (ils vérifient que c'est bien ta régie)
  const texte = JSON.stringify(st), n = ++envoiSigne;
  signerEtat(cle, texte).then(sig => {
    if (n !== envoiSigne) return;   // un état plus récent est déjà parti
    ordre(maCamera, { sendData: sig ? { studioSebSigne: { d: texte, s: sig } } : { [CANAL]: st }, type: 'pcs' });
  }).catch(() => ordre(maCamera, { sendData: { [CANAL]: st }, type: 'pcs' }));
  ordre(apercu, { [CANAL]: st });                                  // vers l'aperçu de la régie
  if (typeof envoyerEssai === 'function') envoyerEssai(st);        // vers la « Vue invité », si elle est ouverte
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
    if (typeof stArchive !== 'undefined' && stArchive && stArchive.segs.length) { try { localStorage.setItem(CLE_ST, JSON.stringify(stArchive)); } catch (e2) { /* rien */ } }
    localStorage.setItem('studioSeb:sessions', JSON.stringify(l));
  } catch (err) { /* stockage indisponible */ }
}
function changerScene(s) {
  if (s === 'partage') s = 'live';   // plus de scène « Partage » : ce qui est partagé s'affiche dans toutes les scènes sauf l'intro et l'outro
  etat.scene = s; envoyer();
}
function changerLayout(l) {
  etat.layout = l;
  // la scène de caméras à l'antenne retient son cadrage : on le retrouve en y revenant
  if (etat.scene === 'live' && typeof planActif === 'function' && planActif()) planActif().layout = l;
  envoyer();
}
$$('[data-scene]').forEach(b => b.onclick = () => changerScene(b.dataset.scene));

/* ----- Limiteur de durée : visible dans la régie seulement (ni les invités ni les spectateurs) ----- */
const LIMITE_MS = (+session.limite || 0) * 60000;
let limiteAtteinte = false;
const hms = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); };
const dureeTexte = min => (min >= 60 ? Math.floor(min / 60) + ' h' : '') + (min % 60 ? ' ' + (min % 60) + (min >= 60 ? '' : ' min') : '');
function majLimiteur() {
  const el = $('#limiteur');
  // hors direct, la durée maximale se règle dans Visuel › Quand : rien à afficher ici
  if (!LIMITE_MS || !etat.direct) { el.hidden = true; limiteAtteinte = false; return; }
  el.hidden = false;
  // le compte suit le direct (bouton « Démarrer le direct »), pas les scènes
  if (!etat.direct) { limiteAtteinte = false; el.className = 'limiteur'; el.textContent = `Limite ${dureeTexte(+session.limite).trim()}`; el.dataset.court = dureeTexte(+session.limite).trim(); el.title = 'Le décompte démarre avec le direct'; return; }
  const reste = etat.direct.debut + LIMITE_MS - Date.now();
  if (reste <= 0) {
    el.className = 'limiteur alerte'; el.textContent = 'Temps écoulé'; el.dataset.court = 'Fini';
    if (!limiteAtteinte) { limiteAtteinte = true; arreterDirect(); toast('Durée maximale atteinte : direct arrêté, écran de fin affiché'); }
    return;
  }
  const alerte = reste <= 20 * 60000;
  el.className = 'limiteur' + (alerte ? ' alerte' : '');
  el.textContent = alerte ? `Attention : plus que ${hms(reste)}` : `Fin du live dans ${hms(reste)}`;
  el.dataset.court = hms(reste);
}
setInterval(majLimiteur, 250); majLimiteur();
$$('[data-layout]').forEach(b => b.onclick = () => changerLayout(b.dataset.layout));
$('#auto-antenne').checked = !!etat.autoAntenne;
$('#auto-antenne').onchange = e => { etat.autoAntenne = e.target.checked; envoyer(); };
$('#surbrillance').onchange = e => { etat.surbrillance = e.target.checked; envoyer(); };
$('#bandeau').oninput = e => { etat.bandeau = e.target.value; envoyerBientot(); };
$('#message').oninput = e => { etat.message = e.target.value; envoyerBientot(); };
function envoyerBientot() { clearTimeout(envoyerBientot.t); envoyerBientot.t = setTimeout(envoyer, 250); }

$$('[data-minutes]').forEach(b => b.onclick = () => { etat.debutCompte = Date.now(); etat.fin = etat.debutCompte + b.dataset.minutes * 60000; envoyer(); toast(`Compte à rebours : ${b.dataset.minutes} min`); });
/* « + » : on ajoute (ou enlève) du temps au compte en cours ; sans compte, on en démarre un */
$$('[data-ajout]').forEach(b => b.onclick = () => {
  const d = +b.dataset.ajout * 1000, now = Date.now();
  if (!etat.fin || etat.fin <= now) { if (d <= 0) return; etat.debutCompte = now; etat.fin = now + d; }
  else { etat.fin = Math.max(now + 5000, etat.fin + d); if (!etat.debutCompte || etat.debutCompte > now) etat.debutCompte = now; }
  envoyer();
});
$('#btn-heure').onclick = () => {
  const v = $('#heure-debut').value; if (!v) return toast("Choisis d'abord une heure");
  const [h, m] = v.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
  if (d < Date.now()) d.setDate(d.getDate() + 1);
  etat.debutCompte = Date.now(); etat.fin = d.getTime(); envoyer(); toast(`Compte à rebours jusqu'à ${v}`);
};
$('#btn-sans-compte').onclick = () => { etat.fin = null; etat.debutCompte = null; envoyer(); };
$('#heure-debut').onchange = () => { if ($('#heure-debut').value) $('#btn-heure').click(); };
/* Les parties qu'on déplie gardent leur état d'un live à l'autre */
(() => {
  let plis = {}; try { plis = JSON.parse(localStorage.getItem('studioSeb:plis') || '{}'); } catch (e) { /* rien */ }
  $$('details.pli[id]').forEach(d => {
    if (d.id in plis) d.open = !!plis[d.id];
    d.addEventListener('toggle', () => { plis[d.id] = d.open; try { localStorage.setItem('studioSeb:plis', JSON.stringify(plis)); } catch (e) { /* rien */ } });
  });
})();

addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=radio]), textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  /* scènes et cadrages : voir regie-scenes.js */
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
const IC_MICRO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const IC_MICRO_COUPE = IC_MICRO.replace('</svg>', '<path d="M4 4l16 16"/></svg>');
const IC_SEUL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="10.5" r="2"/><path d="M8.8 16a3.2 3.2 0 0 1 6.4 0"/></svg>';
const IC_LIEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
const IC_SON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
const IC_CADRE = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><rect x="9.5" y="8.5" width="5" height="7" rx="1"/><path d="M6 3.5l1.5 1.5M18 3.5L16.5 5"/></svg>',
  voir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><rect x="9" y="7.5" width="6" height="9" rx="1"/></svg>',
  remplir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 9.5h10v5H7z" fill="currentColor" stroke="none" opacity=".45"/></svg>'
};
const TITRE_CADRE = {
  auto: 'Cadrage automatique : image debout montrée en entier, image couchée (16:9) qui remplit la case. Suit la rotation du téléphone. Clique pour « Tout voir ».',
  voir: 'Tout voir : l\'image entière, sans rien rogner. Clique pour « Remplir ».',
  remplir: 'Remplir : l\'image remplit toute la case (les bords peuvent être rognés). Clique pour revenir en automatique.'
};
etat.cadre = etat.cadre || {};
function majCadreBtn(id) {
  const c = cartes.get(id); if (!c) return;
  const b = c.el.querySelector('.cadre-btn'); if (!b) return;
  const m = etat.cadre[id] || 'auto';
  if (b.dataset.m === m) return;
  b.dataset.m = m; b.innerHTML = IC_CADRE[m]; b.title = TITRE_CADRE[m];
  b.classList.toggle('actif-doux', m !== 'auto');
}
function creerCarte(id) {
  const estHote = id === ID_HOTE, cam = camsLocales.get(id), faux = estFaux(id);   // faux : invité de test (js/regie-faux.js)
  const el = document.createElement('div');
  el.className = 'participant' + (cam ? ' camera' : '') + (faux ? ' faux' : '');
  el.innerHTML = `
    <div class="vignette"><span class="temoin"></span></div>
    <input type="text" class="nom" title="Nom affiché à l'écran" ${cam ? 'placeholder="Sans nom à l\'écran"' : ''}>
    ${cam ? '' : `<div class="reglages" title="Volume dans le live">${IC_SON}<input type="range" min="0" max="100" step="1" class="vol"><span class="pct"></span></div>
    <div class="vu"><i></i></div>`}
    ${estHote || cam || faux ? '' : '<div class="qualite aide"></div>'}
    <div class="actions">
      <button class="petit antenne-btn"></button>
      ${cam ? '' : '<button class="petit muet-btn ic-btn"></button>'}
      <button class="petit focus-btn ic-btn" title="Seul à l'écran">${IC_SEUL}</button>
      ${cam ? '<button class="petit retirer-btn" title="Débrancher cette caméra">✕</button>' : ''}
    </div>`;
  let iframe = null;
  if (cam) el.querySelector('.vignette').appendChild(cam.iframe);      // la fenêtre qui publie la caméra sert aussi d'aperçu
  else if (faux) { const v = el.querySelector('.vignette'); v.style.backgroundImage = imageFaux(id); v.title = 'Invité de test : fausse caméra, pour voir le rendu des scènes'; }
  else if (!estHote) {
    iframe = document.createElement('iframe');
    iframe.allow = IFRAME_ALLOW;
    iframe.src = urlVoir(session, id, { bitrate: 250, transparent: false });
    iframe.addEventListener('load', () => { ordre(iframe, { getLoudness: true }); volumeCasque(id); });
    el.querySelector('.vignette').appendChild(iframe);
  }
  const nom = el.querySelector('.nom');
  nom.value = etat.noms[id] || '';
  nom.oninput = () => { etat.noms[id] = nom.value; renommesParMoi.add(id); if (cam && typeof sauverCams === 'function') { cam.nom = nom.value; sauverCams(); } envoyerBientot(); };
  const vol = el.querySelector('.vol');
  if (vol) {
    vol.value = Math.round((etat.vol[id] ?? 1) * 100);
    vol.oninput = () => { etat.vol[id] = vol.value / 100; volumeCasque(id); majCarte(id); envoyerBientot(); };
  }
  el.querySelector('.antenne-btn').onclick = async () => {
    if (estHote && etat.onair.includes(id) && etat.direct && !await confirmer('Te retirer de l\'antenne ? Les spectateurs ne te verront plus.', { oui: 'Oui, me retirer', non: 'Non' })) return;
    basculerAntenne(id);
  };
  if (estHote) el.classList.add('hote');
  const muet = el.querySelector('.muet-btn');
  if (muet) muet.onclick = () => { etat.muet[id] = !etat.muet[id]; volumeCasque(id); envoyer(); };
  el.querySelector('.focus-btn').onclick = () => {
    if (!etat.onair.includes(id)) etat.onair.push(id);
    etat.focus = id; etat.layout = 'solo'; envoyer();
  };
  if (el.querySelector('.cadre-btn')) el.querySelector('.cadre-btn').onclick = () => {
    const suite = { auto: 'voir', voir: 'remplir', remplir: 'auto' }[etat.cadre[id] || 'auto'];
    if (suite === 'auto') delete etat.cadre[id]; else etat.cadre[id] = suite;
    majCadreBtn(id); envoyer();
    toast({ auto: 'Cadrage automatique', voir: 'Tout voir : image entière', remplir: 'Remplir la case' }[suite]);
  };
  const haut = el.querySelector('.haut-btn');
  if (haut) haut.onclick = () => {
    const i = etat.onair.indexOf(id);
    if (i > 0) { [etat.onair[i - 1], etat.onair[i]] = [etat.onair[i], etat.onair[i - 1]]; envoyer(); }
  };
  const retirer = el.querySelector('.retirer-btn');
  if (retirer) retirer.onclick = () => { if (faux) { if (typeof retirerFaux === 'function') retirerFaux(id); } else if (typeof retirerCam === 'function') retirerCam(id); };
  // un clic sur l'image met la personne à l'antenne (ou l'en retire) : la scène de caméras s'adapte toute seule
  if (!estHote) {
    const v = el.querySelector('.vignette');
    v.classList.add('cliquable');
    v.addEventListener('click', e => { if (e.target.closest('button, input, a')) return; el.querySelector('.antenne-btn').click(); });
  }
  const c = { el, iframe, niveau: 0 };
  cartes.set(id, c);
  majCadreBtn(id);
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
  c.el.querySelector('.temoin').textContent = enDirect ? (etat.direct ? 'À L\'ANTENNE' : 'À L\'ÉCRAN') : (id === ID_HOTE || camsLocales.has(id) ? 'HORS ANTENNE' : 'EN COULISSES');
  const b = c.el.querySelector('.antenne-btn');
  b.textContent = enDirect ? 'Retirer' : 'Mettre à l\'antenne';
  b.title = enDirect ? 'Retirer de l\'antenne' : 'Afficher cette source à l\'écran';
  b.className = 'petit antenne-btn' + (enDirect ? '' : ' primaire');
  const muet = c.el.querySelector('.muet-btn');
  if (muet && muet.dataset.coupe !== String(!!etat.muet[id])) {
    muet.dataset.coupe = String(!!etat.muet[id]);
    muet.innerHTML = etat.muet[id] ? IC_MICRO_COUPE : IC_MICRO;
    muet.title = etat.muet[id] ? 'Son coupé dans le live. Clique pour le remettre.' : 'Couper le son dans le live';
    muet.classList.toggle('rouge', !!etat.muet[id]);
  }
  const qe = c.el.querySelector('.qualite'), q = qualites.get(id);
  if (qe) {
    if (!q) qe.innerHTML = '<span class="voyant"></span>Qualité : en attente…';
    else {
      const res = q.h ? `${q.h}p` : '?', debit = q.kbps ? `${(q.kbps / 1000).toFixed(1).replace('.', ',')} Mb/s` : '';
      const bon = q.h >= 720 && q.kbps >= 1500, moyen = q.h >= 480 && q.kbps >= 600;
      qe.innerHTML = `<span class="voyant ${bon ? 'ok' : moyen ? 'att' : 'ko'}"></span>${res} ${debit} · ${bon ? 'bonne image' : moyen ? 'image moyenne' : 'connexion faible'}`;
    }
    const cp = coupesInvites.get(id);
    const txt = cp ? [cp.mic ? 'micro' : '', cp.cam ? 'caméra' : ''].filter(Boolean).join(' et ') : '';
    if (txt) qe.innerHTML += ` <b class="coupe-invite">· ${txt} coupé${cp.mic && cp.cam ? 's' : cp.cam ? 'e' : ''} par l'invité</b>`;
    const en = id === ID_HOTE ? enrHote.etat() : enrInvites.get(id);
    if (en && etat.enrCams && (en.actif || en.erreur)) qe.innerHTML += en.actif ? ` <b class="enr-invite">· ⏺ enregistre sa caméra</b>` : ` <b class="coupe-invite">· enregistrement impossible</b>`;
  }
  const pct = c.el.querySelector('.pct');
  if (pct) pct.textContent = (etat.muet[id] ? 0 : Math.round((etat.vol[id] ?? 1) * 100)) + '%';
}
function majInterface() {
  const liste = $('#liste'), zoneCams = $('#cams');
  const ids = [ID_HOTE, ...[...presents.keys()].filter(id => id !== ID_HOTE && !estEcran(id))];
  for (const id of ids) if (!cartes.has(id)) (id === ID_HOTE ? $('#hote-controles') : camsLocales.has(id) ? zoneCams : liste).appendChild(creerCarte(id).el);
  for (const [id, c] of cartes) if (!ids.includes(id)) { c.el.remove(); cartes.delete(id); }
  // ordre des invités : à l'antenne d'abord (dans l'ordre d'affichage), puis coulisses
  const tri = [...ids].sort((a, b) => {
    const ia = etat.onair.indexOf(a), ib = etat.onair.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  tri.forEach(id => { if (id !== ID_HOTE && !camsLocales.has(id)) liste.appendChild(cartes.get(id).el); });
  ids.forEach(majCarte);
  const invites = ids.filter(id => id !== ID_HOTE && !camsLocales.has(id));
  const nbInvites = invites.length;
  $('#nb-part').textContent = `${etat.onair.filter(id => ids.includes(id)).length} à l'antenne · ${nbInvites} invité${nbInvites > 1 ? 's' : ''}`;
  if (!$('#liste .vide') && nbInvites === 0) {
    liste.insertAdjacentHTML('beforeend', '<div class="vide" title="Tes invités arrivent ici, en coulisses. Tu les mets à l\'antenne d\'un clic.">Personne en coulisses<button class="primaire petit" id="vide-inviter">' + IC_LIEN + 'Copier le lien</button></div>');
    $('#vide-inviter').onclick = () => $('#btn-invite').click();
  }
  if (nbInvites > 0) $('#liste .vide')?.remove();
  if (typeof dessinerScenes === 'function') dessinerScenes();
  if (typeof majDirect === 'function') majDirect();
  if (typeof majCommutation === 'function') majCommutation();
}

/* ----- Qui est connecté ? (liste fournie par vdo.ninja) ----- */
const nomsInvites = new Map();      // dernier nom choisi par chaque invité
const renommesParMoi = new Set();   // invités que tu as renommés : leur propre nom ne t'écrase plus
function arrivee(id, label) {
  label = String(label || '').trim().slice(0, 28);   // le nom vient de l'invité : longueur bornée
  if (!id || id === ID_HOTE || camsLocales.has(id)) return;     // tes propres caméras sont déjà connues
  if (typeof enAttente === 'function' && enAttente(id, label)) return;   // serveur MESA : salle d'attente (js/regie-securite.js)
  if (typeof ecranEnDirect === 'function') ecranEnDirect(id);      // ton propre partage d'écran est bien arrivé dans la salle
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
  for (const id of camsLocales.keys()) presents.set(id, { vu: Date.now() });
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
      if (q.grand && hauteurCamera >= q.grand) hauteurCamera = q.h;   // mesure retenue avant le 18/11 sur le grand côté (téléphone debout)
      statsCamera = { h: q.h, kbps: q.kbps, n: typeof n === 'number' ? n : null, vu: Date.now() };
      if (typeof n === 'number' && n === 0) el.innerHTML = '<span class="voyant att"></span> Personne ne reçoit ta caméra pour l\'instant (ouvre la sortie ou vérifie la source OBS)';
      // pas de « 383p » ici : ce chiffre est souvent la taille de l'aperçu, pas celle de ta caméra (le détail est au survol)
      else if (q.h || n) el.innerHTML = '<span class="voyant ok"></span> Caméra en marche';
      el.title = infoEnvoiCamera();
    }
    if (d.streamIDs) {
      listeRecue = true;
      const liste = Array.isArray(d.streamIDs) ? Object.fromEntries(d.streamIDs.map(x => [x, ''])) : d.streamIDs;
      for (const [id, label] of Object.entries(liste)) if (presents.has(id) || id) arrivee(id, typeof label === 'string' ? label : label?.label);
    }
    if (d.action === 'guest-connected' && d.streamID) arrivee(d.streamID, d.value && d.value.label);
    const so = d.dataReceived && d.dataReceived.studioSebSortie;
    if (so) sortieVue[so.v ? 'vertical' : 'horizontal'] = Date.now();
    if (so && typeof so.besoin === 'string' && so.besoin && typeof envoyerFichier === 'function') envoyerFichier(so.besoin);
    const salut = d.dataReceived && d.dataReceived.studioSebSalut;
    if (salut && typeof salut.id === 'string' && salut.id.startsWith(session.room + '_')
        && !(typeof d.streamID === 'string' && d.streamID !== salut.id)) {   // pas d'usurpation du nom d'un autre
      listeRecue = true;
      if (typeof salut.besoin === 'string' && salut.besoin && typeof envoyerFichier === 'function') envoyerFichier(salut.besoin);
      const nomInvite = String(salut.nom || '').trim().slice(0, 28);
      arrivee(salut.id, nomInvite);
      // l'invité s'est renommé lui-même : on suit, sauf si tu l'as renommé toi-même
      if (nomInvite && !renommesParMoi.has(salut.id) && nomsInvites.has(salut.id) && nomsInvites.get(salut.id) !== nomInvite) {
        etat.noms[salut.id] = nomInvite;
        const c = cartes.get(salut.id); if (c) c.el.querySelector('.nom').value = nomInvite;
        toast(`Un invité s'appelle maintenant ${nomInvite}`); envoyerBientot();
      }
      if (nomInvite) nomsInvites.set(salut.id, nomInvite);
      if (salut.coupe && typeof salut.coupe === 'object') {
        const avant = coupesInvites.get(salut.id) || {}, c = { mic: !!salut.coupe.mic, cam: !!salut.coupe.cam };
        coupesInvites.set(salut.id, c);
        if (c.mic !== !!avant.mic || c.cam !== !!avant.cam) majCarte(salut.id);
      }
      if (salut.enr === null || (salut.enr && typeof salut.enr === 'object')) {
        const avant = JSON.stringify(enrInvites.get(salut.id) || null);
        if (salut.enr) enrInvites.set(salut.id, { actif: !!salut.enr.actif, erreur: String(salut.enr.erreur || '').slice(0, 120), octets: +salut.enr.octets || 0 }); else enrInvites.delete(salut.id);
        if (avant !== JSON.stringify(enrInvites.get(salut.id) || null)) majCarte(salut.id);
      }
      // la qualité vient de l'invité : on ne garde que des nombres (un invité malveillant ne peut rien glisser dans la régie)
      if (salut.q && typeof salut.q === 'object') {
        const n = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));
        qualites.set(salut.id, { w: n(salut.q.w, 8000), h: n(salut.q.h, 8000), kbps: n(salut.q.kbps, 100000) }); majCarte(salut.id);
      }
      if (salut.st && typeof sousTitreRecu === 'function') sousTitreRecu(salut.id, salut.st);
      if (typeof salut.ecran === 'string' && salut.ecran.startsWith(session.room + '_')) arrivee(salut.ecran, String(salut.nom || '').slice(0, 28) + ' (écran)');
    }
    if (d.action === 'push-connection' && d.streamID && d.value === false) {
      presents.delete(d.streamID); if (typeof ecranCoupe === 'function') ecranCoupe(d.streamID); envoyer();
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
    if (bar) bar.style.backgroundSize = (bar.parentElement.clientWidth || 200) + 'px 100%';
  }
}, 120);

envoyer();
garderEcranAllume();
