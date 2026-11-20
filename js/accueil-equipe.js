/* MESA : « Mon équipe » (formule Entreprises : 3 personnes sur le compte ; ouvert à tous pendant la bêta).
   Sans serveur : un lien d'équipe porte tes lives (avec leur clé de régie) et tes styles de marque (couleurs, police, logo).
   Tes coéquipiers l'ouvrent une fois : tout arrive dans leur studio. Le lien reste dans l'adresse après « # » : il n'est
   jamais envoyé à un serveur. Recopie-le quand tu crées de nouveaux lives ou de nouveaux styles. */
'use strict';
(function () {
  const CLE_LIVES = 'studioSeb:sessions', CLE_STYLES = 'studioSeb:styles', CLE_EQUIPE = 'studioSeb:equipe';
  const MAX_EQUIPE = 3;
  const lireJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const ecrireJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const t = s => (window.typoFr ? typoFr(s) : s);
  const toast = window.toast || (m => alert(m));

  /* compression (le lien reste court) puis base64 sans caractères spéciaux */
  async function emballer(obj) {
    const flux = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const octets = new Uint8Array(await new Response(flux).arrayBuffer());
    let bin = ''; for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function deballer(txt) {
    const bin = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
    const octets = Uint8Array.from(bin, c => c.charCodeAt(0));
    const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(flux).text());
  }

  const dlg = document.createElement('dialog');
  dlg.className = 'equipe-dlg';
  document.body.appendChild(dlg);
  const fermer = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-fermer]')) fermer(); });

  /* ---- côté animateur : créer le lien d'équipe ---- */
  function ouvrirPartage() {
    const lives = lireJson(CLE_LIVES, []).filter(x => x && x.session && x.cle && (!document.body.classList.contains('page-ent') || x.session.ent));   // sur la page Entreprises : les événements seulement
    const styles = lireJson(CLE_STYLES, []).filter(x => x && x.id && x.theme);
    const eq = lireJson(CLE_EQUIPE, {});
    dlg.innerHTML = `<form method="dialog" class="equipe-boite">
      <button type="button" class="equipe-x" data-fermer aria-label="Fermer">×</button>
      <h2>Mon équipe</h2>
      <p>${t(`Travaille à plusieurs : jusqu'à ${MAX_EQUIPE} personnes, toi compris. Tes coéquipiers retrouvent tes lives et tes styles de marque (couleurs, police, logo) dans leur propre studio.`)}</p>
      <ul class="equipe-contenu">
        <li><b>${lives.length}</b> ${document.body.classList.contains('page-ent') ? (lives.length > 1 ? 'événements' : 'événement') : (lives.length > 1 ? 'lives' : 'live')}</li>
        <li><b>${styles.length}</b> ${t(styles.length > 1 ? 'styles de marque' : 'style de marque')}</li>
      </ul>
      ${eq.de ? `<p class="equipe-note">${t(`Tu fais partie de l'équipe de ${esc(eq.de)}.`)}</p>` : ''}
      <ol class="equipe-etapes">
        <li>${t('Copie le lien d’équipe.')}</li>
        <li>${t('Envoie-le à tes 2 coéquipiers, et à eux seuls : il ouvre tes régies.')}</li>
        <li>${t('Recopie-le quand tu crées de nouveaux lives ou de nouveaux styles.')}</li>
      </ol>
      <p class="equipe-note">${t('Une seule personne à la fois dans la régie d’un live.')}</p>
      <div class="equipe-actions"><button type="button" class="primaire" id="equipe-copier" ${lives.length || styles.length ? '' : 'disabled'}>Copier le lien d'équipe</button></div>
    </form>`;
    dlg.querySelector('#equipe-copier').addEventListener('click', async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try {
        const de = (typeof identiteRetenue === 'function' && identiteRetenue().hote) || (lives[0] && lives[0].session.hote) || '';
        const lien = `${location.href.replace(/[#?].*$/, '')}#equipe=${await emballer({ v: 1, de, lives: lives.map(x => ({ session: x.session, cle: x.cle })), styles, acces: document.body.classList.contains('page-ent') && typeof accesEntreprise === 'function' ? (accesEntreprise() || {}).code : undefined })}`;
        try { await navigator.clipboard.writeText(lien); toast('Lien d’équipe copié'); }
        catch (e) { prompt('Copie ce lien pour ton équipe :', lien); }
      } catch (e) { toast('Ce navigateur ne sait pas créer le lien : essaie avec Chrome, Edge ou Firefox à jour'); }
      b.disabled = false;
    });
    dlg.showModal();
  }
  const btn = document.getElementById('btn-equipe');
  if (btn) btn.addEventListener('click', ouvrirPartage);

  /* ---- côté coéquipier : ouvrir le lien ---- */
  const m = location.hash.match(/[#&]equipe=([\w-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.href.replace(/#.*$/, ''));
  deballer(m[1]).then(d => {
    if (!d || d.v !== 1) throw new Error('version');
    const lives = (Array.isArray(d.lives) ? d.lives : []).filter(x => x && x.session && typeof x.session.room === 'string' && typeof x.cle === 'string');
    const styles = (Array.isArray(d.styles) ? d.styles : []).filter(x => x && x.id && x.theme);
    const de = String(d.de || '').slice(0, 40);
    dlg.innerHTML = `<form method="dialog" class="equipe-boite">
      <button type="button" class="equipe-x" data-fermer aria-label="Fermer">×</button>
      <h2>${t(de ? `${esc(de)} t'invite dans son équipe` : 'Tu es invité dans une équipe')}</h2>
      <p>${t(`Tu vas retrouver ${lives.length} ${lives.length > 1 ? 'lives' : 'live'} et ${styles.length} ${styles.length > 1 ? 'styles de marque' : 'style de marque'} dans ton studio. Tu pourras ouvrir leurs régies et préparer les lives.`)}</p>
      <p class="equipe-note">${t('Une seule personne à la fois dans la régie d’un live.')}</p>
      <div class="equipe-actions"><button type="button" data-fermer>Plus tard</button><button type="button" class="primaire" id="equipe-ajouter">Ajouter à mon studio</button></div>
    </form>`;
    dlg.querySelector('#equipe-ajouter').addEventListener('click', () => {
      const mesLives = lireJson(CLE_LIVES, []);
      for (const x of lives) {
        const i = mesLives.findIndex(y => y && y.session && y.session.room === x.session.room);
        if (i >= 0) mesLives[i] = Object.assign({}, mesLives[i], { session: x.session, cle: x.cle }); else mesLives.push({ session: x.session, cle: x.cle });
      }
      const mesStyles = lireJson(CLE_STYLES, []);
      for (const s of styles) { const i = mesStyles.findIndex(y => y && y.id === s.id); if (i >= 0) mesStyles[i] = s; else mesStyles.push(s); }
      const ok = ecrireJson(CLE_LIVES, mesLives) && ecrireJson(CLE_STYLES, mesStyles);
      // MESA Entreprises : le coéquipier reçoit aussi l'accès (le même code, vérifié)
      if (typeof d.acces === 'string' && typeof verifierCodeEntreprise === 'function') verifierCodeEntreprise(d.acces).then(v => { if (v) ecrireJson(CLE_ACCES_ENT, v); });
      ecrireJson(CLE_EQUIPE, { de, depuis: Date.now() });
      fermer();
      if (!ok) return toast('Plus de place dans ce navigateur pour tout ajouter');
      toast('Lives et styles de l’équipe ajoutés');
      setTimeout(() => location.reload(), 900);
    });
    dlg.showModal();
  }).catch(() => toast('Ce lien d’équipe est abîmé : redemande-le'));
})();
