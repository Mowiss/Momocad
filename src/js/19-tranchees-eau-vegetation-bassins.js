        // =====================================================================
        // TRANCHÉES (palette Topo) : polyligne de fil d'eau calée sous le sol fini (terrain + plateformes),
        // profil type (largeur, hauteur, hauteur de pose, couches du catalogue, tubes du catalogue), étiquette FE / T à chaque sommet,
        // pente du fil d'eau entre sommets (>> x % >> ; XX x % XX si contre-pente en gravitaire), volumes et prix par couche.
        // s.trench = { name, W, H, hp, gap, grav, layers: [{ mat, h, v }], tubes: [{ mat, n }] } (mm) ; sommet q : z = FE, q.feM = FE imposé, q.tM = T imposé (indicatif)
        let trenchDraw = null, trEdit = null, trEditFrom = null, brkDraw = false;
        const TR_KEY = 'momocad-trtypes';
        const trDefault = () => ({ name: '', W: 600, H: 1000, hp: 100, gap: 50, grav: true,
            layers: [{ mat: 'BB', h: 60 }, { mat: 'GNT_0_315', h: 300 }, { mat: '__REM', h: 0, v: true }, { mat: 'SABLE', h: 400 }], tubes: [{ mat: 'PVC_CR8_200', n: 1 }] });
        const TR_DEFAULT_TYPES = [
            Object.assign(trDefault(), { name: 'Eaux usées Ø200 sous chaussée' }),
            Object.assign(trDefault(), { name: 'Eaux pluviales Ø315 sous chaussée', W: 800, H: 1300, tubes: [{ mat: 'PVC_CR8_315', n: 1 }], layers: [{ mat: 'BB', h: 60 }, { mat: 'GNT_0_315', h: 300 }, { mat: '__REM', h: 0, v: true }, { mat: 'SABLE', h: 500 }] }),
            Object.assign(trDefault(), { name: 'Eau potable PEHD Ø110 sous trottoir', W: 500, H: 1000, tubes: [{ mat: 'PEHD_EAU_110', n: 1 }], layers: [{ mat: 'BB', h: 50 }, { mat: 'GNT_0_315', h: 200 }, { mat: '__REM', h: 0, v: true }, { mat: 'SABLE', h: 300 }] }),
            Object.assign(trDefault(), { name: 'Réseaux secs 3 × TPC Ø90 sous espace vert', W: 500, H: 800, grav: false, tubes: [{ mat: 'TPC_90', n: 3 }], layers: [{ mat: 'TERRE VEGETALE', h: 200 }, { mat: '__REM', h: 0, v: true }, { mat: 'SABLE', h: 250 }] }),
        ];
        let trTypes = (() => { try { const v = JSON.parse(localStorage.getItem(TR_KEY)); if (Array.isArray(v) && v.length) return v; } catch (e) {} return JSON.parse(JSON.stringify(TR_DEFAULT_TYPES)); })();
        let trCur = JSON.parse(JSON.stringify(trTypes[0] || trDefault()));
        function trTypesSave() { try { localStorage.setItem(TR_KEY, JSON.stringify(trTypes)); } catch (e) {} }
        const trClone = (o) => JSON.parse(JSON.stringify(o));
        const trNum = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
        const trM = (mm, d) => nfr((+mm || 0) / lenF(), d === undefined ? lenDec() : d);   // longueur de tranchée dans l'unité du dessin
        function trLayerId() { let l = layers.find(x => x.name === 'Tranchées'); if (!l) { l = { id: generateId(), name: 'Tranchées', visible: true, color: '#38bdf8', dash: 'solid', width: 1 }; layers.push(l); updateLayerUI(); } return l.id; }
        function trMatName(code) { if (code === '__REM') return 'Remblai (matériaux du site)'; return matLabel(structMat(code)); }
        function trTubeDn(code) { const m = structMat(code); return +m.dn > 0 ? +m.dn : 200; }
        // ---- hauteurs des couches pour une fouille de profondeur D (mm), du haut vers le bas ; la couche « variable » (ou la plus haute) absorbe la différence
        function trLayerBands(tr, D) {
            const L = tr.layers || [], vi = L.findIndex(l => l.v), F = L.reduce((a, l, i) => a + (i === vi ? 0 : Math.max(0, +l.h || 0)), 0), extra = D - F;
            const hs = L.map((l, i) => i === vi ? Math.max(0, extra) : Math.max(0, +l.h || 0));
            if (vi < 0 && L.length && extra > 0) hs[0] += extra;
            const out = new Array(L.length); let z = 0;
            for (let i = L.length - 1; i >= 0; i--) { const bot = Math.min(z, D), top = Math.min(z + hs[i], D); out[i] = { bot, top, h: Math.max(0, top - bot) }; z += hs[i]; }
            return { bands: out, short: F > D + 0.5, F };
        }
        // ---- tubes posés côte à côte sur la hauteur de pose (rangées suivantes au-dessus si la largeur ne suffit pas) ; mm, x depuis l'axe, y depuis le fond
        function trTubeLayout(tr) {
            const list = []; (tr.tubes || []).forEach(t => { const dn = trTubeDn(t.mat); for (let k = 0; k < Math.max(0, Math.round(+t.n || 0)); k++) list.push({ mat: t.mat, dn }); });
            const W = +tr.W || 600, g = Math.max(0, +tr.gap || 0), out = []; let row = [], base = +tr.hp || 0;
            const flush = () => { if (!row.length) return; const tw = row.reduce((a, q) => a + q.dn, 0) + g * (row.length - 1); let x = -tw / 2;
                row.forEach(q => { out.push({ mat: q.mat, dn: q.dn, cx: x + q.dn / 2, cy: base + q.dn / 2 }); x += q.dn + g; }); base += Math.max(...row.map(q => q.dn)) + g; row = []; };
            list.forEach(q => { const tw = row.reduce((a, r) => a + r.dn + g, 0) + q.dn; if (row.length && tw > W - 2 * g) flush(); row.push(q); }); flush();
            return out;
        }
        // aire d'un disque (centre cy, rayon r) entre les horizontales y0 < y1
        function trDiscBand(r, cy, y0, y1) {
            const A = (y) => { const h = Math.max(0, Math.min(2 * r, y - (cy - r))); return r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(Math.max(0, 2 * r * h - h * h)); };
            return Math.max(0, A(y1) - A(y0));
        }
        // section (m²) pour une fouille de profondeur D (mm) : fouille, chaque couche (moins les tubes qui la traversent)
        function trSection(tr, D, lay) {
            const W = (+tr.W || 0) / 1000, B = trLayerBands(tr, D).bands, T = lay || trTubeLayout(tr);
            return { fouille: W * Math.max(0, D) / 1000, layers: B.map(b => { let a = W * b.h / 1000; T.forEach(t => { a -= trDiscBand(t.dn / 2, t.cy, b.bot, b.top) / 1e6; }); return Math.max(0, a); }) };
        }
        // ---- sol fini (terrain + plateformes et talus) au point, en mm ; undefined sans terrain ni plateforme
        let trGc = { ep: -1, f: null };
        function trGround() {
            if (trGc.ep === renderEpoch && trGc.f) return trGc.f;
            let M = null; try { M = finishedModel(); } catch (e) {}
            const plats = shapes.filter(s => isPlateforme(s));
            const tol = mmToWorld(60);
            const f = (x, y) => {
                // pile sur le bord d'une plateforme (un sommet de tranchée accroché à son angle) : c'est la cote de la plateforme, pas le pied du talus
                for (let i = plats.length - 1; i >= 0; i--) { const p = plats[i]; if (p.type === 'circle') { if (Math.abs(Math.hypot(x - p.x, y - p.y) - p.r) < tol) return p.z; continue; } const R = empriseOf(p); if (R && distToPoly(x, y, R) < tol) return platZAt(platSurf(p), x, y); }
                if (M) { try { const r = M.at(x, y); if (r && hasZ(r.z)) return r.z; } catch (e) {} }
                for (let i = plats.length - 1; i >= 0; i--) { const p = plats[i], R = empriseOf(p); if (R && pointInPolygon(x, y, R)) return p.type === 'circle' ? p.z : platZAt(platSurf(p), x, y); }
                const t = tinZ(x, y); return hasZ(t) ? t : undefined;
            };
            trGc = { ep: renderEpoch, f }; return f;
        }
        // T (tampon, sol fini) et FE automatiques / imposés au sommet i
        function trNode(s, i, G) {
            const q = s.points[i], tr = s.trench, g = (G || trGround())(q.x, q.y), tA = hasZ(g) ? g : undefined;
            const feA = hasZ(tA) ? Math.round(tA - (+tr.H || 0) + (+tr.hp || 0)) : (hasZ(q.z) && !hasZ(q.feM) ? q.z : -(+tr.H || 0) + (+tr.hp || 0));
            return { tA, t: hasZ(q.tM) ? q.tM : tA, feA, fe: hasZ(q.feM) ? q.feM : feA, feMan: hasZ(q.feM), tMan: hasZ(q.tM) };
        }
        function trSync(s, G) { if (!s || !s.trench) return; G = G || trGround(); s.points.forEach((q, i) => { const n = trNode(s, i, G); if (q.z !== n.fe) q.z = n.fe; }); }
        // pente du fil d'eau du sommet i au sommet i+1 (en %, positive = descend dans le sens du tracé)
        function trSlope(s, i) { const a = s.points[i], b = s.points[i + 1], L = worldToMm(Math.hypot(b.x - a.x, b.y - a.y)); return L > 0 ? (a.z - b.z) / L * 100 : 0; }
        // ---- quantités le long du tracé : profondeur réelle sous le sol fini, échantillonnée tous les 25 cm
        function trQty(s) {
            const tr = s.trench, G = trGround(), lay = trTubeLayout(tr), hp = +tr.hp || 0; trSync(s, G);
            let L = 0, Vf = 0, Dsum = 0, Dmin = Infinity, Dmax = -Infinity, noGround = false; const VL = (tr.layers || []).map(() => 0);
            for (let i = 0; i < s.points.length - 1; i++) {
                const a = s.points[i], b = s.points[i + 1], Lw = Math.hypot(b.x - a.x, b.y - a.y), Lm = mOf(Lw); if (Lm <= 0) continue;
                const n = Math.max(1, Math.min(400, Math.ceil(Lm / 0.25))); let prev = null;
                for (let k = 0; k <= n; k++) { const t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, fe = a.z + (b.z - a.z) * t, g = G(x, y);
                    let D; if (hasZ(g)) D = g - (fe - hp); else { D = +tr.H || 0; noGround = true; } D = Math.max(0, D);
                    const S = trSection(tr, D, lay), cur = { S, D };
                    if (prev) { const ds = Lm / n; Vf += (prev.S.fouille + S.fouille) / 2 * ds; S.layers.forEach((v, j) => { VL[j] += (prev.S.layers[j] + v) / 2 * ds; }); Dsum += (prev.D + D) / 2 * ds; }
                    Dmin = Math.min(Dmin, D); Dmax = Math.max(Dmax, D); prev = cur; }
                L += Lm;
            }
            const tubes = []; (tr.tubes || []).forEach(t => { const n = Math.max(0, Math.round(+t.n || 0)); if (!n) return; const r = tubes.find(u => u.mat === t.mat); if (r) r.n += n; else tubes.push({ mat: t.mat, n }); });
            return { L, Vf, Dmoy: L > 0 ? Dsum / L : 0, Dmin: isFinite(Dmin) ? Dmin : 0, Dmax: isFinite(Dmax) ? Dmax : 0, VL, tubes: tubes.map(t => ({ mat: t.mat, n: t.n, ml: t.n * L })), noGround };
        }
        // lignes chiffrées (format du métré : name, code, v, vf, t, A, qp, cout, pu, prix)
        function trQtyRows(s, Q) {
            Q = Q || trQty(s); const rows = [], tr = s.trench;
            { const m = structMat('__DEB'), q = { name: 'Déblai de tranchée', code: '__DEB', v: Q.Vf, vf: Q.Vf * m.coef, t: Q.Vf * m.d, A: 0, surf: false }; rows.push(Object.assign(q, matCost(m, q), { prix: +m.prix || 0 })); }
            (tr.layers || []).forEach((l, j) => { const m = structMat(l.mat), v = Q.VL[j] || 0; if (v <= 1e-9) return; const coef = m.coef || 1, q = { name: trMatName(l.mat), code: l.mat, v, vf: v * coef, t: v * (m.d || 0), A: 0, surf: false }; rows.push(Object.assign(q, matCost(m, q), { prix: +m.prix || 0 })); });
            Q.tubes.forEach(t => { const m = structMat(t.mat), q = { name: trMatName(t.mat) + (t.n > 1 ? ' × ' + t.n : ''), code: t.mat, v: 0, vf: 0, t: 0, A: 0, ml: t.ml, surf: false }; rows.push(Object.assign(q, matCost(m, q), { prix: +m.prix || 0 })); });
            { const by = {}; const G = trGround(); s.points.forEach((q, i) => { if (!q.reg) return; const d = hasZ(q.regD) ? q.regD : (+tr.rd || 1000), N = trNode(s, i, G), h = hasZ(N.t) ? Math.max(0, N.t - q.z) / 1000 : 0; const r = by[d] || (by[d] = { n: 0, h: 0 }); r.n++; r.h += h; });
              Object.keys(by).forEach(d => rows.push({ name: 'Regard Ø' + trM(+d) + ' ' + LUN() + ' (hauteur ' + nfr(by[d].h, 2) + ' m)', code: 'REGARD_' + d, v: 0, vf: 0, t: 0, A: 0, qp: by[d].n, n: by[d].n, cout: 0, pu: 'u', prix: 0, surf: false })); }
            return rows;
        }
        // ---- plan : emprise (largeur), étiquettes FE / T aux sommets, pente entre sommets
        function trOffset(P, d) {   // polyligne décalée de d (monde), angles en onglet
            const n = P.length, out = [];
            for (let i = 0; i < n; i++) {
                const nrm = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }; };
                const n0 = i > 0 ? nrm(P[i - 1], P[i]) : null, n1 = i < n - 1 ? nrm(P[i], P[i + 1]) : null;
                let m = n0 && n1 ? { x: n0.x + n1.x, y: n0.y + n1.y } : (n0 || n1); const ml = Math.hypot(m.x, m.y) || 1; m = { x: m.x / ml, y: m.y / ml };
                const c = n0 && n1 ? Math.max(0.25, m.x * n1.x + m.y * n1.y) : 1; out.push({ x: P[i].x + m.x * d / c, y: P[i].y + m.y * d / c });
            }
            return out;
        }
        function trLabelPos(s, i, ls) {   // coin haut-gauche de l'étiquette du sommet i (monde) et sa taille approchée
            const P = s.points, q = P[i], n = P.length, nr = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }; };
            let m = i > 0 && i < n - 1 ? (() => { const a = nr(P[i - 1], q), b = nr(q, P[i + 1]); return { x: a.x + b.x, y: a.y + b.y }; })() : i === 0 ? nr(q, P[1]) : nr(P[n - 2], q);
            const ml = Math.hypot(m.x, m.y) || 1; m = { x: m.x / ml, y: m.y / ml };
            const off = 34 / ls, w = 92 / ls, h = 40 / ls, cx = q.x + m.x * (off + w / 2), cy = q.y + m.y * (off + h / 2);
            return { x: cx - w / 2, y: cy - h / 2, w, h };
        }
        function drawTrench2D(c, s, col, sel, dx, dy, ls, isPrinting) {
            const tr = s.trench, P = s.points.map(q => ({ x: q.x + dx, y: q.y + dy })); if (P.length < 2) return;
            const G = trGround(); trSync(s, G);
            const hw = mmToWorld((+tr.W || 600) / 2);
            c.save(); c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 1 / ls; c.setLineDash([6 / ls, 4 / ls]);
            [hw, -hw].forEach(d => { const O = trOffset(P, d); c.beginPath(); c.moveTo(O[0].x, O[0].y); O.slice(1).forEach(o => c.lineTo(o.x, o.y)); c.stroke(); });
            c.setLineDash([]); c.globalAlpha = 1;
            // sommets : petit regard carré
            const r = 3.5 / ls; c.fillStyle = sel ? '#ec4899' : col; P.forEach(p => c.fillRect(p.x - r, p.y - r, 2 * r, 2 * r));
            s.points.forEach((q, i) => { if (!q.reg) return; const R = mmToWorld((hasZ(q.regD) ? q.regD : (+tr.rd || 1000)) / 2); c.strokeStyle = sel ? '#ec4899' : col; c.lineWidth = 1.4 / ls; c.beginPath(); c.arc(P[i].x, P[i].y, R, 0, 2 * Math.PI); c.stroke(); c.beginPath(); c.arc(P[i].x, P[i].y, R + mmToWorld(80), 0, 2 * Math.PI); c.stroke(); });
            if (!isPrinting && trSelV && trSelV.s === s && P[trSelV.i]) { c.strokeStyle = '#ec4899'; c.lineWidth = 2.5 / ls; c.beginPath(); c.arc(P[trSelV.i].x, P[trSelV.i].y, 9 / ls, 0, 2 * Math.PI); c.stroke(); }
            c.restore();
            s.points.forEach((q, i) => { const N = trNode(s, i, G), lp = trLabelPos(s, i, ls);
                screenTextsToDraw.push({ kind: 'detail', layerId: s.layerId, wx: lp.x + dx, wy: lp.y + dy, tx: q.x + dx, ty: q.y + dy, lines: ['FE ' + fmtZ(q.z) + (N.feMan ? ' *' : '')].concat(q.reg ? ['T ' + (hasZ(N.t) ? fmtZ(N.t) : '?') + (N.tMan ? ' *' : '')] : []), color: sel ? '#ec4899' : col, sizePx: 11, isPrinting }); });
            for (let i = 0; i < s.points.length - 1; i++) {
                const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 1e-9) continue;
                const p = trSlope(s, i), flat = Math.abs(p) < 0.0005, rev = p < 0;   // rev : remonte dans le sens du tracé (contre-pente)
                let fx = b.x - a.x, fy = b.y - a.y; if (rev) { fx = -fx; fy = -fy; }   // la flèche suit toujours la descente
                let ang = Math.atan2(fy, fx), na = ang; while (na > Math.PI / 2 + 1e-9) na -= Math.PI; while (na <= -Math.PI / 2 + 1e-9) na += Math.PI;
                const fwd = Math.abs(na - ang) < 1e-6, v = nfr(Math.abs(p), 2) + ' %';
                const txt = flat ? '= ' + v + ' =' : fwd ? '>> ' + v + ' >>' : '<< ' + v + ' <<';
                const grav = tr.grav !== false, bad = grav && (rev || flat), colS = grav ? (flat ? '#f59e0b' : rev ? '#ef4444' : '#4ade80') : (sel ? '#ec4899' : col);
                dimensionTextsToDraw.push({ text: txt, worldX: (a.x + b.x) / 2, worldY: (a.y + b.y) / 2, color: colS, layerId: s.layerId, angle: na, al: true });
            }
        }
        // ---- chaque sommet est un objet : son menu (FE, T, regard et son diamètre)
        let trSelV = null;
        function trVertexAt(w) { const tol = 8 / camera.zoom; for (let k = shapes.length - 1; k >= 0; k--) { const s = shapes[k]; if (!s.trench) continue; for (let i = 0; i < s.points.length; i++) if (Math.hypot(w.x - s.points[i].x, w.y - s.points[i].y) <= tol) return { s, i }; } return null; }
        function trVertexDialog(s, i) {
            const q = s.points[i]; if (!q) return; const N = trNode(s, i), tr = s.trench, E = MF.esc; trSelV = { s, i }; draw();
            const pin = i > 0 ? trSlope(s, i - 1) : null, pout = i < s.points.length - 1 ? trSlope(s, i) : null, d = hasZ(N.t) ? N.t - N.fe + (+tr.hp || 0) : NaN;
            const sl = (v, lab) => v === null ? '' : `<span style="color:${tr.grav !== false && v <= 0.0005 ? '#f87171' : '#4ade80'}">${lab} ${nfr(v, 2)} %</span>`;
            const regD = hasZ(q.regD) ? q.regD : (+tr.rd || 1000);
            const body = `<div class="flex flex-col gap-1.5">
                <div class="mf-hint">Sommet <b class="text-white">n° ${i + 1}</b> sur ${s.points.length} · ${sl(pin, 'pente amont')} ${sl(pout, '· pente aval')} · profondeur de fouille ${isFinite(d) ? trM(d) + ' ' + LUN() : '—'}</div>
                ${MF.row('Fil d\'eau FE', MF.num('trv-fe', N.feMan ? fmtZ(N.fe) : '', fmtZ(N.feA)), 'm')}
                ${MF.hint('Champ vide = automatique (valeur grisée). FE imposé : il fixe la hauteur du sommet et la profondeur de la tranchée ici.')}
                <label class="mf-ck"><input type="checkbox" id="trv-reg" ${q.reg ? 'checked' : ''} onchange="document.getElementById('trv-regbox').style.display=this.checked?'flex':'none'"><span>Un <b>regard</b> à ce sommet</span></label>
                <div id="trv-regbox" class="flex flex-col gap-1.5" style="display:${q.reg ? 'flex' : 'none'};">
                ${MF.row('Tampon T (cote finie du regard, indicative)', MF.num('trv-t', N.tMan ? fmtZ(N.t) : '', hasZ(N.tA) ? fmtZ(N.tA) : '?'), 'm')}
                ${MF.row('Ø intérieur du regard', MF.num('trv-rd', trM(regD)), LUN())}
                </div></div>`;
            openTopoModal('⌖ Sommet de tranchée — ' + (tr.name || ''), body, [['Supprimer le sommet', () => { if (s.points.length <= 2) { alert('Une tranchée garde au moins 2 sommets.'); return; } s.points.splice(i, 1); trSelV = null; closeTopoModal(); saveState(); draw(); }, false], ['Valider', () => {
                const fe = document.getElementById('trv-fe').value.trim(), t = document.getElementById('trv-t').value.trim(), fv = trNum(fe), tv = trNum(t), rd = trNum(document.getElementById('trv-rd').value);
                if (fe === '' || !isFinite(fv)) delete q.feM; else q.feM = Math.round(fv * 1000);
                q.reg = document.getElementById('trv-reg').checked; if (rd > 0) q.regD = Math.round(rd * lenF());
                if (!q.reg || t === '' || !isFinite(tv)) delete q.tM; else q.tM = Math.round(tv * 1000);   // T : seulement avec un regard
                trSync(s); trSelV = null; closeTopoModal(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
                updateCommandMessageText('SOMMET n° ' + (i + 1) + ' : FE ' + fmtZ(q.z) + (q.reg ? ' · regard Ø' + trM(q.regD || tr.rd || 1000) : '') + '.'); }, true]]);
            updateCommandMessageText('TRANCHÉE « ' + (tr.name || '') + ' », sommet n° ' + (i + 1) + ' : FE, T et regard.');
        }
        // modèle 3D : couches de la fouille (translucides), tubes au fil d'eau, regards jusqu'au tampon
        // =====================================================================
        // NIVEAU D'EAU NATUREL : contour fermé + altitude de l'eau. En plan, la zone inondée (terrain sous le niveau) en bleu translucide ;
        // en 3D, un plan d'eau à cette cote, que le terrain plus haut cache naturellement. s.water = { z (mm), name }
        // =====================================================================
        let waterDraw = false, WATER_CACHE = new WeakMap(), boisDraw = false;
        // outil Zone boisée (palette Topo) : un contour cliqué, fermé → zone boisée sur le calque « Zones boisées »
        // ---- VÉGÉTATION : arbres, buissons ou broussailles dans un contour ; le volet choisit la sorte, la hauteur et la couleur en 3D
        const VEG_K = { arbre: ['🌳 Arbres', 4, 30, 12, 'Arbres'], buisson: ['🌿 Buissons', 0.5, 4, 1.8, 'Buissons'], brous: ['🍂 Broussailles', 0.3, 1.5, 0.9, 'Broussailles'] };
        let vegOpt = { kind: 'arbre', h: { arbre: 12, buisson: 1.8, brous: 0.9 }, tex: 'photo' }; try { Object.assign(vegOpt, JSON.parse(localStorage.getItem('momocad-veg') || '{}')); } catch (e) {}
        function vegSave() { try { localStorage.setItem('momocad-veg', JSON.stringify(vegOpt)); } catch (e) {} }
        function vegPanel() { const K = VEG_K[vegOpt.kind] || VEG_K.arbre, h = vegOpt.h[vegOpt.kind] || K[3];
            t2Panel('🌳 Végétation', `<div class="st-sec"><div class="st-lab" style="margin-top:0">Sorte</div>${vSeg(Object.keys(VEG_K).map(k => [k, VEG_K[k][0]]), vegOpt.kind, "vegSet('kind', '$')")}
                <div class="st-row"><span>Hauteur</span><div class="st-sl"><input id="veg-h" type="range" min="${K[1]}" max="${K[2]}" step="${K[2] > 5 ? 0.5 : 0.1}" value="${h}" oninput="vegSet('h', this.value)"><b id="veg-h-v">${nfr(h, 1)} m</b></div></div>
                <div class="st-lab">Couleur en 3D</div>${vSeg([['photo', '📷 Photo du fond'], ['vert', '🌿 Verts']], vegOpt.tex, "vegSet('tex', '$')")}
                <div class="mf-hint" style="margin-top:8px">Clique le contour de la zone sur le plan ; recliquer le 1er point (ou double-clic) la ferme.</div></div>`, [['Fermer', "setMode('select-box');draw()"]]);
            document.getElementById('t2-panel').dataset.kind = 'veg'; }
        function vegSet(k, v) { if (k === 'kind') { if (VEG_K[v]) vegOpt.kind = v; vegSave(); vegPanel(); return; } if (k === 'h') { vegOpt.h[vegOpt.kind] = +v; const o = document.getElementById('veg-h-v'); if (o) o.textContent = nfr(+v, 1) + ' m'; } else vegOpt[k] = v; vegSave(); if (k === 'tex') vegPanel(); }
        function startBois() { setMode('poly'); boisDraw = true; vegPanel(); updateCommandMessageText('VÉGÉTATION (' + VEG_K[vegOpt.kind][4].toLowerCase() + ') : cliquez le contour de la zone ; clic sur le 1er point ou double-clic pour fermer.'); }
        function boisCreate(P) { if (!P || P.length < 3) { updateCommandMessageText('ZONE BOISÉE : il faut au moins 3 points.'); return; }
            { const tp = document.getElementById('t2-panel'); if (tp && tp.dataset.kind === 'veg') t2PanelClose(); }
            const kd = VEG_K[vegOpt.kind] ? vegOpt.kind : 'arbre', s = { type: 'poly', layerId: cartoGroup(ensureLayer('Zones boisées', '#4ade80')), points: P.map(q => ({ x: q.x, y: q.y })), hatch: false, bois: Object.assign({ h: vegOpt.h[kd] || VEG_K[kd][3], tex: vegOpt.tex === 'vert' ? 'vert' : 'photo' }, kd === 'arbre' ? {} : { kind: kd }), name: kd === 'arbre' ? 'Zone boisée' : VEG_K[kd][4] };
            shapes.push(s); selectedShapes = [s]; updateLayerUI(); invalidateCache(); saveState(); draw(); updatePropertiesPopup(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText('ZONE BOISÉE créée : arbres en plan, canopée en 3D. Y : hauteur des arbres (12 m) et couleur (photo du fond ou verts) ; poignées pour retoucher le contour.'); }
        // ---- ESCALIER (dans le tiroir des parois) : hauteur de marche, giron et nez réglables, contrôle par la formule de Blondel (2h + g = 60 à 64 cm).
        //      Deux clics : le bas puis la direction du haut ; les altitudes viennent du sol fini (plateforme, terrain, dalle) aux deux bouts,
        //      le nombre de marches en découle (hauteur réelle ajustée), la longueur = marches × giron. En plan : marches, nez en tirets, flèche ; en 3D : les marches.
        const STAIR_MAT = { beton: ['Béton', 0xa8a29e], pierre: ['Pierre', 0xd6c7a1], bois: ['Bois', 0xa0764b] };
        let stairOpt = { w: 1200, h: 170, g: 280, nez: 30, mat: 'pierre' }; try { const v = JSON.parse(localStorage.getItem('momocad-stair') || '{}'); delete v.hmax; Object.assign(stairOpt, v); } catch (e) {}
        let stairA = null, stairEdit = null;
        const blondel = (h, g) => { const b = 2 * h + g; return { b, ok: b >= 600 && b <= 640, near: b >= 590 && b <= 660 }; };
        function startStair() { closeFileMenus(); const bm = document.getElementById('menu-blocks'); if (bm) bm.classList.add('hidden'); stairEdit = null; setMode('stair'); stairA = null; stairPanel();
            updateCommandMessageText('ESCALIER : cliquez le pied de l\'escalier, puis un point dans la direction de la montée (accroches actives). Échap pour finir.'); }
        function stairPanel(sh) { if (sh) stairEdit = sh; const E = stairEdit && stairEdit.stair, O = E ? E : stairOpt, inp = (id, v) => `<input id="${id}" type="text" value="${v}" style="width:70px;background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px 6px;text-align:right">`;
            t2Panel('🪜 Escalier', `<div id="st-svg"></div><div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><span>Largeur</span><span>${inp('st-w', nfr(O.w / 1000, 2))} m</span>
                <span>Hauteur de marche${E ? '' : ' (visée)'}</span><span>${inp('st-h', nfr((E ? E.hc || E.h : O.h) / 10, 1))} cm</span><span>Giron</span><span>${inp('st-g', nfr(O.g / 10, 1))} cm</span><span>Nez de marche</span><span>${inp('st-n', nfr(O.nez / 10, 1))} cm</span></div>
                <div id="st-bl"></div>
                <div style="display:flex;gap:4px">${Object.keys(STAIR_MAT).map(k => `<button type="button" onclick="stairSet('mat','${k}')" style="flex:1;padding:5px;border-radius:6px;border:1px solid ${O.mat === k ? '#a3e635' : '#4b5563'};background:${O.mat === k ? 'rgba(163,230,53,.16)' : '#111827'};color:#e5e7eb;cursor:pointer;font-size:12px">${STAIR_MAT[k][0]}</button>`).join('')}</div>
                ${E ? '' : t2Note('Le nombre de marches vient de la différence d\'altitude entre le pied et le haut ; la hauteur réelle est ajustée pour tomber juste.')}`, [['Terminer', "t2PanelClose();stairEdit=null;setMode('select-box')", true]], "t2PanelClose();stairEdit=null;setMode('select-box')");
            const p = document.getElementById('t2-panel'); p.oninput = () => { const v = (id) => t2Num(document.getElementById(id).value), w = v('st-w'), h = v('st-h'), g = v('st-g'), n = v('st-n');
                const T = stairEdit ? stairEdit.stair : stairOpt; if (w > 0) T.w = w * 1000; if (h > 0) { if (stairEdit) T.hc = h * 10; else T.h = h * 10; } if (g > 0) T.g = g * 10; if (n >= 0) T.nez = n * 10;
                if (stairEdit) stairRebuild(stairEdit); else stairSave(); stairBl(); }; stairBl(); }
        // profil de l'escalier dans son volet : marches (hauteur, giron, nez), cotes, ligne de foulée et contrôle de Blondel ; se redessine à chaque réglage
        function stairSVG(o) { const E = !o && stairEdit && stairEdit.stair, h = o ? o.h : E ? E.h : stairOpt.h, g = o ? o.g : E ? E.g : stairOpt.g, nz = o ? (o.nez || 0) : E ? (E.nez || 0) : stairOpt.nez, n = o ? o.n || 4 : E ? Math.max(1, E.n) : 4, show = Math.min(n, 5), B = blondel(h, g);
            const VW = 340, VH = 200, pad = 30, sc = Math.min((VW - pad - 20 - 50) / (show * g + nz), (VH - 60) / (show * h)), X = (v) => pad + 50 + v * sc, Y = (v) => VH - pad + 6 - v * sc, f = (v) => v.toFixed(1);
            const c = B.ok ? '#4ade80' : B.near ? '#fbbf24' : '#f87171'; let d = `M${f(X(0))},${f(Y(0))}`, p = '';
            for (let i = 0; i < show; i++) { const x0 = i * g, z1 = (i + 1) * h; d += ` L${f(X(x0))},${f(Y(z1))} L${f(X(x0 - (i ? 0 : 0) - nz))},${f(Y(z1))} L${f(X(x0 - nz))},${f(Y(z1 - 25))} L${f(X(x0))},${f(Y(z1 - 25))}`; }
            d = `M${f(X(0))},${f(Y(0))}`; for (let i = 0; i < show; i++) { const x0 = i * g, z1 = (i + 1) * h; d += ` L${f(X(x0))},${f(Y(z1 - 30))} L${f(X(x0 - nz))},${f(Y(z1 - 30))} L${f(X(x0 - nz))},${f(Y(z1))} L${f(X(x0 + g))},${f(Y(z1))}`; }
            d += ` L${f(X(show * g))},${f(Y(0))} Z`;
            const dimV = (x, za, zb, t) => `<line x1="${f(x)}" x2="${f(x)}" y1="${f(Y(za))}" y2="${f(Y(zb))}" stroke="#fbbf24"/><line x1="${f(x - 3)}" x2="${f(x + 3)}" y1="${f(Y(za))}" y2="${f(Y(za))}" stroke="#fbbf24"/><line x1="${f(x - 3)}" x2="${f(x + 3)}" y1="${f(Y(zb))}" y2="${f(Y(zb))}" stroke="#fbbf24"/><text x="${f(x - 5)}" y="${f((Y(za) + Y(zb)) / 2 + 3.5)}" text-anchor="end" fill="#fbbf24">${t}</text>`;
            const dimH = (xa, xb, z, t, col, off, tx) => { const yy = Y(z) + off; return `<line x1="${f(X(xa))}" x2="${f(X(xb))}" y1="${f(yy)}" y2="${f(yy)}" stroke="${col}"/><line x1="${f(X(xa))}" x2="${f(X(xa))}" y1="${f(yy - 3)}" y2="${f(yy + 3)}" stroke="${col}"/><line x1="${f(X(xb))}" x2="${f(X(xb))}" y1="${f(yy - 3)}" y2="${f(yy + 3)}" stroke="${col}"/><text x="${f(tx !== undefined ? tx : (X(xa) + X(xb)) / 2)}" y="${f(yy + (off < 0 ? -4 : 11))}" text-anchor="${tx !== undefined ? 'end' : 'middle'}" fill="${col}">${t}</text>`; };
            p += `<path d="${d}" fill="#d6c7a1" fill-opacity="0.85" stroke="#e7e5e4" stroke-width="1"/>`;
            p += `<line x1="${f(X(-nz))}" y1="${f(Y(h))}" x2="${f(X((show - 1) * g))}" y2="${f(Y(show * h))}" stroke="${c}" stroke-dasharray="4 3"/>`;   // ligne des nez (pente)
            p += dimV(X(0) - 6, 0, h, nfr(h / 10, 1)) + dimH(g, 2 * g, 2 * h, 'giron ' + nfr(g / 10, 1), '#93c5fd', -10) + (nz > 0 ? dimH(g - nz, g, h, 'nez ' + nfr(nz / 10, 1), '#c4b5fd', -10, X(g - nz) - 4) : '');
            const ang = Math.atan2(h, g) * 180 / Math.PI;
            return `<svg viewBox="0 0 ${VW} ${VH}" width="100%" style="display:block;background:#0b1220;border:1px solid #374151;border-radius:8px" font-family="system-ui,sans-serif" font-size="10">${p}
                <text x="10" y="18" fill="${c}" font-weight="600" font-size="12">2h + g = ${nfr(B.b / 10, 1)} cm</text><text x="10" y="32" fill="#9ca3af">pente ${nfr(ang, 0)}° · ${E || (o && o.n) ? n + ' marches' : 'aperçu'}</text></svg>`; }
        function stairBl() { const sv = document.getElementById('st-svg'); if (sv) sv.innerHTML = stairSVG(); const el = document.getElementById('st-bl'); if (!el) return; const E = stairEdit && stairEdit.stair, h = E ? E.h : stairOpt.h, g = E ? E.g : stairOpt.g, B = blondel(h, g);
            el.innerHTML = blondelBox(h, g, E ? ' · ' + E.n + ' marches réelles de ' + nfr(E.h / 10, 1) + ' cm' : ''); }
        function blondelBox(h, g, extra) { const B = blondel(h, g); return `<div style="padding:7px 10px;border-radius:8px;border:1px solid ${B.ok ? '#166534' : B.near ? '#854d0e' : '#7f1d1d'};background:${B.ok ? 'rgba(22,101,52,.18)' : B.near ? 'rgba(133,77,14,.18)' : 'rgba(127,29,29,.18)'};font-size:12.5px">Blondel : 2 × ${nfr(h / 10, 1)} + ${nfr(g / 10, 1)} = <b>${nfr(B.b / 10, 1)} cm</b> — ${B.ok ? 'confortable (60 à 64)' : B.near ? 'acceptable, hors de 60 à 64' : B.b < 600 ? 'trop court : augmentez le giron ou la hauteur' : 'trop long : réduisez le giron ou la hauteur'}${extra || ''}</div>`; }
        function stairSet(k, v) { const T = stairEdit ? stairEdit.stair : stairOpt; T[k] = v; if (stairEdit) stairRebuild(stairEdit); else stairSave(); stairPanel(); }
        function stairSave() { try { localStorage.setItem('momocad-stair', JSON.stringify(stairOpt)); } catch (e) {} }
        // sol fini au bout : plateforme (même pile sur son bord), talus, terrain ; ou le dessus d'une dalle qui le porte
        function stairGround(x, y) { let z = trGround()(x, y); shapes.forEach(d => { if (!(d.solid && d.solid.kind === 'box' && d.type === 'poly' && hasZ(solidBaseZ(d)) && pointInPolygon(x, y, d.points))) return; const t = solidBaseZ(d) + (d.solid.H || 0); if (!hasZ(z) || (t < z + 3000 && t > z)) z = t; }); return hasZ(z) ? z : 0; }
        // géométrie à partir du pied a, de la direction u, des altitudes et des réglages : n marches, hauteur ajustée, longueur n × giron
        function stairRebuild(s) { const S = s.stair, dz = Math.abs(S.z1 - S.z0), hc = S.hc || S.h || 170, n = Math.max(1, Math.round(dz / hc)), L = mmToWorld(n * S.g), w = mmToWorld(S.w) / 2, u = S.u, nx = -u.y * w, ny = u.x * w;
            S.n = n; S.h = Math.round(dz / n); S.b = { x: S.a.x + u.x * L, y: S.a.y + u.y * L }; s.points = [{ x: S.a.x + nx, y: S.a.y + ny }, { x: S.b.x + nx, y: S.b.y + ny }, { x: S.b.x - nx, y: S.b.y - ny }, { x: S.a.x - nx, y: S.a.y - ny }]; S.fp = JSON.stringify(s.points.map(q => [Math.round(q.x), Math.round(q.y)]));
            invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } }
        // cadre de l'escalier modifié (poignées, étirer) : l'escalier suit. Largeur = cadre, longueur = marches × giron (même nombre de marches)
        function stairFrameSync(one) { (one ? [one] : shapes).forEach(s => { const S = s.stair; if (!S || !S.b || !s.points || s.points.length !== 4) return; const P = s.points, sig = JSON.stringify(P.map(q => [Math.round(q.x), Math.round(q.y)])); if (S.fp === sig) return;
            if (S.fp) { const a = { x: (P[0].x + P[3].x) / 2, y: (P[0].y + P[3].y) / 2 }, b = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 }, L = Math.hypot(b.x - a.x, b.y - a.y), W = Math.hypot(P[0].x - P[3].x, P[0].y - P[3].y);
                if (L > mmToWorld(100) && W > mmToWorld(100)) { S.a = a; S.b = b; S.u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; S.w = Math.round(worldToMm(W)); S.g = Math.round(worldToMm(L) / Math.max(1, S.n)); } }
            S.fp = sig; }); }
        function stairMake(A, B) { const Lw = Math.hypot(B.x - A.x, B.y - A.y) || 1, o = mmToWorld(300) / Lw;   // sol lu 30 cm au-delà de chaque bout : un clic pile sur le bord d'une plateforme ne prête pas à confusion
            let z0 = stairGround(A.x - (B.x - A.x) * o, A.y - (B.y - A.y) * o), z1 = stairGround(B.x + (B.x - A.x) * o, B.y + (B.y - A.y) * o); if (z1 < z0) { [A, B] = [B, A]; [z0, z1] = [z1, z0]; }
            const u = { x: (B.x - A.x) / Lw, y: (B.y - A.y) / Lw }, s = { type: 'poly', layerId: ensureLayer('Escaliers', '#d6c7a1'), points: [], hatch: false, zk: 1, name: 'Escalier',
                stair: { a: { x: A.x, y: A.y }, u, w: stairOpt.w, z0: Math.round(z0), z1: Math.round(z1), hc: stairOpt.h, g: stairOpt.g, nez: stairOpt.nez, mat: stairOpt.mat } };
            shapes.push(s); stairRebuild(s); const S = s.stair, B2 = blondel(S.h, S.g), Lr = S.n * S.g / 1000;
            updateCommandMessageText('ESCALIER : ' + S.n + ' marche(s) de ' + nfr(S.h / 10, 1) + ' cm, giron ' + nfr(S.g / 10, 1) + ' cm, nez ' + nfr(S.nez / 10, 1) + ' cm, longueur ' + nfr(Lr, 2) + ' m, de ' + nfr(z0 / 1000, 2) + ' à ' + nfr(z1 / 1000, 2) + ' ; Blondel ' + nfr(B2.b / 10, 1) + ' cm' + (B2.ok ? ' ✓' : ' (hors de 60 à 64)') + (Math.abs(Lr - mOf(Lw)) > 0.3 ? ' — l\'escalier fait ' + nfr(Lr, 2) + ' m, pas ' + nfr(mOf(Lw), 2) + ' m : le haut arrive là où tombe la dernière marche' : '') + '. Y pour le régler.'); return s; }
        function stairClick(w) { const sn = findSnap(w.x, w.y), q = sn ? { x: sn.x, y: sn.y } : w; if (!stairA) { stairA = q; updateCommandMessageText('ESCALIER : cliquez maintenant vers le haut (direction de la montée).'); draw(); return; } const A = stairA; stairA = null; if (Math.hypot(q.x - A.x, q.y - A.y) < mmToWorld(300)) return; stairMake(A, q); }
        function drawStair2D(c, s, col, dx, dy, lineScale) { try { stairFrameSync(s); } catch (e) {}   // cadre déplacé ou étiré : l'escalier suit pendant le glissé, pas seulement au lâcher
 const S = s.stair; if (!S.b || !S.u) return; const A = S.a, B = S.b, n = Math.max(1, S.n), w = mmToWorld(S.w) / 2, u = S.u, nx = -u.y * w, ny = u.x * w, L = Math.hypot(B.x - A.x, B.y - A.y), nz = mmToWorld(S.nez || 0);
            c.save(); c.strokeStyle = col; c.lineWidth = 1 / lineScale; c.setLineDash([]); c.beginPath();
            for (let i = 1; i < n; i++) { const t = i / n, x = A.x + (B.x - A.x) * t + dx, y = A.y + (B.y - A.y) * t + dy; c.moveTo(x + nx, y + ny); c.lineTo(x - nx, y - ny); } c.stroke();
            if (nz > 0) { c.setLineDash([3 / lineScale, 3 / lineScale]); c.beginPath(); for (let i = 1; i < n; i++) { const t = i / n, x = A.x + (B.x - A.x) * t - u.x * nz + dx, y = A.y + (B.y - A.y) * t - u.y * nz + dy; c.moveTo(x + nx, y + ny); c.lineTo(x - nx, y - ny); } c.stroke(); c.setLineDash([]); }
            const ah = Math.min(w * 0.8, L * 0.15); c.beginPath(); c.moveTo(A.x + dx + u.x * L * 0.08, A.y + dy + u.y * L * 0.08); c.lineTo(B.x + dx - u.x * L * 0.05, B.y + dy - u.y * L * 0.05);
            c.moveTo(B.x + dx - u.x * (L * 0.05 + ah) + u.y * ah * 0.6, B.y + dy - u.y * (L * 0.05 + ah) - u.x * ah * 0.6); c.lineTo(B.x + dx - u.x * L * 0.05, B.y + dy - u.y * L * 0.05); c.lineTo(B.x + dx - u.x * (L * 0.05 + ah) - u.y * ah * 0.6, B.y + dy - u.y * (L * 0.05 + ah) + u.x * ah * 0.6); c.stroke(); c.restore();
            dimensionTextsToDraw.push({ text: n + ' × ' + nfr(S.h / 10, 1) + ' / ' + nfr(S.g / 10, 1) + ' cm', worldX: (A.x + B.x) / 2 + dx, worldY: (A.y + B.y) / 2 + dy, color: col, layerId: s.layerId }); }
        function drawStairPreview(ctx) { if (mode !== 'stair' || !stairA) return; const A = stairA, B = { x: currentX, y: currentY }, L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-9) return; const w = mmToWorld(stairOpt.w) / 2, nx = -(B.y - A.y) / L * w, ny = (B.x - A.x) / L * w;
            ctx.save(); ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 1.5 / camera.zoom; ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]); ctx.beginPath(); ctx.moveTo(A.x + nx, A.y + ny); ctx.lineTo(B.x + nx, B.y + ny); ctx.lineTo(B.x - nx, B.y - ny); ctx.lineTo(A.x - nx, A.y - ny); ctx.closePath(); ctx.stroke(); ctx.restore(); }
        // marches en 3D : chaque marche déborde de son nez sur la contremarche d'en dessous
        function stair3D(root, vis, P, Zm) { vis.filter(s => s.stair && s.stair.b).forEach(s => { const S = s.stair, n = Math.max(1, S.n), A = P(S.a.x, S.a.y), B = P(S.b.x, S.b.y), L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-6) return;
            const ang = Math.atan2(B.y - A.y, B.x - A.x), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, W = S.w / 1000, nz = (S.nez || 0) / 1000, g = L / n, mat = new THREE.MeshLambertMaterial({ color: (STAIR_MAT[S.mat] || STAIR_MAT.beton)[1] }), zb = Zm(Math.min(S.z0, S.z1) - 150);
            for (let i = 0; i < n; i++) { const top = Zm(S.z0 + (S.z1 - S.z0) * (i + 1) / n), H = Math.max(0.02, top - zb), s0 = i * g - (i ? nz : 0), s1 = (i + 1) * g, len = s1 - s0, mid = (s0 + s1) / 2;
                const m = new THREE.Mesh(new THREE.BoxGeometry(len, W, H), mat); m.position.set(A.x + ux * mid, A.y + uy * mid, zb + H / 2); m.rotation.z = ang; m.userData.shape = s; root.add(m); } }); }
        // ---- CHAUSSÉES : les deux bords d'un tronçon importé forment la chaussée (enrobé en plan et en 3D)
        let roadCache = { ep: -1, L: [] };
        function roadPolys() { if (roadCache.ep === renderEpoch) return roadCache.L; const E = shapes.filter(s => s.road && s.type === 'poly' && s.open && s.points.length > 1), by = new Map(), L = [];
            E.forEach((s, i) => { const k = s.road.rid || (s.rtOf + '#' + Math.floor(E.filter(x => x.rtOf === s.rtOf).indexOf(s) / 2)); if (!by.has(k)) by.set(k, []); by.get(k).push(s); });
            by.forEach(pair => { if (pair.length !== 2) return; const [a, b] = pair, P = a.points.concat(b.points.slice().reverse()); if (P.length < 3) return;
                const wW = mmToWorld(Math.max(3, +(a.road.w || 5)) * 3000), near = (q, R) => R.points.some(r => Math.hypot(r.x - q.x, r.y - q.y) < wW); if (!near(a.points[0], b) || !near(a.points[a.points.length - 1], b)) return;   /* anciens imports : deux bords bien voisins seulement */ const xs = P.map(q => q.x), ys = P.map(q => q.y);
                const A = a.points, B = b.points, na = A.length, nb = B.length, jb = (k) => Math.round(k * (nb - 1) / Math.max(1, na - 1)), Q = []; for (let k = 0; k + 1 < na; k++) Q.push([A[k], A[k + 1], B[jb(k + 1)], B[jb(k)]]);   // la chaussée en petits quadrilatères (découpe locale rapide)
                L.push({ first: a, P, Q, bb: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } }); });
            roadCache = { ep: renderEpoch, L }; return L; }
        // grille des bords de chaussée (cases de 10 m) : savoir vite si un triangle du terrain touche une route, et le découper au bord exact
        let roadIdxC = { ep: -1 };
        function roadIdx() { const L = roadPolys(); if (roadIdxC.ep === renderEpoch && roadIdxC.L === L) return roadIdxC; const C = mmToWorld(10000), G = new Map(), key = (i, j) => i * 1000003 + j;
            L.forEach((r, ri) => { const P = r.P; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], i0 = Math.floor(Math.min(a.x, b.x) / C), i1 = Math.floor(Math.max(a.x, b.x) / C), j0 = Math.floor(Math.min(a.y, b.y) / C), j1 = Math.floor(Math.max(a.y, b.y) / C);
                for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) { const k = key(x, y); let c = G.get(k); if (!c) G.set(k, c = []); c.push([a, b, ri]); } } });
            const QG = new Map(); L.forEach(r => (r.Q || []).forEach(q => { const xs = q.map(v => v.x), ys = q.map(v => v.y); for (let x = Math.floor(Math.min(...xs) / C); x <= Math.floor(Math.max(...xs) / C); x++) for (let y = Math.floor(Math.min(...ys) / C); y <= Math.floor(Math.max(...ys) / C); y++) { const k = key(x, y); let c = QG.get(k); if (!c) QG.set(k, c = []); c.push(q); } }));
            return (roadIdxC = { ep: renderEpoch, L, G, QG, C, key }); }
        const segCross = (p, q, r, s2) => { const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), d1 = d(r, s2, p), d2 = d(r, s2, q), d3 = d(p, q, r), d4 = d(p, q, s2); return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)); };
        // triangle du terrain [x, y, z]×3 coupé par les chaussées : { road: [triangles], rest: [triangles] }, ou null s'il ne touche aucune route ;
        //      les morceaux restent sur le plan du triangle (pas de marche), la chaussée suit son bord exact (plus de pointes d'enrobé dans les champs)
        function roadClipTri(T) { const I = roadIdx(); if (!I.L.length) return null; const xs = T.map(v => v[0]), ys = T.map(v => v[1]), i0 = Math.floor(Math.min(...xs) / I.C), i1 = Math.floor(Math.max(...xs) / I.C), j0 = Math.floor(Math.min(...ys) / I.C), j1 = Math.floor(Math.max(...ys) / I.C);
            const V = T.map(v => ({ x: v[0], y: v[1] })), polys = new Set(), near = new Set(); let cross = false;
            for (let x = i0 - 1; x <= i1 + 1; x++) for (let y = j0 - 1; y <= j1 + 1; y++) for (const [a, b, ri] of I.G.get(I.key(x, y)) || []) { near.add(ri); if (x < i0 || x > i1 || y < j0 || y > j1) continue; if (segCross(a, b, V[0], V[1]) || segCross(a, b, V[1], V[2]) || segCross(a, b, V[2], V[0]) || pointInPolygon(a.x, a.y, V)) { cross = true; polys.add(ri); } }
            if (!near.size) return null;   // aucun bord de chaussée à moins d'une case : ni dedans ni coupé
            const inside = V.map(v => roadAt(v.x, v.y));
            if (!cross) { if (inside.every(Boolean)) return { road: [T], rest: [] }; if (!inside.some(Boolean)) return null; }
            const A = T[0], B = T[1], Cc = T[2], det = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]) || 1e-12, zAt = (x, y) => { const u = ((B[1] - Cc[1]) * (x - Cc[0]) + (Cc[0] - B[0]) * (y - Cc[1])) / det, v = ((Cc[1] - A[1]) * (x - Cc[0]) + (A[0] - Cc[0]) * (y - Cc[1])) / det; return A[2] * u + B[2] * v + Cc[2] * (1 - u - v); };
            const tris = (MP) => { const out = []; MP.forEach(poly => { const c = poly[0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)), h = poly.slice(1).map(hr => hr.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))); if (c.length < 3) return; const all = c.concat(...h);
                THREE.ShapeUtils.triangulateShape(c, h).forEach(f => { const t = f.map(i => [all[i].x, all[i].y, zAt(all[i].x, all[i].y)]); const ar = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]), ar0 = (B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1]); if (Math.abs(ar) < Math.pow(mmToWorld(20), 2)) return; out.push(ar * ar0 < 0 ? [t[0], t[2], t[1]] : t); }); }); return out; };
            // découpe rapide : chaque quadrilatère de chaussée en deux triangles (convexes) ; route = triangle ∩ chaque morceau ; reste = triangle moins chacun, morceau par morceau
            const QL = (() => { const QS = new Set(); for (let x = i0 - 1; x <= i1 + 1; x++) for (let y = j0 - 1; y <= j1 + 1; y++) (I.QG.get(I.key(x, y)) || []).forEach(q => QS.add(q)); return [...QS]; })();
            if (QL.length) { const sa = (P) => { let a2 = 0; for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; a2 += p[0] * q[1] - q[0] * p[1]; } return a2 / 2; }, ccw = (P) => sa(P) < 0 ? P.slice().reverse() : P;
                const half = (P, a, b, keepLeft) => { const out = [], side = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (keepLeft ? 1 : -1);
                    for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length], sp = side(p), sq = side(q); if (sp >= 0) out.push(p); if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } } return out; };
                const inter = (P, Q) => { let r = P; for (let k = 0; k < Q.length && r.length >= 3; k++) r = half(r, Q[k], Q[(k + 1) % Q.length], true); return r; };
                const diff = (P, Q) => { const out = []; let r = P; for (let k = 0; k < Q.length && r.length >= 3; k++) { const a2 = Q[k], b2 = Q[(k + 1) % Q.length], o = half(r, a2, b2, false); if (o.length >= 3 && Math.abs(sa(o)) > 1e-9) out.push(o); r = half(r, a2, b2, true); } return out; };
                const tx0 = Math.min(...xs), tx1 = Math.max(...xs), ty0 = Math.min(...ys), ty1 = Math.max(...ys), RT = []; QL.forEach(q => { if (q.every(v => v.x < tx0) || q.every(v => v.x > tx1) || q.every(v => v.y < ty0) || q.every(v => v.y > ty1)) return; const p4 = q.map(v => [v.x, v.y]); [[p4[0], p4[1], p4[2]], [p4[0], p4[2], p4[3]]].forEach(t => { if (Math.abs(sa(t)) > 1e-12) RT.push(ccw(t)); }); });
                const T0 = ccw(T.map(v => [v[0], v[1]])), road = [], eps = Math.pow(mmToWorld(20), 2); let rest = [T0];
                RT.forEach(t => { const r = inter(T0, t); if (r.length >= 3 && Math.abs(sa(r)) > eps) road.push(r); rest = rest.flatMap(P => diff(P, t)); });
                const fan = (Ps) => { const out = [], ar0 = (B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1]); Ps.forEach(P => { for (let k = 1; k + 1 < P.length; k++) { const t = [P[0], P[k], P[k + 1]].map(v => [v[0], v[1], zAt(v[0], v[1])]), ar = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]); if (Math.abs(ar) < eps) continue; out.push(ar * ar0 < 0 ? [t[0], t[2], t[1]] : t); } }); return out; };
                return { road: fan(road), rest: fan(rest.filter(P => Math.abs(sa(P)) > eps)) }; }
            if (!window.polygonClipping) return null; near.forEach(ri => { if (V.some(v => pointInPolygon(v.x, v.y, I.L[ri].P))) polys.add(ri); });
            const ring = (P) => P.map(q => [q.x, q.y]).concat([[P[0].x, P[0].y]]), tri = [ring(V)], R = QL.length ? QL.map(q => [ring(q)]) : [...polys].map(ri => [ring(I.L[ri].P)]);   // les quadrilatères de chaussée voisins, pas toute la route
            try { const U = R.length > 1 ? polygonClipping.union(...R) : R[0]; return { road: tris(polygonClipping.intersection(tri, U)), rest: tris(polygonClipping.difference(tri, U)) }; } catch (e) { return null; } }
        const roadAt = (x, y) => { const I = roadIdx(); if (!I.L.length) return false; const Q = I.QG.get(I.key(Math.floor(x / I.C), Math.floor(y / I.C)));   // grille des quadrilatères de chaussée : réponse immédiate
            if (Q && Q.some(q => pointInPolygon(x, y, q))) return true; return I.L.some(r => !(r.Q && r.Q.length) && x >= r.bb.x0 && x <= r.bb.x1 && y >= r.bb.y0 && y <= r.bb.y1 && pointInPolygon(x, y, r.P)); };
        let roadPat = null;
        function drawRoad2D(c, s, dx, dy) { const r = roadPolys().find(r => r.first === s); if (!r) return; c.save(); c.globalAlpha = 0.8;
            try { if (!roadPat || roadPat.c !== c) { const cv = texCanvas('enrobe'); roadPat = cv ? { c, p: c.createPattern(cv, 'repeat') } : null; } } catch (e) { roadPat = null; }
            if (roadPat && roadPat.p && roadPat.p.setTransform) { const k = mmToWorld(2000) / 256; roadPat.p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); c.fillStyle = roadPat.p; } else c.fillStyle = '#3f4248'; c.beginPath(); r.P.forEach((q, k) => k ? c.lineTo(q.x + dx, q.y + dy) : c.moveTo(q.x + dx, q.y + dy)); c.closePath(); c.fill(); c.restore(); }
        // ---- BASSIN DE RÉTENTION ENTERRÉ : une emprise fermée ; type (structure alvéolaire, cuve béton, buses, grave drainante), hauteur, couverture,
        //      lit de pose, surlargeur et talus de fouille. Calcule le volume utile, les altitudes, la fouille (déblai), le lit, le remblai (côtés + couverture) ;
        //      ces quantités vont dans les notes de cubature et financière, et le volume utile dans la note pluviométrique.
        const BASSIN_T = { alv: { nm: 'Structure alvéolaire', vide: 0.95, H: 1000, lit: 100, litMat: 'SABLE', col: 0x38bdf8 }, beton: { nm: 'Cuve béton', vide: 1, H: 1500, lit: 100, litMat: 'BETON_DE_PROPRETE', col: 0xa8a29e },
            buse: { nm: 'Buses de stockage', vide: 1, H: 1000, lit: 150, litMat: 'SABLE', col: 0x94a3b8 }, grave: { nm: 'Grave drainante', vide: 0.3, H: 800, lit: 0, litMat: 'SABLE', col: 0x8b7d6b } };
        const BASSIN_LIT = [['SABLE', 'Sable'], ['GNT_0_315', 'GNT 0/31,5'], ['BETON_DE_PROPRETE', 'Béton de propreté']];
        let bassinDraw = false;
        function bassinDef(t) { const T = BASSIN_T[t] || BASSIN_T.alv; return { t, H: T.H, vide: T.vide, cover: 800, lit: T.lit, litMat: T.litMat, sur: 500, tal: '1/1', D: 1000, e: 200, etanche: false }; }
        const bassinTalK = (v) => v === '0' ? 0 : v === '3/2' ? 1.5 : v === '2/1' ? 2 : 1;
        // calcul complet d'un bassin (m, m², m³ ; altitudes en mm)
        function bassinCalc(s) { const B = s.bassin; if (!B || s.type !== 'poly' || s.points.length < 3) return null; const M = mOf(1), pts = s.points;
            const A = Math.abs(polyArea(pts)) * M * M; let P = 0, Lmax = 0; for (let i = 0; i < pts.length; i++) { const l = Math.hypot(pts[(i + 1) % pts.length].x - pts[i].x, pts[(i + 1) % pts.length].y - pts[i].y) * M; P += l; Lmax = Math.max(Lmax, l); }
            const c = polyCentroid(pts), zs = pts.concat([c]).map(q => groundZAt(q.x, q.y, false)).filter(hasZ), zg = zs.length ? zs.reduce((a, v) => a + v, 0) / zs.length : 0;
            const H = Math.max(0.1, B.H / 1000), cov = Math.max(0, B.cover / 1000), lit = Math.max(0, B.lit / 1000), sur = Math.max(0, B.sur / 1000), k = bassinTalK(B.tal), e = Math.max(0.1, (B.e || 200) / 1000);
            let Ho, Vut, Vouv, extra = {};
            if (B.t === 'beton') { Ho = H + 2 * e; const Ai = Math.max(0, A - P * e + 4 * e * e); Vut = Ai * H; Vouv = A * Ho; extra.beton = A * Ho - Ai * H; }
            else if (B.t === 'buse') { const D = Math.max(0.3, (B.D || 1000) / 1000), gap = 0.3, W = Lmax > 0 ? A / Lmax : 0, n = Math.max(1, Math.floor((W - gap) / (D + gap) + 1e-9)); Ho = D * 1.12 + 0.1; Vut = n * Math.PI * D * D / 4 * Lmax; Vouv = A * Ho; extra.n = n; extra.L = Lmax; extra.ml = n * Lmax; extra.D = D; extra.enrob = Math.max(0, A * Ho - n * Math.PI * (D * 1.12) ** 2 / 4 * Lmax); }
            else { Ho = H; Vut = A * H * Math.min(1, Math.max(0.05, B.vide || BASSIN_T[B.t].vide)); Vouv = A * H; if (B.t === 'alv') extra.alv = A * H; else extra.grave = A * H; extra.geo = 2 * A + P * H; }
            const zTop = zg - cov * 1000, zFond = zTop - (B.t === 'beton' ? e : 0) * 1000 - (B.t === 'beton' ? H : B.t === 'buse' ? Ho - 0.1 : H) * 1000, zFouille = zTop - (Ho + lit) * 1000;
            const Df = Math.max(0, (zg - zFouille) / 1000), Aof = (d) => A + P * d + Math.PI * d * d, Ab = Aof(sur), At = Aof(sur + k * Df), Am = Aof(sur + k * Df / 2);
            const Vf = Df / 6 * (Ab + 4 * Am + At), Vlit = Ab * lit, Vcov = A * cov, Vrem = Math.max(0, Vf - Vouv - Vlit);
            return { A, P, Lmax, zg, zTop, zFond, zFouille, Df, Ho, Vut, Vouv, Vf, Vlit, Vrem, Vcov, Ab, At, sur, topOff: sur + k * Df, ...extra }; }
        function bassinList() { return shapes.filter(s => s.bassin && s.type === 'poly' && !s.open && s.points.length >= 3); }
        // lignes de quantités (catalogue des matériaux : prix éventuels)
        function bassinRows() { const rows = [], add = (code, q, label) => { const m = structMat(code), r = Object.assign({ name: label || m.name, code, v: 0, vf: 0, t: 0, A: 0 }, q); if (!r.vf) r.vf = m.surf ? r.A * (m.coef || 1) : r.v * (m.coef || 1); if (!r.t && m.d) r.t = r.v * m.d; rows.push(Object.assign(r, matCost(m, r), { prix: +m.prix || 0, surf: !!m.surf })); };
            bassinList().forEach(s => { const C = bassinCalc(s); if (!C) return; const nm = s.name || 'Bassin', B = s.bassin;
                add('__DEB', { v: C.Vf, terr: true }, 'Bassin — fouille (déblai) : ' + nm);
                if (C.Vlit > 0) add(B.litMat || 'SABLE', { v: C.Vlit }, 'Bassin — lit de pose : ' + nm);
                if (C.alv) { add('SAUL', { v: C.alv }, 'Bassin — structure alvéolaire : ' + nm); add('GEOTEXTILE', { A: C.geo }, 'Bassin — géotextile : ' + nm); if (B.etanche) add('GEOMEMBRANE', { A: C.geo }, 'Bassin — géomembrane : ' + nm); }
                if (C.grave) { add('EMPIERREMENT_40_70', { v: C.grave }, 'Bassin — grave drainante : ' + nm); add('GEOTEXTILE', { A: C.geo }, 'Bassin — géotextile : ' + nm); if (B.etanche) add('GEOMEMBRANE', { A: C.geo }, 'Bassin — géomembrane : ' + nm); }
                if (C.beton) add('BETON', { v: C.beton }, 'Bassin — béton de la cuve : ' + nm);
                if (C.ml) { rows.push({ name: 'Bassin — buses Ø' + nfr(C.D * 1000, 0) + ' (' + C.n + ' file' + (C.n > 1 ? 's' : '') + ') : ' + nm, code: 'BUSE', pu: 'ml', ml: C.ml, qp: C.ml, v: 0, vf: 0, t: 0, A: 0, cout: 0, prix: 0 }); add('SABLE', { v: C.enrob }, 'Bassin — enrobage des buses : ' + nm); }
                add('__REM', { v: C.Vrem, terr: true }, 'Bassin — remblai (côtés et couverture) : ' + nm); });
            return rows; }
        // ---- outil
        function startBassin() { const pp = selectedShapes.find(x => x.pay); if (pp) { payPanel(pp); return; } const sel = selectedShapes.find(x => x.type === 'poly' && !x.open && x.points.length >= 3 && !x.bassin && !isPlateforme(x));
            if (sel) { bassinMake(sel); return; } const b0 = selectedShapes.find(x => x.bassin); if (b0) { bassinPanel(b0); return; }
            setMode('poly'); bassinDraw = true; const b = document.getElementById('btn-bassin'); if (b) b.classList.add('active');
            updateCommandMessageText('BASSIN DE RÉTENTION : cliquez l\'emprise du bassin (rectangle ou contour), recliquez le 1er point ou double-clic pour fermer.'); }
        function bassinMake(s) { const n = bassinList().length + 1; s.bassin = bassinDef('alv'); s.layerId = ensureLayer('Bassins de rétention', '#38bdf8'); s.zk = 1; if (!s.name || /^Polyligne/i.test(s.name)) s.name = 'Bassin ' + n; s.hatch = false;
            selectedShapes = [s]; updateLayerUI(); invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } bassinPanel(s); }
        // ---- BASSIN PAYSAGÉ : une plateforme en déblai (le fond), ses berges en talus, remplie d'eau jusqu'au niveau permanent.
        //      Volume nominal : jusqu'au bord (terrain) ; volume utile : du niveau permanent à la surverse. En 3D : l'eau, et au rendu rochers et roseaux sur les berges.
        let PAY_ID = 0;
        function payMake(s) { const zs = s.points.concat([polyCentroid(s.points)]).map(q => groundZAt(q.x, q.y, false)).filter(hasZ), zg = zs.length ? zs.reduce((a, v) => a + v, 0) / zs.length : 100000;
            delete s.bassin; s.pay = { id: 'pay' + Date.now().toString(36) + (PAY_ID++), zg: Math.round(zg), prof: 1500, tal: '3/2', perm: 500, rev: 300 }; s.zk = 1; s.hatch = false; s.layerId = ensureLayer('Bassins de rétention', '#38bdf8');
            payApplyGeom(s); selectedShapes = [s]; updateLayerUI(); invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } payPanel(s); }
        // fond = plateforme à la cote zg − profondeur ; berges = talus de déblai à la pente choisie (et de remblai, si le bord passe sous le terrain)
        function payApplyGeom(s) { const B = s.pay, zf = Math.round(B.zg - B.prof); s.points.forEach(q => { q.z = zf; }); s.talus = Object.assign({}, s.talus || {}, { on: true, kD: B.tal, kR: B.tal, pts: false }); }
        function payCalc(s) { const B = s.pay; if (!B) return null; const M = mOf(1), pts = s.points, A = Math.abs(polyArea(pts)) * M * M; let P = 0; for (let i = 0; i < pts.length; i++) P += Math.hypot(pts[(i + 1) % pts.length].x - pts[i].x, pts[(i + 1) % pts.length].y - pts[i].y) * M;
            const k = talusK(B.tal), V = (h) => h <= 0 ? 0 : A * h + P * k * h * h / 2 + Math.PI * k * k * h * h * h / 3, Ah = (h) => A + P * k * h + Math.PI * k * k * h * h;
            const H = B.prof / 1000, hp = Math.min(H, B.perm / 1000), hs = Math.max(hp, H - B.rev / 1000), zf = B.zg - B.prof;
            return { A, P, k, H, hp, hs, zf, zPerm: zf + hp * 1000, zSurv: zf + hs * 1000, Vnom: V(H), Vut: V(hs) - V(hp), Vperm: V(hp), Atop: Ah(H), Aeau: Ah(hp) }; }
        // l'eau du bassin : un niveau d'eau lié (contour = tête des berges), refait quand le bassin change
        function paySync() { const P = shapes.filter(s => s.pay && s.type === 'poly' && !s.open && s.points.length >= 3), ids = new Set(P.map(s => s.pay.id));
            if (shapes.some(w => w.payOf && !ids.has(w.payOf))) shapes = shapes.filter(w => !(w.payOf && !ids.has(w.payOf)));
            P.forEach(s => { const C = payCalc(s); if (!C) return; let w = shapes.find(x => x.payOf === s.pay.id); const pts = polyOffsetPts(s.points, mmToWorld(C.k * (C.H + 0.5) * 1000), true).map(q => ({ x: q.x, y: q.y }));
                if (!w) { w = { type: 'poly', layerId: s.layerId, open: false, payOf: s.pay.id, zk: 1, hatch: false, water: { z: 0, name: '' }, points: pts }; const i = shapes.indexOf(s); shapes.splice(i + 1, 0, w); }
                w.points = pts; w.water.z = Math.round(C.zPerm); w.water.name = (s.name || 'Bassin') + ' — eau'; w.name = w.water.name; w.layerId = s.layerId; }); }
        let payCur = null;
        function payPanel(s) { s = s || payCur; if (!s || !s.pay) return; payCur = s; bassinCur = null; const B = s.pay, C = payCalc(s), inp = (id, v) => `<input id="${id}" type="text" value="${v}" style="width:70px;background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px 6px;text-align:right">`;
            const row = (l, x) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>${l}</span><span>${x}</span></div>`, L = (l, v, c) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#9ca3af">${l}</span><b style="color:${c || '#e5e7eb'}">${v}</b></div>`;
            const need = pluvioNote && pluvioNote.S ? pluvioCalc(pluvioCfg()).Vs : null, z = (v) => nfr(v / 1000, 2);
            t2Panel('🌿 ' + MF.esc(s.name || 'Bassin paysagé'), `<div class="mf-hint" style="margin:0 0 6px">Bassin paysagé : une plateforme en déblai (le fond), des berges en talus, de l'eau jusqu'au niveau permanent. Le contour est le fond du bassin.</div><div id="py-svg">${paySVG(s, C)}</div>`
                + row('Cote du bord (terrain)', inp('py-zg', z(B.zg)) + ' m') + row('Profondeur', inp('py-prof', nfr(B.prof / 1000, 2)) + ' m')
                + '<div>Pente des berges</div>' + vSeg([['1/1', '1/1'], ['3/2', '3/2'], ['2/1', '2/1'], ['3/1', '3/1']], B.tal, "paySet('tal','$')")
                + row('Hauteur d\'eau permanente', inp('py-perm', nfr(B.perm / 1000, 2)) + ' m') + row('Revanche (surverse → bord)', inp('py-rev', nfr(B.rev / 1000, 2)) + ' m')
                + `<div style="border-top:1px solid #374151;padding-top:8px;display:grid;gap:3px">${L('Volume nominal (jusqu\'au bord)', nfr(C.Vnom, 1) + ' m³', '#e5e7eb')}${L('Volume utile (permanent → surverse)', nfr(C.Vut, 1) + ' m³', '#38bdf8')}${need !== null ? L('Volume à stocker (note pluvio)', nfr(need, 1) + ' m³', C.Vut >= need - 0.05 ? '#4ade80' : '#f87171') : ''}
                ${L('Eau permanente', nfr(C.Vperm, 1) + ' m³')}${L('Fond / permanent / surverse / bord', z(C.zf) + ' / ' + z(C.zPerm) + ' / ' + z(C.zSurv) + ' / ' + z(B.zg))}${L('Surface en eau / au bord', nfr(C.Aeau, 0) + ' / ' + nfr(C.Atop, 0) + ' m²')}</div>
                <div class="mf-hint">Le déblai et les berges comptent dans la cubature, comme toute plateforme. Au rendu, rochers et roseaux habillent les berges (Studio › Eau et rives).</div>`,
                [['Fermer', "t2PanelClose();setMode('select-box');draw()", true]], "t2PanelClose();setMode('select-box');draw()");
            const p = document.getElementById('t2-panel'); p.onchange = (e) => { const t = e.target, v = t2Num(t.value), map = { 'py-zg': 'zg', 'py-prof': 'prof', 'py-perm': 'perm', 'py-rev': 'rev' }; if (!map[t.id] || !isFinite(v) || (t.id !== 'py-zg' && v < 0)) return; B[map[t.id]] = Math.round(v * 1000); payApply(); }; }
        function paySet(k, v) { const s = payCur; if (!s) return; s.pay[k] = v; payApply(); }
        function payApply() { const s = payCur; if (!s) return; payApplyGeom(s); invalidateCache(); saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } payPanel(s); }
        function payLabel2D(s, col, dx, dy) { const C = payCalc(s); if (!C) return; const p = polyCentroid(s.points); dimensionTextsToDraw.push({ text: (s.name || 'Bassin') + ' — ' + nfr(C.Vut, 1) + ' m³ utiles / ' + nfr(C.Vnom, 1) + ' m³', worldX: p.x + dx, worldY: p.y + dy, color: col, layerId: s.layerId }); }
        // coupe du bassin paysagé : berges, fond, niveaux (permanent, surverse, bord)
        function paySVG(s, C) { const W = Math.max(1, C.A / Math.max(1e-6, C.P / 2)), half = W / 2 + C.k * C.H, VW = 360, VH = 150, pl = 12, pr = 96, sx = (VW - pl - pr) / (2 * half + 1), sz = Math.min(110 / Math.max(0.3, C.H + 0.4), sx * 6), X = (x) => pl + (x + half + 0.5) * sx, Y = (h) => 18 + (C.H + 0.2 - h) * sz, f = (v) => v.toFixed(1);
            const bank = (h) => W / 2 + C.k * h, poly = (h) => [[-bank(h), h], [-W / 2, 0], [W / 2, 0], [bank(h), h]].map(([x, z]) => f(X(x)) + ',' + f(Y(z))).join(' ');
            let g = `<svg viewBox="0 0 ${VW} ${VH}" width="100%" style="display:block;background:#0b1220;border:1px solid #374151;border-radius:8px;margin-bottom:6px" font-family="system-ui,sans-serif" font-size="10">`;
            g += `<polygon points="${f(X(-half - 0.5))},${f(Y(C.H))} ${poly(C.H)} ${f(X(half + 0.5))},${f(Y(C.H))} ${f(X(half + 0.5))},${VH} ${f(X(-half - 0.5))},${VH}" fill="#3f3a2e"/>`;
            g += `<polygon points="${poly(C.hs)}" fill="#38bdf8" opacity="0.25"/><polygon points="${poly(C.hp)}" fill="#2563eb" opacity="0.75"/>`;
            g += `<polyline points="${f(X(-half - 0.5))},${f(Y(C.H))} ${poly(C.H)} ${f(X(half + 0.5))},${f(Y(C.H))}" fill="none" stroke="#4ade80" stroke-width="2"/>`;
            const lab = (h, t, c, dy) => `<line x1="${f(X(bank(h)))}" x2="${f(X(half + 0.5) + 4)}" y1="${f(Y(h))}" y2="${f(Y(h) + (dy || 0))}" stroke="${c}" stroke-dasharray="3 2"/><text x="${f(X(half + 0.5) + 7)}" y="${f(Y(h) + (dy || 0) + 3.5)}" fill="${c}">${t}</text>`;
            g += lab(C.H, 'bord ' + nfr(C.zf / 1000 + C.H, 2), '#4ade80', -4) + lab(C.hs, 'surverse ' + nfr(C.zSurv / 1000, 2), '#7dd3fc', Math.abs(C.H - C.hs) * sz < 11 ? 7 : 0) + lab(C.hp, 'permanent ' + nfr(C.zPerm / 1000, 2), '#60a5fa') + lab(0, 'fond ' + nfr(C.zf / 1000, 2), '#fca5a5');
            return g + '</svg>'; }
        function bassinCreate(P) { if (!P || P.length < 3) { updateCommandMessageText('BASSIN : il faut au moins 3 points.'); return; } const s = { type: 'poly', layerId: 'layer-0', points: P.map(q => ({ x: q.x, y: q.y })) }; shapes.push(s); bassinMake(s); }
        let bassinCur = null;
        function bassinPanel(s) { s = s || bassinCur; if (!s || !s.bassin) return; bassinCur = s; const B = s.bassin, inp = (id, v, w) => `<input id="${id}" type="text" value="${v}" style="width:${w || 70}px;background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px 6px;text-align:right">`;
            const seg = (k, opts, cur) => vSeg(opts, cur, `bassinSet('${k}','$')`);
            const row = (l, x) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>${l}</span><span>${x}</span></div>`;
            t2Panel('🛢 ' + MF.esc(s.name || 'Bassin de rétention'), seg('t', [['alv', 'Alvéolaire'], ['beton', 'Béton'], ['buse', 'Buses'], ['grave', 'Grave'], ['pay', 'Paysagé']], B.t) + '<div id="bs-svg"></div>'
                + (B.t === 'buse' ? row('Diamètre des buses', inp('bs-D', nfr(B.D, 0)) + ' mm') : row(B.t === 'beton' ? 'Hauteur d\'eau utile' : 'Hauteur du stockage', inp('bs-H', nfr(B.H / 1000, 2)) + ' m'))
                + (B.t === 'alv' || B.t === 'grave' ? row('Vide utile', inp('bs-vide', nfr(B.vide * 100, 0)) + ' %') : '') + (B.t === 'beton' ? row('Épaisseur béton (radier, voiles, dalle)', inp('bs-e', nfr(B.e / 10, 0)) + ' cm') : '')
                + row('Couverture (remblai au-dessus)', inp('bs-cover', nfr(B.cover / 1000, 2)) + ' m')
                + row('Lit de pose', inp('bs-lit', nfr(B.lit / 10, 0)) + ' cm <select id="bs-litmat" style="background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px">' + BASSIN_LIT.map(([c, l]) => `<option value="${c}" ${B.litMat === c ? 'selected' : ''}>${l}</option>`).join('') + '</select>')
                + row('Surlargeur de fouille', inp('bs-sur', nfr(B.sur / 10, 0)) + ' cm')
                + '<div>Talus de fouille</div>' + seg('tal', [['0', 'Vertical (blindé)'], ['1/1', '1/1'], ['3/2', '3/2']], B.tal)
                + (B.t === 'alv' || B.t === 'grave' ? t2Chk('bs-et', !!B.etanche, 'Étanche (géomembrane autour)', "bassinSet('etanche', this.checked)") : '')
                + '<div id="bs-res" style="border-top:1px solid #374151;padding-top:8px;display:grid;gap:3px"></div>', [['Fermer', "t2PanelClose();setMode('select-box');draw()", true]], "t2PanelClose();setMode('select-box');draw()");
            const p = document.getElementById('t2-panel'); p.oninput = p.onchange = (e) => { const t = e.target, v = t2Num(t.value); const map = { 'bs-H': ['H', 1000], 'bs-D': ['D', 1], 'bs-vide': ['vide', 0.01], 'bs-e': ['e', 10], 'bs-cover': ['cover', 1000], 'bs-lit': ['lit', 10], 'bs-sur': ['sur', 10] };
                if (t.id === 'bs-litmat') { B.litMat = t.value; } else if (map[t.id]) { if (!isFinite(v) || v < 0) return; B[map[t.id][0]] = v * map[t.id][1]; } else return; bassinApply(true); };
            bassinRes(); }
        function bassinSet(k, v) { const s = bassinCur; if (!s) return; const B = s.bassin; if (k === 't' && v === 'pay') { payMake(s); return; } if (k === 't') { const keep = { cover: B.cover, sur: B.sur, tal: B.tal }; s.bassin = Object.assign(bassinDef(v), keep); } else if (k === 'etanche') B.etanche = !!v; else B[k] = v; bassinApply(); bassinPanel(s); }
        function bassinApply(soft) { saveState(); draw(); if (is3DOpen()) { build3DScene(); render3D(); } if (soft) bassinRes(); }
        function bassinRes() { const s = bassinCur, el = document.getElementById('bs-res'); if (!s || !el) return; const C = bassinCalc(s); if (!C) return; const z = (v) => nfr(v / 1000, 2), L = (l, v, c) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#9ca3af">${l}</span><b style="color:${c || '#e5e7eb'}">${v}</b></div>`;
            const need = pluvioNote && pluvioNote.S ? pluvioCalc(pluvioCfg()).Vs : null; const sv = document.getElementById('bs-svg'); if (sv) sv.innerHTML = bassinSVG(s, C);
            // résultats en deux blocs (stockage, terrassement) ; alerte quand le volume utile ne couvre pas le volume à stocker de la note pluvio
            const blk = (t, ic, body) => `<div style="display:grid;gap:3px"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;margin-bottom:2px">${ic} ${t}</div>${body}</div>`, B = s.bassin;
            let warn = ''; if (need !== null && C.Vut < need - 0.05) { const miss = need - C.Vut, Hn = (B.H / 1000) * need / Math.max(C.Vut, 1e-6);
                warn = `<div style="padding:8px 10px;border:1px solid #f87171;border-radius:8px;background:rgba(248,113,113,.12);color:#fecaca;font-size:12.5px"><b style="color:#fca5a5">Volume insuffisant</b> : il manque ${nfr(miss, 1)} m³ sur ${nfr(need, 1)} m³. ${B.t === 'buse' ? 'Ajoutez des buses ou agrandissez l\'emprise.' : `Il faudrait une hauteur de ${B.t === 'beton' ? 'stockage' : 'stockage'} d'environ <b>${nfr(Hn, 2)} m</b> (au lieu de ${nfr(B.H / 1000, 2)} m), ou une emprise plus grande.`}</div>`; }
            el.style.gap = '12px';
            el.innerHTML = warn + blk('Stockage', '💧', L('Volume utile', nfr(C.Vut, 1) + ' m³', '#38bdf8') + (need !== null ? L('Volume à stocker (note pluvio)', nfr(need, 1) + ' m³', C.Vut >= need - 0.05 ? '#4ade80' : '#f87171') : '')
                + (C.n ? L('Buses', C.n + ' × ' + nfr(C.L, 1) + ' m') : '') + L('Emprise', nfr(C.A, 1) + ' m²'))
                + blk('Terrassement', '⛏', L('Sol fini / dessus / fond', z(C.zg) + ' / ' + z(C.zTop) + ' / ' + z(C.zFond))
                + L('Fond de fouille (profondeur)', z(C.zFouille) + ' (' + nfr(C.Df, 2) + ' m)') + L('Déblai (fouille)', nfr(C.Vf, 1) + ' m³', '#fca5a5') + (C.Vlit > 0 ? L('Lit de pose', nfr(C.Vlit, 1) + ' m³') : '')
                + L('Remblai (dont couverture)', nfr(C.Vrem, 1) + ' m³ (' + nfr(C.Vcov, 1) + ')', '#93c5fd') + L('Emprise en tête de fouille', nfr(C.At, 1) + ' m²')); }
        // coupe du bassin dans le volet : terrain, fouille (surlargeur + talus), lit de pose, ouvrage, remblai, couverture ; cotes et altitudes
        function bassinSVG(s, C) { const B = s.bassin, W = Math.max(0.5, C.Lmax ? C.A / C.Lmax : Math.sqrt(C.A)), k = bassinTalK(B.tal), sur = C.sur, Df = C.Df, half = W / 2 + sur + k * Df, z0 = C.zg / 1000, zf = C.zFouille / 1000, zt = C.zTop / 1000;
            const VW = 360, padL = 14, padR = 92, padT = 22, padB = 30, sx = (VW - padL - padR) / (2 * half + 1.2), dep = z0 - zf + 0.6; let sz = sx, ex = 1; const Hmax = 230, Hmin = 120;
            if (dep * sz > Hmax) sz = Hmax / dep; if (dep * sz < Hmin) { ex = Math.min(8, Hmin / (dep * sz)); sz *= ex; }
            const VH = Math.round(padT + dep * sz + padB), X = (x) => padL + (x + half + 0.6) * sx, Y = (z) => padT + (z0 + 0.3 - z) * sz, f = (v) => v.toFixed(1), pts = (a) => a.map(([x, z]) => f(X(x)) + ',' + f(Y(z))).join(' ');
            const wb = W / 2 + sur, wt = half, zl = zf + C.Vlit / Math.max(1e-9, C.Ab), zo0 = zl, zo1 = zt;
            let g = `<svg viewBox="0 0 ${VW} ${VH}" width="100%" style="display:block;background:#0b1220;border:1px solid #374151;border-radius:8px" font-family="system-ui,sans-serif" font-size="10">`
                + `<defs><pattern id="bs-alv" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#0c4a6e"/><path d="M0 0H8V8" fill="none" stroke="#38bdf8" stroke-width="1"/></pattern>`
                + `<pattern id="bs-gr" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#57534e"/><circle cx="2" cy="2" r="1.3" fill="#a8a29e"/><circle cx="5.5" cy="5" r="1" fill="#d6d3d1"/></pattern>`
                + `<pattern id="bs-rem" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#6b4f2f"/><path d="M0 0V6" stroke="#8b6b45" stroke-width="2"/></pattern></defs>`;
            // terrain en place (coupe), fouille remplie de remblai
            g += `<polygon points="${pts([[-half - 0.6, z0], [-wt, z0], [-wb, zf], [wb, zf], [wt, z0], [half + 0.6, z0], [half + 0.6, zf - 0.3], [-half - 0.6, zf - 0.3]])}" fill="#3f3a2e"/>`;
            g += `<polygon points="${pts([[-wt, z0], [-wb, zf], [wb, zf], [wt, z0]])}" fill="url(#bs-rem)" opacity="0.9"/>`;
            if (zl > zf + 1e-4) g += `<rect x="${f(X(-wb))}" y="${f(Y(zl))}" width="${f(2 * wb * sx)}" height="${f((zl - zf) * sz)}" fill="#e7c98b"/>`;
            // ouvrage
            const ox = X(-W / 2), ow = W * sx, oy = Y(zo1), oh = (zo1 - zo0) * sz;
            if (B.t === 'alv') g += `<rect x="${f(ox)}" y="${f(oy)}" width="${f(ow)}" height="${f(oh)}" fill="url(#bs-alv)" stroke="${B.etanche ? '#f472b6' : '#e5e7eb'}" stroke-width="${B.etanche ? 2 : 1}" stroke-dasharray="${B.etanche ? '' : '3 2'}"/>`;
            else if (B.t === 'grave') g += `<rect x="${f(ox)}" y="${f(oy)}" width="${f(ow)}" height="${f(oh)}" fill="url(#bs-gr)" stroke="${B.etanche ? '#f472b6' : '#e5e7eb'}" stroke-width="${B.etanche ? 2 : 1}" stroke-dasharray="${B.etanche ? '' : '3 2'}"/>`;
            else if (B.t === 'beton') { const e = Math.max(0.1, (B.e || 200) / 1000); g += `<rect x="${f(ox)}" y="${f(oy)}" width="${f(ow)}" height="${f(oh)}" fill="#a8a29e"/><rect x="${f(X(-W / 2 + e))}" y="${f(Y(zo1 - e))}" width="${f((W - 2 * e) * sx)}" height="${f((zo1 - zo0 - 2 * e) * sz)}" fill="#1e3a5f"/>`
                + `<rect x="${f(X(-W / 2 + e))}" y="${f(Y(zo0 + e + (zo1 - zo0 - 2 * e) * 0.55))}" width="${f((W - 2 * e) * sx)}" height="${f((zo1 - zo0 - 2 * e) * 0.55 * sz)}" fill="#2b8cf0" opacity="0.55"/>`; }
            else if (B.t === 'buse') { const n = C.n || 1, D = C.D || 1, Do = D * 1.12, gap = (W - n * Do) / (n + 1); g += `<rect x="${f(ox)}" y="${f(oy)}" width="${f(ow)}" height="${f(oh)}" fill="#e7c98b" opacity="0.55"/>`;
                for (let i = 0; i < n; i++) { const cx = -W / 2 + gap * (i + 1) + Do * (i + 0.5), cz = zo0 + 0.05 + Do / 2; g += `<ellipse cx="${f(X(cx))}" cy="${f(Y(cz))}" rx="${f(Do / 2 * sx)}" ry="${f(Do / 2 * sz)}" fill="#94a3b8"/><ellipse cx="${f(X(cx))}" cy="${f(Y(cz))}" rx="${f(D / 2 * sx)}" ry="${f(D / 2 * sz)}" fill="#1e3a5f"/>`; } }
            // terrain fini
            g += `<polyline points="${pts([[-half - 0.6, z0], [half + 0.6, z0]])}" stroke="#4ade80" stroke-width="2" fill="none"/>`;
            // cotes et altitudes (à droite), largeurs (en bas)
            const rx = X(half + 0.6) + 6, lab = (z, t, c) => `<line x1="${f(X(half + 0.6) - 2)}" x2="${f(rx)}" y1="${f(Y(z))}" y2="${f(Y(z))}" stroke="${c}" stroke-width="1"/><text x="${f(rx + 3)}" y="${f(Y(z) + 3.5)}" fill="${c}">${t}</text>`;
            const used = []; [[z0, 'TN fini ' + nfr(z0, 2), '#4ade80'], [zt, 'dessus ' + nfr(zt, 2), '#e5e7eb'], [C.zFond / 1000, 'fond ' + nfr(C.zFond / 1000, 2), '#38bdf8'], [zf, 'fouille ' + nfr(zf, 2), '#fca5a5']].forEach(([z, t, c]) => { let y = Y(z); while (used.some(u => Math.abs(u - y) < 11)) y += 11; used.push(y); g += `<line x1="${f(X(half + 0.6) - 2)}" x2="${f(rx)}" y1="${f(Y(z))}" y2="${f(y)}" stroke="${c}"/><text x="${f(rx + 3)}" y="${f(y + 3.5)}" fill="${c}">${t}</text>`; });
            const vd = (x, za, zb, t) => { if (Math.abs(za - zb) < 1e-3) return ''; const y1 = Y(za), y2 = Y(zb); return `<line x1="${f(x)}" x2="${f(x)}" y1="${f(y1)}" y2="${f(y2)}" stroke="#fbbf24" marker-start="" /><line x1="${f(x - 3)}" x2="${f(x + 3)}" y1="${f(y1)}" y2="${f(y1)}" stroke="#fbbf24"/><line x1="${f(x - 3)}" x2="${f(x + 3)}" y1="${f(y2)}" y2="${f(y2)}" stroke="#fbbf24"/><text x="${f(x + 4)}" y="${f((y1 + y2) / 2 + 3.5)}" fill="#fbbf24">${t}</text>`; };
            g += vd(X(W / 2) - 26, z0, zt, nfr(z0 - zt, 2)) + vd(X(-W / 2) + 5, zt, zo0, nfr(zo1 - zo0, 2));
            const yb = Y(zf) + 14, hd = (xa, xb, t, c) => `<line x1="${f(X(xa))}" x2="${f(X(xb))}" y1="${f(yb)}" y2="${f(yb)}" stroke="${c}"/><line x1="${f(X(xa))}" x2="${f(X(xa))}" y1="${f(yb - 3)}" y2="${f(yb + 3)}" stroke="${c}"/><line x1="${f(X(xb))}" x2="${f(X(xb))}" y1="${f(yb - 3)}" y2="${f(yb + 3)}" stroke="${c}"/><text x="${f((X(xa) + X(xb)) / 2)}" y="${f(yb + 12)}" text-anchor="middle" fill="${c}">${t}</text>`;
            g += hd(-W / 2, W / 2, nfr(W, 2) + ' m', '#e5e7eb') + (sur > 0.01 ? hd(W / 2, wb, nfr(sur, 2), '#9ca3af') : '');
            if (ex > 1.05) g += `<text x="${f(padL)}" y="12" fill="#9ca3af">hauteurs × ${nfr(ex, 1)}</text>`;
            return g + '</svg>'; }
        // en plan : emprise, fond de fouille (surlargeur) et tête de talus en tirets, étiquette du volume
        function drawBassin2D(c, s, col, dx, dy, lineScale) { const C = bassinCalc(s); if (!C) return; const M = mOf(1);
            c.save(); c.setLineDash([6 / lineScale, 4 / lineScale]); c.lineWidth = 1 / lineScale; c.strokeStyle = col;
            [C.sur, C.topOff].forEach((d, i) => { if (!(d > 0.01)) return; const R = polyOffsetPts(s.points, d / M, true); c.globalAlpha = i ? 0.45 : 0.8; c.beginPath(); R.forEach((q, k) => k ? c.lineTo(q.x + dx, q.y + dy) : c.moveTo(q.x + dx, q.y + dy)); c.closePath(); c.stroke(); });
            c.globalAlpha = 0.12; c.fillStyle = '#38bdf8'; c.beginPath(); s.points.forEach((q, k) => k ? c.lineTo(q.x + dx, q.y + dy) : c.moveTo(q.x + dx, q.y + dy)); c.closePath(); c.fill(); c.restore();
            const p = polyCentroid(s.points); dimensionTextsToDraw.push({ text: (s.name || 'Bassin') + ' — ' + nfr(C.Vut, 1) + ' m³ utiles', worldX: p.x + dx, worldY: p.y + dy, color: col, layerId: s.layerId }); }
        // en 3D : le volume de stockage sous le sol (visible en coupe, ou terrain transparent)
        function bassin3D(root, vis, P, Zm) { vis.filter(s => s.bassin && s.type === 'poly' && !s.open).forEach(s => { const C = bassinCalc(s); if (!C) return; const sh = new THREE.Shape();
            s.points.forEach((q, i) => { const a = P(q.x, q.y); i ? sh.lineTo(a.x, a.y) : sh.moveTo(a.x, a.y); }); const z0 = Zm(C.zTop - C.Ho * 1000), z1 = Zm(C.zTop);
            const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, z1 - z0), bevelEnabled: false }); g.translate(0, 0, z0);
            const T = BASSIN_T[s.bassin.t] || BASSIN_T.alv, me = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: T.col, transparent: s.bassin.t === 'alv', opacity: s.bassin.t === 'alv' ? 0.7 : 1 })); me.userData.shape = s; me.userData.bassin = true; root.add(me); }); }
