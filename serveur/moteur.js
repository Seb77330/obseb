#!/usr/bin/env node
/* OBSeb Cloud : le moteur du direct.
   Ouvre la sortie OBSeb dans un Chrome invisible (écran virtuel 1920x1080),
   capture image + son, encode en 1080p et envoie à YouTube, tout en enregistrant le live.

   API (toutes les requêtes portent l'en-tête « Authorization: Bearer <OBSEB_SECRET> ») :
     GET  /etat                     état du direct
     POST /demarrer   {url, rtmp}   lance le direct (rtmp = adresse complète avec la clé, optionnelle)
     POST /arreter                  arrête le direct et finalise l'enregistrement
     GET  /enregistrements          liste des fichiers (chacun avec un lien de téléchargement signé, valable 1 h)
     GET  /enregistrements/<nom>    téléchargement (lien signé, ou en-tête Authorization)

   Sans clé secrète (pour la régie, les invités, la sortie) :
     POST /jeton                    {room, identite, nom, publier, cle?, pour?}  accès vidéo LiveKit (voir plus bas)
     POST /salle/admettre           {room, cle, identite}   fait entrer un invité de la salle d'attente
     POST /salle/exclure            {room, cle, identite}   le met dehors (et l'empêche de revenir sous ce nom)
     POST /salle/verrouiller        {room, cle}             plus personne ne peut entrer (deverrouiller pour rouvrir)

   Sécurité : le moteur n'écoute que sur 127.0.0.1 (Caddy fait le HTTPS devant), toute clé est comparée en temps constant,
   les essais sont limités à 30 par minute et par adresse.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const PORT = +process.env.PORT || 8080;
const SECRET = process.env.OBSEB_SECRET || '';
const DOSSIER = process.env.OBSEB_DOSSIER || '/var/lib/obseb/enregistrements';
const CHROME = process.env.CHROME || 'google-chrome';
const ECRAN = ':99';
const W = 1920, H = 1080, FPS = 30;
const DEBIT_VIDEO = process.env.DEBIT_VIDEO || '6000k';   // recommandé par YouTube pour du 1080p30
const GARDE_JOURS = +process.env.OBSEB_GARDE_JOURS || 10;   // archive gardée 10 jours puis supprimée
const ORIGINES = (process.env.OBSEB_ORIGINES || 'https://seb77330.github.io').split(',');
const crypto = require('crypto');
/* Serveur vidéo LiveKit (sur la même machine) */
const LK_CLE = process.env.LIVEKIT_API_KEY || '';
const LK_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LK_URL = process.env.LIVEKIT_URL_PUBLIQUE || '';          // ex. wss://1-2-3-4.sslip.io
const LK_PORT = +process.env.LIVEKIT_PORT || 7880;              // LiveKit écoute seulement sur la machine
const ECOUTE = process.env.OBSEB_ECOUTE || '127.0.0.1';         // le moteur n'est joignable que par Caddy (HTTPS)
const FICHIER_SALLES = path.join(DOSSIER, '..', 'salles.json');  // salle -> empreinte de la clé de l'animateur

fs.mkdirSync(DOSSIER, { recursive: true });

let etat = { enDirect: false, depuis: null, fichier: null, url: null, youtube: false, erreur: null };
const procs = {};

function journal(...a) { console.log(new Date().toISOString(), ...a); }

