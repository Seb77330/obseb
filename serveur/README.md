# OBSeb Cloud

Le moteur du direct en ligne : ouvre la sortie OBSeb dans un Chrome invisible, encode en 1080p30 (x264, 6 Mb/s, AAC 160 kb/s), envoie à YouTube en RTMP et enregistre le live (gardé 14 jours).

- `moteur.js` : le moteur et son API (`/etat`, `/demarrer`, `/arreter`, `/enregistrements`).
- `cloud-init.yaml` : installation automatique sur un serveur Hetzner Ubuntu 24.04 (CPX32 conseillé). Adresse HTTPS automatique `<ip-avec-tirets>.sslip.io`.

Testé : capture image 1920x1080 + son, enregistrement MKV (h264 + aac 48 kHz).
Reste à brancher : création et suppression du serveur à la demande depuis la régie, archive en ligne.
