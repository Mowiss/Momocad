        // =====================================================================
        // FOND PERSO (PDF, JPEG, PNG) : objet { type:'bgimage', x, y (centre), w, h, rot, mapId, opacity, name }
        // L'image est rangée dans basemapStore comme les fonds de carte (enregistrée dans le .mmc).
        // =====================================================================
        const isBg = (s) => s && (s.type === 'basemap' || s.type === 'bgimage');
        let bgSrc = null;   // { kind:'pdf', doc, name } | { kind:'img', img, dataUrl, name }
        const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
        let pdfjsPromise = null;
        function loadPdfJs() {
            if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
            if (!pdfjsPromise) pdfjsPromise = new Promise((res, rej) => {
                loadJSFirst([MC_LIB + 'pdf.min.js', PDFJS_URL + 'pdf.min.js']).then((u) => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = u.startsWith(MC_LIB) ? MC_LIB + 'pdf.worker.min.js' : PDFJS_URL + 'pdf.worker.min.js'; res(window.pdfjsLib); },
                    () => { pdfjsPromise = null; rej(new Error('lecteur PDF indisponible (connexion ?)')); });
            });
            return pdfjsPromise;
        }
        function bgInfo(t) { document.getElementById('bg-info').textContent = t || ''; }
        // lecture d'un plan PDF : barre d'avancement (étape k sur n), le temps que l'écran se rafraîchisse
        // ---- BARRE DE PROGRESSION des traitements longs (lecture d'un PDF, impression d'une mise en page) : étape k sur n, temps écoulé,
        //      roue qui tourne même pendant un calcul lourd (animation gérée par le navigateur) : on voit que MomoCAD travaille.
        let busyT0 = 0;
        async function busyStep(t, k, n) { let o = document.getElementById('busy-ov');
            if (!o) { o = document.createElement('div'); o.id = 'busy-ov'; o.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
                o.innerHTML = '<div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:18px 22px;min-width:340px;max-width:460px;box-shadow:0 10px 30px rgba(0,0,0,.6);font:13.5px Arial;color:#e5e7eb"><div style="display:flex;align-items:center;gap:12px"><div class="busy-spin" style="width:22px;height:22px;border-radius:50%;border:3px solid #374151;border-top-color:#3b82f6;animation:busySpin .8s linear infinite;flex:none"></div><div><div id="busy-t" style="font-weight:700"></div><div id="busy-s" style="color:#9ca3af;font-size:12px;margin-top:2px"></div></div></div><div style="height:8px;background:#374151;border-radius:4px;margin-top:12px;overflow:hidden"><div id="busy-b" style="height:100%;width:0;background:#3b82f6;transition:width .25s"></div></div></div>';
                document.body.appendChild(o); if (!document.getElementById('busy-css')) { const st = document.createElement('style'); st.id = 'busy-css'; st.textContent = '@keyframes busySpin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); } busyT0 = Date.now(); }
            o.style.display = 'flex'; document.getElementById('busy-t').textContent = t; document.getElementById('busy-s').textContent = 'Étape ' + k + ' sur ' + n + ' · ' + Math.round((Date.now() - busyT0) / 1000) + ' s — MomoCAD travaille, patientez';
            document.getElementById('busy-b').style.width = Math.round(100 * Math.max(0, k - 0.5) / n) + '%';
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30))); }
        function busyEnd() { const o = document.getElementById('busy-ov'); if (o) o.remove(); }
        async function bgProg(k, n, t) { const e = document.getElementById('bg-info'); if (!e) return; e.innerHTML = '';
            const l = document.createElement('div'); l.textContent = t + ' (' + k + '/' + n + ')'; const b = document.createElement('div'); b.style.cssText = 'height:5px;background:#374151;border-radius:3px;margin-top:4px;overflow:hidden';
            const f = document.createElement('div'); f.className = 'bg-prog'; f.style.cssText = 'height:100%;background:#3b82f6;width:' + Math.round(100 * (k - 0.5) / n) + '%'; b.appendChild(f); e.append(l, b);
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); }
        async function loadBgFile(input) {
            const f = input.files && input.files[0]; input.value = ''; if (!f) return;
            const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
            document.getElementById('bg-name').textContent = f.name;
            document.getElementById('bg-page-row').style.display = isPdf ? 'flex' : 'none';
            document.getElementById('bg-ech-row').style.display = isPdf ? 'flex' : 'none';
            document.getElementById('bg-larg-unit').textContent = currentUnit;
            document.querySelector('input[name=bg-scale][value=cal]').checked = true;
            document.getElementById('bgimg-modal').style.display = 'flex';
            const pv = document.getElementById('bg-preview'); pv.getContext('2d').clearRect(0, 0, pv.width, pv.height);
            bgSrc = null; bgInfo('Lecture…'); { const gr = document.getElementById('bg-grid-row'); if (gr) gr.style.display = 'none'; }
            document.getElementById('bg-gridman').checked = false; document.getElementById('bg-legend').style.display = 'none';
            bgSt('bg-ech-st', isPdf ? 'wait' : 'warn', isPdf ? 'lecture du plan…' : 'à mesurer sur l\'image'); bgSt('bg-grid-st', isPdf ? 'wait' : '', isPdf ? 'lecture du plan…' : 'pas lisible sur une image'); bgEchChips();
            try {
                if (isPdf) {
                    const lib = await loadPdfJs();
                    const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
                    bgSrc = { kind: 'pdf', doc, name: f.name };
                    const pg = document.getElementById('bg-page'); pg.max = doc.numPages; pg.value = 1;
                    document.getElementById('bg-pages').textContent = '/ ' + doc.numPages;
                } else {
                    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
                    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image illisible')); im.src = dataUrl; });
                    bgSrc = { kind: 'img', img, dataUrl, name: f.name };
                }
                await bgRenderPreview();
            } catch (err) { console.error(err); bgInfo('Erreur : ' + (err.message || err)); }
        }
        // Rend une page PDF sur un canvas (fond blanc) ; maxPx = plus grand côté visé
        async function renderPdfPage(n, maxPx) {
            const page = await bgSrc.doc.getPage(n), v1 = page.getViewport({ scale: 1 });
            const sc = Math.min(maxPx / Math.max(v1.width, v1.height), 400 / 72);
            const vp = page.getViewport({ scale: sc });
            const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
            await page.render({ canvasContext: c, viewport: vp }).promise;
            return { cv, mmW: v1.width * 25.4 / 72, mmH: v1.height * 25.4 / 72 };
        }
        async function bgRenderPreview() {
            if (!bgSrc) return;
            const pv = document.getElementById('bg-preview'), c = pv.getContext('2d');
            let src, iw, ih, info = '', overlay = null;
            if (bgSrc.kind === 'pdf') {
                const n = Math.max(1, Math.min(bgSrc.doc.numPages, parseInt(document.getElementById('bg-page').value, 10) || 1));
                const r = await renderPdfPage(n, 440); src = r.cv; iw = r.cv.width; ih = r.cv.height;
                info = 'Page ' + n + ' : ' + Math.round(r.mmW) + ' × ' + Math.round(r.mmH) + ' mm';
                // échelle du cartouche et carroyage : lus dans le PDF, proposés d'office ; ce qui est trouvé (ou pas) est dit clairement
                try { await pdfPageVec(bgSrc, n, true); const G = await pdfReadGrid(bgSrc.doc, n, bgSrc.glyph); if (!G.ech) { const mF = String(bgSrc.name || '').match(/(?:^|[^0-9])(?:1[_-])?(100|200|250|500|1000|2000|2500)(?![0-9])/); if (mF) { G.ech = +mF[1]; G.echSrc = 'nom'; } } bgSrc.grid = G; bgSrc.gridPage = n; const row = document.getElementById('bg-grid-row'), fit = pdfGridFit(G, (detectCRS() || {}).code || bmSettings.crs);
                    const eG = fit ? Math.round(fit.scale * 72 / 25.4 * 1000) : 0;
                    if (!G.ech && !eG && !bgSrc.echSet) document.getElementById('bg-ech').value = '';
                    if ((G.ech || eG) && !bgSrc.echSet) { document.getElementById('bg-ech').value = String(G.ech || (Math.abs(eG / 50 - Math.round(eG / 50)) < 0.04 ? Math.round(eG / 50) * 50 : eG)); document.querySelector('input[name=bg-scale][value=ech]').checked = true; bgSrc.echSet = true; }
                    row.style.display = fit ? 'flex' : 'none'; document.getElementById('bg-grid').checked = !!fit; if (fit || G.lab.length >= 2 || (G.cx || []).length >= 6) overlay = G;
                    if (fit) document.getElementById('bg-grid-info').textContent = 'Position, rotation et échelle exactes, calées sur ' + (/croix/.test(fit.used) ? fit.used + ' et ' : '') + G.lab.length + ' coordonnées écrites sur le plan.';
                    if (G.ech) bgSt('bg-ech-st', 'ok', '✓ 1/' + G.ech + (G.echSrc === 'nom' ? ' lue dans le nom du fichier' : ' lue dans le cartouche'));
                    else if (eG) bgSt('bg-ech-st', 'ok', '✓ 1/' + eG + ' d\'après le carroyage');
                    else bgSt('bg-ech-st', 'warn', '⚠ non trouvée : indiquez-la');
                    if (fit) bgSt('bg-grid-st', 'ok', '✓ ' + crsName(fit.crs) + ' · ' + G.lab.length + ' coordonnées' + (G.cx && G.cx.length ? ' · ' + G.cx.length + ' croix' : ''));
                    else bgSt('bg-grid-st', 'warn', G.lab.length >= 2 ? '⚠ coordonnées repérées (' + G.lab.length + ') mais pas assez pour caler : calez à la main' : G.cx && G.cx.length >= 6 ? '⚠ ' + G.cx.length + ' croix repérées, aucune coordonnée lue : calez à la main' : '⚠ non trouvé sur ce plan');
                    document.getElementById('bg-gridman').closest('label').querySelector('b').textContent = fit ? 'Ou caler à la main sur 2 croix' : 'Caler à la main sur 2 croix';
                    bgEchChips(); } catch (e) { console.warn(e); bgSt('bg-ech-st', 'warn', '⚠ non trouvée : indiquez-la'); bgSt('bg-grid-st', 'warn', '⚠ non trouvé'); }
            } else { src = bgSrc.img; iw = src.naturalWidth; ih = src.naturalHeight; info = iw + ' × ' + ih + ' px'; }
            const k = Math.min(pv.width / iw, pv.height / ih);
            c.clearRect(0, 0, pv.width, pv.height);
            c.drawImage(src, (pv.width - iw * k) / 2, (pv.height - ih * k) / 2, iw * k, ih * k);
            if (overlay) { const ox = (pv.width - iw * k) / 2, oy = (pv.height - ih * k) / 2, P = (q) => [ox + q[0] * iw * k, oy + q[1] * ih * k];   // ce qui a été lu, montré sur l'aperçu
                c.fillStyle = '#f59e0b'; (overlay.lab || []).forEach(l => { const [x, y] = P(l); c.fillRect(x - 2.5, y - 2.5, 5, 5); });
                c.strokeStyle = '#16a34a'; c.lineWidth = 1.5; (overlay.cx || []).forEach(q => { const [x, y] = P(q); c.beginPath(); c.arc(x, y, 3.2, 0, 2 * Math.PI); c.stroke(); });
                document.getElementById('bg-legend').style.display = (overlay.lab || []).length || (overlay.cx || []).length ? 'block' : 'none'; }
            bgInfo(info);
        }
        function bgSt(id, cls, t) { const e = document.getElementById(id); if (!e) return; e.className = 'bg-st' + (cls ? ' ' + cls : ''); e.textContent = t || ''; }
        function bgEchChips() { const on = (document.querySelector('input[name=bg-scale]:checked') || {}).value === 'ech', v = on ? parseFloat(String(document.getElementById('bg-ech').value).replace(',', '.')) : NaN; document.querySelectorAll('#bg-ech-chips button').forEach(b => b.classList.toggle('on', +b.textContent === v)); }
        function bgEchSet(e) { document.getElementById('bg-ech').value = String(e); document.querySelector('input[name=bg-scale][value=ech]').checked = true; bgEchTyped(); }
        function bgEchTyped() { bgEchChips(); const st = document.getElementById('bg-ech-st'), v = parseFloat(String(document.getElementById('bg-ech').value).replace(',', '.')); if (st && st.classList.contains('warn') && v > 0) bgSt('bg-ech-st', 'ok', '✓ 1/' + v + ' indiquée'); else if (st && /indiquée/.test(st.textContent) && v > 0) bgSt('bg-ech-st', 'ok', '✓ 1/' + v + ' indiquée'); }
        function bgGridToggled(man) { const g = document.getElementById('bg-grid'), m = document.getElementById('bg-gridman'); if (man && m.checked) g.checked = false; if (!man && g.checked) m.checked = false; }
        function closeBgModal() {
            document.getElementById('bgimg-modal').style.display = 'none'; bgSrc = null;
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // rendre le clavier au dessin
        }
        async function insertBgImage() {
            if (!bgSrc) return;
            const how = document.querySelector('input[name=bg-scale]:checked').value;
            const num = (id) => parseFloat(String(document.getElementById(id).value).replace(',', '.'));
            if (how === 'ech' && !(num('bg-ech') > 0)) { bgInfo("Indiquez l'échelle du PDF (ex. 200 pour 1:200)."); return; }
            if (how === 'larg' && !(num('bg-larg') > 0)) { bgInfo('Indiquez la largeur réelle.'); return; }
            const btn = document.getElementById('bg-ok'); btn.textContent = 'Préparation…'; btn.disabled = true;
            try {
                let dataUrl, iw, ih, mmW = 0;
                if (bgSrc.kind === 'pdf') {
                    const n = Math.max(1, Math.min(bgSrc.doc.numPages, parseInt(document.getElementById('bg-page').value, 10) || 1));
                    const r = await renderPdfPage(n, 8000);   // plans de géomètre : cotes de 1 à 2 mm, il faut ~13 px/mm sur un A1 pour les lire en zoomant
                    dataUrl = r.cv.toDataURL('image/jpeg', 0.92); iw = r.cv.width; ih = r.cv.height; mmW = r.mmW;
                    try { await pdfPageVec(bgSrc, n); await busyStep('Lecture du plan PDF : cotes et repères des points', 5, 5); bgSrc.topo = await pdfReadTopo(bgSrc.doc, n, bgSrc.glyph); bgSrc.page = n; } catch (e) { console.warn('lecture des cotes du PDF', e); } finally { busyEnd(); }
                } else {
                    const im = bgSrc.img; iw = im.naturalWidth; ih = im.naturalHeight; dataUrl = bgSrc.dataUrl;
                    if (Math.max(iw, ih) > 6000) {   // très grande image : réduite pour garder le plan léger
                        const k = 6000 / Math.max(iw, ih), cv = document.createElement('canvas');
                        cv.width = Math.round(iw * k); cv.height = Math.round(ih * k);
                        const c = cv.getContext('2d'); c.drawImage(im, 0, 0, cv.width, cv.height);
                        dataUrl = /png/i.test(dataUrl.slice(0, 30)) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
                        iw = cv.width; ih = cv.height;
                    }
                }
                let w;
                if (how === 'ech') w = mmToWorld(mmW * num('bg-ech'));
                else if (how === 'larg') w = (num('bg-larg') / unitsPerSquare) * GRID_SIZE;
                else w = (canvas.width * 0.8) / camera.zoom;
                const h = w * ih / iw;
                const id = 'bg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                basemapStore[id] = dataUrl;
                const c = screenToWorld(canvas.width / 2, canvas.height / 2);
                const shp = { type: 'bgimage', layerId: activeLayerId, x: c.x, y: c.y, w, h, rot: 0, mapId: id, opacity: 1, name: bgSrc.name }; if (bgSrc.kind === 'pdf') { shp.pdfPage = bgSrc.page || 1; if (bgSrc.topo) shp.pdfTopo = bgSrc.topo; if (bgSrc.doc) await pdfReadAll(shp, bgSrc.doc, shp.pdfPage, bgSrc.topo, bgSrc.vecPage === shp.pdfPage ? bgSrc.vec : null); }
                const hadDrawing = shapes.some(x => !isBg(x));
                shapes.unshift(shp);
                let gr = null, gskip = null; const gridWanted = !!(bgSrc.grid && how === 'ech' && document.getElementById('bg-grid').checked); if (bgSrc.kind === 'pdf' && bgSrc.grid) { shp.pdfGrid = bgSrc.grid; if (how === 'ech' && document.getElementById('bg-grid').checked) { gr = bgApplyGrid(shp, bgSrc.grid, num('bg-ech')); if (gr && gr.err) { shapes.shift(); bgInfo(gr.err); return; } if (gr && gr.skip) { gskip = gr.skip; gr = null; } } }
                if ((!hadDrawing && how !== 'cal') || gr) {
                    camera.zoom = Math.min(canvas.width / shp.w, canvas.height / shp.h) * 0.85;
                    camera.x = canvas.width / 2 - shp.x * camera.zoom; camera.y = canvas.height / 2 - shp.y * camera.zoom;
                }
                saveState(); closeBgModal(); bmImg(id);
                if (document.getElementById('bg-gridman').checked && !gr) { if (how === 'cal' && !hadDrawing) { camera.zoom = Math.min(canvas.width / shp.w, canvas.height / shp.h) * 0.85; camera.x = canvas.width / 2 - shp.x * camera.zoom; camera.y = canvas.height / 2 - shp.y * camera.zoom; } gcalStart(shp); updateCommandMessage(); }
                else if (how === 'cal') { selectedShapes = [shp]; setMode('calibrate'); calTarget = shp; }
                else if (gr) { selectedShapes = [shp]; updateCommandMessageText(bgGridMsg(gr, num('bg-ech'))); }
                else { selectedShapes = [shp]; updateCommandMessageText('FOND PERSO inséré à l\'échelle, sous le dessin.' + (gskip ? ' CARROYAGE : ' + gskip + '.' : '') + (gridWanted && !gskip ? ' Carroyage non exploitable : calez-le à la main.' : '') + ' Tapez 50% pour l\'éclaircir.'); }
                draw();
            } catch (err) { console.error(err); bgInfo('Erreur : ' + (err.message || err)); }
            finally { btn.textContent = 'Insérer'; btn.disabled = false; }
        }
        // ---- POINTS TOPO D'UN PLAN PDF : on lit le PDF lui-même (textes et petits repères vectoriels), pas l'image : la netteté du fond ne compte pas ----
        // résultat rangé sur l'image de fond : t = cotes candidates [u, v, valeur, hauteur] et m = repère associé [u, v] ou null (u, v : 0..1 sur la page, v vers le bas)
        // textes d'une page PDF, lettres posées une à une recollées en mots : [{ s, x0, y0, x1, y1, ux, uy, h, w }]
        function pdfRuns(tc) { const raw = [];
                tc.items.forEach(it => { if (!it.str || !it.transform) return; const [a, b, c, d, e, f] = it.transform, la = Math.hypot(a, b) || 1, ld = Math.hypot(c, d) || 1, ux = a / la, uy = b / la, w = it.width || 0;
                    raw.push({ s: it.str, x0: e, y0: f, ux, uy, h: ld, w, x1: e + ux * w, y1: f + uy * w }); });
                // morceaux d'un même nombre écrits à la suite (« 458 » « , » « 33 ») : recollés
                const T = []; let brk = true; raw.forEach(r => { if (!String(r.s).trim()) { brk = true; return; } const L = brk ? null : T[T.length - 1]; brk = false; const al = L ? (r.x0 - L.x0) * L.ux + (r.y0 - L.y0) * L.uy : 0, pe = L ? Math.abs(-(r.x0 - L.x0) * L.uy + (r.y0 - L.y0) * L.ux) : 0;   // lettres posées une à une (PDF de DAO) : la suivante démarre dans la foulée de la précédente
                    if (L && Math.abs(L.h - r.h) < 0.2 * r.h && Math.abs(L.ux * r.uy - L.uy * r.ux) < 0.05 && pe < 0.4 * r.h && al > 0.05 * r.h && al < L.w + 0.6 * r.h) { L.s += r.s; const e2 = al + r.w; if (e2 > L.w) { L.w = e2; L.x1 = L.x0 + L.ux * e2; L.y1 = L.y0 + L.uy * e2; } } else T.push(Object.assign({}, r)); });
            return T; }
        // traits et textes filaires d'une page, lus une fois
        async function pdfPageVec(src, n, prog) { try { if (!src.vec || src.vecPage !== n) { if (prog) await bgProg(1, 3, 'Lecture des traits du plan'); await busyStep('Lecture du plan PDF : les traits', 1, 5); src.vec = await pdfReadVectors(src.doc, n);
                if (prog) await bgProg(2, 3, 'Lecture des cotes et des textes'); await busyStep('Lecture du plan PDF : cotes écrites en traits', 2, 5); const g1 = pdfGlyphRuns(src.vec);
                await busyStep('Lecture du plan PDF : cotes en contours pleins', 3, 5); src.glyph = g1.concat(pdfFillGlyphRuns(src.vec)); src.vecPage = n; }
            if (prog) await bgProg(3, 3, 'Calage sur le carroyage'); await busyStep('Lecture du plan PDF : calage sur le carroyage', 4, 5); return src; } finally { if (prog) busyEnd(); } }
        async function pdfReadTopo(doc, n, gl) {
            const page = await doc.getPage(n), vp = page.getViewport({ scale: 1 }), W = vp.width, H = vp.height, P = (x, y) => vp.convertToViewportPoint(x, y);
            const tc = await page.getTextContent();
            const T = pdfRuns(tc).concat(gl && gl.length ? pdfGlyphToPdf(gl, vp) : []);
            const num0 = T.map(r => { const m = String(r.s).replace(/\s+/g, '').replace(/^(?:z|Z|NGF|alt\.?)[:=]?/, '').match(/^[+]?(\d{1,4}[.,]\d{1,3})(?:m|NGF)?$/); if (!m) return null;
                const v = parseFloat(m[1].replace(',', '.')), cx = (r.x0 + r.x1) / 2 - r.uy * r.h * 0.35, cy = (r.y0 + r.y1) / 2 + r.ux * r.h * 0.35; return { v, r, cx, cy }; }).filter(Boolean);
            // cotes lues dans les traits : seulement celles au format dominant (même nombre de décimales), une lecture douteuse n'y entre pas
            const dec = {}; num0.forEach(c => { if (c && c.r.glyph) { const k = (String(c.r.s).split(/[.,]/)[1] || '').length; dec[k] = (dec[k] || 0) + 1; } }); const dk = Object.keys(dec).sort((a, b) => dec[b] - dec[a])[0];
            const num = num0.filter(c => c && (!c.r.glyph || (String(c.r.s).split(/[.,]/)[1] || '').length === +dk));
            if (!num.length) return { t: [], m: [], text: tc.items.length > 0 || !!(gl && gl.length), W, H };
            // petits repères : croix, ronds, carrés vectoriels, ou un caractère « + x × • o » écrit en texte
            const mk = []; T.forEach(r => { if (/^[+x×•·●o○⊕⨯✕]$/.test(String(r.s).trim())) mk.push({ x: (r.x0 + r.x1) / 2 - r.uy * r.h * 0.35, y: (r.y0 + r.y1) / 2 + r.ux * r.h * 0.35 }); });
            try { const ops = await page.getOperatorList(), O = pdfjsLib.OPS, st = [], mul = (m, n2) => [m[0] * n2[0] + m[2] * n2[1], m[1] * n2[0] + m[3] * n2[1], m[0] * n2[2] + m[2] * n2[3], m[1] * n2[2] + m[3] * n2[3], m[0] * n2[4] + m[2] * n2[5] + m[4], m[1] * n2[4] + m[3] * n2[5] + m[5]];
                let ctm = [1, 0, 0, 1, 0, 0]; const lone = [], ap = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
                for (let i = 0; i < ops.fnArray.length && mk.length < 60000; i++) { const fn = ops.fnArray[i], ar = ops.argsArray[i];
                    if (fn === O.save) st.push(ctm.slice()); else if (fn === O.restore) ctm = st.pop() || [1, 0, 0, 1, 0, 0]; else if (fn === O.transform) ctm = mul(ctm, ar);
                    else if (fn === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (ar && ar[0]) ctm = mul(ctm, ar[0]); } else if (fn === O.paintFormXObjectEnd) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
                    else if (fn === O.constructPath && ar && ar[0] && ar[1]) {
                        // vrai repère seulement : rond / carré / point (courbe ou contour fermé), ou croix (deux traits courts qui se coupent).
                        // un trait court isolé (tiret d'une ligne pointillée, bout de polyligne) n'en est pas un : il est gardé à part pour former des croix avec un autre
                        const oo = ar[0], cc = ar[1]; let k = 0, cur = null, st0 = null, closed = false, curve = false; const segs = [], pts = [];
                        for (const o of oo) { if (o === 13) { cur = ap(cc[k], cc[k + 1]); st0 = cur; pts.push(cur); k += 2; } else if (o === 14) { const q = ap(cc[k], cc[k + 1]); if (cur) segs.push([cur, q]); cur = q; pts.push(q); k += 2; }
                            else if (o === 15) { curve = true; const q = ap(cc[k + 4], cc[k + 5]); pts.push(ap(cc[k], cc[k + 1]), ap(cc[k + 2], cc[k + 3]), q); cur = q; k += 6; } else if (o === 16 || o === 17) { curve = true; const q = ap(cc[k + 2], cc[k + 3]); pts.push(ap(cc[k], cc[k + 1]), q); cur = q; k += 4; }
                            else if (o === 18) { closed = true; if (cur && st0) segs.push([cur, st0]); cur = st0; } else if (o === 19) { closed = true; const x = cc[k], y = cc[k + 1], w = cc[k + 2], h = cc[k + 3]; [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([a, b]) => pts.push(ap(a, b))); k += 4; } else break; }
                        if (!pts.length) continue; const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys), big = Math.max(bw, bh);
                        if (segs.length >= 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.05 * Math.max(big, 0.1)) closed = true;   // carré tracé en 4 traits
                        if (big < 0.6) { mk.push({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }); continue; }   // « point » de DAO : trait de longueur nulle à bouts ronds
                        if ((curve || closed) && big < 12 && Math.min(bw, bh) > 0.5 * big) { mk.push({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, r: big / 2 }); continue; }
                        const short = segs.filter(sg => { const l = Math.hypot(sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]); return l > 0.6 && l < 12; });
                        if (segs.length >= 2 && short.length === segs.length && big < 12) { const X = pdfSegX(short); if (X) { mk.push(X); continue; } }
                        if (segs.length === 1 && short.length === 1 && lone.length < 200000) lone.push(short[0]); } }
                // croix faites de deux traits séparés : deux traits courts qui se coupent vers leur milieu
                const cell = 6, grid = new Map(); lone.forEach((sg, i) => { const mx = (sg[0][0] + sg[1][0]) / 2, my = (sg[0][1] + sg[1][1]) / 2, key = Math.floor(mx / cell) + ',' + Math.floor(my / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i); });
                const usedL = new Set(); lone.forEach((sg, i) => { if (usedL.has(i)) return; const mx = (sg[0][0] + sg[1][0]) / 2, my = (sg[0][1] + sg[1][1]) / 2, gx = Math.floor(mx / cell), gy = Math.floor(my / cell);
                    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = grid.get((gx + dx) + ',' + (gy + dy)); if (!L) continue; for (const j of L) { if (j <= i || usedL.has(j) || usedL.has(i)) continue; const X = pdfSegX([sg, lone[j]]); if (X) { mk.push(X); usedL.add(i); usedL.add(j); } } } });
            } catch (e) { console.warn('repères PDF', e); }
            // chaque cote prend le repère le plus proche (hors de son propre texte), chaque repère ne sert qu'une fois
            const inTxt = (q, r) => { const dx = q.x - r.x0, dy = q.y - r.y0, a = dx * r.ux + dy * r.uy, b = -dx * r.uy + dy * r.ux; return a > -0.1 * r.h && a < r.w + 0.1 * r.h && b > -0.3 * r.h && b < 1.1 * r.h; };
            // sur un plan de géomètre, le point est au bout de son étiquette (le plus souvent au début, parfois à la fin) : on cherche un repère tout près d'un coin du texte
            const corners = (r) => { const vx = -r.uy * r.h, vy = r.ux * r.h; return [[r.x0, r.y0], [r.x1, r.y1], [r.x0 + vx, r.y0 + vy], [r.x1 + vx, r.y1 + vy]]; };
            const cellM = 8, gM = new Map(); mk.forEach((q, j) => { const k = Math.floor(q.x / cellM) + ',' + Math.floor(q.y / cellM); if (!gM.has(k)) gM.set(k, []); gM.get(k).push(j); });
            const pairs = []; num.forEach((c, i) => { const R = Math.max(1.6 * c.r.h, 1.2), C = corners(c.r), seen = new Set();
                C.forEach(([px, py]) => { const gx = Math.floor(px / cellM), gy = Math.floor(py / cellM); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (gM.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (seen.has(j)) return; seen.add(j); const q = mk[j], d = Math.max(0, Math.min(...C.map(([x, y]) => Math.hypot(q.x - x, q.y - y))) - (q.r || 0));   /* distance au bord du repère (un rond de regard est plus large que le texte) */ if (d < R && !inTxt(q, c.r)) pairs.push([d, i, j]); }); }); });
            pairs.sort((a, b) => a[0] - b[0]); const used = new Set(), got = {}; pairs.forEach(([d, i, j]) => { if (got[i] !== undefined || used.has(j)) return; got[i] = j; used.add(j); });
            const nu = (x, y) => { const p = P(x, y); return [Math.round(p[0] / W * 1e6) / 1e6, Math.round(p[1] / H * 1e6) / 1e6]; };
            return { t: num.map(c => nu(c.r.x0, c.r.y0).concat([c.v, Math.round(c.r.h * 100) / 100])),   /* sans repère : le point d'insertion du texte (début de l'étiquette) */ m: num.map((c, i) => got[i] !== undefined ? nu(mk[got[i]].x, mk[got[i]].y) : null), text: true, W, H };
        }
        // ---- TRACÉS D'UN PLAN PDF : tous les traits vectoriels de la page, avec leur calque d'origine (calques du PDF quand le logiciel de dessin les a gardés), couleur et épaisseur ----
        // résultat : { W, H, L: [noms de calques], P: [{ l, p: [[u, v]…], c: fermé, col, w (pt), f: rempli sans contour }] } ; u, v : 0..1 sur la page, v vers le bas
        async function pdfReadVectors(doc, n) {
            const page = await doc.getPage(n), vp = page.getViewport({ scale: 1 }), W = vp.width, H = vp.height, O = pdfjsLib.OPS, ops = await page.getOperatorList();
            let gg = {}, oc = null; try { oc = await doc.getOptionalContentConfig(); gg = (oc && oc.getGroups && oc.getGroups()) || {}; } catch (e) {}
            const L = ['(sans calque)'], li = new Map(), lay = (nm) => { if (!li.has(nm)) { li.set(nm, L.length); L.push(nm); } return li.get(nm); };
            const mul = (m, n2) => [m[0] * n2[0] + m[2] * n2[1], m[1] * n2[0] + m[3] * n2[1], m[0] * n2[2] + m[2] * n2[3], m[1] * n2[2] + m[3] * n2[3], m[0] * n2[4] + m[2] * n2[5] + m[4], m[1] * n2[4] + m[3] * n2[5] + m[5]];
            const hex = (c) => { if (typeof c === 'string') return c; if (!c) return '#000000'; return '#' + [0, 1, 2].map(i => ('0' + Math.round(+c[i] || 0).toString(16)).slice(-2)).join(''); };
            let gs = { ctm: [1, 0, 0, 1, 0, 0], col: '#000000', fcol: '#000000', w: 1 }; const st = [], mc = [], hid = []; let cur = 0, off = 0, pend = null; const out = [];
            const ap = (x, y) => { const m = gs.ctm; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }, nu = (q) => { const p = vp.convertToViewportPoint(q[0], q[1]); return [Math.round(p[0] / W * 1e6) / 1e6, Math.round(p[1] / H * 1e6) / 1e6]; };
            const bez = (a, b, c, d, out2) => { for (let t = 1; t <= 6; t++) { const u = t / 6, v = 1 - u; out2.push([v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]); } };
            for (let i = 0; i < ops.fnArray.length; i++) { const fn = ops.fnArray[i], ar = ops.argsArray[i];
                if (fn === O.save) st.push(Object.assign({}, gs, { ctm: gs.ctm.slice() })); else if (fn === O.restore) gs = st.pop() || gs; else if (fn === O.transform) gs.ctm = mul(gs.ctm, ar);
                else if (fn === O.paintFormXObjectBegin) { st.push(Object.assign({}, gs, { ctm: gs.ctm.slice() })); if (ar && ar[0]) gs.ctm = mul(gs.ctm, ar[0]); } else if (fn === O.paintFormXObjectEnd) gs = st.pop() || gs;
                else if (fn === O.setStrokeRGBColor) gs.col = hex(ar && (ar.length === 1 ? ar[0] : ar)); else if (fn === O.setFillRGBColor) gs.fcol = hex(ar && (ar.length === 1 ? ar[0] : ar)); else if (fn === O.setLineWidth) gs.w = ar[0];
                else if (fn === O.beginMarkedContentProps) { mc.push(cur); hid.push(off); const g = ar && ar[1] && ar[1].id && gg[ar[1].id]; if (g) { cur = lay(g.name); if (oc && oc.isVisible && !oc.isVisible(ar[1])) off = 1; } }
                else if (fn === O.beginMarkedContent) { mc.push(cur); hid.push(off); } else if (fn === O.endMarkedContent) { cur = mc.length ? mc.pop() : 0; off = hid.length ? hid.pop() : 0; }
                else if (fn === O.constructPath && ar && ar[0] && ar[1]) { const oo = ar[0], cc = ar[1]; let k = 0, p = null, c0 = null; const subs = [];
                    for (const o of oo) { if (o === 13) { p = [ap(cc[k], cc[k + 1])]; subs.push(p); c0 = p[0]; k += 2; } else if (o === 14) { const q = ap(cc[k], cc[k + 1]); if (!p) { p = [q]; subs.push(p); } else p.push(q); k += 2; }
                        else if (o === 15) { if (p) bez(p[p.length - 1], ap(cc[k], cc[k + 1]), ap(cc[k + 2], cc[k + 3]), ap(cc[k + 4], cc[k + 5]), p); k += 6; }
                        else if (o === 16) { if (p) { const a = p[p.length - 1]; bez(a, a, ap(cc[k], cc[k + 1]), ap(cc[k + 2], cc[k + 3]), p); } k += 4; } else if (o === 17) { if (p) { const d = ap(cc[k + 2], cc[k + 3]); bez(p[p.length - 1], ap(cc[k], cc[k + 1]), d, d, p); } k += 4; }
                        else if (o === 18) { if (p && c0) { p.c = 1; } p = null; } else if (o === 19) { const x = cc[k], y = cc[k + 1], w = cc[k + 2], h = cc[k + 3]; const r = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => ap(a, b)); r.c = 1; subs.push(r); p = null; k += 4; } else break; }
                    pend = off ? null : { subs, l: cur, col: gs.col, fcol: gs.fcol, w: gs.w * Math.hypot(gs.ctm[0], gs.ctm[1]) }; }
                else if (pend && (fn === O.stroke || fn === O.closeStroke || fn === O.fillStroke || fn === O.eoFillStroke || fn === O.closeFillStroke || fn === O.closeEOFillStroke || fn === O.fill || fn === O.eoFill)) {
                    const fillOnly = fn === O.fill || fn === O.eoFill, cl = fn === O.closeStroke || fn === O.closeFillStroke || fn === O.closeEOFillStroke;
                    pend.subs.forEach(sp => { if (sp.length < 2 && !(sp.length === 1)) return; out.push({ l: pend.l, p: sp.map(nu), c: sp.c || cl || fillOnly ? 1 : 0, col: fillOnly ? pend.fcol : pend.col, w: Math.round(pend.w * 100) / 100, f: fillOnly ? 1 : 0 }); }); pend = null; }
                else if (fn === O.endPath) pend = null; }
            return { W, H, L, P: out, ocg: L.length > 1 };
        }
        // ---- TALUS D'UN PLAN PDF : reconnus à leurs hachures (traits parallèles, longs et courts alternés, qui partent tous de la tête) ----
        // résultat : [{ h: tête [[u, v]…], p: pied [[u, v]…], n: nombre de hachures }] ; la tête est le côté où les hachures s'alignent, le pied est au bout des longues
        function pdfTalus(V) {
            if (!V || !V.P) return []; const W = V.W, H = V.H, tal = V.ocg && V.L.some(n => /talus/i.test(n));
            // calques de tête et de pied nommés dans le PDF (« Talus haut / bas », « Tal_c / Tal_p »…) : on prend leurs lignes telles quelles, pointillés recousus
            const isH = (n) => /^tal/i.test(n) && /(haut|t[eê]te|cr[eê]te|sup|[-_ ]c$|[-_ ]h$)/i.test(n), isP = (n) => /^tal/i.test(n) && /(bas|pied|inf|[-_ ]p$|[-_ ]b$)/i.test(n);
            if (V.ocg && V.L.some(isH) && V.L.some(isP)) { const out = [], nu = (q) => [q[0] / W, q[1] / H];
                [['h', isH], ['p', isP]].forEach(([k, f]) => { const P = V.P.filter(q => !q.f && q.p.length >= 2 && f(V.L[q.l])).map(q => q.p.map(u => [u[0] * W, u[1] * H]));
                    pdfStitch(P).forEach(pl => { let L = 0; for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); if (L < 8) return; const o = {}; o[k] = rdpSimplify(pl.map(q => ({ x: q[0], y: q[1] })), 0.12).map(q => nu([q.x, q.y])); o.n = 0; out.push(o); }); });
                if (out.length) return out; }
            const T = []; V.P.forEach(q => { if (q.f || q.p.length !== 2 || (tal && !/talus/i.test(V.L[q.l]))) return; const a = [q.p[0][0] * W, q.p[0][1] * H], b = [q.p[1][0] * W, q.p[1][1] * H], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L >= 0.15 && L <= 200) T.push({ a, b, L }); });
            if (T.length < 8) return [];
            const cell = 6, g = new Map(), key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell); T.forEach((t, i) => [t.a, t.b].forEach(e => { const k = key(e[0], e[1]); if (!g.has(k)) g.set(k, new Set()); g.get(k).add(i); }));
            const par = T.map((t, i) => i), find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, adj = T.map(() => []);
            T.forEach((t, i) => { const near = new Set(); [t.a, t.b].forEach(e => { const gx = Math.floor(e[0] / cell), gy = Math.floor(e[1] / cell); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (g.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (j > i) near.add(j); }); });
                near.forEach(j => { const u = T[j], ux = (t.b[0] - t.a[0]) / t.L, uy = (t.b[1] - t.a[1]) / t.L, vx = (u.b[0] - u.a[0]) / u.L, vy = (u.b[1] - u.a[1]) / u.L, cs = ux * vx + uy * vy, sg = cs >= 0 ? 1 : -1;
                    const ea = sg > 0 ? u.a : u.b, eb = sg > 0 ? u.b : u.a, dA = Math.hypot(t.a[0] - ea[0], t.a[1] - ea[1]), dB = Math.hypot(t.b[0] - eb[0], t.b[1] - eb[1]), d = Math.min(dA, dB);
                    if (d < 0.25 || (Math.abs(cs) > 0.85 && d < Math.min(12, 1.6 * Math.max(t.L, u.L)))) { adj[i].push([j, sg]); adj[j].push([i, sg]); par[find(i)] = find(j); } }); });
            const comp = new Map(); T.forEach((t, i) => { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); });
            const out = [], nu = (q) => [q[0] / W, q[1] / H];
            comp.forEach(ids => { if (ids.length < 8) return;
                // même sens pour toutes les hachures du groupe
                const sg = new Map([[ids[0], 1]]), qu = [ids[0]]; while (qu.length) { const i = qu.shift(); adj[i].forEach(([j, s2]) => { if (!sg.has(j)) { sg.set(j, sg.get(i) * s2); qu.push(j); } }); }
                const R = ids.map(i => { const t = T[i]; return sg.get(i) > 0 ? { a: t.a, b: t.b, L: t.L } : { a: t.b, b: t.a, L: t.L }; });
                // côté tête : les bouts alignés sur une ligne (chemin le plus court qui les relie) ; côté pied : bouts en dents de scie (hachures longues et courtes)
                const nnLen = (side) => { const P = R.map(q => q[side]), n = P.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity); let tot = 0, cur = 0; inT[0] = 1;   /* arbre couvrant minimal : longueur de la ligne qui relie ces bouts */
                    for (let k = 1; k < n; k++) { let bj = -1, bd = Infinity; for (let j = 0; j < n; j++) if (!inT[j]) { const d = Math.hypot(P[j][0] - P[cur][0], P[j][1] - P[cur][1]); if (d < best[j]) best[j] = d; if (best[j] < bd) { bd = best[j]; bj = j; } } inT[bj] = 1; tot += bd; cur = bj; } return tot; };
                const lA = nnLen('a'), lB = nnLen('b'), hd = lA <= lB ? 'a' : 'b', ft = hd === 'a' ? 'b' : 'a';
                if (!(Math.max(lA, lB) > 1.15 * Math.min(lA, lB))) return;   // hachures régulières des deux côtés (motif de remplissage) : pas un talus
                // ordre le long de la tête, de proche en proche en partant d'un bout ; un grand saut coupe en deux talus
                const dist = (p, q) => Math.hypot(p[hd][0] - q[hd][0], p[hd][1] - q[hd][1]);
                let rest = R.slice(); while (rest.length >= 8) { let s0 = rest[0], far = -1; rest.forEach(q => { const d = dist(rest[0], q); if (d > far) { far = d; s0 = q; } });
                    const ch = [s0]; rest = rest.filter(q => q !== s0); const steps = [];
                    while (rest.length) { const l = ch[ch.length - 1]; let bj = -1, bd = Infinity; rest.forEach((q, j) => { const d = dist(l, q); if (d < bd) { bd = d; bj = j; } }); const med = steps.length > 4 ? steps.slice().sort((x, y) => x - y)[steps.length >> 1] : 3;
                        if (bd > Math.max(3, 6 * med)) break; steps.push(bd); ch.push(rest[bj]); rest.splice(bj, 1); }
                    if (ch.length < 8) continue;
                    const head = ch.map(q => q[hd]);
                    // pied : bout des longues hachures ; une hachure plus courte que ses voisines longues (milieu de pente, coin) est écartée
                    let F = ch.map((q, k) => ({ q, k })).filter(({ q, k }) => { let m = 0; for (let j = Math.max(0, k - 3); j <= Math.min(ch.length - 1, k + 3); j++) m = Math.max(m, ch[j].L); return q.L >= 0.8 * m; });
                    F = F.filter((f, i) => { const w = F.slice(Math.max(0, i - 4), i + 5).map(x => x.q.L).sort((x, y) => x - y), md = w[w.length >> 1]; return f.q.L >= 0.8 * md; });
                    const foot = F.map(f => f.q[ft]);
                    const simp = (A) => rdpSimplify(A.map(q => ({ x: q[0], y: q[1] })), 0.12).map(q => nu([q.x, q.y]));
                    if (foot.length >= 2) out.push({ h: simp(head), p: simp(foot), n: ch.length }); } });
            return out;
        }
        // traits bout à bout, même en pointillé (trous de moins de deux tirets, sans cassure de direction) : recousus en polylignes
        function pdfStitch(P) { if (!P.length) return []; const lens = P.map(pl => { let L = 0; for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); return L; }).sort((a, b) => a - b), gapT = Math.max(0.5, 2 * lens[lens.length >> 1]);
            const used = new Uint8Array(P.length), dir = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }, out = [];
            const grow = (pl) => { for (let guard = 0; guard < 100000; guard++) { const e = pl[pl.length - 1], de = dir(pl[pl.length - 2], e); let bj = -1, bd = gapT, rev = false;
                    P.forEach((q, j) => { if (used[j]) return; [[q[0], false], [q[q.length - 1], true]].forEach(([s0, r]) => { const d = Math.hypot(s0[0] - e[0], s0[1] - e[1]); if (d >= bd) return; const qq = r ? q.slice().reverse() : q, dq = dir(qq[0], qq[1]), dg = d > 1e-6 ? dir(e, s0) : de;
                        if (de[0] * dq[0] + de[1] * dq[1] > 0.8 && de[0] * dg[0] + de[1] * dg[1] > 0.8) { bd = d; bj = j; rev = r; } }); });
                    if (bj < 0) return pl; used[bj] = 1; const qq = rev ? P[bj].slice().reverse() : P[bj]; pl = pl.concat(Math.hypot(qq[0][0] - pl[pl.length - 1][0], qq[0][1] - pl[pl.length - 1][1]) < 1e-6 ? qq.slice(1) : qq); } return pl; };
            P.forEach((q, i) => { if (used[i]) return; used[i] = 1; let pl = grow(q.slice()); pl = grow(pl.reverse()); out.push(pl); }); return out; }
        // calques du PDF qui portent les données topo (points, altitudes) : jamais importés comme simples traits
        const pdfTopoLayer = (n) => /(geo|topo)[-_ ]?(pts?|points?|alti)|altitude|^alti|points? ?topo|^semis|^matricule/i.test(n || '');
        // traits bout à bout de même calque et même style : recollés en polylignes (moins d'objets, plus maniables)
        function pdfChain(P) {
            const groups = new Map(); P.forEach(q => { const k = q.l + '|' + q.col + '|' + q.w; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }); const out = [];
            groups.forEach(G => { const ends = new Map(), ek = (p) => Math.round(p[0] * 2e5) + ',' + Math.round(p[1] * 2e5), used = new Set();
                G.forEach((q, i) => { if (q.c) return; [0, 1].forEach(e => { const k = ek(e ? q.p[q.p.length - 1] : q.p[0]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); }); });
                const next = (pt) => { const L = ends.get(ek(pt)) || []; return L.find(j => !used.has(j)); };
                G.forEach((q, i) => { if (used.has(i)) return; used.add(i); if (q.c) { out.push(q); return; } let pts = q.p.slice();
                    for (let dir = 0; dir < 2; dir++) { for (let guard = 0; guard < 100000; guard++) { const tail = pts[pts.length - 1], j = next(tail); if (j === undefined) break; used.add(j); const r = G[j].p, fw = ek(r[0]) === ek(tail); pts = pts.concat((fw ? r : r.slice().reverse()).slice(1)); } pts.reverse(); }
                    const cl = pts.length > 3 && ek(pts[0]) === ek(pts[pts.length - 1]); out.push(Object.assign({}, q, { p: cl ? pts.slice(0, -1) : pts, c: cl ? 1 : 0 })); }); });
            return out;
        }
        // deux traits courts qui se croisent franchement (angle > 30°) près de leur milieu : le centre d'une croix ; sinon null
        function pdfSegX(S) { for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) { const [p, q] = S[a], [r, t] = S[b], d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = t[0] - r[0], d2y = t[1] - r[1], den = d1x * d2y - d1y * d2x, l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
            if (Math.abs(den) < Math.sin(Math.PI / 6) * l1 * l2) continue; const u = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / den, v = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / den;
            if (u > 0.25 && u < 0.75 && v > 0.25 && v < 0.75 && Math.abs(l1 - l2) < 0.5 * Math.max(l1, l2)) return { x: p[0] + d1x * u, y: p[1] + d1y * u }; } return null; }
        // ---- TEXTES DESSINÉS EN TRAITS : beaucoup de plans de DAO écrivent cotes et coordonnées avec une police filaire, chaque lettre en petits traits (pas du vrai texte PDF).
        // On les relit : traits qui se touchent = un caractère ; caractères alignés et rapprochés = un mot ; chaque caractère comparé à des gabarits de chiffres.
        const GLYPH_T = (() => { const D = Math.PI, arc = (cx, cy, rx, ry, a0, a1, n = 12) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; };
            const six = [arc(.5, .5, .5, .5, .3 * D, D, 8).concat([[0, .3]], arc(.5, .3, .5, .3, D, 3 * D, 16))], rot = (S) => S.map(st => st.map(([x, y]) => [1 - x, 1 - y]));
            const T = { '0': [arc(.5, .5, .5, .5, 0, 2 * D, 24)], '0b': [[[0, .25], [0, .75]].concat(arc(.5, .75, .5, .25, D, 0, 8), [[1, .25]], arc(.5, .25, .5, .25, 0, -D, 8))],
                '1b': [[[.15, .78], [.6, 1], [.6, 0]], [[.1, 0], [1, 0]]], '2': [arc(.5, .72, .5, .28, D, 0, 10).concat([[0, 0], [1, 0]])], '2b': [arc(.5, .72, .5, .28, .95 * D, -.25 * D, 10).concat([[0, 0], [1, 0]])],
                '3': [arc(.5, .76, .5, .24, .85 * D, -.5 * D, 12), arc(.5, .27, .5, .27, .5 * D, -.85 * D, 12)], '3b': [[[0, 1], [.5, 1]].concat(arc(.5, .76, .5, .24, .5 * D, -.5 * D, 8), [[.25, .52]]), arc(.5, .27, .5, .27, .5 * D, -.5 * D, 8).concat([[0, 0]])],
                '3c': [[[0, 1], [1, 1], [.4, .58]].concat(arc(.5, .29, .5, .29, .5 * D, -.85 * D, 10))],
                '4': [[[.7, 0], [.7, 1], [0, .3], [1, .3]]], '4b': [[[.42, 1], [0, .25], [1, .25]], [[.72, .5], [.72, 0]]],
                '5': [[[1, 1], [.08, 1], [0, .56]].concat(arc(.5, .33, .5, .33, .75 * D, -.8 * D, 12))], '6': six, '9': rot(six), '7': [[[0, 1], [1, 1], [.35, 0]]], '7b': [[[0, 1], [1, 1], [.5, .45], [.4, 0]]],
                '8': [arc(.5, .76, .42, .24, 0, 2 * D, 16), arc(.5, .27, .5, .27, 0, 2 * D, 16)], '/': [[[0, 0], [1, 1]]], '%': [[[0, 0], [1, 1]], arc(.2, .8, .2, .2, 0, 2 * D, 8), arc(.8, .2, .2, .2, 0, 2 * D, 8)] };
            const out = []; for (const k in T) out.push({ c: k[0], r: glyphRaster(T[k]) }); return out; })();
        // image 12 × 18 d'un caractère (traits en coordonnées 0..1, y vers le haut), traits épaissis : base de comparaison
        function glyphRaster(S) { const W = 12, H = 18, r = new Float32Array(W * H), segs = []; S.forEach(st => { for (let i = 1; i < st.length; i++) segs.push([1.5 + st[i - 1][0] * 9, 1.5 + (1 - st[i - 1][1]) * 15, 1.5 + st[i][0] * 9, 1.5 + (1 - st[i][1]) * 15]); if (st.length === 1) segs.push([1.5 + st[0][0] * 9, 1.5 + (1 - st[0][1]) * 15, 1.5 + st[0][0] * 9, 1.5 + (1 - st[0][1]) * 15]); });
            for (const [ax, ay, bx, by] of segs) { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.7) + 1; for (let k = 0; k < n; k++) { const f = n > 1 ? k / (n - 1) : 0, px = ax + (bx - ax) * f, py = ay + (by - ay) * f;   /* trait épaissi : chaque point du trait marque ses voisins */
                for (let y = Math.max(0, Math.floor(py - 2.7)); y <= Math.min(H - 1, Math.floor(py + 2.2)); y++) for (let x = Math.max(0, Math.floor(px - 2.7)); x <= Math.min(W - 1, Math.floor(px + 2.2)); x++) { const v = 1 - Math.hypot(x + .5 - px, y + .5 - py) / 2.2; if (v > r[y * W + x]) r[y * W + x] = v; } } }
            let n2 = 0; for (let i = 0; i < r.length; i++) n2 += r[i] * r[i]; n2 = Math.sqrt(n2) || 1; for (let i = 0; i < r.length; i++) r[i] /= n2; return r; }
        function glyphClass(S, w, hh, h, tc) {
            // S : traits du caractère dans le repère du mot (s le long, t vers le haut, base = 0) ; w, hh : sa boîte ; h : hauteur des chiffres du mot ; tc : milieu en t
            if (hh < 0.3 * h && w < 0.4 * h) return tc < 0.38 * h ? ['.', 1] : ['?', 0];
            if (hh < 0.3 * h) return tc > 0.25 * h && tc < 0.75 * h ? ['-', 0.9] : ['?', 0];
            if (hh < 0.72 * h) return ['?', 0];
            if (w < 0.3 * h) { const ok = S.some(st => st.length >= 2 && Math.abs(st[st.length - 1][1] - st[0][1]) > 0.7 * hh); return ok ? ['1', 0.95] : ['?', 0]; }
            let s0 = Infinity, t0 = Infinity; S.forEach(st => st.forEach(p => { s0 = Math.min(s0, p[0]); t0 = Math.min(t0, p[1]); }));
            const R = glyphRaster(S.map(st => st.map(p => [(p[0] - s0) / w, (p[1] - t0) / hh]))); let best = '?', bs = 0, sec = 0;
            GLYPH_T.forEach(g => { let sc = 0; for (let i = 0; i < R.length; i++) sc += R[i] * g.r[i]; if (g.c === best) { if (sc > bs) bs = sc; return; } if (sc > bs) { if (best !== '?') sec = Math.max(sec, bs); bs = sc; best = g.c; } else if (sc > sec) sec = sc; });
            return bs >= 0.74 && bs - sec >= 0.015 ? [best, bs] : ['?', bs]; }
        // runs de texte filaire : [{ s, x0, y0, x1, y1, ux, uy, h, w }] en points de la page vue (y vers le bas), comme pdfRuns
        function pdfGlyphRuns(V) {
            if (!V || !V.P) return []; const W = V.W, H = V.H, K = [];
            V.P.forEach(q => { if (q.f || q.p.length > 80) return; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const pts = q.p.map(u => { const x = u[0] * W, y = u[1] * H; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; return [x, y]; });
                const m = Math.max(x1 - x0, y1 - y0); if (m > 30) return; K.push({ pts, x0, y0, x1, y1, m, w: q.w || 0, l: q.l || 0 }); });
            if (K.length < 3 || K.length > 400000) return [];
            // 1. traits qui se touchent ou se croisent : un même caractère
            const par = K.map((k, i) => i), find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, cell = 4, g = new Map();
            K.forEach((k, i) => { for (let gx = Math.floor(k.x0 / cell); gx <= Math.floor(k.x1 / cell); gx++) for (let gy = Math.floor(k.y0 / cell); gy <= Math.floor(k.y1 / cell); gy++) { const kk = gx + ',' + gy; if (!g.has(kk)) g.set(kk, []); g.get(kk).push(i); } });
            const sd = (a, b, c, d) => { const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1], den = ux * vy - uy * vx; if (Math.abs(den) > 1e-12) { const t = ((c[0] - a[0]) * vy - (c[1] - a[1]) * vx) / den, u = ((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0; }
                const pd = (p, a2, b2) => { const dx = b2[0] - a2[0], dy = b2[1] - a2[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a2[0]) * dx + (p[1] - a2[1]) * dy) / l2)) : 0; return Math.hypot(a2[0] + t * dx - p[0], a2[1] + t * dy - p[1]); }; return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b)); };
            const touch = (A, B, eps) => { if (A.x0 > B.x1 + eps || B.x0 > A.x1 + eps || A.y0 > B.y1 + eps || B.y0 > A.y1 + eps) return false; const P = A.pts.length > 1 ? A.pts : [A.pts[0], A.pts[0]], Q = B.pts.length > 1 ? B.pts : [B.pts[0], B.pts[0]];
                for (let i = 1; i < P.length; i++) for (let j = 1; j < Q.length; j++) if (sd(P[i - 1], P[i], Q[j - 1], Q[j]) < eps) return true; return false; };
            g.forEach(L => { if (L.length > 400) return; for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const i = L[a], j = L[b]; if (find(i) === find(j)) continue; const A = K[i], Bq = K[j]; if (A.l !== Bq.l) continue; const ln = (k) => k.pts.length === 2 ? k.m : 0; if (ln(A) > 1.5 * Bq.m || ln(Bq) > 1.5 * A.m) continue;   /* un long trait droit qui passe sur une lettre n'en fait pas partie */
                if (touch(A, Bq, Math.max(0.1, 0.6 * Math.min(A.w, Bq.w, 1.5)))) par[find(i)] = find(j);   /* tracés à la même plume : ils se touchent à l'épaisseur du trait près */ } });
            const cm = new Map(); K.forEach((k, i) => { const r = find(i); if (!cm.has(r)) cm.set(r, []); cm.get(r).push(k); });
            const C = []; cm.forEach(L => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; L.forEach(k => { x0 = Math.min(x0, k.x0); y0 = Math.min(y0, k.y0); x1 = Math.max(x1, k.x1); y1 = Math.max(y1, k.y1); }); const sz = Math.max(x1 - x0, y1 - y0); if (sz <= 30 && L.length <= 40) C.push({ S: L.map(k => k.pts), x0, y0, x1, y1, sz, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, l: L[0].l }); });   /* un texte et les traits d'un autre calque ne se mélangent pas */
            // 2. caractères voisins, de taille voisine (un point décimal est petit) : un mot
            const wp = C.map((c, i) => i), wf = (i) => { while (wp[i] !== i) { wp[i] = wp[wp[i]]; i = wp[i]; } return i; }, cell2 = 8, g2 = new Map();
            C.forEach((c, i) => { const kk = Math.floor(c.cx / cell2) + ',' + Math.floor(c.cy / cell2); if (!g2.has(kk)) g2.set(kk, []); g2.get(kk).push(i); });
            C.forEach((c, i) => { const gx = Math.floor(c.cx / cell2), gy = Math.floor(c.cy / cell2); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (g2.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (j <= i) return; const d = C[j]; if (c.l !== d.l) return; const M = Math.max(c.sz, d.sz), mn = Math.min(c.sz, d.sz);
                const gap = Math.hypot(Math.max(0, c.x0 - d.x1, d.x0 - c.x1), Math.max(0, c.y0 - d.y1, d.y0 - c.y1));
                if (M <= 1.8 * mn) { if (gap < 1.0 * M) { (c.nb = c.nb || []).push({ j, gap, a: Math.atan2(d.cy - c.cy, d.cx - c.cx) }); (d.nb = d.nb || []).push({ j: i, gap, a: Math.atan2(c.cy - d.cy, c.cx - d.cx) }); } }
                else if (mn < 0.4 * M && gap < 0.5 * M) { const sm = c.sz < d.sz ? i : j, bg = sm === i ? j : i; if (!C[sm].att || C[sm].att.g > gap) C[sm].att = { g: gap, j: bg }; } }); });
            // un caractère garde au plus deux voisins, de part et d'autre sur une même ligne : les mots ne se mélangent pas aux traits pointillés ni aux étiquettes voisines
            C.forEach(c => { const N = c.nb || []; let best = null; for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) { let df = Math.abs(N[a].a - N[b].a); if (df > Math.PI) df = 2 * Math.PI - df; if (Math.abs(df - Math.PI) < 0.4) { const g2 = N[a].gap + N[b].gap; if (!best || g2 < best.g) best = { g: g2, k: [N[a].j, N[b].j] }; } }
                if (!best && N.length) { const n0 = N.slice().sort((x, y) => x.gap - y.gap)[0]; best = { k: [n0.j] }; } c.keep = new Set(best ? best.k : []); });
            C.forEach((c, i) => c.keep.forEach(j => { if (C[j].keep.has(i)) wp[wf(i)] = wf(j); }));
            // petit signe (point décimal…) : rattaché au seul caractère le plus proche, s'il n'a pas de voisin de sa taille
            const cnt = new Map(); C.forEach((c, i) => { const r = wf(i); cnt.set(r, (cnt.get(r) || 0) + 1); }); C.forEach((c, i) => { if (c.att && cnt.get(wf(i)) === 1) wp[i] = wf(c.att.j); });
            const wm = new Map(); C.forEach((c, i) => { const r = wf(i); if (!wm.has(r)) wm.set(r, []); wm.get(r).push(c); });
            const out = [];
            wm.forEach(L => { if (L.length < 3 || L.length > 24) return; const M = Math.max(...L.map(c => c.sz)), big = L.filter(c => c.sz >= 0.45 * M); if (big.length < 2 || big.every(c => c.S.length === 1 && c.S[0].length === 2)) return;   /* que des traits droits isolés (hachures) : pas un mot */
                // sens d'écriture : direction médiane entre chaque caractère et son plus proche voisin (un trait parasite ne la fausse pas)
                let ca = 0, sa = 0; big.forEach(c => { let bd = Infinity, bq = null; big.forEach(d => { if (d === c) return; const e = Math.hypot(d.cx - c.cx, d.cy - c.cy); if (e < bd) { bd = e; bq = d; } }); if (bq) { const a = 2 * Math.atan2(bq.cy - c.cy, bq.cx - c.cx); ca += Math.cos(a); sa += Math.sin(a); } });
                const th = 0.5 * Math.atan2(sa, ca); let best = null;
                [1, -1].forEach(sg => { const dx = Math.cos(th) * sg, dy = Math.sin(th) * sg, ux = dy, uy = -dx;   /* vers le haut du texte, page en y vers le bas */
                    const F = L.map(c => { let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity; const S = c.S.map(st => st.map(p => { const s = p[0] * dx + p[1] * dy, t = p[0] * ux + p[1] * uy; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); return [s, t]; })); return { S, s0, s1, t0, t1, big: c.sz >= 0.45 * M }; });
                    const B = F.filter(f => f.big), hs = B.map(f => f.t1 - f.t0).sort((a, b) => a - b), h = hs[hs.length >> 1], bs = B.map(f => f.t0).sort((a, b) => a - b), base = bs[bs.length >> 1];
                    if (!(h > 0)) return; B.forEach(f => { if (Math.abs(f.t0 - base) > 0.3 * h || Math.abs(f.t1 - f.t0 - h) > 0.3 * h) f.out = 1; });   // hors de la ligne d'écriture : un trait voisin, pas une lettre
                    F.sort((a, b) => a.s0 - b.s0); let str = '', sc = 0, nb = 0, prev = null; const segs = [], iB = F.findIndex(f => f.big), jB = F.length - 1 - F.slice().reverse().findIndex(f => f.big);
                    F.forEach((f, fi) => { if (!f.big && (fi < iB || fi > jB)) { if (prev !== null && f.s0 - prev > 0.9 * h) str += ' '; str += '?'; segs.push([f.s0, f.s1]); prev = f.s1; return; }   /* petit signe avant ou après le mot (repère du point) : pas un caractère */ if (f.out) return; const S2 = f.S.map(st => st.map(p => [p[0], p[1] - base])), [ch, s2] = glyphClass(S2, f.s1 - f.s0, f.t1 - f.t0, h, (f.t0 + f.t1) / 2 - base); if (ch === '.') sc += 0.08; if (ch === '?' && !f.big) return;   /* petit trait parasite dans le mot : ignoré */ if (prev !== null && f.s0 - prev > 0.55 * h) str += ' '; str += ch; segs.push([f.s0, f.s1]); prev = f.s1; if (f.big) { sc += s2; nb++; } });
                    const q = { str, sc: nb ? sc / nb : 0, F, segs, dx, dy, ux, uy, h, base }; if (!best || q.sc > best.sc) best = q; });
                if (!best || best.sc < 0.6) return;
                // morceaux lisibles (chiffres, point, barre) : chacun devient un run
                const re = /[0-9.\/%]+/g; let m; const chars = best.str.replace(/ /g, ''); let k = 0; const map = []; for (let i = 0; i < best.str.length; i++) if (best.str[i] !== ' ') map.push(k++); else map.push(-1);
                const spaced = best.str; while ((m = re.exec(spaced))) { const a = m.index, b = a + m[0].length - 1; let ia = map[a], ib = map[b]; if (ia < 0 || ib < 0) continue; if (!/\d/.test(m[0]) || /^1{3,}$/.test(m[0])) continue;   /* une rangée de hachures se lit « 1111 » : pas un nombre */
                    const s0 = best.segs[ia][0], s1 = best.segs[ib][1], P = (s, t) => [s * best.dx + t * best.ux, s * best.dy + t * best.uy], A = P(s0, best.base), Bp = P(s1, best.base);
                    out.push({ s: m[0], x0: A[0], y0: A[1], x1: Bp[0], y1: Bp[1], ux: best.dx, uy: best.dy, h: best.h, w: s1 - s0, glyph: 1 }); } void chars; });
            return out;
        }
        // ---- TEXTES DESSINÉS EN CONTOURS PLEINS : certains logiciels écrivent les cotes avec une vraie police convertie en dessins (chaque chiffre = un ou
        //      plusieurs contours fermés remplis : le « 0 » a son trou, le « 8 » ses deux). On regroupe les contours d'un même caractère, on le dessine en petit
        //      et on le compare aux chiffres de quelques polices dessinés de la même façon. Mêmes runs que pdfGlyphRuns.
        let FILL_T = null;
        function fillGlyphTemplates() { if (FILL_T) return FILL_T; FILL_T = []; const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; const g = cv.getContext('2d', { willReadFrequently: true });
            ['Century Gothic', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'sans-serif', 'monospace', 'serif'].forEach(f => { '0123456789'.split('').forEach(ch => { g.clearRect(0, 0, 160, 160); g.fillStyle = '#000'; g.font = '120px ' + (f.includes(' ') ? '"' + f + '"' : f); g.textBaseline = 'alphabetic'; g.fillText(ch, 20, 135);
                const d = g.getImageData(0, 0, 160, 160).data; let x0 = 160, y0 = 160, x1 = -1, y1 = -1; for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) if (d[(y * 160 + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                if (x1 < x0) return; FILL_T.push({ c: ch, ar: (x1 - x0 + 1) / (y1 - y0 + 1), r: fillGridFrom(d, 160, x0, y0, x1, y1) }); }); }); return FILL_T; }
        // grille 12 × 18 (moyenne de couverture), normée, à partir d'une image RGBA et de la boîte de l'encre
        function fillGridFrom(d, W0, x0, y0, x1, y1) { const GW = 12, GH = 18, r = new Float32Array(GW * GH), bw = x1 - x0 + 1, bh = y1 - y0 + 1;
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = d[(y * W0 + x) * 4 + 3] / 255; if (!a) continue; const gx = Math.min(GW - 1, Math.floor((x - x0) / bw * GW)), gy = Math.min(GH - 1, Math.floor((y - y0) / bh * GH)); r[gy * GW + gx] += a; }
            let n2 = 0; for (let i = 0; i < r.length; i++) n2 += r[i] * r[i]; n2 = Math.sqrt(n2) || 1; for (let i = 0; i < r.length; i++) r[i] /= n2; return r; }
        let FILL_CV = null;
        function fillGlyphClass(S, s0, t0, w, hh) {   // S : contours du caractère dans le repère du mot (s le long, t vers le haut)
            const T = fillGlyphTemplates(); if (!T.length) return ['?', 0]; const N = 64; if (!FILL_CV) { FILL_CV = document.createElement('canvas'); FILL_CV.width = N; FILL_CV.height = N; } const g = FILL_CV.getContext('2d', { willReadFrequently: true });
            const k = (N - 4) / Math.max(w, hh); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N); g.fillStyle = '#000'; g.beginPath();
            S.forEach(c => { c.forEach((p, i) => { const x = 2 + (p[0] - s0) * k, y = 2 + (hh - (p[1] - t0)) * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }); g.fill('evenodd');
            const d = g.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = -1, y1 = -1; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            if (x1 < x0) return ['?', 0]; const R = fillGridFrom(d, N, x0, y0, x1, y1), ar = w / Math.max(hh, 1e-9); let best = '?', bs = -9, sec = -9;
            if (ar < 0.45 && S.length === 1) return ['1', 0.95];   // chiffre étroit d'un seul contour : un « 1 »
            // nombre de trous (contours) : 1 → 1 2 3 4 5 7 ; 2 → 0 4 6 9 ; 3 → 8
            const ok = S.length === 1 ? '123457' : S.length === 2 ? '0469' : S.length === 3 ? '8' : '';
            T.forEach(t => { if (!ok.includes(t.c)) return; let sc = 0; for (let i = 0; i < R.length; i++) sc += R[i] * t.r[i]; sc -= 0.35 * Math.abs(Math.log(Math.max(0.05, ar) / t.ar)); if (t.c === best) { if (sc > bs) bs = sc; return; } if (sc > bs) { if (best !== '?') sec = Math.max(sec, bs); bs = sc; best = t.c; } else if (sc > sec) sec = sc; });
            return (bs >= 0.8 && bs - sec >= 0.003) || (bs >= 0.68 && bs - sec >= 0.01) ? [best, bs] : ['?', bs]; }
        function pdfFillGlyphRuns(V) {
            if (!V || !V.P) return []; const W = V.W, H = V.H, K = [];
            V.P.forEach(q => { if (!q.f || !q.c || q.p.length < 3 || q.p.length > 600) return; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const pts = q.p.map(u => { const x = u[0] * W, y = u[1] * H; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; return [x, y]; });
                const m = Math.max(x1 - x0, y1 - y0); if (m > 25 || m < 0.05) return; K.push({ pts, x0, y0, x1, y1, m, l: q.l || 0 }); });
            if (K.length < 3 || K.length > 300000) return [];
            // 1. contours d'un même caractère : boîtes qui se recouvrent nettement (le trou d'un « 0 » est dans son contour)
            const par = K.map((k, i) => i), find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, cell = 3, gr = new Map();
            K.forEach((k, i) => { const kk = Math.floor((k.x0 + k.x1) / 2 / cell) + ',' + Math.floor((k.y0 + k.y1) / 2 / cell); if (!gr.has(kk)) gr.set(kk, []); gr.get(kk).push(i); });
            K.forEach((a, i) => { const gx = Math.floor((a.x0 + a.x1) / 2 / cell), gy = Math.floor((a.y0 + a.y1) / 2 / cell); for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) (gr.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (j <= i) return; const b = K[j]; if (a.l !== b.l) return;
                const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (ix <= 0 || iy <= 0) return; const ar = (k) => Math.max(1e-6, (k.x1 - k.x0) * (k.y1 - k.y0)); if (ix * iy > 0.6 * Math.min(ar(a), ar(b))) par[find(i)] = find(j); }); });
            const cm = new Map(); K.forEach((k, i) => { const r = find(i); if (!cm.has(r)) cm.set(r, []); cm.get(r).push(k); });
            const C = []; cm.forEach(L => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; L.forEach(k => { x0 = Math.min(x0, k.x0); y0 = Math.min(y0, k.y0); x1 = Math.max(x1, k.x1); y1 = Math.max(y1, k.y1); }); if (L.length > 4) return; C.push({ S: L.map(k => k.pts), x0, y0, x1, y1, sz: Math.max(x1 - x0, y1 - y0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, l: L[0].l }); });
            // 2. mots : caractères voisins de même taille (le point décimal, petit, se rattache au plus proche)
            const MS = C.map(c => c.sz).sort((a, b) => a - b), wp = C.map((c, i) => i), wf = (i) => { while (wp[i] !== i) { wp[i] = wp[wp[i]]; i = wp[i]; } return i; }, cell2 = Math.max(4, Math.min(25, 1.6 * (MS[Math.floor(MS.length * 0.9)] || 6))), g2 = new Map();
            C.forEach((c, i) => { const kk = Math.floor(c.cx / cell2) + ',' + Math.floor(c.cy / cell2); if (!g2.has(kk)) g2.set(kk, []); g2.get(kk).push(i); });
            C.forEach((c, i) => { const gx = Math.floor(c.cx / cell2), gy = Math.floor(c.cy / cell2); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (g2.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (j <= i) return; const d = C[j]; if (c.l !== d.l) return; const M = Math.max(c.sz, d.sz), mn = Math.min(c.sz, d.sz);
                const gap = Math.hypot(Math.max(0, c.x0 - d.x1, d.x0 - c.x1), Math.max(0, c.y0 - d.y1, d.y0 - c.y1));
                if (M <= 1.8 * mn) { if (gap < 1.0 * M) wp[wf(i)] = wf(j); } else if (mn < 0.45 * M && gap < 0.45 * M) { const sm = c.sz < d.sz ? c : d; if (!sm.att || sm.att.g > gap) sm.att = { g: gap, j: sm === c ? j : i }; } }); });
            const cnt = new Map(); C.forEach((c, i) => { const r = wf(i); cnt.set(r, (cnt.get(r) || 0) + 1); }); C.forEach((c, i) => { if (c.att && cnt.get(wf(i)) === 1) wp[wf(i)] = wf(c.att.j); });
            const wm = new Map(); C.forEach((c, i) => { const r = wf(i); if (!wm.has(r)) wm.set(r, []); wm.get(r).push(c); });
            const out = [];
            wm.forEach(L => { if (L.length < 3 || L.length > 16) return; const M = Math.max(...L.map(c => c.sz)), big = L.filter(c => c.sz >= 0.5 * M); if (big.length < 2) return;
                let ca = 0, sa = 0; big.forEach(c => { let bd = Infinity, bq = null; big.forEach(d => { if (d === c) return; const e = Math.hypot(d.cx - c.cx, d.cy - c.cy); if (e < bd) { bd = e; bq = d; } }); if (bq) { const a = 2 * Math.atan2(bq.cy - c.cy, bq.cx - c.cx); ca += Math.cos(a); sa += Math.sin(a); } });
                const th = 0.5 * Math.atan2(sa, ca); let best = null;
                [1, -1].forEach(sg => { const dx = Math.cos(th) * sg, dy = Math.sin(th) * sg, ux = dy, uy = -dx;
                    const F = L.map(c => { let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity; const S = c.S.map(st => st.map(p => { const s = p[0] * dx + p[1] * dy, t = p[0] * ux + p[1] * uy; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); return [s, t]; })); return { S, s0, s1, t0, t1, big: c.sz >= 0.5 * M }; });
                    const B = F.filter(f => f.big), hs = B.map(f => f.t1 - f.t0).sort((a, b) => a - b), h = hs[hs.length >> 1], bs = B.map(f => f.t0).sort((a, b) => a - b), base = bs[bs.length >> 1]; if (!(h > 0)) return;
                    F.sort((a, b) => a.s0 - b.s0); let str = '', sc = 0, nb = 0; const segs = [], iB = F.findIndex(f => f.big), jB = F.length - 1 - F.slice().reverse().findIndex(f => f.big);
                    F.forEach((f, fi) => { const hh = f.t1 - f.t0, w = f.s1 - f.s0, tc = (f.t0 + f.t1) / 2 - base;
                        if (!f.big && (fi < iB || fi > jB)) { str += '?'; segs.push([f.s0, f.s1]); return; }   // petit signe avant ou après le mot (repère du point) : pas un caractère
                        if (!f.big || hh < 0.45 * h) { str += (hh < 0.35 * h && w < 0.45 * h && tc < 0.35 * h) ? '.' : '?'; segs.push([f.s0, f.s1]); return; }
                        if (Math.abs(f.t0 - base) > 0.3 * h) { str += '?'; segs.push([f.s0, f.s1]); return; }
                        const [ch, s2] = fillGlyphClass(f.S, f.s0, f.t0, w, hh); str += ch; segs.push([f.s0, f.s1]); sc += Math.max(0, s2); nb++; });
                    const q = { str, sc: nb ? sc / nb : 0, segs, dx, dy, ux, uy, h, base }; if (!best || q.sc > best.sc) best = q; });
                if (!best || best.sc < 0.6) return; const re = /[0-9.]+/g; let m;
                while ((m = re.exec(best.str))) { if (!/\d/.test(m[0])) continue; const a = m.index, b2 = a + m[0].length - 1, s0 = best.segs[a][0], s1 = best.segs[b2][1], P = (s2, t) => [s2 * best.dx + t * best.ux, s2 * best.dy + t * best.uy], A = P(s0, best.base), Bp = P(s1, best.base);
                    out.push({ s: m[0], x0: A[0], y0: A[1], x1: Bp[0], y1: Bp[1], ux: best.dx, uy: best.dy, h: best.h, w: s1 - s0, glyph: 1 }); } });
            return out;
        }
        // runs filaires passés dans le repère du PDF (y vers le haut), pour se mêler aux vrais textes
        function pdfGlyphToPdf(R, vp) { return R.map(r => { const a = vp.convertToPdfPoint(r.x0, r.y0), b = vp.convertToPdfPoint(r.x1, r.y1), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            let ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; if (L < 1e-6) { const c = vp.convertToPdfPoint(r.x0 + r.ux, r.y0 + r.uy); ux = c[0] - a[0]; uy = c[1] - a[1]; }
            return { s: r.s, x0: a[0], y0: a[1], x1: b[0], y1: b[1], ux, uy, h: r.h, w: r.w, glyph: 1 }; }); }
        // ---- CARROYAGE D'UN PLAN PDF : coordonnées écrites au bord du cadre (« 1881. » + « 150 » = 1 881 150 m) et croix du quadrillage.
        // Sert à caler le fond tout seul : position, rotation et échelle, dans le système du plan (CC44, Lambert 93…). u, v : 0..1 sur la page, v vers le bas.
        async function pdfReadGrid(doc, n, gl) {
            const page = await doc.getPage(n), vp = page.getViewport({ scale: 1 }), W = vp.width, H = vp.height, nu = (x, y) => { const p = vp.convertToViewportPoint(x, y); return [p[0] / W, p[1] / H]; };
            const tc = await page.getTextContent(), it = pdfRuns(tc).concat(gl && gl.length ? pdfGlyphToPdf(gl, vp) : []).map(t => ({ s: String(t.s).replace(/\s+/g, ''), x: t.x0, y: t.y0, ux: t.ux, uy: t.uy, h: t.h, w: t.w }));
            const all = it.map(t => t.s).join(' '), mC = all.match(/(?:RGF93|Lambert)?[-\s]*(CC\s?4[2-9]|CC\s?50|Lambert[-\s]?93|L93)/i);
            let crs = mC ? (/CC/i.test(mC[1]) ? 'CC' + mC[1].replace(/\D/g, '') : 'L93') : null;
            const mE = all.match(/\b1\s*[\/:]\s*(\d{2,5})\b/); const ech = mE ? +mE[1] : null;
            // coordonnées : écrites d'un bloc, ou en deux morceaux (kilomètres en gros, mètres en petit)
            const labs = []; it.forEach((t, i) => { let v = null; const m1 = t.s.match(/^(?:[XYEN]=?)?(\d{6,7}(?:[.,]\d{1,3})?)$/i); if (m1) v = parseFloat(m1[1].replace(',', '.'));
                const m2 = t.s.match(/^(\d{3,4})[.,]$/); if (m2) { const nx = it.slice(i + 1, i + 4).find(q => /^\d{3}$/.test(q.s) && Math.hypot(q.x - (t.x + t.ux * t.w), q.y - (t.y + t.uy * t.w)) < 1.5 * t.h); if (nx) v = (+m2[1]) * 1000 + (+nx.s); }
                const m3 = t.s.match(/^(\d{3,4})[.,](\d{3})$/); if (m3 && t.h > 2) v = (+m3[1]) * 1000 + (+m3[2]);
                if (v !== null && v > 5e4) labs.push({ v, x: t.x + t.ux * t.w / 2 - t.uy * t.h * 0.3, y: t.y + t.uy * t.w / 2 + t.ux * t.h * 0.3, ang: Math.atan2(t.uy, t.ux) }); });
            // croix du quadrillage : deux traits de 3 à 40 pt qui se coupent en leur milieu
            const cx = []; try { const ops = await page.getOperatorList(), O = pdfjsLib.OPS, st = [], mul = (m, n2) => [m[0] * n2[0] + m[2] * n2[1], m[1] * n2[0] + m[3] * n2[1], m[0] * n2[2] + m[2] * n2[3], m[1] * n2[2] + m[3] * n2[3], m[0] * n2[4] + m[2] * n2[5] + m[4], m[1] * n2[4] + m[3] * n2[5] + m[5]];
                let ctm = [1, 0, 0, 1, 0, 0]; const ap = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]], lone = [];
                for (let i = 0; i < ops.fnArray.length; i++) { const fn = ops.fnArray[i], ar = ops.argsArray[i];
                    if (fn === O.save) st.push(ctm.slice()); else if (fn === O.restore) ctm = st.pop() || [1, 0, 0, 1, 0, 0]; else if (fn === O.transform) ctm = mul(ctm, ar);
                    else if (fn === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (ar && ar[0]) ctm = mul(ctm, ar[0]); } else if (fn === O.paintFormXObjectEnd) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
                    else if (fn === O.constructPath && ar && ar[0] && ar[1]) { const oo = ar[0], cc = ar[1]; let k = 0, cur = null; const segs = []; let ok = true;
                        for (const o of oo) { if (o === 13) { cur = ap(cc[k], cc[k + 1]); k += 2; } else if (o === 14) { const q = ap(cc[k], cc[k + 1]); if (cur) segs.push([cur, q]); cur = q; k += 2; } else { ok = false; break; } }
                        if (!ok) continue; const sh = segs.filter(sg => { const l = Math.hypot(sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]); return l >= 3 && l <= 40; });
                        if (segs.length >= 2 && sh.length === segs.length) { const X = pdfSegX(sh); if (X) cx.push(X); } else if (segs.length === 1 && sh.length === 1) lone.push(sh[0]); } }
                const g = new Map(), cell = 40; lone.forEach((sg, i) => { const k = Math.floor((sg[0][0] + sg[1][0]) / 2 / cell) + ',' + Math.floor((sg[0][1] + sg[1][1]) / 2 / cell); if (!g.has(k)) g.set(k, []); g.get(k).push(i); });
                const used = new Set(); lone.forEach((sg, i) => { if (used.has(i)) return; const gx = Math.floor((sg[0][0] + sg[1][0]) / 2 / cell), gy = Math.floor((sg[0][1] + sg[1][1]) / 2 / cell);
                    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (g.get((gx + dx) + ',' + (gy + dy)) || []).forEach(j => { if (j <= i || used.has(j) || used.has(i)) return; const X = pdfSegX([sg, lone[j]]); if (X) { cx.push(X); used.add(i); used.add(j); } }); });
            } catch (e) { console.warn('carroyage', e); }
            return { crs, ech, lab: labs.map(l => nu(l.x, l.y).concat([l.v, Math.round(l.ang * 1000) / 1000])), cx: cx.map(q => nu(q.x, q.y)), W, H };
        }
        // calage par le carroyage : ajustement page → coordonnées réelles (dans le système du PDF), puis passage dans le système du plan. null si le carroyage ne suffit pas
        // système du carroyage deviné sur ses valeurs : Y de 6 à 7,2 millions = Lambert 93, sinon la zone CC dont le Y est le plus proche
        function pdfGuessCrs(P) { const v = P.map(p => p.v); if (!v.some(x => x > 1.3e6 && x < 2.4e6)) return 'L93';   /* X de 1,3 à 2,4 millions : une zone CC, lue sur son Y */
            const Y = v.find(x => x > 2.6e6 && x < 9.4e6); return Y ? 'CC' + Math.max(42, Math.min(50, Math.round((Y - 200000) / 1e6) + 41)) : 'L93'; }
        function pdfGridFit(G, crsPlan) {
            if (!G || !G.lab || G.lab.length < 4) return null; const W = G.W, H = G.H, P = G.lab.map(l => ({ x: l[0] * W, y: l[1] * H, v: l[2], a: l[3] }));
            const code = G.crs || (crsPlan && crsPlan !== 'auto' ? crsPlan : pdfGuessCrs(P)), isY = (v) => code === 'L93' ? v > 5e6 : Math.abs(v - ((+code.slice(2) - 41) * 1e6 + 200000)) < 7e5, isX = (v) => code === 'L93' ? v > 5e4 && v < 1.3e6 : v > 1e6 && v < 2.4e6;
            let LX = P.filter(p => isX(p.v) && !isY(p.v)), LY = P.filter(p => isY(p.v) && !isX(p.v));
            // ambigu (zones qui se recoupent) : les étiquettes d'un même axe sont écrites dans la même direction
            const amb = P.filter(p => isX(p.v) && isY(p.v)); if (amb.length) { const aX = LX.length ? LX[0].a : null; amb.forEach(p => (aX !== null && Math.abs(Math.sin(p.a - aX)) < 0.3 ? LX : LY).push(p)); }
            const lsq3 = (L) => { const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0], mx = L.reduce((t, p) => t + p.x, 0) / L.length, my = L.reduce((t, p) => t + p.y, 0) / L.length, v0 = L[0].v; L.forEach(p => { const r = [p.x - mx, p.y - my, 1]; for (let i = 0; i < 3; i++) { B[i] += r[i] * (p.v - v0); for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } }); const z = solve3(A, B); return z && [z[0], z[1], z[2] + v0 - z[0] * mx - z[1] * my]; };
            const solve3 = (A, B) => { const M = A.map((r, i) => r.concat([B[i]])); for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null; for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; } } return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]]; };
            // valeurs aberrantes (n° de dossier, hachures lues comme des 1…) : loin de la médiane de leur axe, écartées
            const keepNear = (L) => { if (!L.length) return L; const vs = L.map(p => p.v).sort((a, b) => a - b), md = vs[vs.length >> 1]; return L.filter(p => Math.abs(p.v - md) < 3000); }; LX = keepNear(LX); LY = keepNear(LY);
            if (LX.length < 2 || LY.length < 2 || new Set(LX.map(p => p.v)).size < 2 || new Set(LY.map(p => p.v)).size < 2) return null;
            // première estimation : similitude commune aux deux axes (X = a·x + b·y + tx, Y = b·x − a·y + ty) ; marche même avec les étiquettes d'un seul côté par axe
            const simOf = () => { const N = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], B = [0, 0, 0, 0], add = (r, v) => { for (let i = 0; i < 4; i++) { B[i] += r[i] * v; for (let j = 0; j < 4; j++) N[i][j] += r[i] * r[j]; } };
                const mx = P.reduce((t, p) => t + p.x, 0) / P.length, my = P.reduce((t, p) => t + p.y, 0) / P.length, v0x = LX[0].v, v0y = LY[0].v;   /* centré : sinon 3 140 000 × 800 noie les décimales */
                LX.forEach(p => add([p.x - mx, p.y - my, 1, 0], p.v - v0x)); LY.forEach(p => add([-(p.y - my), p.x - mx, 0, 1], p.v - v0y)); const M = N.map((r, i) => r.concat([B[i]]));
                for (let c = 0; c < 4; c++) { let q = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[q][c])) q = r; [M[c], M[q]] = [M[q], M[c]]; if (Math.abs(M[c][c]) < 1e-9 * Math.abs(N[0][0] || 1)) return null; for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; } }
                const z = M.map((r, i) => r[4] / r[i]); return [z[0], z[1], z[2] + v0x - (z[0] * mx + z[1] * my), z[3] + v0y - (z[1] * mx - z[0] * my)]; }, sim = simOf();
            // une seule rangée d'étiquettes par axe : la rotation ne se lit pas sur leurs positions, mais sur le sens d'écriture (le long des lignes du quadrillage)
            const simAng = () => { let cs = 0, sn = 0; LY.forEach(p => { cs += Math.cos(2 * p.a); sn += Math.sin(2 * p.a); }); LX.forEach(p => { cs += Math.cos(2 * (p.a - Math.PI / 2)); sn += Math.sin(2 * (p.a - Math.PI / 2)); });
                const ph = Math.atan2(sn, cs) / 2, c = Math.cos(ph), si = Math.sin(ph), mx = P.reduce((t, p) => t + p.x, 0) / P.length, my = P.reduce((t, p) => t + p.y, 0) / P.length, v0x = LX[0].v, v0y = LY[0].v;
                const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0], add = (r, v) => { for (let i = 0; i < 3; i++) { B[i] += r[i] * v; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } };
                LX.forEach(p => add([c * (p.x - mx) - si * (p.y - my), 1, 0], p.v - v0x)); LY.forEach(p => add([-si * (p.x - mx) - c * (p.y - my), 0, 1], p.v - v0y)); const z = solve3(A, B); if (!z) return null;
                const a = z[0] * c, b = -z[0] * si; return [a, b, z[1] + v0x - (a * mx + b * my), z[2] + v0y - (b * mx - a * my)]; };   /* échelle négative = sens d'écriture à 180° : a et b changent de signe ensemble, c'est juste */
            let sim2 = sim || simAng(); if (!sim2) return null;
            // étiquettes qui ne collent pas au premier calage (mal lues) : écartées, puis on recale
            for (let it = 0; it < 2; it++) { const rx = LX.map(p => Math.abs(sim2[0] * p.x + sim2[1] * p.y + sim2[2] - p.v)), ry = LY.map(p => Math.abs(sim2[1] * p.x - sim2[0] * p.y + sim2[3] - p.v)), all = rx.concat(ry).sort((a, b) => a - b), md = all[all.length >> 1], lim = Math.max(3 * md, 2);
                const nX = LX.filter((p, i) => rx[i] <= lim), nY = LY.filter((p, i) => ry[i] <= lim); if (nX.length === LX.length && nY.length === LY.length) break; if (nX.length < 2 || nY.length < 2) break; LX = nX; LY = nY; const s2 = simOf(); if (!s2) break; sim2 = s2; } let fx = [sim2[0], sim2[1], sim2[2]], fy = [sim2[1], -sim2[0], sim2[3]];
            // l'étiquette n'est pas pile sur sa ligne : on affine sur les croix du quadrillage (intersections exactes) quand il y en a
            const vx = [...new Set(LX.map(p => p.v))].sort((a, b) => a - b), vy = [...new Set(LY.map(p => p.v))].sort((a, b) => a - b), stp = (vv) => vv.length > 1 ? Math.min(...vv.slice(1).map((v, i) => v - vv[i])) : 0, sx = stp(vx), sy = stp(vy);
            const inv = (X, Y) => { const det = fx[0] * fy[1] - fx[1] * fy[0]; return { x: ((X - fx[2]) * fy[1] - (Y - fy[2]) * fx[1]) / det, y: ((Y - fy[2]) * fx[0] - (X - fx[2]) * fy[0]) / det }; };
            const pairs = []; if (sx > 0 && sy > 0 && G.cx && G.cx.length) { const C = G.cx.map(q => ({ x: q[0] * W, y: q[1] * H })), ppm = Math.hypot(fx[0], fx[1]), tol = Math.max(4, 0.08 * Math.min(sx, sy) / (1 / ppm) * 0 + 0.08 * Math.min(sx, sy) * (1 / Math.hypot(fx[0], fx[1])));
                for (let X = vx[0] - 3 * sx; X <= vx[vx.length - 1] + 3 * sx; X += sx) for (let Y = vy[0] - 3 * sy; Y <= vy[vy.length - 1] + 3 * sy; Y += sy) { const q = inv(X, Y); let best = null, bd = tol; C.forEach(c => { const d = Math.hypot(c.x - q.x, c.y - q.y); if (d < bd) { bd = d; best = c; } }); if (best) pairs.push({ x: best.x, y: best.y, X, Y }); } }
            let used = 'étiquettes'; if (pairs.length >= 3) { const gx = lsq3(pairs.map(p => ({ x: p.x, y: p.y, v: p.X }))), gy = lsq3(pairs.map(p => ({ x: p.x, y: p.y, v: p.Y }))); if (gx && gy) { fx = gx; fy = gy; used = pairs.length + ' croix du quadrillage'; } }
            // similitude la plus proche (une feuille n'est ni étirée ni cisaillée) : page en y vers le bas, coordonnées en y vers le haut
            const a = (fx[0] - fy[1]) / 2, b = (fx[1] + fy[0]) / 2, T = (x, y) => ({ X: a * x + b * y + fx[2] + (fx[0] - a) * 0, Y: b * x - a * y + fy[2] });
            // translation recalée au centre de gravité des mesures
            const ref = pairs.length >= 3 ? pairs.map(p => ({ x: p.x, y: p.y, X: p.X, Y: p.Y })) : null; let tx = fx[2], ty = fy[2];
            if (ref) { tx = ref.reduce((s, p) => s + p.X - (a * p.x + b * p.y), 0) / ref.length; ty = ref.reduce((s, p) => s + p.Y - (b * p.x - a * p.y), 0) / ref.length; }
            const scale = Math.hypot(a, b), res = ref ? Math.sqrt(ref.reduce((s, p) => s + (a * p.x + b * p.y + tx - p.X) ** 2 + (b * p.x - a * p.y + ty - p.Y) ** 2, 0) / ref.length) : null;
            return { crs: code, used, scale, res, f: (x, y) => ({ X: a * x + b * y + tx, Y: b * x - a * y + ty }) };
        }
        // pose l'image de fond d'après le calage (dans le système du plan ; un plan vierge prend celui du PDF)
        function bgApplyGrid(s, G, echUser) {
            const Pp = detectCRS(), fit = pdfGridFit(G, Pp ? Pp.code : (bmSettings.crs || 'auto')); if (!fit) return null;
            const e0 = fit.scale * 72 / 25.4 * 1000; if (echUser > 0 && (e0 / echUser > 2.5 || echUser / e0 > 2.5)) return { skip: 'le carroyage donne une échelle de 1/' + Math.round(e0) + ', trop loin du 1/' + echUser + ' indiqué : plan posé à l\'échelle indiquée, calez-le à la main' };
            return bgPlaceFit(s, fit, G.W, G.H, Pp);
        }
        // pose l'image de fond d'après un calage page → coordonnées réelles (fit.f sur une page de W × H), reprojeté dans le système du plan si besoin
        function bgPlaceFit(s, fit, W, H, Pp) {
            const From = lccParams(fit.crs), To = Pp && (geoOrigin.x || geoOrigin.y) ? Pp : From, conv = (X, Y) => { if (To.code === From.code) return { x: X, y: Y }; const ll = lccInv(From, X, Y); return lccFwd(To, ll.lat, ll.lon); };
            const R = (u, v) => { const q = fit.f(u * W, v * H); return conv(q.X, q.Y); }, C = R(0.5, 0.5);
            if (!geoOrigin.x && !geoOrigin.y) { const hadDrawing = shapes.some(x => x !== s && !isBg(x)); if (hadDrawing) return { err: 'Le plan contient déjà un dessin sans coordonnées : calez-le d\'abord (fond de carte), puis recommencez.' }; geoOrigin = { x: Math.floor(C.x / 1000) * 1e6, y: Math.floor(C.y / 1000) * 1e6 }; }
            const Wd = (q) => ({ x: mmToWorld(q.x * 1000 - geoOrigin.x), y: -mmToWorld(q.y * 1000 - geoOrigin.y) }), c = Wd(C), a = Wd(R(0, 0.5)), b = Wd(R(1, 0.5)), t = Wd(R(0.5, 0)), d = Wd(R(0.5, 1));
            s.x = c.x; s.y = c.y; s.w = Math.hypot(b.x - a.x, b.y - a.y); s.h = Math.hypot(d.x - t.x, d.y - t.y); s.rot = Math.atan2(b.y - a.y, b.x - a.x);
            return { crs: To.code, from: fit.crs, used: fit.used, res: fit.res, ech: Math.round(fit.scale * 72 / 25.4 * 1000) };   /* m par pt ÷ (mm par pt) */
        }
        function bgGridMsg(gr, echUser) { return 'PLAN CALÉ SUR SON CARROYAGE (' + gr.used + (gr.res !== null && gr.res !== undefined ? ', écart moyen ' + (gr.res * 100).toFixed(1).replace('.', ',') + ' cm' : '') + ') : échelle 1/' + gr.ech + (echUser > 0 && Math.abs(gr.ech / echUser - 1) > 0.02 ? ' (et non 1/' + echUser + ' : le carroyage fait foi)' : '') + ', coordonnées ' + crsName(gr.crs) + (gr.from !== gr.crs ? ' (plan en ' + crsName(gr.from) + ' reprojeté)' : '') + '.'; }
        function bgGridApplyUI(s) { s = s || selectedShapes.find(x => x.type === 'bgimage'); if (!s || !s.pdfGrid) return; const gr = bgApplyGrid(s, s.pdfGrid); if (!gr) { updateCommandMessageText('CARROYAGE : pas assez de coordonnées lisibles sur ce plan.'); return; } if (gr.err) { updateCommandMessageText(gr.err); return; } invalidateCache(); saveState(); draw(); updateCommandMessageText(bgGridMsg(gr)); }
        // ---- CALER À LA MAIN SUR 2 CROIX DU CARROYAGE : clic sur une croix (aimantée aux croix lues dans le PDF), on tape ses coordonnées, puis une 2e ;
        // position, rotation et échelle en découlent (similitude exacte sur les 2 points)
        let gcal = null;
        function gcalStart(s) { s = s || selectedShapes.find(x => x.type === 'bgimage'); setMode('gridcal'); const G = s && s.pdfGrid; gcal = { s: s || null, P: [], crs: (G && G.crs) || (detectCRS() || {}).code || (bmSettings.crs && bmSettings.crs !== 'auto' ? bmSettings.crs : 'CC44') }; if (s) selectedShapes = [s]; draw(); }
        function gcalPage(s, wx, wy) { const l = bgLocal(s, wx, wy), u = l.x / s.w + 0.5, v = l.y / s.h + 0.5, G = s.pdfGrid; return G ? { x: u * G.W, y: v * G.H } : { x: u * 1000, y: v * 1000 * s.h / s.w }; }
        function gcalPageWH(s) { const G = s.pdfGrid; return G ? [G.W, G.H] : [1000, 1000 * s.h / s.w]; }
        function gcalSnap(s, wx, wy) { const G = s.pdfGrid, r = 14 / camera.zoom; let best = null, bd = r; if (G && G.cx) G.cx.forEach(q => { const p = bgUV(s, q[0], q[1]), d = Math.hypot(p.x - wx, p.y - wy); if (d < bd) { bd = d; best = p; } }); return best; }
        function gcalAsk(p) { const g = gcal, s = g.s, k = g.P.length, pg = gcalPage(s, p.x, p.y); let pre = null;
            if (s.pdfGrid) { const f = pdfGridFit(s.pdfGrid, g.crs); if (f && f.crs === g.crs) { const q = f.f(pg.x, pg.y); pre = { X: Math.round(q.X), Y: Math.round(q.Y) }; } }   // carroyage lu en partie : on propose
            if (!pre && k === 1) { const A = g.P[0]; pre = { X: Math.round((A.X + mOf(p.x - A.w.x)) / 10) * 10, Y: Math.round((A.Y - mOf(p.y - A.w.y)) / 10) * 10 }; }   // d'après l'échelle actuelle
            const inp = (id, v) => `<input id="${id}" type="text" inputmode="decimal" value="${v === undefined ? '' : String(v).replace('.', ',')}" class="mf-in" style="width:140px;text-align:right">`;
            const crsSel = k ? '' : MF.row('Système', `<select id="gc-crs" class="mf-in">${['L93', 'CC42', 'CC43', 'CC44', 'CC45', 'CC46', 'CC47', 'CC48', 'CC49', 'CC50'].map(c => `<option value="${c}"${c === g.crs ? ' selected' : ''}>${crsName(c)}</option>`).join('')}</select>`, '');
            openTopoModal('🧭 Croix ' + (k + 1) + ' sur 2', `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:#e5e7eb;max-width:380px">
                <div class="mf-hint" style="margin:0">Tapez les coordonnées de cette croix, lues sur les bords du plan (le long de ses lignes de quadrillage).${pre ? ' Valeurs proposées : vérifiez-les.' : ''}</div>
                ${crsSel}${MF.row('X (Est)', inp('gc-x', pre ? pre.X : undefined), 'm')}${MF.row('Y (Nord)', inp('gc-y', pre ? pre.Y : undefined), 'm')}</div>`,
                [['Annuler ce point', () => { closeTopoModal(); draw(); }, false], [k ? 'Caler le plan' : 'Croix suivante', () => { const n = (id) => parseFloat(String(document.getElementById(id).value).replace(/\s/g, '').replace(',', '.'));
                    const X = n('gc-x'), Y = n('gc-y'); if (!isFinite(X) || !isFinite(Y)) { document.getElementById('gc-x').focus(); return; } if (!k && document.getElementById('gc-crs')) g.crs = document.getElementById('gc-crs').value;
                    if (k && Math.hypot(X - g.P[0].X, Y - g.P[0].Y) < 1) { updateCommandMessageText('CALER SUR 2 CROIX : la 2e croix doit avoir d\'autres coordonnées que la 1re (prenez-la loin, à l\'autre bout du plan).'); return; }
                    closeTopoModal(); g.P.push({ pg, w: { x: p.x, y: p.y }, X, Y }); if (g.P.length >= 2) gcalApply(); else { updateCommandMessage(); draw(); } }, true]]);
            setTimeout(() => { const e = document.getElementById('gc-x'); if (e) { e.focus(); e.select(); } ['gc-x', 'gc-y'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); const bs = document.querySelectorAll('#tm-actions button'); bs[bs.length - 1].click(); } }); }); }, 30); }
        function gcalApply() { const g = gcal, s = g.s, [A, B] = g.P, dx = B.pg.x - A.pg.x, dy = B.pg.y - A.pg.y, dX = B.X - A.X, dY = B.Y - A.Y, L = dx * dx + dy * dy;
            if (L < 1e-9) { updateCommandMessageText('CALER SUR 2 CROIX : les 2 croix sont au même endroit.'); g.P = []; draw(); return; }
            const a = (dX * dx - dY * dy) / L, b = (dX * dy + dY * dx) / L, tx = A.X - (a * A.pg.x + b * A.pg.y), ty = A.Y - (b * A.pg.x - a * A.pg.y);
            const fit = { crs: g.crs, used: '2 croix', scale: Math.hypot(a, b), res: null, f: (x, y) => ({ X: a * x + b * y + tx, Y: b * x - a * y + ty }) }, [W, H] = gcalPageWH(s);
            const keep = { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, go: Object.assign({}, geoOrigin) }, gr = bgPlaceFit(s, fit, W, H, detectCRS());
            if (gr.err) { Object.assign(s, { x: keep.x, y: keep.y, w: keep.w, h: keep.h, rot: keep.rot }); geoOrigin = keep.go; setMode('select-box'); updateCommandMessageText(gr.err); draw(); return; }
            const rotD = Math.round(Math.atan2(b, a) * -180 / Math.PI * 10) / 10; gcal = null; invalidateCache(); saveState(); setMode('select-box'); selectedShapes = [s];
            camera.zoom = Math.min(canvas.width / s.w, canvas.height / s.h) * 0.85; camera.x = canvas.width / 2 - s.x * camera.zoom; camera.y = canvas.height / 2 - s.y * camera.zoom;
            updateCommandMessageText('PLAN CALÉ SUR 2 CROIX : coordonnées ' + crsName(gr.crs) + (gr.from !== gr.crs ? ' (plan en ' + crsName(gr.from) + ' reprojeté)' : '') + (s.pdfGrid ? ', échelle 1/' + gr.ech : '') + (Math.abs(rotD) > 0.05 ? ', tourné de ' + nfr(rotD, 1) + '°' : '') + '. Ctrl+Z pour annuler.'); draw(); }
        function gcalDraw(c) { if (mode !== 'gridcal' || !gcal || !gcal.s) return; const s = gcal.s, G = s.pdfGrid, z = camera.zoom; c.save(); c.setLineDash([]);
            if (G && G.cx) { c.strokeStyle = 'rgba(34,197,94,.9)'; c.lineWidth = 1.5 / z; G.cx.forEach(q => { const p = bgUV(s, q[0], q[1]); c.beginPath(); c.arc(p.x, p.y, 6 / z, 0, 2 * Math.PI); c.stroke(); }); }
            const h = gcalSnap(s, currentX, currentY); if (h) { c.strokeStyle = '#facc15'; c.lineWidth = 2.5 / z; c.beginPath(); c.arc(h.x, h.y, 10 / z, 0, 2 * Math.PI); c.stroke(); }
            gcal.P.forEach((q, i) => { c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(q.w.x, q.w.y, 6 / z, 0, 2 * Math.PI); c.fill(); screenTextsToDraw.push({ kind: 'text', layerId: s.layerId, wx: q.w.x + 9 / z, wy: q.w.y - 5 / z, lines: ['Croix ' + (i + 1) + ' : X ' + nfr(q.X, 2) + ' · Y ' + nfr(q.Y, 2)], color: '#38bdf8' }); });
            c.restore(); }
        function bgUV(s, u, v) { const lx = (u - 0.5) * s.w, ly = (v - 0.5) * s.h, c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0); return { x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c }; }
        // fenêtre « Points topo du plan » : plage d'altitudes, position (repère ou texte), calque
        function pdfTopoDialog(s) {
            s = s || selectedShapes.find(x => x.type === 'bgimage'); if (!s) return; const D = s.pdfTopo;
            if (!D) { openTopoModal('📍 Lire le plan PDF', `<div style="font-size:13.5px;color:#e5e7eb;max-width:420px">Ce fond a été inséré avant cette fonction (ou ce n'est pas un PDF) : MomoCAD n'a pas gardé le texte du document.<br><br>Choisis le <b>PDF d'origine</b> : il est relu (page ${s.pdfPage || 1}), sans changer le calage.</div>`,
                [['Annuler', () => closeTopoModal(), false], ['Choisir le PDF…', () => { closeTopoModal(); pdfTopoReload(s); }, true]]); return; }
            const T = D.t.length, tal = s.pdfTalus, V = pdfVecCache[s.mapId]; if (V) s.pdfBat = pdfBats(V); const plan = pdfPlanName(s), E = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            if (!T && !V && !D.text) { openTopoModal('📍 Lire le plan PDF', `<div style="font-size:13.5px;color:#e5e7eb;max-width:420px">Ce PDF ne contient ni texte ni traits : c'est une image (scan). Rien ne peut être lu automatiquement.</div>`, [['Fermer', () => closeTopoModal(), true]]); return; }
            const vals = D.t.map(r => r[2]).sort((a, b) => a - b), cl = [];   // plage proposée : le plus gros paquet de cotes sans trou de plus de 5 m (écarte cotes de longueur, diamètres, lectures douteuses)
            vals.forEach((v, i) => { if (!i || v - vals[i - 1] > 5) cl.push([]); cl[cl.length - 1].push(v); }); const near = cl.sort((a, b) => b.length - a.length)[0] || [], lo = T ? Math.floor(Math.min(...near)) : '', hi = T ? Math.ceil(Math.max(...near)) : '', withM = D.m.filter(Boolean).length;
            const inp = (id, v) => `<input id="${id}" type="text" inputmode="decimal" value="${v}" class="mf-in" style="width:90px;text-align:right">`;
            const chk = (id, on, dis, title, sub) => `<label style="display:flex;gap:8px;align-items:flex-start;cursor:${dis ? 'default' : 'pointer'};${dis ? 'opacity:.5' : ''}"><input type="checkbox" id="${id}" ${on && !dis ? 'checked' : ''} ${dis ? 'disabled' : ''} style="margin-top:3px"><span><b>${title}</b><br><span class="mf-hint" style="margin:0">${sub}</span></span></label>`;
            const nTal = tal ? tal.length : 0, ocg = V && V.ocg, nV = V ? V.P.filter(q => !q.f).length : 0;
            const talSub = tal === undefined ? 'MomoCAD redemandera le PDF pour chercher les talus.' : nTal ? `<b>${tal.filter(t => t.h).length}</b> tête(s) et <b>${tal.filter(t => t.p).length}</b> pied(s) de talus reconnus (calques du plan ou hachures), en polylignes 3D. L'altitude de chaque sommet vient des cotes du plan posées sur la ligne.` : 'Aucun talus reconnu sur ce plan (hachures longues et courtes au départ d\'une tête).';
            openTopoModal('📍 Lire le plan PDF', `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:#e5e7eb;min-width:380px;max-width:470px">
                <div class="mf-hint" style="margin:0">Les données topo (points, lignes de rupture) et le dessin du plan vont dans des calques séparés.</div>
                ${chk('pi-pts', T > 0, !T, 'Points topo', T ? `<b>${T}</b> cote(s) lue(s), dont <b>${withM}</b> avec leur repère (croix, rond…).` : (D.text ? 'Aucune cote d\'altitude (nombre du type 458,33) dans le texte de ce PDF.' : 'Ce PDF n\'a pas de texte.'))}
                ${T ? `<div style="display:flex;flex-direction:column;gap:7px;margin-left:24px">${MF.row('Altitudes retenues', 'de ' + inp('pt-lo', lo) + ' à ' + inp('pt-hi', hi) + ' m', '')}
                <div class="mf-hint">Les autres nombres (cotes de longueur, surfaces…) sont écartés par cette plage.</div>
                ${MF.row('Position du point', `<select id="pt-pos" class="mf-in" style="min-width:230px" onchange="piPosPrev()"><option value="m">sur le repère (sinon au début du texte)</option><option value="mo">seulement les cotes avec repère</option><option value="t">au début du texte (point d\'insertion)</option></select>`, '')}
                <div id="pt-pos-prev" style="margin-left:2px"></div></div>` : ''}
                ${chk('pi-tal', nTal > 0, !T || tal !== undefined && !nTal, 'Lignes de rupture des talus', T ? talSub : 'Il faut les cotes du plan pour leur donner une altitude.')}
                ${chk('pi-bat', true, false, 'Bâtiments existants', 'Étape <b>Bâtiments</b> après l\'import : <b>+ BÂTIMENT</b>, puis un clic dans chacun (zone hachurée ou contour fermé), sa hauteur en NGF ou en H.')}
                ${chk('pi-trc', false, false, 'Tracés du plan', V ? `<b>${nV}</b> trait(s), dans le calque « <b>${E(plan)}</b> »${ocg ? ' ; ' + (V.L.length - 1) + ' calques dans le PDF' : ''}. Sans les points ni les cotes d'altitude, déjà repris ci-dessus.` : `Tous les traits du dessin, dans le calque « <b>${E(plan)}</b> ». MomoCAD redemandera le PDF.`)}
                ${ocg ? `<label style="display:flex;gap:8px;align-items:center;margin-left:24px;cursor:pointer"><input type="checkbox" id="pi-split"> un calque par calque du PDF (« ${E(plan)} · Murs »…)</label>` : ''}
                <div class="mf-hint">Ensuite, un volet à droite du plan, étape par étape : les lignes de rupture à vérifier, les bâtiments à créer, puis les calques. Ctrl+Z annule.</div></div>`,
                [['Annuler', () => closeTopoModal(), false], ['Importer ›', () => { const g = (id) => document.getElementById(id), o = { pts: !!(g('pi-pts') && g('pi-pts').checked), tal: !!(g('pi-tal') && g('pi-tal').checked), bat: !!(g('pi-bat') && g('pi-bat').checked), trc: !!(g('pi-trc') && g('pi-trc').checked), split: !!(g('pi-split') && g('pi-split').checked),
                    lo: g('pt-lo') ? t2Num(g('pt-lo').value) : NaN, hi: g('pt-hi') ? t2Num(g('pt-hi').value) : NaN, pos: g('pt-pos') ? g('pt-pos').value : 'm', ln: 'Points topo (PDF)' };
                    closeTopoModal(); if ((o.trc && !pdfVecCache[s.mapId]) || (o.tal && s.pdfTalus === undefined) ) pdfTopoReload(s, () => pdfImport(s, o)); else pdfImport(s, o); }, true]]);
            piPosPrev();
        }
        // aperçu de la position du point topo selon le choix (repère, texte)
        function piPosPrev() { const el = document.getElementById('pt-pos-prev'), sel = document.getElementById('pt-pos'); if (!el || !sel) return; const v = sel.value;
            const cote = (x, y, mk, on) => `${mk ? `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#9ca3af" stroke-width="1.4"/>` : ''}<text x="${x + 8}" y="${y + 4}" font-size="12" fill="${on ? '#e5e7eb' : '#6b7280'}" font-family="sans-serif">${mk ? '458,33' : '457,90'}</text>`
                + (on ? (v === 't' || !mk ? `<circle cx="${x + 8}" cy="${y + 4}" r="3.6" fill="#ef4444"/>` : `<circle cx="${x}" cy="${y}" r="3.6" fill="#ef4444"/>`) : `<path d="M${x + 6} ${y - 6}l46 14" stroke="#ef4444" stroke-width="1.2"/>`);
            el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;background:#111827;border:1px solid #374151;border-radius:8px;padding:6px 10px"><svg width="200" height="34" viewBox="0 0 200 34" style="width:200px;height:34px;flex:none">${cote(14, 16, true, true)}${cote(112, 16, false, v !== 'mo')}</svg>
                <span class="mf-hint" style="margin:0">${v === 't' ? 'Le point (rouge) est posé au début du texte de la cote.' : v === 'mo' ? 'Point sur le repère ; une cote sans repère est ignorée.' : 'Point sur le repère ; une cote sans repère : au début du texte.'}</span></div>`; }
        // ---- TRACÉS IMPORTÉS D'UN PLAN PDF, en version légère : un objet par calque { type:'pdfvec', x, y (centre de la page), w, h, rot, vecId, name, n } ;
        // les traits (en points de la page) sont rangés à part dans vecStore comme les maillages : l'annulation, l'enregistrement et l'affichage restent rapides même avec 100 000 traits
        let vecStore = {}; const vecCache = {};
        function vecMake(W, H, polys) { let n = 0; polys.forEach(q => n += q.p.length); const xy = new Float32Array(n * 2), st = new Int32Array(polys.length + 1), cl = new Uint8Array(polys.length); let k = 0;
            polys.forEach((q, i) => { st[i] = k; q.p.forEach(p => { xy[2 * k] = p[0]; xy[2 * k + 1] = p[1]; k++; }); cl[i] = q.c ? 1 : 0; }); st[polys.length] = k; return { W, H, xy, st, cl }; }
        const vecPack = (v) => ({ W: v.W, H: v.H, xy: f32ToB64(v.xy), st: Array.from(v.st), cl: Array.from(v.cl) });
        const vecUnpack = (o) => ({ W: o.W, H: o.H, xy: b64ToF32(o.xy), st: Int32Array.from(o.st), cl: Uint8Array.from(o.cl) });
        // boîte, chemin de dessin et grille de recherche des segments (en points de la page), calculés une fois
        function vecInfo(id) { if (vecCache[id]) return vecCache[id]; const v = vecStore[id]; if (!v) return null; const { xy, st, cl } = v, np = st.length - 1;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < xy.length; i += 2) { const x = xy[i], y = xy[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            const path = new Path2D(); for (let p = 0; p < np; p++) { const a = st[p], b = st[p + 1]; if (b <= a) continue; path.moveTo(xy[2 * a], xy[2 * a + 1]); for (let k = a + 1; k < b; k++) path.lineTo(xy[2 * k], xy[2 * k + 1]); if (b - a === 1) path.lineTo(xy[2 * a] + 0.01, xy[2 * a + 1]); if (cl[p]) path.lineTo(xy[2 * a], xy[2 * a + 1]); }   /* pas de closePath : très lent sur des dizaines de milliers de contours */
            const SA = [], SB = []; for (let p = 0; p < np; p++) { const a = st[p], b = st[p + 1]; if (b - a === 1) { SA.push(a); SB.push(a); } for (let k = a; k < b - 1; k++) { SA.push(k); SB.push(k + 1); } if (cl[p] && b - a > 2) { SA.push(b - 1); SB.push(a); } }
            const cell = Math.max(2, Math.max(x1 - x0, y1 - y0) / 300), g = new Map();
            for (let i = 0; i < SA.length; i++) { const ax = xy[2 * SA[i]], ay = xy[2 * SA[i] + 1], bx = xy[2 * SB[i]], by = xy[2 * SB[i] + 1];
                const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.5)) + 1; let last = NaN;   /* les cases traversées par le segment (pas toute sa boîte : une diagonale en couvrirait des milliers) */
                for (let t = 0; t <= n; t++) { const f = n ? t / n : 0, key = Math.floor((ax + (bx - ax) * f) / cell) * 100003 + Math.floor((ay + (by - ay) * f) / cell); if (key === last) continue; last = key; let L = g.get(key); if (!L) g.set(key, L = []); if (L[L.length - 1] !== i) L.push(i); } }
            return vecCache[id] = { x0, y0, x1, y1, path, cell, g, v, SA, SB }; }
        // matrice page → dessin (comme ctx.transform : X = a·x + c·y + e, Y = b·x + d·y + f)
        function vecM(s) { const v = vecStore[s.vecId], sx = s.w / v.W, sy = s.h / v.H, c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0), lx = -s.w / 2, ly = -s.h / 2;
            return { a: sx * c, b: sx * sn, c: -sy * sn, d: sy * c, e: s.x + lx * c - ly * sn, f: s.y + lx * sn + ly * c }; }
        const vecW = (m, x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
        function vecP(m, X, Y) { const det = m.a * m.d - m.b * m.c, x = X - m.e, y = Y - m.f; return { x: (m.d * x - m.c * y) / det, y: (-m.b * x + m.a * y) / det }; }
        function vecCorners(s) { const I = vecInfo(s.vecId); if (!I) return bgCorners(s); const m = vecM(s); return [[I.x0, I.y0], [I.x1, I.y0], [I.x1, I.y1], [I.x0, I.y1]].map(([x, y]) => vecW(m, x, y)); }
        // segments près d'un point du dessin : f(k, ax, ay, bx, by) en points de la page
        function vecNear(s, X, Y, r, f) { const I = vecInfo(s.vecId); if (!I) return; const m = vecM(s), k0 = Math.hypot(m.a, m.b) || 1, q = vecP(m, X, Y), rp = r / k0, xy = I.v.xy, seen = new Set();
            for (let gx = Math.floor((q.x - rp) / I.cell); gx <= Math.floor((q.x + rp) / I.cell); gx++) for (let gy = Math.floor((q.y - rp) / I.cell); gy <= Math.floor((q.y + rp) / I.cell); gy++) (I.g.get(gx * 100003 + gy) || []).forEach(i => { if (seen.has(i)) return; seen.add(i); const k = I.SA[i], k2 = I.SB[i]; f(k, xy[2 * k], xy[2 * k + 1], xy[2 * k2], xy[2 * k2 + 1], q, rp); }); }
        function vecHit(s, X, Y, tol) { let hit = false; vecNear(s, X, Y, tol, (k, ax, ay, bx, by, q, rp) => { if (hit) return; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / l2)) : 0; if (Math.hypot(ax + t * dx - q.x, ay + t * dy - q.y) <= rp) hit = true; }); return hit; }
        // accroches : sommets (et milieux) des traits voisins du curseur
        function vecSnapPts(s, X, Y, r) { const out = [], m = vecM(s); vecNear(s, X, Y, r, (k, ax, ay, bx, by) => { if (snapSettings.endpoint) { out.push(vecW(m, ax, ay), vecW(m, bx, by)); } if (snapSettings.midpoint && (ax !== bx || ay !== by)) out.push(vecW(m, (ax + bx) / 2, (ay + by) / 2)); }); return out; }
        // poids d'affichage des tracés PDF : 20 traits comptent comme un objet (au-delà de 4 000, le dessin est mis en image)
        function vecWeight() { let w = 0; for (const s of shapes) if (s.type === 'pdfvec') w += (s.n || 0) / 20; return w; }
        function drawVec2D(ctx2, s, col, sel, dx, dy, lineScale) { const I = vecInfo(s.vecId); if (!I) return; const m = vecM(s), k0 = Math.hypot(m.a, m.b) || 1;
            ctx2.save(); ctx2.transform(m.a, m.b, m.c, m.d, m.e + dx, m.f + dy); ctx2.setLineDash([]); ctx2.strokeStyle = sel ? '#ec4899' : col; ctx2.lineWidth = (sel ? 2 : effectiveWidth(s)) / lineScale / k0; ctx2.lineJoin = 'round'; vecStroke(I, ctx2); ctx2.restore(); }
        // affichage seulement : le tracé est découpé en tuiles (seules celles à l'écran sont dessinées) et, vu de loin, les sommets à moins d'un demi-pixel
        // l'un de l'autre sont fusionnés. Les données, l'accroche et les mesures gardent tous les points.
        function vecTiles(I) { if (I.tiles) return I.tiles; const { xy, st } = I.v, np = st.length - 1, N = 12, tw = Math.max(I.x1 - I.x0, 1e-9) / N, th = Math.max(I.y1 - I.y0, 1e-9) / N, T = new Map();
            for (let p = 0; p < np; p++) { const a = st[p], b = st[p + 1]; if (b <= a) continue; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
                for (let k = a; k < b; k++) { const x = xy[2 * k], y = xy[2 * k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                const key = Math.min(N - 1, Math.floor(((x0 + x1) / 2 - I.x0) / tw)) * N + Math.min(N - 1, Math.floor(((y0 + y1) / 2 - I.y0) / th)); let t = T.get(key);
                if (!t) T.set(key, t = { P: [], B: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, lod: {} }); t.P.push(p); t.B.push(x0, y0, x1, y1);
                if (x0 < t.x0) t.x0 = x0; if (y0 < t.y0) t.y0 = y0; if (x1 > t.x1) t.x1 = x1; if (y1 > t.y1) t.y1 = y1; }
            return I.tiles = [...T.values()]; }
        function vecTilePath(I, t, L) { if (t.lod[L]) return t.lod[L]; const { xy, st, cl } = I.v, P = new Path2D(), full = L < -30, tol = full ? 0 : Math.pow(2, L), t2 = tol * tol, g2 = tol * 2, D = new Set();
            for (let i = 0; i < t.P.length; i++) { const p = t.P[i], a = st[p], b = st[p + 1];
                if (!full && t.B[4 * i + 2] - t.B[4 * i] < g2 && t.B[4 * i + 3] - t.B[4 * i + 1] < g2) {   // trait plus petit qu'un pixel : un seul point par pixel
                    const cx = Math.floor((t.B[4 * i] + t.B[4 * i + 2]) / 2 / tol), cy = Math.floor((t.B[4 * i + 1] + t.B[4 * i + 3]) / 2 / tol), key = cx * 1048583 + cy; if (D.has(key)) continue; D.add(key);
                    const ex = t.B[4 * i + 2] - t.B[4 * i], ey = t.B[4 * i + 3] - t.B[4 * i + 1], mx = (t.B[4 * i] + t.B[4 * i + 2]) / 2, my = (t.B[4 * i + 1] + t.B[4 * i + 3]) / 2, h = Math.max(ex, ey, tol * 0.3) / 2;
                    if (ex >= ey) { P.moveTo(mx - h, my); P.lineTo(mx + h, my); } else { P.moveTo(mx, my - h); P.lineTo(mx, my + h); } continue; }
                let lx = xy[2 * a], ly = xy[2 * a + 1]; P.moveTo(lx, ly); let n = 0;
                for (let k = a + 1; k < b; k++) { const x = xy[2 * k], y = xy[2 * k + 1], dx = x - lx, dy = y - ly; if (!full && k < b - 1 && dx * dx + dy * dy < t2) continue; P.lineTo(x, y); lx = x; ly = y; n++; }
                if (cl[p] && b - a > 2) { P.lineTo(xy[2 * a], xy[2 * a + 1]); n++; } if (!n) P.lineTo(lx + Math.max(tol * 0.5, 0.01), ly); }
            return t.lod[L] = P; }
        let vecExact = false;   // impression / export : toujours le tracé exact
        function vecStroke(I, ctx2) { let T = null; try { T = ctx2.getTransform(); } catch (e) {} const sc = T ? Math.min(Math.hypot(T.a, T.b), Math.hypot(T.c, T.d)) : 0;
            if (ctx2.__pdf) { const { xy, st, cl } = I.v; ctx2.beginPath(); for (let p = 0; p < st.length - 1; p++) { const a = st[p], b = st[p + 1]; if (b <= a) continue; ctx2.moveTo(xy[2 * a], xy[2 * a + 1]); for (let q = a + 1; q < b; q++) ctx2.lineTo(xy[2 * q], xy[2 * q + 1]); if (b - a === 1) ctx2.lineTo(xy[2 * a] + 0.01, xy[2 * a + 1]); if (cl[p]) ctx2.closePath(); } ctx2.stroke(); return; }   // PDF vectoriel : le tracé exact
            if (!(sc > 0) || !ctx2.canvas || vecExact) { ctx2.stroke(I.path); return; }
            let L = Math.floor(Math.log2(0.5 / sc)); if (L < Math.log2(Math.max(I.x1 - I.x0, I.y1 - I.y0)) - 18) L = -99;   // de près : le tracé exact
            const iv = T.inverse(), W = ctx2.canvas.width, H = ctx2.canvas.height, c = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => [iv.a * x + iv.c * y + iv.e, iv.b * x + iv.d * y + iv.f]);
            const pad = ctx2.lineWidth || 0, vx0 = Math.min(...c.map(q => q[0])) - pad, vx1 = Math.max(...c.map(q => q[0])) + pad, vy0 = Math.min(...c.map(q => q[1])) - pad, vy1 = Math.max(...c.map(q => q[1])) + pad;
            for (const t of vecTiles(I)) { if (t.x1 < vx0 || t.x0 > vx1 || t.y1 < vy0 || t.y0 > vy1) continue; ctx2.stroke(vecTilePath(I, t, L)); } }
        // décomposer : de vraies polylignes, modifiables une à une (lourd sur un gros plan)
        function vecExplode(s) { const v = vecStore[s.vecId]; if (!v) return 0; const m = vecM(s), out = []; for (let p = 0; p < v.st.length - 1; p++) { const a = v.st[p], b = v.st[p + 1]; if (b - a < 2) continue; const pts = []; for (let k = a; k < b; k++) pts.push(vecW(m, v.xy[2 * k], v.xy[2 * k + 1])); out.push({ type: 'poly', layerId: s.layerId, points: pts, open: !v.cl[p], hatch: false, zk: 1 }); }
            const i = shapes.indexOf(s); if (i >= 0) shapes.splice(i, 1, ...out); return out.length; }
        function vecExplodeUI() { const s = selectedShapes.find(x => x.type === 'pdfvec'); if (!s) return; const n = s.n || 0;
            const go = () => { const k = vecExplode(s); selectedShapes = []; invalidateCache(); saveState(); draw(); updateCommandMessageText('TRACÉS : ' + k + ' polyligne(s) créées. Ctrl+Z pour revenir au bloc.'); };
            if (n > 5000) openTopoModal('✂ Décomposer les tracés', `<div style="font-size:13.5px;color:#e5e7eb;max-width:420px"><b>${n.toLocaleString('fr-FR')}</b> traits : une fois décomposés, chacun devient un objet, et MomoCAD sera nettement plus lent sur ce plan.<br><br>Pour juste vous accrocher aux traits, inutile : l'accrochage marche sur le bloc.</div>`, [['Annuler', () => closeTopoModal(), false], ['Décomposer quand même', () => { closeTopoModal(); go(); }, true]]); else go(); }
        const pdfVecCache = {};   // traits des PDF de la séance, par image de fond (trop lourds pour le fichier .mmc : relus au besoin)
        const pdfPlanName = (s) => String(s.name || 'Plan PDF').replace(/\.pdf$/i, '').trim() || 'Plan PDF';
        function pdfImport(s, o) {
            const msg = [], before = shapes.length;
            if (o.pts && s.pdfTopo && s.pdfTopo.t.length) msg.push(pdfTopoPlace(s, o.lo, o.hi, o.pos, o.ln, true));
            if (o.tal) msg.push(pdfTalusPlace(s, o.lo, o.hi, o.pos));
            if (o.trc) msg.push(pdfTracesPlace(s, o.split));
            if (shapes.length !== before) { invalidateCache(); try { tinCache = null; } catch (e) {} saveState(); }
            draw(); updateCommandMessageText('PLAN PDF : ' + msg.filter(Boolean).join(' ; ') + '. Ctrl+Z pour annuler.');
            piWizStart(s, o, shapes.slice(before));
        }

        // ---- ASSISTANT D'IMPORT D'UN PLAN PDF : volet à droite du plan (le dessin reste libre), une étape par élément coché ----
        // Talus : liste des lignes de rupture, à vérifier / corriger / supprimer / compléter. Bâtiments : + BÂTIMENT, clics, tant qu'on ne passe pas à la suite.
        // Calques : où ranger points, talus, bâtiments et tracés (calque à part ou calque commun).
        let piW = null;
        const PI_CAT = { pts: ['Points topo', 'Topo'], tal: ['Lignes de rupture (talus)', 'Talus'], bat: ['Bâtiments existants', 'Bâti'], trc: ['Tracés du plan', ''] };
        function piWizStart(s, o, made) {
            const lay = (sh) => sh.layerId || 'layer-0', L = { pts: new Set(), tal: new Set(), trc: new Set() };
            made.forEach(sh => { if (sh.type === 'point') L.pts.add(lay(sh)); else if (sh.type === 'pdfvec') L.trc.add(lay(sh)); else if (sh.type === 'poly' && sh.zk) L.tal.add(lay(sh)); });
            const steps = []; if (o.tal) steps.push('tal'); if (o.bat) steps.push('bat'); if (made.length || o.bat) steps.push('lay'); if (!steps.length) return;
            piW = { s, o, steps, i: 0, lay: { pts: [...L.pts][0], tal: [...L.tal][0] || ensureLayer('Talus (PDF)', '#fb923c'), trc: [...L.trc], bat: null }, plan: pdfPlanName(s), cfg: null };
            piWRender(); }
        function piWClose() { if (mode === 'pline' && (batDraw || brkDraw)) setMode('select-box'); const el = document.getElementById('pi-wiz'); if (el) el.remove(); piW = null; draw(); }
        function piWGo(d) { if (!piW) return; if (mode === 'pline' && (batDraw || brkDraw)) { isDrawing = false; currentPolygon = []; setMode('select-box'); }
            if (piW.steps[piW.i] === 'lay' && d > 0) { piLayApply(); piWClose(); return; } piW.i = Math.max(0, Math.min(piW.steps.length - 1, piW.i + d)); piWRender(); }
        const piTalList = () => piW ? shapes.filter(x => x.type === 'poly' && x.open && (x.layerId || 'layer-0') === piW.lay.tal) : [];
        function piWRender() {
            if (!piW) return; let el = document.getElementById('pi-wiz'); const E = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), st = piW.steps[piW.i];
            if (!el) { el = document.createElement('div'); el.id = 'pi-wiz'; el.className = 'piw-panel'; canvas.parentElement.appendChild(el);
                el.addEventListener('mousedown', (e) => e.stopPropagation()); el.addEventListener('keydown', (e) => e.stopPropagation());
                el.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = +b.dataset.i; piWAct(a, i, b); }); }
            const names = { tal: 'Talus', bat: 'Bâtiments', lay: 'Calques' }, lenM = (sh) => { let L = 0; for (let k = 1; k < sh.points.length; k++) L += Math.hypot(sh.points[k].x - sh.points[k - 1].x, sh.points[k].y - sh.points[k - 1].y); return worldToMm(L) / 1000; };
            const btn = (a, i, t, tip, cls) => `<button type="button" class="piw-b${cls ? ' ' + cls : ''}" data-a="${a}" data-i="${i}" title="${E(tip || '')}">${t}</button>`;
            let body = '';
            if (st === 'tal') { const T = piTalList();
                body = `<p class="piw-p">Chaque ligne de rupture a son altitude sommet par sommet, lue sur les cotes du plan. Vérifie-les : clic sur une ligne pour la voir, poignées pour la corriger, 🗑 pour l'enlever.</p>
                    <div class="piw-h">${T.length} ligne(s) de rupture</div><div class="piw-list">` + (T.map((sh, i) => { const z = sh.points.map(q => q.z).filter(hasZ); return `<div class="piw-row${selectedShapes.includes(sh) ? ' on' : ''}" data-a="see" data-i="${i}"><span class="piw-n">${E(sh.name || 'Ligne ' + (i + 1))}</span><span class="piw-s">${nfr(lenM(sh), 1)} m · ${z.length ? nfr(Math.min(...z) / 1000, 2) + ' → ' + nfr(Math.max(...z) / 1000, 2) : 'sans Z'}</span>${btn('del', i, ICO('trash', 14), 'Supprimer cette ligne', 'ico')}</div>`; }).join('') || '<div class="piw-s" style="padding:6px">Aucune ligne.</div>') + `</div>
                    ${btn('brk', 0, '+ Ligne de rupture', 'Tracer une ligne de rupture : ses sommets prennent l\'altitude des cotes ou du terrain', 'wide')}`; }
            else if (st === 'bat') { const B = batList(), on = mode === 'pline' && batDraw;
                body = `<p class="piw-p">Les cotes relevées sur les toits ne sont pas du terrain. <b>+ BÂTIMENT</b>, puis un clic dans chaque bâtiment : la forme reconnue s'éclaire au survol (zone hachurée, sinon contour fermé), sa hauteur est demandée en NGF ou en H. Autant de bâtiments que tu veux : l'étape ne bouge pas tant que tu ne cliques pas sur Suivant.</p>
                    ${btn('bat', 0, on ? '■ Arrêter les clics' : '+ BÂTIMENT', on ? 'Arrêter d\'ajouter des bâtiments' : 'Cliquer des bâtiments sur le plan', 'wide pri')}
                    <div class="piw-h">${B.length} bâtiment(s)</div><div class="piw-list">` + (B.map((b, i) => { const base = b.s.points[0].z || 0, top = base + (b.s.solid ? b.s.solid.H : 0); return `<div class="piw-row${selectedShapes.includes(b.s) ? ' on' : ''}" data-a="seeb" data-i="${i}"><span class="piw-n">${i + 1}. ${E(b.s.name || 'Bâtiment')}</span><span class="piw-s">${nfr(top / 1000, 2)} NGF · H ${nfr((top - base) / 1000, 2)}</span>${btn('hb', i, ICO('height', 14), 'Hauteur (NGF ou H)', 'ico')}${btn('delb', i, ICO('trash', 14), 'Supprimer ce bâtiment', 'ico')}</div>`; }).join('') || '<div class="piw-s" style="padding:6px">Aucun bâtiment pour l\'instant.</div>') + '</div>'; }
            else { const C = piLayCats(); if (!piW.cfg) { piW.cfg = { common: piW.plan + ' — topo' }; C.forEach(c => { piW.cfg[c.k] = { own: true, name: c.name }; }); }
                body = `<p class="piw-p">Où ranger ce qui a été importé ? Un calque à part par élément (pratique pour masquer ou exclure du terrain), ou tout dans un calque commun.</p>`
                    + C.map(c => { const g = piW.cfg[c.k]; return `<div class="piw-lay"><label class="piw-ck"><input type="checkbox" data-k="${c.k}" data-f="own" ${g.own ? 'checked' : ''}${c.fixed ? ' disabled' : ''}> <b>${PI_CAT[c.k][0]}</b> <span class="piw-s">${c.n} objet(s)</span></label>`
                        + (c.fixed ? `<div class="piw-s">${E(c.fixed)}</div>` : g.own ? `<input type="text" class="piw-in" data-k="${c.k}" data-f="name" value="${E(g.name)}" title="Nom du calque">` : '<div class="piw-s">→ calque commun</div>') + '</div>'; }).join('')
                    + (C.some(c => !piW.cfg[c.k].own) ? `<div class="piw-h" style="margin-top:8px">Calque commun</div><input type="text" class="piw-in" data-k="common" data-f="name" value="${E(piW.cfg.common)}">` : ''); }
            const dots = piW.steps.map((k, i) => `<span class="piw-dot${i === piW.i ? ' on' : i < piW.i ? ' ok' : ''}">${i < piW.i ? '✓' : i + 1}</span><span class="piw-dl${i === piW.i ? ' on' : ''}">${names[k]}</span>`).join('<span class="piw-sep"></span>');
            el.innerHTML = `<div class="piw-top"><b>📍 Import du plan PDF</b>${btn('close', 0, '✕', 'Fermer l\'assistant (ce qui est fait reste)', 'x')}</div><div class="piw-steps">${dots}</div><div class="piw-body">${body}</div>
                <div class="piw-foot">${piW.i ? btn('prev', 0, '‹ Précédent', '') : '<span></span>'}${btn('next', 0, st === 'lay' ? 'Terminer ✓' : 'Suivant ›', '', 'pri')}</div>`;
            el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('change', () => { const k = inp.dataset.k; if (k === 'common') piW.cfg.common = inp.value.trim() || piW.cfg.common; else if (inp.dataset.f === 'own') { piW.cfg[k].own = inp.checked; piWRender(); } else piW.cfg[k].name = inp.value.trim() || piW.cfg[k].name; })); }
        function piWAct(a, i, b) {
            if (a === 'close') { piWClose(); return; } if (a === 'next') { piWGo(1); return; } if (a === 'prev') { piWGo(-1); return; }
            const focus = (sh) => { selectedShapes = [sh]; const bb = getShapesBoundingBox([sh]); if (bb) { const r = canvas.width, h = canvas.height, w = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY, mmToWorld(10000)) * 3, z = Math.min(r, h) / w; camera.zoom = Math.min(camera.zoom * 4, Math.max(camera.zoom / 4, z)); camera.x = canvas.width / 2 - bb.centerX * camera.zoom; camera.y = canvas.height / 2 - bb.centerY * camera.zoom; } draw(); piWRender(); };
            if (a === 'see') { const sh = piTalList()[i]; if (sh) focus(sh); }
            else if (a === 'del') { const sh = piTalList()[i]; if (sh) { shapes = shapes.filter(x => x !== sh); selectedShapes = []; tinCache = null; invalidateCache(); saveState(); draw(); piWRender(); } }
            else if (a === 'brk') { if (mode !== 'select-box') setMode('select-box'); activeLayerId = piW.lay.tal; updateLayerUI(); setMode('pline'); brkDraw = true; updateCommandMessage(); }
            else if (a === 'bat') { if (mode === 'pline' && batDraw) { isDrawing = false; currentPolygon = []; setMode('select-box'); } else batStart(); piWRender(); }
            else if (a === 'seeb') { const B = batList()[i]; if (B) focus(B.s); }
            else if (a === 'hb') { const B = batList()[i]; if (B) batHeightAsk(B.s); }
            else if (a === 'delb') { const B = batList()[i]; if (B) { shapes = shapes.filter(x => x !== B.s); selectedShapes = []; tinCache = null; invalidateCache(); saveState(); if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene(); draw(); piWRender(); } } }
        // catégories présentes et leur calque actuel
        function piLayCats() { const out = [], cnt = (f) => shapes.filter(f).length;
            if (piW.lay.pts) { const L = layers.find(l => l.id === piW.lay.pts); out.push({ k: 'pts', id: piW.lay.pts, n: cnt(x => x.type === 'point' && x.layerId === piW.lay.pts), name: 'Topo' + (L && L.name !== 'Points topo (PDF)' ? '' : '') }); }
            const T = piTalList(); if (T.length) out.push({ k: 'tal', id: piW.lay.tal, n: T.length, name: 'Talus' });
            const B = batList(); if (B.length) out.push({ k: 'bat', ids: [...new Set(B.map(b => b.s.layerId || 'layer-0'))], n: B.length, name: 'Bâti' });
            if (piW.lay.trc.length) out.push({ k: 'trc', ids: piW.lay.trc, n: shapes.filter(x => x.type === 'pdfvec' && piW.lay.trc.includes(x.layerId)).length, name: piW.lay.trc.length === 1 ? ((layers.find(l => l.id === piW.lay.trc[0]) || {}).name || piW.plan) : piW.plan, fixed: piW.lay.trc.length > 1 ? 'Gardés dans leurs ' + piW.lay.trc.length + ' calques (un par calque du PDF).' : '' });
            return out; }
        // range chaque catégorie dans son calque (renommé, nouveau ou commun) ; les calques d'import vidés disparaissent
        function piLayApply() {
            if (!piW || !piW.cfg) return; const C = piLayCats(), moved = [], olds = new Set();
            const target = (name, col) => { const L = layers.find(l => l.name === name); return L ? L.id : ensureLayer(name, col); };
            C.forEach(c => { const g = piW.cfg[c.k]; if (!g || c.fixed) return; const col = { pts: '#bef264', tal: '#fb923c', bat: '#f87171', trc: '#d1d5db' }[c.k];
                const tid = g.own ? target(g.name, col) : target(piW.cfg.common, '#e5e7eb'), ids = c.id ? [c.id] : c.ids;
                const sel = c.k === 'pts' ? (x) => x.type === 'point' && ids.includes(x.layerId) : c.k === 'tal' ? (x) => x.type === 'poly' && x.open && ids.includes(x.layerId) : c.k === 'bat' ? (x) => x.batEx && ids.includes(x.layerId || 'layer-0') : (x) => x.type === 'pdfvec' && ids.includes(x.layerId);
                shapes.forEach(x => { if (sel(x) && x.layerId !== tid) { x.layerId = tid; moved.push(x); } }); ids.forEach(id => { if (id !== tid) olds.add(id); }); });
            olds.forEach(id => { if (id !== 'layer-0' && !shapes.some(x => (x.layerId || 'layer-0') === id)) { layers = layers.filter(l => l.id !== id); if (activeLayerId === id) activeLayerId = layers[0].id; } });
            tinCache = null; invalidateCache(); updateLayerUI(); saveState(); draw();
            updateCommandMessageText('IMPORT DU PLAN PDF terminé : ' + C.map(c => PI_CAT[c.k][0].toLowerCase() + ' → « ' + (c.fixed ? 'leurs calques' : piW.cfg[c.k].own ? piW.cfg[c.k].name : piW.cfg.common) + ' »').join(', ') + '. Ctrl+Z pour annuler.'); }
        function batStart() { selectedShapes = []; if (mode !== 'select-box') setMode('select-box'); batFromSel(); batBar(); draw(); }
        let batN0 = 0;
        function batBar(off) { let b = document.getElementById('bat-bar'); if (off || !(mode === 'pline' && batDraw)) { if (b) b.remove(); batCand = null; return; }
            if (!b) { batN0 = batList().length; b = document.createElement('div'); b.id = 'bat-bar'; b.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:22;display:flex;align-items:center;gap:10px;background:rgba(17,24,39,.94);border:1px solid #f87171;border-radius:999px;padding:5px 6px 5px 14px;color:#fecaca;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.4)';
                canvas.parentElement.appendChild(b); b.addEventListener('click', (e) => { if (e.target.closest('button')) { batBar(true); if (mode === 'pline') { isDrawing = false; currentPolygon = []; setMode('select-box'); } draw(); updateCommandMessageText('BÂTIMENTS : ' + batList().length + ' bâtiment(s) existant(s).'); if (piW) piWRender(); } }); }
            const n = batList().length - batN0; b.innerHTML = '🏠 <span>Bâtiments : <b>' + n + '</b> ajouté' + (n > 1 ? 's' : '') + ' · clic dans un bâtiment</span><button type="button" style="background:#dc2626;color:#fff;border-radius:999px;padding:3px 12px;font-weight:600">Terminer</button>'; }
        // bâtiments du plan PDF : contours fermés des calques « Bâti », « Bâtiment », « Construction »… (pas les hachures, débords de toit ni textes).
        // Les traits bout à bout sont recousus (à 1 pt près) ; renvoie des contours en coordonnées de page normalisées (0..1)
        const pdfBatLayer = (n) => /(^|[^a-z])(3?bati(dur)?|b[aâ]timents?|constructions?|maisons?|immeubles?|building)s?([^a-z]|$)/i.test(n || '') && !/(_h|hach|surplomb|debord|débord|txt|texte|toit|cote|z[-_ ])/i.test(n || '');

        // bâtiments HACHURÉS (plans sans calques, ou calques sans nom parlant) : des traits parallèles régulièrement espacés = l'intérieur d'un bâtiment.
        // Chaque famille de hachures devient une tache (bandes entre les traits, trous bouchés), dont on suit le bord ; le contour est simplifié,
        // puis ses sommets sont recalés sur les vrais coins du dessin. Entrée et sortie en unités de page.
        function hatchRegions(polys) {
            const S = []; for (const pl of polys) for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], b = pl[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (!(L >= 3)) continue; let an = Math.atan2(dy, dx); if (an < 0) an += Math.PI; if (an >= Math.PI - 1e-9) an -= Math.PI; S.push({ a, b, L, an }); }
            if (S.length < 6 || S.length > 400000) return [];
            const bins = new Map(); S.forEach((q, i) => { const k = Math.round(q.an * 180 / Math.PI) % 180; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(i); });
            const used = new Uint8Array(S.length), res = [], hatchSeg = new Uint8Array(S.length);
            [...bins.keys()].sort((p, q) => bins.get(q).length - bins.get(p).length).forEach(k => {
                let C = []; [k - 1, k, k + 1].forEach(kk => (bins.get((kk + 180) % 180) || []).forEach(i => { if (!used[i]) C.push(i); })); if (C.length < 6) return;
                const th = C.reduce((m, i) => { let d = S[i].an - k * Math.PI / 180; if (d > Math.PI / 2) d -= Math.PI; if (d < -Math.PI / 2) d += Math.PI; return m + d; }, 0) / C.length + k * Math.PI / 180;
                const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
                C = C.filter(i => { let d = S[i].an - th; d = ((d % Math.PI) + Math.PI * 1.5) % Math.PI - Math.PI / 2; return Math.abs(d) < 0.9 * Math.PI / 180; });
                const R = C.map(i => { const q = S[i], ta = q.a[0] * ux + q.a[1] * uy, tb = q.b[0] * ux + q.b[1] * uy; return { i, d: ((q.a[0] + q.b[0]) * nx + (q.a[1] + q.b[1]) * ny) / 2, t0: Math.min(ta, tb), t1: Math.max(ta, tb), L: q.L }; }).sort((p, q) => p.d - q.d);
                const par = R.map((_, j) => j), f = (j) => { while (par[j] !== j) j = par[j] = par[par[j]]; return j; }, gaps = [];
                for (let j = 0; j < R.length; j++) { const A = R[j]; let best = -1, bg = Infinity;
                    for (let m = j + 1; m < R.length && R[m].d - A.d <= 15; m++) { const B = R[m], g = B.d - A.d; if (g < 0.4) continue; const ov = Math.min(A.t1, B.t1) - Math.max(A.t0, B.t0); if (ov < 0.3 * Math.min(A.L, B.L)) continue; if (g < bg) { bg = g; best = m; } }
                    if (best >= 0) { par[f(best)] = f(j); gaps.push([j, best, bg]); } }
                const comp = new Map(); R.forEach((_, j) => { const r = f(j); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(j); });
                comp.forEach(J => { if (J.length < 6) return; const inJ = new Set(J), G = gaps.filter(g => inJ.has(g[0])).map(g => g[2]).sort((p, q) => p - q); if (G.length < 5) return;
                    const sp = G[G.length >> 1], reg = G.filter(g => Math.abs(g - sp) <= 0.25 * sp).length / G.length, Ls = J.map(j => R[j].L).sort((p, q) => p - q), Lm = Ls[Ls.length >> 1];
                    const dmin = Math.min(...J.map(j => R[j].d)), dmax = Math.max(...J.map(j => R[j].d));
                    if (reg < 0.6 || Lm < 3 * sp || dmax - dmin < 4 * sp) return;
                    J.forEach(j => { used[R[j].i] = 1; hatchSeg[R[j].i] = 1; });
                    // tache : grille dans le repère des hachures (t le long, d en travers), maille sp/2
                    const c = sp / 2, t0 = Math.min(...J.map(j => R[j].t0)), t1 = Math.max(...J.map(j => R[j].t1)), d0 = dmin - sp, nxg = Math.ceil((t1 - t0) / c) + 3, nyg = Math.ceil((dmax + sp - d0) / c) + 3;
                    if (nxg * nyg > 4e6) return; const g = new Uint8Array(nxg * nyg);
                    J.forEach(j => { const r = R[j], ya = Math.max(0, Math.floor((r.d - 0.6 * sp - d0) / c) + 1), yb = Math.min(nyg - 2, Math.floor((r.d + 0.6 * sp - d0) / c) + 1), xa = Math.max(1, Math.round((r.t0 - t0) / c) + 1), xb = Math.min(nxg - 2, Math.round((r.t1 - t0) / c) + 1);
                        for (let y = Math.max(1, ya); y <= yb; y++) for (let x = xa; x < xb; x++) g[y * nxg + x] = 1; });
                    const out = new Uint8Array(nxg * nyg), st = [0]; out[0] = 1; while (st.length) { const p = st.pop(), x = p % nxg, y = (p / nxg) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const xx = x + a, yy = y + b; if (xx < 0 || yy < 0 || xx >= nxg || yy >= nyg) return; const q = yy * nxg + xx; if (!out[q] && !g[q]) { out[q] = 1; st.push(q); } }); }
                    for (let q = 0; q < g.length; q++) if (!out[q]) g[q] = 1;
                    // bord de la tache : arêtes de cellules (plein à gauche), chaînées ; on garde la plus longue boucle
                    const nxt = new Map(), key = (x, y) => y * (nxg + 1) + x, on = (x, y) => x >= 0 && y >= 0 && x < nxg && y < nyg && g[y * nxg + x];
                    for (let y = 0; y < nyg; y++) for (let x = 0; x < nxg; x++) { if (!g[y * nxg + x]) continue;
                        if (!on(x, y - 1)) nxt.set(key(x + 1, y), key(x, y)); if (!on(x + 1, y)) nxt.set(key(x + 1, y + 1), key(x + 1, y)); if (!on(x, y + 1)) nxt.set(key(x, y + 1), key(x + 1, y + 1)); if (!on(x - 1, y)) nxt.set(key(x, y), key(x, y + 1)); }
                    const seen = new Set(); let loop = null; nxt.forEach((_, s0) => { if (seen.has(s0)) return; const L = []; let p = s0; for (let it = 0; it < 1e6 && !seen.has(p) && nxt.has(p); it++) { seen.add(p); L.push(p); p = nxt.get(p); } if (!loop || L.length > loop.length) loop = L; });
                    if (!loop || loop.length < 4) return;
                    let pts = loop.map(p => { const x = p % (nxg + 1), y = (p / (nxg + 1)) | 0, t = t0 + (x - 1) * c, d = d0 + (y - 1) * c; return [t * ux + d * nx, t * uy + d * ny]; });
                    pts = dpSimplify(pts, 0.75 * sp); if (pts.length >= 3) res.push({ pts, sp }); });
            });
            if (!res.length) return [];
            // sommets recalés sur le coin du dessin le plus proche (traits qui ne sont pas des hachures)
            const cell = 6, grid = new Map(), add = (p) => { const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); };
            S.forEach((q, i) => { if (!hatchSeg[i]) { add(q.a); add(q.b); } });
            return res.map(({ pts, sp }) => { const Rr = Math.min(1.6 * sp, 6); return pts.map(p => { let best = null, bd = Rr; const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
                for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of (grid.get((gx + i) + ',' + (gy + j)) || [])) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } }
                return best ? [best[0], best[1]] : p; }).filter((p, i, A) => { const q = A[(i + 1) % A.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05; }); }).map((P2, i) => dpSimplify(P2, 0.6 * res[i].sp)).filter(P2 => P2.length >= 3); }
        function dpSimplify(P, tol) {   // Douglas-Peucker sur une boucle fermée
            if (P.length < 4) return P; let a = 0, b = 0, m = -1; P.forEach((p, i) => { const d = Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); if (d > m) { m = d; b = i; } });
            const seg = (Q) => { if (Q.length < 3) return Q; const A = Q[0], B = Q[Q.length - 1], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1e-9; let k = -1, dm = 0;
                for (let i = 1; i < Q.length - 1; i++) { const d = Math.abs((Q[i][0] - A[0]) * dy - (Q[i][1] - A[1]) * dx) / l; if (d > dm) { dm = d; k = i; } }
                if (dm <= tol) return [A, B]; const L1 = seg(Q.slice(0, k + 1)), L2 = seg(Q.slice(k)); return L1.slice(0, -1).concat(L2); };
            const s1 = seg(P.slice(a, b + 1)), s2 = seg(P.slice(b).concat([P[0]])); return s1.slice(0, -1).concat(s2.slice(0, -1)); }
        // bâtiments hachurés d'un tracé PDF importé (pdfvec), gardés pour la séance
        const vecHatchCache = {};
        function vecHatchBats(pv) { const id = pv.vecId; if (vecHatchCache[id]) return vecHatchCache[id]; const v = vecStore[id]; if (!v) return [];
            const L = [], { xy, st, cl } = v; for (let i = 0; i < st.length - 1; i++) { const pl = []; for (let k = st[i]; k < st[i + 1]; k++) pl.push([xy[2 * k], xy[2 * k + 1]]); if (cl[i] && pl.length > 2) pl.push(pl[0]); L.push(pl); }
            let R = []; try { R = hatchRegions(L); } catch (e) { console.warn('hachures', e); }
            return (vecHatchCache[id] = R.map(P2 => P2.map(p => [p[0] / v.W, p[1] / v.H]))); }
        function pdfBats(V) { if (!V || !V.P) return []; const W = V.W, H = V.H, byLayer = V.ocg ? pdfBatsLayer(V) : [];
            if (byLayer.length) return byLayer;   // sans calque « Bâti » : les bâtiments hachurés
            let R = []; try { R = hatchRegions(V.P.filter(q => !q.f && q.p.length >= 2).map(q => { const p = q.p.map(u => [u[0] * W, u[1] * H]); if (q.c) p.push(p[0]); return p; })); } catch (e) { console.warn('hachures', e); }
            return R.filter(L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } a = Math.abs(a / 2); return a > 30 && a < W * H * 0.25; }).map(L => { const o = L.map(p => [p[0] / W, p[1] / H]); o.h = 1; return o; }); }
        function pdfBatsLayer(V) { const W = V.W, H = V.H, P = V.P.filter(q => !q.f && q.p.length >= 2 && pdfBatLayer(V.L[q.l])).map(q => { const p = q.p.map(u => [u[0] * W, u[1] * H]); if (q.c) p.push(p[0]); return p; });
            return batOutlines(P, 1.0).filter(L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } a = Math.abs(a / 2); return a > 30 && a < W * H * 0.25; }).map(L => L.map(p => [p[0] / W, p[1] / H])); }
        // contour extérieur de chaque bâtiment, à partir de traits en vrac : les murs d'une aile accrochés au milieu d'un autre mur (en T), les refends
        // et lignes de faîtage intérieures, les bouts qui ne se rejoignent pas à un poil près... Les traits sont recousus en un réseau (sommets fusionnés à tol près,
        // murs coupés là où un autre trait les touche), les bouts pendants retirés, puis on fait le tour de chaque ensemble de traits reliés.
        function batOutlines(P, tol, at) {   // at = [x, y, aire max] : seulement la plus petite face qui contient ce point
            const V = [], key = (x, y) => Math.floor(x / tol) + ',' + Math.floor(y / tol), G = new Map();
            const vtx = (x, y) => { const gx = Math.floor(x / tol), gy = Math.floor(y / tol); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of (G.get((gx + i) + ',' + (gy + j)) || [])) if (Math.hypot(V[k][0] - x, V[k][1] - y) < tol) return k;
                V.push([x, y]); const kk = key(x, y); if (!G.has(kk)) G.set(kk, []); G.get(kk).push(V.length - 1); return V.length - 1; };
            let S = []; P.forEach(pl => { for (let i = 1; i < pl.length; i++) { const a = vtx(pl[i - 1][0], pl[i - 1][1]), b = vtx(pl[i][0], pl[i][1]); if (a !== b) S.push([a, b]); } });
            if (S.length > (at ? 8000 : 20000)) return [];
            // jonctions en T : un sommet posé sur un mur le coupe en deux
            const CG = 16, VG = new Map(); V.forEach((p, k) => { const kk = Math.floor(p[0] / CG) + ',' + Math.floor(p[1] / CG); if (!VG.has(kk)) VG.set(kk, []); VG.get(kk).push(k); });   // grille des sommets : jonctions en T trouvées sans tout parcourir
            for (let changed = true, guard = 0; changed && guard < 5; guard++) { changed = false; const out = [];
                for (const [a, b] of S) { const A = V[a], B = V[b], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy; const cut = [];
                    const gx0 = Math.floor((Math.min(A[0], B[0]) - tol) / CG), gx1 = Math.floor((Math.max(A[0], B[0]) + tol) / CG), gy0 = Math.floor((Math.min(A[1], B[1]) - tol) / CG), gy1 = Math.floor((Math.max(A[1], B[1]) + tol) / CG); for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) for (const k of (VG.get(gx + ',' + gy) || [])) { if (k === a || k === b) continue; const X = V[k]; if (X[0] < Math.min(A[0], B[0]) - tol || X[0] > Math.max(A[0], B[0]) + tol || X[1] < Math.min(A[1], B[1]) - tol || X[1] > Math.max(A[1], B[1]) + tol) continue;
                        const t = ((X[0] - A[0]) * dx + (X[1] - A[1]) * dy) / l2; if (t <= 0 || t >= 1) continue; if (Math.hypot(A[0] + t * dx - X[0], A[1] + t * dy - X[1]) < tol) cut.push([t, k]); }
                    if (!cut.length) { out.push([a, b]); continue; } changed = true; cut.sort((u, v) => u[0] - v[0]); let prev = a; cut.forEach(([, k]) => { if (k !== prev) out.push([prev, k]); prev = k; }); if (prev !== b) out.push([prev, b]); }
                S = out; }
            const E = new Map(), ek = (a, b) => a < b ? a + '_' + b : b + '_' + a; S.forEach(([a, b]) => E.set(ek(a, b), [a, b]));
            const adj = new Map(), link = () => { adj.clear(); E.forEach(([a, b]) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); }); };
            link(); for (let again = true; again;) { again = false; adj.forEach((n, v) => { if (n.size < 2) { n.forEach(w => E.delete(ek(v, w))); again = again || n.size > 0; } }); link(); }   // bouts pendants
            const nb = new Map(); adj.forEach((n, v) => nb.set(v, [...n].sort((p, q) => Math.atan2(V[p][1] - V[v][1], V[p][0] - V[v][0]) - Math.atan2(V[q][1] - V[v][1], V[q][0] - V[v][0]))));
            const used = new Set(), faces = [];
            E.forEach(([a0, b0]) => { [[a0, b0], [b0, a0]].forEach(([u0, v0]) => { if (used.has(u0 + '>' + v0)) return; const cyc = []; let u = u0, v = v0;
                for (let g = 0; g < 100000; g++) { used.add(u + '>' + v); cyc.push(u); const L = nb.get(v), i = L.indexOf(u), w = L[(i - 1 + L.length) % L.length]; u = v; v = w; if (u === u0 && v === v0) break; }
                let ar = 0; for (let i = 0; i < cyc.length; i++) { const p = V[cyc[i]], q = V[cyc[(i + 1) % cyc.length]]; ar += p[0] * q[1] - q[0] * p[1]; } faces.push({ cyc, ar: ar / 2 }); }); });
            // ensembles de traits reliés : on garde le plus grand tour de chacun (son contour extérieur)
            const comp = new Map(); let nc = 0; adj.forEach((n, v) => { if (comp.has(v)) return; const st = [v]; comp.set(v, nc); while (st.length) { const x = st.pop(); adj.get(x).forEach(y => { if (!comp.has(y)) { comp.set(y, nc); st.push(y); } }); } nc++; });
            const best = new Map(); faces.forEach(f => { const c = comp.get(f.cyc[0]), o = best.get(c); if (!o || Math.abs(f.ar) > Math.abs(o.ar)) best.set(c, f); });
            if (at) { let pick = null; faces.forEach(f => { const pts = f.cyc.map(k => V[k]), A = Math.abs(f.ar); if (A < 1 || A > at[2]) return; let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > at[1]) !== (b[1] > at[1]) && at[0] < (b[0] - a[0]) * (at[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } if (ins && (!pick || A < pick.A)) pick = { pts, A }; });
                return pick ? [pick.pts] : []; }
            const out = []; best.forEach(f => { const pts = f.cyc.map(k => V[k]); const cl = pts.filter((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-6 * (1 + Math.hypot(b[0] - a[0], b[1] - a[1])); });
                if (cl.length >= 3) out.push(cl); }); return out; }
        // contours retenus, en coordonnées du dessin : assez grands (pas un poteau ni un repère) et près des cotes du plan (pas une case de légende du cartouche)
        function pdfBatPolys(s, Z) { const out = [], d = mmToWorld(20000), k = worldToMm(1) / 1000; (s.pdfBat || []).forEach(L => { const pts = L.map(u => { const q = bgUV(s, u[0], u[1]); return { x: q.x, y: q.y }; });
                const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length; let a = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }); const am2 = Math.abs(a / 2) * k * k;
                if (am2 < 8 || !Z.some(q => Math.hypot(q.x - cx, q.y - cy) < d + Math.sqrt(am2) * mmToWorld(1000))) return;
                let per = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; per += Math.hypot(q.x - p.x, q.y - p.y); }); if (2 * am2 / (per * k) < 1.2) return;   // une bande étroite (mur, haie, clôture hachurés) n'est pas un bâtiment
                if (L.h) { const r5 = mmToWorld(5000); if (!Z.some(q => pointInPolygon(q.x, q.y, pts) || batEdgeDist(pts, q.x, q.y) < r5)) return; }   // hachures : un bâtiment du levé a des cotes dedans ou tout autour
                out.push({ pts, cx, cy }); }); return out; }
        function pdfBatPlace(s, lo, hi, pos) { const Z = pdfZPoints(s, lo, hi, pos), B = pdfBatPolys(s, Z); if (!B.length) return 'aucun bâtiment'; const lid = ensureLayer('Bâtiments (PDF)', '#f87171'), have = batList(); let n = 0, skip = 0;
            const area = (P) => { let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; }); return Math.abs(a / 2); }; let upd = 0;
            B.forEach(({ pts, cx, cy }) => { const old = have.map(b => b.s).find(o => { const c = o.points.reduce((a, q) => ({ x: a.x + q.x / o.points.length, y: a.y + q.y / o.points.length }), { x: 0, y: 0 }); return pointInPolygon(c.x, c.y, pts) || pointInPolygon(cx, cy, o.points); });
                if (old) { if (area(old.points) < area(pts) * 0.95 && pointInPolygon(old.points.reduce((a, q) => a + q.x, 0) / old.points.length, old.points.reduce((a, q) => a + q.y, 0) / old.points.length, pts)) { old.points = pts.map(q => ({ x: q.x, y: q.y })); batMake(old, Z, false); upd++; } else skip++; return; }   // un bâtiment déjà marqué, plus petit (une partie seulement) : il prend le contour complet
                const sh = { type: 'poly', layerId: lid, points: pts, open: false, color: '#f87171', hatch: false }; shapes.push(sh); batMake(sh, Z); n++; });
            return n + ' bâtiment(s) existant(s) sur le calque « Bâtiments (PDF) » (leurs cotes de toit sorties du terrain)' + (upd ? ', ' + upd + ' complété(s)' : '') + (skip ? ', ' + skip + ' déjà présent(s)' : ''); }
        // altitudes connues du plan, en coordonnées du dessin (mêmes règles que les points topo : plage d'altitudes, repère ou texte)
        function pdfZPoints(s, lo, hi, pos) { const D = s.pdfTopo, out = []; if (!D) return out;
            D.t.forEach((r, i) => { const v = r[2]; if (isFinite(lo) && v < lo) return; if (isFinite(hi) && v > hi) return; const m = D.m[i]; if (pos === 'mo' && !m) return; const uv = pos === 't' || !m ? r : m, q = bgUV(s, uv[0], uv[1]); out.push({ x: q.x, y: q.y, z: Math.round(v * 1000) }); }); return out; }
        // une ligne de rupture : sommets tous les mètres, plus un sommet sur chaque cote posée sur la ligne ; Z interpolé le long de la ligne entre ces cotes
        function pdfBreakline(P, Q, tol, tin) {
            if (P.length < 2) return null; const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y)); const Lt = cum[cum.length - 1]; if (Lt <= 0) return null;
            const hits = []; Q.forEach(q => { let bd = tol, bt = -1; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; if (!l2) continue; const u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)), d = Math.hypot(a.x + u * dx - q.x, a.y + u * dy - q.y); if (d < bd) { bd = d; bt = cum[i - 1] + u * Math.sqrt(l2); } } if (bt >= 0) hits.push({ t: bt, z: q.z }); });
            if (hits.length < 2 && tin) { const st = mmToWorld(2000); for (let t = 0; t <= Lt; t += st) { let i = 1; while (i < cum.length - 1 && cum[i] < t) i++; const a = P[i - 1], b = P[i], f = cum[i] - cum[i - 1] > 0 ? (t - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0, z = tinZ(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, tin); if (z !== undefined && !hits.some(h => Math.abs(h.t - t) < st / 2)) hits.push({ t, z: Math.round(z) }); } }   /* une seule cote sur la ligne : le reste vient du terrain des points voisins */
            if (!hits.length || Lt / mmToWorld(1000) > 20000) return null; hits.sort((a, b) => a.t - b.t);
            const zAtT = (t) => { if (t <= hits[0].t) return hits[0].z; const l = hits[hits.length - 1]; if (t >= l.t) return l.z; let k = 1; while (hits[k].t < t) k++; const A = hits[k - 1], B = hits[k]; return B.t - A.t < 1e-9 ? B.z : Math.round(A.z + (B.z - A.z) * (t - A.t) / (B.t - A.t)); };
            const step = mmToWorld(1000), ts = new Set(cum.map(t => Math.round(t * 1000) / 1000)); for (let t = step; t < Lt; t += step) ts.add(Math.round(t * 1000) / 1000); hits.forEach(h => ts.add(Math.round(h.t * 1000) / 1000));
            const at = (t) => { let i = 1; while (i < cum.length - 1 && cum[i] < t) i++; const a = P[i - 1], b = P[i], f = cum[i] - cum[i - 1] > 0 ? (t - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; };
            return { pts: [...ts].sort((a, b) => a - b).map(t => Object.assign(at(t), { z: zAtT(t) })), n: hits.length };
        }
        function pdfTalusPlace(s, lo, hi, pos) {
            const TL = s.pdfTalus || []; if (!TL.length) return 'aucun talus reconnu'; const Q = pdfZPoints(s, lo, hi, pos), lid = ensureLayer('Talus (PDF)', '#fb923c'), tol = mmToWorld(500); let n = 0, nz = 0; let tinQ = null; try { tinQ = buildTIN(Q.slice(0, 8000)); } catch (e) {}
            const lenW = (P2) => { let L = 0; for (let i = 1; i < P2.length; i++) L += Math.hypot(P2[i].x - P2[i - 1].x, P2[i].y - P2[i - 1].y); return L; }, zAvg = (B) => B.pts.reduce((a, q) => a + q.z, 0) / B.pts.length, minL = mmToWorld(2000); let flat = 0, short = 0;
            TL.forEach((t, k) => { const B = {}; ['h', 'p'].forEach(key => { if (!t[key]) return; const pl = t[key].map(u => bgUV(s, u[0], u[1])); if (lenW(pl) < minL) { short++; return; } const b = pdfBreakline(pl, Q, tol, tinQ); if (!b) { nz++; return; } B[key] = b; });
                if (B.h && B.p && Math.abs(zAvg(B.h) - zAvg(B.p)) < 100) { flat++; return; }   // tête et pied à la même altitude : un mur, une haie, un escalier… pas un talus
                [['h', 'Tête de talus'], ['p', 'Pied de talus']].forEach(([key, nm]) => { if (!B[key]) return; shapes.push({ type: 'poly', layerId: lid, points: B[key].pts, open: true, hatch: false, zk: 1, name: nm + ' ' + (k + 1), dash: key === 'p' ? 'dashed' : undefined }); n++; }); });
            return n + ' ligne(s) de rupture (têtes et pieds de talus) sur le calque « Talus (PDF) »' + (nz ? ', ' + nz + ' sans cote sur la ligne, écartée(s)' : '') + (short + flat ? ', ' + (short + flat) + ' fausse(s) (trop courte(s) ou sans dénivelé) écartée(s)' : '');
        }
        function pdfTracesPlace(s, split) {
            const V = pdfVecCache[s.mapId]; if (!V) return 'tracés : PDF non relu'; const plan = pdfPlanName(s), D = s.pdfTopo;
            // sans calques dans le PDF : les petits repères des points topo sont écartés (ils sont déjà des points)
            const mk = (!V.ocg && D) ? D.m.filter(Boolean) : [], mkSet = new Map(); mk.forEach(m => { const k = Math.round(m[0] * V.W / 2) + ',' + Math.round(m[1] * V.H / 2); if (!mkSet.has(k)) mkSet.set(k, []); mkSet.get(k).push(m); });
            const isMk = (q) => { if (!mk.length) return false; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; q.p.forEach(u => { x0 = Math.min(x0, u[0] * V.W); x1 = Math.max(x1, u[0] * V.W); y0 = Math.min(y0, u[1] * V.H); y1 = Math.max(y1, u[1] * V.H); }); if (Math.max(x1 - x0, y1 - y0) > 12) return false;
                const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, gx = Math.round(cx / 2), gy = Math.round(cy / 2); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const m of (mkSet.get((gx + dx) + ',' + (gy + dy)) || [])) if (Math.hypot(m[0] * V.W - cx, m[1] * V.H - cy) < Math.max(1.5, 0.6 * Math.max(x1 - x0, y1 - y0))) return true; return false; };
            const P = pdfChain(V.P.filter(q => !q.f && q.p.length >= 2 && !pdfTopoLayer(V.L[q.l]) && !isMk(q))); if (!P.length) return 'aucun tracé';
            const lids = new Map(), dark = (c) => { const v = parseInt(String(c).slice(1), 16); return !(v >= 0) || ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 < 70; };
            const lidFor = (q) => { const nm = split && V.ocg && q.l ? plan + ' · ' + V.L[q.l] : plan; if (!lids.has(nm)) lids.set(nm, ensureLayer(nm, split && !dark(q.col) ? q.col : '#d1d5db')); return lids.get(nm); };
            const A = bgUV(s, 0, 0), Bu = bgUV(s, 1, 0), Bv = bgUV(s, 0, 1), map = (u) => ({ x: A.x + (Bu.x - A.x) * u[0] + (Bv.x - A.x) * u[1], y: A.y + (Bu.y - A.y) * u[0] + (Bv.y - A.y) * u[1] });
            // un objet léger par calque : les traits restent rangés à part (vecStore), en points de la page, et suivent le cadre du fond
            ensureLayer.quiet = true; const by = new Map(); try { P.forEach(q => { const lid = lidFor(q); if (!by.has(lid)) by.set(lid, []); by.get(lid).push({ p: q.p.map(u => [u[0] * V.W, u[1] * V.H]), c: q.c }); }); } finally { ensureLayer.quiet = false; updateLayerUI(); }
            let n = 0; by.forEach((L, lid) => { const id = 'vec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); vecStore[id] = vecMake(V.W, V.H, L); n += L.length;
                const at = shapes.indexOf(s); shapes.splice(at >= 0 ? at + 1 : shapes.length, 0, { type: 'pdfvec', layerId: lid, vecId: id, x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot || 0, name: (layers.find(l => l.id === lid) || {}).name || plan, n: L.length }); });   /* juste au-dessus du fond, sous le dessin */
            return n + ' tracé(s) dans ' + (lids.size > 1 ? lids.size + ' calques « ' + plan + ' · … »' : 'le calque « ' + plan + ' »');
        }
        function pdfTopoPlace(s, lo, hi, pos, lname, quiet) {
            const D = s.pdfTopo, lid = ensureLayer(lname, '#bef264'), out = [], tol = mmToWorld(50); let skip = 0;
            D.t.forEach((r, i) => { const v = r[2]; if (isFinite(lo) && v < lo) return; if (isFinite(hi) && v > hi) return; const m = D.m[i]; if (pos === 'mo' && !m) return;
                const uv = pos === 't' || !m ? r : m, q = bgUV(s, uv[0], uv[1]), z = Math.round(v * 1000);
                if (shapes.some(x => x.type === 'point' && Math.hypot(x.x - q.x, x.y - q.y) < tol && Math.abs((x.z || 0) - z) < 5)) { skip++; return; }
                out.push({ type: 'point', layerId: lid, x: q.x, y: q.y, z, zk: 1 }); });
            out.forEach(p => shapes.push(p)); const m = out.length + ' point(s) topo sur le calque « ' + lname + ' »' + (skip ? ' (' + skip + ' déjà présent(s), ignoré(s))' : ''); if (quiet) return m;
            if (out.length) { invalidateCache(); try { tinCache = null; } catch (e) {} saveState(); selectedShapes = out; }
            draw(); updateCommandMessageText('POINTS TOPO : ' + m + '. Ctrl+Z pour annuler.');
        }
        function pdfTopoReload(s, then) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,application/pdf';
            inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { updateCommandMessageText('PLAN PDF : lecture du document…'); const lib = await loadPdfJs(), doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
                await pdfReadAll(s, doc, Math.min(doc.numPages, s.pdfPage || 1)); saveState(); if (then) then(); else pdfTopoDialog(s); } catch (e) { console.error(e); updateCommandMessageText('PLAN PDF : PDF illisible (' + (e.message || e) + ').'); } }; inp.click(); }
        // tout ce qui se lit dans la page : cotes et repères (gardés dans le fichier), talus (gardés), traits (gardés pour la séance)
        async function pdfReadAll(s, doc, n, topo, V0) { const N = topo ? 3 : 5; try { await busyStep('Plan PDF : lecture des traits', 1, N); const V = V0 || await pdfReadVectors(doc, n); pdfVecCache[s.mapId] = V;
                await busyStep('Plan PDF : talus', 2, N); s.pdfTalus = pdfTalus(V); await busyStep('Plan PDF : bâtiments', 3, N); s.pdfBat = pdfBats(V);
                if (!topo) { await busyStep('Plan PDF : cotes écrites en traits et en contours pleins', 4, N); const g = pdfGlyphRuns(V).concat(pdfFillGlyphRuns(V)); await busyStep('Plan PDF : cotes et repères des points', 5, N); s.pdfTopo = await pdfReadTopo(doc, n, g); } else s.pdfTopo = topo; }
            catch (e) { console.warn('traits PDF', e); if (!s.pdfTopo) s.pdfTopo = topo || await pdfReadTopo(doc, n); } finally { busyEnd(); } }
        // ---------- Calibrer : 2 points sur l'image + distance réelle ----------
        let calTarget = null, calP1 = null, calP2 = null;
        function bgLocal(s, wx, wy) { const a = -(s.rot || 0), dx = wx - s.x, dy = wy - s.y; return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }; }
        function bgCorners(s) {
            const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
            return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: s.x + u * s.w / 2 * c - v * s.h / 2 * sn, y: s.y + u * s.w / 2 * sn + v * s.h / 2 * c }));
        }
        function applyCalibration(val) {
            const d = Math.hypot(calP2.x - calP1.x, calP2.y - calP1.y);
            if (!(val > 0) || d < 1e-9 || !calTarget) return;
            const f = ((val / unitsPerSquare) * GRID_SIZE) / d;
            applyScaleToShape(calTarget, calP1.x, calP1.y, f);
            saveState();
            const t = calTarget; calTarget = null; calP1 = calP2 = null; typedInput = '';
            setMode('select-box'); selectedShapes = [t];
            updateCommandMessageText('FOND PERSO calibré : ' + fmtLen(val) + ' entre les 2 points (×' + f.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + '). Tapez 50% pour l\'éclaircir.');
            draw();
        }
        function startCalibrate() {
            const t = selectedShapes.find(x => x.type === 'bgimage'); if (!t) return;
            setMode('calibrate'); calTarget = t; selectedShapes = [t]; draw();
        }
        // Mention des sources, imprimée discrètement en bas à gauche de la feuille (obligatoire : Esri, licence Etalab)
        function basemapCredit() {
            const vis = shapes.filter(s => s.type === 'basemap' && (s.opacity === undefined || s.opacity > 0) && !(layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).visible === false);
            if (!vis.length) return '';
            const names = []; const add = (t) => { if (t && !names.includes(t)) names.push(t); };
            vis.forEach(s => { add((BM_BASES[s.base] || BM_SAT).attrib); Object.keys(BM_OVLS).forEach(k => { if (bmOvlOn(s, k)) add(BM_OVLS[k].attrib); }); });
            return 'Fond : ' + names.join(' · ');
        }
        function shapesInDrawOrder() {
            if (!shapes.some(isBg)) return shapes;
            return shapes.filter(isBg).concat(shapes.filter(s => !isBg(s)));
        }

        function toggleGrid() { showGrid = !showGrid; const svg = document.getElementById('rose-svg'); if (svg) svg.dataset.k = ''; try { updateRose(); } catch (e) {} draw(); }
        function toggleOrtho() {
            orthoMode = !orthoMode;
            const btn = document.getElementById('btn-toggle-ortho');
            if (orthoMode) { btn.classList.add('text-blue-400'); btn.classList.remove('text-gray-500'); }
            else { btn.classList.add('text-gray-500'); btn.classList.remove('text-blue-400'); }
            updateCommandMessage();
            draw();
        }

        // --- GESTION DES CALQUES ---
        // identifiant de calque toujours neuf (avant : heure + petit nombre au hasard → deux calques créés dans la même milliseconde pouvaient avoir le même et se confondre)
        let layerIdSeq = 0; function newLayerId() { let id; do { id = 'layer-' + Date.now().toString(36) + '-' + (++layerIdSeq).toString(36) + Math.random().toString(36).slice(2, 6); } while (layers.some(l => l.id === id)); return id; }
        function generateId() { return 'layer-' + Math.random().toString(36).substr(2, 9); }
        // renommer un calque : champ en place (Entrée = valider, Échap = annuler)
        function renameLayerUI(span, id) {
            const l = layers.find(x => x.id === id); if (!l || !span) return;
            const inp = document.createElement('input'); inp.type = 'text'; inp.value = l.name; inp.className = 'flex-1 min-w-0 bg-gray-900 text-white border border-sky-500 rounded px-1 py-0.5 text-sm outline-none';
            span.replaceWith(inp); inp.focus(); inp.select(); let done = false;
            const end = (ok) => { if (done) return; done = true; const v = inp.value.trim();
                if (ok && v && v !== l.name) { if (layers.some(x => x.id !== id && x.name === v)) { updateCommandMessageText('CALQUE : le nom « ' + v + ' » existe déjà.'); } else { l.name = v; saveState(); updateCommandMessageText('CALQUE renommé : ' + v + '.'); } }
                updateLayerUI(); draw(); };
            inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); });
            inp.addEventListener('blur', () => end(true));
        }
