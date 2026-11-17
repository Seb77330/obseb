# OBSeb

Régie live perso pour les lives de @sebastian_cineserie : coulisses pour les invités, régie dans le navigateur, une seule source OBS, un thème par live.

- `index.html` : mes sessions (un live = une session avec son thème) et mode d'emploi
- `regie.html` : la régie (ma caméra, scènes, mises en page, volume de chaque invité)
- `invite.html` : le lien envoyé aux invités (coulisses + aperçu du live)
- `sortie.html` : la source navigateur OBS (1920x1080). `?demo=5` affiche 5 tuiles factices.

Transport vidéo : vdo.ninja (WebRTC, gratuit). Tout tient dans les liens, aucun serveur.
- `obs/exporter-vers-obseb.lua` : script OBS (Outils > Scripts) avec le bouton « Exporter vers OBSeb ».
- `serveur/` : OBSeb Cloud, le direct 100 % en ligne (voir serveur/README.md).
