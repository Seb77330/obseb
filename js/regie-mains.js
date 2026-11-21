/* MESA : régie, « Mains levées et réactions ».
   Depuis ses coulisses, un invité peut lever la main (pour demander la parole dans un débat) ou envoyer une réaction
   (👏 😂 ❤️ 👍 😮). Ici :
   - la carte de l'invité affiche ✋ avec son rang (1 = la première main levée) ; un clic sur ✋ baisse sa main ;
   - un petit message prévient quand quelqu'un lève la main ;
   - les réactions s'envolent sur sa carte et, si tu le veux, sur son image dans le live.
   L'invité ne peut parler qu'en son nom (même contrôle que le quiz), et seules ces 5 réactions passent. */
'use strict';
(() => {
  if (typeof cartes === 'undefined') return;
  const REACTIONS = ['👏', '😂', '❤️', '👍', '😮'];
  etat.mains = etat.mains && typeof etat.mains === 'object' ? etat.mains : {};                       // id -> moment où il a levé la main
  etat.mainsBaissees = etat.mainsBaissees && typeof etat.mainsBaissees === 'object' ? etat.mainsBaissees : {};   // id -> main que tu as baissée
  etat.reacs = [];
  if (typeof etat.reacEcran !== 'boolean') etat.reacEcran = true;
  const derniereReac = new Map();
  let numReac = 0;

  const nomDe = id => (etat.noms && etat.noms[id]) || 'Un invité';
  function rangs() {
    return Object.entries(etat.mains).filter(([id]) => cartes.has(id)).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  }
  function majMains() {
    const ordre = rangs();
    for (const [id, c] of cartes) {
      const r = ordre.indexOf(id);
      let b = c.el.querySelector('.main-levee');
      if (r < 0) { if (b) b.remove(); c.el.classList.remove('main'); continue; }
      if (!b) {
        b = document.createElement('button');
        b.type = 'button'; b.className = 'main-levee';
        b.title = 'Main levée. Clique pour la baisser (par exemple quand tu lui donnes la parole).';
        b.onclick = e => { e.stopPropagation(); baisser(id); };
        (c.el.querySelector('.vignette') || c.el).appendChild(b);
      }
      b.textContent = '✋ ' + (r + 1);
      c.el.classList.add('main');
    }
    const n = ordre.length, compte = $('#mains-compte');
    if (compte) { compte.hidden = !n; compte.textContent = '✋ ' + n; compte.title = n > 1 ? `${n} mains levées` : '1 main levée'; }
  }
  function baisser(id) {
    if (!etat.mains[id]) return;
    etat.mainsBaissees[id] = etat.mains[id];
    delete etat.mains[id];
    majMains(); envoyer();
  }

  function mainRecue(id, mt) {
    mt = Math.round(+mt || 0);
    if (mt > 0) {
      if (etat.mains[id] === mt || etat.mainsBaissees[id] === mt) return;   // déjà vue, ou déjà baissée par toi
      etat.mains[id] = mt;
      toast(`✋ ${nomDe(id)} lève la main`);
      majMains(); envoyer();
    } else if (etat.mains[id]) {          // il l'a baissée lui-même
      delete etat.mains[id];
      majMains(); envoyer();
    }
  }

  function reactionRecue(id, e) {
    if (!REACTIONS.includes(e)) return;
    const t = Date.now();
    if (t - (derniereReac.get(id) || 0) < 900) return;   // pas de pluie de réactions
    derniereReac.set(id, t);
    const c = cartes.get(id);
    if (c) envolee((c.el.querySelector('.vignette') || c.el), e);
    if (etat.reacEcran && etat.onair.includes(id)) {
      etat.reacs = etat.reacs.filter(r => t - r.t < 4000).concat({ id, e, t, n: ++numReac });
      envoyer();
    }
  }
  function envolee(boite, e) {
    const s = document.createElement('span');
    s.className = 'reac-vol'; s.textContent = e;
    s.style.left = (20 + Math.random() * 60) + '%';
    boite.appendChild(s);
    setTimeout(() => s.remove(), 2200);
  }

  /* Messages des coulisses (main levée dans le « bonjour » toutes les 3 s, réaction envoyée tout de suite) */
  addEventListener('message', ev => {
    if (ev.source !== maCamera.contentWindow) return;
    const d = ev.data && ev.data.dataReceived;
    if (!d) return;
    const qui = r => r && typeof r.id === 'string' && r.id.startsWith(session.room + '_') && !(typeof ev.data.streamID === 'string' && ev.data.streamID !== r.id);
    const s = d.studioSebSalut;
    if (qui(s) && 'main' in s) mainRecue(s.id, s.main);
    const r = d.studioSebReac;
    if (qui(r)) reactionRecue(r.id, r.e);
  });

  /* Un invité qui s'en va n'a plus la main levée */
  setInterval(() => {
    let change = false;
    for (const id of Object.keys(etat.mains)) if (!cartes.has(id)) { delete etat.mains[id]; change = true; }
    const t = Date.now(), avant = etat.reacs.length;
    etat.reacs = etat.reacs.filter(r => t - r.t < 4000);
    if (change) { majMains(); envoyer(); } else if (avant && !etat.reacs.length) envoyerBientot();
  }, 2000);

  /* Le compteur dans « Invités » et le réglage dans l'onglet Titres */
  const tete = $('#btn-vue-invite');
  if (tete) tete.insertAdjacentHTML('beforebegin', '<span class="mains-compte" id="mains-compte" hidden></span>');
  const bloc = document.createElement('details');
  bloc.className = 'pli'; bloc.id = 'pli-mains';
  bloc.innerHTML = `<summary>Mains levées et réactions</summary>
    <p class="aide">Tes invités ont dans leurs coulisses un bouton « ✋ Lever la main » et 5 réactions. Une main levée s'affiche sur sa carte avec son rang ; clique dessus pour la baisser.</p>
    <label class="ligne-case" title="Seulement pour les invités à l'antenne"><input type="checkbox" id="reac-ecran"> <span><b>Montrer leurs réactions dans le live</b></span></label>`;
  const place = $('#pli-parole') || $('[data-onglet="habillage"]');
  if (place) { if (place.id === 'pli-parole') place.after(bloc); else place.appendChild(bloc); }
  $('#reac-ecran').checked = etat.reacEcran;
  $('#reac-ecran').onchange = e => { etat.reacEcran = e.target.checked; if (!etat.reacEcran) etat.reacs = []; envoyer(); };

  window.mainRecue = mainRecue;
  window.reactionRecue = reactionRecue;
  majMains();
})();
