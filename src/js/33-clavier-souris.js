        // =====================================================================
        // CLAVIER, SOURIS, MESSAGES, APERÇUS
        // =====================================================================
        function t2KeyDown(e) {
            if (!t2 || e.ctrlKey || e.altKey || e.metaKey) return false;
            const k = e.key, bs = k === 'Backspace' || k === 'Delete', ok = k === ' ' || k === 'Enter';
            if (k === 'F10') { e.preventDefault(); togglePolar(); return true; }
            if (cmdBuffer) return false;
            const typing = (re) => { if (re.test(k)) { e.preventDefault(); typedInput += k === ',' ? '.' : k; draw(); return true; } if (k === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return true; } return false; };
            // C = garder l'original (copie) pendant Déplacer / Rotation
            if (k === 'c' || k === 'C') {
                if (mode === 'move' && moveBasePoint && selectedShapes.length) { e.preventDefault(); t2.moveCopy = !t2.moveCopy; draw(); return true; }
                if (mode === 'rotate' && rotateCenter && selectedShapes.length) { e.preventDefault(); t2.rotCopy = !t2.rotCopy; draw(); return true; }
            }
            if (mode === 'rotate' && rotateCenter && t2.rotCopy && ok && typedInput && isFinite(t2Num(typedInput))) { e.preventDefault(); t2RotCopy(-t2Num(typedInput) * Math.PI / 180); return true; }
            // R = échelle par référence (Agrandir / Réduire)
            if ((k === 'r' || k === 'R') && isScaleMode() && selectedShapes.length && !t2.sref) { e.preventDefault(); t2.sref = { step: 0 }; typedInput = ''; scaleCenter = null; isScalingObjects = false; draw(); return true; }
            if (isScaleMode() && t2.sref) {
                if (t2.sref.step === 3) { if (typing(/^[0-9.,]$/)) return true; if (ok && typedInput) { e.preventDefault(); const v = t2Num(typedInput); if (v > 0) t2SrefApply(T2W(v)); return true; } }
                if (bs) { e.preventDefault(); return true; }
            }
            if (t2.arrayPending && mode === 'select-box' && ok && selectedShapes.length && !typedInput) { e.preventDefault(); startArray(); return true; }
            switch (mode) {
                case 'copy':
                    if (t2.cpBase && typing(/^[0-9.,]$/)) return true;
                    if (ok) { e.preventDefault(); if (typedInput && t2.cpBase) t2CopyTyped(); else { const n = t2.cpN; setMode('select-box'); selectedShapes = []; updateCommandMessageText('COPIER : terminé (' + n + ' copie(s)).'); draw(); } return true; }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'join':
                    if (ok) { e.preventDefault(); t2DoJoin(selectedShapes); return true; }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'chamfer':
                    if (t2.chA && t2.chB) { if (typing(/^[0-9.,\/;]$/)) return true; if (ok) { e.preventDefault(); const v = typedInput || t2.chD; if (v) t2ChamferApply(v); return true; } }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'lengthen':
                    if (typing(t2.lenDyn ? /^[0-9.,]$/ : /^[0-9.,+\-=]$/)) return true;
                    if (ok) {
                        e.preventDefault();
                        if (t2.lenDyn) { const v = t2Num(typedInput); if (v > 0) t2LenFinish(T2W(v)); return true; }
                        if (typedInput) { const tx = typedInput.replace(/^=/, ''), v = t2Num(tx); if (isFinite(v)) { t2.lenSpec = /^[+\-]/.test(typedInput) ? { kind: 'delta', v } : { kind: 'total', v }; } typedInput = ''; draw(); }
                        else if (t2.lenSpec) { t2.lenSpec = null; draw(); }
                        return true;
                    }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'ellipse':
                    if (t2.ell && t2.ell.step >= 1 && typing(/^[0-9.,]$/)) return true;
                    if (ok && t2.ell && typedInput) {
                        e.preventDefault(); const v = t2Num(typedInput), E = t2.ell; if (!(v > 0)) return true;
                        if (E.step === 1) { const q = t2Constrain(E.c, { x: currentX, y: currentY }, shiftHeld, !!currentSnap); E.rot = Math.atan2(q.y - E.c.y, q.x - E.c.x); E.a = T2W(v); E.step = 2; typedInput = ''; draw(); }
                        else if (E.step === 2) t2EllCreate(T2W(v));
                        return true;
                    }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'measure':
                    if (k === 'Backspace' && t2.ms.length) { e.preventDefault(); t2.ms.pop(); draw(); return true; }
                    if (ok) { e.preventDefault(); const I = t2MsInfo(); t2.ms = []; if (I && I.n >= 2) updateCommandMessageText('MESURE : ' + t2MsText(I) + ' — nouvelle mesure : cliquez le 1er point.'); draw(); return true; }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'opening':
                    if (!openA) return false;
                    if (typing(/^[0-9.,]$/)) return true;
                    if (ok) { e.preventDefault(); if (!typedInput) typedInput = String(T2U(mmToWorld(openLast.w * 1000))); openingFinish(openingB({ x: currentX, y: currentY })); return true; }
                    if (bs) { e.preventDefault(); return true; } return false;
                case 'array': case 'divide': case 'break': case 'addpt': case 'point': case 'sonde': case 'dim-rad': case 'dim-dia':
                    if (bs || ok) { e.preventDefault(); return true; } return false;
            }
            return false;
        }
        function t2SrefApply(newLenW) {
            const R = t2.sref, f = newLenW / R.ref; if (!(f > 1e-9) || !isFinite(f)) return;
            selectedShapes.forEach(s => applyScaleToShape(s, R.base.x, R.base.y, f)); t2.sref = null; typedInput = ''; saveState(); draw();
            updateCommandMessageText('ÉCHELLE PAR RÉFÉRENCE : ' + calculateRealDistance(R.ref) + ' → ' + calculateRealDistance(newLenW) + ' (facteur × ' + t2Fr(+f.toFixed(5)) + ').');
        }
        function t2MouseDown(sx, sy, e) {
            if (!t2 || e.button !== 0) return false;
            const w = screenToWorld(sx, sy);
            // choix du centre / du tracé du réseau
            if (mode === 'array' && t2.arr) {
                const A = t2.arr;
                if (A.pick === 'center') { const p = t2Pt(w.x, w.y); A.center = { x: p.x, y: p.y }; A.pick = null; t2ArrayPanel(); draw(); return true; }
                if (A.pick === 'path') { const t = findShapeAt(w.x, w.y); if (t2IsPath(t) && !A.sel.includes(t)) { A.path = t; A.pick = null; t2ArrayPanel(); draw(); } else updateCommandMessageText('RÉSEAU : cliquez une droite, une polyligne, un arc ou un cercle (pas un des objets à répéter).'); return true; }
                return true;
            }
            if (isScaleMode() && t2.sref) {
                const R = t2.sref, p = t2Pt(w.x, w.y);
                if (R.step === 0) { R.base = { x: p.x, y: p.y }; R.step = 1; }
                else if (R.step === 1) { R.a = { x: p.x, y: p.y }; R.step = 2; }
                else if (R.step === 2) { R.ref = Math.hypot(p.x - R.a.x, p.y - R.a.y); if (R.ref > 1e-9) { R.b = { x: p.x, y: p.y }; R.step = 3; typedInput = ''; } }
                else { t2SrefApply(Math.hypot(p.x - R.a.x, p.y - R.a.y)); return true; }
                draw(); return true;
            }
            if (mode === 'move' && t2.moveCopy && moveBasePoint && selectedShapes.length) {
                const p = t2Pt(w.x, w.y), cl = t2Clone(selectedShapes.filter(x => !isBg(x))); cl.forEach(s => translateShape(s, p.x - moveBasePoint.x, p.y - moveBasePoint.y));
                shapes.push(...cl); saveState(); draw(); updateCommandMessageText('DÉPLACER : copie posée, l\'original reste. Cliquez une autre destination (C = déplacer sans copier), Échap pour finir.'); return true;
            }
            if (mode === 'rotate' && t2.rotCopy && rotateCenter && selectedShapes.length) {
                let diff = Math.atan2(w.y - rotateCenter.y, w.x - rotateCenter.x) - rotateStartAngle; if (typedInput && isFinite(t2Num(typedInput))) diff = -t2Num(typedInput) * Math.PI / 180;
                t2RotCopy(diff); return true;
            }
            switch (mode) {
                case 'copy': {
                    if (!selectedShapes.length) { const t = findShapeAt(w.x, w.y); if (t) selectedShapes = expandGroups([t]); else updateCommandMessageText('COPIER : cliquez l\'objet à copier (ou sélectionnez-les avant de lancer l\'outil).'); draw(); return true; }
                    const p = t2Pt(w.x, w.y);
                    if (!t2.cpBase) { t2.cpBase = { x: p.x, y: p.y }; typedInput = ''; draw(); return true; }
                    if (typedInput) { t2CopyTyped(); return true; }
                    const q = t2Constrain(t2.cpBase, p, e.shiftKey, !!p.sn); t2CopyPlace(q.x - t2.cpBase.x, q.y - t2.cpBase.y); return true;
                }
                case 'join': { const t = findShapeAt(w.x, w.y); if (!t2Joinable(t)) { updateCommandMessageText('JOINDRE : cliquez des droites, des polylignes ouvertes ou des arcs.'); return true; } selectedShapes = selectedShapes.includes(t) ? selectedShapes.filter(x => x !== t) : selectedShapes.concat([t]); draw(); return true; }
                case 'break': t2Break(w); return true;
                case 'addpt': t2AddPt(w); return true;
                case 'chamfer': {
                    const t = findShapeAt(w.x, w.y);
                    if (!t || t.type !== 'line' || t.wall) { updateCommandMessageText('CHANFREIN : cliquez une droite (éclatez d\'abord un rectangle ou une polyligne).'); return true; }
                    if (!t2.chA) { t2.chA = { s: t, c: w }; selectedShapes = [t]; }
                    else if (!t2.chB && t !== t2.chA.s) { t2.chB = { s: t, c: w }; selectedShapes = [t2.chA.s, t]; typedInput = ''; }
                    draw(); return true;
                }
                case 'lengthen': t2LenClick(w); return true;
                case 'ellipse': t2EllClick(w, e.shiftKey); return true;
                case 'paint': case 'texpick': case 'texclear': { let t = (typeof pick3DObj === 'function' ? pick3DObj(w) : null) || closedAt(w, is3DObj);
                    // toiture : en plan, le clic vise le pan sous le curseur (les pignons, cachés dessous, se peignent dans la vue 3D)
                    if (t && t.groupId) { const pan = shapes.find(x => x.groupId === t.groupId && x.solid && x.solid.kind === 'roof' && x.points && pointInPolygon(w.x, w.y, x.points)); if (pan) t = pan; }
                    { const zp = texPaint && texPaint.kind === 'paint' ? brushZoneAt(w.x, w.y) : null; if (zp && (!t || isPlateforme(t))) { brushZoneRepaint(zp, texPaint.tex); return true; } }
                    if (!t) { const tol = 10 / camera.zoom, pl = shapes.find(x => isPlateforme(x) && x.type === 'poly' && (platTalus(x).edges || []).some((e, k) => e && e.off && k < x.points.length && t2SegDist(w, x.points[k], x.points[(k + 1) % x.points.length]) < tol)); if (pl) { paroiPaint(pl); return true; } }
                    texApply(t); return true; }
                case 'paintzone': brushPickClick(w); return true;
                case 'blkbase': blkBaseClick(w); return true;
                case 'sonde': sondePlace(w); return true;
                case 'point': { const p = t2Pt(w.x, w.y); shapes.push({ type: 'point', layerId: activeLayerId, x: p.x, y: p.y }); saveState(); draw(); updateCommandMessageText('POINT posé. Cliquez le suivant, ou Échap.'); return true; }
                case 'divide': if (!t2.div) t2DivClick(w); return true;
                case 'dim-rad': case 'dim-dia': t2DimRClick(w); return true;
                case 'measure': { const p = t2Pt(w.x, w.y), last = t2.ms[t2.ms.length - 1], q = last ? t2Constrain(last, p, e.shiftKey, !!p.sn) : p; t2.ms.push({ x: q.x, y: q.y }); draw(); return true; }
            }
            return false;
        }
        function t2Message(msg) {
            if (!t2) return msg;
            const U = currentUnit, ty = typedInput ? t2Fr(typedInput) : '', n = selectedShapes.length;
            if (mode === 'move' && moveBasePoint && n) return msg + (t2.moveCopy ? '  [COPIE : l\'original reste — C pour déplacer sans copier]' : '  (C = garder l\'original : copie)');
            if (mode === 'rotate' && rotateCenter && n) return msg + (t2.rotCopy ? '  [COPIE : l\'original reste — C pour tourner sans copier]' : '  (C = garder l\'original : copie)');
            if (isScaleMode() && n && !t2.sref && !scaleCenter) msg += '  —  R = par référence (ex. caler un plan scanné)';
            if (isScaleMode() && t2.sref) { const R = t2.sref; return 'ÉCHELLE PAR RÉFÉRENCE : ' + (R.step === 0 ? 'cliquez le point de base (il ne bouge pas).' : R.step === 1 ? 'cliquez le 1er point d\'une longueur connue (ex. un bord de bâtiment).' : R.step === 2 ? 'cliquez le 2e point de cette longueur.' : 'longueur actuelle ' + calculateRealDistance(R.ref) + ' : tapez sa vraie longueur' + (ty ? ' = ' + ty + ' ' + U : '') + ' + Espace (ou cliquez-la).'); }
            if (t2.arrayPending && mode === 'select-box') return 'RÉSEAU : sélectionnez les objets à répéter, puis Espace (ou recliquez le bouton Réseau).';
            switch (mode) {
                case 'copy': return !n ? 'COPIER : cliquez l\'objet à copier (ou sélectionnez-les avant de lancer l\'outil).' : !t2.cpBase ? 'COPIER (' + n + ' objet(s)) : cliquez le point de base (un coin, un centre… les accroches aident).' : 'COPIER : cliquez où poser la copie, ou tapez une distance' + (ty ? ' = ' + ty + ' ' + U : '') + ' + Espace (direction de la souris). Les copies s\'enchaînent — Espace seul = terminer.';
                case 'array': return t2.arr && t2.arr.pick === 'center' ? 'RÉSEAU : cliquez le centre de rotation sur le plan.' : t2.arr && t2.arr.pick === 'path' ? 'RÉSEAU : cliquez le tracé (droite, polyligne, arc ou cercle).' : 'RÉSEAU : réglez la répétition dans la fenêtre (aperçu en direct), puis Créer.';
                case 'join': return 'JOINDRE : cliquez les traits à réunir (' + n + ' choisi(s)), puis Espace. Ils doivent se toucher bout à bout.';
                case 'addpt': return 'AJOUTER / RETIRER UN POINT : cliquez sur un trait ou le bord d\'une polyligne / plateforme pour ajouter un sommet ; sur un sommet existant (rond rouge), il est retiré.';
                case 'break': return 'COUPER AU POINT : cliquez sur le trait, à l\'endroit de la coupure (les accroches aident : milieu, croisement…).';
                case 'chamfer': return !t2.chA ? 'CHANFREIN : cliquez la 1re droite (du côté à garder).' : !t2.chB ? 'CHANFREIN : cliquez la 2e droite (du côté à garder).' : 'CHANFREIN : distance = ' + (ty || '…') + ' ' + U + ' puis Espace' + (t2.chD && !ty ? ' (Espace seul : ' + t2Fr(t2.chD) + ')' : '') + ' — deux distances différentes : 0,5/1.';
                case 'lengthen': return t2.lenDyn ? 'LONGUEUR : tirez le bout avec la souris et cliquez, ou tapez la longueur totale' + (ty ? ' = ' + ty + ' ' + U : '') + ' + Espace.' : t2.lenSpec ? 'LONGUEUR ' + (t2.lenSpec.kind === 'total' ? '= ' + t2Fr(t2.lenSpec.v) : (t2.lenSpec.v > 0 ? '+' : '') + t2Fr(t2.lenSpec.v)) + ' ' + U + ' : cliquez près des bouts à modifier (Espace = changer de valeur).' : 'LONGUEUR : cliquez près d\'un bout pour le tirer à la souris — ou tapez d\'abord 12 (longueur totale) ou +0,5 / -0,5 (allonger / raccourcir) puis Espace' + (ty ? ' [' + ty + ']' : '') + '.';
                case 'ellipse': { const E = t2.ell; return !E || !E.step ? 'ELLIPSE : cliquez le centre.' : E.step === 1 ? 'ELLIPSE : cliquez le bout du 1er demi-axe, ou tapez sa longueur' + (ty ? ' = ' + ty + ' ' + U : '') + ' + Espace.' : 'ELLIPSE : 2e demi-axe (en travers) : cliquez, ou tapez sa longueur' + (ty ? ' = ' + ty + ' ' + U : '') + ' + Espace.'; }
                case 'paint': case 'texpick': case 'texclear': return texPaint && texPaint.kind === 'paint' ? 'PEINDRE (' + ((TEX_LIB.find(t => t.id === texPaint.tex) || {}).name || '') + ') : cliquez les volumes à habiller, en plan ou dans la vue 3D. Échap pour finir.' : mode === 'texpick' ? 'PIPETTE : cliquez un volume pour reprendre sa texture.' : 'GOMME À TEXTURE : cliquez un volume pour lui rendre la couleur de son calque.';
                case 'blkbase': return 'IMPORTER UN BLOC : cliquez le point d\'insertion du bloc (les accroches aident). Échap pour annuler.';
                case 'facade': if (!CUT.a) return 'FAÇADE : cliquez le 1er point d\'une ligne tracée devant la façade, à quelques mètres (elle en donne la largeur ; rien n\'est coupé).'; break;
                case 'point': return 'POINT : cliquez pour poser un point de repère (les accroches aident). Échap pour finir.';
                case 'sonde': return 'SONDE D\'ENSOLEILLEMENT : cliquez dans une pièce (posée sur le plancher de l\'étage affiché) ou dehors (sur le sol fini). Y sur une sonde : nom, hauteur. Σ Calculs › Soleil pour la journée. Échap pour finir.';
                case 'divide': return t2.div ? 'DIVISER : réglez les repères dans la fenêtre (aperçu en direct), puis Poser.' : 'DIVISER : cliquez le tracé à jalonner (droite, polyligne, arc ou cercle).';
                case 'dim-rad': case 'dim-dia': { const nm = mode === 'dim-dia' ? 'COTE DE DIAMÈTRE' : 'COTE DE RAYON'; return t2.dr ? nm + ' : placez le texte (dedans ou dehors) et cliquez.' : nm + ' : cliquez un cercle ou un arc.'; }
                case 'measure': { const I = t2MsInfo({ x: currentX, y: currentY }); return 'MESURER : ' + (!t2.ms.length ? 'cliquez le 1er point (rien n\'est dessiné).' : t2MsText(I) + '  —  clic = point suivant, Espace = nouvelle mesure, ⌫ = retirer le dernier.'); }
            }
            return msg;
        }
        function t2Label(c, x, y, txt, col) {   // petite étiquette près du curseur (taille écran)
            const p = worldToScreen(x, y); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = 'bold 12px Arial'; const w = c.measureText(txt).width;
            c.fillStyle = 'rgba(30,30,30,0.92)'; c.fillRect(p.x + 15, p.y + 15, w + 10, 22); c.fillStyle = col || '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, p.x + 20, p.y + 26); c.restore();
        }
        function t2Ghost(c, list, f, alpha) {
            c.save(); c.globalAlpha = alpha || 0.5; let n = 0;
            for (const s0 of list) { if (n++ > 3000) break; if (!f) { drawSingleShape(c, s0, false, false, 0, 0); continue; } if (!f.rc && !f.th) { drawSingleShape(c, s0, false, false, f.dx || 0, f.dy || 0); continue; } const s = JSON.parse(JSON.stringify(s0)); t2ApplyXf(s, f); drawSingleShape(c, s, false, false, 0, 0); }
            c.restore();
        }
        function t2DrawPreview(c) {
            if (mode === 'addpt') { const V = t2VertexAt({ x: currentX, y: currentY }), z = camera.zoom;   // sur un sommet : l'outil devient « retirer »
                if (V) { const q = V.t ? V.t.points[V.i] : (V.L[1] === 1 ? { x: V.L[0].x1, y: V.L[0].y1 } : { x: V.L[0].x2, y: V.L[0].y2 }), r = 7 / z; c.save(); c.strokeStyle = '#f87171'; c.fillStyle = 'rgba(248,113,113,0.25)'; c.lineWidth = 2 / z; c.setLineDash([]);
                    c.beginPath(); c.arc(q.x, q.y, r, 0, 2 * Math.PI); c.fill(); c.stroke(); c.beginPath(); c.moveTo(q.x - r * 0.55, q.y); c.lineTo(q.x + r * 0.55, q.y); c.stroke(); c.restore(); t2Label(c, q.x, q.y, 'retirer le point'); } }
            if (!t2) return; const z = camera.zoom, cur = { x: currentX, y: currentY };
            // suivi polaire : rayon pointillé + angle
            if (t2.polarHit) { const B = t2.polarHit.base, dx = cur.x - B.x, dy = cur.y - B.y, L = Math.hypot(dx, dy) || 1, ext = 4000 / z; c.save(); c.strokeStyle = 'rgba(34,211,238,0.75)'; c.lineWidth = 1 / z; c.setLineDash([5 / z, 5 / z]); c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(B.x + dx / L * ext, B.y + dy / L * ext); c.stroke(); c.restore(); t2Label(c, cur.x, cur.y - 26 / z, '∠ ' + t2Fr(t2.polarHit.ang) + '°', '#67e8f9'); }
            if (mode === 'move' && t2.moveCopy && isMovingObjects) t2Ghost(c, selectedShapes, null, 0.55);
            if (mode === 'rotate' && t2.rotCopy && isRotatingObjects) t2Ghost(c, selectedShapes, null, 0.55);
            if (mode === 'copy' && t2.cpBase && selectedShapes.length) {
                let q = t2Constrain(t2.cpBase, cur, shiftHeld, !!currentSnap); const v = t2Num(typedInput);
                if (v > 0) { const a = Math.atan2(q.y - t2.cpBase.y, q.x - t2.cpBase.x), d = T2W(v); q = { x: t2.cpBase.x + Math.cos(a) * d, y: t2.cpBase.y + Math.sin(a) * d }; }
                t2Ghost(c, selectedShapes, { dx: q.x - t2.cpBase.x, dy: q.y - t2.cpBase.y }, 0.55);
                c.save(); c.strokeStyle = '#c084fc'; c.lineWidth = 1 / z; c.setLineDash([4 / z, 4 / z]); c.beginPath(); c.moveTo(t2.cpBase.x, t2.cpBase.y); c.lineTo(q.x, q.y); c.stroke(); c.restore();
                t2Label(c, q.x, q.y, (v > 0 ? ty2() : calculateRealDistance(Math.hypot(q.x - t2.cpBase.x, q.y - t2.cpBase.y))));
            }
            if (mode === 'array' && t2.arr) {
                const A = t2.arr; t2ArrayXf().forEach((f, i) => { if (i < 600) t2Ghost(c, A.sel, f, 0.45); });
                if (A.center) { const t = 6 / z; c.save(); c.strokeStyle = '#facc15'; c.lineWidth = 2 / z; c.beginPath(); c.arc(A.center.x, A.center.y, t, 0, 2 * Math.PI); c.moveTo(A.center.x - 2 * t, A.center.y); c.lineTo(A.center.x + 2 * t, A.center.y); c.moveTo(A.center.x, A.center.y - 2 * t); c.lineTo(A.center.x, A.center.y + 2 * t); c.stroke(); c.restore(); }
                if (A.path && shapes.includes(A.path)) { c.save(); c.globalAlpha = 0.9; drawSingleShape(c, A.path, false, true, 0, 0); c.restore(); }
            }
            if (mode === 'divide' && t2.div) {
                const D = t2.div, P = t2PathOf(D.s);
                if (P) { const st = t2DivStations(P, D); c.save(); c.fillStyle = '#facc15'; c.strokeStyle = '#facc15'; c.lineWidth = 1.5 / z; st.slice(0, 3000).forEach(d => { const q = t2PathAt(P, d); c.beginPath(); c.arc(q.x, q.y, 3.5 / z, 0, 2 * Math.PI); c.fill(); }); c.restore();
                    if (D.what !== 'point') { const sh = t2DivShapes(D); c.save(); c.globalAlpha = 0.6; sh.slice(0, 3000).forEach(s => drawSingleShape(c, s, false, false, 0, 0)); c.restore(); } }
            }
            if (mode === 'ellipse' && t2.ell && t2.ell.step) {
                const E = t2.ell; c.save(); c.strokeStyle = document.getElementById('prop-color').value; c.lineWidth = 1.5 / z; c.setLineDash([]);
                if (E.step === 1) { const q = t2Constrain(E.c, cur, shiftHeld, !!currentSnap), v = t2Num(typedInput), a = v > 0 ? T2W(v) : Math.hypot(q.x - E.c.x, q.y - E.c.y), r = Math.atan2(q.y - E.c.y, q.x - E.c.x); c.beginPath(); c.moveTo(E.c.x - Math.cos(r) * a, E.c.y - Math.sin(r) * a); c.lineTo(E.c.x + Math.cos(r) * a, E.c.y + Math.sin(r) * a); c.stroke(); c.globalAlpha = 0.35; c.beginPath(); c.arc(E.c.x, E.c.y, a, 0, 2 * Math.PI); c.stroke(); t2Label(c, cur.x, cur.y, 'a = ' + calculateRealDistance(a)); }
                else { const b = t2EllB(), P = t2EllPts(E.c, E.a, Math.max(b, 1e-6), E.rot); c.beginPath(); P.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.stroke(); t2Label(c, cur.x, cur.y, calculateRealDistance(2 * E.a) + ' × ' + calculateRealDistance(2 * b)); }
                c.restore();
            }
            if (mode === 'lengthen' && t2.lenDyn) {
                const D = t2.lenDyn, v = t2Num(typedInput), T = v > 0 ? T2W(v) : t2LenDynT(), s = JSON.parse(D.orig);
                if (T > 1e-9 && !t2LenSet(s, D.end, T)) { c.save(); c.globalAlpha = 0.9; drawSingleShape(c, s, false, true, 0, 0); c.restore(); t2Label(c, cur.x, cur.y, 'L = ' + calculateRealDistance(T)); }
            }
            if ((mode === 'dim-rad' || mode === 'dim-dia') && t2.dr) { const s = t2.dr.s, pv = t2DimRMake({ x: s.x, y: s.y }, s.r, cur, mode === 'dim-dia'); c.save(); c.lineWidth = 1.2 / z; drawDimR(c, pv, '#f59e0b', 0, 0, z); c.restore(); }
            if (mode === 'measure' && t2.ms.length) {
                const P = t2.ms.concat([cur]); c.save(); c.strokeStyle = '#22d3ee'; c.fillStyle = '#22d3ee'; c.lineWidth = 2 / z; c.setLineDash([]);
                c.beginPath(); P.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
                if (P.length >= 3) { c.globalAlpha = 0.12; c.beginPath(); P.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill(); c.globalAlpha = 0.6; c.setLineDash([4 / z, 4 / z]); c.beginPath(); c.moveTo(cur.x, cur.y); c.lineTo(P[0].x, P[0].y); c.stroke(); }
                c.globalAlpha = 1; c.setLineDash([]); t2.ms.forEach(q => { c.beginPath(); c.arc(q.x, q.y, 3 / z, 0, 2 * Math.PI); c.fill(); });
                for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.y - a.y); if (L * z > 40) dimensionTextsToDraw.push({ text: calculateRealDistance(L), worldX: (a.x + b.x) / 2, worldY: (a.y + b.y) / 2, color: '#22d3ee', layerId: DIM_LAYER_ID, angle: Math.atan2(b.y - a.y, b.x - a.x), al: true }); }
                c.restore();
                const I = t2MsInfo(cur); if (I && I.n >= 2) t2Label(c, cur.x, cur.y, 'L ' + calculateRealDistance(I.seg) + (I.n > 2 ? ' · Σ ' + calculateRealDistance(I.tot) : '') + (I.area > 0 ? ' · ' + fmtSurface(I.area) : ''), '#67e8f9');
            }
            if (isScaleMode() && t2.sref) {
                const R = t2.sref; c.save(); c.strokeStyle = '#10b981'; c.fillStyle = '#10b981'; c.lineWidth = 1.5 / z; c.setLineDash([4 / z, 4 / z]);
                if (R.base) { c.beginPath(); c.arc(R.base.x, R.base.y, 4 / z, 0, 2 * Math.PI); c.fill(); }
                if (R.a) { const b = R.b || cur; c.beginPath(); c.moveTo(R.a.x, R.a.y); c.lineTo(b.x, b.y); c.stroke(); }
                c.restore();
                if (R.step === 3) { const v = t2Num(typedInput); if (v > 0) { const f = T2W(v) / R.ref; c.save(); c.globalAlpha = 0.5; selectedShapes.forEach(s0 => { const s = JSON.parse(JSON.stringify(s0)); applyScaleToShape(s, R.base.x, R.base.y, f); drawSingleShape(c, s, false, false, 0, 0); }); c.restore(); } }
            }
        }
        function ty2() { return t2Fr(typedInput) + ' ' + currentUnit; }
        // les accroches ne s'affichent (et ne s'acquièrent) que pendant un tracé ou une modification qui s'en sert
        function t2SnapUsed() {
            if (gripDrag) return true;
            if (mode === 'select-box') return false;
            if (['trim', 'extend', 'hatch', 'print', 'preview', 'join', 'chamfer', 'fillet', 'extrude', 'sweep', 'sweeppick', 'pierce', 'bool', 'tilt', 'stack', 'elevate', 'cubpick', 'dim-angle', 'divide', 'array', 'lengthen', 'dim-rad', 'dim-dia', 'calibrate', 'paint', 'texpick', 'texclear'].includes(mode)) {
                if (mode === 'array' && t2.arr && t2.arr.pick === 'center') return true;
                if (mode === 'calibrate' && calTarget) return true;
                return false;
            }
            if ((mode === 'move' || mode === 'rotate' || isScaleMode()) && !selectedShapes.length) return false;
            if (mode === 'copy' && !selectedShapes.length) return false;
            if (mode === 'text') return false;
            return true;
        }
        // marqueurs d'accroche supplémentaires (tangente, proche)
        function t2SnapMarker(c, S, t) {
            if (!S || (!S.tan && !S.near)) return false;
            c.save(); c.setLineDash([]); c.lineWidth = 2 / camera.zoom; c.strokeStyle = S.tan ? '#22d3ee' : '#eab308'; c.beginPath();
            if (S.tan) { c.arc(S.x, S.y, t * 0.8, 0, 2 * Math.PI); c.moveTo(S.x - t * 1.4, S.y - t * 0.8); c.lineTo(S.x + t * 1.4, S.y - t * 0.8); }
            else { c.moveTo(S.x - t, S.y - t); c.lineTo(S.x + t, S.y - t); c.lineTo(S.x - t, S.y + t); c.lineTo(S.x + t, S.y + t); c.closePath(); }
            c.stroke(); c.restore(); return true;
        }

        // =====================================================================
        // SÉLECTION : clic sur un objet = le choisir ; clic dans le vide = 1er coin, 2e clic = 2e coin (fenêtre) ;
        // bouton maintenu en glissant = lasso (tout ce qui est entièrement dans le tracé à main levée)
        // =====================================================================
        var t2Sel = null;
        function t2SelDown(wp, e) {
            if (isDrawing && !t2Sel) isDrawing = false;   // état resté d'un outil précédent : ce clic démarre bien une nouvelle sélection
            if (!isDrawing) {
                startX = wp.x; startY = wp.y; isDrawing = true;
                t2Sel = { phase: 'press', pts: [{ x: wp.x, y: wp.y }], sx: currentX_screen, sy: currentY_screen, shift: e.shiftKey };
                return;
            }
            if (t2Sel && t2Sel.phase === 'window') t2Sel.phase = 'close';   // 2e clic : la fenêtre se ferme au relâché
        }
        function t2SelMove(e) {
            const S = t2Sel; if (!S || mode !== 'select-box' || !isDrawing) return;
            if (S.phase === 'press' && (e.buttons & 1) && Math.hypot(currentX_screen - S.sx, currentY_screen - S.sy) > 6) S.phase = 'lasso';
            if (S.phase === 'lasso') { const l = S.pts[S.pts.length - 1]; if (Math.hypot(currentX - l.x, currentY - l.y) * camera.zoom > 3) S.pts.push({ x: currentX, y: currentY }); }
        }
        function t2KeyPts(s) {
            if (s.type === 'cline') return [];
            const c8 = (x, y, r) => Array.from({ length: 8 }, (_, i) => ({ x: x + r * Math.cos(i * Math.PI / 4), y: y + r * Math.sin(i * Math.PI / 4) }));
            if (s.type === 'line' || s.type === 'dim' || s.type === 'slope') return [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
            if (s.type === 'circle' || s.type === 'basemap') return c8(s.x, s.y, s.r);
            if (s.type === 'arc') return t2PathOf(s).pts.filter((q, i, a) => i % 8 === 0 || i === a.length - 1);
            if (s.type === 'poly') return s.points;
            if (s.type === 'hatch') return s.loops[0];
            if (s.type === 'dim-angle') return [s.vertex, s.p1, s.p2];
            if (s.type === 'detail') return [{ x: s.tx, y: s.ty }, { x: s.lx, y: s.ly }];
            if (s.type === 'dimr') return [{ x: s.x, y: s.y }, { x: s.lx, y: s.ly }];
            if (s.type === 'bgimage') return bgCorners(s);
            if (s.type === 'pdfvec') return vecCorners(s);
            if (s.type === 'mesh') return meshCorners(s);
            if (s.x !== undefined) return [{ x: s.x, y: s.y }];
            return [];
        }
        // true = laisser le code habituel finir (clic sur un objet, ou fenêtre fermée par le 2e clic)
        function t2SelUp(e) {
            const S = t2Sel; if (!S) return true;
            if (S.phase === 'press') {
                if (Math.hypot(currentX_screen - S.sx, currentY_screen - S.sy) <= 6 && !findShapeAt(startX, startY)) {
                    S.phase = 'window'; draw();
                    updateCommandMessageText('FENÊTRE : cliquez le 2e coin (Échap pour annuler). Astuce : bouton maintenu en glissant = lasso.');
                    return false;
                }
                t2Sel = null; currentX = startX; currentY = startY; return true;   // clic (même un peu tremblé) sur un objet : c'est un clic, pas une mini-fenêtre
            }
            if (S.phase === 'window') return false;
            if (S.phase === 'close') { t2Sel = null; return true; }
            // lasso
            const L = S.pts.concat([{ x: currentX, y: currentY }]); t2Sel = null; isDrawing = false; moveTypedX = null; typedInput = '';
            if (L.length >= 3) {
                shapes.forEach(s => { if (!t2Vis(s)) return; const K = t2KeyPts(s); if (K.length && K.every(q => pointInPolygon(q.x, q.y, L)) && !selectedShapes.includes(s)) selectedShapes.push(s); });
                selectedShapes = expandGroups(selectedShapes);
                updateCommandMessageText('LASSO : ' + selectedShapes.length + ' objet(s) sélectionné(s).');
            }
            draw(); return false;
        }
