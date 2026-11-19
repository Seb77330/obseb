/* MESA : régie, « Vue invité ».
   Ouvre la page d'un invité à côté de la régie (ou dans une fenêtre à part), sans caméra : l'animateur voit ce que
   voit un invité et répond au quiz lui-même. Les deux pages se parlent dans ce navigateur, rien ne passe par la salle. */
'use strict';

const ID_ESSAI = session.room + '_essai';
const canalEssai = 'BroadcastChannel' in window ? new BroadcastChannel('obseb-essai-' + session.room) : null;
let essaiVu = 0;   // dernière fois que la vue invité a donné signe de vie

if (canalEssai) canalEssai.onmessage = e => {
  const d = e.data && e.data.sendData;
  if (!d) return;
  const reveil = Date.now() - essaiVu > 15000;
  essaiVu = Date.now();
  if (reveil) envoyer();             // elle vient de s'ouvrir : elle reçoit l'état tout de suite
  // seule sa réponse au quiz entre dans la régie, comme si un invité l'avait envoyée : elle n'apparaît ni en coulisses ni à l'antenne
  if (d.studioSebQuiz && d.studioSebQuiz.id === ID_ESSAI) {
    etat.noms[ID_ESSAI] = etat.noms[ID_ESSAI] || 'Invité d\'essai';
    dispatchEvent(new MessageEvent('message', { data: { dataReceived: { studioSebQuiz: d.studioSebQuiz }, streamID: ID_ESSAI }, source: maCamera.contentWindow }));
  }
};
function envoyerEssai(st) {
  if (!canalEssai || Date.now() - essaiVu > 15000) return;
  try { canalEssai.postMessage({ dataReceived: { [CANAL]: st }, streamID: ID_HOTE }); } catch (e) { /* rien */ }
}

const urlEssai = () => `invite.html?essai=1#s=${hashParams().get('s')}`;
function ouvrirVueInvite() {
  const p = $('#vue-invite');
  if (!canalEssai) return toast('La vue invité a besoin de Chrome, Edge ou Firefox à jour');
  if (p.hidden) { $('#vi-cadre').src = urlEssai(); p.hidden = false; }
  else fermerVueInvite();
}
function fermerVueInvite() { $('#vue-invite').hidden = true; $('#vi-cadre').src = 'about:blank'; }
$('#btn-vue-invite').onclick = ouvrirVueInvite;
$$('[data-vue-invite]').forEach(b => b.onclick = () => { if ($('#vue-invite').hidden) ouvrirVueInvite(); });
$('#vi-fermer').onclick = fermerVueInvite;
$('#vi-fenetre').onclick = () => {
  if (window.open(urlEssai(), 'obseb-vue-invite', 'popup,width=440,height=780')) fermerVueInvite();
  else toast('Ton navigateur a bloqué la fenêtre : autorise les fenêtres pour ce site');
};

/* le panneau se déplace par sa barre de titre */
{
  const p = $('#vue-invite'), tete = p.querySelector('.vi-tete');
  let dep = null;
  tete.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = p.getBoundingClientRect();
    dep = { x: e.clientX - r.left, y: e.clientY - r.top };
    p.classList.add('glisse'); tete.setPointerCapture(e.pointerId);
  });
  tete.addEventListener('pointermove', e => {
    if (!dep) return;
    const x = Math.max(0, Math.min(innerWidth - 80, e.clientX - dep.x)), y = Math.max(0, Math.min(innerHeight - 40, e.clientY - dep.y));
    Object.assign(p.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  });
  const fin = () => { dep = null; p.classList.remove('glisse'); };
  tete.addEventListener('pointerup', fin); tete.addEventListener('pointercancel', fin);
}
