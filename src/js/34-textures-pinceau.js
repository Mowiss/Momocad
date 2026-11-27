        // =====================================================================
        // TEXTURES : peinture des volumes 3D (béton, brique, bois, tuiles…). L'objet garde s.tex ;
        // les textures sont dessinées par le programme (aucun fichier à télécharger), plaquées en vraie grandeur.
        // =====================================================================
        function texRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        const texSpeck = (c, n, cols, rmax, R) => { for (let i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(R() * cols.length)]; const r = 0.4 + R() * rmax; c.fillRect(R() * 256, R() * 256, r, r); } };
        const texRows = (c, rows, cols, gap, joint, colors, R, offset) => { c.fillStyle = joint; c.fillRect(0, 0, 256, 256); const h = 256 / rows, w = 256 / cols;
            for (let j = 0; j < rows; j++) { const off = (j % 2) && offset ? w / 2 : 0; for (let i = -1; i <= cols; i++) { c.fillStyle = colors[Math.floor(R() * colors.length)]; c.fillRect(i * w + off + gap / 2, j * h + gap / 2, w - gap, h - gap); } } };
        // générateurs de motifs (256 px qui se répètent) : mouchetis, rangs, lames, gravillons, pierres…
        const TG = {
            fill: (c, col) => { c.fillStyle = col; c.fillRect(0, 0, 256, 256); },
            speck: (c, R, base, cols, n, r) => { TG.fill(c, base); texSpeck(c, n, cols, r, R); },
            rgb: (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`,
            vary: (R, [r, g, b], v) => { const k = 1 + (R() - 0.5) * v; return TG.rgb(r * k, g * k, b * k); },
            rows: (c, R, rows, cols, gap, joint, base, v, offset, round) => { TG.fill(c, joint); const h = 256 / rows, w = 256 / cols;
                for (let j = 0; j < rows; j++) { const off = (j % 2) && offset ? w / 2 : 0; for (let i = -1; i <= cols; i++) { c.fillStyle = TG.vary(R, base, v); const x = i * w + off + gap / 2, y = j * h + gap / 2;
                    if (round && c.roundRect) { c.beginPath(); c.roundRect(x, y, w - gap, h - gap, round); c.fill(); } else c.fillRect(x, y, w - gap, h - gap); } } },
            planks: (c, R, n, base, v, grain, gap, horiz, joints) => { const w = 256 / n; c.save(); if (horiz) { c.translate(0, 256); c.rotate(-Math.PI / 2); }
                for (let i = 0; i < n; i++) { const segs = joints ? 2 : 1; for (let s2 = 0; s2 < segs; s2++) { const y0 = joints ? ((s2 * 128 + (i % 2) * 64) % 256) : 0, L = joints ? 128 : 256;
                    for (const yy of joints && y0 + L > 256 ? [y0, y0 - 256] : [y0]) { c.fillStyle = TG.vary(R, base, v); c.fillRect(i * w, yy, w, L); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; if (joints) { c.beginPath(); c.moveTo(i * w, yy + .5); c.lineTo(i * w + w, yy + .5); c.stroke(); } } }
                    c.strokeStyle = grain; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const x0 = i * w + 3 + R() * (w - 6), ph = R() * 6.28; c.beginPath(); c.moveTo(x0, 0); for (let y = 0; y <= 256; y += 8) c.lineTo(x0 + Math.sin(y / 256 * 6.283 * 2 + ph) * 1.8, y); c.stroke(); }
                    c.fillStyle = gap; c.fillRect(i * w, 0, 1.6, 256); }
                c.restore(); },
            gravel: (c, R, base, [r, g, b], n, rmin, rmax) => { TG.fill(c, base); for (let i = 0; i < n; i++) { const k = 0.75 + R() * 0.5; c.fillStyle = TG.rgb(r * k, g * k, b * k); const x = R() * 256, y = R() * 256, rx = rmin + R() * (rmax - rmin), ry = rx * (0.6 + R() * 0.4), a = R() * 3;
                [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]].forEach(([dx, dy]) => { if ((dx && Math.abs(x + dx - 128) > 128 + rmax) || (dy && Math.abs(y + dy - 128) > 128 + rmax)) return; c.beginPath(); c.ellipse(x + dx, y + dy, rx, ry, a, 0, 7); c.fill(); }); } },
            stones: (c, R, joint, base, v, hMin, hMax, wMin, wMax, round, gap) => { TG.fill(c, joint); const H = [], tot = (() => { let y = 0; while (y < 256) { const h = hMin + R() * (hMax - hMin); H.push(Math.min(h, 256 - y < hMin ? 256 - y : h)); y += H[H.length - 1]; } return y; })(); let y = 0;
                H.forEach(h0 => { const h = h0 * 256 / tot, x0 = -R() * wMax, end = x0 + 256; let x = x0; while (x < end - 1) { let w = wMin + R() * (wMax - wMin); if (x + w > end - wMin * 0.6) w = end - x; c.fillStyle = TG.vary(R, base, v); for (const dx of [0, 256]) { c.beginPath(); if (c.roundRect) c.roundRect(x + dx + gap, y + gap, w - 2 * gap, h - 2 * gap, round); else c.rect(x + dx + gap, y + gap, w - 2 * gap, h - 2 * gap); c.fill(); } x += w; } y += h; });
                texSpeck(c, 1400, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.1)'], 1.5, R); },
            /* pierres brutes hourdées : mortier gris granuleux, pierres irrégulières (contour cabossé, bord éclairé en haut à gauche, ombre en bas à droite, surface bosselée), éclats calés dans les joints ; raccord sans couture */
            rubble: (c, R, mortar, base, v) => { TG.fill(c, mortar); texSpeck(c, 5200, ['rgba(0,0,0,.16)', 'rgba(255,255,255,.14)', 'rgba(60,55,50,.18)'], 1.6, R);
                const W9 = [-256, 0, 256], stone = (cx, cy, rx, ry, col, flat) => { const n = 7 + Math.floor(R() * 5), P = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + (R() - 0.5) * 0.5, k = 0.88 + R() * 0.22; P.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k * (flat && Math.sin(a) > 0 ? 0.93 : 1)]); }
                    const path = (ox, oy, sc) => { c.beginPath(); P.forEach(([x, y], i) => { const X = cx + ox + x * sc, Y = cy + oy + y * sc; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); };
                    W9.forEach(dx => W9.forEach(dy => { if (Math.abs(cx + dx - 128) > 128 + rx + 4 || Math.abs(cy + dy - 128) > 128 + ry + 4) return;
                        c.fillStyle = 'rgba(40,36,32,.45)'; path(dx + 1.8, dy + 2.2, 1); c.fill();   // ombre portée dans le joint
                        c.fillStyle = col; path(dx, dy, 1); c.fill(); c.save(); path(dx, dy, 1); c.clip();
                        const g = c.createLinearGradient(cx + dx - rx, cy + dy - ry, cx + dx + rx, cy + dy + ry); g.addColorStop(0, 'rgba(255,250,235,.32)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(50,40,30,.34)'); c.fillStyle = g; c.fillRect(cx + dx - rx, cy + dy - ry, rx * 2, ry * 2);
                        for (let k = 0; k < 6 + (rx * ry) / 60; k++) { const x = cx + dx + (R() - 0.5) * rx * 1.8, y = cy + dy + (R() - 0.5) * ry * 1.8, r = 4 + R() * Math.min(rx, ry) * 0.5, m = 3 + Math.floor(R() * 3); c.fillStyle = R() < 0.5 ? 'rgba(255,248,232,.2)' : 'rgba(80,62,40,.2)'; c.beginPath(); for (let q = 0; q < m; q++) { const a = q / m * 6.283 + R(), d = r * (0.5 + R() * 0.6); q ? c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8) : c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8); } c.closePath(); c.fill(); }   // facettes taillées par éclats
                        if (R() < 0.6) { c.fillStyle = 'rgba(170,110,50,.18)'; c.beginPath(); c.ellipse(cx + dx + (R() - 0.5) * rx, cy + dy + (R() - 0.5) * ry, rx * (0.3 + R() * 0.4), ry * (0.3 + R() * 0.4), R() * 3, 0, 7); c.fill(); }   // veine ocre
                        texSpeck(c, Math.floor(rx * ry / 3), ['rgba(0,0,0,.12)', 'rgba(255,255,255,.14)', 'rgba(150,110,60,.15)'], 1.4, R);
                        c.strokeStyle = 'rgba(255,250,240,.35)'; c.lineWidth = 1.2; path(dx - 0.6, dy - 0.6, 0.97); c.stroke(); c.restore(); })); };
                // assises de hauteurs inégales, pierres de largeurs variées, décalées au hasard
                const H = []; let t = 0; while (t < 256) { const h = 60 + R() * 40; H.push(h); t += h; } const kH = 256 / t; let y = 0;
                H.forEach(h0 => { const h = h0 * kH, x0 = R() * 256; let x = 0; while (x < 256 - 24) { let w = 64 + R() * 70; if (x + w > 256 - 40) w = 256 - x; const cx = (x0 + x + w / 2) % 256;
                    if (R() < 0.22 && h > 60) { const h1 = h * (0.4 + R() * 0.2); stone(cx, y + h1 / 2, w / 2 - 2 - R() * 3, h1 / 2 - 1.5, TG.vary(R, base, v), true); stone(cx + (R() - 0.5) * 8, y + h1 + (h - h1) / 2, w / 2 - 3 - R() * 5, (h - h1) / 2 - 1.5, TG.vary(R, base, v), true); }   // deux pierres plates l'une sur l'autre
                    else stone(cx, y + h / 2 + (R() - 0.5) * 5, Math.max(12, w / 2 - 1 - R() * 3), Math.max(12, h / 2 - 1.5 - R() * 3), TG.vary(R, base, v), true);
                    if (R() < 0.5) stone((x0 + x + w + (R() - 0.5) * 4) % 256, y + (R() < 0.5 ? 5 : h - 5), 6 + R() * 9, 2.5 + R() * 2.5, TG.vary(R, base, v * 1.3), true);   // éclat calé dans le joint
                    x += w; } y += h; }); },
            /* pisé : terre damée par couches horizontales (lits ondulés de 15 à 20 cm), teinte ocre, gravillons pris dans la terre, chaque lit plus dense et plus sombre vers le bas, joint de lit marqué ; raccord sans couture */
            pise: (c, R, base, v, n) => { const wav = () => { const A = [1, 2, 3, 5].map(f => [f, (R() - 0.5) * (11 / f), R() * 6.283]); return (x) => A.reduce((s0, [f, a, ph]) => s0 + a * Math.sin(x / 256 * 6.283 * f + ph), 0); };
                const L = []; for (let i = 0; i < n; i++) L.push({ y: i * 256 / n, f: i ? wav() : null, col: TG.vary(R, base, v) }); L[0].f = (x) => 0;
                const yAt = (i, x) => { const l = L[(i % n + n) % n]; return Math.floor(i / n) * 256 + l.y + l.f(x); };
                for (let i = -1; i <= n; i++) { const l = L[(i % n + n) % n]; for (let x = 0; x < 256; x += 2) { const y0 = yAt(i, x), y1 = yAt(i + 1, x), g = c.createLinearGradient(0, y0, 0, y1); const [r, gg, b] = l.col.match(/\d+/g).map(Number);
                    g.addColorStop(0, TG.rgb(r * 1.08, gg * 1.08, b * 1.06)); g.addColorStop(0.75, TG.rgb(r, gg, b)); g.addColorStop(1, TG.rgb(r * 0.82, gg * 0.8, b * 0.78)); c.fillStyle = g; c.fillRect(x, y0, 2.2, y1 - y0 + 0.5); } }
                for (let k = 0; k < 7000; k++) { const x = R() * 256, y = R() * 256, r = 0.5 + R() * R() * 3.2; c.fillStyle = ['rgba(90,40,15,.35)', 'rgba(255,225,180,.3)', 'rgba(120,60,25,.3)', 'rgba(60,30,15,.3)', 'rgba(240,200,150,.25)'][Math.floor(R() * 5)]; c.beginPath(); c.ellipse(x, y, r, r * (0.6 + R() * 0.4), R() * 3, 0, 7); c.fill(); }
                for (let i = 0; i < n; i++) { c.strokeStyle = 'rgba(70,32,12,.42)'; c.lineWidth = 1.6; c.beginPath(); for (let x = 0; x <= 256; x += 4) { const y = yAt(i, x); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
                    c.strokeStyle = 'rgba(255,220,180,.22)'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= 256; x += 4) { const y = yAt(i, x) + 1.6; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } },
            joints: (c, col, dx, dy, w) => { c.strokeStyle = col; c.lineWidth = w || 1.5; for (let x = 0; x < 256; x += dx) { c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, 256); c.stroke(); } for (let y = 0; y < 256; y += dy) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(256, y + .5); c.stroke(); } },
            blobs: (c, R, n, cols, rmin, rmax, alpha) => { for (let i = 0; i < n; i++) { c.globalAlpha = alpha; c.fillStyle = cols[Math.floor(R() * cols.length)]; const x = R() * 256, y = R() * 256, r = rmin + R() * (rmax - rmin); [0, 256, -256].forEach(dx => [0, 256, -256].forEach(dy => { c.beginPath(); c.ellipse(x + dx, y + dy, r, r * (0.6 + R() * 0.4), R() * 3, 0, 7); c.fill(); })); } c.globalAlpha = 1; },
        };
        // catalogues de textures (ordre d'affichage)
        const TEX_CATS = [['beton', 'Béton'], ['maconnerie', 'Maçonnerie'], ['bois', 'Bois'], ['enduit', 'Enduits'], ['sol', 'Sols extérieurs'], ['couverture', 'Couvertures'], ['metal', 'Métal et verre'], ['interieur', 'Intérieur'], ['textile', 'Textiles']];
        const TEX_LIB = [
            { id: 'beton', cat: 'beton', name: 'Béton brut', tile: 2, draw: (c, R) => { c.fillStyle = '#b8b6ae'; c.fillRect(0, 0, 256, 256); texSpeck(c, 2600, ['#a8a59c', '#c9c7bf', '#9d9a91', '#d4d2ca'], 1.6, R); c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 1; [0, 128].forEach(y => { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(256, y + .5); c.stroke(); }); } },
            { id: 'enduit', cat: 'enduit', name: 'Enduit blanc', tile: 1.5, draw: (c, R) => { c.fillStyle = '#ece6da'; c.fillRect(0, 0, 256, 256); texSpeck(c, 3200, ['#e0d9cb', '#f5f0e6', '#d8d0bf'], 2, R); } },
            { id: 'brique', cat: 'maconnerie', name: 'Brique rouge', tile: 0.6, draw: (c, R) => { texRows(c, 8, 2, 4, '#d9d2c5', ['#a94a32', '#b5533a', '#9c4330', '#b9603f', '#a24c36'], R, true); texSpeck(c, 900, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.08)'], 1.5, R); } },
            { id: 'parpaing', cat: 'maconnerie', name: 'Parpaing', tile: 1, draw: (c, R) => { texRows(c, 5, 2, 3, '#8b8b86', ['#a3a39d', '#9b9b95', '#aaa9a2'], R, true); texSpeck(c, 2200, ['#8f8f89', '#b4b3ac'], 1.4, R); } },
            { id: 'pierre', cat: 'maconnerie', name: 'Pierre appareillée', tile: 1, draw: (c, R) => { c.fillStyle = '#6b6559'; c.fillRect(0, 0, 256, 256); const HS = []; let t = 0; while (t < 256) { const h = 34 + R() * 26; HS.push(h); t += h; } let y = 0;   /* rangées et pierres qui se raccordent d'un carreau à l'autre (plus de pierre coupée en deux teintes) */
                HS.forEach(h0 => { const h = h0 * 256 / t, x0 = -R() * 40, end = x0 + 256; let x = x0; while (x < end - 1) { let w = 50 + R() * 50; if (x + w > end - 30) w = end - x; const g = 150 + R() * 50; c.fillStyle = `rgb(${g},${g - 8 - R() * 12},${g - 25 - R() * 15})`; for (const dx of [0, 256]) { c.beginPath(); const r = 7; c.roundRect ? c.roundRect(x + dx + 3, y + 3, w - 6, h - 6, r) : c.rect(x + dx + 3, y + 3, w - 6, h - 6); c.fill(); } x += w; } y += h; }); texSpeck(c, 1200, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.1)'], 1.5, R); } },
            { id: 'bois', cat: 'bois', name: 'Bardage vertical', tile: 1, draw: (c, R) => { const w = 256 / 6; for (let i = 0; i < 6; i++) { const g = 140 + R() * 30; c.fillStyle = `rgb(${g},${g * 0.66 | 0},${g * 0.38 | 0})`; c.fillRect(i * w, 0, w, 256); c.strokeStyle = 'rgba(70,40,15,.35)'; c.lineWidth = 1; for (let k = 0; k < 7; k++) { const x0 = i * w + 4 + R() * (w - 8); c.beginPath(); c.moveTo(x0, 0); for (let y = 0; y <= 256; y += 16) c.lineTo(x0 + Math.sin(y / 30 + k) * 2.5, y); c.stroke(); } c.fillStyle = 'rgba(40,20,5,.6)'; c.fillRect(i * w, 0, 1.5, 256); } } },
            { id: 'enrobe', cat: 'sol', name: 'Enrobé', tile: 1, draw: (c, R) => { c.fillStyle = '#3a3d42'; c.fillRect(0, 0, 256, 256); texSpeck(c, 4500, ['#2b2e33', '#4b4f56', '#5d6168', '#24262a'], 1.8, R); } },
            { id: 'paves', cat: 'sol', name: 'Pavés béton', tile: 0.8, draw: (c, R) => { texRows(c, 8, 4, 4, '#6f6a60', ['#9a948a', '#a8a297', '#8f897f', '#b0aa9f'], R, true); } },
            { id: 'terre', cat: 'sol', name: 'Terre', tile: 2, draw: (c, R) => { c.fillStyle = '#7a5a3a'; c.fillRect(0, 0, 256, 256); texSpeck(c, 3400, ['#8b6a47', '#6b4e31', '#9a7a55', '#5d4329', '#a08060'], 2.2, R); for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(60,40,25,.35)'; c.beginPath(); c.ellipse(R() * 256, R() * 256, 2 + R() * 5, 1 + R() * 3, R() * 3, 0, 7); c.fill(); } } },
            { id: 'pelouse', cat: 'sol', name: 'Pelouse', tile: 1, draw: (c, R) => { c.fillStyle = '#4f7a2e'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { const x = R() * 256, y = R() * 256; c.strokeStyle = ['#5f8f37', '#41682a', '#6ea140', '#3a5d24'][Math.floor(R() * 4)]; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 4); c.stroke(); } } },
            { id: 'gnt', cat: 'sol', name: 'Grave (GNT)', tile: 1.5, draw: (c, R) => { c.fillStyle = '#c9bca2'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { const g = 150 + R() * 95; c.fillStyle = `rgba(${g},${g * 0.93 | 0},${g * 0.8 | 0},${0.5 + R() * 0.5})`; c.beginPath(); c.ellipse(R() * 256, R() * 256, 0.8 + R() * 2.2, 0.6 + R() * 1.6, R() * 3, 0, 7); c.fill(); } for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(120,105,85,${0.25 + R() * 0.3})`; c.fillRect(R() * 256, R() * 256, 1.5, 1.5); } } },
            { id: 'gravier', cat: 'sol', name: 'Gravier', tile: 0.5, draw: (c, R) => { c.fillStyle = '#9b927f'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 1400; i++) { const g = 120 + R() * 110; c.fillStyle = `rgb(${g},${g * 0.95 | 0},${g * 0.85 | 0})`; c.beginPath(); c.ellipse(R() * 256, R() * 256, 1.5 + R() * 3.5, 1.2 + R() * 2.5, R() * 3, 0, 7); c.fill(); } } },
            { id: 'tuile', cat: 'couverture', name: 'Tuile romane', tile: 1, draw: (c, R) => { c.fillStyle = '#6b2e1c'; c.fillRect(0, 0, 256, 256); const rows = 6, cols = 5, h = 256 / rows, w = 256 / cols; for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const x = i * w + ((j % 2) ? w / 2 : 0), y = j * h, g = R(); c.fillStyle = `rgb(${180 + g * 30 | 0},${80 + g * 25 | 0},${45 + g * 15 | 0})`; c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + w - 2, y); c.lineTo(x + w - 2, y + h * 0.75); c.quadraticCurveTo(x + w / 2, y + h * 1.05, x + 2, y + h * 0.75); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 6, y + 3, 4, h * 0.6); } } },
            { id: 'ardoise', cat: 'couverture', name: 'Ardoise', tile: 0.8, draw: (c, R) => { texRows(c, 8, 4, 3, '#1f2530', ['#3d4654', '#46505f', '#363e4b', '#4d5766'], R, true); texSpeck(c, 700, ['rgba(255,255,255,.06)'], 1.2, R); } },
            { id: 'metal', cat: 'couverture', name: 'Bac acier', tile: 1, draw: (c, R) => { c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#7d8792'); g.addColorStop(0.25, '#c3cad2'); g.addColorStop(0.5, '#a2abb5'); g.addColorStop(1, '#848e99'); c.fillStyle = g; c.fillRect(x, 0, 32, 256); } } },
            // textiles (canapés, lits, rideaux, tapis…) : trame tissée, sergé, velours, bouclette, cuir…
            { id: 'tx-lin', cat: 'textile', name: 'Lin naturel', tile: 0.12, draw: (c, R) => { TG.fill(c, '#d8ccb6'); for (let i = 0; i < 256; i += 2) { c.fillStyle = `rgba(${R() < .5 ? '255,250,240' : '120,105,85'},${.12 + R() * .2})`; c.fillRect(0, i, 256, 1 + (R() < .1 ? 1 : 0)); c.fillStyle = `rgba(${R() < .5 ? '255,250,240' : '110,95,75'},${.1 + R() * .18})`; c.fillRect(i, 0, 1, 256); } texSpeck(c, 500, ['rgba(90,75,55,.25)', 'rgba(255,255,255,.25)'], 1.2, R); } },
            { id: 'tx-jean', cat: 'textile', name: 'Toile jean', tile: 0.1, draw: (c, R) => { TG.fill(c, '#2e4a6e'); c.lineWidth = 1.4; for (let k = -256; k < 512; k += 4) { c.strokeStyle = `rgba(${R() < .3 ? '200,215,235' : '160,180,210'},${.25 + R() * .25})`; c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 256, 256); c.stroke(); } texSpeck(c, 900, ['rgba(255,255,255,.18)', 'rgba(0,0,0,.2)'], 1, R); } },
            { id: 'tx-velours', cat: 'textile', name: 'Velours vert', tile: 0.4, draw: (c, R) => { TG.fill(c, '#2f5d4a'); TG.blobs(c, R, 60, ['#3d7560', '#24493a', '#356a55'], 20, 70, .18); texSpeck(c, 2500, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.08)'], 1, R); } },
            { id: 'tx-velours-bleu', cat: 'textile', name: 'Velours bleu nuit', tile: 0.4, draw: (c, R) => { TG.fill(c, '#25324f'); TG.blobs(c, R, 60, ['#34456b', '#1b2540', '#2d3c5e'], 20, 70, .18); texSpeck(c, 2500, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.08)'], 1, R); } },
            { id: 'tx-tweed', cat: 'textile', name: 'Tweed chiné', tile: 0.15, draw: (c, R) => { TG.fill(c, '#7b6f62'); const col = ['#a39684', '#4f463e', '#8c5a3c', '#6b7b6a', '#c9bda8']; c.lineWidth = 1.2; for (let i = 0; i < 3000; i++) { c.strokeStyle = col[Math.floor(R() * col.length)]; const x = R() * 256, y = R() * 256, h = R() < .5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (h ? 4 : 0), y + (h ? 0 : 4)); c.stroke(); } } },
            { id: 'tx-bouclette', cat: 'textile', name: 'Laine bouclette', tile: 0.12, draw: (c, R) => { TG.fill(c, '#e9e3d6'); for (let i = 0; i < 1400; i++) { const x = R() * 256, y = R() * 256, r = 2 + R() * 3; c.strokeStyle = `rgba(${R() < .5 ? '170,160,140' : '255,255,250'},.55)`; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.stroke(); } } },
            { id: 'tx-moquette', cat: 'textile', name: 'Moquette grise', tile: 0.3, draw: (c, R) => { TG.speck(c, R, '#77797c', ['#8a8c90', '#65676a', '#9a9ca0', '#5a5c60'], 9000, 1.4); } },
            { id: 'tx-rayure', cat: 'textile', name: 'Coton rayé', tile: 0.3, draw: (c, R) => { TG.fill(c, '#f3efe6'); for (let x = 0; x < 256; x += 32) { c.fillStyle = '#5b7fa6'; c.fillRect(x, 0, 12, 256); c.fillStyle = 'rgba(91,127,166,.35)'; c.fillRect(x + 16, 0, 3, 256); } for (let i = 0; i < 256; i += 2) { c.fillStyle = `rgba(0,0,0,${R() * .05})`; c.fillRect(0, i, 256, 1); } } },
            { id: 'tx-ecossais', cat: 'textile', name: 'Tartan écossais', tile: 0.3, draw: (c, R) => { TG.fill(c, '#7a1f24'); const band = (x, w, col) => { c.fillStyle = col; c.fillRect(x, 0, w, 256); c.fillRect(0, x, 256, w); }; c.globalAlpha = .55; band(20, 40, '#1f3b2c'); band(150, 40, '#1f3b2c'); band(92, 10, '#1d2a4a'); band(220, 6, '#e8d36a'); c.globalAlpha = 1; for (let k = -256; k < 512; k += 3) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 256, 256); c.stroke(); } } },
            { id: 'tx-berbere', cat: 'textile', name: 'Tapis berbère', tile: 1, draw: (c, R) => { TG.speck(c, R, '#ebe4d4', ['#dcd3bf', '#f5f0e4'], 6000, 1.6); c.strokeStyle = '#3b3530'; c.lineWidth = 3; for (let y = -64; y < 320; y += 128) for (let x = -64; x < 320; x += 128) { c.beginPath(); c.moveTo(x, y - 52); c.lineTo(x + 46, y); c.lineTo(x, y + 52); c.lineTo(x - 46, y); c.closePath(); c.stroke(); } } },
            { id: 'tx-cuir', cat: 'textile', name: 'Cuir cognac', tile: 0.3, draw: (c, R) => { TG.fill(c, '#8a4b25'); TG.blobs(c, R, 80, ['#9b5a30', '#7a3f1d', '#a3623a'], 10, 40, .25); for (let i = 0; i < 1600; i++) { c.fillStyle = 'rgba(40,18,6,.35)'; c.fillRect(R() * 256, R() * 256, 1, 1); } c.strokeStyle = 'rgba(40,18,6,.18)'; c.lineWidth = .8; for (let i = 0; i < 60; i++) { const x = R() * 256, y = R() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - .5) * 30, y + (R() - .5) * 30); c.stroke(); } } },
            { id: 'carrelage', cat: 'interieur', name: 'Carrelage clair', tile: 1.2, draw: (c, R) => { texRows(c, 4, 4, 2, '#9ca3af', ['#e7e5e4', '#f5f5f4', '#e2e0dd', '#ecebe8'], R, false); } },
            { id: 'verre', cat: 'metal', name: 'Verre', tile: 1.5, glass: true, draw: (c, R) => { const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#a5d8f3'); g.addColorStop(1, '#5fa8d3'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 6; [[40, 0, 0, 40], [120, 0, 0, 120], [256, 90, 90, 256]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }); } },
            { id: 'eau', cat: 'metal', name: 'Eau', tile: 2, glass: true, draw: (c, R) => { c.fillStyle = '#2f7fb8'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = R() * 256, y = R() * 256; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 4, x + 20, y); c.stroke(); } } },
            // ---- béton ----
            { id: 'beton-banche', cat: 'beton', name: 'Béton banché', tile: 2.4, draw: (c, R) => { TG.speck(c, R, '#b3b0a8', ['#a4a198', '#c4c2ba', '#98958c'], 2600, 1.5); TG.joints(c, 'rgba(60,60,60,.35)', 128, 128, 1.2); c.fillStyle = 'rgba(40,40,40,.55)'; [32, 96, 160, 224].forEach(x => [32, 96, 160, 224].forEach(y => { if ((x + y) % 128 === 0) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } })); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(R() * 256, R() * 256, 1 + R() * 3, 6 + R() * 30); } } },
            { id: 'beton-lisse', cat: 'beton', name: 'Béton lissé', tile: 2, draw: (c, R) => { TG.speck(c, R, '#cfcdc6', ['#c5c3bb', '#d9d7d0', '#c0beb6'], 1200, 1); TG.blobs(c, R, 40, ['#bdbab2', '#dddbd4'], 10, 40, 0.18); } },
            { id: 'beton-desactive', cat: 'beton', name: 'Béton désactivé', tile: 0.6, draw: (c, R) => TG.gravel(c, R, '#a69f92', [196, 184, 166], 1900, 1.4, 4.2) },
            { id: 'beton-prefa', cat: 'beton', name: 'Panneaux préfabriqués', tile: 3, draw: (c, R) => { TG.speck(c, R, '#c2bfb6', ['#b6b3aa', '#cecbc3'], 2200, 1.3); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, 256, 4); c.fillRect(0, 0, 4, 256); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 4, 256, 2); c.fillRect(4, 0, 2, 256); } },
            { id: 'beton-sombre', cat: 'beton', name: 'Béton anthracite', tile: 2, draw: (c, R) => { TG.speck(c, R, '#5d5f62', ['#525457', '#6a6c70', '#47494c'], 2800, 1.4); } },
            // ---- maçonnerie ----
            { id: 'brique-jaune', cat: 'maconnerie', name: 'Brique jaune', tile: 0.6, draw: (c, R) => { TG.rows(c, R, 8, 2, 4, '#cfc8bb', [214, 176, 110], 0.18, true); texSpeck(c, 900, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.08)'], 1.5, R); } },
            { id: 'brique-flammee', cat: 'maconnerie', name: 'Brique flammée', tile: 0.6, draw: (c, R) => { TG.fill(c, '#3b3633'); const h = 32, w = 128; for (let j = 0; j < 8; j++) for (let i = -1; i <= 2; i++) { const x = i * w + (j % 2 ? 64 : 0) + 2, y = j * h + 2, g = c.createLinearGradient(x, 0, x + w, 0), b = [[120, 52, 38], [90, 48, 40], [150, 80, 55], [70, 40, 35]][Math.floor(R() * 4)]; g.addColorStop(0, TG.rgb(b[0] * 0.8, b[1] * 0.8, b[2] * 0.8)); g.addColorStop(0.5, TG.rgb(...b)); g.addColorStop(1, TG.rgb(b[0] * 0.6, b[1] * 0.6, b[2] * 0.6)); c.fillStyle = g; c.fillRect(x, y, w - 4, h - 4); } texSpeck(c, 900, ['rgba(0,0,0,.15)', 'rgba(255,255,255,.07)'], 1.5, R); } },
            { id: 'brique-blanche', cat: 'maconnerie', name: 'Brique peinte blanche', tile: 0.6, draw: (c, R) => { TG.rows(c, R, 8, 2, 4, '#c9c6bf', [238, 236, 230], 0.05, true); texSpeck(c, 700, ['rgba(0,0,0,.06)'], 1.4, R); } },
            { id: 'pierre-taille', cat: 'maconnerie', name: 'Pierre de taille', tile: 2, draw: (c, R) => { TG.rows(c, R, 4, 2, 3, '#bdb3a0', [226, 214, 188], 0.08, true); texSpeck(c, 2600, ['rgba(120,100,70,.18)', 'rgba(255,255,255,.12)'], 1.3, R); } },
            { id: 'moellons', cat: 'maconnerie', name: 'Moellons', tile: 1.2, draw: (c, R) => TG.stones(c, R, '#8a8274', [172, 160, 138], 0.28, 20, 40, 26, 62, 10, 3) },
            { id: 'pierre-seche', cat: 'maconnerie', name: 'Pierre sèche grise', tile: 1, draw: (c, R) => TG.stones(c, R, '#2f2f2e', [150, 150, 145], 0.3, 12, 28, 30, 80, 4, 1.5) },
            { id: 'galets', cat: 'maconnerie', name: 'Galets', tile: 0.8, draw: (c, R) => TG.gravel(c, R, '#857d70', [182, 176, 164], 260, 7, 15) },
            // gabions (mur de soutènement) : cages de 1 m × 0,5 m remplies de pierres anguleuses, grillage à mailles carrées et fils de cadre
            { id: 'gabions', cat: 'maconnerie', name: 'Gabions (soutènement)', tile: 2, draw: (c, R) => { TG.fill(c, '#3f3b36');
                for (let i = 0; i < 520; i++) { const k = 0.7 + R() * 0.55, t = R(), col = t < 0.5 ? [150, 146, 138] : t < 0.8 ? [176, 160, 132] : [120, 118, 114]; c.fillStyle = TG.rgb(col[0] * k, col[1] * k, col[2] * k); const x = R() * 256, y = R() * 256, r = 5 + R() * 8, m = 5 + Math.floor(R() * 3);
                    c.beginPath(); for (let j = 0; j < m; j++) { const a = j / m * 6.283 + R() * 0.5, rr = r * (0.65 + R() * 0.45); c[j ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke(); }
                c.strokeStyle = 'rgba(205,210,214,.75)'; c.lineWidth = 1; c.beginPath(); for (let v = 0; v <= 256; v += 12.8) { c.moveTo(v, 0); c.lineTo(v, 256); c.moveTo(0, v); c.lineTo(256, v); } c.stroke();
                c.strokeStyle = 'rgba(225,230,234,.95)'; c.lineWidth = 3; c.beginPath(); [0, 128, 256].forEach(x => { c.moveTo(x, 0); c.lineTo(x, 256); }); [0, 64, 128, 192, 256].forEach(y => { c.moveTo(0, y); c.lineTo(256, y); }); c.stroke();
                c.fillStyle = 'rgba(0,0,0,.18)'; [64, 128, 192, 256].forEach(y => c.fillRect(0, y - 4, 256, 3)); } },
            { id: 'parpaing-peint', cat: 'maconnerie', name: 'Parpaing peint', tile: 1, draw: (c, R) => { TG.rows(c, R, 5, 2, 3, '#b9b6ae', [214, 211, 203], 0.04, true); texSpeck(c, 1800, ['rgba(0,0,0,.07)', 'rgba(255,255,255,.12)'], 1.4, R); } },
            // ---- bois ----
            { id: 'bois-clair', cat: 'bois', name: 'Pin clair', tile: 1, draw: (c, R) => TG.planks(c, R, 6, [222, 186, 132], 0.12, 'rgba(150,100,50,.35)', 'rgba(110,70,30,.6)', false, false) },
            { id: 'bois-fonce', cat: 'bois', name: 'Noyer foncé', tile: 1, draw: (c, R) => TG.planks(c, R, 6, [104, 66, 40], 0.2, 'rgba(40,20,8,.45)', 'rgba(20,10,4,.75)', false, false) },
            { id: 'bois-grise', cat: 'bois', name: 'Mélèze grisé', tile: 1, draw: (c, R) => TG.planks(c, R, 6, [150, 146, 138], 0.16, 'rgba(70,66,60,.35)', 'rgba(40,38,34,.7)', false, false) },
            { id: 'bardage-h', cat: 'bois', name: 'Bardage horizontal', tile: 1.2, draw: (c, R) => { TG.planks(c, R, 8, [176, 120, 72], 0.14, 'rgba(80,45,15,.35)', 'rgba(40,20,5,.7)', true, false); for (let y = 0; y < 256; y += 32) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y + 28, 256, 4); } } },
            { id: 'platelage', cat: 'bois', name: 'Lames de terrasse', tile: 1.4, draw: (c, R) => TG.planks(c, R, 8, [160, 104, 66], 0.18, 'rgba(70,40,15,.35)', 'rgba(25,15,5,.85)', false, true) },
            { id: 'parquet', cat: 'bois', name: 'Parquet chêne', tile: 1.2, draw: (c, R) => TG.planks(c, R, 8, [190, 140, 88], 0.16, 'rgba(110,70,30,.3)', 'rgba(60,35,12,.6)', true, true) },
            { id: 'osb', cat: 'bois', name: 'Panneau OSB', tile: 1.2, draw: (c, R) => { TG.fill(c, '#c79c5f'); for (let i = 0; i < 700; i++) { const k = 0.75 + R() * 0.45; c.fillStyle = TG.rgb(205 * k, 160 * k, 100 * k); c.save(); c.translate(R() * 256, R() * 256); c.rotate(R() * 6.28); c.fillRect(-9 - R() * 8, -2.5, 18 + R() * 16, 5 + R() * 3); c.restore(); } } },
            // ---- enduits ----
            { id: 'enduit-gris', cat: 'enduit', name: 'Enduit gris', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#b9b7b1', ['#adaba5', '#c6c4be', '#a29f99'], 3200, 2) },
            { id: 'enduit-ocre', cat: 'enduit', name: 'Enduit ocre', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#d9b27a', ['#cfa66c', '#e3be88', '#c49b62'], 3200, 2) },
            { id: 'enduit-rose', cat: 'enduit', name: 'Enduit rose', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#dcb0a0', ['#d0a291', '#e6bdae', '#c79787'], 3200, 2) },
            { id: 'enduit-pierre', cat: 'enduit', name: 'Enduit ton pierre', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#d8ccb4', ['#ccbfa5', '#e2d7c1', '#c2b49a'], 3200, 2) },
            { id: 'crepi', cat: 'enduit', name: 'Crépi écrasé', tile: 0.8, draw: (c, R) => { TG.fill(c, '#e9e3d6'); TG.blobs(c, R, 900, ['#d9d1c0', '#f6f2ea', '#cfc6b3'], 1.5, 4.5, 0.6); } },
            // ---- sols extérieurs ----
            { id: 'enrobe-rouge', cat: 'sol', name: 'Enrobé rouge', tile: 1, draw: (c, R) => TG.speck(c, R, '#7a3a2e', ['#6a3027', '#8c463a', '#5c2a22', '#9a5546'], 4500, 1.8) },
            { id: 'enrobe-clair', cat: 'sol', name: 'Enrobé grenaillé', tile: 1, draw: (c, R) => TG.speck(c, R, '#77736d', ['#68645e', '#8a857e', '#9c968e', '#5a5651'], 4500, 1.8) },
            { id: 'paves-granit', cat: 'sol', name: 'Pavés granit', tile: 0.6, draw: (c, R) => TG.rows(c, R, 8, 8, 4, '#4a4744', [150, 148, 144], 0.25, true, 3) },
            { id: 'paves-ocre', cat: 'sol', name: 'Pavés béton ocre', tile: 0.8, draw: (c, R) => TG.rows(c, R, 8, 4, 4, '#6b604f', [196, 160, 112], 0.16, true, 2) },
            { id: 'dalles', cat: 'sol', name: 'Dalles 40 × 40', tile: 0.8, draw: (c, R) => { TG.rows(c, R, 2, 2, 4, '#7d7a74', [184, 180, 172], 0.08, false); texSpeck(c, 2400, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.1)'], 1.4, R); } },
            { id: 'stabilise', cat: 'sol', name: 'Stabilisé', tile: 1.5, draw: (c, R) => TG.gravel(c, R, '#cdb98f', [208, 190, 150], 2600, 0.6, 1.8) },
            { id: 'sable', cat: 'sol', name: 'Sable', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#dcc89c', ['#d0bb8d', '#e8d6ad', '#c4ae7f', '#f0e2c0'], 6000, 1.2) },
            { id: 'gravier-blanc', cat: 'sol', name: 'Gravier blanc', tile: 0.5, draw: (c, R) => TG.gravel(c, R, '#bdb9b0', [232, 230, 224], 1500, 1.5, 3.8) },
            { id: 'pelouse-seche', cat: 'sol', name: 'Herbe sèche', tile: 1, draw: (c, R) => { TG.fill(c, '#8a8a4a'); for (let i = 0; i < 2600; i++) { const x = R() * 256, y = R() * 256; c.strokeStyle = ['#9c9a55', '#7a7a3e', '#b0a865', '#6c7a3a'][Math.floor(R() * 4)]; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 4); c.stroke(); } } },
            // ---- couvertures ----
            { id: 'tuile-canal', cat: 'couverture', name: 'Tuile canal', tile: 1, draw: (c, R) => { TG.fill(c, '#5a2a1a'); const w = 32, h = 64; for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { const x = i * w, y = j * h + (i % 2 ? 8 : 0), b = [196 + R() * 30, 104 + R() * 30, 62 + R() * 20], g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, TG.rgb(b[0] * 0.65, b[1] * 0.65, b[2] * 0.65)); g.addColorStop(0.45, TG.rgb(...b)); g.addColorStop(1, TG.rgb(b[0] * 0.6, b[1] * 0.6, b[2] * 0.6)); c.fillStyle = g; for (const yy of [y, y - 256]) c.fillRect(x + 1, yy + 2, w - 2, h - 2); } } },
            { id: 'tuile-plate', cat: 'couverture', name: 'Tuile plate', tile: 0.6, draw: (c, R) => { TG.rows(c, R, 8, 6, 3, '#4a2418', [170, 82, 52], 0.22, true); for (let y = 0; y < 256; y += 32) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y + 26, 256, 3); } } },
            { id: 'tuile-grise', cat: 'couverture', name: 'Tuile grise', tile: 1, draw: (c, R) => { TG.fill(c, '#2e3134'); const rows = 6, cols = 5, h = 256 / rows, w = 256 / cols; for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const x = i * w + ((j % 2) ? w / 2 : 0), y = j * h, g = R(); c.fillStyle = TG.rgb(90 + g * 25, 94 + g * 25, 98 + g * 25); c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + w - 2, y); c.lineTo(x + w - 2, y + h * 0.75); c.quadraticCurveTo(x + w / 2, y + h * 1.05, x + 2, y + h * 0.75); c.closePath(); c.fill(); } } },
            { id: 'bac-anthracite', cat: 'couverture', name: 'Bac acier anthracite', tile: 1, draw: (c, R) => { for (let x = 0; x < 256; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#2f3338'); g.addColorStop(0.25, '#5a6068'); g.addColorStop(0.5, '#41464d'); g.addColorStop(1, '#30343a'); c.fillStyle = g; c.fillRect(x, 0, 32, 256); } } },
            { id: 'zinc', cat: 'couverture', name: 'Zinc joint debout', tile: 2, draw: (c, R) => { TG.speck(c, R, '#8d969c', ['#858e94', '#97a0a6'], 1500, 1.2); for (let x = 0; x < 256; x += 64) { c.fillStyle = '#c4cbd0'; c.fillRect(x, 0, 2, 256); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 2, 0, 3, 256); } } },
            { id: 'vegetal', cat: 'couverture', name: 'Toiture végétalisée', tile: 1, draw: (c, R) => { TG.fill(c, '#5a7a34'); TG.blobs(c, R, 900, ['#6f9440', '#4c6b2b', '#8aa64e', '#a0485a', '#c4a43e'], 1.5, 4, 0.85); } },
            // ---- métal et verre ----
            { id: 'galva', cat: 'metal', name: 'Acier galvanisé', tile: 1.5, draw: (c, R) => { TG.fill(c, '#a9b1b7'); TG.blobs(c, R, 160, ['#9aa2a8', '#b9c0c5', '#c7cdd1', '#8f979d'], 6, 18, 0.55); } },
            { id: 'corten', cat: 'metal', name: 'Acier Corten', tile: 1.5, draw: (c, R) => { TG.fill(c, '#8a4a26'); TG.blobs(c, R, 420, ['#9c5a30', '#6e3a1e', '#b0693a', '#5a2f18'], 3, 14, 0.5); texSpeck(c, 1600, ['rgba(0,0,0,.12)', 'rgba(255,190,120,.1)'], 1.4, R); } },
            { id: 'tole-perforee', cat: 'metal', name: 'Tôle perforée', tile: 0.5, draw: (c, R) => { TG.fill(c, '#9aa1a8'); c.fillStyle = '#2a2d31'; for (let y = 16; y < 256; y += 32) for (let x = (y / 32 | 0) % 2 ? 32 : 16; x < 256 + 16; x += 32) { c.beginPath(); c.arc(x % 256, y, 7, 0, 7); c.fill(); } } },
            { id: 'alu', cat: 'metal', name: 'Aluminium brossé', tile: 1, draw: (c, R) => { TG.fill(c, '#b8bcc0'); for (let y = 0; y < 256; y++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + R() * 0.05})`; c.fillRect(0, y, 256, 1); } } },
            { id: 'verre-fume', cat: 'metal', name: 'Verre fumé', tile: 1.5, glass: true, draw: (c, R) => { const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#5b6670'); g.addColorStop(1, '#2f3840'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 5; [[60, 0, 0, 60], [150, 0, 0, 150]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }); } },
            // ---- intérieur ----
            { id: 'carrelage-gris', cat: 'interieur', name: 'Carrelage gris 60 × 60', tile: 1.2, draw: (c, R) => { TG.rows(c, R, 2, 2, 2, '#6b7280', [148, 150, 152], 0.06, false); texSpeck(c, 1800, ['rgba(0,0,0,.06)', 'rgba(255,255,255,.08)'], 1.2, R); } },
            { id: 'carrelage-damier', cat: 'interieur', name: 'Carreaux damier', tile: 0.6, draw: (c, R) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { c.fillStyle = (i + j) % 2 ? '#1f2328' : '#eceae4'; c.fillRect(i * 64, j * 64, 64, 64); } TG.joints(c, 'rgba(120,120,120,.6)', 64, 64, 1.5); } },
            { id: 'faience', cat: 'interieur', name: 'Faïence métro', tile: 0.4, draw: (c, R) => { TG.rows(c, R, 8, 2, 3, '#d1d5db', [244, 246, 248], 0.03, true); for (let j = 0; j < 8; j++) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, j * 32 + 4, 256, 2); } } },
            { id: 'beton-cire', cat: 'interieur', name: 'Béton ciré', tile: 2.5, draw: (c, R) => { TG.fill(c, '#b4afa6'); TG.blobs(c, R, 60, ['#a7a198', '#c4bfb6', '#9c968c'], 14, 50, 0.22); } },
            { id: 'moquette', cat: 'interieur', name: 'Moquette', tile: 0.8, draw: (c, R) => TG.speck(c, R, '#5d6470', ['#535a65', '#677080', '#4a505a'], 9000, 1) },
            // ---- complément (revue des volets : plus de textures) ----
            { id: 'beton-bouchard', cat: 'beton', name: 'Béton bouchardé', tile: 1, draw: (c, R) => TG.gravel(c, R, '#b9b5ab', [205, 200, 190], 2400, 0.8, 2.2) },
            { id: 'beton-balaye', cat: 'beton', name: 'Béton balayé', tile: 1.5, draw: (c, R) => { TG.speck(c, R, '#bdbab2', ['#b1aea6', '#c9c6be'], 2000, 1.2); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; for (let i = 0; i < 70; i++) { const y = R() * 256; c.beginPath(); c.moveTo(0, y); c.lineTo(256, y + (R() - 0.5) * 6); c.stroke(); } } },
            { id: 'beton-imprime', cat: 'beton', name: 'Béton imprimé pavé', tile: 1, draw: (c, R) => TG.rows(c, R, 4, 4, 5, '#6f6658', [170, 150, 126], 0.14, true, 4) },
            { id: 'brique-grise', cat: 'maconnerie', name: 'Brique grise', tile: 0.6, draw: (c, R) => { TG.rows(c, R, 8, 2, 4, '#c8c6c0', [126, 126, 124], 0.16, true); texSpeck(c, 900, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.08)'], 1.5, R); } },
            { id: 'pierre-calcaire', cat: 'maconnerie', name: 'Pierre calcaire', tile: 1.5, draw: (c, R) => { TG.rows(c, R, 5, 3, 3, '#cfc6b2', [232, 222, 198], 0.07, true); texSpeck(c, 2200, ['rgba(140,120,80,.15)', 'rgba(255,255,255,.12)'], 1.2, R); } },
            { id: 'pierre-brute', cat: 'maconnerie', name: 'Pierres brutes jointoyées', tile: 1.4, draw: (c, R) => TG.rubble(c, R, '#8f8b84', [206, 190, 160], 0.16) },
            { id: 'pise', cat: 'maconnerie', name: 'Pisé (terre damée)', tile: 1.1, draw: (c, R) => TG.pise(c, R, [182, 104, 58], 0.1, 6) },
            { id: 'opus', cat: 'maconnerie', name: 'Opus incertum', tile: 1, draw: (c, R) => TG.stones(c, R, '#9a9184', [196, 184, 160], 0.22, 26, 60, 30, 70, 14, 4) },
            { id: 'schiste-parement', cat: 'maconnerie', name: 'Parement schiste', tile: 1, draw: (c, R) => TG.stones(c, R, '#202224', [96, 98, 102], 0.3, 8, 18, 40, 110, 2, 1.5) },
            { id: 'bardage-noir', cat: 'bois', name: 'Bardage brûlé noir', tile: 1, draw: (c, R) => TG.planks(c, R, 6, [42, 40, 40], 0.25, 'rgba(90,85,80,.35)', 'rgba(0,0,0,.9)', false, false) },
            { id: 'composite', cat: 'bois', name: 'Lames composite grises', tile: 1.4, draw: (c, R) => TG.planks(c, R, 8, [118, 114, 108], 0.08, 'rgba(60,58,55,.3)', 'rgba(20,20,20,.85)', false, true) },
            { id: 'claire-voie', cat: 'bois', name: 'Claire-voie', tile: 1, draw: (c, R) => { TG.fill(c, '#1b1d20'); const w = 256 / 8; for (let i = 0; i < 8; i++) { c.fillStyle = TG.vary(R, [176, 122, 76], 0.15); c.fillRect(i * w + 4, 0, w - 8, 256); } } },
            { id: 'enduit-taloche', cat: 'enduit', name: 'Enduit taloché', tile: 1, draw: (c, R) => { TG.fill(c, '#e4dccb'); TG.blobs(c, R, 500, ['#d6cdb9', '#efe8da', '#cfc4ae'], 4, 12, 0.45); } },
            { id: 'enduit-gris-fonce', cat: 'enduit', name: 'Enduit anthracite', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#4b4d50', ['#42444a', '#56595d', '#3c3e42'], 3200, 2) },
            { id: 'enduit-vert', cat: 'enduit', name: 'Enduit vert sauge', tile: 1.5, draw: (c, R) => TG.speck(c, R, '#a8b29a', ['#9ea88f', '#b3bda5', '#949e86'], 3200, 2) },
            { id: 'autobloquant', cat: 'sol', name: 'Pavés autobloquants', tile: 0.6, draw: (c, R) => TG.rows(c, R, 8, 4, 3, '#56524b', [140, 136, 128], 0.12, true, 2) },
            { id: 'evergreen', cat: 'sol', name: 'Dalle engazonnée', tile: 0.8, draw: (c, R) => { TG.fill(c, '#4f7a2e'); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { c.fillStyle = TG.vary(R, [168, 164, 154], 0.08); const x = i * 64, y = j * 64; c.fillRect(x + 4, y + 4, 56, 10); c.fillRect(x + 4, y + 50, 56, 10); c.fillRect(x + 4, y + 4, 10, 56); c.fillRect(x + 50, y + 4, 10, 56); } } },
            { id: 'ecorces', cat: 'sol', name: 'Paillage écorces', tile: 0.8, draw: (c, R) => { TG.fill(c, '#3b2416'); TG.blobs(c, R, 900, ['#6b4226', '#8a5a34', '#4e301b', '#a06c40'], 2, 7, 0.9); } },
            { id: 'gazon-synth', cat: 'sol', name: 'Gazon synthétique', tile: 1, draw: (c, R) => { TG.fill(c, '#3f8a2c'); for (let i = 0; i < 3200; i++) { c.strokeStyle = ['#4a9d34', '#378026', '#57ad3e'][Math.floor(R() * 3)]; c.lineWidth = 1; const x = R() * 256, y = R() * 256; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 2, y - 4); c.stroke(); } } },
            { id: 'resine', cat: 'sol', name: 'Résine gravillonnée', tile: 0.6, draw: (c, R) => TG.gravel(c, R, '#8f8676', [190, 176, 150], 2600, 1, 2.6) },
            { id: 'galets-ronds', cat: 'sol', name: 'Galets de rivière', tile: 0.6, draw: (c, R) => TG.gravel(c, R, '#6e675c', [160, 156, 148], 420, 6, 12) },
            { id: 'tuile-noire', cat: 'couverture', name: 'Tuile mécanique noire', tile: 1, draw: (c, R) => { TG.rows(c, R, 6, 5, 3, '#141517', [56, 58, 62], 0.12, true); for (let y = 0; y < 256; y += 43) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y + 36, 256, 5); } } },
            { id: 'shingle', cat: 'couverture', name: 'Bardeaux bitumés', tile: 0.6, draw: (c, R) => TG.rows(c, R, 8, 3, 2, '#1d1f22', [84, 76, 70], 0.2, true) },
            { id: 'epdm', cat: 'couverture', name: 'Membrane EPDM', tile: 2, draw: (c, R) => { TG.speck(c, R, '#2b2d30', ['#26282b', '#323438'], 2500, 1); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2; [64, 192].forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }); } },
            { id: 'bac-rouge', cat: 'couverture', name: 'Bac acier tuile rouge', tile: 1, draw: (c, R) => { for (let x = 0; x < 256; x += 32) { const g = c.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#6e2219'); g.addColorStop(0.3, '#a0382a'); g.addColorStop(1, '#7c271d'); c.fillStyle = g; c.fillRect(x, 0, 32, 256); } } },
            { id: 'caillebotis', cat: 'metal', name: 'Caillebotis', tile: 0.5, draw: (c, R) => { TG.fill(c, '#1a1c1f'); c.strokeStyle = '#9aa1a8'; c.lineWidth = 4; for (let v = 0; v <= 256; v += 32) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, 256); c.stroke(); c.lineWidth = 2; c.beginPath(); c.moveTo(0, v); c.lineTo(256, v); c.stroke(); c.lineWidth = 4; } } },
            { id: 'grillage', cat: 'metal', name: 'Grillage soudé vert', tile: 0.5, draw: (c, R) => { TG.fill(c, '#e5e7eb'); c.strokeStyle = '#2f5d3a'; c.lineWidth = 3; for (let v = 0; v <= 256; v += 32) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, 256); c.stroke(); c.beginPath(); c.moveTo(0, v * 2); c.lineTo(256, v * 2); c.stroke(); } } },
            { id: 'cuivre', cat: 'metal', name: 'Cuivre patiné', tile: 1.5, draw: (c, R) => { TG.fill(c, '#5f9e8f'); TG.blobs(c, R, 300, ['#4f8a7c', '#76b2a2', '#9c6b3e', '#5a9787'], 3, 14, 0.5); } },
            { id: 'parquet-baton', cat: 'interieur', name: 'Parquet bâtons rompus', tile: 0.8, draw: (c, R) => { TG.fill(c, '#5a3a1e'); for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { c.fillStyle = TG.vary(R, [186, 136, 84], 0.16); c.save(); c.translate(i * 64 + 32, j * 32 + 16); c.rotate(((i + j) % 2 ? 1 : -1) * Math.PI / 4); c.fillRect(-28, -7, 56, 14); c.restore(); } } },
            { id: 'travertin', cat: 'interieur', name: 'Travertin', tile: 1.2, draw: (c, R) => { TG.rows(c, R, 2, 2, 2, '#c9bda5', [226, 212, 186], 0.06, false); TG.blobs(c, R, 120, ['rgba(150,120,80,.5)', 'rgba(255,255,255,.4)'], 1, 4, 0.5); } },
        ];
        const texCanvasCache = {};
        function texCanvas(id, res) { res = res || 256; const ck = res === 256 ? id : id + '@' + res; if (texCanvasCache[ck]) return texCanvasCache[ck]; const T = TEX_LIB.find(t => t.id === id); if (!T) return null; const cv = document.createElement('canvas'); cv.width = cv.height = res; const c = cv.getContext('2d'); if (res !== 256) c.scale(res / 256, res / 256); T.draw(c, texRand(id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7))); texCanvasCache[ck] = cv; return cv; }
        /* relief des matériaux au rendu : une carte de normales tirée du motif (joints creux, pierres bombées, grain), la lumière rasante fait ressortir chaque pierre */
        const texNormCache = {};
        function texNormal(id) { if (texNormCache[id]) return texNormCache[id]; const src = texCanvas(id, 512); if (!src) return null; const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
            const lum = (cv, blur) => { const t = document.createElement('canvas'); t.width = t.height = N * 3; const y = t.getContext('2d'); if (blur) y.filter = 'blur(' + blur + 'px)'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) y.drawImage(cv, i * N, j * N); const d = y.getImageData(N, N, N, N).data, h = new Float32Array(N * N); for (let k = 0; k < N * N; k++) h[k] = (d[4 * k] * 0.3 + d[4 * k + 1] * 0.59 + d[4 * k + 2] * 0.11) / 255; return h; };
            const H2 = lum(src, 9), H1 = lum(src, 2.5), H0 = lum(src, 0.6), H = new Float32Array(N * N); for (let k = 0; k < N * N; k++) H[k] = H2[k] * 2.2 + H1[k] * 0.9 + H0[k] * 0.15;   // forme douce des pierres + un peu de grain
            const im = x.createImageData(N, N), d = im.data, at = (i, j) => H[((j + N) % N) * N + ((i + N) % N)], S = 6;
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const dx = (at(i + 1, j) - at(i - 1, j)) * S, dy = (at(i, j + 1) - at(i, j - 1)) * S, L = Math.hypot(dx, dy, 1), k = 4 * (j * N + i);
                d[k] = (-dx / L * 0.5 + 0.5) * 255; d[k + 1] = (dy / L * 0.5 + 0.5) * 255; d[k + 2] = (1 / L * 0.5 + 0.5) * 255; d[k + 3] = 255; }
            x.putImageData(im, 0, 0); let lo = Infinity, hi = -Infinity; for (let k = 0; k < N * N; k++) { lo = Math.min(lo, H[k]); hi = Math.max(hi, H[k]); }
            const hc = document.createElement('canvas'); hc.width = hc.height = N; const hx = hc.getContext('2d'), hi2 = hx.createImageData(N, N); for (let k = 0; k < N * N; k++) { const v = (H[k] - lo) / Math.max(1e-6, hi - lo) * 255; hi2.data[4 * k] = hi2.data[4 * k + 1] = hi2.data[4 * k + 2] = v; hi2.data[4 * k + 3] = 255; }
            hx.putImageData(hi2, 0, 0); texHeightCache[id] = hc; return (texNormCache[id] = c); }
        const texHeightCache = {};
        /* relief en profondeur au rendu (parallaxe) : chaque texel est vu à sa hauteur, les grains, joints et pierres se masquent entre eux selon l'angle de vue */
        function texPOM(m, id, tile) { const hc = texHeightCache[id]; if (!hc) return; const th = new THREE.CanvasTexture(hc); th.wrapS = th.wrapT = THREE.RepeatWrapping;
            const depth = 0.03 / Math.max(0.2, tile || 1);   // 3 cm de relief (en unités du motif)
            const UV = THREE.ShaderChunk.map_fragment.includes('vMapUv') ? 'vMapUv' : 'vUv';   // r151+ : une coordonnée par carte
            m.onBeforeCompile = (sh) => { sh.uniforms.pomH = { value: th }; sh.uniforms.pomD = { value: depth };
                sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform sampler2D pomH; uniform float pomD;
                    vec2 pomUv(vec2 uv) { vec3 p = -vViewPosition, dp1 = dFdx(p), dp2 = dFdy(p); vec2 du1 = dFdx(uv), du2 = dFdy(uv); vec3 Nn = normalize(cross(dp1, dp2)), V = normalize(vViewPosition); if (dot(Nn, V) < 0.0) Nn = -Nn;
                        vec3 q2 = cross(dp2, Nn), q1 = cross(Nn, dp1), T = q2 * du1.x + q1 * du2.x, B = q2 * du1.y + q1 * du2.y; float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20)); T *= im; B *= im;
                        vec3 Vt = normalize(vec3(dot(V, T), dot(V, B), dot(V, Nn))); float nL = mix(40.0, 10.0, abs(Vt.z)), ld = 1.0 / nL; vec2 P = Vt.xy / max(Vt.z, 0.2) * pomD, dl = P * ld;
                        vec2 c = uv; float cd = 0.0, d = 1.0 - textureGrad(pomH, c, du1, du2).r; for (int i = 0; i < 40; i++) { if (cd >= d) break; c -= dl; d = 1.0 - textureGrad(pomH, c, du1, du2).r; cd += ld; }
                        vec2 pr = c + dl; float a = d - cd, b = (1.0 - textureGrad(pomH, pr, du1, du2).r) - cd + ld, w = a / (a - b + 1e-6); return mix(c, pr, clamp(w, 0.0, 1.0)); }
                    void main() { vec2 pUv = pomUv(${UV});`)
                    .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.split(UV).join('pUv'))
                    .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/texture2D\( normalMap, (vUv|vNormalMapUv) \)/g, 'texture2D( normalMap, pUv )')); };
            m.customProgramCacheKey = () => 'pom' + depth.toFixed(4); m.userData.pom = true; }
        const texThumbCache = {};
        function texThumb(id) { if (texThumbCache[id]) return texThumbCache[id]; const src = texCanvas(id); if (!src) return ''; const cv = document.createElement('canvas'); cv.width = cv.height = 56; cv.getContext('2d').drawImage(src, 0, 0, 256, 256, 0, 0, 56, 56); return (texThumbCache[id] = cv.toDataURL('image/jpeg', 0.85)); }
        /* coordonnées de texture (mètres / taille du motif) : sol à plat et murs droits projetés sur le plan le plus proche ;
           toute face EN PENTE (toit, rampant, talus…) reçoit un repère dans son propre plan : V suit la ligne de plus grande pente, U la ligne de niveau —
           les tuiles s'alignent sur l'égout, les nervures du bac acier et les lames descendent la pente */
        function texSlopeUV(nx, ny, nz) { const L = Math.hypot(nx, ny, nz) || 1, cz = Math.abs(nz) / L; if (cz < 0.06 || cz > 0.995) return null;
            let hx = -ny, hy = nx; const hl = Math.hypot(hx, hy); hx /= hl; hy /= hl;   // ligne de niveau (horizontale, dans le plan)
            let dx = ny * 0 - nz * hy, dy = nz * hx - nx * 0, dz = nx * hy - ny * hx; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl; if (dz < 0) { dx = -dx; dy = -dy; dz = -dz; hx = -hx; hy = -hy; }   // pente, vers le haut
            return [hx, hy, dx, dy, dz]; }
        function texGeometry(g, tile) {
            const G = g.index ? g.toNonIndexed() : g, p = G.attributes.position.array, n = p.length / 3, uv = new Float32Array(n * 2), k = 1 / (tile || 1);
            for (let t = 0; t + 2 < n; t += 3) {
                const a = t * 3, ux = p[a + 3] - p[a], uy = p[a + 4] - p[a + 1], uz = p[a + 5] - p[a + 2], vx = p[a + 6] - p[a], vy = p[a + 7] - p[a + 1], vz = p[a + 8] - p[a + 2];
                const sx = uy * vz - uz * vy, sy = uz * vx - ux * vz, sz = ux * vy - uy * vx, nx = Math.abs(sx), ny = Math.abs(sy), nz = Math.abs(sz), F = texSlopeUV(sx, sy, sz);
                for (let v = 0; v < 3; v++) { const i = (t + v) * 3, x = p[i], y = p[i + 1], z = p[i + 2];
                    let U, V; if (F) { U = x * F[0] + y * F[1]; V = x * F[2] + y * F[3] + z * F[4]; } else if (nz >= nx && nz >= ny) { U = x; V = y; } else if (nx >= ny) { U = y; V = z; } else { U = x; V = z; }
                    uv[(t + v) * 2] = U * k; uv[(t + v) * 2 + 1] = V * k; }
            }
            G.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); G.computeVertexNormals(); return G;
        }
        const texAvgCache = {};
        function texAvg(id) { if (texAvgCache[id] !== undefined) return texAvgCache[id]; const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(texCanvas(id), 0, 0, 256, 256, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return (texAvgCache[id] = (d[0] << 16) | (d[1] << 8) | d[2]); }
        function texMaterial(id) { const m = texMaterial0(id); if (m && id === 'terre' && studio.earthCol && m.color) { const a = texAvg('terre'), c = new THREE.Color(studio.earthCol);   /* couleur de la terre choisie au studio */
                m.color.setRGB(Math.min(2.5, c.r / Math.max(0.05, ((a >> 16) & 255) / 255)), Math.min(2.5, c.g / Math.max(0.05, ((a >> 8) & 255) / 255)), Math.min(2.5, c.b / Math.max(0.05, (a & 255) / 255))); } return m; }
        function texMaterial0(id) {
            const T = TEX_LIB.find(t => t.id === id), cv = texCanvas(id); if (!T || !cv) return null;
            if (v3Flat) return new THREE.MeshLambertMaterial(Object.assign({ color: texAvg(id), side: THREE.DoubleSide }, T.glass ? { transparent: true, opacity: 0.5, depthWrite: false } : {}));   // vue de façade en plan : teinte moyenne, sans motif
            if (V3 && V3.hq && !T.glass) { const hc = texCanvas(id, 512), nc = texNormal(id); if (hc && nc) { const tx = new THREE.CanvasTexture(hc), tn = new THREE.CanvasTexture(nc); [tx, tn].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });
                const m = new THREE.MeshStandardMaterial({ map: tx, normalMap: tn, normalScale: new THREE.Vector2(1.4, 1.4), roughness: T.cat === 'metal' ? 0.45 : 0.92, metalness: 0, side: THREE.DoubleSide }); m.userData.relief = true; texPOM(m, id, T.tile); return m; } }   // rendu : relief
            const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4;
            return new THREE.MeshLambertMaterial(Object.assign({ map: tx, side: THREE.DoubleSide }, T.glass ? { transparent: true, opacity: 0.5, depthWrite: false } : {}));
        }
        // ---- outils Peindre / Pipette / Gomme ----
        var texPaint = null;   // { kind: 'paint' | 'texpick' | 'texclear', tex }
        let texLast = 'brique'; try { texLast = localStorage.getItem('momocad-tex') || 'brique'; } catch (e) {}
        const TEX_NAMES = { paint: 'PEINDRE', texpick: 'PIPETTE', texclear: 'GOMME À TEXTURE' };
        // ---- PEINDRE : un seul outil, trois façons ; la texture choisie est la même partout ----
        //      Volume : un clic habille un volume (ou repeint une zone peinte) ; Trait : le pinceau dans la vue 3D ; Zone : sur le plan, tracée ou d'un clic dans un contour
        let paintModeLast = 'vol'; try { paintModeLast = localStorage.getItem('momocad-paintmode') || 'vol'; } catch (e) {}
        function paintBar(cur) { return `<div class="vseg">` + [['vol', '🧱 Volume'], ['trait', '🖌 Trait'], ['zone', '⬠ Zone']].map(([k, l]) => `<button type="button" data-pm="${k}" class="${k === cur ? 'on' : ''}" onclick="paintMode('${k}')">${l}</button>`).join('') + '</div>'; }
        async function paintMode(m) { paintModeLast = m; try { localStorage.setItem('momocad-paintmode', m); } catch (e) {}
            if (m === 'vol') { if (brushTool) brushStop(true); startPaint('paint', true); return; }
            brushLast.poly = m === 'zone'; brushLast.erase = false; brushSaveOpt();
            if (!brushTool) await startBrush(); else brushSet('poly', m === 'zone'); }
        function startPaint(kind, direct) {
            kind = kind || 'paint';
            if (kind === 'paint' && !direct && paintModeLast !== 'vol' && !selectedShapes.some(is3DObj)) { paintMode(paintModeLast); return; }
            if (kind === 'paint') { paintModeLast = 'vol'; try { localStorage.setItem('momocad-paintmode', 'vol'); } catch (e) {} }
            if (brushTool) brushStop(true);
            if (is3DOpen()) { texPaint = { kind, tex: texLast }; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); const bt = document.getElementById('btn-' + kind); if (bt) bt.classList.add('active'); }
            else { setMode(kind); texPaint = { kind, tex: texLast }; }
            if (kind === 'paint') texPanel(); else t2PanelClose();
            const S = selectedShapes.filter(is3DObj); if (S.length && kind === 'paint') updateCommandMessageText('PEINDRE : ' + S.length + ' volume(s) sélectionné(s) — choisissez une texture puis « Appliquer à la sélection », ou cliquez les volumes un par un.');
            else texMsg();
        }
        function texMsg() { if (!texPaint) return; updateCommandMessageText(texPaint.kind === 'paint' ? 'PEINDRE (' + (TEX_LIB.find(t => t.id === texPaint.tex) || {}).name + ') : cliquez les volumes à habiller' + (is3DOpen() ? ' dans la vue 3D' : ' (en plan, ou dans la vue 3D)') + '. Échap pour finir.' : texPaint.kind === 'texpick' ? 'PIPETTE : cliquez un volume pour reprendre sa texture.' : 'GOMME À TEXTURE : cliquez un volume pour lui rendre la couleur de son calque.'); }
        function texStop() { texPaint = null; t2PanelClose(); document.querySelectorAll('#btn-paint,#btn-texpick,#btn-texclear').forEach(b => b.classList.remove('active')); if (!is3DOpen()) { setMode('select-box'); draw(); } else updateCommandMessageText('VUE 3D : peinture terminée.'); if (V3 && V3.fps && V3.fps.paused && !stOn()) fpsResume(); }   /* pinceau de la vue Momo fermé : la balade reprend */
        function texPanel() {
            const cur = texPaint ? texPaint.tex : texLast, nSel = selectedShapes.filter(is3DObj).length;
            const curT = TEX_LIB.find(t => t.id === cur); if (!texCat || !TEX_CATS.some(c => c[0] === texCat)) texCat = curT ? curT.cat : TEX_CATS[0][0];
            const tabs = TEX_CATS.map(([k, n]) => { const on = k === texCat, nb = TEX_LIB.filter(t => t.cat === k).length, has = curT && curT.cat === k;
                return `<button type="button" ${on ? 'data-on="1"' : ''} onclick="texCatSet('${k}')" style="flex:none;padding:4px 8px;border-radius:999px;border:1px solid ${on ? '#22c55e' : '#4b5563'};background:${on ? 'rgba(34,197,94,.18)' : '#111827'};color:${on ? '#bbf7d0' : '#d1d5db'};font-size:11.5px;cursor:pointer;white-space:nowrap">${n} <span style="opacity:.6">${nb}</span>${has ? ' ●' : ''}</button>`; }).join('');
            const sw = TEX_LIB.filter(t => t.cat === texCat).map(t => `<button type="button" onclick="texChoose('${t.id}')" title="${t.name}" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px;border-radius:8px;border:2px solid ${t.id === cur ? '#22c55e' : 'transparent'};background:#111827;cursor:pointer;color:#e5e7eb;font-size:10.5px;line-height:1.15;text-align:center"><img src="${texThumb(t.id)}" width="56" height="56" style="border-radius:5px;display:block">${t.name}</button>`).join('');
            t2Panel('🎨 Peindre', paintBar('vol') + t2Note('Cliquez un volume (en plan ou en 3D) : il prend la texture, en vraie grandeur. Une zone peinte cliquée est repeinte.')
                + `<div class="tex-cats" style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin">${tabs}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">${sw}</div>`
                + (nSel ? `<button type="button" onclick="texApplySel()" style="padding:7px 10px;border-radius:6px;border:0;background:#065f46;color:#d1fae5;font-weight:700;cursor:pointer">Appliquer à la sélection (${nSel} volume${nSel > 1 ? 's' : ''})</button>` : '')
                + t2Note('Pipette : reprendre la texture d\'un volume. Gomme : lui rendre la couleur de son calque.'),
                [['Terminer', 'texStop()', true]], 'texStop()');
            { const on = document.querySelector('#t2-panel .tex-cats [data-on]'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
        }
        let texCat = null; try { texCat = localStorage.getItem('momocad-texcat'); } catch (e) {}
        function texCatSet(k) { texCat = k; try { localStorage.setItem('momocad-texcat', k); } catch (e) {} texPanel(); }
        function texChoose(id) { texLast = id; brushLast.tex = id; brushSaveOpt(); try { localStorage.setItem('momocad-tex', id); } catch (e) {} if (texPaint) texPaint.tex = id; texPanel(); texMsg(); }
        /* PEINTURE PAR FACE : chaque face d'une paroi (ses deux parements, ses bouts, le dessus, le dessous) garde sa propre texture (s.ftex[clé]) */
        /* volumes peints face par face : parois, et volumes extrudés (dalle, pavé, toit, cylindre, tube, pyramide) — contour = celui de la hachure ou les sommets du volume */
        const FACE_SOLIDS = ['box', 'roof', 'cyl', 'tube', 'pyr', 'tcone'];
        function faceLoop(o) { return (o.loops && o.loops[0]) || (o.type === 'poly' && o.points) || []; }
        function faceable(o) { return !!o && (isWallHatch(o) || (o.type === 'poly' && o.solid && FACE_SOLIDS.includes(o.solid.kind) && !o.stair2)); }
        function wallFaceKey(o, P, c, nr) { if (nr.z > 0.7) return 'top'; if (nr.z < -0.7) return 'bot'; const L = faceLoop(o), E = L.map(q => P(q.x, q.y)); let best = null, bd = Infinity; const h = Math.hypot(nr.x, nr.y) || 1, nx = nr.x / h, ny = nr.y / h;
            E.forEach((a, k) => { const b = E[(k + 1) % E.length], l = Math.hypot(b.x - a.x, b.y - a.y); if (l < 1e-9) return; const ex = -(b.y - a.y) / l, ey = (b.x - a.x) / l; if (Math.abs(ex * nx + ey * ny) < 0.7) return; const t = Math.max(0, Math.min(1, ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / (l * l))), d = Math.hypot(c.x - a.x - (b.x - a.x) * t, c.y - a.y - (b.y - a.y) * t); if (d < bd) { bd = d; best = k; } });
            return best === null ? 'side' : 'f' + best; }
        /* face d'un parement : gardée par son segment (o.fte = [{ a, b, t }], en coordonnées du plan), pas par son numéro dans le contour : quand le contour est recalculé
           (fusion, poignée, réparation à l'ouverture), les numéros changent mais la face reste sur la même ligne ; le segment suit les déplacements, rotations, symétries */
        function wallFteMatch(e, c, d) { const L = Math.hypot(d.x - c.x, d.y - c.y), l2 = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y); if (L < 1e-9 || l2 < 1e-9) return false; const ux = (d.x - c.x) / L, uy = (d.y - c.y) / L, tol = mmToWorld(20);
            if (Math.abs(ux * (e.b.y - e.a.y) / l2 - uy * (e.b.x - e.a.x) / l2) > 0.02) return false; const off = (q) => Math.abs((q.x - c.x) * uy - (q.y - c.y) * ux), t = (q) => (q.x - c.x) * ux + (q.y - c.y) * uy;
            if (off(e.a) > tol || off(e.b) > tol) return false; const t0 = Math.min(t(e.a), t(e.b)), t1 = Math.max(t(e.a), t(e.b)); return Math.min(t1, L) - Math.max(t0, 0) > tol; }
        function wallEdgeTex(o) { const L = faceLoop(o), n = L.length; return L.map((c, i) => { const d = L[(i + 1) % n], e = (o.fte || []).find(f => wallFteMatch(f, c, d)); return e ? e.t : (o.ftex || {})['f' + i]; }); }
        /* fichiers d'avant : clés « fN » (numéro du côté) changées en segments, sur le contour tel qu'il a été enregistré */
        function wallFteMigrate(list) { let n = 0; (list || shapes).forEach(o => { if (!o || !o.ftex || !faceLoop(o).length) return; const L = faceLoop(o); Object.keys(o.ftex).forEach(k => { if (!/^f\d+$/.test(k)) return; const i = +k.slice(1);
                if (i < L.length) { const a = L[i], b = L[(i + 1) % L.length]; (o.fte = o.fte || []).push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, t: o.ftex[k] }); n++; } delete o.ftex[k]; }); if (!Object.keys(o.ftex).length) delete o.ftex; }); return n; }
        function wallFaceMesh(o, g, base, P) { const bU = Array.isArray(base) ? base[1] : null; base = Array.isArray(base) ? base[0] : base; const G = g.index ? g.toNonIndexed() : g, p = G.attributes.position.array, nt = Math.floor(p.length / 9), mats = [base], mi = {}, idx = new Array(nt), ET = wallEdgeTex(o);
            for (let t = 0; t < nt; t++) { const a = t * 9, ux = p[a + 3] - p[a], uy = p[a + 4] - p[a + 1], uz = p[a + 5] - p[a + 2], vx = p[a + 6] - p[a], vy = p[a + 7] - p[a + 1], vz = p[a + 8] - p[a + 2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
                const k = wallFaceKey(o, P, { x: (p[a] + p[a + 3] + p[a + 6]) / 3, y: (p[a + 1] + p[a + 4] + p[a + 7]) / 3 }, { x: nx / l, y: ny / l, z: nz / l }), tx = (k[0] === 'f' ? ET[+k.slice(1)] : (o.ftex || {})[k]) || (k === 'bot' && bU && o.texU ? o.texU : undefined);
                if (tx && mi[tx] === undefined) { const m = texMaterial(tx); mi[tx] = m ? mats.push(m) - 1 : 0; } idx[t] = tx ? mi[tx] : 0; }
            const out = [], N = new THREE.BufferGeometry(); for (let k = 0; k < mats.length; k++) { const s0 = out.length / 3; for (let t = 0; t < nt; t++) if (idx[t] === k) for (let j = 0; j < 9; j++) out.push(p[t * 9 + j]); if (out.length / 3 > s0) N.addGroup(s0, out.length / 3 - s0, k); }
            N.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); N.computeVertexNormals(); const T = TEX_LIB.find(t => t.id === (o.tex || Object.values(o.ftex || {})[0] || ((o.fte || [])[0] || {}).t)); return new THREE.Mesh(texGeometry(N, T ? T.tile : 1), mats); }
        function wallFacePaint(s, hit, P) { const loc = hit.object.worldToLocal(hit.point.clone()), n = hit.face.normal, k = wallFaceKey(s, P, loc, n), edge = k[0] === 'f', L = faceLoop(s), ei = edge ? +k.slice(1) : -1, cur = edge ? wallEdgeTex(s)[ei] : (s.ftex || {})[k];
            if (texPaint.kind === 'texpick') { const t = cur || s.tex; if (t) { texLast = t; try { localStorage.setItem('momocad-tex', t); } catch (e) {} startPaint('paint', true); } return; }
            if (edge) { const a = L[ei], b = L[(ei + 1) % L.length]; if (s.ftex) { delete s.ftex[k]; if (!Object.keys(s.ftex).length) delete s.ftex; } s.fte = (s.fte || []).filter(e => !wallFteMatch(e, a, b)); if (texPaint.kind !== 'texclear') s.fte.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, t: texPaint.tex }); if (!s.fte.length) delete s.fte; }
            else if (texPaint.kind === 'texclear') { if (s.ftex) { delete s.ftex[k]; if (!Object.keys(s.ftex).length) delete s.ftex; } } else s.ftex = Object.assign({}, s.ftex || {}, { [k]: texPaint.tex });
            saveState(); build3DScene(); render3D(); updateCommandMessageText(texPaint.kind === 'texclear' ? 'GOMME À TEXTURE : face rendue. Cliquez une autre face, ou Échap.' : 'PEINDRE : face habillée en « ' + (TEX_LIB.find(t => t.id === texPaint.tex) || {}).name + ' ». Chaque face se peint à part ; Maj + clic : tout l\'objet. Échap pour finir.'); }
        function texTargets(s) { return s.groupId && s.wallMat ? shapes.filter(x => x.groupId === s.groupId && is3DObj(x)) : [s]; }
        function texApply(s) {
            if (!s || !is3DObj(s) || !texPaint) { updateCommandMessageText(TEX_NAMES[(texPaint || {}).kind || 'paint'] + ' : cliquez un volume (pavé, extrusion, balayage, mur à niveaux, toiture…).'); return; }
            if (texPaint.kind === 'texpick') { if (s.tex) { texLast = s.tex; try { localStorage.setItem('momocad-tex', s.tex); } catch (e) {} startPaint('paint'); updateCommandMessageText('PIPETTE : texture « ' + (TEX_LIB.find(t => t.id === s.tex) || {}).name + ' » reprise — cliquez les volumes à peindre.'); } else updateCommandMessageText('PIPETTE : ce volume n\'a pas de texture (il a la couleur de son calque).'); return; }
            texTargets(s).forEach(x => { delete x.ftex; delete x.fte; if (texPaint.kind === 'texclear') delete x.tex; else x.tex = texPaint.tex; });
            saveState(); if (is3DOpen()) { build3DScene(); render3D(); } else draw();
            updateCommandMessageText(texPaint.kind === 'texclear' ? 'GOMME À TEXTURE : couleur du calque rendue. Cliquez un autre volume, ou Échap.' : 'PEINDRE : « ' + (TEX_LIB.find(t => t.id === texPaint.tex) || {}).name + ' » posé. Cliquez un autre volume, ou Échap. (Vue 3D : bulle œil près de la rosace.)');
        }
        // parois de plateforme (voiles contre le terrain) : peintes depuis la vue 3D, la texture est gardée par la plateforme
        function paroiPaint(pl) { if (!pl || !texPaint) return;
            if (texPaint.kind === 'texpick') { if (pl.paroiTex) { texLast = pl.paroiTex; try { localStorage.setItem('momocad-tex', pl.paroiTex); } catch (e) {} startPaint('paint'); updateCommandMessageText('PIPETTE : texture « ' + (TEX_LIB.find(t => t.id === pl.paroiTex) || {}).name + ' » reprise — cliquez les volumes à peindre.'); } else updateCommandMessageText('PIPETTE : cette paroi est en béton banché (texture par défaut).'); return; }
            if (texPaint.kind === 'texclear') delete pl.paroiTex; else pl.paroiTex = texPaint.tex;
            saveState(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText(texPaint.kind === 'texclear' ? 'GOMME À TEXTURE : la paroi revient en béton banché.' : 'PEINDRE : paroi habillée en « ' + (TEX_LIB.find(t => t.id === texPaint.tex) || {}).name + ' ». Cliquez un autre volume, ou Échap.'); }
        // ---- PINCEAU : une couche de peinture déposée sur toutes les surfaces de la vue 3D (terrain, plateformes, talus, murs, dalles…) ----
        // un coup de pinceau = polyligne ouverte du calque « Peinture » : { brush: { tex, d (diamètre mm), h (dureté 0..1), top (au sol), zs (altitudes mm), n (normale d'un mur) } }
        let brushTool = null, brushCur = null, brushCat = null, brushRAF = 0;
        const brushLast = { tex: 'galets', d: 800, h: 0.6, erase: false };
        try { Object.assign(brushLast, JSON.parse(localStorage.getItem('momocad-brush') || '{}')); } catch (e) {}
        function brushSaveOpt() { try { localStorage.setItem('momocad-brush', JSON.stringify(brushLast)); } catch (e) {} }
        function brushLayer() { return ensureLayer('Pinceau', '#a3e635'); }
        async function startBrush() {
            if (texPaint) { texPaint = null; document.querySelectorAll('#btn-paint,#btn-texpick,#btn-texclear').forEach(b => b.classList.remove('active')); }
            brushTool = Object.assign({}, brushLast); paintModeLast = brushTool.poly ? 'zone' : 'trait'; try { localStorage.setItem('momocad-paintmode', paintModeLast); } catch (e) {} document.querySelectorAll('#btn-paint,#v3-brush-btn').forEach(b => b.classList.add('active'));
            await brushPlace(); brushPanel(); brushMsg();
        }
        function brushMsg() { if (!brushTool) return; const v2 = brushTool.view === '2d', TV = v2 ? ' Clic molette maintenu : déplacer le plan. Bascule 2D / 3D dans le panneau.' : ' Maj + glisser : tourner la vue. Bascule 2D / 3D dans le panneau.'; if (brushTool.poly && !brushTool.erase && brushTool.pick) { updateCommandMessageText('PEINDRE — zone (' + ((TEX_LIB.find(t => t.id === brushTool.tex) || {}).name || '') + ') : cliquez dans un contour fermé pour le peindre, ou dans une zone peinte pour la repeindre. Échap pour finir.'); return; } if (brushTool.poly && !brushTool.erase) { updateCommandMessageText('PEINDRE — zone (' + ((TEX_LIB.find(t => t.id === brushTool.tex) || {}).name || '') + ') : cliquez les sommets de la zone, recliquez le 1er (ou double-clic, Entrée) pour la peindre.' + TV + ' Échap pour finir.'); return; } updateCommandMessageText(brushTool.erase ? 'PEINDRE — gomme : glissez sur une peinture pour l\'effacer.' + TV + ' Échap pour finir.' : 'PEINDRE — trait (' + ((TEX_LIB.find(t => t.id === brushTool.tex) || {}).name || '') + ', Ø ' + nfr(brushTool.d / 1000, 2) + ' m, dureté ' + Math.round(brushTool.h * 100) + ' %) : ' + (v2 ? 'glissez sur le plan : la peinture se pose sur le sol fini (terrain, plateformes, talus).' : 'glissez sur le sol, une plateforme, un talus ou un mur.') + TV + ' Échap pour finir.'); }
        function brushStop(quiet) { if (!brushTool) return; brushUp(); brushTool = null; brush2DAt = null; if (brushPolyDraw) { brushPolyDraw = false; if (mode === 'poly' && !isDrawing) setMode('select-box'); } if (mode === 'paintzone') setMode('select-box'); t2PanelClose(); document.querySelectorAll('#btn-paint,#v3-brush-btn').forEach(b => b.classList.remove('active')); v3BrushCursor(null); if (!quiet) updateCommandMessageText('PINCEAU : terminé.'); if (V3) render3D(); }
        function brushSet(k, v) { if (!brushTool) return; if (k === 'd') { brushTool.d = Math.max(50, Math.round(parseFloat(String(v).replace(',', '.')) * 1000) || brushTool.d); const o = document.getElementById('br-dv'); if (o) o.textContent = nfr(brushTool.d / 1000, 2) + ' m'; }
            else if (k === 'h') { brushTool.h = Math.max(0, Math.min(1, (+v || 0) / 100)); const o = document.getElementById('br-hv'); if (o) o.textContent = Math.round(brushTool.h * 100) + ' %'; }
            else if (k === 'erase') { brushTool.erase = !!v; brushPanel(); brushPlace(); }
            else if (k === 'poly') { if (brushCur && brushCur.brush.poly) brushPolyEnd(); brushTool.poly = !!v; brushTool.erase = false; paintModeLast = v ? 'zone' : 'trait'; try { localStorage.setItem('momocad-paintmode', paintModeLast); } catch (e) {} brushPlace().then(() => { brushPanel(); brushMsg(); }); }
            else if (k === 'pick') { brushTool.pick = !!v; brushPlace().then(() => { brushPanel(); brushMsg(); }); }
            Object.assign(brushLast, { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, erase: brushTool.erase, poly: !!brushTool.poly, pick: !!brushTool.pick }); brushSaveOpt(); brushMsg(); }
        // coup de pinceau : dans la vue 3D ; polygone peint : sur le plan, avec l'outil polygone (aperçu, accroches, clic sur le 1er point pour fermer)
        let brushSwitching = false, brush2DAt = null, brushPolyDraw = false;
        async function brushPlace() { if (!brushTool) return; brushSwitching = true;
            try { if (brushTool.poly && !brushTool.erase) { if (is3DOpen()) close3D(); if (brushTool.pick) { setMode('paintzone'); } else { setMode('poly'); brushPolyDraw = true; } } else { brushPolyDraw = false; if (mode === 'poly' || mode === 'paintzone') setMode('select-box'); if (!is3DOpen()) await open3D(); } }
            finally { brushSwitching = false; } draw(); }
        // contour fermé à l'outil polygone : la zone peinte (altitude du sol fini à chaque sommet), puis on enchaîne la zone suivante
        function brushPolyCreate(P) { if (!brushTool || !P || P.length < 3) { setMode('poly'); brushPolyDraw = true; return; }
            const s = { type: 'poly', open: false, layerId: brushLayer(), points: P.map(q => ({ x: q.x, y: q.y })), width: 1, hatch: false, name: 'Zone peinte', brush: { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, top: true, poly: true, zs: P.map(q => { const z = groundZAt(q.x, q.y, false); return hasZ(z) ? Math.round(z) : 0; }) } };
            shapes.push(s); brushNoSync = true; saveState(); brushQueue(true); setMode('poly'); brushPolyDraw = true; draw();
            updateCommandMessageText('PINCEAU : zone peinte (' + nfr(Math.abs(polyArea(s.points)) * mOf(1) ** 2, 1) + ' m²), visible en 3D. Une autre zone : cliquez son 1er sommet. Échap pour finir.'); }
        async function brushView(v) { if (!brushTool || brushTool.view === v) return; if (brushCur && brushCur.brush.poly) brushPolyEnd(); brushTool.view = v; brushLast.view = v; brushSaveOpt();
            brushSwitching = true; try { if (v === '3d') { if (!is3DOpen()) await open3D(); } else if (is3DOpen()) close3D(); } finally { brushSwitching = false; }
            brushPanel(); brushMsg(); draw(); }
        const brush2D = () => false;   // le coup de pinceau ne se donne que dans la vue 3D
        // point visé sur le plan : altitude du sol fini (plateforme, terrain) sous le curseur
        function brush2DHit(sx, sy) { const q = screenToWorld(sx, sy), z = groundZAt(q.x, q.y, false); return { p: null, n: { x: 0, y: 0, z: 1 }, q, z: hasZ(z) ? Math.round(z) : 0, flat: true }; }
        function drawBrush2DCursor(c) { if (!brush2D() || !brush2DAt) return; const r = Math.max(2, mmToWorld(brushTool.d / 2) * camera.zoom), x = brush2DAt.x * camera.zoom + camera.x, y = brush2DAt.y * camera.zoom + camera.y;
            c.save(); c.setLineDash([]); c.lineWidth = 1.5; c.strokeStyle = brushTool.erase ? '#f87171' : '#a3e635'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 0.12; c.fillStyle = c.strokeStyle; c.fill(); c.restore(); }
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && brushTool && (brushPolyDraw || mode === 'paintzone') && !isDrawing && !is3DOpen() && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); e.stopImmediatePropagation(); setMode('select-box'); brushStop(); draw(); return; }
            if (!brush2D() || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
            if (e.key === 'Enter' && brushCur && brushCur.brush.poly) { e.preventDefault(); e.stopImmediatePropagation(); brushPolyEnd(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (brushCur && brushCur.brush.poly) brushPolyCancel(); else { brushStop(); draw(); } } }, true);
        function brushChoose(id) { if (!brushTool) return; brushTool.tex = id; brushTool.erase = false; brushLast.tex = id; brushLast.erase = false; brushSaveOpt(); texLast = id; try { localStorage.setItem('momocad-tex', id); } catch (e) {} brushPanel(); brushMsg(); }
        function brushCatSet(k) { brushCat = k; brushPanel(); }
        function brushPanel() {
            if (!brushTool) return; const cur = brushTool.tex, curT = TEX_LIB.find(t => t.id === cur); if (!brushCat || !TEX_CATS.some(c => c[0] === brushCat)) brushCat = curT ? curT.cat : 'sol';
            const tabs = TEX_CATS.map(([k, n]) => { const on = k === brushCat; return `<button type="button" onclick="brushCatSet('${k}')" style="flex:none;padding:4px 8px;border-radius:999px;border:1px solid ${on ? '#a3e635' : '#4b5563'};background:${on ? 'rgba(163,230,53,.16)' : '#111827'};color:${on ? '#ecfccb' : '#d1d5db'};font-size:11.5px;cursor:pointer;white-space:nowrap">${n}${curT && curT.cat === k ? ' ●' : ''}</button>`; }).join('');
            const sw = TEX_LIB.filter(t => t.cat === brushCat).map(t => `<button type="button" onclick="brushChoose('${t.id}')" title="${t.name}" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px;border-radius:8px;border:2px solid ${t.id === cur && !brushTool.erase ? '#a3e635' : 'transparent'};background:#111827;cursor:pointer;color:#e5e7eb;font-size:10.5px;line-height:1.15;text-align:center"><img src="${texThumb(t.id)}" style="width:52px;height:52px;border-radius:5px;image-rendering:auto"><span>${t.name}</span></button>`).join('');
            const sl = (id, min, max, step, v, fn) => `<input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" oninput="${fn}" style="flex:1;accent-color:#a3e635">`;
            const Z = !!brushTool.poly, seg = (cur, opts, k) => `<div style="display:flex;gap:4px">` + opts.map(([v, t]) => `<button type="button" onclick="brushSet('${k}', ${v})" style="flex:1;padding:5px 6px;border-radius:6px;border:1px solid ${cur === v ? '#a3e635' : '#4b5563'};background:${cur === v ? 'rgba(163,230,53,.16)' : '#111827'};color:#e5e7eb;cursor:pointer;font-size:12px">${t}</button>`).join('') + '</div>';
            t2Panel('🎨 Peindre', paintBar(Z ? 'zone' : 'trait')
                + (Z ? seg(!!brushTool.pick, [[false, '✏️ Tracer la zone'], [true, '👆 Clic dans un contour']], 'pick')
                    + t2Note(brushTool.pick ? 'Clic dans un contour fermé du plan (plateforme, polyligne, cercle) : il est peint. Clic dans une zone peinte : elle prend la texture.' : 'Sur le plan, comme le polygone : recliquez le 1er sommet ou double-clic pour peindre la zone.')
                    : t2Note('Dans la vue 3D : glissez sur le sol, une plateforme, un talus, un mur.'))
                + `<div style="display:flex;align-items:center;gap:8px"><span style="width:70px">Diamètre</span>${sl('br-d', 0.1, 5, 0.05, brushTool.d / 1000, "brushSet('d', this.value)")}<b id="br-dv" style="width:54px;text-align:right">${nfr(brushTool.d / 1000, 2)} m</b></div>`
                + `<div style="display:flex;align-items:center;gap:8px"><span style="width:70px">Dureté</span>${sl('br-h', 0, 100, 5, Math.round(brushTool.h * 100), "brushSet('h', this.value)")}<b id="br-hv" style="width:54px;text-align:right">${Math.round(brushTool.h * 100)} %</b></div>`
                + (selectedShapes.some(x => x.type === 'poly' && !x.open && !x.brush) ? `<button type="button" onclick="brushPaintSel()" style="padding:6px;border-radius:6px;border:1px solid #a3e635;background:rgba(163,230,53,.16);color:#ecfccb;cursor:pointer">⬠ Peindre le contour sélectionné</button>` : '')
                + `<div class="tex-cats" style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin">${tabs}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">${sw}</div>`
                + t2Chk('br-er', brushTool.erase, '<b>Gomme</b> : effacer les coups de pinceau touchés', "brushSet('erase', this.checked)"),
                [['Terminer', 'brushStop()', true]], 'brushStop()');
        }
        // point visé dans la vue 3D : { p (scène), n (normale tournée vers la caméra), q (plan), z (mm) }
        function v3BrushHit(e) {
            if (!V3 || !V3.root) return null; const cv = V3.renderer.domElement, r = cv.getBoundingClientRect(), ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V3.camera);
            const h = ray.intersectObjects(V3.root.children, true).find(x => x.object.isMesh && x.object.visible && !x.object.userData.brushOv && x.face && !(x.object.material && x.object.material.transparent && x.object.material.opacity < 0.5 && !x.object.userData.rp));
            if (!h) return null; const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize(); if (n.dot(ray.ray.direction) > 0) n.negate();
            const cx = -V3.root.position.x, cy = -V3.root.position.y, p = h.point.clone();
            return { p, n, q: { x: mmToWorld((p.x + cx) * 1000), y: -mmToWorld((p.y + cy) * 1000) }, z: Math.round(((p.z - V3.root.position.z) / (V3.exag || 1) + (V3.zmin || 0)) * 1000) };
        }
        function brushDown(e) { if (!brushTool) return; const H = e.H || v3BrushHit(e); if (!H) return;
            if (brushTool.erase) { brushCur = null; brushErase(H); return; }
            if (brushTool.poly) { brushPolyClick(H, e); return; }
            brushCur = null;
            const top = H.n.z > 0.6, s = { type: 'poly', open: true, layerId: brushLayer(), points: [{ x: H.q.x, y: H.q.y }], width: 1, hatch: false, name: 'Pinceau', brush: { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, top, zs: [H.z] } };
            if (!top) s.brush.n = [H.n.x, H.n.y, H.n.z].map(v => Math.round(v * 1000) / 1000);
            shapes.push(s); brushCur = s; brushQueue(); }
        function brushMove(e) { if (!brushTool) return; const H = e.H || v3BrushHit(e); if (e.H) { brush2DAt = H.q; draw(); } else v3BrushCursor(H); if (!H) return;
            if (brushTool.erase) { brushErase(H); return; } const s = brushCur; if (!s || s.brush.poly) return; const b = s.brush, L = s.points[s.points.length - 1];
            if (b.top ? H.n.z < 0.35 : (H.n.x * b.n[0] + H.n.y * b.n[1] + H.n.z * b.n[2]) < 0.8) return;   // on reste sur le même genre de surface (sol, ou la face du mur)
            const dm = Math.hypot(mOf(H.q.x - L.x), mOf(H.q.y - L.y), (H.z - b.zs[b.zs.length - 1]) / 1000); if (dm < Math.max(b.d / 1000 * 0.2, 0.03)) return;
            s.points.push({ x: H.q.x, y: H.q.y }); b.zs.push(H.z); brushQueue(); }
        function brushUp() { if (brushCur && brushCur.brush.poly) return; if (brushCur) { brushCur = null; brushNoSync = true; saveState(); } else if (brushTool && brushTool.erase && brushTool.dirty) { brushTool.dirty = false; brushNoSync = true; saveState(); } }
        var brushNoSync = false;   // fin d'un coup de pinceau : la scène 3D n'a pas à être reconstruite (seules les couches de peinture changent)
        // ---- POLYGONE PEINT : on clique les sommets d'une zone sur les surfaces (sol, plateformes…), elle est entièrement peinte ;
        //      on referme en recliquant le 1er sommet, double-clic ou Entrée ; Échap annule la zone en cours. Une polyligne fermée choisie en plan se peint aussi d'un coup.
        function brushPolyClick(H, e) { let s = brushCur;
            if (s && s.brush.poly && s.points.length >= 3 && e.H) { const a = s.points[0]; if (Math.hypot(a.x - H.q.x, a.y - H.q.y) * camera.zoom < 14 || e.detail >= 2) { brushPolyEnd(); return; } }
            else if (s && s.brush.poly && s.points.length >= 3) { const a = s.points[0], sc = (q) => { const v = new THREE.Vector3(worldToMm(q.x) / 1000 + V3.root.position.x, -worldToMm(q.y) / 1000 + V3.root.position.y, H.p.z).project(V3.camera), r = V3.renderer.domElement.getBoundingClientRect(); return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top }; }, A = sc(a);
                if (Math.hypot(A.x - e.clientX, A.y - e.clientY) < 14 || (e.detail >= 2)) { brushPolyEnd(); return; } }
            if (!s || !s.brush.poly) { s = { type: 'poly', open: true, layerId: brushLayer(), points: [], width: 1, hatch: false, name: 'Zone peinte', brush: { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, top: true, poly: true, zs: [] } }; shapes.push(s); brushCur = s; }
            s.points.push({ x: H.q.x, y: H.q.y }); s.brush.zs.push(H.z); brushQueue();
            updateCommandMessageText('PINCEAU — polygone : sommet ' + s.points.length + (s.points.length >= 3 ? ' ; recliquez le 1er sommet, double-clic ou Entrée pour peindre la zone' : '') + ' ; Échap annule la zone.'); }
        function brushPolyEnd() { const s = brushCur; if (!s || !s.brush.poly) return; brushCur = null; if (s.points.length < 3) { shapes = shapes.filter(x => x !== s); brushQueue(true); return; }
            s.open = false; brushNoSync = true; saveState(); brushQueue(true); updateCommandMessageText('PINCEAU : zone peinte (' + nfr(Math.abs(polyArea(s.points)) * mOf(1) ** 2, 1) + ' m²). Une autre zone : cliquez son 1er sommet. Échap pour finir.'); }
        function brushPolyCancel() { const s = brushCur; brushCur = null; if (s) shapes = shapes.filter(x => x !== s); brushQueue(true); updateCommandMessageText('PINCEAU — polygone : zone annulée.'); }
        // une polyligne fermée choisie (plan) devient une zone peinte de la texture du pinceau
        // zones peintes : la plus petite sous un point ; repeindre ; peindre un contour fermé cliqué (une plateforme, une polyligne, un cercle)
        function brushZoneAt(x, y) { let best = null, ba = Infinity; shapes.forEach(z => { if (!(z.brush && z.brush.poly && !z.open && z.points && z.points.length >= 3) || !pointInPolygon(x, y, z.points)) return; const a = Math.abs(polyArea(z.points)); if (a < ba) { ba = a; best = z; } }); return best; }
        function brushZoneRepaint(z, tex) { z.brush.tex = tex; brushNoSync = true; saveState(); brushQueue(true); draw(); updateCommandMessageText('PEINDRE : zone repeinte en « ' + ((TEX_LIB.find(t => t.id === tex) || {}).name || '') + ' ». Cliquez-en une autre, ou Échap.'); }
        function brushPickClick(w) { if (!brushTool) return; const z = brushZoneAt(w.x, w.y); if (z) { brushZoneRepaint(z, brushTool.tex); return; }
            const c = closedAt(w, x => !x.brush && !x.gen && !x.bois && !(typeof isBg === 'function' && isBg(x)) && x.type !== 'basemap' && ((x.type === 'poly' && !x.open && x.points && x.points.length >= 3) || x.type === 'circle'));
            if (!c) { updateCommandMessageText('PEINDRE — zone : cliquez à l\'intérieur d\'un contour fermé (plateforme, polyligne fermée, cercle) ou d\'une zone peinte.'); return; }
            const P = (c.type === 'circle' ? pierceRing(c) : c.points).map(q => ({ x: q.x, y: q.y }));
            const sh = { type: 'poly', open: false, layerId: brushLayer(), points: P, width: 1, hatch: false, name: 'Zone peinte', brush: { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, top: true, poly: true, zs: P.map(q => { const zz = groundZAt(q.x, q.y, false); return hasZ(zz) ? Math.round(zz) : 0; }) } };
            shapes.push(sh); brushNoSync = true; saveState(); brushQueue(true); draw();
            updateCommandMessageText('PEINDRE : contour peint (' + nfr(Math.abs(polyArea(P)) * mOf(1) ** 2, 1) + ' m²) en « ' + ((TEX_LIB.find(t => t.id === brushTool.tex) || {}).name || '') + ' ». Cliquez un autre contour, ou Échap.'); }
        function brushPaintSel() { const L = selectedShapes.filter(x => x.type === 'poly' && !x.open && !x.brush && x.points && x.points.length >= 3); if (!L.length || !brushTool) return;
            L.forEach(x => shapes.push({ type: 'poly', open: false, layerId: brushLayer(), points: x.points.map(q => ({ x: q.x, y: q.y })), width: 1, hatch: false, name: 'Zone peinte', brush: { tex: brushTool.tex, d: brushTool.d, h: brushTool.h, top: true, poly: true } }));
            selectedShapes = []; brushNoSync = true; saveState(); brushQueue(true); brushPanel(); updateCommandMessageText('PINCEAU : ' + L.length + ' contour(s) peint(s) en « ' + ((TEX_LIB.find(t => t.id === brushTool.tex) || {}).name || '') + ' ».'); }
        function brushErase(H) { const rr = (brushTool.d / 1000) / 2, gone = shapes.filter(s => s.brush && s.points && (s.brush.poly && !s.open ? pointInPolygon(H.q.x, H.q.y, s.points) : false) || s.brush && s.points && !s.brush.poly && s.points.some((q, i) => { const z = (s.brush.zs || [])[i]; return Math.hypot(mOf(q.x - H.q.x), mOf(q.y - H.q.y)) < rr + s.brush.d / 2000 && (!hasZ(z) || Math.abs(z - H.z) < 1500 + s.brush.d / 2); }));
            if (!gone.length) return; shapes = shapes.filter(s => !gone.includes(s)); brushTool.dirty = true; brushQueue(true); }
        function brushQueue(all) { if (all) brushAll = true; if (brushRAF) return; brushRAF = requestAnimationFrame(() => { brushRAF = 0; const a = brushAll || !brushCur; brushAll = false; try { if (V3 && V3.root) { v3BrushBuild(a ? null : brushCur); render3D(); } } catch (e) { console.error(e); } if (!is3DOpen()) draw(); }); }
        let brushAll = false;
        // cercle sous la souris : la taille du pinceau, posé sur la surface visée
        function v3BrushCursor(H) {
            if (!V3) return; if (!H || !brushTool) { if (V3.brCur) V3.brCur.visible = false; return; }
            if (!V3.brCur) { V3.brCur = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })); V3.brCur.renderOrder = 20; V3.brCur.raycast = () => {}; V3.scene.add(V3.brCur); }
            const c = V3.brCur, r = brushTool.d / 2000; c.visible = true; c.material.color.set(brushTool.erase ? 0xf87171 : 0xa3e635); c.scale.set(r, r, r); c.position.copy(H.p).addScaledVector(H.n, 0.01); c.lookAt(H.p.clone().add(H.n)); render3D(); }
        // superposition : chaque surface touchée reçoit une copie transparente qui ne montre que la peinture (motif posé en vraie grandeur, bord fondu selon la dureté)
        const BR_N = 48;
        function brushMat(tex, segs) {
            const T = TEX_LIB.find(t => t.id === tex), cv = texCanvas(tex); if (!T || !cv) return null;
            V3.brTex = V3.brTex || {}; let tx = V3.brTex[tex]; if (!tx) { tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4; V3.brTex[tex] = tx; }
            const A = [], B = [], C = []; for (let i = 0; i < BR_N; i++) { const g = segs[i]; A.push(g ? new THREE.Vector4(g.a.x, g.a.y, g.a.z, g.r) : new THREE.Vector4()); B.push(g ? new THREE.Vector4(g.b.x, g.b.y, g.b.z, Math.min(0.97, g.h)) : new THREE.Vector4()); C.push(g ? (g.top ? new THREE.Vector4(0, 0, g.tol, 1) : new THREE.Vector4(g.n[0], g.n[1], g.n[2], 0)) : new THREE.Vector4()); }
            const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
            m.onBeforeCompile = (sh) => {
                Object.assign(sh.uniforms, { bTex: { value: tx }, bTile: { value: T.tile || 1 }, bA: { value: A }, bB: { value: B }, bC: { value: C }, bN: { value: Math.min(BR_N, segs.length) } });
                sh.vertexShader = 'varying vec3 bW;\nvarying vec3 bNw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n bW = (modelMatrix * vec4(transformed, 1.0)).xyz; bNw = normalize(mat3(modelMatrix) * objectNormal);');
                sh.fragmentShader = `uniform sampler2D bTex; uniform float bTile; uniform vec4 bA[${BR_N}]; uniform vec4 bB[${BR_N}]; uniform vec4 bC[${BR_N}]; uniform int bN; varying vec3 bW; varying vec3 bNw;\n` + sh.fragmentShader.replace('#include <map_fragment>', `
                    float bAl = 0.0; vec3 nn = normalize(bNw);
                    for (int i = 0; i < ${BR_N}; i++) { if (i >= bN) break;
                        vec3 a = bA[i].xyz; vec3 b = bB[i].xyz; float r = bA[i].w; float h = bB[i].w; vec4 c = bC[i]; float d = 1e9;
                        if (c.w > 0.5) { if (abs(nn.z) < 0.35) continue; vec2 ab = b.xy - a.xy; float t = clamp(dot(bW.xy - a.xy, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0); vec3 q = a + (b - a) * t; if (abs(bW.z - q.z) > c.z) continue; d = length(bW.xy - q.xy); }
                        else { if (abs(dot(nn, c.xyz)) < 0.6) continue; vec3 ab = b - a; float t = clamp(dot(bW - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0); d = length(bW - (a + ab * t)); }
                        bAl = max(bAl, 1.0 - smoothstep(r * h, r, d)); }
                    if (bAl < 0.01) discard;
                    vec3 bw = pow(abs(nn), vec3(8.0)); bw /= (bw.x + bw.y + bw.z + 1e-6);
                    vec4 bc = texture2D(bTex, bW.yz / bTile) * bw.x + texture2D(bTex, bW.xz / bTile) * bw.y + texture2D(bTex, bW.xy / bTile) * bw.z;
                    diffuseColor *= vec4(bc.rgb, bAl);`);
            };
            m.customProgramCacheKey = () => 'brush' + BR_N; return m;
        }
        // zone peinte : tout l'intérieur du polygone (surfaces tournées vers le haut), bord fondu sur « fade » (m)
        const BRP_N = 160;
        function brushPolyMat(tex, P, fade) {
            const T = TEX_LIB.find(t => t.id === tex), cv = texCanvas(tex); if (!T || !cv) return null;
            V3.brTex = V3.brTex || {}; let tx = V3.brTex[tex]; if (!tx) { tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4; V3.brTex[tex] = tx; }
            let Q = P.map(p => new THREE.Vector2(p.x, p.y)); while (Q.length > BRP_N - 1) Q = Q.filter((q, i) => i % 2 === 0);
            const U = []; for (let i = 0; i < BRP_N; i++) U.push(i < Q.length ? Q[i] : i === Q.length ? Q[0].clone() : new THREE.Vector2());
            const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
            m.onBeforeCompile = (sh) => {
                Object.assign(sh.uniforms, { bTex: { value: tx }, bTile: { value: T.tile || 1 }, pP: { value: U }, pN: { value: Q.length }, pF: { value: fade } });
                sh.vertexShader = 'varying vec3 bW;\nvarying vec3 bNw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n bW = (modelMatrix * vec4(transformed, 1.0)).xyz; bNw = normalize(mat3(modelMatrix) * objectNormal);');
                sh.fragmentShader = `uniform sampler2D bTex; uniform float bTile; uniform vec2 pP[${BRP_N}]; uniform int pN; uniform float pF; varying vec3 bW; varying vec3 bNw;\n` + sh.fragmentShader.replace('#include <map_fragment>', `
                    vec3 nn = normalize(bNw); if (abs(nn.z) < 0.35) discard;
                    bool ins = false; float dm = 1e9; vec2 pt = bW.xy;
                    for (int i = 0; i < ${BRP_N - 1}; i++) { if (i >= pN) break; vec2 a = pP[i]; vec2 b = pP[i + 1];
                        if (((a.y > pt.y) != (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-12) + a.x)) ins = !ins;
                        vec2 ab = b - a; float t = clamp(dot(pt - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0); dm = min(dm, length(pt - (a + ab * t))); }
                    if (!ins) discard; float bAl = smoothstep(0.0, pF, dm); if (bAl < 0.01) discard;
                    vec3 bw = pow(abs(nn), vec3(8.0)); bw /= (bw.x + bw.y + bw.z + 1e-6);
                    vec4 bc = texture2D(bTex, bW.yz / bTile) * bw.x + texture2D(bTex, bW.xz / bTile) * bw.y + texture2D(bTex, bW.xy / bTile) * bw.z;
                    diffuseColor *= vec4(bc.rgb, bAl);`);
            };
            m.customProgramCacheKey = () => 'brushpoly' + BRP_N; return m;
        }
        // découpe d'une surface : seuls ses triangles proches de la peinture (bien moins de travail pour la carte graphique que toute la surface)
        function brushSubGeom(o, bb) {
            const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, I = g.index, n = I ? I.count : P.count, mw = o.matrixWorld, inv = new THREE.Matrix4().copy(mw).invert();
            const lb = bb.clone().applyMatrix4(inv), x0 = lb.min.x, y0 = lb.min.y, z0 = lb.min.z, x1 = lb.max.x, y1 = lb.max.y, z1 = lb.max.z, out = [], nr = [];
            for (let t = 0; t + 2 < n; t += 3) { const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2;
                const ax = P.getX(a), bx = P.getX(b), cx = P.getX(c); if ((ax < x0 && bx < x0 && cx < x0) || (ax > x1 && bx > x1 && cx > x1)) continue;
                const ay = P.getY(a), by = P.getY(b), cy = P.getY(c); if ((ay < y0 && by < y0 && cy < y0) || (ay > y1 && by > y1 && cy > y1)) continue;
                const az = P.getZ(a), bz = P.getZ(b), cz = P.getZ(c); if ((az < z0 && bz < z0 && cz < z0) || (az > z1 && bz > z1 && cz > z1)) continue;
                out.push(ax, ay, az, bx, by, bz, cx, cy, cz); [a, b, c].forEach(k => nr.push(N.getX(k), N.getY(k), N.getZ(k))); }
            if (!out.length) return null; const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(nr, 3)); return G;
        }
        // couches de peinture : un jeu par coup de pinceau (repérées par lui), reconstruit seulement pour le coup qu'on est en train de peindre
        /* zone peinte au sol (pavés, gravier…) : elle habille le sol, les plateformes et les dalles ; ce qui est posé dessus (voiture, meuble, arbre, mur, menuiserie, toit) garde sa propre matière */
        function brushZoneOn(o) { let q = o; while (q && q !== V3.root) { const u = q.userData || {}; if (u.blk || u.opening || u.leaf || u.door || u.shutter || u.paroiOf || u.gcKeep) return false;
                if (u.shape) { const s = u.shape; return !(s.wallMat || s.roofDef || s.roofPart || s.stair2 || s.ctop || (s.solid && s.solid.kind !== 'box') || s.sweep || s.type === 'mesh'); } q = q.parent; } return true; }
        function v3BrushBuild(only) {
            if (!V3 || !V3.root) return; const old = []; V3.root.traverse(o => { if (o.userData.brushOv && (!only || o.userData.brushOv === only)) old.push(o); }); old.forEach(o => { if (o.parent) o.parent.remove(o); if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); });
            if (V3.flat) return;
            const vis = shapes.filter(s => s.brush && s.points && s.points.length && (!only || s === only) && (layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).visible !== false && !(typeof lvlHidden === 'function' && lvlHidden(s))); if (!vis.length) return;
            const cx = -V3.root.position.x, cy = -V3.root.position.y, ex = V3.exag || 1, z0 = V3.zmin || 0, W = (q, z) => new THREE.Vector3(worldToMm(q.x) / 1000 - cx, -worldToMm(q.y) / 1000 - cy, ((hasZ(z) ? z : z0 * 1000) / 1000 - z0) * ex);
            V3.root.updateMatrixWorld(true); if (!V3.brT || V3.brT.root !== V3.root) { const T = []; V3.root.traverse(o => { if (!o.isMesh || !o.visible || o.userData.brushOv || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.transparent && m.opacity < 0.5 && !o.userData.rp) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); T.push({ o, bb: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) }); }); V3.brT = { root: V3.root, T }; }
            vis.forEach(s => { const b = s.brush, r = b.d / 2000, P = s.points.map((q, i) => W(q, (b.zs || [])[i])), segs = [];
                if (b.poly) { if (P.length < 3) { if (P.length) { const one2 = P.map((p2, i) => ({ a: p2, b: P[Math.min(i + 1, P.length - 1)], r: 0.08, h: 0.9, top: true, tol: 1e5, n: [0, 0, 1] })); const mat = brushMat(b.tex, one2.slice(0, BR_N)); if (mat) V3.brT.T.forEach(({ o, bb: ob }) => { const bb = new THREE.Box3(); P.forEach(q => bb.expandByPoint(q)); bb.expandByScalar(0.2); bb.min.z = -1e5; bb.max.z = 1e5; if (!ob.intersectsBox(bb) || !o.parent) return; const G = brushSubGeom(o, bb); if (!G) return; const ov = new THREE.Mesh(G, mat); ov.userData.brushOv = s; ov.raycast = () => {}; ov.renderOrder = (o.renderOrder || 0) + 3; o.add(ov); }); } return; }
                    const fade = Math.max(0.01, r * (1 - Math.min(0.99, b.h))), bb = new THREE.Box3(); P.forEach(q => bb.expandByPoint(q)); bb.min.x -= fade; bb.min.y -= fade; bb.max.x += fade; bb.max.y += fade; bb.min.z = -1e5; bb.max.z = 1e5;
                    const mat = brushPolyMat(b.tex, P, fade); if (!mat) return;
                    V3.brT.T.forEach(({ o, bb: ob }) => { if (!ob.intersectsBox(bb) || !o.parent || !brushZoneOn(o)) return; const G = brushSubGeom(o, bb); if (!G) return; const ov = new THREE.Mesh(G, mat); ov.userData.brushOv = s; ov.raycast = () => {}; ov.renderOrder = (o.renderOrder || 0) + 3; o.add(ov); }); return; }
                const one = (a, c) => segs.push({ a, b: c, r, h: b.h, top: !!b.top, tol: Math.max(1.2 * ex, r), n: b.n || [0, 0, 1] });
                if (P.length === 1) one(P[0], P[0]); else for (let i = 0; i + 1 < P.length; i++) one(P[i], P[i + 1]);
                for (let k = 0; k < segs.length; k += BR_N) { const ch = segs.slice(k, k + BR_N), bb = new THREE.Box3(); ch.forEach(g => { bb.expandByPoint(g.a); bb.expandByPoint(g.b); }); const tM = Math.max(...ch.map(g => g.top ? g.tol : g.r)); bb.min.x -= r; bb.min.y -= r; bb.max.x += r; bb.max.y += r; bb.min.z -= tM; bb.max.z += tM;
                    V3.brT.T.forEach(({ o, bb: ob }) => { if (!ob.intersectsBox(bb) || !o.parent) return; const G = brushSubGeom(o, bb); if (!G) return; const mat = brushMat(b.tex, ch); if (!mat) { G.dispose(); return; }
                        const ov = new THREE.Mesh(G, mat); ov.userData.brushOv = s; ov.raycast = () => {}; ov.renderOrder = (o.renderOrder || 0) + 3; o.add(ov); }); } });
        }
        // en plan : un coup de pinceau est une bande de la largeur du pinceau, remplie d'une hachure (selon le genre de motif), sur le calque Pinceau
        const BR_HATCH = {};
        function brushHatch(ctx, kind, col) { const key = kind + col; let c = BR_HATCH[key]; if (!c) { c = document.createElement('canvas'); c.width = c.height = 10; const g = c.getContext('2d'); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
                if (kind === 'sol') { [[2, 2], [7, 7]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); }); }
                else { g.beginPath(); g.moveTo(0, 10); g.lineTo(10, 0); g.moveTo(-5, 5); g.lineTo(5, -5); g.moveTo(5, 15); g.lineTo(15, 5); if (kind === 'maconnerie' || kind === 'beton') { g.moveTo(0, 0); g.lineTo(10, 10); g.moveTo(-5, 5); g.lineTo(5, 15); g.moveTo(5, -5); g.lineTo(15, 5); } g.stroke(); }
                BR_HATCH[key] = c; } return ctx.createPattern(c, 'repeat'); }
        function drawBrush2D(c, s, dx, dy, ls, sel, col) {
            const P = s.points; if (!P.length) return; const b = s.brush, W = mmToWorld(b.d || 500), T = TEX_LIB.find(t => t.id === b.tex), kind = T ? T.cat : 'sol', cl = sel ? '#ec4899' : col;
            c.save(); c.setLineDash([]); c.lineCap = 'round'; c.lineJoin = 'round';
            const path = () => { c.beginPath(); c.moveTo(P[0].x + dx, P[0].y + dy); if (P.length === 1) c.lineTo(P[0].x + dx + 1e-6, P[0].y + dy); else P.slice(1).forEach(q => c.lineTo(q.x + dx, q.y + dy)); };
            if (b.poly) {   // zone peinte : remplie (teinte légère + hachure), contour fin ; en cours de tracé : ses côtés
                path(); if (!s.open) c.closePath(); if (!s.open && P.length >= 3) { c.fillStyle = cl; c.globalAlpha = 0.14; c.fill(); const pt = brushHatch(c, kind, cl); try { pt.setTransform(new DOMMatrix().scale(1 / ls)); } catch (e) {} c.fillStyle = pt; c.globalAlpha = 0.85; c.fill(); }
                c.globalAlpha = 1; c.strokeStyle = cl; c.lineWidth = 1 / ls; if (s.open) c.setLineDash([5 / ls, 3 / ls]); c.stroke(); c.restore(); return; }
            // bande légèrement teintée, puis la hachure (espacement constant à l'écran)
            path(); c.strokeStyle = cl; c.lineWidth = W; c.globalAlpha = 0.14; c.stroke();
            const pt = brushHatch(c, kind, cl); try { pt.setTransform(new DOMMatrix().scale(1 / ls)); } catch (e) {} path(); c.strokeStyle = pt; c.globalAlpha = 0.85; c.stroke();
            c.restore(); }
