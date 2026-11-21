/* MESA : traduction des sous-titres après le live, calculée sur l'ordinateur (modèles Opus-MT, aucun serveur MESA).
   Le modèle de la langue choisie (≈ 75 Mo) se télécharge une fois depuis Hugging Face, puis il est gardé par le navigateur.
   Bibliothèque : transformers.js (licence Apache-2.0), CDN jsDelivr, version figée, chargée par import() dans ce
   travailleur (voir whisper-travail.js pour la règle de sécurité). */
const BIBLIO = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
const MODELES = { en: 'Xenova/opus-mt-fr-en', es: 'Xenova/opus-mt-fr-es', de: 'Xenova/opus-mt-fr-de' };
const pretes = new Map();

async function traducteur(langue) {
  if (!MODELES[langue]) throw new Error('langue inconnue');
  if (!pretes.has(langue)) {
    pretes.set(langue, (async () => {
      const { pipeline, env } = await import(BIBLIO);
      env.allowLocalModels = false;
      return pipeline('translation', MODELES[langue], {
        dtype: 'q8',
        progress_callback: p => { if (p && p.status === 'progress' && p.total) self.postMessage({ type: 'progres', fichier: p.file, charge: p.loaded, total: p.total }); },
      });
    })().catch(e => { pretes.delete(langue); throw e; }));
  }
  return pretes.get(langue);
}

self.onmessage = async ({ data }) => {
  try {
    const t = await traducteur(data.langue);
    const sortie = [];
    for (let i = 0; i < data.textes.length; i++) {
      const texte = String(data.textes[i] || '').trim();
      if (!texte) { sortie.push(''); continue; }
      const r = await t(texte, { max_new_tokens: 256 });
      sortie.push(String((r && r[0] && r[0].translation_text) || '').trim());
      self.postMessage({ type: 'avance', fait: i + 1, total: data.textes.length });
    }
    self.postMessage({ type: 'fini', textes: sortie });
  } catch (e) {
    self.postMessage({ type: 'erreur', message: String((e && e.message) || e).slice(0, 200) });
  }
};
