        // =====================================================================
        // TEST D'ÉCOULEMENT : la pluie tombe sur le terrain fini (terrain naturel, plateformes et leurs talus, toits des bâtiments existants),
        // s'infiltre selon le revêtement, ruisselle vers le bas, sort par les bords du levé. Les RÉTENTIONS (cuvettes, contre-pentes, points bas sans exutoire)
        // sont trouvées sur le relief (remplissage des creux) et la pluie dit si elles se remplissent ou débordent. Volet avec sa vue 3D.
        // Grille de mailles carrées (≤ ~30 000) ; à chaque pas, l'eau d'une maille passe à ses voisines plus basses (en hauteur d'eau), au plus 1/4 de l'écart.
        // =====================================================================
        let EC = null;
        function ecGrid(maxCells) {
            const M = finishedModel(); if (!M) return null; const tin = M.tin, m = mmToWorld(1000), Wm = (tin.maxX - tin.minX) / m, Hm = (tin.maxY - tin.minY) / m;
            const c = Math.max(0.25, Math.sqrt(Wm * Hm / (maxCells || 30000))), nx = Math.max(3, Math.ceil(Wm / c) + 1), ny = Math.max(3, Math.ceil(Hm / c) + 1), n = nx * ny;
            const z = new Float32Array(n).fill(NaN), gov = new Int16Array(n).fill(-1), roof = new Uint8Array(n), surf = new Uint8Array(n), BT = batList();
            const platSurf = M.P.map(p => ecSurfOf(p.s));
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const X = tin.minX + i * c * m, Y = tin.minY + j * c * m, r = M.at(X, Y); if (!r || !hasZ(r.z)) continue; const k = j * nx + i;
                const b = BT.length ? batAt(BT, X, Y) : null; if (b && b.solid) { z[k] = ((b.points[0].z || 0) + b.solid.H) / 1000; roof[k] = 1; surf[k] = 4; } else { z[k] = r.z / 1000; surf[k] = r.kind === 1 ? platSurf[r.gov] : r.kind ? 5 : 0; } if (r.kind === 1) gov[k] = r.gov; }
            // ouvrages dessinés (murs, toitures, dalles, volumes) : leur dessus, vu d'en haut, remplace le terrain ; l'eau ruisselle sur les toits et contourne la maison
            if (window.THREE) { const top = new Float32Array(n).fill(-Infinity), kind = new Uint8Array(n), x0 = tin.minX, y0 = tin.minY, cw = c * m;
                shapes.forEach(o => { if (!is3DObj(o) || o.type === 'mesh' || o.gen || o.secOf || o.batEx) return; const l = layers.find(L => L.id === (o.layerId || 'layer-0')); if (l && l.visible === false) return; let t = null; try { t = objTrisMM(o); } catch (e) {} if (!t) return;
                    const kd = o.solid && o.solid.kind === 'roof' ? 1 : o.wallMat ? 2 : 3;
                    for (let q = 0; q < t.length; q += 9) { const V = [0, 1, 2].map(a => [(mmToWorld(t[q + 3 * a]) - x0) / cw, (-mmToWorld(t[q + 3 * a + 1]) - y0) / cw, t[q + 3 * a + 2] / 1000]);
                        const i0 = Math.max(0, Math.floor(Math.min(V[0][0], V[1][0], V[2][0]))), i1 = Math.min(nx - 1, Math.ceil(Math.max(V[0][0], V[1][0], V[2][0]))), j0 = Math.max(0, Math.floor(Math.min(V[0][1], V[1][1], V[2][1]))), j1 = Math.min(ny - 1, Math.ceil(Math.max(V[0][1], V[1][1], V[2][1])));
                        const [a, b, d] = V, den = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]); if (Math.abs(den) < 1e-12 || (i1 - i0 + 1) * (j1 - j0 + 1) > 2e5) continue;
                        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { const w1 = ((b[1] - d[1]) * (ii - d[0]) + (d[0] - b[0]) * (jj - d[1])) / den, w2 = ((d[1] - a[1]) * (ii - d[0]) + (a[0] - d[0]) * (jj - d[1])) / den, w3 = 1 - w1 - w2;
                            if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue; const zz = w1 * a[2] + w2 * b[2] + w3 * d[2], k = jj * nx + ii; if (zz > top[k]) { top[k] = zz; kind[k] = kd; } } } });
                for (let k = 0; k < n; k++) if (isFinite(top[k]) && !isNaN(z[k]) && top[k] > z[k] + 0.03) { const h = top[k] - z[k]; z[k] = top[k]; if (kind[k] === 3 && h < 0.6) { surf[k] = 1; } else { roof[k] = kind[k] === 2 ? 2 : 1; surf[k] = 4; } } }
            let zmin = Infinity, zmax = -Infinity; for (let k = 0; k < n; k++) if (!isNaN(z[k]) && !roof[k]) { if (z[k] < zmin) zmin = z[k]; if (z[k] > zmax) zmax = z[k]; }
            const E = { M, nx, ny, n, c, m, x0: tin.minX, y0: tin.minY, z, gov, roof, surf, zmin, zmax, d: new Float32Array(n), dd: new Float32Array(n), dmax: new Float32Array(n), rate: new Float32Array(n), inf: { tn: 10, talus: 10, imp: 0, grave: 20, terre: 30, toit: 0 }, out: 0, rainV: 0, infV: 0, t: 0, spill: [] };
            { const G = mailSets().filter(x => x.k === 'geo'); E.mailSet = G.length ? G[0].set : null; }
            ecRates(E); ecFill(E); return E; }
        // revêtement d'une plateforme : couche du dessus de sa structure (enrobé, béton → étanche ; grave, GNT → drainant ; terre végétale)
        function ecSurfOf(s) { const st = structOf(s), top = st && st.layers[0] ? String(st.layers[0].mat || '').toUpperCase() : ''; if (!top) return 2;
            if (/^BBDR/.test(top)) return 2; if (/^(BB|EME|GB|BETON|BC|BAC|PAVE|GC|GH|GLR|SC|SL|SH|MTLH|LTCC)/.test(top)) return 1; if (/TERRE/.test(top)) return 3; return 2; }
        const EC_SURF = [['tn', 'Terrain naturel'], ['imp', 'Enrobé, béton (étanche)'], ['grave', 'Grave, GNT, stabilisé'], ['terre', 'Terre végétale'], ['toit', 'Toitures'], ['talus', 'Talus (terrain remanié)']];
        function ecRates(E) { const K = EC_SURF.map(([k]) => Math.max(0, +E.inf[k] || 0) / 1000 / 3600); for (let k = 0; k < E.n; k++) E.rate[k] = K[E.surf[k]] || 0;
            // sol naturel et talus : infiltration selon la nature du sol du maillage géologique (couche la moins perméable du premier mètre)
            if (E.mailSet) { const L = mailList(E.mailSet).map(s => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; s.points.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }); return { s, b: [x0, y0, x1, y1], r: mailInfRate(s.maille) }; });
                E.mailHit = 0; for (let j = 0; j < E.ny; j++) for (let i = 0; i < E.nx; i++) { const k = j * E.nx + i; if (E.surf[k] !== 0 && E.surf[k] !== 5) continue; const x = E.x0 + i * E.c * E.m, y = E.y0 + j * E.c * E.m;
                    const o = L.find(o => x >= o.b[0] && x <= o.b[2] && y >= o.b[1] && y <= o.b[3] && pointInPolygon(x, y, o.s.points)); if (o) { E.rate[k] = o.r / 1000 / 3600; E.mailHit++; } } } }
        const MAIL_INF = { tv: 20, remb: 10, limon: 8, argile: 1, sable: 40, grave: 60, marne: 2, craie: 15, calc: 8, gres: 5, schiste: 2, rocher: 1 };   // mm/h, ordres de grandeur
        function mailInfRate(M) { const T = mailTops(M); let r = Infinity; M.cs.forEach((c, i) => { if (T[i][0] < 1000) r = Math.min(r, MAIL_INF[c.sub] !== undefined ? MAIL_INF[c.sub] : 10); }); return isFinite(r) ? r : 10; }
        // creux du relief (remplissage par priorité depuis les bords et les trous du levé) : hauteur d'eau que chaque maille retient avant de déborder
        function ecFill(E) { const { nx, ny, z, n } = E, F = new Float32Array(n).fill(Infinity), seen = new Uint8Array(n), H = [], push = (h, k) => { H.push([h, k]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } },
                pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (isNaN(z[k])) continue; const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || isNaN(z[k - 1]) || isNaN(z[k + 1]) || isNaN(z[k - nx]) || isNaN(z[k + nx]); if (edge) { F[k] = z[k]; seen[k] = 1; push(z[k], k); } }
            while (H.length) { const [h, k] = pop(), i = k % nx, j = (k / nx) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const q = jj * nx + ii; if (seen[q] || isNaN(z[q])) return; seen[q] = 1; F[q] = Math.max(z[q], h); push(F[q], q); }); }
            E.fill = new Float32Array(n); for (let k = 0; k < n; k++) E.fill[k] = isFinite(F[k]) && !isNaN(z[k]) && !E.roof[k] ? F[k] - z[k] : 0; E.ret = ecRetentions(E); }
        // rétentions : cuvettes d'au moins 1 cm de profondeur ; capacité, surface, plateforme concernée ; remplissage par la pluie
        function ecRetentions(E) { const { nx, ny, fill } = E, seen = new Uint8Array(E.n), Z = [], A = E.c * E.c;
            for (let k0 = 0; k0 < E.n; k0++) { if (seen[k0] || fill[k0] < 0.01) continue; const st = [k0], cells = []; seen[k0] = 1;
                while (st.length) { const k = st.pop(); cells.push(k); const i = k % nx, j = (k / nx) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const q = jj * nx + ii; if (!seen[q] && fill[q] >= 0.01) { seen[q] = 1; st.push(q); } }); }
                let V = 0, mx = 0, sx = 0, sy = 0; const gv = {}; cells.forEach(k => { V += fill[k] * A; if (fill[k] > mx) mx = fill[k]; sx += k % nx; sy += (k / nx) | 0; if (E.gov[k] >= 0) gv[E.gov[k]] = (gv[E.gov[k]] || 0) + 1; });
                if (cells.length < 3 || cells.length * A < 1 || V < 0.05) continue;   // une maille isolée de quelques mm : bruit du maillage, pas une cuvette const g = Object.keys(gv).sort((a, b) => gv[b] - gv[a])[0], P = g !== undefined && gv[g] > cells.length / 2 ? E.M.P[+g] : null;
                Z.push({ cells, area: cells.length * A, cap: V, max: mx, ci: sx / cells.length, cj: sy / cells.length, on: P && P.s ? (P.s.name || ('PF' + (+g + 1))) : '' }); }
            return Z.sort((a, b) => b.cap - a.cap); }
        function ecRetFill(E) { const A = E.c * E.c; (E.ret || []).forEach(z => { let v = 0, now = 0; z.cells.forEach(k => { v += Math.min(E.dmax[k], E.fill[k]) * A; now += Math.min(E.d[k], E.fill[k]) * A; }); z.got = v; z.now = now; z.pct = z.cap > 0 ? Math.min(1, v / z.cap) : 0; }); }
        // un pas : pluie (m), puis écoulement ; renvoie le volume sorti par les bords (m³)
        function ecStep(E, rainM, dt) {
            const { nx, ny, z, d, dd } = E, A = E.c * E.c; dd.fill(0); let out = 0; const sp = E.spill; dt = dt || E.c / 0.5;
            if (rainM > 0) for (let k = 0; k < E.n; k++) if (!isNaN(z[k])) { d[k] += rainM; E.rainV += rainM * A; }
            for (let k = 0; k < E.n; k++) if (d[k] > 0 && E.rate[k] > 0) { const f = Math.min(d[k], E.rate[k] * dt); d[k] -= f; E.infV += f * A; }   // infiltration selon le revêtement
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, dk = d[k]; if (isNaN(z[k]) || dk <= 1e-7) continue; const H = z[k] + dk;
                let S = 0, f0 = 0, f1 = 0, f2 = 0, f3 = 0;
                const nb = (ii, jj) => { if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return 0.5; const q = jj * nx + ii; if (isNaN(z[q])) return 0.5; const df = H - z[q] - d[q]; return df > 0 ? df : 0; };   // hors du levé : l'eau tombe (débord)
                f0 = nb(i + 1, j); f1 = nb(i - 1, j); f2 = nb(i, j + 1); f3 = nb(i, j - 1); S = f0 + f1 + f2 + f3; if (S <= 0) continue;
                let mv = Math.min(dk, 0.25 * S); const sc = mv / S; dd[k] -= mv;
                [[i + 1, j, f0], [i - 1, j, f1], [i, j + 1, f2], [i, j - 1, f3]].forEach(([ii, jj, f]) => { if (!f) return; const v = f * sc; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || isNaN(z[jj * nx + ii])) { out += v * A; if (sp.length < 400 && Math.random() < 0.15) sp.push([i, j, ii - i, jj - j]); } else dd[jj * nx + ii] += v; }); }
            for (let k = 0; k < E.n; k++) { if (dd[k]) { d[k] += dd[k]; if (d[k] < 0) d[k] = 0; } if (d[k] > E.dmax[k]) E.dmax[k] = d[k]; }
            E.out += out; return out; }
        // flaques : mailles encore mouillées (> 5 mm) après ressuyage, regroupées
        function ecPuddles(E, thr) {
            thr = thr || 0.005; const { nx, ny, d, z } = E, seen = new Uint8Array(E.n), Z = [];
            for (let k0 = 0; k0 < E.n; k0++) { if (seen[k0] || isNaN(z[k0]) || E.roof[k0] || d[k0] < thr) continue; const st = [k0], cells = []; seen[k0] = 1;
                while (st.length) { const k = st.pop(); cells.push(k); const i = k % nx, j = (k / nx) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const q = jj * nx + ii; if (!seen[q] && !isNaN(z[q]) && !E.roof[q] && d[q] >= thr) { seen[q] = 1; st.push(q); } }); }
                if (cells.length < 2) continue; let V = 0, mx = 0, sx = 0, sy = 0; const gv = {}; cells.forEach(k => { V += d[k]; if (d[k] > mx) mx = d[k]; sx += k % nx; sy += (k / nx) | 0; if (E.gov[k] >= 0) gv[E.gov[k]] = (gv[E.gov[k]] || 0) + 1; });
                const g = Object.keys(gv).sort((a, b) => gv[b] - gv[a])[0], P = g !== undefined && gv[g] > cells.length / 2 ? E.M.P[+g] : null;
                Z.push({ cells, area: cells.length * E.c * E.c, vol: V * E.c * E.c, max: mx, ci: sx / cells.length, cj: sy / cells.length, on: P && P.s ? (P.s.name || ('PF' + (+g + 1))) : '' }); }
            return Z.sort((a, b) => b.vol - a.vol); }
        // simulation complète sans animation (tests, et résultat final) : pluie I mm/h pendant Tr min, puis ressuyage Td min
        // pluie : constante (I mm/h pendant Tr min) ou réelle, heure par heure (E.hyeto, mm/h)
        const ecRainMin = (E) => E.hyeto ? E.hyeto.length * 60 : E.Tr;
        const ecDt = (E) => Math.max(E.c / 0.5, ecRainMin(E) * 60 / 3000);   // ≤ 3 000 pas de pluie : un orage de plusieurs heures reste rapide (le ruissellement, lui, se fait en quelques minutes)
        const ecRainAt = (E, t) => E.hyeto ? (E.hyeto[Math.floor(t / 3600)] || 0) : (t < E.Tr * 60 ? E.I : 0);
        function ecRun(E, I, Tr, Td) { if (I !== undefined) { E.I = I; E.Tr = Tr; } const dt = ecDt(E); if (I !== undefined) { E.I = I; E.Tr = Tr; } const nR = Math.ceil(ecRainMin(E) * 60 / dt), nD = Math.ceil(Td * 60 / dt);
            for (let s = 0; s < nR; s++) ecStep(E, ecRainAt(E, s * dt) / 1000 / 3600 * dt, dt); for (let s = 0; s < nD; s++) ecStep(E, 0, dt); E.t = (nR + nD) * dt; ecRetFill(E); return E.ret; }
        // ---- PLUIE RÉELLE DU SITE : les archives météo horaires (réanalyse ERA5, Open-Meteo) au point du plan ; les plus gros orages des 10 dernières années ----
        function ecLatLon(E) { const cx = E.x0 + (E.nx - 1) * E.c * E.m / 2, cy = E.y0 + (E.ny - 1) * E.c * E.m / 2, X = realX(cx) / 1000, Y = realY(cy) / 1000; let P = null;
            if (X > 50000 && X < 1300000 && Y > 6000000 && Y < 7200000) P = lccParams('L93'); else if (X > 1000000 && X < 2400000 && Y > 1000000 && Y < 9400000) P = lccParams('CC' + Math.max(42, Math.min(50, Math.round((Y - 200000) / 1e6) + 41)));
            if (P) return lccInv(P, X, Y); const bm = shapes.find(x => x.type === 'basemap' && isFinite(x.lat) && isFinite(x.lon)); return bm ? { lat: bm.lat, lon: bm.lon } : null; }
        // épisodes de pluie : heures pluvieuses séparées de moins de 3 h sèches ; classés par l'heure la plus forte
        function ecStorms(times, mm, n) { const ev = []; let cur = null, dry = 0;
            for (let i = 0; i < mm.length; i++) { const v = +mm[i] || 0; if (v >= 0.2) { if (!cur) cur = { i0: i, i1: i, tot: 0, peak: 0 }; cur.i1 = i; cur.tot += v; cur.peak = Math.max(cur.peak, v); dry = 0; } else if (cur && ++dry >= 3) { ev.push(cur); cur = null; dry = 0; } }
            if (cur) ev.push(cur); return ev.filter(e => e.tot >= 5).sort((a, b) => b.peak - a.peak || b.tot - a.tot).slice(0, n || 8).map(e => ({ start: times[e.i0], h: e.i1 - e.i0 + 1, tot: e.tot, peak: e.peak, hyeto: mm.slice(e.i0, e.i1 + 1).map(v => +v || 0) })); }
        async function ecRealFetch() { const E = EC; if (!E) return; const el = document.getElementById('ec-real'), ll = ecLatLon(E);
            if (!ll) { el.innerHTML = '<div class="mf-hint" style="color:#fca5a5">Le plan n\'est pas géoréférencé (Lambert 93 ou CC) : impossible de savoir où chercher la pluie. Pose d\'abord un fond de carte ou cale le plan.</div>'; return; }
            const end = new Date(Date.now() - 7 * 864e5), st = new Date(end.getTime() - 10 * 365.25 * 864e5), d = (x) => x.toISOString().slice(0, 10);
            el.innerHTML = `<div class="mf-hint">⏳ Lecture des pluies horaires de 10 ans au point ${nfr(ll.lat, 4)} N, ${nfr(ll.lon, 4)} E…</div>`;
            try { const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + ll.lat.toFixed(4) + '&longitude=' + ll.lon.toFixed(4) + '&start_date=' + d(st) + '&end_date=' + d(end) + '&hourly=precipitation&timezone=Europe%2FParis';
                const r = await fetch(url); if (!r.ok) throw new Error('service météo : ' + r.status); const J = await r.json(), H = J.hourly || {}; if (!H.time || !H.precipitation) throw new Error('réponse vide');
                E.storms = ecStorms(H.time, H.precipitation, 8); E.ll = ll; ecRealRender(); }
            catch (e) { el.innerHTML = `<div class="mf-hint" style="color:#fca5a5">Archives météo injoignables (${MF.esc(e.message || e)}). Il faut une connexion Internet.</div>`; } }
        function ecHyetoSvg(H, w, h) { const mx = Math.max(1, ...H), bw = w / H.length; return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${H.map((v, i) => `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(h - v / mx * (h - 2)).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${(v / mx * (h - 2)).toFixed(1)}" fill="#38bdf8"/>`).join('')}</svg>`; }
        function ecRealRender() { const E = EC, el = document.getElementById('ec-real'); if (!E || !el || !E.storms) return; const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
            if (!E.storms.length) { el.innerHTML = '<div class="mf-hint">Aucun épisode de plus de 5 mm trouvé sur 10 ans à ce point.</div>'; return; }
            el.innerHTML = `<div class="piw-list">`
                + E.storms.map((t, i) => { const dt = new Date(t.start), on = E.hyetoIdx === i; return `<div class="piw-row${on ? ' on' : ''}" data-a="storm" data-i="${i}" title="Rejouer cet épisode"><span class="piw-n">${dt.getDate()} ${mois[dt.getMonth()]} ${dt.getFullYear()}</span>${ecHyetoSvg(t.hyeto, 60, 18)}<span class="piw-s" style="min-width:150px;text-align:right">${nfr(t.tot, 0)} mm en ${t.h} h · pointe ${nfr(t.peak, 0)} mm/h</span></div>`; }).join('') + '</div>'
                + '<div class="mf-hint" title="Réanalyses Open-Meteo (ERA5 et modèle européen), mailles de 9 à 25 km, cumuls horaires : un orage très local peut être plus violent sur le chantier.">Ordre de grandeur réel, pas une pluie de projet réglementaire.</div>'; }
        function ecPickStorm(i) { const E = EC, t = E && E.storms && E.storms[i]; if (!t) return; E.hyeto = t.hyeto; E.hyetoIdx = i; document.querySelectorAll('#ec-pre input').forEach(x => { x.checked = false; }); ecRealRender(); ecReset(); ecHud();
            updateCommandMessageText('TEST D\'ÉCOULEMENT : orage réel du ' + new Date(t.start).toLocaleDateString('fr-FR') + ' (' + nfr(t.tot, 0) + ' mm en ' + t.h + ' h) prêt : ▶ Faire pleuvoir.'); }
        // ---- volet ----
        function ecOpen() {
            if (EC) { ecClose(); } if (!window.THREE) { updateCommandMessageText('TEST D\'ÉCOULEMENT : chargement de la 3D…'); loadThree().then(ecOpen, () => { updateCommandMessageText('TEST D\'ÉCOULEMENT : moteur 3D indisponible.'); }); return; }
            const E = ecGrid(); if (!E) { updateCommandMessageText('TEST D\'ÉCOULEMENT : il faut un terrain (au moins 3 points cotés).'); return; }
            EC = Object.assign(E, { I: 60, Tr: 15, Td: 30, ex: 3, sp2d: true, run: false, step: 0, res: null, speed: 2 });
            let el = document.getElementById('ec-wiz'); if (el) el.remove(); el = document.createElement('div'); el.id = 'ec-wiz'; el.className = 'piw-panel mc-drawer-p'; el.style.setProperty('--dw', '420px'); document.body.appendChild(el);   // un volet comme les autres : pleine hauteur, à droite, au-dessus de la vue 3D
            el.addEventListener('mousedown', (e) => e.stopPropagation()); el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
            const PRE = [[30, '🌦', 'Averse'], [60, '⛈', 'Orage'], [100, '🌧', 'Décennale'], [150, '🌊', 'Centennale']];
            el.innerHTML = `<div class="vh"><h3>💧 Test d'écoulement</h3><button type="button" class="vx" data-a="close" title="Fermer (Échap)">×</button></div>
                <div class="piw-body">
                    <div id="ec-card" style="border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,#0f2742,#1e3a5f 55%,#334155);border:1px solid #3b5b85;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)">
                        <div id="ec-hud" style="font:12.5px sans-serif;color:#e0f2fe"></div>
                        <div style="height:6px;border-radius:4px;background:rgba(255,255,255,.12);margin-top:8px;overflow:hidden"><div id="ec-bar" style="height:100%;width:0;background:linear-gradient(90deg,#38bdf8,#818cf8);transition:width .2s"></div></div></div>
                    <div class="piw-h" style="margin-top:10px">Quelle pluie ?</div>
                    <div id="ec-pre" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${PRE.map(([v, ic, l]) => `<label style="cursor:pointer"><input type="radio" name="ec-pre" value="${v}" ${v === 60 ? 'checked' : ''} style="display:none"><div class="ec-pc" style="display:flex;flex-direction:column;align-items:center;gap:1px;padding:7px 2px;border-radius:10px;border:1px solid #374151;background:#111827"><span style="font-size:22px;line-height:1.1">${ic}</span><b style="font-size:11.5px;color:#e5e7eb">${l}</b><small style="color:#93c5fd">${v} mm/h</small></div></label>`).join('')}</div>
                    ${MF.row('Intensité', MF.num('ec-i', '60'), 'mm/h')}${MF.row('Durée de la pluie', MF.num('ec-tr', '15'), 'min')}
                    <button type="button" class="piw-b wide" data-a="real" title="Archives météo horaires des 10 dernières années au point du plan (le plan doit être géoréférencé)" style="margin-top:4px">🔎 Les vrais orages de ce site (10 ans)</button><div id="ec-real"></div>
                    <div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="piw-b wide pri" data-a="go" id="ec-go" style="height:40px;font-size:14.5px;flex:1 1 auto;min-width:0">▶ Faire pleuvoir</button><button type="button" class="piw-b" data-a="reset" title="Recommencer (terrain sec)" style="height:40px;padding:0 14px">↺</button></div>
                    <div id="ec-ret"></div><div id="ec-res"></div>
                    <details style="margin-top:8px;border:1px solid #374151;border-radius:10px;padding:4px 10px;background:#0f172a"><summary style="cursor:pointer;color:#cbd5e1;font-weight:600;padding:4px 0">⚙ Réglages : sol, revêtements, animation</summary>
                        ${MF.row('Ressuyage après la pluie', MF.num('ec-td', '30'), 'min')}${MF.row('Vitesse de l\'animation', MF.sel('ec-sp', [[1, 'lente'], [2, 'normale'], [5, 'rapide'], [20, 'très rapide']], 2), '')}
                        ${MF.ck('ec-flash', 'Éclairs et ciel d\'orage', true)}${MF.ck('ec-2d', 'Eau aussi sur le plan', true)}
                        <div class="piw-h" style="margin-top:4px">Infiltration (mm/h)</div>
                        ${(() => { const G = mailSets().filter(x => x.k === 'geo'); return MF.row('Sol du terrain naturel', MF.sel('ec-sol', G.map(x => ['mail:' + x.set, 'Selon le maillage ' + x.set]).concat([[1, 'Roche, sol compact'], [3, 'Argile'], [10, 'Limon'], [30, 'Sable, gravier']]), EC && EC.mailSet ? 'mail:' + EC.mailSet : G.length ? 'mail:' + G[0].set : 10), ''); })()}
                        <div class="mf-vz" style="grid-template-columns:1fr 1fr;max-height:none">${EC_SURF.filter(([k]) => k !== 'tn' && k !== 'talus').map(([k, l]) => `<label title="${l}"><span style="width:auto;flex:1;text-align:left;color:#cbd5e1">${l.replace(/ \(.*\)/, '')}</span><input id="ec-r-${k}" type="text" inputmode="decimal" class="mf-in" value="${EC.inf[k]}" style="max-width:62px"></label>`).join('')}</div>
                        <div id="ec-surf" class="mf-hint"></div></details></div>`;
            el.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
                if (a === 'close') ecClose(); else if (a === 'go') ecToggle(); else if (a === 'reset') ecReset(); else if (a === 'see') ecSee(+b.dataset.i); else if (a === 'mark') ecMark(); else if (a === 'real') ecRealFetch(); else if (a === 'storm') ecPickStorm(+b.dataset.i); });
            const manual = () => { if (EC && EC.hyeto) { EC.hyeto = null; EC.hyetoIdx = -1; ecRealRender(); ecHud(); } };
            el.addEventListener('change', (e) => { const t = e.target; if (t.name === 'ec-pre') { document.getElementById('ec-i').value = t.value; manual(); } if (t.id === 'ec-i' || t.id === 'ec-tr') manual(); ecRead(); ecPreUI(); });
            el.addEventListener('input', (e) => { if (e.target.id === 'ec-i' || e.target.id === 'ec-tr') manual(); ecRead(); });
            ecRead(); ecPreUI(); ecRetRender(); ecBuild3D().catch(err => { document.getElementById('ec-hud').textContent = 'Vue 3D indisponible : ' + err.message; });
            ecHud(); draw(); updateCommandMessageText('TEST D\'ÉCOULEMENT : règle la pluie, puis ▶ Faire pleuvoir. Les flaques restantes sont listées à la fin.'); }
        function ecRead() { if (!EC) return; const g = (id) => document.getElementById(id), n = (id, d) => { const v = t2Num(g(id).value); return isFinite(v) && v >= 0 ? v : d; };
            EC.I = n('ec-i', 60); EC.Tr = n('ec-tr', 15); EC.Td = n('ec-td', 30); EC.ex = V3 ? V3.exag || 1 : 1; EC.speed = +g('ec-sp').value || 2; EC.sp2d = g('ec-2d').checked; EC.noFlash = !g('ec-flash').checked;
            const sv = String(g('ec-sol').value), sol = +sv; EC.mailSet = /^mail:/.test(sv) ? sv.slice(5) : null; EC.inf.tn = EC.inf.talus = isFinite(sol) ? sol : 10; ['imp', 'grave', 'terre', 'toit'].forEach(k => { EC.inf[k] = n('ec-r-' + k, EC.inf[k]); }); ecRates(EC);
            const cnt = [0, 0, 0, 0, 0, 0]; for (let k = 0; k < EC.n; k++) if (!isNaN(EC.z[k])) cnt[EC.surf[k]]++; const A = EC.c * EC.c, el = g('ec-surf'); if (el) el.innerHTML = EC_SURF.map(([k, l], i) => cnt[i] ? `${l.replace(/ \(.*\)/, '')} <b>${nfr(cnt[i] * A, 0)} m²</b>` : '').filter(Boolean).join(' · '); draw(); }
        function ecPreUI() { document.querySelectorAll('#ec-pre label').forEach(l => { const on = l.querySelector('input').checked, c = l.querySelector('.ec-pc'); if (c) { c.style.borderColor = on ? '#38bdf8' : '#374151'; c.style.background = on ? 'rgba(56,189,248,.16)' : '#111827'; } }); }
        function ecClose() { if (!EC) return; EC.run = false; cancelAnimationFrame(EC.raf); try { ecStorm(false); if (EC.g3 && EC.g3.parent) EC.g3.parent.remove(EC.g3); if (is3DOpen()) render3D(); } catch (e) {} const el = document.getElementById('ec-wiz'); if (el) el.remove(); EC = null; draw(); }
        function ecReset() { if (!EC) return; EC.run = false; EC.d.fill(0); EC.dmax.fill(0); EC.out = 0; EC.rainV = 0; EC.infV = 0; delete EC.held; EC.t = 0; EC.step = 0; EC.res = null; EC.spill.length = 0; document.getElementById('ec-res').innerHTML = ''; ecRetFill(EC); ecRetRender(); document.getElementById('ec-go').textContent = '▶ Faire pleuvoir'; ecUpd3D(true); ecHud(); draw(); }
        function ecToggle() { if (!EC) return; if (EC.res) ecReset(); EC.run = !EC.run; document.getElementById('ec-go').textContent = EC.run ? '⏸ Pause' : '▶ Reprendre'; if (EC.run) ecLoop(); }
        function ecLoop() { if (!EC || !EC.run) return; const E = EC, dt = ecDt(E), nR = Math.ceil(ecRainMin(E) * 60 / dt), nD = Math.ceil(E.Td * 60 / dt), sp = E.hyeto ? Math.max(E.speed, Math.ceil(nR / 900)) : E.speed;   // un orage de plusieurs heures défile en ~15 s
            for (let s = 0; s < sp && E.step < nR + nD; s++, E.step++) ecStep(E, E.step < nR ? ecRainAt(E, E.step * dt) / 1000 / 3600 * dt : 0, dt); if (E.step % 10 === 0) { ecRetFill(E); ecRetRender(); }
            E.t = E.step * dt; E.raining = E.step < nR; ecUpd3D(); ecHud(); if (E.sp2d && (E.step % 3 === 0)) draw();
            if (E.step >= nR + nD) { E.run = false; ecDone(); return; } E.raf = requestAnimationFrame(ecLoop); }
        function ecHud() { const h = document.getElementById('ec-hud'); if (!h || !EC) return; const E = EC, mn = Math.floor(E.t / 60);
            const hh = Math.floor(mn / 60), it = E.raining ? ecRainAt(E, E.t) : 0;
            const chip = (ic, l, v) => `<span style="display:inline-flex;flex-direction:column;align-items:center;min-width:70px;padding:3px 6px;border-radius:8px;background:rgba(15,23,42,.45)"><small style="color:#93c5fd">${ic} ${l}</small><b style="font-size:13px">${v} m³</b></span>`;
            h.innerHTML = `<div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:22px;color:#fff">⏱ ${hh ? hh + ' h ' + String(mn % 60).padStart(2, '0') : mn + ' min'}</b><span style="font-size:13px">${E.step ? (E.raining ? '🌧 ' + nfr(it, 0) + ' mm/h' : '🌤 ressuyage') : (E.hyeto ? '⛈ orage réel prêt' : '☁ en attente')}</span></div><div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">${chip('💧', 'pluie', nfr(E.rainV, 1))}${chip('⬇', 'infiltrée', nfr(E.infV, 1))}${chip('➜', 'sortie', nfr(E.out, 1))}${E.held !== undefined ? chip('🥣', 'retenue', nfr(E.held, 1)) : ''}</div>${E.mailSet ? `<div style="font-size:11.5px;color:#bfdbfe;margin-top:5px">Infiltration du sol selon le maillage ${MF.esc(E.mailSet)}</div>` : ''}${E.held !== undefined ? `<div style="font-size:12px;color:#e5e7eb;margin-top:5px"><b>Bilan</b> : sur ${nfr(E.rainV, 1)} m³ tombés, ${nfr(E.infV / Math.max(E.rainV, 1e-9) * 100, 0)} % infiltrés, ${nfr(E.out / Math.max(E.rainV, 1e-9) * 100, 0)} % sortis, ${nfr(E.held / Math.max(E.rainV, 1e-9) * 100, 0)} % retenus${(E.ret || []).length ? ' dans ' + E.ret.length + ' cuvette(s)' : ''}.</div>` : ''}`;
            const bar = document.getElementById('ec-bar'); if (bar) { const dt = ecDt(E), tot = Math.ceil(ecRainMin(E) * 60 / dt) + Math.ceil(E.Td * 60 / dt); bar.style.width = Math.min(100, E.step / Math.max(1, tot) * 100) + '%'; } }
        // liste des rétentions (cuvettes) : capacité ; pendant et après la pluie, remplissage et débordement
        function ecRetRender() { const el = document.getElementById('ec-ret'); if (!el || !EC) return; const R = EC.ret || [], tot = R.reduce((a, z) => a + z.cap, 0);
            const rows = R.slice(0, 30).map((z, i) => { const p = z.pct || 0, col = p >= 0.98 ? '#fb923c' : p > 0.05 ? '#38bdf8' : '#9ca3af';
                return `<div class="piw-row${EC.focus === i ? ' on' : ''}" data-a="see" data-i="${i}" title="Voir dans la 3D et sur le plan"><span class="piw-n">🥣 ${i + 1}${z.on ? ' · sur ' + MF.esc(z.on) : ''}</span><span class="piw-s">${nfr(z.area, 1)} m² · ${nfr(z.max * 100, 1)} cm · ${nfr(z.cap, 2)} m³</span>${EC.step ? `<span class="piw-s" style="color:${col};min-width:62px;text-align:right">${p >= 0.98 ? 'pleine' : 'remplie ' + Math.round(p * 100) + ' %'}</span>` : ''}</div>`; }).join('');
            el.innerHTML = `<div class="piw-h" style="margin-top:6px">Rétentions d'eau du relief</div>` + (R.length ? `<div class="mf-hint" style="margin:0">${R.length} cuvette(s) sans exutoire (point bas oublié, contre-pente, creux de plateforme) : ${nfr(tot, 2)} m³ d'eau retenue au total. ${EC.step ? 'Remplissage par la pluie à droite.' : 'Fais pleuvoir pour voir si elles se remplissent ou débordent.'}</div><div class="piw-list">${rows}</div><button type="button" class="piw-b wide" data-a="mark">Marquer les rétentions sur le plan</button>` : '<div class="mf-hint" style="color:#4ade80;margin:0">✓ Aucune cuvette : partout, l\'eau a une pente pour partir.</div>'); }
        function ecDone() { const E = EC; ecRetFill(E); E.res = E.ret; document.getElementById('ec-go').textContent = '↺ Refaire pleuvoir'; ecRetRender(); let held = 0; for (let k = 0; k < E.n; k++) held += E.d[k] * E.c * E.c; E.held = held; ecHud(); const ov = E.ret.filter(z => z.pct >= 0.98).length;
            pluvioSaveTest(E, held);
            const L = (l, v, c) => `<div style="display:flex;justify-content:space-between"><span>${l}</span><b style="color:${c || '#e5e7eb'}">${v}</b></div>`;
            document.getElementById('ec-res').innerHTML = `<div class="piw-h" style="margin-top:6px">Bilan de la pluie</div><div class="mf-fig" style="flex-direction:column;align-items:stretch;gap:4px">
                ${L('Pluie tombée', nfr(E.rainV, 1) + ' m³')}${L('Infiltrée', nfr(E.infV, 1) + ' m³ (' + Math.round(100 * E.infV / Math.max(1e-9, E.rainV)) + ' %)', '#a3e635')}${L('Ruisselée hors du terrain', nfr(E.out, 1) + ' m³', '#60a5fa')}${L('Retenue (cuvettes, film d\'eau)', nfr(held, 2) + ' m³', held > 0.05 ? '#f87171' : '#4ade80')}</div>
                ${E.ret.length ? `<div class="mf-hint">${ov ? `<b style="color:#fb923c">${ov} cuvette(s) pleines</b> avec cette pluie : l\'eau y reste après l\'orage (jusqu\'à infiltration).` : 'Aucune cuvette n\'est pleine avec cette pluie.'}</div>` : ''}`;
            ecUpd3D(true); draw(); updateCommandMessageText('TEST D\'ÉCOULEMENT : ' + (E.ret.length ? E.ret.length + ' rétention(s) d\'eau' + (ov ? ', dont ' + ov + ' pleines' : '') + '.' : 'aucune rétention, partout l\'eau a une pente pour partir.')); }
        const ecW = (E, i, j) => ({ x: E.x0 + i * E.c * E.m, y: E.y0 + j * E.c * E.m });
        function ecSee(i) { const E = EC, z = E && E.ret && E.ret[i]; if (!z) return; const w = ecW(E, z.ci, z.cj); camera.x = canvas.width / 2 - w.x * camera.zoom; camera.y = canvas.height / 2 - w.y * camera.zoom; E.focus = i; ecRetRender();
            if (is3DOpen() && V3 && V3.root) { const kk = Math.round(z.cj) * E.nx + Math.round(z.ci), q = ecLocal(E, z.ci, z.cj, isNaN(E.z[kk]) ? E.zmin : E.z[kk]), rp = V3.root.position; V3.target.set(q[0] + rp.x, q[1] + rp.y, q[2] + rp.z); V3.dist = Math.max(15, Math.sqrt(z.cells.length) * E.c * 6); }   // la 3D se tourne vers la cuvette
            ecUpd3D(true); draw(); }
        function ecMark() { const E = EC; if (!E || !E.ret || !E.ret.length) return; const lid = ensureLayer('Rétentions (écoulement)', '#38bdf8'); let n = 0;
            E.ret.forEach((z, k) => { const set = new Set(z.cells), nx = E.nx, nxt = new Map(), key = (i, j) => j * (nx + 1) + i;
                z.cells.forEach(c => { const i = c % nx, j = (c / nx) | 0, on = (ii, jj) => ii >= 0 && jj >= 0 && ii < nx && set.has(jj * nx + ii);
                    if (!on(i, j - 1)) nxt.set(key(i + 1, j), key(i, j)); if (!on(i + 1, j)) nxt.set(key(i + 1, j + 1), key(i + 1, j)); if (!on(i, j + 1)) nxt.set(key(i, j + 1), key(i + 1, j + 1)); if (!on(i - 1, j)) nxt.set(key(i, j), key(i, j + 1)); });
                let best = null; const seen = new Set(); nxt.forEach((_, s0) => { if (seen.has(s0)) return; const L = []; let p = s0; for (let g = 0; g < 1e5 && !seen.has(p) && nxt.has(p); g++) { seen.add(p); L.push(p); p = nxt.get(p); } if (!best || L.length > best.length) best = L; });
                if (!best) return; let P = best.map(p => { const i = p % (nx + 1), j = (p / (nx + 1)) | 0; return ecW(E, i - 0.5, j - 0.5); }); P = P.filter((q, i) => { const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length]; return Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) > 1e-9; });
                if (P.length < 3) return; shapes.push({ type: 'poly', layerId: lid, open: false, points: P, color: '#38bdf8', hatch: true, name: 'Rétention ' + (k + 1) + ' — ' + nfr(z.area, 1) + ' m², ' + nfr(z.max * 100, 1) + ' cm, ' + nfr(z.cap, 2) + ' m³' }); n++; });
            const l = layers.find(x => x.id === lid); if (l) l.noTin = true; invalidateCache(); saveState(); updateLayerUI(); draw(); updateCommandMessageText('TEST D\'ÉCOULEMENT : ' + n + ' rétention(s) marquée(s) sur le calque « Rétentions (écoulement) » (hors terrain).'); }
        // eau sur le plan 2D
        function ecDraw2D(c) { const E = EC; if (!E) return; if (!E.sp2d || !E.step) { ecRing2D(c, E); return; } const s = E.c * E.m * camera.zoom, o = worldToScreen(E.x0, E.y0); c.save();
            for (let j = 0; j < E.ny; j++) for (let i = 0; i < E.nx; i++) { const k = j * E.nx + i, d = E.d[k]; if (d < 0.002 || E.roof[k]) continue; const x = o.x + (i - 0.5) * s, y = o.y + (j - 0.5) * s; if (x > canvas.width || y > canvas.height || x + s < 0 || y + s < 0) continue;
                c.fillStyle = 'rgba(37,140,245,' + Math.min(0.85, 0.25 + d * 12).toFixed(2) + ')'; c.fillRect(x, y, s + 0.6, s + 0.6); }
            c.restore(); ecRing2D(c, E); }
        function ecRing2D(c, E) { const s = E.c * E.m * camera.zoom; c.save(); (E.ret || []).forEach((z, i) => { const w = ecW(E, z.ci, z.cj), q = worldToScreen(w.x, w.y), r = Math.max(10, Math.sqrt(z.cells.length) * s * 0.7); c.strokeStyle = i === E.focus ? '#f59e0b' : (z.pct >= 0.98 ? '#fb923c' : '#38bdf8'); c.lineWidth = 2; c.setLineDash([5, 3]); c.beginPath(); c.arc(q.x, q.y, r, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('🥣' + (i + 1), q.x, q.y - r - 4); }); c.restore(); }
        // ---- vue 3D du volet ----
        // ---- LA PLUIE DANS LA VUE 3D : l'eau qui ruisselle et s'accumule, les gouttes qui tombent, et pendant l'orage le ciel s'assombrit et les éclairs claquent.
        //      Tout est posé dans la vraie vue 3D (rendu, textures, bâtiments) ; reconstruit avec elle si la scène change.
        function ecLocal(E, i, j, zm) { const X = E.x0 + i * E.c * E.m, Y = E.y0 + j * E.c * E.m; return [worldToMm(X) / 1000, -worldToMm(Y) / 1000, (zm - (V3.zmin || 0)) * (V3.exag || 1)]; }
        async function ecBuild3D() { const E = EC; if (!E) return; if (!is3DOpen()) await open3D(); if (!V3 || !V3.root) return; ecAttach3D(); ecFrame3D(); }
        function ecAttach3D() { const E = EC; if (!E || !V3 || !V3.root || !window.THREE) return; const T = THREE;
            if (E.g3 && E.g3.parent) E.g3.parent.remove(E.g3); const g = new T.Group(); g.userData.ec = true; E.g3 = g;
            const { nx, ny, z } = E, n = nx * ny, P = new Float32Array(n * 3), idx = []; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zt = -Infinity, zb = Infinity;
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, zz = isNaN(z[k]) ? E.zmin : z[k], q = ecLocal(E, i, j, zz); P.set(q, 3 * k); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); zt = Math.max(zt, q[2]); zb = Math.min(zb, q[2]); }
            for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; if ([a, b, d, e].some(k => isNaN(z[k]))) continue; idx.push(a, d, b, b, d, e); }
            // eau : seulement les mailles mouillées (index refait au fil de la pluie), couleur selon la profondeur ; jamais de surface cachée sous le terrain qui ressortirait de loin
            const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); wg.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3)); wg.setIndex([]);
            E.wMesh = new T.Mesh(wg, new T.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.82, shininess: 110, specular: 0xaad4ff, side: T.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); E.wMesh.renderOrder = 2; g.add(E.wMesh); E.wBase = P; E.cells = idx;
            E.box = { x0, x1, y0, y1, zb, zt: zt + 35 }; E.span = Math.max(x1 - x0, y1 - y0);
            // pluie : des traits qui tombent, un peu penchés par le vent
            const NR = 3200, rp = new Float32Array(NR * 6); for (let k = 0; k < NR; k++) { const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0), zz = zb + Math.random() * (E.box.zt - zb); rp.set([x, y, zz, x + 0.12, y + 0.05, zz + 1.1], 6 * k); }
            const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3)); E.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xc7dcf0, transparent: true, opacity: 0.55, fog: false })); E.rain.visible = false; E.rain.frustumCulled = false; g.add(E.rain);
            // débords par les bords du levé : des gouttes qui tombent dans le vide
            const NS = 900, sp = new Float32Array(NS * 3).fill(-1e6), sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); E.drops = { p: sp, v: new Float32Array(NS * 3), n: 0, NS };
            E.dropPts = new T.Points(sg, new T.PointsMaterial({ color: 0x4aa8ff, size: 0.35, transparent: true, opacity: 0.9 })); E.dropPts.frustumCulled = false; g.add(E.dropPts);
            E.ring = new T.Group(); { const mk = (geo) => { const me = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xf59e0b, side: T.DoubleSide, depthTest: false, transparent: true, opacity: 0.95 })); me.renderOrder = 20; return me; };   // repère de la cuvette : un anneau au ras de l'eau et une balise, toujours visibles (au-dessus de l'eau, des arbres et de la pluie)
                E.ring.add(mk(new T.RingGeometry(1, 1.18, 48))); const st = mk(new T.CylinderGeometry(0.035, 0.035, 1, 8)); st.rotation.x = Math.PI / 2; st.position.z = 0.5; E.ring.add(st); const hd = mk(new T.SphereGeometry(0.09, 12, 8)); hd.position.z = 1; E.ring.add(hd); }
            E.ring.visible = false; g.add(E.ring);
            V3.root.add(g); ecUpd3D(true); }
        function ecFrame3D() { const E = EC; if (!E || !E.box || !V3) return; const b = E.box, rp = V3.root.position; V3.target.set((b.x0 + b.x1) / 2 + rp.x, (b.y0 + b.y1) / 2 + rp.y, (b.zb + b.zt - 35) / 2 + rp.z); V3.dist = Math.max(20, E.span * 1.15); V3.el = 0.42; render3D(); }
        // ambiance d'orage : lumière baissée, brume grise ; éclairs = la lumière claque deux fois, un voile blanc sur la vue
        function ecStorm(on) { const E = EC; if (!V3 || !V3.amb || !V3.sun) return; if (on && !V3.storm) { V3.storm = { amb: V3.amb.intensity, sun: V3.sun.intensity, fog: V3.scene.fog }; const R = Math.max(50, (E && E.span) || 200);
                V3.amb.intensity *= 0.55; V3.sun.intensity *= 0.4; V3.scene.fog = new THREE.Fog(0x55606e, R * 0.35, R * 4); }
            else if (!on && V3.storm) { V3.amb.intensity = V3.storm.amb; V3.sun.intensity = V3.storm.sun; V3.scene.fog = V3.storm.fog || null; V3.storm = null; const f = document.getElementById('v3-flash'); if (f) f.style.opacity = 0; } }
        function ecFlashTick(E, now) { if (!V3 || !V3.storm || E.noFlash) return; const it = E.raining ? ecRainAt(E, E.t) : 0; const f = document.getElementById('v3-flash');
            if (!E.fl && Math.random() < Math.min(0.03, 0.0025 * it / 30)) E.fl = { t0: now, pat: Math.random() < 0.6 ? [0, 90, 170, 260] : [0, 120] };
            if (!E.fl) return; const dt = now - E.fl.t0, on = E.fl.pat.some((t, i) => i % 2 === 0 && dt >= t && dt < (E.fl.pat[i + 1] || t + 90));
            V3.amb.intensity = V3.storm.amb * (on ? 3.2 : 0.55); if (f) f.style.opacity = on ? 0.55 : 0; if (dt > E.fl.pat[E.fl.pat.length - 1] + 90) { E.fl = null; V3.amb.intensity = V3.storm.amb * 0.55; if (f) f.style.opacity = 0; } }
        function ecUpd3D(full) { const E = EC; if (!E || !E.wMesh || !is3DOpen()) return; if (E.g3 && !E.g3.parent) { ecAttach3D(); return; } const { nx, z, d } = E, ex = V3.exag || 1, pos = E.wMesh.geometry.attributes.position.array, B = E.wBase;
            const TH = 0.02, col = E.wMesh.geometry.attributes.color.array, sh = [0.62, 0.86, 0.98], dp = [0.08, 0.36, 0.86];   // ≥ 2 cm : un ruisseau, une flaque ; clair si peu profond, bleu franc si profond
            for (let k = 0; k < E.n; k++) { const dk = E.roof[k] ? 0 : d[k], t = Math.min(1, Math.max(0, (dk - TH) / 0.25)); pos[3 * k + 2] = B[3 * k + 2] + (Math.max(dk, 0) + 0.03) * ex; col[3 * k] = sh[0] + (dp[0] - sh[0]) * t; col[3 * k + 1] = sh[1] + (dp[1] - sh[1]) * t; col[3 * k + 2] = sh[2] + (dp[2] - sh[2]) * t; }
            if (full || E.step % 3 === 0) { const C = E.cells, out = [], w = (k) => !E.roof[k] && d[k] > TH; for (let q = 0; q < C.length; q += 3) { const a = C[q], b = C[q + 1], c2 = C[q + 2]; if ((w(a) ? 1 : 0) + (w(b) ? 1 : 0) + (w(c2) ? 1 : 0) >= 2) out.push(a, b, c2); } E.wMesh.geometry.setIndex(out); }
            E.wMesh.geometry.attributes.position.needsUpdate = true; E.wMesh.geometry.attributes.color.needsUpdate = true; if (full || (E.step % 6 === 0)) E.wMesh.geometry.computeVertexNormals();
            const D = E.drops; if (D) { while (E.spill.length) { const [i, j, di, dj] = E.spill.pop(), k = D.n++ % D.NS, kk = j * nx + i, q = ecLocal(E, i + di * 0.5, j + dj * 0.5, z[kk]); D.p[3 * k] = q[0]; D.p[3 * k + 1] = q[1]; D.p[3 * k + 2] = q[2];
                    D.v[3 * k] = di * 0.12 * (0.6 + Math.random()); D.v[3 * k + 1] = -dj * 0.12 * (0.6 + Math.random()); D.v[3 * k + 2] = 0.05; }
                for (let k = 0; k < D.NS; k++) { if (D.p[3 * k + 2] < -1e5) continue; D.v[3 * k + 2] -= 0.03; D.p[3 * k] += D.v[3 * k]; D.p[3 * k + 1] += D.v[3 * k + 1]; D.p[3 * k + 2] += D.v[3 * k + 2]; if (D.p[3 * k + 2] < E.box.zb - 30) D.p[3 * k + 2] = -1e6; }
                E.dropPts.geometry.attributes.position.needsUpdate = true; }
            const raining = !!(E.run && E.raining); E.rain.visible = raining; ecStorm(raining);
            if (raining) { const a = E.rain.geometry.attributes.position.array, it = ecRainAt(E, E.t), fall = 0.9 + Math.min(2.2, it / 50), b = E.box; E.rain.material.opacity = Math.min(0.75, 0.25 + it / 160);
                for (let k = 0; k < a.length; k += 6) { a[k + 2] -= fall; a[k + 5] -= fall; a[k] += 0.04; a[k + 3] += 0.04; if (a[k + 2] < b.zb) { const x = b.x0 + Math.random() * (b.x1 - b.x0), y = b.y0 + Math.random() * (b.y1 - b.y0); a[k] = x; a[k + 1] = y; a[k + 2] = b.zt; a[k + 3] = x + 0.12; a[k + 4] = y + 0.05; a[k + 5] = b.zt + 1.1; } }
                E.rain.geometry.attributes.position.needsUpdate = true; ecFlashTick(E, performance.now()); }
            if (E.ring) { const z0 = E.ret && E.ret[E.focus]; E.ring.visible = !!z0; if (z0) { const r = Math.max(E.c * 2, Math.sqrt(z0.cells.length) * E.c * 0.8), kk = Math.round(z0.cj) * nx + Math.round(z0.ci), q = ecLocal(E, z0.ci, z0.cj, isNaN(z[kk]) ? E.zmin : z[kk]); E.ring.scale.set(r, r, r * 1.4); E.ring.position.set(q[0], q[1], q[2] + (Math.max(0, d[kk] || 0) + 0.08) * ex); } }
            render3D(); }
        function ecRender() { if (is3DOpen()) render3D(); }
        function toggleLayerTin(id) { const l = layers.find(x => x.id === id); if (!l) return; l.noTin = !l.noTin; tinCache = null; invalidateCache(); saveState(); updateLayerUI(); draw(); if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene();
            updateCommandMessageText('CALQUE « ' + l.name + ' » : ' + (l.noTin ? 'ses points ne comptent plus dans le terrain.' : 'ses points comptent dans le terrain (même masqué).')); }
        function tinNodes(filter, withPlates) {
            const nodes = [], seen = new Set(), BT = batList();   // bâtiments existants : leurs cotes (toit, faîtage, égout) ne sont pas du terrain
            for (const s of shapes) {
                if (s.gen || s.solid || s.sweep || s.trench || s.water || s.river || s.wallMat || s.wz || s.brush || s.bois || s.stair || s.stair2 || s.bassin || s.maille || s.sondage || s.mailZone) continue;   // volumes, parois, balayages et tranchées : ni terrain ni plateforme
                if (!withPlates && isPlateforme(s)) continue;
                if ((s.bid || s.lvl) && s.type !== 'point' && !isPlateforme(s)) continue;   // tracé d'un bâtiment (étage) : jamais du terrain, même s'il porte des Z
                const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.noTin) continue;   // masquer un calque ne change pas le terrain ; seul ⛰ (gestionnaire de calques) l'en exclut
                if (l && String(l.hatch || '').startsWith('m-')) continue;   // calque de parois (« Paroi béton »…) : jamais du terrain, même rouvert d'un ancien DXF
                if (filter && !filter(s)) continue;
                shapeVertices(s).forEach(v => { const z = v.get(); if (!hasZ(z)) return; if (BT.length && batAt(BT, v.x, v.y, z)) return; const k = Math.round(v.x * 10) + ',' + Math.round(v.y * 10); if (seen.has(k)) return; seen.add(k); nodes.push({ x: v.x, y: v.y, z, br: s.type !== 'point' }); });
            }
            return nodes;
        }
        // trop de points pour la triangulation (grille IGN fine sur un grand cercle) : la grille de points est éclaircie régulièrement,
        // les lignes de rupture (bords de route, talus) gardées ; avant, au-delà de 8 000 points il n'y avait plus de terrain du tout
        const TIN_MAX = 7500;
        function tinThin(nodes) { if (nodes.length <= TIN_MAX) return nodes; const br = nodes.filter(n => n.br), pt = nodes.filter(n => !n.br); let keepBr = br;
            if (br.length > TIN_MAX * 0.5) { const st = Math.ceil(br.length / (TIN_MAX * 0.5)); keepBr = br.filter((n, i) => i % st === 0); }
            const room = Math.max(3, TIN_MAX - keepBr.length); if (pt.length <= room) return keepBr.concat(pt);
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pt.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
            let c = Math.sqrt((x1 - x0) * (y1 - y0) / room) || 1, out = [];
            for (let it = 0; it < 8; it++) { const seen = new Set(); out = []; pt.forEach(n => { const k = Math.floor((n.x - x0) / c) + ',' + Math.floor((n.y - y0) / c); if (seen.has(k)) return; seen.add(k); out.push(n); }); if (out.length <= room) break; c *= Math.sqrt(out.length / room) * 1.02; }
            return keepBr.concat(out); }
        function buildTIN(nodes) {
            nodes = tinThin(nodes); if (nodes.length < 3) return null;
            const tris = delaunay(nodes);
            if (!tris.length) return null;
            // index en grille pour retrouver vite le triangle sous un point
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
            const G = Math.max(4, Math.min(200, Math.round(Math.sqrt(tris.length)))), cw = (maxX - minX) / G || 1, ch = (maxY - minY) / G || 1, cells = new Map();
            tris.forEach((t, k) => {
                const xs = t.map(i => nodes[i].x), ys = t.map(i => nodes[i].y);
                const i0 = Math.floor((arrMin(xs) - minX) / cw), i1 = Math.floor((arrMax(xs) - minX) / cw), j0 = Math.floor((arrMin(ys) - minY) / ch), j1 = Math.floor((arrMax(ys) - minY) / ch);
                for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i + ',' + j; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(k); }
            });
            return { nodes, tris, minX, minY, maxX, maxY, cw, ch, cells };
        }
        // le terrain n'est retriangulé que si ses points ont changé (tracer une ligne, une cote, un bloc ne le refait plus) ; les modèles qui en dépendent
        // (sol fini, talus, eau) gardent alors leur cache : c'est ce qui rendait le dessin lent sur un gros plan
        const TIN_PREV = [];
        function tinSig(nodes) { let h = 2166136261 >>> 0; const mix = (v) => { h ^= v | 0; h = Math.imul(h, 16777619) >>> 0; };
            for (const n of nodes) { mix(Math.round(n.x * 100)); mix(Math.round(n.y * 100)); mix(Math.round(n.z)); mix(n.br ? 1 : 0); } return nodes.length + ':' + h; }
        function getTIN() { if (!tinCache) { const nodes = tinNodes(), sig = tinSig(nodes), hit = TIN_PREV.find(e => e.sig === sig);
                if (hit) tinCache = hit.t; else { tinCache = buildTIN(nodes) || { empty: true }; TIN_PREV.unshift({ sig, t: tinCache }); TIN_PREV.length = Math.min(TIN_PREV.length, 3); } }
            return tinCache.empty ? null : tinCache; }
        // Altitude (mm) du MNT au point (x, y) monde, ou undefined hors surface
        function tinZ(x, y, tin) {
            tin = tin || getTIN(); if (!tin) return undefined;
            const cell = tin.cells.get(Math.floor((x - tin.minX) / tin.cw) + ',' + Math.floor((y - tin.minY) / tin.ch)); if (!cell) return undefined;
            for (const k of cell) {
                const [a, b, c] = tin.tris[k].map(i => tin.nodes[i]);
                const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y); if (Math.abs(d) < 1e-12) continue;
                const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d, l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d, l3 = 1 - l1 - l2;
                if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * a.z + l2 * b.z + l3 * c.z;
            }
            return undefined;
        }
        // Altitude au point : objet coté exact d'abord, sinon surface du terrain
        function zHere(x, y) { const zs = zAt(x, y, 0.5); if (zs.length) return zs[0]; return tinZ(x, y); }

        // ---------- Étiquette de pente : 2 clics, flèche vers le bas, pente en % ----------
        let slopeP1 = null;
        function makeSlope(p1, p2) {
            const z1 = zHere(p1.x, p1.y), z2 = zHere(p2.x, p2.y);
            if (!hasZ(z1) || !hasZ(z2)) return null;
            return { type: 'slope', layerId: DIM_LAYER_ID, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, z1, z2, zk: 1 };
        }
        // « 4,33 % · Δh 0,26 m » : pente et différence de niveau entre les 2 points
        function slopeLabel(s) { return nfr(Math.abs(slopePct(s)), 2) + ' % · Δh ' + fmtZ(Math.abs(s.z2 - s.z1)) + ' m'; }
        function slopePct(s) { const L = worldToMm(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)); return L > 0 ? (s.z2 - s.z1) / L * 100 : 0; }
        function drawSlopeShape(targetCtx, s, col, dx, dy, lineScale) {
            // la flèche descend : du point le plus haut vers le plus bas
            let a = { x: s.x1 + dx, y: s.y1 + dy }, b = { x: s.x2 + dx, y: s.y2 + dy }; if (s.z2 > s.z1) [a, b] = [b, a];
            const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) return;
            const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, h = 9 / lineScale;
            targetCtx.setLineDash([]); targetCtx.beginPath(); targetCtx.moveTo(a.x, a.y); targetCtx.lineTo(b.x, b.y); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.moveTo(b.x, b.y); targetCtx.lineTo(b.x - ux * h - uy * h * 0.4, b.y - uy * h + ux * h * 0.4); targetCtx.lineTo(b.x - ux * h + uy * h * 0.4, b.y - uy * h - ux * h * 0.4); targetCtx.closePath(); targetCtx.fillStyle = targetCtx.strokeStyle; targetCtx.fill();
            dimensionTextsToDraw.push({ text: slopeLabel(s), worldX: (a.x + b.x) / 2, worldY: (a.y + b.y) / 2, color: col, layerId: s.layerId || DIM_LAYER_ID, angle: Math.atan2(uy, ux), al: true });
        }
        // ---------- Fenêtre commune ----------
        function openTopoModal(title, bodyHtml, actions) {
            document.getElementById('tm-title').textContent = title;
            document.getElementById('tm-body').innerHTML = bodyHtml; { const st = document.getElementById('tm-strip'); if (st) st.remove(); const pn = document.querySelector('#topo-modal > div'); pn.classList.remove('sp-has-strip', 'calc-rail'); pn.querySelectorAll(':scope > .calc-tabs').forEach(x => x.remove()); document.getElementById('tm-body').classList.remove('sp-tabbed');
                // Σ Calculs : les onglets passent en rail vertical à gauche, comme les chapitres de Y
                const ct = document.querySelector('#tm-body > .calc-tabs'); if (ct) { pn.appendChild(ct); pn.classList.add('sp-has-strip', 'calc-rail'); } } window.tmTab = null;
            const a = document.getElementById('tm-actions'); a.innerHTML = '';
            (actions || []).forEach(([label, fn, primary]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn;
                b.style.cssText = 'border:0;border-radius:6px;padding:7px 14px;cursor:pointer;color:#fff;background:' + (primary ? '#2563eb' : '#4b5563'); a.appendChild(b); });
            // largeur du tiroir selon le contenu : grands tableaux et graphiques en large, petits réglages en étroit
            document.getElementById('topo-modal').style.setProperty('--dw', /Métré|Cubatures|Calculs|Profil/.test(title) ? '1040px' : '420px');
            document.getElementById('topo-modal').style.display = 'flex';
        }
        function closeTopoModal() { if (typeof trSelV !== 'undefined' && trSelV) { trSelV = null; setTimeout(draw, 0); } if (typeof openSel !== 'undefined' && openSel) { openSel = null; setTimeout(draw, 0); } document.getElementById('topo-modal').style.display = 'none'; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
        const nfr = (v, d) => typeof v === 'number' && d >= 0 && d <= 20 ? nfFmt(d, true).format(v) : v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
        const mOf = (w) => worldToMm(w) / 1000;               // longueur monde -> m
        function downloadText(name, text, type) {
            const url = URL.createObjectURL(new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' }));
            const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
        function copyText(text) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => updateCommandMessageText('Copié : collez-le dans un tableur (Ctrl+V).'), () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); updateCommandMessageText('Copié : collez-le dans un tableur (Ctrl+V).'); }); }
        // calque des cotes de talus (nez / pied) : créé à la première plateforme à talus dessinée
        let talusCotPending = false;
        function talusCotLayer() { const L = layers.find(l => l.name === 'Cotes de talus'); if (!L && !talusCotPending) { talusCotPending = true; setTimeout(() => { talusCotPending = false; if (!layers.some(l => l.name === 'Cotes de talus')) { ensureLayer('Cotes de talus', '#d9f99d'); updateLayerUI(); } }, 0); } return L || null; }
        // calques des données cartographiques importées (cadastre, bâti, terrain IGN) : chacun indépendant, rangés ensemble dans le groupe « Données carto »
        const CARTO_GROUP = 'Données carto', isCartoLayer = (l) => /^Cadastre — /.test(l.name) || /^(TN IGN|Zones boisées|Routes — bords \(TN\))$/.test(l.name);
        function cartoGroup(id) { const l = layers.find(x => x.id === id); if (l && l.group === undefined) l.group = CARTO_GROUP; return id; }
        function cartoGroupAll() { (layers || []).forEach(l => { if (isCartoLayer(l) && l.group === undefined) l.group = CARTO_GROUP; }); }   // fichiers d'avant : rangés à l'ouverture
        function ensureLayer(name, color, dash, width) {
            let l = layers.find(x => x.name === name); if (l) return l.id;
            l = { id: generateId(), name, visible: true, color, dash: dash || 'solid', width: width || 1, textH: '', hatch: 'lines', hatchScale: 1 }; layers.push(l); if (!ensureLayer.quiet) updateLayerUI(); return l.id;
        }

