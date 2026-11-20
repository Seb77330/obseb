/* MESA : fabriquer un code d'accès Entreprises. Le code = { n: nom, f: date de fin } en base64, un point, puis la signature
   ECDSA P-256 (SHA-256) de ce texte. Le site la vérifie avec la clé publique écrite dans js/common.js (CLE_PUBLIQUE_CODES). */
'use strict';
(function () {
  const $ = s => document.querySelector(s);
  const CLE = 'mesa:cleCodes';
  const b64u = octets => btoa(String.fromCharCode(...new Uint8Array(octets))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  let jwk = null;
  try { jwk = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { jwk = null; }
  const majCle = () => { $('#cle-etat').textContent = jwk ? 'Clé gardée dans ce navigateur.' : 'Aucune clé pour l’instant.'; $('#cle-etat').className = jwk ? 'ok' : ''; };
  majCle();
  $('#garder').onclick = async () => {
    try {
      const j = JSON.parse($('#cle').value.trim());
      await crypto.subtle.importKey('jwk', j, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      jwk = j; localStorage.setItem(CLE, JSON.stringify(j)); $('#cle').value = ''; majCle();
    } catch (e) { $('#cle-etat').textContent = 'Cette clé n’est pas lisible : colle tout le contenu du fichier.'; $('#cle-etat').className = 'ko'; }
  };
  $('#creer').onclick = async () => {
    const nom = $('#nom').value.trim();
    if (!jwk) { $('#retour').textContent = 'Garde d’abord ta clé privée.'; $('#retour').className = 'ko'; return; }
    if (!nom) { $('#nom').focus(); return; }
    const d = $('#duree').value;
    const fin = d === 'beta' ? Date.UTC(2027, 0, 1) : Date.now() + (+d) * 86400000;
    const charge = b64u(new TextEncoder().encode(JSON.stringify({ n: nom, f: fin })));
    const cle = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, new TextEncoder().encode(charge));
    const code = charge + '.' + b64u(sig);
    $('#lien').value = new URL('../entreprises.html#code=' + code, location.href).href;
    $('#retour').textContent = `Code créé pour ${nom}, valable jusqu'au ${new Date(fin).toLocaleDateString('fr-FR')}.`; $('#retour').className = 'ok';
  };
  $('#copier').onclick = async () => { $('#lien').select(); try { await navigator.clipboard.writeText($('#lien').value); } catch (e) { document.execCommand('copy'); } };
})();
