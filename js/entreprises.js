/* MESA Entreprises : la page à part. Sans accès, la présentation et la case du code ; avec un accès, « Mes événements ».
   Un événement est un live marqué « ent » : sa régie est simplifiée et sobre (js/regie.js, css/regie-entreprise.css). */
'use strict';
(function () {
  const $ = s => document.querySelector(s);
  const CLE_LIVES = 'studioSeb:sessions';
  const t = s => (window.typoFr ? typoFr(s) : s);
  window.toast = window.toast || (m => {
    const el = document.createElement('div'); el.className = 'e-toast'; el.textContent = t(m); document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  });
  const lire = () => { try { const l = JSON.parse(localStorage.getItem(CLE_LIVES) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const ecrire = l => { try { localStorage.setItem(CLE_LIVES, JSON.stringify(l)); return true; } catch (e) { toast('Plus de place dans ce navigateur'); return false; } };
  const dateFr = ts => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1ᵉʳ ');

  /* ---- l'accès ---- */
  async function activer(code, silencieux) {
    const v = await verifierCodeEntreprise(code);
    const retour = $('#code-retour');
    if (!v) { if (!silencieux) { retour.textContent = t('Ce code n’est pas valable, ou il a expiré. Vérifie qu’il est complet.'); retour.className = 'e-retour ko'; } return false; }
    try { localStorage.setItem(CLE_ACCES_ENT, JSON.stringify(v)); } catch (e) { /* rien */ }
    retour.textContent = ''; afficher(); toast(`Accès activé pour ${v.nom}`);
    return true;
  }
  $('#form-code').addEventListener('submit', e => { e.preventDefault(); activer($('#code').value); });
  // un lien « entreprises.html#code=… » active l'accès tout seul
  const codeDuLien = () => { const m = location.hash.match(/[#&]code=([\w.-]+)/); if (m) { history.replaceState(null, '', location.pathname); activer(m[1]); } };
  addEventListener('hashchange', codeDuLien); codeDuLien();

  $('#btn-quitter').addEventListener('click', () => {
    if (!confirm('Retirer l’accès Entreprises de ce navigateur ? Tes événements restent enregistrés ici.')) return;
    try { localStorage.removeItem(CLE_ACCES_ENT); } catch (e) { /* rien */ }
    afficher();
  });
  $('#voir-presentation').addEventListener('click', e => { e.preventDefault(); $('#presentation').hidden = false; $('#presentation').scrollIntoView({ behavior: 'smooth' }); });

  /* ---- mes événements ---- */
  function afficher() {
    const acces = accesEntreprise();
    $('#espace').hidden = !acces; $('#presentation').hidden = !!acces;
    $('#nav-acces').textContent = acces ? 'Mes événements' : 'Accès';
    $('#nav-acces').href = acces ? '#espace' : '#acces';
    if (!acces) return;
    $('#espace-entreprise').textContent = acces.nom;
    $('#espace-info').textContent = t(`Accès valable jusqu'au ${dateFr(acces.fin)}.`);
    const evts = lire().filter(x => x && x.session && x.session.ent && x.cle).sort((a, b) => (b.session.cree || 0) - (a.session.cree || 0));
    const box = $('#evenements'); box.innerHTML = '';
    $('#evenements-vide').hidden = !!evts.length;
    evts.forEach(({ session, cle }) => {
      const L = liens(session, cle);
      const c = document.createElement('article'); c.className = 'e-carte';
      const coul = session.theme && /^#[0-9a-f]{6}$/i.test(session.theme.accent || '') ? session.theme.accent : '';
      if (coul) c.style.setProperty('--c', coul);
      c.innerHTML = `<h3></h3><p></p><div class="e-actions"><a class="e-btn e-btn-plein" data-a="regie">Ouvrir la régie</a><button type="button" class="e-btn" data-a="invite">Lien des intervenants</button><button type="button" class="e-btn" data-a="suppr" title="Supprimer cet événement" aria-label="Supprimer">✕</button></div>`;
      c.querySelector('h3').textContent = session.titre || 'Événement';
      c.querySelector('p').textContent = t((session.hote ? session.hote + ' · ' : '') + 'Créé le ' + dateFr(session.cree || Date.now()) + (session.live && session.live.date ? ' · Dernier direct le ' + dateFr(session.live.date) : ''));
      c.querySelector('[data-a=regie]').href = L.regie;
      c.querySelector('[data-a=invite]').onclick = async () => { try { await navigator.clipboard.writeText(L.invite); toast('Lien des intervenants copié'); } catch (e) { prompt('Lien des intervenants :', L.invite); } };
      c.querySelector('[data-a=suppr]').onclick = () => {
        if (!confirm(`Supprimer « ${session.titre} » de ce navigateur ?`)) return;
        ecrire(lire().filter(x => !(x.session && x.session.room === session.room))); afficher();
      };
      box.appendChild(c);
    });
  }

  /* ---- nouvel événement ---- */
  const dlg = $('#dlg-nouvel');
  $('#btn-nouvel').addEventListener('click', () => {
    const moi = typeof identiteRetenue === 'function' ? identiteRetenue() : { hote: '' };
    $('#n-hote').value = moi.hote || (accesEntreprise() || {}).nom || '';
    dlg.showModal(); $('#n-titre').focus();
  });
  $('#n-annuler').addEventListener('click', () => dlg.close());
  /* le logo, réduit à 400 px au plus pour rester léger dans le lien de la régie */
  function logoReduit(f) {
    return new Promise(res => {
      if (!f) return res('');
      if (f.size > 4e6) { toast('Logo trop lourd (4 Mo au plus)'); return res(''); }
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Ce logo ne s’ouvre pas'); res(''); };
      img.src = url;
    });
  }
  $('#form-nouvel').addEventListener('submit', async e => {
    e.preventDefault();
    const titre = $('#n-titre').value.trim(); if (!titre) return $('#n-titre').focus();
    const look = (document.querySelector('[name=look]:checked') || {}).value || 'studio';
    const session = nouvelleSession(titre, THEMES_ENTREPRISE.includes(look) ? look : 'studio');
    session.ent = 1;
    session.hote = $('#n-hote').value.trim().slice(0, 28);
    if (session.hote && typeof retenirIdentite === 'function') retenirIdentite('hote', session.hote);
    session.handle = '';
    session.theme.accent = $('#n-couleur').value;
    const logo = await logoReduit($('#n-logo').files[0]);
    if (logo) session.theme.logo = logo; else if (session.hote) session.theme.logoTexte = session.hote;
    const cle = rnd(20);
    const l = lire(); l.unshift({ session, cle });
    if (!ecrire(l)) return;
    dlg.close();
    location.href = liens(session, cle).regie;
  });

  afficher();
})();
