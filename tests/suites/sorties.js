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
    // calques par fenêtre : un calque masqué dans une fenêtre seulement (le plan et les autres fenêtres le gardent)
    const lvv = await ev(() => { const v = layoutData.vps[0], S = lpModelStore.shapes, m = mmToWorld(1000), L = ensureLayer('Réseau test', '#22d3ee'), sh = { type: 'line', layerId: L, x1: 0, y1: 0, x2: 10 * m, y2: 0 }; S.push(sh);
        const run = () => { const drawn = []; const o = window.drawSingleShape; window.drawSingleShape = function (c, s2, ...a) { if (s2 === sh) drawn.push(s2); return o.call(this, c, s2, ...a); }; const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; try { lpRenderVp(cv.getContext('2d'), v, 1, 0, 0, 800, 600); } finally { window.drawSingleShape = o; } return drawn.length > 0; };
        const before = run(); v.lv = { [L]: false }; const hid = run(), planVis = layers.find(l => l.id === L).visible !== false, btn = lpBtnRects(v).some(b => b.id === 'lay'); delete v.lv; S.splice(S.indexOf(sh), 1); return { before, hid, planVis, btn }; });
    t.eq('présentation : calques réglés par fenêtre', lvv, { before: true, hid: false, planVis: true, btn: true });
    // fenêtre active (on travaille dedans) : ses calques décochés restent cachés, le fond de carte décoché disparaît aussi
    const lva = await ev(() => { const v = layoutData.vps[0], m = mmToWorld(1000), L = ensureLayer('Fond test', '#ffffff'); lpEnterVp(v); const sh = { type: 'line', layerId: L, x1: 0, y1: 0, x2: 10 * m, y2: 0 }; shapes.push(sh);
        const run = () => { let n = 0; const o = window.drawSingleShape; window.drawSingleShape = function (c, s2, ...a) { if (s2 === sh) n++; return o.call(this, c, s2, ...a); }; try { draw(); } finally { window.drawSingleShape = o; } return n > 0; };
        const before = run(); v.lv = { [L]: false }; const hid = run(), planVis = layers.find(l => l.id === L).visible !== false; delete v.lv; const back = run(); shapes.splice(shapes.indexOf(sh), 1); lpLeaveVp(); draw(); return { before, hid, planVis, back }; });
    t.eq('présentation : calque décoché dans la fenêtre active (fond de carte), caché aussi pendant qu\'on travaille dedans', lva, { before: true, hid: false, planVis: true, back: true });
    // cotes du plan dans une fenêtre de présentation : écrites dans l'unité du plan (m), pas dans celle de la feuille (mm)
    const dun = await ev(() => { const v = layoutData.vps[0], S = lpModelStore.shapes, m = mmToWorld(1000), u0 = lpModelStore.unit, d0 = printSettings.decimals; lpModelStore.unit = 'm'; printSettings.decimals = 2;
        const dm = { type: 'dim', layerId: 'layer-0', x1: 0, y1: 0, x2: 24.21 * m, y2: 0, ox: 12 * m, oy: 2 * m }; S.push(dm); let txt = [];
        const oa = window.drawAnnotations; window.drawAnnotations = function (...a) { txt = dimensionTextsToDraw.map(d => d.text); return oa.apply(this, a); };
        const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; try { lpRenderVp(cv.getContext('2d'), v, 1, 0, 0, 800, 600); } finally { window.drawAnnotations = oa; }
        const after = printSettings.unit; S.splice(S.indexOf(dm), 1); lpModelStore.unit = u0; printSettings.decimals = d0; return { m: txt.some(t => /^24,21 m$/.test(t)), mm: txt.some(t => / mm$/.test(t)), sheet: after }; });
    t.eq('présentation : cotes du plan en m dans une fenêtre (la feuille reste en mm)', dun, { m: true, mm: false, sheet: 'mm' });
    // image dans sa fenêtre : entière / remplir, taille, déplacement à la souris (double-clic, glisser, molette), recadrée par le cadre
    const imv = await ev(async () => { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 100; const g = cv.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 200, 100);
        const v = { id: 'vimgt', kind: 'img', src: cv.toDataURL('image/png'), x: 20, y: 20, w: 100, h: 100 }; layoutData.vps.push(v); lpImg(v); await new Promise(r => setTimeout(r, 200)); const im = lpImg(v);
        const box = () => { const B = lpImgBox(v, im, 0, 0, 100, 100, 1); return [B.x, B.y, B.w, B.h].map(q => Math.round(q * 10) / 10); };
        const r = { btn: lpBtnRects(v).map(b => b.id).join(','), btnPlan: lpBtnRects(layoutData.vps[0]).some(b => b.id === 'img'), fit: box() };
        v.ifit = 'cover'; r.cover = box(); delete v.ifit;
        lpImgZoom(v, 2); r.z2 = box(); lpImgReset(v);
        const R = lpRect(v), px = R.x + R.w * 0.25, py = R.y + R.h * 0.25, before = lpImgBox(v, im, R.x, R.y, R.w, R.h, lpCam.k), u0 = (px - before.x) / before.w; lpImgZoom(v, 1.5, px, py); const after = lpImgBox(v, im, R.x, R.y, R.w, R.h, lpCam.k); r.fixed = Math.abs((px - after.x) / after.w - u0) < 1e-6;
        lpImgReset(v); lpDblClick(R.x + R.w / 2, R.y + R.h / 2); r.edit = lpIE.id === v.id; const e = { preventDefault() {}, deltaY: -100 };
        lpIEDown(e, R.x + R.w / 2, R.y + R.h / 2); lpIEMove(R.x + R.w / 2 + 10 * lpCam.k, R.y + R.h / 2); lpIEUp(); r.dx = Math.round(v.ix * 10) / 10; lpIEWheel(e, R.x + R.w / 2, R.y + R.h / 2); r.zoomed = v.iz > 1; r.moved = v.x === 20 && v.y === 20;
        lpIELeave(); r.left = lpIE.id === null;
        const c2 = document.createElement('canvas'); c2.width = 300; c2.height = 300; const tc = c2.getContext('2d'); v.iz = 5; lpRenderVp(tc, v, 1, 100, 100, 100, 100); const px2 = (x, y) => tc.getImageData(x, y, 1, 1).data[0]; r.clip = { inside: px2(150, 150) > 200, outside: px2(50, 150) === 0 && px2(250, 150) === 0 };
        layoutData.vps.splice(layoutData.vps.indexOf(v), 1); draw(); return r; });
    t.eq('présentation : image redimensionnée et placée dans sa fenêtre (bouton ⤢, double-clic, glisser, molette), recadrée par le cadre', imv,
        { btn: 'name,lock,frame,img', btnPlan: false, fit: [0, 25, 100, 50], cover: [-50, 0, 200, 100], z2: [-50, 0, 200, 100], fixed: true, edit: true, dx: 10, zoomed: true, moved: true, left: true, clip: { inside: true, outside: true } });
    // plan de situation : carte du lieu dans une fenêtre, doigt posé au clic, boussole et échelle graphique déplaçables, molette = échelle normalisée, carte déplacée au glisser
    const sit = await ev(async () => { const e = { preventDefault() {} }, r = {}, n0 = layoutData.vps.length; setMode('lpsit'); const s = (mx, my) => ({ x: lpCam.x + mx * lpCam.k, y: lpCam.y + my * lpCam.k });
        let a = s(30, 30), b = s(160, 130); lpMouseDown(e, a.x, a.y); lpMouseDown(e, b.x, b.y); const v = layoutData.vps.find(x => x.kind === 'sit'); r.made = !!v && layoutData.vps.length === n0 + 1 && mode === 'select-box';
        if (!v) return r; const o = sitOpt(v); o.lat = 44.56; o.lon = 6.11; o.S = 25000; o.pin = { lat: 44.56, lon: 6.11 };
        r.def = o.base === 'photo' && !!o.ov.cad && !!o.ov.routes; { const C = sitCanvas(v); r.layers = !!C && C.n > 0 && C.n % 3 === 0; } r.btn = lpBtnRects(v).map(q => q.id).join(','); r.bar = sitBarLen(o, v.w); r.z = sitZoom(o);
        const q = sitFromMm(o, 12, -8), back = sitToMm(o, q.lat, q.lon); r.round = Math.abs(back.x - 12) < 1e-6 && Math.abs(back.y + 8) < 1e-6;
        const R = lpRect(v); lpDblClick(R.x + R.w / 2, R.y + R.h / 2); r.edit = lpSE.id === v.id;
        const px = R.x + R.w / 2 + 20 * lpCam.k, py = R.y + R.h / 2 + 10 * lpCam.k; sitDown(e, px, py); sitUp(px, py); const pm = sitToMm(o, o.pin.lat, o.pin.lon); r.pin = Math.abs(pm.x - 20) < 1e-3 && Math.abs(pm.y - 10) < 1e-3;
        const pin0 = Object.assign({}, o.pin), lat0 = o.lat; sitDown(e, R.x + R.w * 0.3, R.y + R.h * 0.6); sitMove(R.x + R.w * 0.3 + 10 * lpCam.k, R.y + R.h * 0.6); sitUp(R.x + R.w * 0.3 + 10 * lpCam.k, R.y + R.h * 0.6); r.pan = o.lon < 6.11 && Math.abs(o.lat - lat0) < 1e-9 && o.pin.lon === pin0.lon;
        const cx = R.x + o.cmp.fx * R.w, cy = R.y + o.cmp.fy * R.h, f0 = o.cmp.fx; sitDown(e, cx, cy); sitMove(cx - 20 * lpCam.k, cy); sitUp(cx - 20 * lpCam.k, cy); r.cmp = o.cmp.fx < f0 && o.lon < 6.11;
        sitWheel({ preventDefault() {}, deltaY: 100 }, R.x + R.w / 2, R.y + R.h / 2); r.out = o.S; sitWheel({ preventDefault() {}, deltaY: -100 }, R.x + R.w / 2, R.y + R.h / 2); r.in = o.S; sitLeave(); r.left = lpSE.id === null;
        for (let i = 0; i < 40 && !sitFinger(); i++) await new Promise(res => setTimeout(res, 50)); const cv = document.createElement('canvas'); cv.width = 600; cv.height = 500; const g = cv.getContext('2d'); let err = null; try { lpRenderVp(g, v, 3, 0, 0, 390, 300); } catch (x) { err = x.message; } r.draw = err;
        const D = g.getImageData(0, 0, 390, 300).data; let blk = 0; for (let i = 0; i < D.length; i += 4) if (D[i] < 40 && D[i + 1] < 40 && D[i + 2] < 40 && D[i + 3] > 200) blk++; r.ink = blk > 150;   /* doigt, boussole, échelle */
        r.cart = !layoutData.vps.filter(x => !lpFlat(x) && !x.v3).includes(v); await sitReadyAll(1500); r.ready = true;
        layoutData.vps.splice(layoutData.vps.indexOf(v), 1); draw(); return r; });
    t.eq('présentation : plan de situation (photo avec parcelles et routes, carte du lieu, doigt au clic, carte glissée, boussole déplaçable, échelle graphique, molette = échelle normalisée)', sit,
        { made: true, def: true, layers: true, btn: 'name,lock,frame,sit', bar: 500, z: 14, round: true, edit: true, pin: true, pan: true, cmp: true, out: 50000, in: 25000, left: true, draw: null, ink: true, cart: true, ready: true });
    // fenêtre en vue 3D, pilotée : la vraie vue 3D (bandeau d'affichage, mêmes gestes : glisser = tourner, clic droit = déplacer, molette = zoom) posée dans le cadre ; Échap la fige
    const v3a = await ev(async () => { const v = layoutData.vps[layoutData.vps.length - 1]; await lp3DSnap(v); await lp3DEnter(v); const r = lpRect(v), c = canvas.getBoundingClientRect(), el = document.getElementById('view3d'), b = el.getBoundingClientRect(), band = document.getElementById('v3-band');
        return { ok: !!(v.v3 && v.v3.img), active: lp3D.id === v.id, live: el.style.display === 'block' && el.classList.contains('v3-lp'), fit: Math.abs(b.left - c.left - r.x) < 2 && Math.abs(b.width - r.w) < 2 && Math.abs(b.height - r.h) < 2, band: !band.classList.contains('v3-up') && band.parentElement === document.body, az: V3.az, dist: V3.dist, tx: V3.target.x, cx: c.left + r.x + r.w / 2, cy: c.top + r.y + r.h / 2 + 30 }; });
    await H.p.mouse.move(v3a.cx, v3a.cy); await H.p.mouse.down(); for (let i = 1; i <= 6; i++) await H.p.mouse.move(v3a.cx + i * 15, v3a.cy + i * 4); await H.p.mouse.up(); await H.wait(200);
    await H.p.mouse.down({ button: 'right' }); await H.p.mouse.move(v3a.cx + 40, v3a.cy + 10); await H.p.mouse.move(v3a.cx, v3a.cy); await H.p.mouse.up({ button: 'right' });
    await H.p.mouse.wheel(0, -300); await H.wait(300);
    const v3b = await ev(() => { const c = canvas.getBoundingClientRect(), br = document.getElementById('v3-band').getBoundingClientRect(); return { az: V3.az, dist: V3.dist, tx: V3.target.x, under: Math.abs(br.top - c.top) < 2 && Math.abs(br.left - c.left) < 2 }; });
    await H.press('Escape'); const v3c = await ev(() => { const v = layoutData.vps[layoutData.vps.length - 1]; return { id: lp3D.id, hid: document.getElementById('view3d').style.display === 'none', back: document.getElementById('v3-band').parentElement.id === 'view3d', az: v.v3.az, img: !!v.v3.img }; });
    t.ok('présentation : fenêtre 3D pilotée comme la vue 3D (tourne, se déplace, zoome, Échap la fige à ce point de vue)', v3a.ok && v3a.active && v3a.live && v3a.fit && Math.abs(v3b.az - v3a.az) > 0.3 && v3b.tx !== v3a.tx && v3b.dist < v3a.dist && v3c.id === null && v3c.hid && Math.abs(v3c.az - v3b.az) < 1e-9 && v3c.img, JSON.stringify([v3a, v3b, v3c]));
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
    // impression : une image (fond de plan) n'est écrite que sur la partie visible de la fenêtre, même tournée, en JPEG ; barre de progression pendant le PDF
    const ic = await ev(async () => { const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), c = new PdfCtx(doc, 160 / 25.4, false), im = document.createElement('canvas'); im.width = 700; im.height = 700; const g = im.getContext('2d'); g.fillStyle = '#4ade80'; g.beginPath(); g.arc(350, 350, 350, 0, 7); g.fill();
        const calls = []; const oa = doc.addImage.bind(doc); doc.addImage = (d, f, x, y, w, h, ...r) => { calls.push({ f, w: Math.round(w), h: Math.round(h), kb: Math.round(d.length / 1024) }); return oa(d, f, x, y, w, h, ...r); };
        c.save(); c.beginPath(); c.rect(20, 20, 100, 80); c.clip(); c.translate(70, 60); c.rotate(0.03); c.drawImage(im, -3000, -3000, 6000, 6000); c.restore();
        let seen = false; const iv = setInterval(() => { if (document.getElementById('busy-ov')) seen = true; }, 5); const keep = layoutData; layoutData = lpNew(); layoutData.vps.push({ id: 'v', x: 20, y: 20, w: 100, h: 80, scale: 200, cx: 0, cy: 0 }); await lpBuildPDFAsync(); busyEnd(); clearInterval(iv); layoutData = keep;
        return { n: calls.length, f: calls[0] && calls[0].f, small: calls[0] && calls[0].w < 130 && calls[0].h < 110, light: calls[0] && calls[0].kb < 1500, seen }; });
    t.eq('impression : image découpée à sa fenêtre (même tournée), en JPEG, barre de progression', ic, { n: 1, f: 'JPEG', small: true, light: true, seen: true });

    // plusieurs présentations : onglets (+), menu ⚙ (format et cartouche propres à chacune), cartouche à cases sur la feuille, poignées des fenêtres prises même hors du cadre, enregistrement
    await ev(() => { if (layoutOn) toggleLayout(false); lpResetAll(); Object.assign(layoutData, { paper: 'A3', orient: 'landscape', margin: 10, cartouche: true, cartType: 'mini' });
        layoutData.vps.push({ id: 'pA', x: 40, y: 40, w: 150, h: 100, scale: 200, cx: 0, cy: 0 }, { id: 'pB', x: 240, y: 40, w: 60, h: 60, round: true, scale: 200, cx: 0, cy: 0 }); toggleLayout(true); });
    await H.wait(300);
    const tabXY = (sel) => ev(sel => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    t.eq('présentations : un onglet', await ev(() => document.querySelectorAll('#lp-tabs .lp-tab').length), 1);
    await H.click(await tabXY('#lp-tabs .lp-tab-add')); await H.wait(200);
    const cfg = await ev(() => [lpMenuShown(), !document.querySelector('#lp-tabs .lp-tab-g')]);
    await H.click(await tabXY('#lp-menu [data-a=add]')); await H.wait(200);
    t.eq('présentations : « + » ouvre le configurateur (plus de ⚙ sur l\'onglet), « Nouvelle présentation » en crée une 2e, ouverte, vide, au même format', await ev(() => [layouts.length, layoutIdx, layoutData.vps.length, layoutData.paper, document.querySelectorAll('#lp-tabs .lp-tab').length]).then(v => cfg.concat(v)), [true, true, 2, 1, 0, 'A3', 2]);
    const del = await ev(() => { document.querySelector('#lp-menu [data-a=del][data-i="1"]').click(); const ask = !!document.querySelector('#lp-menu .lpm-ask') && !!document.querySelector('#lp-menu [data-a=delok]'); document.querySelector('#lp-menu [data-a=delno]').click(); return [ask, layouts.length, !!document.querySelector('#lp-menu [data-a=del][data-i="1"] svg')]; });
    t.eq('configurateur : suppression demandée en ligne (Oui / Non), boutons à icônes', del, [true, 2, true]);
    await ev(() => { const set = (f, v) => { const e = document.querySelector('#lp-menu [data-i="1"][data-f="' + f + '"]'); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }; set('paper', 'A1'); set('cart', 'a4'); set('name', 'Réseau EP'); });
    await H.press('Escape'); await H.wait(150);
    t.eq('menu ⚙ : format A1 et cartouche A4 pour la 2e seulement, renommée', await ev(() => [lpMenuShown(), layouts[1].paper, layouts[1].cartType, layouts[0].paper, layouts[0].cartType, document.querySelector('#lp-tabs .lp-tab.on').textContent.replace('⚙', '').trim()]), [false, 'A1', 'a4', 'A3', 'mini', '2. Réseau EP']);
    const cellXY = (key) => ev(key => { const c = lpCartCells().find(x => x.key === key), r = canvas.getBoundingClientRect(); return c ? { x: r.left + lpCam.x + (c.x + c.w / 2) * lpCam.k, y: r.top + lpCam.y + (c.y + c.h / 2) * lpCam.k } : null; }, key);
    t.eq('cartouche A4 : titre = nom de l\'onglet tant qu\'il n\'est pas écrit', await ev(() => lpCartSrc().planName), 'Réseau EP');
    await H.click(await cellXY('site')); await H.wait(150);
    const edOpen = await ev(() => !!document.getElementById('lp-cart-ed'));
    await p.keyboard.type('Chantier de Gap'); await H.press('Enter'); await H.wait(100);
    await H.click(await cellXY('planName')); await H.wait(150); await p.keyboard.press('Control+A'); await p.keyboard.type('Plan des eaux pluviales'); await H.press('Enter');
    await H.click(await cellXY('rev.0.txt')); await H.wait(150); await p.keyboard.type('Première diffusion'); await H.press('Enter'); await H.wait(100);
    t.eq('cartouche à cases : clic sur une case, saisie, Entrée (commun au projet / propre à la présentation)', await ev(() => [cartoucheData.site, layouts[1].cart.planName, (layouts[1].cart.revisions || [])[0] && layouts[1].cart.revisions[0].txt, layouts[0].cart.planName, !!document.getElementById('lp-cart-ed')]), ['Chantier de Gap', 'Plan des eaux pluviales', 'Première diffusion', undefined, false]);
    t.ok('cartouche à cases : la case s\'ouvre en saisie sur la feuille', edOpen);
    await H.shot('presentations-cartouche-cases');
    await H.click(await tabXY('#lp-tabs .lp-tab[data-i="0"]')); await H.wait(200);
    t.eq('onglet 1 : retour à la 1re présentation, ses 2 fenêtres', await ev(() => [layoutIdx, layoutData.vps.length, layoutData.paper]), [0, 2, 'A3']);
    // poignées : coin pris 6 px hors du cadre, bord droit seul, rayon de la fenêtre ronde
    const drag = async (a, dx, dy) => { await p.mouse.move(a.x, a.y); await H.wait(60); await p.mouse.down(); for (let i = 1; i <= 5; i++) { await p.mouse.move(a.x + dx * i / 5, a.y + dy * i / 5); await H.wait(20); } await p.mouse.up(); await H.wait(120); };
    const vpPt = (id, fx, fy, ox, oy) => ev(([id, fx, fy, ox, oy]) => { const v = lpVp(id), r = lpRect(v), c = canvas.getBoundingClientRect(); return { x: c.left + r.x + r.w * fx + ox, y: c.top + r.y + r.h * fy + oy }; }, [id, fx, fy, ox, oy]);
    const sz = (id) => ev(id => { const v = lpVp(id); return [Math.round(v.x), Math.round(v.y), Math.round(v.w), Math.round(v.h)]; }, id);
    const s0 = await sz('pA'), kk = await ev(() => lpCam.k);
    await drag(await vpPt('pA', 1, 1, 6, 6), 60, 40); const s1 = await sz('pA');
    t.ok('poignée de coin prise hors du cadre : la fenêtre s\'étire', s1[2] > s0[2] + 20 / kk && s1[3] > s0[3] + 10 / kk && s1[0] === s0[0], JSON.stringify([s0, s1]));
    await drag(await vpPt('pA', 1, 0.5, 4, 0), 50, 30); const s2 = await sz('pA');
    t.ok('poignée de bord : seule la largeur change', s2[2] > s1[2] + 20 / kk && s2[3] === s1[3] && s2[1] === s1[1], JSON.stringify([s1, s2]));
    const r0 = await sz('pB'); await drag(await vpPt('pB', 1, 0.5, 4, 0), 30, 0); const r1 = await sz('pB');
    t.ok('fenêtre ronde : son pourtour se tire, elle grandit autour de son centre', r1[2] > r0[2] + 20 / kk && Math.abs((r1[0] + r1[2] / 2) - (r0[0] + r0[2] / 2)) <= 1, JSON.stringify([r0, r1]));
    // enregistrement et réouverture
    // fond de carte : dans son propre calque « Fond de carte » (à l'import, et ramené là à l'ouverture d'un ancien fichier)
    const bml = await ev(() => { const keepS = shapes, keepL = layers.slice(), keepA = activeLayerId, r = {}; shapes = [{ type: 'basemap', layerId: 'layer-0', x: 0, y: 0, r: 1000, rot: 0, lat: 44.5, lon: 6.1, radiusM: 100, mapId: 'tbm' }, { type: 'line', layerId: 'layer-0', x1: 0, y1: 0, x2: 10, y2: 0 }];
        r.n = bmLayerRepair() === 1; const L = layers.find(l => l.name === 'Fond de carte'), b = shapes[0], ln = shapes[1]; r.moved = !!L && b.layerId === L.id && ln.layerId === 'layer-0' && activeLayerId === keepA;
        r.load = /bmLayerRepair\(\)/.test(loadProjectText.toString() + (typeof mmcApply === 'function' ? mmcApply.toString() : '')) || /MMC_LOAD_FIX\.bm = bmLayerRepair/.test(document.documentElement.innerHTML); r.imp = /layerId: bmLayerId\(\)/.test(placeBasemapAt.toString()) && !!L && bmLayerId() === L.id;
        shapes = keepS; layers = keepL; activeLayerId = keepA; updateLayerUI(); invalidateCache(); saveState(); draw(); return r; });
    t.eq('fond de carte dans son propre calque « Fond de carte » : à l\'import, et ramené là à l\'ouverture d\'un ancien fichier', bml, { n: true, moved: true, load: true, imp: true });
    const rt = await ev(() => { const txt = JSON.stringify(projectData()); toggleLayout(false); lpResetAll(); loadProjectText(txt, 'essai.mmc');
        return [layouts.length, layoutIdx, layouts.map(L => L.name), layouts[1].paper, layouts[1].cartType, layouts[1].cart.planName, layouts[0].vps.length, cartoucheData.site]; });
    t.eq('présentations enregistrées puis rouvertes (.mmc)', rt, [2, 0, ['', 'Réseau EP'], 'A1', 'a4', 'Plan des eaux pluviales', 2, 'Chantier de Gap']);
    // dossiers d'urbanisme : « Nouveau PC » et « Nouvelle DP » dans le volet des présentations (à droite, pleine hauteur)
    const pc = await ev(() => { lpResetAll(); if (!layoutOn) toggleLayout(true); lpMenuOpen(); const card = document.querySelector('#lp-menu .lpm-card').getBoundingClientRect(); const side = card.right >= innerWidth - 2 && card.left > 0;
        document.querySelector('#lp-menu [data-a=addpc]').click(); const P = layouts.slice(1); const r = { side, n: P.length, names: P.map(L => L.name.split(' ')[0]).join(','), cart: P[1].cart.planName + '|' + P[1].cart.phase + '|' + P[1].cart.indice, vps: P.map(L => L.vps.length).join(''), sc: P[1].vps[0].scale, fmt: P.every(L => L.paper === 'A3' && L.orient === 'landscape') ? 'A3landscape/A3landscape' : P.map(L => L.paper + L.orient).join(','), cur: layoutIdx };
        const T = P.map(L => (L.paperShapes || []).find(x => x.type === 'text' && x.lpNeed)), F = P.map(L => (L.paperShapes || []).find(x => x.type === 'poly' && x.lpNeed)), M = mmToWorld(1);
        r.need = T.every((x, k) => x && x.content.startsWith(P[k].name.split(' ')[0] + ' — À FOURNIR')) && new Set(T.map(x => x.content)).size === 8 && layerTextH(T[0].layerId) === 3.5;
        r.clear = P.every((L, k) => !L.vps.length || F[k].points[0].x / M >= L.vps[0].x + L.vps[0].w) && F.every((f, k) => T[k].y > f.points[0].y && T[k].y < f.points[2].y);
        r.sit = P[0].vps[0].kind === 'sit' && P[1].vps[0].north === true;
        { const v = P[1].vps[0], ink = () => { const cv = document.createElement('canvas'); cv.width = 500; cv.height = 400; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 500, 400); lpRenderVp(g, v, 2, 0, 0, 480, 380); const D = g.getImageData(0, 0, 480, 380).data; let n = 0; for (let i = 0; i < D.length; i += 4) if (D[i] < 200 && D[i + 1] < 200 && D[i + 2] < 200) n++; return n; };
            const n0 = ink(); v.grid = true; const n1 = ink(); r.grid = n1 > n0 + 50 && lpBtnRects(v).some(b => b.id === 'grid') && lpGridStep(v) > 0; v.grid = false; }
        { const D = dosCheck(); r.dos = D.length + ':' + D.map(x => x.code + x.st[0]).join(','); const p1 = P[0].vps[0]; p1.sit.lat = 44.56; p1.sit.lon = 6.11; p1.sit.pin = { lat: 44.56, lon: 6.11 };
            const it = (c) => dosCheck().find(x => x.code === c).items.map(x => x.st[0] + ':' + x.t.split(' ')[0]).join('|'); r.sit1 = it('PCMI1'); P[1].vps[0].north = false; r.noNorth = /b:pas de nord|b:pas/.test(it('PCMI2')) && it('PCMI2').includes('b:pas'); P[1].vps[0].north = true;
            lpMenuClose(); dosPanel(); r.panel = !!document.querySelector('[onclick^="dosGo(1)"]'); closeTopoModal(); lpMenuOpen(); }
        document.querySelector('#lp-menu [data-a=adddp]').click(); r.dp = layouts.slice(9).map(L => L.name.split(' ')[0]).join(','); r.dp4 = layouts[12].cart.planName; r.dpneed = layouts.slice(9).every(L => (L.paperShapes || []).some(x => x.type === 'text' && x.lpNeed && x.content.startsWith(L.name.split(' ')[0] + ' '))); lpMenuClose(); toggleLayout(false); lpResetAll(); return r; });
    t.eq('présentations : volet à droite ; « Nouveau PC » = PCMI1 à PCMI8, « Nouvelle DP » = DP1 à DP8, cartouche rempli (titre, phase, indice A), plans cadrés à l\'échelle usuelle, chaque feuille avec ce que la pièce doit montrer (à côté du plan)', pc,
        { side: true, n: 8, names: 'PCMI1,PCMI2,PCMI3,PCMI4,PCMI5,PCMI6,PCMI7,PCMI8', cart: 'PCMI2 — Plan de masse|PC|A', vps: '11101000', sc: 200, fmt: 'A3landscape/A3landscape', cur: 1, need: true, clear: true, sit: true, grid: true, dos: '8:PCMI1b,PCMI2b,PCMI3b,PCMI4b,PCMI5b,PCMI6b,PCMI7b,PCMI8b', sit1: 'o:carte|o:doigt|o:nord|o:échelle|o:échelle|o:cartouche|w:bloc', noNorth: true, panel: true, dp: 'DP1,DP2,DP3,DP4,DP5,DP6,DP7,DP8', dp4: 'DP4 — Plan des façades et des toitures', dpneed: true });
    await ev(() => { lpResetAll(); cartoucheData.site = ''; saveCartoucheData(); });
} };
