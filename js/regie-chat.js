/* MESA : régie, chat réuni (YouTube + Twitch), message choisi ou chat entier affiché à l'écran.
   Tu donnes ta chaîne une seule fois : elle est retenue pour tous tes lives et le chat se reconnecte tout seul.
   Twitch : lecture anonyme, aucune clé.
   YouTube : clé d'API Google gratuite, gardée seulement dans ce navigateur (jamais dans les liens). */
'use strict';

const CLE_CHAT = 'studioSeb:chat';                    // les chaînes sont retenues pour tous les lives
const CLE_YT = 'studioSeb:cleYoutube';
let reglagesChat = {};
try { reglagesChat = JSON.parse(localStorage.getItem(CLE_CHAT) || localStorage.getItem(CLE_CHAT + ':' + session.room) || '{}'); } catch (e) { /* rien */ }
etat.chatFil = Object.assign({ actif: false, msgs: [] }, etat.chatFil);
const lireCleYt = () => { try { return localStorage.getItem(CLE_YT) || ''; } catch (e) { return ''; } };

const PLATEFORMES = {
  youtube: { nom: 'YouTube', court: 'YT', couleur: '#FF0000' },
  twitch: { nom: 'Twitch', court: 'TW', couleur: '#9146FF' },
  test: { nom: 'Test', court: 'TEST', couleur: '#6b7280' },
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
  if (etat.chatFil.actif) { remplirFilChat(); envoyerBientot(); }
}
// les derniers messages, envoyés à la sortie quand « tout le chat à l'écran » est coché
function remplirFilChat() {
  etat.chatFil.msgs = messagesChat.slice(-8).map(m => ({ p: m.p, a: String(m.auteur).slice(0, 30), t: m.texte.slice(0, 200) }));
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

/* Message de test : pour essayer le chat et la mise en avant sans attendre un vrai message */
const ESSAIS_CHAT = [
  ['Elsa', 'Salut ! On vous entend super bien, vous parlez de quel film ce soir ?'],
  ['BondFan_007', 'Daniel Craig reste le meilleur Bond, Casino Royale est un chef-d\'œuvre !'],
  ['lea_cine', 'Trop bien ce live, continuez !'],
  ['Malik', 'Question pour l\'invité : c\'est quoi le film que tu as le plus revu dans ta vie, et pourquoi tu y reviens toujours ?'],
];
let nEssaiChat = 0;
$('#chat-test').onclick = () => {
  const [auteur, texte] = ESSAIS_CHAT[nEssaiChat++ % ESSAIS_CHAT.length];
  const m = { p: 'test', auteur, texte };
  ajouterMessage(m);
  afficherMessageChat(m, $('#chat-liste').lastElementChild);
};

/* Les quatre façons de mettre un message en avant */
const STYLES_CHAT = ['bulle', 'depeche', 'affiche', 'postit', 'billet', 'clap', 'neon', 'scope', 'notif', 'sms', 'verre', 'terminal', 'post', 'karaoke', 'pixel'];
if (!STYLES_CHAT.includes(etat.chatStyle)) etat.chatStyle = 'bulle';
function majStylesChat() { $$('#chat-styles button').forEach(b => b.classList.toggle('actif', b.dataset.cstyle === etat.chatStyle)); }
$$('#chat-styles button').forEach(b => b.onclick = () => { etat.chatStyle = b.dataset.cstyle; majStylesChat(); envoyer(); });
majStylesChat();

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
// accepte « nom », « @nom », « twitch.tv/nom » ou le lien complet
function nomTwitch(v) {
  v = String(v || '').trim().toLowerCase();
  const m = v.match(/twitch\.tv\/([a-z0-9_]{2,25})/);
  if (m) return m[1];
  v = v.replace(/^[@#]/, '');
  return /^[a-z0-9_]{2,25}$/.test(v) ? v : '';
}
function connecterTwitch(chaine) {
  deconnecterTwitch();
  chaineTwitch = nomTwitch(chaine);
  if (!chaineTwitch) { $('#chat-twitch').focus(); return chaine.trim() ? statut('twitch', 'Je ne reconnais pas cette chaîne. Écris juste son nom.', false) : statut('twitch', 'Écris le nom de ta chaîne Twitch, une seule fois. Ensuite le chat se connecte tout seul.'); }
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
let ytAttente = null; // en attente du début du live : { t }
function idVideoYoutube(v) {
  const m = String(v || '').match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(String(v).trim()) ? String(v).trim() : '');
}
// « @nom », « youtube.com/@nom », « youtube.com/channel/UC… » ou juste le nom
function chaineYoutube(v) {
  v = String(v || '').trim();
  let m = v.match(/youtube\.com\/channel\/(UC[\w-]{22})/) || v.match(/^(UC[\w-]{22})$/);
  if (m) return { id: m[1] };
  m = v.match(/youtube\.com\/@([\w.-]{3,30})/) || v.match(/^@([\w.-]{3,30})$/) || v.match(/^([\w.-]{3,30})$/);
  return m ? { pseudo: m[1] } : null;
}
async function apiYoutube(chemin) {
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + chemin + '&key=' + encodeURIComponent(lireCleYt()));
  const d = await r.json();
  if (d.error) {
    const raison = (d.error.errors && d.error.errors[0] && d.error.errors[0].reason) || '';
    if (/keyInvalid|badRequest/i.test(raison) && /API key/i.test(d.error.message)) throw new Error('La clé YouTube est refusée : vérifie-la dans « Clé YouTube »');
    if (/quota/i.test(raison)) throw new Error('Quota YouTube du jour atteint : le chat reviendra demain');
    throw new Error(d.error.message);
  }
  return d;
}
async function connecterYoutube(valeur, essai) {
  deconnecterYoutube();
  const video = idVideoYoutube(valeur), chaine = video ? null : chaineYoutube(valeur);
  if (!String(valeur || '').trim()) { $('#chat-youtube').focus(); return statut('youtube', 'Écris ta chaîne YouTube (@nom), une seule fois. Ensuite le chat se connecte tout seul.'); }
  if (!video && !chaine) return statut('youtube', 'Je ne reconnais pas cette chaîne ni ce lien', false);
  if (!lireCleYt()) { $('#chat-cle-bloc').open = true; $('#chat-cle-yt').focus(); return statut('youtube', 'Il manque la clé YouTube : colle-la juste en dessous (une seule fois)'); }
  statut('youtube', 'Connexion…');
  const jeton = ytAttente = {};
  try {
    let id = video;
    if (!id) {
      let idChaine = chaine.id || (reglagesChat.ytPseudo === chaine.pseudo && reglagesChat.ytIdChaine) || '';
      if (!idChaine) {
        const d = await apiYoutube(`channels?part=id&forHandle=${encodeURIComponent('@' + chaine.pseudo)}`);
        idChaine = d.items && d.items[0] && d.items[0].id;
        if (!idChaine) throw new Error('Chaîne YouTube introuvable : @' + chaine.pseudo);
        Object.assign(reglagesChat, { ytPseudo: chaine.pseudo, ytIdChaine: idChaine }); sauverReglagesChat();
      }
      const d = await apiYoutube(`search?part=id&channelId=${idChaine}&eventType=live&type=video&maxResults=1`);
      if (ytAttente !== jeton) return;
      id = d.items && d.items[0] && d.items[0].id && d.items[0].id.videoId;
      if (!id) {
        // pas encore en direct : on revérifie, sans vider le quota gratuit
        if ((essai || 0) >= 14) { ytAttente = null; return statut('youtube', 'Toujours pas de live sur cette chaîne. Clique sur Connecter quand il a commencé.', false); }
        statut('youtube', 'Pas de live en cours sur cette chaîne. Je revérifie toutes les 2 minutes.');
        jeton.t = setTimeout(() => { if (ytAttente === jeton) connecterYoutube(valeur, (essai || 0) + 1).then(majBoutonsChat); }, 120000);
        return;
      }
    }
    const d = await apiYoutube(`videos?part=liveStreamingDetails&id=${id}`);
    if (ytAttente !== jeton) return;
    const chatId = d.items && d.items[0] && d.items[0].liveStreamingDetails && d.items[0].liveStreamingDetails.activeLiveChatId;
    if (!chatId) throw new Error("Ce live n'a pas de chat actif (pas encore commencé ou déjà fini)");
    ytAttente = null;
    ytActif = { chatId, page: '', vus: new Set(), premier: true };
    statut('youtube', 'Connecté', true);
    lireYoutube(ytActif);
  } catch (e) { if (ytAttente === jeton) ytAttente = null; statut('youtube', e.message, false); }
}
async function lireYoutube(session_) {
  if (ytActif !== session_) return;
  let attente = 6000;
  try {
    const d = await apiYoutube(`liveChat/messages?liveChatId=${session_.chatId}&part=snippet,authorDetails&maxResults=200${session_.page ? '&pageToken=' + session_.page : ''}`);
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
  if (ytAttente) clearTimeout(ytAttente.t);
  ytActif = null; ytAttente = null;
  statut('youtube', '');
}

/* ----- Interface ----- */
function sauverReglagesChat() { try { localStorage.setItem(CLE_CHAT, JSON.stringify(reglagesChat)); } catch (e) { /* rien */ } }
function majBoutonsChat() {
  $('#chat-btn-twitch').textContent = wsTwitch ? 'Couper' : 'Connecter';
  $('#chat-btn-youtube').textContent = ytActif || ytAttente ? 'Couper' : 'Connecter';
}
$('#chat-twitch').value = reglagesChat.twitch || '';
$('#chat-youtube').value = reglagesChat.youtube || '';
$('#chat-cle-yt').value = lireCleYt();
$('#chat-cle-yt').onchange = () => { try { localStorage.setItem(CLE_YT, $('#chat-cle-yt').value.trim()); } catch (e) { /* rien */ } };

function brancherTwitch() {
  reglagesChat.twitch = $('#chat-twitch').value.trim();
  connecterTwitch(reglagesChat.twitch);
  reglagesChat.twitchAuto = !!wsTwitch; sauverReglagesChat(); majBoutonsChat();
}
function brancherYoutube() {
  reglagesChat.youtube = $('#chat-youtube').value.trim();
  const p = connecterYoutube(reglagesChat.youtube);
  majBoutonsChat();
  return p.then(() => {
    // on ne retient « reconnecte tout seul » que pour une chaîne : le lien d'un live ne sert qu'une fois
    reglagesChat.youtubeAuto = !!(ytActif || ytAttente) && !idVideoYoutube(reglagesChat.youtube);
    sauverReglagesChat(); majBoutonsChat();
  });
}
$('#chat-btn-twitch').onclick = () => {
  if (wsTwitch) { deconnecterTwitch(); reglagesChat.twitchAuto = false; sauverReglagesChat(); majBoutonsChat(); return; }
  brancherTwitch();
};
$('#chat-btn-youtube').onclick = () => {
  if (ytActif || ytAttente) { deconnecterYoutube(); reglagesChat.youtubeAuto = false; sauverReglagesChat(); majBoutonsChat(); return; }
  brancherYoutube();
};
for (const [champ, brancher] of [['#chat-twitch', brancherTwitch], ['#chat-youtube', brancherYoutube]]) {
  $(champ).addEventListener('keydown', e => { if (e.key === 'Enter') brancher(); });
}

// tout le chat à l'écran
$('#chat-fil').checked = !!etat.chatFil.actif;
$('#chat-fil').onchange = e => { etat.chatFil.actif = e.target.checked; remplirFilChat(); envoyer(); };
// durée d'affichage d'un message choisi : retenue d'un live à l'autre
if (reglagesChat.duree != null && [...$('#chat-duree').options].some(o => o.value === String(reglagesChat.duree))) $('#chat-duree').value = String(reglagesChat.duree);
$('#chat-duree').onchange = e => { reglagesChat.duree = +e.target.value; sauverReglagesChat(); };
$('#chat-masquer').disabled = !etat.chatAffiche;

// à l'ouverture de la régie : le chat se reconnecte tout seul aux chaînes déjà données
if (reglagesChat.twitchAuto && nomTwitch(reglagesChat.twitch)) brancherTwitch();
if (reglagesChat.youtubeAuto && reglagesChat.youtube && lireCleYt()) brancherYoutube();
