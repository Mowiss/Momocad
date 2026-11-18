        // =====================================================================
        // BALAYAGE 3D : un profil (bordure, caniveau, tuyau, muret, mur en L, forme dessinée) suit un tracé
        // Le tracé (droite, polyligne, arc, cercle) porte s.sweep = { p: préréglage, k: famille, d: dimensions (mm),
        //   al: 'axe'|'gauche'|'droite', inv, ref: 'bas'|'axe'|'haut'|'fe', zs: 'trace'|'terrain'|'fixe', zf (mm), dz (mm), pts (profil dessiné) }
        // =====================================================================
        const SWEEP_PRESETS = [
            ['T1', 'Bordure T1 (12 × 20)', 'bord', { l: 120, h: 200, f: 30 }, 'Bordures'], ['T2', 'Bordure T2 (15 × 25)', 'bord', { l: 150, h: 250, f: 30 }, 'Bordures'],
            ['A2', 'Bordure A2 franchissable (15 × 20)', 'arr', { l: 150, h: 200 }, 'Bordures'], ['P1', 'Bordure P1 (8 × 20)', 'bord', { l: 80, h: 200, f: 0 }, 'Bordures'],
            ['P2', 'Bordure P2 (6 × 28)', 'bord', { l: 60, h: 280, f: 0 }, 'Bordures'],
            ['CS1', 'Caniveau CS1 (20 × 12)', 'can', { l: 200, h: 120, c: 15 }, 'Caniveaux'], ['CS2', 'Caniveau CS2 (25 × 13)', 'can', { l: 250, h: 130, c: 20 }, 'Caniveaux'],
            ['CC1', 'Caniveau CC1 (40 × 12)', 'can', { l: 400, h: 120, c: 25 }, 'Caniveaux'], ['CC2', 'Caniveau CC2 (50 × 14)', 'can', { l: 500, h: 140, c: 30 }, 'Caniveaux'],
            ['PVC110', 'Tuyau PVC Ø110', 'tube', { d: 110, e: 3.2 }, 'Tuyaux et fourreaux'], ['PVC160', 'Tuyau PVC Ø160', 'tube', { d: 160, e: 4.7 }, 'Tuyaux et fourreaux'],
            ['PVC200', 'Tuyau PVC Ø200', 'tube', { d: 200, e: 5.9 }, 'Tuyaux et fourreaux'], ['PVC315', 'Tuyau PVC Ø315', 'tube', { d: 315, e: 9.2 }, 'Tuyaux et fourreaux'],
            ['BET400', 'Tuyau béton DN400', 'tube', { d: 500, e: 50 }, 'Tuyaux et fourreaux'], ['TPC90', 'Fourreau TPC Ø90', 'tube', { d: 90, e: 3 }, 'Tuyaux et fourreaux'],
            ['MURET', 'Muret 20 × 60', 'rect', { l: 200, h: 600 }, 'Murets et murs'], ['LONG', 'Longrine 30 × 40', 'rect', { l: 300, h: 400 }, 'Murets et murs'],
            ['MURL', 'Mur de soutènement en L', 'murL', { B: 1200, es: 250, ev: 200, H: 1500 }, 'Murets et murs'],
            ['B45x145', 'Bois 45 × 145', 'rect', { l: 45, h: 145 }, 'Charpente bois'], ['B63x175', 'Bois 63 × 175', 'rect', { l: 63, h: 175 }, 'Charpente bois'],
            ['B75x225', 'Bois 75 × 225', 'rect', { l: 75, h: 225 }, 'Charpente bois'], ['B63x75', 'Chevron 63 × 75', 'rect', { l: 63, h: 75 }, 'Charpente bois'],
            ['B100x100', 'Poteau bois 100 × 100', 'rect', { l: 100, h: 100 }, 'Charpente bois'], ['B150x150', 'Poteau bois 150 × 150', 'rect', { l: 150, h: 150 }, 'Charpente bois'],
            ['IPE100', 'IPE 100', 'I', { h: 100, b: 55, tw: 4.1, tf: 5.7 }, 'Acier'], ['IPE120', 'IPE 120', 'I', { h: 120, b: 64, tw: 4.4, tf: 6.3 }, 'Acier'],
            ['IPE160', 'IPE 160', 'I', { h: 160, b: 82, tw: 5, tf: 7.4 }, 'Acier'], ['IPE200', 'IPE 200', 'I', { h: 200, b: 100, tw: 5.6, tf: 8.5 }, 'Acier'],
            ['IPE240', 'IPE 240', 'I', { h: 240, b: 120, tw: 6.2, tf: 9.8 }, 'Acier'], ['IPE300', 'IPE 300', 'I', { h: 300, b: 150, tw: 7.1, tf: 10.7 }, 'Acier'],
            ['HEA100', 'HEA 100', 'I', { h: 96, b: 100, tw: 5, tf: 8 }, 'Acier'], ['HEA140', 'HEA 140', 'I', { h: 133, b: 140, tw: 5.5, tf: 8.5 }, 'Acier'],
            ['HEA200', 'HEA 200', 'I', { h: 190, b: 200, tw: 6.5, tf: 10 }, 'Acier'], ['HEA240', 'HEA 240', 'I', { h: 230, b: 240, tw: 7.5, tf: 12 }, 'Acier'],
            ['HEA300', 'HEA 300', 'I', { h: 290, b: 300, tw: 8.5, tf: 14 }, 'Acier'], ['RHS100', 'Tube carré 100 × 100 × 5', 'rhs', { h: 100, b: 100, t: 5 }, 'Acier'],
            ['RHS120x80', 'Tube rectangulaire 120 × 80 × 5', 'rhs', { h: 120, b: 80, t: 5 }, 'Acier'], ['L50', 'Cornière 50 × 50 × 5', 'L', { h: 50, b: 50, t: 5 }, 'Acier'],
            ['L80', 'Cornière 80 × 80 × 8', 'L', { h: 80, b: 80, t: 8 }, 'Acier'],
            ['SF50', 'Semelle filante 50 × 40', 'rect', { l: 500, h: 400 }, 'Fondations'], ['SF60', 'Semelle filante 60 × 40', 'rect', { l: 600, h: 400 }, 'Fondations'], ['LG25', 'Longrine 25 × 40', 'rect', { l: 250, h: 400 }, 'Fondations'],
            ['custom', 'Profil dessiné (forme du plan)', 'custom', {}, 'Profil dessiné']];
        const SWEEP_DIMS = {   // champs de chaque famille : [clé, libellé]
            bord: [['l', 'Largeur'], ['h', 'Hauteur'], ['f', 'Fruit (face chaussée)']], arr: [['l', 'Largeur'], ['h', 'Hauteur']],
            can: [['l', 'Largeur'], ['h', 'Hauteur'], ['c', 'Creux du fil d\'eau']], rect: [['l', 'Largeur'], ['h', 'Hauteur']],
            tube: [['d', 'Ø extérieur'], ['e', 'Épaisseur']], I: [['h', 'Hauteur'], ['b', 'Largeur des ailes'], ['tw', 'Épaisseur de l\'âme'], ['tf', 'Épaisseur des ailes']],
            rhs: [['h', 'Hauteur'], ['b', 'Largeur'], ['t', 'Épaisseur']], L: [['h', 'Aile verticale'], ['b', 'Aile horizontale'], ['t', 'Épaisseur']], murL: [['B', 'Semelle (largeur)'], ['es', 'Semelle (épaisseur)'], ['ev', 'Voile (épaisseur)'], ['H', 'Hauteur totale']], custom: [] };
        const sweepPreset = (id) => SWEEP_PRESETS.find(p => p[0] === id) || SWEEP_PRESETS[1];
        function sweepDefault(id) { const p = sweepPreset(id || 'T2'); return { p: p[0], k: p[2], d: Object.assign({}, p[3]), al: 'axe', inv: false, ref: p[2] === 'tube' ? 'fe' : 'bas', zs: 'auto', zf: 0, dz: 0 }; }
        // profil : boucles en mm (u vers la droite du tracé, v vers le haut) ; la 1re = contour, les suivantes = vides
        function sweepProfile(sw) {
            const d = sw.d || {}, n = (k, def) => (+d[k] > 0 ? +d[k] : def);
            let loops;
            if (sw.k === 'bord') { const l = n('l', 150), h = n('h', 250), f = Math.min(+d.f || 0, l * 0.8); loops = [[[0, 0], [l, 0], [l, h], [f, h], [0, Math.max(0, h - f)]]]; if (!f) loops = [[[0, 0], [l, 0], [l, h], [0, h]]]; }
            else if (sw.k === 'arr') { const l = n('l', 150), h = n('h', 200); loops = [[[0, 0], [l, 0], [l, h], [l * 0.45, h], [0, h * 0.35]]]; }
            else if (sw.k === 'can') { const l = n('l', 400), h = n('h', 120), c = Math.min(+d.c || 0, h * 0.8); loops = [[[0, 0], [l, 0], [l, h], [l / 2, h - c], [0, h]]]; }
            else if (sw.k === 'tube') { const D = n('d', 160), e = Math.min(n('e', 5), D / 2 - 0.5), R = D / 2, r = R - e, N = 32;
                const ring = (rr, cw) => Array.from({ length: N }, (_, i) => { const a = (cw ? -1 : 1) * 2 * Math.PI * i / N; return [R + rr * Math.cos(a), R + rr * Math.sin(a)]; });
                loops = [ring(R, false), ring(r, true)]; }
            else if (sw.k === 'I') { const h = n('h', 200), b = n('b', 100), tw = Math.min(n('tw', 6), b * 0.8), tf = Math.min(n('tf', 9), h / 2.5), c = b / 2;
                loops = [[[0, 0], [b, 0], [b, tf], [c + tw / 2, tf], [c + tw / 2, h - tf], [b, h - tf], [b, h], [0, h], [0, h - tf], [c - tw / 2, h - tf], [c - tw / 2, tf], [0, tf]]]; }
            else if (sw.k === 'rhs') { const h = n('h', 100), b = n('b', 100), t = Math.min(n('t', 5), Math.min(h, b) / 2 - 0.5); loops = [[[0, 0], [b, 0], [b, h], [0, h]], [[t, t], [t, h - t], [b - t, h - t], [b - t, t]]]; }
            else if (sw.k === 'L') { const h = n('h', 50), b = n('b', 50), t = Math.min(n('t', 5), Math.min(h, b) * 0.8); loops = [[[0, 0], [b, 0], [b, t], [t, t], [t, h], [0, h]]]; }
            else if (sw.k === 'murL') { const B = n('B', 1200), es = n('es', 250), ev = n('ev', 200), H = n('H', 1500); loops = [[[0, 0], [B, 0], [B, es], [ev, es], [ev, H], [0, H]]]; }
            else if (sw.k === 'custom' && sw.pts && sw.pts.length >= 3) loops = [sw.pts.map(q => [q[0], q[1]])];
            else { const l = n('l', 200), h = n('h', 200); loops = [[[0, 0], [l, 0], [l, h], [0, h]]]; }
            const area = (L) => L.reduce((a, q, i) => { const r = L[(i + 1) % L.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
            if (area(loops[0]) < 0) loops[0].reverse();
            for (let i = 1; i < loops.length; i++) if (area(loops[i]) > 0) loops[i].reverse();
            const us = loops[0].map(q => q[0]), vs = loops[0].map(q => q[1]);
            const W = Math.max(...us) - Math.min(...us), Ht = Math.max(...vs) - Math.min(...vs);
            if (sw.inv) loops = loops.map(L => L.map(q => [W - q[0] + 2 * Math.min(...us), q[1]]).reverse());
            const A = Math.abs(area(loops[0])) - loops.slice(1).reduce((a, L) => a + Math.abs(area(L)), 0);
            return { loops, W, H: Ht, u0: Math.min(...us), v0: Math.min(...vs), A };   // A en mm²
        }
        // tracé en coordonnées « plan » mm (X vers la droite, Y vers le haut), avec Z si connu
        function sweepPath(s) {
            const T = (x, y, z) => ({ X: worldToMm(x), Y: -worldToMm(y), Z: z });
            if (s.type === 'line') return { pts: [T(s.x1, s.y1, s.z1), T(s.x2, s.y2, s.z2)], closed: false };
            if (s.type === 'poly') return { pts: s.points.map(q => T(q.x, q.y, q.z)), closed: !s.open && s.points.length >= 3 };
            if (s.type === 'circle') return { pts: Array.from({ length: 48 }, (_, i) => T(s.x + s.r * Math.cos(2 * Math.PI * i / 48), s.y + s.r * Math.sin(2 * Math.PI * i / 48), s.z)), closed: true };
            if (s.type === 'arc') { let a0 = s.startAngle, a1 = s.endAngle; if (s.anticlockwise) { const t = a0; a0 = a1; a1 = t; } while (a1 <= a0) a1 += 2 * Math.PI;
                const n = Math.max(6, Math.ceil((a1 - a0) / (Math.PI / 24))); return { pts: Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return T(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), s.z); }), closed: false }; }
            return null;
        }
        // altitudes du tracé selon la source choisie ; le tracé est redécoupé tous les mètres sur le terrain
        function sweepStations(s) {
            const sw = s.sweep, P0 = sweepPath(s); if (!P0 || P0.pts.length < 2) return null;
            let src = sw.zs || 'auto'; const tin = getTIN();
            if (src === 'auto') src = P0.pts.every(q => hasZ(q.Z)) ? 'trace' : tin ? 'terrain' : 'fixe';
            let pts = P0.pts.slice();
            if (src === 'terrain' && tin) { const out = [], L = P0.closed ? pts.concat([pts[0]]) : pts;
                for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1], d = Math.hypot(b.X - a.X, b.Y - a.Y), n = Math.max(1, Math.ceil(d / 1000));
                    for (let j = 0; j < n; j++) out.push({ X: a.X + (b.X - a.X) * j / n, Y: a.Y + (b.Y - a.Y) * j / n }); }
                if (!P0.closed) out.push(L[L.length - 1]);
                pts = out.map(q => { const z = tinZ(mmToWorld(q.X), -mmToWorld(q.Y), tin); return { X: q.X, Y: q.Y, Z: hasZ(z) ? z : NaN }; });
                const known = pts.filter(q => hasZ(q.Z)); const zd = known.length ? known[0].Z : 0; pts.forEach((q, i) => { if (!hasZ(q.Z)) q.Z = i ? pts[i - 1].Z : zd; }); }
            else if (src === 'trace') { const known = pts.filter(q => hasZ(q.Z)), zd = known.length ? known[0].Z : (+sw.zf || 0); pts = pts.map((q, i) => ({ X: q.X, Y: q.Y, Z: hasZ(q.Z) ? q.Z : zd })); }
            else pts = pts.map(q => ({ X: q.X, Y: q.Y, Z: +sw.zf || 0 }));
            // sommets en double retirés
            const clean = []; pts.forEach(q => { const l = clean[clean.length - 1]; if (!l || Math.hypot(q.X - l.X, q.Y - l.Y) > 1) clean.push(q); });
            if (P0.closed && clean.length > 2 && Math.hypot(clean[0].X - clean[clean.length - 1].X, clean[0].Y - clean[clean.length - 1].Y) <= 1) clean.pop();
            return { pts: clean, closed: P0.closed, src };
        }
        // géométrie complète : anneaux du profil à chaque station (mm, repère plan), décalages du tracé
        function sweepGeom(s) {
            if (!s.sweep) return null;
            const st = sweepStations(s); if (!st || st.pts.length < 2) return null;
            const sw = s.sweep, pr = sweepProfile(sw), pts = st.pts, N = pts.length, cl = st.closed;
            const uOff = sw.al === 'gauche' ? -pr.u0 : sw.al === 'droite' ? -(pr.u0 + pr.W) : -(pr.u0 + pr.W / 2);
            const tube = sw.k === 'tube', e = tube ? Math.min(+(sw.d || {}).e || 0, pr.H / 2) : 0;
            const vOff = (sw.ref === 'haut' ? -(pr.v0 + pr.H) : sw.ref === 'axe' ? -(pr.v0 + pr.H / 2) : sw.ref === 'fe' && tube ? -(pr.v0 + e) : -pr.v0) + (+sw.dz || 0);
            const dirs = []; for (let i = 0; i < (cl ? N : N - 1); i++) { const a = pts[i], b = pts[(i + 1) % N], L = Math.hypot(b.X - a.X, b.Y - a.Y) || 1; dirs.push({ x: (b.X - a.X) / L, y: (b.Y - a.Y) / L }); }
            const frames = pts.map((q, i) => {
                const d0 = cl ? dirs[(i - 1 + N) % N] : dirs[Math.max(0, i - 1)], d1 = cl ? dirs[i % N] : dirs[Math.min(dirs.length - 1, i)];
                let tx = d0.x + d1.x, ty = d0.y + d1.y; const tl = Math.hypot(tx, ty); if (tl < 1e-6) { tx = d1.x; ty = d1.y; } else { tx /= tl; ty /= tl; }
                const nx = ty, ny = -tx;   // côté droit du tracé (bissectrice), allongée dans les angles pour garder la largeur
                const m = 1 / Math.max(0.25, nx * d1.y - ny * d1.x);
                return { nx, ny, m };
            });
            // poutre : section perpendiculaire au tracé (le profil suit la pente) ; sinon profil vertical
            if (sw.perp) frames.forEach((f, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], c0 = cl ? pts[(i - 1 + N) % N] : a, c1 = cl ? pts[(i + 1) % N] : b;
                let tx = c1.X - c0.X, ty = c1.Y - c0.Y, tz = c1.Z - c0.Z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
                // binormale « vers le haut » : perpendiculaire à la tangente et à la normale horizontale
                f.bx = f.ny * tz - 0 * ty; f.by = 0 * tx - f.nx * tz; f.bz = f.nx * ty - f.ny * tx; const bl = Math.hypot(f.bx, f.by, f.bz) || 1; f.bx /= bl; f.by /= bl; f.bz /= bl; if (f.bz < 0) { f.bx = -f.bx; f.by = -f.by; f.bz = -f.bz; } });
            const ring = (i, L) => { const q = pts[i], f = frames[i]; return L.map(([u, v]) => { const w = (u + uOff) * f.m;
                if (sw.perp) { const vv = v + vOff; return { X: q.X + f.nx * w + f.bx * vv, Y: q.Y + f.ny * w + f.by * vv, Z: q.Z + f.bz * vv }; }
                return { X: q.X + f.nx * w, Y: q.Y + f.ny * w, Z: q.Z + v + vOff }; }); };
            const rings = pts.map((_, i) => pr.loops.map(L => ring(i, L)));
            let len = 0; for (let i = 0; i < (cl ? N : N - 1); i++) { const a = pts[i], b = pts[(i + 1) % N]; len += Math.hypot(b.X - a.X, b.Y - a.Y, (b.Z - a.Z)); }
            // emprise en plan : bords extrêmes du profil
            const uMin = pr.u0 + uOff, uMax = pr.u0 + pr.W + uOff;
            const edge = (u) => pts.map((q, i) => ({ X: q.X + frames[i].nx * u * frames[i].m, Y: q.Y + frames[i].ny * u * frames[i].m }));
            return { pr, pts, closed: cl, rings, len, vol: pr.A / 1e6 * len / 1000, src: st.src, left: edge(uMin), right: edge(uMax) };
        }
        const SWEEP_CACHE = new WeakMap();
        function sweepGeomCached(s) {
            const key = JSON.stringify(s.sweep) + '|' + JSON.stringify(sweepPath(s)), tin = (s.sweep && s.sweep.zs !== 'fixe' && s.sweep.zs !== 'trace') ? getTIN() : null;
            const c = SWEEP_CACHE.get(s); if (c && c.key === key && c.tin === tin) return c.g;
            let g = null; try { g = sweepGeom(s); } catch (e) { console.error(e); }
            SWEEP_CACHE.set(s, { key, tin, g }); return g;
        }
        // vue en plan : emprise du profil (bords + bouts), légèrement teintée
        function drawSweep2D(ctx, s, col, dx, dy, ls) {
            const G = sweepGeomCached(s); if (!G) return;
            const W = (q) => [mmToWorld(q.X) + dx, -mmToWorld(q.Y) + dy];
            ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = 0.9 / ls;
            const outline = G.closed ? null : G.left.concat(G.right.slice().reverse());
            ctx.beginPath();
            if (outline) { outline.forEach((q, i) => { const p = W(q); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
            else [G.left, G.right].forEach(L => { L.forEach((q, i) => { const p = W(q); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); });
            ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fill('evenodd'); ctx.globalAlpha = 1; ctx.stroke();
            ctx.restore();
        }
        // vue 3D : parois de chaque boucle du profil + bouchons aux extrémités
        function sweepMesh3D(s, P, Zm) {
            const G = sweepGeomCached(s); if (!G) return null;
            const pos = [], N = G.rings.length, nl = G.pr.loops.length;
            const V = (q) => { const r = P(mmToWorld(q.X), -mmToWorld(q.Y)); return [r.x, r.y, Zm(q.Z)]; };
            const tri = (a, b, c) => { pos.push(...V(a), ...V(b), ...V(c)); };
            for (let l = 0; l < nl; l++) {
                const M = G.rings[0][l].length;
                for (let i = 0; i < (G.closed ? N : N - 1); i++) { const A = G.rings[i][l], B = G.rings[(i + 1) % N][l];
                    for (let k = 0; k < M; k++) { const k2 = (k + 1) % M; tri(A[k], A[k2], B[k2]); tri(A[k], B[k2], B[k]); } }
            }
            if (!G.closed) {
                const outer = G.pr.loops[0].map(q => new THREE.Vector2(q[0], q[1])), holes = G.pr.loops.slice(1).map(L => L.map(q => new THREE.Vector2(q[0], q[1])));
                const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
                [0, N - 1].forEach((i, e) => { const flat = [].concat(...G.rings[i]); faces.forEach(f => { if (e) tri(flat[f[0]], flat[f[1]], flat[f[2]]); else tri(flat[f[2]], flat[f[1]], flat[f[0]]); }); });
            }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
            return g;
        }
        // métré du balayage
        function sweepInfo(s) { const G = sweepGeomCached(s); return G ? { A: G.pr.A / 1e6, len: G.len / 1000, vol: G.vol, src: G.src, W: G.pr.W, H: G.pr.H } : null; }
        const SWEEP_SRC = { trace: 'altitudes du tracé', terrain: 'sur le terrain', fixe: 'altitude fixe' };
        const isSweepPath = (x) => !x.solid && !x.gen && !x.wall && !x.wallMat && !x.brush && ['line', 'poly', 'arc', 'circle'].includes(x.type) && !isPlateforme(x);
        function sweepShapes(list) {
            const ok = list.filter(x => isSweepPath(x) || x.sweep);
            ok.forEach(x => { if (!x.sweep) x.sweep = Object.assign(sweepDefault(lastSweepPreset), lastSweepPlace || {}); });
            return ok;
        }
        let lastSweepPreset = 'T2', lastSweepPlace = null, sweepPickFor = null, lastBeamPreset = 'B63x175';
        function startSweep() {
            const ok = sweepShapes(selectedShapes.filter(x => !x.sweep));
            if (ok.length) { saveState(); selectedShapes = ok; draw(); if (ok.length === 1) setTimeout(openSelectionParamModal, 30); updateCommandMessageText('BALAYAGE : ' + ok.length + ' tracé(s) habillé(s) du profil ' + sweepPreset(lastSweepPreset)[1] + ' — réglez le profil avec Y.'); return; }
            setMode('sweep');
        }
        // ---- fenêtre Y : chapitre « Balayage 3D » ----
        let sweepEdit = null;
        function sweepRows() {
            const sw = sweepEdit, E = MF.esc, groups = [...new Set(SWEEP_PRESETS.map(p => p[4]))];
            const sel = `<select id="sw-p" class="mf-in mf-sel" style="width:100%;" onchange="sweepSet('p',this.value)">${groups.map(g => `<optgroup label="${E(g)}">${SWEEP_PRESETS.filter(p => p[4] === g).map(p => `<option value="${p[0]}"${p[0] === sw.p ? ' selected' : ''}>${E(p[1])}</option>`).join('')}</optgroup>`).join('')}</select>`;
            let h = `<div style="margin-bottom:4px;">${sel}</div>`;
            (SWEEP_DIMS[sw.k] || []).forEach(([k, lb]) => { h += MF.row(lb, MF.num('sw-d-' + k, String((sw.d || {})[k] ?? '').replace('.', ','), '', `oninput="sweepSet('d.${k}',this.value,true)"`), 'mm'); });
            if (sw.k === 'custom') h += `<div class="mf-row"><span class="mf-l">${sw.pts && sw.pts.length ? sw.pts.length + ' sommets' : 'Aucune forme choisie'}</span><span class="mf-c"><button type="button" class="mf-btn" onclick="sweepPickProfile()">Choisir la forme…</button></span></div>` + MF.hint('Dessinez la section en vraie grandeur (polyligne fermée, cercle), n\'importe où sur le plan : sa largeur va vers la droite du tracé, sa hauteur vers le haut.');
            h += MF.sub('Position sur le tracé');
            h += MF.seg('sw-al', [['gauche', 'Tracé à gauche'], ['axe', 'Tracé dans l\'axe'], ['droite', 'Tracé à droite']], sw.al || 'axe', "sweepSet('al',this.value)");
            h += `<label class="mf-ck" style="margin-top:4px;"><input type="checkbox" ${sw.inv ? 'checked' : ''} onchange="sweepSet('inv',this.checked)"><span>Retourner le profil (changer de côté)</span></label>`;
            h += `<label class="mf-ck"><input type="checkbox" ${sw.perp ? 'checked' : ''} onchange="sweepSet('perp',this.checked)"><span>Section perpendiculaire au tracé (poutre, chevron, rampe)</span></label>`;
            h += MF.sub('Altitude');
            h += MF.row('Le tracé donne', MF.sel('sw-ref', [['bas', 'le dessous'], ['axe', 'l\'axe'], ['haut', 'le dessus']].concat(sw.k === 'tube' ? [['fe', 'le fil d\'eau']] : []), sw.ref || 'bas', `onchange="sweepSet('ref',this.value)"`), '');
            h += MF.row('Altitude prise', MF.sel('sw-zs', [['auto', 'automatique'], ['trace', 'Z du tracé'], ['terrain', 'sur le terrain'], ['fixe', 'fixe']], sw.zs || 'auto', `onchange="sweepSet('zs',this.value)"`), '');
            if (sw.zs === 'fixe') h += MF.row('Altitude fixe', MF.num('sw-zf', hasZ(sw.zf) ? fmtZ(sw.zf) : '', '', `oninput="sweepSet('zf',this.value,true,1000)"`), 'm');
            h += MF.row('Décalage vertical', MF.num('sw-dz', lenTxt(+sw.dz || 0), '0', `oninput="sweepSet('dz',this.value,true,lenF())"`), LUN());
            h += `<div id="sw-info" class="mf-hint" style="margin-top:6px;">${sweepInfoHTML()}</div>`;
            return h;
        }
        function sweepInfoHTML() {
            const one = selectedShapes[0]; if (!one || !sweepEdit) return '';
            const t = Object.assign({}, one, { sweep: sweepEdit }), I = (() => { try { const G = sweepGeom(t); return G ? { A: G.pr.A / 1e6, len: G.len / 1000, vol: G.vol, src: G.src } : null; } catch (e) { return null; } })();
            if (!I) return 'Profil incomplet.';
            return `Section <b class="text-white">${nfr(I.A, 4)} m²</b> · longueur <b class="text-white">${nfr(I.len, 2)} m</b> · volume <b class="text-white">${nfr(I.vol, 3)} m³</b><br>Altitude : ${SWEEP_SRC[I.src] || I.src}.`;
        }
        function sweepSet(k, v, soft, mul) {
            const sw = sweepEdit; if (!sw) return;
            if (k === 'p') { const p = sweepPreset(v); sw.p = p[0]; sw.k = p[2]; sw.d = Object.assign({}, p[3]); if (sw.k === 'tube' && sw.ref === 'bas') sw.ref = 'fe'; if (sw.k !== 'tube' && sw.ref === 'fe') sw.ref = 'bas'; if (sw.k === 'custom' && !(sw.pts && sw.pts.length)) { sweepRerender(); sweepPickProfile(); return; } }
            else if (k.startsWith('d.')) { const n = parseFloat(String(v).replace(',', '.')); if (isFinite(n) && n >= 0) sw.d[k.slice(2)] = n; }
            else if (k === 'zf' || k === 'dz') { const n = parseFloat(String(v).replace(',', '.')); sw[k] = isFinite(n) ? n * (mul || 1) : 0; }
            else sw[k] = v;
            if (soft) { const i = document.getElementById('sw-info'); if (i) i.innerHTML = sweepInfoHTML(); } else sweepRerender();
        }
        function sweepRemove() { const one = selectedShapes[0]; if (!one) return; delete one.sweep; sweepEdit = null; closeSelectionParamModal(); saveState(); draw(); updateCommandMessageText('BALAYAGE retiré : le tracé redevient un simple trait.'); }
        function sweepRerender() { const b = document.getElementById('sw-box'); if (b) b.innerHTML = sweepRows(); }
        function sweepSum(o) { const sw = o.sweep; if (!sw) return 'aucun'; const I = sweepInfo(o); return sweepPreset(sw.p)[1].replace(/\s*\(.*\)$/, '') + (I ? ' · ' + nfr(I.vol, 2) + ' m³' : ''); }
        function sweepPickProfile() {
            const one = selectedShapes[0]; if (!one) return;
            one.sweep = Object.assign({}, sweepEdit, { p: 'custom', k: 'custom' }); sweepPickFor = one; sweepEdit = null;
            closeSelectionParamModal(); setMode('sweeppick'); sweepPickFor = one; draw();
        }
        function sweepUseProfile(t) {
            const ring = t.type === 'circle' ? pierceRing(t) : t.points; if (!ring || ring.length < 3 || !sweepPickFor) return false;
            const P = ring.map(q => [worldToMm(q.x), -worldToMm(q.y)]), mx = Math.min(...P.map(q => q[0])), my = Math.min(...P.map(q => q[1]));
            const tgt = sweepPickFor; tgt.sweep.pts = P.map(q => [Math.round((q[0] - mx) * 10) / 10, Math.round((q[1] - my) * 10) / 10]); tgt.sweep.k = 'custom'; tgt.sweep.p = 'custom';
            sweepPickFor = null; saveState(); setMode('select-box'); selectedShapes = [tgt]; draw(); setTimeout(openSelectionParamModal, 30);
            updateCommandMessageText('BALAYAGE : profil dessiné repris (' + tgt.sweep.pts.length + ' sommets, ' + nfr((Math.max(...tgt.sweep.pts.map(q => q[0]))) / 1000, 2) + ' × ' + nfr((Math.max(...tgt.sweep.pts.map(q => q[1]))) / 1000, 2) + ' m).');
            return true;
        }
        // DXF : réglages du balayage gardés en XDATA (relus à l'ouverture)
        function sweepToXD(s) { const sw = Object.assign({}, s.sweep), pts = sw.pts || []; delete sw.pts; const out = ['balayage', 'bal=' + JSON.stringify(sw)];
            const t = pts.map(q => q[0] + ',' + q[1]).join(';'); for (let i = 0; i < t.length; i += 240) out.push('balpts=' + t.slice(i, i + 240)); return out; }
        function sweepFromXD(sh, xd) {
            if (!xd) return; const L = [].concat(xd).map(String); const j = L.find(v => v.startsWith('bal=')); if (!j) return;
            try { const sw = JSON.parse(j.slice(4)); const pts = L.filter(v => v.startsWith('balpts=')).map(v => v.slice(7)).join('');
                if (pts) sw.pts = pts.split(';').map(q => q.split(',').map(Number)).filter(q => q.length === 2 && q.every(isFinite));
                sh.sweep = Object.assign(sweepDefault(sw.p), sw); delete sh.elev; } catch (e) {}
        }
        // =====================================================================
        // GÉOMÉTRIE 3D COMMUNE : un objet 3D -> BufferGeometry (repère P / Zm de la scène)
        // utilisée par la vue 3D et les booléens
        // =====================================================================
        const is3DObj = (x) => !!(x && (x.solid || x.sweep || (x.type === 'mesh' && meshStore[x.meshId]) || (x.type === 'hatch' && x.wallMat && x.wz && hasZ(x.wz.b) && hasZ(x.wz.t) && x.wz.t > x.wz.b && x.loops && x.loops[0] && x.loops[0].length >= 3)));
        // arêtes « fantômes » des volumes percés (murs avec ouvertures, booléens) : le découpage laisse des sommets en T,
        // et des segments au milieu de faces planes ressortent comme des arêtes. On retire celles qui ont, de part et d'autre, des faces du même plan.
        // arêtes d'un mur : celles du mur plein, moins ce qui traverse les ouvertures, plus le tour de chaque ouverture
        function wallEdges3D(so, P, Zm, exag) {
            try {
                const pts = so.loops[0].map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); });
                const full = new THREE.EdgesGeometry(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: Math.max((so.wz.t - so.wz.b) / 1000 * exag, 1e-3), bevelEnabled: false }).translate(0, 0, Zm(so.wz.b)), 30);
                const ops = wallOpeningsFor(so).map(o => ({ g: openingGeom(o, P, Zm, exag, so) })).filter(x => x.g);
                ops.forEach(x => { x.g.computeBoundingBox(); x.bb = x.g.boundingBox; x.poly = x.g; });
                const out = [], A = full.attributes.position.array;
                // un segment du mur plein est gardé, sauf la partie qui passe dans une ouverture (porte au ras du sol)
                for (let i = 0; i < A.length; i += 6) {
                    const a = new THREE.Vector3(A[i], A[i + 1], A[i + 2]), b = new THREE.Vector3(A[i + 3], A[i + 4], A[i + 5]);
                    let cuts = [[0, 1]];
                    ops.forEach(x => { const bb = x.bb.clone().expandByScalar(1e-4); const keep = [];
                        cuts.forEach(([t0, t1]) => { const n = 24; let cur = null; for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n, q = a.clone().lerp(b, t), inside = bb.containsPoint(q) && q.z > bb.min.z + 1e-3 && q.z < bb.max.z - 1e-3 && bb.containsPoint(q);
                            if (!inside && cur === null) cur = t; if ((inside || k === n) && cur !== null) { keep.push([cur, inside ? t : t]); cur = null; } } });
                        cuts = keep.filter(([u, v]) => v - u > 1e-3); });
                    cuts.forEach(([u, v]) => { const p = a.clone().lerp(b, u), q = a.clone().lerp(b, v); out.push(p.x, p.y, p.z, q.x, q.y, q.z); });
                }
                ops.forEach(x => { const e = new THREE.EdgesGeometry(x.g, 30).attributes.position.array; for (let i = 0; i < e.length; i++) out.push(e[i]); });
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); return g;
            } catch (e) { return null; }
        }
        // menuiserie d'une ouverture : cadre 6 cm, vitrage (fenêtre) ou vantail bois (porte), au milieu de l'épaisseur du mur
        function joinery3D(root, w, o, P, Zm, exag) {
            const Q = o.pts.map(q => P(q.x, q.y)), A = P(o.a.x, o.a.y), B = P(o.b.x, o.b.y), L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-6) return;
            const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
            const su = Q.map(q => (q.x - A.x) * u.x + (q.y - A.y) * u.y), sn = Q.map(q => (q.x - A.x) * n.x + (q.y - A.y) * n.y);
            const s0 = Math.min(...su), s1 = Math.max(...su), tm = (Math.min(...sn) + Math.max(...sn)) / 2, z0 = Zm(w.wz.b + (o.sill || 0)), z1 = z0 + Math.max(10, o.h || 1000) / 1000 * exag;
            const f = Math.min(0.06, (s1 - s0) / 6), door = o.kind === 'porte', ang = Math.atan2(u.y, u.x);
            const box = (a0, a1, b0, b1, d, mat) => { if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4) return; const g = new THREE.BoxGeometry(a1 - a0, d, b1 - b0), m = new THREE.Mesh(g, mat);
                const sc = (a0 + a1) / 2; m.position.set(A.x + u.x * sc + n.x * tm, A.y + u.y * sc + n.y * tm, (b0 + b1) / 2); m.rotation.z = ang; m.userData.opening = o; root.add(m); };
            const frame = new THREE.MeshLambertMaterial({ color: door ? 0x8b5a2b : 0xf3f4f6 });
            box(s0, s0 + f, z0, z1, 0.07, frame); box(s1 - f, s1, z0, z1, 0.07, frame); box(s0, s1, z1 - f, z1, 0.07, frame);
            if (door) { const tm2 = texMaterial('bois') || new THREE.MeshLambertMaterial({ color: 0xa0522d }), a0 = s0 + f, a1 = s1 - f;   // vantail sur ses gonds : il s'ouvre dans la vue Momo
                if (a1 - a0 > 1e-4 && z1 - f - z0 > 1e-4) { const pv = new THREE.Group(); pv.position.set(A.x + u.x * a0 + n.x * tm, A.y + u.y * a0 + n.y * tm, 0); pv.rotation.z = ang; pv.userData.door = { a0: ang, open: false, to: ang };
                    const m = new THREE.Mesh(new THREE.BoxGeometry(a1 - a0, 0.04, z1 - f - z0), tm2); m.position.set((a1 - a0) / 2, 0, (z0 + z1 - f) / 2); m.userData.opening = o; m.userData.leaf = o; pv.add(m); root.add(pv); } }
            else { box(s0, s1, z0, z0 + f, 0.07, frame); box(s0 + f, s1 - f, z0 + f, z1 - f, 0.012, new THREE.MeshLambertMaterial({ color: 0x9ccbf0, transparent: true, opacity: 0.38, depthWrite: false }));
                box((s0 + s1) / 2 - f / 3, (s0 + s1) / 2 + f / 3, z0 + f, z1 - f, 0.05, frame); }   // meneau : deux vantaux
            if (o.shut && o.shut.type) {   // volets sur la face extérieure : battants ouverts contre la façade, ou volet roulant à demi-relevé dans ses coulisses
                const es = o.shut.side === -1 ? (sn[0] + sn[1]) / 2 : (sn[2] + sn[3]) / 2, dir = Math.sign(es - tm) || 1;
                const box2 = (a0, a1, b0, b1, d, nc, mat) => { if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4) return; const m = new THREE.Mesh(new THREE.BoxGeometry(a1 - a0, d, b1 - b0), mat), sc = (a0 + a1) / 2; m.position.set(A.x + u.x * sc + n.x * nc, A.y + u.y * sc + n.y * nc, (b0 + b1) / 2); m.rotation.z = ang; m.userData.shutter = o.shut.type; root.add(m); };
                const w2 = (s1 - s0) / 2;
                if (o.shut.type === 'battant') { const vm = new THREE.MeshLambertMaterial({ color: 0x5f7f6e }); box2(s0 - w2, s0 - 0.005, z0, z1, 0.035, es + dir * 0.03, vm); box2(s1 + 0.005, s1 + w2, z0, z1, 0.035, es + dir * 0.03, vm); }
                else { const rail = new THREE.MeshLambertMaterial({ color: 0x9ca3af }), sl = texMaterial('alu') || new THREE.MeshLambertMaterial({ color: 0xd1d5db }), nc = es - dir * 0.05, zl = z1 - (z1 - z0) * 0.3;
                    box2(s0, s0 + 0.04, z0, z1, 0.05, nc, rail); box2(s1 - 0.04, s1, z0, z1, 0.05, nc, rail); box2(s0 + 0.04, s1 - 0.04, zl, z1, 0.015, nc, sl); box2(s0 + 0.04, s1 - 0.04, zl - 0.03, zl, 0.03, nc, rail); }
            }
        }
        function flatEdgesClean(g, eg) {
            try {
                const P = g.attributes.position.array, I = g.index ? g.index.array : null, nT = (I ? I.length : P.length / 3) / 3; if (nT > 6000) return eg;
                const V = (k) => { const i = I ? I[k] : k; return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; }, T = [];
                for (let t = 0; t < nT; t++) { const a = V(t * 3), b = V(t * 3 + 1), c = V(t * 3 + 2), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
                    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n); if (l < 1e-12) continue; n = n.map(x => x / l);
                    T.push({ a, b, c, n, g: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], lo: [0, 1, 2].map(j => Math.min(a[j], b[j], c[j]) - 1e-4), hi: [0, 1, 2].map(j => Math.max(a[j], b[j], c[j]) + 1e-4) }); }
                const E = eg.attributes.position.array, keep = [], eps = 1e-4;
                const inTri = (t, m) => { const v0 = [t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]], v1 = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]], v2 = [m[0] - t.a[0], m[1] - t.a[1], m[2] - t.a[2]], d = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
                    const d00 = d(v0, v0), d01 = d(v0, v1), d02 = d(v0, v2), d11 = d(v1, v1), d12 = d(v1, v2), den = d00 * d11 - d01 * d01; if (Math.abs(den) < 1e-18) return false;
                    const uu = (d11 * d02 - d01 * d12) / den, vv = (d00 * d12 - d01 * d02) / den; return uu >= -1e-5 && vv >= -1e-5 && uu + vv <= 1 + 1e-5; };
                for (let i = 0; i < E.length; i += 6) {
                    const A = [E[i], E[i + 1], E[i + 2]], B = [E[i + 3], E[i + 4], E[i + 5]], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], dl = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1, d = [(B[0] - A[0]) / dl, (B[1] - A[1]) / dl, (B[2] - A[2]) / dl];
                    let n0 = null, flat = true, pos = false, neg = false;
                    for (const t of T) { if (m[0] < t.lo[0] || m[0] > t.hi[0] || m[1] < t.lo[1] || m[1] > t.hi[1] || m[2] < t.lo[2] || m[2] > t.hi[2]) continue;
                        if (Math.abs(t.n[0] * (m[0] - t.a[0]) + t.n[1] * (m[1] - t.a[1]) + t.n[2] * (m[2] - t.a[2])) > eps || !inTri(t, m)) continue;
                        if (!n0) n0 = t.n; else if (Math.abs(n0[0] * t.n[0] + n0[1] * t.n[1] + n0[2] * t.n[2]) < 0.9999) { flat = false; break; }
                        const s = [t.n[1] * d[2] - t.n[2] * d[1], t.n[2] * d[0] - t.n[0] * d[2], t.n[0] * d[1] - t.n[1] * d[0]], sd = s[0] * (t.g[0] - m[0]) + s[1] * (t.g[1] - m[1]) + s[2] * (t.g[2] - m[2]);
                        if (sd > 1e-7) pos = true; else if (sd < -1e-7) neg = true; }
                    if (flat && pos && neg) continue;   // segment posé au milieu d'une face plane : on l'enlève
                    keep.push(...A, ...B);
                }
                const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); return out;
            } catch (e) { return eg; }
        }
        function objGeom3D(so, P, Zm, exag, ext) {
            ext = ext || (() => {});
            if (so.solid) {
                const k = so.solid.kind, z0 = Zm(solidBaseZ(so)), Hm = (so.solid.H || 0) / 1000 * exag;
                let g = null;
                const holePaths = holesOf(so).map(h => new THREE.Path(h.map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); })));
                if (['tube', 'tcone', 'pyr', 'torus', 'rev', 'roof'].includes(k)) { const m = solidMesh3D(so, P, z0, Hm, exag, new THREE.MeshBasicMaterial(), ext); g = m ? m.geometry : null; }
                else if (k === 'box' || (k === 'cyl' && holePaths.length)) { const shp = new THREE.Shape((k === 'cyl' ? pierceRing(so) : so.points).map(q => { const r = P(q.x, q.y); ext(r); return new THREE.Vector2(r.x, r.y); })); holePaths.forEach(hp => shp.holes.push(hp));
                    g = new THREE.ExtrudeGeometry(shp, { depth: Math.max(Hm, 1e-3), bevelEnabled: false }); g.translate(0, 0, z0); }
                else { const c = P(so.x, so.y), r = worldToMm(so.r) / 1000; ext({ x: c.x - r, y: c.y - r }); ext({ x: c.x + r, y: c.y + r });
                    if (k === 'sphere') { g = new THREE.SphereGeometry(r, 40, 24); g.scale(1, 1, exag); g.translate(c.x, c.y, z0 + r * exag); }
                    else { g = new THREE.CylinderGeometry(k === 'cone' ? 0 : r, r, Math.max(Hm, 1e-3), 48); g.rotateX(Math.PI / 2); g.translate(c.x, c.y, z0 + Hm / 2); } }
                if (g) tiltGeom3D(g, so, P, Zm);
                return g;
            }
            if (so.sweep) { const g = sweepMesh3D(so, P, Zm); if (g) { g.computeBoundingBox(); const bb = g.boundingBox; ext({ x: bb.min.x, y: bb.min.y }); ext({ x: bb.max.x, y: bb.max.y }); } return g; }
            if (so.type === 'mesh') {
                const v = meshStore[so.meshId]; if (!v) return null; const pos = new Float32Array(v.length), k = so.sc || 1;
                for (let i = 0; i < v.length; i += 3) { const w = meshWorld(so, v[i], v[i + 1]), q = P(w.x, w.y); pos[i] = q.x; pos[i + 1] = q.y; pos[i + 2] = Zm(so.z0 + v[i + 2] * k); }
                meshCorners(so).forEach(c => ext(P(c.x, c.y)));
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
            }
            if (so.type === 'hatch' && so.wallMat && so.wz) {
                const pts = so.loops[0].map(q => { const r = P(q.x, q.y); ext(r); return new THREE.Vector2(r.x, r.y); });
                let g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: Math.max((so.wz.t - so.wz.b) / 1000 * exag, 1e-3), bevelEnabled: false }); g.translate(0, 0, Zm(so.wz.b));
                const ops = wallOpeningsFor(so);
                if (ops.length) { try { const cut = ops.map(o => openingGeom(o, P, Zm, exag, so)).filter(Boolean); if (cut.length) g = csgGeom(g, cut, 'sub'); } catch (e) { console.error(e); } }
                return g;
            }
            return null;
        }
        // triangles d'une géométrie en tableau plat de sommets
        function geomTris(g) {
            const pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, out = new Float64Array(n * 3);
            for (let i = 0; i < n; i++) { const a = idx ? idx.getX(i) : i; out[i * 3] = pos.getX(a); out[i * 3 + 1] = pos.getY(a); out[i * 3 + 2] = pos.getZ(a); }
            return out;
        }
        // repère « réel » en mètres (sans aberration) : x est, y nord, z altitude
        const P_M = (wx, wy) => ({ x: worldToMm(wx) / 1000, y: -worldToMm(wy) / 1000 }), Z_M = (z) => (hasZ(z) ? z : 0) / 1000;
        // triangles d'un objet en mm, orientés vers l'extérieur
        function objTrisMM(s) {
            const g = objGeom3D(s, P_M, Z_M, 1); if (!g) return null;
            const t = geomTris(g); for (let i = 0; i < t.length; i++) t[i] *= 1000;
            if (signedVol(t) < 0) flipTris(t);
            return t;
        }
        function signedVol(t) { let v = 0; for (let i = 0; i < t.length; i += 9) { const ax = t[i], ay = t[i + 1], az = t[i + 2], bx = t[i + 3], by = t[i + 4], bz = t[i + 5], cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
            v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx); } return v / 6; }
        function flipTris(t) { for (let i = 0; i < t.length; i += 9) for (let k = 0; k < 3; k++) { const a = t[i + 3 + k]; t[i + 3 + k] = t[i + 6 + k]; t[i + 6 + k] = a; } }
