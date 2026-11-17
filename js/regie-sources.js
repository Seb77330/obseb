/* OBSeb : régie, partie Sources (4 max), Bandeaux et Musique */
'use strict';

const TYPES_SOURCE = [
  ['', '— vide —'], ['monecran', 'Mon écran'], ['ecraninvite', "Écran d'un invité"],
  ['image', 'Image (lien)'], ['video', 'Vidéo (lien MP4)'], ['web', 'Page web (lien)']
];
const ecransActifs = new Set();      // tes partages d'écran en cours (ids vdo.ninja)
const iframesEcran = new Map();      // n° de source -> iframe de partage

etat.sources = Array.from({ length: 4 }, (_, i) => Object.assign({ ui: '', type: '', ref: '', nom: '', actif: false }, (etat.sources || [])[i] || {}));
// au rechargement de la page, tes partages d'écran sont coupés : on les désactive
etat.sources.forEach(s => { if (s.ui === 'monecran') { s.actif = false; s.ref = ''; } });
etat.bandeaux = etat.bandeaux || [];
etat.defilant = etat.defilant || { texte: '', actif: false };
etat.playlist = etat.playlist || [];
etat.musique = etat.musique || { idx: 0, lecture: false, n: 0 };

const cleSrc = s => s.type === 'ecran' ? s.ref : s.type + ':' + s.ref;

