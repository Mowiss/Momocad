// Bâtiment en 3D (cabane du tuto Seigneur) : menuiseries, pas de traits de plan parasites, façades rendues, rendu naturel et ciel.
const fs = require('fs'), path = require('path');
module.exports = { name: 'batiment-3d', run: async (H, t) => {
    const { p, ev } = H;
    await ev(txt => { loadProjectText(txt, 'cabane.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'cabane.mmc'), 'utf8')); await H.wait(400);
    await ev(async () => { await open3D(); }); await H.wait(2000);
    const r = await ev(() => { let wood = 0, glass = 0, segs = 0; V3.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') { const m = o.material; if (m.map) wood++; else if (m.transparent && m.opacity < 0.5) glass++; } if (o.isLineSegments && o.material && o.material.vertexColors) segs += o.geometry.attributes.position.count / 2; });
        return { wood, glass, segs }; });
    t.ok('porte : un vantail bois', r.wood >= 1, JSON.stringify(r));
    t.ok('fenêtre : un vitrage', r.glass >= 1, JSON.stringify(r));
    t.ok('aucun tracé de plan dessiné par-dessus les volumes (toit, murs)', r.segs === 0, JSON.stringify(r));
    // rendu naturel et ciel
    await ev(() => { ['v3-nat', 'v3-hz'].forEach(id => { if (!document.getElementById(id).checked) document.querySelector('[data-for="' + id + '"]').click(); }); v3Sky(); render3D(); }); await H.wait(800);   // rendu naturel et ciel (allumés par défaut)
    t.ok('ciel affiché', await ev(() => !!(V3.sky && V3.sky.visible)));
    const sun = await ev(() => { v3SetHour(9); const a = V3.sun.position.clone(); v3SetHour(18); const b = V3.sun.position.clone(); return [a.x, b.x]; });
    t.ok('le soleil suit l\'heure (matin à l\'est, soir à l\'ouest)', sun[0] > 0 && sun[1] < 0, JSON.stringify(sun));
    t.ok('plus de paysage dessiné : le ciel seul (le décor vient du relief réel ou d\'un panorama importé)', await ev(() => !(V3.hz && V3.hz.visible) && V3.sky.visible));
    const pano = await ev(async () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; c.getContext('2d').fillRect(0, 0, 512, 256); const b = await new Promise(r => c.toBlob(r));
        const ok = await v3PanoFromBlob(b, false); stPano.on = true; await studioOpen(); render3D(); const r = [ok, V3.pano.visible, !!(V3.hz && V3.hz.visible), V3.gnd.visible]; studioClose(); stPano.on = false; return r; });
    t.eq('photo 360° (studio photo) : remplace ciel et horizon', pano, [true, true, false, false]);
    const cyl = await ev(async () => { const c = document.createElement('canvas'); c.width = 1300; c.height = 200; c.getContext('2d').fillRect(0, 0, 1300, 200); const b = await new Promise(r => c.toBlob(r));
        await v3PanoFromBlob(b, false); stPano.on = true; await studioOpen(); render3D(); const r = [V3.pano.visible, V3.panoC.visible]; studioClose(); stPano.on = false; return r; });
    t.eq('panorama de téléphone (très allongé) : posé sur un cylindre, pas étiré sur une bulle', cyl, [false, true]);
    await ev(() => { document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(300);
    t.ok('ciel masqué', await ev(() => !V3.sky.visible && !(V3.hz && V3.hz.visible)));
    await ev(() => { document.querySelector('[data-for="v3-nat"]').click(); close3D(); });
    // façade : la vue de côté est rendue par le moteur 3D
    await ev(() => setView2D(0, 0)); await H.wait(1500); await p.waitForFunction(() => !view2dAnim, null, { timeout: 15000 }); await H.wait(300);
    const f = await ev(() => { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const x = c.getContext('2d'); const ok = ortho3D(x, 0, 0, mmToWorld(1) * camera.zoom);
        const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return { ok, n }; });
    t.ok('vue de façade dessinée (murs, toit, menuiseries)', f.ok && f.n > 600, JSON.stringify(f));
    await H.shot('batiment-facade');
    // en plan, les façades sont en couleurs unies : les textures sont réservées au rendu 3D
    const nt = await ev(() => { let n = 0; V3.root.traverse(o => [].concat(o.material || []).forEach(m => { if (m.map || (o.isMesh && m.colorWrite !== false)) n++; })); return n; });
    t.eq('façade en plan : filaire seul, ni couleur ni texture', nt, 0);
    const nt2 = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 200)); let n = 0; V3.root.traverse(o => [].concat(o.material || []).forEach(m => { if (m.map) n++; })); close3D(); return n; });
    t.ok('rendu 3D : les textures reviennent', nt2 > 0, nt2);
    await ev(() => setView2D(0, 90));

    // aller-retour DXF : murs (matériau, hauteurs, ouvertures, groupe), toiture et pignons reviennent comme des objets MomoCAD
    const sig = () => ev(() => shapes.map(s => s.type + (s.wallMat ? ':w' : '') + (s.solid ? ':' + s.solid.kind : '') + (s.wz ? ':wz' : '') + (s.openings ? ':o' + s.openings.length : '') + (s.groupId ? ':g' : '') + (s.roofDef ? ':rd' : '') + (s.type === 'mesh' && meshStore[s.meshId] ? ':m' + meshStore[s.meshId].length : '')).join(' '));
    const s0 = await sig(), dxf = await ev(() => exportDXF());
    await ev(async t => loadFileObject(new File([t], 'cabane.dxf'), 'cabane.dxf'), dxf); await H.wait(500);
    t.eq('DXF : bâtiment rouvert à l\'identique (murs, ouvertures, toiture, pignons)', await sig(), s0);
    const op = await ev(() => { const o = shapes.flatMap(s => s.openings || [])[0]; return o ? [Math.round(o.a.x), Math.round(o.a.y)] : null; });
    t.ok('DXF : ouverture à sa place', op && isFinite(op[0]), JSON.stringify(op));

    // volets : battants (2 vantaux contre la façade) ou bloc volet roulant (coulisses + tablier), choisis dans la fenêtre de l'ouverture
    const vol = await ev(async () => { const ops = shapes.flatMap(s => (s.openings || []).map(o => [s, o])), [h, o] = ops.find(x => x[1].kind !== 'porte'); openingDialog(h, o, false);
        document.querySelector('input[name=op-vt][value=battant]').click(); [...document.querySelectorAll('#tm-actions button')].find(b => b.textContent === 'Valider').click();
        const d = ops.find(x => x[1].kind === 'porte'); if (d) d[1].shut = { type: 'roulant', side: 1 };
        await open3D(); await new Promise(r => setTimeout(r, 900)); const n = {}; V3.root.traverse(m => { if (m.userData.shutter) n[m.userData.shutter] = (n[m.userData.shutter] || 0) + 1; }); close3D(); return { shut: o.shut, n }; });
    t.ok('volets : battants et volet roulant posés sur les ouvertures en 3D', vol.shut && vol.shut.type === 'battant' && vol.n.battant === 2 && vol.n.roulant === 4, JSON.stringify(vol));

    // complexe de paroi (béton + isolant + placo, dessinés séparément) : l'ouverture traverse tout le complexe, puis s'étire / se réduit couche par couche
    const opc = await ev(async () => { shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        [['beton', 0, 0.2], ['isolant', 0.2, 0.32], ['placo', 0.32, 0.333]].forEach(([mat, a, b], k) => shapes.push({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat, e: (b - a) * 1000 }] }), loops: [R(0, a, 4, b)], wallMat: mat, groupId: 'gc' + k, wz: { b: 0, t: 2500 } }));
        saveState(); setMode('opening'); openingClick({ x: 1 * m, y: -0.1 * m }); openingFinish({ x: 2 * m, y: -0.1 * m }); closeTopoModal();
        const h = shapes[0], o = h.openings[0], th = () => { const t = opStretchTT(o); return Math.round(Math.abs(t[1] - t[0]) / m * 1000); }, auto = th();
        await open3D(); await new Promise(r => setTimeout(r, 800)); const cut3 = [1, 2].map(k => wallOpeningsFor(shapes[k]).length);
        opStretchStart(h, o); opStretchClick({ x: 1.5 * m, y: -0.333 * m }); opStretchClick({ x: 1.5 * m, y: -0.201 * m }); setMode('select-box'); const manual = th(), cutIso = wallOpeningsFor(shapes[1]).length;
        // poignée latérale : mur sélectionné, on attrape la face de l'ouverture côté béton/isolant et on la tire jusqu'à la face extérieure du placo
        selectedShapes = [h]; const G = allGrips().filter(g => g.kind === 'op-face'), g = G.find(q => Math.abs(q.y + 0.2 * m) < 0.02 * m) || G[1];
        startGrip(g); gripApply(1.5 * m, -0.334 * m, false); endGrip(false); const grip = (() => { const t = opStretchTT(h.openings[0]); return Math.round(Math.abs(t[1] - t[0]) / m * 1000); })(), cutIso2 = wallOpeningsFor(shapes[1]).length; selectedShapes = [];
        close3D(); return { auto, cut3, manual, cutIso, nGrips: G.length, grip, cutIso2 }; });
    // ouverture redessinée à la poignée : bouts (largeur le long du mur, accrochés), milieu (glisse le long du mur) ; ses coins, bouts et milieux sont des points d'accroche
    const opg = await ev(() => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        shapes.push({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [R(0, 0, 6, 0.2)], wallMat: 'beton', groupId: 'gp', wz: { b: 0, t: 2500 } });
        saveState(); setMode('opening'); openingClick({ x: 1 * m, y: 0 }); openingFinish({ x: 2 * m, y: 0 }); closeTopoModal(); setMode('select-box');
        const h = shapes[0], O = () => h.openings[0], W = () => Math.round(Math.hypot(O().b.x - O().a.x, O().b.y - O().a.y) / m * 1000), X = () => Math.round(Math.min(O().a.x, O().b.x) / m * 1000);
        selectedShapes = [h]; const G = allGrips(), kinds = ['op-end', 'op-move'].map(k => G.filter(g => g.kind === k).length);
        const end = G.find(g => g.kind === 'op-end' && Math.abs(g.x - 2 * m) < 1e-6) || G.find(g => g.kind === 'op-end' && g.i === 1); startGrip(end); gripApply(2.6 * m, -0.7 * m, false); endGrip(false); const w1 = W(), y0 = Math.round(O().b.y / m * 1000);
        const mv = allGrips().find(g => g.kind === 'op-move'); startGrip(mv); gripApply(mv.x + 1.5 * m, mv.y + 0.3 * m, false); endGrip(false); const x1 = X(), w2 = W();
        const c = O().pts[0], sn = findSnap(c.x + 0.003 * m, c.y + 0.003 * m), snOk = !!sn && Math.abs(sn.x - c.x) < 1e-6 && Math.abs(sn.y - c.y) < 1e-6;
        const pts4 = O().pts.length; selectedShapes = []; shapes = keepS; invalidateCache(); saveState(); return { kinds, w1, y0, x1, w2, snOk, pts4 }; });
    t.eq('ouverture : poignées bout (largeur, reste sur le mur) et milieu (glisse le long), accroches sur ses coins', opg, { kinds: [2, 1], w1: 1600, y0: 0, x1: 2500, w2: 1600, snOk: true, pts4: 4 });
    // toiture : onglet Épaisseur à lui (couches → épaisseur), onglets nommés, clic sur l'épaisseur du schéma = onglet Épaisseur
    const ep = await ev(async () => { const m = mmToWorld(1000); roofDialog({ type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 0 })) }, true); document.querySelector('input[name=rf-p][value="2"]').click(); await new Promise(r => setTimeout(r, 50));
        const labels = [...document.querySelectorAll('#tm-strip button small')].map(x => x.textContent); window.tmTab = 'rf-pdim'; tmTabify(); document.getElementById('rf-e').click();
        const shown = !document.querySelector('details.sp-ch[data-k="rf-pcx"]').classList.contains('sp-off'); rfCx.p = [{ t: 'couverture', e: 5 }, { t: 'isolation', e: 25 }]; rfCxDraw('p'); const e = document.getElementById('rf-e').value; closeTopoModal(); return { labels, shown, e }; });
    t.eq('toiture : onglet Épaisseur nommé, ouvert par un clic sur l\'épaisseur, épaisseur = somme des couches', ep, { labels: ['Type', 'Dimensions', 'Épaisseur', 'Faîtage', 'Débords'], shown: true, e: '0,30' });
    // contours de bâtiment : chacun ses niveaux (deux bâtiments à des altitudes différentes) ; un mur tracé dans un contour prend ses niveaux (étage de sa pastille) ;
    // Y sur le contour : choisir l'étage, ajouter, régler ; changer la cote d'un bâtiment ne bouge pas l'autre ; plus de schéma flottant ; enregistré dans le plan
    const bz = await ev(async () => { const keepS = shapes, keepL = lvls; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), M = mmToWorld;
        const rect = (x0, y0, x1, y1) => ({ type: 'poly', layerId: activeLayerId, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        const A = rect(0, 0, 10, 8), B = rect(20, 0, 30, 8); shapes.push(A, B); saveState(); bldMake(A, 'A', 69000, 3000); bldMake(B, 'B', 72500, 2700); saveState();
        const wall = async (x1, x2, y) => { startWall('w-beton20'); wallStart = { x: M(x1 * 1000), y: -M(y * 1000) }; wallAddTo(M(x2 * 1000), -M(y * 1000)); setMode('select-box'); await new Promise(r => setTimeout(r, 200)); return shapes.filter(isWallHatch).pop(); };
        const wA = await wall(1, 9, 1), wB = await wall(21, 29, 1); const o = { wA: [wA.wz.b, wA.wz.t, wA.bid === A.bld.id], wB: [wB.wz.b, wB.wz.t, wB.bid === B.bld.id] };
        selectedShapes = [B]; openSelectionParamModal(); o.panel = !!document.getElementById('bld-lv') && /Étages — B/.test(document.getElementById('selparam-modal').textContent);
        bldAdd(true); const r1 = lvlSorted().find(x => x.id !== 'rdc'); bldPick(r1.id); closeSelectionParamModal(); const wB1 = await wall(21, 29, 7); o.wB1 = [wB1.wz.b, wB1.wz.t];
        o.hidden = [lvlHidden(wB1), lvlHidden(wA)]; draw(); o.badges = bldBadgeHits.length; o.badgeB = bldLvlName(B, B.bld.act);
        bldOpen(A.bld.id); bldSetZ('70,00'); closeSelectionParamModal(); o.moved = [wA.wz.b, wB.wz.b]; o.box = !document.getElementById('lvl-box') || getComputedStyle(document.getElementById('lvl-box')).display === 'none';
        const txt = JSON.stringify(projectData()); loadProjectText(txt, 'b.mmc'); await new Promise(r => setTimeout(r, 300)); o.saved = JSON.stringify(shapes.filter(x => x.bld).map(x => x.bld.nm + ':' + x.bld.lvls.length));
        lvlOn = false; bldActId = null; shapes = keepS; lvls = keepL; invalidateCache(); saveState(); return o; });
    t.eq('contours de bâtiment : niveaux propres à chacun, mur pris dans son contour, étage choisi sur le contour (Y), pastilles', bz, { wA: [69000, 72000, true], wB: [72500, 75200, true], panel: true, wB1: [75200, 77900], hidden: [false, false], badges: 2, badgeB: 'R + 1', moved: [70000, 72500], box: true, saved: '["A:1","B:2"]' });
    // à l'ouverture : chaque bâtiment montré à son RDC (étages du dessus masqués, y compris dans le bâtiment non actif) ; la vue revient sur le bâtiment qu'on règle ; le plan ne rame plus avec l'étage actif
    const rdc0 = await ev(async () => { const keepS = shapes, keepL = lvls; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), M = mmToWorld, r = {};
        const rect = (x0, y0, x1, y1) => ({ type: 'poly', layerId: activeLayerId, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        const A = rect(0, 0, 10, 8), B = rect(20, 0, 30, 8); shapes.push(A, B); saveState(); bldMake(A, 'A', 69000, 3000); bldMake(B, 'B', 72500, 2700); saveState();
        const wall = async (x1, x2, y) => { startWall('w-beton20'); wallStart = { x: M(x1 * 1000), y: -M(y * 1000) }; wallAddTo(M(x2 * 1000), -M(y * 1000)); setMode('select-box'); await new Promise(q => setTimeout(q, 200)); return shapes.filter(isWallHatch).pop(); };
        for (const Z of [A, B]) { bldActivate(Z, 'rdc'); lvlAdd(true); } bldActivate(A, 'rdc'); await wall(1, 9, 1); bldPick(lvlSorted().find(x => x.id !== 'rdc').id); await wall(1, 9, 7);
        bldActivate(B, 'rdc'); bldPick('rdc'); await wall(21, 29, 1); bldPick(lvlSorted().find(x => x.id !== 'rdc').id); await wall(21, 29, 7); bldAll(); bldActivate(null);
        const txt = JSON.stringify(projectData()); loadProjectText(txt, 'r.mmc'); await new Promise(q => setTimeout(q, 300));
        const W = shapes.filter(isWallHatch), up = W.filter(w => w.lvl && w.lvl !== 'rdc'), dn = W.filter(w => w.lvl === 'rdc');
        r.open = [lvlOn, lvlAct, shapes.filter(x => x.bld).map(x => x.bld.act).join(','), !!document.getElementById('btn-etages') === false || document.getElementById('btn-etages').classList.contains('active')];
        r.hid = [up.length, up.every(w => lvlHidden(w)), dn.length, dn.some(w => lvlHidden(w) || lvlBelow(w))];
        const B2 = shapes.find(x => x.bld && x.bld.nm === 'B'), A2 = shapes.find(x => x.bld && x.bld.nm === 'A'); bldOpen(B2.bld.id); bldPick(B2.bld.lvls.find(x => x.id !== 'rdc').id); closeSelectionParamModal();
        r.pickB = [up.filter(w => w.bid === B2.bld.id).every(w => !lvlHidden(w)), up.filter(w => w.bid === A2.bld.id).every(w => lvlHidden(w)), dn.filter(w => w.bid === B2.bld.id).every(w => lvlBelow(w))];
        // vue partie très loin : régler le bâtiment la ramène sur lui
        camera.zoom = 1e-6; camera.x = 0; camera.y = 0; bldOpen(A2.bld.id); closeSelectionParamModal(); const P = A2.points.map(q => worldToScreen(q.x, q.y)), sz = Math.max(...P.map(q => q.x)) - Math.min(...P.map(q => q.x));
        r.back = sz >= 60 && sz < canvas.width; const z1 = camera.zoom; bldPick('rdc'); r.stay = camera.zoom === z1;
        // plan chargé (milliers d'objets) avec l'étage actif : une image coûte à peu près comme sans
        for (let i = 0; i < 4000; i++) shapes.push({ type: 'point', layerId: activeLayerId, x: (i % 70) * m, y: -Math.floor(i / 70) * m, z: 70000 }); invalidateCache();
        const tm = () => { const a = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); invalidateCache(); draw(); a.push(performance.now() - t0); } return a.sort((x, y) => x - y)[2]; };
        lvlOn = false; const off = tm(); lvlOn = true; const on = tm(); r.fast = on < off * 3 + 60; r.ms = [Math.round(off), Math.round(on)];
        bldAll(); bldActivate(null); lvlOn = false; shapes = keepS; lvls = keepL; invalidateCache(); saveState(); draw(); return r; });
    const rdcMs = rdc0.ms; delete rdc0.ms;
    t.eq('ouverture au RDC : étages du dessus masqués dans chaque bâtiment, vue ramenée sur le bâtiment réglé, plan fluide (' + rdcMs.join(' / ') + ' ms)', rdc0, { open: [true, 'rdc', 'rdc,rdc', true], hid: [2, true, 2, false], pickB: [true, true, true], back: true, stay: true, fast: true });
    // double-clic molette : deux clics francs seulement ; un glisser suivi d'un clic ne cadre plus tout le fond de carte
    const mid = await ev(async () => { const r = {}, cr = canvas.getBoundingClientRect(), X = cr.left + 400, Y = cr.top + 300, ev2 = (t, x, y) => canvas.dispatchEvent(new MouseEvent(t, { button: 1, buttons: t === 'mouseup' ? 0 : 4, clientX: x, clientY: y, bubbles: true, cancelable: true })), wait = (ms) => new Promise(q => setTimeout(q, ms));
        const keep = { ...camera }, keepS = shapes; shapes = shapes.concat([{ type: 'line', layerId: activeLayerId, x1: 0, y1: 0, x2: mmToWorld(5000), y2: 0 }]); camera.zoom = 0.5; camera.x = 10; camera.y = 10;
        ev2('mousedown', X, Y); ev2('mousemove', X + 60, Y + 30); ev2('mouseup', X + 60, Y + 30); await wait(40); ev2('mousedown', X + 2, Y + 1); ev2('mouseup', X + 2, Y + 1); r.drag = camera.zoom === 0.5;
        await wait(450); const z = camera.zoom, cx = camera.x; ev2('mousedown', X, Y); ev2('mouseup', X, Y); await wait(60); ev2('mousedown', X, Y); ev2('mouseup', X, Y); r.dbl = camera.zoom !== z || camera.x !== cx;
        shapes = keepS; Object.assign(camera, keep); invalidateCache(); draw(); return r; });
    t.eq('double-clic molette : cadre tout seulement sur deux clics francs, pas après un glisser', mid, { drag: true, dbl: true });
    // bouton Contour de bâtiment (ex-Étages) : on trace le contour, à la fermeture la fenêtre du bâtiment s'ouvre ; avec une polyligne fermée sélectionnée, directement
    const bt = await ev(async () => { const keepS = shapes; shapes = []; saveState(); selectedShapes = []; etaClick(); const m0 = mode; const m = mmToWorld(1000);
        shapes.push({ type: 'poly', layerId: activeLayerId, points: [[0, 0], [8, 0], [8, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m })) }); saveState(); await new Promise(r => setTimeout(r, 120));
        const asked = /Contour de bâtiment/.test(document.getElementById('topo-modal').textContent) && document.getElementById('topo-modal').style.display !== 'none'; document.getElementById('bd-nm').value = 'Test';
        [...document.querySelectorAll('#tm-actions button')].find(b => b.textContent === 'Créer').click(); const made = !!shapes[0].bld && shapes[0].bld.nm === 'Test'; closeSelectionParamModal();
        setMode('poly'); const after = typeof bldDrawing !== 'undefined' && !bldDrawing; setMode('select-box'); bldActId = null; shapes = keepS; invalidateCache(); saveState(); return { m0, asked, made, after }; });
    t.eq('bouton Contour de bâtiment : tracer, fermer, régler le bâtiment', bt, { m0: 'poly', asked: true, made: true, after: true });
    // coupe en 3 temps : la ligne (2 clics), la fenêtre de coupe suit la souris et se pose d'un clic (Tab inverse le sens), Valider (Entrée) ; Échap annule
    const cu = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        shapes.push({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [R(0, 0, 6, 0.2)], wallMat: 'beton', groupId: 'gc', wz: { b: 0, t: 2500 } }); saveState();
        const fire = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        setMode('cut'); cutClick({ x: 3 * m, y: 2 * m }); cutClick({ x: 3 * m, y: -2 * m }); const bar = getComputedStyle(document.getElementById('cut-bar')).display, n0 = shapes.length, s0 = CUT.side;
        fire('Tab'); const s1 = CUT.side; currentX = 20 * m; currentY = -20 * m; draw(); cutClick({ x: 20 * m, y: -20 * m }); const placed = !!CUT.pos, notYet = shapes.length === n0;
        fire('Enter'); const fr = shapes.find(x => x.secOf && x.type === 'hatch'), c = fr ? shapeCenterOf(fr) : null, noFrame = !shapes.some(x => x.name === 'Cadre de coupe'), colW = fr ? effectiveColor(fr) === effectiveColor(shapes[0]) : false, title = shapes.find(x => x.type === 'text' && /^COUPE A-A$/.test(x.content));
        const hat = shapes.filter(x => x.type === 'hatch' && x.groupId && /coupe/.test(x.groupId)).length;
        cutClick({ x: 1 * m, y: 2 * m }); cutClick({ x: 1 * m, y: -2 * m }); fire('Escape'); const esc = !CUT.a && getComputedStyle(document.getElementById('cut-bar')).display === 'none' && !shapes.some(x => x.cutName === 'B');
        setMode('select-box'); shapes = keepS; invalidateCache(); saveState();
        return { bar, flip: s0 === -s1, placed, notYet, noFrame, colW, frame: !!c && Math.abs(c.x - 20 * m) < 0.05 * m && Math.abs(c.y + 20 * m) < 0.05 * m, title: !!title, hat, esc }; });
    t.eq('coupe : ligne, fenêtre posée où l\'on clique, Valider ; sans cadre, couleur du calque du mur ; Tab inverse le sens, Échap annule', cu, { bar: 'flex', flip: true, placed: true, notYet: true, noFrame: true, colW: true, frame: true, title: true, hat: 1, esc: true });
    // coupe dynamique : suit les modifications du plan, garde sa place si on la déplace ; textures (matériaux, terre, remblai), TN, cotes de niveau (égout, faîtage, dalle)
    const cd = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264'), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '3/2', kR: '3/2' }, points: R(15, 8, 33, 22).map(q => Object.assign(q, { z: 103000 })) });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'cw' + k, wz: { b: 103000, t: 105700 } }));
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 102800 })), solid: { kind: 'box', H: 200 }, name: 'Dalle', zk: 1 });
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 105700 })) }, { pans: 2, he: 105.7, hf: 108.5, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' }));
        saveState(); sectionPlace(sectionData({ x: 10 * m, y: -15 * m }, { x: 38 * m, y: -15 * m }, 1), { x: 25 * m, y: -60 * m }); await new Promise(r => setTimeout(r, 700));
        const W = () => Math.max(...shapes.filter(x => x.secOf && x.hatchMat === 'parpaing').flatMap(x => x.loops[0].map(q => -q.y))), h0 = W();
        const txt = [...new Set(shapes.filter(x => x.secOf && x.type === 'text').map(x => x.content.split(' ')[0]))].sort(), mats = [...new Set(shapes.filter(x => x.secOf && x.hatchMat).map(x => x.hatchMat))].sort();
        shapes.filter(x => x.groupId === 'cw1').forEach(x => { x.wz.t = 106700; }); saveState(); await new Promise(r => setTimeout(r, 700)); const Lc = shapes.find(x => x.cutDef && x.type === 'line'), stale = secStale(Lc) && W() === h0;   /* modèle changé : la coupe attend sa pastille */
        zoomToFitShapes(shapes.filter(x => x.secOf === Lc.cutDef.id || x === Lc)); invalidateCache(); draw(); const bh = secBadgeHits.filter(b => b.id === Lc.cutDef.id).length === 2 && !!secBadgeAt(secBadgeHits[0].x0 + 3, secBadgeHits[0].y0 + 3); secForce(Lc.cutDef.id); await new Promise(r => setTimeout(r, 200)); const h1 = W(), fresh = !secStale(Lc) && !!bh;
        const T0 = shapes.find(x => x.secTitle), g = T0.groupId, x0t = T0.x; shapes.filter(x => x.groupId === g).forEach(x => translateShape(x, 10 * m, 0)); saveState(); await new Promise(r => setTimeout(r, 700));
        const T1 = shapes.find(x => x.secTitle), moved = Math.round((T1.x - x0t) / m), kept = shapes.filter(x => x.secOf).length > 10;
        const beyond = shapes.some(x => x.secOf && (x.type === 'line' || x.type === 'poly') && x.width === 0.5);
        // cotes de talus sur leur calque : masquées sans toucher au talus
        invalidateCache(); draw(); await new Promise(r => setTimeout(r, 50)); invalidateCache(); draw(); const LT = layers.find(l => l.name === 'Cotes de talus'), nT = () => screenTextsToDraw.filter(x => LT && x.layerId === LT.id).length, withT = nT(); if (LT) LT.visible = false; invalidateCache(); draw(); const hidT = nT(); if (LT) LT.visible = true;
        const r = { stale, fresh, up: Math.round((h1 - h0) / m * 10) / 10, txt, mats, moved, kept, tn: shapes.some(x => x.secOf && x.name === 'TN'), beyond, talusCot: !!LT && withT > 0 && hidT === 0 }; shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('coupe dynamique : modèle changé → pastille « à rafraîchir », un clic la recalcule ; garde sa place, textures, TN, cotes de niveau', cd, { stale: true, fresh: true, up: 1, txt: ['COUPE', 'Dessus', 'Faîtage', 'Plateforme', 'TN', 'Égout'], mats: ['beton', 'bois', 'gnt', 'parpaing', 'terre'], moved: 10, kept: true, tn: true, beyond: true, talusCot: true });
    // coupe dynamique : son groupe de calques « Coupe A-A » (dessin, cotes, ligne sur le plan) ; dessin non modifiable mais accrochable ; cotes de plateforme et du TN tous les 5 m, chacune déplaçable, gardée au recalcul
    const cg = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, name: 'Cour', talus: { on: true, kD: '3/2', kR: '3/2' }, points: R(15, 8, 33, 22).map(q => Object.assign(q, { z: 103000 })) });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 102800 })), solid: { kind: 'box', H: 200 }, name: 'Dalle', zk: 1 });
        saveState(); sectionPlace(sectionData({ x: 2 * m, y: -15 * m }, { x: 48 * m, y: -15 * m }, 1), { x: 25 * m, y: -60 * m }); await new Promise(res => setTimeout(res, 400));
        const L = shapes.find(x => x.cutDef), d = L.cutDef, nm = 'Coupe ' + d.name + '-' + d.name, ly = (id) => layers.find(l => l.id === id) || {};
        r.group = ['dessin', 'cotes', 'ligne sur le plan'].every(n => layers.some(l => l.name === nm + ' — ' + n && l.group === nm)) && ly(L.layerId).name === nm + ' — ligne sur le plan' && shapes.filter(x => x.secMark === d.id).every(x => x.layerId === L.layerId) && shapes.some(x => x.secMark === d.id && x.type === 'text' && x.content === d.name);
        const S = shapes.filter(x => x.secOf === d.id), dims = S.filter(x => x.lvKey), draw2 = S.filter(x => !x.lvKey && !x.secTitle); r.layers = dims.every(x => ly(x.layerId).name === nm + ' — cotes') && draw2.every(x => ly(x.layerId).name === nm + ' — dessin');
        const tnT = dims.filter(x => x.type === 'text' && /^TN /.test(x.content)); r.tn5 = tnT.length >= 9 && tnT.length <= 10; r.plat = dims.some(x => x.type === 'text' && /^Plateforme Cour /.test(x.content));
        const hz = draw2.find(x => x.type === 'hatch' && x.hatchMat === 'beton'), c = hz.loops[0].reduce((a, q) => ({ x: a.x + q.x / hz.loops[0].length, y: a.y + q.y / hz.loops[0].length }), { x: 0, y: 0 }); const hit = findShapeAt(c.x, c.y); r.locked = !hit || !secLock(hit); if (!r.locked) r.dbg = [hit.type, hit.secOf, !!hit.secTitle, hit.lvKey, hit.name, hit.hatchMat];
        const v = hz.loops[0][0], sn = findSnap(v.x + mmToWorld(30), v.y + mmToWorld(30)); r.snap = !!sn && Math.hypot(sn.x - v.x, sn.y - v.y) < mmToWorld(5);
        const T = shapes.find(x => x.secTitle && x.secOf === d.id), tg = expandGroups([findShapeAt(T.x + mmToWorld(200), T.y) || T]); r.title = tg.length > 20 && tg.some(x => x.type === 'hatch');
        const t0 = tnT[3], key = t0.lvKey, x0 = t0.x; shapes.filter(x => x.groupId === t0.groupId).forEach(x => translateShape(x, 0, -2 * m)); saveState(); await new Promise(res => setTimeout(res, 700));
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(36, 12, 40, 18).map(q => Object.assign(q, { z: 103000 })), solid: { kind: 'box', H: 2500 }, name: 'Abri', zk: 1 }); saveState(); await new Promise(res => setTimeout(res, 700)); secRefreshAll(true);
        const t1 = shapes.find(x => x.lvKey === key && x.type === 'text'); r.kept = !!t1 && Math.abs(t1.y - (-2 * m) - (shapes.find(x => x.lvKey === key && x.type === 'text').lvRef.y)) < 0.01 * m && Math.abs(t1.x - x0) < 0.01 * m && shapes.some(x => x.secOf === d.id && x.lvKey === key && x.dash === 'dotted');
        r.dyn = shapes.filter(x => x.secOf === d.id && x.hatchMat === 'beton').length >= 2;
        shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('coupe dynamique : groupe de calques « Coupe A-A » (dessin, cotes, ligne nommée sur le plan) ; dessin verrouillé mais accrochable ; cotes de plateforme et du TN tous les 5 m, déplaçables, gardées au recalcul', cg, { group: true, layers: true, tn5: true, plat: true, locked: true, snap: true, title: true, kept: true, dyn: true });
    // fenêtre Y de la coupe : pas du TN, écart de la colonne des niveaux, écart entre niveaux, chiffre du TN, cotes affichées, cotes remises en place
    const cy = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, name: 'Cour', talus: { on: true, kD: '3/2', kR: '3/2' }, points: R(15, 8, 33, 22).map(q => Object.assign(q, { z: 103000 })) });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 102800 })), solid: { kind: 'box', H: 200 }, name: 'Dalle', zk: 1 });
        saveState(); sectionPlace(sectionData({ x: 2 * m, y: -15 * m }, { x: 48 * m, y: -15 * m }, 1), { x: 25 * m, y: -60 * m }); await new Promise(res => setTimeout(res, 400));
        const d = shapes.find(x => x.cutDef).cutDef, txt = (re) => shapes.filter(x => x.secOf === d.id && x.type === 'text' && re.test(x.content)), dalleX = () => (txt(/^Dessus/)[0] || {}).x;
        selectedShapes = expandGroups([shapes.find(x => x.secTitle)]); openSelectionParamModal(); const box = document.getElementById('selparam-modal'), inp = [...box.querySelectorAll('input[onchange*="secOptSet"]')]; r.ui = inp.length === 10;
        const set = (k, v) => { const e = [...document.getElementById('selparam-modal').querySelectorAll('input')].find(x => (x.getAttribute('onchange') || '').includes("'" + k + "'")); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change')); };
        const n5 = txt(/^TN /).length, x0 = dalleX(); set('tn', '10'); r.tn = txt(/^TN /).length < n5 && txt(/^TN /).length >= 4; set('col', '4'); r.col = Math.abs(dalleX() - x0 - 2.5 * m) < 0.05 * m;
        set('on.P', false); r.noPlat = txt(/^Plateforme/).length === 0; set('on.P', true); r.plat = txt(/^Plateforme/).length === 1;
        const t0 = txt(/^TN /)[1]; shapes.filter(x => x.groupId === t0.groupId).forEach(x => translateShape(x, 0, -2 * m)); saveState(); secRefreshAll(); r.moved = !!(d.lvOff && Object.keys(d.lvOff).length);
        const rb = [...document.getElementById('selparam-modal').querySelectorAll('[onclick]')].find(x => /'reset'/.test(x.getAttribute('onclick'))); if (rb) rb.click(); r.reset = !!rb && !Object.keys(d.lvOff || {}).length; r.sel = selectedShapes.some(x => x.secTitle);
        closeSelectionParamModal(); shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('coupe, fenêtre Y : pas des cotes du TN, écart de la colonne des niveaux, cotes affichées ou non, cotes remises à leur place', cy, { ui: true, tn: true, col: true, noPlat: true, plat: true, moved: true, reset: true, sel: true });
    // coupes légères : un trait, une cote, un texte ajoutés ne relancent pas le calcul de la coupe ; un volume ajouté, si ; la vue au-delà en polylignes (peu d'objets)
    const cp = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20], [18, 10, 30, 10.2], [18, 19.8, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'cp' + k, wz: { b: 101500, t: 104200 } }));
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 104200 })) }, { pans: 2, he: 104.2, hf: 107, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' }));
        saveState(); sectionPlace(sectionData({ x: 2 * m, y: -12 * m }, { x: 48 * m, y: -12 * m }, 1), { x: 25 * m, y: -60 * m }); await new Promise(res => setTimeout(res, 500));
        const d = shapes.find(x => x.cutDef).cutDef, S = shapes.filter(x => x.secOf === d.id), bey = S.filter(x => x.width === 0.5); r.chained = bey.some(x => x.type === 'poly' && x.points.length > 2);
        const f0 = window.sectionData; let n = 0; window.sectionData = function () { n++; return f0.apply(this, arguments); };
        try { shapes.push({ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 3 * m, y2: 0 }); saveState(); await new Promise(res => setTimeout(res, 600)); r.skip = n === 0;
            shapes.push({ type: 'poly', layerId: 'layer-0', points: R(36, 8, 40, 16).map(q => Object.assign(q, { z: 103000 })), solid: { kind: 'box', H: 2500 }, name: 'Abri', zk: 1 }); saveState(); await new Promise(res => setTimeout(res, 600)); r.redo = n === 0 && secStale(shapes.find(x => x.cutDef && x.type === 'line')); secRefreshAll(true); r.redo = r.redo && n === 1; }
        finally { window.sectionData = f0; }
        shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('coupes légères : un trait ajouté ne relance pas le calcul, un volume ajouté la marque à rafraîchir (calcul au clic) ; vue au-delà en polylignes', cp, { chained: true, skip: true, redo: true });
    // toit terrasse avec acrotère : la coupe et la façade cotent le dessus de l'acrotère (pas la dalle de toit qu'il cache, ni le complexe d'étanchéité)
    const acr = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m })), W = (x, y) => ({ x: x * m, y: -y * m });
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20], [18, 10, 30, 10.2], [18, 19.8, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'ac' + k, wz: { b: 100000, t: 102750 } }));
        shapes.push(...buildTerrace({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 103000 })) }, { pans: 0, he: 103, te: 0.25, tc: 0, ah: 0.4, at: 0.2, fp: 0, fe: 0.05, ct: 0.1 })); saveState();
        const lab = (id) => shapes.filter(x => x.secOf === id && x.type === 'text' && /^(Acrotère|Dessus de dalle)/.test(x.content)).map(x => x.content).sort();
        sectionPlace(sectionData(W(10, 15), W(38, 15), 1), W(24, -40)); const d1 = shapes.find(x => x.cutDef && !x.cutDef.fac).cutDef; r.cut = lab(d1.id);
        sectionPlace(sectionData(W(14, 4), W(34, 4), facSide(W(14, 4), W(34, 4)), true), W(24, -80)); const d2 = shapes.find(x => x.cutDef && x.cutDef.fac).cutDef; r.fac = lab(d2.id);
        shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('toit terrasse : la coupe et la façade cotent le dessus de l\'acrotère', acr, { cut: ['Acrotère 103,40'], fac: ['Acrotère 103,40'] });
    // vue de façade : ligne tracée devant, rien de coupé, regard vers le bâtiment, nom selon l'orientation, terrain lu au pied du mur, niveaux de la toiture
    const fa = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m })), W = (x, y) => ({ x: x * m, y: -y * m });
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + j * 300, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20], [18, 10, 30, 10.2], [18, 19.8, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'fa' + k, wz: { b: 100500, t: 103200 } }));
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 103200 })) }, { pans: 2, he: 103.2, hf: 106, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' })); saveState();
        const A = W(14, 4), B = W(34, 4); r.side = facSide(A, B); r.sideBack = facSide(B, A) === -r.side; const D = sectionData(A, B, r.side, true);
        r.noCut = D.loops.length === 0; r.seen = D.beyond.length > 10; r.name = D.name; const d0 = footAt(D.foot, 10000); r.foot = d0 > 5300 && d0 < 6100;
        const tm = D.tn[100]; r.tn = !!tm && Math.abs(tm[1] - 100600) < 40; r.lv = ['Faîtage', 'Égout'].every(k => D.lvF.some(l => l.k === k)) && D.lvF.some(l => l.k === 'Faîtage' && Math.abs(l.z - 106000) < 400);
        setMode('facade'); cutClick(A); cutClick(B); r.tool = !!(CUT.D && CUT.D.fac && CUT.side === r.side); cutClick(W(24, -20)); cutValidate(); setMode('select-box');
        const L = shapes.find(x => x.cutDef), d = L && L.cutDef; r.def = !!(d && d.fac === 1); r.title = shapes.filter(x => x.secTitle).map(x => x.content).join(); r.lay = layers.some(l => l.name === 'Façade sud — dessin');
        r.lineHidden = (layers.find(l => l.id === L.layerId) || {}).visible === false && shapes.filter(x => x.secMark === d.id).every(x => (layers.find(l => l.id === x.layerId) || {}).visible === false); { const ok = new Set(shapes.filter(x => is3DObj(x) && !x.gen && !x.secOf).map(x => x.layerId || 'layer-0')); r.onlyObj = D.beyond.every(b => ok.has(b[4] || 'layer-0')); } r.hatchCut = !d || shapes.some(x => x.secOf === d.id && x.hatchMat === 'parpaing'); r.lvl = !!d && shapes.some(x => x.secOf === d.id && x.type === "text" && /^Faîtage /.test(x.content)); if (!d) { shapes = keepS; layers = keepL; return r; }
        r.second = sectionData(A, B, r.side, true).name; shapes.filter(x => x.groupId === 'fa2').forEach(x => translateShape(x, 0, 3 * m)); saveState(); secForce(d.id); await new Promise(res => setTimeout(res, 400)); r.refreshed = !!shapes.find(x => x.secTitle && x.secOf === d.id) && !secStale(L);
        shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('vue de façade : rien de coupé, que les traits des ouvrages, ligne cachée sur le plan, regard vers le bâtiment, nommée selon l\'orientation, terrain au pied du mur, niveaux de toiture, outil et recalcul', fa,
        { side: -1, sideBack: true, noCut: true, seen: true, name: 'sud', foot: true, tn: true, lv: true, tool: true, def: true, title: 'FAÇADE SUD', lay: true, lineHidden: true, onlyObj: true, hatchCut: false, lvl: true, second: 'sud 2', refreshed: true });
    // façade texturée (option du Y) : la maquette 3D rendue de face, posée sous les traits, fond transparent, gardée à l'enregistrement ; la pastille ouvre le Y
    const ftx = await ev(async () => { await loadThree(); const keepS = shapes, keepL = layers.slice(); shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m })), W = (x, y) => ({ x: x * m, y: -y * m });
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20], [18, 10, 30, 10.2], [18, 19.8, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'ft' + k, wz: { b: 100500, t: 103200 }, tex: 'pierre-brute' })); saveState();
        const A = W(14, 4), B = W(34, 4); sectionPlace(sectionData(A, B, facSide(A, B), true), W(24, -20)); const L = shapes.find(x => x.cutDef), id = L.cutDef.id; r.before = shapes.some(x => x.facTex);
        secOptSet(id, 'tex', true); const im = shapes.find(x => x.facTex && x.secOf === id), url = im && basemapStore[im.mapId]; r.made = !!url;
        if (url) { const I = new Image(); await new Promise(q => { I.onload = q; I.onerror = q; I.src = url; }); const cv = document.createElement('canvas'); cv.width = I.width; cv.height = I.height; const c = cv.getContext('2d'); c.drawImage(I, 0, 0); const d = c.getImageData(0, 0, cv.width, cv.height).data; let op = 0, tr = 0; for (let k = 3; k < d.length; k += 4) { if (d[k] > 250) op++; else if (d[k] < 5) tr++; } r.pix = op > d.length / 4 * 0.2 && tr > d.length / 4 * 0.05;
            const lines = shapes.filter(x => x.secOf === id && x.type !== 'bgimage'); r.under = shapes.indexOf(im) < Math.min(...lines.map(x => shapes.indexOf(x))); const W0 = Math.abs(im.w - mmToWorld(L.cutDef ? (SEC_D.get(id).D.u1 - SEC_D.get(id).D.u0) : 0)) < 1e-6; r.size = W0; }
        const txt = JSON.stringify(projectData()); r.saved = /"fac-sec/.test(txt);
        zoomToFitShapes(shapes.filter(x => x.secOf === id)); draw(); const bh = secBadgeHits.find(b => b.id === id); r.bh = !!bh; closeSelectionParamModal(); selectedShapes = []; if (bh) { const cr = canvas.getBoundingClientRect(); const e = (t) => canvas.dispatchEvent(new MouseEvent(t, { button: 0, clientX: cr.left + (bh.x0 + bh.x1) / 2, clientY: cr.top + (bh.y0 + bh.y1) / 2, bubbles: true })); e('mousedown'); e('mouseup'); }
        const mod = document.getElementById('selparam-modal'); r.y = !!mod && getComputedStyle(mod).display !== 'none' && /Façade texturée/.test(mod.textContent); if (!r.y) r.yWhy = [r.bh, !!mod, mod && getComputedStyle(mod).display, mod && mod.textContent.slice(0, 120)].join('|'); delete r.bh; closeSelectionParamModal();
        secOptSet(id, 'tex', false); r.off = !shapes.some(x => x.facTex);
        selectedShapes = []; shapes = keepS; layers = keepL; updateLayerUI(); invalidateCache(); saveState(); return r; });
    t.eq('façade texturée : image 3D de face sous les traits, fond transparent, à l\'échelle, enregistrée ; la pastille ouvre le Y ; décochée, elle disparaît', ftx, { before: false, made: true, pix: true, under: true, size: true, saved: true, y: true, off: true });
    // coupe : hiérarchie des traits (coupé épais, au-delà fin, TN tireté, rappels de niveau pointillés), niveaux à droite du bâtiment (pas au bout du terrain), titre effacé = coupe toujours dynamique
    const cs = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 16; i++) for (let j = 0; j <= 8; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 200, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'cs' + k, wz: { b: 103000, t: 105700 } }));
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 105700 })) }, { pans: 2, he: 105.7, hf: 108.5, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' }));
        saveState(); sectionPlace(sectionData({ x: 2 * m, y: -15 * m }, { x: 78 * m, y: -15 * m }, 1), { x: 40 * m, y: -70 * m }); await new Promise(r => setTimeout(r, 300));
        const S = shapes.filter(x => x.secOf), tn = S.find(x => x.name === 'TN'), cut = S.find(x => x.type === 'poly' && x.width === 2 && !x.name), bey = S.find(x => (x.type === 'line' || x.type === 'poly') && x.width === 0.5 && !x.dash), lead = S.find(x => x.dash === 'dotted');
        const wallX = Math.max(...S.filter(x => x.hatchMat === 'parpaing').flatMap(x => x.loops[0].map(q => q.x))), roofX = Math.max(...S.filter(x => x.hatchMat === 'bois').flatMap(x => x.loops[0].map(q => q.x))), mk = S.filter(x => x.type === 'text' && /Faîtage|Égout/.test(x.content)).map(x => (x.x - Math.max(wallX, roofX)) / m);
        const styles = [effectiveDash(tn), effectiveWidth(cut), effectiveWidth(bey), effectiveDash(lead)];
        shapes = shapes.filter(x => !x.secTitle); saveState(); await new Promise(r => setTimeout(r, 700)); const alive = !!shapes.find(x => x.cutDef) && !!shapes.find(x => x.secTitle);
        /* rapidité : la maquette des coupes n'est pas refaite pour un texte ajouté ni pour une deuxième coupe ; la coupe neuve n'est pas recalculée à son premier rafraîchissement */
        const b0 = build3DScene; let nb = 0, fast = null; build3DScene = function (...a) { nb++; return b0.apply(this, a); };
        try { shapes.push({ type: 'text', layerId: activeLayerId, x: 0, y: 0, content: 'note', height: 1 }); saveState(); secRefreshAll(); const afterText = nb;
            sectionPlace(sectionData({ x: 2 * m, y: -20 * m }, { x: 78 * m, y: -20 * m }, 1), { x: 40 * m, y: -120 * m }); const afterSecond = nb; const sd0 = sectionData; let nd = 0; sectionData = function (...a) { nd++; return sd0.apply(this, a); }; secRefreshAll(); sectionData = sd0;
            fast = { afterText, afterSecond: nb - afterText, recalc: nd }; } finally { build3DScene = b0; }
        shapes = keepS; invalidateCache(); saveState(); return { styles, near: mk.length > 0 && mk.every(d => d > 0 && d < 5), alive, fast }; });
    t.eq('coupe : traits coupés épais, au-delà fins, TN tireté, rappels pointillés ; niveaux contre le bâtiment ; titre effacé, coupe toujours dynamique ; maquette des coupes pas refaite pour un texte ni une 2e coupe', cs, { styles: ['dashed', 2, 0.5, 'dotted'], near: true, alive: true, fast: { afterText: 0, afterSecond: 0, recalc: 0 } });
    // coupe : l'au-delà vient de la maquette filaire des vues de façade (faîtage vu derrière la coupe), rien sous la terre coupée ; cotes de niveau déplaçables, elles suivent la coupe
    const cw = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 8; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + j * 400, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[18, 10, 18.2, 20], [29.8, 10, 30, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'cz' + k, wz: { b: 105000, t: 107700 } }));
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(18, 10, 30, 20).map(q => Object.assign(q, { z: 107700 })) }, { pans: 2, he: 107.7, hf: 110.5, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' }));
        shapes.push({ type: 'line', layerId: 'layer-0', x1: 5 * m, y1: -30 * m, x2: 45 * m, y2: -30 * m });   // simple trait du plan : pas dans l'au-delà
        saveState(); const SC = secSceneMM(), D = sectionData({ x: 2 * m, y: -12 * m }, { x: 48 * m, y: -12 * m }, -1);
        const ridge = D.beyond.some(b => Math.abs(b[1] - b[3]) < 60 && b[1] > 110000 && Math.abs(b[2] - b[0]) > 5000);
        const tin = getTIN(), eAt = (u) => { const f = u / ((D.rx * 46000)); return tinZ(2 * m + 46 * m * Math.abs(u) / 46000, -12 * m, tin); };
        const below = D.beyond.filter(b => [[b[0], b[1]], [b[2], b[3]]].some(([u, z]) => { const e = eAt(u); return hasZ(e) && z < e - 300; })).length;
        sectionPlace(D, { x: 25 * m, y: -70 * m }); await new Promise(r => setTimeout(r, 300));
        const mk = () => shapes.find(x => x.secOf && x.type === 'text' && x.lvKey && /Faîtage/.test(x.content)), m0 = mk(), key = m0.lvKey, x0 = m0.x, grpOwn = shapes.filter(x => x.groupId === m0.groupId).length >= 2 && m0.groupId !== shapes.find(x => x.secTitle).groupId;
        shapes.filter(x => x.groupId === m0.groupId).forEach(x => translateShape(x, 3 * m, 2 * m)); saveState(); await new Promise(r => setTimeout(r, 700));
        const m1 = mk(), kept = !!m1 && Math.abs(m1.x - x0 - 3 * m) < 0.01 * m && Math.abs(m1.y - m1.lvRef.y) < 0.01 * m;   /* glissée sur sa ligne de niveau : elle reste à son niveau */
        const T = shapes.find(x => x.secTitle); shapes.filter(x => x.groupId === T.groupId).forEach(x => translateShape(x, 10 * m, 0)); saveState(); await new Promise(r => setTimeout(r, 700));
        const m2 = mk(), follow = !!m2 && Math.abs(m2.x - x0 - 13 * m) < 0.01 * m;
        shapes = keepS; invalidateCache(); saveState(); return { wire: !!SC && SC.edges.length > 0, ridge, below, grpOwn, kept, follow }; });
    t.eq('coupe : au-delà tiré de la maquette filaire (faîtage vu), rien sous la terre ; cote de niveau déplaçable qui suit la coupe', cw, { wire: true, ridge: true, below: 0, grpOwn: true, kept: true, follow: true });
    // blocs du catalogue en 3D : arbre posé au sol, à sa taille ; meuble tourné avec son dessin ; bloc déplacé = modèle déplacé ; vignettes marquées 2D/3D
    const bk = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000);
        for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const put = (id, x, y, rot) => { const b = BLOCKS_BUILTIN.find(q => q.id === id), gid = 'gb-' + id; blockShapes(b, x, y, 1, rot).forEach(sh => { sh.groupId = gid; sh.block = b.name; shapes.push(sh); }); return gid; };
        put('arbre', 10 * m, -10 * m, 0); const gl = put('lit2', 20 * m, -20 * m, Math.PI / 2), gt = put('table6', 5 * m, -25 * m, 0), gh = put('haie', 25 * m, -5 * m, 0); saveState(); if (!V3) init3D(); build3DScene();
        const nOf = (gid) => { let n = 0; V3.root.traverse(o => { if (o.userData.blk && o.userData.blk.groupId === gid) n++; }); return n; }, parts = { table: nOf(gt) > 30, haie: nOf(gh) >= 5 };
        const box = (gid) => { const B = new THREE.Box3(); V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (o.userData.blk && o.userData.blk.groupId === gid) B.expandByObject(o); }); return B; };
        const T = box('gb-arbre'), L = box(gl), zg = (100000 / 1000 - V3.zmin) * V3.exag, h = T.max.z - V3.root.position.z - zg, w = L.max.x - L.min.x, d = L.max.y - L.min.y;
        shapes.filter(x => x.groupId === gl).forEach(x => translateShape(x, 3 * m, 0)); build3DScene(); const L2 = box(gl);
        blkTab = 'veget'; renderBlockMenu(); const badge = /2D\/3D/.test(document.getElementById('blk-grid').innerHTML);
        shapes = keepS; invalidateCache(); saveState(); return { parts, tree: h > 5 && h < 9, base: Math.abs(T.min.z - V3.root.position.z - zg) < 0.05, turned: w > d && Math.abs(w - 2) < 0.05, moved: Math.round((L2.min.x - L.min.x) * 10) / 10, badge }; });
    t.eq('blocs en 3D : table avec ses chaises, haie en touffes, arbre au sol à sa taille, meuble tourné et déplacé avec son dessin, vignettes 2D/3D', bk, { parts: { table: true, haie: true }, tree: true, base: true, turned: true, moved: 3, badge: true });
    // bloc posé avant que le catalogue redessine son contour (canapé aux coins arrondis) : toujours en 3D, à sa place
    const old = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000);
        startStamp('canape'); currentX = 5 * m; currentY = -5 * m; placeStamp(); setMode('select-box'); const G = shapes.filter(x => x.block === 'Canapé 3 pl.');
        const box = () => { build3DScene(); const bb = new THREE.Box3(); V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (o.isMesh && o.userData.blk && o.userData.blk.block === 'Canapé 3 pl.') bb.expandByObject(o); }); return bb; };
        saveState(); if (!V3) init3D(); const b0 = box();
        const P = G[0].points, xs = P.map(q => q.x), ys = P.map(q => q.y); G[0].points = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]].map(([x, y]) => ({ x, y }));   // ancien contour : 4 coins
        saveState(); if (!V3) init3D(); build3DScene(); const bb = new THREE.Box3(); let n = 0; V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (o.isMesh && o.userData.blk && o.userData.blk.block === 'Canapé 3 pl.') { n++; bb.expandByObject(o); } });
        const c = bb.getCenter(new THREE.Vector3()).sub(V3.root.position), w = Math.round((bb.max.x - bb.min.x) * 100) / 100, r = { n: n >= 4, w, at: bb.min.distanceTo(b0.min) < 0.01 && bb.max.distanceTo(b0.max) < 0.01 };
        shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('bloc posé avant un redessin du catalogue (canapé) : toujours en 3D, à sa place et à sa taille', old, { n: true, w: 2.1, at: true });
    // groupe dont les traits ne sont plus dans l'ordre du bloc (bureau : la chaise en premier) : le bureau garde sa taille ; meuble d'un étage : posé sur le plancher de cet étage
    const ord = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), r = {};
        const C = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [12, 0], [12, -10], [0, -10]].map(([x, y]) => ({ x: x * m, y: y * m })) }; shapes.push(C); const Z = bldMake(C, 'Test', 0, 3000); Z.bld.lvls.push({ id: 'l1', z: 3000, h: 3000 });
        const put = (x, lv) => { startStamp('bureau'); currentX = x * m; currentY = -5 * m; placeStamp(); setMode('select-box'); const g = shapes[shapes.length - 1].groupId, G = shapes.filter(s => s.groupId === g); G.forEach(s => { s.bid = Z.bld.id; s.lvl = lv; }); return g; };
        const g1 = put(3, 'rdc'), g2 = put(8, 'l1'); const G2 = shapes.filter(s => s.groupId === g2); shapes = shapes.filter(s => s.groupId !== g2).concat(G2.slice().reverse());   // ordre inversé : la chaise d'abord
        saveState(); if (!V3) init3D(); build3DScene(); const bb = {}; V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (o.isMesh && o.userData.blk && o.userData.blk.block === 'Bureau') { const k = o.userData.blk.groupId; (bb[k] = bb[k] || new THREE.Box3()).expandByObject(o); } });
        const s1 = bb[g1].getSize(new THREE.Vector3()), s2 = bb[g2].getSize(new THREE.Vector3()); r.size = s2.distanceTo(s1) < 0.01 && Math.abs(s1.x - 1.4) < 0.02; r.etage = Math.round((bb[g2].min.z - bb[g1].min.z) / V3.exag * 100) / 100;
        shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('bloc aux traits dans le désordre : bon placement, bonne taille ; meuble d\'étage sur le plancher de son étage', ord, { size: true, etage: 3 });
    // Momo attrapé (clic maintenu + glisser) et posé sur le plan : vue à hauteur d'yeux, Z Q S D pour marcher, arrêt contre un mur, Échap = retour au plan
    const fp0 = await ev(async () => { await loadThree(); window.__keepFps = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); shapes.push({ type: 'hatch', layerId: wl, loops: [R(5, 26, 35, 26.2)], wallMat: 'parpaing', wz: { b: 100000, t: 103000 } });
        saveState(); if (is3DOpen()) close3D(); zoomExtents(); draw(); const el = document.querySelector('#mt-dock,#mc-momo'), er = el.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
        let gx = er.left + er.width / 2, gy = null; for (let y = er.top + 2; y < er.bottom && gy === null; y += 2) for (let x = er.left + 4; x < er.right - 4 && gy === null; x += 3) { const t = document.elementFromPoint(x, y); if (t && el.contains(t)) { gx = x; gy = y; } }   // un point visible de Momo (le bas est derrière la barre de commande)
        return { sx: gx, sy: gy, dx: cr.left + 20 * m * camera.zoom + camera.x, dy: cr.top - 20 * m * camera.zoom + camera.y - ((el.querySelector('svg') || el).getBoundingClientRect().height * 0.9 + 22) }; });   // Momo est posé sur son ombre, sous la main
    await H.p.mouse.move(fp0.sx, fp0.sy); await H.wait(450);   // Momo se soulève au survol : on vise de nouveau un point visible de lui
    Object.assign(fp0, await ev(() => { const el = document.querySelector('#mt-dock,#mc-momo'), er = el.getBoundingClientRect(); for (let y = er.top + 2; y < er.bottom; y += 2) for (let x = er.left + 4; x < er.right - 4; x += 3) { const t = document.elementFromPoint(x, y); if (t && el.contains(t)) return { sx: x, sy: y }; } return {}; }));
    await H.p.mouse.move(fp0.sx, fp0.sy); await H.p.mouse.down(); for (let i = 1; i <= 8; i++) await H.p.mouse.move(fp0.sx + (fp0.dx - fp0.sx) * i / 8, fp0.sy + (fp0.dy - fp0.sy) * i / 8);
    const gh = await ev(() => { const g = [...document.body.children].filter(x => x.tagName.toLowerCase() === 'svg' && x.style.position === 'fixed'), sh = [...document.body.children].filter(x => x.tagName === 'DIV' && /radial-gradient/.test(x.style.background)); return { one: g.length === 1, noText: g.length === 1 && !/…/.test(g[0].textContent || ''), shadow: sh.length === 1, nosel: document.body.classList.contains('momo-drag') }; });
    await H.p.mouse.up();
    await H.p.waitForFunction(() => V3 && V3.fps, null, { timeout: 15000 });
    const fp1 = await ev(() => { const F = V3.fps, rp = V3.root.position, eye = F.pos.z - ((100000 / 1000 - V3.zmin) * V3.exag + rp.z), x0 = F.pos.x - rp.x, y0 = F.pos.y - rp.y;
        F.yaw = 0; F.keys = { KeyW: true }; for (let i = 0; i < 4; i++) fpsStep(0.25); const walk = Math.round((F.pos.y - rp.y - y0) * 10) / 10;   // 4 × 0,25 s vers le nord
        for (let i = 0; i < 60; i++) fpsStep(0.25); F.keys = {}; const stop = F.pos.y - rp.y;   // encore vers le nord, jusqu'au mur (à 6 m du point posé)
        return { eye: Math.round(eye * 100) / 100, x: Math.round(x0), y: Math.round(y0), walk, wall: stop > 25 && stop < 26, hud: document.getElementById('v3-fps').style.display }; });
    const fk0 = await ev(() => ({ surf: document.getElementById('v3-surf').checked, ex: document.getElementById('v3-exag').value })); await ev(() => { fpsPause({ clientX: 500, clientY: 400 }); fpsBubble(3); fpsBubble(1); }); await H.wait(200);
    const fk = await ev((k0) => { const r = { bubbles: document.querySelectorAll('#fps-bub .fb').length, paused: !!V3.fps.paused, surf: document.getElementById('v3-surf').checked !== k0.surf, ex: document.getElementById('v3-exag').value !== k0.ex, still: !!V3.fps };
        document.getElementById('v3-exag').value = k0.ex; document.getElementById('v3-exag').dispatchEvent(new Event('change')); fpsFKey(3); fpsResume(); return r; }, fk0);
    await H.press('Escape'); await H.wait(300);
    const fp2 = await ev(() => { const r = { plan: !is3DOpen(), off: !(V3 && V3.fps) }; shapes = window.__keepFps; invalidateCache(); saveState(); return r; });
    t.eq('Momo glissé sur le plan (porté avec son ombre, sans sélection parasite) : vue à hauteur d\'yeux au point posé, il marche, s\'arrête au mur, Échap = retour au plan', [gh, fp1, fk, fp2], [{ one: true, noText: true, shadow: true, nosel: true }, { eye: 1.65, x: 20, y: 20, walk: 3.4, wall: true, hud: 'block' }, { bubbles: 10, paused: true, surf: true, ex: true, still: true }, { plan: true, off: true }]);
    // un pan de montagne importé loin du projet ne change ni la portée des talus, ni le terrain fini (avant : talus calculés et dessinés à gros grain, en éventails)
    const mt = await ev(() => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '3/2', kR: '3/2' }, points: R(18, 18, 32, 32).map(q => Object.assign(q, { z: 103000 })) }); tinCache = null; invalidateCache();
        const look = () => { const FM = finishedModel(), out = []; for (let d = 0; d <= 12; d++) { const r = FM.at((32 + d) * m, -25 * m); out.push(r ? r.kind + ':' + Math.round(r.z / 10) : '-'); } return { ext: FM.P[0].ext / m, prof: out.join(' ') }; };
        const a = look(); for (let k = 0; k < 10; k++) { const an = k / 10 * 2 * Math.PI; shapes.push({ type: 'point', layerId: 'layer-0', x: (25 + Math.cos(an) * 1500) * m, y: (-25 + Math.sin(an) * 1500) * m, z: 1100000 + (k % 3) * 200000, zk: 1 }); } tinCache = null; invalidateCache();
        const b = look(); shapes = keepS; tinCache = null; invalidateCache(); saveState(); return { near: b.ext < a.ext * 1.5 && b.ext < 30, same: a.prof === b.prof, a, b }; });
    t.ok('montagne importée au loin : portée des talus et terrain fini inchangés près du projet', mt.near && mt.same, JSON.stringify(mt));
    // bâti du cadastre en 3D : volume posé au point bas du terrain sous son contour, murs jusqu'à TN + 3 m, toit à croupes (pente 35 %) ; contour plat non dessiné au fond de la scène
    const cb = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 500, zk: 1 });   // pente de 10 % vers l'est
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(10, 10, 22, 18), cadOf: 'bm1', name: 'Bâti (BD TOPO)', cadBati: 1, zk: 1, lvs: 1 });
        // fond de carte photo : gris clair partout, sauf un carré bleu-gris sous le toit → le toit prend cette couleur
        const cv = document.createElement('canvas'); cv.width = cv.height = 200; const cx = cv.getContext('2d'); cx.fillStyle = '#6b8e23'; cx.fillRect(0, 0, 200, 200); cx.fillStyle = '#5f6b7a'; cx.fillRect(60, 100, 50, 45);   // 1 px = 0,5 m ; image centrée en (25 m, 25 m sud), r 50 m : le toit (x 10…22, y 10…18) tombe en px 70…94, py 114…130
        basemapStore['tbati'] = cv.toDataURL('image/png'); delete basemapImgCache['tbati']; shapes.unshift({ type: 'basemap', layerId: 'layer-0', x: 25 * m, y: -25 * m, r: 50 * m, rot: 0, mapId: 'tbati', lat: 44.5, lon: 6, radiusM: 50 });
        bmImg('tbati'); await new Promise(r => setTimeout(r, 300)); saveState(); if (!V3) init3D(); build3DScene();
        const B = new THREE.Box3(), Rf = new THREE.Box3(); let n = 0; V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (o.userData.cadBati) { n++; (o.userData.cadBati === 'toit' ? Rf : B).expandByObject(o); } });
        const z = (v) => Math.round(((v - V3.root.position.z) / V3.exag + V3.zmin) * 100) / 100;
        let roof = null; V3.root.traverse(o => { if (o.userData.cadBati === 'toit') roof = o; }); const ca = roof.geometry.attributes.color, col = new THREE.Color(ca.getX(0), ca.getY(0), ca.getZ(0)), hsl = {}; col.getHSL(hsl);
        const r = { n, base: z(B.min.z), eaves: Math.round(z(B.max.z) * 10) / 10, ridge: z(Rf.max.z), w: Math.round((B.max.x - B.min.x) * 10) / 10, deb: Math.round((Rf.max.x - Rf.min.x) * 10) / 10, grisBleu: hsl.h > 0.5 && hsl.h < 0.65 && hsl.s < 0.3 };
        // Y du bâtiment : toiture (croupes, 2 pans + pignons, 1 pan, plat), hauteur, débord, couleurs du toit et des murs
        const S0 = shapes.find(isCadBati), geo = () => { build3DScene(); const o = {}; V3.root.updateMatrixWorld(true); V3.root.traverse(x => { if (x.userData.cadBati) o[x.userData.cadBati] = x; }); const bw = new THREE.Box3().setFromObject(o.murs), br = new THREE.Box3().setFromObject(o.toit), c = o.toit.geometry.attributes.color, cw = o.murs.geometry.attributes.color;
            return { wTop: z(bw.max.z), rTop: z(br.max.z), rLow: z(br.min.z), rw: Math.round((br.max.x - br.min.x) * 10) / 10, toit: new THREE.Color(c.getX(0), c.getY(0), c.getZ(0)).getHexString(), mur: new THREE.Color(cw.getX(0), cw.getY(0), cw.getZ(0)).getHexString() }; };
        selectedShapes = [S0]; openSelectionParamModal(); r.ui = ['sp-cbt', 'sp-cbh', 'sp-cbdb'].every(id => !!document.getElementById(id)) && document.querySelectorAll('.cb-s').length >= 14;
        cbSet('t', '2pans'); const g2 = geo(); r.pignons = g2.wTop > 108 && Math.abs(g2.rTop - 108.4) < 0.05;
        cbSet('t', '1pan'); const g1 = geo(); r.monopente = g1.rTop - g1.rLow > 2 && g1.rTop - g1.rLow < 2.4;
        cbSet('t', 'plat'); cbSet('h', '9'); cbSet('toit', '#a8432c'); cbSet('mur', '#00ff00'); const gp = geo(); r.plat = Math.abs(gp.rTop - 110) < 0.05 && Math.abs(gp.rTop - gp.rLow) < 0.01 && gp.rw === 12; r.couleurs = gp.toit === 'a8432c' && gp.mur === '00ff00';
        r.actif = !!document.querySelector('.cb-s.on'); cbSet('t', 'croupe'); cbSet('dbcm', '80'); r.debord = Math.abs(geo().rw - 13.6) < 0.05; cbSet('dbcm', ''); r.defaut = S0.cb.db === undefined && geo().rw === 12.8;
        closeSelectionParamModal(); selectedShapes = []; shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('bâti du cadastre en volume : posé au point bas, murs à TN + 6 m, toit à croupes 35 % débordant de 40 cm, de la couleur du toit sur la photo ; Y : toiture, hauteur, débord, couleurs', cb, { n: 2, base: 100.7, eaves: 106.9, ridge: 108.4, w: 12, deb: 12.8, grisBleu: true, ui: true, pignons: true, monopente: true, plat: true, couleurs: true, actif: true, debord: true, defaut: true });
    // textures : sur une face en pente, le motif suit la ligne de plus grande pente (V) et la ligne de niveau (U) ; grain sur toutes les matières éclairées
    const txp = await ev(async () => { await loadThree(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 0, 2, 2, 1, 1, 0, 1, 3, 2, 0, 2, 2], 3)); const G = texGeometry(g, 1), uv = G.attributes.uv.array;
        // plan en pente : A=(0,0,0) et B=(1,1,0) au même niveau, C=(0,2,2) plus haut
        const dU = [uv[2] - uv[0], uv[3] - uv[1]], dC = [uv[4] - uv[0], uv[5] - uv[1]];
        return { niveau: Math.abs(dU[1]) < 1e-6 && Math.abs(Math.abs(dU[0]) - Math.SQRT2) < 1e-6, pente: Math.abs(dC[1] - Math.sqrt(6)) < 1e-6,   // C est à √6 m de la ligne de niveau AB, en montant
            grain: /mcGrain/.test(THREE.ShaderChunk.lights_lambert_fragment) && /mcGrain/.test(THREE.ShaderChunk.lights_physical_fragment) }; });
    t.eq('textures dans le sens de la pente (lignes de niveau horizontales dans le motif) ; rendu granuleux de toutes les matières', txp, { niveau: true, pente: true, grain: true });
    // zone boisée en 3D : un houppier par arbre posé sur le sol ; couleur prise sur la photo du fond (switch : photo / verts)
    const zb = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000);
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const cv = document.createElement('canvas'); cv.width = cv.height = 200; const cx = cv.getContext('2d'); cx.fillStyle = '#8a3b8a'; cx.fillRect(0, 0, 200, 200);   // photo violette
        basemapStore['tbois3'] = cv.toDataURL('image/png'); delete basemapImgCache['tbois3']; shapes.unshift({ type: 'basemap', layerId: 'layer-0', x: 20 * m, y: -20 * m, r: 50 * m, rot: 0, mapId: 'tbois3', lat: 44.5, lon: 6, radiusM: 50 });
        const z = { type: 'poly', layerId: 'layer-0', points: [[5, 5], [35, 5], [35, 30], [5, 30]].map(([x, y]) => ({ x: x * m, y: -y * m })), bois: { h: 14 } }; shapes.push(z); bmImg('tbois3'); await new Promise(r => setTimeout(r, 300)); saveState(); if (!V3) init3D();
        const look = () => { build3DScene(); let im = null; V3.root.traverse(o => { if (o.userData.bois) im = o; }); const c = new THREE.Color(); im.getColorAt(0, c); const h = {}; c.getHSL(h); const M4 = new THREE.Matrix4(), p = new THREE.Vector3(); im.getMatrixAt(0, M4); p.setFromMatrixPosition(M4); return { n: im.count, hue: Math.round(h.h * 360), zc: Math.round(((p.z - 0) / V3.exag + V3.zmin) * 10) / 10 }; };
        const a = look(); z.bois.tex = 'vert'; const b = look(); shapes = keepS; invalidateCache(); saveState();
        return { many: a.n > 12, photo: a.hue > 280 && a.hue < 320, vert: b.hue > 80 && b.hue < 130, centre: a.zc > 107 && a.zc < 111, plan: !isPlateforme(z) }; });
    t.eq('zone boisée en 3D : houppiers posés sur le sol, couleur de la photo du fond, ou verts au choix', zb, { many: true, photo: true, vert: true, centre: true, plan: true });
    // outil Zone boisée de la palette Topo : contour cliqué, fermé sur le 1er point → zone boisée sur le calque « Zones boisées », sélectionnée
    const bt0 = await ev(() => { if (is3DOpen()) close3D(); if (layoutOn) toggleLayout(false); window.__keepB = shapes; shapes = []; invalidateCache(); const m = mmToWorld(1000); camera.zoom = 15 / m; camera.x = 120; camera.y = 200; draw(); document.getElementById('btn-bois').click(); const c = canvas.getBoundingClientRect();
        return [[0, 0], [20, 0], [20, 15], [0, 15]].map(([x, y]) => { const q = worldToScreen(x * m, y * m); return { x: c.left + q.x, y: c.top + q.y }; }); });
    for (const q of bt0.concat([bt0[0]])) { await H.p.mouse.click(q.x, q.y); await H.wait(80); }
    const btz = await ev(() => { const z = shapes.find(x => x.bois), r = { made: !!z, n: z ? z.points.length : 0, lay: z ? (layers.find(l => l.id === z.layerId) || {}).name : null, sel: !!z && selectedShapes[0] === z, mode, alias: !!CMD_ALIASES.BOI }; shapes = window.__keepB; invalidateCache(); saveState(); return r; });
    t.eq('outil Zone boisée (palette Topo) : contour cliqué → zone boisée sélectionnée sur son calque', btz, { made: true, n: 4, lay: 'Zones boisées', sel: true, mode: 'select-box', alias: true });
    // sélection multiple béton + isolant, hauteur changée par Y : chacun garde son calque (donc sa hachure)
    const lay0 = await ev(() => shapes.slice(0, 2).map(x => x.layerId)); await ev(() => { selectedShapes = shapes.slice(0, 2); }); await H.Y({ 'sp-wzt': '3' });
    const lay1 = await ev(() => [shapes.slice(0, 2).map(x => x.layerId), shapes.slice(0, 2).map(x => x.wz.t)]);
    t.ok('sélection multiple (béton + isolant) : la hauteur change, chaque couche garde son calque', JSON.stringify(lay1[0]) === JSON.stringify(lay0) && lay1[1].every(v => v === 3000), JSON.stringify([lay0, lay1]));
    t.ok('ouverture : traverse tout le complexe de paroi (béton + isolant + placo)', Math.abs(opc.auto - 343) <= 2 && opc.cut3[0] === 1 && opc.cut3[1] === 1, JSON.stringify(opc));
    t.ok('ouverture étirée à la souris : ramenée au seul béton, l\'isolant n\'est plus percé', Math.abs(opc.manual - 205) <= 2 && opc.cutIso === 0, JSON.stringify(opc));
    t.ok('ouverture : poignées latérales sur le mur sélectionné, qui l\'étirent jusqu\'au placo', opc.nGrips === 2 && Math.abs(opc.grip - 344) <= 3 && opc.cutIso2 === 1, JSON.stringify(opc));

    // catalogue de textures : rangé par familles, chaque texture se dessine, les anciennes gardent leur nom de code
    const tx = await ev(() => { const bad = TEX_LIB.filter(t => { try { return !texCanvas(t.id) || !TEX_CATS.some(c => c[0] === t.cat); } catch (e) { return true; } }).map(t => t.id);
        return { n: TEX_LIB.length, bad, empty: TEX_CATS.filter(([k]) => !TEX_LIB.some(t => t.cat === k)).map(c => c[0]), old: ['beton', 'enduit', 'brique', 'parpaing', 'pierre', 'bois', 'enrobe', 'paves', 'terre', 'pelouse', 'gnt', 'gravier', 'tuile', 'ardoise', 'metal', 'carrelage', 'verre', 'eau'].filter(id => !TEX_LIB.some(t => t.id === id)) }; });
    t.ok('textures : plus de 60, rangées en catalogues, toutes dessinables, anciennes conservées', tx.n >= 60 && !tx.bad.length && !tx.empty.length && !tx.old.length, JSON.stringify(tx));
    /* pierres brutes et pisé : dessinées (pas de photo), contrastées (pierres claires sur mortier gris ; lits ocre), raccord sans couture d'un bord à l'autre */
    const tx2 = await ev(() => { const r = {}; ['pierre-brute', 'pise'].forEach(id => { const T = TEX_LIB.find(t => t.id === id), cv = texCanvas(id), d = cv.getContext('2d').getImageData(0, 0, 256, 256).data, L = (x, y) => { const k = (y * 256 + x) * 4; return (d[k] + d[k + 1] + d[k + 2]) / 3; };
        let mn = 255, mx = 0, R = 0, G = 0, edge = 0, inner = 0; for (let k = 0; k < d.length; k += 4) { const l = (d[k] + d[k + 1] + d[k + 2]) / 3; mn = Math.min(mn, l); mx = Math.max(mx, l); R += d[k]; G += d[k + 2]; }
        for (let y = 0; y < 256; y++) { edge += Math.abs(L(0, y) - L(255, y)) + Math.abs(L(y, 0) - L(y, 255)); inner += Math.abs(L(127, y) - L(128, y)) + Math.abs(L(y, 127) - L(y, 128)); }
        r[id] = { cat: T && T.cat, contrast: mx - mn > 90, warm: R > G * 1.15, seam: edge < inner * 2.5 + 2000 }; }); return r; });
    t.eq('textures pierres brutes jointoyées et pisé : maçonnerie, contrastées, chaudes, sans couture', tx2, { 'pierre-brute': { cat: 'maconnerie', contrast: true, warm: true, seam: true }, pise: { cat: 'maconnerie', contrast: true, warm: true, seam: true } });

    // toit terrasse : dalle plane avec casquette, acrotère, forme de pente vers le côté d'évacuation (la dalle ne s'incline pas), flèche de pente cotée
    const tr = await ev(() => { shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 0 }));
        const base = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 10, 6) }; shapes.push(base); roofDialog(base, true); document.querySelector('input[name=rf-p][value="0"]').click();
        const set = (id, v) => { document.getElementById(id).value = v; }; set('rf-ht', '3,25'); set('rf-te', '0,25'); set('rf-tc', '0,5'); set('rf-ah', '0,6'); set('rf-at', '0,2'); set('rf-fp', '2'); set('rf-fe', '0,05'); document.getElementById('rf-tg').value = '0';
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click();
        const slab = shapes.find(x => x.name === 'Dalle de toit'), acro = shapes.find(x => x.name === 'Acrotère'), fp = shapes.find(x => x.name === 'Forme de pente'), sl = shapes.find(x => x.type === 'slope');
        const xs = slab.points.map(q => q.x / m), flat = slab.points.every(q => q.z === slab.points[0].z);
        const v = meshStore[fp.meshId]; let zmin = 1e9, zmax = -1e9; for (let i = 2; i < v.length; i += 3) { zmin = Math.min(zmin, v[i]); zmax = Math.max(zmax, v[i]); }
        const ax = acro.points.map(q => q.x / m); return { aw: Math.round((Math.max(...ax) - Math.min(...ax)) * 100) / 100, w: Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100, flat, zSlab: slab.points[0].z + slab.solid.H, acroH: acro.solid.H, holes: acro.solid.holes.length, fpBase: fp.z0, fpRise: Math.round(zmax - zmin), slope: sl ? Math.round(Math.abs(slopePct(sl)) * 100) / 100 : null }; });
    t.ok('toit terrasse : dalle plane avec casquette, acrotère dans l\'alignement des murs, forme de pente à 2 % vers l\'évacuation', tr.w === 11 && tr.aw === 10 && tr.flat && tr.zSlab === 3250 && tr.acroH === 600 && tr.holes === 1 && tr.fpBase === 3250 && tr.fpRise > 330 && tr.fpRise < 380 && tr.slope === 2, JSON.stringify(tr));

    // arête « paroi » d'une plateforme : un voile béton fin en 3D
    const par = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [null, null, { off: true }, null] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) });
        invalidateCache(); tinCache = null; saveState(); if (!V3) init3D(); build3DScene(); let n = 0; V3.root.traverse(o => { if (o.userData.paroi) n++; }); return n; });
    t.ok('paroi : voile béton dessiné en 3D', par === 1, par);
    // terrasses étagées avec paroi : le voile tient toute la marche (de la plateforme basse à la haute), sans dents de scie
    const st2 = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 14; i++) for (let j = 0; j <= 14; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + j * 600, zk: 1 });
        const P = (y0, y1, z, off) => ({ type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: !!off, edges: off }, points: [[10, y0], [60, y0], [60, y1], [10, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z })) });
        shapes.push(P(40, 55, 105500, [{ off: true }, null, null, null]), P(25, 40, 103000, null)); invalidateCache(); tinCache = null; saveState(); build3DScene();
        let zl = 1e9, zh = -1e9; V3.root.traverse(o => { if (!o.userData.paroi) return; const a = o.geometry.attributes.position.array; for (let i = 2; i < a.length; i += 3) { zl = Math.min(zl, a[i]); zh = Math.max(zh, a[i]); } });
        return { lo: Math.round((zl / V3.exag + V3.zmin) * 100) / 100, hi: Math.round((zh / V3.exag + V3.zmin) * 100) / 100 }; });
    t.ok('paroi entre terrasses : voile de 102,70 à 105,65', Math.abs(st2.lo - 102.7) < 0.05 && Math.abs(st2.hi - 105.65) < 0.05, JSON.stringify(st2));
    // parois sur deux arêtes voisines : un seul voile continu (angle fermé), arase horizontale même si le terrain monte ; le talus voisin tourne l'angle et revient le long de la paroi ; la paroi se peint
    const pc = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [null, null, { off: true }, { off: true }] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 98000 })) };
        shapes.push(pl); invalidateCache(); tinCache = null; saveState(); build3DScene();
        let n = 0, tops = new Set(), mesh = null; V3.root.traverse(o => { if (!o.userData.paroi) return; n++; mesh = o; o.geometry.computeBoundingBox(); });
        const a = mesh.geometry.attributes.position.array, zt = mesh.geometry.boundingBox.max.z; let caps = 0; const hi = new Set();
        for (let i = 2; i < a.length; i += 3) if (a[i] > zt - 1.5) hi.add(Math.round(a[i] * 1000));
        // faces d'extrémité (triangles de moins de 25 cm d'emprise) : seulement aux deux bouts de la suite, aucune à l'angle
        for (let i = 0; i + 8 < a.length; i += 9) { const xs = [a[i], a[i + 3], a[i + 6]], ys = [a[i + 1], a[i + 4], a[i + 7]]; if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 0.25) caps++; }
        const FM = finishedModel(), r = FM.at(mmToWorld(19000), -mmToWorld(16000));   // devant la paroi ouest, près de l'angle avec le talus nord
        texPaint = { kind: 'paint', tex: 'brique' }; paroiPaint(pl); texPaint = null; build3DScene(); let tex = false; V3.root.traverse(o => { if (o.userData.paroi && o.material && o.material.map) tex = true; });
        return { n, caps, flat: hi.size === 1, cone: r && r.kind === 3 && r.gov === 0, paint: pl.paroiTex === 'brique' && tex }; });
    t.eq('parois en angle : un voile continu (2 bouts seulement), arase horizontale malgré le terrain en pente', [pc.n, pc.caps, pc.flat], [1, 4, true]);
    t.ok('talus voisin d\'une paroi : il tourne l\'angle et revient le long du voile', pc.cone, JSON.stringify(pc));
    t.ok('paroi repeinte (Peindre) : texture posée sur le voile', pc.paint, JSON.stringify(pc));
    // réglage UNIFORME (fenêtre Y) : un seul interrupteur Paroi pour tout le contour (désignation et épaisseur communes)
    await ev(() => { const pl = shapes.find(x => x.talus); pl.talus = { on: true, kD: '1/1', kR: '3/2' }; selectedShapes = [pl]; saveState(); });
    await H.Y({ 'tj-uoffall': true, 'tj-upl': 'Mur', 'tj-upe': '0,30' });
    const pu = await ev(() => { const pl = shapes.find(x => x.talus); tinCache = null; invalidateCache(); build3DScene(); let n = 0; V3.root.traverse(o => { if (o.userData.paroi) n++; }); return { cx: !!pl.talus.cx, off: (pl.talus.edges || []).map(e => !!(e && e.off && e.pl === 'Mur' && e.pe === 300)), n }; });
    t.ok('paroi en réglage uniforme : tout le contour en paroi (un interrupteur), voile béton en 3D', !pu.cx && pu.off.every(Boolean) && pu.n === 1, JSON.stringify(pu));
    // arête de talus en escalier (réglage par arête) : marches de 16 × 30 cm, pente du talus = giron / hauteur, nez de marche dessinés en plan, marches en 3D
    await ev(() => { const pl = shapes.find(x => x.talus); pl.talus = { on: true, kD: '1/1', kR: '3/2', cx: true }; selectedShapes = [pl]; saveState(); });
    await H.Y({ 'tj-st-2': true, 'tj-sth-2': '16', 'tj-stg-2': '30', 'tj-stn-2': '3' });
    const ts = await ev(() => { const pl = shapes.find(x => x.talus), e = (pl.talus.edges || [])[2] || {}; tinCache = null; invalidateCache(); const G = talusGeom(pl), S = (G.stairs || [])[0];
        const ns = S ? Math.max(...S.pieces.map(p => p.Ns)) : 0, runs = S ? talStairRuns(S).length : 0; build3DScene(); let n = 0; V3.root.traverse(o => { if (o.userData.talStair) n++; });
        // une ligne de nez = un trait par marche ; l'arête voisine (sans escalier) garde son talus 1/1
        const FM = finishedModel(), r = FM.at(mmToWorld(19500), -mmToWorld(20000)); selectedShapes = [pl]; openSelectionParamModal(); const sum = document.querySelectorAll('.tal-j .tal-sm')[2].textContent; closeSelectionParamModal();
        return { st: e.st, k: e.kD, ns, runs, n, kind: r && r.kind, sum, dec: talusK('1,5/0,5') }; });
    t.ok('talus en escalier : réglage gardé, pente 0,3/0,16, marches entières jusqu\'au pied, nez en plan et marches en 3D', ts.st && ts.st.h === 160 && ts.st.g === 300 && ts.st.nez === 30 && ts.k === '0,3/0,16' && ts.dec === 3 && ts.ns >= 20 && ts.runs >= 6 && ts.n === 1 && /escalier 16,0 × 30,0 cm/.test(ts.sum), JSON.stringify(ts));
    // escalier entre deux parois : pas de refoulement de terre aux bouts (coupé net) ; clic droit sur le sommet → tirette de la limite de refoulement
    const rf = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [null, { off: true }, { st: { h: 160, g: 300 }, kD: '0,3/0,16', kR: '0,3/0,16' }, { off: true }] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) };
        shapes.push(pl); invalidateCache(); tinCache = null; saveState();
        const k = (x, y) => { const r = finishedModel().at(x * m, -y * m); return r ? r.kind : null; };
        const net = [k(40.5, 25.5), k(30, 26)];
        const hit = refoulAt({ x: 40 * m + 2 / camera.zoom, y: -25 * m }); refoulPanel(pl, 2); const rg = document.getElementById('rf-rg'); rg.value = 180; rg.oninput(); const full = k(40.5, 25.5);
        document.getElementById('rf-ok').click(); const kept = pl.talus.corn && pl.talus.corn[2] === null;
        return { net, hit: hit && hit.k, full, kept, auto: (() => { delete pl.talus.corn; invalidateCache(); return k(40.5, 25.5); })() }; });
    t.ok('escalier entre parois : talus coupé net aux bouts, tirette de refoulement au clic droit (180° = tour complet)', rf.net[0] === 0 && rf.net[1] === 3 && rf.hit === 2 && rf.full === 3 && rf.kept && rf.auto === 0, JSON.stringify(rf));

    // toiture à pans : fenêtre à chapitres, complexe couche par couche (épaisseur = somme), textures posées à la main et gardées à la modification
    const rc = await ev(() => { shapes = []; const m = mmToWorld(1000); const base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, 6], [0, 6]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 0 })) }; shapes.push(base);
        roofDialog(base, true); document.querySelector('input[name=rf-p][value="2"]').click(); const tabs = document.querySelectorAll('#tm-strip button').length, noTex = !document.getElementById('rf-tex') && !document.getElementById('rf-texu');
        rfCx.p = [{ t: 'couverture', e: 3 }, { t: 'chevrons', e: 8, ent: 60 }, { t: 'isolation', e: 20 }, { t: 'parevapeur', e: 0.1 }]; rfCxDraw('p');
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click();
        const pan = shapes.find(x => x.solid && x.solid.kind === 'roof'), e1 = pan.solid.e; shapes.filter(x => x.solid && x.solid.kind === 'roof').forEach(x => { x.tex = 'ardoise'; });
        roofEdit(pan.groupId); [...document.querySelectorAll('#tm-actions button')].find(b => /Mettre à jour/.test(b.textContent)).click();
        const pans2 = shapes.filter(x => x.solid && x.solid.kind === 'roof'); return { tabs, noTex, e1, tex: pans2.map(x => x.tex), cx: (pans2[0].roofDef.o.cxP || []).length }; });
    t.ok('toiture : chapitres, pas de texture dans la fenêtre, épaisseur = complexe (31,1 cm), textures gardées à la modification', rc.tabs >= 3 && rc.noTex && Math.abs(rc.e1 - 311) < 1 && rc.tex.every(x => x === 'ardoise') && rc.cx === 4, JSON.stringify(rc));

    // une paroi n'est pas du terrain : sa ligne cotée ne modifie ni le MNT ni les talus
    await ev(() => { shapes.forEach(s => { if (s.wallMat && s.type === 'line') { s.z1 = 99999; s.z2 = 99999; } }); tinCache = null; invalidateCache(); });
    t.ok('paroi exclue du terrain naturel', await ev(() => tinNodes().every(n => n.z !== 99999)));

    // une longue paroi en béton vue de loin se dessine vite (motif réduit à ce qui se voit)
    const ms = await ev(() => { const m = mmToWorld(1000), w = { type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [[{ x: 0, y: 0 }, { x: 500 * m, y: 0 }, { x: 500 * m, y: -0.2 * m }, { x: 0, y: -0.2 * m }]] };
        shapes.push(w); camera.zoom = 2 / m; const a = performance.now(); for (let i = 0; i < 3; i++) { invalidateCache(); draw(); } shapes.pop(); invalidateCache(); return (performance.now() - a) / 3; });
    t.ok('paroi de 500 m en béton : dessin rapide', ms < 400, Math.round(ms) + ' ms');
    // parois en contact : elles se fondent (un seul contour, aucune hachure superposée), et accroche sur l'axe et les faces
    const fu = await ev(async () => { shapes = []; camera.zoom = 1; const M = mmToWorld, id = WALL_PRESETS[0].id;
        startWall(id); wallStart = { x: 0, y: 0 }; wallAddTo(M(5000), 0); setMode('select-box'); await new Promise(r => setTimeout(r, 400));
        startWall(id); const sf = findSnap(M(1700), M(-1)), sa = findSnap(M(2501), M(-99)), sn = sf && sf.face && sa && sa.axis ? sf : null; wallStart = { x: M(2500), y: M(-100) }; wallAddTo(M(2500), M(-3000)); setMode('select-box'); await new Promise(r => setTimeout(r, 800));
        const Hh = shapes.filter(isWallHatch); await loadPolyClip(); const poly = h => h.loops.map(l => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; });
        let sum = 0; Hh.forEach(h => sum += Math.abs(polyArea(h.loops[0]))); const U = polygonClipping.union(...Hh.map(poly)); let ua = 0; U.forEach(pg => ua += Math.abs(polyArea(pg[0].slice(0, -1).map(([x, y]) => ({ x, y })))));
        const r = { groups: new Set(Hh.map(h => h.groupId)).size, over: Math.round((sum - ua) / M(1) / M(1)), lines: shapes.filter(x => x.type === 'line' && x.wallMat).length, snap: !!(sn && (sn.axis || sn.face)) }; if (!r.snap) r.dbg = JSON.stringify([sf, sa, typeof view2D !== "undefined" ? view2D : null]); shapes = []; saveState(); return r; });
    t.eq('deux parois en T : fondues en un seul mur, sans chevauchement ni trait à la jonction', fu, { groups: 1, over: 0, lines: 8, snap: true });
    const fm = await ev(async () => { shapes = []; camera.zoom = 1; const M = mmToWorld, b = WALL_PRESETS.find(w => w.id === 'w-beton20').id, i = 'w-laine100';   /* type retiré : repris par l'isolant à 100 mm */
        startWall(b); wallStart = { x: 0, y: 0 }; wallAddTo(M(5000), 0); setMode('select-box'); await new Promise(r => setTimeout(r, 400));
        startWall(i); wallStart = { x: M(2500), y: M(1000) }; wallAddTo(M(2500), M(-3000)); setMode('select-box'); await new Promise(r => setTimeout(r, 800));
        const Hh = shapes.filter(isWallHatch); await loadPolyClip(); const poly = h => h.loops.map(l => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; });
        const B = Hh.filter(h => h.wallMat === 'beton'), I = Hh.filter(h => h.wallMat !== 'beton'); let ia = 0;
        polygonClipping.intersection(polygonClipping.union(...B.map(poly)), polygonClipping.union(...I.map(poly))).forEach(pg => ia += Math.abs(polyArea(pg[0].slice(0, -1).map(([x, y]) => ({ x, y })))));
        const r = [B.length, I.length, Math.round(ia / M(1) / M(1))]; shapes = []; saveState(); return r; });
    t.eq('isolant tracé à travers un voile béton : coupé en deux, plus aucune superposition', fm, [1, 2, 0]);
    // toiture sur un quadrilatère quelconque : faîtage à égale distance des deux égouts, même pente des deux côtés
    const tq = await ev(() => { const M = mmToWorld, base = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [8000, 0], [7000, 5000], [1000, 4000]].map(([x, y]) => ({ x: M(x), y: -M(y), z: 0 })) };
        const pans = buildRoof(base, Object.assign({}, roofLast, { pans: 2, dir: 'long', he: 2.5, hf: 5, db: 0, fill: false })).filter(x => x.solid && x.solid.kind === 'roof');
        const a = roofRise(pans[0]), b = roofRise(pans[1]); return [pans.length, Math.round(a[2] - b[1]), Math.round(a[3] - b[0]), Math.round(Math.max(...a)), Math.round(pans[0].solid.p - pans[1].solid.p)]; });
    t.eq('toiture 2 pans sur un trapèze : faîtage continu, même pente, sommet au faîtage', tq, [2, 0, 0, 2500, 0]);
    const tp = await ev(() => { shapes = []; camera.zoom = 50 / mmToWorld(1000); camera.x = 300; camera.y = 500; startSolidTool('roof'); return [mode, solidTool]; });
    t.eq('outil Toiture : contour libre point par point', tp, ['poly', 'roof']);
    const W2 = await ev(() => [[1, 1], [7, 1], [7, 3], [3, 3], [3, 6], [1, 6], [1, 1]].map(([x, y]) => { const q = worldToScreen(mmToWorld(x * 1000), -mmToWorld(y * 1000)), c = canvas.getBoundingClientRect(); return { x: q.x + c.left, y: q.y + c.top }; }));
    for (const q of W2.slice(0, 4)) await H.click(q); await H.wait(200); const open4 = await ev(() => isDrawing);
    for (const q of W2.slice(4)) await H.click(q); await H.wait(300);
    const tc = await ev(() => { const P = shapes.find(x => x.type === 'poly'); const m = !!document.querySelector('#topo-modal') && /Toiture/.test(document.querySelector('#topo-modal').textContent), multi = !!document.querySelector('.rf-card input[value="4"]:not([disabled])'); closeTopoModal && closeTopoModal(); return [P ? P.points.length : 0, m, multi, isDrawing]; });
    t.eq('toiture : contour d\'autant de sommets qu\'il faut (pas fermé au 4e), refermé sur le 1er point, fenêtre avec Pans multiples', [open4].concat(tc), [true, 6, true, true, false]);
    // vue 3D : Y ouvre les réglages de l'objet cliqué (au-dessus de la 3D) ; double-clic sur une menuiserie : fenêtre Ouverture
    await ev(t => { loadProjectText(t, 'cabane.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'cabane.mmc'), 'utf8')); await H.wait(400);
    await ev(async () => { await open3D(); }); await H.wait(1500);
    const y3 = await ev(() => { const w = shapes.find(isWallHatch); selectedShapes = [w]; V3.pickOp = null; v3ParamSel(); const m = document.getElementById('selparam-modal'), r = [!m.classList.contains('hidden'), +getComputedStyle(m).zIndex > +getComputedStyle(document.getElementById('view3d')).zIndex];
        m.classList.add('hidden');
        const host = shapes.find(x => (x.openings || []).length), o = host.openings[0]; let tagged = 0; V3.root.traverse(x => { if (x.userData.opening === o) tagged++; });
        selectedShapes = [host]; V3.pickOp = { host, o }; v3ParamSel(); const op = document.getElementById('topo-modal').style.display !== 'none' && /Ouverture/.test(document.getElementById('topo-modal').textContent); closeTopoModal(); return r.concat([tagged > 0, op]); });
    t.eq('vue 3D : Y ouvre les réglages par-dessus la 3D ; menuiserie cliquée → fenêtre Ouverture', y3, [true, true, true, true]);
    // vue Momo : une porte s'ouvre (E ou clic) sur ses gonds, de 90°, du côté opposé à Momo, et se referme
    const dr = await ev(async () => { let pv = null; V3.root.traverse(x => { if (x.userData.door && !x.userData.door.slide && !pv) pv = x; }); if (!pv) return { leaf: false };
        const a0 = pv.userData.door.a0, leaf = pv.children[0], c = new THREE.Box3().setFromObject(leaf).getCenter(new THREE.Vector3()), nx = -Math.sin(a0), ny = Math.cos(a0);
        const rp = V3.root.position, wx = mmToWorld((c.x + nx * 1.5 - rp.x) * 1000), wy = -mmToWorld((c.y + ny * 1.5 - rp.y) * 1000); await momoFPS({ w: { x: wx, y: wy } });
        const F = V3.fps; F.pos.z = c.z; F.yaw = Math.atan2(c.x - F.pos.x, c.y - F.pos.y); F.pitch = 0; const ok = fpsDoor(); for (let i = 0; i < 12; i++) fpsStep(0.1); const turned = Math.abs(Math.abs(pv.rotation.z - a0) - Math.PI / 2) < 1e-3;
        const side = (F.pos.x - pv.position.x) * nx + (F.pos.y - pv.position.y) * ny, away = Math.sign(pv.rotation.z - a0) === (side > 0 ? -1 : 1);
        fpsDoor(); for (let i = 0; i < 12; i++) fpsStep(0.1); const closed = Math.abs(pv.rotation.z - a0) < 1e-3; V3.fps.back = { az: V3.az, el: V3.el, dist: V3.dist, t: V3.target.clone() }; fpsStop(); return { leaf: true, ok, turned, away, closed }; });
    t.eq('vue Momo : la porte s\'ouvre de 90° sur ses gonds, côté opposé, et se referme', dr, { leaf: true, ok: true, turned: true, away: true, closed: true });
    // pinceau : un coup de pinceau à la souris dans la vue 3D, posé en couche transparente sur la surface touchée, sans devenir du terrain
    await ev(async () => { await startBrush(); brushChoose('galets'); brushSet('d', 1); brushSet('h', 50); });
    const R3 = await ev(() => { V3.az = Math.PI * 1.25; V3.el = 0.7; render3D(); const c = V3.renderer.domElement.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });
    await p.mouse.move(R3.x - 40, R3.y); await p.mouse.down(); for (let i = 1; i <= 4; i++) await p.mouse.move(R3.x - 40 + i * 20, R3.y); await p.mouse.up(); await H.wait(500);
    const br = await ev(() => { const S = shapes.filter(s => s.brush); let ov = 0; V3.root.traverse(o => { if (o.userData.brushOv) ov++; });
        const r = { n: S.length, pts: S.length ? S[0].points.length > 1 : false, tex: S.length ? S[0].brush.tex : null, ov: ov > 0, notTerrain: !S.some(isPlateforme) && !tinNodes().some(nd => S.some(s => s.points.some(q => q.x === nd.x && q.y === nd.y))) };
        brushStop(true); undo(); r.undo = !shapes.some(s => s.brush); return r; });
    t.eq('pinceau : un coup posé en 3D (motif galets), affiché en couche, annulable', br, { n: 1, pts: true, tex: 'galets', ov: true, notTerrain: true, undo: true });
    await ev(() => close3D());
    // en plan : le coup de pinceau est une bande hachurée de la largeur du pinceau, sur le calque Pinceau
    const bp = await ev(() => { const m = mmToWorld(1000); camera.zoom = 60 / m; camera.x = 200; camera.y = 400;
        const snap = () => { invalidateCache(); draw(); return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; };
        shapes = []; const A = snap(); shapes.push({ type: 'poly', open: true, layerId: brushLayer(), points: [{ x: 0, y: 0 }, { x: 6 * m, y: 0 }], width: 1, hatch: false, name: 'Pinceau', brush: { tex: 'galets', d: 1000, h: 0.5, top: true, zs: [0, 0] } }); const B = snap();
        // pixels changés : dans la bande (1 m = 60 px de large), et rien au-delà
        const dpr = canvas.width / canvas.getBoundingClientRect().width; let inB = 0, outB = 0; const wy = worldToScreen(0, 0).y * dpr, half = 30 * dpr;
        for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) { const k = (y * canvas.width + x) * 4; if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 30) { if (Math.abs(y - wy) <= half + 3 * dpr) inB++; else outB++; } }
        const L = layers.find(l => l.id === shapes[0].layerId); shapes = []; saveState(); return { layer: L && L.name, hatch: inB > 200, clear: outB < 20 }; });
    t.eq('pinceau en plan : bande hachurée sur le calque Pinceau', bp, { layer: 'Pinceau', hatch: true, clear: true });
    // villa (projet réel) : un talus ne revient jamais sur une autre plateforme ; un remblai se pose sur le déblai voisin (pas de falaise) ; toits : pas de cadre fantôme en plan
    await ev(t => { loadProjectText(t, 'villa.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'villa.mmc'), 'utf8')); await H.wait(600);
    const vl = await ev(() => { const FM = finishedModel(), M = (x, y) => FM.at(mmToWorld(x * 1000), -mmToWorld(y * 1000)), a = M(661, 631), b = M(657.8, 628.5); return { over: (a.kind === 4 && a.z > 457600) || (a.kind === 1 && a.gov === 1), fill: b.z > 459300 }; });
    t.eq('plateformes voisines : talus modélisés ensemble (celui du dessus reste), remblai continu sur le déblai voisin', vl, { over: true, fill: true });
    const ph = await ev(() => { const m = mmToWorld(1000), base = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 0 })) };
        const out = buildRoof(base, Object.assign({}, roofLast, { pans: 2, dir: 'long', he: 2.5, hf: 5, db: 0, fill: true })), pg = out.find(x => x.type === 'mesh');
        const keep = shapes; shapes = []; camera.zoom = 40 / m; camera.x = 100; camera.y = 500; invalidateCache(); draw(); const A = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.slice();
        shapes = [pg]; invalidateCache(); draw(); const B = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let d = 0; for (let i = 0; i < A.length; i += 16) if (A[i] !== B[i]) d++; shapes = keep; invalidateCache(); draw(); return { pignons: !!pg && pg.roofPart === 1, drawn: d }; });
    t.eq('toiture en plan : les pignons ne laissent aucun cadre fantôme', ph, { pignons: true, drawn: 0 });
    const th = await ev(() => { const m = mmToWorld(1000), base = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 455000 })) }; roofDialog(base, true);
        const r = document.getElementById('rf-thr'), h = document.getElementById('rf-ht'); if (!r || !h) { closeTopoModal(); return null; } r.value = '3,50'; r.dispatchEvent(new Event('input')); const v = h.value; closeTopoModal(); return v; });
    t.eq('toit terrasse : champ Hauteur du toit (depuis le pied des murs) qui règle le dessus de dalle', th, '458,50');
    // étages : RDC + TOIT au départ ; ▲ + crée R + 1 ; un mur tracé sur R + 1 y est rangé à sa hauteur ; sur le RDC, R + 1 et le toit sont masqués (plan et 3D) ; outil éteint : tout est visible
    await ev(t => { loadProjectText(t, 'cabane.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'cabane.mmc'), 'utf8')); await H.wait(400);
    const lv = await ev(async () => { const o = {}; lvlToggle(); o.start = lvlList().map(lvlName); o.box = getComputedStyle(document.getElementById('lvl-box')).display; lvlAdd(true); o.added = lvlList().map(lvlName);
        const M = mmToWorld; startWall('w-beton20'); wallStart = { x: M(7000), y: -M(1000) }; wallAddTo(M(12000), -M(1000)); setMode('select-box'); await new Promise(r => setTimeout(r, 500));
        const w = shapes.filter(isWallHatch).find(h => h.lvl && h.lvl !== 'rdc'), roof = shapes.find(x => x.roofDef); o.wall = !!w && w.wz.b === lvls[0].z + lvls[0].h;
        lvlPick('rdc'); await open3D(); await new Promise(r => setTimeout(r, 800)); let inScene = false, roofIn = false; V3.root.traverse(x => { if (x.userData.shape === w) inScene = true; if (x.userData.shape === roof) roofIn = true; });
        o.rdc = [lvlHidden(w), lvlHidden(roof), inScene, roofIn]; lvlToggle(false); o.off = [lvlHidden(w), lvlHidden(roof), getComputedStyle(document.getElementById('lvl-box')).display]; close3D(); return o; });
    t.eq('étages : niveaux, mur rangé sur son étage, étages du dessus masqués en plan, toujours là en 3D', lv, { start: ['RDC', 'TOIT'], box: 'block', added: ['RDC', 'R + 1', 'TOIT'], wall: true, rdc: [true, true, true, true], off: [false, false, 'none'] });
    // étages calés sur le RDC : la cote du RDC est le zéro, chaque étage posé sur celui du dessous (+ H) ; un mur tracé sur un étage va de son plancher à plancher + H ;
    // changer la cote du RDC ou une hauteur déplace les étages au-dessus et leurs murs ; une dalle tracée sur l'étage a son dessus au plancher
    const lc = await ev(async () => { const keepS = shapes, keepL = lvls; shapes = []; lvls = null; saveState(); lvlToggle(true); lvlSet('rdc', 69000, 3000); lvlAdd(true); lvlAdd(true); const S = lvlSorted(), o = { z0: S.map(L => L.z), rel: S.map(lvlRel) };
        const M = mmToWorld; lvlPick(S[1].id); startWall('w-beton20'); wallStart = { x: M(0), y: 0 }; wallAddTo(M(5000), 0); setMode('select-box'); await new Promise(r => setTimeout(r, 300));
        const w = shapes.filter(isWallHatch).find(h => h.lvl === S[1].id); o.wall = w ? [w.wz.b, w.wz.t] : null;
        lvlSet('rdc', 70000); o.z1 = lvlSorted().map(L => L.z); o.wall1 = w ? [w.wz.b, w.wz.t] : null;
        lvlSet('rdc', undefined, 3500); o.z2 = lvlSorted().map(L => L.z); o.wall2 = w ? [w.wz.b, w.wz.t] : null;
        lvlSet(S[1].id, undefined, 2500); o.z3 = lvlSorted().map(L => L.z); o.wall3 = w ? [w.wz.b, w.wz.t] : null;
        const ss = lvlAdd(false); o.ss = lvlSorted()[0].z; o.ssRel = lvlRel(lvlSorted()[0]); lvlToggle(false); shapes = keepS; lvls = keepL; invalidateCache(); saveState(); return o; });
    t.eq('étages calés sur le RDC : plancher = RDC + hauteurs, murs du plancher au plancher + H, tout suit la cote du RDC', lc, { z0: [69000, 72000, 75000], rel: ['±0,00', '+3,00', '+6,00'], wall: [72000, 75000],
        z1: [70000, 73000, 76000], wall1: [73000, 76000], z2: [70000, 73500, 76500], wall2: [73500, 76500], z3: [70000, 73500, 76000], wall3: [73500, 76000], ss: 66500, ssRel: '−3,50' });
    // toit à pans multiples sur un contour en L (6 côtés) : un pan par côté (croupes), même pente, faîtage au point le plus haut ;
    // avec deux pignons aux bouts des ailes : 4 pans et des murs pignons ; la fenêtre propose « Pans multiples » et ses réglages par côté
    const rm = await ev(async () => { const m = mmToWorld(1000), L = [[0, 0], [10, 0], [10, -4], [4, -4], [4, -10], [0, -10]], base = () => ({ type: 'poly', layerId: activeLayerId, points: L.map(([x, y]) => ({ x: x * m, y: y * m, z: 100000 })) });
        const o = { pans: 4, he: 103, hf: 105, e: 0.2, ge: 0.2, fill: true, db: 0 }, A = buildRoof(base(), o), roofs = A.filter(x => x.solid && x.solid.kind === 'roof');
        const top = Math.max(...roofs.map(r => Math.max(...roofRise(r)))), area = (F) => Math.abs(F.reduce((a, q, i) => { const r = F[(i + 1) % F.length]; return a + q.x * r.y - r.x * q.y; }, 0) / 2) / (m * m);
        const B = buildRoof(base(), Object.assign({}, o, { gab: [false, true, false, false, true, false] })), rB = B.filter(x => x.solid && x.solid.kind === 'roof');
        const C = buildRoof(base(), Object.assign({}, o, { db: 0.5 })), rC = C.filter(x => x.solid && x.solid.kind === 'roof');
        roofDialog(base(), true); const card = !!document.querySelector('.rf-card input[value="4"]:not([disabled])'), sel = !!document.getElementById('rf-gb-5'); closeTopoModal();
        return { n: roofs.length, p: Math.round(roofs[0].solid.p), top: Math.round(top), area: Math.round(roofs.reduce((a, r) => a + area(r.points), 0)), nB: rB.length, pignons: !!B.find(x => x.name === 'Pignons'), areaB: Math.round(rB.reduce((a, r) => a + area(r.points), 0)), nC: rC.length, areaC: Math.round(rC.reduce((a, r) => a + area(r.points), 0)), card, sel }; });
    t.eq('toit à pans multiples sur un L : croupes (6 pans, pente 100 %), ou pignons aux bouts (4 pans + pignons), débord, fenêtre', rm, { n: 6, p: 100, top: 2000, area: 64, nB: 4, pignons: true, areaB: 64, nC: 6, areaC: 85, card: true, sel: true });
    /* débords côté par côté (onglet Débords) : chaque pan garde son plan (même hauteur sur les murs), s'avance jusqu'au contour décalé côté par côté sans trou ni recouvrement,
       le faîtage ne bouge pas ; toit terrasse : casquette côté par côté ; la fenêtre a l'onglet, une case par côté, et garde les valeurs */
    const rdb = await ev(async () => { const m = mmToWorld(1000), base = () => ({ type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 100000 })) });
        const area = (F) => Math.abs(F.reduce((a, q, i) => { const r = F[(i + 1) % F.length]; return a + q.x * r.y - r.x * q.y; }, 0) / 2) / (m * m), RF = (A) => A.filter(x => x.solid && x.solid.kind === 'roof');
        const hAt = (pn, q) => { const P = pn.points, n = P.length, e = pn.solid.eg, a = P[e], b = P[(e + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, c = polyCentroid(P), sg = Math.sign((c.x - a.x) * nx + (c.y - a.y) * ny) || 1;
            return P[0].z + Math.max(0, worldToMm(((q.x - a.x) * nx + (q.y - a.y) * ny) * sg)) * pn.solid.p / 100; };
        const same = (A0, A1) => RF(A0).every(r => { const c = polyCentroid(r.points), r1 = RF(A1).find(x => pointInPolygon(c.x, c.y, x.points)); return r1 && Math.abs(hAt(r, c) - hAt(r1, c)) < 1; });
        const top = (A) => Math.round(Math.max(...RF(A).map(r => r.points[0].z + Math.max(...roofRise(r)))));
        const o4 = { pans: 4, he: 103, hf: 105, e: 0.2, ge: 0.2, fill: false, db: 0 }, H0 = buildRoof(base(), o4), H1 = buildRoof(base(), Object.assign({}, o4, { dbE: [1, 0, 0.5, 0.2] }));
        const o2 = { pans: 2, he: 103, hf: 105, e: 0.2, ge: 0.2, fill: false, db: 0, dir: 'long' }, G0 = buildRoof(base(), o2), G1 = buildRoof(base(), Object.assign({}, o2, { dbE: [0.8, 0, 0.3, 0] }));
        const T1 = buildTerrace(base(), { pans: 0, he: 103, te: 0.25, tc: 0.5, tcE: [0.5, 0, 0, 0], ah: 0, at: 0.2, fp: 0, fe: 0.05 }), slab = T1.find(x => x.name === 'Dalle de toit');
        roofDialog(base(), true); document.querySelector('input[name=rf-p][value="4"]').checked = true; rfSw(4); const nIn = document.querySelectorAll('#rf-deb input.tal-in').length, tab = !!document.querySelector('details[data-k="rf-deb"]');
        rfDebAll('0,3'); rfDebSet(0, '0,8'); const glob = document.getElementById('rf-db').value; [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click();
        const made = shapes.find(x => x.roofDef && x.roofDef.o.dbE), keep = made ? JSON.stringify(made.roofDef.o.dbE) : null, txt = made ? rfDebTxt(made.roofDef.o, 'db') : '';
        if (made) roofEdit(made.groupId); await new Promise(r => setTimeout(r, 60)); const back = [0, 1].map(i => (document.getElementById('rf-de-' + i) || {}).value); closeTopoModal(); if (made) shapes = shapes.filter(x => x.groupId !== made.groupId); selectedShapes = []; saveState(); draw();
        return { h4: { n: RF(H1).length, area: Math.round(RF(H1).reduce((a, r) => a + area(r.points), 0) * 10) / 10, planes: same(H0, H1), top: top(H1) },
            p2: { area: Math.round(RF(G1).reduce((a, r) => a + area(r.points), 0) * 10) / 10, planes: same(G0, G1), top: top(G1), eaves: RF(G1).map(r => Math.round(r.points[0].z)).sort() },
            terr: Math.round(area(slab.points) * 10) / 10, nIn, tab, glob, keep, txt, back }; });
    t.eq('débords côté par côté : pans prolongés sans trou (aire du contour décalé), même plan sur les murs, faîtage inchangé ; casquette côté par côté ; onglet Débords', rdb,
        { h4: { n: 4, area: 76.5, planes: true, top: 105000 }, p2: { area: 71, planes: true, top: 105000, eaves: [102467, 102800] }, terr: 65, nIn: 4, tab: true, glob: '', keep: '[0.8,0.3,0.3,0.3]', txt: 'de 0,30 à 0,80 m selon les côtés', back: ['0,80', '0,30'] });
    // pinceau allégé : la couche de peinture ne reprend que les triangles proches du coup, pas toute la surface
    const bo = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 600)); let big = null; V3.root.traverse(x => { if (x.isMesh && x.geometry && x.geometry.attributes.position && (!big || x.geometry.attributes.position.count > big.geometry.attributes.position.count) && !x.userData.brushOv) big = x; });
        const bb = new THREE.Box3().setFromObject(big), c = bb.getCenter(new THREE.Vector3()), cx = -V3.root.position.x, cy = -V3.root.position.y;
        const q = { x: mmToWorld((c.x + cx) * 1000), y: -mmToWorld((c.y + cy) * 1000) }, z = Math.round(((bb.max.z) / (V3.exag || 1) + (V3.zmin || 0)) * 1000);
        const s = { type: 'poly', open: true, layerId: brushLayer(), points: [q, { x: q.x + mmToWorld(300), y: q.y }], width: 1, hatch: false, brush: { tex: 'galets', d: 300, h: 0.5, top: true, zs: [z, z] } }; shapes.push(s); v3BrushBuild(); let ovN = 0, n = 0; V3.root.traverse(x => { if (x.userData.brushOv === s) { n++; ovN += x.geometry.attributes.position.count; } });
        shapes = shapes.filter(x => x !== s); v3BrushBuild(); close3D(); return { n: n > 0, smaller: big.geometry.attributes.position.count > 600 ? ovN < big.geometry.attributes.position.count : ovN <= big.geometry.attributes.position.count }; });   /* une surface de quelques triangles est reprise entière */
    t.eq('pinceau : couche découpée autour du coup (moins de travail graphique)', bo, { n: true, smaller: true });
    // pinceau en polygone : on clique les sommets, la zone entière est peinte (surfaces du dessus) ; une polyligne fermée choisie se peint d'un coup ; la gomme l'efface
    const bpo = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 500)); await startBrush(); brushSet('poly', true); const m = mmToWorld(1000);
        let big = null; V3.root.traverse(x => { if (x.isMesh && x.geometry && x.geometry.attributes.position && !x.userData.brushOv && (!big || x.geometry.attributes.position.count > big.geometry.attributes.position.count)) big = x; });
        const bb = new THREE.Box3().setFromObject(big), c = bb.getCenter(new THREE.Vector3()), cx = -V3.root.position.x, cy = -V3.root.position.y, z = Math.round((bb.max.z / (V3.exag || 1) + (V3.zmin || 0)) * 1000);
        const Q = (dx, dy) => ({ p: new THREE.Vector3(c.x + dx, c.y + dy, bb.max.z), n: new THREE.Vector3(0, 0, 1), q: { x: mmToWorld((c.x + dx + cx) * 1000), y: -mmToWorld((c.y + dy + cy) * 1000) }, z });
        const ev0 = { clientX: -999, clientY: -999, detail: 1 }; [Q(-0.5, -0.5), Q(0.5, -0.5), Q(0.5, 0.5), Q(-0.5, 0.5)].forEach(H => brushPolyClick(H, ev0)); brushPolyEnd(); await new Promise(r => setTimeout(r, 120));
        const s = shapes.filter(x => x.brush && x.brush.poly).pop(); let ov = 0; V3.root.traverse(x => { if (x.userData.brushOv === s) ov++; });
        const pl = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [2, 0], [2, -2], [0, -2]].map(([x, y]) => ({ x: x * m, y: y * m })) }; shapes.push(pl); selectedShapes = [pl]; brushPaintSel(); const sel = shapes.filter(x => x.brush && x.brush.poly).length;
        brushSet('erase', true); brushErase(Q(0, 0)); const left = shapes.filter(x => x.brush && x.brush.poly).length; invalidateCache(); draw();
        brushStop(true); shapes = shapes.filter(x => x !== pl && !(x.brush && x.brush.poly)); close3D(); return { closed: !!s && !s.open && s.points.length === 4, ov: ov > 0, sel, left }; });
    t.eq('pinceau polygone : zone cliquée peinte, contour choisi peint, gomme', bpo, { closed: true, ov: true, sel: 2, left: 1 });
    // pinceau : le coup de pinceau se donne dans la vue 3D ; le polygone peint se trace sur le plan avec l'outil polygone (aperçu, fermeture sur le 1er point)
    const b2a = await ev(async () => { if (is3DOpen()) close3D(); await startBrush(); brushSet('poly', true); await new Promise(r => setTimeout(r, 300)); const m = mmToWorld(1000), c = canvas.getBoundingClientRect(); camera.zoom = 15 / m; camera.x = 150; camera.y = 200; draw();
        return { open: is3DOpen(), on: !!brushTool, mode, n0: shapes.filter(x => x.brush).length, pts: [[0, 0], [12, 0], [12, 8], [0, 8], [0, 0]].map(([x, y]) => { const q = worldToScreen(x * m, y * m); return { x: c.left + q.x, y: c.top + q.y }; }) }; });
    for (const q of b2a.pts) { await p.mouse.click(q.x, q.y); await H.wait(80); }
    const b2b = await ev(async (n0) => { const S = shapes.filter(x => x.brush).slice(n0), po = S.find(x => x.brush.poly); const r = { poly: !!po && !po.open && po.points.length === 4 && po.brush.zs.length === 4, again: mode === 'poly' && !!brushTool };
        brushSet('poly', false); await new Promise(res => setTimeout(res, 1500)); r.stroke3d = is3DOpen() && mode !== 'poly' && !!brushTool; brushStop(true); shapes = shapes.filter(x => !S.includes(x)); close3D(); brushLast.poly = false; brushSaveOpt(); return r; }, b2a.n0);
    t.eq('pinceau : polygone peint sur le plan (outil polygone), coup de pinceau dans la vue 3D', [b2a.open, b2a.on, b2a.mode, b2b], [false, true, 'poly', { poly: true, again: true, stroke3d: true }]);
    // toitures et ouvertures sur leurs calques ; un calque Ouvertures masqué cache les menuiseries (le trou reste)
    const lyr = await ev(() => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 0 })) };
        const R = buildRoof(base, { pans: 2, he: 2.5, hf: 5, e: 0.2, ge: 0.2, fill: true, db: 0 }), T = buildTerrace(base, { pans: 0, he: 3, te: 0.25, tc: 0, ah: 0.5, at: 0.2, fp: 0, fe: 0.05 });
        const ln = (id) => (layers.find(l => l.id === id) || {}).name, roof = [...new Set(R.concat(T).map(x => ln(x.layerId)))];
        shapes.push({ type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [[[0, 0], [6, 0], [6, -0.2], [0, -0.2]].map(([x, y]) => ({ x: x * m, y: y * m }))], wallMat: 'beton', groupId: 'go', wz: { b: 0, t: 2500 } }); saveState();
        setMode('opening'); openingClick({ x: 1 * m, y: 0 }); openingFinish({ x: 2 * m, y: 0 }); closeTopoModal(); setMode('select-box'); const o = shapes[0].openings[0], opL = ln(o.layerId);
        const L = layers.find(l => l.id === o.layerId); L.visible = false; const hid = opHidden(o); L.visible = true; shapes = keepS; invalidateCache(); saveState(); return { roof, opL, hid }; });
    t.eq('toitures sur le calque Toiture, ouvertures sur le calque Ouvertures (masquable)', lyr, { roof: ['Toiture'], opL: 'Ouvertures', hid: true });
    // gestionnaire de calques : les calques sans groupe en haut, puis les groupes
    const lg = await ev(() => { const keep = layers; layers = [{ id: 'a', name: 'Murs', group: 'Bâti' }, { id: 'b', name: 'Libre 1' }, { id: 'c', name: 'Toit', group: 'Bâti' }, { id: 'd', name: 'Libre 2' }]; const G = layDDGroups().map(g => g.l ? g.l.name : '[' + g.p + ']'); layers = keep; return G; });
    t.eq('calques : ceux sans groupe en haut de la liste', lg, ['Libre 1', 'Libre 2', '[Bâti]']);
    // paroi : épaisseur réglable (0,20 par défaut) ; en plan, la désignation est décalée du milieu de l'arête (pas sur les poignées ni la pastille)
    const pe = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [{ off: true, pe: 500 }, null, null, null] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) };
        shapes.push(pl); invalidateCache(); tinCache = null; saveState(); if (!V3) init3D(); build3DScene(); let ys = []; V3.root.traverse(o => { if (o.userData.paroi) { o.geometry.computeBoundingBox(); ys.push(o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y); } });
        camera.zoom = 20 / m; camera.x = 0; camera.y = 600; invalidateCache(); draw(); const lab = dimensionTextsToDraw.find(d => d.text === 'Paroi'); const r = { th: Math.round(ys[0] * 100) / 100, offMid: lab ? Math.abs(lab.worldX - 30 * m) > 2 * m : false }; shapes = []; saveState(); return r; });
    t.eq('paroi : épaisseur réglée (0,50 m) et désignation hors des poignées', pe, { th: 0.5, offMid: true });
    // talus modélisés ensemble : là où deux plateformes se recouvrent, la plus haute reste ; une plateforme tracée dessous n'y a ni talus ni paroi
    await ev(t => { loadProjectText(t, 'villa2.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'villa2.mmc'), 'utf8')); await H.wait(600);
    const v2 = await ev(() => { const FM = finishedModel(), M = (x, y) => FM.at(mmToWorld(x * 1000), -mmToWorld(y * 1000)), a = M(670, 597), b = M(683, 595.5); return { top: a.kind === 1 && a.gov === 2, noTalus: b.kind === 1 && b.gov === 2, buried: !!FM.P[3].segs }; });
    t.eq('plateforme tracée sous une plus haute : la haute reste, pas de talus en double', v2, { top: true, noTalus: true, buried: true });
    // haut de paroi réglé par arête : à une cote finie, ou au terrain naturel (suit le niveau coupé)
    const pzt = await ev(() => { shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 300, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [{ off: true, pz: { m: 'fini', z: 99500 } }, null, { off: true, pz: { m: 'tn' } }, null] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) };
        shapes.push(pl); invalidateCache(); tinCache = null; saveState(); build3DScene(); const tops = []; V3.root.traverse(o => { if (!o.userData.paroi) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) tops.push([a[i + 1], a[i + 2]]); });
        const zmin = V3.zmin, cy0 = -15 + V3.root.position.y * 0, north = tops.filter(t => t[0] > -15.6 + 0 - 1e9); const zs = tops.map(t => Math.round((t[1] + zmin) * 100) / 100);
        const r = { fini: zs.includes(99.5), tnRises: Math.max(...zs) > 102.2 }; shapes = []; saveState(); return r; });
    t.eq('paroi : haut à une cote finie (99,50) ou au terrain naturel (monte avec lui)', pzt, { fini: true, tnRises: true });
    // outil Ajouter un point : sommet ajouté sur une plateforme (l'arête de talus est coupée en deux, même réglage) et sur une droite (coupée en deux droites qui se touchent)
    const ap = await ev(() => { shapes = []; const m = mmToWorld(1000), pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [{ kD: '2/1' }, null, null, null] }, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) }, ln = { type: 'line', layerId: 'layer-0', x1: 0, y1: -40 * m, x2: 10 * m, y2: -40 * m };
        shapes.push(pl, ln); saveState(); camera.zoom = 15 / m; camera.x = 0; camera.y = 800; setMode('addpt'); t2AddPt({ x: 27 * m, y: -15 * m }); t2AddPt({ x: 4 * m, y: -40 * m }); setMode('select-box');
        const L = shapes.filter(x => x.type === 'line'); const r = { n: pl.points.length, e: pl.talus.edges.slice(0, 2).map(e => e && e.kD), lines: L.length, joined: L.length === 2 && Math.abs(L[0].x2 - L[1].x1) < 1e-9 }; shapes = []; saveState(); return r; });
    t.eq('ajouter un point : arête de talus coupée en deux, droite coupée en deux', ap, { n: 5, e: ['2/1', '2/1'], lines: 2, joined: true });
    // même outil sur un sommet existant : il le retire (plateforme : le talus d'avant garde son réglage ; deux droites bout à bout : refondues en une seule)
    const dp = await ev(() => { shapes = []; const m = mmToWorld(1000), pl = { type: 'poly', layerId: 'layer-0', zk: 1, talus: { on: true, kD: '1/1', kR: '3/2', cx: true, edges: [{ kD: '2/1' }, { kD: '3/1' }, null, null, null] }, points: [[20, 15], [30, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) };
        const a = { type: 'line', layerId: 'layer-0', x1: 0, y1: -40 * m, x2: 5 * m, y2: -40 * m }, b = { type: 'line', layerId: 'layer-0', x1: 5 * m, y1: -40 * m, x2: 10 * m, y2: -40 * m };
        shapes.push(pl, a, b); saveState(); camera.zoom = 15 / m; setMode('addpt'); const hov = !!t2VertexAt({ x: 30 * m + 2, y: -15 * m }); t2AddPt({ x: 30 * m + 2, y: -15 * m }); t2AddPt({ x: 5 * m, y: -40 * m });
        const tri = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [5, 0], [0, 5]].map(([x, y]) => ({ x: x * m, y: y * m })) }; shapes.push(tri); t2AddPt({ x: 5 * m, y: 0 }); setMode('select-box');
        const L = shapes.filter(x => x.type === 'line'); const r = { hov, n: pl.points.length, e: pl.talus.edges.slice(0, 2).map(e => e && e.kD), lines: L.length, len: L.length === 1 ? Math.round(Math.hypot(L[0].x2 - L[0].x1, L[0].y2 - L[0].y1) / m) : 0, tri: tri.points.length }; shapes = []; saveState(); return r; });
    t.eq('retirer un point : sommet de plateforme retiré (talus d\'avant gardé), droites refondues, triangle gardé', dp, { hov: true, n: 4, e: ['2/1', null], lines: 1, len: 10, tri: 3 });
    // étages : + ajoute, − supprime l'étage en cours après confirmation (le RDC ne se supprime pas) ; texture gabions au catalogue
    const ld = await ev(() => { lvls = null; lvlToggle(true); lvlAdd(); const a = lvlList().map(lvlName); lvlDelAsk(); const asked = /Supprimer l'étage/.test(document.getElementById('topo-modal').textContent);
        [...document.querySelectorAll('#tm-actions button')].find(b => /^Supprimer/.test(b.textContent)).click(); const b = lvlList().map(lvlName); lvlPick('rdc'); lvlDelAsk(); const keep = lvlList().length; lvlToggle(false);
        return { a, asked, b, keep, gab: !!TEX_LIB.find(t => t.id === 'gabions') && !!texCanvas('gabions') }; });
    t.eq('étages : + ajoute, − supprime l\'étage en cours (confirmé), RDC gardé ; gabions au catalogue', ld, { a: ['RDC', 'R + 1', 'TOIT'], asked: true, b: ['RDC', 'TOIT'], keep: 2, gab: true });
    // toit tourné avec le bâtiment : « Modifier la toiture » repart du contour tourné (pas de l'ancienne position)
    const rr = await ev(() => { shapes = []; const m = mmToWorld(1000), base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 0 })) };
        buildRoof(base, Object.assign({}, roofLast, { pans: 2, dir: 'long', he: 2.5, hf: 5, db: 0, fill: false })).forEach(x => shapes.push(x)); saveState();
        shapes.forEach(x => applyRotationToShape(x, 0, 0, Math.PI / 2)); saveState(); const gid = shapes.find(x => x.roofDef).groupId, keep = roofDialog; let got = null; roofDialog = (b) => { got = b; }; try { roofEdit(gid); } finally { roofDialog = keep; }
        if (!got) return false; const xs = got.points.map(q => q.x / m), ys = got.points.map(q => q.y / m), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys); return Math.abs(w - 6) < 0.01 && Math.abs(h - 10) < 0.01; });
    t.ok('toit tourné avec le bâtiment : la modification repart du contour tourné', rr);
    const yr = await ev(() => { const g = shapes.find(x => x.roofDef).groupId; selectedShapes = shapes.filter(x => x.groupId === g); openSelectionParamModal(); const r = document.getElementById('topo-modal').style.display !== 'none' && !!document.getElementById('rf-svg') && document.getElementById('selparam-modal').classList.contains('hidden'); closeTopoModal(); return r; });
    t.ok('Y sur une toiture : directement sa fenêtre complète (coupe cotée)', yr);
    // toit 1 pan : l'égout choisi (côté 4-1) est gardé quand on rouvre la fenêtre (combler les pignons ne le remet plus sur le grand côté)
    const eg = await ev(() => { shapes = []; const m = mmToWorld(1000), base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 0 })) };
        buildRoof(base, Object.assign({}, roofLast, { pans: 1, eg: 3, he: 2.5, hf: 4, db: 0, fill: false })).forEach(x => shapes.push(x)); saveState(); const gid = shapes.find(x => x.roofDef).groupId; roofEdit(gid);
        const v = document.getElementById('rf-eg').value; document.getElementById('rf-fill').checked = true; [...document.querySelectorAll('#tm-actions button')].find(b => /Mettre à jour/.test(b.textContent)).click();
        const pn = shapes.find(x => x.solid && x.solid.kind === 'roof'); return [v, pn.solid.eg, shapes.some(x => x.name === 'Pignons')]; });
    t.eq('toit 1 pan : égout côté 4-1 gardé à la modification, pignons comblés', eg, ['3', 3, true]);
    // dalle : contour libre point par point (ici 5 sommets), refermé sur le 1er point
    await ev(() => { shapes = []; const m = mmToWorld(1000); camera.zoom = 40 / m; camera.x = 200; camera.y = 600; saveState(); draw(); startSolidTool('dalle'); });
    const DP = await ev(() => [[0, 0], [6, 0], [7, 3], [3, 5], [-1, 3], [0, 0]].map(([x, y]) => { const q = worldToScreen(mmToWorld(x * 1000), -mmToWorld(y * 1000)), c = canvas.getBoundingClientRect(); return { x: q.x + c.left, y: q.y + c.top }; }));
    for (const q of DP) await H.click(q); await H.wait(300);
    const dl = await ev(() => { const d = shapes.find(x => x.solid && x.solid.kind === 'box'); const r = d ? [d.points.length, d.solid.H, d.name] : null; setMode('select-box'); shapes = []; saveState(); return r; });
    t.eq('dalle : contour libre à 5 sommets, 20 cm', dl, [5, 200, 'Dalle']);
    // paroi épaisse (1 m, gabions) sur un contour à redans : un seul voile propre, sans morceaux qui se chevauchent (emprise réunie)
    await ev(t => { loadProjectText(t, 'villa2.mmc'); }, fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'villa2.mmc'), 'utf8')); await H.wait(600);
    const thk = await ev(async () => { await loadPolyClip(); shapes.filter(isPlateforme).forEach(s => (s.talus.edges || []).forEach(e => { if (e && e.off) e.pe = 1000; })); invalidateCache(); tinCache = null; saveState(); if (!V3) init3D(); build3DScene();
        let n = 0, area = 0; V3.root.traverse(o => { if (!o.userData.paroi) return; n++; const a = o.geometry.attributes.position.array; for (let i = 0; i + 8 < a.length; i += 9) { const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], cz = ux * vy - uy * vx; if (cz > 1e-9) area += cz / 2; } });
        return { n, top: area > 0 }; });
    t.eq('paroi épaisse à redans : voile construit sur une emprise réunie', thk, { n: 4, top: true });
    // ouverture du RDC : elle ne perce pas le mur de l'étage posé au-dessus (même emprise en plan, autre hauteur)
    const od = await ev(() => { shapes = []; const m = mmToWorld(1000), R = [[0, 0], [8, 0], [8, -0.2], [0, -0.2]].map(([x, y]) => ({ x: x * m, y: y * m }));
        const lid = wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), w0 = { type: 'hatch', layerId: lid, wallMat: 'beton', groupId: 'g0', wz: { b: 0, t: 2800 }, loops: [R.map(q => ({ ...q }))] }, w1 = { type: 'hatch', layerId: lid, wallMat: 'beton', groupId: 'g1', wz: { b: 2800, t: 5600 }, loops: [R.map(q => ({ ...q }))] };
        w0.openings = [{ kind: 'fenetre', a: { x: 3 * m, y: 0 }, b: { x: 4.2 * m, y: 0 }, pts: [{ x: 3 * m, y: 0.1 * m }, { x: 4.2 * m, y: 0.1 * m }, { x: 4.2 * m, y: -0.3 * m }, { x: 3 * m, y: -0.3 * m }], sill: 900, h: 1200 }];
        shapes.push(w0, w1); const r = [wallOpeningsFor(w0).length, wallOpeningsFor(w1).length]; shapes = []; return r; });
    t.eq('ouverture du RDC : pas de trou en double dans le mur de l\'étage', od, [1, 0]);

    // coupe en perspective : la 3D tronquée au trait de coupe (plan de coupe, tranches pleines, terre), regardée dans son sens ; une fenêtre 3D de mise en page la garde
    const c3 = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 200, zk: 1 });
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }); [[10, 10, 10.2, 20], [25.8, 10, 26, 20]].forEach(([a, b2, c, d], k) => shapes.push({ type: 'hatch', layerId: wl, loops: [R(a, b2, c, d)], wallMat: 'parpaing', groupId: 'c3' + k, wz: { b: 102000, t: 104700 } }));
        saveState(); sectionPlace(sectionData({ x: 2 * m, y: -15 * m }, { x: 38 * m, y: -15 * m }, 1), { x: 20 * m, y: -60 * m }); const L = shapes.find(x => x.cutDef); selectedShapes = [L];
        await sec3D(); await new Promise(r => setTimeout(r, 300)); const pl = V3.renderer.clippingPlanes[0]; let caps = 0, ground = 0; V3.root.traverse(o => { if (o.userData && o.userData.cap) { caps++; if (o.isMesh && o.material && o.material.side === THREE.DoubleSide) ground++; } });
        const rp = V3.root.position, at = (x, y) => new THREE.Vector3(worldToMm(x * m) / 1000 + rp.x, -worldToMm(-y * m) / 1000 + rp.y, 0), view = L.cutDef.side, front = pl.distanceToPoint(at(20, 15 - 5 * view)), back = pl.distanceToPoint(at(20, 15 + 5 * view));
        const noSec = (() => { let n = 0; V3.root.traverse(o => { n++; }); return n > 0; })(); const keep = { az: V3.az };
        const v = { id: 'vc', x: 0, y: 0, w: 100, h: 60 }; await lp3DSnap(v, true); const kept = !!(v.v3 && v.v3.cut);
        v3CutToggle(); const off = V3.renderer.clippingPlanes.length === 0; close3D(); shapes = keepS; selectedShapes = []; invalidateCache(); saveState();
        return { plane: !!pl, sides: Math.sign(front) !== Math.sign(back), caps: caps > 2, ground: ground >= 1, kept, off, img: !!(v.v3 && v.v3.img) }; });
    t.eq('coupe en perspective : 3D tronquée au trait (un côté gardé), tranches pleines et terre, gardée par une fenêtre 3D de mise en page, retirée au 2e clic', c3, { plane: true, sides: true, caps: true, ground: true, kept: true, off: true, img: true });

    // FONDATIONS : filante, isolée (sous un poteau), longrine ; dessus calé sous la dalle du RDC, et qui suit quand la dalle monte
    await ev(() => { if (is3DOpen()) close3D(); });
    const fd = await ev(async () => { const m = mmToWorld(1000), sq = (x0, y0, w, z) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + w], [x0, y0 + w]].map(([x, y]) => ({ x: x * m, y: -y * m, z }));
        const dalle = { type: 'poly', layerId: 'layer-0', points: sq(1000, 1000, 10, 100000), solid: { kind: 'box', H: 200 }, zk: 1, name: 'Dalle' }, pot = { type: 'poly', layerId: 'layer-0', points: sq(1004.9, 1004.9, 0.2, 100200), solid: { kind: 'box', H: 2500 }, zk: 1, name: 'Poteau' };
        shapes.push(dalle, pot); saveState(); const r = {};
        document.getElementById('btn-fond').click(); r.panel = /Semelle filante/.test(document.getElementById('t2-panel').textContent);
        fondGo(); r.mode = mode; shapes.push({ type: 'poly', open: true, layerId: activeLayerId, points: [{ x: 1000.2 * m, y: -1000.2 * m }, { x: 1009.8 * m, y: -1000.2 * m }, { x: 1009.8 * m, y: -1009.8 * m }] }); saveState();
        const sf = shapes[shapes.length - 1]; r.sf = sf.fond && sf.fond.t === 'filante' && sf.sweep && sf.sweep.d.l === 500 && sf.points.every(q => Math.abs(q.z - (100000 - 400)) < 1) && layers.find(l => l.id === sf.layerId).name === 'Fondations';
        setMode('select-box'); fondSet('isolee'); selectedShapes = [pot]; fondGo(); const si = shapes[shapes.length - 1]; const c = polyCentroid(si.points);
        r.iso = si.fond.t === 'isolee' && Math.abs(c.x - 1005 * m) < 1 && Math.abs(si.points[0].z - 99600) < 1 && si.solid.H === 400 && Math.abs(si.points[1].x - si.points[0].x - 0.8 * m) < 1e-6;
        fondSet('longrine'); selectedShapes = []; fondGo(); r.lmode = mode; shapes.push({ type: 'line', layerId: activeLayerId, x1: 1002 * m, y1: -1005 * m, x2: 1008 * m, y2: -1005 * m }); saveState(); const lg = shapes[shapes.length - 1];
        r.lg = lg.fond && lg.fond.t === 'longrine' && Math.abs(lg.z1 - 99600) < 1 && lg.sweep.d.l === 250;
        dalle.points.forEach(q => q.z += 500); saveState(); r.follow = Math.abs(sf.points[0].z - 100100) < 1 && Math.abs(si.points[0].z - 100100) < 1 && Math.abs(lg.z2 - 100100) < 1;
        // filante qui suit le contour sur un terrain en pente, sommets hors dalle : un seul niveau (pas un Z par sommet pris sur le terrain)
        const TN = ensureLayer('Terrain naturel', '#bef264'), tp = []; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) tp.push({ type: 'point', layerId: TN, x: (1020 + i * 5) * m, y: -(1000 + j * 5) * m, z: 100000 + i * 300, zk: 1 }); shapes.push(...tp); tinCache = null; invalidateCache();
        fondSet('filante'); fondGo(); shapes.push({ type: 'poly', open: true, layerId: activeLayerId, points: [[1021, 1001], [1039, 1001], [1039, 1019], [1030, 1019]].map(([x, y]) => ({ x: x * m, y: -y * m })) }); saveState(); const fp = shapes[shapes.length - 1];
        r.flat = fp.points.every(q => Math.abs(q.z - fp.points[0].z) < 1);
        // un Z de sommet donné à la main est gardé (sort du calage) ; clic droit › Recaler sous la dalle
        fp.points[2].z = 101234; saveState(); r.manual = fp.points[2].z === 101234 && fp.fond.auto === false; selectedShapes = [fp]; r.menu = ctxItems().some(x => x && /Recaler/.test(x[1]));
        fondRecale(fp); r.back = fp.fond.auto && fp.points.every(q => Math.abs(q.z - fp.points[0].z) < 1); shapes = shapes.filter(x => x !== fp && !tp.includes(x)); tinCache = null; selectedShapes = [];
        setMode('select-box'); await open3D(); await new Promise(res => setTimeout(res, 600)); let n = 0; V3.root.traverse(o => { if (o.isMesh && o.userData && (o.userData.sh === sf || o.userData.shape === sf || o.userData.s === sf)) n++; }); r.v3 = V3.root.children.length > 0; close3D();
        shapes = shapes.filter(x => ![dalle, pot, sf, si, lg].includes(x)); saveState(); return r; });
    t.eq('fondations : filante (axe des murs), isolée sous le poteau, longrine ; dessus sous la dalle du RDC, suivent la dalle, horizontales, Z de sommet à la main gardé', fd, { panel: true, mode: 'pline', sf: true, iso: true, lmode: 'line', lg: true, follow: true, flat: true, manual: true, menu: true, back: true, v3: true });

    // PEINDRE = un seul outil (Volume / Trait / Zone) ; zone d'un clic dans un contour ; clic dans une zone peinte = repeinte (aussi en mode Volume)
    const pz = await ev(async () => { if (is3DOpen()) close3D(); const keep = shapes; shapes = []; const m = mmToWorld(1000), r = {};
        const pl = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [8, 0], [8, 6], [0, 6]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(pl); saveState();
        r.noBrushBtn = !document.getElementById('btn-brush'); await paintMode('zone'); r.zoneMode = mode === 'poly' && !!brushTool && /Peindre/.test(document.getElementById('t2-panel').textContent) && !!document.querySelector('#t2-panel [data-pm=zone]');
        brushSet('pick', true); await new Promise(res => setTimeout(res, 200)); r.pick = mode + (document.getElementById('t2-panel').style.display === 'flex' ? '+panel' : ''); brushChoose('galets'); brushPickClick({ x: 4 * m, y: -3 * m }); const z = shapes[shapes.length - 1]; r.made = !!(z.brush && z.brush.poly && z.brush.tex === 'galets' && z.points.length === 4);
        const n0 = shapes.length; brushChoose('gazon'); brushPickClick({ x: 4 * m, y: -3 * m }); r.repaint = shapes.length === n0 && z.brush.tex === 'gazon';
        await paintMode('vol'); r.vol = !!texPaint && !brushTool && mode === 'paint'; texChoose('brique'); r.shared = brushLast.tex === 'brique';
        const sx = 4 * m * camera.zoom + camera.x, sy = -3 * m * camera.zoom + camera.y; t2MouseDown(sx, sy, { button: 0 }); r.volRepaint = z.brush.tex === 'brique';
        texStop(); localStorage.setItem('momocad-paintmode', 'vol'); paintModeLast = 'vol'; shapes = keep; saveState(); return r; });
    t.eq('Peindre : un outil, 3 modes ; zone d\'un clic dans un contour ; zone peinte repeinte d\'un clic (Zone et Volume)', pz, { noBrushBtn: true, zoneMode: true, pick: 'paintzone+panel', made: true, repaint: true, vol: true, shared: true, volRepaint: true });

    // ESCALIER (tiroir Paroi) : deux clics bas → haut ; altitudes du sol fini aux deux bouts ; marches calculées ; plan et 3D
    const st = await ev(async () => { if (is3DOpen()) close3D(); const keep = shapes; shapes = []; const m = mmToWorld(1000);
        const pf = (P, z) => ({ type: 'poly', layerId: 'layer-0', zk: 1, points: P.map(([x, y]) => ({ x: x * m, y: -y * m, z })), talus: { on: false } });
        shapes.push(pf([[0, 0], [10, 0], [10, 10], [0, 10]], 100000), pf([[10, 0], [20, 0], [20, 10], [10, 10]], 101000)); invalidateCache(); saveState(); const r = {};
        openParois(); r.card = !!document.querySelector('#blk-grid [onclick="startStair()"]'); closeFileMenus(); startStair(); r.mode = mode;   // la galerie Parois n'a plus de carte Escalier (revue des volets, P2)
        stairOpt = { w: 1200, h: 170, g: 280, nez: 30, mat: 'pierre' }; stairClick({ x: 12 * m, y: -5 * m }); stairClick({ x: 8.5 * m, y: -5 * m }); const S = shapes.find(x => x.stair);
        r.calc = S ? [S.stair.n, S.stair.h, S.stair.z0, S.stair.z1].join('/') : null; r.len = Math.round(mOf(Math.hypot(S.stair.b.x - S.stair.a.x, S.stair.b.y - S.stair.a.y)) * 100); r.bl = blondel(S.stair.h, S.stair.g).b;
        selectedShapes = [S]; stairPanel(S); const gi = document.getElementById('st-g'); gi.value = '30'; gi.dispatchEvent(new Event('input', { bubbles: true })); r.edit = S.stair.g === 300 && Math.round(mOf(Math.hypot(S.stair.b.x - S.stair.a.x, S.stair.b.y - S.stair.a.y)) * 100) === 180 && /Blondel/.test(document.getElementById('st-bl').textContent) && !!document.querySelector('#st-svg svg path') && /2h \+ g = 63,4 cm/.test(document.getElementById('st-svg').textContent); r.dir = !!S && S.stair.a.x < S.stair.b.x; r.notPlat = S && !isPlateforme(S);
        await open3D(); await new Promise(res => setTimeout(res, 500)); let n = 0; V3.root.traverse(o => { if (o.isMesh && o.userData.shape === S) n++; }); r.steps3D = n; close3D();
        t2PanelClose(); setMode('select-box'); shapes = keep; invalidateCache(); saveState(); return r; });
    t.eq('escalier : plus de carte dans la galerie Parois, 2 clics, 6 marches de 16,7 cm (giron 28, Blondel 61,4), réglable ensuite, 6 marches en 3D', st, { card: false, mode: 'stair', calc: '6/167/100000/101000', len: 168, bl: 614, edit: true, dir: true, notPlat: true, steps3D: 6 });

    // ESCALIER posé, cadre étiré aux poignées, puis Ctrl+Z : les talus restent (le modèle de terrain fini ne garde plus d'anciens objets après une annulation)
    const su = await ev(async () => { if (is3DOpen()) close3D(); const keep = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) shapes.push({ type: 'point', layerId: TN, x: i * 10 * m, y: -j * 10 * m, z: 99500, zk: 1 });
        const pf = (P, z) => ({ type: 'poly', layerId: 'layer-0', zk: 1, points: P.map(([x, y]) => ({ x: x * m, y: -y * m, z })), talus: { on: true, kR: '3/2', kD: '1/1' } });
        shapes.push(pf([[-15, -10], [0, -10], [0, 10], [-15, 10]], 100000), pf([[0, -10], [15, -10], [15, 10], [0, 10]], 101000)); invalidateCache(); saveState();
        const tal = () => shapes.filter(x => isPlateforme(x)).map(x => { const g = talusGeom(x); return g ? g.toe.length > 0 : false; }).join(',');
        const r = { t0: tal() }; stairOpt = { w: 1200, h: 170, g: 280, nez: 30, mat: 'pierre' }; startStair(); stairClick({ x: -3 * m, y: 0 }); stairClick({ x: 3 * m, y: 0 }); t2PanelClose(); setMode('select-box');
        const S = shapes.find(x => x.stair); r.noZ = S.points.every(q => !hasZ(q.z)); r.t1 = tal();
        S.points[1].x += 0.5 * m; S.points[2].x += 0.5 * m; saveState(); r.frame = S.stair.g > 280; r.t2 = tal();
        undo(); r.t3 = tal(); undo(); r.t4 = tal(); r.terrain = getTIN().nodes.length === 81;
        shapes = keep; invalidateCache(); saveState(); return r; });
    t.eq('escalier, cadre étiré, Ctrl+Z : talus toujours là, escalier jamais pris pour du terrain', su, { t0: 'true,true', noZ: true, t1: 'true,true', frame: true, t2: 'true,true', t3: 'true,true', t4: 'true,true', terrain: true });

    // revue des volets (Bâtiment) : coupe + liste des fondations posées ; galerie Parois avec en-tête et coupe au survol ; plus de textures, catégories sur une rangée
    const rv = await ev(() => { const r = {}, keep = shapes; shapes = []; const m = mmToWorld(1000);
        fondPick = { t: 'filante', l: 500, h: 400 }; shapes.push({ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 10 * m, y2: 0 }); const f = shapes[0]; f.sweep = Object.assign(sweepDefault('SF50'), { d: { l: 500, h: 400 }, al: 'axe', ref: 'bas', zs: 'trace' }); fondMake(f, 'filante');
        fondPanel(); const P = document.getElementById('t2-panel'); r.svg = !!P.querySelector('#fd-svg svg') && /50 cm/.test(P.querySelector('#fd-svg').textContent) && /40 cm/.test(P.querySelector('#fd-svg').textContent);
        r.list = /Fondations posées/.test(P.textContent) && /10,00 m/.test(P.textContent) && /2,00 m³/.test(P.textContent);
        const li = document.getElementById('fd-l'); li.value = '60'; li.oninput(); r.live = /60 cm/.test(document.getElementById('fd-svg').textContent); t2PanelClose();
        openParois(); r.par = document.getElementById('blk-title').textContent === 'Parois' && !document.querySelector('#blk-grid [onclick="startStair()"]'); const c = document.querySelector('#blk-grid [onmouseenter^=wallSec]'); c.dispatchEvent(new Event('mouseenter')); r.sec = !!document.querySelector('#wall-sec svg rect') && / mm/.test(document.getElementById('wall-sec').textContent); closeFileMenus();
        r.tex = TEX_LIB.length >= 90 && ['beton-balaye', 'opus', 'evergreen', 'caillebotis', 'parquet-baton'].every(id => TEX_LIB.some(t => t.id === id) && !!texThumb(id));
        texCat = 'sol'; texPanel(); const cats = document.querySelector('#t2-panel .tex-cats'); r.row = !!cats && getComputedStyle(cats).flexWrap === 'nowrap'; t2PanelClose();
        shapes = keep; return r; });
    t.eq('volets Bâtiment : coupe et liste des fondations (cotes en direct), galerie Parois avec en-tête et coupe au survol, plus de textures sur une rangée de catégories', rv, { svg: true, list: true, live: true, par: true, sec: true, tex: true, row: true });

    // import carte : chaussées en enrobé (plan et 3D, aussi en rendu coloré) ; arbres des zones boisées avec un tronc
    const im = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('TN IGN', '#bef264'), r = {};
        for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) if (Math.abs(j * 5 - 50) > 4) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 100, zk: 1, code: 'TN_IGN' });
        const lay = ensureLayer('Routes — bords (TN)', '#a8a29e'); [1, -1].forEach(sg => shapes.push({ type: 'poly', open: true, layerId: lay, points: Array.from({ length: 34 }, (_, k) => ({ x: k * 3 * m, y: -(50 + sg * 2.5) * m, z: 100000 + k * 60 })), hatch: false, rtOf: 'rt1', road: { w: 5, rid: 'rt1-0' }, name: 'Bord de chaussée' }));
        shapes.push({ type: 'poly', layerId: ensureLayer('Zones boisées', '#4ade80'), points: [[60, 10], [90, 10], [90, 30], [60, 30]].map(([x, y]) => ({ x: x * m, y: -y * m })), bois: { h: 12, tex: 'vert' }, zk: 1 });
        const B2 = { type: 'poly', layerId: ensureLayer('Zones boisées', '#4ade80'), points: [[20, 40], [45, 40], [45, 60], [20, 60]].map(([x, y]) => ({ x: x * m, y: -y * m })), bois: { h: 12, tex: 'vert' }, zk: 1 }; shapes.push(B2);
        tinCache = null; invalidateCache(); saveState(); draw(); await open3D(); const cv = texCanvas('enrobe'), cnt = () => { let n = 0; V3.root.traverse(o => { if (o.isMesh && o.material && o.material.map && o.material.map.image === cv) n += o.geometry.attributes.position.count / 3; }); return n; };
        { const cntT = () => { let n = 0, g = null; V3.root.traverse(o => { if (o.isInstancedMesh && o.userData.bois) { n = o.count; g = o; } }); return [n, g]; }; const [n0, g0] = cntT(); V3_KEEP_ST.hit = V3_KEEP_ST.miss = 0;
            const W = { type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: m, y2: 0 }; shapes.push(W); saveState(); build3DScene(); const [n1, g1] = cntT(); r.kept = V3_KEEP_ST.hit >= 1 && n1 === n0 && g1 === g0;   /* retouche ailleurs : mêmes arbres, pas refaits */
            B2.bois.h = 20; saveState(); build3DScene(); const [n2, g2] = cntT(); r.redo = g2 !== g0 && n2 > 0; B2.bois.h = 12; shapes.splice(shapes.indexOf(W), 1); saveState(); }   /* la zone boisée change : refaits */
        build3DScene(); r.nat = cnt() > 10; let cr = 0, tr = 0; V3.root.traverse(o => { if (o.isInstancedMesh && o.userData.bois) cr = o.count; if (o.isInstancedMesh && o.userData.boisTronc) tr = o.count; }); r.trunks = cr > 5 && tr === cr; const T2 = boisTrees(B2); r.offRoad = T2.length >= 6 && T2.every(q => Math.abs(q.y / m + 50) > 3.9);
        close3D(); shapes = keep; tinCache = null; invalidateCache(); saveState(); return r; });
    t.eq('import carte : chaussées en enrobé dans la 3D ; arbres des zones boisées avec leur tronc, jamais sur la route ; arbres gardés quand on retouche ailleurs', im, { kept: true, redo: true, nat: true, trunks: true, offRoad: true });
    // édition par étage : sur le plan, les autres étages (dessous compris) sont masqués et inattrapables ; la pastille sélectionne l'emprise du bâtiment
    const pet = await ev(async () => { const keepS = shapes, keepL = lvls; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), M = mmToWorld;
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(A); saveState(); bldMake(A, 'A', 69000, 3000); saveState();
        const wall = async (x1, x2, y) => { startWall('w-beton20'); wallStart = { x: M(x1 * 1000), y: -M(y * 1000) }; wallAddTo(M(x2 * 1000), -M(y * 1000)); setMode('select-box'); await new Promise(r => setTimeout(r, 200)); return shapes.filter(isWallHatch).pop(); };
        const w0 = await wall(1, 9, 1); bldAdd(true); const r1 = lvlSorted().find(x => x.id !== 'rdc'); bldPick(r1.id); const w1 = await wall(1, 9, 6); zoomExtents(); draw();
        const r = { off: [lvlOff2D(w0), lvlOff2D(w1)].join(','), pick: findShapeAt(5 * m, -1 * m) !== w0 };
        const pl = { type: 'poly', open: true, layerId: activeLayerId, points: [{ x: 0, y: -8 * m }, { x: -3 * m, y: -10 * m }, { x: 2 * m, y: -12 * m }] }; shapes.push(pl); draw();   /* polyligne dont un sommet est sous la pastille, sélectionnée (poignées) */
        selectedShapes = [pl]; draw(); const bb = bldBadgeHits[0], rc = canvas.getBoundingClientRect(), ev2 = (t) => canvas.dispatchEvent(new MouseEvent(t, { clientX: rc.left + bb.x0 + 5, clientY: rc.top + bb.y0 + 5, button: 0, bubbles: true }));
        ev2('mousedown'); ev2('mouseup'); await new Promise(res => setTimeout(res, 200)); closeSelectionParamModal(); r.badge = selectedShapes.length === 1 && selectedShapes[0] === A;
        bldPick('rdc'); r.back = [lvlOff2D(w0), lvlOff2D(w1)].join(','); selectedShapes = []; bldActivate(null); lvlOn = false; shapes = keepS; lvls = keepL; invalidateCache(); saveState(); draw(); return r; });
    t.eq('étages : sur le plan, les autres étages sont masqués et inattrapables ; la pastille sélectionne l\'emprise', pet, { off: 'true,false', pick: true, badge: true, back: 'false,true' });
    // parois : une fusion ne fait plus disparaître les bordures d'un tronçon resté hors de la fusion (autre bâtiment, autres niveaux) ; un plan abîmé est réparé à l'ouverture
    const wb = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), lid = ensureLayer('Paroi isolant (laine)', '#facc15'), g1 = 'grp-t1', g2 = 'grp-t2';
        const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        const wall = (P, g, wz) => { const h = { type: 'hatch', layerId: lid, loops: [P], wallMat: 'isolant', groupId: g, wz }; const L = P.map((a, i) => { const b = P[(i + 1) % P.length]; return { type: 'line', layerId: lid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, wallMat: 'isolant', groupId: g, wz }; }); return [h, L]; };
        const [hA, LA] = wall(rect(0, 0, 4, 0.1), g1, { b: 0, t: 2500 }), [hB, LB] = wall(rect(4, 0, 8, 0.1), g1, { b: 300, t: 2800 }), [hN, LN] = wall(rect(8, 0, 12, 0.1), g2, { b: 300, t: 2800 });
        shapes.push(hA, hB, hN, ...LA, ...LB, ...LN); await wallFuse([hN]);
        const lines = shapes.filter(x => x.type === 'line' && x.wallMat), onA = lines.filter(l => Math.max(l.x1, l.x2) <= 4 * m + 1).length, r = { onA: onA >= 3, hatches: shapes.filter(isWallHatch).length === 3 };
        // plan abîmé : une paroi sans ses bordures retrouve ses traits à l'ouverture
        shapes = [hA]; const txt = JSON.stringify(projectData()); loadProjectText(txt, 'abime.mmc'); r.repaired = shapes.filter(x => x.type === 'line' && x.wallMat === 'isolant').length === 4 && /bordure/.test((document.getElementById('mc-toast') || {}).textContent || ''); { const t2 = document.getElementById('mc-toast'); if (t2) t2.remove(); }
        loadProjectText(txt, 'abime.mmc'); r.idem = wallBordersRepair() === 0; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('parois : la fusion garde les bordures des tronçons restés à part ; plan abîmé réparé à l\'ouverture', wb, { onA: true, hatches: true, repaired: true, idem: true });
    /* fusion d'une paroi qui en traverse une autre (copier-coller, retouche) : chaque fenêtre reste sur le morceau qui la porte, au même endroit */
    const wfo = await ev(async () => { const keepS = shapes; shapes = []; await loadPolyClip(); const m = mmToWorld(1000), lid = ensureLayer('Paroi isolant (laine)', '#facc15');
        const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        const wall = (P, g) => { const h = { type: 'hatch', layerId: lid, loops: [P], wallMat: 'isolant', groupId: g, wz: { b: 0, t: 2500 } }; return [h, P.map((a, i) => { const b = P[(i + 1) % P.length]; return { type: 'line', layerId: lid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, wallMat: 'isolant', groupId: g, wz: { b: 0, t: 2500 } }; })]; };
        const [hA, LA] = wall(rect(4, 0, 8, 0.1), 'grp-o1'), [hN, LN] = wall(rect(2, 0, 14, 0.1), 'grp-o2'); shapes.push(hA, hN, ...LA, ...LN);
        const o = { a: { x: 10 * m, y: -0.05 * m }, b: { x: 11 * m, y: -0.05 * m }, kind: 'fen', sill: 1000, h: 1250, hinge: 'a', side: 1, top: 'droit' }; o.pts = openingPts(hN, o.a, o.b); const o2 = Object.assign({}, o, { a: { x: 2.5 * m, y: -0.05 * m }, b: { x: 3.5 * m, y: -0.05 * m } }); o2.pts = openingPts(hN, o2.a, o2.b); hN.openings = [o2, o];
        await wallFuse([hN]); const host = shapes.find(x => (x.openings || []).includes(o)), mid = { x: 10.5 * m, y: -0.05 * m };
        const host2 = shapes.find(x => (x.openings || []).includes(o2)), r = { one: shapes.filter(x => (x.openings || []).includes(o)).length === 1, inside: !!host && pointInPolygon(mid.x, mid.y, host.loops[0]) && !!host2 && pointInPolygon(3 * m, -0.05 * m, host2.loops[0]), still: Math.abs(o.a.x - 10 * m) < 1e-6 && Math.abs(o.b.x - 11 * m) < 1e-6 && Math.abs(o2.a.x - 2.5 * m) < 1e-6 };
        shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('parois : fusion d\'une paroi traversante, la fenêtre reste sur son morceau, à sa place', wfo, { one: true, inside: true, still: true });
    // contour de bâtiment coupé en morceaux (ouvert) : recollé et refermé à la modification suivante comme à l'ouverture ; la pastille ouvre bien ses étages
    const bc = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000);
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(A); saveState(); bldMake(A, 'A', 69000, 3000); saveState();
        const P = A.points, p1 = Object.assign({}, A, { open: true, points: [P[0], P[1], P[2]].map(q => ({ x: q.x, y: q.y })) }), p2 = Object.assign({}, A, { open: true, points: [P[2], P[3], P[0]].map(q => ({ x: q.x, y: q.y })) });
        shapes = shapes.filter(x => x !== A).concat([p1, p2]); saveState(); const Z = shapes.filter(x => x.bld), r = { one: Z.length === 1 && !Z[0].open && Z[0].points.length === 4 && Math.abs(Math.abs(polyArea(Z[0].points)) / m / m - 80) < 1e-6 };
        const txt = JSON.stringify(Object.assign(projectData(), { shapes: [Object.assign({}, Z[0], { open: true, points: Z[0].points.slice(0, 3) }), Object.assign({}, Z[0], { open: true, points: [Z[0].points[2], Z[0].points[3], Z[0].points[0]] })] }));
        loadProjectText(txt, 'coupe.mmc'); const t = document.getElementById('mc-toast'); r.load = shapes.filter(x => x.bld).length === 1 && !shapes.find(x => x.bld).open && !!t && /refermé/.test(t.textContent); if (t) t.remove();
        zoomExtents(); draw(); const bb = bldBadgeHits[0], rc = canvas.getBoundingClientRect(), ev2 = (ty) => canvas.dispatchEvent(new MouseEvent(ty, { clientX: rc.left + bb.x0 + 5, clientY: rc.top + bb.y0 + 5, button: 0, bubbles: true }));
        ev2('mousedown'); ev2('mouseup'); await new Promise(res => setTimeout(res, 200)); r.panel = /Étages/.test(document.getElementById('selparam-modal').textContent); closeSelectionParamModal();
        bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('bâtiment : contour coupé recollé et refermé (modification et ouverture), la pastille ouvre ses étages', bc, { one: true, load: true, panel: true });
    // parois complexes (sandwich d'un seul bloc, montants tous les N mm) ; types en double retirés (l'épaisseur se règle) ; ouvertures : baie libre, arche, chapeau de gendarme
    const cxo = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), r = {};
        r.presets = ['w-beton16', 'w-laine100', 'w-parp15'].every(id => !WALL_PRESETS.some(p => p.id === id)); startWall('w-laine100'); r.alias = !!wallTool && wallTool.layers[0].mat === 'isolant' && wallTool.layers[0].e === 100; setMode('select-box');
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [8, 0], [8, 6], [0, 6]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(A); saveState(); bldMake(A, 'A', 100000, 2700); saveState();
        startWallCx(WALL_CX[0]); wallStart = { x: 4 * m, y: 0 }; wallChain = null; wallAddTo(4 * m, -3 * m); wallAddTo(7.4 * m, -3 * m); wallChainEnd(); setMode('select-box'); await new Promise(res => setTimeout(res, 300));
        const C = shapes.filter(x => x.wallCx), H = C.filter(isWallHatch), st = H.filter(x => x.stud);
        r.cx = new Set(C.map(x => x.groupId)).size === 1 && H.filter(x => !x.stud).length === 6 && ['placo', 'isolant', 'metal'].every(mt => H.some(x => x.wallMat === mt)) && H.filter(x => x.wallMat === 'placo').every(x => (layers.find(l => l.id === x.layerId) || {}).name === 'Paroi plaque de plâtre');
        r.studs = st.length === 6 + 7;   // 3 m : 0, 0,6 … 2,4 + bout (6) ; 3,4 m : 0 … 3,0 + bout (7)
        const W = 1200, pr = opProfile({ top: 'arche', h: 2300, R: 600 }, W), pg = opProfile({ top: 'gendarme', h: 2300, R: 900 }, W), zmax = (P) => Math.max(...P.pts.map(q => q[1]));
        r.arche = Math.abs(pr.f - 600) < 1e-6 && Math.abs(zmax(pr) - 2300) < 1 && Math.abs(pr.zs - 1700) < 1e-6;
        r.gendarme = Math.abs(pg.f - (1800 - Math.sqrt(4 * 810000 - 360000))) < 1e-6 && Math.abs(zmax(pg) - 2300) < 1e-6 && pg.pts.some(q => Math.abs(q[0] - 600) < 1e-6 && Math.abs(q[1] - 2300) < 1e-6);
        const host = H.find(x => x.wallMat === 'isolant' && !x.stud); openA = { x: 4 * m, y: -1 * m }; openWall = host; openDir = { x: 0, y: -1 }; openLast.kind = 'baie'; openLast.top = 'gendarme'; openLast.Rk = 0; openingFinish({ x: 4 * m, y: -2.2 * m });
        const radios = ['baie', 'fen', 'porte'].every(v => document.querySelector('input[name=op-k][value=' + v + ']')) && ['droit', 'arche', 'gendarme'].every(v => document.querySelector('input[name=op-top][value=' + v + ']'));
        document.querySelector('input[name=op-top][value=arche]').checked = true; opTopUI(); document.getElementById('op-r').value = '0,80'; [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click();
        const o = host.openings[0]; r.dialog = radios && o.kind === 'baie' && o.top === 'arche' && Math.abs(o.R - 800) < 1e-6;
        await open3D(); let jo = 0; V3.root.traverse(x => { if (x.userData && x.userData.opening === o) jo++; }); r.noJoinery = jo === 0; close3D();
        openA = { x: 5 * m, y: -1 * m }; openWall = host; openDir = { x: 0, y: -1 }; openLast.kind = 'garage'; openLast.top = 'droit'; openingFinish({ x: 5 * m, y: -3.6 * m }); const og = host.openings[host.openings.length - 1];
        r.garage = !!document.querySelector('input[name=op-k][value=garage]:checked') && og.kind === 'garage' && og.h === 2000 && og.sill === 0; r.colUI = document.querySelectorAll('.op-col-sw').length >= 10; opColPick('op-col', '#383e42'); [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click();
        await open3D(); let gp = 0, gc = 0; V3.root.traverse(x => { if (x.userData && x.userData.opening === og) { gp++; if (x.material && x.material.color && x.material.color.getHex() === 0x383e42) gc++; } }); r.garage3d = gp >= 10; r.col = og.col === '#383e42' && gc >= 5;
        /* vue Momo : la porte de garage bascule sur son bord haut et se range sous le plafond, du côté de ses rails sur le plan (o.side), qu'on l'ouvre de dehors ou de dedans, puis se referme */
        let tl = null; V3.root.traverse(x => { if (x.userData.door && x.userData.door.garage && !tl) tl = x; }); if (tl) { const pv = tl.parent, a = pv.rotation.z, nx = -Math.sin(a), ny = Math.cos(a); V3.root.updateMatrixWorld(true); const b0 = new THREE.Box3().setFromObject(tl), c = b0.getCenter(new THREE.Vector3()), rp = V3.root.position, pw = pv.getWorldPosition(new THREE.Vector3());
            const gR = { x: (og.pts[3].x - og.pts[0].x) * (og.side === -1 ? -1 : 1), y: -(og.pts[3].y - og.pts[0].y) * (og.side === -1 ? -1 : 1) };
            const gTry = async (k) => { await momoFPS({ w: { x: mmToWorld((c.x + nx * 2 * k - rp.x) * 1000), y: -mmToWorld((c.y + ny * 2 * k - rp.y) * 1000) } }); const F = V3.fps; F.pos.z = c.z; F.yaw = Math.atan2(c.x - F.pos.x, c.y - F.pos.y); F.pitch = 0;
                const ok = fpsDoor(); for (let i = 0; i < 20; i++) fpsStep(0.1); V3.root.updateMatrixWorld(true); const b1 = new THREE.Box3().setFromObject(tl), c1 = b1.getCenter(new THREE.Vector3());
                const up = ok && Math.abs(Math.abs(tl.rotation.x) - Math.PI / 2) < 1e-3 && b1.min.z > b0.max.z - 0.2, rails = (c1.x - pw.x) * gR.x + (c1.y - pw.y) * gR.y > 0;
                F.yaw = Math.atan2(pw.x - F.pos.x, pw.y - F.pos.y); fpsDoor(); for (let i = 0; i < 20; i++) fpsStep(0.1); const shut = Math.abs(tl.rotation.x) < 1e-3; V3.fps.back = { az: V3.az, el: V3.el, dist: V3.dist, t: V3.target.clone() }; fpsStop(); return up && rails && shut; };
            r.gOpen = await gTry(1) && await gTry(-1); r.gClose = Math.abs(tl.rotation.x) < 1e-3; }
        close3D(); draw();
        /* fenêtre coulissante : deux vantaux décalés dans l'épaisseur ; vue Momo, E sur la fenêtre : le vantail visé glisse devant l'autre, E le ramène */
        const host2 = wallAt({ x: 5.5 * m, y: -3 * m }) || host; openA = { x: 5 * m, y: -3 * m }; openWall = host2; openDir = { x: 1, y: 0 }; openLast.kind = 'fen'; openLast.top = 'droit'; openingFinish({ x: 6.2 * m, y: -3 * m });  const ow = host2.openings[host2.openings.length - 1]; [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click();
        await open3D(); const sash = []; V3.root.traverse(x => { if (x.userData.door && x.userData.door.slide && x.children.some(c => c.userData.opening === ow)) sash.push(x); }); r.sashes = sash.length;
        if (sash.length === 2) { V3.root.updateMatrixWorld(true); const bb = sash.map(x => new THREE.Box3().setFromObject(x)), c = bb[0].getCenter(new THREE.Vector3()), rp = V3.root.position, a = sash[0].rotation.z, nx = -Math.sin(a), ny = Math.cos(a);
            await momoFPS({ w: { x: mmToWorld((c.x + nx * 1.5 - rp.x) * 1000), y: -mmToWorld((c.y + ny * 1.5 - rp.y) * 1000) } }); const F = V3.fps; F.pos.z = c.z; F.yaw = Math.atan2(c.x - F.pos.x, c.y - F.pos.y); F.pitch = 0;
            const p0 = sash.map(x => x.position.clone()); const ok = fpsDoor(); for (let i = 0; i < 20; i++) fpsStep(0.1); const mv = sash.map((x, k) => x.position.distanceTo(p0[k]));
            V3.root.updateMatrixWorld(true); const b1 = sash.map(x => new THREE.Box3().setFromObject(x)), ovl = Math.min(b1[0].max.x, b1[1].max.x) - Math.max(b1[0].min.x, b1[1].min.x) + Math.min(b1[0].max.y, b1[1].max.y) - Math.max(b1[0].min.y, b1[1].min.y);
            r.wOpen = ok && mv.filter(d => d > 0.4).length === 1 && mv.filter(d => d < 1e-6).length === 1 && ovl > 0.4; fpsDoor(); for (let i = 0; i < 20; i++) fpsStep(0.1); r.wClose = sash.every((x, k) => x.position.distanceTo(p0[k]) < 1e-6);
            V3.fps.back = { az: V3.az, el: V3.el, dist: V3.dist, t: V3.target.clone() }; fpsStop(); }
        close3D(); draw();
        selectedShapes = []; bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    // paroi enregistrée sans hauteur (dessinée pendant que le contour était cassé) : remise à l'étage de son bâtiment à l'ouverture et au dessin, donc visible en 3D
    const wzr = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000);
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(A); saveState(); bldMake(A, 'A', 69000, 3000); saveState();
        const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        const h1 = { type: 'hatch', layerId: activeLayerId, wallMat: 'isolant', groupId: 'g-wz', lvs: 1, loops: [box(1, 1, 5, 1.1)] }, l1 = { type: 'line', layerId: activeLayerId, wallMat: 'isolant', groupId: 'g-wz', lvs: 1, x1: 1 * m, y1: -1 * m, x2: 5 * m, y2: -1 * m };
        const txt = JSON.stringify(Object.assign(projectData(), { shapes: shapes.concat([h1, l1]) })); loadProjectText(txt, 'sans-hauteur.mmc');
        const t = document.getElementById('mc-toast'), H = shapes.find(x => x.type === 'hatch' && x.groupId === 'g-wz'), L = shapes.find(x => x.type === 'line' && x.groupId === 'g-wz');
        const r = { load: !!H && H.wz && H.wz.b === 69000 && H.wz.t === 72000 && L.wz && L.wz.t === 72000 && is3DObj(H), toast: !!t && /hauteur/.test(t.textContent) }; if (t) t.remove();
        await open3D(); let n = 0; V3.root.traverse(o => { if (o.userData && o.userData.shape === H) n++; }); r.mesh = n > 0; close3D();
        const h2 = { type: 'hatch', layerId: activeLayerId, wallMat: 'beton', groupId: 'g-out', loops: [box(14, 1, 18, 1.2)] }; shapes.push(h2); saveState(); r.outside = !!h2.wz && h2.wz.b === 69000 && h2.wz.t === 72000;
        bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('paroi sans hauteur remise à la hauteur de son étage : visible en 3D (ouverture du fichier et dessin hors contour)', wzr, { load: true, toast: true, mesh: true, outside: true });
    t.eq('parois complexes d\'un bloc avec montants ; types en double retirés ; baie libre, arche et chapeau de gendarme, porte de garage (qui s\'ouvre en vue Momo, couleur choisie), fenêtre coulissante', cxo, { presets: true, alias: true, cx: true, studs: true, arche: true, gendarme: true, dialog: true, noJoinery: true, garage: true, colUI: true, garage3d: true, col: true, gOpen: true, gClose: true, sashes: 2, wOpen: true, wClose: true });
    // paroi complexe posée : Y modifie sa composition ; refaite sur le même tracé (même après déplacement et symétrie), ouvertures et hauteur gardées
    const cxy = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), P = (R) => JSON.stringify(R.P.map(q => [+(q.x / m).toFixed(3), +(-q.y / m).toFixed(3)]));
        startWallCx(WALL_CX[0]); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallChainEnd(); setMode('select-box');
        const G = () => shapes.filter(x => x.wallCx), gid = G()[0].groupId, r = { path: P(wallCxRecover(gid)) === '[[0,0],[6,0],[6,4]]' };
        const h = G().find(x => x.type === 'hatch' && !x.stud); h.openings = [{ a: pt(2, 0), b: pt(3, 0), kind: 'porte', sill: 0, h: 2150, pts: openingPts(h, pt(2, 0), pt(3, 0)), layerId: h.layerId }];
        G().forEach(x => { if (x.loops) x.loops.forEach(L => L.forEach(q => { q.x += 10 * m; })); if (x.type === 'line') { x.x1 += 10 * m; x.x2 += 10 * m; } (x.openings || []).forEach(o => { o.a.x += 10 * m; o.b.x += 10 * m; }); });
        r.moved = P(wallCxRecover(gid)) === '[[10,0],[16,0],[16,4]]';
        selectedShapes = G(); openSelectionParamModal(); await new Promise(res => setTimeout(res, 300)); r.tab = !!document.querySelector('#selparam-modal details[data-k=wallcx]');
        spCxSet('e', 1, '100'); const R = wallCxRecover(gid); r.edit = R.def.layers[1][1] === 100 && P(R) === '[[10,0],[16,0],[16,4]]' && G().reduce((a, x) => a + (x.openings || []).length, 0) === 1 && G().every(x => x.wz) && selectedShapes.length === G().length;
        const band0 = () => JSON.stringify(G().filter(x => x.type === 'hatch' && x.cxB === 0).map(x => x.loops[0].map(q => [+(q.x / m).toFixed(3), +(q.y / m).toFixed(3)])).flat().sort());
        G().forEach(x => { if (x.loops) x.loops.forEach(L => L.forEach(q => { q.y = -q.y; })); if (x.type === 'line') { x.y1 = -x.y1; x.y2 = -x.y2; } }); const b0 = band0(); spCxSet('e', 1, '46'); r.mirror = band0() === b0;
        closeSelectionParamModal(); selectedShapes = []; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('paroi complexe : Y modifie sa composition, refaite sur le même tracé (déplacée, symétrisée), ouvertures et hauteur gardées', cxy, { path: true, moved: true, tab: true, edit: true, mirror: true });
    // escalier d'étage : polyligne de bas en haut, relie le RDC au R+1, palier à l'angle, Blondel, garde-corps ; suit la hauteur d'étage
    const esc2 = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState();
        const r = {}; st2Opt.gc = 'deux'; st2Opt.hc = 175; st2Opt.g = 270; st2Opt.just = 'axe'; st2Opt.w = 900; startStair2(); currentPolygon = [pt(1, 1), pt(5, 1), pt(5, 5)]; isDrawing = true; finishPline(); r.noUpper = !shapes.some(x => x.stair2);
        bldActivate(A, 'rdc'); lvlAdd(true); bldActivate(A, 'rdc'); saveState(); startStair2(); currentPolygon = [pt(1, 1), pt(5, 1), pt(5, 5)]; isDrawing = true; finishPline(); t2PanelClose(); setMode('select-box');
        const s = shapes.find(x => x.stair2), G = s && st2Geo(s); r.made = !!G && G.z0 === 100000 && G.z1 === 102800 && G.n === 16 && Math.abs(G.h - 175) < 1e-9 && G.nl === 1 && G.lands.length >= 1 && G.rails.length === 2 && s.bid === A.bld.id;
        r.risers = !!G && G.seg.reduce((a, q) => a + q.t + 1, 0) === G.n && G.treads.length === G.n - 2;
        r.blondel = (() => { st2Edit = s; st2Set('blondel'); return s.stair2.g === 280; })();
        bldSetH('rdc', '3,00'); const G2 = st2Geo(s); r.follow = G2.z1 === 103000 && G2.n === 17;
        selectedShapes = [s]; openSelectionParamModal(); await new Promise(res => setTimeout(res, 300)); r.y = !!document.querySelector('#selparam-modal details[data-k=stair2]') && !!document.getElementById('st2-w'); closeSelectionParamModal(); selectedShapes = []; st2Edit = null;
        await open3D(); let n = 0; V3.root.traverse(o => { if (o.userData && o.userData.shape === s) n++; }); r.mesh3d = n > 20; close3D();
        bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('escalier d\'étage : polyligne de bas en haut entre deux étages voisins, palier à l\'angle, Blondel, garde-corps, suit la hauteur d\'étage, réglable avec Y, en 3D', esc2, { noUpper: true, made: true, risers: true, blondel: true, follow: true, y: true, mesh3d: true });
    // ossature = une couche à part : ses montants restent dans sa bande quand on la déplace ; anciennes compositions (montants « dans » une couche) converties
    const oss = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        r.presets = WALL_CX.every(d => !d.studs) && WALL_CX[0].layers[1][0] === 'oss-metal' && JSON.stringify(cxNorm({ name: 'x', layers: [['placo', 13], ['isolant', 46]], studs: { li: 1, mat: 'bois', w: 45, sp: 400 } }).layers[1]) === JSON.stringify(['oss-bois', 46, { w: 45, sp: 400, fill: 'isolant' }]);
        startWallCx({ name: 'T', layers: [['placo', 13], ['oss-metal', 48, { w: 35, sp: 600, fill: 'air' }], ['placo', 13]] }); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(3, 0).x, pt(3, 0).y); wallChainEnd(); setMode('select-box');
        const G = () => shapes.filter(x => x.wallCx), gid = G()[0].groupId, band = (mt) => { const off = (h) => Math.min(...h.loops[0].map(q => -q.y / m)); return off; };
        const studY = () => { const S = G().filter(x => x.stud); return S.length ? [Math.min(...S.map(x => Math.min(...x.loops[0].map(q => -q.y)))), Math.max(...S.map(x => Math.max(...x.loops[0].map(q => -q.y))))].map(v => +(worldToMm(v)).toFixed(1)) : null; };
        r.vide = G().filter(x => x.type === 'hatch' && !x.stud).length === 2 && G().filter(x => x.stud).length === 6;
        const y0 = studY(); selectedShapes = G(); spCxSet('up', 1); const y1 = studY(); r.moved = !!y0 && !!y1 && Math.abs((y0[1] - y0[0]) - 48) < 0.5 && Math.abs((y1[1] - y1[0]) - 48) < 0.5 && Math.abs(y1[0] - y0[0]) > 5 && wallCxRecover(gid).def.layers[0][0] === 'oss-metal';
        spCxSet('ofill', 0, 'isolant'); r.fill = G().some(x => x.type === 'hatch' && !x.stud && x.wallMat === 'isolant'); closeSelectionParamModal();
        selectedShapes = []; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('parois complexes : l\'ossature est une couche (montants dans sa bande, même déplacée), remplissage vide ou isolant, anciennes compositions converties', oss, { presets: true, vide: true, moved: true, fill: true });
    // étage du dessus actif : le RDC reste visible (translucide) mais ne se clique pas, même un mur posé à cheval sur le contour
    const up = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState(); bldActivate(A, 'rdc'); lvlAdd(true); saveState();
        const W = { type: 'hatch', layerId: activeLayerId, wallMat: 'beton', groupId: 'g-up', lvs: 1, wz: { b: 100000, t: 102800 }, loops: [[pt(2, -0.15), pt(8, -0.15), pt(8, 0.05), pt(2, 0.05)]] }; shapes.push(W); saveState();
        const r = { bid: W.bid === A.bld.id }; const hi = lvlSorted()[1].id; bldPick(hi); zoomExtents(); draw(); const c = { x: 5 * m, y: -(-0.05) * m };
        r.noClick = findShapeAt(c.x, c.y) !== W; r.below = lvlBelow(W) && !lvlHidden(W);
        bldAll(); bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('étage du dessus actif : le RDC translucide, ni cliquable ni accrochable (mur à cheval sur le contour compris)', up, { bid: true, noClick: true, below: true });
    // contour de bâtiment + outil Dalle : une dalle à part sous le plancher (le contour reste un contour) ; ancien fichier réparé ; un trait d'étage n'entre jamais dans le terrain
    const bd = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState();
        selectedShapes = [A]; startSolidTool('dalle'); closeSelectionParamModal(); const D = shapes.find(x => x.solid && !x.bld), r = { split: !A.solid && !!D && D.points.every(q => q.z === 99800) && D.bid === A.bld.id };
        shapes = shapes.filter(x => x !== D); A.solid = { kind: 'box', H: 200 }; A.points.forEach(q => { q.z = 0; }); const txt = JSON.stringify(projectData()); loadProjectText(txt, 'dalle.mmc'); const t = document.getElementById('mc-toast');
        const A2 = shapes.find(x => x.bld), D2 = shapes.find(x => x.solid && !x.bld); r.load = !A2.solid && !!D2 && D2.points[0].z === 99800 && !!t && /dalle/.test(t.textContent); if (t) t.remove();
        const L = { type: 'line', layerId: activeLayerId, x1: 2 * m, y1: -2 * m, x2: 3 * m, y2: -2 * m, z2: 0, lvl: 'rdc', bid: A2.bld.id, zk: 1, lvs: 1 }; shapes.push(L); invalidateCache(); r.noTin = !tinNodes().some(n => n.z === 0);
        selectedShapes = []; bldActivate(null); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('contour de bâtiment + Dalle : une dalle à part sous le plancher, ancien fichier réparé ; un trait d\'étage ne fait jamais le terrain', bd, { split: true, load: true, noTin: true });
    // panneau des étages : coupe du bâtiment cliquable (étages, sous-sol, toit) ; vue de dessus d'un contour fermée
    const bs = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState();
        bldOpen(A.bld.id); await new Promise(res => setTimeout(res, 300)); bldAdd(true); bldAdd(false); await new Promise(res => setTimeout(res, 200));
        const svg = document.querySelector('#bld-lv svg'), gs = svg ? [...svg.querySelectorAll('g[onclick]')] : [], r = { svg: !!svg && gs.length === 4 };
        const up = lvlSorted().find(l => l.z > 100000); gs.find(g => g.getAttribute('onclick').includes(up.id)).dispatchEvent(new MouseEvent('click', { bubbles: true })); r.pick = lvlOn && lvlAct === up.id;
        gs.find(g => g.getAttribute('onclick').includes('toit')).dispatchEvent(new MouseEvent('click', { bubbles: true })); r.roof = lvlAct === 'toit';
        const th = document.querySelector('#sp-thumb path'); r.closed = !!th && /Z$/.test(th.getAttribute('d'));
        closeSelectionParamModal(); selectedShapes = []; bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('étages : coupe du bâtiment cliquable (étage, sous-sol, toit), vue de dessus fermée', bs, { svg: true, pick: true, roof: true, closed: true });
    // trémie automatique dans la dalle du dessus ; escalier sélectionnable dans son emprise et visible sur ses deux étages ; 3D : tous les étages ; étage de toiture (égout)
    const trem = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState(); bldActivate(A, 'rdc'); lvlAdd(true); saveState();
        const hi = lvlSorted()[1].id; bldPick(hi); selectedShapes = [A]; startSolidTool('dalle'); closeSelectionParamModal(); const D = shapes.find(x => x.solid && !x.bld);
        bldPick('rdc'); startStair2(); currentPolygon = [pt(1, 1), pt(5, 1), pt(5, 5)]; isDrawing = true; finishPline(); t2PanelClose(); setMode('select-box'); const s = shapes.find(x => x.stair2); await loadPolyClip();
        const r = {}; const T = slabTremies(D); r.tremie = T.length === 1 && T[0][0].length >= 5;
        bldPick(hi); r.upper = !lvlOff2D(s) && findShapeAt(pt(3, 1.25).x, pt(3, 1.25).y) === s; bldPick('rdc'); r.lower = findShapeAt(pt(3, 1.25).x, pt(3, 1.25).y) === s;
        await open3D(); let n = 0; V3.root.traverse(o => { if (o.userData && o.userData.shape === D) n++; }); r.d3 = n > 0; close3D();
        bldAddRoof(); const L = lvlSorted(), Tl = L[L.length - 1]; r.roof = !!Tl.roofLv && Tl.z === 105600 && bldEgout(A) === 105600 + Tl.h; bldAdd(true); const L2 = lvlSorted(); r.roofTop = !!L2[L2.length - 1].roofLv && L2.length === 4;
        bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('trémie découpée dans la dalle du dessus, escalier cliquable dans son emprise sur ses deux étages, 3D avec tous les étages, étage de toiture (égout) toujours en haut', trem, { tremie: true, upper: true, lower: true, d3: true, roof: true, roofTop: true });
    /* trémie nette loin de l'origine (coordonnées Lambert) et sur un axe en biais : un seul contour, sans trou ni lanière de dalle, sans sommets parasites */
    const tremF = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; await loadPolyClip(); const m = mmToWorld(1000), an = 0.3, OX = 1946000, OY = 4155000;
        const pt = (x, y) => ({ x: (OX + x * Math.cos(an) - y * Math.sin(an)) * m, y: -(OY + x * Math.sin(an) + y * Math.cos(an)) * m });
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState(); bldActivate(A, 'rdc'); lvlAdd(true); saveState();
        const hi = lvlSorted()[1].id; bldPick(hi); selectedShapes = [A]; startSolidTool('dalle'); closeSelectionParamModal(); const D = shapes.find(x => x.solid && !x.bld);
        bldPick('rdc'); startStair2(); currentPolygon = [pt(1, 1), pt(5, 1), pt(5, 5)]; isDrawing = true; finishPline(); t2PanelClose(); setMode('select-box');
        const T = slabTremies(D), r = { n: T.length, rings: T.map(p => p.length), pts: T[0] ? T[0][0].length <= 7 : false };
        bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('trémie nette loin de l\'origine et en biais : un contour, sans trou, sans sommets parasites', tremF, { n: 1, rings: [1], pts: true });
    /* collisions : le volume commun en rouge se masque et se réaffiche sans perdre la liste */
    const colT = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 100000 }));
        shapes.push({ type: 'poly', layerId: 'layer-0', points: R(0, 0, 4, 4), solid: { kind: 'box', H: 2000 }, zk: 1 }, { type: 'poly', layerId: 'layer-0', points: R(2, 2, 6, 6), solid: { kind: 'box', H: 2000 }, zk: 1 }); saveState();
        await open3D(); await d3Collisions(); const r = { n: d3Col.length }, btn = () => [...document.querySelectorAll('#t2-panel button')].find(b => /les zones/.test(b.textContent));
        const b = btn(); r.btn = !!b && b.textContent === 'Masquer les zones'; if (b) b.click(); r.hidden = V3.col.visible === false && btn().textContent === 'Afficher les zones' && d3Col.length === 1; if (btn()) btn().click(); r.shown = V3.col.visible === true;
        d3ColClear(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('collisions : bouton pour masquer / réafficher les zones en conflit', colT, { n: 1, btn: true, hidden: true, shown: true });
    /* collisions : une dalle en conflit avec un mur est découpée en plan autour du mur (contour redessiné, en deux dalles si le mur la traverse), plus de conflit */
    const colP = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {})), r = {};
        const D = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 6, 4, 100000), solid: { kind: 'box', H: 200 }, zk: 1, name: 'Dalle' }, wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] });
        const W1 = { type: 'hatch', layerId: wl, loops: [R(2, -1, 2.2, 5)], wallMat: 'parpaing', groupId: 'cw1', wz: { b: 99800, t: 102700 } }, W2 = { type: 'hatch', layerId: wl, loops: [R(4.5, 3, 6.5, 3.2)], wallMat: 'parpaing', groupId: 'cw2', wz: { b: 99800, t: 102700 } };
        shapes.push(D, W1, W2); saveState(); await open3D(); await d3Collisions(); r.n = d3Col.length; r.btns = [...document.querySelectorAll('#t2-panel button')].filter(b => /Découper Dalle/.test(b.textContent)).length;
        const k1 = d3Col.findIndex(c => c.a === W1 || c.b === W1); d3ColCutPair(k1, d3Col[k1].b === D); await new Promise(res => setTimeout(res, 200)); await d3Collisions();
        const Ds = shapes.filter(x => x.name === 'Dalle'); r.split = Ds.length === 2 && !Ds.some(x => x.carve) && Ds.every(x => x.points.every(q => q.x <= 2 * m + 1e-6 || q.x >= 2.2 * m - 1e-6)); r.left = d3Col.length;
        const k2 = d3Col.findIndex(c => c.a === W2 || c.b === W2); if (k2 >= 0) d3ColCutPair(k2, d3Col[k2].b !== W2); await new Promise(res => setTimeout(res, 200)); await d3Collisions();
        const area = (P) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2 / (m * m); r.area = Math.round(shapes.filter(x => x.name === 'Dalle').reduce((a, x) => a + area(x.points), 0) * 100) / 100; r.after = d3Col.length;
        d3ColClear(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('collisions : la dalle est découpée en plan autour du mur (deux dalles si le mur la traverse), plus de conflit', colP, { n: 2, btns: 2, split: true, left: 1, area: 22.9, after: 0 });
    // coupe en mise à jour automatique : recalculée à part (pastille bleue « calcul en cours »), la saisie n'est pas figée ; le clic sur la pastille montre le calcul avant de le faire
    const sq = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {})), r = {};
        for (let i = 0; i <= 6; i++) for (let j = 0; j <= 4; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const B = { type: 'poly', layerId: 'layer-0', points: R(10, 5, 20, 12, 100000), solid: { kind: 'box', H: 3000 }, zk: 1 }; shapes.push(B); saveState();
        sectionPlace(sectionData({ x: 5 * m, y: -8 * m }, { x: 25 * m, y: -8 * m }, 1), { x: 15 * m, y: -40 * m }); const L = shapes.find(x => x.cutDef && x.type === 'line'), d = L.cutDef; d.auto = true;
        B.points.forEach(q => { q.x += 2 * m; }); saveState(); clearTimeout(secTimer); secRefreshAll(); r.queued = SEC_BUSY.has(d.id) && secStale(L);   /* pas calculée dans le geste */
        zoomToFitShapes(shapes.filter(x => x.secOf === d.id || x === L)); draw(); r.blue = secBadgeHits.some(h => h.id === d.id); for (let i = 0; i < 40 && SEC_BUSY.size; i++) await new Promise(res => setTimeout(res, 100)); r.done = !SEC_BUSY.has(d.id) && !secStale(L);
        B.points.forEach(q => { q.x -= 2 * m; }); saveState(); clearTimeout(secTimer); d.auto = false; secForce(d.id); r.forceBusy = SEC_BUSY.has(d.id); for (let i = 0; i < 40 && SEC_BUSY.size; i++) await new Promise(res => setTimeout(res, 100)); r.forced = !SEC_BUSY.has(d.id) && !secStale(L);
        shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('coupe automatique recalculée à part (pastille « calcul en cours »), sans figer la saisie ; clic pastille : calcul montré puis fait', sq, { queued: true, blue: true, done: true, forceBusy: true, forced: true });
    /* collisions : un mur traversé par un poteau (sur toute sa hauteur) est découpé en plan : deux morceaux de mur, bords refaits, la fenêtre reste dans son morceau ; un poteau plus court que le mur → découpe 3D */
    const colW = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {})), r = {};
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }), W = { type: 'hatch', layerId: wl, loops: [R(0, 0, 10, 0.2)], wallMat: 'parpaing', groupId: 'cw9', wz: { b: 100000, t: 102700 } };
        W.openings = [{ kind: 'fen', a: { x: 7 * m, y: 0 }, b: { x: 8 * m, y: 0 }, pts: R(7, 0, 8, 0.2), w: 1000, h: 1200, sill: 900 }];
        const Pt = { type: 'poly', layerId: 'layer-0', points: R(4.8, -0.1, 5.2, 0.3, 99900), solid: { kind: 'box', H: 3000 }, zk: 1, name: 'Poteau' };
        shapes.push(W, Pt); wallBordersRepair(); saveState(); await open3D(); await d3Collisions(); r.n = d3Col.length; const k = d3Col.findIndex(c => c.a === W || c.b === W); d3ColCutPair(k, d3Col[k].b === W);
        await new Promise(res => setTimeout(res, 200)); await d3Collisions(); const H = shapes.filter(x => x.type === 'hatch' && x.groupId === 'cw9'); r.pieces = H.length; r.notCarved = H.every(x => !x.carve);
        r.gap = H.every(x => x.loops[0].every(q => q.x <= 4.8 * m + 1e-6 || q.x >= 5.2 * m - 1e-6)); r.win = H.filter(x => (x.openings || []).length === 1).length === 1 && H.find(x => (x.openings || []).length).loops[0].some(q => q.x > 6 * m);
        r.borders = shapes.filter(x => x.type === 'line' && x.wallMat).length >= 6; r.after = d3Col.length;
        // poteau plus court : le mur garde son contour, découpe 3D
        shapes = []; const W2 = { type: 'hatch', layerId: wl, loops: [R(0, 0, 10, 0.2)], wallMat: 'parpaing', groupId: 'cw8', wz: { b: 100000, t: 102700 } }, P2 = { type: 'poly', layerId: 'layer-0', points: R(4.8, -0.1, 5.2, 0.3, 99900), solid: { kind: 'box', H: 1500 }, zk: 1 };
        shapes.push(W2, P2); wallBordersRepair(); saveState(); await d3Collisions(); const k2 = d3Col.findIndex(c => c.a === W2 || c.b === W2); d3ColCutPair(k2, d3Col[k2].b === W2); await new Promise(res => setTimeout(res, 200));
        r.short = W2.loops[0].length === 4 && (W2.carve || []).length === 1;
        d3ColClear(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('collisions : mur traversé par un poteau découpé en plan (deux morceaux, bords, fenêtre gardée) ; poteau plus court : découpe 3D', colW, { n: 1, pieces: 2, notCarved: true, gap: true, win: true, borders: true, after: 0, short: true });
    /* menuiseries texturées : porte de garage et porte d'entrée en bois (Y › Couleurs › Texture), et au pinceau de la vue 3D d'un clic sur la porte ; le vitrage n'en prend jamais */
    const opTx = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), M = mmToWorld, r = {};
        startWall('w-beton20'); wallStart = { x: 0, y: 0 }; wallAddTo(10 * m, 0); setMode('select-box'); await new Promise(q => setTimeout(q, 200)); const host = shapes.filter(isWallHatch).pop();
        openA = { x: 2 * m, y: 0 }; openWall = host; openDir = { x: 0, y: -1 }; openLast.kind = 'garage'; openLast.top = 'droit'; openingFinish({ x: 4.5 * m, y: 0 });
        const sel = document.getElementById('op-tex'); r.ui = !!sel && [...sel.options].some(o => o.value === 'bardage-noir'); if (sel) sel.value = 'bardage-noir'; [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click();
        const og = host.openings[host.openings.length - 1]; r.saved = og.tex === 'bardage-noir';
        await open3D(); let tx = 0; V3.root.traverse(x => { if (x.isMesh && x.userData.opening === og && x.material && x.material.map) tx++; }); r.tex3d = tx >= 5;
        // pinceau : clic sur le tablier, il prend la texture choisie
        startPaint('paint', true); texPaint.tex = 'pierre-brute'; V3.root.updateMatrixWorld(true); let leaf = null; V3.root.traverse(x => { if (!leaf && x.isMesh && x.userData.leaf === og) leaf = x; });
        const cv = V3.renderer.domElement, rc = cv.getBoundingClientRect(), bb = new THREE.Box3().setFromObject(leaf), c = bb.getCenter(new THREE.Vector3()); V3.target.copy(c); V3.dist = 6; render3D();
        const v = c.clone().project(V3.camera); pick3D({ clientX: rc.left + (v.x + 1) / 2 * rc.width, clientY: rc.top + (1 - v.y) / 2 * rc.height, shiftKey: false }); r.painted = og.tex === 'pierre-brute';
        let glassTex = false; V3.root.traverse(x => { if (x.isMesh && x.userData.opening && x.material && x.material.transparent && x.material.map) glassTex = true; }); r.noGlass = !glassTex;
        try { texStop(); } catch (e) {} close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('menuiseries texturées : texture au Y (porte de garage), en 3D, et au pinceau d\'un clic sur la porte ; vitrage jamais texturé', opTx, { ui: true, saved: true, tex3d: true, painted: true, noGlass: true });
    /* paroi plus épaisse que la baie dessinée (doublage, ossature, isolant) : la porte la perce de part en part ; escalier jusqu'au sol fini d'une dalle posée sur le niveau, et sa trémie */
    const pt3 = await ev(async () => { await loadThree(); await loadPolyClip(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {}));
        const wz = { b: 100000, t: 102700 }, wl = wallLayerId({ layers: [{ mat: 'placo', e: 13 }] });
        const A = { type: 'hatch', layerId: wl, loops: [R(0, 0, 6, 0.013)], wallMat: 'placo', groupId: 'pc', wz }, B = { type: 'hatch', layerId: wl, loops: [R(0, 0.013, 6, 0.1)], wallMat: 'isolant', groupId: 'pc', wz }, C = { type: 'hatch', layerId: wl, loops: [R(0, 0.1, 6, 0.113)], wallMat: 'placo', groupId: 'pc', wz };
        const o = { kind: 'porte', sill: 0, h: 2150, hinge: 'a', side: 1, pts: R(2, 0.02, 2.9, 0.09), a: { x: 2 * m, y: -0.02 * m }, b: { x: 2.9 * m, y: -0.02 * m }, top: 'droit' }; B.openings = [o]; shapes.push(A, B, C); saveState();
        const vol = (x) => signedVol(objTrisMM(x)) / 1e9; r.all = [A, B, C].every(w => wallOpeningsFor(w).includes(o)); r.cut = [A, C].every(w => Math.abs(vol(w) - 0.013 * (2.7 * 6 - 0.9 * 2.15)) < 2e-3);
        shapes = []; const lv = [{ id: 'rdc', z: 100000, h: 3000 }, { id: 'r1', z: 103000, h: 3000 }], Zb = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 8, 6), bld: { id: 'bz', nm: 'M', lvls: lv, act: 'rdc' } };
        const Sl = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 8, 6, 103000), solid: { kind: 'box', H: 200 }, zk: 1, name: 'Dalle', lvl: 'r1', bid: 'bz' };
        const St = { type: 'poly', open: true, layerId: 'layer-0', points: [{ x: 1 * m, y: -1 * m }, { x: 6 * m, y: -1 * m }], name: 'Escalier', lvl: 'rdc', bid: 'bz', stair2: { just: 'droite', w: 1000, hc: 175, g: 270, nez: 30, mat: 'beton', gc: 'droite', gch: 1000, lo: 'rdc', hi: 'r1', z0: 100000, z1: 103000, bid: 'bz' } };
        shapes.push(Zb, Sl, St); invalidateCache(); saveState(); r.top = st2Z(St).z1 === 103200; r.tremie = slabTremies(Sl).length === 1;
        shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('porte dans une paroi plus épaisse que la baie : toutes les couches percées ; escalier jusqu\'au sol fini d\'une dalle posée sur le niveau, avec sa trémie', pt3, { all: true, cut: true, top: true, tremie: true });
    /* découpe 3D (volet 3D › Outils) : clic sur la partie à enlever, clic sur un plan qui coupe ; plan incliné gardé sur l'objet (suit ses déplacements, enregistré), plan vertical = recoupe en plan aussi */
    const cut3T = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), r = {}, R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z }));
        const A = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 10, 4, 100000), solid: { kind: 'box', H: 3000 }, zk: 1, name: 'Poutre' }, B = { type: 'poly', layerId: 'layer-0', points: R(6, -2, 6.5, 6, 100000), solid: { kind: 'box', H: 4000 }, zk: 1, name: 'Voile' };
        shapes.push(A, B); saveState(); const vol = (o) => Math.round(signedVol(objTrisMM(o)) / 1e9 * 1000) / 1000;
        const s2 = Math.SQRT1_2; r.incl = cut3Apply(A, [5000, 2000, 101500], [s2, 0, s2], [9000, 2000, 102900]) && vol(A) === 60 && (A.cut3 || []).length === 1 && !A.cuts;
        const txt = JSON.stringify(projectData()); loadProjectText(txt, 'c3.mmc'); await new Promise(q => setTimeout(q, 300)); let A2 = shapes.find(x => x.name === 'Poutre'); r.saved = vol(A2) === 60; translateShape(A2, 3 * m, 0); r.follows = Math.abs(vol(A2) - 60) < 0.01;
        r.miss = !cut3Apply(A2, [0, 0, 200000], [0, 0, 1], [1000, 1000, 201000]) && (A2.cut3 || []).length === 1;   // un plan qui ne coupe pas : rien ne change
        selectedShapes = [A2]; carveClear(); r.clear = !A2.cut3 && vol(A2) === 120; translateShape(A2, -3 * m, 0); selectedShapes = []; saveState();
        await open3D(); await new Promise(q => setTimeout(q, 500)); A2 = shapes.find(x => x.name === 'Poutre');
        const cv = V3.renderer.domElement, rc = cv.getBoundingClientRect(), rp = V3.root.position, sc = (x, y, z) => { const v = new THREE.Vector3(x / 1000 + rp.x, y / 1000 + rp.y, (z / 1000 - V3.zmin) * V3.exag + rp.z).project(V3.camera); return { clientX: rc.left + (v.x + 1) / 2 * rc.width, clientY: rc.top + (1 - v.y) / 2 * rc.height }; };
        v3Panel('outils'); const card = [...document.querySelectorAll('#t2-panel .v3v-card')].find(x => /Découpe 3D/.test(x.textContent)); r.card = !!card && ![...document.querySelectorAll('#t2-panel .v3v-card')].some(x => /Collisions/.test(x.textContent)); card && card.click();
        cut3Click(sc(2000, 2000, 103000)); r.picked = !!V3.cut3 && V3.cut3.s === A2; cut3Click(sc(6000, 5500, 101000)); r.vert = (A2.cuts || []).length === 1 && vol(A2) === 48 && !V3.cut3;
        cut3Start(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); r.esc = !V3.cut3;
        close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('découpe 3D : clic sur le bout à enlever puis sur un plan ; plan incliné gardé (fichier, déplacement), plan qui ne coupe pas refusé, Y retire, plan vertical = recoupe ; plus d\'outil Collisions', cut3T, { incl: true, saved: true, follows: true, miss: true, clear: true, card: true, picked: true, vert: true, esc: true });
    /* collisions : les murs entre eux (couches, angles, jonctions) ne comptent pas ; clic sur une collision = seule sa zone s'allume (orange), les objets ne sont pas sélectionnés */
    const colM = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1, z) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign({ x: x * m, y: -y * m }, z !== undefined ? { z } : {})), r = {};
        const wl = wallLayerId({ layers: [{ mat: 'parpaing', e: 200 }] }), wz = { b: 100000, t: 102700 };
        shapes.push({ type: 'hatch', layerId: wl, loops: [R(0, 0, 10, 0.2)], wallMat: 'beton', groupId: 'm1', wz }, { type: 'hatch', layerId: wl, loops: [R(0, 0.2, 10, 0.3)], wallMat: 'isolant', groupId: 'm2', wz }, { type: 'hatch', layerId: wl, loops: [R(5, -3, 5.2, 3)], wallMat: 'beton', groupId: 'm3', wz }, { type: 'hatch', layerId: wl, loops: [R(1, -1, 1.05, 1)], wallMat: 'metal', stud: 1, wallCx: 1, groupId: 'm4', wz: { b: 100000, t: 103200 } });
        const D = { type: 'poly', layerId: 'layer-0', points: R(-1, -2, 3, 2, 102600), solid: { kind: 'box', H: 300 }, zk: 1, name: 'Dalle' }; shapes.push(D); wallBordersRepair(); saveState(); await open3D(); await d3Collisions();
        r.onlySlab = d3Col.length >= 1 && d3Col.every(c => c.a === D || c.b === D); r.noStud = !d3Col.some(c => c.a.stud || c.b.stud); selectedShapes = []; const k = 0; d3ColPick(k);
        const Z = V3.col.children.filter(x => x.isMesh), hot = Z.filter(x => x.material.color.getHex() === 0xf59e0b); r.zoneOnly = selectedShapes.length === 0 && hot.length === 1 && hot[0].userData.colK === 0;
        d3ColClear(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('collisions : murs entre eux et ossature des parois ignorés ; une collision choisie = seule sa zone en orange', colM, { onlySlab: true, noStud: true, zoneOnly: true });
    /* collisions : clic molette sur une zone = objet suivant de la zone ; Entrée = l'objet choisi reste entier et coupe tous ceux qui le touchent (découpe retirable par Y) */
    const colC = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 100000 })), r = {};
        const A = { type: 'poly', layerId: 'layer-0', points: R(0, 0, 4, 4), solid: { kind: 'box', H: 2000 }, zk: 1, name: 'A', roofPart: 1 },   /* A : pièce de toiture, découpée en 3D ; C : volume extrudé, découpé en plan */ B = { type: 'poly', layerId: 'layer-0', points: R(2, 2, 6, 6), solid: { kind: 'box', H: 2000 }, zk: 1, name: 'B' }, C = { type: 'poly', layerId: 'layer-0', points: R(5, 5, 9, 9), solid: { kind: 'box', H: 2000 }, zk: 1, name: 'C' };
        shapes.push(A, B, C); saveState(); await open3D(); await d3Collisions(); r.n = d3Col.length; r.btn = [...document.querySelectorAll('#t2-panel button')].some(b => /Couper les autres/.test(b.textContent));
        const vol = (o) => Math.round(Math.abs(signedVol(objTrisMM(o))) / 1e9 * 10) / 10, scr = (k) => { const mm = V3.col.children.find(x => x.isMesh && x.userData.colK === k); mm.geometry.computeBoundingSphere(); V3.col.updateMatrixWorld(true); const c = mm.geometry.boundingSphere.center.clone().applyMatrix4(mm.matrixWorld).project(V3.camera), rc = V3.renderer.domElement.getBoundingClientRect(); return { clientX: rc.left + (c.x + 1) / 2 * rc.width, clientY: rc.top + (1 - c.y) / 2 * rc.height }; };
        const kAB = d3Col.findIndex(c => (c.a === A && c.b === B) || (c.a === B && c.b === A)), seen = []; for (let i = 0; i < 3; i++) { d3ColCycle(scr(kAB)); seen.push(d3ColSel && d3ColSel.name); } r.cycle = seen.join(',');
        while (d3ColSel !== B) d3ColCycle(scr(kAB)); r.sel = d3ColSel === B && !selectedShapes.includes(B) && /B/.test(document.getElementById('d3col-sel').textContent);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); r.focus = (document.activeElement || {}).tagName; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(res => setTimeout(res, 200)); await d3Collisions();
        r.carved = (A.carve || []).length === 1 && !C.carve && C.points.length === 6 && !B.carve; r.vol = [vol(A), vol(B), vol(C)]; r.after = d3Col.length;
        selectedShapes = [A]; openSelectionParamModal(); r.y = !!document.querySelector('#selparam-modal [onclick*="carveClear"]'); closeSelectionParamModal(); selectedShapes = [A]; carveClear(null); r.back = !A.carve && vol(A) === 32;
        d3ColClear(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('collisions : clic molette fait défiler les objets de la zone, Entrée garde l\'objet choisi entier et coupe les autres (découpe retirable)', colC, { n: 2, btn: true, cycle: 'A,B,A', sel: true, focus: 'BODY', carved: true, vol: [24, 32, 30], after: 0, y: true, back: true });
    // Recouper : trait + côté gardé ; plan et 3D coupés ; suit un déplacement ; se retire ; porte de garage (ouverture sectionnelle)
    const rcp1 = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const D = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })), solid: { kind: 'pyr', H: 3000, k: 0.3 }, zk: 1, name: 'Toit' }; shapes.push(D); saveState();
        selectedShapes = [D]; startRecoupe(); rcpClick(pt(6, -1).x, pt(6, -1).y); rcpClick(pt(6, 9).x, pt(6, 9).y); rcpClick(pt(2, 4).x, pt(2, 4).y); r.cut = (D.cuts || []).length === 1 && mode === 'select-box';
        const bbx = async () => { await open3D(); let mx = -1e9, mn = 1e9; V3.root.traverse(o => { if (o.isMesh && o.userData.shape === D) { o.geometry.computeBoundingBox(); mx = Math.max(mx, o.geometry.boundingBox.max.x); mn = Math.min(mn, o.geometry.boundingBox.min.x); } }); close3D(); return mx - mn; };
        r.d3 = Math.abs(await bbx() - 6) < 0.05;
        D.points.forEach(q => { q.x += 20 * m; }); xPtsOf(D).forEach(L => L.forEach(q => { q.x += 20 * m; })); r.moved = Math.abs(await bbx() - 6) < 0.05;
        selectedShapes = [D]; rcpClear(null); closeSelectionParamModal(); r.clear = !D.cuts && Math.abs(await bbx() - 10) < 0.05;
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('recouper : le côté non gardé disparaît (plan et 3D), la recoupe suit l\'objet et se retire', rcp1, { cut: true, d3: true, moved: true, clear: true });
    // drapeau d'ancrage de la vue 3D : bouton de la rosace, un clic sur la maquette le plante ; la vue tourne et zoome autour, le déplacement ne le quitte pas
    const pin = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        [[0, 0], [20, 0], [0, 15]].forEach(([x0, y0], i) => shapes.push({ type: 'poly', layerId: activeLayerId, points: [[x0, y0], [x0 + 6, y0], [x0 + 6, y0 + 5], [x0, y0 + 5]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })), solid: { kind: 'box', H: 3000 + i * 1000 }, zk: 1 }));
        saveState(); await open3D(); r.btn = [...document.querySelectorAll('#v3-rose g[onclick]')].some(g => /v3PinToggle/.test(g.getAttribute('onclick')));
        const rose = () => [...document.querySelectorAll('#v3-rose g[onclick]')].find(g => /v3PinToggle/.test(g.getAttribute('onclick'))); v3PinToggle(); r.pick = !!V3.pinPick; r.cursor = /^url\(/.test(V3.renderer.domElement.style.cursor); r.empty = !rose().querySelector('path') && !!rose().querySelector('circle[stroke-dasharray]'); let me = null; V3.root.traverse(o => { if (!me && o.isMesh && o.userData.shape === shapes[0]) me = o; }); me.geometry.computeBoundingBox(); const c = me.geometry.boundingBox.getCenter(new THREE.Vector3()); c.z = me.geometry.boundingBox.max.z; me.localToWorld(c);
        const v = c.clone().project(V3.camera), cr = V3.renderer.domElement.getBoundingClientRect(); v3PinAt({ clientX: cr.left + (v.x + 1) / 2 * cr.width, clientY: cr.top + (1 - v.y) / 2 * cr.height });
        r.set = !!V3.pin && !V3.pinPick && V3.pin.distanceTo(c) < 0.5; r.cursorBack = V3.renderer.domElement.style.cursor === ''; r.green = rose().querySelector('circle').getAttribute('stroke') === '#bef264' && rose().querySelector('circle').getAttribute('fill') === '#1a2e05'; V3.az += 1; V3.target.set(0, 0, 0); render3D(); r.stays = V3.target.distanceTo(V3.pin) < 1e-6 && !!V3.pinMesh && V3.pinMesh.visible;
        V3.fps = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 }; try { render3D(); } catch (e) {} r.fpsHidden = !V3.pinMesh.visible; V3.fps = null; render3D();
        { const R0 = v3PinReal(), d0 = isDirty(), txt = JSON.stringify(projectData()); r.saved = !!JSON.parse(txt).pin3d && d0; close3D(); loadProjectText(txt, 'drapeau.mmc'); await new Promise(res => setTimeout(res, 400)); await open3D(); const R1 = v3PinReal();
            r.back = !!R1 && Math.hypot(R1.x - R0.x, R1.y - R0.y, R1.z - R0.z) < 0.01 && V3.target.distanceTo(V3.pin) < 1e-6 && V3.pinMesh.visible;
            /* plan rouvert alors que la vue 3D est ouverte : le drapeau revient aussi */ loadProjectText(txt, 'drapeau2.mmc'); await new Promise(res => setTimeout(res, 700)); const R2 = v3PinReal(); r.openIn3D = !!R2 && Math.hypot(R2.x - R0.x, R2.y - R0.y, R2.z - R0.z) < 0.01 && V3.pinMesh.visible;
            /* jamais dans une image : rendu photo, fenêtre 3D de présentation */ V3.noPin = true; render3D(); r.noShot = !V3.pinMesh.visible; V3.noPin = false; render3D(); r.noShot = r.noShot && V3.pinMesh.visible; }   /* drapeau gardé dans le fichier et retrouvé */
        v3PinToggle(); r.off = !V3.pin && !V3.pinMesh.visible && JSON.parse(JSON.stringify(projectData())).pin3d === null; close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('vue 3D : drapeau d\'ancrage (rosace) planté d\'un clic, la vue reste centrée sur lui, gardé dans le fichier (même rouvert en 3D), absent des rendus, se retire', pin, { btn: true, pick: true, cursor: true, empty: true, set: true, cursorBack: true, green: true, stays: true, fpsHidden: true, saved: true, back: true, openIn3D: true, noShot: true, off: true });
    // recoupe d'un toit (pan + pignons, surfaces ouvertes) : coupé par le plan vertical, la partie retirée ne réapparaît pas ailleurs
    const rcp2 = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const base = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [10, 0], [10, 6], [0, 6]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })) }; shapes.push(base); roofDialog(base, true); document.querySelector('input[name=rf-p][value="1"]').click();
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click(); await new Promise(res => setTimeout(res, 200));
        const R = shapes.find(x => x.solid && x.solid.kind === 'roof'), span = async () => { await open3D(); let mx = -1e9, mn = 1e9, n = 0; V3.root.traverse(o => { if (o.isMesh && o.userData.shape && (o.userData.shape === R || (R.groupId && o.userData.shape.groupId === R.groupId))) { o.updateMatrixWorld(); const p = o.geometry.attributes.position.array; n += p.length; for (let i = 0; i < p.length; i += 3) { const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]).applyMatrix4(o.matrixWorld); mx = Math.max(mx, v.x); mn = Math.min(mn, v.x); } } }); close3D(); return n ? mx - mn : 0; };
        const s0 = await span(); selectedShapes = [R]; startRecoupe(); rcpClick(pt(5, -3).x, pt(5, -3).y); rcpClick(pt(5, 9).x, pt(5, 9).y); rcpClick(pt(2, 3).x, pt(2, 3).y); const s1 = await span();
        r.cut = s0 > 9.9 && Math.abs(s1 - s0 / 2) < 0.6; r.spans = [+s0.toFixed(2), +s1.toFixed(2)];
        selectedShapes = []; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.ok('recouper un toit : coupé net par le plan, la partie retirée disparaît', rcp2.cut, JSON.stringify(rcp2));
    // tracés éditables comme une polyligne : + ajoute un sommet (dalle, emprise…) ; paroi simple et complexe : sommets et + sur le tracé, la paroi est refaite ; annuler rend l'original ; symétrie suivie
    const pl = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const D = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })), solid: { kind: 'box', H: 200 }, zk: 1 }; shapes.push(D); saveState(); setMode('select-box'); selectedShapes = [D];
        let g = allGrips().find(x => x.kind === 'p-add' && x.i === 0); startGrip(g); gripApply(pt(5, -2).x, pt(5, -2).y); endGrip(false); r.poly = D.points.length === 5 && Math.abs(D.points[1].y - pt(5, -2).y) < 1e-6 && D.points[1].z === 100000;
        shapes = []; wallOpt.align = 'gauche'; startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallChain = null; wallStart = null; setMode('select-box');
        const gid = shapes.find(x => x.wallMat).groupId, G = () => shapes.filter(x => x.groupId === gid), area = () => G().filter(x => x.type === 'hatch').reduce((a, h) => a + Math.abs(polyArea(h.loops[0])), 0);
        selectedShapes = G(); const a0 = area(); g = allGrips().find(x => x.kind === 'w-add' && x.i === 0); r.wgrips = !!g && allGrips().filter(x => x.kind === 'w-vtx').length === 3;
        startGrip(g); gripApply(pt(3, -1).x, pt(3, -1).y); endGrip(true); r.cancel = Math.abs(area() - a0) < 1e-6 && wallPathOf(gid).P.length === 3;
        selectedShapes = G(); g = allGrips().find(x => x.kind === 'w-add' && x.i === 0); startGrip(g); gripApply(pt(3, -1).x, pt(3, -1).y); endGrip(false); r.add = wallPathOf(gid).P.length === 4 && area() > a0;
        selectedShapes = G(); g = allGrips().find(x => x.kind === 'w-vtx' && x.i === 3); startGrip(g); gripApply(pt(6, 6).x, pt(6, 6).y); endGrip(false); const P = wallPathOf(gid).P; r.move = Math.abs(P[3].y - pt(6, 6).y) < 1e-6;
        const c0 = shapes.filter(x => x.groupId === gid).length; selectedShapes = G(); G().forEach(x => { if (x.loops) x.loops.forEach(L => L.forEach(q => { q.x = -q.x; })); if (x.type === 'line') { x.x1 = -x.x1; x.x2 = -x.x2; } x.wp.P.forEach(q => { q.x = -q.x; }); }); invalidateCache(); saveState();
        r.mirror = !!wallPathOf(gid);
        shapes = []; startWallCx(WALL_CX[0]); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallChainEnd(); wallChain = null; wallStart = null; setMode('select-box'); const cg = shapes.find(x => x.wallCx).groupId; selectedShapes = shapes.filter(x => x.groupId === cg);
        g = allGrips().find(x => x.kind === 'w-vtx' && x.i === 1); startGrip(g); gripApply(pt(8, 0).x, pt(8, 0).y); endGrip(false); r.cx = Math.abs(wallCxRecover(cg).P[1].x - pt(8, 0).x) < 1e-3 && shapes.filter(x => x.groupId === cg && x.stud).length === 15;
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('tracés comme une polyligne : + ajoute un sommet (dalle, emprise), parois simples et complexes éditables par leur tracé, annulation, symétrie', pl, { poly: true, wgrips: true, cancel: true, add: true, move: true, mirror: true, cx: true });
    // poignée de tronçon de paroi : tirée perpendiculairement, les tronçons voisins gardent leur direction ; paroi tracée avant le tracé gardé : retrouvée et éditable
    const wedge = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        wallOpt.align = 'gauche'; startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallAddTo(pt(0, 4).x, pt(0, 4).y); wallChain = null; wallStart = null; setMode('select-box');
        const wg = shapes.find(x => x.wallMat).groupId, WG = () => shapes.filter(x => x.groupId === wg); selectedShapes = WG(); let g = allGrips().find(x => x.kind === 'w-edge' && x.i === 1); r.grip = !!g && allGrips().filter(x => x.kind === 'w-edge').length === 3;
        startGrip(g); gripApply(g.x + pt(2, 0).x, g.y + pt(0, 1.5).y); endGrip(false); const P = wallPathOf(wg).P; r.pull = P.length === 4 && Math.abs(P[1].x - pt(8, 0).x) < 1e-6 && Math.abs(P[2].x - pt(8, 0).x) < 1e-6 && Math.abs(P[1].y) < 1e-6 && Math.abs(P[2].y - pt(0, 4).y) < 1e-6 && Math.abs(P[0].x) < 1e-6 && Math.abs(P[3].x) < 1e-6;
        selectedShapes = WG(); g = allGrips().find(x => x.kind === 'w-edge' && x.i === 1); const k0 = JSON.stringify(wallPathOf(wg).P); startGrip(g); gripApply(g.x + pt(3, 0).x, g.y); endGrip(true); r.cancel = JSON.stringify(wallPathOf(wg).P) === k0;
        WG().forEach(x => { delete x.wp; }); historyStep++; invalidateCache(); const L = wallPathOf(wg); r.legacy = !!L && L.P.length === 4 && Math.abs(L.P[1].x - pt(8, 0).x) < 1e-3;
        selectedShapes = WG(); g = allGrips().find(x => x.kind === 'w-edge' && x.i === 0); r.lgrip = !!g; if (g) { startGrip(g); gripApply(g.x, g.y + pt(0, -1).y); endGrip(false); const Q = wallPathOf(wg).P; r.lpull = Math.abs(Q[0].y - pt(0, -1).y) < 1e-3 && Math.abs(Q[1].y - pt(0, -1).y) < 1e-3 && Math.abs(Q[0].x) < 1e-3; }
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('paroi : poignée de tronçon tirée perpendiculairement, voisins alignés, annulation, paroi ancienne retrouvée', wedge, { grip: true, pull: true, cancel: true, legacy: true, lgrip: true, lpull: true });
    /* face peinte d'une paroi gardée par son segment : elle reste sur sa face quand le contour est renuméroté, quand on tire le tronçon (elle suit), à l'enregistrement,
       et les fichiers d'avant (numéro de côté) sont convertis à l'ouverture */
    const fte = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; await loadPolyClip(); const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {}, T1 = TEX_LIB[0].id, T2 = TEX_LIB[1].id;
        wallOpt.align = 'gauche'; startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallAddTo(pt(0, 4).x, pt(0, 4).y); wallChain = null; wallStart = null; setMode('select-box');
        const wg = shapes.find(x => x.wallMat).groupId, HS = () => shapes.filter(x => x.groupId === wg && isWallHatch(x));
        const outer = () => { let best = null; HS().forEach(h => { const L = h.loops[0]; L.forEach((c, i) => { const d = L[(i + 1) % L.length]; if (Math.abs(c.x - d.x) < 1e-6 && (!best || c.x > best.x)) best = { h, i, x: c.x }; }); }); return best; };
        let O = outer(); { const L = O.h.loops[0], a = L[O.i], b = L[(O.i + 1) % L.length]; O.h.fte = [{ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, t: T1 }]; }
        const painted = () => { const o = outer(); return !!o && wallEdgeTex(o.h)[o.i] === T1 && HS().reduce((n, h) => n + wallEdgeTex(h).filter(t => t === T1).length, 0) === 1; };
        r.paint = painted(); O.h.loops[0].push(O.h.loops[0].shift()); r.renum = painted();
        selectedShapes = shapes.filter(x => x.groupId === wg); const g = allGrips().find(x => x.kind === 'w-edge' && x.i === 1); startGrip(g); gripApply(g.x + pt(2, 0).x, g.y); endGrip(false); r.pulled = painted() && Math.abs(outer().x - pt(8, 0).x) < mmToWorld(400);
        const txt = JSON.stringify(projectData()); loadProjectText(txt, 'f.mmc'); r.saved = painted();
        const h2 = { type: 'hatch', layerId: 'layer-0', wallMat: 'beton', loops: [[pt(20, 0), pt(25, 0), pt(25, -0.2), pt(20, -0.2)]], ftex: { f1: T2, top: T1 } }; shapes.push(h2);
        loadProjectText(JSON.stringify(projectData()), 'old.mmc'); const h3 = shapes.find(x => x.type === 'hatch' && x.ftex && x.ftex.top === T1 && !x.groupId); r.migr = !!h3 && wallEdgeTex(h3)[1] === T2 && !('f1' in h3.ftex) && h3.fte.length === 1;
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('paroi : face peinte gardée par son segment (renumérotation, tronçon tiré, enregistrement), anciens fichiers convertis', fte, { paint: true, renum: true, pulled: true, saved: true, migr: true });
    // pièces modulables : paroi fusionnée (contour + refend) retouchée tracé par tracé ; tirer un mur fait suivre la cloison accrochée, porte comprise
    const modu = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; await loadPolyClip(); const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {}, wait = () => new Promise(res => setTimeout(res, 300));
        const chain = (id, P, close) => { wallOpt.align = 'gauche'; startWall(id); wallStart = pt(...P[0]); wallChain = null; P.slice(1).forEach(q => wallAddTo(pt(...q).x, pt(...q).y)); if (close) wallAddTo(pt(...P[0]).x, pt(...P[0]).y); else wallChainEnd(); wallChain = null; wallStart = null; };
        chain(WALL_PRESETS[0].id, [[0, 0], [0, 6], [8, 6], [8, 0]], true); await wait(); chain(WALL_PRESETS[0].id, [[4, -0.1], [4, 6.1]], false); await wait(); chain(WALL_PRESETS[2].id, [[6, 0], [6, 6]], false); await wait(); setMode('select-box');
        const bet = shapes.find(x => x.wallMat === 'beton').groupId, bri = shapes.find(x => x.wallMat === 'brique').groupId, I = wallPathsOf(bet); r.fused = !!I && I.paths.length === 2 && !I.single && shapes.filter(x => x.wallMat === 'beton').every(x => x.groupId === bet);
        const H = (gid) => shapes.filter(x => x.groupId === gid && x.type === 'hatch'), xs = (gid) => H(gid).flatMap(h => h.loops[0].map(q => q.x)), ys = (gid) => H(gid).flatMap(h => h.loops[0].map(q => q.y));
        const host = H(bri)[0], o = { a: pt(6, 2), b: pt(6, 3), kind: 'porte', sill: 0, h: 2100, layerId: host.layerId }; o.pts = openingPts(host, o.a, o.b); host.openings = [o]; saveState();
        selectedShapes = shapes.filter(x => x.groupId === bet); let g = allGrips().find(x => x.kind === 'w-edge' && x.pi === 1); r.grip = !!g;
        startGrip(g); gripApply(g.x + pt(1, 0).x, g.y); endGrip(false); const xp = xs(shapes.find(x => x.wallMat === 'beton').groupId).filter(x => x > pt(4.5, 0).x && x < pt(5.6, 0).x); r.refend = xp.length >= 4 && xp.every(x => Math.abs(x - pt(5, 0).x) < mmToWorld(3) || Math.abs(x - pt(4.8, 0).x) < mmToWorld(3)) && !xs(shapes.find(x => x.wallMat === 'beton').groupId).some(x => Math.abs(x - pt(3.8, 0).x) < mmToWorld(3));
        r.still2 = wallPathsOf(shapes.find(x => x.wallMat === 'beton').groupId).paths.length === 2;
        const yb0 = Math.max(...ys(bri)); selectedShapes = shapes.filter(x => x.wallMat === 'beton'); const gb = shapes.find(x => x.wallMat === 'beton').groupId; g = allGrips().find(x => x.kind === 'w-edge' && x.pi === 0 && Math.abs(x.y - pt(0, 0).y) < mmToWorld(150)); r.bgrip = !!g;
        if (g) { startGrip(g); gripApply(g.x, g.y + pt(0, -1).y); endGrip(true); r.undo = Math.abs(Math.max(...ys(bri)) - yb0) < mmToWorld(1);
            selectedShapes = shapes.filter(x => x.wallMat === 'beton'); g = allGrips().find(x => x.kind === 'w-edge' && x.pi === 0 && Math.abs(x.y - pt(0, 0).y) < mmToWorld(150)); startGrip(g); gripApply(g.x, g.y + pt(0, -1).y); endGrip(false); const yb1 = Math.max(...ys(bri)); r.follow = Math.abs(yb1 - yb0 - pt(0, -1).y) < mmToWorld(3); const D = H(bri).find(h => h.openings && h.openings.length); r.door = !!D && Math.abs(D.openings[0].a.y - pt(6, 2).y) < 1e-6; }
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('pièces modulables : paroi fusionnée retouchée tracé par tracé, la cloison accrochée suit le mur tiré, porte gardée, annulable', modu, { fused: true, grip: true, refend: true, still2: true, bgrip: true, undo: true, follow: true, door: true });
    // ouverture : le mur bouge sous elle (sommet déplacé) → elle reste dans le mur, à sa taille, et reste retouchable ; une ouverture restée hors du mur est remise dedans au chargement
    const opk = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        wallOpt.align = 'gauche'; startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallChain = null; wallStart = null; setMode('select-box');
        const wg = shapes.find(x => x.wallMat).groupId, host = shapes.find(x => x.groupId === wg && x.type === 'hatch' && x.loops[0].some(q => Math.abs(q.y) < 1e-9 && Math.abs(q.x - pt(0, 0).x) < 1e-9));
        const o = { a: pt(2, -0.1), b: pt(3, -0.1), kind: 'porte', sill: 0, h: 2100, layerId: host.layerId }; o.pts = openingPts(host, o.a, o.b); host.openings = [o]; saveState(); const A0 = Math.abs(polyArea(o.pts));
        selectedShapes = shapes.filter(x => x.groupId === wg); const g = allGrips().find(x => x.kind === 'w-vtx' && x.i === 0); startGrip(g); gripApply(g.x, g.y + pt(0, 1.5).y); endGrip(false);
        const H = shapes.filter(x => x.groupId === wg && x.type === 'hatch'), h2 = H.find(x => x.openings && x.openings.length), o2 = h2 && h2.openings[0], mm = o2 && { x: (o2.a.x + o2.b.x) / 2, y: (o2.a.y + o2.b.y) / 2 };
        r.inWall = !!o2 && pointInPolygon(mm.x, mm.y, h2.loops[0]); r.size = !!o2 && Math.abs(polyArea(o2.pts)) < A0 * 1.6;
        selectedShapes = [h2]; r.grips = allGrips().filter(x => x.kind === 'op-end' || x.kind === 'op-move').length === 3;
        o2.a = { x: o2.a.x, y: o2.a.y - pt(0, 2).y }; o2.b = { x: o2.b.x, y: o2.b.y - pt(0, 2).y }; r.rep = wallOpRepair() === 1; const h3 = shapes.find(x => x.openings && x.openings.includes(o2)), m3 = { x: (o2.a.x + o2.b.x) / 2, y: (o2.a.y + o2.b.y) / 2 }; r.back = !!h3 && pointInPolygon(m3.x, m3.y, h3.loops[0]) && wallOpRepair() === 0;
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('ouverture : reste dans le mur qui bouge sous elle, à sa taille, retouchable ; remise dans le mur au chargement', opk, { inWall: true, size: true, grips: true, rep: true, back: true });
    // emprise : m² et périmètre dans le panneau du bâtiment ; traits de construction invisibles en 3D hors outil de dessin 3D
    const em = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState();
        bldOpen(A.bld.id); await new Promise(res => setTimeout(res, 300)); const tx = document.getElementById('selparam-modal').textContent; r.area = /80,00\s*m²/.test(tx) && /périmètre 36,00 m/.test(tx); closeSelectionParamModal();
        shapes.push(clMake(0, 0, 1, 0)); saveState(); await open3D(); d3ClBuild(); render3D(); r.clHidden = !!V3.cl && V3.cl.visible === false; close3D();
        selectedShapes = []; bldActivate(null); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('emprise du bâtiment en m² (et périmètre) ; traits de construction cachés en 3D', em, { area: true, clHidden: true });
    // plan de travail et bar déroulés en polyligne : posés sur le plancher, meubles bas contre le mur, pieds du bar, cliquables dans leur emprise, réglables avec Y, en 3D
    const ctp = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [8, 0], [8, 6], [0, 6]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState();
        ctOpt.pt.just = 'gauche'; ctOpt.pt.base = 1; startCtop('pt'); currentPolygon = [pt(0.2, 4), pt(0.2, 5.8), pt(4, 5.8)]; isDrawing = true; finishPline(); t2PanelClose();
        startCtop('bar'); currentPolygon = [pt(2, 2.5), pt(5, 2.5)]; isDrawing = true; finishPline(); t2PanelClose(); setMode('select-box');
        const [T, B] = shapes.filter(x => x.ctop); r.made = !!T && !!B && T.ctop.k === 'pt' && B.ctop.k === 'bar' && ctZ0(T) === 100000 && T.bid === A.bld.id;
        r.hit = findShapeAt(pt(1, 5.5).x, pt(1, 5.5).y) === T; const G = ctGeo(T), Bs = ctBase(G, T.ctop); r.wallSide = Bs.hi === G.ob && !Bs.frontLo === false; r.legs = ctLegs(B, ctGeo(B)).length === 3;
        selectedShapes = [T]; openSelectionParamModal(); await new Promise(res => setTimeout(res, 300)); r.y = !!document.querySelector('#selparam-modal details[data-k=ctop]'); ctSet('h', 950); r.set = T.ctop.h === 950; closeSelectionParamModal();
        await open3D(); let n = 0; V3.root.traverse(o => { if (o.userData && o.userData.shape === T) n++; }); r.d3 = n > 6; close3D();
        selectedShapes = []; bldActivate(null); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('plan de travail et bar déroulés en polyligne : sur le plancher, meubles bas contre le mur, pieds, cliquables, réglables avec Y, en 3D', ctp, { made: true, hit: true, wallSide: true, legs: true, y: true, set: true, d3: true });
    // portes : en 3D, gonds et sens d'ouverture comme sur le plan (les 4 combinaisons côté / gonds)
    const doors = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), out = [];
        startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(8, 0).x, pt(8, 0).y); wallChain = null; wallStart = null; setMode('select-box'); const host = shapes.find(x => x.type === 'hatch' && x.wallMat); host.wz = { b: 100000, t: 102700 };
        for (const [side, hinge] of [[1, 'a'], [1, 'b'], [-1, 'a'], [-1, 'b']]) {
            const pa = pt(3, 0), pb = pt(4, 0), o = { a: pa, b: pb, kind: 'porte', sill: 0, h: 2100, side, hinge, layerId: host.layerId }; o.pts = openingPts(host, pa, pb); host.openings = [o]; invalidateCache();
            await open3D(); let pv = null; V3.root.traverse(x => { if (x.userData && x.userData.door) pv = x; }); const D = pv.userData.door, ctr = () => { V3.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(pv.children[0]).getCenter(new THREE.Vector3()); };
            pv.rotation.z = D.a0; V3.root.updateMatrixWorld(true); let fr = null; V3.root.traverse(x => { if (!fr && x.isMesh && x.userData.opening === o && !x.userData.leaf) fr = x; }); const lb = new THREE.Box3().setFromObject(pv.children[0]), fb = new THREE.Box3().setFromObject(fr), inFrame = lb.min.y >= fb.min.y - 1e-3 && lb.max.y <= fb.max.y + 1e-3; const cc = ctr(), piv = pv.getWorldPosition(new THREE.Vector3()); pv.rotation.z = D.a0 + D.sw; const co = ctr(); close3D();
            const p = o.pts, hb = hinge === 'b', H = side > 0 ? (hb ? p[2] : p[3]) : (hb ? p[1] : p[0]), nx = (p[3].x - p[0].x) * side, ny = (p[3].y - p[0].y) * side, mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            const sw3 = [co.x - piv.x, co.y - piv.y], sw2 = [nx, -ny], hg3 = [piv.x - cc.x, piv.y - cc.y], hg2 = [H.x - mid.x, -(H.y - mid.y)], dot = (a, b) => (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
            out.push(dot(sw3, sw2) > 0.9 && hg3[0] * hg2[0] > 0 && inFrame); }
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return out; });
    t.eq('portes : en 3D, gonds et sens d\'ouverture comme sur le plan (4 combinaisons), vantail fermé dans le chambranle', doors, [true, true, true, true]);
    // nouveaux blocs 3D : réfrigérateurs, îlot central, poêle à bois — posés et modélisés ; plan de travail 2D : un seul contour net
    const nb = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {}; const ids = ['frigo', 'frigous', 'ilot', 'poele'];
        ids.forEach((id, i) => { startStamp(id); currentX = pt(i * 2.4, 2).x; currentY = pt(i * 2.4, 2).y; placeStamp(); }); setMode('select-box'); saveState();
        await open3D(); const seen = new Set(); V3.root.traverse(o => { const s = o.userData && (o.userData.blk || o.userData.shape); if (s && s.block) seen.add(s.block); }); close3D();
        r.blocks = ids.every(id => seen.has(allBlocks().find(b => b.id === id).name));
        shapes = []; await loadPolyClip(); startCtop('pt'); currentPolygon = [pt(0, 0), pt(0.6, 3), pt(5, 1.2)]; isDrawing = true; finishPline(); t2PanelClose(); setMode('select-box'); const T = shapes.find(x => x.ctop); r.outline = ctOutline(T, ctGeo(T)).length === 1;
        shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('blocs 3D : réfrigérateurs, îlot central, poêle à bois ; plan de travail en un seul contour', nb, { blocks: true, outline: true });
    // ouverture d'un étage du dessous : dessinée translucide (comme son mur), pas comme si elle était à l'étage affiché
    // ouverture posée au R+1 : sur le mur du R+1, pas sur celui du RDC qui est dessous (même tracé)
    const opr = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState(); bldActivate(A, 'rdc'); lvlAdd(true); bldPick('rdc'); saveState();
        const wall = () => { startWall(WALL_PRESETS[0].id); wallStart = pt(1, 1); wallChain = null; wallAddTo(pt(8, 1).x, pt(8, 1).y); wallChain = null; wallStart = null; setMode('select-box'); };
        wall(); const lo = shapes.find(x => x.type === 'hatch' && x.wallMat); startWall(WALL_PRESETS[0].id); wallStart = pt(1, 5); wallChain = null; wallAddTo(pt(8, 5).x, pt(8, 5).y); wallChain = null; wallStart = null; setMode('select-box'); const hi = lvlSorted()[1].id; bldPick(hi); saveState(); wall(); const up = shapes.find(x => x.type === 'hatch' && x.wallMat && x !== lo && !lvlBelow(x));
        r.two = !!up && lvlBelow(lo); const h = wallAt(pt(3, 1.1)); r.host = h === up || (!!h && h.groupId === up.groupId && !lvlBelow(h));
        r.none = !wallAt(pt(3, 5.1));
        { const lw = shapes.find(x => x.type === 'hatch' && x.wallMat && lvlBelow(x) && x.loops[0].some(q => Math.abs(q.y - pt(0, 5).y) < 1)), od = { a: pt(3, 5), b: pt(4, 5), kind: 'porte', sill: 0, h: 2100, side: 1, hinge: 'a', layerId: lw.layerId }; od.pts = openingPts(lw, od.a, od.b); lw.openings = [od];
            const c = { x: (od.pts[0].x + od.pts[2].x) / 2, y: (od.pts[0].y + od.pts[2].y) / 2 }; r.opUp = !openingAt(c); bldPick('rdc'); r.opRdc = !!openingAt(c) && openingAt(c).o === od; bldPick(hi); }   /* au R+1, la porte du RDC dessous ne se prend pas au clic */   /* au R+1, le mur du RDC seul (en transparence) ne reçoit pas l'ouverture */
        bldPick('rdc'); const h2 = wallAt(pt(3, 1.1)); r.rdc = !!h2 && h2.groupId === lo.groupId;
        bldAll(); bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('ouverture au R+1 : posée sur le mur du R+1, pas sur celui du RDC dessous ; la porte du RDC ne se prend pas au clic depuis le R+1 ; au RDC, sur celui du RDC', opr, { two: true, host: true, none: true, opUp: true, opRdc: true, rdc: true });
    const opl = await ev(async () => { const keepS = shapes; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const A = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [10, 0], [10, 8], [0, 8]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 100000, 2800); saveState(); bldActivate(A, 'rdc'); lvlAdd(true); bldPick('rdc'); saveState();
        startWall(WALL_PRESETS[0].id); wallStart = pt(1, 1); wallChain = null; wallAddTo(pt(8, 1).x, pt(8, 1).y); wallChain = null; wallStart = null; setMode('select-box'); const host = shapes.find(x => x.type === 'hatch' && x.wallMat);
        const o = { a: pt(3, 1), b: pt(4, 1), kind: 'porte', sill: 0, h: 2100, side: 1, hinge: 'a', layerId: host.layerId }; o.pts = openingPts(host, o.a, o.b); host.openings = [o]; saveState();
        const hi = lvlSorted()[1].id; bldPick(hi); r.below = lvlBelow(host); const P = CanvasRenderingContext2D.prototype, st = P.stroke; let minA = 1; P.stroke = function () { minA = Math.min(minA, this.globalAlpha); return st.apply(this, arguments); };
        try { drawOpenings2D(ctx, false); } finally { P.stroke = st; } r.dim = minA <= 0.31;
        bldAll(); bldActivate(null); lvlOn = false; shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('ouverture d\'un étage du dessous : translucide sur le plan de l\'étage affiché', opl, { below: true, dim: true });
    /* ensoleillement : position du soleil (équinoxe, lat 45° : ~45° à midi, lever/coucher symétriques) ; sonde dans une pièce à baie plein sud = soleil autour de midi seulement,
       pièce fermée = jamais, dehors = du lever au coucher ; note, courbe, Y, enregistrement */
    const sol = await ev(async () => { const keepS = shapes, keepN = solNote; shapes = []; lvls = null; bldActId = null; lvlsGlobal = null; lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const box = (x0, y0, x1, y1, z0, H) => ({ type: 'poly', layerId: activeLayerId, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => Object.assign(pt(x, y), { z: z0 })), solid: { kind: 'box', H }, zk: 1 });
        const room = (ox, win) => [...(win ? [box(ox, 0, ox + 2, 0.2, 0, 3000), box(ox + 4, 0, ox + 6, 0.2, 0, 3000)] : [box(ox, 0, ox + 6, 0.2, 0, 3000)]), box(ox, 3.8, ox + 6, 4, 0, 3000), box(ox, 0, ox + 0.2, 4, 0, 3000), box(ox + 5.8, 0, ox + 6, 4, 0, 3000), box(ox, 0, ox + 6, 4, 3000, 200)];
        const A = { type: 'poly', layerId: activeLayerId, points: [[-1, -1], [30, -1], [30, 5], [-1, 5]].map(([x, y]) => pt(x, y)) }; shapes.push(A); saveState(); bldMake(A, 'Maison', 0, 2800); saveState();
        shapes.push(...room(0, true), ...room(10, false)); saveState();
        solNote = { date: '2026-03-21', step: 5, manual: 1, lat: 45, lon: 6 };
        startSonde(); sondePlace(pt(3, 1)); sondePlace(pt(13, 2)); sondePlace(pt(3, -30)); setMode('select-box'); const S = solProbes(); r.placed = S.length === 3 && S[0].sonde.n === 'S1' && !!S[0].bid && S[0].lvl === 'rdc' && sondeWhere(S[0]).inside && !sondeWhere(S[2]).inside;
        const R = await solRun(), P = R.probes, noon = R.t[R.el.indexOf(Math.max(...R.el))];
        r.sun = Math.abs(Math.max(...R.el) - 45.4) < 0.8 && Math.abs((R.rise + R.set) / 2 - noon) < 8 && R.rise > 5 * 60 && R.set < 20 * 60;
        r.win = P[0].iv.length === 1 && P[0].iv[0][0] < noon && P[0].iv[0][1] > noon && P[0].iv[0][0] > R.rise + 90 && P[0].iv[0][1] < R.set - 90;
        r.closed = P[1].mins === 0; r.out = P[2].mins > (R.set - R.rise) - 3 * R.step; r.cls = solClass(P[1], R.date).k === 'ins' && solClass(P[2], R.date) === null;
        openSolNote(); const box0 = document.getElementById('sol-res'); r.note = !!box0 && box0.querySelectorAll('svg').length === 3 && /S1/.test(box0.textContent) && !/ont changé/.test(box0.textContent); closeTopoModal();
        selectedShapes = [S[0]]; openSelectionParamModal(); r.y = !!document.getElementById('sd-h'); document.getElementById('sd-h').value = '1,5'; [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click(); r.h = S[0].sonde.h === 1.5;
        openSolNote(); r.stale = /ont changé/.test(document.getElementById('sol-res').textContent); closeTopoModal();
        const j = JSON.stringify(projectData()); loadProjectText(j, 'sol.mmc'); r.saved = solProbes().length === 3 && !!(solNote && solNote.res && solNote.res.probes.length === 3);
        solStop(true); solNote = keepN; bldActivate(null); lvlOn = false; shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    /* véranda : parois « Véranda (alu vitré) » et toit coché « Toiture de véranda » rendus en vitrage, avec montants (tous les mètres au plus, pas dans la porte), lisses, chevrons */
    const ver = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; await loadPolyClip(); const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        r.preset = !!WALL_PRESETS.find(w => w.id === 'w-veranda') && !!WALL_MATS.verre;
        wallOpt.align = 'gauche'; startWall('w-veranda'); wallStart = pt(0, 4); wallChain = null; wallAddTo(pt(0, 0).x, pt(0, 0).y); wallAddTo(pt(6, 0).x, pt(6, 0).y); wallAddTo(pt(6, 4).x, pt(6, 4).y); wallChain = null; wallStart = null; setMode('select-box');
        const vw = shapes.filter(x => x.wallMat === 'verre' && x.type === 'hatch'), front = vw.find(h => { const q = wallQuadSeg(h); return q && Math.abs(q.p.y - q.q.y) < 1e-6 && Math.abs(q.p.y) < m; });
        openA = pt(2.2, 0); openWall = front; openDir = { x: 1, y: 0 }; openLast.kind = 'porte'; openingFinish(pt(3.2, 0)); [...document.querySelectorAll('#tm-actions button')].find(b => /Valider/.test(b.textContent)).click();
        const base = { type: 'poly', layerId: activeLayerId, points: [[0, 0], [6, 0], [6, 4], [0, 4]].map(([x, y]) => Object.assign(pt(x, y), { z: 0 })) }; shapes.push(base);
        roofDialog(base, true); document.querySelector('input[name=rf-p][value="1"]').checked = true; rfSw(1); r.opt = document.getElementById('rf-verw').style.display !== 'none'; document.getElementById('rf-eg').value = '0'; document.getElementById('rf-he').value = '2,5'; document.getElementById('rf-hf').value = '3,1'; document.getElementById('rf-db').value = '0'; document.getElementById('rf-fill').checked = true; document.getElementById('rf-ver').checked = true; document.getElementById('rf-vere').value = '1';
        [...document.querySelectorAll('#tm-actions button')].find(b => /Créer le toit/.test(b.textContent)).click(); const pan = shapes.find(x => x.roofDef); r.roof = !!pan && pan.roofDef.o.ver === 1 && pan.roofDef.o.verE === 1 && Math.abs(pan.roofDef.o.e - 0.032) < 1e-9;
        selectedShapes = []; await open3D(); const fr = [], gl = new Set(); V3.root.traverse(o => { if (o.userData.verFrame) fr.push(o); if (o.isMesh && o.userData.shape && o.material && o.material.transparent && o.material.opacity < 0.5) gl.add(o.userData.shape); });
        r.glass = vw.every(h => gl.has(h)) && gl.has(pan) && [...gl].some(x => x.name === 'Pignons');
        const P0 = (x, y) => ({ x: x + V3.root.position.x, y: y + V3.root.position.y }), dx = P0(2.2, 0), dX = P0(3.2, 0); V3.root.updateMatrixWorld(true);
        const posts = fr.filter(f => f.userData.shape === front).map(f => new THREE.Box3().setFromObject(f)).filter(b => b.max.z - b.min.z > 1.5);
        r.posts = posts.length >= 6 && !posts.some(b => { const c = (b.min.x + b.max.x) / 2; return c > dx.x + 0.1 && c < dX.x - 0.1; });
        const raft = fr.filter(f => f.userData.shape === pan); r.rafters = raft.length === 7;
        /* petits carreaux : chaque travée partagée à parts égales (petits bois plus fins que le profilé), rien dans la travée de la porte ; réglage gardé dans le fichier */
        selectedShapes = shapes.filter(x => x.wallMat === 'verre'); openSelectionParamModal(); r.yv = !!document.getElementById('sp-vr-pw'); verSet('pw', '60'); verSet('cw', '330'); verSet('ch', '500'); verSet('mode', 'carreaux'); closeSelectionParamModal(); selectedShapes = [];
        build3DScene(); V3.root.updateMatrixWorld(true); const mu = []; V3.root.traverse(o => { if (o.userData.verFrame && o.userData.shape === front) mu.push(new THREE.Box3().setFromObject(o)); });
        const thin = mu.filter(b => b.max.z - b.min.z > 1.5 && Math.min(b.max.x - b.min.x, b.max.y - b.min.y) < 0.04);
        r.muntins = thin.length >= 8 && !thin.some(b => { const c = (b.min.x + b.max.x) / 2; return c > dx.x - 0.02 && c < dX.x + 0.02; }) && mu.length > posts.length + 10;
        r.kept = JSON.parse(JSON.stringify(projectData())).shapes.filter(x => x.wallMat === 'verre' && x.type === 'hatch').every(x => x.vr && x.vr.mode === 'carreaux' && x.vr.cw === 330) && pan.roofDef.o.verW === 60;
        close3D(); shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); draw(); return r; });
    t.eq('véranda : paroi alu vitrée et toiture de véranda en vitrage, montants (aucun dans la porte), lisses, chevrons tous les mètres, pignons vitrés ; petits carreaux répartis par travée, profilé réglable', ver, { preset: true, opt: true, roof: true, glass: true, posts: true, rafters: true, yv: true, muntins: true, kept: true });
    t.eq('ensoleillement : soleil d\'équinoxe, pièce à baie sud au soleil autour de midi, pièce fermée jamais, dehors toute la journée ; note, Y, enregistrement', sol,
        { placed: true, sun: true, win: true, closed: true, out: true, cls: true, note: true, y: true, h: true, stale: true, saved: true });
} };
