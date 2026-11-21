/* Sous-titres : chacun est transcrit sur son propre ordinateur, au choix de l'animateur :
   - « navigateur » : la reconnaissance vocale de Chrome et d'Edge (gratuite) ;
   - « whisper » : le modèle Whisper, calculé sur l'ordinateur (js/whisper-travail.js) : la voix ne part nulle part,
     et ça marche aussi dans Firefox et Safari. Le modèle se télécharge une fois (≈ 80 Mo).
   Comme chaque personne est écoutée sur son ordinateur, on sait toujours qui parle, même quand plusieurs parlent à la fois.
   Ce fichier sert à la régie (ta voix) et à la page invité (la voix de chaque invité). */
'use strict';

/* surTexte({ t: texte, f: 1 si la phrase est terminée, n: numéro de la phrase })
   surEtat('ecoute' | 'arret' | 'refuse' | 'chargement' (avec le pourcentage) | 'erreur' (avec le message))
   piste() : (facultatif) la piste audio du micro choisi ; sans elle, le navigateur écoute le micro par défaut de l'ordinateur
   moteur() : (facultatif) 'navigateur' (par défaut) ou 'whisper' */
function creerEcoute(surTexte, surEtat, piste, moteur) {
  const nav = creerEcouteNavigateur(surTexte, surEtat, piste);
  let wh = null, enCours = null;
  const choisi = () => (moteur && moteur() === 'whisper' && whisperPossible() ? 'whisper' : 'navigateur');
  const ecoute = m => m === 'whisper' ? (wh || (wh = creerEcouteWhisper(surTexte, surEtat, piste))) : nav;
  return {
    get dispo() { return choisi() === 'whisper' ? true : nav.dispo; },
    get moteur() { return choisi(); },
    actif: () => !!enCours,
    demarrer() { if (enCours) return; enCours = choisi(); ecoute(enCours).demarrer(); },
    arreter() { if (!enCours) return; ecoute(enCours).arreter(); enCours = null; },
    /* l'animateur a changé de moteur pendant l'écoute : on bascule */
    suivreMoteur() { if (enCours && enCours !== choisi()) { ecoute(enCours).arreter(); enCours = choisi(); ecoute(enCours).demarrer(); } },
  };
}
const whisperPossible = () => typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);

