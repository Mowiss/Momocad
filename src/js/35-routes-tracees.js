        // ROUTES TRACÉES : on trace l'axe (polyligne), la route se fait comme celles de la génération automatique : profil en long calé sur le terrain
        //      (lissé ou non), chaussée plate en travers, ses deux bords en lignes de rupture du terrain, enrobé en plan et en 3D ; les points du terrain
        //      tombés dans la chaussée sont mis de côté (rendus si la route bouge ou disparaît). L'axe reste éditable : la route suit (poignées, Y).
        let rdDraw = false;
        const rdOpt = (() => { let o = {}; try { o = JSON.parse(localStorage.getItem('momocad-road') || '{}') || {}; } catch (e) {} return Object.assign({ w: 5, prof: 'lisse' }, o); })();
        function rdSaveOpt() { try { localStorage.setItem('momocad-road', JSON.stringify(rdOpt)); } catch (e) {} }
        function startRoad() { closeFileMenus(); setMode('pline'); rdDraw = true; rdPanel(null); updateCommandMessageText('ROUTE : cliquez les sommets de l\'axe, Espace ou double-clic pour finir. Largeur ' + nfr(rdOpt.w, 2) + ' m (volet à droite).'); draw(); }
        function rdMake(P) { const s = { type: 'poly', open: true, layerId: ensureLayer('Routes — axes', '#fbbf24'), points: P.map(q => ({ x: q.x, y: q.y })), hatch: false, dash: 'dashdot', name: 'Axe de route', rdAx: { id: 'rd' + generateId(), w: rdOpt.w, prof: rdOpt.prof } };
            shapes.push(s); const r = rdBuild(s); return { s, r }; }
        const rdSig = (s) => s.points.map(q => Math.round(q.x) + ',' + Math.round(q.y)).join(';') + '|' + s.rdAx.w + '|' + s.rdAx.prof;
        /* refaire la route d'un axe : bords (lignes de rupture), points du terrain de la chaussée mis de côté */
        function rdBuild(ax) { const R = ax.rdAx, id = R.id, M = mmToWorld(1000);
            shapes = shapes.filter(x => x.rdOf !== id); if (R.rm && R.rm.length) { shapes.push(...R.rm); R.rm = []; }   /* l'ancienne route rendue au terrain */
            tinCache = null; invalidateCache(); const tin = getTIN(), P = ax.points; R.sig = rdSig(ax);
            const D = []; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], c = P[i + 1], l = Math.hypot(c.x - a.x, c.y - a.y), m = Math.max(1, Math.ceil(l / (2 * M))); for (let k = 0; k < m; k++) D.push({ x: a.x + (c.x - a.x) * k / m, y: a.y + (c.y - a.y) * k / m }); } D.push({ x: P[P.length - 1].x, y: P[P.length - 1].y });
            let s = 0; D.forEach((q, i) => { if (i) s += Math.hypot(q.x - D[i - 1].x, q.y - D[i - 1].y) / M; q.s = s; q.z0 = tin ? tinZ(q.x, q.y, tin) : null; });
            if (!D.some(q => hasZ(q.z0))) { R.sig = null; return { ok: false, len: s, msg: 'ROUTE : pas de terrain sous l\'axe pour caler son profil (importez ou levez le terrain d\'abord) ; l\'axe est gardé, la route se fera quand le terrain sera là.' }; }   /* refaite à la prochaine étape : dès qu'il y a du terrain */
            if (R.prof === 'tn') D.forEach(q => { q.z = q.z0; }); else smooth6(D, 'z');
            const E = D.filter(q => hasZ(q.z)), h = R.w / 2 * M, lay = ensureLayer('Routes — bords', '#a8a29e');
            const edge = (sg) => { const out = []; E.forEach((q, i) => { const a = E[Math.max(0, i - 1)], c = E[Math.min(E.length - 1, i + 1)], l = Math.hypot(c.x - a.x, c.y - a.y) || 1; out.push({ x: q.x - (c.y - a.y) / l * h * sg, y: q.y + (c.x - a.x) / l * h * sg, z: Math.round(q.z) }); });
                return out.filter((q, i) => i === 0 || i === out.length - 1 || i % 2 === 0); };
            [1, -1].forEach(sg => { const Q = edge(sg); if (Q.length > 1) shapes.push({ type: 'poly', open: true, layerId: lay, points: Q, hatch: false, rdOf: id, road: { w: R.w, rid: id }, name: 'Bord de chaussée' }); });
            const inB = bandTest([{ D: E, h: h + 0.8 * M }]), out = []; shapes = shapes.filter(x => { if (x.type === 'point' && !x.rdOf && hasZ(x.z) && /^TN/i.test(x.code || 'TN') && inB(x.x, x.y)) { out.push(x); return false; } return true; }); R.rm = out; const e0 = shapes.find(x => x.rdOf === id); if (e0) e0.rdRm = out.map(x => Object.assign({}, x));   /* gardés aussi sur un bord : rendus si l'axe est effacé */
            const z = E.map(q => q.z), zmin = Math.min(...z), zmax = Math.max(...z), pmax = E.reduce((m, q, i) => i ? Math.max(m, Math.abs(q.z - E[i - 1].z) / 10 / ((q.s - E[i - 1].s) || 1)) : m, 0);
            tinCache = null; invalidateCache();
            return { ok: true, len: s, msg: 'ROUTE : ' + nfr(s, 1) + ' m, chaussée de ' + nfr(R.w, 2) + ' m, de ' + nfr(zmin / 1000, 2) + ' à ' + nfr(zmax / 1000, 2) + ' m, pente maxi ' + nfr(pmax, 1) + ' % ; bords en lignes de rupture du terrain' + (out.length ? ', ' + out.length + ' point(s) du terrain dans la chaussée mis de côté' : '') + '.' }; }
        /* à chaque étape : une route dont l'axe a bougé (poignées, déplacement, Y) est refaite ; une route dont l'axe a disparu aussi */
        function rdSync() { const A = shapes.filter(x => x.rdAx && x.type === 'poly' && x.points && x.points.length > 1), ids = new Set(A.map(x => x.rdAx.id)); let ch = false;
            if (shapes.some(x => x.rdOf && !ids.has(x.rdOf))) { const back = []; shapes = shapes.filter(x => { if (x.rdOf && !ids.has(x.rdOf)) { if (x.rdRm) back.push(...x.rdRm); return false; } return true; }); shapes.push(...back); ch = true; }
            A.forEach(ax => { if (ax.rdAx.sig !== rdSig(ax)) { rdBuild(ax); ch = true; } });
            if (ch) { tinCache = null; invalidateCache(); } return ch; }
        /* volet : largeur et profil (avant le tracé : réglages par défaut ; sur un axe sélectionné : les siens) */
        let rdEdit = null;
        function rdFormHTML(R) { return `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center"><span>Largeur de chaussée</span><span>${t2Inp('rd-w', R.w, 70, '')} m</span></div>
                <div style="margin-top:6px">Profil en long</div>${vSeg([['lisse', 'lissé sur le terrain'], ['tn', 'collé au terrain']], R.prof, "rdSet('prof','$')")}`; }
        function rdPanel(sh) { rdEdit = sh || null; const R = rdEdit ? rdEdit.rdAx : rdOpt, close = "t2PanelClose();rdEdit=null;rdDraw=false;setMode('select-box');draw()";
            t2Panel('🛣 Route', rdFormHTML(R) + (rdEdit ? '' : t2Note('Tracez l\'axe de la route : un sommet à chaque clic, Espace ou double-clic pour finir. La chaussée est plate en travers, ses bords deviennent des lignes de rupture du terrain.')), [['Terminer', close, true]], close);
            const e = document.getElementById('rd-w'); if (e) e.onchange = () => rdSet('w', e.value); }
        function rdSet(k, v) { const R = rdEdit && shapes.includes(rdEdit) ? rdEdit.rdAx : rdOpt; if (k === 'w') { const n = t2Num(v); if (!(n >= 1 && n <= 40)) return; R.w = Math.round(n * 100) / 100; } else R[k] = v;
            if (R === rdOpt) rdSaveOpt(); else { const r = rdBuild(rdEdit); saveState(); updateCommandMessageText(r.msg); draw(); if (is3DOpen()) { build3DScene(); render3D(); } } rdPanel(rdEdit); }
        function rdApplyY(one) { const e = document.getElementById('rd-w'); if (!e) return; const n = t2Num(e.value); if (n >= 1 && n <= 40) one.rdAx.w = Math.round(n * 100) / 100; }
