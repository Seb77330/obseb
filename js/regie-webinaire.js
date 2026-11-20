/* MESA : régie, webinaire. Le public regarde le direct sur la page webinaire.html (la vidéo vient de YouTube ou Twitch,
   qui tiennent des centaines de spectateurs) et envoie ses questions par ntfy.sh, un relais gratuit sans compte.
   Les questions arrivent dans le chat de la régie (pastille « Q ») : un clic, et elles passent à l'écran comme un message du chat. */
'use strict';
(function () {
  const bloc = document.getElementById('pli-webinaire');
  if (!session.ent) { if (bloc) bloc.remove(); return; }   // réservé à MESA Entreprises
  const RELAIS = 'https://ntfy.sh';
  const CLE_WEB = 'studioSeb:webinaire:' + session.room;
  let web = {};
  try { web = JSON.parse(localStorage.getItem(CLE_WEB) || '{}') || {}; } catch (e) { web = {}; }
  if (!/^[a-z0-9]{16,40}$/.test(web.topic || '')) {
    const a = new Uint8Array(12); crypto.getRandomValues(a);
    web.topic = 'mesaw' + [...a].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
  }
  const sauver = () => { try { localStorage.setItem(CLE_WEB, JSON.stringify(web)); } catch (e) { /* rien */ } };
  sauver();

  const champ = $('#web-video'), btnOuvrir = $('#web-ouvrir'), btnCopier = $('#web-copier'), etatEl = $('#web-etat');
  if (!champ) return;
  const parDefaut = () => {
    const r = typeof reglagesChat === 'object' ? reglagesChat : {};
    if (r.youtube && idVideoYoutube(r.youtube)) return r.youtube;
    return r.twitch || '';
  };
  champ.value = web.video || parDefaut();

  /* « youtube.com/live/… », un ID de vidéo, une chaîne « UC… », « twitch.tv/nom » ou juste le nom Twitch */
  function lireVideo(v) {
    v = String(v || '').trim();
    if (!v) return {};
    const idv = idVideoYoutube(v); if (idv) return { yt: idv };
    let m = v.match(/youtube\.com\/channel\/(UC[\w-]{22})/) || v.match(/^(UC[\w-]{22})$/); if (m) return { yt: m[1] };
    if (/youtube\.com|youtu\.be|^@/.test(v)) return { erreur: 'Pour YouTube, colle le lien du live lui-même (youtube.com/live/…), pas celui de la chaîne.' };
    m = v.match(/twitch\.tv\/([a-zA-Z0-9_]{3,25})/) || v.match(/^([a-zA-Z0-9_]{3,25})$/); if (m) return { tw: m[1] };
    return { erreur: 'Je ne reconnais pas ce lien : colle le lien de ton live YouTube, ou ton nom de chaîne Twitch.' };
  }
  function lienPublic() {
    const v = lireVideo(champ.value);
    const p = new URLSearchParams({ t: web.topic });
    if (session.titre) p.set('titre', String(session.titre).slice(0, 80));
    if (session.hote) p.set('hote', String(session.hote).slice(0, 40));
    if (v.yt) p.set('yt', v.yt); if (v.tw) p.set('tw', v.tw);
    return { lien: `${baseUrl()}webinaire.html#${p}`, erreur: v.erreur };
  }
  const dire = t => { etatEl.textContent = typeof typoFr === 'function' ? typoFr(t) : t; };

  let flux = null, nb = 0;
  const vus = new Set();
  function ouvrir() {
    if (flux) return;
    web.ouvert = true; sauver();
    flux = new EventSource(`${RELAIS}/${web.topic}/sse?since=${Math.floor(Date.now() / 1000) - 3600}`);
    flux.onmessage = ev => {
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.event !== 'message' || vus.has(d.id)) return;
      vus.add(d.id);
      let m; try { m = JSON.parse(d.message); } catch (e) { return; }
      const texte = String(m.q || '').replace(/\s+/g, ' ').trim().slice(0, 280);
      if (!texte) return;
      nb++;
      ajouterMessage({ p: 'question', auteur: String(m.n || '').trim().slice(0, 30) || 'Anonyme', texte });
      dire(`Questions ouvertes · ${nb} question${nb > 1 ? 's' : ''} reçue${nb > 1 ? 's' : ''}`);
    };
    flux.onopen = () => { if (!nb) dire('Questions ouvertes : envoie le lien du public à tes spectateurs.'); };
    flux.onerror = () => dire('Connexion au relais perdue, nouvelle tentative…');
    btnOuvrir.textContent = 'Fermer les questions'; btnCopier.disabled = false;
  }
  function fermer() {
    if (flux) flux.close();
    flux = null; web.ouvert = false; sauver();
    btnOuvrir.textContent = 'Ouvrir les questions'; btnCopier.disabled = true;
    dire('Questions fermées.');
  }
  btnOuvrir.addEventListener('click', () => (flux ? fermer() : ouvrir()));
  champ.addEventListener('change', () => { web.video = champ.value.trim(); sauver(); const { erreur } = lienPublic(); dire(erreur || (flux ? 'Lien du public mis à jour : recopie-le.' : '')); });
  btnCopier.addEventListener('click', async () => {
    const { lien, erreur } = lienPublic();
    if (erreur) return dire(erreur);
    try { await navigator.clipboard.writeText(lien); toast('Lien du public copié'); }
    catch (e) { prompt('Copie ce lien pour ton public :', lien); }
  });
  if (web.ouvert) { ouvrir(); const d = $('#pli-webinaire'); if (d) d.open = true; }
})();
