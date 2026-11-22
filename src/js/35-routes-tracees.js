        // ROUTES TRACÉES : on trace l'axe (polyligne), la route se fait comme celles de la génération automatique : profil en long calé sur le terrain
        //      (lissé ou non), ses deux bords en lignes de rupture du terrain, enrobé en plan et en 3D ; les points du terrain tombés dans la chaussée sont
        //      mis de côté (rendus si la route bouge ou disparaît). Chaque SOMMET de l'axe est un profil en travers (P1, P2… dans l'ordre du tracé) ; un sommet
        //      ajouté (poignée +) en ajoute un. Chaque profil se règle (gardé sur le sommet, q.rd) : cote Z de l'axe, largeur à gauche et à droite, dévers.
        //      Entre deux profils, tout varie en ligne droite ; un profil non réglé suit le terrain et prend les largeurs et dévers de ses voisins.
        let rdDraw = false, rdPick = null;
        const rdOpt = (() => { let o = {}; try { o = JSON.parse(localStorage.getItem('momocad-road') || '{}') || {}; } catch (e) {} return Object.assign({ w: 5, prof: 'lisse', step: 10 }, o); })();
        function rdSaveOpt() { try { localStorage.setItem('momocad-road', JSON.stringify(rdOpt)); } catch (e) {} }
        const rdStepMsg = () => 'ROUTE : cliquez les sommets de l\'axe (chaque sommet est un profil en travers), Espace ou double-clic pour finir.';
        function startRoad() { closeFileMenus(); setMode('pline'); rdDraw = true; typedInput = ''; rdPanel(null); updateCommandMessageText(rdStepMsg()); draw(); }
        function rdMake(P) { const s = { type: 'poly', open: true, layerId: ensureLayer('Routes — axes', '#fbbf24'), points: P.map(q => ({ x: q.x, y: q.y })), hatch: false, dash: 'dashdot', name: 'Axe de route', rdAx: { id: 'rd' + generateId(), w: rdOpt.w, prof: rdOpt.prof } };
            shapes.push(s); const r = rdBuild(s); return { s, r }; }
        const rdSig = (s) => s.points.map(q => Math.round(q.x) + ',' + Math.round(q.y) + (q.rd ? JSON.stringify(q.rd) : '')).join(';') + '|' + s.rdAx.w + '|' + s.rdAx.prof;
        /* l'axe découpé : points tous les 2 m avec leur abscisse s (m) ; les profils en travers = les sommets (tangente : bissectrice aux sommets) */
        function rdAxis(ax) { const M = mmToWorld(1000), P = ax.points, S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y) / M); const L = S[S.length - 1];
            const at = (s) => { let i = 0; while (i < P.length - 2 && S[i + 1] < s) i++; const l = (S[i + 1] - S[i]) || 1, f = Math.max(0, Math.min(1, (s - S[i]) / l)); return { x: P[i].x + (P[i + 1].x - P[i].x) * f, y: P[i].y + (P[i + 1].y - P[i].y) * f, i }; };
            const dir = (i) => { const a = P[i], b = P[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
            const tanV = (i) => { if (i === 0) return dir(0); if (i === P.length - 1) return dir(P.length - 2); const a = dir(i - 1), b = dir(i), x = a.x + b.x, y = a.y + b.y, l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
            const pr = P.map((q, i) => { const t = tanV(i); return { key: i, vi: i, s: S[i], x: q.x, y: q.y, tx: t.x, ty: t.y, o: q.rd || {} }; });
            const D = []; for (let i = 0; i + 1 < P.length; i++) { const l = S[i + 1] - S[i], m = Math.max(1, Math.ceil(l / 2)); for (let k = 0; k < m; k++) D.push(S[i] + l * k / m); } D.push(L);
            const Ds = D.map(s => { const pp = pr.find(p => Math.abs(p.s - s) < 1e-6); if (pp) return { s, x: pp.x, y: pp.y, tx: pp.tx, ty: pp.ty }; const q = at(s), t = dir(q.i); return { s, x: q.x, y: q.y, tx: t.x, ty: t.y }; });
            return { L, pr, D: Ds, at }; }
        /* valeurs : Z = terrain le long de l'axe (lissé ou non) + l'écart donné aux profils réglés (0 aux autres), en ligne droite d'un profil à l'autre ;
           largeurs et dévers : ceux de chaque profil (réglés, sinon la largeur par défaut et chaussée plate), en ligne droite d'un profil à l'autre */
        function rdValues(ax, A, tin) { const R = ax.rdAx, D = A.D; D.forEach(q => { q.z0 = tin ? tinZ(q.x, q.y, tin) : null; });
            if (R.prof === 'tn') D.forEach(q => { q.za = q.z0; }); else smooth6(D, 'za');
            const zAt = (s) => { let j = 0; while (j < D.length - 1 && D[j + 1].s < s) j++; const a = D[j], b = D[Math.min(D.length - 1, j + 1)]; if (!hasZ(a.za)) return b.za; if (!hasZ(b.za) || b.s === a.s) return a.za; return a.za + (b.za - a.za) * (s - a.s) / (b.s - a.s); };
            A.pr.forEach(p => { p.za = zAt(p.s); p.set = !!Object.keys(p.o).length; });
            const sets = { dz: A.pr.map(p => [p.s, hasZ(p.o.z) && hasZ(p.za) ? p.o.z - p.za : 0]), wl: A.pr.map(p => [p.s, p.o.wl > 0 ? p.o.wl : R.w / 2]), wr: A.pr.map(p => [p.s, p.o.wr > 0 ? p.o.wr : R.w / 2]), dl: A.pr.map(p => [p.s, isFinite(p.o.dl) ? p.o.dl : 0]), dr: A.pr.map(p => [p.s, isFinite(p.o.dr) ? p.o.dr : 0]) };   /* chaque profil a sa valeur (réglée ou par défaut), en ligne droite de l'un à l'autre */
            const lin = (L, s, def) => { if (!L.length) return def; if (s <= L[0][0]) return L[0][1]; if (s >= L[L.length - 1][0]) return L[L.length - 1][1]; let j = 0; while (L[j + 1][0] < s) j++; const [s0, v0] = L[j], [s1, v1] = L[j + 1]; return s1 === s0 ? v0 : v0 + (v1 - v0) * (s - s0) / (s1 - s0); };
            const val = (q) => { q.z = hasZ(q.za) ? q.za + lin(sets.dz, q.s, 0) : null; q.wl = lin(sets.wl, q.s, R.w / 2); q.wr = lin(sets.wr, q.s, R.w / 2); q.dl = lin(sets.dl, q.s, 0); q.dr = lin(sets.dr, q.s, 0); };
            D.forEach(q => { const p = A.pr.find(pp => Math.abs(pp.s - q.s) < 1e-6); if (p && hasZ(p.za)) q.za = p.za; val(q); }); A.pr.forEach(val); return A; }
        /* un point d'un bord : à gauche (sg = 1) ou à droite (sg = -1) de l'axe, à sa largeur, à la cote de l'axe plus le dévers */
        function rdEdgePt(q, sg) { const M = mmToWorld(1000), w = sg > 0 ? q.wl : q.wr, d = sg > 0 ? q.dl : q.dr; return { x: q.x + q.ty * w * M * sg, y: q.y - q.tx * w * M * sg, z: Math.round(q.z + w * d * 10) }; }
        /* refaire la route d'un axe : bords (lignes de rupture), points du terrain de la chaussée mis de côté */
        function rdBuild(ax) { const R = ax.rdAx, id = R.id, M = mmToWorld(1000);
            shapes = shapes.filter(x => x.rdOf !== id); if (R.rm && R.rm.length) { shapes.push(...R.rm); R.rm = []; }   /* l'ancienne route rendue au terrain */
            tinCache = null; invalidateCache(); const tin = getTIN(); R.sig = rdSig(ax); const A = rdValues(ax, rdAxis(ax), tin);
            if (!A.D.some(q => hasZ(q.z))) { R.sig = null; return { ok: false, len: A.L, msg: 'ROUTE : pas de terrain sous l\'axe pour caler son profil (importez ou levez le terrain d\'abord) ; l\'axe est gardé, la route se fera quand le terrain sera là.' }; }   /* refaite à la prochaine étape : dès qu'il y a du terrain */
            const E = A.D.filter(q => hasZ(q.z)), lay = ensureLayer('Routes — bords', '#a8a29e'), wMax = Math.max(...E.map(q => Math.max(q.wl, q.wr)));
            const keep = (q, i, a) => i === 0 || i === a.length - 1 || A.pr.some(p => Math.abs(p.s - q.s) < 1e-3) || i % 2 === 0;
            [1, -1].forEach(sg => { const Q = E.filter(keep).map(q => rdEdgePt(q, sg)); if (Q.length > 1) shapes.push({ type: 'poly', open: true, layerId: lay, points: Q, hatch: false, rdOf: id, road: { w: Math.round(2 * wMax * 100) / 100, rid: id }, name: 'Bord de chaussée' }); });
            const inB = bandTest([{ D: E, h: (wMax + 0.8) * M }]), out = []; shapes = shapes.filter(x => { if (x.type === 'point' && !x.rdOf && hasZ(x.z) && /^TN/i.test(x.code || 'TN') && inB(x.x, x.y)) { out.push(x); return false; } return true; }); R.rm = out; const e0 = shapes.find(x => x.rdOf === id); if (e0) e0.rdRm = out.map(x => Object.assign({}, x));   /* gardés aussi sur un bord : rendus si l'axe est effacé */
            const z = E.map(q => q.z), zmin = Math.min(...z), zmax = Math.max(...z), pmax = E.reduce((m, q, i) => i ? Math.max(m, Math.abs(q.z - E[i - 1].z) / 10 / ((q.s - E[i - 1].s) || 1)) : m, 0);
            tinCache = null; invalidateCache(); RD_GEO.delete(id);
            return { ok: true, len: A.L, msg: 'ROUTE : ' + nfr(A.L, 1) + ' m, ' + A.pr.length + ' profils en travers (un par sommet), de ' + nfr(zmin / 1000, 2) + ' à ' + nfr(zmax / 1000, 2) + ' m, pente maxi ' + nfr(pmax, 1) + ' % ; bords en lignes de rupture du terrain' + (out.length ? ', ' + out.length + ' point(s) du terrain dans la chaussée mis de côté' : '') + '.' }; }
        /* à chaque étape : une route dont l'axe a bougé (poignées, déplacement, Y) est refaite ; une route dont l'axe a disparu aussi */
        function rdSync() { const A = shapes.filter(x => x.rdAx && x.type === 'poly' && x.points && x.points.length > 1), ids = new Set(A.map(x => x.rdAx.id)); let ch = false;
            if (shapes.some(x => x.rdOf && !ids.has(x.rdOf))) { const back = []; shapes = shapes.filter(x => { if (x.rdOf && !ids.has(x.rdOf)) { if (x.rdRm) back.push(...x.rdRm); return false; } return true; }); shapes.push(...back); ch = true; }
            A.forEach(ax => { if (ax.rdAx.sig !== rdSig(ax)) { rdBuild(ax); ch = true; } });
            if (ch) { tinCache = null; invalidateCache(); } return ch; }
        /* profils de l'axe, à jour (mis en cache tant que l'axe ne change pas) : pour le dessin, le clic et la fenêtre Y */
        const RD_GEO = new Map();
        function rdGeo(ax) { const sg = rdSig(ax), c = RD_GEO.get(ax.rdAx.id); if (c && c.sig === sg) return c.A; let tin = null; try { tin = getTIN(); } catch (e) {} const A = rdValues(ax, rdAxis(ax), tin); RD_GEO.set(ax.rdAx.id, { sig: sg, A }); return A; }
        /* plan : les profils en travers en traits fins d'un bord à l'autre (l'échelle), le profil choisi en surbrillance, son numéro */
        function drawRoadProf2D(c, s, col, dx, dy, ls) { let A; try { A = rdGeo(s); } catch (e) { return; } c.save(); c.setLineDash([]);
            A.pr.forEach((p, i) => { const a = rdEdgePt(p, 1), b = rdEdgePt(p, -1), on = rdPick && rdPick.id === s.rdAx.id && rdPick.key === p.key; c.strokeStyle = on ? '#ec4899' : p.set ? '#fbbf24' : col; c.globalAlpha = on || p.set ? 1 : 0.7; c.lineWidth = (on ? 2.5 : 1) / ls;
                c.beginPath(); c.moveTo(a.x + dx, a.y + dy); c.lineTo(b.x + dx, b.y + dy); c.stroke();
                { c.globalAlpha = 1; c.fillStyle = on ? '#ec4899' : '#fbbf24'; c.font = (10 / ls) + 'px Arial'; c.textAlign = 'left'; c.fillText('P' + (i + 1), a.x + dx + 4 / ls, a.y + dy - 4 / ls); } });
            c.restore(); }
        /* clic près d'un profil : l'axe est choisi, ce profil aussi (Y le montre en tête) */
        function rdPrAt(wx, wy) { const tol = 6 / camera.zoom; let best = null; shapes.forEach(s => { if (!s.rdAx || s.type !== 'poly' || (typeof isShapeVisible === 'function' && !isShapeVisible(s))) return; let A; try { A = rdGeo(s); } catch (e) { return; }
                A.pr.forEach(p => { const a = rdEdgePt(p, 1), b = rdEdgePt(p, -1), d = t2SegDist({ x: wx, y: wy }, a, b); if (d < tol && (!best || d < best.d)) best = { d, s, key: p.key }; }); });
            if (!best) return null; rdPick = { id: best.s.rdAx.id, key: best.key }; return best.s; }
        /* volet : largeur, profil en long, écartement (avant le tracé : réglages par défaut ; sur un axe sélectionné : les siens) */
        let rdEdit = null;
        function rdFormHTML(R) { return `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><span>Largeur de chaussée</span><span>${t2Inp('rd-w', R.w, 70, '')} m</span></div>
                <div style="margin-top:6px">Profil en long</div>${vSeg([['lisse', 'lissé sur le terrain'], ['tn', 'collé au terrain']], R.prof, "rdSet('prof','$')")}`; }
        function rdPanel(sh) { rdEdit = sh || null; const R = rdEdit ? rdEdit.rdAx : rdOpt, close = "t2PanelClose();rdEdit=null;rdDraw=false;setMode('select-box');draw()";
            t2Panel('🛣 Route', rdFormHTML(R) + (rdEdit ? '' : t2Note('Tracez l\'axe : un sommet à chaque clic, Espace ou double-clic pour finir. Chaque sommet est un profil en travers (P1, P2…) ; il se règle ensuite (Y sur l\'axe) : cote Z, largeurs gauche et droite, dévers. Un sommet ajouté (poignée +) ajoute un profil.')), [['Terminer', close, true]], close);
            const e = document.getElementById('rd-w'); if (e) e.onchange = () => rdSet('w', e.value); }
        function rdSet(k, v) { const R = rdEdit && shapes.includes(rdEdit) ? rdEdit.rdAx : rdOpt; if (k === 'w') { const n = t2Num(v); if (!(n >= 1 && n <= 40)) return; R[k] = Math.round(n * 100) / 100; } else R[k] = v;
            if (R === rdOpt) rdSaveOpt(); else { const r = rdBuild(rdEdit); saveState(); updateCommandMessageText(r.msg); draw(); if (is3DOpen()) { build3DScene(); render3D(); } } rdPanel(rdEdit); }
        /* fenêtre Y de l'axe : réglages d'ensemble, puis un tableau des profils (vide = automatique ; le profil cliqué en tête et en surbrillance) */
        function rdYHTML(one) { const R = one.rdAx, A = rdGeo(one), fz = (v) => hasZ(v) ? nfr(v / 1000, 2) : '', inp = (id, v, ph) => `<input id="${id}" class="mf-in" style="width:4.2rem" value="${MF.esc(v)}" placeholder="${MF.esc(ph)}">`;
            const rows = A.pr.map((p, i) => { const o = p.o, on = rdPick && rdPick.id === R.id && rdPick.key === p.key;
                return `<tr data-k="${p.key}" style="${on ? 'background:rgba(236,72,153,.18)' : ''}"><td style="padding:2px 4px;white-space:nowrap">P${i + 1}<span style="color:#9ca3af"> · ${nfr(p.s, 1)} m</span></td><td>${inp('rd-pz-' + i, hasZ(o.z) ? fz(o.z) : '', fz(p.z))}</td><td>${inp('rd-pwl-' + i, o.wl > 0 ? nfr(o.wl, 2) : '', nfr(p.wl, 2))}</td><td>${inp('rd-pwr-' + i, o.wr > 0 ? nfr(o.wr, 2) : '', nfr(p.wr, 2))}</td><td>${inp('rd-pdl-' + i, isFinite(o.dl) ? nfr(o.dl, 2) : '', nfr(p.dl, 2))}</td><td>${inp('rd-pdr-' + i, isFinite(o.dr) ? nfr(o.dr, 2) : '', nfr(p.dr, 2))}</td></tr>`; }).join('');
            return `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><span>Largeur par défaut</span><span>${t2Inp('rd-w', R.w, 70, '')} m</span><span>Profil en long</span><select id="rd-prof" class="mf-in mf-sel"><option value="lisse"${R.prof !== 'tn' ? ' selected' : ''}>lissé sur le terrain</option><option value="tn"${R.prof === 'tn' ? ' selected' : ''}>collé au terrain</option></select></div>
                <div style="margin-top:8px;max-height:320px;overflow:auto"><table id="rd-tab" style="border-collapse:collapse;font-size:12px"><tr style="color:#9ca3af"><th style="text-align:left">Profil</th><th>Z axe (m)</th><th>Larg. G (m)</th><th>Larg. D (m)</th><th>Dévers G (%)</th><th>Dévers D (%)</th></tr>${rows}</table></div>`
                + MF.hint('Un profil par sommet de l\'axe, P1 au premier sommet tracé. Case vide = automatique (en gris) : le Z suit le terrain, la largeur est celle par défaut, chaussée plate. Gauche et droite dans le sens du tracé. Dévers : pente de l\'axe vers le bord, négatif = le bord descend. Entre deux profils, tout varie en ligne droite. Poignées : déplacer un sommet, + pour en ajouter un (un profil de plus).'); }
        function rdApplyY(one) { const R = one.rdAx, n = (id) => { const e = document.getElementById(id); return e ? t2Num(e.value) : NaN; }, w = n('rd-w'); if (w >= 1 && w <= 40) R.w = Math.round(w * 100) / 100;
            const pe = document.getElementById('rd-prof'); if (pe) R.prof = pe.value === 'tn' ? 'tn' : 'lisse';
            const tab = document.getElementById('rd-tab'); if (!tab) return; [...tab.querySelectorAll('tr[data-k]')].forEach((tr, i) => { const q = one.points[+tr.getAttribute('data-k')]; if (!q) return; const o = {}, z = n('rd-pz-' + i), wl = n('rd-pwl-' + i), wr = n('rd-pwr-' + i), dl = n('rd-pdl-' + i), dr = n('rd-pdr-' + i);
                if (isFinite(z)) o.z = Math.round(z * 1000); if (wl > 0 && wl <= 40) o.wl = Math.round(wl * 100) / 100; if (wr > 0 && wr <= 40) o.wr = Math.round(wr * 100) / 100; if (isFinite(dl) && Math.abs(dl) <= 30) o.dl = Math.round(dl * 100) / 100; if (isFinite(dr) && Math.abs(dr) <= 30) o.dr = Math.round(dr * 100) / 100;
                if (Object.keys(o).length) q.rd = o; else delete q.rd; }); }
