// Aller-retour des fichiers : un plan riche est enregistré puis rouvert en .mmc, puis en DXF ; rien ne doit se perdre.
module.exports = { name: 'fichiers', timeout: 240, run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(14);
    // --- un plan qui contient un peu de tout ---
    await ev(() => {
        const m = mmToWorld(1000), P = (x, y, z) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {});
        const L = ensureLayer('EU', '#b91c1c'); const lay = layers.find(l => l.id === L); Object.assign(lay, { dash: 'text', ltText: 'EU Ø160', width: 2, hatch: 'cross', textH: 2.5 });
        shapes.push({ type: 'line', layerId: L, x1: 0, y1: 0, x2: 10 * m, y2: 0, z1: 101250, z2: 100900 });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: true, points: [P(0, 3, 100000), P(5, 3, 100100), P(5, 6, 100200)] });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [P(20, 0), P(26, 0), P(26, 4), P(20, 4)] });
        shapes.push({ type: 'circle', layerId: 'layer-0', x: 30 * m, y: -10 * m, r: 2 * m });
        shapes.push({ type: 'arc', layerId: 'layer-0', x: 40 * m, y: 0, r: 3 * m, startAngle: -Math.PI / 2, endAngle: 0 });
        shapes.push({ type: 'text', layerId: 'layer-0', x: 0, y: -12 * m, content: 'Regard EP n°3', size: 20 });
        shapes.push(makeDim(P(0, 0), P(10, 0), P(5, -2), 'h'));
        shapes.push(makeDim(P(26, 0), P(26, 4), P(28, 2), 'v'));
        shapes.push(makeDim(P(20, 0), P(26, 4), P(22, 4), null));
        shapes.push({ type: 'dim-angle', layerId: DIM_LAYER_ID, vertex: P(50, 0), p1: P(55, 0), p2: P(50, 5) });
        const TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i < 4; i++) shapes.push({ type: 'point', layerId: TN, x: (60 + i * 5) * m, y: -20 * m, z: 100000 + i * 250, zk: 1, mat: 'TN' + (i + 1), code: i % 2 ? 'BORD' : 'TN' });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[15, 12], [35, 12], [35, 28], [15, 28]].map(([x, y]) => P(x, y, 98000)), zk: 1,
            talus: { R: 1200, cx: true, edges: [{ off: true, pl: 'Mur de soutènement' }, { name: 'Côté route', kD: '2/1', R: 3000, zf: 99500 }, null, { kR: '3/1' }] }, cubRP: { on: true, z: 99000 } });
        trenchDraw = trClone(trCur); const tr = trCreate([P(2, 18), P(12, 18)]); trenchDraw = null; tr.points[1].reg = true; tr.points[1].regD = 1200; tr.points[1].tM = 100500;
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[40, 30], [48, 30], [48, 38], [40, 38]].map(([x, y]) => P(x, y)), open: false, water: { z: 99300, name: 'Étang' }, zk: 1 });
        startStamp('arbre'); currentX = 60 * m; currentY = -5 * m; placeStamp(); setMode('select-box');
        dimStyleSet({ term: 'arrow', line: 'dashed', txtPos: 'above', txtBg: 'pill', extMode: 'fix', extLen: 9 }); dimTextAligned = true;
        saveState(); invalidateCache(); draw();
    });
    // hachure posée à la souris dans le rectangle
    await H.tool('btn-hatch'); await H.click(await H.W(23, 2)); await H.press('Escape'); await ev(() => setMode('select-box'));
    t.ok('hachure créée dans le rectangle', await ev(() => shapes.some(s => s.type === 'hatch')));
    await H.tool('btn-dim-rad'); await H.click(await H.W(32, 10)); await H.click(await H.W(34, 12)); await H.press('Escape'); await ev(() => setMode('select-box'));
    t.ok('cote de rayon posée', await ev(() => shapes.some(s => s.type === 'dimr')));

    // empreinte de chaque objet : type, calque, géométrie au mm, altitudes et réglages métier
    await ev(() => { window.__sig = (opts) => { const mm = v => Math.round(worldToMm(v)), lay = id => (layers.find(l => l.id === id) || {}).name || id;
        const pts = s => (s.points || []).map(q => [mm(q.x), mm(q.y), q.z !== undefined && q.z !== null ? Math.round(q.z) : null]);
        const one = s => { const b = { type: s.type, layer: lay(s.layerId) };
            if (s.type === 'line') Object.assign(b, { g: [mm(s.x1), mm(s.y1), mm(s.x2), mm(s.y2)], z: [s.z1 ?? null, s.z2 ?? null].map(v => v === null ? null : Math.round(v)) });
            else if (s.type === 'poly') Object.assign(b, { g: pts(s), open: !!s.open, talus: s.talus ? JSON.stringify(platTalus(s).edges.map(e => e && [e.kR, e.kD, e.R, e.zf, !!e.off, e.name || '', e.pl || ''])) + '|R' + platTalus(s).R + '|cx' + !!platTalus(s).cx : null,
                cubRP: s.cubRP ? [!!s.cubRP.on, s.cubRP.z] : null, trench: s.trench ? s.trench.name + '|' + s.points.map(q => [q.reg ? 1 : 0, q.regD ?? '', q.tM ?? ''].join(':')).join(',') : null, water: s.water ? [s.water.z, s.water.name || ''] : null });
            else if (s.type === 'circle' || s.type === 'arc') Object.assign(b, { g: [mm(s.x), mm(s.y), mm(s.r)], a: s.type === 'arc' ? [s.startAngle, s.endAngle].map(a => +(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(3)) : null });
            else if (s.type === 'text') Object.assign(b, { g: [mm(s.x), mm(s.y)], c: s.content });
            else if (s.type === 'dim') { const g = dimGeom(s); Object.assign(b, { d: mm(g.dist), o: s.orient || '' }); }
            else if (s.type === 'dimr') Object.assign(b, { g: [s.x, s.y, s.ax, s.ay, s.lx, s.ly].map(mm), dia: !!s.dia });
            else if (s.type === 'dim-angle') Object.assign(b, { g: [s.vertex, s.p1, s.p2].map(q => [mm(q.x), mm(q.y)]) });
            else if (s.type === 'point') Object.assign(b, { g: [mm(s.x), mm(s.y), Math.round(s.z)], mat: s.mat || '', code: s.code || '' });
            else if (s.type === 'hatch') Object.assign(b, { n: s.loops.length });
            if (opts && opts.block && s.block) b.block = s.block;
            return JSON.stringify(b); };
        return shapes.filter(s => !isBg(s)).map(one).sort(); }; });
    const before = await ev(() => __sig({ block: true }));
    const layBefore = await ev(() => { const l = layers.find(x => x.name === 'EU'); return [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; });
    const diff = (a, b) => { const A = new Map(), B = new Map(); a.forEach(x => A.set(x, (A.get(x) || 0) + 1)); b.forEach(x => B.set(x, (B.get(x) || 0) + 1));
        const lost = [...A].filter(([k, n]) => (B.get(k) || 0) < n).map(([k]) => k), extra = [...B].filter(([k, n]) => (A.get(k) || 0) < n).map(([k]) => k); return { lost, extra }; };

    // --- .mmc ---
    const mmc = await ev(() => JSON.stringify(projectData()));
    await H.blank(14);
    await ev((txt) => { loadProjectText(txt, 'essai.mmc'); }, mmc); await H.wait(300);
    { const after = await ev(() => __sig({ block: true })), d = diff(before, after);
      t.ok('.mmc : ' + before.length + ' objets identiques après réouverture', !d.lost.length && !d.extra.length, 'perdus ' + d.lost.slice(0, 3).join(' ; ') + ' | en trop ' + d.extra.slice(0, 3).join(' ; ')); }
    t.eq('.mmc : style du calque EU conservé', await ev(() => { const l = layers.find(x => x.name === 'EU'); return l && [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; }), layBefore);
    t.eq('.mmc : style des cotes conservé', await ev(() => [dimStyle.term, dimStyle.line, dimStyle.txtPos, dimStyle.txtBg, dimStyle.extMode, dimStyle.extLen, dimTextAligned]), ['arrow', 'dashed', 'above', 'pill', 'fix', 9, true]);

    // --- DXF ---
    const dxf = await ev(() => exportDXF());
    t.ok('DXF exporté sans erreur', typeof dxf === 'string' && dxf.length > 1000 && /EOF\s*$/.test(dxf));
    await ev(() => { shapes = []; dimStyleSet({}); }); await H.blank(14);
    const ok = await ev(async (txt) => loadFileObject(new File([txt], 'essai.dxf'), 'essai.dxf'), dxf); await H.wait(300);
    t.ok('DXF rouvert comme un plan', ok === true);
    { // le DXF éclate les blocs en traits : on compare sans l'étiquette de bloc
      const b2 = await ev(() => __sig()), bNoBlock = before.map(x => { const o = JSON.parse(x); delete o.block; return JSON.stringify(o); }).sort(), d = diff(bNoBlock, b2);
      t.ok('DXF : ' + before.length + ' objets retrouvés à l\'identique (géométrie au mm, altitudes, réglages métier)', !d.lost.length && !d.extra.length,
          d.lost.length + ' perdus, ' + d.extra.length + ' en trop — perdus : ' + d.lost.join(' ; ') + ' | en trop : ' + d.extra.join(' ; ')); }
    t.eq('DXF : style du calque EU conservé', await ev(() => { const l = layers.find(x => x.name === 'EU'); return l && [l.dash, l.ltText, l.width, l.hatch, String(l.textH)]; }), layBefore);

    // --- la mise en page voyage dans le DXF : fenêtres (centre sur le même point du dessin, échelle, nom, réglage plateformes), texte de la feuille, cartouche ---
    const lp0 = await ev(() => { const m = mmToWorld(1000), c = { x: 7 * m, y: -4 * m }; layoutData = lpNew(); layoutData.vps.push({ id: 'vpT', x: 30, y: 30, w: 200, h: 120, scale: 200, cx: c.x, cy: c.y, title: 'Plan masse', plat: true });
        layoutData.paperShapes = [{ type: 'text', layerId: 'layer-0', x: 50, y: 20, content: 'Note de la feuille', size: 20 }]; cartoucheData.planName = 'Essai mise en page';
        const dirty = isDirty(); return { dirty, abs: [worldToMm(c.x) + geoOrigin.x, -worldToMm(c.y) + geoOrigin.y] }; });
    const dxf2 = await ev(() => exportDXF());
    await ev(() => { shapes = []; layoutData = lpNew(); cartoucheData.planName = ''; }); await H.blank(14);
    await ev(async (txt) => loadFileObject(new File([txt], 'essai2.dxf'), 'essai2.dxf'), dxf2); await H.wait(300);
    const lp1 = await ev(() => { const v = layoutData.vps[0]; return v ? { title: v.title, plat: v.plat, scale: v.scale, abs: [Math.round(worldToMm(v.cx) + geoOrigin.x), Math.round(-worldToMm(v.cy) + geoOrigin.y)], paper: (layoutData.paperShapes || []).map(q => q.content).join(), cart: cartoucheData.planName, dirty: isDirty() } : null; });
    t.eq('DXF : mise en page et cartouche conservés (fenêtre au même endroit du dessin)', lp1, { title: 'Plan masse', plat: true, scale: 200, abs: lp0.abs.map(Math.round), paper: 'Note de la feuille', cart: 'Essai mise en page', dirty: false });
    t.ok('une fenêtre de mise en page ajoutée rend le plan « modifié » (à enregistrer)', lp0.dirty);

    // un 2e DXF superposé au 1er (pas d'écrasement) : mêmes coordonnées, calques rangés sous le nom du fichier ; Ctrl+A / Ctrl+Alt+A
    const ov = await ev(async () => { const m = mmToWorld(1000); geoOrigin = { x: 1881000000, y: 3140000000 }; layers = JSON.parse(JSON.stringify(INITIAL_LAYERS)); const L = ensureLayer('Murs', '#ff0000');
        shapes = [{ type: 'line', layerId: L, x1: 0, y1: 0, x2: 10 * m, y2: 0 }, { type: 'circle', layerId: 'layer-0', x: 5 * m, y: 5 * m, r: 2 * m }]; saveState();
        const txt = exportDXF(); shapes = [{ type: 'line', layerId: 'layer-0', x1: 0, y1: 20 * m, x2: 5 * m, y2: 20 * m }]; saveState();
        dxfOverlayAsk(new File([txt], 'voisin.dxf'), 'voisin.dxf', false); const btns = [...document.querySelectorAll('#tm-actions button')].map(b => b.textContent);
        [...document.querySelectorAll('#tm-actions button')].find(b => b.textContent === 'Superposer').click(); await new Promise(r => setTimeout(r, 300));
        const ln = shapes.find(x => x.type === 'line' && Math.abs(x.y1) < 1e-6), r = { btns, n: shapes.length, lays: layers.filter(l => /^voisin · /.test(l.name)).map(l => l.name).sort(), pos: ln ? [Math.round(worldToMm(ln.x1)), Math.round(worldToMm(ln.x2))] : null, sel: selectedShapes.length };
        setMode('select-box'); selectedShapes = []; activeLayerId = layers.find(l => l.name === 'voisin · Murs').id;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true })); r.all = selectedShapes.length;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, altKey: true, bubbles: true })); r.lay = selectedShapes.length;
        shapes = []; selectedShapes = []; geoOrigin = { x: 0, y: 0 }; saveState(); return r; });
    t.eq('DXF superposé au plan en cours (sans l\'écraser) ; Ctrl+A tout, Ctrl+Alt+A le calque actif', ov, { btns: ['Annuler', 'Ouvrir à la place', 'Superposer'], n: 3, lays: ['voisin · Murs', 'voisin · Tracé'], pos: [0, 10000], sel: 2, all: 3, lay: 1 });

    // STL retiré : plus d'entrée de menu, plus d'import ; un ancien plan avec un maillage s'ouvre toujours
    const nostl = await ev(() => ({ menu: /STL/i.test(document.getElementById('menu-dxf').textContent), accept: document.getElementById('project-input').accept.includes('stl'), fns: ['importSTL', 'openExportSTL', 'exportSTL'].some(f => typeof window[f] === 'function') }));
    t.eq('STL retiré (menu, ouverture, export)', nostl, { menu: false, accept: false, fns: false });

    // DXF entrant : blocs (imbriqués, tournés, en miroir, en réseau) éclatés à leur place, attributs en textes, ellipse et spline en polylignes,
    // texte multiligne nettoyé, référence externe signalée ; un point topo (bloc avec altitude) reste un point
    const dx = await ev(() => { const L = []; const e = (...a) => { for (let i = 0; i < a.length; i += 2) L.push(String(a[i]), String(a[i + 1])); };
        e(0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC', 0, 'SECTION', 2, 'BLOCKS');
        e(0, 'BLOCK', 8, '0', 2, 'POIGNEE', 70, 0, 10, 0, 20, 0, 0, 'CIRCLE', 8, '0', 10, 1, 20, 0, 40, 0.5, 0, 'ENDBLK');
        e(0, 'BLOCK', 8, '0', 2, 'PORTE', 70, 0, 10, 0, 20, 0, 0, 'LINE', 8, '0', 10, 0, 20, 0, 11, 10, 21, 0, 0, 'ARC', 8, 'MENUIS', 10, 0, 20, 0, 40, 10, 50, 0, 51, 90, 0, 'INSERT', 8, '0', 2, 'POIGNEE', 10, 8, 20, 0, 0, 'ENDBLK');
        e(0, 'BLOCK', 8, '0', 2, 'VOISIN', 70, 4, 1, 'C:\\plans\\voisin.dwg', 10, 0, 20, 0, 0, 'ENDBLK');
        e(0, 'BLOCK', 8, '0', 2, 'TOPO', 70, 0, 10, 0, 20, 0, 0, 'ENDBLK', 0, 'BLOCK', 8, '0', 2, 'ETIQ', 70, 2, 10, 0, 20, 0, 0, 'LINE', 8, '0', 10, 0, 20, 0, 11, 1, 21, 0, 0, 'ENDBLK');
        e(0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
        e(0, 'INSERT', 8, 'BATI', 2, 'PORTE', 10, 100, 20, 200, 41, 2, 42, 2, 50, 90);
        e(0, 'INSERT', 8, 'BATI', 2, 'PORTE', 10, 300, 20, 200, 41, -1, 42, 1, 50, 0);
        e(0, 'INSERT', 8, 'BATI', 2, 'ETIQ', 10, 0, 20, 0, 70, 3, 71, 2, 44, 10, 45, 5);
        e(0, 'INSERT', 8, 'REF', 2, 'VOISIN', 10, 0, 20, 0);
        e(0, 'INSERT', 8, 'POINTS', 2, 'TOPO', 66, 1, 10, 50, 20, 60, 0, 'ATTRIB', 8, 'POINTS', 10, 51, 20, 60, 40, 1, 1, '412,35', 2, 'ALT', 0, 'SEQEND');
        e(0, 'INSERT', 8, 'BATI', 2, 'ETIQ', 66, 1, 10, 500, 20, 500, 0, 'ATTRIB', 8, '0', 10, 501, 20, 501, 40, 2, 1, 'Local technique', 2, 'NOM', 0, 'SEQEND');
        e(0, 'ELLIPSE', 8, 'DIV', 10, 0, 20, 0, 11, 10, 21, 0, 40, 0.5, 41, 0, 42, 6.283185307);
        e(0, 'SPLINE', 8, 'DIV', 70, 8, 71, 3, 72, 8, 73, 4, 40, 0, 40, 0, 40, 0, 40, 0, 40, 1, 40, 1, 40, 1, 40, 1, 10, 0, 20, 0, 10, 10, 20, 20, 10, 20, 20, 20, 10, 30, 20, 0);
        e(0, 'MTEXT', 8, 'TXT', 10, 0, 20, -50, 40, 2.5, 3, '{\\fArial|b1;\\H1.2x;Ligne 1}\\PLigne ', 1, '2 \\S1/2; %%c200');
        e(0, 'ENDSEC', 0, 'EOF');
        const keepS = shapes, keepL = layers, keepO = geoOrigin; shapes = []; geoOrigin = { x: 0, y: 0 }; layers = JSON.parse(JSON.stringify(INITIAL_LAYERS));
        const res = importDXF(L.join('\n')), S = res.shapes, m = (v) => Math.round(worldToMm(v) / 10) / 100, ly = (s) => (layers.find(l => l.id === s.layerId) || {}).name;
        const lines = S.filter(x => x.type === 'line'), arcs = S.filter(x => x.type === 'arc'), circ = S.filter(x => x.type === 'circle'), pts = S.filter(x => x.type === 'point'), txt = S.filter(x => x.type === 'text'), polys = S.filter(x => x.type === 'poly');
        const l0 = lines.find(x => ly(x) === 'BATI' && Math.abs(m(x.x1) - 100) < 1e-6);
        const r = { lines: lines.length, arcs: arcs.length, circ: circ.map(c => [m(c.x), -m(c.y), m(c.r)]).sort((a, b) => a[0] - b[0]), arcLay: arcs.map(ly).sort(),
            rot: l0 ? [m(l0.x1), -m(l0.y1), m(l0.x2), -m(l0.y2)] : null, pts: pts.map(p => [m(p.x), -m(p.y), p.z]), txt: txt.map(t => t.content).sort(),
            polys: polys.map(p => ly(p) + ':' + (p.open ? 'o' : 'f') + ':' + (p.points.length > 20)).sort(), xrefs: res.xrefs, ins: res.stats.inserts };
        shapes = keepS; layers = keepL; geoOrigin = keepO; return r; });
    t.eq('DXF entrant : blocs imbriqués / tournés / en miroir / en réseau éclatés, attributs, ellipse, spline, texte multiligne, référence externe', dx, {
        lines: 9, arcs: 2, circ: [[100, 218, 1], [291, 200, 0.5]], arcLay: ['MENUIS', 'MENUIS'], rot: [100, 200, 100, 220], pts: [[50, 60, 412350]],
        txt: ['Ligne 1\nLigne 2 1/2 Ø200', 'Local technique'], polys: ['DIV:f:true', 'DIV:o:true'], xrefs: ['C:\\plans\\voisin.dwg'], ins: 6 });

    // calques créés dans la même milliseconde à l'ouverture d'un DXF : identifiants toujours distincts (sinon deux calques se confondaient)
    const uid = await ev(() => { const L = ['0', 'SECTION', '2', 'ENTITIES']; for (let k = 0; k < 60; k++) L.push('0', 'LINE', '8', 'C' + k, '10', '0', '20', String(k), '11', '1', '21', String(k)); L.push('0', 'ENDSEC', '0', 'EOF');
        const keepL = layers, keepO = geoOrigin; layers = JSON.parse(JSON.stringify(INITIAL_LAYERS)); geoOrigin = { x: 0, y: 0 }; const res = importDXF(L.join('\n'));
        const r = { ids: new Set(layers.map(l => l.id)).size === layers.length, each: res.shapes.every((sh, k) => (layers.find(l => l.id === sh.layerId) || {}).name === 'C' + Math.round(-worldToMm(sh.y1) / (UNIT_MM[currentUnit] || 1))) };
        layers = keepL; geoOrigin = keepO; return r; });
    t.eq('DXF : 60 calques créés d\'un coup, chacun son identifiant, chaque trait sur le bon', uid, { ids: true, each: true });
    // cadastre vectorisé : parcelles du service (GeoJSON simulé, lon / lat ou lat / lon) en polylignes sur leur calque, numéros, bâti ; relancer remplace
    const cad = await ev(async () => { const keepS = shapes, keepF = window.fetch; shapes = []; const lat0 = 44.56, lon0 = 6.08, cosL = Math.cos(lat0 * Math.PI / 180), m = mmToWorld(1000);
        const sq = (e0, n0, d, swap) => { const c = [[e0, n0], [e0 + d, n0], [e0 + d, n0 + d], [e0, n0 + d], [e0, n0]].map(([e, n]) => { const la = lat0 + n / 111320, lo = lon0 + e / (111320 * cosL); return swap ? [la, lo] : [lo, la]; }); return { type: 'Polygon', coordinates: [c] }; };
        let calls = 0; window.fetch = async (u) => { calls++; const isB = /batiment/.test(u); const fc = { type: 'FeatureCollection', features: isB ? [{ type: 'Feature', properties: {}, geometry: sq(22, 2, 6) }] : [{ type: 'Feature', properties: { section: 'AB', numero: '0123', idu: '05061000AB0123', contenance: 400 }, geometry: sq(20, 0, 20) }, { type: 'Feature', properties: { section: 'AB', numero: '0124' }, geometry: sq(-40, 0, 20, true) }, { type: 'Feature', properties: { section: 'ZZ', numero: '9' }, geometry: sq(5000, 5000, 20) }] }; return { ok: true, json: async () => fc }; };
        const b = { type: 'basemap', layerId: 'layer-0', x: 0, y: 0, r: 100 * m, rot: 0, lat: lat0, lon: lon0, radiusM: 100, mapId: 'tcad' }; shapes.push(b);
        await cadFetch(b); await cadFetch(b); window.fetch = keepF;
        const P = shapes.filter(x => x.cadOf === 'tcad' && x.type === 'poly' && x.cad), T = shapes.filter(x => x.cadOf === 'tcad' && x.type === 'text'), Bt = shapes.filter(x => x.cadOf === 'tcad' && x.name === 'Bâti (BD TOPO)');
        const p1 = P.find(x => x.cad.numero === '0123'), x0 = p1 ? Math.round(Math.min(...p1.points.map(q => q.x)) / m) : null, y0 = p1 ? Math.round(Math.max(...p1.points.map(q => -q.y)) / m) : null, p2 = P.find(x => x.cad.numero === '0124'), x2 = p2 ? Math.round(Math.min(...p2.points.map(q => q.x)) / m) : null;
        const lay = (x) => (layers.find(l => l.id === x.layerId) || {}).name, r = { n: P.length, txt: T.map(x => x.content).sort(), bat: Bt.length, x0, y0, x2, lays: [lay(p1), lay(T[0]), lay(Bt[0])], flat: !isPlateforme(p1), calls, vec: b.cadVec };
        shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('cadastre vectorisé : parcelles à leur place, numéros, bâti, calques Cadastre, hors cercle écarté, relance = remplace', cad, { n: 2, txt: ['AB 123', 'AB 124'], bat: 1, x0: 20, y0: 20, x2: -40, lays: ['Cadastre — parcelles', 'Cadastre — numéros', 'Cadastre — bâti'], flat: true, calls: 4, vec: { n: 2, b: 1 } });
} };
