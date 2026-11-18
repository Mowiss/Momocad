        // =====================================================================
        // SEMIS DE POINTS : import CSV / TXT (MAT;X;Y;Z;CODE ou X;Y;Z) et export
        // =====================================================================
        function importSemisFile(input) {
            const f = input.files && input.files[0]; input.value = ''; if (!f) return;
            f.text().then(txt => {
                const lines = txt.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
                const num = (t) => { const v = parseFloat(String(t).replace(',', '.')); return isFinite(v) && /^[-+]?\d+([.,]\d+)?$/.test(String(t).trim()) ? v : NaN; };
                const pts = [];
                lines.forEach(l => {
                    let f2 = l.includes(';') ? l.split(';') : l.includes('\t') ? l.split('\t') : (l.split(',').length >= 3 && /\d\.\d/.test(l)) ? l.split(',') : l.split(/\s+/);
                    f2 = f2.map(t => t.trim().replace(/^"|"$/g, ''));
                    const n = f2.map(num);
                    let mat = '', x, y, z, code = '';
                    if (isNaN(n[0]) && n.length >= 4 && !isNaN(n[1]) && !isNaN(n[2])) { mat = f2[0]; x = n[1]; y = n[2]; z = n[3]; code = f2[4] || ''; }
                    else if (n.length >= 4 && !isNaN(n[0]) && !isNaN(n[1]) && !isNaN(n[2]) && !isNaN(n[3]) && Number.isInteger(n[0]) && Math.abs(n[0]) < 1e6 && (Math.abs(n[1]) >= 1000 || Math.abs(n[2]) >= 1000)) { mat = f2[0]; x = n[1]; y = n[2]; z = n[3]; code = f2[4] || ''; }
                    else if (n.length >= 2 && !isNaN(n[0]) && !isNaN(n[1])) { x = n[0]; y = n[1]; z = n[2]; code = isNaN(n[3]) ? (f2[3] || '') : ''; }
                    else return;   // ligne d'en-tête ou illisible
                    pts.push({ mat, x: x * 1000, y: y * 1000, z: isNaN(z) || z === undefined ? undefined : z * 1000, code });
                });
                if (!pts.length) { alert('Aucun point lisible. Format attendu par ligne : MAT;X;Y;Z;CODE ou X;Y;Z (en mètres).'); return; }
                if (!geoOrigin.x && !geoOrigin.y && !shapes.some(sh => !isBg(sh))) {
                    const xs = pts.map(p => p.x).sort((a, b) => a - b), ys = pts.map(p => p.y).sort((a, b) => a - b), mx = xs[xs.length >> 1], my = ys[ys.length >> 1];
                    if (Math.abs(mx) > 1e8 || Math.abs(my) > 1e8) geoOrigin = { x: Math.floor(mx / 1e6) * 1e6, y: Math.floor(my / 1e6) * 1e6 };
                }
                const lay = ensureLayer('Terrain naturel', '#bef264'), added = [];
                pts.forEach(p => { const s0 = { type: 'point', layerId: lay, x: mmToWorld(p.x - geoOrigin.x), y: -mmToWorld(p.y - geoOrigin.y), zk: 1 }; if (hasZ(p.z)) s0.z = p.z; if (p.mat) s0.mat = p.mat; if (p.code) s0.code = p.code; shapes.push(s0); added.push(s0); });
                saveState(); updateLayerUI(); zoomToFitShapes(added); draw();
                updateCommandMessageText('SEMIS : ' + added.length + ' points importés (calque « Terrain naturel »), dont ' + added.filter(p => hasZ(p.z)).length + ' avec altitude.');
            });
        }
        function exportSemis() {
            const pts = shapes.filter(s => s.type === 'point');
            // points de talus (nez / pied) des plateformes
            shapes.filter(isPlateforme).forEach((pl, k) => { const G = talusGeom(pl); if (G) G.marks.forEach((m, j) => {
                pts.push({ x: m.nez.x, y: m.nez.y, z: m.nez.z, mat: 'PF' + (k + 1) + '-N' + (j + 1), code: 'NEZ' }, { x: m.pied.x, y: m.pied.y, z: m.pied.z, mat: 'PF' + (k + 1) + '-P' + (j + 1), code: 'PIED' }); }); });
            if (!pts.length) { alert('Aucun point topo dans le plan.'); return; }
            const f3 = (v) => nfr(v, 3).replace(/\s/g, '').replace(/ /g, '');
            const csv = 'MAT;X;Y;Z;CODE\n' + pts.map((p, i) => [p.mat || ('P' + (i + 1)), f3(realX(p.x) / 1000), f3(realY(p.y) / 1000), hasZ(p.z) ? f3(p.z / 1000) : '', p.code || ''].join(';')).join('\n');
            downloadText((fileName ? baseName(fileName) : 'plan') + '_points.csv', csv);
            updateCommandMessageText('SEMIS : ' + pts.length + ' points exportés (MAT;X;Y;Z;CODE, en mètres).');
        }

        // =====================================================================
        // MÉTRÉ : longueurs, surfaces et nombres par calque (tout le plan ou la sélection)
        // =====================================================================
        function shapeLengthM(s) {
            if (s.type === 'line') return mOf(Math.hypot(s.x2 - s.x1, s.y2 - s.y1));
            if (s.type === 'poly') { let L = 0; for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; L += Math.hypot(b.x - a.x, b.y - a.y); } return mOf(L); }
            if (s.type === 'circle') return mOf(2 * Math.PI * s.r);
            if (s.type === 'arc') { let d = s.endAngle - s.startAngle; if (d < 0) d += 2 * Math.PI; return mOf(s.r * d); }
            return 0;
        }
        function shapeAreaM2(s) {
            const k = Math.pow(mOf(1), 2);
            if (s.type === 'hatch') return hatchArea(s) * k;
            if (s.type === 'poly' && !s.open && s.points.length >= 3) return Math.abs(polyArea(s.points)) * k;
            if (s.type === 'circle') return Math.PI * s.r * s.r * k;
            return 0;
        }
        function metreData(onlySel) { if (lpSpace === 'paper' && !onlySel) return withModel(() => _metreData(false)); return _metreData(onlySel); }
        function _metreData(onlySel) {
            const src = (onlySel ? selectedShapes : shapes).filter(s => !s.gen && !isBg(s));
            const rows = new Map();
            src.forEach(s => {
                const id = s.layerId || 'layer-0'; if (!rows.has(id)) rows.set(id, { lin: 0, hach: 0, ferm: 0, pts: 0, obj: 0, vol: 0 });
                const r = rows.get(id); r.obj++;
                if (s.solid) r.vol += solidVolume(s); else if (s.sweep) { const I = sweepInfo(s); if (I) r.vol += I.vol; } else if (s.type === 'mesh' && s.csg) r.vol += meshVolume(s);
                if (s.type === 'point') r.pts++;
                else if (s.type === 'hatch' || (s.type === 'poly' && s.hatch) || (s.type === 'circle' && s.hatch)) { r.hach += shapeAreaM2(s); if (s.type !== 'hatch') r.lin += shapeLengthM(s); }
                else { r.lin += shapeLengthM(s); r.ferm += shapeAreaM2(s); }
            });
            return [...rows.entries()].map(([id, r]) => Object.assign({ name: (layers.find(l => l.id === id) || {}).name || id }, r));
        }
        // terrassement (cubatures des plateformes cochées) et matériaux des structures, valorisés avec le catalogue produits
        let metreQ = null;
        function metreQuant() {
            const hasT = shapes.some(s => s.trench && s.points.length > 1), hasB = bassinList().length > 0;
            if (!shapes.some(isPlateforme) && !hasT && !hasB) return null;
            let CC = { D: 0, Rm: 0, items: [] }; if (shapes.some(isPlateforme)) { try { CC = withModel(() => cubComputeCached()); } catch (e) { CC = { err: e.message }; } }
            if (CC.err) return { err: CC.err };
            const rows = shapes.some(isPlateforme) ? terrQty(CC.D, CC.Rm).map(q => Object.assign(q, { terr: true })) : [], by = new Map();
            if (hasT) trAllRows().forEach(r => rows.push(Object.assign(r, { name: r.code === '__DEB' ? r.name : 'Tranchées : ' + r.name, terr: r.code === '__DEB' })));
            CC.items.forEach(it => { if (it.st && it.st.layers.length) structQty(it.st, it.area + (it.rec ? it.rec.a : 0)).forEach(q => {
                const r = by.get(q.code) || { name: q.name, code: q.code, surf: q.surf, v: 0, vf: 0, t: 0, A: 0, qp: 0, cout: 0, pu: q.pu, prix: q.prix, pf: new Set() };
                r.v += q.v; r.vf += q.vf; r.t += q.t; r.A += q.A; r.qp += q.qp; r.cout += q.cout; r.pf.add(it.name); by.set(q.code, r); }); });
            by.forEach(r => rows.push(r));
            if (hasB) bassinRows().forEach(r => rows.push(r));
            return { rows, total: rows.reduce((a, r) => a + r.cout, 0), nP: CC.items.length, priced: rows.some(r => r.prix > 0) };
        }
        function metreQRowVals(r) {
            if (r.pu === 'u') return [r.name, nfr(r.qp, 0) + ' u', '—', '—', nfr(r.qp, 0) + ' u', '—', '—'];
            if (r.pu === 'ml') return [r.name, nfr(r.ml || r.qp, 2) + ' ml', '—', '—', nfr(r.qp, 2) + ' ml', r.prix > 0 ? nfr(r.prix, 2) + ' €/ml' : '—', r.prix > 0 ? nfr(r.cout, 2) + ' €' : '—'];
            return [r.terr ? r.name : r.name + (r.code !== r.name ? ' (' + r.code + ')' : ''), r.surf ? nfr(r.A, 2) + ' m²' : nfr(r.v, 2) + ' m³', r.surf ? nfr(r.vf, 2) + ' m²' : nfr(r.vf, 2) + ' m³', r.surf ? '—' : nfr(r.t, 1) + ' t',
                nfr(r.qp, 2) + ' ' + PU_UNIT[r.pu], r.prix > 0 ? nfr(r.prix, 2) + ' €/' + PU_UNIT[r.pu].replace(' fois.', '') : '—', r.prix > 0 ? nfr(r.cout, 2) + ' €' : '—'];
        }
        // ---- Σ CALCULS : un tiroir, un onglet par note de calcul (financière = métré chiffré, cubature, pluviométrique), et un onglet Impressions
        const CALC_TABS = [['fin', '💶', 'Financier'], ['cub', '⛏️', 'Cubature'], ['pluvio', '🌧', 'Pluvio'], ['print', '🖨', 'Imprimer']];
        let calcCur = 'fin';
        function calcTabs(cur) { calcCur = cur; return '<div class="calc-tabs" role="tablist">' + CALC_TABS.map(([k, ic, l]) => `<button type="button" role="tab" data-ct="${k}" class="${k === cur ? 'on' : ''}" onclick="calcTab('${k}')" title="${l}"><span class="ci">${ic}</span><small>${l}</small></button>`).join('') + '</div>'; }
        function calcTab(k) { if (k === 'fin') openMetre(); else if (k === 'cub') openCubatureDialog(); else if (k === 'pluvio') openPluvio(); else openCalcPrint(); }
        // NOTE PLUVIOMÉTRIQUE : pluie de projet, surfaces par revêtement (mêmes mailles que le test d'écoulement), coefficients de ruissellement,
        // débit de pointe (méthode rationnelle), volume ruisselé, volume à stocker pour un débit de fuite ; et le bilan du dernier test d'écoulement.
        let pluvioNote = null;
        const PLUV_C = { tn: 0.3, imp: 0.95, grave: 0.6, terre: 0.25, toit: 0.95, talus: 0.4 };
        function pluvioCfg() { const N = pluvioNote || (pluvioNote = {}); if (!(N.I > 0)) N.I = 60; if (!(N.Tr > 0)) N.Tr = 15; if (!(N.qf >= 0)) N.qf = 3; N.C = Object.assign({}, PLUV_C, N.C || {}); return N; }
        let pvSC = null;
        function pluvioSurf() { const key = renderEpoch + '/' + historyStep + '/' + shapes.length; if (pvSC && pvSC.key === key) return pvSC.v; const v = pluvioSurf0(); pvSC = { key, v }; return v; }
        function pluvioSurf0() { let E = null; try { E = ecGrid(12000); } catch (e) {} if (!E) return null; const A = E.c * E.c, S = EC_SURF.map(() => 0); for (let k = 0; k < E.n; k++) if (!isNaN(E.z[k])) S[E.surf[k]] += A; return S; }
        function pluvioCalc(N) { const S = N.S || []; let At = 0, Ca = 0; EC_SURF.forEach(([k], i) => { const a = S[i] || 0; At += a; Ca += a * (+N.C[k] || 0); });
            const Q = Ca * N.I / 3600, V = Ca * N.I / 1000 * N.Tr / 60, Qf = N.qf * At / 10000, Vs = Math.max(0, (Q - Qf) * N.Tr * 60 / 1000);
            return { At, Ca, Cm: At ? Ca / At : 0, Q, V, Qf, Vs }; }
        // à la fin d'un test d'écoulement : son bilan va dans la note
        function pluvioSaveTest(E, held) { const N = pluvioCfg(); const nm = (z, i) => z.on ? 'Cuvette ' + (i + 1) + ' (' + z.on + ')' : 'Cuvette ' + (i + 1);
            N.test = { date: Date.now(), I: E.I, Tr: E.Tr, Td: E.Td, real: !!E.hyeto, hmm: E.hyeto ? E.hyeto.reduce((a, v) => a + v, 0) : E.I * E.Tr / 60, rainV: E.rainV, infV: E.infV, out: E.out, held,
                ret: (E.ret || []).slice(0, 40).map((z, i) => ({ name: nm(z, i), area: z.area, cap: z.cap, got: z.got || 0, pct: z.pct || 0, max: z.max })) }; }
        function openPluvio() { const N = pluvioCfg(); N.S = undefined;
            const tests = `<div id="pv-test"></div>`;
            const body = calcTabs('pluvio') + `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px;">
                ${cubCard(`<div style="font-size:15px;font-weight:600;margin-bottom:8px;">Pluie de projet</div>
                    <table style="width:100%;font-size:13px;border-collapse:collapse;"><tr><td style="padding:4px 0;">Intensité</td><td style="text-align:right;"><input id="pv-i" class="pv-in" value="${nfr(N.I, 0)}"><span class="pv-u">mm/h</span></td></tr>
                    <tr><td style="padding:4px 0;">Durée</td><td style="text-align:right;"><input id="pv-tr" class="pv-in" value="${nfr(N.Tr, 0)}"><span class="pv-u">min</span></td></tr>
                    <tr><td style="padding:4px 0;">Débit de fuite autorisé</td><td style="text-align:right;"><input id="pv-qf" class="pv-in" value="${nfr(N.qf, 1)}"><span class="pv-u">l/s/ha</span></td></tr></table>
                    <div id="pv-res" style="margin-top:10px;"></div>`)}
                ${cubCard(`<div style="font-size:15px;font-weight:600;margin-bottom:8px;">Surfaces et coefficients de ruissellement</div><div id="pv-surf"></div>`)}</div>
                <div style="margin-top:12px;">${cubCard('<div id="pv-flow"></div>')}</div>
                <div style="margin-top:12px;">${cubCard(tests)}</div>`;
            openTopoModal('Σ Calculs', body, [['Copier (tableur)', () => copyText(pluvioTSV()), false], ['💧 Test d\'écoulement', () => { closeTopoModal(); ecOpen(); }, false], ['🖨 Imprimer la note', () => pluvioPDF(), true]]);
            const b = document.getElementById('tm-body'); b.oninput = (e) => { const t = e.target, v = t2Num(t.value); if (!isFinite(v) || v < 0) return;
                if (t.id === 'pv-i') N.I = v; else if (t.id === 'pv-tr') N.Tr = v; else if (t.id === 'pv-qf') N.qf = v; else if (t.dataset.c) N.C[t.dataset.c] = Math.min(1, v); else return; pluvioRender(true); };
            pluvioRender(); setTimeout(() => { if (N.S !== undefined || !document.getElementById('pv-surf')) return; N.S = pluvioSurf(); pluvioRender(); }, 30); }
        function pluvioRender(soft) { const N = pluvioCfg(), R = pluvioCalc(N), S = N.S, td = 'padding:4px 6px;text-align:right;white-space:nowrap;';
            const sv = document.getElementById('pv-surf'); if (S === undefined) { if (sv) sv.innerHTML = '<p style="color:#9ca3af;font-size:13px;">Mesure des surfaces…</p>'; const rs0 = document.getElementById('pv-res'); if (rs0) rs0.innerHTML = ''; } if (sv && !soft && S !== undefined) sv.innerHTML = S ? `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="color:#9ca3af;"><th style="text-align:left;padding:4px 6px;">Revêtement</th><th style="${td}">Surface</th><th style="${td}">C</th><th style="${td}">Surface active</th></tr></thead><tbody>`
                + EC_SURF.map(([k, l], i) => S[i] > 0.05 ? `<tr style="border-top:1px solid #374151;"><td style="padding:4px 6px;">${l}</td><td style="${td}">${nfr(S[i], 0)} m²</td><td style="${td}"><input class="pv-in" style="width:56px" data-c="${k}" value="${nfr(N.C[k], 2)}"></td><td style="${td}" id="pv-ca-${k}"></td></tr>` : '').join('')
                + `<tr style="border-top:2px solid #6b7280;font-weight:700;"><td style="padding:4px 6px;">Total</td><td style="${td}">${nfr(R.At, 0)} m²</td><td style="${td}" id="pv-cm"></td><td style="${td}" id="pv-ca"></td></tr></tbody></table>`
                : '<p style="color:#fca5a5;font-size:13px;">Il faut un terrain : au moins 3 points cotés.</p>';
            if (S) { EC_SURF.forEach(([k], i) => { const c = document.getElementById('pv-ca-' + k); if (c) c.textContent = nfr(S[i] * (+N.C[k] || 0), 0) + ' m²'; }); const a = document.getElementById('pv-ca'), m = document.getElementById('pv-cm'); if (a) a.textContent = nfr(R.Ca, 0) + ' m²'; if (m) m.textContent = nfr(R.Cm, 2); }
            const big = (l, v, c) => `<div style="flex:1;min-width:120px;background:#0b1220;border:1px solid #374151;border-radius:8px;padding:8px 10px;"><div style="color:#9ca3af;font-size:12px;">${l}</div><div style="font-size:19px;font-weight:700;color:${c};">${v}</div></div>`;
            const rs = document.getElementById('pv-res'); if (rs && S !== undefined) rs.innerHTML = S ? `<div style="display:flex;flex-wrap:wrap;gap:8px;">${big('Débit de pointe', nfr(R.Q, 1) + ' l/s', '#60a5fa')}${big('Volume ruisselé', nfr(R.V, 1) + ' m³', '#93c5fd')}${big('Volume à stocker', nfr(R.Vs, 1) + ' m³', R.Vs > 0 ? '#fbbf24' : '#4ade80')}</div>
                <p style="color:#9ca3af;font-size:12px;margin-top:6px;">Q = C × i × A · fuite ${nfr(R.Qf, 1)} l/s sur ${nfr(R.At / 10000, 2)} ha</p>` + pluvioBassinsHTML(R) : '';
            { const fl = document.getElementById('pv-flow'); if (fl) fl.innerHTML = S ? pluvioFlowSVG(R, N) : ''; }
            const tv = document.getElementById('pv-test'); if (!tv || soft) return; const T = N.test;
            if (!T) { tv.innerHTML = `<div style="font-size:15px;font-weight:600;margin-bottom:4px;">Test d'écoulement</div><p style="color:#9ca3af;font-size:13px;">Pas encore de test sur ce projet.</p>`; return; }
            const L = (l, v, c) => `<div style="display:flex;justify-content:space-between;gap:10px;"><span>${l}</span><b style="color:${c || '#e5e7eb'}">${v}</b></div>`;
            tv.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;"><div style="font-size:15px;font-weight:600;">Test d'écoulement</div><span style="color:#9ca3af;font-size:12px;">${new Date(T.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${T.real ? 'orage réel du site' : nfr(T.I, 0) + ' mm/h pendant ' + nfr(T.Tr, 0) + ' min'} · ${nfr(T.hmm, 1)} mm</span></div>
                <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 24px;font-size:13px;">${L('Pluie tombée', nfr(T.rainV, 1) + ' m³')}${L('Infiltrée', nfr(T.infV, 1) + ' m³', '#a3e635')}${L('Ruisselée hors du terrain', nfr(T.out, 1) + ' m³', '#60a5fa')}${L('Retenue', nfr(T.held, 2) + ' m³', T.held > 0.05 ? '#f87171' : '#4ade80')}</div>`
                + (T.ret.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;"><thead><tr style="color:#9ca3af;"><th style="text-align:left;padding:4px 6px;">Cuvette</th><th style="${td}">Surface</th><th style="${td}">Capacité</th><th style="${td}">Eau reçue</th><th style="${td}">Remplissage</th></tr></thead><tbody>`
                    + T.ret.map(z => `<tr style="border-top:1px solid #374151;"><td style="padding:4px 6px;">${z.name.replace(/</g, '&lt;')}</td><td style="${td}">${nfr(z.area, 1)} m²</td><td style="${td}">${nfr(z.cap, 2)} m³</td><td style="${td}">${nfr(z.got, 2)} m³</td><td style="${td}color:${z.pct >= 0.98 ? '#fb923c' : '#e5e7eb'}">${Math.round(z.pct * 100)} %</td></tr>`).join('') + '</tbody></table>'
                    : '<p style="color:#4ade80;font-size:13px;margin-top:8px;">Aucune cuvette : partout l\'eau a une pente pour partir.</p>'); }
        // schéma du parcours de l'eau : pluie → surfaces actives → débit de pointe → stockage → fuite ; les bassins du plan en face du volume à stocker
        function pluvioFlowSVG(R, N) { const B = pluvioBassins(), Vb = B.reduce((a, x) => a + x.C.Vut, 0), ok = B.length && Vb >= R.Vs - 0.05, W = 900, box = (x, w, t, v, c, sub) => `<g><rect x="${x}" y="28" width="${w}" height="74" rx="9" fill="#0b1220" stroke="${c}" stroke-width="1.5"/><text x="${x + w / 2}" y="50" text-anchor="middle" font-size="12" fill="#9ca3af">${t}</text><text x="${x + w / 2}" y="74" text-anchor="middle" font-size="17" font-weight="700" fill="${c}">${v}</text>${sub ? `<text x="${x + w / 2}" y="93" text-anchor="middle" font-size="11" fill="#9ca3af">${sub}</text>` : ''}</g>`,
                arr = (x) => `<path d="M${x} 65 h22" stroke="#6b7280" stroke-width="2" fill="none"/><path d="M${x + 22} 59 l8 6 l-8 6 z" fill="#6b7280"/>`;
            let g = `<div style="font-size:15px;font-weight:600;margin-bottom:6px;">Parcours de l'eau</div><svg viewBox="0 0 ${W} 150" width="100%" style="display:block">`;
            g += box(0, 150, '🌧 Pluie de projet', nfr(N.I, 0) + ' mm/h', '#93c5fd', nfr(N.Tr, 0) + ' min') + arr(154) + box(186, 160, 'Surface active', nfr(R.Ca, 0) + ' m²', '#e5e7eb', 'C moyen ' + nfr(R.Cm, 2)) + arr(350)
                + box(382, 150, 'Débit de pointe', nfr(R.Q, 1) + ' l/s', '#60a5fa', 'Q = C·i·A') + arr(536) + box(568, 150, 'À stocker', nfr(R.Vs, 1) + ' m³', '#fbbf24', B.length ? 'bassins : ' + nfr(Vb, 1) + ' m³' : 'aucun bassin dessiné') + arr(722) + box(754, 146, 'Fuite autorisée', nfr(R.Qf, 1) + ' l/s', '#a3e635', nfr(N.qf, 1) + ' l/s/ha');
            g += `<text x="${568 + 75}" y="128" text-anchor="middle" font-size="12" font-weight="700" fill="${!B.length ? '#9ca3af' : ok ? '#4ade80' : '#f87171'}">${!B.length ? 'Dessinez un bassin (palette Topo)' : ok ? '✓ les bassins du plan suffisent' : '✗ il manque ' + nfr(R.Vs - Vb, 1) + ' m³'}</text></svg>`;
            return g; }
        function pluvioBassins() { return bassinList().map(s => ({ s, C: bassinCalc(s) })).filter(x => x.C); }
        function pluvioBassinsHTML(R) { const L = pluvioBassins(); if (!L.length) return ''; const V = L.reduce((a, x) => a + x.C.Vut, 0), ok = V >= R.Vs - 1e-6;
            return `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid ${ok ? '#166534' : '#7f1d1d'};background:${ok ? 'rgba(22,101,52,.15)' : 'rgba(127,29,29,.15)'};font-size:13px;">🛢 Bassins (${L.length}) : <b>${nfr(V, 1)} m³</b> utiles — ${ok ? 'couvre' : 'ne couvre pas'} le volume à stocker (${nfr(R.Vs, 1)} m³)</div>`; }
        function pluvioTSV() { const N = pluvioCfg(); if (!N.S) N.S = pluvioSurf(); const R = pluvioCalc(N), S = N.S || [], out = ['Revêtement\tSurface (m²)\tC\tSurface active (m²)'];
            EC_SURF.forEach(([k, l], i) => { if (S[i] > 0.05) out.push([l, nfr(S[i], 0), nfr(N.C[k], 2), nfr(S[i] * N.C[k], 0)].join('\t')); });
            out.push(['Total', nfr(R.At, 0), nfr(R.Cm, 2), nfr(R.Ca, 0)].join('\t'), '', 'Intensité (mm/h)\t' + nfr(N.I, 0), 'Durée (min)\t' + nfr(N.Tr, 0), 'Débit de pointe (l/s)\t' + nfr(R.Q, 1), 'Volume ruisselé (m³)\t' + nfr(R.V, 1), 'Débit de fuite (l/s)\t' + nfr(R.Qf, 1), 'Volume à stocker (m³)\t' + nfr(R.Vs, 1));
            return out.join('\n'); }
        // en-tête commun des notes imprimées (logo, plan, client, dessinateur, date)
        function calcPdfHeader(doc, title, right) { const W = 210, M = 15, base = (fileName ? baseName(fileName) : 'plan'); let x = M;
            if (cartoucheData.logo) { try { const lb = logoBox(20); doc.addImage(cartoucheData.logo, M + lb.x, M + lb.y, lb.w, lb.h, undefined, 'FAST'); x = M + 24; } catch (e) {} }
            doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(title, x, M + 7); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
            [cartoucheData.planName ? 'Plan : ' + cartoucheData.planName + (cartoucheIndice(cartoucheData.indice) ? '  (' + cartoucheIndice(cartoucheData.indice) + ')' : '') : 'Fichier : ' + base, cartoucheData.clientName ? 'Client : ' + cartoucheData.clientName : '', cartoucheData.draftsmanName ? 'Dessinateur : ' + cartoucheData.draftsmanName : ''].filter(Boolean).forEach((t, i) => doc.text(t, x, M + 13 + i * 4.6));
            doc.text(new Date().toLocaleDateString('fr-FR'), W - M, M + 7, { align: 'right' }); if (right) doc.text(right, W - M, M + 13, { align: 'right' });
            doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.6); doc.line(M, M + 26, W - M, M + 26); return M + 34; }
        const pdfTxt = (t) => String(t).replace(/[  ]/g, ' ').replace(/³/g, '3').replace(/²/g, '2');
        function pluvioPDF(D) { if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; } const N = pluvioCfg(); if (!N.S) N.S = pluvioSurf(); const R = pluvioCalc(N), S = N.S || [];
            const { jsPDF } = window.jspdf, doc = D ? D.doc : new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); if (D) { if (D.used) doc.addPage(); D.used = true; }
            const W = 210, M = 15, base = (fileName ? baseName(fileName) : 'plan'); let y = calcPdfHeader(doc, 'Note pluviométrique');
            const h2 = (t) => { doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(pdfTxt(t), M, y); y += 6; };
            const table = (cols, rows) => { doc.setFillColor(31, 41, 55); doc.rect(M, y - 4.6, W - 2 * M, 7, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); let x = M; cols.forEach(c => { doc.text(c.t, c.l ? x + 2 : x + c.w - 2, y, { align: c.l ? 'left' : 'right' }); x += c.w; }); y += 7;
                rows.forEach((r, k) => { if (y > 278) { doc.addPage(); y = calcPdfHeader(doc, 'Note pluviométrique (suite)'); } if (r.top) { doc.setDrawColor(107, 114, 128); doc.setLineWidth(0.4); doc.line(M, y - 4.4, W - M, y - 4.4); } else if (k % 2) { doc.setFillColor(243, 244, 246); doc.rect(M, y - 4.4, W - 2 * M, 6.4, 'F'); }
                    doc.setTextColor(20); doc.setFont('helvetica', r.b ? 'bold' : 'normal'); doc.setFontSize(9); let x = M; cols.forEach((c, i) => { doc.text(pdfTxt(r.v[i]), c.l ? x + 2 : x + c.w - 2, y, { align: c.l ? 'left' : 'right' }); x += c.w; }); y += 6.4; }); y += 5; };
            h2('Pluie de projet'); table([{ t: 'Paramètre', w: 120, l: 1 }, { t: 'Valeur', w: 60 }], [{ v: ['Intensité', nfr(N.I, 0) + ' mm/h'] }, { v: ['Durée', nfr(N.Tr, 0) + ' min'] }, { v: ['Hauteur d\'eau', nfr(N.I * N.Tr / 60, 1) + ' mm'] }, { v: ['Débit de fuite autorisé', nfr(N.qf, 1) + ' l/s/ha'] }]);
            h2('Surfaces et coefficients de ruissellement');
            if (S.length) table([{ t: 'Revêtement', w: 80, l: 1 }, { t: 'Surface (m2)', w: 35 }, { t: 'C', w: 25 }, { t: 'Surf. active (m2)', w: 40 }], EC_SURF.map(([k, l], i) => S[i] > 0.05 ? { v: [l, nfr(S[i], 0), nfr(N.C[k], 2), nfr(S[i] * N.C[k], 0)] } : null).filter(Boolean).concat([{ top: 1, b: 1, v: ['Total', nfr(R.At, 0), nfr(R.Cm, 2), nfr(R.Ca, 0)] }]));
            else { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Pas de terrain (points cotés) : surfaces non calculées.', M, y); y += 8; }
            h2('Résultats (méthode rationnelle Q = C x i x A)'); table([{ t: 'Grandeur', w: 120, l: 1 }, { t: 'Valeur', w: 60 }], [{ v: ['Débit de pointe', nfr(R.Q, 1) + ' l/s'] }, { v: ['Volume ruisselé pendant la pluie', nfr(R.V, 1) + ' m3'] }, { v: ['Débit de fuite (' + nfr(R.At / 10000, 2) + ' ha)', nfr(R.Qf, 1) + ' l/s'] }, { b: 1, top: 1, v: ['Volume à stocker', nfr(R.Vs, 1) + ' m3'] }].concat(pluvioBassins().length ? [{ v: ['Volume utile des bassins de rétention (' + pluvioBassins().length + ')', nfr(pluvioBassins().reduce((a, x) => a + x.C.Vut, 0), 1) + ' m3'] }] : []));
            const T = N.test; if (T) { if (y > 230) { doc.addPage(); y = calcPdfHeader(doc, 'Note pluviométrique (suite)'); }
                h2('Test d\'écoulement sur le terrain fini (' + new Date(T.date).toLocaleDateString('fr-FR') + ')');
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60); doc.text(pdfTxt(T.real ? 'Orage réel du site, ' + nfr(T.hmm, 1) + ' mm.' : 'Pluie de ' + nfr(T.I, 0) + ' mm/h pendant ' + nfr(T.Tr, 0) + ' min (' + nfr(T.hmm, 1) + ' mm), puis ' + nfr(T.Td, 0) + ' min de ressuyage.'), M, y); y += 6;
                table([{ t: 'Bilan', w: 120, l: 1 }, { t: 'Volume (m3)', w: 60 }], [{ v: ['Pluie tombée', nfr(T.rainV, 1)] }, { v: ['Infiltrée', nfr(T.infV, 1)] }, { v: ['Ruisselée hors du terrain', nfr(T.out, 1)] }, { b: 1, top: 1, v: ['Retenue (cuvettes, film d\'eau)', nfr(T.held, 2)] }]);
                if (T.ret.length) table([{ t: 'Cuvette', w: 70, l: 1 }, { t: 'Surface (m2)', w: 28 }, { t: 'Capacité (m3)', w: 28 }, { t: 'Eau reçue (m3)', w: 28 }, { t: 'Rempl.', w: 26 }], T.ret.map(z => ({ v: [z.name, nfr(z.area, 1), nfr(z.cap, 2), nfr(z.got, 2), Math.round(z.pct * 100) + ' %'] })));
                else { doc.text('Aucune cuvette : partout l\'eau a une pente pour partir.', M, y); y += 8; } }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(doc.splitTextToSize('Surfaces mesurées sur le terrain fini (plateformes, revêtements, toitures). Coefficients de ruissellement modifiables dans Σ Calculs › Pluviométrique. Le volume à stocker est une estimation sur la pluie de projet (pluie constante).', W - 2 * M), M, Math.min(y + 2, 280));
            if (D) return; doc.save(base + '_note_pluvio.pdf'); updateCommandMessageText('NOTE PLUVIOMÉTRIQUE : PDF « ' + base + '_note_pluvio.pdf » produit.'); }
        // IMPRESSIONS : choisir les notes, une par une ou toutes dans un seul PDF (page de garde et sommaire)
        let calcPrint = { fin: true, cub: true, cubDet: false, pluvio: true };
        function openCalcPrint() { const P = calcPrint, ck = (k, l, sub) => `<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #374151;border-radius:8px;background:#0b1220;cursor:pointer;"><input type="checkbox" data-pk="${k}" ${P[k] ? 'checked' : ''} style="width:17px;height:17px;margin-top:2px;"><span><b>${l}</b><br><small style="color:#9ca3af">${sub}</small></span></label>`;
            const one = (k, l) => `<button type="button" onclick="calcPrintOne('${k}')" style="background:#374151;color:#e5e7eb;border:0;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12.5px;">🖨 ${l}</button>`;
            const body = calcTabs('print') + cubCard(`<div style="font-size:15px;font-weight:600;margin-bottom:10px;">Dossier de notes de calcul</div><div style="display:grid;gap:8px;">
                ${ck('fin', '💶 Note financière', 'Métré par calque, terrassement et matériaux chiffrés, total HT')}
                ${ck('cub', '⛏️ Note de cubature', 'Déblai, remblai, talus, plateforme par plateforme')}
                <label style="display:flex;gap:8px;align-items:center;margin:-2px 0 2px 38px;color:#cbd5e1;font-size:13px;cursor:pointer;"><input type="checkbox" data-pk="cubDet" ${P.cubDet ? 'checked' : ''}> avec le détail par triangle</label>
                ${ck('pluvio', '🌧 Note pluviométrique', 'Pluie de projet, surfaces actives, débit de pointe, stockage, test d\'écoulement')}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;"><span style="color:#9ca3af;font-size:12.5px;align-self:center;">Une note seule :</span>${one('fin', 'Financière')}${one('cub', 'Cubature')}${one('pluvio', 'Pluviométrique')}</div>`)
                + `<div style="margin-top:12px">${cubCard('<div style="font-size:15px;font-weight:600;margin-bottom:10px;">Aperçu de la première page</div><div id="cp-prev"></div>')}</div>`;
            openTopoModal('Σ Calculs', body, [['Fermer', closeTopoModal, false], ['🖨 Imprimer le dossier', () => calcDossierPDF(), true]]);
            document.getElementById('tm-body').onchange = (e) => { const k = e.target.dataset && e.target.dataset.pk; if (k) { calcPrint[k] = e.target.checked; calcPrintPreview(); } }; calcPrintPreview(); }
        // aperçu de la page de garde du dossier : en-tête (logo, plan, client, dessinateur, date) et sommaire des notes cochées
        function calcPrintPreview() { const el = document.getElementById('cp-prev'); if (!el) return; const P = calcPrint, C = cartoucheData || {}, E = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'), base = fileName ? baseName(fileName) : 'plan';
            const parts = [['fin', 'Note financière'], ['cub', 'Note de cubature'], ['pluvio', 'Note pluviométrique']].filter(([k]) => P[k]);
            const info = [C.planName ? 'Plan : ' + C.planName + (cartoucheIndice(C.indice) ? '  (' + cartoucheIndice(C.indice) + ')' : '') : 'Fichier : ' + base, C.clientName ? 'Client : ' + C.clientName : '', C.draftsmanName ? 'Dessinateur : ' + C.draftsmanName : ''].filter(Boolean);
            el.innerHTML = `<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap"><div style="width:260px;aspect-ratio:210/297;max-width:100%;background:#fff;color:#141414;border-radius:3px;box-shadow:0 6px 20px rgba(0,0,0,.45);padding:14px 14px;font-family:Helvetica,Arial,sans-serif;display:flex;flex-direction:column;gap:6px;overflow:hidden">
                <div style="display:flex;gap:8px;align-items:flex-start">${C.logo ? `<img src="${C.logo}" style="width:28px;height:28px;object-fit:contain">` : ''}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">Notes de calcul</div>${info.map(t => `<div style="font-size:7px;color:#3c3c3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${E(t)}</div>`).join('')}</div><div style="font-size:7px;color:#3c3c3c">${new Date().toLocaleDateString('fr-FR')}</div></div>
                <div style="height:2px;background:#2563eb;margin:2px 0 6px"></div><div style="font-weight:700;font-size:9px">Sommaire</div>
                ${parts.length ? parts.map(([k, l], i) => `<div style="display:flex;gap:4px;font-size:8px;align-items:baseline"><span>${i + 1}. ${l}</span><span style="flex:1;border-bottom:1px dotted #9ca3af"></span><span>p. ${i + 2}</span></div>`).join('') : '<div style="font-size:8px;color:#b91c1c">Aucune note cochée</div>'}</div>
                <div style="flex:1;min-width:180px;font-size:12.5px;color:#9ca3af">Le dossier commence par cette page, puis une note par partie cochée. Logo, nom du plan, client et dessinateur viennent du cartouche (⛯ Paramètres) ; les numéros de page exacts sont calculés à l'impression.</div></div>`; }
        // cubatures pas encore calculées : on les calcule sans afficher la fenêtre
        function calcCubReady() { if (window.__cubPdf) return true; let tmp = null; if (!document.getElementById('cb-res')) { tmp = document.createElement('div'); tmp.id = 'cb-res'; tmp.style.display = 'none'; document.body.appendChild(tmp); }
            try { runCubature(); } catch (e) { console.error(e); } if (tmp) tmp.remove(); return !!window.__cubPdf; }
        async function calcPrintOne(k) { if (k === 'fin') { metreQ = metreQuant(); metrePDF(); } else if (k === 'cub') { if (!calcCubReady()) { updateCommandMessageText('NOTE DE CUBATURE : rien à calculer (il faut des points cotés et au moins une plateforme cochée).'); return; } await cubPDF(calcPrint.cubDet); } else pluvioPDF(); }
        async function calcDossierPDF() { if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; } const P = calcPrint, parts = [];
            if (P.fin) parts.push(['fin', 'Note financière']); if (P.cub) { if (calcCubReady()) parts.push(['cub', 'Note de cubature']); else updateCommandMessageText('DOSSIER : note de cubature sautée (pas de plateforme ou pas de terrain).'); } if (P.pluvio) parts.push(['pluvio', 'Note pluviométrique']);
            if (!parts.length) { updateCommandMessageText('DOSSIER : coche au moins une note.'); return; }
            const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }), D = { doc, used: true }, base = (fileName ? baseName(fileName) : 'plan'), start = [];
            let y = calcPdfHeader(doc, 'Notes de calcul') + 10;
            for (const [k] of parts) { start.push(doc.getNumberOfPages() + 1); if (k === 'fin') { metreQ = metreQuant(); metrePDF(D); } else if (k === 'cub') await cubPDF(P.cubDet, D); else pluvioPDF(D); }
            doc.setPage(1); doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Sommaire', 15, y); y += 9; doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
            parts.forEach(([, l], i) => { doc.text((i + 1) + '.  ' + l, 20, y); doc.text('page ' + start[i], 195, y, { align: 'right' }); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.2); doc.line(20, y + 2, 195, y + 2); y += 9; });
            const fn = base + '_notes_de_calcul.pdf'; doc.save(fn); updateCommandMessageText('DOSSIER : « ' + fn + ' » produit (' + doc.getNumberOfPages() + ' pages, ' + parts.length + ' note(s)).'); }
        function openMetre() {
            const sel = selectedShapes.length > 0; const heavy = shapes.some(isPlateforme) || shapes.some(s => s.trench) || bassinList().length > 0; metreQ = heavy ? { pending: true } : null;
            const body = `<div class="mf-seg" style="max-width:420px;margin-bottom:12px"><label><input type="radio" name="mt-scope" value="all" ${sel ? '' : 'checked'} onchange="renderMetre()"><span>Tout le plan</span></label><label title="${sel ? '' : 'Sélectionnez des objets sur le plan avant d\'ouvrir le métré'}"><input type="radio" name="mt-scope" value="sel" ${sel ? 'checked' : 'disabled'} onchange="renderMetre()"><span>Sélection (${selectedShapes.length} objet(s))</span></label></div><div id="mt-table"></div>
                <p style="color:#9ca3af;font-size:12px;margin-top:8px;">Linéaire : lignes, polylignes, arcs et cercles (en m). Surface hachurée : hachures et formes hachurées (m²). Surface des contours fermés : polylignes fermées et cercles non hachurés (m²). Volumes 3D : solides et balayages (m³). Les fonds, courbes et profils générés ne sont pas comptés.</p><div id="mt-quant"></div>`;
            openTopoModal('Σ Calculs', calcTabs('fin') + body, [['Copier (tableur)', () => copyText(metreTSV()), false], ['Exporter CSV', () => downloadText((fileName ? baseName(fileName) : 'plan') + '_metre.csv', metreTSV().replace(/\t/g, ';')), false], ['🖨 Imprimer la note', () => metrePDF(), true]]);
            renderMetre(); if (heavy) setTimeout(() => { if (!(metreQ && metreQ.pending)) return; metreQ = metreQuant(); if (document.getElementById('mt-quant')) renderMetre(); }, 30);
        }
        function metreRowsNow() { const sc = document.querySelector('input[name=mt-scope]:checked'); return metreData(sc && sc.value === 'sel'); }
        function renderMetre() {
            const rows = metreRowsNow(), tot = rows.reduce((t, r) => ({ lin: t.lin + r.lin, hach: t.hach + r.hach, ferm: t.ferm + r.ferm, pts: t.pts + r.pts, obj: t.obj + r.obj, vol: t.vol + r.vol }), { lin: 0, hach: 0, ferm: 0, pts: 0, obj: 0, vol: 0 });
            const td = (v, c) => `<td style="padding:4px 8px;text-align:right;${c ? 'color:' + c + ';' : ''}">${v}</td>`;
            document.getElementById('mt-table').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="color:#9ca3af;text-align:right;"><th style="text-align:left;padding:4px 8px;">Calque</th><th style="padding:4px 8px;">Linéaire (m)</th><th style="padding:4px 8px;">Surface hachurée (m²)</th><th style="padding:4px 8px;">Contours fermés (m²)</th><th style="padding:4px 8px;">Volumes 3D (m³)</th><th style="padding:4px 8px;">Points topo</th><th style="padding:4px 8px;">Objets</th></tr></thead><tbody>'
                + rows.map(r => `<tr style="border-top:1px solid #374151;"><td style="padding:4px 8px;">${r.name.replace(/</g, '&lt;')}</td>${td(r.lin ? nfr(r.lin, 2) : '—', '#bef264')}${td(r.hach ? nfr(r.hach, 2) : '—', '#93c5fd')}${td(r.ferm ? nfr(r.ferm, 2) : '—')}${td(r.vol ? nfr(r.vol, 3) : '—', '#d8b4fe')}${td(r.pts || '—')}${td(r.obj)}</tr>`).join('')
                + `<tr style="border-top:2px solid #6b7280;font-weight:700;"><td style="padding:4px 8px;">Total</td>${td(nfr(tot.lin, 2), '#bef264')}${td(nfr(tot.hach, 2), '#93c5fd')}${td(nfr(tot.ferm, 2))}${td(nfr(tot.vol, 3), '#d8b4fe')}${td(tot.pts)}${td(tot.obj)}</tr></tbody></table>`;
            const qb = document.getElementById('mt-quant'); if (!qb) return; const Q = metreQ;
            if (!Q) { qb.innerHTML = ''; return; }
            if (Q.pending) { qb.innerHTML = '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #374151;color:#9ca3af;"><b style="color:#e5e7eb">Terrassement et matériaux</b> · calcul…</div>'; return; }
            const head = '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #374151;display:flex;justify-content:space-between;align-items:baseline;gap:10px;"><b>Terrassement et matériaux</b><button type="button" style="color:#7dd3fc;font-size:12px;" onclick="closeTopoModal&&closeTopoModal();openCartoucheModal();psTab(\'mat\')">Prix : catalogue produits ⛯</button></div>';
            if (Q.err) { qb.innerHTML = head + '<p style="color:#fca5a5;font-size:12.5px;">' + Q.err + '</p>'; return; }
            const tdq = (v, c) => `<td style="padding:4px 8px;text-align:right;white-space:nowrap;${c ? 'color:' + c + ';' : ''}">${v}</td>`;
            qb.innerHTML = head + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;"><thead><tr style="color:#9ca3af;text-align:right;"><th style="text-align:left;padding:4px 8px;">Poste</th><th style="padding:4px 8px;">En place</th><th style="padding:4px 8px;">Foisonné</th><th style="padding:4px 8px;">Tonnage</th><th style="padding:4px 8px;">Quantité</th><th style="padding:4px 8px;">P.U. HT</th><th style="padding:4px 8px;">Montant HT</th></tr></thead><tbody>'
                + Q.rows.map((r, i) => { const v = metreQRowVals(r); return `<tr style="border-top:${i === 2 ? 2 : 1}px solid ${i === 2 ? '#4b5563' : '#374151'};"><td style="padding:4px 8px;${r.terr ? 'color:' + (r.code === '__DEB' ? '#fca5a5' : '#93c5fd') + ';' : ''}">${v[0].replace(/</g, '&lt;')}</td>${tdq(v[1])}${tdq(v[2], '#fbbf24')}${tdq(v[3])}${tdq(v[4])}${tdq(v[5], '#9ca3af')}${tdq(v[6])}</tr>`; }).join('')
                + `<tr style="border-top:2px solid #6b7280;font-weight:700;"><td style="padding:4px 8px;" colspan="6">Total HT</td>${Q.priced ? tdq(nfr(Q.total, 2) + ' €', '#bef264') : `<td style="padding:4px 8px;text-align:right;white-space:nowrap"><button type="button" onclick="closeTopoModal&&closeTopoModal();openCartoucheModal();psTab('mat')" style="color:#fbbf24;font-weight:700;background:none;border:1px dashed #fbbf24;border-radius:6px;padding:2px 8px;cursor:pointer" title="Ouvrir le catalogue produits pour saisir les prix">prix à renseigner ⛯</button></td>`}</tr></tbody></table>`
                + `<p style="color:#9ca3af;font-size:12px;margin-top:6px;">Déblai / remblai : cubatures des ${Q.nP} plateforme(s) cochée(s) (talus compris). Matériaux : structures saisies dans Y › Structure, cumulées par produit.</p>`;
        }
        // Métré en PDF (A4) : en-tête du cartouche (logo, plan, client, dessinateur, indice), tableau par calque, totaux
        function metrePDF(D) {
            if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; }
            const rows = metreRowsNow(), sc = document.querySelector('input[name=mt-scope]:checked'), onlySel = sc && sc.value === 'sel';
            const tot = rows.reduce((t, r) => ({ lin: t.lin + r.lin, hach: t.hach + r.hach, ferm: t.ferm + r.ferm, pts: t.pts + r.pts, obj: t.obj + r.obj, vol: t.vol + r.vol }), { lin: 0, hach: 0, ferm: 0, pts: 0, obj: 0, vol: 0 });
            const { jsPDF } = window.jspdf, doc = D ? D.doc : new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); if (D) { if (D.used) doc.addPage(); D.used = true; }
            const W = 210, M = 15, base = (fileName ? baseName(fileName) : 'plan');
            let cols = [{ t: 'Calque', w: 44, a: 'left' }, { t: 'Linéaire (m)', w: 23 }, { t: 'Surf. hach. (m2)', w: 27 }, { t: 'Contours (m2)', w: 25 }, { t: 'Vol. 3D (m3)', w: 25 }, { t: 'Points', w: 18 }, { t: 'Objets', w: 18 }];
            let page = 1;
            const header = () => {
                let x = M;
                if (cartoucheData.logo) { try { const lb = logoBox(20); doc.addImage(cartoucheData.logo, M + lb.x, M + lb.y, lb.w, lb.h, undefined, 'FAST'); x = M + 24; } catch (e) {} }
                doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Note financière', x, M + 7);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
                const info = [cartoucheData.planName ? 'Plan : ' + cartoucheData.planName + (cartoucheIndice(cartoucheData.indice) ? '  (' + cartoucheIndice(cartoucheData.indice) + ')' : '') : 'Fichier : ' + base,
                    cartoucheData.clientName ? 'Client : ' + cartoucheData.clientName : '', cartoucheData.draftsmanName ? 'Dessinateur : ' + cartoucheData.draftsmanName : ''].filter(Boolean);
                info.forEach((t, i) => doc.text(t, x, M + 13 + i * 4.6));
                doc.text(new Date().toLocaleDateString('fr-FR'), W - M, M + 7, { align: 'right' });
                doc.text(onlySel ? 'Sélection : ' + selectedShapes.length + ' objet(s)' : 'Tout le plan', W - M, M + 13, { align: 'right' });
                doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.6); doc.line(M, M + 26, W - M, M + 26);
                return M + 34;
            };
            const head = (y) => {
                doc.setFillColor(31, 41, 55); doc.rect(M, y - 5, W - 2 * M, 7.5, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
                let x = M; cols.forEach(c => { doc.text(c.t, c.a === 'left' ? x + 2 : x + c.w - 2, y, { align: c.a === 'left' ? 'left' : 'right' }); x += c.w; });
                doc.setFont('helvetica', 'normal'); return y + 8;
            };
            const line = (y, vals, bold, zebra) => {
                if (zebra) { doc.setFillColor(243, 244, 246); doc.rect(M, y - 4.6, W - 2 * M, 6.6, 'F'); }
                doc.setTextColor(20); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9);
                let x = M; cols.forEach((c, i) => { const v = String(vals[i]); doc.text(i === 0 ? (doc.splitTextToSize(v, c.w - 3)[0] || '') : v, c.a === 'left' ? x + 2 : x + c.w - 2, y, { align: c.a === 'left' ? 'left' : 'right' }); x += c.w; });
            };
            const nf = (v) => nfr(v, 2).replace(/[\u202f\u00a0]/g, ' '), fmt = (v) => v ? nf(v) : '—';
            let y = head(header());
            rows.forEach((r, i) => {
                if (y > 270) { doc.setFontSize(7.5); doc.setTextColor(120); doc.text('MomoCAD — page ' + page, W / 2, 290, { align: 'center' }); doc.addPage(); page++; y = head(M + 8); }
                line(y, [r.name, fmt(r.lin), fmt(r.hach), fmt(r.ferm), r.vol ? nfr(r.vol, 3).replace(/[\u202f\u00a0]/g, ' ') : '—', r.pts || '—', r.obj], false, i % 2 === 1); y += 6.6;
            });
            doc.setDrawColor(107, 114, 128); doc.setLineWidth(0.4); doc.line(M, y - 3.8, W - M, y - 3.8); y += 1.5;
            line(y, ['Total', nf(tot.lin), nf(tot.hach), nf(tot.ferm), nfr(tot.vol, 3).replace(/[\u202f\u00a0]/g, ' '), tot.pts, tot.obj], true, false); y += 10;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
            doc.text(doc.splitTextToSize('Linéaire : lignes, polylignes, arcs et cercles (m). Surface hachurée : hachures et formes hachurées (m2). Contours fermés : polylignes fermées et cercles non hachurés (m2). Les fonds, courbes et profils générés ne sont pas comptés.', W - 2 * M), M, Math.min(y, 280));
            if (metreQ && metreQ.pending) metreQ = metreQuant();
            if (metreQ && !metreQ.err) {
                const pdfT = (v) => String(v).replace(/[\u202f\u00a0]/g, ' ').replace(/m³/g, 'm3').replace(/m²/g, 'm2');
                y += 12; if (y > 240) { doc.setFontSize(7.5); doc.setTextColor(120); doc.text('MomoCAD — page ' + page, W / 2, 290, { align: 'center' }); doc.addPage(); page++; y = M + 8; }
                doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Terrassement et matériaux', M, y); y += 7;
                cols = [{ t: 'Poste', w: 42, a: 'left' }, { t: 'En place', w: 23 }, { t: 'Foisonné', w: 23 }, { t: 'Tonnage', w: 17 }, { t: 'Quantité', w: 23 }, { t: 'P.U. HT', w: 24 }, { t: 'Montant HT', w: 28 }];
                y = head(y);
                metreQ.rows.forEach((r, i) => { if (y > 270) { doc.setFontSize(7.5); doc.setTextColor(120); doc.text('MomoCAD — page ' + page, W / 2, 290, { align: 'center' }); doc.addPage(); page++; y = head(M + 8); }
                    line(y, metreQRowVals(r).map(pdfT), r.terr, i % 2 === 1); y += 6.6; });
                doc.setDrawColor(107, 114, 128); doc.setLineWidth(0.4); doc.line(M, y - 3.8, W - M, y - 3.8); y += 1.5;
                line(y, ['Total HT', '', '', '', '', '', pdfT(nfr(metreQ.total, 2) + ' €')], true, false); y += 8;
                doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
                doc.text(doc.splitTextToSize('Déblai / remblai : cubatures des plateformes cochées, talus compris. Matériaux : structures des plateformes cumulées par produit ; densités, foisonnements et prix du catalogue produits.', W - 2 * M), M, Math.min(y, 282));
            }
            doc.text('MomoCAD — page ' + page, W / 2, 290, { align: 'center' });
            if (D) return; doc.save(base + '_metre.pdf');
            updateCommandMessageText('MÉTRÉ : PDF « ' + base + '_metre.pdf » produit (' + rows.length + ' calque(s)).');
        }
        function metreTSV() { let t = 'Calque\tLinéaire (m)\tSurface hachurée (m²)\tContours fermés (m²)\tVolumes 3D (m³)\tPoints topo\tObjets\n' + metreRowsNow().map(r => [r.name, nfr(r.lin, 2), nfr(r.hach, 2), nfr(r.ferm, 2), nfr(r.vol, 3), r.pts, r.obj].join('\t')).join('\n');
            if (metreQ && metreQ.pending) metreQ = metreQuant();
            if (metreQ && !metreQ.err) t += '\n\nPoste\tEn place\tFoisonné\tTonnage\tQuantité\tP.U. HT\tMontant HT\n' + metreQ.rows.map(r => metreQRowVals(r).join('\t')).join('\n') + '\nTotal HT\t\t\t\t\t\t' + nfr(metreQ.total, 2) + ' €';
            return t; }

        // Polyligne ouverte (s.open = true, ex. bordure importée d'un DXF) : pas de segment de fermeture
        const polyEdges = (s) => s.open ? Math.max(0, s.points.length - 1) : s.points.length;
        // Déplacement d'une forme (toutes géométries)
        function translateShape(s, ddx, ddy) {
            xPtsOf(s).forEach(h => h.forEach(p => { p.x += ddx; p.y += ddy; }));
            if (s.type === 'line' || s.type === 'slope') { s.x1 += ddx; s.y1 += ddy; s.x2 += ddx; s.y2 += ddy; }
            else if (s.type === 'dim') { s.x1 += ddx; s.y1 += ddy; s.x2 += ddx; s.y2 += ddy; s.ox += ddx; s.oy += ddy; }
            else if (s.type === 'circle' || s.type === 'text' || s.type === 'arc' || s.type === 'basemap' || s.type === 'bgimage' || s.type === 'pdfvec' || s.type === 'mesh' || s.type === 'point' || s.type === 'cline') { s.x += ddx; s.y += ddy; }
            else if (s.type === 'poly') s.points.forEach(p => { p.x += ddx; p.y += ddy; });
            else if (s.type === 'dim-angle') { s.vertex.x += ddx; s.vertex.y += ddy; s.p1.x += ddx; s.p1.y += ddy; s.p2.x += ddx; s.p2.y += ddy; }
            else if (s.type === 'dimr') { s.x += ddx; s.y += ddy; s.ax += ddx; s.ay += ddy; s.lx += ddx; s.ly += ddy; }
            else if (s.type === 'detail') { s.tx += ddx; s.ty += ddy; s.lx += ddx; s.ly += ddy; }
            else if (s.type === 'hatch') { s.loops.forEach(l => l.forEach(p => { p.x += ddx; p.y += ddy; })); }
        }
        // Déplacement tapé au clavier (outil Déplacer) : ΔX puis ΔY dans l'unité du plan ; null si rien n'est tapé
        let moveTypedX = null;
        function moveTypedOffset() {
            if (!(mode === 'move' || mode === 'select-box') || selectedShapes.length === 0 || (moveTypedX === null && typedInput.length === 0)) return null;
            const u2w = (v) => (v / unitsPerSquare) * GRID_SIZE;
            const vx = moveTypedX !== null ? moveTypedX : (parseFloat(typedInput) || 0);
            const vy = moveTypedX !== null ? (parseFloat(typedInput) || 0) : 0;
            return { dx: u2w(vx), dy: -u2w(vy) };
        }
        // Ordre de dessin : les fonds de carte d'abord, sous tout le reste
