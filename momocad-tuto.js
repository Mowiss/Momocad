/* MomoCAD — module d'apprentissage (🎓 Apprendre)
   Fichier compagnon de MomoCAD : à placer dans le même dossier que index.html.
   Il n'est chargé qu'au clic sur le bouton 🎓 Apprendre. Il pilote une mascotte qui guide
   l'utilisateur pas à pas dans les outils de base (Dessin et Modif) et vérifie chaque action. */
(function () {
    'use strict';
    if (window.MomoTuto) return;

    // ---------- accès à l'état de MomoCAD (variables globales du script principal) ----------
    const G = {
        mode: () => { try { return mode; } catch (e) { return ''; } },
        shapes: () => { try { return shapes; } catch (e) { return []; } },
        sel: () => { try { return selectedShapes; } catch (e) { return []; } },
        hist: () => { try { return historyStep; } catch (e) { return 0; } },
        layers: () => { try { return layers; } catch (e) { return []; } },
        active: () => { try { return activeLayerId; } catch (e) { return ''; } },
        snap: (k) => { try { return !!snapSettings[k]; } catch (e) { return false; } },
        ortho: () => { try { return !!orthoMode; } catch (e) { return false; } },
        chain: () => { try { return dimChain; } catch (e) { return ''; } },
        dimAligned: () => { try { return !!dimTextAligned; } catch (e) { return false; } },
        psTab: () => { const e = document.querySelector('#cartouche-modal .ps-panel.on'); return e && G.shown('cartouche-modal') ? e.dataset.panel : ''; },
        val: (id) => { const e = document.getElementById(id); return e ? e.value : ''; },
        modalHas: (txt) => G.shown('topo-modal') && (document.getElementById('topo-modal').textContent || '').includes(txt),
        plats: () => { try { return G.shapes().filter(isPlateforme).length; } catch (e) { return 0; } },
        is3D: () => { try { return typeof is3DOpen === 'function' && !!is3DOpen(); } catch (e) { return false; } },
        shown: (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.style.display !== 'none' && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; },
    };
    let changes = 0;   // nombre d'actions enregistrées (chaque modification du plan passe par saveState)
    if (typeof window.saveState === 'function' && !window.saveState.__tuto) {
        const orig = window.saveState;
        window.saveState = function () { const r = orig.apply(this, arguments); changes++; return r; };
        window.saveState.__tuto = true;
    }
    const count = (type) => G.shapes().filter(s => !type || s.type === type).length;

    // ---------- les étapes ----------
    // target : bouton à montrer ; tip : texte de l'infobulle à côté du bouton ; say : texte de la mascotte
    // wait : fonction (ctx) -> true quand l'étape est réussie ; ctx garde l'état au début de l'étape
    const K = (t) => `<kbd>${t}</kbd>`;
    const BASE = [
        { title: 'Bonjour !', say: `Je suis <b>Momo</b>, je vais vous apprendre les outils de base de MomoCAD, en pratiquant directement sur le plan.<br><br>Chaque étape vous montre un bouton. Faites l'action : je passe à la suite dès que c'est réussi. ${K('Passer')} saute une étape, ✕ arrête la visite.<br><br>Astuce : travaillez sur un plan vierge, tout ce qu'on dessine pourra être effacé à la fin.`, manual: 'C\'est parti' },
        { title: 'Se déplacer', say: `Avant de dessiner, la souris :<br>• <b>molette</b> = zoomer / dézoomer, centré sur le curseur ;<br>• <b>clic molette maintenu</b> = faire glisser le plan ;<br>• <b>double-clic molette</b> = tout voir.<br><br>Essayez, puis cliquez « Suivant ».`, manual: 'Suivant' },
        // ----- DESSIN -----
        { title: 'Droite', target: 'btn-line', tip: 'Outil Droite<br><small>ou tapez DR puis Entrée</small>', say: `Choisissez l'outil <b>Droite</b> (palette Dessin).`, wait: () => G.mode() === 'line' },
        { title: 'Droite', target: 'btn-line', say: `Cliquez un premier point sur le plan, puis tapez ${K('5')} et ${K('Entrée')} : une droite de <b>5 m</b> part dans la direction de la souris.<br><small>Maintenez ${K('Maj')} pour la garder horizontale ou verticale.</small>`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Rectangle', target: 'btn-rect', tip: 'Outil Rectangle<br><small>ou QR + Entrée</small>', say: `Outil <b>Rectangle</b> maintenant.`, wait: () => G.mode() === 'rect' },
        { title: 'Rectangle', target: 'btn-rect', say: `Cliquez un premier coin, puis tapez la largeur ${K('8')} ${K('Espace')} et la hauteur ${K('5')} ${K('Entrée')} : rectangle de 8 × 5 m.<br><small>On peut aussi cliquer simplement le coin opposé.</small>`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Cercle', target: 'btn-circle', tip: 'Outil Cercle<br><small>ou RO + Entrée</small>', say: `Outil <b>Cercle</b> : cliquez le centre, puis tapez le rayon ${K('2')} ${K('Entrée')}.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Arc', target: 'btn-arc', tip: 'Outil Arc<br><small>ou AR + Entrée</small>', say: `Outil <b>Arc</b> : cliquez le <b>centre</b>, puis le <b>point de départ</b> (il donne le rayon), puis le <b>point de fin</b>. L'arc tourne du côté où va la souris.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Polygone', target: 'btn-poly', tip: 'Outil Polygone<br><small>ou PL + Entrée</small>', say: `Outil <b>Polygone</b> : cliquez 4 ou 5 sommets, puis recliquez le <b>premier</b> sommet (ou double-clic) pour fermer le contour.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Polyligne', target: 'btn-pline', tip: 'Outil Polyligne<br><small>ou PLI + Entrée</small>', say: `La <b>polyligne</b> est un tracé ouvert, pour une bordure ou un réseau : cliquez plusieurs points, puis ${K('Entrée')} ou double-clic pour terminer.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Hachure', target: 'btn-hatch', tip: 'Outil Hachure<br><small>ou HA + Entrée</small>', say: `Outil <b>Hachure</b> : cliquez <b>à l'intérieur</b> du rectangle. La zone est hachurée et sa surface s'affiche en bas.`, wait: (c) => count('hatch') > c.h, init: (c) => { c.h = count('hatch'); } },
        // ----- MODIF -----
        { title: 'Sélection', target: 'btn-select-box', tip: 'Sélection<br><small>ou Échap</small>', say: `Place aux modifications. Appuyez sur ${K('Échap')} (outil <b>Sélection</b>), puis <b>cliquez sur le cercle</b>. Il se colore et montre ses <b>poignées</b> bleues.<br><small>Maj + clic ajoute ou retire un objet ; une fenêtre tracée à la souris sélectionne plusieurs objets.</small>`, wait: () => G.mode() === 'select-box' && G.sel().length > 0 },
        { title: 'Poignées', say: `Tirez une <b>poignée</b> : celle du centre déplace l'objet, celles du tour changent le rayon. Sur un rectangle, la poignée au milieu d'un côté pousse ce côté.<br><br>Faites un essai.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; }, manual: 'Suivant' },
        { title: 'Déplacer', target: 'btn-move', tip: 'Déplacer<br><small>ou D + Entrée</small>', say: `Déplacement précis au clavier : sélectionnez un objet, puis tapez ${K('3')} ${K('Espace')} ${K('0')} ${K('Entrée')} : il se décale de 3 m vers la droite.<br><small>Avec l'outil Déplacer, on clique aussi un point de base puis la destination.</small>`, wait: (c) => changes > c.k && G.sel().length > 0, init: (c) => { c.k = changes; } },
        { title: 'Rotation', target: 'btn-rotate', tip: 'Rotation<br><small>ou R + Entrée</small>', say: `Sélectionnez le <b>rectangle</b>, puis l'outil <b>Rotation</b> : cliquez le centre de rotation, tapez ${K('30')} ${K('Entrée')}.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'rotate') c.seen = true; } },
        { title: 'Copier / coller', say: `Sélectionnez un objet, ${K('Ctrl')}+${K('C')} puis ${K('Ctrl')}+${K('V')}, et cliquez où poser la copie.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Décaler', target: 'btn-offset', tip: 'Décaler<br><small>ou DE + Entrée</small>', say: `Outil <b>Décaler</b> : tapez ${K('1')} ${K('Entrée')} (distance 1 m), cliquez le rectangle, puis cliquez <b>à l'extérieur</b> : une copie parallèle apparaît, 1 m plus loin.`, wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: (c) => { if (G.mode() === 'offset') c.seen = true; } },
        { title: 'Préparer la coupe', target: 'btn-line', tip: 'Droite', say: `Pour l'outil suivant, tracez une <b>droite qui traverse</b> le rectangle de part en part.`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Couper', target: 'btn-trim', tip: 'Couper / ajuster<br><small>ou C + Entrée</small>', say: `Outil <b>Couper</b> : cliquez le <b>bout de la droite qui dépasse</b> du rectangle. Le morceau est supprimé jusqu'au croisement.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'trim') c.seen = true; } },
        { title: 'Prolonger', target: 'btn-extend', tip: 'Prolonger<br><small>ou P + Entrée</small>', say: `L'inverse : outil <b>Prolonger</b>, cliquez près du bout coupé de la droite : elle s'allonge jusqu'au trait suivant.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'extend') c.seen = true; } },
        { title: 'Agrandir', target: 'btn-scale-up', tip: 'Agrandir<br><small>Réduire juste à côté</small>', say: `Sélectionnez le cercle, outil <b>Agrandir</b>, tapez ${K('2')} ${K('Entrée')} : il double de taille. <b>Réduire</b> fait l'inverse.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'scale-up' || G.mode() === 'scale-down') c.seen = true; } },
        { title: 'Étirer', target: 'btn-stretch', tip: 'Étirer<br><small>ou ET + Entrée</small>', say: `Outil <b>Étirer</b> : tracez une fenêtre (2 coins) autour d'<b>un seul côté</b> du rectangle, cliquez un point de base puis la destination : le rectangle s'allonge, l'autre côté ne bouge pas.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'stretch') c.seen = true; } },
        { title: 'Copie miroir', target: 'btn-mirror', tip: 'Copie miroir<br><small>ou MI + Entrée</small>', say: `Sélectionnez un objet, outil <b>Copie miroir</b>, cliquez 2 points pour l'axe, puis ${K('Entrée')} : le reflet est créé, l'original reste.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'mirror') c.seen = true; } },
        { title: 'Arrondir', target: 'btn-fillet', tip: 'Arrondir<br><small>ou RA + Entrée</small>', say: `Tracez deux droites qui forment un angle, puis outil <b>Arrondir</b> : cliquez la 1<sup>re</sup> droite, la 2<sup>e</sup>, tapez le rayon ${K('1')} ${K('Entrée')}. Les droites sont raccordées par un arc.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'fillet') c.seen = true; } },
        { title: 'Verrouiller', target: 'btn-group', tip: 'Verrouiller (bloc)', say: `Sélectionnez plusieurs objets (fenêtre à la souris), puis <b>Verrouiller</b> : ils forment un <b>bloc</b> qu'un seul clic sélectionne. <b>Éclater</b>, juste à côté, le défait.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; } },
        { title: 'Annuler', target: 'btn-undo', tip: 'Annuler<br><small>Ctrl+Z</small>', say: `Une erreur ? ${K('Ctrl')}+${K('Z')} annule la dernière action, ${K('Ctrl')}+${K('Y')} la rétablit. Essayez ${K('Ctrl')}+${K('Z')}.`, wait: (c) => G.hist() < c.h, init: (c) => { c.h = G.hist(); } },
        { title: 'Supprimer', say: `Pour effacer : sélectionnez puis ${K('Suppr')}. Une fenêtre tracée autour de tout le dessin, puis ${K('Suppr')}, nettoie l'exercice.`, manual: 'Suivant' },
        { title: 'Bravo !', say: `Vous connaissez les outils de base de <b>Dessin</b> et de <b>Modif</b>.<br><br>Pour aller plus loin :<br>• <b>Y</b> sur un objet sélectionné règle ses paramètres (calque, altitudes, plateforme…) ;<br>• le <b>guide</b> (bouton ⓘ en haut à droite) décrit chaque fonction, avec une recherche ; les autres tutos sont dans son dernier onglet, <b>🎓 Apprendre avec Momo</b> ;<br>• tapez les lettres d'une commande puis ${K('Entrée')} (DR, QR, RO…) pour aller plus vite.`, manual: 'Terminer', last: true },
    ];

    // ---------- 2. outils avancés ----------
    const seen = (m) => (c) => { if ([].concat(m).includes(G.mode())) c.seen = true; };
    const ADV = [
        { title: 'Outils avancés', say: `On passe à la vitesse supérieure : <b>accroches</b>, <b>calques</b>, réglages avec <b>Y</b>, <b>textes et cotes</b>, <b>blocs et murs</b>, puis <b>métré</b> et <b>impression</b>.<br><br>Un plan vierge est idéal ; le tuto « Les outils de base » est conseillé avant celui-ci.`, manual: 'C\'est parti' },
        // accroches et aides au tracé
        { title: 'Points d\'accroche', target: 'snapbtn-endpoint', tip: 'Barre des accroches', say: `La barre jaune en haut règle les <b>accroches</b> : extrémité ▢, milieu △, centre ⊙, intersection ✕, perpendiculaire ⊥… Bouton allumé = accroche active. En traçant, le curseur saute sur ces points (marqueur jaune).<br><br>Tracez une droite qui part <b>exactement</b> du milieu d'une autre, pour voir.`, manual: 'Suivant' },
        { title: 'Ortho projeté', target: 'snapbtn-track', tip: 'Ortho projeté', say: `Allumez l'<b>Ortho projeté</b>. Ensuite, en traçant, restez une demi-seconde sur un point d'accroche : il devient <b>violet</b>. Déplacez la souris à l'horizontale ou à la verticale : une ligne pointillée vous aligne sur ce point.`, wait: () => G.snap('track') },
        { title: 'Mode Ortho', target: 'btn-toggle-ortho', tip: 'Mode Ortho<br><small>ou F8</small>', say: `Le <b>mode Ortho</b> force tous les traits à l'horizontale ou à la verticale. Appuyez sur ${K('F8')} (ou le bouton en bas à droite).<br><small>${K('F8')} encore une fois pour l'éteindre.</small>`, wait: () => G.ortho() },
        // calques
        { title: 'Calques', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', say: `Les <b>calques</b> rangent le dessin (bordures, réseaux, cotes…) : chacun a sa couleur, son trait, son épaisseur. Ouvrez le <b>gestionnaire de calques</b>.`, wait: () => G.shown('layer-modal') },
        { title: 'Nouveau calque', target: 'new-layer-name', tip: 'Nom du calque', say: `Tapez un nom, par exemple <b>Réseau EU</b>, puis ${K('Entrée')} ou « Ajouter ». Le nouveau calque devient le <b>calque actif</b>.<br><small>Dans la liste : couleur, type de trait, épaisseur, hachure… Double-clic sur un nom pour le renommer.</small>`, wait: (c) => G.layers().length > c.n, init: (c) => { c.n = G.layers().length; } },
        { title: 'Dessiner sur un calque', target: 'btn-pline', tip: 'Polyligne', say: `Fermez le gestionnaire, puis tracez une <b>polyligne</b> : elle va sur le calque actif et prend sa couleur. Le calque actif se choisit aussi dans la liste en haut.`, wait: (c) => G.shapes().length > c.n && G.shapes()[G.shapes().length - 1].layerId === G.active(), init: (c) => { c.n = G.shapes().length; } },
        // Y
        { title: 'Paramétrer avec Y', say: `Sélectionnez un objet (outil Sélection, clic dessus), puis tapez ${K('Y')}. La fenêtre de paramètres s'ouvre : calque, altitudes, plateforme, talus… selon l'objet.`, wait: () => G.shown('selparam-modal') },
        { title: 'Changer de calque', target: 'selparam-layer', tip: 'Calque de l\'objet', say: `Dans cette fenêtre, choisissez un autre <b>calque</b> dans la liste, puis <b>Appliquer</b> : l'objet change de calque, et donc de couleur.<br><small>${K('N')} au lieu de ${K('Y')} ignore la proposition.</small>`, wait: (c) => c.open && !G.shown('selparam-modal') && changes > c.k, init: (c) => { c.k = changes; }, tick: (c) => { if (G.shown('selparam-modal')) c.open = true; } },
        // courbes
        { title: 'Plume', target: 'btn-pen', tip: 'Plume<br><small>ou PU + Entrée</small>', say: `La <b>plume</b> trace des courbes : <b>clic</b> = point anguleux, <b>cliquer-glisser</b> = point arrondi (on tire la tangente). ${K('Entrée')} ou double-clic pour terminer.`, wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen('pen') },
        // annotation
        { title: 'Texte', target: 'btn-text', tip: 'Texte<br><small>ou TX + Entrée</small>', say: `Outil <b>Texte</b> : cliquez sur le plan et tapez directement. ${K('Maj')}+${K('Entrée')} passe à la ligne, ${K('Entrée')} valide.`, wait: (c) => count('text') > c.n, init: (c) => { c.n = count('text'); } },
        { title: 'Infobulle', target: 'btn-detail', tip: 'Détail (infobulle)<br><small>ou IF + Entrée</small>', say: `Outil <b>Détail</b> : cliquez le point à désigner, puis l'endroit de l'étiquette, et tapez le texte. Une flèche relie l'étiquette au point.`, wait: (c) => count('detail') > c.n, init: (c) => { c.n = count('detail'); } },
        { title: 'Cote libre', target: 'btn-dim', tip: 'Cote libre', say: `Outil <b>Cote libre</b> : cliquez 2 points (les accroches aident), puis la position de la ligne de cote. Elle mesure la vraie distance.`, wait: (c) => count('dim') > c.n && c.seen, init: (c) => { c.n = count('dim'); }, tick: seen('dim') },
        { title: 'Cote ortho', target: 'btn-dim-ortho', tip: 'Cote ortho (H/V)', say: `Outil <b>Cote ortho</b> : 2 points, puis la ligne. Placée au-dessus ou en dessous = cote <b>horizontale</b> ; à gauche ou à droite = cote <b>verticale</b>.`, wait: (c) => count('dim') > c.n && c.seen, init: (c) => { c.n = count('dim'); }, tick: seen('dim-ortho') },
        { title: 'Cotes en série', target: 'btn-dim-ortho', tip: 'tapez 2 puis Espace', say: `Toujours dans un outil de cote, tapez ${K('2')} ${K('Espace')} : mode <b>successif</b> (cotes bout à bout). Cliquez 1<sup>er</sup> point, 2<sup>e</sup> point, ligne, puis d'autres points : chaque clic ajoute une cote. ${K('Entrée')} termine.<br><small>${K('1')} = cotes cumulées depuis le 1<sup>er</sup> point, ${K('0')} = cote simple.</small>`, wait: (c) => count('dim') >= c.n + 2 && c.ch, init: (c) => { c.n = count('dim'); }, tick: (c) => { if (G.chain() === 'succ' || G.chain() === 'cumul') c.ch = true; } },
        { title: 'Cote d\'angle', target: 'btn-dim-angle', tip: 'Cote angulaire', say: `Outil <b>Cote angulaire</b> : cliquez une 1<sup>re</sup> droite, une 2<sup>e</sup>, puis l'endroit de l'arc. L'angle s'affiche en degrés.`, wait: (c) => count('dim-angle') > c.n, init: (c) => { c.n = count('dim-angle'); } },
        { title: 'Sens des cotes', target: 'btn-dim-text', tip: 'Texte des cotes', say: `Ce bouton bascule le texte des cotes : <b>aligné</b> sur la ligne de cote ou toujours <b>horizontal</b>. Essayez-le et regardez vos cotes.`, wait: (c) => G.dimAligned() !== c.a, init: (c) => { c.a = G.dimAligned(); } },
        // blocs et murs
        { title: 'Catalogue de blocs', target: 'btn-blocks', tip: 'Catalogue de blocs<br><small>ou BL + Entrée</small>', say: `Ouvrez le <b>catalogue de blocs</b> et cliquez un bloc (une table, un arbre…). Il suit la souris : ${K('Maj')}+molette = taille, ${K('Ctrl')}+molette = rotation. Clic pour le poser, ${K('Échap')} pour finir.`, wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen('stamp') },
        { title: 'Murs', target: 'btn-blocks', tip: 'Catalogue › 🧱 Parois', say: `Dans le catalogue, onglet <b>🧱 Parois</b> : choisissez une paroi (parpaing 20, par exemple), cliquez le début puis la fin de chaque tronçon. Les angles se raccordent tout seuls ; ${K('Échap')} pour finir.<br><small>Avant le 1<sup>er</sup> clic, ${K('Tab')} change le côté du tracé.</small>`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: seen('wall') },
        { title: 'Mur en 3D', say: `Cliquez le mur (il se sélectionne en entier, comme un bloc), tapez ${K('Y')} : niveau bas et niveau haut. Il apparaît alors en volume dans la vue 3D (bouton œil 3D en bas à droite).`, manual: 'Suivant' },
        // métré et sorties
        { title: 'Métré', target: 'btn-metre', tip: 'Métré<br><small>ou ME + Entrée</small>', say: `Le bouton <b>Σ Métré</b> donne par calque les longueurs, surfaces et nombres d'objets, et les quantités de terrassement et de matériaux. « Copier (tableur) » le colle dans un devis. Ouvrez-le.`, wait: () => G.shown('topo-modal') },
        { title: 'Aperçu', target: 'btn-preview', tip: 'Aperçu avant impression', say: `Fermez le métré puis cliquez <b>Aperçu</b> : la feuille s'affiche sur fond blanc. Molette = échelle, ${K('Espace')} = portrait / paysage, clic = figer la page, ${K('Entrée')} = imprimer, ${K('Échap')} = quitter.`, wait: () => G.mode() === 'preview' },
        { title: 'Enregistrer', target: 'btn-dxf-menu', tip: 'Menu fichier', say: `${K('Échap')} pour quitter l'aperçu. Pour finir, le menu <b>fichier</b> :<br>• ${K('Ctrl')}+${K('S')} enregistre le plan complet en <b>.mmc</b> ;<br>• le <b>DXF</b> sert à échanger avec les géomètres et bureaux d'études ;<br>• le <b>gabarit .gbt</b> garde vos calques, cartouche, réglages et catalogue produits, pour toute l'équipe.`, manual: 'Suivant' },
        { title: 'Bravo !', say: `Vous maîtrisez les outils avancés : accroches, calques, paramètres ${K('Y')}, textes, cotes, blocs, murs, métré et impression.<br><br>Les prochains tutos (topographie, plateformes et cubatures, mise en page…) arriveront dans le guide, onglet <b>🎓 Apprendre avec Momo</b>.`, manual: 'Terminer', last: true },
    ];

    // ---------- 3. paramétrage (expert) ----------
    const PARAM = [
        { title: 'Le paramétrage', say: `Niveau <b>expert</b> : on règle MomoCAD pour qu'il sorte des plans « maison » : <b>paramètres ⛯</b>, <b>cartouche</b>, <b>catalogue produits</b>, <b>calques avancés</b>, et le <b>gabarit</b> qui garde tout ça pour toute l'équipe.`, manual: 'C\'est parti' },
        { title: 'Paramètres', target: 'btn-print-settings', tip: 'Paramètres ⛯', say: `Ouvrez les <b>Paramètres</b> : bouton ⛯ tout en haut à droite.`, wait: () => G.shown('cartouche-modal') },
        { title: 'Onglet Plan', target: '#cartouche-modal .ps-tab[data-tab="plan"]', tip: 'Onglet Plan', say: `Onglet <b>Plan</b> : la <b>précision d'affichage</b> (nombre de décimales des longueurs et des cotes) et le <b>carreau de la grille</b>, en mètres. Changez la précision avec <b>+</b> ou <b>−</b>.<br><small>Toutes les longueurs sont en mètres : rien à régler côté unité.</small>`, wait: (c) => G.psTab() === 'plan' && G.val('ps-decimals') !== c.d, init: (c) => { c.d = G.val('ps-decimals'); }, tick: (c) => { if (G.psTab() !== 'plan') c.d = G.val('ps-decimals'); } },
        { title: 'Onglet Impression', target: '#cartouche-modal .ps-tab[data-tab="print"]', tip: 'Onglet Impression', say: `Onglet <b>Impression</b> : format de feuille (A5 à A0), orientation, fichier produit (PDF, JPEG, PNG), avec l'aperçu de la feuille. Ouvrez-le.`, wait: () => G.psTab() === 'print' },
        { title: 'Le cartouche', target: '#cartouche-modal .ps-tab[data-tab="cart"]', tip: 'Onglet Cartouche', say: `Onglet <b>Cartouche</b> : modèle minimaliste ou <b>A4 grands plans</b>, titre du plan, client, dessinateur, indice, et le <b>logo</b> de l'entreprise (recadrage à l'import). Ouvrez-le et tapez un <b>titre de plan</b>.`, wait: (c) => G.psTab() === 'cart' && G.val('cartouche-plan') !== c.v, init: (c) => { c.v = G.val('cartouche-plan'); }, tick: (c) => { if (G.psTab() !== 'cart') c.v = G.val('cartouche-plan'); } },
        { title: 'Fond de plan', target: '#cartouche-modal .ps-tab[data-tab="fond"]', tip: 'Onglet Fond de plan', say: `Onglet <b>Fond de plan</b> : la carte posée sous un plan géoréférencé (satellite, photo IGN, plan) et les calques à télécharger avec : cadastre, communes, courbes de niveau, réseau routier…`, wait: () => G.psTab() === 'fond' },
        { title: 'Présentation', target: '#cartouche-modal .ps-tab[data-tab="pres"]', tip: 'Onglet Présentation', say: `Onglet <b>Présentation</b> : format, orientation, marge et traits de pliage de la feuille de <b>mise en page</b> (planches avec plusieurs fenêtres à l'échelle).`, wait: () => G.psTab() === 'pres' },
        { title: 'Catalogue produits', target: '#cartouche-modal .ps-tab[data-tab="mat"]', tip: 'Onglet Produits', say: `Onglet <b>Produits</b> : en tête, le prix du terrassement en <b>déblai</b> et en <b>remblai</b> ; dessous, les matériaux (densité, foisonnement, prix, unité du prix). Saisissez un <b>prix</b>, par exemple pour la GNT 0/31,5.<br><small>Ces prix chiffrent les structures de plateforme et le métré.</small>`, wait: () => { try { return G.psTab() === 'mat' && (matEdit || []).some(m => +m.prix > 0); } catch (e) { return false; } } },
        { title: 'Valider', target: '#cartouche-modal button[onclick="applyCartouche()"]', tip: 'Valider', say: `Cliquez <b>Valider</b> : les réglages s'appliquent, sont gardés sur ce poste et enregistrés dans le plan.<br><small>Annuler ferme sans rien changer.</small>`, wait: (c) => c.open && !G.shown('cartouche-modal'), tick: (c) => { if (G.shown('cartouche-modal')) c.open = true; } },
        { title: 'Calques avancés', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', say: `Retour au <b>gestionnaire de calques</b>, pour les réglages fins. Ouvrez-le.`, wait: () => G.shown('layer-modal') },
        { title: 'Ligne avec texte', target: '#layer-modal select[title="Type de ligne"]', tip: 'Type de ligne', say: `Sur un calque, choisissez le type de ligne <b>-T-</b>, puis tapez un texte dans la colonne <b>Libellé</b> (ex. <b>EU Ø160</b>) : tous les traits du calque s'afficheront ---EU Ø160---.`, wait: () => G.layers().some(l => l.dash === 'text' && (l.ltText || '').trim()) },
        { title: 'Texte, hachure, points', target: '#layer-modal select[title="Hachure"]', tip: 'Hachure du calque', say: `Les autres colonnes :<br>• <b>Texte mm</b> : vide = taille constante à l'écran ; une valeur = hauteur fixe sur la feuille ;<br>• <b>Hachure</b> et <b>Éch.</b> : motif et écartement des hachures du calque ;<br>• <b>Points</b> : symbole et étiquettes des points topo (matricule, altitude, code).<br><br>Changez le motif de hachure d'un calque.`, wait: (c) => JSON.stringify(G.layers().map(l => l.hatch || '')) !== c.h, init: (c) => { c.h = JSON.stringify(G.layers().map(l => l.hatch || '')); } },
        { title: 'Texte d\'un objet', say: `Fermez le gestionnaire. Un objet peut avoir <b>son propre texte</b> : sélectionnez un trait du calque -T-, tapez ${K('Y')}, chapitre « Texte de la ligne ». Il remplace celui du calque pour cet objet seulement.`, manual: 'Suivant' },
        { title: 'Le gabarit', target: 'btn-dxf-menu', tip: 'Menu fichier', say: `Tout ce réglage se garde dans un <b>gabarit .gbt</b> : menu fichier › <b>Enregistrer le gabarit</b>. Il contient les calques et leurs styles, les paramètres ⛯, le cartouche et le logo, les accroches, les talus par défaut, vos blocs et le <b>catalogue produits</b>.<br><br><b>Charger un gabarit</b> l'applique ; le dernier chargé revient tout seul au démarrage. Partagez-le : toute l'équipe a les mêmes plans et les mêmes prix.`, manual: 'Suivant' },
        { title: 'Bravo !', say: `Votre MomoCAD est réglé « maison » : paramètres, cartouche, prix, calques et gabarit.<br><br>Prochaine étape, le niveau <b>maître</b> : tuto <b>Les cubatures</b>, dans le guide.`, manual: 'Terminer', last: true },
    ];

    // ---------- 4. cubatures (maître) ----------
    function demoTerrain() {   // terrain d'exercice : 81 points cotés sur 40 × 40 m, pente et bosse
        try {
            const lay = ensureLayer('TN exercice', '#bef264'), added = [];
            for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
                const x = i * 5000, y = j * 5000, z = 100000 + x * 0.06 + y * 0.025 + 1200 * Math.exp(-((x - 26000) ** 2 + (y - 14000) ** 2) / 1.2e8);
                const pt = { type: 'point', layerId: lay, x: mmToWorld(x), y: -mmToWorld(y), z: Math.round(z), zk: 1, mat: 'TN' + (added.length + 1) };
                shapes.push(pt); added.push(pt);
            }
            saveState(); updateLayerUI(); zoomToFitShapes(added); draw();
            updateCommandMessageText('TERRAIN D\'EXERCICE : ' + added.length + ' points cotés (100 à 104 m) sur le calque « TN exercice ».');
        } catch (e) { alert('Impossible de créer le terrain : ' + e.message); }
    }
    const CUB = [
        { title: 'Les cubatures', say: `Niveau <b>maître</b> : terrain naturel, plateformes, talus, structure, puis <b>cubatures</b>, rapport PDF et métré chiffré.<br><br>Il faut un <b>terrain</b> : des points cotés (relevé de géomètre en DXF, semis CSV…). Pas de terrain sous la main ? Je vous en crée un d'exercice : 40 × 40 m, de 100 à 104 m.`, manual: 'Suivant', action: { label: 'Créer un terrain d\'exercice', fn: demoTerrain } },
        { title: 'Point topo', target: 'btn-topo', tip: 'Point topo<br><small>ou PT + Entrée</small>', say: `Un point coté se pose aussi à la main : outil <b>Point topo</b>, cliquez, tapez l'altitude (ex. ${K('101,5')}) puis ${K('Entrée')}.<br><small>Le Z s'affiche en bas à droite au survol des points cotés.</small>`, wait: (c) => count('point') > c.n, init: (c) => { c.n = count('point'); } },
        { title: 'Vue 3D', target: 'btn-view3d', tip: 'Vue 3D<br><small>ou VU + Entrée</small>', say: `Regardez le terrain en <b>3D</b> : bouton œil en bas à droite. Glisser = tourner, molette = zoom. <b>Aberration ×</b> exagère le relief. Recliquez l'œil ou ${K('Échap')} pour revenir.`, wait: () => G.is3D() },
        { title: 'Courbes de niveau', target: 'btn-contours', tip: 'Courbes de niveau<br><small>ou CN + Entrée</small>', say: `Revenez au plan, puis <b>Courbes de niveau</b> : choisissez l'équidistance (0,5 m par exemple) et générez-les.`, wait: (c) => G.shapes().filter(x => x.gen === 'contour').length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.gen === 'contour').length; } },
        { title: 'Dessiner la plateforme', target: 'btn-rect', tip: 'Rectangle', say: `Une <b>plateforme</b>, c'est une forme fermée avec une altitude. Tracez un <b>rectangle</b> dans le terrain (20 × 12 m par exemple).`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Donner son niveau', say: `Sélectionnez le rectangle, tapez ${K('Y')}, chapitre <b>Plateforme</b> : nom (ex. <b>Parking</b>) et <b>Z de tous les sommets</b> (ex. ${K('102')}), puis <b>Appliquer</b>. Le rectangle devient une plateforme et ses <b>talus</b> se dessinent jusqu'au terrain.`, wait: (c) => G.plats() > c.n, init: (c) => { c.n = G.plats(); } },
        { title: 'Les talus', say: `Rouvrez ${K('Y')} sur la plateforme, chapitre <b>Talus</b> : pente de <b>remblai</b> (bleu) et de <b>déblai</b> (rouge) en H/V (3/2 = 3 m à plat pour 2 m de haut), et points nez / pied de talus.<br><br>Une plateforme <b>inclinée</b> (rampe) se règle au même endroit : « Inclinée / rampe », un Z par sommet ou une pente.`, manual: 'Suivant' },
        { title: 'La structure', say: `Toujours dans ${K('Y')}, chapitre <b>▤ Structure</b> : ajoutez les couches (GNT 0/31,5 20 cm, GNT 0/80 30 cm, géotextile…). Case « Niveau = fini » : on terrasse au <b>fond de forme</b>. Le tableau donne volumes, foisonné, tonnage et prix. Appliquez.`, wait: () => G.shapes().some(x => x.struct && x.struct.layers && x.struct.layers.length) },
        { title: 'Lancer les cubatures', target: 'btn-cubature', tip: 'Cubatures<br><small>ou CU + Entrée</small>', say: `Bouton <b>Cubatures</b> : l'étape 1 liste les plateformes (cochez celles à calculer, renommez-les). Passez à <b>2. Résultats</b>.`, wait: (c) => window.__cubPdf && window.__cubPdf !== c.r, init: (c) => { c.r = window.__cubPdf; } },
        { title: 'Lire les résultats', say: `Déblai, remblai et solde ; puis pour chaque plateforme son volume, ses talus et sa structure (quantités par couche).<br><br>• <b>PDF</b> : rapport avec niveaux, vue en plan cotée et vues 3D ; <b>PDF + détail</b> ajoute le calcul triangle par triangle ;<br>• <b>Copier (tableur)</b> pour un devis ;<br>• <b>Tracer sur le plan</b> dessine la limite déblai / remblai.`, manual: 'Suivant' },
        { title: 'Plusieurs plateformes', say: `Ajoutez une 2<sup>e</sup> plateforme à un autre niveau, collée ou dedans (une fosse, un quai) : les talus se raccordent, rien n'est compté deux fois, une fosse est creusée dans le remblai de la grande plateforme.<br><br>Relancez les cubatures pour comparer : décocher une plateforme la retire du calcul.`, manual: 'Suivant' },
        { title: 'Profil en long', target: 'btn-profile', tip: 'Profil en long<br><small>ou PR + Entrée</small>', say: `<b>Profil en long</b> : cliquez les points d'un axe à travers la plateforme, puis ${K('Entrée')}. Le terrain et les traits 3D apparaissent en coupe, avec le tableau des cotes.`, wait: () => G.modalHas('Profil') },
        { title: 'Métré chiffré', target: 'btn-metre', tip: 'Métré', say: `Pour finir, <b>Σ Métré</b> : tableau <b>Terrassement et matériaux</b>, déblai, remblai et chaque produit des structures, avec les prix du catalogue et le <b>total HT</b>.`, wait: () => G.modalHas('Terrassement') },
        { title: 'Maître du terrassement !', say: `Terrain, plateformes, talus, structures, cubatures, rapport et métré chiffré : vous avez tout le circuit d'une étude de terrassement dans MomoCAD.<br><br>Le chapitre <b>Terrassement & devis</b> du guide détaille chaque cas (rampes, plateformes accolées, fosses, recouvrements).`, manual: 'Terminer', last: true },
    ];

    // ---------- interface ----------
    const CSS = `
    #mt-root { position:absolute; right:16px; bottom:52px; z-index:80; display:flex; align-items:flex-end; gap:10px; pointer-events:none; transition:right .25s; font-family: system-ui, 'Segoe UI', sans-serif; }
    #mt-bubble { pointer-events:auto; position:relative; width:330px; max-width:calc(100vw - 260px); background:#111827f2; color:#e5e7eb; border:1px solid #7c3aed; border-radius:14px; padding:12px 14px 10px; font-size:13.5px; line-height:1.45; box-shadow:0 12px 32px #0009; backdrop-filter: blur(4px); }
    #mt-bubble:after { content:''; position:absolute; right:-9px; bottom:34px; border:8px solid transparent; border-left-color:#7c3aed; border-right:0; }
    #mt-bubble .mt-h { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
    #mt-bubble .mt-t { font-weight:700; color:#fff; font-size:14.5px; }
    #mt-bubble .mt-n { color:#a78bfa; font-size:11px; font-weight:600; white-space:nowrap; }
    #mt-bubble .mt-x { color:#9ca3af; font-size:16px; line-height:1; padding:0 2px; background:none; border:0; cursor:pointer; }
    #mt-bubble .mt-x:hover { color:#fff; }
    #mt-bubble kbd { display:inline-block; min-width:18px; text-align:center; padding:0 5px; margin:0 1px; border:1px solid #6b7280; border-bottom-width:2px; border-radius:4px; background:#1f2937; color:#fde68a; font-family:ui-monospace,monospace; font-size:12px; }
    #mt-bubble small { color:#9ca3af; }
    #mt-bar { height:3px; background:#374151; border-radius:2px; margin:9px 0 8px; overflow:hidden; }
    #mt-bar i { display:block; height:100%; background:linear-gradient(90deg,#7c3aed,#f59e0b); transition:width .35s; }
    #mt-acts { display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap; }
    #mt-acts button { border:0; border-radius:6px; padding:5px 10px; font-size:12.5px; font-weight:600; cursor:pointer; }
    .mt-sec { background:#374151; color:#e5e7eb; } .mt-sec:hover { background:#4b5563; }
    .mt-pri { background:#7c3aed; color:#fff; } .mt-pri:hover { background:#8b5cf6; }
    #mt-ok { color:#86efac; font-weight:700; }
    #mt-root.mini #mt-bubble { display:none; } #mt-root.mini.peek #mt-bubble { display:block; }
    #mt-root.mini #mt-momo { width:62px; height:76px; }
    #mt-root.mini:not(.peek) #mt-momo:after { content:''; }
    #mt-dot { display:none; position:absolute; top:-4px; right:-4px; background:#7c3aed; color:#fff; font-size:11px; font-weight:800; border-radius:10px; padding:1px 6px; pointer-events:none; }
    #mt-root.mini:not(.peek) #mt-dot { display:block; }
    #mt-momo { pointer-events:auto; width:92px; height:112px; cursor:pointer; filter: drop-shadow(0 6px 10px #0008); animation: mt-float 3.2s ease-in-out infinite; }
    #mt-momo.jump { animation: mt-jump .6s ease-out; }
    #mt-momo .mt-eye { transform-box: fill-box; transform-origin:center; animation: mt-blink 4.6s infinite; }
    #mt-momo .mt-mouth { transform-box: fill-box; transform-origin:center top; }
    #mt-momo.talk .mt-mouth { animation: mt-talk .18s 6 alternate; }
    #mt-momo .mt-tassel { transform-box: view-box; transform-origin: 66px 22px; animation: mt-swing 2.4s ease-in-out infinite; }
    @keyframes mt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mt-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-22px) scale(1.06, .96); } 60% { transform: translateY(0) scale(.96, 1.05); } 100% { transform: translateY(0) scale(1); } }
    @keyframes mt-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
    @keyframes mt-talk { from { transform: scaleY(1); } to { transform: scaleY(.55); } }
    @keyframes mt-swing { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(7deg); } }
    #mt-ring { position:fixed; z-index:85; pointer-events:none; border:2px solid #f59e0b; border-radius:8px; box-shadow:0 0 0 4px #f59e0b44, 0 0 18px #f59e0b88; animation: mt-pulse 1.1s ease-in-out infinite; transition: all .25s; }
    @keyframes mt-pulse { 0%,100% { box-shadow:0 0 0 3px #f59e0b44, 0 0 10px #f59e0b66; } 50% { box-shadow:0 0 0 8px #f59e0b22, 0 0 22px #f59e0baa; } }
    #mt-tip { position:fixed; z-index:86; pointer-events:none; background:#f59e0b; color:#111827; font-weight:700; font-size:12.5px; line-height:1.3; padding:6px 10px; border-radius:8px; box-shadow:0 6px 16px #0008; white-space:nowrap; transition: top .25s, left .25s; }
    #mt-tip small { font-weight:500; color:#3b2a06; }
    #mt-tip:before { content:''; position:absolute; left:-7px; top:50%; margin-top:-7px; border:7px solid transparent; border-right-color:#f59e0b; border-left:0; }
    @media (prefers-reduced-motion: reduce) { #mt-momo, #mt-momo .mt-eye, #mt-momo .mt-tassel, #mt-ring { animation:none !important; } }`;

    // Momo : la toque de diplômé posée sur le visage O O / M du logo
    const MOMO_SVG = `<svg id="mt-momo" viewBox="0 0 100 122" xmlns="http://www.w3.org/2000/svg" aria-label="Momo, la mascotte">
        <defs><linearGradient id="mtCapTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5bc4"/><stop offset="1" stop-color="#3f2f86"/></linearGradient>
        <linearGradient id="mtCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c78"/><stop offset="1" stop-color="#271c55"/></linearGradient></defs>
        <path d="M27 24 Q50 32 73 24 L71 40 Q50 47 29 40 Z" fill="url(#mtCap)"/>
        <path d="M50 4 L94 20 L50 34 L6 20 Z" fill="url(#mtCapTop)" stroke="#2a1f5c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M6 20 L50 34 L94 20 L94 22.5 L50 36.5 L6 22.5 Z" fill="#2a1f5c"/>
        <circle cx="50" cy="19" r="2.6" fill="#f59e0b"/>
        <g class="mt-tassel"><path d="M50 19 Q60 21 66 22 L66 44" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M63 43 L69 43 L70 52 L62 52 Z" fill="#f59e0b"/><circle cx="66" cy="54" r="4.2" fill="#fb923c"/></g>
        <circle class="mt-eye" cx="32" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <circle class="mt-eye" cx="68" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <path class="mt-mouth" d="M36 116 L36 88 L50 104 L64 88 L64 116" fill="none" stroke="#a1a1aa" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;

    // catalogue des tutos (affiché dans le guide, onglet « Apprendre avec Momo ») : ajouter les suivants ici
    const TUTOS = [
        { id: 'base', level: 'Débutant', title: 'Les outils de base', desc: 'Dessin et Modif : droite, rectangle, cercle, arc, hachure, puis sélection, déplacer, rotation, couper, décaler…', minutes: 15, steps: BASE },
        { id: 'adv', level: 'Initié', title: 'Les outils avancés', desc: 'Accroches et Ortho, calques, paramètres avec Y, plume, textes et cotes, blocs et murs, métré, aperçu et enregistrement', minutes: 20, steps: ADV },
        { id: 'param', level: 'Expert', title: 'Le paramétrage', desc: 'Paramètres ⛯ (plan, impression, cartouche, fond de plan, présentation), catalogue produits et prix, calques avancés, gabarit d\'entreprise', minutes: 15, steps: PARAM },
        { id: 'cub', level: 'Maître', title: 'Les cubatures', desc: 'Terrain naturel, 3D, courbes de niveau, plateformes et talus, structure, cubatures et rapport PDF, profil en long, métré chiffré', minutes: 25, steps: CUB },
    ];
    let STEPS = BASE;
    let lastH = 0, root, bubble, ring, tip, momo, idx = 0, ctx = {}, timer = null, okUntil = 0;

    function build() {
        if (!document.getElementById('mt-css')) { const st = document.createElement('style'); st.id = 'mt-css'; st.textContent = CSS; document.head.appendChild(st); }
        const host = document.getElementById('canvas-container') || document.body;
        root = document.createElement('div'); root.id = 'mt-root';
        root.innerHTML = `<div id="mt-bubble"></div><div style="position:relative;pointer-events:auto;">${MOMO_SVG}<span id="mt-dot">…</span></div>`;
        host.appendChild(root);
        bubble = root.querySelector('#mt-bubble'); momo = root.querySelector('#mt-momo');
        momo.addEventListener('click', () => { if (root.classList.contains('mini')) { root.classList.toggle('peek'); return; } momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); });
        ring = document.createElement('div'); ring.id = 'mt-ring'; document.body.appendChild(ring);
        tip = document.createElement('div'); tip.id = 'mt-tip'; document.body.appendChild(tip);
        bubble.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act(b.dataset.a); });
        bubble.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    function act(a) {
        if (a === 'x') return stop();
        if (a === 'prev') return go(Math.max(0, idx - 1));
        if (a === 'act') { const s = STEPS[idx]; if (s.action) s.action.fn(); return; }
        if (a === 'next') { if (STEPS[idx].last) return stop(true); return go(idx + 1); }
    }
    function render(okMsg) {
        const s = STEPS[idx], n = STEPS.length;
        const btns = [];
        if (idx > 0) btns.push(`<button class="mt-sec" data-a="prev" title="Étape précédente">◀</button>`);
        if (s.action) btns.push(`<button class="mt-sec" data-a="act" style="background:#065f46;color:#d1fae5;">${s.action.label}</button>`);
        if (s.manual) btns.push(`<button class="mt-pri" data-a="next">${s.manual}</button>`);
        else btns.push(`<button class="mt-sec" data-a="next" title="Passer cette étape">Passer ▶</button>`);
        bubble.innerHTML = `<div class="mt-h"><span class="mt-t">${s.title}</span><span style="display:flex;align-items:center;gap:8px;"><span class="mt-n">${idx + 1} / ${n}</span><button class="mt-x" data-a="x" title="Arrêter la visite">✕</button></span></div>
            <div>${okMsg ? `<div id="mt-ok">✓ ${okMsg}</div>` : s.say}</div>
            <div id="mt-bar"><i style="width:${Math.round((idx + (okMsg ? 1 : 0)) / (n - 1) * 100)}%"></i></div><div id="mt-acts">${btns.join('')}</div>`;
        momo.classList.remove('talk'); void momo.getBoundingClientRect(); momo.classList.add('talk');
        place();
    }
    function targetEl() { const s = STEPS[idx]; if (!s || !s.target) return null; return document.getElementById(s.target) || (/[\[\.#\s]/.test(s.target) ? document.querySelector(s.target) : null); }
    // fenêtre ouverte (paramètres, calques, Y, cubatures…) : Momo ne doit pas cacher ses boutons
    function modalCard() {
        const L = [['topo-modal', 1], ['cartouche-modal', 1], ['selparam-modal', 1], ['layer-modal', 0], ['snap-modal', 0], ['help-modal', 1]];
        for (const [id, child] of L) { if (!G.shown(id)) continue; const e = document.getElementById(id), c = child ? e.firstElementChild : e; if (c) return c.getBoundingClientRect(); }
        return null;
    }
    function place() {
        // à côté du panneau des propriétés (en bas à droite) quand il est ouvert
        const pp = document.getElementById('properties-popup'), host = root.parentElement.getBoundingClientRect();
        let right = (pp && !pp.classList.contains('hidden') && pp.offsetWidth ? pp.offsetWidth + 40 : 16), mini = false;
        root.style.left = ''; root.style.right = right + 'px';
        const mc = modalCard();
        if (mc) {
            // zone qu'occuperait Momo à sa place normale (calculée, pas mesurée : sinon il oscille entre les deux modes)
            if (bubble.offsetHeight) lastH = bubble.offsetHeight;
            const W = 440, H = Math.max(lastH || 220, 130), zr = host.right - right, zb = host.bottom - 52;
            const rr = { left: zr - W, right: zr, top: zb - H, bottom: zb };
            const over = !(rr.right < mc.left || rr.left > mc.right || rr.bottom < mc.top || rr.top > mc.bottom);
            if (over) {
                if (mc.left - host.left >= W + 24) { root.style.right = (host.right - mc.left + 12) + 'px'; }
                else if (host.right - mc.right >= W + 24) { root.style.right = '16px'; }
                else { mini = true; root.style.right = 'auto'; root.style.left = '8px'; }
            }
        }
        root.classList.toggle('mini', mini); if (!mini) root.classList.remove('peek');
        const t = targetEl(), s = STEPS[idx];
        if (!t) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        if (!t.offsetParent) { const pal = t.closest('.pal'); if (pal && pal.dataset.pal && typeof togglePal === 'function' && pal.classList.contains('closed')) togglePal(pal.dataset.pal); }
        const r = t.getBoundingClientRect();
        if (!r.width) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        const aside = t.closest('aside'); if (aside) { const ar = aside.getBoundingClientRect(); if (r.top < ar.top || r.bottom > ar.bottom) t.scrollIntoView({ block: 'nearest' }); }
        Object.assign(ring.style, { display: 'block', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
        if (s.tip) { tip.innerHTML = s.tip; tip.style.display = 'block'; const th = tip.offsetHeight; tip.style.left = (r.right + 14) + 'px'; tip.style.top = Math.max(6, r.top + r.height / 2 - th / 2) + 'px'; }
        else tip.style.display = 'none';
    }
    function go(i) {
        idx = Math.min(i, STEPS.length - 1); ctx = {}; okUntil = 0;
        const s = STEPS[idx]; if (s.init) s.init(ctx);
        render();
    }
    const BRAVO = ['Bravo !', 'Parfait !', 'Bien joué !', 'Exactement !', 'Super !', 'C\'est ça !'];
    function tick() {
        if (!root || !root.isConnected) return stop();
        place();
        if (okUntil) { if (Date.now() > okUntil) go(idx + 1); return; }
        const s = STEPS[idx];
        if (s.tick) s.tick(ctx);
        if (s.wait && !s.manual) {
            let ok = false; try { ok = s.wait(ctx); } catch (e) {}
            if (ok) { okUntil = Date.now() + 1100; render(BRAVO[idx % BRAVO.length]); momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); }
        }
    }
    function start(id) {
        const T = TUTOS.find(t => t.id === id) || TUTOS[0]; STEPS = T.steps;
        if (root && root.isConnected) { go(0); return; }
        build(); go(0);
        clearInterval(timer); timer = setInterval(tick, 250);
        window.addEventListener('resize', place);
    }
    function stop() {
        clearInterval(timer); timer = null;
        [root, ring, tip].forEach(e => e && e.remove()); root = null;
        window.removeEventListener('resize', place);
    }
    window.MomoTuto = { start, stop, list: TUTOS };
})();
