/* OBSeb : accueil, « Mes lives » et « Mes enregistrements ».
   Sur la page de création, à la place du grand aperçu (qui redisait la régie) : deux onglets.
   Mes lives : tes lives, rangés (programmés, prêts, terminés), avec « Ouvrir la régie » et « Reprendre son thème ».
   Mes enregistrements : les vidéos tournées avec le bouton « Enregistrer » de la régie, affichées comme des vidéos
   (une image tirée de la vidéo, la durée, horizontal ou vertical), rangées par date, à lire sur place ou télécharger.
   Les fichiers sont dans l'espace de stockage du site, sur ce PC (dossier « enregistrements »), avec une petite fiche .json. */
'use strict';
(() => {
  const DOSSIER = 'enregistrements';
  const lireNom = n => { try { return decodeURIComponent(n); } catch (e) { return n; } };
  const taille = o => o > 1e9 ? (o / 1e9).toFixed(1).replace('.', ',') + ' Go' : Math.max(1, Math.round(o / 1e6)) + ' Mo';
  const duree = ms => { if (!(ms > 0)) return ''; const t = Math.round(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const jour = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const heure = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  let recs = [];          // [{ interne, nom, taille, date, fiche, h }]
  let filtre = 'tous';
  const vignettes = new Map();   // interne -> { src, duree, vertical }

  /* ----- Lire le dossier ----- */
  async function dossier() { const r = await navigator.storage.getDirectory(); return r.getDirectoryHandle(DOSSIER, { create: true }); }
  async function charger() {
    const l = [], fiches = {};
    try {
      const d = await dossier();
      for await (const [nom, h] of d.entries()) {
        if (h.kind !== 'file') continue;
        if (nom.endsWith('.json')) { try { fiches[nom.slice(0, -5)] = JSON.parse(await (await h.getFile()).text()); } catch (e) { /* fiche abîmée */ } continue; }
        const f = await h.getFile();
        if (!f.size) continue;
        l.push({ interne: nom, nom: lireNom(nom), taille: f.size, date: f.lastModified, h });
      }
    } catch (e) { /* pas d'espace de stockage (navigation privée, Safari ancien) */ }
    l.forEach(r => { r.fiche = fiches[r.interne] || null; });
    recs = l.sort((a, b) => b.date - a.date);
    return recs;
  }
  const estVertical = r => r.fiche ? r.fiche.format === 'vertical' : / vertical\.\w+$/.test(r.nom);

  /* ----- Une image tirée de la vidéo (vers la 2e seconde), et sa durée ----- */
  function vignette(r) {
    if (vignettes.has(r.interne)) return Promise.resolve(vignettes.get(r.interne));
    return new Promise(async fin => {
      let url = '';
      const v = document.createElement('video');
      const finir = res => { clearTimeout(t); v.removeAttribute('src'); v.load(); if (url) URL.revokeObjectURL(url); vignettes.set(r.interne, res); fin(res); };
      const t = setTimeout(() => finir({ src: '', duree: 0 }), 8000);
      try { url = URL.createObjectURL(await r.h.getFile()); } catch (e) { return finir({ src: '', duree: 0 }); }
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      v.onloadeddata = () => { const d = v.duration; v.currentTime = isFinite(d) && d > 0 ? Math.min(2, d / 3) : 1; };
      v.onseeked = () => {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return finir({ src: '', duree: 0 });
        const k = Math.min(1, 480 / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finir({ src: c.toDataURL('image/jpeg', 0.8), duree: isFinite(v.duration) ? v.duration * 1000 : 0, vertical: h > w });
      };
      v.onerror = () => finir({ src: '', duree: 0 });
      v.src = url;
    });
  }

  /* ----- Lecteur sur place ----- */
  let lecteur = null;
  function lire(r) {
    if (!lecteur) {
      lecteur = document.createElement('dialog');
      lecteur.className = 'biblio-lecteur';
      lecteur.innerHTML = '<div class="bl-tete"><b></b><button type="button" class="bl-dl">Télécharger</button><button type="button" class="bl-fermer">Fermer</button></div><video controls playsinline></video>';
      document.body.appendChild(lecteur);
      lecteur.querySelector('.bl-fermer').onclick = () => lecteur.close();
      lecteur.addEventListener('close', () => { const v = lecteur.querySelector('video'); v.pause(); if (v.src) URL.revokeObjectURL(v.src); v.removeAttribute('src'); });
      lecteur.addEventListener('click', e => { if (e.target === lecteur) lecteur.close(); });
    }
    r.h.getFile().then(f => {
      const v = lecteur.querySelector('video');
      v.src = URL.createObjectURL(f);
      lecteur.querySelector('b').textContent = r.nom.replace(/\.\w+$/, '');
      lecteur.querySelector('.bl-dl').onclick = () => telecharger(r);
      lecteur.classList.toggle('vertical', estVertical(r));
      lecteur.showModal();
      v.play().catch(() => {});
    }).catch(() => toast('Cette vidéo ne se lit plus'));
  }
  async function telecharger(r) {
    const f = await r.h.getFile();
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = r.nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  }
  async function supprimer(r) {
    if (!await confirmer(`Supprimer « ${r.nom.replace(/\.\w+$/, '')} » de ce navigateur ? Le fichier déjà téléchargé sur ton PC n'est pas touché.`, { oui: 'Oui, supprimer', non: 'Non' })) return;
    try { const d = await dossier(); await d.removeEntry(r.interne); d.removeEntry(r.interne + '.json').catch(() => {}); } catch (e) { return toast('Impossible de supprimer cette vidéo'); }
    vignettes.delete(r.interne);
    toast('Vidéo supprimée');
    majBiblio();
  }

  /* ----- Galerie des enregistrements, rangée par date ----- */
  function groupe(d) {
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    if (d >= auj.getTime()) return 'Aujourd\'hui';
    if (d >= auj.getTime() - 864e5) return 'Hier';
    if (d >= auj.getTime() - 6 * 864e5) return 'Cette semaine';
    if (d >= auj.getTime() - 30 * 864e5) return 'Ce mois-ci';
    return 'Plus ancien';
  }
  function dessinerRecs(box) {
    box.innerHTML = '';
    if (!recs.length) {
      box.innerHTML = `<div class="biblio-vide"><div class="bv-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg></div>
        <b>Pas encore d'enregistrement</b><p>Dans la régie, clique sur « Enregistrer » pour tourner une vidéo, avec ou sans direct. Elle arrive ici, et dans ton dossier Téléchargements.</p></div>`;
      return;
    }
    const nbV = recs.filter(estVertical).length, nbH = recs.length - nbV;
    const barre = document.createElement('div'); barre.className = 'biblio-filtres';
    barre.innerHTML = [['tous', 'Toutes', recs.length], ['h', 'Horizontales', nbH], ['v', 'Verticales', nbV]]
      .map(([f, n, c]) => `<button type="button" data-filtre="${f}" class="${filtre === f ? 'actif' : ''}" ${c ? '' : 'disabled'}>${n} <small>${c}</small></button>`).join('')
      + `<span class="bf-total">${taille(recs.reduce((a, r) => a + r.taille, 0))} au total</span>`;
    barre.querySelectorAll('[data-filtre]').forEach(b => b.onclick = () => { filtre = b.dataset.filtre; document.querySelectorAll('.biblio-vue[data-vue="recs"]').forEach(dessinerRecs); });
    box.appendChild(barre);
    const liste = recs.filter(r => filtre === 'tous' || (filtre === 'v') === estVertical(r));
    let dernier = '';
    let grille = null;
    for (const r of liste) {
      const g = groupe(r.fiche && r.fiche.debut ? r.fiche.debut : r.date);
      if (g !== dernier) {
        dernier = g;
        box.insertAdjacentHTML('beforeend', `<h3 class="biblio-groupe">${g}</h3>`);
        grille = document.createElement('div'); grille.className = 'biblio-grille'; box.appendChild(grille);
      }
      const vert = estVertical(r);
      const quand = r.fiche && r.fiche.debut ? r.fiche.debut : r.date;
      const c = document.createElement('article'); c.className = 'rec-carte' + (vert ? ' vertical' : '');
      c.innerHTML = `<button type="button" class="rc-vue" title="Lire la vidéo"><span class="rc-img"></span><span class="rc-lecture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><span class="rc-duree"></span><span class="rc-format">${vert ? 'Vertical' : 'Horizontal'}</span></button>
        <div class="rc-corps"><b class="rc-nom"></b><small>${jour(quand)} · ${heure(quand)} · ${taille(r.taille)}</small>${r.fiche && r.fiche.titre ? '<small class="rc-live"></small>' : ''}</div>
        <div class="rc-actions"><button type="button" class="petit primaire rc-dl">Télécharger</button><button type="button" class="petit rc-suppr" title="Supprimer de ce navigateur">Supprimer</button></div>`;
      c.querySelector('.rc-nom').textContent = (r.fiche && r.fiche.nomAffiche) || r.nom.replace(/\.\w+$/, '').replace(/ (horizontal|vertical)$/, '');
      if (r.fiche && r.fiche.titre) c.querySelector('.rc-live').textContent = 'Live : ' + r.fiche.titre;
      c.querySelector('.rc-vue').onclick = () => lire(r);
      c.querySelector('.rc-dl').onclick = () => telecharger(r);
      c.querySelector('.rc-suppr').onclick = () => supprimer(r);
      const dureeFiche = r.fiche && r.fiche.duree;
      if (dureeFiche) c.querySelector('.rc-duree').textContent = duree(dureeFiche);
      vignette(r).then(v => {
        if (v.src) c.querySelector('.rc-img').style.backgroundImage = `url("${v.src}")`;
        if (!dureeFiche && v.duree) c.querySelector('.rc-duree').textContent = duree(v.duree);
      });
      grille.appendChild(c);
    }
  }

  /* ----- Mes lives (dans la page de création) ----- */
  function dessinerLives(box) {
    const l = lireSessions();
    box.innerHTML = '';
    if (!l.length) { box.innerHTML = '<div class="biblio-vide"><b>Pas encore de live</b><p>Remplis le titre et choisis un thème à droite : ton premier live apparaîtra ici.</p></div>'; return; }
    const maintenant = Date.now();
    const prog = l.filter(x => x.session.debut && x.session.debut > maintenant - 6 * 3600e3).sort((a, b) => a.session.debut - b.session.debut);
    const finis = l.filter(x => !prog.includes(x) && x.live && x.live.date).sort((a, b) => b.live.date - a.live.date);
    const prets = l.filter(x => !prog.includes(x) && !finis.includes(x));
    const section = (titre, liste, statut) => {
      if (!liste.length) return;
      box.insertAdjacentHTML('beforeend', `<h3 class="biblio-groupe">${titre} <small>${liste.length}</small></h3>`);
      const g = document.createElement('div'); g.className = 'biblio-lignes'; box.appendChild(g);
      for (const { session, cle, live } of liste) {
        const preset = THEMES[session.theme && session.theme.preset] ? session.theme.preset : 'minimal';
        const t = themeComplet(session);
        const el = document.createElement('article'); el.className = 'live-ligne';
        el.innerHTML = `<img src="img/themes/${preset}-intro.webp" alt="" loading="lazy">
          <div class="ll-corps"><b></b><small>${statut(session, live)} · thème ${esc((t.nom || 'perso').replace(/\s*\(.*\)$/, ''))}</small></div>
          <div class="ll-actions"><button type="button" class="petit ll-theme" title="Ton nouveau live reprend le thème de celui-ci (couleurs, police, logo)">Reprendre son thème</button><a class="ll-regie" href="${esc(liens(session, cle).regie)}"><button type="button" class="petit">Ouvrir la régie</button></a></div>`;
        el.querySelector('b').textContent = session.titre;
        el.querySelector('.ll-theme').onclick = () => {
          brouillon.theme = JSON.parse(JSON.stringify(session.theme || { preset: 'minimal' }));
          if (session.hote) brouillon.hote = session.hote;
          if (session.handle) brouillon.handle = session.handle;
          remplirForm(); apercu();
          toast(`Thème de « ${session.titre} » repris`);
        };
        g.appendChild(el);
      }
    };
    section('Programmés', prog, s => 'le ' + jour(s.debut) + ' à ' + heure(s.debut));
    section('Prêts', prets, s => 'créé le ' + new Date(s.cree || Date.now()).toLocaleDateString('fr-FR'));
    section('Terminés', finis, (s, live) => 'diffusé le ' + jour(live.date));
  }
  function lireSessions() { try { return JSON.parse(localStorage.getItem('studioSeb:sessions') || '[]'); } catch (e) { return []; } }

  /* ----- Onglets et compteurs ----- */
  document.querySelectorAll('[data-biblio]').forEach(b => b.onclick = () => {
    const v = b.dataset.biblio;
    document.querySelectorAll('[data-biblio]').forEach(x => { x.classList.toggle('actif', x === b); x.setAttribute('aria-selected', x === b); });
    document.querySelectorAll('#biblio-creation .biblio-vue').forEach(x => { x.hidden = x.dataset.vue !== v; });
    try { localStorage.setItem('studioSeb:biblio', v); } catch (e) { /* rien */ }
  });
  try { const v = localStorage.getItem('studioSeb:biblio'); if (v === 'recs') document.querySelector('[data-biblio="recs"]').click(); } catch (e) { /* rien */ }
  const voir = document.getElementById('voir-recs');
  if (voir) voir.onclick = () => document.getElementById('bloc-recs').scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function majBiblio() {
    await charger();
    const nbL = lireSessions().length;
    document.querySelectorAll('[data-nb="lives"]').forEach(e => { e.textContent = nbL || ''; });
    document.querySelectorAll('[data-nb="recs"]').forEach(e => { e.textContent = recs.length ? (e.tagName === 'P' ? `${recs.length} vidéo${recs.length > 1 ? 's' : ''}` : recs.length) : ''; });
    const blocRecs = document.getElementById('bloc-recs');
    if (blocRecs) blocRecs.hidden = !recs.length;
    if (voir) voir.hidden = !recs.length;
    document.querySelectorAll('.biblio-vue[data-vue="recs"]').forEach(dessinerRecs);
    document.querySelectorAll('.biblio-vue[data-vue="lives"]').forEach(dessinerLives);
  }
  window.majBiblio = majBiblio;
  majBiblio();
  // une vidéo enregistrée dans une autre fenêtre (la régie) apparaît quand on revient sur cet onglet
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') majBiblio(); });
})();
