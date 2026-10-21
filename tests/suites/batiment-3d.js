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
    await ev(() => { document.querySelector('[data-for="v3-nat"]').click(); document.querySelector('[data-for="v3-sky"]').click(); }); await H.wait(800);
    t.ok('ciel affiché', await ev(() => !!(V3.sky && V3.sky.visible)));
    const sun = await ev(() => { v3SetHour(9); const a = V3.sun.position.clone(); v3SetHour(18); const b = V3.sun.position.clone(); return [a.x, b.x]; });
    t.ok('le soleil suit l\'heure (matin à l\'est, soir à l\'ouest)', sun[0] > 0 && sun[1] < 0, JSON.stringify(sun));
    await ev(() => { document.querySelector('[data-for="v3-hz"]').click(); }); await H.wait(300);
    const hz1 = await ev(() => V3.hz && V3.hz.visible && V3.hz.userData.seed); await ev(() => v3NewHorizon()); await H.wait(200);
    t.ok('horizon affiché, et un nouveau à la demande', hz1 && await ev((a) => V3.hz.userData.seed !== a, hz1), hz1);
    const kinds = await ev(() => ['montagne', 'ville', 'plaine', 'village'].map(k => { v3HzType(k); return V3.hz.userData.key.split(':')[0] + (V3.hz.userData.lights ? '+nuit' : ''); }));
    t.eq('horizon : quatre paysages (la ville et le village s\'éclairent la nuit)', kinds, ['montagne', 'ville+nuit', 'plaine', 'village+nuit']);
    const pano = await ev(async () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; c.getContext('2d').fillRect(0, 0, 512, 256); const b = await new Promise(r => c.toBlob(r));
        const ok = await v3PanoFromBlob(b, false); v3HzType('photo'); const r = [ok, V3.pano.visible, V3.hz.visible, V3.gnd.visible]; v3HzType('montagne'); return r; });
    t.eq('photo 360° : remplace ciel et horizon', pano, [true, true, false, false]);
    await ev(() => { document.querySelector('[data-for="v3-hz"]').click(); document.querySelector('[data-for="v3-sky"]').click(); }); await H.wait(300);
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

    // une paroi n'est pas du terrain : sa ligne cotée ne modifie ni le MNT ni les talus
    await ev(() => { shapes.forEach(s => { if (s.wallMat && s.type === 'line') { s.z1 = 99999; s.z2 = 99999; } }); tinCache = null; invalidateCache(); });
    t.ok('paroi exclue du terrain naturel', await ev(() => tinNodes().every(n => n.z !== 99999)));

    // une longue paroi en béton vue de loin se dessine vite (motif réduit à ce qui se voit)
    const ms = await ev(() => { const m = mmToWorld(1000), w = { type: 'hatch', layerId: wallLayerId({ layers: [{ mat: 'beton', e: 200 }] }), loops: [[{ x: 0, y: 0 }, { x: 500 * m, y: 0 }, { x: 500 * m, y: -0.2 * m }, { x: 0, y: -0.2 * m }]] };
        shapes.push(w); camera.zoom = 2 / m; const a = performance.now(); for (let i = 0; i < 3; i++) { invalidateCache(); draw(); } shapes.pop(); invalidateCache(); return (performance.now() - a) / 3; });
    t.ok('paroi de 500 m en béton : dessin rapide', ms < 400, Math.round(ms) + ' ms');
} };
