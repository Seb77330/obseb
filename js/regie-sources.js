/* MESA : régie, partie Sources (4 max) et Bandeaux (la musique est dans regie-musique.js) */
'use strict';

/* Ce qu'on peut montrer à côté des caméras (toutes les scènes sauf l'intro et l'outro) (4 choses au plus à la fois). Un clic et c'est parti :
   « Mon écran » ouvre le choix de la fenêtre, « Image » ouvre le choix du fichier, « Lien » accepte ce qu'on colle. */
const ICONE_SRC = {
  monecran: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/></svg>',
  ecraninvite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.400 1.900 7 5.500"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.500" y="4.500" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.500-4 3.500 3 3-2.500 5 4"/></svg>',
  console: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.900 4l.800 4a2.300 2.300 0 0 1-4 2l-1.700-2H7l-1.700 2a2.300 2.300 0 0 1-4-2l.800-4A5 5 0 0 1 7 8z"/><path d="M7.500 11v3M6 12.500h3M16 11.500h.01M18 13.500h.01"/></svg>',
  lien: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/></svg>'
};
/* sur téléphone, le navigateur ne sait pas partager l'écran : on ne propose que ce qui marche */
const TEL_SOURCES = !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) || matchMedia('(pointer: coarse) and (max-width: 1000px)').matches;
const CHOIX_SOURCE = [
  ['monecran', 'Mon écran', 'Fenêtre, onglet ou écran entier'],
  ['ecraninvite', "Écran d'un invité", 'Quand il partage le sien'],
  ['console', 'Console', "Avec un boîtier d'acquisition"],
  ['image', 'Image', TEL_SOURCES ? 'Depuis ton téléphone' : 'Depuis ton ordinateur'],
  ['lien', 'Lien', 'Vidéo MP4, YouTube, page web']
].filter(([ui]) => !(TEL_SOURCES && (ui === 'monecran' || ui === 'console')));
const NOM_SOURCE = { monecran: 'Mon écran', ecraninvite: "Écran d'un invité", console: 'Console', image: 'Image', lien: 'Lien' };
const ecransActifs = new Set();      // tes partages d'écran en cours (ids vdo.ninja)
const iframesEcran = new Map();      // n° de source -> iframe de partage

etat.sources = Array.from({ length: 4 }, (_, i) => Object.assign({ ui: '', type: '', ref: '', nom: '', actif: false }, (etat.sources || [])[i] || {}));
// anciens choix (avant le 17/11) : « Vidéo (lien MP4) », « Page web (lien) » et image par lien sont devenus « Lien »
etat.sources.forEach(s => {
  if (s.ui === 'video' || s.ui === 'web' || (s.ui === 'image' && !s.fichier && s.ref)) { s.ui = 'lien'; s.saisie = s.saisie || s.ref; }
  if (s.ui && !NOM_SOURCE[s.ui]) Object.assign(s, { ui: '', type: '', ref: '', nom: '', actif: false });
  if ((s.ui === 'image' && !s.fichier) || (s.ui === 'lien' && !s.ref) || (s.ui === 'ecraninvite' && !s.ref)) Object.assign(s, { ui: '', type: '', ref: '', nom: '', actif: false, saisie: '' });
});
// une image choisie sur l'ordinateur reste dans ce navigateur : si elle n'y est plus, la source redevient vide
etat.sources.forEach((s, i) => { if (s.fichier) fichiers.lire(s.fichier.id).then(b => { if (!b) { viderSource(i); majSlots(); } }).catch(() => {}); });
// au rechargement de la page, tes partages d'écran sont coupés : la source se vide
etat.sources.forEach(s => { if (s.ui === 'monecran') Object.assign(s, { ui: '', type: '', ref: '', nom: '', actif: false }); });
// la console reste choisie, avec son boîtier : il suffit de la rebrancher
etat.sources.forEach(s => { if (s.ui === 'console') Object.assign(s, { ref: '', actif: false }); });
etat.bandeaux = etat.bandeaux || [];
etat.defilant = etat.defilant || { texte: '', actif: false };
etat.playlist = etat.playlist || [];
etat.musique = etat.musique || { idx: 0, lecture: false, n: 0 };

const cleSrc = s => s.type === 'ecran' ? s.ref : s.type + ':' + s.ref;

