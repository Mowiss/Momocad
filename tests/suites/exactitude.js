// Exactitude des calculs : des cas dont le résultat est connu d'avance (géométrie simple), et un contrôle croisé
// entre le moteur de cubature et une intégration indépendante, maille par maille, du terrain fini.
module.exports = { name: 'exactitude', run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    const pct = (got, want) => Math.abs(got - want) / Math.max(1e-9, Math.abs(want));
    // terrain plan z = 100 + a·x + b·y (m), points tous les 5 m sur 60 × 50 m
    const scene = (o) => ev((o) => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) { const x = i * 5, y = j * 5; shapes.push({ type: 'point', layerId: TN, x: x * m, y: -y * m, z: Math.round((100 + o.a * x + o.b * y) * 1000), zk: 1 }); }
        (o.pl || []).forEach(p => { const s = p.r ? { type: 'circle', layerId: 'layer-0', x: p.c[0] * m, y: -p.c[1] * m, r: p.r * m, z: p.z, zk: 1 } : { type: 'poly', layerId: 'layer-0', zk: 1, points: p.pts.map(([x, y]) => ({ x: x * m, y: -y * m, z: p.z })) };
            s.talus = p.talus || { on: false }; shapes.push(s); });
        tinCache = null; invalidateCache(); saveState(); const C = withModel(() => cubCompute()); return C.err ? { err: C.err } : { D: C.D, R: C.Rm }; }, o);

    // 1. terrain en pente, plateforme calée au milieu, sans talus : autant de déblai que de remblai, 25 m³ chacun
    let r = await scene({ a: 0.05, b: 0, pl: [{ pts: [[20, 15], [40, 15], [40, 25], [20, 25]], z: 101500 }] });
    t.ok('pente 5 % : déblai = remblai = 25 m³ (à 1 % près)', !r.err && pct(r.D, 25) < 0.01 && pct(r.R, 25) < 0.01, JSON.stringify(r));
    // 2. plateforme ronde (r = 5 m) à 1 m sous un terrain plat : π × 25 = 78,54 m³
    r = await scene({ a: 0, b: 0, pl: [{ r: 5, c: [30, 25], z: 99000 }] });
    t.ok('plateforme ronde : déblai = π r² h = 78,54 m³ (à 1 % près)', !r.err && pct(r.D, Math.PI * 25) < 0.01 && r.R < 0.05, JSON.stringify(r));
    // 3. le terrain naturel reproduit exactement un plan (interpolation dans les triangles)
    const tz = await ev(() => { const m = mmToWorld(1000), tin = getTIN(); let e = 0; [[3.3, 7.1], [17.9, 33.2], [41.5, 12.8], [55.2, 44.4], [29.99, 0.01]].forEach(([x, y]) => { e = Math.max(e, Math.abs(tinZ(x * m, -y * m, tin) - 100000)); }); return e; });
    t.ok('terrain plat : altitude exacte partout (écart < 0,5 mm)', tz < 0.5, String(tz));
    { await scene({ a: 0.03, b: -0.02, pl: [] }); const e = await ev(() => { const m = mmToWorld(1000), tin = getTIN(); let e = 0; [[3.3, 7.1], [17.9, 33.2], [41.5, 12.8], [55.2, 44.4]].forEach(([x, y]) => { e = Math.max(e, Math.abs(tinZ(x * m, -y * m, tin) - (100 + 0.03 * x - 0.02 * y) * 1000)); }); return e; });
      t.ok('terrain en plan incliné : altitude exacte partout (écart < 0,5 mm)', e < 0.5, String(e)); }
    // 4. contrôle croisé : deux plateformes à talus (déblai et remblai) sur un terrain incliné ; cubature = intégration maille par maille du terrain fini (à 0,5 % près)
    r = await scene({ a: 0.04, b: 0.01, pl: [{ pts: [[8, 10], [24, 10], [24, 22], [8, 22]], z: 99800, talus: { on: true, kD: '3/2', kR: '3/2' } }, { pts: [[34, 24], [50, 24], [50, 38], [34, 38]], z: 103500, talus: { on: true, kD: '1/1', kR: '2/1' } }] });
    const bf = await ev(() => { const m = mmToWorld(1000), FM = finishedModel(), tin = getTIN(), c = 0.1; let D = 0, R = 0;
        for (let x = c / 2; x < 60; x += c) for (let y = c / 2; y < 50; y += c) { const X = x * m, Y = -y * m, tn = tinZ(X, Y, tin); if (tn === null || tn === undefined) continue; const f = FM.at(X, Y, tn); if (!f) continue; const d = (tn - f.z) / 1000 * c * c; if (d > 0) D += d; else R -= d; }
        return { D, R }; });
    t.ok('contrôle croisé : cubature = intégration du terrain fini (déblai et remblai à 0,5 % près)', !r.err && pct(r.D, bf.D) < 0.005 && pct(r.R, bf.R) < 0.005, JSON.stringify({ cub: r, grille: bf }));
    // 5. bassins enterrés : volumes utiles d'après leur définition
    const bs = await ev(() => { const m = mmToWorld(1000), s = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => ({ x: x * m, y: -y * m })) }, o = {};
        s.bassin = bassinDef('alv'); s.bassin.H = 1000; o.alv = bassinCalc(s).Vut; s.bassin = bassinDef('beton'); s.bassin.H = 1000; s.bassin.e = 200; o.beton = bassinCalc(s).Vut; s.bassin = bassinDef('buse'); s.bassin.D = 1000; const C = bassinCalc(s); o.buse = C.Vut; o.n = C.n; return o; });
    t.ok('bassins : alvéolaire 200 × 1 × 95 % = 190 m³, cuve béton 19,6 × 9,6 × 1 = 188,16 m³, 7 files de buses Ø1 m × 20 m = 109,96 m³', pct(bs.alv, 190) < 1e-6 && pct(bs.beton, 188.16) < 1e-6 && bs.n === 7 && pct(bs.buse, 7 * Math.PI / 4 * 20) < 1e-6, JSON.stringify(bs));
    // 6. métré : contour en L (10 × 10 m moins 5 × 5 m) = 75 m², 40 m de périmètre ; cercle r = 5 m ; pavé 2 × 3 × 4 m = 24 m³
    const mt = await ev(() => { shapes = []; const m = mmToWorld(1000), L = ensureLayer('Métré test', '#fff');
        shapes.push({ type: 'poly', layerId: L, points: [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]].map(([x, y]) => ({ x: x * m, y: -y * m })) }, { type: 'circle', layerId: L, x: 30 * m, y: 0, r: 5 * m },
            { type: 'poly', layerId: L, points: [[50, 0], [52, 0], [52, 3], [50, 3]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 0 })), solid: { kind: 'box', H: 4000 } });
        const row = metreData(false).find(x => x.name === 'Métré test'); return { lin: row.lin, ferm: row.ferm, vol: row.vol }; });
    t.ok('métré : linéaires, surfaces et volumes exacts', pct(mt.lin, 40 + 10 * Math.PI + 10) < 1e-6 && pct(mt.ferm, 75 + 25 * Math.PI + 6) < 1e-6 && pct(mt.vol, 24) < 1e-6, JSON.stringify(mt));
} };
