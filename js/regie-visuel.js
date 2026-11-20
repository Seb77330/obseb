/* MESA : régie, bouton « Visuel ».
   Le visuel du live se règle ici, par étapes (thème, couleurs, police, logo et fond, musiques, titre et date),
   dans un panneau sur le côté de la régie (index.html?visuel=<salle>&embed=1&panneau=1, js/visuel-etapes.js).
   L'aperçu de la régie reste visible et suit chaque choix (message « apercu »). « Appliquer au live » enregistre :
   la régie se recharge avec le nouveau visuel, et la sortie OBS, les fenêtres d'envoi et les aperçus des invités
   le prennent tout seuls (etat.visuel). Fermer sans appliquer remet le visuel d'avant.
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

  let panneau = null, vuAvant = true;
  function ouvrir(etape) {
    const b = bloque();
    if (b) return toast(b === 'direct' ? 'Pendant le direct, le thème et les couleurs restent les mêmes. Tu peux toujours changer les titres, les scènes et la musique.' : 'Arrête d\'abord l\'enregistrement pour changer le thème');
    if (!assurerDansListe()) return toast('Ce navigateur refuse de garder les réglages : le visuel ne peut pas être changé ici');
    if (panneau) return;
    panneau = document.createElement('div');
    panneau.id = 'visuel-panneau';
    panneau.innerHTML = `<div class="vp-charge">Chargement du visuel…</div><iframe title="Visuel du live" src="index.html?visuel=${encodeURIComponent(session.room)}&embed=1&panneau=1${typeof etape === 'string' ? '&etape=' + encodeURIComponent(etape) : ''}"></iframe>`;
    document.body.appendChild(panneau);
    document.body.classList.add('visuel-ouvert');
    if (session.choixVisuel && !vuAvant) document.body.classList.add('visuel-creation');
    panneau.querySelector('iframe').addEventListener('load', () => panneau && panneau.classList.add('pret'));
  }
  function fermer(applique) {
    if (!panneau) return;
    panneau.remove(); panneau = null;
    document.body.classList.remove('visuel-ouvert', 'visuel-creation');
    clearTimeout(essai.t);
    dispatchEvent(new Event('mesa:visuel-ferme'));   // la caméra d'un live tout neuf s'allume maintenant
    if (!applique && essai.actif) revenir();
  }
  btn.onclick = () => ouvrir();
  // le titre du live, en haut à gauche : un clic ouvre l'étape « Textes » (où se change le titre)
  const titreEl = $('#titre-session');
  if (titreEl) { titreEl.classList.add('cliquable'); titreEl.title = 'Changer le titre'; titreEl.onclick = () => ouvrir('textes'); }
  // un live programmé : sa date sous le titre, un clic ouvre l'étape « Quand »
  if (session.debut && typeof quandTexte === 'function') { const ss = $('#sous-session'); if (ss) { ss.textContent = 'Programmé : ' + quandTexte(session.debut); ss.classList.add('cliquable'); ss.title = 'Changer la date ou la durée'; ss.onclick = () => ouvrir('titre'); } }

  /* L'essai en direct dans l'aperçu : chaque choix du panneau est montré tout de suite (sortie, aperçus),
     sans rien enregistrer. Les images du PC voyagent par la liste des lives de ce navigateur. */
  const ORIGINAL = JSON.parse(JSON.stringify(session));
  const essai = { actif: false, t: 0 };
  function ecrireListe(s) {
    try {
      const l = JSON.parse(localStorage.getItem('studioSeb:sessions') || '[]');
      const i = l.findIndex(x => x.session && x.session.room === session.room);
      if (i >= 0) { l[i].session = s; localStorage.setItem('studioSeb:sessions', JSON.stringify(l)); }
    } catch (e) { /* rien */ }
  }
  function montrer(s) {
    const v = visuelDe(s);
    if (v.v === etat.visuel.v) return;
    ecrireListe(s);
    etat.visuel = { v: v.v, o: v.o };
    essai.actif = v.v !== visuelDe(ORIGINAL).v;
    envoyer();
  }
  function revenir() {
    essai.actif = false;
    ecrireListe(ORIGINAL);
    const v = visuelDe(ORIGINAL);
    etat.visuel = { v: v.v, o: v.o };
    envoyer();
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && panneau) fermer(); });

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.obsebVisuel) return;
    const m = e.data.obsebVisuel;
    if (m === 'fermer') return fermer();
    if (m === 'apercu' && typeof e.data.s === 'string') {
      if (bloque()) return;
      let s; try { s = b64d(e.data.s); } catch (err) { return; }
      if (!s || s.room !== session.room) return;
      clearTimeout(essai.t); essai.t = setTimeout(() => montrer(s), 350);
      return;
    }
    if (m === 'introuvable') { fermer(); return toast('Ce live n\'est pas dans la liste de ce navigateur'); }
    if (m === 'applique' && typeof e.data.s === 'string') {
      if (bloque()) { fermer(); return toast('Le direct a commencé entre-temps : le visuel n\'a pas été changé'); }
      let nouveau;
      try { nouveau = b64d(e.data.s); } catch (err) { return fermer(); }
      if (!nouveau || nouveau.room !== session.room) return fermer();
      // on prévient tout de suite la sortie et les invités, puis la régie repart avec son nouveau lien
      clearTimeout(essai.t); essai.actif = false;
      // le bandeau du bas suivait l'ancien titre : il prend le nouveau
      if (!etat.bandeau || etat.bandeau === ORIGINAL.titre) { etat.bandeau = nouveau.titre; const b = $('#bandeau'); if (b) b.value = nouveau.titre; }
      const v = visuelDe(nouveau);
      etat.visuel = { v: v.v, o: v.o };
      envoyer();
      document.body.classList.remove('visuel-ouvert'); if (panneau) { panneau.remove(); panneau = null; }
      const h = hashParams(); h.set('s', b64e(nouveau));
      setTimeout(() => { location.replace(location.pathname + location.search + '#' + h.toString()); location.reload(); }, 600);
    }
  });

  /* Premier passage dans la régie d'un live tout juste créé : on ouvre le choix du visuel */
  const CLE_VU = 'studioSeb:visuelVu:' + session.room;
  let vu = false;
  try { vu = !!localStorage.getItem(CLE_VU); localStorage.setItem(CLE_VU, '1'); } catch (e) { vu = true; }
  vuAvant = vu;
  // un live à modifier depuis l'accueil (« Modifier » sur sa carte) : la régie s'ouvre sur le visuel
  const demande = hashParams().get('visuel');
  if (demande) { const h = hashParams(); h.delete('visuel'); history.replaceState(null, '', location.pathname + location.search + '#' + h.toString()); }
  if (((session.choixVisuel && !vu) || demande) && !etat.direct) setTimeout(() => ouvrir(demande && demande !== '1' ? demande : undefined), 700);
})();
