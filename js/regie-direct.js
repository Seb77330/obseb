/* OBSeb : démarrer et arrêter le direct, en général ou plateforme par plateforme.
   Les scènes (Intro, Plateau, Écran partagé, Fin) ne lancent JAMAIS le direct : on peut tout régler sans risque.
   Le direct ne démarre qu'avec ce bouton, après confirmation. */
'use strict';

const pop = $('#direct-pop');
const btnDirect = $('#btn-direct');
const serveurBranche = () => !!session.serveur;

function plateformesPretes() {
  return PLATEFORMES_LIVE.map(p => ({ p, c: compte(p) })).filter(({ c }) => comptePret(c));
}

function demarrerDirect(ids) {
  etat.direct = { debut: Date.now(), plateformes: ids, coupees: [] };
  envoyer(); majDirect(); pop.hidden = true;
  setTimeout(envoyer, 1000);      // la musique d'intro réglée « avec le direct » part une seconde après
  toast(ids.length ? `Direct démarré sur ${ids.length} plateforme${ids.length > 1 ? 's' : ''}` : 'Direct démarré (minuteur lancé)');
}
/* Sans OBS : le check-up a choisi le chemin ; si c'est le navigateur, la fenêtre de diffusion part en même temps que le direct */
async function lancerDirect(ids) {
  const go = $('#pop-go');
  if (go) { go.disabled = true; go.textContent = 'Connexion…'; }
  try { if (typeof diffusionDemarrer === 'function') await diffusionDemarrer(ids); }
  catch (e) { toast(e.message); if (go) { go.disabled = false; go.textContent = 'Démarrer le direct'; } return; }
  demarrerDirect(ids);
}
function arreterDirect() {
  if (!etat.direct) return;
  etat.direct = null;
  if (typeof diffusionArreter === 'function') diffusionArreter();
  noterLiveTermine();       // seul un vrai direct arrêté arrive dans « Lives terminés »
  if (etat.scene !== 'fin') changerScene('fin'); else envoyer();
  majDirect(); pop.hidden = true;
}
function basculerPlateforme(id) {
  const d = etat.direct; if (!d) return;
  const i = d.coupees.indexOf(id);
  if (i >= 0) d.coupees.splice(i, 1); else d.coupees.push(id);
  // plus aucune plateforme en direct : c'est la fin du direct
  if (d.plateformes.length && d.plateformes.every(x => d.coupees.includes(x))) {
    if (confirm('Toutes les plateformes sont coupées. Arrêter le direct et afficher l\'écran de fin ?')) return arreterDirect();
  }
  if (typeof diffusionMaj === 'function') diffusionMaj(d.plateformes.filter(x => !d.coupees.includes(x)));
  envoyer(); majDirect(); dessinerPop();
}

