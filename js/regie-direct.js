/* OBSeb : démarrer et arrêter le direct, en général ou plateforme par plateforme.
   Les scènes (Intro, Plateau, Écran partagé, Fin) ne lancent JAMAIS le direct : on peut tout régler sans risque.
   Le direct ne démarre qu'avec ce bouton, après confirmation. */
'use strict';

const pop = $('#direct-pop');
const btnDirect = $('#btn-direct');
const serveurBranche = () => !!session.serveur;

function plateformesPretes() {
  return PLATEFORMES_LIVE.map(p => ({ p, c: compte(p) })).filter(({ c }) => c.actif && c.serveur && c.cle);
}

function demarrerDirect(ids) {
  etat.direct = { debut: Date.now(), plateformes: ids, coupees: [] };
  envoyer(); majDirect(); pop.hidden = true;
  toast(ids.length ? `Direct démarré sur ${ids.length} plateforme${ids.length > 1 ? 's' : ''}` : 'Direct démarré (minuteur lancé)');
}
function arreterDirect() {
  if (!etat.direct) return;
  etat.direct = null;
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
  envoyer(); majDirect(); dessinerPop();
}

function ligne(p, droite) {
  return `<div class="ligne-pf"><i style="background:${p.couleur};color:${p.texte || '#fff'}">${p.court}</i><b>${esc(p.nom)}</b>${droite}</div>`;
}
function dessinerPop() {
  const d = etat.direct;
  const noteObs = serveurBranche() ? '' : '<p class="aide" style="margin:10px 0 0">Pour l\'instant, c\'est OBS qui envoie l\'image aux plateformes : démarre et arrête aussi le direct dans OBS. Avec le serveur OBSeb, ce bouton le fera tout seul.</p>';
  if (!d) {
    const pretes = plateformesPretes();
    pop.innerHTML = `<h4>Démarrer le direct ?</h4>
      <p class="aide" style="margin:0 0 8px">Les spectateurs te verront dès maintenant. Tu peux régler les scènes et le quiz avant : rien ne part tant que tu n'as pas cliqué ici.</p>
      ${pretes.length ? pretes.map(({ p, c }) => ligne(p, `<small>${c.format === 'vertical' ? 'vertical' : 'horizontal'}</small><input type="checkbox" data-pf="${p.id}" checked>`)).join('')
        : '<p class="aide" style="margin:0">Aucune plateforme configurée dans l\'onglet Diffusion.</p>'}
      ${noteObs}
      <div class="menu-bas">
        <button class="rouge" id="pop-go">Démarrer le direct</button>
        <button id="pop-annuler">Annuler</button>
      </div>`;
    $('#pop-go').onclick = () => demarrerDirect([...pop.querySelectorAll('[data-pf]:checked')].map(x => x.dataset.pf));
  } else {
    const liste = d.plateformes.map(id => PLATEFORMES_LIVE.find(p => p.id === id)).filter(Boolean);
    pop.innerHTML = `<h4>En direct depuis ${hms(Date.now() - d.debut)}</h4>
      ${liste.length ? liste.map(p => {
        const coupe = d.coupees.includes(p.id);
        return ligne(p, `<small class="${coupe ? '' : 'on'}">${coupe ? 'coupé' : '● en direct'}</small><button class="petit" data-bascule="${p.id}">${coupe ? 'Relancer' : 'Couper'}</button>`);
      }).join('') : '<p class="aide" style="margin:0">Aucune plateforme suivie (direct envoyé par OBS).</p>'}
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

function majDirect() {
  const d = etat.direct;
  btnDirect.classList.toggle('on', !!d);
  btnDirect.querySelector('span').textContent = d ? `Direct · ${hms(Date.now() - d.debut)}` : 'Démarrer le direct';
  btnDirect.title = d ? 'Couper une plateforme ou arrêter le direct' : 'Rien ne part tant que tu ne cliques pas ici';
  const badge = $('#badge-scene');
  badge.classList.toggle('rouge-direct', !!d);
  badge.textContent = (d ? 'En direct · ' : 'Hors direct · ') + ({ intro: 'Intro', live: 'Plateau', partage: 'Écran partagé', fin: 'Fin' }[etat.scene] || '');
}
btnDirect.onclick = e => { e.stopPropagation(); if (pop.hidden) { dessinerPop(); pop.hidden = false; } else pop.hidden = true; };
pop.addEventListener('click', e => e.stopPropagation());   // les boutons du menu se redessinent : le clic ne doit pas le fermer
document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('.direct-zone')) pop.hidden = true; });
setInterval(() => { majDirect(); if (!pop.hidden && etat.direct) { const h = pop.querySelector('h4'); if (h) h.textContent = `En direct depuis ${hms(Date.now() - etat.direct.debut)}`; } }, 1000);
majDirect();
