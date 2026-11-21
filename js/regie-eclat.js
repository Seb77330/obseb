/* MESA : régie, « Webcams sombres ».
   Chaque personne mesure la lumière de son image dans ses coulisses (une toute petite copie, rien n'est envoyé) ;
   si sa pièce est sombre, son image est éclaircie à l'affichage, dans la régie comme dans le live.
   Tu peux tout couper dans l'onglet Titres (« Éclaircir les webcams sombres »). */
'use strict';
(() => {
  if (typeof cartes === 'undefined') return;
  etat.eclat = etat.eclat && typeof etat.eclat === 'object' ? etat.eclat : {};
  if (typeof etat.eclairer !== 'boolean') etat.eclairer = true;

  function appliquer() {
    for (const [id, c] of cartes) {
      if (!c.iframe) continue;
      const f = etat.eclairer ? filtreEclat(facteurEclatSur(etat.eclat[id])) : '';
      if (c.iframe.style.filter !== f) c.iframe.style.filter = f;
    }
    const moi = etat.eclairer ? filtreEclat(facteurEclatSur(etat.eclat[ID_HOTE])) : '';   // ta caméra, sous tes yeux
    if (maCamera && maCamera.style.filter !== moi) maCamera.style.filter = moi;
  }
  function eclatRecu(id, v) {
    const f = facteurEclatSur(v);
    if ((etat.eclat[id] || 1) === f) return;
    if (f > 1) etat.eclat[id] = f; else delete etat.eclat[id];
    appliquer(); envoyerBientot();
  }
  window.eclatRecu = eclatRecu;

  addEventListener('message', ev => {
    if (ev.source !== maCamera.contentWindow) return;
    const s = ev.data && ev.data.dataReceived && ev.data.dataReceived.studioSebSalut;
    if (!s || typeof s.id !== 'string' || !s.id.startsWith(session.room + '_') || (typeof ev.data.streamID === 'string' && ev.data.streamID !== s.id)) return;
    if ('eclat' in s) eclatRecu(s.id, s.eclat);
  });

  if (typeof appHote !== 'undefined' && appHote) eclatRecu(ID_HOTE, appHote.eclat);   // ta caméra a pu démarrer avant ce fichier
  setInterval(appliquer, 1500);   // une carte qui vient d'arriver reçoit son filtre

  const bloc = document.createElement('details');
  bloc.className = 'pli'; bloc.id = 'pli-eclat';
  bloc.innerHTML = `<summary>Webcams sombres</summary>
    <label class="ligne-case" title="La lumière de chaque image est mesurée dans les coulisses de la personne, avant son entrée"><input type="checkbox" id="eclat-actif"> <span><b>Éclaircir les webcams sombres</b></span></label>
    <p class="aide" id="eclat-info"></p>`;
  const avant = $('#pli-mains') || $('#pli-parole');
  if (avant) avant.after(bloc); else { const o = $('[data-onglet="habillage"]'); if (o) o.appendChild(bloc); }
  const info = () => {
    const n = Object.keys(etat.eclat).filter(id => cartes.has(id)).length;
    $('#eclat-info').textContent = n ? `${n} image${n > 1 ? 's' : ''} éclaircie${n > 1 ? 's' : ''} en ce moment.` : 'Aucune image n\'a besoin d\'être éclaircie pour l\'instant.';
  };
  bloc.addEventListener('toggle', info);
  $('#eclat-actif').checked = etat.eclairer;
  $('#eclat-actif').onchange = e => { etat.eclairer = e.target.checked; appliquer(); envoyer(); };
})();
