        // DIMENSIONNELLEMENT EXACT : une cote de N mm doit mesurer N mm sur le papier.
        //
        // Démonstration : à l'impression, l'image offscreen (largeur rect.w*SS px) est
        // posée sur imgMm_w mm de papier (= drawW, surface intérieure du cadre).
        // Une cote de C mm vaut C*(GRID_SIZE/mmParCarré) px monde. Sur le papier :
        //   C_papier = C * (GRID_SIZE/mmParCarré) * camera.zoom * (imgMm_w / rect.w)
        // On veut C_papier = facteur * C, d'où :
        //   camera.zoom(1:1) = rect.w / (imgMm_w * GRID_SIZE/mmParCarré)
        function printBaseZoom() {
            // mm réels par carré de grille (toutes unités ramenées au mm)
            const mmPerSquare = currentUnit === 'mm' ? unitsPerSquare
                              : (currentUnit === 'cm' ? unitsPerSquare*10 : unitsPerSquare*1000);
            const pxMondePerMm = GRID_SIZE / mmPerSquare;
            const rect = getPrintRect();
            const imgMm_w = pageDims().drawW;   // l'image couvre toute la largeur intérieure du cadre
            return rect.w / (imgMm_w * pxMondePerMm);
        }

        // --- Fusion (groupes) ---
        // Chaque objet fusionné porte un groupId ; cliquer l'un d'eux sélectionne tout le groupe.
        function expandGroups(list) {
            const ids = new Set(list.filter(s => s.groupId).map(s => s.groupId));
            if (ids.size === 0) return list.slice();
            const out = list.slice();
            shapes.forEach(s => { if (s.groupId && ids.has(s.groupId) && !out.includes(s)) out.push(s); });
            return out;
        }
        function selectionHasGroup() { return selectedShapes.some(s => s.groupId); }
        function groupSelection() {
            if (selectedShapes.length < 2 || selectionHasGroup()) return;
            const gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            selectedShapes.forEach(s => { s.groupId = gid; });
            saveState(); draw();
            updateCommandMessageText(selectedShapes.length + " objets verrouillés en un bloc.");
        }
        function explodeOrUngroup() {
            if (selectionHasGroup()) { const n = selectedShapes.length; selectedShapes.forEach(s => { delete s.groupId; }); saveState(); draw(); updateCommandMessageText('ÉCLATER : bloc défait (' + n + ' objet(s) libres). Éclater encore décompose les rectangles et polylignes en droites.'); return; }
            explodeSelection();
        }
        function ungroupSelection() {
            if (!selectionHasGroup()) return;
            selectedShapes.forEach(s => { delete s.groupId; });
            saveState(); draw();
            updateCommandMessageText("Sélection défusionnée.");
        }
        // Active / grise les boutons Fusionner et Défusionner selon la sélection.
        function updateGroupButtons() {
            const hasGroup = selectionHasGroup();
            const canGroup = selectedShapes.length >= 2 && !hasGroup;
            const set = (id, on) => {
                const b = document.getElementById(id); if (!b) return;
                b.disabled = !on;
                b.classList.toggle('opacity-30', !on);
                b.classList.toggle('pointer-events-none', !on);
            };
            set('btn-group', canGroup);
            set('btn-ungroup', hasGroup || selectedShapes.some(x => x.type === 'poly' && !x.gen && !x.solid));
        }
        function isScaleMode() { return mode === 'scale-up' || mode === 'scale-down'; }
        // Saisie clavier de l'échelle : un nombre n => ×n (Agrandir) ou ÷n (Réduire).
        function applyScaleFromTyped() {
            if (selectedShapes.length === 0) return;
            const v = parseFloat(typedInput.trim());
            if (isNaN(v) || v <= 0) { updateCommandMessageText("ÉCHELLE : valeur invalide."); typedInput = ""; return; }
            const f = (mode === 'scale-down') ? 1 / v : v;
            // centre = point de base s'il est posé, sinon centre de la sélection
            let cx, cy;
            if (scaleCenter) { cx = scaleCenter.x; cy = scaleCenter.y; }
            else {
                let xs = [], ys = [];
                selectedShapes.forEach(s => {
                    if (s.points) s.points.forEach(p => { xs.push(p.x); ys.push(p.y); });
                    else if (s.type === 'line' || s.type === 'dim' || s.type === 'slope') { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); }
                    else if (s.type === 'point') { xs.push(s.x); ys.push(s.y); }
                    else if (s.vertex) { xs.push(s.vertex.x); ys.push(s.vertex.y); }
                    else if (s.type === 'detail') { xs.push(s.lx, s.tx); ys.push(s.ly, s.ty); }
                    else if (s.loops) s.loops.forEach(l => l.forEach(p => { xs.push(p.x); ys.push(p.y); }));
                    else { xs.push(s.x); ys.push(s.y); }
                });
                cx = (arrMin(xs) + arrMax(xs)) / 2; cy = (arrMin(ys) + arrMax(ys)) / 2;
            }
            selectedShapes.forEach(s => applyScaleToShape(s, cx, cy, f));
            isScalingObjects = false; scaleCenter = null; scaleRefDist = 0; typedInput = "";
            saveState(); draw();
        }
        // Affiche un message ponctuel dans la barre de commande (écrasé au prochain draw).
        // (le message reste affiché 4 s même si la souris bouge)
        let flashMsg = null, flashUntil = 0;
        function updateCommandMessageText(msg) {
            flashMsg = msg; flashUntil = Date.now() + 4000;
            const el = document.getElementById('command-text'); if (el) el.textContent = msg;
        }

        // Palettes d'outils réductibles (état mémorisé sur ce poste)
        function togglePal(id) {
            const p = document.querySelector('.pal[data-pal="' + id + '"]'); if (!p) return; p.classList.toggle('closed');
            const st = {}; document.querySelectorAll('.pal').forEach(x => { st[x.dataset.pal] = x.classList.contains('closed'); });
            try { localStorage.setItem('momocad-pal', JSON.stringify(st)); } catch (e) {}
        }
        function restorePal() { let st = {}; try { st = JSON.parse(localStorage.getItem('momocad-pal') || '{}'); } catch (e) {} document.querySelectorAll('.pal').forEach(x => x.classList.toggle('closed', !!st[x.dataset.pal]));
            const mo = document.querySelector('.pal[data-pal="model"]'); if (mo) mo.classList.add('closed'); }   // Bâtiment : réduite à chaque ouverture du logiciel
        function markActivePal() { document.querySelectorAll('.pal').forEach(x => x.classList.toggle('has-active', !!x.querySelector('.tool-btn.active'))); }
        // ---- Solides 3D : pavé (rectangle), cylindre / cône / sphère (cercle) + hauteur. Base = Z des sommets / du cercle ----
        const SOLID_NAMES = { box: 'Pavé', cyl: 'Cylindre', cone: 'Cône', sphere: 'Sphère', tube: 'Tube', tcone: 'Tronc de cône', pyr: 'Pyramide', torus: 'Tore', rev: 'Révolution', roof: 'Pan de toiture', beam: 'Poutre' };
        const SOLID_POLY = (k) => k === 'box' || k === 'pyr' || k === 'roof';   // solides posés sur un contour (les autres sur un cercle)
        let solidTool = null, solidBaseLen = 0;
        function startSolidTool(kind) {
            if (kind === 'roof') { const ok = selectedShapes.filter(x => !x.solid && !x.gen && x.type === 'poly' && !x.open && x.points.length >= 3 && !isPlateforme(x)); if (ok.length) { roofDialog(ok[0]); return; } }
            if (kind === 'pyr' || kind === 'roof') { const ok = selectedShapes.filter(x => !x.solid && !x.gen && x.type === 'poly' && !x.open && x.points.length >= 3 && !isPlateforme(x));   // contour déjà dessiné : il devient la base
                if (ok.length) { ok.forEach(x => { const c = polyCentroid(x.points), t = getTIN(), tz = t ? tinZ(c.x, c.y, t) : undefined, z0 = hasZ(x.points[0].z) ? x.points[0].z : hasZ(tz) ? tz : 0;
                        x.points.forEach(q => { q.z = z0; }); x.solid = kind === 'roof' ? { kind: 'roof', H: 0, p: 35, e: 200 } : { kind: 'pyr', H: 1000, k: 0 }; x.zk = 1; });
                    saveState(); selectedShapes = ok; draw(); if (ok.length === 1) setTimeout(openSelectionParamModal, 30); return; } }
            if (kind === 'dalle') {   // dalle : un pavé de 20 cm ; un contour fermé déjà sélectionné devient la dalle
                const ok = selectedShapes.filter(x => !x.solid && !x.gen && x.type === 'poly' && !x.open && x.points.length >= 3 && !isPlateforme(x));
                if (ok.length) { ok.forEach(x => { const z0 = hasZ(x.points[0].z) ? x.points[0].z : 0; x.points.forEach(q => { q.z = z0; }); x.solid = { kind: 'box', H: 200 }; x.zk = 1; x.name = 'Dalle'; }); saveState(); selectedShapes = ok; draw(); if (ok.length === 1) setTimeout(openSelectionParamModal, 30); return; }
                setMode('poly'); solidTool = 'box'; solidDalle = true; solidBaseLen = shapes.length;   // contour libre, point par point (une dalle n'est pas forcément rectangulaire)
                document.getElementById('btn-poly').classList.remove('active'); document.getElementById('btn-dalle').classList.add('active'); markActivePal();
                updateCommandMessage(); draw(); return;
            }
            const md = kind === 'beam' ? 'line' : kind === 'roof' ? 'poly' : SOLID_POLY(kind) ? 'rect' : 'circle';
            setMode(md); solidTool = kind; solidBaseLen = shapes.length;
            document.getElementById('btn-' + md).classList.remove('active');
            document.getElementById('btn-solid-' + kind).classList.add('active'); markActivePal(); updateCommandMessage(); draw();
        }
        // appelé par saveState : le dernier objet tracé avec un outil solide devient ce solide
        let solidDalle = false;
        // poteau : un clic = un pavé 20 × 20 cm centré, 2,50 m de haut (section, forme et hauteur avec Y)
        function startPoteau() { setMode('poteau'); document.getElementById('btn-poteau').classList.add('active'); markActivePal(); updateCommandMessageText('POTEAU : cliquez où le poser (centre). 20 × 20 cm, 2,50 m ; Y pour régler. Échap pour finir.'); }
        function poteauClick(w) {
            const sn = findSnap(w.x, w.y), c = sn || w, h = mmToWorld(100), t = getTIN(), tz = t ? tinZ(c.x, c.y, t) : undefined, z0 = hasZ(tz) ? tz : 0;
            const sh = { type: 'poly', layerId: activeLayerId, points: [[-h, -h], [h, -h], [h, h], [-h, h]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy, z: z0 })), solid: { kind: 'box', H: 2500 }, zk: 1, name: 'Poteau' };
            shapes.push(sh); saveState(); draw(); updateCommandMessageText('POTEAU posé. Cliquez le suivant, ou Échap ; Y sur un poteau pour sa section et sa hauteur.');
        }
        // ---- FONDATIONS : semelles filantes (sous les murs), semelles isolées (sous les poteaux), longrines (entre deux plots).
        //      Leur dessus est calé tout seul sous la dalle du RDC (la plus basse dalle au-dessus du point, sinon le RDC du bâtiment moins 20 cm, sinon le terrain),
        //      et suit si la dalle ou le RDC bougent. Béton, calque « Fondations ».
        const FOND_T = { filante: { nm: 'Semelle filante', l: 500, h: 400 }, isolee: { nm: 'Semelle isolée', l: 800, h: 400 }, longrine: { nm: 'Longrine', l: 250, h: 400 } };
        let fondTool = null, fondBase = 0, fondPick = { t: 'filante', l: 500, h: 400 };
        function fondDalles() { return shapes.filter(d => d.solid && d.solid.kind === 'box' && d.type === 'poly' && !d.fond && /dalle/i.test(d.name || '') && hasZ(solidBaseZ(d))); }
        // dessus d'une fondation en (x, y) : sous la dalle, sinon sous le RDC du bâtiment (contour suivi : tolérance 80 cm), sinon le terrain ; src 1 = calé sur le bâtiment
        function fondTopAt(x, y, D) { const tol = mmToWorld(800); let best = null;
            (D || fondDalles()).forEach(d => { if (!(pointInPolygon(x, y, d.points) || distToPoly(x, y, d.points) < tol)) return; const b = solidBaseZ(d); if (best === null || b < best) best = b; });
            if (best !== null) return { z: best, src: 1 };
            const Zs = typeof bldZones === 'function' ? bldZones().filter(z => pointInPolygon(x, y, z.points) || distToPoly(x, y, z.points) < tol) : [], Z = Zs.sort((a, b) => Math.abs(polyArea(a.points)) - Math.abs(polyArea(b.points)))[0], L = Z && Z.bld && (Z.bld.lvls || []).find(l => l.id === 'rdc'); if (L && hasZ(L.z)) return { z: L.z - 200, src: 1 };
            const G = lvlOn && (lvls || []).find(l => l.id === 'rdc'); if (G && hasZ(G.z)) return { z: G.z - 200, src: 1 };
            const t = getTIN(), tz = t ? tinZ(x, y, t) : null; return { z: hasZ(tz) ? tz : 0, src: 0 }; }
        function fondTopZ(x, y, D) { return fondTopAt(x, y, D).z; }
        function fondH(s) { return s.sweep ? +(s.sweep.d && s.sweep.d.h) || 400 : s.solid ? +s.solid.H || 400 : 400; }
        // fondation horizontale : un seul niveau pour tout le tracé (le plus bas des appuis sur le bâtiment, sinon le terrain le plus bas) ;
        // un Z de sommet changé à la main (Y) la sort du calage automatique
        function fondZs(s) { return s.type === 'line' ? [s.z1, s.z2] : s.points.map(q => q.z); }
        function fondSync(s, D) { if (!s.fond || s.fond.auto === false) return; const h = fondH(s);
            if (Array.isArray(s.fond.za)) { const z = fondZs(s); if (z.length === s.fond.za.length && z.some((v, i) => hasZ(v) && Math.abs(v - s.fond.za[i]) > 1)) { s.fond.auto = false; delete s.fond.za; return; } }
            const pts = s.type === 'line' ? [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }] : s.fond.t === 'isolee' ? [polyCentroid(s.points)] : s.points, T = pts.map(q => fondTopAt(q.x, q.y, D)), B = T.filter(t => t.src), z = Math.min(...(B.length ? B : T).map(t => t.z)) - h;
            if (s.type === 'line') { s.z1 = z; s.z2 = z; } else s.points.forEach(q => { q.z = z; });
            s.fond.za = fondZs(s); }
        function fondRecale(s) { s.fond.auto = true; delete s.fond.za; fondSync(s); saveState(); draw(); refresh3D(); updateCommandMessageText('Fondation recalée sous la dalle du RDC.'); }
        function fondSyncAll() { const F = shapes.filter(s => s.fond); if (!F.length) return; const D = fondDalles(); F.forEach(s => fondSync(s, D)); }
        function fondLayer() { return ensureLayer('Fondations', '#a8a29e'); }
        function fondPanel() { const P = fondPick;
            const lab = P.t === 'isolee' ? 'Côté' : 'Largeur', how = P.t === 'filante' ? 'Tracez l\'axe sous les murs, sommet par sommet ; Espace ou double-clic pour finir.' : P.t === 'isolee' ? 'Un clic par semelle (sur un poteau : centrée dessous). Poteaux sélectionnés : une semelle sous chacun.' : 'Deux clics, d\'un plot à l\'autre.';
            t2Panel('Fondations', `${vSeg(['filante', 'isolee', 'longrine'].map(k => [k, FOND_T[k].nm]), P.t, "fondSet('$')")}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>${lab} (cm)<input id="fd-l" type="text" value="${nfr(P.l / 10, 0)}" style="width:100%;margin-top:3px;background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:4px 6px"></label>
                <label>Hauteur (cm)<input id="fd-h" type="text" value="${nfr(P.h / 10, 0)}" style="width:100%;margin-top:3px;background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:4px 6px"></label></div>
                <div id="fd-svg">${fondSVG(P)}</div>
                <div style="color:#9ca3af;font-size:12px">${how}</div>${fondListHTML()}`, [['Tracer', 'fondGo()', true]]);
            ['fd-l', 'fd-h'].forEach(id => { const el = document.getElementById(id); if (el) el.oninput = () => { fondRead(); const v = document.getElementById('fd-svg'); if (v) v.innerHTML = fondSVG(fondPick); }; }); }
        // coupe de la fondation : semelle sous la dalle (ou le mur), cotes largeur × hauteur ; isolée : vue en plan en plus
        function fondSVG(P) { const W = 360, H = 190, l = Math.max(100, P.l), h = Math.max(100, P.h), k = Math.min(150 / l, 95 / h) * (P.t === 'longrine' ? 1.6 : 1), sw = l * k, sh = h * k, cx = P.t === 'isolee' ? 125 : W / 2, y0 = 62;
            let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;background:#111827;border:1px solid #374151;border-radius:8px">`;
            g += `<rect x="10" y="${y0 - 18}" width="${(P.t === 'isolee' ? 250 : W) - 20}" height="18" fill="#6b7280" fill-opacity=".35" stroke="#9ca3af" stroke-width="1"/><text x="16" y="${y0 - 5}" font-size="10" fill="#d1d5db">dalle du RDC</text>`;
            if (P.t !== 'longrine') g += `<rect x="${cx - 18}" y="${y0 - 44}" width="36" height="26" fill="#9ca3af" fill-opacity=".25" stroke="#9ca3af" stroke-width="1"/><text x="${cx}" y="${y0 - 27}" text-anchor="middle" font-size="9.5" fill="#9ca3af">${P.t === 'isolee' ? 'poteau' : 'mur'}</text>`;
            g += `<rect x="${cx - sw / 2}" y="${y0}" width="${sw}" height="${sh}" fill="#94a3b8" fill-opacity=".45" stroke="#e5e7eb" stroke-width="1.4"/>`;
            g += `<line x1="${cx - sw / 2}" x2="${cx + sw / 2}" y1="${y0 + sh + 12}" y2="${y0 + sh + 12}" stroke="#fbbf24"/><text x="${cx}" y="${y0 + sh + 25}" text-anchor="middle" font-size="11" fill="#fbbf24">${nfr(P.l / 10, 0)} cm</text>`;
            g += `<line x1="${cx + sw / 2 + 12}" x2="${cx + sw / 2 + 12}" y1="${y0}" y2="${y0 + sh}" stroke="#fbbf24"/><text x="${cx + sw / 2 + 17}" y="${y0 + sh / 2 + 4}" font-size="11" fill="#fbbf24">${nfr(P.h / 10, 0)} cm</text>`;
            g += `<text x="${cx - sw / 2 - 6}" y="${y0 + 13}" text-anchor="end" font-size="10" fill="#93c5fd">dessus ▸</text>`;
            if (P.t === 'isolee') { const q = Math.min(70, sw), X = 290, Y = 95; g += `<text x="${X}" y="34" text-anchor="middle" font-size="10" fill="#9ca3af">en plan</text><rect x="${X - q / 2}" y="${Y - q / 2}" width="${q}" height="${q}" fill="#94a3b8" fill-opacity=".45" stroke="#e5e7eb"/><rect x="${X - 8}" y="${Y - 8}" width="16" height="16" fill="#9ca3af" fill-opacity=".5"/><text x="${X}" y="${Y + q / 2 + 14}" text-anchor="middle" font-size="10.5" fill="#fbbf24">${nfr(P.l / 10, 0)} × ${nfr(P.l / 10, 0)}</text>`; }
            return g + `<text x="${W - 10}" y="${H - 8}" text-anchor="end" font-size="10" fill="#6b7280">${FOND_T[P.t].nm}</text></svg>`; }
        // fondations déjà posées : nombre, longueur, béton
        function fondListHTML() { const F = shapes.filter(x => x.fond); if (!F.length) return '';
            const R = {}; F.forEach(x => { const t = x.fond.t, d = x.sweep && x.sweep.d || {}, h = fondH(x) / 1000; let L = 0, V = 0;
                if (t === 'isolee') { const a = Math.abs(polyArea(x.points)) * Math.pow(mOf(1), 2); V = a * h; } else { L = shapeLengthM(x); V = L * ((+d.l || FOND_T[t].l) / 1000) * h; }
                const o = R[t] || (R[t] = { n: 0, L: 0, V: 0 }); o.n++; o.L += L; o.V += V; });
            const tot = Object.values(R).reduce((a, o) => a + o.V, 0), td = 'padding:3px 6px;text-align:right;white-space:nowrap';
            return `<div style="border-top:1px solid #374151;padding-top:8px;margin-top:2px"><div style="font-weight:600;color:#fff;margin-bottom:4px">Fondations posées</div><table style="width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums"><tr style="color:#9ca3af"><th style="text-align:left;padding:3px 6px;font-weight:500">Type</th><th style="${td};font-weight:500">Nb</th><th style="${td};font-weight:500">Longueur</th><th style="${td};font-weight:500">Béton</th></tr>`
                + ['filante', 'isolee', 'longrine'].filter(t => R[t]).map(t => `<tr style="border-top:1px solid #374151"><td style="padding:3px 6px">${FOND_T[t].nm}</td><td style="${td}">${R[t].n}</td><td style="${td}">${t === 'isolee' ? '—' : nfr(R[t].L, 2) + ' m'}</td><td style="${td}">${nfr(R[t].V, 2)} m³</td></tr>`).join('')
                + `<tr style="border-top:2px solid #6b7280;font-weight:700"><td style="padding:3px 6px">Total</td><td style="${td}">${F.length}</td><td></td><td style="${td};color:#93c5fd">${nfr(tot, 2)} m³</td></tr></table></div>`; }
        function fondSet(t) { fondRead(); fondPick.t = t; fondPick.l = FOND_T[t].l; fondPick.h = FOND_T[t].h; fondPanel(); }
        function fondRead() { const l = t2Num((document.getElementById('fd-l') || {}).value), h = t2Num((document.getElementById('fd-h') || {}).value); if (l > 0) fondPick.l = l * 10; if (h > 0) fondPick.h = h * 10; }
        function startFond() { closeFileMenus(); setMode('select-box'); const b = document.getElementById('btn-fond'); if (b) b.classList.add('active'); fondPanel();
            updateCommandMessageText('FONDATIONS : choisissez le type et ses dimensions, puis Tracer.'); }
        function fondMake(s, t) { s.fond = { t, auto: true }; s.layerId = fondLayer(); s.zk = 1; s.name = FOND_T[t].nm; s.mat = 'beton'; }
        function fondGo() { fondRead(); t2PanelClose(); const P = Object.assign({}, fondPick);
            if (P.t === 'isolee') { const pots = selectedShapes.filter(s => s.solid && s.solid.kind === 'box' && s.type === 'poly' && /poteau/i.test(s.name || ''));
                if (pots.length) { const out = pots.map(p => fondIsolee(polyCentroid(p.points), P)); saveState(); selectedShapes = out; draw(); updateCommandMessageText('FONDATIONS : ' + out.length + ' semelle(s) isolée(s) sous les poteaux sélectionnés.'); return; } }
            fondTool = P; fondBase = shapes.length;
            if (P.t === 'isolee') { setMode('fond'); fondTool = P; updateCommandMessageText('SEMELLE ISOLÉE : cliquez où la poser (sur un poteau : centrée dessous). Échap pour finir.'); }
            else { setMode(P.t === 'filante' ? 'pline' : 'line'); fondTool = P; fondBase = shapes.length; updateCommandMessageText(P.t === 'filante' ? 'SEMELLE FILANTE : cliquez l\'axe sous les murs ; Espace ou double-clic pour finir.' : 'LONGRINE : deux clics, d\'un plot à l\'autre.'); }
            const b = document.getElementById('btn-fond'); if (b) b.classList.add('active'); draw(); }
        function fondIsolee(c, P) { const h = mmToWorld(P.l / 2), sh = { type: 'poly', points: [[-h, -h], [h, -h], [h, h], [-h, h]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy, z: 0 })), solid: { kind: 'box', H: P.h } };
            fondMake(sh, 'isolee'); shapes.push(sh); fondSync(sh); return sh; }
        function fondClick(w) { const P = fondTool; if (!P) return; const pot = shapes.find(s => s.solid && s.solid.kind === 'box' && s.type === 'poly' && /poteau/i.test(s.name || '') && pointInPolygon(w.x, w.y, s.points));
            const sn = findSnap(w.x, w.y), c = pot ? polyCentroid(pot.points) : (sn || w); fondIsolee(c, P); fondBase = shapes.length; saveState(); draw();
            updateCommandMessageText('SEMELLE ISOLÉE posée' + (pot ? ' sous le poteau' : '') + '. Cliquez la suivante, ou Échap ; Y pour la régler.'); }
        // appelé par saveState : le tracé fini devient la semelle filante ou la longrine (balayage d'un profil béton rectangulaire, dessus sous la dalle)
        function fondTagNew() { const P = fondTool; if (!P || P.t === 'isolee' || shapes.length <= fondBase) return; const sh = shapes[shapes.length - 1]; fondBase = shapes.length;
            if (!sh || sh.fond || sh.sweep || !((P.t === 'filante' && (sh.type === 'poly' || sh.type === 'line')) || (P.t === 'longrine' && sh.type === 'line'))) return;
            sh.sweep = Object.assign(sweepDefault(P.t === 'longrine' ? 'LG25' : 'SF50'), { d: { l: P.l, h: P.h }, al: 'axe', ref: 'bas', zs: 'trace' }); fondMake(sh, P.t); fondSync(sh);
            updateCommandMessageText((P.t === 'filante' ? 'SEMELLE FILANTE' : 'LONGRINE') + ' posée : ' + nfr(P.l / 10, 0) + ' × ' + nfr(P.h / 10, 0) + ' cm, dessus sous la dalle du RDC. Tracez la suivante, ou Échap.'); }
        function tagNewSolid() {
            if (!solidTool) return; const sh = shapes[shapes.length - 1];
            if (solidTool === 'beam' && shapes.length > solidBaseLen && sh && sh.type === 'line' && !sh.sweep) {   // poutre : la droite tracée devient l'axe d'une poutre
                const t = getTIN(), tz = t ? tinZ(sh.x1, sh.y1, t) : undefined, zg = hasZ(tz) ? tz : 0;
                const LV = lvlCur(); if (LV) { sh.z1 = LV.z + LV.h; sh.z2 = LV.z + LV.h; }   // sur un étage : la poutre sous le plancher du dessus
                else if (!hasZ(sh.z1) && !hasZ(sh.z2)) { sh.z1 = zg + 2500; sh.z2 = zg + 2500; } else { if (!hasZ(sh.z1)) sh.z1 = sh.z2; if (!hasZ(sh.z2)) sh.z2 = sh.z1; }
                sh.sweep = Object.assign(sweepDefault(lastBeamPreset), { perp: true, al: 'axe', ref: 'axe', zs: 'trace' }); sh.zk = 1; if (!sh.name) sh.name = 'Poutre';
                const sh2 = sh; setTimeout(() => { selectedShapes = [sh2]; draw(); openSelectionParamModal(); }, 30);
                solidBaseLen = shapes.length; return;
            }
            if (solidTool === 'roof' && shapes.length > solidBaseLen && sh && !sh.solid && sh.type === 'poly') { const sh2 = sh; solidBaseLen = shapes.length; setTimeout(() => roofDialog(sh2, true), 30); return; }
            if (shapes.length > solidBaseLen && sh && !sh.solid && solidTool !== 'beam' && ((SOLID_POLY(solidTool) && sh.type === 'poly') || (!SOLID_POLY(solidTool) && sh.type === 'circle'))) {
                const c = sh.type === 'circle' ? sh : polyCentroid(sh.points), tz = getTIN() ? tinZ(c.x, c.y, getTIN()) : undefined;
                // sur un étage : posé sur son plancher (une dalle a son dessus au plancher)
                const LV = lvlCur(), base = sh.type === 'circle' ? sh.z : sh.points[0].z, z0 = LV ? LV.z - (solidDalle && solidTool === 'box' ? 200 : 0) : hasZ(base) ? base : hasZ(tz) ? tz : 0;
                if (sh.type === 'circle') sh.z = z0; else sh.points.forEach(q => { q.z = z0; });
                sh.solid = { kind: solidTool, H: solidTool === 'sphere' || solidTool === 'torus' ? 0 : 1000 }; sh.zk = 1;
                if (solidDalle && solidTool === 'box') { sh.solid.H = 200; sh.name = 'Dalle'; }
                const rmm = sh.type === 'circle' ? worldToMm(sh.r) : 0;
                if (solidTool === 'tube') sh.solid.e = Math.max(10, Math.round(rmm * 0.15));
                if (solidTool === 'tcone') sh.solid.r2 = Math.round(rmm / 2);
                if (solidTool === 'pyr') sh.solid.k = 0;
                if (solidTool === 'roof') { sh.solid.p = 35; sh.solid.e = 200; sh.solid.H = 0; }
                if (solidTool === 'torus') sh.solid.a = Math.max(10, Math.round(rmm * 0.2));
                const sh2 = sh, dl = solidDalle; setTimeout(() => { selectedShapes = [sh2]; draw(); if (dl) updateCommandMessageText('DALLE posée (épaisseur 0,20). Tracez la suivante, ou Échap ; Y pour régler épaisseur et altitude.'); else openSelectionParamModal(); }, 30);
            }
            solidBaseLen = shapes.length;
        }

