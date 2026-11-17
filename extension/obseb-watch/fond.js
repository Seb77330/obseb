/* Le centre de l'extension : relie l'onglet du film (ou VLC) aux pages du studio.
   Rien ne sort du navigateur : la position du film va seulement de l'onglet du film à la page du studio ouverte à côté. */
'use strict';

const ponts = new Set();       // pages du studio ouvertes (régie, page invité)
const lecteurs = new Set();    // cadres de l'onglet du film
let dernierFilm = null;        // { film, vu }
const VLC = 'http://127.0.0.1:8080/requests/status.json';

const lire = cles => chrome.storage.local.get(cles);
const ecrire = o => chrome.storage.local.set(o);

function diffuser(film) {
  dernierFilm = { film, vu: Date.now() };
  for (const p of ponts) { try { p.postMessage({ type: 'film', film }); } catch (e) { ponts.delete(p); } }
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'pont') {
    ponts.add(port);
    port.onDisconnect.addListener(() => ponts.delete(port));
    port.onMessage.addListener(m => { if (m && m.type === 'page') pageStudio(port, m); });
  } else if (port.name === 'lecteur') {
    lecteurs.add(port);
    port.onDisconnect.addListener(() => lecteurs.delete(port));
    port.onMessage.addListener(async m => {
      const { mode, onglet } = await lire(['mode', 'onglet']);
      if (mode !== 'onglet' || !port.sender || !port.sender.tab || port.sender.tab.id !== onglet) return;
      if (m.type === 'film') diffuser(m.film);
      if (m.type === 'saut-netflix') sautNetflix(onglet, m.pos);
    });
  }
});

/* Une page du studio se signale (toutes les secondes ou deux). Chez un invité, elle donne aussi où le film doit en être. */
async function pageStudio(port, m) {
  const { mode, mdp } = await lire(['mode', 'mdp']);
  if (!mode) { try { port.postMessage({ type: 'film', film: null }); } catch (e) { /* rien */ } return; }   // « extension là, rien de suivi »
  if (mode === 'vlc') {
    const etat = await vlc('', mdp);
    try { port.postMessage({ type: 'film', film: etat }); } catch (e) { /* rien */ }
    if (m.cible && etat) {
      if (m.cible.lecture !== etat.lecture) await vlc(m.cible.lecture ? '?command=pl_forceresume' : '?command=pl_forcepause', mdp);
      if (Math.abs(etat.pos - m.cible.pos) > 2) await vlc('?command=seek&val=' + Math.round(m.cible.pos), mdp);
    }
    return;
  }
  // mode « onglet » : le film vient de lecteur.js ; s'il se tait (onglet fermé), on le dit à la page
  if (!dernierFilm || Date.now() - dernierFilm.vu > 4000) { try { port.postMessage({ type: 'film', film: null }); } catch (e) { /* rien */ } }
  if (m.cible) for (const l of lecteurs) { try { l.postMessage({ type: 'cible', cible: m.cible }); } catch (e) { lecteurs.delete(l); } }
}

/* VLC : son interface web locale (à activer dans les préférences de VLC) */
async function vlc(commande, mdp) {
  try {
    const r = await fetch(VLC + commande, { headers: { Authorization: 'Basic ' + btoa(':' + (mdp || '')) }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !(j.length > 0)) return null;
    const meta = (j.information && j.information.category && j.information.category.meta) || {};
    const titre = String(meta.title || meta.filename || '').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 60);
    return { pos: typeof j.position === 'number' ? j.position * j.length : j.time, lecture: j.state === 'playing', duree: j.length, titre, site: 'VLC' };
  } catch (e) { return null; }
}

/* Netflix : le saut passe par le lecteur de Netflix (dans la page elle-même) */
function sautNetflix(tabId, pos) {
  chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', args: [Math.round(pos * 1000)],
    func: ms => {
      try {
        const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
        vp.getVideoPlayerBySessionId(vp.getAllPlayerSessionIds()[0]).seek(ms);
      } catch (e) { /* lecteur pas prêt */ }
    },
  }).catch(() => {});
}

/* Ordres de la petite fenêtre de l'extension */
chrome.runtime.onMessage.addListener((m, _exp, repondre) => {
  (async () => {
    if (m.type === 'suivre-onglet') {
      await arreter();
      try {
        await chrome.scripting.executeScript({ target: { tabId: m.tabId, allFrames: true }, files: ['lecteur.js'] });
        await ecrire({ mode: 'onglet', onglet: m.tabId, nomOnglet: String(m.titre || '').slice(0, 80) });
        repondre({ ok: true });
      } catch (e) { repondre({ ok: false, erreur: 'Impossible de lire cette page. Ouvre le film dans un onglet normal puis réessaie.' }); }
    } else if (m.type === 'suivre-vlc') {
      await arreter();
      await ecrire({ mdp: m.mdp || '' });
      const etat = await vlc('', m.mdp);
      if (etat) { await ecrire({ mode: 'vlc' }); repondre({ ok: true, etat }); }
      else repondre({ ok: false, erreur: 'VLC ne répond pas. Vérifie que l\'interface Web est cochée, que le mot de passe est le bon et qu\'un film est ouvert.' });
    } else if (m.type === 'arreter') { await arreter(); repondre({ ok: true }); }
    else if (m.type === 'etat') {
      const { mode, nomOnglet, mdp } = await lire(['mode', 'nomOnglet', 'mdp']);
      const film = mode === 'vlc' ? await vlc('', mdp) : (dernierFilm && Date.now() - dernierFilm.vu < 4000 ? dernierFilm.film : null);
      repondre({ mode: mode || null, nomOnglet, film, studio: ponts.size });
    }
  })();
  return true;      // la réponse arrive plus tard
});
async function arreter() {
  for (const l of lecteurs) { try { l.postMessage({ type: 'arret' }); } catch (e) { /* rien */ } }
  lecteurs.clear(); dernierFilm = null;
  await chrome.storage.local.remove(['mode', 'onglet', 'nomOnglet']);
  for (const p of ponts) { try { p.postMessage({ type: 'film', film: null }); } catch (e) { /* rien */ } }
}
/* L'onglet du film est fermé : on arrête de suivre */
chrome.tabs.onRemoved.addListener(async id => { const { mode, onglet } = await lire(['mode', 'onglet']); if (mode === 'onglet' && onglet === id) arreter(); });
