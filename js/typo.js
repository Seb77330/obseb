/* MESA : typographie française, appliquée au texte des pages (comme le ferait un graphiste).
   - espace fine insécable (U+202F) avant ; : ! ? » et après « ;
   - espace insécable (U+00A0) après les petits mots (le, la, un, de, tu, pour, avec, pas…) : ils ne restent
     jamais seuls en bout de ligne (« pas d'appli », « pour un montage ») ;
   - espace insécable entre un nombre et son unité (15 h, 6,99 €, 1080 p) et dans les grands nombres.
   Seul le texte affiché est touché : jamais les champs, le code ni les adresses. */
'use strict';
(() => {
  const FINE = ' ', INSEC = ' ';
  const PETITS = 'à|a|au|aux|avec|ce|ces|cet|cette|c\'est|dans|de|des|du|en|et|il|ils|je|j\'ai|la|le|les|leur|ma|mes|mon|ne|ni|on|ou|où|par|pas|peu|plus|pour|qui|que|sa|ses|si|son|sans|sous|sur|ta|tes|ton|tu|un|une|y|vers|chez|dès|très|toi|moi|nos|vos|ils|elle|elles|plus|même|tout|tous';
  const RE_PETIT = new RegExp(`(^|[\\s(«  ])(${PETITS}|[dlnjcmtsq]'[\\wàâéèêëîïôûùç]{1,3})[ \\t\\n]+(?=\\S)`, 'gi');
  function typo(t) {
    if (!t || !/\S/.test(t)) return t;
    return t
      .replace(/\s+([;:!?»])/g, FINE + '$1')                 // avant ; : ! ? »
      .replace(/([^\s\d])([;!?»])(?=\s|$)/g, (m, a, b) => a === FINE ? m : a + FINE + b)
      .replace(/«\s*/g, '«' + FINE)                            // après «
      .replace(/(\d)\s+(€|%|h|min|s|Mo|Go|Mb\/s|ko|p|px|fps|i\/s|questions?|personnes?|plateformes?|jours?|mois|ans?|€\s?HT)(?=[\s.,;:!?)]|$)/g, '$1' + INSEC + '$2')
      .replace(/(\d)\s(\d{3})(?!\d)/g, '$1' + FINE + '$2')     // 10 000
      .replace(RE_PETIT, (m, avant, mot) => avant + mot + INSEC)
      .replace(RE_PETIT, (m, avant, mot) => avant + mot + INSEC)    // deux passes : « pour un montage »
      // un mot court avant une ponctuation ne part pas seul à la ligne (« le lien invité, »)
      .replace(/ ([\wàâäéèêëîïôöûùüç'’-]{1,8})(?=[,.;:!?\u202F]|$)/g, INSEC + '$1')
      // une petite phrase de fin reste d'un seul bloc (« Pas d'appli, pas de compte. »)
      .replace(/([.!?…]\s+)([^.!?…]{1,30}[.!?…]?)$/, (m, fin, ph) => fin + ph.replace(/ /g, INSEC));
  }
  const SAUTER = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SELECT', 'OPTION', 'SVG', 'NOSCRIPT']);
  function passer(racine) {
    if (!racine || racine.nodeType !== 1 || racine.closest('[contenteditable], [data-sans-typo]')) return;
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        for (let p = n.parentElement; p && p !== racine.parentElement; p = p.parentElement) if (SAUTER.has(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const l = []; while (w.nextNode()) l.push(w.currentNode);
    for (const n of l) { const v = typo(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    racine.querySelectorAll('[placeholder], [title], [aria-label]').forEach(el => {
      for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v) { const t = typo(v); if (t !== v) el.setAttribute(a, t); } }
    });
  }
  window.typoFr = typo;
  const tout = () => passer(document.body);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tout); else tout();
  // ce qui arrive après coup (l'aide, les listes) : repassé par petits lots
  const aRevoir = new Set(); let prevu = 0;
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) aRevoir.add(n.nodeType === 1 ? n : n.parentElement);
    if (!prevu) prevu = requestAnimationFrame(() => { prevu = 0; const l = [...aRevoir]; aRevoir.clear(); l.forEach(passer); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
