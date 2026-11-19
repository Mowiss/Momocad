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
        function rcpGeom3D(g, so, P) { if (!g || !so.cuts || !so.cuts.length) return g; try { g.computeBoundingBox(); const bb = g.boundingBox, D = bb.min.distanceTo(bb.max) + 2, z0 = bb.min.z - 1, z1 = bb.max.z + 1; let out = g;
                so.cuts.forEach(c => { const A = P(c.a.x, c.a.y), B = P(c.b.x, c.b.y), K = P(c.k.x, c.k.y), L = Math.hypot(B.x - A.x, B.y - A.y) || 1, u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, sg = Math.sign((B.x - A.x) * (K.y - A.y) - (B.y - A.y) * (K.x - A.x)) || 1, n = { x: u.y * sg, y: -u.x * sg };
                    const R = D + Math.hypot(A.x - (bb.min.x + bb.max.x) / 2, A.y - (bb.min.y + bb.max.y) / 2), a = { x: A.x - u.x * R, y: A.y - u.y * R }, b = { x: B.x + u.x * R, y: B.y + u.y * R };
                    const sh = new THREE.Shape([a, b, { x: b.x + n.x * R, y: b.y + n.y * R }, { x: a.x + n.x * R, y: a.y + n.y * R }].map(q => new THREE.Vector2(q.x, q.y))), pr = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); pr.translate(0, 0, z0);
                    out = csgGeom(out, [pr], 'sub'); });
                return out; } catch (e) { return g; } }
        // aperçu : le trait, et la partie retirée en rouge
        function drawRecoupePreview(c) { if (mode !== 'recoupe' || !rcp || !rcp.a) return; const zf = camera.zoom, b = rcp.b || { x: currentX, y: currentY }; c.save(); c.strokeStyle = '#f43f5e'; c.lineWidth = 2 / zf; c.setLineDash([8 / zf, 5 / zf]);
            c.beginPath(); c.moveTo(rcp.a.x, rcp.a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
            if (rcp.b) { const side = rcpSide(rcp.a, rcp.b, { x: currentX, y: currentY }); if (side) { const H = rcpHalf({ a: rcp.a, b: rcp.b, k: { x: currentX, y: currentY } }, false, mmToWorld(1e5)); c.beginPath(); H.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.clip();
                    c.fillStyle = 'rgba(244,63,94,.28)'; rcp.T.forEach(s => { const bb = getShapesBoundingBox([s]); if (bb) c.fillRect(bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY); }); } }
            c.restore(); }
        function rcpClear(gid) { const S = shapes.filter(x => (gid && x.groupId === gid) || selectedShapes.includes(x)); S.forEach(x => { delete x.cuts; }); invalidateCache(); saveState(); draw(); refresh3D(); if (selectedShapes.length) openSelectionParamModal(); }
