// Sorties : impression rapide (PDF et image), planche de présentation en PDF, métré en PDF. Chaque fichier doit sortir, non vide.
module.exports = { name: 'sorties', timeout: 240, run: async (H, t) => {
    const { p, ev } = H;
    await H.blank(14);
    await ev(() => { const m = mmToWorld(1000);
        shapes.push({ type: 'poly', layerId: 'layer-0', open: false, points: [[0, 0], [30, 0], [30, 20], [0, 20]].map(([x, y]) => ({ x: x * m, y: -y * m })) });
        shapes.push({ type: 'circle', layerId: 'layer-0', x: 15 * m, y: -10 * m, r: 3 * m });
        shapes.push(makeDim({ x: 0, y: 0 }, { x: 30 * m, y: 0 }, { x: 15 * m, y: 3 * m }, 'h'));
        shapes.push({ type: 'text', layerId: 'layer-0', x: 2 * m, y: -18 * m, content: 'Essai de sortie', size: 20 });
        cartoucheData.planName = 'Plan d\'essai'; cartoucheData.indice = 'A'; saveState(); invalidateCache(); draw(); });
    // attend un téléchargement déclenché par fn ; renvoie { name, size } ou null
    const dl = async (label, fn, re) => {
        try { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), fn()]); const f = await d.path(); const size = require('fs').statSync(f).size;
            t.ok(label + ' (' + d.suggestedFilename() + ', ' + Math.round(size / 1024) + ' Ko)', re.test(d.suggestedFilename()) && size > 3000);
            if (/\.png$/.test(d.suggestedFilename())) require('fs').copyFileSync(f, require('../lib/harness').OUT + '/sortie-impression.png');
            return { name: d.suggestedFilename(), size }; }
        catch (e) { t.ok(label, false, e.message.split('\n')[0]); return null; } };

    // impression rapide en PDF (A3 paysage, cartouche)
    await ev(() => { printSettings.paper = 'A3'; printSettings.output = 'pdf'; printSettings.cartouche = true; printOrientation = printSettings.orientation = 'landscape'; setMode('print'); });
    await H.wait(400);
    const C = await ev(() => { const m = mmToWorld(1000), q = worldToScreen(15 * m, -10 * m); return { x: q.x, y: q.y }; });   // feuille centrée sur le dessin
    await dl('impression rapide en PDF', () => ev(c => performPrint(c.x, c.y), C), /\.pdf$/);
    // même chose en image
    await ev(() => { printSettings.output = 'png'; setMode('print'); }); await H.wait(300);
    await dl('impression rapide en image PNG', () => ev(c => performPrint(c.x, c.y), C), /\.png$/);
    await ev(() => setMode('select-box'));

    // présentation : une fenêtre sur la planche, puis le PDF de la feuille
    await ev(() => { if (!layoutOn) toggleLayout(true); }); await H.wait(600);
    const R = await ev(() => { const r = canvas.getBoundingClientRect(); return { a: { x: r.left + r.width * 0.25, y: r.top + r.height * 0.3 }, b: { x: r.left + r.width * 0.6, y: r.top + r.height * 0.7 } }; });
    await H.tool('btn-lpvp'); await H.click(R.a); await H.click(R.b); await H.press('Escape');
    t.ok('présentation : une fenêtre posée sur la planche', await ev(() => (layoutData.vps || []).length >= 1), await ev(() => JSON.stringify((layoutData.vps || []).map(v => [v.kind || 'plan', v.scale]))));
    await H.shot('sortie-planche');
    await dl('présentation : PDF de la feuille', () => ev(() => lpPrintPDF()), /\.pdf$/);
    // réglage « plateformes » d'une fenêtre : points cotés sous la plateforme masqués, cote de la plateforme écrite au milieu
    const pfv = await ev(() => { const v = layoutData.vps[0], S = lpModelStore.shapes, m = mmToWorld(1000), pl = { type: 'poly', layerId: 'layer-0', zk: 1, points: [[0, 0], [8, 0], [8, -6], [0, -6]].map(([x, y]) => ({ x: x * m, y: y * m, z: 99000 })) };
        const pin = { type: 'point', layerId: 'layer-0', x: 4 * m, y: -3 * m, z: 98000, zk: 1 }, pout = { type: 'point', layerId: 'layer-0', x: 20 * m, y: -3 * m, z: 98500, zk: 1 }; S.push(pl, pin, pout);
        const run = (flag) => { v.plat = flag; const drawn = []; const o = window.drawSingleShape, oa = window.drawAnnotations; let lab = []; window.drawSingleShape = function (c, s, ...a) { if (s.type === 'point') drawn.push(s); return o.call(this, c, s, ...a); }; window.drawAnnotations = function (...a) { lab = dimensionTextsToDraw.map(d => d.text); return oa.apply(this, a); };
            const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; try { lpRenderVp(cv.getContext('2d'), v, 1, 0, 0, 800, 600); } finally { window.drawSingleShape = o; window.drawAnnotations = oa; } return { pin: drawn.includes(pin), pout: drawn.includes(pout), lab: lab.some(t => /^PF\d+ · 99,00 m$/.test(t)) }; };
        const r = { on: run(true), off: run(false) }; S.splice(S.indexOf(pl), 3); v.plat = false; return r; });
    t.eq('présentation : réglage plateformes (points sous la plateforme masqués, cote écrite)', pfv, { on: { pin: false, pout: true, lab: true }, off: { pin: true, pout: true, lab: false } });
    // fenêtre en vue 3D, pilotée à la souris sur la feuille : glisser = tourner, Maj + glisser = déplacer, molette = zoom, Échap = figer
    const v3a = await ev(async () => { const v = layoutData.vps[layoutData.vps.length - 1]; await lp3DSnap(v); await lp3DEnter(v); const r = lpRect(v), c = canvas.getBoundingClientRect();
        return { ok: !!(v.v3 && v.v3.img), active: lp3D.id === v.id, az: v.v3.az, dist: v.v3.dist, tx: v.v3.tx, img: v.v3.img.length, cx: c.left + r.x + r.w / 2, cy: c.top + r.y + r.h / 2 }; });
    await H.p.mouse.move(v3a.cx, v3a.cy); await H.p.mouse.down(); for (let i = 1; i <= 6; i++) await H.p.mouse.move(v3a.cx + i * 15, v3a.cy + i * 4); await H.p.mouse.up(); await H.wait(200);
    await H.p.keyboard.down('Shift'); await H.p.mouse.down(); await H.p.mouse.move(v3a.cx + 40, v3a.cy + 10); await H.p.mouse.move(v3a.cx, v3a.cy); await H.p.mouse.up(); await H.p.keyboard.up('Shift');
    await H.p.mouse.wheel(0, -300); await H.wait(500);
    const v3b = await ev(() => { const v = layoutData.vps[layoutData.vps.length - 1]; return { az: v.v3.az, dist: v.v3.dist, tx: v.v3.tx, img: v.v3.img.length }; });
    await H.press('Escape'); const v3c = await ev(() => lp3D.id);
    t.ok('présentation : fenêtre 3D pilotée à la souris (tourne, se déplace, zoome, Échap la fige)', v3a.ok && v3a.active && Math.abs(v3b.az - v3a.az) > 0.3 && v3b.tx !== v3a.tx && v3b.dist < v3a.dist && v3c === null, JSON.stringify([v3a, v3b, v3c]));
    await ev(() => { if (layoutOn) toggleLayout(false); });

    // métré en PDF
    await dl('métré en PDF', () => ev(() => metrePDF()), /\.pdf$/);

    // fiche « Démarrer en 10 minutes » : 1er onglet du guide, imprimable en A4 (sans boutons)
    const qs = await ev(() => new Promise(res => { openHelpModal(); helpChapter('go'); const sec = document.querySelector('#help-modal .hg-ch[data-ch=go]'); const n = sec.querySelectorAll(':scope > .hg-list:first-of-type > li').length;
        const first = document.querySelector('#help-modal .hg-tab').dataset.ch; hgPrintQuick(); const f = document.getElementById('hg-print-frame'); try { f.contentWindow.print = () => {}; } catch (e) {}
        setTimeout(() => { const d = f.contentDocument; res({ n, first, title: d.title, steps: d.querySelectorAll('.hg-list > li').length, btn: d.querySelectorAll('button').length }); f.remove(); closeHelpModal && closeHelpModal(); }, 50); }));
    t.eq('guide : fiche « Démarrer en 10 minutes » en 1er onglet, imprimable', qs, { n: 10, first: 'go', title: 'MomoCAD — Démarrer en 10 minutes', steps: 11, btn: 0 });

    // cartouche A4 en mise en page : le volet de devant du plan plié moins la marge → ses bords gauche et haut tombent sur les plis
    const ca = await ev(() => { const keep = [cartoucheData.type, layoutData.paper, layoutData.orient, layoutData.margin, layoutData.cartouche]; cartoucheData.type = 'a4'; Object.assign(layoutData, { paper: 'A1', orient: 'landscape', margin: 10, cartouche: true });
        const P = lpPage(), cd = cartDims(P.W, P.H, P.m), F = lpFolds(P), x0 = P.W - P.m - cd.w, y0 = P.H - P.m - cd.h; let calls = 0; const c = document.createElement('canvas').getContext('2d'); const sr = c.strokeRect.bind(c); let rect = null; c.strokeRect = (x, y, w, h) => { if (!rect) rect = [x, y, w, h]; return sr(x, y, w, h); };
        drawCartA4(c, 0, 0, 1, cartInfo('1:200', 'A1'), cd.w, cd.h);
        const r = { w: cd.w, h: cd.h, foldX: F.xs.includes(x0), foldY: F.ys.includes(y0), drawn: rect.map(v => Math.round(v)) };
        [cartoucheData.type, layoutData.paper, layoutData.orient, layoutData.margin, layoutData.cartouche] = keep; return r; });
    t.eq('cartouche A4 = volet plié moins la marge, calé sur les plis', ca, { w: 200, h: 287, foldX: true, foldY: true, drawn: [0, 0, 200, 287] });

    // impression normée : PDF de la feuille en vectoriel (traits, textes), épaisseur 1 = 0,25 mm sur le papier, noir et blanc ; et toujours possible en image
    const pv = await ev(() => { const keepS = shapes, keepL = layoutData; const m = mmToWorld(1000), EU = ensureLayer('EU', '#38bdf8');
        shapes = [{ type: 'line', layerId: EU, x1: 0, y1: 0, x2: 40 * m, y2: 0 }, { type: 'text', layerId: 'layer-0', x: 2 * m, y: 5 * m, content: 'Regard R1', size: mmToWorld(1500), angle: 0 }, { type: 'circle', layerId: EU, x: 20 * m, y: 10 * m, r: 3 * m }];
        layers.find(l => l.id === EU).width = 1; layoutData = lpNew(); Object.assign(layoutData, { paper: 'A3', orient: 'landscape', margin: 10, cartouche: false }); layoutData.vps.push({ id: 'v1', x: 20, y: 20, w: 250, h: 180, scale: 200, cx: 20 * m, cy: 5 * m });
        const raw = (o) => { const d = lpBuildPDF(Object.assign({ compress: false }, o)); return d.output(); }, V = raw({ vec: true, bw: false }), B = raw({ vec: true, bw: true }), I = raw({ vec: false });
        const r = { text: /Regard R1/.test(V), curves: / c\n/.test(V), pen: /0\.708\d* w/.test(V), blue: /0\.22 0\.74 0\.97 RG/.test(V), bwBlue: /0\.22 0\.74 0\.97 RG/.test(B), img: /\/Subtype \/Image/.test(I), noImgV: !/\/Subtype \/Image/.test(V) };
        shapes = keepS; layoutData = keepL; return r; });
    t.eq('PDF de la feuille vectoriel (textes, courbes, plume 0,25 mm), noir et blanc, ou en image', pv, { text: true, curves: true, pen: true, blue: true, bwBlue: false, img: true, noImgV: true });
    // mise en forme des cotes appliquée à TOUTES les cotes : pente, rayon, altitudes des points (fond plein / sans fond / pastille), extrémités
    const mf = await ev(() => { const keepS = shapes, keepD = Object.assign({}, dimStyle); const m = mmToWorld(1000);
        shapes = [{ type: 'slope', layerId: DIM_LAYER_ID, x1: 0, y1: 0, x2: 10 * m, y2: 0, z1: 101000, z2: 100000, zk: 1 }, { type: 'point', layerId: 'layer-0', x: 0, y: -5 * m, z: 100000, zk: 1 }];
        camera.zoom = 30 / m; camera.x = 200; camera.y = 300; invalidateCache();
        const P = CanvasRenderingContext2D.prototype, fr = P.fillRect, at = P.arcTo; let nR = 0, nA = 0; P.fillRect = function (...a) { nR++; return fr.apply(this, a); }; P.arcTo = function (...a) { nA++; return at.apply(this, a); };
        const run = (bg) => { dimStyleSet(Object.assign({}, keepD, { txtBg: bg })); nR = 0; nA = 0; invalidateCache(); draw(); return [nR, nA]; };
        const none = run('none'), fill = run('fill'), pill = run('pill'); P.fillRect = fr; P.arcTo = at; dimStyleSet(keepD); shapes = keepS; invalidateCache(); draw();
        return { fillMore: fill[0] - none[0] >= 2, pillArcs: pill[1] - none[1] >= 8 }; });
    t.eq('mise en forme des cotes : pente et altitudes suivent le fond choisi (sans, plein, pastille)', mf, { fillMore: true, pillArcs: true });
} };
