/* MESA : salle d'attente (avec le serveur MESA seulement).
   Un invité qui ouvre le lien arrive en salle d'attente : sans caméra ni micro, il ne voit et n'entend rien.
   L'animateur le fait entrer (ou le refuse) ici ; il peut aussi fermer la salle à clé et exclure quelqu'un.
   Le serveur applique ces décisions lui-même : un lien partagé trop largement ne suffit plus pour entrer. */
'use strict';

const ATTENTE_ACTIVE = !!(session && session.serveur);
const attente = new Map();          // id -> nom des invités qui attendent
const CLE_ADMIS = 'obseb:admis:' + session.room;
const admis = new Set((() => { try { return JSON.parse(sessionStorage.getItem(CLE_ADMIS) || '[]'); } catch (e) { return []; } })());
const refuses = new Set();
let salleFermee = false;
const sauverAdmis = () => { try { sessionStorage.setItem(CLE_ADMIS, JSON.stringify([...admis])); } catch (e) { /* rien */ } };

async function commandeSalle(action, identite) {
  const r = await fetch(String(session.serveur).replace(/\/+$/, '') + '/salle/' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: session.room, cle, identite })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || 'Le serveur MESA ne répond pas');
  return j;
}

/* Appelée par arrivee() dans regie.js : true = cette personne reste dehors pour l'instant */
function enAttente(id, label) {
  if (!ATTENTE_ACTIVE || /_seb$/.test(id) || estCamLocale(id) || /_ecran\d$/.test(id)) return false;
  const base = id.replace(/ecr$/, '');
  if (admis.has(base)) return false;
  if (refuses.has(base)) return true;
  if (base !== id) return true;                  // l'écran d'un invité pas encore admis : attend avec lui
  if (!attente.has(id)) {
    attente.set(id, String(label || '').trim().slice(0, 28) || 'Invité');
    toast(`${attente.get(id)} attend en salle d'attente`);
  } else if (label) attente.set(id, String(label).trim().slice(0, 28));
  majAttente();
  return true;
}

const boite = document.createElement('div');
boite.id = 'salle-attente'; boite.hidden = !ATTENTE_ACTIVE;
boite.innerHTML = `<button type="button" class="sa-pastille" title="Salle d'attente : qui peut entrer dans ton live">🛡️ <span>Salle</span><b hidden></b></button>
  <div class="sa-volet" hidden role="dialog" aria-label="Salle d'attente">
    <div class="sa-tete"><b>Salle d'attente</b><button type="button" class="sa-fermer" title="Fermer">✕</button></div>
    <div class="sa-liste"></div>
    <details class="sa-dedans"><summary>Dans le studio</summary><div class="sa-liste-admis"></div></details>
    <label class="sa-verrou"><input type="checkbox"> Fermer la salle à clé <small>(plus personne ne peut entrer)</small></label>
  </div>`;
document.body.appendChild(boite);
const volet = boite.querySelector('.sa-volet');
boite.querySelector('.sa-pastille').onclick = () => { volet.hidden = !volet.hidden; majAttente(); };
boite.querySelector('.sa-fermer').onclick = () => { volet.hidden = true; };

function ligneSalle(id, nom, boutons) {
  const el = document.createElement('div'); el.className = 'sa-ligne';
  const n = document.createElement('span'); n.textContent = nom; el.appendChild(n);
  for (const [texte, classe, action] of boutons) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'petit ' + classe; b.textContent = texte;
    b.onclick = async () => { b.disabled = true; try { await action(); } catch (e) { toast(e.message); b.disabled = false; } };
    el.appendChild(b);
  }
  return el;
}
async function faireEntrer(id) {
  await commandeSalle('admettre', id);
  const nom = attente.get(id); attente.delete(id); admis.add(id); refuses.delete(id); sauverAdmis();
  majAttente(); arrivee(id, nom);
}
async function exclure(id) {
  const nom = attente.get(id) || etat.noms[id] || 'Invité';
  if (admis.has(id) && !(await confirmer(`Exclure ${nom} du live ? Il ne pourra pas revenir avec ce lien sous ce nom.`, { oui: 'Exclure' }))) return;
  await commandeSalle('exclure', id);
  attente.delete(id); admis.delete(id); refuses.add(id); sauverAdmis();
  presents.delete(id); presents.delete(id + 'ecr');
  etat.onair = etat.onair.filter(x => x !== id && x !== id + 'ecr');
  envoyer(); majAttente(); toast(`${nom} est sorti du live`);
}

