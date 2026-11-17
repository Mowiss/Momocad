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
    const rd = await ev(async () => { await studioOpen(); studio.q = 'haute'; studio.gran = 'caill'; studio.fmt = '16:9'; V3.az = 2.4; V3.el = 0.12; V3.dist = 9; V3.target.set(-10, 3, 1.2); render3D(); V3.rdSize = [200, 112]; V3.rdSpp = 3; const r = {}; let hq = null;
        const keepB = build3DScene; window.build3DScene = function () { if (V3.hq) { hq = hq || {}; } keepB(); if (V3.hq) V3.root.traverse(o => { if (o.userData.grass) hq.grass = (hq.grass || 0) + o.count; if (o.userData.bois && o.material && o.material.vertexColors) hq.tree = true; if (o.userData.grain) hq.grain = (hq.grain || 0) + o.count; if (o.userData.boisTronc && o.material.map === BARK_TEX) hq.bark = true; }); };
        studioRender(); await new Promise(res => { const k = setInterval(() => { if (!RD) { clearInterval(k); res(); } }, 100); });
        window.build3DScene = keepB; r.done = !!RD_LAST && RD_LAST.n === 3 && RD_LAST.cv.width === 200 && RD_LAST.cv.height === 112; r.ui = document.getElementById('rd-ov').style.display === 'flex' && !!document.querySelector('#rd-ov .vbtn.pri');
        r.grass = !!(hq && hq.grass > 50); r.tree = !!(hq && hq.tree); r.grain = !!(hq && hq.grain > 20); r.bark = !!(hq && hq.bark); r.ctl = ['st-gh'].every(id => document.getElementById(id)) && /Granulométrie/.test(document.getElementById('t2-panel').textContent) && /Extrême/.test(document.getElementById('t2-panel').textContent); let g = 0; V3.root.traverse(o => { if (o.userData.grass) g++; }); r.back = g === 0 && !V3.sun.castShadow && !V3.rdSky;
        const d = RD_LAST.cv.getContext('2d').getImageData(0, 0, 200, 112).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; lo = Math.min(lo, l); hi = Math.max(hi, l); } r.image = hi - lo > 60;
        rdUI('off'); studioClose(); delete V3.rdSize; delete V3.rdSpp; return r; });
    t.eq('rendu : passes accumulées dans une image, scène affinée (herbe en brins, terre en grains, écorce, arbres détaillés), réglages herbe / granulométrie / qualité Extrême le temps du rendu, puis vue normale', rd, { done: true, ui: true, grass: true, tree: true, grain: true, bark: true, ctl: true, back: true, image: true });

    // réglages des matières : la hauteur de l'herbe et la granulométrie changent la taille des brins et des grains
    const mt = await ev(async () => { studio.q = 'haute'; const sz = {}; const keepB = build3DScene;
        const probe = async (k) => { V3.hq = { tree: 1, terr: 1, grass: 300000, earth: true, rc: (() => { const c = V3.camera.clone(); c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true); return c; })() }; try { build3DScene(); } finally { V3.hq = null; }
            let g = 0, gn = 0, e = 0, en = 0; const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); V3.root.traverse(o => { if (!o.isInstancedMesh) return; for (let i = 0; i < Math.min(o.count, 200); i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); if (o.userData.grass) { g += s.z; gn++; } if (o.userData.grain) { e += s.z; en++; } } }); sz[k] = [gn ? g / gn : 0, en ? e / en : 0]; };
        await studioOpen(); studio.grassH = 6; studio.gran = 'grav'; await probe('a'); studio.grassH = 30; studio.gran = 'blocs'; await probe('b'); studio.grassH = 12; studio.gran = 'grav'; build3DScene(); render3D(); studioClose();
        return { grass: sz.b[0] > sz.a[0] * 3, gran: sz.b[1] > sz.a[1] * 4 }; });
    t.eq('matières : hauteur de l\'herbe et granulométrie de la terre réglables', mt, { grass: true, gran: true });

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

    // carto : système de coordonnées Auto par défaut, zone CC selon la latitude du lieu
    const cr = await ev(() => ({ def: bmSettings.crs, gap: crsPrefP(44.56).code, paris: crsPrefP(48.85).code, nice: crsPrefP(43.7).code, l93: (bmSettings.crs = 'L93', crsPrefP(44.56).code), back: (bmSettings.crs = 'auto', 1),
        guess: [pdfGuessCrs([{ v: 1945000 }, { v: 3290000 }]), pdfGuessCrs([{ v: 945000 }, { v: 6390000 }])].join(',') }));
    t.eq('carto : système Auto par défaut (zone CC du lieu) ; un choix imposé reste respecté ; carroyage PDF deviné', cr, { def: 'auto', gap: 'CC45', paris: 'CC49', nice: 'CC44', l93: 'L93', back: 1, guess: 'CC44,L93' });
} };
