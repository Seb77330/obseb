/* OBSeb : l'adresse du service des comptes (Supabase).
   Ces deux valeurs sont publiques par nature : la clé « anon » ne permet que ce que les règles de sécurité
   de la base autorisent (serveur/supabase.sql). Tant qu'elles sont vides, le studio marche comme pendant la bêta,
   sans compte. */
'use strict';
const COMPTES_CONFIG = {
  url: '',
  cle: '',
};
