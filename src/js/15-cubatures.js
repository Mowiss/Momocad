        // =====================================================================
        // CUBATURES : déblai / remblai dans une emprise, terrain (MNT) contre plateforme ou surface projet
        // =====================================================================
        // Emprise : objet fermé sélectionné, ou choisi sur le plan depuis la fenêtre
        const TALUS_OPTS = ['1/1', '3/2', '2/1', '5/2', '3/1'];
        let cubEmprise = null, cubState = { step: 1, mode: 'plat', cote: '', proj: [], talus: true, kR: '3/2', kD: '1/1' }, cubResult = null;
        function empriseOf(s) {
            if (!s) return null;
            if (s.type === 'poly' && !s.open && s.points.length >= 3) return s.points.map(p => ({ x: p.x, y: p.y }));
            if (s.type === 'hatch') return s.loops[0].map(p => ({ x: p.x, y: p.y }));
            if (s.type === 'circle') { const out = []; for (let i = 0; i < 96; i++) { const a = i / 96 * 2 * Math.PI; out.push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); } return out; }
            return null;
        }
        function selectedEmprise() { for (const s of selectedShapes) { const e = empriseOf(s); if (e) return { pts: e, shape: s }; } return null; }
        // clic dans une zone fermée : la plus petite polyligne fermée / hachure / cercle qui contient le point
        function pickEmpriseAt(wx, wy) {
            let best = null, bestA = Infinity;
            for (const s of shapes) {
                if (s.gen || isBg(s)) continue; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) continue;
                const e = empriseOf(s); if (!e || !pointInPolygon(wx, wy, e)) continue;
                const a = Math.abs(polyArea(e)); if (a < bestA) { bestA = a; best = { pts: e, shape: s }; }
            }
            return best;
        }
        function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
        function polySelfX(P) { const n = P.length, X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
            if (n > 400) return false; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true; } return false; }
        function polyCentroid(pts) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], f = p.x * q.y - q.x * p.y; a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; } a /= 2; return a ? { x: cx / (6 * a), y: cy / (6 * a), a } : { x: pts[0].x, y: pts[0].y, a: 0 }; }
        // découpe d'un polygone par un demi-plan f(p) >= 0 (f linéaire) — Sutherland-Hodgman
        function clipHalf(poly, f) {
            const out = [];
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
                if (fa >= 0) out.push(a);
                if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
            }
            return out;
        }
        // Calcul EXACT contre une plateforme : par triangle du terrain, découpé par l'emprise puis par le plan de la plateforme
        function cubaturePlateforme(tn, emp, zp, S, detOut) {   // det : tableau rempli du détail par triangle du terrain (optionnel)
            if (S && !S.flat) {   // plateforme inclinée : chaque triangle du terrain × chaque triangle de la plateforme (deux plans → différence linéaire)
                let rem = 0, deb = 0, sRem = 0, sDeb = 0, sCov = 0, zInt = 0;
                const k2s = Math.pow(mOf(1), 2);
                for (let ti = 0; ti < tn.tris.length; ti++) { const t = tn.tris[ti];
                    let [A, B, C] = t.map(i => tn.nodes[i]); if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0) [B, C] = [C, B];
                    let tR = 0, tD = 0, tS = 0, tZt = 0, tZp = 0;
                    const det = (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y); if (Math.abs(det) < 1e-12) continue;
                    const a = ((B.z - A.z) * (C.y - A.y) - (C.z - A.z) * (B.y - A.y)) / det, b = ((C.z - A.z) * (B.x - A.x) - (B.z - A.z) * (C.x - A.x)) / det, c = A.z - a * A.x - b * A.y, zt = (p) => a * p.x + b * p.y + c;
                    for (const T of S.tris) {
                        let q = T.pts.map(v => ({ x: v.x, y: v.y }));
                        for (const [P0, Q0] of [[A, B], [B, C], [C, A]]) { q = clipHalf(q, (pp) => (Q0.x - P0.x) * (pp.y - P0.y) - (Q0.y - P0.y) * (pp.x - P0.x)); if (q.length < 3) break; }
                        if (q.length < 3) continue;
                        const d = (pp) => (T.a * pp.x + T.b * pp.y + T.c) - zt(pp), g = polyCentroid(q); sCov += Math.abs(g.a); zInt += Math.abs(g.a) * zt(g);
                        tS += Math.abs(g.a); tZt += Math.abs(g.a) * zt(g); tZp += Math.abs(g.a) * (T.a * g.x + T.b * g.y + T.c);
                        const qp = clipHalf(q, d), qm = clipHalf(q, (pp) => -d(pp));
                        if (qp.length >= 3) { const k = polyCentroid(qp); rem += Math.abs(k.a) * d(k); sRem += Math.abs(k.a); tR += Math.abs(k.a) * d(k); }
                        if (qm.length >= 3) { const k = polyCentroid(qm); deb += Math.abs(k.a) * -d(k); sDeb += Math.abs(k.a); tD += Math.abs(k.a) * -d(k); }
                    }
                    if (detOut && tS > 0) detOut.push({ n: ti + 1, z: [A.z, B.z, C.z], s: tS * k2s, ztn: tZt / tS, zp: tZp / tS, deb: tD * k2s / 1000, rem: tR * k2s / 1000 });
                }
                const k2 = Math.pow(mOf(1), 2);
                return { rem: rem * k2 / 1000, deb: deb * k2 / 1000, sRem: sRem * k2, sDeb: sDeb * k2, sCov: sCov * k2, zMoy: sCov ? zInt / sCov : undefined };
            }
            let rem = 0, deb = 0, sRem = 0, sDeb = 0, sCov = 0, zInt = 0; const k2f = Math.pow(mOf(1), 2);
            for (let ti = 0; ti < tn.tris.length; ti++) { const t = tn.tris[ti];
                let [A, B, C] = t.map(i => tn.nodes[i]);
                if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0) [B, C] = [C, B];   // sens trigonométrique
                // rejet rapide si le triangle est hors de la boîte de l'emprise
                let q = emp;
                for (const [P, Q] of [[A, B], [B, C], [C, A]]) { q = clipHalf(q, (p) => (Q.x - P.x) * (p.y - P.y) - (Q.y - P.y) * (p.x - P.x)); if (q.length < 3) break; }
                if (q.length < 3) continue;
                // plan du terrain sur ce triangle : z = a x + b y + c
                const det = (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y); if (Math.abs(det) < 1e-12) continue;
                const a = ((B.z - A.z) * (C.y - A.y) - (C.z - A.z) * (B.y - A.y)) / det, b = ((C.z - A.z) * (B.x - A.x) - (B.z - A.z) * (C.x - A.x)) / det, c = A.z - a * A.x - b * A.y;
                const zt = (p) => a * p.x + b * p.y + c, d = (p) => zp - zt(p);
                const g = polyCentroid(q); sCov += Math.abs(g.a); zInt += Math.abs(g.a) * zt(g);
                const qp = clipHalf(q, d), qm = clipHalf(q, (p) => -d(p)); let tR = 0, tD = 0;
                if (qp.length >= 3) { const k = polyCentroid(qp); tR = Math.abs(k.a) * d(k); rem += tR; sRem += Math.abs(k.a); }
                if (qm.length >= 3) { const k = polyCentroid(qm); tD = Math.abs(k.a) * -d(k); deb += tD; sDeb += Math.abs(k.a); }
                if (detOut) detOut.push({ n: ti + 1, z: [A.z, B.z, C.z], s: Math.abs(g.a) * k2f, ztn: zt(g), zp, deb: tD * k2f / 1000, rem: tR * k2f / 1000 });
            }
            const k2 = Math.pow(mOf(1), 2);   // monde² -> m² ; Z en mm -> m
            return { rem: rem * k2 / 1000, deb: deb * k2 / 1000, sRem: sRem * k2, sDeb: sDeb * k2, sCov: sCov * k2, zMoy: sCov ? zInt / sCov : undefined };
        }
        // Terrain contre surface projet : mailles, parcours ligne par ligne (balayage) dans l'emprise
        function cubatureSurfaces(tn, pj, emp) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; emp.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            const cell = Math.max(Math.sqrt(Math.abs(polyArea(emp)) / 60000), mmToWorld(20)), cA = cell * cell;
            let rem = 0, deb = 0, sRem = 0, sDeb = 0, sCov = 0, zInt = 0;
            for (let y = minY + cell / 2; y < maxY; y += cell) {
                const xs = []; for (let i = 0; i < emp.length; i++) { const a = emp[i], b = emp[(i + 1) % emp.length]; if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)); }
                xs.sort((u, v) => u - v);
                for (let k = 0; k + 1 < xs.length; k += 2) for (let x = minX + cell / 2 + Math.ceil((xs[k] - minX - cell / 2) / cell) * cell; x < xs[k + 1]; x += cell) {
                    const zt = tinZ(x, y, tn), zq = tinZ(x, y, pj); if (!hasZ(zt) || !hasZ(zq)) continue;
                    sCov += cA; zInt += cA * zt; const d = zq - zt; if (d > 0) { rem += d * cA; sRem += cA; } else { deb += -d * cA; sDeb += cA; }
                }
            }
            const k2 = Math.pow(mOf(1), 2);
            return { rem: rem * k2 / 1000, deb: deb * k2 / 1000, sRem: sRem * k2, sDeb: sDeb * k2, sCov: sCov * k2, zMoy: sCov ? zInt / sCov : undefined, cell: mOf(cell) };
        }
        // ---------- Talus autour de l'emprise (plateforme horizontale) ----------
        // pente notée « H/V » (ex. 3/2 = 3 m à l'horizontale pour 2 m de hauteur) -> k = H / V
        // talus propres à chaque plateforme (sinon réglage courant de l'assistant)
        function platTalus(pl) { const t = pl && pl.talus; return { on: t ? t.on !== false : cubState.talus, kR: (t && t.kR) || cubState.kR, kD: (t && t.kD) || cubState.kD, pts: !(t && t.pts === false), esp: t && isFinite(parseFloat(t.esp)) ? Math.max(0, parseFloat(t.esp)) : 10, R: t && +t.R > 0 ? +t.R : 0, edges: t && Array.isArray(t.edges) ? t.edges : null, cx: !!(t && t.cx), corn: t && t.corn ? t.corn : null }; }
        // Talus d'une plateforme en plan : crête, pied de talus et peigne (traits longs / courts depuis le haut du talus)
        const TALUS_CACHE = new WeakMap(), TALUS_KC = new Map();   /* TALUS_KC : même talus retrouvé par son contenu (après une annulation, les objets sont neufs mais identiques) */ let MOUSE_HELD = false, TALUS_STALE = false;
        window.addEventListener('mousedown', () => { MOUSE_HELD = true; }, true);
        window.addEventListener('mouseup', () => { MOUSE_HELD = false; if (TALUS_STALE) { TALUS_STALE = false; requestAnimationFrame(() => draw()); } }, true);
        function talusGeom(pl) {
            const t = platTalus(pl); if (!t.on || !isPlateforme(pl)) return null;
            const FM = finishedModel(); if (!FM) return null; const tin = FM.tin, idx = FM.P.findIndex(q => q.s === pl); if (idx < 0) return null;
            const B0 = FM.P[idx].bb, gm = Math.max(B0.x1 - B0.x0, B0.y1 - B0.y0) * 0.1 + mmToWorld(1000), B = { x0: B0.x0 - gm, y0: B0.y0 - gm, x1: B0.x1 + gm, y1: B0.y1 + gm };   /* seules les plateformes voisines (emprises qui se touchent) changent ce talus : en modifier une ailleurs ne le recalcule pas */
            const loc = FM.P.map((p, j) => p.bb && p.bb.x1 >= B.x0 && p.bb.x0 <= B.x1 && p.bb.y1 >= B.y0 && p.bb.y0 <= B.y1 ? [j, p.ring, p.zp, p.on, p.kR, p.kD, p.R, p.kRe, p.kDe, p.offE, p.corn, p.ext] : 0);
            const key = idx + '|' + JSON.stringify(loc) + JSON.stringify([t.pts, t.esp, t.cx ? (t.edges || []).map(e => e && !e.off ? e.st || 0 : 0) : 0]), c = TALUS_CACHE.get(pl); if (c && c.key === key && c.tin === tin) return c.g;
            { const k2 = TALUS_KC.get(key); if (k2 && k2.tin === tin) { TALUS_CACHE.set(pl, { key, tin, g: k2.g, t: performance.now() }); return k2.g; } }
            if (c && MOUSE_HELD && performance.now() - (c.t || 0) < 250) { TALUS_STALE = true; return c.g; }   /* pendant un glissé : talus recalculés 4 fois par seconde au plus, le dessin reste fluide ; à jour au lâcher */
            const zp = platZ(pl), P = platRing(pl), n = P.length, zE = (a, b, f) => (hasZ(a.z) && hasZ(b.z)) ? a.z + (b.z - a.z) * f : zp;
            const maxD = Math.max(FM.P[idx].ext, mmToWorld(10)) * 1.05, stepD = Math.max(maxD / 100, mmToWorld(5));
            let perim = 0; for (let i = 0; i < n; i++) perim += Math.hypot(P[(i + 1) % n].x - P[i].x, P[(i + 1) % n].y - P[i].y);
            const S = mmToWorld(Math.max(250, worldToMm(perim) / 400));
            const nrm = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.y - a.y) / L, y: -(b.x - a.x) / L }; };
            const e = mmToWorld(1); let sg = 1;   // sens de la normale extérieure
            { const a = P[0], b = P[1], m = nrm(a, b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if (pointInPolygon(mx + m.x * e, my + m.y * e, P)) sg = -1; }
            const rays = [], EXs = t.cx && pl.type === 'poly' && t.edges ? t.edges : [], stE = P.map((q, i) => { const e = EXs[i]; return e && e.st && !e.off && e.st.h > 0 && e.st.g > 0 ? e.st : null; });   // arêtes en escalier
            for (let i = 0; i < n; i++) {
                const a = P[i], b = P[(i + 1) % n], c2 = P[(i + 2) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
                const m1 = nrm(a, b), u1 = { x: m1.x * sg, y: m1.y * sg };
                for (let d = 0; d < L - 1e-9; d += S) rays.push({ c: { x: a.x + (b.x - a.x) * d / L, y: a.y + (b.y - a.y) * d / L, z: zE(a, b, d / L) }, u: u1, i });
                const m2 = nrm(b, c2), u2 = { x: m2.x * sg, y: m2.y * sg }, bis = { x: u1.x + u2.x, y: u1.y + u2.y };
                const a1 = Math.atan2(u1.y, u1.x); let da = Math.atan2(u2.y, u2.x) - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
                if (Math.abs(da) > 0.2 && !pointInPolygon(b.x + bis.x * e, b.y + bis.y * e, P)) {   // angle saillant : éventail arrondi
                    const r = Math.max(S, mmToWorld(500)), m = Math.ceil(Math.abs(da) * r / S);
                    for (let k = 0; k <= m; k++) { const an = a1 + da * k / m; rays.push({ c: { x: b.x, y: b.y, z: hasZ(b.z) ? b.z : zp }, u: { x: Math.cos(an), y: Math.sin(an) } }); }
                }
            }
            const TN = (c, u, d) => tinZ(c.x + u.x * d, c.y + u.y * d, tin);
            // descend (ou monte) le long d'un rayon jusqu'au terrain ; la cote projet suit la distance réelle à la plateforme
            // le long du rayon, on reste sur le talus de CETTE plateforme : arrêt au terrain naturel, sur le talus d'une autre plateforme ou sur une autre plateforme
            const RR = FM.P[idx].ringR;
            const march = (c, u, useMed) => {
                // recul : en déblai, le talus commence au fond de fouille agrandi (polygone décalé de R), pas au bord de la plateforme
                let s0 = 0; if (RR) { const r0 = FM.at(c.x + u.x * e, c.y + u.y * e); if (r0 && r0.kind === 3 && r0.gov === idx) { const inR = (d) => pointInPolygon(c.x + u.x * d, c.y + u.y * d, RR);
                    let a = 0, b = e; while (inR(b) && b < maxD) { a = b; b += stepD; } for (let it = 0; it < 12; it++) { const m = (a + b) / 2; if (inR(m)) a = m; else b = m; } s0 = a; c = { x: c.x + u.x * s0, y: c.y + u.y * s0, z: c.z }; } }
                const at = (d) => FM.at(c.x + u.x * d, c.y + u.y * d);
                if (!hasZ(TN(c, u, e))) return null;
                // au-delà de la bissectrice d'un angle rentrant, le point est plus près d'un autre bord : le rayon s'arrête là
                const med = (d) => useMed && distToPoly(c.x + u.x * d, c.y + u.y * d, P) < (d + s0) * 0.995 - e;
                const mine = (d) => { if (med(d)) return false; const r = at(d); return !!(r && r.gov === idx && r.kind > 1); };
                let d0 = 0, d1 = null, cut = false;
                if (mine(e)) {
                    for (let d = stepD; d <= maxD; d += stepD) { if (!mine(d)) { d1 = d; cut = med(d); break; } d0 = d; }
                    if (d1 !== null) for (let it = 0; it < 14; it++) { const m = (d0 + d1) / 2; if (mine(m)) d0 = m; else d1 = m; }
                }
                const zc = hasZ(c.z) ? c.z : zp, D = d0, r = at(D) || { z: zc };
                // arrêt contre le talus (ou la plateforme) d'une autre plateforme : ligne de raccordement, tracée une seule fois
                const rn = d1 !== null ? at(d1 + e) : null, other = rn && rn.kind > 1 && rn.gov >= 0 && rn.gov !== idx ? rn.gov : -1;
                return { D, cut, other, rem: r.z < zc, T: { x: c.x + u.x * D, y: c.y + u.y * D, z: D > 0 ? r.z : zc }, C: { x: c.x, y: c.y, z: zc } };
            };
            const ticks = [], toe = [], parts = []; let k = 0, part = null, prev = null;
            // pied de talus en tronçons : coupé là où il n'y a pas de talus (bord contre une autre plateforme, angle rentrant) ou en cas de saut (évite les cordes en travers)
            const cutPart = () => { if (part && part.length >= 2) parts.push(part); part = null; };
            const addToe = (T, c, u, D) => {
                if (prev) { const ang = Math.acos(Math.max(-1, Math.min(1, u.x * prev.u.x + u.y * prev.u.y))), exp = Math.hypot(c.x - prev.c.x, c.y - prev.c.y) + Math.max(D, prev.D) * ang;
                    if (Math.hypot(T.x - prev.T.x, T.y - prev.T.y) > 2 * exp + mmToWorld(200)) cutPart(); }
                (part = part || []).push(T); prev = { T, c, u, D };
            };
            rays.forEach(({ c, u, i: ri }) => {
                const M = march(c, u, true); if (!M) { toe.push({ x: c.x, y: c.y, z: hasZ(c.z) ? c.z : zp }); cutPart(); prev = null; return; }
                const { D, cut, rem, T, C, other } = M;
                if (!cut) toe.push(T);   // rayon arrêté dans un angle rentrant : pas un point du pied
                // raccord avec la plateforme voisine : la ligne commune n'est tracée que par l'une des deux (sinon deux traits qui se croisent)
                const dup = other >= 0 && other < idx;
                if (!cut && !dup && D > mmToWorld(5)) addToe(T, c, u, D); else { cutPart(); prev = null; }
                if (D > mmToWorld(5) && !(ri >= 0 && stE[ri])) { const top = rem ? C : T, bot = rem ? T : C, h = (k++ % 2) ? 0.5 : 1;
                    ticks.push([top, { x: top.x + (bot.x - top.x) * h, y: top.y + (bot.y - top.y) * h, z: top.z + (bot.z - top.z) * h }]); }
            });
            // quelques points topo en nez (haut) et pied (bas) de talus : angles + intermédiaires tous les « esp » mètres
            const marks = [];
            if (t.pts) {
                const add = (c, u) => { const L = Math.hypot(u.x, u.y); if (L < 1e-9) return; const M = march(c, { x: u.x / L, y: u.y / L }, false);
                    if (!M || M.D < mmToWorld(5)) return; marks.push(M.rem ? { nez: M.C, pied: M.T } : { nez: M.T, pied: M.C }); };
                const espW = mmToWorld(t.esp * 1000);
                if (pl.type === 'circle') {
                    const N = t.esp > 0 ? Math.max(4, Math.round(2 * Math.PI * pl.r / espW)) : 4;
                    for (let j = 0; j < N; j++) { const an = 2 * Math.PI * j / N; add({ x: pl.x + pl.r * Math.cos(an), y: pl.y + pl.r * Math.sin(an) }, { x: Math.cos(an), y: Math.sin(an) }); }
                } else for (let i = 0; i < n; i++) {
                    const a = P[i], b = P[(i + 1) % n], c2 = P[(i + 2) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
                    const m1 = nrm(a, b), u1 = { x: m1.x * sg, y: m1.y * sg }, m2 = nrm(b, c2), u2 = { x: m2.x * sg, y: m2.y * sg };
                    const cnt = t.esp > 0 ? Math.max(0, Math.round(L / espW) - 1) : 0;
                    for (let j = 1; j <= cnt; j++) { const q = j / (cnt + 1); add({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, z: zE(a, b, q) }, u1); }
                    add({ x: b.x, y: b.y, z: hasZ(b.z) ? b.z : zp }, { x: u1.x + u2.x, y: u1.y + u2.y });   // angle : sur la bissectrice
                }
            }
            cutPart();
            if (parts.length >= 2) { const a = parts[parts.length - 1], b = parts[0], e1 = a[a.length - 1], s0 = b[0];
                if (Math.hypot(e1.x - s0.x, e1.y - s0.y) < 2 * S + mmToWorld(200)) { parts[0] = a.concat(b); parts.pop(); } }
            // escaliers : sur chaque arête concernée, des tronçons de 25 cm ; nombre de marches entières que la longueur du talus permet
            const stairs = [];
            stE.forEach((st, i) => { if (!st) return; const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) return;
                const m1 = nrm(a, b), u = { x: m1.x * sg, y: m1.y * sg }, gW = mmToWorld(st.g), m = Math.max(1, Math.min(400, Math.ceil(L / mmToWorld(250)))), pieces = [];
                for (let q = 0; q < m; q++) { const f = (q + 0.5) / m, c = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: zE(a, b, f) }, M = march(c, u, true);
                    if (!M || M.D < gW * 0.999) { pieces.push({ f0: q / m, f1: (q + 1) / m, Ns: 0 }); continue; }
                    pieces.push({ f0: q / m, f1: (q + 1) / m, s0: Math.hypot(M.C.x - c.x, M.C.y - c.y), Ns: Math.floor(M.D / gW + 1e-6), rem: M.rem, zc: M.C.z }); }
                if (pieces.some(pc => pc.Ns > 0)) stairs.push({ i, a, b, u, gW, st, pieces }); });
            const g = { toe, toeParts: parts, ticks, marks, stairs };
            TALUS_CACHE.set(pl, { key, tin, g, t: performance.now() }); TALUS_KC.set(key, { tin, g }); if (TALUS_KC.size > 300) TALUS_KC.delete(TALUS_KC.keys().next().value); return g;
        }
        // maillage 3D des solides ajoutés : tube, tronc de cône, pyramide, tore, révolution
        function solidMesh3D(so, P, z0, Hm, exag, mat, ext) {
            const k = so.solid.kind;
            if (k === 'roof') { so.points.forEach(q => ext(P(q.x, q.y))); return new THREE.Mesh(roofMesh(so, P, z0, exag), mat); }
            if (k === 'pyr') {
                const B = so.points.map(q => P(q.x, q.y)), n = B.length, cx = B.reduce((a, q) => a + q.x, 0) / n, cy = B.reduce((a, q) => a + q.y, 0) / n, t = Math.max(0, Math.min(1, so.solid.k || 0));
                const T = B.map(q => ({ x: cx + (q.x - cx) * t, y: cy + (q.y - cy) * t })), pos = [];
                B.forEach(ext);
                const tri = (a, za, b, zb, c, zc) => pos.push(a.x, a.y, za, b.x, b.y, zb, c.x, c.y, zc);
                const ccw = B.reduce((a, q, i) => { const r = B[(i + 1) % n]; return a + q.x * r.y - r.x * q.y; }, 0) > 0;
                for (let i = 0; i < n; i++) { const j = (i + 1) % n, [a, b] = ccw ? [i, j] : [j, i];
                    if (t > 0) { tri(B[a], z0, B[b], z0, T[b], z0 + Hm); tri(B[a], z0, T[b], z0 + Hm, T[a], z0 + Hm); } else tri(B[a], z0, B[b], z0, { x: cx, y: cy }, z0 + Hm); }
                const f = THREE.ShapeUtils.triangulateShape(B.map(q => new THREE.Vector2(q.x, q.y)), []);
                f.forEach(([a, b, c]) => { if (ccw) tri(B[c], z0, B[b], z0, B[a], z0); else tri(B[a], z0, B[b], z0, B[c], z0);
                    if (t > 0) { if (ccw) tri(T[a], z0 + Hm, T[b], z0 + Hm, T[c], z0 + Hm); else tri(T[c], z0 + Hm, T[b], z0 + Hm, T[a], z0 + Hm); } });
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
                return new THREE.Mesh(g, mat);
            }
            const c = P(so.x, so.y), r = worldToMm(so.r) / 1000; ext({ x: c.x - r, y: c.y - r }); ext({ x: c.x + r, y: c.y + r });
            let g;
            if (k === 'tube') { const ri = Math.max(0.001, r - (so.solid.e || 0) / 1000), shp = new THREE.Shape(); shp.absarc(0, 0, r, 0, 2 * Math.PI, false); const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, 2 * Math.PI, true); shp.holes.push(hole);
                g = new THREE.ExtrudeGeometry(shp, { depth: Math.max(Hm, 1e-3), bevelEnabled: false, curveSegments: 48 }); g.translate(c.x, c.y, z0); }
            else if (k === 'tcone') { const r2 = Math.max(0, Math.min(r, (so.solid.r2 || 0) / 1000)); g = new THREE.CylinderGeometry(r2, r, Math.max(Hm, 1e-3), 48); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, z0 + Hm / 2); }
            else if (k === 'torus') { const a = Math.max(0.001, (so.solid.a || 0) / 1000); ext({ x: c.x - r - a, y: c.y - r - a }); ext({ x: c.x + r + a, y: c.y + r + a }); g = new THREE.TorusGeometry(r, a, 24, 72); g.scale(1, 1, exag); g.translate(c.x, c.y, z0 + a * exag); }
            else if (k === 'rev') { const pr = so.solid.prof || []; if (pr.length < 3) return null; const pts = pr.concat([pr[0]]).map(q => new THREE.Vector2(Math.max(0, q[0] / 1000), q[1] / 1000));
                g = new THREE.LatheGeometry(pts, 64); g.rotateX(Math.PI / 2); g.scale(1, 1, exag); g.translate(c.x, c.y, z0); }
            return g ? new THREE.Mesh(g, Object.assign(mat, { side: THREE.DoubleSide })) : null;
        }
        // Solide 3D vu en plan : pavé = diagonales, cylindre = croix, cône = rayons vers le sommet, sphère = équateur
        function drawSolid2D(ctx, s, col, dx, dy, ls) {
            const k = s.solid.kind; ctx.save(); ctx.strokeStyle = col;
            if (holesOf(s).length) { ctx.lineWidth = 1 / ls; ctx.setLineDash([]); ctx.beginPath(); holesOf(s).forEach(h => { ctx.moveTo(h[0].x + dx, h[0].y + dy); h.forEach(p => ctx.lineTo(p.x + dx, p.y + dy)); ctx.closePath(); }); ctx.stroke(); }
            ctx.lineWidth = 0.8 / ls; ctx.setLineDash([4 / ls, 3 / ls]); ctx.beginPath();
            if (k === 'box') { const p = s.points; if (p.length >= 4) { ctx.moveTo(p[0].x + dx, p[0].y + dy); ctx.lineTo(p[2].x + dx, p[2].y + dy); ctx.moveTo(p[1].x + dx, p[1].y + dy); ctx.lineTo(p[3].x + dx, p[3].y + dy); } }
            else { const X = s.x + dx, Y = s.y + dy, r = s.r;
                if (k === 'cyl') { ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r); }
                else if (k === 'cone') { ctx.setLineDash([]); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; ctx.moveTo(X, Y); ctx.lineTo(X + r * Math.cos(t), Y + r * Math.sin(t)); } }
                else if (k === 'sphere') { ctx.ellipse(X, Y, r, r * 0.35, 0, 0, 2 * Math.PI); ctx.moveTo(X + r * 0.35, Y); ctx.ellipse(X, Y, r * 0.35, r, 0, 0, 2 * Math.PI); }
                else if (k === 'tube') { ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); const ri = Math.max(0, r - mmToWorld(s.solid.e || 0)); ctx.moveTo(X + ri, Y); ctx.arc(X, Y, ri, 0, 2 * Math.PI); }
                else if (k === 'tcone') { const r2 = Math.min(r, mmToWorld(s.solid.r2 || 0)); ctx.moveTo(X + r2, Y); ctx.arc(X, Y, r2, 0, 2 * Math.PI); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; ctx.moveTo(X + r2 * Math.cos(t), Y + r2 * Math.sin(t)); ctx.lineTo(X + r * Math.cos(t), Y + r * Math.sin(t)); } }
                else if (k === 'torus') { ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); const a = mmToWorld(s.solid.a || 0); [r - a, r + a].forEach(rr => { if (rr > 0) { ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, 2 * Math.PI); } }); }
                else if (k === 'rev') { const pr = s.solid.prof || []; const rs = pr.map(q => q[0]), rmin = rs.length ? mmToWorld(Math.min(...rs)) : 0; if (rmin > 0) { ctx.moveTo(X + rmin, Y); ctx.arc(X, Y, rmin, 0, 2 * Math.PI); } ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r); } }
            if (k === 'roof') { ctx.stroke(); ctx.restore(); drawRoof2D(ctx, s, col, dx, dy, ls); return; }
            if (k === 'pyr') { const p = s.points, c = polyCentroid(p), t = Math.max(0, Math.min(1, s.solid.k || 0)), T = p.map(q => ({ x: c.x + (q.x - c.x) * t, y: c.y + (q.y - c.y) * t }));
                p.forEach((q, i) => { ctx.moveTo(q.x + dx, q.y + dy); ctx.lineTo(T[i].x + dx, T[i].y + dy); });
                if (t > 0) { ctx.moveTo(T[0].x + dx, T[0].y + dy); T.forEach(q => ctx.lineTo(q.x + dx, q.y + dy)); ctx.closePath(); } }
            ctx.stroke(); ctx.restore();
            if (tiltOf(s)) drawTilt2D(ctx, s, col, dx, dy, ls);
        }
        // limites de refoulement par sommet (degrés) : réglées à la main (talus.corn), sinon 0 aux bouts d'un talus en escalier (les marches s'arrêtent net)
        function talCorners(pl) { const t = platTalus(pl); if (!t.on || pl.type !== 'poly') return null; const n = pl.points.length, E = t.cx && t.edges ? t.edges : [], C = t.corn || {}, out = {}; let any = false;
            for (let k = 0; k < n; k++) { let v = C[k]; if (v === undefined) { const a = E[(k - 1 + n) % n], b = E[k]; if ((a && a.st && !a.off) || (b && b.st && !b.off)) v = 0; } if (v !== undefined && v !== null) { out[k] = +v; any = true; } }
            return any ? out : null; }
        function talRingR(pl) {   // fond de fouille agrandi (recul R, éventuellement par arête), ou null
            const t = platTalus(pl); if (!pl || pl.type !== 'poly') return null; const EX = t.cx && t.edges ? t.edges : null;
            const Rs = pl.points.map((q, i) => { const e = EX && EX[i]; return mmToWorld(e && e.R !== undefined ? +e.R || 0 : t.R); }); return Rs.some(v => v > 0) ? polyOffsetVar(pl.points, Rs) : null;
        }
        // parois d'une plateforme : géométrie commune au plan et à la 3D. Une arête de paroi n'a pas de voile là où elle est sous une plateforme plus haute (côté plateforme),
        // ni là où, de l'autre côté, se trouve une plateforme aussi haute ou plus haute (c'est elle qui tient la marche, ou il n'y a pas de marche)
        function paroiCovered(FM, myI, ring, x, y, nx, ny, zp) { const e = mmToWorld(60), ix = x - nx * e, iy = y - ny * e, ox = x + nx * e, oy = y + ny * e;
            const ri = pointInPolygon(ix, iy, ring) ? FM.at(ix, iy) : null; if (ri && ri.kind === 1 && ri.gov !== myI) return true;
            const ro = !pointInPolygon(ox, oy, ring) ? FM.at(ox, oy) : null; return !!(ro && ro.kind === 1 && ro.gov !== myI && ro.z >= zp - 50); }
        // décalage de la face extérieure au sommet k (entre l'arête k-1 et l'arête k) : onglet si les deux arêtes sont en paroi, sinon perpendiculaire à l'arête
        function paroiVOff(P, sg, E, k, side) { const n = P.length, nOf = (i) => { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / L * sg, y: (b.x - a.x) / L * sg }; }, wOf = (i) => mmToWorld((E[i] && E[i].pe) || 200);
            const kp = (k - 1 + n) % n, own = side === 'start' ? k : kp, other = side === 'start' ? kp : k, n1 = nOf(own), e1 = wOf(own); if (!(E[other] && E[other].off)) return { x: n1.x * e1, y: n1.y * e1 };
            const n2 = nOf(other), e2 = wOf(other), det = n1.x * n2.y - n1.y * n2.x; if (Math.abs(det) < 1e-6) return { x: n1.x * e1, y: n1.y * e1 };
            const o = { x: (e1 * n2.y - e2 * n1.y) / det, y: (n1.x * e2 - n2.x * e1) / det }, lo = Math.hypot(o.x, o.y), mx = 4 * Math.max(e1, e2); return lo > mx ? { x: o.x * mx / lo, y: o.y * mx / lo } : o; }
        function drawParois2D(ctx, pl, col, dx, dy, ls) {   // arêtes « paroi » : voile hachuré côté extérieur, angles en onglet comme en 3D, + désignation
            const t = platTalus(pl); if (!t.edges || pl.type !== 'poly') return; const P = pl.points, n = P.length, E = t.edges; let A2 = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; A2 += a.x * b.y - b.x * a.y; } const sg = A2 > 0 ? -1 : 1;
            const FMd = finishedModel(), myI = FMd ? FMd.P.findIndex(q => q.s === pl) : -1, zp = hasZ(P[0].z) ? P[0].z : platZ(pl);
            E.forEach((e, i) => { if (!e || !e.off || i >= n) return; const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) return;
                const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy * sg, ny = ux * sg, w = mmToWorld(e.pe || 200);
                const ns = Math.max(1, Math.min(80, Math.ceil(L / mmToWorld(500)))), cov = [];
                for (let j = 0; j < ns; j++) { const f = (j + 0.5) / ns; cov.push(!!(FMd && myI >= 0 && paroiCovered(FMd, myI, FMd.P[myI].ring, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, nx, ny, zp))); }
                const runs = []; let r0 = null; cov.forEach((c, j) => { if (!c && r0 === null) r0 = j; if ((c || j === ns - 1) && r0 !== null) { runs.push([r0 / ns, (c ? j : j + 1) / ns]); r0 = null; } }); if (!runs.length) return;
                const oS = paroiVOff(P, sg, E, i, 'start'), oE = paroiVOff(P, sg, E, (i + 1) % n, 'end'), ws = Math.max(w, 3 / ls), k = ws / w;
                runs.forEach(([t0, t1]) => { const A = { x: a.x + (b.x - a.x) * t0 + dx, y: a.y + (b.y - a.y) * t0 + dy }, B = { x: a.x + (b.x - a.x) * t1 + dx, y: a.y + (b.y - a.y) * t1 + dy };
                    const oa = t0 === 0 ? { x: oS.x * k, y: oS.y * k } : { x: nx * ws, y: ny * ws }, ob = t1 === 1 ? { x: oE.x * k, y: oE.y * k } : { x: nx * ws, y: ny * ws };
                    const poly = [A, B, { x: B.x + ob.x, y: B.y + ob.y }, { x: A.x + oa.x, y: A.y + oa.y }];
                    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = 1.2 / ls; ctx.beginPath(); poly.forEach((q, m) => m ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); ctx.clip();
                    // hachures à pas constant à l'écran (pas des traits espacés comme l'épaisseur)
                    const st = 7 / ls, Lr = L * (t1 - t0) + 2 * Math.hypot(oa.x, oa.y) + 2 * ws; ctx.lineWidth = 0.7 / ls; ctx.beginPath();
                    for (let d = -ws * 2 - Math.hypot(oa.x, oa.y); d < Lr; d += st) { const x0 = A.x + ux * d, y0 = A.y + uy * d; ctx.moveTo(x0 - nx * ws, y0 - ny * ws); ctx.lineTo(x0 + ux * ws * 2 + nx * ws * 2, y0 + uy * ws * 2 + ny * ws * 2); } ctx.stroke(); ctx.restore(); });
                // désignation sur la plus longue partie visible, décalée du milieu de l'arête (poignées, pastille du réglage par arête : aucun chevauchement)
                const [t0, t1] = runs.reduce((m, r) => r[1] - r[0] > m[1] - m[0] ? r : m), Lr = L * (t1 - t0), A = { x: a.x + (b.x - a.x) * t0 + dx, y: a.y + (b.y - a.y) * t0 + dy };
                const txt = e.pl || 'Paroi', tw = (txt.length * 7 + 24) / ls, mid = (t0 + t1) / 2 === 0.5, f = Lr > 2 * tw + 60 / ls && mid ? 0.5 - (tw / 2 + 30 / ls) / Lr : 0.5, off = (f === 0.5 && mid ? 44 : 12) / ls + ws;
                dimensionTextsToDraw.push({ text: txt, worldX: A.x + ux * Lr * f + nx * off, worldY: A.y + uy * Lr * f + ny * off, color: col, layerId: pl.layerId, angle: Math.atan2(uy, ux), al: true }); });
        }
        // nez de marche d'un talus en escalier : un trait parallèle à l'arête tous les girons, là où la marche est entière
        function talStairRuns(S) { const out = [], mx = Math.max(0, ...S.pieces.map(p => p.Ns)), at = (f, d) => ({ x: S.a.x + (S.b.x - S.a.x) * f + S.u.x * d, y: S.a.y + (S.b.y - S.a.y) * f + S.u.y * d });
            for (let j = 1; j <= mx; j++) { let r = null; S.pieces.forEach((p, k) => { const ok = p.Ns >= j; if (ok && !r) r = { f0: p.f0, s0: p.s0 }; if (ok) { r.f1 = p.f1; r.s1 = p.s0; } if ((!ok || k === S.pieces.length - 1) && r) { out.push([at(r.f0, r.s0 + j * S.gW), at(r.f1, r.s1 + j * S.gW)]); r = null; } }); }
            return out; }
        function drawTalus2D(ctx, pl, col, dx, dy, lineScale) {
            drawParois2D(ctx, pl, col, dx, dy, lineScale);
            { const t = platTalus(pl), RP = t.on ? talRingR(pl) : null; if (RP) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1 / lineScale; ctx.setLineDash([7 / lineScale, 5 / lineScale]); ctx.beginPath(); RP.forEach((q, i) => i ? ctx.lineTo(q.x + dx, q.y + dy) : ctx.moveTo(q.x + dx, q.y + dy)); ctx.closePath(); ctx.stroke(); ctx.restore(); } }   // fond de fouille agrandi (recul R), en pointillé
            const G = talusGeom(pl); if (!G || !G.toe.length) return;
            ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = 1 / lineScale;
            ctx.beginPath(); (G.toeParts || []).forEach(pt => pt.forEach((q, i) => i ? ctx.lineTo(q.x + dx, q.y + dy) : ctx.moveTo(q.x + dx, q.y + dy))); ctx.stroke();
            ctx.lineWidth = 0.7 / lineScale; ctx.beginPath(); G.ticks.forEach(([a, b]) => { ctx.moveTo(a.x + dx, a.y + dy); ctx.lineTo(b.x + dx, b.y + dy); }); ctx.stroke();
            if ((G.stairs || []).length) { ctx.lineWidth = 1 / lineScale; ctx.beginPath(); G.stairs.forEach(S => talStairRuns(S).forEach(([A, B]) => { ctx.moveTo(A.x + dx, A.y + dy); ctx.lineTo(B.x + dx, B.y + dy); })); ctx.stroke(); }
            // points topo nez / pied : croix + altitude, sur leur propre calque « Cotes de talus » (masquable sans toucher au talus, couleur à part)
            const LT = talusCotLayer(); if (LT && LT.visible === false) { ctx.restore(); return; } const colT = (LT && LT.color) || col;
            const tk = 4 / lineScale; ctx.strokeStyle = colT; ctx.lineWidth = 1.2 / lineScale; ctx.beginPath();
            G.marks.forEach(m => [m.nez, m.pied].forEach(q => { const X = q.x + dx, Y = q.y + dy; ctx.moveTo(X - tk, Y); ctx.lineTo(X + tk, Y); ctx.moveTo(X, Y - tk); ctx.lineTo(X, Y + tk);
                screenTextsToDraw.push({ kind: 'text', layerId: LT ? LT.id : pl.layerId, wx: X + 6 / camera.zoom, wy: Y - 3 / camera.zoom, lines: [fmtZ(q.z)], color: colT, small: true, alt: true }); }));
            ctx.stroke();
            ctx.restore();
        }
        function refresh3D() { if (typeof is3DOpen === 'function' && is3DOpen()) { build3DScene(); render3D(); } }
        function talusOk(t) { return /^\s*[\d.,]+\s*(\/\s*[\d.,]+)?\s*$/.test(String(t)) && talusK(t) > 0; }
        function talusK(t) { const m = String(t).replace(/,/g, '.').match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/); if (m) return parseFloat(m[1]) / parseFloat(m[2]); const v = parseFloat(String(t).replace(',', '.')); return v > 0 ? v : 1.5; }
        // polygone / polyligne décalé de d (monde) : d > 0 vers l'extérieur (fermé) ou à gauche du sens (ouvert) ; angles en onglet, limités
        function polyOffsetPts(pts, d, closed) {
            const n = pts.length; if (n < 2) return pts.map(q => ({ x: q.x, y: q.y }));
            let A = 0; if (closed) for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a.x * b.y - b.x * a.y; }
            const sg = closed ? (A > 0 ? -1 : 1) : 1;   // normale « gauche » (-dy, dx) ; repère écran (y vers le bas) : aire > 0 = sens horaire à l'écran
            const nrm = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / L * sg, y: (b.x - a.x) / L * sg }; };
            const out = [];
            for (let i = 0; i < n; i++) {
                const hasP = closed || i > 0, hasN = closed || i < n - 1, P0 = pts[(i - 1 + n) % n], P1 = pts[i], P2 = pts[(i + 1) % n];
                const n0 = hasP ? nrm(P0, P1) : null, n1 = hasN ? nrm(P1, P2) : null;
                if (!n0 || !n1) { const m = n0 || n1; out.push({ x: P1.x + m.x * d, y: P1.y + m.y * d, z: P1.z }); continue; }
                const bx = n0.x + n1.x, by = n0.y + n1.y, bl = Math.hypot(bx, by);
                if (bl < 1e-9) { out.push({ x: P1.x + n0.x * d, y: P1.y + n0.y * d, z: P1.z }); continue; }
                const cosH = (bx * n1.x + by * n1.y) / bl, k = d / Math.max(cosH, 1e-6);
                if (Math.abs(k) > 4 * Math.abs(d)) { out.push({ x: P1.x + n0.x * d, y: P1.y + n0.y * d, z: P1.z }, { x: P1.x + n1.x * d, y: P1.y + n1.y * d, z: P1.z }); }   // angle très aigu : chanfrein
                else out.push({ x: P1.x + bx / bl * k, y: P1.y + by / bl * k, z: P1.z });
            }
            return out;
        }
        // polygone fermé décalé arête par arête : ds[i] = décalage de l'arête i (sommet i → i+1), vers l'extérieur
        function polyOffsetVar(pts, ds) {
            const n = pts.length; if (n < 3) return pts.map(q => ({ x: q.x, y: q.y }));
            if (ds.every(d => Math.abs(d - ds[0]) < 1e-9)) return polyOffsetPts(pts, ds[0], true);
            let A = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a.x * b.y - b.x * a.y; } const sg = A > 0 ? -1 : 1;
            const Ls = pts.map((a, i) => { const b = pts[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, nn = { x: -u.y * sg, y: u.x * sg }; return { p: { x: a.x + nn.x * ds[i], y: a.y + nn.y * ds[i] }, u, nn }; });
            return pts.map((v, i) => { const A1 = Ls[(i - 1 + n) % n], B1 = Ls[i], den = A1.u.x * B1.u.y - A1.u.y * B1.u.x;
                if (Math.abs(den) < 1e-9) return { x: v.x + B1.nn.x * ds[i], y: v.y + B1.nn.y * ds[i], z: v.z };
                const t = ((B1.p.x - A1.p.x) * B1.u.y - (B1.p.y - A1.p.y) * B1.u.x) / den; return { x: A1.p.x + A1.u.x * t, y: A1.p.y + A1.u.y * t, z: v.z }; });
        }
        function distToPoly(x, y, pts) {
            let best = Infinity;
            for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy)); }
            return best;
        }
        // Talus : remblai qui descend (pente 1/kR) et déblai qui monte (pente 1/kD) depuis le bord de l'emprise jusqu'au terrain
        function cubatureTalus(tn, emp, zp, kR, kD, maxCells) {
            const zs = tn.nodes.map(n => n.z), dmax = mmToWorld(Math.max((zp - arrMin(zs)) * kR, (arrMax(zs) - zp) * kD, 0)) * 1.05;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; emp.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            minX -= dmax; minY -= dmax; maxX += dmax; maxY += dmax;
            const cell = Math.max(Math.sqrt((maxX - minX) * (maxY - minY) / (maxCells || 90000)), mmToWorld(20)), nx = Math.ceil((maxX - minX) / cell), ny = Math.ceil((maxY - minY) / cell), cA = Math.pow(mOf(cell), 2);
            const g = new Float64Array(nx * ny), zd = new Float64Array(nx * ny).fill(NaN); let rem = 0, deb = 0, sR = 0, sD = 0, cut = false;
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
                const x = minX + (i + 0.5) * cell, y = minY + (j + 0.5) * cell, k = j * nx + i;
                if (pointInPolygon(x, y, emp)) { g[k] = 1; zd[k] = zp; continue; }
                const zt = tinZ(x, y, tn); if (!hasZ(zt)) { g[k] = NaN; continue; }
                const dmm = worldToMm(distToPoly(x, y, emp));
                let v;
                if (zt < zp) { v = (zp - dmm / kR) - zt; if (v > 0) { rem += v / 1000 * cA; sR += cA; zd[k] = zt + v; } }
                else { v = zt - (zp + dmm / kD); if (v > 0) { deb += v / 1000 * cA; sD += cA; zd[k] = zt - v; } }
                g[k] = v;
            }
            // talus coupé par le bord du terrain connu ?
            for (let j = 0; j < ny && !cut; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!isNaN(g[k])) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < nx && jj < ny && g[jj * nx + ii] > 0 && g[jj * nx + ii] !== 1; })) { cut = true; break; } }
            return { rem, deb, sR, sD, cut, grid: { g, zd, nx, ny, minX, minY, cell } };
        }
        // Contour g = 0 d'une grille (marching squares) -> polylignes
        function gridContour(G) {
            const { g, nx, ny, minX, minY, cell } = G, segs = [], val = (i, j) => { const v = g[j * nx + i]; return isNaN(v) ? -1 : v; }, P = (i, j) => ({ x: minX + (i + 0.5) * cell, y: minY + (j + 0.5) * cell });
            const lerp = (i1, j1, i2, j2) => { const a = val(i1, j1), b = val(i2, j2), t = a / (a - b), p = P(i1, j1), q = P(i2, j2); return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; };
            for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
                const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
                for (let e = 0; e < 4; e++) { const [a1, b1] = c[e], [a2, b2] = c[(e + 1) % 4]; if ((val(a1, b1) > 0) !== (val(a2, b2) > 0)) pts.push(lerp(a1, b1, a2, b2)); }
                if (pts.length === 2) segs.push(pts); else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
            }
            const key = (p) => Math.round(p.x * 100) + ',' + Math.round(p.y * 100), ends = new Map();
            segs.forEach((sg, i) => sg.forEach((p, j) => { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push([i, j]); }));
            const used = new Array(segs.length).fill(false), lines = [];
            const walk = (line, p) => { for (;;) { const nx2 = (ends.get(key(p)) || []).find(([i]) => !used[i]); if (!nx2) break; used[nx2[0]] = true; p = segs[nx2[0]][1 - nx2[1]]; line.push(p); } };
            segs.forEach((sg, i) => { if (used[i]) return; used[i] = true; const fwd = [sg[0], sg[1]]; walk(fwd, sg[1]); const back = [sg[0]]; walk(back, sg[0]); lines.push(back.reverse().concat(fwd.slice(1))); });
            return lines;
        }

        // ---------- Assistant en 4 étapes : Emprise → Projet → Talus → Résultats ----------
        const CUB_STEPS = ['Plateformes', 'Résultats'];
        const cubInput = 'background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;';
        function cubCard(html) { return `<div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:14px 16px;">${html}</div>`; }
        // nom d'une plateforme : donné par l'utilisateur, sinon PF + rang
        function platName(s) { if (s && s.pfName) return s.pfName; const k = shapes.filter(isPlateforme).indexOf(s); return 'PF' + (k + 1); }
        function cubPlatforms() { return shapes.filter(s => isPlateforme(s) && !(layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).visible === false); }
        function openCubatureDialog() {
            // plateforme(s) sélectionnée(s) : on coche celles-là seulement
            const selP = selectedShapes.filter(isPlateforme);
            if (selP.length && selP.length < cubPlatforms().length) cubPlatforms().forEach(s => { s.cubOff = !selP.includes(s); });
            cubState.step = 1; renderCubStep();
        }
        function saveCubState() {}
        function cubGo(step) { const err = cubCheck(step); if (err && step > cubState.step) { const e = document.getElementById('cb-err'); if (e) e.textContent = err; return; } cubState.step = step; renderCubStep(); }
        function cubCheck(upTo) {
            if (upTo >= 2 && !getTIN()) return 'Pas assez de points cotés pour le terrain naturel.';
            if (upTo >= 2 && !cubPlatforms().some(s => !s.cubOff)) return 'Cochez au moins une plateforme.';
            return '';
        }
        function pickCubEmprise() { closeTopoModal(); setMode('cubpick'); }
        // une forme du plan devient une plateforme : on demande sa cote
        function cubMakePlatform(e2) {
            const r0 = canvas.getBoundingClientRect(), sc = worldToScreen(e2.pts[0].x, e2.pts[0].y);
            askText('Cote de la nouvelle plateforme (m)', '', Math.min(Math.max(sc.x, 20), r0.width - 300), Math.min(Math.max(sc.y, 20), r0.height - 100), (v) => {
                const z = parseFloat(String(v).replace(',', '.')) * 1000; if (!isFinite(z)) { openCubatureDialog(); return; }
                let sh = e2.shape;
                if (!sh || sh.type === 'hatch' || sh.gen) { sh = { type: 'poly', layerId: activeLayerId, points: e2.pts.map(q => ({ x: q.x, y: q.y })) }; shapes.push(sh); }
                if (sh.type === 'circle') { sh.z = z; delete sh.elev; } else { sh.points.forEach(q => { q.z = z; }); delete sh.elev; delete sh.plat; }
                sh.cubOff = false; saveState(); invalidateCache(); draw(); setMode('select-box'); openCubatureDialog();
            });
        }
        // remblai périphérique (par plateforme) : la fouille autour de la plateforme (recul + talus de déblai) est rebouchée jusqu'au niveau fini
        function cubRP(i, k, v) { const s = cubPlatforms()[i]; if (!s) return; s.cubRP = Object.assign({ on: false }, s.cubRP);
            if (k === 'on') s.cubRP.on = !!v; else { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); if (isFinite(n)) s.cubRP.z = Math.round(n * 1000); else delete s.cubRP.z; if (hasZ(s.cubRP.z)) s.cubRP.on = true; }
            saveState(); renderCubStep(); }
        // intégration sur une grille : les cases qui touchent un bord (plateforme, recul) sont redécoupées en 8 × 8, sinon une bande étroite le long du bord est comptée en trop ou oubliée selon où tombent les centres
        function gridEach(x0, y0, x1, y1, cell, rings, fn) {
            const n = 8, sc = cell / n;
            for (let x = x0 + cell / 2; x < x1; x += cell) for (let y = y0 + cell / 2; y < y1; y += cell) {
                if (rings.some(R => distToPoly(x, y, R) < cell * 0.75)) { for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) fn(x - cell / 2 + (a + 0.5) * sc, y - cell / 2 + (b + 0.5) * sc, 1 / (n * n)); }
                else fn(x, y, 1);
            }
        }
        // remblai périphérique : 'fini' = jusqu'à une cote finie (et talus 1/1 jusqu'au terrain si cette cote dépasse le terrain), 'tn' = fouille rebouchée jusqu'au terrain naturel, 'none' = aucun
        function rpMode(s) { const m = s && s.cubRP && s.cubRP.mode; return m === 'tn' || m === 'none' ? m : 'fini'; }
        // réglage par arête : un côté peut être rebouché jusqu'au terrain naturel (e.rptn) quand les autres vont à une cote finie
        function rpModeAt(EX, ring, x, y, mode) { if (mode !== 'fini' || !EX) return mode; const ed = EX[nearOnRing(x, y, ring).i]; return ed && ed.rptn ? 'tn' : mode; }
        function rpZfAt(EX, ring, zf0) { return (x, y) => { let z = zf0; if (EX) { const ed = EX[nearOnRing(x, y, ring).i]; if (ed && ed.rptn) return NaN; if (ed && hasZ(ed.zf)) z = ed.zf; } return z; }; }
        // grille de distance (monde) à la zone de déblai de la plateforme i, pour le talus 1/1 du remblai périphérique au-delà : -1 bloqué (plateforme, autres ouvrages), Infinity hors d'atteinte
        // dessus du remblai périphérique en (x, y), cellule r = FM.at(x, y) de la plateforme i hors de son contour : cote (mm) ou null
        //  bande de recul et fond de fouille : niveau fini ; talus de déblai : talus fini parallèle, parti du niveau fini, jusqu'au terrain naturel ;
        //  talus de remblai : talus fini parallèle, rehaussé de (niveau fini − bord de plateforme). « Au terrain naturel » : la fouille rebouchée jusqu'au terrain.
        function rpTop(FM, i, x, y, r, zfAt, mode) {
            const p = FM.P[i]; if (!r || r.gov !== i || (r.kind !== 3 && r.kind !== 2) || pointInPolygon(x, y, p.ring)) return null;
            if (mode === 'tn') return r.kind === 3 && hasZ(r.tn) ? r.tn : null;
            const z = zfAt(x, y); if (!hasZ(z)) return null; const e0 = nearOnRing(x, y, p.ring, p.S.flat ? p.zp : undefined), zb = e0 && hasZ(e0.z) ? e0.z : NaN;
            if (r.kind === 2) return hasZ(zb) && z > zb ? r.z + (z - zb) : null;
            if (hasZ(zb) && r.z > zb + 0.5 && hasZ(r.tn) && r.tn > z) return Math.min(r.tn, z + (r.z - zb));
            return z;
        }
        // grille autour de la fouille de la plateforme i, pour le talus 1/1 du remblai périphérique au-delà : st -1 bloqué (plateforme, autres ouvrages), 1 remblai périphérique, 0 terrain ;
        // Z = dessus du talus 1/1 parti du bord du remblai périphérique (−Infinity hors d'atteinte), d = distance à ce bord
        function rpDistGrid(FM, i, x0, y0, nx, ny, cell, zfAt) {
            const p = FM.P[i], N = nx * ny, st = new Int8Array(N), d = new Float64Array(N).fill(Infinity), Z = new Float64Array(N).fill(-Infinity), R2 = cell * Math.SQRT2, w1 = worldToMm(cell), w2 = worldToMm(R2);
            for (let a = 0; a < nx; a++) for (let c = 0; c < ny; c++) { const k = a * ny + c, x = x0 + a * cell, y = y0 + c * cell;
                if (pointInPolygon(x, y, p.ring)) { st[k] = -1; continue; } const r = FM.at(x, y), zt = zfAt ? rpTop(FM, i, x, y, r, zfAt, 'fini') : null;
                if (r && r.gov === i && (r.kind === 3 || (r.kind === 2 && hasZ(zt)))) { st[k] = 1; d[k] = 0; Z[k] = hasZ(zt) ? zt : -Infinity; } else if (!r || r.kind === 0) st[k] = 0; else st[k] = -1; }
            const relax = (k, k2, w, wm) => { if (st[k] === 0 && st[k2] >= 0) { if (d[k2] + w < d[k]) d[k] = d[k2] + w; if (Z[k2] - wm > Z[k]) Z[k] = Z[k2] - wm; } };
            for (let a = 0; a < nx; a++) for (let c = 0; c < ny; c++) { const k = a * ny + c; if (a) { relax(k, k - ny, cell, w1); if (c) relax(k, k - ny - 1, R2, w2); if (c < ny - 1) relax(k, k - ny + 1, R2, w2); } if (c) relax(k, k - 1, cell, w1); }
            for (let a = nx - 1; a >= 0; a--) for (let c = ny - 1; c >= 0; c--) { const k = a * ny + c; if (a < nx - 1) { relax(k, k + ny, cell, w1); if (c < ny - 1) relax(k, k + ny + 1, R2, w2); if (c) relax(k, k + ny - 1, R2, w2); } if (c < ny - 1) relax(k, k + 1, cell, w1); }
            return { st, d, Z };
        }
        // talus 1/1 du remblai périphérique là où la cote finie dépasse le terrain naturel, au-delà de la fouille
        function rpTalusExt(FM, i, zfAt, maxCells) {
            const p = FM.P[i], tin = FM.tin; let zMax = -Infinity, tMin = Infinity; p.ring.forEach(q => { const z = zfAt(q.x, q.y); if (hasZ(z)) zMax = Math.max(zMax, z); }); tin.nodes.forEach(nd => { tMin = Math.min(tMin, nd.z); });
            if (!isFinite(zMax) || zMax <= tMin) return { v: 0, a: 0 }; const mg = mmToWorld(zMax - tMin) + mmToWorld(200), b = { x0: p.bb.x0 - mg, y0: p.bb.y0 - mg, x1: p.bb.x1 + mg, y1: p.bb.y1 + mg };
            const cell = Math.max(Math.sqrt((b.x1 - b.x0) * (b.y1 - b.y0) / (maxCells || 50000)), mmToWorld(40)), nx = Math.ceil((b.x1 - b.x0) / cell) + 1, ny = Math.ceil((b.y1 - b.y0) / cell) + 1, cA = Math.pow(mOf(cell), 2);
            const G = rpDistGrid(FM, i, b.x0, b.y0, nx, ny, cell, zfAt); let v = 0, a = 0;
            for (let A = 0; A < nx; A++) for (let C = 0; C < ny; C++) { const k = A * ny + C; if (G.st[k] !== 0 || !isFinite(G.Z[k])) continue; const x = b.x0 + A * cell, y = b.y0 + C * cell, tn = tinZ(x, y, tin); if (!hasZ(tn)) continue;
                const h = G.Z[k] - tn; if (h > 0) { v += h / 1000 * cA; a += cA; } }
            return { v, a };
        }
        function cubPeriph(FM, i, zf, maxCells) {   // m³ de remblai entre le fond de la fouille (hors plateforme) et le niveau fini ; m² concernés
            const p = FM.P[i], b = p.bb, cell = Math.max(Math.sqrt((b.x1 - b.x0) * (b.y1 - b.y0) / (maxCells || 60000)), mmToWorld(20)), cA = Math.pow(mOf(cell), 2); let v = 0, a = 0;
            const mode = rpMode(p.s), byE = {}, t = platTalus(p.s), EX = t.cx && t.edges && p.s.type === 'poly' ? t.edges : null;   // niveau fini par arête (réglage par arête), sinon celui de la plateforme
            const zfAt = rpZfAt(EX, p.ring, zf);
            gridEach(b.x0, b.y0, b.x1, b.y1, cell, [p.ring], (x, y, f) => {
                if (pointInPolygon(x, y, p.ring)) return; const r = FM.at(x, y), z = rpTop(FM, i, x, y, r, zfAt, rpModeAt(EX, p.ring, x, y, mode));
                if (!hasZ(z) || !(z > r.z)) return; const dA = cA * f, dv = (z - r.z) / 1000 * dA; v += dv; a += dA; const k = p.s.type === 'poly' ? nearOnRing(x, y, p.ring).i : 0; const B = byE[k] || (byE[k] = { v: 0, a: 0, z }); B.v += dv; B.a += dA; });
            let ext = null; if (mode === 'fini') { ext = rpTalusExt(FM, i, zfAt); if (ext.v > 1e-6) { v += ext.v; a += ext.a; } else ext = null; }
            return { v, a, byE, ext, mode };
        }
        // recul R (déblai) : volume creusé dans la bande entre la plateforme et le fond de fouille agrandi (compté à part, retiré du talus)
        function cubRecul(FM, i, maxCells) {
            const p = FM.P[i]; if (!p.ringR) return null; const xs = p.ringR.map(q => q.x), ys = p.ringR.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const cell = Math.max(Math.sqrt((x1 - x0) * (y1 - y0) / (maxCells || 60000)), mmToWorld(20)), cA = Math.pow(mOf(cell), 2); let v = 0, a = 0;
            gridEach(x0, y0, x1, y1, cell, [p.ring, p.ringR], (x, y, f) => {
                if (!pointInPolygon(x, y, p.ringR) || pointInPolygon(x, y, p.ring)) return; const r = FM.at(x, y); if (!r || r.gov !== i || r.kind !== 3 || !hasZ(r.tn)) return;
                v += Math.max(0, r.tn - r.z) / 1000 * cA * f; a += cA * f; });
            return { v, a, R: worldToMm(p.R) };
        }
        function cubRPon(s) { const m = rpMode(s); if (m === 'none') return false; if (m === 'tn') return !(s.cubRP && s.cubRP.on === false); const t = platTalus(s); return !!((s.cubRP && hasZ(s.cubRP.z)) || (t.cx && (t.edges || []).some(e => e && (hasZ(e.zf) || e.rptn)))); }   // remblai périphérique : dès qu'un niveau fini est donné (Y › Talus)
        function cubToggle(i, on) { const s = cubPlatforms()[i]; if (s) { s.cubOff = !on; saveState(); } const e = document.getElementById('cb-err'); if (e) e.textContent = ''; }
        function cubAll(on) { cubPlatforms().forEach(s => { s.cubOff = !on; }); saveState(); renderCubStep(); }
        function cubRename(i, v) { const s = cubPlatforms()[i]; if (!s) return; v = String(v).trim(); if (v) s.pfName = v; else delete s.pfName; saveState(); }
        function cubShow(i) { const s = cubPlatforms()[i]; if (!s) return; selectedShapes = [s]; draw(); }
        function cubEdit(i) { const s = cubPlatforms()[i]; if (!s) return; closeTopoModal(); setMode('select-box'); selectedShapes = [s]; draw(); openSelectionParamModal(); }
        function renderCubStep() {
            cubState.mode = 'plat';
            const n = cubState.step;
            const head = '<div style="display:flex;gap:6px;margin-bottom:14px;">' + CUB_STEPS.map((t, i) => { const k = i + 1, on = k === n, done = k < n;
                return `<button type="button" onclick="cubGo(${k})" style="flex:1;border:0;border-radius:6px;padding:8px 6px;cursor:pointer;font-weight:600;font-size:13px;background:${on ? '#2563eb' : done ? '#1e3a5f' : '#374151'};color:${on || done ? '#fff' : '#9ca3af'};">${done ? '✓ ' : k + '. '}${t}</button>`; }).join('') + '</div>';
            let body = '';
            if (n === 1) {
                const tin = getTIN(), P = cubPlatforms(), esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                const rows = P.map((s, i) => { const S = platSurf(s), t = platTalus(s), a = Math.abs(polyArea(platRing(s))) * Math.pow(mOf(1), 2);
                    return `<tr style="border-top:1px solid #374151;" onmouseenter="cubShow(${i})">
                        <td style="padding:5px 6px;"><input type="checkbox" ${s.cubOff ? '' : 'checked'} onchange="cubToggle(${i}, this.checked)" style="width:16px;height:16px;cursor:pointer;"></td>
                        <td style="padding:5px 6px;"><input type="text" value="${esc(platName(s))}" placeholder="PF${i + 1}" onchange="cubRename(${i}, this.value)" style="${cubInput}width:150px;padding:3px 6px;"></td>
                        <td style="padding:5px 6px;white-space:nowrap;">${platLabel(S)}</td>
                        <td style="padding:5px 6px;text-align:right;white-space:nowrap;">${nfr(a, 2)} m²</td>
                        <td style="padding:5px 6px;color:#9ca3af;white-space:nowrap;">${talusInfo(s)}${cubRPon(s) ? ' · remblai périph.' : ''}</td>
                        <td style="padding:5px 6px;"><button type="button" onclick="cubEdit(${i})" title="Niveaux, talus, nom : fenêtre Y" style="background:#4b5563;color:#fff;border:0;border-radius:5px;padding:2px 8px;cursor:pointer;">Régler</button></td></tr>`; }).join('');
                body = cubCard(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;"><div style="font-size:15px;font-weight:600;">Plateformes à calculer</div>
                    <div style="display:flex;gap:6px;"><button type="button" onclick="cubAll(true)" style="background:#374151;color:#e5e7eb;border:0;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:12px;">Tout cocher</button><button type="button" onclick="cubAll(false)" style="background:#374151;color:#e5e7eb;border:0;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:12px;">Tout décocher</button></div></div>
                    ${P.length ? `<div style="max-height:46vh;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="color:#9ca3af;text-align:left;"><th></th><th style="padding:4px 6px;">Nom</th><th style="padding:4px 6px;">Niveau</th><th style="padding:4px 6px;text-align:right;">Surface</th><th style="padding:4px 6px;">Talus (remblai · déblai)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
                        : '<p style="color:#9ca3af;">Aucune plateforme dans le plan : une plateforme est une polyligne fermée (ou un cercle) dont les sommets ont un Z (touche Y).</p>'}
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;"><button type="button" onclick="pickCubEmprise()" style="background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;">+ Nouvelle plateforme depuis une forme du plan</button>
                        <span style="color:#9ca3af;font-size:12px;">Une plateforme décochée n'existe pas pour ce calcul (ni ses volumes, ni ses talus).</span></div>
                    <p style="color:#9ca3af;font-size:12px;margin-top:10px;">Calcul entre les plateformes cochées (avec leurs talus) et le <b style="color:#e5e7eb;">maillage du terrain naturel</b>${tin ? ' (' + tin.tris.length + ' triangles des points cotés du plan)' : ' — ⚠️ pas encore assez de points cotés'}. Niveaux, pentes de talus et nom se règlent aussi avec <b>Y</b>.</p>`);
            } else body = '<div id="cb-res">' + cubCard('<p style="color:#9ca3af;">Calcul…</p>') + '</div>';
            const nav = [];
            if (n === 1) nav.push(['Calculer →', () => cubGo(2), true]);
            else nav.push(['← Plateformes', () => cubGo(1), false], ['Copier (tableur)', () => { if (window.__cubTSV) copyText(window.__cubTSV); }, false], ['Détail (tableur)', () => cubDetailCopy(), false], ['🖨 Imprimer la note', () => cubPDF(false), false], ['🖨 Note + détail', () => cubPDF(true), false], ['Tracer sur le plan', () => drawCubLines(), false], ['Terminer', closeTopoModal, true]);
            openTopoModal('Σ Calculs', calcTabs('cub') + head + body + '<div id="cb-err" style="color:#fca5a5;margin-top:8px;min-height:18px;"></div>', nav);
            if (n === 2) setTimeout(runCubature, 20);
        }
        // calcul des cubatures (plateformes cochées), sans affichage : utilisé par la fenêtre Cubatures et par le métré
        // même plan, mêmes plateformes cochées, mêmes talus : le dernier calcul resservi (onglets Financier et Cubature, impressions)
        let cubCC = null;
        function cubComputeCached() { const key = JSON.stringify([renderEpoch, historyStep, shapes.length, lpSpace, cubPlatforms().map(x => !!x.cubOff), cubState.talus, cubState.kR, cubState.kD]);
            if (cubCC && cubCC.key === key) return cubCC.v; const v = cubCompute(); cubCC = { key, v }; return v; }
        function cubCompute() {
            const tn = buildTIN(tinNodes());
            if (!tn) return { err: 'Pas assez de points cotés pour le terrain naturel.' };
            const t0 = performance.now(), on = cubPlatforms().filter(s => !s.cubOff), skip = new Set(shapes.filter(s => isPlateforme(s) && !on.includes(s)));
            // structure au fond de forme : plateforme ET talus terrassés depuis le fond de forme (le talus de déblai part plus bas, celui de remblai s'arrête plus bas)
            const FM = finishedModel(null, tn, skip, true); if (!FM || !FM.P.length) return { err: 'Aucune plateforme cochée.' };
            const FM0 = FM.P.some(p => p.dz > 0) ? finishedModel(null, tn, skip) : null;   // même calcul sans structure : pour dire ce qu'elle ajoute
            const k2 = Math.pow(mOf(1), 2);
            const items = FM.P.map((p, i) => {
                const S0 = platSurf(p.s), S = S0.flat ? null : S0, st = structOf(p.s), Emm = p.dz || 0;   // structure : terrassement au fond de forme (FM est déjà descendu de Emm)
                const ST = S ? p.S : null, zT = S ? NaN : p.zp;
                const pr0 = cubaturePlateforme(tn, p.ring, zT, ST), tt = cubatureTalusModel(FM, i), t = platTalus(p.s);
                const hasT = p.on || Math.abs(tt.deb) + Math.abs(tt.rem) > 1e-6, ov = tt.ovA > 1e-6 ? { a: tt.ovA, deb: tt.ovDeb, rem: tt.ovRem } : null;
                // zone recouverte par une autre plateforme : comptée une seule fois, avec celle du dessus
                const pr = ov ? Object.assign({}, pr0, { deb: Math.max(0, pr0.deb - ov.deb), rem: Math.max(0, pr0.rem - ov.rem) }) : pr0;
                const area = Math.abs(polyArea(p.ring)) * k2 - (ov ? ov.a : 0);
                const pit = tt.pitIn >= 0 && tt.pitV > 1e-3 ? { vol: tt.pitV, inName: platName(FM.P[tt.pitIn].s), inIdx: tt.pitIn } : null;
                return { s: p.s, name: platName(p.s), ring: platRing(p.s).map(q => ({ x: q.x, y: q.y, z: q.z })), zp: p.zp + Emm, SL: S, zT, ST, Emm, st, pr, pr0, ov, pit, tal: hasT ? tt : null, on: p.on, kR: t.kR, kD: t.kD, area, idx: i };
            }).sort((a, b) => shapes.indexOf(a.s) - shapes.indexOf(b.s));
            // fosse creusée dans une plateforme remblayée : on remblaie la grande plateforme en entier, puis on creuse la fosse (le trou est un vrai déblai)
            items.forEach(it => { it.extra = []; });
            // structure terrassée au fond de forme : on montre ce qu'elle ajoute au déblai de la plateforme (sinon un gros écart semble venir d'ailleurs)
            items.forEach(it => { if (!(it.Emm > 0)) return; const z0 = cubaturePlateforme(tn, it.ring, it.SL ? NaN : it.zp, it.SL), i0 = FM0 ? FM0.P.findIndex(q => q.s === it.s) : -1, t0 = i0 >= 0 ? cubatureTalusModel(FM0, i0) : null, t1 = it.tal || { deb: 0, rem: 0 };
                const dP = it.pr0.deb - z0.deb, dT = t0 ? t1.deb - t0.deb : 0, dD = dP + dT, dR = z0.rem - it.pr0.rem + (t0 ? t0.rem - t1.rem : 0); if (dD < 0.01 && dR < 0.01) return;
                it.extra.push({ lbl: 'dont structure ' + nfr(it.Emm / 10, 0) + ' cm : terrassement jusqu\'au fond de forme ' + (it.SL ? '' : fmtZ(it.zT) + ' m') + ' (plateforme ' + nfr(dP, 2) + ' m³' + (t0 ? ', talus ' + nfr(dT, 2) + ' m³' : '') + (dR > 0.01 ? ' ; remblai réduit de ' + nfr(dR, 2) + ' m³' : '') + ')', deb: dD, rem: 0, info: true, dOnly: true }); });
            items.forEach(it => { if (!it.pit) return; const host = items.find(h => h.name === it.pit.inName && h.s === FM.P[it.pit.inIdx].s); if (!host) return;
                host.extra.push({ lbl: 'remblai sous la fosse ' + it.name + ' (mis en place puis recreusé)', deb: 0, rem: it.pit.vol });
                it.extra.push({ lbl: 'fosse creusée dans le remblai de ' + it.pit.inName, deb: it.pit.vol, rem: 0 }); });
            items.forEach(it => { const rc = cubRecul(FM, it.idx); if (!rc || rc.v <= 1e-6) return; it.rec = rc;
                if (it.tal) it.tal = Object.assign({}, it.tal, { deb: Math.max(0, it.tal.deb - rc.v), sD: Math.max(0, it.tal.sD - rc.a) });
                const xs = 0;   // la structure s'étend aussi sur le recul : le modèle est déjà au fond de forme, rien à ajouter
                it.extra.push({ lbl: 'recul R = ' + nfr(rc.R / 1000, 2) + ' m : fond de fouille agrandi (' + nfr(rc.a, 1) + ' m²)' + (it.Emm > 0 ? ', structure comprise' : ''), deb: rc.v + xs, rem: 0 }); });
            items.forEach(it => { const rp = it.s.cubRP, tt = platTalus(it.s), perE = tt.cx && (tt.edges || []).some(e => e && (hasZ(e.zf) || e.rptn)); if (!cubRPon(it.s) || !((rp && hasZ(rp.z)) || perE || rpMode(it.s) === 'tn')) return; const R = cubPeriph(FM, it.idx, rp ? rp.z : undefined); if (R.v <= 1e-6) return; it.rp = R;
                const E = (tt.edges || []), keys = Object.keys(R.byE).map(Number).sort((a, b) => a - b);
                keys.forEach(k => { const B = R.byE[k], e = E[k] || {}, nm = it.s.type === 'poly' ? (e.name || 'Talus ' + (k + 1)) : 'pourtour';
                    it.extra.push({ lbl: 'remblai périphérique — ' + nm + (R.mode === 'tn' ? ' jusqu\'au terrain naturel' : ' jusqu\'à ' + fmtZ(B.z) + ' m') + ' (' + nfr(B.a, 1) + ' m²)', deb: 0, rem: B.v }); });
                if (R.ext) it.extra.push({ lbl: 'remblai périphérique — talus 1/1 jusqu\'au terrain naturel (' + nfr(R.ext.a, 1) + ' m²)', deb: 0, rem: R.ext.v });
                if (keys.length + (R.ext ? 1 : 0) > 1) it.extra.push({ lbl: 'total remblai périphérique', deb: 0, rem: R.v, info: true }); });
            const exD = (it) => it.extra.reduce((a, e) => a + (e.info ? 0 : e.deb), 0), exR = (it) => it.extra.reduce((a, e) => a + (e.info ? 0 : e.rem), 0);
            const D = items.reduce((a, it) => a + it.pr.deb + (it.tal ? it.tal.deb : 0) + exD(it), 0), Rm = items.reduce((a, it) => a + it.pr.rem + (it.tal ? it.tal.rem : 0) + exR(it), 0);
            const ms = Math.round(performance.now() - t0), RP = items.reduce((a, it) => a + (it.rp ? it.rp.v : 0), 0);   // remblai périphérique, compté à part dans le récapitulatif
            return { tn, FM, items, D, Rm, RP, ms };
        }
        // NOTE DE CUBATURE : les bassins de rétention (fouille, lit, remblai), avec le total terrassement plateformes + bassins
        function bassinCubData() { return bassinList().map(s => ({ s, C: bassinCalc(s) })).filter(x => x.C); }
        function bassinCubHTML(D, Rm) { const L = bassinCubData(); if (!L.length) return ''; const td = 'padding:5px 8px;text-align:right;white-space:nowrap;', esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            const T = L.reduce((a, { C }) => ({ ut: a.ut + C.Vut, f: a.f + C.Vf, l: a.l + C.Vlit, r: a.r + C.Vrem }), { ut: 0, f: 0, l: 0, r: 0 });
            return `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #374151;"><div style="font-weight:600;margin-bottom:6px;">🛢 Bassins de rétention</div><table style="width:100%;border-collapse:collapse;font-size:13.5px;"><thead><tr style="color:#9ca3af;"><th style="text-align:left;padding:4px 8px;">Bassin</th><th style="${td}">Utile</th><th style="${td}">Profondeur</th><th style="${td}">Déblai</th><th style="${td}">Lit</th><th style="${td}">Remblai</th></tr></thead><tbody>`
                + L.map(({ s, C }) => `<tr style="border-top:1px solid #374151;"><td style="padding:5px 8px;"><b>${esc(s.name || 'Bassin')}</b> — ${BASSIN_T[s.bassin.t].nm.toLowerCase()}${C.n ? ' (' + C.n + ' × Ø' + nfr(C.D * 1000, 0) + ')' : ''}</td><td style="${td}color:#38bdf8;">${nfr(C.Vut, 1)} m³</td><td style="${td}">${nfr(C.Df, 2)} m</td><td style="${td}color:#fca5a5;">${nfr(C.Vf, 2)} m³</td><td style="${td}">${nfr(C.Vlit, 2)} m³</td><td style="${td}color:#93c5fd;">${nfr(C.Vrem, 2)} m³</td></tr>`).join('')
                + `<tr style="border-top:2px solid #6b7280;font-weight:700;"><td style="padding:5px 8px;">Total bassins</td><td style="${td}color:#38bdf8;">${nfr(T.ut, 1)} m³</td><td></td><td style="${td}color:#fca5a5;">${nfr(T.f, 2)} m³</td><td style="${td}">${nfr(T.l, 2)} m³</td><td style="${td}color:#93c5fd;">${nfr(T.r, 2)} m³</td></tr>`
                + (D !== undefined ? `<tr style="font-weight:700;"><td style="padding:5px 8px;">Total terrassement (plateformes + bassins)</td><td></td><td></td><td style="${td}color:#fca5a5;">${nfr(D + T.f, 2)} m³</td><td></td><td style="${td}color:#93c5fd;">${nfr(Rm + T.r, 2)} m³</td></tr>` : '')
                + `</tbody></table><p style="color:#9ca3af;font-size:12px;margin-top:6px;">Fouille : emprise + surlargeur au fond, talus jusqu'au sol fini ; remblai = fouille − ouvrage − lit de pose (côtés et couverture).</p></div>`; }
        function runCubature() {
            const res = document.getElementById('cb-res'); if (!res) return;
            const CC = cubComputeCached(); if (CC.err) { res.innerHTML = cubCard('<p style="color:#fca5a5;">' + CC.err + '</p>' + bassinCubHTML()); return; }
            const { tn, FM, items, D, Rm, RP, ms } = CC;
            cubResult = { tn, FM, items };
            const big = (lbl, v, col) => `<div style="flex:1;min-width:150px;background:#0b1220;border:1px solid #374151;border-radius:8px;padding:10px 12px;"><div style="color:#9ca3af;font-size:12px;">${lbl}</div><div style="font-size:22px;font-weight:700;color:${col};">${nfr(v, 2)} m³</div></div>`;
            const row = (a, b, c, d, st) => `<tr style="border-top:1px solid #374151;${st || ''}"><td style="padding:5px 8px;">${a}</td><td style="padding:5px 8px;text-align:right;color:#fca5a5;">${b}</td><td style="padding:5px 8px;text-align:right;color:#93c5fd;">${c}</td><td style="padding:5px 8px;text-align:right;color:#9ca3af;">${d || ''}</td></tr>`;
            const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            let html = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">${big('Déblai total', D, '#fca5a5')}${RP > 1e-6 ? big('Remblai', Rm - RP, '#93c5fd') + big('Remblai périphérique', RP, '#fbbf24') : big('Remblai total', Rm, '#93c5fd')}</div>`;
            html += '<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="color:#9ca3af;"><th style="text-align:left;padding:4px 8px;">Poste</th><th style="text-align:right;padding:4px 8px;">Déblai</th><th style="text-align:right;padding:4px 8px;">Remblai</th><th style="text-align:right;padding:4px 8px;">Surface</th></tr></thead><tbody>';
            const tsv = ['Poste\tDéblai (m³)\tRemblai (m³)\tSurface (m²)'];
            items.forEach(it => {
                html += row('<b>' + esc(it.name) + '</b> — plateforme ' + platLabel(it.SL || { flat: true, zp: it.zp }), nfr(it.pr.deb, 2) + ' m³', nfr(it.pr.rem, 2) + ' m³', nfr(it.area, 2) + ' m²', 'border-top:2px solid #4b5563;');
                tsv.push([it.name + ' - plateforme ' + platLabel(it.SL || { flat: true, zp: it.zp }), nfr(it.pr.deb, 2), nfr(it.pr.rem, 2), nfr(it.area, 2)].join('\t'));
                it.extra.forEach(e => { html += row('<span style="padding-left:' + (e.info ? 14 : 14) + 'px;color:' + (e.dOnly ? '#9ca3af' : '#fbbf24') + ';' + (e.info && !e.dOnly ? 'font-weight:700;' : '') + '">' + esc(e.lbl) + '</span>', e.dOnly ? '<i>' + nfr(e.deb, 2) + ' m³</i>' : e.info ? '' : nfr(e.deb, 2) + ' m³', e.dOnly ? '' : (e.info ? '<b>' : '') + nfr(e.rem, 2) + ' m³' + (e.info ? '</b>' : ''), ''); tsv.push([it.name + ' - ' + e.lbl, e.info && !e.dOnly ? '' : nfr(e.deb, 2), e.dOnly ? '' : nfr(e.rem, 2), ''].join('\t')); });
                if (it.tal) { const lb = it.on ? 'talus (' + talusInfo(it.s) + ')' : 'talus des plateformes voisines posés dessus';
                    html += row('<span style="padding-left:14px;color:#d1d5db;">' + lb + '</span>', nfr(it.tal.deb, 2) + ' m³', nfr(it.tal.rem, 2) + ' m³', nfr(it.tal.sR + it.tal.sD, 2) + ' m²');
                    tsv.push([it.name + ' - ' + lb, nfr(it.tal.deb, 2), nfr(it.tal.rem, 2), nfr(it.tal.sR + it.tal.sD, 2)].join('\t')); }
            });
            const sTot = items.reduce((a, it) => a + it.area + (it.tal ? it.tal.sR + it.tal.sD : 0) + (it.rec ? it.rec.a : 0), 0);
            html += `<tr style="border-top:2px solid #6b7280;font-weight:700;"><td style="padding:5px 8px;">Total (${items.length} plateforme${items.length > 1 ? 's' : ''})</td><td style="padding:5px 8px;text-align:right;color:#fca5a5;">${nfr(D, 2)} m³</td><td style="padding:5px 8px;text-align:right;color:#93c5fd;">${nfr(Rm, 2)} m³</td><td style="padding:5px 8px;text-align:right;color:#9ca3af;">${nfr(sTot, 2)} m²</td></tr></tbody></table>`;
            tsv.push(['Total', nfr(D, 2), nfr(Rm, 2), nfr(sTot, 2)].join('\t'));
            if (RP > 1e-6) { html += row('<span style="padding-left:14px;">dont remblai</span>', '', nfr(Rm - RP, 2) + ' m³', '') + row('<span style="padding-left:14px;color:#fbbf24;">dont remblai périphérique</span>', '', nfr(RP, 2) + ' m³', '');
                tsv.push(['dont remblai', '', nfr(Rm - RP, 2), ''].join('\t'), ['dont remblai périphérique', '', nfr(RP, 2), ''].join('\t')); }
            // structures : quantités de matériaux par plateforme
            const SQ = []; items.forEach(it => { if (it.st && it.st.layers.length) structQty(it.st, it.area + (it.rec ? it.rec.a : 0)).forEach(q => SQ.push(Object.assign({ pf: it.name }, q))); });
            if (SQ.length) {
                const tot = {}; SQ.forEach(q => { const k = q.name; tot[k] = tot[k] || { v: 0, vf: 0, t: 0, surf: q.surf }; tot[k].v += q.surf ? q.A : q.v; tot[k].vf += q.vf; tot[k].t += q.t; });
                html += `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #374151;"><div style="font-weight:600;margin-bottom:6px;">Structures (couches de chaussée / plateforme)</div>
                    <table style="width:100%;border-collapse:collapse;font-size:13.5px;"><thead><tr style="color:#9ca3af;"><th style="text-align:left;padding:4px 8px;">Plateforme · couche</th><th style="text-align:right;padding:4px 8px;">Ép.</th><th style="text-align:right;padding:4px 8px;">En place</th><th style="text-align:right;padding:4px 8px;">Foisonné</th><th style="text-align:right;padding:4px 8px;">Tonnes</th></tr></thead><tbody>`
                    + SQ.map(q => `<tr style="border-top:1px solid #374151;"><td style="padding:4px 8px;">${esc(q.pf)} · ${esc(q.name)}</td><td style="padding:4px 8px;text-align:right;color:#9ca3af;">${q.surf ? '—' : nfr(q.e, 0) + ' cm'}</td><td style="padding:4px 8px;text-align:right;">${q.surf ? nfr(q.A, 2) + ' m²' : nfr(q.v, 2) + ' m³'}</td><td style="padding:4px 8px;text-align:right;color:#fbbf24;">${q.surf ? nfr(q.vf, 2) + ' m²' : nfr(q.vf, 2) + ' m³'} <span style="color:#6b7280;">×${nfr(q.coef, 2)}</span></td><td style="padding:4px 8px;text-align:right;">${q.surf ? '—' : nfr(q.t, 1) + ' t'}</td></tr>`).join('')
                    + Object.keys(tot).map((k, i) => `<tr style="border-top:${i ? 1 : 2}px solid #6b7280;font-weight:700;"><td style="padding:4px 8px;">Total ${esc(k)}</td><td></td><td style="padding:4px 8px;text-align:right;">${nfr(tot[k].v, 2)} ${tot[k].surf ? 'm²' : 'm³'}</td><td style="padding:4px 8px;text-align:right;color:#fbbf24;">${nfr(tot[k].vf, 2)} ${tot[k].surf ? 'm²' : 'm³'}</td><td style="padding:4px 8px;text-align:right;">${tot[k].surf ? '—' : nfr(tot[k].t, 1) + ' t'}</td></tr>`).join('') + '</tbody></table></div>';
                tsv.push('', 'Structure\tÉpaisseur (cm)\tEn place\tFoisonné\tUnité\tFoisonnement\tTonnes');
                SQ.forEach(q => tsv.push([q.pf + ' - ' + q.name, q.surf ? '' : nfr(q.e, 0), nfr(q.surf ? q.A : q.v, 2), nfr(q.vf, 2), q.surf ? 'm²' : 'm³', nfr(q.coef, 2), q.surf ? '' : nfr(q.t, 1)].join('\t')));
                Object.keys(tot).forEach(k => tsv.push(['Total ' + k, '', nfr(tot[k].v, 2), nfr(tot[k].vf, 2), tot[k].surf ? 'm²' : 'm³', '', tot[k].surf ? '' : nfr(tot[k].t, 1)].join('\t')));
            }
            window.__cubSQ = SQ;
            const notes = [];
            items.forEach(it => { if (it.ov && !(it.extra.length && it.ov.a <= items.filter(q => q.pit && q.pit.inName === it.name).reduce((t, q) => t + q.area, 0) * 1.05 + 0.5)) notes.push('⚠️ ' + it.name + ' est en partie recouverte par une autre plateforme (' + nfr(it.ov.a, 2) + ' m²) : cette zone n\'est comptée qu\'une fois, avec la plateforme du dessus (la dernière dessinée). Vérifiez les contours si ce recouvrement n\'est pas voulu.'); });
            items.forEach(it => { if (it.pr0.sCov < (it.area + (it.ov ? it.ov.a : 0)) * 0.98) notes.push('⚠️ ' + it.name + ' : le terrain ne couvre que ' + nfr(100 * it.pr0.sCov / (it.area + (it.ov ? it.ov.a : 0)), 0) + ' % de la plateforme ; ajoutez des points cotés.'); });
            if (items.some(it => it.tal && it.tal.cut)) notes.push('⚠️ Des talus sortent de la zone couverte par les points cotés (' + items.filter(it => it.tal && it.tal.cut).map(it => it.name).join(', ') + ') : leurs volumes sont sous-estimés.');
            if (items.length > 1) notes.push('🔗 Talus raccordés entre les plateformes cochées : les zones communes ne sont comptées qu\'une fois (attribuées au talus qui les façonne) ; le talus d\'une plateforme haute posé sur une plateforme basse corrige le volume de la plateforme basse.');
            items.forEach(it => { if (!it.Emm && it.st && it.st.layers.length && structThick(it.st) > 0) notes.push('ℹ️ ' + it.name + ' : structure de ' + nfr(structThick(it.st), 0) + ' cm posée sur la cote de terrassement (' + (it.SL ? 'niveaux de la plateforme' : nfr(it.zp / 1000, 2) + ' m') + '), dessus fini ' + (it.SL ? '+ ' + nfr(structThick(it.st) / 100, 2) + ' m' : 'à ' + nfr((it.zp + structThick(it.st) * 10) / 1000, 2) + ' m') + '.'); });
            items.forEach(it => { if (it.Emm) notes.push('ℹ️ ' + it.name + ' : structure de ' + nfr(it.Emm / 10, 0) + ' cm, terrassement calculé au fond de forme (' + (it.SL ? 'niveaux − ' + nfr(it.Emm / 1000, 2) + ' m' : nfr((it.zp - it.Emm) / 1000, 2) + ' m') + ').'); });
            items.forEach(it => { if (it.pit) notes.push('ℹ️ ' + it.name + ' est une fosse dans ' + it.pit.inName + ' : ' + it.pit.inName + ' est remblayée en entier, puis la fosse est creusée dedans (fosse + talus : ' + nfr(it.pit.vol, 2) + ' m³ en déblai, et autant en remblai sur ' + it.pit.inName + ').'); });
            const excl = cubPlatforms().filter(s => s.cubOff); if (excl.length) notes.push('Plateformes non calculées (décochées) : ' + excl.map(platName).join(', ') + '.');
            items.forEach(it => notes.push(it.name + ' : ' + nfr(it.pr.sDeb, 2) + ' m² en déblai (épaisseur moyenne ' + (it.pr.sDeb ? nfr(it.pr.deb / it.pr.sDeb, 2) : '0') + ' m), ' + nfr(it.pr.sRem, 2) + ' m² en remblai (' + (it.pr.sRem ? nfr(it.pr.rem / it.pr.sRem, 2) : '0') + ' m) ; terrain moyen ' + (hasZ(it.pr.zMoy) ? nfr(it.pr.zMoy / 1000, 3) + ' m' : '—') + '.'));
            notes.push('Plateformes : calcul exact sur ' + tn.tris.length + ' triangles du terrain ; talus par mailles (' + ms + ' ms). Volumes géométriques en place, sans foisonnement.');
            html += notes.map(t => `<p style="color:#9ca3af;font-size:12px;margin-top:6px;">${esc(t)}</p>`).join('');
            html += mailCubHTML(CC); mailCubTSV(CC).forEach(l => tsv.push(l));
            html += bassinCubHTML(D, Rm); bassinCubData().forEach(({ s: b, C }) => tsv.push(['Bassin ' + (b.name || '') + ' - fouille / lit / remblai', nfr(C.Vf, 2), nfr(C.Vrem, 2), nfr(C.At, 2)].join('\t')));
            res.innerHTML = html;
            window.__cubTSV = tsv.join('\n');
            window.__cubPdf = { tn, FM, items, D, Rm, RP, ms, sTot, SQ, notes: notes.map(t => t.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '')), excluded: excl.map(platName) };
        }
        // ---------- Rapport de cubature ----------
        // détail par triangle du terrain d'une plateforme (recalculé à la demande, exact)
        function surfDown(S, dz) { return S.flat ? Object.assign({}, S, { zp: S.zp - dz, zmin: S.zmin - dz, zmax: S.zmax - dz }) : shiftSurf(S, dz); }
        function shiftSurf(S, dz) { return Object.assign({}, S, { zp: S.zp - dz, zmin: S.zmin - dz, zmax: S.zmax - dz, tris: S.tris.map(t => ({ pts: t.pts.map(v => Object.assign({}, v, { z: v.z - dz })), a: t.a, b: t.b, c: t.c - dz })) }); }
        function cubDetail(C, it) {
            const det = []; cubaturePlateforme(C.tn, it.ring, it.ST ? NaN : (hasZ(it.zT) ? it.zT : it.zp), it.ST || it.SL, det);
            return det.filter(d => d.s > 1e-6);
        }
        function cubDetailCopy() {
            const C = window.__cubPdf; if (!C) return; let n = 0;
            const out = ['Plateforme\tTriangle TN\tZ1 TN (m)\tZ2 TN (m)\tZ3 TN (m)\tSurface dans la plateforme (m²)\tZ moyen TN (m)\tZ moyen projet (m)\tDéblai (m³)\tRemblai (m³)'];
            C.items.forEach(it => cubDetail(C, it).forEach(d => { n++; out.push([it.name, d.n, nfr(d.z[0] / 1000, 3), nfr(d.z[1] / 1000, 3), nfr(d.z[2] / 1000, 3), nfr(d.s, 2), nfr(d.ztn / 1000, 3), nfr(d.zp / 1000, 3), nfr(d.deb, 3), nfr(d.rem, 3)].join('\t')); }));
            copyText(out.join('\n'));
            updateCommandMessageText('CUBATURES : détail de ' + n + ' triangles copié (collez dans un tableur).');
        }
        // rampe de couleur du bas (bleu) au haut (rouge)
        function cubRamp(t) { t = Math.max(0, Math.min(1, t)); const h = 240 * (1 - t); return 'hsl(' + h.toFixed(0) + ',78%,52%)'; }
        function cubRampRGB(t, shade) {
            t = Math.max(0, Math.min(1, t)); const h = 240 * (1 - t) / 360, s = 0.78, l = 0.52 * shade;
            const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
            return [f(0), f(8), f(4)];
        }
        const cubZp = (it, x, y) => it.SL ? platZAt(it.SL, x, y) : it.zp;
        // statistiques de niveaux d'une plateforme (échantillonnage fin)
        function cubLevels(C, it) {
            const pts = it.ring, x0 = arrMin(pts.map(q => q.x)), x1 = arrMax(pts.map(q => q.x)), y0 = arrMin(pts.map(q => q.y)), y1 = arrMax(pts.map(q => q.y));
            const n = 140, cs = Math.max((x1 - x0), (y1 - y0)) / n; let tMin = Infinity, tMax = -Infinity, pMin = Infinity, pMax = -Infinity, hR = 0, hD = 0;
            for (let x = x0 + cs / 2; x < x1; x += cs) for (let y = y0 + cs / 2; y < y1; y += cs) {
                if (!pointInPolygon(x, y, pts)) continue; const zt = tinZ(x, y, C.tn), zp = cubZp(it, x, y);
                if (hasZ(zt)) { tMin = Math.min(tMin, zt); tMax = Math.max(tMax, zt); }
                if (hasZ(zp)) { pMin = Math.min(pMin, zp); pMax = Math.max(pMax, zp); }
                if (hasZ(zt) && hasZ(zp)) { hR = Math.max(hR, zp - zt); hD = Math.max(hD, zt - zp); }
            }
            return { tMin, tMax, tMoy: it.pr.zMoy, pMin, pMax, hR, hD };
        }
        // logo MomoCAD (version longue) en PNG pour le PDF
        function cubLogoPNG() {
            return new Promise((res) => {
                const el = document.querySelector('#app-logo svg'); if (!el) return res(null);
                const c = el.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.removeAttribute('style'); c.removeAttribute('height');
                const vb = (c.getAttribute('viewBox') || '0 0 100 20').split(/\s+/).map(Number), H = 120, W = Math.round(H * vb[2] / vb[3]);
                c.setAttribute('width', W); c.setAttribute('height', H);
                const img = new Image(); img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(img, 0, 0, W, H); res({ url: cv.toDataURL('image/png'), r: W / H }); } catch (e) { res(null); } };
                img.onerror = () => res(null); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
            });
        }
        // Vue isométrique (canvas) : terrain naturel ou projet (plateformes + talus + terrain), couleurs du bas (bleu) au haut (rouge), courbes de niveau
        function cubIsoImage(C, which, dom, zr, Wpx, Hpx) {
            const cv = document.createElement('canvas'); cv.width = Wpx; cv.height = Hpx; const g = cv.getContext('2d');
            g.fillStyle = '#ffffff'; g.fillRect(0, 0, Wpx, Hpx);
            const N = 170, cs = Math.max(dom.x1 - dom.x0, dom.y1 - dom.y0) / N, nx = Math.ceil((dom.x1 - dom.x0) / cs) + 1, ny = Math.ceil((dom.y1 - dom.y0) / cs) + 1;
            const Z = new Float64Array(nx * ny).fill(NaN), K = new Int8Array(nx * ny);
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
                const x = dom.x0 + i * cs, y = dom.y0 + j * cs; let z;
                if (which === 'tn') z = tinZ(x, y, C.tn);
                else { const r = C.FM ? C.FM.at(x, y) : null; if (r) { z = r.z; K[j * nx + i] = r.kind; } else z = tinZ(x, y, C.tn); }
                if (hasZ(z)) Z[j * nx + i] = z;
            }
            const ca = Math.SQRT1_2, sE = Math.sin(Math.PI / 6), cE = Math.cos(Math.PI / 6);
            const proj = (x, y, z) => { const X = mOf(x - dom.x0), Y = -mOf(y - dom.y0), Zm = (z - zr.min) / 1000 * zr.ex; const u = (X - Y) * ca, v = (X + Y) * ca; return [u, -v * sE - Zm * cE, v]; };
            let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
            for (let k = 0; k < Z.length; k++) { if (isNaN(Z[k])) continue; const P = proj(dom.x0 + (k % nx) * cs, dom.y0 + Math.floor(k / nx) * cs, Z[k]); u0 = Math.min(u0, P[0]); u1 = Math.max(u1, P[0]); w0 = Math.min(w0, P[1]); w1 = Math.max(w1, P[1]); }
            if (!isFinite(u0)) return null;
            const sc = Math.min((Wpx * 0.94) / (u1 - u0 || 1), (Hpx * 0.92) / (w1 - w0 || 1)), ox = (Wpx - (u1 - u0) * sc) / 2 - u0 * sc, oy = (Hpx - (w1 - w0) * sc) / 2 - w0 * sc;
            const S = (x, y, z) => { const P = proj(x, y, z); return [ox + P[0] * sc, oy + P[1] * sc, P[2]]; };
            const cells = [];
            for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
                const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx; if (isNaN(Z[a]) || isNaN(Z[b]) || isNaN(Z[c]) || isNaN(Z[d])) continue;
                const x = dom.x0 + i * cs, y = dom.y0 + j * cs; cells.push({ a, b, c, d, x, y, v: proj(x + cs / 2, y + cs / 2, 0)[2] });
            }
            cells.sort((p, q) => q.v - p.v);
            const step = zr.step, lx = -0.45, ly = 0.35, lz = 0.82;
            g.lineJoin = 'round';
            for (const q of cells) {
                const za = Z[q.a], zb = Z[q.b], zc = Z[q.c], zd = Z[q.d], zm = (za + zb + zc + zd) / 4;
                const dzx = ((zb + zc) - (za + zd)) / 2 / 1000 * zr.ex / mOf(cs), dzy = -((zd + zc) - (za + zb)) / 2 / 1000 * zr.ex / mOf(cs);
                const nl = Math.hypot(dzx, dzy, 1), sh = 0.72 + 0.4 * Math.max(0, (-dzx * lx - dzy * ly + lz) / nl);
                const ks = which === 'tn' ? [0] : [K[q.a], K[q.b], K[q.c], K[q.d]];
                let rgb = cubRampRGB((zm - zr.min) / (zr.max - zr.min || 1), Math.min(1.25, sh));
                if (ks.every(v => v === 1)) rgb = rgb.map(v => Math.round(v * 0.55 + 235 * 0.45));   // plateforme : teinte éclaircie
                const P = [S(q.x, q.y, za), S(q.x + cs, q.y, zb), S(q.x + cs, q.y + cs, zc), S(q.x, q.y + cs, zd)];
                g.fillStyle = 'rgb(' + rgb.join(',') + ')'; g.strokeStyle = g.fillStyle; g.lineWidth = 0.9;
                g.beginPath(); P.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.stroke();
                const lo = Math.min(za, zb, zc, zd), hi = Math.max(za, zb, zc, zd);
                for (let lev = Math.ceil(lo / step) * step; lev <= hi; lev += step) {
                    const E = [[q.x, q.y, za, q.x + cs, q.y, zb], [q.x + cs, q.y, zb, q.x + cs, q.y + cs, zc], [q.x + cs, q.y + cs, zc, q.x, q.y + cs, zd], [q.x, q.y + cs, zd, q.x, q.y, za]], hits = [];
                    E.forEach(([x1, y1, z1, x2, y2, z2]) => { if ((z1 < lev) !== (z2 < lev)) { const t = (lev - z1) / (z2 - z1); hits.push(S(x1 + t * (x2 - x1), y1 + t * (y2 - y1), lev)); } });
                    if (hits.length >= 2) { const major = Math.abs(lev / (step * 5) - Math.round(lev / (step * 5))) < 1e-6;
                        g.strokeStyle = major ? 'rgba(20,20,20,0.75)' : 'rgba(30,30,30,0.35)'; g.lineWidth = major ? 1.3 : 0.7;
                        g.beginPath(); g.moveTo(hits[0][0], hits[0][1]); g.lineTo(hits[1][0], hits[1][1]); if (hits.length === 4) { g.moveTo(hits[2][0], hits[2][1]); g.lineTo(hits[3][0], hits[3][1]); } g.stroke(); }
                }
            }
            // contours des plateformes par-dessus, et leurs noms
            C.items.forEach(it => {
                const dense = []; it.ring.forEach((p, k) => { const q2 = it.ring[(k + 1) % it.ring.length]; for (let t = 0; t < 1; t += 0.1) dense.push({ x: p.x + (q2.x - p.x) * t, y: p.y + (q2.y - p.y) * t }); });
                g.save(); g.strokeStyle = which === 'tn' ? '#111827' : '#7c2d12'; g.lineWidth = which === 'tn' ? 2.2 : 3; g.setLineDash(which === 'tn' ? [10, 6] : []); g.beginPath();
                dense.forEach((p, k) => { const z = which === 'tn' ? tinZ(p.x, p.y, C.tn) : cubZp(it, p.x, p.y); if (!hasZ(z)) return; const P = S(p.x, p.y, z); k ? g.lineTo(P[0], P[1]) : g.moveTo(P[0], P[1]); });
                g.closePath(); g.stroke(); g.restore();
                if (C.items.length > 1) { const gc = polyCentroid(it.ring), z = which === 'tn' ? tinZ(gc.x, gc.y, C.tn) : cubZp(it, gc.x, gc.y);
                    if (hasZ(z)) { const P = S(gc.x, gc.y, z); g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(it.name).width + 14;
                        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(P[0] - w / 2, P[1] - 17, w, 34); g.fillStyle = '#7c2d12'; g.fillText(it.name, P[0], P[1] + 1); } }
            });
            return cv.toDataURL('image/jpeg', 0.9);
        }
        // Cubatures en PDF (A4) : logo, cartouche, chiffres clés, niveaux et résultats par plateforme, vue en plan cotée, hypothèses, vues isométriques ; détail du calcul en annexe (option)
        async function cubPDF(withDetail, D) {
            const C = window.__cubPdf; if (!C) { alert('Lancez d\'abord le calcul.'); return; }
            if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; }
            updateCommandMessageText('CUBATURES : préparation du PDF…');
            const { jsPDF } = window.jspdf, doc = D ? D.doc : new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); if (D) { if (D.used) doc.addPage(); D.used = true; } const p0 = doc.getNumberOfPages();
            const W = 210, M = 15, base = (fileName ? baseName(fileName) : 'plan'), BOT = 282;
            const nf = (v, d) => nfr(v, d === undefined ? 2 : d).replace(/[  ]/g, ' ');
            const clean = (t) => String(t).replace(/[  ]/g, ' ').replace(/³/g, '3').replace(/²/g, '2').replace(/[−–]/g, '-').replace(/→/g, '->');
            const logo = await cubLogoPNG();
            C.items.forEach(it => { it.L = cubLevels(C, it); });
            let y;
            const header = (title) => {
                let x = M;
                if (cartoucheData.logo) { try { const lb = logoBox(20); doc.addImage(cartoucheData.logo, M + lb.x, M + lb.y, lb.w, lb.h, undefined, 'FAST'); x = M + 24; } catch (e) {} }
                doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(title, x, M + 7);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
                [cartoucheData.planName ? 'Plan : ' + cartoucheData.planName + (cartoucheIndice(cartoucheData.indice) ? '  (' + cartoucheIndice(cartoucheData.indice) + ')' : '') : 'Fichier : ' + base,
                 cartoucheData.clientName ? 'Client : ' + cartoucheData.clientName : '', cartoucheData.draftsmanName ? 'Dessinateur : ' + cartoucheData.draftsmanName : ''].filter(Boolean)
                    .forEach((t, i) => doc.text(clean(t), x, M + 13 + i * 4.6));
                if (logo) { const h = 7, w = h * logo.r; doc.addImage(logo.url, 'PNG', W - M - w, M + 1, w, h); }
                doc.setFontSize(9); doc.setTextColor(90); doc.text(new Date().toLocaleDateString('fr-FR'), W - M, M + 14, { align: 'right' });
                doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.6); doc.line(M, M + 26, W - M, M + 26);
                return M + 32;
            };
            const newPage = (title) => { doc.addPage(); y = header(title); };
            const need = (h, title) => { if (y + h > BOT) newPage(title || 'Cubatures (suite)'); };
            const h2 = (t) => { doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(clean(t), M, y); y += 5; };
            // tableau générique : cols [{t, w, a: 'l'|'r', c: [r,g,b]}], lignes [{v: [...], b: gras, sub: retrait, top: trait}]
            const table = (cols, rows, fs) => {
                fs = fs || 9; const rh = fs * 0.72;
                const head = () => { doc.setFillColor(31, 41, 55); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(fs - 0.5);
                    let cx = M; cols.forEach(c => { doc.text(c.t, c.a === 'l' ? cx + 2 : cx + c.w - 2, y, { align: c.a === 'l' ? 'left' : 'right' }); cx += c.w; }); y += 7; };
                head();
                rows.forEach((r, k) => {
                    if (y > BOT) { newPage('Cubatures (suite)'); head(); }
                    if (r.zebra) { doc.setFillColor(243, 244, 246); doc.rect(M, y - rh + 0.4, W - 2 * M, rh + 1.6, 'F'); }
                    if (r.top) { doc.setDrawColor(107, 114, 128); doc.setLineWidth(0.4); doc.line(M, y - rh + 0.4, W - M, y - rh + 0.4); }
                    doc.setFont('helvetica', r.b ? 'bold' : 'normal'); doc.setFontSize(fs);
                    let cx = M; cols.forEach((c, i) => { const v = r.v[i]; if (v === undefined || v === '') { cx += c.w; return; }
                        const col = c.c || [20, 20, 20]; doc.setTextColor(col[0], col[1], col[2]);
                        const t = c.a === 'l' ? (doc.splitTextToSize(clean(v), c.w - 3 - (i === 0 && r.sub ? 4 : 0))[0] || '') : clean(v);
                        doc.text(t, c.a === 'l' ? cx + 2 + (i === 0 && r.sub ? 4 : 0) : cx + c.w - 2, y, { align: c.a === 'l' ? 'left' : 'right' }); cx += c.w; });
                    y += rh + 1.3; });
                y += 4;
            };
            y = header('Note de cubature');
            // chiffres clés
            const KC = [['Déblai total', C.D, [220, 38, 38]]].concat(C.RP > 1e-6 ? [['Remblai', C.Rm - C.RP, [37, 99, 235]], ['Remblai périphérique', C.RP, [180, 83, 9]]] : [['Remblai total', C.Rm, [37, 99, 235]]]);
            const bw = (W - 2 * M - 4 * (KC.length - 1)) / KC.length;
            KC.forEach(([l, v, col], i) => {
                const bx = M + i * (bw + 4); doc.setFillColor(243, 244, 246); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3); doc.roundedRect(bx, y, bw, 17, 2, 2, 'FD');
                doc.setFontSize(8.5); doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.text(l, bx + 3, y + 5.5);
                doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(col[0], col[1], col[2]); doc.text(nf(v) + ' m3', bx + 3, y + 13.5); });
            y += 24;
            // niveaux par plateforme
            need(20); h2('Niveaux');
            const R = [185, 28, 28], B = [29, 78, 216];
            table([{ t: 'Plateforme', w: 40, a: 'l' }, { t: 'Niveau plateforme', w: 34, a: 'r' }, { t: 'TN mini', w: 20, a: 'r' }, { t: 'TN moyen', w: 20, a: 'r' }, { t: 'TN maxi', w: 20, a: 'r' }, { t: 'Remblai maxi', w: 23, a: 'r', c: B }, { t: 'Déblai maxi', w: 23, a: 'r', c: R }],
                C.items.map((it, k) => ({ zebra: k % 2 === 1, v: [it.name, it.SL ? nf(it.L.pMin / 1000) + ' -> ' + nf(it.L.pMax / 1000) + ' m' : nf(it.zp / 1000) + ' m', isFinite(it.L.tMin) ? nf(it.L.tMin / 1000) + ' m' : '-', hasZ(it.L.tMoy) ? nf(it.L.tMoy / 1000) + ' m' : '-', isFinite(it.L.tMax) ? nf(it.L.tMax / 1000) + ' m' : '-', nf(it.L.hR / 1000) + ' m', nf(it.L.hD / 1000) + ' m'] })), 8.5);
            // résultats
            need(20); h2('Résultats');
            const rr = []; C.items.forEach(it => {
                rr.push({ top: true, b: true, v: [it.name + ' - plateforme', nf(it.pr.deb), nf(it.pr.rem), nf(it.area)] });
                if (it.tal) rr.push({ sub: true, v: [it.on ? 'talus (' + talusInfo(it.s) + ')' : 'talus des plateformes voisines posés dessus', nf(it.tal.deb), nf(it.tal.rem), nf(it.tal.sR + it.tal.sD)] });
                (it.extra || []).forEach(e => rr.push({ sub: true, b: !!e.info, v: [e.lbl, e.info && !e.dOnly ? '' : nf(e.deb), e.dOnly ? '' : nf(e.rem), ''] }));
                const xd = (it.extra || []).reduce((a, e) => a + (e.info ? 0 : e.deb), 0), xr = (it.extra || []).reduce((a, e) => a + (e.info ? 0 : e.rem), 0);
                if (C.items.length > 1) rr.push({ sub: true, v: ['sous-total ' + it.name, nf(it.pr.deb + (it.tal ? it.tal.deb : 0) + xd), nf(it.pr.rem + (it.tal ? it.tal.rem : 0) + xr), ''], zebra: true });
            });
            rr.push({ top: true, b: true, v: ['Total (' + C.items.length + ' plateforme' + (C.items.length > 1 ? 's' : '') + ')', nf(C.D), nf(C.Rm), nf(C.sTot)] });
            if (C.RP > 1e-6) rr.push({ sub: true, v: ['dont remblai', '', nf(C.Rm - C.RP), ''] }, { sub: true, v: ['dont remblai périphérique', '', nf(C.RP), ''] });
            table([{ t: 'Poste', w: W - 2 * M - 96, a: 'l' }, { t: 'Déblai (m3)', w: 32, a: 'r', c: R }, { t: 'Remblai (m3)', w: 32, a: 'r', c: B }, { t: 'Surface (m2)', w: 32, a: 'r' }], rr);
            // structures : quantités de matériaux
            if (C.SQ && C.SQ.length) {
                need(24); h2('Structures : quantités de matériaux');
                const sr = [], tot = {}; let last = null;
                C.SQ.forEach(q => { const k = q.name; tot[k] = tot[k] || { v: 0, vf: 0, t: 0, surf: q.surf }; tot[k].v += q.surf ? q.A : q.v; tot[k].vf += q.vf; tot[k].t += q.t;
                    if (q.pf !== last) { const it = C.items.find(x => x.name === q.pf); sr.push({ top: true, b: true, v: [q.pf + (it && it.Emm ? ' - ' + nf(it.Emm / 10, 0) + ' cm, fond de forme ' + (it.SL ? 'niveaux - ' + nf(it.Emm / 1000) + ' m' : nf((it.zp - it.Emm) / 1000) + ' m') : ''), '', '', '', '', ''] }); last = q.pf; }
                    sr.push({ sub: true, v: [q.name, q.surf ? '-' : nf(q.e, 0) + ' cm', q.surf ? nf(q.A) + ' m2' : nf(q.v) + ' m3', nf(q.coef), q.surf ? nf(q.vf) + ' m2' : nf(q.vf) + ' m3', q.surf ? '-' : nf(q.t, 1) + ' t'] }); });
                Object.keys(tot).forEach((k, i) => sr.push({ top: i === 0, b: true, zebra: true, v: ['Total ' + k, '', nf(tot[k].v) + (tot[k].surf ? ' m2' : ' m3'), '', nf(tot[k].vf) + (tot[k].surf ? ' m2' : ' m3'), tot[k].surf ? '-' : nf(tot[k].t, 1) + ' t'] }));
                table([{ t: 'Couche', w: W - 2 * M - 120, a: 'l' }, { t: 'Epaisseur', w: 20, a: 'r' }, { t: 'En place', w: 28, a: 'r' }, { t: 'Foison.', w: 16, a: 'r' }, { t: 'Foisonné', w: 30, a: 'r', c: [180, 83, 9] }, { t: 'Tonnage', w: 26, a: 'r' }], sr, 8.5);
            }
            // ---- vue en plan cotée ----
            const geo = C.items.map(it => { let G = null; try { G = talusGeom(it.s); } catch (e) {} return G; });
            const all = [].concat(...C.items.map((it, i) => it.ring.concat(geo[i] && geo[i].toe ? geo[i].toe : [])));
            const sketchH = 92; need(sketchH + 10);
            h2('Vue en plan : niveaux des plateformes et du terrain naturel');
            const x0 = arrMin(all.map(q => q.x)), x1 = arrMax(all.map(q => q.x)), y0 = arrMin(all.map(q => q.y)), y1 = arrMax(all.map(q => q.y));
            const bwid = W - 2 * M, k = Math.min((bwid - 14) / ((x1 - x0) || 1), (sketchH - 14) / ((y1 - y0) || 1));
            const ox = M + (bwid - (x1 - x0) * k) / 2, oy = y + (sketchH - (y1 - y0) * k) / 2;
            const P = (q) => [ox + (q.x - x0) * k, oy + (q.y - y0) * k];
            doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3); doc.rect(M, y, bwid, sketchH);
            const poly = (arr, style) => { const a = arr.map(P); doc.lines(a.slice(1).map((q, i) => [q[0] - a[i][0], q[1] - a[i][1]]), a[0][0], a[0][1], [1, 1], style, true); };
            geo.forEach(G => { if (G && G.toeParts && G.toeParts.length) { doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.25); doc.setLineDashPattern([1.2, 0.8], 0);
                G.toeParts.forEach(pt => { const a = pt.map(P); doc.lines(a.slice(1).map((q, i) => [q[0] - a[i][0], q[1] - a[i][1]]), a[0][0], a[0][1], [1, 1], 'S', false); }); doc.setLineDashPattern([], 0);
                doc.setLineWidth(0.15); (G.ticks || []).forEach(([a, b]) => { const A = P(a), Bq = P(b); doc.line(A[0], A[1], Bq[0], Bq[1]); }); } });
            let shade = false;
            C.items.forEach(it => {
                const pts = it.ring; doc.setFillColor(243, 244, 246); poly(pts, 'F');
                const cs = 1.2 / k, ex = arrMin(pts.map(q => q.x)), ex1 = arrMax(pts.map(q => q.x)), ey = arrMin(pts.map(q => q.y)), ey1 = arrMax(pts.map(q => q.y));
                for (let gy = ey; gy < ey1; gy += cs) { let run = null;
                    const flush = () => { if (!run) return; if (run.c < 0) doc.setFillColor(252, 165, 165); else doc.setFillColor(147, 197, 253);
                        const A = P({ x: run.x0, y: gy }); doc.rect(A[0], A[1], (run.x1 - run.x0) * k + 0.05, cs * k + 0.05, 'F'); run = null; };
                    for (let gx = ex; gx < ex1; gx += cs) { const cx = gx + cs / 2, cy = gy + cs / 2; let c = 0;
                        if (pointInPolygon(cx, cy, pts)) { const r = C.FM.at(cx, cy), zt = tinZ(cx, cy, C.tn), zf = r ? r.z : cubZp(it, cx, cy); if (hasZ(zt) && hasZ(zf)) c = zf < zt ? -1 : 1; }
                        if (run && run.c === c) { run.x1 = gx + cs; continue; } flush(); if (c) { shade = true; run = { c, x0: gx, x1: gx + cs }; } }
                    flush(); }
                doc.setDrawColor(180, 83, 9); doc.setLineWidth(0.45); poly(pts, 'S');
            });
            const used = [], free = (px, py, w, h) => !used.some(u => px < u[0] + u[2] && px + w > u[0] && py < u[1] + u[3] && py + h > u[1]);
            // emplacements des noms / niveaux des plateformes réservés d'abord (prioritaires sur les cotes du TN), dessinés en dernier
            const labs = [];
            C.items.forEach(it => {
                const gC = polyCentroid(it.ring), A = P({ x: gC.x, y: gC.y }), t = it.name + (it.SL ? '' : '  ' + nf(it.zp / 1000) + ' m');
                doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); const w = doc.getTextWidth(clean(t)) + 4; labs.push({ k: 'n', A, t, w }); used.push([A[0] - w / 2 - 1, A[1] - 4.4, w + 2, 7]);
                if (it.SL) { doc.setFontSize(6.5); it.ring.forEach(q => { if (!hasZ(q.z)) return; const Aq = P(q), tq = nf(q.z / 1000), wq = doc.getTextWidth(tq) + 1.6; labs.push({ k: 'v', A: Aq, t: tq, w: wq }); used.push([Aq[0] + 0.6, Aq[1] - 3, wq, 3.4]); }); }
            });
            const inLab = (px, py) => used.some(u => px > u[0] - 0.8 && px < u[0] + u[2] + 0.8 && py > u[1] - 0.8 && py < u[1] + u[3] + 0.8);
            const bx0 = x0 - (x1 - x0) * 0.02, bx1 = x1 + (x1 - x0) * 0.02, by0 = y0 - (y1 - y0) * 0.02, by1 = y1 + (y1 - y0) * 0.02;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8);
            C.tn.nodes.filter(nd => nd.x >= bx0 && nd.x <= bx1 && nd.y >= by0 && nd.y <= by1).forEach(nd => { const A = P(nd); if (A[0] < M + 1 || A[0] > M + bwid - 1 || A[1] < y + 1 || A[1] > y + sketchH - 1 || inLab(A[0], A[1])) return;
                const t = nf(nd.z / 1000), w = doc.getTextWidth(t) + 1; doc.setDrawColor(21, 128, 61); doc.setLineWidth(0.2); doc.line(A[0] - 0.6, A[1], A[0] + 0.6, A[1]); doc.line(A[0], A[1] - 0.6, A[0], A[1] + 0.6);
                if (free(A[0] + 0.8, A[1] - 2.2, w, 2.4) && A[0] + 0.8 + w < M + bwid) { used.push([A[0] + 0.8, A[1] - 2.2, w, 2.4]); doc.setTextColor(21, 128, 61); doc.text(t, A[0] + 0.9, A[1] - 0.4); } });
            labs.forEach(l => { doc.setFont('helvetica', 'bold');
                if (l.k === 'n') { doc.setFontSize(8.5); doc.setFillColor(255, 255, 255); doc.setDrawColor(124, 45, 18); doc.setLineWidth(0.3); doc.roundedRect(l.A[0] - l.w / 2, l.A[1] - 3.4, l.w, 5, 1, 1, 'FD'); doc.setTextColor(124, 45, 18); doc.text(clean(l.t), l.A[0], l.A[1] + 0.2, { align: 'center' }); }
                else { doc.setFontSize(6.5); doc.setFillColor(255, 255, 255); doc.rect(l.A[0] + 0.6, l.A[1] - 3, l.w, 3.4, 'F'); doc.setTextColor(124, 45, 18); doc.text(l.t, l.A[0] + 1.4, l.A[1] - 0.4); } });
            const mPerMm = mOf(1) / k, nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find(v => v / mPerMm >= 15) || 1000, Ls = nice / mPerMm;
            doc.setDrawColor(20); doc.setLineWidth(0.4); doc.line(M + 4, y + sketchH - 4, M + 4 + Ls, y + sketchH - 4); doc.line(M + 4, y + sketchH - 5.2, M + 4, y + sketchH - 2.8); doc.line(M + 4 + Ls, y + sketchH - 5.2, M + 4 + Ls, y + sketchH - 2.8);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(60); doc.text(nice + ' m', M + 4 + Ls / 2, y + sketchH - 5.6, { align: 'center' });
            doc.text((shade ? 'Déblai (rouge), remblai (bleu)' : 'Plateformes') + (geo.some(Boolean) ? ' ; pied de talus (tirets)' : '') + ' ; cotes TN en vert', W - M - 3, y + sketchH - 3, { align: 'right' });
            y += sketchH + 7;
            // ---- hypothèses ----
            need(30); h2('Hypothèses');
            doc.setFontSize(8.5);
            [['Projet', C.items.length + ' plateforme' + (C.items.length > 1 ? 's' : '') + ' calculée' + (C.items.length > 1 ? 's' : '') + ' : ' + C.items.map(it => it.name + ' (' + platLabel(it.SL || { flat: true, zp: it.zp }) + ')').join(', ')],
             ['Exclues', C.excluded.length ? C.excluded.join(', ') + ' (décochées : ni volumes, ni talus)' : 'aucune'],
             ['Talus', C.items.map(it => it.name + ' : ' + (it.on ? talusInfo(it.s) : 'sans talus')).join(' ; ')],
             ['Terrain naturel', C.tn.tris.length + ' triangles (points cotés du plan)']].forEach(([a, b]) => { need(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(60); doc.text(a + ' :', M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
                const L2 = doc.splitTextToSize(clean(b), W - 2 * M - 32); doc.text(L2, M + 32, y); y += 4.3 * L2.length; });
            y += 1.5;
            C.notes.forEach(t => { const L2 = doc.splitTextToSize('- ' + clean(t), W - 2 * M); need(4 * L2.length + 1); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90); doc.text(L2, M, y); y += 4 * L2.length + 0.5; });
            // ---- vues isométriques ----
            const dom = { x0: x0 - (x1 - x0) * 0.12, x1: x1 + (x1 - x0) * 0.12, y0: y0 - (y1 - y0) * 0.12, y1: y1 + (y1 - y0) * 0.12 };
            let zmin = Infinity, zmax = -Infinity;
            for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const xx = dom.x0 + (dom.x1 - dom.x0) * i / 40, yy = dom.y0 + (dom.y1 - dom.y0) * j / 40, zt = tinZ(xx, yy, C.tn);
                if (hasZ(zt)) { zmin = Math.min(zmin, zt); zmax = Math.max(zmax, zt); } const r2 = C.FM.at(xx, yy); if (r2 && hasZ(r2.z)) { zmin = Math.min(zmin, r2.z); zmax = Math.max(zmax, r2.z); } }
            if (isFinite(zmin)) {
                const span = mOf(Math.max(dom.x1 - dom.x0, dom.y1 - dom.y0)), dz = Math.max((zmax - zmin) / 1000, 0.01);
                const ex = Math.max(1, Math.min(10, Math.round(span * 0.18 / dz)));
                const rawStep = dz / 12, step = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10].find(v => v >= rawStep) || 10;
                const zr = { min: zmin, max: zmax, ex, step: step * 1000 };
                const imgH = 100, imgW = W - 2 * M;
                need(2 * imgH + 34, 'Cubatures : vues 3D');
                h2('Vues isométriques 3D (depuis le sud-ouest)');
                const iT = cubIsoImage(C, 'tn', dom, zr, 1700, Math.round(1700 * imgH / imgW)), iP = cubIsoImage(C, 'proj', dom, zr, 1700, Math.round(1700 * imgH / imgW));
                [[iT, 'Terrain naturel (plateformes en tirets)'], [iP, 'Projet : plateformes (teinte claire) + talus + terrain']].forEach(([im, t]) => {
                    if (im) doc.addImage(im, 'JPEG', M, y, imgW, imgH); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3); doc.rect(M, y, imgW, imgH);
                    doc.setFontSize(8.5); doc.setTextColor(40); doc.setFont('helvetica', 'bold'); doc.text(clean(t), M + 2, y + 5); y += imgH + 3; });
                y += 3;
                const lw = 90; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(60);
                for (let i = 0; i < 60; i++) { const c = cubRampRGB(i / 59, 1); doc.setFillColor(c[0], c[1], c[2]); doc.rect(M + i * lw / 60, y, lw / 60 + 0.05, 3.2, 'F'); }
                doc.text(nf(zmin / 1000) + ' m', M, y + 7); doc.text(nf((zmin + zmax) / 2000) + ' m', M + lw / 2, y + 7, { align: 'center' }); doc.text(nf(zmax / 1000) + ' m', M + lw, y + 7, { align: 'right' });
                doc.text(clean('Altitudes du bas (bleu) au haut (rouge) ; courbes tous les ' + nf(step, 2) + ' m (maîtresses tous les ' + nf(step * 5, 2) + ' m) ; exagération verticale x' + ex + '.'), M + lw + 4, y + 2.6, { maxWidth: W - 2 * M - lw - 4 });
                y += 12;
            }
            // ---- annexe : détail du calcul ----
            if (withDetail) {
                newPage('Détail du calcul');
                h2('Méthode');
                const meth = ['Le terrain naturel (TN) est un maillage de triangles reliant les points cotés du plan. Sur chaque triangle, le TN est un plan exact z = a.x + b.y + c.',
                    'Chaque triangle du TN est découpé par le contour de la plateforme, puis par la ligne où le TN coupe le niveau projet : la partie sous le projet est en remblai, la partie au-dessus en déblai. Une plateforme inclinée est elle-même découpée en triangles par ses sommets (Z exacts aux sommets) : la différence de deux plans est linéaire, le volume reste exact.',
                    'Volume d\'une partie = surface x épaisseur au centre de gravité (exact pour une épaisseur qui varie linéairement). Volumes géométriques, en place, sans foisonnement.',
                    'Talus : la surface finie (talus jusqu\'au terrain, raccordés entre plateformes cochées) est échantillonnée par mailles ; volume = somme des surfaces de maille x épaisseur au centre. Les plateformes décochées n\'existent pas pour ce calcul.'];
                meth.forEach(t => { const L2 = doc.splitTextToSize(clean(t), W - 2 * M); need(4.2 * L2.length + 1, 'Détail du calcul (suite)'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30); doc.text(L2, M, y); y += 4.2 * L2.length + 1.2; });
                y += 3;
                C.items.forEach(it => {
                    const det = cubDetail(C, it);
                    { const tH = 95; need(tH + 12, 'Détail du calcul (suite)'); h2(it.name + ' : triangles du terrain naturel dans la plateforme');
                      const tris = det.map(d => C.tn.tris[d.n - 1].map(i => C.tn.nodes[i])), allP = [].concat(...tris).concat(it.ring);
                      const tx0 = arrMin(allP.map(q => q.x)), tx1 = arrMax(allP.map(q => q.x)), ty0 = arrMin(allP.map(q => q.y)), ty1 = arrMax(allP.map(q => q.y));
                      const kk = Math.min((W - 2 * M - 8) / ((tx1 - tx0) || 1), (tH - 8) / ((ty1 - ty0) || 1)), tox = M + (W - 2 * M - (tx1 - tx0) * kk) / 2, toy = y + (tH - (ty1 - ty0) * kk) / 2;
                      const T = (q) => [tox + (q.x - tx0) * kk, toy + (q.y - ty0) * kk];
                      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3); doc.rect(M, y, W - 2 * M, tH);
                      const ea = it.ring.map(T); doc.setFillColor(254, 243, 199); doc.lines(ea.slice(1).map((q, i) => [q[0] - ea[i][0], q[1] - ea[i][1]]), ea[0][0], ea[0][1], [1, 1], 'F', true);
                      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.15);
                      tris.forEach(t => { const a = t.map(T); doc.lines([[a[1][0] - a[0][0], a[1][1] - a[0][1]], [a[2][0] - a[1][0], a[2][1] - a[1][1]]], a[0][0], a[0][1], [1, 1], 'S', true); });
                      doc.setDrawColor(180, 83, 9); doc.setLineWidth(0.4); doc.lines(ea.slice(1).map((q, i) => [q[0] - ea[i][0], q[1] - ea[i][1]]), ea[0][0], ea[0][1], [1, 1], 'S', true);
                      if (det.length) { doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.max(5, Math.min(7.5, kk * Math.sqrt(arrMin(det.map(d => d.s)) / Math.pow(mOf(1), 2)) * 0.9 + 3)));
                        tris.forEach((t, i) => { const c = T({ x: (t[0].x + t[1].x + t[2].x) / 3, y: (t[0].y + t[1].y + t[2].y) / 3 }); doc.setTextColor(30, 41, 59); doc.text(String(det[i].n), c[0], c[1] + 1, { align: 'center' }); }); }
                      y += tH + 7; }
                    const sumD = det.reduce((a, d) => a + d.deb, 0), sumR = det.reduce((a, d) => a + d.rem, 0), sumS = det.reduce((a, d) => a + d.s, 0);
                    const rowsD = det.map((d, i) => ({ zebra: i % 2 === 1, v: [String(d.n), nf(d.z[0] / 1000, 3), nf(d.z[1] / 1000, 3), nf(d.z[2] / 1000, 3), nf(d.s), nf(d.ztn / 1000, 3), nf(d.zp / 1000, 3), d.deb > 0.0005 ? nf(d.deb, 3) : '-', d.rem > 0.0005 ? nf(d.rem, 3) : '-'] }));
                    rowsD.push({ top: true, b: true, v: ['Total', '', '', '', nf(sumS), '', '', nf(sumD, 3), nf(sumR, 3)] });
                    need(20, 'Détail du calcul (suite)'); h2(it.name + ' : détail par triangle (' + det.length + ' triangles)');
                    table([{ t: 'Tri. TN', w: 16, a: 'r' }, { t: 'Z1 TN', w: 19, a: 'r' }, { t: 'Z2 TN', w: 19, a: 'r' }, { t: 'Z3 TN', w: 19, a: 'r' }, { t: 'Surf. (m2)', w: 24, a: 'r' }, { t: 'Z moy TN', w: 22, a: 'r' }, { t: 'Z moy proj.', w: 22, a: 'r' }, { t: 'Déblai m3', w: 20, a: 'r', c: R }, { t: 'Remblai m3', w: 19, a: 'r', c: B }], rowsD, 7.5);
                    if (it.tal) { need(16, 'Détail du calcul (suite)'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30);
                        doc.text(clean(it.name + ' - ' + (it.on ? 'talus' : 'talus des voisines posés dessus') + ' : déblai ' + nf(it.tal.deb, 3) + ' m3, remblai ' + nf(it.tal.rem, 3) + ' m3, surface ' + nf(it.tal.sR + it.tal.sD) + ' m2, mailles de ' + nf(mOf(it.tal.grid.cell)) + ' m.'), M, y); y += 7; }
                    doc.setFontSize(8); doc.setTextColor(90); doc.text(doc.splitTextToSize(clean('Contrôle : la somme des triangles (déblai ' + nf(sumD) + ' m3, remblai ' + nf(sumR) + ' m3) est le calcul exact sur tout le contour de ' + it.name + (it.ov ? ' ; on retire la zone recouverte par une autre plateforme (' + nf(it.ov.a) + ' m2 : déblai ' + nf(it.ov.deb) + ' m3, remblai ' + nf(it.ov.rem) + ' m3), comptée avec la plateforme du dessus, soit ' + nf(it.pr.deb) + ' / ' + nf(it.pr.rem) + ' m3.' : ', égal au résultat de la plateforme.')), W - 2 * M), M, y); y += it.ov ? 13 : 9;
                });
            }
            { const BL = bassinCubData(); if (BL.length) { need(28, 'Bassins de rétention'); h2('Bassins de rétention');
                const T = BL.reduce((a, { C }) => ({ ut: a.ut + C.Vut, f: a.f + C.Vf, l: a.l + C.Vlit, r: a.r + C.Vrem }), { ut: 0, f: 0, l: 0, r: 0 });
                table([{ t: 'Bassin', w: 56, a: 'l' }, { t: 'Utile (m3)', w: 22, a: 'r' }, { t: 'Fond (NGF)', w: 22, a: 'r' }, { t: 'Prof. (m)', w: 18, a: 'r' }, { t: 'Déblai (m3)', w: 22, a: 'r', c: [185, 28, 28] }, { t: 'Lit (m3)', w: 18, a: 'r' }, { t: 'Remblai (m3)', w: 22, a: 'r', c: [29, 78, 216] }],
                    BL.map(({ s: b, C }, k) => ({ zebra: k % 2, v: [(b.name || 'Bassin') + ' - ' + BASSIN_T[b.bassin.t].nm.toLowerCase(), nfr(C.Vut, 1), nfr(C.zFond / 1000, 2), nfr(C.Df, 2), nfr(C.Vf, 2), nfr(C.Vlit, 2), nfr(C.Vrem, 2)] }))
                        .concat([{ top: true, b: true, v: ['Total bassins', nfr(T.ut, 1), '', '', nfr(T.f, 2), nfr(T.l, 2), nfr(T.r, 2)] }])); } }
            { const N = mailNoteCfg(), CM = cubComputeCached(); mailSets().filter(x => x.k !== 'hyd' && N.on[x.set]).forEach(x => { const R = mailDecomp(CM, x.set); if (!R) return; need(28, 'Déblais par couche - ' + x.set); h2('Déblais par couche - maillage ' + x.set);
                table([{ t: x.k === 'pol' ? 'Classe' : 'Couche', w: 62, a: 'l' }, { t: 'Part (%)', w: 22, a: 'r' }, { t: 'Déblai (m3)', w: 26, a: 'r', c: [185, 28, 28] }, { t: x.k === 'pol' ? 'Pollution' : 'Dureté (MPa)', w: 70, a: 'l' }],
                    R.rows.map((r, k) => ({ zebra: k % 2, v: [(r.nm + (r.cells ? ' (' + r.cells + ')' : '')).slice(0, 48), nfr(r.pct, 1), nfr(r.v, 1), x.k === 'pol' ? (r.pol || '').slice(0, 50) : r.mpa !== null ? nfr(r.mpa, 1) + (r.mpaMax > r.mpa + 0.05 ? ' (max ' + nfr(r.mpaMax, 1) + ')' : '') : ''] }))
                        .concat([{ top: true, b: true, v: ['Total déblai', '100', nfr(R.D, 1), ''] }])); }); }
            const n = doc.getNumberOfPages(); for (let i = p0; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120); doc.text('MomoCAD - cubatures - page ' + i + '/' + n, W / 2, 290, { align: 'center' }); }
            const fn = base + (withDetail ? '_cubatures_detail.pdf' : '_cubatures.pdf');
            if (D) return; doc.save(fn);
            updateCommandMessageText('CUBATURES : PDF « ' + fn + ' » produit (' + n + ' page' + (n > 1 ? 's' : '') + ').');
        }
        // Tracés : limite déblai / remblai (dans chaque plateforme horizontale) et limite des talus (entrée en terre)
        function drawCubLines() {
            const c = cubResult; if (!c || !c.items) { updateCommandMessageText('Lancez d\'abord le calcul.'); return; }
            const oldL = new Set(layers.filter(l => /^(limite des talus|limite d.blai remblai)$/i.test(String(l.name).trim())).map(l => l.id));   // anciens tracés (y compris relus d'un DXF) : remplacés
            shapes = shapes.filter(x => x.gen !== 'cubzero' && x.gen !== 'cubtalus' && !(x.type === 'poly' && oldL.has(x.layerId)));
            const l0 = ensureLayer('Limite déblai remblai', '#f472b6', 'dashed', 1.4); let nb = 0, nt = 0;
            c.items.forEach(it => {
                if (!it.SL && hasZ(it.zp)) contourPolylines(c.tn, it.zp).forEach(pl => {
                    let cur = []; const flush = () => { if (cur.length >= 2) { shapes.push({ type: 'poly', layerId: l0, points: cur.map(p => ({ x: p.x, y: p.y, z: it.zp })), open: true, hatch: false, gen: 'cubzero', zk: 1 }); nb++; } cur = []; };
                    pl.forEach(p => { if (pointInPolygon(p.x, p.y, it.ring)) cur.push(p); else flush(); }); flush();
                });
                if (it.on) { let G = null; try { G = talusGeom(it.s); } catch (e) {}
                    if (G && G.toeParts && G.toeParts.length) { const lT = ensureLayer('Limite des talus', '#c084fc', 'dashed', 1.4);   // = pied de talus (entrée en terre), allégé
                        G.toeParts.forEach(pl => { const P = rdpSimplify(pl.map(p => ({ x: p.x, y: p.y })), mmToWorld(20)); if (P.length < 2) return; shapes.push({ type: 'poly', layerId: lT, points: P, open: true, hatch: false, gen: 'cubtalus' }); nt++; }); } }
            });
            saveState(); updateLayerUI(); closeTopoModal(); draw();
            updateCommandMessageText('CUBATURES : limite déblai / remblai (' + nb + ' tronçon(s))' + (nt ? ' et limite des talus (' + nt + ')' : '') + ' tracées.');
        }

