        // =====================================================================
        // ---- FAÇONNER : plusieurs plateformes à talus deviennent un seul ouvrage. Les vides entre elles (coins, bandes de quelques mètres) sont comblés
        //      par des « raccords » au niveau des plateformes voisines, et un seul talus, continu, fait le tour de l'ensemble (mêmes pentes partout).
        //      Les plateformes qui se recouvrent sont découpées (la plus haute garde sa forme) ; un façonnage se défait (formes d'origine rendues) ou se refait à tout moment.
        const FACON_GAP = 4;   // m : vides comblés jusqu'à ~2 × cette largeur
        function faconPlats(sel) { return (sel || selectedShapes).filter(s => isPlateforme(s) && s.type === 'poly' && !s.faconFill); }
        function faconOf(sel) { const g = new Set(); (sel || selectedShapes).forEach(s => { if (s.facon) g.add(s.facon); if (s.faconFill) g.add(s.faconFill); }); return [...g]; }
        // dilatation d'un ensemble de contours (polygones polygon-clipping) : contour + bandes le long des arêtes + disques aux sommets
        function pcBand(rings, g) { const out = []; rings.forEach(R => { const n = R.length; for (let i = 0; i < n; i++) { const a = R[i], b = R[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) continue;
                const nx = -(b[1] - a[1]) / L * g, ny = (b[0] - a[0]) / L * g; out.push([[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]]]);
                const C = []; for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI * 2; C.push([a[0] + Math.cos(t) * g, a[1] + Math.sin(t) * g]); } C[16] = C[0]; out.push([C]); } }); return out; }
        const pcRingsOf = (MP) => MP.flatMap(P => P.map(R => R.slice(0, -1)));
        // coordonnées calées sur une grille de 5 mm : la bibliothèque de découpe déraille sur des sommets presque confondus
        const pcSnap = (MP, q) => MP.map(P => P.map(R => { const o = []; R.forEach(([x, y]) => { const a = [+(Math.round(x / q) * q).toFixed(6), +(Math.round(y / q) * q).toFixed(6)], l = o[o.length - 1]; if (!l || l[0] !== a[0] || l[1] !== a[1]) o.push(a); }); if (o.length && (o[0][0] !== o[o.length - 1][0] || o[0][1] !== o[o.length - 1][1])) o.push(o[0].slice()); return o; }).filter(R => R.length >= 4)).filter(P => P.length);
        function faconZ(x, y, list) { let best = null, bd = Infinity; list.forEach(s => { const R = platRing(s), n = R.length; for (let i = 0; i < n; i++) { const a = R[i], b = R[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2)), d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y); if (d < bd) { bd = d; const za = hasZ(a.z) ? a.z : platZ(s), zb = hasZ(b.z) ? b.z : platZ(s); best = za + (zb - za) * t; } } });
            return Math.round(best); }
        async function faconner(list) { list = list || faconPlats(); if (list.length < 2) { updateCommandMessageText('FAÇONNER : sélectionnez au moins deux plateformes.'); return null; }
            await loadPolyClip().catch(() => {}); if (!window.polygonClipping) { updateCommandMessageText('FAÇONNER : bibliothèque de calcul indisponible (connexion ?).'); return null; }
            const snap = JSON.stringify(shapes), fail = (msg) => { shapes = JSON.parse(snap); selectedShapes = []; invalidateCache(); draw(); updateCommandMessageText(msg); return null; };   // échec en cours de route : rien ne reste à moitié façonné
            faconOf(list).forEach(g => faconUndo(g, true));
            list = list.filter(x => shapes.includes(x) && isPlateforme(x)); if (list.length < 2) return fail('FAÇONNER : sélectionnez au moins deux plateformes.');
            list.forEach(s => { if (!s.faconBak) s.faconBak = JSON.stringify({ points: s.points, talus: s.talus || null }); });   // tout membre retrouve ses sommets ET son talus d'avant au Défaire
            // calcul dans un repère local (origine au centre des plateformes) : loin de l'origine, la bibliothèque de découpe perd en précision et échoue
            const M = mmToWorld(1000), O = (() => { let x = 0, y = 0, n = 0; list.forEach(s => platRing(s).forEach(v => { x += v.x; y += v.y; n++; })); return { x: Math.round(x / n / M) * M, y: Math.round(y / n / M) * M }; })(), Lc = (v) => [v.x - O.x, v.y - O.y];
            const g = FACON_GAP * M, PC = polygonClipping, rings = list.map(s => { const R = platRing(s).map(Lc); R.push(R[0]); return [R]; });
            let q = mmToWorld(5); const sn = (MP) => pcSnap(MP, q), un = (A) => A.reduce((acc, x) => sn(PC.union(acc, x)));
            // la bibliothèque échoue parfois sur des sommets presque confondus : on recommence sur une grille plus grossière (5 mm, 2 cm, 10 cm)
            const pcTry = (f) => { const q0 = q; let err; for (const k of [1, 4, 20]) { q = q0 * k; try { const r = f(); q = q0; return r; } catch (e) { err = e; } } q = q0; throw err; };
            // plateformes qui se recouvrent : celle du dessous est découpée par celle du dessus (la plus haute, à hauteur égale la dernière dessinée ; une fosse posée dedans reste une fosse)
            const zTop = (s) => Math.max(...platRing(s).map(v => hasZ(v.z) ? v.z : platZ(s))), inside = (a, b) => platRing(a).every(v => pointInPolygon(v.x, v.y, platRing(b)));
            const orig = list.map(s => { const R = platRing(s).map(Lc); R.push(R[0]); return sn([[R]])[0]; });
            const cuts = [];
            list.forEach((s, i) => { const W = list.map((t, j) => j).filter(j => j !== i && !inside(list[j], s) && !inside(s, list[j]) && (zTop(list[j]) > zTop(s) + 0.5 || (Math.abs(zTop(list[j]) - zTop(s)) <= 0.5 && shapes.indexOf(list[j]) > shapes.indexOf(s))));
                if (!W.length) return; let D; try { D = pcTry(() => sn(PC.difference(sn([orig[i]]), ...W.map(j => sn([orig[j]]))))); } catch (e) { console.warn('façonner', e); return; }
                const A0 = Math.abs(polyArea(orig[i][0].map(([x, y]) => ({ x, y })))), aOf = (P) => Math.abs(polyArea(P[0].map(([x, y]) => ({ x, y }))));
                const kept = D.filter(P => aOf(P) / (mmToWorld(1000) ** 2) > 0.3); if (!kept.length || Math.abs(kept.reduce((t, P) => t + aOf(P), 0) - A0) < A0 * 1e-4) return;
                cuts.push({ s, pieces: kept.sort((x, y) => aOf(y) - aOf(x)) }); });
            const pieces = [];
            cuts.forEach(({ s, pieces: K }) => { const R0 = platRing(s).map(v => Object.assign({}, v)), E0 = s.talus && s.talus.edges ? s.talus.edges.slice() : null;
                let surf0 = null; try { surf0 = platSurf(s); } catch (e) {} const z00 = platZ(s), zOf = (x, y) => { try { const z = platZAt(surf0, x, y); if (hasZ(z)) return Math.round(z); } catch (e) {} return z00; }, tol = mmToWorld(50);   // cote de la plateforme d'origine au point (plane ou inclinée)
                const mk = (P) => { const pts = cleanPolyPts(P[0].slice(0, -1).map(([x, y]) => ({ x: x + O.x, y: y + O.y })), true).map(v => ({ x: v.x, y: v.y, z: zOf(v.x, v.y) }));
                    const edges = E0 ? pts.map((v, k) => { const w = pts[(k + 1) % pts.length], mx = (v.x + w.x) / 2, my = (v.y + w.y) / 2; for (let j = 0; j < R0.length; j++) if (t2SegDist({ x: mx, y: my }, R0[j], R0[(j + 1) % R0.length]) < tol) return E0[j] || null; return null; }) : null;
                    return { pts, edges }; };
                K.forEach((P, k) => { const { pts, edges } = mk(P); if (pts.length < 3) return; if (k === 0) { s.points = pts; if (edges) s.talus.edges = edges; }
                    else { const c = JSON.parse(JSON.stringify(s)); delete c.faconBak; c.points = pts; if (edges) c.talus.edges = edges; c.faconPiece = 1; c.name = (s.name || s.pfName || 'Plateforme') + ' (morceau)'; pieces.push(c); } }); });
            if (pieces.length) { shapes.push(...pieces); list = list.concat(pieces); }
            if (cuts.length) { rings.length = 0; list.forEach(s => { const R = platRing(s).map(Lc); R.push(R[0]); rings.push([R]); }); invalidateCache(); }
            let U0; try { U0 = pcTry(() => un(sn(rings))); } catch (e) { return fail('FAÇONNER : contours illisibles (' + e.message + ').'); }
            // fermeture : dilater de g puis éroder de g ; ce qui s'ajoute aux plateformes, ce sont les vides à combler
            let gaps = []; try { gaps = pcTry(() => { const D = un([U0].concat(sn(pcBand(pcRingsOf(U0), g)).map(x => [x]))), Cl = sn(PC.difference(D, ...sn(pcBand(pcRingsOf(D), g)).map(x => [x]))); return sn(PC.difference(Cl, sn(U0))); }); } catch (e) { console.warn('façonner', e); return fail('FAÇONNER : calcul des raccords impossible (' + e.message + ').'); }
            const gid = 'fc' + Date.now().toString(36), T0 = platTalus(list[0]), tal = { on: true, kR: T0.kR || '3/2', kD: T0.kD || '1/1' }, fills = [];
            gaps.forEach(P => { const R = P[0].slice(0, -1).map(([x, y]) => ({ x: x + O.x, y: y + O.y })), A = Math.abs(polyArea(R)) / (M * M); if (R.length < 3 || A < 0.3) return;
                const pts = cleanPolyPts(R, true).map(q => ({ x: q.x, y: q.y, z: faconZ(q.x, q.y, list) })); if (pts.length < 3) return;
                fills.push({ type: 'poly', layerId: list[0].layerId, points: pts, zk: 1, plat: true, hatch: false, dash: 'dashed', name: 'Raccord façonné', faconFill: gid, talus: Object.assign({}, tal) }); });
            list.forEach(s => { s.facon = gid; s.talus = Object.assign({}, s.talus || {}, tal); });
            shapes.push(...fills); selectedShapes = list.slice(); invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            const a = fills.reduce((t, s) => t + Math.abs(polyArea(s.points)), 0) / (M * M);
            updateCommandMessageText('FAÇONNÉ : ' + list.length + ' plateformes en un seul ouvrage, talus continu tout autour (' + tal.kR + ' en remblai, ' + tal.kD + ' en déblai)' + (cuts.length ? ' ; ' + cuts.length + ' plateforme(s) découpée(s) : plus aucune sous une autre' : '') + (fills.length ? ' ; ' + fills.length + ' raccord(s) comblé(s), ' + nfr(a, 1) + ' m²' : '') + '. Clic droit › Défaire le façonnage pour revenir en arrière.');
            return gid; }
        function faconUndo(gid, quiet) { const n0 = shapes.length; shapes = shapes.filter(s => s.faconFill !== gid && !(s.faconPiece && s.facon === gid)); const mem = shapes.filter(s => s.facon === gid);
            mem.forEach(s => { delete s.facon; if (s.faconBak) { try { const B = JSON.parse(s.faconBak); s.points = B.points; if (B.talus) s.talus = B.talus; else delete s.talus; } catch (e) {} delete s.faconBak; } }); invalidateCache();
            if (quiet) return mem; selectedShapes = mem; invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText('FAÇONNAGE défait : ' + mem.length + ' plateforme(s) de nouveau indépendantes' + (n0 - shapes.length ? ', ' + (n0 - shapes.length) + ' raccord(s) retiré(s)' : '') + '.'); return mem; }
        function faconRedo(gid) { const mem = faconUndo(gid, true); return faconner(mem); }
        // ---- CLIC DROIT : menu des actions sur la sélection (sur un objet non sélectionné : il est sélectionné d'abord)
        function ctxItems() { const it = [], P = faconPlats(), G = faconOf();
            if (P.length >= 2 && !(G.length === 1 && P.every(s => s.facon === G[0]))) it.push(['⛰', 'Façonner (' + P.length + ' plateformes)', () => faconner(P), 'Un seul ouvrage : vides comblés, un talus continu tout autour']);
            G.forEach(g => { it.push(['↻', 'Refaçonner', () => faconRedo(g), 'Recalculer après avoir modifié une plateforme']); it.push(['↶', 'Défaire le façonnage', () => faconUndo(g), 'Les plateformes redeviennent indépendantes']); });
            selectedShapes.filter(x => x.fond && x.fond.auto === false).forEach(x => it.push(['⇣', 'Recaler sous la dalle', () => fondRecale(x), 'Z sommets à la main abandonnés']));
            const rc = refoulAt(window.__ctxW); if (rc) { if (it.length) it.push(null); it.push(['◜', 'Refoulement du talus…', () => refoulPanel(rc.pl, rc.k), 'Limite du talus à ce bout']); }
            if (selectedShapes.length) { if (it.length) it.push(null); it.push(['⚙', 'Paramètres…', () => openSelectionParamModal(), 'Y']); it.push(['🗑', 'Supprimer', () => { shapes = shapes.filter(s => !selectedShapes.includes(s)); selectedShapes = []; invalidateCache(); saveState(); draw(); }, 'Suppr']); }
            return it; }
        // bouts libres d'un talus (sommet entre une arête talutée et une paroi) près du clic droit
        function refoulEnds(pl) { const t = platTalus(pl); if (!t.on || pl.type !== 'poly' || !t.edges) return []; const n = pl.points.length, E = t.edges, off = (i) => !!(E[i] && E[i].off), out = [];
            for (let k = 0; k < n; k++) { const a = off((k - 1 + n) % n), b = off(k); if (a !== b) out.push(k); } return out; }
        function refoulAt(w) { if (!w) return null; const tol = 14 / camera.zoom; let best = null;
            shapes.forEach(pl => { if (!isPlateforme(pl)) return; refoulEnds(pl).forEach(k => { const q = pl.points[k], d = Math.hypot(q.x - w.x, q.y - w.y); if (d < tol && (!best || d < best.d)) best = { pl, k, d }; }); });
            return best; }
        // tirette de la limite de refoulement : 0° = talus coupé net au bout de l'arête, 180° = il fait le tour et revient contre la paroi
        function refoulPanel(pl, k) { document.getElementById('refoul-pop')?.remove(); const t = platTalus(pl), cur = talCorners(pl), v0 = cur && cur[k] !== undefined ? cur[k] : 180, had = pl.talus.corn ? Object.assign({}, pl.talus.corn) : undefined;
            const m = document.createElement('div'); m.id = 'refoul-pop'; m.className = 'refoul-pop';
            m.innerHTML = `<div class="rp-h">Refoulement du talus <span>sommet ${k + 1}</span></div><input id="rf-rg" type="range" min="0" max="180" step="5" value="${v0}"><div class="rp-v"><b id="rf-val"></b><span>0° : coupé net · 180° : tour complet</span></div>
                <div class="rp-b"><button type="button" id="rf-auto">Par défaut</button><button type="button" id="rf-cancel">Annuler</button><button type="button" id="rf-ok" class="ok">OK</button></div>`;
            document.body.appendChild(m); const sp = worldToScreen(pl.points[k].x, pl.points[k].y), r = canvas.getBoundingClientRect(); m.style.left = Math.min(r.left + sp.x + 16, innerWidth - 290) + 'px'; m.style.top = Math.min(r.top + sp.y + 16, innerHeight - 150) + 'px';
            const rg = m.querySelector('#rf-rg'), lab = m.querySelector('#rf-val'), set = (v) => { const c = Object.assign({}, pl.talus.corn); if (v === undefined) delete c[k]; else c[k] = v >= 180 ? null : v; pl.talus.corn = Object.keys(c).length ? c : undefined; if (!pl.talus.corn) delete pl.talus.corn; invalidateCache(); draw(); };
            const show = () => { lab.textContent = +rg.value >= 180 ? '180° (tour complet)' : rg.value + '°'; }; show();
            rg.oninput = () => { show(); set(+rg.value); };
            m.querySelector('#rf-auto').onclick = () => { set(undefined); const c = talCorners(pl); rg.value = c && c[k] !== undefined ? c[k] : 180; show(); };
            m.querySelector('#rf-cancel').onclick = () => { pl.talus.corn = had; if (!had) delete pl.talus.corn; invalidateCache(); draw(); m.remove(); };
            m.querySelector('#rf-ok').onclick = () => { m.remove(); saveState(); refresh3D(); }; }
        function ctxClose() { const m = document.getElementById('ctx-menu'); if (m) m.remove(); }
        function ctxOpen(cx, cy) { ctxClose(); const it = ctxItems(); if (!it.length) return false; const m = document.createElement('div'); m.id = 'ctx-menu';
            m.innerHTML = it.map((x, i) => x ? `<button type="button" data-i="${i}"><span class="ci">${x[0]}</span><span class="cl">${MF.esc(x[1])}</span><span class="ch">${MF.esc(x[3] || '')}</span></button>` : '<hr>').join('');
            document.body.appendChild(m); const r = m.getBoundingClientRect(); m.style.left = Math.min(cx, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(cy, innerHeight - r.height - 6) + 'px';
            m.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const x = it[+b.dataset.i]; ctxClose(); if (x) x[2](); }; return true; }
        canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (layoutOn || is3DOpen() || isDrawing || mode !== 'select-box') return;
            const r = canvas.getBoundingClientRect(), w = screenToWorld(e.clientX - r.left, e.clientY - r.top), t = findShapeAt(w.x, w.y) || closedAt(w, x => isPlateforme(x)); window.__ctxW = w;
            if (t && !selectedShapes.includes(t)) { selectedShapes = [t]; draw(); try { updatePropertiesPopup(); } catch (er) {} }
            ctxOpen(e.clientX, e.clientY); });
        document.addEventListener('pointerdown', (e) => { if (!e.target.closest || !e.target.closest('#ctx-menu')) ctxClose(); }, true);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ctxClose(); }, true);
        canvas.addEventListener('mousedown', (e) => {
            // cliquer dans le dessin rend le clavier au dessin (sauf l'éditeur de texte en cours)
            const ae = document.activeElement;
            if (ae && ae !== document.body && ae.id !== 'inline-editor' && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'BUTTON')) ae.blur();
            const r = canvas.getBoundingClientRect(); let sx = e.clientX-r.left, sy = e.clientY-r.top;
            if (brush2D() && e.button === 0 && !e.shiftKey) { e.preventDefault(); brushTool.down = true; brushDown({ H: brush2DHit(sx, sy), clientX: e.clientX, clientY: e.clientY, detail: e.detail }); return; }   // pinceau en plan
            if (e.button === 1 && layoutOn && lp3D.id && lp3DDown(e, sx, sy)) return;
            if (e.button === 1) { e.preventDefault();
                // double-clic molette : tout le dessin dans la fenêtre (comme AutoCAD)
                const now = performance.now();
                if (now - midClickT < 400 && Math.hypot(sx - midClickX, sy - midClickY) < 8) { midClickT = 0; isPanning = false; zoomExtents(); return; }
                midClickT = now; midClickX = sx; midClickY = sy;
                isPanning = true; lastPanX = sx; lastPanY = sy; canvas.style.cursor = 'grabbing'; return; }
            if (spDirPick && e.button === 0) { const w = screenToWorld(sx, sy); spDirClick(w.x, w.y); draw(); return; }
            if (layoutOn && lp3D.id && (e.button === 0 || e.button === 1) && lp3DDown(e, sx, sy)) return;
            if (layoutOn && e.button === 0 && lpMouseDown(e, sx, sy)) return;

            if (isOrthoView()) { updateCommandMessageText('VUE ' + viewName(view2d.a, view2d.e).toUpperCase() + ' : consultation seulement — cliquez Z ou « Dessus » dans la rosace pour dessiner.'); return; }
            if (mode === 'print') { performPrint(sx, sy); return; }
            if (mode === 'preview') { previewPin = previewPin ? null : { x: sx, y: sy }; draw(); return; }
            if (mode === 'bmplace' && e.button === 0) { const w = screenToWorld(sx, sy); placeBasemapAt(w.x, w.y); return; }
            if (mode === 'stamp' && e.button === 0) { const w = screenToWorld(sx, sy), sn = findSnap(w.x, w.y); currentX = sn ? sn.x : w.x; currentY = sn ? sn.y : w.y; placeStamp(); return; }
            if (mode === 'pen' && e.button === 0) { const w = screenToWorld(sx, sy); penDown(w.x, w.y); updateCommandMessage(); draw(); return; }
            if (mode === 'recoupe' && e.button === 0) { const w = screenToWorld(sx, sy); rcpClick(w.x, w.y); return; }
            if (mode === 'mirror' && e.button === 0) { const w = screenToWorld(sx, sy); mirrorClick(w.x, w.y, e.shiftKey); return; }
            if (mode === 'select-box' && e.button === 0 && !isDrawing && !layoutOn && !gripDrag) { const bb = bldBadgeAt(sx, sy); if (bb) { bldOpen(bb.id); return; } }   /* la pastille d'un bâtiment passe avant les poignées et les objets dessous */
            if (e.button === 0 && t2MouseDown(sx, sy, e)) return;
            if (mode === 'wall' && e.button === 0 && wallTool) {
                const w = screenToWorld(sx, sy), sn = findSnap(w.x, w.y); let px = sn ? sn.x : w.x, py = sn ? sn.y : w.y;
                if (!wallStart) { wallStart = { x: px, y: py }; wallChain = null; }
                else { const t = wallTarget(px, py, e.shiftKey); if (Math.hypot(t.x - wallStart.x, t.y - wallStart.y) > 1e-6) wallAddTo(t.x, t.y); }
                updateCommandMessage(); draw(); return;
            }
            if (mode === 'stretch' && e.button === 0) {
                const w = screenToWorld(sx, sy), sn = findSnap(w.x, w.y); let px = sn ? sn.x : w.x, py = sn ? sn.y : w.y;
                if (!stretchWin) {
                    if (!stretchA) { stretchA = { x: w.x, y: w.y }; }
                    else { stretchWin = { x0: Math.min(stretchA.x, w.x), x1: Math.max(stretchA.x, w.x), y0: Math.min(stretchA.y, w.y), y1: Math.max(stretchA.y, w.y) };
                        const t = stretchTargets(); if (!t.length) { stretchWin = stretchA = null; updateCommandMessageText('ÉTIRER : aucun sommet dans la fenêtre, recommencez.'); draw(); return; }
                        selectedShapes = t.map(i => shapes[i]); }
                } else if (!stretchBase) stretchBase = { x: px, y: py };
                else { if (orthoMode || e.shiftKey) { if (Math.abs(px - stretchBase.x) > Math.abs(py - stretchBase.y)) py = stretchBase.y; else px = stretchBase.x; } stretchApply(px - stretchBase.x, py - stretchBase.y); return; }
                updateCommandMessage(); draw(); return;
            }
            if (mode === 'fillet' && e.button === 0) {
                const w = screenToWorld(sx, sy), t = findShapeAt(w.x, w.y);
                if (!t || t.type !== 'line') { updateCommandMessageText('ARRONDIR : cliquez une droite (éclatez d\'abord un rectangle ou une polyligne).'); return; }
                if (!filletA) { filletA = { s: t, c: w }; selectedShapes = [t]; }
                else if (!filletB && t !== filletA.s) { filletB = { s: t, c: w }; selectedShapes = [filletA.s, t]; typedInput = ''; }
                updateCommandMessage(); draw(); return;
            }
            if (mode === 'extrude' && e.button === 0) {
                const w = screenToWorld(sx, sy), t = closedAt(w, isClosed2D), ok = t ? extrudeShapes([t]) : [];
                if (!ok.length) { updateCommandMessageText('EXTRUDER : cliquez un rectangle, une polyligne fermée ou un cercle.'); return; }
                saveState(); selectedShapes = ok; draw(); setTimeout(openSelectionParamModal, 30); return;
            }
            if (mode === 'revolve' && e.button === 0) { revolveClick(screenToWorld(sx, sy)); return; }
            if (mode === 'select-box' && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !is3DOpen()) { const oa = openingAt(screenToWorld(sx, sy)); if (oa) { selectedShapes = []; openSel = oa.o; openingDialog(oa.h, oa.o, false); draw(); return; } }
            if (mode === 'stack' && e.button === 0) { stackClick(screenToWorld(sx, sy)); return; }
            if (mode === 'bool' && e.button === 0) { boolClick(screenToWorld(sx, sy)); return; }
            if (mode === 'opstretch' && e.button === 0) { opStretchClick(screenToWorld(sx, sy)); return; }
            if (mode === 'opening' && e.button === 0) { const w = screenToWorld(sx, sy), sn = findSnap(w.x, w.y); openingClick(sn ? { x: sn.x, y: sn.y } : w); return; }
            if (mode === 'tilt' && e.button === 0) { tiltClick(screenToWorld(sx, sy)); return; }
            if (mode === 'elevate' && e.button === 0) { const w = screenToWorld(sx, sy), t = findShapeAt(w.x, w.y) || closedAt(w, x => !!x.solid); if (!t) { updateCommandMessageText('ÉLEVER : cliquez un objet (ou sélectionnez-les avant).'); return; } selectedShapes = [t]; draw(); openElevate(); return; }
            if (mode === 'sweep' && e.button === 0) {
                const w = screenToWorld(sx, sy), t = findShapeAt(w.x, w.y), ok = t && isSweepPath(t) && !t.sweep ? sweepShapes([t]) : [];
                if (!ok.length) { updateCommandMessageText(t && t.sweep ? 'BALAYAGE : ce tracé a déjà un profil — sélectionnez-le et tapez Y pour le régler.' : t && isPlateforme(t) ? 'BALAYAGE : ce contour est une plateforme ; pour la border, tracez le tracé à part (Décaler, par exemple).' : 'BALAYAGE : cliquez une droite, une polyligne, un arc ou un cercle (le tracé).'); return; }
                saveState(); selectedShapes = ok; draw(); setTimeout(openSelectionParamModal, 30); return;
            }
            if (mode === 'sweeppick' && e.button === 0) {
                const w = screenToWorld(sx, sy), t = closedAt(w, x => isClosed2D(x) && x !== sweepPickFor);
                if (!t || !sweepUseProfile(t)) updateCommandMessageText('BALAYAGE : cliquez une forme fermée (polyligne fermée, rectangle, cercle) dessinée en vraie grandeur.');
                return;
            }
            if (mode === 'poteau' && e.button === 0) { poteauClick(screenToWorld(sx, sy)); return; }
            if (mode === 'fond' && e.button === 0) { fondClick(screenToWorld(sx, sy)); return; }
            if (mode === 'stair' && e.button === 0) { stairClick(screenToWorld(sx, sy)); return; }
            if (mode === 'cline2' && e.button === 0) { cl2Click(screenToWorld(sx, sy), e); return; }
            if (mode === 'cut' && e.button === 0) { cutClick(screenToWorld(sx, sy)); return; }
            if (mode === 'pierce' && e.button === 0) {
                const w = screenToWorld(sx, sy), t = !pierceTarget ? (closedAt(w, x => x.solid && ['box', 'cyl'].includes(x.solid.kind)) || pick3DObj(w)) : closedAt(w, x => x !== pierceTarget && isClosed2D(x));
                if (!pierceTarget) {
                    if (!t || !is3DObj(t)) { updateCommandMessageText('PERCER : cliquez d\'abord un volume (pavé, extrusion, cylindre, volume soudé, maillage…).'); return; }
                    pierceTarget = t; selectedShapes = [t]; updateCommandMessage(); draw(); return;
                }
                if (!t || t === pierceTarget || t.solid || t.gen || !((t.type === 'poly' && !t.open && t.points.length >= 3) || t.type === 'circle')) { updateCommandMessageText('PERCER : cliquez la forme fermée (rectangle, polyligne, cercle) à évider dans le volume.'); return; }
                const ring = pierceRing(t);
                if (!(pierceTarget.solid && ['box', 'cyl'].includes(pierceTarget.solid.kind))) {   // volume soudé, maillage, balayage… : on creuse par soustraction (trou de part en part)
                    pierceCSG(ring, t); return;
                }
                const outer = pierceTarget.type === 'circle' ? pierceRing(pierceTarget) : pierceTarget.points;
                if (!ring.every(q => pointInPolygon(q.x, q.y, outer))) { updateCommandMessageText('PERCER : la forme doit être entièrement à l\'intérieur du volume.'); return; }
                pierceTarget.solid.holes = holesOf(pierceTarget).concat([ring]); shapes = shapes.filter(x => x !== t);
                saveState(); draw(); updateCommandMessageText('PERCER : trou ajouté (' + holesOf(pierceTarget).length + ' au total). Cliquez une autre forme à évider, ou Échap.'); return;
            }
            let wp = screenToWorld(sx, sy);

            // --- Cotation angulaire : D1 → D2 → pose arc ---
            if (mode === 'dim-angle') {
                if (dimAngleStep === 0) {
                    let target = findShapeAt(wp.x, wp.y);
                    if (target && target.type === 'line') { dimAngleLine1 = target; dimAngleStep = 1; draw(); }
                } else if (dimAngleStep === 1) {
                    let target = findShapeAt(wp.x, wp.y);
                    if (target && target.type === 'line' && target !== dimAngleLine1) {
                        dimAngleLine2 = target;
                        dimAngleIntersect = getLineIntersectionInfinite(dimAngleLine1, dimAngleLine2);
                        if (!dimAngleIntersect) { dimAngleLine2 = null; return; }
                        dimAngleStep = 2; draw();
                    }
                } else if (dimAngleStep === 2) {
                    const arcR = Math.hypot(wp.x - dimAngleIntersect.x, wp.y - dimAngleIntersect.y);
                    if (arcR < 2) return;
                    const ptOnL1 = _closestPointOnLine(dimAngleLine1, dimAngleIntersect, arcR, wp);
                    const ptOnL2 = _closestPointOnLine(dimAngleLine2, dimAngleIntersect, arcR, wp);
                    shapes.push({ type: 'dim-angle', layerId: DIM_LAYER_ID, vertex: { ...dimAngleIntersect }, p1: ptOnL1, p2: ptOnL2 });
                    dimAngleStep = 0; dimAngleLine1 = null; dimAngleLine2 = null; dimAngleIntersect = null;
                    invalidateCache(); saveState();
                }
                draw(); return;
            }

            if (mode === 'paste') {
                if (clipboard.length > 0 && clipboardBasePoint) {
                    let sn = findSnap(wp.x, wp.y); let px2 = sn ? sn.x : wp.x; let py2 = sn ? sn.y : wp.y;
                    let dx = px2 - clipboardBasePoint.x; let dy = py2 - clipboardBasePoint.y;
                    let newShapes = JSON.parse(JSON.stringify(clipboard));
                    // les copies forment leurs propres groupes (pas rattachées aux originaux)
                    const gmap = {};
                    newShapes.forEach(s => { if (s.groupId) { if (!gmap[s.groupId]) gmap[s.groupId] = 'grp-' + Date.now() + '-' + Math.floor(Math.random()*100000); s.groupId = gmap[s.groupId]; } });
                    selectedShapes = [];
                    newShapes.forEach(s => {
                        xPtsOf(s).forEach(h => h.forEach(p => { p.x += dx; p.y += dy; }));
                        if (s.type === 'line' || s.type === 'slope') { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; }
                        else if (s.type === 'circle' || s.type === 'text' || s.type === 'arc' || s.type === 'basemap' || s.type === 'bgimage' || s.type === 'pdfvec' || s.type === 'mesh' || s.type === 'point') { s.x += dx; s.y += dy; }
                        else if (s.type === 'poly') { s.points.forEach(p => { p.x += dx; p.y += dy; }); }
                        else if (s.type === 'dim') { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; s.ox += dx; s.oy += dy; }
                        else if (s.type === 'dim-angle') { s.vertex.x += dx; s.vertex.y += dy; s.p1.x += dx; s.p1.y += dy; s.p2.x += dx; s.p2.y += dy; }
                        else if (s.type === 'detail') { s.tx += dx; s.ty += dy; s.lx += dx; s.ly += dy; }
                        else if (s.type === 'dimr') translateShape(s, dx, dy);
                        else if (s.type === 'hatch') { s.loops.forEach(l => l.forEach(p => { p.x += dx; p.y += dy; })); }
                        s.layerId = pasteLayerId(s.layerId); shapes.push(s); selectedShapes.push(s);
                    });
                    saveState(); setMode('select-box');
                }
                return;
            }

            if (mode === 'offset') {
                let val = parseFloat(typedInput);
                if (isNaN(val) || val <= 0) return;
                if (!offsetTarget) {
                    let target = findShapeAt(wp.x, wp.y);
                    if (!target || !['line', 'circle', 'arc', 'cline'].includes(target.type)) { const i = cl2LineAt(wp); if (i >= 0) target = shapes.filter(isCL)[i]; }   // un trait de construction posé sur une arête : c'est lui qu'on décale
                    if (target && (target.type === 'line' || target.type === 'circle' || target.type === 'arc' || target.type === 'cline' || (target.type === 'poly' && !target.solid && !target.trench))) { offsetTarget = target; draw(); }
                } else if (offsetPreviewShape) {
                    shapes.push(offsetPreviewShape); saveState(); offsetTarget = null; offsetPreviewShape = null; draw();
                }
                return;
            }

            if (mode === 'trim') { trimShapeAt(wp.x, wp.y); draw(); return; }
            if (mode === 'extend') { extendShapeAt(wp.x, wp.y); draw(); return; }

            if (mode === 'hatch') {
                // 1) clic dans une hachure existante : on la retire
                for (let i = shapes.length - 1; i >= 0; i--) {
                    const s = shapes[i]; if (s.type !== 'hatch') continue;
                    const lay = layers.find(l => l.id === (s.layerId || 'layer-0')); if (lay && !lay.visible) continue;
                    if (pointInHatch(s, wp.x, wp.y)) { shapes.splice(i, 1); selectedShapes = selectedShapes.filter(x => x !== s); saveState(); draw(); updateCommandMessageText("Hachure retirée."); return; }
                }
                // anciennes hachures attachées à un rectangle ou un cercle : on les retire aussi
                for (let i = shapes.length - 1; i >= 0; i--) {
                    const s = shapes[i]; if (!s.hatch) continue;
                    const lay = layers.find(l => l.id === (s.layerId || 'layer-0')); if (lay && !lay.visible) continue;
                    const inside = (s.type === 'poly' && pointInPolygon(wp.x, wp.y, s.points)) || (s.type === 'circle' && Math.hypot(wp.x - s.x, wp.y - s.y) <= s.r);
                    if (inside) { s.hatch = false; invalidateCache(); saveState(); draw(); updateCommandMessageText("Hachure retirée."); return; }
                }
                // 2) détection de la zone fermée autour du clic
                const region = findClosedRegion(wp.x, wp.y);
                if (!region) { updateCommandMessageText("HACHURES : aucune zone fermée trouvée ici (contour ouvert ou trop d'écart entre les traits)."); return; }
                const h = { type: 'hatch', layerId: activeLayerId, loops: region.loops };
                shapes.unshift(h);   // dessinée sous les traits
                saveState(); draw();
                const surf = fmtSurface(hatchArea(h) * Math.pow(unitsPerSquare / GRID_SIZE, 2));
                updateCommandMessageText("Zone hachurée : " + surf + (region.loops.length > 1 ? " (" + (region.loops.length - 1) + " îlot(s) exclu(s))" : "") + ".");
                return;
            }

            if (mode === 'select-box' && e.button === 0 && gripDrag) { endGrip(false); return; }
            if (mode === 'select-box' && e.button === 0 && !isDrawing) { const bb = bldBadgeAt(sx, sy); if (bb) { bldOpen(bb.id); return; } }   // pastille d'un contour de bâtiment : ses étages
            if (mode === 'select-box' && e.button === 0 && !e.shiftKey && !isDrawing) { const g = gripAt(sx, sy); if (g) { startGrip(g); gripDrag.downAt = Date.now(); draw(); return; } }
            if (mode === 'select-box' && !isDrawing && e.button === 0 && !e.shiftKey) { const hv = trLabelAt(wp) || trVertexAt(wp); if (hv) { trVertexDialog(hv.s, hv.i); return; } }
            if (mode === 'select-box') { t2SelDown(wp, e); return; }

            if (mode === 'move') {
                if (selectedShapes.length === 0) { let target = findShapeAt(wp.x, wp.y); if (target) { selectedShapes = expandGroups([target]); draw(); } else return; }
                if (!moveBasePoint) { let sn = findSnap(wp.x, wp.y); moveBasePoint = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y}; isMovingObjects = true; }
                else {
                    let sn = findSnap(wp.x, wp.y), dest = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y}, ddx = dest.x-moveBasePoint.x, ddy = dest.y-moveBasePoint.y;
                    selectedShapes.forEach(s => translateShape(s, ddx, ddy)); moveTypedX = null; typedInput = "";
                    isMovingObjects = false; moveBasePoint = null; saveState(); draw();
                }
                return;
            }

            if (mode === 'rotate') {
                if (selectedShapes.length === 0) { let target = findShapeAt(wp.x, wp.y); if (target) { selectedShapes = expandGroups([target]); draw(); } else return; }
                let sn = findSnap(wp.x, wp.y); let pt = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y};
                if (!rotateCenter) { rotateCenter = pt; rotateStartAngle = Math.atan2(wp.y - rotateCenter.y, wp.x - rotateCenter.x); isRotatingObjects = true; typedInput = ""; }
                else {
                    let curA = Math.atan2(wp.y - rotateCenter.y, wp.x - rotateCenter.x), diff = curA - rotateStartAngle;
                    if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) diff = parseFloat(typedInput) * Math.PI / 180;
                    selectedShapes.forEach(s => applyRotationToShape(s, rotateCenter.x, rotateCenter.y, diff));
                    isRotatingObjects = false; rotateCenter = null; typedInput = ""; saveState(); draw();
                }
                return;
            }

            if (isScaleMode()) {
                if (selectedShapes.length === 0) { let target = findShapeAt(wp.x, wp.y); if (target) { selectedShapes = expandGroups([target]); draw(); } else return; }
                let sn = findSnap(wp.x, wp.y); let pt = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y};
                if (!scaleCenter) {
                    scaleCenter = pt;
                    scaleRefDist = Math.hypot(wp.x - scaleCenter.x, wp.y - scaleCenter.y);
                    isScalingObjects = true; typedInput = "";
                } else {
                    let d2 = Math.hypot(wp.x - scaleCenter.x, wp.y - scaleCenter.y);
                    let f = (scaleRefDist > 0.0001) ? d2 / scaleRefDist : 1;
                    if (f > 0.0001) selectedShapes.forEach(s => applyScaleToShape(s, scaleCenter.x, scaleCenter.y, f));
                    isScalingObjects = false; scaleCenter = null; scaleRefDist = 0; typedInput = ""; saveState(); draw();
                }
                return;
            }

            if (mode === 'cubpick') {
                const e2 = pickEmpriseAt(wp.x, wp.y);
                if (!e2) { updateCommandMessageText("CUBATURES : cliquez à l'intérieur d'une polyligne fermée, d'une hachure ou d'un cercle."); draw(); return; }
                cubMakePlatform(e2); return;
            }
            if (mode === 'profile') {
                const sn = findSnap(wp.x, wp.y), pt = sn ? { x: sn.x, y: sn.y } : { x: wp.x, y: wp.y };
                profileAxis.push(pt); isDrawing = true; draw(); return;
            }
            if (mode === 'slope') {
                const sn = findSnap(wp.x, wp.y), pt = sn ? { x: sn.x, y: sn.y } : { x: wp.x, y: wp.y };
                if (!slopeP1) { if (!hasZ(zHere(pt.x, pt.y))) { updateCommandMessageText("PENTE : pas d'altitude ici (ni point coté, ni surface du terrain)."); draw(); return; } slopeP1 = pt; isDrawing = true; draw(); return; }
                const s0 = makeSlope(slopeP1, pt);
                if (!s0) { updateCommandMessageText("PENTE : pas d'altitude au 2e point (ni point coté, ni surface du terrain)."); draw(); return; }
                shapes.push(s0); saveState(); slopeP1 = null; isDrawing = false;
                updateCommandMessageText('PENTE : ' + slopePct(s0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' % (Δz ' + fmtZ(s0.z2 - s0.z1) + ' m). Cliquez une nouvelle pente ou Échap.');
                draw(); return;
            }
            if (mode === 'topo') {
                const sn = findSnap(wp.x, wp.y), pt = sn ? { x: sn.x, y: sn.y } : { x: wp.x, y: wp.y };
                const zs = sn ? zAt(pt.x, pt.y, 0.5) : [];
                const s0 = { type: 'point', layerId: activeLayerId, x: pt.x, y: pt.y, zk: 1 };
                if (zs.length) s0.z = zs[0]; else if (hasZ(zCourant)) s0.z = zCourant;
                shapes.push(s0); lastTopo = s0; typedInput = ''; saveState(); draw(); return;
            }
            if (mode === 'gridcal') {
                if (!gcal) gcal = { s: null, P: [], crs: (detectCRS() || {}).code || (bmSettings.crs && bmSettings.crs !== 'auto' ? bmSettings.crs : 'CC44') };
                if (!gcal.s) { const t = findShapeAt(wp.x, wp.y); if (t && t.type === 'bgimage') { gcal.s = t; selectedShapes = [t]; if (t.pdfGrid && t.pdfGrid.crs) gcal.crs = t.pdfGrid.crs; updateCommandMessage(); } draw(); return; }
                const sn = gcalSnap(gcal.s, wp.x, wp.y) || findSnap(wp.x, wp.y), pt = sn ? { x: sn.x, y: sn.y } : { x: wp.x, y: wp.y }; gcalAsk(pt); draw(); return;
            }
            if (mode === 'calibrate') {
                if (!calTarget) { const t = findShapeAt(wp.x, wp.y); if (t && t.type === 'bgimage') { calTarget = t; selectedShapes = [t]; } draw(); return; }
                const sn = findSnap(wp.x, wp.y), pt = sn ? { x: sn.x, y: sn.y } : { x: wp.x, y: wp.y };
                if (!calP1) { calP1 = pt; isDrawing = true; }
                else if (!calP2) { calP2 = pt; typedInput = ''; }
                draw(); return;
            }
            if (isDimMode()) {
                let sn = findSnap(wp.x, wp.y), pt = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y};
                if (dimStep === 0) { dimP1 = pt; dimStep = 1; isDrawing = true; typedInput = ""; draw(); }
                else if (dimStep === 1) {
                    // Cote libre + Ortho (F8 / Maj) : 2e point contraint à H ou V par rapport au 1er.
                    if (mode === 'dim' && (orthoMode || e.shiftKey)) {
                        if (Math.abs(pt.x - dimP1.x) > Math.abs(pt.y - dimP1.y)) pt.y = dimP1.y;
                        else pt.x = dimP1.x;
                    }
                    dimP2 = pt; dimStep = 2; draw();
                }
                else if (dimStep === 2) {
                    const p3 = { x: wp.x, y: wp.y };
                    const d = makeDim(dimP1, dimP2, p3, mode === 'dim-ortho' ? orthoOrient(dimP1, dimP2, p3) : null);
                    shapes.push(d); saveState();
                    if (dimChain === 'single') { dimStep = 0; isDrawing = false; } else startDimChain(d);
                    draw();
                }
                else if (dimStep === 3) {
                    const d = nextChainDim(pt);
                    if (d) { shapes.push(d); dimChainInfo.count++; dimChainInfo.last = pt; saveState(); }
                    draw();
                }
                return;
            }

            if (mode === 'text') { startInlineEdit({ kind:'text', wx: wp.x, wy: wp.y }); return; }

            if (mode === 'detail') {
                let sn = findSnap(wp.x, wp.y), pt = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y};
                if (detailStep === 0) {
                    detailTarget = pt; detailStep = 1; isDrawing = true; draw();
                } else {
                    detailLabelPos = {x: wp.x, y: wp.y};
                    detailStep = 2;
                    startInlineEdit({ kind:'detail', wx: wp.x, wy: wp.y, detailTarget: detailTarget });
                }
                return;
            }

            if (mode === 'arc') {
                let sn = findSnap(wp.x, wp.y), pt = sn ? {x:sn.x, y:sn.y} : {x:wp.x, y:wp.y};
                if (arcStep === 0) { arcCenter = pt; arcStep = 1; isDrawing = true; typedInput = ""; }
                else if (arcStep === 1) {
                    arcP1 = pt; arcRadius = Math.hypot(arcP1.x - arcCenter.x, arcP1.y - arcCenter.y);
                    if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) arcRadius = (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE;
                    arcStartAngle = Math.atan2(arcP1.y - arcCenter.y, arcP1.x - arcCenter.x); arcStep = 2; typedInput = ""; arcLastA = null; arcAcc = 0;
                }
                else if (arcStep === 2) {
                    let endAngle = Math.atan2(pt.y - arcCenter.y, pt.x - arcCenter.x);
                    let acw = false;
                    if (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) {
                        const deg = parseFloat(typedInput);
                        endAngle = arcStartAngle + deg*Math.PI/180;
                        acw = deg < 0; // angle négatif = sens anti-horaire
                    } else {
                        // Sens déterminé par le geste : on prend le plus court chemin
                        // vers le point cliqué, dans le sens correspondant.
                        const acc = arcTrack(pt.x, pt.y); endAngle = arcStartAngle + acc;
                        acw = acc < 0; // le sens suit la rotation du curseur autour du centre
                    }
                    if (arcRadius > 0.1) shapes.push({ type: 'arc', layerId: activeLayerId, x: arcCenter.x, y: arcCenter.y, r: arcRadius, startAngle: arcStartAngle, endAngle: endAngle, anticlockwise: acw, color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1 });
                    arcStep = 0; isDrawing = false; typedInput = ""; saveState(); draw();
                }
                draw();
                return;
            }

            if (isPolyMode()) {
                let sn = findSnap(wp.x, wp.y), px2 = sn ? sn.x : wp.x, py2 = sn ? sn.y : wp.y;
                if (!sn && isDrawing && currentPolygon.length && !(orthoMode || e.shiftKey)) { const q = t2PolarAt(currentPolygon[currentPolygon.length - 1], px2, py2); if (q) { px2 = q.x; py2 = q.y; } }
                if (!isDrawing && mode === 'pline' && batDraw && batPick(wp.x, wp.y, sn)) { draw(); return; }
                if (!isDrawing) { currentPolygon = [{x:px2, y:py2}]; isDrawing = true; typedInput = ""; }
                else {
                    let f = currentPolygon[0], lp = currentPolygon[currentPolygon.length-1], fx = px2, fy = py2;
                    if (orthoMode || e.shiftKey) { if (Math.abs(px2-lp.x) > Math.abs(py2-lp.y)) fy = lp.y; else fx = lp.x; }
                    if (!(mode === 'pline' && trenchDraw) && Math.hypot(fx-f.x, fy-f.y) < (SNAP_DIST_PX/camera.zoom) && currentPolygon.length > 2 && typedInput.length === 0) {
                        if (batDraw && mode === 'pline') { finishPline(); return; }
                        if (waterDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); waterCreate(WP); return; }
                        if (boisDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); boisCreate(WP); return; }
                        if (bassinDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); bassinCreate(WP); return; } if (mailDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); mailCreate(WP); return; } if (mailZoneDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; mailZoneCreate(WP); return; }
                        if (brushPolyDraw && brushTool) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; brushPolyCreate(WP); return; }
                        shapes.push({ type: 'poly', layerId: activeLayerId, points: cleanPolyPts(currentPolygon, true), color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false });
                        isDrawing = false; currentPolygon = []; typedInput = ""; saveState();
                    } else { currentPolygon.push({x: fx, y: fy}); typedInput = "";
                    }
                }
                draw(); return;
            }

            // Ligne / Cercle (mode générique)
            if (!isDrawing) {
                let sn = findSnap(wp.x, wp.y); startX = sn ? sn.x : wp.x; startY = sn ? sn.y : wp.y; isDrawing = true; typedInput = ""; rectDimStep = 0; rectWidthVal = 0;
                draw();
            } else {
                let sn = findSnap(wp.x, wp.y); currentX = sn ? sn.x : wp.x; currentY = sn ? sn.y : wp.y;
                if (!sn && mode === 'line' && !(orthoMode || e.shiftKey)) { const q = t2PolarAt({ x: startX, y: startY }, currentX, currentY); if (q) { currentX = q.x; currentY = q.y; } }
                let fx = currentX, fy = currentY, fr = Math.hypot(currentX-startX, currentY-startY);
                if ((orthoMode || e.shiftKey) && mode === 'line') { if (Math.abs(currentX-startX) > Math.abs(currentY-startY)) fy = startY; else fx = startX; }
                if (typedInput.length > 0 && !isNaN(parseFloat(typedInput)) && mode !== 'rect') { let d = (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE; let a = Math.atan2(fy-startY, fx-startX); fx = startX+Math.cos(a)*d; fy = startY+Math.sin(a)*d; fr = d; }
                if (Math.abs(fx-startX) > 0.1 || Math.abs(fy-startY) > 0.1 || fr > 0.1) {
                    if (mode === 'line') shapes.push({ type: 'line', layerId: activeLayerId, x1: startX, y1: startY, x2: fx, y2: fy, color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1 });
                    else if (mode === 'rect') {
                        // Rectangle = polyligne fermée à 4 points (hérite sélection, déplacement, hachure, etc.)
                        shapes.push({ type: 'poly', layerId: activeLayerId, points: [
                            { x: startX, y: startY }, { x: fx, y: startY }, { x: fx, y: fy }, { x: startX, y: fy }
                        ], color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false });
                    }
                    else if (mode === 'circle') shapes.push({ type: 'circle', layerId: activeLayerId, x: startX, y: startY, r: fr, color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false });
                }
                isDrawing = false; typedInput = ""; rectDimStep = 0; rectWidthVal = 0; saveState(); draw();
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const r = canvas.getBoundingClientRect(); let sx = e.clientX-r.left, sy = e.clientY-r.top;
            currentX_screen = sx; currentY_screen = sy;
            if (brush2D() && !isPanning) { const H = brush2DHit(sx, sy); if (brushTool.down) brushMove({ H }); else { brush2DAt = H.q; draw(); } return; }
            if (isPanning) { if (layoutOn && !lpActiveId) { lpCam.x += (sx-lastPanX); lpCam.y += (sy-lastPanY); } else { navBegin(); camera.x += (sx-lastPanX); camera.y += (sy-lastPanY); } lastPanX = sx; lastPanY = sy; if (layoutOn) draw(); else navDraw(); return; }
            if (layoutOn && lp3D.drag) { lp3DMove(sx, sy); return; }
            if (layoutOn && lpDrag) { lpMouseMoveDrag(sx, sy); draw(); return; }
            if (layoutOn && lpHover(sx, sy) === true) draw();
            let wp = screenToWorld(sx, sy);
            if (batDraw) batHover(wp.x, wp.y);
            shiftHeld = e.shiftKey;
            currentSnap = t2SnapUsed() ? findSnap(wp.x, wp.y) : null;
            updateTrackHover(currentSnap);
            // altitude sous le curseur : au point accroché, sinon sur un trait 3D survolé (4 px)
            currentZs = currentSnap ? zAt(currentSnap.x, currentSnap.y, 0.5) : [];
            if (!currentZs.length) currentZs = zAt(wp.x, wp.y, 4 / camera.zoom);
            currentX = currentSnap ? currentSnap.x : wp.x;
            currentY = currentSnap ? currentSnap.y : wp.y;
            // Position réelle du pointeur (NON contrainte) pour le guide d'alignement
            rawMouseX = currentX; rawMouseY = currentY;
            if (mode === 'pen' && penDrag) penMove(wp.x, wp.y);
            if (gripDrag) { gripApply(currentX, currentY, e.shiftKey); draw(); return; }
            if (mode === 'select-box' && !isDrawing && selectedShapes.length) { const gh = gripAt(sx, sy); if (gh !== gripHover && !(gh && gripHover && gh.s === gripHover.s && gh.kind === gripHover.kind && gh.i === gripHover.i)) { gripHover = gh; } canvas.style.cursor = gh ? 'move' : 'default'; } else gripHover = null;
            // Contrainte orthogonale : mode Ortho permanent OU touche Shift maintenue.
            if (isDrawing && (orthoMode || e.shiftKey)) {
                if (mode === 'line') { if (Math.abs(currentX-startX) > Math.abs(currentY-startY)) currentY = startY; else currentX = startX; }
                else if (isPolyMode() && currentPolygon.length > 0) { let lp = currentPolygon[currentPolygon.length-1]; if (Math.abs(currentX-lp.x) > Math.abs(currentY-lp.y)) currentY = lp.y; else currentX = lp.x; }
            }

            t2MouseMove(e); t2SelMove(e);
            if (mode === 'offset' && offsetTarget && typedInput.length > 0) {
                let val = parseFloat(typedInput);
                if (!isNaN(val) && val > 0) {
                    let D = (val / unitsPerSquare) * GRID_SIZE;
                    let newShape = JSON.parse(JSON.stringify(offsetTarget)); if (offsetTarget.type !== 'cline') newShape.layerId = activeLayerId;
                    if (offsetTarget.type === 'cline') { const nx = -offsetTarget.uy, ny = offsetTarget.ux, sign = ((currentX - offsetTarget.x) * nx + (currentY - offsetTarget.y) * ny) >= 0 ? 1 : -1; newShape.x += nx * sign * D; newShape.y += ny * sign * D; offsetPreviewShape = newShape; }
                    else if (offsetTarget.type === 'line') {
                        let ddx = offsetTarget.x2 - offsetTarget.x1, ddy = offsetTarget.y2 - offsetTarget.y1, len = Math.hypot(ddx, ddy);
                        if (len > 0) {
                            let nx = -ddy / len, ny = ddx / len, dot = (currentX - offsetTarget.x1) * nx + (currentY - offsetTarget.y1) * ny, sign = dot >= 0 ? 1 : -1;
                            newShape.x1 += nx * sign * D; newShape.y1 += ny * sign * D; newShape.x2 += nx * sign * D; newShape.y2 += ny * sign * D;
                            offsetPreviewShape = newShape;
                        }
                    } else if (offsetTarget.type === 'poly' && offsetTarget.points && offsetTarget.points.length >= 2) {   // polyligne : fermée = agrandie / réduite dans toutes les directions ; ouverte = du côté de la souris
                        const P = offsetTarget.points, closed = !offsetTarget.open; let sign;
                        if (closed) sign = pointInPolygon(currentX, currentY, P) ? -1 : 1;
                        else { let bi = 0, bd = Infinity; for (let i = 0; i < P.length - 1; i++) { const dd = t2SegDist({ x: currentX, y: currentY }, P[i], P[i + 1]); if (dd < bd) { bd = dd; bi = i; } } const a = P[bi], b = P[bi + 1]; sign = ((b.x - a.x) * (currentY - a.y) - (b.y - a.y) * (currentX - a.x)) >= 0 ? 1 : -1; }
                        newShape.points = polyOffsetPts(P, D * sign, closed); ['plat', 'talus', 'struct', 'pfName', 'trench', 'water', 'solid'].forEach(k => delete newShape[k]); delete newShape.groupId;
                        offsetPreviewShape = newShape;
                    } else if (offsetTarget.type === 'circle' || offsetTarget.type === 'arc') {
                        let distToCenter = Math.hypot(currentX - offsetTarget.x, currentY - offsetTarget.y), sign = distToCenter >= offsetTarget.r ? 1 : -1;
                        newShape.r += sign * D; if (newShape.r > 0) offsetPreviewShape = newShape; else offsetPreviewShape = null;
                    }
                }
            } else { offsetPreviewShape = null; }

            if (NAV.snap && !isDrawing) return;   /* vue en mouvement (molette) : le plan net revient à l'arrêt */
            draw();
        });

        canvas.addEventListener('mouseup', (e) => {
            if (brush2D() && e.button === 0) { brushTool.down = false; brushUp(); return; }
            if (layoutOn && lp3D.drag) { lp3DUp(); return; }
            if (layoutOn && lpDrag) { lpDrag = null; draw(); return; }
            if (mode === 'pen' && e.button === 0) penUp();
            if (gripDrag && e.button === 0) { const moved = Math.hypot(currentX - gripDrag.x0, currentY - gripDrag.y0) * camera.zoom > 3; if (moved) endGrip(false); return; }
            if (e.button === 1) { isPanning = false; if (NAV.snap) draw(); canvas.style.cursor = mode === 'select-box' ? 'default' : 'crosshair'; }
            if (mode === 'select-box' && isDrawing && t2SelUp(e)) {
                moveTypedX = null; typedInput = "";
                let dist = Math.hypot(currentX - startX, currentY - startY);
                if (dist < 5 / camera.zoom) {
                    let clickedShape = findShapeAt(startX, startY);
                    if (clickedShape) { const grp = expandGroups([clickedShape]); if (selectedShapes.includes(clickedShape)) selectedShapes = selectedShapes.filter(s => !grp.includes(s)); else grp.forEach(g => { if (!selectedShapes.includes(g)) selectedShapes.push(g); }); }
                } else if (currentX < startX) {   // capture (de droite à gauche) : tout ce que la fenêtre touche
                    const R = { x0: Math.min(startX, currentX), x1: Math.max(startX, currentX), y0: Math.min(startY, currentY), y1: Math.max(startY, currentY) };
                    shapes.forEach(s => { const layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (!layer?.visible) return; if (shapeTouchesRect(s, R) && !selectedShapes.includes(s)) selectedShapes.push(s); });
                    selectedShapes = expandGroups(selectedShapes);
                } else {
                    shapes.forEach(s => {
                        let layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (!layer?.visible) return;
                        let b = false;
                        if (s.type === 'line' || s.type === 'dim' || s.type === 'slope') b = isPointInRect(s.x1, s.y1, startX, startY, currentX-startX, currentY-startY) && isPointInRect(s.x2, s.y2, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'circle' || s.type === 'text' || s.type === 'arc') b = isPointInRect(s.x, s.y, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'poly') b = s.points.every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY));
                        else if (s.type === 'dim-angle') b = isPointInRect(s.vertex.x, s.vertex.y, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'dimr') b = isPointInRect(s.x, s.y, startX, startY, currentX-startX, currentY-startY) && isPointInRect(s.lx, s.ly, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'point') b = isPointInRect(s.x, s.y, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'bgimage') b = bgCorners(s).every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY));
                        else if (s.type === 'pdfvec') b = vecCorners(s).every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY));
                        else if (s.type === 'mesh') b = meshCorners(s).every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY));
                        else if (s.type === 'basemap') b = isPointInRect(s.x - s.r, s.y - s.r, startX, startY, currentX-startX, currentY-startY) && isPointInRect(s.x + s.r, s.y + s.r, startX, startY, currentX-startX, currentY-startY);
                        else if (s.type === 'hatch') b = s.loops[0].every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY));
                        else { const K = t2KeyPts(s); b = K.length > 0 && K.every(p => isPointInRect(p.x, p.y, startX, startY, currentX-startX, currentY-startY)); }   // infobulles, étiquettes… : tous leurs points dans la fenêtre
                        if (b && !selectedShapes.includes(s)) selectedShapes.push(s);
                    });
                    selectedShapes = expandGroups(selectedShapes);
                }
                isDrawing = false; draw(); try { updateCommandMessage(); } catch (e) {}
            }
        });

        // Validation d'une saisie clavier (distance/angle).
        // returnToSelect=true (Entrée) : valide puis revient à l'outil Sélection.
        // returnToSelect=false (Espace) : valide en gardant l'outil actif pour enchaîner.
        // direction d'une longueur tapée depuis le point lp : la souris réelle, contrainte par Ortho / Maj (axe le plus proche) ou par le suivi polaire
        function typedDirFrom(lp) {
            const w = screenToWorld(currentX_screen, currentY_screen), dx = w.x - lp.x, dy = w.y - lp.y;
            if (orthoMode || shiftHeld) return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : Math.PI) : (dy >= 0 ? Math.PI / 2 : -Math.PI / 2);
            const q = t2PolarAt(lp, w.x, w.y); if (q) return Math.atan2(q.y - lp.y, q.x - lp.x);
            return Math.atan2(dy, dx);
        }
        function validateTypedInput(returnToSelect) {
            const val = parseFloat(typedInput);
            if (isNaN(val)) return;
            const col = document.getElementById('prop-color').value;
            const dsh = document.getElementById('prop-dash').value;
            const wdt = parseFloat(document.getElementById('prop-width').value) || 1;

            // ----- Rectangle par dimensions : ⬌ largeur [Espace] puis ⬍ hauteur [Entrée] -----
            if (mode === 'rect' && isDrawing) {
                const d = (val/unitsPerSquare)*GRID_SIZE;
                if (rectDimStep === 0) {
                    // 1ère valeur = largeur, on passe à la hauteur (ne crée pas encore)
                    rectWidthVal = d; rectDimStep = 1; typedInput = "";
                    updateCommandMessage(); draw(); return;
                } else {
                    // 2e valeur = hauteur -> on crée le rectangle.
                    // Sens : selon la position de la souris par rapport au 1er coin.
                    const sx = (currentX >= startX) ? 1 : -1;
                    const sy = (currentY >= startY) ? 1 : -1;
                    const x2 = startX + sx * rectWidthVal;
                    const y2 = startY + sy * d;
                    shapes.push({ type:'poly', layerId:activeLayerId, points:[
                        {x:startX, y:startY}, {x:x2, y:startY}, {x:x2, y:y2}, {x:startX, y:y2}
                    ], color:col, dash:dsh, width:wdt, hatch:false });
                    isDrawing = false; rectDimStep = 0; rectWidthVal = 0; typedInput = "";
                    saveState();
                    if (returnToSelect) setMode('select-box');
                    draw(); return;
                }
            }

            if (mode === 'rotate' && rotateCenter) {
                let rad = -val * Math.PI / 180;   // angle tapé en sens trigonométrique (Y du plan vers le haut, Y écran vers le bas)
                selectedShapes.forEach(s => applyRotationToShape(s, rotateCenter.x, rotateCenter.y, rad));
                isRotatingObjects = false; rotateCenter = null; typedInput = ""; saveState();
                if (returnToSelect) setMode('select-box');
                draw(); return;
            }
            if (mode === 'arc') {
                if (arcStep === 1 && val > 0) {
                    let d = (val/unitsPerSquare)*GRID_SIZE; arcRadius = d;
                    let a = Math.atan2(currentY-arcCenter.y, currentX-arcCenter.x);
                    arcP1 = {x: arcCenter.x + Math.cos(a)*d, y: arcCenter.y + Math.sin(a)*d};
                    arcStartAngle = a; arcStep = 2; typedInput = ""; arcLastA = null; arcAcc = 0; draw(); return;
                } else if (arcStep === 2) {
                    let endAngle = arcStartAngle + val*Math.PI/180;
                    shapes.push({ type:'arc', layerId:activeLayerId, x:arcCenter.x, y:arcCenter.y, r:arcRadius, startAngle:arcStartAngle, endAngle:endAngle, anticlockwise: val < 0, color:col, dash:dsh, width:wdt });
                    arcStep = 0; isDrawing = false; typedInput = ""; saveState();
                    if (returnToSelect) setMode('select-box');
                    draw(); return;
                }
            }
            if (val > 0 && mode !== 'offset') {
                let d = (val/unitsPerSquare)*GRID_SIZE;
                if (mode === 'circle') { shapes.push({ type:'circle', layerId:activeLayerId, x:startX, y:startY, r:d, color:col, dash:dsh, width:wdt, hatch:false }); isDrawing = false; }
                else if (mode === 'line') { let a = typedDirFrom({ x: startX, y: startY }); shapes.push({ type:'line', layerId:activeLayerId, x1:startX, y1:startY, x2:startX+Math.cos(a)*d, y2:startY+Math.sin(a)*d, color:col, dash:dsh, width:wdt }); isDrawing = false; }
                else if (isPolyMode()) { let lp = currentPolygon[currentPolygon.length-1], a = typedDirFrom(lp); currentPolygon.push({x: lp.x+Math.cos(a)*d, y: lp.y+Math.sin(a)*d}); }
            }
            if (mode !== 'offset') {
                typedInput = "";
                if (!isPolyMode()) { saveState(); if (returnToSelect) setMode('select-box'); }
                draw();
            }
        }

        // tout sélectionner : les objets des calques affichés (pas les fonds de plan), ou seulement ceux du calque actif
        function selectAllShapes(layerOnly) { if (!['select-box'].includes(mode)) setMode('select-box');
            const vis = (s) => { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); return !l || l.visible !== false; };
            selectedShapes = shapes.filter(s => !isBg(s) && !s.gen && vis(s) && (!layerOnly || (s.layerId || 'layer-0') === activeLayerId) && !(typeof lvlOn !== 'undefined' && lvlOn && typeof lvlOff2D === 'function' && lvlOff2D(s)));
            const ln = (layers.find(l => l.id === activeLayerId) || {}).name || '';
            updateCommandMessageText(selectedShapes.length ? 'TOUT SÉLECTIONNÉ : ' + selectedShapes.length + ' objet(s)' + (layerOnly ? ' du calque « ' + ln + ' »' : ' (calques affichés, sans les fonds de plan)') + '. Échap pour désélectionner.' : (layerOnly ? 'Aucun objet sur le calque « ' + ln + ' ».' : 'Aucun objet à sélectionner.'));
            try { updatePropertiesPopup(); } catch (e) {} draw(); }
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyA' || e.key.toLowerCase() === 'a') && !e.shiftKey && !is3DOpen()) {   // Ctrl+A : tout le dessin ; Ctrl+Alt+A : tout le calque actif
                const ae = document.activeElement, typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
                const modal = ['topo-modal', 'bgimg-modal', 'basemap-modal', 'crop-modal', 'help-modal', 'selparam-modal', 'layer-modal'].some(id => { const m = document.getElementById(id); return m && !m.classList.contains('hidden') && m.style.display !== 'none' && m.offsetParent !== null; });
                if (!typing && !modal) { e.preventDefault(); selectAllShapes(e.altKey); return; }
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                const k = e.key.toLowerCase();
                if (k === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
                if (k === 'o') { e.preventDefault(); openProject(); return; }
            }
            if (is3DOpen()) { if (d3Key(e)) return; if (brushTool && brushCur && brushCur.brush.poly && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); if (e.key === 'Enter') brushPolyEnd(); else brushPolyCancel(); return; }
                if (e.key === 'Escape') { if (V3 && V3.pinPick) { V3.pinPick = false; render3D(); updateCommandMessageText('VUE 3D : pose du point d\'ancrage annulée.'); return; } if (brushTool) brushStop(); else if (texPaint) texStop(); else close3D(); return; }
                if ((e.key === 'y' || e.key === 'Y') && !e.ctrlKey && !brushTool) { e.preventDefault(); v3ParamSel(); return; }
                if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; } if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; } return; }
            if (document.getElementById('topo-modal').style.display === 'flex') { if (e.key === 'Escape') { closeTopoModal(); return; } if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#topo-modal')) return; }   // volet non bloquant : le clavier reste au dessin si le focus n'est pas dans le volet
            if (document.getElementById('basemap-modal').style.display === 'flex') { if (e.key === 'Escape') closeBasemapModal(); return; }
            if (document.getElementById('crop-modal').style.display === 'flex') { if (e.key === 'Escape') closeCrop(); if (e.key === 'Enter') applyCrop(); return; }
            // un champ resté actif dans une fenêtre fermée (invisible) ne doit pas capter le clavier du dessin
            if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') && document.activeElement.offsetParent === null && document.activeElement.type !== 'hidden') document.activeElement.blur();
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                if (e.key === 'Enter') {
                    if (document.activeElement.id === 'text-content') applyText();
                    if (document.activeElement.id === 'new-layer-name') addLayer();
                    if (document.activeElement.closest && document.activeElement.closest('#selparam-modal')) { e.preventDefault(); applySelectionLayer(); return; }
                    // Détail : Entrée valide (Maj+Entrée = saut de ligne)
                    if (document.activeElement.id === 'detail-content' && !e.shiftKey) { e.preventDefault(); applyDetail(); }
                }
                if (e.key === 'Escape') { if (!document.getElementById('selparam-modal').classList.contains('hidden')) spCancel(); closeTextModal(); closeDetailModal(); closeCartoucheModal(); closeLayerModal(); closeSnapModal(); closeHelpModal(); }
                return;
            }
            if (e.key === 'F8') { e.preventDefault(); toggleOrtho(); return; }
            if (t2KeyDown(e)) return;
            // Raccourcis de commande : lettres tapées puis Entrée (D = déplacer, DR = droite, HA = hachure…)
            if (!e.ctrlKey && !e.altKey && !e.metaKey && mode !== 'print' && mode !== 'preview') {
                const k = e.key.length === 1 ? e.key.toUpperCase() : '';
                const yn = mode === 'select-box' && selectedShapes.length > 0 && !cmdBuffer && (k === 'Y' || k === 'N');   // Paramétrer la sélection [Y/N]
                if (/^[A-Z]$/.test(k) && !yn && !(isScaleMode() && k === 'X') && cmdBuffer.length < 3) { e.preventDefault(); cmdBuffer += k; draw(); return; }
                if (cmdBuffer) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runCmdAlias(); return; }
                }
                // Espace en sélection (rien de tapé, rien en cours) : reprendre le dernier outil utilisé
                if (!cmdBuffer && e.key === ' ' && mode === 'select-box' && !isDrawing && !typedInput && lastTool) { e.preventDefault(); relaunchLastTool(); return; }
                if (cmdBuffer) {
                    if (e.key === 'Backspace') { e.preventDefault(); cmdBuffer = cmdBuffer.slice(0, -1); draw(); return; }
                    if (e.key === 'Escape') { e.preventDefault(); cmdBuffer = ''; draw(); return; }
                }
            }
            // Route : écartement des profils tapé avant le premier clic, validé par Espace ou Entrée
            if (mode === 'pline' && rdDraw && !isDrawing && !e.ctrlKey) { if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessageText('ROUTE : écartement des profils ' + typedInput + ' m — Espace pour valider.'); draw(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return; } if ((e.key === ' ' || e.key === 'Enter') && typedInput) { e.preventDefault(); rdStepTyped(typedInput); return; } }
            // Polyligne / Plume : Entrée, Espace (sans saisie) ou Échap = terminer ; Miroir : Entrée / Suppr / Échap
            if (mode === 'pline' && isDrawing && !typedInput && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); const trq = trenchDraw && e.key === 'Enter'; finishPline(); if (trq) setMode('select-box'); return; }
            if (mode === 'pline' && trenchDraw && !isDrawing && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); setMode('select-box'); return; }
            if (mode === 'pen' && penPts.length && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); finishPen(false); return; }
            if (mode === 'pen' && penPts.length && e.key === 'Backspace') { e.preventDefault(); penPts.pop(); updateCommandMessage(); draw(); return; }
            if (mode === 'mirror') {
                if ((e.key === 'Enter' || e.key === ' ') && mirrorB) { e.preventDefault(); mirrorApply(true); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && mirrorB) { e.preventDefault(); mirrorApply(false); return; }
                if (e.key === 'Escape') { e.preventDefault(); const sel = mirrorSel; mirrorA = mirrorB = null; setMode('select-box'); selectedShapes = sel; updateCommandMessageText('COPIE MIROIR annulée.'); draw(); return; }
            }
            if (gripDrag && e.key === 'Escape') { e.preventDefault(); endGrip(true); return; }
            if (layoutOn) {
                if (e.key === 'Escape' && (mode === 'lpvp' || mode === 'lpvpc' || mode === 'lpimg')) { e.preventDefault(); lpVpStart = null; setMode('select-box'); draw(); return; }
                if (e.key === 'Escape' && layoutOn && lp3D.id) { e.preventDefault(); lp3DLeave(); return; }
                if (e.key === 'Escape' && lpActiveId && mode === 'select-box' && !isDrawing && !selectedShapes.length && !gripDrag) { e.preventDefault(); lpLeaveVp(); updateCommandMessageText('MISE EN PAGE : feuille (1 mm = 1 mm).'); draw(); return; }
                if (!lpActiveId && lpSelId && mode === 'select-box') {
                    if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); lpTyped += e.key.replace(',', '.'); updateCommandMessageText('FENÊTRE : échelle 1:' + lpTyped + ' (Espace)'); return; }
                    if (e.key === 'Backspace' && lpTyped) { e.preventDefault(); lpTyped = lpTyped.slice(0, -1); updateCommandMessageText('FENÊTRE : échelle 1:' + lpTyped); return; }
                    if ((e.key === 'Enter' || e.key === ' ') && lpTyped) { e.preventDefault(); const S = parseFloat(lpTyped); lpTyped = ''; lpSetScale(lpVp(lpSelId), S); return; }
                    if ((e.key === 'Delete' || e.key === 'Backspace') && lpVp(lpSelId) && lpVp(lpSelId).locked) { e.preventDefault(); updateCommandMessageText('Verrouillée : déverrouillez-la avant de la retirer.'); return; }
                    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); layoutData.vps = layoutData.vps.filter(v => v.id !== lpSelId); lpSelId = null; updateCommandMessageText('FENÊTRE retirée.'); draw(); return; }
                }
            }
            if (mirrorPending && mode === 'select-box' && (e.key === 'Enter' || e.key === ' ') && selectedShapes.length) { e.preventDefault(); startMirror(); return; }
            if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
            if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
            if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copySelection(); return; }
            if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); pasteSelection(); return; }
            if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); cutSelection(); return; }
            // Paramétrage de la sélection : Y ouvre la modale d'assignation de calque, N ignore.
            if (mode === 'select-box' && selectedShapes.length > 0 && !e.ctrlKey && !isDrawing) {
                if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); openSelectionParamModal(); return; }
                if (e.key === 'n' || e.key === 'N') { e.preventDefault(); return; }
            }
            // Opacité d'un fond de carte sélectionné : taper 50% (valeur absolue, 100 % = opaque, 0 % = invisible)
            if (mode === 'select-box' && !isDrawing && !e.ctrlKey && moveTypedX === null && selectedShapes.some(isBg)) {
                if (e.key === '%' && typedInput.length > 0 && !isNaN(parseInt(typedInput, 10))) {
                    e.preventDefault();
                    const v = Math.max(0, Math.min(100, parseInt(typedInput, 10)));
                    selectedShapes.forEach(s => { if (isBg(s)) s.opacity = v / 100; });
                    typedInput = ""; saveState(); updateCommandMessageText('FOND : opacité ' + v + ' %.'); draw(); return;
                }
            }
            // Déplacer : ΔX [Espace] ΔY [Entrée ou Espace], dans l'unité du plan (Y vers le haut).
            // Proposé dès qu'une sélection existe (outil Sélection) et dans l'outil Déplacer.
            if ((mode === 'move' || (mode === 'select-box' && !isDrawing)) && selectedShapes.length > 0 && !e.ctrlKey) {
                if (/^[0-9.,\-]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); draw(); return; }
                if (e.key === 'Backspace' && (typedInput.length > 0 || moveTypedX !== null)) { e.preventDefault(); if (typedInput.length) typedInput = typedInput.slice(0, -1); else moveTypedX = null; draw(); return; }
                if (e.key === ' ' || e.key === 'Enter') {
                    if (moveTypedX === null) {
                        if (typedInput.length === 0 || isNaN(parseFloat(typedInput))) { if (e.key === ' ') e.preventDefault(); return; }
                        e.preventDefault();
                        moveTypedX = parseFloat(typedInput); typedInput = "";
                        if (e.key === ' ') { draw(); return; }      // Espace : on passe à ΔY
                    } else e.preventDefault();
                    const off = moveTypedOffset();
                    selectedShapes.forEach(s => translateShape(s, off.dx, off.dy));
                    const mx = moveTypedX, my = parseFloat(typedInput) || 0;
                    moveTypedX = null; typedInput = ""; isMovingObjects = false; moveBasePoint = null; saveState();
                    updateCommandMessageText('DÉPLACÉ de ΔX ' + fmtLen(mx) + ' · ΔY ' + fmtLen(my) + '.');
                    draw(); return;
                }
            }
            // Paroi : avant le 1er clic, épaisseur tapée (mm) + Entrée ; Tab = inverser le côté (gauche ↔ droite)
            if (mode === 'wall' && wallTool && !e.ctrlKey && e.key === 'Tab') { e.preventDefault(); wallTool.align = wallTool.align === 'gauche' ? 'droite' : wallTool.align === 'droite' ? 'gauche' : 'axe'; if (wallTool.align === 'axe') wallTool.align = 'gauche'; updateCommandMessage(); draw(); return; }
            if (mode === 'wall' && wallTool && !wallStart && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessage(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); updateCommandMessage(); return; }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); const v = parseFloat(typedInput); typedInput = ''; if (v > 0) wallTool.layers[0].e = v; updateCommandMessage(); draw(); return; }
            }
            // Paroi : longueur tapée dans la direction de la souris puis Entrée
            if (mode === 'wall' && wallStart && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessage(); draw(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); updateCommandMessage(); draw(); return; }
                if (e.key === 'Shift') { shiftHeld = true; draw(); }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); const d = (parseFloat(typedInput) / unitsPerSquare) * GRID_SIZE, a0 = Math.atan2(currentY - wallStart.y, currentX - wallStart.x), a = (orthoMode || e.shiftKey) ? Math.round(a0 / (Math.PI / 2)) * Math.PI / 2 : a0; wallAddTo(wallStart.x + d * Math.cos(a), wallStart.y + d * Math.sin(a)); updateCommandMessage(); return; }
            }
            // Étirer : distance tapée dans la direction de la souris puis Entrée
            if (mode === 'stretch' && stretchBase && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessage(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); updateCommandMessage(); return; }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); const d = (parseFloat(typedInput) / unitsPerSquare) * GRID_SIZE, ang0 = Math.atan2(currentY - stretchBase.y, currentX - stretchBase.x), ang = (orthoMode || e.shiftKey) ? Math.round(ang0 / (Math.PI / 2)) * Math.PI / 2 : ang0; stretchApply(d * Math.cos(ang), d * Math.sin(ang)); return; }
            }
            // Arrondir : rayon tapé puis Entrée (Entrée seule = dernier rayon)
            if (mode === 'fillet' && filletA && filletB && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessage(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); updateCommandMessage(); return; }
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const v = typedInput ? parseFloat(typedInput) : filletR; if (v !== null && v >= 0 && isFinite(v)) filletApply(v); return; }
            }
            // Fond de carte : rayon tapé (m) puis Entrée
            if (mode === 'bmplace' && bmPlace && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); updateCommandMessage(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); updateCommandMessage(); return; }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); const v = parseFloat(typedInput); if (v > 0) { bmPlace.R = Math.min(v, 5000); try { localStorage.setItem('momocad-bm-r', String(bmPlace.R)); } catch (e2) {} } typedInput = ''; updateCommandMessage(); draw(); return; }
            }
            // Profil en long : Entrée termine l'axe
            if (mode === 'profile' && (e.key === 'Enter' || e.key === ' ') && profileAxis.length) { e.preventDefault(); finishProfileAxis(); return; }
            // Point topo : altitude tapée puis Entrée (s'applique au dernier point posé)
            if (mode === 'topo' && !e.ctrlKey && lastTopo && shapes.includes(lastTopo)) {
                if (/^[0-9.,\-]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); draw(); return; }
                if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return; }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); const v = parseFloat(typedInput); if (!isNaN(v)) { lastTopo.z = v * 1000; saveState(); } typedInput = ''; draw(); return; }
            }
            // Calibrer : distance réelle tapée puis Entrée
            if (mode === 'calibrate' && calP2 && !e.ctrlKey) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); draw(); return; }
                if (e.key === 'Backspace') { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return; }
                if ((e.key === 'Enter' || e.key === ' ') && typedInput) { e.preventDefault(); applyCalibration(parseFloat(typedInput)); return; }
            }
            if (document.getElementById('bgimg-modal').style.display === 'flex') { if (e.key === 'Escape') closeBgModal(); return; }
            // Cotes : choix du type (0 simple, 1 cumulée, 2 successive) puis Espace/Entrée ; fin de chaîne avec Entrée/Espace
            if (isDimMode() && !e.ctrlKey) {
                if (dimStep === 0) {
                    if (/^[012]$/.test(e.key)) { e.preventDefault(); typedInput = e.key; draw(); return; }
                    if (e.key === 'Backspace' && typedInput) { e.preventDefault(); typedInput = ""; draw(); return; }
                    if ((e.key === ' ' || e.key === 'Enter') && typedInput) {
                        e.preventDefault(); dimChain = ['single', 'cumul', 'succ'][+typedInput]; typedInput = "";
                        updateCommandMessageText((mode === 'dim-ortho' ? 'COTE ORTHO' : 'COTE LIBRE') + ' : mode ' + DIM_CHAIN_LABEL[dimChain] + '. Cliquez le 1er point.'); draw(); return;
                    }
                } else if (dimStep === 3 && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault(); endDimChain(); updateCommandMessageText('Cotation terminée.'); draw(); return;
                }
            }
            // Mode échelle : accepte x[n] (multiplier) ou /[n] (diviser), en plus des chiffres.
            if (isScaleMode() && selectedShapes.length > 0) {
                if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); typedInput += e.key.replace(',', '.'); draw(); return; }
                else if (e.key === 'Backspace') { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return; }
                else if ((e.key === 'Enter' || e.key === ' ') && typedInput.length > 0) { e.preventDefault(); applyScaleFromTyped(); return; }
            }
            if (isDrawing || mode === 'rotate' || mode === 'offset') {
                if (/^[0-9.,\-]$/.test(e.key)) { e.preventDefault(); if (mode === 'offset' && window.__offFresh) { typedInput = ''; window.__offFresh = false; offsetTarget = null; offsetPreviewShape = null; } typedInput += e.key.replace(',', '.'); draw(); return; }
                else if (e.key === 'Backspace') { e.preventDefault(); typedInput = typedInput.slice(0, -1); draw(); return; }
                else if ((e.key === 'Enter' || e.key === ' ') && typedInput.length > 0) {
                    // Entrée = valider puis revenir à Sélection. Espace = valider en gardant l'outil.
                    e.preventDefault(); if (mode === 'offset') window.__offFresh = true;   // distance validée : un nouveau chiffre tapé repart de zéro
                    validateTypedInput(e.key === 'Enter');
                    return;
                }
            }
            if (mode === 'preview' && e.key === 'Enter') {
                e.preventDefault();
                const c0 = previewPin || { x: currentX_screen, y: currentY_screen };
                performPrint(c0.x, c0.y);
                return;
            }
            if (e.key === ' ') {
                if (mode === 'print' || mode === 'preview') {
                    e.preventDefault();
                    printOrientation = printOrientation === 'landscape' ? 'portrait' : 'landscape';
                    printSettings.orientation = printOrientation; try { localStorage.setItem('momocad-print', JSON.stringify(printSettings)); } catch (e2) {}
                    const c0 = (mode === 'preview' && previewPin) ? previewPin : { x: currentX_screen, y: currentY_screen };
                    applyPrintScale(c0.x, c0.y); draw();
                }
            }
            if (e.key === 'Escape') {
                isDrawing = false; arcStep = 0; currentPolygon = []; isMovingObjects = false; moveBasePoint = null;
                rectDimStep = 0; rectWidthVal = 0;
                detailStep = 0; detailTarget = null; detailLabelPos = null; closeDetailModal();
                trackPts = []; trackLines = [];
                dimStep = 0; dimChainInfo = null; selectedShapes = []; isRotatingObjects = false; rotateCenter = null;
                scaleCenter = null; scaleRefDist = 0; isScalingObjects = false;
                dimAngleStep = 0; dimAngleLine1 = null; dimAngleLine2 = null; dimAngleIntersect = null;
                closeTextModal(); closeCartoucheModal(); closeLayerModal(); closeSnapModal(); closeHelpModal();
                typedInput = ""; offsetTarget = null; offsetPreviewShape = null; moveTypedX = null;
                setMode('select-box'); draw();
            }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapes.length > 0 && document.activeElement.tagName !== 'INPUT' && typedInput.length === 0) {
                shapes = shapes.filter(s => !selectedShapes.includes(s)); selectedShapes = []; saveState(); draw();
            }
        });

        // Règle générale : Espace valide et garde l'outil ; Entrée valide et revient en mode Sélection, sans rien de sélectionné.
        const ENTER_KEEP = new Set(['select-box', 'preview', 'print', 'text', 'array', 'divide', 'lpvp', 'lpvpc', 'lpimg', 'calibrate', 'blkbase', 'cubpick', 'sweeppick']);
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
            const ae = document.activeElement; if (ae && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(ae.tagName) || ae.isContentEditable)) return;
            if (inlineEdit || is3DOpen() || ENTER_KEEP.has(mode)) return;
            if (['topo-modal', 'basemap-modal', 'crop-modal'].some(id => document.getElementById(id).style.display === 'flex')) return;
            if (['cartouche-modal', 'layer-modal', 'selparam-modal'].some(id => !document.getElementById(id).classList.contains('hidden'))) return;
            setTimeout(() => {   // après le traitement de l'outil (validation de la valeur, fin de la polyligne…)
                if (ENTER_KEEP.has(mode) || document.getElementById('topo-modal').style.display === 'flex' || !document.getElementById('selparam-modal').classList.contains('hidden')) return;
                if (mode === 'pline' && isDrawing) finishPline();
                setMode('select-box'); selectedShapes = []; try { updatePropertiesPopup(); } catch (e2) {} draw();
            }, 0);
        });

        canvas.addEventListener('dblclick', (e) => {
            if (brush2D()) { if (brushCur && brushCur.brush.poly) brushPolyEnd(); return; }
            if (layoutOn) { const r0 = canvas.getBoundingClientRect(); if (lpDblClick(e.clientX - r0.left, e.clientY - r0.top)) return; }
            if (mode === 'profile' && profileAxis.length >= 2) { profileAxis.pop(); finishProfileAxis(); return; }   // le double-clic a ajouté un point en double
            if (mode === 'pline' && isDrawing) { finishPline(); return; }
            if (mode === 'pen' && penPts.length) { penPts = penPts.filter((q, i) => i === 0 || Math.hypot(q.x - penPts[i - 1].x, q.y - penPts[i - 1].y) > 1e-9); finishPen(false); return; }
            if (isPolyMode() && isDrawing && currentPolygon.length > 2) {
                if (waterDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); waterCreate(WP); return; }
                if (boisDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); boisCreate(WP); return; }
                if (bassinDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); bassinCreate(WP); return; } if (mailDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; setMode('select-box'); mailCreate(WP); return; } if (mailZoneDraw) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; mailZoneCreate(WP); return; }
                if (brushPolyDraw && brushTool) { const WP = cleanPolyPts(currentPolygon, true); isDrawing = false; currentPolygon = []; typedInput = ''; brushPolyCreate(WP); return; }
                shapes.push({ type: 'poly', layerId: activeLayerId, points: cleanPolyPts(currentPolygon, true), color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false });
                isDrawing = false; currentPolygon = []; typedInput = ""; saveState(); draw();
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault(); window.wheelT = performance.now();
            if (mode === 'stamp' && stamp && (e.shiftKey || e.ctrlKey)) {
                const d = e.deltaY || e.deltaX; if (!d) return;
                if (e.shiftKey) stamp.sc = Math.max(0.05, Math.min(50, stamp.sc * (d < 0 ? 1.1 : 1 / 1.1)));
                else stamp.rot += (d < 0 ? 1 : -1) * 15 * Math.PI / 180;
                updateCommandMessage(); draw(); return;
            }
            const r = canvas.getBoundingClientRect(); let sx = e.clientX-r.left, sy = e.clientY-r.top;
            if (layoutOn) { if (lp3D.id && lp3DWheel(e, sx, sy)) return; lpWheel(e, sx, sy); return; }
            if (mode === 'preview' && previewPin) { sx = previewPin.x; sy = previewPin.y; }
            let wp = screenToWorld(sx, sy);
            const nav = mode !== 'print' && mode !== 'preview'; if (nav) navBegin();
            if (mode === 'print' || mode === 'preview') {
                // Scroll = passer d'une échelle à l'autre dans PRINT_SCALES.
                // Le tableau va du plus AGRANDISSANT (5:1) au plus RÉDUISANT (1:500).
                // Molette vers le haut (deltaY<0) -> on AGRANDIT (index plus petit).
                const base = printBaseZoom();
                if (e.deltaY < 0) printScaleIndex = Math.max(0, printScaleIndex - 1);
                else printScaleIndex = Math.min(PRINT_SCALES.length - 1, printScaleIndex + 1);
                currentPrintScale = PRINT_SCALES[printScaleIndex].label;
                camera.zoom = base * PRINT_SCALES[printScaleIndex].factor;
            } else {
                let zf = 1.1; if (e.deltaY < 0) camera.zoom *= zf; else camera.zoom /= zf;
                // Zoom libre : simple garde-fou contre la dégénérescence numérique
                camera.zoom = Math.max(1e-9, Math.min(camera.zoom, 1e9));
            }
            camera.x = sx - wp.x * camera.zoom; camera.y = sy - wp.y * camera.zoom; if (nav) navDraw(); else draw();
        });

        window.onload = () => {
            updateLayerUI(); resizeCanvas(); saveState(); markSaved(); refreshDimTextButton(); refreshSnapButtons(); restorePal(); markActivePal(); restoreLastGabarit(); updateRose(); mcRefresh(); setInterval(mcRefresh, 1000); autosaveInit(); if (momoOn) loadTuto((ok) => { if (ok && window.MomoTuto.version >= 3) { window.MomoTuto.enable(false); mcRefresh();
                // 3 s après l'ouverture (une fois le logo d'accueil disparu), Momo sort les yeux et propose son aide
                const hi = () => setTimeout(() => { if (window.MomoTuto.hello) window.MomoTuto.hello(); }, 3000);
                if (!document.getElementById('mc-splash')) hi(); else { const iv = setInterval(() => { if (!document.getElementById('mc-splash')) { clearInterval(iv); hi(); } }, 150); } } });
            Object.entries(CMD_ALIASES).forEach(([k, [m]]) => { const b = document.getElementById('btn-' + m); if (b && !/\(raccourci/.test(b.title)) b.title += ' (raccourci : ' + k + ' + Espace)'; });
            // Double-clic sur un .mmc / .dxf (appli installée avec manifest.json) : ouverture directe
            if ('launchQueue' in window) {
                window.launchQueue.setConsumer(async (params) => {
                    if (!params || !params.files || !params.files.length) return;
                    const h = params.files[0];
                    if (isDirty() && !confirm("Le plan en cours a des modifications non enregistrées.\nLes abandonner et ouvrir « " + h.name + " » ?")) return;
                    try { const f = await h.getFile(); if (await loadFileObject(f, h.name)) fileHandle = h; }
                    catch (e) { console.error(e); alert("Impossible d'ouvrir « " + h.name + " » : " + (e.message || e)); }
                });
            }
            refreshGridField();
            getLogoImg();
            const ta = document.getElementById('inline-editor');
            ta.addEventListener('input', autoSizeInline);
            ta.addEventListener('blur', () => { if (inlineEdit && inlineEditReady) commitInlineEdit(); });
            ta.addEventListener('keydown', (ev) => {
                ev.stopPropagation(); // ne pas déclencher les raccourcis CAO pendant la saisie
                if (ev.key === 'Escape') { ev.preventDefault(); commitInlineEdit(); }
                // Entrée = valider. Maj+Entrée = saut de ligne (laisser le comportement par défaut).
                if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitInlineEdit(); }
            });
        };
        function resizeCanvas() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; if (typeof layoutOn !== 'undefined' && layoutOn) lpFit(); if (mode === 'print' || mode === 'preview') applyPrintScale(canvas.width / 2, canvas.height / 2); draw(); }
        window.addEventListener('resize', resizeCanvas);