function majAttente() {
  if (!ATTENTE_ACTIVE) return;
  const pastille = boite.querySelector('.sa-pastille b');
  pastille.hidden = !attente.size; pastille.textContent = attente.size;
  boite.classList.toggle('quelquun', attente.size > 0);
  if (attente.size && volet.hidden) volet.hidden = false;      // quelqu'un attend : le volet s'ouvre tout seul
  const liste = boite.querySelector('.sa-liste'); liste.innerHTML = '';
  if (!attente.size) { const p = document.createElement('p'); p.className = 'aide'; p.textContent = salleFermee ? 'La salle est fermée à clé.' : 'Personne n\'attend.'; liste.appendChild(p); }
  for (const [id, nom] of attente) liste.appendChild(ligneSalle(id, nom, [['Faire entrer', 'primaire', () => faireEntrer(id)], ['Refuser', '', () => exclure(id)]]));
  const dedans = boite.querySelector('.sa-liste-admis'); dedans.innerHTML = '';
  const ici = [...admis].filter(id => presents.has(id));
  if (!ici.length) { const p = document.createElement('p'); p.className = 'aide'; p.textContent = 'Aucun invité pour l\'instant.'; dedans.appendChild(p); }
  for (const id of ici) dedans.appendChild(ligneSalle(id, etat.noms[id] || 'Invité', [['Exclure', 'rouge', () => exclure(id)]]));
}

boite.querySelector('.sa-verrou input').onchange = async e => {
  const voulu = e.target.checked;
  try { await commandeSalle(voulu ? 'verrouiller' : 'deverrouiller'); salleFermee = voulu; toast(voulu ? 'Salle fermée : plus personne ne peut entrer' : 'Salle rouverte'); }
  catch (err) { e.target.checked = !voulu; toast(err.message); }
  majAttente();
};

/* ----- Clés de diffusion : elles restent dans ce navigateur seulement (jamais envoyées ailleurs qu'au serveur du direct).
   Sur un ordinateur partagé, un bouton les efface d'un coup. ----- */
(function boutonOublierCles() {
  const zone = document.querySelector('[data-onglet="comptes"]');
  if (!zone) return;
  const bloc = document.createElement('div'); bloc.className = 'aide'; bloc.style.cssText = 'margin-top:14px;display:grid;gap:8px';
  const txt = document.createElement('span'); txt.className = 'cles-info';
  txt.textContent = '🔒 Tes clés restent sur cet ordinateur, dans ce navigateur. Ordinateur partagé ? Efface-les après le live.';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'petit rouge'; b.textContent = 'Effacer mes clés de cet ordinateur';
  b.style.justifySelf = 'start'; b.title = 'Tes clés restent sur cet ordinateur, dans ce navigateur. Ordinateur partagé ? Efface-les après le live.';
  b.onclick = async () => {
    if (!(await confirmer('Effacer toutes tes clés de stream (et la clé YouTube du chat) de cet ordinateur ? Il faudra les recoller au prochain live.', { oui: 'Effacer' }))) return;
    try { localStorage.removeItem('studioSeb:comptes'); localStorage.removeItem('studioSeb:cleYoutube'); } catch (e) { /* rien */ }
    toast('Clés effacées'); setTimeout(() => location.reload(), 800);
  };
  bloc.append(txt, b); zone.appendChild(bloc);
})();
