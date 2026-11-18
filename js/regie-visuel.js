/* OBSeb : régie, bouton « Visuel ».
   Le visuel du live (thème, couleurs, police, logo, titre) se choisit ici, avant le direct, dans la page « Visuel du live »
   ouverte par-dessus la régie (index.html?visuel=<salle>&embed=1). Après « Appliquer », la régie se recharge avec
   le nouveau visuel, et la sortie OBS, les fenêtres d'envoi et les aperçus des invités le prennent tout seuls (etat.visuel).
   Pendant le direct ou un enregistrement : le thème et les couleurs ne changent pas (tout le reste, oui). */
'use strict';
(() => {
  const btn = $('#btn-visuel');
  if (!btn) return;
  const vis = visuelDe(session);
  etat.visuel = { v: vis.v, o: vis.o };          // envoyé à chaque fois avec l'état : les pages en retard se mettent à jour

  const enregistre = () => typeof fenetres === 'object' && ['horizontal', 'vertical'].some(f => { const x = fenetres[f]; return x && x.etat && x.vu && Date.now() - x.vu < 7000 && x.etat.rec && x.etat.rec.actif; });
  const bloque = () => etat.direct ? 'direct' : enregistre() ? 'rec' : '';
  function majBouton() {
    const b = bloque();
    btn.classList.toggle('verrou', !!b);
    btn.title = b === 'direct' ? 'Pendant le direct, le thème et les couleurs ne changent pas. Les titres, les scènes, la musique, eux, changent toujours.'
      : b === 'rec' ? 'Pendant un enregistrement, le thème et les couleurs ne changent pas.'
      : 'Le visuel du live : thème, couleurs, police, logo, titre';
  }
  setInterval(majBouton, 1000); majBouton();

  /* La page « Visuel » lit le live dans la liste de ce navigateur : s'il n'y est pas (régie ouverte depuis un lien), on l'y met */
  function assurerDansListe() {
    try {
      const l = JSON.parse(localStorage.getItem('studioSeb:sessions') || '[]');
      if (!l.some(x => x.session && x.session.room === session.room)) { l.unshift({ session, cle }); localStorage.setItem('studioSeb:sessions', JSON.stringify(l)); }
      return true;
    } catch (e) { return false; }
  }

  let panneau = null;
  function ouvrir() {
    const b = bloque();
    if (b) return toast(b === 'direct' ? 'Pendant le direct, le thème et les couleurs restent les mêmes. Tu peux toujours changer les titres, les scènes et la musique.' : 'Arrête d\'abord l\'enregistrement pour changer le thème');
    if (!assurerDansListe()) return toast('Ce navigateur refuse de garder les réglages : le visuel ne peut pas être changé ici');
    if (panneau) return;
    panneau = document.createElement('div');
    panneau.id = 'visuel-panneau';
    panneau.innerHTML = `<div class="vp-charge">Chargement du visuel…</div><iframe title="Visuel du live" src="index.html?visuel=${encodeURIComponent(session.room)}&embed=1"></iframe>`;
    document.body.appendChild(panneau);
    document.body.classList.add('visuel-ouvert');
    panneau.querySelector('iframe').addEventListener('load', () => panneau && panneau.classList.add('pret'));
  }
  function fermer() {
    if (!panneau) return;
    panneau.remove(); panneau = null;
    document.body.classList.remove('visuel-ouvert');
  }
  btn.onclick = ouvrir;
  addEventListener('keydown', e => { if (e.key === 'Escape' && panneau) fermer(); });

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.obsebVisuel) return;
    const m = e.data.obsebVisuel;
    if (m === 'fermer') return fermer();
    if (m === 'introuvable') { fermer(); return toast('Ce live n\'est pas dans la liste de ce navigateur'); }
    if (m === 'applique' && typeof e.data.s === 'string') {
      if (bloque()) { fermer(); return toast('Le direct a commencé entre-temps : le visuel n\'a pas été changé'); }
      let nouveau;
      try { nouveau = b64d(e.data.s); } catch (err) { return fermer(); }
      if (!nouveau || nouveau.room !== session.room) return fermer();
      // on prévient tout de suite la sortie et les invités, puis la régie repart avec son nouveau lien
      const v = visuelDe(nouveau);
      etat.visuel = { v: v.v, o: v.o };
      envoyer();
      const h = hashParams(); h.set('s', b64e(nouveau));
      setTimeout(() => { location.replace(location.pathname + location.search + '#' + h.toString()); location.reload(); }, 600);
    }
  });

  /* Premier passage dans la régie d'un live tout juste créé : on ouvre le choix du visuel */
  const CLE_VU = 'studioSeb:visuelVu:' + session.room;
  let vu = false;
  try { vu = !!localStorage.getItem(CLE_VU); localStorage.setItem(CLE_VU, '1'); } catch (e) { vu = true; }
  if (session.choixVisuel && !vu && !etat.direct) setTimeout(ouvrir, 700);
})();
