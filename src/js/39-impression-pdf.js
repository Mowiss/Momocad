        // =====================================================================
        // IMPRESSION PDF via jsPDF
        // =====================================================================
        function performPrint(sx_screen, sy_screen) {
            document.getElementById('print-loader').classList.remove('hidden');
            setTimeout(() => {
                try {
                    const P = pageDims(), rect = getPrintRect();
                    const winX = sx_screen - rect.w / 2, winY = sy_screen - rect.h / 2;
                    // Résolution ~200 dpi, plafonnée à ~40 millions de pixels pour les grands formats (A1, A0)
                    let dpi = 200;
                    const sqIn = (P.pageW / 25.4) * (P.pageH / 25.4);
                    if (sqIn * dpi * dpi > 40e6) dpi = Math.sqrt(40e6 / sqIn);
                    const SS = (P.drawW / 25.4 * dpi) / rect.w;
                    const img = renderPrintCanvas(winX, winY, SS);    // même rendu que l'aperçu
                    const base = 'plan_momo_' + new Date().getTime();

                    if (printSettings.output !== 'pdf') {
                        // Image de la feuille entière (fond blanc, cadre, cartouche)
                        const k = dpi / 25.4;
                        const sheet = document.createElement('canvas');
                        sheet.width = Math.round(P.pageW * k); sheet.height = Math.round(P.pageH * k);
                        drawSheet(sheet.getContext('2d'), 0, 0, k, img);
                        const png = printSettings.output === 'png';
                        sheet.toBlob((blob) => {
                            const url = URL.createObjectURL(blob), a = document.createElement('a');
                            a.href = url; a.download = base + (png ? '.png' : '.jpg'); a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 2000);
                        }, png ? 'image/png' : 'image/jpeg', 0.92);
                        return;
                    }

                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({ orientation: P.land ? 'landscape' : 'portrait', unit: 'mm', format: printSettings.paper.toLowerCase() });
                    const pageW = P.pageW, pageH = P.pageH, margin = P.margin, drawW = P.drawW, drawH = P.drawH;
                    doc.setFillColor(255, 255, 255);
                    doc.rect(0, 0, pageW, pageH, 'F');
                    // Plan (PNG compressé sans perte)
                    doc.addImage(img.toDataURL('image/png'), 'PNG', margin, margin, drawW, drawH, undefined, 'FAST');

                    // Cadre de marge (4 traits nets, par-dessus l'image)
                    doc.setDrawColor(0);
                    const FRAME_LW = 0.5;
                    doc.setLineWidth(FRAME_LW); doc.line(margin, margin, margin + drawW, margin);
                    doc.setLineWidth(FRAME_LW); doc.line(margin + drawW, margin, margin + drawW, margin + drawH);
                    doc.setLineWidth(FRAME_LW); doc.line(margin + drawW, margin + drawH, margin, margin + drawH);
                    doc.setLineWidth(FRAME_LW); doc.line(margin, margin + drawH, margin, margin);

                    const cdP = cartDims(pageW, pageH, margin); if (printSettings.cartouche && cdP.a4) {   // cartouche A4 : rendu 8 px/mm (≈ 200 dpi), posé en image, à la taille du volet plié
                        const kk = 8, cc = document.createElement('canvas'); cc.width = Math.round(cdP.w * kk); cc.height = Math.round(cdP.h * kk);
                        drawCartA4(cc.getContext('2d'), 0, 0, kk, cartInfo(currentPrintScale, printSettings.paper), cdP.w, cdP.h);
                        doc.addImage(cc.toDataURL('image/png'), 'PNG', pageW - margin - cdP.w, pageH - margin - cdP.h, cdP.w, cdP.h, undefined, 'FAST');
                    } else if (printSettings.cartouche) {
                        // Cartouche vectoriel compact en bas à droite (case logo carrée)
                        const cW = CART_W, cH = CART_H, cX = pageW - margin - cW, cY = pageH - margin - cH, logoW = CART_LOGO, rowH = cH / 4;
                        doc.setDrawColor(0); doc.setFillColor(255, 255, 255);
                        doc.setLineWidth(0.35); doc.rect(cX, cY, cW, cH, 'FD');
                        doc.setLineWidth(0.2); doc.line(cX + logoW, cY, cX + logoW, cY + cH);
                        for (let i = 1; i <= 3; i++) doc.line(cX + logoW, cY + rowH * i, cX + cW, cY + rowH * i);
                        doc.setFontSize(CART_FONT); doc.setTextColor(0);
                        const ind = cartoucheIndice(), indW = ind ? 11 : 0;
                        cartoucheRows().forEach((txt, idx) => doc.text(txt, cX + logoW + 1.2, cY + rowH * idx + rowH * 0.68, { maxWidth: cW - logoW - 2.4 - (idx === 0 ? indW : 0) }));
                        if (ind) { doc.setFont(undefined, 'bold'); doc.text(ind, cX + cW - 1.2, cY + rowH * 0.68, { align: 'right' }); doc.setFont(undefined, 'normal'); }
                        doc.setFontSize(CART_FONT - 1); doc.setTextColor(80);
                        doc.text(new Date().toLocaleDateString('fr-FR'), cX + cW - 1.2, cY + rowH * 3 + rowH * 0.68, { align: 'right' });
                        if (cartoucheData.logo) {
                            const lb = logoBox(logoW - 2); 
                            try { doc.addImage(cartoucheData.logo, cX + 1 + lb.x, cY + 1 + lb.y, lb.w, lb.h, undefined, 'FAST'); } catch (e) { /* logo invalide */ }
                        } else {
                            doc.setFontSize(5); doc.setTextColor(120); doc.text('LOGO', cX + logoW / 2, cY + cH / 2 + 0.8, { align: 'center' });
                        }
                    }
                    doc.setFontSize(8); doc.setTextColor(60);
                    doc.text(`${printSettings.paper} ${P.land ? 'paysage' : 'portrait'} — ${currentPrintScale}`, margin + 2, margin + 6);
                    const credit = basemapCredit();
                    if (credit) { doc.setFontSize(5); doc.setTextColor(110); doc.text(credit, margin + 2, pageH - margin - 2); }
                    doc.save(base + '.pdf');

                } catch(err) {
                    console.error('Erreur impression :', err);
                    alert("Erreur lors de la génération du fichier d'impression. Vérifiez la console.");
                } finally {
                    setMode('select-box');
                    document.getElementById('print-loader').classList.add('hidden');
                    draw();
                }
            }, 50);
        }

        // Fonction de rendu plan sur un contexte arbitraire (utilisée par performPrint)
        // printLineScale : facteur de mise à l'échelle des épaisseurs pour le rendu PDF
        // Hauteur d'un texte d'annotation (texte, détail, valeur de cote) selon le réglage de son calque :
        //  - variable (champ vide) : basePx × unit, taille constante à l'écran et sur la feuille ;
        //  - fixe (valeur en mm)   : hauteur réelle dans le dessin, qui suit le zoom et l'échelle d'impression.
        function layerTextH(layerId) {
            const l = layers.find(x => x.id === (layerId || 'layer-0'));
            const h = l ? parseFloat(l.textH) : NaN;
            return h > 0 ? h : 0;
        }
        function annotTextPx(layerId, basePx, unit, worldScale) {
            const h = layerTextH(layerId);
            return h > 0 ? mmToWorld(h) * worldScale : basePx * unit;
        }
        // W2S : monde -> pixels de la cible ; unit : pixels cible par pixel écran ; worldScale : pixels cible par unité monde
        function drawAnnotations(tctx, W2S, unit, worldScale, isPrinting) {
            for (const d0 of dimensionTextsToDraw) {
                // toutes les cotes suivent la mise en forme (Paramètres › Cotes) : position du texte (si la cote a une direction) et fond
                const d = d0.dpos === undefined && !d0.raw ? Object.assign({}, d0, { dpos: d0.angle !== undefined ? dimStyle.txtPos : 'on', dgap: dimStyle.txtGap, dbg: dimStyle.txtBg }) : d0;
                const p = W2S(d.worldX, d.worldY);
                const fs = annotTextPx(d.layerId || DIM_LAYER_ID, 13, unit, worldScale), k = fs / 13;
                tctx.font = "bold " + fs + "px Arial";
                const m = tctx.measureText(d.text);
                tctx.save(); tctx.translate(p.x, p.y);
                if ((dimTextAligned || d.al) && d.angle !== undefined) {
                    // aligné sur la ligne de cote, mais jamais à l'envers
                    let a = d.angle; while (a > Math.PI / 2 + 1e-9) a -= Math.PI; while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
                    tctx.rotate(a);
                }
                if (d.dpos !== undefined) {   // cote linéaire : position (au-dessus / sur / sous la ligne) et fond (aucun / plein / pastille) réglés dans Paramètres > Cotes
                    const sg = d.dpos === 'above' ? -1 : d.dpos === 'below' ? 1 : 0, g0 = d.dgap * (unit === 1 ? DIM_PXMM : unit / REF_MM_PER_PX), pad = d.dbg === 'pill' ? 3 * k : 0;
                    if (sg) { if ((dimTextAligned || d.al) && d.angle !== undefined) tctx.translate(0, sg * (g0 + fs * 0.55 + pad));
                        else if (d.angle !== undefined) { let a = d.angle; while (a > Math.PI / 2 + 1e-9) a -= Math.PI; while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
                            const nx = -sg * Math.sin(a), ny = sg * Math.cos(a), sh = g0 + pad + Math.abs(ny) * fs * 0.55 + Math.abs(nx) * (m.width / 2 + 3 * k); tctx.translate(nx * sh, ny * sh); } }
                    const bgc = isPrinting ? "#ffffff" : "#1e1e1e";
                    if (d.dbg === 'fill') { tctx.fillStyle = bgc; tctx.fillRect(-m.width / 2 - 4 * k, -fs * 0.85, m.width + 8 * k, fs * 1.7); }
                    else if (d.dbg === 'pill') { const w = m.width + 14 * k, h = fs * 1.55, r = h / 2; tctx.beginPath(); tctx.moveTo(-w / 2 + r, -h / 2); tctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r); tctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r); tctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); tctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); tctx.closePath();
                        tctx.fillStyle = bgc; tctx.fill(); tctx.setLineDash([]); tctx.lineWidth = Math.max(1, 1.2 * k); tctx.strokeStyle = d.color || (isPrinting ? '#000000' : '#f59e0b'); tctx.stroke(); }
                } else {
                tctx.fillStyle = isPrinting ? "#ffffff" : "#1e1e1e";
                tctx.fillRect(-m.width / 2 - 4 * k, -fs * 0.85, m.width + 8 * k, fs * 1.7); }
                tctx.fillStyle = d.color || (isPrinting ? '#000000' : '#f59e0b');
                tctx.textAlign = "center"; tctx.textBaseline = "middle";
                tctx.fillText(d.text, 0, 0);
                tctx.restore();
            }
            for (const d of screenTextsToDraw) {
                const fs = annotTextPx(d.layerId, d.small ? 11 : 14, unit, worldScale), k = fs / 14, lh = fs * 1.25;
                const p = W2S(d.wx, d.wy);
                const col = (isPrinting && d.color === '#ffffff') ? '#000000' : d.color;
                tctx.font = "bold " + fs + "px Arial";
                if (d.kind === 'text') {
                    if (d.alt && dimStyle.txtBg !== 'none') {   // altitudes (points, sommets) : même fond que les cotes
                        let mw = 0; d.lines.forEach(t => mw = Math.max(mw, tctx.measureText(t).width)); const pd = 3 * k, x0 = p.x - pd, y0 = p.y - fs * 0.95, w = mw + 2 * pd, h = (d.lines.length - 1) * lh + fs * 1.3, bgc = isPrinting ? '#ffffff' : '#1e1e1e';
                        tctx.save(); tctx.fillStyle = bgc; if (dimStyle.txtBg === 'pill') { const r = Math.min(h / 2, 8 * k); tctx.beginPath(); tctx.moveTo(x0 + r, y0); tctx.arcTo(x0 + w + 4 * k, y0, x0 + w + 4 * k, y0 + h, r); tctx.arcTo(x0 + w + 4 * k, y0 + h, x0, y0 + h, r); tctx.arcTo(x0 - 4 * k, y0 + h, x0 - 4 * k, y0, r); tctx.arcTo(x0 - 4 * k, y0, x0 + w, y0, r); tctx.closePath(); tctx.fill(); tctx.lineWidth = Math.max(1, 1.1 * k); tctx.strokeStyle = col; tctx.stroke(); } else tctx.fillRect(x0, y0, w, h); tctx.restore(); }
                    tctx.textAlign = "left"; tctx.textBaseline = "alphabetic"; tctx.fillStyle = col;
                    d.lines.forEach((t, i) => tctx.fillText(t, p.x, p.y + i * lh));
                } else if (d.kind === 'detail') {
                    let maxW = 0; d.lines.forEach(t => maxW = Math.max(maxW, tctx.measureText(t).width));
                    const padX = 6 * k, padY = 4 * k;
                    const boxW = maxW + padX * 2, boxH = d.lines.length * lh + padY * 2;
                    const bx = p.x, by = p.y, tp = W2S(d.tx, d.ty);
                    const cxC = bx + boxW / 2, cyC = by + boxH / 2;
                    const angT = Math.atan2(tp.y - cyC, tp.x - cxC);
                    const hw = boxW / 2, hh = boxH / 2, tanA = Math.tan(angT);
                    let ex, ey;
                    if (Math.abs(Math.cos(angT)) * hh >= Math.abs(Math.sin(angT)) * hw) { ex = cxC + (Math.cos(angT) > 0 ? hw : -hw); ey = cyC + (Math.cos(angT) > 0 ? hw : -hw) * tanA; }
                    else { ey = cyC + (Math.sin(angT) > 0 ? hh : -hh); ex = cxC + (Math.sin(angT) > 0 ? hh : -hh) / tanA; }
                    tctx.strokeStyle = col; tctx.fillStyle = col; tctx.lineWidth = 1.2 * k; tctx.setLineDash([]);
                    tctx.beginPath(); tctx.moveTo(ex, ey); tctx.lineTo(tp.x, tp.y); tctx.stroke();
                    const ah = 9 * k, aa = Math.atan2(tp.y - ey, tp.x - ex);
                    tctx.beginPath(); tctx.moveTo(tp.x, tp.y);
                    tctx.lineTo(tp.x - ah * Math.cos(aa - 0.4), tp.y - ah * Math.sin(aa - 0.4));
                    tctx.lineTo(tp.x - ah * Math.cos(aa + 0.4), tp.y - ah * Math.sin(aa + 0.4));
                    tctx.closePath(); tctx.fill();
                    tctx.beginPath(); tctx.arc(tp.x, tp.y, 2.5 * k, 0, 2 * Math.PI); tctx.fill();
                    tctx.fillStyle = isPrinting ? '#ffffff' : 'rgba(20,20,20,0.85)';
                    tctx.fillRect(bx, by, boxW, boxH);
                    tctx.strokeStyle = col; tctx.strokeRect(bx, by, boxW, boxH);
                    tctx.fillStyle = col; tctx.textAlign = "left"; tctx.textBaseline = "top";
                    d.lines.forEach((t, i) => tctx.fillText(t, bx + padX, by + padY + i * lh));
                }
            }
        }

        function _drawFullPlanOnCtx(targetCtx, isPrinting, printLineScale) {
            const ls = printLineScale !== undefined ? printLineScale : camera.zoom;
            dimensionTextsToDraw = []; screenTextsToDraw = []; ptLabelGrid = new Set();
            targetCtx.save();
            targetCtx.translate(camera.x, camera.y);
            targetCtx.scale(camera.zoom, camera.zoom);
            for (let s of shapesInDrawOrder()) {
                let layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (layer && !layer.visible) continue;
                if (lvlOn && lvls) { if (lvlHidden(s)) continue; if (!isPrinting && lvlBelow(s)) { targetCtx.save(); targetCtx.globalAlpha *= 0.3; drawSingleShape(targetCtx, s, isPrinting, false, 0, 0, ls); targetCtx.restore(); continue; } }
                drawSingleShape(targetCtx, s, isPrinting, false, 0, 0, ls);
            }
            targetCtx.restore();
            drawAnnotations(targetCtx, worldToScreen, 1, camera.zoom, isPrinting);
        }

        // --- HISTORIQUE & ÉTAT ---
        let shapesHistory = []; let historyStep = -1;
        // la vue 3D ouverte suit le plan : toute modification (outil, annuler, refaire) la reconstruit
        let sync3DT = null;
        function sync3D() { if (typeof brushNoSync !== 'undefined' && brushNoSync) { brushNoSync = false; return; } if (typeof is3DOpen !== 'function' || !is3DOpen()) return; clearTimeout(sync3DT); sync3DT = setTimeout(() => { try { if (is3DOpen()) { build3DScene(); render3D(); } } catch (e) {} }, 40); }
        // après une modification faite avec un outil, la sélection est rendue : rien ne reste en rose
        const DESEL_MODES = new Set(['fillet', 'chamfer', 'move', 'rotate', 'scale-up', 'scale-down', 'stretch', 'mirror', 'array', 'join', 'break', 'lengthen', 'trim', 'extend', 'offset', 'divide', 'stack', 'paint', 'texclear', 'texpick', 'opening', 'pierce', 'bool']);
        function deselAfterTool() { if (!DESEL_MODES.has(mode)) return; setTimeout(() => { if (mode === 'copy' || mode === 'elevate') return; selectedShapes = []; try { updatePropertiesPopup(); } catch (e) {} draw(); }, 0); }
        function saveState() { deselAfterTool(); sync3D(); try { bldRepair(); bldSolidRepair(); } catch (e) {} try { mailTagNew(); fillNewZ(); tagNewSolid(); fondTagNew(); fondSyncAll(); stairFrameSync(); bldTagNew(); lvlTagNew(); batWatch(); } catch (e) { console.error(e); } if (piW && piW.steps[piW.i] !== 'lay') setTimeout(() => { try { piWRender(); } catch (e) {} }, 0); invalidateCache(); secSchedule(); if (historyStep < shapesHistory.length - 1) shapesHistory = shapesHistory.slice(0, historyStep + 1); shapesHistory.push({ shapes: JSON.parse(JSON.stringify(shapes)), layers: JSON.parse(JSON.stringify(layers)), activeLayerId }); historyStep++; }
        function undo() { sync3D(); invalidateCache(); if (historyStep > 0) { historyStep--; let state = shapesHistory[historyStep]; shapes = JSON.parse(JSON.stringify(state.shapes)); layers = JSON.parse(JSON.stringify(state.layers)); activeLayerId = state.activeLayerId; selectedShapes = []; updateLayerUI(); draw(); } }
        function redo() { sync3D(); invalidateCache(); if (historyStep < shapesHistory.length - 1) { historyStep++; let state = shapesHistory[historyStep]; shapes = JSON.parse(JSON.stringify(state.shapes)); layers = JSON.parse(JSON.stringify(state.layers)); activeLayerId = state.activeLayerId; selectedShapes = []; updateLayerUI(); draw(); } }

        function copySelection() { if (selectedShapes.length > 0) { clipboard = JSON.parse(JSON.stringify(selectedShapes)); clipboardLayers = JSON.parse(JSON.stringify(layers.filter(l => selectedShapes.some(x => (x.layerId || 'layer-0') === l.id)))); let bbox = getShapesBoundingBox(clipboard); clipboardBasePoint = bbox ? {x: bbox.centerX, y: bbox.centerY} : {x: 0, y: 0}; } }
        function cutSelection() { if (selectedShapes.length > 0) { copySelection(); shapes = shapes.filter(s => !selectedShapes.includes(s)); selectedShapes = []; saveState(); draw(); } }
        function pasteSelection() { if (clipboard.length > 0) { setMode('paste'); } }
        // appli installée (fenêtre à elle) : le bouton plein écran n'a plus lieu d'être
        function isInstalledApp() { try { return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(m => matchMedia('(display-mode: ' + m + ')').matches) || navigator.standalone === true; } catch (e) { return false; } }
        function refreshFullscreenBtn() { const b = document.getElementById('btn-fullscreen'); if (b) b.style.display = isInstalledApp() ? 'none' : ''; }
        refreshFullscreenBtn();
        ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].forEach(m => { try { const q = matchMedia('(display-mode: ' + m + ')'); q.addEventListener ? q.addEventListener('change', refreshFullscreenBtn) : q.addListener(refreshFullscreenBtn); } catch (e) {} });
        window.addEventListener('appinstalled', () => setTimeout(refreshFullscreenBtn, 300));
        function toggleFullScreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
        // Bascule l'icône du bouton plein écran : croix rouge quand on est en plein écran.
        document.addEventListener('fullscreenchange', () => {
            const btn = document.getElementById('btn-fullscreen');
            if (!btn) return;
            if (document.fullscreenElement) {
                btn.title = "Quitter le plein écran";
                btn.classList.remove('text-gray-200'); btn.classList.add('text-red-500');
                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            } else {
                btn.title = "Plein Écran";
                btn.classList.remove('text-red-500'); btn.classList.add('text-gray-200');
                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
            }
        });

        // --- MOTEUR DE DESSIN ---
        // lineScale = facteur de division des épaisseurs (= camera.zoom à l'écran, = zoom d'impression pour le PDF)
        // Couleur effective d'une forme : la couleur du calque prime si définie,
        // sinon la couleur propre de la forme. À l'impression, blanc -> noir,
        // mais les couleurs explicites (ex. rouge cotation) sont conservées.
        // Style ByLayer : couleur, type de ligne et épaisseur viennent du calque.
        // Les formes n'ont plus de style propre. À l'impression, blanc -> noir.
        function effectiveColor(s, isPrinting) {
            const layer = layers.find(l => l.id === ((s.colOf && layers.some(l => l.id === s.colOf)) ? s.colOf : (s.layerId || 'layer-0')));   // coupe : couleur du calque de l'objet représenté
            let col = (layer && layer.color) ? layer.color : '#ffffff';
            if ((isPrinting || lpInkFlag) && col.toLowerCase() === '#ffffff') col = '#000000';
            return col;
        }
        // Ligne « texte » : texte de l'objet (Y), sinon celui du calque
        function ltTextOf(s) { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); return String((s.ltText || (l && l.ltText) || 'TEXTE')).trim() || 'TEXTE'; }
        function linePathPts(s, dx, dy) {
            if (s.type === 'line') return [{ x: s.x1 + dx, y: s.y1 + dy }, { x: s.x2 + dx, y: s.y2 + dy }];
            if (s.type === 'poly') { const p = s.points.map(q => ({ x: q.x + dx, y: q.y + dy })); if (!s.open) p.push(p[0]); return p; }
            let a0 = 0, a1 = 2 * Math.PI; if (s.type === 'arc') { a0 = s.startAngle; a1 = s.endAngle; if (s.anticlockwise) { while (a1 > a0) a1 -= 2 * Math.PI; } else { while (a1 < a0) a1 += 2 * Math.PI; } }
            const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (2 * Math.PI) * 96)); return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return { x: s.x + dx + s.r * Math.cos(a), y: s.y + dy + s.r * Math.sin(a) }; });
        }
        // textes posés dans les trous du tireté (même rythme que setLineDash), toujours lisibles (jamais à l'envers)
        function drawLineTexts(ctx, s, dx, dy, txt, D, G, F, col) {
            const P = linePathPts(s, dx, dy), cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
            const L = cum[cum.length - 1]; if (L <= 0) return;
            ctx.save(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = F + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let j = 1;
            for (let d = D + G / 2; d < L - G / 2; d += D + G) {
                while (j < cum.length - 1 && cum[j] < d) j++;
                const a = P[j - 1], b = P[j], t = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
                let ang = Math.atan2(b.y - a.y, b.x - a.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
                ctx.save(); ctx.translate(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); ctx.rotate(ang); ctx.fillText(txt, 0, 0); ctx.restore();
            }
            ctx.restore();
        }
        function effectiveDash(s) {
            if (s && s.secOf && s.dash) return s.dash;   // dessin d'une coupe : TN et déblai tiretés, rappels de niveau en pointillés
            const layer = layers.find(l => l.id === (s.layerId || 'layer-0'));
            return (layer && layer.dash) ? layer.dash : 'solid';
        }
        function effectiveWidth(s) {
            if (s && s.secOf && s.width) return s.width;   // coupe : traits coupés épais, vue au-delà fine
            const layer = layers.find(l => l.id === (s.layerId || 'layer-0'));
            return (layer && layer.width) ? layer.width : 1;
        }
        // Dessine les hachures (lignes à 45°) à l'intérieur d'une forme fermée.
        // Échelle de hachure du calque (multiplie l'écartement de base de 3 mm)
        function layerHatchScaleOf(l) { const v = l ? parseFloat(l.hatchScale) : NaN; return v > 0 ? v : 1; }
        function layerHatchScale(s) { return layerHatchScaleOf(layers.find(x => x.id === (s.layerId || 'layer-0'))); }
        function layerHatch(s) {
            if (s && s.hatchMat) return 'm-' + s.hatchMat;   // hachure de matériau propre à l'objet (coupes)
            const l = layers.find(x => x.id === (s.layerId || 'layer-0'));
            return (l && l.hatch) || 'lines';
        }
        const SEC_PAT = {};
        function secGroundFill(c, shp, mat, col, ls) { const key = mat + col; let cv = SEC_PAT[key];
            if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = 18; const g = cv.getContext('2d'); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
                if (mat === 'terre') { [[3, 6], [12, 15]].forEach(([x, y]) => { for (let j = -1; j <= 1; j++) { g.beginPath(); g.moveTo(x + j * 2.2 - 2.5, y + 2.5); g.lineTo(x + j * 2.2 + 2.5, y - 2.5); g.stroke(); } }); }
                else { [[4, 4, 1.8], [13, 7, 1.3], [7, 13, 1.5], [15, 15, 1.1]].forEach(([x, y, r], k) => { g.beginPath(); if (k % 2) g.arc(x, y, r, 0, 7); else { g.moveTo(x - r, y + r); g.lineTo(x, y - r); g.lineTo(x + r, y + r * 0.6); g.closePath(); } g.stroke(); }); }
                SEC_PAT[key] = cv; }
            const pt = c.createPattern(cv, 'repeat'); try { pt.setTransform(new DOMMatrix().scale(1 / ls)); } catch (e) {}
            c.save(); c.fillStyle = pt; c.globalAlpha = 0.9; c.beginPath(); for (const l of (shp.loops || [shp.points])) { c.moveTo(l[0].x, l[0].y); for (const q of l) c.lineTo(q.x, q.y); c.closePath(); } c.fill('evenodd'); c.restore(); }
        function drawHatch(targetCtx, s, col, dx, dy, lineScale) {
            const spacingMm = (s.hatchSpacing || 3) * layerHatchScale(s);   // espacement en mm × échelle du calque
            const angleDeg = (s.hatchAngle !== undefined) ? s.hatchAngle : 45;
            const spacingWorld = mmToWorld(spacingMm);
            const pattern = layerHatch(s);
            // travailler sur une copie décalée si la forme est déplacée en preview (dx,dy)
            const shp = (dx || dy)
                ? (s.type === 'circle' ? { type:'circle', x:s.x+dx, y:s.y+dy, r:s.r }
                   : s.loops ? { type:'hatch', loops: s.loops.map(l => l.map(p => ({x:p.x+dx, y:p.y+dy}))) }
                   : { type:'poly', points: s.points.map(p => ({x:p.x+dx, y:p.y+dy})) })
                : s;
            if (s.secOf && (s.hatchMat === 'terre' || s.hatchMat === 'gnt')) { secGroundFill(targetCtx, shp, s.hatchMat, col, lineScale); return; }   // coupe : terrain et remblai à motif constant à l'écran (visible même en couche mince)
            if (pattern.startsWith('m-') && shp.type !== 'circle') { drawMatHatch(targetCtx, shp, pattern.slice(2), col, lineScale); return; }
            targetCtx.save();
            targetCtx.setLineDash([]);
            if (pattern === 'solid') {
                // plein : remplissage (les îlots restent vides, règle pair/impair)
                targetCtx.fillStyle = col;
                targetCtx.beginPath();
                if (shp.type === 'circle') targetCtx.arc(shp.x, shp.y, shp.r, 0, 2 * Math.PI);
                else for (const l of (shp.loops || [shp.points])) { targetCtx.moveTo(l[0].x, l[0].y); for (const q of l) targetCtx.lineTo(q.x, q.y); targetCtx.closePath(); }
                targetCtx.fill('evenodd');
            } else {
                let segs = computeHatchLines(shp, spacingWorld, angleDeg);
                if (pattern === 'cross') segs = segs.concat(computeHatchLines(shp, spacingWorld, angleDeg + 90));
                targetCtx.strokeStyle = col;
                targetCtx.lineWidth = (effectiveWidth(s) * 0.7) / lineScale;
                targetCtx.beginPath();
                for (const seg of segs) { targetCtx.moveTo(seg.x1, seg.y1); targetCtx.lineTo(seg.x2, seg.y2); }
                targetCtx.stroke();
            }
            targetCtx.restore();
        }

        // Hachure « matériau » (parois) : motif de coupe orienté sur le plus long côté du contour, sans remplissage
        function drawMatHatch(c, shp, mat, col, ls) {
            const loops = shp.loops || [shp.points], L0 = loops[0], n = L0.length; if (n < 3) return;
            let best = null; for (let i = 0; i < n; i++) { const a = L0[i], b = L0[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y); if (!best || len > best.len) best = { a, b, len }; }
            if (!best || best.len < 1e-9) return;
            const a = best.a, ux = (best.b.x - a.x) / best.len, uy = (best.b.y - a.y) / best.len;
            let gx = 0, gy = 0; L0.forEach(q => { gx += q.x / n; gy += q.y / n; });
            let nx = uy, ny = -ux; if ((gx - a.x) * nx + (gy - a.y) * ny < 0) { nx = -nx; ny = -ny; }
            let e = 0, x0 = Infinity, x1 = -Infinity; L0.forEach(q => { const dx = q.x - a.x, dy = q.y - a.y; e = Math.max(e, dx * nx + dy * ny); const t = dx * ux + dy * uy; x0 = Math.min(x0, t); x1 = Math.max(x1, t); });
            const k = mmToWorld(1);
            c.save(); c.setLineDash([]); c.beginPath();
            for (const l of loops) { c.moveTo(l[0].x, l[0].y); for (const q of l) c.lineTo(q.x, q.y); c.closePath(); }
            c.clip('evenodd');
            c.translate(a.x + ux * x0, a.y + uy * x0); c.transform(ux * k, uy * k, nx * k, ny * k, 0, 0);
            c.strokeStyle = col; wallPattern(c, mat, worldToMm(x1 - x0), worldToMm(e), k * ls, layerHatchScale(shp));
            c.restore();
        }
        /* un objet abîmé n'empêche pas le reste du plan de se dessiner : il est sauté et signalé une fois */
        const DRAW_BAD = new WeakSet();
        function drawSingleShape(targetCtx, s, isPrinting, sel, dx, dy, lineScale) { targetCtx.save(); try { if (s && s.cuts) rcpClip2D(targetCtx, s, dx, dy); const r = drawSingleShape0(targetCtx, s, isPrinting, sel, dx, dy, lineScale); if (s && s.cuts) rcpEdge2D(targetCtx, s, sel, dx || 0, dy || 0, lineScale); return r; }
            catch (e) { if (s && typeof s === 'object' && !DRAW_BAD.has(s)) { DRAW_BAD.add(s); mcIncident(e, 'dessin : ' + ((s && (s.name || s.type)) || 'objet')); } } finally { targetCtx.restore(); } }
        function drawSingleShape0(targetCtx, s, isPrinting, sel, dx, dy, lineScale) {
            if (!isPrinting && wallChain && wallChain.last && wallChain.last.has(s) && wallChainLive()) return;   // redessiné par l'aperçu de paroi
            if (lineScale === undefined) lineScale = camera.zoom;
            let col = effectiveColor(s, isPrinting);
            let dash = effectiveDash(s);
            let w = effectiveWidth(s) * 2;
            if (s.type === 'cline') { if (!isPrinting) drawCLine2D(targetCtx, s, sel, dx, dy, lineScale); return; }
            if (s.type === 'dim-angle') { drawAngleDim(targetCtx, { ...s, vertex: {x:s.vertex.x+dx, y:s.vertex.y+dy}, p1: {x:s.p1.x+dx, y:s.p1.y+dy}, p2: {x:s.p2.x+dx, y:s.p2.y+dy} }, sel, isPrinting, lineScale); return; }
            if (s.brush && s.type === 'poly') { drawBrush2D(targetCtx, s, dx, dy, lineScale, sel, col); return; }
            targetCtx.beginPath(); targetCtx.strokeStyle = sel ? '#ec4899' : col; targetCtx.lineWidth = (sel ? w+3 : w)/lineScale;
            let ltt = null, ltD = 0, ltG = 0, ltF = 0;
            if (dash === 'dashed') targetCtx.setLineDash([8/lineScale, 8/lineScale]);
            else if (dash === 'dotted') targetCtx.setLineDash([2/lineScale, 4/lineScale]);
            else if (dash === 'center') targetCtx.setLineDash([16/lineScale, 6/lineScale, 2/lineScale, 6/lineScale]);
            else if (dash === 'text' && ['line', 'poly', 'circle', 'arc'].includes(s.type)) {   // ---PVC120---PVC120---
                ltt = ltTextOf(s); ltF = 10 / lineScale; targetCtx.font = ltF + 'px Arial, sans-serif';
                ltD = 34 / lineScale; ltG = targetCtx.measureText(ltt).width + 8 / lineScale; targetCtx.setLineDash([ltD, ltG]);
            }
            else targetCtx.setLineDash([]);
            if (s.type === 'line' && s.wall) { drawWall(targetCtx, s, dx, dy, lineScale, sel, isPrinting); }
            else if (s.type === 'line') { targetCtx.moveTo(s.x1+dx, s.y1+dy); targetCtx.lineTo(s.x2+dx, s.y2+dy); targetCtx.stroke(); if (ltt) drawLineTexts(targetCtx, s, dx, dy, ltt, ltD, ltG, ltF, sel ? '#ec4899' : col); if (s.sweep) drawSweep2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            else if (s.type === 'circle') { targetCtx.arc(s.x+dx, s.y+dy, s.r, 0, 2*Math.PI); targetCtx.stroke(); if (ltt) drawLineTexts(targetCtx, s, dx, dy, ltt, ltD, ltG, ltF, sel ? '#ec4899' : col); if (s.hatch) drawHatch(targetCtx, s, col, dx, dy, lineScale); if (isPlateforme(s)) { try { drawTalus2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); } catch (e) { console.error('talus', e); } } if (sel && !isPrinting && s.type === 'poly' && isPlateforme(s)) drawTalusPills(targetCtx, s, dx, dy, lineScale); if (s.solid) drawSolid2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.sweep) drawSweep2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            else if (s.type === 'arc') { targetCtx.arc(s.x+dx, s.y+dy, s.r, s.startAngle, s.endAngle, !!s.anticlockwise); targetCtx.stroke(); if (ltt) drawLineTexts(targetCtx, s, dx, dy, ltt, ltD, ltG, ltF, sel ? '#ec4899' : col); if (s.sweep) drawSweep2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            else if (s.type === 'poly') { targetCtx.moveTo(s.points[0].x+dx, s.points[0].y+dy); for (let pt of s.points.slice(1)) targetCtx.lineTo(pt.x+dx, pt.y+dy); if (!s.open) targetCtx.closePath(); targetCtx.stroke(); if (s.trench) drawTrench2D(targetCtx, s, sel ? '#ec4899' : col, sel, dx, dy, lineScale, isPrinting); if (s.water) drawWater2D(targetCtx, s, col, sel, dx, dy, lineScale, isPrinting); if (s.river) drawRiver2D(targetCtx, s, sel, dx, dy); if (s.road && s.open) drawRoad2D(targetCtx, s, dx, dy); if (s.stair) drawStair2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.stair2) drawStair2_2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.bois) drawBois2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.bassin && !s.open) drawBassin2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.pay && !s.open && !isPrinting) payLabel2D(s, sel ? '#ec4899' : col, dx, dy); if (s.maille && !s.open) drawMaille2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (ltt) drawLineTexts(targetCtx, s, dx, dy, ltt, ltD, ltG, ltF, sel ? '#ec4899' : col); if (s.hatch) drawHatch(targetCtx, s, col, dx, dy, lineScale); if (isPlateforme(s)) { try { drawTalus2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); } catch (e) { console.error('talus', e); } } if (sel && !isPrinting && s.type === 'poly' && isPlateforme(s)) drawTalusPills(targetCtx, s, dx, dy, lineScale); if (s.solid) drawSolid2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); if (s.sweep) drawSweep2D(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            else if (s.type === 'point') {
                const X = s.x + dx, Y = s.y + dy, ps = ptStyleOf(s.layerId), t = ps.size / lineScale, pc = sel ? '#ec4899' : col;
                targetCtx.setLineDash([]); targetCtx.lineWidth = (sel ? 2.5 : 1.5) / lineScale; targetCtx.strokeStyle = pc; targetCtx.fillStyle = pc;
                drawPtSymbol(targetCtx, ps.sym, X, Y, t);
                const lab = ptLabelLines(s, ps);
                if (lab.length) {   // étiquettes : une par case (sinon illisibles et très lentes sur les gros semis)
                    const gk = Math.floor((X * camera.zoom + camera.x) / 34) + ',' + Math.floor((Y * camera.zoom + camera.y) / (11 * lab.length));
                    if (sel || !ptLabelGrid.has(gk)) { ptLabelGrid.add(gk); screenTextsToDraw.push({ kind: 'text', layerId: s.layerId, wx: X + (ps.size + 2) / camera.zoom, wy: Y - 3 / camera.zoom, lines: lab, color: sel ? '#ec4899' : (ps.lcol || col), small: true, alt: true }); }
                }
            }
            else if (s.type === 'mesh') drawMesh2D(targetCtx, s, col, sel, dx, dy, lineScale);
            else if (s.type === 'pdfvec') drawVec2D(targetCtx, s, col, sel, dx, dy, lineScale);
            else if (s.type === 'bgimage') {
                const X = s.x + dx, Y = s.y + dy, img = bmImg(s.mapId);
                targetCtx.save(); targetCtx.translate(X, Y); targetCtx.rotate(s.rot || 0);
                if (img) { targetCtx.globalAlpha *= (s.opacity === undefined ? 1 : Math.max(0, Math.min(1, s.opacity))); targetCtx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h); }
                else { targetCtx.fillStyle = '#d1d5db'; targetCtx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); }
                targetCtx.globalAlpha = 1; targetCtx.setLineDash(sel ? [6 / lineScale, 4 / lineScale] : []);
                targetCtx.strokeStyle = sel ? '#ec4899' : '#6b7280'; targetCtx.lineWidth = (sel ? 2 : 1) / lineScale;
                if (sel || !isPrinting) targetCtx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
                targetCtx.restore();
            }
            else if (s.type === 'basemap') {
                const X = s.x + dx, Y = s.y + dy, img = bmImg(s.mapId);
                targetCtx.save();
                targetCtx.beginPath(); targetCtx.arc(X, Y, s.r, 0, 2 * Math.PI); targetCtx.clip();
                if (img) {
                    targetCtx.globalAlpha *= (s.opacity === undefined ? 1 : Math.max(0, Math.min(1, s.opacity)));
                    targetCtx.translate(X, Y); targetCtx.rotate(s.rot || 0); const tf = targetCtx.getTransform(), px = 2 * s.r * Math.hypot(tf.a, tf.b); targetCtx.drawImage(imgMip(img, px), -s.r, -s.r, 2 * s.r, 2 * s.r);
                    for (const k of BM_OVL_ORDER) { if (!bmOvlOn(s, k)) continue; const o = bmImg(s.mapId + '_' + k); if (o) targetCtx.drawImage(imgMip(o, px), -s.r, -s.r, 2 * s.r, 2 * s.r); }
                }
                else { targetCtx.fillStyle = '#d1d5db'; targetCtx.fill(); }
                targetCtx.restore();
                targetCtx.save(); targetCtx.setLineDash(sel ? [6 / lineScale, 4 / lineScale] : []);
                targetCtx.strokeStyle = sel ? '#ec4899' : '#6b7280'; targetCtx.lineWidth = (sel ? 2 : 1) / lineScale;
                targetCtx.beginPath(); targetCtx.arc(X, Y, s.r, 0, 2 * Math.PI); targetCtx.stroke(); targetCtx.restore();
            }
            else if (s.type === 'hatch') {
                drawHatch(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale);
                if (sel) {
                    targetCtx.save(); targetCtx.strokeStyle = '#ec4899'; targetCtx.lineWidth = 1.5 / lineScale; targetCtx.setLineDash([6 / lineScale, 4 / lineScale]);
                    targetCtx.beginPath();
                    for (const l of s.loops) { targetCtx.moveTo(l[0].x + dx, l[0].y + dy); for (const q of l) targetCtx.lineTo(q.x + dx, q.y + dy); targetCtx.closePath(); }
                    targetCtx.stroke(); targetCtx.restore();
                }
            }
            else if (s.type === 'text') {
                // Texte en taille ÉCRAN FIXE (comme les cotes) : on l'empile pour rendu post-transform.
                screenTextsToDraw.push({ kind:'text', layerId: s.layerId, wx: s.x+dx, wy: s.y+dy, lines:(s.content||'').split('\n'), color: sel ? '#ec4899' : col, sizePx: (s.size||20) });
            }
            else if (s.type === 'detail') {
                const tx = s.tx+dx, ty = s.ty+dy, lx = s.lx+dx, ly = s.ly+dy;
                // La flèche/ligne de rappel reste géométrique (repère monde).
                // Le cadre + texte sont dessinés en taille écran fixe (post-transform).
                screenTextsToDraw.push({ kind:'detail', layerId: s.layerId, wx: lx, wy: ly, tx: tx, ty: ty, lines:(s.content||'').split('\n'), color: sel ? '#ec4899' : col, sizePx: (s.size||20), isPrinting });
            }
            else if (s.type === 'dim') { drawDimShape(targetCtx, s, col, dx, dy, lineScale); }
            else if (s.type === 'dimr') { drawDimR(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            else if (s.type === 'slope') { drawSlopeShape(targetCtx, s, sel ? '#ec4899' : col, dx, dy, lineScale); }
            targetCtx.setLineDash([]);
        }

        // Hors de la vue ? (boîte englobante rapide ; textes, cotes, hachures, images : toujours dessinés)
        function viewBoundsWorld(padPx) { const z = camera.zoom; if (!(z > 0)) return null; return { x0: (-padPx - camera.x) / z, y0: (-padPx - camera.y) / z, x1: (canvas.width + padPx - camera.x) / z, y1: (canvas.height + padPx - camera.y) / z }; }
        function shapeOffView(s, V) {
            let x0, y0, x1, y1;
            if (s.type === 'line' || s.type === 'slope') { x0 = Math.min(s.x1, s.x2); x1 = Math.max(s.x1, s.x2); y0 = Math.min(s.y1, s.y2); y1 = Math.max(s.y1, s.y2); if (s.wall) { const e = mmToWorld(wallThick(s.wall)); x0 -= e; y0 -= e; x1 += e; y1 += e; } }
            else if (s.type === 'point') { x0 = x1 = s.x; y0 = y1 = s.y; }
            else if (s.type === 'circle' || s.type === 'arc') { x0 = s.x - s.r; x1 = s.x + s.r; y0 = s.y - s.r; y1 = s.y + s.r; }
            else if (s.type === 'pdfvec') { const C = vecCorners(s); x0 = Math.min(...C.map(q => q.x)); x1 = Math.max(...C.map(q => q.x)); y0 = Math.min(...C.map(q => q.y)); y1 = Math.max(...C.map(q => q.y)); }
            else if (s.type === 'poly' && s.points && s.points.length && !s.solid && !isPlateforme(s)) { x0 = y0 = Infinity; x1 = y1 = -Infinity; for (const q of s.points) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; } }
            else return false;
            return x1 < V.x0 || x0 > V.x1 || y1 < V.y0 || y0 > V.y1;
        }
        function drawFullPlan(targetCtx, isUIEnabled = true) {
            const isPrinting = !isUIEnabled; vecExact = isPrinting; dimensionTextsToDraw = []; screenTextsToDraw = []; ptLabelGrid = new Set();
            targetCtx.save(); targetCtx.translate(camera.x, camera.y); targetCtx.scale(camera.zoom, camera.zoom);
            if (!isPrinting && showGrid && !layoutOn) {
                let l = (-camera.x)/camera.zoom, r = (canvas.width-camera.x)/camera.zoom, t = (-camera.y)/camera.zoom, b = (canvas.height-camera.y)/camera.zoom;
                // pas de grille réglable (mm) ; si les carreaux font moins de 6 px à l'écran,
                // on n'affiche qu'un trait sur 10 (puis sur 100…) pour garder une grille lisible
                let step = mmToWorld(gridMm);
                while (step * camera.zoom < 6) step *= 10;
                const major = step * 10;
                let sx = Math.floor(l/step)*step, sy = Math.floor(t/step)*step;
                targetCtx.lineWidth = 1/camera.zoom; targetCtx.strokeStyle = '#2c2c2c';
                targetCtx.beginPath();
                for (let x=sx; x<r; x+=step) { targetCtx.moveTo(x, t); targetCtx.lineTo(x, b); }
                for (let y=sy; y<b; y+=step) { targetCtx.moveTo(l, y); targetCtx.lineTo(r, y); }
                targetCtx.stroke();
                targetCtx.lineWidth = 1.5/camera.zoom; targetCtx.strokeStyle = '#3c3c3c';
                targetCtx.beginPath();
                for (let x=Math.floor(l/major)*major; x<r; x+=major) { targetCtx.moveTo(x, t); targetCtx.lineTo(x, b); }
                for (let y=Math.floor(t/major)*major; y<b; y+=major) { targetCtx.moveTo(l, y); targetCtx.lineTo(r, y); }
                targetCtx.stroke();
            }
            if (!isPrinting && mode === 'bmplace') drawBmPlace(targetCtx);

            // Gros dessins (> 4 000 objets) : le dessin des objets est mis en cache tant que vue, objets, sélection et calques ne changent pas
            // (un simple mouvement de souris ne redessine alors que les aperçus et accroches)
            const bigDraw = !isPrinting && !lpInner && (shapes.length + vecWeight()) > 4000 && !moveTypedOffset() && !isMovingObjects && !isRotatingObjects && !isScalingObjects && !gripDrag;
            let dcKey = null, dcRest = null;
            if (bigDraw) {
                if (selectedShapes !== drawCache.selRef || selectedShapes.length !== drawCache.selLen) { drawCache.selEpoch++; drawCache.selRef = selectedShapes; drawCache.selLen = selectedShapes.length; }
                dcRest = [canvas.width, canvas.height, shapes.length, historyStep, renderEpoch, drawCache.selEpoch, JSON.stringify(layers), currentUnit, printSettings.decimals, dimTextAligned, cubState.talus, cubState.kR, cubState.kD].join('|'); dcKey = [camera.x, camera.y, camera.zoom].join('|') + '|' + dcRest;
            }
            // pendant un déplacement / zoom de la vue : l'image déjà calculée suit le geste (décalée, agrandie), le vrai dessin revient dès qu'on s'arrête
            const vGesture = bigDraw && drawCache.cv && drawCache.key !== dcKey && drawCache.rest === dcRest && drawCache.shapesRef === shapes && drawCache.cam && (isPanning || performance.now() - (window.wheelT || 0) < 220);
            if (vGesture) { const f = camera.zoom / drawCache.cam.zoom; targetCtx.save(); targetCtx.setTransform(f, 0, 0, f, camera.x - drawCache.cam.x * f, camera.y - drawCache.cam.y * f); targetCtx.drawImage(drawCache.cv, 0, 0); targetCtx.restore();
                for (const d of drawCache.dims) dimensionTextsToDraw.push(d); for (const t of drawCache.texts) screenTextsToDraw.push(t); clearTimeout(drawCache.tm); drawCache.tm = setTimeout(() => draw(), 180); }
            else if (bigDraw && drawCache.key === dcKey && drawCache.shapesRef === shapes && drawCache.cv) {
                targetCtx.save(); targetCtx.setTransform(1, 0, 0, 1, 0, 0); targetCtx.drawImage(drawCache.cv, 0, 0); targetCtx.restore();
                for (const d of drawCache.dims) dimensionTextsToDraw.push(d); for (const t of drawCache.texts) screenTextsToDraw.push(t);
            } else {
                let realCtx = targetCtx, off = null;
                if (bigDraw) { off = drawCache.cv && drawCache.cv.width === canvas.width && drawCache.cv.height === canvas.height ? drawCache.cv : document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height;
                    const oc = off.getContext('2d'); oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, off.width, off.height); oc.translate(camera.x, camera.y); oc.scale(camera.zoom, camera.zoom); targetCtx = oc; }
                const d0 = dimensionTextsToDraw.length, t0 = screenTextsToDraw.length;
            const VB = viewBoundsWorld(60); for (let s of shapesInDrawOrder()) { if (VB && shapeOffView(s, VB)) continue;
                    let layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (layer && !layer.visible) continue; if (lvlOn && lvlHidden(s)) continue;
                    let sel = !isPrinting && selectedShapes.includes(s), ddx = 0, ddy = 0;
                    if (sel) {
                        const tOff = moveTypedOffset();
                        if (tOff) { ddx = tOff.dx; ddy = tOff.dy; }
                        else if (isMovingObjects && moveBasePoint) { ddx = currentX - moveBasePoint.x; ddy = currentY - moveBasePoint.y; }
                        else if (isRotatingObjects && rotateCenter) { s = JSON.parse(JSON.stringify(s)); let curA = Math.atan2(currentY - rotateCenter.y, currentX - rotateCenter.x), diff = curA - rotateStartAngle; if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) diff = parseFloat(typedInput) * Math.PI / 180; applyRotationToShape(s, rotateCenter.x, rotateCenter.y, diff); }
                        else if (isScalingObjects && scaleCenter) { s = JSON.parse(JSON.stringify(s)); let d2 = Math.hypot(currentX - scaleCenter.x, currentY - scaleCenter.y); let f = (scaleRefDist > 0.0001) ? d2 / scaleRefDist : 1; if (f > 0.0001) applyScaleToShape(s, scaleCenter.x, scaleCenter.y, f); }
                    }
                    if (lvlOn && !isPrinting && !sel && lvlBelow(s)) { targetCtx.save(); targetCtx.globalAlpha *= 0.3; drawSingleShape(targetCtx, s, isPrinting, sel, ddx, ddy); targetCtx.restore(); }   // étages du dessous : translucides, ni sélectionnables ni accrochables
                    else drawSingleShape(targetCtx, s, isPrinting, sel, ddx, ddy);
                }
                drawOpenings2D(targetCtx, isPrinting);
                targetCtx = realCtx;
                if (bigDraw) { targetCtx.save(); targetCtx.setTransform(1, 0, 0, 1, 0, 0); targetCtx.drawImage(off, 0, 0); targetCtx.restore();
                    drawCache = Object.assign(drawCache, { key: dcKey, rest: dcRest, cam: { x: camera.x, y: camera.y, zoom: camera.zoom }, cv: off, shapesRef: shapes, dims: dimensionTextsToDraw.slice(d0), texts: screenTextsToDraw.slice(t0) }); }
            }
            if (!isPrinting) { drawBldBadges(targetCtx); gcalDraw(targetCtx); drawStampPreview(targetCtx); drawStairPreview(targetCtx); drawStair2Preview(targetCtx); drawRecoupePreview(targetCtx); drawBrush2DCursor(targetCtx); drawStretchPreview(targetCtx); drawWallPreview(targetCtx); drawPenPreview(targetCtx); drawMirrorPreview(targetCtx); t2DrawPreview(targetCtx); drawOpeningPreview(targetCtx); drawOpStretchPreview(targetCtx); drawTutoGhost(targetCtx); drawGrips(targetCtx); drawCLines(targetCtx); cutPreview(targetCtx); }

            // Prévisualisations en cours de tracé
            if (isDrawing && !isPanning && isUIEnabled) {
                let dash = document.getElementById('prop-dash').value;
                if (dash === 'dashed') targetCtx.setLineDash([8/camera.zoom, 8/camera.zoom]); else if (dash === 'center') targetCtx.setLineDash([16/camera.zoom, 6/camera.zoom, 2/camera.zoom, 6/camera.zoom]); else targetCtx.setLineDash([]);
                let px = currentX, py = currentY, pr = Math.hypot(currentX-startX, currentY-startY);
                if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) { let d = (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE; pr = d; if (isPolyMode() && currentPolygon.length > 0) { let lp = currentPolygon[currentPolygon.length-1], a = Math.atan2(currentY-lp.y, currentX-lp.x); px = lp.x+Math.cos(a)*d; py = lp.y+Math.sin(a)*d; } else if (mode !== 'arc') { let a = Math.atan2(currentY-startY, currentX-startX); px = startX+Math.cos(a)*d; py = startY+Math.sin(a)*d; } }
                let previewW = (parseFloat(document.getElementById('prop-width').value) || 1) * 2;
                if (mode === 'rect') {
                    targetCtx.strokeStyle = document.getElementById('prop-color').value; targetCtx.lineWidth = previewW/camera.zoom;
                    let rx2, ry2;
                    const sgx = (currentX >= startX) ? 1 : -1, sgy = (currentY >= startY) ? 1 : -1;
                    if (rectDimStep === 1) {
                        rx2 = startX + sgx * rectWidthVal;
                        const hv = (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) ? (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE : Math.abs(currentY - startY);
                        ry2 = startY + sgy * hv;
                    } else if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) {
                        const wv = (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE;
                        rx2 = startX + sgx * wv; ry2 = currentY;
                    } else {
                        rx2 = currentX; ry2 = currentY;
                    }
                    targetCtx.strokeRect(startX, startY, rx2 - startX, ry2 - startY);
                }
                if (mode === 'line') {
                    targetCtx.strokeStyle = document.getElementById('prop-color').value; targetCtx.lineWidth = previewW/camera.zoom;
                    targetCtx.beginPath(); targetCtx.moveTo(startX, startY); targetCtx.lineTo(px, py); targetCtx.stroke();
                    // Guide d'alignement (mode Ortho) : trait fin pointillé du bout du segment
                    // vers le pointeur réel, pour montrer l'alignement sans relier.
                    if ((orthoMode || shiftHeld) && (Math.abs(rawMouseX - px) > 0.5 || Math.abs(rawMouseY - py) > 0.5)) {
                        targetCtx.save();
                        targetCtx.strokeStyle = 'rgba(120,200,255,0.7)';
                        targetCtx.lineWidth = 0.7/camera.zoom;
                        targetCtx.setLineDash([4/camera.zoom, 4/camera.zoom]);
                        targetCtx.beginPath(); targetCtx.moveTo(px, py); targetCtx.lineTo(rawMouseX, rawMouseY); targetCtx.stroke();
                        // petit repère croix sur le pointeur réel
                        let cs = 4/camera.zoom;
                        targetCtx.setLineDash([]);
                        targetCtx.beginPath();
                        targetCtx.moveTo(rawMouseX-cs, rawMouseY); targetCtx.lineTo(rawMouseX+cs, rawMouseY);
                        targetCtx.moveTo(rawMouseX, rawMouseY-cs); targetCtx.lineTo(rawMouseX, rawMouseY+cs);
                        targetCtx.stroke();
                        targetCtx.restore();
                    }
                }
                else if (mode === 'circle') { targetCtx.strokeStyle = '#ec4899'; targetCtx.lineWidth = 2/camera.zoom; targetCtx.beginPath(); targetCtx.arc(startX, startY, pr, 0, 2*Math.PI); targetCtx.stroke(); }
                else if (mode === 'arc') {
                    targetCtx.strokeStyle = document.getElementById('prop-color').value; targetCtx.lineWidth = previewW/camera.zoom;
                    if (arcStep === 1) { targetCtx.beginPath(); targetCtx.moveTo(arcCenter.x, arcCenter.y); targetCtx.lineTo(px, py); targetCtx.stroke(); targetCtx.globalAlpha = 0.3; targetCtx.beginPath(); targetCtx.arc(arcCenter.x, arcCenter.y, Math.hypot(px-arcCenter.x, py-arcCenter.y), 0, Math.PI*2); targetCtx.stroke(); targetCtx.globalAlpha = 1.0; }
                    else if (arcStep === 2) {
                        let curA = Math.atan2(py - arcCenter.y, px - arcCenter.x);
                        let pacw = false;
                        if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) { const deg = parseFloat(typedInput); curA = arcStartAngle + deg*Math.PI/180; pacw = deg < 0; }
                        else { const acc = arcTrack(px, py); curA = arcStartAngle + acc; pacw = acc < 0; }
                        targetCtx.beginPath(); targetCtx.arc(arcCenter.x, arcCenter.y, arcRadius, arcStartAngle, curA, pacw); targetCtx.stroke();
                        targetCtx.globalAlpha = 0.5; targetCtx.beginPath(); targetCtx.moveTo(arcCenter.x, arcCenter.y); targetCtx.lineTo(arcP1.x, arcP1.y); targetCtx.stroke(); targetCtx.globalAlpha = 1.0;
                    }
                }
                else if (isPolyMode() && currentPolygon.length > 0) { targetCtx.strokeStyle = document.getElementById('prop-color').value; targetCtx.lineWidth = previewW/camera.zoom; targetCtx.beginPath(); targetCtx.moveTo(currentPolygon[0].x, currentPolygon[0].y); for (let p of currentPolygon.slice(1)) targetCtx.lineTo(p.x, p.y); targetCtx.lineTo(px, py); targetCtx.stroke(); targetCtx.setLineDash([]); targetCtx.strokeStyle = '#eab308'; let t=5/camera.zoom; targetCtx.strokeRect(currentPolygon[0].x-t, currentPolygon[0].y-t, t*2, t*2); }
                else if (mode === 'profile' && profileAxis.length) {
                    targetCtx.strokeStyle = '#a3e635'; targetCtx.lineWidth = 2 / camera.zoom; targetCtx.setLineDash([10 / camera.zoom, 4 / camera.zoom, 2 / camera.zoom, 4 / camera.zoom]);
                    targetCtx.beginPath(); targetCtx.moveTo(profileAxis[0].x, profileAxis[0].y); profileAxis.slice(1).forEach(q => targetCtx.lineTo(q.x, q.y)); targetCtx.lineTo(currentX, currentY); targetCtx.stroke(); targetCtx.setLineDash([]);
                }
                else if (mode === 'slope' && slopeP1) {
                    const pv = makeSlope(slopeP1, { x: currentX, y: currentY });
                    if (pv) { targetCtx.strokeStyle = '#f59e0b'; targetCtx.lineWidth = 1.5 / camera.zoom; drawSlopeShape(targetCtx, pv, '#f59e0b', 0, 0, camera.zoom); }
                    else { targetCtx.strokeStyle = '#f59e0b'; targetCtx.setLineDash([5 / camera.zoom, 5 / camera.zoom]); targetCtx.beginPath(); targetCtx.moveTo(slopeP1.x, slopeP1.y); targetCtx.lineTo(currentX, currentY); targetCtx.stroke(); targetCtx.setLineDash([]); }
                }
                else if (mode === 'calibrate' && calP1) {
                    const p2 = calP2 || { x: currentX, y: currentY };
                    targetCtx.strokeStyle = '#38bdf8'; targetCtx.lineWidth = 2 / camera.zoom; targetCtx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
                    targetCtx.beginPath(); targetCtx.moveTo(calP1.x, calP1.y); targetCtx.lineTo(p2.x, p2.y); targetCtx.stroke(); targetCtx.setLineDash([]);
                    [calP1, p2].forEach(q => { targetCtx.beginPath(); targetCtx.arc(q.x, q.y, 4 / camera.zoom, 0, 2 * Math.PI); targetCtx.fillStyle = '#38bdf8'; targetCtx.fill(); });
                }
                else if (isDimMode() && dimStep === 1) {
                    // Pré-trait du 2e point : contraint H/V si Ortho actif (cohérent avec le clic).
                    let pcx = currentX, pcy = currentY;
                    if (mode === 'dim' && (orthoMode || shiftHeld)) {
                        if (Math.abs(pcx - dimP1.x) > Math.abs(pcy - dimP1.y)) pcy = dimP1.y;
                        else pcx = dimP1.x;
                    }
                    targetCtx.strokeStyle = '#f59e0b'; targetCtx.setLineDash([5/camera.zoom, 5/camera.zoom]);
                    targetCtx.beginPath(); targetCtx.moveTo(dimP1.x, dimP1.y); targetCtx.lineTo(pcx, pcy); targetCtx.stroke();
                }
                else if (isDimMode() && (dimStep === 2 || dimStep === 3)) {
                    const cur = { x: currentX, y: currentY };
                    let pv = null;
                    if (dimStep === 2) pv = makeDim(dimP1, dimP2, cur, mode === 'dim-ortho' ? orthoOrient(dimP1, dimP2, cur) : null);
                    else { const sn = findSnap(currentX, currentY); pv = nextChainDim(sn ? { x: sn.x, y: sn.y } : cur); }
                    if (pv) { targetCtx.strokeStyle = '#f59e0b'; targetCtx.lineWidth = 1/camera.zoom; drawDimShape(targetCtx, pv, '#f59e0b', 0, 0, camera.zoom); }
                }
                else if (mode === 'select-box' && t2Sel && t2Sel.phase === 'lasso') { const L = t2Sel.pts; targetCtx.save(); targetCtx.strokeStyle = '#ec4899'; targetCtx.fillStyle = 'rgba(236,72,153,0.07)'; targetCtx.lineWidth = 1.2/camera.zoom; targetCtx.setLineDash([5/camera.zoom, 4/camera.zoom]); targetCtx.beginPath(); L.forEach((q, i) => i ? targetCtx.lineTo(q.x, q.y) : targetCtx.moveTo(q.x, q.y)); targetCtx.lineTo(currentX, currentY); targetCtx.closePath(); targetCtx.fill(); targetCtx.stroke(); targetCtx.restore(); }
                else if (mode === 'select-box') { const cross = currentX < startX;   // vers la droite : fenêtre rose (objets entiers) ; vers la gauche : capture verte (tout ce qu'elle touche)
                    targetCtx.fillStyle = cross ? 'rgba(34,197,94,0.10)' : 'rgba(236,72,153,0.10)'; targetCtx.fillRect(startX, startY, currentX-startX, currentY-startY);
                    targetCtx.strokeStyle = cross ? '#22c55e' : '#ec4899'; targetCtx.lineWidth = 1/camera.zoom; targetCtx.setLineDash(cross ? [6/camera.zoom, 4/camera.zoom] : []); targetCtx.strokeRect(startX, startY, currentX-startX, currentY-startY); targetCtx.setLineDash([]); }
            }

            // Prévisualisation cotation angulaire
            if (mode === 'dim-angle' && isUIEnabled) {
                // Surligner D1 si sélectionnée
                if (dimAngleLine1) {
                    targetCtx.strokeStyle = '#f97316'; targetCtx.lineWidth = 3/camera.zoom; targetCtx.setLineDash([]);
                    targetCtx.beginPath(); targetCtx.moveTo(dimAngleLine1.x1, dimAngleLine1.y1); targetCtx.lineTo(dimAngleLine1.x2, dimAngleLine1.y2); targetCtx.stroke();
                }
                // Surligner D2 + preview arc
                if (dimAngleLine2 && dimAngleIntersect) {
                    targetCtx.strokeStyle = '#fb923c'; targetCtx.lineWidth = 3/camera.zoom; targetCtx.setLineDash([]);
                    targetCtx.beginPath(); targetCtx.moveTo(dimAngleLine2.x1, dimAngleLine2.y1); targetCtx.lineTo(dimAngleLine2.x2, dimAngleLine2.y2); targetCtx.stroke();
                    // Croix sur le point d'intersection
                    const ix = dimAngleIntersect.x, iy = dimAngleIntersect.y, cs = 6/camera.zoom;
                    targetCtx.strokeStyle = '#eab308'; targetCtx.lineWidth = 1.5/camera.zoom;
                    targetCtx.beginPath(); targetCtx.moveTo(ix-cs, iy-cs); targetCtx.lineTo(ix+cs, iy+cs); targetCtx.moveTo(ix+cs, iy-cs); targetCtx.lineTo(ix-cs, iy+cs); targetCtx.stroke();
                    // Arc de preview sous le curseur
                    const arcR = Math.hypot(currentX - ix, currentY - iy);
                    if (arcR > 5/camera.zoom) {
                        const ptOnL1 = _closestPointOnLine(dimAngleLine1, dimAngleIntersect, arcR, {x:currentX,y:currentY});
                        const ptOnL2 = _closestPointOnLine(dimAngleLine2, dimAngleIntersect, arcR, {x:currentX,y:currentY});
                        const a1 = Math.atan2(ptOnL1.y - iy, ptOnL1.x - ix);
                        const a2 = Math.atan2(ptOnL2.y - iy, ptOnL2.x - ix);
                        let sa = a1, ea = a2, span = ea - sa;
                        while (span < 0) span += 2*Math.PI;
                        if (span > Math.PI) { sa = a2; ea = a1; span = 2*Math.PI - span; }
                        targetCtx.strokeStyle = '#f97316'; targetCtx.lineWidth = 1.5/camera.zoom; targetCtx.setLineDash([4/camera.zoom, 4/camera.zoom]);
                        targetCtx.beginPath(); targetCtx.arc(ix, iy, arcR, sa, ea); targetCtx.stroke();
                        const angleDeg = (span * 180 / Math.PI).toFixed(1);
                        const midA = (sa + ea) / 2;
                        dimensionTextsToDraw.push({ text: angleDeg + '°', worldX: ix + Math.cos(midA)*(arcR + 15/camera.zoom), worldY: iy + Math.sin(midA)*(arcR + 15/camera.zoom) });
                    }
                }
                targetCtx.setLineDash([]);
            }

            // Prévisualisation outil Détail : flèche du point désigné vers le curseur
            if (mode === 'detail' && detailStep === 1 && detailTarget && isUIEnabled) {
                targetCtx.strokeStyle = '#f59e0b'; targetCtx.lineWidth = 1.5/camera.zoom; targetCtx.setLineDash([5/camera.zoom, 5/camera.zoom]);
                targetCtx.beginPath(); targetCtx.moveTo(detailTarget.x, detailTarget.y); targetCtx.lineTo(currentX, currentY); targetCtx.stroke();
                targetCtx.setLineDash([]);
                // marqueur sur le point désigné
                targetCtx.fillStyle = '#f59e0b'; targetCtx.beginPath(); targetCtx.arc(detailTarget.x, detailTarget.y, 3/camera.zoom, 0, 2*Math.PI); targetCtx.fill();
            }

            if (mode === 'paste' && clipboard.length > 0 && clipboardBasePoint && !isPanning && isUIEnabled) {
                let ddx = currentX - clipboardBasePoint.x, ddy = currentY - clipboardBasePoint.y;
                targetCtx.globalAlpha = 0.5;
                for (let s of clipboard) { drawSingleShape(targetCtx, s, false, false, ddx, ddy); }
                targetCtx.globalAlpha = 1.0;
            }

            if (mode === 'offset' && !isPanning && isUIEnabled) {
                if (offsetTarget) { drawSingleShape(targetCtx, offsetTarget, false, true, 0, 0); }
                if (offsetPreviewShape) { targetCtx.globalAlpha = 0.5; drawSingleShape(targetCtx, offsetPreviewShape, false, false, 0, 0); targetCtx.globalAlpha = 1.0; }
            }

            // Ortho projeté : points acquis (violets) et lignes projetées
            if (isUIEnabled && snapSettings.track && trackPts.length) {
                const t = 4 / camera.zoom, vl = screenToWorld(0, 0), vr = screenToWorld(canvas.width, canvas.height);
                targetCtx.save(); targetCtx.strokeStyle = '#a855f7'; targetCtx.lineWidth = 2 / camera.zoom; targetCtx.setLineDash([]);
                trackPts.forEach(p => { targetCtx.beginPath(); targetCtx.moveTo(p.x - t, p.y); targetCtx.lineTo(p.x + t, p.y); targetCtx.moveTo(p.x, p.y - t); targetCtx.lineTo(p.x, p.y + t); targetCtx.stroke(); targetCtx.strokeRect(p.x - t, p.y - t, 2 * t, 2 * t); });
                if (currentSnap && currentSnap.lines && currentSnap.lines.length) {
                    targetCtx.lineWidth = 1 / camera.zoom; targetCtx.setLineDash([6 / camera.zoom, 5 / camera.zoom]); targetCtx.beginPath();
                    currentSnap.lines.forEach(L => { if (L.h) { targetCtx.moveTo(vl.x, L.v); targetCtx.lineTo(vr.x, L.v); } else { targetCtx.moveTo(L.v, vl.y); targetCtx.lineTo(L.v, vr.y); } });
                    targetCtx.stroke();
                }
                targetCtx.restore();
            }
            if (currentSnap && isUIEnabled) {
                let t = 5/camera.zoom;
                if (t2SnapMarker(targetCtx, currentSnap, t)) { }
                else if (currentSnap.track || currentSnap.grid) {
                    targetCtx.save(); targetCtx.setLineDash([]); targetCtx.lineWidth = 2 / camera.zoom;
                    targetCtx.strokeStyle = currentSnap.grid ? '#38bdf8' : '#a855f7';
                    targetCtx.beginPath();
                    if (currentSnap.align) { targetCtx.arc(currentSnap.x, currentSnap.y, t * 0.6, 0, 2 * Math.PI); }
                    else { targetCtx.moveTo(currentSnap.x - t, currentSnap.y - t); targetCtx.lineTo(currentSnap.x + t, currentSnap.y + t); targetCtx.moveTo(currentSnap.x + t, currentSnap.y - t); targetCtx.lineTo(currentSnap.x - t, currentSnap.y + t); }
                    targetCtx.stroke(); targetCtx.restore();
                }
                else if (trackHover && snapSettings.track) {   // point en cours d'acquisition : orange
                    targetCtx.strokeStyle = '#f97316'; targetCtx.lineWidth = 2/camera.zoom; targetCtx.setLineDash([]);
                    targetCtx.strokeRect(currentSnap.x - t, currentSnap.y - t, t*2, t*2);
                }
                else if (currentSnap.perp) {
                    // Symbole perpendiculaire : petit angle droit (⊥)
                    targetCtx.strokeStyle = '#22d3ee'; targetCtx.lineWidth = 2/camera.zoom;
                    targetCtx.setLineDash([]);
                    targetCtx.beginPath();
                    // côté vertical
                    targetCtx.moveTo(currentSnap.x - t, currentSnap.y - t);
                    targetCtx.lineTo(currentSnap.x - t, currentSnap.y + t);
                    // côté horizontal (base)
                    targetCtx.lineTo(currentSnap.x + t, currentSnap.y + t);
                    // petite marque interne du carré d'angle droit
                    targetCtx.moveTo(currentSnap.x - t, currentSnap.y + t*0.3);
                    targetCtx.lineTo(currentSnap.x - t*0.3, currentSnap.y + t*0.3);
                    targetCtx.lineTo(currentSnap.x - t*0.3, currentSnap.y + t);
                    targetCtx.stroke();
                } else {
                    targetCtx.strokeStyle = '#eab308'; targetCtx.lineWidth = 2/camera.zoom;
                    targetCtx.strokeRect(currentSnap.x - t, currentSnap.y - t, t*2, t*2);
                }
            }
            targetCtx.restore();

            // Textes de cotation, textes et détails (post-transform, taille selon le calque)
            drawAnnotations(targetCtx, worldToScreen, lpInner ? REF_MM_PER_PX * lpCam.k : 1, camera.zoom, isPrinting);
        }

        // Repère d'origine façon AutoCAD : axe X (rouge, vers la droite) et axe Y (vert, vers le haut)
        // au point 0,0. Si l'origine sort de l'écran, l'icône se range dans le coin bas-gauche.
        // Uniquement à l'écran (jamais imprimé ni exporté).
        function drawOriginIcon() {
            const L = 46, o = worldToScreen(0, 0);
            const inside = o.x > 8 && o.x < canvas.width - L - 20 && o.y > L + 20 && o.y < canvas.height - 50;
            const ox = inside ? o.x : 22, oy = inside ? o.y : canvas.height - 72;
            const axis = (dx, dy, col, label) => {
                const ex = ox + dx * L, ey = oy + dy * L;
                ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
                const a = Math.atan2(dy, dx), ah = 9;
                ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 3, ey + Math.sin(a) * 3);
                ctx.lineTo(ex - ah * Math.cos(a - 0.45), ey - ah * Math.sin(a - 0.45));
                ctx.lineTo(ex - ah * Math.cos(a + 0.45), ey - ah * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
                ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                if (dx) ctx.fillText(label, ex + 8, ey + 12); else ctx.fillText(label, ex, ey - 17);
            };
            ctx.save();
            axis(1, 0, '#ef4444', 'X');
            axis(0, -1, '#22c55e', 'Y');
            ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5; ctx.strokeRect(ox - 4, oy - 4, 8, 8);
            if (!inside) { ctx.fillStyle = '#9ca3af'; ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("0,0 hors écran", ox - 6, oy + 28); }
            ctx.restore();
        }
        let currentZs = [];
        function updateCursorCoords() {
            const el = document.getElementById('cursor-coords'); if (!el) return;
            const k = UNIT_MM[currentUnit] || 1;
            let t = 'X ' + fmtNum(realX(currentX) / k) + '   Y ' + fmtNum(realY(currentY) / k) + ' ' + currentUnit; { const P = (geoOrigin.x || geoOrigin.y) ? detectCRS() : null; if (P) t += ' · ' + (P.code === 'L93' ? 'L93' : P.code); }
            if (currentZs && currentZs.length) t += '   Z ' + currentZs.slice(0, 3).map(fmtZ).join(' / ') + (currentZs.length > 3 ? ' …' : '') + ' m';
            el.textContent = t;
        }

        // ---------- Recadrage rapide du logo (carré) ----------
        let pendingLogo = null, cropImg = null, cropBox = null, cropView = null, cropDrag = null;
        function startLogoCrop(input) {
            const f = input.files && input.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                const im = new Image();
                im.onload = () => {
                    cropImg = im;
                    const cv = document.getElementById('crop-canvas'), W = cv.width, H = cv.height, pad = 16;
                    const sc = Math.min((W - 2 * pad) / im.naturalWidth, (H - 2 * pad) / im.naturalHeight);
                    cropView = { sc, x: (W - im.naturalWidth * sc) / 2, y: (H - im.naturalHeight * sc) / 2, w: im.naturalWidth * sc, h: im.naturalHeight * sc };
                    const side = Math.min(cropView.w, cropView.h);   // carré le plus grand, centré
                    cropBox = { x: cropView.x + (cropView.w - side) / 2, y: cropView.y + (cropView.h - side) / 2, s: side };
                    document.getElementById('crop-modal').style.display = 'flex'; drawCrop();
                };
                im.onerror = () => alert("Image illisible.");
                im.src = rd.result;
            };
            rd.readAsDataURL(f);
        }
        function clampCrop() {
            const v = cropView, b = cropBox, maxS = Math.max(v.w, v.h);
            b.s = Math.max(12, Math.min(b.s, maxS));
            // le carré peut déborder de l'image (zones vides = blanc), mais son centre reste sur l'image
            b.x = Math.min(Math.max(b.x, v.x - b.s / 2), v.x + v.w - b.s / 2);
            b.y = Math.min(Math.max(b.y, v.y - b.s / 2), v.y + v.h - b.s / 2);
        }
        function drawCrop() {
            const cv = document.getElementById('crop-canvas'), c = cv.getContext('2d'), v = cropView, b = cropBox;
            c.clearRect(0, 0, cv.width, cv.height);
            c.drawImage(cropImg, v.x, v.y, v.w, v.h);
            c.fillStyle = 'rgba(0,0,0,0.55)';
            c.beginPath(); c.rect(0, 0, cv.width, cv.height); c.rect(b.x, b.y, b.s, b.s); c.fill('evenodd');
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(b.x, b.y, b.s, b.s);
            c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath();
            for (let i = 1; i < 3; i++) { c.moveTo(b.x + b.s * i / 3, b.y); c.lineTo(b.x + b.s * i / 3, b.y + b.s); c.moveTo(b.x, b.y + b.s * i / 3); c.lineTo(b.x + b.s, b.y + b.s * i / 3); }
            c.stroke();
            c.fillStyle = '#fff'; [[b.x, b.y], [b.x + b.s, b.y], [b.x, b.y + b.s], [b.x + b.s, b.y + b.s]].forEach(([x, y]) => c.fillRect(x - 5, y - 5, 10, 10));
        }
        function cropPt(e) { const cv = document.getElementById('crop-canvas'), r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
        (function initCrop() {
            const cv = document.getElementById('crop-canvas'); if (!cv) return;
            cv.addEventListener('pointerdown', (e) => {
                if (!cropBox) return; const p = cropPt(e), b = cropBox;
                const corners = [[b.x, b.y, b.x + b.s, b.y + b.s], [b.x + b.s, b.y, b.x, b.y + b.s], [b.x, b.y + b.s, b.x + b.s, b.y], [b.x + b.s, b.y + b.s, b.x, b.y]];
                const hit = corners.find(([x, y]) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12);
                if (hit) cropDrag = { kind: 'resize', ax: hit[2], ay: hit[3] };              // coin opposé fixe
                else if (p.x >= b.x && p.x <= b.x + b.s && p.y >= b.y && p.y <= b.y + b.s) cropDrag = { kind: 'move', dx: p.x - b.x, dy: p.y - b.y };
                else return;
                cv.setPointerCapture(e.pointerId); e.preventDefault();
            });
            cv.addEventListener('pointermove', (e) => {
                if (!cropDrag) return; const p = cropPt(e), b = cropBox;
                if (cropDrag.kind === 'move') { b.x = p.x - cropDrag.dx; b.y = p.y - cropDrag.dy; }
                else {
                    const s = Math.max(12, Math.max(Math.abs(p.x - cropDrag.ax), Math.abs(p.y - cropDrag.ay)));
                    b.s = s; b.x = p.x < cropDrag.ax ? cropDrag.ax - s : cropDrag.ax; b.y = p.y < cropDrag.ay ? cropDrag.ay - s : cropDrag.ay;
                }
                clampCrop(); drawCrop();
            });
            cv.addEventListener('pointerup', () => { cropDrag = null; });
            cv.addEventListener('wheel', (e) => {
                if (!cropBox) return; e.preventDefault();
                const b = cropBox, cx = b.x + b.s / 2, cy = b.y + b.s / 2;
                b.s *= e.deltaY < 0 ? 0.92 : 1.08; b.x = cx - b.s / 2; b.y = cy - b.s / 2; clampCrop(); drawCrop();
            }, { passive: false });
        })();
        function closeCrop() {
            document.getElementById('crop-modal').style.display = 'none'; cropImg = null; cropBox = null;
            if (!pendingLogo) document.getElementById('cartouche-logo').value = '';
        }
        function exportCrop(sxImg, syImg, sImg) {
            const N = 512, out = document.createElement('canvas'); out.width = out.height = N;
            const c = out.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, N, N);
            const k = N / sImg; c.imageSmoothingQuality = 'high';
            c.drawImage(cropImg, -sxImg * k, -syImg * k, cropImg.naturalWidth * k, cropImg.naturalHeight * k);
            pendingLogo = out.toDataURL('image/png'); psLogoRemoved = false;
            psCartRefresh();
            document.getElementById('crop-modal').style.display = 'none'; cropImg = null; cropBox = null;
        }
        function applyCrop() { const v = cropView, b = cropBox; exportCrop((b.x - v.x) / v.sc, (b.y - v.y) / v.sc, b.s / v.sc); }
        function cropWhole() {
            const iw = cropImg.naturalWidth, ih = cropImg.naturalHeight, side = Math.max(iw, ih);
            exportCrop((iw - side) / 2, (ih - side) / 2, side);
        }
        function cartoucheRows() {
            return ['Plan : ' + (cartoucheData.planName || ''), 'Client : ' + (cartoucheData.clientName || ''),
                    'Dessin : ' + (cartoucheData.draftsmanName || ''), 'Échelle : ' + currentPrintScale];
        }
        // Logo centré dans la case carrée (proportions conservées) ; size = côté utile
        function logoBox(size, img) {
            img = img || getLogoImg();
            const iw = img && img.naturalWidth || 1, ih = img && img.naturalHeight || 1, r = Math.min(size / iw, size / ih);
            const w = iw * r, h = ih * r; return { x: (size - w) / 2, y: (size - h) / 2, w, h };
        }
        // Logo du cartouche, chargé une fois pour l'aperçu et les exports image
        let logoImg = null;
        function getLogoImg() {
            if (!cartoucheData.logo) return null;
            if (!logoImg || logoImg._src !== cartoucheData.logo) {
                logoImg = new Image();
                logoImg.onload = () => { if (mode === 'preview') draw(); };
                logoImg.src = cartoucheData.logo; logoImg._src = cartoucheData.logo;
            }
            return (logoImg.complete && logoImg.naturalWidth) ? logoImg : null;
        }
        // Dessine la feuille comme le PDF : fond blanc, plan, cadre de marge, cartouche, titre.
        // (sx, sy) = coin haut-gauche de la feuille, k = pixels par mm de papier.
        function drawSheet(tctx, sx, sy, k, img) {
            const P = pageDims();
            const pt = (v) => v * 0.3528 * k;                         // taille de police (pt) -> px
            tctx.save();
            tctx.fillStyle = '#ffffff'; tctx.fillRect(sx, sy, P.pageW * k, P.pageH * k);
            const ix = sx + P.margin * k, iy = sy + P.margin * k, iw = P.drawW * k, ih = P.drawH * k;
            tctx.drawImage(img, ix, iy, iw, ih);
            tctx.strokeStyle = '#000'; tctx.setLineDash([]);
            tctx.lineWidth = Math.max(1, 0.5 * k); tctx.strokeRect(ix, iy, iw, ih);
            const cdP = cartDims(P.pageW, P.pageH, P.margin); if (printSettings.cartouche && cdP.a4) drawCartA4(tctx, sx + (P.pageW - P.margin - cdP.w) * k, sy + (P.pageH - P.margin - cdP.h) * k, k, cartInfo(currentPrintScale, printSettings.paper), cdP.w, cdP.h);
            else if (printSettings.cartouche) {
                const cW = CART_W * k, cH = CART_H * k, logoW = CART_LOGO * k, rowH = cH / 4;
                const cX = sx + (P.pageW - P.margin - CART_W) * k, cY = sy + (P.pageH - P.margin - CART_H) * k;
                tctx.fillStyle = '#fff'; tctx.fillRect(cX, cY, cW, cH);
                tctx.lineWidth = Math.max(1, 0.35 * k); tctx.strokeRect(cX, cY, cW, cH);
                tctx.lineWidth = Math.max(0.5, 0.2 * k);
                tctx.beginPath(); tctx.moveTo(cX + logoW, cY); tctx.lineTo(cX + logoW, cY + cH);
                for (let i = 1; i <= 3; i++) { tctx.moveTo(cX + logoW, cY + rowH * i); tctx.lineTo(cX + cW, cY + rowH * i); }
                tctx.stroke();
                tctx.fillStyle = '#000'; tctx.font = pt(CART_FONT) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'left'; tctx.textBaseline = 'alphabetic';
                const ind = cartoucheIndice(), indW = ind ? 11 * k : 0;
                cartoucheRows().forEach((t, i) => tctx.fillText(t, cX + logoW + 1.2 * k, cY + rowH * i + rowH * 0.68, cW - logoW - 2.4 * k - (i === 0 ? indW : 0)));
                if (ind) { tctx.font = 'bold ' + pt(CART_FONT) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'right'; tctx.fillText(ind, cX + cW - 1.2 * k, cY + rowH * 0.68); tctx.textAlign = 'left'; }
                tctx.fillStyle = 'rgb(80,80,80)'; tctx.font = pt(CART_FONT - 1) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'right';
                tctx.fillText(new Date().toLocaleDateString('fr-FR'), cX + cW - 1.2 * k, cY + rowH * 3 + rowH * 0.68);
                const logo = getLogoImg();
                if (logo) { const lb = logoBox((CART_LOGO - 2) * k, logo); tctx.drawImage(logo, cX + k + lb.x, cY + k + lb.y, lb.w, lb.h); }
                else if (!cartoucheData.logo) {
                    tctx.fillStyle = 'rgb(120,120,120)'; tctx.font = pt(5) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'center';
                    tctx.fillText('LOGO', cX + logoW / 2, cY + cH / 2 + 0.8 * k);
                }
            }
            tctx.fillStyle = 'rgb(60,60,60)'; tctx.font = pt(8) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'left'; tctx.textBaseline = 'alphabetic';
            tctx.fillText(printSettings.paper + ' ' + (P.land ? 'paysage' : 'portrait') + ' — ' + currentPrintScale, sx + (P.margin + 2) * k, sy + (P.margin + 6) * k);
            const credit = basemapCredit();
            if (credit) { tctx.fillStyle = 'rgb(110,110,110)'; tctx.font = pt(5) + 'px Helvetica, Arial, sans-serif'; tctx.fillText(credit, sx + (P.margin + 2) * k, sy + (P.pageH - P.margin - 2) * k); }
            tctx.restore();
        }
        // Aperçu avant impression : la feuille telle que le fichier la produira, sur fond assombri.
        function drawPreviewSheet(cx, cy) {
            const rect = getPrintRect(), P = pageDims();
            const k = rect.w / P.drawW;                                 // pixels écran par mm de papier
            const imgX = cx - rect.w / 2, imgY = cy - rect.h / 2;
            const sheetX = imgX - P.margin * k, sheetY = imgY - P.margin * k;
            ctx.save();
            ctx.fillStyle = 'rgba(12,12,14,0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sheetX, sheetY, P.pageW * k, P.pageH * k);
            ctx.restore();
            drawSheet(ctx, sheetX, sheetY, k, renderPrintCanvas(imgX, imgY, previewPin ? 2 : 1));   // même rendu que le fichier
            ctx.save();
            ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            const out = printSettings.output === 'pdf' ? 'PDF' : printSettings.output.toUpperCase();
            ctx.fillText('APERÇU — ' + printSettings.paper + ' ' + (P.land ? 'paysage' : 'portrait') + ' — ' + currentPrintScale + ' — ' + out + (previewPin ? '  ·  page figée (ENTRÉE = imprimer)' : '  ·  CLIC pour figer'), cx, sheetY - 10);
            ctx.restore();
        }

