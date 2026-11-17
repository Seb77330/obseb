/* OBSeb : régie, onglet Comptes (où le live est diffusé).
   Les clés de stream restent dans ce navigateur (jamais dans les liens ni dans l'état envoyé aux invités).
   Le serveur OBSeb les recevra au lancement du direct. */
'use strict';

const PLATEFORMES_LIVE = [
  { id: 'youtube', nom: 'YouTube', court: 'YT', couleur: '#FF0000', format: 'horizontal', serveur: 'rtmp://a.rtmp.youtube.com/live2',
    aide: 'YouTube Studio > Créer > Passer au direct > onglet Diffusion : copie la « Clé de stream ».' },
  { id: 'twitch', nom: 'Twitch', court: 'TW', couleur: '#9146FF', format: 'horizontal', serveur: 'rtmp://live.twitch.tv/app',
    aide: 'Tableau de bord des créateurs > Paramètres > Diffusion : copie la « Clé de stream principale ».' },
  { id: 'facebook', nom: 'Facebook', court: 'FB', couleur: '#1877F2', format: 'horizontal', serveur: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    aide: 'facebook.com/live/producer > « Logiciel de streaming » : copie la clé de stream.' },
  { id: 'x', nom: 'X', court: 'X', couleur: '#000000', format: 'horizontal', serveur: '',
    aide: 'studio.x.com > Producer > Sources > Créer une source : copie l\'URL RTMP et la clé. Selon ton compte, X peut demander X Premium.' },
  { id: 'kick', nom: 'Kick', court: 'K', couleur: '#53FC18', texte: '#000', format: 'horizontal', serveur: '',
    aide: 'Tableau de bord Kick > Paramètres > Stream URL & Key : copie l\'URL et la clé.' },
  { id: 'tiktok', nom: 'TikTok', court: 'TT', couleur: '#111111', format: 'vertical', serveur: '',
    aide: 'TikTok LIVE Center (ou LIVE Studio) > Clé de stream : copie l\'URL du serveur et la clé. Ta chaîne a assez d\'abonnés pour le LIVE.' },
  { id: 'instagram', nom: 'Instagram', court: 'IG', couleur: '#E1306C', format: 'vertical', serveur: '',
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
  if (!c.format) c.format = p.format;
  return c;
}

/* Destinations prêtes, utilisées par le serveur au lancement du direct */
function destinationsActives() {
  return PLATEFORMES_LIVE.map(p => ({ p, c: compte(p) }))
    .filter(({ c }) => c.actif && c.serveur && c.cle)
    .map(({ p, c }) => ({ plateforme: p.id, format: c.format, url: c.serveur.replace(/\/+$/, '') + '/' + c.cle }));
}

function resumeComptes() {
  const d = destinationsActives();
  const h = d.filter(x => x.format === 'horizontal').length, v = d.length - h;
  $('#comptes-resume').innerHTML = d.length
    ? `<b>${d.length} plateforme${d.length > 1 ? 's' : ''} prête${d.length > 1 ? 's' : ''}</b> : ${h} en horizontal, ${v} en vertical. Le même direct part partout en même temps.`
    : 'Aucune plateforme prête. Active celles où tu veux diffuser et colle leur clé de stream.';
}

function dessinerComptes() {
  const box = $('#comptes-liste');
  box.innerHTML = '';
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
          <button class="petit" data-f="horizontal">Horizontal 16:9</button>
          <button class="petit" data-f="vertical">Vertical 9:16</button>
        </div>
        <input type="text" class="c-serveur" placeholder="URL du serveur (rtmp:// ou rtmps://)" autocomplete="off">
        <input type="password" class="c-cle" placeholder="Clé de stream" autocomplete="off">
        <p class="aide" style="margin:0">${esc(p.aide)}</p>
      </div>`;
    const [actif] = el.querySelectorAll('input[type=checkbox]');
    const serveur = el.querySelector('.c-serveur'), cle = el.querySelector('.c-cle');
    serveur.value = c.serveur; cle.value = c.cle;
    const majEtat = () => {
      const pret = c.serveur && c.cle;
      const e = el.querySelector('.compte-etat');
      e.textContent = !c.actif ? '' : pret ? `prêt · ${c.format === 'vertical' ? 'vertical' : 'horizontal'}` : 'il manque la clé';
      e.className = 'compte-etat' + (c.actif ? (pret ? ' ok' : ' ko') : '');
      el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('actif', b.dataset.f === c.format));
      el.classList.toggle('on', c.actif);
    };
    actif.onchange = () => { c.actif = actif.checked; sauverComptes(); majEtat(); };
    serveur.onchange = () => { c.serveur = serveur.value.trim(); sauverComptes(); majEtat(); };
    cle.onchange = () => { c.cle = cle.value.trim(); sauverComptes(); majEtat(); };
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { c.format = b.dataset.f; sauverComptes(); majEtat(); });
    el.querySelector('.compte-tete').addEventListener('click', e => { if (!e.target.closest('.interrupteur')) el.classList.toggle('ouvert'); });
    majEtat();
    box.appendChild(el);
  }
  resumeComptes();
}
dessinerComptes();
