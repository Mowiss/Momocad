        const canvas = document.getElementById('cadCanvas');
        const ctx = canvas.getContext('2d');

        // --- ÉTATS ---
        let camera = { x: 0, y: 0, zoom: 1 };
        let isPanning = false, lastPanX = 0, lastPanY = 0;
        let mode = 'select-box';
        let isDrawing = false, startX = 0, startY = 0, currentX = 0, currentY = 0;
        let rawMouseX = 0, rawMouseY = 0; // position pointeur non contrainte (guide ortho)
        let shiftHeld = false; // état de la touche Shift (pour le guide d'alignement)
        let currentX_screen = 0, currentY_screen = 0;
        let typedInput = "";
        let rectDimStep = 0, rectWidthVal = 0; // saisie rectangle par dimensions (0=largeur, 1=hauteur)
        let dimStep = 0, dimP1 = null, dimP2 = null;
        // Chaîne de cotes : 'single' (simple), 'cumul' (cumulées depuis le 1er point), 'succ' (successives, bout à bout)
        let dimChain = 'single', dimChainInfo = null;
        let dimTextAligned = false;
        // Style des cotes linéaires (Paramètres > Cotes). Tailles en mm sur le papier.
        const DIM_STYLE_DEF = { term: 'tick', termSz: 3, line: 'solid', lineExt: 0, extOn: true, ext: 'solid', extMode: 'obj', extGap: 1, extLen: 8, extOver: 1.5, txtPos: 'on', txtGap: 1, txtBg: 'fill' };
        let dimStyle = Object.assign({}, DIM_STYLE_DEF);
        try { Object.assign(dimStyle, JSON.parse(localStorage.getItem('momocad-dim-style') || '{}')); } catch (e) {}
        function dimStyleSet(o) { dimStyle = Object.assign({}, DIM_STYLE_DEF, o || {}); try { localStorage.setItem('momocad-dim-style', JSON.stringify(dimStyle)); } catch (e) {} }
        const DIM_PXMM = 5 / 1.2;   // pixels écran par mm papier (repère des tailles de cote à l'écran)
        let dimMmW = null;          // à l'impression : unités monde par mm de papier (les cotes gardent leur vraie taille en mm sur la feuille)
        const DIM_DASH = { solid: [], dashed: [2.2, 1.3], dotted: [0.25, 0.9] };
        try { dimTextAligned = localStorage.getItem('momocad-dim-text') === 'aligned'; } catch (e) {}
        let detailStep = 0, detailTarget = null, detailLabelPos = null; // outil Détail (annotation fléchée)
        let currentPolygon = [], currentSnap = null;
        let arcStep = 0, arcCenter = null, arcP1 = null, arcRadius = 0, arcStartAngle = 0;
        // sens de l'arc : il suit la rotation réelle du curseur autour du centre (angle cumulé, jusqu'à un tour complet)
        let arcAcc = 0, arcLastA = null;
        function arcTrack(px, py) {
            const a = Math.atan2(py - arcCenter.y, px - arcCenter.x);
            if (arcLastA === null) { arcLastA = arcStartAngle; arcAcc = 0; }
            let d = a - arcLastA; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
            arcAcc = Math.max(-2 * Math.PI + 1e-4, Math.min(2 * Math.PI - 1e-4, arcAcc + d)); arcLastA = a; return arcAcc;
        }

        // Outil cotation angulaire — état
        let dimAngleStep = 0;   // 0=attente D1, 1=attente D2, 2=pose arc
        let dimAngleLine1 = null, dimAngleLine2 = null;
        let dimAngleIntersect = null; // intersection calculée des deux droites (prolongées)

        // Choisit le point sur la droite (prolongée) à distance arcR depuis origin,
        // dans le demi-espace le plus proche du clic
        function _closestPointOnLine(line, origin, arcR, clickPt) {
            const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
            const len = Math.hypot(dx, dy);
            if (len === 0) return { x: origin.x + arcR, y: origin.y };
            const ux = dx / len, uy = dy / len;
            // Deux directions possibles depuis l'intersection
            const cA = { x: origin.x + ux * arcR, y: origin.y + uy * arcR };
            const cB = { x: origin.x - ux * arcR, y: origin.y - uy * arcR };
            const dA = Math.hypot(cA.x - clickPt.x, cA.y - clickPt.y);
            const dB = Math.hypot(cB.x - clickPt.x, cB.y - clickPt.y);
            return dA < dB ? cA : cB;
        }

        // Calcule l'intersection de deux droites prolongées à l'infini
        function getLineIntersectionInfinite(l1, l2) {
            const dx1 = l1.x2 - l1.x1, dy1 = l1.y2 - l1.y1;
            const dx2 = l2.x2 - l2.x1, dy2 = l2.y2 - l2.y1;
            const det = dx1 * dy2 - dy1 * dx2;
            if (Math.abs(det) < 1e-10) return null; // parallèles
            const t = ((l2.x1 - l1.x1) * dy2 - (l2.y1 - l1.y1) * dx2) / det;
            return { x: l1.x1 + t * dx1, y: l1.y1 + t * dy1 };
        }

        let showGrid = true;
        let previewPin = null;   // aperçu : position figée de la page (coordonnées écran), null = suit la souris
        // Taille d'un carreau de grille en mm (réglée en cm en bas à droite, mémorisée sur ce poste). Défaut : 1 cm.
        let gridMm = 10;
        try { const g = parseFloat(localStorage.getItem('momocad-grid-mm')); if (g > 0) gridMm = g; } catch (e) {}
        let orthoMode = false; // mode orthogonal : ne dessine que H/V

