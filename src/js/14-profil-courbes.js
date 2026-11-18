        // =====================================================================
        // PROFIL EN LONG : axe en polyligne → altitudes du terrain tout le long (surface) + croisements des traits 3D
        // =====================================================================
        let profileAxis = [], lastProfile = null;
        function finishProfileAxis() {
            if (profileAxis.length < 2) { updateCommandMessageText("PROFIL : il faut au moins 2 points d'axe."); return; }
            const axis = profileAxis.slice(); profileAxis = []; isDrawing = false;
            const axShape = { type: 'poly', layerId: DIM_LAYER_ID, points: axis.map(p => ({ x: p.x, y: p.y })), open: true, dash: 'center', gen: 'axis', zk: 1 };
            shapes.push(axShape); saveState(); draw();
            lastProfile = computeProfile(axis); showProfile(lastProfile);
        }
        function computeProfile(axis) {
            const tin = getTIN(), samples = [], marks = [];
            let total = 0; const segs = [];
            for (let i = 0; i < axis.length - 1; i++) { const a = axis[i], b = axis[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y); segs.push({ a, b, L, d0: total }); total += L; }
            const step = Math.max(total / 600, mmToWorld(50));   // ~600 échantillons, au moins tous les 5 cm
            segs.forEach((sg, k) => {
                const n = Math.max(1, Math.ceil(sg.L / step));
                for (let i = 0; i <= n; i++) { if (i === 0 && k > 0) continue; const t = i / n, x = sg.a.x + (sg.b.x - sg.a.x) * t, y = sg.a.y + (sg.b.y - sg.a.y) * t; samples.push({ d: mOf(sg.d0 + sg.L * t), z: tin ? tinZ(x, y, tin) : undefined }); }
                // croisements avec les traits 3D et points topo proches de l'axe
                for (const s of shapes) {
                    if (s.gen) continue; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) continue;
                    const cross = (p, q, zp, zq, label) => {
                        const d = (sg.b.x - sg.a.x) * (q.y - p.y) - (sg.b.y - sg.a.y) * (q.x - p.x); if (Math.abs(d) < 1e-12) return;
                        const t = ((p.x - sg.a.x) * (q.y - p.y) - (p.y - sg.a.y) * (q.x - p.x)) / d, u = ((p.x - sg.a.x) * (sg.b.y - sg.a.y) - (p.y - sg.a.y) * (sg.b.x - sg.a.x)) / d;
                        if (t < 0 || t > 1 || u < 0 || u > 1 || !hasZ(zp) || !hasZ(zq)) return;
                        marks.push({ d: mOf(sg.d0 + sg.L * t), z: zp + (zq - zp) * u, label });
                    };
                    const nm = (layers.find(x => x.id === (s.layerId || 'layer-0')) || {}).name || '';
                    if (s.type === 'line') cross({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, s.z1, s.z2, nm);
                    else if (s.type === 'poly') for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; cross(a, b, a.z, b.z, nm); }
                    else if (s.type === 'point' && hasZ(s.z)) {
                        const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, t = ((s.x - sg.a.x) * dx + (s.y - sg.a.y) * dy) / (sg.L * sg.L);
                        if (t >= 0 && t <= 1 && Math.hypot(s.x - (sg.a.x + t * dx), s.y - (sg.a.y + t * dy)) <= mmToWorld(500)) marks.push({ d: mOf(sg.d0 + sg.L * t), z: s.z, label: s.mat || 'point' });
                    }
                }
            });
            // sommets de l'axe
            const verts = [0]; segs.forEach(sg => verts.push(mOf(sg.d0 + sg.L)));
            marks.sort((a, b) => a.d - b.d);
            return { axis, length: mOf(total), samples, marks, verts };
        }
        function profileTable(pr, pas) {
            // points du tableau : tous les « pas » mètres + sommets de l'axe + croisements
            const rows = [], zAtD = (d) => { const s = pr.samples; for (let i = 0; i < s.length - 1; i++) if (d >= s[i].d && d <= s[i + 1].d) { if (!hasZ(s[i].z) || !hasZ(s[i + 1].z)) return undefined; const t = (d - s[i].d) / ((s[i + 1].d - s[i].d) || 1); return s[i].z + (s[i + 1].z - s[i].z) * t; } return undefined; };
            for (let d = 0; d <= pr.length + 1e-9; d += pas) rows.push({ d, z: zAtD(d), t: 'PK' });
            if (Math.abs(rows[rows.length - 1].d - pr.length) > 1e-6) rows.push({ d: pr.length, z: zAtD(pr.length), t: 'Fin' });
            pr.verts.slice(1, -1).forEach(d => rows.push({ d, z: zAtD(d), t: 'Sommet axe' }));
            pr.marks.forEach(m => rows.push({ d: m.d, z: m.z, t: m.label || 'croisement' }));
            rows.sort((a, b) => a.d - b.d);
            // doublons à la même distance (1 cm) : on garde le premier
            return rows.filter((r, i) => i === 0 || r.d - rows[i - 1].d > 0.01 || r.t !== rows[i - 1].t && !(r.t === 'Sommet axe' && rows[i - 1].t === 'PK'));
        }
        function drawProfileChart(cv, pr, exag) {
            const c = cv.getContext('2d'), W = cv.width, H = cv.height, padL = 64, padR = 16, padT = 16, padB = 34;
            c.fillStyle = '#111827'; c.fillRect(0, 0, W, H);
            const zs = pr.samples.map(s => s.z).concat(pr.marks.map(m => m.z)).filter(hasZ).map(z => z / 1000);
            if (!zs.length) { c.fillStyle = '#9ca3af'; c.font = '14px Arial'; c.fillText("Aucune altitude le long de l'axe (pas de surface ni de trait 3D croisé).", 20, H / 2); return; }
            // échelle des hauteurs = échelle des longueurs × exagération (pas d'étirement automatique)
            exag = exag || 5;
            const pxM = (W - padL - padR) / pr.length, pxZ = pxM * exag, zmid = (arrMin(zs) + arrMax(zs)) / 2, half = (H - padT - padB) / 2 / pxZ;
            let zmin = zmid - half, zmax = zmid + half;
            if (arrMax(zs) > zmax || arrMin(zs) < zmin) { zmin = arrMin(zs) - 0.1; zmax = arrMax(zs) + 0.1; }   // relief trop fort pour l'exagération : on fait tenir
            const X = (d) => padL + d * pxM, Y = (z) => H - padB - (z - zmin) / (zmax - zmin) * (H - padT - padB);
            // grille
            c.strokeStyle = '#374151'; c.lineWidth = 1; c.fillStyle = '#9ca3af'; c.font = '11px Arial';
            const zStep = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50].find(v => (zmax - zmin) / v <= 8) || 100;
            for (let z = Math.ceil(zmin / zStep) * zStep; z <= zmax; z += zStep) { c.beginPath(); c.moveTo(padL, Y(z)); c.lineTo(W - padR, Y(z)); c.stroke(); c.textAlign = 'right'; c.fillText(nfr(z, 2), padL - 6, Y(z) + 4); }
            const dStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find(v => pr.length / v <= 12) || 2000;
            for (let d = 0; d <= pr.length; d += dStep) { c.beginPath(); c.moveTo(X(d), padT); c.lineTo(X(d), H - padB); c.stroke(); c.textAlign = 'center'; c.fillText(nfr(d, 0) + ' m', X(d), H - padB + 16); }
            // sommets de l'axe
            c.strokeStyle = '#6b7280'; c.setLineDash([4, 4]); pr.verts.forEach(d => { c.beginPath(); c.moveTo(X(d), padT); c.lineTo(X(d), H - padB); c.stroke(); }); c.setLineDash([]);
            // terrain
            c.strokeStyle = '#a3e635'; c.lineWidth = 2; c.beginPath(); let pen = false;
            pr.samples.forEach(s => { if (!hasZ(s.z)) { pen = false; return; } const x = X(s.d), y = Y(s.z / 1000); if (pen) c.lineTo(x, y); else c.moveTo(x, y); pen = true; }); c.stroke();
            // croisements
            c.fillStyle = '#f59e0b'; pr.marks.forEach(m => { c.beginPath(); c.arc(X(m.d), Y(m.z / 1000), 3.5, 0, 2 * Math.PI); c.fill(); });
            c.fillStyle = '#e5e7eb'; c.textAlign = 'left'; c.font = 'bold 12px Arial';
            c.fillText('Longueur ' + nfr(pr.length, 2) + ' m · altitudes ' + nfr(arrMin(zs), 2) + ' → ' + nfr(arrMax(zs), 2) + ' m · hauteurs ×' + exag, padL + 6, padT + 14);
        }
        function showProfile(pr) {
            const pas = pr.length > 200 ? 20 : pr.length > 50 ? 10 : pr.length > 10 ? 5 : 1;
            const body = `<canvas id="pf-canvas" width="940" height="320" style="width:100%;border-radius:6px;"></canvas>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:10px 0;align-items:center">
                    ${MF.row('Pas du tableau', MF.sel('pf-pas', [1, 2, 5, 10, 20, 25, 50].map(v => [v, v + ' m']), pas, 'onchange="refreshProfileTable()"'), '')}
                    ${MF.row('<span title="Exagération des hauteurs : échelle verticale = échelle horizontale × ce chiffre (graphique et profil dessiné)">Hauteurs exagérées</span>', MF.sel('pf-exag', [1, 2, 5, 10, 20].map(v => [v, '× ' + v]), 5, 'onchange="drawProfileChart(document.getElementById(\'pf-canvas\'), lastProfile, parseFloat(this.value))"'), '')}
                    <div style="grid-column:1/-1;display:flex;gap:16px;font-size:12px;color:#9ca3af"><span><span style="display:inline-block;width:18px;height:3px;background:#22c55e;vertical-align:middle;margin-right:6px"></span>terrain (surface)</span><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;vertical-align:middle;margin-right:6px"></span>croisements avec les traits 3D et points topo proches</span></div></div>
                <div id="pf-table" style="max-height:220px;overflow:auto;"></div>`;
            openTopoModal('📈 Profil en long', body, [['Copier (tableur)', () => copyText(profileTSV()), false], ['Exporter CSV', () => downloadText('profil_en_long.csv', profileTSV().replace(/\t/g, ';')), false], ['Dessiner dans le plan', () => insertProfileDrawing(), true]]);
            drawProfileChart(document.getElementById('pf-canvas'), pr, 5); refreshProfileTable();
        }
        function profileRows() { return profileTable(lastProfile, parseFloat(document.getElementById('pf-pas').value) || 10); }
        function refreshProfileTable() {
            const rows = profileRows();
            document.getElementById('pf-table').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="color:#9ca3af;text-align:right;"><th style="text-align:left;padding:3px 6px;">Repère</th><th style="padding:3px 6px;">Distance (m)</th><th style="padding:3px 6px;">Altitude (m)</th><th style="padding:3px 6px;">Pente vers le suivant</th></tr></thead><tbody>' +
                rows.map((r, i) => { const reg = (t) => t === 'PK' || t === 'Sommet axe' || t === 'Fin'; const n = reg(r.t) ? rows.slice(i + 1).find(q => reg(q.t)) : null; const pc = n && hasZ(r.z) && hasZ(n.z) && n.d > r.d + 0.01 ? nfr((n.z - r.z) / 10 / (n.d - r.d), 2) + ' %' : ''; return `<tr style="border-top:1px solid #374151;text-align:right;"><td style="text-align:left;padding:2px 6px;">${r.t}</td><td style="padding:2px 6px;">${nfr(r.d, 2)}</td><td style="padding:2px 6px;color:#bef264;">${hasZ(r.z) ? fmtZ(r.z) : '—'}</td><td style="padding:2px 6px;">${pc}</td></tr>`; }).join('') + '</tbody></table>';
        }
        function profileTSV() { return 'Repère\tDistance (m)\tAltitude (m)\n' + profileRows().map(r => [r.t, nfr(r.d, 2), hasZ(r.z) ? fmtZ(r.z) : ''].join('\t')).join('\n'); }
        // Dessin du profil dans le plan, sous le dessin : distances à l'échelle, hauteurs exagérées
        function insertProfileDrawing() {
            const pr = lastProfile; if (!pr) return;
            const exag = parseFloat(document.getElementById('pf-exag').value) || 5, rows = profileRows();
            const zs = pr.samples.map(s => s.z).filter(hasZ); if (!zs.length) { updateCommandMessageText('PROFIL : rien à dessiner (aucune altitude).'); return; }
            const zref = Math.floor(arrMin(zs) / 1000) * 1000 - 1000;   // plan de comparaison (m entier, 1 m sous le point bas)
            const bb = getShapesBoundingBox(shapes.filter(x => !isBg(x))) || { minX: 0, maxY: 0 };
            const ox = bb.minX, oy = bb.maxY + mmToWorld(10000);   // 10 m sous le dessin
            const W = (d) => ox + mmToWorld(d * 1000), Hh = (z) => oy - mmToWorld((z - zref) * exag);
            const lay = ensureLayer('Profil en long', '#a3e635'), add = (o) => shapes.push(Object.assign({ layerId: lay, gen: 'profile', zk: 1 }, o));
            const pts = []; pr.samples.forEach(s => { if (hasZ(s.z)) pts.push({ x: W(s.d), y: Hh(s.z) }); });
            add({ type: 'poly', points: pts, open: true, hatch: false });
            add({ type: 'line', x1: W(0), y1: oy, x2: W(pr.length), y2: oy });
            add({ type: 'text', x: W(0), y: oy + mmToWorld(2000), content: 'PC ' + fmtZ(zref) + ' m — hauteurs ×' + exag, size: mmToWorld(400) });
            rows.forEach(r => { if (!hasZ(r.z)) return; add({ type: 'line', x1: W(r.d), y1: oy, x2: W(r.d), y2: Hh(r.z), dash: 'dashed' }); add({ type: 'text', x: W(r.d) + mmToWorld(100), y: oy - mmToWorld(200), content: fmtZ(r.z) + '\n' + nfr(r.d, 2) + ' m', size: mmToWorld(250), angle: -Math.PI / 2 }); });
            saveState(); closeTopoModal(); zoomToFitShapes(shapes.filter(x => x.gen === 'profile')); draw();
            updateCommandMessageText('PROFIL dessiné sous le plan (calque « Profil en long »), hauteurs ×' + exag + '.');
        }

        // =====================================================================
        // COURBES DE NIVEAU : intersection de la surface avec des plans horizontaux réguliers
        // =====================================================================
        function openContoursDialog() {
            const tin = getTIN();
            if (!tin) { openTopoModal('〰️ Courbes de niveau', '<p>Il faut au moins 3 points cotés (points topo, sommets avec Z) pour construire la surface du terrain.</p>', [['Fermer', closeTopoModal, true]]); return; }
            const zs = tin.nodes.map(n => n.z / 1000), wav = (y, w, lab) => `<path d="M6 ${y} C40 ${y - 9} 70 ${y + 9} 104 ${y} S168 ${y - 7} 196 ${y}" fill="none" stroke="${w ? '#fbbf24' : '#a3e635'}" stroke-width="${w ? 2 : 1}" opacity="${w ? 1 : .7}"/>${lab ? `<rect x="88" y="${y - 7}" width="34" height="13" rx="2" fill="#111827"/><text x="105" y="${y + 3}" font-size="9.5" fill="#fbbf24" text-anchor="middle" font-family="sans-serif">${lab}</text>` : ''}`;
            const body = `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb">
                <div class="mf-fig"><svg width="200" height="78" viewBox="0 0 200 78">${wav(10, 1, 'Z+5')}${wav(22)}${wav(34)}${wav(46)}${wav(58)}${wav(70, 1, 'Z')}</svg><div class="mf-hint" style="margin:0">Terrain de <b>${tin.nodes.length}</b> points cotés, de <b>${nfr(arrMin(zs), 2)}</b> à <b>${nfr(arrMax(zs), 2)}</b> m. Une courbe <b>maîtresse</b> (plus épaisse, cotée) toutes les N courbes.</div></div>
                ${MF.row('Équidistance', MF.sel('ct-eq', [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].map(v => [v, nfr(v, 2)]), 0.1), 'm')}
                ${MF.row('Une maîtresse toutes les', MF.sel('ct-ma', [2, 4, 5, 10].map(v => [v, v + ' courbes']), 5), '')}
                ${MF.ck('ct-lab', 'Altitude écrite sur les maîtresses', true)}
                ${(() => { const lN = layers.find(l => l.name === 'Courbes de niveau'), lM = layers.find(l => l.name === 'Courbes maîtresses'), pen = (id, w) => `<select id="${id}" class="mf-in mf-sel" style="width:74px">${layPenOpts(w)}</select>`, col = (id, c) => `<input id="${id}" type="color" value="${c}" style="width:34px;height:26px;border:1px solid #4b5563;border-radius:5px;background:#111827;padding:1px;cursor:pointer">`;
                    return MF.row('Courbes', col('ct-cN', (lN && lN.color) || '#a16207') + pen('ct-wN', (lN && lN.width) || 1), 'mm') + MF.row('Maîtresses', col('ct-cM', (lM && lM.color) || '#ca8a04') + pen('ct-wM', (lM && lM.width) || 1.6), 'mm'); })()}
                <div id="ct-prev" style="padding:8px 10px;border:1px solid #374151;border-radius:8px;background:#111827;font-size:12.5px;color:#d1d5db"></div>
                ${MF.hint('Les anciennes courbes générées sont remplacées.')}</div>`;
            openTopoModal('〰️ Courbes de niveau', body, [['Annuler', closeTopoModal, false], ['Générer', generateContours, true]]);
            ['ct-eq', 'ct-ma'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', contourPreview); }); contourPreview();
        }
        // aperçu avant de générer : nombre de courbes et altitudes des maîtresses
        function contourPreview() { const tin = getTIN(), el = document.getElementById('ct-prev'); if (!tin || !el) return; const eq = parseFloat(document.getElementById('ct-eq').value) * 1000, ma = parseInt(document.getElementById('ct-ma').value, 10) || 5;
            const L = contourLevels(tin, eq), M = L.filter(z => Math.abs(Math.round(z / eq) % ma) === 0), f = (z) => nfr(z / 1000, 2), list = M.length <= 8 ? M.map(f).join(' · ') : M.slice(0, 3).map(f).join(' · ') + ' … ' + M.slice(-3).map(f).join(' · ');
            el.innerHTML = L.length ? `<b style="color:#fff">${L.length} courbe${L.length > 1 ? 's' : ''}</b> dont <b style="color:#fbbf24">${M.length} maîtresse${M.length > 1 ? 's' : ''}</b>, de ${f(L[0])} à ${f(L[L.length - 1])} m${M.length ? `<div style="margin-top:3px;color:#fbbf24">Maîtresses : ${list}</div>` : ''}${L.length >= 2000 ? '<div style="color:#fca5a5">Plafond de 2 000 courbes atteint : augmentez l\'équidistance.</div>' : ''}` : 'Aucune courbe avec cette équidistance.'; }
        function contourStyleApply(lN, lM) { const g = (id) => document.getElementById(id); [[lN, 'ct-cN', 'ct-wN'], [lM, 'ct-cM', 'ct-wM']].forEach(([id, c, w]) => { const L = layers.find(l => l.id === id); if (!L) return; if (g(c)) L.color = g(c).value; if (g(w)) L.width = parseFloat(g(w).value) || L.width; }); updateLayerUI();
        }
        function contourLevels(tin, eqmm) {
            const zs = tin.nodes.map(n => n.z), lo = Math.ceil(arrMin(zs) / eqmm) * eqmm, hi = arrMax(zs), out = [];
            for (let z = lo; z <= hi + 1e-6 && out.length < 2000; z += eqmm) out.push(Math.round(z * 1000) / 1000);
            return out;
        }
        function contourPolylines(tin, level) {
            // segments par triangle, puis chaînage bout à bout
            const segs = [], key = (p) => Math.round(p.x * 100) + ',' + Math.round(p.y * 100);
            tin.tris.forEach(t => {
                const v = t.map(i => tin.nodes[i]), pts = [];
                for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3]; if ((a.z - level) * (b.z - level) < 0 || (a.z === level && b.z !== level)) { const k = (level - a.z) / (b.z - a.z); pts.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }); } }
                if (pts.length === 2 && key(pts[0]) !== key(pts[1])) segs.push(pts);
            });
            const ends = new Map(); segs.forEach((sg, i) => sg.forEach((p, j) => { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push([i, j]); }));
            const used = new Array(segs.length).fill(false), lines = [];
            const walk = (line, p) => { for (;;) { const nx = (ends.get(key(p)) || []).find(([i]) => !used[i]); if (!nx) break; used[nx[0]] = true; p = segs[nx[0]][1 - nx[1]]; line.push(p); } };
            segs.forEach((sg, i) => { if (used[i]) return; used[i] = true; const fwd = [sg[0], sg[1]]; walk(fwd, sg[1]); const back = [sg[0]]; walk(back, sg[0]); lines.push(back.reverse().concat(fwd.slice(1))); });
            return lines;
        }
        function generateContours() {
            const tin = getTIN(); if (!tin) return;
            const eq = parseFloat(document.getElementById('ct-eq').value) * 1000, ma = parseInt(document.getElementById('ct-ma').value, 10) || 5, lab = document.getElementById('ct-lab').checked;
            shapes = shapes.filter(x => x.gen !== 'contour');
            const lN = ensureLayer('Courbes de niveau', '#a16207'), lM = ensureLayer('Courbes maîtresses', '#ca8a04', 'solid', 1.6); contourStyleApply(lN, lM);
            let nb = 0;
            contourLevels(tin, eq).forEach(level => {
                const master = Math.abs(Math.round(level / eq) % ma) === 0;
                contourPolylines(tin, level).forEach(pl => {
                    if (pl.length < 2) return;
                    const closed = pl.length > 3 && Math.hypot(pl[0].x - pl[pl.length - 1].x, pl[0].y - pl[pl.length - 1].y) < 1e-6;
                    const pts = (closed ? pl.slice(0, -1) : pl).map(p => ({ x: p.x, y: p.y, z: level }));
                    shapes.push({ type: 'poly', layerId: master ? lM : lN, points: pts, open: !closed, hatch: false, gen: 'contour', zk: 1 }); nb++;
                    if (master && lab && pts.length > 2) { const m = pts[Math.floor(pts.length / 2)], n2 = pts[Math.floor(pts.length / 2) + 1] || pts[0]; shapes.push({ type: 'text', layerId: lM, x: m.x, y: m.y, content: fmtZ(level), size: 20, angle: Math.atan2(n2.y - m.y, n2.x - m.x), gen: 'contour', zk: 1 }); }
                });
            });
            saveState(); closeTopoModal(); updateLayerUI(); draw();
            updateCommandMessageText('COURBES DE NIVEAU : ' + nb + ' courbes, équidistance ' + nfr(eq / 1000, 2) + ' m.');
        }

