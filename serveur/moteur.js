#!/usr/bin/env node
/* OBSeb Cloud : le moteur du direct.
   Ouvre la sortie OBSeb dans un Chrome invisible (écran virtuel 1920x1080),
   capture image + son, encode en 1080p et envoie à YouTube, tout en enregistrant le live.

   API (toutes les requêtes portent l'en-tête « Authorization: Bearer <OBSEB_SECRET> ») :
     GET  /etat                     état du direct
     POST /demarrer   {url, rtmp}   lance le direct (rtmp = adresse complète avec la clé, optionnelle)
     POST /arreter                  arrête le direct et finalise l'enregistrement
     GET  /enregistrements          liste des fichiers
     GET  /enregistrements/<nom>    téléchargement
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
  if (!/^https?:\/\//.test(url || '')) throw new Error('Adresse de sortie invalide');
  if (rtmp && !/^rtmps?:\/\//.test(rtmp)) throw new Error('Adresse YouTube invalide');
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
   Invités et spectateurs : il suffit de connaître la salle (nom aléatoire, présent dans leur lien).
   Animateur (…_seb), ses écrans (…_ecran1-4) et ses autres caméras (…_cam2-4) : la clé de la régie est exigée ; la première clé vue
   pour une salle devient la bonne (personne d'autre ne peut ensuite se faire passer pour l'animateur). */
let salles = {};
try { salles = JSON.parse(fs.readFileSync(FICHIER_SALLES, 'utf8')); } catch (e) { /* rien */ }
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt(charge) {
  const tete = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corps = b64url(JSON.stringify(charge));
  const sig = crypto.createHmac('sha256', LK_SECRET).update(`${tete}.${corps}`).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${tete}.${corps}.${sig}`;
}
function jeton({ room, identite, nom, publier, cle }) {
  if (!LK_CLE || !LK_SECRET || !LK_URL) throw new Error('LiveKit non configuré');
  if (!/^[a-z0-9]{6,40}$/.test(room || '')) throw new Error('Salle invalide');
  if (typeof identite !== 'string' || !identite.startsWith(room + '_') || identite.length > 80) throw new Error('Identité invalide');
  const animateur = /_(seb|ecran\d|cam\d)$/.test(identite);
  if (animateur) {
    if (!cle || typeof cle !== 'string') throw new Error('Clé de régie manquante');
    const emp = crypto.createHash('sha256').update(room + ':' + cle).digest('hex');
    if (!salles[room]) { salles[room] = emp; try { fs.writeFileSync(FICHIER_SALLES, JSON.stringify(salles)); } catch (e) { /* rien */ } }
    else if (salles[room] !== emp) throw new Error('Clé de régie incorrecte');
  }
  const maintenant = Math.floor(Date.now() / 1000);
  const token = jwt({
    iss: LK_CLE, sub: identite, name: String(nom || '').slice(0, 40), nbf: maintenant - 10, exp: maintenant + 12 * 3600,
    video: {
      room, roomJoin: true, canSubscribe: true,
      canPublish: !!publier, canPublishData: !!publier, canUpdateOwnMetadata: !!publier,
      hidden: !publier,                 // la sortie et les vignettes sont invisibles pour les autres
    },
  });
  return { url: LK_URL, token };
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
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
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
  return egal(h, `Bearer ${SECRET}`) || egal(url.searchParams.get('cle') || '', SECRET);   // ?cle= pour les liens de téléchargement
}
/* Limite de débit pour les jetons (anti-abus) : 30 demandes par minute et par adresse */
const demandes = new Map();
function tropDeDemandes(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
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
    try { return json(res, 200, jeton(await corps(req))); } catch (e) { return json(res, 403, { erreur: e.message }); }
  }
  if (!autorise(req, url)) return json(res, 401, { erreur: 'Clé incorrecte' });
  try {
    if (req.method === 'GET' && url.pathname === '/etat') return json(res, 200, etat);
    if (req.method === 'POST' && url.pathname === '/demarrer') return json(res, 200, await demarrer(await corps(req)));
    if (req.method === 'POST' && url.pathname === '/arreter') return json(res, 200, await arreter());
    if (req.method === 'GET' && url.pathname === '/enregistrements') return json(res, 200, enregistrements());
    const m = url.pathname.match(/^\/enregistrements\/([\w.-]+)$/);
    if (req.method === 'GET' && m) {
      const f = path.join(DOSSIER, path.basename(m[1]));
      if (!fs.existsSync(f)) return json(res, 404, { erreur: 'Introuvable' });
      res.writeHead(200, { 'Content-Type': 'video/x-matroska', 'Content-Length': fs.statSync(f).size,
        'Content-Disposition': `attachment; filename="${path.basename(f)}"` });
      return fs.createReadStream(f).pipe(res);
    }
    json(res, 404, { erreur: 'Inconnu' });
  } catch (e) { json(res, 400, { erreur: e.message }); }
}).listen(PORT, () => journal(`OBSeb Cloud prêt sur le port ${PORT}`));

process.on('SIGTERM', async () => { await arreter(); process.exit(0); });
