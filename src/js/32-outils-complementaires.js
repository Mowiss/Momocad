        // ---- Révolution : un profil fermé tourne autour d'un axe vertical (regard, cuve, poteau, plot…) ----
        let revProf = null, revAxis = null;
        function startRevolve() { setMode('revolve'); revProf = null; revAxis = null; updateCommandMessage(); draw(); }
        function revolveClick(w) {
            if (!revProf) { const t = closedAt(w, isClosed2D); if (!t) { updateCommandMessageText('RÉVOLUTION : cliquez la forme fermée du profil (demi-coupe dessinée en vraie grandeur).'); return; } revProf = t; selectedShapes = [t]; updateCommandMessage(); draw(); return; }
            if (!revAxis) { revAxis = { x: w.x, y: w.y }; updateCommandMessage(); draw(); return; }
            const ring = revProf.type === 'circle' ? pierceRing(revProf) : revProf.points, Xa = worldToMm(revAxis.x);
            const Yv = ring.map(q => -worldToMm(q.y)), y0 = Math.min(...Yv);
            const prof = ring.map((q, i) => [Math.round(Math.abs(worldToMm(q.x) - Xa) * 10) / 10, Math.round((Yv[i] - y0) * 10) / 10]);
            const R = Math.max(...prof.map(q => q[0])); if (!(R > 0)) { updateCommandMessageText('RÉVOLUTION : l\'axe est sur le profil — cliquez un axe à côté de la forme.'); revAxis = null; return; }
            const t = getTIN(), tz = t ? tinZ(w.x, w.y, t) : undefined;
            const sh = { type: 'circle', layerId: activeLayerId, x: w.x, y: w.y, r: mmToWorld(R), z: hasZ(tz) ? tz : 0, zk: 1, solid: { kind: 'rev', H: Math.max(...prof.map(q => q[1])), prof } };
            shapes.push(sh); saveState(); selectedShapes = [sh]; revProf = revAxis = null; setMode('select-box'); draw(); setTimeout(openSelectionParamModal, 30);
            updateCommandMessageText('RÉVOLUTION : volume créé (rayon ' + nfr(R / 1000, 2) + ' m, hauteur ' + nfr(sh.solid.H / 1000, 2) + ' m). Le profil dessiné peut être effacé.');
        }
        // ---- Extruder : forme fermée -> volume (pavé / extrusion ou cylindre) ----
        function extrudeShapes(list) {
            const ok = list.filter(x => !x.solid && !x.gen && ((x.type === 'poly' && !x.open && x.points.length >= 3) || x.type === 'circle'));
            ok.forEach(x => { const c = x.type === 'circle' ? x : polyCentroid(x.points), t = getTIN(), tz = t ? tinZ(c.x, c.y, t) : undefined;
                const base = x.type === 'circle' ? x.z : x.points[0].z, z0 = hasZ(base) ? base : hasZ(tz) ? tz : 0;
                if (x.type === 'circle') x.z = z0; else x.points.forEach(q => { q.z = z0; });
                x.solid = { kind: x.type === 'circle' ? 'cyl' : 'box', H: 1000 }; x.zk = 1; });
            return ok;
        }
        function startExtrude() {
            const ok = extrudeShapes(selectedShapes);
            if (ok.length) { saveState(); selectedShapes = ok; draw(); if (ok.length === 1) setTimeout(openSelectionParamModal, 30); updateCommandMessageText('EXTRUDER : ' + ok.length + ' forme(s) extrudée(s)' + (ok.length > 1 ? ' (hauteur 1 m, modifiable avec Y)' : '') + '.'); return; }
            setMode('extrude');
        }
        // =====================================================================
        // OUTILS COMPLÉMENTAIRES : Copier, Réseau, Joindre, Couper au point, Chanfrein, Longueur (Modif) ;
        // Ellipse, Point, Diviser (Dessin) ; Mesurer, cotes de rayon / diamètre (Cotation) ;
        // accroches tangente / proche, suivi polaire, copie dans Déplacer / Rotation, échelle par référence.
        // =====================================================================
        var t2 = { cpBase: null, cpN: 0, moveCopy: false, rotCopy: false, arr: null, arrLast: null, arrayPending: false, joinPending: false,
                   chA: null, chB: null, chD: null, lenSpec: null, lenDyn: null, ell: null, div: null, divLast: null, dr: null, ms: [], sref: null, polarHit: null };
        var t2Polar = { on: false, step: 15 };
        try { const v = JSON.parse(localStorage.getItem('momocad-polar') || 'null'); if (v) { t2Polar.on = !!v.on; if (v.step > 0) t2Polar.step = v.step; } } catch (e) {}
        try { const v = localStorage.getItem('momocad-chamfer'); if (v) t2.chD = v; } catch (e) {}
        const T2_POLAR_STEPS = [5, 10, 15, 22.5, 30, 45, 90];
        function T2W(v) { return (v / unitsPerSquare) * GRID_SIZE; }                 // valeur tapée (unité du plan) -> monde
        function T2U(w) { return +(w / GRID_SIZE * unitsPerSquare).toFixed(4); }       // monde -> unité du plan
        function t2Num(v) { const x = parseFloat(String(v === undefined ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; }
        function t2Fr(v) { return String(v).replace('.', ','); }
        function t2Props() { return { color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1 }; }
        function t2Pt(wx, wy) { const sn = findSnap(wx, wy); return sn ? { x: sn.x, y: sn.y, sn } : { x: wx, y: wy, sn: null }; }
        function t2Vis(s) { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); return !(l && l.visible === false) && !lvlOff2D(s); }
        function t2SegDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }
        // copies indépendantes (les blocs copiés forment leurs propres blocs)
        function t2Clone(list) {
            const gmap = {};
            return list.map(s0 => { const s = JSON.parse(JSON.stringify(s0)); delete s._nosnap; if (s.groupId) s.groupId = gmap[s.groupId] || (gmap[s.groupId] = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)); return s; });
        }
        // ---------- suivi polaire ----------
        function t2PolarAt(base, x, y) {
            if (!t2Polar.on || !base) return null;
            const dx = x - base.x, dy = y - base.y, L = Math.hypot(dx, dy); if (L * camera.zoom < 12) return null;
            const a = Math.atan2(-dy, dx) * 180 / Math.PI, st = t2Polar.step, na = Math.round(a / st) * st, d = (a - na) * Math.PI / 180;
            if (Math.abs(L * Math.sin(d)) * camera.zoom > 10) return null;
            const Lp = L * Math.cos(d), r = na * Math.PI / 180;
            return { x: base.x + Lp * Math.cos(r), y: base.y - Lp * Math.sin(r), polar: ((na % 360) + 360) % 360 };
        }
        // point contraint depuis une base : Ortho (F8 / Maj) d'abord, sinon suivi polaire (si pas d'accroche)
        function t2Constrain(base, p, shift, hasSnap) {
            if (!base) return { x: p.x, y: p.y };
            if (orthoMode || shift) return Math.abs(p.x - base.x) > Math.abs(p.y - base.y) ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
            if (!hasSnap) { const q = t2PolarAt(base, p.x, p.y); if (q) return q; }
            return { x: p.x, y: p.y };
        }
        function refreshPolarBtn() {
            const b = document.getElementById('btn-toggle-polar'); if (!b) return;
            b.classList.toggle('text-sky-300', t2Polar.on); b.classList.toggle('text-gray-500', !t2Polar.on);
            const s = document.getElementById('polar-step'); if (s) s.textContent = t2Fr(t2Polar.step) + '°';
            b.title = 'Suivi polaire (F10) : ' + (t2Polar.on ? 'ACTIF' : 'éteint') + ' — en traçant, le trait s\'aimante tous les ' + t2Fr(t2Polar.step) + '° (une ligne pointillée l\'indique). Clic droit = changer le pas.';
        }
        function togglePolar() { t2Polar.on = !t2Polar.on; try { localStorage.setItem('momocad-polar', JSON.stringify(t2Polar)); } catch (e) {} refreshPolarBtn(); updateCommandMessageText('SUIVI POLAIRE : ' + (t2Polar.on ? 'actif, tous les ' + t2Fr(t2Polar.step) + '°.' : 'éteint.')); draw(); }
        function cyclePolarStep() { const i = T2_POLAR_STEPS.indexOf(t2Polar.step); t2Polar.step = T2_POLAR_STEPS[(i + 1) % T2_POLAR_STEPS.length]; t2Polar.on = true; try { localStorage.setItem('momocad-polar', JSON.stringify(t2Polar)); } catch (e) {} refreshPolarBtn(); updateCommandMessageText('SUIVI POLAIRE : tous les ' + t2Fr(t2Polar.step) + '°.'); draw(); }
        // point d'où part le tracé en cours (pour le suivi polaire et l'accroche tangente)
        function t2Origin() {
            if (!t2) return null;
            if (mode === 'line' && isDrawing) return { x: startX, y: startY };
            if (isPolyMode() && isDrawing && currentPolygon.length) return currentPolygon[currentPolygon.length - 1];
            if (mode === 'copy' && t2.cpBase) return t2.cpBase;
            if (mode === 'measure' && t2.ms.length) return t2.ms[t2.ms.length - 1];
            if (mode === 'ellipse' && t2.ell && t2.ell.step === 1) return t2.ell.c;
            if (mode === 'move' && moveBasePoint) return moveBasePoint;
            if (mode === 'wall' && wallStart) return wallStart;
            if (mode === 'pen' && penPts.length) return penPts[penPts.length - 1];
            return null;
        }
        function t2MouseMove(e) {
            if (!t2) return; t2.polarHit = null;
            if (orthoMode || e.shiftKey || currentSnap) return;
            if (!['line', 'poly', 'pline', 'copy', 'measure', 'ellipse'].includes(mode)) return;
            const base = t2Origin(); if (!base) return;
            const q = t2PolarAt(base, currentX, currentY); if (!q) return;
            currentX = q.x; currentY = q.y; t2.polarHit = { base, ang: q.polar };
        }
        // ---------- accroches tangente et proche ----------
        function t2ArcSweep(s) { const P2 = 2 * Math.PI; let sw = s.anticlockwise ? s.startAngle - s.endAngle : s.endAngle - s.startAngle; sw = ((sw % P2) + P2) % P2; if (sw < 1e-9) sw = P2; return sw; }
        function t2OnArc(s, a) { const P2 = 2 * Math.PI; let t = s.anticlockwise ? s.startAngle - a : a - s.startAngle; t = ((t % P2) + P2) % P2; return t <= t2ArcSweep(s) + 1e-9; }
        function t2TangentSnap(o, wx, wy, maxPx) {
            let best = null, bd = maxPx; const cx = wx * camera.zoom + camera.x, cy = wy * camera.zoom + camera.y;
            for (const s of shapes) {
                if ((s.type !== 'circle' && s.type !== 'arc') || s._nosnap || !t2Vis(s)) continue;
                const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy); if (d <= s.r * (1 + 1e-9)) continue;
                const base = Math.atan2(dy, dx), al = Math.acos(s.r / d);
                [base + al, base - al].forEach(a => { if (s.type === 'arc' && !t2OnArc(s, a)) return; const x = s.x + s.r * Math.cos(a), y = s.y + s.r * Math.sin(a), dp = Math.hypot(x * camera.zoom + camera.x - cx, y * camera.zoom + camera.y - cy); if (dp < bd) { bd = dp; best = { x, y, tan: true, d: dp }; } });
            }
            return best;
        }
        function t2NearestSnap(wx, wy) {
            const rw = SNAP_DIST_PX / camera.zoom; let best = null, bd = rw;
            const seg = (ax, ay, bx, by) => { if (Math.max(ax, bx) < wx - bd || Math.min(ax, bx) > wx + bd || Math.max(ay, by) < wy - bd || Math.min(ay, by) > wy + bd) return; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; if (!l2) return; let t = ((wx - ax) * dx + (wy - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(wx - x, wy - y); if (d < bd) { bd = d; best = { x, y, near: true }; } };
            for (const s of shapes) {
                if (s._nosnap || !t2Vis(s)) continue;
                if (s.type === 'line' || s.type === 'slope') seg(s.x1, s.y1, s.x2, s.y2);
                else if (s.type === 'poly') { const n = s.points.length, ne = s.open ? n - 1 : n; for (let i = 0; i < ne; i++) { const a = s.points[i], b = s.points[(i + 1) % n]; seg(a.x, a.y, b.x, b.y); } }
                else if (s.type === 'circle' || s.type === 'arc') { const d0 = Math.hypot(wx - s.x, wy - s.y); if (d0 < 1e-12) continue; const a = Math.atan2(wy - s.y, wx - s.x); if (s.type === 'arc' && !t2OnArc(s, a)) continue; const d = Math.abs(d0 - s.r); if (d < bd) { bd = d; best = { x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a), near: true }; } }
            }
            return best;
        }
        // ---------- tracés : droite, polyligne, arc, cercle -> points + longueurs cumulées ----------
        function t2PathOf(s) {
            if (!s) return null;
            let pts, closed = false;
            if (s.type === 'line') pts = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
            else if (s.type === 'poly' && s.points.length >= 2) { pts = s.points.map(q => ({ x: q.x, y: q.y })); closed = !s.open; }
            else if (s.type === 'circle') { pts = []; for (let i = 0; i < 360; i++) { const a = i / 360 * 2 * Math.PI; pts.push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); } closed = true; }
            else if (s.type === 'arc') { const sw = t2ArcSweep(s), n = Math.max(8, Math.ceil(sw / (Math.PI / 180))), sg = s.anticlockwise ? -1 : 1; pts = []; for (let i = 0; i <= n; i++) { const a = s.startAngle + sg * sw * i / n; pts.push({ x: s.x + s.r * Math.cos(a), y: s.y + s.r * Math.sin(a) }); } }
            else return null;
            if (closed) pts.push({ x: pts[0].x, y: pts[0].y });
            const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
            return { pts, cum, L: cum[cum.length - 1], closed, s };
        }
        function t2PathAt(P, d) {
            const pts = P.pts, cum = P.cum; d = Math.max(0, Math.min(P.L, d));
            let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
            while (lo > 0 && cum[hi] - cum[lo] < 1e-12) lo--;
            const a = pts[lo], b = pts[hi], sl = cum[hi] - cum[lo], t = sl > 1e-12 ? (d - cum[lo]) / sl : 0;
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
        }
        const t2IsPath = (s) => s && !s.solid && !s.gen && !isBg(s) && (s.type === 'line' || s.type === 'arc' || s.type === 'circle' || (s.type === 'poly' && s.points.length >= 2));
        // ---------- petite fenêtre flottante (n'assombrit pas le plan : l'aperçu reste visible) ----------
        function t2Panel(title, html, actions, closeJs) {
            let p = document.getElementById('t2-panel');
            if (!p) {
                p = document.createElement('div'); p.id = 't2-panel'; p.className = 'mc-drawer-p';
                p.style.cssText = 'position:fixed;top:200px;right:18px;z-index:65;width:340px;max-width:calc(100vw - 32px);background:#1f2937;border:1px solid #4b5563;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#e5e7eb;font-size:13px;line-height:1.4;';
                document.body.appendChild(p);
                p.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); const b = p.querySelector('button[data-primary]'); if (b) b.click(); } else if (ev.key === 'Escape') { ev.preventDefault(); if (p.dataset.kind === 'studio') studioClose(); else if (texPaint) texStop(); else { setMode('select-box'); draw(); } } });
            }
            const sc = p.querySelector('.vb'), keep = sc && p.dataset.title === title ? sc.scrollTop : 0; p.dataset.title = title; p.dataset.kind = ''; if (!/^Vue 3D/.test(title)) document.body.classList.remove('v3pan');   /* le volet 3D redessiné garde son onglet en place (sinon l'onglet repartait à chaque image) */
            p.innerHTML = `<div class="vh"><h3>${title}</h3><button type="button" class="vx" onclick="${closeJs || "setMode('select-box');draw()"}" title="Fermer (Échap)">×</button></div>`
                + `<div class="vb">${html}</div>`
                + (actions && actions.length ? `<div class="vf">` + actions.map(([l, js, prim]) => `<button type="button" class="vbtn${prim ? ' pri' : ''}" ${prim ? 'data-primary="1"' : ''} onclick="${js}">${l}</button>`).join('') + `</div>` : '');
            p.style.display = 'flex'; p.querySelector('.vb').scrollTop = keep;   // un rafraîchissement du volet garde la position de lecture
        }
        function t2PanelClose() { const p = document.getElementById('t2-panel'); if (p) { document.body.classList.remove('v3pan'); if (p.contains(document.activeElement)) document.activeElement.blur(); p.style.display = 'none'; } }
        const t2Inp = (id, v, w, fn) => `<input id="${id}" type="text" inputmode="decimal" value="${t2Fr(v)}" oninput="${fn}" style="width:${w || 74}px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:4px 8px;text-align:right;outline:none">`;
        const t2Row = (lab, h) => `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>${lab}</span><span style="display:flex;align-items:center;gap:6px">${h}</span></label>`;
        const t2Chk = (id, on, lab, fn) => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="${id}" type="checkbox" ${on ? 'checked' : ''} onchange="${fn}"><span>${lab}</span></label>`;
        const t2Note = (t) => `<p style="color:#9ca3af;font-size:12px;margin:0">${t}</p>`;
        const t2Btn = (lab, js, on) => `<button type="button" onclick="${js}" style="padding:6px 10px;border-radius:6px;border:1px solid ${on ? '#22c55e' : '#3b82f6'};background:${on ? '#14532d' : '#1e3a8a'};color:#fff;cursor:pointer;text-align:left">${lab}</button>`;
        const t2Tab = (cur, k, t, js) => `<button type="button" onclick="${js}" style="flex:1;padding:6px 6px;border-radius:5px;border:0;background:${cur === k ? '#2563eb' : '#111827'};color:${cur === k ? '#fff' : '#d1d5db'};cursor:pointer;font-weight:600;font-size:12.5px">${t}</button>`;
        // choix segmenté commun : opts = [[valeur, libellé]], js = code appelé avec $ remplacé par la valeur
        const vSeg = (opts, cur, js) => `<div class="vseg">` + opts.map(([v, l]) => `<button type="button" class="${String(cur) === String(v) ? 'on' : ''}" onclick="${js.split('$').join(v)}">${l}</button>`).join('') + '</div>';

        // ---------- remise à zéro quand on change d'outil ----------
        function t2Reset(newMode) {
            if (!t2) return;
            if (newMode !== 'copy') { t2.cpBase = null; t2.cpN = 0; }
            t2.moveCopy = false; t2.rotCopy = false;
            if (newMode !== 'array') t2.arr = null;
            if (newMode !== 'select-box') { t2.arrayPending = false; }
            t2.chA = t2.chB = null; t2.lenDyn = null; if (newMode !== 'lengthen') t2.lenSpec = null;
            t2.ell = null; t2.div = null; t2.dr = null; t2.ms = []; t2.sref = null; t2.polarHit = null; t2Sel = null;
            if (!['paint', 'texpick', 'texclear'].includes(newMode)) texPaint = null; if (newMode !== 'blkbase') blkPending = null;
            t2PanelClose();
        }

        // =====================================================================
        // COPIER : point de base, puis autant de copies que de clics (ou de distances tapées)
        // =====================================================================
        function t2CopyPlace(dx, dy) {
            if (Math.hypot(dx, dy) < 1e-9) return;
            const cl = t2Clone(selectedShapes.filter(x => !isBg(x))); cl.forEach(s => translateShape(s, dx, dy));
            shapes.push(...cl); t2.cpN++; typedInput = ''; saveState(); draw();
            updateCommandMessageText('COPIER : copie n° ' + t2.cpN + ' posée à ' + calculateRealDistance(Math.hypot(dx, dy)) + '. Cliquez la suivante, ou Espace pour terminer.');
        }
        function t2CopyTyped() {
            const v = t2Num(typedInput); if (!(v > 0) || !t2.cpBase) return;
            const q = t2Constrain(t2.cpBase, { x: currentX, y: currentY }, shiftHeld, !!currentSnap), a = Math.atan2(q.y - t2.cpBase.y, q.x - t2.cpBase.x), d = T2W(v);
            t2CopyPlace(Math.cos(a) * d, Math.sin(a) * d);
        }
        function t2RotCopy(diff) {
            const cl = t2Clone(selectedShapes.filter(x => !isBg(x))); cl.forEach(s => applyRotationToShape(s, rotateCenter.x, rotateCenter.y, diff));
            shapes.push(...cl); isRotatingObjects = false; rotateCenter = null; typedInput = ''; t2.rotCopy = false; saveState(); draw();
            updateCommandMessageText('ROTATION : copie tournée de ' + t2Fr(Math.round(-diff * 1800 / Math.PI) / 10) + '°, l\'original reste en place.');
        }

        // =====================================================================
        // RÉSEAU : grille, polaire ou le long d'un tracé (aperçu en direct)
        // =====================================================================
        function startArray() {
            const sel = selectedShapes.filter(x => !isBg(x));
            if (!sel.length) { setMode('select-box'); t2.arrayPending = true; updateCommandMessageText('RÉSEAU : sélectionnez les objets à répéter, puis Espace (ou recliquez le bouton Réseau).'); draw(); return; }
            setMode('array'); selectedShapes = sel;
            const bb = getShapesBoundingBox(sel) || { minX: 0, maxX: 1, minY: 0, maxY: 1 };
            const def = { kind: 'rect', nx: 4, ny: 1, dx: T2U(Math.max(bb.maxX - bb.minX, mmToWorld(1000)) * 1.5), dy: T2U(Math.max(bb.maxY - bb.minY, mmToWorld(1000)) * 1.5), n: 6, ang: 360, rot: true, pmode: 'n', pn: 5, pas: T2U(mmToWorld(25000)), align: true };
            t2.arr = Object.assign(def, t2.arrLast || {}, { sel, center: null, path: null, pick: null });
            t2ArrayPanel(); draw();
        }
        function t2ArrayPanel() {
            const A = t2.arr; if (!A) return; const u = currentUnit, rd = 't2ArrRead()';
            const tab = (k, t) => t2Tab(A.kind, k, t, `t2ArrRead();t2.arr.kind='${k}';t2.arr.pick=null;t2ArrayPanel();draw()`);
            let h = `<div style="display:flex;gap:6px">${tab('rect', '▦ Grille')}${tab('polar', '◔ Autour d\'un centre')}${tab('path', '〰 Le long d\'un tracé')}</div>`;
            if (A.kind === 'rect') {
                h += t2Note('Les copies se rangent en lignes et en colonnes, comme des places de parking ou des plots.')
                    + t2Row('Nombre de colonnes', t2Inp('ar-nx', A.nx, 60, rd)) + t2Row('Nombre de lignes', t2Inp('ar-ny', A.ny, 60, rd))
                    + t2Row('Écart entre colonnes', t2Inp('ar-dx', A.dx, 80, rd) + u) + t2Row('Écart entre lignes', t2Inp('ar-dy', A.dy, 80, rd) + u)
                    + t2Note('L\'écart se mesure d\'un objet au suivant (même point de l\'un à l\'autre). Positif = vers la droite et vers le haut, négatif = vers la gauche et vers le bas.');
            } else if (A.kind === 'polar') {
                h += t2Note('Les copies tournent autour d\'un centre, comme des chaises autour d\'une table ronde ou des bornes autour d\'un giratoire.')
                    + t2Btn(A.center ? '✓ Centre choisi — cliquer pour le changer' : '📍 Cliquez ici, puis le centre sur le plan', "t2ArrRead();t2.arr.pick='center';draw()", !!A.center)
                    + t2Row('Nombre total (original compris)', t2Inp('ar-n', A.n, 60, rd)) + t2Row('Angle à remplir', t2Inp('ar-ang', A.ang, 60, rd) + '°')
                    + t2Chk('ar-rot', A.rot, 'Faire tourner les copies (elles regardent le centre)', rd)
                    + t2Note('360° = tout le tour, les copies se répartissent également. Angle positif = sens inverse des aiguilles d\'une montre.');
            } else {
                h += t2Note('Les copies suivent une ligne, une polyligne ou un arc, comme des candélabres le long d\'une voirie. Posez l\'original au début du tracé : il sert de modèle.')
                    + t2Btn(A.path ? '✓ Tracé choisi (' + calculateRealDistance(t2PathOf(A.path) ? t2PathOf(A.path).L : 0) + ') — cliquer pour le changer' : '〰 Cliquez ici, puis le tracé sur le plan', "t2ArrRead();t2.arr.pick='path';draw()", !!A.path)
                    + t2Row('Répartir', `<select id="ar-pm" onchange="t2ArrRead();t2ArrayPanel();draw()" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:4px 6px"><option value="n" ${A.pmode === 'n' ? 'selected' : ''}>un nombre d'objets</option><option value="pas" ${A.pmode === 'pas' ? 'selected' : ''}>un objet tous les…</option></select>`)
                    + (A.pmode === 'n' ? t2Row('Nombre total (original compris)', t2Inp('ar-pn', A.pn, 60, rd)) : t2Row('Un objet tous les', t2Inp('ar-pas', A.pas, 80, rd) + u))
                    + t2Chk('ar-al', A.align, 'Tourner les copies avec le tracé (dans les virages)', rd);
            }
            h += `<div id="ar-info" style="color:#93c5fd;font-weight:600"></div>`;
            t2Panel('▦ Réseau — ' + A.sel.length + ' objet(s)', h, [['Annuler', "setMode('select-box');draw()"], ['Créer', 't2ArrayApply()', true]]);
            t2ArrInfo();
        }
        function t2ArrRead() {
            const A = t2.arr; if (!A) return; const g = (id) => { const e = document.getElementById(id); return e ? t2Num(e.value) : NaN; }, gi = (id, k) => { const v = g(id); if (isFinite(v)) A[k] = v; };
            gi('ar-nx', 'nx'); gi('ar-ny', 'ny'); gi('ar-dx', 'dx'); gi('ar-dy', 'dy'); gi('ar-n', 'n'); gi('ar-ang', 'ang'); gi('ar-pn', 'pn'); gi('ar-pas', 'pas');
            const pm = document.getElementById('ar-pm'); if (pm) A.pmode = pm.value;
            const r = document.getElementById('ar-rot'); if (r) A.rot = r.checked; const al = document.getElementById('ar-al'); if (al) A.align = al.checked;
            t2ArrInfo(); draw();
        }
        function t2ArrInfo() {
            const e = document.getElementById('ar-info'), A = t2.arr; if (!e || !A) return;
            const n = t2ArrayXf().length;
            e.textContent = A.pick === 'center' ? '→ Cliquez le centre sur le plan.' : A.pick === 'path' ? '→ Cliquez le tracé sur le plan.' : A.kind === 'polar' && !A.center ? 'Choisissez le centre.' : A.kind === 'path' && !A.path ? 'Choisissez le tracé.' : n ? n + ' copie(s) à créer — aperçu sur le plan.' : 'Aucune copie : vérifiez les nombres.';
        }
        function t2ArrayXf() {
            const A = t2.arr; if (!A) return []; const out = [];
            if (A.kind === 'rect') {
                const nx = Math.max(1, Math.min(500, Math.round(A.nx) || 1)), ny = Math.max(1, Math.min(500, Math.round(A.ny) || 1)), dx = T2W(A.dx || 0), dy = -T2W(A.dy || 0);
                for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i || j) out.push({ dx: i * dx, dy: j * dy });
            } else if (A.kind === 'polar') {
                if (!A.center) return [];
                const n = Math.max(2, Math.min(720, Math.round(A.n) || 2)), ang = isFinite(A.ang) ? A.ang : 360, full = Math.abs(Math.abs(ang) - 360) < 1e-9, st = ang / (full ? n : n - 1) * Math.PI / 180;
                const bb = getShapesBoundingBox(A.sel), c = { x: bb.centerX, y: bb.centerY };
                for (let i = 1; i < n; i++) { const th = -st * i; if (A.rot) out.push({ rc: A.center, th }); else { const cs = Math.cos(th), sn = Math.sin(th), X = c.x - A.center.x, Y = c.y - A.center.y; out.push({ dx: A.center.x + X * cs - Y * sn - c.x, dy: A.center.y + X * sn + Y * cs - c.y }); } }
            } else {
                if (!A.path || !shapes.includes(A.path)) return [];
                const P = t2PathOf(A.path); if (!P || P.L < 1e-9) return [];
                const ds = [];
                if (A.pmode === 'n') { const n = Math.max(2, Math.min(2000, Math.round(A.pn) || 2)); for (let i = 1; i < n; i++) ds.push(i * P.L / (P.closed ? n : n - 1)); }
                else { const st = T2W(A.pas || 0); if (st > 1e-9) for (let d = st; d <= P.L + 1e-9 * Math.max(1, P.L); d += st) { ds.push(Math.min(d, P.L)); if (ds.length > 2000) break; } }
                const p0 = t2PathAt(P, 0);
                ds.forEach(d => { const q = t2PathAt(P, d); out.push({ dx: q.x - p0.x, dy: q.y - p0.y, rc: A.align ? { x: q.x, y: q.y } : null, th: A.align ? q.ang - p0.ang : 0 }); });
            }
            return out.slice(0, 5000);
        }
        function t2ApplyXf(s, f) { if (f.dx || f.dy) translateShape(s, f.dx || 0, f.dy || 0); if (f.rc && f.th) applyRotationToShape(s, f.rc.x, f.rc.y, f.th); }
        function t2ArrayApply() {
            t2ArrRead(); const A = t2.arr; if (!A) return; const X = t2ArrayXf();
            if (!X.length) { updateCommandMessageText(A.kind === 'polar' && !A.center ? 'RÉSEAU : choisissez d\'abord le centre.' : A.kind === 'path' && !A.path ? 'RÉSEAU : choisissez d\'abord le tracé.' : 'RÉSEAU : aucune copie à créer (vérifiez les nombres).'); return; }
            const out = []; X.forEach(f => { const cl = t2Clone(A.sel); cl.forEach(s => t2ApplyXf(s, f)); out.push(...cl); });
            shapes.push(...out); t2.arrLast = { kind: A.kind, nx: A.nx, ny: A.ny, dx: A.dx, dy: A.dy, n: A.n, ang: A.ang, rot: A.rot, pmode: A.pmode, pn: A.pn, pas: A.pas, align: A.align };
            saveState(); const sel = A.sel; setMode('select-box'); selectedShapes = sel.concat(out); draw();
            updateCommandMessageText('RÉSEAU : ' + X.length + ' copie(s) créée(s), ' + out.length + ' objet(s) ajouté(s).');
        }

        // =====================================================================
        // JOINDRE : droites, polylignes ouvertes et arcs bout à bout -> une polyligne (fermée si elle boucle)
        // =====================================================================
        const t2Joinable = (s) => s && !s.solid && !s.gen && !s.sweep && !s.wall && !isPlateforme(s) && (s.type === 'line' || s.type === 'arc' || (s.type === 'poly' && s.open && s.points.length >= 2));
        function startJoin() {
            const sel = selectedShapes.filter(t2Joinable);
            if (sel.length >= 2) { t2DoJoin(sel); return; }
            setMode('join'); selectedShapes = sel; updateCommandMessage(); draw();
        }
        function t2DoJoin(list) {
            list = list.filter(t2Joinable);
            if (list.length < 2) { updateCommandMessageText('JOINDRE : choisissez au moins 2 traits (droites, polylignes ouvertes, arcs) qui se touchent bout à bout.'); return; }
            const tol = Math.max(2 / camera.zoom, 1e-6), near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;
            const pieces = list.map(s => {
                let pts;
                if (s.type === 'line') { pts = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]; if (hasZ(s.z1)) pts[0].z = s.z1; if (hasZ(s.z2)) pts[1].z = s.z2; }
                else if (s.type === 'arc') { pts = t2PathOf(s).pts.map(q => (hasZ(s.z) ? { x: q.x, y: q.y, z: s.z } : { x: q.x, y: q.y })); }
                else pts = s.points.map(q => Object.assign({}, q));
                return { s, pts };
            });
            const chains = [];
            while (pieces.length) {
                const first = pieces.shift(); let ch = first.pts.slice(), members = [first.s], found = true;
                while (found) {
                    found = false;
                    for (let i = 0; i < pieces.length; i++) {
                        const p = pieces[i], h = ch[0], t = ch[ch.length - 1], a = p.pts[0], b = p.pts[p.pts.length - 1];
                        if (near(t, a)) ch = ch.concat(p.pts.slice(1));
                        else if (near(t, b)) ch = ch.concat(p.pts.slice().reverse().slice(1));
                        else if (near(h, b)) ch = p.pts.slice(0, -1).concat(ch);
                        else if (near(h, a)) ch = p.pts.slice().reverse().slice(0, -1).concat(ch);
                        else continue;
                        members.push(p.s); pieces.splice(i, 1); found = true; break;
                    }
                }
                chains.push({ ch, members });
            }
            const made = [], removed = []; let closedN = 0;
            chains.forEach(({ ch, members }) => {
                if (members.length < 2) return;
                const s0 = members[0], closed = ch.length >= 4 && near(ch[0], ch[ch.length - 1]);
                if (closed) { ch.pop(); closedN++; }
                const np = { type: 'poly', layerId: s0.layerId, points: ch, open: !closed, color: s0.color, dash: s0.dash, width: s0.width, hatch: false, zk: 1 };
                if (s0.lt !== undefined) np.lt = s0.lt;
                made.push(np); removed.push(...members);
            });
            if (!made.length) { updateCommandMessageText('JOINDRE : aucun bout ne se touche. Rapprochez les extrémités (accroche Extrémité) puis recommencez.'); return; }
            shapes = shapes.filter(s => !removed.includes(s)).concat(made); saveState();
            setMode('select-box'); selectedShapes = made; draw();
            updateCommandMessageText('JOINDRE : ' + removed.length + ' trait(s) réunis en ' + made.length + ' polyligne(s)' + (closedN ? ', dont ' + closedN + ' fermée(s) : elle(s) peu(ven)t servir d\'emprise, de hachure ou de plateforme' : '') + '.');
        }

        // =====================================================================
        // COUPER AU POINT : un trait devient deux, à l'endroit cliqué (accroches actives)
        // =====================================================================
        // AJOUTER UN POINT : un sommet de plus sur un trait (il devient un point d'accroche) ; sur une plateforme, l'arête est coupée en deux arêtes de talus (mêmes réglages au départ)
        // sommet sous le curseur (outil « ajouter un point ») : { t, i } sur une polyligne, ou { L: [a, ea, b, eb] } pour deux droites bout à bout ; sinon null
        function t2VertexAt(w) { const r = 7 / camera.zoom, ok = (t) => t && !t.gen && !t.roofDef && !t.wallMat && !t.brush && !t._nosnap && (layers.find(l => l.id === (t.layerId || 'layer-0')) || { visible: true }).visible !== false; let best = null, bd = r;
            for (const t of shapes) { if (t.type !== 'poly' || !ok(t)) continue; t.points.forEach((q, i) => { const d = Math.hypot(q.x - w.x, q.y - w.y); if (d < bd) { bd = d; best = { t, i }; } }); }
            if (best) return best; const ends = []; for (const t of shapes) { if (t.type !== 'line' || !ok(t)) continue; [[t.x1, t.y1, 1], [t.x2, t.y2, 2]].forEach(([x, y, e]) => { if (Math.hypot(x - w.x, y - w.y) < r) ends.push([t, e, x, y]); }); }
            if (ends.length === 2 && ends[0][0] !== ends[1][0] && Math.hypot(ends[0][2] - ends[1][2], ends[0][3] - ends[1][3]) < mmToWorld(1)) return { L: [ends[0][0], ends[0][1], ends[1][0], ends[1][1]] }; return null; }
        // retirer un sommet : la polyligne passe directement du sommet d'avant au sommet d'après ; deux droites bout à bout redeviennent une seule droite
        function t2DelPt(V) {
            if (V.L) { const [a, ea, b, eb] = V.L, A = ea === 1 ? { x: a.x2, y: a.y2, z: a.z2 } : { x: a.x1, y: a.y1, z: a.z1 }, B = eb === 1 ? { x: b.x2, y: b.y2, z: b.z2 } : { x: b.x1, y: b.y1, z: b.z1 };
                a.x1 = A.x; a.y1 = A.y; a.x2 = B.x; a.y2 = B.y; if (hasZ(A.z)) a.z1 = A.z; else delete a.z1; if (hasZ(B.z)) a.z2 = B.z; else delete a.z2; shapes.splice(shapes.indexOf(b), 1); selectedShapes = selectedShapes.filter(x => x !== b);
                saveState(); invalidateCache(); draw(); updateCommandMessageText('RETIRER UN POINT : les deux droites n\'en font plus qu\'une. Cliquez un autre sommet, ou Échap.'); return; }
            const t = V.t, n = t.points.length, i = V.i;
            if (n <= (t.open ? 2 : 3)) { updateCommandMessageText('RETIRER UN POINT : ' + (t.open ? 'une polyligne garde au moins 2 sommets' : 'un contour fermé garde au moins 3 sommets') + ' — supprimez l\'objet entier si besoin.'); return; }
            t.points.splice(i, 1);
            // talus par arête : l'arête qui arrivait au sommet garde son réglage et va jusqu'au sommet suivant
            if (t.talus && Array.isArray(t.talus.edges)) { const E = t.talus.edges; while (E.length < n) E.push(null); E.splice(t.open ? Math.min(i, n - 2) : i, 1); if (!E.some(Boolean)) delete t.talus.edges; }
            saveState(); invalidateCache(); draw();
            updateCommandMessageText('RETIRER UN POINT : sommet retiré' + (isPlateforme(t) && platTalus(t).cx ? ' — les deux talus voisins n\'en font plus qu\'un (réglage de celui d\'avant).' : '.') + ' Cliquez un autre sommet, ou Échap.');
        }
        function t2AddPt(w) {
            { const V = t2VertexAt(w); if (V) { t2DelPt(V); return; } }   // sur un sommet existant : l'outil le retire
            const t = findShapeAt(w.x, w.y);
            if (!t || !['line', 'poly'].includes(t.type) || t.gen || t.roofDef || t.wallMat || t.brush) { updateCommandMessageText(t && t.type === 'circle' ? 'AJOUTER UN POINT : un cercle n\'a pas de sommet ; cliquez une droite, une polyligne ou le bord d\'une plateforme.' : 'AJOUTER UN POINT : cliquez sur une droite, une polyligne ou le bord d\'une plateforme.'); return; }
            const sn = findSnap(w.x, w.y), P0 = sn ? { x: sn.x, y: sn.y } : { x: w.x, y: w.y }, tol = 2 / camera.zoom;
            if (t.type === 'line') {   // une droite : coupée en deux droites qui se touchent au nouveau point
                const dx = t.x2 - t.x1, dy = t.y2 - t.y1, L2 = dx * dx + dy * dy, k = L2 ? ((P0.x - t.x1) * dx + (P0.y - t.y1) * dy) / L2 : 0;
                if (k * Math.sqrt(L2) < tol || (1 - k) * Math.sqrt(L2) < tol) { updateCommandMessageText('AJOUTER UN POINT : cliquez entre les deux bouts.'); return; }
                const P = { x: t.x1 + dx * k, y: t.y1 + dy * k }, z = hasZ(t.z1) && hasZ(t.z2) ? t.z1 + (t.z2 - t.z1) * k : undefined, b = JSON.parse(JSON.stringify(t));
                t.x2 = P.x; t.y2 = P.y; b.x1 = P.x; b.y1 = P.y; if (hasZ(z)) { t.z2 = z; b.z1 = z; } shapes.splice(shapes.indexOf(t) + 1, 0, b);
            } else {
                const n = t.points.length, ne = t.open ? n - 1 : n; let bi = -1, bd = Infinity, bk = 0;
                for (let i = 0; i < ne; i++) { const A = t.points[i], B = t.points[(i + 1) % n], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy; if (!l2) continue; const k = Math.max(0, Math.min(1, ((P0.x - A.x) * dx + (P0.y - A.y) * dy) / l2)), d = Math.hypot(P0.x - A.x - k * dx, P0.y - A.y - k * dy); if (d < bd) { bd = d; bi = i; bk = k; } }
                const A = t.points[bi], B = t.points[(bi + 1) % n], L = Math.hypot(B.x - A.x, B.y - A.y);
                if (bi < 0 || bk * L < tol || (1 - bk) * L < tol) { updateCommandMessageText('AJOUTER UN POINT : cliquez entre deux sommets, pas sur un sommet.'); return; }
                const q = { x: A.x + (B.x - A.x) * bk, y: A.y + (B.y - A.y) * bk }; if (hasZ(A.z) && hasZ(B.z)) q.z = A.z + (B.z - A.z) * bk; else if (hasZ(A.z)) q.z = A.z;
                t.points.splice(bi + 1, 0, q);
                if (t.talus && Array.isArray(t.talus.edges)) { const e = t.talus.edges[bi]; while (t.talus.edges.length < n) t.talus.edges.push(null); t.talus.edges.splice(bi + 1, 0, e ? JSON.parse(JSON.stringify(e)) : null); }
            }
            saveState(); invalidateCache(); draw();
            updateCommandMessageText('AJOUTER UN POINT : sommet ajouté' + (isPlateforme(t) && platTalus(t).cx ? ' — l\'arête est coupée en deux talus (même réglage pour l\'instant ; Y › Talus pour les régler séparément).' : ' (point d\'accroche).') + ' Cliquez un autre endroit, ou Échap.');
        }
        function t2Break(w) {
            const t = findShapeAt(w.x, w.y);
            if (!t || !['line', 'poly', 'arc'].includes(t.type) || t.solid || t.gen || isPlateforme(t)) { updateCommandMessageText(t && (t.solid || isPlateforme(t)) ? 'COUPER AU POINT : les volumes et les plateformes ne se coupent pas.' : t && t.type === 'circle' ? 'COUPER AU POINT : un cercle n\'a pas de bout ; coupez-le avec Ajuster, ou cliquez un arc, une droite ou une polyligne.' : 'COUPER AU POINT : cliquez sur une droite, une polyligne ou un arc, à l\'endroit de la coupure.'); return; }
            const sn = findSnap(w.x, w.y), P0 = sn ? { x: sn.x, y: sn.y } : { x: w.x, y: w.y }, tol = 2 / camera.zoom, out = [];
            const clone = () => { const c = JSON.parse(JSON.stringify(t)); delete c._nosnap; c.zk = 1; return c; };
            if (t.type === 'line') {
                const dx = t.x2 - t.x1, dy = t.y2 - t.y1, L2 = dx * dx + dy * dy; let k = ((P0.x - t.x1) * dx + (P0.y - t.y1) * dy) / L2;
                if (k * Math.sqrt(L2) < tol || (1 - k) * Math.sqrt(L2) < tol) { updateCommandMessageText('COUPER AU POINT : cliquez entre les deux bouts, pas sur une extrémité.'); return; }
                const P = { x: t.x1 + dx * k, y: t.y1 + dy * k }, z = hasZ(t.z1) && hasZ(t.z2) ? t.z1 + (t.z2 - t.z1) * k : undefined;
                const a = clone(), b = clone(); a.x2 = P.x; a.y2 = P.y; b.x1 = P.x; b.y1 = P.y; if (hasZ(z)) { a.z2 = z; b.z1 = z; } else { delete a.z2; delete b.z1; }
                out.push(a, b);
            } else if (t.type === 'arc') {
                const an = Math.atan2(P0.y - t.y, P0.x - t.x); if (!t2OnArc(t, an)) { updateCommandMessageText('COUPER AU POINT : cliquez sur l\'arc lui-même.'); return; }
                const a = clone(), b = clone(); a.endAngle = an; b.startAngle = an;
                if (t2ArcSweep(a) * t.r < tol || t2ArcSweep(b) * t.r < tol || t2ArcSweep(a) > t2ArcSweep(t) + 1e-9) { updateCommandMessageText('COUPER AU POINT : cliquez entre les deux bouts de l\'arc.'); return; }
                out.push(a, b);
            } else {
                const n = t.points.length, ne = t.open ? n - 1 : n; let bi = -1, bd = Infinity, bk = 0;
                for (let i = 0; i < ne; i++) { const A = t.points[i], B = t.points[(i + 1) % n], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy; if (!l2) continue; let k = Math.max(0, Math.min(1, ((P0.x - A.x) * dx + (P0.y - A.y) * dy) / l2)); const d = Math.hypot(P0.x - A.x - k * dx, P0.y - A.y - k * dy); if (d < bd) { bd = d; bi = i; bk = k; } }
                const A = t.points[bi], B = t.points[(bi + 1) % n], P = { x: A.x + (B.x - A.x) * bk, y: A.y + (B.y - A.y) * bk };
                if (hasZ(A.z) && hasZ(B.z)) P.z = A.z + (B.z - A.z) * bk;
                const atA = Math.hypot(P.x - A.x, P.y - A.y) < tol, atB = Math.hypot(P.x - B.x, P.y - B.y) < tol;
                const head = t.points.slice(0, bi + 1).map(q => Object.assign({}, q)), tail = t.points.slice(bi + 1).map(q => Object.assign({}, q));
                if (t.open) {
                    const p1 = atA ? head : atB ? head.concat([Object.assign({}, B)]) : head.concat([P]), p2 = atA ? [Object.assign({}, A)].concat(tail) : atB ? tail : [P].concat(tail);
                    if (p1.length < 2 || p2.length < 2) { updateCommandMessageText('COUPER AU POINT : cliquez entre les deux bouts, pas sur une extrémité.'); return; }
                    const a = clone(), b = clone(); a.points = p1; b.points = p2; delete a.curve; delete b.curve; out.push(a, b);
                } else {
                    // polyligne fermée : elle s'ouvre au point cliqué (une seule pièce, début = fin = le point)
                    const k0 = atA ? bi : atB ? (bi + 1) % n : -1, pts = [];
                    if (k0 >= 0) for (let j = 0; j <= n; j++) pts.push(Object.assign({}, t.points[(k0 + j) % n]));
                    else { pts.push(P); for (let j = 1; j <= n; j++) pts.push(Object.assign({}, t.points[(bi + j) % n])); pts.push(Object.assign({}, P)); }
                    const a = clone(); a.points = pts; a.open = true; a.hatch = false; delete a.curve; out.push(a);
                }
            }
            const i = shapes.indexOf(t); shapes.splice(i, 1, ...out); saveState(); selectedShapes = out; draw();
            updateCommandMessageText(out.length === 2 ? 'COUPER AU POINT : le trait est maintenant en 2 morceaux (sélectionnés). Cliquez une autre coupure, ou Échap.' : 'COUPER AU POINT : la polyligne fermée est ouverte à cet endroit. Cliquez une autre coupure, ou Échap.');
        }

        // =====================================================================
        // CHANFREIN : 2 droites, 1 ou 2 distances -> pan coupé
        // =====================================================================
        function t2Chamfer(d1, d2) {
            const L1 = t2.chA.s, L2 = t2.chB.s;
            const v1 = { x: L1.x2 - L1.x1, y: L1.y2 - L1.y1 }, v2 = { x: L2.x2 - L2.x1, y: L2.y2 - L2.y1 }, den = v1.x * v2.y - v1.y * v2.x;
            if (Math.abs(den) < 1e-9 * Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) return 'les deux droites sont parallèles';
            const tI = ((L2.x1 - L1.x1) * v2.y - (L2.y1 - L1.y1) * v2.x) / den, I = { x: L1.x1 + v1.x * tI, y: L1.y1 + v1.y * tI };
            const side = (L, c) => {
                const n = Math.hypot(L.x2 - L.x1, L.y2 - L.y1), u = { x: (L.x2 - L.x1) / n, y: (L.y2 - L.y1) / n }, sc = (P) => (P.x - I.x) * u.x + (P.y - I.y) * u.y;
                const s1 = sc({ x: L.x1, y: L.y1 }), s2 = sc({ x: L.x2, y: L.y2 }), sg = Math.sign(sc(c)) || Math.sign(Math.abs(s1) > Math.abs(s2) ? s1 : s2);
                return { u: { x: u.x * sg, y: u.y * sg }, keep1: Math.abs(s1) * Math.sign(s1) * sg >= Math.abs(s2) * Math.sign(s2) * sg, len: Math.max(s1 * sg, s2 * sg) };
            };
            const A = side(L1, t2.chA.c), B = side(L2, t2.chB.c);
            if (d1 > A.len + 1e-6 || d2 > B.len + 1e-6) return 'distance plus grande que la droite';
            const T1 = { x: I.x + A.u.x * d1, y: I.y + A.u.y * d1 }, T2 = { x: I.x + B.u.x * d2, y: I.y + B.u.y * d2 };
            const setEnd = (L, keep1, T) => {
                const z = (hasZ(L.z1) && hasZ(L.z2)) ? (() => { const n2 = (L.x2 - L.x1) ** 2 + (L.y2 - L.y1) ** 2, k = ((T.x - L.x1) * (L.x2 - L.x1) + (T.y - L.y1) * (L.y2 - L.y1)) / n2; return L.z1 + (L.z2 - L.z1) * k; })() : undefined;
                if (keep1) { L.x2 = T.x; L.y2 = T.y; if (hasZ(z)) L.z2 = z; } else { L.x1 = T.x; L.y1 = T.y; if (hasZ(z)) L.z1 = z; }
                return z;
            };
            const za = setEnd(L1, A.keep1, T1), zb = setEnd(L2, B.keep1, T2);
            if (Math.hypot(T2.x - T1.x, T2.y - T1.y) > 1e-9) { const ln = { type: 'line', layerId: L1.layerId, x1: T1.x, y1: T1.y, x2: T2.x, y2: T2.y, color: L1.color, dash: L1.dash, width: L1.width, zk: 1 }; if (hasZ(za)) ln.z1 = za; if (hasZ(zb)) ln.z2 = zb; shapes.push(ln); }
            return null;
        }
        function t2ChamferApply(txt) {
            const parts = String(txt).split(/[\/;]/).map(t2Num).filter(v => isFinite(v));
            if (!parts.length || parts.some(v => v < 0)) { updateCommandMessageText('CHANFREIN : tapez une distance (ex. 0,5) ou deux distances séparées par / (ex. 0,5/1).'); return; }
            const d1 = parts[0], d2 = parts.length > 1 ? parts[1] : parts[0], err = t2Chamfer(T2W(d1), T2W(d2));
            if (err) { updateCommandMessageText('CHANFREIN : ' + err + '. Recommencez.'); t2.chA = t2.chB = null; typedInput = ''; selectedShapes = []; draw(); return; }
            t2.chD = String(txt); try { localStorage.setItem('momocad-chamfer', t2.chD); } catch (e) {}
            t2.chA = t2.chB = null; typedInput = ''; selectedShapes = []; saveState(); draw();
            updateCommandMessageText('CHANFREIN : pan coupé de ' + t2Fr(d1) + (d2 !== d1 ? ' × ' + t2Fr(d2) : '') + ' ' + currentUnit + ' fait. Cliquez 2 autres droites, ou Échap.');
        }

        // =====================================================================
        // LONGUEUR : allonger / raccourcir une droite, un arc ou une polyligne ouverte
        // =====================================================================
        const t2Lengthable = (s) => s && !s.solid && !s.gen && !isPlateforme(s) && (s.type === 'line' || s.type === 'arc' || (s.type === 'poly' && s.open && s.points.length >= 2));
        function t2LenOf(s) {
            if (s.type === 'line') return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
            if (s.type === 'arc') return s.r * t2ArcSweep(s);
            let L = 0; for (let i = 1; i < s.points.length; i++) L += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y); return L;
        }
        function t2EndsOf(s) {
            if (s.type === 'line') return [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
            if (s.type === 'arc') return [{ x: s.x + s.r * Math.cos(s.startAngle), y: s.y + s.r * Math.sin(s.startAngle) }, { x: s.x + s.r * Math.cos(s.endAngle), y: s.y + s.r * Math.sin(s.endAngle) }];
            return [s.points[0], s.points[s.points.length - 1]];
        }
        // nouvelle longueur totale T (monde) côté 'end' (0 = début, 1 = fin) ; renvoie un message d'erreur ou null
        function t2LenSet(s, end, T) {
            if (!(T > 1e-9)) return 'la longueur deviendrait nulle';
            const L = t2LenOf(s);
            if (s.type === 'line') {
                const O = end ? { x: s.x1, y: s.y1, z: s.z1 } : { x: s.x2, y: s.y2, z: s.z2 }, C = end ? { x: s.x2, y: s.y2, z: s.z2 } : { x: s.x1, y: s.y1, z: s.z1 };
                if (L < 1e-12) return 'droite de longueur nulle';
                const u = { x: (C.x - O.x) / L, y: (C.y - O.y) / L }, N = { x: O.x + u.x * T, y: O.y + u.y * T }, z = hasZ(O.z) && hasZ(C.z) ? O.z + (C.z - O.z) * T / L : C.z;
                if (end) { s.x2 = N.x; s.y2 = N.y; if (hasZ(z)) s.z2 = z; } else { s.x1 = N.x; s.y1 = N.y; if (hasZ(z)) s.z1 = z; }
                return null;
            }
            if (s.type === 'arc') {
                const sw = T / s.r, sg = s.anticlockwise ? -1 : 1; if (sw >= 2 * Math.PI - 1e-6) return 'l\'arc ferait un tour complet';
                if (end) s.endAngle = s.startAngle + sg * sw; else s.startAngle = s.endAngle - sg * sw;
                return null;
            }
            let pts = s.points.map(q => Object.assign({}, q)); if (!end) pts.reverse();
            let delta = T - L;
            if (delta >= 0) { const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b.x - a.x, b.y - a.y); if (l < 1e-12) return 'dernier segment de longueur nulle'; b.x += (b.x - a.x) / l * delta; b.y += (b.y - a.y) / l * delta; }
            else {
                let rem = -delta;
                while (pts.length > 2) { const l = Math.hypot(pts[pts.length - 1].x - pts[pts.length - 2].x, pts[pts.length - 1].y - pts[pts.length - 2].y); if (l > rem + 1e-12) break; rem -= l; pts.pop(); }
                const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b.x - a.x, b.y - a.y); if (l <= rem + 1e-12) return 'la longueur deviendrait nulle';
                b.x -= (b.x - a.x) / l * rem; b.y -= (b.y - a.y) / l * rem;
            }
            if (!end) pts.reverse(); s.points = pts; delete s.curve; return null;
        }
        // longueur visée par la souris pendant le tirage
        function t2LenDynT() {
            const D = t2.lenDyn; if (!D) return null; const s = JSON.parse(D.orig), cur = { x: currentX, y: currentY };
            if (s.type === 'line') { const O = D.end ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 }, C = D.end ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 }, L = Math.hypot(C.x - O.x, C.y - O.y); return ((cur.x - O.x) * (C.x - O.x) + (cur.y - O.y) * (C.y - O.y)) / L; }
            if (s.type === 'arc') { const a = Math.atan2(cur.y - s.y, cur.x - s.x), sg = s.anticlockwise ? -1 : 1, P2 = 2 * Math.PI; let sw = D.end ? (a - s.startAngle) * sg : (s.endAngle - a) * sg; sw = ((sw % P2) + P2) % P2; return s.r * sw; }
            const pts = D.end ? s.points : s.points.slice().reverse(), a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b.x - a.x, b.y - a.y);
            return t2LenOf(s) - l + ((cur.x - a.x) * (b.x - a.x) + (cur.y - a.y) * (b.y - a.y)) / l;
        }
        function t2LenClick(w) {
            if (t2.lenDyn) { const T = t2LenDynT(); t2LenFinish(T); return; }
            const t = findShapeAt(w.x, w.y);
            if (!t2Lengthable(t)) { updateCommandMessageText('LONGUEUR : cliquez près du bout d\'une droite, d\'un arc ou d\'une polyligne ouverte.'); return; }
            const E = t2EndsOf(t), end = Math.hypot(w.x - E[1].x, w.y - E[1].y) < Math.hypot(w.x - E[0].x, w.y - E[0].y) ? 1 : 0;
            if (t2.lenSpec) {
                const L = t2LenOf(t), T = t2.lenSpec.kind === 'total' ? T2W(t2.lenSpec.v) : L + T2W(t2.lenSpec.v), err = t2LenSet(t, end, T);
                if (err) { updateCommandMessageText('LONGUEUR : ' + err + '.'); return; }
                saveState(); draw(); updateCommandMessageText('LONGUEUR : ' + calculateRealDistance(L) + ' → ' + calculateRealDistance(T) + '. Cliquez un autre bout, ou Échap.'); return;
            }
            t2.lenDyn = { s: t, end, orig: JSON.stringify(t) }; selectedShapes = [t]; typedInput = ''; draw();
        }
        function t2LenFinish(T) {
            const D = t2.lenDyn; if (!D) return; const s = D.s, keep = D.orig, L = t2LenOf(JSON.parse(keep)), err = t2LenSet(s, D.end, T);
            if (err) { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, JSON.parse(keep)); updateCommandMessageText('LONGUEUR : ' + err + '.'); t2.lenDyn = null; draw(); return; }
            t2.lenDyn = null; typedInput = ''; selectedShapes = []; saveState(); draw();
            updateCommandMessageText('LONGUEUR : ' + calculateRealDistance(L) + ' → ' + calculateRealDistance(T) + '. Cliquez un autre bout, ou Échap.');
        }

        // =====================================================================
        // ELLIPSE : centre, bout du 1er demi-axe, puis 2e demi-axe (polyligne fermée lissée)
        // =====================================================================
        function t2EllPts(c, a, b, rot) { const out = [], cs = Math.cos(rot), sn = Math.sin(rot); for (let i = 0; i < 96; i++) { const t = i / 96 * 2 * Math.PI, X = a * Math.cos(t), Y = b * Math.sin(t); out.push({ x: c.x + X * cs - Y * sn, y: c.y + X * sn + Y * cs }); } return out; }
        function t2EllB() { const E = t2.ell; if (!E || E.step !== 2) return 0; const v = t2Num(typedInput); if (v > 0) return T2W(v); const ux = Math.cos(E.rot), uy = Math.sin(E.rot); return Math.abs((currentX - E.c.x) * -uy + (currentY - E.c.y) * ux); }
        function t2EllCreate(b) {
            const E = t2.ell; if (!(b > 1e-9) || !(E.a > 1e-9)) return; const P = t2Props();
            shapes.push({ type: 'poly', layerId: activeLayerId, points: t2EllPts(E.c, E.a, b, E.rot), curve: 24, ell: 1, color: P.color, dash: P.dash, width: P.width, hatch: false });
            t2.ell = { step: 0 }; typedInput = ''; saveState(); draw();
            updateCommandMessageText('ELLIPSE : ' + calculateRealDistance(2 * E.a) + ' × ' + calculateRealDistance(2 * b) + ' créée. Cliquez le centre d\'une autre, ou Échap.');
        }
        function t2EllClick(w, shift) {
            const E = t2.ell || (t2.ell = { step: 0 }), p = t2Pt(w.x, w.y);
            if (E.step === 0) { E.c = { x: p.x, y: p.y }; E.step = 1; typedInput = ''; }
            else if (E.step === 1) { const q = t2Constrain(E.c, p, shift, !!p.sn), v = t2Num(typedInput); E.rot = Math.atan2(q.y - E.c.y, q.x - E.c.x); E.a = v > 0 ? T2W(v) : Math.hypot(q.x - E.c.x, q.y - E.c.y); if (E.a > 1e-9) { E.step = 2; typedInput = ''; } }
            else { const ux = Math.cos(E.rot), uy = Math.sin(E.rot); t2EllCreate(Math.abs((p.x - E.c.x) * -uy + (p.y - E.c.y) * ux)); return; }
            draw();
        }

        // =====================================================================
        // DIVISER : repères tous les X m ou en N parts égales le long d'un tracé (points, traits, blocs)
        // =====================================================================
        function t2DivStations(P, D) {
            const out = [], L = P.L;
            if (D.mode === 'n') { const n = Math.max(2, Math.min(5000, Math.round(D.n) || 2)); for (let i = 1; i < n; i++) out.push(i * L / n); }
            else { const st = T2W(D.pas || 0); if (st > 1e-9) for (let d = st; d < L - 1e-7 * Math.max(1, L); d += st) { out.push(d); if (out.length > 5000) break; } }
            if (D.ends) { out.unshift(0); if (!P.closed) out.push(L); }
            return out;
        }
        function t2DivShapes(D) {
            const P = t2PathOf(D.s); if (!P || P.L < 1e-9) return [];
            const out = [], st = t2DivStations(P, D), b = D.what === 'block' ? allBlocks().find(x => x.id === D.blk) : null, lid = b ? blockLayerId(b) : activeLayerId, half = T2W(D.len || 0.5) / 2;
            st.forEach(d => {
                const q = t2PathAt(P, d);
                if (D.what === 'point') out.push({ type: 'point', layerId: activeLayerId, x: q.x, y: q.y });
                else if (D.what === 'tick') { const nx = -Math.sin(q.ang), ny = Math.cos(q.ang); out.push({ type: 'line', layerId: activeLayerId, x1: q.x - nx * half, y1: q.y - ny * half, x2: q.x + nx * half, y2: q.y + ny * half }); }
                else if (b) { const gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6); blockShapes(b, q.x, q.y, 1, D.align ? q.ang : 0).forEach(sh => { sh.groupId = gid; sh.block = b.name; sh.layerId = lid; out.push(sh); }); }
            });
            return out;
        }
        function t2DivClick(w) {
            const t = findShapeAt(w.x, w.y);
            if (!t2IsPath(t)) { updateCommandMessageText('DIVISER : cliquez une droite, une polyligne, un arc ou un cercle (le tracé à jalonner).'); return; }
            const blocks = allBlocks();
            t2.div = Object.assign({ mode: 'pas', n: 5, pas: T2U(mmToWorld(25000)), what: 'point', blk: blocks.length ? blocks[0].id : null, align: true, ends: true, len: T2U(mmToWorld(500)) }, t2.divLast || {}, { s: t });
            selectedShapes = [t]; t2DivPanel(); draw();
        }
        function t2DivPanel() {
            const D = t2.div; if (!D) return; const u = currentUnit, rd = 't2DivRead()', P = t2PathOf(D.s);
            const tab = (k, t) => t2Tab(D.mode, k, t, `t2DivRead();t2.div.mode='${k}';t2DivPanel();draw()`), wt = (k, t) => t2Tab(D.what, k, t, `t2DivRead();t2.div.what='${k}';t2DivPanel();draw()`);
            let h = t2Note('Le tracé fait <b style="color:#fff">' + calculateRealDistance(P ? P.L : 0) + '</b>. Diviser y pose des repères réguliers, sans le couper : implantation de candélabres, de bornes, de regards, ou simples jalons de chantier.')
                + `<div style="display:flex;gap:6px">${tab('pas', 'Un repère tous les…')}${tab('n', 'En parts égales')}</div>`
                + (D.mode === 'pas' ? t2Row('Distance entre repères', t2Inp('dv-pas', D.pas, 80, rd) + u) : t2Row('Nombre de parts', t2Inp('dv-n', D.n, 60, rd)))
                + `<div style="color:#9ca3af;font-size:12px;margin-top:2px">Que poser à chaque repère ?</div><div style="display:flex;gap:6px">${wt('point', '• Point')}${wt('tick', '┼ Trait')}${wt('block', '❖ Bloc')}</div>`;
            if (D.what === 'tick') h += t2Row('Longueur du trait (en travers)', t2Inp('dv-len', D.len, 80, rd) + u);
            if (D.what === 'block') h += t2Row('Bloc', `<select id="dv-blk" onchange="${rd}" style="max-width:170px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:4px 6px">${allBlocks().map(b => `<option value="${b.id}" ${b.id === D.blk ? 'selected' : ''}>${b.name.replace(/</g, '&lt;')}</option>`).join('')}</select>`) + t2Chk('dv-al', D.align, 'Tourner les blocs avec le tracé', rd);
            h += t2Chk('dv-end', D.ends, 'Poser aussi un repère aux deux bouts', rd) + `<div id="dv-info" style="color:#93c5fd;font-weight:600"></div>`;
            t2Panel('┼ Diviser le tracé', h, [['Annuler', "setMode('select-box');draw()"], ['Poser', 't2DivApply()', true]]);
            t2DivInfo();
        }
        function t2DivRead() {
            const D = t2.div; if (!D) return; const g = (id, k) => { const e = document.getElementById(id); if (e) { const v = t2Num(e.value); if (isFinite(v)) D[k] = v; } };
            g('dv-pas', 'pas'); g('dv-n', 'n'); g('dv-len', 'len'); const b = document.getElementById('dv-blk'); if (b) D.blk = b.value;
            const al = document.getElementById('dv-al'); if (al) D.align = al.checked; const en = document.getElementById('dv-end'); if (en) D.ends = en.checked;
            t2DivInfo(); draw();
        }
        function t2DivInfo() { const e = document.getElementById('dv-info'), D = t2.div; if (!e || !D) return; const P = t2PathOf(D.s), n = P ? t2DivStations(P, D).length : 0; e.textContent = n ? n + ' repère(s) — aperçu sur le plan.' : 'Aucun repère : distance trop grande ?'; }
        function t2DivApply() {
            t2DivRead(); const D = t2.div; if (!D) return; const out = t2DivShapes(D);
            if (!out.length) { updateCommandMessageText('DIVISER : aucun repère à poser (distance plus grande que le tracé ?).'); return; }
            shapes.push(...out); t2.divLast = { mode: D.mode, n: D.n, pas: D.pas, what: D.what, blk: D.blk, align: D.align, ends: D.ends, len: D.len };
            saveState(); t2.div = null; t2PanelClose(); selectedShapes = []; draw();
            updateCommandMessageText('DIVISER : repères posés le long du tracé. Cliquez un autre tracé, ou Échap.');
        }

        // =====================================================================
        // COTES DE RAYON ET DE DIAMÈTRE (type 'dimr' : centre x,y ; flèche ax,ay sur le cercle ; texte lx,ly)
        // =====================================================================
        function t2DimRGeom(s, dx, dy) {
            dx = dx || 0; dy = dy || 0;
            const C = { x: s.x + dx, y: s.y + dy }, A = { x: s.ax + dx, y: s.ay + dy }, Lp = { x: s.lx + dx, y: s.ly + dy }, r = Math.hypot(A.x - C.x, A.y - C.y); if (r < 1e-9) return null;
            const u = { x: (A.x - C.x) / r, y: (A.y - C.y) / r }, dl = (Lp.x - C.x) * u.x + (Lp.y - C.y) * u.y;
            const E = dl > r ? { x: C.x + u.x * dl, y: C.y + u.y * dl } : A, S = s.dia ? { x: C.x - u.x * r, y: C.y - u.y * r } : C;
            return { C, A, L: Lp, r, u, dl, E, S };
        }
        // texte de cote personnalisé (Y › Texte de la cote) : <> = la valeur mesurée ; vide = la valeur seule
        function dimTxt(s, v) { const t = s && typeof s.txt === 'string' ? s.txt.trim() : ''; return t ? (t.includes('<>') ? t.split('<>').join(v) : t) : v; }
        function t2DimRText(s, r) { return (s.dia ? 'Ø ' : 'R ') + calculateRealDistance(s.dia ? 2 * r : r); }
        // extrémité de cote selon la mise en forme (trait oblique, flèche pleine / ouverte, point, rien) ; d = direction vers le point P
        function dimTermAt(c, P, d, ls) { const st = dimStyle, z = st.termSz * ((typeof dimMmW !== 'undefined' && dimMmW) || DIM_PXMM / ls), nx = -d.y, ny = d.x; c.save(); c.setLineDash([]);
            if (st.term === 'tick') { const h = z / 2 / Math.SQRT2; c.beginPath(); c.moveTo(P.x - (d.x + nx) * h, P.y - (d.y + ny) * h); c.lineTo(P.x + (d.x + nx) * h, P.y + (d.y + ny) * h); c.stroke(); }
            else if (st.term === 'arrow' || st.term === 'arrowo') { const w = z * 0.22, q = { x: P.x - d.x * z, y: P.y - d.y * z }; c.beginPath(); c.moveTo(q.x + nx * w, q.y + ny * w); c.lineTo(P.x, P.y); c.lineTo(q.x - nx * w, q.y - ny * w); if (st.term === 'arrow') { c.closePath(); c.fill(); } else c.stroke(); }
            else if (st.term === 'dot') { c.beginPath(); c.arc(P.x, P.y, z * 0.2, 0, 2 * Math.PI); c.fill(); }
            c.restore(); }
        function drawDimR(c, s, col, dx, dy, ls) {
            const g = t2DimRGeom(s, dx, dy); if (!g) return;
            c.setLineDash([]); c.strokeStyle = col; c.fillStyle = col;
            c.beginPath(); c.moveTo(g.S.x, g.S.y); c.lineTo(g.E.x, g.E.y); c.stroke();
            const arrow = (P, d) => dimTermAt(c, P, d, ls);
            arrow(g.A, g.u); if (s.dia) arrow(g.S, { x: -g.u.x, y: -g.u.y });
            else { const t = 4 / ls; c.beginPath(); c.moveTo(g.C.x - t, g.C.y); c.lineTo(g.C.x + t, g.C.y); c.moveTo(g.C.x, g.C.y - t); c.lineTo(g.C.x, g.C.y + t); c.stroke(); }
            dimensionTextsToDraw.push({ text: dimTxt(s, t2DimRText(s, g.r)), worldX: g.L.x, worldY: g.L.y, color: col, layerId: s.layerId || DIM_LAYER_ID, angle: Math.atan2(g.u.y, g.u.x) });
        }
        function t2DimRMake(C, r, cur, dia) {
            let ux = cur.x - C.x, uy = cur.y - C.y, d = Math.hypot(ux, uy); if (d < 1e-9) { ux = 1; uy = 0; d = 1; } ux /= d; uy /= d;
            return { type: 'dimr', layerId: DIM_LAYER_ID, x: C.x, y: C.y, ax: C.x + ux * r, ay: C.y + uy * r, lx: C.x + ux * d, ly: C.y + uy * d, dia: !!dia };
        }
        function t2DimRClick(w) {
            if (!t2.dr) {
                const t = findShapeAt(w.x, w.y);
                if (!t || (t.type !== 'circle' && t.type !== 'arc')) { updateCommandMessageText((mode === 'dim-dia' ? 'COTE DE DIAMÈTRE' : 'COTE DE RAYON') + ' : cliquez un cercle ou un arc.'); return; }
                t2.dr = { s: t }; selectedShapes = [t]; draw(); return;
            }
            const s = t2.dr.s; shapes.push(t2DimRMake({ x: s.x, y: s.y }, s.r, w, mode === 'dim-dia')); t2.dr = null; selectedShapes = []; saveState(); draw();
            updateCommandMessageText((mode === 'dim-dia' ? 'COTE DE DIAMÈTRE' : 'COTE DE RAYON') + ' posée. Cliquez un autre cercle, ou Échap.');
        }
        function t2DimRDXF(s, line, text, Lu, annS, X, Y) {
            const g = t2DimRGeom(s); if (!g) return;
            line(s, g.S.x, g.S.y, g.E.x, g.E.y);
            const ah = mmToWorld(2 * annS), aw = ah * 0.35, arrow = (P, d) => { const b1 = { x: P.x - d.x * ah - d.y * aw, y: P.y - d.y * ah + d.x * aw }, b2 = { x: P.x - d.x * ah + d.y * aw, y: P.y - d.y * ah - d.x * aw }; line(s, P.x, P.y, b1.x, b1.y); line(s, P.x, P.y, b2.x, b2.y); line(s, b1.x, b1.y, b2.x, b2.y); };
            arrow(g.A, g.u); if (s.dia) arrow(g.S, { x: -g.u.x, y: -g.u.y });
            const h = Lu(layerTextH(s.layerId || DIM_LAYER_ID) || 2.5 * annS), str = dimTxt(s, t2DimRText(s, g.r));
            let a = dimTextAligned ? -Math.atan2(g.u.y, g.u.x) : 0; while (a > Math.PI / 2 + 1e-9) a -= Math.PI; while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
            const wT = h * str.length * 0.6, cx = X(g.L.x), cy = Y(g.L.y), ca = Math.cos(a), sa = Math.sin(a), ox = -wT / 2, oy = h * 0.5;
            text(s, cx + ox * ca - oy * sa, cy + ox * sa + oy * ca, h, str, a * 180 / Math.PI);
        }
        function t2DimRHit(s, p, tol) { const g = t2DimRGeom(s); return !!g && (t2SegDist(p, g.S, g.E) < tol || Math.hypot(p.x - g.L.x, p.y - g.L.y) < tol * 2); }

        // =====================================================================
        // MESURER : clics successifs -> longueur du segment, total, angle, surface (rien n'est dessiné)
        // =====================================================================
        function t2MsInfo(extra) {
            const P = t2.ms.concat(extra ? [extra] : []); if (!P.length) return null;
            let tot = 0; for (let i = 1; i < P.length; i++) tot += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
            const a = P[P.length - 2], b = P[P.length - 1], seg = a ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
            const ang = a ? ((Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI) + 360) % 360 : 0;
            const k = unitsPerSquare / GRID_SIZE, area = P.length >= 3 ? Math.abs(polyArea(P)) * k * k : 0;
            return { n: P.length, seg, tot, ang, dx: a ? (b.x - a.x) * k : 0, dy: a ? -(b.y - a.y) * k : 0, area, per: P.length >= 3 ? tot + Math.hypot(P[0].x - b.x, P[0].y - b.y) : 0 };
        }
        function t2MsText(I) {
            if (!I || I.n < 2) return '';
            return 'L = ' + calculateRealDistance(I.seg) + '  ·  ∠ ' + t2Fr(I.ang.toFixed(1)) + '°  ·  ΔX ' + fmtLen(I.dx) + '  ΔY ' + fmtLen(I.dy) + (I.n > 2 ? '  ·  Σ = ' + calculateRealDistance(I.tot) : '') + (I.area > 0 ? '  ·  Surface ' + fmtSurface(I.area) + ' (périmètre ' + calculateRealDistance(I.per) + ')' : '');
        }

