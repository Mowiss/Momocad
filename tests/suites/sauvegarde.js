// Enregistrement automatique : un plan modifié puis abandonné (page rechargée) est proposé au redémarrage et revient intact.
module.exports = { name: 'sauvegarde', page: { fresh: false }, run: async (H, t) => {
    const { p, ev } = H;
    await ev(() => { try { localStorage.clear(); } catch (e) {} }); await H.reload();
    t.ok('pas de proposition de récupération sur un navigateur neuf', !(await ev(() => !!document.getElementById('as-banner'))));
    await H.blank(14);
    await H.tool('btn-rect'); await H.click(await H.W(0, 0)); await H.click(await H.W(8, 5)); await H.press('Escape');
    await H.tool('btn-circle'); await H.click(await H.W(20, 10)); await H.key('3 '); await H.press('Escape');
    const n = await ev(() => shapes.length);
    t.ok('enregistrement automatique fait (plan modifié)', await ev(() => autosaveNow(false)));
    t.ok('rien à refaire tant que le plan ne change pas', !(await ev(() => autosaveNow(false))));
    // l'onglet est « fermé » sans enregistrer : on recharge
    await H.reload();
    t.ok('au redémarrage, la récupération est proposée', await ev(() => !!document.getElementById('as-banner')), await ev(() => (document.getElementById('as-banner') || {}).textContent));
    await ev(() => document.getElementById('as-yes').click()); await H.wait(500);
    t.eq('le plan récupéré a tous ses objets', await ev(() => shapes.length), n);
    t.ok('le plan récupéré reste à enregistrer', await ev(() => isDirty()));
    // une fois traité (récupéré ou ignoré), on ne repropose plus la même sauvegarde
    await H.reload();
    t.ok('pas de nouvelle proposition après récupération', !(await ev(() => !!document.getElementById('as-banner'))));
    // historique
    await ev(() => openAutosaves()); await H.wait(400);
    t.ok('Fichier › Sauvegardes automatiques liste la sauvegarde', await ev(() => /Rouvrir/.test(document.getElementById('tm-body').innerHTML)));
    await ev(() => asOpenAt(0)); await H.wait(500);
    t.eq('Rouvrir recharge la sauvegarde', await ev(() => shapes.length), n);
    // un plan enregistré proprement ne déclenche pas de proposition
    await ev(() => { markSaved(); }); await ev(() => autosaveNow(true)); await H.reload();
    t.ok('plan enregistré : rien à récupérer', !(await ev(() => !!document.getElementById('as-banner'))));
    // filet de sécurité : un objet qui casse le dessin est sauté (le reste du plan s'affiche), l'incident est noté, le plan sauvegardé et un message discret le dit
    const fs1 = await H.ev(async () => { const keep = shapes; shapes = [{ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 1000, y2: 0 }, { type: 'line', layerId: 'layer-0', x1: 0, y1: 50, x2: 1000, y2: 50, name: 'piège' }];
        try { localStorage.removeItem('momocad-incidents'); } catch (e) {} MC_INC.t = 0; MC_INC.toast = 0; MC_INC.seen.clear(); const k0 = drawSingleShape0; let n = 0;
        window.drawSingleShape0 = function (c, s) { if (s.name === 'piège') throw new Error('test piège'); n++; return k0.apply(this, arguments); }; let ok = true;
        try { draw(); draw(); } catch (e) { ok = false; } finally { window.drawSingleShape0 = k0; }
        const L = JSON.parse(localStorage.getItem('momocad-incidents') || '[]'), t = document.getElementById('mc-toast'), r = { ok, others: n >= 2, log: L.length === 1 && /test piège/.test(L[0].msg) && /piège/.test(L[0].where), toast: !!t && /en sécurité/.test(t.textContent), saved: MC_INC.t > 0 };
        if (t) t.remove(); shapes = keep; draw(); return r; });
    t.eq('filet de sécurité : objet qui casse sauté, incident noté une fois, plan sauvegardé, message discret', fs1, { ok: true, others: true, log: true, toast: true, saved: true });
    // fichiers .mmc : numéro de format ; à l'ouverture, objets illisibles écartés, points abîmés retirés, calque manquant recréé ; fichier plus récent signalé
    const fs2 = await H.ev(async () => { const keep = shapes, r = { fmt: projectData().format };
        const bad = JSON.stringify({ app: 'MomoCAD', version: '1.3', layers: [{ id: 'layer-0', name: '0', visible: true }], shapes: [null, { type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 'x', y2: 0 }, { type: 'poly', layerId: 'layer-0', points: [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }, { type: 'line', layerId: 'perdu', x1: 0, y1: 0, x2: 5, y2: 5 }] }).replace('null,{"type":"line","layerId":"layer-0","x1":0,"y1":0,"x2":"x"', 'null,{"type":"line","layerId":"layer-0","x1":0,"y1":0,"x2":"x"');
        r.open = loadProjectText(bad, 'abime.mmc'); const t = document.getElementById('mc-toast'); r.msg = !!t && /2 objet\(s\) illisible\(s\) écarté\(s\)/.test(t.textContent) && /2 objet\(s\) réparé\(s\)/.test(t.textContent); if (t) t.remove();
        r.n = shapes.length; r.pts = shapes.find(x => x.type === 'poly').points.length; r.recup = !!layers.find(l => l.id === 'layer-recup') && shapes.find(x => x.x2 === 5).layerId === 'layer-recup';
        r.newer = loadProjectText(JSON.stringify({ app: 'MomoCAD', format: 99, layers: [], shapes: [] }), 'futur.mmc') && /plus récente/.test((document.getElementById('mc-toast') || {}).textContent || ''); { const t2 = document.getElementById('mc-toast'); if (t2) t2.remove(); }
        return r; });
    t.eq('fichiers .mmc : format numéroté, objets illisibles écartés, points abîmés retirés, calque manquant recréé, fichier plus récent signalé', fs2, { fmt: 2, open: true, msg: true, n: 2, pts: 3, recup: true, newer: true });
    // ouverture « tout ou rien » : si l'ouverture casse en route, le plan précédent revient tel quel
    const fs3 = await H.ev(async () => { loadProjectText(JSON.stringify({ app: 'MomoCAD', layers: [{ id: 'layer-0', name: '0', visible: true }], shapes: [{ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 7777, y2: 0 }] }), 'avant.mmc');
        const k = lvlMarkAll; window.lvlMarkAll = () => { throw new Error('casse à l\'ouverture'); }; let res;
        try { res = loadProjectText(JSON.stringify({ app: 'MomoCAD', layers: [], shapes: [{ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 1, y2: 1 }, { type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 2, y2: 2 }] }), 'casse.mmc'); } finally { window.lvlMarkAll = k; }
        const t = document.getElementById('mc-toast'), r = { res, back: shapes.length === 1 && shapes[0].x2 === 7777 && fileName === 'avant.mmc', msg: !!t && /précédent est conservé/.test(t.textContent) }; if (t) t.remove(); return r; });
    t.eq('ouverture tout ou rien : le plan précédent revient si l\'ouverture casse', fs3, { res: false, back: true, msg: true });
    // fichier abîmé : géométrie manquante ou champs de mauvais type réparés ou écartés ; le plan, la 3D, l'enregistrement tiennent
    const fz = await ev(async () => { const keep = { shapes, layers }, r = {}, m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 100000 }));
        const S = [{ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: m, y2: m }, { type: 'line', layerId: 'layer-0', x1: 0, y1: 0 }, { type: 'poly', layerId: 'layer-0' }, { type: 'circle', layerId: 'layer-0', x: 1, y: 1 },
            { type: 'hatch', layerId: 'layer-0', loops: 'x', wallMat: 'parpaing' }, { type: 'hatch', layerId: 'layer-0', loops: [R(0, 0, 4, 0.2)], wallMat: 'parpaing', wz: 'x', openings: [{ kind: 'fen' }, null] },
            { type: 'poly', layerId: 'layer-0', points: R(0, 0, 3, 3), solid: 'x', roofDef: 7 }, { type: 'poly', layerId: 'layer-0', points: R(5, 0, 8, 3).map((q, i) => i ? q : Object.assign(q, { z: 'x' })), solid: { kind: 'box', H: 200 }, zk: 1 }];
        let ok = true; try { ok = loadProjectText(JSON.stringify({ app: 'MomoCAD', layers: [], shapes: S }), 'abime.mmc') !== false; } catch (e) { ok = false; } await new Promise(res => setTimeout(res, 600));
        r.loaded = ok && shapes.filter(x => !(x.wallMat && x.type === 'line')).length === 4;   /* les bords du mur sont refaits à l'ouverture */ const h = shapes.find(x => x.type === 'hatch'); r.hatch = !!h && (!h.wz || (typeof h.wz.b === 'number' && typeof h.wz.t === 'number')) && Array.isArray(h.openings) && h.openings.length === 0;
        const p0 = shapes.find(x => x.type === 'poly' && !x.solid); r.poly = !!p0 && p0.roofDef === undefined; const b = shapes.find(x => x.solid); r.box = !!b && b.points[0].z === undefined;
        let e3 = null; try { await open3D(); close3D(); draw(); JSON.stringify(projectData()); } catch (e) { e3 = e.message; } r.work = e3;
        shapes = keep.shapes; layers = keep.layers; updateLayerUI(); invalidateCache(); draw(); return r; });
    t.eq('fichier abîmé : géométrie manquante écartée, champs de mauvais type retirés ; plan, 3D et enregistrement tiennent', fz, { loaded: true, hatch: true, poly: true, box: true, work: null });
    // historique : plafonné en mémoire (≈ 120 Mo de copies), au moins 15 pas d'annulation gardés
    const hb = await ev(() => { const keepH = shapesHistory, keepS = historyStep, big = 'x'.repeat(15e6); shapesHistory = []; for (let i = 0; i < 20; i++) shapesHistory.push(histEntry(big, '[]', 'layer-0')); historyStep = 19; histTrim();
        const r = { n: shapesHistory.length, step: historyStep }; shapesHistory = keepH; historyStep = keepS; return r; });
    t.eq('historique plafonné en mémoire (au moins 15 pas gardés)', hb, { n: 15, step: 14 });
} };
