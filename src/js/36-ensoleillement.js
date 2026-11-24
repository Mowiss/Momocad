        // ============ ENSOLEILLEMENT : sondes posées à la main (dans une pièce ou dehors), journée simulée, horaires et courbe ============
        /* Une sonde est un point du plan (s.sonde = { id, n, h, sol }) : dans un contour de bâtiment elle est posée sur le plancher de son étage, dehors sur le sol fini
           (terrain, plateforme, terrasse). La journée est échantillonnée du lever au coucher ; à chaque pas, un rayon part de la sonde vers le soleil dans la maquette 3D
           (murs percés de leurs baies, toits, dalles, arbres, bâti voisin, relief) : touché = ombre, rien = soleil direct. Les vitrages laissent passer le soleil. */
        let solNote = null, solLastH = 1.2, SOL_PLAY = null;
        function solCfg() { const N = solNote || (solNote = {}); if (!/^\d{4}-\d\d-\d\d$/.test(N.date || '')) N.date = new Date().getFullYear() + '-03-21'; if (![1, 5, 10, 15].includes(+N.step)) N.step = 5; return N; }
        const solProbes = () => shapes.filter(s => s.sonde && s.type === 'point');
        function sondeNextName() { let k = 1; const S = new Set(solProbes().map(s => s.sonde.n)); while (S.has('S' + k)) k++; return 'S' + k; }
        function startSonde() { closeFileMenus(); setMode('sonde'); updateCommandMessage(); draw(); }
        function sondePlace(w) { const p = t2Pt(w.x, w.y), s = { type: 'point', layerId: ensureLayer('Sondes d\'ensoleillement', '#facc15'), x: p.x, y: p.y, sonde: { id: 'sd' + generateId(), n: sondeNextName(), h: solLastH } };
            const Z = bldZoneAt(p.x, p.y); if (Z) { s.bid = Z.bld.id; s.lvl = (bldActId === Z.bld.id && lvlOn ? lvlAct : Z.bld.act) || 'rdc'; }
            shapes.push(s); saveState(); draw(); updateCommandMessageText('SONDE ' + s.sonde.n + ' posée ' + (Z ? 'dans ' + (Z.bld.nm || 'le bâtiment') + ' (' + bldLvlName(Z, s.lvl) + ')' : 'dehors, sur le sol fini') + ', à ' + nfr(s.sonde.h, 2) + ' m. Cliquez la suivante, ou Échap. Σ Calculs › Soleil pour la journée.'); }
        // où est la sonde : sur le plancher de son étage (dans un bâtiment) ou sur le sol fini ; altitude du point de mesure en mm
        function sondeWhere(s) { const Z = s.bid && s.sonde.sol !== 'sol' ? bldZones().find(z => z.bld.id === s.bid) : null, L = Z && (Z.bld.lvls || []).find(l => l.id === (s.lvl || 'rdc'));
            if (L && hasZ(L.z)) return { inside: true, z: L.z + s.sonde.h * 1000, where: (Z.bld.nm || 'Bâtiment') + ' · ' + bldLvlName(Z, L.id) };
            const g = groundZAt(s.x, s.y, true); return { inside: false, z: (hasZ(g) ? g : 0) + s.sonde.h * 1000, where: 'Extérieur' + (hasZ(g) ? '' : ' (sol sans altitude)') }; }
        function drawSonde2D(c, s, X, Y, ls, sel) { const r = 7 / ls, col = sel ? '#ec4899' : '#facc15', R = (s.sonde.res || null);
            c.save(); c.setLineDash([]); c.lineWidth = 1.4 / ls; c.strokeStyle = col; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(X + Math.cos(a) * r * 1.35, Y + Math.sin(a) * r * 1.35); c.lineTo(X + Math.cos(a) * r * 1.9, Y + Math.sin(a) * r * 1.9); c.stroke(); }
            c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.fillStyle = sel ? '#831843' : '#422006'; c.fill(); c.stroke(); c.beginPath(); c.arc(X, Y, r * 0.45, 0, Math.PI * 2); c.fillStyle = col; c.fill();
            c.font = 'bold ' + (11 / ls) + 'px Arial'; c.textBaseline = 'bottom'; c.textAlign = 'center'; c.fillStyle = col; c.fillText(s.sonde.n, X, Y - r * 2); c.restore(); }
        /* ---- position du soleil (algorithme NOAA, précision de l'ordre de la minute d'arc) : élévation et azimut (depuis le nord vrai, sens horaire), en degrés ---- */
        function solPos(ms, lat, lon) { const D = Math.PI / 180, jd = ms / 864e5 + 2440587.5, T = (jd - 2451545) / 36525;
            const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T), e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
            const C = Math.sin(M * D) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * D) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * D) * 0.000289;
            const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * D), eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * D);
            const dec = Math.asin(Math.sin(eps * D) * Math.sin(lam * D)), y = Math.tan(eps * D / 2) ** 2;
            const eot = 4 / D * (y * Math.sin(2 * L0 * D) - 2 * e * Math.sin(M * D) + 4 * e * y * Math.sin(M * D) * Math.cos(2 * L0 * D) - 0.5 * y * y * Math.sin(4 * L0 * D) - 1.25 * e * e * Math.sin(2 * M * D));
            const dt = new Date(ms), mn = dt.getUTCHours() * 60 + dt.getUTCMinutes() + dt.getUTCSeconds() / 60, tst = ((mn + eot + 4 * lon) % 1440 + 1440) % 1440, ha = (tst / 4 - 180) * D, la = lat * D;
            const cz = Math.max(-1, Math.min(1, Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha))), el0 = 90 - Math.acos(cz) / D;
            const rf = el0 > -0.575 ? 1.02 / Math.tan((el0 + 10.3 / (el0 + 5.11)) * D) / 60 : 0;   /* réfraction (Bennett) : le soleil apparaît un peu plus haut près de l'horizon */
            const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / D + 180 + 360) % 360; return { el: el0 + rf, az }; }
        // heure légale française : UTC+1, UTC+2 du dernier dimanche de mars au dernier dimanche d'octobre (changement à 1 h UTC)
        function solUtcOff(ms) { const y = new Date(ms).getUTCFullYear(), last = (m) => { const d = new Date(Date.UTC(y, m + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.getTime(); }; return ms >= last(2) && ms < last(9) ? 2 : 1; }
        const solHM = (min) => { const m = Math.round(min); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
        // lieu du projet : la vraie projection du plan (Lambert 93 ou CC42…CC50), sinon un fond de carte, sinon Gap ; conv = angle du nord vrai dans le repère du plan
        function solSite() { const N = solCfg(); if (N.manual && isFinite(N.lat) && isFinite(N.lon)) return { lat: N.lat, lon: N.lon, conv: 0, src: 'saisie' };
            const S = solProbes(), c = S.length ? { x: S.reduce((a, s) => a + s.x, 0) / S.length, y: S.reduce((a, s) => a + s.y, 0) / S.length } : screenToWorld(canvas.width / 2, canvas.height / 2), X = realX(c.x) / 1000, Y = realY(c.y) / 1000;
            let P = null; if (X > 50000 && X < 1300000 && Y > 6000000 && Y < 7200000) P = lccParams('L93'); else if (X > 1000000 && X < 2400000 && Y > 1000000 && Y < 9400000) P = lccParams('CC' + Math.max(42, Math.min(50, Math.round((Y - 200000) / 1e6) + 41)));
            if (P) { const ll = lccInv(P, X, Y), a = lccFwd(P, ll.lat + 0.01, ll.lon), b = lccFwd(P, ll.lat, ll.lon); return { lat: ll.lat, lon: ll.lon, conv: Math.atan2(a.x - b.x, a.y - b.y), src: P.code === 'L93' ? 'Lambert 93' : P.code }; }
            const bm = shapes.find(x => x.type === 'basemap' && isFinite(x.lat) && isFinite(x.lon)); if (bm) return { lat: bm.lat, lon: bm.lon, conv: 0, src: 'fond de carte' };
            return { lat: 44.56, lon: 6.08, conv: 0, src: 'Gap par défaut — plan non géoréférencé, le nord est le haut du plan' }; }
        // la journée : un échantillon par pas, du lever au coucher (minutes de l'heure légale), avec élévation et azimut
        function solDay(N, site) { const [y, m, d] = N.date.split('-').map(Number), noon = Date.UTC(y, m - 1, d, 12), off = solUtcOff(noon), ms = (t) => Date.UTC(y, m - 1, d, 0, 0) + (t - off * 60) * 60000, el = (t) => solPos(ms(t), site.lat, site.lon).el;
            const cross = (a, b) => { for (let i = 0; i < 30; i++) { const c = (a + b) / 2; if ((el(a) > -0.833) === (el(c) > -0.833)) a = c; else b = c; } return (a + b) / 2; };
            let t0 = null, t1 = null; for (let t = 0; t < 1440; t += 10) { const a = el(t) > -0.833, b = el(t + 10) > -0.833; if (!a && b && t0 === null) t0 = cross(t, t + 10); if (a && !b) t1 = cross(t, t + 10); }
            const S = []; if (t0 !== null && t1 !== null) for (let t = Math.ceil(t0 / N.step) * N.step; t <= t1; t += N.step) { const p = solPos(ms(t), site.lat, site.lon); S.push({ t, el: p.el, az: p.az }); }
            return { rise: t0, set: t1, off, S, ms }; }
        // direction du soleil dans la scène 3D (x est du plan, y nord du plan, z haut)
        function solDir(p, site) { const D = Math.PI / 180, e = Math.max(p.el, 0) * D, a = p.az * D + site.conv; return { x: Math.cos(e) * Math.sin(a), y: Math.cos(e) * Math.cos(a), z: Math.sin(e) }; }
        /* ---- maquette pour les rayons : triangles qui arrêtent le soleil (tout sauf vitrages, eau, dessin du plan, sondes), rangés dans une grille au sol ---- */
        async function solScene() { await loadThree(); if (!V3) init3D(); const ex = document.getElementById('v3-exag'), ex0 = ex ? ex.value : '1';
            const back = is3DOpen() && (V3.exag !== 1 || V3.flat); if (!is3DOpen() || V3.exag !== 1 || V3.flat) { if (ex) ex.value = '1'; try { build3DScene(); } finally { if (ex) ex.value = ex0; } try { orthoKey = ''; } catch (e) {} }   /* maquette à l'échelle vraie (sans exagération des hauteurs) */
            V3.root.updateMatrixWorld(true); const T = [], v = new THREE.Vector3(), M = new THREE.Matrix4(), Mi = new THREE.Matrix4(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zmax = -Infinity;
            const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
            V3.root.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || o.userData.plan2d || o.userData.drape || o.userData.cap || o.userData.sonde || o.userData.grass || o.userData.water || !shown(o)) return;
                const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (mt && mt.transparent && mt.opacity < 0.7) return;   /* vitrage, eau : le soleil passe */
                const P = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count : P.count, inst = o.isInstancedMesh ? o.count : 1;
                for (let k = 0; k < inst; k++) { if (o.isInstancedMesh) { o.getMatrixAt(k, Mi); M.multiplyMatrices(o.matrixWorld, Mi); } else M.copy(o.matrixWorld);
                    for (let i = 0; i + 2 < n; i += 3) { for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, ix ? ix.getX(i + j) : i + j).applyMatrix4(M); T.push(v.x, v.y, v.z); if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; if (v.z > zmax) zmax = v.z; } } } });
            const tri = new Float64Array(T), nt = tri.length / 9, G = 256, cs = Math.max((x1 - x0), (y1 - y0), 1e-6) / G * 1.0001, cells = new Map();
            for (let k = 0; k < nt; k++) { const o = k * 9, ax = Math.min(tri[o], tri[o + 3], tri[o + 6]), bx = Math.max(tri[o], tri[o + 3], tri[o + 6]), ay = Math.min(tri[o + 1], tri[o + 4], tri[o + 7]), by = Math.max(tri[o + 1], tri[o + 4], tri[o + 7]);
                const i0 = Math.floor((ax - x0) / cs), i1 = Math.floor((bx - x0) / cs), j0 = Math.floor((ay - y0) / cs), j1 = Math.floor((by - y0) / cs);
                for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i * 4096 + j; let c = cells.get(key); if (!c) cells.set(key, c = []); c.push(k); } }
            const out = { tri, nt, x0, y0, cs, G, cells, zmax, stamp: new Uint32Array(nt), pass: 0, root: V3.root.position.clone(), zmin: V3.zmin || 0 }; if (back) build3DScene(); return out; }
        // le rayon touche-t-il quelque chose ? (parcours de la grille case par case, tests de triangles, arrêt dès qu'il passe au-dessus de tout)
        function solBlocked(S, O, d) { S.pass++; const { tri, x0, y0, cs, G, cells, stamp } = S, pass = S.pass, eps = 1e-4;
            const hit = (k) => { const o = k * 9, ax = tri[o], ay = tri[o + 1], az = tri[o + 2], e1x = tri[o + 3] - ax, e1y = tri[o + 4] - ay, e1z = tri[o + 5] - az, e2x = tri[o + 6] - ax, e2y = tri[o + 7] - ay, e2z = tri[o + 8] - az;
                const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) return false; const inv = 1 / det;
                const tx = O.x - ax, ty = O.y - ay, tz = O.z - az, u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return false; const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (d.x * qx + d.y * qy + d.z * qz) * inv;
                if (w < 0 || u + w > 1) return false; return (e2x * qx + e2y * qy + e2z * qz) * inv > eps; };
            let i = Math.floor((O.x - x0) / cs), j = Math.floor((O.y - y0) / cs); const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, h = Math.hypot(d.x, d.y) || 1e-9;
            const tdx = Math.abs(d.x) > 1e-12 ? cs / Math.abs(d.x) : Infinity, tdy = Math.abs(d.y) > 1e-12 ? cs / Math.abs(d.y) : Infinity;
            let tmx = Math.abs(d.x) > 1e-12 ? ((x0 + (i + (sx > 0 ? 1 : 0)) * cs) - O.x) / d.x : Infinity, tmy = Math.abs(d.y) > 1e-12 ? ((y0 + (j + (sy > 0 ? 1 : 0)) * cs) - O.y) / d.y : Infinity, t = 0;
            for (let guard = 0; guard < 4 * G + 8; guard++) { if (i >= -1 && j >= -1 && i <= G + 1 && j <= G + 1) { const c = cells.get(i * 4096 + j); if (c) for (const k of c) { if (stamp[k] === pass) continue; stamp[k] = pass; if (hit(k)) return true; } }
                else if ((sx > 0 ? i > G : i < -1) || (sy > 0 ? j > G : j < -1)) return false;
                if (O.z + d.z * t > S.zmax + 0.01) return false; if (tmx < tmy) { t = tmx; tmx += tdx; i += sx; } else { t = tmy; tmy += tdy; j += sy; } if (h < 1e-6) return false; }
            return false; }
        // position 3D (repère du monde de la scène) d'une sonde
        function solProbe3D(s, SC) { const W = sondeWhere(s), r = SC ? SC.root : V3.root.position, zm = SC ? SC.zmin : (V3.zmin || 0); return { x: worldToMm(s.x) / 1000 + r.x, y: -worldToMm(s.y) / 1000 + r.y, z: W.z / 1000 - zm + r.z, W }; }
        /* ---- calcul de la journée pour toutes les sondes ---- */
        async function solRun() { const N = solCfg(), P = solProbes(); if (!P.length) { updateCommandMessageText('ENSOLEILLEMENT : posez d\'abord une sonde (palette Bâtiment, outil Sonde).'); return null; }
            const site = solSite(), day = solDay(N, site); if (!day.S.length) { N.res = { site, date: N.date, step: N.step, none: true }; return N.res; }
            const SC = await solScene(), out = [];
            P.forEach(s => { const O = solProbe3D(s, SC); let bits = ''; day.S.forEach(p => { bits += p.el > 0 && !solBlocked(SC, O, solDir(p, site)) ? '1' : '0'; });
                /* chaque pas vaut ± un demi-pas autour de son heure, borné au lever et au coucher */
                const iv = []; let a = null; for (let k = 0; k <= bits.length; k++) { const on = bits[k] === '1'; if (on && a === null) a = k; if (!on && a !== null) { iv.push([Math.max(day.rise, day.S[a].t - N.step / 2), Math.min(day.set, day.S[k - 1].t + N.step / 2)]); a = null; } }
                const mins = iv.reduce((m, [x, y]) => m + (y - x), 0); out.push({ id: s.sonde.id, n: s.sonde.n, inside: O.W.inside, where: O.W.where, h: s.sonde.h, bits, iv, mins }); });
            N.res = { site: { lat: site.lat, lon: site.lon, conv: site.conv, src: site.src }, date: N.date, step: N.step, rise: day.rise, set: day.set, off: day.off, t: day.S.map(p => p.t), el: day.S.map(p => Math.round(p.el * 10) / 10), az: day.S.map(p => Math.round(p.az * 10) / 10), probes: out, sig: solSig() };
            return N.res; }
        const solSig = () => { try { return secModelSig() + '|' + JSON.stringify(solProbes().map(s => [s.x, s.y, s.sonde, s.lvl, s.bid])); } catch (e) { return ''; } };
        // repère indicatif de la NF EN 17037 (exposition au soleil, pièce de vie, journée entre le 1er février et le 21 mars) : 1 h 30, 3 h, 4 h
        function solClass(p, date) { if (!p.inside) return null; const md = date.slice(5); if (md < '02-01' || md > '03-21') return { k: 'hors', t: 'hors période EN 17037 (1er fév. – 21 mars)', c: '#9ca3af' };
            return p.mins >= 240 ? { k: 'haut', t: 'Élevé (≥ 4 h)', c: '#22c55e' } : p.mins >= 180 ? { k: 'moy', t: 'Moyen (≥ 3 h)', c: '#84cc16' } : p.mins >= 90 ? { k: 'min', t: 'Minimal (≥ 1 h 30)', c: '#eab308' } : { k: 'ins', t: 'Insuffisant (< 1 h 30)', c: '#ef4444' }; }
        const solDur = (m) => Math.floor(m / 60) + ' h ' + String(Math.round(m % 60)).padStart(2, '0');
        // courbe : hauteur du soleil heure par heure, remplie en jaune quand la sonde est au soleil, en gris quand il est caché
        function solCurveSVG(R, p, W, H) { W = W || 640; H = H || 190; const ml = 34, mr = 10, mt = 10, mb = 24, ta = Math.floor((R.rise - 20) / 60) * 60, tb = Math.ceil((R.set + 20) / 60) * 60, emx = Math.max(10, Math.ceil(Math.max(...R.el) / 10) * 10);
            const X = (t) => ml + (t - ta) / (tb - ta) * (W - ml - mr), Y = (e) => mt + (1 - Math.max(0, e) / emx) * (H - mt - mb), st = R.step; let g = '';
            for (let e = 0; e <= emx; e += 10) g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(e)}" y2="${Y(e)}" stroke="#374151" stroke-width="1"/><text x="${ml - 4}" y="${Y(e) + 3}" fill="#9ca3af" font-size="9" text-anchor="end">${e}°</text>`;
            for (let t = ta; t <= tb; t += 60) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${H - mb}" stroke="#1f2937"/><text x="${X(t)}" y="${H - mb + 13}" fill="#9ca3af" font-size="9" text-anchor="middle">${t / 60}h</text>`;
            R.t.forEach((t, k) => { const x0 = X(Math.max(R.rise, t - st / 2)), x1 = X(Math.min(R.set, t + st / 2)), on = p.bits[k] === '1'; g += `<rect x="${x0.toFixed(1)}" width="${Math.max(0.5, x1 - x0).toFixed(1)}" y="${Y(R.el[k]).toFixed(1)}" height="${(Y(0) - Y(R.el[k])).toFixed(1)}" fill="${on ? '#facc15' : '#4b5563'}" opacity="${on ? 0.85 : 0.55}"/>`; });
            g += `<polyline fill="none" stroke="#f59e0b" stroke-width="1.6" points="${R.t.map((t, k) => X(t).toFixed(1) + ',' + Y(R.el[k]).toFixed(1)).join(' ')}"/><line x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9ca3af"/>`;
            [[R.rise, 'lever ' + solHM(R.rise)], [R.set, 'coucher ' + solHM(R.set)]].forEach(([t, l], i) => { g += `<text x="${X(t) + (i ? -3 : 3)}" y="${Y(0) - 4}" fill="#fbbf24" font-size="9" text-anchor="${i ? 'end' : 'start'}">${l}</text>`; });
            return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${g}</svg>`; }
        /* ---- Σ Calculs › Soleil ---- */
        function openSolNote() { const N = solCfg(), site = solSite(), P = solProbes();
            const body = calcTabs('sol') + `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:12px;">
                ${cubCard(`<div style="font-size:15px;font-weight:600;margin-bottom:8px;">Journée simulée</div>
                    <table style="width:100%;font-size:13px;border-collapse:collapse;"><tr><td style="padding:4px 0;">Date</td><td style="text-align:right;"><input id="sol-date" type="date" class="pv-in" style="width:150px" value="${N.date}"></td></tr>
                    <tr><td style="padding:4px 0;">Pas d'enregistrement</td><td style="text-align:right;"><select id="sol-step" class="pv-in" style="width:90px">${[1, 5, 10, 15].map(v => `<option value="${v}"${v === N.step ? ' selected' : ''}>${v} min</option>`).join('')}</select></td></tr></table>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${[['03-21', 'Équinoxe (21 mars)'], ['06-21', 'Solstice d\'été'], ['12-21', 'Solstice d\'hiver'], ['02-01', '1er février']].map(([d, l]) => `<button type="button" class="mf-btn" style="font-size:11.5px" onclick="solSetDate('${d}')">${l}</button>`).join('')}</div>
                    <p style="color:#9ca3af;font-size:12px;margin-top:8px;">Lieu : ${nfr(site.lat, 4)}° N, ${nfr(site.lon, 4)}° E (${site.src})${site.conv ? ' · nord vrai à ' + nfr(site.conv * 180 / Math.PI, 2) + '° du nord du plan' : ''}. Heures légales.</p>`)}
                ${cubCard(`<div style="font-size:15px;font-weight:600;margin-bottom:6px;">Sondes (${P.length})</div>${P.length ? `<div style="font-size:13px;color:#cbd5e1">${P.map(s => { const W = sondeWhere(s); return `<div>☀ <b>${solEsc(s.sonde.n)}</b> — ${solEsc(W.where)}, à ${nfr(s.sonde.h, 2)} m</div>`; }).join('')}</div>` : '<p style="color:#9ca3af;font-size:13px;">Aucune sonde : palette Bâtiment › Sonde ☀, puis cliquez dans une pièce ou dehors.</p>'}`)}</div>
                <div id="sol-res" style="margin-top:12px;"></div>`;
            openTopoModal('Σ Calculs', body, [['Copier (tableur)', () => copyText(solTSV()), false], ['▶ Journée accélérée en 3D', () => { closeTopoModal(); solPlay(); }, false], ['Calculer', () => solCompute(), false], ['🖨 Imprimer la note', () => solPDF(), true]]);
            const b = document.getElementById('tm-body'); b.onchange = (e) => { const t = e.target; if (t.id === 'sol-date' && /^\d{4}-\d\d-\d\d$/.test(t.value)) { N.date = t.value; solRender(); } else if (t.id === 'sol-step') { N.step = +t.value; solRender(); } };
            solRender(); }
        const solEsc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        function solSetDate(md) { const N = solCfg(); N.date = N.date.slice(0, 5) + md; const e = document.getElementById('sol-date'); if (e) e.value = N.date; solRender(); }
        async function solCompute() { const el = document.getElementById('sol-res'); if (el) el.innerHTML = '<p style="color:#9ca3af;font-size:13px;">Calcul de la journée…</p>'; await new Promise(r => setTimeout(r, 20));
            const t0 = performance.now(); let R = null; try { R = await solRun(); } catch (e) { console.error(e); if (el) el.innerHTML = '<p style="color:#fca5a5">Calcul impossible : ' + solEsc(e.message) + '</p>'; return; }
            solRender(); if (R) updateCommandMessageText('ENSOLEILLEMENT : ' + (R.probes || []).length + ' sonde(s), journée du ' + new Date(R.date + 'T12:00').toLocaleDateString('fr-FR') + ' calculée en ' + nfr((performance.now() - t0) / 1000, 1) + ' s.'); }
        function solRender() { const el = document.getElementById('sol-res'); if (!el) return; const N = solCfg(), R = N.res;
            if (!R || R.date !== N.date || R.step !== N.step) { el.innerHTML = cubCard('<p style="color:#9ca3af;font-size:13px;margin:0">' + (solProbes().length ? 'Cliquez <b>Calculer</b> (ou ▶ Journée accélérée en 3D pour la voir passer).' : 'Posez au moins une sonde.') + '</p>'); return; }
            if (R.none) { el.innerHTML = cubCard('<p style="margin:0">Le soleil ne se lève pas ce jour-là à cette latitude.</p>'); return; }
            const stale = R.sig !== solSig(), live = new Set(solProbes().map(s => s.sonde.id));
            el.innerHTML = (stale ? `<div style="background:#78350f;border:1px solid #f59e0b;color:#fde68a;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:13px">Le plan ou les sondes ont changé depuis ce calcul : cliquez <b>Calculer</b> pour le refaire.</div>` : '')
                + `<div style="color:#cbd5e1;font-size:13px;margin-bottom:8px">${new Date(R.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · lever ${solHM(R.rise)} · coucher ${solHM(R.set)} · soleil au plus haut ${nfr(Math.max(...R.el), 1)}°</div>`
                + R.probes.filter(p => live.has(p.id)).map(p => { const C = solClass(p, R.date), big = (l, v, c) => `<div style="flex:1;min-width:110px;background:#0b1220;border:1px solid #374151;border-radius:8px;padding:6px 10px;"><div style="color:#9ca3af;font-size:11.5px;">${l}</div><div style="font-size:17px;font-weight:700;color:${c};">${v}</div></div>`;
                    return `<div style="margin-bottom:12px">${cubCard(`<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap"><div style="font-size:15px;font-weight:600">☀ ${solEsc(p.n)} <span style="color:#9ca3af;font-weight:400;font-size:12.5px">${solEsc(p.where)} · à ${nfr(p.h, 2)} m</span></div></div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">${big('Soleil direct', solDur(p.mins), p.mins ? '#facc15' : '#9ca3af')}${big('Horaires', p.iv.length ? p.iv.map(([a, b]) => solHM(a) + ' → ' + solHM(b)).join('<br>') : 'aucun', '#e5e7eb')}${C ? big('NF EN 17037 (indicatif)', C.t, C.c) : ''}</div>${solCurveSVG(R, p)}`)}</div>`; }).join('')
                + `<p style="color:#9ca3af;font-size:11.5px;">Soleil direct au point de la sonde : un rayon vers le soleil, pas à pas, à travers la maquette 3D (murs et leurs baies, toits, dalles, arbres, bâti voisin, relief) ; les vitrages laissent passer le soleil, sans tenir compte de leur transmission. Le repère NF EN 17037 (1 h 30 / 3 h / 4 h sur une journée du 1er février au 21 mars) est donné à titre indicatif : la norme fixe aussi la position du point de mesure et une hauteur minimale du soleil, non vérifiées ici.</p>`; }
        function solTSV() { const R = (solNote || {}).res; if (!R || !R.probes) return ''; const L = [['Sonde', 'Emplacement', 'Hauteur (m)', 'Soleil direct (min)', 'Horaires', 'EN 17037 (indicatif)'].join('\t')];
            R.probes.forEach(p => { const C = solClass(p, R.date); L.push([p.n, p.where, nfr(p.h, 2), Math.round(p.mins), p.iv.map(([a, b]) => solHM(a) + '-' + solHM(b)).join(' ; '), C ? C.t : ''].join('\t')); }); return L.join('\n'); }
        /* ---- note imprimée (seule ou dans le dossier) ---- */
        async function solPDF(D) { if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; } const N = solCfg(); if (!N.res || N.res.date !== N.date || N.res.step !== N.step || N.res.sig !== solSig()) await solRun(); const R = N.res; if (!R) return;
            const { jsPDF } = window.jspdf, doc = D ? D.doc : new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); if (D) { if (D.used) doc.addPage(); D.used = true; }
            const W = 210, M = 15, base = (fileName ? baseName(fileName) : 'plan'); let y = calcPdfHeader(doc, 'Note d\'ensoleillement');
            const txt = (t, sz, b, col) => { doc.setFont('helvetica', b ? 'bold' : 'normal'); doc.setFontSize(sz); doc.setTextColor(...(col || [20, 20, 20])); doc.text(pdfTxt(t), M, y); };
            txt('Journée du ' + new Date(R.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 11, 1); y += 6;
            if (R.none) { txt('Le soleil ne se lève pas ce jour-là à cette latitude.', 9); doc.save(base + '_note_ensoleillement.pdf'); return; }
            txt('Lever ' + solHM(R.rise) + ', coucher ' + solHM(R.set) + ' (heures légales), soleil au plus haut ' + nfr(Math.max(...R.el), 1) + ' degrés. Lieu : ' + nfr(R.site.lat, 4) + ' N, ' + nfr(R.site.lon, 4) + ' E (' + R.site.src + '). Pas : ' + R.step + ' min.', 8.5, 0, [70, 70, 70]); y += 8;
            R.probes.forEach(p => { if (y > 210) { doc.addPage(); y = calcPdfHeader(doc, 'Note d\'ensoleillement (suite)'); } const C = solClass(p, R.date);
                txt('Sonde ' + p.n + ' - ' + p.where + ', à ' + nfr(p.h, 2) + ' m', 11, 1); y += 5.5;
                txt('Soleil direct : ' + solDur(p.mins) + (C ? '   -   NF EN 17037 (indicatif) : ' + C.t : ''), 9.5, 1, [120, 80, 0]); y += 5;
                const H = doc.splitTextToSize(pdfTxt('Horaires : ' + (p.iv.length ? p.iv.map(([a, b]) => solHM(a) + ' - ' + solHM(b)).join(' ; ') : 'aucun soleil direct')), W - 2 * M); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40); doc.text(H, M, y); y += H.length * 4.2 + 1;
                // courbe : hauteur du soleil, colonnes jaunes au soleil, grises à l'ombre
                const gx = M + 10, gw = W - 2 * M - 12, gh = 42, gy = y, ta = Math.floor((R.rise - 20) / 60) * 60, tb = Math.ceil((R.set + 20) / 60) * 60, emx = Math.max(10, Math.ceil(Math.max(...R.el) / 10) * 10), X = (t) => gx + (t - ta) / (tb - ta) * gw, Yp = (e) => gy + (1 - Math.max(0, e) / emx) * gh;
                doc.setDrawColor(210); doc.setLineWidth(0.15); doc.setFontSize(6.5); doc.setTextColor(110); for (let e = 0; e <= emx; e += 10) { doc.line(gx, Yp(e), gx + gw, Yp(e)); doc.text(e + '°', gx - 1.5, Yp(e) + 1, { align: 'right' }); }
                for (let t = ta; t <= tb; t += 60) { doc.line(X(t), gy, X(t), gy + gh); doc.text(t / 60 + 'h', X(t), gy + gh + 3.5, { align: 'center' }); }
                R.t.forEach((t, k) => { const x0 = X(Math.max(R.rise, t - R.step / 2)), x1 = X(Math.min(R.set, t + R.step / 2)), on = p.bits[k] === '1'; if (on) doc.setFillColor(250, 204, 21); else doc.setFillColor(190, 190, 195); doc.rect(x0, Yp(R.el[k]), Math.max(0.1, x1 - x0), Yp(0) - Yp(R.el[k]), 'F'); });
                doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.4); for (let k = 1; k < R.t.length; k++) doc.line(X(R.t[k - 1]), Yp(R.el[k - 1]), X(R.t[k]), Yp(R.el[k])); doc.setDrawColor(120); doc.setLineWidth(0.25); doc.line(gx, Yp(0), gx + gw, Yp(0));
                y = gy + gh + 9; });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(doc.splitTextToSize(pdfTxt('Soleil direct au point de chaque sonde, calculé pas à pas par un rayon vers le soleil à travers la maquette 3D (murs et baies, toits, dalles, arbres, bâti voisin, relief) ; vitrages traversés sans transmission. Jaune : sonde au soleil ; gris : soleil caché. Le repère NF EN 17037 (1 h 30 / 3 h / 4 h, journée du 1er février au 21 mars) est indicatif : position normalisée du point de mesure et hauteur solaire minimale non vérifiées. Estimation de conception, pas une étude réglementaire.'), W - 2 * M), M, Math.min(y + 2, 278));
            if (D) return; doc.save(base + '_note_ensoleillement.pdf'); updateCommandMessageText('NOTE D\'ENSOLEILLEMENT : PDF « ' + base + '_note_ensoleillement.pdf » produit.'); }
        /* ---- Y sur une sonde : nom, hauteur, posée sur le plancher ou le sol ---- */
        function sondeEdit(s) { const W = sondeWhere(s), R = (solNote || {}).res, p = R && R.probes ? R.probes.find(q => q.id === s.sonde.id) : null;
            openTopoModal('Sonde d\'ensoleillement', `<div class="mf-hint" style="margin-bottom:8px">${solEsc(W.where)} · point de mesure à ${nfr(W.z / 1000, 2)} m d'altitude.</div>
                ${MF.row('Nom', `<input id="sd-n" class="mf-in" style="width:9rem" value="${solEsc(s.sonde.n)}">`)}${MF.row('Hauteur au-dessus du sol', `<input id="sd-h" class="mf-in" style="width:5rem" value="${nfr(s.sonde.h, 2)}"> m`)}
                ${s.bid ? MF.row('Posée sur', `<select id="sd-sol" class="mf-in"><option value=""${s.sonde.sol !== 'sol' ? ' selected' : ''}>le plancher de l'étage</option><option value="sol"${s.sonde.sol === 'sol' ? ' selected' : ''}>le sol fini (dehors)</option></select>`) : ''}
                ${p && R.date === solCfg().date ? `<div style="margin-top:10px">${solCurveSVG(R, p, 420, 140)}<div style="font-size:12.5px;color:#cbd5e1">Soleil direct ${solDur(p.mins)} le ${new Date(R.date + 'T12:00').toLocaleDateString('fr-FR')} : ${p.iv.map(([a, b]) => solHM(a) + ' → ' + solHM(b)).join(', ') || 'aucun'}</div></div>` : ''}`,
                [['Annuler', closeTopoModal, false], ['Σ Note d\'ensoleillement', () => { closeTopoModal(); openSolNote(); }, false], ['Valider', () => { const n = (document.getElementById('sd-n').value || '').trim(), h = t2Num(document.getElementById('sd-h').value), so = document.getElementById('sd-sol');
                    if (n) s.sonde.n = n.slice(0, 24); if (isFinite(h) && h >= 0 && h < 100) { s.sonde.h = Math.round(h * 100) / 100; solLastH = s.sonde.h; } if (so) { if (so.value === 'sol') s.sonde.sol = 'sol'; else delete s.sonde.sol; } closeTopoModal(); saveState(); draw(); }, true]]); }
        /* ---- journée accélérée dans la vue 3D : le soleil se lève et se couche en une quinzaine de secondes, ombres portées, chaque sonde jaune au soleil, grise à l'ombre ---- */
        async function solPlay() { solStop(true); const N = solCfg(); if (!solProbes().length) { updateCommandMessageText('ENSOLEILLEMENT : posez d\'abord une sonde (palette Bâtiment, outil Sonde).'); return; }
            if (!is3DOpen()) await open3D(); const ex = document.getElementById('v3-exag'); if (ex && +ex.value !== 1) { SOL_EX0 = ex.value; ex.value = '1'; build3DScene(); }
            const R = (N.res && N.res.date === N.date && N.res.step === N.step && N.res.sig === solSig()) ? N.res : await solRun(); if (!R || R.none) { updateCommandMessageText('ENSOLEILLEMENT : pas de soleil ce jour-là.'); return; }
            const site = R.site, g = new THREE.Group(); g.userData.sonde = true; const mk = new Map(); solProbes().forEach(s => { const O = solProbe3D(s), m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), new THREE.MeshBasicMaterial({ color: 0x9ca3af })); m.position.set(O.x - V3.root.position.x, O.y - V3.root.position.y, O.z - V3.root.position.z); m.userData.sonde = true; g.add(m); mk.set(s.sonde.id, m); });
            V3.root.add(g); const Rr = V3.renderer; Rr.shadowMap.enabled = true; Rr.shadowMap.type = THREE.PCFSoftShadowMap; V3.root.updateMatrixWorld(true);
            V3.root.traverse(o => { if (!o.isMesh || o.userData.sonde) return; const mt = Array.isArray(o.material) ? o.material[0] : o.material, tr = mt && mt.transparent && mt.opacity < 0.7; o.castShadow = !tr && !o.userData.water && !o.userData.drape; o.receiveShadow = true; });
            /* vue cadrée sur les sondes (de trois quarts, côté sud) ; les ombres sont calculées autour d'elles */
            const C = new THREE.Vector3(); g.children.forEach(m => C.add(m.position.clone().add(V3.root.position))); C.multiplyScalar(1 / Math.max(1, g.children.length)); let ext = 0; g.children.forEach(m => { ext = Math.max(ext, m.position.clone().add(V3.root.position).distanceTo(C)); });
            const rr = Math.max(25, Math.min(120, ext * 1.6 + 20)); V3.target.copy(C); if (V3.pin) { V3.pin = C.clone(); V3.pinRoot = V3.root.position.clone(); } V3.dist = Math.max(30, ext * 2.2 + 25); V3.el = 0.55; V3.az = Math.PI * 1.15; V3.scene.add(V3.sun.target);
            let hud = document.getElementById('sol-hud'); if (!hud) { hud = document.createElement('div'); hud.id = 'sol-hud'; document.getElementById('view3d').appendChild(hud); }
            hud.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:8;background:#111827ee;border:1px solid #f59e0b;border-radius:10px;padding:6px 12px;color:#fde68a;font:600 13px Arial;display:flex;gap:10px;align-items:center;max-width:94%;flex-wrap:wrap';
            SOL_PLAY = { R, site, g, mk, C, rr, t: R.rise, last: performance.now(), speed: 1, run: true, raf: 0 };
            const frame = () => { const S = SOL_PLAY; if (!S) return; if (!is3DOpen()) { solStop(); return; } const now = performance.now(), dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
                if (S.run) S.t = Math.min(S.R.set, S.t + dt * 50 * S.speed); const key = S.t + '|' + S.run + '|' + S.speed; if (key === S.key) { S.raf = requestAnimationFrame(frame); return; } S.key = key;   /* à l'arrêt : rien à refaire (la vue tourne quand même) */
                const ms = Date.UTC(...S.R.date.split('-').map((v, i) => i === 1 ? v - 1 : +v), 0, 0) + (S.t - S.R.off * 60) * 60000, p = solPos(ms, S.site.lat, S.site.lon), d = solDir(p, S.site);
                rdLightAt(V3.sun, S.C, d, S.rr); rdShadowFit(V3.sun, S.C, S.rr, 2048); V3.sun.intensity = p.el > 0 ? 0.35 + 0.65 * Math.min(1, p.el / 25) : 0.05; V3.amb.intensity = 0.25 + 0.25 * Math.min(1, Math.max(0, p.el) / 25);
                if (V3.sky && V3.sky.material && V3.sky.material.uniforms) { V3.sky.material.uniforms.sun.value.set(d.x, d.y, d.z); V3.sky.material.uniforms.day.value = Math.max(0, Math.min(1, (p.el + 4) / 16)); }
                const k = Math.max(0, Math.min(S.R.t.length - 1, Math.round((S.t - S.R.t[0]) / S.R.step))), st = [];
                S.R.probes.forEach(q => { const m = S.mk.get(q.id); const on = q.bits[k] === '1'; if (m) m.material.color.set(on ? 0xfacc15 : 0x6b7280); st.push((on ? '☀ ' : '☁ ') + q.n); });
                hud.innerHTML = `<span>☀ ${new Date(S.R.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · ${solHM(S.t)} · soleil ${nfr(Math.max(0, p.el), 0)}°</span><span style="color:#e5e7eb;font-weight:400">${st.join(' · ')}</span>
                    <button type="button" class="mf-btn" onclick="SOL_PLAY.run=!SOL_PLAY.run">${S.run ? '⏸' : '▶'}</button><button type="button" class="mf-btn" onclick="SOL_PLAY.speed=SOL_PLAY.speed===1?3:1">×${S.speed === 1 ? 3 : 1}</button><button type="button" class="mf-btn" onclick="solStop();openSolNote()">Σ Note</button><button type="button" class="mf-btn" onclick="solStop()">⏹</button>`;
                render3D(); if (S.t >= S.R.set) { S.run = false; } S.raf = requestAnimationFrame(frame); };
            updateCommandMessageText('JOURNÉE ACCÉLÉRÉE : le soleil va du lever au coucher ; une sonde jaune est au soleil, grise à l\'ombre. ⏸ pause, ×3 plus vite, Σ Note pour les horaires et la courbe.'); frame(); }
        let SOL_EX0 = null;
        function solStop(quiet) { const S = SOL_PLAY; SOL_PLAY = null; if (S) { cancelAnimationFrame(S.raf); if (S.g && S.g.parent) S.g.parent.remove(S.g); } const h = document.getElementById('sol-hud'); if (h) h.remove();
            if (!S || !V3) return; try { rdShadowsOff(); V3.renderer.shadowMap.enabled = false; V3.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); } catch (e) {}
            const ex = document.getElementById('v3-exag'); if (SOL_EX0 !== null && ex) { ex.value = SOL_EX0; SOL_EX0 = null; if (is3DOpen()) build3DScene(); } try { v3Sky(); } catch (e) {} if (is3DOpen()) render3D(); }
