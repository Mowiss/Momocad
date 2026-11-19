        // ---- COUPE EN PERSPECTIVE : la vue 3D tronquée au trait de coupe (tout ce qui est devant est retiré), regardée dans le sens de la coupe.
        // Les volumes coupés montrent leur tranche pleine (faces intérieures colorées) ; derrière, la maison reste en vraie 3D : fenêtres en biais, toitures continues.
        function v3CutPlanes(cut) { cut = cut === undefined ? (V3 && V3.cut) : cut; if (!cut || !V3 || !V3.root || !window.THREE) return [];
            const ax = worldToMm(cut.A.x), ay = -worldToMm(cut.A.y), bx = worldToMm(cut.B.x), by = -worldToMm(cut.B.y), L = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / L, ty = (by - ay) / L, vx = ty * cut.side, vy = -tx * cut.side, rp = V3.root.position;
            const px = ax / 1000 + rp.x, py = ay / 1000 + rp.y, n = new THREE.Vector3(vx, vy, 0); return [new THREE.Plane(n, -(vx * px + vy * py) + 0.002)]; }
        function v3CutCaps() { if (!V3 || !V3.root || !window.THREE) return; const old = []; V3.root.traverse(o => { if (o.userData && o.userData.cap) old.push(o); }); old.forEach(o => { o.parent.remove(o); if (o.material) o.material.dispose(); if (o.userData.capGeo && o.geometry) o.geometry.dispose(); });
            V3.root.traverse(o => { if (o.userData && o.userData.mat0) { o.material = o.userData.mat0; delete o.userData.mat0; } });   // retour au rendu
            if (V3.scene && V3.bg0 !== undefined) { V3.scene.background = V3.bg0; delete V3.bg0; }
            if (!V3.cut) return; const add = [], lines = V3.cut.lines !== false; V3.root.traverse(o => { if (!o.isMesh || (o.userData && o.userData.cap)) return; const m = [].concat(o.material)[0]; if (!m || (m.transparent && m.opacity < 0.9)) return;
                const c = m.color ? m.color.clone().multiplyScalar(lines ? 0.45 : 0.62) : new THREE.Color(0x777777), open = m.side === THREE.DoubleSide, cap = open ? null : new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })); if (cap) { cap.userData.cap = 1; cap.renderOrder = 1; } add.push([o, cap, m]); });   // surface ouverte (terrain) : pas de tranche
            add.forEach(([o, cap]) => { if (cap) o.add(cap); });
            // STYLE PLAN : pas de rendu, des traits — chaque volume en aplat du fond, ses arêtes vives à la couleur de son matériau (éclaircie), les tranches coupées en poché
            if (lines) { if (V3.scene) { V3.bg0 = V3.scene.background; V3.scene.background = new THREE.Color(0x1e1e1e); } const fill = new THREE.MeshBasicMaterial({ color: 0x1e1e1e, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), fill2 = new THREE.MeshBasicMaterial({ color: 0x262a30, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                add.forEach(([o, cap, m]) => { o.userData.mat0 = o.material; o.material = cap ? fill : fill2; const hsl = {}, col = m.color ? m.color.clone() : new THREE.Color(0xd1d5db); col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s), Math.max(0.68, hsl.l));
                    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), new THREE.LineBasicMaterial({ color: col })); e.userData.cap = 1; e.userData.capGeo = 1; o.add(e); }); }
            // tranche du terrain le long du trait : terre sous le TN / le projet, jusqu'à 2 m sous le point le plus bas
            try { const c = V3.cut, tin = getTIN(); if (!tin) return; let FM = null; try { FM = finishedModel(); } catch (e) {} const N = 220, ex = V3.exag || 1, zm = V3.zmin || 0, pts = [];
                for (let i = 0; i <= N; i++) { const f = i / N, wx = c.A.x + (c.B.x - c.A.x) * f, wy = c.A.y + (c.B.y - c.A.y) * f; let z = tinZ(wx, wy, tin); if (FM) { const r = FM.at(wx, wy); if (r && hasZ(r.z)) z = r.z; } if (hasZ(z)) pts.push({ x: worldToMm(wx) / 1000, y: -worldToMm(wy) / 1000, z: (z / 1000 - zm) * ex }); else pts.push(null); }
                const ok = pts.filter(Boolean); if (ok.length < 2) return; const zb = Math.min(...ok.map(q => q.z)) - 2 * ex, P3 = [];
                for (let i = 0; i < N; i++) { const a = pts[i], b = pts[i + 1]; if (!a || !b) continue; P3.push(a.x, a.y, a.z, b.x, b.y, b.z, b.x, b.y, zb, a.x, a.y, a.z, b.x, b.y, zb, a.x, a.y, zb); }
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); const gm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x6b4a2b, side: THREE.DoubleSide })); gm.userData.cap = 1;
                const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(ok.flatMap(q => [q.x, q.y, q.z + 0.01]), 3)); const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x84cc16 })); ln.userData.cap = 1;
                V3.root.add(gm); V3.root.add(ln); } catch (e) { console.warn('tranche du terrain', e); } }
        function v3CutApply() { if (!V3) return; v3CutCaps(); V3.renderer.clippingPlanes = v3CutPlanes(); render3D(); refreshV3CutBtn(); }
        function refreshV3CutBtn() { const b = document.getElementById('v3-cutbtn'); if (b) b.classList.toggle('on', !!(V3 && V3.cut)); const s2 = document.getElementById('v3-cutsty'); if (s2) { s2.style.display = V3 && V3.cut ? '' : 'none'; s2.classList.toggle('on', !!(V3 && V3.cut && V3.cut.lines !== false)); } }
        // vue posée dans l'axe de la coupe : caméra du côté d'où l'on regarde, un peu au-dessus, sur le milieu du trait
        function v3CutView() { const c = V3 && V3.cut; if (!c || !V3.root) return; const ax = worldToMm(c.A.x) / 1000, ay = -worldToMm(c.A.y) / 1000, bx = worldToMm(c.B.x) / 1000, by = -worldToMm(c.B.y) / 1000, L = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / L, ty = (by - ay) / L, vx = ty * c.side, vy = -tx * c.side, rp = V3.root.position;
            let zt = 0; const b = new THREE.Box3().setFromObject(V3.root); if (isFinite(b.min.z)) zt = (b.min.z + b.max.z) / 2;
            V3.target.set((ax + bx) / 2 + rp.x, (ay + by) / 2 + rp.y, zt); V3.az = Math.atan2(-vx, -vy); V3.el = 0.14; V3.dist = Math.max(15, L * 0.85); render3D(); }
        function cutLineOf(sel) { const L = (sel || []).find(x => x.cutDef && x.type === 'line'); if (L) return L; const id = (sel || []).map(x => x.secOf || x.secMark).find(Boolean); return id ? shapes.find(x => x.cutDef && x.cutDef.id === id) : null; }
        async function sec3D(L) { L = L || cutLineOf(selectedShapes) || shapes.filter(x => x.cutDef && x.type === 'line').pop();
            if (!L) { updateCommandMessageText('COUPE 3D : tracez d\'abord un trait de coupe (outil Coupe), ou sélectionnez-en un.'); return; }
            const cut = { A: { x: L.x1, y: L.y1 }, B: { x: L.x2, y: L.y2 }, side: L.cutDef ? L.cutDef.side : 1, name: L.cutDef ? L.cutDef.name : '', lines: true };
            if (!is3DOpen()) await open3D(); for (let i = 0; i < 100 && !(V3 && V3.root); i++) await new Promise(r => setTimeout(r, 50)); if (!V3) return;
            V3.cut = cut; v3CutApply(); v3CutView(); updateCommandMessageText('COUPE ' + (cut.name ? cut.name + '-' + cut.name + ' ' : '') + 'EN PERSPECTIVE, style plan : la 3D tronquée au trait de coupe, en traits, vue dans son sens. Tourne et zoome librement ; bouton à côté de ✂ : traits / rendu ; ✂ pour la retirer. Une fenêtre 3D de mise en page la garde.'); }
        function v3CutStyle() { if (!V3 || !V3.cut) { updateCommandMessageText('COUPE 3D : ouvre d\'abord une coupe en perspective (bouton ✂).'); return; } V3.cut.lines = V3.cut.lines === false; v3CutApply(); updateCommandMessageText('COUPE EN PERSPECTIVE : ' + (V3.cut.lines ? 'style plan (traits, tranches en poché).' : 'rendu (matériaux, ombres).')); }
        function v3CutToggle() { if (!V3) return; if (V3.cut) { V3.cut = null; v3CutApply(); updateCommandMessageText('COUPE 3D retirée : la maquette entière.'); } else sec3D(); }
        // fluidité : pendant qu'on tourne ou zoome, un seul rendu par image d'écran ; si la scène est lourde (> 30 ms par image), résolution réduite le temps du geste
        function render3DSoon(moving) { if (!V3) return; if (moving) { const t = performance.now(), dt = t - (V3.mvT || 0); V3.mvT = t; if (dt < 250) V3.mvDt = V3.mvDt ? V3.mvDt * 0.7 + dt * 0.3 : dt; else V3.mvDt = 0; }   /* images qui traînent (carte graphique saturée) : résolution réduite pendant le mouvement */
            if (moving && (V3.rt > 30 || V3.mvDt > 40) && !V3.lowRes && !RD) { V3.lowRes = V3.renderer.getPixelRatio(); V3.renderer.setPixelRatio(Math.max(0.5, V3.lowRes * 0.5)); }
            if (moving) { clearTimeout(V3.resT); V3.resT = setTimeout(v3FullRes, 220); } if (!V3.raf) V3.raf = requestAnimationFrame(() => { V3.raf = 0; render3D(); }); }
        function v3FullRes() { if (!V3 || !V3.lowRes) return; V3.renderer.setPixelRatio(V3.lowRes); V3.lowRes = 0; render3D(); }
        function render3D() {
            if (!V3 || !is3DOpen()) return; const rt0 = performance.now();
            if (V3.cl) V3.cl.visible = d3Active();   /* traits de construction : visibles en 3D seulement pendant un outil de dessin 3D */
            if (V3.pin && !V3.fps) { if (V3.root && V3.pinRoot) { V3.pin.add(V3.root.position.clone().sub(V3.pinRoot)); V3.pinRoot.copy(V3.root.position); } V3.target.copy(V3.pin); v3PinMark(); }   /* ancrage : la vue tourne et zoome autour de lui */
            const { camera, target } = V3, ce = Math.cos(V3.el);
            if (V3.sky && (!!V3.panoWant !== (stOn() && stPano.on) || !!V3.stWant !== stOn())) v3Sky();   // photo 360° : seulement dans le studio photo
            stCamApply(camera);
            if (V3.fps) { const F = V3.fps, cp = Math.cos(F.pitch); camera.position.copy(F.pos); camera.near = 0.05; camera.far = Math.max(V3.R * 20 + 2000, realOn() && REAL ? REAL_OUT * 1.6 : 0); camera.updateProjectionMatrix(); camera.lookAt(F.pos.x + Math.sin(F.yaw) * cp, F.pos.y + Math.cos(F.yaw) * cp, F.pos.z + Math.sin(F.pitch)); }   // vue Momo : à hauteur d'yeux
            else { camera.position.set(target.x + V3.dist * ce * Math.sin(V3.az), target.y + V3.dist * ce * Math.cos(V3.az), target.z + V3.dist * Math.sin(V3.el));
            camera.near = V3.dist / 1000; camera.far = Math.max(V3.dist * 100 + V3.R * 10, realOn() && REAL ? REAL_OUT * 1.6 : 0); camera.updateProjectionMatrix();
            camera.lookAt(target); } v3EnvPlace(); V3.renderer.clippingPlanes = v3CutPlanes(); V3.renderer.render(V3.scene, camera); if (!V3.lowRes) V3.rt = performance.now() - rt0;
            // rosace X Y Z : même que dans le plan (a = 180° − azimut caméra, e = hauteur)
            const r3 = document.getElementById('v3-rose'); if (r3) { const a = 180 - V3.az * 180 / Math.PI, e = V3.el * 180 / Math.PI, key = a.toFixed(1) + '|' + e.toFixed(1); if (r3.dataset.k !== key) { r3.dataset.k = key; r3.innerHTML = roseSVG(a, e, '3d'); } }
            // étiquettes d'altitude
            const box = document.getElementById('v3-labels'), W = V3.renderer.domElement.clientWidth, H = V3.renderer.domElement.clientHeight;
            if (!document.getElementById('v3-lab').checked) { box.innerHTML = ''; return; }
            let html = '';
            V3.labels.forEach(l => { const v = l.v.clone().project(camera); if (v.z > 1 || v.z < -1) return; const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (x < -40 || y < -20 || x > W + 40 || y > H + 20) return; html += '<span style="position:absolute;left:' + (x + 5).toFixed(0) + 'px;top:' + (y - 14).toFixed(0) + 'px">' + l.t + '</span>'; });
            box.innerHTML = html;
        }
        // Vues prédéfinies, avec animation de retournement
        function animate3D(az, el, ms) {
            if (!V3) return;
            let a0 = V3.az, d = ((az - a0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;   // plus court chemin
            const e0 = V3.el, t0 = performance.now(), dur = ms || 650;
            V3.anim = (now) => {
                let k = Math.min(1, (now - t0) / dur); k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOut
                V3.az = a0 + d * k; V3.el = e0 + (el - e0) * k;
                render3D();
                if (k < 1 && V3.anim) requestAnimationFrame(V3.anim); else V3.anim = null;
            };
            requestAnimationFrame(V3.anim);
        }
        function view3D(name) {
            const D = Math.PI / 180, side = 0.0;
            if (name === 'N') animate3D(0, side); else if (name === 'E') animate3D(90 * D, side);
            else if (name === 'S') animate3D(180 * D, side); else if (name === 'O') animate3D(270 * D, side);
            else if (name === 'HAUT') animate3D(180 * D, Math.PI / 2 - 0.002);
            else { V3.target.set(0, 0, 0); V3.dist = V3.R * 2.6; animate3D(225 * D, 35 * D); }
        }
        function roseClick(a, e, where) {
            if (where === '3d') { if (!V3) return; const D = Math.PI / 180; if (a === -45 && e === 35) { V3.target.set(0, 0, 0); V3.dist = V3.R * 2.6; } animate3D((180 - a) * D, Math.max(-89.9, Math.min(89.9, e)) * D); }
            else if (layoutOn) {
                const v = lpVp(lpActiveId) || lpVp(lpSelId);
                if (!v || lpIsImg(v)) { updateCommandMessageText('MISE EN PAGE : sélectionnez une fenêtre (clic) pour choisir sa vue avec la rosace.'); return; }
                if (v.locked) { updateCommandMessageText('FENÊTRE verrouillée : déverrouillez-la pour changer de vue.'); return; }
                if (lpIsOrtho({ a, e }) && !lpIsOrtho(v)) { const zr = zRange(); v.cz = (zr.min + zr.max) / 2; }
                v.a = ((a % 360) + 360) % 360; v.e = e; v.ou = 0; v.ov = 0; if (v.id === lpActiveId) { if (lpIsOrtho(v) && mode !== 'select-box') setMode('select-box'); lpApplyCam(v); }
                updateCommandMessageText('FENÊTRE : vue ' + viewName(v.a, v.e) + (lpIsOrtho(v) ? ' (consultation ; Dessus pour y dessiner).' : '.')); draw();
            }
            else setView2D(a, e);
        }
        function spin3D(dir) { animate3D(V3.az + dir * Math.PI / 2, V3.el); }
        // Raccourcis de commande : lettres puis Entrée (comme AutoCAD)
        const CMD_ALIASES = {
            D: ['move', 'Déplacer'], R: ['rotate', 'Rotation'], C: ['trim', 'Couper (ajuster)'], P: ['extend', 'Prolonger'], DE: ['offset', 'Décaler'],
            DR: ['line', 'Droite'], QR: ['rect', 'Quadrilatère'], RO: ['circle', 'Rond (cercle)'], AR: ['arc', 'Arc'], PL: ['poly', 'Polygone'], PLI: ['pline', 'Polyligne'], PU: ['pen', 'Plume'], MI: ['mirror', 'Copie miroir'], FE: ['lpvp', 'Fenêtre de mise en page'], FR: ['lpvpc', 'Fenêtre ronde'], IM: ['lpimg', 'Image (mise en page)'], MP: ['layout', 'Mise en page'],
            HA: ['hatch', 'Hachure'], TX: ['text', 'Texte'], IF: ['detail', 'Infobulle (détail)'], PT: ['topo', 'Point topo'], LR: ['brk', 'Ligne de rupture'], BAT: ['bat', 'Bâtiment existant'], CAR: ['gridcal', 'Caler un fond sur 2 croix du carroyage'], VU: ['view3d', 'Vue 3D'], PE: ['slope', 'Étiquette de pente'], PR: ['profile', 'Profil en long'], CN: ['contours', 'Courbes de niveau'], CU: ['cubature', 'Cubatures'], ME: ['metre', 'Métré'], FC: ['bmplace', 'Fond de carte'], EC: ['explode', 'Éclater'], ET: ['stretch', 'Étirer'], BL: ['blocks', 'Catalogue de blocs'], RA: ['fillet', 'Arrondir'], PO: ['solid-beam', 'Poutre'], OU: ['opening', 'Ouverture dans un mur'], TOI: ['solid-roof', 'Toiture'], CP: ['copy', 'Copier'], RE: ['array', 'Réseau'], JO: ['join', 'Joindre'], CA: ['break', 'Couper au point'], CH: ['chamfer', 'Chanfrein'], LO: ['lengthen', 'Longueur'], ELL: ['ellipse', 'Ellipse'], PN: ['point', 'Point'], DV: ['divide', 'Diviser'], CR: ['dim-rad', 'Cote de rayon'], CD: ['dim-dia', 'Cote de diamètre'], MES: ['measure', 'Mesurer'], PEI: ['paint', 'Peindre (texture)'], PIN: ['brush', 'Peindre — trait au pinceau'], AP: ['addpt', 'Ajouter / retirer un point'], ETA: ['etages', 'Étages (niveaux du bâtiment)'], IB: ['blkimport', 'Importer un bloc'], PAR: ['paroi', 'Paroi (mur)'], DA: ['solid-dalle', 'Dalle'], ESC: ['stair2', 'Escalier d\'étage'], RCP: ['recoupe', 'Recouper'], POT: ['poteau', 'Poteau'], FON: ['fond', 'Fondations'], CO: ['cut', 'Trait de coupe'], TCO: ['cline2', 'Trait de construction'], TRA: ['trench', 'Tranchée'], EAU: ['water', 'Niveau d\'eau naturel'], BOI: ['bois', 'Zone boisée'], BAS: ['bassin', 'Bassin de rétention'], MAI: ['maille', 'Maillage géotechnique / pollution'],
        };
        let cmdBuffer = '';
        // tableau des commandes du guide, toujours à jour avec la liste ci-dessus
        (function fillCmdRows() { const tb = document.getElementById('hg-cmd-rows'); if (!tb) return;
            tb.innerHTML = Object.keys(CMD_ALIASES).sort((a, b) => a.localeCompare(b)).map(k => `<tr class="border-t border-gray-700"><td class="py-0.5 pr-3 font-mono text-amber-300 font-bold">${k.charAt(0) + k.slice(1).toLowerCase()} <span style="color:#9ca3af;font-weight:400">+ Espace</span></td><td class="py-0.5">${CMD_ALIASES[k][1]}</td></tr>`).join(''); })();
        // dernier outil lancé (bouton de palette ou commande tapée) : Espace en sélection le relance
        let lastTool = null;
        document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.pal .tool-btn'); if (b && b.id && b.id !== 'btn-select-box' && !b.disabled) lastTool = { btn: b.id }; }, true);
        function relaunchLastTool() {
            const L = lastTool; if (!L) return;
            if (L.btn) { const b = document.getElementById(L.btn); if (b) b.click(); }
            else if (L.cmd && CMD_ALIASES[L.cmd]) { cmdBuffer = L.cmd; runCmdAlias(); }
        }
        function runCmdAlias() {
            const a = CMD_ALIASES[cmdBuffer]; const typed = cmdBuffer; cmdBuffer = ''; if (a && a[0] !== 'select-box') lastTool = { cmd: typed };
            if (!a) { updateCommandMessageText('Commande inconnue : « ' + typed + ' ». Raccourcis : ' + Object.keys(CMD_ALIASES).join(', ') + ' (+ Espace) — voir le guide.'); draw(); return; }
            if (a[0] === 'view3d') { toggle3D(); return; }
            if (a[0] === 'contours') { openContoursDialog(); return; }
            if (a[0] === 'cubature') { openCubatureDialog(); return; }
            if (a[0] === 'metre') { openMetre(); return; }
            if (a[0] === 'brk') { setMode('pline'); brkDraw = true; updateCommandMessage(); return; }
            if (a[0] === 'bat') { batFromSel(); return; }
            if (a[0] === 'gridcal') { gcalStart(); return; }
            if (a[0] === 'trench') { startTrench(); return; }
            if (a[0] === 'water') { startWater(); return; }
            if (a[0] === 'bois') { startBois(); return; }
            if (a[0] === 'bassin') { startBassin(); return; }
            if (a[0] === 'maille') { startMaille(); return; }
            if (a[0].startsWith('solid-')) { startSolidTool(a[0].slice(6)); return; }
            if (a[0] === 'bmplace') { startBmPlace(); return; }
            if (a[0] === 'explode') { explodeOrUngroup(); return; }
            if (a[0] === 'blocks') { toggleBlockMenu(); return; }
            if (a[0] === 'extrude') { startExtrude(); return; }
            if (a[0] === 'sweep') { startSweep(); return; }
            if (a[0] === 'revolve') { startRevolve(); return; }
            if (a[0] === 'elevate') { openElevate(); return; }
            if (a[0] === 'stack') { startStack(); return; }
            if (a[0] === 'tilt') { startTilt(); return; }
            if (a[0].startsWith('bool-')) { startBool(a[0].slice(5)); return; }
            if (a[0] === 'opening') { startOpening(); return; }
            if (a[0] === 'paroi') { openParois(); return; }
            if (a[0] === 'poteau') { startPoteau(); return; }
            if (a[0] === 'stair2') { startStair2(); return; }
            if (a[0] === 'recoupe') { startRecoupe(); return; }
            if (a[0] === 'fond') { startFond(); return; }
            if (a[0] === 'mirror') { startMirror(); return; }
            if (a[0] === 'array') { startArray(); return; }
            if (a[0] === 'paint') { startPaint('paint'); return; }
            if (a[0] === 'brush') { startBrush(); return; }
            if (a[0] === 'etages') { etaClick(); return; }
            if (a[0] === 'blkimport') { startBlockImport(); return; }
            if (a[0] === 'join') { startJoin(); return; }
            if (a[0] === 'layout') { toggleLayout(); return; }
            if (a[0] === 'lpvp' || a[0] === 'lpvpc' || a[0] === 'lpimg') { if (!layoutOn) toggleLayout(true); setMode(a[0]); draw(); return; }
            setMode(a[0]); draw();
        }
