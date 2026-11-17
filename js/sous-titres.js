/* Sous-titres : chacun est transcrit par son propre navigateur (reconnaissance vocale de Chrome et d'Edge, gratuite).
   Comme chaque personne est écoutée sur son ordinateur, on sait toujours qui parle, même quand plusieurs parlent à la fois.
   Ce fichier sert à la régie (ta voix) et à la page invité (la voix de chaque invité). */
'use strict';

/* surTexte({ t: texte, f: 1 si la phrase est terminée, n: numéro de la phrase })
   surEtat('ecoute' | 'arret' | 'refuse')
   piste() : (facultatif) la piste audio du micro choisi ; sans elle, le navigateur écoute le micro par défaut de l'ordinateur */
function creerEcoute(surTexte, surEtat, piste) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  let r = null, voulu = false, n = 0, dernierProvisoire = 0;
  function lancer() {
    if (!R || r || !voulu) return;
    r = new R();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], t = String(res[0] && res[0].transcript || '').trim();
        if (!t) continue;
        if (res.isFinal) surTexte({ t, f: 1, n: n++ });
        else if (Date.now() - dernierProvisoire > 280) { dernierProvisoire = Date.now(); surTexte({ t, f: 0, n }); }
      }
    };
    r.onstart = () => surEtat && surEtat('ecoute');
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { voulu = false; if (surEtat) surEtat('refuse'); }
    };
    // le navigateur coupe l'écoute après un silence : on la relance tant qu'elle est voulue
    r.onend = () => { r = null; if (voulu) setTimeout(lancer, 250); else if (surEtat) surEtat('arret'); };
    try {
      const p = piste && piste();
      if (p) r.start(p); else r.start();
    } catch (err) {
      try { r.start(); } catch (e2) { r = null; setTimeout(lancer, 1500); }
    }
  }
  return {
    dispo: !!R,
    actif: () => voulu,
    demarrer() { if (voulu) return; voulu = true; lancer(); },
    arreter() { if (!voulu) return; voulu = false; if (r) { try { r.stop(); } catch (e) { /* rien */ } } },
  };
}

/* ----- Fichiers de sous-titres (.srt, .vtt, .txt) à partir des répliques enregistrées -----
   Une réplique : { a: début en ms depuis le début du direct, b: fin, nom, t: texte } */
function decouperRepliques(segs, avecNoms, max = 84) {
  const sortie = [];
  for (const s of segs) {
    const texte = String(s.t || '').replace(/\s+/g, ' ').trim();
    if (!texte) continue;
    const a = Math.max(0, s.a), b = Math.max(a + 1000, s.b);
    const mots = texte.split(' '), bouts = [];
    let ligne = '';
    for (const m of mots) {
      if (ligne && (ligne + ' ' + m).length > max) { bouts.push(ligne); ligne = m; } else ligne = ligne ? ligne + ' ' + m : m;
    }
    if (ligne) bouts.push(ligne);
    const total = bouts.reduce((x, y) => x + y.length, 0) || 1;
    let t = a;
    bouts.forEach((bout, i) => {
      const fin = i === bouts.length - 1 ? b : Math.round(t + (b - a) * bout.length / total);
      sortie.push({ a: Math.round(t), b: fin, t: (avecNoms && s.nom && i === 0 ? s.nom + ' : ' : '') + bout });
      t = fin;
    });
  }
  sortie.sort((x, y) => x.a - y.a);
  return sortie;
}
function codeTemps(ms, sep) {
  ms = Math.max(0, Math.round(ms));
  const p = (v, n = 2) => String(v).padStart(n, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
}
/* Coupe une ligne trop longue en deux, au milieu */
function deuxLignes(t) {
  if (t.length <= 42) return t;
  const milieu = Math.floor(t.length / 2);
  let i = t.indexOf(' ', milieu), j = t.lastIndexOf(' ', milieu);
  if (i < 0 || (j >= 0 && milieu - j < i - milieu)) i = j;
  return i > 0 ? t.slice(0, i) + '\n' + t.slice(i + 1) : t;
}
function versSrt(segs, avecNoms) {
  return decouperRepliques(segs, avecNoms).map((s, i) => `${i + 1}\n${codeTemps(s.a, ',')} --> ${codeTemps(s.b, ',')}\n${deuxLignes(s.t)}\n`).join('\n');
}
function versVtt(segs, avecNoms) {
  return 'WEBVTT\n\n' + decouperRepliques(segs, avecNoms).map(s => `${codeTemps(s.a, '.')} --> ${codeTemps(s.b, '.')}\n${deuxLignes(s.t)}\n`).join('\n');
}
function versTexte(segs) {
  return segs.filter(s => String(s.t || '').trim()).map(s => `[${codeTemps(s.a, '.').slice(0, 8)}] ${s.nom ? s.nom + ' : ' : ''}${String(s.t).trim()}`).join('\n') + '\n';
}
