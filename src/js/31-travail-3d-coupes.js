        // =====================================================================
        // TRAVAILLER DANS LA VUE 3D : accroches 3D (extrémités, milieux, sommets des volumes, points topo, surfaces)
        // et outils qui dessinent directement en 3D : droite, polyligne, rectangle / pavé, cercle / cylindre, mesurer, déplacer, copier.
        // =====================================================================
        const D3_MODES = new Set(['select-box', 'measure']);   // la vue 3D est un visualiseur : regarder, mesurer, contrôler les collisions
        const D3 = { pts: [], cur: null, workZ: null, typed: '', plane: null };
        const d3Active = () => is3DOpen() && V3 && mode !== 'select-box' && D3_MODES.has(mode) && !texPaint;
        function d3Reset() { D3.pts = []; D3.cur = null; D3.workZ = null; D3.typed = ''; D3.plane = null; if (V3 && V3.tmp) { V3.tmp.clear(); } d3Mark(null); }
        // repère local de la scène (mètres, Z exagéré ; le recentrage est porté par root.position) -> plan
        function d3ToPlan(v) { const x = v.x, y = v.y; return { x: mmToWorld(x * 1000), y: -mmToWorld(y * 1000), z: Math.round(((v.z / (V3.exag || 1)) + (V3.zmin || 0)) * 1000 * 10) / 10 }; }
        const D3_KIND = { end: ['Extrémité', '#facc15', 'sq'], mid: ['Milieu', '#facc15', 'tri'], face: ['Sur la surface', '#38bdf8', 'circ'], plan: ['Sur le plan de travail', '#9ca3af', 'cross'], axis: ['Dans l\'axe', '#f472b6', 'cross'], int: ['Intersection', '#fb923c', 'x'], cl: ['Sur le trait de construction', '#22d3ee', 'cross'], typed: ['Longueur tapée', '#f472b6', 'cross'] };
        // point sous la souris : accroche la plus proche (14 px), sinon la surface d'un volume, sinon le plan de travail horizontal
        function d3Point(e) {
            const cv = V3.renderer.domElement, r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, W = r.width, H = r.height;
            const off = V3.root.position; let best = null, bd = 14;
            for (const c of (V3.clSnaps || []).concat(V3.snaps)) { const w = c.v.clone().add(off).project(V3.camera); if (w.z > 1 || w.z < -1) continue; const d = Math.hypot((w.x + 1) / 2 * W - mx, (1 - w.y) / 2 * H - my); if (d < bd) { bd = d; best = c; } }
            if (best) return { v: best.v.clone(), k: best.k };
            const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(mx / W * 2 - 1, -my / H * 2 + 1), V3.camera);
            {   // près d'un trait de construction : le point du trait le plus proche du rayon de la souris
                let bc = null, bdc = 10; (V3.cl && V3.cl.visible === false ? [] : D3C.lines).forEach(L => { const [o, d] = d3ClScene(L), O = o.clone().add(off), q = new THREE.Vector3();
                    ray.ray.distanceSqToSegment(O.clone().addScaledVector(d, -1e5), O.clone().addScaledVector(d, 1e5), null, q);
                    const w = q.clone().project(V3.camera), dd = Math.hypot((w.x + 1) / 2 * W - mx, (1 - w.y) / 2 * H - my); if (w.z <= 1 && dd < bdc) { bdc = dd; bc = q.sub(off); } });
                if (bc) return { v: bc, k: 'cl' }; }
            if (D3.workZ === null && !D3.plane) { const hit = ray.intersectObjects(V3.root.children, true).find(h => h.object.isMesh && h.object.userData && h.object.userData.shape); if (hit) { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : null; return { v: hit.point.clone().sub(off), k: 'face', n }; } }
            if (D3.plane) { const pp = new THREE.Plane().setFromNormalAndCoplanarPoint(D3.plane.n, D3.plane.o.clone().add(off)), q2 = new THREE.Vector3(); if (ray.ray.intersectPlane(pp, q2)) return { v: q2.sub(off), k: 'plan' }; }
            const z = D3.workZ !== null ? D3.workZ : D3.pts.length ? D3.pts[D3.pts.length - 1].z : 0, pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), q = new THREE.Vector3();
            if (ray.ray.intersectPlane(pl, q)) return { v: q.sub(off), k: 'plan' };
            return null;
        }
        // Maj : verrouillage sur l'axe X, Y ou Z le plus proche du mouvement
        function d3Lock(p, e) {
            const a = D3.pts[D3.pts.length - 1]; if (!a || !e.shiftKey || !p) return p;
            const d = p.v.clone().sub(a), ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z), v = a.clone();
            if (ax >= ay && ax >= az) v.x += d.x; else if (ay >= az) v.y += d.y; else v.z += d.z;
            return { v, k: 'axis' };
        }
        // rectangle dans le plan d'une face : côtés horizontal et « dans la pente »
        function d3PlaneRect(a, b) {
            const n = D3.plane.n, u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), n); if (u.length() < 1e-6) u.set(1, 0, 0); u.normalize();
            const w = new THREE.Vector3().crossVectors(n, u).normalize(), d = b.clone().sub(a), du = d.dot(u), dv = d.dot(w);
            return [a.clone(), a.clone().addScaledVector(u, du), a.clone().addScaledVector(u, du).addScaledVector(w, dv), a.clone().addScaledVector(w, dv)];
        }
        function d3Mark(p) {
            let m = document.getElementById('v3-snap'); const host = document.getElementById('view3d');
            if (!m && host) { m = document.createElement('div'); m.id = 'v3-snap'; m.style.cssText = 'position:absolute;pointer-events:none;z-index:5;display:none;'; host.appendChild(m); }
            if (!m) return; if (!p || !V3) { m.style.display = 'none'; return; }
            const cv = V3.renderer.domElement, w = p.v.clone().add(V3.root.position).project(V3.camera), x = (w.x + 1) / 2 * cv.clientWidth, y = (1 - w.y) / 2 * cv.clientHeight;
            const [lab, col, sh] = D3_KIND[p.k] || D3_KIND.plan, P = d3ToPlan(p.v);
            const ico = sh === 'sq' ? `<rect x="3" y="3" width="12" height="12" fill="none" stroke="${col}" stroke-width="2"/>` : sh === 'tri' ? `<path d="M9 2 L16 15 L2 15 Z" fill="none" stroke="${col}" stroke-width="2"/>` : sh === 'circ' ? `<circle cx="9" cy="9" r="6" fill="none" stroke="${col}" stroke-width="2"/>` : sh === 'x' ? `<path d="M3 3L15 15M15 3L3 15" stroke="${col}" stroke-width="2.4"/>` : `<path d="M9 2v14M2 9h14" stroke="${col}" stroke-width="2"/>`;
            m.innerHTML = `<svg width="18" height="18" style="position:absolute;left:-9px;top:-9px;overflow:visible">${ico}</svg><div style="position:absolute;left:12px;top:8px;white-space:nowrap;font:600 11px system-ui;color:${col};background:rgba(17,24,39,.85);border-radius:4px;padding:1px 6px">${lab} · Z ${fmtZ(P.z)}</div>`;
            m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.display = 'block';
        }
        // élastique : ce qui est en cours de tracé
        function d3Rubber() {
            if (!V3.tmp) { V3.tmp = new THREE.Group(); V3.scene.add(V3.tmp); } V3.tmp.clear(); V3.tmp.position.copy(V3.root.position);
            const L = D3.pts.concat(D3.cur ? [D3.cur.v] : []); if (!L.length) return;
            let pts = L;
            if (mode === 'rect' && L.length === 2 && D3.plane) { const C = d3PlaneRect(L[0], L[1]); pts = C.concat([C[0]]); }
            else if (mode === 'rect' && L.length === 2) { const a = L[0], b = L[1]; pts = [a, new THREE.Vector3(b.x, a.y, a.z), new THREE.Vector3(b.x, b.y, a.z), new THREE.Vector3(a.x, b.y, a.z), a]; }
            if (mode === 'circle' && L.length === 2) { const c = L[0], R = Math.hypot(L[1].x - c.x, L[1].y - c.y); pts = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * 2 * Math.PI; pts.push(new THREE.Vector3(c.x + R * Math.cos(t), c.y + R * Math.sin(t), c.z)); } }
            if (mode === 'cline' && L.length === 2) { const d = d3ClDir(L[0], L[1], D3.cur && D3.cur.k); if (d) { const B = Math.max(5, (V3.R || 50) * 3); pts = [L[0].clone().addScaledVector(d, -B), L[0].clone().addScaledVector(d, B)]; } }
            if (pts.length > 1) { const g = new THREE.BufferGeometry().setFromPoints(pts); V3.tmp.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xec4899, depthTest: false }))); }
            if ((mode === 'move' || mode === 'copy' || mode === 'measure') && L.length === 2) d3Msg(L[0], L[1]);
        }
        function d3Msg(a, b) {
            const A = d3ToPlan(a), B = d3ToPlan(b), dx = (worldToMm(B.x) - worldToMm(A.x)) / 1000, dy = -(worldToMm(B.y) - worldToMm(A.y)) / 1000, dz = (B.z - A.z) / 1000, dh = Math.hypot(dx, dy);
            return 'distance ' + nfr(Math.hypot(dh, dz), 3) + ' m · ΔX ' + nfr(dx, 3) + ' · ΔY ' + nfr(dy, 3) + ' · ΔZ ' + nfr(dz, 3) + ' m' + (dh > 1e-6 ? ' · pente ' + nfr(dz / dh * 100, 1) + ' %' : '');
        }
        function d3Hover(e) {
            if (!d3Active()) { d3Mark(null); return; }
            const p = d3Lock(d3Point(e), e); D3.cur = p; d3Mark(p); d3Rubber(); render3D();
            if (p && D3.pts.length && (mode === 'measure' || mode === 'move' || mode === 'copy' || mode === 'line' || mode === 'pline')) updateCommandMessageText(D3_TIP[mode] + ' — ' + d3Msg(D3.pts[D3.pts.length - 1], p.v));
        }
        const D3_TIP = { cline: 'TRAIT DE CONSTRUCTION : cliquez un 2e point (accroché = passe par lui ; sinon il suit l\'axe X, Y ou Z le plus proche), ou tapez X, Y ou Z', line: 'DROITE 3D : cliquez le point suivant (Maj = dans l\'axe X, Y ou Z ; Échap pour finir)', pline: 'POLYLIGNE 3D : cliquez les points ; Entrée, Espace ou double-clic pour finir, clic sur le 1er point pour fermer', rect: 'RECTANGLE 3D : cliquez le coin opposé (à la hauteur du 1er coin)', circle: 'CERCLE 3D : cliquez un point du bord (à la hauteur du centre)', measure: 'MESURER 3D', move: 'DÉPLACER 3D : cliquez le point d\'arrivée', copy: 'COPIER 3D : cliquez le point d\'arrivée' };
        function d3Start() {
            const t = { cline: 'TRAIT DE CONSTRUCTION : cliquez le point par où il passe (sommet, milieu, intersection…).', line: 'DROITE 3D : cliquez le 1er point — il s\'accroche aux sommets, milieux et surfaces des volumes.', pline: 'POLYLIGNE 3D : cliquez le 1er point.', rect: (solidTool === 'box' ? 'PAVÉ' : 'RECTANGLE') + ' 3D : cliquez le 1er coin (sur une face, un sommet ou le sol).', circle: (solidTool === 'cyl' ? 'CYLINDRE' : 'CERCLE') + ' 3D : cliquez le centre.', measure: 'MESURER 3D : cliquez le 1er point.', move: 'DÉPLACER 3D : cliquez le point de base.', copy: 'COPIER 3D : cliquez le point de base.' }[mode];
            if ((mode === 'move' || mode === 'copy') && !selectedShapes.length) { updateCommandMessageText((mode === 'move' ? 'DÉPLACER' : 'COPIER') + ' 3D : sélectionnez d\'abord les objets (clic dans la vue 3D, Maj pour en ajouter), puis l\'outil.'); return; }
            if (t) updateCommandMessageText(t);
        }
        function d3Click(e) {
            const p = e.__pt || d3Lock(d3Point(e), e); if (!p) return;
            const v = p.v.clone(), n = D3.pts.length;
            if (mode === 'pline' && n >= 2 && v.distanceTo(D3.pts[0]) < 1e-6) { d3Finish(true); return; }
            if (mode === 'cline') { if (!n) { D3.pts = [v]; updateCommandMessageText(D3_TIP.cline + '.'); } else { const d = d3ClDir(D3.pts[0], v, p.k); if (d) d3ClAdd(D3.pts[0], d); D3.pts = []; } d3Rubber(); render3D(); return; }
            if (!n && p.k === 'face' && p.n && Math.abs(p.n.z) < 0.98 && ['line', 'pline', 'rect'].includes(mode) && !solidTool) { D3.plane = { n: p.n.clone(), o: v.clone() }; updateCommandMessageText(D3_TIP[mode] + ' — plan de travail : la face ' + (Math.abs(p.n.z) < 0.02 ? 'verticale' : 'inclinée') + ' cliquée.'); }
            D3.pts.push(v); if (D3.workZ === null && !D3.plane && mode !== 'line' && mode !== 'pline' && mode !== 'measure' && mode !== 'move' && mode !== 'copy') D3.workZ = v.z;
            const add = (sh) => { sh.layerId = activeLayerId; shapes.push(sh); saveState(); build3DScene(); };
            const W = (q) => d3ToPlan(q);
            if (mode === 'line' && D3.pts.length === 2) { const a = W(D3.pts[0]), b = W(D3.pts[1]); add({ type: 'line', x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z }); D3.pts = [v]; }
            else if (mode === 'rect' && D3.pts.length === 2 && D3.plane) { const C = d3PlaneRect(D3.pts[0], D3.pts[1]); add({ type: 'poly', points: C.map(q => { const w = W(q); return { x: w.x, y: w.y, z: w.z }; }) }); D3.pts = []; D3.plane = null; updateCommandMessageText('RECTANGLE 3D posé sur la face. Cliquez le 1er coin du suivant, ou Échap.'); }
            else if (mode === 'rect' && D3.pts.length === 2) { const a = D3.pts[0], b = D3.pts[1], z = W(a).z, Q = [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]].map(([x, y]) => { const q = W(new THREE.Vector3(x, y, a.z)); return { x: q.x, y: q.y, z }; });
                add({ type: 'poly', points: Q }); D3.pts = []; D3.workZ = null; updateCommandMessageText((solidTool === 'box' ? 'PAVÉ' : 'RECTANGLE') + ' 3D posé à Z ' + fmtZ(z) + '. Cliquez le 1er coin du suivant, ou Échap.' + (solidTool === 'box' ? ' Hauteur : Y sur l\'objet.' : '')); }
            else if (mode === 'circle' && D3.pts.length === 2) { const c = D3.pts[0], q = W(c), R = Math.hypot(D3.pts[1].x - c.x, D3.pts[1].y - c.y); add({ type: 'circle', x: q.x, y: q.y, z: q.z, r: mmToWorld(R * 1000) }); D3.pts = []; D3.workZ = null; updateCommandMessageText((solidTool === 'cyl' ? 'CYLINDRE' : 'CERCLE') + ' 3D posé (rayon ' + nfr(R, 3) + ' m). Cliquez le centre du suivant, ou Échap.'); }
            else if (mode === 'measure' && D3.pts.length === 2) { window.d3Measured = (window.d3Measured || 0) + 1; updateCommandMessageText('MESURE 3D : ' + d3Msg(D3.pts[0], D3.pts[1]) + '. Cliquez un nouveau 1er point.'); D3.pts = []; }
            else if ((mode === 'move' || mode === 'copy') && D3.pts.length === 2) {
                const a = W(D3.pts[0]), b = W(D3.pts[1]), dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                let S = selectedShapes.slice(); if (mode === 'copy') { S = S.map(x => JSON.parse(JSON.stringify(x))); S.forEach(x => { delete x.groupId; }); shapes.push(...S); }
                S.forEach(x => { translateShape(x, dx, dy); if (Math.abs(dz) > 1e-6 && !shiftZ(x, dz)) { if (x.type === 'poly') x.points.forEach(q => { q.z = dz; }); else if (x.type === 'line') { x.z1 = dz; x.z2 = dz; } else x.z = dz; } });
                invalidateCache(); const msg = (mode === 'move' ? 'DÉPLACÉ' : 'COPIÉ') + ' : ' + d3Msg(D3.pts[0], D3.pts[1]) + '.'; D3.pts = []; saveState(); build3DScene();
                if (mode === 'copy') { selectedShapes = S; updateCommandMessageText(msg + ' Cliquez un nouveau point de base pour recopier, ou Échap.'); } else { setMode('select-box'); updateCommandMessageText(msg); }
            }
            else if (n === 0 && !D3.plane) updateCommandMessageText(D3_TIP[mode] + '.');
            d3Rubber(); render3D();
        }
        // ---- traits de construction : droites infinies, hors calques, jamais enregistrées ----
        // stockées en mètres réels (x, y du repère de la scène, z = altitude réelle), direction unitaire en réel
        // traits de construction : de vrais objets du plan (type 'cline', sans calque, ni imprimés ni exportés) ; D3C.lines en donne la vue « scène »
        const isCL = (s) => !!s && s.type === 'cline';
        const D3C = {};
        Object.defineProperty(D3C, 'lines', { get() { return shapes.filter(isCL).map(s => ({ p: { x: worldToMm(s.x) / 1000, y: -worldToMm(s.y) / 1000, z: 0 }, d: { x: s.ux, y: -s.uy, z: 0 }, s })); },
            set(v) { if (!v || !v.length) { const n = shapes.length; shapes = shapes.filter(x => !isCL(x)); selectedShapes = selectedShapes.filter(x => !isCL(x)); if (shapes.length !== n) saveState(); } } });
        function clMake(x, y, ux, uy) { const L = Math.hypot(ux, uy) || 1; return { type: 'cline', gen: 'cline', x, y, ux: ux / L, uy: uy / L }; }
        function d3ClScene(L) { const ex = V3.exag || 1, zm = V3.zmin || 0; const o = new THREE.Vector3(L.p.x, L.p.y, (L.p.z - zm) * ex), d = new THREE.Vector3(L.d.x, L.d.y, L.d.z * ex).normalize(); return [o, d]; }
        function d3ClDir(a, b, k) {
            const ex = V3.exag || 1, r = new THREE.Vector3(b.x - a.x, b.y - a.y, (b.z - a.z) / ex); if (r.length() < 1e-9) return null;
            if (k === 'end' || k === 'mid' || k === 'int' || k === 'typed') return new THREE.Vector3(r.x, r.y, r.z * ex).normalize();   // passe par le point accroché
            const ax = Math.abs(r.x), ay = Math.abs(r.y), az = Math.abs(r.z); return new THREE.Vector3(ax >= ay && ax >= az ? 1 : 0, ay > ax && ay >= az ? 1 : 0, az > ax && az > ay ? 1 : 0);
        }
        function d3ClAdd(a, dScene) {
            const ex = V3.exag || 1, zm = V3.zmin || 0, d = new THREE.Vector3(dScene.x, dScene.y, dScene.z / ex).normalize();
            D3C.lines.push({ p: { x: a.x, y: a.y, z: a.z / ex + zm }, d: { x: d.x, y: d.y, z: d.z } });
            d3ClBuild(); const ax = Math.abs(d.z) > 0.999 ? 'vertical' : Math.abs(d.z) < 1e-6 ? (Math.abs(d.x) > 0.999 ? 'selon X' : Math.abs(d.y) > 0.999 ? 'selon Y' : 'horizontal') : 'incliné';
            updateCommandMessageText('TRAIT DE CONSTRUCTION ' + ax + ' posé (' + D3C.lines.length + ' au total). Cliquez le point du suivant ; Suppr efface tout ; Échap pour finir.');
        }
        function d3ClClear() { D3C.lines = []; d3ClBuild(); if (typeof cl2Cache !== 'undefined') cl2Cache = null; updateCommandMessageText('Traits de construction effacés.'); try { cl2Chip(); draw(); } catch (e) {} }
        // pastille sur le plan dès qu'il existe des traits de construction : un clic les efface tous, quel que soit l'outil
        function cl2Chip() { const c = document.getElementById('cl2-chip'); if (!c) return; const n = D3C.lines.length; c.style.display = n ? 'flex' : 'none'; c.querySelector('span').textContent = n + ' trait' + (n > 1 ? 's' : '') + ' de construction'; }
        // dessin des traits + points d'accroche : croisements entre traits, et avec les volumes
        function d3ClBuild() {
            const n = document.getElementById('v3-cl-n'); if (n) n.textContent = D3C.lines.length;
            if (!V3 || !window.THREE) { try { draw(); } catch (e) {} return; }
            if (!V3.cl) { V3.cl = new THREE.Group(); V3.scene.add(V3.cl); } V3.cl.clear(); V3.cl.position.copy(V3.root ? V3.root.position : new THREE.Vector3());
            const big = Math.max(5, (V3.R || 50) * 3), out = [], off = V3.cl.position;
            const S = D3C.lines.map(d3ClScene);
            S.forEach(([o, d]) => { const g = new THREE.BufferGeometry().setFromPoints([o.clone().addScaledVector(d, -big), o.clone().addScaledVector(d, big)]); const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x22d3ee, depthTest: false, depthWrite: false, transparent: true, opacity: 0.8 })); ln.renderOrder = 999; ln.frustumCulled = false; V3.cl.add(ln); });
            // croisements traits × traits
            for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
                const [o1, d1] = S[i], [o2, d2] = S[j], w = o1.clone().sub(o2), b = d1.dot(d2), dd = d1.dot(w), e = d2.dot(w), den = 1 - b * b; if (den < 1e-9) continue;
                const t = (b * e - dd) / den, u = (e - b * dd) / den, p1 = o1.clone().addScaledVector(d1, t), p2 = o2.clone().addScaledVector(d2, u);
                if (p1.distanceTo(p2) < 1e-4) out.push({ v: p1, k: 'int' });
            }
            // croisements traits × volumes (entrées et sorties)
            const meshes = []; if (V3.root) V3.root.traverse(o => { if (o.isMesh && o.userData && o.userData.shape) meshes.push(o); });
            S.forEach(([o, d]) => { const rc = new THREE.Raycaster(o.clone().add(off).addScaledVector(d, -big), d, 0, 2 * big); rc.intersectObjects(meshes, false).forEach(h => out.push({ v: h.point.clone().sub(off), k: 'int' })); });
            V3.clSnaps = out.slice(0, 5000);
            const b = document.getElementById('v3-cl-btn'); if (b) b.style.boxShadow = mode === 'cline' ? '0 0 0 2px #22d3ee' : '';
            render3D(); try { draw(); } catch (e) {}
        }
        // dans le plan 2D : les traits non verticaux en tirets cyan, les verticaux en petit viseur
        /* droite infinie : tracée seulement sur la partie visible du canevas (une droite de 20 000 km en tirets coûtait des dizaines de ms à chaque image) ; motif des tirets accroché au point de la droite */
        function clStrokeInf(c, x, y, ux, uy, period) { let M; try { M = c.getTransform().invertSelf(); } catch (e) { M = null; } const W = c.canvas.width, H = c.canvas.height;
            let t0 = -1e7, t1 = 1e7; if (M) { const C = [[0, 0], [W, 0], [W, H], [0, H]].map(([a, b]) => ({ x: M.a * a + M.c * b + M.e, y: M.b * a + M.d * b + M.f })), T = C.map(q => (q.x - x) * ux + (q.y - y) * uy); t0 = Math.min(...T); t1 = Math.max(...T);
                const nx = -uy, ny = ux, D = C.map(q => (q.x - x) * nx + (q.y - y) * ny); if (Math.min(...D) > 0 || Math.max(...D) < 0) return; }
            if (period > 0) c.lineDashOffset = -(((t0 % period) + period) % period) + period;
            c.beginPath(); c.moveTo(x + ux * t0, y + uy * t0); c.lineTo(x + ux * t1, y + uy * t1); c.stroke(); c.lineDashOffset = 0; }
        function drawCLines(c) {
            if (mode !== 'cline2') return;   // aperçu : le trait qui serait posé sur l'arête survolée (Maj : la perpendiculaire au point)
            const ed = cl2Edge({ x: currentX, y: currentY }); if (!ed) return; const sh = !!window.__shiftDown;
            const sn = sh && typeof findSnap === 'function' ? findSnap(currentX, currentY) : null, q = sh ? (sn || { x: currentX, y: currentY }) : ed.base, d = sh ? { x: -ed.dir.y, y: ed.dir.x } : ed.dir;
            c.save(); c.strokeStyle = 'rgba(34,211,238,.55)'; c.lineWidth = 1 / camera.zoom; c.setLineDash([3 / camera.zoom, 4 / camera.zoom]);
            const dl = Math.hypot(d.x, d.y) || 1; clStrokeInf(c, q.x, q.y, d.x / dl, d.y / dl, 7 / camera.zoom); c.restore();
        }
        window.addEventListener('keydown', e => { if (e.key === 'Shift') { window.__shiftDown = true; if (mode === 'cline2') draw(); } });
        window.addEventListener('keyup', e => { if (e.key === 'Shift') { window.__shiftDown = false; if (mode === 'cline2') draw(); } });
        function drawCLine2D(c, s, sel, dx, dy, ls) {
            const x = s.x + dx, y = s.y + dy; c.save(); c.strokeStyle = sel ? '#ec4899' : 'rgba(34,211,238,.8)'; c.lineWidth = (sel ? 2 : 1) / ls; c.setLineDash([8 / ls, 5 / ls]);
            clStrokeInf(c, x, y, s.ux, s.uy, 13 / ls); c.restore();
        }
        // ---- TRAIT DE CONSTRUCTION (plan) : cliquer une arête, puis chaque clic pose une parallèle infinie ----
        const CL2 = { dir: null, base: null, typed: '' }; let cl2Cache = null;
        function cl2Edge(w) {   // arête sous le curseur : segment de droite / polyligne / hachure, ou un trait de construction
            const t = findShapeAt(w.x, w.y); let best = null, bd = Infinity;
            const seg = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; if (L2 < 1e-12) return; let u = ((w.x - a.x) * dx + (w.y - a.y) * dy) / L2; u = Math.max(0, Math.min(1, u)); const d = Math.hypot(a.x + u * dx - w.x, a.y + u * dy - w.y); if (d < bd) { bd = d; best = { a, b }; } };
            if (t) { if (t.type === 'line' || t.type === 'dim') seg({ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }); else if (t.type === 'poly') for (let i = 0; i < t.points.length - (t.open ? 1 : 0); i++) seg(t.points[i], t.points[(i + 1) % t.points.length]); else if (t.type === 'hatch') t.loops.forEach(l => l.forEach((q, i) => seg(q, l[(i + 1) % l.length]))); }
            if (!best) { const vis = (x) => { const l = layers.find(q => q.id === (x.layerId || 'layer-0')); return !l || l.visible !== false; };
                for (const x of shapes) { if (!vis(x) || x.type === 'bgimage' || x.type === 'basemap') continue;
                    if (x.type === 'line' || x.type === 'dim') seg({ x: x.x1, y: x.y1 }, { x: x.x2, y: x.y2 }); else if (x.type === 'poly' && x.points) for (let i = 0; i < x.points.length - (x.open ? 1 : 0); i++) seg(x.points[i], x.points[(i + 1) % x.points.length]); else if (x.type === 'hatch' && x.loops) x.loops.forEach(l => l.forEach((q, i) => seg(q, l[(i + 1) % l.length]))); }
                if (bd * camera.zoom > 12) { best = null; bd = Infinity; } }
            if (!best) D3C.lines.forEach(L => { if (Math.hypot(L.d.x, L.d.y) < 1e-6) return; const x = mmToWorld(L.p.x * 1000), y = -mmToWorld(L.p.y * 1000), dx = L.d.x, dy = -L.d.y, d = Math.abs((w.x - x) * dy - (w.y - y) * dx) / Math.hypot(dx, dy);
                if (d * camera.zoom < 8 && d < bd) { bd = d; best = { a: { x, y }, b: { x: x + dx, y: y + dy } }; } });
            if (!best || bd * camera.zoom > 12) return null;
            const L = Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y); return { base: best.a, dir: { x: (best.b.x - best.a.x) / L, y: (best.b.y - best.a.y) / L } };
        }
        function cl2Add(px, py, dir) { const d = dir || CL2.dir; shapes.push(clMake(px, py, d.x, d.y)); cl2Cache = null; saveState(); try { d3ClBuild(); } catch (e) {} cl2Chip(); draw();
            updateCommandMessageText('TRAIT DE CONSTRUCTION : trait posé (' + D3C.lines.length + ' au total). Cliquez une autre arête (Maj + clic = perpendiculaire au point), ou Échap. Décaler (DE) crée une parallèle à une distance ; Ctrl + clic sur un trait l\'efface.'); }
        function cl2LineAt(w) {   // trait de construction sous le curseur (indice)
            let bi = -1, bd = Infinity; D3C.lines.forEach((L, i) => { const x = mmToWorld(L.p.x * 1000), y = -mmToWorld(L.p.y * 1000), dx = L.d.x, dy = -L.d.y, h = Math.hypot(dx, dy);
                const d = h < 1e-6 ? Math.hypot(w.x - x, w.y - y) : Math.abs((w.x - x) * dy - (w.y - y) * dx) / h; if (d < bd) { bd = d; bi = i; } });
            return bd * camera.zoom <= 8 ? bi : -1;
        }
        function cl2Erase(i) { if (i < 0) return; const L = shapes.filter(isCL), t = L[i]; shapes = shapes.filter(x => x !== t); selectedShapes = selectedShapes.filter(x => x !== t); saveState(); cl2Cache = null; try { d3ClBuild(); } catch (e) {} updateCommandMessageText('Trait de construction effacé (' + D3C.lines.length + ' restant' + (D3C.lines.length > 1 ? 's' : '') + '). Ctrl + clic sur un autre pour l\'effacer, Suppr pour tout effacer.'); cl2Chip(); draw(); }
        function cl2Click(w, e) {
            if (e && (e.ctrlKey || e.metaKey)) { const i = cl2LineAt(w); if (i >= 0) cl2Erase(i); else updateCommandMessageText('TRAIT DE CONSTRUCTION : Ctrl + clic SUR un trait pour l\'effacer.'); return; }
            const ed = cl2Edge(w); if (!ed) { updateCommandMessageText('TRAIT DE CONSTRUCTION : cliquez une arête (droite, côté de polyligne, de dalle ou de mur, autre trait).'); return; }
            if (e && e.shiftKey) { const sn = findSnap(w.x, w.y), q = sn || w; cl2Add(q.x, q.y, { x: -ed.dir.y, y: ed.dir.x }); updateCommandMessageText('TRAIT DE CONSTRUCTION : perpendiculaire posée (' + D3C.lines.length + ' au total). Clic sur une arête = trait dans son alignement ; Maj + clic = perpendiculaire au point.'); }
            else cl2Add(ed.base.x, ed.base.y, ed.dir);
        }
        function cl2Key(e) {
            if (mode !== 'cline2') return false;
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); d3ClClear(); cl2Cache = null; return true; }
            if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); setMode('select-box'); return true; }
            return false;
        }
        window.addEventListener('keydown', e => { if (is3DOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return; if (cl2Key(e)) e.stopImmediatePropagation(); }, true);
        // =====================================================================
        // TRAIT DE COUPE : 2 clics pour la ligne, 1 clic pour le côté regardé ; la coupe (volumes coupés hachurés + terrain)
        // est dessinée sous le plan, sur le calque « Coupes », groupée et déplaçable.
        // =====================================================================
        const CUT = { a: null, b: null };
        /* VUE DE FAÇADE : même outil que la coupe, mais la ligne est tracée devant la façade, rien n'est coupé ; on voit tout ce qui est derrière, en traits,
           le terrain pris au pied de la façade, les niveaux des toitures et des dalles. Nom selon l'orientation (Façade sud…). */
        const secLab = (d) => d && d.fac ? 'Façade ' + d.name : 'Coupe ' + (d ? d.name + '-' + d.name : '');
        const secLabU = (d) => d && d.fac ? 'FAÇADE ' + String(d.name).toUpperCase() : 'COUPE ' + (d ? d.name + '-' + d.name : '');
        function facName(vx, vy) { const a = Math.atan2(-vx, -vy) * 180 / Math.PI, k = Math.round(((a % 360) + 360) % 360 / 45) % 8; return ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][k]; }   /* la façade regarde vers celui qui la voit */
        function cutLayerId() { let l = layers.find(x => x.name === 'Coupes'); if (!l) { l = { id: generateId(), name: 'Coupes', visible: true, color: '#f472b6', dash: 'solid', width: 1 }; layers.push(l); updateLayerUI(); } return l.id; }
        // 1. la ligne (2 clics) ; 2. la fenêtre de la coupe suit la souris, un clic la pose (re-cliquer la replace) ; 3. Valider (Entrée ou bouton).
        //    Pendant ce temps : Tab ou ⇄ inverse le sens de vue (flèches dans le plan), Échap annule.
        function cutClick(w) {
            const sn = findSnap(w.x, w.y), q = sn ? { x: sn.x, y: sn.y } : { x: w.x, y: w.y };
            const F = mode === 'facade', W0 = F ? 'FAÇADE' : 'COUPE';
            if (!CUT.a) { CUT.a = q; CUT.side = 1; CUT.pos = null; CUT.D = null; CUT.fac = F; updateCommandMessageText(F ? 'FAÇADE : cliquez le 2e point de la ligne, tracée devant la façade (elle en donne la largeur).' : 'COUPE : cliquez le 2e point de la ligne de coupe.'); draw(); return; }
            if (!CUT.b) { if (Math.hypot(q.x - CUT.a.x, q.y - CUT.a.y) < 1e-6) return; CUT.b = q; CUT.fac = F; if (F && window.THREE) CUT.side = facSide(CUT.a, CUT.b) || 1;   /* façade : regarder vers l'ouvrage le plus proche de la ligne */ CUT.D = sectionData(CUT.a, CUT.b, CUT.side, F);
                if (!CUT.D) { CUT.a = CUT.b = null; updateCommandMessageText(F ? 'FAÇADE : rien à voir depuis cette ligne. Tracez-la devant la façade, face au bâtiment.' : 'COUPE : la ligne ne coupe aucun volume ni terrain. Tracez-la à travers les murs, dalles, toitures…'); draw(); return; }
                cutBar(true); updateCommandMessageText(secLabU(CUT.D) + ' : placez la fenêtre (elle suit la souris), cliquez pour la poser, puis Valider (Entrée). Tab ou ⇄ : inverser le sens de vue ; Échap : annuler.'); draw(); return; }
            CUT.pos = { x: w.x, y: w.y }; cutBar(true); draw();
            updateCommandMessageText(secLabU(CUT.D) + ' posée : Valider (Entrée) ; cliquez ailleurs pour la déplacer ; Tab ou ⇄ : inverser le sens ; Échap : annuler.');
        }
        function cutReset() { CUT.a = CUT.b = CUT.pos = CUT.D = null; CUT.side = 1; CUT.fac = false; cutBar(false); }
        function cutFlip() { if (!CUT.b) return; CUT.side = -(CUT.side || 1); CUT.D = sectionData(CUT.a, CUT.b, CUT.side, CUT.fac); cutBar(true); draw(); }
        function cutValidate() { if (!CUT.b || !CUT.D) return; const at = CUT.pos || { x: currentX, y: currentY }, D = CUT.D; cutReset(); sectionPlace(D, at); }
        // coin haut-gauche de la coupe pour que la fenêtre soit centrée sur le point donné
        function cutOrigin(D, at) { return { x: at.x - mmToWorld(D.u1 - D.u0) / 2, y: at.y - mmToWorld(D.z1 - D.z0) / 2 + mmToWorld(D.z1 - D.z0) }; }
        function cutBar(on) { let b = document.getElementById('cut-bar'); if (!on) { if (b) b.style.display = 'none'; return; }
            if (!b) { b = document.createElement('div'); b.id = 'cut-bar'; b.style.cssText = 'position:fixed;z-index:45;display:flex;gap:6px;align-items:center;background:#111827;border:1px solid #f472b6;border-radius:8px;padding:6px 8px;font:13px Arial;color:#e5e7eb;box-shadow:0 4px 14px rgba(0,0,0,.5)'; document.body.appendChild(b); }
            const btn = (t, js, main, tip) => `<button type="button" onclick="${js}" title="${tip}" style="padding:5px 10px;border-radius:6px;border:1px solid ${main ? '#f472b6' : '#4b5563'};background:${main ? '#be185d' : '#374151'};color:#fff;cursor:pointer">${t}</button>`;
            b.innerHTML = `<b style="color:#f9a8d4">${CUT.D ? secLab(CUT.D) : CUT.fac ? 'Façade' : 'Coupe'}</b><span style="color:#9ca3af">${CUT.pos ? 'posée' : 'suit la souris'}</span>` + btn('⇄ Inverser le sens', 'cutFlip()', false, 'Regarder de l\'autre côté de la ligne (Tab)') + btn('✔ Valider', 'cutValidate()', true, 'Dessiner la vue à cet endroit (Entrée)') + btn('✖ Annuler', 'cutReset();draw();updateCommandMessageText(\'Annulé. Cliquez le 1er point d\\\'une nouvelle ligne.\')', false, 'Échap');
            const R = canvas.getBoundingClientRect(); b.style.display = 'flex'; b.style.left = (R.left + (R.width - b.offsetWidth) / 2) + 'px'; b.style.top = (R.top + 12) + 'px'; }   // en haut de la zone de dessin : la fenêtre de coupe se place le plus souvent dessous
        function cutKey(e) { if ((mode !== 'cut' && mode !== 'facade') || !CUT.b) return false;
            if (e.key === 'Enter') { e.preventDefault(); cutValidate(); return true; }
            if (e.key === 'Tab') { e.preventDefault(); cutFlip(); return true; }
            if (e.key === 'Escape') { e.preventDefault(); cutReset(); draw(); updateCommandMessageText('Annulé. Cliquez le 1er point d\'une nouvelle ligne.'); return true; }
            return false; }
        window.addEventListener('keydown', e => { if (is3DOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return; if (cutKey(e)) e.stopImmediatePropagation(); }, true);
        function cutPreview(c) {
            if (mode !== 'cut' && mode !== 'facade') { if (CUT.a) cutReset(); return; } if (!CUT.a) return; const A = CUT.a, B = CUT.b || { x: currentX, y: currentY }, z = camera.zoom;
            c.save(); c.strokeStyle = '#f472b6'; c.lineWidth = 2 / z; c.setLineDash([10 / z, 4 / z, 2 / z, 4 / z]);
            c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke(); c.setLineDash([]);
            if (CUT.b) { const L = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L, sd = CUT.side || 1, k = 28 / z;
                [A, B].forEach(P => { c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x + nx * k * sd, P.y + ny * k * sd); c.stroke(); c.beginPath(); c.moveTo(P.x + nx * k * sd + ny * 6 / z - nx * sd * 8 / z, P.y + ny * k * sd - nx * 6 / z - ny * sd * 8 / z); c.lineTo(P.x + nx * k * sd, P.y + ny * k * sd); c.lineTo(P.x + nx * k * sd - ny * 6 / z - nx * sd * 8 / z, P.y + ny * k * sd + nx * 6 / z - ny * sd * 8 / z); c.stroke(); });
                // la fenêtre de la coupe, en direct, centrée sur la souris (ou là où elle a été posée)
                const D = CUT.D; if (D) { const o = cutOrigin(D, CUT.pos || { x: currentX, y: currentY }), Wp = (q) => ({ x: o.x + mmToWorld(q[0] - D.u0), y: o.y - mmToWorld(q[1] - D.z0) }), F = cutFrame(D, o);
                    c.fillStyle = 'rgba(17,24,39,0.55)'; c.fillRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0); c.strokeStyle = CUT.pos ? '#f472b6' : '#f9a8d4'; c.lineWidth = 1.5 / z; c.setLineDash(CUT.pos ? [] : [6 / z, 4 / z]); c.strokeRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0); c.setLineDash([]);
                    c.fillStyle = 'rgba(244,114,182,0.25)'; c.strokeStyle = '#fbcfe8'; c.lineWidth = 1.2 / z;
                    D.loops.forEach(({ loop }) => { c.beginPath(); loop.forEach((q, i) => { const p = Wp(q); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath(); c.fill(); c.stroke(); });
                    if (D.beyond && D.beyond.length) { c.strokeStyle = 'rgba(253,242,248,.75)'; c.lineWidth = 0.8 / z; c.beginPath(); D.beyond.forEach(b => { const p = Wp([b[0], b[1]]), q2 = Wp([b[2], b[3]]); c.moveTo(p.x, p.y); c.lineTo(q2.x, q2.y); }); c.stroke(); c.lineWidth = 1.2 / z; }   /* vue au-delà (façade) en aperçu */
                    if (D.tn.length > 1) { c.strokeStyle = '#86efac'; c.beginPath(); D.tn.forEach((q, i) => { const p = Wp(q); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.stroke(); }
                    t2Label(c, F.x0, F.y0, secLabU(D)); } }
            c.restore();
        }
        // cadre de la fenêtre de coupe (monde) : la coupe plus une marge
        function cutFrame(D, o) { const m = mmToWorld(Math.max(500, Math.min(2000, (D.z1 - D.z0) * 0.15))); return { x0: o.x - m, y0: o.y - mmToWorld(D.z1 - D.z0) - m, x1: o.x + mmToWorld(D.u1 - D.u0) + m, y1: o.y + m }; }
        function makeSection(A, B, side, at, fac) { if (!window.THREE) { updateCommandMessageText('COUPE : chargement du moteur 3D…'); loadThree().then(() => makeSection(A, B, side, at, fac)); return; }
            const D = sectionData(A, B, side, fac); if (!D) { updateCommandMessageText(fac ? 'FAÇADE : rien à voir depuis cette ligne.' : 'COUPE : la ligne ne coupe aucun volume ni terrain. Tracez-la à travers les murs, dalles, toitures…'); return; }
            if (!at) { const bb = getShapesBoundingBox(shapes.filter(x => !isBg(x))) || { minX: 0, maxY: 0 }, gap = mmToWorld(Math.max(2000, (D.z1 - D.z0) * 0.6)); at = { x: bb.minX + mmToWorld(D.u1 - D.u0) / 2, y: bb.maxY + gap + mmToWorld(D.z1 - D.z0) / 2 }; }
            sectionPlace(D, at); }
        // coupe calculée (repère de la coupe, mm) : boucles des volumes coupés, terrain naturel, étendue, nom
        // la maquette 3D filaire des vues de façade (même scène que les vues ortho : faces opaques qui cachent, arêtes en traits), ramenée en mm réels
        let SEC_SCENE = false, SEC_SCENE_C = null, SEC_LAST_MS = 0;
        function secSceneMM() {
            try {
                if (!window.THREE || !shapes.some(is3DObj)) return null;
                if (!V3) init3D();
                /* maquette des coupes : refaite seulement quand ce que la coupe montre change (empreinte du modèle, pas chaque pas d'annulation : un texte, une cote, la coupe elle-même
                   ne la relancent pas), en version allégée (ni plan drapé, ni arbres) ; les triangles et arêtes extraits sont gardés avec elle */
                const sig = secModelSig();
                if (!is3DOpen()) { const key = 'sec|' + sig;
                    if (key === orthoKey && SEC_SCENE_C && SEC_SCENE_C.key === key) return SEC_SCENE_C.R;
                    const ex = document.getElementById('v3-exag'), ex0 = ex.value;
                    if (key !== orthoKey || V3.exag !== 1 || !V3.flat) { ex.value = '1'; v3Flat = true; SEC_SCENE = true; try { build3DScene(); } finally { ex.value = ex0; v3Flat = false; SEC_SCENE = false; } orthoKey = key; } }
                const root = V3.root; if (!root) return null; root.updateMatrixWorld(true);
                const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3(), ex = V3.exag || 1, zm = V3.zmin || 0, flat = !!V3.flat;
                const mm = (x, y, z) => [x * 1000, y * 1000, (z / ex + zm) * 1000];
                const tris = [], edges = [];
                const layOf = (o) => { let q = o; while (q && q !== root) { const sh = q.userData && (q.userData.shape || q.userData.edgeOf || q.userData.paroiOf); if (sh) return sh.layerId; q = q.parent; } return null; };
                const pts = (o, g) => { M.multiplyMatrices(inv, o.matrixWorld); const P = g.attributes.position, out = new Float64Array(P.count * 3); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(M); const q = mm(v.x, v.y, v.z); out[i * 3] = q[0]; out[i * 3 + 1] = q[1]; out[i * 3 + 2] = q[2]; } return out; };
                const segsOf = (o, g, lay) => { const P = pts(o, g), ix = g.index; const n = ix ? ix.count : P.length / 3, at = (k) => { const j = ix ? ix.getX(k) : k; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; };
                    if (o.isLineSegments) { for (let k = 0; k + 1 < n; k += 2) edges.push([at(k), at(k + 1), lay]); } else for (let k = 0; k + 1 < n; k++) edges.push([at(k), at(k + 1), lay]); };
                root.traverse(o => {
                    if (!o.visible || o.isInstancedMesh || o.userData.cap || o.userData.plan2d || o.userData.drape || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
                    if (o.isMesh) { const g = o.geometry, P = pts(o, g), ix = g.index, n = ix ? ix.count : P.length / 3, t = new Float64Array(n * 3);
                        for (let k = 0; k < n; k++) { const j = ix ? ix.getX(k) : k; t[k * 3] = P[j * 3]; t[k * 3 + 1] = P[j * 3 + 1]; t[k * 3 + 2] = P[j * 3 + 2]; }
                        tris.push({ t, lay: layOf(o) });
                        if (!flat) { const eg = new THREE.EdgesGeometry(g, 30); segsOf(o, eg, layOf(o)); eg.dispose(); } }
                    else if (o.isLineSegments || o.isLine) segsOf(o, o.geometry, layOf(o));
                });
                const R = tris.length || edges.length ? { tris, edges } : null; SEC_SCENE_C = is3DOpen() ? null : { key: orthoKey, R }; return R;
            } catch (e) { console.error(e); return null; }
        }
        function sectionData(A, B, side, fac) { fac = !!fac;
            if (!window.THREE) { loadThree().then(() => { if (CUT.b) { CUT.D = sectionData(CUT.a, CUT.b, CUT.side, CUT.fac); cutBar(true); draw(); } }); return { loops: [], tn: [], u0: 0, u1: 1000, z0: 0, z1: 1000, name: '…', A, B, side, fac, wait: true }; }
            const ax = worldToMm(A.x), ay = -worldToMm(A.y), bx = worldToMm(B.x), by = -worldToMm(B.y), L = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / L, ty = (by - ay) / L;
            const nx = -ty, ny = tx;   // normale du plan de coupe (repère réel)
            // sens de vue (repère réel) : côté cliqué ; « droite » du regard = axe horizontal de la coupe
            const vwx = nx * -side, vwy = ny * -side;   // en plan l'axe Y est inversé : on repasse en repère réel
            const rx = vwy, ry = -vwx;
            const objs = shapes.filter(x => { const l = layers.find(y => y.id === (x.layerId || 'layer-0')); return (!l || l.visible !== false) && is3DObj(x) && !x.gen && !x.secOf; });
            const loopsOut = [];
            const allT = [];
            objs.forEach(o => {
                let t; try { t = objTrisMM(o); } catch (e) { t = null; } if (!t) return; allT.push({ o, t }); if (fac) return;   /* façade : rien n'est coupé */
                const segs = [];
                for (let i = 0; i < t.length; i += 9) {
                    const P = [0, 1, 2].map(k => [t[i + 3 * k], t[i + 3 * k + 1], t[i + 3 * k + 2]]), d = P.map(q => (q[0] - ax) * nx + (q[1] - ay) * ny);
                    const pts = [];
                    for (let k = 0; k < 3; k++) { const a = P[k], b = P[(k + 1) % 3], da = d[k], db = d[(k + 1) % 3];
                        if ((da > 0) !== (db > 0) && Math.abs(da - db) > 1e-9) { const u = da / (da - db); pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); } }
                    if (pts.length !== 2) continue;
                    const al = (q) => (q[0] - ax) * tx + (q[1] - ay) * ty; if (Math.max(al(pts[0]), al(pts[1])) < 0 || Math.min(al(pts[0]), al(pts[1])) > L) continue;
                    segs.push(pts.map(q => [(q[0] - ax) * rx + (q[1] - ay) * ry, q[2]]));
                }
                if (!segs.length) return;
                // segments -> boucles fermées
                const K = (q) => Math.round(q[0] * 10) + ',' + Math.round(q[1] * 10), adj = new Map();
                segs.forEach((sg, k) => { [0, 1].forEach(e => { const key = K(sg[e]); if (!adj.has(key)) adj.set(key, []); adj.get(key).push([k, e]); }); });
                const used = new Uint8Array(segs.length);
                for (let k0 = 0; k0 < segs.length; k0++) { if (used[k0]) continue; used[k0] = 1; const loop = [segs[k0][0], segs[k0][1]]; let cur = segs[k0][1], guard = 0;
                    while (guard++ < 100000) { const nb = (adj.get(K(cur)) || []).find(([k]) => !used[k]); if (!nb) break; used[nb[0]] = 1; const nxt = segs[nb[0]][1 - nb[1]]; if (K(nxt) === K(loop[0])) break; loop.push(nxt); cur = nxt; }
                    if (loop.length >= 3) loopsOut.push({ o, loop }); }
            });
            // VUE AU-DELÀ : ce qui est derrière le plan de coupe, dans le sens du regard, en traits fins (arêtes vives et menuiseries ; parties cachées retirées par un tampon de profondeur)
            const beyond = [], SC = secSceneMM(), ZT = SC ? SC.tris : allT; let footP = null; try { const vx = vwx, vy = vwy, U = (q) => (q[0] - ax) * rx + (q[1] - ay) * ry, Dp = (q) => (q[0] - ax) * vx + (q[1] - ay) * vy, uB = (bx - ax) * rx + (by - ay) * ry, uL = Math.min(0, uB), uH = Math.max(0, uB);
                // triangles coupés au plan (on ne garde que la partie derrière)
                const clipT = (t, i) => { const P = [0, 1, 2].map(k => [t[i + 3 * k], t[i + 3 * k + 1], t[i + 3 * k + 2]]), d = P.map(Dp); if (d.every(v => v <= 0)) return []; if (d.every(v => v >= 0)) return [P];
                    const out = []; for (let k = 0; k < 3; k++) { const a = P[k], b = P[(k + 1) % 3], da = d[k], db = d[(k + 1) % 3]; if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const f = da / (da - db); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); } }
                    const T = []; for (let k = 1; k + 1 < out.length; k++) T.push([out[0], out[k], out[k + 1]]); return T; };
                let zl = Infinity, zh = -Infinity; ZT.forEach(({ t }) => { for (let i = 0; i < t.length; i += 3) { if (Dp([t[i], t[i + 1]]) < -1) continue; const u = U([t[i], t[i + 1]]); if (u < uL - 1 || u > uH + 1) continue; zl = Math.min(zl, t[i + 2]); zh = Math.max(zh, t[i + 2]); } });
                if (isFinite(zl) && zh > zl) { const c = Math.max((uH - uL) / 900, (zh - zl) / 500, 15), W = Math.ceil((uH - uL) / c) + 1, Hh = Math.ceil((zh - zl) / c) + 1, Z = new Float32Array(W * Hh).fill(Infinity);
                    ZT.forEach(({ t }) => { for (let i = 0; i < t.length; i += 9) clipT(t, i).forEach(T3 => { const V = T3.map(q => [(U(q) - uL) / c, (q[2] - zl) / c, Math.max(0, Dp(q))]);
                        const x0 = Math.max(0, Math.floor(Math.min(V[0][0], V[1][0], V[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(V[0][0], V[1][0], V[2][0]))), y0 = Math.max(0, Math.floor(Math.min(V[0][1], V[1][1], V[2][1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(V[0][1], V[1][1], V[2][1])));
                        if (x1 < x0 || y1 < y0 || (x1 - x0 + 1) * (y1 - y0 + 1) > 600000) return; const [a, b, d] = V, den = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]); if (Math.abs(den) < 1e-12) return;
                        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5, w1 = ((b[1] - d[1]) * (px - d[0]) + (d[0] - b[0]) * (py - d[1])) / den, w2 = ((d[1] - a[1]) * (px - d[0]) + (a[0] - d[0]) * (py - d[1])) / den, w3 = 1 - w1 - w2;
                            if (w1 < -0.01 || w2 < -0.01 || w3 < -0.01) continue; const z = w1 * a[2] + w2 * b[2] + w3 * d[2], k = y * W + x; if (z < Z[k]) Z[k] = z; } }); });
                    let budget = 20000;
                    /* façade : profondeur du pied de la façade, colonne par colonne (premier point vu en partant du bas) ; le terrain est lu là, pas sur la ligne tracée devant */
                    if (fac) { const dep = new Array(W).fill(null), dR = new Array(W).fill(null);   /* la surface la plus proche de chaque colonne parmi les ouvrages (pas le terrain) : la façade ; une toiture seulement s'il n'y a rien d'autre */
                        allT.forEach(({ o, t }) => { const roof = !!(o.solid && o.solid.kind === 'roof'), T = roof ? dR : dep; for (let i = 0; i < t.length; i += 9) clipT(t, i).forEach(T3 => { const us = T3.map(U), ds = T3.map(Dp), dm = Math.max(0, Math.min(...ds)), x0 = Math.max(0, Math.floor((Math.min(...us) - uL) / c)), x1 = Math.min(W - 1, Math.floor((Math.max(...us) - uL) / c));
                            for (let x = x0; x <= x1; x++) if (T[x] === null || dm < T[x]) T[x] = dm; }); });
                        for (let x = 0; x < W; x++) if (dep[x] === null) dep[x] = dR[x];
                        let last = null; for (let x = 0; x < W; x++) { if (dep[x] !== null) last = dep[x]; else if (last !== null) dep[x] = last; } last = null; for (let x = W - 1; x >= 0; x--) { if (dep[x] !== null) last = dep[x]; else if (last !== null) dep[x] = last; }
                        footP = { uL, c, dep: dep.map(v => v === null ? 0 : Math.round(v)) }; }
                    const footW = (f) => { const wx = A.x + (B.x - A.x) * f, wy = A.y + (B.y - A.y) * f; if (!footP) return { x: wx, y: wy }; const d = footAt(footP, f * uB); return { x: wx + mmToWorld(vwx * d), y: wy - mmToWorld(vwy * d) }; };
                    // la terre coupée cache tout ce qui est derrière elle : sous le terrain naturel du plan de coupe (façade : au pied du mur), rien n'est vu
                    const tinB = getTIN(), NE = 400, earth = new Float64Array(NE + 1).fill(-Infinity); if (tinB) for (let i = 0; i <= NE; i++) { const f = i / NE, P = footW(f), z = tinZ(P.x, P.y, tinB); if (hasZ(z)) earth[i] = z; }
                    const under = (uu, zz) => { if (!tinB || Math.abs(uB) < 1e-6) return false; const f = uu / uB * NE; if (f < 0 || f > NE) return false; const i = Math.min(NE - 1, Math.floor(f)), w = f - i, e0 = earth[i], e1 = earth[i + 1]; if (!isFinite(e0) || !isFinite(e1)) return false; return zz < e0 + (e1 - e0) * w - 30; };
                    // un trait 3D : gardé là où il est devant le tampon (à la tolérance près)
                    const visEdge = (p, q, lay) => { if (budget <= 0) return; const dp = Dp(p), dq = Dp(q); if (Math.max(dp, dq) < 5) return; if (dp < 0 || dq < 0) { const f = dp / (dp - dq), m = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]; if (dp < 0) p = m; else q = m; }
                        const A2 = [U(p), p[2], Math.max(0, Dp(p))], B2 = [U(q), q[2], Math.max(0, Dp(q))], n = Math.max(2, Math.ceil(Math.hypot(B2[0] - A2[0], B2[1] - A2[1]) / c * 1.5)); let run = null;
                        for (let s2 = 0; s2 <= n; s2++) { const f = s2 / n, uu = A2[0] + (B2[0] - A2[0]) * f, zz = A2[1] + (B2[1] - A2[1]) * f, dd = A2[2] + (B2[2] - A2[2]) * f, x = Math.floor((uu - uL) / c), y = Math.floor((zz - zl) / c);
                            let vis = uu >= uL - 1 && uu <= uH + 1; if (vis) { const zAt2 = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < Hh ? Z[yy * W + xx] : Infinity, own = zAt2(x, y); let m2 = Infinity; for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) m2 = Math.min(m2, zAt2(xx, yy));
                                const fin = (v) => isFinite(v) ? v : own, gx = isFinite(own) ? Math.abs(fin(zAt2(x + 1, y)) - fin(zAt2(x - 1, y))) / 2 : 0, gy = isFinite(own) ? Math.abs(fin(zAt2(x, y + 1)) - fin(zAt2(x, y - 1))) / 2 : 0;   // pente du tampon : une arête posée sur un toit rasant reste visible (pas de pointillés)
                                vis = dd <= m2 + c * 2 + 40 || (isFinite(own) && dd <= own + c * 2 + 40 + 1.5 * (gx + gy));  if (vis && under(uu, zz)) vis = false; }
                            if (vis) { if (!run) run = [uu, zz]; run[2] = uu; run[3] = zz; } if ((!vis || s2 === n) && run) { if (Math.hypot(run[2] - run[0], run[3] - run[1]) > c * 0.5) { beyond.push([run[0], run[1], run[2], run[3], lay]); budget--; } run = null; } } };
                    /* façade : seulement les traits des ouvrages (murs, menuiseries, toitures, dalles) et pas plus loin que 40 m derrière la façade ; ni cadastre, ni lignes du terrain */
                    const okLay = fac ? new Set(objs.map(o => o.layerId || 'layer-0').concat(objs.flatMap(o => (o.openings || []).map(q => q.layerId)).filter(Boolean))) : null, dMax = fac && footP ? Math.max(...footP.dep) + 40000 : Infinity;
                    if (SC) SC.edges.forEach(([p, q, lay]) => { if (okLay && !okLay.has(lay || 'layer-0')) return; if (fac && Math.min(Dp(p), Dp(q)) > dMax) return; visEdge(p, q, lay); });   // les traits de la maquette filaire (vues de façade) : murs, menuiseries, toitures continues…
                    else { // arêtes vives de chaque objet (bord libre ou angle > 25° entre faces)
                    allT.forEach(({ o, t }) => { const E = new Map(), key = (q) => Math.round(q[0]) + ',' + Math.round(q[1]) + ',' + Math.round(q[2]);
                        for (let i = 0; i < t.length; i += 9) { const P = [0, 1, 2].map(k => [t[i + 3 * k], t[i + 3 * k + 1], t[i + 3 * k + 2]]), e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
                            let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const ln = Math.hypot(...nn); if (ln < 1e-9) continue; nn = nn.map(v => v / ln);
                            for (let k = 0; k < 3; k++) { const p = P[k], q = P[(k + 1) % 3], ka = key(p), kb = key(q), id = ka < kb ? ka + '|' + kb : kb + '|' + ka; const e = E.get(id); if (e) e.n.push(nn); else E.set(id, { p, q, n: [nn] }); } }
                        E.forEach(e => { const sharp = e.n.length === 1 || e.n.some((a, i) => e.n.some((b, j) => j > i && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0.9)); if (sharp) visEdge(e.p, e.q, o.layerId); }); });
                    // menuiseries des ouvertures (cadre, partition des fenêtres) vues dans leurs baies
                    objs.filter(w => isWallHatch(w) && w.wz && hasZ(w.wz.b)).forEach(w => wallOpeningsFor(w).forEach(o => { if (!o.pts || opHidden(o)) return; const M = (a, b) => [worldToMm((a.x + b.x) / 2), -worldToMm((a.y + b.y) / 2)], E1 = M(o.pts[0], o.pts[3]), E2 = M(o.pts[1], o.pts[2]), z0 = w.wz.b + (o.sill || 0), z1 = z0 + Math.max(10, o.h || 1000), lay = o.layerId || w.layerId;
                        const L2 = Math.hypot(E2[0] - E1[0], E2[1] - E1[1]) || 1, ux2 = (E2[0] - E1[0]) / L2, uy2 = (E2[1] - E1[1]) / L2, fr = Math.min(60, L2 / 4), P3 = (s2, z) => [E1[0] + ux2 * s2, E1[1] + uy2 * s2, z];
                        const rect = (a0, a1, b0, b1) => { visEdge(P3(a0, b0), P3(a1, b0), lay); visEdge(P3(a1, b0), P3(a1, b1), lay); visEdge(P3(a1, b1), P3(a0, b1), lay); visEdge(P3(a0, b1), P3(a0, b0), lay); };
                        if (o.top && o.top !== 'droit') { const pr = opProfile(o, L2, 16).pts; pr.forEach(([x, z], i) => { const q = pr[(i + 1) % pr.length]; visEdge(P3(x, z0 + z), P3(q[0], z0 + q[1]), lay); }); } else rect(0, L2, z0, z1); if (o.kind !== 'baie' && !(o.top && o.top !== 'droit')) rect(fr, L2 - fr, z0 + (o.kind === 'porte' ? 0 : fr), z1 - fr); if (o.kind === 'fen' && L2 > 1000 && !(o.top && o.top !== 'droit')) visEdge(P3(L2 / 2, z0 + fr), P3(L2 / 2, z1 - fr), lay); })); } } } catch (e) { console.error(e); }
            // terrain naturel le long de la coupe
            const tin = getTIN(), tn = [];
            if (tin) for (let i = 0; i <= 200; i++) { const f = i / 200, P = facFoot({ A, B, ax, ay, rx, ry, foot: footP }, f), z = tinZ(P.x, P.y, tin); if (hasZ(z)) tn.push([f * ((bx - ax) * rx + (by - ay) * ry), z]); }
            if (fac && !beyond.length) return null; if (!loopsOut.length && tn.length < 2 && !beyond.length) return null;
            // façade : niveaux des toitures (faîtage, égout) et des dalles vues de face, dans la largeur de la ligne
            const lvF = []; if (fac) { const uB2 = (bx - ax) * rx + (by - ay) * ry, uLo = Math.min(0, uB2), uHi = Math.max(0, uB2), vx = -ry, vy = rx;
                allT.forEach(({ o, t }) => { let zmax = -Infinity, zmin = Infinity, um = 0; for (let i = 0; i < t.length; i += 3) { const u = (t[i] - ax) * rx + (t[i + 1] - ay) * ry, d = (t[i] - ax) * vx + (t[i + 1] - ay) * vy; if (d < 0 || u < uLo - 1 || u > uHi + 1) continue; if (t[i + 2] > zmax) { zmax = t[i + 2]; um = u; } zmin = Math.min(zmin, t[i + 2]); }
                    if (!isFinite(zmax)) return; if (o.solid && o.solid.kind === 'roof') { lvF.push({ k: 'Faîtage', z: zmax, u: um, c: o.layerId }); const he = o.roofDef && o.roofDef.o && isFinite(o.roofDef.o.he) && o.roofDef.o.pans ? o.roofDef.o.he * 1000 : zmin; lvF.push({ k: 'Égout', z: he, u: um, c: o.layerId }); }
                    else { const kk = secLvKind(o); if (kk) lvF.push({ k: kk, z: zmax, u: um, c: o.layerId, g: o.groupId }); } }); }
            const all = loopsOut.flatMap(x => x.loop).concat(tn, beyond.flatMap(b => [[b[0], b[1]], [b[2], b[3]]])); let u0 = Infinity, u1 = -Infinity, z0 = Infinity, z1 = -Infinity; all.forEach(q => { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); });
            const used = new Set(shapes.filter(x => x.cutName).map(x => x.cutName)); let k = 0; while (k < 26 && used.has(String.fromCharCode(65 + k))) k++;
            let name = String.fromCharCode(65 + (k % 26)); if (fac) { const b0 = facName(-ry, rx); name = b0; let n = 2; while (used.has(name)) name = b0 + ' ' + n++; }
            return { loops: loopsOut, tn, u0, u1, z0, z1, name, A, B, side, ax, ay, rx, ry, L, beyond, fac, foot: footP, lvF }; }
        // façade : profondeur du pied de la façade à l'abscisse u (mm), et point du plan correspondant à la fraction f de la ligne
        // façade : le côté de la ligne où se trouve l'ouvrage le plus proche (dans la largeur de la ligne) ; 0 si rien
        function facSide(A, B) { const ax = worldToMm(A.x), ay = -worldToMm(A.y), bx = worldToMm(B.x), by = -worldToMm(B.y), L = Math.hypot(bx - ax, by - ay); if (L < 1) return 0; const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx; let dp = Infinity, dn = Infinity;
            shapes.forEach(o => { const l = layers.find(y => y.id === (o.layerId || 'layer-0')); if ((l && l.visible === false) || !is3DObj(o) || o.gen || o.secOf) return; let t; try { t = objTrisMM(o); } catch (e) { t = null; } if (!t) return;
                for (let i = 0; i < t.length; i += 3) { const u = (t[i] - ax) * tx + (t[i + 1] - ay) * ty; if (u < 0 || u > L) continue; const d = (t[i] - ax) * nx + (t[i + 1] - ay) * ny; if (d > 1) dp = Math.min(dp, d); else if (d < -1) dn = Math.min(dn, -d); } });
            if (!isFinite(dp) && !isFinite(dn)) return 0; return dp <= dn ? -1 : 1; }   /* regard = normale × −côté */
        /* niveau coté d'un objet coupé ou vu : acrotère (son dessus), dalle (son dessus) ; les couches de toiture (forme de pente, complexe d'étanchéité) ne sont pas cotées */
        function secLvKind(o) { if (!o || !o.solid || o.solid.kind !== 'box' || o.roofPart) return null; if (/^acrot/i.test(o.name || '')) return 'Acrotère'; if (/étanch|forme de pente/i.test(o.name || '')) return null;
            return (/dalle/i.test(o.name || '') || (o.solid.H || 0) <= 400) ? (/toit/i.test(o.name || '') ? 'Dessus de dalle (toit)' : 'Dessus de dalle') : null; }
        // un toit terrasse avec acrotère : on cote le dessus de l'acrotère, pas la dalle qu'il cache
        function secLvClean(L) { const G = new Set(L.filter(l => l.k === 'Acrotère' && l.g).map(l => l.g)); return L.filter(l => !(l.k === 'Dessus de dalle (toit)' && l.g && G.has(l.g))); }
        function footAt(F, u) { if (!F || !F.dep.length) return 0; const i = Math.max(0, Math.min(F.dep.length - 1, Math.floor((u - F.uL) / F.c))); return F.dep[i]; }
        function facFoot(D, f) { const wx = D.A.x + (D.B.x - D.A.x) * f, wy = D.A.y + (D.B.y - D.A.y) * f; if (!D.foot) return { x: wx, y: wy }; const uB = (worldToMm(D.B.x) - D.ax) * D.rx + (-worldToMm(D.B.y) - D.ay) * D.ry, d = footAt(D.foot, f * uB);
            return { x: wx + mmToWorld(-D.ry * d), y: wy - mmToWorld(D.rx * d) }; }
        // dessine la coupe calculée, fenêtre centrée sur « at » (monde), avec son cadre, son titre et le repère dans le plan
        // ---- COUPE DYNAMIQUE : la ligne de coupe du plan porte sa définition (cutDef) ; la coupe est recalculée après chaque modification du plan.
        //      Volumes hachurés selon leur matériau, terrain en place (terre), remblai, déblai (contour tireté), lignes TN et projet, cotes de niveau
        //      (égouts, faîtages, dessus de dalles). La coupe garde sa place ; on peut la déplacer d'un bloc, elle suit.
        /* calques d'une coupe : un groupe « Coupe A-A » avec son dessin, ses cotes et sa ligne sur le plan (coupes d'avant : le calque « Coupes ») */
        function secLayers(def, make) { if (!def.lay && !make) { const c = cutLayerId(); return { d: c, c, p: c }; } if (def.lay && def.lay.d && layers.some(l => l.id === def.lay.d)) return def.lay;
            const g = secLab(def), mk = (n, col) => { let l = layers.find(x => x.name === g + ' — ' + n); if (!l) { l = { id: generateId(), name: g + ' — ' + n, visible: !(def.fac && n === 'ligne sur le plan'), color: col, dash: 'solid', width: 1, textH: '', hatch: 'lines', hatchScale: 1, group: g }; layers.push(l); } return l.id; };
            def.lay = { d: mk('dessin', '#f472b6'), c: mk('cotes', '#fbbf24'), p: mk('ligne sur le plan', '#f472b6') }; updateLayerUI(); return def.lay; }
        /* réglages de la cotation d'une coupe (fenêtre Y) : pas du TN, écart de la colonne des niveaux au bâtiment, écart mini entre niveaux, chiffre du TN sous le trait, cotes affichées */
        function secOpt(def) { const o = def.opt || {}; return { tn: o.tn > 0 ? o.tn : 5, col: isFinite(o.col) ? o.col : 1.5, gap: isFinite(o.gap) ? o.gap : 0.45, tnOff: isFinite(o.tnOff) ? o.tnOff : 0.8, on: Object.assign({ F: 1, E: 1, D: 1, P: 1, T: 1 }, o.on || {}) }; }
        function secOptHTML(L) { const d = L.cutDef, O = secOpt(d), id = d.id, num = (k, v, lab, unit, mn, mx) => `<span>${lab}</span><span><input class="mf-in" style="width:4.5rem" value="${nfr(v, 2)}" onchange="secOptSet('${id}','${k}',this.value)"> ${unit}</span>`;
            const chk = (k, lab) => `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox"${O.on[k] ? ' checked' : ''} onchange="secOptSet('${id}','on.${k}',this.checked)"> ${lab}</label>`;
            return `<div style="font-weight:600;margin:6px 0 4px">Cotation de la coupe</div><div style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center">${num('tn', O.tn, 'Terrain naturel : une cote tous les', 'm')}${num('col', O.col, 'Colonne des niveaux : écart au bâtiment', 'm')}${num('gap', O.gap, 'Écart mini entre deux niveaux', 'm')}${num('tnOff', O.tnOff, 'Chiffre du TN sous le trait', 'm')}</div>
                <label style="display:flex;gap:6px;align-items:center;cursor:pointer;margin:2px 0 8px"><input type="checkbox"${d.auto ? ' checked' : ''} onchange="secOptSet('${id}','auto',this.checked)"> Mise à jour automatique (sinon : pastille ⟳ sur la coupe)</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:8px">${chk('F', 'Faîtages, acrotères')}${chk('E', 'Égouts')}${chk('D', 'Dessus de dalle')}${chk('P', 'Plateformes')}${chk('T', 'Terrain naturel')}</div>`
                + MF.acts([['Remettre les cotes à leur place', `secOptSet('${id}','reset',1)`, 'Les cotes déplacées à la main reviennent à leur place automatique']]); }
        function secOptSet(id, k, v) { const L = shapes.find(x => x.cutDef && x.cutDef.id === id); if (!L) return; const d = L.cutDef; d.opt = d.opt || {};
            if (k === 'reset') { delete d.lvOff; shapes.forEach(x => { if (x.secOf === id && x.type === 'text' && x.lvKey && x.lvRef) { x.x = x.lvRef.x; x.y = x.lvRef.y; } }); }   /* sinon le recalcul relirait leur place déplacée */ else if (k === 'auto') {} else if (k.startsWith('on.')) { d.opt.on = Object.assign({}, d.opt.on || {}); d.opt.on[k.slice(3)] = v ? 1 : 0; } else { const n = t2Num(v); if (!isFinite(n) || n < 0 || n > 100 || (k === 'tn' && n < 0.5)) { updateCommandMessageText('COUPE : valeur non valable.'); return; } d.opt[k] = Math.round(n * 100) / 100; }
            if (k === 'auto') { d.auto = v ? 1 : 0; if (!d.auto) delete d.auto; }
            d.key = null; secRefresh(L, null, true); const T = shapes.find(x => x.secTitle && x.secOf === id); if (T) selectedShapes = expandGroups([T]); invalidateCache(); saveState(); draw(); updateCommandMessageText('COUPE ' + d.name + '-' + d.name + ' : cotation mise à jour.'); }
        /* le dessin d'une coupe dynamique ne se sélectionne pas (il serait refait) : seuls son titre (qui emmène toute la coupe) et ses cotes se prennent ; il reste accrochable */
        function secLock(s) { return !!(s && s.secOf && !s.secTitle && !s.lvKey); }
        function sectionPlace(D, at) {
            if (D.wait) D = sectionData(D.A, D.B, D.side, D.fac); if (!D) return;
            const { name, A, B, side } = D, id = 'sec' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), lid = cutLayerId(), zRef = Math.round(D.z0 / 1000) * 1000;
            const def = { id, name, side, zRef, ...(D.fac ? { fac: 1 } : {}), gid: 'grp-coupe-' + id, o: { x: at.x - mmToWorld((D.u0 + D.u1) / 2), y: at.y + mmToWorld((D.z0 + D.z1) / 2 - zRef) } }; def.lay = secLayers(def, true);
            const line = { type: 'line', layerId: def.lay.p, x1: A.x, y1: A.y, x2: B.x, y2: B.y, groupId: def.gid + '-plan', cutDef: def, zk: 1, lvs: 1 };
            shapes.push(line); const out = secBuild(D, def); shapes.push(...out, ...secMarks(line)); { const sk = secSkOf(line, secModelSig()); SEC_D.set(id, { sk, D }); def.sk = sk; } saveState(); draw();
            updateCommandMessageText(secLabU(def) + ' dessinée (groupe de calques « ' + secLab(def) + ' ») : ' + (def.fac ? (D.beyond || []).length + ' trait(s) vus' : D.loops.length + ' élément(s) coupé(s)') + (D.tn.length > 1 ? ', terrain et terrassement' : '') + '. Quand le plan change, sa pastille passe à « à rafraîchir » : un clic la recalcule (ou « Mise à jour automatique » dans sa fenêtre Y). Son dessin ne se modifie pas (il s\'accroche) ; ses cotes se déplacent une à une ; son titre déplace toute la coupe.');
            return out;
        }
        // repère dans le plan : flèches du sens de vue et lettres, recalés sur la ligne
        function secMarks(L) { const d = L.cutDef, pl = d.lay ? d.lay.p : L.layerId, A = { x: L.x1, y: L.y1 }, B = { x: L.x2, y: L.y2 }, Lw = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = -(B.y - A.y) / Lw * d.side, uy = (B.x - A.x) / Lw * d.side, k = mmToWorld(Math.max(600, worldToMm(Lw) * 0.04)), out = [], g = d.gid + '-plan';
            [A, B].forEach(P => { out.push({ type: 'line', layerId: pl, x1: P.x, y1: P.y, x2: P.x + ux * k, y2: P.y + uy * k, groupId: g, secMark: d.id, zk: 1, lvs: 1 }); out.push({ type: 'text', layerId: pl, x: P.x + ux * k * 1.4, y: P.y + uy * k * 1.4, content: d.name, size: TEXT_WORLD_SIZE * 1.2, groupId: g, cutName: d.name, secMark: d.id, zk: 1, lvs: 1 }); });
            return out; }
        // le dessin de la coupe, dans le repère fixe de sa définition (o = point du plan où tombe u = 0, z = zRef)
        function secBuild(D, def) {
            const o = def.o, Wp = (q) => ({ x: o.x + mmToWorld(q[0]), y: o.y - mmToWorld(q[1] - def.zRef) }), lid = secLayers(def).d, lidC = secLayers(def).c, gid = def.gid, out = [], tag = (x) => Object.assign(x, { groupId: gid, secOf: def.id, zk: 1, lvs: 1 });
            const poly = (P, extra) => tag(Object.assign({ type: 'poly', layerId: lid, points: P.map(Wp).map(q => ({ x: q.x, y: q.y })) }, extra || {}));
            const hatch = (P, mat, col) => tag(Object.assign({ type: 'hatch', layerId: lid, loops: [P.map(Wp).map(q => ({ x: q.x, y: q.y }))], hatchMat: mat, gen2: 1 }, col ? { colOf: col } : {}));
            // couleurs : celles des calques des objets représentés (terrain, plateforme, mur, toiture…)
            const tnPt = shapes.find(x => x.type === 'point' && hasZ(x.z) && !x.secOf), tnCol = tnPt ? tnPt.layerId : ((layers.find(l => /terrain/i.test(l.name)) || {}).id);
            let u0 = D.u0, u1 = D.u1, z0 = D.z0, z1 = D.z1, zbot = null, TNs = null, PFs = null, FMp = null;
            // terrain : TN et projet (plateformes, talus) échantillonnés le long de la ligne
            const tin = getTIN(); let FM = null; try { FM = tin ? finishedModel(null, tin, null, false) : null; } catch (e) { FM = null; } FMp = FM;
            if (tin) { const N = 240, T = [], Pj = [], U = []; const A = D.A, B = D.B;
                const govN = {}, G = []; for (let i = 0; i <= N; i++) { const f = i / N, lx = A.x + (B.x - A.x) * f, ly = A.y + (B.y - A.y) * f, Pf = D.fac ? facFoot(D, f) : { x: lx, y: ly }, wx = Pf.x, wy = Pf.y, zt = tinZ(wx, wy, tin); if (!hasZ(zt)) continue; let zp = zt, gk = -1; if (FM) { const r = FM.at(wx, wy); if (r && r.gov >= 0 && hasZ(r.z)) { zp = r.z; govN[r.gov] = (govN[r.gov] || 0) + 1; if (r.kind === 1) gk = r.gov; } }
                    U.push((worldToMm(lx) - D.ax) * D.rx + (-worldToMm(ly) - D.ay) * D.ry); T.push(zt); Pj.push(zp); G.push(gk); }
                const gTop = Object.keys(govN).sort((a, b) => govN[b] - govN[a])[0], pjCol = gTop !== undefined && FM && FM.P[gTop] && FM.P[gTop].s ? FM.P[gTop].s.layerId : tnCol;
                if (U.length > 1) { const ord = U.map((u, k) => k).sort((a, b) => U[a] - U[b]), u = ord.map(k => U[k]), t = ord.map(k => T[k]), pj = ord.map(k => Pj[k]), gv = ord.map(k => G[k]); TNs = { u, t }; PFs = { u, pj, gv };
                    z0 = Math.min(z0, ...t, ...pj); z1 = Math.max(z1, ...t, ...pj); u0 = Math.min(u0, u[0]); u1 = Math.max(u1, u[u.length - 1]);
                    const zb = z0 - Math.max(1500, (z1 - z0) * 0.15); zbot = zb; const low = u.map((x, k) => [x, Math.min(t[k], pj[k])]);
                    out.push(hatch(low.concat([[u[u.length - 1], zb], [u[0], zb]]), 'terre', tnCol));
                    // remblai (projet au-dessus du TN) hachuré grave ; déblai (TN au-dessus du projet) en contour tireté
                    const runs = (test) => { const R = []; let cur = null; u.forEach((x, k) => { if (test(k)) { if (!cur) { cur = []; R.push(cur); } cur.push(k); } else cur = null; }); return R.filter(r => r.length > 1); };
                    runs(k => pj[k] - t[k] > 5).forEach(r => out.push(hatch(r.map(k => [u[k], pj[k]]).concat(r.slice().reverse().map(k => [u[k], t[k]])), 'gnt', pjCol)));
                    runs(k => t[k] - pj[k] > 5).forEach(r => out.push(poly(r.map(k => [u[k], t[k]]).concat(r.slice().reverse().map(k => [u[k], pj[k]])), { dash: 'dashed', width: 1, name: 'Déblai', colOf: pjCol })));
                    out.push(poly(u.map((x, k) => [x, t[k]]), { open: true, dash: 'dashed', width: 1, name: 'TN', colOf: tnCol }));
                    if (pj.some((z, k) => Math.abs(z - t[k]) > 5)) out.push(poly(u.map((x, k) => [x, pj[k]]), { open: true, width: 2, name: 'Projet', colOf: pjCol }));
                     } }   /* le TN est coté tous les 5 m (cotes de la coupe) */
            // vue au-delà : traits fins à la couleur du calque de l'objet
            /* traits bout à bout réunis en polylignes (par calque) : des milliers de petits traits en moins à enregistrer, annuler, accrocher */
            { const byL = new Map(); (D.beyond || []).forEach(sg => { const k = sg[4] || ''; if (!byL.has(k)) byL.set(k, []); byL.get(k).push(sg); });
                byL.forEach((S, lay) => { const K = (u, z) => Math.round(u) + ',' + Math.round(z), ends = new Map(), used = new Uint8Array(S.length); S.forEach((sg, i) => { [K(sg[0], sg[1]), K(sg[2], sg[3])].forEach(k => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); }); });
                    const next = (k) => (ends.get(k) || []).find(i => !used[i]);
                    S.forEach((sg, i) => { if (used[i]) return; used[i] = 1; let pts = [[sg[0], sg[1]], [sg[2], sg[3]]];
                        for (let dir = 0; dir < 2; dir++) { let guard = 0; while (guard++ < 5000) { const e = pts[pts.length - 1], j = next(K(e[0], e[1])); if (j === undefined) break; used[j] = 1; const q = S[j], a = K(q[0], q[1]) === K(e[0], e[1]); pts.push(a ? [q[2], q[3]] : [q[0], q[1]]); } pts.reverse(); }
                        if (pts.length === 2) { const P = Wp(pts[0]), Q = Wp(pts[1]); out.push(tag({ type: 'line', layerId: lid, x1: P.x, y1: P.y, x2: Q.x, y2: Q.y, width: 0.5, colOf: lay || undefined })); }
                        else out.push(poly(pts, { open: true, width: 0.5, colOf: lay || undefined })); }); }); }
            // volumes coupés : hachure de leur matériau et contour épais
            const matOf = (x) => x.wallMat || (x.solid && x.solid.kind === 'roof' ? 'bois' : x.roofPart ? 'parpaing' : 'beton');
            D.loops.forEach(({ o: ob, loop }) => { out.push(hatch(loop, matOf(ob), ob.layerId)); out.push(poly(loop, { width: 2, colOf: ob.layerId })); });
            // COTATION DYNAMIQUE : niveaux des faîtages, égouts, dessus de dalles (colonne à droite du bâtiment), des plateformes terrassées et du terrain naturel tous les 5 m (posés sur le trait).
            //   Chaque cote est son propre groupe (calque « cotes » de la coupe) : on la déplace où elle se lit le mieux, son rappel suit ; elle garde sa place quand la coupe se recalcule.
            const OP = secOpt(def), ON = OP.on; const lv = []; D.loops.forEach(({ o: ob, loop }) => { const zs = loop.map(q => q[1]), zmax = Math.max(...zs);
                if (ob.solid && ob.solid.kind === 'roof') { const top = loop[zs.indexOf(zmax)]; lv.push({ k: 'Faîtage', z: zmax, u: top[0], c: ob.layerId }); const he = ob.roofDef && ob.roofDef.o && isFinite(ob.roofDef.o.he) && ob.roofDef.o.pans ? ob.roofDef.o.he * 1000 : Math.min(...zs); const lo = loop[zs.indexOf(Math.min(...zs))]; lv.push({ k: 'Égout', z: he, u: lo[0], c: ob.layerId }); }
                else { const kk = secLvKind(ob); if (kk) lv.push({ k: kk, z: zmax, u: loop[zs.indexOf(zmax)][0], c: ob.layerId, g: ob.groupId }); } });
            (D.lvF || []).forEach(l => lv.push(l));   /* façade : niveaux vus de face */
            { const cl = secLvClean(lv); lv.length = 0; lv.push(...cl); }
            const pt = [];   // cotes posées sur leur point (plateformes, terrain)
            if (PFs) { let k = 0; const { u, pj, gv } = PFs; while (k < u.length) { const g = gv[k]; let e = k; while (e + 1 < u.length && gv[e + 1] === g) e++; if (ON.P && g >= 0 && e > k && u[e] - u[k] > 400) { const m = Math.round(k + (e - k) / 4), P = FMp && FMp.P[g] && FMp.P[g].s;   /* au premier quart : loin des cotes du bâtiment */
                        pt.push({ k: 'Plateforme' + (P && P.name ? ' ' + P.name : ''), z: pj[m], u: u[m], c: P ? P.layerId : null, key: 'P' + g + '_' + Math.round(u[m] / 1000) }); } k = e + 1; } }
            if (TNs) { const { u, t } = TNs, at = (x) => { let j = 0; while (j < u.length - 2 && u[j + 1] < x) j++; const f = (x - u[j]) / ((u[j + 1] - u[j]) || 1); return t[j] + (t[j + 1] - t[j]) * Math.max(0, Math.min(1, f)); };
                const st = Math.max(500, OP.tn * 1000); if (ON.T) for (let x = Math.ceil(u[0] / st) * st; x <= u[u.length - 1] + 1; x += st) pt.push({ k: 'TN', z: at(x), u: x, c: tnCol, key: 'T' + Math.round(x / 1000), small: 1 }); }
            let uB = -Infinity; D.loops.forEach(({ loop }) => loop.forEach(q => { if (q[0] > uB) uB = q[0]; })); const seen = new Set(), xm = (isFinite(uB) ? uB : u1) + OP.col * 1000, tsz = TEXT_WORLD_SIZE; let zPrev = Infinity;   // colonne des niveaux juste à droite du bâtiment (pas au bout du terrain)
            const mark = (l, key, Mx, Mz) => { const P = Wp([l.u, l.z]), O0 = (def.lvOff && def.lvOff[key]) || { dx: 0, dy: 0 }, O = key[0] === 'T' ? O0 : { dx: O0.dx, dy: 0 },   /* une cote de niveau glisse sur sa ligne de niveau (le rappel s'allonge ou se raccourcit) ; celle du TN se place librement */ g = gid + '-lv-' + key, mv = (q) => ({ x: q.x + O.dx, y: q.y + O.dy }), sz = l.small ? tsz * 0.8 : tsz, hh = l.small ? 220 : 300;
                const lvT = (x) => Object.assign(tag(x), { groupId: g, lvKey: key, layerId: lidC }), M0 = mv(Wp([Mx, l.z])), moved = Math.abs(O.dx) + Math.abs(O.dy) > 1e-9 || Mx !== l.u;
                if (moved) out.push(lvT({ type: 'line', layerId: lidC, x1: P.x, y1: P.y, x2: M0.x + (Mx !== l.u ? mmToWorld(1800) : 0), y2: M0.y, dash: 'dotted', width: 0.5, colOf: l.c }));   /* rappel : du point coté au repère */
                out.push(lvT(Object.assign(poly([[Mx - hh * 0.6, l.z + hh], [Mx + hh * 0.6, l.z + hh], [Mx, l.z]], { hatch: true, width: 1, colOf: l.c }), {}))); out[out.length - 1].points = out[out.length - 1].points.map(mv);
                const T0 = Wp([Mx + hh * 0.8, Mz + (l.small ? -OP.tnOff * 1000 : 0)]),   /* TN : chiffre sous le trait */ T1 = { x: T0.x, y: T0.y - mmToWorld(120) }; out.push(lvT({ type: 'text', layerId: lidC, x: T1.x + O.dx, y: T1.y + O.dy, content: l.k + ' ' + fmtZ(l.z), size: sz, colOf: l.c, lvRef: T1 })); };
            lv.filter(l => ON[l.k[0] === 'É' ? 'E' : l.k[0] === 'A' ? 'F' : l.k[0]]).sort((a, b) => b.z - a.z).forEach(l => { const key = l.k[0] + Math.round(l.z / 10); if (seen.has(key)) return; seen.add(key); const zt = Math.min(l.z, zPrev - OP.gap * 1000); zPrev = zt; mark(l, key, xm, zt); });
            pt.forEach(l => { if (seen.has(l.key)) return; seen.add(l.key); mark(l, l.key, l.u, l.z); });
            // titre au-dessus de la coupe (pas de cadre)
            const m = Math.max(500, Math.min(2000, (z1 - z0) * 0.15)), F0 = Wp([u0, z1 + m]);
            const ts = TEXT_WORLD_SIZE * 1.4; out.push(tag({ type: 'text', layerId: lid, x: F0.x, y: F0.y - ts * 0.6, content: secLabU(def), size: ts, cutName: D.name, secTitle: 1 }));
            def.tx = F0.x; def.ty = F0.y - ts * 0.6; return out;
        }
        // mise à jour : après chaque modification (un instant après), toutes les coupes dynamiques sont recalculées ; une coupe déplacée garde sa nouvelle place
        let secTimer = 0;
        function secSchedule() { if (!shapes.some(x => x.cutDef)) return; clearTimeout(secTimer); secTimer = setTimeout(secRefreshAll, 400); }
        /* empreinte de ce qu'une coupe montre (volumes, murs, plateformes, terrain, calques visibles) : si rien de cela n'a changé, la coupe calculée est reprise telle quelle
           (le calcul — maquette 3D, vue au-delà — coûte des centaines de ms ; un trait, une cote, un texte ajoutés ne le relancent plus) */
        const SEC_D = new Map();
        function secModelSig() { const rel = shapes.filter(x => !x.secOf && !x.secMark && !x.cutDef && (is3DObj(x) || (x.type === 'point' && hasZ(x.z)) || x.wz || x.openings || (x.points && x.points.some(q => hasZ(q.z)))));
            const used = new Set(rel.map(x => x.layerId || 'layer-0')), j = JSON.stringify(rel) + '|' + layers.filter(l => used.has(l.id)).map(l => l.id + (l.visible === false ? 0 : 1)).join('');   /* seuls les calques qui portent le modèle : créer les calques d'une coupe ne relance rien */ let h = 0; for (let i = 0; i < j.length; i++) h = (h * 31 + j.charCodeAt(i)) | 0; return h + ':' + j.length; }
        /* mise à jour : ce qui ne demande pas de recalcul (titre déplacé, cotes, réglages) se fait tout de suite ; quand le modèle a changé, la coupe est marquée
           « à rafraîchir » (pastille ⟳ orange) et se recalcule d'un clic sur la pastille — sauf si « Mise à jour automatique » est cochée dans sa fenêtre Y */
        let SEC_SIG_NOW = null;
        function secSkOf(L, sig) { return sig + '|' + [L.x1, L.y1, L.x2, L.y2, L.cutDef.side].join(','); }
        function secStale(L) { if (SEC_SIG_NOW === null) SEC_SIG_NOW = secModelSig(); return L.cutDef.sk !== secSkOf(L, SEC_SIG_NOW); }
        /* coupes en mise à jour automatique : ce qui ne demande pas de recalcul se fait tout de suite ; les recalculs passent dans une file, une coupe à la fois entre deux gestes
           (pastille bleue « calcul en cours »), et la file repart de zéro si le plan change entre-temps */
        let SEC_DEFER = false; const SEC_BUSY = new Set(), SEC_Q = { ids: [], run: false };
        function secQueue(L) { const id = L.cutDef.id; if (!SEC_Q.ids.includes(id)) SEC_Q.ids.push(id); SEC_BUSY.add(id); if (!SEC_Q.run) secQueueRun(); }
        async function secQueueRun() { SEC_Q.run = true; try { while (SEC_Q.ids.length) { draw(); await secPaint(); await new Promise(r => setTimeout(r, 60)); const id = SEC_Q.ids.shift(), L = shapes.find(x => x.cutDef && x.cutDef.id === id && x.type === 'line');
                    if (L) { try { const sig = secModelSig(); SEC_SIG_NOW = sig; if (secRefresh(L, sig, false)) { invalidateCache(); if (shapesHistory[historyStep] && historyStep === shapesHistory.length - 1) shapesHistory[historyStep].shapes = shapes; } } catch (e) { console.error(e); } }
                    SEC_BUSY.delete(id); draw(); } } finally { SEC_Q.run = false; } }
        function secRefreshAll(force) { if (!window.THREE) { loadThree().then(() => secRefreshAll(force)); return; } let ch = false; const sig = secModelSig(); SEC_SIG_NOW = sig;
            SEC_DEFER = !force; try { shapes.filter(x => x.cutDef && x.type === 'line').forEach(L => { try { if (secRefresh(L, sig, force)) ch = true; } catch (e) { console.error(e); } }); } finally { SEC_DEFER = false; }
            if (ch) { invalidateCache(); if (shapesHistory[historyStep] && historyStep === shapesHistory.length - 1) shapesHistory[historyStep].shapes = shapes; draw(); } }
        /* pastille de chaque coupe (au-dessus de son titre et au milieu de sa ligne sur le plan) : ⟳ verte « à jour », orange « à rafraîchir » ; un clic la recalcule */
        let secBadgeHits = [];
        function drawSecBadges(c) { secBadgeHits = []; const Ls = shapes.filter(x => x.cutDef && x.type === 'line'); if (!Ls.length) return; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
            Ls.forEach(L => { const d = L.cutDef, st = secStale(L), T = shapes.find(x => x.secTitle && x.secOf === d.id), vis = (id) => { const l = layers.find(x => x.id === (id || 'layer-0')); return !(l && l.visible === false); };
                const busy = SEC_BUSY.has(d.id), pill = (wx, wy, dy) => { const X = wx * camera.zoom + camera.x, Y = wy * camera.zoom + camera.y + dy, nm = secLab(d), sub = busy ? '◔ calcul en cours…' : st ? '⟳ à rafraîchir' : '✓ à jour';
                    c.font = 'bold 12px Arial'; const w = Math.max(c.measureText(nm).width, c.measureText(sub).width) + 18, h = 30, x0 = X - w / 2, y0 = Y - h; if (x0 > c.canvas.width || y0 > c.canvas.height || x0 + w < 0 || y0 + h < 0) return;
                    c.fillStyle = busy ? '#1e3a8a' : st ? '#9a3412' : '#14532d'; c.strokeStyle = busy ? '#93c5fd' : st ? '#fb923c' : '#4ade80'; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x0, y0, w, h, 9); else c.rect(x0, y0, w, h); c.fill(); c.stroke();
                    c.fillStyle = '#fff'; c.textBaseline = 'top'; c.fillText(nm, x0 + 9, y0 + 3); c.fillStyle = busy ? '#dbeafe' : st ? '#fed7aa' : '#bbf7d0'; c.font = '10px Arial'; c.fillText(sub, x0 + 9, y0 + 17); secBadgeHits.push({ x0, y0, x1: x0 + w, y1: y0 + h, id: d.id }); };
                if (T && vis(T.layerId)) pill(T.x, T.y, -Math.max(16, (T.height || 0) * camera.zoom * 1.4));
                if (vis(L.layerId)) pill((L.x1 + L.x2) / 2, (L.y1 + L.y2) / 2, -8); });
            c.restore(); }
        function secBadgeAt(sx, sy) { return secBadgeHits.find(b => sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1) || null; }
        function secForce(id) { const L = shapes.find(x => x.cutDef && x.cutDef.id === id && x.type === 'line'); if (!L) return; if (!window.THREE) { loadThree().then(() => secForce(id)); return; }
            const id0 = L.cutDef.id; SEC_BUSY.add(id0); updateCommandMessageText(secLabU(L.cutDef) + ' : calcul…'); draw();   /* la pastille passe en bleu « calcul en cours » avant le calcul */
            secPaint().then(() => { const t0 = performance.now(); try { SEC_SIG_NOW = secModelSig(); L.cutDef.key = null; secRefresh(L, SEC_SIG_NOW, true); invalidateCache();
                if (shapesHistory[historyStep] && historyStep === shapesHistory.length - 1) shapesHistory[historyStep].shapes = shapes; } catch (e) { console.error(e); } SEC_BUSY.delete(id0); draw();
                if (L.cutDef) updateCommandMessageText(secLabU(L.cutDef) + ' rafraîchie (' + nfr((performance.now() - t0) / 1000, 1) + ' s).'); }); }
        // laisse l'écran se redessiner (pastille, message) avant un calcul long
        function secPaint() { return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))); }
        function secRefresh(L, sig, force) { const d = L.cutDef, old = shapes.filter(x => x.secOf === d.id), title = old.find(x => x.secTitle);
            if (!old.length) { delete L.cutDef; return false; }   // tout le dessin de la coupe a été supprimé : la ligne redevient un simple repère (un titre effacé seul ne casse plus la coupe : il revient)
            const tdx = title && isFinite(d.tx) ? title.x - d.tx : 0, tdy = title && isFinite(d.ty) ? title.y - d.ty : 0;
            if (Math.abs(tdx) > 1e-9 || Math.abs(tdy) > 1e-9) { d.o.x += tdx; d.o.y += tdy; }
            old.forEach(x => { if (x.type === 'text' && x.lvKey && x.lvRef) { const pv = (d.lvOff || {})[x.lvKey] || { dx: 0, dy: 0 }; let dx = x.x - x.lvRef.x, dy = x.y - x.lvRef.y;
                if ((Math.abs(tdx) > 1e-9 || Math.abs(tdy) > 1e-9) && Math.abs(dx - pv.dx - tdx) < 1e-6 && Math.abs(dy - pv.dy - tdy) < 1e-6) { dx -= tdx; dy -= tdy; }   /* déplacée avec toute la coupe : elle garde sa place relative */ if (x.lvKey[0] !== 'T') dy = 0;   /* niveau : seulement le long de sa ligne */ d.lvOff = d.lvOff || {}; if (Math.abs(dx) + Math.abs(dy) > 1e-9) d.lvOff[x.lvKey] = { dx, dy }; else delete d.lvOff[x.lvKey]; } });   // cotes de niveau déplacées à la main : leur place est gardée
            const sk = secSkOf(L, sig || secModelSig()), C = SEC_D.get(d.id), moved = Math.abs(tdx) > 1e-9 || Math.abs(tdy) > 1e-9 || d.key === null || old.some(x => x.type === 'text' && x.lvKey && x.lvRef && (Math.abs(x.x - x.lvRef.x) > 1e-9 || Math.abs(x.y - x.lvRef.y) > 1e-9)); let D;
            if (C && C.sk === sk) D = C.D;
            else { const up = d.sk === sk;   /* à jour mais pas encore calculée dans cette session (fichier rouvert) : calculée seulement si on la touche */
                if (!force && !d.auto && (!up || (!moved && title))) { if (Math.abs(tdx) > 1e-9 || Math.abs(tdy) > 1e-9) { /* coupe déplacée par son titre sans recalcul : tout son dessin suit */ shapes.forEach(x => { if (x.secOf === d.id && !x.secTitle) { translateShape(x, tdx, tdy); if (x.lvRef) x.lvRef = { x: x.lvRef.x + tdx, y: x.lvRef.y + tdy }; } }); d.tx = title.x; d.ty = title.y; return true; } return false; }
                if (SEC_DEFER && !force) { secQueue(L); return false; }   /* mise à jour automatique : calculée à part, une coupe à la fois, sans figer la saisie */
                const t0 = performance.now(); D = sectionData({ x: L.x1, y: L.y1 }, { x: L.x2, y: L.y2 }, d.side, d.fac); if (!D || D.wait) return false; SEC_D.set(d.id, { sk, D }); d.sk = sk; SEC_LAST_MS = Math.round(performance.now() - t0); }
            D.name = d.name;
            const out = secBuild(D, d), key = JSON.stringify(out.map(x => [x.type, x.points || x.loops || [x.x, x.y, x.x1, x.y1, x.x2, x.y2, x.content]])).replace(/(\d+\.\d{4})\d+/g, '$1');
            const mk = shapes.filter(x => x.secMark === d.id), mkKey = JSON.stringify([L.x1, L.y1, L.x2, L.y2]);
            if (key === d.key && mkKey === d.mkKey && title) return false; d.key = key; d.mkKey = mkKey;
            const at = shapes.indexOf(old[0]); shapes = shapes.filter(x => x.secOf !== d.id && x.secMark !== d.id); shapes.splice(Math.max(0, Math.min(at, shapes.length)), 0, ...out); shapes.push(...secMarks(L));
            selectedShapes = selectedShapes.filter(x => shapes.includes(x)); return true; }
        function d2ClSnaps() {
            const L = D3C.lines.map(l => ({ x: mmToWorld(l.p.x * 1000), y: -mmToWorld(l.p.y * 1000), dx: l.d.x, dy: -l.d.y, v: Math.hypot(l.d.x, l.d.y) < 1e-6 })), out = [];
            const key = historyStep + '|' + D3C.lines.length; if (cl2Cache && cl2Cache.key === key) return cl2Cache.pts;
            L.forEach(a => { if (a.v) out.push({ x: a.x, y: a.y }); });
            for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.v || b.v) continue; const den = a.dx * b.dy - a.dy * b.dx; if (Math.abs(den) < 1e-9) continue;
                const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den; out.push({ x: a.x + a.dx * t, y: a.y + a.dy * t }); }
            // croisements avec les traits du dessin (droites, polylignes) : de vrais points d'accroche
            const segs = []; shapes.forEach(s => { if (s.gen || isBg(s)) return; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) return;
                if (s.type === 'line') segs.push([s.x1, s.y1, s.x2, s.y2]); else if (s.type === 'poly') for (let i = 0; i < s.points.length - (s.open ? 1 : 0); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; segs.push([a.x, a.y, b.x, b.y]); } });
            if (segs.length < 40000) L.forEach(a => { if (a.v) return; segs.forEach(([x1, y1, x2, y2]) => { const ex = x2 - x1, ey = y2 - y1, den = a.dx * ey - a.dy * ex; if (Math.abs(den) < 1e-12) return;
                const u = ((x1 - a.x) * a.dy - (y1 - a.y) * a.dx) / den; if (u < -1e-9 || u > 1 + 1e-9) return; out.push({ x: x1 + ex * u, y: y1 + ey * u }); }); });
            cl2Cache = { key, pts: out };
            return out;
        }
        // ---- contrôle des collisions : volume commun de chaque paire de volumes qui s'interpénètrent ----
        let d3Col = [];
        function d3ObjName(s) { const L = (layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).name || '';
            const n = s.name || (s.solid ? SOLID_NAMES[s.solid.kind] || 'Volume' : s.sweep ? 'Balayage' : s.wallMat ? 'Mur' : 'Volume'); return n + (L ? ' (' + L + ')' : ''); }
        async function d3Collisions() {
            if (!window.THREE) { await loadThree(); }
            const vis = shapes.filter(x => { const l = layers.find(y => y.id === (x.layerId || 'layer-0')); return (!l || l.visible !== false) && is3DObj(x) && !x.gen; });
            if (vis.length < 2) { updateCommandMessageText('COLLISIONS : il faut au moins deux volumes visibles.'); return; }
            updateCommandMessageText('COLLISIONS : contrôle de ' + vis.length + ' volumes…');
            await new Promise(r => setTimeout(r, 30));
            const T = vis.map(o => { let t = null; try { t = objTrisMM(o); } catch (e) {} if (!t || !t.length) return null;
                let b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < t.length; i += 3) { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], t[i + k]); b[k + 3] = Math.max(b[k + 3], t[i + k]); } } return { o, t, b }; });
            const out = [], t0 = performance.now(); let tested = 0, skipped = 0, odd = 0; const VOL = (X) => X.vol === undefined ? (X.vol = signedVol(X.t) / 1e9) : X.vol;
            for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
                const A = T[i], B = T[j]; if (!A || !B) continue;
                if (A.o.groupId && A.o.groupId === B.o.groupId) continue;   // morceaux d'un même ouvrage (mur et ses pièces)
                const e = 1; if (A.b[3] <= B.b[0] + e || B.b[3] <= A.b[0] + e || A.b[4] <= B.b[1] + e || B.b[4] <= A.b[1] + e || A.b[5] <= B.b[2] + e || B.b[5] <= A.b[2] + e) continue;
                if (A.t.length + B.t.length > 9 * 60000) { skipped++; continue; }
                tested++; let r; try { r = csgTris(A.t, B.t, 'inter'); } catch (er) { continue; }
                const v = r && r.length ? signedVol(r) / 1e9 : 0;
                if (Math.abs(v) <= 1e-6) continue;
                if (v < 0 || v > Math.min(VOL(A), VOL(B)) * 1.01 + 1e-4) { odd++; continue; }   /* volume commun impossible (plus grand qu'un des deux, ou retourné) : forme non fermée, calcul incertain */
                out.push({ a: A.o, b: B.o, v, t: r });
                if (performance.now() - t0 > 20000) break;
            }
            d3Col = out.sort((x, y) => y.v - x.v); d3ColSel = null; d3ColCyc = { key: '', i: -1 }; d3ColDraw();
            const html = out.length ? `<div style="color:#fca5a5">${out.length} collision${out.length > 1 ? 's' : ''} : les zones en conflit sont en rouge dans la vue 3D. Clique une ligne pour sélectionner les deux objets.</div>
                <div style="color:#e5e7eb;margin-top:4px"><b>Supprimer une collision</b> : bouton <b>✂ Découper</b> sous la collision (une dalle est découpée en plan autour du mur : son contour est redessiné). Ou <b>clic molette</b> sur une zone rouge (chaque clic passe à l'objet suivant) puis <b>Entrée</b> : l'objet choisi reste entier et découpe tous ceux qui le touchent.</div>
                <div id="d3col-sel" style="color:#fbbf24;margin-top:4px;min-height:16px"></div>
                <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">${out.map((c, k) => `<div style="background:#3f1d1d;border:1px solid #7f1d1d;border-radius:6px;padding:6px 8px;color:#fee2e2"><div onclick="d3ColPick(${k})" style="cursor:pointer"><b>${k + 1}.</b> ${iaEsc(d3ObjName(c.a))} × ${iaEsc(d3ObjName(c.b))}<br><span style="color:#fca5a5">${nfr(c.v, c.v < 0.01 ? 4 : 3)} m³ en commun</span></div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"><button type="button" class="mf-btn" style="font-size:11.5px" title="${iaEsc(d3ObjName(c.b))} reste entier" onclick="d3ColCutPair(${k},false)">✂ Découper ${iaEsc(c.a.name || d3ObjName(c.a))}</button><button type="button" class="mf-btn" style="font-size:11.5px" title="${iaEsc(d3ObjName(c.a))} reste entier" onclick="d3ColCutPair(${k},true)">✂ Découper ${iaEsc(c.b.name || d3ObjName(c.b))}</button></div></div>`).join('')}</div>`
                : `<div style="color:#86efac">✓ Aucune collision entre les ${vis.length} volumes visibles.</div>`;
            t2Panel('⚠ Collisions', html + (skipped ? `<div class="ps-sub" style="margin-top:6px">${skipped} paire(s) trop lourde(s) pour le contrôle (maillages très fins) : non vérifiée(s).</div>` : '') + (odd ? `<div class="ps-sub" style="margin-top:6px">${odd} paire(s) au calcul incertain (surfaces non fermées, comme des pans de toit sans épaisseur) : non comptée(s).</div>` : '') + `<div class="ps-sub" style="margin-top:6px">Les volumes qui se touchent juste ne comptent pas. Un ouvrage et ses propres pièces (mur et ouvertures) ne sont pas comparés entre eux.</div>`,
                [['Recontrôler', 'd3Collisions()', false]].concat(out.length ? [['Masquer les zones', 'd3ColToggle(this)', false], ['✂ Couper les autres', 'd3ColCut()', false]] : [], [['Fermer', 'd3ColClear()', true]]), 'd3ColClear()');
            updateCommandMessageText(out.length ? 'COLLISIONS : ' + out.length + ' conflit(s) trouvé(s) (' + tested + ' paire(s) contrôlée(s)).' : 'COLLISIONS : aucun conflit (' + tested + ' paire(s) proches contrôlée(s)).');
        }
        function d3ColDraw() {
            if (!V3 || !window.THREE) return;
            if (!V3.col) { V3.col = new THREE.Group(); V3.scene.add(V3.col); } V3.col.clear(); V3.col.visible = true; V3.col.position.copy(V3.root ? V3.root.position : new THREE.Vector3());
            const ex = V3.exag || 1, zm = V3.zmin || 0;
            d3Col.forEach((c, k) => { const t = c.t, pos = new Float32Array(t.length); for (let i = 0; i < t.length; i += 3) { pos[i] = t[i] / 1000; pos[i + 1] = t[i + 1] / 1000; pos[i + 2] = (t[i + 2] / 1000 - zm) * ex; }
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
                const on = d3ColSel && (c.a === d3ColSel || c.b === d3ColSel), m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: on ? 0xf59e0b : 0xef4444, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 998; m.userData.colK = k; V3.col.add(m);
                const eg = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({ color: 0xfef2f2, depthTest: false, transparent: true })); eg.renderOrder = 999; V3.col.add(eg); });
            render3D();
        }
        function d3ColPick(k) { const c = d3Col[k]; if (!c) return; selectedShapes = [c.a, c.b]; if (is3DOpen()) { build3DScene(); render3D(); } else draw(); updatePropertiesPopup(); updateCommandMessageText('COLLISION ' + (k + 1) + ' : ' + d3ObjName(c.a) + ' × ' + d3ObjName(c.b) + ' — ' + nfr(c.v, 4) + ' m³ en commun. Déplace l\'un des deux, ou Y pour le régler.'); }
        /* masquer / réafficher les volumes rouges des collisions, sans perdre la liste (pour voir l'ouvrage dessous) */
        function d3ColToggle(b) { if (!V3 || !V3.col) return; V3.col.visible = !V3.col.visible; if (b) b.textContent = V3.col.visible ? 'Masquer les zones' : 'Afficher les zones'; render3D();
            updateCommandMessageText(V3.col.visible ? 'COLLISIONS : zones en conflit affichées en rouge.' : 'COLLISIONS : zones en conflit masquées (la liste reste là ; « Afficher les zones » pour les revoir).'); }
        /* clic molette sur une zone rouge : on fait défiler les objets de la (des) zone(s) touchée(s) ; l'objet choisi est sélectionné, ses zones passent en orange */
        let d3ColSel = null, d3ColCyc = { key: '', i: -1 };
        function d3ColCycle(e) { if (!d3Col.length || !V3 || !V3.col || !V3.col.visible) return false; const r = V3.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V3.camera); V3.col.updateMatrixWorld(true);
            const K = [...new Set(ray.intersectObjects(V3.col.children.filter(x => x.isMesh), false).map(h => h.object.userData.colK))].filter(k => d3Col[k]).sort((a, b) => a - b); if (!K.length) return false;
            const C = []; K.forEach(k => [d3Col[k].a, d3Col[k].b].forEach(o => { if (!C.includes(o)) C.push(o); })); const key = K.join(',');
            d3ColCyc = { key, i: d3ColCyc.key === key ? (d3ColCyc.i + 1) % C.length : 0 }; d3ColSel = C[d3ColCyc.i]; selectedShapes = [d3ColSel];
            const n = d3Col.filter(c => c.a === d3ColSel || c.b === d3ColSel).length; build3DScene(); d3ColDraw();
            const t = 'Gardé entier : ' + d3ObjName(d3ColSel) + ' (' + (d3ColCyc.i + 1) + '/' + C.length + ') — il coupera ' + n + ' objet' + (n > 1 ? 's' : '') + '. Entrée pour valider, clic molette pour le suivant.';
            const el = document.getElementById('d3col-sel'); if (el) el.textContent = t; updateCommandMessageText('COLLISION : ' + t); return true; }
        // valider : l'objet choisi reste entier, chaque objet qui le touche perd le volume commun (découpe gardée sur lui, retirée par Y)
        /* empreinte en plan d'un objet (mur : sa hachure ; volume extrudé : son contour) */
        function colPlanRing(o) { if (o.type === 'hatch' && o.wallMat && o.loops && o.loops[0] && o.loops[0].length >= 3) return o.loops[0]; if (o.type === 'poly' && o.solid && o.points && o.points.length >= 3) return o.points; return null; }
        /* découpe en plan : une dalle (volume extrudé) perd l'empreinte de l'objet gardé, son contour est vraiment redessiné (plan, 3D, métrés) ; plusieurs morceaux = plusieurs dalles */
        // hauteur occupée (mm) d'un objet 3D
        function colZr(o) { try { const t = objTrisMM(o); if (!t || !t.length) return null; let a = Infinity, b = -Infinity; for (let i = 2; i < t.length; i += 3) { if (t[i] < a) a = t[i]; if (t[i] > b) b = t[i]; } return [a, b]; } catch (e) { return null; } }
        /* découpe en plan : un volume extrudé (dalle, poteau, bloc…) ou un mur perd l'empreinte de l'objet gardé, son contour est vraiment redessiné (plan, 3D, métrés) ; plusieurs morceaux = plusieurs objets.
           Seulement si l'objet gardé occupe toute la hauteur de celui qu'on coupe (sinon on enlèverait trop : la découpe 3D prend le relais) */
        function colPlanCut(O, K) { const wall = O.type === 'hatch' && O.wallMat && O.loops && O.loops[0] && O.loops[0].length >= 3, box = O.solid && O.solid.kind === 'box' && O.type === 'poly' && !O.roofDef && !O.roofPart && !O.bld;
            if (!wall && !box) return null; const Rk = colPlanRing(K); if (!Rk) return null; const zo = colZr(O), zk = colZr(K); if (!zo || !zk || zk[0] > zo[0] + 5 || zk[1] < zo[1] - 5) return null;
            const ring0 = wall ? O.loops[0] : O.points, holes0 = wall ? O.loops.slice(1) : holesOf(O), O0 = ring0[0], loc = (A) => A.map(q => [q.x - O0.x, q.y - O0.y]); let MP;
            try { MP = polygonClipping.difference([[loc(ring0), ...holes0.map(loc)]], [[loc(Rk)]]); } catch (e) { return null; }
            if (!MP || !MP.length) return null; const z = O0.z, area = (r) => Math.abs(r.reduce((a, p, k) => { const q = r[(k + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
            const back = (r) => { const a = r.slice(); if (a.length > 1 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1]) a.pop(); return a.map(([x, y]) => Object.assign({ x: x + O0.x, y: y + O0.y }, z !== undefined ? { z } : {})); };
            MP.sort((a, b) => area(b[0]) - area(a[0])); const parts = MP.filter(pg => area(pg[0]) > 1e-9).map(pg => ({ pts: back(pg[0]), holes: pg.slice(1).map(back) })); parts.wall = wall; return parts; }
        // applique les morceaux à l'objet (et ses copies pour les morceaux suivants) ; rend de quoi revenir en arrière
        function colPlanApply(O, parts) { const keep = parts.wall ? { loops: O.loops, openings: O.openings } : { points: O.points, solid: O.solid }, extra = [];
            const set = (X, pp) => { if (parts.wall) X.loops = [pp.pts, ...pp.holes]; else { X.points = pp.pts; X.solid = Object.assign({}, X.solid); if (pp.holes.length) X.solid.holes = pp.holes; else delete X.solid.holes; } };
            set(O, parts[0]); parts.slice(1).forEach(pp => { const cl = JSON.parse(JSON.stringify(Object.assign({}, O, { openings: [] }))); set(cl, pp); extra.push(cl); });
            return { extra, undo: () => { Object.assign(O, keep); } }; }
        // l'objet S reste entier ; chaque objet qui le touche (ou seulement celui de la collision k) est découpé : en plan si c'est une dalle / un volume extrudé, sinon en 3D (découpe gardée sur lui)
        function d3ColCut(Sx, onlyK) { const S = Sx || d3ColSel; if (!S) { updateCommandMessageText('COLLISION : clic molette d\'abord sur une zone rouge pour choisir l\'objet à garder entier, ou un bouton ✂ de la liste.'); return; }
            const P = (onlyK !== undefined ? [d3Col[onlyK]] : d3Col.filter(c => c.a === S || c.b === S)).filter(Boolean); if (!P.length) return; let tS = null, wallsCut = false; const done = new Set(), bad = new Set(), plan = new Set();
            const vol = (o) => { try { const t = objTrisMM(o); return t ? signedVol(t) / 1e9 : NaN; } catch (e) { return NaN; } }, inter = (a, b) => { try { const r = csgTris(objTrisMM(a), objTrisMM(b), 'inter'); return r && r.length ? signedVol(r) / 1e9 : 0; } catch (e) { return NaN; } };
            P.forEach(c => { const O = c.a === S ? c.b : c.a;
                { const parts = colPlanCut(O, S); if (parts && parts.length) { const A = colPlanApply(O, parts);
                        const iv = inter(O, S); if (isFinite(iv) && Math.abs(iv) <= Math.max(1e-4, c.v * 0.02)) { if (A.extra.length) shapes.splice(shapes.indexOf(O) + 1, 0, ...A.extra); done.add(O); plan.add(O); if (parts.wall) wallsCut = true; return; }
                        A.undo(); } }
                const g = Array.from(c.t, v => Math.round(v * 100) / 100), v0 = vol(O), ok = () => { const v1 = vol(O); return Math.abs(v1 - (v0 - c.v)) <= Math.max(0.02 * Math.abs(v0), 0.005); };
                O.carve = (O.carve || []).concat([{ t: g }]); if (ok()) { done.add(O); return; }
                O.carve.pop(); if (!tS) { try { tS = Array.from(objTrisMM(S) || [], v => Math.round(v * 100) / 100); } catch (e) { tS = []; } }   /* 2e essai : on retire tout l'objet gardé (plus robuste quand les faces se confondent) */
                if (tS.length) { O.carve.push({ t: tS }); if (ok()) { done.add(O); return; } O.carve.pop(); }
                if (!O.carve.length) delete O.carve; bad.add(O); });   /* découpe vérifiée, sinon on n'y touche pas */
            if (wallsCut) { try { wallOpRepair(); wallBordersRepair(); } catch (e) { console.error(e); } }   /* murs redessinés : bords et ouvertures remis en place */
            const n = done.size, nb = [...bad].filter(o => !done.has(o)).length; d3ColSel = null; selectedShapes = [...done]; invalidateCache(); saveState(); if (is3DOpen()) build3DScene(); draw();
            const nm = [...done].map(o => d3ObjName(o)).slice(0, 3).join(', ');
            updateCommandMessageText((n ? 'COLLISION supprimée : ' + nm + (n > 3 ? '…' : '') + ' découpé' + (n > 1 ? 's' : '') + ' par ' + d3ObjName(S) + (plan.size ? ' (contour redessiné en plan' + (plan.size < n ? ' pour ' + plan.size : '') + ')' : '') + (plan.size < n ? ' ; découpe 3D retirable par Y' : '') : 'COLLISION : rien n\'a pu être découpé')
                + (nb ? ' ; ' + nb + ' objet' + (nb > 1 ? 's' : '') + ' trop complexe' + (nb > 1 ? 's' : '') + ' pour être coupé' + (nb > 1 ? 's' : '') + ' proprement, laissé' + (nb > 1 ? 's' : '') + ' tel' + (nb > 1 ? 's' : '') + ' quel' + (nb > 1 ? 's' : '') : '') + '. Nouveau contrôle…');
            setTimeout(() => d3Collisions(), 50); }
        function d3ColCutPair(k, cutB) { const c = d3Col[k]; if (!c) return; d3ColCut(cutB ? c.a : c.b, k); }
        function carveClear(gid) { const S = shapes.filter(x => (gid && x.groupId === gid) || selectedShapes.includes(x)); S.forEach(x => { delete x.carve; }); invalidateCache(); saveState(); draw(); refresh3D(); if (selectedShapes.length) openSelectionParamModal(); }
        window.addEventListener('keydown', e => { if (e.key !== 'Enter' || !d3ColSel || !d3Col.length || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return; e.preventDefault(); e.stopImmediatePropagation(); d3ColCut(); }, true);
        function d3ColClear() { d3ColSel = null; d3Col = []; if (V3 && V3.col) { V3.col.clear(); render3D(); } t2PanelClose(); }
        function d3Finish(close) {
            if (mode !== 'pline') return; const L = D3.pts; if (L.length >= 2) { const sh = { type: 'poly', layerId: activeLayerId, points: L.map(q => { const w = d3ToPlan(q); return { x: w.x, y: w.y, z: w.z }; }) }; if (!close) sh.open = true; shapes.push(sh); saveState(); build3DScene(); updateCommandMessageText('POLYLIGNE 3D ' + (close ? 'fermée' : '') + ' : ' + L.length + ' points. Cliquez pour en commencer une autre, ou Échap.'); }
            D3.pts = []; D3.plane = null; d3Rubber(); render3D();
        }
        function d3Key(e) {
            if (!d3Active()) return false;
            if (mode === 'cline' && D3.pts.length && /^[xyz]$/i.test(e.key)) { e.preventDefault(); const k = e.key.toLowerCase(); d3ClAdd(D3.pts[0], new THREE.Vector3(k === 'x' ? 1 : 0, k === 'y' ? 1 : 0, k === 'z' ? 1 : 0)); D3.pts = []; d3Rubber(); render3D(); return true; }
            if (mode === 'cline' && (e.key === 'Delete' || e.key === 'Backspace') && !D3.pts.length) { e.preventDefault(); d3ClClear(); return true; }
            // longueur tapée : direction = du dernier point vers la souris
            if (D3.pts.length && ['line', 'pline', 'move', 'copy', 'measure'].includes(mode)) {
                if (/^[0-9]$/.test(e.key) || e.key === ',' || e.key === '.' || (e.key === '-' && !D3.typed)) { e.preventDefault(); D3.typed += e.key === '.' ? ',' : e.key; updateCommandMessageText(D3_TIP[mode] + ' — longueur : ' + D3.typed + ' m puis Espace'); return true; }
                if (e.key === 'Backspace' && D3.typed) { e.preventDefault(); D3.typed = D3.typed.slice(0, -1); updateCommandMessageText(D3_TIP[mode] + ' — longueur : ' + (D3.typed || '…') + ' m'); return true; }
                if ((e.key === ' ' || e.key === 'Enter') && D3.typed) { e.preventDefault(); const L = parseFloat(D3.typed.replace(',', '.')); D3.typed = '';
                    const a = D3.pts[D3.pts.length - 1], c = D3.cur && D3.cur.v; if (!(L) || !c) return true; const ex = V3.exag || 1, r = new THREE.Vector3(c.x - a.x, c.y - a.y, (c.z - a.z) / ex);
                    if (r.length() < 1e-9) return true; r.normalize().multiplyScalar(L); const v = a.clone().add(new THREE.Vector3(r.x, r.y, r.z * ex));
                    d3Click({ __pt: { v, k: 'typed' } }); return true; }
            }
            if (e.key === 'Escape') { e.preventDefault(); if (mode === 'pline' && D3.pts.length >= 2) d3Finish(); else if (D3.pts.length) { D3.pts = []; D3.workZ = null; D3.plane = null; d3Rubber(); render3D(); d3Start(); } else { setMode('select-box'); updateCommandMessageText('VUE 3D : sélection.'); } return true; }
            if ((e.key === 'Enter' || e.key === ' ') && mode === 'pline') { e.preventDefault(); d3Finish(); if (e.key === 'Enter') setMode('select-box'); return true; }
            if (e.key === 'Enter') { e.preventDefault(); setMode('select-box'); updateCommandMessageText('VUE 3D : sélection.'); return true; }
            return false;
        }
