# Sources de MomoCAD

MomoCAD est livré en **un seul fichier `index.html`** (ouvrable partout, même sans serveur).
Ce fichier est **assemblé** à partir des sources rangées ici :

- `page/0*.html` : en-tête, styles, écran d'ouverture, interface, guide ;
- `js/NN-*.js` : le programme, découpé par thème (accroches, fonds de carte, données IGN, vue 3D, studio, terrain fini, cubatures, PDF, maillage, parois, toitures, mise en page…), réunis dans l'ordre des numéros ;
- `page/9*.html` : fin de page.

On modifie les sources, puis :

    node tools/build.js           # assemble index.html
    node tools/build.js --check   # vérifie que index.html correspond aux sources (fait aussi par l'intégration continue)

Les modules partagent le même espace (un seul script) : l'ordre des numéros compte pour ce qui s'exécute au chargement.
