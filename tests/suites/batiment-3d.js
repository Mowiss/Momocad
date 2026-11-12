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
    await ev(() => { document.querySelector('[data-for="v3-nat"]').click(); document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(800);
    t.ok('ciel et paysage affichés avec le bouton Paysage', await ev(() => !!(V3.sky && V3.sky.visible)));
    const sun = await ev(() => { v3SetHour(9); const a = V3.sun.position.clone(); v3SetHour(18); const b = V3.sun.position.clone(); return [a.x, b.x]; });
    t.ok('le soleil suit l\'heure (matin à l\'est, soir à l\'ouest)', sun[0] > 0 && sun[1] < 0, JSON.stringify(sun));
    const hz1 = await ev(() => V3.hz && V3.hz.visible && V3.hz.userData.seed); await ev(() => v3NewHorizon()); await H.wait(200);
    t.ok('horizon affiché, et un nouveau à la demande', hz1 && await ev((a) => V3.hz.userData.seed !== a, hz1), hz1);
    const kinds = await ev(() => ['montagne', 'ville', 'plaine', 'village'].map(k => { v3HzType(k); return V3.hz.userData.key.split(':')[0] + (V3.hz.userData.lights ? '+nuit' : ''); }));
    t.eq('horizon : quatre paysages (la ville et le village s\'éclairent la nuit)', kinds, ['montagne', 'ville+nuit', 'plaine', 'village+nuit']);
    const pano = await ev(async () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; c.getContext('2d').fillRect(0, 0, 512, 256); const b = await new Promise(r => c.toBlob(r));
        const ok = await v3PanoFromBlob(b, false); v3HzType('photo'); const r = [ok, V3.pano.visible, V3.hz.visible, V3.gnd.visible]; v3HzType('montagne'); return r; });
    t.eq('photo 360° : remplace ciel et horizon', pano, [true, true, false, false]);
    const cyl = await ev(async () => { const c = document.createElement('canvas'); c.width = 1300; c.height = 200; c.getContext('2d').fillRect(0, 0, 1300, 200); const b = await new Promise(r => c.toBlob(r));
        await v3PanoFromBlob(b, false); v3HzType('photo'); const r = [V3.pano.visible, V3.panoC.visible]; v3HzType('montagne'); return r; });
    t.eq('panorama de téléphone (très allongé) : posé sur un cylindre, pas étiré sur une bulle', cyl, [false, true]);
    await ev(() => { document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(300);
    t.ok('ciel et horizon masqués', await ev(() => !V3.sky.visible && !V3.hz.visible));
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
    const nt2 = await ev(async () => { open3D(); await new Promise(r => setTimeout(r, 800)); let n = 0; V3.root.traverse(o => [].concat(o.material || []).forEach(m => { if (m.map) n++; })); close3D(); return n; });
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
    t.eq('toiture : onglet Épaisseur nommé, ouvert par un clic sur l\'épaisseur, épaisseur = somme des couches', ep, { labels: ['Type', 'Dimensions', 'Épaisseur', 'Faîtage'], shown: true, e: '0,30' });
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
        const txt = shapes.filter(x => x.secOf && x.type === 'text').map(x => x.content.split(' ')[0]).sort(), mats = [...new Set(shapes.filter(x => x.secOf && x.hatchMat).map(x => x.hatchMat))].sort();
        shapes.filter(x => x.groupId === 'cw1').forEach(x => { x.wz.t = 106700; }); saveState(); await new Promise(r => setTimeout(r, 700)); const h1 = W();
        const T0 = shapes.find(x => x.secTitle), g = T0.groupId, x0t = T0.x; shapes.filter(x => x.groupId === g).forEach(x => translateShape(x, 10 * m, 0)); saveState(); await new Promise(r => setTimeout(r, 700));
        const T1 = shapes.find(x => x.secTitle), moved = Math.round((T1.x - x0t) / m), kept = shapes.filter(x => x.secOf).length > 10;
        const beyond = shapes.some(x => x.secOf && x.type === 'line' && x.width === 0.5);
        // cotes de talus sur leur calque : masquées sans toucher au talus
        invalidateCache(); draw(); await new Promise(r => setTimeout(r, 50)); invalidateCache(); draw(); const LT = layers.find(l => l.name === 'Cotes de talus'), nT = () => screenTextsToDraw.filter(x => LT && x.layerId === LT.id).length, withT = nT(); if (LT) LT.visible = false; invalidateCache(); draw(); const hidT = nT(); if (LT) LT.visible = true;
        const r = { up: Math.round((h1 - h0) / m * 10) / 10, txt, mats, moved, kept, tn: shapes.some(x => x.secOf && x.name === 'TN'), beyond, talusCot: !!LT && withT > 0 && hidT === 0 }; shapes = keepS; invalidateCache(); saveState(); return r; });
    t.eq('coupe dynamique : suit le plan, garde sa place, textures, TN, cotes de niveau', cd, { up: 1, txt: ['COUPE', 'Dessus', 'Faîtage', 'TN', 'Égout'], mats: ['beton', 'bois', 'gnt', 'parpaing', 'terre'], moved: 10, kept: true, tn: true, beyond: true, talusCot: true });
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
    const fm = await ev(async () => { shapes = []; camera.zoom = 1; const M = mmToWorld, b = WALL_PRESETS.find(w => w.id === 'w-beton20').id, i = WALL_PRESETS.find(w => w.id === 'w-laine100').id;
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
    t.eq('étages : niveaux, mur rangé sur son étage, étages du dessus masqués', lv, { start: ['RDC', 'TOIT'], box: 'block', added: ['RDC', 'R + 1', 'TOIT'], wall: true, rdc: [true, true, false, false], off: [false, false, 'none'] });
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
    // pinceau allégé : la couche de peinture ne reprend que les triangles proches du coup, pas toute la surface
    const bo = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 600)); let big = null; V3.root.traverse(x => { if (x.isMesh && x.geometry && x.geometry.attributes.position && (!big || x.geometry.attributes.position.count > big.geometry.attributes.position.count) && !x.userData.brushOv) big = x; });
        const bb = new THREE.Box3().setFromObject(big), c = bb.getCenter(new THREE.Vector3()), cx = -V3.root.position.x, cy = -V3.root.position.y;
        const q = { x: mmToWorld((c.x + cx) * 1000), y: -mmToWorld((c.y + cy) * 1000) }, z = Math.round(((bb.max.z) / (V3.exag || 1) + (V3.zmin || 0)) * 1000);
        const s = { type: 'poly', open: true, layerId: brushLayer(), points: [q, { x: q.x + mmToWorld(300), y: q.y }], width: 1, hatch: false, brush: { tex: 'galets', d: 300, h: 0.5, top: true, zs: [z, z] } }; shapes.push(s); v3BrushBuild(); let ovN = 0, n = 0; V3.root.traverse(x => { if (x.userData.brushOv === s) { n++; ovN += x.geometry.attributes.position.count; } });
        shapes = shapes.filter(x => x !== s); v3BrushBuild(); close3D(); return { n: n > 0, smaller: ovN < big.geometry.attributes.position.count }; });
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
} };
