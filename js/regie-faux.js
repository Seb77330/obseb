/* MESA : régie, « Invités de test ».
   Seul dans la régie, Solo, Duo et Plateau se ressemblent tous. On ajoute ici jusqu'à 4 faux invités, avec une fausse
   caméra dessinée et animée (aucune vraie photo), qui se comportent comme de vrais invités : coulisses, mise à l'antenne,
   scènes, cadrages, mode Réaction, volume, son coupé. Rien ne passe par la salle : la sortie les dessine elle-même.
   Garde-fous : badge TEST sur leur image partout (même dans le vrai live) et question au moment de lancer le direct. */
'use strict';

const IC_FAUX = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M17 8v6M14 11h6"/></svg>';

etat.faux = Array.isArray(etat.faux) ? etat.faux.filter(estFaux) : [];
const fauxPresents = () => etat.faux.filter(id => presents.has(id));

function ajouterFaux() {
  const n = [1, 2, 3, 4].find(k => !etat.faux.includes(idFaux(session, k)));
  if (!n) return toast('4 invités de test au maximum');
  const id = idFaux(session, n);
  etat.faux.push(id);
  etat.noms[id] = etat.noms[id] || NOMS_FAUX[n - 1];
  presents.set(id, { vu: Date.now() });
  if (etat.autoAntenne && !etat.onair.includes(id) && etat.onair.length < MAX_ANTENNE) etat.onair.push(id);
  toast(`${etat.noms[id]} (invité de test) est en coulisses`);
  envoyer(); majFauxBarre();
}
function oublierFaux(id) {
  etat.faux = etat.faux.filter(x => x !== id);
  presents.delete(id);
  etat.onair = etat.onair.filter(x => x !== id);
  delete etat.noms[id]; delete etat.vol[id]; delete etat.muet[id]; if (etat.cadre) delete etat.cadre[id];
  if (etat.focus === id) { etat.focus = null; if (etat.layout === 'solo') etat.layout = 'grille'; }
  // une scène qui le nommait le retrouve plus (elle repasse sur « tout le monde » si elle devient vide)
  for (const p of etat.plans || []) if (Array.isArray(p.qui)) { p.qui = p.qui.filter(x => x !== id); if (!p.qui.length) p.qui = 'tous'; }
}
function retirerFaux(id) { oublierFaux(id); envoyer(); majFauxBarre(); }
function retirerTousFaux(silence) {
  const nb = etat.faux.length;
  [...etat.faux].forEach(oublierFaux);
  envoyer(); majFauxBarre();
  if (nb && !silence) toast(nb > 1 ? 'Invités de test retirés' : 'Invité de test retiré');
}

/* La petite barre, juste sous la liste des invités */
const barreFaux = document.createElement('div');
barreFaux.className = 'faux-barre';
barreFaux.innerHTML = `<span class="etiquette" title="De faux invités avec une fausse caméra, pour voir à quoi ressemblent les scènes quand tu es seul. Ils portent toujours un badge TEST.">Invités de test</span>
  <button class="petit faux-plus" title="Ajoute un faux invité en coulisses (4 au maximum). Il se comporte comme un vrai : antenne, scènes, cadrages.">${IC_FAUX}Ajouter</button>
  <button class="petit faux-quatre" title="Ajoute les 4 d'un coup et les met à l'antenne">+ 4 à l'antenne</button>
  <button class="petit faux-retirer" title="Retire tous les invités de test" hidden>Tout retirer</button>`;
$('#liste').before(barreFaux);   // juste sous « Invités », visible sans faire défiler
barreFaux.querySelector('.faux-plus').onclick = ajouterFaux;
barreFaux.querySelector('.faux-quatre').onclick = () => {
  while (etat.faux.length < 4) ajouterFaux();
  for (const id of etat.faux) if (!etat.onair.includes(id) && etat.onair.length < MAX_ANTENNE) etat.onair.push(id);
  toast('4 invités de test à l\'antenne : essaie Solo, Duo, Plateau…');
  envoyer(); majFauxBarre();
};
barreFaux.querySelector('.faux-retirer').onclick = () => retirerTousFaux();
function majFauxBarre() {
  const n = etat.faux.length;
  barreFaux.querySelector('.faux-plus').disabled = n >= 4;
  barreFaux.querySelector('.faux-quatre').hidden = n >= 4;
  barreFaux.querySelector('.faux-retirer').hidden = !n;
  barreFaux.querySelector('.faux-retirer').textContent = n > 1 ? `Tout retirer (${n})` : 'Retirer';
}

/* Ils restent « connectés » tant qu'on ne les retire pas, même après un rechargement de la régie */
function tenirFaux() { for (const id of etat.faux) presents.set(id, { vu: Date.now() }); }
tenirFaux(); setInterval(tenirFaux, 1000);
majFauxBarre(); envoyer();

/* Ils « parlent » chacun leur tour : le vumètre de leur carte bouge (comme dans la sortie) */
{
  let tour = 0;
  setInterval(() => { tour++; }, 2600);
  setInterval(() => {
    const f = etat.faux.filter(id => etat.onair.includes(id) && !etat.muet[id]);
    if (!f.length) return;
    const c = cartes.get(f[tour % f.length]);
    if (c) c.niveau = Math.max(c.niveau, 22 + Math.random() * 18) * (etat.vol[f[tour % f.length]] ?? 1);
  }, 150);
}

/* ----- Garde-fou : jamais de faux invités en direct sans le savoir ----- */
function choixFaux(texte) {
  return new Promise(ok => {
    const f = document.createElement('div');
    f.className = 'confirmation';
    f.innerHTML = `<div class="confirmation-boite" role="alertdialog" aria-modal="true"><p></p>
      <div class="confirmation-boutons trois"><button class="non">Annuler</button><button class="avec">Lancer avec eux</button><button class="oui primaire">Les retirer et lancer</button></div></div>`;
    f.querySelector('p').textContent = texte;
    const fin = v => { f.remove(); document.removeEventListener('keydown', touche); ok(v); };
    const touche = e => { if (e.key === 'Escape') fin('annuler'); };
    f.querySelector('.oui').onclick = () => fin('retirer');
    f.querySelector('.avec').onclick = () => fin('avec');
    f.querySelector('.non').onclick = () => fin('annuler');
    f.addEventListener('click', e => { if (e.target === f) fin('annuler'); });
    document.addEventListener('keydown', touche);
    document.body.appendChild(f);
    f.querySelector('.oui').focus();
  });
}
if (typeof lancerDirect === 'function') {
  const lancerDirectSansTest = lancerDirect;
  // eslint-disable-next-line no-global-assign
  lancerDirect = async ids => {
    const n = fauxPresents().length;
    if (n) {
      const aLAntenne = etat.faux.filter(id => etat.onair.includes(id)).length;
      const r = await choixFaux(`Attention : ${n > 1 ? n + ' invités de test sont' : '1 invité de test est'} encore dans ta régie`
        + (aLAntenne ? ` (${aLAntenne} à l'antenne). Les spectateurs verraient ${aLAntenne > 1 ? 'leurs fausses caméras' : 'sa fausse caméra'}.` : ', en coulisses.')
        + ' Tu veux les retirer avant de lancer le direct ?');
      if (r === 'annuler') return;
      if (r === 'retirer') retirerTousFaux(true);
    }
    return lancerDirectSansTest(ids);
  };
}
