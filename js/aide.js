/* MESA : la bulle d'aide. Elle cherche la réponse dans la FAQ (js/aide-faq.js), sans IA et sans serveur :
   tout se passe dans le navigateur. Si rien ne convient, elle propose d'écrire au support (js/aide-config.js).
   Le moteur (AideRecherche) sert aussi à la page faq.html. */
'use strict';

const AideRecherche = (() => {
  const VIDES = new Set(('a au aux avec ce ces cet cette c ca comment d de des du elle en est et etre il ils je j l la le les leur lui m ma mais me mes mon n ne on ou par pas pour qu que quel quelle quels quelles qui sa se ses si son sur t ta te tes toi ton tu un une vos votre vous y faire fait faut peut peux puis puisje veux voudrais aimerais svp merci bonjour salut est-ce esque estce quoi ya il-y-a avoir ai as a-t-il marche marchent marcher fonctionne fonctionnent mettre met mets truc chose').split(' '));
  /* mots qui veulent dire la même chose : ramenés à un seul */
  const SYN = {
    webcam: 'camera', cam: 'camera', cams: 'camera', cameras: 'camera',
    mic: 'micro', microphone: 'micro', audio: 'son', sonore: 'son',
    stream: 'direct', streamer: 'direct', streaming: 'direct', live: 'direct', lives: 'direct', diffuser: 'direct', diffusion: 'direct', antenne: 'antenne',
    tel: 'telephone', portable: 'telephone', smartphone: 'telephone', mobile: 'telephone', iphone: 'telephone', android: 'telephone',
    pote: 'invite', potes: 'invite', ami: 'invite', amis: 'invite', copain: 'invite', copains: 'invite', participant: 'invite', participants: 'invite', guest: 'invite', invites: 'invite', inviter: 'invite',
    tarif: 'prix', tarifs: 'prix', cout: 'prix', coute: 'prix', couter: 'prix', cher: 'prix', euros: 'prix', euro: 'prix',
    gratos: 'gratuit', free: 'gratuit', gratuitement: 'gratuit',
    bug: 'probleme', bugs: 'probleme', beug: 'probleme', marchepas: 'probleme', panne: 'probleme',
    quizz: 'quiz', questionnaire: 'quiz',
    mail: 'email', mails: 'email', courriel: 'email', 'e-mail': 'email', contacter: 'contact',
    twitter: 'x', insta: 'instagram', yt: 'youtube', fb: 'facebook',
    overlay: 'habillage', layout: 'cadrage', disposition: 'cadrage',
    obs: 'obs', 'obs-studio': 'obs',
    soustitre: 'soustitres', soustitres: 'soustitres', stt: 'soustitres', transcription: 'soustitres',
    lag: 'rame', lent: 'rame', saccade: 'rame', freeze: 'rame',
  };
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/sous[\s-]?titres?/g, 'soustitres').replace(/e-?mail/g, 'email').replace(/marche pas/g, 'marchepas probleme')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const FINS = ['ements', 'ement', 'ations', 'ation', 'euses', 'euse', 'eurs', 'eur', 'ees', 'ee', 'es', 'er', 'ez', 'e', 's', 'x'];
  function racine(m) {
    if (SYN[m]) m = SYN[m];
    if (m.length < 5) return m;
    for (const f of FINS) if (m.endsWith(f) && m.length - f.length >= 4) return m.slice(0, -f.length);
    return m;
  }
  const mots = s => norm(s).split(' ').filter(m => m && !VIDES.has(m)).map(racine).filter(m => m.length > 1 || /\d/.test(m) || m === 'x');

  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prec = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let mini = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        mini = Math.min(mini, cur[j]);
      }
      if (mini > max) return max + 1;
      prec = cur;
    }
    return prec[b.length];
  }

  function index(liste) {
    const docs = liste.map((e, i) => ({
      i, e,
      q: new Set(mots(e.q)), m: new Set(mots(e.m || '')), r: new Set(mots(e.r)),
      qn: ' ' + norm(e.q) + ' ',
    }));
    const df = new Map();
    docs.forEach(d => new Set([...d.q, ...d.m, ...d.r]).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
    const N = docs.length;
    const idf = t => Math.log(1 + N / (df.get(t) || N));
    const vocab = [...df.keys()];
    const proches = new Map();
    /* un mot inconnu (faute de frappe, mot coupé) : on prend les mots du vocabulaire les plus proches */
    function variantes(t) {
      if (df.has(t)) return [[t, 1]];
      if (proches.has(t)) return proches.get(t);
      const r = [];
      if (t.length >= 4) {
        const max = t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0;
        for (const v of vocab) {
          if (v.length >= 4 && (v.startsWith(t) || t.startsWith(v))) r.push([v, .8]);
          else if (distance(t, v, max) <= max) r.push([v, .7]);
        }
      }
      proches.set(t, r.slice(0, 6));
      return proches.get(t);
    }

    function chercher(texte, n = 4) {
      const qm = [...new Set(mots(texte))];
      if (!qm.length) return [];
      const phrase = ' ' + norm(texte) + ' ';
      let poidsTotal = 0;
      const termes = qm.map(t => { const v = variantes(t); const p = v.length ? Math.max(...v.map(([x]) => idf(x))) : idf(t) * .6; poidsTotal += p; return v; });
      const res = docs.map(d => {
        let s = 0, couvert = 0;
        const touches = new Set();
        termes.forEach((v, k) => {
          let meilleur = 0, poids = 0;
          for (const [t, f] of v) {
            const w = d.q.has(t) ? 3 : d.m.has(t) ? 2.2 : d.r.has(t) ? 1 : 0;
            if (w * f * idf(t) > meilleur) { meilleur = w * f * idf(t); poids = (w >= 2.2 ? 1 : .6) * f * idf(t); }
            if (d.q.has(t)) touches.add(t);
          }
          if (meilleur) { s += meilleur; couvert += poids; }
        });
        /* une question qui parle d'autre chose en plus (« mon invité », « dans OBS »…) passe derrière */
        let restes = 0; d.q.forEach(t => { if (!touches.has(t) && idf(t) > 1.2) restes++; });
        s = s / (1 + .12 * restes);
        /* bonus : expressions qui changent tout (« sans obs », « avec obs ») */
        for (const ex of [' sans obs ', ' avec obs ', ' watch party ', ' cam link ', ' qr code ']) if (phrase.includes(ex) && (d.qn.includes(ex) || norm(d.e.m || '').includes(ex.trim()))) s += 2;
        return { e: d.e, i: d.i, score: s, couverture: poidsTotal ? Math.min(1, couvert / poidsTotal) : 0 };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
      return res.slice(0, n);
    }
    return { chercher };
  }
  /* sûr = assez de mots importants retrouvés, et nettement devant les autres */
  const sur = (res) => !!res[0] && res[0].score >= 3.2 && res[0].couverture >= .45;
  return { index, sur, norm };
})();

(() => {
  if (typeof FAQ === 'undefined') return;
  const moteur = AideRecherche.index(FAQ);
  const script = document.currentScript;
  const place = (script && script.dataset.place) || 'droite';   // droite, gauche, regie, ou aucune (page FAQ : moteur seul)
  if (place === 'aucune') return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const texte = s => esc(s).replace(/\n/g, '<br>');
  const email = (typeof AIDE_EMAIL === 'string' && /.+@.+\..+/.test(AIDE_EMAIL.trim())) ? AIDE_EMAIL.trim() : '';
  const POPULAIRES = ["Combien ça coûte ?", "Comment inviter quelqu'un ?", "Comment brancher le studio dans OBS ?", "Ma caméra ne s'affiche pas", "C'est quoi la Watch Party ?"];
  let derniereQuestion = '';

  const racineEl = document.createElement('div');
  racineEl.className = 'aide-racine aide-' + place + (place === 'regie' ? ' aide-droite' : '');
  racineEl.innerHTML = `
    <button type="button" class="aide-bulle" aria-expanded="false" aria-controls="aide-panneau" title="Une question ? Demande à l'aide">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/><path d="M9.6 8.4a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.7-.9 1.3M12 13.6v.1" class="aide-trait"/></svg>
      <span>Aide</span>
    </button>
    <section class="aide-panneau" id="aide-panneau" role="dialog" aria-label="Aide MESA" hidden>
      <header class="aide-tete">
        <div><b>Aide</b><small>Répond à partir de la FAQ</small></div>
        <a class="aide-tout" href="faq.html" target="_blank" rel="noopener" title="Toutes les questions, sur une page">FAQ</a>
        <button type="button" class="aide-son aide-fermer" aria-pressed="false">🔊</button>
        <button type="button" class="aide-fermer" aria-label="Fermer l'aide">✕</button>
      </header>
      <div class="aide-fil" aria-live="polite"></div>
      <form class="aide-saisie" autocomplete="off">
        <input type="text" maxlength="300" placeholder="Pose ta question, avec tes mots…" aria-label="Ta question">
        <button type="submit" aria-label="Envoyer">➤</button>
      </form>
    </section>`;
  document.body.appendChild(racineEl);

  const bulle = racineEl.querySelector('.aide-bulle');
  const panneau = racineEl.querySelector('.aide-panneau');
  const fil = racineEl.querySelector('.aide-fil');
  const form = racineEl.querySelector('.aide-saisie');
  const champ = form.querySelector('input');
  /* rien de ce qu'on tape ici ne doit déclencher les raccourcis de la régie */
  panneau.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); e.stopPropagation(); });

  function ajouter(classe, html) {
    const d = document.createElement('div');
    d.className = 'aide-msg ' + classe;
    d.innerHTML = html;
    fil.appendChild(d);
    /* on montre le début de la réponse, pas sa fin */
    fil.scrollTop = classe === 'aide-bot' ? Math.max(0, d.offsetTop - 60) : fil.scrollHeight;
    if (classe === 'aide-bot') frappe = taper(d);
    return d;
  }
  /* La réponse s'écrit sous tes yeux, comme un vrai chat : le texte apparaît petit à petit (en 2 secondes au plus),
     puis les boutons (questions proches, contact) arrivent en fondu. */
  let frappe = null;
  const doux = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function taper(d) {
    if (doux) return Promise.resolve();
    const noeuds = [], w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT, { acceptNode: n => !n.nodeValue.trim() || n.parentElement.closest('button, a, .aide-puces, .aide-cache') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) noeuds.push(w.currentNode);
    const textes = noeuds.map(n => n.nodeValue), total = textes.reduce((t, x) => t + x.length, 0);
    if (!total) return Promise.resolve();
    const extras = [...d.querySelectorAll('button, a, .aide-puces, .aide-sous')];
    extras.forEach(x => x.classList.add('aide-attend'));
    noeuds.forEach(n => { n.nodeValue = ''; });
    d.classList.add('aide-tape');
    const curseur = document.createElement('i'); curseur.className = 'aide-curseur'; curseur.setAttribute('aria-hidden', 'true');
    const parSeconde = Math.max(55, total / 2);         // les longues réponses vont plus vite : jamais plus de 2 s
    return new Promise(fin => {
      const t0 = performance.now();
      const pas = now => {
        if (!d.isConnected) return fin();
        let reste = Math.min(total, Math.round((now - t0) / 1000 * parSeconde));
        let ici = noeuds[0];
        noeuds.forEach((n, i) => { const k = Math.min(textes[i].length, reste); n.nodeValue = textes[i].slice(0, k); if (k > 0) ici = n; reste -= k; });
        if (curseur.previousSibling !== ici) ici.parentNode.insertBefore(curseur, ici.nextSibling);
        if (Math.round((now - t0) / 1000 * parSeconde) < total) return requestAnimationFrame(pas);
        d.classList.remove('aide-tape'); curseur.remove();
        extras.forEach((x, i) => { x.style.animationDelay = (60 * i) + 'ms'; x.classList.add('aide-arrive'); x.classList.remove('aide-attend'); });
        fin();
      };
      requestAnimationFrame(pas);
    });
  }
  const puces = (liste) => `<div class="aide-puces">${liste.map(q => `<button type="button" class="aide-puce" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  function blocContact(intro) {
    if (email) return `<p>${esc(intro)}</p><a class="aide-mail" href="${esc(lienMail())}">✉ Écrire au support</a>`;
    return `<p>${esc(intro)}</p><p class="aide-bientot">L'adresse e-mail du support arrive très bientôt.</p>`;
  }
  function lienMail() {
    const corps = `Ma question : ${derniereQuestion || ''}\n\n(Écris ici ce que tu faisais et ce qui s'est passé.)\n\n---\nPage : ${location.pathname.split('/').pop() || 'accueil'}\nNavigateur : ${navigator.userAgent}`;
    return `mailto:${email}?subject=${encodeURIComponent('Aide MESA : ' + (derniereQuestion || 'ma question').slice(0, 80))}&body=${encodeURIComponent(corps)}`;
  }

  function accueil() {
    ajouter('aide-bot', `<p>Salut ! Pose ta question comme tu veux : « ma caméra est noire », « c'est combien », « comment inviter un pote »…</p>${puces(POPULAIRES)}`);
  }
  /* « L'aide réfléchit » : trois petits points et un petit son doux pendant une à deux secondes et demie, puis la réponse.
     Le son est fabriqué par le navigateur (aucun fichier). Le bouton haut-parleur de l'en-tête le coupe, et c'est retenu. */
  let sonCoupe = false; try { sonCoupe = localStorage.getItem('studioSeb:aideMuet') === '1'; } catch (e) { /* navigation privée */ }
  let audio = null, occupe = false;
  function bip(t, freq, duree, volume) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.12, t + duree);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + duree + 0.02);
  }
  function sonReflexion(duree) {
    if (sonCoupe) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + 0.05;
      /* trois petites gouttes qui montent, comme les trois points, répétées toutes les 0,7 s */
      for (let k = 0; k * 0.7 < duree - 0.4; k++) [0, 0.11, 0.22].forEach((d, i) => bip(t0 + k * 0.7 + d, 660 + i * 110, 0.09, 0.035));
    } catch (e) { /* pas de son, tant pis */ }
  }
  function sonReponse() {
    if (sonCoupe || !audio) return;
    try { const t = audio.currentTime + 0.02; bip(t, 880, 0.12, 0.04); bip(t + 0.08, 1320, 0.16, 0.03); } catch (e) { /* rien */ }
  }
  function reflechir(secondes, quand) {
    occupe = true; champ.disabled = true; racineEl.classList.add('reflechit');
    const points = ajouter('aide-bot aide-points', '<span></span><span></span><span></span><em class="aide-cache">L\'aide réfléchit…</em>');
    sonReflexion(secondes);
    setTimeout(() => {
      points.remove(); sonReponse(); frappe = null; quand();
      // on rend la main quand la réponse a fini de s'écrire
      Promise.resolve(frappe).then(() => { occupe = false; champ.disabled = false; racineEl.classList.remove('reflechit'); champ.focus(); });
    }, secondes * 1000);
  }
  /* plus la réponse est longue, plus elle « réfléchit » : entre 1,2 et 2,6 secondes */
  const tempsPour = (txt) => Math.min(2.6, 1.2 + String(txt).length / 400) + Math.random() * 0.3;

  function repondre(question) {
    if (occupe) return;
    derniereQuestion = question;
    ajouter('aide-moi', `<p>${esc(question)}</p>`);
    const res = moteur.chercher(question, 4);
    if (AideRecherche.sur(res)) {
      const [r, ...autres] = res;
      const proches = autres.filter(x => x.score >= r.score * .55).slice(0, 3).map(x => x.e.q);
      reflechir(tempsPour(r.e.r), () => {
        const d = ajouter('aide-bot', `<p class="aide-q">${esc(r.e.q)}</p><p>${texte(r.e.r)}</p>
          ${proches.length ? `<p class="aide-sous">Ou peut-être :</p>${puces(proches)}` : ''}
          <button type="button" class="aide-lien aide-pasca">Ce n'est pas ma réponse</button>`);
        d.querySelector('.aide-pasca').onclick = (ev) => {
          if (occupe) return;
          ev.target.remove();
          reflechir(1, () => ajouter('aide-bot', blocContact("Désolé ! Essaie avec d'autres mots, ou écris-nous : on te répond nous-mêmes.")));
        };
      });
    } else if (res.length) {
      reflechir(1.8, () => ajouter('aide-bot', `<p>Je ne suis pas sûr d'avoir compris. Tu cherches l'une de celles-ci ?</p>${puces(res.slice(0, 3).map(x => x.e.q))}${blocContact("Sinon, écris-nous : on te répond nous-mêmes.")}`));
    } else {
      reflechir(1.6, () => ajouter('aide-bot', blocContact("Je n'ai pas de réponse à ça dans la FAQ. Essaie avec d'autres mots, ou écris-nous : on te répond nous-mêmes.")));
    }
  }

  const btnSon = racineEl.querySelector('.aide-son');
  const majSon = () => { btnSon.textContent = sonCoupe ? '🔇' : '🔊'; btnSon.title = sonCoupe ? 'Remettre le petit son' : 'Couper le petit son'; btnSon.setAttribute('aria-pressed', String(sonCoupe)); };
  btnSon.onclick = () => { sonCoupe = !sonCoupe; try { localStorage.setItem('studioSeb:aideMuet', sonCoupe ? '1' : '0'); } catch (e) { /* rien */ } majSon(); };
  majSon();

  function ouvrir() {
    panneau.hidden = false; bulle.setAttribute('aria-expanded', 'true'); racineEl.classList.add('ouvert');
    if (!fil.children.length) accueil();
    setTimeout(() => champ.focus(), 30);
  }
  /* régie sur ordinateur : l'aide s'ouvre depuis le bouton « ? » de l'en-tête, pas de bulle sur l'image */
  const btnEntete = place === 'regie' ? document.getElementById('btn-aide') : null;
  function fermer() {
    panneau.hidden = true; bulle.setAttribute('aria-expanded', 'false'); racineEl.classList.remove('ouvert');
    (btnEntete && btnEntete.offsetParent ? btnEntete : bulle).focus();
  }
  bulle.onclick = () => panneau.hidden ? ouvrir() : fermer();
  if (btnEntete) btnEntete.onclick = () => panneau.hidden ? ouvrir() : fermer();
  racineEl.querySelector('.aide-fermer:not(.aide-son)').onclick = fermer;
  form.onsubmit = e => { e.preventDefault(); const q = champ.value.trim(); if (!q) return; champ.value = ''; repondre(q); };
  fil.addEventListener('click', e => { const b = e.target.closest('.aide-puce'); if (b) repondre(b.dataset.q); });
})();
