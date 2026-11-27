// STUDIO PHOTO et RENDU : cadre au format choisi, focale, vues enregistrées (et sauvegardées dans le fichier), photo 360° seulement dans le studio
// (hauteur, distance, orientation ; cylindre fondu, ciel teinté), rendu en passes (ombres portées, lumière du ciel, herbe en 3D, arbres détaillés) ;
// réglages carto : système de coordonnées Auto (zone CC du lieu) par défaut.
module.exports = { name: 'studio', timeout: 600000, run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    const SC = async () => { const m = mmToWorld(1000), TN = ensureLayer('TN', '#bef264'); shapes = [];
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000 + i * 150 + Math.round(Math.sin(j) * 300), zk: 1 });
        shapes.push({ type: 'poly', layerId: ensureLayer('Zones boisées', '#4ade80'), points: [[35, 5], [55, 5], [55, 25], [35, 25]].map(([x, y]) => ({ x: x * m, y: -y * m })), bois: { h: 10, tex: 'vert' }, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[10, 30], [30, 30], [30, 50], [10, 50]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 101500 })) });
        tinCache = null; invalidateCache(); saveState(); draw(); await open3D(); v3SetHour(13); V3.az = 0.9; V3.el = 0.35; V3.dist = 45; V3.target.set(0, 0, 3); };

    // cadrage : le cadre au format, la perspective de la vue = celle de la photo ; vues enregistrées en coordonnées réelles, gardées dans le fichier
    const fr = await ev(async (SC) => { await eval('(' + SC + ')')(); await studioOpen(); await new Promise(r => setTimeout(r, 500)); render3D(); const r = { on: stOn() };
        const F = stFrame(), el = document.getElementById('v3-frame'); r.frame = el && el.style.display === 'block' && Math.abs(F.w / F.h - 16 / 9) < 0.01;
        r.left = F.x + F.w <= window.innerWidth - document.getElementById('t2-panel').offsetWidth;   // le cadre reste à gauche du volet
        stSet('fmt', '1:1'); r.sq = Math.abs(stFrame().w - stFrame().h) < 1; stSet('f', 85); const f85 = V3.camera.fov; stSet('f', 24); r.focal = V3.camera.fov > f85 * 2;
        stViewAdd(); const v = studio.views[0]; V3.az += 1; V3.dist *= 2; render3D(); stViewGo(0); r.view = Math.abs(V3.az - v.az) < 1e-9 && Math.abs(V3.dist - v.dist) < 1e-9 && studio.f === 24 && studio.fmt === '1:1';
        const D = JSON.parse(JSON.stringify(projectData())); r.saved = !!(D.studio && D.studio.views.length === 1); studio = studioNew(); loadProjectText(JSON.stringify(D)); r.loaded = studio.views.length === 1 && studio.views[0].n === 'Vue 1';
        await open3D(); await studioOpen(); r.panel = !!document.querySelector('#t2-panel .st-view'); studioClose(); r.off = !stOn() && !(V3.camera.view && V3.camera.view.enabled) && V3.camera.fov === 45 && document.getElementById('v3-frame').style.display === 'none';
        return r; }, SC.toString());
    t.eq('studio photo : cadre au format (à gauche du volet), focale, vue enregistrée puis retrouvée, gardée dans le fichier ; fermé : vue normale', fr, { on: true, frame: true, left: true, sq: true, focal: true, view: true, saved: true, loaded: true, panel: true, off: true });

    // photo 360° : seulement dans le studio ; cylindre aux bords fondus, ciel teinté par le haut de la photo ; hauteur / distance / orientation
    const pn = await ev(async () => { const c = document.createElement('canvas'); c.width = 1200; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#d08040'; x.fillRect(0, 0, 1200, 30); x.fillStyle = '#556b2f'; x.fillRect(0, 30, 1200, 170);
        const b = await new Promise(r => c.toBlob(r, 'image/png')); await v3PanoFromBlob(b, false); stPano.on = true; stPano.d = 400; stPano.h = 1.6; stPano.rot = 0; const r = {};
        render3D(); r.outside = !V3.panoC.visible; await studioOpen(); render3D(); r.inside = V3.panoC.visible && !V3.pano.visible;
        r.fade = !!V3.panoC.material.alphaMap && V3.panoC.material.transparent; const U = V3.sky.material.uniforms; r.tint = U.pk.value === 1 && Math.abs(U.ptop.value.x - 0xd0 / 255) < 0.05 && U.ptop.value.x > U.ptop.value.z;
        const z0 = V3.panoC.position.z - V3.camera.position.z; stPanoSet('h', 120); const z1 = V3.panoC.position.z - V3.camera.position.z; stPanoSet('d', 2000); const z2 = V3.panoC.position.z - V3.camera.position.z; stPanoSet('rot', 90);
        r.height = z1 > z0 && z2 < z1 && z2 > z0; r.rot = Math.abs(V3.panoC.rotation.z - Math.PI / 2) < 1e-6;
        r.noCycle = !V3_LAND_ORDER.includes('photo'); studioClose(); render3D(); r.closed = !V3.panoC.visible && V3.sky.material.uniforms.pk.value === 0; stPano.on = false; stPanoSave(); return r; });
    t.eq('photo 360° : seulement dans le studio, bords du cylindre fondus, ciel à la teinte de la photo ; hauteur, distance, orientation', pn, { outside: true, inside: true, fade: true, tint: true, height: true, rot: true, noCycle: true, closed: true });

    // rendu : passes accumulées, ombres portées, scène affinée le temps du rendu puis rendue telle quelle
    const rd = await ev(async () => { await studioOpen(); studio.q = 'haute'; studio.granS = 62; studio.fmt = '16:9'; V3.az = 2.4; V3.el = 0.12; V3.dist = 9; V3.target.set(-10, 3, 1.2); render3D(); V3.rdSize = [200, 112]; V3.rdSpp = 3; const r = {}; let hq = null;
        const keepB = build3DScene; window.build3DScene = function () { if (V3.hq) { hq = hq || {}; } keepB(); if (V3.hq) V3.root.traverse(o => { if (o.userData.grass) hq.grass = (hq.grass || 0) + o.count; if (o.userData.bois && o.material && o.material.vertexColors) hq.tree = true; if (o.userData.grain) hq.grain = (hq.grain || 0) + o.count; if (o.userData.boisTronc && o.material.map === BARK_TEX) hq.bark = true; }); };
        studioRender(); await new Promise(res => { const k = setInterval(() => { if (!RD) { clearInterval(k); res(); } }, 100); });
        window.build3DScene = keepB; r.done = !!RD_LAST && RD_LAST.n === 3 && RD_LAST.cv.width === 200 && RD_LAST.cv.height === 112; r.ui = document.getElementById('rd-ov').style.display === 'flex' && !!document.querySelector('#rd-ov .vbtn.pri');
        r.grass = !!(hq && hq.grass > 50); r.tree = !!(hq && hq.tree); r.grain = !!(hq && hq.grain > 20); r.bark = !!(hq && hq.bark); r.ctl = ['st-gh'].every(id => document.getElementById(id)) && !!document.getElementById('st-gr') && /Extrême/.test(document.getElementById('t2-panel').textContent); let g = 0; V3.root.traverse(o => { if (o.userData.grass) g++; }); r.back = g === 0 && !V3.sun.castShadow && !V3.rdSky;
        const d = RD_LAST.cv.getContext('2d').getImageData(0, 0, 200, 112).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; lo = Math.min(lo, l); hi = Math.max(hi, l); } r.image = hi - lo > 60;
        rdUI('off'); studioClose(); delete V3.rdSize; delete V3.rdSpp; return r; });
    t.eq('rendu : passes accumulées dans une image, scène affinée (herbe en brins, terre en grains, écorce, arbres détaillés), réglages herbe / granulométrie / qualité Extrême le temps du rendu, puis vue normale', rd, { done: true, ui: true, grass: true, tree: true, grain: true, bark: true, ctl: true, back: true, image: true });

    // réglages des matières : la hauteur de l'herbe et la granulométrie changent la taille des brins et des grains
    const mt = await ev(async () => { studio.q = 'haute'; const sz = {}; const keepB = build3DScene;
        const probe = async (k) => { V3.hq = { tree: 1, terr: 1, grass: 300000, earth: true, rc: (() => { const c = V3.camera.clone(); c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true); return c; })() }; try { build3DScene(); } finally { V3.hq = null; }
            let g = 0, gn = 0, e = 0, en = 0; const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); V3.root.traverse(o => { if (!o.isInstancedMesh) return; for (let i = 0; i < Math.min(o.count, 200); i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); if (o.userData.grass) { g += s.z; gn++; } if (o.userData.grain) { e += s.z; en++; } } }); sz[k] = [gn ? g / gn : 0, en ? e / en : 0]; };
        await studioOpen(); studio.grassH = 6; studio.granS = 38; await probe('a'); studio.grassH = 30; studio.granS = 90; await probe('b'); studio.grassH = 12; studio.granS = 38; build3DScene(); render3D(); studioClose();
        return { grass: sz.b[0] > sz.a[0] * 3, gran: sz.b[1] > sz.a[1] * 4 }; });
    t.eq('matières : hauteur de l\'herbe et granulométrie de la terre réglables', mt, { grass: true, gran: true });

    // rivière en rendu : eau à vaguelettes et reflets, rochers et roseaux sur les rives ; rien de tout ça hors rendu
    const rv = await ev(async () => { const m = mmToWorld(1000), L = [], R = []; for (let i = 0; i <= 20; i++) { L.push({ x: 5 * m + i * 2.5 * m, y: -28 * m }); R.push({ x: 5 * m + i * 2.5 * m, y: -32 * m }); }
        const zs = L.map((q, i) => 100800 - i * 10).concat(R.map((q, i) => 100800 - i * 10).reverse()), rs = { type: 'poly', layerId: 'layer-0', points: L.concat(R.slice().reverse()), river: { zs, w: 4, name: 'Test' }, zk: 1 }; shapes.push(rs); invalidateCache();
        const r = {}; let n0 = 0; build3DScene(); V3.root.traverse(o => { if (o.userData.rock || o.userData.reed) n0++; if (o.userData.river) r.plain = !o.material.isMeshPhongMaterial; });
        const rc = V3.camera.clone(); rc.clearViewOffset(); rc.updateProjectionMatrix(); rc.updateMatrixWorld(true); V3.hq = { tree: 1, terr: 1, grass: 100000, earth: false, riv: true, wave: true, rc }; try { build3DScene(); } finally { V3.hq = null; }
        let rk = 0, rd = 0; V3.root.traverse(o => { if (o.userData.rock) rk += o.count; if (o.userData.reed) rd += o.count; if (o.userData.river) { r.phong = o.material.isMeshPhongMaterial && o.material.normalMap === WAVE_TEX; } });
        r.rocks = rk > 20; r.reeds = rd > 0; r.none = n0 === 0; shapes = shapes.filter(x => x !== rs); invalidateCache(); build3DScene(); render3D(); return r; });
    t.eq('rivière en rendu : vaguelettes à reflets, rochers et roseaux sur les rives (rien de tout ça hors rendu)', rv, { plain: true, phong: true, rocks: true, reeds: true, none: true });

    // étang dessiné (plateforme creusée + niveau d'eau) : rochers et roseaux sur la ligne où l'eau rencontre le talus
    const et = await ev(async () => { const m = mmToWorld(1000), pf = { type: 'poly', layerId: 'layer-0', points: [[15, 12], [28, 12], [28, 22], [15, 22]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 99000 })) }, w = { type: 'poly', layerId: 'layer-0', points: [[8, 6], [35, 6], [35, 28], [8, 28]].map(([x, y]) => ({ x: x * m, y: -y * m })), water: { z: 100300, name: 'Étang' }, zk: 1 };
        shapes.push(pf, w); tinCache = null; invalidateCache(); const S = waterShore(w), r = { shore: S.length > 20 };
        const zs = S.map(([a]) => groundZAt(a.x, a.y, false)); r.onLevel = zs.every(z => Math.abs(z - 100300) < 250);
        const rc = V3.camera.clone(); rc.clearViewOffset(); rc.updateProjectionMatrix(); rc.updateMatrixWorld(true); V3.hq = { tree: 1, terr: 1, grass: 100000, earth: false, riv: true, wave: true, rc }; try { build3DScene(); } finally { V3.hq = null; }
        let rk = 0; V3.root.traverse(o => { if (o.userData.rock) rk += o.count; }); r.rocks = rk > 10; shapes = shapes.filter(x => x !== pf && x !== w); tinCache = null; invalidateCache(); build3DScene(); render3D(); return r; });
    t.eq('étang dessiné (bassin creusé + niveau d\'eau) : rive trouvée là où l\'eau rencontre le talus, rochers et roseaux dessus', et, { shore: true, onLevel: true, rocks: true });

    // ombres portées : un mur au soleil fait de l'ombre au sol dans le rendu, pas sans les ombres
    const sh = await ev(async () => { const m = mmToWorld(1000); await studioOpen(); V3.az = 0; V3.el = 1.4; V3.dist = 70; V3.target.set(0, 0, 0); v3SetHour(12); render3D(); studio.q = 'rapide'; studio.fin = false; V3.rdSize = [160, 120]; V3.rdSpp = 1;
        const go = async (s) => { studio.sh = s; studioRender(); await new Promise(res => { const k = setInterval(() => { if (!RD) { clearInterval(k); res(); } }, 100); }); const d = RD_LAST.cv.getContext('2d').getImageData(0, 0, 160, 120).data; let a = 0; for (let i = 0; i < d.length; i += 4) a += d[i] + d[i + 1] + d[i + 2]; rdUI('off'); return a; };
        const a1 = await go(true), a0 = await go(false); studioClose(); delete V3.rdSize; delete V3.rdSpp; studio.fin = true; return { darker: a1 < a0 * 0.995 }; });
    t.eq('ombres portées : le rendu avec ombres est plus sombre (ombre des arbres au sol)', sh, { darker: true });

    // fluidité 3D : plusieurs mouvements dans la même image d'écran = un seul rendu ; scène lourde : résolution réduite pendant le geste, rétablie après
    const fl = await ev(async () => { await open3D(); let n = 0; const k = window.render3D; window.render3D = function () { n++; return k.apply(this, arguments); };
        for (let i = 0; i < 6; i++) render3DSoon(true); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30))); window.render3D = k; const one = n === 1;
        v3FullRes(); const pr = V3.renderer.getPixelRatio(); V3.rt = 120; render3DSoon(true); const low = V3.renderer.getPixelRatio() === Math.max(0.5, pr * 0.5); v3FullRes(); const back = V3.renderer.getPixelRatio() === pr; return { one, low, back }; });
    t.eq('fluidité 3D : un seul rendu par image d\'écran pendant un geste ; résolution réduite pendant le geste sur une scène lourde, puis rétablie', fl, { one: true, low: true, back: true });

    // végétation : volet (arbres, buissons, broussailles), buissons sans tronc ; balade : plus rapide, Espace = sauter, studio photo ; herbe : jauge de densité, pas sur les marches ni les zones repeintes
    const vg = await ev(async () => { close3D(); const m = mmToWorld(1000), r = {}; startBois(); const P = document.getElementById('t2-panel'); r.panel = P.dataset.kind === 'veg' && /Broussailles/.test(P.textContent);
        vegSet('kind', 'buisson'); r.h = vegOpt.h.buisson === 1.8 && !!document.getElementById('veg-h'); boisCreate([[5, 40], [20, 40], [20, 55], [5, 55]].map(([x, y]) => ({ x: x * m, y: -y * m }))); const B = shapes[shapes.length - 1]; r.kind = B.bois.kind === 'buisson' && B.bois.h === 1.8 && B.name === 'Buissons';
        r.closed = P.style.display === 'none'; await open3D(); let cr = 0, tr = 0; V3.root.traverse(o => { if (o.userData.bois) cr = o.count; if (o.userData.boisTronc) tr = o.count; }); r.noTrunk = cr > boisTrees(B).length - 1 && tr === cr - boisTrees(B).length;
        shapes = shapes.filter(x => x !== B); vegOpt.kind = 'arbre'; vegSave(); invalidateCache(); build3DScene(); render3D(); return r; });
    t.eq('végétation : volet (sorte, hauteur, couleur), zone de buissons (sans tronc)', vg, { panel: true, h: true, kind: true, closed: true, noTrunk: true });

    const fp = await ev(async () => { const r = {}; await open3D(); await momoFPS({ w: { x: 30 * mmToWorld(1000), y: -30 * mmToWorld(1000) } }); const F = V3.fps, z0 = F.pos.z, x0 = F.pos.x, y0 = F.pos.y;
        F.keys.KeyW = true; fpsStep(0.5); F.keys.KeyW = false; r.fast = Math.hypot(F.pos.x - x0, F.pos.y - y0) > 1.5;
        for (let i = 0; i < 30; i++) fpsStep(0.05); const zj = F.pos.z; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); r.jump = F.vz > 0; for (let i = 0; i < 4; i++) fpsStep(0.05); r.up = F.pos.z > zj + 0.3; for (let i = 0; i < 60; i++) fpsStep(0.05); r.land = F.vz === 0 && Math.abs(F.pos.z - zj) < 0.3;
        await studioOpen(); r.studio = stOn() && !!V3.fps;  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); r.back = !stOn() && !!V3.fps; fpsStop(); return r; });
    t.eq('balade Momo : déplacement plus rapide, Espace pour sauter (et retomber), le studio photo s\'ouvre pendant la balade, Échap le referme', fp, { fast: true, jump: true, up: true, land: true, studio: true, back: true });

    const ns = await ev(async () => { const m = mmToWorld(1000), st = { type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 0, y2: 0, stair: { a: { x: 10 * m, y: -10 * m }, b: { x: 14 * m, y: -10 * m }, w: 1500, n: 5, z0: 100000, z1: 100800 } }, br = { type: 'poly', open: false, layerId: 'layer-0', points: [[30, 30], [34, 30], [34, 34], [30, 34]].map(([x, y]) => ({ x: x * m, y: -y * m })), brush: { tex: 'pave', d: 300, h: 1, top: true, poly: true } };
        shapes.push(st, br); const f = v3NoSow(), r = { stair: f(12 * m, -10 * m) && !f(12 * m, -13 * m), brush: f(32 * m, -32 * m) && !f(36 * m, -32 * m) }; shapes = shapes.filter(x => x !== st && x !== br);
        await studioOpen(); r.gauge = !!document.getElementById('st-gn') && stGrassTxt(800) === 'moquette'; studioClose(); return r; });
    t.eq('herbe : jauge de densité (jusqu\'à la moquette) ; ni herbe ni grains sur les marches et les zones repeintes', ns, { stair: true, brush: true, gauge: true });
    // rendu : pas un brin d'herbe sur une zone peinte, même loin de l'origine (la scène 3D est recentrée)
    const nsr = await ev(async () => { const keep = shapes, m = mmToWorld(1000), X0 = 984 * m, Y0 = -885 * m, TN = ensureLayer('Terrain naturel', '#bef264'); shapes = [];
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) shapes.push({ type: 'point', layerId: TN, x: X0 + i * 5 * m, y: Y0 - j * 5 * m, z: 813000 + i * 30, zk: 1 });
        const Z = [[25, 20], [35, 20], [35, 40], [25, 40]].map(([x, y]) => ({ x: X0 + x * m, y: Y0 - y * m })), br = { type: 'poly', open: false, layerId: 'layer-0', points: Z, name: 'Zone peinte', brush: { tex: 'enrobe', d: 800, h: 0.6, top: true, poly: true, zs: Z.map(() => 813150) } };
        shapes.push(br); invalidateCache(); saveState(); const nat = document.getElementById('v3-nat'); if (nat && !nat.checked) nat.click(); await open3D(); await new Promise(res => setTimeout(res, 300));
        const rp = V3.root.position; V3.target.set(1014 + rp.x, 915 + rp.y, 0.5); V3.dist = 20; V3.el = 0.15; V3.az = 3.14; render3D(); const g0 = studio.grass; studio.grass = true;
        V3.hq = { tree: 1, terr: 1, grass: 300000, earth: true, rc: (() => { const c = V3.camera.clone(); c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true); return c; })() }; try { build3DScene(); } finally { V3.hq = null; studio.grass = g0; }
        let inn = 0, out = 0; const M4 = new THREE.Matrix4(), ps = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
        V3.root.traverse(o => { if (!o.isInstancedMesh || !o.userData.grass) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); M4.decompose(ps, q, sc); const wx = mmToWorld(ps.x * 1000), wy = mmToWorld(-ps.y * 1000); if (pointInPolygon(wx, wy, Z) && distToPoly(wx, wy, Z) > mmToWorld(5)) inn++; else out++;   /* 5 mm : la précision des matrices (flottants) au bord */ } });
        close3D(); shapes = keep; invalidateCache(); saveState(); const r = { none: inn === 0, around: out > 100 }; if (inn) r.dbg = [inn, out]; return r; });
    t.eq('rendu : aucun brin d\'herbe sur une zone peinte, même sur un plan loin de l\'origine', nsr, { none: true, around: true });

    // herbe : l'herbe sèche, jaunie ou olive de la photo aérienne reçoit du gazon (plus de trous) ; routes grises et tuiles rouges restent nues
    const gz = await ev(() => ({ dry: isGrassyPx([150, 140, 80]), olive: isGrassyPx([128, 128, 96]), dark: isGrassyPx([40, 52, 38]), road: isGrassyPx([110, 110, 110]), tile: isGrassyPx([170, 80, 60]), white: isGrassyPx([235, 235, 230]) }));
    t.eq('herbe : pas de trou sur l\'herbe sèche ou olive de la photo, rien sur route et tuiles', gz, { dry: true, olive: true, dark: true, road: false, tile: false, white: false });

    // rendu : terrain naturel affiné (bien plus de triangles) et sans fente entre triangles voisins
    const tf = await ev(async () => { await open3D(); build3DScene(); const t0 = V3.terrStats.tris; const rc = V3.camera.clone(); rc.clearViewOffset(); rc.updateProjectionMatrix(); rc.updateMatrixWorld(true);
        V3.hq = { tree: 1, terr: 2, grass: 0, earth: false, rc }; try { build3DScene(); } finally { V3.hq = null; } const t1 = V3.terrStats.tris;
        let M = null; V3.root.traverse(o => { if (o.isMesh && o.material && o.material.map && [texCanvas('pelouse'), texCanvas('pelouse', 512)].includes(o.material.map.image)) M = o; }); const E = new Map(), p = M.geometry.attributes.position, key = (i) => [p.getX(i), p.getY(i)].map(v => Math.round(v * 1000)).join(',');
        for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const a = i + k, b = i + (k + 1) % 3, K = [key(a), key(b)].sort().join('|'); E.set(K, (E.get(K) || 0) + 1); }
        let open = 0; E.forEach(v => { if (v === 1) open++; }); build3DScene(); render3D(); return { more: t1 > t0 * 2.5, border: open < Math.sqrt(t1) * 6 }; });
    t.eq('rendu : terrain naturel affiné (bien plus de triangles), sans fente', tf, { more: true, border: true });

    // grand fond (terrain grossier) : la chaussée est découpée au bord exact de la route (plus de pointes d'enrobé dans les champs), et la photo drapée ne la recouvre pas
    const rc = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('TN', '#bef264');
        for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 20 * m, y: -j * 20 * m, z: 100000 + i * 300 + j * 150, zk: 1, code: 'TN_IGN' });
        const lay = ensureLayer('Routes — bords (TN)', '#a8a29e'); [1, -1].forEach(sg => shapes.push({ type: 'poly', open: true, layerId: lay, points: Array.from({ length: 50 }, (_, k) => { const t = -190 + k * 7.6, x = t, y = t * 0.45 + 13; return { x: x * m, y: -(y + sg * 3) * m, z: 100000 + Math.round(x * 15 + y * 7.5) }; }), hatch: false, rtOf: 'rt9', road: { w: 6, rid: 'rt9-0' }, name: 'Bord de chaussée' }));
        tinCache = null; invalidateCache(); await open3D(); let bad = 0, tot = 0; const c = V3.center;
        V3.root.traverse(o => { if (!(o.isMesh && o.material && o.material.map && o.material.map.image === texCanvas('enrobe'))) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { tot++; const gx = (pa.getX(i) + pa.getX(i + 1) + pa.getX(i + 2)) / 3, gy = (pa.getY(i) + pa.getY(i + 1) + pa.getY(i + 2)) / 3; for (let k = 0; k < 3; k++) { const x = pa.getX(i + k) * 0.97 + gx * 0.03 + c.x, y = pa.getY(i + k) * 0.97 + gy * 0.03 + c.y; if (!roadAt(mmToWorld(x * 1000), mmToWorld(-y * 1000))) { bad++; break; } } } });   // chaque sommet de l'enrobé est sur la route
        let fast = performance.now(); const pts = shapes.filter(x => x.type === 'point'), inB = bandTest([{ D: [{ x: 0, y: 0 }, { x: 100 * m, y: 0 }], h: 5 * m }]); const nIn = pts.filter(q => inB(q.x, q.y)).length; fast = performance.now() - fast;
        const D = Array.from({ length: 200 }, (_, k) => ({ s: k * 2, z0: k % 2 ? 1000 : 0 })); smooth6(D, 'z');
        mcProg('Test', 0.5, 'étape'); const bar = !!document.querySelector('#mc-load .ml-seg'); mcLoad.min = 0; mcProg('', null); await new Promise(res => setTimeout(res, 700));
        shapes = keep; tinCache = null; invalidateCache(); build3DScene(); render3D(); return { road: tot > 20, outside: bad, band: nIn === 6, smooth: Math.abs(D[100].z - 500) < 30, bar, gone: !document.getElementById('mc-prog') }; });
    t.eq('grand fond : chaussée découpée au bord exact (aucun triangle d\'enrobé hors de la route) ; bandes, lissage et barre de progression', rc, { road: true, outside: 0, band: true, smooth: true, bar: true, gone: true });

    // volet de la vue 3D (Espace) : onglets, plus de bandeau ; onglet Décor (relief réel, panorama importé) ; balade : clic droit = pause et bulles d'affichage
    const vv = await ev(async () => { const r = {}; await open3D(); v3PanelClose(); document.activeElement && document.activeElement.blur && document.activeElement.blur();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true })); const P = document.getElementById('t2-panel'); r.open = v3PanelOpen() && P.querySelectorAll('.v3v-rail button').length === 4;
        r.band = getComputedStyle(document.getElementById('v3-band')).display === 'none';
        /* bouton visible du volet (le bandeau n'est plus là) ; onglet Outils : mesurer, collisions, peindre — le contrôle des collisions se lance d'ici */
        { const mb = document.getElementById('v3-menu-btn'); r.menuBtn = !!mb && mb.getBoundingClientRect().width > 0; v3Panel('outils'); const cards = [...P.querySelectorAll('.v3v-card')].map(b => b.textContent.trim()); r.tools = ['Mesurer', 'Collisions', 'Peindre'].every(k => cards.some(c => c.includes(k)));
            const cb = [...P.querySelectorAll('.v3v-card')].find(b => /Collisions/.test(b.textContent)); cb.click(); await new Promise(res => setTimeout(res, 300)); r.colPanel = /Collisions/.test(P.textContent); d3ColClear(); }
        v3Panel('aff'); const s0 = v3Chk('v3-surf'); v3SetChk('v3-surf', !s0); r.toggle = v3Chk('v3-surf') === !s0; v3SetChk('v3-surf', s0);
        v3Panel('ciel'); r.photos = /Relief réel/.test(P.textContent) && /Panorama importé/.test(P.textContent) && !/Paysages dessinés|Ciels photo/.test(P.textContent) && /Décor/.test(P.querySelector('.v3v-rail button.on').textContent);
        v3Panel('studio'); r.studio = stOn() && !!P.querySelector('.v3v-rail button.on') && /Studio/.test(P.querySelector('.v3v-rail button.on').textContent);
        v3Panel('aff'); r.frameOff = !stOn(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true })); r.closed = !v3PanelOpen();
        // balade : clic droit = pause, bulles ; une bulle coche / décoche ; reclic droit = reprise
        await momoFPS({ w: { x: 30 * mmToWorld(1000), y: -30 * mmToWorld(1000) } }); fpsPause({ clientX: 400, clientY: 300 }); const B = document.querySelectorAll('#fps-bub .fb'); r.bubbles = V3.fps.paused && B.length === 10 && /Studio/.test(B[8].title) && /Pinceau/.test(B[9].title) && !!B[0].querySelector('svg') && ![...B].some(b => /Aberration/.test(b.title));
        const t0 = v3Chk('v3-surf'); fpsBubble(3); r.bubToggle = v3Chk('v3-surf') === !t0 && document.querySelectorAll('#fps-bub .fb').length === 10; fpsBubble(3);
        const z0 = V3.fps.pos.clone(); V3.fps.keys.KeyW = true; fpsStep(0.5); V3.fps.keys.KeyW = false; r.still = V3.fps.pos.distanceTo(z0) < 1e-6;
        fpsResume(); r.resume = !V3.fps.paused && !document.getElementById('fps-bub'); r.noBadge = !document.querySelector('.v3-fk') || getComputedStyle(document.querySelector('.v3-fk')).display === 'none'; fpsStop(); return r; });
    t.eq('vue 3D : volet à onglets par Espace (affichage, ciel et paysage, outils, studio), plus de bandeau ; onglet Décor (relief réel, panorama importé) ; balade : clic droit = pause et bulles d\'affichage', vv,
        { open: true, band: true, menuBtn: true, tools: true, colPanel: true, toggle: true, photos: true, studio: true, frameOff: true, closed: true, bubbles: true, bubToggle: true, still: true, resume: true, noBadge: true });

    // ta photo de paysage : posée sur l'horizon, répétée en miroir, haut fondu dans le ciel, sol à sa couleur
    const hi = await ev(async () => { await open3D(); const c = document.createElement('canvas'); c.width = 800; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#3b82f6'; x.fillRect(0, 0, 800, 200); x.fillStyle = '#166534'; x.fillRect(0, 200, 800, 50); x.fillStyle = '#4ade80'; x.fillRect(0, 250, 800, 50);
        hzImgSet.line = 0.83; hzImgBuild(c); if (!v3Chk('v3-hz')) v3SetChk('v3-hz', true); v3HzType('img'); render3D(); const T = HZ_IMG.tex, cam = V3.camera, Rc = cam.far * 0.6, Hc = 2 * Math.PI * Rc / T.userData.asp, bottom = V3.panoC.position.z - Hc / 2 - cam.position.z;
        const r = { shown: V3.panoC.visible && V3.panoC.material.map === T && !V3.pano.visible, mirror: T.image.width / T.image.height > 5 && T.userData.base, onHz: bottom < 0 && bottom > -Rc * 0.03, fade: V3.panoC.material.alphaMap === V3.imgFade, gnd: V3.gnd.visible && V3.gnd.material.color.g > V3.gnd.material.color.r, sky: V3.sky.visible };
        v3HzType('montagne'); render3D(); r.back = !V3.panoC.visible && V3.panoC.material.alphaMap === V3.cylFade; return r; });
    t.eq('ta photo de paysage : sur l\'horizon tout autour (miroir), haut fondu dans le ciel, sol à sa couleur ; retour aux paysages dessinés', hi, { shown: true, mirror: true, onHz: true, fade: true, gnd: true, sky: true, back: true });

    // relief réel alentour : anneau de terrain IGN jusqu'à 12 km, photo aérienne, brume ; caméra qui voit assez loin
    const rl = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000); shapes.push({ type: 'basemap', layerId: 'layer-0', x: 0, y: 0, r: 150 * m, rot: 0, lat: 44.56, lon: 6.08, radiusM: 150, mapId: 'treal' });
        for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) if (i * i + j * j <= 36) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 25 * m, y: -j * 25 * m, z: 800000 + i * 500, zk: 1, code: 'TN_IGN' });
        tinCache = null; invalidateCache(); try { await asDB((st, r) => { const q = st.delete(realSite().key); q.onsuccess = () => r(true); q.onerror = () => r(false); }); } catch (e) {} REAL = null;
        const keepF = window.fetch; let calls = 0; window.fetch = async (u) => { if (/altimetrie/.test(u)) { calls++; const n = decodeURIComponent(String(u).split('&lat=')[1] || '').split('|').length; return new Response(JSON.stringify({ elevations: Array.from({ length: n }, (_, k) => 800 + (k % 7) * 30) }), { status: 200 }); } return Promise.reject(new Error('x')); };
        await open3D(); realSet(true); await (REAL_LOAD || Promise.resolve()); await new Promise(res => setTimeout(res, 50)); window.fetch = keepF; render3D();
        let mesh = null; V3.root.traverse(o => { if (o.userData.real) mesh = o; }); const r = { calls: calls > 20, mesh: !!mesh && mesh.geometry.attributes.position.count === 41 * 144, far: V3.camera.far >= 12000, fog: !!(V3.scene.fog && V3.scene.fog.isRealFog), noHz: !(V3.hz && V3.hz.visible) && !V3.gnd.visible };
        { const keepF2 = window.fetch; window.fetch = async (u) => { if (/altimetrie/.test(u)) { const n = decodeURIComponent(String(u).split('&lat=')[1] || '').split('|').length; return new Response(JSON.stringify({ elevations: Array.from({ length: n }, (_, k) => 800 + (k % 5) * 20) }), { status: 200 }); } return Promise.reject(new Error('x')); };
          try { await asDB((st, rr) => { const q = st.delete(realSite().key + ':hd'); q.onsuccess = () => rr(true); q.onerror = () => rr(false); }); } catch (e) {} REAL_HD = null; await realLoadHD(); window.fetch = keepF2;
          const rc = V3.camera.clone(); rc.updateMatrixWorld(true); V3.hq = { tree: 1, terr: 1, grass: 0, earth: false, realHD: true, rc }; try { build3DScene(); } finally { V3.hq = null; } let hd = null; V3.root.traverse(o => { if (o.userData.real) hd = o; });
          r.hd = !!hd && hd.userData.hd && hd.geometry.attributes.position.count === 81 * 288; { let nr = null; V3.root.traverse(o => { if (o.userData.near) nr = o; }); r.near = !!nr && !!REAL_HD.near && nr.material.map === REAL_HD.near.tex && nr.geometry.index.count > 0; } build3DScene(); let sd = null; V3.root.traverse(o => { if (o.userData.real) sd = o; }); r.sdBack = !!sd && !sd.userData.hd; }
        { const c = document.createElement('canvas'); c.width = 400; c.height = 100; hzImgBuild(c); v3HzType('img'); r.excl1 = !realOn() && v3HzKind === 'img'; realSet(true); r.excl2 = realOn() && v3HzKind !== 'img'; }
        realSet(false); r.off = (() => { let k = 0; V3.root.traverse(o => { if (o.userData.real) k++; }); return k === 0 && !V3.scene.fog; })(); shapes = keep; tinCache = null; invalidateCache(); build3DScene(); render3D(); return r; });
    t.eq('relief réel alentour : vrai terrain IGN jusqu\'à 12 km, photo aérienne, brume au loin ; rechargé en haute définition pour le rendu ; exclusif avec le panorama importé ; s\'éteint proprement', rl, { calls: true, mesh: true, far: true, fog: true, noHz: true, hd: true, near: true, sdBack: true, excl1: true, excl2: true, off: true });

    // rendu avec relief réel HD : l'avancement s'affiche et le temps défile ; service lent → « Arrêter » passe au relief normal et le rendu se fait quand même
    const rh = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000), r = {}; shapes.push({ type: 'basemap', layerId: 'layer-0', x: 0, y: 0, r: 150 * m, rot: 0, lat: 44.57, lon: 6.09, radiusM: 150, mapId: 'treal2' });
        for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) if (i * i + j * j <= 36) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 25 * m, y: -j * 25 * m, z: 800000 + i * 500, zk: 1, code: 'TN_IGN' });
        tinCache = null; invalidateCache(); try { await asDB((st, q2) => { const q = st.delete(realSite().key); q.onsuccess = () => q2(true); q.onerror = () => q2(false); }); await asDB((st, q2) => { const q = st.delete(realSite().key + ':hd'); q.onsuccess = () => q2(true); q.onerror = () => q2(false); }); } catch (e) {} REAL = null; REAL_HD = null;
        const keepF = window.fetch; window.fetch = async (u) => { if (/altimetrie/.test(u)) { const n = decodeURIComponent(String(u).split('&lat=')[1] || '').split('|').length; return new Response(JSON.stringify({ elevations: Array.from({ length: n }, () => 800) }), { status: 200 }); } return Promise.reject(new Error('x')); };
        await open3D(); realSet(true); await (REAL_LOAD || Promise.resolve()); await new Promise(res => setTimeout(res, 50));
        window.fetch = (u, o) => /altimetrie/.test(u) ? new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener('abort', () => rej(new Error('abort'))); }) : Promise.reject(new Error('x'));   /* service qui ne répond plus */
        await studioOpen(); const q0 = studio.q; studio.realHD = true; studio.q = 'rapide'; V3.rdSize = [120, 68]; V3.rdSpp = 2; studioRender(); await new Promise(res => setTimeout(res, 2300));
        r.step = /Relief réel/.test((document.getElementById('rd-step') || {}).textContent || ''); r.ticks = !/^0 s/.test((document.getElementById('rd-time') || {}).textContent || '0 s'); const L0 = RD_LAST; RD.stop = true;
        await new Promise(res => { let n = 0; const k = setInterval(() => { if (!RD || ++n > 200) { clearInterval(k); res(); } }, 100); }); r.done = !RD && !!RD_LAST && RD_LAST !== L0 && RD_LAST.n >= 1;
        window.fetch = keepF; rdUI('off'); studioClose(); studio.realHD = false; studio.q = q0; delete V3.rdSize; delete V3.rdSpp; realSet(false); shapes = keep; tinCache = null; invalidateCache(); build3DScene(); render3D(); return r; });
    t.eq('rendu avec relief réel HD : avancement et temps affichés ; service muet → Arrêter passe au relief normal, l\'image se fait', rh, { step: true, ticks: true, done: true });

    // écran de chargement : flou en fondu, logo dont le M tourne, barre autour du cercle en parts de couleurs, texte qui tourne ; phrases de randonneur pour la balade
    const ld = await ev(async () => { await mcLoad.open('Import du fond de carte', ['Fond de carte', 'Terrain IGN', 'Routes']); mcLoad.set(0, 1); mcLoad.set('Terrain IGN', 0.5, 'Terrain IGN : altitudes… 50 %'); await new Promise(r => setTimeout(r, 600));
        const el = document.getElementById('mc-load'), cs = getComputedStyle(el), segs = [...el.querySelectorAll('.ml-seg')], r = { shown: el.classList.contains('ml-in') && !el.querySelector('.ml-title, .ml-leg, .ml-step') && parseFloat(cs.opacity) > 0.9 && /blur/.test(cs.backdropFilter || cs.webkitBackdropFilter || ''),
            segs: segs.length === 3 && new Set(segs.map(c => c.getAttribute('stroke'))).size === 3 && parseFloat(segs[0].style.strokeDasharray) > parseFloat(segs[1].style.strokeDasharray) && segs[2].style.opacity === '0',
            text: /Terrain IGN/.test(el.querySelector('#ml-tp').textContent) && getComputedStyle(el.querySelector('.ml-turn')).animationName === 'ml-turn', m3d: getComputedStyle(el.querySelector('.ml-m svg')).animationName === 'none', fluid: (mcLoad.set(2, null), await new Promise(res => setTimeout(res, 600)), mcLoad.shown[2] > 0.08 && mcLoad.shown[2] < 0.93), click: cs.pointerEvents === 'none' };
        await mcLoad.close(); await new Promise(res => setTimeout(res, 600)); r.gone = !document.getElementById('mc-load') && !mcLoad.on;
        await mcLoad.open('Balade Momo', ['Balade Momo'], { fun: true }); r.fun = ML_FUN.some(f => mcLoad.txt.startsWith(f)); mcLoad.min = 0; await mcLoad.close();
        await new Promise(res => setTimeout(res, 600)); let seen = 0; const ko = mcLoad.open.bind(mcLoad); mcLoad.open = function () { seen++; return ko.apply(this, arguments); }; close3D(); await open3D(); mcLoad.open = ko; r.open3D = seen === 1; await mcLoad.close(); return r; });
    t.eq('écran de chargement : flou en fondu, logo fixe, avancée continue, barre en parts de couleurs autour du cercle, texte tournant, rien en dessous ; phrases de balade ; ouvert par la vue 3D', ld, { shown: true, segs: true, text: true, m3d: true, fluid: true, click: true, gone: true, fun: true, open3D: true });

    // fond de carte : la fenêtre de configuration s'ouvre à chaque import
    const bmw = await ev(async () => { closeBasemapModal(); startBmPlace(); await new Promise(res => setTimeout(res, 300)); const ok = document.getElementById('basemap-modal').style.display === 'flex' && mode !== 'bmplace'; closeBasemapModal(); return ok; });
    t.ok('fond de carte : la fenêtre de configuration s\'ouvre à chaque import', bmw);

    // carto : système de coordonnées Auto par défaut, zone CC selon la latitude du lieu
    const cr = await ev(() => ({ def: bmSettings.crs, gap: crsPrefP(44.56).code, paris: crsPrefP(48.85).code, nice: crsPrefP(43.7).code, l93: (bmSettings.crs = 'L93', crsPrefP(44.56).code), back: (bmSettings.crs = 'auto', 1),
        guess: [pdfGuessCrs([{ v: 1945000 }, { v: 3290000 }]), pdfGuessCrs([{ v: 945000 }, { v: 6390000 }])].join(',') }));
    t.eq('carto : système Auto par défaut (zone CC du lieu) ; un choix imposé reste respecté ; carroyage PDF deviné', cr, { def: 'auto', gap: 'CC45', paris: 'CC49', nice: 'CC44', l93: 'L93', back: 1, guess: 'CC44,L93' });
    // fluidité : un seul calcul du modèle fini par image ; talus recalculés au plus 4 fois/s pendant un glissé puis à jour au lâcher ; arbres hors écran ignorés ; image de fond gardée
    const pf = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) shapes.push({ type: 'point', layerId: TN, x: i * 10 * m, y: -j * 10 * m, z: 100000 + i * 300, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, points: [[-10, -8], [10, -8], [10, 8], [-10, 8]].map(([x, y]) => ({ x: x * m, y: -y * m, z: 101000 })), talus: { on: true, kR: '3/2', kD: '1/1' } };
        const bo = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [30, 0], [30, 30], [0, 30]].map(([x, y]) => ({ x: (x + 5000) * m, y: y * m })), bois: { h: 12 } };
        shapes.push(pl, bo); tinCache = null; invalidateCache(); const r = {};
        const k0 = finishedModel0; let n = 0; window.finishedModel0 = function () { n++; return k0.apply(this, arguments); }; try { invalidateCache(); draw(); } finally { window.finishedModel0 = k0; } r.memo = n === 1 && FRAME_MEMO === null;
        const g1 = talusGeom(pl); pl.points[0].x += m * 0.5; invalidateCache(); MOUSE_HELD = true; const g2 = talusGeom(pl); r.stale = !!g1 && g2 === g1 && TALUS_STALE;
        window.dispatchEvent(new MouseEvent('mouseup')); r.fresh = !MOUSE_HELD && talusGeom(pl) !== g1;
        const c = document.createElement('canvas').getContext('2d'); c.canvas.width = c.canvas.height = 200; c.setTransform(1, 0, 0, 1, -bo.points[0].x, 0); drawBois2D(c, bo, '#0a0', 0, 0, 1);
        const T = boisTrees(bo, 4000), P1 = BOIS_PATHS.get(T).full; c.setTransform(1, 0, 0, 1, -bo.points[0].x + 50, 0); drawBois2D(c, bo, '#0a0', 0, 0, 1); c.setTransform(1e-6, 0, 0, 1e-6, 0, 0); drawBois2D(c, bo, '#0a0', 0, 0, 1);
        r.cull = !!P1 && BOIS_PATHS.get(T).full === P1 && !!BOIS_PATHS.get(T).simple;
        // navigation : dessin lent → l'image du plan suit la vue, plan net à l'arrêt
        draw(); NAV.ms = 40; navBegin(); const S = NAV.snap; camera.x += 30; navDraw(); r.nav = !!S && NAV.snap === S && !NAV.full; await new Promise(res => setTimeout(res, 300)); r.nav = r.nav && !NAV.snap && NAV.full; NAV.ms = 0;
        basemapStore.tst = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; bmImg('tst'); const im = basemapImgCache.tst; bmImg('tst'); r.img = basemapImgCache.tst === im; delete basemapStore.tst; delete basemapImgCache.tst;
        shapes = keep; tinCache = null; invalidateCache(); draw(); return r; });
    t.eq('fluidité : modèle fini calculé une fois par image, talus allégés pendant un glissé, bois tracé une fois (ronds simples de loin), vue qui suit sans attendre, image de fond gardée', pf, { memo: true, stale: true, fresh: true, cull: true, nav: true, img: true });
    // balade Momo : ouvrir le studio photo (bulle ou volet) fige la vue, rend le pointeur, retire le voile des bulles ; clic droit = reprendre
    const fh = await ev(async () => { const keep = shapes; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264'); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) shapes.push({ type: 'point', layerId: TN, x: i * 10 * m, y: j * 10 * m, z: 100000, zk: 1 });
        invalidateCache(); const ml = mcLoad.min; await momoFPS({ w: { x: 0, y: 0 } }); const r = {}; fpsPause(); fpsBubble(10); await new Promise(res => setTimeout(res, 100));
        r.bulle = !!V3.fps && V3.fps.paused && !document.getElementById('fps-bub') && stOn() && document.getElementById('t2-panel').dataset.kind === 'studio';
        studioClose(); fpsResume(); r.marche = !V3.fps.paused; await studioOpen(); r.volet = V3.fps.paused && stOn(); fpsResume(); r.reprise = !V3.fps.paused;
        studioClose(); fpsStop(); close3D(); shapes = keep; invalidateCache(); draw(); return r; });
    t.eq('balade : le studio photo fige la vue et rend le pointeur (bulle ou volet), clic droit pour reprendre', fh, { bulle: true, marche: true, volet: true, reprise: true });
    // textures en relief au rendu : carte de normales tirée du motif ; la pierre appareillée se raccorde d'un carreau à l'autre
    const tr = await ev(async () => { if (!is3DOpen()) await open3D(); const view = texMaterial('pierre'); V3.hq = { tree: 1, terr: 1 }; let hq; try { hq = texMaterial('pierre'); } finally { V3.hq = null; }
        const c = texCanvas('pierre'), d = c.getContext('2d').getImageData(0, 0, 256, 256).data, px = (x, y) => { const k = 4 * (y * 256 + x); return [d[k], d[k + 1], d[k + 2]]; }; let diff = 0;
        for (let y = 0; y < 256; y++) { const a = px(0, y), b = px(255, y), e = px(1, y); diff += a[0] > 135 && b[0] > 135 && Math.abs(a[0] - b[0]) > 12 ? 1 : 0; }   // une pierre à cheval sur le bord garde sa teinte des deux côtés
        const n = texNormal('pierre').getContext('2d').getImageData(0, 0, 512, 512).data; let flat = 0; for (let k = 0; k < n.length; k += 4) if (Math.abs(n[k] - 128) < 3 && Math.abs(n[k + 1] - 128) < 3) flat++;
        let errs = 0; const ce = console.error; console.error = (...a) => { errs++; ce.apply(console, a); }; try { const sc = new THREE.Scene(), g = texGeometry(new THREE.BoxGeometry(1, 1, 1), 1); sc.add(new THREE.Mesh(g, hq)); sc.add(new THREE.AmbientLight(0xffffff, 1)); const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 10); cam.position.set(2, 1.5, 1); cam.lookAt(0, 0, 0); V3.renderer.render(sc, cam); } finally { console.error = ce; }
        return { vue: view.type, rendu: hq.type, normales: !!hq.normalMap, relief: flat < n.length / 4 * 0.9, raccord: diff < 4 ? true : diff, profondeur: !!hq.userData.pom && errs === 0 }; });
    t.eq('rendu : textures en relief (carte de normales et profondeur par parallaxe), pierre appareillée sans couture', tr, { vue: 'MeshLambertMaterial', rendu: 'MeshStandardMaterial', normales: true, relief: true, raccord: true, profondeur: true });
    // À IMPORTER : un interrupteur à icône par donnée (sans texte), cadastre et bâti séparés ; le bâti seul ne touche pas aux parcelles
    const ic = await ev(async () => { const L = [...document.querySelectorAll('#bm-data label.bm-ic')], r = { n: L.length, svg: L.every(l => l.querySelector('svg') && l.title && !l.textContent.replace(/\d+ m/g, '').trim()) };
        const kp = cadParcels, kw = cadWfs, keep = shapes; let asked = []; const sq = (x, y) => ({ type: 'Feature', properties: { numero: '12', section: 'AB' }, geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 0.0002, y], [x + 0.0002, y + 0.0002], [x, y + 0.0002], [x, y]]] } });
        window.cadParcels = async () => { asked.push('parc'); return [sq(6.08, 44.56)]; }; window.cadWfs = async () => { asked.push('bati'); return { features: [sq(6.0801, 44.5601)] }; };
        try { shapes = []; const b = { type: 'basemap', x: 0, y: 0, r: mmToWorld(200000), lat: 44.5601, lon: 6.0801, mapId: 'tcad' }; shapes.push(b);
            await cadFetch(b, { parc: true, bati: true }); const n1 = [shapes.filter(x => x.cadOf === 'tcad' && !x.cadBati).length, shapes.filter(x => x.cadBati).length]; asked = [];
            await cadFetch(b, { parc: false, bati: true }); r.bati = asked.join(',') + '|' + [shapes.filter(x => x.cadOf === 'tcad' && !x.cadBati).length, shapes.filter(x => x.cadBati).length].join('/') + '|' + n1.join('/');
            bmSettings.data.bati = true; bmSettings.ov.cad = false; r.step = bmImportSteps(b, { cad: false }).map(x => x[0]).filter(n => /Cadastre|Bâti/.test(n)).join(','); }
        finally { window.cadParcels = kp; window.cadWfs = kw; shapes = keep; bmSettings.data.bati = false; invalidateCache(); }
        return r; });
    t.eq('À IMPORTER : interrupteurs à icône sans texte, cadastre et bâti séparés, le bâti seul ne remplace que le bâti', ic, { n: 6, svg: true, bati: 'bati|2/1|2/1', step: 'Bâti' });
    // studio photo : sections rétractables, choix en mosaïque d'aperçus à cocher, densités et grains en réglettes sur la même échelle, couleur de la terre
    const sp = await ev(async () => { if (!is3DOpen()) await open3D(); await studioOpen(); const P = document.getElementById('t2-panel'), r = {};
        r.secs = [...P.querySelectorAll('details.st-sec')].length >= 6 && !P.querySelector('.st-ck'); const t = [...P.querySelectorAll('.st-tile')]; r.tiles = t.length >= 8 && t.every(b => b.querySelector('img, canvas') && b.querySelector('span').textContent.trim()); r.live = ['grass', 'earth'].every(k => { const c = document.getElementById('st-pv-' + k); if (!c) return false; const d0 = c.toDataURL(); if (k === 'grass') studio.grassH = 35; else studio.granS = 90; stPreview(k); const ch = c.toDataURL() !== d0; if (k === 'grass') studio.grassH = 12; else studio.granS = 38; stPreview(k); return ch && getComputedStyle(c.parentNode).gridColumnStart === '1'; });
        const gt = t.find(b => /Herbe en brins/.test(b.textContent)), g0 = studio.grass; gt.click(); r.toggle = studio.grass === !g0 && [...document.querySelectorAll('#t2-panel .st-tile')].find(b => /Herbe en brins/.test(b.textContent)).classList.contains('on') === !g0; if (studio.grass !== g0) { studio.grass = g0; studioPanel(); }
        stGrassSet(50); const n50 = studio.grassN; stGrassSet(100); r.dens = n50 === 250 && studio.grassN === 1000 && stGrassP() === 100 && Math.abs(stEarthMul() - 1) < 1e-9; stGrassSet(50);
        r.gran = [0, 100].map(v => Math.round(stGranD(v) * 1000)).join('-');
        const d = P.querySelector('details.st-sec[data-k="terre"]'); d.open = false; d.dispatchEvent(new Event('toggle')); studioPanel(); r.keep = !document.querySelector('#t2-panel details.st-sec[data-k="terre"]').open; document.querySelector('#t2-panel details.st-sec[data-k="terre"]').open = true; stSecSave(document.querySelector('#t2-panel details.st-sec[data-k="terre"]'));
        stEarthCol('#3e3328'); V3.hq = { tree: 1, terr: 1 }; let m; try { m = texMaterial('terre'); } finally { V3.hq = null; } r.col = m.color.r < 1 && m.color.getHex() !== 0xffffff; stEarthCol(null); r.nat = texMaterial('terre').color.getHex() === 0xffffff;
        studioClose(); return r; });
    t.eq('studio photo : sections rétractables, mosaïque d\'aperçus à cocher, réglettes de densité et de grains, couleur de la terre', sp, { secs: true, tiles: true, live: true, toggle: true, dens: true, gran: '2-350', keep: true, col: true, nat: true });
    // eau au rendu : reflet en miroir des objets proches, recalculé à chaque passe
    const rf = await ev(async () => { const keep = shapes, kq = studio.q, kr = studio.res; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) shapes.push({ type: 'point', layerId: TN, x: i * 10 * m, y: j * 10 * m, z: 99000, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[-15, -6], [15, -6], [15, 10], [-15, 10]].map(([x, y]) => ({ x: x * m, y: -y * m })), open: false, water: { z: 99600, name: 'Étang' }, zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[-4, 12], [4, 12], [4, 16], [-4, 16]].map(([x, y]) => ({ x: x * m, y: -y * m })), solid: { kind: 'box', H: 4000 }, zk: 1 });
        invalidateCache(); await open3D(); await studioOpen(); studio.q = 'rapide'; studio.res = 'hd'; studio.wave = true; V3.az = Math.PI; V3.el = 0.12; V3.dist = 30; const bb = new THREE.Box3().setFromObject(V3.root); bb.getCenter(V3.target); V3.target.z = bb.min.z + 1; render3D();
        const k = rdReflUpdate; let n = 0, on = false; window.rdReflUpdate = function (R, P, c) { k.apply(this, arguments); n++; on = P.U.reflOn.value === 1 && P.U.reflTex.value === P.rt.texture && Math.abs(P.z - (V3.zmin !== undefined ? 0 : P.z)) >= 0; };
        try { await studioRender(); for (let i = 0; i < 300 && RD; i++) await new Promise(r => setTimeout(r, 100)); } finally { window.rdReflUpdate = k; }
        studio.q = kq; studio.res = kr; studioClose(); try { rdClose(); } catch (e) {} shapes = keep; tinCache = null; invalidateCache(); build3DScene(); return { passes: n >= RD_Q.rapide.spp, on }; });
    t.eq('eau au rendu : reflet en miroir des objets proches, recalculé à chaque passe', rf, { passes: true, on: true });
    // volet 3D allégé : Affichage en mosaïque d'aperçus (plus d'exagération ni de coupe en perspective), pas de photo 360° au studio (elle est dans Décor) ;
    // eau : fond (rochers, algues, poissons) ; rendu : profondeur de champ et brume du lointain
    const v3u = await ev(async () => { const keep = shapes, kq = studio.q, r = {}; shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) shapes.push({ type: 'point', layerId: TN, x: i * 10 * m, y: j * 10 * m, z: 99000 - (Math.abs(i) < 2 && Math.abs(j) < 2 ? 1500 : 0), zk: 1 });
        shapes.push({ type: 'poly', layerId: 'layer-0', points: [[-15, -6], [15, -6], [15, 10], [-15, 10]].map(([x, y]) => ({ x: x * m, y: -y * m })), open: false, water: { z: 99600, name: 'Étang' }, zk: 1 }); invalidateCache(); await open3D();
        v3Panel('aff'); const P = document.getElementById('t2-panel'); r.mosaic = P.querySelectorAll('.st-tile img').length === 7 && !/Aberration|Coupe en perspective/.test(P.textContent);
        const t0 = P.querySelector('.st-tile'), on0 = t0.classList.contains('on'); t0.click(); r.toggle = document.getElementById('t2-panel').querySelector('.st-tile').classList.contains('on') === !on0; document.getElementById('t2-panel').querySelector('.st-tile').click();
        await studioOpen(); const S = document.getElementById('t2-panel'); r.noPano = !S.querySelector('details.st-sec[data-k="pano"]'); r.tiles = ['Fond : rochers, algues, poissons', 'Profondeur de champ', 'Brume du lointain'].every(l => [...S.querySelectorAll('.st-tile span')].some(x => x.textContent === l));
        V3.hq = { tree: 1, terr: 1, bed: true }; try { build3DScene(); } finally { V3.hq = null; } let rk = 0, al = 0, fi = 0; V3.root.traverse(o => { if (o.userData.bed) { if (o.userData.fish) fi += o.count; else if (o.material.side === THREE.DoubleSide) al += o.count; else rk += o.count; } }); r.bed = rk > 20 && al > 20 && fi >= 1;
        studio.q = 'rapide'; studio.dof = true; studio.haze = true; V3.rdSize = [120, 80]; V3.rdSpp = 3; const fog0 = V3.scene.fog; let fogSeen = false; const k = R0 => R0; const F0 = THREE.Fog; THREE.Fog = class extends F0 { constructor(...q) { super(...q); fogSeen = true; } };
        try { studioRender(); for (let i = 0; i < 300 && RD; i++) await new Promise(res => setTimeout(res, 100)); } finally { THREE.Fog = F0; }
        r.render = !!RD_LAST && RD_LAST.n === 3 && fogSeen && V3.scene.fog === fog0; studio.dof = false; studio.haze = false; studio.q = kq; delete V3.rdSize; delete V3.rdSpp; studioClose(); try { rdClose(); } catch (e) {} shapes = keep; tinCache = null; invalidateCache(); build3DScene(); return r; });
    t.eq('volet 3D : Affichage en mosaïque, sans exagération ni coupe en perspective ; studio sans photo 360° ; fond de l\'eau ; profondeur de champ et brume au rendu', v3u, { mosaic: true, toggle: true, noPano: true, tiles: true, bed: true, render: true });
    // moteur 3D à jour (r159) réglé comme avant : pas de gestion des couleurs, sortie linéaire, lumières à l'ancienne ; même image qu'en r128
    const t3 = await ev(async () => { if (!is3DOpen()) await open3D(); const R = V3.renderer; return { rev: THREE.REVISION, cm: !THREE.ColorManagement.enabled, out: R.outputColorSpace === THREE.LinearSRGBColorSpace, legacy: R.useLegacyLights === true, lambert: !!THREE.ShaderChunk.map_fragment }; });
    t.eq('moteur 3D r159, réglé pour garder le rendu d\'avant', t3, { rev: '159', cm: true, out: true, legacy: true, lambert: true });
    // pinceau de la vue Momo : la vue se fige, un clic peint la surface (volume ou meuble), P / Échap / clic droit : la balade reprend ; textures textiles au catalogue
    const fpaint = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {};
        const D = { type: 'poly', layerId: activeLayerId, points: [[-3, -3], [6, -3], [6, 6], [-3, 6]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })), solid: { kind: 'box', H: 200 }, zk: 1 }; shapes.push(D);
        startStamp('canape'); currentX = pt(2, 2).x; currentY = pt(2, 2).y; placeStamp(); setMode('select-box'); saveState();
        r.textile = TEX_LIB.filter(t => t.cat === 'textile').length >= 10 && TEX_CATS.some(c => c[0] === 'textile');
        await open3D(); await momoFPS({ w: pt(0, 0) }); r.walk = !!V3.fps; fpsPaint(); r.frozen = !!V3.fps.paused && !!texPaint && !!document.getElementById('t2-panel');
        texPaint.tex = 'tx-velours'; const cv = V3.renderer.domElement, rc = cv.getBoundingClientRect(), at = (o) => { V3.root.updateMatrixWorld(true); const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()), v = c.project(V3.camera); return { clientX: rc.left + (v.x + 1) / 2 * rc.width, clientY: rc.top + (1 - v.y) / 2 * rc.height }; };
        let bm = null; V3.root.traverse(o => { if (!bm && o.isMesh && o.userData.blk) bm = o; }); V3.fps.pos.set(bm.position.x, bm.position.y, 1.6); V3.fps.yaw = 0; V3.fps.pitch = -1.2; render3D();
        const B = bm.userData.blk; let hit = null; V3.root.traverse(o => { if (!hit && o.isMesh && o.userData.blk === B) hit = o; }); pick3D(at(hit)); r.blk = !!(B.btex && Object.values(B.btex).includes('tx-velours'));
        fpsPaintStop(); r.resumed = !texPaint && !V3.fps.paused; fpsStop(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('vue Momo : pinceau (vue figée, meuble peint en textile, reprise de la balade) ; textures textiles', fpaint, { textile: true, walk: true, frozen: true, blk: true, resumed: true });
    // peinture d'une paroi face par face : chaque parement sa texture, Maj + clic = toute la paroi
    const fface = await ev(async () => { const keepS = shapes; shapes = []; bldActivate(null); lvlOn = false; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m }), r = {}, Pm = (x, y) => ({ x: worldToMm(x) / 1000, y: -worldToMm(y) / 1000 });
        wallOpt.align = 'gauche'; startWall(WALL_PRESETS[0].id); wallStart = pt(0, 0); wallChain = null; wallAddTo(pt(6, 0).x, pt(6, 0).y); wallChain = null; wallStart = null; setMode('select-box'); const W = shapes.find(x => x.type === 'hatch' && x.wallMat); W.wz = { b: 100000, t: 102700 }; saveState();
        await open3D(); startPaint('paint'); const mesh = () => { let me = null; V3.root.traverse(o => { if (!me && o.isMesh && o.userData.shape && o.userData.shape.wallMat) me = o; }); return me; };
        const shoot = (y, dir) => { const me = mesh(); me.updateMatrixWorld(true); const o = me.localToWorld(new THREE.Vector3(3, y, Zm0())), d = me.localToWorld(new THREE.Vector3(3, y + dir, Zm0())).sub(o).normalize(); return new THREE.Raycaster(o, d).intersectObject(me)[0]; }, Zm0 = () => { const me = mesh(); me.geometry.computeBoundingBox(); return (me.geometry.boundingBox.min.z + me.geometry.boundingBox.max.z) / 2; };
        const t1 = 'tx-velours', t2 = TEX_LIB.find(t => t.id !== t1 && t.cat !== 'textile').id;
        texPaint.tex = t1; wallFacePaint(W2(), shoot(-1, 1), Pm); function W2() { return shapes.find(x => x.type === 'hatch' && x.wallMat); }
        texPaint.tex = t2; wallFacePaint(W2(), shoot(1, -1), Pm); const F = (W2().fte || []).map(e => e.t); r.two = F.length === 2 && F.includes(t1) && F.includes(t2) && !W2().ftex;
        const me = mesh(); r.mats = Array.isArray(me.material) && me.material.length === 3 && me.geometry.groups.length === 3;
        texPaint.kind = 'texclear'; wallFacePaint(W2(), shoot(-1, 1), Pm); r.clear = (W2().fte || []).length === 1;
        texPaint.kind = 'paint'; texPaint.tex = t1; texApply(W2()); r.whole = W2().tex === t1 && !W2().ftex && !W2().fte;
        texStop(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('paroi peinte face par face (deux parements, deux textures), gomme d\'une face, Maj + clic = toute la paroi', fface, { two: true, mats: true, clear: true, whole: true });
    /* volume (dalle) peint face par face : le dessus, une tranche, chacun sa texture ; la face suit le volume déplacé ; Maj + clic = tout le volume */
    const vface = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), pt = (x, y) => ({ x: x * m, y: -y * m });
        const D = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [4, 0], [4, 3], [0, 3]].map(([x, y]) => Object.assign(pt(x, y), { z: 100000 })), solid: { kind: 'box', H: 250 }, zk: 1, name: 'Dalle' }; shapes.push(D); saveState();
        await open3D(); startPaint('paint'); const r = {}, Pm = (x, y) => ({ x: worldToMm(x) / 1000, y: -worldToMm(y) / 1000 }), mesh = () => { let me = null; V3.root.traverse(o => { if (!me && o.isMesh && o.userData.shape === D) me = o; }); return me; };
        const shoot = (o, d) => { const me = mesh(); me.updateMatrixWorld(true); me.geometry.computeBoundingBox(); const bb = me.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3()); const O = me.localToWorld(new THREE.Vector3(c.x + o[0], c.y + o[1], c.z + o[2])), T = me.localToWorld(new THREE.Vector3(c.x + o[0] + d[0], c.y + o[1] + d[1], c.z + o[2] + d[2])).sub(O).normalize(); return new THREE.Raycaster(O, T).intersectObject(me)[0]; };
        const t1 = TEX_LIB[0].id, t2 = TEX_LIB[1].id; r.faceable = faceable(D);
        texPaint.tex = t1; wallFacePaint(D, shoot([0, 0, 2], [0, 0, -1]), Pm); texPaint.tex = t2; wallFacePaint(D, shoot([5, 0, 0], [-1, 0, 0]), Pm);
        r.top = (D.ftex || {}).top === t1; r.side = (D.fte || []).length === 1 && D.fte[0].t === t2 && wallEdgeTex(D).filter(t => t === t2).length === 1;
        const me = mesh(); r.mats = Array.isArray(me.material) && me.material.length === 3;
        translateShape(D, 10 * m, 0); r.moved = wallEdgeTex(D).filter(t => t === t2).length === 1;
        texPaint.tex = t1; texApply(D); r.whole = D.tex === t1 && !D.ftex && !D.fte;
        texStop(); close3D(); shapes = keepS; invalidateCache(); saveState(); draw(); return r; });
    t.eq('volume (dalle) peint face par face : dessus et tranche, chacun sa texture, suit un déplacement ; Maj + clic = tout le volume', vface, { faceable: true, top: true, side: true, mats: true, moved: true, whole: true });
} };
