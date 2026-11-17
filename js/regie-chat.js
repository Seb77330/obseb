/* OBSeb : régie, chat réuni (Twitch + YouTube) et message affiché à l'écran.
   Twitch : lecture anonyme, aucune clé.
   YouTube : clé d'API Google gratuite, gardée seulement dans ce navigateur (jamais dans les liens). */
'use strict';

const CLE_CHAT = 'studioSeb:chat:' + session.room;
const CLE_YT = 'studioSeb:cleYoutube';
let reglagesChat = {};
try { reglagesChat = JSON.parse(localStorage.getItem(CLE_CHAT) || '{}'); } catch (e) { /* rien */ }
const lireCleYt = () => { try { return localStorage.getItem(CLE_YT) || ''; } catch (e) { return ''; } };

const PLATEFORMES = {
  twitch: { nom: 'Twitch', court: 'TW', couleur: '#9146FF' },
  youtube: { nom: 'YouTube', court: 'YT', couleur: '#FF0000' },
};
const messagesChat = [];
const MAX_MESSAGES = 200;

function ajouterMessage(m) {
  if (!m.texte) return;
  messagesChat.push(m);
  if (messagesChat.length > MAX_MESSAGES) messagesChat.shift();
  const box = $('#chat-liste');
  const enBas = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.querySelector('.vide')?.remove();
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.title = 'Cliquer pour afficher ce message à l\'écran';
  const p = PLATEFORMES[m.p];
  el.innerHTML = `<i style="background:${p.couleur}">${p.court}</i><b></b><span></span>`;
  el.querySelector('b').textContent = m.auteur;
  if (m.couleur) el.querySelector('b').style.color = m.couleur;
  el.querySelector('span').textContent = m.texte;
  el.onclick = () => afficherMessageChat(m, el);
  box.appendChild(el);
  while (box.children.length > MAX_MESSAGES) box.firstChild.remove();
  if (enBas) box.scrollTop = box.scrollHeight;
}

function afficherMessageChat(m, el) {
  etat.chatAffiche = { p: m.p, auteur: m.auteur, texte: m.texte.slice(0, 280), ts: Date.now() };
  document.querySelectorAll('.chat-msg.affiche').forEach(x => x.classList.remove('affiche'));
  if (el) el.classList.add('affiche');
  $('#chat-masquer').disabled = false;
  envoyer();
  clearTimeout(afficherMessageChat.t);
  const duree = +$('#chat-duree').value;
  if (duree) afficherMessageChat.t = setTimeout(masquerMessageChat, duree * 1000);
}
function masquerMessageChat() {
  clearTimeout(afficherMessageChat.t);
  etat.chatAffiche = null;
  document.querySelectorAll('.chat-msg.affiche').forEach(x => x.classList.remove('affiche'));
  $('#chat-masquer').disabled = true;
  envoyer();
}
$('#chat-masquer').onclick = masquerMessageChat;

function statut(p, texte, ok) {
  const el = $('#chat-etat-' + p);
  el.textContent = texte;
  el.className = 'aide chat-etat' + (ok === true ? ' ok' : ok === false ? ' ko' : '');
}

/* ----- Twitch (IRC par WebSocket, anonyme) ----- */
let wsTwitch = null, chaineTwitch = '';
function analyserIrc(ligne) {
  // @tags :nick!nick@nick.tmi.twitch.tv PRIVMSG #chaine :texte
  let tags = {}, reste = ligne;
  if (reste[0] === '@') {
    const i = reste.indexOf(' ');
    reste.slice(1, i).split(';').forEach(kv => { const j = kv.indexOf('='); tags[kv.slice(0, j)] = kv.slice(j + 1); });
    reste = reste.slice(i + 1);
  }
  const m = reste.match(/^:([^!\s]+)\S*\s+PRIVMSG\s+#\S+\s+:(.*)$/);
  if (!m) return null;
  return { p: 'twitch', auteur: (tags['display-name'] || m[1]).replace(/\\s/g, ' '), couleur: tags.color || '', texte: m[2].replace(/^\u0001ACTION (.*)\u0001$/, '$1') };
}
function connecterTwitch(chaine) {
  deconnecterTwitch();
  chaineTwitch = chaine.toLowerCase().replace(/^.*twitch\.tv\//, '').replace(/[^a-z0-9_]/g, '');
  if (!chaineTwitch) return statut('twitch', 'Nom de chaîne invalide', false);
  statut('twitch', 'Connexion…');
  const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  wsTwitch = ws;
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags');
    ws.send('PASS SCHMOOPIIE');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 89999));
    ws.send('JOIN #' + chaineTwitch);
  };
  ws.onmessage = e => String(e.data).split('\r\n').forEach(l => {
    if (!l) return;
    if (l.startsWith('PING')) return ws.send('PONG :tmi.twitch.tv');
    if (/ JOIN #/.test(l)) statut('twitch', 'Connecté à ' + chaineTwitch, true);
    const m = analyserIrc(l); if (m) ajouterMessage(m);
  });
  ws.onclose = () => {
    if (wsTwitch !== ws) return;   // déconnexion voulue
    statut('twitch', 'Coupé, reconnexion…', false);
    setTimeout(() => { if (wsTwitch === ws) connecterTwitch(chaineTwitch); }, 4000);
  };
}
function deconnecterTwitch() {
  const ws = wsTwitch; wsTwitch = null;
  if (ws) try { ws.close(); } catch (e) { /* rien */ }
  statut('twitch', '');
}