function ligne(p, droite) {
  return `<div class="ligne-pf"><i style="background:${p.couleur};color:${p.texte || '#fff'}">${p.court}</i><b>${esc(p.nom)}</b>${droite}</div>`;
}
/* La porte : sept chevrons autour d'un anneau, qui s'enclenchent un par un quand on s'apprête à démarrer */
function dessinPorte() {
  const R = 50, c = 62;
  let ch = '';
  for (let i = 0; i < 7; i++) {
    const a = i * 360 / 7;
    ch += `<path class="chev" data-i="${i}" transform="rotate(${a} ${c} ${c})" d="M${c - 8} ${c - R - 9}h16l-4.5 13h-7z"/>`;
  }
  return `<div class="porte" id="porte"><svg viewBox="0 0 124 124" aria-hidden="true">
      <circle class="horizon" cx="${c}" cy="${c}" r="${R - 5}"/><circle class="anneau" cx="${c}" cy="${c}" r="${R}"/><circle class="anneau2" cx="${c}" cy="${c}" r="${R - 6}"/>${ch}
      <text class="compte" id="porte-compte" x="${c}" y="${c}">0/7</text></svg>
    <div class="porte-txt" id="porte-txt"><b>Vérification…</b></div></div>`;
}
let porteMinuteurs = [];
function animerPorte() {
  porteMinuteurs.forEach(clearTimeout); porteMinuteurs = [];
  if (typeof chevrons !== 'function' || !$('#porte')) return;
  const liste = chevrons(), porte = $('#porte');
  let n = 0;
  liste.forEach((c, i) => porteMinuteurs.push(setTimeout(() => {
    const el = porte.querySelector(`.chev[data-i="${i}"]`); if (!el) return;
    el.classList.add(c.ok ? 'on' : 'non');
    if (c.ok) n++;
    $('#porte-compte').textContent = `${n}/7`;
    $('#porte-txt').innerHTML = `<b>Chevron ${i + 1} ${c.ok ? 'enclenché' : 'en attente'}</b>${esc(c.nom)}`;
  }, 160 + i * 190)));
  porteMinuteurs.push(setTimeout(() => {
    if (!$('#porte')) return;
    const rates = liste.filter(c => !c.ok);
    porte.classList.toggle('ouverte', !rates.length);
    $('#porte-txt').innerHTML = rates.length
      ? `<b>${7 - rates.length} chevrons sur 7</b>À vérifier avant de partir :<ul>${rates.map(c => `<li><i>${esc(c.nom)}</i> · ${esc(c.aide || c.texte)}</li>`).join('')}</ul>`
      : '<b>Chevron 7 verrouillé</b>Tout est prêt, tu peux y aller.';
  }, 160 + 7 * 190 + 150));
}
function dessinerPop() {
  const d = etat.direct;
  // l'ancienne note « c'est OBS qui envoie » ne s'affiche plus que si le navigateur ne peut rien envoyer lui-même
  const envoiNav = () => typeof preparationEnvoi === 'function' && preparationEnvoi(d ? d.plateformes : plateformesPretes().map(x => x.p.id)).formatsNav.length > 0;
  const noteObs = serveurBranche() || envoiNav() ? '' : '<p class="aide" style="margin:10px 0 0">Si tu utilises OBS, c\'est lui qui envoie l\'image : démarre et arrête aussi le direct dans OBS.</p>';
  if (!d) {
    const pretes = plateformesPretes();
    pop.innerHTML = `<h4>Démarrer le direct ?</h4>
      ${dessinPorte()}
      <p class="aide" style="margin:0 0 8px">Les spectateurs te verront dès que tu cliques. Rien ne part avant.</p>
      ${pretes.length ? pretes.map(({ p, c }) => ligne(p, `<small>${nomFormat(c.format)}</small><input type="checkbox" data-pf="${p.id}" checked>`)).join('')
        : '<p class="aide" style="margin:0">Aucune plateforme configurée dans l\'onglet Diffusion.</p>'}
      ${typeof blocEnvoi === 'function' ? blocEnvoi(pretes.map(x => x.p.id)) : ''}
      ${noteObs}
      <div class="menu-bas">
        <button class="rouge" id="pop-go">Démarrer le direct</button>
        <button id="pop-annuler">Annuler</button>
      </div>`;
    $('#pop-go').onclick = () => lancerDirect([...pop.querySelectorAll('[data-pf]:checked')].map(x => x.dataset.pf));
    if (typeof brancherBlocEnvoi === 'function') {
      brancherBlocEnvoi(pop, () => { pop.hidden = false; dessinerPop(); });
      majBoutonGo($('#pop-go'));
      pop.querySelectorAll('[data-pf]').forEach(c => c.onchange = () => majEnvoiDirect());
    }
    animerPorte();
  } else {
    const liste = d.plateformes.map(id => PLATEFORMES_LIVE.find(p => p.id === id)).filter(Boolean);
    pop.innerHTML = `<h4>En direct depuis ${hms(Date.now() - d.debut)}</h4>
      ${liste.length ? liste.map(p => {
        const coupe = d.coupees.includes(p.id);
        return ligne(p, `<small class="${coupe ? '' : 'on'}">${coupe ? 'coupé' : '● en direct'}</small><button class="petit" data-bascule="${p.id}">${coupe ? 'Relancer' : 'Couper'}</button>`);
      }).join('') : '<p class="aide" style="margin:0">Aucune plateforme suivie (direct envoyé par OBS).</p>'}
      ${typeof suiviEnvoi === 'function' ? suiviEnvoi() : ''}
      ${noteObs}
      <div class="menu-bas">
        <button class="rouge" id="pop-stop">Arrêter le direct partout</button>
        <button id="pop-annuler">Fermer</button>
      </div>`;
    pop.querySelectorAll('[data-bascule]').forEach(b => b.onclick = () => basculerPlateforme(b.dataset.bascule));
    $('#pop-stop').onclick = () => { if (confirm('Arrêter le direct sur toutes les plateformes ?')) arreterDirect(); };
  }
  $('#pop-annuler').onclick = () => { pop.hidden = true; };
}

let directAffiche = null;
function majDirect() {
  const d = etat.direct;
  if (!!d !== directAffiche) { directAffiche = !!d; for (const id of cartes.keys()) majCarte(id); }
  btnDirect.classList.toggle('on', !!d);
  document.body.classList.toggle('en-direct', !!d);
  const sp = btnDirect.querySelector('span');
  sp.textContent = d ? `EN DIRECT ${hms(Date.now() - d.debut)}` : 'Démarrer le direct';
  sp.dataset.court = d ? hms(Date.now() - d.debut) : 'Direct';   // sur téléphone, le bouton est plus court
  sp.style.fontFamily = d ? '' : 'inherit';
  btnDirect.title = d ? 'Couper une plateforme ou arrêter le direct' : 'Rien ne part tant que tu ne cliques pas ici';
  const badge = $('#badge-scene');
  badge.classList.toggle('rouge-direct', !!d);
  badge.textContent = (d ? 'En direct · ' : 'Hors direct · ') + ({ intro: 'Intro', live: (typeof planActif === 'function' && planActif().nom) || 'Plateau', watch: 'Watch Party', fin: 'Outro' }[etat.scene] || '');
}
btnDirect.onclick = e => {
  e.stopPropagation();
  if (!pop.hidden) { pop.hidden = true; return; }
  const ouvrir = () => { dessinerPop(); pop.hidden = false; };
  // première fois : le check-up passe avant (une seule fois par quart d'heure), puis le menu s'ouvre
  if (!etat.direct && typeof lancerCheckup === 'function' && !checkup && plateformesPretes().length) return lancerCheckup(ouvrir);
  ouvrir();
};
pop.addEventListener('click', e => e.stopPropagation());   // les boutons du menu se redessinent : le clic ne doit pas le fermer
document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('.direct-zone')) pop.hidden = true; });
setInterval(() => { majDirect(); if (!pop.hidden && etat.direct) { const h = pop.querySelector('h4'); if (h) h.textContent = `En direct depuis ${hms(Date.now() - etat.direct.debut)}`; } }, 1000);
majDirect();
