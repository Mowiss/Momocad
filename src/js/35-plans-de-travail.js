        // ---- PLAN DE TRAVAIL / BAR DÉROULÉ : une polyligne tracée le long du mur (face gauche, axe ou face droite) ; le plateau suit le tracé avec ses angles en onglet,
        //      meubles bas sous le plan de travail (plinthe, caissons, joints de façade tous les 60 cm), pieds sous le bar. Posé sur le plancher de l'étage où il est dessiné.
        const CT_DEF = { pt: { k: 'pt', w: 650, ep: 38, h: 900, just: 'gauche', base: 1, mat: 'bois' }, bar: { k: 'bar', w: 450, ep: 40, h: 1100, just: 'axe', base: 0, mat: 'bois' } };
        let ctOpt = JSON.parse(JSON.stringify(CT_DEF)); try { const o = JSON.parse(localStorage.getItem('momocad-ctop') || '{}'); ['pt', 'bar'].forEach(k => Object.assign(ctOpt[k], o[k] || {})); } catch (e) {}
        let ctDraw = null, ctEdit = null;   // ctDraw = 'pt' | 'bar' pendant le tracé ; ctEdit = objet réglé dans le volet
        const CT_MAT = { bois: ['Bois', 0xb08968], blanc: ['Stratifié blanc', 0xf1f5f9], pierre: ['Pierre', 0x6b7280], beton: ['Béton ciré', 0xa8a29e] };
        function ctSave() { try { localStorage.setItem('momocad-ctop', JSON.stringify(ctOpt)); } catch (e) {} }
        function ctBand(C) { const w = mmToWorld(C.w); return C.just === 'gauche' ? [-w, 0] : C.just === 'droite' ? [0, w] : [-w / 2, w / 2]; }
        // altitude du plancher : l'étage de son bâtiment s'il en a un, sinon le dessus de la dalle qui le porte, sinon le sol fini
        function ctZ0(s) { const C = s.ctop; if (s.lvl && s.bid) { const Z = bldById(s.bid), L = Z && (Z.bld.lvls || []).find(l => l.id === s.lvl); if (L && hasZ(L.z)) { C.z0 = L.z; return L.z; } }
            if (hasZ(C.z0)) return C.z0; const p = s.points[0]; let z = null; shapes.forEach(d => { if (d.solid && d.solid.kind === 'box' && d.type === 'poly' && hasZ(d.points[0].z) && pointInPolygon(p.x, p.y, d.points)) { const t = d.points[0].z + (d.solid.H || 0); if (z === null || t > z) z = t; } });
            if (z === null) { try { const tin = getTIN(), tn = tin ? tinZ(p.x, p.y, tin) : null, r = finishedModel().at(p.x, p.y, hasZ(tn) ? tn : undefined); z = r && hasZ(r.z) ? r.z : tn; } catch (e) {} }
            return hasZ(z) ? z : lvlGuessZ(); }
        /* meubles bas : contre le mur (le côté du tracé), façade vers la pièce ; tracé par l'axe : centrés */
        function ctBase(G, C) { const d = mmToWorld(Math.min(C.w - 30, 580)); if (C.just === 'gauche') return { lo: G.ob - d, hi: G.ob, frontLo: true }; if (C.just === 'droite') return { lo: G.oa, hi: G.oa + d, frontLo: false }; const oc = (G.oa + G.ob) / 2; return { lo: oc - d / 2, hi: oc + d / 2, frontLo: true }; }
        function ctGeo(s) { const C = s.ctop, P = s.points; if (!C || !P || P.length < 2) return null; const [oa, ob] = ctBand(C), Q = wallChainGeomRaw(P, false, oa, ob); return { Q, oa, ob }; }
        function startCtop(k) { closeFileMenus(); setMode('pline'); ctDraw = k; ctEdit = null; ctPanel(); updateCommandMessage(); draw(); }
        function ctMake(P) { const k = ctDraw || 'pt', s = { type: 'poly', open: true, layerId: ensureLayer('Blocs mobilier', '#f59e0b'), points: P.map(q => ({ x: q.x, y: q.y })), hatch: false, name: k === 'bar' ? 'Bar' : 'Plan de travail', lvs: 1, ctop: JSON.parse(JSON.stringify(ctOpt[k])) };
            const q = bldRep(s), Z = q && bldZones().length ? bldZoneAt(q.x, q.y) : null; if (Z) { s.bid = Z.bld.id; s.lvl = (bldCur() || null) === Z ? lvlAct : (Z.bld.act || 'rdc'); } shapes.push(s); return s; }
        function ctMsg(s) { const C = s.ctop, G = ctGeo(s); let L = 0; for (let i = 1; i < s.points.length; i++) L += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y); return (C.k === 'bar' ? 'BAR' : 'PLAN DE TRAVAIL') + ' : ' + calculateRealDistance(L) + ' le long du tracé, profondeur ' + nfr(C.w / 10, 0) + ' cm, dessus à ' + nfr(C.h / 10, 0) + ' cm du sol.'; }
        // ---- volet (avant le tracé : réglages par défaut ; sur un objet sélectionné : ses réglages)
        function ctT() { return ctEdit && shapes.includes(ctEdit) ? ctEdit.ctop : ctOpt[ctDraw || 'pt']; }
        function ctFormHTML(C) { const inp = (k, v, u) => `<span>${t2Inp('ct-' + k, v, 70, '')} ${u}</span>`;
            return `<div>Tracé = </div>${vSeg([['gauche', 'face gauche'], ['axe', 'axe'], ['droite', 'face droite']], C.just, "ctSet('just','$')")}
                <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:6px"><span>Profondeur</span>${inp('w', C.w / 10, 'cm')}<span>Hauteur du dessus</span>${inp('h', C.h / 10, 'cm')}<span>Épaisseur du plateau</span>${inp('ep', C.ep / 10, 'cm')}</div>
                <div>Dessous</div>${vSeg([['1', C.k === 'bar' ? 'caissons' : 'meubles bas'], ['0', C.k === 'bar' ? 'pieds' : 'rien (plateau seul)']], String(C.base ? 1 : 0), "ctSet('base','$')")}
                <div style="display:flex;gap:4px;flex-wrap:wrap">${Object.keys(CT_MAT).map(m => `<button type="button" onclick="ctSet('mat','${m}')" style="flex:1;padding:5px;border-radius:6px;border:1px solid ${C.mat === m ? '#a3e635' : '#4b5563'};background:${C.mat === m ? 'rgba(163,230,53,.16)' : '#111827'};color:#e5e7eb;cursor:pointer;font-size:12px">${CT_MAT[m][0]}</button>`).join('')}</div>`; }
        function ctPanel(sh) { if (sh !== undefined) ctEdit = sh; const s = ctEdit && shapes.includes(ctEdit) ? ctEdit : null, C = ctT();
            const close = "t2PanelClose();ctEdit=null;ctDraw=null;setMode('select-box');draw()";
            t2Panel(C.k === 'bar' ? '🍸 Bar déroulé' : '🍳 Plan de travail déroulé', ctFormHTML(C) + (s ? '' : t2Note('Tracez la polyligne le long du mur (la face choisie colle au tracé) ; un angle à chaque clic, Espace ou double-clic pour finir.')), [['Terminer', close, true]], close);
            const p = document.getElementById('t2-panel'); p.onchange = (e) => { const id = e.target.id || ''; if (!id.startsWith('ct-')) return; const k = id.slice(3), v = t2Num(e.target.value); if (!(v > 0)) return; ctT()[k] = Math.round(v * 10); ctAfter(); }; }
        function ctSet(k, v) { const C = ctT(); C[k] = k === 'base' ? +v : v; ctAfter(); }
        function ctAfter() { const ym = document.getElementById('selparam-modal'), inY = ym && !ym.classList.contains('hidden') && selectedShapes.length === 1 && selectedShapes[0] === ctEdit;
            if (ctEdit && shapes.includes(ctEdit)) { invalidateCache(); saveState(); if (typeof is3DOpen === 'function' && is3DOpen()) refresh3D(); } else ctSave();
            if (inY) { if (typeof spLiveCommit === 'function') spLiveCommit(); openSelectionParamModal(); } else ctPanel(); draw(); }
        // clic dans l'emprise (pas seulement sur le tracé)
        function ctAt(wx, wy) { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (!s.ctop || lvlOff2D(s)) continue; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) continue;
                const G = ctGeo(s); if (G && G.Q.some(q => q && pointInPolygon(wx, wy, [q.A0, q.A1, q.B1, q.B0]))) return s; } return null; }
        // ---- plan : contour du plateau, meubles bas en tirets (caissons de 58 cm), pieds du bar
        function drawCtop2D(c, s, col, dx, dy, ls) { const G = ctGeo(s); if (!G) return; const C = s.ctop, mv = (p) => c.moveTo(p.x + dx, p.y + dy), ln = (p) => c.lineTo(p.x + dx, p.y + dy);
            c.save(); c.strokeStyle = col; c.lineWidth = 1.2 / ls; c.setLineDash([]); c.beginPath(); G.Q.forEach(q => { mv(q.A0); ln(q.A1); mv(q.B0); ln(q.B1); }); const q0 = G.Q[0], qn = G.Q[G.Q.length - 1]; mv(q0.A0); ln(q0.B0); mv(qn.A1); ln(qn.B1); c.stroke();
            if (C.base) { const B = ctBase(G, C), f = B.frontLo ? B.lo : B.hi, Q2 = wallChainGeomRaw(s.points, false, f, f); c.setLineDash([4 / ls, 3 / ls]); c.beginPath(); Q2.forEach(q => { mv(q.A0); ln(q.A1); }); c.stroke(); }
            if (C.k === 'bar' && !C.base) { c.setLineDash([]); ctLegs(s, G).forEach(p => { c.beginPath(); c.arc(p.x + dx, p.y + dy, mmToWorld(40), 0, Math.PI * 2); c.stroke(); }); }
            c.restore(); }
        // pieds du bar : aux deux bouts et tous les 1,50 m environ, sur l'axe du plateau
        function ctLegs(s, G) { const oc = (G.oa + G.ob) / 2, J = wallChainGeomRaw(s.points, false, oc, oc), out = [], inset = mmToWorld(120); let tot = 0; J.forEach(q => tot += Math.hypot(q.A1.x - q.A0.x, q.A1.y - q.A0.y));
            const n = Math.max(1, Math.round((tot - 2 * inset) / mmToWorld(1500))), at = (d) => { for (const q of J) { const L = Math.hypot(q.A1.x - q.A0.x, q.A1.y - q.A0.y); if (d <= L + 1e-9) return { x: q.A0.x + (q.A1.x - q.A0.x) * d / L, y: q.A0.y + (q.A1.y - q.A0.y) * d / L }; d -= L; } const q = J[J.length - 1]; return { x: q.A1.x, y: q.A1.y }; };
            for (let i = 0; i <= n; i++) out.push(at(inset + (tot - 2 * inset) * i / n)); return out; }
        // ---- 3D : plateau en onglet, meubles bas (plinthe en retrait, caissons, joints de façade), ou pieds du bar
        function ctop3D(root, vis, P, Zm) { vis.filter(s => s.ctop && s.type === 'poly').forEach(s => { const G = ctGeo(s); if (!G) return; const C = s.ctop, z0 = ctZ0(s), zt = z0 + C.h, zb = zt - C.ep;
            const M = (c) => new THREE.MeshLambertMaterial({ color: c }), topM = M((CT_MAT[C.mat] || CT_MAT.bois)[1]), boxM = M(0xf5f5f4), dark = M(0x374151);
            const prism = (poly, za, zb2, m) => { if (!poly || poly.length < 3 || !(zb2 > za)) return; const sh = new THREE.Shape(); poly.forEach((q, i) => { const a = P(q.x, q.y); i ? sh.lineTo(a.x, a.y) : sh.moveTo(a.x, a.y); });
                const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(1e-3, Zm(zb2) - Zm(za)), bevelEnabled: false }); g.translate(0, 0, Zm(za)); const me = new THREE.Mesh(g, m); me.userData.shape = s; root.add(me); };
            G.Q.forEach(q => prism([q.A0, q.A1, q.B1, q.B0], zb, zt, topM));
            if (C.base) { const B = ctBase(G, C), r = mmToWorld(50), f = B.frontLo ? B.lo : B.hi, e = mmToWorld(2) * (B.frontLo ? 1 : -1);
                wallChainGeomRaw(s.points, false, B.lo, B.hi).forEach(q => prism([q.A0, q.A1, q.B1, q.B0], z0 + 100, zb, boxM));
                wallChainGeomRaw(s.points, false, B.frontLo ? B.lo + r : B.lo, B.frontLo ? B.hi : B.hi - r).forEach(q => prism([q.A0, q.A1, q.B1, q.B0], z0, z0 + 100, dark));   /* plinthe en retrait de 5 cm */
                // joints de façade : un trait vertical tous les 60 cm sur la face avant
                const J = wallChainGeomRaw(s.points, false, Math.min(f - e, f + e / 2), Math.max(f - e, f + e / 2)), sp = mmToWorld(600), jw = mmToWorld(3);
                J.forEach(q => { const L = Math.hypot(q.A1.x - q.A0.x, q.A1.y - q.A0.y), ux = (q.A1.x - q.A0.x) / L, uy = (q.A1.y - q.A0.y) / L; for (let t = sp; t < L - sp * 0.3; t += sp) { const a = { x: q.A0.x + ux * t, y: q.A0.y + uy * t }, b = { x: q.B0.x + ux * t, y: q.B0.y + uy * t };
                    prism([a, { x: a.x + ux * jw, y: a.y + uy * jw }, { x: b.x + ux * jw, y: b.y + uy * jw }, b], z0 + 110, zb - 10, dark); } }); }
            else if (C.k === 'bar') ctLegs(s, G).forEach(p => { const a = P(p.x, p.y), g = new THREE.CylinderGeometry(0.03, 0.03, Math.max(0.01, Zm(zb) - Zm(z0)), 12), me = new THREE.Mesh(g, dark); me.rotation.x = Math.PI / 2; me.position.set(a.x, a.y, (Zm(zb) + Zm(z0)) / 2); me.userData.shape = s; root.add(me); }); }); }
