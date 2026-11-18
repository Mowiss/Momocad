        // ---- ÉTAGES : niveaux du bâtiment (sous-sols, RDC, étages, toit). Outil actif : on voit l'étage choisi et tout ce qui est dessous ----
        // lvls : [{ id, z (altitude du plancher, mm), h (hauteur d'étage, mm), nm (nom choisi) }] rangés de bas en haut ; le toit est toujours au-dessus
        let lvls = null, lvlOn = false, lvlAct = 'rdc';
        // ---- CONTOURS DE BÂTIMENT : une polyligne fermée porte les niveaux de son bâtiment (s.bld = { id, nm, lvls, act }) ; plusieurs bâtiments à des altitudes différentes.
        // Ce qu'on dessine dans un contour prend ses niveaux (l'étage où l'on dessine, affiché sur la pastille du contour). lvls = les niveaux du bâtiment actif.
        let bldActId = null, lvlsGlobal = null;
        function bldZones() { return shapes.filter(s => s.bld && s.type === 'poly' && s.points && s.points.length >= 3); }
        function bldById(id) { return id ? bldZones().find(z => z.bld.id === id) || null : null; }
        function bldCur() { return bldById(bldActId); }
        function bldRep(s) { if (s.type === 'line' || s.type === 'slope') return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }; if ((s.type === 'circle' || s.type === 'text' || s.type === 'point') && isFinite(s.x)) return { x: s.x, y: s.y }; return shapeCenterOf(s); }
        function bldZoneAt(x, y) { const Z = bldZones().filter(z => pointInPolygon(x, y, z.points)); if (Z.length < 2) return Z[0] || null; return Z.sort((a, b) => Math.abs(polyArea(a.points)) - Math.abs(polyArea(b.points)))[0]; }
        // bâtiment d'un objet : celui qu'on lui a donné, sinon le contour où il se trouve
        function bldOfObj(s) { if (!s || s.bld) return null; if (s.bid) return bldById(s.bid); if (!bldZones().length) return null; const p = bldRep(s); return p ? bldZoneAt(p.x, p.y) : null; }
        // rend actif le bâtiment Z (null : hors bâtiment) ; l'étage montré est celui retenu pour ce bâtiment
        function bldActivate(Z, lvId) { if (!bldActId) lvlsGlobal = lvls; if (bldCur() && bldCur().bld) bldCur().bld.act = lvlAct;
            bldActId = Z ? Z.bld.id : null; lvls = Z ? Z.bld.lvls : lvlsGlobal; const want = lvId || (Z ? Z.bld.act : null) || 'rdc'; lvlAct = lvlList().some(L => L.id === want) ? want : 'rdc'; if (Z) Z.bld.act = lvlAct; }
        function bldMake(sh, nm, z, h) { if (!sh || sh.type !== 'poly' || sh.open) return null; const legacy = !bldZones().length && (bldActId ? lvlsGlobal : lvls);
            const L = legacy && legacy.length ? JSON.parse(JSON.stringify(legacy)) : [{ id: 'rdc', z: Math.round(z), h: Math.round(h) || 2800 }]; const R = L.find(x => x.id === 'rdc'); if (R && hasZ(z)) { R.z = Math.round(z); if (h > 0) R.h = Math.round(h); }
            sh.points.forEach(q => { delete q.z; }); delete sh.plat; delete sh.talus; delete sh.lvl; delete sh.bid; sh.bld = { id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), nm: nm || ('Bâtiment ' + String.fromCharCode(65 + bldZones().filter(x => x !== sh).length)), lvls: L, act: 'rdc' };
            // ce qui est déjà dessiné dedans lui appartient (avec son étage d'après l'altitude)
            shapes.forEach(o => { if (o === sh || o.bld || o.bid || isPlateforme(o) || isBg(o)) return; const p = bldRep(o); if (p && pointInPolygon(p.x, p.y, sh.points)) o.bid = sh.bld.id; });
            if (legacy && legacy.length) { if (bldActId) lvlsGlobal = null; else lvls = null; }
            bldActivate(sh, 'rdc'); lvlChain(); return sh; }
        // coupe de bâtiment illustrée (niveaux et hauteur d'étage) pour les volets Contour de bâtiment et Niveau
        function bldFig(hi) { const L = [['R+1', 14], ['RDC', 38], ['R-1', 62]]; return `<svg width="116" height="86" viewBox="0 0 116 86"><path d="M4 50h108" stroke="#65a30d" stroke-width="1.5" stroke-dasharray="4 3"/>`
            + L.map(([n, y], i) => `<rect x="18" y="${y}" width="56" height="22" fill="${n === hi ? '#1e3a5f' : '#1f2937'}" stroke="${n === hi ? '#60a5fa' : '#4b5563'}" stroke-width="${n === hi ? 1.6 : 1}"/><text x="46" y="${y + 15}" font-size="10" fill="${n === hi ? '#fff' : '#9ca3af'}" text-anchor="middle" font-family="sans-serif">${n}</text>`).join('')
            + `<path d="M84 38v22M80 42l4-5 4 5M80 56l4 5 4-5" fill="none" stroke="#fbbf24" stroke-width="1.4"/><text x="92" y="52" font-size="10" fill="#fbbf24" font-family="sans-serif">H</text><path d="M12 60h-8" stroke="#fbbf24"/><text x="2" y="58" font-size="8" fill="#fbbf24" font-family="sans-serif">0</text></svg>`; }
        function bldMakeAsk() { const sh = selectedShapes.length === 1 ? selectedShapes[0] : null; if (!sh || sh.type !== 'poly' || sh.open || sh.points.length < 3) { updateCommandMessageText('BÂTIMENT : sélectionnez une polyligne fermée (le contour du bâtiment).'); return; }
            const inp = (i, v) => `<input id="${i}" type="text" inputmode="decimal" value="${v}" style="width:110px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;text-align:right;outline:none">`, z0 = lvlGuessZ();
            openTopoModal('🏢 Contour de bâtiment', `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb">
                <div class="mf-fig">${bldFig('RDC')}<div class="mf-hint" style="margin:0">Ce contour porte les niveaux du bâtiment : ce que tu dessines dedans prend ses niveaux (un mur va du plancher de l'étage au plancher + H). La pastille du contour montre l'étage où l'on dessine ; <kbd>Y</kbd> sur le contour pour changer d'étage, en ajouter, régler les hauteurs.</div></div>
                ${MF.row('Nom', MF.txt('bd-nm', '', 'Bâtiment ' + String.fromCharCode(65 + bldZones().length)), '')}
                ${MF.row('Cote du RDC <span class="mf-hint">(le zéro du bâtiment)</span>', MF.num('bd-z', nfr(z0 / 1000, 2).replace(/\s/g, '')), 'm')}
                ${MF.row('Hauteur du RDC (H)', MF.num('bd-h', '2,80'), 'm')}</div>`,
                [['Annuler', () => closeTopoModal(), false], ['Créer', () => { const z = t2Num(document.getElementById('bd-z').value), h = t2Num(document.getElementById('bd-h').value); if (!isFinite(z)) { alert('Donnez la cote du RDC.'); return; }
                    bldMake(sh, document.getElementById('bd-nm').value.trim(), z * 1000, isFinite(h) && h > 0 ? h * 1000 : 2800); closeTopoModal(); saveState(); selectedShapes = [sh]; lvlRefresh(); openSelectionParamModal();
                    updateCommandMessageText('BÂTIMENT ' + sh.bld.nm + ' : RDC à ' + nfr(z, 2) + ' m. Ce que vous dessinez dedans va sur l\'étage de sa pastille ; Y sur le contour pour les étages.'); }, true]]); }
        function bldUnmake(id) { const Z = bldById(id); if (!Z) return; shapes.forEach(o => { if (o.bid === id) { delete o.bid; delete o.lvl; } }); if (bldActId === id) bldActivate(null); delete Z.bld; saveState(); closeSelectionParamModal(); lvlRefresh(); updateCommandMessageText('BÂTIMENT : ce contour redevient une simple polyligne (les objets gardent leurs altitudes).'); }
        // le bouton Contour de bâtiment : une polyligne fermée sélectionnée en devient un ; sinon on trace le contour, et à la fermeture on règle le bâtiment
        let bldDrawing = false, bldDrawBase = 0;
        function etaClick() { const one = selectedShapes.length === 1 ? selectedShapes[0] : null;
            if (one && one.bld) { bldOpen(one.bld.id); return; }
            if (one && one.type === 'poly' && !one.open && one.points.length >= 3) { bldMakeAsk(); return; }
            setMode('poly'); bldDrawing = true; bldDrawBase = shapes.length; updateCommandMessageText('CONTOUR DE BÂTIMENT : cliquez les angles du bâtiment, recliquez le 1er point pour fermer ; vous réglerez ensuite son nom, la cote du RDC et sa hauteur. (Ou sélectionnez d\'abord une polyligne fermée.)'); }
        function bldTagNew() { if (!bldDrawing || mode !== 'poly' || shapes.length <= bldDrawBase) return; const sh = shapes[shapes.length - 1]; if (!sh || sh.type !== 'poly' || sh.open || sh.bld) return;
            bldDrawing = false; setTimeout(() => { setMode('select-box'); selectedShapes = [sh]; draw(); bldMakeAsk(); }, 30); }
        // panneau Étages du contour (dans Y) : liste des niveaux de haut en bas, l'étage où l'on dessine, cote du RDC, hauteurs
        function bldPanelHTML(id) { return `<div id="bld-lv" data-id="${id}"></div>`; }
        function bldPanelDraw() { const box = document.getElementById('bld-lv'); if (!box) return; const Z = bldById(box.dataset.id); if (!Z) return; if (bldActId !== Z.bld.id) bldActivate(Z);
            const R = lvlRDC(), L = lvlSorted().slice().reverse(), inp = (v, js, w) => `<input type="text" inputmode="decimal" value="${v}" onchange="${js}" class="mf-in" style="width:${w || 4.2}rem">`;
            box.innerHTML = `<div class="mf-row"><span>Nom</span><input type="text" value="${MF.esc(Z.bld.nm || '')}" onchange="bldById('${Z.bld.id}').bld.nm=this.value.trim()||'Bâtiment';saveState();draw()" class="mf-in" style="width:9rem;text-align:left"></div>
                <div class="mf-row"><span>Cote du RDC (le zéro)</span>${inp(nfr(R.z / 1000, 2).replace(/\s/g, ''), "bldSetZ(this.value)", 5)}<span class="mf-u">m</span></div>
                <div class="mf-hint" style="margin:4px 0">Cliquez un niveau pour y dessiner (pastille du contour) ; les autres étages sont masqués sur le plan. Chaque étage est posé sur celui du dessous : on ne règle que les hauteurs H.</div>
                ${L.map(l => { const on = lvlOn && l.id === lvlAct; return `<div style="display:flex;gap:4px;align-items:center;margin-bottom:3px">
                    <button type="button" onclick="bldPick('${l.id}')" class="mf-in" style="width:7.2rem;text-align:left;font-weight:700;${on ? 'background:#b45309;border-color:#f59e0b;color:#fff' : (l.id === lvlAct ? 'border-color:#f59e0b' : '')}" title="Dessiner sur ce niveau">${on ? '✎ ' : ''}${MF.esc(lvlName(l))}</button>
                    <span style="width:3.6rem;text-align:right;color:#cbd5e1;font-size:12px">${lvlRel(l)}</span><span style="color:#9ca3af;font-size:11px">H</span>${inp(nfr(l.h / 1000, 2).replace(/\s/g, ''), "bldSetH('" + l.id + "',this.value)")}<span class="mf-u">m</span>
                    ${l.id === 'rdc' ? '<span style="width:24px"></span>' : `<button type="button" onclick="bldDelLvl('${l.id}')" title="Supprimer ce niveau" class="mf-in" style="width:24px;padding:0;color:#fca5a5">×</button>`}</div>`; }).join('')}
                <div style="display:flex;gap:6px;margin-top:4px"><button type="button" class="mf-btn" onclick="bldAdd(true)">+ Étage</button><button type="button" class="mf-btn" onclick="bldAdd(false)">+ Sous-sol</button><button type="button" class="mf-btn" onclick="bldAll()" title="Voir toute la maquette (la pastille reste sur l'étage où l'on dessine)" style="${lvlOn ? '' : 'background:#2563eb;color:#fff'}">Tout voir</button></div>`; }
        // nom d'un niveau d'un bâtiment donné (RDC, R + 1, S.S 1… ou son nom)
        function bldLvlName(Z, id) { const S = Z.bld.lvls.slice().sort((a, b) => a.z - b.z), L = S.find(x => x.id === id) || S.find(x => x.id === 'rdc'); if (!L) return 'RDC'; if (L.nm) return L.nm; const r = S.findIndex(x => x.id === 'rdc'), i = S.indexOf(L); return L.id === 'rdc' || r < 0 ? 'RDC' : i > r ? 'R + ' + (i - r) : 'S.S ' + (r - i); }
        // pastille de chaque contour de bâtiment, à son coin haut-gauche : l'étage où l'on dessine dedans ; un clic ouvre ses étages
        let bldBadgeHits = [];
        function drawBldBadges(c) { bldBadgeHits = []; const Z = bldZones(); if (!Z.length) return; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
            Z.forEach(z => { const l = layers.find(x => x.id === (z.layerId || 'layer-0')); if (l && l.visible === false) return; let q = z.points[0]; z.points.forEach(p => { if (p.y < q.y - 1e-9 || (Math.abs(p.y - q.y) < 1e-9 && p.x < q.x)) q = p; });
                const X = q.x * camera.zoom + camera.x, Y = q.y * camera.zoom + camera.y, act = z.bld.act || 'rdc', nm = bldLvlName(z, act), cur = bldActId === z.bld.id, sub = (z.bld.nm || 'Bâtiment') + (cur && lvlOn ? ' · vue ' + nm : '');
                c.font = 'bold 13px Arial'; const w1 = c.measureText(nm).width; c.font = '10px Arial'; const w2 = c.measureText(sub).width, w = Math.max(w1, w2) + 18, h = 32, x0 = X + 6, y0 = Y + 6;
                c.fillStyle = cur ? '#b45309' : '#1f2937'; c.strokeStyle = cur ? '#fde047' : '#f59e0b'; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(x0, y0, w, h, 9); else c.rect(x0, y0, w, h); c.fill(); c.stroke();
                c.fillStyle = '#fff'; c.font = 'bold 13px Arial'; c.textBaseline = 'top'; c.fillText(nm, x0 + 9, y0 + 3); c.fillStyle = '#fde68a'; c.font = '10px Arial'; c.fillText(sub, x0 + 9, y0 + 19);
                bldBadgeHits.push({ x0, y0, x1: x0 + w, y1: y0 + h, id: z.bld.id }); });
            c.restore(); }
        function bldBadgeAt(sx, sy) { return bldBadgeHits.find(b => sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1) || null; }
        function bldOpen(id) { const Z = bldById(id); if (!Z) return; bldActivate(Z); selectedShapes = [Z]; (window.spOpenState = window.spOpenState || {})['bldlv'] = true; openSelectionParamModal(); draw(); }
        function bldPick(id) { lvlOn = true; lvlMarkAll(); lvlAct = id; const Z = bldCur(); if (Z) Z.bld.act = id; bldPanelDraw(); lvlRefresh(); const L = lvlList().find(x => x.id === id); updateCommandMessageText('ÉTAGES — ' + (Z ? Z.bld.nm : '') + ' : ' + lvlName(L) + ' (plancher ' + lvlRel(L) + ', cote ' + nfr(L.z / 1000, 2) + ' m, H ' + nfr(L.h / 1000, 2) + ' m) : un mur dessiné dans le contour va de ' + lvlRel(L) + ' à ' + lvlRel({ z: L.z + L.h }) + ' ; les autres étages sont masqués sur le plan.'); }
        function bldAll() { lvlOn = false; bldPanelDraw(); lvlRefresh(); updateCommandMessageText('ÉTAGES : toute la maquette est visible ; ce que vous dessinez dans le contour va toujours sur l\'étage de sa pastille.'); }
        function bldSetZ(v) { const z = t2Num(v); if (!isFinite(z)) return; lvlSet('rdc', Math.round(z * 1000)); saveState(); bldPanelDraw(); lvlRefresh(); }
        function bldSetH(id, v) { const h = t2Num(v); if (!(h > 0)) return; lvlSet(id, undefined, Math.round(h * 1000)); saveState(); bldPanelDraw(); lvlRefresh(); }
        function bldAdd(up) { lvlAdd(up); bldPanelDraw(); }
        function bldDelLvl(id) { lvlAct = id; lvlDelAsk(); }
        const LVL_ROOF = { id: 'toit', roof: true };
        function lvlSorted() { return (lvls || []).slice().sort((a, b) => a.z - b.z); }
        function lvlList() { return lvlSorted().concat([LVL_ROOF]); }
        function lvlName(L) { if (L.roof) return 'TOIT'; if (L.nm) return L.nm; const S = lvlSorted(), r = S.findIndex(x => x.id === 'rdc'), i = S.indexOf(L); if (L.id === 'rdc' || r < 0) return 'RDC'; return i > r ? 'R + ' + (i - r) : 'S.S ' + (r - i); }
        function lvlGuessZ() { const w = shapes.filter(s => s.wz && hasZ(s.wz.b)).map(s => s.wz.b); if (w.length) return Math.min(...w);
            const p = shapes.filter(isPlateforme).map(s => platSurf(s).zp).filter(hasZ); if (p.length) return Math.max(...p); return hasZ(zCourant) ? zCourant : 0; }
        function lvlInit() { if (!lvls || !lvls.length) lvls = [{ id: 'rdc', z: Math.round(lvlGuessZ()), h: 2800 }]; if (!lvlList().some(L => L.id === lvlAct)) lvlAct = 'rdc'; }
        // le RDC est le zéro du bâtiment : seule sa cote est donnée ; chaque étage est posé sur celui du dessous (plancher = plancher du dessous + sa hauteur),
        // chaque sous-sol sous celui du dessus (plancher = plancher du dessus − sa propre hauteur). Les objets d'un niveau suivent son plancher.
        function lvlRDC() { return (lvls || []).find(x => x.id === 'rdc'); }
        function lvlRel(L) { const R = lvlRDC(); if (!R || !L || L.roof) return ''; const d = Math.round(L.z - R.z); return d === 0 ? '±0,00' : (d > 0 ? '+' : '−') + nfr(Math.abs(d) / 1000, 2); }
        function lvlShiftObj(s, dz, h0, h1, z1) {
            if (s.wallMat && s.wz && hasZ(s.wz.b)) { const full = hasZ(s.wz.t) && Math.abs(s.wz.t - s.wz.b - h0) < 2; s.wz.b += dz; if (full) s.wz.t = z1 + h1; else if (hasZ(s.wz.t)) s.wz.t += dz; return; }
            if (!dz) return;
            if (s.sweep || s.type === 'line') { if (hasZ(s.z1)) s.z1 += dz; if (hasZ(s.z2)) s.z2 += dz; }
            if (s.type === 'circle' && hasZ(s.z)) s.z += dz;
            if (s.type === 'mesh' && hasZ(s.z0)) s.z0 += dz;
            if (s.points) s.points.forEach(q => { if (hasZ(q.z)) q.z += dz; }); }
        function lvlChain() { const S = lvlSorted(), r = S.findIndex(x => x.id === 'rdc'); if (r < 0) return false; const old = new Map(S.map(L => [L.id, { z: L.z, h: L.h }]));
            for (let i = r + 1; i < S.length; i++) S[i].z = S[i - 1].z + S[i - 1].h;
            for (let i = r - 1; i >= 0; i--) S[i].z = S[i + 1].z - S[i].h;
            let moved = false; S.forEach(L => { const o = old.get(L.id), dz = L.z - o.z; if (!dz && L.h === o.h) return; moved = true; shapes.forEach(s => { if (lvlMine(s, L.id)) lvlShiftObj(s, dz, o.h, L.h, L.z); }); });
            return moved; }
        // l'étage où l'on dessine (null : outil éteint ou toit)
        function lvlCur() { if (!lvlOn || !lvls) return null; const L = lvlList().find(x => x.id === lvlAct); return L && !L.roof ? L : null; }
        // étage d'un objet : celui qu'on lui a donné, sinon d'après son altitude ; terrain, plateformes, fonds… n'appartiennent à aucun étage (toujours visibles)
        function lvlOf(s) {
            if (!lvls || !s || s.bld) return null; if ((bldZones().length || bldActId) && (bldOfObj(s) || null) !== (bldCur() || null)) return null;   // un autre bâtiment : ses étages ne dépendent pas de celui-ci
            if (s.lvl && (s.lvl === 'toit' || lvls.some(L => L.id === s.lvl))) return s.lvl;
            if (s.roofDef || s.roofPart || (s.solid && s.solid.kind === 'roof') || (s.groupId && (s.name === 'Pignons' || s.name === 'Forme de pente' || s.name === 'Acrotère' || s.name === 'Dalle de toit'))) return 'toit';
            let z = null; if (s.wz && hasZ(s.wz.b)) z = s.wz.b; else if (s.type === 'mesh' && hasZ(s.z0) && !isPlateforme(s)) z = s.z0; else if ((s.solid || s.sweep) && s.points && s.points.length && hasZ(s.points[0].z)) z = Math.min(...s.points.map(q => hasZ(q.z) ? q.z : Infinity));
            if (z === null || !isFinite(z)) return null; const S = lvlSorted(); let best = S[0]; S.forEach(L => { if (L.z <= z + 100) best = L; }); return best ? best.id : null; }
        function lvlRank(id) { return lvlList().findIndex(L => L.id === id); }
        function lvlHidden(s) { if (!lvlOn || !lvls) return false; const id = lvlOf(s); return !!id && lvlRank(id) > lvlRank(lvlAct); }
        function lvlMine(s, id) { return s.lvl === id && (bldOfObj(s) || null) === (bldCur() || null); }
        /* plan : en éditant un étage, les autres étages (dessous compris) sont masqués et inattrapables ; la 3D garde les étages du dessous */
        function lvlOff2D(s) { return lvlHidden(s) || lvlBelow(s); }
        function lvlBelow(s) { if (!lvlOn || !lvls || lvlAct === 'toit') return false; const id = lvlOf(s); return !!id && lvlRank(id) < lvlRank(lvlAct); }
        // objets créés pendant qu'un étage est actif : rangés dans cet étage ; un mur prend la hauteur de l'étage
        function lvlTagNew() { const hasZ0 = bldZones().length > 0; if (!hasZ0 && (!lvlOn || !lvls)) { if (!lvlOn) return; }
            shapes.forEach(s => { if (s.lvs) return; s.lvs = 1; if (isPlateforme(s) || isBg(s) || s.type === 'point' || s.brush || s.bld) return;
                // dans un contour de bâtiment : il prend ses niveaux (étage de sa pastille), même outil Étages éteint
                const p = hasZ0 ? bldRep(s) : null, Z = p ? bldZoneAt(p.x, p.y) : null;
                if (Z) { if ((bldCur() || null) !== Z) bldActivate(Z); s.bid = Z.bld.id; }
                else if (hasZ0) { if (bldActId) bldActivate(null); if (!lvlOn || !lvls) return; }
                if (s.lvl) return; const L = lvlList().find(x => x.id === lvlAct); s.lvl = lvlAct;
                if (L && !L.roof && s.wallMat && !s.wz) s.wz = { b: L.z, t: L.z + L.h }; }); }
        function lvlMarkAll() { shapes.forEach(s => { s.lvs = 1; }); }
        function lvlToggle(on) { lvlOn = on === undefined ? !lvlOn : !!on; if (lvlOn) { lvlInit(); lvlMarkAll(); } const b = document.getElementById('btn-etages'); if (b) b.classList.toggle('active', lvlOn); lvlUI(); lvlRefresh();
            updateCommandMessageText(lvlOn ? 'ÉTAGES : cliquez un niveau pour y travailler (on voit cet étage et tout ce qui est dessous) ; ▲ + ajoute un étage, ▼ − un sous-sol ; double-clic sur un niveau : nom, altitude, hauteur.' : 'ÉTAGES : outil éteint, toute la maquette est visible.'); }
        function lvlRefresh() { invalidateCache(); draw(); if (typeof is3DOpen === 'function' && is3DOpen()) { build3DScene(); render3D(); } }
        function lvlPick(id) { lvlAct = id; if (bldCur()) bldCur().bld.act = id; lvlUI(); lvlRefresh(); const L = lvlList().find(x => x.id === id); updateCommandMessageText('ÉTAGES : ' + lvlName(L) + (L.roof ? ' — toute la maquette.' : ' (plancher ' + lvlRel(L) + ', cote ' + nfr(L.z / 1000, 2) + ' m, H ' + nfr(L.h / 1000, 2) + ' m) : ce que vous dessinez va sur cet étage (un mur va de ' + lvlRel(L) + ' à ' + lvlRel({ z: L.z + L.h }) + ') ; les autres étages sont masqués sur le plan.')); }
        function lvlAdd(up) { lvlInit(); if (up === undefined) { const A = lvlList().find(x => x.id === lvlAct), R = (lvls || []).find(x => x.id === 'rdc'); up = !(A && !A.roof && R && A.z < R.z); } const S = lvlSorted(), ref = up ? S[S.length - 1] : S[0], L = { id: 'lv' + Date.now().toString(36), h: ref.h || 2800, z: up ? ref.z + (ref.h || 2800) : ref.z - (ref.h || 2800) }; lvls.push(L); lvlChain(); saveState(); lvlPick(L.id); }
        function lvlEdit(id) { const L = (lvls || []).find(x => x.id === id); if (!L) return; const inp = (i, v) => `<input id="${i}" type="text" inputmode="decimal" value="${v}" style="width:110px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;text-align:right;outline:none">`;
            const n = shapes.filter(s => lvlMine(s, id)).length;
            openTopoModal('🏢 Niveau ' + lvlName(L), `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb">
                <div class="mf-fig">${bldFig(id === 'rdc' ? 'RDC' : L.z > (lvlRDC() || L).z ? 'R+1' : 'R-1')}<div style="display:flex;flex-direction:column;gap:3px"><b style="font-size:15px">${MF.esc(lvlName(L))}</b><span class="mf-hint" style="margin:0">plancher ${id === 'rdc' ? 'à la cote du RDC' : MF.esc(lvlRel(L))} · cote ${nfr(L.z / 1000, 2)} m · H ${nfr(L.h / 1000, 2)} m</span></div></div>
                ${MF.row('Nom', `<input id="lv-nm" type="text" value="${MF.esc(L.nm || '')}" placeholder="${MF.esc(lvlName(Object.assign({}, L, { nm: '' })))}" class="mf-in mf-wide">`, '')}
                ${id === 'rdc' ? MF.row('Cote du RDC <span class="mf-hint">(le zéro du bâtiment)</span>', MF.num('lv-z', nfr(L.z / 1000, 2)), 'm')
                    : MF.row('Plancher', `<span style="font-size:13px"><b class="text-white">${lvlRel(L)}</b> <span style="color:#9ca3af">(cote ${nfr(L.z / 1000, 2)} m)</span></span>`, '')}
                ${MF.row('Hauteur d\'étage (H)', MF.num('lv-h', nfr(L.h / 1000, 2)), 'm')}
                <div class="mf-hint">${id === 'rdc' ? 'Les étages se calent sur le RDC : chacun est posé sur celui du dessous (+ sa hauteur H), chaque sous-sol sous celui du dessus.' : (L.z > (lvlRDC() || L).z ? 'Plancher calé sur l\'étage du dessous ; ' : 'Plancher calé sous le niveau du dessus ; ') + 'pour tout déplacer, changez la cote du RDC.'} ${n} objet(s) sur ce niveau ; un mur dessiné ici va du plancher au plancher + H.</div></div>`,
                [['Supprimer le niveau', () => { if (id === 'rdc') { alert('Le RDC reste : renommez-le ou changez sa cote.'); return; } shapes.forEach(s => { if (s.lvl === id) delete s.lvl; }); lvls = lvls.filter(x => x !== L); if (lvlAct === id) lvlAct = 'rdc'; closeTopoModal(); lvlUI(); lvlRefresh(); }, false],
                 ['Annuler', () => closeTopoModal(), false],
                 ['Valider', () => { const z = t2Num(document.getElementById('lv-z').value), h = t2Num(document.getElementById('lv-h').value), nm = document.getElementById('lv-nm').value.trim();
                    if (nm) L.nm = nm; else delete L.nm; lvlSet(id, id === 'rdc' && isFinite(z) ? Math.round(z * 1000) : undefined, isFinite(h) && h > 0 ? Math.round(h * 1000) : undefined);
                    closeTopoModal(); saveState(); lvlUI(); lvlRefresh(); }, true]]); }
        // change la cote (RDC seulement) et/ou la hauteur d'un niveau ; tous les niveaux et leurs objets suivent
        function lvlSet(id, z, h) { const L = (lvls || []).find(x => x.id === id); if (!L) return; const o = { z: L.z, h: L.h };
            if (hasZ(z) && id === 'rdc') L.z = z; if (h > 0) L.h = h;
            // le niveau édité d'abord (le chaînage ne voit que les écarts restants)
            if (L.z !== o.z || L.h !== o.h) shapes.forEach(s => { if (lvlMine(s, id)) lvlShiftObj(s, L.z - o.z, o.h, L.h, L.z); });
            lvlChain(); }
        // le petit schéma des étages, sous la rosace, dans le même dessin qu'elle (bulles sombres cerclées, trait clair)
        function lvlUI() {
            let box = document.getElementById('lvl-box'); bldPanelDraw(); if (!lvlOn || bldZones().length || bldActId) { if (box) box.style.display = 'none'; return; }   // avec des contours de bâtiment : les étages se règlent sur le contour (Y), plus de schéma flottant
            if (!box) { box = document.createElement('div'); box.id = 'lvl-box'; box.style.cssText = 'position:fixed;user-select:none;'; document.body.appendChild(box); window.addEventListener('resize', lvlPlace); }
            // de haut en bas : le toit, les étages (le niveau actif hachuré), le trait vert du terrain sous le RDC, puis les boutons + (ajouter) et − (supprimer l'étage en cours)
            const L = lvlList(), n = L.length, bh = 18, gap = 6, x0 = 10, x1 = 136, act = lvlRank(lvlAct), rdc = L.findIndex(l => l.id === 'rdc'), yRoof = 4, y0 = 34;
            const yOf = (i) => y0 + (n - 2 - i) * (bh + gap);   // i : rang depuis le bas (le toit est le dernier)
            let g = `<defs><pattern id="lvl-h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#f59e0b" stroke-width="1.6"/></pattern></defs>`;
            L.forEach((lv, i) => { const on = i === act, hid = i > act, nm = lvlName(lv), js = `lvlPick('${lv.id}')`, dj = lv.roof ? '' : ` ondblclick="lvlEdit('${lv.id}')"`, t = lv.roof ? 'TOIT : toute la maquette' : nm + ' — plancher ' + lvlRel(lv) + ' (cote ' + nfr(lv.z / 1000, 2) + ' m), hauteur ' + nfr(lv.h / 1000, 2) + ' m (double-clic : régler)';
                if (lv.roof) { g += `<g style="cursor:pointer" onclick="${js}"><title>${t}</title><path d="M${x0} ${yRoof + 22} L${(x0 + x1) / 2} ${yRoof} L${x1} ${yRoof + 22} Z" fill="${on ? 'url(#lvl-h)' : '#0f172a'}" stroke="${on ? '#fde047' : '#e5e7eb'}" stroke-width="${on ? 2.2 : 1.4}"/><text x="${(x0 + x1) / 2}" y="${yRoof + 18}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${on ? '#fff' : '#f59e0b'}" font-family="Arial">TOIT</text></g>`; return; }
                const y = yOf(i); g += `<g style="cursor:pointer;opacity:${hid ? 0.5 : 1}" onclick="${js}"${dj}><title>${t}</title><rect x="${x0}" y="${y}" width="${x1 - x0}" height="${bh}" rx="2" fill="${on ? 'url(#lvl-h)' : '#0f172a'}" stroke="${on ? '#fde047' : '#9ca3af'}" stroke-width="${on ? 2.2 : 1.3}"/>`
                    + `<text x="${x0 + 6}" y="${y + 12.8}" font-size="10" font-weight="700" fill="${on ? '#fff' : '#f59e0b'}" font-family="Arial" style="paint-order:stroke" stroke="#0f172a" stroke-width="${on ? 3 : 0}">${MF.esc(nm.length > 9 ? nm.slice(0, 8) + '…' : nm)}</text>`
                    + `<text x="${x1 - 5}" y="${y + 12.6}" text-anchor="end" font-size="9" font-weight="700" fill="${on ? '#fff' : '#cbd5e1'}" font-family="Arial" style="paint-order:stroke" stroke="#0f172a" stroke-width="${on ? 3 : 0}">${lvlRel(lv)}</text></g>`;
                if (i === rdc) g += `<line x1="${x0 - 4}" y1="${y + bh + gap / 2}" x2="${x1 + 4}" y2="${y + bh + gap / 2}" stroke="#22c55e" stroke-width="2.4"><title>Terrain (niveau du RDC)</title></line>`; });
            const yb = yOf(0) + bh + 12, btn = (x, plus, t, js) => `<g style="cursor:pointer" onclick="${js}"><title>${t}</title><rect x="${x}" y="${yb}" width="30" height="30" rx="4" fill="#0f172a" stroke="#9ca3af" stroke-width="1.4"/><path d="${plus ? `M${x + 15} ${yb + 7}v16M${x + 7} ${yb + 15}h16` : `M${x + 7} ${yb + 15}h16`}" stroke="#f59e0b" stroke-width="5" stroke-linecap="butt"/></g>`;
            g += btn(x0 + 8, true, 'Ajouter un étage (au-dessus ; sur un sous-sol : un sous-sol de plus)', 'lvlAdd()') + btn(x1 - 38, false, 'Supprimer l\'étage en cours', 'lvlDelAsk()');
            const H = yb + 34; box.innerHTML = `<svg width="146" height="${H}" viewBox="0 0 146 ${H}" style="display:block;overflow:visible">${g}</svg>`; box.style.display = 'block'; lvlPlace(); }
        // en bas à droite de la zone de dessin (du même côté que la rosace), en plan comme en 3D
        function lvlPlace() { const box = document.getElementById('lvl-box'); if (!box || box.style.display === 'none') return; const v = document.getElementById('view3d'), host = v && v.style.display === 'block' ? v : canvas, R = host.getBoundingClientRect();
            const cb = document.getElementById('command-bar'), bot = Math.min(R.bottom, cb && cb.offsetHeight ? cb.getBoundingClientRect().top : R.bottom) - (host === canvas ? 0 : 30);
            // jamais sur le bandeau du bas ; s'il manque de place (beaucoup d'étages), le schéma se réduit pour tenir sous la rosace
            const room = bot - 14 - (R.top + 140), h = box.offsetHeight, k = h > room && room > 60 ? room / h : 1; box.dataset.k = k; box.style.transformOrigin = 'bottom right'; box.style.transform = k < 1 ? 'scale(' + k + ')' : '';
            box.style.left = (R.right - box.offsetWidth - 14) + 'px'; box.style.top = (bot - box.offsetHeight - 14) + 'px'; }
        function lvlDelAsk() { const L = lvlList().find(x => x.id === lvlAct); if (!L) return;
            if (L.roof || L.id === 'rdc') { updateCommandMessageText('ÉTAGES : ' + (L.roof ? 'le toit' : 'le RDC') + ' ne se supprime pas. Choisissez l\'étage à supprimer, puis −.'); return; }
            const mine = shapes.filter(s => lvlMine(s, L.id)), nm = lvlName(L);
            const del = (withObj) => { if (withObj) shapes = shapes.filter(s => !mine.includes(s)); else mine.forEach(s => { delete s.lvl; });
                const S = lvlSorted(), k = S.indexOf(L), nb = S[k - 1] && S[k - 1].z >= (S.find(x => x.id === 'rdc') || {}).z ? S[k - 1] : S[k + 1] || S.find(x => x.id === 'rdc'); lvls = lvls.filter(x => x !== L); lvlAct = nb ? nb.id : 'rdc'; lvlChain();
                closeTopoModal(); saveState(); lvlUI(); lvlRefresh(); bldPanelDraw(); updateCommandMessageText('ÉTAGES : ' + nm + ' supprimé' + (withObj ? ' avec ses ' + mine.length + ' objet(s).' : ' ; ses objets restent, rangés d\'après leur altitude.')); };
            openTopoModal('🏢 Supprimer l\'étage ' + nm + ' ?', `<div style="font-size:13.5px;color:#e5e7eb;min-width:300px">L'étage <b>${MF.esc(nm)}</b> (plancher à ${nfr(L.z / 1000, 2)} m) va être supprimé.${mine.length ? `<br><br>Il porte <b>${mine.length}</b> objet(s) dessiné(s) sur lui : les garder (ils seront rangés d'après leur altitude) ou les supprimer avec lui ?` : ''}</div>`,
                mine.length ? [['Annuler', () => closeTopoModal(), false], ['Supprimer avec ses objets', () => del(true), false], ['Supprimer l\'étage seulement', () => del(false), true]] : [['Annuler', () => closeTopoModal(), false], ['Supprimer', () => del(false), true]]); }
        function texApplySel() { const S = selectedShapes.filter(is3DObj); if (!S.length || !texPaint) return; S.forEach(s => texTargets(s).forEach(x => { x.tex = texPaint.tex; })); saveState(); if (is3DOpen()) { build3DScene(); render3D(); } else draw(); updateCommandMessageText('PEINDRE : ' + S.length + ' volume(s) habillé(s) en « ' + (TEX_LIB.find(t => t.id === texPaint.tex) || {}).name + ' ».'); }

