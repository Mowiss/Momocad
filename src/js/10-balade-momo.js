        // ---- VUE MOMO (première personne) : on attrape Momo (clic maintenu + glisser), on le pose sur le plan ou dans la vue 3D ;
        //      la vue 3D passe à hauteur d'yeux, au point posé. Z Q S D (ou flèches) = marcher, souris = regarder, Maj = courir, Échap = sortir.
        //      Momo marche sur ce qui est sous ses pieds (terrain, plateformes, dalles), monte les petites marches, s'arrête contre les murs.
        const FPS_EYE = 1.65, FPS_STEP = 0.45;
        // collisions de Momo : les triangles de la scène rangés une fois dans une grille de 1 m (le sol et les murs se testent sur quelques triangles, pas sur toute la scène) ;
        //      les vantaux de portes, qui bougent, sont testés à part
        function fpsGrid() { const F = V3.fps; if (F.grid && F.grid.root === V3.root) return F.grid; V3.root.updateMatrixWorld(true);
            const T = [], cells = new Map(), C = 1, v = new THREE.Vector3(), key = (i, j) => i * 100003 + j;
            V3.root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.visible || o.userData.cap || o.userData.brushOv || o.userData.leaf || (o.material && (o.material.colorWrite === false || (o.material.transparent && o.material.opacity < 0.2))) || !o.geometry || !o.geometry.attributes.position) return;
                const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count, W = []; for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(o.matrixWorld); W.push(v.x, v.y, v.z); }
                for (let t = 0; t + 2 < n; t += 3) { const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2, id = T.length / 9;
                    T.push(W[a * 3], W[a * 3 + 1], W[a * 3 + 2], W[b * 3], W[b * 3 + 1], W[b * 3 + 2], W[c * 3], W[c * 3 + 1], W[c * 3 + 2]);
                    const x0 = Math.floor(Math.min(W[a * 3], W[b * 3], W[c * 3]) / C), x1 = Math.floor(Math.max(W[a * 3], W[b * 3], W[c * 3]) / C), y0 = Math.floor(Math.min(W[a * 3 + 1], W[b * 3 + 1], W[c * 3 + 1]) / C), y1 = Math.floor(Math.max(W[a * 3 + 1], W[b * 3 + 1], W[c * 3 + 1]) / C);
                    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) continue; for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) { const k = key(ix, iy); let L = cells.get(k); if (!L) cells.set(k, L = []); L.push(id); } } });
            F.grid = { root: V3.root, T: new Float32Array(T), cells, C, key }; return F.grid; }
        // rayon / triangle (Möller–Trumbore) : distance ou -1
        function fpsTri(T, i, o, d) { const a = i * 9, e1x = T[a + 3] - T[a], e1y = T[a + 4] - T[a + 1], e1z = T[a + 5] - T[a + 2], e2x = T[a + 6] - T[a], e2y = T[a + 7] - T[a + 1], e2z = T[a + 8] - T[a + 2];
            const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) return -1; const inv = 1 / det;
            const tx = o.x - T[a], ty = o.y - T[a + 1], tz = o.z - T[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return -1;
            const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (d.x * qx + d.y * qy + d.z * qz) * inv; if (w < 0 || u + w > 1) return -1;
            return (e2x * qx + e2y * qy + e2z * qz) * inv; }
        // sol sous un point : la 1re surface rencontrée en descendant depuis « top »
        function fpsFloor(x, y, top) { const G = fpsGrid(), L = G.cells.get(G.key(Math.floor(x / G.C), Math.floor(y / G.C))) || [], o = { x, y, z: top }, d = { x: 0, y: 0, z: -1 }; let best = Infinity;
            for (const i of L) { const t = fpsTri(G.T, i, o, d); if (t >= 0 && t < best) best = t; } fpsLeaves().forEach(m => { const h = new THREE.Raycaster(new THREE.Vector3(x, y, top), new THREE.Vector3(0, 0, -1), 0, 50).intersectObject(m)[0]; if (h && h.distance < best) best = h.distance; });
            return isFinite(best) ? top - best : null; }
        // un obstacle sur le trajet (o → o + d·far) ?
        function fpsBlocked(o, d, far) { const G = fpsGrid(), seen = new Set(), ex = (x, y) => [Math.floor(x / G.C), Math.floor(y / G.C)], [i0, j0] = ex(o.x, o.y), [i1, j1] = ex(o.x + d.x * far, o.y + d.y * far);
            for (let i = Math.min(i0, i1) - 1; i <= Math.max(i0, i1) + 1; i++) for (let j = Math.min(j0, j1) - 1; j <= Math.max(j0, j1) + 1; j++) for (const k of G.cells.get(G.key(i, j)) || []) { if (seen.has(k)) continue; seen.add(k); const t = fpsTri(G.T, k, o, d); if (t >= 0 && t <= far) return true; }
            const ray = new THREE.Raycaster(new THREE.Vector3(o.x, o.y, o.z), new THREE.Vector3(d.x, d.y, d.z), 0, far); return fpsLeaves().some(m => ray.intersectObject(m).length > 0); }
        const fpsLeaves = () => { const F = V3.fps; if (!F) return []; if (F.leafRoot !== V3.root) { F.leafRoot = V3.root; F.leaves = []; V3.root.traverse(o => { if (o.userData.leaf) F.leaves.push(o); }); } return F.leaves; };
        // ouvrir / fermer la porte visée (E, ou clic dans la vue) : le vantail pivote de 90° sur ses gonds, du côté opposé à Momo
        function fpsDoor() { const F = V3.fps; if (!F) return false; const cp = Math.cos(F.pitch), dir = new THREE.Vector3(Math.sin(F.yaw) * cp, Math.cos(F.yaw) * cp, Math.sin(F.pitch)), ray = new THREE.Raycaster(F.pos.clone(), dir, 0, 3);
            const h = ray.intersectObjects(V3.root.children, true).find(x => x.object.isMesh && x.object.visible && !x.object.userData.cap && (x.object.userData.leaf || (x.object.userData.opening && (x.object.userData.opening.kind === 'porte' || x.object.userData.opening.kind === 'garage'))));
            let pv = null; if (h) { pv = h.object.userData.leaf ? h.object.parent : null; if (!pv) { const o = h.object.userData.opening; V3.root.traverse(m => { if (m.userData.leaf && m.userData.leaf === o) pv = m.parent; }); } }
            if (!pv) { let best = 2.6; V3.root.updateMatrixWorld(true); V3.root.traverse(m => { if (!m.userData.door) return; const c = m.userData.door.garage ? m.parent.getWorldPosition(new THREE.Vector3()) : new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()), dx = c.x - F.pos.x, dy = c.y - F.pos.y, d = Math.hypot(dx, dy) - (m.userData.door.garage ? 1.5 : 0); if (d < best && (dx * dir.x + dy * dir.y) / (d || 1) > 0.5) { best = d; pv = m; } }); }   // porte ouverte : on vise l'embrasure
            if (!pv || !pv.userData.door) return false;
            const D = pv.userData.door; if (D.axis === 'x') { let k = D.dir; if (!k) { V3.root.updateMatrixWorld(true); k = pv.parent.worldToLocal(F.pos.clone()).y > 0 ? -1 : 1; } D.to = D.open ? 0 : k * Math.PI / 2; } else if (D.open) D.to = D.a0; else if (D.sw) D.to = D.a0 + D.sw; else { const nx = -Math.sin(D.a0), ny = Math.cos(D.a0), side = (F.pos.x - pv.position.x) * nx + (F.pos.y - pv.position.y) * ny; D.to = D.a0 + (side > 0 ? -1 : 1) * Math.PI / 2; } D.open = !D.open;
            (F.anim = F.anim || new Set()).add(pv); updateCommandMessageText((D.garage ? 'VUE MOMO : porte de garage ' : 'VUE MOMO : porte ') + (D.open ? 'ouverte (E pour la refermer).' : 'fermée.')); return true; }
        // altitude du sol fini (mm) sous un point du plan : plateforme, terrain, ou la dalle qui le porte
        function groundZAt(wx, wy, slabs) { const tin = getTIN(); let FM = null; try { FM = finishedModel(); } catch (e) {}
            const tn = tin ? tinZ(wx, wy, tin) : null, r = FM ? FM.at(wx, wy, hasZ(tn) ? tn : undefined) : null; let z = r && hasZ(r.z) ? r.z : hasZ(tn) ? tn : null;
            if (slabs) { let best = null; shapes.forEach(d => { if (!(d.solid && d.solid.kind === 'box' && d.type === 'poly' && hasZ(solidBaseZ(d)) && pointInPolygon(wx, wy, d.points))) return; const t = solidBaseZ(d) + (d.solid.H || 0); if ((!hasZ(z) || t < z + 3000) && (best === null || t > best)) best = t; }); if (best !== null) z = best; }
            return z; }
        async function momoFPS(at) {   // at = { w: point du plan } ou { p: point de la scène 3D }
            const ownL = !mcLoad.on; if (ownL) await mcLoad.open('Balade Momo', ['Balade Momo'], { fun: true, min: 2400 });   // « Nouage des lacets… »
            try { await momoFPS_(at); } finally { if (ownL) mcLoad.close(); } }
        async function momoFPS_(at) { mcLoad.set(0, null);
            const from3D = is3DOpen() && !lp3D.live; if (!from3D) await open3D(); if (!V3 || !V3.root) return;
            V3.root.updateMatrixWorld(true); const rp = V3.root.position; let p;
            if (at.w) { const z = groundZAt(at.w.x, at.w.y, true), x = worldToMm(at.w.x) / 1000 + rp.x, y = -worldToMm(at.w.y) / 1000 + rp.y; p = new THREE.Vector3(x, y, hasZ(z) ? (z / 1000 - (V3.zmin || 0)) * (V3.exag || 1) + rp.z : 0); }
            else p = at.p.clone();
            V3.fps = { pos: new THREE.Vector3(p.x, p.y, p.z + FPS_EYE), yaw: V3.az + Math.PI, pitch: -0.05, keys: {}, t: performance.now(), back: from3D ? { az: V3.az, el: V3.el, dist: V3.dist, t: V3.target.clone() } : null };
            V3.anim = null; const hud = document.getElementById('v3-fps'); if (hud) hud.style.display = 'block'; document.body.classList.add('v3fps'); try { window.getSelection().removeAllRanges(); } catch (e) {}
            try { V3.renderer.domElement.requestPointerLock(); } catch (e) {}
            updateCommandMessageText('VUE MOMO : Z Q S D (ou flèches) = marcher · souris = regarder (clic dans la vue pour la capturer) · Maj = courir · Espace = sauter · E ou clic = ouvrir / fermer une porte · clic droit = pause et affichage · Échap = sortir.');
            render3D(); fpsLoop(); }
        function fpsStop() { const F = V3 && V3.fps; if (!F) return; V3.fps = null; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
            const hud = document.getElementById('v3-fps'); if (hud) hud.style.display = 'none'; document.body.classList.remove('v3fps'); { const fb = document.getElementById('fps-bub'); if (fb) fb.remove(); }
            if (F.back) { V3.az = F.back.az; V3.el = F.back.el; V3.dist = F.back.dist; V3.target.copy(F.back.t); render3D(); updateCommandMessageText('VUE MOMO terminée : retour à la vue 3D.'); }
            else { const rp = V3.root.position, wx = mmToWorld((F.pos.x - rp.x) * 1000), wy = -mmToWorld((F.pos.y - rp.y) * 1000); close3D(); camera.x = canvas.width / 2 - wx * camera.zoom; camera.y = canvas.height / 2 - wy * camera.zoom; draw(); updateCommandMessageText('VUE MOMO terminée : retour au plan, centré là où était Momo.'); } }
        function fpsLoop() { const F = V3 && V3.fps; if (!F) return; requestAnimationFrame(fpsLoop); const now = performance.now(), dt = Math.min(0.25, (now - F.t) / 1000); F.t = now; fpsStep(dt); }
        function fpsStep(dt) { const F = V3.fps; if (!F) return; if (F.paused) { if (F.dirty) { F.dirty = false; render3D(); } return; } const K = F.keys, fw = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), st = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0); let ch = F.dirty; F.dirty = false;
            if (fw || st) { const v = (K.ShiftLeft || K.ShiftRight ? 9 : 3.4) * dt, sy = Math.sin(F.yaw), cy = Math.cos(F.yaw), dx = (sy * fw + cy * st), dy = (cy * fw - sy * st), n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, feet = F.pos.z - FPS_EYE;
                const tryMove = (mx, my) => { const l = Math.hypot(mx, my); if (l < 1e-6) return false; const d = { x: mx / l, y: my / l, z: 0 }; if ([FPS_STEP + 0.05, 1.1, 1.6].some(h => fpsBlocked({ x: F.pos.x, y: F.pos.y, z: feet + h }, d, l + 0.3))) return false;
                    const nf = fpsFloor(F.pos.x + mx, F.pos.y + my, feet + FPS_STEP + 0.2); if (nf !== null && nf > feet + FPS_STEP) return false; F.pos.x += mx; F.pos.y += my; return true; };
                if (tryMove(ux * v, uy * v) || tryMove(ux * v, 0) || tryMove(0, uy * v)) ch = true; }   // contre un mur, il glisse le long
            if (F.snap || (F.grid && F.grid.root !== V3.root)) { F.snap = false; const f0 = fpsFloor(F.pos.x, F.pos.y, F.pos.z + 200); if (f0 !== null) { F.pos.z = f0 + FPS_EYE; ch = true; } }   // scène reconstruite : Momo se repose sur le nouveau sol
            if (F.vz) {   // saut : élan vers le haut, pesanteur, on retombe sur le sol (ou sur ce qui est dessous)
                F.vz -= 9.81 * dt; F.pos.z += F.vz * dt; ch = true; const fj = fpsFloor(F.pos.x, F.pos.y, F.pos.z - FPS_EYE + FPS_STEP + 0.2); if (F.vz < 0 && fj !== null && F.pos.z <= fj + FPS_EYE) { F.pos.z = fj + FPS_EYE; F.vz = 0; } }
            else { const fl = fpsFloor(F.pos.x, F.pos.y, F.pos.z - FPS_EYE + FPS_STEP + 0.2); if (fl !== null) { const target = fl + FPS_EYE, dz = (target - F.pos.z) * Math.min(1, dt * 12); if (Math.abs(dz) > 1e-4) { F.pos.z += dz; ch = true; } } }
            if (F.anim && F.anim.size) { F.anim.forEach(pv => { const D = pv.userData.door, ax = D.axis || 'z', d = D.to - pv.rotation[ax], st2 = Math.sign(d) * Math.min(Math.abs(d), dt * (D.garage ? 1.6 : 3)); pv.rotation[ax] += st2; if (Math.abs(D.to - pv.rotation[ax]) < 1e-3) { pv.rotation[ax] = D.to; F.anim.delete(pv); } }); ch = true; }
            if (ch) render3D(); }
        // touches F pendant la visite : F1 aberration, F2 coupe, F3 terrain, F4 points cotés, F5 fonds, F6 plateformes, F7 remblai périph., F8 rendu naturel, F9 paysage — en direct
        const FPS_FK = [['.v3-ab', 'aberration'], ['#v3-cutbtn', 'coupe en perspective'], ['[data-for="v3-surf"]', 'terrain'], ['[data-for="v3-lab"]', 'points cotés'], ['[data-for="v3-bg"]', 'fonds de carte'], ['[data-for="v3-tal"]', 'plateformes et talus'], ['[data-for="v3-rp"]', 'remblai périphérique'], ['[data-for="v3-nat"]', 'rendu naturel'], ['[data-for="v3-hz"]', 'ciel et paysage']];
        // balade en pause (clic droit) : le curseur est libre, des bulles d'affichage autour de lui (terrain, fonds, ciel…, studio photo) ; reclic droit = reprendre
        function fpsPause(e) { const F = V3 && V3.fps; if (!F) return; if (F.paused) { fpsResume(); return; } F.paused = true; F.keys = {}; F.locked = false; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (er) {}   // le verrou rendu exprès ne termine pas la balade
            const v = document.getElementById('view3d'), r = v.getBoundingClientRect(), cx = e && e.clientX && document.pointerLockElement !== V3.renderer.domElement ? e.clientX - r.left : r.width / 2, cy = e && e.clientY && document.pointerLockElement !== V3.renderer.domElement ? e.clientY - r.top : r.height / 2; fpsBubbles(cx, cy);
            updateCommandMessageText('VUE MOMO en pause : coche ou décoche l\'affichage dans les bulles ; clic droit pour reprendre la balade.'); }
        /* PINCEAU de la vue Momo : la vue se fige (curseur libre), le volet des textures s'ouvre ; chaque clic peint la surface visée (mur, dalle, toit, meuble…) ; P, Échap ou clic droit : on repart */
        function fpsPaint() { const F = V3 && V3.fps; if (!F) return; F.paused = true; F.keys = {}; F.locked = false; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} const b = document.getElementById('fps-bub'); if (b) b.remove();
            startPaint('paint', true); updateCommandMessageText('VUE MOMO — PINCEAU : la vue est figée ; choisis la texture dans le volet et clique les surfaces à peindre. P, Échap ou clic droit : reprendre la balade.'); }
        function fpsPaintStop() { if (texPaint) texStop(); if (V3 && V3.fps && V3.fps.paused) fpsResume(); }
        function fpsResume() { const F = V3 && V3.fps; if (!F) return; if (texPaint) texStop(); F.paused = false; F.t = performance.now(); const b = document.getElementById('fps-bub'); if (b) b.remove(); try { V3.renderer.domElement.requestPointerLock(); } catch (er) {} updateCommandMessageText('VUE MOMO : Z Q S D = marcher · souris = regarder · Maj = courir · Espace = sauter · clic droit = pause et affichage · Échap = sortir.'); }
        function fpsBubbles(cx, cy) { let el = document.getElementById('fps-bub'); if (el) el.remove(); el = document.createElement('div'); el.id = 'fps-bub'; document.getElementById('view3d').appendChild(el);
            const ic = (sel) => { const e = document.querySelector(sel), g = e && e.querySelector('svg'); return g ? g.outerHTML : ''; }, items = FPS_FK.map(([q, l], i) => { const c = document.getElementById(((document.querySelector('#v3-band ' + q) || {}).dataset || {}).for || ''); return { l: l.charAt(0).toUpperCase() + l.slice(1), ic: ic('#v3-band ' + q), on: i === 1 ? !!V3.cut : !!(c && c.checked), n: i + 1 }; }).filter(it => it.n !== 1).concat([{ l: 'Studio photo', ic: ic('#v3-studio-btn'), on: stOn(), n: 10 }, { l: 'Pinceau : peindre les surfaces (P)', ic: ic('#btn-paint'), on: !!texPaint, n: 11 }]);   // des icônes seules (le nom au survol) ; pas d'aberration en balade
            const RX = 120, RY = 120, W = el.parentNode.clientWidth, H = el.parentNode.clientHeight, x0 = Math.max(RX + 80, Math.min(W - RX - 80, cx)), y0 = Math.max(RY + 30, Math.min(H - RY - 30, cy));
            el.innerHTML = `<div class="fb-c" style="left:${x0}px;top:${y0}px">❚❚<small>clic droit : reprendre</small></div>` + items.map((it, k) => { const a = -Math.PI / 2 + k / items.length * Math.PI * 2; return `<button type="button" class="fb${it.on ? ' on' : ''}" title="${it.l}" style="left:${(x0 + Math.cos(a) * RX).toFixed(0)}px;top:${(y0 + Math.sin(a) * RY).toFixed(0)}px" onclick="fpsBubble(${it.n})">${it.ic || it.l}</button>`; }).join('');
            el.oncontextmenu = (ev) => { ev.preventDefault(); fpsResume(); }; el.dataset.x = x0; el.dataset.y = y0; }
        function fpsBubble(n) { if (n === 11) { if (texPaint) fpsPaintStop(); else fpsPaint(); return; } if (n === 10) { if (V3.fps) V3.fps.locked = false; if (stOn()) studioClose(); else { studioOpen(); return; } } else fpsFKey(n); const el = document.getElementById('fps-bub'); if (el && V3.fps && V3.fps.paused) fpsBubbles(+el.dataset.x, +el.dataset.y); }
        function fpsFBadges() { { const el = document.getElementById('v3-studio-btn'); if (el && !el.querySelector('.v3-fk')) { const b = document.createElement('span'); b.className = 'v3-fk'; b.textContent = 'F10'; if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.appendChild(b); } }   // F10 : studio photo
            FPS_FK.forEach(([q], i) => { const el = document.querySelector('#v3-band ' + q); if (!el || el.querySelector('.v3-fk')) return; const b = document.createElement('span'); b.className = 'v3-fk'; b.textContent = 'F' + (i + 1); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.appendChild(b); }); }
        function fpsFKey(n) { const E = FPS_FK[n - 1]; if (!E) return; const el = document.querySelector('#v3-band ' + E[0]); if (!el) return;
            if (n === 1) { const sel = document.getElementById('v3-exag'), i = (sel.selectedIndex + 1) % sel.options.length; sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); updateCommandMessageText('VUE MOMO : aberration ' + sel.options[i].text + ' (F1).'); }
            else if (n === 2) { if (V3.cut || cutLineOf(selectedShapes)) { v3CutToggle(); updateCommandMessageText('VUE MOMO : coupe en perspective ' + (V3.cut ? 'activée' : 'retirée') + ' (F2).'); } else updateCommandMessageText('VUE MOMO : pas de trait de coupe sélectionné pour la coupe en perspective (F2).'); }
            else { v3Tog(el); const c = document.getElementById(el.dataset.for); updateCommandMessageText('VUE MOMO : ' + E[1] + ' ' + (c && c.checked ? 'affiché' : 'masqué') + ' (F' + n + ').'); }
            const F = V3.fps; if (F) { F.snap = true; F.dirty = true; } }
        function fpsLook(dx, dy) { const F = V3 && V3.fps; if (!F) return; F.yaw += dx * 0.0025; F.pitch = Math.max(-1.45, Math.min(1.45, F.pitch - dy * 0.0025)); F.dirty = true; }   // rendu groupé à la prochaine image
        window.addEventListener('keydown', (e) => { if (!V3 || !V3.fps) return; if (e.target && e.target.closest && e.target.closest('#t2-panel, #rd-ov')) return;   // on tape dans le volet du studio
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (texPaint) { fpsPaintStop(); return; } if (stOn()) { studioClose(); return; } fpsStop(); return; }
            if (e.code === 'KeyP' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); if (texPaint) fpsPaintStop(); else fpsPaint(); return; }
            if (e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat && !V3.fps.vz) { V3.fps.vz = 4.6; V3.fps.dirty = true; } return; }   // sauter
            if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); fpsDoor(); return; }
             V3.fps.keys[e.code] = true; if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { e.preventDefault(); } e.stopImmediatePropagation(); }, true);
        window.addEventListener('keyup', (e) => { if (V3 && V3.fps) { V3.fps.keys[e.code] = false; e.stopImmediatePropagation(); } }, true);
        window.addEventListener('blur', () => { if (V3 && V3.fps) V3.fps.keys = {}; });
        document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement && !(V3 && V3.fps)) { try { document.exitPointerLock(); } catch (e) {} return; }   // verrou arrivé après la sortie : rendu tout de suite
            if (V3 && V3.fps && !document.pointerLockElement && V3.fps.locked) fpsStop(); else if (V3 && V3.fps && document.pointerLockElement) V3.fps.locked = true; });
        // attraper Momo : clic maintenu puis glisser ; un simple clic garde son rôle (ouvrir sa bulle)
        (() => { let G = null, swallow = 0;
            document.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest('#mt-dock,#mc-momo'); if (!el || e.button !== 0) return; G = { el, x: e.clientX, y: e.clientY, on: false }; }, true);
            document.addEventListener('pointermove', (e) => { if (!G) return; if (!G.on) { if (Math.hypot(e.clientX - G.x, e.clientY - G.y) < 8) return; G.on = true; const src = G.el.querySelector('svg') || G.el, r = src.getBoundingClientRect(), g = src.cloneNode(true);
                    // le clone garde exactement ce qu'on voit (un seul chapeau, pas de bulle « … ») : styles calculés recopiés élément par élément
                    const A0 = [src, ...src.querySelectorAll('*')], B0 = [g, ...g.querySelectorAll('*')]; A0.forEach((a, k) => { const cs = getComputedStyle(a), b = B0[k]; if (!b) return; b.style.display = cs.display; b.style.visibility = cs.visibility; b.style.opacity = cs.opacity; if (cs.fill) b.style.fill = cs.fill; if (cs.stroke) b.style.stroke = cs.stroke; b.style.animation = 'none'; });
                    B0.forEach(b => b.removeAttribute && b.removeAttribute('id'));
                    Object.assign(g.style, { position: 'fixed', left: '0px', top: '0px', width: r.width + 'px', height: r.height + 'px', pointerEvents: 'none', zIndex: 10000, transform: 'none', transformOrigin: '52% 10%', transition: 'none', opacity: '1', filter: 'none', overflow: 'visible' });
                    const sh = document.createElement('div'); Object.assign(sh.style, { position: 'fixed', left: '0px', top: '0px', width: r.width * 0.8 + 'px', height: r.width * 0.24 + 'px', pointerEvents: 'none', zIndex: 9999, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), rgba(0,0,0,.25) 60%, rgba(0,0,0,0))', filter: 'blur(2px)' });
                    document.body.appendChild(sh); document.body.appendChild(g); document.body.classList.add('momo-drag'); try { window.getSelection().removeAllRanges(); } catch (er) {} G.g = g; G.sh = sh;
                    // tenu par le haut de la tête : le corps se balance, le M pendouille avec un temps de retard (deux pendules amortis)
                    G.M = g.querySelector('.mt-mouth,.mc-mouth'); G.ph = { a: 0, va: 0, m: 0, vm: 0, vx: 0, px: e.clientX, t: performance.now() };
                    const tick = () => { if (G !== D0) return; const P = G.ph, now = performance.now(), dt = Math.min(0.05, (now - P.t) / 1000) || 0.016; P.t = now; P.vx *= Math.exp(-dt * 6);
                        const ta = Math.max(-35, Math.min(35, P.vx * 0.035));   // le corps traîne derrière la main P.va += (-(P.a - ta) * 140 - P.va * 7) * dt; P.a += P.va * dt;
                        const tm = Math.max(-45, Math.min(45, P.vx * 0.02 - P.va * 0.06)); P.vm += (-(P.m - tm) * 70 - P.vm * 4.5) * dt; P.m += P.vm * dt;
                        G.g.style.transform = 'rotate(' + P.a.toFixed(2) + 'deg)'; if (G.M) G.M.setAttribute('transform', 'rotate(' + (P.m - P.a * 0.2).toFixed(2) + ' 50 88)'); requestAnimationFrame(tick); };
                    const D0 = G; requestAnimationFrame(tick); G.w = r.width; G.h = r.height; G.el.style.visibility = 'hidden'; document.body.style.cursor = 'grabbing';
                    updateCommandMessageText('MOMO : lâche-le sur le plan (ou dans la vue 3D) pour te promener à sa place.'); }
                { const P = G.ph, now = performance.now(), dt = Math.max(1, now - (P.lt || now - 16)); P.lt = now; P.vx = P.vx * 0.6 + (e.clientX - P.px) / dt * 1000 * 0.4; P.px = e.clientX; }
                G.g.style.left = (e.clientX - G.w * 0.52) + 'px'; G.g.style.top = (e.clientY - G.h * 0.1) + 'px'; G.drop = { x: e.clientX, y: e.clientY + G.h * 0.9 + 22 }; G.sh.style.left = (G.drop.x - G.w * 0.4) + 'px'; G.sh.style.top = (G.drop.y - G.w * 0.12) + 'px'; e.preventDefault(); }, true);   // Momo soulevé par la tête, son ombre au sol : il sera posé sur l'ombre   // Momo soulevé, son ombre portée au sol, là où il sera posé
            document.addEventListener('pointerup', (e) => { const D = G; G = null; if (!D || !D.on) return; D.g.remove(); D.sh.remove(); document.body.classList.remove('momo-drag'); D.el.style.visibility = ''; document.body.style.cursor = ''; swallow = performance.now(); e.preventDefault();
                const X = D.drop ? D.drop.x : e.clientX, Y = D.drop ? D.drop.y : e.clientY, t = document.elementFromPoint(X, Y);
                if (t === canvas && !is3DOpen() && !layoutOn && !(typeof isOrthoView === 'function' && isOrthoView())) { const r = canvas.getBoundingClientRect(); momoFPS({ w: screenToWorld(X - r.left, Y - r.top) }); return; }
                if (V3 && is3DOpen() && !lp3D.live && t === V3.renderer.domElement) { const r = t.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((X - r.left) / r.width) * 2 - 1, -((Y - r.top) / r.height) * 2 + 1), V3.camera);
                    const h = ray.intersectObjects(V3.root.children, true).find(x => x.object.isMesh && x.object.visible && !x.object.userData.cap); if (h) { momoFPS({ p: h.point }); return; } }
                updateCommandMessageText('MOMO : pose-le sur le plan (vue de dessus) ou dans la vue 3D pour te promener à sa place.'); }, true);
            document.addEventListener('click', (e) => { if (performance.now() - swallow < 400) { e.stopPropagation(); e.preventDefault(); swallow = 0; } }, true);
        })();
        // Construction de la scène à partir du dessin
        // vue de façade en plan : du filaire seulement, comme le plan. Les faces ne servent qu'à cacher les arêtes situées derrière ;
        // couleurs et textures restent réservées au rendu 3D.
        function planWire3D(root) {
            const hide = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
            const add = [], gray = new THREE.Color(0x9ca3af);
            root.traverse(o => {
                if (o.isMesh) { const sh = o.userData.shape; [].concat(o.material || []).forEach(m => m.dispose && m.dispose()); o.material = hide;
                    if (!sh && o.geometry) add.push([o, new THREE.EdgesGeometry(o.geometry, 30)]); }
                else if (o.isLineSegments || o.isLine) { const sh = o.userData.edgeOf; if (o.material.dispose) o.material.dispose();
                    o.material = new THREE.LineBasicMaterial({ color: sh ? new THREE.Color(effectiveColor(sh, false)) : gray }); }
            });
            add.forEach(([o, g]) => { const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: gray })); l.position.copy(o.position); l.rotation.copy(o.rotation); l.scale.copy(o.scale); (o.parent || root).add(l); });
        }
        function build3DScene() {
            if (!V3 || V3.holdBuild) return;
            if (typeof layoutOn !== 'undefined' && layoutOn && lpSpace === 'paper' && !V3.inModel) { V3.inModel = true; try { return withModel(build3DScene); } finally { V3.inModel = false; } }   // fenêtre 3D de la mise en page : toujours la maquette
            if (V3.root) { V3.scene.remove(V3.root); V3.root.traverse(o => { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(m => { if (m.map && m.map.dispose && !(m.map.userData && m.map.userData.keep)) m.map.dispose(); if (m.dispose) m.dispose(); }); }); }   // un objet peut porter plusieurs matériaux (toit + sous-face)
            const exag = parseFloat(document.getElementById('v3-exag').value) || 1;
            const showSurf = document.getElementById('v3-surf').checked, showBg = document.getElementById('v3-bg').checked;
            const root = new THREE.Group(); V3.root = root; V3.labels = []; V3.snaps = []; V3.exag = exag; V3.flat = v3Flat;
            const SN = new Map(), snap = (x, y, z, k) => { const key = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000); if (!SN.has(key) || (k === 'end' && SN.get(key).k !== 'end')) SN.set(key, { v: new THREE.Vector3(x, y, z), k }); };
            const vis = shapes.filter(s => { if (s.brush || s.secOf || s.secMark || s.cutDef) return false; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); return !l || l.visible !== false; });
            // altitudes et étendue
            const zs = [], P = (wx, wy) => ({ x: worldToMm(wx) / 1000, y: -worldToMm(wy) / 1000 });
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const ext = (q) => { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); };
            vis.forEach(s => shapeVertices(s).forEach(v => { const z = v.get(); if (hasZ(z)) zs.push(z / 1000); }));
            vis.forEach(s => { if (s.type === 'mesh') { zs.push(s.z0 / 1000, (s.z0 + s.bb.h * (s.sc || 1)) / 1000); meshCorners(s).forEach(c => ext(P(c.x, c.y))); } });
            vis.forEach(s => { if (s.wallMat && s.wz && hasZ(s.wz.b) && hasZ(s.wz.t)) zs.push(s.wz.b / 1000, s.wz.t / 1000); });
            vis.forEach(s => { if (s.ctop) { const z = ctZ0(s); if (hasZ(z)) zs.push(z / 1000, (z + s.ctop.h) / 1000); } if (s.stair2) { const Z = st2Z(s); if (hasZ(Z.z0) && hasZ(Z.z1)) zs.push(Z.z0 / 1000, Z.z1 / 1000); } });
            vis.forEach(s => { if (!s.sweep) return; const G = sweepGeomCached(s); if (G) G.rings.forEach(R => R[0].forEach(q => zs.push(q.Z / 1000))); });
            const zmin = zs.length ? arrMin(zs) : 0, zmax = zs.length ? arrMax(zs) : 0; V3.zmin = zmin; V3.gz0 = zs.length ? (zs.reduce((a, z) => a + z, 0) / zs.length - zmin) * exag : 0;
            const Zm = (zmm) => hasZ(zmm) ? (zmm / 1000 - zmin) * exag : 0;   // sans altitude : posé au niveau le plus bas
            const pos = [], col = [], c3 = new THREE.Color();
            const seg = (a, za, b, zb, color) => { pos.push(a.x, a.y, za, b.x, b.y, zb); c3.set(color); col.push(c3.r, c3.g, c3.b, c3.r, c3.g, c3.b); ext(a); ext(b); };
            const ptsTopo = [];
            const blk3N = new Set(BLOCKS_BUILTIN.filter(blkHas3D).map(b => b.name));   // blocs modélisés : leur dessin de plan ne traîne pas au sol en 3D, c'est le volume qui les montre
            let drapeZ = null;
            for (const s of vis) {
                if (s.block && s.groupId && blk3N.has(s.block)) continue;
                if (isCadBati(s) || s.bois) continue;   // bâti du cadastre, zone boisée : montrés en volume
                if (is3DObj(s) || (s.type === 'line' && s.wz && hasZ(s.wz.t))) { (s.points || []).forEach(q => ext(P(q.x, q.y))); if (s.type === 'line') { ext(P(s.x1, s.y1)); ext(P(s.x2, s.y2)); } if (s.type === 'circle') { ext(P(s.x - s.r, s.y - s.r)); ext(P(s.x + s.r, s.y + s.r)); } continue; }   // objet qui a un vrai volume (toit, mur, poutre…) : pas de tracé de plan par-dessus
                const color = effectiveColor(s, false);
                if (s.type === 'line') { const a = P(s.x1, s.y1), b = P(s.x2, s.y2), za = Zm(s.z1), zb = Zm(s.z2); seg(a, za, b, zb, color); snap(a.x, a.y, za, 'end'); snap(b.x, b.y, zb, 'end'); snap((a.x + b.x) / 2, (a.y + b.y) / 2, (za + zb) / 2, 'mid'); }
                else if (s.type === 'poly' && s.cadOf && !s.points.some(q => hasZ(q.z))) {   // cadastre (parcelles) : drapé sur le terrain, tous les ~2 m, au lieu de rester à plat au fond
                    if (!drapeZ) { const tinD = getTIN(); let FMd = null; try { FMd = finishedModel(); } catch (e) {} drapeZ = (x, y) => { const tn = tinD ? tinZ(x, y, tinD) : null, r = FMd ? FMd.at(x, y, hasZ(tn) ? tn : undefined) : null; return r && hasZ(r.z) ? r.z : tn; }; }
                    const st2 = mmToWorld(2000); for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length], L = Math.hypot(b.x - a.x, b.y - a.y), m2 = Math.max(1, Math.ceil(L / st2)); let pr = null;
                        for (let k = 0; k <= m2; k++) { const x = a.x + (b.x - a.x) * k / m2, y = a.y + (b.y - a.y) * k / m2, z = drapeZ(x, y), q = { A: P(x, y), z: hasZ(z) ? Zm(z + 150) : Zm(null) }; if (pr) seg(pr.A, pr.z, q.A, q.z, color); pr = q; } } }
                else if (s.type === 'poly') for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length], A = P(a.x, a.y), B = P(b.x, b.y), za = Zm(a.z), zb = Zm(b.z); seg(A, za, B, zb, color); if (!s.solid) { snap(A.x, A.y, za, 'end'); snap(B.x, B.y, zb, 'end'); snap((A.x + B.x) / 2, (A.y + B.y) / 2, (za + zb) / 2, 'mid'); } }
                else if (s.type === 'circle' || s.type === 'arc') {
                    let a0 = 0, a1 = 2 * Math.PI;
                    if (s.type === 'arc') { a0 = s.startAngle; a1 = s.endAngle; if (a1 < a0) a1 += 2 * Math.PI; }
                    const n = 48, z = Zm(s.z); let prev = null;
                    for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n, q = P(s.x + s.r * Math.cos(t), s.y + s.r * Math.sin(t)); if (prev) seg(prev, z, q, z, color); prev = q; }
                }
                else if (s.type === 'point') { const q = P(s.x, s.y); ext(q); ptsTopo.push({ q, z: Zm(s.z), zr: s.z, mat: s.mat, color }); snap(q.x, q.y, Zm(s.z), 'end'); }
                else if (s.type === 'dim') { const g = dimGeom(s); if (g) seg(P(g.c1.x, g.c1.y), 0, P(g.c2.x, g.c2.y), 0, color); }
            }
            if (minX === Infinity) { minX = minY = -10; maxX = maxY = 10; }
            let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            if (V3.keepCenter && V3.center) { cx = V3.center.x; cy = V3.center.y; }   // vue 3D ouverte : on ne recentre pas à chaque ajout (la vue ne saute pas)
            V3.center = { x: cx, y: cy }; V3.R = Math.max(1, Math.hypot(maxX - minX, maxY - minY) / 2, (zmax - zmin) * exag / 2);
            try { blk3DBuild(root, vis, Zm); } catch (e) { console.error(e); }
            try { cadBati3D(root, vis, P, Zm, exag); } catch (e) { console.error(e); }
            try { bois3D(root, vis, P, Zm, exag); } catch (e) { console.error(e); }
            try { bassin3D(root, vis, P, Zm); } catch (e) { console.error(e); }
            try { stair3D(root, vis, P, Zm); } catch (e) { console.error(e); }
            try { stair2_3D(root, vis, P, Zm); } catch (e) { console.error(e); }
            try { ctop3D(root, vis, P, Zm); } catch (e) { console.error(e); }
            try { waterBuild3D(root, P, Zm); } catch (e) { console.error(e); }
            try { riverBuild3D(root, P, Zm); } catch (e) { console.error(e); }
            try { realLand3D(root, P, Zm); } catch (e) { console.error(e); }
            root.position.set(-cx, -cy, 0);   // dessin centré sur l'origine 3D
            if (pos.length) {
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
                { const ln = document.getElementById('v3-lines'); if (v3Flat || !ln || ln.checked) { const pl = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); pl.userData.plan2d = true; root.add(pl); } }   // traits du plan : masqués par défaut dans le rendu (bouton du bandeau)
            }
            if (ptsTopo.length && (document.getElementById('v3-lab') || {}).checked !== false) {   // cotes de niveau masquées : points et fils verticaux aussi
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ptsTopo.flatMap(p => [p.q.x, p.q.y, p.z]), 3));
                root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbef264, size: 6, sizeAttenuation: false })));
                // petits fils verticaux jusqu'au sol pour lire la hauteur
                const st = []; ptsTopo.forEach(p => { if (p.z > 0) st.push(p.q.x, p.q.y, 0, p.q.x, p.q.y, p.z); });
                if (st.length) { const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(st, 3)); root.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: 0x4d7c0f, transparent: true, opacity: 0.6 }))); }
                V3.labels = ptsTopo.filter(p => hasZ(p.zr)).slice(0, 400).map(p => ({ v: new THREE.Vector3(p.q.x - cx, p.q.y - cy, p.z), t: fmtZ(p.zr) }));
            }
            // plateformes + talus : terrain fini calculé exactement (cote projet, talus à la pente choisie, sinon terrain naturel)
            const showTal = document.getElementById('v3-tal').checked, tin = getTIN();
            // terrain fini commun à toutes les plateformes (talus raccordés) ; [z fini en mm, nature] : 0 terrain, 1 plateforme, 2 remblai, 3 déblai
            const FM = showTal ? finishedModel() : null, zones = FM ? FM.P.filter(p => vis.includes(p.s)) : [];
            /* remblai périphérique « jusqu'au terrain naturel » (réglage d'ensemble ou côté par côté) : la fouille est rebouchée, le terrain naturel y revient tel quel (toujours : c'est l'état fini) */
            const RPTN = FM ? FM.P.map(p => { const s0 = p.s; if (!cubRPon(s0)) return null; const m = rpMode(s0), t = platTalus(s0), EX = t.cx && t.edges && s0.type === 'poly' ? t.edges : null;
                if (m === 'tn') return () => true; if (m === 'fini' && EX && EX.some(e => e && e.rptn)) return (x, y) => rpModeAt(EX, p.ring, x, y, 'fini') === 'tn'; return null; }) : null;
            const zFini = (x, y, tn) => { const r = FM.at(x, y, tn); if (r && RPTN && hasZ(tn) && (r.kind === 3 || (r.kind === 4 && r.z < tn)) && RPTN[r.gov] && RPTN[r.gov](x, y) && !pointInPolygon(x, y, FM.P[r.gov].ring)) return [tn, 0, r.gov]; return r ? [r.z, r.kind === 4 ? (r.z > tn ? 2 : 3) : r.kind] : [tn, 0]; };
            // fonds de carte : drapés sur le terrain quand il est affiché (texture avec un liseré transparent : rien au-delà de l'image, cercle pour un fond de carte)
            const bgDrape = showBg && !v3Flat && showSurf && tin && tin.tris.length ? vis.filter(isBg).map(b => { const img = bmImg(b.mapId); if (!img) return null;
                const N = Math.min(2048, Math.max(256, img.naturalWidth || 1024)), pad = 2, c = document.createElement('canvas'); c.width = c.height = N + 2 * pad; const x = c.getContext('2d');
                if (b.type === 'basemap') { x.beginPath(); x.arc(pad + N / 2, pad + N / 2, N / 2, 0, 2 * Math.PI); x.clip(); }
                x.drawImage(img, pad, pad, N, N); if (b.type === 'basemap') for (const k of BM_OVL_ORDER) { if (!bmOvlOn(b, k)) continue; const o = bmImg(b.mapId + '_' + k); if (o) x.drawImage(o, pad, pad, N, N); }
                const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return { s: b, tex: { t, k: pad / (N + 2 * pad) } }; }).filter(Boolean) : [];
            const drapeBg = bgDrape.length > 0;
            if (tin && tin.tris.length && (showSurf || zones.length)) {
                const pp = [], cc = [], wp = [];
                const ramp = (z) => { const t = zmax > zmin ? (z - zmin) / (zmax - zmin) : 0.5; return new THREE.Color().setHSL(0.62 - 0.62 * t, 0.65, 0.45); };
                const KC = [null, new THREE.Color(0xd6d3d1), new THREE.Color(0x60a5fa), new THREE.Color(0xf87171)];
                const nat = v3Nat(), gp = [], gk = [], ep = [], ap = [], hasRoad = roadPolys().length > 0;   // rendu naturel : triangles herbe / terre
                const tp = drapeBg ? [] : null;   // terrain naturel (hors plateformes et talus) : support du fond de carte drapé
                const push = (v) => { const q = P(v[0], v[1]), k = v[3] ? KC[v[3]] : ramp(v[2] / 1000); pp.push(q.x, q.y, Zm(v[2])); cc.push(k.r, k.g, k.b); };
                const pushN = (T) => { const L = T.some(v => v[3] === 2 || v[3] === 3) ? ep : hasRoad && !T.some(v => v[3] === 1) && roadAt((T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3) ? ap : gp; if (L === gp) gk.push(T.every(v => !v[3]) ? 1 : 0); T.forEach(v => { const q = P(v[0], v[1]); L.push(q.x, q.y, Zm(v[2])); }); };
                let step = zones.length ? Math.min(mmToWorld(600), Math.max(mmToWorld(150), arrMin(zones.map(Zo => Math.max(Zo.ext, (Zo.bb0.x1 - Zo.bb0.x0 + Zo.bb0.y1 - Zo.bb0.y0) / 2, mmToWorld(1000)))) / 45)) : 1; if (V3.hq && zones.length) step = Math.max(mmToWorld(80), step / V3.hq.terr);   // rendu : talus et abords plus fins   // pas fin du terrain fini, borné (ni trop grossier, ni trop lourd)
                zones.forEach(Zo => { Zo.bbH = Zo.bb; });
                const PS = []; zones.forEach(Zo => { const t = platTalus(Zo.s); if (!t.edges || Zo.s.type !== 'poly') return; const R = Zo.ring; t.edges.forEach((e, k) => { if (e && e.off && k < R.length) PS.push([R[k], R[(k + 1) % R.length]]); }); });
                const nearParoi = (x, y) => PS.some(([a, b]) => t2SegDist({ x, y }, a, b) < step * 1.5);
                const mg = step * 2; let refBudget = 900000 * (V3.hq ? Math.min(5, V3.hq.terr * V3.hq.terr) : 1);   // marge autour des plateformes ; plafond de triangles fins

                // rendu : terrain naturel affiné, chaque triangle découpé pareil (pas de fente entre voisins) et bombé en douceur (normales lissées des sommets) ;
                //      les sommets des lignes de rupture restent des arêtes vives
                let HS = null; if (V3.hq && nat) { const k = worldToMm(1), NN = new Float32Array(tin.nodes.length * 3);
                    tin.tris.forEach(([a, b, c]) => { const A = tin.nodes[a], B = tin.nodes[b], C = tin.nodes[c], ux = (B.x - A.x) * k, uy = (B.y - A.y) * k, uz = B.z - A.z, vx = (C.x - A.x) * k, vy = (C.y - A.y) * k, vz = C.z - A.z; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; } [a, b, c].forEach(i => { NN[i * 3] += nx; NN[i * 3 + 1] += ny; NN[i * 3 + 2] += nz; }); });
                    const n = Math.max(1, Math.min(6, Math.floor(Math.sqrt(1600000 * Math.min(1, V3.hq.terr / 2) / Math.max(1, tin.tris.length))))), pl = (i, x, y, zl) => { const N = tin.nodes[i]; if (N.br || !(NN[i * 3 + 2] > 0)) return zl; return N.z - (NN[i * 3] * (x - N.x) * k + NN[i * 3 + 1] * (y - N.y) * k) / NN[i * 3 + 2]; };
                    HS = { n, z: (ia, ib, ic, u, v, w, x, y) => { const A = tin.nodes[ia], B = tin.nodes[ib], C = tin.nodes[ic], zl = A.z * u + B.z * v + C.z * w; return zl + 0.75 * (u * pl(ia, x, y, zl) + v * pl(ib, x, y, zl) + w * pl(ic, x, y, zl) - zl); } }; }
                tin.tris.forEach(([a, b, c]) => {
                    const A = tin.nodes[a], B = tin.nodes[b], C = tin.nodes[c];
                    const hit = zones.some(Zo => Math.max(A.x, B.x, C.x) >= Zo.bb.x0 && Math.min(A.x, B.x, C.x) <= Zo.bb.x1 && Math.max(A.y, B.y, C.y) >= Zo.bb.y0 && Math.min(A.y, B.y, C.y) <= Zo.bb.y1);
                    if (!hit) {
                        if (!showSurf) return;
                        if (hasRoad) { const RC = roadClipTri([[A.x, A.y, A.z], [B.x, B.y, B.z], [C.x, C.y, C.z]]); if (RC) {   // touché par une route : découpé au bord de la chaussée
                            RC.road.forEach(t => t.forEach(v => { const q = P(v[0], v[1]); ap.push(q.x, q.y, Zm(v[2])); }));
                            RC.rest.forEach(t => { if (tp) tp.push(t[0], t[1], t[2]); const T4 = t.map(v => [v[0], v[1], v[2], 0]); if (nat) { gk.push(1); T4.forEach(v => { const q = P(v[0], v[1]); gp.push(q.x, q.y, Zm(v[2])); }); } else { T4.forEach(push); [t[0], t[1], t[1], t[2], t[2], t[0]].forEach(v => { const q = P(v[0], v[1]); wp.push(q.x, q.y, Zm(v[2])); }); } }); return; } }
                        if (HS && HS.n > 1) { const n = HS.n, V = (i, j) => { const v = i / n, w = j / n, u = 1 - v - w, x = A.x * u + B.x * v + C.x * w, y = A.y * u + B.y * v + C.y * w; return [x, y, HS.z(a, b, c, u, v, w, x, y), 0]; }, T = (p, q, r) => { pushN([p, q, r]); if (tp) tp.push(p, q, r); };
                            for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) { const p0 = V(i, j), p1 = V(i + 1, j), p2 = V(i, j + 1); T(p0, p1, p2); if (i + j + 1 < n) T(p1, V(i + 1, j + 1), p2); } return; }
                        if (tp) tp.push([A.x, A.y, A.z], [B.x, B.y, B.z], [C.x, C.y, C.z]);
                        if (nat) { pushN([A, B, C].map(n => [n.x, n.y, n.z, 0])); return; }
                        if (hasRoad && roadAt((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3)) { [A, B, C].forEach(n => { const q = P(n.x, n.y); ap.push(q.x, q.y, Zm(n.z)); }); return; }   // chaussées en enrobé, aussi en rendu coloré par altitude
                        [A, B, C].forEach(n => push([n.x, n.y, n.z, 0])); [A, B, B, C, C, A].forEach(n => { const q = P(n.x, n.y); wp.push(q.x, q.y, Zm(n.z)); }); return;
                    }
                    // triangle touché par une plateforme : redécoupé finement et posé sur le terrain fini
                    const L = Math.max(Math.hypot(B.x - A.x, B.y - A.y), Math.hypot(C.x - B.x, C.y - B.y), Math.hypot(A.x - C.x, A.y - C.y));
                    const n = Math.max(1, Math.min(200, Math.ceil(L / step)));
                    // arêtes du maillage du terrain naturel, posées sur le terrain fini, sauf sur les plateformes et les talus (même lecture qu'ailleurs)
                    if (!nat && showSurf) [[A, B], [B, C], [C, A]].forEach(([U, W]) => { let pr = null; for (let k = 0; k <= n; k++) { const f = k / n, x = U.x + (W.x - U.x) * f, y = U.y + (W.y - U.y) * f, r = zFini(x, y, U.z + (W.z - U.z) * f), cur = [x, y, r[0], r[1]];
                        if (pr && !pr[3] && !cur[3]) { const a = P(pr[0], pr[1]), b = P(x, y); wp.push(a.x, a.y, Zm(pr[2]), b.x, b.y, Zm(cur[2])); } pr = cur; } });
                    // petit triangle à cheval sur une marche verticale (paroi, bord de plateforme contre une autre) : on ne le dessine pas, sinon une fausse pente en dents de scie ; la paroi ou la dalle ferme la marche
                    // seules les marches tenues par une paroi gardent un vide (le voile la ferme) ; ailleurs le triangle est dessiné, sans trou
                    /* bord d'une fouille rebouchée au terrain naturel : le triangle à cheval sur le bord de la plateforme est refait côté terrain, ses sommets
                       de plateforme ramenés sur le bord, à l'altitude du terrain : la pelouse vient au pied du mur, sans dents de scie */
                    const rpSeam = (p, q, r) => { const T = [p, q, r], g = T.find(v => v.rg !== undefined); if (!g || !T.some(v => v[3] === 1)) return false; const ring = FM.P[g.rg].ring;
                        const W = T.map(v => { if (v[3] !== 1) return v; const n = nearOnRing(v[0], v[1], ring), z = tinZ(n.px, n.py, tin); return [n.px, n.py, hasZ(z) ? z : v[4], 0, v[4]]; }); if (nat) pushN(W); else W.forEach(push); return true; };
                    const steep = (p, q, r) => { const zs = [p[2], q[2], r[2]], dz = (Math.max(...zs) - Math.min(...zs)) / 1000; if (dz < 0.05) return false; const L = mOf(Math.min(Math.hypot(q[0] - p[0], q[1] - p[1]), Math.hypot(r[0] - q[0], r[1] - q[1]), Math.hypot(p[0] - r[0], p[1] - r[1]))) || 1e-6; return dz / L > 3; };
                    const tri = (p, q, r) => { if (RPTN && rpSeam(p, q, r)) return; if ((p[3] === 1 || q[3] === 1 || r[3] === 1) && steep(p, q, r) && nearParoi((p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3)) return; if (showSurf || p[3] || q[3] || r[3]) { if (tp && !p[3] && !q[3] && !r[3]) tp.push(p, q, r); if (nat) pushN([p, q, r]); else { push(p); push(q); push(r); } } };
                    // découpe adaptative : fine (pas « step ») seulement là où passent les plateformes et leurs talus, telle quelle ailleurs.
                    // Un grand triangle de terrain (relief lointain, semis de points étendu) n'impose plus un découpage grossier aux talus.
                    const V = (x, y, tn) => { const r = zFini(x, y, tn); const v = [x, y, r[0], r[1], tn]; if (r[2] !== undefined) v.rg = r[2]; return v; }, M = (p, q) => { const c = p.mc || (p.mc = new Map()); let m = c.get(q); if (m) return m; m = V((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[4] + q[4]) / 2); c.set(q, m); (q.mc || (q.mc = new Map())).set(p, m); return m; };   /* milieu d'arête partagé entre les deux triangles voisins : calculé une fois */
                    const inZone = (p, q, r) => { const x0 = Math.min(p[0], q[0], r[0]) - mg, x1 = Math.max(p[0], q[0], r[0]) + mg, y0 = Math.min(p[1], q[1], r[1]) - mg, y1 = Math.max(p[1], q[1], r[1]) + mg; return zones.some(Zo => x1 >= Zo.bb.x0 && x0 <= Zo.bb.x1 && y1 >= Zo.bb.y0 && y0 <= Zo.bb.y1); };
                    const split = (p, q, r, d) => { const l1 = Math.hypot(q[0] - p[0], q[1] - p[1]), l2 = Math.hypot(r[0] - q[0], r[1] - q[1]), l3 = Math.hypot(p[0] - r[0], p[1] - r[1]), lm = Math.max(l1, l2, l3);
                        // même nature partout (terrain naturel, ou dessus de plateforme) : inutile de découper aussi fin ; le budget de triangles va aux talus.
                        // (avant, sur un grand plan, le budget s'épuisait et les derniers triangles restaient grossiers : de grands pans « terre » à côté des talus)
                        let kU = -1; if (lm > step * 1.42 && lm <= step * 6.5 && p[3] === q[3] && q[3] === r[3] && (p[3] === 0 || p[3] === 1)) { const g = V((p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[4] + q[4] + r[4]) / 3); if (g[3] === p[3] && M(p, q)[3] === p[3] && M(q, r)[3] === p[3] && M(r, p)[3] === p[3]) kU = p[3]; }
                        const inZ = inZone(p, q, r); if (!inZ || lm <= step * 1.42 || (kU === 0 && lm <= step * 3.2) || (kU === 1 && lm <= step * 6.5) || d > 40 || refBudget <= 0) { if (inZ) refBudget--; tri(p, q, r); return; }
                        if (lm === l1) { const m = M(p, q); split(p, m, r, d + 1); split(m, q, r, d + 1); } else if (lm === l2) { const m = M(q, r); split(q, m, p, d + 1); split(m, r, p, d + 1); } else { const m = M(r, p); split(r, m, q, d + 1); split(m, p, q, d + 1); } };
                    split(V(A.x, A.y, A.z), V(B.x, B.y, B.z), V(C.x, C.y, C.z), 0);
                });
                // marches sans paroi au bord d'une plateforme (terrain ou talus voisin plus haut / plus bas d'un coup) : les triangles à cheval sont écartés,
                // alors on ferme la marche : une face de terre verticale au bord, et une bande qui rejoint le terrain voisin (plus de trou noir)
                if (FM) zones.forEach(Zo => { try { if (Zo.s.type !== 'poly') return; const R0 = Zo.ring, n = R0.length, t = platTalus(Zo.s), E = t.cx && t.edges ? t.edges : [], i0 = FM.P.findIndex(q => q.s === Zo.s); let A2 = 0;
                    for (let k = 0; k < n; k++) { const a = R0[k], b = R0[(k + 1) % n]; A2 += a.x * b.y - b.x * a.y; } const sg = A2 > 0 ? -1 : 1, eps = mmToWorld(30), w = Math.max(step * 2, mmToWorld(400)), T3 = (A, B, C) => { if (nat) pushN([A, B, C]); else [A, B, C].forEach(push); };
                    for (let k = 0; k < n; k++) { const off = !!(E[k] && E[k].off), a = R0[k], b = R0[(k + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
                        // arête en paroi : seulement la bande de terrain contre la face extérieure du voile (le voile fait la marche)
                        const nx = -(b.y - a.y) / L * sg, ny = (b.x - a.x) / L * sg, m = Math.max(1, Math.ceil(L / mmToWorld(250))), o0 = off ? mmToWorld(E[k].pe || 200) : eps; let prev = null;
                        for (let j = 0; j <= m; j++) { const f = j / m, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, ri = FM.at(x - nx * eps, y - ny * eps), ro = FM.at(x + nx * o0 * 1.2, y + ny * o0 * 1.2), rf = FM.at(x + nx * w, y + ny * w);
                            let cur = null; if (ri && ro && rf && ri.kind === 1 && ri.gov === i0 && ro.kind !== 1 && rf.kind !== 1 && (off || Math.abs(ro.z - ri.z) > 150)) { const kk = ro.kind === 4 ? (ro.z > ri.z ? 2 : 3) : (ro.kind || (off ? 0 : ro.z > ri.z ? 3 : 2));
                                // la bande vers le terrain est découpée tous les ~40 cm : chaque morceau prend la nature du sol fini à sa place (talus ou terrain),
                                // sinon un grand triangle qui touche le talus devenait tout entier « terre »
                                const R = [[x + nx * o0, y + ny * o0, ro.z, kk]], K = Math.min(16, Math.max(1, Math.ceil((w - o0) / mmToWorld(400))));
                                for (let j = 1; j <= K; j++) { const d = o0 + (w - o0) * j / K, px = x + nx * d, py = y + ny * d, q = j === K ? rf : FM.at(px, py); if (!q) break; R.push([px, py, q.z, q.kind === 4 ? (q.z > ri.z ? 2 : 3) : q.kind === 1 ? 0 : q.kind]); }
                                cur = { x, y, zi: ri.z, zo: ro.z, k: kk, R }; }
                            if (cur && prev) { const V = (q, z) => [q.x, q.y, z, q.k], T = (A, B, C) => { if (nat) pushN([A, B, C]); else [A, B, C].forEach(push); };
                                if (!off) { T(V(prev, prev.zi), V(cur, cur.zi), V(cur, cur.zo)); T(V(prev, prev.zi), V(cur, cur.zo), V(prev, prev.zo)); }
                                const K = Math.min(prev.R.length, cur.R.length) - 1; for (let j = 0; j < K; j++) { const a0 = prev.R[j], a1 = prev.R[j + 1], b0 = cur.R[j], b1 = cur.R[j + 1]; T(a0, b0, b1); T(a0, b1, a1); } }
                            prev = cur; } }
                    // angles saillants : un éventail de terrain entre les deux bandes (sinon un petit trou au pied de l'angle)
                    for (let k = 0; k < n; k++) { const kp = (k - 1 + n) % n, V0 = R0[k], A = R0[kp], B = R0[(k + 1) % n], L1 = Math.hypot(V0.x - A.x, V0.y - A.y), L2 = Math.hypot(B.x - V0.x, B.y - V0.y); if (L1 < 1e-9 || L2 < 1e-9) continue;
                        const n1 = { x: -(V0.y - A.y) / L1 * sg, y: (V0.x - A.x) / L1 * sg }, n2 = { x: -(B.y - V0.y) / L2 * sg, y: (B.x - V0.x) / L2 * sg }; if (pointInPolygon(V0.x + (n1.x + n2.x) * eps, V0.y + (n1.y + n2.y) * eps, R0)) continue;
                        const ri = FM.at(V0.x - (n1.x + n2.x) * eps, V0.y - (n1.y + n2.y) * eps); if (!ri || ri.kind !== 1 || ri.gov !== i0) continue;
                        const o0 = (E[kp] && E[kp].off) || (E[k] && E[k].off) ? mmToWorld(Math.max((E[kp] && E[kp].off && E[kp].pe) || 200, (E[k] && E[k].off && E[k].pe) || 200)) : eps, a1 = Math.atan2(n1.y, n1.x); let da = Math.atan2(n2.y, n2.x) - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) < 0.05) continue;
                        const m = Math.max(2, Math.ceil(Math.abs(da) / 0.2)), pt = (an, r) => { const x = V0.x + Math.cos(an) * r, y = V0.y + Math.sin(an) * r, q = FM.at(x, y); return q && q.kind !== 1 ? [x, y, q.z, q.kind === 4 ? (q.z > ri.z ? 2 : 3) : q.kind] : null; };
                        const K = Math.min(16, Math.max(1, Math.ceil((w - o0) / mmToWorld(400)))), rad = (an) => { const out = []; for (let j = 0; j <= K; j++) { const q = pt(an, o0 + (w - o0) * j / K); if (!q) break; out.push(q); } return out; };
                        let pr = null; for (let j = 0; j <= m; j++) { const cr = rad(a1 + da * j / m); if (pr) { const L = Math.min(pr.length, cr.length) - 1; for (let r = 0; r < L; r++) { T3(pr[r], cr[r], cr[r + 1]); T3(pr[r], cr[r + 1], pr[r + 1]); } } pr = cr; } } } catch (e) { console.error(e); } });
                if (pp.length) {
                    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); g.computeVertexNormals();
                    root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
                }
                if (wp.length) { const gw = new THREE.BufferGeometry(); gw.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); root.add(new THREE.LineSegments(gw, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }))); }
                { let mA = 0; for (let i = 0; i + 8 < ep.length; i += 9) { const A = Math.abs((ep[i + 3] - ep[i]) * (ep[i + 7] - ep[i + 1]) - (ep[i + 6] - ep[i]) * (ep[i + 4] - ep[i + 1])) / 2; if (A > mA) mA = A; } V3.terrStats = { budget: refBudget, tris: (pp.length + gp.length + ep.length + ap.length) / 9, epMaxA: mA, step: mOf(step), road: ap.length / 9 }; }   // contrôle (tests)
                [[gp, 'pelouse', 4], [ep, 'terre', 2], [ap, 'enrobe', 3]].forEach(([arr, id, tile]) => { if (!arr.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
                    const m = texMaterial(id); if (m) { m.polygonOffset = true; m.polygonOffsetFactor = id === 'enrobe' ? -2 : 1; m.polygonOffsetUnits = id === 'enrobe' ? -2 : 1; }   /* l'enrobé passe devant le fond de carte drapé */ const G = texGeometry(g, tile), bgs = V3.hq ? vis.filter(isBg) : null;
                    if (V3.hq) { v3SmoothNormals(G, 40); if (id === 'pelouse' && m && v3GrassTint(G, bgs)) m.vertexColors = true; }   // rendu : terrain lissé, pelouse à la teinte de la photo du fond
                    root.add(new THREE.Mesh(G, m || new THREE.MeshLambertMaterial({ color: id === 'terre' ? 0x7a5a3a : id === 'enrobe' ? 0x3f3f46 : 0x4f7a2e, side: THREE.DoubleSide })));
                    if (V3.hq && id === 'pelouse') try { v3Grass3D(root, arr, bgs, gk, drapeBg); } catch (e) { console.error(e); }
                    if (V3.hq && id === 'terre') try { v3Earth3D(root, arr); } catch (e) { console.error(e); } });
                // fonds de carte drapés : l'image suit le relief du terrain naturel ; plateformes et talus gardent leur aspect
                if (tp && tp.length) bgDrape.forEach(({ s: b, tex }) => {
                    const W = b.type === 'basemap' ? 2 * b.r : b.w, Hb = b.type === 'basemap' ? 2 * b.r : b.h, R = Math.hypot(W, Hb) / 2, pp2 = [], uv = [], k = tex.k;
                    for (let t = 0; t + 2 < tp.length; t += 3) { const T = [tp[t], tp[t + 1], tp[t + 2]];
                        if (T.every(v => Math.abs(v[0] - b.x) > R) || T.every(v => Math.abs(v[1] - b.y) > R)) continue;
                        const L = T.map(v => bgLocal(b, v[0], v[1])); if (L.every(l => l.x < -W / 2) || L.every(l => l.x > W / 2) || L.every(l => l.y < -Hb / 2) || L.every(l => l.y > Hb / 2)) continue;
                        T.forEach((v, i) => { const q = P(v[0], v[1]); pp2.push(q.x, q.y, Zm(v[2])); uv.push(k + (1 - 2 * k) * (L[i].x / W + 0.5), 1 - (k + (1 - 2 * k) * (L[i].y / Hb + 0.5))); }); }
                    if (!pp2.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp2, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
                    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex.t, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.renderOrder = 1; m.userData.drape = b; root.add(m); });
            }
            // volumes : maillages, solides, balayages, murs (géométrie commune objGeom3D)
            vis.filter(is3DObj).forEach(o => { try {   /* un objet abîmé n'empêche pas la vue 3D */
                const g = objGeom3D(o, P, Zm, exag, ext); if (!g) return;
                const col = o.wallMat ? ((WALL_MATS[o.wallMat] || {}).fill || effectiveColor(o, false)) : effectiveColor(o, false);
                const TX = o.tex && TEX_LIB.find(t => t.id === o.tex), tm = TX ? texMaterial(o.tex) : null;
                let m = tm ? new THREE.Mesh(texGeometry(g, TX.tile), tm) : new THREE.Mesh(g, new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(col), side: THREE.DoubleSide }, o.solid ? { transparent: true, opacity: 0.92 } : {})));
                if (o.solid && o.solid.kind === 'roof' && o.texU && g.groups && g.groups.length === 2) {   // sous-face de l'avancée : sa propre texture
                    const TU = TEX_LIB.find(t => t.id === o.texU), mu = TU ? texMaterial(o.texU) : null;
                    if (mu) { const gg = texGeometry(g, TX ? TX.tile : TU.tile); m = new THREE.Mesh(gg, [tm || m.material, mu]); } }
                if (o.ftex && o.wallMat && Object.keys(o.ftex).length) { try { m = wallFaceMesh(o, g, m.material, P); } catch (e) {} }   /* chaque face sa texture */
                if (tm && selectedShapes.includes(o)) tm.emissive = new THREE.Color(0x5b1840);
                m.userData.shape = o; root.add(m);
                let eg = o.wallMat ? wallEdges3D(o, P, Zm, exag) : null; if (!eg) { eg = new THREE.EdgesGeometry(g, 30); if (o.wallMat || o.csg || o.type === 'mesh') eg = flatEdgesClean(g, eg); }
                if (o.type !== 'mesh') { const ls = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: o.sweep ? 0.45 : 0.55 })); ls.userData.edgeOf = o; root.add(ls); }
                { const a = eg.attributes.position.array; if (a.length < 60000) for (let i = 0; i < a.length; i += 6) { snap(a[i], a[i + 1], a[i + 2], 'end'); snap(a[i + 3], a[i + 4], a[i + 5], 'end'); snap((a[i] + a[i + 3]) / 2, (a[i + 1] + a[i + 4]) / 2, (a[i + 2] + a[i + 5]) / 2, 'mid'); } }
            } catch (e) { mcIncident(e, '3D : ' + (o.name || o.type)); } });
            // menuiseries : cadre, vitrage des fenêtres, vantail des portes, dans chaque ouverture
            try { const seen = new Set(); vis.filter(x => isWallHatch(x) && is3DObj(x)).forEach(w => wallOpeningsFor(w).forEach(o => { if (seen.has(o) || !o.pts || opHidden(o)) return; seen.add(o); joinery3D(root, w, o, P, Zm, exag); })); } catch (e) { console.error(e); }
            // plateformes : dalle plane à leur cote (bord net)
            zones.forEach(Zo => {
                let gm;
                if (Zo.S && !Zo.S.flat) {   // plateforme inclinée : ses triangles, Z exacts aux sommets
                    const pos = []; Zo.S.tris.forEach(t => t.pts.forEach(v => { const r = P(v.x, v.y); pos.push(r.x, r.y, Zm(v.z)); }));
                    gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gm.computeVertexNormals();
                } else { const shp = new THREE.Shape((Zo.ringR && structThick(structOf(Zo.s)) > 0 ? Zo.ringR : Zo.ring).map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); }));   // structure : elle couvre aussi le recul
                    // fosse : plateforme plus basse dessinée dedans → trou dans la dalle, jusqu'au haut de son talus de déblai
                    const io = FM.P.indexOf(Zo);
                    const fos = (Zq, iq) => iq > io && Zq.S.zmax < Zo.zp - 0.5 && Zq.ring.every(q => pointInPolygon(q.x, q.y, Zo.ring));
                    FM.P.forEach((Zq, iq) => { if (!fos(Zq, iq)) return;
                        // fosse dans une fosse (bassin à deux fonds) : seule la plus grande perce la dalle, sinon deux trous qui se chevauchent cassent la triangulation
                        if (FM.P.some((Zr, ir) => Zr !== Zq && fos(Zr, ir) && Zq.ring.every(q => pointInPolygon(q.x, q.y, Zr.ring)))) return;
                        // trou = haut du talus de la fosse : son contour décalé de la largeur du talus (un pied de talus brut, fait de rayons, se recoupe et faisait de grands triangles parasites)
                        let loop = Zq.ring; try { const d = mmToWorld(Math.max(0, Zo.zp - Zq.S.zmax) * (Zq.kD || 1)), L = d > 0 ? polyOffsetPts(Zq.ring, d, true) : null; if (L && L.length > 2 && L.every(q => pointInPolygon(q.x, q.y, Zo.ring)) && !polySelfX(L)) loop = L; } catch (e) {}
                        shp.holes.push(new THREE.Path(loop.map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); }))); });
                gm = new THREE.ShapeGeometry(shp); gm.translate(0, 0, Zm(Zo.zp)); }
                { const nm = v3Nat() ? texMaterial(structThick(structOf(Zo.s)) > 0 ? 'gnt' : 'pelouse') : null;   // structure prévue (fond de forme…) : grave claire, sinon herbe if (nm) { nm.polygonOffset = true; nm.polygonOffsetFactor = -2; nm.polygonOffsetUnits = -2; }
                  root.add(nm ? new THREE.Mesh(texGeometry(gm, structThick(structOf(Zo.s)) > 0 ? 1.5 : 4), nm) : new THREE.Mesh(gm, new THREE.MeshLambertMaterial({ color: 0xd6d3d1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))); }
            });
            // parois (arêtes « paroi » du réglage par arête) : un voile béton fin contre le terrain, du fond de fouille jusqu'un peu au-dessus du terrain
            zones.forEach(Zo => { try { const t = platTalus(Zo.s); if (!t.edges || Zo.s.type !== 'poly') return; const R0 = Zo.ring, n = R0.length; let A2 = 0; for (let k = 0; k < n; k++) { const a = R0[k], b = R0[(k + 1) % n]; A2 += a.x * b.y - b.x * a.y; } const sg = A2 > 0 ? -1 : 1, ep = mmToWorld(200), pp = [];
                const off = R0.map((q, k) => !!(t.edges[k] && t.edges[k].off)); if (!off.some(Boolean)) return; const myI = FM.P.indexOf(Zo); const PCk = !!(window.polygonClipping && window.polygonClipping.union), segAll = [];
                // suites d'arêtes en paroi consécutives : un seul voile continu, angles en onglet
                const runs = []; if (off.every(Boolean)) runs.push({ ks: R0.map((q, k) => k), closed: true });
                else { const st = off.findIndex((v, k) => !v); let cur = null; for (let j = 1; j <= n; j++) { const k = (st + j) % n; if (!off[k]) { if (cur) runs.push(cur); cur = null; continue; } if (!cur) cur = { ks: [], closed: false }; cur.ks.push(k); } if (cur) runs.push(cur); }
                const nOf = (k) => { const a = R0[k], b = R0[(k + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / L * sg, y: (b.x - a.x) / L * sg }; }, epOf = (k) => mmToWorld((t.edges[k] && t.edges[k].pe) || 200);
                runs.forEach(run => { const ks = run.ks, m0 = ks.length, S2 = [];
                    // face extérieure : décalage de l'épaisseur, raccord en onglet aux sommets intérieurs de la suite
                    const vOff = (j) => { const kPrev = run.closed ? ks[(j - 1 + m0) % m0] : j > 0 ? ks[j - 1] : null, kNext = run.closed ? ks[j % m0] : j < m0 ? ks[j] : null;
                        const n1 = kPrev !== null ? nOf(kPrev) : null, n2 = kNext !== null ? nOf(kNext) : null, e1 = kPrev !== null ? epOf(kPrev) : 0, e2 = kNext !== null ? epOf(kNext) : 0; if (!n1) return { x: n2.x * e2, y: n2.y * e2 }; if (!n2) return { x: n1.x * e1, y: n1.y * e1 };
                        // point où se croisent les deux faces extérieures (épaisseurs différentes possibles)
                        const det = n1.x * n2.y - n1.y * n2.x; if (Math.abs(det) < 1e-6) return { x: n1.x * e1, y: n1.y * e1 }; const o = { x: (e1 * n2.y - e2 * n1.y) / det, y: (n1.x * e2 - n2.x * e1) / det }, lo = Math.hypot(o.x, o.y), mx = 4 * Math.max(e1, e2); return lo > mx ? { x: o.x * mx / lo, y: o.y * mx / lo } : o; };
                    for (let j = 0; j < m0; j++) { const k = ks[j], a = R0[k], b = R0[(k + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y), nn = nOf(k), oa = vOff(j), ob = vOff(j + 1), m = Math.max(1, Math.ceil(L / mmToWorld(1000))), za = hasZ(a.z) ? a.z : Zo.zp, zb2 = hasZ(b.z) ? b.z : Zo.zp;
                        for (let q = (j === 0 ? 0 : 1); q <= m; q++) { const f = q / m, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, ox = oa.x + (ob.x - oa.x) * f, oy = oa.y + (ob.y - oa.y) * f, zp2 = za + (zb2 - za) * f;
                            // terrain de l'autre côté : pris au-delà de la face extérieure (le long de l'onglet aux angles rentrants, sinon on retombe sur la plateforme)
                            const zAt = (px, py) => { const r = FM.at(px, py); return r && hasZ(r.z) ? r.z : tinZ(px, py, FM.tin); }, z1 = zAt(x + nn.x * epOf(k) * 1.5, y + nn.y * epOf(k) * 1.5), z2 = zAt(x + ox * 1.5, y + oy * 1.5), zo = hasZ(z1) && hasZ(z2) ? Math.min(z1, z2) : hasZ(z1) ? z1 : z2;
                            const lo = Math.min(zp2, hasZ(zo) ? zo : zp2), hi = Math.max(zp2, hasZ(zo) ? zo : zp2); const tnO = tinZ(x + nn.x * epOf(k) * 1.5, y + nn.y * epOf(k) * 1.5, FM.tin); S2.push({ x, y, ox, oy, zb: lo - 300, hi, lo, zp: zp2, tnO, k, k2: q === m && (run.closed || j + 1 < m0) ? ks[(j + 1) % m0] : null, cov: paroiCovered(FM, myI, R0, x, y, nn.x, nn.y, zp2) }); } }   // cov : sous une autre plateforme (celle du dessus) : pas de voile
                    // arase horizontale : le voile tient la marche la plus haute de la suite (un peu au-dessus), pas un sommet qui suit le terrain
                    const SV = S2.filter(A => !A.cov); if (!SV.length) return; const zt = Math.max(Math.max(...SV.map(A => A.hi)) + 150, Math.min(...SV.map(A => A.lo)) + 500), zt2 = Math.ceil(zt / 50) * 50;
                    // haut de la paroi, arête par arête : horizontal automatique (zt2), à une cote finie, ou au terrain naturel (le niveau coupé, jamais sous la plateforme)
                    const topOf = (k, A) => { const pz = t.edges[k] && t.edges[k].pz; if (pz && pz.m === 'fini' && hasZ(pz.z)) return pz.z; if (pz && pz.m === 'tn') return Math.max(A.zp, hasZ(A.tnO) ? A.tnO : A.zp); return zt2; };
                    S2.forEach(A => { A.zt = Math.max(A.zb + 100, A.k2 !== null && A.k2 !== undefined ? Math.max(topOf(A.k, A), topOf(A.k2, A)) : topOf(A.k, A)); });
                    const Q = (A, o, z) => { const r = P(A.x + (o ? A.ox : 0), A.y + (o ? A.oy : 0)); return [r.x, r.y, Zm(z)]; }, quad = (A, B, C, D) => pp.push(...A, ...B, ...C, ...A, ...C, ...D);
                    const N = S2.length, last = run.closed ? N : N - 1;
                    const cap = (A) => quad(Q(A, 0, A.zb), Q(A, 1, A.zb), Q(A, 1, A.zt), Q(A, 0, A.zt));
                    for (let j = 0; j < last; j++) { const A = S2[j], B = S2[(j + 1) % N]; if (A.cov || B.cov) { if (A.cov !== B.cov && !PCk) cap(A.cov ? B : A); continue; }
                        if (PCk) { segAll.push([A, B]); continue; }   // voile propre : emprise réunie plus bas (angles et retours épais sans chevauchement)
                        quad(Q(A, 0, A.zb), Q(B, 0, B.zb), Q(B, 0, B.zt), Q(A, 0, A.zt)); quad(Q(A, 1, A.zb), Q(B, 1, B.zb), Q(B, 1, B.zt), Q(A, 1, A.zt)); quad(Q(A, 0, A.zt), Q(B, 0, B.zt), Q(B, 1, B.zt), Q(A, 1, A.zt)); quad(Q(A, 0, A.zb), Q(B, 0, B.zb), Q(B, 1, B.zb), Q(A, 1, A.zb)); }
                    if (!run.closed && !PCk) [S2[0], S2[N - 1]].forEach(A => { if (!A.cov) cap(A); }); });
                // emprise du voile = réunion des tronçons (face intérieure + face extérieure en onglet) ; hauts et bas repris du tronçon le plus proche
                if (PCk && segAll.length) { const PCx = window.polygonClipping, ring = (A, B) => { const r = [[A.x, A.y], [B.x, B.y], [B.x + B.ox, B.y + B.oy], [A.x + A.ox, A.y + A.oy]]; let ar = 0; for (let i = 0; i < 4; i++) { const u = r[i], v = r[(i + 1) % 4]; ar += u[0] * v[1] - v[0] * u[1]; } if (ar < 0) r.reverse(); r.push(r[0]); return [r]; };
                    let U = null; try { U = PCx.union(...segAll.map(([A, B]) => ring(A, B))); } catch (e) { U = null; }
                    const zAtV = (x, y) => { let best = null, bd = Infinity; segAll.forEach(([A, B]) => { const ax = A.x + A.ox / 2, ay = A.y + A.oy / 2, bx = B.x + B.ox / 2, by = B.y + B.oy / 2, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-12, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)), d = Math.hypot(x - ax - vx * t, y - ay - vy * t); if (d < bd) { bd = d; best = { zb: A.zb + (B.zb - A.zb) * t, zt: A.zt + (B.zt - A.zt) * t }; } }); return best; };
                    const dens = (r) => { const o = [], st = mmToWorld(500); r.forEach((q, i) => { const q2 = r[(i + 1) % r.length], L = Math.hypot(q2[0] - q[0], q2[1] - q[1]), m = Math.max(1, Math.ceil(L / st)); for (let k = 0; k < m; k++) o.push([q[0] + (q2[0] - q[0]) * k / m, q[1] + (q2[1] - q[1]) * k / m]); }); return o; };   // la réunion efface les points alignés : on en remet, pour que hauts et bas suivent le terrain
                    if (U) U.forEach(pg => { const rings = pg.map(r => dens(r.slice(0, -1))).filter(r => r.length >= 3); if (!rings.length) return; const Z = rings.map(r => r.map(([x, y]) => zAtV(x, y))), V = rings.map(r => r.map(([x, y]) => P(x, y)));
                        const tris = THREE.ShapeUtils.triangulateShape(V[0].map(q => new THREE.Vector2(q.x, q.y)), V.slice(1).map(h => h.map(q => new THREE.Vector2(q.x, q.y)))), flat = [].concat(...V), fz = [].concat(...Z);
                        tris.forEach(([a, b, c]) => { pp.push(flat[a].x, flat[a].y, Zm(fz[a].zt), flat[b].x, flat[b].y, Zm(fz[b].zt), flat[c].x, flat[c].y, Zm(fz[c].zt)); pp.push(flat[c].x, flat[c].y, Zm(fz[c].zb), flat[b].x, flat[b].y, Zm(fz[b].zb), flat[a].x, flat[a].y, Zm(fz[a].zb)); });
                        V.forEach((R, ri) => R.forEach((q, i) => { const j = (i + 1) % R.length, r2 = R[j], za = Z[ri][i], zb_ = Z[ri][j]; pp.push(q.x, q.y, Zm(za.zb), r2.x, r2.y, Zm(zb_.zb), r2.x, r2.y, Zm(zb_.zt), q.x, q.y, Zm(za.zb), r2.x, r2.y, Zm(zb_.zt), q.x, q.y, Zm(za.zt)); })); }); }
                if (!pp.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.computeVertexNormals();
                const pt = Zo.s.paroiTex && !v3Flat ? Zo.s.paroiTex : v3Nat() ? 'beton-banche' : null, tm = pt ? texMaterial(pt) : null; const me = new THREE.Mesh(tm ? texGeometry(g, pt === 'beton-banche' ? 2.4 : (TEX_LIB.find(x => x.id === pt) || {}).tile || 1) : g, tm || new THREE.MeshLambertMaterial({ color: 0xb8b6ae, side: THREE.DoubleSide })); me.userData.paroi = true; me.userData.paroiOf = Zo.s; root.add(me);
                if (!v3Flat) root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.5 })));
            } catch (e) { console.error(e); } });
            // talus en escalier (réglage par arête) : marches posées sur la pente, du bord de la plateforme jusqu'au pied
            zones.forEach(Zo => { try { const G = platTalus(Zo.s).on ? talusGeom(Zo.s) : null; if (!G || !(G.stairs || []).length) return;
                G.stairs.forEach(S => { const pp = [], h = S.st.h, at = (f, d) => { const r = P(S.a.x + (S.b.x - S.a.x) * f + S.u.x * d, S.a.y + (S.b.y - S.a.y) * f + S.u.y * d); return [r.x, r.y]; };
                    const V = (f, d, z) => [...at(f, d), Zm(z)], quad = (A, B, C, D) => pp.push(...A, ...B, ...C, ...A, ...C, ...D), tri = (A, B, C) => pp.push(...A, ...B, ...C);
                    S.pieces.forEach((p, k) => { if (!p.Ns) return; const pv = S.pieces[k - 1], nx = S.pieces[k + 1];
                        for (let j = 0; j < p.Ns; j++) { const d0 = p.s0 + j * S.gW, d1 = d0 + S.gW, sec = p.rem ? [[d0, p.zc - j * h], [d1, p.zc - j * h], [d1, p.zc - (j + 1) * h]] : [[d0, p.zc + j * h], [d0, p.zc + (j + 1) * h], [d1, p.zc + (j + 1) * h]];
                            const A = sec.map(([d, z]) => V(p.f0, d, z)), B = sec.map(([d, z]) => V(p.f1, d, z));
                            quad(A[0], B[0], B[1], A[1]); quad(A[1], B[1], B[2], A[2]);
                            if (!pv || pv.Ns <= j) tri(A[0], A[1], A[2]); if (!nx || nx.Ns <= j) tri(B[0], B[1], B[2]); } });
                    if (!pp.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.computeVertexNormals();
                    const mid = S.st.mat || 'beton', tm = v3Nat() ? texMaterial(mid) : null, me = new THREE.Mesh(tm ? texGeometry(g, (TEX_LIB.find(x => x.id === mid) || {}).tile || 1) : g, tm || new THREE.MeshLambertMaterial({ color: 0xc8c4bb, side: THREE.DoubleSide }));
                    if (me.material) me.material.side = THREE.DoubleSide; me.userData.talStair = true; root.add(me);
                    if (!v3Flat) root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.45 }))); });
            } catch (e) { console.error(e); } });
            // remblai périphérique : la fouille refermée jusqu'au niveau fini. Dessus plan au niveau fini, contour lissé :
            // bord intérieur = bord de la plateforme, bord extérieur = ligne où le talus de déblai atteint le niveau fini (interpolée entre les nœuds de la grille)
            if (FM && (document.getElementById('v3-rp') || {}).checked) zones.forEach(Zo => { try {
                const i = FM.P.indexOf(Zo), s0 = Zo.s; if (i < 0 || !cubRPon(s0) || rpMode(s0) === 'tn') return;   /* au terrain naturel : c'est le terrain lui-même qui revient (zFini) */
                const t = platTalus(s0), EX = t.cx && t.edges && s0.type === 'poly' ? t.edges : null, zf0 = s0.cubRP && hasZ(s0.cubRP.z) ? s0.cubRP.z : undefined, b = Zo.bb, ring = Zo.ring;
                const zfAt = rpZfAt(EX, ring, zf0);
                const mode = rpMode(s0); let bE = b;
                if (mode === 'fini') { let zM = -Infinity, tM = Infinity; ring.forEach(q => { const z = zfAt(q.x, q.y); if (hasZ(z)) zM = Math.max(zM, z); }); FM.tin.nodes.forEach(nd => { tM = Math.min(tM, nd.z); }); if (zM > tM) { const mg = mmToWorld(zM - tM) + mmToWorld(200); bE = { x0: b.x0 - mg, y0: b.y0 - mg, x1: b.x1 + mg, y1: b.y1 + mg }; } }
                const cell = Math.max(Math.sqrt((bE.x1 - bE.x0) * (bE.y1 - bE.y0) / 60000), mmToWorld(40)), nx = Math.ceil((bE.x1 - bE.x0) / cell), ny = Math.ceil((bE.y1 - bE.y0) / cell);
                const DG = mode === 'fini' ? rpDistGrid(FM, i, bE.x0, bE.y0, nx + 1, ny + 1, cell, zfAt) : null;
                // pour chaque nœud : g > 0 dans le remblai ; zf = dessus du remblai (cote finie, terrain naturel, ou talus 1/1 au-delà de la fouille)
                const NV = []; for (let a = 0; a <= nx; a++) { const col = []; for (let c = 0; c <= ny; c++) { const x = bE.x0 + a * cell, y = bE.y0 + c * cell; let zf = zfAt(x, y);
                    const inside = pointInPolygon(x, y, ring), d = (inside ? -1 : 1) * mOf(distToPoly(x, y, ring)); let g = d;
                    if (!inside) { const r = FM.at(x, y), k = a * (ny + 1) + c;
                        const mA = rpModeAt(EX, ring, x, y, mode), zt = mA === 'tn' ? null : rpTop(FM, i, x, y, r, zfAt, mA);
                        if (mA !== 'tn' && r && r.gov === i && (r.kind === 3 || hasZ(zt))) { zf = zt; g = Math.min(hasZ(zf) ? (zf - r.z) / 1000 : -0.3, d); }
                        else if (DG && DG.st[k] === 0 && isFinite(DG.Z[k]) && r && hasZ(r.tn)) { zf = DG.Z[k]; g = (zf - r.tn) / 1000; }
                        else g = -0.3; }
                    col.push({ x, y, g, zf }); } NV.push(col); }
                const pp = [], V = (q) => { const r = P(q.x, q.y); return [r.x, r.y, Zm(q.zf)]; };
                const lerp = (A, B) => { const f = A.g / (A.g - B.g); return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, zf: hasZ(A.zf) && hasZ(B.zf) ? A.zf + (B.zf - A.zf) * f : (A.zf || B.zf) }; };
                for (let a = 0; a < nx; a++) for (let c = 0; c < ny; c++) {
                    const Q = [NV[a][c], NV[a + 1][c], NV[a + 1][c + 1], NV[a][c + 1]]; if (Q.every(q => q.g <= 0)) continue; const poly = [];
                    for (let k = 0; k < 4; k++) { const A = Q[k], B = Q[(k + 1) % 4]; if (A.g > 0) poly.push(A); if ((A.g > 0) !== (B.g > 0)) poly.push(lerp(A, B)); }
                    for (let k = 1; k + 1 < poly.length; k++) pp.push(...V(poly[0]), ...V(poly[k]), ...V(poly[k + 1]));
                }
                // côté contre la plateforme : paroi du remblai, du haut du talus au niveau fini
                const n = ring.length, e = mmToWorld(30); let sg = 1; { const A = ring[0], B = ring[1], L = Math.hypot(B.x - A.x, B.y - A.y) || 1; if (pointInPolygon((A.x + B.x) / 2 + (B.y - A.y) / L * e, (A.y + B.y) / 2 - (B.x - A.x) / L * e, ring)) sg = -1; }
                for (let k = 0; k < n; k++) { const A = ring[k], B = ring[(k + 1) % n], L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-9) continue; const ox = (B.y - A.y) / L * e * sg, oy = -(B.x - A.x) / L * e * sg, m = Math.max(1, Math.ceil(L / cell)); let prev = null;
                    for (let j = 0; j <= m; j++) { const x = A.x + (B.x - A.x) * j / m, y = A.y + (B.y - A.y) * j / m, r = FM.at(x + ox, y + oy), mB = rpModeAt(EX, ring, x + ox, y + oy, mode), zf = mB === 'tn' ? null : rpTop(FM, i, x + ox, y + oy, r, zfAt, mB);
                        const cur = hasZ(zf) && zf > r.z ? { x, y, zb: r.z, zt: zf } : null;
                        if (cur && prev) { const p1 = P(prev.x, prev.y), p2 = P(x, y); pp.push(p1.x, p1.y, Zm(prev.zb), p2.x, p2.y, Zm(cur.zb), p2.x, p2.y, Zm(cur.zt), p1.x, p1.y, Zm(prev.zb), p2.x, p2.y, Zm(cur.zt), p1.x, p1.y, Zm(prev.zt)); }
                        prev = cur; } }
                if (!pp.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.computeVertexNormals();
                const nm = v3Nat() ? texMaterial('terre') : null; if (nm) { nm.polygonOffset = true; nm.polygonOffsetFactor = -1; nm.polygonOffsetUnits = -1; }
                const m = new THREE.Mesh(nm ? texGeometry(g, 2) : g, nm || new THREE.MeshLambertMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
                m.userData.rp = true; m.renderOrder = 2; root.add(m);
            } catch (e) { console.error(e); } });
            // fonds de carte / fonds perso au sol
            if (showBg && !v3Flat && !drapeBg) vis.filter(isBg).forEach(s => {   // sans terrain pour le porter : image posée à plat
                const img = bmImg(s.mapId); if (!img) return;
                const tex = new THREE.Texture(img); tex.needsUpdate = true;
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: s.opacity === undefined ? 1 : s.opacity, side: THREE.DoubleSide, depthWrite: false });
                const c = P(s.x, s.y); let m;
                if (s.type === 'basemap') { const r = worldToMm(s.r) / 1000; m = new THREE.Mesh(new THREE.CircleGeometry(r, 96), mat); ext({ x: c.x - r, y: c.y - r }); ext({ x: c.x + r, y: c.y + r }); }
                else m = new THREE.Mesh(new THREE.PlaneGeometry(worldToMm(s.w) / 1000, worldToMm(s.h) / 1000), mat);
                m.position.set(c.x, c.y, -0.02 * V3.R / 50); m.rotation.z = -(s.rot || 0); m.renderOrder = -1; root.add(m);
            });
            // objets sélectionnés : surlignés en rose
            root.traverse(o => { if (o.isMesh && o.userData.shape && selectedShapes.includes(o.userData.shape) && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.set(0x9d174d); } });
            if (v3Flat && FM) zones.forEach(Zo => {   // façade / iso du plan : contour des plateformes et pied des talus en traits
                const L = []; const ring = Zo.ring; for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length], A2 = P(a.x, a.y), B2 = P(b.x, b.y); L.push(A2.x, A2.y, Zm(hasZ(a.z) ? a.z : Zo.zp), B2.x, B2.y, Zm(hasZ(b.z) ? b.z : Zo.zp)); }
                try { const G = talusGeom(Zo.s); if (G) (G.parts || []).forEach(pt => { for (let k = 1; k < pt.length; k++) { const a = P(pt[k - 1].x, pt[k - 1].y), b = P(pt[k].x, pt[k].y); L.push(a.x, a.y, Zm(pt[k - 1].z), b.x, b.y, Zm(pt[k].z)); } }); } catch (e) {}
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial()); ls.userData.edgeOf = Zo.s; root.add(ls); });
            if (v3Flat) planWire3D(root);
            V3.scene.add(root); V3.snaps = [...SN.values()].slice(0, 30000); if (V3.cut) v3CutCaps(); if (typeof EC !== 'undefined' && EC && EC.g3) { try { ecAttach3D(); } catch (e) { console.error(e); } }   // test d'écoulement : l'eau et la pluie suivent la scène
            try { v3BrushBuild(); } catch (e) { console.error(e); }
            if (V3.tmp) V3.tmp.position.copy(root.position);
            if (D3C.lines.length) setTimeout(d3ClBuild, 0);
            if (V3.col) V3.col.position.copy(root.position);
            document.getElementById('v3-info').textContent = (zs.length ? 'Altitudes ' + zmin.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' → ' + zmax.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' m · aberration ×' + exag + (zones.length && exag > 1 ? ' (talus vus ' + exag + '× plus raides : ×1 = pentes réelles)' : '') + ' · ' : 'Aucune altitude Z dans le plan · ') + 'Glisser : tourner · Clic droit : déplacer · Molette : zoom · œil 3D ou Échap : plan 2D';
        }
        // Triangulation de Delaunay (Bowyer-Watson), longs triangles de bord retirés
        function delaunay(pts) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            const d = Math.max(maxX - minX, maxY - minY) * 20 || 1, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
            const P = pts.map(p => ({ x: p.x - mx, y: p.y - my }));
            const n = P.length; P.push({ x: -d, y: -d }, { x: d, y: -d }, { x: 0, y: d });
            const circ = (a, b, c) => {
                const A = P[a], B = P[b], C = P[c], D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
                if (Math.abs(D) < 1e-12) return { x: 0, y: 0, r2: Infinity };
                const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
                const x = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D, y = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
                return { x, y, r2: (A.x - x) ** 2 + (A.y - y) ** 2 };
            };
            let tris = [[n, n + 1, n + 2, circ(n, n + 1, n + 2)]];
            for (let i = 0; i < n; i++) {
                const p = P[i], bad = [], keep = [];
                tris.forEach(t => ((p.x - t[3].x) ** 2 + (p.y - t[3].y) ** 2 < t[3].r2 ? bad : keep).push(t));
                const edges = new Map();
                bad.forEach(t => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(([a, b]) => { const k = a < b ? a + ',' + b : b + ',' + a; edges.set(k, edges.has(k) ? null : [a, b]); }));
                edges.forEach(e => { if (e) keep.push([e[0], e[1], i, circ(e[0], e[1], i)]); });
                tris = keep;
            }
            tris = tris.filter(t => t[0] < n && t[1] < n && t[2] < n);
            const len = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);
            const longest = tris.map(t => Math.max(len(t[0], t[1]), len(t[1], t[2]), len(t[2], t[0])));
            const sorted = longest.slice().sort((u, v) => u - v), area3 = (t) => Math.abs((P[t[1]].x - P[t[0]].x) * (P[t[2]].y - P[t[0]].y) - (P[t[2]].x - P[t[0]].x) * (P[t[1]].y - P[t[0]].y)) / 2;
            // longueur typique pondérée par la surface : les lignes de rupture découpées tous les mètres font beaucoup de petits triangles, sans représenter le terrain
            // grands triangles : retirés seulement en partant du bord extérieur (le terrain épouse le contour du levé) ;
            // un grand triangle à l'intérieur (points plus espacés à cet endroit) reste : pas de trou au milieu du terrain
            const ek = (a, b) => a < b ? a * 1048576 + b : b * 1048576 + a, cnt = new Map(), alive = new Uint8Array(tris.length).fill(1);
            tris.forEach(t => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(([a, b]) => { const k = ek(a, b); cnt.set(k, (cnt.get(k) || 0) + 1); }));
            const onBorder = (t) => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].some(([a, b]) => cnt.get(ek(a, b)) === 1);
            const wl = []; tris.forEach((t, k) => { if (!onBorder(t)) wl.push([longest[k], area3(t)]); }); wl.sort((u, v) => u[0] - v[0]); const Wt = wl.reduce((a, u) => a + u[1], 0); let acc = 0, wmed = 0; for (const u of wl) { acc += u[1]; if (acc >= Wt / 2) { wmed = u[0]; break; } }
            const lim = Math.max((sorted[sorted.length >> 1] || 0) * 4, wmed * 2.5);
            let q = []; tris.forEach((t, k) => { if (longest[k] > lim && onBorder(t)) q.push(k); });
            while (q.length) { const nq = []; q.forEach(k => { if (!alive[k] || !onBorder(tris[k])) return; alive[k] = 0; const t = tris[k]; [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(([a, b]) => { const kk = ek(a, b); cnt.set(kk, cnt.get(kk) - 1); }); });
                tris.forEach((t, k) => { if (alive[k] && longest[k] > lim && onBorder(t)) nq.push(k); }); q = nq.filter(k => alive[k]); if (!nq.length) break; }
            return tris.filter((t, k) => alive[k]).map(t => [t[0], t[1], t[2]]);
        }
        function fit3D() { V3.target.set(0, 0, 0); V3.az = Math.PI * 1.25; V3.el = 0.6; V3.dist = V3.R * 2.6; }