/* ---------- Sources ---------- */
function construireSlots() {
  const box = $('#sources');
  box.innerHTML = '';
  etat.sources.forEach((src, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `
      <div class="tete"><b>${i + 1}</b>
        <select class="type">${TYPES_SOURCE.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        <label class="aide" style="display:flex;gap:5px;align-items:center;white-space:nowrap"><input type="checkbox" class="actif"> À l'écran</label>
      </div>
      <div class="corps"></div>`;
    el.querySelector('.type').value = src.ui || '';
    el.querySelector('.type').onchange = e => changerType(i, e.target.value);
    el.querySelector('.actif').onchange = e => {
      if (e.target.checked && !src.ref) { e.target.checked = false; return toast('Choisis d\'abord le contenu de cette source'); }
      src.actif = e.target.checked; envoyer(); majSlots();
    };
    box.appendChild(el);
    remplirCorps(i);
  });
  majSlots();
}
function changerType(i, ui) {
  const src = etat.sources[i];
  arreterMonEcran(i);
  Object.assign(src, { ui, type: '', ref: '', nom: '', actif: false });
  if (ui === 'monecran') Object.assign(src, { type: 'ecran', nom: `Mon écran ${i + 1}` });
  if (ui === 'ecraninvite') src.type = 'ecran';
  if (['image', 'video', 'web'].includes(ui)) src.type = ui;
  remplirCorps(i); envoyer(); majSlots();
}
function remplirCorps(i) {
  const src = etat.sources[i];
  const corps = $('#sources').children[i].querySelector('.corps');
  corps.innerHTML = '';
  if (src.ui === 'monecran') {
    const b = document.createElement('button');
    b.className = 'petit primaire'; b.textContent = iframesEcran.has(i) ? 'Arrêter ce partage' : 'Choisir l\'écran ou l\'onglet à partager';
    b.onclick = () => { iframesEcran.has(i) ? arreterMonEcran(i) : lancerMonEcran(i); remplirCorps(i); envoyer(); majSlots(); };
    corps.appendChild(b);
    if (iframesEcran.has(i)) corps.appendChild(iframesEcran.get(i));
    corps.insertAdjacentHTML('beforeend', '<span class="aide">Pour un extrait vidéo, partage l\'onglet et coche « Partager l\'audio ».</span>');
  } else if (src.ui === 'ecraninvite') {
    const sel = document.createElement('select');
    sel.className = 'ecran-invite';
    corps.appendChild(sel);
    remplirEcransInvites(i);
    sel.onchange = () => { src.ref = sel.value; src.nom = nomsEcrans.get(sel.value) || 'Écran invité'; if (!src.ref) src.actif = false; envoyer(); majSlots(); };
  } else if (['image', 'video', 'web'].includes(src.ui)) {
    const inp = document.createElement('input');
    inp.type = 'url'; inp.placeholder = 'https://…'; inp.value = src.ref || '';
    inp.onchange = () => {
      const v = inp.value.trim();
      if (v && !/^https:\/\//.test(v)) { toast('Le lien doit commencer par https://'); return; }
      src.ref = v; src.nom = src.ui; if (!v) src.actif = false; envoyer(); majSlots();
    };
    corps.appendChild(inp);
  }
  if (src.ui === 'monecran' || src.ui === 'ecraninvite' || src.ui === 'video') {
    const v = document.createElement('div');
    v.className = 'reglages'; v.style.cssText = 'display:flex;gap:8px;align-items:center';
    v.innerHTML = '<span class="aide">🔊 Son</span><input type="range" min="0" max="100" class="vol-src" style="flex:1"><span class="aide pct-src"></span>';
    const r = v.querySelector('input'), pct = v.querySelector('.pct-src');
    const k = () => cleSrc(src);
    r.value = Math.round((etat.vol[k()] ?? 1) * 100); pct.textContent = r.value + '%';
    r.oninput = () => { etat.vol[k()] = r.value / 100; pct.textContent = r.value + '%'; envoyerBientot(); };
    corps.appendChild(v);
  }
}
function remplirEcransInvites(i) {
  const slot = $('#sources').children[i];
  const sel = slot && slot.querySelector('.ecran-invite');
  if (!sel) return;
  const src = etat.sources[i];
  const ids = [...presents.keys()].filter(id => estEcran(id) && !/_ecran\d$/.test(id));
  sel.innerHTML = '<option value="">' + (ids.length ? 'Choisis un écran' : 'Aucun invité ne partage son écran') + '</option>' +
    ids.map(id => `<option value="${esc(id)}">${esc(nomsEcrans.get(id) || id)}</option>`).join('');
  sel.value = ids.includes(src.ref) ? src.ref : '';
}
function lancerMonEcran(i) {
  const id = idEcran(session, i + 1);
  const f = document.createElement('iframe');
  f.allow = IFRAME_ALLOW;
  f.src = vdo({ room: session.room, push: id, label: `Mon écran ${i + 1}`, screenshare: true, quality: 0,
    novideo: true, noaudio: true, ln: 'fr', cleanish: true });
  iframesEcran.set(i, f);
  ecransActifs.add(id);
  presents.set(id, { vu: Date.now() });
  etat.sources[i].ref = id;
}
function arreterMonEcran(i) {
  const f = iframesEcran.get(i);
  if (!f) return;
  f.src = 'about:blank'; f.remove();
  iframesEcran.delete(i);
  const id = idEcran(session, i + 1);
  ecransActifs.delete(id); presents.delete(id);
  etat.sources[i].ref = ''; etat.sources[i].actif = false;
}
function majSlots() {
  [...$('#sources').children].forEach((el, i) => {
    const src = etat.sources[i];
    el.classList.toggle('on', !!(src.actif && src.ref));
    el.querySelector('.actif').checked = !!(src.actif && src.ref);
  });
}
/* appelée quand un écran d'invité arrive ou part */
function majSources() { etat.sources.forEach((s, i) => { if (s.ui === 'ecraninvite') remplirEcransInvites(i); }); }
setInterval(majSources, 4000);

/* ---------- Bandeaux ---------- */
function afficherBandeaux() {
  const box = $('#bd-liste');
  box.innerHTML = etat.bandeaux.length ? '' : '<div class="vide">Ajoute des bandeaux (noms des invités, questions, annonces) pour les afficher d\'un clic.</div>';
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

/* ---------- Musique ---------- */
function afficherMusiques() {
  const box = $('#mu-liste');
  box.innerHTML = etat.playlist.length ? '' : '<div class="vide">Ajoute tes musiques (liens MP3). Elles passent dans le son du live.</div>';
  etat.playlist.forEach((m, i) => {
    const on = etat.musique.idx === i;
    const el = document.createElement('div');
    el.className = 'elt' + (on && etat.musique.lecture ? ' on' : '');
    el.innerHTML = `<div class="txt"></div><button class="petit">${on && etat.musique.lecture ? '⏸' : '▶'}</button><button class="petit" title="Supprimer">✕</button>`;
    el.querySelector('.txt').textContent = `${i + 1}. ${m.nom}`;
    const [jouer, sup] = el.querySelectorAll('button');
    jouer.onclick = () => {
      if (on && etat.musique.lecture) etat.musique.lecture = false;
      else { etat.musique = { idx: i, lecture: true, n: (etat.musique.n || 0) + (on ? 0 : 1) }; }
      envoyer(); afficherMusiques();
    };
    sup.onclick = () => {
      etat.playlist.splice(i, 1);
      if (etat.musique.idx >= etat.playlist.length) etat.musique = { idx: 0, lecture: false, n: (etat.musique.n || 0) + 1 };
      envoyer(); afficherMusiques();
    };
    box.appendChild(el);
  });
  const m = etat.playlist[etat.musique.idx];
  $('#mu-lecture').textContent = etat.musique.lecture ? '⏸ Pause' : '▶ Lecture';
  $('#mu-etat').textContent = m ? (etat.musique.lecture ? 'En cours : ' : 'Prêt : ') + m.nom : '';
}
$('#mu-ajouter').onclick = () => {
  const url = $('#mu-url').value.trim(), nom = $('#mu-nom').value.trim();
  if (!/^https:\/\//.test(url)) return toast('Colle un lien qui commence par https://');
  etat.playlist.push({ nom: nom || url.split('/').pop().replace(/\.\w+$/, ''), url });
  $('#mu-url').value = ''; $('#mu-nom').value = '';
  envoyer(); afficherMusiques();
};
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

construireSlots();
afficherBandeaux();
majDefilant();
afficherMusiques();
envoyer();
