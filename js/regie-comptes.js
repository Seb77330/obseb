/* MESA : régie, onglet Comptes (où le live est diffusé).
   Les clés de stream restent dans ce navigateur (jamais dans les liens ni dans l'état envoyé aux invités).
   Le serveur MESA les recevra au lancement du direct. */
'use strict';

const PLATEFORMES_LIVE = [
  { id: 'youtube', page: 'https://www.youtube.com/live_dashboard', nom: 'YouTube', court: 'YT', couleur: '#FF0000', format: 'horizontal', serveur: 'rtmp://a.rtmp.youtube.com/live2',
    aide: 'YouTube Studio > Créer > Passer au direct > onglet Diffusion : copie la « Clé de stream ».' },
  { id: 'twitch', page: 'https://dashboard.twitch.tv/settings/stream', nom: 'Twitch', court: 'TW', couleur: '#9146FF', format: 'horizontal', serveur: 'rtmp://live.twitch.tv/app',
    aide: 'Tableau de bord des créateurs > Paramètres > Diffusion : copie la « Clé de stream principale ».' },
  { id: 'facebook', page: 'https://www.facebook.com/live/producer', nom: 'Facebook', court: 'FB', couleur: '#1877F2', format: 'horizontal', serveur: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    aide: 'facebook.com/live/producer > « Logiciel de streaming » : copie la clé de stream.' },
  { id: 'x', page: 'https://studio.x.com/producer', nom: 'X', court: 'X', couleur: '#000000', format: 'horizontal', serveur: '',
    aide: 'studio.x.com > Producer > Sources > Créer une source : copie l\'URL RTMP et la clé. Selon ton compte, X peut demander X Premium.' },
  { id: 'kick', page: 'https://dashboard.kick.com', nom: 'Kick', court: 'K', couleur: '#53FC18', texte: '#000', format: 'horizontal', serveur: '',
    aide: 'Tableau de bord Kick > Paramètres > Stream URL & Key : copie l\'URL et la clé.' },
  { id: 'tiktok', page: 'https://livecenter.tiktok.com/producer', nom: 'TikTok', court: 'TT', couleur: '#111111', format: 'vertical', serveur: '',
    aide: 'TikTok LIVE Center (ou LIVE Studio) > Clé de stream : copie l\'URL du serveur et la clé. Ta chaîne a assez d\'abonnés pour le LIVE.' },
  { id: 'instagram', page: 'https://www.instagram.com/', nom: 'Instagram', court: 'IG', couleur: '#E1306C', format: 'vertical', serveur: '',
    aide: 'Sur ordinateur : instagram.com > Créer > Vidéo en direct > logiciel de streaming. L\'URL et la clé changent à chaque live.' },
  { id: 'linkedin', nom: 'LinkedIn', court: 'in', couleur: '#0A66C2', format: 'horizontal', serveur: '',
    aide: 'Créer un événement LinkedIn Live (accès à demander à LinkedIn) puis « Logiciel de streaming » : copie l\'URL et la clé.' },
  { id: 'rumble', nom: 'Rumble', court: 'R', couleur: '#85C742', texte: '#000', format: 'horizontal', serveur: '',
    aide: 'Rumble Studio > Go Live > logiciel externe (RTMP) : copie l\'URL et la clé.' },
  { id: 'dailymotion', nom: 'Dailymotion', court: 'DM', couleur: '#0D0D0D', format: 'horizontal', serveur: '',
    aide: 'Dailymotion Studio > Live > Créer un live : copie l\'URL du serveur et la clé.' },
  { id: 'vimeo', nom: 'Vimeo', court: 'V', couleur: '#1AB7EA', format: 'horizontal', serveur: '',
    aide: 'Vimeo > Événement en direct > Paramètres de diffusion > RTMP : copie l\'URL et la clé (offre payante).' },
  { id: 'trovo', nom: 'Trovo', court: 'TR', couleur: '#19D66B', texte: '#000', format: 'horizontal', serveur: '',
    aide: 'Trovo > Creator Studio > Stream Settings : copie l\'URL du serveur et la clé.' },
  { id: 'dlive', nom: 'DLive', court: 'DL', couleur: '#FFD300', texte: '#000', format: 'horizontal', serveur: '',
    aide: 'DLive > Dashboard > Stream Setup : copie l\'URL et la clé.' },
  { id: 'telegram', nom: 'Telegram', court: 'TG', couleur: '#229ED9', format: 'horizontal', serveur: '',
    aide: 'Dans ton canal Telegram : Diffusion en direct > « Diffuser avec » : copie l\'URL du serveur et la clé.' },
  { id: 'autre', nom: 'Autre site (RTMP)', court: '+', couleur: '#444444', format: 'horizontal', serveur: '',
    aide: 'N\'importe quel site qui accepte un « logiciel de streaming » (comme OBS) : colle son URL RTMP et sa clé.' },
];
const CLE_COMPTES = 'studioSeb:comptes';
let comptes = {};
try { comptes = JSON.parse(localStorage.getItem(CLE_COMPTES) || '{}'); } catch (e) { /* rien */ }
function sauverComptes() { try { localStorage.setItem(CLE_COMPTES, JSON.stringify(comptes)); } catch (e) { /* rien */ } resumeComptes(); }

