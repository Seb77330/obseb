/* MESA : effets sonores.
   Ils sont fabriqués par le navigateur au moment du clic : aucun fichier à charger, aucun droit d'auteur.
   Chaque recette reçoit (ctx, sortie, t) : elle branche ses sons sur « sortie » à partir de l'instant t. */
'use strict';

const EFFETS = [
  ['applaudissements', 'Applaudissements'],
  ['tambour', 'Roulement'],
  ['tada', 'Ta-da'],
  ['ding', 'Bonne réponse'],
  ['buzzer', 'Mauvaise réponse'],
  ['whoosh', 'Whoosh'],
];

const bruits = new WeakMap();
function bruitBlanc(ctx) {
  if (bruits.has(ctx)) return bruits.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bruits.set(ctx, b);
  return b;
}
/* Un souffle de bruit filtré : type et fréquence du filtre, volume, durée, chute */
function souffle(ctx, sortie, t, { type = 'bandpass', f = 1500, q = 1, gain = 0.3, duree = 0.03, attaque = 0.002 }) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruitBlanc(ctx);
  fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(fl).connect(g).connect(sortie);
  s.start(t, Math.random() * 1.5); s.stop(t + duree + 0.02);
  return fl;
}
/* Une note : forme d'onde, fréquence, volume, durée ; elle s'éteint doucement */
function note(ctx, sortie, t, { forme = 'sine', f = 440, gain = 0.2, duree = 0.5, attaque = 0.008, tenue = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = forme; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attaque);
  if (tenue) g.gain.setValueAtTime(gain, t + attaque + tenue);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + tenue + duree);
  o.connect(g).connect(sortie);
  o.start(t); o.stop(t + attaque + tenue + duree + 0.02);
  return o;
}

const RECETTES = {
  /* Trois notes de cloche qui montent */
  ding(ctx, sortie, t) {
    [[1046.5, 0], [1318.5, 0.13], [1568, 0.26]].forEach(([f, d]) => {
      note(ctx, sortie, t + d, { f, gain: 0.3, duree: 1.1 });
      note(ctx, sortie, t + d, { f: f * 2.76, gain: 0.07, duree: 0.5 });
      note(ctx, sortie, t + d, { f: f * 5.4, gain: 0.03, duree: 0.25 });
    });
  },
  /* Le « bzzz » du jeu télé : deux notes graves un peu fausses, coupées net */
  buzzer(ctx, sortie, t) {
    const fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = 1300;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
    g.gain.setValueAtTime(0.2, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);
    fl.connect(g).connect(sortie);
    for (const f of [110, 116.5, 220.7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(fl); o.start(t); o.stop(t + 0.7);
    }
  },
  /* Fanfare : une note d'appel, puis l'accord qui éclate */
  tada(ctx, sortie, t) {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass'; fl.Q.value = 0.8;
    fl.frequency.setValueAtTime(900, t);
    fl.frequency.setValueAtTime(900, t + 0.16);
    fl.frequency.exponentialRampToValueAtTime(3800, t + 0.24);
    fl.frequency.exponentialRampToValueAtTime(1400, t + 1.3);
    fl.connect(sortie);
    note(ctx, fl, t, { forme: 'sawtooth', f: 392, gain: 0.2, duree: 0.1, tenue: 0.05 });
    for (const f of [523.25, 659.25, 783.99, 1046.5]) {
      note(ctx, fl, t + 0.16, { forme: 'sawtooth', f, gain: 0.13, duree: 0.75, tenue: 0.45 });
      note(ctx, fl, t + 0.16, { forme: 'sawtooth', f: f * 1.004, gain: 0.07, duree: 0.75, tenue: 0.45 });
    }
  },
  /* Roulement de caisse claire qui s'accélère, puis le coup de cymbale */
  tambour(ctx, sortie, t) {
    const fin = 1.5;
    for (let x = 0; x < fin;) {
      const a = x / fin;
      souffle(ctx, sortie, t + x, { f: 2100, q: 0.7, gain: 0.1 + 0.3 * a, duree: 0.05 });
      note(ctx, sortie, t + x, { forme: 'triangle', f: 190, gain: 0.04 + 0.1 * a, duree: 0.04, attaque: 0.002 });
      x += 0.07 - 0.042 * a;
    }
    const c = t + fin + 0.05;
    souffle(ctx, sortie, c, { type: 'highpass', f: 5200, q: 0.5, gain: 0.38, duree: 1.5 });
    souffle(ctx, sortie, c, { f: 1800, q: 0.8, gain: 0.5, duree: 0.2 });
    const o = note(ctx, sortie, c, { f: 150, gain: 0.7, duree: 0.3, attaque: 0.003 });
    o.frequency.setValueAtTime(150, c); o.frequency.exponentialRampToValueAtTime(45, c + 0.16);
  },
  /* Une salle qui applaudit : quelques centaines de claquements, plus nombreux au milieu */
  applaudissements(ctx, sortie, t) {
    const duree = 3.6;
    const force = u => Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.4);
    for (let i = 0; i < 380; i++) {
      const u = Math.random();
      souffle(ctx, sortie, t + u * duree, { f: 900 + Math.random() * 1900, q: 0.8 + Math.random(), gain: Math.max(0.002, (0.45 + Math.random() * 0.7) * force(u)), duree: 0.02 + Math.random() * 0.02, attaque: 0.001 });
    }
    // le fond de salle, qui lie les claquements
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = bruitBlanc(ctx); s.loop = true;
    fl.type = 'bandpass'; fl.frequency.value = 1500; fl.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.4);
    g.gain.setValueAtTime(0.28, t + duree * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    s.connect(fl).connect(g).connect(sortie);
    s.start(t); s.stop(t + duree + 0.05);
  },
  /* Un passage d'air, pour une transition */
  whoosh(ctx, sortie, t) {
    // le filtre balaie du grave à l'aigu puis redescend ; le volume fait une cloche
    const s = ctx.createBufferSource(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = bruitBlanc(ctx);
    f2.type = 'bandpass'; f2.Q.value = 1.1;
    f2.frequency.setValueAtTime(250, t);
    f2.frequency.exponentialRampToValueAtTime(3800, t + 0.42);
    f2.frequency.exponentialRampToValueAtTime(500, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    s.connect(f2).connect(g).connect(sortie);
    s.start(t); s.stop(t + 0.95);
  },
};

let ctxEffets = null;
/* Joue un effet tout de suite. volume : de 0 à 1. Rend false si le navigateur n'a pas pu. */
function jouerEffet(nom, volume = 0.7) {
  const recette = RECETTES[nom];
  if (!recette) return false;
  try {
    ctxEffets = ctxEffets || new (window.AudioContext || window.webkitAudioContext)();
    if (ctxEffets.state === 'suspended') ctxEffets.resume().catch(() => {});
    const sortie = ctxEffets.createGain(), limiteur = ctxEffets.createDynamicsCompressor();
    sortie.gain.value = Math.max(0, Math.min(1, volume));
    limiteur.threshold.value = -8; limiteur.knee.value = 6; limiteur.ratio.value = 12; limiteur.attack.value = 0.003; limiteur.release.value = 0.15;
    sortie.connect(limiteur).connect(ctxEffets.destination);
    recette(ctxEffets, sortie, ctxEffets.currentTime + 0.04);
    setTimeout(() => { try { sortie.disconnect(); limiteur.disconnect(); } catch (e) { /* déjà débranché */ } }, 6500);
    return true;
  } catch (e) { return false; }
}
