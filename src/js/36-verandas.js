        // ============ VÉRANDAS : parois vitrées sur ossature alu, toiture vitrée sur chevrons alu (vue 3D) ============
        /* Une paroi en matériau « verre » (préréglage Véranda) et un toit coché « Toiture de véranda » sont rendus en vitrage ; leur ossature alu (montants,
           lisses, chevrons) est ajoutée autour, sans toucher au modèle : métrés, coupes, ouvertures restent ceux de la paroi ou du toit. */
        const VER_ALU = 0x3f4752, VER_STEP = 1.0;
        function verIsWall(o) { return !!o && o.wallMat === 'verre' && o.type === 'hatch'; }
        function verIsRoof(o) { return !!o && o.solid && o.solid.kind === 'roof' && !!(o.roofDef && o.roofDef.o && o.roofDef.o.ver); }
        function verIsGlass(o) { return verIsWall(o) || (!!o && (!!(o.roofDef && o.roofDef.o && o.roofDef.o.ver) || o.ver === 1)); }   /* pans et pignons comblés d'un toit de véranda */
        function verGlass() { return new THREE.MeshLambertMaterial({ color: 0xcfe8f7, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }); }
        function verAlu() { return new THREE.MeshLambertMaterial({ color: VER_ALU }); }
        // une barre droite d'une extrémité à l'autre (repère de la scène), section w × h (m), h dans le plan vertical qui la contient
        function verBar(A, B, w, h, mat) { const L = A.distanceTo(B); if (L < 1e-4) return null; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, L), mat); m.position.copy(A).add(B).multiplyScalar(0.5);
            const d = B.clone().sub(A).normalize(); m.up.set(0, 0, 1); if (Math.abs(d.z) > 0.999) m.up.set(1, 0, 0); m.lookAt(m.position.clone().add(d)); m.userData.verFrame = true; return m; }
        // paroi de véranda : montants à chaque bout et tous les mètres au plus (pas dans les baies), lisse basse (sauf sous les portes) et lisse haute
        function verWallFrame(o, g, P) { const s = wallQuadSeg(o); if (!s) return []; g.computeBoundingBox(); const zb = g.boundingBox.min.z, zt = g.boundingBox.max.z, H = zt - zb; if (H < 0.05) return [];
            const a = P(s.p.x, s.p.y), b = P(s.q.x, s.q.y), A = new THREE.Vector3(a.x, a.y, 0), B = new THREE.Vector3(b.x, b.y, 0), L = A.distanceTo(B), T = Math.max(0.03, worldToMm(s.T) / 1000), w = Math.min(0.07, L / 4), mat = verAlu(), out = [];
            if (L < 0.05) return []; const u = B.clone().sub(A).divideScalar(L), at = (t, z) => A.clone().addScaledVector(u, t).setZ(z), tOf = (q) => { const r = P(q.x, q.y); return (r.x - A.x) * u.x + (r.y - A.y) * u.y; };
            const spans = (o.openings || []).filter(op => op.a && op.b).map(op => { const t0 = tOf(op.a), t1 = tOf(op.b); return { a: Math.min(t0, t1), b: Math.max(t0, t1), door: op.kind !== 'fen' }; });
            const inOp = (t, door) => spans.some(sp => (!door || sp.door) && t > sp.a - w / 2 && t < sp.b + w / 2);
            const n = Math.max(1, Math.ceil((L - w) / VER_STEP)); for (let i = 0; i <= n; i++) { const t = w / 2 + (L - w) * i / n; if (inOp(t)) continue; const m = verBar(at(t, zb), at(t, zt), w, T * 0.9, mat); if (m) out.push(m); }
            spans.forEach(sp => [sp.a - w / 2, sp.b + w / 2].forEach(t => { if (t > w / 2 && t < L - w / 2) { const m = verBar(at(t, zb), at(t, zt), w, T * 0.9, mat); if (m) out.push(m); } }));   /* montants de part et d'autre de chaque baie */
            const cuts = spans.filter(sp => sp.door).sort((x, y) => x.a - y.a); let t0 = 0; cuts.concat([{ a: L, b: L }]).forEach(sp => { if (sp.a - t0 > 0.02) { const m = verBar(at(t0, zb + 0.04), at(Math.min(sp.a, L), zb + 0.04), T * 0.9, 0.08, mat); if (m) out.push(m); } t0 = Math.max(t0, sp.b); });
            { const m = verBar(at(0, zt - 0.04), at(L, zt - 0.04), T * 0.9, 0.08, mat); if (m) out.push(m); } return out; }
        // pan de toiture de véranda : chevrons sous le vitrage, perpendiculaires à l'égout, tous les o.verE (m), plus un sur chaque rive
        function verRoofFrame(o, mesh, P) { const Q = o.points, n = Q.length, eg = o.solid.eg >= 0 && o.solid.eg < n ? o.solid.eg : 0, step = (o.roofDef.o.verE || 0.8), mat = verAlu(), out = [];
            const pts = Q.map(q => P(q.x, q.y)), a = pts[eg], b = pts[(eg + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 0.1) return [];
            const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, c = pts.reduce((s, q) => ({ x: s.x + q.x / n, y: s.y + q.y / n }), { x: 0, y: 0 }); let v = { x: -u.y, y: u.x }; if ((c.x - a.x) * v.x + (c.y - a.y) * v.y < 0) v = { x: u.y, y: -u.x };
            const ray = new THREE.Raycaster(), dn = new THREE.Vector3(0, 0, -1); mesh.updateMatrixWorld(true);
            const under = (x, y) => { ray.set(new THREE.Vector3(x, y, 1e5), dn); const H = ray.intersectObject(mesh); return H.length ? H[H.length - 1].point.z : null; };   /* dessous du vitrage */
            const clip = (s0) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { const p0 = pts[i], p1 = pts[(i + 1) % n], ex = p1.x - p0.x, ey = p1.y - p0.y, den = v.x * ey - v.y * ex; if (Math.abs(den) < 1e-12) continue;
                    const t = ((p0.x - s0.x) * ey - (p0.y - s0.y) * ex) / den, k = ((p0.x - s0.x) * v.y - (p0.y - s0.y) * v.x) / den; if (k >= -1e-9 && k <= 1 + 1e-9) { lo = Math.min(lo, t); hi = Math.max(hi, t); } } return hi > lo ? [lo, hi] : null; };
            const ns = Math.max(1, Math.round(L / step)); for (let i = 0; i <= ns; i++) { const t = 0.04 + (L - 0.08) * i / ns, s0 = { x: a.x + u.x * t, y: a.y + u.y * t }, R = clip(s0); if (!R) continue;
                const p0 = { x: s0.x + v.x * (R[0] + 0.01), y: s0.y + v.y * (R[0] + 0.01) }, p1 = { x: s0.x + v.x * (R[1] - 0.01), y: s0.y + v.y * (R[1] - 0.01) }, z0 = under(p0.x, p0.y), z1 = under(p1.x, p1.y); if (z0 === null || z1 === null) continue;
                const m = verBar(new THREE.Vector3(p0.x, p0.y, z0 - 0.05), new THREE.Vector3(p1.x, p1.y, z1 - 0.05), 0.06, 0.1, mat); if (m) out.push(m); }
            return out; }
