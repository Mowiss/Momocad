const path = require('path');
// Outils de dessin, à la souris et au clavier, sur un plan vierge en mètres.
module.exports = { name: 'dessin', run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(25);
    const last = (type) => ev(type => { const s = shapes.filter(x => x.type === type).at(-1); if (!s) return null; const M = v => worldToMm(v) / 1000;
        if (type === 'line') return { x1: M(s.x1), y1: -M(s.y1), x2: M(s.x2), y2: -M(s.y2) };
        if (type === 'poly') return { n: s.points.length, open: !!s.open, pts: s.points.map(q => [+M(q.x).toFixed(3), +(-M(q.y)).toFixed(3)]) };
        if (type === 'circle' || type === 'arc') return { x: M(s.x), y: -M(s.y), r: M(s.r) };
        if (type === 'dim') { const g = dimGeom(s); return { d: M(g.dist) }; }
        return s; }, type);
    const count = (type) => ev(type => shapes.filter(x => x.type === type).length, type);
    const esc = async () => { await H.press('Escape'); await H.press('Escape'); };
    const len = (l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);

    // droite : deux clics
    await H.tool('btn-line'); await H.click(await H.W(0, 0)); await H.click(await H.W(10, 0)); await esc();
    let l = await last('line'); t.ok('droite en deux clics', l && Math.abs(len(l) - 10) < 0.05, JSON.stringify(l));

    // droite : longueur tapée (direction donnée par la souris)
    await H.tool('btn-line'); await H.click(await H.W(0, 2)); { const q = await H.W(6, 2); await p.mouse.move(q.x, q.y); } await H.key('7.5 '); await esc();
    l = await last('line'); t.ok('droite de 7,5 m tapée au clavier', l && Math.abs(len(l) - 7.5) < 1e-6 && Math.abs(l.y2 - 2) < 1e-6, JSON.stringify(l));

    // polyligne : valeurs tapées, Espace entre les segments, Entrée pour finir
    await H.tool('btn-pline'); await H.click(await H.W(0, 5));
    { const q = await H.W(3, 5); await p.mouse.move(q.x, q.y); } await H.key('4 ');
    { const q = await H.W(4, 7); await p.mouse.move(q.x, q.y); } await H.key('3 ');
    await H.press('Enter'); await esc();
    let pl = await last('poly'); t.eq('polyligne 4 m puis 3 m', pl && pl.pts, [[0, 5], [4, 5], [4, 8]]);

    // rectangle : deux coins
    await H.tool('btn-rect'); await H.click(await H.W(20, 0)); await H.click(await H.W(26, 4)); await esc();
    pl = await last('poly'); t.ok('rectangle 6 × 4 fermé', pl && pl.n === 4 && !pl.open, JSON.stringify(pl));

    // cercle : centre + rayon tapé
    const nc = await count('circle');
    await H.tool('btn-circle'); await H.click(await H.W(30, 10)); await H.key('2 '); await esc();
    const c = await last('circle'); t.ok('cercle de rayon 2 m', (await count('circle')) === nc + 1 && Math.abs(c.r - 2) < 1e-6 && Math.abs(c.x - 30) < 0.05, JSON.stringify(c));

    // arc : centre, départ, arrivée
    await H.tool('btn-arc'); await H.click(await H.W(40, 0)); await H.click(await H.W(43, 0));
    for (let d = 0; d <= 90; d += 15) { const a = d * Math.PI / 180, q = await H.W(40 + 3 * Math.cos(a), 3 * Math.sin(a)); await p.mouse.move(q.x, q.y); await H.wait(20); }
    await H.click(await H.W(40, 3)); await esc();
    const a = await last('arc'); t.ok('arc de rayon 3 m', a && Math.abs(a.r - 3) < 0.05, JSON.stringify(a));

    // cotes
    await H.tool('btn-dim-ortho'); await H.click(await H.W(0, 0)); await H.click(await H.W(10, 0)); await H.click(await H.W(5, -2)); await esc();
    let d = await last('dim'); t.ok('cote ortho = 10,00 m', d && Math.abs(d.d - 10) < 0.01, JSON.stringify(d));
    await H.tool('btn-dim'); await H.click(await H.W(20, 0)); await H.click(await H.W(26, 4)); await H.click(await H.W(22, 4)); await esc();
    d = await last('dim'); t.ok('cote libre en biais = 7,21 m', d && Math.abs(d.d - Math.hypot(6, 4)) < 0.01, JSON.stringify(d));
    const nr = await count('dimr');
    await H.tool('btn-dim-rad'); await H.click(await H.W(32, 10)); await H.click(await H.W(34, 12)); await esc();
    t.ok('cote de rayon posée sur le cercle', (await count('dimr')) === nr + 1);

    // texte
    const nt = await count('text');
    await H.tool('btn-text'); await H.click(await H.W(0, 12)); await H.wait(300);
    await p.keyboard.type('Regard EP'); await H.press('Enter'); await esc();
    t.ok('texte « Regard EP » posé', (await count('text')) === nt + 1 && await ev(() => (shapes.filter(s => s.type === 'text').at(-1) || {}).content === 'Regard EP'), await ev(() => JSON.stringify(shapes.filter(s => s.type === 'text').at(-1))));

    // annuler / rétablir
    const n0 = await ev(() => shapes.length); await ev(() => undo()); const n1 = await ev(() => shapes.length); await ev(() => redo()); const n2 = await ev(() => shapes.length);
    t.ok('Annuler retire le dernier objet, Rétablir le remet', n1 === n0 - 1 && n2 === n0, [n0, n1, n2].join(' → '));
    // motif de matériau sur une couche épaisse : les hachures inclinées couvrent toute la bande (pas de coin vide)
    const hz = await H.ev(() => { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 250; const c = cv.getContext('2d'); c.setTransform(0.1, 0, 0, 0.1, 0, 0); c.strokeStyle = '#fff';
        const r = {}; ['beton', 'brique', 'parpaing'].forEach(mat => { c.clearRect(0, 0, 4000, 2500); wallPattern(c, mat, 4000, 2500, 0.1, 1); const d = c.getImageData(0, 0, 400, 250).data, zone = (x0, x1, y0, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (d[(y * 400 + x) * 4 + 3] > 0) n++; return n; }; r[mat] = [[0, 0], [360, 0], [0, 210], [360, 210]].every(([x, y]) => zone(x, x + 40, y, y + 40) > 10); }); return r; });
    t.eq('motif de matériau épais : hachures sur toute la largeur', hz, { beton: true, brique: true, parpaing: true });
    // motifs de sol (sable, GNT, pierre) : visibles à l'échelle du plan, sans hachures droites superposées
    const ms = await H.ev(() => { const r = {}; ['sable', 'gnt', 'pierre'].forEach(mat => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; const c = cv.getContext('2d'); c.setTransform(0.1, 0, 0, 0.1, 0, 0); c.strokeStyle = '#fff';
        wallPattern(c, mat, 3000, 1500, 0.1, 1); const d = c.getImageData(0, 0, 300, 150).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; r[mat] = n > 300 && n < 300 * 150 * 0.6; }); return r; });
    t.eq('motifs sable, GNT, pierre : dessinés, sans aplat ni hachure', ms, { sable: true, gnt: true, pierre: true });
    // plan PDF calé : Y › Points topo du plan lit les cotes dans le PDF (pas dans l'image) et implante un point à chaque repère, à l'altitude lue
    await H.ev(() => { shapes = []; saveState(); });
    await H.p.setInputFiles('#bgimage-input', path.join(__dirname, '..', 'fixtures', 'topo.pdf')); await H.wait(1500);
    await H.ev(() => { document.querySelector('input[name=bg-scale][value=ech]').checked = true; document.getElementById('bg-ech').value = '200'; }); await H.ev(() => insertBgImage()); await H.wait(1500);
    const pt = await H.ev(() => { const bg = shapes.find(x => x.type === 'bgimage'); if (!bg || !bg.pdfTopo) return null; selectedShapes = [bg]; openSelectionParamModal();
        const btn = [...document.querySelectorAll('#selparam-modal .sp-act, #selparam-modal button')].find(b => /Importer points/.test(b.textContent)); if (!btn) return 'pas de bouton'; btn.click();
        const imp = [...document.querySelectorAll('#tm-actions button')].find(b => /Importer/.test(b.textContent)); imp.click();
        const P = shapes.filter(x => x.type === 'point'), zs = P.map(x => x.z / 1000).sort((a, b) => a - b);
        // deux croix voisines du PDF : 150 pt × 25,4 / 72 × 200 ≈ 10,58 m (± le décalage aléatoire du gabarit)
        const a = P.find(x => Math.abs(x.z - 455110) < 2), b2 = P.find(x => Math.abs(x.z - 455520) < 2), d = a && b2 ? Math.hypot(a.x - b2.x, a.y - b2.y) / mmToWorld(1000) : 0;
        const r = { n: P.length, lo: zs[0], hi: zs[zs.length - 1], d: Math.round(d * 10) / 10, tin: tinNodes().length >= 24 }; shapes = []; saveState(); return r; });
    const exp = require(path.join(__dirname, '..', 'fixtures', 'topo_pts.json')), A = exp[0], B = exp[1], dExp = Math.round(Math.hypot(A[0] - B[0], A[1] - B[1]) * 25.4 / 72 * 200 / 1000 * 10) / 10;
    t.eq('plan PDF : 24 cotes lues dans le PDF, points implantés sur leurs croix (cote 12,50 écartée)', pt, { n: 24, lo: 455.11, hi: 460.55, d: dExp, tin: true });
    // plan PDF : talus reconnu à ses hachures (tête et pied en lignes de rupture 3D, Z tiré des cotes posées dessus) ; traits du plan dans un calque à son nom, sans les repères des points
    await H.ev(() => { shapes = []; saveState(); });
    await H.p.setInputFiles('#bgimage-input', path.join(__dirname, '..', 'fixtures', 'talus.pdf')); await H.wait(1500);
    await H.ev(() => { document.querySelector('input[name=bg-scale][value=ech]').checked = true; document.getElementById('bg-ech').value = '200'; }); await H.ev(() => insertBgImage()); await H.wait(1500);
    const tl = await H.ev(() => { const bg = shapes.find(x => x.type === 'bgimage'); if (!bg) return 'pas de fond'; selectedShapes = [bg]; pdfTopoDialog(bg); ['pi-pts', 'pi-tal', 'pi-trc'].forEach(id => document.getElementById(id).checked = true);
        [...document.querySelectorAll('#tm-actions button')].find(b => /Importer/.test(b.textContent)).click();
        const lay = (n) => (layers.find(l => l.name === n) || {}).id, BL = shapes.filter(x => x.layerId === lay('Talus (PDF)')), hd = BL.find(x => /Tête/.test(x.name)), ft = BL.find(x => /Pied/.test(x.name));
        const zr = (p) => p ? [Math.min(...p.points.map(q => q.z)), Math.max(...p.points.map(q => q.z))] : null, mid = hd ? hd.points[Math.floor(hd.points.length / 2)].z : 0;
        const TR = shapes.filter(x => x.layerId === lay('talus')), r = { talus: bg.pdfTalus.length, lines: BL.length, head: zr(hd), foot: zr(ft), mid: Math.abs(mid - 460500) < 60, pts: shapes.filter(x => x.type === 'point').length,
            vec: TR.length === 1 && TR[0].type === 'pdfvec', rect: TR.some(x => { const v = vecStore[x.vecId]; for (let q = 0; q < v.st.length - 1; q++) if (v.cl[q] && v.st[q + 1] - v.st[q] === 4) return true; return false; }),
            tiny: TR.reduce((n, x) => { const v = vecStore[x.vecId]; for (let q = 0; q < v.st.length - 1; q++) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let k = v.st[q]; k < v.st[q + 1]; k++) { a = Math.min(a, v.xy[2 * k]); b = Math.max(b, v.xy[2 * k]); c = Math.min(c, v.xy[2 * k + 1]); d = Math.max(d, v.xy[2 * k + 1]); } if (Math.max(b - a, d - c) < 3) n++; } return n; }, 0),
            hit: TR.length ? findShapeAt(vecCorners(TR[0])[0].x, vecCorners(TR[0])[0].y) !== null : false, vecs: Object.keys(projectData().vecs || {}).length === 1, tin: !!getTIN() };
        shapes = []; saveState(); return r; });
    t.eq('plan PDF : talus lu (tête 460→461, pied 457), tracés dans le calque « talus » sans les croix des points', tl, { talus: 1, lines: 2, head: [460000, 461000], foot: [457000, 457000], mid: true, pts: 4, vec: true, rect: true, tiny: 0, hit: true, vecs: true, tin: true });
    // plan PDF écrit en police filaire (chaque chiffre en petits traits, pas de vrai texte) : échelle lue dans le nom du fichier, carroyage et cotes relus quand même
    await H.ev(() => { shapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); });
    await H.p.setInputFiles('#bgimage-input', path.join(__dirname, '..', 'fixtures', 'filaire-200.pdf')); await H.wait(2500);
    const fq = require(path.join(__dirname, '..', 'fixtures', 'filaire_pts.json'));
    const fl = await H.ev(async (truth) => { const r0 = { ech: document.getElementById('bg-ech').value, grid: document.getElementById('bg-grid-row').style.display === 'flex' }; await insertBgImage();
        const bg = shapes.find(x => x.type === 'bgimage'); if (!bg) return r0; selectedShapes = [bg]; pdfTopoDialog(bg); document.getElementById('pi-pts').checked = true; [...document.querySelectorAll('#tm-actions button')].find(b => /Importer/.test(b.textContent)).click();
        const P = shapes.filter(x => x.type === 'point').map(q => ({ X: realX(q.x) / 1000, Y: realY(q.y) / 1000, z: q.z / 1000 })); let good = 0, bad = 0;
        truth.forEach(([X, Y, z]) => { const q = P.find(p => Math.hypot(p.X - X, p.Y - Y) < 0.15); if (!q) return; if (Math.abs(q.z - z) < 0.005) good++; else bad++; });
        const r = Object.assign(r0, { crs: (detectCRS() || {}).code, good: good >= 54, bad }); shapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); return r; }, fq);
    t.eq('PDF en police filaire : échelle 1/200 (nom du fichier), calage CC44 sur le carroyage dessiné, cotes relues sans erreur', fl, { ech: '200', grid: true, crs: 'CC44', good: true, bad: 0 });
    // gros tracés PDF : le dessin est mis en image ; pendant un déplacement de la vue, l'image suit le geste sans tout redessiner
    const big = await ev(() => { shapes = []; const P = []; for (let i = 0; i < 100000; i++) P.push({ p: [[i % 400, Math.floor(i / 400)], [i % 400 + 0.5, Math.floor(i / 400) + 0.5]], c: 0 }); vecStore.vt = vecMake(400, 250, P);
        shapes.push({ type: 'pdfvec', layerId: 'layer-0', vecId: 'vt', x: 0, y: 0, w: mmToWorld(80000), h: mmToWorld(50000), rot: 0, n: 100000 }); invalidateCache(); saveState(); draw(); const k1 = drawCache.key;
        isPanning = true; camera.x += 40; draw(); const k2 = drawCache.key; isPanning = false; camera.x -= 40; draw();
        const r = { cached: !!k1 && drawCache.cv !== null, gesture: k2 === k1 }; shapes = []; delete vecStore.vt; saveState(); draw(); return r; });
    t.eq('gros tracés PDF : dessin mis en image, la vue suit le geste sans tout redessiner', big, { cached: true, gesture: true });
    // gros tracés vus de loin : allégés à l'écran (tuiles hors vue sautées, détails sous le pixel fusionnés) sans changer l'image ni les données
    const lod = await ev(() => { shapes = []; const P = []; let s0 = 7; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 40000; i++) { const x = rnd() * 400, y = rnd() * 250; P.push({ p: [[x, y], [x + rnd() * 0.3, y + rnd() * 0.3], [x + rnd() * 0.3, y + 0.2]], c: 0 }); } for (let i = 0; i < 50; i++) P.push({ p: [[0, i * 5], [400, i * 5 + 3]], c: 0 });
        vecStore.vl = vecMake(400, 250, P); const s = { type: 'pdfvec', layerId: 'layer-0', vecId: 'vl', x: 0, y: 0, w: mmToWorld(80000), h: mmToWorld(50000), rot: 0, n: P.length }; shapes.push(s); invalidateCache(); saveState();
        const grab = () => { drawCache.key = null; draw(); return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; };
        zoomExtents(); const A = grab(); const vs = window.vecStroke; window.vecStroke = (I, c) => c.stroke(I.path); const B = grab(); window.vecStroke = vs;
        const W = canvas.width, Hh = canvas.height, bs = 8; let ink = 0, sum = 0, nb = 0, mx = 0;   // comparé à l'œil : moyenne par carrés de 8 pixels
        for (let by = 0; by + bs <= Hh; by += bs) for (let bx = 0; bx + bs <= W; bx += bs) { let a = 0, b = 0; for (let y = by; y < by + bs; y++) for (let x = bx; x < bx + bs; x++) { const i = 4 * (y * W + x); a += A[i] + A[i + 1] + A[i + 2]; b += B[i] + B[i + 1] + B[i + 2]; if (B[i] > 60) ink++; }
            const d = Math.abs(a - b) / (3 * bs * bs); sum += d; nb++; if (d > mx) mx = d; }
        const I = vecInfo('vl'), lodOn = I.tiles.some(t => Object.keys(t.lod).some(k => +k > -30)); I.tiles.forEach(t => t.lod = {}); camera.zoom *= 40; draw(); const tilesUsed = I.tiles.filter(t => Object.keys(t.lod).length).length;
        const kept = vecStore.vl.xy.length === 3 * 40000 * 2 + 50 * 4; shapes = []; delete vecStore.vl; invalidateCache(); saveState(); zoomExtents(); draw();
        return { lodOn, close: ink > 1000 && sum / nb < 4 && mx < 60, culled: tilesUsed < I.tiles.length, kept }; });
    t.eq('gros tracés vus de loin : allégés à l\'écran, même image, données intactes', lod, { lodOn: true, close: true, culled: true, kept: true });
    // bâtiments d'un plan PDF : contours du calque « Bati » recousus (traits bout à bout, dans le désordre), hachures et débords de toit ignorés
    const pb = await ev(() => { const u = (x, y) => [x / 1000, y / 1000], V = { ocg: true, W: 1000, H: 1000, L: ['', 'Bati', 'Bati_h', 'Bati_Surplomb', 'Végétation'], P: [
            { l: 1, p: [u(100, 100), u(300, 100)] }, { l: 1, p: [u(100, 250), u(100, 100.5)] }, { l: 1, p: [u(300, 100), u(300, 250), u(100, 250)] },
            { l: 2, p: [u(120, 120), u(280, 230)] }, { l: 3, p: [u(90, 90), u(310, 90), u(310, 260), u(90, 260)], c: 1 }, { l: 4, p: [u(500, 500), u(600, 500), u(600, 600)], c: 1 }, { l: 1, p: [u(700, 700), u(800, 700), u(800, 800), u(700, 800)], c: 1 }] };
        const B = pdfBats(V); return { n: B.length, sizes: B.map(L => L.length).sort(), lay: ['Bati', 'BATIMENT', '3BATIDUR', 'Constructions', 'Bati_h', 'Bati_Surplomb', 'Z-Toiture', 'Batiment_txt'].map(pdfBatLayer) }; });
    t.eq('bâtiments du PDF : contours recousus, hachures et débords ignorés', pb, { n: 2, sizes: [4, 4], lay: [true, true, true, true, false, false, false, false] });
    // carroyage avec des nombres parasites (n° de dossier, hachures lues « 1111111 ») : écartés, le calage reste juste
    const gj = await H.ev(() => { const W = 1000, H2 = 700, lab = []; for (let i = 0; i < 6; i++) lab.push([(100 + i * 150) / W, 680 / H2, 1899100 + i * 30, -1.57]); for (let j = 0; j < 4; j++) lab.push([20 / W, (600 - j * 150) / H2, 3128300 + j * 30, 0]);
        lab.push([0.5 / 1, 0.5, 1111111, 0], [0.3, 0.3, 210600, 0], [0.7, 0.2, 128280, 0]); const f = pdfGridFit({ crs: 'CC44', lab, cx: [], W, H2, H: H2 }, null); if (!f) return null; const q = f.f(250, 400); return { ech: Math.round(f.scale * 72 / 25.4 * 1000), x: Math.round(q.X), y: Math.round(q.Y) }; });
    t.eq('carroyage : nombres parasites écartés', gj, { ech: 567, x: 1899130, y: 3128340 });
    // traits en pointillé recousus en une ligne (pied de talus d'un calque « Tal_p »…)
    const st = await H.ev(() => { const P = []; for (let x = 0; x < 100; x += 6) P.push([[x, 10 + x * 0.1], [x + 4, 10 + (x + 4) * 0.1]]); P.push([[50, 50], [55, 50]]); const R = pdfStitch(P.sort(() => Math.random() - 0.5)); return R.map(r => r.length).sort((a, b) => b - a).slice(0, 2); });
    t.eq('pointillés recousus en une seule polyligne', st, [34, 2]);
    // plan PDF avec carroyage : l'échelle du cartouche est proposée d'office, puis le plan se cale tout seul sur ses coordonnées (CC44, tourné de 5°)
    await H.ev(() => { shapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); });
    await H.p.setInputFiles('#bgimage-input', path.join(__dirname, '..', 'fixtures', 'grid.pdf')); await H.wait(1800);
    const gq = require(path.join(__dirname, '..', 'fixtures', 'grid_pt.json'));
    const gp = await H.ev(async (q) => { const r0 = { ech: document.getElementById('bg-ech').value, row: document.getElementById('bg-grid-row').style.display, chk: document.getElementById('bg-grid').checked };
        await insertBgImage(); const bg = shapes.find(x => x.type === 'bgimage'); if (!bg) return r0; const P = bgUV(bg, q.u, q.v), e = Math.hypot(realX(P.x) / 1000 - q.X, realY(P.y) / 1000 - q.Y);
        const r = Object.assign(r0, { crs: (detectCRS() || {}).code, errOk: e < 0.05, rot: Math.round(Math.abs(bg.rot) * 180 / Math.PI), grid: !!bg.pdfGrid, msg: /CALÉ SUR SON CARROYAGE/.test(document.getElementById('command-text').textContent) });
        shapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); return r; }, gq);
    t.eq('PDF avec carroyage : échelle 1/500 lue, plan calé sur ses coordonnées CC44 (< 5 cm), rotation 5°', gp, { ech: '500', row: 'flex', chk: true, crs: 'CC44', errOk: true, rot: 5, grid: true, msg: true });
    // système de coordonnées : un plan en Lambert 93 converti en CC44 ; chaque point prend ses vraies coordonnées CC44 (à 1 cm près sur 500 m), le fond suit
    const cr = await H.ev(() => { shapes = []; const L = lccParams('L93'), C = lccParams('CC44'), q0 = lccFwd(L, 43.45, 5.25); geoOrigin = { x: Math.floor(q0.x) * 1000, y: Math.floor(q0.y) * 1000 };
        const W = (x, y) => ({ x: mmToWorld(x * 1000 - geoOrigin.x), y: -mmToWorld(y * 1000 - geoOrigin.y) }), R = [[0, 0], [400, 50], [250, 380], [-120, 300]].map(([dx, dy]) => ({ x: q0.x + dx, y: q0.y + dy }));
        R.forEach(r => shapes.push(Object.assign({ type: 'point', layerId: 'layer-0', z: 70000 }, W(r.x, r.y)))); const c0 = W(q0.x, q0.y); shapes.push({ type: 'basemap', layerId: 'layer-0', x: c0.x, y: c0.y, r: mmToWorld(200000), rot: 0, mapId: 'x', lat: 43.45, lon: 5.25, radiusM: 200, geo: 'L93' });
        camera.x = canvas.width / 2 - c0.x * camera.zoom; camera.y = canvas.height / 2 - c0.y * camera.zoom; const before = detectCRS().code; crsConvert('CC44');
        let err = 0; shapes.filter(s => s.type === 'point').forEach((s, i) => { const ll = lccInv(L, R[i].x, R[i].y), e = lccFwd(C, ll.lat, ll.lon); err = Math.max(err, Math.hypot(realX(s.x) / 1000 - e.x, realY(s.y) / 1000 - e.y)); });
        const bm = shapes.find(s => s.type === 'basemap'); const r = { before, after: detectCRS().code, errCm: err < 0.01, geo: bm.geo, rot: Math.abs(bm.rot) > 1e-4 }; shapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); return r; });
    t.eq('plan Lambert 93 converti en CC44 : coordonnées exactes (< 1 cm), fond tourné avec lui', cr, { before: 'L93', after: 'CC44', errCm: true, geo: 'CC44', rot: true });
} };
