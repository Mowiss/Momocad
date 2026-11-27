        // ---- ESCALIER D'ÉTAGE : une polyligne tracée de bas en haut (depuis le pied, à l'étage où l'on est) relie cet étage à celui du dessus.
        //      Tracé par la gauche, l'axe ou la droite de l'escalier ; marches réglées par Blondel (hauteur visée, giron) ; un palier à chaque angle ;
        //      garde-corps à gauche, à droite ou des deux côtés. Les altitudes suivent les étages du bâtiment (changer une hauteur d'étage refait l'escalier).
        let st2Opt = { just: 'axe', w: 900, hc: 175, g: 270, nez: 30, mat: 'beton', gc: 'droite', gch: 1000 };
        try { Object.assign(st2Opt, JSON.parse(localStorage.getItem('momocad-stair2') || '{}')); } catch (e) {}
        let stair2Draw = false;
        const ST2_MAT = { beton: ['Béton', 0xb8b2aa], bois: ['Bois', 0xa0764b], pierre: ['Pierre', 0xd6c7a1] };
        function st2Save() { try { localStorage.setItem('momocad-stair2', JSON.stringify(st2Opt)); } catch (e) {} }
        // étages reliés : l'étage où l'on est dans le bâtiment du pied, et celui juste au-dessus
        function st2LevelsAt(p) { const Z = bldZones().length ? bldZoneAt(p.x, p.y) : null, LL = Z ? Z.bld.lvls : lvls; if (!LL || !LL.length) return { err: 'dessinez d\'abord un contour de bâtiment avec au moins deux niveaux (RDC et R + 1)' };
            const S = LL.slice().sort((a, b) => a.z - b.z), cur = Z ? ((bldCur() || null) === Z ? lvlAct : (Z.bld.act || 'rdc')) : lvlAct, i = Math.max(0, S.findIndex(L => L.id === cur));
            const lo = S[i] || S[0], hi = S[S.indexOf(lo) + 1]; if (!hi) return { err: 'il n\'y a pas d\'étage au-dessus de ' + (Z ? Z.bld.nm + ' — ' : '') + 'ce niveau : ajoutez-en un (▲ + dans les étages du bâtiment)' };
            return { Z, lo, hi }; }
        // altitudes du bas et du haut, toujours lues sur les étages (ils peuvent avoir changé depuis le tracé)
        function st2Z(s) { const S = s.stair2, Z = S.bid ? bldById(S.bid) : null, LL = Z ? Z.bld.lvls : lvls, lo = LL && LL.find(L => L.id === S.lo), hi = LL && LL.find(L => L.id === S.hi);
            if (lo && hi && hasZ(lo.z) && hasZ(hi.z) && hi.z > lo.z) { S.z0 = lo.z; S.z1 = hi.z; } return { z0: S.z0, z1: st2Arrive(s, S.z1) }; }
        /* arrivée : le dessus du plancher d'en haut. Une dalle posée SUR le niveau (son dessous à la cote du niveau) relève l'arrivée de son épaisseur ; l'escalier monte jusqu'au sol fini et perce sa trémie */
        const ST2_ARR = new WeakMap();
        function st2Arrive(s, z1) { if (!hasZ(z1) || !s.points || s.points.length < 2) return z1; const k = renderEpoch + '|' + z1 + '|' + shapes.length, c = ST2_ARR.get(s); if (c && c.k === k) return c.z;
            const e = s.points[s.points.length - 1], bid = s.stair2.bid || s.bid; let z = z1;
            shapes.forEach(d => { if (d === s || !d.solid || d.solid.kind !== 'box' || d.type !== 'poly' || d.stair2 || !d.points || d.points.length < 3) return; if (bid && d.bid && d.bid !== bid) return; const zb = d.points[0].z; if (!hasZ(zb) || Math.abs(zb - z1) > 50) return;
                const H = d.solid.H || 0; if (H > 0 && H < 600 && pointInPolygon(e.x, e.y, d.points)) z = Math.max(z, zb + H); });
            ST2_ARR.set(s, { k, z }); return z; }
        // bande occupée par l'escalier autour du tracé (décalages vers la gauche du sens de montée)
        function st2Band(S) { const w = mmToWorld(S.w); return S.just === 'gauche' ? [-w, 0] : S.just === 'droite' ? [0, w] : [-w / 2, w / 2]; }
        // polygone coupé par un demi-plan (côté où dot(p - O, u) * sg >= 0)
        function st2Clip(Q, O, u, t0, sg) { const f = (p) => ((p.x - O.x) * u.x + (p.y - O.y) * u.y - t0) * sg, out = [];
            for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length], fa = f(a), fb = f(b); if (fa >= 0) out.push({ x: a.x, y: a.y }); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); } }
            return out.length >= 3 ? out : null; }
        // géométrie complète : marches (polygone + altitude du dessus), paliers, lignes des garde-corps, foulée nécessaire / disponible
        function st2Geo(s) { const S = s.stair2, P = s.points; if (!S || !P || P.length < 2) return null; const { z0, z1 } = st2Z(s), dz = z1 - z0; if (!(dz > 0)) return null;
            const k = mmToWorld(1), [oa, ob] = st2Band(S), oc = (oa + ob) / 2, w = ob - oa, ns = P.length - 1, Q = wallChainGeomRaw(P, false, oa, ob), J = wallChainGeomRaw(P, false, oc, oc);
            const n = Math.max(2, Math.round(dz / Math.max(100, S.hc || 175))), h = dz / n, g = mmToWorld(Math.max(150, S.g || 270)), nl = ns - 1, T = Math.max(0, n - nl - 1);
            const seg = []; for (let i = 0; i < ns; i++) { const A = J[i].A0, B = J[i].A1, L = Math.hypot(B.x - A.x, B.y - A.y) || 1, u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, nv = { x: u.y, y: -u.x }, st = i > 0 ? w / 2 : 0, en = i < ns - 1 ? L - w / 2 : L;
                seg.push({ A, u, nv, L, st, en, cap: Math.max(0, Math.floor((en - st) / g + 1e-6)) }); }
            let left = T; seg.forEach((q, i) => { q.t = i === ns - 1 ? left : Math.min(q.cap, left); left -= q.t; });
            const pt = (q, t, o) => ({ x: q.A.x + q.u.x * t + q.nv.x * (o - oc), y: q.A.y + q.u.y * t + q.nv.y * (o - oc) });
            const rect = (q, a, b) => [pt(q, a, oa), pt(q, b, oa), pt(q, b, ob), pt(q, a, ob)];
            const treads = [], lands = [], risers = []; let zc = z0, need = 0;
            seg.forEach((q, i) => { const last = i === ns - 1, p0 = last ? q.st : q.en - q.t * g; q.p0 = p0; q.zc = zc; need += q.t * g + (i > 0 ? w / 2 : 0) + (!last ? w / 2 : 0);
                for (let j = 0; j <= q.t; j++) risers.push({ q, t: p0 + j * g });
                for (let j = 1; j <= q.t; j++) treads.push({ poly: rect(q, p0 + (j - 1) * g, p0 + j * g), z: zc + j * h, i });
                zc += (q.t + 1) * h; q.zEnd = zc;
                if (!last) { const a = st2Clip(Q[i] && [Q[i].A0, Q[i].A1, Q[i].B1, Q[i].B0], q.A, q.u, q.en, 1), nq = seg[i + 1], b = st2Clip(Q[i + 1] && [Q[i + 1].A0, Q[i + 1].A1, Q[i + 1].B1, Q[i + 1].B0], nq.A, nq.u, nq.st, -1);
                    lands.push({ polys: [a, b].filter(Boolean), z: zc }); } });
            const qL = seg[ns - 1], tTop = qL.p0 + qL.t * g; if (qL.L - tTop > k * 5) lands.push({ polys: [rect(qL, tTop, Math.max(qL.L, tTop))], z: z1, top: true });
            const have = seg.reduce((a, q) => a + (q.en - q.st), 0), short = Math.max(0, qL.p0 + qL.t * g - qL.L);
            // garde-corps : suit la ligne des nez dans les volées, à plat sur les paliers ; 1 m au-dessus par défaut
            const rail = (o) => { const E = wallChainGeomRaw(P, false, o, o), R = []; seg.forEach((q, i) => { const corner = (j) => ({ x: E[j].A0.x, y: E[j].A0.y });
                    if (i > 0) R.push(Object.assign(corner(i), { z: q.zc })); const a = i === 0 ? q.p0 : Math.max(q.st, q.p0 - g), za = i === 0 ? q.zc + h : q.zc - (q.p0 - a) / g * h; if (q.t > 0 || i === 0) R.push(Object.assign(pt(q, a, o), { z: za }));
                    R.push(Object.assign(pt(q, q.p0 + q.t * g, o), { z: q.zEnd })); });
                return R; };
            const gc = S.gc || 'aucun', rails = []; if (gc === 'gauche' || gc === 'deux') rails.push(rail(ob - mmToWorld(40))); if (gc === 'droite' || gc === 'deux') rails.push(rail(oa + mmToWorld(40)));
            return { z0, z1, n, h, g, T, nl, seg, Q, treads, lands, risers, rails, need: worldToMm(need) / 1000, have: worldToMm(have) / 1000, short: worldToMm(short) / 1000, oa, ob, oc, pt }; }
        /* clic dans l'emprise d'un escalier (pas seulement sur son tracé) : il passe avant la dalle ou le sol dessous */
        function st2At(wx, wy) { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (!s.stair2 || lvlOff2D(s)) continue; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && (l.visible === false || l.locked)) continue;
                const G = st2Geo(s); if (!G) continue; if (G.Q.some(q => q && pointInPolygon(wx, wy, [q.A0, q.A1, q.B1, q.B0])) || G.treads.some(t => pointInPolygon(wx, wy, t.poly))) return s; } return null; }
        /* TRÉMIE : là où l'échappée sous la dalle du dessus ferait moins de 2 m, la dalle est ouverte ; anneaux [x, y] en coordonnées du plan, déjà réunis */
        const ST2_ECH = 2000;
        /* contour net : calcul près de l'origine (coordonnées Lambert : la précision du découpage se perd loin de 0), marches et paliers élargis d'1 mm pour qu'ils se
           soudent sans fente, ni trou ni lanière de dalle à l'intérieur (le jour d'un escalier tournant est ouvert aussi), sommets alignés à 2 mm près retirés */
        function st2Tremie(s, soffit) { const G = st2Geo(s); if (!G || !window.polygonClipping) return []; const lim = soffit - ST2_ECH;
            const polys = G.treads.filter(t => t.z > lim).map(t => t.poly).concat(G.lands.filter(L => !L.top && L.z > lim).flatMap(L => L.polys)); if (!polys.length) return [];
            const O = polys[0][0], e1 = mmToWorld(1), tol = mmToWorld(2), area = (P) => P.reduce((a, q, i) => { const r = P[(i + 1) % P.length]; return a + q.x * r.y - r.x * q.y; }, 0) / 2;
            const parts = polys.map(P => { const Q = P.map(q => ({ x: q.x - O.x, y: q.y - O.y })).filter((q, i, A) => Math.hypot(q.x - A[(i + 1) % A.length].x, q.y - A[(i + 1) % A.length].y) > e1 / 10);
                return Q.length >= 3 && Math.abs(area(Q)) > e1 * e1 ? [ringOffset(Q, e1).map(q => [q.x, q.y])] : null; }).filter(Boolean); if (!parts.length) return [];
            let U; try { U = polygonClipping.union(...parts); } catch (e) { U = parts; }
            const clean = (R) => { let P = R.slice(0, R.length > 3 && R[0][0] === R[R.length - 1][0] && R[0][1] === R[R.length - 1][1] ? -1 : R.length).map(([x, y]) => ({ x, y }));
                for (let it = 0, nIt = 4 * P.length; it < nIt && P.length > 3; it++) { const n = P.length; let k = -1;
                    for (let i = 0; i < n; i++) { const a = P[(i - 1 + n) % n], q = P[i], b = P[(i + 1) % n]; if (Math.hypot(q.x - a.x, q.y - a.y) < tol || t2SegDist(q, a, b) < tol) { k = i; break; } }
                    if (k < 0) break; P.splice(k, 1); } return P.map(q => [q.x + O.x, q.y + O.y]); };
            return U.map(pl => [clean(pl[0])]).filter(pl => pl[0].length >= 3); }
        /* trémies qui percent une dalle : escaliers dont l'arrivée est au dessus de cette dalle (à 40 cm près), découpées sur son contour */
        function slabTremies(so) { if (!so || !so.solid || so.solid.kind !== 'box' || so.type !== 'poly' || so.stair2 || !window.polygonClipping) return []; const zb = so.points[0].z; if (!hasZ(zb)) return []; const zt = zb + (so.solid.H || 0);
            const O = so.points[0], L = (R) => R.map(([x, y]) => [x - O.x, y - O.y]), W = (R) => R.map(([x, y]) => [x + O.x, y + O.y]), ring = [L(so.points.map(q => [q.x, q.y]))], out = [];
            shapes.forEach(s => { if (!s.stair2 || (so.bid && s.bid && so.bid !== s.bid)) return; const Z = st2Z(s); if (!(Math.abs(zt - Z.z1) < 400 && zb < Z.z1)) return;
                const T = st2Tremie(s, zb); if (!T.length) return; try { polygonClipping.intersection(ring, T.map(pl => pl.map(L))).forEach(pl => out.push([W(pl[0])])); } catch (e) {} }); return out; }
        function st2Make(P) { const L = st2LevelsAt(P[0]); if (L.err) { updateCommandMessageText('ESCALIER D\'ÉTAGE : ' + L.err + '.'); return null; }
            const s = { type: 'poly', open: true, layerId: ensureLayer('Escaliers', '#d6c7a1'), points: P.map(q => ({ x: q.x, y: q.y })), hatch: false, zk: 1, name: 'Escalier', lvs: 1, lvl: L.lo.id,
                stair2: Object.assign(JSON.parse(JSON.stringify(st2Opt)), { lo: L.lo.id, hi: L.hi.id, z0: L.lo.z, z1: L.hi.z }) };
            if (L.Z) { s.bid = L.Z.bld.id; s.stair2.bid = L.Z.bld.id; } shapes.push(s); return s; }
        function st2Msg(s) { const G = st2Geo(s); if (!G) return 'ESCALIER : étages introuvables.'; const S = s.stair2, B = blondel(G.h, S.g);
            return 'ESCALIER : ' + G.n + ' marches de ' + nfr(G.h / 10, 1) + ' cm, giron ' + nfr(S.g / 10, 1) + ' cm (Blondel ' + nfr(B.b / 10, 1) + ' cm' + (B.ok ? ' ✓' : ', hors de 60 à 64') + '), de ' + nfr(G.z0 / 1000, 2) + ' à ' + nfr(G.z1 / 1000, 2)
                + (G.nl ? ', ' + G.nl + ' palier(s)' : '') + (G.short > 0.005 ? ' — il manque ' + nfr(G.short, 2) + ' m de tracé : la dernière volée dépasse le bout' : '') + '.'; }
        function startStair2() { try { loadPolyClip().then(() => draw(), () => {}); } catch (e) {} closeFileMenus(); setMode('pline'); stair2Draw = true; st2Panel(); updateCommandMessage(); draw(); }
        // ---- volet de l'escalier : avant le tracé (réglages par défaut) ou sur un escalier sélectionné
        let st2Edit = null;
        function st2T() { return st2Edit && shapes.includes(st2Edit) ? st2Edit.stair2 : st2Opt; }
        function st2FormHTML(O, G) { const inp = (k, v, u) => `<span>${t2Inp('st2-' + k, v, 70, '')} ${u}</span>`, real = G ? G.h : O.hc, B = blondel(real, O.g);
            return `<div id="st2-svg">${stairSVG({ h: real, g: O.g, nez: O.nez, n: G ? G.n : 4 })}</div>
                <div>Tracé par</div>${vSeg([['gauche', 'la gauche'], ['axe', 'l\'axe'], ['droite', 'la droite']], O.just, "st2Set('just','$')")}
                <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:6px"><span>Largeur</span>${inp('w', O.w / 1000, 'm')}<span>Hauteur de marche visée</span>${inp('hc', O.hc / 10, 'cm')}
                <span>Giron</span>${inp('g', O.g / 10, 'cm')}<span>Nez de marche</span>${inp('nez', O.nez / 10, 'cm')}</div>
                <button type="button" class="vbtn" style="margin-top:6px" onclick="st2Set('blondel')" title="Giron = 63 cm − 2 × hauteur réelle">Giron par Blondel (2h + g = 63 cm)</button>
                ${blondelBox(real, O.g, G ? ' · ' + G.n + ' marches réelles de ' + nfr(G.h / 10, 1) + ' cm' : '')}
                <div>Garde-corps</div>${vSeg([['aucun', 'aucun'], ['gauche', 'gauche'], ['droite', 'droite'], ['deux', 'des deux côtés']], O.gc || 'aucun', "st2Set('gc','$')")}
                ${O.gc && O.gc !== 'aucun' ? `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><span>Hauteur du garde-corps</span>${inp('gch', O.gch / 1000, 'm')}</div>` : ''}
                <div style="display:flex;gap:4px">${Object.keys(ST2_MAT).map(m => `<button type="button" onclick="st2Set('mat','${m}')" style="flex:1;padding:5px;border-radius:6px;border:1px solid ${O.mat === m ? '#a3e635' : '#4b5563'};background:${O.mat === m ? 'rgba(163,230,53,.16)' : '#111827'};color:#e5e7eb;cursor:pointer;font-size:12px">${ST2_MAT[m][0]}</button>`).join('')}</div>`; }
        function st2Panel(sh) { if (sh !== undefined) st2Edit = sh; const s = st2Edit && shapes.includes(st2Edit) ? st2Edit : null, O = st2T(), G = s ? st2Geo(s) : null;
            let info = ''; if (G) { const L = (l, v, c) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#9ca3af">${l}</span><b style="color:${c || '#e5e7eb'}">${v}</b></div>`;
                info = `<div style="border-top:1px solid #374151;padding-top:8px;display:grid;gap:3px">${L('Étages reliés', nfr(G.z0 / 1000, 2) + ' → ' + nfr(G.z1 / 1000, 2) + ' m')}${L('Marches', G.n + ' × ' + nfr(G.h / 10, 1) + ' cm')}${L('Paliers', G.nl + '')}
                    ${L('Foulée nécessaire / tracée', nfr(G.need, 2) + ' / ' + nfr(G.have, 2) + ' m', G.short > 0.005 ? '#f87171' : '#4ade80')}</div>${G.short > 0.005 ? `<div style="padding:7px 10px;border-radius:8px;border:1px solid #7f1d1d;background:rgba(127,29,29,.18);font-size:12.5px">Il manque <b>${nfr(G.short, 2)} m</b> de tracé : allongez la dernière volée, réduisez le giron ou ajoutez un palier.</div>` : ''}`; }
            t2Panel('🪜 Escalier d\'étage', st2FormHTML(O, G) + info + (s ? '' : t2Note('Tracez la polyligne de bas en haut, depuis le pied de l\'escalier ; un palier à chaque angle. Espace ou double-clic pour finir.')),
                [['Terminer', "t2PanelClose();st2Edit=null;stair2Draw=false;setMode('select-box');draw()", true]], "t2PanelClose();st2Edit=null;stair2Draw=false;setMode('select-box');draw()");
            const p = document.getElementById('t2-panel'); p.onchange = (e) => { const id = e.target.id || ''; if (!id.startsWith('st2-')) return; const k = id.slice(4), v = t2Num(e.target.value); if (!isFinite(v) || v <= 0) return;
                const T = st2T(), f = { w: 1000, hc: 10, g: 10, nez: 10, gch: 1000 }[k]; if (!f) return; T[k] = Math.round(v * f); if (k === 'nez') T.nez = Math.round(v * 10); st2After(); }; }
        function st2Set(k, v) { const T = st2T(); if (k === 'blondel') { const s = st2Edit && shapes.includes(st2Edit) ? st2Edit : null, G = s ? st2Geo(s) : null, h = G ? G.h : T.hc; T.g = Math.round(630 - 2 * h); } else T[k] = v; st2After(); }
        function st2After() { const ym = document.getElementById('selparam-modal'), inY = ym && !ym.classList.contains('hidden') && selectedShapes.length === 1 && selectedShapes[0] === st2Edit;
            if (st2Edit && shapes.includes(st2Edit)) { invalidateCache(); saveState(); draw(); if (typeof is3DOpen === 'function' && is3DOpen()) { build3DScene(); render3D(); } } else st2Save();
            if (inY) { if (typeof spLiveCommit === 'function') spLiveCommit(); openSelectionParamModal(); } else st2Panel(); draw(); }
        // ---- plan : contour, marches (contremarches + nez en tirets), paliers, garde-corps, ligne de foulée fléchée vers le haut
        function drawStair2_2D(c, s, col, dx, dy, lineScale) { const G = st2Geo(s); if (!G) return; const S = s.stair2, mv = (p) => c.moveTo(p.x + dx, p.y + dy), ln = (p) => c.lineTo(p.x + dx, p.y + dy), nz = mmToWorld(S.nez || 0);
            c.save(); c.strokeStyle = col; c.lineWidth = 1 / lineScale; c.setLineDash([]); c.beginPath();
            G.seg.forEach((q, i) => { const Qd = G.Q[i]; if (!Qd) return; mv(Qd.A0); ln(Qd.A1); mv(Qd.B0); ln(Qd.B1); });
            const q0 = G.Q[0], qn = G.Q[G.Q.length - 1]; mv(q0.A0); ln(q0.B0); mv(qn.A1); ln(qn.B1);
            G.risers.forEach(r => { mv(G.pt(r.q, r.t, G.oa)); ln(G.pt(r.q, r.t, G.ob)); });
            c.stroke();
            if (nz > 0) { c.setLineDash([3 / lineScale, 3 / lineScale]); c.beginPath(); G.risers.forEach((r, j) => { if (r.t - nz < r.q.st - 1e-9 && j === 0) return; mv(G.pt(r.q, r.t - nz, G.oa)); ln(G.pt(r.q, r.t - nz, G.ob)); }); c.stroke(); c.setLineDash([]); }
            if (G.rails.length) { c.lineWidth = 2 / lineScale; c.beginPath(); G.rails.forEach(R => { R.forEach((p, i) => i ? ln(p) : mv(p)); }); c.stroke(); c.lineWidth = 1 / lineScale; }
            if (lvlOn && lvlAct === S.hi) { const T = st2Tremie(s, G.z1 - 200); c.save(); c.setLineDash([6 / lineScale, 4 / lineScale]); c.lineWidth = 1.4 / lineScale; T.forEach(Pg => Pg.forEach(Rg => { c.beginPath(); Rg.forEach((q, i) => i ? c.lineTo(q[0] + dx, q[1] + dy) : c.moveTo(q[0] + dx, q[1] + dy)); c.closePath(); c.stroke(); })); c.restore(); }
            // ligne de foulée : sur l'axe, du pied jusqu'à la dernière marche, flèche au bout
            const F = []; G.seg.forEach((q, i) => { if (i === 0) F.push(G.pt(q, Math.max(0, q.p0 - G.g / 2), G.oc)); else F.push(G.pt(q, 0, G.oc)); }); const qL = G.seg[G.seg.length - 1], end = G.pt(qL, qL.p0 + qL.t * G.g, G.oc); F.push(end);
            c.beginPath(); c.arc(F[0].x + dx, F[0].y + dy, mmToWorld(60), 0, Math.PI * 2); c.stroke(); c.beginPath(); F.forEach((p, i) => i ? ln(p) : mv(p)); c.stroke();
            const a = mmToWorld(180), u = qL.u; c.beginPath(); mv({ x: end.x - u.x * a + u.y * a * 0.5, y: end.y - u.y * a - u.x * a * 0.5 }); ln(end); ln({ x: end.x - u.x * a - u.y * a * 0.5, y: end.y - u.y * a + u.x * a * 0.5 }); c.stroke(); c.restore();
            const m = G.pt(G.seg[0], Math.min(G.seg[0].L, G.seg[0].p0 + G.seg[0].t * G.g / 2), G.oc); dimensionTextsToDraw.push({ text: G.n + ' × ' + nfr(G.h / 10, 1) + ' / ' + nfr(S.g / 10, 1) + ' cm', worldX: m.x + dx, worldY: m.y + dy, color: col, layerId: s.layerId }); }
        // aperçu pendant le tracé : la bande de l'escalier autour de la polyligne
        function drawStair2Preview(c) { if (!(mode === 'pline' && stair2Draw && isDrawing && currentPolygon.length)) return; const P = currentPolygon.concat([{ x: currentX, y: currentY }]).filter((p, i, A) => !i || Math.hypot(p.x - A[i - 1].x, p.y - A[i - 1].y) > 1e-9); if (P.length < 2) return;
            const [oa, ob] = st2Band(st2Opt), Q = wallChainGeomRaw(P, false, oa, ob); c.save(); c.strokeStyle = '#a3e635'; c.lineWidth = 1.5 / camera.zoom; c.setLineDash([6 / camera.zoom, 4 / camera.zoom]); c.beginPath();
            Q.forEach(q => { c.moveTo(q.A0.x, q.A0.y); c.lineTo(q.A1.x, q.A1.y); c.lineTo(q.B1.x, q.B1.y); c.lineTo(q.B0.x, q.B0.y); c.closePath(); }); c.stroke(); c.restore(); }
        // ---- 3D : marches (massives en béton et pierre, planches en bois), paliers, garde-corps (main courante, poteaux, remplissage vitré)
        function stair2_3D(root, vis, P, Zm) { vis.filter(s => s.stair2 && s.type === 'poly').forEach(s => { const G = st2Geo(s); if (!G) return; const S = s.stair2, wood = S.mat === 'bois';
            const mat = new THREE.MeshLambertMaterial({ color: (ST2_MAT[S.mat] || ST2_MAT.beton)[1] }), prism = (poly, za, zb, m) => { if (!poly || poly.length < 3 || !(zb > za)) return; const sh = new THREE.Shape(); poly.forEach((q, i) => { const a = P(q.x, q.y); i ? sh.lineTo(a.x, a.y) : sh.moveTo(a.x, a.y); });
                const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(1e-3, Zm(zb) - Zm(za)), bevelEnabled: false }); g.translate(0, 0, Zm(za)); const me = new THREE.Mesh(g, m || mat); me.userData.shape = s; root.add(me); };
            const nz = mmToWorld(S.nez || 0);
            G.treads.forEach(t => { const Pl = nz > 0 && t.poly ? (() => { const q = G.seg[t.i], a0 = (t.poly[0].x - q.A.x) * q.u.x + (t.poly[0].y - q.A.y) * q.u.y; return [G.pt(q, a0 - nz, G.oa), t.poly[1], t.poly[2], G.pt(q, a0 - nz, G.ob)]; })() : t.poly;
                if (wood) { const q = G.seg[t.i], a0 = (t.poly[0].x - q.A.x) * q.u.x + (t.poly[0].y - q.A.y) * q.u.y, e = mmToWorld(22); prism(Pl, t.z - 50, t.z); prism([G.pt(q, a0, G.oa), G.pt(q, a0 + e, G.oa), G.pt(q, a0 + e, G.ob), G.pt(q, a0, G.ob)], t.z - G.h, t.z - 50); } else prism(Pl, Math.max(G.z0, t.z - G.h - 180), t.z); });
            const onSlab = (L) => L.top && shapes.some(d => d.solid && d.solid.kind === 'box' && d.type === 'poly' && !d.bld && hasZ(d.points[0].z) && Math.abs(d.points[0].z + (d.solid.H || 0) - G.z1) < 400 && L.polys.every(Pl => Pl.every(q => pointInPolygon(q.x, q.y, d.points))));   /* arrivée sur la dalle du dessus : pas de second palier */
            G.lands.forEach(L => { if (!onSlab(L)) L.polys.forEach(Pl => prism(Pl, L.z - (wood ? 60 : 200), L.z)); });
            const rm = new THREE.MeshLambertMaterial({ color: 0x374151 }), glass = new THREE.MeshLambertMaterial({ color: 0xbfdbfe, emissive: 0x1e3a5f, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }), H = S.gch || 1000;
            const bar = (a, b, r) => { const A = new THREE.Vector3(a.x, a.y, a.z), B = new THREE.Vector3(b.x, b.y, b.z), L = A.distanceTo(B); if (L < 1e-4) return; const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), rm); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.userData.shape = s; root.add(m); };
            G.rails.forEach(R => { const V = R.map(p => { const a = P(p.x, p.y); return { x: a.x, y: a.y, zb: Zm(p.z), zt: Zm(p.z + H) }; });
                for (let i = 1; i < V.length; i++) { const a = V[i - 1], b = V[i]; bar({ x: a.x, y: a.y, z: a.zt }, { x: b.x, y: b.y, z: b.zt }, 0.022);
                    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.zb + 0.05, b.x, b.y, b.zb + 0.05, b.x, b.y, b.zt - 0.05, a.x, a.y, a.zb + 0.05, b.x, b.y, b.zt - 0.05, a.x, a.y, a.zt - 0.05], 3)); geo.computeVertexNormals(); const gm = new THREE.Mesh(geo, glass); gm.userData.shape = s; root.add(gm);
                    const d = Math.hypot(b.x - a.x, b.y - a.y), np = Math.max(1, Math.ceil(d / 1.2)); for (let j = i === 1 ? 0 : 1; j <= np; j++) { const t = j / np; bar({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.zb + (b.zb - a.zb) * t }, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.zt + (b.zt - a.zt) * t }, 0.018); } } }); }); }
