        // PAROIS MODULABLES : une paroi fusionnée avec d'autres (plusieurs tracés dans un même bloc) se retouche tracé par tracé,
        //      et tirer un tronçon fait suivre les parois qui viennent buter dessus : la pièce s'agrandit ou se réduit d'un geste.
        const WALL_PATHS_MEMO = new Map();
        /* un tronçon de paroi (quadrilatère) : son axe (milieux des deux bouts), son épaisseur ; null si ce n'est pas un tronçon droit */
        function wallQuadSeg(h) { if (!h.loops || h.loops.length !== 1 || h.loops[0].length !== 4) return null; const L = h.loops[0], len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y), e = [0, 1, 2, 3].map(k => len(L[k], L[(k + 1) % 4]));
            const k = e[0] + e[2] >= e[1] + e[3] ? 1 : 0, l1 = [L[(k + 1) % 4], L[(k + 2) % 4]], l2 = [L[(k + 3) % 4], L[k]], ud = (s) => { const d = len(s[0], s[1]) || 1; return { x: (s[1].x - s[0].x) / d, y: (s[1].y - s[0].y) / d }; };
            const u1 = ud(l1), u2 = ud(l2); if (Math.abs(u1.x * u2.y - u1.y * u2.x) > 0.02) return null;   // côtés longs parallèles
            const E1 = [L[k], L[(k + 1) % 4]], E2 = [L[(k + 2) % 4], L[(k + 3) % 4]], mid = (E) => ({ x: (E[0].x + E[1].x) / 2, y: (E[0].y + E[1].y) / 2 }), p = mid(E1), q = mid(E2), ax = len(p, q); if (ax < 1e-9) return null;
            let A = 0; for (let i = 0; i < 4; i++) A += L[i].x * L[(i + 1) % 4].y - L[(i + 1) % 4].x * L[i].y; return { h, p, q, T: Math.abs(A) / 2 / ax, E1, E2 }; }
        /* les tracés d'un bloc de parois : un seul (tracé gardé ou retrouvé) ou plusieurs (parois fusionnées), retrouvés tronçon par tronçon */
        function wallPathsOf(gid) { const mk = gid + '|' + historyStep + '|' + shapes.length; if (WALL_PATHS_MEMO.has(mk)) return WALL_PATHS_MEMO.get(mk); if (WALL_PATHS_MEMO.size > 400) WALL_PATHS_MEMO.clear(); let R = null; const W = wallPathOf(gid);
            if (W) R = { gid, G: W.G, single: true, paths: [{ P: W.P, closed: W.closed, tool: W.tool, H: W.G.filter(x => x.type === 'hatch'), T: mmToWorld(W.tool.layers.reduce((a, l) => a + (+l.e || +l[1] || 0), 0) || 200) }] };
            else { const G = shapes.filter(x => x.groupId === gid && x.wallMat); if (G.length && !G.some(x => x.wallCx)) { const H = G.filter(x => x.type === 'hatch' && x.loops && x.loops[0]), S = [], fixed = [];
                H.forEach(h => { const s = wallQuadSeg(h); if (s) S.push(s); else fixed.push(h); }); const tol = mmToWorld(3), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), endOf = (s, e) => e ? S[s].q : S[s].p;
                const link = (si, e) => { const pt = endOf(si, e), m = []; S.forEach((o, oj) => { if (oj === si) return; if (dist(o.p, pt) < tol) m.push([oj, 0]); if (dist(o.q, pt) < tol) m.push([oj, 1]); }); return m.length === 1 && Math.abs(S[m[0][0]].T - S[si].T) < tol ? m[0] : null; };
                const Lk = S.map((s, si) => [link(si, 0), link(si, 1)]), used = new Set(), paths = [];
                const walk = (s0, e0) => { const segs = [], pts = [endOf(s0, e0)]; let s = s0, e = e0, closed = false; while (true) { used.add(s); segs.push(s); const out = 1 - e; pts.push(endOf(s, out)); const nx = Lk[s][out]; if (!nx) break; if (used.has(nx[0])) { closed = nx[0] === s0; break; } s = nx[0]; e = nx[1]; }
                    if (closed) pts.pop(); const P = pts.map(q => ({ x: q.x, y: q.y })), T = S[s0].T;
                    if (!closed) [[0, 1, s0, e0], [P.length - 1, P.length - 2, segs[segs.length - 1], 1 - e]].forEach(([i, j, si, ee]) => { const E = ee ? S[si].E2 : S[si].E1, d = dist(P[i], P[j]) || 1, u = { x: (P[i].x - P[j].x) / d, y: (P[i].y - P[j].y) / d }, fl = dist(E[0], E[1]) || 1, f = { x: (E[1].x - E[0].x) / fl, y: (E[1].y - E[0].y) / fl }, uf = Math.abs(u.x * f.x + u.y * f.y), nf = Math.abs(-u.y * f.x + u.x * f.y);
                        const ext = T / 2 * uf / Math.max(nf, 0.2); if (ext > 1e-9) P[i] = { x: P[i].x + u.x * ext, y: P[i].y + u.y * ext }; });   /* bout recoupé en biais contre une autre paroi : rallongé, la découpe le remet au nu */
                    paths.push({ P, closed, T, H: segs.map(k => S[k].h), tool: { align: 'axe', layers: [{ mat: S[s0].h.wallMat, e: Math.round(worldToMm(T)) }] }, o: Math.min(...segs.map(k => shapes.indexOf(S[k].h))) }); };
                S.forEach((s, si) => { if (used.has(si)) return; if (!Lk[si][0]) walk(si, 0); else if (!Lk[si][1]) walk(si, 1); });
                S.forEach((s, si) => { if (!used.has(si)) walk(si, 0); });
                if (paths.length) R = { gid, G, single: false, paths: paths.sort((a, b) => a.o - b.o), fixed }; } }
            WALL_PATHS_MEMO.set(mk, R); return R; }
        /* refaire un bloc de parois avec de nouveaux tracés : les plus anciens d'abord, les suivants recoupés contre eux (comme à la fusion), un seul contour */
        /* paroi refaite (poignée, fusion…) : les nouvelles hachures reprennent l'habillage des anciennes de même matière (texture, dessus/dessous/bouts, faces peintes) ;
           une face peinte posée sur un tronçon qui a bougé suit son tronçon (même décalage) ; chaque nouvelle hachure ne garde que les faces qui tombent sur ses côtés */
        function wallPaintCarry(G, Hn, oldP, newP) { const olds = G.filter(x => x.type === 'hatch' && (x.tex || x.ftex || (x.fte && x.fte.length))); if (!olds.length) return;
            const shift = (e) => { if (!oldP || !newP) return e; let best = null; oldP.forEach((P, k) => { const Q = newP[k]; if (!Q || Q.length !== P.length) return; for (let j = 0; j + 1 < P.length; j++) { const a = P[j], b = P[j + 1], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
                    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, le = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1; if (Math.abs(ux * (e.b.y - e.a.y) / le - uy * (e.b.x - e.a.x) / le) > 0.02) continue;
                    const off = ((e.a.x + e.b.x) / 2 - a.x) * -uy + ((e.a.y + e.b.y) / 2 - a.y) * ux, tm = ((e.a.x + e.b.x) / 2 - a.x) * ux + ((e.a.y + e.b.y) / 2 - a.y) * uy; if (tm < -mmToWorld(50) || tm > L + mmToWorld(50)) continue;
                    if (!best || Math.abs(off) < Math.abs(best.off)) { const d = ((Q[j].x - a.x) * -uy + (Q[j].y - a.y) * ux + (Q[j + 1].x - b.x) * -uy + (Q[j + 1].y - b.y) * ux) / 2; best = { off, dx: -uy * d, dy: ux * d }; } } });
                return best && (best.dx || best.dy) ? { a: { x: e.a.x + best.dx, y: e.a.y + best.dy }, b: { x: e.b.x + best.dx, y: e.b.y + best.dy }, t: e.t } : e; };
            Hn.forEach(h => { if (h.type !== 'hatch' || h.stud || !h.loops || !h.loops[0]) return; const same = olds.filter(x => x.wallMat === h.wallMat && (x.cxB === undefined || x.cxB === h.cxB)), src = same.length ? same : [];
                if (!src.length) return; const t = src.find(x => x.tex); if (t && !h.tex) h.tex = t.tex; const fx = Object.assign({}, ...src.map(x => x.ftex || {})); if (Object.keys(fx).length) h.ftex = fx;
                const L = h.loops[0], E = []; src.forEach(x => (x.fte || []).forEach(e => { const e2 = shift(e); if (L.some((c, i) => wallFteMatch(e2, c, L[(i + 1) % L.length])) && !E.some(f => f.t === e2.t && wallFteMatch(f, e2.a, e2.b))) E.push(JSON.parse(JSON.stringify(e2))); }));
                if (E.length) h.fte = E; else delete h.fte; }); }
        function wallPathsApply(info, Ps) { if (info.single) { const p = info.paths[0]; return wallRebuildPath(info.gid, Ps[0], p.closed, p.tool, info.G, p.P); }
            const G = info.G, s0 = G[0], at = shapes.indexOf(s0), lid = s0.layerId, ops = [], PC = window.polygonClipping, ring = (l) => { const r = l.map(q => [q.x, q.y]); r.push(r[0]); return r; }, poly = (h) => h.loops.map(ring);
            const fx0 = new Set(info.fixed); G.forEach(h => { if (!fx0.has(h)) (h.openings || []).forEach(o => ops.push(o)); });
            const cp = (s) => { ['bid', 'lvl', 'zk'].forEach(f => { if (s0[f] !== undefined) s[f] = s0[f]; }); s.lvs = 1; delete s.wp; delete s.openings; return s; }, Hn = [];
            let acc = null; const addAcc = (pl) => { if (!PC || !pl.length) return; try { acc = acc ? PC.union(acc, ...pl) : PC.union(...pl); } catch (e) {} }; addAcc(info.fixed.map(poly));
            const oth = shapes.filter(x => x.type === 'hatch' && x.wallMat && x.groupId !== info.gid && x.loops && x.loops[0] && x.lvl === s0.lvl), tol = mmToWorld(3);
            info.paths.forEach((p, k) => { const hs = wallChainShapes(Ps[k], p.tool, p.closed, lid, info.gid, s0.wz).filter(x => x.type === 'hatch'), raw = hs.map(poly); let clip = acc;
                /* bouts posés contre une paroi d'un autre bloc : recoupés à son nu */
                if (PC && !p.closed) { const E = [Ps[k][0], Ps[k][Ps[k].length - 1]], nb = oth.filter(h => E.some(v => pointInPolygon(v.x, v.y, h.loops[0]) || distToPoly(v.x, v.y, h.loops[0]) < p.T / 2 + tol)); if (nb.length) try { clip = PC.union(...(acc ? [acc] : []), ...nb.map(poly)); } catch (e) {} }
                hs.forEach(h => { if (!clip) { Hn.push(cp(h)); return; } let D; try { D = PC.difference(poly(h), clip); } catch (e) { D = null; } if (!D) { Hn.push(cp(h)); return; }
                    D.forEach(pg => { const nh = cp(Object.assign({}, h, { loops: pg.map(r => r.slice(0, -1).map(([x, y]) => ({ x, y }))) })); if (Math.abs(polyArea(nh.loops[0])) > Math.pow(mmToWorld(20), 2)) Hn.push(nh); }); });
                addAcc(raw); });
            const lines = []; if (PC && acc) acc.forEach(pg => pg.forEach(r => { const L = r.slice(0, -1); L.forEach(([ax, ay], k) => { const [bx, by] = L[(k + 1) % L.length]; if (Math.hypot(bx - ax, by - ay) > 1e-9) { const l = cp({ type: 'line', layerId: lid, x1: ax, y1: ay, x2: bx, y2: by, groupId: info.gid, wallMat: s0.wallMat }); if (s0.wz) l.wz = Object.assign({}, s0.wz); lines.push(l); } }); }));
            const fx = new Set(info.fixed), old = new Set(G.filter(x => !fx.has(x))); shapes = shapes.filter(x => !old.has(x)); const N = Hn.concat(lines); shapes.splice(Math.max(0, Math.min(at, shapes.length)), 0, ...N);
            ops.forEach(o => wallOpHome(o, Hn)); wallPaintCarry([...old], Hn, info.paths.map(p => p.P), Ps);
            if (!PC) wallBordersRepair(); return N.concat(info.fixed); }
        /* une porte ou fenêtre reposée dans la paroi refaite : sur le tronçon qui la porte ; si la paroi a bougé sous elle, elle est ramenée dedans (perpendiculairement), jamais étirée hors du mur */
        function wallOpHome(o, Hn) { if (!o.a || !o.b) return; const m = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 }; let best = null, bd = Infinity; Hn.forEach(h => { const Q = h.loops && h.loops[0]; if (!Q || bd < 0) return; if (pointInPolygon(m.x, m.y, Q)) { bd = -1; best = h; return; } const d = distToPoly(m.x, m.y, Q); if (d < bd) { bd = d; best = h; } }); if (!best) return;
            if (bd >= 0) { const Q = best.loops[0], L = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, nx = -(o.b.y - o.a.y) / L, ny = (o.b.x - o.a.x) / L, ts = [];
                Q.forEach((c, k) => { const e = Q[(k + 1) % Q.length], ex = e.x - c.x, ey = e.y - c.y, den = nx * ey - ny * ex; if (Math.abs(den) < 1e-12) return; const t = ((c.x - m.x) * ey - (c.y - m.y) * ex) / den, u = ((c.x - m.x) * ny - (c.y - m.y) * nx) / den; if (u >= -1e-9 && u <= 1 + 1e-9) ts.push(t); });
                let sx, sy; if (ts.length >= 2) { ts.sort((a, b) => Math.abs(a) - Math.abs(b)); const t0 = ts[0], t1 = ts.slice(1).find(t => Math.sign(t) === Math.sign(t0)) ?? ts[1], tm = (t0 + t1) / 2; sx = nx * tm; sy = ny * tm; }
                else { let c0 = null, d0 = Infinity; Q.forEach((c, k) => { const e = Q[(k + 1) % Q.length], l2 = (e.x - c.x) ** 2 + (e.y - c.y) ** 2 || 1, t = Math.max(0, Math.min(1, ((m.x - c.x) * (e.x - c.x) + (m.y - c.y) * (e.y - c.y)) / l2)), q = { x: c.x + (e.x - c.x) * t, y: c.y + (e.y - c.y) * t }, d = Math.hypot(q.x - m.x, q.y - m.y); if (d < d0) { d0 = d; c0 = q; } }); let cx = 0, cy = 0; Q.forEach(q => { cx += q.x; cy += q.y; }); cx /= Q.length; cy /= Q.length; sx = c0.x - m.x + (cx - c0.x) * 0.5; sy = c0.y - m.y + (cy - c0.y) * 0.5; }
                o.a = { x: o.a.x + sx, y: o.a.y + sy }; o.b = { x: o.b.x + sx, y: o.b.y + sy }; }
            best.openings = (best.openings || []).concat([o]); try { o.pts = openingPts(best, o.a, o.b); } catch (e) {} }
        /* au chargement : une ouverture restée hors de sa paroi (paroi déplacée sous elle) est ramenée dedans */
        function wallOpRepair() { let n = 0; shapes.forEach(h => { if (h.type !== 'hatch' || !h.wallMat || !h.openings || !h.loops) return; h.openings.slice().forEach(o => { if (!o.a || !o.b) return; const m = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 }, G = shapes.filter(x => x.type === 'hatch' && x.groupId === h.groupId && x.loops && x.loops[0]);
            if (pointInPolygon(m.x, m.y, h.loops[0]) || distToPoly(m.x, m.y, h.loops[0]) < mmToWorld(5)) return;
            { const G2 = G.find(x => x !== h && pointInPolygon(m.x, m.y, x.loops[0])); if (G2) { h.openings = h.openings.filter(x => x !== o); if (!h.openings.length) delete h.openings; G2.openings = (G2.openings || []).concat([o]); n++; return; } }   /* posée sur un autre tronçon de la même paroi : elle y est rattachée, sans bouger */ h.openings = h.openings.filter(x => x !== o); if (!h.openings.length) delete h.openings; wallOpHome(o, G); n++; }); }); return n; }
        /* poignée de paroi : début (état gardé pour tout refaire depuis lui), application, fin */
        function wallDragStart(g) { const info = wallPathsOf(g.gid); if (!info || !info.paths[g.pi || 0]) return null; try { loadPolyClip().catch(() => {}); } catch (e) {}
            const s0 = info.G[0], infos = new Map([[g.gid, info]]), pts = new Map();
            [...new Set(shapes.filter(x => x.wallMat && x.groupId && x.groupId !== g.gid && x.lvl === s0.lvl).map(x => x.groupId))].forEach(id => { const I = wallPathsOf(id); if (I) infos.set(id, I); });
            shapes.forEach(x => (x.openings || []).forEach(o => pts.set(o, { pts: o.pts, a: o.a, b: o.b })));
            return { snap: shapes.slice(), sel: selectedShapes.slice(), pts, infos, info, cur: [] }; }
        function wallDragReset(W) { shapes = W.snap.slice(); W.pts.forEach((p, o) => { o.pts = p.pts; o.a = p.a; o.b = p.b; }); W.cur = []; }
        function wallDragApply(W, g, X, Y, D) { wallDragReset(W); const info = W.info, pi = g.pi || 0, path = info.paths[pi], Ps = new Map([[g.gid, info.paths.map(p => p.P.map(q => ({ x: q.x, y: q.y })))]]), P = Ps.get(g.gid)[pi], n = P.length; let msg = null;
            if (g.kind === 'w-vtx') P[g.i] = { x: X, y: Y }; else if (g.kind === 'w-add') P.splice(g.i + 1, 0, { x: X, y: Y });
            else { const i = g.i, j = (i + 1) % n, a = P[i], b = P[j], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, d = (X - D.x0) * nx + (Y - D.y0) * ny;
                const A2 = { x: a.x + nx * d, y: a.y + ny * d }, B2 = { x: b.x + nx * d, y: b.y + ny * d }, cut = (p, q, r, t) => { const den = (q.x - p.x) * (t.y - r.y) - (q.y - p.y) * (t.x - r.x); if (Math.abs(den) < 1e-12) return null; const k = ((r.x - p.x) * (t.y - r.y) - (r.y - p.y) * (t.x - r.x)) / den; return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }; };
                const tol = mmToWorld(3), own = new Set(info.single ? info.G : path.H), others = shapes.filter(x => x.type === 'hatch' && x.wallMat && !own.has(x) && x.loops && x.loops[0] && x.lvl === info.G[0].lvl);
                /* bout libre contre une autre paroi : il glisse le long de cette paroi */
                const slide = (v) => { let best = null; others.forEach(h => { const Q = h.loops[0], inn = pointInPolygon(v.x, v.y, Q); Q.forEach((c, k) => { const e = Q[(k + 1) % Q.length], dd = distToPoly(v.x, v.y, [c, e]); if (!inn && dd > path.T / 2 + tol) return; if (!best || dd < best.d) best = { d: dd, c, e }; }); });
                    return best ? cut(A2, B2, v, { x: v.x + best.e.x - best.c.x, y: v.y + best.e.y - best.c.y }) : null; };
                P[i] = ((path.closed || i > 0) && cut(P[(i - 1 + n) % n], a, A2, B2)) || slide(a) || A2; P[j] = ((path.closed || i + 1 < n - 1) && cut(P[(j + 1) % n], b, A2, B2)) || slide(b) || B2;
                /* parois qui viennent buter sur ce tronçon : elles s'allongent ou se raccourcissent pour rester accrochées */
                const Tw = path.T + tol, onSeg = (v) => { const t = ((v.x - a.x) * (b.x - a.x) + (v.y - a.y) * (b.y - a.y)) / (L * L); return t > -0.02 && t < 1.02 && Math.abs((v.x - a.x) * nx + (v.y - a.y) * ny) <= Tw; };
                info.G.forEach(h => (h.openings || []).forEach(o => { if (o.a && o.b && onSeg({ x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 })) { o.a = { x: o.a.x + nx * d, y: o.a.y + ny * d }; o.b = { x: o.b.x + nx * d, y: o.b.y + ny * d }; } }));   /* portes et fenêtres du tronçon : elles suivent */
 W.infos.forEach((I, id) => I.paths.forEach((p, k) => { if (p.closed || (id === g.gid && k === pi)) return; [[0, 1], [p.P.length - 1, p.P.length - 2]].forEach(([e, f]) => { const v = p.P[e], w = p.P[f], t = ((v.x - a.x) * (b.x - a.x) + (v.y - a.y) * (b.y - a.y)) / (L * L), off = Math.abs((v.x - a.x) * nx + (v.y - a.y) * ny);
                    if (t < -0.02 || t > 1.02 || off > Tw) return; const l = Math.hypot(v.x - w.x, v.y - w.y) || 1, ux = (v.x - w.x) / l, uy = (v.y - w.y) / l, den = ux * nx + uy * ny; if (Math.abs(den) < 0.2) return;
                    if (!Ps.has(id)) Ps.set(id, I.paths.map(pp => pp.P.map(q => ({ x: q.x, y: q.y })))); const R = Ps.get(id)[k]; R[e] = { x: v.x + ux * d / den, y: v.y + uy * d / den }; }); }));
                msg = 'PAROI : tronçon décalé de ' + calculateRealDistance(Math.abs(d)) + (Ps.size > 1 ? ' — les parois accrochées suivent' : '') + ' (Échap = annuler).'; }
            let main = null; Ps.forEach((pp, id) => { const N = wallPathsApply(W.infos.get(id), pp); if (N) { N.forEach(x => { x._nosnap = true; }); W.cur.push(...N); if (id === g.gid) main = N; } });
            WALL_PATH_MEMO.clear(); WALL_PATHS_MEMO.clear(); if (main) selectedShapes = main; return msg; }
        function wallDragEnd(W, cancel) { W.cur.forEach(x => delete x._nosnap); if (cancel) { wallDragReset(W); selectedShapes = W.sel; } WALL_PATH_MEMO.clear(); WALL_PATHS_MEMO.clear(); }
