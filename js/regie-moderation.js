/* MESA : régie, modération du chat.
   Un filtre qui tourne ici, dans ta régie (rien n'est envoyé ailleurs) :
   - insultes et propos haineux (français et anglais, même écrits « c0nn4rd » ou avec des lettres répétées) ;
   - tes propres mots interdits ;
   - liens, messages tout en majuscules, et le même message envoyé en boucle.
   Un message filtré reste visible dans ta régie (grisé, avec la raison) mais n'est jamais affiché à l'écran,
   sauf si tu cliques dessus et confirmes. */
'use strict';
(() => {
  if (typeof ajouterMessage !== 'function') return;
  const CLE_MOD = 'studioSeb:moderation';
  let reglages = { actif: true, liens: true, majuscules: true, mots: '' };
  try { reglages = Object.assign(reglages, JSON.parse(localStorage.getItem(CLE_MOD) || '{}')); } catch (e) { /* rien */ }
  const sauver = () => { try { localStorage.setItem(CLE_MOD, JSON.stringify(reglages)); } catch (e) { /* rien */ } };

  // écrits sans accents ni majuscules ; on compare au message « nettoyé » (voir normaliser)
  const INSULTES = ('connard connards connasse conasse conne connes encule encules enculer fdp ntm nique niquer niquez salope salopes ' +
    'pute putes batard batards pd pede pedes tapette tapettes gouine negro negre negres bougnoule youpin bicot crouille ' +
    'triso trisomique mongole mongolien attarde attardee abruti abrutie debile cretin cretine tg suceur suceuse ' +
    'bite couilles chatte enfoire enfoiree raclure salaud salauds merdeux pouffiasse grognasse ' +
    'fuck fucking fucker motherfucker bitch bitches cunt nigger niggers nigga faggot fag retard retarded whore slut kys').split(' ');
  const EXPRESSIONS = ['ta gueule', 'ferme ta gueule', 'ta mere', 'nique ta', 'sale arabe', 'sale noir', 'sale juif', 'sale pd', 'va mourir',
    'suicide toi', 'creve', 'kill yourself', 'go die'];
  function normaliser(t) {
    return ' ' + String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't')
      .replace(/[^a-z\s]/g, ' ').replace(/(.)\1{2,}/g, '$1$1').replace(/\s+/g, ' ') + ' ';
  }
  const sansDoubles = t => t.replace(/(.)\1+/g, '$1');
  const mesMots = () => String(reglages.mots || '').split(/[,;\n]/).map(m => normaliser(m).trim()).filter(Boolean);

  const derniers = new Map();   // auteur -> { texte, t, n }
  function verdict(m) {
    if (!reglages.actif || m.p === 'question' || m.p === 'test') return '';
    const n = normaliser(m.texte), n1 = sansDoubles(n);
    const mot = w => n.includes(' ' + w + ' ') || n1.includes(' ' + sansDoubles(w) + ' ');
    if (INSULTES.some(mot) || EXPRESSIONS.some(e => n.includes(' ' + e + ' ') || n1.includes(' ' + sansDoubles(e) + ' '))) return 'insulte';
    if (mesMots().some(w => n.includes(' ' + w + ' ') || n1.includes(' ' + sansDoubles(w) + ' '))) return 'mot interdit';
    if (reglages.liens && /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|fr|net|org|io|gg|ly|xyz|ru|tk)\b)/i.test(m.texte)) return 'lien';
    const lettres = String(m.texte).replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (reglages.majuscules && lettres.length >= 12 && lettres.replace(/[^A-ZÀ-Þ]/g, '').length / lettres.length > 0.8) return 'majuscules';
    const cle = m.p + ':' + m.auteur, avant = derniers.get(cle), t = Date.now();
    const pareil = avant && avant.texte === n && t - avant.t < 30000;
    derniers.set(cle, { texte: n, t, n: pareil ? avant.n + 1 : 1 });
    if (pareil && avant.n + 1 >= 3) return 'répété';
    return '';
  }

  /* On s'intercale dans le chat : le message garde sa place dans ta liste, mais filtré */
  const ajouterOriginal = ajouterMessage;
  ajouterMessage = function (m) {
    if (!m || !m.texte) return;
    m.cache = verdict(m);
    ajouterOriginal(m);
    if (m.cache) {
      const el = $('#chat-liste').lastElementChild;
      if (el && el.classList.contains('chat-msg')) {
        el.classList.add('modere');
        el.title = `Filtré (${m.cache}) : jamais affiché à l'écran. Clique pour l'afficher quand même.`;
        const tag = document.createElement('em'); tag.className = 'mod-raison'; tag.textContent = m.cache;
        el.appendChild(tag);
      }
      majCompte();
    }
  };
  const remplirOriginal = remplirFilChat;
  remplirFilChat = function () {
    remplirOriginal();
    etat.chatFil.msgs = messagesChat.filter(x => !x.cache).slice(-8).map(x => ({ p: x.p, a: String(x.auteur).slice(0, 30), t: x.texte.slice(0, 200) }));
  };
  const afficherOriginal = afficherMessageChat;
  afficherMessageChat = function (m, el) {
    if (m && m.cache && !confirm(`Ce message a été filtré (${m.cache}). L'afficher quand même à l'écran ?`)) return;
    afficherOriginal(m, el);
  };

  /* Réglages, sous la liste du chat */
  const bloc = document.createElement('details');
  bloc.className = 'pli'; bloc.id = 'pli-moderation';
  bloc.innerHTML = `<summary>Modération <span class="mod-compte" id="mod-compte" hidden></span></summary>
    <label class="ligne-case"><input type="checkbox" id="mod-actif"> <span><b>Filtrer le chat</b><small class="aide" style="display:block">Insultes et propos haineux, même mal écrits exprès. Un message filtré reste ici, grisé, mais ne passe jamais à l'écran.</small></span></label>
    <label class="ligne-case"><input type="checkbox" id="mod-liens"> <span>Filtrer aussi les liens</span></label>
    <label class="ligne-case"><input type="checkbox" id="mod-maj"> <span>Filtrer aussi les messages TOUT EN MAJUSCULES</span></label>
    <label class="mod-mots-titre" for="mod-mots">Tes mots interdits (séparés par des virgules)</label>
    <textarea id="mod-mots" rows="2" placeholder="ex. spoiler, nom d'un troll"></textarea>`;
  const apres = $('#chat-fil') && $('#chat-fil').closest('label');
  if (apres) apres.after(bloc);
  let filtres = 0;
  function majCompte() {
    filtres = messagesChat.filter(x => x.cache).length;
    const c = $('#mod-compte'); c.hidden = !filtres; c.textContent = filtres > 1 ? `${filtres} filtrés` : '1 filtré';
  }
  $('#mod-actif').checked = reglages.actif; $('#mod-liens').checked = reglages.liens; $('#mod-maj').checked = reglages.majuscules; $('#mod-mots').value = reglages.mots;
  const majOptions = () => { ['#mod-liens', '#mod-maj', '#mod-mots'].forEach(s => { $(s).disabled = !reglages.actif; }); };
  $('#mod-actif').onchange = e => { reglages.actif = e.target.checked; sauver(); majOptions(); toast(reglages.actif ? 'Le chat est filtré' : 'Le chat n\'est plus filtré'); };
  $('#mod-liens').onchange = e => { reglages.liens = e.target.checked; sauver(); };
  $('#mod-maj').onchange = e => { reglages.majuscules = e.target.checked; sauver(); };
  $('#mod-mots').oninput = e => { reglages.mots = e.target.value.slice(0, 2000); sauver(); };
  majOptions();
  window.verdictModeration = verdict;   // pour les essais
})();