function lancer(nom, cmd, args, env = {}) {
  const p = spawn(cmd, args, { env: Object.assign({}, process.env, { DISPLAY: ECRAN }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.env.OBSEB_DEBUG && journal(`[${nom}]`, d.toString().trim()));
  p.stderr.on('data', d => { const t = d.toString(); if (nom === 'ffmpeg') procs.dernierFfmpeg = t; if (process.env.OBSEB_DEBUG) journal(`[${nom}]`, t.trim()); });
  p.on('exit', code => {
    journal(`${nom} terminé (code ${code})`);
    delete procs[nom];
    if (nom === 'ffmpeg' && etat.enDirect && !procs.arretDemande) {
      etat.erreur = 'Encodage interrompu : ' + (procs.dernierFfmpeg || '').slice(-300);
      journal(etat.erreur);
    }
  });
  procs[nom] = p;
  return p;
}
const attendre = ms => new Promise(r => setTimeout(r, ms));

/* Écran virtuel + carte son virtuelle : démarrés une fois */
async function preparerSysteme() {
  if (!procs.xvfb) { lancer('xvfb', 'Xvfb', [ECRAN, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp']); await attendre(800); }
  try { execFileSync('pactl', ['info'], { stdio: 'ignore' }); }
  catch (e) {
    spawn('pulseaudio', ['-D', '--exit-idle-time=-1', '--system=false'], { stdio: 'ignore' });
    await attendre(1200);
  }
  try { execFileSync('pactl', ['list', 'short', 'sinks']).toString().includes('obseb') ||
    execFileSync('pactl', ['load-module', 'module-null-sink', 'sink_name=obseb', 'rate=48000', 'channels=2', 'sink_properties=device.description=OBSeb']); } catch (e) { journal('pactl', e.message); }
  try { execFileSync('pactl', ['set-default-sink', 'obseb']); } catch (e) { /* rien */ }
}

async function demarrer({ url, rtmp }) {
  if (etat.enDirect) throw new Error('Un direct est déjà en cours');
  // le Chrome du serveur n'ouvre QUE la sortie OBSeb (jamais une autre adresse)
  let u; try { u = new URL(url); } catch (e) { throw new Error('Adresse de sortie invalide'); }
  if (!ORIGINES.includes(u.origin) || !/\/sortie\.html$/.test(u.pathname)) throw new Error('Adresse de sortie invalide');
  if (rtmp && (typeof rtmp !== 'string' || !/^rtmps?:\/\/[^\s|\[\]]+$/.test(rtmp))) throw new Error('Adresse YouTube invalide');   // pas de | ni [ ] (options de ffmpeg)
  await preparerSysteme();
  procs.arretDemande = false;
  const profil = fs.mkdtempSync('/tmp/obseb-chrome-');
  lancer('chrome', CHROME, [
    '--no-first-run', '--no-default-browser-check', '--disable-infobars', '--kiosk',
    `--window-size=${W},${H}`, '--window-position=0,0', `--user-data-dir=${profil}`,
    '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate,TranslateUI,MediaRouter',
    '--lang=fr-FR', '--accept-lang=fr-FR,fr', '--disable-notifications',
    '--enable-features=VaapiVideoDecoder', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    url
  ], { PULSE_SINK: 'obseb' });
  await attendre(5000);   // laisse le temps aux flux vdo.ninja de se connecter

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const fichier = path.join(DOSSIER, `live-${stamp}.mkv`);
  const sorties = [`[f=matroska]${fichier}`];
  if (rtmp) sorties.push(`[f=flv:onfail=ignore]${rtmp}`);
  lancer('ffmpeg', 'ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-thread_queue_size', '1024',
    '-f', 'x11grab', '-draw_mouse', '0', '-framerate', String(FPS), '-video_size', `${W}x${H}`, '-i', `${ECRAN}.0`,
    '-thread_queue_size', '1024', '-f', 'pulse', '-ac', '2', '-ar', '48000', '-i', 'obseb.monitor',
    '-map', '0:v', '-map', '1:a',
    // son : resynchronisé sur l'image (pas de dérive sur 3 h), compression douce, limiteur à -1 dB (les fous rires ne saturent plus)
    '-af', 'aresample=async=1:first_pts=0,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=200,alimiter=limit=0.89:level=false',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', DEBIT_VIDEO, '-maxrate', DEBIT_VIDEO, '-bufsize', String(parseInt(DEBIT_VIDEO, 10) * 2) + 'k',
    '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-flags', '+global_header',
    '-f', 'tee', sorties.join('|')
  ]);
  etat = { enDirect: true, depuis: Date.now(), fichier: path.basename(fichier), url, youtube: !!rtmp, erreur: null };
  journal('Direct lancé', etat.fichier, rtmp ? 'vers YouTube' : '(enregistrement seul)');
  return etat;
}

async function arreter() {
  procs.arretDemande = true;
  if (procs.ffmpeg) {
    procs.ffmpeg.kill('SIGINT');               // ffmpeg finalise proprement le fichier
    for (let i = 0; i < 50 && procs.ffmpeg; i++) await attendre(200);
    if (procs.ffmpeg) procs.ffmpeg.kill('SIGKILL');
  }
  if (procs.chrome) procs.chrome.kill('SIGTERM');
  etat.enDirect = false;
  journal('Direct arrêté');
  return etat;
}

function enregistrements() {
  return fs.readdirSync(DOSSIER).filter(f => /\.(mkv|mp4)$/.test(f)).map(f => {
    const st = fs.statSync(path.join(DOSSIER, f));
    return { nom: f, taille: st.size, date: st.mtimeMs, expire: st.mtimeMs + GARDE_JOURS * 86400000 };
  }).sort((a, b) => b.date - a.date);
}

/* Ménage : les enregistrements plus vieux que GARDE_JOURS (10 jours) sont supprimés */
function menage() {
  const limite = Date.now() - GARDE_JOURS * 86400000;
  for (const e of enregistrements()) {
    if (e.date < limite && e.nom !== etat.fichier) {
      try { fs.unlinkSync(path.join(DOSSIER, e.nom)); journal('Supprimé (plus de', GARDE_JOURS, 'jours) :', e.nom); } catch (err) { /* rien */ }
    }
  }
}
setInterval(menage, 3600000); menage();

/* ----- Jetons LiveKit -----
   Animateur (…_seb), ses écrans (…_ecran1-4) et ses autres caméras (…_cam2-4) : la clé de la régie est exigée.
   - Salles récentes (« sebk » + 12 caractères) : le nom de la salle est tiré de la clé de la régie (PBKDF2, 100 000 tours).
     Le serveur vérifie donc la clé sans rien retenir, et personne ne peut prendre la place de l'animateur, même en arrivant avant lui.
   - Anciennes salles (« sebcs… ») : la première clé vue pour la salle devient la bonne (comme avant).
   Invités : ils entrent en SALLE D'ATTENTE (ni caméra, ni micro, ni rien à voir ou entendre) jusqu'à ce que l'animateur les fasse entrer.
   Spectateurs invisibles (la sortie OBS, les vignettes, l'aperçu d'un invité) : clé de la régie, ou invité déjà admis. */
let salles = {};
try { salles = JSON.parse(fs.readFileSync(FICHIER_SALLES, 'utf8')); } catch (e) { /* rien */ }
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt(charge) {
  const tete = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corps = b64url(JSON.stringify(charge));
  const sig = crypto.createHmac('sha256', LK_SECRET).update(`${tete}.${corps}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${tete}.${corps}.${sig}`;
}
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
/* Même calcul que salleDepuisCle() dans js/common.js */
function salleDepuisCle(cle) {
  const o = crypto.pbkdf2Sync(String(cle), 'obseb-salle-v1', 100000, 12, 'sha256');
  return 'sebk' + Array.from(o, x => ALPHABET[x % 32]).join('');
}
const SALLE_LIEE = /^sebk[a-z2-9]{12}$/;
const verifCache = new Map();   // évite de refaire le calcul à chaque demande
function cleValide(room, cle) {
  if (!cle || typeof cle !== 'string' || cle.length > 100) return false;
  if (SALLE_LIEE.test(room)) {
    const k = room + ':' + cle;
    if (!verifCache.has(k)) { if (verifCache.size > 500) verifCache.clear(); verifCache.set(k, egal(salleDepuisCle(cle), room)); }
    return verifCache.get(k);
  }
  const emp = crypto.createHash('sha256').update(room + ':' + cle).digest('hex');
  if (!salles[room]) { salles[room] = emp; try { fs.writeFileSync(FICHIER_SALLES, JSON.stringify(salles), { mode: 0o600 }); } catch (e) { /* rien */ } }
  return egal(salles[room], emp);
}
/* État des salles (en mémoire : le serveur ne vit que le temps du live) */
const regles = new Map();   // room -> { verrou: bool, exclus: Set }
const regle = room => { if (!regles.has(room)) regles.set(room, { verrou: false, exclus: new Set() }); return regles.get(room); };

/* API d'administration de LiveKit (sur la machine même) */
async function lkAdmin(methode, corpsReq) {
  const maintenant = Math.floor(Date.now() / 1000);
  const t = jwt({ iss: LK_CLE, sub: 'obseb-moteur', nbf: maintenant - 10, exp: maintenant + 60, video: { room: corpsReq.room, roomAdmin: true } });
  const r = await fetch(`http://127.0.0.1:${LK_PORT}/twirp/livekit.RoomService/${methode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(corpsReq)
  });
  const txt = await r.text();
  if (!r.ok) { const e = new Error('LiveKit ' + methode + ' : ' + r.status); e.code = r.status; e.detail = txt.slice(0, 200); throw e; }
  return txt ? JSON.parse(txt) : {};
}
const perm = (p, nom) => !!(p && (p[nom] ?? p[nom.replace(/[A-Z]/g, c => '_' + c.toLowerCase())]));
async function estAdmis(room, identite) {
  if (typeof identite !== 'string' || !identite.startsWith(room + '_')) return false;
  try { const p = await lkAdmin('GetParticipant', { room, identity: identite }); return perm(p.permission, 'canPublish'); }
  catch (e) { return false; }
}
const PERM_ADMIS = { canSubscribe: true, canPublish: true, canPublishData: true, canUpdateMetadata: true };   // noms JSON de LiveKit (protobuf)

function refus(message, extra) { const e = new Error(message); e.refus = true; Object.assign(e, extra || {}); return e; }

async function jeton({ room, identite, nom, publier, cle, pour }) {
  if (!LK_CLE || !LK_SECRET || !LK_URL) throw new Error('LiveKit non configuré');
  if (typeof room !== 'string' || !/^[a-z0-9]{6,40}$/.test(room)) throw refus('Salle invalide');
  if (typeof identite !== 'string' || !identite.startsWith(room + '_') || identite.length > 80 || !/^[a-z0-9_-]+$/i.test(identite)) throw refus('Identité invalide');
  const animateur = /_(seb|ecran\d|cam\d)$/.test(identite);
  const hoteOk = cleValide(room, cle);
  if (animateur && !hoteOk) throw refus(cle ? 'Clé de régie incorrecte' : 'Clé de régie manquante');
  const r = regle(room);
  let droits;
  if (hoteOk) {
    droits = { canSubscribe: true, canPublish: !!publier, canPublishData: !!publier, canUpdateOwnMetadata: !!publier, hidden: !publier };
  } else if (publier) {
    if (r.exclus.has(identite) || r.exclus.has(identite.replace(/ecr$/, ''))) throw refus('L\'animateur t\'a retiré de ce live');
    // le partage d'écran d'un invité déjà admis entre directement
    const admis = /ecr$/.test(identite) && await estAdmis(room, identite.replace(/ecr$/, ''));
    if (!admis && r.verrou) throw refus('L\'animateur a fermé la salle : plus personne ne peut entrer');
    droits = admis
      ? { canSubscribe: true, canPublish: true, canPublishData: true, canUpdateOwnMetadata: true }
      : { canSubscribe: false, canPublish: false, canPublishData: true, canUpdateOwnMetadata: false };   // salle d'attente : peut seulement dire « je suis là »
  } else {
    // regarder sans être vu : seulement l'animateur (clé) ou un invité déjà admis
    if (!(await estAdmis(room, pour))) throw refus('Pas encore admis', { attente: true });
    droits = { canSubscribe: true, canPublish: false, canPublishData: false, canUpdateOwnMetadata: false, hidden: true };
  }
  const maintenant = Math.floor(Date.now() / 1000);
  const token = jwt({
    iss: LK_CLE, sub: identite, name: String(nom || '').slice(0, 40), nbf: maintenant - 10, exp: maintenant + 12 * 3600,
    video: Object.assign({ room, roomJoin: true }, droits),
  });
  return { url: LK_URL, token, attente: !hoteOk && !!publier && !droits.canPublish };
}

/* Commandes de l'animateur sur sa salle (clé de la régie exigée) */
async function commandeSalle(action, { room, cle, identite }) {
  if (typeof room !== 'string' || !/^[a-z0-9]{6,40}$/.test(room) || !cleValide(room, cle)) throw refus('Clé de régie incorrecte');
  const r = regle(room);
  if (action === 'verrouiller') { r.verrou = true; return { verrou: true }; }
  if (action === 'deverrouiller') { r.verrou = false; return { verrou: false }; }
  if (typeof identite !== 'string' || !identite.startsWith(room + '_') || /_(seb|ecran\d|cam\d)$/.test(identite)) throw refus('Identité invalide');
  if (action === 'admettre') {
    r.exclus.delete(identite);
    await lkAdmin('UpdateParticipant', { room, identity: identite, permission: PERM_ADMIS });
    return { ok: true };
  }
  if (action === 'exclure') {
    r.exclus.add(identite);
    for (const id of [identite, identite + 'ecr']) { try { await lkAdmin('RemoveParticipant', { room, identity: id }); } catch (e) { /* déjà parti */ } }
    return { ok: true };
  }
  throw refus('Commande inconnue');
}

/* Liens de téléchargement : signés et valables 1 heure (la clé secrète ne passe jamais dans une adresse) */
function signerTelechargement(nom, ms = 3600000) {
  const exp = Date.now() + ms;
  const sig = crypto.createHmac('sha256', SECRET).update(nom + ':' + exp).digest('hex').slice(0, 32);
  return `/enregistrements/${encodeURIComponent(nom)}?exp=${exp}&sig=${sig}`;
}
function telechargementSigne(nom, url) {
  const exp = +url.searchParams.get('exp'), sig = url.searchParams.get('sig') || '';
  if (!SECRET_VALIDE || !exp || exp < Date.now()) return false;
  return egal(crypto.createHmac('sha256', SECRET).update(nom + ':' + exp).digest('hex').slice(0, 32), sig);
}

/* ----- Serveur HTTP ----- */
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINES.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}
function json(res, code, obj) { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, ENTETES_SURS)); res.end(JSON.stringify(obj)); }
function corps(req) {
  return new Promise((ok, ko) => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(new Error('JSON invalide')); } });
  });
}
/* Sécurité : sans vraie clé secrète, le moteur refuse toute commande (jamais ouvert par défaut). */
const SECRET_VALIDE = typeof SECRET === 'string' && SECRET.length >= 16 && !SECRET.includes('__');
if (!SECRET_VALIDE) console.warn('OBSEB_SECRET absent ou trop court (16 caractères minimum) : les commandes sont refusées');
function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function autorise(req, url) {
  if (!SECRET_VALIDE) return false;
  const h = req.headers.authorization || '';
  return egal(h, `Bearer ${SECRET}`);
}
/* Limite de débit pour les jetons (anti-abus) : 30 demandes par minute et par adresse */
const demandes = new Map();
const ENTETES_SURS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
function tropDeDemandes(req) {
  // derrière Caddy (sur la machine), l'adresse du visiteur est dans X-Forwarded-For ; sinon on ne croit pas cet en-tête
  const local = /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress || '');
  const ip = local ? String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || 'local' : (req.socket.remoteAddress || '');
  const t = Date.now(), l = (demandes.get(ip) || []).filter(x => t - x < 60000);
  l.push(t); demandes.set(ip, l);
  if (demandes.size > 5000) demandes.clear();
  return l.length > 30;
}

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/sante') return json(res, 200, { ok: true });
  if (req.method === 'POST' && url.pathname === '/jeton') {
    if (tropDeDemandes(req)) return json(res, 429, { erreur: 'Trop de demandes, réessaie dans une minute' });
    try { return json(res, 200, await jeton(await corps(req))); }
    catch (e) { return json(res, e.refus ? 403 : 500, { erreur: e.refus ? e.message : 'Erreur du serveur', attente: !!e.attente }); }
  }
  const salle = url.pathname.match(/^\/salle\/(admettre|exclure|verrouiller|deverrouiller)$/);
  if (req.method === 'POST' && salle) {
    if (tropDeDemandes(req)) return json(res, 429, { erreur: 'Trop de demandes, réessaie dans une minute' });
    try { return json(res, 200, await commandeSalle(salle[1], await corps(req))); }
    catch (e) { return json(res, e.refus ? 403 : 502, { erreur: e.refus ? e.message : 'Le serveur vidéo ne répond pas' }); }
  }
  // téléchargement d'un enregistrement : lien signé (valable 1 h) ou clé secrète dans l'en-tête
  const m = url.pathname.match(/^\/enregistrements\/([\w.-]+)$/);
  if (req.method === 'GET' && m && (autorise(req, url) || telechargementSigne(m[1], url))) {
    const f = path.join(DOSSIER, path.basename(m[1]));
    if (!/\.(mkv|mp4)$/.test(f) || !fs.existsSync(f)) return json(res, 404, { erreur: 'Introuvable' });
    res.writeHead(200, Object.assign({ 'Content-Type': f.endsWith('.mp4') ? 'video/mp4' : 'video/x-matroska', 'Content-Length': fs.statSync(f).size,
      'Content-Disposition': `attachment; filename="${path.basename(f)}"` }, ENTETES_SURS));
    return fs.createReadStream(f).pipe(res);
  }
  if (!autorise(req, url)) {
    if (tropDeDemandes(req)) return json(res, 429, { erreur: 'Trop de demandes, réessaie dans une minute' });   // freine les essais de clé
    return json(res, 401, { erreur: 'Clé incorrecte' });
  }
  try {
    if (req.method === 'GET' && url.pathname === '/etat') return json(res, 200, Object.assign({}, etat, { url: undefined }));
    if (req.method === 'POST' && url.pathname === '/demarrer') return json(res, 200, await demarrer(await corps(req)));
    if (req.method === 'POST' && url.pathname === '/arreter') return json(res, 200, await arreter());
    if (req.method === 'GET' && url.pathname === '/enregistrements') return json(res, 200, enregistrements().map(e => Object.assign(e, { lien: signerTelechargement(e.nom) })));
    json(res, 404, { erreur: 'Inconnu' });
  } catch (e) { json(res, 400, { erreur: e.message }); }
}).listen(PORT, ECOUTE, () => journal(`OBSeb Cloud prêt sur ${ECOUTE}:${PORT}`));

process.on('SIGTERM', async () => { await arreter(); process.exit(0); });
