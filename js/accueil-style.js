/* OBSeb : accueil, choix du style (thèmes prêts, personnalisation, import depuis OBS) */
'use strict';

boutonAffichage($('#place-affichage'));

/* ----- Polices : chaque carte s'affiche dans sa propre police ----- */
chargerPolices(FONTS);
const boitePolices = $('#polices');
FONTS.forEach(f => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'police'; b.dataset.font = f;
  b.innerHTML = `<span style="font-family:'${f}'">Spécial Bond</span><small>${esc(f)}</small>`;
  b.onclick = () => { $('#f-font').value = f; $('#f-font').dispatchEvent(new Event('change')); majVisuels(); };
  boitePolices.appendChild(b);
});

/* ----- Images glissées depuis le PC : réduites et rangées dans le thème ----- */
async function imageVersDataUrl(fichier, maxW, maxH, qualite = 0.74) {
  const img = await createImageBitmap(fichier);
  const r = Math.min(1, maxW / img.width, maxH / img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', qualite);
}
const CHAMP_THEME = { 'f-image': 'bgImage', 'f-logo': 'logo' };
async function deposerImage(cible, fichier) {
  if (!fichier || !fichier.type.startsWith('image/')) return toast('Ce fichier n\'est pas une image');
  const url = cible === 'f-image' ? await imageVersDataUrl(fichier, 1280, 720, 0.72) : await imageVersDataUrl(fichier, 400, 400, 0.85);
  surcharge(CHAMP_THEME[cible], url);
  majVisuels();
  toast(cible === 'f-image' ? 'Image de fond ajoutée' : 'Logo ajouté');
}
$$('.depot[data-cible]').forEach(d => {
  const input = d.querySelector('input[type=file]');
  d.onclick = e => { if (!e.target.closest('.retirer')) input.click(); };
  input.onchange = () => deposerImage(d.dataset.cible, input.files[0]);
  d.ondragover = e => { e.preventDefault(); d.classList.add('survol'); };
  d.ondragleave = () => d.classList.remove('survol');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('survol'); deposerImage(d.dataset.cible, e.dataTransfer.files[0]); };
});

/* Met à jour les cartes de police et les aperçus d'images selon le thème en cours */
function majVisuels() {
  const t = themeComplet(brouillon);
  $$('.police').forEach(b => b.classList.toggle('actif', b.dataset.font === t.fontTitle));
  $$('.depot[data-cible]').forEach(d => {
    const v = t[CHAMP_THEME[d.dataset.cible]];
    const vue = d.querySelector('.depot-vue');
    vue.style.backgroundImage = v ? `url("${v}")` : '';
    vue.innerHTML = v ? '<button type="button" class="petit retirer" title="Retirer">✕</button>' : '';
    if (v) vue.querySelector('.retirer').onclick = e => { e.stopPropagation(); surcharge(CHAMP_THEME[d.dataset.cible], ''); majVisuels(); };
    $('#' + d.dataset.cible).value = v && !v.startsWith('data:') ? v : '';
  });
}
const remplirFormDeBase = remplirForm;
remplirForm = function () { remplirFormDeBase(); majVisuels(); };
majVisuels();

