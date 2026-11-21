/* Accueil : « Après le live », dans l'atelier des sous-titres d'un live terminé.
   - Traduire les sous-titres (anglais, espagnol, allemand) : modèles Opus-MT calculés sur ton ordinateur ;
   - Chapitres YouTube : le live découpé en parties, chacune nommée par ses mots les plus marquants ;
   - Résumé : les phrases clés du live, dans l'ordre, et le temps de parole de chacun.
   Les chapitres et le résumé sont calculés ici, tout de suite, sans aucun téléchargement. */
'use strict';
(() => {
  const atelier = $('#atelier-st');
  if (!atelier) return;
  const pied = atelier.querySelector('.atelier-pied');
  const bloc = document.createElement('div');
  bloc.className = 'atelier-apres';
  bloc.innerHTML = `
    <b>Après le live</b>
    <span class="ap-groupe"><select id="ap-langue" aria-label="Langue de la traduction">
      <option value="en">en anglais</option><option value="es">en espagnol</option><option value="de">en allemand</option>
    </select><button type="button" id="ap-traduire" title="Calculé sur ton ordinateur. La première fois, le modèle de la langue (environ 75 Mo) se télécharge.">Traduire (.srt)</button></span>
    <button type="button" id="ap-chapitres" title="À coller dans la description YouTube">Chapitres YouTube</button>
    <button type="button" id="ap-resume">Résumé</button>
    <span class="aide" id="ap-etat"></span>
    <div class="ap-sortie" id="ap-sortie" hidden>
      <textarea id="ap-texte" rows="8" spellcheck="false"></textarea>
      <div class="ap-boutons"><button type="button" class="petit primaire" id="ap-copier">Copier</button><button type="button" class="petit" id="ap-telecharger">Télécharger (.txt)</button><button type="button" class="petit" id="ap-fermer">Fermer</button></div>
    </div>`;
  pied.before(bloc);

  const etat = $('#ap-etat');
  const segsTries = () => (atArchive && atArchive.segs || []).filter(s => String(s.t || '').trim()).slice().sort((a, b) => a.a - b.a);
  let nomSortie = '';
  function montrer(texte, nom) {
    nomSortie = nom;
    $('#ap-texte').value = texte;
    $('#ap-sortie').hidden = false;
    $('#ap-texte').focus(); $('#ap-texte').setSelectionRange(0, 0); $('#ap-texte').scrollTop = 0;
  }
  $('#ap-copier').onclick = async () => {
    try { await navigator.clipboard.writeText($('#ap-texte').value); toast('Copié'); }
    catch (e) { $('#ap-texte').select(); document.execCommand('copy'); toast('Copié'); }
  };
  $('#ap-telecharger').onclick = () => telechargerTexte($('#ap-texte').value, nomSortie);
  $('#ap-fermer').onclick = () => { $('#ap-sortie').hidden = true; };
  function telechargerTexte(texte, nom) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + texte], { type: 'text/plain;charset=utf-8' }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Fichier ${nom} téléchargé`);
  }
  const base = () => slug(atSession && atSession.titre || 'live', 40) || 'live';

  /* ----- Les mots : on garde ceux qui portent le sens ----- */
  const VIDES = new Set(('a à afin ah ai aie aient ais ait alors as au aucun aussi autre aux avais avait avant avec avez avoir avons bah ben bien bon ' +
    'ça car ce ceci cela celle celles celui ces cet cette ceux chaque chez ci comme comment d dans de des deux dire dis dit do doit donc dont du ' +
    'elle elles en encore enfin es est et étaient était été être eu eux euh fait faire fais faut fois font hein hum il ils j je juste l la là le les ' +
    'leur leurs lui m ma mais me même mes moi mon n ne ni non nos notre nous o oh ok okay on ont ou où oui par parce pas peu peut peux plus pour ' +
    'pourquoi puis qu quand que quel quelle quelque qui quoi s sa sans se ses si sien son sont sous suis sur t ta te tes toi ton tous tout toute ' +
    'toutes très tu un une va vais vas vers voilà vont vos votre vous vrai vraiment y c\'est j\'ai qu\'il qu\'on c ouais genre truc trucs chose choses ' +
    'beaucoup rien cette alors après avant déjà là-dessus voir vu veux veut voilà ici tellement assez peut-être quelqu\'un aujourd\'hui maintenant ' +
    'franchement justement effectivement carrément parle parler parlé monde gens chose dire faut quand même plutôt souvent toujours jamais').split(' '));
  const mots = t => String(t).toLowerCase().replace(/[’']/g, ' ').split(/[^a-zà-öø-ÿœæ0-9-]+/i).filter(m => m.length >= 4 && !VIDES.has(m) && !/^\d+$/.test(m));
  /* l'écriture la plus fréquente de chaque mot (« Dune », « Netflix » gardent leur majuscule) */
  function ecritures(segs) {
    const c = new Map();
    for (const s of segs) for (const brut of String(s.t).replace(/[’']/g, ' ').split(/[^a-zà-öø-ÿœæ0-9-]+/i)) {
      if (brut.length < 4) continue;
      const k = brut.toLowerCase(), m = c.get(k) || new Map();
      m.set(brut, (m.get(brut) || 0) + 1); c.set(k, m);
    }
    return k => { const m = c.get(k); return m ? [...m].sort((a, b) => b[1] - a[1])[0][0] : k; };
  }
  const tc = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${String(m).padStart(2, '0')}:${x}`; };
  const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);

  /* ----- Chapitres ----- */
  $('#ap-chapitres').onclick = () => {
    const segs = segsTries();
    if (!segs.length) return toast('Pas de sous-titres pour ce live');
    const duree = segs[segs.length - 1].b;
    if (duree < 3 * 60000) return montrer('Le live dure moins de 3 minutes : YouTube demande au moins 3 chapitres de 10 secondes, ce n\'est pas utile ici.', base() + '-chapitres.txt');
    const nb = Math.max(3, Math.min(12, Math.round(duree / (4 * 60000))));
    // les coupures : près de chaque repère régulier, on choisit le plus grand silence (ou un changement de personne)
    const debuts = [0];
    for (let k = 1; k < nb; k++) {
      const vise = duree * k / nb, fen = Math.min(90000, duree / nb / 3);
      let mieux = null, score = -1;
      for (let i = 1; i < segs.length; i++) {
        const s = segs[i];
        if (Math.abs(s.a - vise) > fen || s.a - debuts[debuts.length - 1] < 60000) continue;
        const pause = s.a - segs[i - 1].b, change = s.id !== segs[i - 1].id ? 1500 : 0;
        const sc = pause + change - Math.abs(s.a - vise) / 20;
        if (sc > score) { score = sc; mieux = s.a; }
      }
      if (mieux !== null) debuts.push(mieux);
    }
    // les mots de chaque partie, comparés au reste du live
    const parties = debuts.map((d, k) => segs.filter(s => s.a >= d && s.a < (debuts[k + 1] ?? Infinity)));
    const compte = parties.map(p => { const c = new Map(); for (const s of p) for (const m of mots(s.t)) c.set(m, (c.get(m) || 0) + 1); return c; });
    const partout = new Map(); for (const c of compte) for (const m of c.keys()) partout.set(m, (partout.get(m) || 0) + 1);
    const ecrit = ecritures(segs);
    const lignes = debuts.map((d, k) => {
      if (k === 0) return `00:00 Introduction`;
      const top = [...compte[k]].map(([m, n]) => [m, n * Math.log(1 + parties.length / partout.get(m))]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => ecrit(x[0]));
      const titre = top.length ? majuscule(top.length > 1 ? top.slice(0, -1).join(', ') + ' et ' + top[top.length - 1] : top[0]) : 'Suite';
      return `${tc(d)} ${titre}`;
    });
    montrer(lignes.join('\n') + '\n\n(Chapitres proposés à partir des mots du live : relis-les et renomme-les avant de les coller dans la description YouTube.)', base() + '-chapitres.txt');
  };

  /* ----- Résumé ----- */
  $('#ap-resume').onclick = () => {
    const segs = segsTries();
    if (!segs.length) return toast('Pas de sous-titres pour ce live');
    const phrases = [];
    for (const s of segs) {
      const bouts = String(s.t).match(/[^.!?…]+[.!?…]*/g) || [];
      for (const b of bouts) { const t = b.trim(); if (t.split(/\s+/).length >= 6) phrases.push({ t, nom: s.nom, a: s.a }); }
    }
    const freq = new Map(); for (const p of phrases) for (const m of mots(p.t)) freq.set(m, (freq.get(m) || 0) + 1);
    for (const p of phrases) { const ms = mots(p.t); p.score = ms.reduce((x, m) => x + (freq.get(m) || 0), 0) / Math.sqrt(Math.max(4, p.t.split(/\s+/).length)); }
    const k = Math.max(3, Math.min(8, Math.round(phrases.length / 12)));
    // une phrase par tranche du live (pour couvrir tout le live), en évitant deux phrases presque pareilles
    const fin = segs[segs.length - 1].b || 1, cles = [];
    const proches = (x, y) => { const a = new Set(mots(x.t)), b = new Set(mots(y.t)); let n = 0; for (const m of a) if (b.has(m)) n++; return n / Math.max(1, Math.min(a.size, b.size)) > 0.6; };
    for (let i = 0; i < k; i++) {
      const tranche = phrases.filter(p => p.a >= fin * i / k && p.a < fin * (i + 1) / k && !cles.some(c => proches(c, p)));
      const mieux = tranche.sort((a, b) => b.score - a.score)[0];
      if (mieux) cles.push(mieux);
    }
    // temps de parole d'après les sous-titres
    const temps = new Map(); for (const s of segs) temps.set(s.nom || 'Sans nom', (temps.get(s.nom || 'Sans nom') || 0) + Math.max(0, s.b - s.a));
    const total = [...temps.values()].reduce((a, b) => a + b, 0) || 1;
    const duree = segs[segs.length - 1].b;
    const ecrit = ecritures(segs);
    const sujets = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => ecrit(x[0]));
    const lignes = [
      `${atSession && atSession.titre || 'Live'} · ${Math.max(1, Math.round(duree / 60000))} min`,
      '',
      'Qui a parlé : ' + [...temps].sort((a, b) => b[1] - a[1]).map(([n, t]) => `${n} ${Math.round(t * 100 / total)} %`).join(', '),
      sujets.length ? 'Mots qui reviennent : ' + sujets.join(', ') : '',
      '',
      'Les phrases clés :',
      ...cles.map(p => `- [${tc(p.a)}] ${p.nom ? p.nom + ' : ' : ''}${p.t}`),
      '',
      '(Résumé fait avec les phrases du live elles-mêmes, sans rien inventer : relis-le avant de le publier.)',
    ].filter((l, i, t) => l || t[i - 1]);
    montrer(lignes.join('\n'), base() + '-resume.txt');
  };

  /* ----- Traduction ----- */
  let travail = null;
  $('#ap-traduire').onclick = () => {
    const segs = segsTries();
    if (!segs.length) return toast('Pas de sous-titres pour ce live');
    const langue = $('#ap-langue').value, nomLangue = $('#ap-langue').selectedOptions[0].textContent;
    const boutons = [$('#ap-traduire'), $('#ap-langue')];
    boutons.forEach(b => { b.disabled = true; });
    etat.textContent = 'Préparation de la traduction…';
    if (!travail) travail = new Worker('js/traduction-travail.js', { type: 'module' });
    const fichiers = new Map();
    const fin = () => { boutons.forEach(b => { b.disabled = false; }); };
    travail.onmessage = ({ data }) => {
      if (data.type === 'progres') {
        fichiers.set(data.fichier, [data.charge, data.total]);
        let c = 0, t = 0; for (const [a, b] of fichiers.values()) { c += a; t += b; }
        etat.textContent = `Téléchargement du modèle (une seule fois) : ${t ? Math.round(c * 100 / t) : 0} %`;
      } else if (data.type === 'avance') {
        etat.textContent = `Traduction ${nomLangue} : ${data.fait} sur ${data.total}`;
      } else if (data.type === 'fini') {
        fin();
        etat.textContent = `Traduit ${nomLangue}.`;
        const traduits = segs.map((s, i) => Object.assign({}, s, { t: data.textes[i] || s.t }));
        const contenu = versSrt(traduits, $('#at-noms').checked);
        telechargerTexte(contenu, `${base()}-sous-titres-${langue}.srt`);
      } else if (data.type === 'erreur') {
        fin();
        etat.textContent = /fetch|network|locate|load/i.test(data.message) ? 'Le modèle n\'a pas pu être téléchargé : vérifie la connexion, puis réessaie.' : 'La traduction a échoué : ' + data.message;
        travail.terminate(); travail = null;
      }
    };
    travail.onerror = () => { fin(); etat.textContent = 'La traduction ne marche pas dans ce navigateur.'; travail = null; };
    travail.postMessage({ langue, textes: segs.map(s => s.t) });
  };
})();