/* ---------- Un lien collé : on reconnaît tout seul ce que c'est ---------- */
// sites qui refusent d'être affichés dans un autre site : inutile d'essayer, on propose de partager l'onglet
const SITES_FERMES = /(^|\.)(github\.com|google\.[a-z.]+|x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|netflix\.com|linkedin\.com|reddit\.com|amazon\.[a-z.]+|primevideo\.com|disneyplus\.com|youtube\.com|twitch\.tv)$/;
function lireLien(brut) {
  let v = String(brut || '').trim().replace(/^<|>$/g, '');
  if (!v) return null;
  if (/^http:\/\//i.test(v)) v = 'https://' + v.slice(7);                 // une page sécurisée ne peut afficher que du https
  else if (!/^https:\/\//i.test(v)) {
    if (/^[\w-]+(\.[\w-]+)+([/?#:]|$)/.test(v)) v = 'https://' + v;       // « monsite.fr/video.mp4 » : on ajoute le début
    else return { erreur: 'Colle un lien complet, par exemple monsite.fr/video.mp4' };
  }
  let u;
  try { u = new URL(v); } catch (e) { return { erreur: 'Ce lien est incomplet' }; }
  const chemin = u.pathname.toLowerCase(), hote = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(chemin)) return { type: 'video', ref: u.href, nom: 'Vidéo' };
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(chemin)) return { type: 'image', ref: u.href, nom: 'Image' };
  // les vidéos des grands sites : on prend leur lecteur, qui lui accepte d'être affiché ailleurs
  const secondes = t => { const m = String(t || '').match(/^(?:(\d+)h)?(?:(\d+)m)?(\d+)?s?$/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
  let m;
  if (hote === 'youtu.be' || hote === 'youtube.com' || hote === 'youtube-nocookie.com') {
    const id = hote === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : (u.searchParams.get('v') || ((m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/)) ? m[1] : ''));
    if (/^[\w-]{6,}$/.test(id)) {
      const debut = secondes(u.searchParams.get('t') || u.searchParams.get('start'));
      return { type: 'web', ref: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0${debut ? '&start=' + debut : ''}`, nom: 'YouTube', lecteur: true };
    }
  }
  if (hote === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return { type: 'web', ref: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, nom: 'Vimeo', lecteur: true };
  if (hote === 'dailymotion.com' && (m = u.pathname.match(/^\/video\/([a-z0-9]+)/i))) return { type: 'web', ref: `https://www.dailymotion.com/embed/video/${m[1]}?autoplay=1`, nom: 'Dailymotion', lecteur: true };
  if (hote === 'twitch.tv' && (m = u.pathname.match(/^\/(\w{3,})\/?$/))) return { type: 'web', ref: `https://player.twitch.tv/?channel=${m[1]}&parent=${location.hostname}`, nom: 'Twitch', lecteur: true };
  return { type: 'web', ref: u.href, nom: hote, ferme: SITES_FERMES.test(hote) };
}
/* Vérifie qu'une vidéo ou une image donnée par un lien se charge vraiment, pour le dire tout de suite */
function verifierLien(i, lu) {
  const src = etat.sources[i], ref = lu.ref;
  const dire = (classe, texte) => { if (src.ref !== ref) return; src.etatLien = { classe, texte }; majEtatLien(i); };
  if (lu.type === 'video') {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    const fin = () => { v.removeAttribute('src'); v.load(); };
    v.onloadedmetadata = () => { const d = v.duration; dire('ok', 'Vidéo prête' + (isFinite(d) && d > 0 ? ` · ${Math.floor(d / 60)} min ${String(Math.round(d % 60)).padStart(2, '0')}` : '')); fin(); };
    v.onerror = () => { dire('ko', 'Ce lien ne se lit pas comme une vidéo. Il faut le lien direct du fichier (il finit par .mp4).'); fin(); };
    v.src = ref;
  } else if (lu.type === 'image') {
    const im = new Image();
    im.onload = () => dire('ok', 'Image prête');
    im.onerror = () => dire('ko', 'Cette image ne se charge pas : vérifie le lien.');
    im.src = ref;
  }
}
function poserLien(i, brut) {
  const src = etat.sources[i];
  src.saisie = String(brut || '').slice(0, 600);
  const lu = lireLien(brut);
  if (!lu || lu.erreur) {
    Object.assign(src, { type: '', ref: '', nom: '', actif: false, etatLien: lu ? { classe: 'ko', texte: lu.erreur } : null });
  } else if (lu.ref !== src.ref) {
    Object.assign(src, { type: lu.type, ref: lu.ref, nom: lu.nom, actif: !lu.ferme });       // ce que tu colles passe à l'écran tout de suite
    src.etatLien = lu.ferme ? { classe: 'ko', texte: `${lu.nom} refuse de s'afficher dans un autre site.`, onglet: true }
      : lu.lecteur ? { classe: 'ok', texte: `Vidéo ${lu.nom} reconnue` }
      : lu.type === 'web' ? { classe: '', texte: 'Page web, affichée telle quelle. Si la case reste grise, le site refuse :', onglet: true }
      : { classe: '', texte: 'Chargement…' };
    verifierLien(i, lu);
  } else return;
  envoyer(); majSlots(); majEtatLien(i); majSonSource(i);
}
function majEtatLien(i) {
  const src = etat.sources[i], el = slotsEl[i] && slotsEl[i].querySelector('.src-etat');
  if (!el) return;
  const e = src.etatLien;
  el.hidden = !e;
  el.className = 'src-etat ' + ((e && e.classe) || '');
  el.textContent = e ? e.texte : '';
  if (e && e.onglet) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lien-bouton'; b.textContent = 'Partager mon onglet à la place';
    b.onclick = () => { viderSource(i); demarrerMonEcran(i); };
    el.append(' ', b);
  }
}

/* ---------- Sources ---------- */
const slotsEl = [];
const premierVide = () => etat.sources.findIndex(s => !s.ui);
function viderSource(i) {
  const src = etat.sources[i];
  arreterMonEcran(i);
  oublierImage(src);
  Object.assign(src, { ui: '', type: '', ref: '', nom: '', actif: false, saisie: '', etatLien: null });
  remplirCorps(i);
}
function construireSlots() {
  const box = $('#sources');
  box.innerHTML = `
    <div class="src-scene" id="src-scene" hidden><span>C'est prêt. Ça s'affichera dès que tu quittes l'intro ou l'outro.</span><button type="button" class="petit primaire">Passer aux caméras</button></div>
    <div id="src-slots"></div>
    <div class="src-choix" id="src-choix">
      <div class="src-choix-titre"></div>
      <div class="src-choix-grille">${CHOIX_SOURCE.map(([ui, nom, aide]) => `<button type="button" data-ui="${ui}">${ICONE_SRC[ui]}<b>${nom}</b><small>${aide}</small></button>`).join('')}</div>
      <input type="file" accept="image/*" hidden>
      ${TEL_SOURCES ? '' : '<p class="aide src-astuce">Tu peux aussi coller un lien ou une image ici (Ctrl+V).</p>'}
    </div>`;
  box.querySelector('#src-scene button').onclick = () => (typeof allerPlan === 'function' && etat.plans && etat.plans.length ? allerPlan(etat.plan || etat.plans[0].id) : changerScene('live'));
  etat.sources.forEach((src, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `
      <div class="tete"><span class="src-ic"></span><b class="src-nom"></b>
        <label class="src-ecran" title="Affiché ou non à l'écran, à côté des caméras (dans toutes les scènes sauf l'intro et l'outro)"><span>À l'écran</span><span class="interrupteur"><input type="checkbox" class="actif"><span></span></span></label>
        <button type="button" class="petit src-oter" title="Retirer ce partage">✕</button>
      </div>
      <div class="ecran-cadre" hidden></div>
      <div class="corps"></div>`;
    el.querySelector('.actif').onchange = e => {
      if (e.target.checked && !src.ref) { e.target.checked = false; return toast(src.ui === 'monecran' ? 'Choisis d\'abord l\'écran à partager' : src.ui === 'console' ? 'Branche d\'abord la console' : 'Il n\'y a encore rien à montrer ici'); }
      src.actif = e.target.checked; envoyer(); majSlots();
    };
    el.querySelector('.src-oter').onclick = () => { viderSource(i); envoyer(); majSlots(); };
    slotsEl[i] = el;
    box.querySelector('#src-slots').appendChild(el);
    remplirCorps(i);
  });
  const champImage = box.querySelector('#src-choix input[type=file]');
  champImage.onchange = () => { ajouterImage(champImage.files[0]); champImage.value = ''; };
  box.querySelectorAll('#src-choix [data-ui]').forEach(b => b.onclick = () => {
    const i = premierVide();
    if (i < 0) return toast('4 partages à la fois au maximum : retires-en un');
    const ui = b.dataset.ui;
    if (ui === 'monecran') return demarrerMonEcran(i);
    if (ui === 'image') return champImage.click();
    etat.sources[i].ui = ui;
    if (ui === 'console') Object.assign(etat.sources[i], { type: 'ecran', nom: 'Console' });
    if (ui === 'ecraninvite') {
      etat.sources[i].type = 'ecran';
      const ids = ecransInvites();
      if (ids.length === 1) Object.assign(etat.sources[i], { ref: ids[0], nom: nomsEcrans.get(ids[0]) || 'Écran invité', actif: true });
    }
    remplirCorps(i); envoyer(); majSlots();
    const champ = slotsEl[i].querySelector('.src-lien'); if (champ) champ.focus();
  });
  majSlots();
}
function demarrerMonEcran(i) {
  Object.assign(etat.sources[i], { ui: 'monecran', type: 'ecran', nom: 'Mon écran' });
  lancerMonEcran(i); remplirCorps(i); envoyer(); majSlots();
}
function ajouterImage(f) {
  if (!f) return;
  const i = premierVide();
  if (i < 0) return toast('4 partages à la fois au maximum : retires-en un');
  return choisirImage(i, f);
}
/* Une image choisie sur l'ordinateur : réduite si elle est très grande, gardée dans ce navigateur, envoyée à la sortie à sa demande */
function oublierImage(src) { if (src.fichier) { fichiers.oter(src.fichier.id).catch(() => {}); src.fichier = null; } }
async function preparerImage(f) {
  if (f.type === 'image/gif' || f.type === 'image/svg+xml') return f.size <= 4e6 ? f : null;
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 1920 / bmp.width, 1920 / bmp.height);
  if (k === 1 && f.size <= 1.5e6) return f;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/webp', 0.9));
}
async function choisirImage(i, f) {
  const src = etat.sources[i];
  if (!f) return;
  if (!/^image\//.test(f.type)) return toast('Ce fichier n\'est pas une image');
  let blob = null;
  try { blob = await preparerImage(f); } catch (e) { /* image illisible */ }
  if (!blob) return toast('Impossible de lire cette image (ou elle est trop lourde)');
  const id = 'i' + rnd(8);
  try { await fichiers.mettre(id, blob); } catch (e) { return toast('Ce navigateur refuse de garder le fichier'); }
  oublierImage(src);
  Object.assign(src, { ui: 'image', type: 'image', ref: 'fichier:' + id, nom: (f.name || 'Image').replace(/\.\w+$/, '').slice(0, 40) || 'Image', fichier: { id, type: blob.type || f.type }, actif: true });
  remplirCorps(i); envoyer(); majSlots();
}
function majSonSource(i) {
  const src = etat.sources[i], corps = slotsEl[i].querySelector('.corps');
  const ancien = corps.querySelector('.son-src'); if (ancien) ancien.remove();
  if (!(src.ui === 'monecran' || src.ui === 'ecraninvite' || src.ui === 'console' || src.type === 'video') || !src.ref) return;
  const v = document.createElement('div');
  v.className = 'reglages son-src'; v.style.cssText = 'display:flex;gap:8px;align-items:center';
  v.innerHTML = '<span class="aide">🔊 Son</span><input type="range" min="0" max="100" class="vol-src" style="flex:1"><span class="aide pct-src"></span>';
  const r = v.querySelector('input'), pct = v.querySelector('.pct-src');
  const k = () => cleSrc(src);
  r.value = Math.round((etat.vol[k()] ?? 1) * 100); pct.textContent = r.value + '%';
  r.oninput = () => { etat.vol[k()] = r.value / 100; pct.textContent = r.value + '%'; envoyerBientot(); };
  corps.appendChild(v);
}
function remplirCorps(i) {
  const src = etat.sources[i], el = slotsEl[i];
  if (!el) return;
  const corps = el.querySelector('.corps');
  corps.innerHTML = '';
  el.querySelector('.src-ic').innerHTML = ICONE_SRC[src.ui] || '';
  if (src.ui === 'monecran') {
    const b = document.createElement('button');
    b.className = 'petit choisir-ecran ' + (iframesEcran.has(i) ? '' : 'primaire');
    b.type = 'button'; b.textContent = iframesEcran.has(i) ? 'Arrêter ce partage' : 'Choisir l\'écran ou l\'onglet à partager';
    b.onclick = () => { if (iframesEcran.has(i)) { viderSource(i); envoyer(); majSlots(); } else demarrerMonEcran(i); };
    const ok = el.classList.contains('partage-ok');
    corps.insertAdjacentHTML('beforeend', ok
      ? '<p class="src-partage-ok"><span class="voyant ok"></span>Ton écran est partagé</p>'
      : iframesEcran.has(i) ? '<p class="aide src-partage-attente" title="Pour le son d\'une vidéo : partage l\'onglet et coche « Partager l\'audio ».">Choisis quoi partager dans la fenêtre du navigateur. Rien ne s\'ouvre ? Clique sur le bouton dans le cadre.</p>' : '');
    corps.appendChild(b);
  } else if (src.ui === 'console') {
    remplirConsole(i);
  } else if (src.ui === 'ecraninvite') {
    const sel = document.createElement('select');
    sel.className = 'ecran-invite';
    corps.appendChild(sel);
    remplirEcransInvites(i);
    sel.onchange = () => { src.ref = sel.value; src.nom = nomsEcrans.get(sel.value) || 'Écran invité'; src.actif = !!src.ref; envoyer(); majSlots(); majSonSource(i); };
  } else if (src.ui === 'image') {
    // une image choisie sur l'ordinateur
    const ligne = document.createElement('div');
    ligne.className = 'src-image';
    ligne.innerHTML = '<img alt="" hidden><span class="txt"></span><button class="petit" type="button">Changer</button><input type="file" accept="image/*" hidden>';
    const [vignette, nom, bouton, champ] = ligne.children;
    nom.textContent = src.fichier ? src.nom : '';
    if (src.fichier) fichiers.lire(src.fichier.id).then(b => { if (b) { vignette.src = URL.createObjectURL(b); vignette.hidden = false; } }).catch(() => {});
    bouton.onclick = () => champ.click();
    champ.onchange = () => choisirImage(i, champ.files[0]);
    corps.appendChild(ligne);
  } else if (src.ui === 'lien') {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'src-lien'; inp.inputMode = 'url'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.placeholder = 'Colle ton lien ici'; inp.value = src.saisie || src.ref || '';
    // dès qu'on colle ou qu'on arrête de taper, sans attendre Entrée
    let attente = 0;
    inp.oninput = () => { clearTimeout(attente); attente = setTimeout(() => poserLien(i, inp.value), 600); };
    inp.onpaste = () => { clearTimeout(attente); setTimeout(() => poserLien(i, inp.value), 0); };
    inp.onchange = () => { clearTimeout(attente); poserLien(i, inp.value); };
    inp.onkeydown = e => { if (e.key === 'Enter') { clearTimeout(attente); poserLien(i, inp.value); inp.blur(); } };
    corps.appendChild(inp);
    corps.insertAdjacentHTML('beforeend', '<p class="src-etat" hidden></p>');
    majEtatLien(i);
  }
  majSonSource(i);
}
const ecransInvites = () => [...presents.keys()].filter(id => estEcran(id) && !/_ecran\d$/.test(id));
function remplirEcransInvites(i) {
  const slot = slotsEl[i];
  const sel = slot && slot.querySelector('.ecran-invite');
  if (!sel) return;
  const src = etat.sources[i];
  const ids = ecransInvites();
  sel.innerHTML = '<option value="">' + (ids.length ? 'Choisis un écran' : 'Aucun invité ne partage son écran pour l\'instant') + '</option>' +
    ids.map(id => `<option value="${esc(id)}">${esc(nomsEcrans.get(id) || id)}</option>`).join('');
  // un seul invité partage : pas besoin de choisir
  if (!src.ref && ids.length === 1 && document.activeElement !== sel) { Object.assign(src, { ref: ids[0], nom: nomsEcrans.get(ids[0]) || 'Écran invité', actif: true }); envoyer(); majSlots(); majSonSource(i); }
  sel.value = ids.includes(src.ref) ? src.ref : '';
}
/* Le partage d'écran passe par une page de la salle, logée dans un cadre de la source.
   Pour qu'un seul clic suffise, ce cadre est chargé d'avance (dans la première source libre, encore cachée) dès que
   l'onglet Partage est ouvert ; au clic sur « Mon écran », on lui demande d'ouvrir le choix de l'écran en lui passant
   le droit de le faire (le navigateur n'accepte cette fenêtre qu'après un clic). Si le navigateur ne sait pas passer
   ce droit, le cadre reste là avec son propre bouton. Un cadre ne se déplace jamais : le déplacer le recharge. */
let ecranPret = null;        // { i, f, charge } : le cadre chargé d'avance
const ongletPartageOuvert = () => { const o = document.querySelector('[data-onglet="sources"]'); return !!(o && !o.hidden); };
function cadreEcran(i) {
  const f = document.createElement('iframe');
  f.allow = IFRAME_ALLOW;
  f.src = vdo({ room: session.room, push: idEcran(session, i + 1), label: `Mon écran ${i + 1}`, screenshare: true, quality: 0, screensharefps: 60,   // 60 i/s : un jeu reste fluide (une image fixe ne coûte rien de plus)
    novideo: true, noaudio: true, ln: 'fr', cleanish: true, css: baseUrl() + 'css/vdo-ecran.css' });
  const o = { i, f, charge: false };
  f.addEventListener('load', () => { o.charge = true; }, { once: true });
  slotsEl[i].querySelector('.ecran-cadre').appendChild(f);
  return o;
}
/* ---------- Console de jeu : un boîtier d'acquisition (Cam Link, Elgato…) est vu par le navigateur comme une caméra
   avec son propre son. On l'envoie comme un écran partagé : image jusqu'à 60 images par seconde, son du jeu en stéréo
   et sans traitement de voix. Jamais de taille imposée, comme pour les caméras. ---------- */
const BOITIER = /cam ?link|elgato|game ?capture|hd60|4k60|capture|avermedia|live ?gamer|hdmi|usb video|usb3\.? ?0|razer ripsaw|genki|shadowcast|uvc/i;
async function appareilsConsole() {
  let tous = [];
  try { tous = await navigator.mediaDevices.enumerateDevices(); } catch (e) { /* rien */ }
  let principale = '';
  try { principale = JSON.parse(localStorage.getItem(CLE_CAM) || '{}').nomCam || ''; } catch (e) { /* rien */ }
  const prises = new Set([principale, ...(typeof camsLocales !== 'undefined' ? [...camsLocales.values()].map(c => c.appareil) : [])]);
  const uniques = l => [...new Set(l.map(d => nomAppareil(d.label)).filter(Boolean))];
  const images = uniques(tous.filter(d => d.kind === 'videoinput')).filter(n => !prises.has(n)).sort((a, b) => BOITIER.test(b) - BOITIER.test(a));
  const sons = uniques(tous.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'));
  return { images, sons };
}
// le son qui va avec ce boîtier : « Cam Link 4K » -> « Interface audio numérique (Cam Link 4K) »
function sonDuBoitier(image, sons) {
  const coeur = String(image).replace(/\s*\(.*$/, '').trim().toLowerCase();
  return (coeur.length > 3 && sons.find(s => s.toLowerCase().includes(coeur))) || sons.find(s => BOITIER.test(s)) || '';
}
function remplirConsole(i) {
  const src = etat.sources[i], corps = slotsEl[i].querySelector('.corps');
  const branchee = iframesEcran.has(i);
  corps.innerHTML = `
    <div class="src-console" ${branchee ? 'hidden' : ''}>
      <label><span class="aide">Boîtier</span><select class="cs-image"></select></label>
      <label><span class="aide">Son du jeu</span><select class="cs-son"></select></label>
    </div>
    <button type="button" class="petit cs-brancher ${branchee ? '' : 'primaire'}">${branchee ? 'Débrancher la console' : 'Brancher la console'}</button>
    <p class="aide cs-aide"></p>`;
  const selI = corps.querySelector('.cs-image'), selS = corps.querySelector('.cs-son'), bouton = corps.querySelector('.cs-brancher'), aide = corps.querySelector('.cs-aide');
  const sansBoitier = () => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lien-bouton'; b.textContent = 'Partager la fenêtre du jeu';
    b.onclick = () => { viderSource(i); demarrerMonEcran(i); };
    aide.append('Pas de boîtier ? Ouvre PS Remote Play ou l\'appli Xbox sur ce PC : la console s\'affiche dans une fenêtre. ', b);
  };
  if (branchee) {
    aide.textContent = `${src.appareil || 'Boîtier'}${src.appareilSon ? ' · son : ' + src.appareilSon : ' · sans le son'}. Si l'image reste noire, ferme l'autre logiciel qui utilise le boîtier (OBS, par exemple).`;
    bouton.onclick = () => { arreterMonEcran(i); remplirCorps(i); envoyer(); majSlots(); };
    return;
  }
  bouton.disabled = true;
  appareilsConsole().then(({ images, sons }) => {
    if (etat.sources[i] !== src || src.ui !== 'console' || iframesEcran.has(i)) return;
    selI.innerHTML = images.length ? images.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') : '<option value="">Aucun boîtier trouvé</option>';
    if (images.includes(src.appareil)) selI.value = src.appareil;
    const majSons = () => {
      const devine = sonDuBoitier(selI.value, sons);
      selS.innerHTML = '<option value="">Sans le son</option>' + sons.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
      selS.value = sons.includes(src.appareilSon) && selI.value === src.appareil ? src.appareilSon : devine;
    };
    majSons(); selI.onchange = majSons;
    bouton.disabled = !images.length;
    if (!images.length) {
      aide.textContent = 'Branche ton boîtier d\'acquisition en USB, puis ';
      const r = document.createElement('button'); r.type = 'button'; r.className = 'lien-bouton'; r.textContent = 'cherche à nouveau'; r.onclick = () => remplirCorps(i);
      aide.append(r, '. '); sansBoitier();
    } else { aide.textContent = 'Ta caméra reste à côté. Le jeu part avec son propre son, sans retard pour toi : tu continues de jouer sur ta télé ou ton écran. '; sansBoitier(); }
    bouton.onclick = () => { if (selI.value) brancherConsole(i, selI.value, selS.value); };
  });
}
function brancherConsole(i, image, son) {
  const src = etat.sources[i], id = idEcran(session, i + 1);
  if (ecranPret && ecranPret.i === i) { ecranPret.f.src = 'about:blank'; ecranPret.f.remove(); ecranPret = null; }   // le cadre « Mon écran » chargé d'avance laisse la place
  const f = document.createElement('iframe');
  f.allow = IFRAME_ALLOW;
  f.src = urlPublier(session, id, 'Console', Object.assign({ noaudio: true, vd: paramAppareil(image), ad: son ? paramAppareil(son) : 0, autostart: true, maxframerate: 60, contenthint: 'motion' }, son ? { proaudio: true } : {}));
  slotsEl[i].querySelector('.ecran-cadre').appendChild(f);
  iframesEcran.set(i, f); ecransActifs.add(id); presents.set(id, { vu: Date.now() });
  Object.assign(src, { type: 'ecran', ref: id, nom: 'Console', appareil: image, appareilSon: son || '', actif: true });
  remplirCorps(i); envoyer(); majSlots();
}

function preparerEcran() {
  const i = premierVide();
  if (ecranPret && ecranPret.i !== i) { ecranPret.f.src = 'about:blank'; ecranPret.f.remove(); ecranPret = null; }
  if (i >= 0 && !ecranPret && ongletPartageOuvert()) ecranPret = cadreEcran(i);
}
setInterval(preparerEcran, 700);
function lancerMonEcran(i) {
  const id = idEcran(session, i + 1);
  const o = ecranPret && ecranPret.i === i ? ecranPret : cadreEcran(i);
  ecranPret = null;
  const f = o.f, clic = performance.now();
  const ouvrirChoix = () => {
    if (performance.now() - clic > 4500) return;      // le clic est trop loin : le navigateur refuserait, le bouton du cadre prend le relais
    let origine = '*';
    try { origine = new URL(f.src).origin; } catch (e) { /* rien */ }
    try { f.contentWindow.postMessage({ function: 'publishScreen' }, { targetOrigin: origine, delegate: 'display-capture' }); }
    catch (e) { ordre(f, { function: 'publishScreen' }); }
  };
  if (o.charge) ouvrirChoix(); else f.addEventListener('load', () => setTimeout(ouvrirChoix, 300), { once: true });
  iframesEcran.set(i, f);
  ecransActifs.add(id);
  presents.set(id, { vu: Date.now() });
  etat.sources[i].ref = id;
  etat.sources[i].actif = true;      // ce que tu choisis passe à l'écran tout de suite ; l'interrupteur « À l'écran » sert à le retirer
}
/* Le partage est vraiment arrivé dans la salle : on cache le cadre de vdo.ninja (il continue d'envoyer l'image)
   et on ne garde qu'une ligne « Ton écran est partagé ». */
function ecranEnDirect(id) {
  iframesEcran.forEach((f, i) => {
    if (idEcran(session, i + 1) !== id || !slotsEl[i] || slotsEl[i].classList.contains('partage-ok')) return;
    slotsEl[i].classList.add('partage-ok'); remplirCorps(i);
  });
}
function ecranCoupe(id) {
  etat.sources.forEach((s, i) => { if (idEcran(session, i + 1) === id && slotsEl[i] && slotsEl[i].classList.contains('partage-ok')) { slotsEl[i].classList.remove('partage-ok'); remplirCorps(i); } });
}
function arreterMonEcran(i) {
  if (slotsEl[i]) slotsEl[i].classList.remove('partage-ok');
  const f = iframesEcran.get(i);
  if (!f) return;
  f.src = 'about:blank'; f.remove();
  iframesEcran.delete(i);
  const id = idEcran(session, i + 1);
  ecransActifs.delete(id); presents.delete(id);
  etat.sources[i].ref = ''; etat.sources[i].actif = false;
}
function majSlots() {
  let pleins = 0;
  etat.sources.forEach((src, i) => {
    const el = slotsEl[i];
    if (!el) return;
    el.hidden = !src.ui;
    el.querySelector('.ecran-cadre').hidden = !(src.ui === 'monecran' || (src.ui === 'console' && iframesEcran.has(i)));
    if (src.ui) pleins++;
    el.classList.toggle('on', !!(src.actif && src.ref));
    el.querySelector('.actif').checked = !!(src.actif && src.ref);
    el.querySelector('.src-nom').textContent = src.ui === 'lien' ? (src.ref ? ({ video: 'Vidéo', image: 'Image' }[src.type] || src.nom || 'Page web') : 'Lien') : src.ui === 'image' ? 'Image' : src.ui === 'console' ? 'Console' : src.ui === 'ecraninvite' ? (src.ref ? src.nom : NOM_SOURCE.ecraninvite) : (NOM_SOURCE[src.ui] || '');
  });
  const choix = $('#src-choix');
  if (!choix) return;
  choix.hidden = pleins >= etat.sources.length;
  choix.classList.toggle('seul', !pleins);
  choix.querySelector('.src-choix-titre').textContent = pleins ? 'Montrer autre chose en plus' : 'Que veux-tu montrer ?';
  majSceneSources();
}
/* Quelque chose est prêt mais l'intro ou l'outro est à l'écran (le partage n'y apparaît pas) : un bouton pour passer aux caméras */
function majSceneSources() {
  const b = $('#src-scene');
  if (b) b.hidden = !((etat.scene === 'intro' || etat.scene === 'fin') && etat.sources.some(s => s.actif && s.ref));
}
setInterval(majSceneSources, 500);
/* On passe sur la scène Écran partagé sans rien à montrer : les choix se mettent en évidence */
function proposerPartage() {
  const c = $('#src-choix');
  if (c && !c.hidden) { c.classList.remove('appel'); void c.offsetWidth; c.classList.add('appel'); }
}
/* Coller dans l'onglet Partage : un lien devient une source « Lien », une image copiée devient une source « Image » */
document.addEventListener('paste', e => {
  const onglet = document.querySelector('[data-onglet="sources"]');
  if (!onglet || onglet.hidden || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
  const image = [...(e.clipboardData && e.clipboardData.files || [])].find(f => /^image\//.test(f.type));
  if (image) { e.preventDefault(); ajouterImage(image); return; }
  const texte = e.clipboardData && e.clipboardData.getData('text');
  const lu = texte && lireLien(texte);
  if (!lu || lu.erreur) return;
  const i = premierVide();
  if (i < 0) return toast('4 partages à la fois au maximum : retires-en un');
  e.preventDefault();
  etat.sources[i].ui = 'lien';
  remplirCorps(i); poserLien(i, texte.trim()); remplirCorps(i);
});
/* appelée quand un écran d'invité arrive ou part */
function majSources() { etat.sources.forEach((s, i) => { if (s.ui === 'ecraninvite') remplirEcransInvites(i); }); }
setInterval(majSources, 4000);

/* ---------- Bandeaux ---------- */
function afficherBandeaux() {
  const box = $('#bd-liste');
  box.innerHTML = etat.bandeaux.length ? '' : '';
  etat.bandeaux.forEach((b, i) => {
    const on = etat.bandeauActif && etat.bandeauActif.id === b.id;
    const el = document.createElement('div');
    el.className = 'elt' + (on ? ' on' : '');
    el.innerHTML = `<div class="txt"><b></b><small></small></div>
      <button class="petit ${on ? 'rouge' : 'primaire'}">${on ? 'Retirer' : 'Afficher'}</button>
      <button class="petit" title="Supprimer">✕</button>`;
    el.querySelector('b').textContent = b.titre; el.querySelector('small').textContent = b.sous || '';
    const [aff, sup] = el.querySelectorAll('button');
    aff.onclick = () => { etat.bandeauActif = on ? null : { id: b.id, titre: b.titre, sous: b.sous }; envoyer(); afficherBandeaux(); };
    sup.onclick = () => { etat.bandeaux.splice(i, 1); if (on) etat.bandeauActif = null; envoyer(); afficherBandeaux(); };
    box.appendChild(el);
  });
}
$('#bd-ajouter').onclick = () => {
  const titre = $('#bd-titre').value.trim(), sous = $('#bd-sous').value.trim();
  if (!titre) return toast('Écris au moins un titre');
  etat.bandeaux.push({ id: rnd(6), titre, sous });
  $('#bd-titre').value = ''; $('#bd-sous').value = '';
  envoyer(); afficherBandeaux();
};
$('#bd-sous').onkeydown = $('#bd-titre').onkeydown = e => { if (e.key === 'Enter') $('#bd-ajouter').click(); };
$('#defilant-txt').value = etat.defilant.texte || '';
function majDefilant() { $('#defilant-btn').textContent = etat.defilant.actif ? 'Retirer' : 'Afficher'; $('#defilant-btn').className = etat.defilant.actif ? 'rouge' : ''; }
$('#defilant-txt').oninput = e => { etat.defilant.texte = e.target.value; envoyerBientot(); };
$('#defilant-btn').onclick = () => {
  if (!etat.defilant.actif && !etat.defilant.texte.trim()) return toast('Écris d\'abord le texte défilant');
  etat.defilant.actif = !etat.defilant.actif; envoyer(); majDefilant();
};

construireSlots();
afficherBandeaux();
majDefilant();
envoyer();
