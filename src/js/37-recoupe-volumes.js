        // ---- RECOUPER : un trait (2 clics) puis un clic du côté à garder ; les objets sélectionnés (toit, dalle, volume…) perdent tout ce qui dépasse de l'autre côté,
        //      en plan comme en 3D. La recoupe est gardée sur l'objet (elle suit déplacements, rotations, symétries) et se retire avec Y.
        let rcp = null;   // { T: objets visés, a, b }
        function rcpTargets(S) { const out = new Set(); S.forEach(s => { (s.groupId ? shapes.filter(x => x.groupId === s.groupId) : [s]).forEach(x => { if (is3DObj(x) || x.solid || x.roofDef || x.roofPart || (x.type === 'poly' && !x.open) || x.type === 'hatch') out.add(x); }); }); return [...out].filter(x => !x.bld && x.type !== 'point'); }
        function startRecoupe() { closeFileMenus(); const T = rcpTargets(selectedShapes); setMode('recoupe'); rcp = { T, a: null, b: null }; updateCommandMessage(); draw(); }
        function rcpMsg() { if (!rcp) return ''; if (!rcp.T.length) return 'RECOUPER : cliquez l\'objet à recouper (toit, dalle, volume…) ; pour plusieurs, sélectionnez-les avant de lancer l\'outil.';
            return 'RECOUPER (' + rcp.T.length + ' objet' + (rcp.T.length > 1 ? 's' : '') + ') : ' + (!rcp.a ? 'premier point du trait de coupe (accroches : face de mur, angle…).' : !rcp.b ? 'second point du trait de coupe.' : 'cliquez du côté à GARDER (la partie en rouge disparaît).'); }
        function rcpClick(x, y) { if (!rcp) return; const sn = findSnap(x, y), p = sn ? { x: sn.x, y: sn.y } : { x, y };
            if (!rcp.T.length) { const t = findShapeAt(x, y); const T = t ? rcpTargets([t]) : []; if (!T.length) { updateCommandMessageText('RECOUPER : rien à recouper ici — cliquez un toit, une dalle ou un volume.'); return; } rcp.T = T; selectedShapes = T; updateCommandMessage(); draw(); return; }
            if (!rcp.a) { rcp.a = p; updateCommandMessage(); draw(); return; }
            if (!rcp.b) { if (Math.hypot(p.x - rcp.a.x, p.y - rcp.a.y) < mmToWorld(10)) return; rcp.b = p; updateCommandMessage(); draw(); return; }
            const k = { x, y }, side = rcpSide(rcp.a, rcp.b, k); if (!side) return; rcp.T.forEach(s => { s.cuts = (s.cuts || []).concat([{ a: { x: rcp.a.x, y: rcp.a.y }, b: { x: rcp.b.x, y: rcp.b.y }, k }]); });
            const n = rcp.T.length; rcp = null; invalidateCache(); saveState(); setMode('select-box'); draw(); refresh3D(); updateCommandMessageText('RECOUPER : ' + n + ' objet' + (n > 1 ? 's' : '') + ' recoupé' + (n > 1 ? 's' : '') + '. Y sur l\'objet pour retirer ses recoupes.'); }
        function rcpSide(a, b, k) { const c = (b.x - a.x) * (k.y - a.y) - (b.y - a.y) * (k.x - a.x); return Math.abs(c) < 1e-12 ? 0 : Math.sign(c); }
        // demi-plan d'une recoupe, côté gardé (keep = true) ou côté retiré, en polygone assez grand pour couvrir R (unités du plan)
        function rcpHalf(c, keep, R) { const L = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) || 1, u = { x: (c.b.x - c.a.x) / L, y: (c.b.y - c.a.y) / L }, sg = rcpSide(c.a, c.b, c.k) * (keep ? 1 : -1), n = { x: -u.y * sg, y: u.x * sg };
            const A = { x: c.a.x - u.x * R, y: c.a.y - u.y * R }, B = { x: c.b.x + u.x * R, y: c.b.y + u.y * R }; return [A, B, { x: B.x + n.x * R, y: B.y + n.y * R }, { x: A.x + n.x * R, y: A.y + n.y * R }]; }
        // plan : ce qui est du côté retiré n'est pas dessiné
        function rcpClip2D(ctx, s, dx, dy) { if (!s.cuts || !s.cuts.length) return; const R = mmToWorld(1e6); s.cuts.forEach(c => { const H = rcpHalf(c, true, R); ctx.beginPath(); H.forEach((q, i) => i ? ctx.lineTo(q.x + (dx || 0), q.y + (dy || 0)) : ctx.moveTo(q.x + (dx || 0), q.y + (dy || 0))); ctx.closePath(); ctx.clip(); }); }
        // trait de la recoupe dans l'objet (le bord coupé), en plan
        function rcpEdge2D(ctx, s, sel, dx, dy, ls) { if (!s.cuts || !s.cuts.length || !s.points || s.points.length < 3) return; ctx.save(); ctx.beginPath(); s.points.forEach((q, i) => i ? ctx.lineTo(q.x + dx, q.y + dy) : ctx.moveTo(q.x + dx, q.y + dy)); ctx.closePath(); ctx.clip();
            ctx.strokeStyle = sel ? '#ec4899' : effectiveColor(s, false); ctx.lineWidth = 1.2 / (ls || camera.zoom); ctx.setLineDash([]); const R = mmToWorld(1e6);
            s.cuts.forEach(c => { const L = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) || 1, u = { x: (c.b.x - c.a.x) / L, y: (c.b.y - c.a.y) / L }; ctx.beginPath(); ctx.moveTo(c.a.x - u.x * R + dx, c.a.y - u.y * R + dy); ctx.lineTo(c.b.x + u.x * R + dx, c.b.y + u.y * R + dy); ctx.stroke(); }); ctx.restore(); }
        // 3D : la géométrie perd un prisme vertical posé du côté retiré (booléen)
        // 3D : chaque triangle est coupé par le plan vertical de la recoupe (on garde le côté choisi), puis la tranche est refermée par une face plane ;
        //      marche aussi pour les surfaces ouvertes (pans de toit), sans booléen
        function rcpGeom3D(g, so, P) { if (!g || !so.cuts || !so.cuts.length) return g; try {
                let pos = Array.from((g.index ? g.toNonIndexed() : g).attributes.position.array);
                const inw = signedVol(pos) < 0 ? -1 : 1;
                so.cuts.forEach(c => { const A = P(c.a.x, c.a.y), B = P(c.b.x, c.b.y), K = P(c.k.x, c.k.y), L = Math.hypot(B.x - A.x, B.y - A.y) || 1, u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, sg = Math.sign((B.x - A.x) * (K.y - A.y) - (B.y - A.y) * (K.x - A.x)) || 1, n = { x: -u.y * sg, y: u.x * sg };
                    const d = (q) => (q[0] - A.x) * n.x + (q[1] - A.y) * n.y, out = [], segs = [], E = 1e-7;
                    for (let t = 0; t < pos.length; t += 9) { const V = [[pos[t], pos[t + 1], pos[t + 2]], [pos[t + 3], pos[t + 4], pos[t + 5]], [pos[t + 6], pos[t + 7], pos[t + 8]]], D = V.map(d);
                        if (D.every(x => x >= -E)) { out.push(...V[0], ...V[1], ...V[2]); continue; } if (D.every(x => x <= E)) continue;
                        const Q = [], on = []; for (let i = 0; i < 3; i++) { const a = V[i], b = V[(i + 1) % 3], da = D[i], db = D[(i + 1) % 3]; if (da >= -E) Q.push(a); if ((da > E && db < -E) || (da < -E && db > E)) { const k = da / (da - db), q = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; Q.push(q); on.push(q); } else if (Math.abs(da) <= E) on.push(a); }
                        for (let i = 1; i + 1 < Q.length; i++) out.push(...Q[0], ...Q[i], ...Q[i + 1]); if (on.length === 2) segs.push(on); }
                    // tranche : les segments posés sur le plan forment des boucles, triangulées dans le plan (abscisse le long du trait, altitude)
                    const key = (q) => Math.round(((q[0] - A.x) * u.x + (q[1] - A.y) * u.y) * 1e4) + ',' + Math.round(q[2] * 1e4), adj = new Map(); segs.forEach(([a, b]) => { const ka = key(a), kb = key(b); if (ka === kb) return; (adj.get(ka) || adj.set(ka, []).get(ka)).push([kb, b, a]); (adj.get(kb) || adj.set(kb, []).get(kb)).push([ka, a, b]); });
                    const used = new Set(); adj.forEach((_, k0) => { if (used.has(k0)) return; const loop = []; let k = k0, prev = null, guard = 0; while (guard++ < 10000) { used.add(k); const nx = (adj.get(k) || []).find(x => x[0] !== prev && (!used.has(x[0]) || (x[0] === k0 && loop.length > 2))); if (!nx) break; loop.push(nx[2]); if (nx[0] === k0) { loop.closed = true; break; } prev = k; k = nx[0]; }
                        if (!loop.closed || loop.length < 3) return; const v2 = loop.map(q => new THREE.Vector2((q[0] - A.x) * u.x + (q[1] - A.y) * u.y, q[2])), T = THREE.ShapeUtils.triangulateShape(v2, []);
                        T.forEach(([i0, i1, i2]) => { let a = loop[i0], b = loop[i1], cc = loop[i2]; const nn = [(b[1] - a[1]) * (cc[2] - a[2]) - (b[2] - a[2]) * (cc[1] - a[1]), (b[2] - a[2]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[2] - a[2])]; if ((nn[0] * n.x + nn[1] * n.y > 0) !== (inw < 0)) { const tmp = b; b = cc; cc = tmp; } out.push(...a, ...b, ...cc); }); });   /* tranche dans le sens des autres faces (maillage tourné vers l'intérieur : tranche aussi) */
                    pos = out; });
                const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.computeVertexNormals(); return o; } catch (e) { return g; } }
        // aperçu : le trait, et la partie retirée en rouge
        function drawRecoupePreview(c) { if (mode !== 'recoupe' || !rcp || !rcp.a) return; const zf = camera.zoom, b = rcp.b || { x: currentX, y: currentY }; c.save(); c.strokeStyle = '#f43f5e'; c.lineWidth = 2 / zf; c.setLineDash([8 / zf, 5 / zf]);
            c.beginPath(); c.moveTo(rcp.a.x, rcp.a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
            if (rcp.b) { const side = rcpSide(rcp.a, rcp.b, { x: currentX, y: currentY }); if (side) { const H = rcpHalf({ a: rcp.a, b: rcp.b, k: { x: currentX, y: currentY } }, false, mmToWorld(1e5)); c.beginPath(); H.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.clip();
                    c.fillStyle = 'rgba(244,63,94,.28)'; rcp.T.forEach(s => { const bb = getShapesBoundingBox([s]); if (bb) c.fillRect(bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY); }); } }
            c.restore(); }
        function rcpClear(gid) { const S = shapes.filter(x => (gid && x.groupId === gid) || selectedShapes.includes(x)); S.forEach(x => { delete x.cuts; }); invalidateCache(); saveState(); draw(); refresh3D(); if (selectedShapes.length) openSelectionParamModal(); }
        // ---- POINT D'ANCRAGE de la vue 3D (drapeau de la rosace) : un clic sur la maquette le pose ; la caméra tourne et zoome toujours autour ; un 2e clic sur le drapeau le retire
        // curseur « drapeau en main » : la pointe du mât est le point visé
        const PIN_CUR = 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 30V3" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M5 30V3" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M6 3.5L24 9.5L6 16Z" fill="#bef264" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="5" cy="30" rx="4" ry="1.5" fill="none" stroke="#000" stroke-width="1.2"/></svg>') + '") 5 30, crosshair';
        function v3PinCursor() { if (!V3 || !V3.renderer) return; V3.renderer.domElement.style.cursor = V3.pinPick ? PIN_CUR : ''; }
        function v3PinToggle() { if (!V3) return; if (V3.pin) { V3.pin = null; V3.pinRoot = null; V3.pinWarn = 0; PIN3D = null; try { updateTitle(); } catch (e) {} v3PinMark(); updateCommandMessageText('VUE 3D : drapeau retiré.'); }
            else { V3.pinPick = !V3.pinPick; updateCommandMessageText(V3.pinPick ? 'VUE 3D : drapeau en main — cliquez un point de la maquette (sol, mur, toit…) pour le planter. Échap : annuler.' : 'VUE 3D : drapeau reposé.'); }
            v3PinCursor(); render3D(); }
        /* le drapeau est gardé dans le fichier, en coordonnées réelles (m, altitude sans exagération) : on le retrouve à la réouverture de la 3D et du plan */
        let PIN3D = null;
        function v3PinReal() { if (!V3 || !V3.pin) return null; const c = V3.center || { x: 0, y: 0 }, ex = V3.exag || 1, z0 = V3.zmin || 0, P = V3.pin.clone(); if (V3.root && V3.pinRoot) P.add(V3.root.position.clone().sub(V3.pinRoot));
            return { x: Math.round((P.x + c.x) * 1000) / 1000, y: Math.round((P.y + c.y) * 1000) / 1000, z: Math.round((P.z / ex + z0) * 1000) / 1000 }; }
        function v3PinSave() { if (typeof V3 !== 'undefined' && V3 && V3.pin) PIN3D = v3PinReal(); return PIN3D; }
        function v3PinRestore() { if (!V3 || V3.pin || !PIN3D) { v3PinMark(); return; } const c = V3.center || { x: 0, y: 0 }, ex = V3.exag || 1, z0 = V3.zmin || 0;
            V3.pin = new THREE.Vector3(PIN3D.x - c.x, PIN3D.y - c.y, (PIN3D.z - z0) * ex); V3.pinRoot = V3.root ? V3.root.position.clone() : null; V3.target.copy(V3.pin); v3PinMark(); }
        function v3PinAt(e) { const cv = V3.renderer.domElement, r = cv.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V3.camera);
            const h = ray.intersectObjects(V3.root.children, true).find(x => x.object.visible !== false && !(x.object.userData && x.object.userData.pinMark)); if (!h) { updateCommandMessageText('VUE 3D : rien sous le curseur — cliquez sur la maquette.'); return; }
            V3.pinPick = false; v3PinCursor(); const d = V3.camera.position.distanceTo(h.point); V3.pin = h.point.clone(); V3.pinRoot = V3.root.position.clone(); V3.target.copy(V3.pin); V3.dist = Math.max(V3.R * 0.01, Math.min(d, V3.R * 50)); V3.pinWarn = 0; PIN3D = v3PinReal(); try { updateTitle(); } catch (e) {}
            updateCommandMessageText('VUE 3D : drapeau planté — glisser tourne autour, la molette zoome sur lui. Drapeau de la rosace pour le retirer.'); render3D(); }
        // repère du drapeau dans la scène (mât + fanion), à taille constante à l'écran
        function v3PinMark() { if (!V3 || !V3.scene) return; let M = V3.pinMesh; if (!V3.pin || V3.noPin || (typeof lp3D !== 'undefined' && lp3D.live)) { if (M) M.visible = false; return; }   /* noPin : rendu, fenêtre de présentation, façade texturée — le drapeau n'est jamais dans une image */
            if (!M) { M = new THREE.Group(); const mat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 }), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mat); pole.rotation.x = Math.PI / 2; pole.position.z = 0.5;
                const fl = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1, 0.55, 0, 0.82, 0, 0, 0.64], 3)), new THREE.MeshLambertMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }));
                [pole, fl].forEach(x => { x.userData.pinMark = 1; M.add(x); }); M.userData.pinMark = 1; V3.scene.add(M); V3.pinMesh = M; }
            M.visible = true; M.position.copy(V3.pin); M.scale.set(1.8, 1.8, 1.8 * (V3.exag > 0 ? V3.exag : 1));   /* à l'échelle humaine : 1,80 m */ M.rotation.z = -V3.az; }
        // ---- DÉCOUPE 3D (volet 3D › Outils) : un clic sur la partie d'un volume à enlever, un clic sur un plan qui le coupe (face de mur, de toit, de dalle…) : le bout cliqué disparaît.
        //      Plan vertical : c'est une recoupe (plan et 3D, comme l'outil Recouper). Plan incliné ou horizontal : découpe gardée sur l'objet (s.cut3, en mm réels), en 3D, coupes et façades. Y sur l'objet pour les retirer.
        function cut3Start() { if (!V3 || !is3DOpen()) return; V3.cut3 = { s: null }; V3.pinPick = false; selectedShapes = []; try { v3PanelClose(); } catch (e) {} V3.renderer.domElement.style.cursor = 'crosshair'; render3D(); updateCommandMessageText('DÉCOUPE 3D : cliquez la partie du volume qui doit disparaître. Échap : annuler.'); }
        function cut3Stop(msg) { if (V3) { V3.cut3 = null; if (V3.renderer) V3.renderer.domElement.style.cursor = ''; } selectedShapes = []; if (is3DOpen()) { build3DScene(); render3D(); } draw(); if (msg) updateCommandMessageText(msg); }
        // scène (m, posée sur V3.root) → repère réel en mm (x est, y nord, z altitude)
        function cut3Real(v) { const rp = V3.root ? V3.root.position : { x: 0, y: 0, z: 0 }, ex = V3.exag || 1; return [(v.x - rp.x) * 1000, (v.y - rp.y) * 1000, ((v.z - rp.z) / ex + (V3.zmin || 0)) * 1000]; }
        function cut3Hits(e) { const cv = V3.renderer.domElement, r = cv.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V3.camera);
            return ray.intersectObjects(V3.root.children, true).filter(h => h.object.isMesh && h.object.visible !== false && h.face && !(h.object.userData && h.object.userData.pinMark)); }
        const cut3ShapeOf = (o) => { let q = o; while (q) { if (q.userData && q.userData.shape) return q.userData.shape; q = q.parent; } return null; };
        function cut3Click(e) { const C = V3.cut3; if (!C) return; const H = cut3Hits(e);
            if (!C.s) { const h = H.find(x => { const s = cut3ShapeOf(x.object); return s && is3DObj(s); }); if (!h) { updateCommandMessageText('DÉCOUPE 3D : cliquez un volume (mur, dalle, toit, poutre…).'); return; }
                C.s = cut3ShapeOf(h.object); C.h = cut3Real(h.point); selectedShapes = [C.s]; build3DScene(); render3D();
                updateCommandMessageText('DÉCOUPE 3D — ' + d3ObjName(C.s) + ' : cliquez le plan qui le coupe (une face de mur, de toit, de dalle…) ; le bout cliqué disparaît. Échap : annuler.'); return; }
            const h = H.find(x => cut3ShapeOf(x.object) !== C.s) || H[0]; if (!h) { updateCommandMessageText('DÉCOUPE 3D : cliquez une face (mur, toit, dalle…) qui coupe le volume.'); return; }
            const nw = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize(), ex = V3.exag || 1, p = cut3Real(h.point); let n = [nw.x, nw.y, nw.z * ex]; const L = Math.hypot(...n); n = n.map(v => v / L);
            cut3Apply(C.s, p, n, C.h); }
        // coupe l'objet s (et les couches de son mur) par le plan (p, n) en mm réels ; le côté du point h disparaît. Vérifiée : si rien n'est enlevé, on n'y touche pas.
        function cut3Apply(s, p, n, h) { const d = (h[0] - p[0]) * n[0] + (h[1] - p[1]) * n[1] + (h[2] - p[2]) * n[2]; if (Math.abs(d) < 1) { cut3Stop('DÉCOUPE 3D : le point cliqué est sur le plan ; recommencez en cliquant la partie à enlever.'); return false; }
            const k = d > 0 ? -1 : 1, nk = n.map(v => v * k);   // normale tournée vers le côté gardé
            const T = s.wallMat && s.groupId ? shapes.filter(x => x.groupId === s.groupId && is3DObj(x)) : [s], vol = (o) => { try { const t = objTrisMM(o); return t ? signedVol(t) / 1e9 : 0; } catch (er) { return 0; } }, v0 = T.map(vol);
            const vert = Math.abs(nk[2]) < 1e-3, keep = T.map(o => ({ cuts: o.cuts, cut3: o.cut3 }));
            T.forEach(o => { if (vert) { const hx = Math.hypot(nk[0], nk[1]) || 1, ux = -nk[1] / hx, uy = nk[0] / hx, W = (x, y) => ({ x: mmToWorld(x), y: -mmToWorld(y) });
                    o.cuts = (o.cuts || []).concat([{ a: W(p[0], p[1]), b: W(p[0] + ux * 1000, p[1] + uy * 1000), k: W(p[0] + nk[0] / hx * 1000, p[1] + nk[1] / hx * 1000) }]); }
                else o.cut3 = (o.cut3 || []).concat([{ a: { x: mmToWorld(p[0]), y: -mmToWorld(p[1]) }, k: { x: mmToWorld(p[0] + nk[0] * 1000), y: -mmToWorld(p[1] + nk[1] * 1000) }, z: Math.round(p[2] * 10) / 10, nz: Math.round(nk[2] * 1e6) / 1e6 }]); });   /* repères en plan (ils suivent déplacements, rotations, symétries) + altitude et pente du plan */
            const v1 = T.map(vol), gone = v0.reduce((a, v, i) => a + Math.max(0, v - v1[i]), 0);
            if (!(gone > 1e-6) || v1.every(v => v <= 1e-9)) { T.forEach((o, i) => { if (keep[i].cuts) o.cuts = keep[i].cuts; else delete o.cuts; if (keep[i].cut3) o.cut3 = keep[i].cut3; else delete o.cut3; }); cut3Stop('DÉCOUPE 3D : ce plan ' + (gone > 1e-6 ? 'enlèverait tout le volume' : 'ne coupe pas le volume') + ' — rien n\'est changé.'); return false; }
            invalidateCache(); saveState(); cut3Stop('DÉCOUPE 3D : ' + d3ObjName(s) + ' coupé, ' + nfr(gone, 3) + ' m³ enlevés' + (vert ? ' (en plan aussi)' : '') + '. Y sur l\'objet pour retirer ses découpes.'); return true; }
        // 3D : le plan coupe chaque triangle (côté gardé seulement), la tranche est refermée par une face plane
        function cut3Geom3D(g, so, P, Zm) { if (!g || !so.cut3 || !so.cut3.length) return g; try {
                let pos = Array.from((g.index ? g.toNonIndexed() : g).attributes.position.array); const inw = signedVol(pos) < 0 ? -1 : 1;
                const S = (x, y, z) => { const q = P(mmToWorld(x), -mmToWorld(y)); return [q.x, q.y, Zm(z)]; }, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                so.cut3.forEach(c => { const p0 = [worldToMm(c.a.x), -worldToMm(c.a.y), c.z], nh = [worldToMm(c.k.x - c.a.x) / 1000, -worldToMm(c.k.y - c.a.y) / 1000], n0 = [nh[0], nh[1], c.nz], ln0 = Math.hypot(...n0) || 1, n = n0.map(v => v / ln0); c = { p: p0, n }; const t1 = Math.abs(n[2]) < 0.9 ? cr(n, [0, 0, 1]) : cr(n, [1, 0, 0]), t2 = cr(n, t1), l1 = Math.hypot(...t1), l2 = Math.hypot(...t2);
                    const A = S(...c.p), B = S(c.p[0] + t1[0] / l1 * 1000, c.p[1] + t1[1] / l1 * 1000, c.p[2] + t1[2] / l1 * 1000), Cc = S(c.p[0] + t2[0] / l2 * 1000, c.p[1] + t2[1] / l2 * 1000, c.p[2] + t2[2] / l2 * 1000), K = S(c.p[0] + n[0] * 1000, c.p[1] + n[1] * 1000, c.p[2] + n[2] * 1000);
                    let N = cr(sub(B, A), sub(Cc, A)); const ln = Math.hypot(...N) || 1; N = N.map(v => v / ln); if (dot(N, sub(K, A)) < 0) N = N.map(v => -v);
                    const U = sub(B, A), lu = Math.hypot(...U) || 1, Ux = U.map(v => v / lu), Vx = cr(N, Ux), E = 1e-7, d = (q) => dot(sub(q, A), N), out = [], segs = [];
                    for (let t = 0; t < pos.length; t += 9) { const V = [[pos[t], pos[t + 1], pos[t + 2]], [pos[t + 3], pos[t + 4], pos[t + 5]], [pos[t + 6], pos[t + 7], pos[t + 8]]], D = V.map(d);
                        if (D.every(x => x >= -E)) { out.push(...V[0], ...V[1], ...V[2]); continue; } if (D.every(x => x <= E)) continue;
                        const Q = [], on = []; for (let i = 0; i < 3; i++) { const a = V[i], b = V[(i + 1) % 3], da = D[i], db = D[(i + 1) % 3]; if (da >= -E) Q.push(a); if ((da > E && db < -E) || (da < -E && db > E)) { const k = da / (da - db), q = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; Q.push(q); on.push(q); } else if (Math.abs(da) <= E) on.push(a); }
                        for (let i = 1; i + 1 < Q.length; i++) out.push(...Q[0], ...Q[i], ...Q[i + 1]); if (on.length === 2) segs.push(on); }
                    const uv = (q) => [dot(sub(q, A), Ux), dot(sub(q, A), Vx)], key = (q) => uv(q).map(v => Math.round(v * 1e4)).join(','), adj = new Map();
                    segs.forEach(([a, b]) => { const ka = key(a), kb = key(b); if (ka === kb) return; (adj.get(ka) || adj.set(ka, []).get(ka)).push([kb, b, a]); (adj.get(kb) || adj.set(kb, []).get(kb)).push([ka, a, b]); });
                    const used = new Set(); adj.forEach((_, k0) => { if (used.has(k0)) return; const loop = []; let k = k0, prev = null, guard = 0; while (guard++ < 10000) { used.add(k); const nx = (adj.get(k) || []).find(x => x[0] !== prev && (!used.has(x[0]) || (x[0] === k0 && loop.length > 2))); if (!nx) break; loop.push(nx[2]); if (nx[0] === k0) { loop.closed = true; break; } prev = k; k = nx[0]; }
                        if (!loop.closed || loop.length < 3) return; const v2 = loop.map(q => { const w = uv(q); return new THREE.Vector2(w[0], w[1]); }), Tr = THREE.ShapeUtils.triangulateShape(v2, []);
                        Tr.forEach(([i0, i1, i2]) => { let a = loop[i0], b = loop[i1], cc = loop[i2]; if ((dot(cr(sub(b, a), sub(cc, a)), N) > 0) !== (inw < 0)) { const tmp = b; b = cc; cc = tmp; } out.push(...a, ...b, ...cc); }); });   // tranche tournée vers le côté enlevé
                    pos = out; });
                const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.computeVertexNormals(); return o; } catch (e) { console.error(e); return g; } }
