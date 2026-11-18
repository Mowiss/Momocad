        // =====================================================================
        // DÉTECTION DE ZONE FERMÉE (hachures par point intérieur, façon AutoCAD)
        // Les traits visibles sont découpés à chaque croisement pour former un
        // réseau ; on fait le tour de la plus petite zone qui contient le clic.
        // Les formes isolées à l'intérieur deviennent des îlots (trous).
        // =====================================================================
        function hatchBoundarySegments(tol) {
            const segs = []; let curveId = 0;
            const add = (ax, ay, bx, by, cid) => { if (Math.hypot(bx - ax, by - ay) > 1e-9) segs.push({ ax, ay, bx, by, cid }); };
            for (const s of shapes) {
                const layer = layers.find(l => l.id === (s.layerId || 'layer-0'));
                if (layer && !layer.visible) continue;
                if (s.type === 'line') add(s.x1, s.y1, s.x2, s.y2);
                else if (s.type === 'poly' && s.points && s.points.length >= 2) {
                    const n = s.points.length;
                    for (let i = 0; i < (n >= 3 && !s.open ? n : n - 1); i++) { const a = s.points[i], b = s.points[(i + 1) % n]; add(a.x, a.y, b.x, b.y); }
                } else if (s.type === 'circle' || s.type === 'arc') {
                    // cercles et arcs découpés en petits segments (écart < 0,05 % du rayon)
                    let a0 = 0, sweep = 2 * Math.PI;
                    if (s.type === 'arc') {
                        a0 = s.startAngle; let d = s.endAngle - s.startAngle;
                        if (s.anticlockwise) { while (d >= 0) d -= 2 * Math.PI; while (d < -2 * Math.PI) d += 2 * Math.PI; }
                        else { while (d <= 0) d += 2 * Math.PI; while (d > 2 * Math.PI) d -= 2 * Math.PI; }
                        sweep = d;
                    }
                    // segments assez longs devant la tolérance pour ne pas être fusionnés entre eux
                    const arcLen = Math.abs(sweep) * s.r;
                    const n = Math.max(8, Math.min(Math.ceil(Math.abs(sweep) / (2 * Math.PI) * 128), Math.floor(arcLen / (1.5 * tol))));
                    const cid = ++curveId;
                    let px = s.x + s.r * Math.cos(a0), py = s.y + s.r * Math.sin(a0);
                    for (let k = 1; k <= n; k++) {
                        const a = a0 + sweep * k / n, qx = s.x + s.r * Math.cos(a), qy = s.y + s.r * Math.sin(a);
                        add(px, py, qx, qy, cid); px = qx; py = qy;
                    }
                }
            }
            return segs;
        }

        function findClosedRegion(px, py, extraSegs) {
            // tolérance de fermeture : ~1,5 px à l'écran (bornée), comme ce que l'œil voit "fermé"
            const tol = Math.min(Math.max(1.5 / camera.zoom, 0.01), mmToWorld(1));
            const segs = hatchBoundarySegments(tol).concat((extraSegs || []).map(q => Object.assign({}, q)));
            if (segs.length < 2) return null;

            // ---- 1) points de coupe sur chaque segment (croisements, jonctions en T, recouvrements) ----
            segs.forEach(s => {
                s.len = Math.hypot(s.bx - s.ax, s.by - s.ay);
                s.cuts = [{ t: 0, x: s.ax, y: s.ay }, { t: 1, x: s.bx, y: s.by }];
                s.minX = Math.min(s.ax, s.bx) - tol; s.maxX = Math.max(s.ax, s.bx) + tol;
                s.minY = Math.min(s.ay, s.by) - tol; s.maxY = Math.max(s.ay, s.by) + tol;
            });
            const order = segs.slice().sort((a, b) => a.minX - b.minX);
            const projT = (s, x, y) => ((x - s.ax) * (s.bx - s.ax) + (y - s.ay) * (s.by - s.ay)) / (s.len * s.len);
            for (let i = 0; i < order.length; i++) {
                const A = order[i];
                for (let j = i + 1; j < order.length && order[j].minX <= A.maxX; j++) {
                    const B = order[j];
                    if (B.minY > A.maxY || B.maxY < A.minY) continue;
                    if (A.cid && A.cid === B.cid) continue;   // un cercle/arc ne se recoupe pas lui-même
                    const rx = A.bx - A.ax, ry = A.by - A.ay, sx = B.bx - B.ax, sy = B.by - B.ay;
                    const den = rx * sy - ry * sx;
                    const qx = B.ax - A.ax, qy = B.ay - A.ay;
                    if (Math.abs(den) < 1e-12 * A.len * B.len) {
                        // parallèles : si colinéaires, chaque extrémité de l'un coupe l'autre (traits superposés)
                        if (Math.abs(qx * ry - qy * rx) / A.len > tol) continue;
                        for (const [S1, S2] of [[A, B], [B, A]]) {
                            for (const [x, y] of [[S2.ax, S2.ay], [S2.bx, S2.by]]) {
                                const t = projT(S1, x, y);
                                if (t > 0 && t < 1) S1.cuts.push({ t, x, y });
                            }
                        }
                        continue;
                    }
                    const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
                    const et = tol / A.len, eu = tol / B.len;
                    if (t < -et || t > 1 + et || u < -eu || u > 1 + eu) continue;
                    const X = A.ax + rx * t, Y = A.ay + ry * t;
                    if (t < 0 || t > 1 || u < 0 || u > 1) {
                        // petit écart : la jonction doit être à moins de la tolérance de chaque trait
                        const tc = Math.min(1, Math.max(0, t)), uc = Math.min(1, Math.max(0, u));
                        if (Math.hypot(A.ax + rx * tc - X, A.ay + ry * tc - Y) > tol) continue;
                        if (Math.hypot(B.ax + sx * uc - X, B.ay + sy * uc - Y) > tol) continue;
                    }
                    A.cuts.push({ t: Math.min(1, Math.max(0, t)), x: X, y: Y });
                    B.cuts.push({ t: Math.min(1, Math.max(0, u)), x: X, y: Y });
                }
            }

            // ---- 2) nœuds (points fusionnés à la tolérance près) et arêtes ----
            const nodes = [], grid = new Map();
            const cell = (v) => Math.floor(v / tol);
            const nodeId = (x, y) => {
                const cx = cell(x), cy = cell(y);
                for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                    const list = grid.get((cx + dx) + ',' + (cy + dy));
                    if (list) for (const id of list) if (Math.hypot(nodes[id].x - x, nodes[id].y - y) <= tol) return id;
                }
                const id = nodes.length; nodes.push({ x, y });
                const k = cx + ',' + cy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(id);
                return id;
            };
            const adj = new Map(); const edgeSet = new Set();
            const link = (u, v) => {
                if (u === v) return;
                const k = u < v ? u + '_' + v : v + '_' + u;
                if (edgeSet.has(k)) return; edgeSet.add(k);
                if (!adj.has(u)) adj.set(u, new Set()); if (!adj.has(v)) adj.set(v, new Set());
                adj.get(u).add(v); adj.get(v).add(u);
            };
            for (const s of segs) {
                s.cuts.sort((a, b) => a.t - b.t);
                let prev = nodeId(s.cuts[0].x, s.cuts[0].y);
                for (let k = 1; k < s.cuts.length; k++) { const id = nodeId(s.cuts[k].x, s.cuts[k].y); link(prev, id); prev = id; }
            }

            // ---- 3) suppression des bouts qui dépassent (ils ne ferment rien) ----
            const queue = [];
            adj.forEach((set, id) => { if (set.size <= 1) queue.push(id); });
            while (queue.length) {
                const id = queue.pop(); const set = adj.get(id); if (!set) continue;
                for (const nb of set) { const s2 = adj.get(nb); s2.delete(id); if (s2.size <= 1) queue.push(nb); }
                adj.delete(id);
            }
            if (adj.size === 0) return null;

            // ---- 4) composantes connexes ----
            const comp = new Map(); let nComp = 0;
            adj.forEach((_, id) => {
                if (comp.has(id)) return;
                const stack = [id]; comp.set(id, nComp);
                while (stack.length) { const n = stack.pop(); for (const nb of adj.get(n)) if (!comp.has(nb)) { comp.set(nb, nComp); stack.push(nb); } }
                nComp++;
            });

            // ---- 5) tour d'une face : on garde la zone à gauche, en tournant au plus serré ----
            const walk = (a, b) => {
                const loop = []; const startA = a, startB = b; let guard = 0;
                do {
                    loop.push({ x: nodes[a].x, y: nodes[a].y });
                    const back = Math.atan2(nodes[a].y - nodes[b].y, nodes[a].x - nodes[b].x);
                    let best = -1, bestD = Infinity;
                    for (const w of adj.get(b)) {
                        let d = back - Math.atan2(nodes[w].y - nodes[b].y, nodes[w].x - nodes[b].x);
                        while (d <= 1e-12) d += 2 * Math.PI;
                        while (d > 2 * Math.PI + 1e-12) d -= 2 * Math.PI;
                        if (d < bestD) { bestD = d; best = w; }
                    }
                    a = b; b = best;
                    if (++guard > edgeSet.size * 2 + 10) return null;
                } while (!(a === startA && b === startB));
                return loop;
            };
            // rayon horizontal vers la droite : première arête rencontrée (hors composantes exclues)
            const rayHit = (qx, qy, allowed) => {
                let best = null, bestX = Infinity;
                adj.forEach((set, u) => {
                    if (!allowed(comp.get(u))) return;
                    for (const v of set) {
                        if (v < u) continue;
                        const A = nodes[u], B = nodes[v];
                        if ((A.y > qy) === (B.y > qy)) continue;
                        const x = A.x + (qy - A.y) * (B.x - A.x) / (B.y - A.y);
                        if (x > qx && x < bestX) { bestX = x; best = [u, v]; }
                    }
                });
                if (!best) return null;
                const [u, v] = best, A = nodes[u], B = nodes[v];
                // orienter l'arête pour que le point de départ soit à sa gauche
                return ((B.x - A.x) * (qy - A.y) - (B.y - A.y) * (qx - A.x)) > 0 ? [u, v] : [v, u];
            };

            const qy = py + 1e-7 * (1 + Math.abs(py));
            const excluded = new Set(); let outer = null, outerComp = -1;
            for (let guard = 0; guard <= nComp; guard++) {
                const h = rayHit(px, qy, c => !excluded.has(c));
                if (!h) return null;
                const loop = walk(h[0], h[1]);
                if (!loop) return null;
                if (pointInPolygon(px, py, loop)) { outer = loop; outerComp = comp.get(h[0]); break; }
                excluded.add(comp.get(h[0]));   // le clic est à l'extérieur de ce groupe de traits
            }
            if (!outer) return null;

            // ---- 6) îlots : groupes de traits entièrement à l'intérieur de la zone ----
            const loops = [outer];
            for (let c = 0; c < nComp; c++) {
                if (c === outerComp) continue;
                let anyNode = -1, minNode = -1;
                adj.forEach((_, id) => {
                    if (comp.get(id) !== c) return;
                    if (anyNode < 0) anyNode = id;
                    if (minNode < 0 || nodes[id].x < nodes[minNode].x) minNode = id;
                });
                if (anyNode < 0 || !pointInPolygon(nodes[anyNode].x, nodes[anyNode].y, outer)) continue;
                const ox = nodes[minNode].x - 10 * tol, oy = nodes[minNode].y + 1e-7 * (1 + Math.abs(nodes[minNode].y));
                const h = rayHit(ox, oy, cc => cc === c);
                if (!h) continue;
                const loop = walk(h[0], h[1]);
                if (loop && loop.length >= 3) loops.push(loop);
            }
            return { loops };
        }

        // Surface lisible : m² pour les grandes surfaces, cm² ou mm² pour les petites pièces
        function fmtSurface(a) {
            const mm2 = currentUnit === 'mm' ? a : currentUnit === 'cm' ? a * 100 : a * 1e6;
            const nf = (v, d) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
            if (mm2 >= 1e5) return nf(mm2 / 1e6, 2) + ' m²';
            if (mm2 >= 100) return nf(mm2 / 100, 1) + ' cm²';
            return nf(mm2, 1) + ' mm²';
        }
        // Point dans une hachure : règle pair/impair sur tous ses contours (les îlots sont des trous)
        function pointInHatch(s, x, y) {
            let inside = false;
            for (const l of s.loops) if (pointInPolygon(x, y, l)) inside = !inside;
            return inside;
        }
        // Surface d'une hachure (contour extérieur moins les îlots, en tenant compte des imbrications)
        function hatchArea(s) {
            const area = (l) => { let a = 0; for (let i = 0; i < l.length; i++) { const j = (i + 1) % l.length; a += l[i].x * l[j].y - l[j].x * l[i].y; } return Math.abs(a / 2); };
            let total = 0;
            s.loops.forEach((l, i) => {
                let depth = 0;
                s.loops.forEach((m, k) => { if (k !== i && pointInPolygon(l[0].x, l[0].y, m)) depth++; });
                total += (depth % 2 ? -1 : 1) * area(l);
            });
            return Math.abs(total);
        }

        function isAngleBetween(target, start, end) {
            const PI2 = Math.PI * 2; let t = (target % PI2 + PI2) % PI2, s = (start % PI2 + PI2) % PI2, e = (end % PI2 + PI2) % PI2;
            if (s < e) return t >= s && t <= e; return t >= s || t <= e;
        }

        function getIntersectionLines(x1, y1, x2, y2, x3, y3, x4, y4) {
            let det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (det === 0) return null;
            let t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / det;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }; return null;
        }

        function getIntersectionLineCircle(x1, y1, x2, y2, cx, cy, r) {
            let dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
            let a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = (fx * fx + fy * fy) - r * r;
            let disc = b * b - 4 * a * c; let res = [];
            if (disc >= 0) { disc = Math.sqrt(disc); let t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a); if (t1 >= 0 && t1 <= 1) res.push({ x: x1 + t1 * dx, y: y1 + t1 * dy }); if (t2 >= 0 && t2 <= 1) res.push({ x: x1 + t2 * dx, y: y1 + t2 * dy }); } return res;
        }

        function getIntersectionCircles(c1x, c1y, r1, c2x, c2y, r2) {
            let dx = c2x - c1x, dy = c2y - c1y, d = Math.hypot(dx, dy); if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
            let a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
            let x2 = c1x + a * (dx / d), y2 = c1y + a * (dy / d);
            return [{ x: x2 + h * (dy / d), y: y2 - h * (dx / d) }, { x: x2 - h * (dy / d), y: y2 + h * (dx / d) }];
        }

        // la forme touche-t-elle le rectangle R ? (un sommet dedans, ou un de ses traits qui le traverse)
        function shapeTouchesRect(s, R) {
            const inR = (q) => q.x >= R.x0 && q.x <= R.x1 && q.y >= R.y0 && q.y <= R.y1;
            const segX = (a, b) => { if (inR(a) || inR(b)) return true; const E = [[R.x0, R.y0, R.x1, R.y0], [R.x1, R.y0, R.x1, R.y1], [R.x1, R.y1, R.x0, R.y1], [R.x0, R.y1, R.x0, R.y0]];
                return E.some(e => getIntersectionLines(a.x, a.y, b.x, b.y, e[0], e[1], e[2], e[3])); };
            const run = (P, closed) => { if (P.length === 1) return inR(P[0]); for (let i = 0; i < P.length - (closed ? 0 : 1); i++) if (segX(P[i], P[(i + 1) % P.length])) return true; return false; };
            const arcPts = (x, y, r, a0, a1) => { let d = a1 - a0; while (d <= 0) d += 2 * Math.PI; const n = Math.max(8, Math.ceil(d / (Math.PI / 24))); return Array.from({ length: n + 1 }, (_, i) => ({ x: x + r * Math.cos(a0 + d * i / n), y: y + r * Math.sin(a0 + d * i / n) })); };
            if (s.type === 'line' || s.type === 'slope') return run([{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }], false);
            if (s.type === 'dim') { const g = dimGeom(s); return g ? run([g.p1, g.c1, g.c2, g.p2], false) : false; }
            if (s.type === 'poly') return run(s.points, !s.open);
            if (s.type === 'circle' || s.type === 'basemap') return run(arcPts(s.x, s.y, s.r, 0, 2 * Math.PI), true);
            if (s.type === 'arc') return run(arcPts(s.x, s.y, s.r, s.startAngle, s.endAngle), false);
            if (s.type === 'hatch') return (s.loops || []).some(L => run(L, true));
            if (s.type === 'point' || s.type === 'text') return inR(s);
            if (s.type === 'dim-angle') return run([s.p1, s.vertex, s.p2], false);
            if (s.type === 'dimr') return run([{ x: s.x, y: s.y }, { x: s.lx, y: s.ly }], false);
            const K = (typeof t2KeyPts === 'function') ? t2KeyPts(s) : []; return K.length ? run(K, false) : false;
        }
        function getSegments(s) {
            if (s.type === 'line' || s.type === 'dim') return [{ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }];
            if (s.type === 'poly') { let segs = []; for (let i = 0; i < polyEdges(s); i++) { let p1 = s.points[i], p2 = s.points[(i + 1) % s.points.length]; segs.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }); } return segs; }
            return [];
        }

        function getInterPoints(s1, s2) {
            let pts = [], segs1 = getSegments(s1), segs2 = getSegments(s2);
            if (segs1.length > 0 && segs2.length > 0) { segs1.forEach(a => segs2.forEach(b => { let p = getIntersectionLines(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2); if (p) pts.push(p); })); }
            else if (segs1.length > 0 && (s2.type === 'circle' || s2.type === 'arc')) { segs1.forEach(a => { let res = getIntersectionLineCircle(a.x1, a.y1, a.x2, a.y2, s2.x, s2.y, s2.r); if (s2.type === 'arc') res = res.filter(p => isAngleBetween(Math.atan2(p.y - s2.y, p.x - s2.x), s2.startAngle, s2.endAngle)); pts.push(...res); }); }
            else if (segs2.length > 0 && (s1.type === 'circle' || s1.type === 'arc')) { segs2.forEach(a => { let res = getIntersectionLineCircle(a.x1, a.y1, a.x2, a.y2, s1.x, s1.y, s1.r); if (s1.type === 'arc') res = res.filter(p => isAngleBetween(Math.atan2(p.y - s1.y, p.x - s1.x), s1.startAngle, s1.endAngle)); pts.push(...res); }); }
            else if ((s1.type === 'circle' || s1.type === 'arc') && (s2.type === 'circle' || s2.type === 'arc')) { let res = getIntersectionCircles(s1.x, s1.y, s1.r, s2.x, s2.y, s2.r); if (s1.type === 'arc') res = res.filter(p => isAngleBetween(Math.atan2(p.y - s1.y, p.x - s1.x), s1.startAngle, s1.endAngle)); if (s2.type === 'arc') res = res.filter(p => isAngleBetween(Math.atan2(p.y - s2.y, p.x - s2.x), s2.startAngle, s2.endAngle)); pts.push(...res); }
            return pts;
        }

        // Intersections de tout le dessin visible, par balayage (tri sur X) : rapide même avec des centaines de milliers de segments.
        // Garde-fous : 200 000 points et ~0,4 s au plus (au-delà, les intersections restantes ne sont pas proposées).
        function getAllIntersections() {
            const items = [];
            shapes.forEach((s, si) => {
                const l = layers.find(lx => lx.id === (s.layerId || 'layer-0')); if (!l || !l.visible) return;
                if (s.type === 'circle' || s.type === 'arc') { items.push({ sh: s, si, k: -1, minX: s.x - s.r, maxX: s.x + s.r, minY: s.y - s.r, maxY: s.y + s.r }); return; }
                getSegments(s).forEach((g, k) => items.push({ sh: { type: 'line', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 }, si, k, n: s.points ? s.points.length : 0, minX: Math.min(g.x1, g.x2), maxX: Math.max(g.x1, g.x2), minY: Math.min(g.y1, g.y2), maxY: Math.max(g.y1, g.y2) }));
            });
            items.sort((a, b) => a.minX - b.minX);
            const pts = [], t0 = performance.now();
            outer: for (let i = 0; i < items.length; i++) {
                const A = items[i];
                for (let j = i + 1; j < items.length && items[j].minX <= A.maxX; j++) {
                    const B = items[j]; if (B.minY > A.maxY || B.maxY < A.minY) continue;
                    if (A.si === B.si && A.k >= 0 && B.k >= 0 && (Math.abs(A.k - B.k) === 1 || (A.n && Math.abs(A.k - B.k) === A.n - 1))) continue;   // segments voisins d'une même polyligne
                    const r = getInterPoints(A.sh, B.sh); for (let q = 0; q < r.length; q++) pts.push(r[q]);
                    if (pts.length > 200000) break outer;
                }
                if ((i & 1023) === 0 && performance.now() - t0 > 400) break;
            }
            return pts;
        }

        function applyRotationToShape(s, cx, cy, angleRad) {
            const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
            const rot = (x, y) => ({ x: (cos * (x - cx)) - (sin * (y - cy)) + cx, y: (sin * (x - cx)) + (cos * (y - cy)) + cy });
            xPtsOf(s).forEach(h => h.forEach(p => { const q = rot(p.x, p.y); p.x = q.x; p.y = q.y; }));
            if (s.type === 'line' || s.type === 'slope') { let p1 = rot(s.x1, s.y1), p2 = rot(s.x2, s.y2); s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y; }
            else if (s.type === 'circle' || s.type === 'point') { let p = rot(s.x, s.y); s.x = p.x; s.y = p.y; }
            else if (s.type === 'cline') { let p = rot(s.x, s.y); s.x = p.x; s.y = p.y; const ux = cos * s.ux - sin * s.uy, uy = sin * s.ux + cos * s.uy; s.ux = ux; s.uy = uy; }
            else if (s.type === 'basemap' || s.type === 'bgimage' || s.type === 'pdfvec' || s.type === 'mesh') { let p = rot(s.x, s.y); s.x = p.x; s.y = p.y; s.rot = (s.rot || 0) + angleRad; }
            else if (s.type === 'arc') { let p = rot(s.x, s.y); s.x = p.x; s.y = p.y; s.startAngle += angleRad; s.endAngle += angleRad; }
            else if (s.type === 'poly') { s.points.forEach(pt => { let p = rot(pt.x, pt.y); pt.x = p.x; pt.y = p.y; }); }
            else if (s.type === 'text') { let p = rot(s.x, s.y); s.x = p.x; s.y = p.y; s.angle = (s.angle || 0) + angleRad; }
            else if (s.type === 'dim') {
                if (s.orient) {   // cote ortho : on garde H/V pour les quarts de tour, sinon elle devient une cote libre sur ses points de ligne
                    const q = Math.round(angleRad / (Math.PI / 2)), isQuarter = Math.abs(angleRad - q * Math.PI / 2) < 1e-6;
                    if (isQuarter) { if (Math.abs(q) % 2 === 1) s.orient = s.orient === 'h' ? 'v' : 'h'; }
                    else { const g = dimGeom(s); if (g) { s.x1 = g.c1.x; s.y1 = g.c1.y; s.x2 = g.c2.x; s.y2 = g.c2.y; s.ox = g.mid.x; s.oy = g.mid.y; } delete s.orient; }
                }
                let p1 = rot(s.x1, s.y1), p2 = rot(s.x2, s.y2), po = rot(s.ox, s.oy); s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y; s.ox = po.x; s.oy = po.y; }
            else if (s.type === 'dim-angle') { let pv = rot(s.vertex.x, s.vertex.y), pp1 = rot(s.p1.x, s.p1.y), pp2 = rot(s.p2.x, s.p2.y); s.vertex = pv; s.p1 = pp1; s.p2 = pp2; }
            else if (s.type === 'hatch') { s.loops.forEach(l => l.forEach(pt => { let p = rot(pt.x, pt.y); pt.x = p.x; pt.y = p.y; })); s.hatchAngle = ((s.hatchAngle !== undefined) ? s.hatchAngle : 45) + angleRad * 180 / Math.PI; }
            else if (s.type === 'detail') { let pt = rot(s.tx, s.ty), pl = rot(s.lx, s.ly); s.tx = pt.x; s.ty = pt.y; s.lx = pl.x; s.ly = pl.y; }
            else if (s.type === 'dimr') { [['x', 'y'], ['ax', 'ay'], ['lx', 'ly']].forEach(([kx, ky]) => { const q = rot(s[kx], s[ky]); s[kx] = q.x; s[ky] = q.y; }); }
        }

        // Mise à l'échelle d'une forme autour d'un centre (cx,cy) par un facteur.
        function applyScaleToShape(s, cx, cy, f) {
            const sc = (x, y) => ({ x: cx + (x - cx) * f, y: cy + (y - cy) * f });
            xPtsOf(s).forEach(h => h.forEach(p => { const q = sc(p.x, p.y); p.x = q.x; p.y = q.y; }));
            if (s.type === 'line' || s.type === 'slope') { let p1 = sc(s.x1, s.y1), p2 = sc(s.x2, s.y2); s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y; }
            else if (s.type === 'circle' || s.type === 'basemap') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; s.r *= f; }
            else if (s.type === 'bgimage' || s.type === 'pdfvec') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; s.w *= Math.abs(f); s.h *= Math.abs(f); }
            else if (s.type === 'mesh') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; s.sc = (s.sc || 1) * Math.abs(f); }
            else if (s.type === 'point' || s.type === 'cline') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; }
            else if (s.type === 'arc') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; s.r *= f; }
            else if (s.type === 'poly') { s.points.forEach(pt => { let p = sc(pt.x, pt.y); pt.x = p.x; pt.y = p.y; }); }
            else if (s.type === 'text') { let p = sc(s.x, s.y); s.x = p.x; s.y = p.y; s.size = (s.size || 20) * f; }
            else if (s.type === 'dim') { let p1 = sc(s.x1, s.y1), p2 = sc(s.x2, s.y2), po = sc(s.ox, s.oy); s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y; s.ox = po.x; s.oy = po.y; }
            else if (s.type === 'dim-angle') { let pv = sc(s.vertex.x, s.vertex.y), pp1 = sc(s.p1.x, s.p1.y), pp2 = sc(s.p2.x, s.p2.y); s.vertex = pv; s.p1 = pp1; s.p2 = pp2; }
            else if (s.type === 'detail') { let pt = sc(s.tx, s.ty), pl = sc(s.lx, s.ly); s.tx = pt.x; s.ty = pt.y; s.lx = pl.x; s.ly = pl.y; }
            else if (s.type === 'dimr') { [['x', 'y'], ['ax', 'ay'], ['lx', 'ly']].forEach(([kx, ky]) => { const q = sc(s[kx], s[ky]); s[kx] = q.x; s[ky] = q.y; }); }
            else if (s.type === 'hatch') { s.loops.forEach(l => l.forEach(pt => { let p = sc(pt.x, pt.y); pt.x = p.x; pt.y = p.y; })); }
        }

        // --- CORE GEOMETRY & SNAP ---
        function screenToWorld(sx, sy) { return { x: (sx - camera.x) / camera.zoom, y: (sy - camera.y) / camera.zoom }; }
        function worldToScreen(wx, wy) { return { x: wx * camera.zoom + camera.x, y: wy * camera.zoom + camera.y }; }
        function calculateRealDistance(pxDist) {
            return fmtLen((pxDist/GRID_SIZE)*unitsPerSquare);
        }

        function getShapesBoundingBox(shapeArray) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (!shapeArray || shapeArray.length === 0) return null;
            shapeArray.forEach(s => {
                if (s.type === 'line' || s.type === 'dim' || s.type === 'slope') { minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2); }
                else if (s.type === 'mesh') { meshCorners(s).forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }
                else if (s.type === 'pdfvec') { vecCorners(s).forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }
                else if (s.type === 'bgimage') { bgCorners(s).forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }
                else if (s.type === 'circle' || s.type === 'arc' || s.type === 'basemap') { minX = Math.min(minX, s.x - s.r); maxX = Math.max(maxX, s.x + s.r); minY = Math.min(minY, s.y - s.r); maxY = Math.max(maxY, s.y + s.r); }
                else if (s.type === 'poly') { s.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }
                else if (s.type === 'hatch') { s.loops[0].forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }
                else if (s.type === 'point') { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
                else if (s.type === 'dimr') { [[s.x, s.y], [s.ax, s.ay], [s.lx, s.ly]].forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }); }
                else if (s.type === 'text') { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + 100); minY = Math.min(minY, s.y - s.size); maxY = Math.max(maxY, s.y); }
            });
            if (minX === Infinity) return null;
            return { minX, minY, maxX, maxY, centerX: (minX+maxX)/2, centerY: (minY+maxY)/2 };
        }

