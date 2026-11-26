        // =====================================================================
        // GABARITS .gbt : calques et leurs styles, réglages ⛯ (décimales, grille, impression), cartouche + logo,
        // sens des cotes, accroches, talus par défaut et blocs importés dans le catalogue. Le dernier chargé revient au démarrage.
        // =====================================================================
        let gabaritName = '';
        function idbStore(mode2, val) {
            return new Promise((res) => { try {
                const rq = indexedDB.open('momocad', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
                rq.onsuccess = () => { const tx = rq.result.transaction('kv', mode2 === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv');
                    const r2 = mode2 === 'get' ? st.get('gabarit') : st.put(val, 'gabarit'); r2.onsuccess = () => res(r2.result); r2.onerror = () => res(null); };
                rq.onerror = () => res(null);
            } catch (e) { res(null); } });
        }
        function gabaritData() {
            return { app: 'MomoCAD', kind: 'gabarit', version: 1, name: gabaritName,
                layers: JSON.parse(JSON.stringify(layers)), activeLayerId,
                settings: Object.assign({}, printSettings, { orientation: printOrientation }), gridMm, dimText: dimTextAligned ? 'aligned' : 'horizontal', dimStyle: Object.assign({}, dimStyle),
                snapSettings, cartouche: cartoucheData, talus: { on: cubState.talus, kR: cubState.kR, kD: cubState.kD }, blocks: userBlocks, blkTabs: BLK_TABS.filter(t => t.user), fond: bmSettings, presentation: lpDefaults, mats: matCatalog, trTypes };
        }
        function updateGbtLabel() { const el = document.getElementById('gbt-label'); if (!el) return; el.classList.toggle('hidden', !gabaritName); el.textContent = gabaritName ? '▣ ' + gabaritName.replace(/\.gbt$/i, '') : ''; el.title = 'Gabarit chargé : ' + gabaritName + ' (cliquer pour en charger un autre)'; }
        // applique un gabarit ; plan vierge : ses calques remplacent ceux du plan, sinon fusion par nom (styles mis à jour, calques manquants ajoutés)
        function applyGabarit(g, name, silent) {
            if (!g || g.kind !== 'gabarit') { if (!silent) alert("Ce fichier n'est pas un gabarit MomoCAD (.gbt)."); return false; }
            if (Array.isArray(g.layers) && g.layers.length) { stripLayerNums(g.layers);
                if (!shapes.length) { layers = JSON.parse(JSON.stringify(g.layers)); activeLayerId = layers.some(l => l.id === g.activeLayerId) ? g.activeLayerId : layers[0].id; }
                else g.layers.forEach(gl => { const l = layers.find(x => x.name === gl.name); if (l) Object.assign(l, gl, { id: l.id, visible: l.visible }); else layers.push(Object.assign({}, gl, { id: layers.some(x => x.id === gl.id) ? generateId() : gl.id })); });
            }
            if (g.settings) { const st = g.settings; ['paper', 'output', 'unit', 'decimals', 'cartouche'].forEach(k => { if (st[k] !== undefined) printSettings[k] = st[k]; }); if (st.orientation) { printOrientation = st.orientation; printSettings.orientation = st.orientation; } applyUnitSettings(); }
            if (g.gridMm > 0) gridMm = g.gridMm;
            if (g.dimText) { dimTextAligned = g.dimText === 'aligned'; refreshDimTextButton(); }
            if (g.dimStyle) dimStyleSet(g.dimStyle);
            if (g.snapSettings) { snapSettings = Object.assign({}, SNAP_DEFAULTS, g.snapSettings); refreshSnapButtons(); }
            if (g.cartouche) { cartoucheData = Object.assign({ logo: null, planName: '', clientName: '', draftsmanName: '', indice: '' }, g.cartouche); getLogoImg(); }
            if (g.talus) { cubState.talus = g.talus.on !== false; cubState.kR = g.talus.kR || cubState.kR; cubState.kD = g.talus.kD || cubState.kD; }
            if (g.presentation && g.presentation.paper) { lpDefaults = Object.assign({}, lpDefaults, g.presentation); try { localStorage.setItem('momocad-lp', JSON.stringify(lpDefaults)); } catch (e) {} if (!layoutData.vps.length) Object.assign(layoutData, { paper: lpDefaults.paper, orient: lpDefaults.orient, cartouche: lpDefaults.cartouche, margin: lpDefaults.margin }); }
            if (g.fond && g.fond.ov) { bmSettings = { base: BM_BASES[g.fond.base] ? g.fond.base : 'sat', ov: Object.assign({}, g.fond.ov), tn: Object.assign({ on: false, pas: 5 }, g.fond.tn), crs: g.fond.crs || bmSettings.crs || 'auto' }; bmSaveSettings(); bmRefreshLeaflet(); }
            if (Array.isArray(g.mats) && g.mats.length) { matCatalog = matCatalogFix(JSON.parse(JSON.stringify(g.mats))); matSave(); }
            if (Array.isArray(g.trTypes) && g.trTypes.length) { trTypes = JSON.parse(JSON.stringify(g.trTypes)); trTypesSave(); }
            if (Array.isArray(g.blkTabs)) { g.blkTabs.forEach(t => { if (t && t.id && !BLK_TABS.some(x => x.id === t.id)) BLK_TABS.splice(BLK_TABS.length - 1, 0, t); }); blkSaveTabs(); }
            if (Array.isArray(g.blocks)) { userBlocks = g.blocks; Object.keys(blkThumbCache).forEach(k => { if (k[0] === 'u') delete blkThumbCache[k]; }); }
            gabaritName = name || g.name || 'gabarit.gbt';
            try { localStorage.setItem('momocad-print', JSON.stringify(printSettings)); localStorage.setItem('momocad-grid-mm', String(gridMm)); localStorage.setItem('momocad-snap', JSON.stringify(snapSettings)); localStorage.setItem('momocad-blocks', JSON.stringify(userBlocks)); } catch (e) {}
            try { saveCartoucheData(); } catch (e) {}
            idbStore('put', { name: gabaritName, data: g });
            updateGbtLabel(); updateLayerUI(); refreshGridField(); invalidateCache(); draw();
            if (!silent) updateCommandMessageText('GABARIT : ' + gabaritName + ' chargé (calques, styles, réglages, cartouche, fond de plan' + (Array.isArray(g.mats) && g.mats.length ? ', catalogue de ' + (g.mats.length - 2) + ' produits' : '') + (Array.isArray(g.blocks) && g.blocks.length ? ', ' + g.blocks.length + ' bloc(s)' : '') + '). Il sera rechargé au prochain démarrage.');
            return true;
        }
        async function loadGabaritFile(input) {
            const f = input.files && input.files[0]; input.value = ''; if (!f) return;
            let g; try { g = JSON.parse(await f.text()); } catch (e) { alert('Gabarit illisible : ' + e.message); return; }
            if (applyGabarit(g, f.name)) saveState();
        }
        async function saveGabarit() {
            const sugg = (gabaritName || 'Gabarit').replace(/\.gbt$/i, '') + '.gbt';
            const g = gabaritData(), txt = JSON.stringify(g);
            if (window.showSaveFilePicker) {
                try { const h = await window.showSaveFilePicker({ suggestedName: sugg, types: [{ description: 'Gabarit MomoCAD (.gbt)', accept: { 'application/json': ['.gbt'] } }] });
                    const w = await h.createWritable(); await w.write(txt); await w.close(); gabaritName = h.name; }
                catch (e) { if (e && e.name === 'AbortError') return; downloadText(sugg, txt, 'application/json'); gabaritName = sugg; }
            } else { let n = prompt('Nom du gabarit :', sugg); if (!n) return; if (!/\.gbt$/i.test(n)) n += '.gbt'; downloadText(n, txt, 'application/json'); gabaritName = n; }
            g.name = gabaritName; idbStore('put', { name: gabaritName, data: g }); updateGbtLabel();
            updateCommandMessageText('GABARIT : ' + gabaritName + ' enregistré (calques, styles, réglages ⛯, cartouche et logo, accroches, talus, catalogue produits, ' + userBlocks.length + ' bloc(s) du catalogue).');
        }
        async function restoreLastGabarit() {
            const r = await idbStore('get'); if (!r || !r.data) return;
            const wasEmpty = !shapes.length && historyStep <= 0 && !fileName;
            // un plan est déjà ouvert (double-clic sur un .mmc, ouverture rapide) : il garde SES calques, couleurs et réglages ;
            // du gabarit, on ne reprend que ce qui n'appartient pas au plan (blocs, catalogue de prix, fond de plan)
            const g = wasEmpty ? r.data : { kind: 'gabarit', name: r.data.name, blocks: r.data.blocks, blkTabs: r.data.blkTabs, mats: r.data.mats, trTypes: r.data.trTypes, fond: r.data.fond };
            applyGabarit(g, r.name, true);
            if (wasEmpty) { shapesHistory = []; historyStep = -1; saveState(); markSaved(); }
            updateCommandMessageText('Gabarit ' + r.name + ' chargé.');
        }

        // =====================================================================
        // VUES ORTHOGONALES EN 2D (rosace X Y Z) : dessus = plan éditable ; face, côtés, arrière, iso = consultation.
        // Projection orthographique : u = X cos a + Y sin a ; v = (−X sin a + Y cos a) sin e + Z cos e (X est, Y nord, Z altitude, en mm)
        // ---- même transformation affine que le plan (camera.x / camera.y / zoom) : zoom et panoramique marchent tels quels
        // =====================================================================
        const D2R = Math.PI / 180;
        let view2d = { a: 0, e: 90 }, view2dAnim = null, view2dPivot = null;
        const isOrthoView = () => !!view2dAnim || Math.abs(view2d.e - 90) > 1e-6 || Math.abs(((view2d.a % 360) + 360) % 360) > 1e-6;
        const projUV = (X, Y, Z, a, e) => { const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R), se = Math.sin(e * D2R), ce = Math.cos(e * D2R); return { u: X * ca + Y * sa, v: (-X * sa + Y * ca) * se + Z * ce }; };
        function zRange() { const zs = []; shapes.forEach(s => shapeVertices(s).forEach(v => { const z = v.get(); if (hasZ(z)) zs.push(z); })); return zs.length ? { min: arrMin(zs), max: arrMax(zs) } : { min: 0, max: 0 }; }
        function viewName(a, e) { a = ((Math.round(a) % 360) + 360) % 360; if (e <= -89.9) return 'Dessous'; if (e >= 89.9) return a === 0 ? 'Dessus' : 'Dessus ' + a + '°'; if (Math.abs(e) < 0.1) return { 0: 'Face (sud)', 90: 'Droite (est)', 180: 'Arrière (nord)', 270: 'Gauche (ouest)' }[a] || 'Élévation ' + a + '°'; return 'Iso'; }
        function setView2D(a, e) {
            if (typeof is3DOpen === 'function' && is3DOpen()) close3D();
            const from = { a: view2d.a, e: view2d.e };
            while (a - from.a > 180) a -= 360; while (a - from.a < -180) a += 360;   // chemin le plus court
            if (Math.abs(a - from.a) < 1e-6 && Math.abs(e - from.e) < 1e-6) return;
            if (!isOrthoView()) {   // départ du plan : pivot = centre de l'écran, à mi-hauteur des altitudes
                const c = screenToWorld(canvas.width / 2, canvas.height / 2), zr = zRange();
                view2dPivot = { X: worldToMm(c.x), Y: -worldToMm(c.y), Z: (zr.min + zr.max) / 2 };
                if (mode !== 'select-box') setMode('select-box');
            } else if (!view2dPivot) view2dPivot = { X: 0, Y: 0, Z: 0 };
            else {   // pivot = point au centre de l'écran dans la vue courante (garde le cadrage après un panoramique)
                const P = view2dPivot, cur = projUV(P.X, P.Y, P.Z, from.a, from.e), su = mmToWorld(1) * camera.zoom;
                const du = (canvas.width / 2 - (camera.x + cur.u * su)) / su, dv = -(canvas.height / 2 - (camera.y - cur.v * su)) / su;
                const ca = Math.cos(from.a * D2R), sa = Math.sin(from.a * D2R), se = Math.sin(from.e * D2R), ce = Math.cos(from.e * D2R);
                P.X += du * ca - dv * sa * se; P.Y += du * sa + dv * ca * se; P.Z += dv * ce;
            }
            const t0 = performance.now(), T = 520;
            view2dAnim = { from, to: { a, e } };
            const step = (now) => {
                const k = Math.min(1, (now - t0) / T), q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                view2d = { a: from.a + (a - from.a) * q, e: from.e + (e - from.e) * q };
                if (k >= 1) { view2d = { a: ((a % 360) + 360) % 360, e }; view2dAnim = null; }
                orthoCenterCamera(); draw();
                if (view2dAnim) requestAnimationFrame(step);
                else { updateRose(); updateCommandMessageText(isOrthoView() ? 'VUE ' + viewName(view2d.a, view2d.e).toUpperCase() + ' : consultation (molette = zoom, clic molette = déplacer). Cliquez Z ou « Dessus » dans la rosace pour redessiner.' : 'Vue de dessus : plan.'); }
            };
            requestAnimationFrame(step);
        }
        function orbitView(d) { setView2D(view2d.a + d, view2d.e); }
        function orthoCenterCamera() { const P = view2dPivot; if (!P) return; const p = projUV(P.X, P.Y, P.Z, view2d.a, view2d.e), su = mmToWorld(1) * camera.zoom; camera.x = canvas.width / 2 - p.u * su; camera.y = canvas.height / 2 + p.v * su; }
        // rendu fil de fer de tout le dessin dans la vue orthogonale courante
        let orthoRend = null, orthoKey = '', orthoLoading = false;
        function ortho3D(c, a, e, su) {
            try {
                if (lpInkFlag || is3DOpen() || !shapes.some(is3DObj)) return false;   // fenêtre 3D ouverte : la scène lui appartient (textures)   // planche de présentation : traits seuls ; sans volume : rien à rendre
                if (!window.THREE) { if (!orthoLoading) { orthoLoading = true; loadThree().then(() => { orthoLoading = false; draw(); }, () => { orthoLoading = false; }); } return false; }
                if (!V3) init3D();
                const key = historyStep + '|' + shapes.length + '|' + layers.map(l => l.visible === false ? 0 : 1).join('');
                const ex = document.getElementById('v3-exag'), ex0 = ex.value;
                if (key !== orthoKey || V3.exag !== 1 || !V3.flat) { ex.value = '1'; v3Flat = true; try { build3DScene(); } finally { ex.value = ex0; v3Flat = false; } orthoKey = key; }
                const W = c.canvas.width, Hh = c.canvas.height;
                if (!orthoRend) { orthoRend = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); orthoRend.setClearColor(0x000000, 0); }
                if (orthoRend.domElement.width !== W || orthoRend.domElement.height !== Hh) orthoRend.setSize(W, Hh, false);
                const r = Math.PI / 180, ca = Math.cos(a * r), sa = Math.sin(a * r), se = Math.sin(e * r), ce = Math.cos(e * r);
                const U = new THREE.Vector3(ca, sa, 0), V = new THREE.Vector3(-sa * se, ca * se, ce), Dv = new THREE.Vector3().crossVectors(U, V);
                const k = su * 1000;   // pixels par mètre
                const cam = new THREE.OrthographicCamera(-camera.x / k, (W - camera.x) / k, camera.y / k, (camera.y - Hh) / k, -1e6, 1e6);
                cam.up.copy(V); cam.position.copy(Dv); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
                const keepP = V3.root.position.clone(); V3.root.position.set(0, 0, V3.zmin || 0);   // repère réel : x est, y nord, z altitude (m)
                const keepBg = V3.scene.background, env = [V3.sky, V3.hz, V3.gnd, V3.pano, V3.panoC].filter(Boolean), keepV = env.map(o => o.visible); V3.scene.background = null; env.forEach(o => { o.visible = false; });
                orthoRend.render(V3.scene, cam); V3.root.position.copy(keepP); V3.scene.background = keepBg; env.forEach((o, i) => { o.visible = keepV[i]; });
                c.drawImage(orthoRend.domElement, 0, 0, W, Hh); return true;
            } catch (err) { console.error(err); return false; }
        }
        function drawOrthoView(c) {
            const { a, e } = view2d, su = mmToWorld(1) * camera.zoom, zr = zRange(), z0 = zr.min;
            const S = (X, Y, Z) => { const p = projUV(X, Y, hasZ(Z) ? Z : z0, a, e); return [camera.x + p.u * su, camera.y - p.v * su]; };
            const W = (wx, wy, z) => S(worldToMm(wx), -worldToMm(wy), z);
            c.save(); c.setLineDash([]); c.lineCap = 'round'; c.lineJoin = 'round';
            const line = (pts, closed) => { if (pts.length < 2) return; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (closed) c.closePath(); c.stroke(); };
            const ring = (x, y, r, z, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return W(x + r * Math.cos(t), y + r * Math.sin(t), z); });
            // vue de façade / de côté : les volumes (murs percés, menuiseries, toitures, dalles…) sont rendus par le moteur 3D en projection orthogonale
            const R3 = ortho3D(c, a, e, su);
            // terrain (MNT) en léger
            const tin = R3 ? null : getTIN();
            if (tin) { c.strokeStyle = 'rgba(132,204,22,0.22)'; c.lineWidth = 1; c.beginPath(); tin.tris.forEach(([i, j, k]) => { [[i, j], [j, k], [k, i]].forEach(([p, q]) => { const A = tin.nodes[p], B = tin.nodes[q], pa = W(A.x, A.y, A.z), pb = W(B.x, B.y, B.z); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); }); }); c.stroke(); }
            for (const s of shapes) {
                if (R3 && !selectedShapes.includes(s)) continue;   // déjà dans le rendu 3D : on ne redessine que la sélection
                const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) continue;
                if (isBg(s) || ['text', 'dim', 'dim-angle', 'dimr', 'detail', 'slope'].includes(s.type)) continue;
                c.strokeStyle = selectedShapes.includes(s) ? '#ec4899' : effectiveColor(s, lpInkFlag); c.lineWidth = 1.2;
                if (s.type === 'line') line([W(s.x1, s.y1, s.z1), W(s.x2, s.y2, s.z2)]);
                else if (s.type === 'point') { const p = W(s.x, s.y, s.z); c.beginPath(); c.moveTo(p[0] - 4, p[1]); c.lineTo(p[0] + 4, p[1]); c.moveTo(p[0], p[1] - 4); c.lineTo(p[0], p[1] + 4); c.stroke(); }
                else if (s.type === 'mesh' && meshStore[s.meshId]) {
                    const v = meshStore[s.meshId], n = v.length / 9, st = Math.max(1, Math.ceil(n / 20000)), k2 = s.sc || 1; c.globalAlpha = 0.45; c.beginPath();
                    for (let t = 0; t < n; t += st) { const o = t * 9; for (let j = 0; j < 3; j++) { const q = meshWorld(s, v[o + j * 3], v[o + j * 3 + 1]), P = W(q.x, q.y, s.z0 + v[o + j * 3 + 2] * k2); j ? c.lineTo(P[0], P[1]) : c.moveTo(P[0], P[1]); } c.closePath(); }
                    c.stroke(); c.globalAlpha = 1;
                }
                else if (s.solid) {
                    const k = s.solid.kind, zb = solidBaseZ(s), H = s.solid.H || 0;
                    if (k === 'sphere') { const p = W(s.x, s.y, zb + worldToMm(s.r)); c.beginPath(); c.arc(p[0], p[1], s.r * camera.zoom, 0, 2 * Math.PI); c.stroke(); continue; }
                    const base = s.type === 'circle' ? pierceRing(s) : s.points, loops = [base].concat(holesOf(s));
                    loops.forEach(lp => { line(lp.map(q => W(q.x, q.y, zb)), true); if (k !== 'cone') line(lp.map(q => W(q.x, q.y, zb + H)), true);
                        const stp = Math.max(1, Math.floor(lp.length / 8)); for (let i = 0; i < lp.length; i += stp) { const q = lp[i]; line([W(q.x, q.y, zb), k === 'cone' ? W(s.x, s.y, zb + H) : W(q.x, q.y, zb + H)]); } });
                }
                else if (s.type === 'poly') line(s.points.map(q => W(q.x, q.y, q.z)), !s.open);
                else if (s.type === 'circle') line(ring(s.x, s.y, s.r, s.z, 0, 2 * Math.PI, 64));
                else if (s.type === 'arc') { let a1 = s.endAngle; if (s.anticlockwise) { while (a1 > s.startAngle) a1 -= 2 * Math.PI; } else while (a1 < s.startAngle) a1 += 2 * Math.PI; line(ring(s.x, s.y, s.r, s.z, s.startAngle, a1, 48)); }
            }
            // repère au pivot
            c.restore();
            c.save(); c.font = 'bold 12px Arial'; c.fillStyle = 'rgba(147,197,253,0.9)'; c.fillText('VUE ' + viewName(a, e).toUpperCase() + (isOrthoView() && !view2dAnim ? ' — consultation' : ''), 12, 20); c.restore();
        }
        // rosace : trièdre X (rouge) Y (vert) Z (bleu) et leurs opposés, orienté comme la vue ; la vue en cours est en surbrillance
        const ROSE_AXES = [['X', 1, 0, 0, '#f87171', 90, 0], ['Y', 0, 1, 0, '#4ade80', 0, 0], ['Z', 0, 0, 1, '#60a5fa', 0, 90], ['-X', -1, 0, 0, '#f87171', 270, 0], ['-Y', 0, -1, 0, '#4ade80', 180, 0], ['-Z', 0, 0, -1, '#60a5fa', 0, -90]];
        function roseSVG(a, e, where) {
            const L = 30, na = ((a % 360) + 360) % 360, same = (ta, te) => Math.abs(te - e) < 1.5 && (Math.abs(Math.abs(te) - 90) < 0.5 || Math.min(Math.abs(((ta - na) % 360 + 360) % 360), 360 - Math.abs(((ta - na) % 360 + 360) % 360)) < 1.5);
            const pr = ROSE_AXES.map(([n, X, Y, Z, col, ta, te]) => { const p = projUV(X, Y, Z, a, e), d = (-X * Math.sin(a * D2R) + Y * Math.cos(a * D2R)) * Math.cos(e * D2R) - Z * Math.sin(e * D2R); return { n, col, x: p.u * L, y: -p.v * L, d, ta, te }; }).sort((p, q) => q.d - p.d);
            const isoOn = same(315, 35) && Math.abs(e - 35) < 1.5;
            return '<circle cx="0" cy="0" r="2.5" fill="#9ca3af"/>' + pr.map(p => {
                const neg = p.n[0] === '-', r = neg ? 7.5 : 9.5, on = same(p.ta, p.te) && !isoOn;
                const t = p.n === 'Z' ? 'Vue de dessus (plan)' : p.n === '-Z' ? 'Vue de dessous' : 'Vue ' + viewName(p.ta, p.te);
                return `<g style="cursor:pointer;" onclick="roseClick(${p.ta},${p.te},'${where}')"><title>${t}</title>`
                    + `<line x1="0" y1="0" x2="${p.x}" y2="${p.y}" stroke="${p.col}" stroke-width="${neg ? 1.4 : 2.4}" opacity="${neg ? 0.75 : 1}"/>`
                    + (on ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 4}" fill="none" stroke="#fde047" stroke-width="2.2"/>` : '')
                    + `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${neg ? '#0f172a' : p.col}" stroke="${p.col}" stroke-width="1.6"/>`
                    + `<text x="${p.x}" y="${p.y + (neg ? 3 : 3.6)}" text-anchor="middle" font-size="${neg ? 8 : 10.5}" font-weight="700" fill="${neg ? p.col : '#0b1220'}" font-family="Arial">${neg ? p.n.toLowerCase() : p.n}</text></g>`;
            }).join('')
            + `<g style="cursor:pointer;" onclick="roseClick(-45,35,'${where}')"><title>Vue isométrique</title><circle cx="38" cy="38" r="12" fill="#0f172a" stroke="${isoOn ? '#fde047' : '#e5e7eb'}" stroke-width="${isoOn ? 2.4 : 1.6}"/><text x="38" y="41.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#e5e7eb" font-family="Arial">ISO</text></g>`
            + (where === '3d'
                ? `<g class="rose-eye" style="cursor:pointer;" onclick="toggle3D()"><title>Vue 3D active — revenir au plan 2D (Échap)</title><circle cx="-38" cy="-38" r="12" fill="#1a2e05" stroke="#bef264" stroke-width="2.2"/><path d="M-48 -38 Q-38 -48.5 -28 -38 Q-38 -27.5 -48 -38 Z" fill="#f7fee7" stroke="#bef264" stroke-width="1.4" stroke-linejoin="round"/><circle cx="-38" cy="-38" r="5.6" fill="#365314" stroke="#bef264" stroke-width="1"/><text x="-38" y="-35.6" text-anchor="middle" font-size="6.2" font-weight="800" fill="#ecfccb" font-family="Arial">3D</text></g>`
                : `<g class="rose-eye" style="cursor:pointer;" onclick="toggle3D()"><title>Vue 3D (VU + Espace) : ouvrir l'œil pour tourner autour du projet</title><circle cx="-38" cy="-38" r="12" fill="#0f172a" stroke="#e5e7eb" stroke-width="1.6"/><g fill="none" stroke="#e5e7eb" stroke-width="1.6" stroke-linecap="round"><path d="M-47 -40 Q-38 -32 -29 -40"/><path d="M-43.5 -36.2 l-1.6 2.6 M-38 -35 v3 M-32.5 -36.2 l1.6 2.6"/></g></g>`)
            + roseSpinSVG(a, e, where)
            + `<g style="cursor:pointer;" onclick="roseFit('${where}')"><title>Tout voir : recentre la vue sur tout le dessin et la recale en vue de base (dessus)</title><circle cx="38" cy="-38" r="12" fill="#0f172a" stroke="#e5e7eb" stroke-width="1.6"/><g fill="none" stroke="#e5e7eb" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="35,-45.5 38,-42.5 41,-45.5"/><polyline points="35,-30.5 38,-33.5 41,-30.5"/><polyline points="30.5,-41 33.5,-38 30.5,-35"/><polyline points="45.5,-41 42.5,-38 45.5,-35"/></g></g>`;
        }
        function roseFit(where) {
            if (where === '3d') { if (typeof V3 === 'undefined' || !V3) return; V3.target.set(0, 0, 0); V3.dist = V3.R * 2.6; animate3D(Math.PI * 1.25, 0.6); return; }   // recentrée et recalée : Z vertical, vue de base
            if (layoutOn) { zoomExtents(); return; }
            if (typeof isOrthoView === 'function' && isOrthoView()) { setView2D(0, 90); setTimeout(() => { zoomExtents(); }, 750); return; }   // retour à la vue de dessus, puis tout voir
            zoomExtents();
        }
        // flèches de rotation autour de Z (en bas à gauche de la rosace) : vue de côté → côté suivant ; vue iso → iso suivante, en tournant autour du projet
        function roseSpinSVG(a, e, where) {
            if (where === 'lp') return '';
            // chevrons doubles « et » de part et d'autre de la rosace : un quart de tour autour du projet (axe Z)
            const chev = (x, dir) => { const w = 4.6, tip = (x0) => `<polyline points="${x0 - dir * w},-7 ${x0},0 ${x0 - dir * w},7"/>`;
                return `<g style="cursor:pointer;" onclick="roseSpin(${dir},'${where}')"><title>Tourner d'un quart de tour vers la ${dir < 0 ? 'gauche' : 'droite'} (autour de Z)</title><rect x="${x - 9}" y="-12" width="18" height="24" fill="transparent"/>`
                    + `<g fill="none" stroke="#9ca3af" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${tip(x + dir * 2.6)}${tip(x - dir * 3.4)}</g></g>`; };
            /* drapeau : au repos gris ; 1er clic = on le prend (la pastille se vide, le curseur devient le drapeau) ; planté = pastille verte comme les autres boutons actifs (repérable sans les couleurs : remplie et cerclée épais) */
            const pinOn = typeof V3 !== 'undefined' && V3 && V3.pin, pinPick = typeof V3 !== 'undefined' && V3 && V3.pinPick, pc = pinOn ? '#bef264' : '#9ca3af';
            const flag = where === '3d' ? `<g style="cursor:pointer;" onclick="v3PinToggle()"><title>${pinOn ? 'Drapeau planté : la vue tourne et zoome autour de lui. Clic : le retirer' : pinPick ? 'Drapeau en main : cliquez un point de la maquette pour le planter (Échap ou clic ici : annuler)' : 'Prendre le drapeau : la vue tournera et zoomera toujours autour du point où vous le plantez'}</title>`
                + (pinPick ? `<circle cx="-38" cy="38" r="12" fill="none" stroke="#e5e7eb" stroke-width="1.6" stroke-dasharray="3 2.4"/>`
                    : `<circle cx="-38" cy="38" r="12" fill="${pinOn ? '#1a2e05' : '#0f172a'}" stroke="${pc}" stroke-width="${pinOn ? 2.2 : 1.6}"/>`
                    + `<path d="M-41.5 46V30" stroke="${pinOn ? '#f7fee7' : pc}" stroke-width="1.6" stroke-linecap="round"/><path d="M-41 30.5L-32 33.6L-41 37Z" fill="${pinOn ? '#bef264' : pc}"/><ellipse cx="-41.5" cy="46.2" rx="4" ry="1.4" fill="none" stroke="${pc}" stroke-width="1"/>`) + `</g>` : '';
            /* présentation (en bas à gauche de la rosace du plan, comme l'œil de la 3D) : allumée = pastille verte remplie et cerclée épais */
            const lpOn = typeof layoutOn !== 'undefined' && layoutOn;
            const grid = where === '2d' ? `<g class="rose-pres" style="cursor:pointer;" onclick="toggleLayout()"><title>${lpOn ? 'Présentation ouverte — revenir au plan' : 'Présentation (MP + Espace) : feuilles, fenêtres à l\'échelle, cartouche, PDF'}</title><circle cx="-38" cy="38" r="12" fill="${lpOn ? '#1a2e05' : '#0f172a'}" stroke="${lpOn ? '#bef264' : '#e5e7eb'}" stroke-width="${lpOn ? 2.2 : 1.6}"/>`
                + `<g fill="none" stroke="${lpOn ? '#ecfccb' : '#e5e7eb'}" stroke-width="1.3" stroke-linejoin="round"><rect x="-45.5" y="32" width="15" height="12" rx="0.8"/><rect x="-43.5" y="34.2" width="6.5" height="4.6"/><rect x="-35.6" y="34.2" width="3.2" height="4.6"/><path d="M-43.5 41.4h11"/></g></g>` : '';
            // chevrons verticaux : monter / descendre le point de vue (dessus ↔ iso ↔ côté)
            const vch = (y, dir) => { const w = 4.6, tip = (y0) => `<polyline points="-7,${y0 - dir * w} 0,${y0} 7,${y0 - dir * w}"/>`;
                return `<g style="cursor:pointer;" onclick="roseTilt(${dir},'${where}')"><title>${dir < 0 ? 'Monter le point de vue (vers la vue de dessus)' : 'Descendre le point de vue (vers la vue de côté)'}</title><rect x="-12" y="${y - 9}" width="24" height="18" fill="transparent"/>`
                    + `<g fill="none" stroke="#9ca3af" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${tip(y + dir * 2.6)}${tip(y - dir * 3.4)}</g></g>`; };
            return chev(-50, -1) + chev(50, 1) + vch(-49.5, -1) + vch(49.5, 1) + grid + flag;
        }
        function roseTilt(dir, where) {   // dir -1 : monter (vers le dessus), +1 : descendre (vers le côté)
            if (where === '3d') { if (!V3) return; const steps = [0.05, 0.6, Math.PI / 2 - 0.002], cur = V3.el; let nx;
                if (dir < 0) nx = steps.find(v => v > cur + 0.02); else nx = [...steps].reverse().find(v => v < cur - 0.02);
                animate3D(V3.az, nx === undefined ? cur : nx); return; }
            const steps = [0, 35, 90], e = view2d.e; let nx;
            if (dir < 0) nx = steps.find(v => v > e + 0.5); else nx = [...steps].reverse().find(v => v < e - 0.5);
            if (nx !== undefined) setView2D(view2d.a, nx);
        }
        function roseSpin(dir, where) {
            if (where === '3d') { if (V3) spin3D(dir); return; }
            const a = view2d.a, e = view2d.e; setView2D(a + 90 * dir, e);
        }
        function updateRose() { const svg = document.getElementById('rose-svg'); if (!svg) return; const k = view2d.a.toFixed(1) + '|' + view2d.e.toFixed(1); if (svg.dataset.k !== k + layoutOn) { svg.dataset.k = k + layoutOn; svg.innerHTML = roseSVG(view2d.a, view2d.e, '2d'); } }


