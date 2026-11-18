        // =====================================================================
        // MNT (surface du terrain) : triangulation de tous les sommets cotés, réutilisée par la vue 3D,
        // les pentes, le profil en long, les courbes de niveau et les cubatures.
        // Les objets générés (courbes, profils dessinés) portent s.gen et ne servent pas à la construire.
        // =====================================================================
        let tinCache = null;
        // Plateforme / ouvrage : polyligne fermée, tous les sommets à la même altitude (ex. plateforme dessinée puis Z via Y).
        // Elle ne fait pas partie du terrain naturel : elle est modélisée à part (dalle plane + talus en 3D, cubatures).
        function isPlateforme(s) {
            if (s && (s.solid || s.sweep || s.water || s.river || s.trench || s.brush || s.bld || s.bois || s.stair || s.stair2 || s.bassin || s.maille)) return false;   // solide 3D, balayage, eau, tranchée, contour de bâtiment : ni plateforme ni terrain
            if (s && s.type === 'circle') return hasZ(s.z) && s.r > 0 && !s.gen && !s.elev;   // plateforme ronde
            if (!s || s.type !== 'poly' || s.open || s.points.length < 3 || s.gen || s.elev) return false;   // elev : polyligne 2D DXF avec simple élévation, pas une plateforme
            const z0 = s.points[0].z; if (!hasZ(z0) || !s.points.every(p => hasZ(p.z))) return false;
            return !!s.plat || s.points.every(p => Math.abs(p.z - z0) < 1);   // inclinée / rampe : marquée « plat » (Y), sommets à des Z différents
        }
        // contour (polygone) et cote d'une plateforme, polyligne ou cercle
        // Surface d'une plateforme : horizontale (zp) ou inclinée / gauche (triangulée par ses sommets, Z exacts aux sommets)
        const PSURF = new WeakMap();
        function earClip(P) {   // triangulation d'un polygone simple (indices)
            const n = P.length, idx = [...Array(n).keys()], out = []; let A = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; A += a.x * b.y - b.x * a.y; }
            const ccw = A > 0, cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            const inTri = (p, a, b, c) => { const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p); return ccw ? d1 > 0 && d2 > 0 && d3 > 0 : d1 < 0 && d2 < 0 && d3 < 0; };
            let guard = 0;
            while (idx.length > 3 && guard++ < 5000) {
                let cut = false;
                for (let k = 0; k < idx.length; k++) {
                    const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = P[i0], b = P[i1], c = P[i2], cr = cross(a, b, c);
                    if (ccw ? cr <= 1e-12 : cr >= -1e-12) continue;
                    if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inTri(P[j], a, b, c))) continue;
                    out.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break;
                }
                if (!cut) break;
            }
            if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
            return out;
        }
        function platSurf(s) {
            if (s.type === 'circle') return { flat: true, zp: s.z, zmin: s.z, zmax: s.z };
            const key = s.points.map(q => q.x + ',' + q.y + ',' + q.z).join(';'), c = PSURF.get(s); if (c && c.key === key) return c.v;
            const P = s.points, zs = P.map(q => q.z), zmin = arrMin(zs), zmax = arrMax(zs);
            let v;
            if (zmax - zmin < 1) v = { flat: true, zp: zs[0], zmin, zmax };
            else {
                const tris = earClip(P).map(([i, j, k]) => { const A = P[i], B = P[j], C = P[k], det = (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y);
                    const a = det ? ((B.z - A.z) * (C.y - A.y) - (C.z - A.z) * (B.y - A.y)) / det : 0, b = det ? ((C.z - A.z) * (B.x - A.x) - (B.z - A.z) * (C.x - A.x)) / det : 0;
                    return { pts: [A, B, C], a, b, c: A.z - a * A.x - b * A.y }; });
                // écart au plan moyen (moindres carrés) : 0 = plan parfait
                let sx = 0, sy = 0, sz = 0, sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0; const n = P.length, mx = P.reduce((u, q) => u + q.x, 0) / n, my = P.reduce((u, q) => u + q.y, 0) / n;
                P.forEach(q => { const x = q.x - mx, y = q.y - my; sx += x; sy += y; sz += q.z; sxx += x * x; sxy += x * y; syy += y * y; sxz += x * q.z; syz += y * q.z; });
                const D = sxx * syy - sxy * sxy, pa = D ? (sxz * syy - syz * sxy) / D : 0, pb = D ? (syz * sxx - sxz * sxy) / D : 0, pc = sz / n;
                const dev = arrMax(P.map(q => Math.abs(pa * (q.x - mx) + pb * (q.y - my) + pc - q.z)));
                v = { flat: false, zp: zs.reduce((u, z) => u + z, 0) / n, zmin, zmax, tris, dev };
            }
            PSURF.set(s, { key, v }); return v;
        }
        function platZAt(S, x, y) {
            if (S.flat) return S.zp;
            for (const t of S.tris) { const [A, B, C] = t.pts, d = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y); if (Math.abs(d) < 1e-12) continue;
                const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / d, l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / d, l3 = 1 - l1 - l2;
                if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return t.a * x + t.b * y + t.c; }
            return S.zp;
        }
        // point du bord le plus proche (distance monde) et cote du bord en ce point (interpolée entre sommets)
        // point le plus proche sur le contour R : distance, Z interpolé (ou zflat), coordonnées
        function nearOnRing(x, y, R, zflat) {
            let best = Infinity, bz = zflat, px = x, py = y, bi = 0;
            for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
                const qx = a.x + t * dx, qy = a.y + t * dy, d = Math.hypot(x - qx, y - qy); if (d < best) { best = d; px = qx; py = qy; bi = i; if (!hasZ(zflat)) bz = hasZ(a.z) && hasZ(b.z) ? a.z + (b.z - a.z) * t : a.z; } }
            return { d: best, z: bz, px, py, i: bi };
        }
        function edgeNearZ(x, y, R, zflat) {
            let best = Infinity, bz = zflat;
            for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
                const d = Math.hypot(x - a.x - t * dx, y - a.y - t * dy); if (d < best) { best = d; if (hasZ(a.z) && hasZ(b.z) && !hasZ(zflat)) bz = a.z + (b.z - a.z) * t; } }
            return { d: best, z: bz };
        }
        function platLabel(S) { return S.flat ? 'à ' + nfr(S.zp / 1000, 2) + ' m' : 'inclinée ' + nfr(S.zmin / 1000, 2) + ' → ' + nfr(S.zmax / 1000, 2) + ' m'; }
        function platRing(s) { if (s.type === 'poly' && !platSurf(s).flat) return s.points.map(q => ({ x: q.x, y: q.y, z: q.z })); if (s.type === 'circle') { const N = 96; return Array.from({ length: N }, (_, i) => ({ x: s.x + s.r * Math.cos(2 * Math.PI * i / N), y: s.y + s.r * Math.sin(2 * Math.PI * i / N) })); } return s.points.map(q => ({ x: q.x, y: q.y })); }
        function platZ(s) { return s.type === 'circle' ? s.z : s.points[0].z; }
        // ---- Terrain fini : toutes les plateformes et leurs talus, raccordés entre eux ----
        // Remblais : le plus haut des cônes de talus l'emporte (les remblais se rejoignent) ; déblais : le plus bas (les fouilles se rejoignent) ;
        // un talus de remblai qui rencontre le talus de déblai d'une autre plateforme s'arrête sur lui. Dans une plateforme : sa cote.
        let FM_CACHE = null;
        function finishedModel(override, tinIn, skip, ff) { const plain = !override && !tinIn && !skip && !ff;
            if (plain && FRAME_MEMO && FRAME_MEMO.has('fm')) return FRAME_MEMO.get('fm'); const r = finishedModel0(override, tinIn, skip, ff); if (plain && FRAME_MEMO) FRAME_MEMO.set('fm', r); return r; }
        const SEG_GRID = new WeakMap();
        function finishedModel0(override, tinIn, skip, ff) {   // skip : plateformes ignorées (décochées dans les cubatures) ; ff : plateformes à structure « fond de forme » descendues au fond de forme (terrassement)
            const tin = tinIn || getTIN(); if (!tin) return null;
            const P = [];
            shapes.forEach(s => { if (!isPlateforme(s) || (override && override.shape === s) || (skip && skip.has(s))) return; const t = platTalus(s), st = ff ? structOf(s) : null, dz = st && st.ff !== false ? structThick(st) * 10 : 0, S = dz ? surfDown(platSurf(s), dz) : platSurf(s);
                const EX = t.cx && t.edges && s.type === 'poly' ? t.edges : null, ek = (k) => EX ? EX.map(e => e && e[k] ? talusK(e[k]) : null) : null;
                const rg = dz ? platRing(s).map(q => Object.assign({}, q, hasZ(q.z) ? { z: q.z - dz } : {})) : platRing(s), Rs = s.type === 'poly' ? rg.map((q, i) => { const e = EX && EX[i]; return mmToWorld(e && e.R !== undefined ? +e.R || 0 : t.R); }) : null;
                P.push({ s, dz, ring: rg, ringR: Rs && Rs.some(v => v > 0) ? polyOffsetVar(rg, Rs) : null, zp: S.zp, S, on: t.on, kR: talusK(t.kR), kD: talusK(t.kD), R: Rs ? Math.max(0, ...Rs) : mmToWorld(t.R), kRe: ek('kR'), kDe: ek('kD'), offE: s.type === 'poly' && t.edges && t.edges.some(e => e && e.off) ? s.points.map((q, k) => !!(t.edges[k] && t.edges[k].off)) : null, corn: s.type === 'poly' ? talCorners(s) : null }); });   // parois : en réglage uniforme comme par arête
            if (override) { const S = override.S || { flat: true, zp: override.zp, zmin: override.zp, zmax: override.zp }; P.push({ s: override.shape || null, ring: override.ring, zp: S.zp, S, on: override.on, kR: override.kR, kD: override.kD, ovr: true }); }
            const sig = JSON.stringify(P.map(p => [p.ring, p.zp, p.on, p.kR, p.kD, p.R, p.kRe, p.kDe, p.offE, p.corn]));
            if (!override && !tinIn && !skip && FM_CACHE && FM_CACHE.tin === tin && FM_CACHE.sig === sig && FM_CACHE.P.length === P.length && FM_CACHE.P.every((q, i) => q.s === P[i].s)) return FM_CACHE;   // mêmes objets : après Ctrl+Z ils sont recréés (même géométrie) et l'ancien modèle ne les retrouverait plus (talus disparus)
            const zs = tin.nodes.map(n => n.z), tnMin = Math.min(arrMin(zs), ...P.map(p => p.S.zmin)), tnMax = Math.max(arrMax(zs), ...P.map(p => p.S.zmax));   // les talus peuvent aussi rejoindre une autre plateforme
            P.forEach(p => { const xs = p.ring.map(q => q.x), ys = p.ring.map(q => q.y);
                p.bb0 = { x0: arrMin(xs), y0: arrMin(ys), x1: arrMax(xs), y1: arrMax(ys) };
                const kMax = (a, b) => Math.max(a, ...((b || []).filter(v => v > 0)));
                // portée des talus : bornée par le relief PROCHE (et non par tout le semis) : un pan de montagne importé loin du projet ne doit pas
                // étirer la zone des talus sur des centaines de mètres (sinon tout le terrain fini est calculé, et dessiné, à gros grain)
                const reach = (lo, hi) => mmToWorld(Math.max((p.S.zmax - lo) * kMax(p.kR, p.kRe), (hi - p.S.zmin) * kMax(p.kD, p.kDe), 0)) * 1.02 + (p.R || 0) * 3;
                if (!p.on) p.ext = 0;
                else { let r = mmToWorld(20000), ext = reach(tnMin, tnMax);
                    for (let it = 0; it < 14; it++) { const x0 = p.bb0.x0 - r, x1 = p.bb0.x1 + r, y0 = p.bb0.y0 - r, y1 = p.bb0.y1 + r; let lo = p.S.zmin, hi = p.S.zmax;
                        for (const nd of tin.nodes) if (nd.x >= x0 && nd.x <= x1 && nd.y >= y0 && nd.y <= y1 && hasZ(nd.z)) { if (nd.z < lo) lo = nd.z; if (nd.z > hi) hi = nd.z; }
                        for (let i = 0; i <= 4; i++) for (const [x, y] of [[x0 + (x1 - x0) * i / 4, y0], [x0 + (x1 - x0) * i / 4, y1], [x0, y0 + (y1 - y0) * i / 4], [x1, y0 + (y1 - y0) * i / 4]]) { const z = tinZ(x, y, tin); if (hasZ(z)) { if (z < lo) lo = z; if (z > hi) hi = z; } }   // grands triangles qui traversent la zone
                        P.forEach(q => { if (q !== p && q.ring.some(v => v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1)) { lo = Math.min(lo, q.S.zmin); hi = Math.max(hi, q.S.zmax); } });   // les talus peuvent rejoindre une plateforme voisine
                        const e = reach(lo, hi); if (e <= r) { ext = e; break; } r = e * 1.15; }
                    p.ext = Math.min(ext, reach(tnMin, tnMax)); }
                p.bb = { x0: p.bb0.x0 - p.ext, y0: p.bb0.y0 - p.ext, x1: p.bb0.x1 + p.ext, y1: p.bb0.y1 + p.ext }; });
            const inB = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
            // bords « enterrés » : partie du contour d'une plateforme recouverte par une plateforme dessinée après (dessus) ; aucun talus n'en part
            // fosse : plateforme dessinée après, entièrement posée dans une autre (bassin, fosse) ; sinon, là où deux plateformes se recouvrent, c'est la plus haute (celle du dessus) qui reste
            P.forEach((p, i) => { p.idx = i; p.fosseOf = new Set(); P.forEach((q, j) => { if (j < i && p.ring.every(v => pointInPolygon(v.x, v.y, q.ring))) p.fosseOf.add(j); }); });
            const wins = (q, p) => { const iq = P.indexOf(q), ip = P.indexOf(p); if (q.fosseOf.has(ip)) return true; if (p.fosseOf.has(iq)) return false; if (q.S.zmax > p.S.zmax + 0.5) return true; if (Math.abs(q.S.zmax - p.S.zmax) <= 0.5) return iq > ip; return false; };
            P.forEach((p, i) => {
                const later = P.filter((q, j) => j !== i && wins(q, p) && !(q.bb0.x1 < p.bb0.x0 || q.bb0.x0 > p.bb0.x1 || q.bb0.y1 < p.bb0.y0 || q.bb0.y0 > p.bb0.y1)); if (!later.length) return;
                const R = p.ring, n = R.length, segs = []; let cur = null, buried = false;
                const zAt = (a, b, t) => hasZ(a.z) && hasZ(b.z) ? a.z + (b.z - a.z) * t : (hasZ(a.z) ? a.z : p.zp);
                for (let k = 0; k < n; k++) { const a = R[k], b = R[(k + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.min(64, Math.ceil(L / mmToWorld(100))));
                    for (let j = 0; j < m; j++) { const t0 = j / m, t1 = (j + 1) / m, mx = a.x + (b.x - a.x) * (t0 + t1) / 2, my = a.y + (b.y - a.y) * (t0 + t1) / 2;
                        // enterré = recouvert des deux côtés (deux plateformes simplement accolées : le bord reste exposé, son talus descend sur la voisine)
                        const nx = -(b.y - a.y) / (L || 1) * mmToWorld(30), ny = (b.x - a.x) / (L || 1) * mmToWorld(30);
                        const inside = later.some(q => inB(q.bb, mx, my) && pointInPolygon(mx + nx, my + ny, q.ring) && pointInPolygon(mx - nx, my - ny, q.ring)) || later.some(q => P.indexOf(q) < i && !p.fosseOf.has(P.indexOf(q)) && pointInPolygon(mx, my, q.ring));   // sous une plateforme plus haute : rien
                        if (inside) { buried = true; if (cur) { segs.push(cur); cur = null; } continue; }
                        const A = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0, z: zAt(a, b, t0), k }, B = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1, z: zAt(a, b, t1), k };
                        if (!cur) cur = [A]; cur.push(B); } }
                if (cur) segs.push(cur);
                if (buried) p.segs = segs.map(sg => sg.filter((q, j) => j === 0 || j === sg.length - 1 || sg[j + 1].k !== q.k));   // bords exposés : découpés tous les 10 cm pour trouver ce qui est enterré, puis ramenés à leurs sommets (même tracé, 60 fois moins de segments à parcourir)
            });
            // arêtes en paroi : aucun talus n'en part, mais les talus voisins tournent l'angle (cône autour du sommet) et reviennent le long de la paroi
            P.forEach(p => { if (!p.offE || !p.offE.some(Boolean)) return; p.segsB = p.segs || null; p.hasB = true; const R = p.ring, n = R.length, zv = (q) => hasZ(q.z) ? q.z : p.zp, out = [];
                if (p.segs) p.segs.forEach(sg => { let cur = null; for (let k = 0; k + 1 < sg.length; k++) { const b = sg[k + 1]; if (p.offE[b.k]) { if (cur) out.push(cur); cur = null; continue; } if (!cur) cur = [sg[k]]; cur.push(b); } if (cur) out.push(cur); });
                else { const st = p.offE.findIndex(Boolean); let cur = null; for (let j = 1; j <= n; j++) { const k = (st + j) % n; if (p.offE[k]) { if (cur) out.push(cur); cur = null; continue; }
                    const a = R[k], b = R[(k + 1) % n]; if (!cur) cur = [{ x: a.x, y: a.y, z: zv(a), k }]; cur.push({ x: b.x, y: b.y, z: zv(b), k }); } if (cur) out.push(cur); }
                p.segs = out; });
            // point le plus proche sur les bords exposés (polylignes ouvertes) : { d, z, px, py }
            /* grille des segments exposés : la recherche du bord le plus proche ne parcourt plus tous les segments (même résultat, ex aequo départagés dans l'ordre) */
            const segGrid = (segs) => { let G = SEG_GRID.get(segs); if (G) return G; const L = []; segs.forEach(sg => { for (let k = 0; k + 1 < sg.length; k++) L.push({ sg, k }); });
                let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; L.forEach(e => { const a = e.sg[e.k], b = e.sg[e.k + 1]; x0 = Math.min(x0, a.x, b.x); y0 = Math.min(y0, a.y, b.y); x1 = Math.max(x1, a.x, b.x); y1 = Math.max(y1, a.y, b.y); });
                const C = Math.max((x1 - x0) / 48, (y1 - y0) / 48, 1e-6), nx = Math.floor((x1 - x0) / C) + 1, ny = Math.floor((y1 - y0) / C) + 1, cells = new Map();
                L.forEach((e, i) => { const a = e.sg[e.k], b = e.sg[e.k + 1]; for (let gx = Math.floor((Math.min(a.x, b.x) - x0) / C); gx <= Math.floor((Math.max(a.x, b.x) - x0) / C); gx++) for (let gy = Math.floor((Math.min(a.y, b.y) - y0) / C); gy <= Math.floor((Math.max(a.y, b.y) - y0) / C); gy++) { const key = gx * 100003 + gy; let c = cells.get(key); if (!c) cells.set(key, c = []); c.push(i); } });
                G = { L, x0, y0, C, nx, ny, cells, seen: new Uint32Array(L.length), stamp: 0 }; SEG_GRID.set(segs, G); return G; };
            const nearSegs = (x, y, segs, zflat) => { let nS = 0; for (const sg of segs) nS += sg.length; if (nS > 40) return nearSegsG(x, y, segs, zflat);
                let best = Infinity, bz = zflat, px = x, py = y, bi = 0, end = null;
                for (const sg of segs) for (let k = 0; k + 1 < sg.length; k++) { const a = sg[k], b = sg[k + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
                    const qx = a.x + t * dx, qy = a.y + t * dy, d = Math.hypot(x - qx, y - qy); if (d < best) { best = d; px = qx; py = qy; bi = b.k || 0; if (!hasZ(zflat)) bz = a.z + (b.z - a.z) * t;
                        const L = Math.sqrt(l2) || 1; end = t >= 1 && k + 2 === sg.length ? { v: b, ux: dx / L, uy: dy / L, dx: dx / L, dy: dy / L } : t <= 0 && k === 0 ? { v: a, ux: dx / L, uy: dy / L, dx: -dx / L, dy: -dy / L } : null; } }   // bout libre d'un talus (contre une paroi) : direction de la limite de refoulement
                return { d: best, z: bz, px, py, i: bi, end }; };
            const nearSegsG = (x, y, segs, zflat) => { const G = segGrid(segs), L = G.L; let best = Infinity, bo = -1, bz = zflat, px = x, py = y, bi = 0, end = null; const st = ++G.stamp;
                const cx = Math.floor((x - G.x0) / G.C), cy = Math.floor((y - G.y0) / G.C), rMax = Math.max(Math.abs(cx), Math.abs(cx - G.nx), Math.abs(cy), Math.abs(cy - G.ny)) + 1;
                const test = (i) => { if (G.seen[i] === st) return; G.seen[i] = st; const e = L[i], sg = e.sg, k = e.k, a = sg[k], b = sg[k + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
                    const qx = a.x + t * dx, qy = a.y + t * dy, d = Math.hypot(x - qx, y - qy); if (d < best || (d === best && i < bo)) { best = d; bo = i; px = qx; py = qy; bi = b.k || 0; bz = hasZ(zflat) ? zflat : a.z + (b.z - a.z) * t;
                        const Ln = Math.sqrt(l2) || 1; end = t >= 1 && k + 2 === sg.length ? { v: b, ux: dx / Ln, uy: dy / Ln, dx: dx / Ln, dy: dy / Ln } : t <= 0 && k === 0 ? { v: a, ux: dx / Ln, uy: dy / Ln, dx: -dx / Ln, dy: -dy / Ln } : null; } };
                const cell = (gx, gy) => { const c = G.cells.get(gx * 100003 + gy); if (c) for (const i of c) test(i); }, r0 = Math.max(0, -cx, cx - G.nx, -cy, cy - G.ny);
                for (let r = r0; r <= rMax; r++) { const ga = Math.max(0, cx - r), gb = Math.min(G.nx, cx + r), ha = Math.max(0, cy - r), hb = Math.min(G.ny, cy + r);
                    for (let gx = ga; gx <= gb; gx++) { if (Math.abs(gx - cx) === r) { for (let gy = ha; gy <= hb; gy++) cell(gx, gy); } else { if (cy - r >= 0) cell(gx, cy - r); if (r && cy + r <= G.ny) cell(gx, cy + r); } }
                    if (best <= r * G.C) break; }
                if (G.stamp > 4e9) { G.stamp = 0; G.seen.fill(0); }
                return { d: best, z: bz, px, py, i: bi, end }; };
            // limite de refoulement au bout libre d'un talus : angle compté depuis la normale de l'arête (0° = coupé net, 180° = tour complet jusque contre la paroi)
            P.forEach(p => { if (!p.corn) return; let A2 = 0; const R = p.ring, n = R.length; for (let k = 0; k < n; k++) { const a = R[k], b = R[(k + 1) % n]; A2 += a.x * b.y - b.x * a.y; } p.sgO = A2 > 0 ? -1 : 1; });
            const limOK = (q, e, x, y) => { if (!q.corn || !e || !e.end) return true; const R = q.ring, v = e.end.v, k = R.findIndex(r => Math.abs(r.x - v.x) < 1e-6 && Math.abs(r.y - v.y) < 1e-6); if (k < 0 || q.corn[k] === undefined || q.corn[k] === null) return true;
                const E = e.end, nx = -E.uy * q.sgO, ny = E.ux * q.sgO, wx = x - v.x, wy = y - v.y, th = Math.atan2(wx * E.dx + wy * E.dy, wx * nx + wy * ny) * 180 / Math.PI; return th <= q.corn[k] + 0.5; };
            // pente et recul de l'arête la plus proche : talus réglé par arête (sinon celui de la plateforme) ; recul R = décalage de la base du talus de déblai (bande au niveau de la plateforme avant que le talus ne monte)
            const kAt = (q, e, rem) => { const L = rem ? q.kRe : q.kDe, v = L && e && L[e.i]; return v > 0 ? v : (rem ? q.kR : q.kD); };
            const dOf = (q, e, x, y) => { if (q.ringR && x !== undefined) return pointInPolygon(x, y, q.ringR) ? 0 : distToPoly(x, y, q.ringR); return Math.max(0, e.d - (q.R || 0)); };   // fond de fouille décalé : polygone agrandi de R
            const offAt = (q, e) => !!(q.offE && e && q.offE[e.i]);
            const edgeOf = (q, x, y) => q.segs ? (q.segs.length ? nearSegs(x, y, q.segs, q.S.flat ? q.zp : undefined) : null) : nearOnRing(x, y, q.ring, q.S.flat ? q.zp : undefined);
            // sur une autre plateforme : pas de retour de talus autour d'une paroi (le bord le plus proche décide, paroi = rien)
            const edgeOn = (q, x, y) => q.hasB ? (q.segsB ? (q.segsB.length ? nearSegs(x, y, q.segsB, q.S.flat ? q.zp : undefined) : null) : nearOnRing(x, y, q.ring, q.S.flat ? q.zp : undefined)) : edgeOf(q, x, y);
            // altitude finie (mm) en (x, y) : { z, kind (0 terrain, 1 plateforme, 2 remblai, 3 déblai), gov (plateforme qui la donne, -1 sinon), tn }
            const at = (x, y, tnIn) => {
                const tn = tnIn !== undefined ? tnIn : tinZ(x, y, tin);
                let wi = -1; for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; if (!inB(p.bb0, x, y) || !pointInPolygon(x, y, p.ring)) continue; if (wi < 0 || wins(p, P[wi])) wi = k; }
                for (let i = wi; i >= 0; i = -1) { const p = P[i];
                    const zj = p.S.flat ? p.zp : platZAt(p.S, x, y);
                    // plateforme plus basse qu'une voisine : le talus de la plateforme haute descend sur elle (la plateforme haute garde toute sa surface)
                    let best = null;
                    for (let m = 0; m < P.length; m++) { if (m === i) continue; const q = P[m]; if (!q.on || !inB(q.bb, x, y) || (inB(q.bb0, x, y) && pointInPolygon(x, y, q.ring))) continue;
                        const e = edgeOf(q, x, y); if (!e || offAt(q, e) || !limOK(q, e, x, y)) continue;   // tous les talus sont modélisés ensemble : celui du dessus l'emporte, même sur une autre plateforme
                        if (e.z > zj + 0.5) {   // plateforme plus haute : son talus descend sur celle-ci
                            const tnE = tinZ(e.px, e.py, tin), remE = !hasZ(tnE) || e.z >= tnE, k = kAt(q, e, remE), zd = e.z - worldToMm(remE ? e.d : dOf(q, e, x, y)) / k;   // pente de remblai si la plateforme haute est en remblai à ce bord, sinon de déblai
                            if (zd > zj + 0.5 && (!best || !best.up || zd > best.z)) best = { z: zd, gov: m, up: true };
                        } else if (m > i && e.z < zj - 0.5 && !(best && best.up)) {   // plateforme plus basse dessinée après, posée dedans (fosse, bassin) : talus de déblai qui remonte jusqu'au niveau de celle-ci
                            const zc = e.z + worldToMm(dOf(q, e, x, y)) / kAt(q, e, false);
                            if (zc < zj - 0.5 && (!best || zc < best.z)) best = { z: zc, gov: m, up: false }; } }
                    if (best) return { z: best.z, kind: 4, gov: best.gov, tn, base: zj, under: i };
                    return { z: zj, kind: 1, gov: i, tn }; }
                if (!hasZ(tn)) return null;
                let rMax = -Infinity, ri = -1, dMin = Infinity, di = -1;
                for (let i = 0; i < P.length; i++) { const p = P[i]; if (!p.on || !inB(p.bb, x, y)) continue;
                    const e = p.segs ? edgeOf(p, x, y) : nearOnRing(x, y, p.ring, p.S.flat ? p.zp : undefined); if (!e || offAt(p, e) || !limOK(p, e, x, y)) continue;
                    const r = e.z - worldToMm(e.d) / kAt(p, e, true), c = e.z + worldToMm(dOf(p, e, x, y)) / kAt(p, e, false);   // recul R : décale la BASE du talus de déblai (au niveau de la plateforme), le remblai part du bord
                    if (r > rMax) { rMax = r; ri = i; } if (c < tn && c < dMin) { dMin = c; di = i; } }   // un cône de déblai ne compte que là où il entaille vraiment le terrain
                // terrain de base : le naturel, ou le fond creusé par un déblai ; un remblai se pose PAR-DESSUS (il descend jusque sur le talus de déblai voisin, sans falaise)
                let z = tn, gov = -1;
                if (dMin < z) { z = dMin; gov = di; }
                if (rMax > z) { z = rMax; gov = rMax < tn - 0.5 && di >= 0 ? di : ri; }
                const kind = gov < 0 ? 0 : z > tn + 0.5 ? 2 : z < tn - 0.5 ? 3 : 0;
                return { z, kind, gov: kind ? gov : -1, tn };
            };
            const M = { tin, P, at, sig };
            if (!override && !tinIn && !skip && !ff) FM_CACHE = M;
            return M;
        }
        // Volumes des talus attribués à la plateforme n° idx du modèle (mailles) ; g : 1 dans la plateforme, épaisseur > 0 dans ses talus, -1 ailleurs
        function cubatureTalusModel(M, idx, maxCells) {
            const p = M.P[idx], b = p.bb;
            const cell = Math.max(Math.sqrt((b.x1 - b.x0) * (b.y1 - b.y0) / (maxCells || 90000)), mmToWorld(20)), nx = Math.ceil((b.x1 - b.x0) / cell), ny = Math.ceil((b.y1 - b.y0) / cell), cA = Math.pow(mOf(cell), 2);
            const g = new Float64Array(nx * ny), gv = new Int32Array(nx * ny).fill(-2); let rem = 0, deb = 0, sR = 0, sD = 0, cut = false, ovRem = 0, ovDeb = 0, ovA = 0, pitV = 0;
            // fosse : plateforme posée dans une plateforme plus haute (dessinée avant) → volume du vide creusé dans celle-ci
            const cont = M.P.map((q, m) => m).filter(m => m < idx && M.P[m].S.flat && M.P[m].zp > p.S.zmax + 0.5 && p.ring.every(v => pointInPolygon(v.x, v.y, M.P[m].ring)));
            const pitIn = cont.length ? cont[cont.length - 1] : -1;
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
                const x = b.x0 + (i + 0.5) * cell, y = b.y0 + (j + 0.5) * cell, k = j * nx + i, r = M.at(x, y);
                if (!r) { g[k] = NaN; continue; }
                gv[k] = r.gov;
                // maille à cheval sur le bord de la plateforme : on ne compte que sa part extérieure (bord rectiligne)
                const nearE = x > p.bb0.x0 - cell && x < p.bb0.x1 + cell && y > p.bb0.y0 - cell && y < p.bb0.y1 + cell ? distToPoly(x, y, p.ring) : Infinity;
                if (r.kind === 1 && r.gov !== idx && x >= p.bb0.x0 && x <= p.bb0.x1 && y >= p.bb0.y0 && y <= p.bb0.y1 && pointInPolygon(x, y, p.ring)) {
                    // plateformes qui se recouvrent : la zone commune appartient à celle qui est dessus (dessinée après) ; on la retire du calcul exact de celle-ci
                    ovA += cA; if (hasZ(r.tn)) { const zi = p.S.flat ? p.zp : platZAt(p.S, x, y), v = zi - r.tn; if (v > 0) ovRem += v / 1000 * cA; else ovDeb += -v / 1000 * cA; } }
                if (r.kind === 1 && r.gov === idx && pitIn >= 0) pitV += (M.P[pitIn].zp - r.z) / 1000 * cA;
                if (r.kind === 4 && r.gov === idx && r.z < r.base) pitV += (r.base - r.z) / 1000 * cA;
                if (r.kind === 1) { g[k] = r.gov === idx ? 1 : -1;
                    if (r.gov === idx && p.on && nearE < cell / 2 && hasZ(r.tn)) { const fo = 0.5 - nearE / cell, v = r.z - r.tn;
                        if (v > 0) { rem += v / 1000 * cA * fo; sR += cA * fo; } else { deb += -v / 1000 * cA * fo; sD += cA * fo; } }
                    continue; }
                if (r.kind === 4) {   // talus d'une plateforme haute posé sur la plateforme basse n° r.under : la différence est comptée avec la plateforme basse
                    if (r.under === idx && hasZ(r.tn)) { const dR = Math.max(0, r.z - r.tn) - Math.max(0, r.base - r.tn), dD = Math.max(0, r.tn - r.z) - Math.max(0, r.tn - r.base);
                        rem += dR / 1000 * cA; deb += dD / 1000 * cA; }
                    g[k] = r.gov === idx ? Math.max((r.z - r.base) / 1000, 1e-6) : -1; continue; }
                if (r.gov !== idx) { g[k] = -1; continue; }
                const v = r.z - r.tn, fo = nearE < cell / 2 ? 0.5 + nearE / cell : 1; g[k] = Math.max(Math.abs(v) / 1000, 1e-6);
                if (v > 0) { rem += v / 1000 * cA * fo; sR += cA * fo; } else { deb += -v / 1000 * cA * fo; sD += cA * fo; }
            }
            const links = new Set();
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
                const k = j * nx + i; if (gv[k] !== idx) continue;
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, c]) => { const ii = i + a, jj = j + c; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const q = jj * nx + ii;
                    if (isNaN(g[q]) && !(gv[k] === idx && g[k] === 1)) cut = true; if (gv[q] >= 0 && gv[q] !== idx) links.add(gv[q]); });
            }
            return { rem, deb, sR, sD, cut, links: links.size, ovRem, ovDeb, ovA, pitV, pitIn, grid: { g, nx, ny, minX: b.x0, minY: b.y0, cell } };
        }
