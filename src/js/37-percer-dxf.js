        // ---- Percer / découper : une forme fermée évide un volume de part en part ----
        let pierceTarget = null;
        function pierceRing(x) { return x.type === 'circle' ? Array.from({ length: 48 }, (_, i) => ({ x: x.x + x.r * Math.cos(2 * Math.PI * i / 48), y: x.y + x.r * Math.sin(2 * Math.PI * i / 48) })) : x.points.map(q => ({ x: q.x, y: q.y })); }
        // forme fermée sous le curseur : bord (findShapeAt) ou intérieur (la plus petite qui contient le point)
        function closedAt(w, pred) {
            const t = findShapeAt(w.x, w.y); if (t && pred(t)) return t;
            let best = null, ba = Infinity;
            shapes.forEach(x => { if (!pred(x)) return; const l = layers.find(lx => lx.id === (x.layerId || 'layer-0')); if (l && l.visible === false) return;
                const ring = x.type === 'circle' ? pierceRing(x) : x.type === 'poly' && !x.open ? x.points : null; if (!ring || !pointInPolygon(w.x, w.y, ring)) return;
                const a = Math.abs(polyArea(ring)); if (a < ba) { ba = a; best = x; } });
            return best;
        }
        const isClosed2D = (x) => !x.solid && !x.gen && ((x.type === 'poly' && !x.open && x.points.length >= 3) || x.type === 'circle');
        // prisme vertical (triangles en mm, repère réel) d'une forme fermée, de z0 à z1 (mm)
        function prismTrisMM(ring, z0, z1) {
            let P = ring.map(q => [worldToMm(q.x), -worldToMm(q.y)]); if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
            if (polyArea(P.map(q => ({ x: q[0], y: q[1] }))) < 0) P.reverse();
            const T = [], f = THREE.ShapeUtils.triangulateShape(P.map(q => new THREE.Vector2(q[0], q[1])), []);
            f.forEach(([a, b, c]) => { T.push(P[a][0], P[a][1], z1, P[b][0], P[b][1], z1, P[c][0], P[c][1], z1); T.push(P[a][0], P[a][1], z0, P[c][0], P[c][1], z0, P[b][0], P[b][1], z0); });
            for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; T.push(A[0], A[1], z0, B[0], B[1], z0, B[0], B[1], z1, A[0], A[1], z0, B[0], B[1], z1, A[0], A[1], z1); }
            const t = new Float64Array(T); if (signedVol(t) < 0) flipTris(t); return t;
        }
        function pierceCSG(ring, src) {
            if (!window.THREE) { updateCommandMessageText('PERCER : chargement du moteur 3D…'); loadThree().then(() => pierceCSG(ring, src)); return; }
            const A = pierceTarget, ta = objTrisMM(A); if (!ta) { updateCommandMessageText('PERCER : ce volume n\'a pas de géométrie 3D.'); return; }
            let z0 = Infinity, z1 = -Infinity; for (let i = 2; i < ta.length; i += 3) { z0 = Math.min(z0, ta[i]); z1 = Math.max(z1, ta[i]); }
            let r; try { r = csgTris(ta, prismTrisMM(ring, z0 - 50, z1 + 50), 'sub'); } catch (e) { updateCommandMessageText('PERCER : calcul impossible (' + e.message + ').'); return; }
            if (!r.length) { updateCommandMessageText('PERCER : il ne resterait rien du volume.'); return; }
            if (Math.abs(Math.abs(signedVol(r)) - Math.abs(signedVol(ta))) < 1) { updateCommandMessageText('PERCER : la forme ne touche pas le volume. Placez-la sur lui, vue de dessus.'); return; }
            const res = meshFromTris(r, A); res.name = A.name || 'Volume percé'; if (A.tex) res.tex = A.tex;
            shapes = shapes.filter(x => x !== A && x !== src); shapes.push(res); pierceTarget = res; selectedShapes = [res];
            saveState(); draw(); try { refresh3D(); } catch (e) {}
            updateCommandMessageText('PERCER : trou creusé de part en part (' + nfr(meshVolume(res), 3) + ' m³ restants). Cliquez une autre forme à évider, ou Échap.');
        }
        function holesOf(s) { return (s.solid && s.solid.holes) || []; }
        // points qui suivent l'objet quand on le déplace, tourne, met à l'échelle ou en miroir : trous, et ouvertures (portes, fenêtres) portées par un mur
        function xPtsOf(s) { const out = holesOf(s).slice(); (s.cuts || []).forEach(c => out.push([c.a, c.b, c.k])); if (s.wp && s.wp.P) out.push(s.wp.P); (s.openings || []).forEach(o => { if (o.pts) out.push(o.pts); const ab = [o.a, o.b].filter(Boolean); if (ab.length) out.push(ab); }); return out; }
        function solidBaseZ(s) { return s.type === 'circle' ? s.z : s.points[0].z; }
        function setMode(newMode) {
            { const tp = document.getElementById('t2-panel'); if (tp && tp.dataset.kind === 'veg' && tp.style.display !== 'none' && newMode !== 'poly') t2PanelClose(); }
            if (newMode !== 'poly' && typeof bldDrawing !== 'undefined') bldDrawing = false;
            if (newMode !== 'opstretch' && typeof opStretch !== 'undefined' && opStretch) { opStretch = null; openSel = null; }
            t2Reset(newMode);
            if (typeof isOrthoView === 'function' && isOrthoView() && !view2dAnim && newMode !== 'select-box') { view2d = { a: 0, e: 90 }; orthoCenterCamera(); }
            if (!(fondTool && ((fondTool.t === 'filante' && newMode === 'pline') || (fondTool.t === 'longrine' && newMode === 'line') || (fondTool.t === 'isolee' && newMode === 'fond')))) fondTool = null;
            solidTool = null; solidDalle = false; trenchDraw = null; brkDraw = false; stair2Draw = false; ctDraw = null; if (newMode !== 'recoupe') rcp = null; batDraw = false; boisDraw = false; bassinDraw = false; mailDraw = false; if (newMode !== 'point') mailSond = false; mailZoneDraw = false; brushPolyDraw = false; batBar(true); if (piW && document.getElementById('pi-wiz')) setTimeout(() => { if (piW && piW.steps[piW.i] !== 'lay') piWRender(); }, 0); waterDraw = false; filletA = filletB = null; pierceTarget = null; if (newMode !== 'bool') { boolKind = null; boolA = null; } if (newMode !== 'opening') { openA = null; openWall = null; } stretchWin = stretchA = stretchBase = null; if (newMode !== 'wall') { if (mode === 'wall' && wallChain) wallChainEnd(); wallTool = null; wallStart = null; wallChain = null; } if (newMode !== 'pen') { penPts = []; penDrag = null; } if (newMode !== 'mirror') { mirrorA = mirrorB = null; } if (newMode !== 'select-box') mirrorPending = false; if (newMode !== 'stamp' && typeof stamp !== 'undefined') stamp = null; if (newMode !== 'bmplace' && typeof bmPlace !== 'undefined' && bmPlace) { clearTimeout(bmPlace.timer); bmPlace = null; }
            if (typeof is3DOpen === 'function' && is3DOpen() && !D3_MODES.has(newMode)) close3D();   // les autres outils ramènent au plan 2D
            if (typeof d3Reset === 'function') d3Reset();
            if (typeof CL2 !== 'undefined') { CL2.dir = null; CL2.base = null; CL2.typed = ''; CUT.a = CUT.b = null; }
            mode = newMode; flashUntil = 0;   // un nouvel outil remplace le message temporaire
            if (typeof is3DOpen === 'function' && is3DOpen() && newMode !== 'select-box' && D3_MODES.has(newMode)) setTimeout(() => { if (mode === newMode) d3Start(); }, 0);
            { const b = document.getElementById('v3-mes-btn'); if (b) b.style.boxShadow = newMode === 'measure' ? '0 0 0 2px #22d3ee' : ''; }
            moveBasePoint = null; isMovingObjects = false; isDrawing = false; moveTypedX = null;
            dimStep = 0; dimChainInfo = null; rotateCenter = null; isRotatingObjects = false; typedInput = "";
            calTarget = null; calP1 = null; calP2 = null; gcal = null; lastTopo = null; slopeP1 = null; profileAxis = [];
            arcStep = 0; arcCenter = null; arcP1 = null;
            scaleCenter = null; scaleRefDist = 0; isScalingObjects = false;
            rectDimStep = 0; rectWidthVal = 0;
            detailStep = 0; detailTarget = null; detailLabelPos = null;
            if (inlineEdit) { const _ta = document.getElementById('inline-editor'); _ta.classList.add('hidden'); _ta.value=''; inlineEdit = null; }
            offsetTarget = null; offsetPreviewShape = null;
            dimAngleStep = 0; dimAngleLine1 = null; dimAngleLine2 = null; dimAngleIntersect = null;
            closeTextModal(); closeLayerModal(); closeCartoucheModal(); closeSnapModal(); closeHelpModal();
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            const btn = document.getElementById('btn-' + (newMode === 'wall' && blkParois ? 'paroi' : newMode)); if (btn) btn.classList.add('active'); markActivePal();
            if (newMode !== 'lpvp' && newMode !== 'lpvpc' && newMode !== 'lpimg') lpVpStart = null;
            canvas.style.cursor = (['move', 'rotate', 'scale-up', 'scale-down', 'select-box', 'text', 'print', 'preview', 'trim', 'extend', 'paste', 'offset'].includes(mode)) ? 'default' : 'crosshair';
            previewPin = null;
            if (newMode === 'print' || newMode === 'preview') {
                // Facteur d'agrandissement courant déduit du zoom caméra, puis snap
                // sur l'échelle la plus proche dans PRINT_SCALES.
                const base = printBaseZoom();              // zoom correspondant au 1:1
                const curFactor = camera.zoom / base;
                let ci = 0, md = Infinity;
                for (let i=0; i<PRINT_SCALES.length; i++) {
                    let d = Math.abs(PRINT_SCALES[i].factor - curFactor);
                    if (d < md) { md = d; ci = i; }
                }
                printScaleIndex = ci;
                currentPrintScale = PRINT_SCALES[ci].label;
                camera.zoom = base * PRINT_SCALES[ci].factor;
                let cx = canvas.width/2, cy = canvas.height/2; let wp = {x:(cx-camera.x)/camera.zoom, y:(cy-camera.y)/camera.zoom};
                camera.x = cx - wp.x*camera.zoom; camera.y = cy - wp.y*camera.zoom;
            }
            draw();
        }

        function updateSelectedProperties() {
            if (selectedShapes.length > 0) {
                selectedShapes.forEach(s => {
                    s.color = document.getElementById('prop-color').value;
                    if (s.type !== 'dim' && s.type !== 'text' && s.type !== 'dim-angle' && s.type !== 'dimr') s.dash = document.getElementById('prop-dash').value;
                    if (s.type === 'text') s.size = (parseFloat(document.getElementById('prop-width').value) || 1) * 20;
                    else s.width = parseFloat(document.getElementById('prop-width').value) || 1;
                    s.layerId = activeLayerId;
                });
                saveState(); draw();
            }
        }

        // ===== DXF =====
        // ============ EXPORT / IMPORT DXF (échelle 1:1, 1 unité DXF = 1 mm) ============
        // Conventions de conversion :
        //   - px monde -> mm : diviser par MM_TO_WORLD (= GRID_SIZE/unitsPerSquare, soit 5 si 10mm/carré)
        //   - L'axe Y est INVERSÉ entre le canvas (Y bas) et le DXF (Y haut).
        function worldToMm(v) { return v / (GRID_SIZE / mmPerSquareUnit()); }
        function mmToWorld(v) { return v * (GRID_SIZE / mmPerSquareUnit()); }
        function layerDxfName(id) {
            const l = layers.find(x => x.id === id);
            // Nom de calque DXF : on garde le nom réel, seuls les caractères interdits par AutoCAD sont remplacés
            return l ? (l.name.replace(/[<>\/\\":;?*|=`]/g, '_').trim() || '0') : '0';
        }

        // ===== Conversions style DXF (couleur/type/épaisseur) =====
        // ===== Conversion couleur HEX <-> ACI (AutoyCAD Color Index) =====
        // Palette ACI standard (les 9 premières + quelques courantes). On mappe au plus proche.
        const ACI_PALETTE = {
            1: [255,0,0],     // rouge
            2: [255,255,0],   // jaune
            3: [0,255,0],     // vert
            4: [0,255,255],   // cyan
            5: [0,0,255],     // bleu
            6: [255,0,255],   // magenta
            7: [255,255,255], // blanc/noir (selon fond)
            8: [128,128,128], // gris
            9: [192,192,192], // gris clair
            30:[255,127,0],   // orange
            250:[51,51,51],   // gris foncé
        };
        function hexToRgb(hex) {
            hex = (hex||'#ffffff').replace('#','');
            if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
            return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
        }
        function rgbToHex(r,g,b){ return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
        function hexToAci(hex) {
            const [r,g,b] = hexToRgb(hex);
            let best = 7, bestD = Infinity;
            for (const aci in ACI_PALETTE) {
                const [pr,pg,pb] = ACI_PALETTE[aci];
                const d = (r-pr)**2 + (g-pg)**2 + (b-pb)**2;
                if (d < bestD) { bestD = d; best = parseInt(aci,10); }
            }
            return best;
        }
        function aciToHex(aci) {
            const p = ACI_PALETTE[aci];
            return p ? rgbToHex(p[0],p[1],p[2]) : '#ffffff';
        }
        // ===== Type de ligne app <-> DXF =====
        function dashToDxf(dash) {
            if (dash === 'dashed' || dash === 'text') return 'DASHED';
            if (dash === 'center') return 'CENTER';
            return 'CONTINUOUS';
        }
        function dxfToDash(lt) {
            if (!lt) return 'solid';
            lt = lt.toUpperCase();
            if (lt.includes('DASH')) return 'dashed';
            if (lt.includes('CENTER')) return 'center';
            return 'solid';
        }
        // ===== Épaisseur app <-> lineweight DXF (code 370, en 1/100 mm) =====
        // Notre "width" est un multiplicateur d'affichage. On l'exporte en 1/100 mm
        // avec une base raisonnable : width 1 -> 0.25mm (25), width 2 -> 0.50mm (50)...
        // AutoCAD n'accepte que ces épaisseurs (en 1/100 mm) : on prend la plus proche.
        const DXF_LINEWEIGHTS = [0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106,120,140,158,200,211];
        function widthToLineweight(w) {
            const t = (w||1) * 25; let best = 25, bd = Infinity;
            for (const v of DXF_LINEWEIGHTS) { const d = Math.abs(v - t); if (d < bd) { bd = d; best = v; } }
            return best;
        }
        function lineweightToWidth(lw) { return Math.max(0.1, (lw||25) / 25); }


        // --- Encodage des textes DXF : caractères non ASCII en \U+XXXX (compris par AutoCAD) ---
        const DXF_TPL_META = {"handseed": "35", "layerTable": "1", "baseLayerCount": 2, "plotStyle": "13", "tplLayers": ["0", "Defpoints"], "msp": "17"};
        function dxfStr(s) {
            let out = '';
            for (const ch of String(s)) {
                const cp = ch.codePointAt(0);
                if (cp < 32) continue;                       // pas de caractères de contrôle
                out += (cp > 126 && !cp1252Byte(ch)) ? '\\U+' + cp.toString(16).toUpperCase().padStart(4, '0') : ch;
            }
            return out;
        }
        // Windows-1252 : encodage natif des DXF R2000 ($DWGCODEPAGE = ANSI_1252)
        const CP1252_EXTRA = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
        function cp1252Byte(ch) {
            const cp = ch.codePointAt(0);
            if (cp < 0x80 || (cp >= 0xA0 && cp <= 0xFF)) return cp;
            return CP1252_EXTRA[cp] || null;
        }
        function objMetaFromDXF(sh, xd) {   // tranchée / niveau d'eau relus du DXF
            if (!xd || !(xd.includes('tranchee') || xd.includes('eau'))) return;
            try { const o = JSON.parse(decodeURIComponent(xd.filter(v => String(v).startsWith('j=')).map(v => String(v).slice(2)).join('')));
                if (o.trench) { sh.trench = o.trench; sh.name = o.trench.name || sh.name; sh.open = true; sh.zk = 1; (o.pts || []).forEach((a, i) => { const q = sh.points[i]; if (!q) return; if (a[0] !== '') q.feM = +a[0]; if (a[1] !== '') q.tM = +a[1]; if (a[2]) q.reg = true; if (a[3] !== '') q.regD = +a[3]; }); delete sh.elev; }
                if (o.water) { sh.water = o.water; sh.name = o.water.name || sh.name; sh.zk = 1; sh.points.forEach(q => { delete q.z; }); delete sh.elev; }
            } catch (e) { console.warn('xdata MOMOCAD illisible', e); }
        }
        function platMetaFromDXF(sh, xd) {
            objMetaFromDXF(sh, xd);
            if (!xd || !xd.includes('plateforme')) return;
            xd.forEach(v => { v = String(v);
                if (v.startsWith('nom=')) sh.pfName = dxfDecode(v.slice(4));
                else if (v.startsWith('talus=')) { const a = v.slice(6).split(';'); sh.talus = { ...(sh.talus || {}), on: a[0] !== '0', kR: a[1] || '3/2', kD: a[2] || '1/1', pts: a[3] !== '0', esp: isFinite(parseFloat(a[4])) ? parseFloat(a[4]) : 10 }; }
                else if (v.startsWith('trecul=')) { sh.talus = Object.assign({}, sh.talus, { R: +v.slice(7) || 0 }); }
                else if (v === 'tcx') { sh.talus = Object.assign({}, sh.talus, { cx: true }); }
                else if (v.startsWith('tcorn=')) { const c = {}; v.slice(6).split(';').forEach(x => { const [k, d] = x.split(':'); if (isFinite(parseInt(k, 10))) c[parseInt(k, 10)] = d === 'auto' ? null : +d; }); sh.talus = Object.assign({}, sh.talus, { corn: c }); }
                else if (v.startsWith('tedge=')) { const a = v.slice(6).split(';'), i = parseInt(a[0], 10); if (isFinite(i)) { const e = {}; if (a[1]) e.kR = a[1]; if (a[2]) e.kD = a[2]; if (a[3] !== '' && a[3] !== undefined) e.R = +a[3]; if (a[4] !== '' && a[4] !== undefined) e.zf = +a[4]; if (a[5] === '1') e.off = true; if (a[6]) e.name = decodeURIComponent(a[6]); if (a[7]) e.pl = decodeURIComponent(a[7]); if (a[8]) { const q = a[8].split(','); if (+q[0] > 0 && +q[1] > 0) { e.st = { h: +q[0], g: +q[1], nez: +q[2] || 0 }; if (q[3]) e.st.mat = q[3]; } }
                    sh.talus = Object.assign({}, sh.talus); sh.talus.edges = sh.talus.edges || []; sh.talus.edges[i] = e; } }
                else if (v.startsWith('rp=')) { const a = v.slice(3).split(';'); sh.cubRP = { on: a[0] === '1' }; if (a[1]) sh.cubRP.z = +a[1]; if (a[2] === 'tn' || a[2] === 'none') sh.cubRP.mode = a[2]; }
                else if (v === 'incl') sh.plat = true; else if (v === 'cuboff') sh.cubOff = true;
                else if (v.startsWith('struct=')) { const a = v.slice(7).split('|'); const L = a.slice(1).map(t => { const [mat, e, coef, d] = t.split(':'); const l = { mat: MAT_OLD[mat] || mat, e: parseFloat(e) || 0 }; if (coef !== '' && isFinite(parseFloat(coef))) l.coef = parseFloat(coef); if (d !== '' && d !== undefined && isFinite(parseFloat(d))) l.d = parseFloat(d); return l; }); if (L.length) sh.struct = { ff: a[0] !== '0', layers: L }; } });
            delete sh.elev;
        }
        // nom abîmé par un passage dans un mauvais encodage (« Paroi b�ton ») : on retrouve le nom MomoCAD connu qui correspond
        function fixLostAccents(name) {
            if (!name || name.indexOf('\uFFFD') < 0) return name;
            const known = ['Limite de propriété', 'Niveau terrain naturel', 'Réseaux', 'Tranchées', 'Coupes', 'Façades'].concat(Object.values(WALL_MATS).map(M => 'Paroi ' + M.name.toLowerCase()), layers.map(l => l.name));
            const re = new RegExp('^' + name.split('\uFFFD').map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{1,2}') + '$', 'i');
            return known.find(k => re.test(k)) || name.replace(/\uFFFD/g, 'e');
        }
        // objets du bâtiment et volumes : leurs réglages ne tiennent pas dans les entités DXF, ils voyagent en données MomoCAD
        function isRichObj(s) { if (s && s.type === 'mesh') { const v = meshStore[s.meshId]; return !!(v && v.length <= 90000); }
            return !!(s && !s.trench && !s.water && (s.wallMat || s.wz || s.solid || s.roofDef || (s.openings && s.openings.length))); }
        // convertit toutes les coordonnées d'un objet (points {x, y}, x1/y1, x2/y2) avec fx / fy ; le reste est gardé tel quel
        function dxfGeoMap(o, fx, fy) {
            const walk = (v) => { if (Array.isArray(v)) { v.forEach(walk); return; } if (!v || typeof v !== 'object') return;
                if (typeof v.x === 'number' && typeof v.y === 'number') { v.x = fx(v.x); v.y = fy(v.y); }
                [['x1', 'y1'], ['x2', 'y2']].forEach(([a, b]) => { if (typeof v[a] === 'number' && typeof v[b] === 'number') { v[a] = fx(v[a]); v[b] = fy(v[b]); } });
                for (const k in v) if (v[k] && typeof v[k] === 'object') walk(v[k]); };
            walk(o); return o;
        }
        function encodeCp1252(str) {
            const bytes = new Uint8Array(str.length); let n = 0;
            for (const ch of str) { const b = cp1252Byte(ch); bytes[n++] = (b === null) ? 63 : b; }
            return bytes.subarray(0, n);
        }
        function dxfDecode(s) {
            return String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCodePoint(parseInt(h, 16)));
        }

        // Export DXF R2000 (AC1015) complet, lisible par AutoCAD :
        // gabarit fixe (en-tête, tables, blocs, objets) + calques et entités générés,
        // chaque objet avec son identifiant (handle) et son propriétaire (Model_Space).
        // les talus générés (pied, peigne, points nez / pied) partent sur un calque à part, pour qu'un autre logiciel
        // (Covadis…) ne les prenne pas pour du terrain naturel
        const TALUS_DXF_LAYER = { id: '__talus', name: 'TALUS_GENERE_MomoCAD', visible: true, color: '#a3a3a3', dash: 'solid', width: 0.5 };
        let dxfPaperPS = null;
        function exportDXF() { dxfPaperPS = lpPaperShapes(); return withModel(() => { const add = shapes.some(isPlateforme) && !layers.some(l => l.id === '__talus'); if (add) layers.push(TALUS_DXF_LAYER); try { return _exportDXF(); } finally { if (add) layers = layers.filter(l => l.id !== '__talus'); } }); }
        function _exportDXF() {
            const M = DXF_TPL_META;
            const tpl = document.getElementById('dxf-r2000-template').textContent.replace(/^\s*\n/, '');
            let hnd = parseInt(M.handseed, 16);
            const H = () => (hnd++).toString(16).toUpperCase();
            const num = (v) => { const r = Math.round(v * 1e6) / 1e6; return (Object.is(r, -0) ? 0 : r).toString(); };
            // unité du dessin (m, cm, mm) : toutes les coordonnées, altitudes et longueurs du DXF sont écrites dans cette unité
            const U = 1 / (UNIT_MM[currentUnit] || 1), Lu = (mm) => mm * U;
            // textes « variables » (taille constante à l'écran) : hauteur papier × échelle de présentation (fenêtres, impression rapide, sinon 1:200)
            const annS = (() => { const v = (layoutData.vps || []).filter(q => q.kind !== 'img').map(q => q.scale); if (v.length) return arrMax(v); const m = /^1:(\d+)/.exec(currentPrintScale || ''); return m && +m[1] > 1 ? +m[1] : 200; })();
            const X = (v) => (worldToMm(v) + geoOrigin.x) * U;
            const Y = (v) => (-worldToMm(v) + geoOrigin.y) * U;   // l'axe Y est inversé entre l'écran et le DXF ; + origine géoréférencée
            const ZZ = (z) => hasZ(z) ? num(z * U) : 0;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const ext = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
            const ltName = (dash) => dash === 'dashed' ? 'DASHED' : (dash === 'center' ? 'CENTER' : 'Continuous');

            // ---- Calques ----
            const LL = []; const lp = (code, v) => { LL.push(String(code).padStart(3, ' ')); LL.push(String(v)); };
            const used = new Set(M.tplLayers.map(n => n.toLowerCase()));
            let layerCount = M.baseLayerCount;
            for (const l of layers) {
                const nm = layerDxfName(l.id);
                if (used.has(nm.toLowerCase())) continue;
                used.add(nm.toLowerCase());
                const aci = hexToAci(l.color || '#ffffff');
                lp(0, 'LAYER'); lp(5, H()); lp(330, M.layerTable);
                lp(100, 'AcDbSymbolTableRecord'); lp(100, 'AcDbLayerTableRecord');
                lp(2, dxfStr(nm)); lp(70, 0);
                lp(62, l.visible === false ? -aci : aci);   // couleur négative = calque éteint
                lp(6, ltName(l.dash)); lp(370, widthToLineweight(l.width || 1)); lp(390, M.plotStyle);
                // réglages propres à MomoCAD (texte variable/fixe, motif de hachure), relus à l'import
                lp(1001, 'MOMOCAD'); lp(1000, 'textH=' + (parseFloat(l.textH) > 0 ? parseFloat(l.textH) : '') + ';hatch=' + (l.hatch || 'lines') + ';hscale=' + layerHatchScaleOf(l) + (l.dash === 'text' ? ';lt=text;ltt=' + encodeURIComponent(l.ltText || '') : '') + (l.group !== undefined ? ';grp=' + encodeURIComponent(l.group) : ''));
                layerCount++;
            }

            // ---- Entités (style "DuCalque" : couleur, type et épaisseur viennent du calque) ----
            const E = []; const p = (code, v) => { E.push(String(code).padStart(3, ' ')); E.push(String(v)); };
            // une annotation (cote…) part en traits + texte lisibles partout ; sa 1re entité porte l'objet MomoCAD complet, les autres sont marquées « objpart » pour ne pas revenir en double
            let annot = null, tagNext = null;
            const flushTag = () => { if (tagNext) { p(1001, 'MOMOCAD'); tagNext.forEach(v => p(1000, v)); tagNext = null; } };
            const annotStart = (s, keys) => { const o = JSON.parse(JSON.stringify(s)); delete o.layerId; delete o.groupId;
                keys.forEach(k => { const [kx, ky] = k; if (typeof o[kx] === 'number') { o[kx] = X(o[kx]); o[ky] = Y(o[ky]); } else if (o[kx] && typeof o[kx].x === 'number') { o[kx] = { x: X(o[kx].x), y: Y(o[kx].y) }; } });
                const j = encodeURIComponent(JSON.stringify(o)), ch = ['annot']; for (let k = 0; k < j.length; k += 230) ch.push('j=' + j.slice(k, k + 230)); annot = { first: ch, n: 0 }; };
            const annotEnd = () => { flushTag(); annot = null; };
            // objet MomoCAD « riche » (paroi, dalle, toiture, poutre, ouvertures…) : exporté en traits lisibles partout, et l'objet complet voyage avec sa 1re entité
            const richStart = (s) => { const o = dxfGeoMap(JSON.parse(JSON.stringify(s)), X, Y); delete o.layerId; o.__rich = 1;
                if (s.type === 'mesh') o.__mv = Array.from(meshStore[s.meshId], v => Math.round(v * 1000) / 1000);   // sommets du maillage (repère propre, en mm)
                const j = encodeURIComponent(JSON.stringify(o)), ch = ['annot']; for (let k = 0; k < j.length; k += 230) ch.push('j=' + j.slice(k, k + 230)); annot = { first: ch, n: 0 }; };
            const head = (type, s) => {
                flushTag(); if (annot) tagNext = annot.n++ ? ['objpart'] : annot.first;
                p(0, type); p(5, H()); p(330, M.msp); p(100, 'AcDbEntity');
                p(8, dxfStr(layerDxfName(s.layerId || 'layer-0')));
            };
            const line = (s, x1, y1, x2, y2, z1, z2) => {
                head('LINE', s); p(100, 'AcDbLine');
                p(10, num(X(x1))); p(20, num(Y(y1))); p(30, ZZ(z1));
                p(11, num(X(x2))); p(21, num(Y(y2))); p(31, ZZ(z2));
                ext(X(x1), Y(y1)); ext(X(x2), Y(y2));
            };
            // plateforme : nom, talus, inclinaison et case des cubatures en XDATA (relus à l'ouverture du DXF)
            const objMetaDXF = (s) => {   // tranchée / niveau d'eau : réglages complets en JSON découpé (1000 = 255 caractères max)
                const tag = s.trench ? 'tranchee' : s.water ? 'eau' : null; if (!tag) return false;
                const j = encodeURIComponent(JSON.stringify(s.trench ? { trench: s.trench, pts: s.points.map(q => [hasZ(q.feM) ? q.feM : '', hasZ(q.tM) ? q.tM : '', q.reg ? 1 : 0, hasZ(q.regD) ? q.regD : '']) } : { water: s.water }));
                p(1001, 'MOMOCAD'); p(1000, tag); for (let k = 0; k < j.length; k += 230) p(1000, 'j=' + j.slice(k, k + 230)); return true; };
            const platMetaDXF = (s) => { const t = platTalus(s); p(1001, 'MOMOCAD'); p(1000, 'plateforme');
                if (s.pfName) p(1000, 'nom=' + dxfStr(s.pfName)); p(1000, 'talus=' + [t.on ? 1 : 0, t.kR, t.kD, t.pts ? 1 : 0, t.esp].join(';'));
                if (t.R) p(1000, 'trecul=' + t.R); if (t.cx) p(1000, 'tcx'); if (t.corn && Object.keys(t.corn).length) p(1000, 'tcorn=' + Object.keys(t.corn).map(k => k + ':' + (t.corn[k] === null ? 'auto' : t.corn[k])).join(';'));
                (t.edges || []).forEach((e, i) => { if (!e) return; p(1000, 'tedge=' + [i, e.kR || '', e.kD || '', e.R !== undefined ? e.R : '', hasZ(e.zf) ? e.zf : '', e.off ? 1 : 0, encodeURIComponent(e.name || ''), encodeURIComponent(e.pl || ''), e.st ? [e.st.h, e.st.g, e.st.nez || 0, e.st.mat || ''].join(',') : ''].join(';')); });
                if (s.cubRP) p(1000, 'rp=' + (s.cubRP.on ? 1 : 0) + ';' + (hasZ(s.cubRP.z) ? s.cubRP.z : '') + (s.cubRP.mode ? ';' + s.cubRP.mode : ''));
                if (s.plat) p(1000, 'incl'); if (s.cubOff) p(1000, 'cuboff');
                if (s.struct && s.struct.layers.length) p(1000, 'struct=' + (s.struct.ff === false ? 0 : 1) + '|' + s.struct.layers.map(l => [l.mat, +l.e || 0, l.coef !== undefined ? l.coef : '', l.d !== undefined ? l.d : ''].join(':')).join('|')); };
            const talusDXF = (s) => {   // talus d'une plateforme : pied de talus et peigne (traits 3D marqués MOMOCAD/talus)
                const TG = isPlateforme(s) ? talusGeom(s) : null; if (!TG) return;
                s = Object.assign({}, s, { layerId: '__talus' });
                const tl = (a, b) => { line(s, a.x, a.y, b.x, b.y, a.z, b.z); p(1001, 'MOMOCAD'); p(1000, 'talus'); };
                (TG.toeParts || []).forEach(pt => pt.forEach((a, i) => { if (i) tl(pt[i - 1], a); })); TG.ticks.forEach(([a, b]) => tl(a, b));
                const h = Lu(layerTextH(s.layerId) || 1.5 * annS);
                TG.marks.forEach(m => [m.nez, m.pied].forEach(q => {
                    head('POINT', s); p(100, 'AcDbPoint'); p(10, num(X(q.x))); p(20, num(Y(q.y))); p(30, ZZ(q.z)); p(1001, 'MOMOCAD'); p(1000, 'talus');
                    text(s, X(q.x) + h * 0.6, Y(q.y) + h * 0.3, h, fmtZ(q.z), 0); p(1001, 'MOMOCAD'); p(1000, 'zlabel');
                }));
            };
            const text = (s, x, y, h, str, rotDeg) => {
                head('TEXT', s); p(100, 'AcDbText');
                p(10, num(x)); p(20, num(y)); p(30, 0); p(40, num(h));
                p(1, dxfStr(str));
                if (rotDeg) p(50, num(rotDeg));
                p(100, 'AcDbText');
                ext(x, y); ext(x + h * String(str).length * 0.7, y + h);
            };
            const hatch = (s) => {
                // contours : hachure-objet (avec îlots), polygone, ou cercle découpé en 72 côtés
                let loops;
                if (s.loops) loops = s.loops;
                else if (s.type === 'poly') loops = [s.points];
                else if (s.type === 'circle') { loops = [[]]; for (let i = 0; i < 72; i++) { const a = i / 72 * 2 * Math.PI; loops[0].push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); } }
                else return;
                const pattern = layerHatch(s), solid = pattern === 'solid', cross = pattern === 'cross';
                const sp = Lu((s.hatchSpacing || 3) * layerHatchScale(s));
                // l'axe Y est inversé : un angle de 45° à l'écran vaut 135° dans le DXF
                const phi = ((360 - ((s.hatchAngle !== undefined) ? s.hatchAngle : 45)) % 180 + 180) % 180;
                head('HATCH', s); p(100, 'AcDbHatch');
                p(10, 0); p(20, 0); p(30, 0); p(210, 0); p(220, 0); p(230, 1);
                p(2, solid ? 'SOLID' : '_USER'); p(70, solid ? 1 : 0); p(71, 0);
                p(91, loops.length);
                loops.forEach((l, i) => {
                    p(92, i === 0 ? 3 : 2); p(72, 0); p(73, 1); p(93, l.length);
                    for (const q of l) { p(10, num(X(q.x))); p(20, num(Y(q.y))); ext(X(q.x), Y(q.y)); }
                    p(97, 0);
                });
                p(75, 0); p(76, solid ? 1 : 0);
                if (!solid) {
                    p(52, num(phi)); p(41, 1); p(77, cross ? 1 : 0); p(78, cross ? 2 : 1);
                    for (const a of (cross ? [phi, phi + 90] : [phi])) {
                        const r = a * Math.PI / 180;
                        p(53, num(a)); p(43, 0); p(44, 0); p(45, num(-sp * Math.sin(r))); p(46, num(sp * Math.cos(r))); p(79, 0);
                    }
                }
                p(98, 0);
            };

            for (const s of shapes) {
                const lay = layers.find(l => l.id === (s.layerId || 'layer-0'));
                const rich = isRichObj(s); if (rich) richStart(s);
                if (s.type === 'dimr') { annotStart(s, [['x', 'y'], ['ax', 'ay'], ['lx', 'ly']]); t2DimRDXF(s, line, text, Lu, annS, X, Y); annotEnd(); }
                else if (s.type === 'dim-angle') {   // cote d'angle : les deux bras, l'arc et la valeur
                    annotStart(s, [['vertex'], ['p1'], ['p2']]); const v = s.vertex, a1 = Math.atan2(s.p1.y - v.y, s.p1.x - v.x), a2 = Math.atan2(s.p2.y - v.y, s.p2.x - v.x);
                    let d = a2 - a1; while (d < 0) d += 2 * Math.PI; let sa = a1, da = d; if (d > Math.PI) { sa = a2; da = 2 * Math.PI - d; }
                    const R = Math.min(Math.hypot(s.p1.x - v.x, s.p1.y - v.y), Math.hypot(s.p2.x - v.x, s.p2.y - v.y)) * 0.5;
                    line(s, v.x, v.y, s.p1.x, s.p1.y); line(s, v.x, v.y, s.p2.x, s.p2.y);
                    head('ARC', s); p(100, 'AcDbCircle'); p(10, num(X(v.x))); p(20, num(Y(v.y))); p(30, 0); p(40, num(Lu(worldToMm(R)))); p(100, 'AcDbArc');
                    { const A = -sa * 180 / Math.PI, B = -(sa + da) * 180 / Math.PI; p(50, num(((B % 360) + 360) % 360)); p(51, num(((A % 360) + 360) % 360)); }
                    const m = sa + da / 2, h = Lu(layerTextH(s.layerId || DIM_LAYER_ID) || 2.5 * annS), str = dimTxt(s, (da * 180 / Math.PI).toFixed(1) + '°');
                    text(s, X(v.x + Math.cos(m) * R * 1.25), Y(v.y + Math.sin(m) * R * 1.25), h, str, 0);
                    annotEnd();
                }
                else if (s.type === 'dim') {
                    // cote : traits de rappel, ligne de cote, tirets obliques et valeur (texte)
                    const g = dimGeom(s);
                    if (g) { annotStart(s, [['x1', 'y1'], ['x2', 'y2'], ['ox', 'oy']]);
                        const st = dimStyle, P = dimParts(g, st, mmToWorld(annS));
                        const lt = (n) => n === 'dashed' ? ['DASHED', Lu(2.2 * annS) / 10] : n === 'dotted' ? ['DASHED', Lu(0.6 * annS) / 10] : null;
                        const lnT = (a, b, n) => { const t = lt(n); head('LINE', s); if (t) { p(6, t[0]); p(48, num(t[1])); } p(100, 'AcDbLine');
                            p(10, num(X(a.x))); p(20, num(Y(a.y))); p(30, 0); p(11, num(X(b.x))); p(21, num(Y(b.y))); p(31, 0); ext(X(a.x), Y(a.y)); ext(X(b.x), Y(b.y)); };
                        P.ext.forEach(([a, b]) => lnT(a, b, st.ext)); lnT(P.ln[0], P.ln[1], st.line);
                        P.T.forEach(t => {
                            if (t.t === 'seg') lnT(t.a, t.b);
                            else if (t.t === 'open') { lnT(t.pts[0], t.pts[1]); lnT(t.pts[1], t.pts[2]); }
                            else if (t.t === 'tri') { head('SOLID', s); p(100, 'AcDbTrace'); [t.pts[0], t.pts[1], t.pts[2], t.pts[2]].forEach((q, i) => { p(10 + i, num(X(q.x))); p(20 + i, num(Y(q.y))); p(30 + i, 0); ext(X(q.x), Y(q.y)); }); }
                            else { head('CIRCLE', s); p(100, 'AcDbCircle'); p(10, num(X(t.c.x))); p(20, num(Y(t.c.y))); p(30, 0); p(40, num(Lu(worldToMm(t.r)))); }
                        });
                        const h = Lu(layerTextH(s.layerId || DIM_LAYER_ID) || 2.5 * annS), str = dimTxt(s, calculateRealDistance(g.dist));
                        let a = dimTextAligned ? -g.ang : 0;   // degrés DXF (Y vers le haut), jamais à l'envers
                        while (a > Math.PI / 2 + 1e-9) a -= Math.PI; while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
                        const wTxt = h * str.length * 0.6, cx = X(g.mid.x), cy = Y(g.mid.y), ca = Math.cos(a), sa = Math.sin(a);
                        const ox = -wTxt / 2, gp = Lu(dimStyle.txtGap * annS), oy = dimStyle.txtPos === 'above' ? Math.max(h * 0.3, gp) : dimStyle.txtPos === 'below' ? -h - gp : -h / 2;   // texte centré : au-dessus, sur ou sous la ligne
                        text(s, cx + ox * ca - oy * sa, cy + ox * sa + oy * ca, h, str, a * 180 / Math.PI);
                        annotEnd();
                    }
                } else if (s.type === 'line' && s.wall) {
                    wallBands(s, 0, 0).forEach(b => b.pts.forEach((q, i) => { const r2 = b.pts[(i + 1) % 4]; line(s, q[0], q[1], r2[0], r2[1]); }));
                } else if (s.type === 'line') {
                    line(s, s.x1, s.y1, s.x2, s.y2, s.z1, s.z2); if (s.sweep) { p(1001, 'MOMOCAD'); sweepToXD(s).forEach(v => p(1000, v)); }
                } else if (s.type === 'slope') {
                    line(s, s.x1, s.y1, s.x2, s.y2, s.z1, s.z2);
                    const h = Lu(layerTextH(s.layerId || DIM_LAYER_ID) || 2.5 * annS);
                    text(s, (X(s.x1) + X(s.x2)) / 2, (Y(s.y1) + Y(s.y2)) / 2 + h * 0.4, h, slopeLabel(s), 0);
                } else if (s.type === 'point') {
                    // point topo : POINT 3D + altitude en texte (marqué pour ne pas être réimporté en double)
                    head('POINT', s); p(100, 'AcDbPoint'); p(10, num(X(s.x))); p(20, num(Y(s.y))); p(30, ZZ(s.z)); ext(X(s.x), Y(s.y));
                    if (s.mat || s.code) { p(1001, 'MOMOCAD'); if (s.mat) p(1000, 'mat=' + encodeURIComponent(s.mat)); if (s.code) p(1000, 'code=' + encodeURIComponent(s.code)); }
                    if (hasZ(s.z)) { const h = Lu(layerTextH(s.layerId) || 1.5 * annS); text(s, X(s.x) + h * 0.6, Y(s.y) + h * 0.3, h, fmtZ(s.z), 0); p(1001, 'MOMOCAD'); p(1000, 'zlabel'); }
                } else if (s.type === 'circle') {
                    head('CIRCLE', s); p(100, 'AcDbCircle');
                    p(10, num(X(s.x))); p(20, num(Y(s.y))); p(30, ZZ(s.z)); p(40, num(Lu(worldToMm(s.r))));
                    if (isPlateforme(s)) platMetaDXF(s); else if (s.sweep) { p(1001, 'MOMOCAD'); sweepToXD(s).forEach(v => p(1000, v)); }
                    ext(X(s.x) - Lu(worldToMm(s.r)), Y(s.y) - worldToMm(s.r)); ext(X(s.x) + Lu(worldToMm(s.r)), Y(s.y) + worldToMm(s.r));
                    if (s.hatch) hatch(s);
                    talusDXF(s);
                } else if (s.type === 'arc') {
                    // Le DXF trace toujours les arcs dans le sens trigonométrique (Y vers le haut).
                    const a = -s.startAngle * 180 / Math.PI, b = -s.endAngle * 180 / Math.PI;
                    const start = s.anticlockwise ? a : b, end = s.anticlockwise ? b : a;
                    head('ARC', s); p(100, 'AcDbCircle');
                    p(10, num(X(s.x))); p(20, num(Y(s.y))); p(30, ZZ(s.z)); p(40, num(Lu(worldToMm(s.r))));
                    p(100, 'AcDbArc'); p(50, num(((start % 360) + 360) % 360)); p(51, num(((end % 360) + 360) % 360)); if (s.sweep) { p(1001, 'MOMOCAD'); sweepToXD(s).forEach(v => p(1000, v)); }
                    ext(X(s.x) - Lu(worldToMm(s.r)), Y(s.y) - worldToMm(s.r)); ext(X(s.x) + Lu(worldToMm(s.r)), Y(s.y) + worldToMm(s.r));
                } else if (s.type === 'poly' && s.points.some(q => hasZ(q.z)) && (!s.points.every(q => q.z === s.points[0].z) || isPlateforme(s))) {
                    // altitudes différentes selon les sommets : vraie polyligne 3D
                    const ph = H(), lay = dxfStr(layerDxfName(s.layerId || 'layer-0'));
                    p(0, 'POLYLINE'); p(5, ph); p(330, M.msp); p(100, 'AcDbEntity'); p(8, lay);
                    p(100, 'AcDb3dPolyline'); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, s.open ? 8 : 9);
                    if (isPlateforme(s)) platMetaDXF(s);
                    else if (objMetaDXF(s)) {}
                    else if (s.sweep) { p(1001, 'MOMOCAD'); sweepToXD(s).forEach(v => p(1000, v)); }
                    for (const pt of s.points) {
                        p(0, 'VERTEX'); p(5, H()); p(330, ph); p(100, 'AcDbEntity'); p(8, dxfStr(layerDxfName(s.layerId || 'layer-0')));
                        p(100, 'AcDbVertex'); p(100, 'AcDb3dPolylineVertex'); p(10, num(X(pt.x))); p(20, num(Y(pt.y))); p(30, ZZ(pt.z)); p(70, 32);
                        ext(X(pt.x), Y(pt.y));
                    }
                    p(0, 'SEQEND'); p(5, H()); p(330, ph); p(100, 'AcDbEntity'); p(8, lay);
                    if (s.hatch) hatch(s);
                    talusDXF(s);
                } else if (s.type === 'pdfvec' && vecStore[s.vecId]) {   // tracés PDF : une polyligne par trait
                    const v = vecStore[s.vecId], m = vecM(s); for (let q = 0; q < v.st.length - 1; q++) { const a = v.st[q], b = v.st[q + 1]; if (b - a < 2) continue;
                        head('LWPOLYLINE', s); p(100, 'AcDbPolyline'); p(90, b - a); p(70, v.cl[q] ? 1 : 0); for (let k = a; k < b; k++) { const w = vecW(m, v.xy[2 * k], v.xy[2 * k + 1]); p(10, num(X(w.x))); p(20, num(Y(w.y))); ext(X(w.x), Y(w.y)); } }
                } else if (s.type === 'poly') {
                    head('LWPOLYLINE', s); p(100, 'AcDbPolyline'); p(90, s.points.length); p(70, s.open ? 0 : 1);
                    if (hasZ(s.points[0].z)) p(38, num(s.points[0].z * U));
                    for (const pt of s.points) { p(10, num(X(pt.x))); p(20, num(Y(pt.y))); ext(X(pt.x), Y(pt.y)); }
                    if (objMetaDXF(s)) {} else if (s.sweep) { p(1001, 'MOMOCAD'); sweepToXD(s).forEach(v => p(1000, v)); }
                    if (s.hatch) hatch(s);
                } else if (s.type === 'text') {
                    const h = Lu(layerTextH(s.layerId) || 2.5 * annS);
                    (s.content || '').split('\n').forEach((t, k) => {
                        if (t.trim()) text(s, X(s.x), Y(s.y) - h * 1.25 * k, h, t, s.angle ? -s.angle * 180 / Math.PI : 0);
                    });
                } else if (s.type === 'mesh' && rich) {   // maillage (pignons, volumes percés…) : faces 3D lisibles partout
                    const v = meshStore[s.meshId], k = s.sc || 1;
                    for (let t = 0; t + 8 < v.length; t += 9) { head('3DFACE', s); p(100, 'AcDbFace'); const Q = [0, 1, 2, 2].map(j => { const w = meshWorld(s, v[t + j * 3], v[t + j * 3 + 1]); return [X(w.x), Y(w.y), s.z0 + v[t + j * 3 + 2] * k]; });
                        Q.forEach((q, i) => { p(10 + i, num(q[0])); p(20 + i, num(q[1])); p(30 + i, ZZ(q[2])); ext(q[0], q[1]); }); }
                } else if (s.type === 'hatch') {
                    hatch(s);   // hachure AutoCAD (contour invisible, îlots conservés)
                } else if (s.type === 'detail') {
                    line(s, s.lx, s.ly, s.tx, s.ty);   // ligne de rappel
                    const h = Lu(layerTextH(s.layerId) || 2.5 * annS);
                    (s.content || '').split('\n').forEach((t, k) => {
                        if (t.trim()) text(s, X(s.lx), Y(s.ly) - h * 1.25 * (k + 1), h, t, 0);
                    });
                }
                if (rich) annotEnd();
            }

            // ---- mise en page (feuille, fenêtres, textes de la feuille) et cartouche : JSON découpé dans quelques POINT discrets (16 ko de données au plus par objet) ----
            { const P = dxfPresPayload(); if (P) { const j = encodeURIComponent(JSON.stringify(P)), ch = []; for (let k = 0; k < j.length; k += 230) ch.push('j=' + j.slice(k, k + 230));
                const per = 60, N = Math.ceil(ch.length / per), px = isFinite(minX) ? minX : 0, py = isFinite(minY) ? minY : 0;
                for (let b = 0; b < N; b++) { head('POINT', { layerId: 'layer-0' }); p(100, 'AcDbPoint'); p(10, num(px)); p(20, num(py)); p(30, 0); flushTag(); p(1001, 'MOMOCAD'); p(1000, 'mmcpres'); p(1000, 'i=' + b + '/' + N); ch.slice(b * per, (b + 1) * per).forEach(v => p(1000, v)); } } }
            // ---- Vue d'ouverture cadrée sur le dessin ----
            if (minX === Infinity) { minX = 0; minY = 0; maxX = 297; maxY = 210; }
            const w = Math.max(maxX - minX, 1), hgt = Math.max(maxY - minY, 1);
            const fill = (k, v) => k.split('{{' + v[0] + '}}').join(v[1]);
            let out = tpl.replace(/(\$INSUNITS\r?\n\s*70\r?\n)\s*\d+/, '$1' + ({ mm: 4, cm: 5, m: 6 }[currentUnit] || 4));
            // les blocs calques/entités occupent une ligne entière dans le gabarit
            out = out.split('{{LAYERS}}\n').join(LL.length ? LL.join('\n') + '\n' : '');
            out = out.split('{{ENTITIES}}\n').join(E.length ? E.join('\n') + '\n' : '');
            [['HANDSEED', (hnd + 1).toString(16).toUpperCase()],
             ['LAYER_COUNT', String(layerCount)],
             ['EXTMIN_X', num(minX)], ['EXTMIN_Y', num(minY)],
             ['EXTMAX_X', num(maxX)], ['EXTMAX_Y', num(maxY)],
             ['VIEW_CX', num((minX + maxX) / 2)], ['VIEW_CY', num((minY + maxY) / 2)],
             ['VIEW_H', num(Math.max(hgt, w / 1.6) * 1.1)]].forEach(v => { out = fill(out, v); });
            return out;
        }

        function mmPerSquareUnit() {
            return currentUnit === 'mm' ? unitsPerSquare : (currentUnit === 'cm' ? unitsPerSquare*10 : unitsPerSquare*1000);
        }

        let dxfLastUnit = null;
        const unitName = (uf) => ({ 1: 'mm', 10: 'cm', 1000: 'm', 25.4: 'pouces', 304.8: 'pieds', 100: 'dm' })[uf] || (uf + ' mm');
        // mise en page dans le DXF : les centres des fenêtres en coordonnées absolues (mm), pour retomber juste quelle que soit l'origine ou l'unité à la réouverture
        function dxfPresPayload() { const L = Object.assign({}, layoutData, { paperShapes: dxfPaperPS || layoutData.paperShapes || [] }), hasC = cartoucheData && Object.values(cartoucheData).some(Boolean), all = lpSync(); if (all.length < 2 && !(L.vps && L.vps.length) && !(L.paperShapes && L.paperShapes.length) && !hasC) return null;
            const abs = (Lx) => Object.assign({}, Lx, { vps: (Lx.vps || []).map(v => { const o = JSON.parse(JSON.stringify(v)); if (isFinite(v.cx)) { o.cxA = worldToMm(v.cx) + geoOrigin.x; o.cyA = -worldToMm(v.cy) + geoOrigin.y; delete o.cx; delete o.cy; } return o; }) });
            return { v: 1, layout: abs(L), layouts: all.length > 1 ? all.map(x => x === layoutData ? { $cur: 1 } : abs(x)) : undefined, layoutIdx, cartouche: hasC ? cartoucheData : null }; }
        function dxfPresApply(P) { if (!P) return; try {
                const rel = (Lx) => { (Lx.vps || []).forEach(v => { if (isFinite(v.cxA)) { v.cx = mmToWorld(v.cxA - geoOrigin.x); v.cy = -mmToWorld(v.cyA - geoOrigin.y); delete v.cxA; delete v.cyA; } }); return Object.assign(lpNew(), Lx); };
                if (P.layout && Array.isArray(P.layout.vps)) { lpResetAll(rel(P.layout));
                    if (Array.isArray(P.layouts) && P.layouts.length > 1) { layouts = P.layouts.map(x => x && x.$cur ? layoutData : rel(x)); if (!layouts.includes(layoutData)) layouts.unshift(layoutData); layoutIdx = layouts.indexOf(layoutData); } }
                if (P.cartouche) cartoucheData = Object.assign(cartoucheData || {}, P.cartouche); } catch (e) { console.warn('mise en page DXF', e); } }
        // ---- DXF ENTRANT : avant lecture, les blocs insérés (même imbriqués) sont éclatés en vraies entités à leur place (échelle, rotation, symétrie,
        // réseaux), leurs attributs deviennent des textes ; ellipses et splines deviennent des polylignes fines ; les textes multilignes sont nettoyés de
        // leurs codes de mise en forme. Les références externes (autres fichiers) sont listées. Les points topo (blocs avec altitude) restent des points.
        function dxfExpand(pairs) {
            const P = (c, v) => ({ code: c, val: String(v) }), ent0 = (k) => pairs[k] && pairs[k].code === 0, nm = (k) => pairs[k].val.trim();
            const entEnd = (k) => { let j = k + 1; while (j < pairs.length && pairs[j].code !== 0) j++; return j; };
            // 1) définitions de blocs
            const blocks = {}, xrefs = new Set(); let inB = false;
            for (let k = 0; k < pairs.length; k++) {
                if (pairs[k].code === 2 && pairs[k].val.trim() === 'BLOCKS' && pairs[k - 1] && pairs[k - 1].code === 0) inB = true;
                if (!inB) continue; if (ent0(k) && nm(k) === 'ENDSEC') break;
                if (ent0(k) && nm(k) === 'BLOCK') { const j = entEnd(k), h = {}; for (let q = k + 1; q < j; q++) if (h[pairs[q].code] === undefined) h[pairs[q].code] = pairs[q].val;
                    const name = String(h[2] || h[3] || '').trim(), flags = parseInt(h[70] || '0', 10); let e = j; while (e < pairs.length && !(ent0(e) && nm(e) === 'ENDBLK')) e++;
                    blocks[name] = { bx: +h[10] || 0, by: +h[20] || 0, from: j, to: e, xref: !!(flags & 4) || !!(flags & 8), path: String(h[1] || '').trim() }; k = e; }
            }
            // 2) transformations (matrice affine 2D dans le repère du DXF)
            const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, mul = (A, B) => ({ a: A.a * B.a + A.c * B.b, b: A.b * B.a + A.d * B.b, c: A.a * B.c + A.c * B.d, d: A.b * B.c + A.d * B.d, e: A.a * B.e + A.c * B.f + A.e, f: A.b * B.e + A.d * B.f + A.f });
            const tp = (T, x, y) => [T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f], tv = (T, x, y) => [T.a * x + T.c * y, T.b * x + T.d * y];
            const sc = (T) => Math.sqrt(Math.abs(T.a * T.d - T.b * T.c)) || 1, det = (T) => T.a * T.d - T.b * T.c, ang = (T, deg) => { const r = deg * Math.PI / 180, v = tv(T, Math.cos(r), Math.sin(r)); return Math.atan2(v[1], v[0]) * 180 / Math.PI; };
            const stats = { inserts: 0, ellipses: 0, splines: 0, mtexts: 0 };
            const lw = (h, pts, closed) => { const o = [P(0, 'LWPOLYLINE'), P(8, h.layer)]; if (h.col !== undefined) o.push(P(62, h.col)); if (h.lt) o.push(P(6, h.lt)); if (h.lw !== undefined) o.push(P(370, h.lw)); o.push(P(90, pts.length), P(70, closed ? 1 : 0)); pts.forEach(p => o.push(P(10, p[0]), P(20, p[1]))); return o; };
            const ellPts = (cx, cy, mx, my, r, t0, t1) => { let sw = t1 - t0; while (sw <= 1e-9) sw += 2 * Math.PI; const n = Math.max(8, Math.ceil(72 * sw / (2 * Math.PI))), out = []; for (let q = 0; q <= n; q++) { const t = t0 + sw * q / n, c = Math.cos(t), s = Math.sin(t); out.push([cx + mx * c - r * my * s, cy + my * c + r * mx * s]); } return { pts: out, full: Math.abs(sw - 2 * Math.PI) < 1e-6 }; };
            const splPts = (deg, K, C, W, F) => { if (C.length >= 2 && K.length >= C.length + deg + 1) { const n = C.length, p = Math.min(deg, n - 1), u0 = K[p], u1 = K[n], N = Math.min(600, Math.max(16, n * 10)), out = [];
                    for (let q = 0; q <= N; q++) { let u = u0 + (u1 - u0) * q / N; if (q === N) u = u1 - 1e-9 * (u1 - u0 || 1); let k = p; while (k < n - 1 && !(u >= K[k] && u < K[k + 1])) k++;
                        const d = []; for (let j = 0; j <= p; j++) { const w = W.length ? W[k - p + j] || 1 : 1, c = C[k - p + j]; d.push([c[0] * w, c[1] * w, w]); }
                        for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) { const i = k - p + j, den = K[i + p - r + 1] - K[i], al = den ? (u - K[i]) / den : 0; for (let z = 0; z < 3; z++) d[j][z] = (1 - al) * d[j - 1][z] + al * d[j][z]; }
                        out.push([d[p][0] / d[p][2], d[p][1] / d[p][2]]); } return out; }
                if (F.length >= 2) { const out = []; for (let i = 0; i < F.length - 1; i++) { const p0 = F[i - 1] || F[i], p1 = F[i], p2 = F[i + 1], p3 = F[i + 2] || F[i + 1]; for (let s = 0; s < 8; s++) { const t = s / 8, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(z => 0.5 * (2 * p1[z] + (-p0[z] + p2[z]) * t + (2 * p0[z] - 5 * p1[z] + 4 * p2[z] - p3[z]) * t2 + (-p0[z] + 3 * p1[z] - 3 * p2[z] + p3[z]) * t3))); } } out.push(F[F.length - 1]); return out; }
                return C; };
            // une entité (pairs[k..j[) transformée par T ; lay0 / col0 : calque et couleur hérités de l'insertion (calque 0, couleur DUBLOC)
            const emit = (k, j, T, lay0, col0, out, depth) => {
                const type = nm(k), raw = pairs.slice(k + 1, j), h = {}; raw.forEach(p => { if (h[p.code] === undefined) h[p.code] = p.val; });
                const layer = lay0 && String(h[8] || '0').trim() === '0' ? lay0 : String(h[8] || '0').trim(), col = h[62] !== undefined && parseInt(h[62], 10) === 0 && col0 !== undefined ? col0 : h[62];
                const hd = { layer, col: col !== undefined ? String(col).trim() : undefined, lt: h[6] ? String(h[6]).trim() : '', lw: h[370] };
                const fix = (p) => p.code === 8 ? P(8, layer) : p.code === 62 && col !== undefined ? P(62, col) : p;
                if (type === 'ELLIPSE') { stats.ellipses++; const c = tp(T, +h[10] || 0, +h[20] || 0), m = tv(T, +h[11] || 0, +h[21] || 0), r = (+h[40] || 1) * (det(T) < 0 ? -1 : 1); const E = ellPts(c[0], c[1], m[0], m[1], r, +h[41] || 0, h[42] !== undefined ? +h[42] : 2 * Math.PI); out.push(...lw(hd, E.full ? E.pts.slice(0, -1) : E.pts, E.full)); return; }
                if (type === 'SPLINE') { stats.splines++; const K = [], C = [], W = [], F = []; let cx = null, fx = null; raw.forEach(p => { if (p.code === 40) K.push(+p.val); else if (p.code === 41) W.push(+p.val); else if (p.code === 10) cx = +p.val; else if (p.code === 20 && cx !== null) { C.push([cx, +p.val]); cx = null; } else if (p.code === 11) fx = +p.val; else if (p.code === 21 && fx !== null) { F.push([fx, +p.val]); fx = null; } });
                    const pts = splPts(parseInt(h[71] || '3', 10), K, C, W, F).map(q => tp(T, q[0], q[1])); if (pts.length >= 2) out.push(...lw(hd, pts, (parseInt(h[70] || '0', 10) & 1) === 1)); return; }
                if (type === 'MTEXT') { stats.mtexts++; let txt = raw.filter(p => p.code === 3).map(p => p.val).join('') + (h[1] || ''); txt = dxfMText(txt);
                    const ins = tp(T, +h[10] || 0, +h[20] || 0); let rot = h[50] !== undefined ? +h[50] : (h[11] !== undefined ? Math.atan2(+h[21] || 0, +h[11]) * 180 / Math.PI : 0);
                    out.push(P(0, 'MTEXT'), P(8, layer)); if (col !== undefined) out.push(P(62, col)); out.push(P(10, ins[0]), P(20, ins[1]), P(40, (+h[40] || 2.5) * sc(T)), P(50, ang(T, rot)), P(1, txt)); raw.filter(p => p.code === 1001 || p.code === 1000).forEach(p => out.push(p)); return; }
                if (T === I) { out.push(pairs[k], ...raw.map(fix)); return; }
                const o = [pairs[k]]; let px = null;
                if (type === 'ARC') { const c = tp(T, +h[10], +h[20]), r = (+h[40] || 0), a1 = +h[50] * Math.PI / 180, a2 = +h[51] * Math.PI / 180, s1 = tp(T, +h[10] + r * Math.cos(a1), +h[20] + r * Math.sin(a1)), s2 = tp(T, +h[10] + r * Math.cos(a2), +h[20] + r * Math.sin(a2));
                    let b1 = Math.atan2(s1[1] - c[1], s1[0] - c[0]) * 180 / Math.PI, b2 = Math.atan2(s2[1] - c[1], s2[0] - c[0]) * 180 / Math.PI; if (det(T) < 0) [b1, b2] = [b2, b1];
                    out.push(P(0, 'ARC'), P(8, layer)); if (col !== undefined) out.push(P(62, col)); if (hd.lt) out.push(P(6, hd.lt)); out.push(P(10, c[0]), P(20, c[1]), P(40, r * sc(T)), P(50, b1), P(51, b2)); return; }
                raw.forEach(p => { const c = p.code;
                    if (c === 10 || c === 11) { px = { c, v: +p.val }; return; }
                    if ((c === 20 || c === 21) && px && px.c === c - 10) { const q = tp(T, px.v, +p.val); o.push(P(px.c, q[0]), P(c, q[1])); px = null; return; }
                    if (px) { o.push(P(px.c, px.v)); px = null; }
                    if (c === 40 && ['CIRCLE', 'TEXT', 'ATTRIB', 'LWPOLYLINE'].includes(type)) { o.push(P(40, +p.val * sc(T))); return; }
                    if (c === 50 && ['TEXT', 'ATTRIB', 'INSERT'].includes(type)) { o.push(P(50, ang(T, +p.val))); return; }
                    if (c === 42 && type === 'LWPOLYLINE' && det(T) < 0) { o.push(P(42, -(+p.val))); return; }
                    o.push(fix(p)); });
                if (px) o.push(P(px.c, px.v)); out.push(...o);
            };
            // une insertion de bloc : ses entités, à sa place ; réseaux (colonnes × lignes) ; attributs en textes
            const insert = (k, T0, lay0, col0, out, depth) => { const j = entEnd(k), h = {}; for (let q = k + 1; q < j; q++) if (h[pairs[q].code] === undefined) h[pairs[q].code] = pairs[q].val;
                let e = j; const atts = []; if (String(h[66] || '').trim() === '1') { while (ent0(e) && nm(e) === 'ATTRIB') { const ee = entEnd(e); atts.push([e, ee]); e = ee; } if (ent0(e) && nm(e) === 'SEQEND') e = entEnd(e); }
                const name = String(h[2] || '').trim(), B = blocks[name], layer = lay0 && String(h[8] || '0').trim() === '0' ? lay0 : String(h[8] || '0').trim(), col = h[62] !== undefined && parseInt(h[62], 10) === 0 && col0 !== undefined ? col0 : h[62];
                if (!B) return e; if (B.xref) { xrefs.add(B.path || name); return e; } if (depth > 12) return e; stats.inserts++;
                const sx = h[41] !== undefined ? +h[41] : 1, sy = h[42] !== undefined ? +h[42] : 1, r = (+h[50] || 0) * Math.PI / 180, nc = Math.max(1, parseInt(h[70] || '1', 10)), nr = Math.max(1, parseInt(h[71] || '1', 10)), dc = +h[44] || 0, dr = +h[45] || 0;
                for (let ci = 0; ci < nc; ci++) for (let ri = 0; ri < nr; ri++) {
                    const ox = ci * dc, oy = ri * dr, ix = (+h[10] || 0) + ox * Math.cos(r) - oy * Math.sin(r), iy = (+h[20] || 0) + ox * Math.sin(r) + oy * Math.cos(r);
                    const L = { a: Math.cos(r) * sx, b: Math.sin(r) * sx, c: -Math.sin(r) * sy, d: Math.cos(r) * sy, e: ix, f: iy }, T = mul(T0, mul(L, { a: 1, b: 0, c: 0, d: 1, e: -B.bx, f: -B.by }));
                    for (let q = B.from; q < B.to;) { if (!ent0(q)) { q++; continue; } const t = nm(q);
                        if (t === 'INSERT') { q = insert(q, T, layer, col, out, depth + 1); continue; }
                        if (t === 'POLYLINE') { let qq = entEnd(q); const seg = [[q, qq]]; while (ent0(qq) && (nm(qq) === 'VERTEX' || nm(qq) === 'SEQEND')) { const z = entEnd(qq); seg.push([qq, z]); qq = z; if (nm(seg[seg.length - 1][0]) === 'SEQEND') break; } seg.forEach(([a, b]) => emit(a, b, T, layer, col, out, depth)); q = qq; continue; }
                        if (['ATTDEF', 'SEQEND', 'DIMENSION', 'VIEWPORT'].includes(t)) { q = entEnd(q); continue; }
                        const z = entEnd(q); emit(q, z, T, layer, col, out, depth); q = z; } }
                atts.forEach(([a, b]) => { const ah = {}; for (let q = a + 1; q < b; q++) if (ah[pairs[q].code] === undefined) ah[pairs[q].code] = pairs[q].val; if ((parseInt(ah[70] || '0', 10) & 1) || !String(ah[1] || '').trim()) return;
                    const p = tp(T0, +ah[10] || 0, +ah[20] || 0), lyr = String(ah[8] || '0').trim() === '0' && layer ? layer : String(ah[8] || '0').trim();
                    out.push(P(0, 'TEXT'), P(8, lyr)); if (ah[62] !== undefined) out.push(P(62, ah[62])); out.push(P(10, p[0]), P(20, p[1]), P(40, (+ah[40] || 2.5) * sc(T0)), P(50, ang(T0, +ah[50] || 0)), P(1, ah[1])); });
                return e; };
            // 3) section ENTITIES réécrite
            let s0 = -1; for (let k = 1; k < pairs.length; k++) if (pairs[k].code === 2 && pairs[k].val.trim() === 'ENTITIES' && pairs[k - 1].code === 0) { s0 = k + 1; break; }
            if (s0 < 0) return { pairs, xrefs: [], stats };
            let s1 = s0; while (s1 < pairs.length && !(ent0(s1) && nm(s1) === 'ENDSEC')) s1++;
            const out = [];
            for (let k = s0; k < s1;) { if (!ent0(k)) { out.push(pairs[k]); k++; continue; } const t = nm(k), j = entEnd(k);
                let paper = false; for (let q = k + 1; q < j; q++) if (pairs[q].code === 67 && pairs[q].val.trim() === '1') paper = true;
                if (t === 'INSERT' && !paper) { const h = {}, xd = []; for (let q = k + 1; q < j; q++) { if (h[pairs[q].code] === undefined) h[pairs[q].code] = pairs[q].val; if (pairs[q].code === 1001) xd.push(pairs[q].val.trim()); }
                    let e = j, alt = false; if (String(h[66] || '').trim() === '1') { while (ent0(e) && nm(e) === 'ATTRIB') { for (let q = e + 1; q < entEnd(e); q++) if (pairs[q].code === 2 && /^(ALT|ALTI|ALTITUDE|Z|NGF|COTE|NIVEAU|NIV)$/i.test(pairs[q].val.trim())) alt = true; e = entEnd(e); } if (ent0(e) && nm(e) === 'SEQEND') e = entEnd(e); }
                    const B = blocks[String(h[2] || '').trim()];
                    if (alt || xd.includes('MOMOCAD') || /TOPO|POINT|PT/i.test(String(h[2] || '')) || !B) { for (let q = k; q < e; q++) out.push(pairs[q]); k = e; continue; }   // point topo, ou bloc inconnu : lu comme avant
                    insert(k, I, null, undefined, out, 0); k = e; continue; }
                if (!paper && (t === 'ELLIPSE' || t === 'SPLINE' || t === 'MTEXT')) { emit(k, j, I, null, undefined, out, 0); k = j; continue; }
                for (let q = k; q < j; q++) out.push(pairs[q]); k = j; }
            return { pairs: pairs.slice(0, s0).concat(out, pairs.slice(s1)), xrefs: [...xrefs], stats };
        }
        // texte multiligne : codes de mise en forme retirés (police, hauteur, couleur, soulignés, fractions…), retours à la ligne gardés, symboles traduits
        function dxfExtraMsg(res) { const S = res.stats || {}, a = []; if (S.inserts) a.push(S.inserts + ' bloc(s) éclaté(s)'); if (S.splines) a.push(S.splines + ' spline(s)'); if (S.ellipses) a.push(S.ellipses + ' ellipse(s)'); return a.length ? ' (dont ' + a.join(', ') + ')' : ''; }
        function dxfXrefMsg(res) { const X = res.xrefs || []; return X.length ? ' ⚠ ' + X.length + ' référence(s) externe(s) non incluse(s) dans ce DXF : ' + X.slice(0, 4).map(x => String(x).split(/[\\/]/).pop()).join(', ') + (X.length > 4 ? '…' : '') + ' — demandez ces fichiers en DXF et ajoutez-les avec Superposer un DXF.' : ''; }
        function dxfMText(t) { return String(t || '').replace(/\\P/g, '\n').replace(/\\[Ss]([^;^\/#]*)[\^\/#]([^;]*);/g, '$1/$2').replace(/\\[ACcFfHhQqTtWw][^;]*;/g, '').replace(/\\[LlOoKkNn]/g, '').replace(/\\~/g, ' ')
            .replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\\/g, '\\').replace(/\\([{}])/g, '$1').replace(/[{}]/g, '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%%/g, '%'); }
        function importDXF(text) {
            const presParts = []; let presN = 0;
            // Parseur DXF "best effort" : lit les paires (code, valeur) et reconstruit
            // les entités supportées. Ignore le reste (blocs, splines, hachures...).
            const raw = text.split(/\r\n|\r|\n/);
            let pairs = [];
            for (let i = 0; i + 1 < raw.length; i += 2) {
                pairs.push({ code: parseInt(raw[i].trim(), 10), val: dxfDecode(raw[i+1]) });
            }
            let dxfX = { xrefs: [], stats: {} }; try { dxfX = dxfExpand(pairs); pairs = dxfX.pairs; } catch (e) { console.warn('blocs DXF', e); }
            const newShapes = [], talusEnds = [];   // extrémités des traits de talus MomoCAD : reconnaissent les plateformes inclinées des anciens fichiers
            const importedLayers = {}; // name -> color
            let ignored = 0;
            let i = 0;

            // 1) Récupérer le style des calques depuis la table LAYER (couleur/type/épaisseur)
            for (let k = 0; k < pairs.length - 1; k++) {
                if (pairs[k].code === 0 && pairs[k].val.trim() === 'LAYER') {
                    let name = null, aci = 7, lt = null, lw = null, momo = null, app = null;
                    for (let j = k+1; j < pairs.length && !(pairs[j].code === 0); j++) {
                        if (pairs[j].code === 1001) app = pairs[j].val.trim();
                        if (pairs[j].code === 1000 && app === 'MOMOCAD') momo = pairs[j].val;
                        if (app) continue;   // données étendues : ne pas confondre avec les codes du calque
                        if (pairs[j].code === 2) name = pairs[j].val.trim();
                        if (pairs[j].code === 62) aci = parseInt(pairs[j].val.trim(), 10);
                        if (pairs[j].code === 6) lt = pairs[j].val.trim();
                        if (pairs[j].code === 370) lw = parseInt(pairs[j].val.trim(), 10);
                    }
                    if (name) {
                        importedLayers[name] = {
                            color: (Math.abs(aci) > 0 && Math.abs(aci) < 256) ? aciToHex(Math.abs(aci)) : '#ffffff',
                            dash: dxfToDash(lt),
                            width: lw !== null ? lineweightToWidth(lw) : 1
                        };
                        if (momo) {   // ex. "textH=2.5;hatch=cross"
                            const kv = {}; momo.split(';').forEach(t => { const [a, b] = t.split('='); if (a) kv[a.trim()] = (b || '').trim(); });
                            importedLayers[name].momo = true;
                            importedLayers[name].textH = parseFloat(kv.textH) > 0 ? parseFloat(kv.textH) : '';
                            importedLayers[name].hatch = (['lines', 'cross', 'solid'].includes(kv.hatch) || /^m-[a-z]+$/.test(kv.hatch || '')) ? kv.hatch : 'lines';
                            importedLayers[name].hatchScale = parseFloat(kv.hscale) > 0 ? parseFloat(kv.hscale) : 1;
                            if ('grp' in kv) { try { importedLayers[name].group = decodeURIComponent(kv.grp); } catch (e) { importedLayers[name].group = kv.grp; } }
                            if (kv.lt === 'text') { importedLayers[name].dash = 'text'; try { importedLayers[name].ltText = decodeURIComponent(kv.ltt || ''); } catch (e) { importedLayers[name].ltText = kv.ltt || ''; } }
                        }
                    }
                }
            }

            // 2) Trouver la section ENTITIES
            let start = 0;
            for (let k = 0; k < pairs.length - 1; k++) {
                if (pairs[k].code === 2 && pairs[k].val.trim() === 'ENTITIES') { start = k; break; }
            }

            const num = (x) => parseFloat(x);
            // Unités du fichier ($INSUNITS) : les plans de géomètre sont souvent en mètres
            let uf = 0;
            for (let k = 0; k < start; k++) if (pairs[k].code === 9 && pairs[k].val.trim() === '$INSUNITS') {
                for (let j = k + 1; j < k + 4 && j < pairs.length; j++) if (pairs[j].code === 70) { uf = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 }[parseInt(pairs[j].val, 10)] || 0; break; }
                break;
            }
            // Fichier « sans unité » (comme AutoCAD) : coordonnées Lambert en mètres reconnues, sinon on prend l'unité du dessin
            let unitSrc = 'en-tête du fichier';
            if (!uf) {
                const xs = [], ys = []; for (let k = start; k < pairs.length && xs.length < 20000; k++) { const c = pairs[k].code, v = num(pairs[k].val); if (!isFinite(v) || Math.abs(v) < 1) continue; if (c === 10) xs.push(Math.abs(v)); else if (c === 20) ys.push(Math.abs(v)); }
                const md = (a) => { if (!a.length) return 0; a.sort((u, w) => u - w); return a[a.length >> 1]; }, mx = md(xs), my = md(ys);
                if (mx > 5e4 && mx < 3e6 && my > 1e6 && my < 1e7) { uf = 1000; unitSrc = 'coordonnées Lambert'; }
                else { uf = UNIT_MM[currentUnit] || 1; unitSrc = 'fichier sans unité : unité du dessin'; }
            }
            dxfLastUnit = { uf, src: unitSrc };
            // Coordonnées géoréférencées (Lambert…) : on travaille près de 0 avec une origine mémorisée
            if (!geoOrigin.x && !geoOrigin.y && !shapes.some(sh => !isBg(sh))) {
                // médiane des coordonnées non nulles (les points de référence à 0,0 des hachures sont ignorés)
                const xs = [], ys = [];
                for (let k = start; k < pairs.length; k++) { const c = pairs[k].code, v = num(pairs[k].val) * uf; if (!isFinite(v) || Math.abs(v) < 1) continue; if (c === 10) xs.push(v); else if (c === 20) ys.push(v); }
                const med = (a) => { if (!a.length) return 0; a.sort((u, w) => u - w); return a[a.length >> 1]; };
                const mx = med(xs), my = med(ys);
                if (Math.abs(mx) > 1e8 || Math.abs(my) > 1e8) geoOrigin = { x: Math.floor(mx / 1e6) * 1e6, y: Math.floor(my / 1e6) * 1e6 };   // au km près
            }
            const X = (v) => mmToWorld(num(v) * uf - geoOrigin.x);
            const Y = (v) => -mmToWorld(num(v) * uf - geoOrigin.y); // ré-inversion Y
            const L = (v) => mmToWorld(num(v) * uf);                  // longueurs (rayons, hauteurs de texte)
            const Z = (v) => { const z = num(v) * uf; return (v !== undefined && isFinite(z) && z !== 0) ? z : undefined; };   // altitude en mm ; 0 = pas d'altitude

            i = start;
            while (i < pairs.length) {
                if (pairs[i].code !== 0) { i++; continue; }
                const ent = pairs[i].val.trim();
                if (ent === 'ENDSEC' || ent === 'EOF') break;
                // Entités de l'espace papier (mise en page, cartouche du géomètre) : ignorées, seul l'espace objet est importé
                {
                    let j = i + 1, paper = false;
                    for (; j < pairs.length && pairs[j].code !== 0; j++) if (pairs[j].code === 67 && pairs[j].val.trim() === '1') paper = true;
                    if (paper) {
                        while (j < pairs.length && pairs[j].code === 0 && ['VERTEX', 'ATTRIB', 'SEQEND'].includes(pairs[j].val.trim())) { j++; while (j < pairs.length && pairs[j].code !== 0) j++; }
                        i = j; continue;
                    }
                }

                // ----- POLYLINE ancien format (R12) : sommets dans des VERTEX -----
                if (ent === 'HATCH') {
                    { // objet MomoCAD complet porté par la hachure (paroi…) : il revient tel quel
                        let k = i + 1; const xd = []; let ln = '0'; for (; k < pairs.length && pairs[k].code !== 0; k++) { if (pairs[k].code === 1000) xd.push(pairs[k].val.trim()); if (pairs[k].code === 8) ln = pairs[k].val.trim(); }
                        if (xd.includes('objpart')) { i = k; continue; }
                        if (xd[0] === 'annot') { try { const o = JSON.parse(decodeURIComponent(xd.filter(v => v.startsWith('j=')).map(v => v.slice(2)).join(''))); if (o.__rich) { delete o.__rich; dxfGeoMap(o, X, Y); o.layerId = resolveImportLayer(ln, importedLayers); newShapes.push(o); i = k; continue; } } catch (e) {} }
                    }
                    let j = i + 1, layerName = '0', nLoops = -1, ok = true;
                    const loops = [];
                    // en-tête jusqu'au nombre de contours (91)
                    for (; j < pairs.length && pairs[j].code !== 0; j++) {
                        if (pairs[j].code === 8) layerName = pairs[j].val.trim();
                        if (pairs[j].code === 91) { nLoops = parseInt(pairs[j].val, 10); j++; break; }
                    }
                    for (let L = 0; L < nLoops && ok && j < pairs.length; L++) {
                        while (j < pairs.length && pairs[j].code !== 92 && pairs[j].code !== 0) j++;
                        if (j >= pairs.length || pairs[j].code !== 92) { ok = false; break; }
                        const flags = parseInt(pairs[j].val, 10); j++;
                        if (!(flags & 2)) { ok = false; break; }          // contour fait d'arêtes (arcs, splines) : non géré
                        let nv = 0;
                        while (j < pairs.length && pairs[j].code !== 93 && pairs[j].code !== 0) j++;
                        if (pairs[j] && pairs[j].code === 93) { nv = parseInt(pairs[j].val, 10); j++; }
                        const pts = [];
                        while (pts.length < nv && j < pairs.length && pairs[j].code !== 0) {
                            if (pairs[j].code === 10 && pairs[j + 1] && pairs[j + 1].code === 20) { pts.push({ x: X(pairs[j].val), y: Y(pairs[j + 1].val) }); j += 2; }
                            else j++;
                        }
                        if (pts.length >= 3) loops.push(pts);
                    }
                    while (j < pairs.length && pairs[j].code !== 0) j++;
                    if (ok && loops.length) newShapes.push({ type: 'hatch', layerId: resolveImportLayer(layerName, importedLayers), loops });
                    else ignored++;
                    i = j; continue;
                }
                if (ent === 'POLYLINE') {
                    const pg = {};
                    let j = i + 1;
                    const pxd = [];
                    for (; j < pairs.length && pairs[j].code !== 0; j++) { pg[pairs[j].code] = pairs[j].val; if (pairs[j].code === 1000) pxd.push(pairs[j].val.trim()); }
                    const layerId = resolveImportLayer((pg[8] || '0').trim(), importedLayers);
                    const closed = (parseInt(pg[70] || '0', 10) & 1) === 1;
                    // style de la polyligne
                    let pcolor = '#ffffff';
                    if (pg[62] !== undefined) { const aci = parseInt(pg[62],10); if (aci>0 && aci<256) pcolor = aciToHex(aci); else { const lc=(layers.find(l=>l.id===layerId)||{}).color; if(lc) pcolor=lc; } }
                    else { const lc=(layers.find(l=>l.id===layerId)||{}).color; if(lc) pcolor=lc; }
                    const pdash = dxfToDash(pg[6]);
                    const pwidth = pg[370] !== undefined ? lineweightToWidth(parseInt(pg[370],10)) : 1;
                    const pts = [];
                    while (j < pairs.length) {
                        if (pairs[j].code === 0 && pairs[j].val.trim() === 'VERTEX') {
                            const vg = {}; let k = j + 1;
                            for (; k < pairs.length && pairs[k].code !== 0; k++) vg[pairs[k].code] = pairs[k].val;
                            if (vg[10] !== undefined && vg[20] !== undefined) { const q = { x: X(vg[10]), y: Y(vg[20]) }; const z = Z(vg[30]); if (z !== undefined) q.z = z; pts.push(q); }
                            j = k;
                        } else if (pairs[j].code === 0 && pairs[j].val.trim() === 'SEQEND') { j++; break; }
                        else if (pairs[j].code === 0) break;
                        else j++;
                    }
                    if (pts.length >= 2) { const pl = { type:'poly', layerId, points:pts, color:pcolor, dash:pdash, width:pwidth, hatch:false, open: !closed || pts.length < 3 }; platMetaFromDXF(pl, pxd); sweepFromXD(pl, pxd); newShapes.push(pl); }
                    else ignored++;
                    i = j; continue;
                }

                // ----- Blocs : les points de géomètre (bloc avec un attribut d'altitude) deviennent des points topo -----
                if (ent === 'INSERT' || ent === 'POINT') {
                    const ig = {}, ix = []; let j = i + 1;
                    for (; j < pairs.length && pairs[j].code !== 0; j++) { if (ig[pairs[j].code] === undefined) ig[pairs[j].code] = pairs[j].val; if (pairs[j].code === 1000) ix.push(pairs[j].val.trim()); }
                    if (ent === 'POINT' && String(ig[1000] || '').trim() === 'talus') { i = j; continue; }
                    if (ent === 'POINT' && ix[0] === 'mmcpres') { const m = /^i=(\d+)\/(\d+)$/.exec(ix[1] || ''); if (m) { presParts[+m[1]] = ix.filter(v => v.startsWith('j=')).map(v => v.slice(2)).join(''); presN = +m[2]; } i = j; continue; }   // mise en page MomoCAD   // point de talus MomoCAD : recalculé depuis la plateforme
                    const att = {};
                    if (ent === 'INSERT' && String(ig[66] || '').trim() === '1') {
                        while (j < pairs.length && pairs[j].code === 0 && pairs[j].val.trim() === 'ATTRIB') {
                            let tag = '', val = '', k = j + 1;
                            for (; k < pairs.length && pairs[k].code !== 0; k++) { if (pairs[k].code === 2) tag = pairs[k].val.trim().toUpperCase(); if (pairs[k].code === 1) val = pairs[k].val.trim(); }
                            if (tag) att[tag] = val; j = k;
                        }
                        if (j < pairs.length && pairs[j].code === 0 && pairs[j].val.trim() === 'SEQEND') { j++; while (j < pairs.length && pairs[j].code !== 0) j++; }
                    }
                    const altKey = ['ALT', 'ALTI', 'ALTITUDE', 'Z', 'NGF', 'COTE', 'NIVEAU', 'NIV'].find(t => att[t] !== undefined && !isNaN(parseFloat(String(att[t]).replace(',', '.'))));
                    let z = altKey ? parseFloat(String(att[altKey]).replace(',', '.')) * 1000 : Z(ig[30]);
                    const isTopo = ent === 'POINT' || altKey || /TOPO|POINT|PT/i.test(String(ig[2] || ''));
                    if (isTopo && ig[10] !== undefined && ig[20] !== undefined) {
                        const pt = { type: 'point', layerId: resolveImportLayer((ig[8] || '0').trim(), importedLayers), x: X(ig[10]), y: Y(ig[20]) };
                        if (z !== undefined) pt.z = z;
                        const mat = att.MAT || att.MATRICULE || att.NUM || att.NUMERO || att.NOM; if (mat) pt.mat = mat;
                        const cod = att.COD || att.CODE; if (cod) pt.code = cod;
                        ix.forEach(v => { const m = /^(mat|code)=(.*)$/.exec(v); if (m) { try { pt[m[1]] = decodeURIComponent(m[2]); } catch (e) { pt[m[1]] = m[2]; } } });   // point topo MomoCAD : matricule et code
                        newShapes.push(pt);
                    } else ignored++;
                    i = j; continue;
                }
                // Collecte tous les codes de l'entité jusqu'au prochain code 0
                const g = {}; const gmulti = { 10:[], 20:[], 1000:[] };
                let j = i + 1;
                for (; j < pairs.length && pairs[j].code !== 0; j++) {
                    const c = pairs[j].code, v = pairs[j].val;
                    if (c === 10) gmulti[10].push(v);
                    else if (c === 20) gmulti[20].push(v);
                    else { if (c === 1000) gmulti[1000].push(v.trim()); g[c] = v; }
                }

                const layerName = (g[8] || '0').trim();
                const layerId = resolveImportLayer(layerName, importedLayers);
                // annotation MomoCAD (cote, cote d'angle, de rayon) : l'objet complet revient, ses traits et son texte sont ignorés
                if (gmulti[1000].includes('objpart')) { i = j; continue; }
                if (gmulti[1000][0] === 'annot') {
                    try { const o = JSON.parse(decodeURIComponent(gmulti[1000].filter(v => v.startsWith('j=')).map(v => v.slice(2)).join('')));
                        const KEYS = { dim: [['x1', 'y1'], ['x2', 'y2'], ['ox', 'oy']], dimr: [['x', 'y'], ['ax', 'ay'], ['lx', 'ly']], 'dim-angle': [['vertex'], ['p1'], ['p2']] }[o.type];
                        if (o.__rich) { delete o.__rich; dxfGeoMap(o, X, Y); o.layerId = layerId; if (o.__mv) { meshStore[o.meshId] = new Float32Array(o.__mv); delete o.__mv; } newShapes.push(o); }
                        else if (KEYS) { KEYS.forEach(([kx, ky]) => { if (ky) { o[kx] = X(o[kx]); o[ky] = Y(o[ky]); } else if (o[kx]) o[kx] = { x: X(o[kx].x), y: Y(o[kx].y) }; }); o.layerId = layerId; newShapes.push(o); }
                    } catch (e) { ignored++; }
                    i = j; continue;
                }

                // Style entité : couleur (62, ByLayer si absent/256), type (6), épaisseur (370)
                let _color = '#ffffff';
                if (g[62] !== undefined) {
                    const aci = parseInt(g[62], 10);
                    if (aci > 0 && aci < 256) _color = aciToHex(aci);
                    else { const lc = (layers.find(l => l.id === layerId) || {}).color; if (lc) _color = lc; }
                } else { const lc = (layers.find(l => l.id === layerId) || {}).color; if (lc) _color = lc; }
                const _dash = dxfToDash(g[6]);
                const _width = g[370] !== undefined ? lineweightToWidth(parseInt(g[370],10)) : 1;

                if (ent === 'LINE' && String(g[1001] || '').trim() === 'MOMOCAD' && String(g[1000] || '').trim() === 'talus') {
                    // trait de talus écrit par MomoCAD : redessiné automatiquement depuis la plateforme
                    talusEnds.push({ x: X(gmulti[10][0]), y: Y(gmulti[20][0]) }, { x: X(g[11]), y: Y(g[21]) });
                } else if (ent === 'LINE') {
                    const ln = { type:'line', layerId,
                        x1: X(gmulti[10][0]), y1: Y(gmulti[20][0]),
                        x2: X(g[11]), y2: Y(g[21]),
                        color:_color, dash:_dash, width:_width };
                    const z1 = Z(g[30]), z2 = Z(g[31]); if (z1 !== undefined || z2 !== undefined) { ln.z1 = z1 !== undefined ? z1 : 0; ln.z2 = z2 !== undefined ? z2 : 0; }
                    sweepFromXD(ln, gmulti[1000]); newShapes.push(ln);
                } else if (ent === 'CIRCLE') {
                    const ci = { type:'circle', layerId,
                        x: X(gmulti[10][0]), y: Y(gmulti[20][0]),
                        r: L(g[40]), z: Z(g[30]),
                        color:_color, dash:_dash, width:_width, hatch:false,
                        ...(Z(g[30]) !== undefined && !gmulti[1000].includes('plateforme') ? { elev: true } : {}) };   // cercle coté d'un géomètre : pas une plateforme
                    platMetaFromDXF(ci, gmulti[1000]); sweepFromXD(ci, gmulti[1000]); newShapes.push(ci);   // cercle coté d'un géomètre : pas une plateforme
                } else if (ent === 'ARC') {
                    // Ré-inversion des angles (cf. export)
                    const cx = X(gmulti[10][0]), cy = Y(gmulti[20][0]), r = L(g[40]);
                    let a1 = num(g[50]) * Math.PI/180, a2 = num(g[51]) * Math.PI/180;
                    // dxf->monde : angle_monde = -angle_dxf, et on ré-échange start/end
                    const ar = { type:'arc', layerId, x:cx, y:cy, r:r, z: Z(g[30]),
                        startAngle: -a2, endAngle: -a1,
                        color:_color, dash:_dash, width:_width }; sweepFromXD(ar, gmulti[1000]); newShapes.push(ar);
                } else if (ent === 'LWPOLYLINE') {
                    const pts = [];
                    const n = Math.min(gmulti[10].length, gmulti[20].length);
                    const el = Z(g[38]);   // élévation de la polyligne
                    for (let q = 0; q < n; q++) { const v = { x: X(gmulti[10][q]), y: Y(gmulti[20][q]) }; if (el !== undefined) v.z = el; pts.push(v); }
                    const lwClosed = (parseInt(g[70] || '0', 10) & 1) === 1;
                    if (pts.length >= 2) { const lw = { type:'poly', layerId, points:pts,
                        color:_color, dash:_dash, width:_width, hatch:false, open: !lwClosed || pts.length < 3, ...(el !== undefined ? { elev: true } : {}) }; objMetaFromDXF(lw, gmulti[1000]); sweepFromXD(lw, gmulti[1000]); newShapes.push(lw); }
                } else if ((ent === 'TEXT' || ent === 'MTEXT') && String(g[1001] || '').trim() === 'MOMOCAD' && String(g[1000] || '').trim() === 'zlabel') {
                    // étiquette d'altitude écrite par MomoCAD : déjà portée par le point topo
                } else if (ent === 'TEXT' || ent === 'MTEXT') {
                    newShapes.push({ type:'text', layerId,
                        x: X(gmulti[10][0]), y: Y(gmulti[20][0]),
                        content: (ent === 'MTEXT' ? String(g[1] || '') : dxfMText(g[1] || '').replace(/\n/g, ' ')).replace(/(\d\s?)m\uFFFD/g, '$1m²').replace(/(\d\s?)m\uFFFD/g, '$1m³'),
                        color:_color, size: g[40] ? L(g[40]) : 20,
                        angle: g[50] ? -num(g[50])*Math.PI/180 : 0 });
                } else {
                    ignored++;
                }
                i = j;
            }
            // contours fermés : sommets en double (consécutifs, ou dernier = premier) retirés
            newShapes.forEach(sh => { if (sh.type !== 'poly' || sh.open) return; const e = mmToWorld(1);
                const out = []; sh.points.forEach(q => { const l = out[out.length - 1]; if (!l || Math.hypot(q.x - l.x, q.y - l.y) > e) out.push(q); });
                while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= e) out.pop();
                if (out.length >= 3) sh.points = out; });
            // anciens fichiers MomoCAD : polyligne 3D fermée à Z variables bordée de traits de talus = plateforme inclinée
            if (talusEnds.length) newShapes.forEach(sh => {
                if (sh.type !== 'poly' || sh.open || sh.plat || sh.points.length < 3 || !sh.points.every(q => hasZ(q.z)) || sh.points.every(q => Math.abs(q.z - sh.points[0].z) < 1)) return;
                const tol = mmToWorld(10); let n = 0;
                for (const q of talusEnds) { if (distToPoly(q.x, q.y, sh.points) < tol && ++n >= 4) break; }
                if (n >= 4) sh.plat = true;
            });
            newShapes.forEach(sh => { sh.zk = 1; if (sh.z === undefined) delete sh.z; });
            lightenTalusLimits(newShapes);
            let pres = null; if (presN && presParts.filter(v => v !== undefined).length === presN) { try { pres = JSON.parse(decodeURIComponent(presParts.join(''))); } catch (e) { console.warn('mise en page DXF', e); } }
            return { shapes: newShapes, ignored, unit: dxfLastUnit, pres, xrefs: dxfX.xrefs, stats: dxfX.stats };
        }

        let dxfLayerPrefix = null;   // DXF superposé : ses calques rangés sous le nom du fichier (« fichier · calque »)
        function resolveImportLayer(name, importedLayers) {
            if (dxfLayerPrefix) { const nm = dxfLayerPrefix + ' · ' + (fixLostAccents(name || '0') || '0'), hit = layers.find(l => l.name.toLowerCase() === nm.toLowerCase()); if (hit) return hit.id;
                const st = importedLayers[name] || {}, id = newLayerId();
                layers.push({ id, name: nm, visible: true, color: st.color || '#ffffff', dash: st.dash || 'solid', width: st.width || 1, textH: st.textH || '', hatch: st.hatch || 'lines', hatchScale: st.hatchScale || 1, ...(st.ltText !== undefined ? { ltText: st.ltText } : {}) }); return id; }
            // Cherche un calque existant dont le nom DXF correspond (insensible à la casse),
            // sinon en crée un.
            if (name && name.includes('\uFFFD')) {   // accent perdu par un autre logiciel (« Trac� ») : on retrouve le calque existant (« Tracé »)
                const re = new RegExp('^' + name.trim().split('\uFFFD').map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.') + '$', 'i');
                const hit = layers.find(l => re.test(layerDxfName(l.id))); if (hit) { importedLayers[layerDxfName(hit.id)] = importedLayers[layerDxfName(hit.id)] || importedLayers[name]; name = layerDxfName(hit.id); }
            }
            const target = (name || '0').trim().toLowerCase();
            const st0 = importedLayers[name];
            for (const l of layers) {
                if (layerDxfName(l.id).toLowerCase() === target) {
                    // fichier exporté par MomoCAD : on restaure tous les réglages du calque
                    if (st0 && st0.momo) { Object.assign(l, { color: st0.color, dash: st0.dash, width: st0.width, textH: st0.textH, hatch: st0.hatch, hatchScale: st0.hatchScale || 1 }); if (st0.ltText !== undefined) l.ltText = st0.ltText; if (st0.group !== undefined) l.group = st0.group; }
                    return l.id;
                }
                // anciens exports MomoCAD : noms avec "_" à la place des espaces et accents
                if (l.name.replace(/[^A-Za-z0-9_\-]/g, '_').toLowerCase() === target) return l.id;
            }
            const st = importedLayers[name] || {};
            const newId = newLayerId();
            layers.push({ id:newId, name:fixLostAccents(name) || 'Importé', visible:true,
                          color: st.color || '#ffffff', dash: st.dash || 'solid', width: st.width || 1,
                          textH: st.textH || '', hatch: st.hatch || 'lines', hatchScale: st.hatchScale || 1, ...(st.ltText !== undefined ? { ltText: st.ltText } : {}), ...(st.group !== undefined ? { group: st.group } : {}) });
            return newId;
        }


        // Recentre et ajuste le zoom de la vue sur un ensemble de formes (après import DXF).
        let midClickT = 0, midClickX = 0, midClickY = 0;
        // Zoom étendu : tous les objets des calques visibles dans la fenêtre (en présentation : la feuille, ou la fenêtre active)
        function zoomExtents() {
            if (layoutOn && typeof lpFitView === 'function' && !lpInner) { lpFitView(); updateCommandMessageText('Zoom étendu : feuille entière.'); return; }
            const vis = new Set(layers.filter(l => l.visible).map(l => l.id));
            const list = [];
            for (const s of shapes) {
                if (!vis.has(s.layerId || 'layer-0') || s.type === 'basemap' || s.type === 'cline') continue;
                if (s.type === 'bgimage') { bgCorners(s).forEach(q => list.push({ x: q.x, y: q.y })); continue; }
                if (s.type === 'pdfvec') { vecCorners(s).forEach(q => list.push({ x: q.x, y: q.y })); continue; }
                if (s.type === 'mesh') { meshCorners(s).forEach(q => list.push({ x: q.x, y: q.y })); continue; }
                if (s.type === 'dim-angle') { list.push(s.vertex, s.p1, s.p2); continue; }
                if (s.type === 'dimr') { list.push({ x: s.x, y: s.y }, { x: s.lx, y: s.ly }); continue; }
                if (s.type === 'detail') { list.push({ x: s.tx, y: s.ty }, { x: s.lx, y: s.ly }); continue; }
                list.push(s);
            }
            if (!list.length) { updateCommandMessageText('Zoom étendu : le dessin est vide.'); return; }
            zoomToFitShapes(list); draw(); updateCommandMessageText('Zoom étendu : tout le dessin est cadré (double-clic molette).');
        }
        function zoomToFitShapes(shapeList) {
            let xs = [], ys = [];
            for (const s of shapeList) {
                if (s.points) { for (const p of s.points) { xs.push(p.x); ys.push(p.y); } }
                else if (s.x1 !== undefined) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); }
                else if (s.r !== undefined) { xs.push(s.x - s.r, s.x + s.r); ys.push(s.y - s.r, s.y + s.r); }
                else if (s.x !== undefined) { xs.push(s.x); ys.push(s.y); }
            }
            if (xs.length === 0) return;
            const minX = arrMin(xs), maxX = arrMax(xs);
            const minY = arrMin(ys), maxY = arrMax(ys);
            const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            // Zoom pour que le dessin tienne dans 85% de l'écran
            const zx = (canvas.width * 0.85) / w, zy = (canvas.height * 0.85) / h;
            camera.zoom = Math.min(zx, zy);
            camera.x = canvas.width / 2 - cx * camera.zoom;
            camera.y = canvas.height / 2 - cy * camera.zoom;
        }

        // --- Menus déroulants Fichier (JSON / DXF) ---
        function toggleFileMenu(which, ev) {
            if (ev) ev.stopPropagation();
            const target = document.getElementById('menu-' + which);
            if (target) target.classList.toggle('hidden');
        }
        function closeFileMenus() {
            const d = document.getElementById('menu-dxf');
            if (d) d.classList.add('hidden');
            const bm = document.getElementById('menu-blocks'); if (bm) bm.classList.add('hidden'); if (mode !== 'wall') { const bp = document.getElementById('btn-paroi'); if (bp) bp.classList.remove('active'); }
        }
        // Tiroirs : ils glissent entre l'en-tête et la barre de commande, qui restent visibles
        function mcDrawerBounds() {
            const h = document.querySelector('header'), c = document.getElementById('command-bar'), R = document.documentElement.style;
            if (h) R.setProperty('--mc-top', Math.max(0, Math.round(h.getBoundingClientRect().bottom)) + 'px');
            if (c && c.offsetParent) R.setProperty('--mc-bot', Math.max(0, Math.round(innerHeight - c.getBoundingClientRect().top)) + 'px');
        }
        mcDrawerBounds(); addEventListener('resize', mcDrawerBounds);
        try { const ro = new ResizeObserver(mcDrawerBounds); ['command-bar'].forEach(id => { const e = document.getElementById(id); if (e) ro.observe(e); }); const h = document.querySelector('header'); if (h) ro.observe(h); } catch (e) {}
        // Échap referme aussi les tiroirs Fichier et Blocs
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return; const open = ['menu-dxf', 'menu-blocks'].some(id => { const m = document.getElementById(id); return m && !m.classList.contains('hidden'); });
            if (open) { closeFileMenus(); e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
        // Fermer les menus si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (e.target.isConnected && !e.target.closest('#btn-blocks') && !e.target.closest('#btn-paroi') && !e.target.closest('#menu-blocks')) { const bm = document.getElementById('menu-blocks'); if (bm) bm.classList.add('hidden'); if (mode !== 'wall') { const bp = document.getElementById('btn-paroi'); if (bp) bp.classList.remove('active'); } }
            if (!e.target.closest('#btn-dxf-menu') && !e.target.closest('#menu-dxf')) { const d = document.getElementById('menu-dxf'); if (d) d.classList.add('hidden'); }
        });

        function exportDXFFile() {
            const dxf = exportDXF().replace(/\r?\n/g, '\r\n');
            const blob = new Blob([encodeCp1252(dxf)], { type: "application/dxf" });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
            a.download = "plan_momo_" + new Date().getTime() + ".dxf"; a.click();
            URL.revokeObjectURL(url);
        }

