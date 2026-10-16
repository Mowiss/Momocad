/* MomoCAD — module d'apprentissage (🎓 Apprendre avec Momo)
   Fichier compagnon de MomoCAD : à placer dans le même dossier que index.html.
   Il n'est chargé qu'à l'ouverture d'un tuto. Momo, la mascotte, explique à quoi sert chaque outil,
   fait faire le geste sur le plan, coche l'étape quand elle est réussie ; on avance soi-même avec les flèches. */
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
        polar: () => { try { return !!t2Polar.on; } catch (e) { return false; } },
        measured: () => { try { return mode === 'measure' && t2.ms.length >= 2; } catch (e) { return false; } },
        chain: () => { try { return dimChain; } catch (e) { return ''; } },
        dimAligned: () => { try { return !!dimTextAligned; } catch (e) { return false; } },
        psTab: () => { const e = document.querySelector('#cartouche-modal .ps-panel.on'); return e && G.shown('cartouche-modal') ? e.dataset.panel : ''; },
        val: (id) => { const e = document.getElementById(id); return e ? e.value : ''; },
        modalHas: (txt) => G.shown('topo-modal') && (document.getElementById('topo-modal').textContent || '').includes(txt),
        plats: () => { try { return G.shapes().filter(isPlateforme).length; } catch (e) { return 0; } },
        is3D: () => { try { return typeof is3DOpen === 'function' && !!is3DOpen(); } catch (e) { return false; } },
        kind: (k) => G.shapes().filter(x => x.solid && x.solid.kind === k).length,
        named: (n) => G.shapes().filter(x => x.type === 'mesh' && x.name === n).length,
        palOpen: (k) => { const e = document.querySelector('.pal[data-pal="' + k + '"]'); return !!e && !e.classList.contains('closed'); },
        shown: (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.style.display !== 'none' && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; },
    };
    let changes = 0;   // nombre d'actions enregistrées (chaque modification du plan passe par saveState)
    if (typeof window.saveState === 'function' && !window.saveState.__tuto) {
        const orig = window.saveState;
        window.saveState = function () { const r = orig.apply(this, arguments); changes++; return r; };
        window.saveState.__tuto = true;
    }
    const count = (type) => G.shapes().filter(s => !type || s.type === type).length;
    const K = (t) => `<kbd>${t}</kbd>`, SP = K('Espace');
    const ol = (...a) => '<ol>' + a.map(x => `<li>${x}</li>`).join('') + '</ol>';
    const seen = (m) => (c) => { if ([].concat(m).includes(G.mode())) c.seen = true; };
    // « l'outil a été utilisé et le plan a changé »
    const used = (m) => ({ wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: seen(m) });
    const more = (m, n) => ({ wait: (c) => G.shapes().length >= c.n + (n || 1) && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen(m) });

    // ---------- les étapes ----------
    // title · why (à quoi ça sert, pourquoi) · do (ce qu'on fait) · more (astuce) · target / tip (bouton montré)
    // wait (ctx) -> true quand c'est réussi : l'étape se coche, on passe à la suite avec ▶ quand on veut
    // ===================================================================== 1. LES OUTILS DE BASE
    const BASE = [
        { title: 'Bonjour, je suis Momo !', why: `Je vais vous apprendre les outils de base de MomoCAD <b>en pratiquant</b>, directement sur votre plan. À chaque étape je vous dis <b>à quoi sert</b> l'outil, puis ce qu'il faut faire.`,
          do: `Quand vous avez réussi, l'étape se <b>coche ✓</b> toute seule. Prenez le temps de lire : rien ne change tant que vous ne cliquez pas sur ${K('▶')}.<br>${K('◀')} revient en arrière, ✕ arrête la visite.`,
          more: `Travaillez plutôt sur un plan vierge : tout ce qu'on dessine pourra être effacé à la fin.` },
        { title: 'Se déplacer dans le plan', why: `Avant de dessiner, il faut savoir regarder : zoomer sur un détail, revenir à l'ensemble, faire glisser la feuille.`,
          do: `Essayez avec la souris :<ul><li><b>molette</b> = zoomer, autour du curseur ;</li><li><b>clic molette maintenu</b> = faire glisser le plan ;</li><li><b>double-clic molette</b> = tout voir d'un coup.</li></ul>`,
          more: `Le bouton rond au-dessus d'<b>ISO</b>, près de la rosace en haut à droite, fait aussi « tout voir ».` },
        // ----- DESSIN
        { title: 'La droite', target: 'btn-line', tip: 'Droite<br><small>ou DR + Espace</small>', why: `La droite est le trait de base de tout plan : une bordure, une limite, un axe de voirie. Dans MomoCAD on la dessine <b>à la cote</b>, pas à l'œil.`,
          do: `Choisissez l'outil <b>Droite</b> dans la palette Dessin (je vous le montre en orange).`, wait: () => G.mode() === 'line' },
        { title: 'Une droite à la cote', target: 'btn-line', why: `Taper la longueur au clavier garantit un plan juste : c'est le réflexe à prendre dès maintenant.`,
          do: ol('Cliquez un premier point sur le plan.', `Tapez ${K('5')} : la valeur s'affiche près du curseur.`, `Appuyez sur ${SP} : une droite de <b>5 m</b> part dans la direction de la souris.`),
          more: `${SP} valide partout dans MomoCAD. Maintenez ${K('Maj')} pour rester horizontal ou vertical.`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Le rectangle', target: 'btn-rect', tip: 'Rectangle<br><small>ou QR + Espace</small>', why: `Un bâtiment, une place de parking, une emprise de chantier : le rectangle est la forme la plus courante. On peut lui donner ses dimensions exactes.`,
          do: ol('Choisissez l\'outil <b>Rectangle</b>.', 'Cliquez un premier coin.', `Tapez la largeur ${K('8')} ${SP}, puis la hauteur ${K('5')} ${SP}.`),
          more: `On peut aussi simplement cliquer le coin opposé.`, wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen('rect') },
        { title: 'Le cercle', target: 'btn-circle', tip: 'Cercle<br><small>ou RO + Espace</small>', why: `Pour un regard, un arbre, un giratoire, un poteau.`,
          do: ol('Outil <b>Cercle</b>.', 'Cliquez le centre.', `Tapez le rayon ${K('2')} ${SP}.`), wait: (c) => count('circle') > c.n, init: (c) => { c.n = count('circle'); } },
        { title: 'L\'ellipse', target: 'btn-ellipse', tip: 'Ellipse<br><small>ou ELL + Espace</small>', why: `Un massif planté, un bassin ovale, un îlot : quand le cercle ne suffit pas.`,
          do: ol('Outil <b>Ellipse</b>.', 'Cliquez le centre.', 'Cliquez le bout de la longueur (ou tapez-la + Espace).', 'Cliquez la largeur (ou tapez-la + Espace).'),
          more: `C'est une forme fermée : on peut la hachurer, et même l'extruder en volume.`, wait: (c) => G.shapes().filter(x => x.ell).length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.ell).length; } },
        { title: 'L\'arc', target: 'btn-arc', tip: 'Arc<br><small>ou AR + Espace</small>', why: `Une bordure courbe, un rayon de giration au bout d'une rue.`,
          do: ol('Outil <b>Arc</b>.', 'Cliquez le <b>centre</b>.', 'Cliquez le <b>point de départ</b> : il donne le rayon.', 'Cliquez le <b>point de fin</b> : l\'arc tourne du côté où va la souris.'), wait: (c) => count('arc') > c.n, init: (c) => { c.n = count('arc'); } },
        { title: 'Le polygone', target: 'btn-poly', tip: 'Polygone<br><small>ou PL + Espace</small>', why: `Une forme fermée quelconque : une parcelle, une emprise de travaux. Fermée, elle a une surface, et pourra devenir une plateforme ou une hachure.`,
          do: ol('Outil <b>Polygone</b>.', 'Cliquez 4 ou 5 sommets.', 'Recliquez le <b>premier</b> sommet (ou double-clic) pour fermer.'), wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen('poly') },
        { title: 'La polyligne', target: 'btn-pline', tip: 'Polyligne<br><small>ou PLI + Espace</small>', why: `Un tracé ouvert d'un seul tenant : un réseau, une bordure, un fil d'eau. Un seul objet, donc une seule longueur au métré.`,
          do: ol('Outil <b>Polyligne</b>.', 'Cliquez plusieurs points.', `${SP} ou double-clic pour terminer.`), wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: seen('pline') },
        { title: 'La hachure', target: 'btn-hatch', tip: 'Hachure<br><small>ou HA + Espace</small>', why: `Pour montrer une surface (enrobé, espace vert, béton) <b>et</b> connaître son aire : MomoCAD la calcule pour vous.`,
          do: ol('Outil <b>Hachure</b>.', 'Cliquez <b>à l\'intérieur</b> du rectangle.', 'Lisez la surface affichée en bas de l\'écran.'), wait: (c) => count('hatch') > c.h, init: (c) => { c.h = count('hatch'); } },
        { title: 'Le point', target: 'btn-point', tip: 'Point<br><small>ou PN + Espace</small>', why: `Un repère tout simple : un piquet d'implantation, le centre d'un arbre, un point à retrouver.`,
          do: ol('Outil <b>Point</b>.', 'Cliquez pour en poser un ou deux (les accroches aident).', `${K('Échap')} pour finir.`), wait: (c) => count('point') > c.n && c.seen, init: (c) => { c.n = count('point'); }, tick: seen('point') },
        // ----- SÉLECTION ET MODIF
        { title: 'Sélectionner', target: 'btn-select-box', tip: 'Sélection<br><small>ou Échap</small>', why: `Avant de modifier, on choisit les objets. MomoCAD offre trois gestes : un clic sur l'objet ; un clic dans le vide puis un second clic (une <b>fenêtre</b>) ; ou bouton maintenu en glissant (un <b>lasso</b> à main levée).`,
          do: ol(`Appuyez sur ${K('Échap')} : vous êtes dans l'outil Sélection.`, 'Cliquez sur le cercle : il se colore en rose et montre ses <b>poignées</b> bleues.'),
          more: `${K('Maj')} + clic ajoute ou retire un objet. Les propriétés (rayon, surface…) s'affichent en bas à droite.`, wait: () => G.mode() === 'select-box' && G.sel().length > 0 },
        { title: 'Fenêtre et lasso', why: `Pour attraper plusieurs objets d'un coup. La fenêtre est rapide pour une zone rectangulaire ; le lasso suit une forme irrégulière (un îlot, un bâtiment en L).`,
          do: ol('Cliquez dans le vide, relâchez, puis cliquez un 2<sup>e</sup> coin : tout ce qui est <b>entièrement</b> dans la fenêtre est sélectionné.', 'Puis essayez le lasso : bouton maintenu, faites le tour de quelques objets, relâchez.'),
          wait: (c) => G.sel().length >= 2 && G.mode() === 'select-box', init: () => {} },
        { title: 'Les poignées', why: `Les poignées retouchent un objet à la souris, sans outil : agrandir un cercle, pousser le côté d'un rectangle, déplacer un sommet.`,
          do: `Sélectionnez un objet et tirez une poignée : celle du centre déplace l'objet, celles du tour changent le rayon, celle au milieu d'un côté pousse ce côté.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; } },
        { title: 'Déplacer', target: 'btn-move', tip: 'Déplacer<br><small>ou D + Espace</small>', why: `Repositionner un objet <b>exactement</b>, d'une distance connue ou d'un point précis à un autre.`,
          do: ol('Sélectionnez un objet.', `Tapez ${K('3')} ${SP} ${K('0')} ${SP} : il se décale de 3 m vers la droite (X, puis Y).`),
          more: `Avec l'outil Déplacer, on clique un point de base puis la destination. Et pendant le déplacement, ${K('C')} garde l'original : on pose des copies.`, wait: (c) => changes > c.k && G.sel().length > 0, init: (c) => { c.k = changes; } },
        { title: 'Copier', target: 'btn-copy', tip: 'Copier<br><small>ou CP + Espace</small>', why: `Reproduire un objet plusieurs fois au bon endroit : des regards le long d'un réseau, des arbres d'alignement, des plots. L'original ne bouge pas.`,
          do: ol('Sélectionnez un objet, puis l\'outil <b>Copier</b>.', 'Cliquez un point de base (un coin, le centre…).', `Cliquez deux ou trois endroits : une copie à chaque clic. Ou tapez une distance + ${SP}.`, `${SP} seul pour terminer.`), ...more('copy', 2) },
        { title: 'Rotation', target: 'btn-rotate', tip: 'Rotation<br><small>ou R + Espace</small>', why: `Orienter un bâtiment, un bloc ou un plan importé selon le terrain.`,
          do: ol('Sélectionnez le rectangle.', 'Outil <b>Rotation</b>, cliquez le centre de rotation.', `Tapez ${K('30')} ${SP} : il tourne de 30°.`), more: `${K('C')} pendant la rotation garde l'original : on obtient une copie tournée.`, ...used('rotate') },
        { title: 'Décaler', target: 'btn-offset', tip: 'Décaler<br><small>ou DE + Espace</small>', why: `Une copie <b>parallèle</b> à distance fixe : la largeur d'un trottoir, la seconde ligne d'une bordure, un fil d'eau à 50 cm.`,
          do: ol(`Outil <b>Décaler</b>, tapez ${K('1')} ${SP} (distance 1 m).`, 'Cliquez le cercle.', 'Cliquez à l\'extérieur : un cercle parallèle apparaît, 1 m plus loin.'), ...more('offset') },
        { title: 'Préparer la coupe', target: 'btn-line', tip: 'Droite', why: `Pour l'outil suivant, il nous faut un trait qui dépasse.`, do: `Tracez une <b>droite qui traverse</b> le rectangle de part en part.`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Couper', target: 'btn-trim', tip: 'Couper<br><small>ou C + Espace</small>', why: `Nettoyer les dépassements sans redessiner : on clique le morceau en trop, il disparaît jusqu'aux traits qui le croisent.`,
          do: `Outil <b>Couper</b> : cliquez le <b>bout de la droite qui dépasse</b> du rectangle.`, ...used('trim') },
        { title: 'Prolonger', target: 'btn-extend', tip: 'Prolonger<br><small>ou P + Espace</small>', why: `L'inverse : un trait trop court rejoint le trait suivant, sans calcul.`, do: `Outil <b>Prolonger</b> : cliquez près du bout coupé de la droite.`, ...used('extend') },
        { title: 'Longueur', target: 'btn-lengthen', tip: 'Longueur<br><small>ou LO + Espace</small>', why: `Donner une longueur exacte à un trait existant : « cette bordure fait 12 m », sans la redessiner.`,
          do: ol('Outil <b>Longueur</b>.', 'Cliquez près d\'un bout de la droite : il suit la souris.', `Tapez ${K('6')} ${SP} : la droite mesure maintenant 6 m.`),
          more: `Autre façon : tapez d'abord <b>+0,5</b> (ou -0,5) ${SP}, puis cliquez autant de bouts que vous voulez.`, ...used('lengthen') },
        { title: 'Couper au point', target: 'btn-break', tip: 'Couper au point<br><small>ou CA + Espace</small>', why: `Séparer un trait en deux <b>sans rien effacer</b> : pour changer de calque sur une partie, ou arrêter un réseau à un regard.`,
          do: `Outil <b>Couper au point</b> : cliquez au milieu d'une droite. Elle devient deux droites (sélectionnées).`, ...used('break') },
        { title: 'Joindre', target: 'btn-join', tip: 'Joindre<br><small>ou JO + Espace</small>', why: `Le geste inverse, et très utile : des traits qui se touchent bout à bout deviennent <b>une seule polyligne</b>. Une emprise dessinée en plusieurs morceaux devient ainsi une forme fermée, prête pour une hachure, une plateforme ou des cubatures.`,
          do: ol('Sélectionnez les deux morceaux que vous venez de couper.', 'Cliquez <b>Joindre</b> : ils ne font plus qu\'un.'), ...used('join') },
        { title: 'Agrandir et réduire', target: 'btn-scale-up', tip: 'Agrandir<br><small>Réduire juste à côté</small>', why: `Changer la taille d'un dessin d'un facteur, ou le caler sur une longueur connue (un plan scanné, par exemple).`,
          do: ol('Sélectionnez le cercle.', `Outil <b>Agrandir</b>, tapez ${K('2')} ${SP} : il double de taille.`),
          more: `Dans Agrandir, ${K('R')} = <b>par référence</b> : un point fixe, les deux bouts d'une longueur connue, puis sa vraie longueur.`, ...used(['scale-up', 'scale-down']) },
        { title: 'Étirer', target: 'btn-stretch', tip: 'Étirer<br><small>ou ET + Espace</small>', why: `Allonger un bâtiment ou une place sans déformer le reste : seuls les sommets pris dans la fenêtre bougent.`,
          do: ol('Outil <b>Étirer</b> : tracez une fenêtre (2 clics) autour d\'<b>un seul côté</b> du rectangle.', 'Cliquez un point de base, puis la destination.'), ...used('stretch') },
        { title: 'Copie miroir', target: 'btn-mirror', tip: 'Copie miroir<br><small>ou MI + Espace</small>', why: `Dessiner une moitié et obtenir l'autre : un bâtiment symétrique, un carrefour.`,
          do: ol('Sélectionnez un objet, outil <b>Copie miroir</b>.', 'Cliquez 2 points pour l\'axe.', `${SP} : le reflet est créé, l'original reste.`), ...used('mirror') },
        { title: 'Arrondir', target: 'btn-fillet', tip: 'Arrondir<br><small>ou RA + Espace</small>', why: `Raccorder deux droites par un arc : un angle de bordure, un rayon de giration.`,
          do: ol('Tracez deux droites qui forment un angle.', 'Outil <b>Arrondir</b> : cliquez la 1<sup>re</sup> droite, puis la 2<sup>e</sup>.', `Tapez le rayon ${K('1')} ${SP}.`), ...used('fillet') },
        { title: 'Chanfrein', target: 'btn-chamfer', tip: 'Chanfrein<br><small>ou CH + Espace</small>', why: `Un <b>pan coupé</b> à la place de l'angle : angle de bâtiment, bordure biaise, angle de carrefour.`,
          do: ol('Encore deux droites en angle.', 'Outil <b>Chanfrein</b> : cliquez-les l\'une après l\'autre.', `Tapez ${K('1')} ${SP} (ou deux reculs différents : 0,5/1).`), ...used('chamfer') },
        { title: 'Verrouiller en bloc', target: 'btn-group', tip: 'Verrouiller (bloc)', why: `Réunir plusieurs objets en un <b>bloc</b> qu'un seul clic sélectionne : un mobilier, un détail, un ensemble qu'on ne veut pas défaire par erreur.`,
          do: `Sélectionnez plusieurs objets (fenêtre ou lasso), puis <b>Verrouiller</b>. <b>Éclater</b> le défait.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; } },
        { title: 'Annuler', target: 'btn-undo', tip: 'Annuler<br><small>Ctrl+Z</small>', why: `Pas de panique en cas d'erreur : tout s'annule.`, do: `Appuyez sur ${K('Ctrl')}+${K('Z')} pour annuler la dernière action. ${K('Ctrl')}+${K('Y')} la rétablit.`, wait: (c) => G.hist() < c.h, init: (c) => { c.h = G.hist(); } },
        { title: 'Faire le ménage', why: `Pour repartir d'un plan propre.`, do: `Sélectionnez avec une grande fenêtre autour de tout le dessin, puis ${K('Suppr')}.` },
        { title: 'Bravo, débutant diplômé !', why: `Vous savez dessiner à la cote, sélectionner de trois façons et modifier sans tout refaire.`,
          do: `Pour aller plus loin :<ul><li>${K('Y')} sur un objet sélectionné règle tous ses paramètres ;</li><li>le <b>guide</b> (bouton ⓘ en haut à droite) décrit chaque outil avec des schémas ;</li><li>tapez les lettres d'une commande puis ${SP} (DR, QR, RO, CP…) pour aller plus vite.</li></ul>`,
          more: `Prochain tuto : <b>Les outils avancés</b> (niveau Initié).`, last: true },
    ];

    // ===================================================================== 2. LES OUTILS AVANCÉS
    const ADV = [
        { title: 'Les outils avancés', why: `On passe à la vitesse supérieure : dessiner <b>juste</b> grâce aux accroches, <b>ranger</b> avec les calques, <b>répéter</b> avec le réseau, <b>contrôler</b> avec la mesure, <b>habiller</b> avec les textes et les cotes, puis sortir le plan.`,
          do: `Un plan vierge est idéal. Le tuto « Les outils de base » est conseillé avant celui-ci.` },
        { title: 'Les points d\'accroche', target: 'snapbtn-endpoint', tip: 'Barre des accroches', why: `Un trait qui « tombe presque » sur un autre fausse les surfaces, les hachures et les cubatures. Les accroches font sauter le curseur <b>exactement</b> sur le bout d'un trait, son milieu, un centre, un croisement…`,
          do: ol('Regardez la barre jaune en haut : un bouton par type d\'accroche (allumé = actif).', 'Tracez une droite qui part <b>exactement</b> du milieu d\'une autre : le repère jaune apparaît quand vous approchez.'),
          more: `Les repères n'apparaissent que pendant un tracé, jamais en simple sélection.` },
        { title: 'Tangente et proche', target: 'snapbtn-tangent', tip: 'Accroche tangente', why: `<b>Tangente</b> : depuis un point, le trait vient toucher un cercle sans le couper (une bordure qui longe un regard). <b>Proche</b> : on accroche n'importe quel point d'un trait.`,
          do: `Vérifiez que la <b>tangente</b> est allumée, puis dessinez un cercle et une droite qui part d'à côté : approchez le bord du cercle, le repère bleu rond barré apparaît.`, wait: () => G.snap('tangent') },
        { title: 'Le mode Ortho', target: 'btn-toggle-ortho', tip: 'Mode Ortho<br><small>ou F8</small>', why: `Comme une équerre : tous les traits restent horizontaux ou verticaux. Idéal pour un bâtiment ou un réseau orthogonal.`,
          do: `Appuyez sur ${K('F8')} (ou le bouton en bas à droite). Un second ${K('F8')} l'éteint.`, wait: () => G.ortho() },
        { title: 'Le suivi polaire', target: 'btn-toggle-polar', tip: 'Suivi polaire<br><small>ou F10</small>', why: `Pour tracer à 45°, 30°, 15° sans calculer : le trait s'aimante aux angles ronds et une ligne pointillée bleue vous le montre.`,
          do: ol(`Éteignez l'Ortho (${K('F8')}), puis allumez le suivi polaire avec ${K('F10')}.`, 'Tracez une droite : en approchant 45°, elle se cale.'), more: `Clic droit sur le bouton pour changer le pas (5°, 10°, 15°, 22,5°, 30°, 45°, 90°).`, wait: () => G.polar() && !G.ortho() },
        { title: 'L\'ortho projeté', target: 'snapbtn-track', tip: 'Ortho projeté', why: `Pour s'aligner sur un point éloigné sans tracer de ligne de construction : la façade d'en face, l'axe d'un regard.`,
          do: ol('Allumez l\'<b>Ortho projeté</b>.', 'En traçant, restez une demi-seconde sur un point d\'accroche : il devient violet.', 'Glissez à l\'horizontale ou à la verticale : une ligne pointillée vous aligne sur ce point.'), wait: () => G.snap('track') },
        // calques
        { title: 'Les calques', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', why: `Les calques rangent le dessin comme des transparents : bordures, réseaux, cotes… Chacun a sa couleur et son trait, se masque d'un clic, et surtout le <b>métré compte par calque</b> : un plan bien rangé se chiffre tout seul.`,
          do: `Ouvrez le <b>gestionnaire de calques</b>.`, wait: () => G.shown('layer-modal') },
        { title: 'Un nouveau calque', target: 'new-layer-name', tip: 'Nom du calque', why: `Un calque par famille d'ouvrages, avec un nom clair.`,
          do: `Tapez un nom, par exemple <b>Réseau EU</b>, puis ${K('Entrée')} ou « Ajouter ». Il devient le <b>calque actif</b>.`, more: `Ici c'est ${K('Entrée')} qui valide, car l'espace sert à écrire le nom.`, wait: (c) => G.layers().length > c.n, init: (c) => { c.n = G.layers().length; } },
        { title: 'Dessiner sur un calque', target: 'btn-pline', tip: 'Polyligne', why: `Tout ce qu'on dessine va sur le calque actif et prend sa couleur.`,
          do: `Fermez le gestionnaire et tracez une <b>polyligne</b>.`, wait: (c) => G.shapes().length > c.n && G.shapes()[G.shapes().length - 1].layerId === G.active(), init: (c) => { c.n = G.shapes().length; } },
        { title: 'Régler avec Y', why: `${K('Y')} ouvre les réglages de l'objet sélectionné : son calque, ses altitudes, sa plateforme, son volume… La fenêtre ne montre que ce qui le concerne.`,
          do: `Sélectionnez un objet puis tapez ${K('Y')}.`, wait: () => G.shown('selparam-modal') },
        { title: 'Changer de calque', target: 'selparam-layer', tip: 'Calque de l\'objet', why: `Un objet dessiné sur le mauvais calque se range en deux clics.`,
          do: `Choisissez un autre <b>calque</b> dans la liste, puis <b>Appliquer</b>.`, wait: (c) => c.open && !G.shown('selparam-modal') && changes > c.k, init: (c) => { c.k = changes; }, tick: (c) => { if (G.shown('selparam-modal')) c.open = true; } },
        // répéter, contrôler
        { title: 'Le réseau', target: 'btn-array', tip: 'Réseau<br><small>ou RE + Espace</small>', why: `Répéter un objet de façon régulière, en une fois : des places de parking en grille, des bornes autour d'un giratoire, des candélabres tous les 25 m le long d'une rue.`,
          do: ol('Dessinez un petit cercle et sélectionnez-le.', 'Outil <b>Réseau</b> : une fenêtre s\'ouvre à droite, le plan reste visible.', 'Onglet <b>Grille</b> : 4 colonnes, 2 lignes. Regardez l\'aperçu.', '<b>Créer</b>.'),
          more: `Essayez aussi « Le long d'un tracé » : on clique une polyligne et on choisit « un tous les… ».`, ...more('array', 3) },
        { title: 'Diviser un tracé', target: 'btn-divide', tip: 'Diviser<br><small>ou DV + Espace</small>', why: `Jalonner un tracé <b>sans le couper</b> : implanter un regard tous les 50 m, repérer des points kilométriques.`,
          do: ol('Outil <b>Diviser</b>, cliquez votre polyligne.', 'Choisissez « en parts égales » (5) ou « un repère tous les… ».', 'Points, petits traits ou blocs : choisissez, puis <b>Poser</b>.'), ...more('divide', 2) },
        { title: 'Mesurer', target: 'btn-measure', tip: 'Mesurer<br><small>ou MES + Espace</small>', why: `Le réflexe de contrôle : une distance, un angle, une surface, <b>sans rien dessiner</b>. Avant d'envoyer un plan, on vérifie.`,
          do: `Outil <b>Mesurer</b> : cliquez deux ou trois points. Longueurs, angle, total et surface s'affichent en bas et près du curseur.`, more: `${SP} recommence une mesure, ${K('⌫')} retire le dernier point.`, wait: () => G.measured() },
        { title: 'La plume', target: 'btn-pen', tip: 'Plume<br><small>ou PU + Espace</small>', why: `Pour les formes souples : une allée, une berge, une limite de végétation.`,
          do: `<b>Clic</b> = point anguleux, <b>cliquer-glisser</b> = point arrondi (on tire la courbe). ${SP} ou double-clic pour terminer.`, ...more('pen') },
        // annotation
        { title: 'Le texte', target: 'btn-text', tip: 'Texte<br><small>ou TX + Espace</small>', why: `Nommer les ouvrages, ajouter une note.`, do: `Outil <b>Texte</b> : cliquez sur le plan et tapez. ${K('Maj')}+${K('Entrée')} passe à la ligne, ${K('Entrée')} valide.`, wait: (c) => count('text') > c.n, init: (c) => { c.n = count('text'); } },
        { title: 'L\'infobulle', target: 'btn-detail', tip: 'Infobulle<br><small>ou IF + Espace</small>', why: `Désigner un détail précis avec une étiquette et une flèche : « Regard existant à conserver ».`,
          do: ol('Cliquez le point à montrer.', 'Cliquez l\'endroit de l\'étiquette.', 'Tapez le texte.'), wait: (c) => count('detail') > c.n, init: (c) => { c.n = count('detail'); } },
        { title: 'La cote libre', target: 'btn-dim', tip: 'Cote libre', why: `Une cote mesure et affiche une distance sur le plan : elle se met à jour si l'on déplace ses points.`,
          do: ol('Outil <b>Cote libre</b> : cliquez 2 points (les accroches aident).', 'Cliquez la position de la ligne de cote.'), wait: (c) => count('dim') > c.n && c.seen, init: (c) => { c.n = count('dim'); }, tick: seen('dim') },
        { title: 'La cote ortho et les séries', target: 'btn-dim-ortho', tip: 'Cote ortho', why: `La cote ortho ne mesure que l'horizontale ou la verticale ; en série, chaque clic ajoute une cote bout à bout, idéal pour coter une façade.`,
          do: ol(`Outil <b>Cote ortho</b>, tapez ${K('2')} ${SP} (mode successif).`, 'Cliquez 1er point, 2e point, la ligne, puis d\'autres points.', `${SP} termine.`), wait: (c) => count('dim') >= c.n + 2 && c.ch, init: (c) => { c.n = count('dim'); }, tick: (c) => { if (G.chain() === 'succ' || G.chain() === 'cumul') c.ch = true; } },
        { title: 'Rayons et diamètres', target: 'btn-dim-rad', tip: 'Cote de rayon<br><small>Diamètre juste à côté</small>', why: `Coter un rayon de giration, le diamètre d'un regard ou d'un bassin.`,
          do: ol('Outil <b>Cote de rayon</b> : cliquez un cercle.', 'Placez le texte dedans ou dehors, cliquez.'), wait: (c) => count('dimr') > c.n, init: (c) => { c.n = count('dimr'); } },
        { title: 'La cote d\'angle', target: 'btn-dim-angle', tip: 'Cote d\'angle', why: `L'angle entre deux alignements.`, do: `Cliquez une 1<sup>re</sup> droite, une 2<sup>e</sup>, puis l'endroit de l'arc.`, wait: (c) => count('dim-angle') > c.n, init: (c) => { c.n = count('dim-angle'); } },
        // blocs, murs
        { title: 'Le catalogue de blocs', target: 'btn-blocks', tip: 'Catalogue de blocs<br><small>ou BL + Espace</small>', why: `Sanitaires, mobilier, végétation à taille réelle, posés comme des tampons : un plan lisible en quelques clics.`,
          do: ol('Ouvrez le <b>catalogue</b> (petit bouton carré en haut) et cliquez un bloc.', 'Il suit la souris : cliquez pour le poser.', `${K('Échap')} pour finir.`), more: `${K('Maj')}+molette = taille, ${K('Ctrl')}+molette = rotation.`, ...more('stamp') },
        { title: 'Les murs', target: 'btn-blocks', tip: 'Catalogue › 🧱 Parois', why: `Des murs qui portent leur matériau (parpaing, béton, brique…), avec les angles raccordés tout seuls, et qui deviennent des volumes 3D.`,
          do: ol('Catalogue, onglet <b>🧱 Parois</b>, choisissez une paroi.', 'Cliquez le début puis la fin de chaque tronçon.', `${K('Échap')} pour finir.`), ...used('wall') },
        // sorties
        { title: 'Le métré', target: 'btn-metre', tip: 'Métré<br><small>ou ME + Espace</small>', why: `Le métré transforme le dessin en quantités : longueurs, surfaces, nombres d'objets par calque, puis terrassement et matériaux chiffrés.`,
          do: `Ouvrez le <b>Σ Métré</b> et regardez vos calques. « Copier (tableur) » le colle dans un devis.`, wait: () => G.shown('topo-modal') },
        { title: 'L\'aperçu', target: 'btn-preview', tip: 'Aperçu avant impression', why: `Voir la feuille exactement comme elle sortira, avant d'imprimer.`,
          do: `Fermez le métré puis cliquez <b>Aperçu</b>. Molette = échelle, ${SP} = portrait / paysage, clic = figer la page, ${K('Entrée')} = imprimer.`, wait: () => G.mode() === 'preview' },
        { title: 'Enregistrer', target: 'btn-dxf-menu', tip: 'Menu fichier', why: `Garder son travail et l'échanger.`,
          do: `${K('Échap')} pour quitter l'aperçu. Dans le menu <b>fichier</b> :<ul><li>${K('Ctrl')}+${K('S')} enregistre le plan complet en <b>.mmc</b> ;</li><li>le <b>DXF</b> sert à échanger avec les géomètres et bureaux d'études ;</li><li>le <b>gabarit</b> garde vos calques et réglages pour toute l'équipe.</li></ul>` },
        { title: 'Bravo, vous êtes initié !', why: `Accroches, Ortho et suivi polaire, calques, réseau, mesure, textes et cotes, blocs, murs, métré et impression : vous dessinez des plans propres et justes.`,
          more: `Prochain tuto : <b>Le paramétrage</b> (niveau Expert), pour des plans « maison ».`, last: true },
    ];

    // ===================================================================== 3. LE PARAMÉTRAGE
    const PARAM = [
        { title: 'Le paramétrage', why: `Niveau <b>expert</b> : on règle MomoCAD pour qu'il sorte des plans « maison » — vos formats, votre cartouche et votre logo, vos prix, vos calques — et on garde tout dans un <b>gabarit</b> partagé avec l'équipe.` },
        { title: 'Les paramètres', target: 'btn-print-settings', tip: 'Paramètres ⛯', why: `Tous les réglages généraux sont réunis dans une seule fenêtre, rangée en onglets.`, do: `Ouvrez les <b>Paramètres</b> : bouton ⛯ tout en haut à droite.`, wait: () => G.shown('cartouche-modal') },
        { title: 'Onglet Plan', target: '#cartouche-modal .ps-tab[data-tab="plan"]', tip: 'Onglet Plan', why: `La <b>précision d'affichage</b> (nombre de décimales des longueurs et des cotes) et le carreau de la <b>grille</b>. Une cote au centimètre près se lit mieux qu'avec six décimales.`,
          do: `Dans l'onglet <b>Plan</b>, changez la précision avec <b>+</b> ou <b>−</b>.`, more: `Toutes les longueurs sont en mètres : rien à régler côté unité.`, wait: (c) => G.psTab() === 'plan' && G.val('ps-decimals') !== c.d, init: (c) => { c.d = G.val('ps-decimals'); }, tick: (c) => { if (G.psTab() !== 'plan') c.d = G.val('ps-decimals'); } },
        { title: 'Onglet Impression', target: '#cartouche-modal .ps-tab[data-tab="print"]', tip: 'Onglet Impression', why: `Le format de feuille (A5 à A0), l'orientation et le fichier produit (PDF, JPEG, PNG) de l'impression rapide.`, do: `Ouvrez l'onglet <b>Impression</b> et regardez l'aperçu de la feuille.`, wait: () => G.psTab() === 'print' },
        { title: 'Le cartouche', target: '#cartouche-modal .ps-tab[data-tab="cart"]', tip: 'Onglet Cartouche', why: `Le cartouche signe le plan : titre, client, dessinateur, indice de révision et <b>logo</b> de l'entreprise.`,
          do: `Ouvrez l'onglet <b>Cartouche</b> et tapez un <b>titre de plan</b>.`, wait: (c) => G.psTab() === 'cart' && G.val('cartouche-plan') !== c.v, init: (c) => { c.v = G.val('cartouche-plan'); }, tick: (c) => { if (G.psTab() !== 'cart') c.v = G.val('cartouche-plan'); } },
        { title: 'Fond de plan', target: '#cartouche-modal .ps-tab[data-tab="fond"]', tip: 'Onglet Fond de plan', why: `La carte posée sous le plan (satellite, photo IGN, plan) et les calques qui viennent avec : cadastre, communes, courbes, routes… et le terrain IGN en points cotés.`, do: `Ouvrez l'onglet <b>Fond de plan</b>.`, wait: () => G.psTab() === 'fond' },
        { title: 'Présentation', target: '#cartouche-modal .ps-tab[data-tab="pres"]', tip: 'Onglet Présentation', why: `La feuille des planches de mise en page : format, orientation, marges, traits de pliage.`, do: `Ouvrez l'onglet <b>Présentation</b>.`, wait: () => G.psTab() === 'pres' },
        { title: 'Le catalogue produits', target: '#cartouche-modal .ps-tab[data-tab="mat"]', tip: 'Onglet Produits', why: `Vos <b>prix</b> : terrassement en déblai et en remblai, puis chaque matériau (densité, foisonnement, prix). Ils chiffrent automatiquement les structures et le métré.`,
          do: `Onglet <b>Produits</b> : saisissez un prix, par exemple pour la GNT 0/31,5.`, wait: () => { try { return G.psTab() === 'mat' && (matEdit || []).some(m => +m.prix > 0); } catch (e) { return false; } } },
        { title: 'Valider', target: '#cartouche-modal button[onclick="applyCartouche()"]', tip: 'Valider', why: `Les réglages s'appliquent, restent sur ce poste et partent avec le plan.`, do: `Cliquez <b>Valider</b>.`, wait: (c) => c.open && !G.shown('cartouche-modal'), tick: (c) => { if (G.shown('cartouche-modal')) c.open = true; } },
        { title: 'Calques avancés', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', why: `Les calques ont des réglages fins qui font la différence sur un plan imprimé.`, do: `Ouvrez le <b>gestionnaire de calques</b>.`, wait: () => G.shown('layer-modal') },
        { title: 'Une ligne avec texte', target: '#layer-modal select[title="Type de ligne"]', tip: 'Type de ligne', why: `Pour un réseau, le trait porte son nom : ---EU Ø160---EU Ø160---. Lisible même en noir et blanc.`,
          do: `Sur un calque, choisissez le type de ligne <b>-T-</b>, puis tapez le texte dans la colonne <b>Libellé</b> (ex. EU Ø160).`, wait: () => G.layers().some(l => l.dash === 'text' && (l.ltText || '').trim()) },
        { title: 'Hachures et points', target: '#layer-modal select[title="Hachure"]', tip: 'Hachure du calque', why: `Chaque calque a son motif de hachure, sa taille de texte et le style de ses points topo (symbole, matricule, altitude).`,
          do: `Changez le motif de hachure d'un calque.`, wait: (c) => JSON.stringify(G.layers().map(l => l.hatch || '')) !== c.h, init: (c) => { c.h = JSON.stringify(G.layers().map(l => l.hatch || '')); } },
        { title: 'Le gabarit d\'entreprise', target: 'btn-dxf-menu', tip: 'Menu fichier', why: `Tout ce réglage se garde dans un <b>gabarit .gbt</b> : calques, paramètres, cartouche et logo, accroches, blocs et catalogue produits. Partagé, il donne à toute l'équipe les mêmes plans et les mêmes prix.`,
          do: `Menu fichier › <b>Enregistrer le gabarit</b>. Les autres font <b>Charger un gabarit</b> ; le dernier chargé revient tout seul au démarrage.` },
        { title: 'Bravo, vous êtes expert !', why: `Votre MomoCAD est réglé « maison » : paramètres, cartouche, prix, calques et gabarit.`, more: `Prochain tuto : <b>Les cubatures</b> (niveau Maître).`, last: true },
    ];

    // ===================================================================== 4. LES CUBATURES
    function demoTerrain() {   // terrain d'exercice : 81 points cotés sur 40 × 40 m, pente et bosse
        try {
            const lay = ensureLayer('Terrain naturel', '#bef264'), added = [];
            for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
                const x = i * 5000, y = j * 5000, z = 100000 + x * 0.06 + y * 0.025 + 1200 * Math.exp(-((x - 26000) ** 2 + (y - 14000) ** 2) / 1.2e8);
                const pt = { type: 'point', layerId: lay, x: mmToWorld(x), y: -mmToWorld(y), z: Math.round(z), zk: 1, mat: 'TN' + (added.length + 1) };
                shapes.push(pt); added.push(pt);
            }
            saveState(); updateLayerUI(); zoomToFitShapes(added); draw();
            updateCommandMessageText('TERRAIN D\'EXERCICE : ' + added.length + ' points cotés (100 à 104 m) sur le calque « Terrain naturel ».');
        } catch (e) { alert('Impossible de créer le terrain : ' + e.message); }
    }
    const CUB = [
        { title: 'Les cubatures', why: `Niveau <b>maître</b> : tout le circuit d'une étude de terrassement — terrain naturel, plateformes et talus, structure, cubatures, rapport PDF et métré chiffré.`,
          do: `Il faut un <b>terrain</b> : des points cotés (levé du géomètre en DXF, semis CSV…). Pas de terrain sous la main ? Je vous en crée un d'exercice de 40 × 40 m.`, action: { label: '▸ Créer un terrain d\'exercice', fn: demoTerrain } },
        { title: 'Le point topo', target: 'btn-topo', tip: 'Point topo<br><small>ou PT + Espace</small>', why: `Un point coté porte une altitude Z. Avec plusieurs points, MomoCAD reconstruit la surface du terrain.`,
          do: ol('Outil <b>Point topo</b>, cliquez.', `Tapez l'altitude (ex. ${K('101,5')}) puis ${SP}.`), more: `Le Z s'affiche en bas à droite au survol des points cotés.`, wait: (c) => count('point') > c.n, init: (c) => { c.n = count('point'); } },
        { title: 'Voir le terrain en 3D', target: 'btn-view3d', tip: 'Vue 3D<br><small>ou VU + Espace</small>', why: `Avant de concevoir, on comprend le terrain : où sont les bosses, dans quel sens il penche.`,
          do: `Cliquez l'œil en bas à droite. Glisser = tourner, molette = zoom ; <b>Aberration ×</b> exagère le relief. ${K('Échap')} pour revenir.`, wait: () => G.is3D() },
        { title: 'Les courbes de niveau', target: 'btn-contours', tip: 'Courbes de niveau<br><small>ou CN + Espace</small>', why: `Les courbes lisent le relief sur un plan à plat, comme sur une carte IGN.`, do: `Revenez au plan, puis <b>Courbes de niveau</b> : équidistance 0,5 m, générez.`, wait: (c) => G.shapes().filter(x => x.gen === 'contour').length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.gen === 'contour').length; } },
        { title: 'Dessiner la plateforme', target: 'btn-rect', tip: 'Rectangle', why: `Une <b>plateforme</b> est une forme fermée à une altitude : un parking, une dalle de bâtiment, une voirie.`, do: `Tracez un <b>rectangle</b> dans le terrain (20 × 12 m par exemple).`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Lui donner son niveau', why: `C'est l'altitude du projet. MomoCAD dessine aussitôt les <b>talus</b> jusqu'au terrain : rouges en déblai, bleus en remblai.`,
          do: ol('Sélectionnez le rectangle, tapez ' + K('Y') + '.', 'Chapitre <b>Plateforme</b> : un nom (ex. Parking) et le Z de tous les sommets (ex. 102).', '<b>Appliquer</b>.'), wait: (c) => G.plats() > c.n, init: (c) => { c.n = G.plats(); } },
        { title: 'Régler les talus', why: `La pente des talus dépend du sol : 3/2 en remblai courant, plus raide en déblai rocheux. Elle change l'emprise et les volumes.`,
          do: `Rouvrez ${K('Y')}, chapitre <b>Talus</b> : pentes de remblai et de déblai en H/V (3/2 = 3 m à plat pour 2 m de haut).`, more: `Une plateforme <b>inclinée</b> (rampe) se règle au même endroit : un Z par sommet, ou une pente en %.` },
        { title: 'La structure', why: `Sous l'enrobé il y a des couches (GNT, géotextile…). MomoCAD les quantifie (volume, tonnage, prix) et peut terrasser au <b>fond de forme</b>.`,
          do: `Dans ${K('Y')}, chapitre <b>▤ Structure</b> : ajoutez deux couches (GNT 0/31,5 20 cm, GNT 0/80 30 cm), appliquez.`, wait: () => G.shapes().some(x => x.struct && x.struct.layers && x.struct.layers.length) },
        { title: 'Lancer les cubatures', target: 'btn-cubature', tip: 'Cubatures<br><small>ou CU + Espace</small>', why: `Le calcul des volumes de déblai et de remblai, plateforme par plateforme, talus compris.`, do: `Bouton <b>Cubatures</b> : cochez les plateformes, puis <b>2. Résultats</b>.`, wait: (c) => window.__cubPdf && window.__cubPdf !== c.r, init: (c) => { c.r = window.__cubPdf; } },
        { title: 'Lire les résultats', why: `Déblai, remblai et solde, puis le détail par plateforme et par couche de structure.`,
          do: `<ul><li><b>PDF</b> : le rapport avec vue en plan cotée et vues 3D ;</li><li><b>Copier (tableur)</b> pour le devis ;</li><li><b>Tracer sur le plan</b> : la limite déblai / remblai.</li></ul>` },
        { title: 'Le profil en long', target: 'btn-profile', tip: 'Profil en long<br><small>ou PR + Espace</small>', why: `La coupe du terrain et du projet le long d'un axe, avec son tableau de cotes : le document de base d'une voirie ou d'un réseau.`,
          do: `Cliquez les points d'un axe à travers la plateforme, puis ${SP}.`, wait: () => G.modalHas('Profil') },
        { title: 'Le métré chiffré', target: 'btn-metre', tip: 'Métré', why: `La synthèse pour le devis : déblai, remblai, chaque produit des structures, avec vos prix et le <b>total HT</b>.`, do: `Ouvrez le <b>Σ Métré</b>, tableau « Terrassement et matériaux ».`, wait: () => G.modalHas('Terrassement') },
        { title: 'Maître du terrassement !', why: `Terrain, plateformes, talus, structures, cubatures, rapport et métré chiffré : vous avez tout le circuit d'une étude de terrassement.`, more: `Prochain tuto : <b>La modélisation 3D</b> (niveau Seigneur).`, last: true },
    ];

    // ===================================================================== 5. LA MODÉLISATION 3D
    const MODEL = [
        { title: 'La modélisation 3D', why: `Niveau <b>seigneur</b> : on passe en volume. Regards, massifs, bordures, puis on les place en hauteur. Utile pour visualiser un ouvrage, le métrer en m³ ou l'imprimer en 3D.` },
        { title: 'La palette Modélisation', target: '.pal[data-pal="model"] .pal-h', tip: 'Palette Modélisation', why: `Elle est repliée au démarrage pour ne pas encombrer l'écran.`, do: `Cliquez son titre pour la déplier.`, wait: () => G.palOpen('model') },
        { title: 'Un pavé', target: 'btn-solid-box', tip: 'Pavé<br><small>ou PA + Espace</small>', why: `Le volume le plus simple : un massif, une dalle, un socle.`, do: ol('Outil <b>Pavé</b> : 2 coins comme un rectangle.', `Dans la fenêtre, une hauteur (${K('0,5')}), Appliquer.`), wait: (c) => G.kind('box') > c.n, init: (c) => { c.n = G.kind('box'); } },
        { title: 'Un tube', target: 'btn-solid-tube', tip: 'Tube<br><small>ou TU + Espace</small>', why: `Un cylindre creux : un regard, une buse, un fourreau. Son volume de béton s'affiche dans les propriétés.`, do: `Centre, rayon extérieur ; puis hauteur et épaisseur de paroi dans la fenêtre.`, wait: (c) => G.kind('tube') > c.n, init: (c) => { c.n = G.kind('tube'); } },
        { title: 'La révolution', target: 'btn-revolve', tip: 'Révolution<br><small>ou RV + Espace</small>', why: `Pour un objet rond à section variable (regard avec sa dalle, cuve) : on dessine une demi-coupe, MomoCAD la fait tourner.`,
          do: ol('Dessinez une petite forme fermée (un rectangle de 0,1 × 1 m).', 'Outil <b>Révolution</b> : cliquez la forme, un point de l\'axe à côté, puis où poser le volume.'), wait: (c) => G.kind('rev') > c.n, init: (c) => { c.n = G.kind('rev'); } },
        { title: 'Le balayage', target: 'btn-sweep', tip: 'Balayage<br><small>ou BA + Espace</small>', why: `Un profil qui suit un tracé : une bordure de trottoir, un caniveau, un tuyau. Le volume de béton est calculé.`,
          do: ol('Tracez une <b>polyligne</b>.', 'Outil <b>Balayage</b>, cliquez-la : une bordure la suit.', 'Dans la fenêtre, essayez un autre profil.'), wait: (c) => G.shapes().filter(x => x.sweep).length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.sweep).length; } },
        { title: 'Élever', target: 'btn-elevate', tip: 'Élever<br><small>ou EL + Espace</small>', why: `Monter ou descendre un objet d'une hauteur précise.`, do: `Sélectionnez le pavé, outil <b>Élever</b> : ${K('1')} ${SP}.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.modalHas('Élever')) c.seen = true; } },
        { title: 'Poser sur', target: 'btn-stack', tip: 'Poser sur<br><small>ou PS + Espace</small>', why: `Caler un objet pile sur un autre (un couvercle sur un regard), sans calculer de hauteur.`, do: `Outil <b>Poser sur</b> : cliquez le pavé, puis le tube.`, ...used('stack') },
        { title: 'Incliner', target: 'btn-tilt', tip: 'Incliner<br><small>ou IN + Espace</small>', why: `Faire pencher un volume : une dalle en pente, une pièce biaise.`, do: `Outil <b>Incliner</b>, cliquez un volume, tapez ${K('20')} dans « Inclinaison ».`, wait: () => G.shapes().some(x => x.solid && x.solid.tilt && (x.solid.tilt.x || x.solid.tilt.y)) },
        { title: 'Sélectionner en 3D', target: 'btn-view3d', tip: 'Vue 3D', why: `On peut choisir et régler un volume directement dans la vue 3D.`, do: `Ouvrez la <b>vue 3D</b> et cliquez un volume (sans glisser) : il passe en rose.`, wait: () => G.is3D() && G.sel().length > 0 },
        { title: 'Les volumes au métré', target: 'btn-metre', tip: 'Métré', why: `Les m³ de béton par calque, prêts pour le devis.`, do: `${K('Échap')}, puis <b>Σ Métré</b> : colonne <b>Volumes 3D</b>.`, wait: () => G.modalHas('Volumes 3D') },
        { title: 'Seigneur de la 3D !', why: `Solides, révolution, balayage, élever, poser, incliner, sélection en 3D et métré des volumes.`, more: `Dernier tuto : <b>Pièces et bâtiment</b> (niveau Dieu).`, last: true },
    ];

    // ===================================================================== 6. PIÈCES ET BÂTIMENT
    const nOpen = () => G.shapes().reduce((a, x) => a + (x.openings || []).length, 0);
    const BUILD = [
        { title: 'Pièces et bâtiment', why: `Niveau <b>dieu</b> : on combine des volumes (<b>booléens</b>), on sort une pièce pour l'<b>impression 3D</b>, puis on monte un petit bâtiment : murs percés, poutre et toiture.`, do: `Dépliez la palette <b>Modélisation</b> si elle est repliée.` },
        { title: 'L\'union', target: 'btn-bool-union', tip: 'Union<br><small>ou UN + Espace</small>', why: `Fusionner plusieurs volumes en une seule pièce.`, do: ol('Faites deux <b>pavés</b> qui se chevauchent.', 'Sélectionnez-les, puis <b>Union</b>.'), wait: (c) => G.named('Union') > c.n, init: (c) => { c.n = G.named('Union'); } },
        { title: 'Soustraire', target: 'btn-bool-sub', tip: 'Soustraire<br><small>ou SU + Espace</small>', why: `Percer, encocher, réserver : dans n'importe quelle direction.`, do: ol('Posez un <b>cylindre</b> qui traverse la pièce.', '<b>Soustraire</b> : cliquez la pièce (à garder), puis le cylindre (à retirer).'), wait: (c) => G.named('Soustraction') > c.n, init: (c) => { c.n = G.named('Soustraction'); } },
        { title: 'Intersecter', target: 'btn-bool-inter', tip: 'Intersecter<br><small>ou IS + Espace</small>', why: `Ne garder que la partie commune de deux volumes (une sphère et un pavé : un dôme coupé).`, do: `Essayez, ou passez à la suite avec ${K('▶')}.`, wait: (c) => G.named('Intersection') > c.n, init: (c) => { c.n = G.named('Intersection'); } },
        { title: 'Imprimer en 3D', target: 'btn-dxf-menu', tip: 'Menu fichier', why: `Le format STL part tel quel dans le logiciel d'une imprimante 3D.`, do: `Sélectionnez la pièce, menu fichier › <b>Exporter en STL</b> : « La sélection seulement », millimètres, « Poser à l'origine ».`, wait: () => G.modalHas('Exporter en STL') },
        { title: 'Un mur', target: 'btn-blocks', tip: 'Catalogue › 🧱 Parois', why: `Le mur porte son matériau et deviendra un volume percé.`, do: `Catalogue de blocs, onglet <b>🧱 Parois</b> : tracez un mur de 5 m (début, fin, ${K('Échap')}).`, wait: (c) => G.shapes().filter(x => x.wallMat).length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.wallMat).length; } },
        { title: 'Les niveaux du mur', why: `En plan le mur n'a pas de hauteur : on lui donne un niveau bas et un niveau haut pour qu'il existe en 3D.`, do: `Cliquez le mur, ${K('Y')} : niveau bas 0, niveau haut 2,50.`, wait: () => G.shapes().some(x => x.wallMat && x.wz && x.wz.t > x.wz.b) },
        { title: 'Une fenêtre', target: 'btn-opening', tip: 'Ouverture<br><small>ou OU + Espace</small>', why: `Percer le mur proprement, au bon endroit et à la bonne largeur : les accroches calent le début, la largeur se tape.`,
          do: ol('Outil <b>Ouverture</b>.', 'Cliquez sur le mur le <b>début</b> (accrochez un angle ou le milieu).', `Tapez la largeur ${K('1,2')} ${SP} : la souris choisit le côté.`, 'Fenêtre, allège 1,00, hauteur 1,25, Valider.'), wait: (c) => nOpen() > c.n, init: (c) => { c.n = nOpen(); } },
        { title: 'Une porte', target: 'btn-opening', tip: 'Ouverture', why: `La porte se dessine avec son battant ; on choisit le côté de la charnière et le côté où elle s'ouvre.`,
          do: ol(`Nouvelle ouverture, largeur ${K('0,9')} ${SP}.`, 'Choisissez <b>Porte</b>, puis la charnière et le sens d\'ouverture, Valider.'), more: `Double-clic sur une ouverture pour la modifier.`, wait: () => G.shapes().some(x => (x.openings || []).some(o => o.kind === 'porte')) },
        { title: 'Une poutre', target: 'btn-solid-beam', tip: 'Poutre<br><small>ou PO + Espace</small>', why: `Bois ou acier, droite ou en pente : la section reste perpendiculaire, comme un vrai chevron.`, do: `Outil <b>Poutre</b> : 2 clics pour l'axe, puis un profil (bois 63×175, IPE…) et les Z.`, wait: (c) => G.shapes().filter(x => x.sweep && x.sweep.perp).length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.sweep && x.sweep.perp).length; } },
        { title: 'La toiture', target: 'btn-solid-roof', tip: 'Toiture<br><small>ou TOI + Espace</small>', why: `Couvrir le bâtiment en une fois : un ou deux pans, à la bonne hauteur, avec les <b>pignons</b> fermés sous le toit.`,
          do: ol('Outil <b>Toiture</b> : 2 coins autour du bâtiment.', 'Choisissez <b>2 pans</b>, égout 2,50 et faîtage 5,00.', 'Cochez <b>Combler les pignons</b>, puis <b>Créer le toit</b>.'), wait: (c) => G.kind('roof') > c.n, init: (c) => { c.n = G.kind('roof'); } },
        { title: 'Admirez', target: 'btn-view3d', tip: 'Vue 3D', why: `Le moment de vérité : mur percé, poutre, toiture et pignons.`, do: `Ouvrez la <b>vue 3D</b> et tournez autour.`, wait: () => G.is3D() },
        { title: 'Dieu de MomoCAD !', why: `Booléens, impression 3D, murs, portes et fenêtres, poutres et toitures : vous avez fait le tour complet de MomoCAD, du terrain au bâtiment.`, more: `Il n'y a pas de niveau au-dessus… pour l'instant.`, last: true },
    ];

    // ---------- interface ----------
    const CSS = `
    #mt-root { position:absolute; right:16px; bottom:52px; z-index:80; display:flex; align-items:flex-end; gap:10px; pointer-events:none; transition:right .25s; font-family: system-ui, 'Segoe UI', sans-serif; }
    #mt-bubble { pointer-events:auto; position:relative; width:400px; max-width:calc(100vw - 260px); max-height:calc(100vh - 170px); overflow:auto; background:#111827f5; color:#e5e7eb; border:1.5px solid #7c3aed; border-radius:16px; padding:14px 16px 12px; font-size:14px; line-height:1.55; box-shadow:0 12px 32px #0009; backdrop-filter: blur(4px); transition: border-color .3s; }
    #mt-bubble.done { border-color:#22c55e; }
    #mt-bubble .mt-h { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
    #mt-bubble .mt-n { color:#a78bfa; font-size:11.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; }
    #mt-bubble .mt-t { font-weight:800; color:#fff; font-size:16.5px; line-height:1.3; margin:0 0 8px; display:flex; align-items:center; gap:8px; }
    #mt-bubble .mt-ck { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#22c55e; color:#052e16; font-size:14px; font-weight:900; flex:0 0 22px; }
    #mt-bubble .mt-x { color:#9ca3af; font-size:17px; line-height:1; padding:0 2px; background:none; border:0; cursor:pointer; }
    #mt-bubble .mt-x:hover { color:#fff; }
    #mt-bubble .mt-lab { display:block; font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; margin-bottom:3px; }
    #mt-bubble .mt-why { margin-bottom:10px; } #mt-bubble .mt-why .mt-lab { color:#c4b5fd; }
    #mt-bubble .mt-do { background:#1f2937; border:1px solid #374151; border-radius:10px; padding:9px 11px; margin-bottom:8px; } #mt-bubble .mt-do .mt-lab { color:#fbbf24; }
    #mt-bubble .mt-more { background:#f59e0b14; border-left:3px solid #f59e0b; border-radius:6px; padding:6px 9px; color:#fde68a; font-size:13px; margin-bottom:8px; }
    #mt-bubble ol, #mt-bubble ul { margin:4px 0 0; padding-left:20px; } #mt-bubble li { margin:2px 0; }
    #mt-bubble kbd { display:inline-block; min-width:18px; text-align:center; padding:0 5px; margin:0 1px; border:1px solid #6b7280; border-bottom-width:2px; border-radius:4px; background:#1f2937; color:#fde68a; font-family:ui-monospace,monospace; font-size:12px; }
    #mt-bubble small { color:#9ca3af; }
    #mt-state { font-size:13px; font-weight:600; margin:2px 0 0; }
    #mt-state.wait { color:#9ca3af; } #mt-state.ok { color:#86efac; }
    #mt-bar { height:4px; background:#374151; border-radius:2px; margin:10px 0 9px; overflow:hidden; }
    #mt-bar i { display:block; height:100%; background:linear-gradient(90deg,#7c3aed,#22c55e); transition:width .35s; }
    #mt-acts { display:flex; gap:8px; justify-content:flex-end; align-items:center; }
    #mt-acts button { border:0; border-radius:10px; width:46px; height:36px; font-size:18px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .mt-arw { background:#374151; color:#e5e7eb; } .mt-arw:hover { background:#4b5563; }
    .mt-arw.go { background:#22c55e; color:#052e16; animation: mt-go 1.2s ease-in-out infinite; } .mt-arw.go:hover { background:#4ade80; }
    @keyframes mt-go { 0%,100% { box-shadow:0 0 0 0 #22c55e66; } 50% { box-shadow:0 0 0 7px #22c55e00; } }
    .mt-link { border:0; background:#065f46; color:#d1fae5; border-radius:8px; padding:6px 10px; font-weight:700; font-size:13px; cursor:pointer; margin-top:8px; }
    #mt-root.mini #mt-bubble { display:none; } #mt-root.mini.peek #mt-bubble { display:block; }
    #mt-root.mini #mt-momo { width:62px; height:76px; }
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
    @media (prefers-reduced-motion: reduce) { #mt-momo, #mt-momo .mt-eye, #mt-momo .mt-tassel, #mt-ring, .mt-arw.go { animation:none !important; } }`;

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

    // catalogue des tutos (affiché dans le guide, onglet « Apprendre avec Momo »)
    const TUTOS = [
        { id: 'base', level: 'Débutant', title: 'Les outils de base', desc: 'Dessiner à la cote (droite, rectangle, cercle, ellipse, arc, polygone, polyligne, hachure, point), sélectionner (clic, fenêtre, lasso), puis déplacer, copier, tourner, décaler, couper, prolonger, longueur, couper au point, joindre, échelle, étirer, miroir, arrondir, chanfrein', minutes: 25, steps: BASE },
        { id: 'adv', level: 'Initié', title: 'Les outils avancés', desc: 'Accroches (tangente, proche), Ortho, suivi polaire, ortho projeté, calques, réglages avec Y, réseau, diviser, mesurer, plume, textes et cotes (rayon, diamètre, angle), blocs, murs, métré, aperçu', minutes: 30, steps: ADV },
        { id: 'param', level: 'Expert', title: 'Le paramétrage', desc: 'Paramètres ⛯ (plan, impression, cartouche, fond de plan, présentation), catalogue produits et prix, calques avancés, gabarit d\'entreprise', minutes: 15, steps: PARAM },
        { id: 'cub', level: 'Maître', title: 'Les cubatures', desc: 'Terrain naturel, 3D, courbes de niveau, plateformes et talus, structure, cubatures et rapport PDF, profil en long, métré chiffré', minutes: 25, steps: CUB },
        { id: 'model', level: 'Seigneur', title: 'La modélisation 3D', desc: 'Palette Modélisation : pavé, tube, révolution, balayage, élever, poser sur, incliner, sélection dans la vue 3D, volumes au métré', minutes: 20, steps: MODEL },
        { id: 'build', level: 'Dieu', title: 'Pièces et bâtiment', desc: 'Booléens, export STL pour l\'impression 3D, murs, fenêtres et portes (largeur, sens d\'ouverture), poutres, toiture 1 ou 2 pans avec pignons', minutes: 25, steps: BUILD },
    ];
    let STEPS = BASE, done = [];
    let lastH = 0, root, bubble, ring, tip, momo, idx = 0, ctx = {}, timer = null;

    function build() {
        if (!document.getElementById('mt-css')) { const st = document.createElement('style'); st.id = 'mt-css'; st.textContent = CSS; document.head.appendChild(st); }
        const host = document.getElementById('canvas-container') || document.body;
        root = document.createElement('div'); root.id = 'mt-root';
        root.innerHTML = `<div id="mt-bubble"></div><div style="position:relative;pointer-events:auto;">${MOMO_SVG}<span id="mt-dot">…</span></div>`;
        host.appendChild(root);
        bubble = root.querySelector('#mt-bubble'); momo = root.querySelector('#mt-momo');
        momo.addEventListener('click', () => { if (root.classList.contains('mini')) { root.classList.toggle('peek'); return; } jump(); });
        ring = document.createElement('div'); ring.id = 'mt-ring'; document.body.appendChild(ring);
        tip = document.createElement('div'); tip.id = 'mt-tip'; document.body.appendChild(tip);
        bubble.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act(b.dataset.a); });
        bubble.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    function jump() { momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); }
    function act(a) {
        if (a === 'x') return stop();
        if (a === 'prev') return go(Math.max(0, idx - 1));
        if (a === 'act') { const s = STEPS[idx]; if (s.action) s.action.fn(); return; }
        if (a === 'next') { if (STEPS[idx].last) return stop(); return go(idx + 1); }
    }
    const BRAVO = ['Bravo !', 'Parfait !', 'Bien joué !', 'Exactement !', 'Super !', 'C\'est ça !'];
    function render() {
        const s = STEPS[idx], n = STEPS.length, ok = !!done[idx], hasWait = typeof s.wait === 'function';
        const ready = ok || !hasWait;
        const btns = [];
        if (idx > 0) btns.push(`<button class="mt-arw" data-a="prev" title="Étape précédente">◀</button>`);
        btns.push(`<button class="mt-arw${ready ? ' go' : ''}" data-a="next" title="${s.last ? 'Terminer' : ready ? 'Étape suivante' : 'Passer cette étape'}">▶</button>`);
        const doHtml = (s.do || s.say) ? `<div class="mt-do"><span class="mt-lab">${hasWait ? 'À vous' : 'Comment faire'}</span>${s.do || s.say}${s.action ? `<div><button class="mt-link" data-a="act">${s.action.label}</button></div>` : ''}</div>` : (s.action ? `<button class="mt-link" data-a="act">${s.action.label}</button>` : '');
        const state = hasWait ? (ok ? `<div id="mt-state" class="ok">✓ ${BRAVO[idx % BRAVO.length]} Étape réussie — passez à la suite avec ▶ quand vous êtes prêt.</div>` : `<div id="mt-state" class="wait">⏳ À vous de jouer… l'étape se cochera toute seule.</div>`) : '';
        bubble.classList.toggle('done', ok);
        bubble.innerHTML = `<div class="mt-h"><span class="mt-n">Étape ${idx + 1} / ${n}</span><button class="mt-x" data-a="x" title="Arrêter la visite">✕</button></div>
            <div class="mt-t">${ok ? '<span class="mt-ck">✓</span>' : ''}${s.title}</div>
            ${s.why ? `<div class="mt-why"><span class="mt-lab">À quoi ça sert</span>${s.why}</div>` : ''}
            ${doHtml}
            ${s.more ? `<div class="mt-more">💡 ${s.more}</div>` : ''}
            ${state}
            <div id="mt-bar"><i style="width:${Math.round((idx + (ready ? 1 : 0)) / n * 100)}%"></i></div><div id="mt-acts">${btns.join('')}</div>`;
        momo.classList.remove('talk'); void momo.getBoundingClientRect(); momo.classList.add('talk');
        bubble.scrollTop = 0; place();
    }
    function targetEl() { const s = STEPS[idx]; if (!s || !s.target) return null; return document.getElementById(s.target) || (/[\[\.#\s]/.test(s.target) ? document.querySelector(s.target) : null); }
    // fenêtre ouverte (paramètres, calques, Y, cubatures…) : Momo ne doit pas cacher ses boutons
    function modalCard() {
        const L = [['topo-modal', 1], ['cartouche-modal', 1], ['selparam-modal', 1], ['layer-modal', 0], ['snap-modal', 0], ['help-modal', 1], ['t2-panel', 0]];
        for (const [id, child] of L) { if (!G.shown(id)) continue; const e = document.getElementById(id), c = child ? e.firstElementChild : e; if (c) return c.getBoundingClientRect(); }
        return null;
    }
    function place() {
        const pp = document.getElementById('properties-popup'), host = root.parentElement.getBoundingClientRect();
        let right = (pp && !pp.classList.contains('hidden') && pp.offsetWidth ? pp.offsetWidth + 40 : 16), mini = false;
        root.style.left = ''; root.style.right = right + 'px';
        const mc = modalCard();
        if (mc) {
            if (bubble.offsetHeight) lastH = bubble.offsetHeight;
            const W = 520, H = Math.max(lastH || 260, 140), zr = host.right - right, zb = host.bottom - 52;
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
        if (s.tip) { tip.innerHTML = s.tip; tip.style.display = 'block'; const th = tip.offsetHeight, tw = tip.offsetWidth; let L = r.right + 14; if (L + tw > window.innerWidth - 8) L = Math.max(8, r.left - tw - 14); tip.style.left = L + 'px'; tip.style.top = Math.max(6, r.top + r.height / 2 - th / 2) + 'px'; }
        else tip.style.display = 'none';
    }
    function go(i) {
        idx = Math.max(0, Math.min(i, STEPS.length - 1)); ctx = {};
        const s = STEPS[idx]; if (s.init) s.init(ctx);
        render();
    }
    function tick() {
        if (!root || !root.isConnected) return stop();
        place();
        const s = STEPS[idx];
        if (s.tick) s.tick(ctx);
        if (s.wait && !done[idx]) {
            let ok = false; try { ok = s.wait(ctx); } catch (e) {}
            if (ok) { done[idx] = true; render(); jump(); }   // l'étape se coche ; on avance quand on veut, avec ▶
        }
    }
    function start(id) {
        const T = TUTOS.find(t => t.id === id) || TUTOS[0]; STEPS = T.steps; done = [];
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