/* ----- Import depuis OBS ----- */
const depotObs = $('#depot-obs');
depotObs.onclick = e => {
  const u = e.target.closest('u');
  if (u && u.textContent.includes('fichiers')) $('#obs-fichiers').click(); else $('#obs-dossier').click();
};
$('#obs-dossier').onchange = e => importerObs([...e.target.files]);
$('#obs-fichiers').onchange = e => importerObs([...e.target.files]);
depotObs.ondragover = e => { e.preventDefault(); depotObs.classList.add('survol'); };
depotObs.ondragleave = () => depotObs.classList.remove('survol');
depotObs.ondrop = async e => {
  e.preventDefault(); depotObs.classList.remove('survol');
  importerObs(await fichiersDuDepot(e.dataTransfer));
};
/* Un dossier glissé : on parcourt son contenu */
async function fichiersDuDepot(dt) {
  const sortie = [];
  const lireEntree = entree => new Promise(ok => {
    if (entree.isFile) entree.file(f => { sortie.push(f); ok(); }, () => ok());
    else if (entree.isDirectory) {
      const lecteur = entree.createReader(), tout = [];
      const lot = () => lecteur.readEntries(async es => { if (!es.length) { for (const x of tout) await lireEntree(x); ok(); } else { tout.push(...es); lot(); } }, () => ok());
      lot();
    } else ok();
  });
  const entrees = [...dt.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entrees.length) return [...dt.files];
  for (const en of entrees) await lireEntree(en);
  return sortie;
}
const nomBase = chemin => String(chemin || '').split(/[\\/]/).pop().toLowerCase();
function couleurObs(n) {   // OBS range les couleurs en ABGR
  if (typeof n !== 'number') return null;
  const r = n & 255, g = (n >> 8) & 255, b = (n >> 16) & 255;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function saturation(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { sat: max === 0 ? 0 : (max - min) / max, lum: (max + min) / 2 };
}
async function importerObs(fichiers) {
  const rapport = $('#obs-rapport');
  const json = fichiers.find(f => /collection\.json$/i.test(f.name)) || fichiers.find(f => /\.json$/i.test(f.name));
  if (!json) { rapport.innerHTML = '<span class="ko">Je ne trouve pas le fichier .json de la collection OBS.</span> Glisse le dossier créé par « Exporter vers OBSeb », ou le fichier .json de ta collection (dans %APPDATA%\\obs-studio\\basic\\scenes).'; return; }
  let col;
  try { col = JSON.parse(await json.text()); } catch (e) { rapport.innerHTML = '<span class="ko">Ce fichier .json n\'est pas une collection OBS lisible.</span>'; return; }
  const sources = col.sources || [];
  const images = new Map(fichiers.filter(f => f.type.startsWith('image/')).map(f => [f.name.toLowerCase(), f]));
  const notes = [], manquants = [];
  const t = {};

  // Images : fond et logo
  const imgSources = sources.filter(s => s.id === 'image_source' && s.settings && s.settings.file);
  const trouve = s => images.get(nomBase(s.settings.file));
  imgSources.forEach(s => { if (!trouve(s)) manquants.push(`${s.name} (${nomBase(s.settings.file)})`); });
  const parNom = re => imgSources.find(s => re.test(s.name) && trouve(s));
  let fond = parNom(/fond|background|\bbg\b|wallpaper|arri[eè]re/i), logo = parNom(/logo/i);
  if (!fond) {   // sinon, la plus grande image
    let max = 0;
    for (const s of imgSources) {
      const f = trouve(s); if (!f || (logo && s === logo)) continue;
      try { const b = await createImageBitmap(f); if (b.width * b.height > max) { max = b.width * b.height; fond = s; } } catch (e) { /* rien */ }
    }
  }
  if (fond) { t.bgImage = await imageVersDataUrl(trouve(fond), 1280, 720, 0.72); notes.push(`Image de fond : « ${fond.name} »`); }
  if (logo) { t.logo = await imageVersDataUrl(trouve(logo), 400, 400, 0.85); notes.push(`Logo : « ${logo.name} »`); }

  // Textes : police et couleurs
  const textes = sources.filter(s => /^text_/.test(s.id) && s.settings);
  const polices = {};
  textes.forEach(s => { const f = s.settings.font && s.settings.font.face; if (f) polices[f] = (polices[f] || 0) + 1; });
  const police = Object.entries(polices).sort((a, b) => b[1] - a[1])[0];
  if (police) {
    t.fontTitle = police[0];
    notes.push(`Police : ${police[0]}${FONTS.includes(police[0]) ? '' : ' (chargée depuis Google Fonts si elle y existe, sinon une police proche)'}`);
  }
  const couleurs = [];
  textes.forEach(s => { const c = couleurObs(s.settings.color ?? s.settings.color1); if (c) couleurs.push(c); });
  sources.filter(s => /^color_source/.test(s.id) && s.settings).forEach(s => { const c = couleurObs(s.settings.color); if (c) couleurs.push(c); });
  const vives = couleurs.map(c => ({ c, ...saturation(c) })).filter(x => x.sat > 0.35 && x.lum > 0.2 && x.lum < 0.85).sort((a, b) => b.sat - a.sat);
  if (vives[0]) { t.accent = vives[0].c; notes.push(`Couleur d'accent : ${vives[0].c}`); }
  const sombres = couleurs.map(c => ({ c, ...saturation(c) })).filter(x => x.lum < 0.12).sort((a, b) => a.lum - b.lum);
  if (sombres[0]) t.bg = sombres[0].c;

  // Titre proposé : le plus grand texte
  const grand = textes.filter(s => s.settings.text).sort((a, b) => ((b.settings.font || {}).size || 0) - ((a.settings.font || {}).size || 0))[0];
  if (grand && !brouillon.titre.trim()) { brouillon.titre = grand.settings.text.split('\n')[0].slice(0, 70); notes.push(`Titre repris : « ${brouillon.titre} »`); }

  const musiques = sources.filter(s => s.id === 'ffmpeg_source' && /\.(mp3|wav|ogg|m4a)$/i.test((s.settings || {}).local_file || ''));
  const scenes = sources.filter(s => s.id === 'scene').map(s => s.name);

  brouillon.theme = Object.assign({ preset: brouillon.theme.preset || 'minimal' }, t);
  remplirForm(); apercu();
  rapport.innerHTML = `<div class="ok">Collection « ${esc(col.name || json.name)} » importée : ${scenes.length} scène(s), ${sources.length - scenes.length} source(s).</div>
    <ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}
    ${manquants.length ? `<li class="ko">Images introuvables dans ce que tu as glissé : ${manquants.slice(0, 6).map(esc).join(', ')}${manquants.length > 6 ? '…' : ''}</li>` : ''}
    ${musiques.length ? `<li>Musique repérée : ${musiques.map(m => esc(m.name)).join(', ')}. Ajoute son lien dans « Personnaliser » (un MP3 ne tient pas dans un lien).</li>` : ''}</ul>
    <p class="aide" style="margin:8px 0 0">Vérifie l'aperçu, ajuste dans « Personnaliser », puis crée la session. Pour reproduire une scène OBS à l'identique (animations, placements), dis-le-moi : je transforme l'export en thème complet.</p>`;
  toast('Style importé depuis OBS');
}

/* ----- Mes styles : garder ses réglages (police, couleurs, logo, fond) pour les prochains lives ----- */
const CLE_STYLES = 'studioSeb:styles';
function lireStyles() { try { const l = JSON.parse(localStorage.getItem(CLE_STYLES) || '[]'); return Array.isArray(l) ? l.filter(x => x && x.id && x.theme) : []; } catch (e) { return []; } }
function ecrireStyles(l) {
  try { localStorage.setItem(CLE_STYLES, JSON.stringify(l)); return true; }
  catch (e) { toast('Plus de place dans ce navigateur : supprime un style ou allège l\'image de fond'); return false; }
}
const cleTheme = t => JSON.stringify(Object.keys(t || {}).sort().map(k => [k, t[k]]));
function styleCorrespondant(theme) { const c = cleTheme(theme); return lireStyles().find(s => cleTheme(s.theme) === c) || null; }
function appliquerStyleDefaut(session) {
  const d = lireStyles().find(s => s.defaut);
  if (d) session.theme = JSON.parse(JSON.stringify(d.theme));
}
function dessinerStyles() {
  const l = lireStyles(), box = $('#galerie-styles');
  $('#mes-styles').hidden = !l.length;
  box.innerHTML = '';
  for (const st of l) {
    const t = themeComplet({ theme: st.theme });
    const b = document.createElement('div');
    b.className = 'theme-carte'; b.dataset.style = st.id; b.tabIndex = 0; b.setAttribute('role', 'button'); b.style.cursor = 'pointer';
    b.innerHTML = `<span class="theme-img"><span class="style-vue"><b>Aa</b></span></span>
      ${st.defaut ? '<span class="defaut">Par défaut</span>' : ''}
      <button type="button" class="oter" title="Supprimer ce style">✕</button>
      <span class="theme-txt"><b></b></span>`;
    const vue = b.querySelector('.style-vue');
    vue.style.background = t.bgImage ? `center/cover no-repeat url("${t.bgImage}")` : `radial-gradient(circle at 50% 35%, ${t.bg2}, ${t.bg})`;
    const aa = vue.querySelector('b');
    aa.style.fontFamily = `'${t.fontTitle}', sans-serif`; aa.style.color = t.text; aa.style.borderColor = t.accent;
    b.querySelector('.theme-txt b').textContent = st.nom;
    b.title = st.defaut ? 'Style utilisé d\'office pour chaque nouveau live' : 'Clique pour l\'appliquer';
    const choisir = () => { brouillon.theme = JSON.parse(JSON.stringify(st.theme)); remplirForm(); apercu(); };
    b.onclick = e => { if (!e.target.closest('.oter')) choisir(); };
    b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } };
    b.querySelector('.oter').onclick = () => {
      if (!confirm(`Supprimer le style « ${st.nom} » ? Les lives déjà créés gardent leur habillage.`)) return;
      ecrireStyles(lireStyles().filter(x => x.id !== st.id)); dessinerStyles(); remplirForm();
    };
    box.appendChild(b);
  }
  chargerPolices([...new Set(l.map(st => themeComplet({ theme: st.theme }).fontTitle))]);
}
$('#style-enregistrer').onclick = () => {
  const nom = $('#style-nom').value.trim().slice(0, 30);
  if (!nom) { $('#style-nom').focus(); return toast('Donne un nom à ce style'); }
  let l = lireStyles();
  const defaut = $('#style-defaut').checked;
  if (defaut) l.forEach(s => { s.defaut = false; });
  const deja = l.find(s => s.nom.toLowerCase() === nom.toLowerCase());
  const theme = JSON.parse(JSON.stringify(brouillon.theme));
  if (deja) { deja.theme = theme; deja.defaut = defaut; }
  else l.unshift({ id: rnd(8), nom, theme, defaut });
  if (!ecrireStyles(l)) return;
  $('#style-nom').value = '';
  dessinerStyles(); remplirForm();
  toast(deja ? `Style « ${nom} » mis à jour` : `Style « ${nom} » enregistré : il est en haut des thèmes`);
};
$('#style-nom').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#style-enregistrer').click(); } };
dessinerStyles();