/* ----- YouTube (API Data v3, clé gratuite) ----- */
let ytActif = null;   // { chatId, page, vus:Set, t }
function idVideoYoutube(v) {
  const m = String(v || '').match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(String(v).trim()) ? String(v).trim() : '');
}
async function connecterYoutube(video) {
  deconnecterYoutube();
  const id = idVideoYoutube(video), cle = lireCleYt();
  if (!id) return statut('youtube', 'Lien du live introuvable', false);
  if (!cle) return statut('youtube', 'Il manque la clé YouTube (voir « Clé YouTube »)', false);
  statut('youtube', 'Connexion…');
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${id}&key=${encodeURIComponent(cle)}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const chatId = d.items && d.items[0] && d.items[0].liveStreamingDetails && d.items[0].liveStreamingDetails.activeLiveChatId;
    if (!chatId) throw new Error("Ce live n'a pas de chat actif (pas encore commencé ou déjà fini)");
    ytActif = { chatId, page: '', vus: new Set(), premier: true };
    statut('youtube', 'Connecté', true);
    lireYoutube(ytActif);
  } catch (e) { statut('youtube', e.message, false); }
}
async function lireYoutube(session_) {
  if (ytActif !== session_) return;
  let attente = 6000;
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${session_.chatId}&part=snippet,authorDetails&maxResults=200${session_.page ? '&pageToken=' + session_.page : ''}&key=${encodeURIComponent(lireCleYt())}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    session_.page = d.nextPageToken || session_.page;
    attente = Math.max(6000, d.pollingIntervalMillis || 0);   // reste bien sous le quota gratuit
    let items = d.items || [];
    if (session_.premier) { items = items.slice(-15); session_.premier = false; }
    for (const it of items) {
      if (session_.vus.has(it.id)) continue;
      session_.vus.add(it.id);
      const texte = it.snippet.displayMessage || (it.snippet.superChatDetails && it.snippet.superChatDetails.userComment) || '';
      ajouterMessage({ p: 'youtube', auteur: it.authorDetails.displayName, couleur: '', texte });
    }
    if (ytActif === session_) statut('youtube', 'Connecté', true);
  } catch (e) {
    statut('youtube', e.message, false);
    if (/ended|no longer live|not found/i.test(e.message)) return;
    attente = 15000;
  }
  if (ytActif === session_) session_.t = setTimeout(() => lireYoutube(session_), attente);
}
function deconnecterYoutube() {
  if (ytActif) clearTimeout(ytActif.t);
  ytActif = null;
  statut('youtube', '');
}

/* ----- Interface ----- */
function sauverReglagesChat() { try { localStorage.setItem(CLE_CHAT, JSON.stringify(reglagesChat)); } catch (e) { /* rien */ } }
$('#chat-twitch').value = reglagesChat.twitch || '';
$('#chat-youtube').value = reglagesChat.youtube || '';
$('#chat-cle-yt').value = lireCleYt();
$('#chat-cle-yt').onchange = () => { try { localStorage.setItem(CLE_YT, $('#chat-cle-yt').value.trim()); } catch (e) { /* rien */ } };

$('#chat-btn-twitch').onclick = () => {
  if (wsTwitch) { deconnecterTwitch(); $('#chat-btn-twitch').textContent = 'Connecter'; return; }
  reglagesChat.twitch = $('#chat-twitch').value.trim(); sauverReglagesChat();
  connecterTwitch(reglagesChat.twitch); $('#chat-btn-twitch').textContent = 'Couper';
};
$('#chat-btn-youtube').onclick = () => {
  if (ytActif) { deconnecterYoutube(); $('#chat-btn-youtube').textContent = 'Connecter'; return; }
  reglagesChat.youtube = $('#chat-youtube').value.trim(); sauverReglagesChat();
  connecterYoutube(reglagesChat.youtube).then(() => { $('#chat-btn-youtube').textContent = ytActif ? 'Couper' : 'Connecter'; });
};
$('#chat-masquer').disabled = !etat.chatAffiche;
