        // =====================================================================
        // CSG (opérations booléennes) : arbre BSP sur polygones convexes (d'après csg.js d'Evan Wallace, licence MIT)
        // =====================================================================
        const CSG = (() => {
            const EPS = 1e-4;
            const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
            const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            class Plane {
                constructor(n, w) { this.n = n; this.w = w; }
                static from(a, b, c) { const n = cross(sub(b, a), sub(c, a)), l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-12) return null; const u = [n[0] / l, n[1] / l, n[2] / l]; return new Plane(u, dot(u, a)); }
                flip() { this.n = [-this.n[0], -this.n[1], -this.n[2]]; this.w = -this.w; }
                clone() { return new Plane(this.n.slice(), this.w); }
                split(poly, cf, cb, f, b) {
                    const COP = 0, FR = 1, BK = 2, SP = 3; let pt = 0; const types = [];
                    for (const v of poly.v) { const t = dot(this.n, v) - this.w, ty = t < -EPS ? BK : t > EPS ? FR : COP; pt |= ty; types.push(ty); }
                    if (pt === COP) (dot(this.n, poly.p.n) > 0 ? cf : cb).push(poly);
                    else if (pt === FR) f.push(poly); else if (pt === BK) b.push(poly);
                    else { const fv = [], bv = [];
                        for (let i = 0; i < poly.v.length; i++) { const j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j];
                            if (ti !== BK) fv.push(vi); if (ti !== FR) bv.push(vi);
                            if ((ti | tj) === SP) { const t = (this.w - dot(this.n, vi)) / dot(this.n, sub(vj, vi)), v = lerp(vi, vj, t); fv.push(v); bv.push(v); } }
                        if (fv.length >= 3) f.push(new Poly(fv, poly.p.clone())); if (bv.length >= 3) b.push(new Poly(bv, poly.p.clone())); }
                }
            }
            class Poly { constructor(v, p) { this.v = v; this.p = p || Plane.from(v[0], v[1], v[2]); } clone() { return new Poly(this.v.map(x => x.slice()), this.p.clone()); } flip() { this.v.reverse(); this.p.flip(); } }
            class Node {
                constructor(polys) { this.plane = null; this.front = null; this.back = null; this.polys = []; if (polys) this.build(polys); }
                clone() { const n = new Node(); n.plane = this.plane && this.plane.clone(); n.front = this.front && this.front.clone(); n.back = this.back && this.back.clone(); n.polys = this.polys.map(p => p.clone()); return n; }
                invert() { const st = [this]; while (st.length) { const n = st.pop(); n.polys.forEach(p => p.flip()); if (n.plane) n.plane.flip(); const t = n.front; n.front = n.back; n.back = t; if (n.front) st.push(n.front); if (n.back) st.push(n.back); } }
                clipPolys(polys) {
                    if (!this.plane) return polys.slice();
                    let f = [], b = []; for (const p of polys) this.plane.split(p, f, b, f, b);
                    if (this.front) f = this.front.clipPolys(f); b = this.back ? this.back.clipPolys(b) : [];
                    return f.concat(b);
                }
                clipTo(bsp) { const st = [this]; while (st.length) { const n = st.pop(); n.polys = bsp.clipPolys(n.polys); if (n.front) st.push(n.front); if (n.back) st.push(n.back); } }
                all() { const out = [], st = [this]; while (st.length) { const n = st.pop(); out.push(...n.polys); if (n.front) st.push(n.front); if (n.back) st.push(n.back); } return out; }
                build(polys) {
                    const st = [[this, polys]];
                    while (st.length) { const [n, ps] = st.pop(); if (!ps.length) continue;
                        if (!n.plane) n.plane = ps[0].p.clone();
                        const f = [], b = []; for (const p of ps) n.plane.split(p, n.polys, n.polys, f, b);
                        if (f.length) { if (!n.front) n.front = new Node(); st.push([n.front, f]); }
                        if (b.length) { if (!n.back) n.back = new Node(); st.push([n.back, b]); } }
                }
            }
            const fromTris = (t) => { const out = []; for (let i = 0; i < t.length; i += 9) { const v = [[t[i], t[i + 1], t[i + 2]], [t[i + 3], t[i + 4], t[i + 5]], [t[i + 6], t[i + 7], t[i + 8]]]; const p = Plane.from(v[0], v[1], v[2]); if (p) out.push(new Poly(v, p)); } return out; };
            const toTris = (polys) => { const out = []; polys.forEach(p => { for (let i = 1; i + 1 < p.v.length; i++) out.push(...p.v[0], ...p.v[i], ...p.v[i + 1]); }); return new Float64Array(out); };
            function op(ta, tb, kind) {
                const a = new Node(fromTris(ta)), b = new Node(fromTris(tb));
                if (kind === 'union') { a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); }
                else if (kind === 'sub') { a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); a.invert(); }
                else { a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.all()); a.invert(); }
                return toTris(a.all());
            }
            return { op };
        })();
        // booléen sur triangles en mm : les coordonnées sont ramenées près de 0 (précision)
        function csgTris(ta, tb, kind) {
            let ox = 0, oy = 0, oz = 0; for (let i = 0; i < ta.length; i += 3) { ox += ta[i]; oy += ta[i + 1]; oz += ta[i + 2]; } const n = ta.length / 3; ox /= n; oy /= n; oz /= n;
            const sh = (t, s) => { const o = new Float64Array(t.length); for (let i = 0; i < t.length; i += 3) { o[i] = t[i] - s * ox; o[i + 1] = t[i + 1] - s * oy; o[i + 2] = t[i + 2] - s * oz; } return o; };
            const r = CSG.op(sh(ta, 1), sh(tb, 1), kind); return sh(r, -1);
        }
        // booléen sur géométries de la scène (murs avec ouvertures)
        function csgGeom(g, cuts, kind) {
            let t = geomTris(g); const s = 1000; for (let i = 0; i < t.length; i++) t[i] *= s; if (signedVol(t) < 0) flipTris(t);
            cuts.forEach(c => { const u = geomTris(c); for (let i = 0; i < u.length; i++) u[i] *= s; if (signedVol(u) < 0) flipTris(u); t = csgTris(t, u, kind); });
            for (let i = 0; i < t.length; i++) t[i] /= s;
            const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(t), 3)); out.computeVertexNormals(); return out;
        }
        // résultat (triangles mm, repère réel) -> objet maillage du plan
        function meshFromTris(t, base) {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
            for (let i = 0; i < t.length; i += 3) { x0 = Math.min(x0, t[i]); x1 = Math.max(x1, t[i]); y0 = Math.min(y0, t[i + 1]); y1 = Math.max(y1, t[i + 1]); z0 = Math.min(z0, t[i + 2]); z1 = Math.max(z1, t[i + 2]); }
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, v = new Float32Array(t.length);
            for (let i = 0; i < t.length; i += 3) { v[i] = t[i] - cx; v[i + 1] = t[i + 1] - cy; v[i + 2] = t[i + 2] - z0; }
            const id = 'mesh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); meshStore[id] = v;
            return { type: 'mesh', layerId: base.layerId || activeLayerId, color: base.color, x: mmToWorld(cx), y: -mmToWorld(cy), rot: 0, sc: 1, z0, meshId: id, name: 'Volume', csg: true, ntri: v.length / 9, bb: { x0: x0 - cx, x1: x1 - cx, y0: y0 - cy, y1: y1 - cy, h: z1 - z0 } };
        }
        function meshVolume(s) { const v = meshStore[s.meshId]; if (!v) return 0; const k = s.sc || 1; return Math.abs(signedVol(v)) * k * k * k / 1e9; }
        // ---- outils : Union, Soustraire, Intersecter ----
        const BOOL_NAMES = { union: 'UNION', sub: 'SOUSTRAIRE', inter: 'INTERSECTER' };
        let boolKind = null, boolA = null;
        function startBool(kind) {
            const S = selectedShapes.filter(is3DObj);
            if (kind === 'union' && S.length >= 2) { runBool('union', S[0], S.slice(1)); return; }
            setMode('bool'); boolKind = kind; boolA = S.length === 1 ? S[0] : null; document.getElementById('btn-bool-' + kind).classList.add('active'); markActivePal(); updateCommandMessage(); draw();
        }
        function pick3DObj(w) { const t = findShapeAt(w.x, w.y); if (t && is3DObj(t)) return t; if (t && t.groupId) { const h = shapes.find(x => x.groupId === t.groupId && is3DObj(x)); if (h) return h; } return closedAt(w, is3DObj) || shapes.slice().reverse().find(x => is3DObj(x) && x.type === 'mesh' && pointInPolygon(w.x, w.y, meshCorners(x))) || null; }
        function boolClick(w) {
            const t = pick3DObj(w); if (!t) { updateCommandMessageText(BOOL_NAMES[boolKind] + ' : cliquez un volume (solide, balayage, maillage ou mur 3D).'); return; }
            if (!boolA) { boolA = t; selectedShapes = [t]; updateCommandMessage(); draw(); return; }
            if (t === boolA) return;
            runBool(boolKind, boolA, [t]);
        }
        function runBool(kind, A, Bs) {
            if (!window.THREE) { updateCommandMessageText('BOOLÉEN : chargement du moteur 3D…'); loadThree().then(() => runBool(kind, A, Bs)).catch(e => updateCommandMessageText('BOOLÉEN : le moteur 3D demande Internet (' + e.message + ').')); return; }
            let ta = objTrisMM(A); if (!ta) { updateCommandMessageText('BOOLÉEN : le premier objet n\'a pas de volume 3D.'); return; }
            const t0 = performance.now();
            try {
                for (const B of Bs) { const tb = objTrisMM(B); if (!tb) continue; ta = csgTris(ta, tb, kind); }
            } catch (e) { console.error(e); updateCommandMessageText('BOOLÉEN : calcul impossible (' + e.message + ').'); return; }
            if (!ta.length) { updateCommandMessageText(kind === 'inter' ? 'INTERSECTER : les volumes ne se touchent pas — rien à garder.' : 'BOOLÉEN : il ne reste rien.'); return; }
            const res = meshFromTris(ta, A); res.name = { union: 'Union', sub: 'Soustraction', inter: 'Intersection' }[kind];
            const gone = new Set([A].concat(Bs)); [A].concat(Bs).forEach(x => { if (x.groupId && x.wallMat) shapes.filter(y => y.groupId === x.groupId).forEach(y => gone.add(y)); });
            shapes = shapes.filter(x => !gone.has(x)); shapes.push(res);
            boolA = null; boolKind = null; setMode('select-box'); selectedShapes = []; saveState(); draw(); updatePropertiesPopup();
            updateCommandMessageText(res.name.toUpperCase() + ' : volume obtenu, ' + (res.ntri).toLocaleString('fr-FR') + ' triangles, ' + nfr(meshVolume(res), 3) + ' m³ (' + Math.round(performance.now() - t0) + ' ms). Ctrl+Z pour revenir aux objets d\'origine.');
        }
        // =====================================================================
        // BÂTIMENT : ouvertures dans les murs, pans de toiture (poutres = balayage à section perpendiculaire)
        // =====================================================================
        // ---- Ouvertures : { pts: 4 coins de l'emprise (monde), sill: allège (mm, depuis le bas du mur), h: hauteur (mm), kind: 'fen'|'porte', a, b } ----
        function wallGroupOf(w) { return w.groupId ? shapes.filter(x => x.groupId === w.groupId) : [w]; }
        // ouvertures qui traversent ce mur : même emprise en plan ET même hauteur (un mur d'étage au-dessus n'est pas percé par la fenêtre du RDC)
        function wallOpeningsFor(w) { const out = [], zr = (h) => h && h.wz && hasZ(h.wz.b) && hasZ(h.wz.t) ? h.wz : null, Wz = zr(w); shapes.filter(x => x.openings && x.openings.length).forEach(x => { const Hz = zr(x); if (Wz && Hz && !(Hz.b < Wz.t - 1 && Wz.b < Hz.t - 1)) return; (x.openings || []).forEach(o => { if (o.pts && o.pts.some(q => pointInPolygon(q.x, q.y, w.loops[0])) || w.loops[0].some(q => pointInPolygon(q.x, q.y, o.pts)) || openSegHit(o, w)) out.push(o); }); }); return out; }
        function openSegHit(o, w) { const L = w.loops[0]; for (let i = 0; i < 4; i++) { const a = o.pts[i], b = o.pts[(i + 1) % 4]; for (let j = 0; j < L.length; j++) { const c = L[j], d = L[(j + 1) % L.length]; if (segInter(a, b, c, d)) return true; } } return false; }
        function segInter(a, b, c, d) { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); }
        // HAUT DE L'OUVERTURE : franc (droit), arche (rayon R ≥ demi-largeur ; plein cintre si R = demi-largeur) ou chapeau de gendarme
        //      (de chaque côté deux arcs de même rayon R, creux puis bombé, tangents à l'horizontale au jambage et à la clé : flèche f = 2R − √(4R² − d²), d = demi-largeur).
        //      o.h = hauteur à la clé (le plus haut point) ; les jambages montent à o.h − f.
        function opTop(o, Wmm) { const t = o.top || 'droit', d = Wmm / 2; if (t === 'arche') { const R = Math.max(d, +o.R || d); return { t, R, f: R - Math.sqrt(Math.max(0, R * R - d * d)) }; }
            if (t === 'gendarme') { const R = Math.max(Wmm / 4 + 1, +o.R || Wmm * 0.6); return { t, R, f: 2 * R - Math.sqrt(Math.max(0, 4 * R * R - d * d)) }; } return { t: 'droit', R: 0, f: 0 }; }
        // contour de l'ouverture vue de face (mm : x le long du mur depuis le 1er jambage, z depuis le bas) ; n = points par arc
        function opProfile(o, Wmm, n) { n = n || 24; const h = Math.max(10, o.h || 1000), T = opTop(o, Wmm), f = Math.min(T.f, h - 1), zs = h - f, out = [[0, 0], [Wmm, 0], [Wmm, zs]], d = Wmm / 2;
            if (T.t === 'arche') { const R = T.R, cz = h - R, a0 = Math.atan2(zs - cz, d), a1 = Math.PI - a0; for (let i = 1; i < n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([d + R * Math.cos(a), cz + R * Math.sin(a)]); } }
            else if (T.t === 'gendarme') { const R = T.R, half = (side) => { const P = []; for (let i = 1; i <= n; i++) { const q = i / n; let x, z; if (q <= 0.5) { const a = Math.asin(Math.min(1, (d / 2) / R)) * (q * 2); x = R * Math.sin(a); z = zs + R - R * Math.cos(a); } else { const a = Math.asin(Math.min(1, (d / 2) / R)) * ((1 - q) * 2); x = d - R * Math.sin(a); z = h - R + R * Math.cos(a); } P.push(side > 0 ? [Wmm - x, z] : [x, z]); } return P; };
                const Rh = half(1); Rh.forEach(p => out.push(p)); half(-1).reverse().slice(1).forEach(p => out.push(p)); }
            out.push([0, zs]); return { pts: out, f, zs, h }; }
        function openingGeom(o, P, Zm, exag, w) {
            if (!w || !w.wz) return null; const zb = w.wz.b + (o.sill || 0), H = Math.max(10, o.h || 1000);
            if (o.top && o.top !== 'droit') {   // haut cintré : le contour vu de face, poussé à travers l'épaisseur
                const A0 = P(o.pts[0].x, o.pts[0].y), A1 = P(o.pts[1].x, o.pts[1].y), A3 = P(o.pts[3].x, o.pts[3].y), Wm = Math.hypot(A1.x - A0.x, A1.y - A0.y), Tm = Math.hypot(A3.x - A0.x, A3.y - A0.y); if (Wm < 1e-6 || Tm < 1e-6) return null;
                const pr = opProfile(o, Wm * 1000), shp = new THREE.Shape(pr.pts.map(([x, z]) => new THREE.Vector2(x / 1000, z / 1000))), g = new THREE.ExtrudeGeometry(shp, { depth: Tm, bevelEnabled: false, curveSegments: 4 });
                const eu = new THREE.Vector3((A1.x - A0.x) / Wm, (A1.y - A0.y) / Wm, 0), en = new THREE.Vector3((A3.x - A0.x) / Tm, (A3.y - A0.y) / Tm, 0), M = new THREE.Matrix4().makeBasis(eu, new THREE.Vector3(0, 0, exag), en).setPosition(A0.x, A0.y, Zm(zb));
                g.applyMatrix4(M); g.computeVertexNormals(); return g; }
            const shp = new THREE.Shape(o.pts.map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); }));
            const g = new THREE.ExtrudeGeometry(shp, { depth: H / 1000 * exag, bevelEnabled: false }); g.translate(0, 0, Zm(zb)); return g;
        }
        let openA = null, openWall = null;
        function startOpening() { setMode('opening'); openA = null; openWall = null; updateCommandMessage(); draw(); }
        const isWallHatch = (x) => x && x.type === 'hatch' && x.wallMat;
        function wallAt(w) { const t = findShapeAt(w.x, w.y); if (t && t.groupId) { const h = shapes.find(x => x.groupId === t.groupId && isWallHatch(x)); if (h) return h; } if (isWallHatch(t)) return t;
            const tol = 8 / camera.zoom, near = (L) => L.some((c, i) => { const d = L[(i + 1) % L.length], vx = d.x - c.x, vy = d.y - c.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((w.x - c.x) * vx + (w.y - c.y) * vy) / l2)); return Math.hypot(c.x + vx * t - w.x, c.y + vy * t - w.y) <= tol; });
            return shapes.find(x => isWallHatch(x) && x.loops && (pointInPolygon(w.x, w.y, x.loops[0]) || near(x.loops[0]))) || null; }
        // direction du mur au point cliqué : bord le plus proche du contour du mur
        let openDir = null, openLast = { w: 0.9, kind: 'fen' };
        try { const v = JSON.parse(localStorage.getItem('momocad-open') || 'null'); if (v && v.w > 0) openLast = Object.assign(openLast, v); } catch (e) {}
        function openingDirAt(h, p) {
            let best = null, bd = Infinity;
            wallGroupOf(h).filter(isWallHatch).forEach(x => (x.loops || []).forEach(L => { for (let i = 0; i < L.length; i++) { const c = L[i], d = L[(i + 1) % L.length], l = Math.hypot(d.x - c.x, d.y - c.y); if (l < 1e-9) continue; const dd = t2SegDist(p, c, d); if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && best && l > best.l)) { bd = dd; best = { x: (d.x - c.x) / l, y: (d.y - c.y) / l, l }; } } }));
            return best ? { x: best.x, y: best.y } : { x: 1, y: 0 };
        }
        // couches de paroi traversées par la normale au mur, au milieu de l'ouverture : intervalles [t0, t1] (monde, le long de la normale)
        function openingLayerSpans(a, b) {
            const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, R = mmToWorld(3000), out = [];
            shapes.filter(isWallHatch).forEach(h => { const l = layers.find(x => x.id === (h.layerId || 'layer-0')); if (l && l.visible === false) return; const ts = [];
                (h.loops || []).forEach(Lp => { for (let i = 0; i < Lp.length; i++) { const c = Lp[i], d = Lp[(i + 1) % Lp.length], den = (d.x - c.x) * ny - (d.y - c.y) * nx; if (Math.abs(den) < 1e-12) continue;
                    const u = ((m.x - c.x) * ny - (m.y - c.y) * nx) / den; if (u < 0 || u > 1) continue; const t = (c.x + (d.x - c.x) * u - m.x) * nx + (c.y + (d.y - c.y) * u - m.y) * ny; if (Math.abs(t) <= R) ts.push(t); } });
                if (ts.length >= 2) out.push({ h, t0: Math.min(...ts), t1: Math.max(...ts) }); });
            return { spans: out, nx, ny };
        }
        // épaisseur traversée par défaut : le mur cliqué, puis toutes les couches de paroi collées à lui (doublage, isolant, plaque…)
        function openingSpanAuto(host, a, b) {
            const zr = (h) => h && h.wz && hasZ(h.wz.b) && hasZ(h.wz.t) ? h.wz : null, Hz = zr(host), same = (h) => { const z = zr(h); return !Hz || !z || (z.b < Hz.t - 1 && Hz.b < z.t - 1); };   // couches du même étage seulement
            const spans = openingLayerSpans(a, b).spans.filter(x => same(x.h)), grp = wallGroupOf(host); let S = spans.filter(x => grp.includes(x.h)); if (!S.length) return null;
            let t0 = Math.min(...S.map(x => x.t0)), t1 = Math.max(...S.map(x => x.t1)); const tol = mmToWorld(15);
            for (let k = 0, grew = true; grew && k < 20; k++) { grew = false; spans.forEach(x => { if (x.t1 > t1 + 1e-9 && x.t0 <= t1 + tol) { t1 = x.t1; grew = true; } if (x.t0 < t0 - 1e-9 && x.t1 >= t0 - tol) { t0 = x.t0; grew = true; } }); }
            return [t0, t1];
        }
        // emprise de l'ouverture : de a à b le long du mur ; épaisseur o.tt (réglée à la souris) ou tout le complexe de paroi
        function openingPts(host, a, b, tt) {
            const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, e = mmToWorld(5);
            let t0, t1; if (tt) { t0 = tt[0]; t1 = tt[1]; } else { const A = openingSpanAuto(host, a, b); if (A) { t0 = A[0] - e; t1 = A[1] + e; } else { t0 = -mmToWorld(300); t1 = mmToWorld(300); } }
            if (t1 - t0 < mmToWorld(20)) { t0 -= mmToWorld(150); t1 += mmToWorld(150); }
            return [{ x: a.x + nx * t0, y: a.y + ny * t0 }, { x: b.x + nx * t0, y: b.y + ny * t0 }, { x: b.x + nx * t1, y: b.y + ny * t1 }, { x: a.x + nx * t1, y: a.y + ny * t1 }];
        }
        // ÉTIRER une ouverture dans l'épaisseur : on attrape une de ses deux faces (côté mur) et on la pose sur la face d'une autre couche
        let opStretch = null;   // { h, o, side: 0|1, t }
        function opStretchStart(h, o) { closeTopoModal(); setMode('opstretch'); opStretch = { h, o, side: null, t: null }; openSel = o; draw();
            updateCommandMessageText('ÉTIRER L\'OUVERTURE : cliquez près d\'une de ses deux faces (côté du mur), puis cliquez où la poser : elle s\'accroche aux faces des couches (isolant, doublage…). Échap pour finir.'); }
        function opStretchT(w, oo) { const o = oo || opStretch.o, L = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, nx = -(o.b.y - o.a.y) / L, ny = (o.b.x - o.a.x) / L;
            let t = (w.x - o.a.x) * nx + (w.y - o.a.y) * ny; const { spans } = openingLayerSpans(o.a, o.b), m = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 }, off = (m.x - o.a.x) * nx + (m.y - o.a.y) * ny, e = mmToWorld(5), tol = 10 / camera.zoom;
            let best = null, bd = tol; spans.forEach(x => [x.t0 + off, x.t1 + off].forEach(f => { const d = Math.abs(f - t); if (d < bd) { bd = d; best = f; } })); if (best !== null) t = best;
            const inner = best !== null && spans.filter(x => Math.abs(x.t0 + off - best) < mmToWorld(2) || Math.abs(x.t1 + off - best) < mmToWorld(2)).length >= 2;   // face entre deux couches
            return { t, snapped: best !== null, inner, e }; }
        function opStretchTT(o) { const L = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, nx = -(o.b.y - o.a.y) / L, ny = (o.b.x - o.a.x) / L, p = o.pts; const f = (q) => (q.x - o.a.x) * nx + (q.y - o.a.y) * ny; return [f(p[0]), f(p[3])]; }
        function opStretchClick(w) { const S = opStretch; if (!S) return; const o = S.o, tt = opStretchTT(o);
            if (S.side === null) { const r = opStretchT(w), t = (w.x - o.a.x) * (-(o.b.y - o.a.y)) / (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1) + (w.y - o.a.y) * ((o.b.x - o.a.x) / (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1));
                S.side = Math.abs(t - tt[0]) <= Math.abs(t - tt[1]) ? 0 : 1; draw(); updateCommandMessageText('ÉTIRER L\'OUVERTURE : cliquez où poser cette face (accroche sur les faces des couches). Échap pour annuler.'); return; }
            const r = opStretchT(w), n = tt.slice(); n[S.side] = r.t + (r.snapped ? (r.inner ? -mmToWorld(0.5) : r.e) * Math.sign(r.t - n[1 - S.side]) : 0);   // face entre deux couches : juste avant ; face extérieure : léger débord pour bien couper
            if (Math.abs(n[1] - n[0]) < mmToWorld(20)) { updateCommandMessageText('ÉTIRER L\'OUVERTURE : trop fin, choisissez une autre position.'); return; }
            o.tt = n[0] < n[1] ? n : [n[1], n[0]]; o.pts = openingPts(S.h, o.a, o.b, o.tt); S.side = null; saveState(); invalidateCache(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText('ÉTIRER L\'OUVERTURE : épaisseur traversée ' + calculateRealDistance(Math.abs(o.tt[1] - o.tt[0])) + '. Une autre face, ou Échap pour finir.'); }
        function drawOpStretchPreview(c) { if (mode !== 'opstretch' || !opStretch) return; const S = opStretch, o = S.o, z = camera.zoom, tt = opStretchTT(o), L = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, nx = -(o.b.y - o.a.y) / L, ny = (o.b.x - o.a.x) / L;
            const face = (t, col, dash) => { c.save(); c.strokeStyle = col; c.lineWidth = 2.5 / z; c.setLineDash(dash ? [6 / z, 4 / z] : []); c.beginPath(); c.moveTo(o.a.x + nx * t, o.a.y + ny * t); c.lineTo(o.b.x + nx * t, o.b.y + ny * t); c.stroke(); c.restore(); };
            [0, 1].forEach(k => face(tt[k], S.side === k ? '#f97316' : '#60a5fa', false));
            if (S.side !== null) { const r = opStretchT({ x: currentX, y: currentY }); face(r.t, r.snapped ? '#22c55e' : '#fbbf24', true); } }
        // 2e point : projeté le long du mur ; largeur tapée = prioritaire (le côté suit la souris)
        function openingB(p) {
            const u = openDir || { x: 1, y: 0 }, sP = (p.x - openA.x) * u.x + (p.y - openA.y) * u.y, v = t2Num(typedInput);
            const L = v > 0 ? T2W(v) * (sP < 0 ? -1 : 1) : sP; return { x: openA.x + u.x * L, y: openA.y + u.y * L };
        }
        function openingClick(w) {
            if (!openA) { const h = wallAt(w); if (!h) { updateCommandMessageText('OUVERTURE : cliquez sur un mur (le début de l\'ouverture — les accroches aident : angle, milieu…).'); return; } openA = { x: w.x, y: w.y }; openWall = h; openDir = openingDirAt(h, w); typedInput = ''; updateCommandMessage(); draw(); return; }
            openingFinish(openingB(w));
        }
        function openingFinish(b) {
            const a = openA, L = Math.hypot(b.x - a.x, b.y - a.y); if (L < mmToWorld(50)) return;
            const pts = openingPts(openWall, a, b), k = ['porte', 'baie', 'garage'].includes(openLast.kind) ? openLast.kind : 'fen';
            const o = { pts, a, b, kind: k, sill: k === 'fen' ? 1000 : 0, h: k === 'fen' ? 1250 : k === 'garage' ? 2000 : 2150, hinge: 'a', side: 1, layerId: opLayerId(), top: openLast.top || 'droit' }; if (o.top !== 'droit' && openLast.Rk) o.R = openLast.Rk * L * mOf(1) * 1000;
            openLast.w = Math.round(L * mOf(1) * 1000) / 1000; try { localStorage.setItem('momocad-open', JSON.stringify(openLast)); } catch (e) {}
            openWall.openings = (openWall.openings || []).concat([o]); const host = openWall; openA = null; openWall = null; openDir = null; typedInput = ''; saveState(); setMode('select-box'); draw();
            openingDialog(host, o, true);
        }
        function drawOpeningPreview(c) {
            if (mode !== 'opening' || !openA || !openWall) return; const b = openingB({ x: currentX, y: currentY }), L = Math.hypot(b.x - openA.x, b.y - openA.y), z = camera.zoom;
            c.save(); c.fillStyle = 'rgba(251,191,36,0.18)'; c.strokeStyle = '#fbbf24'; c.lineWidth = 1.5 / z; c.setLineDash([5 / z, 3 / z]);
            if (L > 1e-9) { const P = openingPts(openWall, openA, b); c.beginPath(); P.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill(); c.stroke(); }
            c.setLineDash([]); c.beginPath(); c.arc(openA.x, openA.y, 3.5 / z, 0, 2 * Math.PI); c.fillStyle = '#fbbf24'; c.fill(); c.restore();
            if (L > 1e-9) t2Label(c, b.x, b.y, 'largeur ' + calculateRealDistance(L));
        }
        function openingDialog(host, o, isNew) {
            const wM = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) * mOf(1), inp = (id, v) => `<input id="${id}" type="text" inputmode="decimal" value="${String(v).replace('.', ',')}" style="width:90px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;text-align:right;outline:none;">`;
            const rb = (name, val, cur, lab) => `<label style="cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''}> ${lab}</label>`;
            const isDoor = o.kind === 'porte' || o.kind === 'baie' || o.kind === 'garage';
            const thk = Math.abs(opStretchTT(o)[1] - opStretchTT(o)[0]) * mOf(1) * 1000, Hw = host.wz && hasZ(host.wz.t) && hasZ(host.wz.b) ? host.wz.t - host.wz.b : 2500;
            const ti = (id, v, w, x, y, tip, hide) => `<input id="${id}" type="text" inputmode="decimal" value="${String(v).replace('.', ',')}" title="${MF.esc(tip)}" class="tal-in" oninput="opDiaDraw()" style="left:${x}%;top:${y}%;width:${w}px;${hide ? 'display:none;' : ''}">`;
            opDiaCtx = { Hw, thk };
            openTopoModal(isNew ? '🚪 Ouverture dans le mur' : '🚪 Ouverture — modifier', `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb;">
                ${spChapter('op-dim', '▭', 'Type et dimensions', `<div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;gap:16px;flex-wrap:wrap"><label style="cursor:pointer;"><input type="radio" name="op-k" value="fen" ${o.kind === 'fen' || !o.kind ? 'checked' : ''} onchange="opKind('fen')"> Fenêtre</label><label style="cursor:pointer;"><input type="radio" name="op-k" value="porte" ${o.kind === 'porte' ? 'checked' : ''} onchange="opKind('porte')"> Porte</label><label style="cursor:pointer;" title="Porte sectionnelle : panneaux horizontaux qui remontent sous le plafond"><input type="radio" name="op-k" value="garage" ${o.kind === 'garage' ? 'checked' : ''} onchange="opKind('garage')"> Porte de garage</label><label style="cursor:pointer;" title="Passage sans porte ni fenêtre : le mur est simplement percé"><input type="radio" name="op-k" value="baie" ${o.kind === 'baie' ? 'checked' : ''} onchange="opKind('baie')"> Baie libre (sans porte)</label></div>
                <div class="mf-sub" style="margin:0;">Haut de l'ouverture</div>
                <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">${[['droit', 'Franc (droit)'], ['arche', 'Arche'], ['gendarme', 'Chapeau de gendarme']].map(([v, l]) => `<label style="cursor:pointer;"><input type="radio" name="op-top" value="${v}" ${(o.top || 'droit') === v ? 'checked' : ''} onchange="opTopUI()"> ${l}</label>`).join('')}
                    <span id="op-r-box" style="display:${(o.top || 'droit') === 'droit' ? 'none' : 'inline-flex'};align-items:center;gap:6px">rayon ${inp('op-r', lenTxt(o.R || opTop(Object.assign({}, o, { R: 0 }), wM * 1000).R))} <span id="op-f" style="color:#9ca3af;font-size:12px"></span></span></div>
                <div class="mf-sub" style="margin:0;">Vue de dessus</div>
                <div class="tal-dia" id="op-dia-top"><svg id="op-svg-top" viewBox="0 0 360 210" width="100%" preserveAspectRatio="xMidYMid meet"></svg>
                    ${ti('op-w', lenTxt(wM * 1000), 64, 41, 4, 'Largeur de l\'ouverture, le long du mur, depuis le 1er point (' + LUN() + ')')}
                    ${isNew ? '' : ti('op-shift', 0, 54, 4, 86, 'Décaler l\'ouverture le long du mur : + vers le 2e point, − vers le 1er (' + LUN() + ')') + '<span class="tal-lb" style="left:21%;top:88%;">↔ décaler</span>'}
                    <span class="tal-lb" style="left:66%;top:89%;color:#9ca3af;font-weight:400;">traverse ${nfr(thk / 1000, 3)} m</span></div>
                <div class="mf-sub" style="margin:0;">Vue de face</div>
                <div class="tal-dia" id="op-dia-side"><svg id="op-svg-side" viewBox="0 0 360 190" width="100%" preserveAspectRatio="xMidYMid meet"></svg>
                    ${ti('op-h', lenTxt(o.h), 56, 8, 38, 'Hauteur de l\'ouverture (' + LUN() + ')')}<span class="tal-lb" style="left:9%;top:28%;">hauteur</span>
                    ${ti('op-sill', lenTxt(o.sill), 56, 76, 70, 'Allège : du bas du mur au bas de l\'ouverture (' + LUN() + ')', isDoor)}<span class="tal-lb" id="op-sill-lb" style="left:77%;top:60%;${isDoor ? 'display:none;' : ''}">allège</span></div></div>`, true)}
                ${spChapter('op-vol', '▥', 'Volets', `<div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;gap:16px;flex-wrap:wrap;">${rb('op-vt', 'none', (o.shut || {}).type || 'none', 'Aucun')}${rb('op-vt', 'battant', (o.shut || {}).type || 'none', 'Volets battants')}${rb('op-vt', 'roulant', (o.shut || {}).type || 'none', 'Bloc volet roulant encastré')}</div>
                    <div style="display:flex;gap:16px;">${rb('op-vs', '1', String((o.shut || {}).side || o.side || 1), 'À l\'extérieur d\'un côté du mur')}${rb('op-vs', '-1', String((o.shut || {}).side || o.side || 1), 'de l\'autre côté')}</div>
                </div>`, false)}
                <div id="op-door" style="display:${isDoor ? 'flex' : 'none'};flex-direction:column;gap:0;">${spChapter('op-sens', '↻', 'Sens de la porte', `<div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;gap:16px;">${rb('op-hg', 'a', o.hinge || 'a', 'Charnière côté 1er point')}${rb('op-hg', 'b', o.hinge || 'a', 'côté 2e point')}</div>
                    <div style="display:flex;gap:16px;">${rb('op-sd', '1', String(o.side || 1), 'S\'ouvre d\'un côté du mur')}${rb('op-sd', '-1', String(o.side || 1), 'de l\'autre côté')}</div>
                </div>`, false)}</div></div>`,
                [['Supprimer', () => { host.openings = (host.openings || []).filter(x => x !== o); closeTopoModal(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } }, false]].concat(isNew ? [] : [['↔ Étirer dans l\'épaisseur', () => opStretchStart(host, o), false], ['Tout le complexe', () => { delete o.tt; o.pts = openingPts(host, o.a, o.b); closeTopoModal(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } updateCommandMessageText('OUVERTURE : elle traverse tout le complexe de paroi (' + calculateRealDistance(Math.abs(opStretchTT(o)[1] - opStretchTT(o)[0])) + ').'); }, false]]).concat([
                 ['Valider', () => { const nv = (id) => parseFloat(String(document.getElementById(id).value).replace(/\s/g, '').replace(',', '.')); o.kind = (document.querySelector('input[name=op-k]:checked') || {}).value || 'fen'; o.top = (document.querySelector('input[name=op-top]:checked') || {}).value || 'droit'; { const rr = nv('op-r') * lenF(); if (o.top === 'droit') delete o.R; else if (rr > 0) o.R = rr; else delete o.R; }
                    const sl = nv('op-sill') * lenF(), hh = nv('op-h') * lenF(), ww = nv('op-w') * lenF() / 1000; if (sl >= 0) o.sill = sl; if (hh > 0) o.h = hh;   // saisies dans l'unité du dessin
                    if (ww > 0.05 && Math.abs(ww - wM) > 1e-6) { const L0 = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, L1 = mmToWorld(ww * 1000); o.b = { x: o.a.x + (o.b.x - o.a.x) / L0 * L1, y: o.a.y + (o.b.y - o.a.y) / L0 * L1 }; o.pts = openingPts(host, o.a, o.b, o.tt); }
                    { const sh = document.getElementById('op-shift'), dv = sh ? nv('op-shift') * lenF() / 1000 : 0; if (dv && isFinite(dv)) { const L0 = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) || 1, ux = (o.b.x - o.a.x) / L0, uy = (o.b.y - o.a.y) / L0, d = mmToWorld(dv * 1000); o.a = { x: o.a.x + ux * d, y: o.a.y + uy * d }; o.b = { x: o.b.x + ux * d, y: o.b.y + uy * d }; o.pts = openingPts(host, o.a, o.b, o.tt); } }
                    const hg = document.querySelector('input[name=op-hg]:checked'), sd = document.querySelector('input[name=op-sd]:checked'); if (hg) o.hinge = hg.value; if (sd) o.side = +sd.value;
                    { const vt = (document.querySelector('input[name=op-vt]:checked') || {}).value || 'none', vs = +((document.querySelector('input[name=op-vs]:checked') || {}).value || 1); if (vt === 'none') delete o.shut; else o.shut = { type: vt, side: vs === -1 ? -1 : 1 }; }
                    openLast.kind = o.kind; openLast.top = o.top; openLast.Rk = o.R ? o.R / (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) * mOf(1) * 1000) : 0; openLast.w = ww > 0 ? ww : openLast.w; try { localStorage.setItem('momocad-open', JSON.stringify(openLast)); } catch (e) {}
                    closeTopoModal(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
                    updateCommandMessageText('OUVERTURE : ' + ({ porte: 'porte', baie: 'baie libre', fen: 'fenêtre', garage: 'porte de garage' }[o.kind] || 'fenêtre') + ({ arche: ' en arche', gendarme: ' en chapeau de gendarme' }[o.top] || '') + ' de ' + nfr(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) * mOf(1), 2) + ' × ' + nfr(o.h / 1000, 2) + ' m, allège ' + nfr(o.sill / 1000, 2) + ' m. Un clic dessus pour la modifier ou la décaler ; elle perce le mur en 3D si le mur a ses niveaux (Y sur le mur).'); }, true]]));
            setTimeout(() => { opDiaDraw(); tmTabify(); }, 0); document.querySelectorAll('input[name=op-hg], input[name=op-sd], input[name=op-vt], input[name=op-vs]').forEach(r => r.addEventListener('change', opDiaDraw));
            const f = document.getElementById('op-w'); if (f) setTimeout(() => { f.focus(); f.select(); }, 30);
        }
        // fenêtre des ouvertures : schémas cotés (dessus et face), redessinés à chaque saisie
        let opDiaCtx = { Hw: 2500, thk: 200 };
        function opKind(k) { const sl = document.getElementById('op-sill'), h = document.getElementById('op-h'), dr = document.getElementById('op-door'), lb = document.getElementById('op-sill-lb');
            if (k === 'porte' || k === 'baie' || k === 'garage') { sl.value = '0'; h.value = lenTxt(k === 'garage' ? 2000 : 2150); sl.style.display = 'none'; if (lb) lb.style.display = 'none'; dr.style.display = k === 'porte' || k === 'garage' ? 'flex' : 'none'; }
            else { sl.value = lenTxt(1000); h.value = lenTxt(1250); sl.style.display = ''; if (lb) lb.style.display = ''; dr.style.display = 'none'; }
            opDiaDraw(); tmTabify(); }
        function opTopUI() { const t = (document.querySelector('input[name=op-top]:checked') || {}).value || 'droit', b = document.getElementById('op-r-box'), r = document.getElementById('op-r'); if (b) b.style.display = t === 'droit' ? 'none' : 'inline-flex';
            if (r && t !== 'droit') { const w = (parseFloat(String((document.getElementById('op-w') || {}).value || '').replace(/\s/g, '').replace(',', '.')) || 1) * lenF(); const cur = parseFloat(String(r.value).replace(/\s/g, '').replace(',', '.')) * lenF(); const T = opTop({ top: t, R: cur > 0 ? cur : 0 }, w); if (!(cur > 0) || cur < (t === 'arche' ? w / 2 : w / 4)) r.value = lenTxt(Math.round(T.R)); }
            opDiaDraw(); }
        function opDiaDraw() {
            const top = document.getElementById('op-svg-top'), side = document.getElementById('op-svg-side'); if (!top || !side) return;
            const nv = (id) => { const e = document.getElementById(id); const v = e ? parseFloat(String(e.value).replace(/\s/g, '').replace(',', '.')) : NaN; return isFinite(v) ? v * lenF() : NaN; };
            const kd = ((document.querySelector('input[name=op-k]:checked') || {}).value) || 'fen', baie = kd === 'baie', gar = kd === 'garage', door = kd === 'porte' || baie || gar, hgB = ((document.querySelector('input[name=op-hg]:checked') || {}).value) === 'b', sdN = ((document.querySelector('input[name=op-sd]:checked') || {}).value) === '-1';
            const D = '#f59e0b', A = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${D}" stroke-width="1"/>`, tick = (x, y) => `<path d="M${x - 4} ${y + 4}l8-8" stroke="${D}" stroke-width="1"/>`;
            // dessus : mur en bande, l'ouverture au milieu, cote de largeur, symbole fenêtre ou porte
            const y0 = 88, y1 = 120, x0 = 145, x1 = 215;
            let t = `<defs><pattern id="opdh" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#52525b" stroke-width="1"/></pattern></defs>
                <rect x="14" y="${y0}" width="${x0 - 14}" height="${y1 - y0}" fill="url(#opdh)" stroke="#d4d4d8" stroke-width="1.2"/><rect x="${x1}" y="${y0}" width="${346 - x1}" height="${y1 - y0}" fill="url(#opdh)" stroke="#d4d4d8" stroke-width="1.2"/>
                <path d="M${x0} ${y0}V${y1}M${x1} ${y0}V${y1}" stroke="#e5e7eb" stroke-width="2"/>`;
            if (gar) t += `<path d="M${x0} ${(y0 + y1) / 2}H${x1}" stroke="#93c5fd" stroke-width="2.4"/><path d="M${x0 + 3} ${y1}V${y1 + 46}M${x1 - 3} ${y1}V${y1 + 46}" stroke="#93c5fd" stroke-width="1" stroke-dasharray="4 3"/>`;
            else if (door) { const hx = hgB ? x1 : x0, ox = hgB ? x0 : x1, yy = sdN ? y0 : y1, dir = sdN ? -1 : 1, w = x1 - x0;
                t += `<path d="M${hx} ${yy}V${yy + dir * w}" stroke="#93c5fd" stroke-width="2"/><path d="M${hx} ${yy + dir * w}A${w} ${w} 0 0 ${(hgB ? 1 : 0) ^ (sdN ? 1 : 0)} ${ox} ${yy}" stroke="#93c5fd" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`; }
            else t += `<path d="M${x0} ${y0 + 13}H${x1}M${x0} ${y1 - 13}H${x1}" stroke="#93c5fd" stroke-width="1.6"/>`;
            { const vt = (document.querySelector('input[name=op-vt]:checked') || {}).value, vS = ((document.querySelector('input[name=op-vs]:checked') || {}).value) === '-1', fy = vS ? y0 : y1, oy = vS ? -3 : 3;
                if (vt === 'battant') t += `<path d="M${x0} ${fy + oy}H${x0 - (x1 - x0) / 2}M${x1} ${fy + oy}H${x1 + (x1 - x0) / 2}" stroke="#4ade80" stroke-width="3"/><text x="${x1 + 4}" y="${fy + oy * 5 + 3}" fill="#4ade80" font-size="9" font-family="Arial">volets</text>`;
                if (vt === 'roulant') t += `<path d="M${x0} ${fy - oy * 2}H${x1}" stroke="#4ade80" stroke-width="1.6" stroke-dasharray="4 3"/><rect x="${x0}" y="${fy - oy * 2 - 3}" width="6" height="6" fill="#4ade80"/><rect x="${x1 - 6}" y="${fy - oy * 2 - 3}" width="6" height="6" fill="#4ade80"/><text x="${x1 + 4}" y="${fy + oy * 3 + 3}" fill="#4ade80" font-size="9" font-family="Arial">volet roulant</text>`; }
            t += A(x0, 26, x1, 26) + A(x0, 22, x0, y0 - 4) + A(x1, 22, x1, y0 - 4) + tick(x0, 26) + tick(x1, 26) + `<text x="18" y="${y0 - 6}" fill="#9ca3af" font-size="9" font-family="Arial">mur</text>`;
            top.innerHTML = t;
            // face : mur à l'échelle de sa hauteur, ouverture à sa place, cotes de hauteur et d'allège
            const Hw = Math.max(1, opDiaCtx.Hw), sill = door ? 0 : Math.max(0, nv('op-sill') || 0), h = Math.max(10, nv('op-h') || 1000), Hs = Math.max(Hw, sill + h), k = 150 / Hs, g = 172, yb = g - sill * k, yt = g - (sill + h) * k, wx0 = 140, wx1 = 220;
            let f = `<defs><pattern id="opdf" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#3f3f46" stroke-width="1"/></pattern></defs>
                <rect x="40" y="${g - Hw * k}" width="280" height="${Hw * k}" fill="url(#opdf)" stroke="#d4d4d8" stroke-width="1.2"/><path d="M14 ${g}H346" stroke="#a1a1aa" stroke-width="1.4"/>
                <path d="${(() => { const top = (document.querySelector('input[name=op-top]:checked') || {}).value || 'droit', wmm = Math.max(10, nv('op-w') || 1000), rr = nv('op-r'), pr = opProfile({ top, R: rr > 0 ? rr : 0, h }, wmm, 16), sx = (wx1 - wx0) / wmm;
                    const fe = document.getElementById('op-f'); if (fe) fe.textContent = top === 'droit' ? '' : 'flèche ' + lenTxt(Math.round(pr.f)) + ' · jambages ' + lenTxt(Math.round(pr.zs));
                    return pr.pts.map(([x, z], i) => (i ? 'L' : 'M') + (wx0 + x * sx).toFixed(1) + ' ' + (yb - z * k).toFixed(1)).join('') + 'Z'; })()}" fill="#111827" stroke="#e5e7eb" stroke-width="2"/>`;
            f += baie ? '' : gar ? Array.from({ length: 5 }, (_, i) => `<rect x="${wx0 + 4}" y="${(yt + 4 + i * (yb - yt - 4) / 5).toFixed(1)}" width="${wx1 - wx0 - 8}" height="${((yb - yt - 4) / 5 - 2).toFixed(1)}" fill="#e5e7eb" fill-opacity=".75" stroke="#64748b" stroke-width=".8"/>`).join('') : door ? `<path d="M${wx0 + 6} ${yt + 6}h${wx1 - wx0 - 12}v${yb - yt - 6}h-${wx1 - wx0 - 12}z" stroke="#a16207" stroke-width="1.5" fill="#78350f" fill-opacity=".45"/><circle cx="${hgB ? wx0 + 14 : wx1 - 14}" cy="${(yt + yb) / 2 + 6}" r="2.5" fill="#fbbf24"/>`
                : `<path d="M${(wx0 + wx1) / 2} ${yt}V${yb}M${wx0 + 5} ${yt + 5}h${wx1 - wx0 - 10}v${yb - yt - 10}h-${wx1 - wx0 - 10}z" stroke="#93c5fd" stroke-width="1.2" fill="#93c5fd" fill-opacity=".15"/>`;
            { const vt = (document.querySelector('input[name=op-vt]:checked') || {}).value, ww = wx1 - wx0;
                if (vt === 'battant') [[wx0 - ww / 2, wx0], [wx1, wx1 + ww / 2]].forEach(([a, b]) => { f += `<rect x="${a}" y="${yt}" width="${b - a}" height="${yb - yt}" fill="#4d7c5a" stroke="#86efac" stroke-width="1"/>`; for (let yy = yt + 8; yy < yb; yy += 8) f += `<path d="M${a + 2} ${yy}H${b - 2}" stroke="#86efac" stroke-opacity=".35"/>`; });
                if (vt === 'roulant') { const yl = yt + (yb - yt) * 0.3; f += `<rect x="${wx0}" y="${yt}" width="${ww}" height="${yl - yt}" fill="#cbd5e1"/>`; for (let yy = yt + 4; yy < yl; yy += 4) f += `<path d="M${wx0} ${yy}H${wx1}" stroke="#64748b" stroke-width=".7"/>`; f += `<rect x="${wx0 - 3}" y="${yt}" width="3" height="${yb - yt}" fill="#94a3b8"/><rect x="${wx1}" y="${yt}" width="3" height="${yb - yt}" fill="#94a3b8"/>`; } }
            f += A(122, yt, 122, yb) + A(118, yt, wx0 - 4, yt) + A(118, yb, wx0 - 4, yb) + tick(122, yt) + tick(122, yb);
            if (!door && sill > 0) f += A(250, yb, 250, g) + A(wx1 + 4, yb, 254, yb) + tick(250, yb) + tick(250, g);
            f += `<text x="44" y="${g - Hw * k + 11}" fill="#9ca3af" font-size="9" font-family="Arial">mur ${nfr(Hw / 1000, 2)} m</text><text x="300" y="${g - 4}" fill="#9ca3af" font-size="9" font-family="Arial">sol</text>`;
            side.innerHTML = f;
        }
        // en plan : l'ouverture efface le mur, jambages et symbole (vitrage ou battant de porte)
        function drawOpenings2D(ctx, isPrinting) {
            const bg = isPrinting ? '#ffffff' : '#1e1e1e', ls = camera.zoom;
            shapes.forEach(h => { if (!h.openings || !h.openings.length) return; const l = layers.find(x => x.id === (h.layerId || 'layer-0')); if ((l && l.visible === false) || lvlHidden(h)) return; const dim = !isPrinting && lvlOn && lvlBelow(h); if (dim) { ctx.save(); ctx.globalAlpha *= 0.3; }   /* ouverture d'un étage du dessous : translucide comme son mur */
                const col0 = isPrinting ? '#000' : effectiveColor(h, false);
                h.openings.forEach(o => { const p = o.pts; ctx.save(); ctx.setLineDash([]);
                    ctx.fillStyle = bg; ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
                    if (opHidden(o)) { ctx.restore(); return; } const oL = opLayer(o), col = isPrinting ? '#000' : oL && oL.color ? oL.color : col0;
                    ctx.strokeStyle = col; ctx.lineWidth = 1 / ls; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[3].x, p[3].y); ctx.moveTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y); ctx.stroke();
                    const mA = { x: (p[0].x + p[3].x) / 2, y: (p[0].y + p[3].y) / 2 }, mB = { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 };
                    if (o.kind === 'baie') { ctx.setLineDash([4 / ls, 3 / ls]); ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.moveTo(p[3].x, p[3].y); ctx.lineTo(p[2].x, p[2].y); ctx.stroke(); ctx.setLineDash([]); }   // baie libre : le linteau au-dessus, en tirets
                    else if (o.kind === 'garage') { /* porte sectionnelle : le tablier au milieu du mur, ses rails en tirets vers l'intérieur (côté du sens choisi) */ const sd = o.side === -1 ? -1 : 1, nx = (p[3].x - p[0].x) * sd, ny = (p[3].y - p[0].y) * sd, nl = Math.hypot(nx, ny) || 1, d = mmToWorld(Math.min(2500, o.h || 2000));
                        const E0 = sd > 0 ? p[3] : p[0], E1 = sd > 0 ? p[2] : p[1]; ctx.lineWidth = 2.4 / ls; ctx.beginPath(); ctx.moveTo(mA.x, mA.y); ctx.lineTo(mB.x, mB.y); ctx.stroke(); ctx.lineWidth = 1 / ls; ctx.setLineDash([5 / ls, 4 / ls]); ctx.beginPath();
                        [E0, E1].forEach(e => { ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + nx / nl * d, e.y + ny / nl * d); }); ctx.moveTo(E0.x + nx / nl * d, E0.y + ny / nl * d); ctx.lineTo(E1.x + nx / nl * d, E1.y + ny / nl * d); ctx.stroke(); ctx.setLineDash([]); }
                    else if (o.kind === 'porte') { const w = Math.hypot(mB.x - mA.x, mB.y - mA.y), sd = o.side === -1 ? -1 : 1, hb = o.hinge === 'b';
                        const H = sd > 0 ? (hb ? p[2] : p[3]) : (hb ? p[1] : p[0]), J = sd > 0 ? (hb ? p[3] : p[2]) : (hb ? p[0] : p[1]);   // charnière et jambage opposé, sur la face qui reçoit le battant
                        const nx = (p[3].x - p[0].x) * sd, ny = (p[3].y - p[0].y) * sd, nl = Math.hypot(nx, ny) || 1, ux = nx / nl, uy = ny / nl;
                        const a0 = Math.atan2(J.y - H.y, J.x - H.x), a1 = Math.atan2(uy, ux);
                        ctx.beginPath(); ctx.moveTo(H.x, H.y); ctx.lineTo(H.x + ux * w, H.y + uy * w); ctx.stroke();
                        ctx.setLineDash([3 / ls, 3 / ls]); ctx.beginPath(); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; ctx.arc(H.x, H.y, w, a0, a1, d < 0); ctx.stroke(); }
                    else { ctx.lineWidth = 0.8 / ls; ctx.beginPath(); const off = 0.12; [0.5 - off, 0.5 + off].forEach(t => { ctx.moveTo(p[0].x + (p[3].x - p[0].x) * t, p[0].y + (p[3].y - p[0].y) * t); ctx.lineTo(p[1].x + (p[2].x - p[1].x) * t, p[1].y + (p[2].y - p[1].y) * t); }); ctx.stroke(); }
                    if (o.shut && o.shut.type) {   // volets, sur la face extérieure choisie
                        const ex = o.shut.side === -1 ? [p[0], p[1]] : [p[3], p[2]], inn = o.shut.side === -1 ? [p[3], p[2]] : [p[0], p[1]], wL = Math.hypot(ex[1].x - ex[0].x, ex[1].y - ex[0].y) || 1, ux = (ex[1].x - ex[0].x) / wL, uy = (ex[1].y - ex[0].y) / wL;
                        const ox = (ex[0].x - inn[0].x), oy = (ex[0].y - inn[0].y), ol = Math.hypot(ox, oy) || 1, nx = ox / ol, ny = oy / ol, gap = 2.5 / ls;
                        ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = 2.2 / ls;
                        if (o.shut.type === 'battant') { ctx.beginPath(); ctx.moveTo(ex[0].x + nx * gap, ex[0].y + ny * gap); ctx.lineTo(ex[0].x - ux * wL / 2 + nx * gap, ex[0].y - uy * wL / 2 + ny * gap); ctx.moveTo(ex[1].x + nx * gap, ex[1].y + ny * gap); ctx.lineTo(ex[1].x + ux * wL / 2 + nx * gap, ex[1].y + uy * wL / 2 + ny * gap); ctx.stroke(); }
                        else { const d = Math.min(ol * 0.25, mmToWorld(80)), a = { x: ex[0].x - nx * d, y: ex[0].y - ny * d }, b = { x: ex[1].x - nx * d, y: ex[1].y - ny * d }, k = mmToWorld(40);
                            ctx.lineWidth = 1 / ls; ctx.setLineDash([4 / ls, 3 / ls]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; [a, b].forEach(q => ctx.fillRect(q.x - k / 2, q.y - k / 2, k, k)); }
                        ctx.restore(); }
                    if (o === openSel && !isPrinting) { ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.5 / ls; ctx.setLineDash([5 / ls, 3 / ls]); ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); }
                    ctx.restore(); }); if (dim) ctx.restore(); });
        }
        let openSel = null;   // ouverture en cours de modification (surlignée)
        function spOpenEdit(k, j) { const h = shapes[k], o = h && (h.openings || [])[j]; if (!o) return; closeSelectionParamModal(); openSel = o; openingDialog(h, o, false); draw(); }
        // points d'accroche des ouvertures (hors celle qu'on est en train de modifier) : 4 coins, 2 bouts sur le mur, milieu, milieux des deux faces, centre
        function openingSnapPts(wx, wy, rw) { const out = [], D = typeof gripDrag !== 'undefined' && gripDrag && /^op-/.test(gripDrag.g.kind) ? gripDrag.g : null, R = rw * 4 + mmToWorld(8000), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            for (const h of shapes) { if (!h.openings || !h.openings.length) continue; const l = layers.find(x => x.id === (h.layerId || 'layer-0')); if ((l && !l.visible) || lvlHidden(h)) continue;
                h.openings.forEach((o, oi) => { if (!o.pts || (D && D.s === h && D.oi === oi)) return; const p = o.pts; if (Math.abs(p[0].x - wx) > R || Math.abs(p[0].y - wy) > R) return;
                    p.forEach(q => out.push({ x: q.x, y: q.y })); const f1 = mid(p[0], p[1]), f2 = mid(p[3], p[2]); out.push(f1, f2, mid(f1, f2), mid(p[0], p[3]), mid(p[1], p[2]));
                    if (o.a && o.b) out.push({ x: o.a.x, y: o.a.y }, { x: o.b.x, y: o.b.y }, mid(o.a, o.b)); }); }
            return out; }
        // calque des ouvertures (menuiseries) : on peut les masquer, changer leur couleur ; le trou dans le mur reste
        function opLayerId() { return ensureLayer('Ouvertures', '#38bdf8'); }
        function opLayer(o) { return o && o.layerId ? layers.find(l => l.id === o.layerId) || null : null; }
        function opHidden(o) { const l = opLayer(o); return !!(l && l.visible === false); }
        function openingAt(w) { for (const h of shapes) for (const o of (h.openings || [])) if (pointInPolygon(w.x, w.y, o.pts)) return { h, o }; return null; }

