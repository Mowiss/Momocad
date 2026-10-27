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
} };
