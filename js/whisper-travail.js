/* MESA : sous-titres avec Whisper, calculés sur l'ordinateur de la personne (aucun serveur MESA, rien à payer).
   Ce « travailleur » tourne à côté de la page pour ne pas la ralentir. Il reçoit de petits morceaux de voix
   (16 kHz, mono) et renvoie le texte. Le modèle (Whisper base, ≈ 80 Mo) se télécharge une seule fois depuis
   Hugging Face, puis il est gardé par le navigateur. La voix, elle, ne quitte jamais l'ordinateur.
   La bibliothèque (transformers.js, licence Apache-2.0) vient du CDN gratuit jsDelivr, version figée.
   Elle est chargée par import() DANS ce travailleur : la règle de sécurité des pages (script-src 'self') ne s'y applique
   pas. Si un jour le site envoie un en-tête Content-Security-Policy, il faudra y autoriser cdn.jsdelivr.net pour ce fichier. */
const BIBLIO = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
const MODELE = 'onnx-community/whisper-base';
let asr = null, chargement = null;

async function charger() {
  if (asr) return asr;
  if (!chargement) {
    chargement = (async () => {
      const { pipeline, env } = await import(BIBLIO);
      env.allowLocalModels = false;
      const progress_callback = p => {
        if (p && p.status === 'progress' && p.total) self.postMessage({ type: 'progres', fichier: p.file, charge: p.loaded, total: p.total });
      };
      // carte graphique (WebGPU) si le navigateur l'a : bien plus rapide ; sinon le processeur
      if (self.navigator && self.navigator.gpu) {
        try {
          return await pipeline('automatic-speech-recognition', MODELE, { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, progress_callback });
        } catch (e) { /* on passe au processeur */ }
      }
      return await pipeline('automatic-speech-recognition', MODELE, { device: 'wasm', dtype: 'q8', progress_callback });
    })();
  }
  try {
    asr = await chargement;
    self.postMessage({ type: 'pret' });
    return asr;
  } catch (e) {
    chargement = null;
    throw e;
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'charger') await charger();
    else if (data.type === 'audio') {
      const m = await charger();
      const r = await m(data.audio, { language: 'french', task: 'transcribe' });
      self.postMessage({ type: 'texte', id: data.id, texte: String((r && r.text) || '').trim() });
    }
  } catch (e) {
    self.postMessage({ type: 'erreur', id: data.id, message: String((e && e.message) || e).slice(0, 200) });
  }
};