function creerEcouteNavigateur(surTexte, surEtat, piste) {
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

/* ----- Whisper : on découpe la voix en phrases (pause de 0,7 s, ou 12 s au plus) et on les transcrit une par une ----- */
const HALLUCINATIONS_WHISPER = /amara\.org|sous-titr(es|age)s? (réalisés?|faits?|par)|merci d'avoir regardé|abonnez-vous|n'oubliez pas de (vous|t')abonner|^[\s.…!?,-]*$|^[[(].*[\])]$/i;
function creerEcouteWhisper(surTexte, surEtat, piste) {
  const SR = 16000;
  let voulu = false, travail = null, pret = false, ctx = null, src = null, proc = null, flux = null, fluxAMoi = false;
  let n = 0, idMorceau = 0, occupe = false;
  const file = [], fichiers = new Map();
  // détection de la voix : un seuil qui suit le bruit de fond de la pièce
  let fond = 0.004, parle = false, silence = 0, total = 0, morceaux = [], avant = [];

  function travailleur() {
    if (travail) return travail;
    travail = new Worker('js/whisper-travail.js', { type: 'module' });
    travail.onmessage = ({ data }) => {
      if (data.type === 'progres') {
        fichiers.set(data.fichier, [data.charge, data.total]);
        let c = 0, t = 0; for (const [a, b] of fichiers.values()) { c += a; t += b; }
        if (surEtat && voulu) surEtat('chargement', t ? Math.round(c * 100 / t) : 0);
      } else if (data.type === 'pret') {
        pret = true; if (surEtat && voulu) surEtat('ecoute');
      } else if (data.type === 'texte') {
        occupe = false;
        const t = String(data.texte || '').replace(/\s+/g, ' ').trim();
        if (voulu && t && !HALLUCINATIONS_WHISPER.test(t)) surTexte({ t, f: 1, n: n++ });
        suivant();
      } else if (data.type === 'erreur') {
        occupe = false;
        if (!pret) { voulu = false; couperMicro(); if (surEtat) surEtat('erreur', /fetch|network|locate|load/i.test(data.message) ? 'le modèle n\'a pas pu être téléchargé (vérifie la connexion, puis réessaie)' : data.message); travail.terminate(); travail = null; }
        else suivant();
      }
    };
    travail.onerror = () => { if (!pret && surEtat) surEtat('erreur', 'Whisper n\'a pas pu démarrer dans ce navigateur'); voulu = false; couperMicro(); travail = null; };
    return travail;
  }
  function suivant() {
    if (occupe || !file.length || !travail) return;
    occupe = true;
    const audio = file.shift();
    travail.postMessage({ type: 'audio', id: ++idMorceau, audio }, [audio.buffer]);
  }
  function finirPhrase() {
    const long = morceaux.reduce((a, m) => a + m.length, 0);
    if (long >= SR * 0.5) {
      const audio = new Float32Array(long);
      let i = 0; for (const m of morceaux) { audio.set(m, i); i += m.length; }
      file.push(audio);
      while (file.length > 3) file.shift();   // ordinateur trop lent : on saute plutôt que d'avoir un retard qui grandit
      suivant();
    }
    parle = false; morceaux = []; silence = 0; total = 0;
  }
  function traiter(b) {
    let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    const rms = Math.sqrt(s / b.length);
    if (!parle) {
      if (rms < fond * 3) fond = fond * 0.95 + rms * 0.05;
      avant.push(b);
      while (avant.reduce((a, m) => a + m.length, 0) > SR * 0.4) avant.shift();   // on garde 0,4 s avant le premier mot
      if (rms > Math.max(0.012, fond * 3)) { parle = true; morceaux = avant; avant = []; total = morceaux.reduce((a, m) => a + m.length, 0); silence = 0; }
    } else {
      morceaux.push(b); total += b.length;
      if (rms < Math.max(0.008, fond * 2)) silence += b.length; else silence = 0;
      if (silence > SR * 0.7 || total > SR * 12) finirPhrase();
    }
  }
  /* le micro arrive à 44,1 ou 48 kHz : on le ramène à 16 kHz (moyenne des échantillons) */
  function vers16k(entree, taux) {
    const r = taux / SR, nb = Math.floor(entree.length / r), sortie = new Float32Array(nb);
    for (let i = 0; i < nb; i++) {
      const a = Math.floor(i * r), z = Math.min(entree.length, Math.floor((i + 1) * r));
      let s = 0; for (let k = a; k < z; k++) s += entree[k];
      sortie[i] = s / Math.max(1, z - a);
    }
    return sortie;
  }
  async function ouvrirMicro() {
    const p = piste && piste();
    if (p) { flux = new MediaStream([p]); fluxAMoi = false; }
    else { flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); fluxAMoi = true; }
    if (!voulu) { couperMicro(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    src = ctx.createMediaStreamSource(flux);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = e => { if (voulu) traiter(vers16k(e.inputBuffer.getChannelData(0), ctx.sampleRate)); };
    src.connect(proc); proc.connect(ctx.destination);   // la sortie reste muette : c'est seulement pour que le navigateur fasse tourner l'analyse
  }
  function couperMicro() {
    try { if (src) src.disconnect(); if (proc) proc.disconnect(); } catch (e) { /* rien */ }
    if (ctx) ctx.close().catch(() => {});
    if (flux && fluxAMoi) flux.getTracks().forEach(t => t.stop());
    ctx = src = proc = flux = null;
    parle = false; morceaux = []; avant = []; file.length = 0;
  }
  return {
    dispo: whisperPossible(),
    actif: () => voulu,
    async demarrer() {
      if (voulu) return;
      voulu = true;
      travailleur().postMessage({ type: 'charger' });
      if (surEtat) surEtat(pret ? 'ecoute' : 'chargement', 0);
      try { await ouvrirMicro(); }
      catch (e) { voulu = false; couperMicro(); if (surEtat) surEtat('refuse'); }
    },
    arreter() {
      if (!voulu) return;
      voulu = false;
      if (parle) finirPhrase();
      couperMicro();
      if (surEtat) surEtat('arret');
    },
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