function compte(p) {
  if (!comptes[p.id]) comptes[p.id] = {};
  const c = comptes[p.id];
  if (c.actif === undefined) c.actif = false;
  if (c.serveur === undefined) c.serveur = p.serveur;
  if (c.cle === undefined) c.cle = '';
  if (c.cle2 === undefined) c.cle2 = '';       // la clé du second live, quand on diffuse en horizontal ET en vertical
  if (!c.format) c.format = p.format;
  return c;
}

/* Deux lives en même temps sur la même plateforme (un horizontal, un vertical) : il faut une clé pour chacun */
const comptePret = c => !!(c.actif && c.serveur && c.cle && (c.format !== 'deux' || c.cle2));
const nomFormat = f => f === 'deux' ? 'horizontal + vertical' : f === 'vertical' ? 'vertical' : 'horizontal';

/* Destinations prêtes, utilisées par le serveur au lancement du direct */
function destinationsActives() {
  return PLATEFORMES_LIVE.map(p => ({ p, c: compte(p) }))
    .filter(({ c }) => comptePret(c))
    .flatMap(({ p, c }) => (c.format === 'deux' ? [['horizontal', c.cle], ['vertical', c.cle2]] : [[c.format, c.cle]])
      .map(([format, cle]) => ({ plateforme: p.id, format, url: c.serveur.replace(/\/+$/, '') + '/' + cle })));
}

function resumeComptes() {
  const d = destinationsActives();
  const h = d.filter(x => x.format === 'horizontal').length, v = d.length - h;
  $('#comptes-resume').innerHTML = d.length
    ? `<b>${d.length} live${d.length > 1 ? 's' : ''} prêt${d.length > 1 ? 's' : ''}</b> : ${h} en horizontal, ${v} en vertical. Tout part en même temps.`
    : 'Active une plateforme, puis colle sa clé de stream.';
}

