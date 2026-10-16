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
    const used = (m) => madeWith(m, 1);
    const more = (m) => madeWith(m, 1);

    // ---------- les étapes ----------
    // title · why (à quoi ça sert, pourquoi) · do (ce qu'on fait) · more (astuce) · target / tip (bouton montré)
    // wait (ctx) -> true quand c'est réussi : l'étape se coche, on passe à la suite avec ▶ quand on veut
    // ---------- exercices : un modèle à reproduire, chaque étape vérifie le VRAI résultat ----------
    // Le modèle est dessiné en pointillés sur le plan (jaune = à faire maintenant, vert = déjà fait) ; ses points s'accrochent.
    let A = { x: 0, y: 0 };                                       // ancrage de l'exercice (point 0,0 du modèle), en coordonnées du plan
    const mw = (v) => { try { return mmToWorld(v * 1000); } catch (e) { return v * 5000; } };
    const W = (x, y) => ({ x: A.x + mw(x), y: A.y - mw(y) });    // mètres (Y vers le haut) -> plan
    const TOL = () => mw(0.08);
    const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= TOL();
    const U = (v) => { try { const k = 1000 / (UNIT_MM[currentUnit] || 1); return String(+(v * k).toFixed(3)).replace('.', ','); } catch (e) { return String(v).replace('.', ','); } };
    const UN = () => { try { return currentUnit; } catch (e) { return 'm'; } };
    const sameSeq = (P, Q) => P.length === Q.length && P.every((p, i) => near(p, Q[i]));
    const sameSet = (P, Q) => P.length === Q.length && Q.every(q => P.some(p => near(p, q)));
    const hasLine = (a, b) => { const P = W(...a), Q = W(...b); return G.shapes().some(s => s.type === 'line' && ((near({ x: s.x1, y: s.y1 }, P) && near({ x: s.x2, y: s.y2 }, Q)) || (near({ x: s.x1, y: s.y1 }, Q) && near({ x: s.x2, y: s.y2 }, P)))); };
    const polyOf = (pts, closed) => { const Q = pts.map(p => W(...p)); return G.shapes().find(s => s.type === 'poly' && !s.solid && !!s.open === !closed && (closed ? sameSet(s.points, Q) : (sameSeq(s.points, Q) || sameSeq(s.points, Q.slice().reverse())))); };
    const circleOf = (c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'circle' && near(s, C) && Math.abs(s.r - mw(r)) <= TOL()); };
    const arcOf = (c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'arc' && near(s, C) && Math.abs(s.r - mw(r)) <= TOL()); };
    const hatchAt = (p) => { const P = W(...p); return G.shapes().some(s => s.type === 'hatch' && typeof pointInHatch === 'function' && pointInHatch(s, P.x, P.y)); };
    const gl = (a, b, o) => Object.assign({ t: 'line', a: W(...a), b: W(...b), snap: [W(...a), W(...b)] }, o || {});
    const gp = (pts, closed, o) => { const Q = pts.map(p => W(...p)); return Object.assign({ t: 'poly', pts: Q, closed: !!closed, snap: Q }, o || {}); };
    const gc = (c, r, o) => Object.assign({ t: 'circle', c: W(...c), r: mw(r), snap: [W(...c)] }, o || {});
    // arc du modèle : centre, rayon, angles en degrés (sens trigonométrique, Y vers le haut), de a0 à a1
    const ga = (c, r, a0, a1, o) => { const C = W(...c), R = mw(r), P = (d) => W(c[0] + r * Math.cos(d * Math.PI / 180), c[1] + r * Math.sin(d * Math.PI / 180)); return Object.assign({ t: 'arc', c: C, r: R, a0: -a1 * Math.PI / 180, a1: -a0 * Math.PI / 180, snap: [C, P(a0), P(a1)] }, o || {}); };
    const garrow = (a, b, o) => Object.assign({ t: 'arrow', a: W(...a), b: W(...b), snap: [W(...a), W(...b)] }, o || {});
    // place l'exercice au centre de la vue et cadre le modèle (xmin..xmax, ymin..ymax en m) à gauche de Momo
    function setupExercise(x0, x1, y0, y1) {
        try {
            if (typeof setMode === 'function') setMode('select-box');
            // zone libre : à gauche de la bulle de Momo (≈ 560 px à droite)
            const Wd = canvas.width, Hd = canvas.height, zw = Math.max(300, Wd - 600), sx = 40 + zw / 2, sy = Hd * 0.45, z = Math.min(zw / mw(x1 - x0), (Hd * 0.8) / mw(y1 - y0));
            camera.zoom = z; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            const w0 = screenToWorld(sx, sy); A = { x: Math.round(w0.x / mw(1)) * mw(1) - mw(cx), y: Math.round(w0.y / mw(1)) * mw(1) + mw(cy) };
            const C = W(cx, cy); camera.x = sx - C.x * z; camera.y = sy - C.y * z; draw();
        } catch (e) {}
    }
    // « la nouvelle forme a été faite AVEC cet outil » (et pas avec un autre choisi juste après)
    const madeWith = (m, n) => ({
        init: (c) => { c.L = G.shapes().length; c.k = changes; c.hits = 0; c.pm = G.mode(); },
        tick: (c) => { const L = G.shapes().length, M = [].concat(m); if ((L > c.L || changes > c.k) && (M.includes(c.pm) || M.includes(G.mode()))) c.hits++; c.L = L; c.k = changes; c.pm = G.mode(); },
        wait: (c) => c.hits >= (n || 1) });

    // ===================================================================== 1. DÉBUTANT : le logo MOMOCAD
    // modèle (m) : M 0..3, O centre 5,5 / 2, copie +8,5 -> M 8,5..11,5 et O 14 / 2, C centre 19 / 2, A 22..25, D 26..28,5, double soulignement y = -1 et -1,5
    const S45 = Math.SQRT1_2 * 2, M1 = [[0, 0], [0, 4], [1.5, 2], [3, 4], [3, 0]], M2 = M1.map(([x, y]) => [x + 8.5, y]);
    const BASE = [
        { title: 'Bonjour, je suis Momo !', why: `On va apprendre les outils de base <b>en dessinant pour de vrai</b> : ensemble, on va redessiner le <b>logo MOMOCAD</b>, lettre par lettre. Chaque outil sert à quelque chose dans le logo.`,
          do: `Le modèle est tracé en <b>pointillés</b> sur le plan : en <b style="color:#fbbf24">jaune</b> ce qu'il faut dessiner maintenant, en <b style="color:#4ade80">vert</b> ce qui est fait. Ses points jaunes <b>s'accrochent</b> : visez-les.<br>L'étape se coche ✓ seulement si votre dessin correspond au modèle. Vous avancez avec ${K('▶')}.`,
          more: `Un plan vierge est idéal. Les longueurs sont en mètres.` },
        { title: 'Se déplacer dans le plan', why: `Avant de dessiner, il faut savoir regarder : zoomer sur un détail, revenir à l'ensemble.`,
          do: `<ul><li><b>molette</b> = zoomer, autour du curseur ;</li><li><b>clic molette maintenu</b> = faire glisser le plan ;</li><li><b>double-clic molette</b> = tout voir.</li></ul>Le modèle du logo est déjà au milieu de l'écran.` },
        // M : demi-M, miroir, joindre
        { title: 'Le M, première moitié', target: 'btn-pline', tip: 'Polyligne<br><small>ou PLI + Espace</small>', ghost: () => [gp([[0, 0], [0, 4], [1.5, 2]], false, { label: '3 points, puis Espace', lp: W(1.5, 2) })],
          why: `La <b>polyligne</b> trace plusieurs segments d'un seul tenant : un seul objet, idéal pour une bordure, un réseau… ou une lettre.`,
          do: ol('Outil <b>Polyligne</b>.', 'Cliquez les 3 points jaunes : en bas à gauche, en haut, puis le milieu.', `${SP} pour terminer.`), more: `Le M est symétrique : on n'en dessine que la moitié, le miroir fera le reste.`,
          wait: () => !!polyOf([[0, 0], [0, 4], [1.5, 2]], false) },
        { title: 'Le M, l\'autre moitié en miroir', target: 'btn-mirror', tip: 'Copie miroir<br><small>ou MI + Espace</small>', ghost: () => [gl([1.5, -0.4], [1.5, 4.4], { label: 'axe du miroir', lp: W(1.5, 4.4), snap: [W(1.5, 0), W(1.5, 4.4)] }), gp([[3, 0], [3, 4], [1.5, 2]])],
          why: `La <b>copie miroir</b> reflète un dessin de l'autre côté d'un axe : on dessine une moitié, on obtient l'autre, parfaitement symétrique.`,
          do: ol('Sélectionnez la demi-lettre (clic dessus).', 'Outil <b>Copie miroir</b>.', 'Cliquez les 2 points de l\'axe vertical (les points jaunes).', `${SP} : le reflet apparaît, l'original reste.`),
          wait: () => !!polyOf([[3, 0], [3, 4], [1.5, 2]], false) },
        { title: 'Le M, d\'un seul morceau', target: 'btn-join', tip: 'Joindre<br><small>ou JO + Espace</small>', ghost: () => [gp(M1)],
          why: `Nos deux moitiés se touchent au milieu. <b>Joindre</b> les réunit en <b>une seule polyligne</b> : un seul objet à sélectionner, une seule longueur au métré.`,
          do: ol(`Sélectionnez les deux moitiés (clic sur l'une, ${K('Maj')} + clic sur l'autre).`, 'Cliquez <b>Joindre</b>.'), wait: () => !!polyOf(M1, false) },
        // O
        { title: 'Le O', target: 'btn-circle', tip: 'Cercle<br><small>ou RO + Espace</small>', ghost: () => [gc([5.5, 2], 2, { label: () => 'rayon ' + U(2) + ' ' + UN(), lp: W(5.5, 4) })],
          why: `Le <b>cercle</b> : un regard, un arbre, un giratoire… et ici notre O.`,
          do: () => ol('Outil <b>Cercle</b>.', 'Cliquez le <b>centre</b> (le point jaune).', `Tapez le rayon ${K(U(2))} puis ${SP}.`), more: `Taper la valeur au clavier garantit un dessin juste : c'est LE réflexe à prendre.`,
          wait: () => !!circleOf([5.5, 2], 2) },
        // sélection fenêtre + copier
        { title: 'Sélectionner M et O ensemble', target: 'btn-select-box', tip: 'Sélection<br><small>ou Échap</small>', ghost: () => [gp([[-0.6, -0.6], [7.9, -0.6], [7.9, 4.6], [-0.6, 4.6]], true, { label: 'clic ici… puis là', lp: W(-0.6, 4.6), snap: [W(-0.6, 4.6), W(7.9, -0.6)] })],
          why: `Pour agir sur plusieurs objets, on les sélectionne ensemble. Un <b>clic dans le vide, puis un 2<sup>e</sup> clic</b> trace une <b>fenêtre</b> : tout ce qui est entièrement dedans est pris.`,
          do: ol(`${K('Échap')} pour l'outil Sélection.`, 'Cliquez un coin de la fenêtre jaune, relâchez, puis cliquez le coin opposé.', 'Le M et le O passent en rose.'),
          more: `Autres gestes : un clic sur un objet ; ou bouton maintenu en glissant = un <b>lasso</b> à main levée.`,
          wait: () => { const m = polyOf(M1, false), o = circleOf([5.5, 2], 2); return !!m && !!o && G.sel().includes(m) && G.sel().includes(o); } },
        { title: 'MOMO : copier M et O', target: 'btn-copy', tip: 'Copier<br><small>ou CP + Espace</small>', ghost: () => [garrow([0, 0], [8.5, 0], { label: 'de ce point… à celui-là', lp: W(8.5, 0) }), gp(M2), gc([14, 2], 2)],
          why: `<b>Copier</b> reproduit un dessin au bon endroit, l'original reste. Pourquoi redessiner « MO » quand on peut le copier ?`,
          do: ol('M et O toujours sélectionnés, outil <b>Copier</b>.', 'Cliquez le point de base : le coin en bas à gauche du M.', 'Cliquez la destination (le point jaune au bout de la flèche).', `${SP} pour terminer.`),
          more: `On peut aussi taper la distance (${U(8.5)}) au lieu de cliquer la destination.`, wait: () => !!polyOf(M2, false) && !!circleOf([14, 2], 2) },
        // C
        { title: 'Le C', target: 'btn-arc', tip: 'Arc<br><small>ou AR + Espace</small>', ghost: () => [ga([19, 2], 2, 45, 315, { label: 'centre, départ en bas, 270°', lp: W(17, 4.2) })],
          why: `L'<b>arc</b> : une bordure courbe, un rayon de giration… et notre C.`,
          do: ol('Outil <b>Arc</b>.', 'Cliquez le <b>centre</b> (point jaune au milieu).', 'Cliquez le <b>départ</b> : le point jaune <b>en bas</b> à droite.', `Tournez la souris autour du centre <b>par le bas, puis vers la gauche</b> : l'arc suit votre geste. Cliquez le point jaune <b>en haut</b> à droite.`), more: `Autre façon, au clavier : après le départ, tapez l'angle ${K('270')} puis ${SP}.`,
          wait: () => { const a = arcOf([19, 2], 2); if (!a) return false; try { const L = W(17, 2); return t2OnArc(a, Math.atan2(L.y - a.y, L.x - a.x)) && t2ArcSweep(a) > 4.4 && t2ArcSweep(a) < 5.0; } catch (e) { return true; } } },
        // A
        { title: 'Le A', target: 'btn-pline', tip: 'Polyligne', ghost: () => [gp([[22, 0], [23.5, 4], [25, 0]])],
          why: `Encore une polyligne : les deux jambes du A.`, do: ol('Outil <b>Polyligne</b>.', 'Cliquez les 3 points jaunes.', `${SP} pour terminer.`),
          wait: () => !!polyOf([[22, 0], [23.5, 4], [25, 0]], false) },
        { title: 'La barre du A, trop longue', target: 'btn-line', tip: 'Droite<br><small>ou DR + Espace</small>', ghost: () => [gl([21.5, 1.5], [25.5, 1.5])],
          why: `La <b>droite</b>, le trait de base. On la trace exprès trop longue : l'outil suivant va la recouper proprement.`,
          do: ol('Outil <b>Droite</b>.', 'Cliquez les 2 points jaunes : elle dépasse des deux côtés du A.'), wait: () => hasLine([21.5, 1.5], [25.5, 1.5]) },
        { title: 'Couper ce qui dépasse', target: 'btn-trim', tip: 'Couper<br><small>ou C + Espace</small>', ghost: () => [gl([22.5625, 1.5], [24.4375, 1.5], { label: 'garder seulement ce morceau', lp: W(24.5, 1.5) })],
          why: `<b>Couper</b> nettoie les dépassements : on clique le morceau en trop, il disparaît jusqu'au trait qui le croise. Plus besoin de viser les intersections au millimètre.`,
          do: ol('Outil <b>Couper</b>.', 'Cliquez le bout qui dépasse à <b>gauche</b> du A, puis celui qui dépasse à <b>droite</b>.'), wait: () => hasLine([22.5625, 1.5], [24.4375, 1.5]) },
        // D
        { title: 'Le D, d\'abord un rectangle', target: 'btn-rect', tip: 'Rectangle<br><small>ou QR + Espace</small>', ghost: () => [gp([[26, 0], [28.5, 0], [28.5, 4], [26, 4]], true, { label: () => U(2.5) + ' × ' + U(4), lp: W(28.5, 4), snap: [W(26, 0)] })],
          why: `Le <b>rectangle</b> : bâtiment, place de parking, emprise… Ses dimensions se tapent au clavier.`,
          do: () => ol('Outil <b>Rectangle</b>.', 'Cliquez le coin en bas à gauche (point jaune).', `La souris vers le haut à droite, tapez ${K(U(2.5))} ${SP} (largeur) puis ${K(U(4))} ${SP} (hauteur).`),
          wait: () => !!polyOf([[26, 0], [28.5, 0], [28.5, 4], [26, 4]], true) },
        { title: 'Éclater le rectangle', target: 'btn-ungroup', tip: 'Éclater<br><small>ou EC + Espace</small>', ghost: () => [gl([26, 0], [28.5, 0]), gl([28.5, 0], [28.5, 4]), gl([28.5, 4], [26, 4]), gl([26, 4], [26, 0])],
          why: `Un rectangle est un seul objet. <b>Éclater</b> le décompose en 4 droites indépendantes, pour retravailler ses angles.`,
          do: ol('Sélectionnez le rectangle.', 'Cliquez <b>Éclater</b> (juste à côté du cadenas Grouper).'), wait: () => hasLine([26, 0], [28.5, 0]) && hasLine([28.5, 0], [28.5, 4]) && hasLine([28.5, 4], [26, 4]) },
        { title: 'Arrondir le haut du D', target: 'btn-fillet', tip: 'Arrondir<br><small>ou RA + Espace</small>', ghost: () => [ga([27.25, 2.75], 1.25, 0, 90, { label: () => 'R = ' + U(1.25), lp: W(28.6, 4) })],
          why: `<b>Arrondir</b> raccorde deux droites par un arc tangent : un angle de bordure, un rayon de giration… et la panse du D.`,
          do: () => ol('Outil <b>Arrondir</b>.', 'Cliquez le côté <b>du haut</b>, puis le côté <b>de droite</b>.', `Tapez le rayon ${K(U(1.25))} puis ${SP}.`), wait: () => !!arcOf([27.25, 2.75], 1.25) },
        { title: 'Arrondir le bas du D', target: 'btn-fillet', tip: 'Arrondir', ghost: () => [ga([27.25, 1.25], 1.25, 270, 360)],
          why: `Même geste pour l'angle du bas.`, do: () => ol('Cliquez le côté <b>du bas</b>, puis le côté <b>de droite</b>.', `${SP} seul reprend le dernier rayon (${U(1.25)}).`), wait: () => !!arcOf([27.25, 1.25], 1.25) },
        // soulignement
        { title: 'Le soulignement', target: 'btn-line', tip: 'Droite', ghost: () => [gl([0, -1], [20, -1], { label: () => U(20) + ' ' + UN() + ' vers la droite', lp: W(20, -1), snap: [W(0, -1)] })],
          why: `Une droite <b>à la cote</b> : on clique le départ, on tape la longueur, elle part dans la direction de la souris.`,
          do: () => ol('Outil <b>Droite</b>, cliquez le point jaune de départ.', `Maintenez ${K('Maj')} (trait bien horizontal), souris vers la droite.`, `Tapez ${K(U(20))} puis ${SP}.`), wait: () => hasLine([0, -1], [20, -1]) },
        { title: 'Le soulignement à la bonne longueur', target: 'btn-lengthen', tip: 'Longueur<br><small>ou LO + Espace</small>', ghost: () => [gl([0, -1], [28.5, -1], { label: () => U(28.5) + ' ' + UN(), lp: W(28.5, -1) })],
          why: `Il est trop court ! <b>Longueur</b> donne une longueur exacte à un trait existant, sans le redessiner.`,
          do: () => ol('Outil <b>Longueur</b>.', `Tapez ${K(U(28.5))} puis ${SP} : c'est la longueur totale voulue.`, 'Cliquez près du bout <b>droit</b> du trait : il s\'allonge.'), wait: () => hasLine([0, -1], [28.5, -1]) },
        { title: 'Doubler le soulignement', target: 'btn-offset', tip: 'Décaler<br><small>ou DE + Espace</small>', ghost: () => [gl([0, -1.5], [28.5, -1.5], { label: () => U(0.5) + ' ' + UN() + ' plus bas', lp: W(28.5, -1.5) })],
          why: `<b>Décaler</b> crée une copie parallèle à distance fixe : une bordure, un trottoir, un fil d'eau… et ici un double trait.`,
          do: () => ol('Outil <b>Décaler</b>, tapez la distance ' + K(U(0.5)) + ' puis ' + SP + '.', 'Cliquez le soulignement.', 'Cliquez <b>en dessous</b> : la copie apparaît.'), wait: () => hasLine([0, -1.5], [28.5, -1.5]) },
        // hachures
        { title: 'Remplir les O', target: 'btn-hatch', tip: 'Hachure<br><small>ou HA + Espace</small>', ghost: () => [gc([5.5, 2], 1.95), gc([14, 2], 1.95)],
          why: `La <b>hachure</b> remplit une zone fermée et donne sa surface : un enrobé, un espace vert… ou nos deux O.`,
          do: ol('Outil <b>Hachure</b>.', 'Cliquez <b>à l\'intérieur</b> du premier O, puis du second.', 'La surface s\'affiche en bas de l\'écran.'), wait: () => hatchAt([5.5, 2]) && hatchAt([14, 2]) },
        { title: 'Votre logo !', why: `Regardez : <b>MOMOCAD</b>, dessiné à la cote. Polyligne, miroir, joindre, cercle, sélection, copier, arc, droite, couper, rectangle, éclater, arrondir, longueur, décaler, hachure : vous avez utilisé 15 outils.`,
          do: `Double-clic molette pour tout voir. ${K('Ctrl')}+${K('Z')} annule une action, ${K('Ctrl')}+${K('Y')} la refait ; ${K('Suppr')} efface la sélection.`,
          more: `Prochain tuto : <b>Les outils avancés</b> (niveau Initié) : un petit parking, avec calques, réseau, cotes et blocs.`, last: true },
    ];

    // ===================================================================== 2. INITIÉ : un petit parking
    // modèle (m) : emprise 0,0 – 20,12 ; places 2,5 × 5 depuis 1,0 (6 places) ; accès en biais 20,4 -> 45° 4 m ; haie y = 14 ; regard centre 10,9 r 0,5
    const AC = [20 + 4 * Math.SQRT1_2, 4 + 4 * Math.SQRT1_2], ACM = [20 + 2 * Math.SQRT1_2, 4 + 2 * Math.SQRT1_2], PLACE = (k) => [[1 + 2.5 * k, 0], [3.5 + 2.5 * k, 0], [3.5 + 2.5 * k, 5], [1 + 2.5 * k, 5]];
    const parkLayer = () => G.layers().find(l => /parking/i.test(l.name || ''));
    const ADV = [
        { title: 'Les outils avancés', why: `On passe à la vitesse supérieure avec un vrai petit projet : <b>un parking</b>. Calques, accroches, suivi polaire, réseau de places, arbres plantés, cotes, regard, textes, mesure, puis métré et impression.`,
          do: `Comme pour le logo, le modèle est en pointillés : jaune = maintenant, vert = fait. L'étape se coche quand votre dessin correspond.`, more: `Le tuto « Les outils de base » est conseillé avant celui-ci.` },
        { title: 'Les points d\'accroche', target: 'snapbtn-endpoint', tip: 'Barre des accroches', why: `Un trait qui « tombe presque » sur un autre fausse les surfaces, les hachures et les cubatures. Les <b>accroches</b> font sauter le curseur exactement sur le bout d'un trait, son milieu, un centre, un croisement, une tangente…`,
          do: `Regardez la barre jaune en haut : un bouton par type d'accroche, allumé = actif. Le repère n'apparaît que pendant un tracé.` },
        { title: 'Un calque Parking', target: 'button[onclick="openLayerModal()"]', tip: 'Gérer les calques', why: `Les calques rangent le dessin comme des transparents : chacun sa couleur, son trait, et surtout le <b>métré compte par calque</b>.`,
          do: ol('Ouvrez le gestionnaire de calques.', `Tapez <b>Parking</b> dans « Nouveau calque », puis ${K('Entrée')}.`, 'Il devient le calque actif ; fermez le gestionnaire.'), more: `Ici c'est ${K('Entrée')} qui valide : l'espace sert à écrire le nom.`,
          wait: () => { const l = parkLayer(); return !!l && G.active() === l.id && !G.shown('layer-modal'); } },
        { title: 'L\'emprise du parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp([[0, 0], [20, 0], [20, 12], [0, 12]], true, { label: () => U(20) + ' × ' + U(12), lp: W(20, 12), snap: [W(0, 0)] })],
          why: `Le contour du parking, sur le calque Parking.`, do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Souris en haut à droite, tapez ${K(U(20))} ${SP} puis ${K(U(12))} ${SP}.`),
          wait: () => { const r = polyOf([[0, 0], [20, 0], [20, 12], [0, 12]], true), l = parkLayer(); return !!r && (!l || r.layerId === l.id); } },
        { title: 'L\'accès en biais (suivi polaire)', target: 'btn-toggle-polar', tip: 'Suivi polaire<br><small>ou F10</small>', ghost: () => [gl([20, 4], AC, { label: () => '45° · ' + U(4) + ' ' + UN(), lp: W(...AC), snap: [W(20, 4)] })],
          why: `Le <b>suivi polaire</b> aimante le trait aux angles ronds (15°, 30°, 45°…) : pas de calcul pour tracer en biais.`,
          do: () => ol(`Allumez le suivi polaire : ${K('F10')} (l'Ortho ${K('F8')} doit être éteint).`, 'Outil <b>Droite</b>, cliquez le point jaune sur le bord droit.', `Approchez la souris vers 45° en haut à droite : une ligne pointillée bleue apparaît.`, `Tapez ${K(U(4))} puis ${SP}.`),
          wait: () => hasLine([20, 4], AC) },
        { title: 'Une place de parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp(PLACE(0), true, { label: () => U(2.5) + ' × ' + U(5), lp: W(3.5, 5), snap: [W(1, 0)] })],
          why: `Une place standard fait 2,50 × 5,00 m.`, do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Tapez ${K(U(2.5))} ${SP} puis ${K(U(5))} ${SP}.`), wait: () => !!polyOf(PLACE(0), true) },
        { title: 'Six places d\'un coup : le réseau', target: 'btn-array', tip: 'Réseau<br><small>ou RE + Espace</small>', ghost: () => [1, 2, 3, 4, 5].map(k => gp(PLACE(k), true)),
          why: `Le <b>réseau</b> répète un objet de façon régulière, en une fois, avec un aperçu en direct : des places, des plots, des bornes, des candélabres…`,
          do: () => ol('Sélectionnez la place.', 'Outil <b>Réseau</b>, onglet <b>Grille</b>.', `<b>6</b> colonnes, <b>1</b> ligne, écart entre colonnes ${K(U(2.5))}.`, 'Vérifiez l\'aperçu, puis <b>Créer</b>.'),
          wait: () => [0, 1, 2, 3, 4, 5].every(k => !!polyOf(PLACE(k), true)) },
        { title: 'La limite plantée', target: 'btn-line', tip: 'Droite', ghost: () => [gl([0, 14], [20, 14])], why: `Une haie d'arbres le long du parking : on trace d'abord sa ligne.`,
          do: ol('Outil <b>Droite</b>.', 'Cliquez les 2 points jaunes.'), wait: () => hasLine([0, 14], [20, 14]) },
        { title: 'Planter les arbres : diviser', target: 'btn-divide', tip: 'Diviser<br><small>ou DV + Espace</small>', ghost: () => [5, 10, 15].map(x => gc([x, 14], 1.2)),
          why: `<b>Diviser</b> jalonne un tracé sans le couper : un regard tous les 50 m, un candélabre tous les 25 m… ou un arbre tous les 5 m.`,
          do: ol('Outil <b>Diviser</b>, cliquez la ligne plantée.', 'Choisissez <b>En parts égales</b> : 4 parts.', 'Que poser : <b>❖ Bloc</b> → « Arbre feuillu ».', 'Décochez « aux deux bouts », puis <b>Poser</b>.'),
          wait: () => { try { const grp = new Set(G.shapes().filter(s => s.block && s.groupId).map(s => s.groupId)); return [5, 10, 15].every(x => { const P = W(x, 14); return [...grp].some(g => { const m = G.shapes().filter(s => s.groupId === g); const b = getShapesBoundingBox(m); return b && Math.hypot(b.centerX - P.x, b.centerY - P.y) < mw(0.6); }); }); } catch (e) { return false; } } },
        { title: 'Coter la largeur', target: 'btn-dim-ortho', tip: 'Cote ortho', ghost: () => [gl([0, -2], [20, -2], { label: () => U(20) + ' ' + UN(), lp: W(10, -2), snap: [W(0, 0), W(20, 0)] })],
          why: `Une <b>cote</b> affiche une distance sur le plan, et se met à jour si l'on déplace ses points.`,
          do: ol('Outil <b>Cote ortho</b>.', 'Cliquez les deux coins du bas de l\'emprise.', 'Cliquez sous le parking pour placer la ligne de cote.'),
          wait: () => G.shapes().some(s => s.type === 'dim' && (() => { try { const g = dimGeom(s); return g && Math.abs(g.dist - mw(20)) <= TOL(); } catch (e) { return false; } })()) },
        { title: 'Le regard', target: 'btn-circle', tip: 'Cercle', ghost: () => [gc([10, 9], 0.5, { label: () => 'rayon ' + U(0.5), lp: W(10.5, 9.5) })],
          why: `Un regard d'eaux pluviales au milieu de l'allée.`, do: () => ol('Outil <b>Cercle</b>, cliquez le centre jaune.', `Tapez ${K(U(0.5))} puis ${SP}.`), wait: () => !!circleOf([10, 9], 0.5) },
        { title: 'Coter le regard', target: 'btn-dim-dia', tip: 'Cote de diamètre<br><small>ou CD + Espace</small>', why: `La <b>cote de diamètre</b> (ou de rayon, juste à côté) indique la taille d'un cercle : regard, bassin, giration.`,
          do: ol('Outil <b>Cote de diamètre</b>.', 'Cliquez le regard.', 'Placez le texte à l\'extérieur et cliquez.'), wait: () => G.shapes().some(s => s.type === 'dimr') },
        { title: 'Le nom du parking', target: 'btn-text', tip: 'Texte<br><small>ou TX + Espace</small>', why: `Nommer les ouvrages rend le plan lisible.`,
          do: `Outil <b>Texte</b> : cliquez au milieu du parking, tapez <b>PARKING</b>, puis ${K('Entrée')}.`, wait: () => G.shapes().some(s => s.type === 'text' && /parking/i.test(s.content || '')) },
        { title: 'Signaler l\'entrée', target: 'btn-detail', tip: 'Infobulle<br><small>ou IF + Espace</small>', ghost: () => [garrow([23, 9.5], ACM, { label: 'Entrée', lp: W(23, 9.5), snap: [W(...ACM), W(23, 9.5)] })],
          why: `L'<b>infobulle</b> est une étiquette reliée par une flèche à ce qu'elle désigne. Ici, on écrit « Entrée » à côté de l'accès en biais, pour que le lecteur du plan sache par où entrer.`,
          do: ol('Outil <b>Infobulle</b>.', '1<sup>er</sup> clic : la <b>pointe de la flèche</b>, sur le point jaune au milieu de l\'accès.', '2<sup>e</sup> clic : l\'<b>emplacement de l\'étiquette</b>, sur le second point jaune.', `Une zone de texte s'ouvre : écrivez le mot <b>Entrée</b>, puis appuyez sur la touche ${K('Entrée')} du clavier pour valider.`),
          more: `Le mot et la touche ont le même nom, c'est un hasard : on écrit « Entrée », puis on valide avec la touche ${K('Entrée')}.`,
          wait: () => G.shapes().some(s => s.type === 'detail' && /entr/i.test(s.content || '') && Math.hypot(s.tx - W(...ACM).x, s.ty - W(...ACM).y) <= mw(1.5)) },
        { title: 'Contrôler : mesurer', target: 'btn-measure', tip: 'Mesurer<br><small>ou MES + Espace</small>', why: `Avant d'envoyer un plan, on vérifie : <b>Mesurer</b> donne distances, angle et surface, <b>sans rien dessiner</b>.`,
          do: `Outil <b>Mesurer</b> : cliquez deux coins opposés de l'emprise. La diagonale s'affiche (environ ${U(23.32)} ${UN()}).`, wait: () => G.measured() },
        { title: 'Le métré', target: 'btn-metre', tip: 'Métré<br><small>ou ME + Espace</small>', why: `Le métré transforme le dessin en quantités, <b>par calque</b> : longueurs, surfaces, nombres d'objets.`,
          do: `Ouvrez le <b>Σ Métré</b> : retrouvez le calque Parking. « Copier (tableur) » le colle dans un devis.`, wait: () => G.shown('topo-modal') },
        { title: 'L\'aperçu', target: 'btn-preview', tip: 'Aperçu', why: `Voir la feuille exactement comme elle sortira.`, do: `Fermez le métré puis <b>Aperçu</b>. Molette = échelle, ${SP} = portrait / paysage, ${K('Entrée')} = imprimer, ${K('Échap')} = quitter.`, wait: () => G.mode() === 'preview' },
        { title: 'Bravo, vous êtes initié !', why: `Un vrai petit plan : calque, emprise, accès au suivi polaire, places en réseau, arbres jalonnés, cotes, regard, textes, contrôle et métré.`,
          do: `${K('Ctrl')}+${K('S')} pour l'enregistrer (.mmc) ; le DXF sert à l'échanger.`, more: `Prochain tuto : <b>Le paramétrage</b> (niveau Expert).`, last: true },
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
        { title: 'Une ligne avec texte', target: () => G.layers().some(l => l.dash === 'text') ? '#layer-modal input[title^="Texte répété"]:not([disabled])' : '#layer-modal select[title="Type de ligne"]', tip: () => G.layers().some(l => l.dash === 'text') ? 'Libellé : tapez le texte<br><small>puis Entrée</small>' : 'Type de ligne : choisissez -T-', why: `Pour un réseau, le trait porte son nom : ---EU Ø160---EU Ø160---. Lisible même en noir et blanc.`,
          do: ol('Sur un calque, dans la colonne <b>Trait</b>, choisissez le type de ligne <b>-T-</b>.', `La case <b>Libellé</b> juste à droite s'allume : tapez le texte (ex. EU Ø160), puis ${K('Entrée')}.`), wait: () => G.layers().some(l => l.dash === 'text' && (l.ltText || '').trim()) },
        { title: 'Hachures et points', target: '#layer-modal select[title="Hachure"]', tip: 'Hachure du calque', why: `Chaque calque a son motif de hachure, sa taille de texte et le style de ses points topo (symbole, matricule, altitude).`,
          do: `Changez le motif de hachure d'un calque.`, wait: (c) => JSON.stringify(G.layers().map(l => l.hatch || '')) !== c.h, init: (c) => { c.h = JSON.stringify(G.layers().map(l => l.hatch || '')); } },
        { title: 'Le gabarit d\'entreprise', target: 'btn-dxf-menu', tip: 'Menu fichier', why: `Tout ce réglage se garde dans un <b>gabarit .gbt</b> : calques, paramètres, cartouche et logo, accroches, blocs et catalogue produits. Partagé, il donne à toute l'équipe les mêmes plans et les mêmes prix.`,
          do: `Menu fichier › <b>Enregistrer le gabarit</b>. Les autres font <b>Charger un gabarit</b> ; le dernier chargé revient tout seul au démarrage.` },
        { title: 'Bravo, vous êtes expert !', why: `Votre MomoCAD est réglé « maison » : paramètres, cartouche, prix, calques et gabarit.`, more: `Prochain tuto : <b>Les cubatures</b> (niveau Maître).`, last: true },
    ];

    // ---------- outils de contrôle des exercices 3D ----------
    const solidPoly = (pts, kind) => { const Q = pts.map(p => W(...p)); return G.shapes().find(s => s.type === 'poly' && s.solid && s.solid.kind === kind && sameSet(s.points, Q)); };
    const solidCirc = (kind, c, r) => { const C = W(...c); return G.shapes().find(s => s.type === 'circle' && s.solid && s.solid.kind === kind && near(s, C) && (r === undefined || Math.abs(s.r - mw(r)) <= TOL())); };
    const zOf = (s) => !s ? NaN : s.type === 'circle' ? +s.z : +(s.points[0] || {}).z;
    const mmNear = (a, b, t) => isFinite(a) && Math.abs(a - b) <= (t || 20);
    const RECT = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const gpt = (c, o) => gc(c, 0.3, o);   // un point à viser (petit rond, centre accrochable)

    // ===================================================================== 4. MAÎTRE : le terrassement du parking
    // modèle (m) : terrain 0..40 × 0..40 (points tous les 5 m) ; point levé 12,5 / 32,5 à 102,40 ; plateforme 10..30 × 14..26 à 102,00 ; axe du profil y = 20
    const PLAT = RECT(10, 14, 30, 26);
    const terrHere = () => { const a = W(0, 0), b = W(40, 40); return G.shapes().some(s => s.type === 'point' && near(s, a)) && G.shapes().some(s => s.type === 'point' && near(s, b)); };
    const platHere = () => { const r = polyOf(PLAT, true); return r && (() => { try { return isPlateforme(r); } catch (e) { return false; } })() ? r : null; };
    function demoTerrain() {   // terrain d'exercice : 81 points cotés sur 40 × 40 m, une pente et une bosse, posé sous le modèle
        try {
            if (terrHere()) { updateCommandMessageText('Le terrain d\'exercice est déjà là.'); return; }
            const lay = ensureLayer('Terrain naturel', '#bef264'), added = [];
            for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
                const x = i * 5, y = j * 5, z = 100000 + x * 60 + y * 25 + 1200 * Math.exp(-((x - 26) ** 2 + (y - 14) ** 2) / 120), P = W(x, y);
                const pt = { type: 'point', layerId: lay, x: P.x, y: P.y, z: Math.round(z), zk: 1, mat: 'TN' + (added.length + 1) };
                shapes.push(pt); added.push(pt);
            }
            saveState(); updateLayerUI(); invalidateCache(); draw();
            updateCommandMessageText('TERRAIN D\'EXERCICE : ' + added.length + ' points cotés (100 à 104 m) sur le calque « Terrain naturel ».');
        } catch (e) { alert('Impossible de créer le terrain : ' + e.message); }
    }
    const CUB = [
        { title: 'Le terrassement du parking', why: `Niveau <b>maître</b> : une vraie petite étude de terrassement. On pose le parking de l'Initié sur un terrain en pente, on règle sa plateforme, ses talus et sa structure, puis on sort les <b>cubatures</b>, le <b>profil en long</b> et le <b>métré chiffré</b>.`,
          do: `Il faut d'abord un <b>terrain naturel</b> : en vrai, c'est le levé du géomètre (DXF, CSV…). Ici, je vous en crée un de 40 × 40 m, avec une pente et une petite bosse.`, action: { label: '▸ Créer le terrain d\'exercice', fn: demoTerrain }, wait: terrHere,
          more: `Le modèle en pointillés reste le même principe : jaune = maintenant, vert = fait.` },
        { title: 'Compléter le levé : un point topo', target: 'btn-topo', tip: 'Point topo<br><small>ou PT + Espace</small>', ghost: () => [gpt([12.5, 32.5], { label: 'Z 102,40', lp: W(12.8, 33) })],
          why: `Un point coté porte une altitude Z. Le géomètre en oublie parfois un, ou on relève un regard sur place : on l'ajoute à la main et le terrain se recalcule avec lui.`,
          do: () => ol('Outil <b>Point topo</b>, cliquez le centre du rond jaune.', `Tapez l'altitude ${K('102,4')} puis ${SP}.`), more: `Le Z s'affiche en bas à droite quand on survole un point coté.`,
          wait: () => G.shapes().some(s => s.type === 'point' && near(s, W(12.5, 32.5)) && mmNear(+s.z, 102400)) },
        { title: 'Lire le terrain en 3D', target: () => G.is3D() ? '#v3-rose .rose-eye' : '#rose-svg .rose-eye', tip: () => G.is3D() ? 'Refermer la vue 3D<br><small>œil ou Échap</small>' : 'Vue 3D<br><small>ou VU + Espace</small>', in3D: true, why: `Avant de concevoir, on comprend le terrain : où sont les bosses, dans quel sens il penche, où il faudra creuser.`,
          do: `Cliquez la bulle <b>œil 3D</b> près de la rosace. Glisser = tourner, molette = zoom ; <b>Aberration ×</b> exagère le relief. Repérez la bosse.<br>Puis <b>refermez la vue 3D</b> (bulle œil ou ${K('Échap')}) : la suite se fait sur le plan.`, tick: (c) => { if (G.is3D()) c.seen = true; }, wait: (c) => c.seen && !G.is3D() },
        { title: 'Les courbes de niveau', target: 'btn-contours', tip: 'Courbes de niveau<br><small>ou CN + Espace</small>', why: `Les courbes lisent le relief sur un plan à plat, comme sur une carte IGN : serrées = ça monte fort, espacées = c'est plat.`,
          do: `Revenez au plan, puis <b>Courbes de niveau</b> : équidistance ${K('0,5')}, générez.`, wait: (c) => G.shapes().filter(x => x.gen === 'contour').length > c.n, init: (c) => { c.n = G.shapes().filter(x => x.gen === 'contour').length; } },
        { title: 'L\'emprise du parking', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp(PLAT, true, { label: () => U(20) + ' × ' + U(12), lp: W(30, 26), snap: [W(10, 14)] })],
          why: `La <b>plateforme</b> est la forme du projet posée à une altitude : un parking, une dalle de bâtiment, une voirie. On commence par son contour.`,
          do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Souris en haut à droite, tapez ${K(U(20))} ${SP} puis ${K(U(12))} ${SP}.`), wait: () => !!polyOf(PLAT, true) },
        { title: 'Le niveau du parking', ghost: () => [gp(PLAT, true, { label: 'Z 102,00', lp: W(20, 20), snap: [] })],
          why: `C'est l'altitude du projet fini. Dès qu'elle est donnée, MomoCAD dessine les <b>talus</b> jusqu'au terrain : <span style="color:#fca5a5">rouges en déblai</span> (on creuse), <span style="color:#93c5fd">bleus en remblai</span> (on apporte).`,
          do: ol('Sélectionnez le rectangle, tapez ' + K('Y') + '.', `Chapitre <b>Plateforme</b> : nom <b>Parking</b>, Z de tous les sommets ${K('102')}.`, '<b>Appliquer</b>.'),
          wait: () => { const r = platHere(); return !!r && r.points.every(p => mmNear(+p.z, 102000)); } },
        { title: 'Adoucir le remblai', why: `La pente des talus dépend du sol : 3/2 en remblai courant, 1/1 en déblai tenu. Un talus plus doux prend plus de place mais tient mieux… et change les volumes.`,
          do: ol(`Rouvrez ${K('Y')} sur la plateforme, chapitre <b>Talus</b>.`, 'Pente de <b>remblai</b> : <b>2/1</b> (2 m à plat pour 1 m de haut).', '<b>Appliquer</b> : les talus bleus s\'élargissent.'),
          more: `Une plateforme <b>inclinée</b> (rampe) se règle au même endroit : un Z par sommet.`,
          wait: () => { const r = platHere(); try { return !!r && platTalus(r).kR === '2/1'; } catch (e) { return false; } } },
        { title: 'La structure de chaussée', why: `Sous l'enrobé il y a des couches : GNT, géotextile… MomoCAD les quantifie (volume, tonnage, prix) et terrasse au <b>fond de forme</b>, sous la dernière couche.`,
          do: ol(`${K('Y')} sur la plateforme, chapitre <b>▤ Structure</b>.`, 'Ajoutez <b>GNT 0/31,5</b> sur 20 cm et <b>GNT 0/80</b> sur 30 cm.', '<b>Appliquer</b>.'),
          wait: () => { const r = platHere(); return !!r && !!r.struct && (r.struct.layers || []).length >= 2; } },
        { title: 'Lancer les cubatures', target: 'btn-cubature', tip: 'Cubatures<br><small>ou CU + Espace</small>', why: `Le calcul des volumes de déblai et de remblai, plateforme par plateforme, talus et structure compris.`,
          do: `Bouton <b>Cubatures</b> : cochez <b>Parking</b>, puis <b>2. Résultats</b>.`, wait: (c) => window.__cubPdf && window.__cubPdf !== c.r, init: (c) => { c.r = window.__cubPdf; } },
        { title: 'Lire les résultats', why: `Le parking est à cheval sur la bosse : il y a du déblai d'un côté, du remblai de l'autre. Le <b>solde</b> dit s'il faut évacuer ou apporter de la terre.`,
          do: `<ul><li><b>PDF</b> : le rapport avec vue en plan cotée et vues 3D ;</li><li><b>Copier (tableur)</b> pour le devis ;</li><li><b>Tracer sur le plan</b> : la limite déblai / remblai.</li></ul>` },
        { title: 'Le profil en long', target: 'btn-profile', tip: 'Profil en long<br><small>ou PR + Espace</small>', ghost: () => [gl([5, 20], [35, 20], { label: 'axe du profil', lp: W(35, 20) })],
          why: `La coupe du terrain et du projet le long d'un axe, avec son tableau de cotes : on voit d'un coup d'œil où l'on creuse et où l'on remblaie.`,
          do: () => ol('Outil <b>Profil en long</b>.', 'Cliquez les 2 points jaunes de l\'axe, puis ' + SP + '.'), wait: () => G.modalHas('Profil') },
        { title: 'Le métré chiffré', target: 'btn-metre', tip: 'Métré', why: `La synthèse pour le devis : déblai, remblai, chaque produit de la structure, avec vos prix et le <b>total HT</b>.`,
          do: `Fermez le profil, puis <b>Σ Métré</b> : tableau « Terrassement et matériaux ».`, wait: () => G.modalHas('Terrassement') },
        { title: 'Maître du terrassement !', why: `Levé complété, relief lu, plateforme calée à 102,00, talus réglés, structure, cubatures, profil et métré chiffré : le circuit complet d'une étude de terrassement.`, more: `Prochain tuto : <b>La modélisation 3D</b> (niveau Seigneur).`, last: true },
    ];

    // ===================================================================== 5. SEIGNEUR : un regard en béton
    // modèle (m) : dalle 0..2 × 0..2 (0,20) ; regard centre 1,1 r 0,60 h 1,50 paroi 0,10 ; profil du couvercle 4..4,7 × 0..0,15, axe x = 4 ;
    //              bordure en U ; rampe -2,5..-1 × 0..2 (0,15) inclinée
    const DALLE = RECT(0, 0, 2, 2), RAMPE = RECT(-2.5, 0, -1, 2), PROF = RECT(4, 0, 4.7, 0.15), BORD = [[-0.5, 2.5], [-0.5, -0.5], [2.5, -0.5], [2.5, 2.5]];
    const dalle = () => solidPoly(DALLE, 'box'), regard = () => solidCirc('tube', [1, 1], 0.6), couv = () => solidCirc('rev', [1, 1], 0.7), rampe = () => solidPoly(RAMPE, 'box');
    const topOf = (s) => zOf(s) + ((s && s.solid && +s.solid.H) || 0);
    const MODEL = [
        { title: 'La modélisation 3D', why: `Niveau <b>seigneur</b> : on passe en volume avec un vrai ouvrage, <b>un regard en béton</b> : sa dalle, son anneau, son couvercle, la bordure autour et une petite rampe d'accès. Utile pour visualiser, métrer en m³ ou imprimer en 3D.`,
          do: `Le modèle est en pointillés sur le plan, vu de dessus. Chaque étape se coche quand le volume est juste : bonne place, bonne taille, bonne hauteur.` },
        { title: 'La palette Modélisation', target: '.pal[data-pal="model"] .pal-h', tip: 'Palette Modélisation', why: `Elle est repliée au démarrage pour ne pas encombrer l'écran.`, do: `Cliquez son titre pour la déplier.`, wait: () => G.palOpen('model') },
        { title: 'La dalle de fond', target: 'btn-solid-box', tip: 'Pavé<br><small>ou PA + Espace</small>', ghost: () => [gp(DALLE, true, { label: () => U(2) + ' × ' + U(2) + ', épaisseur 0,20', lp: W(2, 2), snap: [W(0, 0)] })],
          why: `Le <b>pavé</b> est le volume le plus simple : un massif, une dalle, un socle. On le dessine comme un rectangle, puis on lui donne sa hauteur.`,
          do: () => ol('Outil <b>Pavé</b>, cliquez le coin jaune.', `Tapez ${K(U(2))} ${SP} puis ${K(U(2))} ${SP}.`, `Dans la fenêtre : hauteur ${K('0,2')}, <b>Appliquer</b>.`),
          wait: () => { const d = dalle(); return !!d && mmNear(+d.solid.H, 200); } },
        { title: 'L\'anneau du regard', target: 'btn-solid-tube', tip: 'Tube<br><small>ou TU + Espace</small>', ghost: () => [gc([1, 1], 0.6, { label: () => 'rayon ' + U(0.6) + ' · h 1,50 · paroi 0,10', lp: W(1.6, 1.6) })],
          why: `Le <b>tube</b> est un cylindre creux : un regard, une buse, un fourreau. Son volume de béton s'affiche dans les propriétés.`,
          do: () => ol('Outil <b>Tube</b>, cliquez le centre jaune.', `Tapez le rayon ${K(U(0.6))} ${SP}.`, `Dans la fenêtre : hauteur ${K('1,5')}, épaisseur de paroi ${K('0,1')}, <b>Appliquer</b>.`),
          wait: () => { const t = regard(); return !!t && mmNear(+t.solid.H, 1500) && mmNear(+t.solid.e, 100); } },
        { title: 'Poser le regard sur sa dalle', target: 'btn-stack', tip: 'Poser sur<br><small>ou PS + Espace</small>', ghost: () => [garrow([1, 1.6], [1.7, 0.3], { label: 'le regard… sur la dalle', lp: W(1.7, 0.3) })],
          why: `Pour l'instant le regard et la dalle partent du même niveau : ils se traversent. <b>Poser sur</b> cale un objet pile sur un autre, sans calculer de hauteur.`,
          do: ol('Outil <b>Poser sur</b>.', 'Cliquez le <b>bord du regard</b> (l\'objet à poser).', 'Cliquez la <b>dalle</b>, dans un coin, hors du regard.'),
          wait: () => { const d = dalle(), t = regard(); return !!d && !!t && mmNear(zOf(t), topOf(d)); } },
        { title: 'Le couvercle : sa demi-coupe', target: 'btn-rect', tip: 'Rectangle', ghost: () => [gp(PROF, true, { label: () => U(0.7) + ' × ' + U(0.15), lp: W(4.7, 0.15), snap: [W(4, 0)] })],
          why: `Un objet rond se dessine par sa <b>demi-coupe</b> : la moitié de sa section, vue de côté. Ici le couvercle : 0,70 de rayon (il déborde de l'anneau) et 0,15 d'épaisseur.`,
          do: () => ol('Outil <b>Rectangle</b>, cliquez le coin jaune.', `Tapez ${K(U(0.7))} ${SP} puis ${K(U(0.15))} ${SP}.`), wait: () => !!polyOf(PROF, true) },
        { title: 'Le couvercle : la révolution', target: 'btn-revolve', tip: 'Révolution<br><small>ou RV + Espace</small>', ghost: () => [gl([4, -0.4], [4, 0.6], { label: 'axe', lp: W(4, 0.6), snap: [W(4, -0.4)] }), gc([1, 1], 0.7, { label: 'posé ici', lp: W(1, 1.8), snap: [W(1, 1)] })],
          why: `La <b>révolution</b> fait tourner la demi-coupe autour d'un axe vertical : on obtient un volume rond, même compliqué (regard avec feuillure, cuve, poteau).`,
          do: ol('Outil <b>Révolution</b>, cliquez le rectangle.', 'Cliquez le point jaune de l\'<b>axe</b> (le bord gauche de la coupe).', 'Cliquez le <b>centre du regard</b> : le couvercle s\'y pose.'), more: `Une fois le volume créé, la demi-coupe ne sert plus : on peut l'effacer.`,
          wait: () => !!couv() },
        { title: 'Monter le couvercle', target: 'btn-elevate', tip: 'Élever<br><small>ou EL + Espace</small>', ghost: () => [gc([1, 1], 0.7, { label: '+ 1,70 m', lp: W(1.7, 1.7), snap: [] })],
          why: `Le couvercle est né au pied du regard. <b>Élever</b> monte ou descend un objet d'une hauteur précise : 0,20 de dalle + 1,50 d'anneau = <b>1,70</b>.`,
          do: ol('Sélectionnez le couvercle (clic sur son bord).', `Outil <b>Élever</b> : tapez ${K('1,7')} puis ${SP}.`),
          wait: () => { const t = regard(), k = couv(); return !!t && !!k && mmNear(zOf(k), topOf(t)); } },
        { title: 'Le tracé de la bordure', target: 'btn-pline', tip: 'Polyligne', ghost: () => [gp(BORD, false, { label: '4 points, puis Espace', lp: W(2.5, 2.5) })],
          why: `Une bordure entoure le regard sur trois côtés. On dessine d'abord son <b>tracé</b>, comme une ligne au sol.`,
          do: ol('Outil <b>Polyligne</b>.', 'Cliquez les 4 points jaunes dans l\'ordre, puis ' + SP + '.'), wait: () => !!polyOf(BORD, false) },
        { title: 'La bordure : le balayage', target: 'btn-sweep', tip: 'Balayage<br><small>ou BA + Espace</small>', ghost: () => [gp(BORD, false)],
          why: `Le <b>balayage</b> fait suivre un profil le long d'un tracé : bordure de trottoir, caniveau, tuyau. Le volume de béton est calculé.`,
          do: ol('Outil <b>Balayage</b>, cliquez la polyligne : une bordure la suit.', 'Dans la fenêtre, gardez la bordure <b>T2</b> ou essayez un autre profil.'), wait: () => { const p = polyOf(BORD, false); return !!p && !!p.sweep; } },
        { title: 'La rampe d\'accès', target: 'btn-solid-box', tip: 'Pavé', ghost: () => [gp(RAMPE, true, { label: () => U(1.5) + ' × ' + U(2) + ', épaisseur 0,15', lp: W(-2.5, 2.3), snap: [W(-2.5, 0)] })],
          why: `Une petite dalle à côté du regard, pour y accéder. Encore un pavé.`,
          do: () => ol('Outil <b>Pavé</b>, cliquez le coin jaune.', `Tapez ${K(U(1.5))} ${SP} puis ${K(U(2))} ${SP}.`, `Hauteur ${K('0,15')}, <b>Appliquer</b>.`),
          wait: () => { const r = rampe(); return !!r && mmNear(+r.solid.H, 150); } },
        { title: 'Pencher la rampe', target: 'btn-tilt', tip: 'Incliner<br><small>ou IN + Espace</small>', ghost: () => [gp(RAMPE, true, { label: 'inclinaison 8°', lp: W(-2.5, 2.3), snap: [] })],
          why: `<b>Incliner</b> fait pencher un volume : une dalle en pente, une pièce biaise. La rampe descend vers le regard.`,
          do: ol('Outil <b>Incliner</b>, cliquez la rampe.', `Chapitre « Inclinaison », <b>Autour de X</b> : ${K('8')}, <b>Appliquer</b>.`),
          wait: () => { const r = rampe(); return !!r && !!r.solid.tilt && (Math.abs(r.solid.tilt.x) >= 1 || Math.abs(r.solid.tilt.y) >= 1); } },
        { title: 'Habiller l\'ouvrage', in3D: true, target: 'btn-paint', tip: 'Peindre<br><small>ou PEI + Espace</small>', ghost: () => [gc([1, 1], 0.7, { label: 'Béton', lp: W(1, 1), snap: [] }), gp(RAMPE, true, { label: 'Pavés', lp: W(-1.75, 1), snap: [] })],
          why: `Les <b>textures</b> rendent une maquette lisible : béton, brique, bois, tuiles, enrobé, pelouse… Elles sont posées en vraie grandeur : un pavé fait la taille d'un vrai pavé.`,
          do: ol('Outil <b>Peindre</b> : une fenêtre de textures s\'ouvre à droite.', 'Choisissez <b>Béton</b>, cliquez le couvercle (vu de dessus, il cache le regard).', 'Choisissez <b>Pavés</b>, cliquez la rampe.'), more: `Dans la vue 3D, on peut peindre chaque volume, même caché en plan : essayez le regard. La <b>pipette</b> reprend la texture d'un volume, la <b>gomme</b> rend la couleur du calque.`,
          wait: () => { const k = couv(), r = rampe(); return !!k && !!r && k.tex === 'beton' && r.tex === 'paves'; } },
        { title: 'Admirer et choisir en 3D', target: () => G.is3D() ? '#v3-rose .rose-eye' : '#rose-svg .rose-eye', tip: () => G.is3D() ? 'Refermer la vue 3D<br><small>œil ou Échap</small>' : 'Vue 3D<br><small>ou VU + Espace</small>', in3D: true, why: `La vue 3D sert aussi à travailler : on y clique un volume pour le régler.`,
          do: `Ouvrez la <b>vue 3D</b> (bulle œil près de la rosace), tournez autour du regard, puis cliquez le couvercle (sans glisser) : il passe en rose. Ensuite <b>refermez la vue 3D</b> (bulle œil ou ${K('Échap')}).`, tick: (c) => { if (G.is3D() && G.sel().length > 0) c.seen = true; }, wait: (c) => c.seen && !G.is3D() },
        { title: 'Les volumes au métré', target: 'btn-metre', tip: 'Métré', why: `Les m³ de béton par calque, prêts pour le devis : dalle, anneau, couvercle, bordure.`, do: `De retour sur le plan, <b>Σ Métré</b> : colonne <b>Volumes 3D</b>.`, wait: () => G.modalHas('Volumes 3D') },
        { title: 'Seigneur de la 3D !', why: `Un regard complet : dalle, anneau posé dessus, couvercle tourné et monté à sa place, bordure balayée, rampe inclinée, textures, et ses m³ au métré.`, more: `Dernier tuto : <b>Pièces et bâtiment</b> (niveau Dieu).`, last: true },
    ];

    // ===================================================================== 6. DIEU : une équerre à imprimer, puis une cabane
    // modèle (m) : équerre = pavés 0..4 × 0..1 et 0..1 × 0..3 (h 0,50), trou centre 2,5 / 0,5 r 0,25 ;
    //              cabane 7..12 × 0..4, murs 0 → 2,50, fenêtre sud depuis 8,5 (1,20), porte est depuis y = 1 (0,90), panne y = 2 à 4,70, toit 6,7..12,3 × -0,3..4,3
    const BR1 = RECT(0, 0, 4, 1), BR2 = RECT(0, 0, 1, 3), CAB = [[7, 0], [12, 0], [12, 4], [7, 4]], TOIT = RECT(6.7, -0.3, 12.3, 4.3);
    const wallGroup = () => {   // la chaîne de murs refermée qui passe par les 4 coins de la cabane
        const H = G.shapes().filter(x => x.type === 'hatch' && x.wallMat && x.groupId && x.loops), byG = {};
        H.forEach(h => { (byG[h.groupId] = byG[h.groupId] || []).push(h); });
        const lim = mw(0.4);
        return Object.values(byG).find(L => L.length >= 4 && CAB.every(c => { const P = W(...c); return L.some(h => h.loops[0].some(q => Math.hypot(q.x - P.x, q.y - P.y) <= lim)); })) || null;
    };
    const openings = () => [].concat(...G.shapes().map(x => x.openings || []));
    const openNear = (kind, a, b, wd) => { const M = W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return openings().some(o => (kind === 'porte' ? o.kind === 'porte' : o.kind !== 'porte') && o.a && o.b && Math.hypot((o.a.x + o.b.x) / 2 - M.x, (o.a.y + o.b.y) / 2 - M.y) <= mw(0.4) && Math.abs(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) - mw(wd)) <= mw(0.03)); };
    const roofPans = () => {
        const R = G.shapes().filter(x => x.type === 'poly' && x.solid && x.solid.kind === 'roof' && x.groupId), byG = {};
        R.forEach(r => { (byG[r.groupId] = byG[r.groupId] || []).push(r); });
        const T = TOIT.map(p => W(...p));
        return Object.values(byG).find(L => { const P = [].concat(...L.map(r => r.points)); return L.length >= 2 && T.every(t => P.some(q => near(q, t))); }) || null;
    };
    const roofOk = () => {
        const L = roofPans(); if (!L) return false;
        return L.every(r => { if (!r.points.every(q => mmNear(+q.z, 2500, 30))) return false;
            const P = r.points, eg = r.solid.eg || 0, a = P[eg], b = P[(eg + 1) % P.length], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
            const depth = Math.max(...P.map(q => Math.abs((q.x - a.x) * nx + (q.y - a.y) * ny))), rise = (+r.solid.p || 0) / 100 * (depth / mw(1)) * 1000;
            return Math.abs(rise - 2500) <= 60; });
    };
    const BUILD = [
        { title: 'Pièces et bâtiment', why: `Niveau <b>dieu</b>, en deux temps. D'abord une <b>pièce à imprimer en 3D</b> : une équerre de fixation percée, faite en combinant des volumes. Puis une <b>cabane</b> : murs, fenêtre, porte, panne faîtière et toit deux pans.`,
          do: `Comme d'habitude, le modèle est en pointillés et chaque étape se coche quand c'est juste. Dépliez la palette <b>Modélisation</b> si elle est repliée.` },
        { title: 'L\'équerre : première branche', target: 'btn-solid-box', tip: 'Pavé', ghost: () => [gp(BR1, true, { label: () => U(4) + ' × ' + U(1) + ', h 0,50', lp: W(4, 1), snap: [W(0, 0)] })],
          why: `Une pièce se construit comme un jeu de cubes : des volumes simples qu'on assemble ou qu'on creuse ensuite.`,
          do: () => ol('Outil <b>Pavé</b>, cliquez le coin jaune.', `Tapez ${K(U(4))} ${SP} puis ${K(U(1))} ${SP}.`, `Hauteur ${K('0,5')}, <b>Appliquer</b>.`),
          wait: () => { const b = solidPoly(BR1, 'box'); return !!b && mmNear(+b.solid.H, 500); } },
        { title: 'L\'équerre : seconde branche', target: 'btn-solid-box', tip: 'Pavé', ghost: () => [gp(BR2, true, { label: () => U(1) + ' × ' + U(3) + ', h 0,50', lp: W(1, 3), snap: [W(0, 0)] })],
          why: `La seconde branche chevauche la première dans le coin : c'est voulu, l'union va les souder.`,
          do: () => ol('Outil <b>Pavé</b>, même coin jaune.', `Tapez ${K(U(1))} ${SP} puis ${K(U(3))} ${SP}.`, `Hauteur ${K('0,5')}, <b>Appliquer</b>.`),
          wait: () => { const b = solidPoly(BR2, 'box'); return !!b && mmNear(+b.solid.H, 500); } },
        { title: 'Souder les deux branches', target: 'btn-bool-union', tip: 'Union<br><small>ou UN + Espace</small>', ghost: () => [gp([[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]], true, { label: 'une seule pièce', lp: W(1, 3), snap: [] })],
          why: `L'<b>union</b> fusionne plusieurs volumes en une seule pièce, sans la partie en double au milieu. Indispensable pour l'impression 3D.`,
          do: ol('Sélectionnez les deux pavés (clic, puis Maj + clic).', 'Outil <b>Union</b>.'), wait: (c) => G.named('Union') > c.n, init: (c) => { c.n = G.named('Union'); } },
        { title: 'Le trou de fixation', target: 'btn-solid-cyl', tip: 'Cylindre<br><small>ou CY + Espace</small>', ghost: () => [gc([2.5, 0.5], 0.25, { label: () => 'rayon ' + U(0.25), lp: W(2.8, 0.9) })],
          why: `Pour percer, on dessine d'abord le volume <b>à enlever</b> : un cylindre qui traverse la pièce de part en part.`,
          do: () => ol('Outil <b>Cylindre</b>, cliquez le centre jaune.', `Tapez ${K(U(0.25))} ${SP}.`, 'Gardez la hauteur de 1 m (plus haute que la pièce), <b>Appliquer</b>.'),
          wait: () => !!solidCirc('cyl', [2.5, 0.5], 0.25) },
        { title: 'Percer : soustraire', target: 'btn-bool-sub', tip: 'Soustraire<br><small>ou SU + Espace</small>', ghost: () => [gc([2.5, 0.5], 0.25, { snap: [] })],
          why: `<b>Soustraire</b> retire un volume d'un autre : percer, encocher, réserver un passage, dans n'importe quelle direction.`,
          do: ol('Outil <b>Soustraire</b>.', 'Cliquez la pièce (à garder), puis le cylindre (à retirer).'), wait: (c) => G.named('Soustraction') > c.n, init: (c) => { c.n = G.named('Soustraction'); } },
        { title: 'Le troisième booléen', target: 'btn-bool-inter', tip: 'Intersecter<br><small>ou IS + Espace</small>', why: `<b>Intersecter</b> ne garde que la partie commune de deux volumes. Par exemple une sphère et un pavé donnent un dôme coupé net.`,
          do: `Pas besoin ici : retenez qu'il existe, à côté de l'Union et de la Soustraction.` },
        { title: 'Envoyer à l\'imprimante 3D', target: 'btn-dxf-menu', tip: 'Menu fichier', why: `Le format <b>STL</b> part tel quel dans le logiciel d'une imprimante 3D.`,
          do: `Sélectionnez l'équerre, menu fichier › <b>Exporter en STL</b> : « La sélection seulement », millimètres, « Poser à l'origine ».`, wait: () => G.modalHas('Exporter en STL') },
        { title: 'La cabane : les murs', target: 'btn-blocks', tip: 'Catalogue › 🧱 Parois', ghost: () => [gp(CAB, true, { label: () => U(5) + ' × ' + U(4), lp: W(12, 4) })],
          why: `Le mur porte son matériau (parpaing, brique, béton…) : il se hachure en plan et deviendra un volume percé en 3D. En chaîne, les angles se raccordent tout seuls.`,
          do: ol('Catalogue de blocs, onglet <b>🧱 Parois</b>, choisissez un mur.', 'Cliquez les 4 coins jaunes dans l\'ordre…', '…puis à nouveau le premier : le contour se referme.', `${K('Échap')}.`),
          wait: () => !!wallGroup() },
        { title: 'La hauteur des murs', ghost: () => [gp(CAB, true, { label: 'bas 0 · haut 2,50', lp: W(9.5, 2), snap: [] })],
          why: `En plan, un mur n'a pas de hauteur. On lui donne un <b>niveau bas</b> et un <b>niveau haut</b> pour qu'il existe en 3D et que les ouvertures le percent.`,
          do: ol(`Cliquez un mur (toute la chaîne se sélectionne), ${K('Y')}.`, 'Niveau bas <b>0</b>, niveau haut <b>2,50</b>, <b>Appliquer</b>.'),
          wait: () => { const L = wallGroup(); return !!L && L.every(h => h.wz && mmNear(h.wz.b, 0) && mmNear(h.wz.t, 2500)); } },
        { title: 'La fenêtre', target: 'btn-opening', tip: 'Ouverture<br><small>ou OU + Espace</small>', ghost: () => [gl([8.5, 0], [9.7, 0], { label: () => U(1.2) + ' ' + UN(), lp: W(9.7, -0.3), snap: [W(8.5, 0)] })],
          why: `Percer le mur proprement, au bon endroit et à la bonne largeur : on accroche le début, on tape la largeur.`,
          do: () => ol('Outil <b>Ouverture</b>, cliquez le point jaune sur le mur.', `Souris vers la droite, tapez ${K(U(1.2))} ${SP}.`, 'Choisissez <b>Fenêtre</b> (allège 1,00, hauteur 1,25), <b>Valider</b>.'),
          wait: () => openNear('fen', [8.5, 0], [9.7, 0], 1.2) },
        { title: 'La porte', target: 'btn-opening', tip: 'Ouverture', ghost: () => [gl([12, 1], [12, 1.9], { label: () => U(0.9) + ' ' + UN(), lp: W(12.3, 1.9), snap: [W(12, 1)] })],
          why: `La porte se dessine avec son battant : on choisit le côté de la charnière et le côté où elle s'ouvre, pour vérifier qu'elle ne tape dans rien.`,
          do: () => ol('Outil <b>Ouverture</b>, cliquez le point jaune.', `Souris vers le haut, tapez ${K(U(0.9))} ${SP}.`, 'Choisissez <b>Porte</b>, puis la charnière et le sens d\'ouverture (vers l\'intérieur), <b>Valider</b>.'),
          more: `Double-clic sur une ouverture pour la modifier.`, wait: () => openNear('porte', [12, 1], [12, 1.9], 0.9) },
        { title: 'La panne faîtière', target: 'btn-solid-beam', tip: 'Poutre<br><small>ou PO + Espace</small>', ghost: () => [gl([7, 2], [12, 2], { label: 'Z 4,70', lp: W(12, 2.3) })],
          why: `La <b>poutre</b> porte le toit. Bois ou acier, droite ou en pente : sa section reste perpendiculaire, comme un vrai chevron.`,
          do: ol('Outil <b>Poutre</b>, cliquez les 2 points jaunes.', 'Dans la fenêtre, gardez le bois 63×175.', 'Chapitre <b>Altitudes de l\'axe</b> : Z départ et Z arrivée <b>4,70</b>, <b>Appliquer</b>.'),
          wait: () => G.shapes().some(s => s.type === 'line' && s.sweep && s.sweep.perp && ((near({ x: s.x1, y: s.y1 }, W(7, 2)) && near({ x: s.x2, y: s.y2 }, W(12, 2))) || (near({ x: s.x1, y: s.y1 }, W(12, 2)) && near({ x: s.x2, y: s.y2 }, W(7, 2)))) && mmNear(+s.z1, 4700, 30) && mmNear(+s.z2, 4700, 30)) },
        { title: 'Le toit deux pans', target: 'btn-solid-roof', tip: 'Toiture<br><small>ou TOI + Espace</small>', ghost: () => [gp(TOIT, true, { label: () => U(5.6) + ' × ' + U(4.6) + ' (débord 0,30)', lp: W(12.3, 4.3), snap: [W(6.7, -0.3)] }), gl([6.7, 2], [12.3, 2], { label: 'faîtage', lp: W(6.7, 2.3), snap: [] })],
          why: `Couvrir la cabane en une fois : deux pans à la bonne hauteur, débord compris, avec les <b>pignons</b> fermés sous le toit.`,
          do: () => ol('Outil <b>Toiture</b>, cliquez le coin jaune.', `Tapez ${K(U(5.6))} ${SP} puis ${K(U(4.6))} ${SP}.`, '<b>2 pans</b>, faîtage parallèle <b>au grand côté</b>, égout <b>2,50</b>, faîtage <b>5,00</b>.', 'Cochez <b>Combler les pignons</b>, <b>Créer le toit</b>.'),
          wait: roofOk },
        { title: 'Les tuiles', in3D: true, target: 'btn-paint', tip: 'Peindre', ghost: () => [gp(TOIT, true, { label: 'Tuiles', lp: W(9.5, 3.5), snap: [] })],
          why: `La touche finale : une couverture en tuiles, à l'échelle.`,
          do: ol('Outil <b>Peindre</b>, choisissez <b>Tuiles</b>.', 'Cliquez les deux pans du toit.'), wait: () => { const L = roofPans(); return !!L && L.every(r => r.tex === 'tuile'); } },
        { title: 'Admirez', target: () => G.is3D() ? '#v3-rose .rose-eye' : '#rose-svg .rose-eye', tip: () => G.is3D() ? 'Refermer la vue 3D<br><small>œil ou Échap</small>' : 'Vue 3D<br><small>ou VU + Espace</small>', in3D: true, why: `Le moment de vérité : murs percés, porte, fenêtre, panne, toit et pignons… et l'équerre à côté.`, do: `Ouvrez la <b>vue 3D</b> et faites le tour de la cabane, puis <b>refermez-la</b> (bulle œil ou ${K('Échap')}) pour revenir au plan.`, tick: (c) => { if (G.is3D()) c.seen = true; }, wait: (c) => c.seen && !G.is3D() },
        { title: 'Dieu de MomoCAD !', why: `Une pièce percée prête à imprimer, une cabane complète avec ses ouvertures, sa panne et son toit : vous avez fait le tour de MomoCAD, du terrain au bâtiment.`, more: `Il n'y a pas de niveau au-dessus… pour l'instant.`, last: true },
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
    #mt-root.mini:not(.peek) #mt-dot { display:block; } #mt-dot.ok { background:#22c55e; color:#052e16; }
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
    #mt-tip.r:before { left:auto; right:-7px; border-right:0; border-left:7px solid #f59e0b; }
    #mt-tip.back { background:#38bdf8; } #mt-tip.back.r:before { border-left-color:#38bdf8; } #mt-tip.back:not(.r):before { border-right-color:#38bdf8; }
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
        { id: 'base', level: 'Débutant', title: 'Les outils de base — le logo MOMOCAD', desc: 'Exercice : redessiner le logo MOMOCAD lettre par lettre. Polyligne, miroir, joindre, cercle, sélection en fenêtre, copier, arc, droite, couper, rectangle, éclater, arrondir, longueur, décaler, hachure', minutes: 25, steps: BASE, setup: () => setupExercise(-1, 29.5, -2.5, 5) },
        { id: 'adv', level: 'Initié', title: 'Les outils avancés — un petit parking', desc: 'Exercice : le plan d\'un parking. Calque, accroches, suivi polaire, réseau de places, arbres plantés avec Diviser, cotes, regard et cote de diamètre, texte, infobulle, mesure, métré et aperçu', minutes: 25, steps: ADV, setup: () => setupExercise(-1, 24, -3, 15.5) },
        { id: 'param', level: 'Expert', title: 'Le paramétrage', desc: 'Paramètres ⛯ (plan, impression, cartouche, fond de plan, présentation), catalogue produits et prix, calques avancés, gabarit d\'entreprise', minutes: 15, steps: PARAM },
        { id: 'cub', level: 'Maître', title: 'Les cubatures — le terrassement du parking', desc: 'Exercice : caler le parking sur un terrain en pente. Point topo, vue 3D, courbes de niveau, plateforme à 102,00, talus, structure de chaussée, cubatures et rapport PDF, profil en long, métré chiffré', minutes: 25, steps: CUB, setup: () => setupExercise(-2, 42, -2, 42) },
        { id: 'model', level: 'Seigneur', title: 'La modélisation 3D — un regard en béton', desc: 'Exercice : un regard complet. Pavé, tube, poser sur, révolution, élever, balayage, incliner, peindre en textures, sélection dans la vue 3D, volumes au métré', minutes: 25, steps: MODEL, setup: () => setupExercise(-3, 5.2, -1, 3) },
        { id: 'build', level: 'Dieu', title: 'Pièces et bâtiment — une équerre et une cabane', desc: 'Exercice : une équerre percée à imprimer en 3D (union, soustraction, export STL), puis une cabane : murs, fenêtre, porte, panne faîtière, toit deux pans avec pignons, tuiles', minutes: 30, steps: BUILD, setup: () => setupExercise(-0.5, 12.8, -0.8, 4.8) },
    ];
    let STEPS = BASE, done = [];
    let last3D = false, lastH = 0, root, bubble, ring, tip, momo, idx = 0, ctx = {}, timer = null;

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
        const doTxt = typeof s.do === 'function' ? s.do() : (s.do || s.say);
        const doHtml = doTxt ? `<div class="mt-do"><span class="mt-lab">${hasWait ? 'À vous' : 'Comment faire'}</span>${doTxt}${s.action ? `<div><button class="mt-link" data-a="act">${s.action.label}</button></div>` : ''}</div>` : (s.action ? `<button class="mt-link" data-a="act">${s.action.label}</button>` : '');
        const back3D = G.is3D() && !s.in3D && !s.last && !ok ? `<div class="mt-more" style="border-left-color:#38bdf8;color:#bae6fd;background:#38bdf814">↩ Cette étape se fait sur le plan : refermez d'abord la vue 3D (bulle œil ou ${K('Échap')}).</div>` : '';
        const state = hasWait ? (ok ? `<div id="mt-state" class="ok">✓ ${BRAVO[idx % BRAVO.length]} Étape réussie — passez à la suite avec ▶ quand vous êtes prêt.</div>` : `<div id="mt-state" class="wait">⏳ À vous de jouer… l'étape se cochera toute seule.</div>`) : '';
        bubble.classList.toggle('done', ok);
        const dot = root.querySelector('#mt-dot'); if (dot) { dot.textContent = ok ? '✓' : '…'; dot.classList.toggle('ok', ok); }
        bubble.innerHTML = `<div class="mt-h"><span class="mt-n">Étape ${idx + 1} / ${n}</span><button class="mt-x" data-a="x" title="Arrêter la visite">✕</button></div>
            <div class="mt-t">${ok ? '<span class="mt-ck">✓</span>' : ''}${s.title}</div>
            ${s.why ? `<div class="mt-why"><span class="mt-lab">À quoi ça sert</span>${s.why}</div>` : ''}
            ${doHtml}
            ${s.more ? `<div class="mt-more">💡 ${s.more}</div>` : ''}
            ${back3D}${state}
            <div id="mt-bar"><i style="width:${Math.round((idx + (ready ? 1 : 0)) / n * 100)}%"></i></div><div id="mt-acts">${btns.join('')}</div>`;
        momo.classList.remove('talk'); void momo.getBoundingClientRect(); momo.classList.add('talk');
        bubble.scrollTop = 0; place();
    }
    // la cible peut être dans une fenêtre fermée : on montre alors le bouton qui la rouvre
    const OPENERS = [['#cartouche-modal', 'btn-print-settings', '↩ Rouvrir les Paramètres ⛯'], ['#layer-modal', 'button[onclick="openLayerModal()"]', '↩ Rouvrir le gestionnaire de calques']];
    const findEl = (sel) => !sel ? null : (sel instanceof Element ? sel : document.getElementById(sel) || (/[\[\.#\s]/.test(sel) ? document.querySelector(sel) : null));
    const visible = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    function resolveTarget() {
        const s = STEPS[idx]; if (!s) return { el: null };
        // étape sur le plan alors que la vue 3D est ouverte : on montre d'abord comment la refermer
        if (G.is3D() && !s.in3D && !s.last) { const eye = findEl('#v3-rose .rose-eye'); if (visible(eye)) return { el: eye, tip: '↩ Refermez la vue 3D<br><small>œil ou Échap</small>', back: true }; }
        if (!s.target) return { el: null };
        const sel = typeof s.target === 'function' ? s.target() : s.target, tipTxt = typeof s.tip === 'function' ? s.tip() : s.tip;
        const e = findEl(sel);
        if (visible(e)) return { el: e, tip: tipTxt };
        const sels = typeof sel === 'string' ? sel : '';
        for (const [box, op, lab] of OPENERS) if (sels.startsWith(box) && !G.shown(box.slice(1))) { const o = findEl(op); if (visible(o)) return { el: o, tip: lab, back: true }; }
        return { el: e, tip: tipTxt };
    }
    function targetEl() { return resolveTarget().el; }
    // fenêtre ouverte (paramètres, calques, Y, cubatures…) : Momo ne doit pas cacher ses boutons
    function modalCard() {
        const L = [['topo-modal', 1], ['cartouche-modal', 1], ['selparam-modal', 1], ['layer-modal', 0], ['snap-modal', 0], ['help-modal', 1], ['t2-panel', 0]];
        for (const [id, child] of L) { if (!G.shown(id)) continue; const e = document.getElementById(id), c = child ? e.firstElementChild : e; if (c) { const r = c.getBoundingClientRect(); r.side = id === 't2-panel'; return r; } }
        return null;
    }
    function place() {
        const pp = document.getElementById('properties-popup'), host = root.parentElement.getBoundingClientRect();
        // panneau des propriétés ouvert (en bas à droite) : Momo se pose au-dessus, sans glisser sur le dessin
        const ppOn = pp && !pp.classList.contains('hidden') && pp.offsetWidth, ppr = ppOn ? pp.getBoundingClientRect() : null;
        let right = 16, mini = false;
        root.style.left = ''; root.style.right = right + 'px'; root.style.bottom = ppr ? Math.max(52, host.bottom - ppr.top + 10) + 'px' : '52px';
        bubble.style.maxHeight = Math.max(220, host.height - (parseFloat(root.style.bottom) || 52) - 20) + 'px';
        const mc = modalCard();
        if (mc) {
            if (bubble.offsetHeight) lastH = bubble.offsetHeight;
            const W = 520, H = Math.max(lastH || 260, 140), zr = host.right - right, zb = host.bottom - (parseFloat(root.style.bottom) || 52);
            const rr = { left: zr - W, right: zr, top: zb - H, bottom: zb };
            const over = !(rr.right < mc.left || rr.left > mc.right || rr.bottom < mc.top || rr.top > mc.bottom);
            if (over && mc.side) { mini = true; root.style.right = (host.right - mc.left + 12) + 'px'; }   // panneau d'outil à droite : Momo se fait petit à côté, le dessin reste visible (clic sur Momo = relire)
            else if (over) {
                if (mc.left - host.left >= W + 24) { root.style.right = (host.right - mc.left + 12) + 'px'; }
                else if (host.right - mc.right >= W + 24) { root.style.right = '16px'; }
                else { mini = true; root.style.right = 'auto'; root.style.left = '8px'; }
            }
        }
        root.classList.toggle('mini', mini); if (!mini) root.classList.remove('peek');
        const R = resolveTarget(), t = R.el, s = STEPS[idx];
        if (!t) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        if (!t.offsetParent) { const pal = t.closest('.pal'); if (pal && pal.dataset.pal && typeof togglePal === 'function' && pal.classList.contains('closed')) togglePal(pal.dataset.pal); }
        const r = t.getBoundingClientRect();
        if (!r.width) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        const aside = t.closest('aside'); if (aside) { const ar = aside.getBoundingClientRect(); if (r.top < ar.top || r.bottom > ar.bottom) t.scrollIntoView({ block: 'nearest' }); }
        Object.assign(ring.style, { display: 'block', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
        if (R.tip) { tip.innerHTML = R.tip; tip.classList.toggle('back', !!R.back); tip.style.display = 'block'; const th = tip.offsetHeight, tw = tip.offsetWidth; let L = r.right + 14, right = false; if (L + tw > window.innerWidth - 8) { L = Math.max(8, r.left - tw - 14); right = true; } tip.classList.toggle('r', right); tip.style.left = L + 'px'; tip.style.top = Math.max(6, r.top + r.height / 2 - th / 2) + 'px'; }
        else tip.style.display = 'none';
    }
    function setGhost() {
        const items = [];
        STEPS.forEach((st, j) => { if (!st.ghost || j > idx) return; (st.ghost() || []).forEach(it => { it.cur = j === idx; if (typeof it.label === 'function') it.label = it.label(); items.push(it); }); });
        window.tutoGhost = items.length ? { items, pts: [].concat(...items.filter(it => it.cur).map(it => it.snap || [])) } : null;
        try { invalidateCache(); draw(); } catch (e) {}
    }
    function go(i) {
        idx = Math.max(0, Math.min(i, STEPS.length - 1)); ctx = {};
        const s = STEPS[idx]; if (s.init) s.init(ctx);
        setGhost(); render();
    }
    function tick() {
        if (!root || !root.isConnected) return stop();
        place();
        const s = STEPS[idx];
        const v3 = G.is3D(); if (v3 !== last3D) { last3D = v3; render(); }
        if (s.tick) s.tick(ctx);
        if (s.wait && !done[idx]) {
            let ok = false; try { ok = s.wait(ctx); } catch (e) {}
            if (ok) { done[idx] = true; render(); jump(); }   // l'étape se coche ; on avance quand on veut, avec ▶
        }
    }
    function start(id) {
        const T = TUTOS.find(t => t.id === id) || TUTOS[0]; STEPS = T.steps; done = []; if (T.setup) T.setup();
        if (root && root.isConnected) { go(0); return; }
        build(); go(0);
        clearInterval(timer); timer = setInterval(tick, 250);
        window.addEventListener('resize', place);
    }
    function stop() {
        clearInterval(timer); timer = null;
        [root, ring, tip].forEach(e => e && e.remove()); root = null;
        window.tutoGhost = null; try { draw(); } catch (e) {}
        window.removeEventListener('resize', place);
    }
    window.MomoTuto = { start, stop, list: TUTOS };
})();
