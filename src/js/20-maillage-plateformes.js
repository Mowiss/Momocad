        // ---------- MAILLAGE : sondages géotechniques (G2) et diagnostic pollution ----------
        // une maille = un contour ; ses couches s'empilent depuis le terrain naturel (épaisseurs), la dernière descend jusqu'au fond.
        // Les mailles d'un même nom de maillage forment un maillage ; la note de cubature décompose le déblai par couche.
        const MAIL_SUB = [['tv', 'Terre végétale', '#4d7c0f'], ['remb', 'Remblai', '#a8a29e'], ['limon', 'Limon', '#d6b98c'], ['argile', 'Argile', '#b45309'], ['sable', 'Sable', '#eab308'], ['grave', 'Grave', '#d4d4d8'], ['marne', 'Marne', '#94a3b8'], ['craie', 'Craie', '#f5f5f4'], ['calc', 'Calcaire', '#d6d3d1'], ['gres', 'Grès', '#fdba74'], ['schiste', 'Schiste', '#64748b'], ['rocher', 'Rocher', '#78716c']];
        const MAIL_CL = [['isdi', 'ISDI', '#22c55e'], ['isdip', 'ISDI+', '#a3e635'], ['isdnd', 'ISDND', '#f59e0b'], ['isdd', 'ISDD', '#ef4444'], ['na', 'Non analysé', '#9ca3af']];
        const MAIL_POL = ['HAP', 'Hydrocarbures (HCT C10-C40)', 'Métaux lourds', 'Sulfates', 'Fluorures', 'Fraction soluble', 'BTEX', 'PCB', 'COHV', 'Amiante', 'Antimoine', 'COT'];
        let mailDraw = false, mailCur = null, mailClip = null, mailNote = null, mailPick = { set: 'G2 PRO', k: 'geo' };
        const MAIL_HYD = [['nappe', 'Nappe', '#38bdf8']];   // hydrogéologie : une maille = une nappe, niveau plan
        const mailT = (k, id) => k === 'hyd' ? MAIL_HYD[0] : (k === 'pol' ? MAIL_CL : MAIL_SUB).find(x => x[0] === id) || (k === 'pol' ? MAIL_CL[4] : MAIL_SUB[2]);
        const mailNm = (k, c) => c.nm || mailT(k, k === 'pol' ? c.cl : c.sub)[1], mailCol = (k, c) => mailT(k, k === 'pol' ? c.cl : c.sub)[2];
        function mailDef(k) { if (k === 'hyd') return [{ ep: 0, sub: 'nappe' }]; return k === 'pol' ? [{ ep: 500, cl: 'isdi' }, { ep: 1000, cl: 'isdi' }] : [{ ep: 300, sub: 'tv' }, { ep: 1500, sub: 'limon', mpa: 0.5 }, { ep: 2000, sub: 'marne', mpa: 2 }]; }
        function mailList(set) { return shapes.filter(s => s.maille && s.type === 'poly' && !s.open && s.points.length >= 3 && (set === undefined || s.maille.set === set)); }
        function mailSets() { const o = []; mailList().forEach(s => { if (!o.find(x => x.set === s.maille.set)) o.push({ set: s.maille.set, k: s.maille.k }); }); return o; }
        function mailLayer(set, k) { return ensureLayer('Maillage ' + set, k === 'pol' ? '#f59e0b' : k === 'hyd' ? '#38bdf8' : '#a78bfa'); }
        /* nappe (maillage hydrogéologie) : la maille porte un niveau d'eau plan ; l'eau apparaît là où le sol fini passe sous ce niveau (plan en bleu, plan d'eau en 3D) */
        function mailHydSync() { mailList().forEach(s => { if (s.maille.k === 'hyd') { if (!s.water) { const c = polyCentroid(s.points), tin = getTIN(), z = tin ? tinZ(c.x, c.y, tin) : null; s.water = { z: hasZ(z) ? Math.round(z - 500) : 100000, name: 'Nappe', nappe: 1 }; } s.water.nappe = 1; s.hatch = false; }
            else if (s.water && s.water.nappe) delete s.water; }); }
        // couche à la profondeur d (mm sous le TN) : la dernière couche continue vers le bas
        function mailTops(M) { let z = 0; return M.cs.map((c, i) => { const t = z; z += i < M.cs.length - 1 ? Math.max(0, +c.ep || 0) : Infinity; return [t, z]; }); }
        function startMaille() { const sel = selectedShapes.filter(x => x.type === 'poly' && !x.open && x.points.length >= 3 && !x.maille && !x.bassin && !x.solid && !x.sweep && !x.bld && !x.water && !x.trench && !x.bois);
            if (sel.length) { sel.forEach(s => mailMake(s, true)); selectedShapes = sel; mailFinish(sel[0]); return; }
            const m0 = selectedShapes.find(x => x.maille); if (m0) { mailPanel(m0); return; }
            setMode('poly'); mailDraw = true; const b = document.getElementById('btn-mail'); if (b) b.classList.add('active'); mailPanel(null);
            updateCommandMessageText('MAILLAGE : cliquez le contour de la maille (zone d\'un sondage), recliquez le 1er point ou double-clic pour fermer. Ou sélectionnez des contours fermés puis MAI.'); }
        function mailMake(s, many) { const P = mailPick, n = mailList(P.set).length + 1, tpl = mailClip && mailClip.k === P.k ? mailClip.cs : mailDef(P.k);
            s.maille = { set: P.set, k: P.k, cs: JSON.parse(JSON.stringify(tpl)) }; delete s.talus; s.points.forEach(q => { delete q.z; });   // une maille n'a pas d'altitude : ses couches partent du terrain naturel
             s.layerId = mailLayer(P.set, P.k); s.zk = 1; s.hatch = false; s.name = (P.k === 'pol' ? 'P' : P.k === 'hyd' ? 'N' : 'S') + n; mailHydSync(); if (!many) mailFinish(s); }
        function mailFinish(s) { selectedShapes = [s]; updateLayerUI(); invalidateCache(); saveState(); draw(); mailPanel(s); }
        function mailCreate(P) { if (!P || P.length < 3) { updateCommandMessageText('MAILLAGE : il faut au moins 3 points.'); return; } const s = { type: 'poly', layerId: 'layer-0', points: P.map(q => ({ x: q.x, y: q.y })) }; shapes.push(s); mailMake(s);
            setMode('poly'); mailDraw = true; const b = document.getElementById('btn-mail'); if (b) b.classList.add('active'); mailPanel(s); updateCommandMessageText('MAILLAGE : maille ' + (s.name || '') + ' créée ; tracez la suivante, ou Échap pour finir.'); }
        // colonne de sondage : couches à l'échelle, limites à tirer à la souris (pas de 5 cm)
        function mailSVG(M, sel, Dv0) { const T = mailTops(M), fin = T.length > 1 ? T[T.length - 1][0] : 0, Dv = Dv0 || Math.max(1000, fin * 1.25 + 300), H = 250, W = 300, x0 = 92, cw = 90, y = (d) => 14 + Math.min(d, Dv) / Dv * H;
            let g = `<svg id="ml-svg" viewBox="0 0 ${W} ${H + 28}" width="100%" style="display:block;touch-action:none;user-select:none" data-dv="${Dv}">`;
            g += `<text x="${x0 + cw / 2}" y="10" text-anchor="middle" font-size="10" fill="#9ca3af">TN</text>`;
            T.forEach(([a, b], i) => { const c = M.cs[i], y1 = y(a), y2 = y(b), lbl = mailNm(M.k, c) + (M.k === 'pol' ? '' : hasZ(c.mpa) && c.mpa !== '' ? ' · ' + nfr(+c.mpa, 1) + ' MPa' : '');
                g += `<rect x="${x0}" y="${y1}" width="${cw}" height="${Math.max(1, y2 - y1)}" fill="${mailCol(M.k, c)}" fill-opacity="${i === sel ? 1 : 0.8}" stroke="${i === sel ? '#fff' : '#111827'}" stroke-width="${i === sel ? 2 : 1}" data-l="${i}" style="cursor:pointer"/>`;
                g += `<text x="${x0 + cw + 8}" y="${(y1 + y2) / 2 + 4}" font-size="11" fill="#e5e7eb">${mailEsc(lbl)}${M.k === 'pol' && c.pol ? `<tspan fill="#9ca3af"> · ${mailEsc(c.pol)}</tspan>` : ''}</text>`;
                if (i < T.length - 1) g += `<text x="${x0 - 6}" y="${y2 + 4}" text-anchor="end" font-size="10.5" fill="#cbd5e1">−${nfr(b / 1000, 2)} m</text><rect x="${x0 - 4}" y="${y2 - 5}" width="${cw + 8}" height="10" fill="transparent" data-b="${i}" style="cursor:ns-resize"/><line x1="${x0 - 4}" x2="${x0 + cw + 4}" y1="${y2}" y2="${y2}" stroke="#fff" stroke-width="1.5" pointer-events="none"/>`; });
            g += `<text x="${x0 + cw / 2}" y="${H + 26}" text-anchor="middle" font-size="10" fill="#9ca3af">↓ jusqu'au fond</text></svg>`; return g; }
        const mailEsc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        let mailSel = 0;
        function mailPanel(s) { if (s !== undefined) mailCur = s; s = mailCur; if (s && (!shapes.includes(s) || !s.maille)) s = mailCur = null; const P = mailPick, M = s ? s.maille : null, k = M ? M.k : P.k, set = M ? M.set : P.set;
            const sets = mailSets(), inS = 'background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px 6px';
            let h = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:end"><label style="font-size:12px;color:#9ca3af">Maillage<input id="ml-set" list="ml-sets" value="${mailEsc(set)}" onchange="mailSetName(this.value)" style="width:100%;margin-top:2px;${inS}"><datalist id="ml-sets">${sets.map(x => `<option value="${mailEsc(x.set)}">`).join('')}</datalist></label>
                <div>${vSeg([['geo', 'Géologie'], ['pol', 'Pollution'], ['hyd', 'Hydrogéologie']], k, "mailKind('$')")}</div></div>`;
            const cells = mailList(set).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { numeric: true }));
            if (s && mailSel >= M.cs.length) mailSel = M.cs.length - 1;
            // une maille par chapitre rétractable : seule la maille en cours est dépliée (colonne et couches)
            h += cells.length ? `<div style="display:flex;flex-direction:column;gap:6px">` + cells.map(c => { const C = c.maille, T = mailTops(C), on = c === s, dom = C.k === 'pol' ? mailWorst(C) : (C.cs.find(x => x.sub !== 'tv') || C.cs[0]);
                    const sum = C.k === 'hyd' ? 'Nappe à ' + (c.water && hasZ(c.water.z) ? nfr(c.water.z / 1000, 2) + ' m' : '—') : C.cs.map((x, i) => mailNm(C.k, x) + (i < T.length - 1 ? ' ' + nfr(T[i][1] / 1000, 2) : '')).join(' / ');
                    return `<details class="ml-cell" ${on ? 'open' : ''} data-si="${shapes.indexOf(c)}" ontoggle="mailToggle(this)"><summary><i style="background:${mailCol(C.k, dom)}"></i><b>${mailEsc(c.name || '—')}</b><span>${mailEsc(sum)}</span><em>${nfr(Math.abs(polyArea(c.points)) * Math.pow(mOf(1), 2), 0)} m²</em></summary>${on ? `<div class="ml-cb">${mailCellBody(c)}</div>` : ''}</details>`; }).join('') + '</div>'
                : `<div style="color:#9ca3af;font-size:12px">Tracez la première maille (zone d'un sondage), ou placez les sondages puis répartissez une zone entre eux.</div>`;
            h += `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mf-btn" onclick="mailAddCell()">+ Ajouter une maille</button></div>`;
            h += `<div style="border-top:1px solid #374151;padding-top:8px;display:flex;flex-direction:column;gap:6px"><div style="font-weight:600;color:#fff">Découpe par sondages</div>
                <div style="color:#9ca3af;font-size:12px">Placez les sondages, puis tracez la zone d'effet : elle se partage entre eux, chaque point de la zone revenant au sondage le plus proche.</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mf-btn" onclick="mailSondStart()">📍 Placer des sondages (${mailSonds(set).length})</button><button type="button" class="mf-btn" onclick="mailZoneStart()">⬠ Zone d'effet → répartir</button>${shapes.some(z => z.mailZone && z.mailZone.set === set) ? `<button type="button" class="mf-btn" onclick="mailResplit()">↻ Recalculer</button>` : ''}</div></div>`;
            h += mailLegendHTML(set, k);
            t2Panel('🧱 Maillage — ' + mailEsc(set), h, [['Fermer', "setMode('select-box');draw()", true]]); mailDrag();
            { const o = document.querySelector('#t2-panel .ml-cell[open]'); if (o) o.scrollIntoView({ block: 'nearest' }); } }
        function mailCellBody(s) { const M = s.maille, k = M.k, inS = 'background:#111827;border:1px solid #4b5563;border-radius:5px;color:#fff;padding:3px 6px';
            if (k === 'hyd') { const z = s.water ? s.water.z : null; return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:12px;color:#9ca3af">Nom</span><input id="ml-nm" value="${mailEsc(s.name || '')}" onchange="mailCur.name=this.value;mailApply();mailPanel()" style="width:90px;${inS}"><span style="font-size:12px;color:#9ca3af;margin-left:8px">Niveau de la nappe</span><input id="ml-nz" value="${hasZ(z) ? nfr(z / 1000, 2) : ''}" onchange="mailNappe(this.value)" style="width:80px;text-align:right;${inS}"><span style="font-size:12px;color:#9ca3af">m</span></div><div class="mf-hint" style="margin-top:6px">Niveau plan : là où le sol fini (terrain, talus, fond de fouille) passe sous ce niveau, l'eau apparaît, en bleu sur le plan et en plan d'eau dans la vue 3D.</div>`; }
            let h = `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:#9ca3af">Nom</span><input id="ml-nm" value="${mailEsc(s.name || '')}" onchange="mailCur.name=this.value;mailApply();mailPanel()" style="width:90px;${inS}">${M.sd ? '<span style="font-size:11px;color:#9ca3af">zone de sondage</span>' : ''}</div>`;
            h += `<div id="ml-col">${mailSVG(M, mailSel)}</div>`;
            h += `<div style="display:flex;flex-direction:column;gap:4px">` + M.cs.map((c, i) => { const last = i === M.cs.length - 1, opts = (k === 'pol' ? MAIL_CL : MAIL_SUB).map(([v, l]) => `<option value="${v}" ${(k === 'pol' ? c.cl : c.sub) === v ? 'selected' : ''}>${l}</option>`).join('');
                return `<div style="display:flex;gap:4px;align-items:center;padding:2px;border-radius:6px;${i === mailSel ? 'background:rgba(167,139,250,.15)' : ''}" onclick="if(mailSel!==${i}){mailSel=${i};mailPanel()}"><span style="width:10px;height:22px;border-radius:3px;background:${mailCol(k, c)};flex:none"></span>
                    <select onchange="mailEd(${i},'${k === 'pol' ? 'cl' : 'sub'}',this.value)" style="width:110px;${inS}">${opts}</select>
                    ${last ? '<span style="width:54px;font-size:11px;color:#9ca3af;text-align:center">au fond</span>' : `<input value="${nfr((+c.ep || 0) / 1000, 2)}" onchange="mailEd(${i},'ep',this.value)" title="Épaisseur (m)" style="width:54px;text-align:right;${inS}">`}
                    ${k === 'pol' ? `<input value="${mailEsc(c.pol || '')}" list="ml-pol" onchange="mailEd(${i},'pol',this.value)" placeholder="pollution" title="Type de pollution" style="flex:1;min-width:0;${inS}">` : `<input value="${hasZ(c.mpa) && c.mpa !== '' ? nfr(+c.mpa, 1) : ''}" onchange="mailEd(${i},'mpa',this.value)" placeholder="MPa" title="Dureté (MPa)" style="width:50px;text-align:right;${inS}"><input value="${mailEsc(c.nm || '')}" onchange="mailEd(${i},'nm',this.value)" placeholder="libellé" title="Libellé (sinon le type)" style="flex:1;min-width:0;${inS}">`}
                    <button type="button" onclick="event.stopPropagation();mailDel(${i})" title="Retirer la couche" style="background:none;border:0;color:#9ca3af;cursor:pointer" ${M.cs.length < 2 ? 'disabled' : ''}>✕</button></div>`; }).join('') + `</div><datalist id="ml-pol">${MAIL_POL.map(x => `<option value="${x}">`).join('')}</datalist>`;
            h += `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mf-btn" onclick="mailAdd()">+ Couche</button><button type="button" class="mf-btn" onclick="mailCopy()">Copier les couches</button>${mailClip && mailClip.k === k ? `<button type="button" class="mf-btn" onclick="mailPaste()">Coller${selectedShapes.filter(x => x.maille).length > 1 ? ' sur les ' + selectedShapes.filter(x => x.maille).length + ' mailles' : ''}</button>` : ''}</div>`;
            h += `<details style="font-size:12px"><summary style="cursor:pointer;color:#c4b5fd">Importer une coupe de sondage (coller un tableau)</summary><textarea id="ml-paste" rows="4" placeholder="${k === 'pol' ? '0,00  0,50  ISDI\n0,50  1,20  ISDND  HAP' : '0,00  0,30  Terre végétale\n0,30  1,80  Limon argileux  0,6 MPa\n1,80  5,00  Marne  2,5'}" style="width:100%;margin-top:4px;font-family:monospace;font-size:11.5px;${inS}"></textarea><button type="button" class="mf-btn" onclick="mailImport()">Remplacer les couches</button><div style="color:#9ca3af;margin-top:3px">Une ligne par couche : profondeur du haut et du bas (m), puis la description${k === 'pol' ? ', la classe (ISDI, ISDI+, ISDND, ISDD) et la pollution' : ' et la dureté'}.</div></details>`;
            return h; }
        function mailNappe(v) { const s = mailCur, z = t2Num(v); if (!s || !s.maille || s.maille.k !== 'hyd' || !isFinite(z)) return; mailHydSync(); s.water.z = Math.round(z * 1000); mailApply(); mailPanel(); }
        function mailToggle(el) { const c = shapes[+el.dataset.si]; if (!el.open || !c || !c.maille || c === mailCur || !el.isConnected) return; mailCur = c; mailSel = 0; selectedShapes = [c]; draw(); mailPanel(); }
        function mailWorst(M) { return M.cs.reduce((a, x) => (MAIL_CL.findIndex(q => q[0] === x.cl) % 4) > (MAIL_CL.findIndex(q => q[0] === a.cl) % 4) ? x : a, M.cs[0]); }
        function mailAddCell() { const M = mailCur && mailCur.maille; if (M) mailPick = { set: M.set, k: M.k }; setMode('poly'); mailDraw = true; const b = document.getElementById('btn-mail'); if (b) b.classList.add('active'); mailPanel(); updateCommandMessageText('MAILLAGE : tracez la maille ; recliquez le 1er point ou double-clic pour fermer, puis la suivante. Échap pour finir.'); }
        // légende des couleurs du maillage (plan et volet)
        function mailLegendItems(set) { const L = mailList(set); if (!L.length) return []; const k = L[0].maille.k, seen = new Map();
            L.forEach(c => { const d = k === 'pol' ? mailWorst(c.maille) : (c.maille.cs.find(x => x.sub !== 'tv') || c.maille.cs[0]); const key = k === 'pol' ? d.cl : d.sub; if (!seen.has(key)) seen.set(key, [mailCol(k, d), k === 'pol' ? mailT('pol', d.cl)[1] : mailT('geo', d.sub)[1]]); });
            return [...seen.values()]; }
        function mailLegendHTML(set, k) { const I = mailLegendItems(set); if (!I.length) return ''; return `<div style="border-top:1px solid #374151;padding-top:8px"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Légende du plan (${k === 'pol' ? 'pire classe' : 'couche principale'})</div><div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px">${I.map(([c, n]) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c};margin-right:5px;vertical-align:-1px"></i>${mailEsc(n)}</span>`).join('')}</div></div>`; }
        function mailLegendDraw(c) { if (lpInner || mode === 'print') return; const S = mailSets().filter(x => { const L = mailList(x.set); return L.length && L.some(s => { const ly = layers.find(l => l.id === s.layerId); return !ly || ly.visible !== false; }); }); if (!S.length) return;
            const rows = []; S.forEach(x => { rows.push([null, 'Maillage ' + x.set]); mailLegendItems(x.set).forEach(r => rows.push(r)); });
            c.save(); c.setTransform(1, 0, 0, 1, 0, 0); const dpr = canvas.width / (canvas.clientWidth || canvas.width), lh = 16 * dpr, w = 180 * dpr, hh = (rows.length * 16 + 10) * dpr, x0 = 12 * dpr, y0 = canvas.height - hh - 40 * dpr;
            c.fillStyle = 'rgba(17,24,39,.85)'; c.strokeStyle = '#4b5563'; c.lineWidth = 1; c.beginPath(); c.rect(x0, y0, w, hh); c.fill(); c.stroke(); c.font = (11 * dpr) + 'px Arial'; c.textBaseline = 'middle';
            rows.forEach(([col, n], i) => { const y = y0 + 5 * dpr + lh * i + lh / 2; if (col) { c.fillStyle = col; c.fillRect(x0 + 8 * dpr, y - 5 * dpr, 10 * dpr, 10 * dpr); c.fillStyle = '#e5e7eb'; c.fillText(n, x0 + 24 * dpr, y); } else { c.fillStyle = '#c4b5fd'; c.font = 'bold ' + (11 * dpr) + 'px Arial'; c.fillText(n, x0 + 8 * dpr, y); c.font = (11 * dpr) + 'px Arial'; } });
            c.restore(); }
        // SONDAGES et ZONE D'EFFET : la zone se partage entre les sondages (chaque point revient au sondage le plus proche)
        let mailSond = false, mailZoneDraw = false;
        function mailSonds(set) { return shapes.filter(p => p.type === 'point' && p.sondage && p.sondage.set === set); }
        function mailSondStart() { const M = mailCur && mailCur.maille; if (M) mailPick = { set: M.set, k: M.k }; setMode('select-box'); mailSond = true; setMode('point'); mailSond = true; mailPanel(); updateCommandMessageText('SONDAGES : cliquez l\'emplacement de chaque sondage (S1, S2…). Échap pour finir.'); }
        function mailTagNew() { if (!mailSond) return; const p = shapes[shapes.length - 1]; if (!p || p.type !== 'point' || p.sondage) return; const set = mailPick.set, n = mailSonds(set).length + 1;
            p.sondage = { set }; p.sid = generateId(); p.name = 'S' + n; p.label = p.name; delete p.z; p.zk = 1; p.layerId = mailLayer(set, mailPick.k); }
        function mailZoneStart() { const sel = selectedShapes.find(x => x.type === 'poly' && !x.open && x.points.length >= 3 && !x.maille && !isPlateforme(x));
            const M = mailCur && mailCur.maille; if (M) mailPick = { set: M.set, k: M.k };
            if (sel) { mailSplit(sel.points.map(q => ({ x: q.x, y: q.y })), sel); return; }
            setMode('poly'); mailZoneDraw = true; updateCommandMessageText('ZONE D\'EFFET : tracez le contour de la zone à répartir entre les sondages ; recliquez le 1er point ou double-clic pour fermer.'); }
        function mailZoneCreate(P) { if (!P || P.length < 3) return; mailSplit(P); }
        // demi-plan du sondage a face au sondage b (côté a de la médiatrice) appliqué au contour R
        function mailClipHalf(R, a, b) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y, side = (p) => (p.x - mx) * nx + (p.y - my) * ny, out = [];
            for (let i = 0; i < R.length; i++) { const p = R[i], q = R[(i + 1) % R.length], sp = side(p), sq = side(q); if (sp <= 0) out.push(p); if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); } }
            return out; }
        function mailSplit(P, zoneShape) { const set = mailPick.set, k = mailPick.k, S = mailSonds(set).filter(p => pointInPolygon(p.x, p.y, P));
            if (!S.length) { updateCommandMessageText('ZONE D\'EFFET : aucun sondage de « ' + set + ' » dans cette zone. Placez-les d\'abord (📍).'); mailPanel(); return; }
            let Z = zoneShape; if (!Z) { Z = { type: 'poly', layerId: mailLayer(set, k), points: P.map(q => ({ x: q.x, y: q.y })), zk: 1, dash: 'dashed' }; shapes.push(Z); }
            Z.mailZone = { set }; Z.zid = Z.zid || generateId(); Z.layerId = mailLayer(set, k); Z.points.forEach(q => { delete q.z; }); Z.zk = 1; Z.hatch = false;
            const old = new Map(); shapes.filter(c => c.maille && c.maille.zid === Z.zid).forEach(c => old.set(c.maille.sd, c)); shapes = shapes.filter(c => !(c.maille && c.maille.zid === Z.zid));
            const made = []; S.forEach(sd => { let R = Z.points.map(q => ({ x: q.x, y: q.y })); S.forEach(o => { if (o !== sd && R.length >= 3) R = mailClipHalf(R, sd, o); }); R = cleanPolyPts(R, true); if (R.length < 3) return;
                const was = old.get(sd.sid), c = { type: 'poly', layerId: mailLayer(set, k), points: R.map(q => ({ x: q.x, y: q.y })), zk: 1, hatch: false, name: sd.name };
                c.maille = { set, k, sd: sd.sid, zid: Z.zid, cs: was ? was.maille.cs : JSON.parse(JSON.stringify(mailClip && mailClip.k === k ? mailClip.cs : mailDef(k))) }; shapes.push(c); made.push(c); });
            setMode('select-box'); updateLayerUI(); invalidateCache(); saveState(); selectedShapes = made.slice(0, 1); mailCur = made[0] || null; draw(); mailPanel();
            updateCommandMessageText('ZONE D\'EFFET : ' + made.length + ' maille' + (made.length > 1 ? 's' : '') + ' (une par sondage). Déplacez un sondage puis « Recalculer » pour refaire le partage.'); }
        function mailResplit() { const set = (mailCur && mailCur.maille ? mailCur.maille.set : mailPick.set); mailPick.set = set; shapes.filter(z => z.mailZone && z.mailZone.set === set).forEach(z => { const k0 = (mailList(set)[0] || {}).maille; if (k0) mailPick.k = k0.k; mailSplit(z.points.map(q => ({ x: q.x, y: q.y })), z); }); }
        function mailWide() {}
        function mailApply() { mailHydSync(); invalidateCache(); saveState(); draw(); }
        function mailSetName(v) { v = String(v || '').trim(); if (!v) return; mailPick.set = v; const s = mailCur; if (s && s.maille) { selectedShapes.filter(x => x.maille).concat([s]).forEach(x => { x.maille.set = v; x.layerId = mailLayer(v, x.maille.k); }); updateLayerUI(); mailApply(); } mailPanel(); }
        function mailKind(k) { mailPick.k = k; const s = mailCur; if (s && s.maille && s.maille.k !== k) { s.maille.k = k; s.maille.cs = mailDef(k); s.layerId = mailLayer(s.maille.set, k); mailSel = 0; mailApply(); updateLayerUI(); } mailPanel(); }
        function mailEd(i, f, v) { const M = mailCur && mailCur.maille; if (!M || !M.cs[i]) return; const c = M.cs[i];
            if (f === 'ep') { const x = parseFloat(String(v).replace(',', '.')); if (!(x >= 0)) { mailPanel(); return; } c.ep = Math.round(x * 1000); }
            else if (f === 'mpa') { const x = parseFloat(String(v).replace(',', '.')); if (isFinite(x) && x >= 0) c.mpa = x; else delete c.mpa; }
            else if (f === 'nm' || f === 'pol') { v = String(v).trim(); if (v) c[f] = v; else delete c[f]; } else c[f] = v;
            mailSel = i; mailApply(); mailPanel(); }
        function mailAdd() { const M = mailCur && mailCur.maille; if (!M) return; const L = M.cs[M.cs.length - 1]; if (!(L.ep > 0)) L.ep = 1000; M.cs.push(Object.assign({}, L, { ep: 1000 })); mailSel = M.cs.length - 1; mailApply(); mailPanel(); }
        function mailDel(i) { const M = mailCur && mailCur.maille; if (!M || M.cs.length < 2) return; M.cs.splice(i, 1); mailSel = Math.max(0, i - 1); mailApply(); mailPanel(); }
        function mailCopy() { const M = mailCur && mailCur.maille; if (!M) return; mailClip = { k: M.k, cs: JSON.parse(JSON.stringify(M.cs)) }; updateCommandMessageText('MAILLAGE : couches copiées (' + M.cs.length + '). Sélectionnez d\'autres mailles puis « Coller », ou tracez-en de nouvelles : elles les reprennent.'); mailPanel(); }
        function mailPaste() { if (!mailClip) return; const T = selectedShapes.filter(x => x.maille && x.maille.k === mailClip.k); if (mailCur && mailCur.maille && !T.includes(mailCur)) T.push(mailCur); T.forEach(x => { x.maille.cs = JSON.parse(JSON.stringify(mailClip.cs)); }); mailApply(); mailPanel(); }
        // tableau collé : « haut bas description [classe] [MPa] » ou « bas description » ; virgule ou point décimal
        function mailParse(txt, k) { const out = []; let prev = 0;
            String(txt || '').split(/\r?\n/).forEach(line => { line = line.replace(/\t/g, '  ').trim(); if (!line) return; const m = line.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:m\b)?\s*(?:(?:à|-|–|a)\s*)?(?:(-?\d+(?:[.,]\d+)?)\s*(?:m\b)?)?\s*(.*)$/i); if (!m) return;
                const n1 = Math.abs(parseFloat(m[1].replace(',', '.'))), n2 = m[2] !== undefined ? Math.abs(parseFloat(m[2].replace(',', '.'))) : null, top = n2 === null ? prev : n1, bot = n2 === null ? n1 : n2; if (!(bot > top)) return; prev = bot;
                let rest = m[3] || '', c = { ep: Math.round((bot - top) * 1000) }; const lo = rest.toLowerCase();
                if (k === 'pol') { const cm = lo.match(/isdnd|isdd|isdi\s*\+|isdi|inerte/); c.cl = !cm ? 'na' : /isdnd/.test(cm[0]) ? 'isdnd' : cm[0] === 'isdd' ? 'isdd' : /\+/.test(cm[0]) ? 'isdip' : 'isdi'; const pol = rest.replace(/isdnd|isdd|isdi\s*\+|isdi|inerte/ig, '').replace(/\s{2,}/g, ' ').replace(/^[\s;,.-]+|[\s;,.-]+$/g, ''); if (pol) c.pol = pol; }
                else { const mp = rest.match(/(\d+(?:[.,]\d+)?)\s*mpa/i) || rest.match(/\s(\d+(?:[.,]\d+)?)\s*$/); if (mp) { c.mpa = parseFloat(mp[1].replace(',', '.')); rest = rest.replace(mp[0], ' '); }
                    const KW = [[/terre\s*v[ée]g|\btv\b|humus/, 'tv'], [/remblai/, 'remb'], [/limon/, 'limon'], [/argil/, 'argile'], [/sabl/, 'sable'], [/grave|galet|caillout/, 'grave'], [/marn/, 'marne'], [/craie/, 'craie'], [/calcair/, 'calc'], [/gr[èe]s/, 'gres'], [/schist/, 'schiste'], [/roch|granit|basalt|gneiss|dolomi/, 'rocher']];
                    const hit = KW.map(([r, id]) => ({ id, i: lo.search(r) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0]; c.sub = hit ? hit.id : 'limon'; const nm = rest.replace(/\s{2,}/g, ' ').trim(); if (nm && nm.toLowerCase() !== mailT('geo', c.sub)[1].toLowerCase()) c.nm = nm; }
                out.push(c); });
            return out; }
        function mailImport() { const M = mailCur && mailCur.maille, ta = document.getElementById('ml-paste'); if (!M || !ta) return; const cs = mailParse(ta.value, M.k);
            if (!cs.length) { updateCommandMessageText('MAILLAGE : aucune ligne reconnue (il faut au moins une profondeur par ligne).'); return; } M.cs = cs; mailSel = 0; mailApply(); mailPanel(); updateCommandMessageText('MAILLAGE : ' + cs.length + ' couche' + (cs.length > 1 ? 's' : '') + ' importée' + (cs.length > 1 ? 's' : '') + '.'); }
        // poignée de limite : glisser à la souris, pas de 5 cm ; l'échelle reste celle du début du glissé
        function mailDrag() { const svg = document.getElementById('ml-svg'); if (!svg) return; const Dv = +svg.dataset.dv;
            svg.onpointerdown = (e) => { const t = e.target, M = mailCur && mailCur.maille; if (!M) return; if (t.dataset.l !== undefined) { mailSel = +t.dataset.l; mailPanel(); return; } if (t.dataset.b === undefined) return;
                const i = +t.dataset.b, top = mailTops(M)[i][0], r = svg.getBoundingClientRect(), k = (Dv / 250) * (278 / r.height), y0 = r.top + (14 / 278) * r.height; e.preventDefault();
                const mv = (ev) => { M.cs[i].ep = Math.max(top + 50, Math.round(((ev.clientY - y0) * k) / 50) * 50) - top; const col = document.getElementById('ml-col'); if (col) col.innerHTML = mailSVG(M, i, Dv); };
                const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); mailSel = i; mailApply(); mailPanel(); };
                addEventListener('pointermove', mv); addEventListener('pointerup', up); }; }
        function drawMaille2D(c, s, col, dx, dy, lineScale) { const M = s.maille; if (!M || !M.cs.length || M.k === 'hyd') return;   // nappe : dessinée par l'eau
            const pick = M.k === 'pol' ? M.cs.reduce((a, x) => (MAIL_CL.findIndex(q => q[0] === x.cl) % 4) > (MAIL_CL.findIndex(q => q[0] === a.cl) % 4) ? x : a, M.cs[0]) : (M.cs.find(x => x.sub !== 'tv') || M.cs[0]);
            c.save(); c.globalAlpha = 0.16; c.fillStyle = mailCol(M.k, pick); c.beginPath(); s.points.forEach((q, k) => k ? c.lineTo(q.x + dx, q.y + dy) : c.moveTo(q.x + dx, q.y + dy)); c.closePath(); c.fill(); c.restore();
            const p = polyCentroid(s.points); if (s.name) dimensionTextsToDraw.push({ text: s.name, worldX: p.x + dx, worldY: p.y + dy, color: col, layerId: s.layerId }); }
        // DÉCOMPOSITION DES DÉBLAIS : échantillonnage du déblai (TN − terrain fini, fond de forme) ; chaque point prend les couches de la maille où il tombe
        let mailCC = null;
        function mailDecomp(CC, set) { const L = mailList(set); if (!CC || CC.err || !L.length) return null;
            const key = JSON.stringify([cubCC && cubCC.key, set, L.map(s => [s.points, s.maille.cs])]); if (mailCC && mailCC.key === key) return mailCC.v;
            const FM = CC.FM, tn = CC.tn; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            FM.P.forEach(p => { const e = (p.ext || 0); p.ring.forEach(q => { x0 = Math.min(x0, q.x - e); y0 = Math.min(y0, q.y - e); x1 = Math.max(x1, q.x + e); y1 = Math.max(y1, q.y + e); }); });
            if (!isFinite(x0)) return null; const st = Math.max(mmToWorld(100), Math.sqrt((x1 - x0) * (y1 - y0) / 90000)), a = Math.pow(mOf(st), 2);
            const C = L.map(s => { let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; s.points.forEach(q => { bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y); bx1 = Math.max(bx1, q.x); by1 = Math.max(by1, q.y); }); return { s, b: [bx0, by0, bx1, by1], T: mailTops(s.maille) }; });
            const k = L[0].maille.k, acc = {}, add = (key, v, c) => { const A = acc[key] || (acc[key] = { key, v: 0, col: c ? mailCol(k, c) : '#4b5563', nm: c ? mailNm(k, c) : 'Hors maillage', mpa: [], pol: new Set(), cells: new Set() }); A.v += v; return A; };
            let tot = 0;
            for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) { const r = FM.at(x, y); if (!r || !(r.kind > 0)) continue; const zt = tinZ(x, y, tn); if (!hasZ(zt)) continue; const d = zt - r.z; if (!(d > 1)) continue;
                const v = d / 1000 * a; tot += v; const cell = C.find(o => x >= o.b[0] && x <= o.b[2] && y >= o.b[1] && y <= o.b[3] && pointInPolygon(x, y, o.s.points));
                if (!cell) { add('_hors', v); continue; }
                cell.T.forEach(([t, b], i) => { const o = Math.min(d, b) - t; if (o <= 0) return; const c = cell.s.maille.cs[i], A = add(k === 'pol' ? c.cl : (c.nm || mailT('geo', c.sub)[1]) + '|' + c.sub, o / 1000 * a, c); A.cells.add(cell.s.name || '');
                    if (k !== 'pol' && hasZ(c.mpa)) A.mpa.push([+c.mpa, o / 1000 * a]); if (k === 'pol' && c.pol) String(c.pol).split(/[,;]/).forEach(q => q.trim() && A.pol.add(q.trim())); }); }
            if (!(tot > 0)) return null; const f = CC.D > 0 ? CC.D / tot : 1;
            const rows = Object.values(acc).map(A => { const W = A.mpa.reduce((s, q) => s + q[1], 0); return { nm: A.nm, col: A.col, pct: A.v / tot * 100, v: A.v * f, mpa: W > 0 ? A.mpa.reduce((s, q) => s + q[0] * q[1], 0) / W : null, mpaMax: A.mpa.length ? Math.max(...A.mpa.map(q => q[0])) : null, pol: [...A.pol].join(', '), cells: [...A.cells].filter(Boolean).sort().join(', '), hors: A.key === '_hors', cl: k === 'pol' ? A.key : null }; })
                .sort((a, b) => (a.hors - b.hors) || (k === 'pol' ? MAIL_CL.findIndex(q => q[0] === a.cl) - MAIL_CL.findIndex(q => q[0] === b.cl) : b.v - a.v));
            const v = { set, k, rows, D: CC.D, n: L.length, step: mOf(st) }; mailCC = { key, v }; return v; }
        function mailNoteCfg() { const N = mailNote || (mailNote = { on: {} }); N.on = N.on || {}; return N; }
        function mailCubHTML(CC) { const S = mailSets().filter(x => x.k !== 'hyd'); if (!S.length || !CC || CC.err) return ''; const N = mailNoteCfg(), td = 'padding:4px 8px;text-align:right;white-space:nowrap;';
            let h = `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #374151;"><div style="font-weight:600;margin-bottom:6px;">🧱 Déblais par couche (maillages)</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">`
                + S.map(x => `<label style="display:flex;gap:5px;align-items:center;cursor:pointer;font-size:13px"><input type="checkbox" ${N.on[x.set] ? 'checked' : ''} onchange="mailNoteCfg().on[${mailEsc(JSON.stringify(x.set))}]=this.checked;runCubature()"> ${mailEsc(x.set)} <span style="color:#9ca3af;font-size:11px">(${x.k === 'pol' ? 'pollution' : 'géologie'}, ${mailList(x.set).length} maille${mailList(x.set).length > 1 ? 's' : ''})</span></label>`).join('') + '</div>';
            S.filter(x => N.on[x.set]).forEach(x => { const R = mailDecomp(CC, x.set); if (!R) { h += `<p style="color:#9ca3af;font-size:12px">${mailEsc(x.set)} : aucun déblai.</p>`; return; }
                h += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px"><thead><tr style="color:#9ca3af"><th style="text-align:left;padding:4px 8px">${mailEsc(x.set)} — ${x.k === 'pol' ? 'classe' : 'couche'}</th><th style="${td}">Part</th><th style="${td}">Déblai</th><th style="text-align:left;padding:4px 8px">${x.k === 'pol' ? 'Pollution' : 'Dureté'}</th></tr></thead><tbody>`
                    + R.rows.map(r => `<tr style="border-top:1px solid #374151;${r.hors ? 'color:#9ca3af' : ''}"><td style="padding:4px 8px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${r.col};margin-right:6px"></span>${mailEsc(r.nm)}${r.cells ? ` <span style="color:#6b7280;font-size:11px">${mailEsc(r.cells)}</span>` : ''}</td><td style="${td}font-weight:700">${nfr(r.pct, 1)} %</td><td style="${td}color:#fca5a5">${nfr(r.v, 1)} m³</td><td style="padding:4px 8px;color:#d1d5db">${x.k === 'pol' ? mailEsc(r.pol || (r.hors ? '' : '—')) : r.mpa !== null ? nfr(r.mpa, 1) + ' MPa' + (r.mpaMax > r.mpa + 0.05 ? ' (max ' + nfr(r.mpaMax, 1) + ')' : '') : r.hors ? '' : '—'}</td></tr>`).join('')
                    + `<tr style="border-top:2px solid #6b7280;font-weight:700"><td style="padding:4px 8px">Total déblai</td><td style="${td}">100 %</td><td style="${td}color:#fca5a5">${nfr(R.D, 1)} m³</td><td></td></tr></tbody></table>`; });
            if (S.some(x => N.on[x.set])) h += `<p style="color:#9ca3af;font-size:12px;margin-top:6px">Couches comptées depuis le terrain naturel ; la dernière couche d'une maille continue vers le bas. Déblai des plateformes et des talus (fond de forme), réparti par mailles de ${nfr(mailDecomp(CC, S.find(x => N.on[x.set]).set)?.step || 0, 2)} m ; bassins et tranchées non compris.</p>`;
            return h + '</div>'; }
        function mailCubTSV(CC) { const N = mailNoteCfg(), o = []; mailSets().filter(x => x.k !== 'hyd' && N.on[x.set]).forEach(x => { const R = mailDecomp(CC, x.set); if (!R) return; o.push('', 'Maillage ' + x.set + '\tPart (%)\tDéblai (m³)\t' + (x.k === 'pol' ? 'Pollution' : 'Dureté (MPa)')); R.rows.forEach(r => o.push([r.nm, nfr(r.pct, 1), nfr(r.v, 1), x.k === 'pol' ? r.pol : r.mpa !== null ? nfr(r.mpa, 1) : ''].join('\t'))); }); return o; }
        /* l'outil Niveau d'eau passe par le maillage : une maille d'hydrogéologie porte la nappe */
        function startWater() { mailPick = { set: (mailSets().find(x => x.k === 'hyd') || { set: 'Nappe' }).set, k: 'hyd' }; startMaille(); }
        function startWaterOld() { setMode('poly'); waterDraw = true; updateCommandMessageText('NIVEAU D\'EAU : cliquez le contour de la zone (étang, rivière, bassin…), clic sur le 1er point ou double-clic pour fermer ; vous donnerez ensuite l\'altitude de l\'eau.'); }
        function waterLayerId() { let l = layers.find(x => x.name === 'Eau'); if (!l) { l = { id: generateId(), name: 'Eau', visible: true, color: '#38bdf8', dash: 'solid', width: 1 }; layers.push(l); updateLayerUI(); } return l.id; }
        function waterCreate(pts) {
            const P = pts.map(q => ({ x: q.x, y: q.y })), n = shapes.filter(s => s.water).length + 1; let zg;
            { const t = getTIN(), zs = t ? P.map(q => tinZ(q.x, q.y, t)).filter(hasZ) : []; zg = zs.length ? Math.round(Math.min(...zs)) : 0; }
            const s = { type: 'poly', layerId: waterLayerId(), points: P, open: false, hatch: false, water: { z: zg, name: 'Eau ' + n }, zk: 1, name: 'Eau ' + n };
            shapes.push(s); saveState(); selectedShapes = [s]; draw();
            setTimeout(() => { openSelectionParamModal(); setTimeout(() => { const e = document.getElementById('sp-wz'); if (e) { e.focus(); e.select(); } }, 60); }, 30);
            updateCommandMessageText('NIVEAU D\'EAU « ' + s.water.name + ' » : tapez l\'altitude de l\'eau, puis Appliquer. La zone sous ce niveau se colore en bleu.');
        }
        // masque de la zone inondée : cellules du contour où le terrain est sous le niveau (tout le contour s'il n'y a pas de terrain)
        function waterMask(s) {
            const t = getTIN(); let FM = null; try { FM = t ? finishedModel() : null; } catch (e) {} const key = JSON.stringify([s.points, s.water.z, t ? t.nodes.length : 0, !!t]) + (FM ? FM.sig : ''), c = WATER_CACHE.get(s); if (c && c.key === key && c.t === t) return c.m;   /* sol fini : une fouille, un bassin creusé se remplissent */
            const xs = s.points.map(q => q.x), ys = s.points.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const N = 140, cw = Math.max((x1 - x0), (y1 - y0)) / N || 1, nx = Math.max(1, Math.ceil((x1 - x0) / cw)), ny = Math.max(1, Math.ceil((y1 - y0) / cw)), runs = []; let A = 0, wet = 0;
            for (let j = 0; j < ny; j++) { const y = y0 + (j + 0.5) * cw; let r0 = -1;
                for (let i = 0; i <= nx; i++) { const x = x0 + (i + 0.5) * cw; let w = false;
                    if (i < nx && pointInPolygon(x, y, s.points)) { A++; let z = t ? tinZ(x, y, t) : undefined; if (FM && hasZ(z)) { const r = FM.at(x, y, z); if (r && hasZ(r.z)) z = r.z; } w = !t || !hasZ(z) || z < s.water.z; if (w) wet++; }
                    if (w && r0 < 0) r0 = i; else if (!w && r0 >= 0) { runs.push([x0 + r0 * cw, y0 + j * cw, (i - r0) * cw, cw]); r0 = -1; } } }
            const m = { runs, cw, wetA: wet * Math.pow(mOf(cw), 2), A: A * Math.pow(mOf(cw), 2) }; WATER_CACHE.set(s, { key, m, t }); return m;
        }
        function drawWater2D(c, s, col, sel, dx, dy, ls, isPrinting) {
            const m = waterMask(s); c.save(); c.fillStyle = 'rgba(56,189,248,0.32)';
            c.beginPath(); m.runs.forEach(([x, y, w, h]) => c.rect(x + dx, y + dy, w + 0.5 / ls, h + 0.5 / ls)); c.fill();
            c.restore();
            let gx = 0, gy = 0; s.points.forEach(q => { gx += q.x / s.points.length; gy += q.y / s.points.length; });
            if (!s.payOf) dimensionTextsToDraw.push({ text: '≈ ' + fmtZ(s.water.z) + ' m', worldX: gx + dx, worldY: gy + dy, color: sel ? '#ec4899' : '#7dd3fc', layerId: s.layerId });
        }
        // rive d'un niveau d'eau : là où le sol fini (terrain, talus, plateformes) croise le niveau, dans le contour (courbe de niveau sur une grille fine)
        function waterShore(s) { const xs = s.points.map(q => q.x), ys = s.points.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), c = Math.max(mmToWorld(400), Math.max(x1 - x0, y1 - y0) / 260);
            const nx = Math.ceil((x1 - x0) / c), ny = Math.ceil((y1 - y0) / c), V = new Float32Array((nx + 1) * (ny + 1)), out = [];
            for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * c, y = y0 + j * c; if (!pointInPolygon(x, y, s.points)) { V[j * (nx + 1) + i] = NaN; continue; } const z = groundZAt(x, y, false); V[j * (nx + 1) + i] = hasZ(z) ? z - s.water.z : 1; }
            const at = (i, j) => V[j * (nx + 1) + i], X = (i, j, i2, j2) => { const a = at(i, j), b = at(i2, j2), f = a / (a - b); return { x: x0 + (i + (i2 - i) * f) * c, y: y0 + (j + (j2 - j) * f) * c }; };
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]; if (v.some(isNaN)) continue; const P2 = [];
                if ((v[0] > 0) !== (v[1] > 0)) P2.push(X(i, j, i + 1, j)); if ((v[1] > 0) !== (v[2] > 0)) P2.push(X(i + 1, j, i + 1, j + 1)); if ((v[2] > 0) !== (v[3] > 0)) P2.push(X(i + 1, j + 1, i, j + 1)); if ((v[3] > 0) !== (v[0] > 0)) P2.push(X(i, j + 1, i, j));
                for (let k = 0; k + 1 < P2.length; k += 2) out.push([P2[k], P2[k + 1]]); }
            return out; }
        function waterBuild3D(root, P, Zm) {
            shapes.filter(s => s.water && s.points && s.points.length >= 3).forEach(s => { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) return;
                const sh = new THREE.Shape(s.points.map(q => { const r = P(q.x, q.y); return new THREE.Vector2(r.x, r.y); })), g = new THREE.ShapeGeometry(sh); g.translate(0, 0, Zm(s.water.z));
                { const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 4, pa.getY(i) / 4); uv.needsUpdate = true; }
                const m = new THREE.Mesh(g, v3WaterMat() || new THREE.MeshLambertMaterial({ color: 0x1d4ed8, emissive: 0x0c2a6b, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false })); m.renderOrder = 5; m.userData.shape = s; m.userData.water = true; root.add(m);
                if (V3.hq && V3.hq.riv) { const zl = Zm(s.water.z), E = waterShore(s).map(([a, b]) => { const p1 = P(a.x, a.y), p2 = P(b.x, b.y); return [[p1.x, p1.y, zl], [p2.x, p2.y, zl]]; }); if (E.length) v3RiverBanks(root, E, 10); } });
        }
        function trBuild3D(root, P, Zm, exag) {
            const G = trGround();
            const hexa = (c, color, op, cap) => { const g = new THREE.BufferGeometry(), v = []; c.forEach(q => v.push(q[0], q[1], q[2])); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
                g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 2, 6, 7, 2, 7, 3].concat(!cap || cap.b ? [1, 5, 6, 1, 6, 2] : [], !cap || cap.a ? [3, 7, 4, 3, 4, 0] : []));   // bouts fermés seulement aux regards (pas entre deux morceaux) g.computeVertexNormals();
                const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); root.add(m); return m; };
            const cyl = (A, B, r, color) => { const a = new THREE.Vector3(A.x, A.y, A.z), b = new THREE.Vector3(B.x, B.y, B.z), d = b.clone().sub(a), L = d.length(); if (L < 1e-6) return;
                const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 18, 1, false), new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }));
                m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); root.add(m); return m; };
            shapes.forEach(s => { if (!s.trench || s.points.length < 2) return; const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && l.visible === false) return;
                const tr = s.trench, hp = +tr.hp || 0, Wm = (+tr.W || 600) / 1000, lay = trTubeLayout(tr); trSync(s, G);
                // chaque tronçon est découpé tous les ~50 cm : le dessus suit le sol fini (plateforme, talus, terrain), le fond reste droit d'un regard à l'autre
                const SP = []; for (let i = 0; i < s.points.length - 1; i++) { const a0 = s.points[i], b0 = s.points[i + 1], Lm = mOf(Math.hypot(b0.x - a0.x, b0.y - a0.y)); if (Lm <= 0) continue; const n = Math.max(1, Math.min(200, Math.ceil(Lm / 0.5)));
                    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, I = (t) => ({ x: a0.x + (b0.x - a0.x) * t, y: a0.y + (b0.y - a0.y) * t, z: a0.z + (b0.z - a0.z) * t }); SP.push([I(t0), I(t1), { a: k === 0, b: k === n - 1, A0: a0, B0: b0 }]); } }
                for (let i = 0; i < SP.length; i++) { const a = SP[i][0], b = SP[i][1], A = P(a.x, a.y), B = P(b.x, b.y), L = Math.hypot(B.x - A.x, B.y - A.y); if (L < 1e-6) continue;
                    const nx = -(B.y - A.y) / L * Wm / 2, ny = (B.x - A.x) / L * Wm / 2, end = (q) => { const g = G(q.x, q.y), fond = q.z - hp; return { fond, D: Math.max(0, (hasZ(g) ? g : fond + (+tr.H || 1000)) - fond) }; };
                    const ea = end(a), eb = end(b), Ba = trLayerBands(tr, ea.D).bands, Bb = trLayerBands(tr, eb.D).bands;
                    (tr.layers || []).forEach((ly, j) => { const ba = Ba[j], bb = Bb[j]; if (!ba || (ba.h <= 0 && bb.h <= 0)) return; const colr = (TR_HK[trHatchKind(ly.mat)] || ['', '#9ca3af'])[1];
                        const z = (e, v) => Zm(e.fond + v);
                        hexa([[A.x - nx, A.y - ny, z(ea, ba.bot)], [B.x - nx, B.y - ny, z(eb, bb.bot)], [B.x + nx, B.y + ny, z(eb, bb.bot)], [A.x + nx, A.y + ny, z(ea, ba.bot)],
                              [A.x - nx, A.y - ny, z(ea, ba.top)], [B.x - nx, B.y - ny, z(eb, bb.top)], [B.x + nx, B.y + ny, z(eb, bb.top)], [A.x + nx, A.y + ny, z(ea, ba.top)]], colr, 0.32, SP[i][2]); });
                    if (SP[i][2].a) { const A0 = P(SP[i][2].A0.x, SP[i][2].A0.y), B0 = P(SP[i][2].B0.x, SP[i][2].B0.y), fa = SP[i][2].A0.z - hp, fb = SP[i][2].B0.z - hp;   // tubes : droits d'un regard à l'autre
                        lay.forEach(t => { const off = t.cx / 1000 / (Wm / 2), r = t.dn / 2000; cyl({ x: A0.x + nx * off, y: A0.y + ny * off, z: Zm(fa + t.cy) }, { x: B0.x + nx * off, y: B0.y + ny * off, z: Zm(fb + t.cy) }, r, '#e5e7eb'); }); } }
                s.points.forEach((q, i) => { if (!q.reg) return; const N = trNode(s, i, G), Q = P(q.x, q.y), r = (hasZ(q.regD) ? q.regD : (+tr.rd || 1000)) / 2000, top = hasZ(N.t) ? N.t : q.z + (+tr.H || 1000);
                    const m = cyl({ x: Q.x, y: Q.y, z: Zm(q.z - 200) }, { x: Q.x, y: Q.y, z: Zm(top) }, r + 0.08, '#9ca3af'); if (m) { m.material.transparent = true; m.material.opacity = 0.85; }
                    const cap = cyl({ x: Q.x, y: Q.y, z: Zm(top) }, { x: Q.x, y: Q.y, z: Zm(top) + 0.03 }, 0.3, '#1f2937'); });
            });
        }
        // sommet dont l'étiquette est sous le point monde w
        function trLabelAt(w) {
            for (let k = shapes.length - 1; k >= 0; k--) { const s = shapes[k]; if (!s.trench) continue; { const ly = layers.find(x => x.id === (s.layerId || 'layer-0')); if (ly && ly.visible === false) continue; }
                for (let i = 0; i < s.points.length; i++) { const lp = trLabelPos(s, i, camera.zoom); if (w.x >= lp.x && w.x <= lp.x + lp.w && w.y >= lp.y && w.y <= lp.y + lp.h) return { s, i }; } }
            return null;
        }
        // ---- coupe type à l'échelle (SVG)
        function trHatchKind(code) {
            const c = String(code || '').toUpperCase();
            if (c === '__REM') return 'rem'; if (/^(BB|EME|GB|ENROB)/.test(c)) return 'enr'; if (/SABLE|^S[CLH]\d?$/.test(c)) return 'sab';
            if (/TERRE/.test(c)) return 'tv'; if (/BETON|^BC|^BAC/.test(c)) return 'bet'; return 'gnt';
        }
        const TR_HK = { enr: ['#7f1d1d55', '#ef4444'], gnt: ['#1e1b4b88', '#818cf8'], sab: ['#1a2e05', '#d9f99d'], tv: ['#14532d66', '#4ade80'], bet: ['#33415588', '#cbd5e1'], rem: ['#422006aa', '#d6a26a'] };
        // coupe ↔ liste : cliquer une couche dans la coupe choisit sa ligne (et inversement)
        function trHi(i) { document.querySelectorAll('#tm-body [data-trow]').forEach(r => r.classList.toggle('tr-on', +r.dataset.trow === i)); document.querySelectorAll('#tm-body [data-tl]').forEach(r => { const on = +r.dataset.tl === i; r.setAttribute('stroke', on ? '#fbbf24' : '#9ca3af'); r.style.strokeWidth = on ? '3' : ''; }); }
        document.addEventListener('click', (e) => { const r = e.target.closest && e.target.closest('#tm-body [data-tl]'); if (!r) return; const i = +r.dataset.tl, row = document.querySelector(`#tm-body [data-trow="${i}"]`); trHi(i); if (row) { row.scrollIntoView({ block: 'nearest' }); const f = row.querySelector('select, input'); if (f) f.focus({ preventScroll: true }); } });
        function trSvg(tr, opt) {
            opt = opt || {}; const W = Math.max(100, +tr.W || 600), H = Math.max(100, +tr.H || 1000), B = trLayerBands(tr, H), T = trTubeLayout(tr);
            const PX = opt.w || 400, mlp = opt.mini ? 4 : 92, mrp = opt.mini ? 4 : 56, mx = Math.max(300, W * 0.6), X0 = -W / 2 - mx, X1 = W / 2 + mx;
            const k = (X1 - X0) / (PX - mlp - mrp), ml = mlp * k, vw = PX * k, mt = (opt.mini ? 6 : 18) * k, mb = (opt.mini ? 6 : 40) * k, vh = H + mt + mb;
            const Y = (y) => mt + H - y, sw = 1.3 * k, fs = 11 * k;
            const id = 'trp' + Math.random().toString(36).slice(2, 7);
            const pat = (key) => { const [bg, fg] = TR_HK[key], s = 14 * k;
                if (key === 'enr') return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M0 ${s} L${s} 0" stroke="${fg}" stroke-width="${0.9 * k}"/></pattern>`;
                if (key === 'gnt') return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M0 ${s} L${s} 0 M0 0 L${s} ${s}" stroke="${fg}" stroke-width="${0.7 * k}"/></pattern>`;
                if (key === 'sab') return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><circle cx="${s * .25}" cy="${s * .3}" r="${1.1 * k}" fill="${fg}"/><circle cx="${s * .75}" cy="${s * .7}" r="${1.1 * k}" fill="${fg}"/><path d="M${s * .6} ${s * .2} l${2 * k} ${3 * k} l${-4 * k} 0z" fill="${fg}"/></pattern>`;
                if (key === 'tv') return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M${s * .2} ${s * .8} l${s * .15} ${-s * .3} l${s * .15} ${s * .3}" stroke="${fg}" fill="none" stroke-width="${0.8 * k}"/></pattern>`;
                if (key === 'bet') return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><circle cx="${s * .3}" cy="${s * .4}" r="${1.4 * k}" fill="none" stroke="${fg}" stroke-width="${0.6 * k}"/><path d="M${s * .7} ${s * .6} l${2 * k} ${2 * k}" stroke="${fg}" stroke-width="${0.6 * k}"/></pattern>`;
                return `<pattern id="${id}${key}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M${s * .1} ${s * .3} h${s * .3} M${s * .55} ${s * .75} h${s * .3}" stroke="${fg}" stroke-width="${0.8 * k}"/></pattern>`; };
            let h = `<svg viewBox="${X0 - ml} 0 ${vw} ${vh}" width="100%" style="display:block;background:#1e1e1e;border-radius:6px;" xmlns="http://www.w3.org/2000/svg"><defs>${Object.keys(TR_HK).map(pat).join('')}
                <pattern id="${id}sol" width="${40 * k}" height="${40 * k}" patternUnits="userSpaceOnUse"><path d="M0 ${40 * k} L${40 * k} 0" stroke="#52525b" stroke-width="${0.9 * k}"/></pattern></defs>`;
            // terrain de part et d'autre
            h += `<rect x="${X0}" y="${Y(H)}" width="${X1 - X0}" height="${H}" fill="url(#${id}sol)"/>`;
            h += `<line x1="${X0}" y1="${Y(H)}" x2="${X1}" y2="${Y(H)}" stroke="#71717a" stroke-width="${sw}"/>`;
            // couches
            (tr.layers || []).forEach((l, i) => { const b = B.bands[i]; if (!b || b.h <= 0) return; const key = trHatchKind(l.mat);
                h += `<rect x="${-W / 2}" y="${Y(b.top)}" width="${W}" height="${b.h}" fill="url(#${id}${key})" stroke="#9ca3af" stroke-width="${sw * 0.8}" data-tl="${i}" style="cursor:pointer"><title>${MF.esc(trMatName(l.mat) || '')}</title></rect>`; });
            h += `<rect x="${-W / 2}" y="${Y(H)}" width="${W}" height="${H}" fill="none" stroke="#d4d4d8" stroke-width="${sw}"/>`;
            // tubes : paroi extérieure + intérieure
            T.forEach(t => { const r = t.dn / 2, e = Math.max(3, t.dn * 0.05); h += `<circle cx="${t.cx}" cy="${Y(t.cy)}" r="${r}" fill="#1e1e1e" stroke="#e4e4e7" stroke-width="${sw}"/><circle cx="${t.cx}" cy="${Y(t.cy)}" r="${r - e}" fill="none" stroke="#a1a1aa" stroke-width="${sw * 0.7}"/>`; });
            if (opt.mini) return h + '</svg>';
            // fil d'eau
            if (T.length) { const t0 = T[0], yfe = Y(t0.cy - t0.dn / 2), xr = W / 2 + 34 * k;
                h += `<line x1="${t0.cx}" y1="${yfe}" x2="${xr + 6 * k}" y2="${yfe}" stroke="#38bdf8" stroke-width="${sw * 0.8}" stroke-dasharray="${4 * k} ${3 * k}"/><text x="${xr + 9 * k}" y="${yfe + fs * 0.35}" fill="#38bdf8" font-size="${fs}" font-family="Arial" font-weight="bold">FE</text>`; }
            // cotes : chaîne des couches, hauteur totale, largeur
            const dc = '#f59e0b', tick = (x, y) => `<path d="M${x - 5 * k} ${y + 5 * k} L${x + 5 * k} ${y - 5 * k}" stroke="${dc}" stroke-width="${sw}"/>`;
            const vdim = (x, y0, y1, label) => { const ym = (Y(y0) + Y(y1)) / 2; return `<line x1="${x}" y1="${Y(y0)}" x2="${x}" y2="${Y(y1)}" stroke="${dc}" stroke-width="${sw * 0.9}"/>${tick(x, Y(y0))}${tick(x, Y(y1))}`
                + (Math.abs(y1 - y0) > fs * 2.2 ? `<text x="${x - 4 * k}" y="${ym}" fill="${dc}" font-size="${fs}" font-family="Arial" font-weight="bold" text-anchor="middle" transform="rotate(-90 ${x - 4 * k} ${ym})">${label}</text>` : `<text x="${x - 8 * k}" y="${ym + fs * 0.35}" fill="${dc}" font-size="${fs * 0.9}" font-family="Arial" font-weight="bold" text-anchor="end">${label}</text>`); };
            const xc = X0 - 30 * k, xt = X0 - 70 * k;
            B.bands.forEach(b => { if (!b || b.h <= 0) return; h += `<line x1="${xc - 6 * k}" y1="${Y(b.top)}" x2="${-W / 2}" y2="${Y(b.top)}" stroke="${dc}" stroke-width="${sw * 0.6}"/>` + vdim(xc, b.bot, b.top, trM(b.h)); });
            h += `<line x1="${xc - 6 * k}" y1="${Y(0)}" x2="${-W / 2}" y2="${Y(0)}" stroke="${dc}" stroke-width="${sw * 0.6}"/>` + vdim(xt, 0, H, trM(H));
            if (T.length && +tr.hp > 0) { const xr = W / 2 + 26 * k; h += vdim(xr, 0, +tr.hp, trM(tr.hp)); }
            const yb = Y(0) + 26 * k; h += `<line x1="${-W / 2}" y1="${yb}" x2="${W / 2}" y2="${yb}" stroke="${dc}" stroke-width="${sw * 0.9}"/>${tick(-W / 2, yb)}${tick(W / 2, yb)}<line x1="${-W / 2}" y1="${Y(0)}" x2="${-W / 2}" y2="${yb + 8 * k}" stroke="${dc}" stroke-width="${sw * 0.6}"/><line x1="${W / 2}" y1="${Y(0)}" x2="${W / 2}" y2="${yb + 8 * k}" stroke="${dc}" stroke-width="${sw * 0.6}"/>`
                + `<text x="0" y="${yb - 6 * k}" fill="${dc}" font-size="${fs}" font-family="Arial" font-weight="bold" text-anchor="middle">${trM(W)}</text>`;
            return h + '</svg>';
        }
        // ---- éditeur du profil type (tiroir de l'outil et fenêtre Y)
        function trMatOpts(cur, tube) {
            const L = matCatalog.filter(m => tube ? m.pu === 'ml' : (m.pu !== 'ml' && m.code !== '__DEB' && !m.surf)), E = MF.esc;
            const has = L.some(m => m.code === cur);
            return (has ? '' : `<option value="${E(cur)}" selected>${E(trMatName(cur))}</option>`) + L.map(m => `<option value="${E(m.code)}"${m.code === cur ? ' selected' : ''}>${E(trMatName(m.code))}${tube && m.dn ? '' : ''}</option>`).join('');
        }
        function trEditorHTML(ctx) {
            const t = trEdit, E = MF.esc, inl = (k, v, extra) => `<input class="mf-in" style="width:4.6rem;" value="${E(v)}" oninput="trSet('${k}',this.value)" ${extra || ''}>`;
            const B = trLayerBands(t, +t.H || 0);
            let h = `<div class="flex flex-col gap-1.5">`;
            if (ctx === 'tool') h += `<div class="mf-row"><span class="mf-l">Historique</span><span class="mf-c"><select class="mf-in mf-sel" style="width:15rem;" onchange="trLoadType(this.value)"><option value="">— reprendre un profil —</option>${trTypes.map((x, i) => `<option value="${i}">${E(x.name || 'Profil ' + (i + 1))} · ${trM(x.W)} × ${trM(x.H)}</option>`).join('')}</select></span></div>`;
            h += MF.row('Nom', `<input class="mf-in mf-wide" value="${E(t.name || '')}" placeholder="ex. EU 1" oninput="trEdit.name=this.value">`, '');
            h += `<div id="tr-svg">${trSvg(t)}</div>`;
            h += MF.row('Largeur', inl('W', trM(t.W)), LUN()) + MF.row('Hauteur (sol → fond de fouille)', inl('H', trM(t.H)), LUN()) + MF.row('Hauteur de pose (fond → dessous des tubes)', inl('hp', trM(t.hp)), LUN());
            h += `<div class="mf-sub">Remplissage, du haut vers le bas</div><div class="tr-grid tr-head"><span>Produit</span><span>h (${LUN()})</span><span title="Couche variable : prend la hauteur qui reste">↕</span><span></span><span></span></div>`;
            (t.layers || []).forEach((l, i) => { const b = B.bands[i] || { h: 0 };
                h += `<div class="tr-grid" data-trow="${i}" onfocusin="trHi(${i})"><select class="mf-in mf-sel" style="width:100%;" onchange="trLay(${i},'mat',this.value)">${trMatOpts(l.mat)}</select>
                    ${l.v ? `<span class="tr-var" id="tr-vh-${i}">${trM(b.h)}</span>` : `<input class="mf-in" value="${trM(l.h)}" oninput="trLay(${i},'h',this.value)">`}
                    <input type="radio" name="tr-var" title="Couche variable (complément jusqu'au sol)" ${l.v ? 'checked' : ''} onchange="trLay(${i},'v',1)">
                    <span class="flex flex-col leading-none"><button type="button" class="tr-mv" title="Monter" onclick="trMove(${i},-1)">▲</button><button type="button" class="tr-mv" title="Descendre" onclick="trMove(${i},1)">▼</button></span>
                    <button type="button" class="st-x" title="Retirer la couche" onclick="trDel('layers',${i})">✕</button></div>`; });
            h += `<div class="mf-row"><button type="button" class="mf-link" style="margin:0;" onclick="trAdd('layers')">+ Nouvelle couche</button><span class="mf-hint" id="tr-short">${B.short ? '<span style="color:#f87171;">Les couches fixes dépassent la hauteur.</span>' : ''}</span></div>`;
            h += `<div class="mf-sub">Tubes (posés côte à côte, le premier donne le fil d'eau)</div><div class="tr-grid tr-grid-t tr-head"><span>Produit</span><span>Nombre</span><span></span></div>`;
            (t.tubes || []).forEach((u, i) => { h += `<div class="tr-grid tr-grid-t"><select class="mf-in mf-sel" style="width:100%;" onchange="trTube(${i},'mat',this.value)">${trMatOpts(u.mat, true)}</select><input class="mf-in" value="${E(u.n)}" oninput="trTube(${i},'n',this.value)"><button type="button" class="st-x" title="Retirer" onclick="trDel('tubes',${i})">✕</button></div>`; });
            h += `<div class="mf-row"><button type="button" class="mf-link" style="margin:0;" onclick="trAdd('tubes')">+ Ajouter des tubes</button></div>` + MF.row('Espace entre deux tubes', inl('gap', trM(t.gap)), LUN()) + MF.row('Regards : Ø intérieur par défaut', inl('rd', trM(t.rd || 1000)), LUN());
            h += `<label class="mf-ck"><input type="checkbox" ${t.grav !== false ? 'checked' : ''} onchange="trEdit.grav=this.checked"><span>Réseau <b>gravitaire</b> : tracé de l'amont vers l'aval ; la pente s'affiche <span style="color:#4ade80">&gt;&gt; en vert</span> dans le bon sens, <span style="color:#ef4444">&lt;&lt; en rouge</span> à contre-pente</span></label>`;
            h += `<div id="tr-sum" class="mf-hint">${trSumHTML()}</div>`;
            if (ctx === 'tool') h += `<div class="mf-row"><span class="mf-hint">Chaque profil tracé rejoint l'historique (10 derniers).</span><button type="button" class="mf-link" style="margin:0;" onclick="closeTopoModal();openSettingsMat()">Prix des produits…</button></div>`;
            return h + '</div>';
        }
        function trSumHTML() {   // quantités pour 1 m de tranchée à la hauteur type
            const t = trEdit, S = trSection(t, +t.H || 0); let cout = 0;
            const parts = (t.layers || []).map((l, j) => { const m = structMat(l.mat), q = { v: S.layers[j], vf: S.layers[j] * (m.coef || 1), t: S.layers[j] * (m.d || 0), A: 0 }; cout += matCost(m, q).cout; return S.layers[j] > 1e-9 ? `${MF.esc(trMatName(l.mat))} ${nfr(S.layers[j], 3)} m³` : ''; }).filter(Boolean);
            { const m = structMat('__DEB'); cout += matCost(m, { v: S.fouille, vf: S.fouille * m.coef, t: S.fouille * m.d, A: 0 }).cout; }
            (t.tubes || []).forEach(u => { cout += matCost(structMat(u.mat), { ml: Math.max(0, +u.n || 0), v: 0, vf: 0, t: 0, A: 0 }).cout; });
            return `Par mètre de tranchée : déblai <b class="text-white">${nfr(S.fouille, 3)} m³</b> · ${parts.join(' · ')}${cout > 0 ? ' · <b class="text-white">' + nfr(cout, 2) + ' € HT/m</b>' : ''}`;
        }
        function trRefresh() { const v = document.getElementById('tr-svg'); if (v) v.innerHTML = trSvg(trEdit); const s = document.getElementById('tr-sum'); if (s) s.innerHTML = trSumHTML();
            const B = trLayerBands(trEdit, +trEdit.H || 0); (trEdit.layers || []).forEach((l, i) => { const e = document.getElementById('tr-vh-' + i); if (e) e.textContent = trM(B.bands[i].h); });
            const sh = document.getElementById('tr-short'); if (sh) sh.innerHTML = B.short ? '<span style="color:#f87171;">Les couches fixes dépassent la hauteur.</span>' : ''; }
        function trRerender() { const b = document.getElementById('tr-box'); if (b) b.innerHTML = trEditorHTML(b.dataset.ctx); }
        function trSet(k, v) { const n = trNum(v); if (!(n >= 0)) return; trEdit[k] = Math.round(n * lenF()); trRefresh(); }
        function trLay(i, k, v) { const l = trEdit.layers[i]; if (!l) return;
            if (k === 'mat') { l.mat = v; trRerender(); return; }
            if (k === 'v') { trEdit.layers.forEach((x, j) => { x.v = j === i; }); trRerender(); return; }
            const n = trNum(v); if (n >= 0) { l.h = Math.round(n * lenF()); trRefresh(); } }
        function trTube(i, k, v) { const u = trEdit.tubes[i]; if (!u) return; if (k === 'mat') { u.mat = v; trRefresh(); return; } const n = trNum(v); if (n >= 0) { u.n = Math.round(n); trRefresh(); } }
        function trAdd(k) { if (k === 'layers') trEdit.layers.splice(Math.max(0, trEdit.layers.length - 1), 0, { mat: 'GNT_0_315', h: 200 }); else { const t = matCatalog.find(m => m.pu === 'ml'); trEdit.tubes.push({ mat: t ? t.code : 'PVC_CR8_200', n: 1 }); } trRerender(); }
        function trDel(k, i) { trEdit[k].splice(i, 1); trRerender(); }
        function trMove(i, d) { const L = trEdit.layers, j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; trRerender(); }
        function trLoadType(i) { const t = trTypes[+i]; if (!t) return; const nm = trEdit.name; trEdit = trClone(t); if (trEditFrom === 'shape') trEdit.name = nm; trRerender(); }
        function trSaveType() { const nm = prompt('Nom du type de tranchée :', trEdit.name || 'Nouveau type'); if (!nm) return; const t = trClone(trEdit); t.name = nm.trim(); const k = trTypes.findIndex(x => x.name === t.name);
            if (k >= 0) { if (!confirm('Remplacer le type « ' + t.name + ' » ?')) return; trTypes[k] = t; } else trTypes.push(t); trTypesSave(); trRerender(); updateCommandMessageText('Type de tranchée « ' + t.name + ' » enregistré (sur ce poste et dans le gabarit).'); }
        function openSettingsMat() { openCartoucheModal(); psTab('mat'); }
        // ---- l'outil : tiroir du profil type, puis tracé comme une polyligne (de l'amont vers l'aval)
        function startTrench(fromType) {
            if (fromType !== undefined && trTypes[fromType]) trCur = trClone(trTypes[fromType]);
            trEdit = trClone(trCur); trEditFrom = 'tool';
            openTopoModal('Tranchée', `<p class="mf-hint" style="margin-bottom:8px;">Règle le profil type, puis <b>Tracer</b> : clique les sommets de l'<b>amont vers l'aval</b>. La tranchée se cale sous le sol fini (terrain et plateformes) ; chaque sommet porte son étiquette FE / T, modifiable d'un double-clic.</p><div id="tr-box" data-ctx="tool">${trEditorHTML('tool')}</div>`,
                [['Annuler', () => closeTopoModal(), false], ['Tracer', () => trStartDraw(), true]]);
        }
        function trHistPush(t) { const key = (x) => JSON.stringify(Object.assign({}, x, { name: '' })); const k = key(t); trTypes = [trClone(t)].concat(trTypes.filter(x => key(x) !== k)).slice(0, 10); trTypesSave(); }
        function trStartDraw() { trCur = trClone(trEdit); trHistPush(trCur); closeTopoModal(); setMode('pline'); trenchDraw = trClone(trCur); updateCommandMessage(); }
        function trCreate(P) {
            const tr = trClone(trenchDraw || trCur), n = shapes.filter(s => s.trench).length + 1; if (!tr.name) tr.name = 'Tranchée ' + n;
            const s = { type: 'poly', layerId: trLayerId(), points: P.map(q => ({ x: q.x, y: q.y })), open: true, hatch: false, trench: tr, zk: 1, name: tr.name };
            trSync(s); shapes.push(s); return s;
        }
        // ---- fenêtre Y : profil, sommets (FE / T), quantités
        function trNodesHTML(s, focus) {
            const G = trGround();
            return `<div class="tr-grid tr-grid-n tr-head"><span>Sommet</span><span title="Fil d'eau (vide = automatique : sol − hauteur + pose)">FE (m)</span><span title="Tampon du regard (seulement là où il y a un regard), indicatif">T (m)</span><span title="Profondeur du fond de fouille">Prof.</span></div>`
                + s.points.map((q, i) => { const N = trNode(s, i, G), d = hasZ(N.t) ? (N.t - N.fe + (+s.trench.hp || 0)) : NaN;
                    return `<div class="tr-grid tr-grid-n${i === focus ? ' tr-focus' : ''}"><span class="text-gray-300 text-xs">n° ${i + 1}${i ? ' <span style="color:' + (s.trench.grav !== false && trSlope(s, i - 1) <= 0.0005 ? '#f87171' : '#6b7280') + '">' + nfr(trSlope(s, i - 1), 2) + ' %</span>' : ''}</span>
                        <input id="tr-fe-${i}" class="mf-in" value="${N.feMan ? fmtZ(N.fe) : ''}" placeholder="${fmtZ(N.feA)}">
                        ${q.reg ? `<input id="tr-t-${i}" class="mf-in" value="${N.tMan ? fmtZ(N.t) : ''}" placeholder="${hasZ(N.tA) ? fmtZ(N.tA) : '?'}" title="Tampon du regard">` : '<span class="text-xs text-gray-600 text-center" title="Pas de regard à ce sommet : pas de tampon (clic sur le sommet pour en mettre un)">—</span>'}
                        <span class="text-xs text-right" style="color:${isFinite(d) && d < 0 ? '#f87171' : '#9ca3af'}">${isFinite(d) ? trM(d) : '—'}</span></div>`; }).join('')
                + MF.hint('Champ vide = valeur automatique (grisée). <b>FE</b> imposé : il fixe la hauteur du sommet et la profondeur de la tranchée à cet endroit. <b>T</b> n\'existe que là où il y a un <b>regard</b> (clic sur le sommet pour en mettre un) ; il est purement indicatif (cote finie du tampon). Les valeurs imposées sont marquées * sur le plan.');
        }
        function trQtyHTML(s) {
            const Q = trQty(s), R = trQtyRows(s, Q), P = R.some(r => r.prix > 0), tot = R.reduce((a, r) => a + r.cout, 0);
            return `<div class="mf-hint">Longueur <b class="text-white">${nfr(Q.L, 2)} m</b> · profondeur ${trM(Q.Dmin)} à ${trM(Q.Dmax)} ${LUN()} (moy. ${trM(Q.Dmoy)})${Q.noGround ? ' · <span style="color:#fbbf24;">sol inconnu par endroits : hauteur type utilisée</span>' : ''}</div>
                <table class="st-q"><tr><th>Poste</th><th>Quantité</th><th>tonnes</th>${P ? '<th>montant</th>' : ''}</tr>${R.map(r => `<tr><td>${MF.esc(r.name)}</td><td>${r.pu === 'u' ? nfr(r.qp, 0) + ' u' : r.pu === 'ml' ? nfr(r.ml, 2) + ' ml' : nfr(r.v, 2) + ' m³'}</td><td>${r.pu === 'ml' || r.pu === 'u' ? '—' : nfr(r.t, 1)}</td>${P ? '<td>' + (r.prix > 0 ? nfr(r.cout, 2) + ' €' : '—') + '</td>' : ''}</tr>`).join('')}
                ${P ? `<tr><td><b>Total HT</b></td><td></td><td></td><td><b>${nfr(tot, 2)} €</b></td></tr>` : ''}</table>`;
        }
        function trApplyY(one) {
            if (!trEdit || !one || !one.trench || !document.getElementById('tr-box')) return false;
            one.trench = trClone(trEdit); if (trEdit.name) one.name = trEdit.name;
            one.points.forEach((q, i) => { const fe = document.getElementById('tr-fe-' + i), t = document.getElementById('tr-t-' + i);
                if (fe) { const v = trNum(fe.value); if (fe.value.trim() === '' || !isFinite(v)) delete q.feM; else q.feM = Math.round(v * 1000); }
                if (t && q.reg) { const v = trNum(t.value); if (t.value.trim() === '' || !isFinite(v)) delete q.tM; else q.tM = Math.round(v * 1000); } else if (!q.reg) delete q.tM; });
            trSync(one); trEdit = null; return true;
        }
        function trOpenNode(s, i) {
            if (typeof t2Sel !== 'undefined') t2Sel = null; isDrawing = false; selectedShapes = [s]; draw(); openSelectionParamModal();
            updateCommandMessageText('TRANCHÉE « ' + (s.trench.name || '') + ' », sommet n° ' + (i + 1) + ' : saisis FE et/ou T (champ vide = automatique), puis Appliquer.');
            setTimeout(() => { const d = document.querySelector('#selparam-z details[data-k="trnodes"]') || [...document.querySelectorAll('#selparam-z details')].find(x => /Sommets/.test(x.textContent)); if (d) d.open = true;
                const e = document.getElementById('tr-fe-' + i); if (e) { e.scrollIntoView({ block: 'center' }); e.focus(); } }, 60);
        }
        // ---- métré des tranchées (palette Topo) et lignes pour Σ Métré
        function trAllRows() {
            const by = new Map();
            shapes.filter(s => s.trench && s.points.length > 1).forEach(s => trQtyRows(s).forEach(r => { const k = r.code + (r.code === '__DEB' ? '' : ''); const o = by.get(k) || Object.assign({}, r, { v: 0, vf: 0, t: 0, ml: 0, qp: 0, cout: 0, name: r.code === '__DEB' ? 'Déblai de tranchées' : /^REGARD_/.test(r.code) ? 'Regards Ø' + trM(+r.code.slice(7)) : trMatName(r.code) });
                o.v += r.v; o.vf += r.vf; o.t += r.t; o.ml += r.ml || 0; o.qp += r.qp; o.cout += r.cout; by.set(k, o); }));
            return [...by.values()];
        }
        function openTrenchMetre() {
            const T = shapes.filter(s => s.trench && s.points.length > 1);
            if (!T.length) { updateCommandMessageText('MÉTRÉ DES TRANCHÉES : aucune tranchée dans le plan. Outil Tranchée (palette Topo) pour en tracer une.'); return; }
            const per = T.map(s => ({ s, Q: trQty(s) })), all = trAllRows(), P = all.some(r => r.prix > 0), tot = all.reduce((a, r) => a + r.cout, 0);
            const row = (s, Q) => { const R = trQtyRows(s, Q), c = R.reduce((a, r) => a + r.cout, 0); return `<tr style="cursor:pointer;" onclick="trPick(${shapes.indexOf(s)})"><td>${MF.esc(s.trench.name || s.name || 'Tranchée')}</td><td>${nfr(Q.L, 2)} m</td><td>${trM(Q.Dmoy)} m</td><td>${nfr(Q.Vf, 2)} m³</td><td>${Q.tubes.map(t => (t.n > 1 ? t.n + ' × ' : '') + MF.esc(trMatName(t.mat))).join(', ') || '—'}</td>${P ? '<td>' + (c > 0 ? nfr(c, 2) + ' €' : '—') + '</td>' : ''}</tr>`; };
            const body = `<div class="mf-sub" style="margin-bottom:4px;">Par tranchée (clic = sélectionner)</div><table class="st-q"><tr><th>Tranchée</th><th>Longueur</th><th>Prof. moy.</th><th>Déblai</th><th>Tubes</th>${P ? '<th>Montant HT</th>' : ''}</tr>${per.map(o => row(o.s, o.Q)).join('')}</table>
                <div class="mf-sub" style="margin:14px 0 4px;">Totaux par produit</div><table class="st-q"><tr><th>Produit</th><th>En place</th><th>Foisonné</th><th>Tonnes</th>${P ? '<th>Prix</th><th>Montant HT</th>' : ''}</tr>${all.map(r => `<tr><td>${MF.esc(r.name)}</td><td>${r.pu === 'ml' ? nfr(r.ml, 2) + ' ml' : nfr(r.v, 2) + ' m³'}</td><td>${r.pu === 'ml' ? '—' : nfr(r.vf, 2) + ' m³'}</td><td>${r.pu === 'ml' ? '—' : nfr(r.t, 1)}</td>${P ? '<td>' + (r.prix > 0 ? nfr(r.prix, 2) + ' €/' + PU_UNIT[r.pu].replace(' fois.', '') : '—') + '</td><td>' + (r.prix > 0 ? nfr(r.cout, 2) + ' €' : '—') + '</td>' : ''}</tr>`).join('')}
                ${P ? `<tr><td><b>Total HT</b></td><td></td><td></td><td></td><td></td><td><b>${nfr(tot, 2)} €</b></td></tr>` : ''}</table>
                <p class="mf-hint" style="margin-top:8px;">Volumes calculés tous les 25 cm le long du tracé, avec la profondeur réelle sous le sol fini. Les tubes sont déduits des couches qu'ils traversent. ${P ? '' : 'Prix à saisir dans '}<button type="button" class="mf-link" style="margin:0;" onclick="closeTopoModal();openSettingsMat()">le catalogue produits</button>. Ces lignes sont aussi dans Σ Métré.</p>`;
            openTopoModal('Métré des tranchées', body, [['Copier (tableur)', () => copyText(trMetreTSV()), false], ['Fermer', () => closeTopoModal(), true]]);
        }
        function trPick(k) { const s = shapes[k]; if (!s) return; selectedShapes = [s]; draw(); }
        function trMetreTSV() { return 'Produit\tQuantité\tUnité\tMontant HT\n' + trAllRows().map(r => [r.name, r.pu === 'ml' ? nfr(r.ml, 2) : nfr(r.v, 2), r.pu === 'ml' ? 'ml' : 'm³', r.prix > 0 ? nfr(r.cout, 2) : ''].join('\t')).join('\n'); }
        // ---- bibliothèque des types de tranchée (palette Topo)
        function openTrenchTypes() {
            const E = MF.esc;
            const body = `<p class="mf-hint" style="margin-bottom:8px;">Tes profils de tranchée prêts à tracer. Enregistrés sur ce poste et dans le gabarit (.gbt). Pour en créer un : outil Tranchée, règle le profil, <b>Enregistrer comme type</b>.</p>
                <div class="flex flex-col gap-2">${trTypes.map((t, i) => `<div class="tr-type"><div class="tr-type-svg">${trSvg(t, { mini: true, w: 110 })}</div><div class="flex-1 min-w-0"><div class="text-white text-sm font-semibold truncate">${E(t.name || 'Type ' + (i + 1))}</div>
                    <div class="text-xs text-gray-400">${trM(t.W)} × ${trM(t.H)} ${LUN()} · ${(t.tubes || []).map(u => (u.n > 1 ? u.n + ' × ' : '') + E(trMatName(u.mat))).join(', ') || 'sans tube'}</div>
                    <div class="flex gap-3 mt-1"><button type="button" class="mf-link" style="margin:0;" onclick="closeTopoModal();startTrench(${i})">Tracer avec ce type</button><button type="button" class="mf-link" style="margin:0;" onclick="trTypeRename(${i})">Renommer</button><button type="button" class="mf-link" style="margin:0;color:#f87171;" onclick="trTypeDel(${i})">Supprimer</button></div></div></div>`).join('') || '<div class="mf-hint">Aucun type.</div>'}</div>
                <div class="mt-3"><button type="button" class="text-xs text-gray-400 hover:text-gray-200" onclick="trTypesReset()">Rétablir les types d'origine</button></div>`;
            openTopoModal('Types de tranchée', body, [['Fermer', () => closeTopoModal(), true]]);
        }
        function trTypeRename(i) { const t = trTypes[i]; if (!t) return; const nm = prompt('Nouveau nom :', t.name); if (!nm) return; t.name = nm.trim(); trTypesSave(); openTrenchTypes(); }
        function trTypeDel(i) { const t = trTypes[i]; if (!t || !confirm('Supprimer le type « ' + t.name + ' » ?')) return; trTypes.splice(i, 1); trTypesSave(); openTrenchTypes(); }
        function trTypesReset() { if (!confirm('Rétablir les types de tranchée d\'origine ? Tes types seront perdus.')) return; trTypes = trClone(TR_DEFAULT_TYPES); trTypesSave(); openTrenchTypes(); }
        // résumé des talus réellement utilisés : seulement remblai et/ou déblai selon le terrain, ou le détail par arête
        function talusInfo(s, html) {
            const t = platTalus(s); if (!t.on) return 'sans talus';
            const R = (k) => html ? '<span class="text-blue-300">remblai ' + k + '</span>' : 'remblai ' + k, D = (k) => html ? '<span class="text-red-300">déblai ' + k + '</span>' : 'déblai ' + k;
            let side = [];
            if (s.type === 'poly') side = s.points.map((q, i) => talEdgeTN(s, i));
            else if (s.type === 'circle') { const tin = getTIN(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, z = tin ? tinZ(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), tin) : undefined; side.push(hasZ(z) && hasZ(s.z) ? z - s.z : NaN); } }
            const known = side.filter(isFinite), anyD = !known.length || known.some(v => v > 0), anyR = !known.length || known.some(v => v < 0);
            if (t.cx && s.type === 'poly') { const E = t.edges || []; let nd = 0, nr = 0, np = 0; side.forEach((v, i) => { if (E[i] && E[i].off) np++; else if (v < 0) nr++; else nd++; });
                return 'par arête : ' + [nd ? nd + ' en déblai' : '', nr ? nr + ' en remblai' : '', np ? np + ' paroi' + (np > 1 ? 's' : '') : ''].filter(Boolean).join(' · '); }
            return [anyR ? R(t.kR) : '', anyD ? D(t.kD) + (t.R ? ' · recul ' + nfr(t.R / 1000, 2) + ' m' : '') : ''].filter(Boolean).join(' · ');
        }
        function talusSum(one) { return talusInfo(one); }
        function spWallH() { const b = document.getElementById('sp-wzb'), t = document.getElementById('sp-wzt'), hh = document.getElementById('sp-wzhh');
            const bv = parseFloat(String(b.value).replace(',', '.')), hv = parseFloat(String(hh.value).replace(',', '.'));
            if (!isNaN(hv)) { const base = isNaN(bv) ? 0 : bv; if (isNaN(bv)) b.value = '0,00'; t.value = nfr(base + hv * lenF() / 1000, 2).replace(/\s/g, ''); } }
        // ---- Plateforme inclinée / rampe (fenêtre Y) ----
        let spDirPick = null;
        function spPlatMode() { const incl = (document.querySelector('input[name=sp-pmode]:checked') || {}).value === 'incl'; document.getElementById('sp-flatbox').classList.toggle('hidden', incl); document.getElementById('sp-inclbox').classList.toggle('hidden', !incl); spPlanInfo(); draw(); }
        function spVertexZs() { const one = selectedShapes[0]; return one.points.map((q, i) => { const el = document.getElementById('sp-vz-' + i), v = el ? parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.')) : NaN; return isNaN(v) ? undefined : v * 1000; }); }
        function spPlanInfo() {
            const el = document.getElementById('sp-planinfo'), one = selectedShapes[0]; if (!el || !one) return;
            const zs = spVertexZs(); if (zs.some(z => z === undefined)) { el.textContent = 'Indiquez le Z de chaque sommet.'; return; }
            const tmp = { type: 'poly', points: one.points.map((q, i) => ({ x: q.x, y: q.y, z: zs[i] })), plat: true }, S = platSurf(tmp);
            if (S.flat) { el.textContent = 'Tous les Z égaux : plateforme horizontale.'; return; }
            // pente maxi (plus grande pente de la surface)
            const gmax = arrMax(S.tris.map(t => Math.hypot(t.a, t.b) * mmToWorld(1) * 100));
            el.textContent = nfr(S.zmin / 1000, 2) + ' → ' + nfr(S.zmax / 1000, 2) + ' m · pente maxi ' + nfr(gmax, 1) + ' %' + (S.dev > 5 ? ' · surface gauche (écart au plan ' + nfr(S.dev / 10, 1) + ' cm)' : ' · plan');
        }
        function spFillSlope() {
            const one = selectedShapes[0]; if (!one) return; const num = (id) => parseFloat(String(document.getElementById(id).value).replace(',', '.'));
            const z0 = parseFloat(String(document.getElementById('sp-z0').value).replace(/\s/g, '').replace(',', '.')), pct = num('sp-pct'), ang = num('sp-ang') * Math.PI / 180, i0 = +document.getElementById('sp-v0').value; if (isNaN(z0) || isNaN(pct) || isNaN(ang)) return;
            const P0 = one.points[i0];
            one.points.forEach((q, i) => { const dx = mOf(q.x - P0.x), dy = -mOf(q.y - P0.y), along = dx * Math.cos(ang) + dy * Math.sin(ang); document.getElementById('sp-vz-' + i).value = nfr(z0 - pct / 100 * along, 3).replace(/\s/g, ''); });
            spPlanInfo();
        }
        function spPickDir() { spDirPick = []; document.getElementById('selparam-modal').classList.add('hidden'); updateCommandMessageText('SENS DE LA PENTE : cliquez un point HAUT, puis un point BAS (dans le sens de la descente).'); }
        function spDirClick(wx, wy) {
            const sn = findSnap(wx, wy); spDirPick.push(sn ? { x: sn.x, y: sn.y } : { x: wx, y: wy });
            if (spDirPick.length < 2) { updateCommandMessageText('SENS DE LA PENTE : cliquez le point BAS.'); return; }
            const [a, b] = spDirPick; spDirPick = null; let deg = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI; if (deg < 0) deg += 360;
            document.getElementById('sp-ang').value = nfr(deg, 1).replace(/\s/g, ''); document.getElementById('selparam-modal').classList.remove('hidden');
            updateCommandMessageText('Sens de la pente : ' + nfr(deg, 1) + '°. Cliquez « Remplir les Z ».');
        }
        function solidRows(one) {
            const k = one.solid.kind, so = one.solid, m = (v) => lenTxt(v), U = LUN(), V = solidVolume(one);
            let h = MF.hint(SOLID_NAMES[k] + (k === 'sphere' ? ' (Z = bas de la sphère)' : k === 'torus' ? ' (Z = dessous du tore)' : k === 'rev' ? ' (Z = bas du profil)' : ''));
            if (!['sphere', 'torus', 'rev', 'roof'].includes(k)) h += MF.row('Hauteur', MF.num('sp-h', m(so.H)), U);
            if (k === 'roof') { const n = one.points.length, eg = roofEave(one);
                h += MF.row('Pente', MF.num('sp-rp', String(so.p ?? 35).replace('.', ',')), '%') + MF.row('Épaisseur du pan', MF.num('sp-re', m(so.e || 200)), U)
                    + MF.row('Égout (côté bas)', MF.sel('sp-reg', one.points.map((q, i) => [i, 'côté ' + (i + 1) + '-' + ((i + 1) % n + 1)]), eg), '')
                    + MF.hint('L\'altitude de la base est celle de l\'égout (dessous du pan). Faîtage à ' + nfr((solidBaseZ(one) + Math.max(...roofRise(one))) / 1000, 2) + ' m. Deux pans = deux contours qui se touchent au faîtage.'); }
            if (k === 'tube') h += MF.row('Épaisseur de paroi', MF.num('sp-se', m(so.e)), U);
            if (k === 'tcone') h += MF.row('Rayon du haut', MF.num('sp-sr2', m(so.r2)), U);
            if (k === 'pyr') h += MF.row('Haut tronqué', MF.num('sp-sk', String(Math.round((so.k || 0) * 100))), '%') + MF.hint('0 % = pyramide pointue ; 50 % = le dessus garde la moitié de la base (tronc de pyramide).');
            if (k === 'torus') h += MF.row('Rayon du tube', MF.num('sp-sa', m(so.a)), U) + MF.hint('Le cercle tracé est l\'axe du tore (rayon moyen).');
            if (k === 'rev') h += MF.hint('Profil de ' + (so.prof || []).length + ' sommets, hauteur ' + nfr(Math.max(...(so.prof || [[0, 0]]).map(q => q[1])) / 1000, 2) + ' m, rayon ' + nfr(worldToMm(one.r) / 1000, 2) + ' m.');
            const tl = so.tilt || {};
            h += MF.sub('Inclinaison') + MF.row('Autour de X (est-ouest)', MF.num('sp-tx', String(tl.x || 0).replace('.', ',')), '°') + MF.row('Autour de Y (nord-sud)', MF.num('sp-ty', String(tl.y || 0).replace('.', ',')), '°')
                + MF.hint('Pivot : centre de la base. En plan, l\'emprise inclinée est tracée en mixte.');
            if (V > 0) h += MF.hint('Volume : <b class="text-white">' + nfr(V, 3) + ' m³</b>');
            return h;
        }
        // volume d'un solide (m³)
        function solidVolume(s) {
            const so = s.solid; if (!so) return 0; const k = so.kind, H = (so.H || 0) / 1000, mm2 = (a) => a / 1e6;
            const r = s.type === 'circle' ? worldToMm(s.r) / 1000 : 0, holesA = holesOf(s).reduce((a, h) => a + Math.abs(polyArea(h)) * Math.pow(mOf(1), 2), 0);
            const A = s.type === 'poly' ? Math.abs(polyArea(s.points)) * Math.pow(mOf(1), 2) : Math.PI * r * r;
            if (k === 'box') return Math.max(0, A - holesA) * H;
            if (k === 'cyl') return Math.max(0, A - holesA) * H;
            if (k === 'cone') return A * H / 3;
            if (k === 'sphere') return 4 / 3 * Math.PI * r * r * r;
            if (k === 'tube') { const ri = Math.max(0, r - (so.e || 0) / 1000); return Math.PI * (r * r - ri * ri) * H; }
            if (k === 'tcone') { const r2 = (so.r2 || 0) / 1000; return Math.PI * H / 3 * (r * r + r * r2 + r2 * r2); }
            if (k === 'pyr') { const t = Math.max(0, Math.min(1, so.k || 0)); return H / 3 * A * (1 + t + t * t); }
            if (k === 'roof') return A * (so.e || 200) / 1000;
            if (k === 'torus') { const a = (so.a || 0) / 1000; return 2 * Math.PI * Math.PI * r * a * a; }
            if (k === 'rev' && so.prof && so.prof.length >= 3) { let A2 = 0, Cr = 0; const P = so.prof; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = a[0] * b[1] - b[0] * a[1]; A2 += c; Cr += (a[0] + b[0]) * c; }
                A2 /= 2; if (!A2) return 0; const xr = Cr / (6 * A2); return Math.abs(2 * Math.PI * xr * A2) / 1e9; }
            return 0;
        }
        // ---- onglet Talus : réglage UNIFORME (toute la plateforme) ou PAR ARÊTE (un jalon dépliable par côté, pastille jaune sur le plan) ----
        // par arête (déblai seulement) : nom, pente H et L, recul R, niveau fini du remblai périphérique de ce côté, ou « sans talus »
        function talEdgeTN(one, i) { const P = one.points, a = P[i], b = P[(i + 1) % P.length], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, t = getTIN(); const z = t ? tinZ(m.x, m.y, t) : undefined, zp = hasZ(a.z) && hasZ(b.z) ? (a.z + b.z) / 2 : platZ(one); return hasZ(z) && hasZ(zp) ? z - zp : NaN; }
        function talHL(k) { const m = String(k || '').replace(/,/g, '.').match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/); if (m) return { L: parseFloat(m[1]), H: parseFloat(m[2]) }; const v = parseFloat(String(k || '').replace(',', '.')); return v > 0 ? { L: v, H: 1 } : { L: 1, H: 1 }; }
        function talDiagram(i, e, t, hReal, zp) {
            const hl = talHL(e.kD || t.kD), nv = (v) => String(v).replace('.', ','), inp = (id, v, ph, w, x, y, tip) => `<input id="${id}" type="text" inputmode="decimal" value="${MF.esc(v)}" placeholder="${MF.esc(ph || '')}" title="${MF.esc(tip || '')}" class="tal-in" style="left:${x}%;top:${y}%;width:${w}px;">`;
            return `<div class="tal-dia"><svg viewBox="0 0 360 200" width="100%" preserveAspectRatio="xMidYMid meet">
                <defs><pattern id="tdh${i}" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#3f3f46" stroke-width="1"/></pattern></defs>
                <path d="M30 60 L80 60 L230 158 L330 158 L330 196 L30 196 Z" fill="url(#tdh${i})"/>
                <path d="M30 60 L80 60" stroke="#a1a1aa" stroke-width="1.4"/><path d="M230 158 L345 158" stroke="#a1a1aa" stroke-width="1.4"/>
                <path d="M80 60 L230 158" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
                <rect x="296" y="30" width="16" height="128" fill="#1f2937" stroke="#d4d4d8" stroke-width="1.2"/><path d="M296 46l16-16M296 70l16-16M296 94l16-16M296 118l16-16M296 142l16-16" stroke="#9ca3af" stroke-width=".8"/>
                <path d="M60 32 L296 32" stroke="#ef4444" stroke-width="3.5"/>
                <g stroke="#f59e0b" stroke-width="1" fill="none"><path d="M24 32 L24 158 M20 36l8-8M20 162l8-8 M24 158 L230 158" stroke-dasharray="0"/><path d="M250 60 L250 158 M246 64l8-8M246 162l8-8 M84 60 L254 60"/><path d="M80 180 L230 180 M76 184l8-8M226 184l8-8 M80 64 L80 184 M230 162 L230 184"/><path d="M230 180 L304 180 M300 184l8-8 M304 160 L304 184"/></g>
                <text x="242" y="153" fill="#9ca3af" font-size="9" font-family="Arial">fond de fouille</text></svg>
                ${inp('tj-zf-' + i, e.zf !== undefined && hasZ(e.zf) ? fmtZ(e.zf) : '', hasZ(t.zf) ? fmtZ(t.zf) : 'niv. fini', 64, 2, 41, 'Niveau fini du remblai périphérique de ce côté (m) ; vide = celui de la plateforme')}
                <span class="tal-lb" style="left:2%;top:30%;">Niv. fini</span>
                ${inp('tj-h-' + i, nv(hl.H), '1', 46, 71, 44, 'Hauteur H de la pente (avec L : pente du talus de déblai)')}<span class="tal-lb" style="left:71%;top:33%;">H</span>
                ${inp('tj-l-' + i, nv(hl.L), '1', 46, 34, 84, 'Longueur L de la pente (avec H : pente du talus de déblai)')}<span class="tal-lb" style="left:26%;top:86%;">L</span>
                ${inp('tj-r-' + i, e.R !== undefined ? lenTxt(e.R) : '', t.R ? lenTxt(t.R) : '0', 46, 73, 84, 'Recul R de la base du talus (' + LUN() + ') ; vide = celui de la plateforme')}<span class="tal-lb" style="left:89%;top:86%;">R</span>
                </div>
                <div class="mf-hint">${isFinite(hReal) ? (hReal > 0 ? 'Ici le terrain est <b class="text-white">' + nfr(hReal / 1000, 2) + ' m</b> au-dessus de la plateforme : talus de déblai d\'environ ' + nfr(hReal / 1000 * hl.L / hl.H, 2) + ' m de large.' : 'Ici la plateforme est au-dessus du terrain (remblai) : ces réglages de déblai ne s\'appliquent pas.') : 'Terrain inconnu au milieu de cette arête.'}</div>`;
        }
        // schéma d'un talus de REMBLAI : la plateforme en haut, le talus descend jusqu'au terrain ; on règle H et L (la pente) ; pas de recul ni de remblai périphérique
        function talDiagramR(i, e, t, hReal) {
            const hl = talHL(e.kR || t.kR), nv = (v) => String(v).replace('.', ','), inp = (id, v, w, x, y, tip) => `<input id="${id}" type="text" inputmode="decimal" value="${MF.esc(v)}" title="${MF.esc(tip || '')}" class="tal-in" style="left:${x}%;top:${y}%;width:${w}px;">`;
            return `<div class="tal-dia"><svg viewBox="0 0 360 200" width="100%" preserveAspectRatio="xMidYMid meet">
                <defs><pattern id="tdr${i}" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#3f3f46" stroke-width="1"/></pattern><pattern id="tdf${i}" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#57534e"/><circle cx="6.5" cy="6.5" r="1" fill="#57534e"/></pattern></defs>
                <path d="M20 158 L340 158 L340 196 L20 196 Z" fill="url(#tdr${i})"/>
                <path d="M20 50 L120 50 L270 158 L20 158 Z" fill="url(#tdf${i})"/>
                <path d="M20 50 L120 50" stroke="#e5e7eb" stroke-width="3"/><text x="24" y="42" fill="#9ca3af" font-size="9" font-family="Arial">plateforme</text>
                <path d="M120 50 L270 158" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
                <path d="M20 158 L345 158" stroke="#a1a1aa" stroke-width="1.4"/><text x="280" y="152" fill="#9ca3af" font-size="9" font-family="Arial">terrain</text>
                <g stroke="#f59e0b" stroke-width="1" fill="none"><path d="M300 50 L300 158 M296 54l8-8M296 162l8-8 M124 50 L304 50 M274 158 L304 158"/><path d="M120 180 L270 180 M116 184l8-8M266 184l8-8 M120 54 L120 184 M270 162 L270 184"/></g></svg>
                ${inp('tj-rh-' + i, nv(hl.H), 46, 74, 42, 'Hauteur H de la pente de remblai')}<span class="tal-lb" style="left:88%;top:31%;">H</span>
                ${inp('tj-rl-' + i, nv(hl.L), 46, 46, 84, 'Longueur L de la pente de remblai')}<span class="tal-lb" style="left:38%;top:86%;">L</span></div>
                <div class="mf-hint">${isFinite(hReal) && hReal < 0 ? 'Ici la plateforme est <b class="text-white">' + nfr(-hReal / 1000, 2) + ' m</b> au-dessus du terrain : talus de remblai d\'environ ' + nfr(-hReal / 1000 * hl.L / hl.H, 2) + ' m de large.' : 'Talus de remblai : pas de recul de ce côté ; avec un niveau fini plus haut que la plateforme, le remblai périphérique recouvre ce talus.'}</div>`;
        }
        // haut de la paroi : automatique (horizontal, tient la marche la plus haute), à une cote finie, ou au terrain naturel (suit le niveau coupé)
        function talPzHtml(id, pz, zdef) { const m = pz && pz.m || 'auto', v = pz && hasZ(pz.z) ? pz.z : zdef;
            return MF.row('Haut de la paroi', `<select id="${id}" class="mf-in" onchange="document.getElementById('${id}v').style.display = this.value === 'fini' ? 'inline-block' : 'none'"><option value="auto" ${m === 'auto' ? 'selected' : ''}>horizontal (automatique)</option><option value="fini" ${m === 'fini' ? 'selected' : ''}>à une cote finie</option><option value="tn" ${m === 'tn' ? 'selected' : ''}>au terrain naturel</option></select> <input id="${id}v" type="text" inputmode="decimal" value="${nfr((v || 0) / 1000, 2).replace(/\s/g, '')}" class="mf-in" style="width:84px;text-align:right;display:${m === 'fini' ? 'inline-block' : 'none'}">`, ''); }
        function talPzRead(id) { const sel = document.getElementById(id); if (!sel || sel.value === 'auto') return null; if (sel.value === 'tn') return { m: 'tn' }; const z = t2Num(document.getElementById(id + 'v').value || ''); return isFinite(z) ? { m: 'fini', z: Math.round(z * 1000) } : null; }
        // talus en escalier : marches de hauteur h et giron g (cm) taillées dans la pente, qui vaut alors g / h
        const TAL_ST_MAT = [['beton', 'Béton'], ['pierre-taille', 'Pierre'], ['bois', 'Bois'], ['gabions', 'Gabions']];
        function talStairHtml(i, e) { const st = e.st || { h: 160, g: 300, nez: 0 }, inp = (k, v) => `<input id="tj-st${k}-${i}" type="text" inputmode="decimal" value="${nfr(v / 10, 1).replace(/\s/g, '')}" oninput="talStUpd(${i})" class="mf-in" style="width:64px;text-align:right">`;
            return `<div class="mf-row"><span class="mf-l"><b>Escalier</b> <span class="text-gray-400 text-xs">(marches taillées dans le talus)</span></span><label class="tal-sw"><input type="checkbox" id="tj-st-${i}" ${e.st ? 'checked' : ''} onchange="talStair(${i}, this.checked)"><span></span></label></div>
                <div id="tj-stbox-${i}" style="display:${e.st ? 'block' : 'none'};">${MF.row('Hauteur de marche', inp('h', st.h) + ' cm', '')}${MF.row('Giron', inp('g', st.g) + ' cm', '')}${MF.row('Nez de marche', inp('n', st.nez || 0) + ' cm', '')}
                ${MF.row('Matériau', `<select id="tj-stm-${i}" class="mf-in">${TAL_ST_MAT.map(([v, l]) => `<option value="${v}" ${(st.mat || 'beton') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`, '')}
                <div id="tj-stsvg-${i}" style="margin:6px 0">${stairSVG({ h: st.h, g: st.g, nez: st.nez || 0 })}</div><div id="tj-stbl-${i}">${blondelBox(st.h, st.g, talStPente(st))}</div>
                <div class="mf-hint">La pente du talus suit les marches (giron / hauteur). Seules les marches entières sont posées, du bord de la plateforme jusqu'au pied.</div></div>`; }
        function talStPente(st) { return ' · pente ' + nfr(st.g / st.h, 2) + '/1'; }
        function talStRead(i) { const v = (k) => parseFloat(String((document.getElementById('tj-st' + k + '-' + i) || {}).value || '').replace(',', '.')) * 10; return { h: v('h'), g: v('g'), nez: v('n') }; }
        function talStUpd(i) { const st = talStRead(i); if (!(st.h > 0 && st.g > 0)) return; const sv = document.getElementById('tj-stsvg-' + i), bl = document.getElementById('tj-stbl-' + i);
            if (sv) sv.innerHTML = stairSVG({ h: st.h, g: st.g, nez: st.nez > 0 ? st.nez : 0 }); if (bl) bl.innerHTML = blondelBox(st.h, st.g, talStPente(st)); }
        function talStair(i, on) { const b = document.getElementById('tj-stbox-' + i), o = document.getElementById('tj-stoff-' + i); if (b) b.style.display = on ? 'block' : 'none'; if (o) o.style.display = on ? 'none' : 'block'; }
        // type d'une arête (couleur commune au mini-plan et aux pastilles) : paroi, escalier, remblai ou déblai selon le terrain le long de l'arête
        function talEdgeType(one, E, i) { const e = E[i] || {}; if (e.off) return ['paroi', '#9ca3af', 'Paroi']; if (e.st) return ['esc', '#fbbf24', 'Escalier']; const hr = talEdgeTN(one, i); return isFinite(hr) && hr < 0 ? ['rem', '#60a5fa', 'Remblai'] : ['deb', '#f87171', 'Déblai']; }
        // mini-plan de la plateforme : arêtes numérotées et colorées par type, un clic ouvre le réglage de l'arête
        function talMiniPlan(one, E) { const P = one.points, n = P.length; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; P.forEach(q => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
            const W = 340, H = 170, pad = 22, k = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-9), (H - 2 * pad) / Math.max(y1 - y0, 1e-9)), ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2, X = (q) => ox + (q.x - x0) * k, Y = (q) => oy + (q.y - y0) * k;
            let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;background:#111827;border:1px solid #374151;border-radius:8px"><polygon points="${P.map(q => X(q) + ',' + Y(q)).join(' ')}" fill="#374151" fill-opacity=".35"/>`;
            P.forEach((a, i) => { const b = P[(i + 1) % n], t = talEdgeType(one, E, i), mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
                g += `<g data-te="${i}" style="cursor:pointer" onclick="talOpenEdge(${i})"><line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="transparent" stroke-width="14"/><line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="${t[1]}" stroke-width="${t[0] === 'paroi' ? 5 : 3}" stroke-linecap="round"${t[0] === 'esc' ? ' stroke-dasharray="3 3"' : ''}/><circle cx="${mx}" cy="${my}" r="9" fill="${t[1]}"/><text x="${mx}" y="${my + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#111827">${i + 1}</text><title>Arête ${i + 1} : ${t[2]}</title></g>`; });
            const leg = [['#f87171', 'Déblai'], ['#60a5fa', 'Remblai'], ['#9ca3af', 'Paroi'], ['#fbbf24', 'Escalier']].map(([c, l]) => `<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:4px"></i>${l}</span>`).join('');
            return g + `</svg><div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:#9ca3af">${leg}<span style="margin-left:auto">clic sur une arête : son réglage</span></div>`; }
        function talOpenEdge(i) { const d = document.querySelector(`#tal-x .tal-j[data-ti="${i}"]`); if (!d) return; document.querySelectorAll('#tal-x .tal-j[open]').forEach(x => { if (x !== d) x.open = false; }); d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        function talParoi(i, on) { const b = document.getElementById('tj-offbox-' + i), sl = document.getElementById('tj-slope-' + i); if (b) b.style.display = on ? 'block' : 'none'; if (sl) sl.style.display = on ? 'none' : 'block'; if (on) { const f = document.getElementById('tj-pl-' + i); if (f) setTimeout(() => f.focus(), 30); } }
        function talMode(i, v) {   // i : n° d'arête, ou 'u' (réglage uniforme)
            const d = document.getElementById('tj-dd-' + i), r = document.getElementById('tj-dr-' + i); if (d) d.style.display = v === 'r' ? 'none' : 'block'; if (r) r.style.display = v === 'r' ? 'block' : 'none'; }
        function talusRows(one) {
            const t = platTalus(one), isPoly = one && one.type === 'poly' && !one.open, cx = !!(t.cx && isPoly), E = t.edges || [];
            const dl = `<datalist id="sp-tal-dl">${TALUS_OPTS.map(o => `<option value="${o}">`).join('')}</datalist>`, tin = (id, v, ph) => `<input id="${id}" type="text" list="sp-tal-dl" value="${MF.esc(v || '')}" placeholder="${MF.esc(ph || '')}" class="mf-in" style="width:4.6rem;">`;
            const zf = one && one.cubRP && hasZ(one.cubRP.z) ? one.cubRP.z : undefined;
            let h = dl + MF.ck('sp-tal', 'Talus jusqu\'au terrain', t.on)
                + (isPoly ? `<div class="mf-row"><span class="mf-l">Réglage</span><span class="mf-c">${MF.seg('sp-tcx', [['u', 'Uniforme'], ['x', 'Par arête']], cx ? 'x' : 'u', "talCx(this.value)")}</span></div>` : '')
                + `<div class="mf-row"><span class="mf-l">Remblai périph.</span><span class="mf-c">${MF.seg('sp-rpm', [['none', 'Aucun'], ['fini', 'Cote finie'], ['tn', 'Terrain naturel']], one && one.cubRP && one.cubRP.mode === 'none' ? 'none' : rpMode(one) === 'tn' && cubRPon(one) ? 'tn' : 'fini', '')}</span></div>`
                + MF.hint('Remblai périphérique (la fouille rebouchée autour de l\'ouvrage) : <b>cote finie</b> = jusqu\'au niveau fini donné sur le schéma de déblai ; s\'il dépasse le terrain, un talus 1/1 rejoint le terrain naturel. <b>Terrain naturel</b> = la fouille est rebouchée jusqu\'au terrain, épaisseur variable, sans niveau à donner.');
            h += `<div id="tal-u" style="display:${cx ? 'none' : 'flex'};flex-direction:column;gap:6px;">`
                + (() => { const hs = isPoly ? one.points.map((q, i) => talEdgeTN(one, i)).filter(isFinite) : [], hm = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : NaN, rem = isFinite(hm) && hm < 0;
                    const eU = { kD: t.kD, kR: t.kR, R: t.R || 0, zf };
                    return MF.hint('Les mêmes talus tout autour de la plateforme. Le schéma montre la situation la plus fréquente ici ; l\'interrupteur passe de l\'un à l\'autre (les deux sont enregistrés).')
                        + `<div class="mf-row"><span class="mf-l">Schéma</span><span class="mf-c">${MF.seg('tj-mode-u', [['d', 'Déblai'], ['r', 'Remblai']], rem ? 'r' : 'd', "talMode('u',this.value)")}</span></div>
                        <div id="tj-dd-u" style="display:${rem ? 'none' : 'block'};">${talDiagram('u', eU, Object.assign({}, t, { zf }), hm)}</div>
                        <div id="tj-dr-u" style="display:${rem ? 'block' : 'none'};">${talDiagramR('u', eU, t, hm)}</div>`
                        + (isPoly ? (() => { const all = one.points.every((q, i) => E[i] && E[i].off), e0 = (E.find(e => e && e.off) || {});
                            return `<div class="mf-row"><span class="mf-l"><b>Paroi</b> <span class="text-gray-400 text-xs">(tout le contour : bord vertical, sans talus)</span></span><label class="tal-sw"><input type="checkbox" id="tj-uoffall" ${all ? 'checked' : ''} onchange="document.getElementById('tj-uoffbox').style.display = this.checked ? 'block' : 'none'"><span></span></label></div>`
                            + `<div id="tj-uoffbox" style="display:${all ? 'block' : 'none'}">${MF.row('Désignation sur le plan', `<input id="tj-upl" type="text" value="${MF.esc(e0.pl || '')}" placeholder="ex. Mur de soutènement, Palplanches" class="mf-in mf-wide">`, '')}${MF.row('Épaisseur de la paroi', `<input id="tj-upe" type="text" inputmode="decimal" value="${nfr((e0.pe || 200) / 1000, 2).replace(/\s/g, '')}" class="mf-in" style="width:80px;text-align:right"> m`, '')}${talPzHtml('tj-upz', e0.pz, platZ(one))}</div>`; })() : ''); })() + '</div>';
            if (isPoly) {
                const P = one.points, n = P.length;
                h += `<div id="tal-x" style="display:${cx ? 'flex' : 'none'};flex-direction:column;gap:6px;">${talMiniPlan(one, E)}`
                    + P.map((a, i) => { const b = P[(i + 1) % n], e = E[i] || {}, L = Math.hypot(b.x - a.x, b.y - a.y) * mOf(1), hr = talEdgeTN(one, i), nm = e.name || '', ty = talEdgeType(one, E, i);
                        const sum = e.off ? 'paroi' + (e.pl ? ' : ' + e.pl : '') : e.st ? 'escalier ' + nfr(e.st.h / 10, 1) + ' × ' + nfr(e.st.g / 10, 1) + ' cm' : (e.kR ? 'remblai ' + e.kR + ' · ' : '') + (e.kD || t.kD) + (e.R !== undefined ? ' · R ' + nfr(e.R / 1000, 2) : '') + (hasZ(e.zf) ? ' · fini ' + fmtZ(e.zf) : '');
                        return `<details class="tal-j" data-ti="${i}" ontoggle="talHi(this.open ? ${i} : -1)"><summary><span class="tal-pill" style="background:${ty[1]};color:#111827" title="${ty[2]}">${i + 1}</span><span class="tal-nm">${MF.esc(nm || 'Talus ' + (i + 1))}</span><span class="tal-sm">${nfr(L, 2)} m · ${MF.esc(sum)}</span></summary>
                            <div class="tal-jb">${MF.row('Nom', `<input id="tj-name-${i}" type="text" value="${MF.esc(nm)}" placeholder="Talus ${i + 1}" class="mf-in mf-wide">`, '')}
                            <div class="mf-row"><span class="mf-l"><b>Paroi</b> <span class="text-gray-400 text-xs">(bord vertical, pas de talus)</span></span><label class="tal-sw"><input type="checkbox" id="tj-off-${i}" ${e.off ? 'checked' : ''} onchange="talParoi(${i}, this.checked)"><span></span></label></div>
                            <div id="tj-offbox-${i}" style="display:${e.off ? 'block' : 'none'};">${MF.row('Désignation sur le plan', `<input id="tj-pl-${i}" type="text" value="${MF.esc(e.pl || '')}" placeholder="ex. Mur de soutènement, Palplanches" class="mf-in mf-wide">`, '')}${MF.row('Épaisseur de la paroi', `<input id="tj-pe-${i}" type="text" inputmode="decimal" value="${nfr((e.pe || 200) / 1000, 2).replace(/\s/g, '')}" class="mf-in" style="width:80px;text-align:right"> m`, '')}${talPzHtml('tj-pz-' + i, e.pz, platZ(one))}<div class="mf-hint">La paroi est dessinée le long de l'arête (trait épais hachuré) avec cette désignation.</div></div>
                            <div id="tj-slope-${i}" style="display:${e.off ? 'none' : 'block'};">${talStairHtml(i, e)}<div id="tj-stoff-${i}" style="display:${e.st ? 'none' : 'block'};">
                            ${(() => { const rem = isFinite(hr) && hr < 0; return `<div class="mf-row"><span class="mf-l">Ce côté est en</span><span class="mf-c">${MF.seg('tj-mode-' + i, [['d', 'Déblai'], ['r', 'Remblai']], rem ? 'r' : 'd', "talMode(" + i + ",this.value)")}</span></div>
                            <div id="tj-dd-${i}" style="display:${rem ? 'none' : 'block'};">${talDiagram(i, e, Object.assign({}, t, { zf }), hr)}</div>
                            <div id="tj-dr-${i}" style="display:${rem ? 'block' : 'none'};">${talDiagramR(i, e, t, hr)}</div>`; })()}</div></div></div></details>`; }).join('') + '</div>';
            }
            h += MF.ck('sp-tpts', 'Points nez / pied', t.pts, '<span class="mf-l" style="margin-right:2px;">tous les</span>' + MF.num('sp-tesp', String(t.esp).replace('.', ','), '', 'style="width:3.6rem"') + '<span class="mf-u">m</span>')
                + MF.hint('<b>H</b> et <b>L</b> donnent la pente du talus : L mètres à plat pour H mètres de haut. Le <b>recul R</b> agrandit le fond de fouille ; le <b>niveau fini</b> sert au remblai périphérique (Cubatures).');
            return h;
        }
        function talCx(v) { const u = document.getElementById('tal-u'), x = document.getElementById('tal-x'); if (u) u.style.display = v === 'x' ? 'none' : 'flex'; if (x) x.style.display = v === 'x' ? 'flex' : 'none'; window.__talCx = v === 'x'; draw(); }
        function talHi(i) { window.__talHi = i; draw(); }
        // pastilles jaunes oblongues le long des arêtes (plateforme sélectionnée en réglage par arête)
        function drawTalusPills(c, s, dx, dy, ls) {
            const t = platTalus(s), m = document.getElementById('selparam-modal'), cxUI = m && !m.classList.contains('hidden') && document.getElementById('tal-x') ? window.__talCx : undefined;
            if (!(cxUI === undefined ? t.cx : cxUI) || s.type !== 'poly') return; const P = s.points, n = P.length, E = t.edges || [];
            c.save(); c.setLineDash([]); let A2 = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; A2 += a.x * b.y - b.x * a.y; } const sg = A2 > 0 ? -1 : 1;
            for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L * ls < 30) continue; const nx = -(b.y - a.y) / L * sg, ny = (b.x - a.x) / L * sg, off = 22 / ls;
                let ang = Math.atan2(b.y - a.y, b.x - a.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
                const mx = (a.x + b.x) / 2 + dx + nx * off, my = (a.y + b.y) / 2 + dy + ny * off, txt = String(i + 1) + (E[i] && E[i].name ? ' ' + E[i].name : ''), fs = 11 / ls;
                c.save(); c.translate(mx, my); c.rotate(ang); c.font = 'bold ' + fs + 'px Arial'; const w = Math.max(c.measureText(txt).width + 14 / ls, 26 / ls), h = 16 / ls;
                if (window.__talHi === i) { c.restore(); c.save(); c.strokeStyle = '#facc15'; c.lineWidth = 5 / ls; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(a.x + dx, a.y + dy); c.lineTo(b.x + dx, b.y + dy); c.stroke(); c.globalAlpha = 1; c.translate(mx, my); c.rotate(ang); c.font = 'bold ' + fs + 'px Arial'; }
                c.fillStyle = '#facc15'; c.strokeStyle = '#713f12'; c.lineWidth = 1 / ls; c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, h / 2); else c.rect(-w / 2, -h / 2, w, h); c.fill(); c.stroke();
                c.fillStyle = '#1c1917'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0.5 / ls); c.restore(); }
            c.restore();
        }
        // menu Y : les chapitres deviennent des onglets, petites icônes carrées dans un bandeau vertical sombre (comme la palette d'outils)
        function spTabify() {
            const sc = document.querySelector('#selparam-modal .overflow-y-auto'), panel = document.querySelector('#selparam-modal > div'); if (!sc || !panel) return;
            const pane = sc; let strip = panel.querySelector('#sp-strip');
            if (!strip) { strip = document.createElement('div'); strip.id = 'sp-strip'; panel.appendChild(strip); panel.classList.add('sp-has-strip'); sc.classList.add('sp-tabbed'); }
            const D = [...pane.querySelectorAll('details.sp-ch')].filter(d => d.offsetParent !== null || d.closest('#selparam-z:not(.hidden)') || !d.closest('#selparam-z'));
            const key = (d) => d.dataset.k || 'layer', keys = D.map(key);
            let cur = window.spTab && keys.includes(window.spTab) ? window.spTab : null;
            if (!cur) { const z = D.find(d => d.closest('#selparam-z') && d.hasAttribute('open')) || D.find(d => d.closest('#selparam-z')) || D[0]; cur = z ? key(z) : null; }
            strip.innerHTML = D.map(d => { const ic = (d.querySelector('.sp-ic') || {}).textContent || '•', t = (d.querySelector('.sp-t') || {}).textContent || '', sm = (d.querySelector('.sp-sum') || {}).textContent || '';
                const sh = t.split(/\s+[—–-]\s+|\s+/).filter(w => w && !/^(en|de|du|des|la|le|les|et|à|au|aux|d'|l')$/i.test(w))[0] || t; return `<button type="button" data-k="${MF.esc(key(d))}" class="${key(d) === cur ? 'on' : ''}" title="${MF.esc(t + (sm ? ' — ' + sm : ''))}" onclick="spTabGo('${MF.esc(key(d))}')">${MF.esc(ic)}<small>${MF.esc(sh)}</small></button>`; }).join('');
            D.forEach(d => { d.open = true; d.classList.toggle('sp-off', key(d) !== cur); });
        }
        // volet Y ouvert pendant qu'on sélectionne autre chose sur le plan : il suit la sélection (ou se ferme si plus rien n'est sélectionné)
        let spSelSig = '';
        function spFollowSel() {
            const m = document.getElementById('selparam-modal'); if (!m || m.classList.contains('hidden')) { spSelSig = ''; return; }
            const sig = selectedShapes.map(x => shapes.indexOf(x)).join(',');
            if (sig === spSelSig) return; spSelSig = sig;
            if (!selectedShapes.length) { closeSelectionParamModal(); return; }
            setTimeout(() => { if (!m.classList.contains('hidden') && selectedShapes.map(x => shapes.indexOf(x)).join(',') === sig) openSelectionParamModal(); }, 0);
        }
        function spTabGo(k) { window.spTab = k; spTabify(); try { spFigMount(); } catch (e) {} const sc = document.querySelector('#selparam-modal .overflow-y-auto'); if (sc) sc.scrollTop = 0; }
        function closeSelectionParamModal() { document.getElementById('selparam-modal').classList.add('hidden'); }
        function applySelectionLayer(keep) { const sc = keep ? (document.querySelector('#selparam-modal .overflow-y-auto') || {}).scrollTop : 0; _applySelectionLayer(); if (typeof is3DOpen === 'function' && is3DOpen() && V3) { build3DScene(); render3D(); }
            if (keep && selectedShapes.length) { openSelectionParamModal(); const b = document.querySelector('#selparam-modal .overflow-y-auto'); if (b && sc) b.scrollTop = sc; updateCommandMessageText('Réglages appliqués : le volet reste ouvert pour ajuster encore (OK ou Appliquer pour fermer).'); } }
        function _applySelectionLayer() {
            const ls = document.getElementById('selparam-layer'), id = ls.value;
            if (id && id !== ls.dataset.orig) selectedShapes.forEach(s => { s.layerId = id; });   // calque changé seulement s'il a été choisi
            // altitudes / matricule : seulement les champs modifiés ; champ vidé = altitude supprimée
            const orig = JSON.parse(document.getElementById('selparam-z').dataset.orig || '[]');
            const ids = ['sp-mat', 'sp-z', 'sp-z1', 'sp-z2', 'sp-zall', 'sp-wzb', 'sp-wzt'];
            const val = (k) => { const el = document.getElementById(ids[k]); return el && el.value !== orig[k] ? el.value.trim() : null; };
            const toZ = (t) => { t = String(t).replace(/\s/g, ''); return (t === '' || isNaN(parseFloat(t.replace(',', '.')))) ? undefined : parseFloat(t.replace(',', '.')) * 1000; };
            const setZ = (o, key, t) => { const z = toZ(t); if (z === undefined) delete o[key]; else o[key] = z; };
            const one = selectedShapes.length === 1 ? selectedShapes[0] : null;
            if (val(0) !== null && one) one.mat = val(0);
            if (val(1) !== null) selectedShapes.forEach(x => { if (['point', 'circle', 'arc'].includes(x.type)) { setZ(x, 'z', val(1)); if (x.type === 'circle') delete x.elev; } });
            if (val(2) !== null && one) setZ(one, 'z1', val(2));
            // mur : niveaux bas / haut sur tous les tronçons (mur 3D si les deux sont remplis)
            if ((val(5) !== null || val(6) !== null) && selectedShapes.every(x => x.wallMat)) {
                const gb = document.getElementById('sp-wzb').value.trim(), gt = document.getElementById('sp-wzt').value.trim(), b = toZ(gb), t = toZ(gt);
                selectedShapes.forEach(x => { if (b === undefined && t === undefined) delete x.wz; else x.wz = { b, t }; }); }
            if (val(3) !== null && one) setZ(one, 'z2', val(3));
            const pm = document.querySelector('input[name=sp-pmode]:checked');
            if (pm && pm.value === 'incl' && one && one.type === 'poly') { const zs = spVertexZs(); one.points.forEach((q, i) => { if (zs[i] === undefined) delete q.z; else q.z = zs[i]; }); one.plat = true; delete one.elev; }
            else { if (pm && one) delete one.plat;
            if (val(4) !== null && one && one.type === 'poly') { one.points.forEach(q => setZ(q, 'z', val(4))); delete one.elev; } }   // Z saisi : devient une plateforme si fermée
            if (wallEdit && one && one.wall && document.getElementById('wall-edit')) { wallSync(); if (wallEdit.layers.length) one.wall = Object.assign(one.wall, { align: wallEdit.align, layers: wallEdit.layers.filter(l => l.e > 0) }); wallEdit = null; }
            if (sweepEdit && one && one.sweep && document.getElementById('sw-box')) { one.sweep = sweepEdit; if (sweepEdit.perp) lastBeamPreset = sweepEdit.p; else lastSweepPreset = sweepEdit.p; lastSweepPlace = { al: sweepEdit.al, inv: sweepEdit.inv, zs: sweepEdit.zs, dz: sweepEdit.dz }; sweepEdit = null; }
            if (structEdit && one && document.getElementById('st-box')) { const L = structEdit.layers.filter(l => structMat(l.mat).surf || (+l.e > 0)); if (L.length) one.struct = { layers: L, ff: structEdit.ff !== false }; else delete one.struct; structEdit = null; }
            trApplyY(one);
            { const dt = document.getElementById('sp-dimtxt'); if (dt && one) { const v = dt.value.trim(); if (v) one.txt = v; else delete one.txt; } }
            if (one && one.water && document.getElementById('sp-wz')) { const v = parseFloat(String(document.getElementById('sp-wz').value).replace(/\s/g, '').replace(',', '.')); if (isFinite(v)) one.water.z = Math.round(v * 1000); const nm = document.getElementById('sp-wname').value.trim(); if (nm) { one.water.name = nm; one.name = nm; } }
            const pn = document.getElementById('sp-pfname'); if (pn && one) { const v = pn.value.trim(); if (v) one.pfName = v; else delete one.pfName; }
            const lt = document.getElementById('sp-ltt'); if (lt && one) { const v = lt.value.trim(); if (v) one.ltText = v; else delete one.ltText; }
            { const nv = (id) => { const e = document.getElementById(id); return e ? t2Num(e.value) : NaN; };   /* bassins : hauteur, couverture, profondeur directement dans Y */
              if (one && one.bassin) { let v = nv('sp-bsH'); if (v > 0) one.bassin.H = Math.round(v * 1000); v = nv('sp-bsD'); if (v >= 300) one.bassin.D = Math.round(v); v = nv('sp-bscov'); if (v >= 0) one.bassin.cover = Math.round(v * 1000); }
              if (one && one.pay) { let v = nv('sp-pyzg'); if (isFinite(v)) one.pay.zg = Math.round(v * 1000); v = nv('sp-pyprof'); if (v > 0) one.pay.prof = Math.round(v * 1000); v = nv('sp-pyperm'); if (v >= 0) one.pay.perm = Math.round(v * 1000); const ez = document.getElementById('sp-pyzw'); if (ez && ez.dataset.o !== undefined && ez.value !== ez.dataset.o) { v = t2Num(ez.value); if (isFinite(v)) one.pay.perm = Math.max(0, Math.min(one.pay.prof, Math.round(v * 1000 - (one.pay.zg - one.pay.prof)))); } payApplyGeom(one); } }
            if (one && one.rdAx) { rdApplyY(one); const pe = document.getElementById('rd-prof'); if (pe) one.rdAx.prof = pe.value === 'tn' ? 'tn' : 'lisse'; }
            if (one && one.ctop) { ['w', 'h', 'ep'].forEach(k => { const e = document.getElementById('ct-' + k); if (!e) return; const v = t2Num(e.value); if (v > 0) one.ctop[k] = Math.round(v * 10); }); }
            if (one && one.stair2) { const T = one.stair2, F = { w: 1000, hc: 10, g: 10, nez: 10, gch: 1000 }; Object.keys(F).forEach(k => { const e = document.getElementById('st2-' + k); if (!e) return; const v = t2Num(e.value); if (v > 0) T[k] = Math.round(v * F[k]); }); }
            const hb = document.getElementById('sp-h');
            if (hb && one && one.solid) { const hv = parseFloat(String(hb.value).replace(',', '.')); if (hv > 0) one.solid.H = hv * lenF(); }
            { const bt = document.getElementById('sp-battop'); if (bt && one && one.batEx && one.solid) { const v = parseFloat(String(bt.value).replace(/\s/g, '').replace(',', '.')); if (isFinite(v)) { const top = Math.round(v * 1000), b = one.points[0].z || 0; one.solid.H = Math.max(100, top - b); one.batTop = b + one.solid.H; } } }
            if (one && one.solid) { const nv = (id) => { const e = document.getElementById(id); if (!e) return NaN; return parseFloat(String(e.value).replace(',', '.')); };
                const rmm = one.type === 'circle' ? worldToMm(one.r) : 0;
                let v = nv('sp-se'); if (v > 0) one.solid.e = Math.min(v * lenF(), rmm - 1);
                v = nv('sp-sr2'); if (v >= 0) one.solid.r2 = v * lenF();
                v = nv('sp-sk'); if (v >= 0) one.solid.k = Math.min(100, v) / 100;
                v = nv('sp-sa'); if (v > 0) one.solid.a = Math.min(v * lenF(), rmm);
                v = nv('sp-rp'); if (v >= 0) one.solid.p = v; v = nv('sp-re'); if (v > 0) one.solid.e = v * lenF(); v = nv('sp-reg'); if (v >= 0) one.solid.eg = v;
                const tx = nv('sp-tx'), ty = nv('sp-ty'), ang = (v) => isFinite(v) ? ((v % 360) + 540) % 360 - 180 : 0;
                if (isFinite(tx) || isFinite(ty)) { const t = { x: ang(tx), y: ang(ty) }; if (t.x || t.y) one.solid.tilt = t; else delete one.solid.tilt; } }
            const tb = document.getElementById('sp-tal');
            if (tb && one) { const t = platTalus(one), ev = parseFloat(String(document.getElementById('sp-tesp').value).replace(',', '.'));
                const gv = (id) => String((document.getElementById(id) || {}).value || '').trim().replace(/\s/g, ''), num = (id) => { const v = parseFloat(gv(id).replace(',', '.')); return isFinite(v) ? v : NaN; };
                const kv = (id, def) => { const v = gv(id); return v && talusOk(v) ? v : def; };
                const HL = (h, l, def) => { const H = num(h), L = num(l); return H > 0 && L >= 0 ? String(+L.toFixed(3)).replace('.', ',') + '/' + String(+H.toFixed(3)).replace('.', ',') : def; };
                const rr = document.getElementById('tj-r-u') ? num('tj-r-u') : num('sp-trr'), cx = (document.querySelector('input[name=sp-tcx]:checked') || {}).value === 'x';
                const nt = { on: tb.checked, kR: document.getElementById('tj-rh-u') ? HL('tj-rh-u', 'tj-rl-u', t.kR) : kv('sp-kr', t.kR), kD: document.getElementById('tj-h-u') ? HL('tj-h-u', 'tj-l-u', t.kD) : kv('sp-kd', t.kD), pts: document.getElementById('sp-tpts').checked, esp: isFinite(ev) && ev >= 0 ? ev : t.esp, R: rr > 0 ? Math.round(rr * lenF()) : 0, cx };
                if (document.getElementById('tj-zf-u') || document.getElementById('sp-tzf')) { const z = document.getElementById('tj-zf-u') ? num('tj-zf-u') : num('sp-tzf'); one.cubRP = Object.assign({ on: false }, one.cubRP); if (isFinite(z)) { one.cubRP.z = Math.round(z * 1000); one.cubRP.on = true; } else delete one.cubRP.z; }
                { const rm = (document.querySelector('input[name=sp-rpm]:checked') || {}).value; if (rm) { one.cubRP = Object.assign({ on: false }, one.cubRP); if (rm === 'fini') delete one.cubRP.mode; else one.cubRP.mode = rm; if (rm === 'tn') one.cubRP.on = true; } }
                if (!cx && t.edges) nt.edges = t.edges;
                if (!cx && one.type === 'poly' && document.getElementById('tj-uoffall')) {   // réglage uniforme : une seule paroi sur tout le contour (interrupteur) ; les réglages par arête déjà faits sont gardés
                    const on = document.getElementById('tj-uoffall').checked, pl = (document.getElementById('tj-upl').value || '').trim(), pe = t2Num(document.getElementById('tj-upe').value || '');
                    const E2 = one.points.map((q, i) => { const e = Object.assign({}, (t.edges || [])[i] || {}); if (on) { e.off = true; if (pl) e.pl = pl; else delete e.pl; if (isFinite(pe) && pe > 0 && Math.abs(pe * 1000 - 200) > 0.5) e.pe = Math.round(pe * 1000); else delete e.pe; const pz = talPzRead('tj-upz'); if (pz) e.pz = pz; else delete e.pz; } else { delete e.off; delete e.pl; delete e.pe; delete e.pz; } return Object.keys(e).length ? e : null; });
                    nt.edges = E2.some(Boolean) ? E2 : undefined; }   // mode uniforme : les réglages par arête déjà faits sont gardés tels quels
                if (cx && one.type === 'poly' && document.getElementById('tj-h-0')) {
                    const E = one.points.map((q, i) => { const e = {}, nm = (document.getElementById('tj-name-' + i) || {}).value || '', H = num('tj-h-' + i), L = num('tj-l-' + i), R = num('tj-r-' + i), Z = num('tj-zf-' + i);
                        if (nm.trim()) e.name = nm.trim(); { const RH = num('tj-rh-' + i), RL = num('tj-rl-' + i); if (RH > 0 && RL >= 0) { const kr = String(+RL.toFixed(3)).replace('.', ',') + '/' + String(+RH.toFixed(3)).replace('.', ','); if (talusK(kr) !== talusK(nt.kR)) e.kR = kr; } } if (H > 0 && L >= 0) { const k = String(+L.toFixed(3)).replace('.', ',') + '/' + String(+H.toFixed(3)).replace('.', ','); if (talusK(k) !== talusK(nt.kD)) e.kD = k; }
                        if (isFinite(R) && R >= 0) e.R = Math.round(R * lenF()); if (isFinite(Z)) e.zf = Math.round(Z * 1000); if ((document.getElementById('tj-st-' + i) || {}).checked && !(document.getElementById('tj-off-' + i) || {}).checked) { const st = talStRead(i); if (st.h > 0 && st.g > 0) { e.st = { h: Math.round(st.h), g: Math.round(st.g), nez: st.nez > 0 ? Math.round(st.nez) : 0 }; const m = (document.getElementById('tj-stm-' + i) || {}).value; if (m && m !== 'beton') e.st.mat = m;
                            e.kR = e.kD = String(+(st.g / 1000).toFixed(3)).replace('.', ',') + '/' + String(+(st.h / 1000).toFixed(3)).replace('.', ','); } }
                        if ((document.getElementById('tj-off-' + i) || {}).checked) { e.off = true; const pl = ((document.getElementById('tj-pl-' + i) || {}).value || '').trim(); if (pl) e.pl = pl; const pe = t2Num((document.getElementById('tj-pe-' + i) || {}).value || ''); if (isFinite(pe) && pe > 0 && Math.abs(pe * 1000 - 200) > 0.5) e.pe = Math.round(pe * 1000); else delete e.pe; const pz = talPzRead('tj-pz-' + i); if (pz) e.pz = pz; else delete e.pz; }
                        return Object.keys(e).length ? e : null; });
                    nt.edges = E.some(Boolean) ? E : undefined; if (cx && E.some(e => e && hasZ(e.zf))) one.cubRP = Object.assign({}, one.cubRP, { on: true }); }
                one.talus = Object.assign({}, one.talus, nt); if (!nt.edges) delete one.talus.edges; if (!nt.R) delete one.talus.R; if (!nt.cx) delete one.talus.cx; }
            if (!_spLive) closeSelectionParamModal();
            invalidateCache(); saveState(); draw(); refresh3D();
        }
        function addLayer() { const input = document.getElementById('new-layer-name'); const name = input.value.trim(); if (name) { const newId = generateId(); layers.push({ id: newId, name: name, visible: true, color: '#ffffff', dash: 'solid', width: 1 }); activeLayerId = newId; input.value = ''; saveState(); updateLayerUI(); } }
        function deleteLayer(id) { if (layers.length <= 1) { alert("Dernier calque."); return; } if (confirm("Supprimer ce calque ?")) { layers = layers.filter(l => l.id !== id); shapes = shapes.filter(s => (s.layerId || 'layer-0') !== id); selectedShapes = selectedShapes.filter(s => (s.layerId || 'layer-0') !== id); if (activeLayerId === id) activeLayerId = layers[0].id; saveState(); updateLayerUI(); draw(); } }

        // --- MATH INTERSECTIONS ET ARCS ---
        // Test point-dans-polygone (ray casting)
        function pointInPolygon(px, py, pts) {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
                if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
            }
            return inside;
        }

        // Génère les segments de hachure (lignes parallèles) clippés dans une forme fermée.
        // spacingWorld = espacement entre lignes (unités monde), angleDeg = orientation.
        function computeHatchLines(shape, spacingWorld, angleDeg) {
            const segs = [];
            const ang = angleDeg * Math.PI / 180;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            // bounding box de la forme
            let minX, minY, maxX, maxY;
            if (shape.type === 'circle') {
                minX = shape.x - shape.r; maxX = shape.x + shape.r; minY = shape.y - shape.r; maxY = shape.y + shape.r;
            } else if (shape.loops) {
                const all = shape.loops.flat(), xs = all.map(p => p.x), ys = all.map(p => p.y);
                minX = arrMin(xs); maxX = arrMax(xs); minY = arrMin(ys); maxY = arrMax(ys);
            } else {
                const xs = shape.points.map(p => p.x), ys = shape.points.map(p => p.y);
                minX = arrMin(xs); maxX = arrMax(xs); minY = arrMin(ys); maxY = arrMax(ys);
            }
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            const diag = Math.hypot(maxX - minX, maxY - minY);
            const half = diag / 2 + spacingWorld;
            // direction perpendiculaire aux lignes (on balaie le long de cette normale)
            const nx = -sa, ny = ca;
            for (let d = -half; d <= half; d += spacingWorld) {
                // point de base sur la normale, ligne dans la direction (ca,sa)
                const bx = cx + nx * d, by = cy + ny * d;
                const x1 = bx - ca * diag, y1 = by - sa * diag;
                const x2 = bx + ca * diag, y2 = by + sa * diag;
                // clip de la ligne contre la forme
                const hits = clipLineToShape(x1, y1, x2, y2, shape);
                for (const seg of hits) segs.push(seg);
            }
            return segs;
        }

        // Renvoie les sous-segments d'une droite qui sont À L'INTÉRIEUR de la forme.
        function clipLineToShape(x1, y1, x2, y2, shape) {
            const inter = [];
            if (shape.type === 'circle') {
                const res = getIntersectionLineCircle(x1, y1, x2, y2, shape.x, shape.y, shape.r);
                res.forEach(p => inter.push(p));
            } else {
                // Contours (polygone ou zone avec îlots). Un sommet posé exactement sur la droite
                // compte d'un seul côté : pas de croisement compté deux fois.
                const dx = x2 - x1, dy = y2 - y1;
                const side = (p) => ((dx * (p.y - y1) - dy * (p.x - x1)) >= 0 ? 1 : -1);
                for (const pts of (shape.loops || [shape.points])) {
                    for (let i = 0; i < pts.length; i++) {
                        const a = pts[i], b = pts[(i + 1) % pts.length];
                        if (side(a) === side(b)) continue;
                        const ip = segLineIntersect(x1, y1, x2, y2, a.x, a.y, b.x, b.y);
                        if (ip) inter.push(ip);
                    }
                }
            }
            if (inter.length < 2) return [];
            // trier les intersections le long de la ligne (par projection)
            const dx = x2 - x1, dy = y2 - y1;
            inter.forEach(p => p.t = (p.x - x1) * dx + (p.y - y1) * dy);
            inter.sort((a, b) => a.t - b.t);
            // apparier : intérieur entre paires successives
            const out = [];
            for (let i = 0; i + 1 < inter.length; i += 2) {
                out.push({ x1: inter[i].x, y1: inter[i].y, x2: inter[i + 1].x, y2: inter[i + 1].y });
            }
            return out;
        }

        // Intersection d'une droite (infinie, définie par 2 points) avec un SEGMENT [a,b].
        function segLineIntersect(lx1, ly1, lx2, ly2, ax, ay, bx, by) {
            const r_px = lx1, r_py = ly1, r_dx = lx2 - lx1, r_dy = ly2 - ly1;
            const s_px = ax, s_py = ay, s_dx = bx - ax, s_dy = by - ay;
            const denom = r_dx * s_dy - r_dy * s_dx;
            if (Math.abs(denom) < 1e-12) return null;
            const t = ((s_px - r_px) * s_dy - (s_py - r_py) * s_dx) / denom;
            const u = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / denom;
            if (u < -1e-9 || u > 1 + 1e-9) return null; // hors du segment de la forme
            return { x: r_px + t * r_dx, y: r_py + t * r_dy };
        }

