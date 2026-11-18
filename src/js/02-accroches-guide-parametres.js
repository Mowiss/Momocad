        // =====================================================================
        // SNAP — correctifs
        // La distance de snap est désormais toujours comparée en pixels écran,
        // et la conversion monde→écran est faite une seule fois dans findSnap.
        // Les points en doublon sont dédupliqués dans getSnapPoints.
        // =====================================================================
        const SNAP_DIST_PX = 14; // pixels écran, constant quelle que soit le zoom
        let selectedShapes = [], moveBasePoint = null, isMovingObjects = false;
        let rotateCenter = null, rotateStartAngle = 0, isRotatingObjects = false;
        let scaleCenter = null, scaleRefDist = 0, isScalingObjects = false; // outil mise à l'échelle
        
        let clipboard = [];
        let clipboardLayers = [];   // calques des objets copiés (le collage les garde, même dans un autre plan)
        // calque d'un objet collé : le même s'il existe, sinon celui du même nom, sinon on le recrée avec son style
        function pasteLayerId(id) {
            id = id || 'layer-0'; if (layers.some(l => l.id === id)) return id;
            const src = clipboardLayers.find(l => l.id === id); if (!src) return activeLayerId;
            const same = layers.find(l => l.name === src.name); if (same) return same.id;
            const nl = Object.assign({}, src, { id: generateId(), visible: true }); layers.push(nl); updateLayerUI(); return nl.id;
        }
        let clipboardBasePoint = null;
        let pasteOffset = 0;
        let offsetTarget = null, offsetPreviewShape = null;
        const GRID_SIZE = 50;
        
        let unitsPerSquare = 10, currentUnit = 'mm';
        
        let shapes = [], dimensionTextsToDraw = [], screenTextsToDraw = [], pendingTextPos = null;
        let printOrientation = 'landscape';
        let cartoucheData = { logo: null, planName: '', clientName: '', draftsmanName: '', indice: '' };
        function cartoucheIndice(v) { v = (v === undefined ? cartoucheData.indice : v) || ''; return String(v).trim() ? 'Ind. ' + String(v).trim() : ''; }
        try { Object.assign(cartoucheData, JSON.parse(localStorage.getItem('momocad-cartouche') || '{}')); } catch (e) {}
        // Formats de feuille (mm, portrait) et réglages d'impression
        const PAPER_SIZES = { A5: [148, 210], A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
        // Cartouche compact (mm) : case logo carrée à gauche + 4 lignes de texte
        // min / max d'un tableau sans « ...spread » (qui dépasse la pile au-delà de ~100 000 valeurs)
        function arrMin(a) { let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; }
        function arrMax(a) { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
        const CART_W = 70, CART_H = 20, CART_LOGO = 20, CART_FONT = 6;
        // Cartouche « A4 grands plans » (210 × 297 mm) : logo, chantier, titre, maîtres d'ouvrage / d'œuvre, infos, tableau des indices.
        // Utilisé dès que la feuille fait au moins A2 ; en dessous, le cartouche minimaliste 70 × 20 mm.
        const CART_A4_W = 210, CART_A4_H = 297, CART_REV_ROWS = 14;
        // cartouche A4 : il occupe le volet de devant du plan plié (210 × 297 au coin bas-droite de la feuille), moins la marge → son bord gauche et son bord haut tombent sur les plis
        function cartDims(pw, ph, m, type) { const mm = Math.max(0, Math.min(40, +m || 0)); return ((type || cartoucheData.type) === 'a4' && Math.min(pw, ph) >= 419) ? { w: CART_A4_W - mm, h: CART_A4_H - mm, a4: true } : { w: CART_W, h: CART_H, a4: false }; }
        function cartInfo(scale, format, src) {
            const d = src || cartoucheData;
            return { logo: d.logoImg !== undefined ? d.logoImg : getLogoImg(), site: d.site || '', title: d.planName || '', moa: d.moa || d.clientName || '', moe: d.moe || '',
                     cond: d.conducteur || '', drafts: d.draftsmanName || '', indice: (d.indice || '').trim(), phase: d.phase || '', revs: d.revisions || [], scale: scale || '', format: format || '',
                     date: new Date().toLocaleDateString('fr-FR') };
        }
        function drawCartA4(c, X, Y, k0, D, cw, ch) { const sA = (cw || CART_A4_W) / CART_A4_W, k = k0 * sA, HH = (ch || CART_A4_H) / sA;   // mis à la taille du volet (largeur), le tableau des indices prend la hauteur restante
            const pt = (v) => v * 0.3528 * k, F = (sz, b) => (b ? 'bold ' : '') + pt(sz) + 'px Helvetica, Arial, sans-serif';
            const R = (x, y, w, h, r) => { c.beginPath(); c.moveTo(X + (x + r) * k, Y + y * k); c.arcTo(X + (x + w) * k, Y + y * k, X + (x + w) * k, Y + (y + h) * k, r * k); c.arcTo(X + (x + w) * k, Y + (y + h) * k, X + x * k, Y + (y + h) * k, r * k); c.arcTo(X + x * k, Y + (y + h) * k, X + x * k, Y + y * k, r * k); c.arcTo(X + x * k, Y + y * k, X + (x + w) * k, Y + y * k, r * k); c.closePath(); c.stroke(); };
            const T = (t, x, y, sz, o) => { o = o || {}; c.font = F(sz, o.b); c.textAlign = o.al || 'left'; c.fillText(String(t), X + x * k, Y + y * k, o.mw ? o.mw * k : undefined); if (o.u) { const w = c.measureText(String(t)).width, x0 = o.al === 'center' ? X + x * k - w / 2 : X + x * k; c.fillRect(x0, Y + (y + 0.6) * k, w, Math.max(0.6, 0.18 * k)); } };
            const lines = (t) => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
            c.save(); c.setLineDash([]); c.fillStyle = '#fff'; c.fillRect(X, Y, CART_A4_W * k, HH * k);
            c.strokeStyle = '#000'; c.fillStyle = '#000'; c.textBaseline = 'alphabetic';
            c.lineWidth = Math.max(1, 0.35 * k); c.strokeRect(X, Y, CART_A4_W * k, HH * k);
            // logo (grand, en haut à gauche)
            if (D.logo && D.logo.naturalWidth) { const iw = D.logo.naturalWidth, ih = D.logo.naturalHeight, r = Math.min(90 * k / iw, 74 * k / ih), w = iw * r, h = ih * r; c.drawImage(D.logo, X + (3 + 45) * k - w / 2, Y + (4 + 37) * k - h / 2, w, h); }
            else { c.fillStyle = '#9ca3af'; T('LOGO', 48, 42, 14, { al: 'center' }); c.fillStyle = '#000'; }
            c.lineWidth = Math.max(1, 0.3 * k);
            // chantier / adresse
            R(98, 5, 107, 72, 4); const sl = lines(D.site);
            sl.forEach((t, i) => T(t, 151.5, 41 - (sl.length - 1) * 5.5 + i * 11 - (i === 0 ? 0 : 0), i === 0 ? 15 : (i === sl.length - 1 && sl.length > 2 ? 14 : 11), { al: 'center', mw: 101 }));
            if (!sl.length) { c.fillStyle = '#9ca3af'; T('Chantier — adresse', 151.5, 43, 11, { al: 'center' }); c.fillStyle = '#000'; }
            // titre du plan
            R(5, 82, 200, 36, 4); const tl = lines(D.title);
            tl.forEach((t, i) => T(t, 105, 102 - (tl.length - 1) * 4.5 + i * 9, 15, { al: 'center', mw: 194 }));
            if (!tl.length) { c.fillStyle = '#9ca3af'; T('Titre du plan', 105, 103, 13, { al: 'center' }); c.fillStyle = '#000'; }
            // maîtres d'ouvrage / d'œuvre
            T("Maître d'Ouvrage :", 7, 128, 9, { b: true, u: true }); T("Maître d'Œuvre :", 107, 128, 9, { b: true, u: true });
            lines(D.moa).slice(0, 6).forEach((t, i) => T(t, 7, 135 + i * 5.4, 9, { mw: 96 }));
            lines(D.moe).slice(0, 6).forEach((t, i) => T(t, 107, 135 + i * 5.4, 9, { mw: 96 }));
            // informations
            R(5, 170, 200, 15, 3);
            const info = [['Conducteur de travaux :', D.cond, 7, 176], ['Date :', D.date, 115, 176], ['Échelle :', D.scale, 160, 176], ['Dessinateur :', D.drafts, 7, 182], ['Indice :', D.indice, 115, 182], ['Phase :', D.phase, 160, 182]];
            info.forEach(([l, v, x, y]) => { T(l, x, y, 7, { b: true, u: true }); c.font = F(7, true); const w = c.measureText(l).width / k; T(v || '', x + w + 1.5, y, 7, { mw: (x === 7 ? 104 : x === 115 ? 44 : 44) - w - 1.5 }); });
            // tableau des indices
            const t0 = 188, hh = 6, rh = (HH - 4 - t0 - hh) / (CART_REV_ROWS + 1), cx1 = 5 + 15, cx2 = cx1 + 22;
            R(5, t0, 200, HH - 4 - t0, 3);
            c.beginPath(); c.moveTo(X + 5 * k, Y + (t0 + hh) * k); c.lineTo(X + 205 * k, Y + (t0 + hh) * k);
            for (let i = 1; i <= CART_REV_ROWS; i++) { const y = t0 + hh + rh * i; c.moveTo(X + 5 * k, Y + y * k); c.lineTo(X + 205 * k, Y + y * k); }
            c.moveTo(X + cx1 * k, Y + t0 * k); c.lineTo(X + cx1 * k, Y + (t0 + hh + rh * CART_REV_ROWS) * k);
            c.moveTo(X + cx2 * k, Y + t0 * k); c.lineTo(X + cx2 * k, Y + (HH - 4) * k);
            c.lineWidth = Math.max(0.6, 0.18 * k); c.stroke();
            T('Indice', 12.5, t0 + 4.3, 7, { b: true, al: 'center' }); T('Date', (cx1 + cx2) / 2, t0 + 4.3, 7, { b: true, al: 'center' }); T('Modifications', (cx2 + 205) / 2, t0 + 4.3, 7, { b: true, al: 'center' });
            for (let i = 0; i < CART_REV_ROWS; i++) {
                const r = D.revs[i] || {}, y = t0 + hh + rh * i + rh * 0.7;
                T(r.ind || String.fromCharCode(65 + i), 12.5, y, 7, { al: 'center' }); if (r.date) T(r.date, (cx1 + cx2) / 2, y, 6.5, { al: 'center', mw: 21 }); if (r.txt) T(r.txt, cx2 + 1.5, y, 6.5, { mw: 205 - cx2 - 3 });
            }
            if (D.phase) T(String(D.phase).toUpperCase(), (5 + cx2) / 2, t0 + hh + rh * CART_REV_ROWS + rh * 0.7, 6.5, { al: 'center', mw: cx2 - 6 });
            c.restore();
        }
        const UNIT_MM_INIT = { mm: 1, cm: 1, m: 1 };
        let printSettings = { paper: 'A4', cartouche: true, output: 'pdf', unit: 'mm', decimals: 0 };
        try { Object.assign(printSettings, JSON.parse(localStorage.getItem('momocad-print') || '{}')); } catch (e) {}
        // « Unité du dessin » comme dans AutoCAD : sert à l'affichage, à la saisie ET aux DXF. Une fois : passage au mètre (TP, topo, Lambert).
        try { if (!localStorage.getItem('momocad-unit-v2')) { printSettings.unit = 'm'; if (!(printSettings.decimals >= 2)) printSettings.decimals = 2; localStorage.setItem('momocad-unit-v2', '1'); localStorage.setItem('momocad-print', JSON.stringify(printSettings)); } } catch (e) {}
        if (!UNIT_MM_INIT[printSettings.unit]) printSettings.unit = 'm';   // unité du dessin : m par défaut, cm ou mm au choix (⛯ › Plan)
        if (printSettings.orientation === 'portrait' || printSettings.orientation === 'landscape') printOrientation = printSettings.orientation;
        // Unité d'affichage (⛯) : le dessin reste en mm en interne (10 mm par carré de grille),
        // seule l'unité de lecture et de saisie change (coordonnées, cotes, longueurs tapées).
        const UNIT_MM = { mm: 1, cm: 10, m: 1000 };
        // longueurs des menus dans l'unité du dessin (m, cm ou mm) ; les altitudes restent en m NGF
        const LUN = () => (typeof currentUnit === 'string' && UNIT_MM[currentUnit]) ? currentUnit : 'm';
        const lenF = () => UNIT_MM[LUN()];
        const lenDec = () => ({ m: 2, cm: 1, mm: 0 })[LUN()];
        function lenTxt(mm, d) { return String(+((+mm || 0) / lenF()).toFixed(d === undefined ? lenDec() + 1 : d)).replace('.', ','); }
        function applyUnitSettings() {
            currentUnit = UNIT_MM[printSettings.unit] ? printSettings.unit : 'mm';
            unitsPerSquare = 10 / UNIT_MM[currentUnit];
            const d = parseInt(printSettings.decimals, 10);
            printSettings.decimals = (d >= 0 && d <= 4) ? d : 0;
        }
        applyUnitSettings();
        // Longueur dans l'unité choisie, avec le nombre de décimales choisi (virgule française)
        function fmtNum(v) {
            const d = printSettings.decimals;
            let r = Number(v.toFixed(d)); if (Object.is(r, -0)) r = 0;
            return r.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
        }
        function fmtLen(v) { return fmtNum(v) + ' ' + currentUnit; }
        if (!PAPER_SIZES[printSettings.paper]) printSettings.paper = 'A4';
        function pageDims() {
            const sz = PAPER_SIZES[printSettings.paper] || PAPER_SIZES.A4, land = printOrientation === 'landscape';
            const pageW = land ? sz[1] : sz[0], pageH = land ? sz[0] : sz[1], margin = 5;
            return { pageW, pageH, margin, drawW: pageW - 2 * margin, drawH: pageH - 2 * margin, land };
        }
        // Échelles d'impression, du plus AGRANDISSANT au plus RÉDUISANT.
        // factor = facteur d'agrandissement réel (zoom relatif au 1:1).
        //   2:1 -> ×2 (pièces minuscules) ... 1:500 -> ×0.002 (grands ouvrages)
        const PRINT_SCALES = [
            { label: '5:1',   factor: 5    },
            { label: '2:1',   factor: 2    },
            { label: '1:1',   factor: 1    },
            { label: '1:2',   factor: 1/2  },
            { label: '1:5',   factor: 1/5  },
            { label: '1:10',  factor: 1/10 },
            { label: '1:25',  factor: 1/25 },
            { label: '1:50',  factor: 1/50 },
            { label: '1:100', factor: 1/100},
            { label: '1:150', factor: 1/150},
            { label: '1:200', factor: 1/200},
            { label: '1:500', factor: 1/500},
        ];
        let printScaleIndex = PRINT_SCALES.findIndex(s => s.label === '1:1');
        let currentPrintScale = PRINT_SCALES[printScaleIndex].label; // libellé affiché (ex. '2:1')

        let layers = [{ id: 'layer-0', name: 'Tracé', visible: true, color: '#ffffff', dash: 'solid', width: 0.5 }, { id: 'layer-1', name: 'Construction', visible: true, color: '#808080', dash: 'dashed', width: 0.5 }, { id: 'layer-2', name: 'Cotation', visible: true, color: '#ff7f00', dash: 'solid', width: 1 }];
        const INITIAL_LAYERS = JSON.parse(JSON.stringify(layers));
        // anciens noms « 0 - Tracé », « 1 - Construction », « 2 - Cotation » → sans numéro
        function stripLayerNums(list) { (list || []).forEach(l => { const m = /^\s*[0-2]\s*-\s*(Tracé|Construction|Cotation)\s*$/.exec(l.name || ''); if (m) l.name = m[1]; }); }   // calques d'un plan vierge (ouverture d'un DXF)
        const DIM_LAYER_ID = 'layer-2'; // calque Cotation (orange) : cotes, texte, détail
        const TEXT_LAYER_ID = 'layer-2'; // texte + détail = même calque que cotation
        // --- Édition de texte INLINE (WYSIWYG sur le canvas) ---
        let inlineEdit = null; // { kind:'text'|'detail', wx, wy, target, detailTarget }
        let inlineEditReady = false; // true une fois le focus posé (anti-blur immédiat)
        const TEXT_WORLD_SIZE = 20; // hauteur de police en unités monde (cohérent avec s.size)
        function startInlineEdit(opts) {
            // opts: { kind, wx, wy, target?, detailTarget? }
            inlineEdit = opts;
            inlineEditReady = false; // évite un blur immédiat dû au cycle de clic en cours
            const ta = document.getElementById('inline-editor');
            const col = effectiveColor({ layerId: TEXT_LAYER_ID }, false);
            const fontPx = annotTextPx(TEXT_LAYER_ID, 14, 1, camera.zoom); // même taille que le rendu final
            const sp = worldToScreen(opts.wx, opts.wy);
            ta.style.left = sp.x + 'px';
            ta.style.top = (opts.kind === 'detail' ? sp.y : sp.y - fontPx) + 'px';
            ta.style.fontSize = fontPx + 'px';
            ta.style.color = col;
            ta.style.minWidth = '40px';
            ta.style.width = 'auto';
            ta.value = opts.target ? (opts.target.content || '') : '';
            ta.classList.remove('hidden');
            autoSizeInline();
            // Focus différé : laisse le cycle mousedown/mouseup/click se terminer
            // avant de donner le focus, sinon le mouseup provoque un blur immédiat.
            setTimeout(() => { ta.focus(); inlineEditReady = true; }, 50);
            draw();
        }
        function autoSizeInline() {
            const ta = document.getElementById('inline-editor');
            ta.style.height = 'auto'; ta.style.width = 'auto';
            // largeur = plus longue ligne ; hauteur = nb lignes
            ta.style.height = ta.scrollHeight + 'px';
            ta.style.width = Math.max(40, ta.scrollWidth) + 'px';
        }
        function commitInlineEdit() {
            const ta = document.getElementById('inline-editor');
            if (!inlineEdit) { ta.classList.add('hidden'); return; }
            const txt = ta.value.replace(/\s+$/,''); // retire espaces/sauts finaux
            const e = inlineEdit;
            if (txt) {
                if (e.kind === 'text') {
                    if (e.target) { e.target.content = txt; }
                    else shapes.push({ type:'text', layerId: TEXT_LAYER_ID, x: e.wx, y: e.wy, content: txt, size: TEXT_WORLD_SIZE });
                } else if (e.kind === 'detail') {
                    if (e.target) { e.target.content = txt; }
                    else shapes.push({ type:'detail', layerId: TEXT_LAYER_ID, tx: e.detailTarget.x, ty: e.detailTarget.y, lx: e.wx, ly: e.wy, content: txt, size: TEXT_WORLD_SIZE });
                }
                saveState();
            }
            ta.classList.add('hidden'); ta.value = '';
            inlineEdit = null;
            detailStep = 0; detailTarget = null; detailLabelPos = null; isDrawing = false;
            draw();
        }
        function cancelInlineEdit() {
            const ta = document.getElementById('inline-editor');
            ta.classList.add('hidden'); ta.value = '';
            inlineEdit = null;
            detailStep = 0; detailTarget = null; detailLabelPos = null; isDrawing = false;
            draw();
        }
        let activeLayerId = 'layer-0';
        const SNAP_DEFAULTS = { endpoint: true, midpoint: true, center: true, intersection: true, perpendicular: true, tangent: true, nearest: false, track: false, grid: false };
        let snapSettings = Object.assign({}, SNAP_DEFAULTS);
        try { Object.assign(snapSettings, JSON.parse(localStorage.getItem('momocad-snap') || '{}')); } catch (e) {}
        // Ortho projeté : points acquis (violets) et lignes de projection actives
        let trackPts = [], trackLines = [], trackHover = null;
        let cachedSnapPoints = null, cachedSnapXs = null, ptLabelGrid = new Set();
        let renderEpoch = 0, drawCache = { key: null, cv: null, shapesRef: null, dims: [], texts: [], selEpoch: 0, selRef: null, selLen: 0 };
        // une grande image (fond de carte 4 096 px) vue en petit : on la dessine depuis une copie réduite (½, ¼…) au lieu de la réduire à chaque image
        const MIP = new WeakMap();
        function imgMip(img, px) { const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height; if (!W || !(px > 0) || px * 1.5 >= W) return img;
            let L = MIP.get(img); if (!L) { L = []; MIP.set(img, L); } let src = img, w = W, h = H, i = 0;
            while (w / 2 >= px * 1.2 && w > 64) { w = Math.round(w / 2); h = Math.round(h / 2); let c = L[i]; if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h); L[i] = c; } src = c; i++; }
            return src; }
        function invalidateCache() { cachedSnapPoints = null; tinCache = null; renderEpoch++; try { paySync(); } catch (e) {} }

        // --- UI MODALES ---
        function openTextModal(wx, wy, sx, sy) { pendingTextPos = {wx, wy}; const m = document.getElementById('text-input-modal'); m.style.left = Math.min(sx + 10, window.innerWidth - 280) + 'px'; m.style.top = Math.min(sy + 10, window.innerHeight - 150) + 'px'; m.classList.remove('hidden'); document.getElementById('text-content').value = ""; document.getElementById('text-content').focus(); }
        function applyText() { const c = document.getElementById('text-content').value; if (c.trim() && pendingTextPos) { shapes.push({ type: 'text', layerId: TEXT_LAYER_ID, x: pendingTextPos.wx, y: pendingTextPos.wy, content: c, size: 20 }); saveState(); draw(); } closeTextModal(); }
        function closeTextModal() { document.getElementById('text-input-modal').classList.add('hidden'); pendingTextPos = null; }
        // --- Outil Détail : annotation encadrée reliée par une flèche ---
        function openDetailModal(sx, sy) {
            const m = document.getElementById('detail-input-modal');
            m.style.left = Math.min(sx + 10, window.innerWidth - 300) + 'px';
            m.style.top = Math.min(sy + 10, window.innerHeight - 160) + 'px';
            m.classList.remove('hidden');
            const ta = document.getElementById('detail-content'); ta.value = ""; ta.focus();
        }
        function closeDetailModal() {
            document.getElementById('detail-input-modal').classList.add('hidden');
            detailStep = 0; detailTarget = null; detailLabelPos = null; isDrawing = false; draw();
        }
        function applyDetail() {
            const txt = document.getElementById('detail-content').value.trim();
            if (txt && detailTarget && detailLabelPos) {
                shapes.push({ type:'detail', layerId: TEXT_LAYER_ID,
                    tx: detailTarget.x, ty: detailTarget.y,      // point désigné
                    lx: detailLabelPos.x, ly: detailLabelPos.y,  // ancre de l'étiquette
                    content: txt, size: 20 });
                saveState();
            }
            document.getElementById('detail-input-modal').classList.add('hidden');
            detailStep = 0; detailTarget = null; detailLabelPos = null; isDrawing = false; draw();
        }
        function closeLayerModal() { document.getElementById('layer-modal').classList.add('hidden'); }
        function closeCartoucheModal() { document.getElementById('cartouche-modal').classList.add('hidden'); }
        function closeSnapModal() { document.getElementById('snap-modal').classList.add('hidden'); }
        function closeHelpModal() { document.getElementById('help-modal').classList.add('hidden'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
        function openLayerModal() { closeSnapModal(); document.getElementById('layer-modal').classList.remove('hidden'); updateLayerUI(); }
        function openSnapModal() { closeLayerModal(); const m = document.getElementById('snap-modal'); m.querySelectorAll('.sn-ic[data-ic]').forEach(e => { if (e.firstChild) return; const b = document.getElementById('snapbtn-' + e.dataset.ic), sv = b && b.querySelector('svg'); if (sv) { const c = sv.cloneNode(true); c.setAttribute('width', 18); c.setAttribute('height', 18); e.appendChild(c); } }); m.classList.remove('hidden'); }
        // tutos de Momo : fichier momocad-tuto.js placé à côté de MomoCAD, chargé à l'ouverture de la page « Apprendre » du guide
        function loadTuto(cb) {
            if (window.MomoTuto) { cb(true); return; }
            const sc = document.createElement('script'); sc.src = 'momocad-tuto.js?v=' + Date.now();
            sc.onload = () => cb(!!window.MomoTuto); sc.onerror = () => { sc.remove(); cb(false); };
            document.head.appendChild(sc);
        }
        let momoOn = true, momoMode = 'tuto';   // un seul Momo : mode « tuto » (toque) ou « ia » (casque de chantier)
        try { localStorage.removeItem('momocad-momo-on'); } catch (e) {}   // Momo est toujours là : plus d'interrupteur
        function hgLearnRender() {
            const b = document.getElementById('hg-momo-btn'); if (b) { b.textContent = momoOn ? '✨ Désactiver Momo' : '✨ Activer Momo'; b.classList.toggle('on', momoOn); b.title = momoOn ? 'Momo est dans le coin en bas à gauche du plan : clique sur son chapeau' : 'Momo te propose des tutos ou répond à tes questions'; }
            const box = document.getElementById('hg-tutos'); if (box) box.innerHTML = '';
        }
        // Momo vit dans momocad-tuto.js : s'il est trop ancien (pas encore mis à jour sur le site), on le dit clairement
        function momoFresh() { if (window.MomoTuto && window.MomoTuto.version >= 3) return true; alert('Momo a besoin de la nouvelle version du fichier « momocad-tuto.js ».\nMets-le à jour sur le site, à côté de index.html, puis recharge la page (Ctrl+Maj+R).'); return false; }
        function setMomoOn(v) {
            momoOn = !!v; try { localStorage.setItem('momocad-momo-on', momoOn ? '1' : '0'); } catch (e) {}
            momoMode = 'tuto'; mcOpen = false;
            if (momoOn) loadTuto((ok) => { if (!ok) { alert('Momo n\'est pas disponible pour le moment (connexion ?).'); return; } if (!momoFresh()) return; closeHelpModal(); window.MomoTuto.enable(); window.MomoTuto.home(); });
            else { if (window.MomoTuto && window.MomoTuto.disable) window.MomoTuto.disable(); helpChapter('learn'); }
            hgLearnRender(); mcRefresh();
        }
        // passer de Momo prof à Momo IA (casque), et revenir
        function momoGoIA() { momoMode = 'ia'; if (window.MomoTuto) MomoTuto.setVisible(false); mcOpen = true; mcRefresh(); momoTransform(document.getElementById('mc-momo')); setTimeout(() => { const q = document.getElementById('mc-q'); if (q && iaCfg.key) q.focus(); }, 40); }
        function momoGoHome() { momoMode = 'tuto'; mcOpen = false; mcRefresh(); if (window.MomoTuto) { MomoTuto.home(); momoTransform(document.getElementById('mt-dock')); } }
        // changement de chapeau : Momo tourne sur lui-même dans une pluie de paillettes (transformation « magical girl »)
        function momoTransform(el) {
            if (!el) return; try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
            const svg = el.querySelector('svg'); if (svg) { svg.classList.remove('mo-spin'); void svg.getBoundingClientRect(); svg.classList.add('mo-spin'); }
            const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.32, box = document.createElement('div');
            box.className = 'mo-sparks'; document.body.appendChild(box);
            const COL = ['#f9a8d4', '#fde047', '#a5f3fc', '#c4b5fd', '#fff', '#f472b6'];
            for (let i = 0; i < 22; i++) {
                const a = (i / 22) * Math.PI * 2 + Math.random() * 0.4, d = 34 + Math.random() * 46, sp = document.createElement('span');
                sp.textContent = Math.random() < 0.6 ? '✦' : '✧';
                sp.style.cssText = `left:${cx}px;top:${cy}px;color:${COL[i % COL.length]};font-size:${9 + Math.random() * 11}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 18}px;animation-delay:${Math.random() * 0.18}s`;
                box.appendChild(sp);
            }
            setTimeout(() => box.remove(), 1300);
        }
        function momoUseTuto() { momoMode = 'tuto'; mcOpen = false; mcRefresh(); }
        function startTuto(id) { loadTuto((ok) => { if (!ok) { alert('Les tutos ne sont pas disponibles pour le moment.'); return; } if (!momoFresh()) return; closeHelpModal(); momoOn = true; try { localStorage.setItem('momocad-momo-on', '1'); } catch (e) {} window.MomoTuto.start(id); }); }
        // ---- Impression du guide : couverture, sommaire, chapitres (logo en en-tête de chaque page) ----
        function printGuide() {
            try { hgFillBtns(); } catch (e) {}
            const go = () => {
                const lsvg = document.querySelector('#app-logo svg'); let logo = 'MomoCAD';
                if (lsvg) { const c = lsvg.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.removeAttribute('height'); const vb = (c.getAttribute('viewBox') || '0 0 6121 847').split(/\s+/).map(Number); c.setAttribute('width', vb[2]); c.setAttribute('height', vb[3]);
                    logo = '<img alt="MomoCAD" src="data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(c.outerHTML))) + '">'; }
                const momo = (document.querySelector('#help-modal .hg-momo') || {}).outerHTML || '';
                const tabs = [...document.querySelectorAll('#help-modal .hg-tab')].filter(b => b.dataset.ch !== 'learn').map(b => ({ id: b.dataset.ch, icon: (b.querySelector('.hg-ico') || {}).textContent || '', name: b.textContent.replace((b.querySelector('.hg-ico') || {}).textContent || '', '').trim() }));
                const E = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                const chapters = tabs.map((t, i) => {
                    const sec = document.querySelector('#help-modal .hg-ch[data-ch="' + t.id + '"]'); if (!sec) return null;
                    const c = sec.cloneNode(true); c.querySelectorAll('.hg-title').forEach(x => x.remove());
                    if (t.id === 'learn') { c.querySelectorAll('button').forEach(x => x.remove()); const L = window.MomoTuto ? window.MomoTuto.list : [];
                        const box = c.querySelector('#hg-tutos'); if (box) box.innerHTML = L.length ? '<ul class="hg-list">' + L.map((u, k) => '<li><b class="text-white">' + (k + 1) + '. ' + E(u.title) + ' <span class="hg-key">' + E(u.level || '') + '</span></b><p>' + E(u.desc) + ' · ' + u.steps.length + ' étapes</p></li>').join('') + '</ul>' : '<p>Les tutos se lancent depuis l\'onglet « Apprendre avec Momo » du guide, dans MomoCAD.</p>'; }
                    const subs = [...c.querySelectorAll('.hg-sub')].map(h => h.textContent.trim());
                    c.querySelectorAll('.hg-sub').forEach((h, k) => { h.id = 'c' + (i + 1) + 's' + (k + 1); });
                    return { n: i + 1, id: t.id, icon: t.icon, name: t.name, subs, html: c.innerHTML };
                }).filter(Boolean);
                const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                const css = `@page { size: A4; margin: 14mm 15mm 16mm; }
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
                    .cover { height: 265mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; position: relative; }
                    .cover .logo img { height: 22mm; width: auto; }
                    .cover h1 { font-size: 30pt; margin: 14mm 0 3mm; color: #111827; letter-spacing: -.5px; }
                    .cover .sub { font-size: 13pt; color: #4b5563; max-width: 140mm; }
                    .cover .mascot svg { width: 46mm; height: 56mm; margin: 14mm 0 6mm; }
                    .cover .band { position: absolute; left: 0; right: 0; bottom: 0; border-top: 3px solid #3d7fb0; padding-top: 4mm; color: #6b7280; font-size: 10pt; display: flex; justify-content: space-between; }
                    table.pg { width: 100%; border-collapse: collapse; } table.pg > thead td { padding: 0 0 5mm; }
                    .hd { display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #3d7fb0; padding-bottom: 2.5mm; }
                    .hd img { height: 5.5mm; width: auto; } .hd span { color: #6b7280; font-size: 9pt; }
                    .toc { page-break-after: always; } .toc h2 { font-size: 20pt; margin: 0 0 6mm; }
                    .toc ol { list-style: none; padding: 0; margin: 0; column-count: 2; column-gap: 10mm; }
                    .toc > ol > li { break-inside: avoid; margin-bottom: 5mm; }
                    .toc a { color: #111827; text-decoration: none; } .toc .ch { font-weight: 700; font-size: 11.5pt; }
                    .toc .ch b { display: inline-block; width: 7mm; color: #3d7fb0; }
                    .toc ul { list-style: none; padding: 1mm 0 0 7mm; margin: 0; color: #4b5563; font-size: 9.5pt; }
                    .chap { page-break-before: always; } .chap:first-of-type { page-break-before: auto; }
                    .chap h2 { font-size: 19pt; margin: 0 0 2mm; display: flex; gap: 3mm; align-items: baseline; } .chap h2 .num { color: #3d7fb0; }
                    .hg-intro { color: #4b5563; font-size: 11pt; margin: 0 0 4mm; }
                    .hg-sub { font-size: 9.5pt; font-weight: 800; color: #3d7fb0; text-transform: uppercase; letter-spacing: .07em; margin: 7mm 0 2.5mm; break-after: avoid; }
                    .hg-list { list-style: none; padding: 0; margin: 0; }
                    .hg-list > li { border: 1px solid #e5e7eb; border-radius: 3mm; padding: 3mm 4mm; margin-bottom: 2.5mm; break-inside: avoid; background: #fff; }
                    .hg-list > li > b:first-child { display: flex; gap: 2.5mm; align-items: center; font-size: 11pt; color: #111827; margin-bottom: 1mm; }
                    .hg-list p { margin: 1mm 0; }
                    .hg-key, kbd { font: 600 8.5pt ui-monospace, Consolas, monospace; color: #1f2937; background: #f3f4f6; border: 1px solid #d1d5db; border-bottom-width: 2px; border-radius: 1.2mm; padding: 0 1.6mm; }
                    code { font: 8.5pt ui-monospace, Consolas, monospace; background: #f3f4f6; padding: 0 1mm; border-radius: 1mm; }
                    .hg-steps { list-style: none; counter-reset: st; padding: 0; margin: 1.5mm 0; } .hg-steps > li { counter-increment: st; position: relative; padding-left: 7mm; margin: 1.2mm 0; }
                    .hg-steps > li::before { content: counter(st); position: absolute; left: 0; top: .3mm; width: 4.8mm; height: 4.8mm; border-radius: 50%; background: #2563eb; color: #fff; font: 700 8pt sans-serif; display: flex; align-items: center; justify-content: center; }
                    .hg-dots { list-style: none; padding: 0; margin: 1.5mm 0; } .hg-dots > li { position: relative; padding-left: 4.5mm; margin: .8mm 0; } .hg-dots > li::before { content: ''; position: absolute; left: .8mm; top: 2.2mm; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #3d7fb0; }
                    .hg-tip, .hg-note { padding: 2mm 3mm; border-radius: 1.5mm; margin-top: 2mm; font-size: 9.8pt; }
                    .hg-tip { background: #fffbeb; border-left: 1mm solid #f59e0b; color: #78350f; } .hg-note { background: #eff6ff; border-left: 1mm solid #3b82f6; color: #1e3a8a; }
                    .hg-learn-head { display: flex; gap: 5mm; align-items: center; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 3mm; padding: 4mm; margin-bottom: 4mm; } .hg-learn-head svg { width: 20mm; height: 24mm; flex-shrink: 0; }
                    .text-white { color: #111827; } .text-gray-400, .text-gray-500 { color: #6b7280; }
                    .hg-why { color: #111827; } .hg-ex { background: #f0fdf4; border-left: 1mm solid #22c55e; color: #14532d; padding: 2mm 3mm; border-radius: 1.5mm; margin-top: 2mm; font-size: 9.8pt; }
                    .hg-btn { display: inline-flex; align-items: center; justify-content: center; width: 6.5mm; height: 6.5mm; border-radius: 1.4mm; background: #1f2937; border: 1px solid #374151; vertical-align: middle; margin: 0 1mm; }
                    .hg-btn svg { width: 4mm; height: 4mm; }
                    .hg-fig { margin: 2.5mm 0 1mm; padding: 2.5mm; background: #0f172a; border-radius: 2.5mm; text-align: center; break-inside: avoid; }
                    .hg-fig svg { max-width: 110mm !important; } .hg-fig figcaption { color: #cbd5e1; font-size: 8.5pt; font-style: italic; margin-top: 1mm; }
                    .hg-palshot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm 3mm; padding: 3mm; background: #111827; border-radius: 2.5mm; max-width: 140mm; break-inside: avoid; }
                    .hg-ps { display: flex; align-items: center; gap: 2mm; font-size: 8.5pt; color: #e5e7eb; } .hg-cap { color: #6b7280; font-size: 8.5pt; font-style: italic; margin: 1mm 0 3mm; }
                    table:not(.pg) { border-collapse: collapse; width: 100%; font-size: 9.5pt; } table:not(.pg) td, table:not(.pg) th { border-top: 1px solid #e5e7eb; padding: 1mm 2mm; text-align: left; }
                    .text-amber-300 { color: #b45309; font-family: ui-monospace, Consolas, monospace; font-weight: 700; }
                    .ft { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; color: #9ca3af; font-size: 8pt; }`;
                const toc = '<section class="toc"><h2>Sommaire</h2><ol>' + chapters.map(c => '<li><a class="ch" href="#ch' + c.n + '"><b>' + c.n + '</b>' + E(c.name) + '</a>' + (c.subs.length ? '<ul>' + c.subs.map((t, k) => '<li><a href="#c' + c.n + 's' + (k + 1) + '">' + E(t.charAt(0) + t.slice(1).toLowerCase()) + '</a></li>').join('') + '</ul>' : '') + '</li>').join('') + '</ol></section>';
                const body = chapters.map(c => '<section class="chap" id="ch' + c.n + '"><h2><span class="num">' + c.n + '.</span> ' + E(c.name) + '</h2>' + c.html + '</section>').join('');
                const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Guide MomoCAD</title><style>' + css + '</style></head><body>'
                    + '<section class="cover"><div class="logo">' + logo + '</div><h1>Guide de l\'utilisateur</h1><div class="sub">Dessin, topographie, terrassement, métrés et modélisation 3D pour les travaux publics</div><div class="mascot">' + momo + '</div><div class="band"><span>MomoCAD</span><span>Édition du ' + today + '</span></div></section>'
                    + '<table class="pg"><thead><tr><td><div class="hd">' + logo + '<span>Guide de l\'utilisateur</span></div></td></tr></thead><tbody><tr><td>' + toc + body + '</td></tr></tbody></table></body></html>';
                let fr = document.getElementById('guide-print-frame'); if (fr) fr.remove();
                fr = document.createElement('iframe'); fr.id = 'guide-print-frame'; fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
                document.body.appendChild(fr);
                fr.onload = () => { setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { alert('Impression impossible : ' + e.message); } }, 250); };
                fr.srcdoc = html;
                updateCommandMessageText('GUIDE : impression lancée (couverture, sommaire, ' + chapters.length + ' chapitres). Choisissez « Enregistrer en PDF » pour un fichier.');
            };
            go();
        }
        // guide : les vrais boutons (icône et couleur) remplissent les repères .hg-btn et les vues de palettes .hg-palshot
        function hgFillBtns() {
            const col = (b) => { try { return getComputedStyle(b).color; } catch (e) { return ''; } };
            const svgOf = (b) => { const v = b.querySelector('svg'); if (!v) return ''; const c = v.cloneNode(true); c.removeAttribute('id'); c.setAttribute('width', '16'); c.setAttribute('height', '16'); return c.outerHTML; };
            document.querySelectorAll('#help-modal .hg-btn[data-btn]').forEach(sp => { if (sp.dataset.done) return; const b = document.getElementById(sp.dataset.btn); if (!b) { sp.remove(); return; } sp.innerHTML = svgOf(b); sp.style.color = col(b); sp.title = (b.title || '').split(/ : | \(/)[0]; sp.dataset.done = '1'; });
            document.querySelectorAll('#help-modal .hg-palshot[data-pal]').forEach(div => { if (div.dataset.done) return; const pal = document.querySelector('.pal[data-pal="' + div.dataset.pal + '"] .pal-body'); if (!pal) return;
                div.innerHTML = [...pal.querySelectorAll(':scope > button')].map(b => { const t = (b.title || '').split(/ : | \(| — /)[0].trim(); return `<div class="hg-ps"><span class="hg-btn" style="color:${col(b)}">${svgOf(b)}</span><span>${t.replace(/</g, '&lt;')}</span></div>`; }).join(''); div.dataset.done = '1'; });
        }
        function openHelpModal() { try { hgLearnRender(); } catch (e) {} document.getElementById('help-modal').classList.remove('hidden'); try { hgFillBtns(); } catch (e) {} const q = document.getElementById('help-search'); q.value = ''; helpSearch(''); setTimeout(() => q.focus(), 30); }
        // Guide : un chapitre à la fois, recherche dans tous les chapitres
        // fiche « Démarrer en 10 minutes » imprimable : la même page, en clair sur A4
        function hgPrintQuick() { const sec = document.querySelector('#help-modal .hg-ch[data-ch=go]'); if (!sec) return; const c = sec.cloneNode(true);
            c.querySelectorAll('button').forEach(b => b.remove()); c.querySelectorAll('.hg-btn').forEach(sp => sp.remove());
            const css = `@page{size:A4;margin:12mm}body{font:10.5pt/1.4 Arial,sans-serif;color:#111;margin:0}h2{font-size:17pt;margin:0 0 4pt}.hg-intro{color:#444;margin:0 0 8pt}h3{font-size:11pt;text-transform:uppercase;letter-spacing:.04em;color:#1d4ed8;margin:10pt 0 4pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt}ul{list-style:none;margin:0;padding:0}.hg-list>li{break-inside:avoid;margin:0 0 6pt;padding:5pt 7pt;border:1px solid #e5e7eb;border-radius:5px}b.text-white{color:#111;font-size:11pt}p{margin:2pt 0}.hg-why{color:#555;font-style:italic}.hg-dots li{margin:1pt 0}.hg-dots li:before{content:'• ';color:#1d4ed8}kbd{border:1px solid #9ca3af;border-bottom-width:2px;border-radius:3px;padding:0 4px;font:600 9pt monospace;background:#f8fafc}.hg-tip{background:#fef9c3;padding:5pt 7pt;border-radius:5px;margin-top:8pt}.hg-title span{display:none}.foot{margin-top:8pt;color:#888;font-size:8.5pt}`;
            let fr = document.getElementById('hg-print-frame'); if (fr) fr.remove(); fr = document.createElement('iframe'); fr.id = 'hg-print-frame'; fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(fr);
            const d = fr.contentDocument; d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>MomoCAD — Démarrer en 10 minutes</title><style>' + css + '</style></head><body>' + c.innerHTML + '<div class="foot">MomoCAD — le guide complet est dans le logiciel (bouton ?).</div></body></html>'); d.close();
            setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { console.warn(e); } }, 250); }
        function helpChapter(id) {
            document.querySelectorAll('#help-modal .hg-tab').forEach(b => b.classList.toggle('on', b.dataset.ch === id));
            document.querySelectorAll('#help-modal .hg-ch').forEach(c => c.classList.toggle('on', c.dataset.ch === id));
            const q = document.getElementById('help-search'); if (q.value) { q.value = ''; helpSearch(''); }
            document.getElementById('help-body').scrollTop = 0;
            try { localStorage.setItem('momocad-help-ch', id); } catch (e) {}
            if (id === 'learn') hgLearnRender();
        }
        function helpSearch(txt) {
            const res = document.getElementById('help-results'), chs = document.querySelectorAll('#help-modal .hg-ch');
            const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const words = norm(txt).split(/\s+/).filter(w => w.length > 1);
            if (!words.length) {
                res.innerHTML = '';
                let id = 'go'; try { id = localStorage.getItem('momocad-help-ch') || 'go'; } catch (e) {}
                document.querySelectorAll('#help-modal .hg-tab').forEach(b => b.classList.toggle('on', b.dataset.ch === id));
                chs.forEach(c => c.classList.toggle('on', c.dataset.ch === id)); if (id === 'learn') hgLearnRender(); return;
            }
            chs.forEach(c => c.classList.remove('on')); document.querySelectorAll('#help-modal .hg-tab').forEach(b => b.classList.remove('on'));
            let html = '', n = 0;
            chs.forEach(c => {
                const title = c.querySelector('.hg-title').textContent.trim(), hits = [];
                c.querySelectorAll('.hg-list > li, .hg-raw tr').forEach(li => { const t = norm(li.textContent); if (words.every(w => t.includes(w))) hits.push(li); });
                if (!hits.length) return; n += hits.length;
                html += `<div class="hg-res-ch" onclick="helpChapter('${c.dataset.ch}')">${title} ›</div><ul class="hg-list">` + hits.map(li => '<li>' + (li.tagName === 'TR' ? [...li.children].map(td => td.innerHTML).join(' — ') : li.innerHTML) + '</li>').join('') + '</ul>';
            });
            res.innerHTML = `<div class="text-gray-400 mb-2">${n ? n + ' résultat' + (n > 1 ? 's' : '') + ' pour « ' + txt.replace(/</g, '&lt;') + ' »' : 'Aucun résultat pour « ' + txt.replace(/</g, '&lt;') + ' »'}</div>` + html;
            // surlignage des mots cherchés
            const walk = (node) => { if (node.nodeType === 3) { const t = node.nodeValue, nt = norm(t); let best = -1, len = 0; words.forEach(w => { const k = nt.indexOf(w); if (k >= 0 && (best < 0 || k < best)) { best = k; len = w.length; } });
                    if (best >= 0) { const sp = document.createElement('span'); sp.className = 'hg-hit'; const mid = node.splitText(best); mid.splitText(len); sp.textContent = mid.nodeValue; mid.parentNode.replaceChild(sp, mid); walk(sp.nextSibling || document.createTextNode('')); } }
                else if (node.nodeType === 1 && !node.classList.contains('hg-hit')) [...node.childNodes].forEach(walk); };
            res.querySelectorAll('.hg-list').forEach(walk);
            document.getElementById('help-body').scrollTop = 0;
        }
        // ---- Fenêtre Paramètres : onglets, boutons segmentés, aperçus ----
        let psLogoRemoved = false;
        function psTab(t) {
            if (!document.querySelector('#cartouche-modal .ps-tab[data-tab="' + t + '"]')) t = 'plan';   // ancien onglet (Présentation) : il vit maintenant dans le menu ⚙ des présentations
            document.querySelectorAll('#cartouche-modal .ps-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
            document.querySelectorAll('#cartouche-modal .ps-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === t));
            try { localStorage.setItem('momocad-ps-tab', t); } catch (e) {}
            if (t === 'cart') psCartRefresh(); if (t === 'print') psSheetRefresh(); if (t === 'fond') psBmPreview(true); if (t === 'mat') psMatRender(); if (t === 'ia') psIaRender(); if (t === 'dim') psDimRender();
            const card = document.querySelector('#cartouche-modal .ps-card'); if (card) card.classList.toggle('wide', t === 'mat');
        }
        function psSegSync() {
            document.querySelectorAll('#cartouche-modal .ps-seg').forEach(g => { const v = document.getElementById(g.dataset.for).value; g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); });
        }
        document.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest('#cartouche-modal .ps-seg button'); if (!b) return;
            const sel = document.getElementById(b.closest('.ps-seg').dataset.for); if (sel.value === b.dataset.v) return;
            sel.value = b.dataset.v; sel.dispatchEvent(new Event('change')); psSegSync(); psSheetRefresh(); psCartRefresh();
        });
        // Aperçu de la feuille : proportions, marge, zone de dessin et cartouche à l'échelle
        function psSheetRefresh() {
            const svg = document.getElementById('ps-sheet'); if (!svg) return;
            const fmt = { A5: [148, 210], A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] }[document.getElementById('ps-paper').value] || [210, 297];
            const pd = pageDims(), land = document.getElementById('ps-orient').value === 'landscape', W = land ? fmt[1] : fmt[0], H = land ? fmt[0] : fmt[1];
            const k = Math.min(160 / W, 210 / H), w = W * k, h = H * k, x = (170 - w) / 2, y = (220 - h) / 2, m = (pd.margin || 10) * k;
            const cart = document.getElementById('ps-cartouche').checked;
            svg.innerHTML = `<rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" fill="#000" opacity=".35" rx="2"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" rx="2"/>
                <rect x="${x + m}" y="${y + m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="#eef2ff" stroke="#1f2937" stroke-width="1"/>
                <path d="M${x + m + 10} ${y + h - m - 18} l${(w - 2 * m) * 0.3} ${-(h - 2 * m) * 0.35} l${(w - 2 * m) * 0.25} ${(h - 2 * m) * 0.12}" fill="none" stroke="#93c5fd" stroke-width="1.5"/>
                ${cart ? `<rect x="${x + w - m - cartDims(W, H, pd.margin || 10).w * k}" y="${y + h - m - cartDims(W, H, pd.margin || 10).h * k}" width="${cartDims(W, H, pd.margin || 10).w * k}" height="${cartDims(W, H, pd.margin || 10).h * k}" fill="#fff" stroke="#111" stroke-width="1"/>` : ''}`;
            document.getElementById('ps-sheet-label').textContent = document.getElementById('ps-paper').value + ' ' + (land ? 'paysage' : 'portrait') + ' · ' + W + ' × ' + H + ' mm';
        }
        // Aperçu du cartouche avec les valeurs en cours de saisie
        function psCartRefresh() {
            const on = document.getElementById('ps-cartouche').checked;
            document.getElementById('ps-cart-prev').style.opacity = on ? 1 : 0.35;
            const cv = document.getElementById('ps-cart-canvas'); if (!cv) return; const c = cv.getContext('2d');
            if (document.getElementById('ps-carttype').value === 'a4') {
                const src = pendingLogo || (psLogoRemoved ? null : cartoucheData.logo), D = Object.assign(psCartInputs(), { logoImg: null });
                const paint = (img) => { D.logoImg = img; c.clearRect(0, 0, cv.width, cv.height); drawCartA4(c, 0, 0, cv.width / CART_A4_W, cartInfo(layoutOn ? '1:…' : currentPrintScale, '', D)); };
                if (src) { const im = new Image(); im.onload = () => paint(im); im.src = src; } else paint(null);
                document.getElementById('ps-logo-state').textContent = pendingLogo ? 'nouveau logo (cliquez Valider)' : (src ? 'logo enregistré' : 'aucun logo');
                document.getElementById('ps-logo-remove').classList.toggle('hidden', !src); psSheetRefresh(); return;
            }
            const k = cv.width / (CART_W + 4), ox = 2 * k, oy = (cv.height - CART_H * k) / 2, cW = CART_W * k, cH = CART_H * k, lw = CART_LOGO * k, rh = cH / 4;
            c.clearRect(0, 0, cv.width, cv.height);
            c.fillStyle = '#fff'; c.fillRect(ox, oy, cW, cH); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(ox, oy, cW, cH);
            c.lineWidth = 1; c.beginPath(); c.moveTo(ox + lw, oy); c.lineTo(ox + lw, oy + cH); for (let i = 1; i <= 3; i++) { c.moveTo(ox + lw, oy + rh * i); c.lineTo(ox + cW, oy + rh * i); } c.stroke();
            const v = (id) => document.getElementById(id).value;
            const rows = ['Plan : ' + v('cartouche-plan'), 'Client : ' + v('cartouche-client'), 'Dessin : ' + v('cartouche-draftsman'), 'Échelle : ' + (currentPrintScale || '1:100')];
            c.fillStyle = '#000'; c.font = (CART_FONT * 0.3528 * k) + 'px Helvetica, Arial, sans-serif'; c.textBaseline = 'alphabetic';
            const ind = cartoucheIndice(v('cartouche-indice'));
            rows.forEach((t, i) => c.fillText(t, ox + lw + 1.2 * k, oy + rh * i + rh * 0.68, cW - lw - 2.4 * k - (i === 0 && ind ? 11 * k : 0)));
            if (ind) { c.font = 'bold ' + (CART_FONT * 0.3528 * k) + 'px Helvetica, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(ind, ox + cW - 1.2 * k, oy + rh * 0.68); c.textAlign = 'left'; c.font = (CART_FONT * 0.3528 * k) + 'px Helvetica, Arial, sans-serif'; }
            c.fillStyle = '#505050'; c.font = ((CART_FONT - 1) * 0.3528 * k) + 'px Helvetica, Arial, sans-serif'; c.textAlign = 'right';
            c.fillText(new Date().toLocaleDateString('fr-FR'), ox + cW - 1.2 * k, oy + rh * 3 + rh * 0.68); c.textAlign = 'left';
            const src = pendingLogo || (psLogoRemoved ? null : cartoucheData.logo);
            if (src) { const im = new Image(); im.onload = () => { const b = logoBox(lw - 2 * k, im); c.drawImage(im, ox + k + b.x, oy + k + b.y, b.w, b.h); }; im.src = src; }
            else { c.fillStyle = '#9ca3af'; c.font = (3 * k * 0.6) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('logo', ox + lw / 2, oy + cH / 2 + k); c.textAlign = 'left'; }
            document.getElementById('ps-logo-state').textContent = pendingLogo ? 'nouveau logo (cliquez Valider)' : (src ? 'logo enregistré' : 'aucun logo');
            document.getElementById('ps-logo-remove').classList.toggle('hidden', !src);
            psSheetRefresh();
        }
        let psRevs = [];
        function psRevRender() {
            const box = document.getElementById('ps-revs'); if (!box) return; const esc = (t) => String(t || '').replace(/"/g, '&quot;');
            box.innerHTML = psRevs.map((r, i) => `<div class="flex items-center gap-1"><input class="ps-input w-12 text-center" value="${esc(r.ind)}" placeholder="${String.fromCharCode(65 + i)}" oninput="psRevs[${i}].ind=this.value;psCartRefresh()"><input class="ps-input w-24" value="${esc(r.date)}" placeholder="jj/mm/aaaa" oninput="psRevs[${i}].date=this.value;psCartRefresh()"><input class="ps-input flex-1" value="${esc(r.txt)}" placeholder="Modification" oninput="psRevs[${i}].txt=this.value;psCartRefresh()"><button type="button" class="text-red-300 hover:text-red-200 text-xs px-1" title="Retirer" onclick="psRevs.splice(${i},1);psRevRender();psCartRefresh()">✕</button></div>`).join('') || '<div class="ps-sub">Aucun indice : les lignes A à N restent vides.</div>';
        }
        function psRevAdd() { if (psRevs.length >= CART_REV_ROWS) return; const i = psRevs.length; psRevs.push({ ind: String.fromCharCode(65 + i), date: new Date().toLocaleDateString('fr-FR'), txt: i ? '' : 'Première diffusion' }); psRevRender(); psCartRefresh(); }
        function psCartTypeUI() { const a4 = document.getElementById('ps-carttype').value === 'a4'; document.getElementById('ps-a4-fields').classList.toggle('hidden', !a4); const cv = document.getElementById('ps-cart-canvas'); if (a4) { cv.width = 420; cv.height = 594; cv.style.width = '210px'; } else { cv.width = 560; cv.height = 160; cv.style.width = '420px'; } }
        function psCartInputs() {
            const v = (id) => document.getElementById(id).value;
            return { planName: v('cartouche-plan'), clientName: v('cartouche-client'), draftsmanName: v('cartouche-draftsman'), indice: v('cartouche-indice'), site: v('cartouche-site'), moa: v('cartouche-moa'), moe: v('cartouche-moe'), conducteur: v('cartouche-cond'), phase: v('cartouche-phase'), revisions: psRevs };
        }
        function psRemoveLogo() { pendingLogo = null; psLogoRemoved = true; document.getElementById('cartouche-logo').value = ''; psCartRefresh(); }
        function openCartoucheModal() {
            closeLayerModal(); closeSnapModal(); matEdit = JSON.parse(JSON.stringify(matCatalog)); dimEdit = Object.assign({}, dimStyle, { _al: dimTextAligned });
            document.getElementById('cartouche-modal').classList.remove('hidden'); psLogoRemoved = false;
            document.getElementById('ps-paper').value = printSettings.paper;
            document.getElementById('ps-output').value = printSettings.output;
            document.getElementById('ps-orient').value = printOrientation;
            document.getElementById('cartouche-indice').value = cartoucheData.indice || '';
            document.getElementById('ps-carttype').value = cartoucheData.type === 'a4' ? 'a4' : 'mini';
            ['site', 'moa', 'moe', 'phase'].forEach(f => { document.getElementById('cartouche-' + f).value = cartoucheData[f] || ''; }); document.getElementById('cartouche-cond').value = cartoucheData.conducteur || '';
            psRevs = JSON.parse(JSON.stringify(cartoucheData.revisions || [])); psRevRender(); psCartTypeUI();
            document.getElementById('ps-bw').checked = !!printSettings.bw;
            document.getElementById('ps-bmbase').value = bmSettings.base; document.getElementById('ps-bmhd').value = bmSettings.hd || 'hd'; BM_OVL_LIST.forEach(k => { document.getElementById('ps-ov-' + k).checked = !!bmSettings.ov[k]; });
            { const tn = bmSettings.tn || {}; document.getElementById('ps-tn-on').checked = !!tn.on; document.getElementById('ps-tn-pas').value = String(tn.pas || 5); const D = bmSettings.data || {}; document.getElementById('ps-dt-bois').checked = !!D.bois; document.getElementById('ps-dt-routes').checked = !!D.routes; document.getElementById('ps-dt-eau').checked = !!D.eau; } { const sel = document.getElementById('ps-crs'); if (sel) sel.value = bmSettings.crs || 'auto'; const cur = document.getElementById('ps-crs-cur'), P = detectCRS(); if (cur) cur.textContent = P ? 'Plan ouvert : ' + crsName(P.code) + '.' : 'Plan ouvert : pas encore géoréférencé.'; }
            document.getElementById('ps-unit').value = lpSpace === 'paper' ? lpModelStore.unit : currentUnit;
            document.getElementById('ps-decimals').value = String(printSettings.decimals); psDecimals(0);
            refreshGridField();
            document.getElementById('ps-cartouche').checked = !!printSettings.cartouche;
            document.getElementById('cartouche-plan').value = cartoucheData.planName || "";
            document.getElementById('cartouche-client').value = cartoucheData.clientName || "";
            document.getElementById('cartouche-draftsman').value = cartoucheData.draftsmanName || "";
            document.getElementById('cartouche-logo').value = ""; pendingLogo = null;
            psSegSync(); let t = 'plan'; try { t = localStorage.getItem('momocad-ps-tab') || 'plan'; } catch (e) {} psTab(t); psCartRefresh();
        }
        // Réglages d'impression et cartouche, mémorisés sur ce poste
        function saveCartoucheData() {
            try { localStorage.setItem('momocad-cartouche', JSON.stringify(cartoucheData)); }
            catch (e) { try { localStorage.setItem('momocad-cartouche', JSON.stringify(Object.assign({}, cartoucheData, { logo: null }))); } catch (e2) {} }
        }
        // ---- onglet Cotes : éditeur du style des cotes, copie de travail validée avec « Valider » ----
        let dimEdit = null;
        function psDimSet(k, v, isNum) {
            if (!dimEdit) return;
            if (isNum) { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); dimEdit[k] = isFinite(n) && n >= 0 ? Math.min(n, 50) : DIM_STYLE_DEF[k]; }
            else dimEdit[k] = v;
            psDimRender();
        }
        function psDimReset() { dimEdit = Object.assign({}, DIM_STYLE_DEF, { _al: false }); psDimRender(); }
        function psDimPreview(st) {   // aperçu : un bâtiment coté en longueur et en hauteur, 1 mm papier = 6 px
            const M = 6, out = [], g1 = { p1: { x: 40, y: 104 }, p2: { x: 270, y: 104 }, c1: { x: 40, y: 50 }, c2: { x: 270, y: 50 }, ux: 1, uy: 0, mid: { x: 155, y: 50 }, ang: 0 },
                g2 = { p1: { x: 270, y: 104 }, p2: { x: 270, y: 150 }, c1: { x: 330, y: 104 }, c2: { x: 330, y: 150 }, ux: 0, uy: 1, mid: { x: 330, y: 127 }, ang: Math.PI / 2 };
            const da = (n) => (DIM_DASH[n] || []).length ? ` stroke-dasharray="${DIM_DASH[n].map(v => v * M).join(' ')}"${n === 'dotted' ? ' stroke-linecap="round"' : ''}` : '';
            out.push('<rect x="40" y="104" width="230" height="46" fill="#374151" stroke="#9ca3af" stroke-width="1.5"/>');
            [[g1, '23,00'], [g2, '4,50']].forEach(([g, txt]) => {
                const P = dimParts(g, st, M), L = (a, b, n, op) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f59e0b" stroke-width="1.4"${op ? ' opacity="0.6"' : ''}${da(n)}/>`;
                P.ext.forEach(([a, b]) => out.push(L(a, b, st.ext, 1))); out.push(L(P.ln[0], P.ln[1], st.line));
                P.T.forEach(t => out.push(t.t === 'seg' ? L(t.a, t.b) : t.t === 'dot' ? `<circle cx="${t.c.x}" cy="${t.c.y}" r="${t.r}" fill="#f59e0b"/>`
                    : `<polyline points="${t.pts.map(q => q.x + ',' + q.y).join(' ')}" fill="${t.t === 'tri' ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="1.4"${t.t === 'tri' ? ' stroke-linejoin="round"' : ''}/>`));
                const fs = 14, vert = g.uy !== 0, rot = vert && st._al, sg = st.txtPos === 'above' ? -1 : st.txtPos === 'below' ? 1 : 0, pill = st.txtBg === 'pill', gap = st.txtGap * M + (pill ? 3 : 0), tw = txt.length * fs * 0.55;
                let x = g.mid.x, y = g.mid.y, tr = '';
                if (sg) { if (!vert) y += sg * (gap + fs * 0.55); else if (rot) x += sg * (gap + fs * 0.55); else x -= sg * (gap + tw / 2 + 3); }
                if (rot) tr = ` transform="rotate(-90 ${x} ${y})"`;
                if (st.txtBg === 'fill') out.push(`<rect x="${x - tw / 2 - 4}" y="${y - fs * 0.8}" width="${tw + 8}" height="${fs * 1.6}" fill="#111827"${tr}/>`);
                else if (pill) out.push(`<rect x="${x - tw / 2 - 7}" y="${y - fs * 0.78}" width="${tw + 14}" height="${fs * 1.56}" rx="${fs * 0.78}" fill="#111827" stroke="#f59e0b" stroke-width="1.2"${tr}/>`);
                out.push(`<text x="${x}" y="${y}" fill="#f59e0b" font-family="Arial" font-weight="bold" font-size="${fs}" text-anchor="middle" dominant-baseline="central"${tr}>${txt}</text>`);
            });
            return `<svg viewBox="0 0 400 170" class="w-full" style="max-height:190px;background:#1f2937;border:1px solid #374151;border-radius:10px">${out.join('')}</svg>`;
        }
        function psDimRender() {
            const box = document.getElementById('ps-dim-box'); if (!box || !dimEdit) return; const s = dimEdit;
            const ico = (body) => `<svg width="34" height="16" viewBox="0 0 34 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
            const seg = (k, opts) => `<div class="pd-seg">${opts.map(([v, l, t]) => `<button type="button" class="${s[k] === v ? 'on' : ''}" title="${t || ''}" onclick="psDimSet('${k}',${typeof v === 'boolean' ? v : `'${v}'`})">${l}</button>`).join('')}</div>`;
            const num = (k, u) => `<span class="flex items-center gap-1"><input type="text" inputmode="decimal" class="ps-input w-16 text-right" value="${String(s[k]).replace('.', ',')}" onchange="psDimSet('${k}',this.value,1)"><span class="text-gray-400 text-xs w-6">${u || 'mm'}</span></span>`;
            const row = (h, sub, ctl) => `<div class="ps-row"><div><div class="ps-h">${h}</div>${sub ? `<div class="ps-sub">${sub}</div>` : ''}</div><div class="flex items-center gap-2 flex-wrap justify-end">${ctl}</div></div>`;
            const head = (t) => `<div class="text-xs font-bold uppercase tracking-wider text-sky-300 mt-4">${t}</div>`;
            const traits = [['solid', ico('<path d="M3 8h28"/>'), 'Trait plein'], ['dashed', ico('<path d="M3 8h28" stroke-dasharray="6 3.5"/>'), 'Tirets'], ['dotted', ico('<path d="M3 8h28" stroke-dasharray="0.1 4"/>'), 'Pointillés']];
            box.innerHTML = `<div class="sticky top-0 z-10 bg-gray-800 pb-2">${psDimPreview(s)}</div>
                <div class="ps-sub mt-1">Tailles en mm sur le plan imprimé. Le réglage s'applique à toutes les cotes : linéaires (alignées, horizontales, verticales, en chaîne), rayons et diamètres, angles, pentes et étiquettes de talus ; le fond du texte vaut aussi pour les altitudes (points topo, sommets).</div>
                ${head('Extrémités')}
                ${row('Forme', '', seg('term', [['tick', ico('<path d="M5 8h24"/><path d="M8 13l-6-10M32 13l-6-10"/>'), 'Trait oblique'], ['arrow', ico('<path d="M3 8h28"/><path d="M3 8l6-3v6z M31 8l-6-3v6z" fill="currentColor"/>'), 'Flèche pleine'], ['arrowo', ico('<path d="M3 8h28"/><path d="M9 4.5L3 8l6 3.5M25 4.5L31 8l-6 3.5"/>'), 'Flèche ouverte'], ['dot', ico('<path d="M5 8h24"/><circle cx="5" cy="8" r="2.4" fill="currentColor"/><circle cx="29" cy="8" r="2.4" fill="currentColor"/>'), 'Point'], ['none', ico('<path d="M3 8h28"/>'), 'Aucune']]))}
                ${s.term !== 'none' ? row('Taille', 'Longueur du trait oblique ou de la flèche.', num('termSz')) : ''}
                ${head('Ligne de cote')}
                ${row('Trait', '', seg('line', traits))}
                ${row('Dépassement', 'La ligne de cote déborde au-delà des traits d\'accroche (0 = s\'arrête dessus).', num('lineExt'))}
                ${head('Traits d\'accroche')}
                ${row('Afficher', 'Les traits qui relient l\'objet coté à la ligne de cote.', `<label class="ps-switch"><input type="checkbox" ${s.extOn ? 'checked' : ''} onchange="psDimSet('extOn',this.checked)"><span></span></label>`)}
                ${s.extOn ? row('Trait', '', seg('ext', traits))
                    + row('Longueur', s.extMode === 'fix' ? 'Même longueur pour tous, quelle que soit la distance à l\'objet.' : 'Le trait part de l\'objet, avec un petit écart.', seg('extMode', [['obj', 'Jusqu\'à l\'objet'], ['fix', 'Longueur fixe']]))
                    + (s.extMode === 'fix' ? row('Longueur du trait', '', num('extLen')) : row('Écart à l\'objet', 'Vide laissé entre l\'objet et le début du trait.', num('extGap')))
                    + row('Dépassement', 'Le trait déborde au-delà de la ligne de cote.', num('extOver')) : ''}
                ${head('Texte')}
                ${row('Position', '', seg('txtPos', [['above', 'Au-dessus', 'Le texte est posé au-dessus de la ligne'], ['on', 'Dans la ligne', 'Le texte est centré sur la ligne de cote'], ['below', 'En dessous', 'Le texte est posé sous la ligne']]))}
                ${s.txtPos !== 'on' ? row('Écart', 'Entre la ligne de cote et le texte.', num('txtGap')) : ''}
                ${row('Fond', s.txtBg === 'none' ? 'Le texte est posé tel quel : la ligne reste visible derrière.' : s.txtBg === 'pill' ? 'Le texte est dans une pastille arrondie, cerclée de la couleur de la cote.' : 'Un fond masque la ligne derrière le texte (noir à l\'écran, blanc à l\'impression).', seg('txtBg', [['none', 'Sans fond'], ['fill', 'Fond plein'], ['pill', 'Pastille']]))}
                ${row('Orientation', 'Aussi avec le bouton 1.23 de la barre des cotes.', seg('_al', [[false, 'Horizontal'], [true, 'Aligné sur la cote']]))}
                <div class="pt-4"><button type="button" class="ps-btn" onclick="psDimReset()">Valeurs par défaut</button></div>`;
        }
        // ---- onglet Produits : copie de travail du catalogue, validée avec « Valider » ----
        let matEdit = null;
        function psMatRender() {
            const box = document.getElementById('ps-mat-box'); if (!box || !matEdit) return;
            const q = ((document.getElementById('ps-mat-q') || {}).value || '').trim().toLowerCase(), E = MF.esc, nv = (v) => String(v === undefined ? '' : v).replace('.', ',');
            box.innerHTML = matEdit.map((m, i) => { if (q && !m.code.startsWith('__') && !m.name.toLowerCase().includes(q)) return '';
                const terr = m.code.startsWith('__'), pus = terr ? MAT_PU.filter(u => u[0] !== 'm2') : MAT_PU;
                return `<div class="mat-grid${terr ? ' mat-terr' : ''}">
                    ${terr ? `<b class="text-white text-xs px-1">${m.code === '__DEB' ? 'Terrassement en DÉBLAI' : 'Terrassement en REMBLAI'}</b>` : `<input type="text" value="${E(m.name)}" onchange="psMatSet(${i},'name',this.value)">`}
                    ${m.pu === 'ml' ? `<input type="text" class="num" title="Diamètre extérieur du tube (mm)" placeholder="Ø mm" value="${nv(m.dn)}" onchange="psMatSet(${i},'dn',this.value)">` : `<input type="text" class="num" ${m.surf ? 'disabled style="opacity:.35"' : ''} value="${m.surf ? '' : nv(m.d)}" onchange="psMatSet(${i},'d',this.value)">`}
                    <input type="text" class="num" value="${nv(m.coef)}" onchange="psMatSet(${i},'coef',this.value)">
                    <input type="text" class="num" value="${nv(m.prix)}" onchange="psMatSet(${i},'prix',this.value)">
                    <select onchange="psMatSet(${i},'pu',this.value)">${pus.map(([v, l]) => `<option value="${v}"${v === m.pu ? ' selected' : ''}>${l}</option>`).join('')}</select>
                    ${terr ? '<span></span><span></span>' : `<input type="checkbox" ${m.surf ? 'checked' : ''} title="Sans épaisseur, compté en m²" onchange="psMatSet(${i},'surf',this.checked)"><button type="button" class="mat-x" title="Supprimer" onclick="psMatDel(${i})">✕</button>`}</div>`; }).join('');
            const n = document.getElementById('ps-mat-n'); if (n) n.textContent = (matEdit.length - 2) + ' matériaux';
        }
        function psMatSet(i, k, v) { const m = matEdit[i]; if (!m) return;
            if (k === 'code') { v = String(v).trim(); if (!v || v.startsWith('__') || matEdit.some((x, j) => j !== i && x.code === v)) { alert('Code vide ou déjà utilisé.'); psMatRender(); return; } m.code = v; }
            else if (k === 'name') m.name = String(v).trim();
            else if (k === 'pu') { m.pu = v; if (v === 'ml' && !(+m.dn > 0)) m.dn = 200; psMatRender(); }
            else if (k === 'surf') { m.surf = !!v; if (m.surf) m.pu = 'm2'; psMatRender(); }
            else { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); m[k] = isFinite(n) && n >= 0 ? n : (k === 'coef' ? 1 : 0); } }
        function psMatAdd() { let k = 1; while (matEdit.some(m => m.code === 'MAT_' + k)) k++; matEdit.push({ code: 'MAT_' + k, name: 'Nouveau matériau', d: 2, coef: 1.25, prix: 0, pu: 't', surf: false }); const qq = document.getElementById('ps-mat-q'); if (qq) qq.value = ''; psMatRender(); const b = document.getElementById('ps-mat-box'); if (b && b.lastElementChild) { b.lastElementChild.scrollIntoView({ block: 'nearest' }); const inp = b.lastElementChild.querySelectorAll('input')[1]; if (inp) { inp.focus(); inp.select(); } } }
        function psMatDel(i) { const m = matEdit[i]; if (!m || m.code.startsWith('__')) return; const used = shapes.some(s => s.struct && s.struct.layers.some(l => (MAT_OLD[l.mat] || l.mat) === m.code)); if (used && !confirm('« ' + m.name + ' » est utilisé dans une structure du plan. Le supprimer du catalogue quand même ?')) return; matEdit.splice(i, 1); psMatRender(); }
        function psMatReset() { if (!confirm('Rétablir la liste de matériaux d\'origine ? Les prix et matériaux ajoutés seront perdus.')) return; matEdit = JSON.parse(JSON.stringify(MAT_DEFAULTS)); psMatRender(); }
        function applyCartouche() {
            if (matEdit) { matCatalog = matCatalogFix(matEdit); matSave(); matEdit = null; }
            if (dimEdit) { const o = Object.assign({}, dimEdit), al = !!o._al; delete o._al; dimStyleSet(o); dimEdit = null;
                if (al !== dimTextAligned) { dimTextAligned = al; try { localStorage.setItem('momocad-dim-text', al ? 'aligned' : 'horizontal'); } catch (e) {} refreshDimTextButton(); }
                if (typeof invalidateCache === 'function') invalidateCache(); }
            printSettings.paper = document.getElementById('ps-paper').value;
            printSettings.output = document.getElementById('ps-output').value;
            printOrientation = printSettings.orientation = document.getElementById('ps-orient').value;
            cartoucheData.indice = document.getElementById('cartouche-indice').value.trim();
            cartoucheData.type = document.getElementById('ps-carttype').value; ['site', 'moa', 'moe', 'phase'].forEach(f => { cartoucheData[f] = document.getElementById('cartouche-' + f).value; });
            cartoucheData.conducteur = document.getElementById('cartouche-cond').value; cartoucheData.revisions = psRevs.filter(r => r.ind || r.date || r.txt);
            printSettings.bw = document.getElementById('ps-bw').checked;
            bmSettings = { base: document.getElementById('ps-bmbase').value, hd: document.getElementById('ps-bmhd').value || 'hd', ov: {}, tn: { on: document.getElementById('ps-tn-on').checked, pas: +document.getElementById('ps-tn-pas').value || 5 }, crs: document.getElementById('ps-crs').value || 'auto', crs2: 1, data: { bois: document.getElementById('ps-dt-bois').checked, routes: document.getElementById('ps-dt-routes').checked, eau: document.getElementById('ps-dt-eau').checked } }; BM_OVL_LIST.forEach(k => { bmSettings.ov[k] = document.getElementById('ps-ov-' + k).checked; }); bmSaveSettings(); bmRefreshLeaflet();
            if (bmPlace) { bmPlace.ext = null; bmPlaceLoad(); }
            printSettings.cartouche = document.getElementById('ps-cartouche').checked;
            const uOld = lpSpace === 'paper' ? lpModelStore.unit : printSettings.unit, uNew = document.getElementById('ps-unit').value, gOld = gridMm;
            if (lpSpace === 'paper') lpModelStore.unit = uNew; else printSettings.unit = uNew;
            if (uOld !== uNew && UNIT_MM[uOld] && UNIT_MM[uNew] && shapes.some(x => !isBg(x))) setTimeout(() => unitChangeDialog(uOld, uNew, gOld), 50);
            printSettings.decimals = parseInt(document.getElementById('ps-decimals').value, 10);
            applyUnitSettings(); updateCursorCoords();
            setGridCm(document.getElementById('ps-grid').value);   // dans la nouvelle unité ; mémorisé sur ce poste
            try { localStorage.setItem('momocad-print', JSON.stringify(printSettings)); } catch (e) {}
            cartoucheData.planName = document.getElementById('cartouche-plan').value;
            cartoucheData.clientName = document.getElementById('cartouche-client').value;
            cartoucheData.draftsmanName = document.getElementById('cartouche-draftsman').value;
            if (pendingLogo) { cartoucheData.logo = pendingLogo; pendingLogo = null; getLogoImg(); }
            else if (psLogoRemoved) cartoucheData.logo = null;
            saveCartoucheData();
            closeCartoucheModal();
            // le format a pu changer : on garde la même échelle (1:1 reste 1:1)
            if (mode === 'print' || mode === 'preview') { const c0 = previewPin || { x: currentX_screen, y: currentY_screen }; applyPrintScale(c0.x, c0.y); }
            draw();
        }
        function refreshSnapButtons() {
            Object.keys(SNAP_DEFAULTS).forEach(k => { const b = document.getElementById('snapbtn-' + k); if (b) b.classList.toggle('on', !!snapSettings[k]); });
            ['end:endpoint', 'mid:midpoint', 'inter:intersection', 'perp:perpendicular', 'center:center', 'tan:tangent', 'near:nearest'].forEach(q => { const [id, k] = q.split(':'), el = document.getElementById('snap-' + id); if (el) el.checked = !!snapSettings[k]; });
        }
        function toggleSnap(type) {
            snapSettings[type] = !snapSettings[type];
            if (type === 'track' && !snapSettings.track) { trackPts = []; trackLines = []; }
            try { localStorage.setItem('momocad-snap', JSON.stringify(snapSettings)); } catch (e) {}
            refreshSnapButtons(); invalidateCache(); draw();
        }
        function toggleSnapSetting(type) { toggleSnap(type); }
        // Champ « ◻ = » affiché dans l'unité du plan (la grille est stockée en mm)
        function refreshGridField() {
            const k = UNIT_MM[currentUnit] || 1;
            const inp = document.getElementById('ps-grid'); if (inp) { inp.value = String(+(gridMm / k).toFixed(6)).replace('.', ','); inp.dataset.unit = currentUnit; }
            const u = document.getElementById('ps-grid-unit'); if (u) u.textContent = currentUnit;
        }
        // Décimales dans ⛯ : boutons -0.0 / +0.00 et exemple de lecture
        function psDecimals(delta) {
            const h = document.getElementById('ps-decimals');
            const d = Math.max(0, Math.min(4, (parseInt(h.value, 10) || 0) + (delta || 0)));
            h.value = String(d);
            document.getElementById('ps-dec-example').textContent = (1234.5678).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ' + document.getElementById('ps-unit').value;
            const dl = document.getElementById('ps-dec-label'); if (dl) dl.textContent = d === 0 ? 'Aucune décimale' : d + (d > 1 ? ' décimales' : ' décimale');
        }
        // Changement d'unité dans ⛯ : on convertit la valeur affichée du carreau (même taille réelle)
        function psUnitChanged() {
            const inp = document.getElementById('ps-grid'), nu = document.getElementById('ps-unit').value;
            const v = parseFloat(String(inp.value).replace(',', '.')), ou = inp.dataset.unit || currentUnit;
            inp.dataset.unit = nu; document.getElementById('ps-grid-unit').textContent = nu; psDecimals(0);
        }
        // changement d'unité du dessin, plan non vide : garder les nombres (le dessin change de taille réelle) ou garder la taille réelle
        function unitChangeDialog(uOld, uNew, gOld) {
            const f = UNIT_MM[uNew] / UNIT_MM[uOld], big = f > 1;
            openTopoModal('📏 Unité du dessin : ' + uOld + ' → ' + uNew, `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;line-height:1.5;color:#e5e7eb">
                <p>Ton plan contient déjà des objets. Que deviennent-ils ?</p>
                <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px"><b>Garder les nombres</b> — une longueur de 12 reste 12, mais en ${uNew} au lieu de ${uOld}. Le dessin devient ${big ? f + ' fois plus grand' : 1 / f + ' fois plus petit'} en vrai. C'est le bon choix si tu as dessiné « en unités » sans t'occuper de l'unité.<br><span style="color:#fbbf24">Les volumes, surfaces, cubatures et prix sont recalculés à la nouvelle taille.</span></div>
                <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px"><b>Garder la taille réelle</b> — rien ne bouge, seuls les nombres affichés changent (12 ${uOld} s'affichent ${(12 / f).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${uNew}).</div></div>`,
                [['Garder la taille réelle', () => { gridMm = gOld; try { localStorage.setItem('momocad-grid-mm', String(gridMm)); } catch (e) {} refreshGridField(); closeTopoModal(); draw(); updateCommandMessageText('UNITÉ : ' + uNew + ' — taille réelle conservée.'); }, false],
                 ['Garder les nombres', () => { scaleDrawing(f); closeTopoModal(); updateCommandMessageText('UNITÉ : ' + uNew + ' — les nombres sont conservés, le dessin est ' + (big ? f + ' fois plus grand' : 1 / f + ' fois plus petit') + ' en vrai (Ctrl+Z pour annuler).'); }, true]]);
        }
        // tout le dessin × f, en plan ET en hauteur (altitudes, hauteurs, profils, ouvertures…), autour de l'origine
        function scaleDrawing(f) {
            const zk = (o, k) => { if (o && typeof o[k] === 'number' && isFinite(o[k])) o[k] *= f; };
            shapes.forEach(s => {
                applyScaleToShape(s, 0, 0, f);
                ['z', 'z1', 'z2', 'z0'].forEach(k => zk(s, k));
                (s.points || []).forEach(q => zk(q, 'z')); holesOf(s).forEach(h => h.forEach(q => zk(q, 'z')));
                if (s.wz) { zk(s.wz, 'b'); zk(s.wz, 't'); }
                if (s.solid) { ['H', 'e', 'eg', 'a', 'r'].forEach(k => zk(s.solid, k)); if (Array.isArray(s.solid.prof)) s.solid.prof = s.solid.prof.map(q => [q[0] * f, q[1] * f]); }
                if (s.sweep) { zk(s.sweep, 'dz'); zk(s.sweep, 'zf'); if (s.sweep.d) Object.keys(s.sweep.d).forEach(k => zk(s.sweep.d, k)); }
                (s.openings || []).forEach(o => { (o.pts || []).forEach(q => { q.x *= f; q.y *= f; }); ['sill', 'h', 'w'].forEach(k => zk(o, k)); });
                if (s.type === 'mesh' && s.bb) { /* s.sc déjà multiplié : la boîte suit */ }
            });
            geoOrigin = { x: geoOrigin.x * f, y: geoOrigin.y * f };
            camera.zoom /= f;   // la vue reste cadrée pareil
            invalidateCache(); try { sweepCache && sweepCache.clear && sweepCache.clear(); } catch (e) {} saveState(); draw(); try { refresh3D(); } catch (e) {}
        }
        function setGridCm(v) {
            const g = parseFloat(String(v).replace(',', '.'));
            if (g > 0) { gridMm = g * (UNIT_MM[currentUnit] || 1); try { localStorage.setItem('momocad-grid-mm', String(gridMm)); } catch (e) {} }
            refreshGridField();
            draw();
        }
