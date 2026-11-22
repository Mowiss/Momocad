        // =====================================================================
        // SNAP CORRIGÉ :
        // 1. Déduplique les points proches (< 0.5px monde) à la construction
        // 2. findSnap compare les distances en pixels écran (invariant au zoom)
        // =====================================================================
        function getSnapPoints() {
            if (cachedSnapPoints) return cachedSnapPoints;
            let pts = [];
            for (const s of shapes) {
                let layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (layer && !layer.visible) continue;
                if (s._nosnap) continue;   // objet en cours de déformation par poignée
                if (snapSettings.endpoint) {
                    if (s.type === 'line' || s.type === 'dim') pts.push({x: s.x1, y: s.y1}, {x: s.x2, y: s.y2});
                    else if (s.type === 'poly') s.points.forEach((p, i) => { if (!s.curve || i % s.curve === 0 || i === s.points.length - 1) pts.push({x: p.x, y: p.y}); });
                    else if (s.type === 'text' || s.type === 'point') pts.push({x: s.x, y: s.y});
                    else if (s.type === 'arc') {
                        pts.push({x: s.x + Math.cos(s.startAngle)*s.r, y: s.y + Math.sin(s.startAngle)*s.r});
                        pts.push({x: s.x + Math.cos(s.endAngle)*s.r, y: s.y + Math.sin(s.endAngle)*s.r});
                        [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2; if (t2OnArc(s, a)) pts.push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); });   // quadrants de l'arc
                    }
                    else if (s.type === 'circle') {
                        pts.push({x: s.x + s.r, y: s.y}, {x: s.x - s.r, y: s.y}, {x: s.x, y: s.y + s.r}, {x: s.x, y: s.y - s.r});
                    }
                    else if (s.type === 'dim-angle') {
                        pts.push({x: s.vertex.x, y: s.vertex.y}, {x: s.p1.x, y: s.p1.y}, {x: s.p2.x, y: s.p2.y});
                    }
                }
                if (snapSettings.midpoint) {
                    if (s.type === 'line' || s.type === 'dim') pts.push({x: (s.x1+s.x2)/2, y: (s.y1+s.y2)/2});
                    else if (s.type === 'poly' && !s.curve) { for (let i=0; i<polyEdges(s); i++) { let p1=s.points[i], p2=s.points[(i+1)%s.points.length]; pts.push({x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2}); } }
                    else if (s.type === 'arc') { let mid = s.startAngle < s.endAngle ? (s.startAngle + s.endAngle)/2 : (s.startAngle + s.endAngle + 2*Math.PI)/2; pts.push({x: s.x + Math.cos(mid)*s.r, y: s.y + Math.sin(mid)*s.r}); }
                }
                if (snapSettings.center && (s.type === 'circle' || s.type === 'arc' || s.type === 'basemap')) pts.push({x: s.x, y: s.y});
                if (snapSettings.center && s.type === 'poly' && s.ell) { const c = shapeCenterOf(s); if (c) pts.push(c); }
                if (snapSettings.endpoint && s.type === 'bgimage') pts.push(...bgCorners(s));
                if (snapSettings.endpoint && s.type === 'mesh') pts.push(...meshCorners(s));
                if (snapSettings.endpoint && s.type === 'line' && s.wall) wallBands(s, 0, 0).forEach(b => b.pts.forEach(q => pts.push({ x: q[0], y: q[1] })));
                // points nez / pied des talus générés autour des plateformes
                if (snapSettings.endpoint && isPlateforme(s)) { let G = null; try { G = talusGeom(s); } catch (e) {}
                    if (G && G.marks) G.marks.forEach(m => { pts.push({ x: m.nez.x, y: m.nez.y, z: m.nez.z }, { x: m.pied.x, y: m.pied.y, z: m.pied.z }); }); }
            }
            if (snapSettings.intersection) { const ip = getAllIntersections(); for (let q = 0; q < ip.length; q++) pts.push(ip[q]); }

            // Déduplication par grille (tolérance 0.5 unité monde) : linéaire, et non plus quadratique
            const TOL = 0.5, seen = new Set(), deduped = [];
            for (const p of pts) { const key = Math.round(p.x / TOL) + ',' + Math.round(p.y / TOL); if (seen.has(key)) continue; seen.add(key); deduped.push(p); }

            deduped.sort((a, b) => a.x - b.x);   // trié sur X : recherche par dichotomie dans findSnap
            cachedSnapPoints = deduped; cachedSnapXs = Float64Array.from(deduped, q => q.x);
            return cachedSnapPoints;
        }

        // Comparaison en pixels écran — le carré snap ne "saute" plus au zoom
        function findSnap(wx, wy) {
            const all = getSnapPoints(), xs = cachedSnapXs, snapRadiusPx = SNAP_DIST_PX, rw = snapRadiusPx / camera.zoom;
            // seuls les points dont le X est à portée (dichotomie sur le tableau trié)
            let lo = 0, hi = all.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < wx - rw) lo = m + 1; else hi = m; }
            let up = lo; while (up < all.length && xs[up] <= wx + rw) up++;
            const pts = all.slice(lo, up); if (snapSettings.endpoint) pts.push({ x: 0, y: 0 });
            if (snapSettings.endpoint || snapSettings.midpoint) for (const s of shapes) { if (s.type !== 'pdfvec') continue; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue; vecSnapPts(s, wx, wy, rw).forEach(q => pts.push(q)); }   // tracés PDF : accroche sur leurs sommets
            if (tutoGhost && tutoGhost.pts) tutoGhost.pts.forEach(q => pts.push(q));   // tuto : les points du modèle s'accrochent
            if (snapSettings.endpoint || snapSettings.midpoint) openingSnapPts(wx, wy, rw).forEach(q => pts.push(q));   // ouvertures : coins, bouts, milieux
            if (typeof D3C !== 'undefined' && D3C.lines.length) d2ClSnaps().forEach(q => pts.push(q));   // traits de construction : leurs croisements (vus de dessus)
            let best = null, bestDistPx = snapRadiusPx;

            for (const p of pts) {
                // Convertir le point monde → écran pour comparer en pixels
                const sx = p.x * camera.zoom + camera.x;
                const sy = p.y * camera.zoom + camera.y;
                // Convertir la position curseur monde → écran
                const cx = wx * camera.zoom + camera.x;
                const cy = wy * camera.zoom + camera.y;
                const distPx = Math.hypot(sx - cx, sy - cy);
                if (distPx < bestDistPx) { bestDistPx = distPx; best = p; }
            }
            // --- Accroche PERPENDICULAIRE ---
            // Disponible uniquement pendant le tracé d'une ligne/polyligne, car le pied
            // de la perpendiculaire dépend du point d'origine du segment en cours.
            if (snapSettings.perpendicular && isDrawing && (mode === 'line' || isPolyMode())) {
                let origin = null;
                if (mode === 'line') origin = { x: startX, y: startY };
                else if (isPolyMode() && currentPolygon.length > 0) origin = currentPolygon[currentPolygon.length - 1];
                if (origin) {
                    const perp = findPerpendicularFoot(origin, wx, wy);
                    if (perp) {
                        const psx = perp.x * camera.zoom + camera.x, psy = perp.y * camera.zoom + camera.y;
                        const cx = wx * camera.zoom + camera.x, cy = wy * camera.zoom + camera.y;
                        const dPx = Math.hypot(psx - cx, psy - cy);
                        // Le pied perpendiculaire l'emporte s'il est dans le rayon d'accroche
                        if (dPx < snapRadiusPx && (!best || dPx <= bestDistPx)) {
                            best = { x: perp.x, y: perp.y, perp: true };
                        }
                    }
                }
            }
            // --- Accroche TANGENTE : depuis le point de départ du tracé vers un cercle / un arc ---
            if (snapSettings.tangent) { const o = t2Origin(); if (o) { const tg = t2TangentSnap(o, wx, wy, best ? bestDistPx : snapRadiusPx); if (tg) best = tg; } }
            // --- PAROIS : en traçant une paroi, accroche à l'axe des parois existantes (bouts et milieu de chaque tronçon), puis à leurs faces ---
            if (mode === 'wall' || mode === 'opening' || mode === 'roof') { const W = shapes.filter(x => isWallHatch(x) && x.loops && x.loops[0] && x.loops[0].length >= 3 && (!wallChain || !wallChain.shapes.includes(x))), toPx = (q) => Math.hypot(q.x * camera.zoom + camera.x - (wx * camera.zoom + camera.x), q.y * camera.zoom + camera.y - (wy * camera.zoom + camera.y));
                if (!best) W.filter(h => h.loops[0].length === 4).forEach(h => { const L = h.loops[0], e1 = { x: (L[0].x + L[3].x) / 2, y: (L[0].y + L[3].y) / 2 }, e2 = { x: (L[1].x + L[2].x) / 2, y: (L[1].y + L[2].y) / 2 }; [e1, e2, { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 }].forEach(q => { const d = toPx(q); if (d < bestDistPx) { bestDistPx = d; best = { x: q.x, y: q.y, axis: true }; } }); });
                if (!best) { let bd = snapRadiusPx; W.forEach(h => h.loops.forEach(LL => LL.forEach((a, i, L) => { const b = L[(i + 1) % L.length], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((wx - a.x) * vx + (wy - a.y) * vy) / l2)), q = { x: a.x + vx * t, y: a.y + vy * t }, d = toPx(q); if (d < bd) { bd = d; best = { x: q.x, y: q.y, face: true }; } }))); } }
            if (best) return best;
            const cxs = wx * camera.zoom + camera.x, cys = wy * camera.zoom + camera.y;
            // --- ORTHO PROJETÉ : lignes H / V depuis les points acquis, accroche aux croisements ---
            trackLines = [];
            if (snapSettings.track && trackPts.length) {
                const band = 8 / camera.zoom;
                trackPts.forEach(p => {
                    if (Math.abs(wy - p.y) < band) trackLines.push({ h: true, v: p.y, from: p });
                    if (Math.abs(wx - p.x) < band) trackLines.push({ h: false, v: p.x, from: p });
                });
                if (trackLines.length) {
                    let tb = null, tbd = snapRadiusPx;
                    const consider = (x, y) => { const d = Math.hypot(x * camera.zoom + camera.x - cxs, y * camera.zoom + camera.y - cys); if (d < tbd) { tbd = d; tb = { x, y, track: true }; } };
                    trackLines.forEach(L => trackIntersections(L).forEach(q => consider(q.x, q.y)));
                    // croisement de deux lignes de projection (une H et une V)
                    trackPts.forEach(a => trackPts.forEach(b => { if (a !== b) consider(b.x, a.y); }));
                    if (tb) { tb.lines = trackLines; return tb; }
                }
            }
            // --- GRILLE : croisements du quadrillage affiché ---
            if (snapSettings.grid && showGrid) {
                let step = mmToWorld(gridMm); while (step * camera.zoom < 6) step *= 10;
                const gx = Math.round(wx / step) * step, gy = Math.round(wy / step) * step;
                const d = Math.hypot(gx * camera.zoom + camera.x - cxs, gy * camera.zoom + camera.y - cys);
                if (d < Math.min(snapRadiusPx, step * camera.zoom * 0.45)) return { x: gx, y: gy, grid: true, lines: trackLines };
            }
            // --- Accroche PROCHE : n'importe où sur un trait ---
            if (snapSettings.nearest) { const nr = t2NearestSnap(wx, wy); if (nr) return nr; }
            // à défaut : alignement sur la ligne projetée la plus proche
            if (trackLines.length) {
                const L = trackLines[0];
                return L.h ? { x: wx, y: L.v, track: true, align: true, lines: trackLines } : { x: L.v, y: wy, track: true, align: true, lines: trackLines };
            }
            return null;
        }
        // Croisements d'une ligne de projection (infinie, H ou V) avec les formes visibles
        function trackIntersections(L) {
            const out = [];
            const seg = (ax, ay, bx, by) => {
                if (L.h) { if ((ay - L.v) * (by - L.v) > 0 || ay === by) return; const t = (L.v - ay) / (by - ay); out.push({ x: ax + t * (bx - ax), y: L.v }); }
                else { if ((ax - L.v) * (bx - L.v) > 0 || ax === bx) return; const t = (L.v - ax) / (bx - ax); out.push({ x: L.v, y: ay + t * (by - ay) }); }
            };
            const circ = (cx, cy, r, arc) => {
                const d = L.h ? L.v - cy : L.v - cx; if (Math.abs(d) > r) return;
                const k = Math.sqrt(r * r - d * d);
                [k, -k].forEach(o => { const p = L.h ? { x: cx + o, y: L.v } : { x: L.v, y: cy + o }; if (!arc || isAngleBetween(Math.atan2(p.y - cy, p.x - cx), arc.startAngle, arc.endAngle)) out.push(p); });
            };
            for (const s of shapes) {
                const layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (layer && !layer.visible) continue;
                if (s.type === 'line') seg(s.x1, s.y1, s.x2, s.y2);
                else if (s.type === 'poly') for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; seg(a.x, a.y, b.x, b.y); }
                else if (s.type === 'circle') circ(s.x, s.y, s.r, null);
                else if (s.type === 'arc') circ(s.x, s.y, s.r, s);
            }
            return out;
        }
        // Acquisition d'un point pour l'ortho projeté : rester ~0,5 s sur un point d'accroche (re-survoler = le retirer)
        function updateTrackHover(snap) {
            if (!snapSettings.track) return;
            const isObj = snap && !snap.track && !snap.grid && !snap.perp;
            if (!isObj) { if (trackHover) { clearTimeout(trackHover.t); trackHover = null; } return; }
            const key = snap.x.toFixed(6) + ',' + snap.y.toFixed(6);
            if (trackHover && trackHover.key === key) return;
            if (trackHover) clearTimeout(trackHover.t);
            trackHover = { key, t: setTimeout(() => {
                const i = trackPts.findIndex(p => Math.abs(p.x - snap.x) < 1e-6 && Math.abs(p.y - snap.y) < 1e-6);
                if (i >= 0) trackPts.splice(i, 1); else { trackPts.push({ x: snap.x, y: snap.y }); if (trackPts.length > 3) trackPts.shift(); }
                trackHover = null; draw();
            }, 500) };
        }

        // Pied de la perpendiculaire depuis 'origin' vers la forme la plus proche du curseur.
        // Retourne le point sur la forme, ou null. Ne considère que lignes, polys, cercles.
        function findPerpendicularFoot(origin, wx, wy) {
            let best = null, bestDistPx = SNAP_DIST_PX;
            const cx = wx * camera.zoom + camera.x, cy = wy * camera.zoom + camera.y;
            const tryFoot = (fx, fy) => {
                const fsx = fx * camera.zoom + camera.x, fsy = fy * camera.zoom + camera.y;
                const d = Math.hypot(fsx - cx, fsy - cy);
                if (d < bestDistPx) { bestDistPx = d; best = { x: fx, y: fy }; }
            };
            // Pied perpendiculaire d'un point P sur un segment AB (projeté, borné au segment)
            const footOnSeg = (ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay, l2 = dx*dx + dy*dy;
                if (l2 === 0) return;
                let t = ((origin.x - ax) * dx + (origin.y - ay) * dy) / l2;
                t = Math.max(0, Math.min(1, t)); // on reste sur le segment réel
                tryFoot(ax + t*dx, ay + t*dy);
            };
            for (const s of shapes) {
                const layer = layers.find(l => l.id === (s.layerId || 'layer-0'));
                if (layer && !layer.visible) continue;
                if (s.type === 'line' || s.type === 'dim') footOnSeg(s.x1, s.y1, s.x2, s.y2);
                else if (s.type === 'poly') {
                    for (let i = 0; i < polyEdges(s); i++) {
                        const p1 = s.points[i], p2 = s.points[(i+1) % s.points.length];
                        footOnSeg(p1.x, p1.y, p2.x, p2.y);
                    }
                }
                else if (s.type === 'circle' || s.type === 'arc') {
                    // Perpendiculaire à un cercle = le point radial aligné avec l'origine.
                    const dx = origin.x - s.x, dy = origin.y - s.y, dlen = Math.hypot(dx, dy);
                    if (dlen > 0.0001) {
                        const fx = s.x + (dx/dlen)*s.r, fy = s.y + (dy/dlen)*s.r;
                        if (s.type === 'arc') {
                            const a = Math.atan2(fy - s.y, fx - s.x);
                            if (isAngleBetween(a, s.startAngle, s.endAngle)) tryFoot(fx, fy);
                        } else tryFoot(fx, fy);
                    }
                }
            }
            return best;
        }

        function isPointInRect(px, py, rx, ry, rw, rh) {
            let xMin = Math.min(rx, rx + rw), xMax = Math.max(rx, rx + rw), yMin = Math.min(ry, ry + rh), yMax = Math.max(ry, ry + rh);
            return px >= xMin && px <= xMax && py >= yMin && py <= yMax;
        }

        function findShapeAt(wx, wy) { rdPick = null; const st = st2At(wx, wy) || ctAt(wx, wy) || rdPrAt(wx, wy); if (st) return st; const r = _findShapeAt(wx, wy); if (r) return r;   // les traits de construction (infinis) en dernier recours
            for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (isCL(s) && Math.abs((wx - s.x) * s.uy - (wy - s.y) * s.ux) * camera.zoom < 7) return s; } return null; }
        function _findShapeAt(wx, wy) {
            let tol = 10/camera.zoom, p = { x: wx, y: wy };
            for (let i = shapes.length-1; i >= 0; i--) {
                let s = shapes[i], l = layers.find(lx => lx.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue; if (s.type === 'cline' || lvlOff2D(s)) continue;
                if (s.type === 'point') { if (Math.hypot(p.x - s.x, p.y - s.y) < tol) return s; continue; }
                if (s.type === 'pdfvec') { if (vecHit(s, p.x, p.y, tol)) return s; continue; }
                if (s.type === 'mesh') { const q = meshLocal(s, p.x, p.y); if (q.x >= s.bb.x0 && q.x <= s.bb.x1 && q.y >= s.bb.y0 && q.y <= s.bb.y1) return s; continue; }
                if (s.type === 'slope') { const l2 = (s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2; if (l2 === 0) continue; const t = Math.max(0, Math.min(1, ((p.x - s.x1) * (s.x2 - s.x1) + (p.y - s.y1) * (s.y2 - s.y1)) / l2)); if (Math.hypot(p.x - (s.x1 + t * (s.x2 - s.x1)), p.y - (s.y1 + t * (s.y2 - s.y1))) < tol) return s; continue; }
                if (s.type === 'line' && s.wall) { const B = wallBands(s, 0, 0); if (B.length) { const q = [B[0].pts[0], B[0].pts[1], B[B.length - 1].pts[2], B[B.length - 1].pts[3]].map(v => ({ x: v[0], y: v[1] })); if (pointInPolygon(p.x, p.y, q)) return s; } }
                if (s.type === 'line') { let l2 = Math.pow(s.x2-s.x1,2)+Math.pow(s.y2-s.y1,2); if (l2 === 0) continue; let t = Math.max(0, Math.min(1, ((p.x-s.x1)*(s.x2-s.x1)+(p.y-s.y1)*(s.y2-s.y1))/l2)); if (Math.hypot(p.x-(s.x1+t*(s.x2-s.x1)), p.y-(s.y1+t*(s.y2-s.y1))) < tol) return s; }
                else if (s.type === 'dim') {
                    const g = dimGeom(s); if (!g) continue;
                    const l2 = Math.pow(g.c2.x-g.c1.x,2)+Math.pow(g.c2.y-g.c1.y,2); if (l2 === 0) continue;
                    const t = Math.max(0, Math.min(1, ((p.x-g.c1.x)*(g.c2.x-g.c1.x)+(p.y-g.c1.y)*(g.c2.y-g.c1.y))/l2));
                    if (Math.hypot(p.x-(g.c1.x+t*(g.c2.x-g.c1.x)), p.y-(g.c1.y+t*(g.c2.y-g.c1.y))) < tol) return s;
                }
                else if (s.type === 'circle') { let d = Math.hypot(p.x-s.x, p.y-s.y); if (Math.abs(d-s.r) < tol) return s; }
                else if (s.type === 'arc') { let d = Math.hypot(p.x-s.x, p.y-s.y); if (Math.abs(d-s.r) < tol) { let a = Math.atan2(p.y-s.y, p.x-s.x); if (isAngleBetween(a, s.startAngle, s.endAngle)) return s; } }
                else if (s.type === 'poly') { for(let j=0; j<polyEdges(s); j++){ let p1 = s.points[j], p2 = s.points[(j+1)%s.points.length]; let l2 = Math.pow(p2.x-p1.x,2)+Math.pow(p2.y-p1.y,2); if (l2 === 0) continue; let t = Math.max(0, Math.min(1, ((p.x-p1.x)*(p2.x-p1.x)+(p.y-p1.y)*(p2.y-p1.y))/l2)); if (Math.hypot(p.x-(p1.x+t*(p2.x-p1.x)), p.y-(p1.y+t*(p2.y-p1.y))) < tol) return s; } }
                else if (s.type === 'dimr') { if (t2DimRHit(s, p, tol)) return s; }
                else if (s.type === 'text') {
                    const px = annotTextPx(s.layerId, 14, 1, camera.zoom), fs = px / camera.zoom;
                    ctx.font = "bold " + px + "px Arial"; const tl = (s.content || '').split('\n'); let w = 0; tl.forEach(t => w = Math.max(w, ctx.measureText(t).width)); w /= camera.zoom;
                    if (wx >= s.x && wx <= s.x + w && wy >= s.y - fs && wy <= s.y + (tl.length - 1) * fs * 1.25 + fs * 0.3) return s;
                }
                else if (s.type === 'detail') {
                    // Clic sur le cadre de l'étiquette (zone approximative)
                    const px = annotTextPx(s.layerId, 14, 1, camera.zoom), kk = px / 14;
                    ctx.font = "bold " + px + "px Arial";
                    const lines = (s.content||'').split('\n');
                    let mw = 0; lines.forEach(t => mw = Math.max(mw, ctx.measureText(t).width));
                    const bw = (mw + 12 * kk) / camera.zoom, bh = (lines.length * px * 1.25 + 8 * kk) / camera.zoom;
                    if (wx >= s.lx && wx <= s.lx + bw && wy >= s.ly && wy <= s.ly + bh) return s;
                    // ou clic près du point désigné
                    if (Math.hypot(wx - s.tx, wy - s.ty) < tol*1.5) return s;
                }
                else if (s.type === 'dim-angle') {
                    // Sélection sur le texte ° (label) ou sur l'arc de cotation
                    if (s._labelX !== undefined) {
                        const lblTol = 20 / camera.zoom;
                        if (Math.hypot(p.x - s._labelX, p.y - s._labelY) < lblTol) return s;
                    }
                    // Fallback : clic près du sommet
                    if (Math.hypot(p.x - s.vertex.x, p.y - s.vertex.y) < tol * 5) return s;
                }
            }
            for (let i = shapes.length - 1; i >= 0; i--) {
                const s = shapes[i]; if (s.type !== 'hatch') continue;
                const l = layers.find(lx => lx.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue;
                if (pointInHatch(s, wx, wy)) return s;
            }
            for (let i = shapes.length - 1; i >= 0; i--) {
                const s = shapes[i]; if (s.type === 'bgimage') { const l = layers.find(lx => lx.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue; const q = bgLocal(s, wx, wy); if (Math.abs(q.x) <= s.w / 2 && Math.abs(q.y) <= s.h / 2) return s; continue; }
                if (s.type !== 'basemap') continue;
                const l = layers.find(lx => lx.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue;
                if (Math.hypot(wx - s.x, wy - s.y) <= s.r) return s;
            }
            return null;
        }

        // --- LOGIQUE AJUSTER ET PROLONGER ---
        // ---- Ajuster / Prolonger : arêtes limites (droites, cotes, polylignes, traits de construction) et choix robuste de l'objet cliqué ----
        function bSegs(o) {
            if (o.type === 'cline') { const B = mmToWorld(5e6); return [{ x1: o.x - o.ux * B, y1: o.y - o.uy * B, x2: o.x + o.ux * B, y2: o.y + o.uy * B }]; }
            return getSegments(o);
        }
        function toolVisOthers(target) { return shapes.filter(s => s !== target && (!s.gen || s.type === 'cline') && s.type !== 'bgimage' && s.type !== 'basemap' && (s.type === 'cline' || layers.find(l => l.id === (s.layerId || 'layer-0'))?.visible)); }
        function toolPick(mx, my, types) {   // l'objet du bon type le plus proche du clic (une hachure ou un mur dessous ne masque plus la droite visée)
            const tol = 10 / camera.zoom; let best = null, bd = Infinity;
            const segD = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((mx - x1) * dx + (my - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(mx - x1 - t * dx, my - y1 - t * dy); };
            for (let i = shapes.length - 1; i >= 0; i--) { const o = shapes[i]; if (!types.includes(o.type) || o.gen) continue; const l = layers.find(x => x.id === (o.layerId || 'layer-0')); if (l && !l.visible) continue;
                let d = Infinity;
                if (o.type === 'line') d = segD(o.x1, o.y1, o.x2, o.y2);
                else if (o.type === 'poly') for (let j = 0; j < polyEdges(o); j++) { const a = o.points[j], b = o.points[(j + 1) % o.points.length]; d = Math.min(d, segD(a.x, a.y, b.x, b.y)); }
                else if (o.type === 'circle') d = Math.abs(Math.hypot(mx - o.x, my - o.y) - o.r);
                else if (o.type === 'arc') { if (isAngleBetween(Math.atan2(my - o.y, mx - o.x), o.startAngle, o.endAngle)) d = Math.abs(Math.hypot(mx - o.x, my - o.y) - o.r); }
                if (d < bd) { bd = d; best = o; } }
            return bd <= tol ? best : null;
        }
        // paramètres (0..1 sur [A,B]) où la droite AB croise les autres objets, avec une tolérance d'un pixel aux bouts des arêtes (jonctions en T)
        function lineCutParams(A, B, others, ray) {
            const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), out = []; if (L < 1e-12) return out; const tolW = 1.5 / camera.zoom;
            others.forEach(o => {
                bSegs(o).forEach(b => { const sx = b.x2 - b.x1, sy = b.y2 - b.y1, Lb = Math.hypot(sx, sy); if (Lb < 1e-12) return; const den = dx * sy - dy * sx; if (Math.abs(den) < 1e-12 * L * Lb) return;
                    const qx = b.x1 - A.x, qy = b.y1 - A.y, t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
                    if ((ray || (t >= -tolW / L && t <= 1 + tolW / L)) && u >= -tolW / Lb && u <= 1 + tolW / Lb) out.push(t); });
                if (o.type === 'circle' || o.type === 'arc') { const fx = A.x - o.x, fy = A.y - o.y, a = dx * dx + dy * dy, bq = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - o.r * o.r, D = bq * bq - 4 * a * c; if (D < 0) return;
                    [(-bq - Math.sqrt(D)) / (2 * a), (-bq + Math.sqrt(D)) / (2 * a)].forEach(t => { const px = A.x + dx * t, py = A.y + dy * t; if (o.type === 'arc' && !isAngleBetween(Math.atan2(py - o.y, px - o.x), o.startAngle - 0.002, o.endAngle + 0.002)) return; if (ray || (t >= -1e-9 && t <= 1 + 1e-9)) out.push(t); }); }
            });
            return out;
        }
        function trimShapeAt(mx, my) {
            let target = toolPick(mx, my, ['line', 'poly', 'arc', 'circle']) || findShapeAt(mx, my);
            if (target && target.type === 'poly' && !target.solid && !target.trench) { trimPolyAt(target, mx, my); return; }
            if (!target || (target.type !== 'line' && target.type !== 'poly' && target.type !== 'arc' && target.type !== 'circle' && target.type !== 'hatch')) return;
            let otherVis = toolVisOthers(target);
            if (target.type === 'hatch') { trimHatchAt(target, mx, my); return; }
            let intersections = []; otherVis.forEach(s => intersections.push(...getInterPoints(target, s)));

            if (target.type === 'line') {
                // Croisements avec tolérance (~1 px) : une droite qui s'arrête pile sur la cible (jonction en T, accroche)
                // la coupe aussi ; sinon l'erreur d'arrondi la faisait ignorer et toute la droite disparaissait.
                const dx = target.x2 - target.x1, dy = target.y2 - target.y1, L = Math.hypot(dx, dy); if (L < 1e-12) return;
                const tolW = 1 / camera.zoom, ts = [0, 1];
                const addT = (t) => { if (t > -1e-12 && t < 1 + 1e-12) ts.push(Math.min(1, Math.max(0, t))); };
                otherVis.forEach(o => {
                    bSegs(o).forEach(b => {
                        const sx = b.x2 - b.x1, sy = b.y2 - b.y1, Lb = Math.hypot(sx, sy); if (Lb < 1e-12) return;
                        const den = dx * sy - dy * sx; if (Math.abs(den) < 1e-12 * L * Lb) return;
                        const qx = b.x1 - target.x1, qy = b.y1 - target.y1, t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
                        if (t >= -tolW / L && t <= 1 + tolW / L && u >= -tolW / Lb && u <= 1 + tolW / Lb) addT(t);
                    });
                    if (o.type === 'circle' || o.type === 'arc') getInterPoints(target, o).forEach(p => addT(((p.x - target.x1) * dx + (p.y - target.y1) * dy) / (L * L)));
                });
                ts.sort((a, b) => a - b);
                const T = ts.filter((t, i) => i === 0 || (t - ts[i - 1]) * L > tolW * 0.5);
                if (T[T.length - 1] < 1) T.push(1);
                const tc = Math.min(1, Math.max(0, ((mx - target.x1) * dx + (my - target.y1) * dy) / (L * L)));
                let k = T.findIndex((t, i) => i < T.length - 1 && tc >= t && tc <= T[i + 1]); if (k < 0) k = T.length - 2;
                const hasZ = target.z1 !== undefined && target.z2 !== undefined, zAt = (t) => target.z1 + (target.z2 - target.z1) * t;
                shapes = shapes.filter(s => s !== target);
                for (let j = 0; j < T.length - 1; j++) {
                    if (j === k || (T[j + 1] - T[j]) * L < 1e-9) continue;
                    const nl = { ...target, x1: target.x1 + dx * T[j], y1: target.y1 + dy * T[j], x2: target.x1 + dx * T[j + 1], y2: target.y1 + dy * T[j + 1] };
                    if (hasZ) { nl.z1 = zAt(T[j]); nl.z2 = zAt(T[j + 1]); }
                    shapes.push(nl);
                }
                if (T.length === 2) updateCommandMessageText('AJUSTER : cette droite ne croise rien — supprimée entière (Ctrl+Z pour annuler).');
                saveState(); return;
            }
            if (false) {
                let points = [{x: target.x1, y: target.y1}, {x: target.x2, y: target.y2}, ...intersections];
                let dx = target.x2 - target.x1, dy = target.y2 - target.y1;
                let lineLen2 = dx*dx + dy*dy;
                points.sort((a,b) => { let d1 = (a.x - target.x1)*dx + (a.y - target.y1)*dy, d2 = (b.x - target.x1)*dx + (b.y - target.y1)*dy; return d1 - d2; });
                let mDist = (mx - target.x1)*dx + (my - target.y1)*dy;
                let tol = (10 / camera.zoom) * Math.sqrt(lineLen2);
                for (let i=0; i < points.length - 1; i++) {
                    let d1 = (points[i].x - target.x1)*dx + (points[i].y - target.y1)*dy;
                    let d2 = (points[i+1].x - target.x1)*dx + (points[i+1].y - target.y1)*dy;
                    if (mDist >= d1 - tol && mDist <= d2 + tol) {
                        shapes = shapes.filter(s => s !== target);
                        for (let j=0; j < points.length - 1; j++) {
                            if (i === j) continue;
                            if (Math.hypot(points[j].x - points[j+1].x, points[j].y - points[j+1].y) > 0.1) shapes.push({ ...target, x1: points[j].x, y1: points[j].y, x2: points[j+1].x, y2: points[j+1].y });
                        } saveState(); return;
                    }
                }
            } else if (target.type === 'poly') {
                let segs = [];
                for (let i=0; i < polyEdges(target); i++) { let p1 = target.points[i], p2 = target.points[(i+1)%target.points.length]; segs.push({ type: 'line', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color: target.color, dash: target.dash, width: target.width, layerId: target.layerId }); }
                shapes = shapes.filter(s => s !== target); shapes.push(...segs); trimShapeAt(mx, my);
            } else if (target.type === 'arc') {
                let angles = [target.startAngle, target.endAngle];
                intersections.forEach(p => { let a = Math.atan2(p.y - target.y, p.x - target.x); if (isAngleBetween(a, target.startAngle, target.endAngle)) angles.push(a); });
                const norm = (a, st) => { let da = a - st; while (da < 0) da += 2*Math.PI; while (da >= 2*Math.PI) da -= 2*Math.PI; return da; };
                angles.sort((a,b) => norm(a, target.startAngle) - norm(b, target.startAngle));
                angles = angles.filter((a, idx, arr) => idx === 0 || Math.abs(a - arr[idx-1]) > 0.01);
                let clickAngle = Math.atan2(my - target.y, mx - target.x);
                for (let i = 0; i < angles.length - 1; i++) {
                    if (isAngleBetween(clickAngle, angles[i], angles[i+1])) {
                        shapes = shapes.filter(s => s !== target);
                        for (let j = 0; j < angles.length - 1; j++) {
                            if (i === j) continue;
                            if (Math.abs(norm(angles[j+1], angles[j])) > 0.01) shapes.push({ ...target, startAngle: angles[j], endAngle: angles[j+1] });
                        } saveState(); return;
                    }
                }
            } else if (target.type === 'circle') {
                if (intersections.length < 2) return;
                let angles = [];
                intersections.forEach(p => { let a = Math.atan2(p.y - target.y, p.x - target.x); if (a < 0) a += 2 * Math.PI; angles.push(a); });
                angles.sort((a, b) => a - b);
                angles = angles.filter((a, idx, arr) => idx === 0 || Math.abs(a - arr[idx-1]) > 0.01);
                if (angles.length > 1 && Math.abs((angles[angles.length-1] - angles[0]) - 2*Math.PI) < 0.01) angles.pop();
                if (angles.length < 2) return;
                let clickAngle = Math.atan2(my - target.y, mx - target.x);
                if (clickAngle < 0) clickAngle += 2 * Math.PI;
                const isInsideInterval = (a, st, en) => { if (st < en) return a >= st && a <= en; return a >= st || a <= en; };
                for (let i = 0; i < angles.length; i++) {
                    let st = angles[i], en = angles[(i + 1) % angles.length];
                    if (isInsideInterval(clickAngle, st, en)) {
                        shapes = shapes.filter(s => s !== target);
                        for (let j = 0; j < angles.length; j++) {
                            if (i === j) continue;
                            shapes.push({ type: 'arc', layerId: target.layerId, x: target.x, y: target.y, r: target.r, startAngle: angles[j], endAngle: angles[(j + 1) % angles.length], color: target.color, dash: target.dash, width: target.width });
                        } saveState(); return;
                    }
                }
            }
        }

        // Ajuster une polyligne : on retire le tronçon cliqué entre les deux coupures voisines ; le reste reste en polyligne(s)
        function trimPolyAt(target, mx, my) {
            const closed = !target.open, P = target.points.map(q => ({ ...q })); if (closed) P.push({ ...P[0] });
            const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y)); const Ltot = cum[cum.length - 1]; if (Ltot < 1e-12) return;
            const others = toolVisOthers(target), cuts = [];
            for (let i = 0; i < P.length - 1; i++) { const sl = cum[i + 1] - cum[i]; lineCutParams(P[i], P[i + 1], others).forEach(t => cuts.push(cum[i] + Math.max(0, Math.min(1, t)) * sl)); }
            // une polyligne qui se recoupe elle-même : ses propres croisements coupent aussi (une boucle se retire d'un clic)
            const nS = P.length - 1; if (nS <= 4000) for (let i = 0; i < nS; i++) { const a = P[i], b = P[i + 1], x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), rx = b.x - a.x, ry = b.y - a.y;
                for (let j = i + 2; j < nS; j++) { if (closed && i === 0 && j === nS - 1) continue; const c = P[j], d = P[j + 1]; if (Math.max(c.x, d.x) < x0 || Math.min(c.x, d.x) > x1 || Math.max(c.y, d.y) < y0 || Math.min(c.y, d.y) > y1) continue;
                    const sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) continue; const qx = c.x - a.x, qy = c.y - a.y, t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
                    if (t < 0 || t > 1 || u < 0 || u > 1) continue; cuts.push(cum[i] + t * (cum[i + 1] - cum[i]), cum[j] + u * (cum[j + 1] - cum[j])); } }
            // le clic, projeté sur le tracé
            let sc = 0, bd = Infinity; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; if (!l2) continue; let t = Math.max(0, Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / l2)); const d = Math.hypot(mx - a.x - t * dx, my - a.y - t * dy); if (d < bd) { bd = d; sc = cum[i] + t * Math.sqrt(l2); } }
            const eps = 1e-6 * Ltot, C = cuts.filter(c => c > eps && c < Ltot - eps).sort((a, b) => a - b).filter((c, i, A) => i === 0 || c - A[i - 1] > eps);
            const at = (sv) => { let i = 1; while (i < cum.length - 1 && cum[i] < sv) i++; const a = P[i - 1], b = P[i], sl = cum[i] - cum[i - 1] || 1, t = (sv - cum[i - 1]) / sl; const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; if (hasZ(a.z) && hasZ(b.z)) q.z = a.z + (b.z - a.z) * t; return q; };
            const piece = (s0, s1) => { const out = [at(s0)]; for (let i = 1; i < P.length - 1; i++) if (cum[i] > s0 + eps && cum[i] < s1 - eps) out.push({ ...P[i] }); out.push(at(s1)); return out; };
            const keep = []; const base = Object.assign({}, target); delete base.points; base.open = true; delete base.hatch; delete base.plat;
            if (!closed) { const prev = C.filter(c => c < sc).pop(), next = C.find(c => c > sc);
                if (prev !== undefined) keep.push(piece(0, prev)); if (next !== undefined) keep.push(piece(next, Ltot)); }
            else { if (C.length < 2) { updateCommandMessageText('AJUSTER : il faut au moins deux coupures sur un contour fermé.'); return; }
                let prev = C.filter(c => c < sc).pop(), next = C.find(c => c > sc); if (prev === undefined) prev = C[C.length - 1]; if (next === undefined) next = C[0];
                // le reste va de « next » à « prev » en faisant le tour
                const pts = next < prev ? piece(next, prev) : piece(next, Ltot).concat(piece(0, prev).slice(1)); keep.push(pts); }
            const idx = shapes.indexOf(target); const parts = keep.filter(k => k.length >= 2).map(k => Object.assign(JSON.parse(JSON.stringify(base)), { points: k, open: true }));
            shapes.splice(idx, 1, ...parts); selectedShapes = selectedShapes.filter(x => x !== target);
            updateCommandMessageText(C.length ? 'AJUSTER : tronçon retiré' + (parts.length > 1 ? ' (la polyligne reste en 2 morceaux).' : '.') : 'AJUSTER : cette polyligne ne croise rien — supprimée entière (Ctrl+Z pour annuler).');
            saveState();
        }
        // Ajuster une hachure : la portion cliquée, délimitée par les traits qui la traversent et par son propre contour, est retirée.
        // découpe booléenne de polygones (chargée à la demande, ~30 Ko)
        function loadPolyClip() {
            if (window.polygonClipping) { pcHarden(); return Promise.resolve(); }
            return loadJSFirst([MC_LIB + 'polygon-clipping.umd.min.js', 'https://cdn.jsdelivr.net/npm/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js']).then(() => { pcHarden(); }, () => { throw new Error('outil de découpe indisponible (connexion ?)'); });
        }
        // découpes plus sûres : calcul près de l'origine (loin d'elle, la bibliothèque perd en précision et échoue), puis aux coordonnées d'origine en dernier recours
        function pcHarden() { const PC = window.polygonClipping; if (!PC || PC.__hard) return;
            const first = (g) => { let a = g; while (Array.isArray(a) && Array.isArray(a[0])) a = a[0]; return Array.isArray(a) && typeof a[0] === 'number' ? a : null; };
            const tr = (g, dx, dy) => Array.isArray(g) && typeof g[0] === 'number' ? [g[0] + dx, g[1] + dy] : g.map(x => tr(x, dx, dy));
            const wrap = (f) => (...G) => { const p = G.map(first).find(Boolean); if (!p) return f(...G); const ox = Math.round(p[0] / 1000) * 1000, oy = Math.round(p[1] / 1000) * 1000;
                // essais successifs : près de l'origine, tel quel, puis légèrement décalé (les arrondis tombent autrement)
                const tries = [[-ox, -oy], [0, 0], [-ox + 137.13, -oy + 71.71], [-ox - 53.29, -oy + 211.07]]; let err;
                for (const [dx, dy] of tries) { if (dx === 0 && dy === 0) { try { return f(...G); } catch (e) { err = e; continue; } } try { return tr(f(...G.map(g => tr(g, dx, dy))), -dx, -dy); } catch (e) { err = e; } }
                throw err; };
            window.polygonClipping = { union: wrap(PC.union), intersection: wrap(PC.intersection), xor: wrap(PC.xor), difference: wrap(PC.difference), __hard: true }; }
        async function trimHatchAt(h, mx, my) {
            const extra = []; h.loops.forEach(l => l.forEach((a, i) => { const b = l[(i + 1) % l.length]; extra.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y }); }));
            const R = findClosedRegion(mx, my, extra);
            if (!R || !R.loops || !R.loops[0]) { updateCommandMessageText('AJUSTER : aucune portion fermée de hachure sous le clic.'); return; }
            try { await loadPolyClip(); } catch (e) { updateCommandMessageText('AJUSTER : ' + e.message); return; }
            const PC = window.polygonClipping, ring = (l) => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; };
            const area = (l) => { let a = 0; for (let i = 0; i < l.length; i++) { const j = (i + 1) % l.length; a += l[i][0] * l[j][1] - l[j][0] * l[i][1]; } return Math.abs(a / 2); };
            let res;
            try {
                let G = [[ring(h.loops[0])]]; for (let k = 1; k < h.loops.length; k++) G = PC.xor(G, [[ring(h.loops[k])]]);   // pair / impair, comme le dessin
                res = PC.difference(G, [[ring(R.loops[0])]]);
            } catch (e) { updateCommandMessageText('AJUSTER : découpe impossible ici (' + e.message + ').'); return; }
            const aH = hatchArea(h) || 1;
            res = res.filter(poly => area(poly[0]) > aH * 1e-6);
            const idx = shapes.indexOf(h); if (idx < 0) return;
            const parts = res.map(poly => { const nh = JSON.parse(JSON.stringify(h)); nh.loops = poly.map(r => r.slice(0, -1).map(([x, y]) => ({ x, y }))); return nh; });
            shapes.splice(idx, 1, ...parts);
            if (selectedShapes.includes(h)) selectedShapes = selectedShapes.filter(x => x !== h).concat(parts);
            updateCommandMessageText(parts.length ? 'AJUSTER : portion de hachure retirée' + (parts.length > 1 ? ' (reste en ' + parts.length + ' morceaux).' : '.') : 'AJUSTER : hachure entièrement retirée (aucun trait ne la recoupe ici).');
            saveState(); draw();
        }
        function extendShapeAt(mx, my) {
            const target = toolPick(mx, my, ['line', 'poly', 'arc']); if (!target) { updateCommandMessageText('PROLONGER : cliquez près du bout d\'une droite, d\'une polyligne ouverte ou d\'un arc.'); return; }
            const others = toolVisOthers(target);
            if (target.type === 'arc') {   // un arc se prolonge sur son cercle jusqu'au prochain objet
                const a0 = target.startAngle, a1 = target.endAngle, am = Math.atan2(my - target.y, mx - target.x), dA = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
                const atEnd = dA(am, a1) < dA(am, a0); let best = null;
                others.forEach(o => { const C = { type: 'circle', x: target.x, y: target.y, r: target.r }; getInterPoints(C, o).forEach(p => { const a = Math.atan2(p.y - target.y, p.x - target.x); let d = atEnd ? a - a1 : a0 - a; while (d <= 1e-6) d += 2 * Math.PI; if (!best || d < best.d) best = { d, a }; }); });
                if (!best) { updateCommandMessageText('PROLONGER : rien à atteindre sur le cercle de cet arc.'); return; }
                if (atEnd) target.endAngle = best.a; else target.startAngle = best.a; saveState(); updateCommandMessageText('PROLONGER : arc prolongé.'); return;
            }
            let E, Bp, set;
            if (target.type === 'line') { const d1 = Math.hypot(mx - target.x1, my - target.y1), d2 = Math.hypot(mx - target.x2, my - target.y2), e2 = d2 < d1;
                E = e2 ? { x: target.x2, y: target.y2 } : { x: target.x1, y: target.y1 }; Bp = e2 ? { x: target.x1, y: target.y1 } : { x: target.x2, y: target.y2 };
                set = (q) => { if (e2) { target.x2 = q.x; target.y2 = q.y; } else { target.x1 = q.x; target.y1 = q.y; } }; }
            else { if (!target.open || target.points.length < 2) { updateCommandMessageText('PROLONGER : une polyligne fermée ne se prolonge pas.'); return; }
                const P = target.points, n = P.length, e2 = Math.hypot(mx - P[n - 1].x, my - P[n - 1].y) < Math.hypot(mx - P[0].x, my - P[0].y);
                E = e2 ? P[n - 1] : P[0]; Bp = e2 ? P[n - 2] : P[1]; set = (q) => { E.x = q.x; E.y = q.y; }; }
            const L = Math.hypot(E.x - Bp.x, E.y - Bp.y); if (L < 1e-12) return;
            const ts = lineCutParams(Bp, E, others, true).filter(t => t > 1 + 1e-7);   // au-delà du bout, dans le prolongement
            if (!ts.length) { updateCommandMessageText('PROLONGER : aucun objet dans le prolongement de ce bout.'); return; }
            const t = Math.min(...ts); set({ x: Bp.x + (E.x - Bp.x) * t, y: Bp.y + (E.y - Bp.y) * t }); saveState();
            updateCommandMessageText('PROLONGER : prolongé de ' + calculateRealDistance(L * (t - 1)) + '. Cliquez un autre bout, ou Échap.');
        }

        // --- COTATION ANGULAIRE ---
        // Dessine un arc de cotation entre deux bras depuis un sommet, avec l'angle en texte
        function drawAngleDim(targetCtx, s, sel, isPrinting, lineScale) {
            if (lineScale === undefined) lineScale = camera.zoom;
            const { vertex, p1, p2 } = s;
            const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
            const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);

            // Calcul de l'angle entre les deux bras (toujours positif, ≤ 180°)
            let angleDiff = a2 - a1;
            while (angleDiff < 0) angleDiff += 2 * Math.PI;
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            const angleDeg = (angleDiff * 180 / Math.PI).toFixed(1);

            // Rayon de l'arc de cotation = 1/3 de la distance au point le plus court
            const r1 = Math.hypot(p1.x - vertex.x, p1.y - vertex.y);
            const r2 = Math.hypot(p2.x - vertex.x, p2.y - vertex.y);
            const arcR = Math.min(r1, r2) * 0.5;

            const col = effectiveColor(s, isPrinting);
            targetCtx.strokeStyle = sel ? '#ec4899' : col;
            targetCtx.lineWidth = (sel ? 3 : 1.5) / lineScale;
            targetCtx.setLineDash([]);

            // Bras de cotation (lignes depuis le sommet)
            targetCtx.globalAlpha = 0.6;
            targetCtx.beginPath();
            targetCtx.moveTo(vertex.x, vertex.y);
            targetCtx.lineTo(p1.x, p1.y);
            targetCtx.moveTo(vertex.x, vertex.y);
            targetCtx.lineTo(p2.x, p2.y);
            targetCtx.stroke();
            targetCtx.globalAlpha = 1.0;

            // Arc de cotation
            let startA = a1, endA = a2;
            let span = endA - startA;
            while (span < 0) span += 2 * Math.PI;
            if (span > Math.PI) { let tmp = startA; startA = endA; endA = tmp; }

            targetCtx.beginPath();
            targetCtx.arc(vertex.x, vertex.y, arcR, startA, endA);
            targetCtx.stroke();

            // Flèches aux extrémités de l'arc
            const arrowSize = 6 / lineScale;
            [startA, endA].forEach((a, idx) => {
                const tangA = idx === 0 ? a - Math.PI / 2 : a + Math.PI / 2;
                const ax = vertex.x + Math.cos(a) * arcR;
                const ay = vertex.y + Math.sin(a) * arcR;
                targetCtx.fillStyle = sel ? '#ec4899' : col; targetCtx.strokeStyle = sel ? '#ec4899' : col;
                dimTermAt(targetCtx, { x: ax, y: ay }, { x: -Math.cos(tangA), y: -Math.sin(tangA) }, lineScale);   // extrémités selon la mise en forme des cotes
            });

            // Texte de l'angle au milieu de l'arc — stocke aussi le worldX/Y pour findShapeAt
            const midA = (startA + endA) / 2;
            const textX = vertex.x + Math.cos(midA) * (arcR + 15 / lineScale);
            const textY = vertex.y + Math.sin(midA) * (arcR + 15 / lineScale);
            // On stocke les coordonnées du label dans la shape pour la sélection
            s._labelX = textX; s._labelY = textY; s._angleDeg = angleDeg;
            dimensionTextsToDraw.push({ text: dimTxt(s, angleDeg + '°'), worldX: textX, worldY: textY, color: col, layerId: s.layerId });
        }

        // --- GESTION DES OUTILS ET MODES ---
        // Zoom caméra correspondant à une échelle d'impression 1:1, calculé pour être
