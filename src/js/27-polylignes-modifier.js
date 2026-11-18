        // =====================================================================
        // POLYLIGNE (ouverte) : même saisie que le polygone, se termine ouverte (Entrée / Échap / double-clic)
        // =====================================================================
        const isPolyMode = () => mode === 'poly' || mode === 'pline';
        // sommets en double (le double-clic de fin pose 1 ou 2 points sur le dernier sommet ; dernier = premier sur un contour fermé) : retirés
        // simplification Douglas-Peucker (tolérance en unités monde)
        function rdpSimplify(pts, tol) {
            if (pts.length < 3) return pts.slice();
            const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
            while (st.length) { const [a, b] = st.pop(), A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1e-12; let im = -1, dm = tol;
                for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / L; if (d > dm) { dm = d; im = i; } }
                if (im >= 0) { keep[im] = 1; st.push([a, im], [im, b]); } }
            return pts.filter((q, i) => keep[i]);
        }
        // anciennes « limites des talus » en escalier (mailles, des milliers de sommets) : allégées
        function lightenTalusLimits(list) { let n = 0; list.forEach(sh => { if (sh.type === 'poly' && sh.points.length > 200 && (sh.gen === 'cubtalus' || /^limite des talus$/i.test(((layers.find(l => l.id === sh.layerId) || {}).name || '').trim()))) { const before = sh.points.length; sh.points = rdpSimplify(sh.points, mmToWorld(80)); if (sh.points.length < before) n++; } }); return n; }
        function cleanPolyPts(pts, closed) {
            const tol = 3 / (camera.zoom || 1), out = [];
            pts.forEach(q => { const l = out[out.length - 1]; if (!l || Math.hypot(q.x - l.x, q.y - l.y) > tol) out.push({ ...q }); });
            if (closed) while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= tol) out.pop();
            return out;
        }
        // ---- LIGNE DE RUPTURE : polyligne 3D (tête, pied de talus, fil d'eau, crête…) que le terrain doit suivre.
        // Z de chaque sommet : celui du point coté sous le sommet ou sur la ligne (à 10 cm près), interpolé le long de la ligne entre eux ; une seule cote → le terrain des points voisins.
        // Un sommet tous les mètres, pour que le maillage du terrain colle à la ligne.
        function brkMake(src) { const P = src.points.map(q => ({ x: q.x, y: q.y })), Q = [];
            tinNodes().forEach(n => { if (hasZ(n.z)) Q.push({ x: n.x, y: n.y, z: n.z }); }); (src.points || []).forEach(q => { if (hasZ(q.z) && src.keepZ) Q.push({ x: q.x, y: q.y, z: q.z }); });
            let tin = null; try { tin = getTIN(); } catch (e) {}
            const B = pdfBreakline(P, Q, mmToWorld(100), tin); if (!B) return { msg: 'LIGNE DE RUPTURE : aucune altitude trouvée — accrochez ses sommets sur des points cotés (ou dessinez-la sur un terrain).' };
            return { s: { type: 'poly', layerId: src.layerId || ensureLayer('Lignes de rupture', '#fb923c'), points: B.pts, open: true, hatch: false, zk: 1, name: src.name || 'Ligne de rupture' },
                msg: 'LIGNE DE RUPTURE : ' + B.pts.length + ' sommets 3D, de ' + fmtZ(Math.min(...B.pts.map(q => q.z))) + ' à ' + fmtZ(Math.max(...B.pts.map(q => q.z))) + ' m (' + (B.n >= 2 ? B.n + ' cotes sur la ligne' : 'terrain des points voisins') + ').' }; }
        function brkFromSel() { const one = selectedShapes[0]; if (!one || one.type !== 'poly') return; const r = brkMake({ points: one.points, layerId: one.layerId, name: one.name, keepZ: true }); if (!r.s) { updateCommandMessageText(r.msg); return; }
            one.points = r.s.points; one.open = true; one.zk = 1; if (!one.name) one.name = 'Ligne de rupture'; invalidateCache(); saveState(); draw(); updateCommandMessageText(r.msg); }
        // ---- BÂTIMENTS EXISTANTS : un contour fermé marqué « bâtiment » (s.batEx). Les cotes relevées dedans (toit, faîtage, égout…) sortent du terrain,
        // le terrain passe dessous à partir des points autour, et le bâtiment devient un bloc 3D posé sur le terrain, jusqu'à la cote la plus haute relevée dedans (modifiable).
        let batDraw = false;
        // une cote est « du bâtiment » si elle est dedans, ou juste autour (débord de toit, égout sur la façade : à moins de 2 m) et nettement plus haute que le sol autour
        function batList() { const out = [], r = mmToWorld(2000); for (const s of shapes) if (s.batEx && s.type === 'poly' && s.points.length > 2) { const z0 = s.points[0].z; if (hasZ(z0)) s.points.forEach(q => { if (q.z !== z0) q.z = z0; }); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; s.points.forEach(q => { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }); out.push({ s, x0, y0, x1, y1, r, gz: hasZ(s.batGz) ? s.batGz : undefined }); } return out; }
        function batEdgeDist(P, x, y) { let m = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, u = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l)) : 0; m = Math.min(m, Math.hypot(a.x + u * dx - x, a.y + u * dy - y)); } return m; }
        function batAt(B, x, y, z) { for (const b of B) { if (x < b.x0 - b.r || x > b.x1 + b.r || y < b.y0 - b.r || y > b.y1 + b.r) continue; if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && pointInPolygon(x, y, b.s.points)) return b.s;
                if (hasZ(z) && hasZ(b.gz) && z > b.gz + 1500 && batEdgeDist(b.s.points, x, y) < b.r) return b.s; } return null; }
        // cotes candidates (points, sommets cotés) : celles du dessin, plus éventuellement une liste fournie (cotes lues dans un PDF)
        function batCotes(extra) { const Q = (extra || []).slice(); for (const s of shapes) { if (s.batEx || s.solid || s.gen || s.sweep || s.trench || s.water || s.wallMat || s.wz || s.brush || s.type === 'pdfvec' || s.type === 'bgimage') continue; shapeVertices(s).forEach(v => { const z = v.get(); if (hasZ(z)) Q.push({ x: v.x, y: v.y, z }); }); } return Q; }
        // (re)calcule le bloc : base = terrain sous le contour (sans les cotes du dedans), haut = cote la plus haute relevée dedans
        function batMake(s, extra, keepTop) {
            s.batEx = 1; s.open = false; s.zk = 1; delete s.plat; delete s.elev; if (!s.name || /^(Polyligne|Polygone)$/.test(s.name)) s.name = 'Bâtiment existant';
            const B = [{ s, x0: Math.min(...s.points.map(q => q.x)), x1: Math.max(...s.points.map(q => q.x)), y0: Math.min(...s.points.map(q => q.y)), y1: Math.max(...s.points.map(q => q.y)) }];
            const r1 = mmToWorld(2000), Q = batCotes(extra), ringAt = (r2) => Q.filter(q => !pointInPolygon(q.x, q.y, s.points) && q.x > B[0].x0 - r2 && q.x < B[0].x1 + r2 && q.y > B[0].y0 - r2 && q.y < B[0].y1 + r2 && batEdgeDist(s.points, q.x, q.y) > r1 && batEdgeDist(s.points, q.x, q.y) < r2).map(q => q.z).sort((a, b) => a - b);
            let ring = ringAt(mmToWorld(10000)); if (ring.length < 3) ring = ringAt(mmToWorld(30000));
            if (ring.length) s.batGz = ring[ring.length >> 1]; else delete s.batGz; B[0].r = r1; B[0].gz = s.batGz;   // sol autour : médiane des cotes entre 2 et 10 m du bâtiment (30 m si trop peu)
            const inQ = Q.filter(q => batAt(B, q.x, q.y, q.z)); let top = keepTop && s.solid && hasZ(s.batTop) ? s.batTop : (inQ.length ? Math.max(...inQ.map(q => q.z)) : undefined);
            delete s.solid; s.solid = { kind: 'box', H: 0 }; tinCache = null; invalidateCache();   // le bâtiment est déjà un volume : le terrain se refait sans lui ni ses cotes
            const tin = getTIN(); let zs = tin ? s.points.map(q => tinZ(q.x, q.y, tin)).filter(hasZ) : [];
            if (!zs.length) { const d = mmToWorld(15000), out = Q.filter(q => !batAt(B, q.x, q.y, q.z) && q.x > B[0].x0 - d && q.x < B[0].x1 + d && q.y > B[0].y0 - d && q.y < B[0].y1 + d); zs = out.map(q => q.z); }
            let base = zs.length ? Math.min(...zs) : (hasZ(top) ? top - 6000 : 0); if (!hasZ(top) || top < base + 500) top = base + (hasZ(top) ? 500 : 6000);
            s.points.forEach(q => { q.z = Math.round(base); }); s.batTop = Math.round(top); s.solid.H = Math.round(top - base); return { base, top, n: inQ.length };
        }
        // outil BAT, premier clic : dans un contour fermé du dessin, il devient le bâtiment ; dans un bâtiment du fond PDF (calques « Bâti »…), son contour est repris ; sinon on trace
        function batPick(x, y, sn) {
            const done = !sn && batAt(batList(), x, y); if (done) { selectedShapes = [done]; updateCommandMessageText('C\'est déjà un bâtiment existant (sélectionné : Y pour le régler). Cliquez dans un autre, ou Échap.'); return true; }
            const c = (batCand && pointInPolygon(x, y, batCand.pts)) ? batCand : batCandAt(x, y); if (!c) return false;
            if (sn && batEdgeDist(c.pts, sn.x, sn.y) < 8 / camera.zoom) return false;   // clic accroché sur le bord : on trace à partir de ce coin
            let sh = c.s; if (!sh) { sh = { type: 'poly', layerId: ensureLayer('Bâtiments existants', '#f87171'), points: c.pts.map(q => ({ x: q.x, y: q.y })), open: false, color: '#f87171', hatch: false }; shapes.push(sh); }
            let extra; if (!shapes.some(q => q.type === 'point' && hasZ(q.z)) && c.bg && c.bg.pdfTopo) { const D = c.bg.pdfTopo; if (D.t.length) { const v = D.t.map(r => r[2]).sort((a, b) => a - b), cl = []; v.forEach((z, i) => { if (!i || z - v[i - 1] > 5) cl.push([]); cl[cl.length - 1].push(z); }); const nr = cl.sort((a, b) => b.length - a.length)[0]; extra = pdfZPoints(c.bg, nr[0], nr[nr.length - 1], 'm'); } }
            const r = batMake(sh, extra); batCand = null; invalidateCache(); saveState(); selectedShapes = []; if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene();
            updateCommandMessageText(batMsg(r) + ' Donnez sa hauteur (NGF ou H), puis cliquez dans le bâtiment suivant, ou Terminer.'); batBar(); draw(); batHeightAsk(sh); return true; }

        // forme reconnue sous le curseur (outil Bâtiment existant) : contour fermé du dessin, sinon dans un plan PDF (fond ou tracés importés)
        // la zone hachurée qui contient le point, sinon le plus petit contour fermé formé par les traits autour. Renvoie des points du dessin.
        const batSrcCache = new Map();
        function batSrc(bg) {   // traits de la page (unités de page) avec leur boîte, et zones hachurées ; gardés pour la séance
            const id = bg.type === 'pdfvec' ? bg.vecId : bg.mapId; if (batSrcCache.has(id)) return batSrcCache.get(id); let L = [], W, H;
            if (bg.type === 'pdfvec') { const v = vecStore[bg.vecId]; if (!v) return null; W = v.W; H = v.H; const { xy, st, cl } = v; for (let i = 0; i < st.length - 1; i++) { const pl = []; for (let k = st[i]; k < st[i + 1]; k++) pl.push([xy[2 * k], xy[2 * k + 1]]); if (cl[i] && pl.length > 2) pl.push(pl[0]); L.push(pl); } }
            else { const V = pdfVecCache[bg.mapId]; if (!V) return null; W = V.W; H = V.H; L = V.P.filter(q => !q.f && q.p.length >= 2).map(q => { const p = q.p.map(u => [u[0] * W, u[1] * H]); if (q.c) p.push(p[0]); return p; }); }
            const B = L.map(pl => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pl.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); return [x0, y0, x1, y1]; });
            let hz = []; try { hz = hatchRegions(L); } catch (e) {} const o = { L, B, W, H, hz }; batSrcCache.set(id, o); return o; }
        function batCandAt(x, y) {
            const area = (P) => { let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; }); return Math.abs(a / 2); }, lay = (s) => layers.find(l => l.id === (s.layerId || 'layer-0'));
            let best = null; for (const s of shapes) { if (s.type !== 'poly' || s.open || s.points.length < 3 || s.solid || s.batEx || s.gen || s.trench || s.water || s.sweep || s.wallMat) continue; const l = lay(s); if (l && l.visible === false) continue;
                if (pointInPolygon(x, y, s.points)) { const a = area(s.points); if (!best || a < best.a) best = { s, pts: s.points, a }; } }
            if (best) return best;
            for (const bg of shapes) { if (bg.type !== 'pdfvec' && bg.type !== 'bgimage') continue; const l = lay(bg); if (l && l.visible === false) continue; const S = batSrc(bg);
                const ln = bgLocal(bg, x, y), px = (ln.x / bg.w + 0.5) * (S ? S.W : 1), py = (ln.y / bg.h + 0.5) * (S ? S.H : 1), toW = (p) => S ? bgUV(bg, p[0] / S.W, p[1] / S.H) : bgUV(bg, p[0], p[1]);
                const inside = (pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
                let pick = null; const take = (pts, kind) => { const w = pts.map(toW), a = area(w); if (!pick || a < pick.a) pick = { pts: w, a, bg, kind }; };
                if (bg.type === 'bgimage' && Array.isArray(bg.pdfBat) && !S) bg.pdfBat.forEach(L => { const w = L.map(u => bgUV(bg, u[0], u[1])); if (pointInPolygon(x, y, w)) { const a = area(w); if (!pick || a < pick.a) pick = { pts: w, a, bg, kind: 'pdf' }; } });
                if (!S) { if (pick) return pick; continue; }
                S.hz.forEach(pts => { if (inside(pts)) take(pts, 'hachures'); }); if (pick) return pick;
                for (const R of [120, 300]) { const P2 = []; S.B.forEach((b, i) => { if (b[2] >= px - R && b[0] <= px + R && b[3] >= py - R && b[1] <= py + R) P2.push(S.L[i]); }); if (!P2.length) continue;
                    let F = []; try { F = batOutlines(P2, 0.6, [px, py, R * R * 1.6]); } catch (e) {} if (F.length) { take(F[0], 'contour'); return pick; } } }
            return null; }
        let batCand = null, batCandT = 0;
        function batHover(x, y) { if (!(mode === 'pline' && batDraw) || isDrawing) { if (batCand) { batCand = null; return true; } return false; }
            if (batCand && pointInPolygon(x, y, batCand.pts)) return false; if (batCand) { batCand = null; draw(); }
            clearTimeout(batCandT); batCandT = setTimeout(() => { if (!(mode === 'pline' && batDraw) || isDrawing) return; batCand = batCandAt(x, y); draw(); }, 90); return false; }   // calculé quand la souris se pose
        function batDrawCand(c) { const K = batCand; if (!K || !(mode === 'pline' && batDraw) || isDrawing) return; c.save(); c.beginPath(); K.pts.forEach((p, i) => { const q = worldToScreen(p.x, p.y); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.closePath();
            c.fillStyle = 'rgba(248,113,113,.22)'; c.fill(); c.strokeStyle = '#ef4444'; c.lineWidth = 2.5; c.setLineDash([]); c.stroke();
            const q = worldToScreen(K.pts.reduce((a, p) => a + p.x, 0) / K.pts.length, K.pts.reduce((a, p) => a + p.y, 0) / K.pts.length), t = 'clic : bâtiment (' + (K.kind === 'hachures' ? 'zone hachurée' : K.s ? 'contour du dessin' : 'contour du plan') + ')';
            c.font = '12px sans-serif'; const tw = c.measureText(t).width; c.fillStyle = 'rgba(17,24,39,.9)'; c.fillRect(q.x - tw / 2 - 6, q.y - 10, tw + 12, 20); c.fillStyle = '#fecaca'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(t, q.x, q.y); c.restore(); }
        // hauteur demandée à chaque bâtiment : NGF (cote du haut) ou H (au-dessus du pied), l'une remplit l'autre
        function batHeightAsk(sh) {
            const old = document.getElementById('bat-h'); if (old) old.remove(); const base = (sh.points[0].z || 0) / 1000, h0 = (sh.solid ? sh.solid.H : 6000) / 1000, noRoof = h0 < 2, top0 = base + (noRoof ? 6 : h0);   // pas de cote de toit dedans : 6 m proposés
            const host = canvas.parentElement, c = sh.points.reduce((a, p) => ({ x: a.x + p.x / sh.points.length, y: a.y + p.y / sh.points.length }), { x: 0, y: 0 }), q = worldToScreen(c.x, c.y), d = document.createElement('div'); d.id = 'bat-h';
            d.style.cssText = 'position:absolute;z-index:60;left:' + Math.max(4, Math.min(q.x + 20, host.clientWidth - 270)) + 'px;top:' + Math.max(50, Math.min(q.y - 60, host.clientHeight - 170)) + 'px;background:#1f2937;border:1px solid #f87171;border-radius:9px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.5);width:256px;color:#e5e7eb;font-size:13px';
            const fld = (id, lab, v) => '<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px"><b>' + lab + '</b><span><input id="' + id + '" type="text" inputmode="decimal" value="' + nfr(v, 2) + '" style="width:88px;text-align:right;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:3px 7px"> m</span></label>';
            d.innerHTML = '<div style="font-weight:700;color:#fecaca">🏠 Hauteur du bâtiment</div><div style="color:#9ca3af;font-size:12px;margin-top:2px">Pied (terrain) : ' + nfr(base, 2) + ' m NGF' + (noRoof ? ' · aucune cote de toit dedans : 6 m proposés' : ' · haut = cote la plus haute relevée dedans') + '</div>' + fld('bat-ngf', 'Haut NGF', top0) + fld('bat-hh', 'H =', top0 - base) + '<div style="color:#9ca3af;font-size:11px;margin-top:7px">Entrée : valider · Tab : l\'autre champ · Échap : laisser tel quel</div>';
            host.appendChild(d); const N = d.querySelector('#bat-ngf'), Hh = d.querySelector('#bat-hh'), num = (e) => parseFloat(String(e.value).replace(/\s/g, '').replace(',', '.'));
            let last = 'N'; N.addEventListener('input', () => { last = 'N'; const v = num(N); if (isFinite(v)) Hh.value = nfr(v - base, 2); }); Hh.addEventListener('input', () => { last = 'H'; const v = num(Hh); if (isFinite(v)) N.value = nfr(base + v, 2); });
            let done = false; const end = (ok) => { if (done) return; done = true; d.remove(); if (ok) { const v = num(last === 'H' ? Hh : N); if (isFinite(v)) batSetTop(sh, last === 'H' ? Math.round((sh.points[0].z || 0) + v * 1000) : Math.round(v * 1000)); } draw(); };
            [N, Hh].forEach(inp => { inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); end(true); } else if (e.key === 'Escape') { e.preventDefault(); end(false); } else if (e.key === 'Tab') { e.preventDefault(); (inp === N ? Hh : N).focus(); (inp === N ? Hh : N).select(); } }); });
            d.addEventListener('focusout', () => setTimeout(() => { if (!d.contains(document.activeElement)) end(true); }, 0));
            setTimeout(() => { N.focus(); N.select(); }, 0); }
        function batSetTop(sh, top) { if (!sh || !sh.batEx) return; const b = sh.points[0].z || 0; if (!sh.solid) sh.solid = { kind: 'box', H: 0 }; sh.solid.H = Math.max(100, top - b); sh.batTop = b + sh.solid.H; invalidateCache(); saveState(); if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene();
            updateCommandMessageText('BÂTIMENT EXISTANT : haut à ' + nfr(sh.batTop / 1000, 2) + ' m NGF (H = ' + nfr(sh.solid.H / 1000, 2) + ' m au-dessus du pied, ' + nfr(b / 1000, 2) + ' m).'); }
        // contour d'un bâtiment déformé (poignées, ajout de sommet, déplacement) : pied recalculé, haut NGF gardé
        function batWatch() { for (const s of shapes) { if (!s.batEx || s.type !== 'poly') continue; const sig = s.points.map(q => Math.round(q.x) + ',' + Math.round(q.y)).join(';'); if (s._bsig === undefined) { Object.defineProperty(s, '_bsig', { value: sig, writable: true, enumerable: false }); continue; }
                if (s._bsig !== sig) { s._bsig = sig; try { const top = s.batTop; batMake(s, null, true); if (hasZ(top)) { s.batTop = top; s.solid.H = Math.max(100, top - (s.points[0].z || 0)); } } catch (e) { console.warn(e); } } } }
        function batMsg(r) { return 'BÂTIMENT EXISTANT : posé sur le terrain à ' + nfr(r.base / 1000, 2) + ' m, haut à ' + nfr(r.top / 1000, 2) + ' m' + (r.n ? ' (cote la plus haute des ' + r.n + ' relevée(s) dedans, sorties du terrain)' : ' (aucune cote dedans : hauteur de 6 m par défaut)') + '.'; }
        function batFromSel() { const L = selectedShapes.filter(x => x.type === 'poly' && !x.batEx && x.points.length > 2); if (!L.length) { selectedShapes = []; setMode('pline'); batDraw = true; updateCommandMessage(); return; }
            let r = null; L.forEach(x => { r = batMake(x); }); invalidateCache(); saveState(); draw(); if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene();
            updateCommandMessageText(L.length > 1 ? 'BÂTIMENTS EXISTANTS : ' + L.length + ' contours marqués ; leurs cotes sont sorties du terrain. Ctrl+Z pour annuler.' : batMsg(r) + ' Ctrl+Z pour annuler.'); }
        function batUnset(s) { s = s || selectedShapes.find(x => x.batEx); if (!s) return; delete s.batEx; delete s.batTop; delete s.batGz; delete s.solid; if (s.name === 'Bâtiment existant') delete s.name; s.points.forEach(q => { delete q.z; }); delete s.zk;
            invalidateCache(); saveState(); closeSelectionParamModal(); draw(); updateCommandMessageText('Ce contour n\'est plus un bâtiment : ses cotes refont le terrain.'); }
        function batRefresh(s) { s = s || selectedShapes.find(x => x.batEx); if (!s) return; const r = batMake(s); invalidateCache(); saveState(); closeSelectionParamModal(); draw(); updateCommandMessageText(batMsg(r)); }
        function finishPline() {
            const P = cleanPolyPts(currentPolygon, false);
            if (trenchDraw) { if (P.length >= 2) { const t = trCreate(P); saveState(); updateCommandMessageText('TRANCHÉE « ' + t.trench.name + ' » tracée (' + nfr(shapeLengthM(t), 2) + ' m). Tracez la suivante (amont → aval), Entrée pour finir ; double-clic sur une étiquette pour modifier FE / T.'); } isDrawing = false; currentPolygon = []; typedInput = ''; draw(); return; }
            if (batDraw) { if (P.length >= 3) { const sh = { type: 'poly', layerId: ensureLayer('Bâtiments existants', '#f87171'), points: P.map(q => ({ x: q.x, y: q.y })), open: false, color: '#f87171', hatch: false }; shapes.push(sh); const r = batMake(sh); invalidateCache(); saveState(); updateCommandMessageText(batMsg(r) + ' Donnez sa hauteur (NGF ou H), puis le bâtiment suivant, ou Terminer.'); batBar(); isDrawing = false; currentPolygon = []; typedInput = ''; draw(); batHeightAsk(sh); return; } isDrawing = false; currentPolygon = []; typedInput = ''; draw(); return; }
            if (brkDraw) { if (P.length >= 2) { const r = brkMake({ points: P }); if (r.s) { shapes.push(r.s); saveState(); } updateCommandMessageText(r.msg + (r.s ? ' Tracez la suivante, ou Échap.' : '')); } isDrawing = false; currentPolygon = []; typedInput = ''; draw(); return; }
            if (P.length >= 2) { shapes.push({ type: 'poly', layerId: activeLayerId, points: P, open: true, color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false }); saveState(); }
            isDrawing = false; currentPolygon = []; typedInput = ''; updateCommandMessage(); draw();
        }
        // =====================================================================
        // PLUME : courbes de Bézier cubiques. Chaque point { x, y, hin, hout } (poignées, ou null = point anguleux).
        // Le résultat est une polyligne lissée (s.curve = nombre de pas par tronçon) : se déplace, pivote, se coupe, s'exporte comme une polyligne.
        // =====================================================================
        let penPts = [], penDrag = null;
        const PEN_STEPS = 24;
        function bezPt(a, c1, c2, b, t) { const u = 1 - t; return { x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y }; }
        function penFlatten(P, closed) {
            const out = [{ x: P[0].x, y: P[0].y }], n = P.length, ns = closed ? n : n - 1;
            for (let i = 0; i < ns; i++) { const a = P[i], b = P[(i + 1) % n], c1 = a.hout || a, c2 = b.hin || b;
                for (let k = 1; k <= PEN_STEPS; k++) out.push(bezPt(a, c1, c2, b, k / PEN_STEPS)); }
            if (closed) out.pop();   // le dernier point = le premier
            return out;
        }
        function finishPen(closed) {
            if (penPts.length >= 2) {
                const pts = penFlatten(penPts, closed);
                shapes.push({ type: 'poly', layerId: activeLayerId, points: pts, open: !closed, curve: PEN_STEPS, color: document.getElementById('prop-color').value, dash: document.getElementById('prop-dash').value, width: parseFloat(document.getElementById('prop-width').value) || 1, hatch: false });
                saveState();
            }
            penPts = []; penDrag = null; updateCommandMessage(); draw();
        }
        function penDown(wx, wy) {
            const sn = findSnap(wx, wy); let x = sn ? sn.x : wx, y = sn ? sn.y : wy;
            if (penPts.length >= 2 && Math.hypot(x - penPts[0].x, y - penPts[0].y) < SNAP_DIST_PX / camera.zoom) { penDrag = { i: 0, closing: true, x0: penPts[0].x, y0: penPts[0].y }; return; }
            if (penPts.length && (orthoMode || shiftHeld)) { const lp = penPts[penPts.length - 1]; if (Math.abs(x - lp.x) > Math.abs(y - lp.y)) y = lp.y; else x = lp.x; }
            penPts.push({ x, y, hin: null, hout: null }); penDrag = { i: penPts.length - 1, x0: x, y0: y };
        }
        function penMove(wx, wy) {   // cliquer-glisser : poignées symétriques
            if (!penDrag) return; const q = penPts[penDrag.i]; if (Math.hypot(wx - q.x, wy - q.y) < 3 / camera.zoom) { if (!penDrag.closing) { q.hin = q.hout = null; } return; }
            if (penDrag.closing) { q.hin = { x: 2 * q.x - wx, y: 2 * q.y - wy }; if (!q.hout) q.hout = { x: wx, y: wy }; else q.hout = { x: wx, y: wy }; return; }
            q.hout = { x: wx, y: wy }; q.hin = { x: 2 * q.x - wx, y: 2 * q.y - wy };
        }
        function penUp() { if (!penDrag) return; const closing = penDrag.closing; penDrag = null; if (closing) finishPen(true); else { updateCommandMessage(); draw(); } }
        function drawPenPreview(c) {
            if (mode !== 'pen' || !penPts.length) return;
            const col = document.getElementById('prop-color').value, P = penPts.slice();
            if (!penDrag) P.push({ x: currentX, y: currentY, hin: null, hout: null });
            c.save(); c.setLineDash([]); c.strokeStyle = col; c.lineWidth = 1.5 / camera.zoom; c.beginPath();
            const F = P.length >= 2 ? penFlatten(P, false) : [P[0]]; F.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
            // poignées et points
            const t = 4 / camera.zoom; c.lineWidth = 1 / camera.zoom; c.strokeStyle = '#38bdf8'; c.fillStyle = '#38bdf8';
            penPts.forEach((q, i) => {
                [q.hin, q.hout].forEach(h => { if (!h) return; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(h.x, h.y); c.stroke(); c.beginPath(); c.arc(h.x, h.y, t * 0.7, 0, 7); c.fill(); });
                c.fillStyle = i === 0 ? '#eab308' : '#fff'; c.fillRect(q.x - t, q.y - t, 2 * t, 2 * t); c.strokeRect(q.x - t, q.y - t, 2 * t, 2 * t); c.fillStyle = '#38bdf8';
            });
            c.restore();
        }
        // =====================================================================
        // COPIE MIROIR : sélection, axe en 2 clics, Entrée = copie (original gardé), Suppr = miroir sans l'original
        // =====================================================================
        let mirrorA = null, mirrorB = null, mirrorPending = false, mirrorSel = [];
        function startMirror() {
            const sel = selectedShapes.filter(x => !isBg(x) && x.type !== 'mesh' && x.type !== 'pdfvec');
            if (!sel.length) { setMode('select-box'); mirrorPending = true; updateCommandMessageText('COPIE MIROIR : sélectionnez les objets, puis Espace (ou recliquez le bouton miroir).'); draw(); return; }
            mirrorPending = false; setMode('mirror'); selectedShapes = sel; mirrorSel = sel; mirrorA = mirrorB = null; updateCommandMessage(); draw();
        }
        function mirrorPointFn(A, B) {
            const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, c2 = (dx * dx - dy * dy) / L2, s2 = 2 * dx * dy / L2;
            return (x, y) => { const X = x - A.x, Y = y - A.y; return { x: A.x + X * c2 + Y * s2, y: A.y + X * s2 - Y * c2 }; };
        }
        function applyMirrorToShape(s, A, B) {
            const m = mirrorPointFn(A, B), phi = Math.atan2(B.y - A.y, B.x - A.x), mp = (o, kx, ky) => { const q = m(o[kx], o[ky]); o[kx] = q.x; o[ky] = q.y; };
            xPtsOf(s).forEach(h => h.forEach(p => mp(p, 'x', 'y')));
            if (s.type === 'line' || s.type === 'slope') { mp(s, 'x1', 'y1'); mp(s, 'x2', 'y2'); if (s.wall && s.wall.align !== 'axe') s.wall.align = s.wall.align === 'droite' ? 'gauche' : 'droite'; }
            else if (s.type === 'circle' || s.type === 'point' || s.type === 'text') mp(s, 'x', 'y');
            else if (s.type === 'cline') { const o = m(0, 0), q = m(s.ux, s.uy); mp(s, 'x', 'y'); s.ux = q.x - o.x; s.uy = q.y - o.y; }
            else if (s.type === 'arc') { mp(s, 'x', 'y'); const a0 = s.startAngle, a1 = s.endAngle; s.startAngle = 2 * phi - a1; s.endAngle = 2 * phi - a0; }
            else if (s.type === 'poly') s.points.forEach(p => mp(p, 'x', 'y'));
            else if (s.type === 'dim') {
                const hv = Math.abs(Math.sin(2 * phi)) < 1e-9;
                if (s.orient && !hv) { const g = dimGeom(s); if (g) { s.x1 = g.c1.x; s.y1 = g.c1.y; s.x2 = g.c2.x; s.y2 = g.c2.y; s.ox = g.mid.x; s.oy = g.mid.y; } delete s.orient; }
                mp(s, 'x1', 'y1'); mp(s, 'x2', 'y2'); mp(s, 'ox', 'oy');
            }
            else if (s.type === 'dim-angle') { [s.vertex, s.p1, s.p2].forEach(p => mp(p, 'x', 'y')); }
            else if (s.type === 'hatch') { s.loops.forEach(l => l.forEach(p => mp(p, 'x', 'y'))); s.hatchAngle = 2 * phi * 180 / Math.PI - ((s.hatchAngle !== undefined) ? s.hatchAngle : 45); }
            else if (s.type === 'detail') { mp(s, 'tx', 'ty'); mp(s, 'lx', 'ly'); }
            else if (s.type === 'dimr') { mp(s, 'x', 'y'); mp(s, 'ax', 'ay'); mp(s, 'lx', 'ly'); }
        }
        function mirrorClones(A, B) {
            const gmap = {};
            return mirrorSel.map(s0 => { const s = JSON.parse(JSON.stringify(s0)); if (s.groupId) s.groupId = gmap[s.groupId] || (gmap[s.groupId] = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)); applyMirrorToShape(s, A, B); return s; });
        }
        function mirrorTargetB(px, py, shift) { const A = mirrorA; if (A && (orthoMode || shift)) { if (Math.abs(px - A.x) > Math.abs(py - A.y)) py = A.y; else px = A.x; } return { x: px, y: py }; }
        function mirrorClick(wx, wy, shift) {
            const sn = findSnap(wx, wy), x = sn ? sn.x : wx, y = sn ? sn.y : wy;
            if (!mirrorA) mirrorA = { x, y };
            else if (!mirrorB) { const b = mirrorTargetB(x, y, shift); if (Math.hypot(b.x - mirrorA.x, b.y - mirrorA.y) > 1e-9) mirrorB = b; }
            updateCommandMessage(); draw();
        }
        function mirrorApply(keep) {
            if (!mirrorA || !mirrorB) return;
            const cl = mirrorClones(mirrorA, mirrorB);
            if (!keep) shapes = shapes.filter(s => !mirrorSel.includes(s));
            shapes.push(...cl); saveState();
            const n = cl.length; mirrorA = mirrorB = null; setMode('select-box'); selectedShapes = cl;
            updateCommandMessageText('COPIE MIROIR : ' + n + ' objet(s) ' + (keep ? 'copiés en miroir (originaux gardés).' : 'retournés en miroir (originaux supprimés).')); draw();
        }
        function drawMirrorPreview(c) {
            if (mode !== 'mirror' || !mirrorA) return;
            const B = mirrorB || mirrorTargetB(currentX, currentY, shiftHeld); if (Math.hypot(B.x - mirrorA.x, B.y - mirrorA.y) < 1e-9) return;
            const dx = B.x - mirrorA.x, dy = B.y - mirrorA.y, L = Math.hypot(dx, dy), ext = 3000 / camera.zoom;
            c.save(); c.strokeStyle = '#fbbf24'; c.lineWidth = 1.2 / camera.zoom; c.setLineDash([10 / camera.zoom, 4 / camera.zoom, 2 / camera.zoom, 4 / camera.zoom]);
            c.beginPath(); c.moveTo(mirrorA.x - dx / L * ext, mirrorA.y - dy / L * ext); c.lineTo(B.x + dx / L * ext, B.y + dy / L * ext); c.stroke(); c.restore();
            c.save(); c.globalAlpha = 0.6; mirrorClones(mirrorA, B).forEach(s => drawSingleShape(c, s, false, false, 0, 0, camera.zoom)); c.restore();
        }
        function drawWallPreview(c) {
            if (mode !== 'wall' || !wallTool || !wallStart) return;
            const C = wallChainLive(), pts = C ? C.pts : [wallStart], cur = wallTarget(currentX, currentY, shiftHeld);
            if (Math.hypot(cur.x - pts[pts.length - 1].x, cur.y - pts[pts.length - 1].y) < 1e-9) return;
            const sub = pts.slice(-3).concat([cur]), G = wallChainGeom(sub, wallTool, false), mat = wallTool.layers[0].mat;
            const lid = C ? C.lid : null, col = lid ? effectiveColor({ layerId: lid }, false) : ((WALL_MATS[mat] || WALL_MATS.air).line || '#fff');
            const lw = (lid ? effectiveWidth({ layerId: lid }) : 1) * 2 / camera.zoom;
            const draw1 = (g, alpha, first) => {
                const rc = [g.A0, g.A1, g.B1, g.B0];
                c.save(); c.globalAlpha = alpha; if (mat !== 'air') drawMatHatch(c, { loops: [rc] }, mat, col, camera.zoom);
                c.strokeStyle = col; c.lineWidth = lw; c.setLineDash([]); c.beginPath();
                c.moveTo(g.A0.x, g.A0.y); c.lineTo(g.A1.x, g.A1.y); c.lineTo(g.B1.x, g.B1.y); c.lineTo(g.B0.x, g.B0.y); if (first) c.closePath(); c.stroke(); c.restore();
            };
            if (C && G.length >= 2) draw1(G[G.length - 2], 1, pts.length === 2);   // tronçon précédent, onglet à jour
            draw1(G[G.length - 1], 0.7, !C);
            c.save(); c.globalAlpha = 0.5; c.strokeStyle = col; c.lineWidth = 1 / camera.zoom; c.setLineDash([6 / camera.zoom, 4 / camera.zoom]); c.beginPath(); c.moveTo(wallStart.x, wallStart.y); c.lineTo(cur.x, cur.y); c.stroke(); c.restore();
        }
        // éditeur de couches (fenêtre Y)
        let wallEdit = null;
        function wallEditorHTML() {
            const opts = (v) => Object.keys(WALL_MATS).map(k => `<option value="${k}"${k === v ? ' selected' : ''}>${WALL_MATS[k].name}</option>`).join('');
            return `<div class="border-t border-gray-600 pt-2 mt-1 text-xs text-gray-400">Paroi : couches du côté gauche (sens de tracé) vers le côté droit — épaisseur totale <b id="wl-tot" class="text-white">${wallThick(wallEdit)} mm</b></div>`
                + wallEdit.layers.map((l, i) => `<div class="flex items-center gap-1"><select class="wl-mat flex-1 bg-gray-700 text-white border border-gray-600 rounded px-1 py-1 text-xs" data-i="${i}" onchange="wallSync()">${opts(l.mat)}</select><input class="wl-e w-16 bg-gray-700 text-white border border-gray-600 rounded px-1 py-1 text-xs text-right" data-i="${i}" value="${l.e}" oninput="wallSync(true)"><span class="text-xs text-gray-400">mm</span><button type="button" class="text-red-300 hover:text-red-200 text-xs px-1" title="Retirer la couche" onclick="wallSync();wallEdit.layers.splice(${i},1);wallRender()">✕</button></div>`).join('')
                + `<div class="flex items-center justify-between gap-2"><button type="button" class="text-xs text-sky-300 hover:text-sky-200" onclick="wallSync();wallEdit.layers.push({mat:'beton',e:200});wallRender()">+ Ajouter une couche</button><label class="text-xs flex items-center gap-1">Alignement <select id="wl-align" class="bg-gray-700 text-white border border-gray-600 rounded px-1 py-0.5 text-xs" onchange="wallSync()"><option value="gauche"${wallEdit.align === 'gauche' ? ' selected' : ''}>tracé = face gauche</option><option value="axe"${wallEdit.align === 'axe' ? ' selected' : ''}>tracé = axe</option><option value="droite"${wallEdit.align === 'droite' ? ' selected' : ''}>tracé = face droite</option></select></label></div>`;
        }
        function wallSync(noRender) {
            document.querySelectorAll('#wall-edit .wl-mat').forEach(el => { wallEdit.layers[+el.dataset.i].mat = el.value; });
            document.querySelectorAll('#wall-edit .wl-e').forEach(el => { const v = parseFloat(String(el.value).replace(',', '.')); if (v > 0) wallEdit.layers[+el.dataset.i].e = v; });
            const al = document.getElementById('wl-align'); if (al) wallEdit.align = al.value;
            const tt = document.getElementById('wl-tot'); if (tt) tt.textContent = wallThick(wallEdit) + ' mm';
        }
        function wallRender() { const d = document.getElementById('wall-edit'); if (d) d.innerHTML = wallEditorHTML(); }
        // ---- Étirer (STRETCH) : fenêtre de capture, point de base, destination ----
        // sommets dans la fenêtre déplacés ; cercles, arcs, textes, points… déplacés si leur centre / point d'insertion y est
        let stretchWin = null, stretchA = null, stretchBase = null;
        function stretchShape(s0, W, dx, dy) {
            const s = JSON.parse(JSON.stringify(s0)), inW = (x, y) => x >= W.x0 && x <= W.x1 && y >= W.y0 && y <= W.y1;
            const mv = (o, kx, ky) => { if (inW(o[kx], o[ky])) { o[kx] += dx; o[ky] += dy; return true; } return false; };
            let hit = false;
            if (s.type === 'line' || s.type === 'slope') { hit = mv(s, 'x1', 'y1') | mv(s, 'x2', 'y2'); }
            else if (s.type === 'poly') { s.points.forEach(p => { if (mv(p, 'x', 'y')) hit = true; }); holesOf(s).forEach(h => h.forEach(p => { if (mv(p, 'x', 'y')) hit = true; })); }
            else if (s.type === 'dim') { const a = inW(s.x1, s.y1), b = inW(s.x2, s.y2); if (a) { s.x1 += dx; s.y1 += dy; } if (b) { s.x2 += dx; s.y2 += dy; } if ((a && b) || inW(s.ox, s.oy)) { s.ox += dx; s.oy += dy; } hit = a || b; }
            else if (s.type === 'detail') { hit = mv(s, 'tx', 'ty') | mv(s, 'lx', 'ly'); }
            else if (s.type === 'dim-angle') { if (inW(s.vertex.x, s.vertex.y)) { translateShape(s, dx, dy); hit = true; } }
            else if (s.x !== undefined && s.y !== undefined) { if (inW(s.x, s.y)) { translateShape(s, dx, dy); hit = true; } }
            return hit ? s : null;
        }
        function stretchTargets() {
            const W = stretchWin, out = [];
            shapes.forEach((s, i) => { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if ((l && l.visible === false) || s.gen) return; const r = stretchShape(s, W, 0, 0); if (r) out.push(i); });
            return out;
        }
        function drawStretchPreview(c) {
            if (mode !== 'stretch') return;
            const ls = camera.zoom;
            if (stretchA && !stretchWin) { c.save(); c.setLineDash([6 / ls, 4 / ls]); c.strokeStyle = '#22c55e'; c.fillStyle = 'rgba(34,197,94,0.08)'; c.lineWidth = 1 / ls; c.fillRect(stretchA.x, stretchA.y, currentX - stretchA.x, currentY - stretchA.y); c.strokeRect(stretchA.x, stretchA.y, currentX - stretchA.x, currentY - stretchA.y); c.restore(); return; }
            if (!stretchWin) return;
            const W = stretchWin; c.save(); c.setLineDash([6 / ls, 4 / ls]); c.strokeStyle = '#22c55e'; c.lineWidth = 1 / ls; c.strokeRect(W.x0, W.y0, W.x1 - W.x0, W.y1 - W.y0); c.restore();
            if (!stretchBase) return;
            const dx = currentX - stretchBase.x, dy = currentY - stretchBase.y;
            c.save(); c.globalAlpha = 0.6; shapes.forEach(s => { const r = stretchShape(s, W, dx, dy); if (r) drawSingleShape(c, r, false, true, 0, 0); });
            c.setLineDash([4 / ls, 4 / ls]); c.strokeStyle = '#fbbf24'; c.lineWidth = 1 / ls; c.beginPath(); c.moveTo(stretchBase.x, stretchBase.y); c.lineTo(currentX, currentY); c.stroke(); c.restore();
        }
        function stretchApply(dx, dy) {
            let n = 0; shapes = shapes.map(s => { const r = stretchShape(s, stretchWin, dx, dy); if (r) { n++; return r; } return s; });
            selectedShapes = []; stretchWin = stretchA = stretchBase = null; typedInput = ''; saveState(); draw();
            updateCommandMessageText('ÉTIRER : ' + n + ' objet(s) étiré(s) de ' + calculateRealDistance(Math.hypot(dx, dy)) + '. Nouvelle fenêtre, ou Échap.');
        }
        // ---- Éclater : rectangles / polylignes -> droites (altitudes des sommets conservées) ----
        function explodeSelection() {
            const sel = selectedShapes.filter(x => x.type === 'poly' && !x.gen && !x.solid);
            if (!sel.length) { updateCommandMessageText('ÉCLATER : sélectionnez d\'abord des rectangles ou des polylignes' + (selectedShapes.some(x => x.solid) ? ' (les volumes 3D ne s\'éclatent pas)' : '') + '.'); return; }
            const out = [];
            sel.forEach(p => { for (let i = 0; i < polyEdges(p); i++) { const a = p.points[i], b = p.points[(i + 1) % p.points.length];
                if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue;
                const ln = { type: 'line', layerId: p.layerId, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: p.color, dash: p.dash, width: p.width, zk: 1 };
                if (hasZ(a.z)) ln.z1 = a.z; if (hasZ(b.z)) ln.z2 = b.z; if (p.groupId) ln.groupId = p.groupId; out.push(ln); } });
            shapes = shapes.filter(x => !sel.includes(x)).concat(out); selectedShapes = []; saveState(); draw();
            updateCommandMessageText('ÉCLATER : ' + sel.length + ' forme(s) décomposée(s) en ' + out.length + ' droite(s).');
        }
        // ---- Arrondir (raccord) : 2 droites qui forment un angle, rayon R ----
        let filletA = null, filletB = null, filletR = null;
        try { filletR = parseFloat(localStorage.getItem('momocad-fillet-r')); if (!isFinite(filletR)) filletR = null; } catch (e) {}
        function doFillet(Rw) {
            const L1 = filletA.s, L2 = filletB.s;
            const d1 = { x: L1.x2 - L1.x1, y: L1.y2 - L1.y1 }, d2 = { x: L2.x2 - L2.x1, y: L2.y2 - L2.y1 }, den = d1.x * d2.y - d1.y * d2.x;
            if (Math.abs(den) < 1e-9 * Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y)) return 'les deux droites sont parallèles';
            const tI = ((L2.x1 - L1.x1) * d2.y - (L2.y1 - L1.y1) * d2.x) / den, I = { x: L1.x1 + d1.x * tI, y: L1.y1 + d1.y * tI };
            const side = (L, c) => {   // côté conservé = celui du clic
                const n = Math.hypot(L.x2 - L.x1, L.y2 - L.y1), u = { x: (L.x2 - L.x1) / n, y: (L.y2 - L.y1) / n }, sc = (P) => (P.x - I.x) * u.x + (P.y - I.y) * u.y;
                const s1 = sc({ x: L.x1, y: L.y1 }), s2 = sc({ x: L.x2, y: L.y2 }), sg = Math.sign(sc(c)) || Math.sign(Math.abs(s1) > Math.abs(s2) ? s1 : s2);
                return { u: { x: u.x * sg, y: u.y * sg }, keep1: Math.abs(s1) * Math.sign(s1) * sg >= Math.abs(s2) * Math.sign(s2) * sg, len: Math.max(s1 * sg, s2 * sg) };
            };
            const A = side(L1, filletA.c), B = side(L2, filletB.c);
            const cosT = A.u.x * B.u.x + A.u.y * B.u.y, th = Math.acos(Math.max(-1, Math.min(1, cosT)));
            if (th < 1e-3 || th > Math.PI - 1e-3) return 'angle trop plat';
            const t = Rw > 0 ? Rw / Math.tan(th / 2) : 0;
            if (t > A.len + 1e-6 || t > B.len + 1e-6) return 'rayon trop grand pour ces droites';
            const T1 = { x: I.x + A.u.x * t, y: I.y + A.u.y * t }, T2 = { x: I.x + B.u.x * t, y: I.y + B.u.y * t };
            const setEnd = (L, keep1, T) => {   // l'extrémité côté angle va au point de tangence (Z prolongé)
                const z = (hasZ(L.z1) && hasZ(L.z2)) ? (() => { const n2 = (L.x2 - L.x1) ** 2 + (L.y2 - L.y1) ** 2, k = ((T.x - L.x1) * (L.x2 - L.x1) + (T.y - L.y1) * (L.y2 - L.y1)) / n2; return L.z1 + (L.z2 - L.z1) * k; })() : undefined;
                if (keep1) { L.x2 = T.x; L.y2 = T.y; if (hasZ(z)) L.z2 = z; } else { L.x1 = T.x; L.y1 = T.y; if (hasZ(z)) L.z1 = z; }
                return z;
            };
            const za = setEnd(L1, A.keep1, T1), zb = setEnd(L2, B.keep1, T2);
            if (Rw > 0) {
                const bis = { x: A.u.x + B.u.x, y: A.u.y + B.u.y }, bn = Math.hypot(bis.x, bis.y), dc = Rw / Math.sin(th / 2), C = { x: I.x + bis.x / bn * dc, y: I.y + bis.y / bn * dc };
                const a1 = Math.atan2(T1.y - C.y, T1.x - C.x), a2 = Math.atan2(T2.y - C.y, T2.x - C.x); let d = a2 - a1; while (d < 0) d += 2 * Math.PI;
                const arc = { type: 'arc', layerId: L1.layerId, x: C.x, y: C.y, r: Rw, startAngle: d <= Math.PI ? a1 : a2, endAngle: d <= Math.PI ? a2 : a1, color: L1.color, dash: L1.dash, width: L1.width, zk: 1 };
                if (hasZ(za) && hasZ(zb)) arc.z = (za + zb) / 2; shapes.push(arc);
            }
            return null;
        }
        function filletApply(v) {
            const Rw = (v / unitsPerSquare) * GRID_SIZE, err = doFillet(Rw);
            if (err) { updateCommandMessageText('ARRONDIR : ' + err + '. Recommencez.'); filletA = filletB = null; typedInput = ''; draw(); return; }
            filletR = v; try { localStorage.setItem('momocad-fillet-r', String(v)); } catch (e) {}
            filletA = filletB = null; typedInput = ''; saveState(); draw();
            updateCommandMessageText('ARRONDIR : raccord R = ' + String(v).replace('.', ',') + ' ' + currentUnit + ' fait. Cliquez 2 autres droites, ou Échap.');
        }
