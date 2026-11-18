        // =====================================================================
        // PAROIS : une droite porte une composition de couches (s.wall = { align, layers:[{ mat, e (mm) }] }).
        // Elle s'étire, se déplace, pivote comme une droite ; chaque couche est dessinée avec son motif de coupe.
        // =====================================================================
        const WALL_MATS = {
            beton:   { name: 'Béton', fill: '#cbd5e1', ink: '#334155', line: '#cbd5e1' },
            brique:  { name: 'Brique / briquette', fill: '#fecaca', ink: '#7f1d1d', line: '#f87171' },
            parpaing:{ name: 'Parpaing', fill: '#d6d3d1', ink: '#44403c', line: '#a78bfa' },
            isolant: { name: 'Isolant (laine)', fill: '#fef08a', ink: '#713f12', line: '#facc15' },
            pse:     { name: 'Isolant (PSE)', fill: '#e0f2fe', ink: '#075985', line: '#38bdf8' },
            placo:   { name: 'Plaque de plâtre', fill: '#f5f5f4', ink: '#57534e', line: '#f472b6' },
            enduit:  { name: 'Enduit', fill: '#e7e5e4', ink: '#57534e', line: '#a3e635' },
            bois:    { name: 'Bois / ossature', fill: '#fde68a', ink: '#78350f', line: '#f59e0b' },
            sable:   { name: 'Sable', fill: '#fef3c7', ink: '#92400e', line: '#fcd34d' },
            gnt:     { name: 'Grave (GNT)', fill: '#e7e5e4', ink: '#44403c', line: '#d6d3d1' },
            pierre:  { name: 'Pierre / enrochement', fill: '#d6d3d1', ink: '#292524', line: '#e7e5e4' },
            terre:   { name: 'Terre (terrain)', fill: '#d6b88a', ink: '#78350f', line: '#a16207' },
            air:     { name: "Lame d'air", fill: null, ink: '#64748b', line: '#94a3b8' },
            metal:   { name: 'Métal (ossature)', fill: '#9ca3af', ink: '#374151', line: '#cbd5e1' },
        };
        // Parois indépendantes : un seul matériau chacune, tracées en traits (contour) sur un calque coloré par matériau.
        // On superpose soi-même (ex. béton puis isolant puis placo, côte à côte) et on recoupe les angles (Couper, Prolonger…).
        const WALL_PRESETS = [
            { id: 'w-beton20', name: 'Voile béton', layers: [['beton', 200]] },
            { id: 'w-parp20', name: 'Parpaing', layers: [['parpaing', 200]] },
            { id: 'w-brique', name: 'Brique', layers: [['brique', 200]] },
            { id: 'w-laine140', name: 'Isolant laine', layers: [['isolant', 100]] },
            { id: 'w-pse', name: 'Isolant PSE', layers: [['pse', 140]] },
            { id: 'w-placo', name: 'Placo BA13', layers: [['placo', 13]] },
            { id: 'w-enduit', name: 'Enduit', layers: [['enduit', 15]] },
            { id: 'w-bois', name: 'Ossature bois', layers: [['bois', 145]] },
            { id: 'w-air', name: "Lame d'air", layers: [['air', 20]] },
        ];
        let wallOpt = { e: 0, align: 'gauche' };   // épaisseur imposée (0 = celle de la paroi) et côté du tracé
        try { Object.assign(wallOpt, JSON.parse(localStorage.getItem('momocad-wallopt') || '{}')); } catch (e) {}
        function wallOptSave() { try { localStorage.setItem('momocad-wallopt', JSON.stringify(wallOpt)); } catch (e) {} }
        const wallThick = (w) => w.layers.reduce((a, l) => a + (+l.e || 0), 0);
        function wallBase(w) { const T = wallThick(w); return w.align === 'axe' ? -T / 2 : w.align === 'droite' ? -T : 0; }
        // bandes (polygones monde) de chaque couche ; n = normale à gauche du sens de tracé
        function wallBands(s, dx, dy) {
            const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); if (L < 1e-9) return [];
            const ux = (s.x2 - s.x1) / L, uy = (s.y2 - s.y1) / L, nx = uy, ny = -ux, k = mmToWorld(1); let o = wallBase(s.wall);
            return s.wall.layers.map(l => { const e = +l.e || 0, a = o * k, b = (o + e) * k; o += e;
                return { l, L, e, o: a, ux, uy, nx, ny, x0: s.x1 + dx + nx * a, y0: s.y1 + dy + ny * a,
                    pts: [[s.x1 + dx + nx * a, s.y1 + dy + ny * a], [s.x2 + dx + nx * a, s.y2 + dy + ny * a], [s.x2 + dx + nx * b, s.y2 + dy + ny * b], [s.x1 + dx + nx * b, s.y1 + dy + ny * b]] }; });
        }
        function wallRand(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
        // motif d'une couche dans son repère (x le long de la paroi, y dans l'épaisseur), en mm
        // motifs de coupe des matériaux (repère local en mm : x le long de la paroi, y dans l'épaisseur e) ; sc = échelle des hachures du calque
        function wallPattern(c, mat, Lmm, e, px, sc) {
            sc = sc > 0 ? sc : 1;
            // seule la partie à l'écran est dessinée, et les détails plus petits qu'un pixel sont omis : une longue paroi vue de loin ne coûte presque rien
            let X0 = 0, X1 = Lmm, P = px;
            try { const m = c.getTransform(), iv = m.inverse(), W = c.canvas.width, Hc = c.canvas.height; P = Math.hypot(m.a, m.b) || px;
                const xs = [[0, 0], [W, 0], [0, Hc], [W, Hc]].map(([x, y]) => iv.a * x + iv.c * y + iv.e), ys = [[0, 0], [W, 0], [0, Hc], [W, Hc]].map(([x, y]) => iv.b * x + iv.d * y + iv.f);
                const m2 = Math.max(e, 0) + 10 / P; X0 = Math.max(0, Math.min(...xs) - m2); X1 = Math.min(Lmm, Math.max(...xs) + m2);
                if (X0 > X1 || Math.max(...ys) < -10 / P || Math.min(...ys) > e + 10 / P) return; } catch (err) {}
            const thin = (st, minPx) => st * P < minPx ? st * Math.ceil(minPx / (st * P)) : st;   // espacement relevé tant qu'il fait moins de minPx pixels
            const from = (x0, st) => x0 + Math.max(0, Math.floor((X0 - x0) / st)) * st;   // premier motif visible, en gardant la même trame
            const diag = (st, ang) => { st = thin(st, 3); const t = Math.tan(ang), ex = e / Math.abs(t), a0 = X0 - ex - st, x0 = Math.floor(a0 / st) * st; for (let x = x0; x < X1 + ex + st; x += st) { c.moveTo(x, 0); c.lineTo(x + e / t, e); } };   // hachures inclinées : elles débordent d'une épaisseur des deux côtés (sinon un coin reste vide)
            c.beginPath();
            if (mat === 'metal') { c.save(); c.fillStyle = c.strokeStyle; c.globalAlpha *= 0.55; c.fillRect(Math.max(0, X0), 0, Math.min(Lmm, X1) - Math.max(0, X0), e); c.restore(); return; }   // ossature métallique : plein
            if (mat === 'isolant') {   // laine : boucles régulières sur l'épaisseur
                const st = Math.max(e * 0.55, 8) * sc;
                if (st * P < 3) { c.moveTo(X0, e / 2); c.lineTo(X1, e / 2); }
                else { const i0 = Math.max(0, Math.floor(X0 / st - 1) * 40);
                    for (let i = i0; ; i++) { const t = i / 40, x = t * st + st * 0.55 * Math.sin(t * 2 * Math.PI), y = e / 2 - e * 0.42 * Math.cos(t * 2 * Math.PI); if (x > X1 + st || x > Lmm + st) break; i > i0 ? c.lineTo(x, y) : c.moveTo(x, y); } }
            } else if (mat === 'beton') {   // béton : hachures à 45° espacées + granulats (triangles et points) répartis sur une grille
                diag(60 * sc, Math.PI / 4); c.lineWidth = 0.7 / px; c.stroke(); c.beginPath();
                const g = 36 * sc, r = Math.min(7 * sc, e * 0.12);
                if (g * P >= 4 && r * P >= 0.6) for (let ix = Math.max(0, Math.floor(X0 / g) - 1), x = ix * g; x < X1 + g && x < Lmm + g; x += g, ix++) for (let y = g / 2, iy = 0; y < e; y += g, iy++) { const k = ix * 131 + iy * 17, px0 = x + (wallRand(k) - 0.5) * g * 0.7, py0 = y + (wallRand(k + 5) - 0.5) * g * 0.6; if (py0 < r || py0 > e - r) continue;
                    if (k % 3) { c.moveTo(px0 + r * 0.32, py0); c.arc(px0, py0, r * 0.32, 0, 7); } else { const a = wallRand(k + 9) * 6.28; c.moveTo(px0 + r * Math.cos(a), py0 + r * Math.sin(a)); c.lineTo(px0 + r * Math.cos(a + 2.1), py0 + r * Math.sin(a + 2.1)); c.lineTo(px0 + r * Math.cos(a + 4.2), py0 + r * Math.sin(a + 4.2)); c.closePath(); } }
            } else if (mat === 'brique') {   // maçonnerie de brique : hachures serrées à 45°
                diag(22 * sc, Math.PI / 4);
            } else if (mat === 'parpaing') {   // blocs de 50 cm (taille réelle) à deux alvéoles, et hachure large à 45°
                const det = 190 * P >= 3; for (let x = Math.floor(X0 / 500) * 500; x < Math.min(Lmm, X1 + 500); x += 500) { c.moveTo(x, 0); c.lineTo(x, e); if (det) { c.rect(x + 40, e * 0.22, 190, e * 0.56); c.rect(x + 270, e * 0.22, 190, e * 0.56); } }
                c.lineWidth = 1 / px; c.stroke(); c.beginPath(); diag(80 * sc, -Math.PI / 4); c.lineWidth = 0.5 / px; c.stroke(); return;
            } else if (mat === 'pse') {   // polystyrène : billes sur une grille décalée
                const g = 22 * sc, r = Math.min(4.5 * sc, e * 0.2);
                if (g * P >= 4 && r * P >= 0.6) for (let y = g / 2, j = 0; y < e; y += g * 0.866, j++) for (let x = from((j % 2) * g / 2, g); x < X1 + g && x < Lmm + g; x += g) { c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); }
            } else if (mat === 'placo' || mat === 'enduit') {   // pointillé fin
                const st = Math.max(e * 1.4, 12) * sc; if (st * P >= 4 && e * 0.12 * P >= 0.5) for (let x = from(st / 2, st); x < Math.min(Lmm, X1 + st); x += st) { c.moveTo(x + e * 0.12, e / 2); c.arc(x, e / 2, e * 0.12, 0, 7); }
            } else if (mat === 'sable') {   // sable : semis de points fins, sans hachure
                const g = thin(14 * sc, 7), r = Math.min(g * 0.11, e * 0.08); if (r * P >= 0.35) for (let ix = Math.max(0, Math.floor(X0 / g) - 1), x = ix * g; x < X1 + g && x < Lmm + g; x += g, ix++) for (let y = g / 2, iy = 0; y < e; y += g * 0.8, iy++) { const k = ix * 977 + iy * 131, qx = x + (wallRand(k) - 0.5) * g * 0.9, qy = y + (wallRand(k + 5) - 0.5) * g * 0.6; if (qy < r || qy > e - r) continue; c.moveTo(qx + r, qy); c.arc(qx, qy, r, 0, 7); }
                c.fillStyle = c.strokeStyle; c.fill(); return;
            } else if (mat === 'gnt') {   // grave non traitée : petits cailloux anguleux et ronds, de tailles variées, sans hachure
                const g = thin(34 * sc, 12), f = g / (34 * sc); for (let ix = Math.max(0, Math.floor(X0 / g) - 1), x = ix * g; x < X1 + g && x < Lmm + g; x += g, ix++) for (let y = g / 2, iy = 0; y < e; y += g * 0.85, iy++) { const k = ix * 613 + iy * 97, r = Math.min((4 + wallRand(k + 2) * 7) * sc * f, e * 0.3), qx = x + (wallRand(k) - 0.5) * g * 0.7, qy = y + (wallRand(k + 5) - 0.5) * g * 0.5;
                    if (qy < r || qy > e - r) continue; if (k % 3 === 0) { c.moveTo(qx + r, qy); c.arc(qx, qy, r * 0.8, 0, 7); } else { const m = 4 + (k % 3), a0 = wallRand(k + 7) * 6.28; for (let j = 0; j <= m; j++) { const a = a0 + j / m * 6.283, rr = r * (0.7 + 0.3 * wallRand(k + j)); j ? c.lineTo(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr) : c.moveTo(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr); } } }
            } else if (mat === 'pierre') {   // pierres / enrochement : gros blocs irréguliers jointifs, sans hachure
                const g = thin(260 * sc, 14), rows = Math.max(1, Math.round(e / g)), h = e / rows; for (let row = 0; row < rows; row++) { const y0 = row * h, off = (row % 2) * g * 0.5;
                    for (let x = Math.floor((X0 - off) / g) * g + off - g; x < Math.min(Lmm, X1) + g; x += g) { const k = Math.round(x / g) * 53 + row * 7, w0 = g * (0.86 + 0.1 * wallRand(k)), hy = h * (0.84 + 0.1 * wallRand(k + 1)), cx = x + g / 2, cy = y0 + h / 2, pts = 7;
                        for (let j = 0; j <= pts; j++) { const a = j / pts * 6.283, rx = w0 / 2 * (0.82 + 0.18 * wallRand(k + 11 * j % 77)), ry = hy / 2 * (0.82 + 0.18 * wallRand(k + 13 * j % 91)), px2 = cx + Math.cos(a) * rx, py2 = Math.max(0.5, Math.min(e - 0.5, cy + Math.sin(a) * ry)); j ? c.lineTo(px2, py2) : c.moveTo(px2, py2); } } }
            } else if (mat === 'terre') {   // terre en place : petits groupes de 3 traits obliques en quinconce
                const st = thin(60 * sc, 6), h = st * 0.32;
                for (let y = st / 2, k = 0; y < e + st; y += st * 0.7, k++) for (let x = from((k % 2) * st / 2, st); x < X1 + st; x += st) for (let j = -1; j <= 1; j++) { const xx = x + j * h * 0.6; c.moveTo(xx - h / 2, y + h / 2); c.lineTo(xx + h / 2, y - h / 2); }
            } else if (mat === 'bois') {   // bois : fil ondulé régulier et quelques nœuds
                const st = thin(18 * sc, 3), w = 90 * sc, dw = Math.max(w / 8, 2 / P), xa = Math.max(0, Math.floor(X0 / w) * w), xb = Math.min(Lmm + w, X1 + w);
                for (let y0 = st / 2, k = 0; y0 < e; y0 += st, k++) { c.moveTo(xa, y0 + Math.sin(xa / w * 2 * Math.PI + k * 0.9) * st * 0.18); for (let x = xa; x <= xb; x += dw) c.lineTo(x, y0 + Math.sin(x / w * 2 * Math.PI + k * 0.9) * st * 0.18); }
                if (26 * sc * P >= 2) for (let k = Math.max(0, Math.floor((X0 - 300 * sc) / (600 * sc))), x = 300 * sc + k * 600 * sc; x < Math.min(Lmm, X1 + 600 * sc); x += 600 * sc, k++) { const y = e * (0.3 + 0.4 * wallRand(k + 3)), rx = Math.min(e * 0.22, 26 * sc); c.moveTo(x + rx, y); c.ellipse(x, y, rx, rx * 0.55, 0, 0, 7); }
            }
            c.lineWidth = 1 / px; c.stroke();
        }
        function drawWall(c, s, dx, dy, ls, sel, isPrinting) {
            const bands = wallBands(s, dx, dy), k = mmToWorld(1), pxPerMm = k * ls;
            bands.forEach(b => {
                const M = WALL_MATS[b.l.mat] || WALL_MATS.air;
                c.save(); c.beginPath(); b.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
                if (b.e * pxPerMm > 4) {   // motif seulement s'il est lisible
                    c.clip(); c.translate(b.x0, b.y0); c.transform(b.ux * k, b.uy * k, b.nx * k, b.ny * k, 0, 0); c.strokeStyle = isPrinting ? M.ink : (M.line || M.ink); c.setLineDash([]); wallPattern(c, b.l.mat, worldToMm(b.L), b.e, pxPerMm, layerHatchScale(s));
                }
                c.restore();
                c.save(); c.setLineDash([]); c.strokeStyle = sel ? '#ec4899' : (isPrinting ? '#000' : '#9ca3af'); c.lineWidth = (sel ? 2 : 0.8) / ls; c.beginPath(); b.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke(); c.restore();
            });
        }
        function wallFromPreset(p) { return { align: 'gauche', layers: p.layers.map(([mat, e]) => ({ mat, e })) }; }
        function wallThumb(p) {
            const cv = document.createElement('canvas'); cv.width = cv.height = 120; const c = cv.getContext('2d'), w = wallFromPreset(p), T = wallThick(w), k = Math.min(100 / Math.max(T * 1.25, 1), 0.3);
            c.translate(60 - T * k / 2, 10); c.scale(k, k);   // coupe verticale : couches côte à côte, 100 px de haut
            let x = 0; w.layers.forEach(l => { const M = WALL_MATS[l.mat] || WALL_MATS.air; c.save(); c.beginPath(); c.rect(x, 0, l.e, 100 / k); c.clip();
                c.translate(x, 0); c.transform(0, 1, 1, 0, 0, 0); c.strokeStyle = M.line || M.ink; wallPattern(c, l.mat, 100 / k, l.e, k); c.restore();
                c.strokeStyle = M.line || '#e5e7eb'; c.lineWidth = 2.5 / k; c.strokeRect(x, 0, l.e, 100 / k); x += l.e; });
            return cv.toDataURL();
        }
        // tracé d'une paroi : clic début, clic fin (ou longueur + Entrée) ; les parois s'enchaînent
        let wallTool = null, wallStart = null;
        const WALL_ALIAS = { 'w-beton16': ['w-beton20', 160], 'w-laine100': ['w-laine140', 100], 'w-parp15': ['w-parp20', 150] };   // types retirés (même matériau, autre épaisseur) : l'épaisseur se règle
        // PAROIS COMPLEXES : un sandwich de couches tracé d'un seul bloc (cloison, doublage, ossature), avec des montants tous les N mm dans une couche
        const WALL_CX = [
            { id: 'cx-72', name: 'Cloison 72/48', layers: [['placo', 13], ['isolant', 46], ['placo', 13]], studs: { li: 1, mat: 'metal', w: 35, sp: 600 } },
            { id: 'cx-98', name: 'Cloison 98/48', layers: [['placo', 13], ['placo', 13], ['isolant', 46], ['placo', 13], ['placo', 13]], studs: { li: 2, mat: 'metal', w: 35, sp: 600 } },
            { id: 'cx-dbl', name: 'Doublage 13 + 75', layers: [['isolant', 75], ['placo', 13]], studs: { li: 0, mat: 'metal', w: 35, sp: 600 } },
            { id: 'cx-mob', name: 'Ossature bois 145', layers: [['placo', 13], ['isolant', 145], ['bois', 12]], studs: { li: 1, mat: 'bois', w: 45, sp: 600 } },
            { id: 'cx-bet', name: 'Béton 20 + doublage', layers: [['beton', 200], ['isolant', 100], ['placo', 13]], studs: { li: 1, mat: 'metal', w: 35, sp: 600 } },
        ];
        let wallCxUser = []; try { wallCxUser = JSON.parse(localStorage.getItem('momocad-wallcx') || '[]') || []; } catch (e) {}
        let wallCxEdit = null;   // composition en cours dans l'onglet Complexes
        const wallCxAll = () => WALL_CX.concat(wallCxUser);
        function wallCxTool(d) { return { align: wallOpt.align, cx: d.name || 'Complexe', layers: d.layers.map(([mat, e]) => ({ mat, e: +e })), studs: d.studs && d.studs.sp > 0 && d.studs.w > 0 ? Object.assign({}, d.studs) : null, name: d.name }; }
        function startWallCx(d) { if (!d || !d.layers || !d.layers.length) return; closeFileMenus(); setMode('wall'); wallTool = wallCxTool(d); wallStart = null; wallChain = null; typedInput = ''; updateCommandMessage(); draw(); }
        function startWall(id) { if (WALL_ALIAS[id]) { const [to, e] = WALL_ALIAS[id], p0 = WALL_PRESETS.find(x => x.id === to); if (!p0) return; closeFileMenus(); setMode('wall'); wallTool = wallFromPreset(p0); wallTool.name = p0.name; wallTool.align = wallOpt.align; wallTool.layers[0].e = e; wallStart = null; wallChain = null; typedInput = ''; updateCommandMessage(); draw(); return; }
            const p = WALL_PRESETS.find(x => x.id === id); if (!p) return; closeFileMenus(); setMode('wall'); wallTool = wallFromPreset(p); wallTool.name = p.name; wallTool.align = wallOpt.align; if (wallOpt.e > 0) wallTool.layers[0].e = wallOpt.e; wallStart = null; wallChain = null; typedInput = ''; updateCommandMessage(); draw(); }
        // contour d'une paroi : 4 traits indépendants (faces + extrémités), sur le calque « Paroi <matériau> » de la couleur du matériau
        function wallSegs(x1, y1, x2, y2, w) { const B = wallBands({ x1, y1, x2, y2, wall: w }, 0, 0); if (!B.length) return []; const q = [B[0].pts[0], B[0].pts[1], B[B.length - 1].pts[2], B[B.length - 1].pts[3]]; return [[q[0], q[1]], [q[1], q[2]], [q[2], q[3]], [q[3], q[0]]]; }
        function wallLayerId(w) { const mat = w.layers[0].mat, M = WALL_MATS[mat] || WALL_MATS.air, id = ensureLayer('Paroi ' + M.name.toLowerCase(), M.line || '#ffffff'), l = layers.find(x => x.id === id);
            if (l && !String(l.hatch || '').startsWith('m-')) l.hatch = 'm-' + mat; return id; }
        function wallRect(x1, y1, x2, y2, w) { const B = wallBands({ x1, y1, x2, y2, wall: w }, 0, 0); return B.length ? [B[0].pts[0], B[0].pts[1], B[B.length - 1].pts[2], B[B.length - 1].pts[3]].map(q => ({ x: q[0], y: q[1] })) : null; }
        // Chaîne de parois : à chaque nouveau tronçon, la chaîne entière est redessinée avec des jonctions en onglet (bissectrice, 45° à l'équerre).
        // Faces et motifs se raccordent sur la ligne d'onglet ; extrémités seulement au début et à la fin (aucune si la chaîne est refermée).
        let wallChain = null;   // { pts:[{x,y}], shapes:[], lid, closed }
        function wallChainGeom(P, w, closed) { const k = mmToWorld(1), b0 = wallBase(w), T = wallThick(w); return wallChainGeomRaw(P, closed, b0 * k, (b0 + T) * k); }
        function wallChainGeomRaw(P, closed, oa, ob) {
            const k = mmToWorld(1), n = P.length, ns = closed ? n : n - 1;
            const U = []; for (let i = 0; i < ns; i++) { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; U.push({ x: (b.x - a.x) / L, y: (b.y - a.y) / L }); }
            const joint = (o, v) => {
                const ip = (v > 0 || closed) ? (v - 1 + ns) % ns : -1, inx = (v < ns || closed) ? v % ns : -1, V = P[v % n];
                const one = (u) => ({ x: V.x + u.y * o, y: V.y - u.x * o });
                if (ip < 0 || (!closed && v === n - 1 && inx >= ns)) return one(U[ip < 0 ? inx : ip]);
                if (inx < 0) return one(U[ip]);
                const u1 = U[ip], u2 = U[inx], A = one(u1), B = one(u2), den = u1.x * u2.y - u1.y * u2.x;
                if (Math.abs(den) < 1e-9) return B;
                const t = ((B.x - A.x) * u2.y - (B.y - A.y) * u2.x) / den, X = { x: A.x + u1.x * t, y: A.y + u1.y * t };
                return Math.hypot(X.x - V.x, X.y - V.y) > 20 * Math.max(Math.abs(oa), Math.abs(ob), k) ? B : X;   // angle trop aigu : pas d'onglet
            };
            const segs = [];
            for (let i = 0; i < ns; i++) { const j = closed ? (i + 1) % n : i + 1; segs.push({ A0: joint(oa, i), A1: joint(oa, j), B1: joint(ob, j), B0: joint(ob, i), first: !closed && i === 0 }); }
            return segs;
        }
        function wallChainShapes(P, w, closed, lid, gid, wz) {
            if (w.cx) return wallChainShapesCx(P, w, closed, gid, wz);
            const out = [], mat = w.layers[0].mat, tag = (o) => { o.groupId = gid; o.wallMat = mat; if (wz) o.wz = Object.assign({}, wz); return o; };
            const L = (a, b) => tag({ type: 'line', layerId: lid, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
            wallChainGeom(P, w, closed).forEach(g => {
                const seg = [];
                if (mat !== 'air') seg.push(tag({ type: 'hatch', layerId: lid, loops: [[g.A0, g.A1, g.B1, g.B0].map(q => ({ x: q.x, y: q.y }))] }));
                seg.push(L(g.A0, g.A1), L(g.B0, g.B1), L(g.A1, g.B1)); if (g.first) seg.push(L(g.A0, g.B0));
                out.push(...seg); out.last = seg;
            });
            return out;
        }
        // paroi complexe : une bande hachurée par couche (sur le calque de son matériau), les faces et les limites entre couches, les montants dans leur couche ;
        //      tout le tronçon forme un seul bloc (même groupe), sans fusion avec les autres parois
        function wallChainShapesCx(P, w, closed, gid, wz) {
            const out = [], k = mmToWorld(1), b0 = wallBase(w), tag = (o, mat) => { o.groupId = gid; o.wallMat = mat; o.wallCx = w.cx; if (wz) o.wz = Object.assign({}, wz); return o; };
            const ln = (a, b, mat) => tag({ type: 'line', layerId: wallLayerId({ layers: [{ mat }] }), x1: a.x, y1: a.y, x2: b.x, y2: b.y }, mat);
            let o = b0; const bands = w.layers.map(l => { const r = { l, oa: o * k, ob: (o + (+l.e || 0)) * k, o0: o }; o += +l.e || 0; return r; });
            const segsN = closed ? P.length : P.length - 1, seg = [];
            for (let i = 0; i < segsN; i++) seg.push([]);
            bands.forEach((b, bi) => { const S = wallChainGeomOff(P, closed, b.oa, b.ob); S.forEach((g, i) => { if (b.l.mat !== 'air') seg[i].push(tag({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat: b.l.mat }] }), loops: [[g.A0, g.A1, g.B1, g.B0].map(q => ({ x: q.x, y: q.y }))] }, b.l.mat));
                seg[i].push(ln(g.A0, g.A1, b.l.mat)); if (bi === bands.length - 1) seg[i].push(ln(g.B0, g.B1, b.l.mat)); }); });
            // bouts : en travers de toute l'épaisseur, au début et à la fin d'une chaîne ouverte
            const all = wallChainGeomOff(P, closed, bands[0].oa, bands[bands.length - 1].ob); if (!closed && all.length) { seg[0].push(ln(all[0].A0, all[0].B0, bands[0].l.mat)); const L = all[all.length - 1]; seg[seg.length - 1].push(ln(L.A1, L.B1, bands[0].l.mat)); }
            // montants : dans leur couche, tous les « sp » mm (entraxe) depuis le début de chaque tronçon, plus un à chaque bout
            const S = w.studs, sb = S && bands[S.li]; if (sb && S.sp > 0 && S.w > 0) for (let i = 0; i < segsN; i++) { const a = P[i], c = P[(i + 1) % P.length], L = Math.hypot(c.x - a.x, c.y - a.y); if (L < 1e-9) continue; const ux = (c.x - a.x) / L, uy = (c.y - a.y) / L, nx = uy, ny = -ux, sw = S.w * k, sp = S.sp * k;
                const T = []; for (let t = sw / 2; t <= L - sw / 2 + 1e-9; t += sp) T.push(t); if (!T.length || L - sw / 2 - T[T.length - 1] > sw) T.push(L - sw / 2);
                T.forEach(t => { const q = (tt, oo) => ({ x: a.x + ux * tt + nx * oo, y: a.y + uy * tt + ny * oo }); seg[i].push(tag({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat: S.mat }] }), loops: [[q(t - sw / 2, sb.oa), q(t + sw / 2, sb.oa), q(t + sw / 2, sb.ob), q(t - sw / 2, sb.ob)]], stud: 1 }, S.mat)); }); }
            seg.forEach(x => out.push(...x)); out.last = seg[seg.length - 1] || []; return out; }
        // géométrie d'une chaîne pour une bande [oa, ob] (monde, depuis le tracé, vers la gauche) : onglets aux angles
        const wallChainGeomOff = (P, closed, oa, ob) => wallChainGeomRaw(P, closed, oa, ob);
        // FUSION DES PAROIS : en fin de tracé, les parois de même matériau (même calque, mêmes niveaux) qui se touchent ou se chevauchent
        // ne font plus qu'un seul contour : plus de hachures superposées ni de traits en travers aux jonctions (ouvertures gardées)
        function wallFuse(newShapes) {
            let H0 = (newShapes || []).filter(isWallHatch); if (!H0.length) return Promise.resolve(0);
            return loadPolyClip().then(() => {
                const PC0 = window.polygonClipping, ring0 = (l) => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; }, poly0 = (h) => (h.loops || []).map(ring0);
                // parois d'un autre matériau déjà en place : la nouvelle s'arrête contre elles (aucune superposition)
                const others = shapes.filter(x => isWallHatch(x) && !H0.includes(x) && x.loops && x.loops[0]), minA = Math.pow(mmToWorld(20), 2), redo = new Set();
                H0.slice().forEach(h => { const O = others.filter(o => o.wallMat !== h.wallMat && (!h.wz || !o.wz || !(hasZ(o.wz.t) && hasZ(h.wz.b) && o.wz.t <= h.wz.b) && !(hasZ(h.wz.t) && hasZ(o.wz.b) && h.wz.t <= o.wz.b)));
                    if (!O.length) return; let I; try { I = PC0.intersection(poly0(h), PC0.union(...O.map(poly0))); } catch (err) { return; }
                    const ia = I.reduce((a, pg) => a + Math.abs(polyArea(pg[0].slice(0, -1).map(([x, y]) => ({ x, y })))), 0); if (ia < minA) return;
                    let D; try { D = PC0.difference(poly0(h), PC0.union(...O.map(poly0))); } catch (err) { return; }
                    const parts = D.map(pg => pg.map(r => r.slice(0, -1).map(([x, y]) => ({ x, y })))).filter(L => Math.abs(polyArea(L[0])) > minA);
                    if (!parts.length) { shapes = shapes.filter(x => x !== h); H0 = H0.filter(x => x !== h); if (h.groupId) redo.add(h.groupId); return; }
                    h.loops = parts[0]; parts.slice(1).forEach(L => { const c = Object.assign({}, h, { loops: L }); delete c.openings; shapes.push(c); H0.push(c); }); if (h.groupId) redo.add(h.groupId); });
                redo.forEach(g => { const hs = shapes.filter(x => x.groupId === g && isWallHatch(x)), mat = (hs[0] || {}).wallMat, ln = shapes.filter(x => x.groupId === g && x.type === 'line' && x.wallMat), proto = ln[0];
                    if (!hs.length || !proto) return; let U; try { U = PC0.union(...hs.map(poly0)); } catch (err) { return; }
                    shapes = shapes.filter(x => !ln.includes(x));
                    U.forEach(pg => pg.forEach(r => { const L = r.slice(0, -1); L.forEach(([ax, ay], k) => { const [bx, by] = L[(k + 1) % L.length]; if (Math.hypot(bx - ax, by - ay) > 1e-9) shapes.push(Object.assign({}, proto, { x1: ax, y1: ay, x2: bx, y2: by })); }); })); });
                if (!H0.length) { wallBordersRepair(); return redo.size ? 1 : 0; }
                const PC = window.polygonClipping, sameKey = (h) => [h.wallMat, h.layerId, JSON.stringify(h.wz || null)].join('|'), key = sameKey(H0[0]);
                const ring = (l) => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; }, poly = (h) => (h.loops || []).map(ring);
                const cand = shapes.filter(x => isWallHatch(x) && sameKey(x) === key && x.loops && x.loops[0] && x.loops[0].length >= 3), groupOf = (h) => h.groupId ? shapes.filter(x => x.groupId === h.groupId) : [h];
                // grappe : les nouvelles parois puis tout ce qui les touche, de proche en proche
                const inC = new Set(H0.filter(h => cand.includes(h))); let grew = true, guard = 0;
                const e = mmToWorld(2), grow = (h) => { try { const g = PC.union(poly(h).map((r, k) => k ? r : r)); return g; } catch (err) { return null; } };
                while (grew && guard++ < 50) { grew = false; const U = [...inC].map(poly);
                    cand.forEach(h => { if (inC.has(h)) return; try { const bbA = h.loops[0]; const hit = U.some(u => { const r = PC.union(u, poly(h)); return r.length < 2; }); if (hit) { inC.add(h); grew = true; } } catch (err) {} });
                    [...inC].forEach(h => groupOf(h).filter(x => isWallHatch(x) && sameKey(x) === key).forEach(x => { if (!inC.has(x)) { inC.add(x); grew = true; } })); }
                if (inC.size < 2) { wallBordersRepair(); return redo.size ? 1 : 0; }
                let U; try { U = PC.union(...[...inC].map(poly)); } catch (err) { return 0; }
                const members = [...inC], groups = new Set(members.map(h => h.groupId).filter(Boolean)), lid = members[0].layerId, mat = members[0].wallMat, wz = members[0].wz, gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
                const tag = (o) => { o.groupId = gid; o.wallMat = mat; if (wz) o.wz = Object.assign({}, wz); return o; }, out = [];
                // hachures : chaque tronçon garde son sens de motif ; les nouveaux sont recoupés par les anciens (plus de chevauchement)
                const olds = members.filter(h => !H0.includes(h)), oldU = olds.length ? PC.union(...olds.map(poly)) : null, keep = [];
                members.forEach(h => { if (!H0.includes(h) || !oldU) { keep.push(h); return; }
                    let D; try { D = PC.difference(poly(h), oldU); } catch (err) { D = null; } if (!D) { keep.push(h); return; }
                    D.forEach(pg => { const nh = Object.assign({}, h, { loops: pg.map(r => r.slice(0, -1).map(([x, y]) => ({ x, y }))) }); delete nh.openings; if (Math.abs(polyArea(nh.loops[0])) > Math.pow(mmToWorld(20), 2)) out.push(nh); });
                    if (h.openings && h.openings.length) (out[0] || keep[0] || h).openings = ((out[0] || keep[0] || h).openings || []).concat(h.openings); });
                keep.forEach(h => { tag(h); }); out.forEach(tag);
                // contour : celui de l'ensemble fusionné, sans trait aux jonctions
                U.forEach(pg => pg.forEach(r => { const L = r.slice(0, -1); L.forEach(([ax, ay], k) => { const [bx, by] = L[(k + 1) % L.length]; if (Math.hypot(bx - ax, by - ay) > 1e-9) out.push(tag({ type: 'line', layerId: lid, x1: ax, y1: ay, x2: bx, y2: by })); }); }));
                const drop = new Set(members.filter(h => H0.includes(h) && oldU)); shapes.forEach(x => { if (x.groupId && groups.has(x.groupId) && x.type === 'line' && x.wallMat === mat) drop.add(x); });
                shapes = shapes.filter(x => !drop.has(x)).concat(out); wallBordersRepair(); return members.length;   /* tronçons d'un groupe restés hors de la fusion (autre bâtiment, autres niveaux) : leurs bordures sont refaites */
            }, () => 0);
        }
        // BORDURES DES PAROIS : chaque côté libre d'une paroi a son trait. Un côté sans trait (ni contre une autre paroi du même matériau, ni dans une ouverture)
        //      reçoit le sien. Sert après une fusion et à l'ouverture d'un plan (plans abîmés par l'ancienne fusion : bordures disparues).
        function wallBordersRepair() { const H = shapes.filter(h => isWallHatch(h) && h.loops && h.loops[0] && h.loops[0].length >= 3), L = shapes.filter(x => x.type === 'line' && x.wallMat), eps = mmToWorld(3), add = [];
            const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
            H.forEach(h => { const P = h.loops[0], n = P.length; let A2 = 0; for (let i = 0; i < n; i++) A2 += P[i].x * P[(i + 1) % n].y - P[(i + 1) % n].x * P[i].y; const sg = A2 > 0 ? 1 : -1;
                const Lm = L.filter(l => l.wallMat === h.wallMat), others = H.filter(o => o !== h && o.wallMat === h.wallMat), ops = h.openings || [];
                for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y); if (len < mmToWorld(5)) continue;
                    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, nx = (b.y - a.y) / len * sg, ny = -(b.x - a.x) / len * sg, out = { x: m.x + nx * eps, y: m.y + ny * eps };
                    if (Lm.some(l => segD(m, { x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }) < eps)) continue;   // déjà bordé
                    if (others.some(o => o.loops && o.loops[0] && pointInPolygon(out.x, out.y, o.loops[0]))) continue;   // jonction avec une paroi du même matériau
                    if (ops.some(o => o && o.pts && (pointInPolygon(m.x, m.y, o.pts) || o.pts.some((q, k) => segD(m, q, o.pts[(k + 1) % o.pts.length]) < eps)))) continue;   // ouverture
                    add.push({ type: 'line', layerId: h.layerId, x1: a.x, y1: a.y, x2: b.x, y2: b.y, wallMat: h.wallMat, groupId: h.groupId, zk: h.zk, lvs: h.lvs, bid: h.bid, lvl: h.lvl, wz: h.wz ? Object.assign({}, h.wz) : undefined }); } });
            add.forEach(x => { Object.keys(x).forEach(k => x[k] === undefined && delete x[k]); shapes.push(x); }); return add.length; }
        function wallChainEnd() { const C = wallChain; if (!C || !C.shapes || !C.shapes.length) return; const S = C.shapes.filter(x => shapes.includes(x)); if (S.some(x => x.wallCx)) return;   /* paroi complexe : déjà d'un seul bloc */ wallFuse(S).then(n => { if (n >= 1) { saveState(); invalidateCache(); draw(); updateCommandMessageText(n > 1 ? 'PAROI : ' + n + ' tronçons en contact fusionnés en un seul contour.' : 'PAROI : arrêtée contre la paroi existante, sans chevauchement.'); } }); }
        function wallAddTo(x2, y2) {
            // chaîne perdue (annuler, autre paroi…) : on repart du point courant
            if (!wallChain || wallChain.shapes.some(sh => !shapes.includes(sh)) || wallChain.closed) wallChain = { pts: [{ x: wallStart.x, y: wallStart.y }], shapes: [], lid: wallLayerId(wallTool), gid: 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 100000) };
            const C = wallChain, P0 = C.pts[0], tol = 8 / camera.zoom;
            let closed = C.pts.length >= 3 && Math.hypot(x2 - P0.x, y2 - P0.y) < tol;
            if (!closed) C.pts.push({ x: x2, y: y2 });
            shapes = shapes.filter(sh => !C.shapes.includes(sh));
            const wzKeep = C.shapes.length && C.shapes[0].wz ? C.shapes[0].wz : null;
            C.shapes = wallChainShapes(C.pts, wallTool, closed, C.lid, C.gid, wzKeep); C.last = new Set(C.shapes.last || []);
            shapes.push(...C.shapes); saveState(); typedInput = '';
            if (closed) { C.closed = true; wallChainEnd(); wallStart = null; wallChain = null; updateCommandMessageText('PAROI : contour refermé, angles en onglet. Cliquez un nouveau début, ou Échap.'); }
            else wallStart = { x: x2, y: y2 };
            draw();
        }
        // Aperçu : le dernier tronçon posé est masqué et redessiné avec son futur onglet, suivi du tronçon en cours
        function wallChainLive() { return mode === 'wall' && wallTool && wallStart && wallChain && !wallChain.closed && wallChain.last && wallChain.shapes.every(sh => shapes.includes(sh)) ? wallChain : null; }
        // point d'arrivée réel du tronçon : même règle que le clic (ortho / Maj) et que la longueur tapée
        function wallTarget(px, py, shift) {
            const a = wallStart;
            if (typedInput && parseFloat(typedInput) > 0) {
                const d = (parseFloat(typedInput) / unitsPerSquare) * GRID_SIZE, a0 = Math.atan2(py - a.y, px - a.x), an = (orthoMode || shift) ? Math.round(a0 / (Math.PI / 2)) * Math.PI / 2 : a0;
                return { x: a.x + d * Math.cos(an), y: a.y + d * Math.sin(an) };
            }
            if (orthoMode || shift) { if (Math.abs(px - a.x) > Math.abs(py - a.y)) py = a.y; else px = a.x; }
            return { x: px, y: py };
        }
        document.addEventListener('keyup', (e) => { if (e.key === 'Shift') { shiftHeld = false; if (mode === 'wall') draw(); } });
        document.addEventListener('keydown', (e) => { if (e.key === 'Shift' || e.shiftKey) shiftHeld = true; }, true);   // Maj maintenue (même pour taper les chiffres en AZERTY)
        // =====================================================================
        // POIGNÉES (mode Sélection) : sommets ▪ = déplacent le sommet seul (l'objet se déforme, il reste un seul objet) ;
        // milieu d'une droite / centre ▪ = déplacent l'objet ; milieu d'un côté ▬ = pousse / tire ce côté en gardant son orientation ;
        // cercle / arc : quadrants = rayon, extrémités d'arc = angles. Bloc verrouillé : une seule poignée qui le déplace en entier.
        // =====================================================================
        let gripDrag = null, gripHover = null;
        const GRIP_MAX = 60;
        function gripsOf(s) {
            const G = [], P = (x, y, kind, i, ang) => G.push({ s, x, y, kind, i, ang });
            if (s.type === 'line' || s.type === 'slope') { P(s.x1, s.y1, 'l-end', 1); P(s.x2, s.y2, 'l-end', 2); P((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 'move'); }
            else if (s.type === 'poly') {
                const n = s.points.length, st = s.curve || 0;
                s.points.forEach((q, i) => { if (!st || i % st === 0 || i === n - 1) P(q.x, q.y, 'p-vtx', i); });
                if (!st) { const ne = s.open ? n - 1 : n; for (let i = 0; i < ne; i++) { const a = s.points[i], b = s.points[(i + 1) % n]; P((a.x + b.x) / 2, (a.y + b.y) / 2, 'p-edge', i, Math.atan2(b.y - a.y, b.x - a.x)); } }
                else { const c = shapeCenterOf(s); if (c) P(c.x, c.y, 'move'); }
            }
            else if (s.type === 'circle') { P(s.x, s.y, 'move'); [0, 1, 2, 3].forEach(k => P(s.x + s.r * Math.cos(k * Math.PI / 2), s.y + s.r * Math.sin(k * Math.PI / 2), 'c-rad')); }
            else if (s.type === 'arc') {
                P(s.x, s.y, 'move'); P(s.x + s.r * Math.cos(s.startAngle), s.y + s.r * Math.sin(s.startAngle), 'a-end', 0); P(s.x + s.r * Math.cos(s.endAngle), s.y + s.r * Math.sin(s.endAngle), 'a-end', 1);
                let a1 = s.endAngle; if (s.anticlockwise) { while (a1 > s.startAngle) a1 -= 2 * Math.PI; } else { while (a1 < s.startAngle) a1 += 2 * Math.PI; } const m = (s.startAngle + a1) / 2; P(s.x + s.r * Math.cos(m), s.y + s.r * Math.sin(m), 'c-rad');
            }
            else if (s.type === 'text' || s.type === 'point') P(s.x, s.y, 'move');
            return G;
        }
        function shapeCenterOf(s) { const pts = s.points || (s.loops && s.loops[0]); if (!pts || !pts.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pts.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }); return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; }
        function allGrips() {
            if (mode !== 'select-box' || !selectedShapes.length || moveTypedX !== null || typedInput) return [];
            const out = [], seenG = new Set();
            for (const s of selectedShapes) {
                if (out.length > GRIP_MAX * 6) break;
                // ouvertures du mur sélectionné : une poignée au milieu de chacune de leurs deux faces, pour les étirer sur les autres couches
                if (isWallHatch(s) && s.openings) s.openings.forEach((o, oi) => { const p = o.pts; if (!p) return; [[p[0], p[1]], [p[3], p[2]]].forEach(([a, b], k) => out.push({ s, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'op-face', i: k, oi, ang: Math.atan2(b.y - a.y, b.x - a.x) }));
                    // et ses deux bouts (largeur, le long du mur) et son milieu (la faire glisser le long du mur)
                    if (o.a && o.b) { out.push({ s, x: o.a.x, y: o.a.y, kind: 'op-end', i: 0, oi }, { s, x: o.b.x, y: o.b.y, kind: 'op-end', i: 1, oi }, { s, x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2, kind: 'op-move', i: 2, oi }); } });
                if (s.groupId) {   // bloc : une poignée au centre du bloc
                    if (seenG.has(s.groupId)) continue; seenG.add(s.groupId);
                    const mem = selectedShapes.filter(x => x.groupId === s.groupId), b = getShapesBoundingBox(mem);
                    if (b) out.push({ s, x: b.centerX, y: b.centerY, kind: 'g-move', group: mem }); continue;
                }
                if (isBg(s) || s.type === 'mesh' || s.type === 'pdfvec') continue;
                out.push(...gripsOf(s));
            }
            return selectedShapes.length > GRIP_MAX ? [] : out;
        }
        function gripAt(sx, sy) {
            let best = null, bd = 7;
            for (const g of allGrips()) { const d = Math.hypot(g.x * camera.zoom + camera.x - sx, g.y * camera.zoom + camera.y - sy); if (d <= bd) { bd = d; best = g; } }
            return best;
        }
        function startGrip(g) {
            const targets = g.group || [g.s];
            gripDrag = { g, x0: g.x, y0: g.y, targets, orig: targets.map(t => JSON.stringify(t)) };
            targets.forEach(t => t._nosnap = true); invalidateCache();
            updateCommandMessageText('POIGNÉE : déplacez puis cliquez / relâchez (accroches actives, Maj / F8 = ortho, Échap = annuler).');
        }
        function gripApply(X, Y, shift) {
            const D = gripDrag; if (!D) return; const g = D.g;
            D.targets.forEach((t, k) => { const o = JSON.parse(D.orig[k]); Object.keys(t).forEach(key => { if (key !== '_nosnap') delete t[key]; }); Object.assign(t, o); });
            if ((orthoMode || shift) && g.kind !== 'c-rad' && g.kind !== 'a-end') { if (Math.abs(X - D.x0) > Math.abs(Y - D.y0)) Y = D.y0; else X = D.x0; }
            const dx = X - D.x0, dy = Y - D.y0, s = g.s;
            if (g.kind === 'move' || g.kind === 'g-move') D.targets.forEach(t => translateShape(t, dx, dy));
            else if (g.kind === 'l-end') { s['x' + g.i] = X; s['y' + g.i] = Y; }
            else if (g.kind === 'p-vtx') {
                const st = s.curve || 0, n = s.points.length;
                if (!st) { s.points[g.i].x = X; s.points[g.i].y = Y; }
                else for (let j = 0; j < n; j++) {   // courbe : le point d'ancrage entraîne les tronçons voisins en douceur
                    let dIdx = Math.abs(j - g.i); if (!s.open) dIdx = Math.min(dIdx, n - dIdx);
                    const w = dIdx >= st ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * dIdx / st); if (w > 0) { s.points[j].x += dx * w; s.points[j].y += dy * w; }
                }
            }
            else if (g.kind === 'p-edge') {
                const n = s.points.length, a = s.points[g.i], b = s.points[(g.i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, pr = dx * nx + dy * ny;
                a.x += nx * pr; a.y += ny * pr; b.x += nx * pr; b.y += ny * pr;
            }
            else if (g.kind === 'op-face') { const o = (s.openings || [])[g.oi]; if (o) { const tt = opStretchTT(o), r = opStretchT({ x: X, y: Y }, o), k = g.i;
                const t = r.t + (r.snapped ? (r.inner ? -mmToWorld(0.5) : r.e) * Math.sign(r.t - tt[1 - k]) : 0); if (Math.abs(t - tt[1 - k]) > mmToWorld(20)) { tt[k] = t; o.tt = tt[0] < tt[1] ? tt : [tt[1], tt[0]]; o.pts = openingPts(s, o.a, o.b, o.tt); } } }
            else if (g.kind === 'op-end' || g.kind === 'op-move') { const o = (s.openings || [])[g.oi]; if (o && o.a && o.b) { const L = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, u = { x: (o.b.x - o.a.x) / L, y: (o.b.y - o.a.y) / L };
                if (g.kind === 'op-move') { const d = dx * u.x + dy * u.y; o.a = { x: o.a.x + u.x * d, y: o.a.y + u.y * d }; o.b = { x: o.b.x + u.x * d, y: o.b.y + u.y * d }; }
                else { const F = g.i === 0 ? o.b : o.a, sg = g.i === 0 ? -1 : 1, l = ((X - F.x) * u.x + (Y - F.y) * u.y) * sg; if (l > mmToWorld(50)) { const q = { x: F.x + u.x * l * sg, y: F.y + u.y * l * sg }; if (g.i === 0) o.a = q; else o.b = q; } }
                o.pts = openingPts(s, o.a, o.b, o.tt); updateCommandMessageText('OUVERTURE : largeur ' + calculateRealDistance(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y)) + ' (accroches actives ; cliquez / relâchez pour poser, Échap = annuler).'); } }
            else if (g.kind === 'c-rad') { const r = Math.hypot(X - s.x, Y - s.y); if (r > 1e-9) s.r = r; }
            else if (g.kind === 'a-end') { const an = Math.atan2(Y - s.y, X - s.x); if (g.i === 0) s.startAngle = an; else s.endAngle = an; }
        }
        function endGrip(cancel) {
            const D = gripDrag; if (!D) return;
            if (cancel) D.targets.forEach((t, k) => { const o = JSON.parse(D.orig[k]); Object.keys(t).forEach(key => delete t[key]); Object.assign(t, o); });
            D.targets.forEach(t => delete t._nosnap); gripDrag = null; invalidateCache();
            if (!cancel) saveState();
            updateCommandMessageText(cancel ? 'POIGNÉE : annulé.' : 'POIGNÉE : objet modifié.'); draw();
        }
        function drawGrips(c) {
            const spm = document.getElementById('selparam-modal');
            if (spm && (!spm.classList.contains('hidden') || spDirPick) && selectedShapes.length === 1 && selectedShapes[0].type === 'poly') {   // numéros des sommets (fenêtre Y)
                c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
                selectedShapes[0].points.forEach((q, i) => { const X = q.x * camera.zoom + camera.x, Y = q.y * camera.zoom + camera.y; c.fillStyle = '#1d4ed8'; c.beginPath(); c.arc(X + 12, Y - 12, 9, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillText(String(i + 1), X + 12, Y - 11.5); });
                c.restore();
            }
            if (gripDrag && /^op-/.test(gripDrag.g.kind)) { const o = (gripDrag.g.s.openings || [])[gripDrag.g.oi]; if (o && o.a && o.b) t2Label(c, (o.a.x + o.b.x) / 2, (o.a.y + o.b.y) / 2, 'largeur ' + calculateRealDistance(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y))); }
            const G = gripDrag ? [] : allGrips(); if (!G.length) return;
            const t = 4.5 / camera.zoom; c.save(); c.setLineDash([]); c.lineWidth = 1 / camera.zoom;
            for (const g of G) {
                const hot = gripHover && gripHover.s === g.s && gripHover.kind === g.kind && gripHover.i === g.i && Math.abs(gripHover.x - g.x) < 1e-9;
                c.fillStyle = hot ? '#f97316' : '#1d74f5'; c.strokeStyle = '#dbeafe';
                if ((g.kind === 'op-face' || g.kind === 'op-end' || g.kind === 'op-move') && !hot) { c.fillStyle = '#f59e0b'; c.strokeStyle = '#fef3c7'; }
                if (g.kind === 'op-move') { c.beginPath(); c.arc(g.x, g.y, t * 1.1, 0, 2 * Math.PI); c.fill(); c.stroke(); continue; }
                if (g.kind === 'p-edge' || g.kind === 'op-face') { c.save(); c.translate(g.x, g.y); c.rotate(g.ang); c.fillRect(-t * 1.7, -t * 0.7, t * 3.4, t * 1.4); c.strokeRect(-t * 1.7, -t * 0.7, t * 3.4, t * 1.4); c.restore(); }
                else { c.fillRect(g.x - t, g.y - t, 2 * t, 2 * t); c.strokeRect(g.x - t, g.y - t, 2 * t, 2 * t); }
            }
            c.restore();
        }
