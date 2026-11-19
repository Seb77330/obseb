/* MESA : régie, bouton « Enregistrer ».
   Tourner une vidéo sans être en direct (ou pendant un direct) et récupérer le fichier.
   L'image enregistrée est exactement celle du live : c'est la fenêtre de diffusion (sortie.html?diffuser=1)
   qui l'enregistre, en horizontal, en vertical, ou les deux à la fois (deux fichiers, une fenêtre par format).
   Les fichiers sont écrits au fur et à mesure sur le disque (espace de stockage du site), puis téléchargés tout seuls
   à l'arrêt ; ils restent dans « Mes enregistrements » pour les retélécharger. */
'use strict';
(() => {
  const btn = $('#btn-rec'), pop = $('#rec-pop');
  if (!btn || !pop) return;
  const CLE = 'studioSeb:recFormat';
  let formatRec = 'horizontal';
  try { formatRec = localStorage.getItem(CLE) || formatRec; } catch (e) { /* rien */ }
  const formatsVoulus = () => formatRec === 'deux' ? ['horizontal', 'vertical'] : [formatRec];
  const etatRec = f => { const x = fenetres[f]; return x && x.etat && x.vu && Date.now() - x.vu < 7000 ? x.etat : null; };
  const enCours = () => ['horizontal', 'vertical'].filter(f => { const e = etatRec(f); return e && e.rec && e.rec.actif; });
  const taille = o => o > 1e9 ? (o / 1e9).toFixed(2).replace('.', ',') + ' Go' : Math.max(0, Math.round(o / 1e6)) + ' Mo';
  const duree = ms => { const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const nomParDefaut = () => {
    const d = new Date(), z = n => String(n).padStart(2, '0');
    return `${(session.titre || 'MESA').slice(0, 40)} ${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}h${z(d.getMinutes())}`;
  };
  let nomChoisi = '';
  const derniers = {};   // format -> dernier enregistrement terminé (déjà signalé)

  /* ----- Mes enregistrements : les fichiers gardés par ce navigateur ----- */
  async function dossier() { const r = await navigator.storage.getDirectory(); return r.getDirectoryHandle('enregistrements', { create: true }); }
  const lireNom = n => { try { return decodeURIComponent(n); } catch (e) { return n; } };
  async function listeFichiers() {
    const l = [];
    try { for await (const [nom, h] of (await dossier()).entries()) if (h.kind === 'file' && !nom.endsWith('.json')) { const f = await h.getFile(); l.push({ nom: lireNom(nom), interne: nom, taille: f.size, date: f.lastModified, h }); } } catch (e) { /* pas de stockage */ }
    return l.sort((a, b) => b.date - a.date);
  }
  async function telecharger(h, nom) {
    const f = await h.getFile();
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  }

  /* ----- La petite fenêtre ----- */
  let cleVue = '';
  async function dessiner() {
    const a0 = enCours();
    cleVue = a0.length ? 'rec' + Math.floor(Date.now() / 1000) : JSON.stringify([formatRec, formatsVoulus().map(fenetrePrete)]);
    const actifs = enCours();
    if (actifs.length) {
      pop.innerHTML = `<h4>Enregistrement en cours</h4>
        ${actifs.map(f => { const e = etatRec(f); return `<div class="rec-ligne"><i class="rec-pt"></i><b>${f === 'vertical' ? 'Vertical' : 'Horizontal'}</b><small>${duree(Date.now() - e.rec.debut)} · ${taille(e.rec.octets)}</small></div>${e.rec.erreur ? `<p class="rec-err">${esc(e.rec.erreur)}</p>` : ''}`; }).join('')}
        <p class="aide">Change de scène, de mode, de caméra comme tu veux : tout ce qui passe à l'écran est enregistré.</p>
        <div class="menu-bas"><button class="primaire rec-stop" id="rec-stop">■ Arrêter et récupérer le fichier</button></div>`;
      pop.querySelector('#rec-stop').onclick = arreter;
      return;
    }
    const voulus = formatsVoulus();
    const prets = voulus.filter(f => fenetrePrete(f));
    pop.innerHTML = `<h4>Enregistrer une vidéo</h4>
      <p class="aide" style="margin:0 0 8px">Sans être en direct (ou pendant le direct). L'image est celle du live : modes, scènes, titres compris.</p>
      <div class="rec-formats" role="group" aria-label="Format">${[['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['deux', 'Les deux']].map(([f, n]) => `<button type="button" data-f="${f}" class="${formatRec === f ? 'actif' : ''}">${n}</button>`).join('')}</div>
      <label class="rec-nom"><span class="aide">Nom du fichier</span><input type="text" id="rec-nom" maxlength="60" value="${esc(nomChoisi || nomParDefaut())}"></label>
      ${voulus.map(f => `<div class="rec-ligne">${fenetrePrete(f) ? '<i class="rec-ok"></i>' : '<i class="rec-att"></i>'}<b>Fenêtre ${f === 'vertical' ? 'verticale' : 'horizontale'}</b><small>${fenetrePrete(f) ? 'prête' : 'pas encore ouverte'}</small></div>`).join('')}
      ${prets.length < voulus.length ? '<p class="aide">La fenêtre s\'ouvre à côté : clique sur « Autoriser cette fenêtre », choisis <b>cet onglet</b> et laisse le son coché. Garde-la ouverte pendant l\'enregistrement.</p>' : ''}
      <div class="menu-bas">${prets.length < voulus.length ? `<button class="primaire" id="rec-ouvrir">Ouvrir ${voulus.length - prets.length > 1 ? 'les fenêtres' : 'la fenêtre'} d'enregistrement</button>` : '<button class="primaire" id="rec-go">⏺ Démarrer l\'enregistrement</button>'}</div>
      <details class="rec-liste" id="rec-liste"><summary>Mes enregistrements</summary><div class="rec-fichiers"><p class="aide">Chargement…</p></div></details>`;
    pop.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { formatRec = b.dataset.f; try { localStorage.setItem(CLE, formatRec); } catch (e) { /* rien */ } dessiner(); });
    if (pop.querySelector('#rec-ouvrir')) pop.querySelector('#rec-ouvrir').onclick = () => voulus.filter(f => !fenetrePrete(f)).forEach(ouvrirFenetreDiffusion);
    pop.querySelector('#rec-nom').oninput = e => { nomChoisi = e.target.value; };
    if (pop.querySelector('#rec-go')) pop.querySelector('#rec-go').onclick = demarrer;
    remplirListe();
  }
  async function remplirListe() {
    const box = pop.querySelector('.rec-fichiers'); if (!box) return;
    const l = await listeFichiers();
    if (!pop.contains(box)) return;
    box.innerHTML = l.length ? '' : '<p class="aide">Aucun pour l\'instant. Les vidéos que tu enregistres arrivent aussi dans ton dossier Téléchargements.</p>';
    for (const f of l) {
      const d = document.createElement('div'); d.className = 'rec-fichier';
      d.innerHTML = `<span><b></b><small>${taille(f.taille)} · ${new Date(f.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><button class="petit">Télécharger</button><button class="petit rec-suppr" title="Supprimer ce fichier de ce navigateur (celui de ton dossier Téléchargements reste)">✕</button>`;
      d.querySelector('b').textContent = f.nom;
      const [bT, bS] = d.querySelectorAll('button');
      bT.onclick = () => telecharger(f.h, f.nom);
      bS.onclick = async () => {
        if (!confirm(`Supprimer « ${f.nom} » de ce navigateur ?\nLe fichier déjà téléchargé sur ton PC n'est pas touché.`)) return;
        try { const d = await dossier(); await d.removeEntry(f.interne); d.removeEntry(f.interne + '.json').catch(() => {}); } catch (e) { toast('Impossible de supprimer ce fichier'); }
        remplirListe();
      };
      box.appendChild(d);
    }
    const st = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
    if (st && st.quota) box.insertAdjacentHTML('beforeend', `<p class="aide">Place disponible pour enregistrer : ${taille(st.quota - st.usage)}</p>`);
  }
  function demarrer() {
    const voulus = formatsVoulus();
    if (!voulus.every(f => fenetrePrete(f))) return toast('Ouvre d\'abord la fenêtre d\'enregistrement');
    const nom = (nomChoisi || nomParDefaut()).trim();
    for (const f of voulus) canalDiff(f).postMessage({ type: 'rec', action: 'start', nom });
    nomChoisi = '';
    toast('Enregistrement lancé');
    setTimeout(majBouton, 400);
  }
  function arreter() {
    for (const f of enCours()) canalDiff(f).postMessage({ type: 'rec', action: 'stop' });
    toast('Enregistrement arrêté : le fichier arrive dans tes Téléchargements');
  }

  btn.onclick = e => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    if (!pop.hidden) dessiner();
  };
  addEventListener('click', e => { if (!pop.hidden && !e.target.closest('#rec-pop') && !e.target.closest('#btn-rec')) pop.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });

  function majBouton() {
    const actifs = enCours();
    btn.classList.toggle('on', actifs.length > 0);
    const e = actifs.length ? etatRec(actifs[0]) : null;
    btn.querySelector('span').textContent = e ? duree(Date.now() - e.rec.debut) : 'Enregistrer';
    // un enregistrement vient de se terminer : on le dit (une seule fois)
    for (const f of ['horizontal', 'vertical']) {
      const d = (etatRec(f) || {}).dernierRec;
      if (!d || !d.fin || derniers[f] === d.fin) continue;
      const premier = derniers[f] === undefined; derniers[f] = d.fin;
      if (premier && Date.now() - d.fin > 10000) continue;   // ancien : déjà signalé avant le rechargement de la régie
      toast(d.erreur ? `Enregistrement ${f} : ${d.erreur}` : `Vidéo ${f} enregistrée (${duree(d.duree)}, ${taille(d.octets)}) : elle est dans tes Téléchargements`);
    }
    const cle = actifs.length ? 'rec' + Math.floor(Date.now() / 1000) : JSON.stringify([formatRec, formatsVoulus().map(fenetrePrete)]);
    if (!pop.hidden && cle !== cleVue && !pop.contains(document.activeElement)) dessiner();
  }
  setInterval(majBouton, 1000);
})();
