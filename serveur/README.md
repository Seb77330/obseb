# OBSeb Cloud

Le moteur du direct en ligne : ouvre la sortie OBSeb dans un Chrome invisible, encode en 1080p30 (x264, 6 Mb/s, AAC 160 kb/s), envoie à YouTube en RTMP et enregistre le live (gardé 10 jours, 1080p max).

- `moteur.js` : le moteur et son API (`/etat`, `/demarrer`, `/arreter`, `/enregistrements`).
- `cloud-init.yaml` : installation automatique sur un serveur Hetzner Ubuntu 24.04 (CPX32 conseillé). Adresse HTTPS automatique `<ip-avec-tirets>.sslip.io`.

Testé : capture image 1920x1080 + son, enregistrement MKV (h264 + aac 48 kHz).
Reste à brancher : création et suppression du serveur à la demande depuis la régie, archive en ligne.

## Sécurité (17/11)
- Le moteur n'écoute que sur 127.0.0.1 : on ne le joint que par Caddy, en HTTPS. Pare-feu (ufw) : seuls 22, 80, 443 et les ports vidéo sont ouverts.
- SSH par clé seulement, fail2ban, mises à jour de sécurité automatiques.
- Salles « sebk… » : le nom de la salle est tiré de la clé de la régie, donc personne ne peut se faire passer pour l'animateur.
- Salle d'attente : un invité n'a ni caméra, ni micro, ni rien à voir tant que l'animateur ne l'a pas fait entrer (`/salle/admettre`). L'animateur peut exclure (`/salle/exclure`) et fermer la salle à clé (`/salle/verrouiller`).
- Regarder sans être vu (sortie OBS, aperçus) : clé de la régie, ou invité déjà admis.
- Enregistrements : liens de téléchargement signés, valables 1 h (la clé secrète ne passe plus dans une adresse).

## Relais, « le facteur » (18/11)
Version sans OBS : le navigateur de l'animateur monte le live lui-même (fenêtre de diffusion, `sortie.html?diffuser=1`) et envoie UNE vidéo finie.
- Twitch : envoyée tout droit par le navigateur (WebRTC/WHIP officiel de Twitch), rien ne passe par le serveur.
- YouTube et les autres (pas de WebRTC chez eux) : la vidéo arrive au relais (MediaMTX, `mediamtx.yml`), ffmpeg la recopie
  SANS la réencoder (`-c:v copy`, seul le son passe en AAC) vers chaque plateforme, et en garde une copie (replay).
- API : `/relais/ouvrir`, `/relais/modifier`, `/relais/fermer`, `/relais/etat` (clé de la régie), `/whip/<chemin>` (jeton du relais), `/debit` (check-up).
- Mesuré le 18/11 en local : environ 10 % d'un cœur par live (ffmpeg ~6 %, MediaMTX ~4 %), image clé toutes les 2 s, 30 i/s, taille fixe.
- Un serveur à 2 cœurs peut relayer une dizaine de lives en même temps (`OBSEB_RELAIS_MAX`, 15 par défaut).
- L'ancien mode (le serveur monte tout dans un Chrome invisible) reste en secours pour les téléphones, Safari, Firefox et les petits PC.