/* Les plateformes peu utilisées sont rangées dans un repli, sauf celles que tu as activées */
const PLATEFORMES_RARES = ['linkedin', 'rumble', 'dailymotion', 'vimeo', 'trovo', 'dlive', 'telegram', 'autre'];
function dessinerComptes() {
  const box = $('#comptes-liste');
  box.innerHTML = '';
  const plus = document.createElement('details');
  plus.className = 'comptes-plus';
  plus.innerHTML = '<summary></summary>';
  for (const p of PLATEFORMES_LIVE) {
    const c = compte(p);
    const el = document.createElement('div');
    el.className = 'compte' + (c.actif ? ' on' : '');
    el.innerHTML = `
      <div class="compte-tete">
        <i style="background:${p.couleur};color:${p.texte || '#fff'}">${p.court}</i>
        <b>${p.nom}</b>
        <span class="compte-etat"></span>
        <label class="interrupteur" title="Diffuser sur ${p.nom}"><input type="checkbox" ${c.actif ? 'checked' : ''}><span></span></label>
      </div>
      <div class="compte-corps">
        <div class="ligne-format">
          <button class="petit" data-f="horizontal">Horizontal</button>
          <button class="petit" data-f="vertical">Vertical</button>
          <button class="petit" data-f="deux" title="Deux lives en même temps : un horizontal et un vertical">Les deux</button>
        </div>
        <div class="compte-liens">
          ${p.page ? `<a href="${p.page}" target="_blank" rel="noopener">Ouvrir ${esc(p.nom)} ↗</a>` : ''}
          <button type="button" class="c-coller" title="Colle la clé que tu viens de copier">Coller ma clé</button>
        </div>
        <input type="text" class="c-serveur" placeholder="URL du serveur (rtmp:// ou rtmps://)" autocomplete="off">
        <input type="password" class="c-cle" placeholder="Clé de stream" autocomplete="off">
        <input type="password" class="c-cle2" placeholder="Clé du live vertical" autocomplete="off">
        <p class="aide aide-deux" style="margin:0">Les deux à la fois : crée deux lives sur ${esc(p.nom)}, un horizontal et un vertical. Chacun a sa clé.</p>
        <p class="aide" style="margin:0">${esc(p.aide)}</p>
      </div>`;
    const [actif] = el.querySelectorAll('input[type=checkbox]');
    const serveur = el.querySelector('.c-serveur'), cle = el.querySelector('.c-cle'), cle2 = el.querySelector('.c-cle2');
    serveur.value = c.serveur; cle.value = c.cle; cle2.value = c.cle2;
    const majEtat = () => {
      const pret = comptePret(c);
      const e = el.querySelector('.compte-etat');
      e.textContent = !c.actif ? '' : pret ? `prêt · ${nomFormat(c.format)}` : c.cle && c.format === 'deux' ? 'il manque la 2e clé' : 'il manque la clé';
      el.classList.toggle('deux', c.format === 'deux');
      cle.placeholder = c.format === 'deux' ? 'Clé du live horizontal' : 'Clé de stream';
      e.className = 'compte-etat' + (c.actif ? (pret ? ' ok' : ' ko') : '');
      el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('actif', b.dataset.f === c.format));
      el.classList.toggle('on', c.actif);
    };
    actif.onchange = () => { c.actif = actif.checked; sauverComptes(); majEtat(); };
    serveur.onchange = () => { c.serveur = serveur.value.trim(); sauverComptes(); majEtat(); };
    cle.onchange = () => { c.cle = cle.value.trim(); sauverComptes(); majEtat(); };
    cle2.onchange = () => { c.cle2 = cle2.value.trim(); sauverComptes(); majEtat(); };
    // « Coller ma clé » : dans la première case de clé encore vide
    el.querySelector('.c-coller').onclick = async () => {
      let t = '';
      try { t = (await navigator.clipboard.readText()).trim(); } catch (e) { return toast('Ton navigateur refuse : colle la clé dans la case avec Ctrl+V'); }
      if (!t) return toast('Rien à coller : copie d\'abord la clé sur ' + p.nom);
      if (/^rtmps?:\/\//i.test(t)) { serveur.value = t; serveur.onchange(); return toast('Adresse du serveur collée'); }
      const cible = c.format === 'deux' && c.cle && !c.cle2 ? cle2 : cle;
      cible.value = t; cible.onchange();
      if (!c.actif) { c.actif = true; actif.checked = true; sauverComptes(); majEtat(); }
      toast('Clé collée. Elle reste dans ce navigateur.');
    };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { c.format = b.dataset.f; sauverComptes(); majEtat(); });
    el.querySelector('.compte-tete').addEventListener('click', e => { if (!e.target.closest('.interrupteur')) el.classList.toggle('ouvert'); });
    majEtat();
    el.dataset.id = p.id;
    (PLATEFORMES_RARES.includes(p.id) && !c.actif ? plus : box).appendChild(el);
  }
  const n = plus.children.length - 1;
  if (n) { plus.querySelector('summary').textContent = `Autres plateformes (${n})`; box.appendChild(plus); }
  resumeComptes();
}
dessinerComptes();
