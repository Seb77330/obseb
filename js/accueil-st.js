/* Accueil : les sous-titres d'un live terminé.
   Pendant 10 jours, on peut corriger les mots et les noms propres mal compris, puis télécharger le fichier
   (.srt pour YouTube et les logiciels de montage, .vtt pour le web, ou le texte brut). */
'use strict';

const JOURS_ST = 10;
const cleST = room => 'studioSeb:st:' + room;
function lireST(room) {
  try { const a = JSON.parse(localStorage.getItem(cleST(room)) || 'null'); return a && Array.isArray(a.segs) ? a : null; } catch (e) { return null; }
}
/* Passé 10 jours après le live, les sous-titres sont effacés */
function joursRestantsST(live) { return JOURS_ST - Math.floor((Date.now() - live.date) / 86400000); }

/* La ligne ajoutée à un live terminé (rien si le live n'a pas de sous-titres) */
function ligneSousTitres(session, live) {
  const reste = joursRestantsST(live);
  if (reste <= 0) { try { localStorage.removeItem(cleST(session.room)); } catch (e) { /* rien */ } return null; }
  const a = lireST(session.room);
  if (!a || !a.segs.length) return null;
  const el = document.createElement('div');
  el.className = 'st-ligne';
  el.innerHTML = `<span class="txt"><b>Sous-titres</b> · ${a.segs.length} réplique${a.segs.length > 1 ? 's' : ''} · gardés encore ${reste} jour${reste > 1 ? 's' : ''}</span>
    <button type="button" class="petit primaire" data-a="corriger">Corriger</button>
    <button type="button" class="petit" data-a="srt">Télécharger .srt</button>`;
  el.querySelector('[data-a=corriger]').onclick = () => ouvrirAtelier(session, live);
  el.querySelector('[data-a=srt]').onclick = () => telechargerST(session, lireST(session.room).segs, 'srt', true);
  return el;
}

function telechargerST(session, segs, format, avecNoms) {
  const contenu = format === 'srt' ? versSrt(segs, avecNoms) : format === 'vtt' ? versVtt(segs, avecNoms) : versTexte(segs);
  const nom = (slug(session.titre, 40) || 'live') + '-sous-titres.' + format;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + contenu], { type: 'text/plain;charset=utf-8' }));
  a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Fichier ${nom} téléchargé`);
}

/* ----- L'atelier de correction ----- */
const atelier = $('#atelier-st');
let atSession = null, atArchive = null;
const echapperRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function sauverAtelier() {
  try { localStorage.setItem(cleST(atSession.room), JSON.stringify(atArchive)); } catch (e) { toast('Impossible d\'enregistrer : plus de place dans ce navigateur'); }
}
function ajusterHauteur(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
function ouvrirAtelier(session, live) {
  atSession = session; atArchive = lireST(session.room);
  if (!atArchive) return;
  $('#at-titre').textContent = 'Sous-titres · ' + session.titre;
  const reste = joursRestantsST(live);
  $('#at-reste').textContent = `Gardés encore ${reste} jour${reste > 1 ? 's' : ''}`;
  $('#at-chercher').value = ''; $('#at-remplacer').value = '';
  dessinerAtelier();
  atelier.showModal();
  atelier.querySelectorAll('textarea').forEach(ajusterHauteur);
}
function dessinerAtelier() {
  const box = $('#at-liste'); box.innerHTML = '';
  atArchive.segs.forEach(seg => {
    const el = document.createElement('div');
    el.className = 'replique';
    el.innerHTML = `<span class="tc">${codeTemps(seg.a, '.').slice(0, 8)}</span>
      <input type="text" class="qui" maxlength="28" title="Qui parle">
      <textarea rows="1" title="Ce qui a été dit"></textarea>
      <button type="button" class="oter" title="Supprimer cette réplique">✕</button>`;
    const qui = el.querySelector('.qui'), txt = el.querySelector('textarea');
    qui.value = seg.nom || ''; txt.value = seg.t || '';
    qui.oninput = () => { seg.nom = qui.value.trim(); sauverAtelier(); };
    txt.oninput = () => { seg.t = txt.value.replace(/\n+/g, ' '); ajusterHauteur(txt); sauverAtelier(); surligner(); };
    el.querySelector('.oter').onclick = () => { atArchive.segs.splice(atArchive.segs.indexOf(seg), 1); sauverAtelier(); el.remove(); surligner(); };
    seg._el = el;
    box.appendChild(el);
  });
  // _el ne doit pas partir dans l'enregistrement
  atArchive.toJSON = function () { return { debut: this.debut, segs: this.segs.map(({ a, b, id, nom, t }) => ({ a, b, id, nom, t })) }; };
  surligner();
}
/* Montre combien de fois le mot cherché apparaît, et dans quelles répliques */
function surligner() {
  const q = $('#at-chercher').value.trim();
  let n = 0;
  const re = q ? new RegExp(echapperRe(q), 'gi') : null;
  for (const seg of atArchive.segs) {
    const k = re ? ((seg.t || '').match(re) || []).length + ((seg.nom || '').match(re) || []).length : 0;
    n += k;
    if (seg._el) seg._el.classList.toggle('trouve', k > 0);
  }
  $('#at-compte').textContent = q ? `${n} fois` : '';
  $('#at-partout').disabled = !n;
}
$('#at-chercher').oninput = surligner;
$('#at-partout').onclick = () => {
  const q = $('#at-chercher').value.trim(), par = $('#at-remplacer').value;
  if (!q) return;
  const re = new RegExp(echapperRe(q), 'gi');
  let n = 0;
  for (const seg of atArchive.segs) {
    const avantT = seg.t || '', avantN = seg.nom || '';
    seg.t = avantT.replace(re, () => { n++; return par; });
    seg.nom = avantN.replace(re, () => { n++; return par; });
  }
  sauverAtelier(); dessinerAtelier();
  atelier.querySelectorAll('textarea').forEach(ajusterHauteur);
  $('#at-chercher').value = ''; surligner();
  toast(`${n} remplacement${n > 1 ? 's' : ''} : « ${q} » devient « ${par} »`);
};
atelier.querySelectorAll('[data-format]').forEach(b => b.onclick = () => telechargerST(atSession, atArchive.segs, b.dataset.format, $('#at-noms').checked));
$('#at-fermer').onclick = () => atelier.close();
atelier.addEventListener('close', () => { if (typeof afficherLives === 'function') afficherLives(); });
afficherLives();      // la liste a été dessinée avant ce fichier : on la refait avec les sous-titres
