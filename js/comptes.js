/* OBSeb : les comptes (connexion Google ou code par e-mail, formule du compte).
   Partagé par l'accueil et la page de connexion. Les invités n'ont jamais besoin de compte.
   Tant que COMPTES_CONFIG est vide (js/comptes-config.js), Comptes.actif vaut false et le studio marche sans compte. */
'use strict';
const Comptes = (() => {
  const cfg = typeof COMPTES_CONFIG === 'object' ? COMPTES_CONFIG : {};
  const actif = !!(cfg.url && cfg.cle && window.supabase && window.supabase.createClient);
  const sb = actif ? window.supabase.createClient(cfg.url, cfg.cle, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'studioSeb:compte' },
  }) : null;
  const CLE_FORMULE = 'studioSeb:formule';
  const NOMS = { beta: 'Bêta', gratuit: 'Gratuit', essentiel: 'Essentiel', pro: 'Pro', entreprise: 'Entreprises' };

  // l'adresse de l'accueil, là où Google nous renvoie après la connexion
  const accueil = (suite) => new URL('index.html' + (suite ? '?apres=' + encodeURIComponent(suite) : ''), location.href).href;

  async function session() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }
  // la formule rangée dans le compte ; on la garde aussi dans le navigateur pour les limites affichées du studio
  async function profil() {
    const s = await session();
    if (!s) return null;
    const { data, error } = await sb.from('profils').select('formule, version').eq('id', s.user.id).maybeSingle();
    if (error) return null;
    const p = data || { formule: 'beta', version: 'avec' };
    try { localStorage.setItem(CLE_FORMULE, p.formule); } catch (e) { /* navigation privée */ }
    return p;
  }
  function google(suite) {
    return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: accueil(suite), queryParams: { prompt: 'select_account' } } });
  }
  function envoyerCode(email) {
    return sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  }
  function verifierCode(email, code) {
    return sb.auth.verifyOtp({ email, token: code, type: 'email' });
  }
  async function deconnexion() {
    try { localStorage.removeItem(CLE_FORMULE); } catch (e) { /* navigation privée */ }
    if (sb) await sb.auth.signOut();
  }
  async function supprimer() {
    const { error } = await sb.rpc('supprimer_mon_compte');
    if (error) throw error;
    await deconnexion();
  }
  const surChangement = (f) => { if (sb) sb.auth.onAuthStateChange((evt, s) => f(s, evt)); };
  return { actif, session, profil, google, envoyerCode, verifierCode, deconnexion, supprimer, surChangement, accueil, NOMS };
})();
