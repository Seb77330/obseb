/* MESA : régie, « Qui parle ».
   À partir du niveau sonore de chaque personne (déjà mesuré pour les vu-mètres), on décide qui parle,
   avec un seuil propre à chacun (son bruit de fond est mesuré en continu) et une petite inertie pour ne pas clignoter.
   - la carte de la personne qui parle s'allume dans la régie ;
   - le temps de parole de chacun s'affiche (pour rythmer les débats) ;
   - « Le plan suit qui parle » : en Solo, Interview ou Médaillon, la personne qui parle passe en grand ;
   - pendant le direct, chaque prise de parole est notée : après le live, « Qui parle quand » se télécharge
     pour le montage (tableur CSV et marqueurs). Rien ne sort de l'ordinateur. */
'use strict';
(() => {
  if (typeof cartes === 'undefined') return;
  const CLE = 'studioSeb:parole:' + session.room;
  etat.planAuto = !!etat.planAuto;
  const suivi = new Map();        // id -> { fond, haut, bas, parle, depuis, total, debutPrise }
  let journal = [];               // { id, nom, d (ms depuis le début du direct), f }
  try { const j = JSON.parse(localStorage.getItem(CLE) || 'null'); if (j && Array.isArray(j.prises)) journal = j.prises; } catch (e) { /* rien */ }
  let debutJournal = (() => { try { return (JSON.parse(localStorage.getItem(CLE) || 'null') || {}).debut || 0; } catch (e) { return 0; } })();
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify({ debut: debutJournal, prises: journal.slice(-5000) })); } catch (e) { /* rien */ } };
  const aSon = id => !(typeof estCamLocale === 'function' && estCamLocale(id)) && !String(id).includes('_ecran');
  const nomDe = id => (etat.noms && etat.noms[id]) || (id === ID_HOTE ? (session.hote || 'Toi') : 'Invité');

  function etatDe(id) {
    let s = suivi.get(id);
    if (!s) { s = { fond: 4, haut: 0, bas: 0, parle: false, total: 0, debutPrise: 0 }; suivi.set(id, s); }
    return s;
  }
  const PAS = 150;
  function tour() {
    const maintenant = Date.now();
    if (etat.direct && etat.direct.debut !== debutJournal) { debutJournal = etat.direct.debut; journal = []; for (const s of suivi.values()) s.total = 0; sauver(); }
    for (const [id, c] of cartes) {
      if (!aSon(id)) continue;
      const s = etatDe(id);
      const muet = etat.muet && etat.muet[id];
      const n = muet ? 0 : (c.niveau || 0);
      // bruit de fond : suit vite vers le bas, très lentement vers le haut (une voix ne le fait pas monter)
      s.fond = n < s.fond ? s.fond * 0.8 + n * 0.2 : s.fond + Math.min(0.02, (n - s.fond) * 0.002);
      const seuilHaut = Math.max(7, s.fond * 2.2 + 3), seuilBas = Math.max(4, s.fond * 1.5 + 1.5);
      if (n > seuilHaut) { s.haut += PAS; s.bas = 0; } else if (n < seuilBas) { s.bas += PAS; s.haut = 0; }
      if (!s.parle && s.haut >= 300) { s.parle = true; s.debutPrise = maintenant; }
      else if (s.parle && s.bas >= 900) {
        s.parle = false;
        const duree = maintenant - s.debutPrise - 900;
        if (duree > 0) {
          s.total += duree;
          if (etat.direct && duree >= 700) { journal.push({ id, nom: nomDe(id), d: s.debutPrise - etat.direct.debut, f: maintenant - 900 - etat.direct.debut }); sauver(); }
        }
      }
      c.el.classList.toggle('parle', s.parle);
      let t = c.el.querySelector('.parole-temps');
      if (!t) { t = document.createElement('span'); t.className = 'parole-temps'; t.title = 'Temps de parole depuis le début du direct (ou de l\'ouverture de la régie)'; (c.el.querySelector('.vignette') || c.el).appendChild(t); }
      const total = s.total + (s.parle ? maintenant - s.debutPrise : 0);
      t.textContent = total >= 1000 ? dureeCourte(total) : '';
    }
    planAuto(maintenant);
    majRepartition();
  }
  const dureeCourte = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0'); };

  /* ----- Le plan suit qui parle ----- */
  let candidat = null, candidatDepuis = 0, dernierChangement = 0;
  function planAuto(maintenant) {
    if (!etat.planAuto || !['solo', 'interview', 'incrust'].includes(etat.layout)) return;
    // on ne compte que les voix en cours (pas celles qui viennent de se taire) ; plusieurs à la fois : on ne bouge pas
    const parlent = [...suivi.entries()].filter(([id, s]) => s.parle && s.bas === 0 && etat.onair.includes(id)).map(([id]) => id);
    if (parlent.length !== 1) { if (parlent.length > 1) candidat = null; return; }
    const id = parlent[0];
    if (id !== candidat) { candidat = id; candidatDepuis = maintenant; }
    if (id !== etat.focus && maintenant - candidatDepuis >= 1500 && maintenant - dernierChangement >= 4000) {
      etat.focus = id; dernierChangement = maintenant; envoyer();
    }
  }

  /* ----- Le bloc « Qui parle » (onglet Titres, en bas) ----- */
  const bloc = document.createElement('details');
  bloc.className = 'pli'; bloc.id = 'pli-parole';
  bloc.innerHTML = `<summary>Qui parle</summary>
    <label class="ligne-case" title="En Solo, Interview ou Médaillon : la personne qui parle passe en grand (au moins 4 s entre deux changements)."><input type="checkbox" id="parole-auto"> <span><b>Le plan suit qui parle</b></span></label>
    <div class="parole-repartition" id="parole-repartition"></div>
    <div class="ligne-boutons"><button class="petit" id="parole-csv" title="Chaque prise de parole avec son heure, pour le montage">Télécharger « qui parle quand »</button>
    <button class="petit" id="parole-marqueurs" title="Un fichier de marqueurs à importer dans ton logiciel de montage (DaVinci Resolve, Premiere)">Marqueurs pour le montage</button></div>
    <p class="aide" id="parole-info"></p>`;
  const place = $('[data-onglet="habillage"]');
  if (place) place.appendChild(bloc);
  $('#parole-auto').checked = etat.planAuto;
  $('#parole-auto').onchange = e => { etat.planAuto = e.target.checked; envoyer(); toast(etat.planAuto ? 'Le plan suit la personne qui parle' : 'Le plan ne bouge plus tout seul'); };

  function majRepartition() {
    if (!bloc.open) return;
    const lignes = [...suivi.entries()].filter(([id]) => cartes.has(id)).map(([id, s]) => [nomDe(id), s.total + (s.parle ? Date.now() - s.debutPrise : 0), s.parle]);
    const tout = lignes.reduce((a, l) => a + l[1], 0);
    $('#parole-repartition').innerHTML = !tout ? '<p class="aide">Le temps de parole de chacun s\'affichera ici.</p>' : lignes.sort((a, b) => b[1] - a[1]).map(([nom, ms, parle]) =>
      `<div class="pr-ligne${parle ? ' parle' : ''}"><span class="pr-nom">${esc(nom)}</span><span class="pr-barre"><i style="width:${Math.round(ms * 100 / tout)}%"></i></span><span class="pr-pct">${Math.round(ms * 100 / tout)} %</span></div>`).join('');
    $('#parole-info').textContent = journal.length ? `${journal.length} prise${journal.length > 1 ? 's' : ''} de parole notée${journal.length > 1 ? 's' : ''} pendant le direct.` : 'Les prises de parole sont notées pendant le direct, pour le montage.';
    $('#parole-csv').disabled = $('#parole-marqueurs').disabled = !journal.length;
  }
  bloc.addEventListener('toggle', majRepartition);

  const hms = ms => { const s = Math.max(0, ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`; };
  const telecharger = (nom, texte, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], { type }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const nomFichier = ext => `${String(session.titre || 'live').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}-qui-parle.${ext}`;
  $('#parole-csv').onclick = () => {
    const l = ['Début;Fin;Durée (s);Qui'].concat(journal.map(p => `${hms(p.d)};${hms(p.f)};${Math.round((p.f - p.d) / 1000)};${String(p.nom).replace(/;/g, ',')}`));
    telecharger(nomFichier('csv'), '﻿' + l.join('\r\n'), 'text/csv;charset=utf-8');
  };
  /* Marqueurs : format EDL simple (CMX 3600), lu par DaVinci Resolve (Marqueurs > Importer) et d'autres logiciels */
  $('#parole-marqueurs').onclick = () => {
    const tc = ms => { const f = Math.floor(ms / 1000 * 25); return `${String(Math.floor(f / 90000)).padStart(2, '0')}:${String(Math.floor(f / 1500) % 60).padStart(2, '0')}:${String(Math.floor(f / 25) % 60).padStart(2, '0')}:${String(f % 25).padStart(2, '0')}`; };
    const l = [`TITLE: ${session.titre || 'Live MESA'} - qui parle`, 'FCM: NON-DROP FRAME', ''];
    journal.forEach((p, i) => {
      l.push(`${String(i + 1).padStart(3, '0')}  001      V     C        ${tc(p.d)} ${tc(p.d + 40)} ${tc(p.d)} ${tc(p.d + 40)}`);
      l.push(` |C:ResolveColorBlue |M:${p.nom} |D:${Math.max(1, Math.round((p.f - p.d) / 40))}`, '');
    });
    telecharger(nomFichier('edl'), l.join('\r\n'), 'text/plain;charset=utf-8');
  };

  setInterval(tour, PAS);
})();
