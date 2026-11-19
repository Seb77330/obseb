/* MESA : régie, choix du visuel de l'intro et de l'outro (onglet Titres) et temps qui reste.
   etat.introStyle et etat.outroStyle partent vers la sortie ; la liste et les formules sont dans js/habillages.js. */
'use strict';

{ const t = themeComplet(session); if (!etat.introStyle && t.introStyle) etat.introStyle = t.introStyle; if (!etat.outroStyle && t.outroStyle) etat.outroStyle = t.outroStyle; }
if (!habillageAutorise('intro', etat.introStyle)) etat.introStyle = 'classique';
if (!habillageAutorise('fin', etat.outroStyle)) etat.outroStyle = 'classique';
let hbVu = { scene: 'intro', id: etat.introStyle };          // ce que montre la petite fenêtre d'aperçu

function dessinerHabillages() {
  const n = nbHabillages();
  for (const scene of ['intro', 'fin']) {
    const choisi = scene === 'intro' ? etat.introStyle : etat.outroStyle;
    // un ordinateur trop juste pour la 3D ne voit pas ces visuels (test fait au clic sur « Nouveau live »)
    $('#hb-' + scene).innerHTML = HABILLAGES[scene].map((h, i) => {
      if (h.d3 && !fonds3dDispo() && !enBeta()) return '';   // pendant la bêta, tout reste visible
      const libre = i < n;
      return `<button type="button" class="hb-carte${h.id === choisi ? ' actif' : ''}${libre ? '' : ' verrou'}${hbVu.scene === scene && hbVu.id === h.id ? ' hb-vu' : ''}" data-id="${h.id}"
        title="${esc(h.nom)} : ${esc(h.desc)}${libre ? '' : ` (formule ${formulePourHabillage(i)})`}" aria-pressed="${h.id === choisi}">
        <span class="hb-vig">${vignetteHabillage(h.id)}</span><b>${esc(h.nom)}</b>${libre ? '' : `<em>${formulePourHabillage(i)}</em>`}</button>`;
    }).join('');
    $$('#hb-' + scene + ' .hb-carte').forEach(b => b.onclick = () => choisirHabillage(scene, b.dataset.id));
  }
  const tot = HABILLAGES.intro.length;
  $('#hb-formule').textContent = !fonds3dDispo() ? (enBeta() ? 'Visuels 3D : ton ordinateur est un peu juste, ils peuvent saccader' : 'Visuels 3D masqués : ton ordinateur est trop juste pour les faire tourner sans saccades')
    : n >= tot ? '' : `${n} sur ${tot} avec ta formule`;
}

function choisirHabillage(scene, id) {
  hbVu = { scene, id };
  montrerApercuHb();
  if (!habillageAutorise(scene, id)) {
    const i = HABILLAGES[scene].findIndex(h => h.id === id);
    toast(`Aperçu seulement : ce visuel fait partie de la formule ${formulePourHabillage(i)}`);
  } else {
    if (scene === 'intro') etat.introStyle = id; else etat.outroStyle = id;
    envoyer();
  }
  dessinerHabillages();
}

/* La petite fenêtre montre le vrai visuel qui tourne, avec ton titre et tes couleurs */
function montrerApercuHb() {
  const h = HABILLAGES[hbVu.scene].find(x => x.id === hbVu.id) || HABILLAGES.intro[0];
  const q = hbVu.scene === 'intro' ? `scene=intro&intro=${h.id}&compte=300&ecoule=40` : `scene=fin&outro=${h.id}`;
  const src = `sortie.html?preview=hb&demo=3&${q}${location.hash}`;
  const f = $('#hb-apercu');
  if (f.dataset.src !== src) { f.dataset.src = src; f.src = src; }
  $('#hb-apercu-nom').textContent = (hbVu.scene === 'intro' ? 'Intro · ' : 'Outro · ') + h.nom;
}

/* Temps qui reste, affiché au-dessus des boutons */
function majResteHb() {
  const el = $('#hb-reste');
  if (!etat.fin) { el.textContent = 'Aucun'; el.className = ''; return; }
  const ms = etat.fin - Date.now();
  if (ms <= 0) { el.textContent = "C'est l'heure"; el.className = 'fini'; return; }
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, d2 = x => String(x).padStart(2, '0');
  el.textContent = 'Reste ' + (h ? `${h}:${d2(m)}:${d2(s % 60)}` : `${m}:${d2(s % 60)}`);
  el.className = 'en-cours';
}
setInterval(majResteHb, 500);

/* Le ✎ des scènes Intro et Outro ouvre ce choix */
function ouvrirChoixHabillage(scene) {
  ouvrirOnglet('habillage');
  hbVu = { scene, id: scene === 'intro' ? etat.introStyle : etat.outroStyle };
  montrerApercuHb(); dessinerHabillages();
  const el = $('#hb-' + scene);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('eclair'); void el.offsetWidth; el.classList.add('eclair');
}

dessinerHabillages();
montrerApercuHb();
majResteHb();
