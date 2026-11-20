/* MESA : la page du public d'un webinaire.
   La vidéo vient de la plateforme où le live est diffusé (YouTube ou Twitch) : elle tient des centaines de spectateurs.
   Les questions partent par ntfy.sh, un relais de messages gratuit, sans compte, sur un canal propre à ce live :
   la régie les reçoit dans son chat et choisit celles qui passent à l'écran. */
'use strict';
(function () {
  const RELAIS = 'https://ntfy.sh';
  const P = new URLSearchParams(location.hash.slice(1));
  const topic = P.get('t') || '';
  if (!/^[a-z0-9]{16,40}$/.test(topic)) { document.getElementById('w-erreur').hidden = false; return; }
  document.getElementById('web').hidden = false;
  const $ = s => document.querySelector(s);
  const titre = (P.get('titre') || '').slice(0, 80), hote = (P.get('hote') || '').slice(0, 40);
  if (titre) { $('#w-titre').textContent = titre; document.title = titre + ' · Webinaire'; }
  $('#w-hote').textContent = hote ? 'Avec ' + hote : 'Webinaire en direct';

  /* la vidéo */
  const yt = P.get('yt') || '', tw = P.get('tw') || '';
  const video = $('#w-video');
  let src = '';
  if (/^[\w-]{11}$/.test(yt)) src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`;
  else if (/^UC[\w-]{22}$/.test(yt)) src = `https://www.youtube.com/embed/live_stream?channel=${yt}&autoplay=1`;
  else if (/^[a-zA-Z0-9_]{3,25}$/.test(tw)) src = `https://player.twitch.tv/?channel=${tw}&parent=${location.hostname}&autoplay=true`;
  if (src) {
    const f = document.createElement('iframe');
    f.src = src; f.title = 'Le direct'; f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true;
    video.appendChild(f);
  } else {
    video.innerHTML = '<div class="w-sans"><b>Le direct se regarde ailleurs</b><span>Regarde-le là où on te l’a indiqué, et pose tes questions ici.</span></div>';
  }

  /* les questions */
  const form = $('#w-form'), q = $('#w-q'), nom = $('#w-nom'), btn = $('#w-btn'), retour = $('#w-retour'), reste = $('#w-reste');
  try { nom.value = localStorage.getItem('mesa:webinaire:nom') || ''; } catch (e) { /* rien */ }
  q.addEventListener('input', () => { reste.textContent = 280 - q.value.length; });
  let prochain = 0;
  const dire = (t, ok) => { retour.textContent = window.typoFr ? typoFr(t) : t; retour.className = 'w-retour ' + (ok ? 'ok' : 'ko'); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const texte = q.value.trim().replace(/\s+/g, ' ');
    if (!texte) return;
    const attente = Math.ceil((prochain - Date.now()) / 1000);
    if (attente > 0) return dire(`Patiente ${attente} s avant ta prochaine question.`, false);
    btn.disabled = true;
    const n = nom.value.trim().slice(0, 30);
    try { localStorage.setItem('mesa:webinaire:nom', n); } catch (e2) { /* rien */ }
    try {
      const r = await fetch(`${RELAIS}/${topic}`, { method: 'POST', body: JSON.stringify({ n, q: texte.slice(0, 280) }) });
      if (!r.ok) throw new Error(r.status);
      q.value = ''; reste.textContent = '280'; prochain = Date.now() + 20000;
      dire('Question envoyée, merci ! Elle est arrivée en régie.', true);
    } catch (err) {
      dire('La question n’est pas partie. Vérifie ta connexion et réessaie.', false);
    }
    btn.disabled = false;
  });
})();
