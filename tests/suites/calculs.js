// Cubatures et métré sur des cas simples, comparés à des volumes calculés à la main.
// Terrain plat à 100,00 m ; plateforme rectangulaire 20 × 10 m.
module.exports = { name: 'calculs', run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    // pose un terrain plat (points tous les 5 m) et une plateforme ; renvoie { D, Rm, items } en m³
    const cub = (o) => ev((o) => {
        shapes = []; const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264');
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const pl = { type: 'poly', layerId: 'layer-0', zk: 1, points: [[20, 15], [40, 15], [40, 25], [20, 25]].map(([x, y]) => ({ x: x * m, y: -y * m, z: o.z })) };
        if (o.talus) pl.talus = o.talus; if (o.rp) pl.cubRP = o.rp; if (o.struct) pl.struct = o.struct; shapes.push(pl); invalidateCache(); saveState();
        const C = withModel(() => cubCompute()); if (C.err) return { err: C.err };
        const it = C.items[0];
        return { D: +C.D.toFixed(3), Rm: +C.Rm.toFixed(3), RP: +(C.RP || 0).toFixed(3), plat: [+it.pr.deb.toFixed(3), +it.pr.rem.toFixed(3)], tal: it.tal ? [+it.tal.deb.toFixed(3), +it.tal.rem.toFixed(3)] : null,
            extra: it.extra.map(e => [e.lbl.split(' ')[0] + ' ' + (e.lbl.split(' ')[1] || ''), +e.deb.toFixed(3), +e.rem.toFixed(3), !!e.info]) };
    }, o);
    const pct = (got, want) => Math.abs(got - want) / want;

    // 1. déblai d'un mètre, sans talus : 20 × 10 × 1 = 200 m³
    let r = await cub({ z: 99000, talus: { on: false } });
    t.ok('déblai 1 m sans talus = 200 m³', !r.err && Math.abs(r.D - 200) < 0.5 && r.Rm < 0.01, JSON.stringify(r));
    // 2. remblai d'un mètre, sans talus : 200 m³
    r = await cub({ z: 101000, talus: { on: false } });
    t.ok('remblai 1 m sans talus = 200 m³', !r.err && Math.abs(r.Rm - 200) < 0.5 && r.D < 0.01, JSON.stringify(r));
    // 3. déblai d'un mètre, talus 1/1 : tronc de pyramide 20×10 → 22×12, V = h(ab + kh(a+b) + 4/3 k²h²) = 200 + 30 + 1,333 = 231,33 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' } });
    t.ok('déblai 1 m, talus 1/1 = 231,33 m³ (à 1 % près)', !r.err && pct(r.D, 231.333) < 0.01, JSON.stringify(r));
    // 4. remblai d'un mètre, talus 3/2 (k = 1,5) : 200 + 1,5 × 30 + 4/3 × 2,25 = 248 m³
    r = await cub({ z: 101000, talus: { on: true, kD: '1/1', kR: '3/2' } });
    t.ok('remblai 1 m, talus 3/2 = 248 m³ (à 1 % près)', !r.err && pct(r.Rm, 248) < 0.01, JSON.stringify(r));
    // 5. recul R = 1 m en déblai : fond 22 × 12 puis talus 1/1 → 264 + 34 + 1,333 = 299,33 m³ au total, dont 64 m³ de recul
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2', R: 1000 } });
    { const rec = (r.extra || []).find(e => e[0].startsWith('recul'));
      t.ok('recul 1 m : déblai total 299,33 m³ (à 1 % près)', !r.err && pct(r.D, 299.333) < 0.01, JSON.stringify(r));
      t.ok('recul 1 m : ligne « recul » de 64 m³', rec && Math.abs(rec[1] - 64) < 0.7, JSON.stringify(rec)); }
    // 5 bis. structure de 50 cm au fond de forme : 200 m³ de plateforme + 100 m³ de décaissement, montrés à part (ligne « dont structure », non additionnée)
    r = await cub({ z: 99000, talus: { on: false }, struct: { ff: true, layers: [{ mat: 'GNT_0_315', e: 50 }] } });
    { const ds = (r.extra || []).find(e => e[0].startsWith('dont'));
      t.ok('structure 50 cm : déblai 300 m³, dont 100 m³ de structure affichés à part', !r.err && Math.abs(r.D - 300) < 0.5 && ds && Math.abs(ds[1] - 100) < 0.5 && ds[3], JSON.stringify(r)); }
    // 5 ter. structure de 50 cm au fond de forme avec talus 1/1 : la fouille part du fond de forme, comme une fouille de 1,5 m → 1,5 × (200 + 1,5 × 30 + 4/3 × 2,25) = 372 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, struct: { ff: true, layers: [{ mat: 'GNT_0_315', e: 50 }] } });
    { const ds = (r.extra || []).find(e => e[0].startsWith('dont'));
      t.ok('structure 50 cm + talus 1/1 : talus pris depuis le fond de forme, 372 m³ (à 1 % près), dont 140,67 m³ de structure', !r.err && pct(r.D, 372) < 0.01 && ds && pct(ds[1], 372 - 231.333) < 0.02, JSON.stringify(r)); }
    // 5 quater. ligne de référence = cote du talus (avant structure) : terrassement à la cote Z, la structure est posée dessus → 200 m³ comme sans structure
    r = await cub({ z: 99000, talus: { on: false }, struct: { ff: false, layers: [{ mat: 'GNT_0_315', e: 50 }] } });
    t.ok('référence = cote du talus : terrassement à Z (200 m³), pas de ligne « dont structure »', !r.err && Math.abs(r.D - 200) < 0.5 && !(r.extra || []).some(e => e[0].startsWith('dont')), JSON.stringify(r));
    { const sv = await ev(() => { const m = mmToWorld(1000), pl = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [4, 0], [4, 4]].map(([x, y]) => ({ x: x * m, y: y * m, z: 68500 })) }; shapes = [pl]; selectedShapes = [pl];
        const a = structSVG({ ff: true, layers: [{ mat: 'BBSG', e: 6 }, { mat: 'GNT_0_315', e: 44 }] }), b = structSVG({ ff: false, layers: [{ mat: 'BBSG', e: 6 }, { mat: 'GNT_0_315', e: 44 }] }); shapes = []; selectedShapes = [];
        return { fini: /fini 68,50 m/.test(a) && /fond de forme 68,00 m/.test(a) && /Réf\. Z 68,50 m/.test(a), terr: /fini 69,00 m/.test(b) && /fond de forme 68,50 m/.test(b) }; });
      t.eq('coupe de structure : niveaux selon la ligne de référence', sv, { fini: true, terr: true }); }
    // terrain : une zone où les points sont plus espacés (au milieu d'un levé dense) ne fait pas de trou ; une encoche du contour (levé en L) reste vide
    { const th = await ev(() => { const m = mmToWorld(1000), N = []; for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const x = i * m, y = j * m; if (x > 14 * m && x < 26 * m && y > 14 * m && y < 26 * m) continue; if (x > 30 * m && y > 30 * m) continue; N.push({ x, y, z: 100000 + i * 10 }); }
        const T = buildTIN(N); return { hole: tinZ(20 * m, 20 * m, T) !== undefined, notch: tinZ(36 * m, 36 * m, T) === undefined }; });
      t.eq('terrain : pas de trou là où les points sont espacés, encoche du contour respectée', th, { hole: true, notch: true }); }
    // bâtiment existant : ses cotes (toit dedans, égout juste au-dehors) sortent du terrain, le seuil au ras de la façade reste ; bloc posé sur le terrain jusqu'à la cote la plus haute ; DXF aller-retour ; « ce n'est pas un bâtiment » rend les cotes au terrain
    { const bt = await ev(async () => { const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264'); shapes = [];
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i) === 3 || Math.abs(j) === 3) shapes.push({ type: 'point', layerId: TN, x: i * 5 * m, y: j * 5 * m, z: 100000, zk: 1 });
        shapes.push({ type: 'point', layerId: TN, x: 0, y: 0, z: 108000, zk: 1 }, { type: 'point', layerId: TN, x: 2 * m, y: 1 * m, z: 106500, zk: 1 }, { type: 'point', layerId: TN, x: 5.5 * m, y: 0, z: 105500, zk: 1 }, { type: 'point', layerId: TN, x: 0, y: -5.3 * m, z: 100150, zk: 1 });
        const P = { type: 'poly', layerId: 'layer-0', points: [[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([x, y]) => ({ x: x * m, y: y * m })), open: false }; shapes.push(P); invalidateCache(); saveState();
        const spike = Math.round(tinZ(0, 0)); selectedShapes = [P]; batFromSel(); const B = shapes.find(x => x.batEx);
        const r = { spike: spike > 105000, ground: Math.abs(tinZ(0, 0) - 100000) < 200, seuil: tinNodes().some(n => n.z === 100150), eaves: tinNodes().some(n => n.z === 105500), base: Math.abs(B.points[0].z - 100000) < 200, top: B.points[0].z + B.solid.H, kind: B.solid.kind, name: B.name, plat: isPlateforme(B) };
        selectedShapes = [B]; openSelectionParamModal(); document.getElementById('sp-battop').value = '110,00'; applySelectionLayer(); r.edit = B.points[0].z + B.solid.H;
        await open3D(); await new Promise(q => setTimeout(q, 600)); let mesh = 0; V3.root.traverse(o => { if (o.isMesh) mesh++; }); close3D(); r.d3 = mesh > 0;
        const dxf = exportDXF(); await loadFileObject(new File([dxf], 'bat.dxf'), 'bat.dxf'); await new Promise(q => setTimeout(q, 500)); const B2 = shapes.find(x => x.batEx);
        r.dxf = B2 ? [B2.solid && B2.solid.kind, Math.round((B2.points[0].z + B2.solid.H) / 10) * 10, Math.abs(tinZ(0, 0) - 100000) < 200] : null;
        if (B2) { selectedShapes = [B2]; batUnset(B2); } r.unset = Math.round(tinZ(0, 0)) > 105000;
        const P3 = shapes.find(x => x.type === 'poly'); setMode('pline'); batDraw = true; r.pick = batPick(1 * m, 1 * m) && !!P3.batEx && Math.abs(tinZ(0, 0) - 100000) < 200; setMode('select-box'); shapes = []; selectedShapes = []; invalidateCache(); saveState(); return r; });
      t.eq('bâtiment existant : cotes du toit et de l\'égout hors terrain, seuil gardé, bloc 3D jusqu\'à la cote la plus haute (modifiable), DXF, retrait', bt,
        { spike: true, ground: true, seuil: true, eaves: false, base: true, top: 108000, kind: 'box', name: 'Bâtiment existant', plat: false, edit: 110000, d3: true, dxf: ['box', 110000, true], unset: true, pick: true }); }
    // plateforme inclinée au-dessus de 1000 m : les Z se relisent juste (avant : « 1 136,50 » relu 1 → les cotes repassaient à 1)
    { const pi = await ev(() => { const m = mmToWorld(1000), P = { type: 'poly', layerId: 'layer-0', points: [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => ({ x: x * m, y: -y * m })), open: false }; shapes = [P]; saveState(); selectedShapes = [P]; openSelectionParamModal();
        document.querySelector('input[name=sp-pmode][value=incl]').click(); spPlatMode(); document.getElementById('sp-z0').value = '1136,5'; document.getElementById('sp-pct').value = '2'; spFillSlope(); applySelectionLayer(); const z1 = P.points.map(q => q.z);
        selectedShapes = [P]; openSelectionParamModal(); const f = P.points.map((q, i) => document.getElementById('sp-vz-' + i).value); applySelectionLayer(); const r = { z1, f, z2: P.points.map(q => q.z), lbl: fmtZ(1136500) }; shapes = []; selectedShapes = []; saveState(); return r; });
      t.eq('plateforme inclinée à plus de 1000 m : Z gardés à la réouverture', pi, { z1: [1136500, 1136100, 1136100, 1136500], f: ['1136,50', '1136,10', '1136,10', '1136,50'], z2: [1136500, 1136100, 1136100, 1136500], lbl: '1136,50' }); }
    // ligne de rupture tracée à la main : sommets sur deux points cotés (100,00 et 102,00 à 10 m), Z interpolé, un sommet par mètre ; même chose depuis une polyligne existante (Y)
    { const lr = await ev(() => { const m = mmToWorld(1000), TN = ensureLayer('Terrain naturel', '#bef264'); shapes = [{ type: 'point', layerId: TN, x: 0, y: 0, z: 100000, zk: 1 }, { type: 'point', layerId: TN, x: 10 * m, y: 0, z: 102000, zk: 1 }, { type: 'point', layerId: TN, x: 5 * m, y: 8 * m, z: 101000, zk: 1 }]; invalidateCache(); saveState();
        setMode('pline'); brkDraw = true; isDrawing = true; currentPolygon = [{ x: 0, y: 0 }, { x: 10 * m, y: 0 }]; finishPline(); setMode('select-box');
        const L = shapes.find(x => x.name === 'Ligne de rupture'), mid = L && L.points.find(q => Math.abs(q.x - 5 * m) < 1e-6);
        const pl = { type: 'poly', layerId: 'layer-0', open: true, points: [{ x: 0, y: 0 }, { x: 10 * m, y: 0 }] }; shapes.push(pl); selectedShapes = [pl]; brkFromSel();
        const r = { n: L ? L.points.length : 0, mid: mid ? mid.z : null, lay: L ? (layers.find(l => l.id === L.layerId) || {}).name : '', y: pl.points.length, ymid: (pl.points.find(q => Math.abs(q.x - 5 * m) < 1e-6) || {}).z }; shapes = []; selectedShapes = []; saveState(); return r; });
      t.eq('ligne de rupture : Z interpolé entre les points cotés, un sommet par mètre (outil LR et depuis Y)', lr, { n: 11, mid: 101000, lay: 'Lignes de rupture', y: 11, ymid: 101000 }); }
    // 6. remblai périphérique jusqu'à 99,50 (talus 1/1, sans recul) : terrain fini = 99,50 au bord puis talus fini 1/1 parallèle à la fouille jusqu'au terrain (100)
    //    épaisseur f(d) = min(0,5 ; 1 − d) sur la largeur du talus (1 m), contour arrondi aux angles (60 + 2πd) :
    //    V = 60 × 0,375 + 2π × (0,0625 + 0,0833) = 22,5 + 0,916 = 23,42 m³ (avant : le dessus restait plat à 99,50 → 7,67 m³, le haut du talus restait ouvert)
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, z: 99500 } });
    { const rp = (r.extra || []).filter(e => e[0].startsWith('remblai') && !e[3]).reduce((a, e) => a + e[2], 0);
      t.ok('remblai périphérique jusqu\'à 99,50 avec talus fini jusqu\'au terrain = 23,42 m³ (à 2 % près)', pct(rp, 23.416) < 0.02, rp.toFixed(3) + ' — ' + JSON.stringify(r.extra));
      t.ok('récapitulatif : remblai périphérique compté à part', Math.abs(r.RP - rp) < 0.01, JSON.stringify(r));
      const cards = await ev(async () => { openCubatureDialog(); cubGo(2); await new Promise(r => setTimeout(r, 600)); const L = [...document.querySelectorAll('#cb-res > div:first-child > div > div:first-child')].map(d => d.textContent); closeTopoModal && closeTopoModal(); return L; }).catch(e => ['err ' + e.message]);
      t.ok('récapitulatif : cases Remblai et Remblai périphérique', cards.includes('Remblai') && cards.includes('Remblai périphérique'), JSON.stringify(cards)); }
      // en 3D : le remblai périphérique se montre en volume, son dessus au niveau fini (99,50)
      const rp3 = await ev(async () => { await open3D(); await new Promise(r => setTimeout(r, 900)); document.querySelector('[data-for="v3-rp"]').click(); await new Promise(r => setTimeout(r, 400));
          let top = null, n = 0; V3.root.traverse(o => { if (o.userData.rp) { n++; const a = o.geometry.attributes.position.array; let mx = -1e9; for (let i = 2; i < a.length; i += 3) mx = Math.max(mx, a[i]); top = mx / V3.exag + V3.zmin; } });
          document.querySelector('[data-for="v3-rp"]').click();
          const cnt = () => { let k = 0; V3.root.traverse(o => { if (o.isPoints) k++; }); return k; }, on = cnt(); document.querySelector('[data-for="v3-lab"]').click(); await new Promise(r => setTimeout(r, 300)); const off = cnt(); document.querySelector('[data-for="v3-lab"]').click();
          const m = mmToWorld(1000), c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); basemapStore['t-drape'] = c.toDataURL(); bmImg('t-drape'); await new Promise(r => setTimeout(r, 200));
          shapes.unshift({ type: 'basemap', layerId: 'layer-0', x: 30 * m, y: -20 * m, r: 20 * m, mapId: 't-drape' }); build3DScene();
          const dr = () => { let k = 0, flat = 0; V3.root.traverse(o => { if (o.userData.drape) k++; else if (o.isMesh && o.geometry.type === 'CircleGeometry') flat++; }); return [k, flat]; }, d1 = dr();
          document.querySelector('[data-for="v3-bg"]').click(); const d0 = dr(); document.querySelector('[data-for="v3-bg"]').click(); shapes.shift();
          close3D(); return { n, top, pts: [on, off], drape: [d1, d0] }; });
      t.ok('3D : fond de carte drapé sur le terrain (pas d\'image à plat), masqué avec son bouton', rp3.drape[0][0] === 1 && rp3.drape[0][1] === 0 && rp3.drape[1][0] === 0 && rp3.drape[1][1] === 0, JSON.stringify(rp3.drape));
      // vue iso / façade du plan : le maillage du terrain reste dessiné autour des plateformes (hors plateforme et talus)
      const wire = await ev(() => { build3DScene(); let n = 0; const ox = V3.root.position.x, oy = V3.root.position.y;
          V3.root.traverse(o => { if (!o.isLineSegments) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 6) { const x = (a[i] + a[i + 3]) / 2, y = (a[i + 1] + a[i + 4]) / 2;
              if (x > 12 && x < 48 && y > 8 && y < 32 && !(x > 19 && x < 41 && y > 14 && y < 26)) n++; } }); build3DScene(); return n; });
      t.ok('vue iso du plan : maillage du terrain présent autour de la plateforme', wire > 20, wire);
      t.ok('3D : cotes de niveau masquées → points et fils masqués aussi', rp3.pts[0] > 0 && rp3.pts[1] === 0, JSON.stringify(rp3.pts));
      t.ok('3D : remblai périphérique affiché, talus fini jusqu\'au terrain (dessus à 100,00)', rp3.n === 1 && Math.abs(rp3.top - 100) < 0.01, JSON.stringify(rp3));

    // 7. remblai périphérique AU TERRAIN NATUREL : la fouille est rebouchée jusqu'au terrain = volume du talus de déblai (1 m, 1/1) = 60 × 0,5 + 4/3 = 31,33 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, mode: 'tn' } });
    t.ok('remblai périphérique jusqu\'au terrain naturel = 31,33 m³ (à 2 % près)', pct(r.RP, 31.333) < 0.02, JSON.stringify(r));
    // 8. cote finie AU-DESSUS du terrain (100,50 pour un terrain à 100) : fouille remplie jusqu'à 100,50 puis talus 1/1 jusqu'au terrain
    //    fouille : 31,33 + 0,5 × (60 + π) = 62,90 ; talus : 0,125 × (60 + 2π) + 2π × 0,5³ / 6 = 8,42 ; total 71,3 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, z: 100500 } });
    { const ext = (r.extra || []).find(e => /talus/.test(e[0] + '') && e[0].startsWith('remblai')); 
      t.ok('cote finie au-dessus du terrain : talus 1/1 du remblai jusqu\'au terrain, total ≈ 71,3 m³ (à 3 % près)', pct(r.RP, 71.32) < 0.03, JSON.stringify(r)); }

    // 8b. fouille avec recul de 1,20 m et talus 3/2, niveau fini 0,5 m au-dessus du terrassement (cas d'un bâtiment : terrassement 99,00, fini 99,50) :
    //     épaisseur constante de 0,5 m sur le recul et sur le talus, puis biseau là où le talus fini rejoint le terrain
    //     recul : (60 × 1,2 + π × 1,2²) × 0,5 = 38,26 ; talus (d de 0 à 1,5, f = min(0,5 ; 1 − d/1,5)), périmètre 60 + 2π(1,2 + d) : 60 × 0,5625 + 2π × 1,003 = 40,05 → ≈ 78,3 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '3/2', kR: '3/2', R: 1200 }, rp: { on: true, z: 99500 } });
    t.ok('recul 1,20 + talus 3/2 : remblai périphérique d\'épaisseur constante sur recul et talus ≈ 78,3 m³ (à 3 % près)', pct(r.RP, 78.3) < 0.03, JSON.stringify(r));
    // 8c. plateforme en remblai (101,00 sur un terrain à 100) et niveau fini 101,50 : couche de 0,5 m sur le talus de remblai 3/2 (largeur 1,5 m), puis talus 1/1 jusqu'au terrain
    //     talus : (60 × 1,5 + π × 1,5²) × 0,5 = 48,53 ; au-delà : biseau de 0,5 m de large ≈ 0,125 × (60 + 2π × 1,75) = 8,87 → ≈ 57,4 m³
    r = await cub({ z: 101000, talus: { on: true, kD: '1/1', kR: '3/2' }, rp: { on: true, z: 101500 } });
    t.ok('plateforme en remblai : couche de remblai périphérique sur son talus de remblai ≈ 57,4 m³ (à 4 % près)', pct(r.RP, 57.4) < 0.04, JSON.stringify(r));

    // 9. structure de 40 cm et recul de 1 m : la structure s'étend sur le recul → recul terrassé au fond de forme : 64 m² × (1 + 0,4) = 89,6 m³
    r = await cub({ z: 99000, talus: { on: true, kD: '1/1', kR: '3/2', R: 1000 }, struct: { layers: [{ mat: 'GNT_0_80', e: 40 }], ff: true } });
    { const rec = (r.extra || []).find(e => e[0].startsWith('recul'));
      t.ok('structure étendue au recul : recul terrassé au fond de forme (89,6 m³)', rec && Math.abs(rec[1] - 89.6) < 1.2, JSON.stringify(rec)); }

    // métré : longueur d'une droite et d'une polyligne, surface d'un rectangle
    await ev(() => { shapes = []; const m = mmToWorld(1000);
        shapes.push({ type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 12.5 * m, y2: 0 });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: true, points: [{ x: 0, y: -5 * m }, { x: 3 * m, y: -5 * m }, { x: 3 * m, y: -9 * m }] });
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [[20, 0], [26, 0], [26, 4], [20, 4]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        invalidateCache(); saveState(); });
    const md = await ev(() => { const d = metreData(); return JSON.stringify(d, (k, v) => typeof v === 'number' ? +v.toFixed(3) : (v && v.type ? undefined : v)).slice(0, 1500); });
    t.ok('métré : 39,5 m de linéaire (12,5 + 7 + périmètre 20)', /"lin":39\.5\b/.test(md), md.slice(0, 400));
    t.ok('métré : surface fermée de 24 m²', /"ferm":24\b/.test(md), md.slice(0, 400));
    // calque masqué : ses points comptent toujours dans le terrain (les talus restent) ; ⛰ du gestionnaire de calques l'en exclut
    const tv = await ev(() => { const keepS = shapes; shapes = []; const m = mmToWorld(1000), L = ensureLayer('TN test', '#86efac');
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) shapes.push({ type: 'point', layerId: L, x: i * 5 * m, y: -j * 5 * m, z: 100000, zk: 1 });
        const lay = layers.find(l => l.id === L), n = () => { tinCache = null; return tinNodes().length; }, a = n(); lay.visible = false; const b = n(); toggleLayerTin(L); const c = n(); toggleLayerTin(L); lay.visible = true; shapes = keepS; invalidateCache(); return [a, b, c]; });
    t.eq('terrain : un calque masqué compte toujours, ⛰ l\'exclut', tv, [25, 25, 0]);

    // maillage : des lignes de rupture découpées tous les 25 cm au milieu d'un semis à 10 m ne doivent pas faire ronger le terrain depuis le bord (trous en 3D)
    const tn = await ev(() => { const m = mmToWorld(1000), N = []; for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) N.push({ x: (i * 10 + (j % 2) * 0.7) * m, y: -(j * 10 + (i % 3) * 0.4) * m, z: 100000 + i * 100 });
        [25, 50, 75].forEach(y0 => { for (let k = 0; k <= 240; k++) { N.push({ x: (15 + k * 0.25) * m, y: -(y0 + k * 0.05) * m, z: 101000 }); N.push({ x: (15 + k * 0.25) * m, y: -(y0 + 1 + k * 0.05) * m, z: 100500 }); } });
        const T = delaunay(N); let A = 0; T.forEach(t => { const [a, b, c] = t.map(i => N[i]); A += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2; }); return Math.round(A / (m * m) / 100); });
    t.ok('maillage avec lignes de rupture denses : le terrain couvre tout le levé (≥ 95 %)', tn >= 95, tn + ' %');

    // volet Y en direct : un réglage s'applique tout de suite (volet ouvert), Annuler revient en arrière, Valider garde en une seule étape ; schémas avec les cases dessus
    const lv = await ev(async () => { const keepS = shapes; shapes = []; const m = mmToWorld(1000); [[0, 0], [30, 0], [30, 30], [0, 30], [15, 15]].forEach(([x, y]) => shapes.push({ type: 'point', layerId: 'layer-0', x: x * m, y: -y * m, z: 100000 }));
        const B = { type: 'poly', layerId: 'layer-0', open: false, points: [[10, 10], [18, 10], [18, 16], [10, 16]].map(([x, y]) => ({ x: x * m, y: -y * m })) }; shapes.push(B); batMake(B); B.solid.H = 5000; B.batTop = (B.points[0].z || 0) + 5000; saveState();
        const h0 = historyStep, H0 = B.solid.H, wait = (t) => new Promise(r => setTimeout(r, t)), set = (v) => { const i = document.getElementById('sp-battop'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
        selectedShapes = [B]; openSelectionParamModal(); await wait(80); const dia = !!document.querySelector('#selparam-modal .sp-dia #sp-battop') && !!document.querySelector('#sp-thumb svg path');
        set('108'); await wait(700); const B1 = shapes.find(x => x.batEx), live = B1.solid.H === 8000 && !document.getElementById('selparam-modal').classList.contains('hidden'), steps = historyStep - h0;
        spCancel(); const B2 = shapes.find(x => x.batEx), back = B2.solid.H === H0 && historyStep === h0;
        selectedShapes = [B2]; openSelectionParamModal(); await wait(50); set('109'); await wait(700); applySelectionLayer(); spLiveCommit(); const B3 = shapes.find(x => x.batEx), kept = B3.solid.H === 9000 && historyStep === h0 + 1;
        shapes = keepS; selectedShapes = []; invalidateCache(); saveState(); return { dia, live, steps, back, kept }; });
    t.eq('volet Y : aperçu en direct, Annuler revient en arrière, Valider garde (une étape) ; schéma avec ses cases', lv, { dia: true, live: true, steps: 1, back: true, kept: true });
    // test d'écoulement : une cuvette garde l'eau (flaque trouvée), la pente l'évacue par le bord ; volumes conservés
    const ec = await ev(() => { const keepS = shapes; shapes = []; const m = mmToWorld(1000);
        for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) { const x = i * 2, y = j * 2, r = Math.hypot(x - 20, y - 20), z = 100 + x * 0.02 - (r < 6 ? (6 - r) * 0.08 : 0); shapes.push({ type: 'point', layerId: 'layer-0', x: x * m, y: -y * m, z: Math.round(z * 1000) }); }
        tinCache = null; invalidateCache(); const E = ecGrid(4000), R0 = E.ret.length, cap = R0 ? E.ret[0].cap : 0; Object.keys(E.inf).forEach(k => { E.inf[k] = 0; }); ecRates(E);
        const Z = ecRun(E, 60, 15, 30); let held = 0; for (let k = 0; k < E.n; k++) held += E.d[k] * E.c * E.c; const ci = E.x0 + Z[0].ci * E.c * E.m, cj = E.y0 + Z[0].cj * E.c * E.m;
        const E2 = ecGrid(4000); Object.keys(E2.inf).forEach(k => { E2.inf[k] = 30; }); ecRates(E2); ecRun(E2, 60, 15, 30);
        const r = { n: R0 >= 1 && cap > 1, center: Math.hypot(ci / m - 20, -cj / m - 20) < 3, out: E.out > 0.5 * E.rainV, cons: Math.abs(E.rainV - E.out - held - E.infV) / E.rainV < 0.02, filled: Z[0].pct > 0.1 && Z[0].pct <= 1, sand: E2.infV > 0.3 * E2.rainV && E2.out < E.out };
        shapes = keepS; tinCache = null; invalidateCache(); return r; });
    t.eq('test d\'écoulement : rétention (cuvette) trouvée sur le relief et remplie par la pluie, la pente s\'évacue par le bord, infiltration selon le sol, volumes conservés', ec, { n: true, center: true, out: true, cons: true, filled: true, sand: true });

    // pluie réelle du site : archives horaires lues au point du plan (géoréférencé), épisodes classés par pointe, rejoués heure par heure
    const rr = await ev(async () => { const keepS = shapes, keepO = geoOrigin, keepF = window.fetch; shapes = []; geoOrigin = { x: 900000000, y: 6300000000 }; const m = mmToWorld(1000);
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 3 * m, y: -j * 3 * m, z: 100000 + i * 60 });
        tinCache = null; invalidateCache(); let url = ''; const N = 24 * 30, time = [], pr = []; for (let h = 0; h < N; h++) { time.push(new Date(Date.UTC(2023, 9, 1, h)).toISOString().slice(0, 16)); pr.push(0); }
        [[100, [2, 8, 30, 12, 3]], [400, [1, 2, 3, 2]]].forEach(([h0, L]) => L.forEach((v, k) => { pr[h0 + k] = v; }));
        window.fetch = async (u) => { url = String(u); return { ok: true, json: async () => ({ hourly: { time, precipitation: pr } }) }; };
        try { ecOpen(); await new Promise(r => setTimeout(r, 50)); document.querySelector('#ec-wiz [data-a=real]').click(); await new Promise(r => setTimeout(r, 100));
            const rows = document.querySelectorAll('#ec-real .piw-row').length, first = EC.storms[0]; document.querySelector('#ec-real .piw-row[data-i="0"]').click();
            const E = EC; Object.keys(E.inf).forEach(k => { E.inf[k] = 0; }); ecRates(E); ecRun(E, undefined, undefined, 5); const A = E.c * E.c; let cells = 0; for (let k = 0; k < E.n; k++) if (!isNaN(E.z[k])) cells++;
            const exp = 55 / 1000 * cells * A, r = { url: /latitude=4[0-9]\.\d+&longitude=[0-9-]+\.\d+.*hourly=precipitation/.test(url), rows, peak: first.peak, tot: first.tot, h: first.h, rain: Math.abs(E.rainV - exp) / exp < 0.03 }; ecClose(); return r; }
        finally { window.fetch = keepF; shapes = keepS; geoOrigin = keepO; tinCache = null; invalidateCache(); } });
    t.eq('pluie réelle du site : archives lues au point du plan, orages classés, épisode rejoué heure par heure', rr, { url: true, rows: 2, peak: 30, tot: 55, h: 5, rain: true });

    // test d'écoulement : la maison dessinée (toiture, murs) est dans le relief — l'eau ruisselle sur le toit et la contourne
    const eh = await ev(async () => { await loadThree(); const keepS = shapes; shapes = []; const m = mmToWorld(1000), R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x * m, y: -y * m }));
        for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) shapes.push({ type: 'point', layerId: 'layer-0', x: i * 3 * m, y: -j * 3 * m, z: 100000 });
        shapes.push(...buildRoof({ type: 'poly', layerId: 'layer-0', points: R(12, 12, 24, 22).map(q => Object.assign(q, { z: 102500 })) }, { pans: 2, he: 102.5, hf: 104.5, e: 0.25, ge: 0.2, fill: false, db: 0, dir: 'long' }));
        tinCache = null; invalidateCache(); const E = ecGrid(3000), at = (x, y) => { const i = Math.round((x * m - E.x0) / (E.c * m)), j = Math.round((-y * m - E.y0) / (E.c * m)); return j * E.nx + i; }, k = at(18, 17), k2 = at(4, 4);
        const r = { roof: E.roof[k] === 1 && E.surf[k] === 4, high: E.z[k] > 102.4, ground: !E.roof[k2] && Math.abs(E.z[k2] - 100) < 0.01 }; shapes = keepS; tinCache = null; invalidateCache(); return r; });
    t.eq('test d\'écoulement : la toiture dessinée est dans le relief (toit, étanche), le terrain autour inchangé', eh, { roof: true, high: true, ground: true });
} };
