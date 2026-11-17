#!/usr/bin/env python3
"""Colle l'empreinte de chaque fichier JS et CSS dans les pages qui le chargent (js/regie.js?v=1a2b3c4d).

Sans ça, juste après une mise en ligne, le navigateur peut garder un ancien script en mémoire (10 minutes
chez GitHub Pages) et le faire tourner avec la nouvelle page : la page reste alors vide.
Avec l'empreinte, un fichier modifié change d'adresse, donc il est toujours rechargé ; un fichier inchangé
garde la sienne et reste en mémoire.

À lancer avant chaque mise en ligne :  python3 outils/versionner.py          (toutes les pages)
                                       python3 outils/versionner.py index.html
"""
import hashlib, pathlib, re, sys

racine = pathlib.Path(__file__).resolve().parent.parent
pages = [racine / p for p in sys.argv[1:]] or sorted(racine.glob('*.html'))
motif = re.compile(r'\b(src|href)="((?:js|css)/[^"?#]+)(?:\?v=[0-9a-f]+)?"')

for page in pages:
    avant = page.read_text(encoding='utf-8')

    def empreinte(m):
        fichier = racine / m.group(2)
        if not fichier.is_file():
            return m.group(0)
        return f'{m.group(1)}="{m.group(2)}?v={hashlib.sha1(fichier.read_bytes()).hexdigest()[:8]}"'

    apres = motif.sub(empreinte, avant)
    if apres != avant:
        page.write_text(apres, encoding='utf-8')
        print('mis à jour :', page.name)
