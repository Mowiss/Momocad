        // ---- Apparence des points topo, réglée par calque ----
        const PT_SYMS = [['crosscircle', '⊕ croix + rond'], ['cross', '+ croix'], ['x', '× croix en X'], ['dot', '● point plein'], ['circle', '○ rond'], ['square', '□ carré'], ['triangle', '△ triangle'], ['none', 'aucun']];
        function ptStyleOf(layerId) { const l = layers.find(x => x.id === (layerId || 'layer-0')), p = (l && l.pt) || {};
            return { sym: p.sym || 'crosscircle', size: p.size > 0 ? p.size : 5, z: p.z !== false, mat: !!p.mat, code: !!p.code, dec: p.dec === 3 ? 3 : p.dec === 1 ? 1 : 2, lcol: p.lcol || '' }; }
        function ptLabelLines(s, ps) {
            const out = [];
            if (ps.mat && s.mat) out.push(String(s.mat));
            if (ps.z && hasZ(s.z)) out.push(nfFmt(ps.dec, true).format(s.z / 1000));
            if (ps.code && s.code) out.push(String(s.code));
            return out;
        }
        function drawPtSymbol(c, sym, X, Y, t) {
            c.beginPath();
            if (sym === 'cross' || sym === 'crosscircle') { c.moveTo(X - t, Y); c.lineTo(X + t, Y); c.moveTo(X, Y - t); c.lineTo(X, Y + t); }
            if (sym === 'x') { const u = t * 0.75; c.moveTo(X - u, Y - u); c.lineTo(X + u, Y + u); c.moveTo(X - u, Y + u); c.lineTo(X + u, Y - u); }
            c.stroke();
            if (sym === 'crosscircle') { c.beginPath(); c.arc(X, Y, t * 0.45, 0, 2 * Math.PI); c.stroke(); }
            else if (sym === 'circle') { c.beginPath(); c.arc(X, Y, t * 0.6, 0, 2 * Math.PI); c.stroke(); }
            else if (sym === 'dot') { c.beginPath(); c.arc(X, Y, t * 0.4, 0, 2 * Math.PI); c.fill(); }
            else if (sym === 'square') { const u = t * 0.55; c.strokeRect(X - u, Y - u, 2 * u, 2 * u); }
            else if (sym === 'triangle') { const u = t * 0.7; c.beginPath(); c.moveTo(X, Y - u); c.lineTo(X + u * 0.87, Y + u * 0.5); c.lineTo(X - u * 0.87, Y + u * 0.5); c.closePath(); c.stroke(); }
        }
        const PT_ICON_C = new Map();   /* icônes de symbole gardées : la liste des calques se redessine sans recréer d'images */
        function ptSymIcon(sym, col, px) { const ck = sym + '|' + col + '|' + (px || 22); if (PT_ICON_C.has(ck)) return PT_ICON_C.get(ck); const r = ptSymIcon0(sym, col, px); PT_ICON_C.set(ck, r); return r; }
        function ptSymIcon0(sym, col, px) { px = px || 22; const cv = document.createElement('canvas'); cv.width = px * 2; cv.height = px * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.6; drawPtSymbol(c, sym, px / 2, px / 2, px * 0.34); return cv.toDataURL(); }
        // aperçu : symbole + étiquettes d'exemple, comme sur le plan
        function ptStylePreview(id) {
            const cv = document.getElementById('pt-prev'); if (!cv) return; const c = cv.getContext('2d'), ps = ptStyleOf(id), l = layers.find(x => x.id === id) || {}, col = l.color || '#ffffff';
            const W = cv.width / 2, H = cv.height / 2; c.setTransform(2, 0, 0, 2, 0, 0); c.fillStyle = '#111827'; c.fillRect(0, 0, W, H);
            c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; for (let x = 10; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 10; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            const X = W / 2 - 30, Y = H / 2; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.5; drawPtSymbol(c, ps.sym, X, Y, ps.size);
            const lab = ptLabelLines({ mat: 'P12', z: 734560, code: 'TN' }, ps); c.font = 'bold 11px Arial'; c.fillStyle = ps.lcol || col; c.textBaseline = 'alphabetic';
            lab.forEach((t, i) => c.fillText(t, X + ps.size + 4, Y - 3 + i * 12 - (lab.length - 1) * 4));
        }
        function openPtStyle(id, btn) {
            closePtStyle(); const l = layers.find(x => x.id === id); if (!l) return; const ps = ptStyleOf(id);
            const d = document.createElement('div'); d.id = 'pt-style-pop';
            d.style.cssText = 'position:fixed;z-index:9000;background:#1f2937;border:1px solid #4b5563;border-radius:10px;padding:14px 16px;box-shadow:0 12px 32px rgba(0,0,0,.55);color:#e5e7eb;width:300px;';
            const ck = (k, lbl, right) => `<div class="mf-row"><label class="mf-ck"><input type="checkbox" ${ps[k] ? 'checked' : ''} onchange="setPtStyle('${id}','${k}',this.checked)"><span>${lbl}</span></label><span class="mf-c">${right || ''}</span></div>`;
            d.innerHTML = `<div class="mf-row" style="margin-bottom:8px;"><div><div style="font-weight:600;font-size:14px;">Points topo</div><div class="mf-hint">calque « ${MF.esc(l.name)} »</div></div><button type="button" onclick="closePtStyle()" style="color:#9ca3af;background:none;border:0;cursor:pointer;font-size:18px;line-height:1;">×</button></div>
                <canvas id="pt-prev" width="536" height="120" style="width:268px;height:60px;border-radius:6px;border:1px solid #374151;display:block;"></canvas>
                <div class="mf-sub" style="margin:12px 0 6px;">Symbole</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${PT_SYMS.map(([k, t]) => `<button type="button" title="${t}" onclick="setPtStyle('${id}','sym','${k}')" style="height:38px;display:flex;align-items:center;justify-content:center;background:${ps.sym === k ? '#1e3a5f' : '#374151'};border:1px solid ${ps.sym === k ? '#3b82f6' : '#4b5563'};border-radius:6px;cursor:pointer;">${k === 'none' ? '<span style="color:#9ca3af;font-size:11px;">aucun</span>' : `<img src="${ptSymIcon(k, '#e5e7eb', 26)}" width="26" height="26">`}</button>`).join('')}</div>
                <div class="mf-sub" style="margin:12px 0 2px;">Taille</div>
                <div class="mf-row"><input type="range" min="2" max="14" step="1" value="${ps.size}" oninput="setPtStyle('${id}','size',+this.value);document.getElementById('pt-size-v').textContent=this.value+' px'" style="flex:1;accent-color:#3b82f6;"><span id="pt-size-v" class="mf-l" style="width:38px;text-align:right;">${ps.size} px</span></div>
                <div class="mf-sub" style="margin:10px 0 2px;">Étiquettes</div>
                ${ck('mat', 'Matricule (n° du point)')}
                ${ck('z', 'Altitude', `<span class="mf-l">décimales</span><select onchange="setPtStyle('${id}','dec',+this.value)" class="mf-in mf-sel" style="width:3.4rem;">${[1, 2, 3].map(v => `<option${v === ps.dec ? ' selected' : ''}>${v}</option>`).join('')}</select>`)}
                ${ck('code', 'Code (nature du point)')}
                <div class="mf-row" style="margin-top:4px;"><span class="mf-l">Couleur des étiquettes</span><span class="mf-c"><input type="color" value="${ps.lcol || l.color || '#ffffff'}" onchange="setPtStyle('${id}','lcol',this.value)" style="width:30px;height:26px;padding:0;border:0;background:none;cursor:pointer;"><button type="button" onclick="setPtStyle('${id}','lcol','')" class="sp-act" style="width:auto;padding:3px 8px;font-size:11.5px;${ps.lcol ? '' : 'border-color:#3b82f6;'}">du calque</button></span></div>
                <div style="display:flex;justify-content:flex-end;margin-top:12px;"><button type="button" onclick="closePtStyle()" style="background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 18px;cursor:pointer;font-size:13px;">OK</button></div>`;
            document.body.appendChild(d); ptStylePreview(id);
            const r = btn.getBoundingClientRect(); d.style.left = Math.max(8, Math.min(window.innerWidth - 316, r.left - 150)) + 'px'; d.style.top = Math.max(8, Math.min(window.innerHeight - d.offsetHeight - 8, r.bottom + 6)) + 'px';
            setTimeout(() => document.addEventListener('mousedown', ptStyleOutside, true), 0);
        }
        function ptStyleOutside(e) { const d = document.getElementById('pt-style-pop'); if (d && !d.contains(e.target)) closePtStyle(); }
        function closePtStyle() { const d = document.getElementById('pt-style-pop'); if (d) d.remove(); document.removeEventListener('mousedown', ptStyleOutside, true); }
        function setPtStyle(id, k, v) {
            const l = layers.find(x => x.id === id); if (!l) return; l.pt = Object.assign({}, l.pt, { [k]: v });
            invalidateCache(); saveState(); draw(); ptStylePreview(id);
            if (k === 'sym' || k === 'lcol') { const d = document.getElementById('pt-style-pop'), b = document.querySelector('[data-ptbtn="' + id + '"]') || document.activeElement; if (d && b) { const L = d.style.left, T = d.style.top; openPtStyle(id, b); const d2 = document.getElementById('pt-style-pop'); if (d2) { d2.style.left = L; d2.style.top = T; } } }
            const ib = document.querySelector('[data-ptbtn="' + id + '"] img'); if (ib) ib.src = ptSymIcon(ptStyleOf(id).sym, '#d1d5db');
        }
        function updateLayerUI() {
            const select = document.getElementById('active-layer-select');
            if (select) { select.innerHTML = ''; layers.forEach(l => { let opt = document.createElement('option'); opt.value = l.id; opt.textContent = l.name; if (l.id === activeLayerId) opt.selected = true; select.appendChild(opt); }); }
            layDDCur(); if (document.getElementById('lay-dd')) layDDRender();
            const list = document.getElementById('layers-list');
            if (list) {
                list.innerHTML = ''; const NB = new Map(); shapes.forEach(s => NB.set(s.layerId, (NB.get(s.layerId) || 0) + 1));
                const mkRow = (l, sub) => {
                    let div = document.createElement('div'); div.className = `lay-grid lay-row ${l.id === activeLayerId ? 'lay-act' : ''}${sub ? ' lay-sub' : ''}`; layDnD(div, { lid: l.id });
                    const isT = l.dash === 'text', esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                    const eye = l.visible ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
                    const hm = { beton: 'Béton', brique: 'Brique', parpaing: 'Parpaing', isolant: 'Laine', pse: 'PSE', placo: 'Placo', enduit: 'Enduit', bois: 'Bois', sable: 'Sable', gnt: 'GNT', pierre: 'Pierre' };
                    div.innerHTML = `
                        <button onclick="toggleLayerVis('${l.id}')" class="lay-ic ${l.visible ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}" title="${l.visible ? 'Masquer' : 'Afficher'} le calque">${eye}</button>
                        <button type="button" onclick="toggleLayerTin('${l.id}')" class="lay-ic" style="font-size:13px;opacity:${l.noTin ? .3 : 1};filter:${l.noTin ? 'grayscale(1)' : 'none'}" title="${l.noTin ? 'Ce calque ne compte PAS dans le terrain (cliquer pour l\'y remettre)' : 'Ses points et lignes cotés comptent dans le terrain, même masqué (cliquer pour l\'en exclure)'}">⛰</button>
                        <span class="lay-name" data-n="${NB.get(l.id) || 0}" title="Clic : calque actif · double-clic : renommer · ${NB.get(l.id) || 0} objet(s)" onclick="if (activeLayerId !== '${l.id}') setActiveLayer('${l.id}')" ondblclick="event.stopPropagation();renameLayerUI(this,'${l.id}')">${esc(sub ? layLabel(l, layGroupOf(l)) : l.name)}</span>
                        <button type="button" class="lay-ic text-gray-500 hover:text-sky-300" title="Renommer le calque" onclick="renameLayerUI(this.previousElementSibling,'${l.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                        <input type="text" list="lay-groups-dl" value="${esc(l.group !== undefined ? l.group : (layGroupOf(l) || ''))}" placeholder="—" title="Groupe : tapez un nom (nouveau ou existant) ou choisissez-le ; vide = hors groupe" class="lay-in" onchange="setLayerGroup('${l.id}', this.value)">
                        <input type="color" value="${l.color || '#ffffff'}" title="Couleur" class="lay-color" onchange="setLayerStyle('${l.id}','color',this.value)">
                        <select title="Type de ligne" class="lay-in font-mono" onchange="setLayerStyle('${l.id}','dash',this.value)">
                            <option value="solid"${(l.dash||'solid')==='solid'?' selected':''}>──</option>
                            <option value="dashed"${l.dash==='dashed'?' selected':''}>- -</option>
                            <option value="center"${l.dash==='center'?' selected':''}>-·-</option>
                            <option value="text"${isT?' selected':''}>-T-</option>
                        </select>
                        <input type="text" value="${esc(l.ltText || '')}" placeholder="${isT ? 'PVC120' : '—'}" ${isT ? '' : 'disabled'} title="Texte répété dans la ligne (---PVC120---) : actif avec le type de ligne -T-" class="lay-in ${isT ? '' : 'opacity-30 cursor-not-allowed'}" onchange="setLayerStyle('${l.id}','ltText',this.value)">
                        <select title="Épaisseur du trait sur le papier (plumes normalisées)" class="lay-in text-center" onchange="setLayerStyle('${l.id}','width',parseFloat(this.value)||1)">${layPenOpts(l.width || 1)}</select>
                        <input type="text" inputmode="decimal" value="${l.textH ? String(l.textH).replace('.', ',') : ''}" placeholder="auto" title="Texte : vide = variable (taille constante, comme les cotes) ; valeur = hauteur fixe en mm dans le dessin" class="lay-in text-center placeholder-gray-500" onchange="setLayerStyle('${l.id}','textH',this.value)">
                        <select title="Hachure" class="lay-in" onchange="setLayerStyle('${l.id}','hatch',this.value)">
                            <option value="lines"${(l.hatch||'lines')==='lines'?' selected':''}>/// Traits</option>
                            <option value="cross"${l.hatch==='cross'?' selected':''}>XX Croisé</option>
                            <option value="solid"${l.hatch==='solid'?' selected':''}>■ Plein</option>
                            ${Object.keys(WALL_MATS).filter(m => m !== 'air').map(m => `<option value="m-${m}"${l.hatch === 'm-' + m ? ' selected' : ''} title="Motif ${WALL_MATS[m].name}">${hm[m]}</option>`).join('')}
                        </select>
                        <input type="text" inputmode="decimal" value="${String(layerHatchScaleOf(l)).replace('.', ',')}" title="Échelle de hachure : multiplie l'écartement des traits (1 = 3 mm, 2 = 6 mm, 0,5 = 1,5 mm). Sans effet sur le plein." class="lay-in text-center ${l.hatch==='solid'?'opacity-40':''}" onchange="setLayerStyle('${l.id}','hatchScale',this.value)">
                        <button data-ptbtn="${l.id}" onclick="openPtStyle('${l.id}', this)" title="Apparence des points topo de ce calque (symbole, taille, étiquettes)" class="lay-pt"><img src="${ptSymIcon(ptStyleOf(l.id).sym, '#d1d5db')}" width="18" height="18"></button>
                        <button onclick="deleteLayer('${l.id}')" class="lay-ic text-gray-500 hover:text-red-400" title="Supprimer le calque"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
                    list.appendChild(div);
                };
                layMgrRender(list, mkRow);
            }
        }
        // ---- LISTE DES CALQUES (bouton du calque actif) : clic sur un nom = calque actif ; l'œil masque / affiche sans changer de calque.
        // Les calques importés d'un même plan (« Plan · Murs », « Plan · Talus »…) sont rangés sous le nom du plan, repliables, avec un œil pour tout le groupe.
        const LD_EYE = (st) => st === 'off' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        let layDDOpen = new Set(), layDDQ = '';
        const ldEsc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        function layDDCur() { const c = document.getElementById('lay-dd-cur'); if (!c) return; const l = layers.find(x => x.id === activeLayerId) || layers[0]; if (!l) return;
            c.innerHTML = `<span class="ld-dot" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${ldEsc(l.color || '#fff')}"></span>${ldEsc(l.name)}`; c.parentElement.title = 'Calque actif : ' + l.name + ' — clic pour changer, afficher ou masquer les calques'; }
        function layDDToggle(e) { if (e) e.stopPropagation(); const d = document.getElementById('lay-dd'); if (d) { d.remove(); return; }
            const b = document.getElementById('lay-dd-btn').getBoundingClientRect(), el = document.createElement('div'); el.id = 'lay-dd'; el.style.left = Math.max(8, Math.min(b.left, innerWidth - 410)) + 'px'; el.style.top = (b.bottom + 4) + 'px';
            el.innerHTML = '<div class="ld-top"><input id="ld-q" type="text" placeholder="Chercher un calque…" oninput="layDDQ=this.value;layDDRender()"><button type="button" onclick="layDDAll(true)" title="Afficher tous les calques">Tout afficher</button><button type="button" onclick="closeLayDD();openLayerModal()" title="Couleurs, traits, hachures…">⚙ Gérer</button></div><div class="ld-list" id="ld-list"></div>';
            el.addEventListener('mousedown', ev => ev.stopPropagation()); el.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') closeLayDD(); });
            document.body.appendChild(el); layDDQ = ''; layDDRender(); setTimeout(() => { const q = document.getElementById('ld-q'); if (q && layers.length > 12) q.focus(); }, 0); }
        function closeLayDD() { const d = document.getElementById('lay-dd'); if (d) d.remove(); }
        document.addEventListener('mousedown', () => closeLayDD());
        // groupe d'un calque : celui qu'on lui a donné, sinon le plan importé dont il vient (« Plan · Murs » → Plan) ; '' = hors groupe voulu
        function layGroupOf(l) { if (l.group !== undefined) return l.group || null; const k = String(l.name).indexOf(' · '); return k > 0 ? String(l.name).slice(0, k) : null; }
        function layLabel(l, g) { return g && l.group === undefined && String(l.name).startsWith(g + ' · ') ? String(l.name).slice(g.length + 3) : l.name; }
        function layGroupNames() { return [...new Set(layers.map(layGroupOf).filter(Boolean))]; }
        // glisser-déposer dans le gestionnaire : sur un calque, il passe juste avant (et dans son groupe) ; sur un en-tête de groupe, il rejoint le groupe
        let layDrag = null;
        function layDnD(el, T) { if (T.lid) { el.draggable = true; el.addEventListener('dragstart', (e) => { if (/INPUT|SELECT|BUTTON/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); return; } layDrag = T.lid; el.classList.add('lay-drag'); try { e.dataTransfer.setData('text/plain', T.lid); e.dataTransfer.effectAllowed = 'move'; } catch (er) {} }); el.addEventListener('dragend', () => { layDrag = null; el.classList.remove('lay-drag'); document.querySelectorAll('.lay-over').forEach(x => x.classList.remove('lay-over')); }); }
            el.addEventListener('dragover', (e) => { if (!layDrag || layDrag === T.lid) return; e.preventDefault(); el.classList.add('lay-over'); }); el.addEventListener('dragleave', () => el.classList.remove('lay-over'));
            el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('lay-over'); const id = layDrag; layDrag = null; if (!id) return; if (T.lid) layMove(id, T.lid); else layMoveToGroup(id, T.grp); }); }
        function layMove(id, before) { if (id === before) return; const i = layers.findIndex(l => l.id === id), L = layers[i], tg = layers.find(l => l.id === before); if (i < 0 || !tg) return; layers.splice(i, 1); layers.splice(layers.indexOf(tg), 0, L);
            const g = layGroupOf(tg), k = String(L.name).indexOf(' · '); if (g) L.group = g; else if (layGroupOf(L)) { if (k > 0) L.group = ''; else delete L.group; } invalidateCache(); updateLayerUI(); draw(); }
        function layMoveToGroup(id, g) { const i = layers.findIndex(l => l.id === id); if (i < 0) return; const L = layers[i]; layers.splice(i, 1); let j = -1; layers.forEach((l, k) => { if (layGroupOf(l) === g) j = k; }); layers.splice(j + 1, 0, L); L.group = g; invalidateCache(); updateLayerUI(); draw(); }
        function setLayerGroup(id, v) { const l = layers.find(x => x.id === id); if (!l) return; v = String(v || '').trim(); const k = String(l.name).indexOf(' · ');
            if (v) l.group = v; else if (k > 0) l.group = ''; else delete l.group; invalidateCache(); updateLayerUI(); draw(); }
        function layGroupRename(g, nv) { nv = String(nv || '').trim(); if (!nv || nv === g) return; layers.forEach(l => { if (layGroupOf(l) !== g) return; if (l.group === undefined && String(l.name).startsWith(g + ' · ')) l.name = nv + ' · ' + String(l.name).slice(g.length + 3); else l.group = nv; });
            if (layDDOpen.has(g)) { layDDOpen.delete(g); layDDOpen.add(nv); } if (layMgrClosed.has(g)) { layMgrClosed.delete(g); layMgrClosed.add(nv); } invalidateCache(); updateLayerUI(); draw(); }
        function layGroupUngroup(g) { layers.forEach(l => { if (layGroupOf(l) !== g) return; if (l.group === undefined && String(l.name).startsWith(g + ' · ')) l.group = ''; else delete l.group; if (l.group === '' && String(l.name).indexOf(' · ') < 0) delete l.group; }); updateLayerUI(); draw(); }
        let layMgrClosed = new Set();
        function layGroupRenameUI(g) { openTopoModal('📁 Renommer le groupe', `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb">${MF.row('Nom du groupe', MF.txt('lg-new', g), '')}</div>`,
            [['Annuler', () => closeTopoModal(), false], ['Renommer', () => { const v = document.getElementById('lg-new').value; closeTopoModal(); layGroupRename(g, v); }, true]]); setTimeout(() => { const e = document.getElementById('lg-new'); if (e) { e.focus(); e.select(); } }, 30); }
        // gestionnaire : les calques groupés sous un bandeau (œil du groupe, replier, renommer d'un double-clic, dégrouper)
        function layMgrRender(list, mkRow) { const dl = document.getElementById('lay-groups-dl'); if (dl) dl.innerHTML = layGroupNames().map(g => `<option value="${ldEsc(g)}">`).join('');
            layDDGroups().forEach(g => { if (g.l) { mkRow(g.l, false); return; } const on = g.L.filter(l => l.visible !== false).length, st = on === g.L.length ? 'on' : on ? 'mid' : 'off', open = !layMgrClosed.has(g.p), q = ldEsc(g.p).replace(/'/g, "\\'");
                const hd = document.createElement('div'); hd.className = 'lay-grp-hd'; hd.title = 'Clic : replier / déplier · double-clic sur le nom : renommer le groupe · déposer un calque ici : le ranger dans ce groupe'; layDnD(hd, { grp: g.p });
                hd.innerHTML = `<button type="button" class="${st === 'off' ? '' : 'text-blue-400'}" style="color:${st === 'off' ? '#6b7280' : '#60a5fa'};opacity:${st === 'mid' ? .7 : 1}" title="${st === 'off' ? 'Afficher' : 'Masquer'} tout le groupe" onclick="event.stopPropagation();layDDGroupVis('${q}')">${LD_EYE(st === 'off' ? 'off' : 'on')}</button><span style="color:#9ca3af;font-size:10px">${open ? '▼' : '▶'}</span><span class="lg-name" ondblclick="event.stopPropagation();layGroupRenameUI('${q}')">📁 ${ldEsc(g.p)}</span><span class="lg-n">${g.L.length} calque(s) · ${on} affiché(s)</span><button type="button" title="Sortir les calques de ce groupe" onclick="event.stopPropagation();layGroupUngroup('${q}')">Dégrouper</button>`;
                hd.onclick = () => { if (layMgrClosed.has(g.p)) layMgrClosed.delete(g.p); else layMgrClosed.add(g.p); updateLayerUI(); }; list.appendChild(hd); if (open) g.L.forEach(l => mkRow(l, true)); }); }
        function layDDGroups() { const G = [], byP = new Map(); layers.forEach(l => { const p = layGroupOf(l);
                if (p) { if (!byP.has(p)) { const g = { p, L: [] }; byP.set(p, g); G.push(g); } byP.get(p).L.push(l); } else G.push({ l }); });
            const R = G.map(g => g.L && g.L.length === 1 && g.L[0].group === undefined ? { l: g.L[0] } : g);
            return R.filter(g => g.l).concat(R.filter(g => !g.l)); }   // calques sans groupe en haut de la liste, puis les groupes
        function layDDRender() { const box = document.getElementById('ld-list'); if (!box) return; const q = layDDQ.trim().toLowerCase(), m = (l) => !q || String(l.name).toLowerCase().includes(q); let h = '';
            const row = (l, sub, label) => `<div class="ld-row${sub ? ' sub' : ''}${l.id === activeLayerId ? ' act' : ''}${l.visible === false ? ' off' : ''}" data-id="${ldEsc(l.id)}" onclick="layDDPick('${l.id}')" title="${ldEsc(l.name)} — clic : calque actif"><button type="button" class="ld-eye${l.visible === false ? ' off' : ''}" title="${l.visible === false ? 'Afficher' : 'Masquer'} ce calque" onclick="event.stopPropagation();toggleLayerVis('${l.id}')">${LD_EYE(l.visible === false ? 'off' : 'on')}</button><span class="ld-dot" style="background:${ldEsc(l.color || '#fff')}"></span><span class="ld-nm">${ldEsc(label || l.name)}</span></div>`;
            layDDGroups().forEach(g => { if (g.l) { if (m(g.l)) h += row(g.l); return; } const L = g.L.filter(m); if (!L.length) return; const on = g.L.filter(l => l.visible !== false).length, st = on === g.L.length ? 'on' : on ? 'mid' : 'off', open = q || layDDOpen.has(g.p);
                h += `<div class="ld-row ld-grp${st === 'off' ? ' off' : ''}" onclick="layDDFold('${ldEsc(g.p).replace(/'/g, "\\'")}')" title="Clic : déplier / replier"><button type="button" class="ld-eye ${st === 'on' ? '' : st}" title="${st === 'off' ? 'Afficher' : 'Masquer'} les ${g.L.length} calques de « ${ldEsc(g.p)} »" onclick="event.stopPropagation();layDDGroupVis('${ldEsc(g.p).replace(/'/g, "\\'")}')">${LD_EYE(st === 'off' ? 'off' : 'on')}</button><span class="ld-car">${open ? '▼' : '▶'}</span><span class="ld-nm">${ldEsc(g.p)} <span class="ld-n">· ${on}/${g.L.length} affichés</span></span></div>`;
                if (open) L.forEach(l => { h += row(l, true, layLabel(l, g.p)); }); });
            box.innerHTML = h || '<div style="padding:10px;color:#9ca3af">Aucun calque ne correspond.</div>'; }
        function layDDPick(id) { setActiveLayer(id); closeLayDD(); }
        function layDDFold(p) { if (layDDOpen.has(p)) layDDOpen.delete(p); else layDDOpen.add(p); layDDRender(); }
        function layDDGroupVis(p) { const L = layers.filter(l => layGroupOf(l) === p), anyOn = L.some(l => l.visible !== false); L.forEach(l => { l.visible = !anyOn; }); invalidateCache(); updateLayerUI(); draw(); }
        function layDDAll(v) { layers.forEach(l => { l.visible = v; }); invalidateCache(); updateLayerUI(); draw(); }
        function changeActiveLayer() { activeLayerId = document.getElementById('active-layer-select').value; let l = layers.find(layer => layer.id === activeLayerId); if (l && !l.visible) l.visible = true; invalidateCache(); updateLayerUI(); draw(); }
        function setActiveLayer(id) { activeLayerId = id; let l = layers.find(layer => layer.id === activeLayerId); if (l && !l.visible) l.visible = true; invalidateCache(); updateLayerUI(); draw(); }
        function toggleLayerVis(id) { let l = layers.find(layer => layer.id === id); if (l) l.visible = !l.visible; invalidateCache(); updateLayerUI(); draw(); }
        // épaisseurs normalisées (mm sur le papier) ; largeur interne = mm / 0,25 (1 = 0,25 mm, comme le DXF)
        const PEN_MM = [0.09, 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4, 2];
        function layPenOpts(w) { const mm = (+w || 1) * 0.25, L = PEN_MM.slice(); if (!L.some(v => Math.abs(v - mm) < 0.005)) { L.push(Math.round(mm * 1000) / 1000); L.sort((a, b) => a - b); }
            return L.map(v => `<option value="${v / 0.25}"${Math.abs(v - mm) < 0.005 ? ' selected' : ''}>${String(v).replace('.', ',')}</option>`).join(''); }
        function setLayerStyle(id, prop, value) {
            const l = layers.find(layer => layer.id === id);
            if (!l) return;
            if (prop === 'textH') { const v = parseFloat(String(value).replace(',', '.')); value = v > 0 ? v : ''; }
            if (prop === 'hatchScale') { const v = parseFloat(String(value).replace(',', '.')); value = v > 0 ? Math.min(v, 1000) : 1; }
            l[prop] = value;
            invalidateCache(); saveState(); draw();
            if (prop === 'hatchScale' || prop === 'hatch' || prop === 'dash') updateLayerUI();
        }
        // --- Modale de paramétrage de la sélection (assignation de calque) ---
        // ---- Fenêtre Y : réglages de la sélection, rangés en chapitres dépliables selon le type d'objet ----
        function spChapter(key, icon, title, inner, open, sum) {
            if (!inner) return '';
            const st0 = window.spOpenState || {}, o = st0[key] !== undefined ? st0[key] : open;
            return `<details class="sp-ch" data-k="${key}" ${o ? 'open' : ''} ontoggle="(window.spOpenState=window.spOpenState||{})['${key}']=this.open"><summary><span class="sp-ic">${icon}</span><span class="sp-t">${title}</span>${sum ? `<span class="sp-sum">${sum}</span>` : '<span class="sp-sum"></span>'}<svg class="sp-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"></polyline></svg></summary><div class="sp-chb">${inner}</div></details>`;
        }
        function selKind() {
            const S = selectedShapes, one = S.length === 1 ? S[0] : null;
            const wallG = S.length && S.every(x => x.wallMat);
            if (wallG) { const g = new Set(S.map(x => x.groupId)).size, m = WALL_MATS[S[0].wallMat]; if (g === 1 && S.every(x => x.wallCx)) return { k: 'wall', t: 'Paroi complexe — ' + S[0].wallCx }; return { k: 'wall', t: (g > 1 ? g + ' murs' : 'Mur') + ' — ' + (m ? m.name : 'paroi') }; }
            { const CL = S.length > 1 && S.some(x => x.secTitle) ? cutLineOf(S) : null; if (CL) return { k: 'section', t: 'Coupe ' + CL.cutDef.name + '-' + CL.cutDef.name }; }   /* une coupe dynamique : pas un bloc à éclater */
            if (S.length && S.every(x => x.groupId) && new Set(S.map(x => x.groupId)).size === 1) return { k: 'block', t: 'Bloc' + (S[0].block ? ' « ' + S[0].block + ' »' : '') + ' (' + S.length + ' objets)' };
            if (!one) return { k: S.every(x => x.type === 'point') ? 'points' : 'multi', t: S.length + ' objets' + (S.every(x => x.type === 'point') ? ' (points topo)' : '') };
            if (one.type === 'cline') return { k: 'cline', t: 'Trait de construction (sans calque)' };
            if (one.water) return { k: 'water', t: 'Niveau d\'eau « ' + (one.water.name || '') + ' »' };
            if (one.trench) return { k: 'trench', t: 'Tranchée « ' + (one.trench.name || one.name || '') + ' »' };
            if (one.type === 'point') return { k: 'point', t: 'Point topo' };
            if (one.sweep) return { k: 'sweep', t: (one.sweep.perp ? 'Poutre — ' : 'Balayage 3D — ') + sweepPreset(one.sweep.p)[1] };
            if (one.type === 'line') return { k: one.wall ? 'oldwall' : 'line', t: one.wall ? 'Paroi (droite à couches)' : 'Droite' };
            if (one.type === 'circle') return { k: 'circle', t: one.solid ? 'Volume (' + SOLID_NAMES[one.solid.kind] + ')' : 'Cercle' };
            if (one.type === 'arc') return { k: 'arc', t: 'Arc' };
            if (one.type === 'poly' && one.bld) return { k: 'poly', t: 'Contour de bâtiment « ' + (one.bld.nm || '') + ' »' };
            if (one.type === 'poly' && one.rdAx) return { k: 'poly', t: 'Axe de route' };
            if (one.type === 'poly' && one.ctop) return { k: 'poly', t: one.ctop.k === 'bar' ? 'Bar déroulé' : 'Plan de travail déroulé' };
            if (one.type === 'poly' && one.stair2) return { k: 'poly', t: 'Escalier d\'étage' };
            if (one.type === 'poly') return { k: 'poly', t: one.solid ? (one.solid.kind === 'pyr' ? 'Pyramide' : one.solid.kind === 'roof' ? 'Pan de toiture' : 'Volume extrudé') : one.open ? 'Polyligne ouverte' : 'Polyligne fermée' + (isPlateforme(one) ? ' — plateforme' : '') };
            return { k: one.type, t: ({ text: 'Texte', hatch: 'Hachure', dim: 'Cote', detail: 'Infobulle', mesh: 'Maillage 3D', pdfvec: 'Tracés PDF', bgimage: 'Image de fond', basemap: 'Fond de carte' })[one.type] || 'Objet' };
        }
        // ---- petit système de formulaire commun (fenêtre Y, points) : libellé à gauche, champ aligné à droite, unité dans une colonne fixe ----
        const MF = {
            esc: (t) => String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
            row: (label, ctrl, unit) => `<div class="mf-row"><span class="mf-l">${label}</span><span class="mf-c">${ctrl}<span class="mf-u">${unit || ''}</span></span></div>`,
            num: (id, v, ph, extra) => `<input id="${id}" type="text" inputmode="decimal" value="${MF.esc(v)}" placeholder="${MF.esc(ph || '—')}" class="mf-in" ${extra || ''}>`,
            txt: (id, v, ph, extra) => `<input id="${id}" type="text" value="${MF.esc(v)}" placeholder="${MF.esc(ph || '')}" class="mf-in mf-wide" ${extra || ''}>`,
            sel: (id, opts, v, extra) => `<select id="${id}" class="mf-in mf-sel" ${extra || ''}>${opts.map(o => { const [val, lb] = Array.isArray(o) ? o : [o, o]; return `<option value="${MF.esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${MF.esc(lb)}</option>`; }).join('')}</select>`,
            ck: (id, label, on, right) => `<div class="mf-row"><label class="mf-ck"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label><span class="mf-c">${right || ''}</span></div>`,
            seg: (name, opts, cur, onch) => `<div class="mf-seg">${opts.map(([v, lb]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''} onchange="${onch || ''}"><span>${lb}</span></label>`).join('')}</div>`,
            hint: (t) => `<div class="mf-hint">${t}</div>`,
            sub: (t) => `<div class="mf-sub">${t}</div>`,
            acts: (list) => `<div class="mf-acts">${list.map(([lb, js, tip]) => `<button type="button" class="sp-act" title="${MF.esc(tip || '')}" onclick="${js}">${lb}</button>`).join('')}</div>`,
        };

        // ---- paragraphes longs des volets : la première phrase seulement, le texte complet au survol ----
        function mfClampScan(root) {
            (root || document).querySelectorAll('.mf-hint, .ps-sub, .piw-p, #tm-body > p, #tm-body > div > p, #t2-panel .vb > p').forEach(el => {
                if (el.dataset.cl || el.closest('.mf-fig') || el.closest('.hg-ch') || (el.textContent || '').length < 140) return; el.dataset.cl = '1';
                // une seule phrase courte dans le volet ; le texte complet reste au survol (et dans le guide)
                const full = (el.textContent || '').replace(/\s+/g, ' ').trim(), m = full.match(/^(.{40,220}?[.!?])(\s|$)/); if (!m || m[1].length >= full.length - 2) return;
                el.title = full; el.textContent = m[1] + ' …'; el.style.cursor = 'help'; }); }
        { let t = 0; const run = () => { t = 0; ['#topo-modal', '#selparam-modal', '#cartouche-modal', '#pi-wiz', '#snap-modal', '#t2-panel'].forEach(q => { const r = document.querySelector(q); if (r && !r.classList.contains('hidden') && getComputedStyle(r).display !== 'none') mfClampScan(r); }); };
          new MutationObserver(() => { if (!t) t = requestAnimationFrame(run); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); }
        // ---- volet Y en direct : chaque réglage s'applique tout de suite ; Annuler revient à l'état d'ouverture, Valider garde (une seule étape d'annulation) ----
        let spLive = null, _spLive = false, spLiveT = 0;
        function spLiveCommit() { if (spLive && historyStep > spLive.h0 + 1 && shapesHistory.length > spLive.h0 + 1) { shapesHistory.splice(spLive.h0 + 1, historyStep - spLive.h0 - 1); historyStep = spLive.h0 + 1; } if (spLive) spLive.h0 = historyStep; }
        function spCancel() { const L = spLive; closeSelectionParamModal(); spLive = null; if (!L || historyStep <= L.h0 || !shapesHistory[L.h0]) return;
            const st = shapesHistory[L.h0]; shapes = st.shapes; layers = st.layers; activeLayerId = st.activeLayerId; shapesHistory.length = L.h0 + 1; historyStep = L.h0; selectedShapes = [];
            tinCache = null; invalidateCache(); updateLayerUI(); draw(); refresh3D(); updateCommandMessageText('Réglages annulés : retour à l\'état d\'avant.'); }
        function spLiveApply() { const m = document.getElementById('selparam-modal'); if (!m || m.classList.contains('hidden') || !spLive || !selectedShapes.length) return;
            _spLive = true; try { _applySelectionLayer(); } catch (e) { console.warn('aperçu', e); } finally { _spLive = false; }
            if (historyStep > spLive.h0 + 1) { shapesHistory.splice(spLive.h0 + 1, historyStep - spLive.h0 - 1); historyStep = spLive.h0 + 1; }
            if (typeof is3DOpen === 'function' && is3DOpen() && V3) { build3DScene(); render3D(); } spFigRedraw(); const b = document.getElementById('sp-live'); if (b) { b.textContent = '● appliqué'; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = '● aperçu en direct'; }, 900); } }
        document.addEventListener('input', (e) => { const m = e.target.closest && e.target.closest('#selparam-modal'); if (!m || e.target.id === 'sp-q') return; clearTimeout(spLiveT); spLiveT = setTimeout(spLiveApply, 450); }, true);
        document.addEventListener('change', (e) => { const m = e.target.closest && e.target.closest('#selparam-modal'); if (!m) return; clearTimeout(spLiveT); spLiveT = setTimeout(spLiveApply, 120); }, true);
        // ---- dessins des volets : les cases se remplissent sur le schéma (comme les ouvertures) ----
        const spNum = (id) => { const e = document.getElementById(id); if (!e) return NaN; const v = parseFloat(String(e.value).replace(/\s/g, '').replace(',', '.')); return v; };
        const SP_FIG = {
            wall3d: { slots: [['sp-wzt', 6, 13, 76, 'N haut'], ['sp-wzb', 6, 70, 76, 'N bas'], ['sp-wzhh', 70, 40, 64, 'hauteur']], draw: () => { const b = spNum('sp-wzb'), t = spNum('sp-wzt'), h = isFinite(t) && isFinite(b) ? t - b : spNum('sp-wzhh'), ok = isFinite(b) && (isFinite(t) || isFinite(h));
                return `<path d="M20 132H340" stroke="#65a30d" stroke-width="1.5"/>${[...Array(16)].map((_, i) => `<path d="M${28 + i * 20} 132l-8 9" stroke="#4d7c0f"/>`).join('')}
                    <rect x="150" y="40" width="60" height="92" fill="${ok ? 'url(#spBeton)' : 'none'}" stroke="${ok ? '#cbd5e1' : '#6b7280'}" stroke-width="1.6" ${ok ? '' : 'stroke-dasharray="5 4"'}/>
                    <path d="M108 40H146M108 132H146" stroke="#f59e0b" stroke-dasharray="3 3"/><path d="M228 40V132M224 46l4-7 4 7M224 126l4 7 4-7" stroke="#f59e0b" stroke-width="1.4" fill="none"/>
                    ${ok ? '' : '<text x="180" y="92" fill="#9ca3af" font-size="11" text-anchor="middle" font-family="sans-serif">mur 2D</text>'}`; } },
            bat: { slots: [['sp-battop', 66, 10, 76, 'haut (NGF)'], ['sp-zall', 66, 72, 76, 'pied']], draw: () => { const t = spNum('sp-battop'), b = spNum('sp-zall'), H = t - b;
                return `<path d="M20 136L340 128" stroke="#65a30d" stroke-width="1.5"/><rect x="110" y="40" width="120" height="93" fill="#3f2a2a" stroke="#f87171" stroke-width="1.6"/><path d="M110 40h120" stroke="#fca5a5" stroke-width="3"/>
                    ${[0, 1, 2].map(i => `<rect x="${124 + i * 34}" y="62" width="20" height="16" fill="#1e293b" stroke="#fca5a5" stroke-width=".8"/>`).join('')}<rect x="160" y="100" width="18" height="33" fill="#1e293b" stroke="#fca5a5" stroke-width=".8"/>
                    <path d="M234 40H250M234 133H250" stroke="#f59e0b" stroke-dasharray="3 3"/><path d="M246 40V133M242 46l4-7 4 7M242 127l4 7 4-7" stroke="#f59e0b" stroke-width="1.4" fill="none"/>
                    <text x="200" y="${isFinite(H) ? 92 : 92}" fill="#fbbf24" font-size="13" font-weight="700" font-family="sans-serif" text-anchor="middle" transform="translate(70 0)">${isFinite(H) ? 'H ' + nfr(H, 2) : ''}</text>`; } },
            alt: { slots: [['sp-z', 56, 33, 76, 'altitude Z'], ['sp-mat', 56, 66, 110, 'matricule']], draw: () => `<path d="M20 130C90 118 150 122 200 112S300 100 340 104" stroke="#65a30d" stroke-width="1.5" fill="none"/><path d="M150 108l-10 -10M150 108l10 -10M150 108l-10 10M150 108l10 10" stroke="#a3e635" stroke-width="2"/><circle cx="150" cy="108" r="3" fill="#a3e635"/><path d="M162 98L196 70" stroke="#f59e0b" stroke-dasharray="3 3"/>` },
            solz: { slots: [['sp-ztop', 3, 26, 82, 'dessus', '#f59e0b'], ['sp-zall', 3, 61, 82, 'dessous (base)', '#60a5fa'], ['sp-z', 3, 61, 82, 'dessous (base)', '#60a5fa']], draw: (one) => { const k = one && one.solid ? one.solid.kind : 'box', top = SOL_H(one), b = spNum(one && one.type === 'circle' ? 'sp-z' : 'sp-zall'), t = spNum('sp-ztop'), H = isFinite(t) && isFinite(b) ? t - b : spSolH(one) / 1000;
                const y0 = top ? 52 : 70, y1 = 108, pk = (k === 'cone' || k === 'pyr'), tk = k === 'pyr' ? Math.max(0, Math.min(1, one.solid.k || 0)) : 0, xa = 150, xb = 290, xm = (xa + xb) / 2, hw = (xb - xa) / 2 * tk;
                const body = !top ? `<ellipse cx="${xm}" cy="${(y0 + y1) / 2}" rx="70" ry="${(y1 - y0) / 2}" fill="url(#spBeton)" stroke="#cbd5e1" stroke-width="1.4"/>` : pk ? `<path d="M${xa} ${y1}L${xm - hw} ${y0}${hw ? 'H' + (xm + hw) : ''}L${xb} ${y1}Z" fill="url(#spBeton)" stroke="#cbd5e1" stroke-width="1.4"/>` : `<rect x="${xa}" y="${y0}" width="${xb - xa}" height="${y1 - y0}" fill="url(#spBeton)" stroke="#cbd5e1" stroke-width="1.4"/>`;
                const lvl = (y, c) => `<path d="M${xa - 4} ${y}H96" stroke="${c}" stroke-dasharray="3 3"/><path d="M104 ${y - 9}l6 9 6-9Z" fill="${c}"/>`, face = (y, x0, x1, c) => `<path d="M${x0} ${y}H${x1}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`;
                return body + face(y1, xa, xb, '#60a5fa') + lvl(y1, '#60a5fa') + (top ? (pk && !hw ? `<circle cx="${xm}" cy="${y0}" r="4" fill="#f59e0b"/>` : face(y0, pk ? xm - hw : xa, pk ? xm + hw : xb, '#f59e0b')) + `<path d="M${pk && !hw ? xm - 6 : xa - 4} ${y0}H120" stroke="#f59e0b" stroke-dasharray="3 3"/><path d="M104 ${y0 - 9}l6 9 6-9Z" fill="#f59e0b"/>`
                    + `<path d="M306 ${y0}V${y1}M302 ${y0 + 6}l4-7 4 7M302 ${y1 - 6}l4 7 4-7" stroke="#e5e7eb" stroke-width="1.3" fill="none"/><text x="314" y="${(y0 + y1) / 2 + 4}" fill="#e5e7eb" font-size="12" font-weight="700" font-family="sans-serif">${isFinite(H) && H > 0 ? 'H ' + nfr(H, 2) : ''}</text>` : '')
                    + `<text x="${xm}" y="${y1 + 20}" fill="#60a5fa" font-size="10.5" text-anchor="middle" font-family="sans-serif">face du dessous = cote de base</text>`; } },
            plat: { slots: [['sp-zall', 40, 14, 80, 'niveau de la plateforme']], draw: (one) => { const t = (one && one.talus) || {}, kR = String(t.kR || '3/2'), kD = String(t.kD || '1/1');
                return `<path d="M20 110C80 96 120 72 180 70S300 66 340 50" stroke="#65a30d" stroke-width="1.5" fill="none" stroke-dasharray="5 4"/><text x="300" y="44" fill="#65a30d" font-size="10" font-family="sans-serif">TN</text>
                    <path d="M60 128L110 90H250L300 58" stroke="#e5e7eb" stroke-width="1.2" fill="none"/><rect x="110" y="86" width="140" height="8" fill="#9ca3af"/><path d="M60 128L110 90L110 94Z" fill="#7c2d12" opacity=".6"/>
                    <text x="62" y="112" fill="#fdba74" font-size="10" font-family="sans-serif">remblai ${MF.esc(kR)}</text><text x="262" y="88" fill="#fca5a5" font-size="10" font-family="sans-serif">déblai ${MF.esc(kD)}</text>
                    <path d="M180 60V84M176 78l4 6 4-6" stroke="#f59e0b" stroke-width="1.4" fill="none"/>`; } } };
        /* volume : dessous (la base, cote enregistrée) et dessus (base + hauteur) ; l'un se déduit de l'autre, le schéma montre la face de chaque cote */
        const SOL_H = (one) => one && one.solid && !['sphere', 'torus', 'rev', 'roof'].includes(one.solid.kind);
        function spTopRow(one, zb) { return SOL_H(one) ? MF.row(one.solid.kind === 'cone' || (one.solid.kind === 'pyr' && !(one.solid.k > 0)) ? 'Sommet' : 'Dessus', MF.num('sp-ztop', hasZ(zb) ? fmtZ(zb + (one.solid.H || 0)) : ''), 'm') : ''; }
        function spZSum(one, zb) { return hasZ(zb) ? nfr(zb / 1000, 2) + (SOL_H(one) ? ' → ' + nfr((zb + (one.solid.H || 0)) / 1000, 2) : '') + ' m' : 'sans Z'; }
        function spSolH(one) { const e = document.getElementById('sp-h'), v = e ? parseFloat(String(e.value).replace(',', '.')) : NaN; return v > 0 ? v * lenF() : (one && one.solid ? one.solid.H || 0 : 0); }
        document.addEventListener('input', (e) => { const id = e.target && e.target.id; if (!['sp-ztop', 'sp-zall', 'sp-z', 'sp-h'].includes(id) || !e.target.closest('#selparam-modal')) return;
            const one = selectedShapes.length === 1 ? selectedShapes[0] : null; if (!SOL_H(one)) return; const T = document.getElementById('sp-ztop'), B = document.getElementById(one.type === 'circle' ? 'sp-z' : 'sp-zall'); if (!T || !B) return;
            const H = spSolH(one), nb = spNum(B.id), nt = spNum('sp-ztop');
            if (id === 'sp-ztop') { if (isFinite(nt)) B.value = fmtZ(Math.round(nt * 1000 - H)); } else T.value = isFinite(nb) ? fmtZ(Math.round(nb * 1000 + H)) : ''; spFigRedraw(); }, true);
        /* fenêtre Y d'une paroi complexe : sa composition se modifie, la paroi est refaite sur le même tracé (hauteur, étage et ouvertures gardés) */
        function spCxHTML(D) { const MAT = Object.keys(WALL_MATS).filter(m => !['sable', 'gnt', 'pierre', 'terre'].includes(m)), sel = (on, opts, v, st) => `<select class="mf-in mf-sel" style="${st || ''}" onchange="${on}">${opts.map(([a, b]) => `<option value="${a}" ${String(a) === String(v) ? 'selected' : ''}>${MF.esc(b)}</option>`).join('')}</select>`;
            const num = (on, v, w) => `<input type="text" inputmode="decimal" class="mf-in" style="width:${w || 58}px" value="${v}" onchange="${on}">`;
            let h = MF.row('Remplacer par', sel("spCxSet('preset',0,this.value)", [['', '—']].concat(wallCxAll().map((d, i) => [i, d.name + ' (' + d.layers.reduce((a, l) => a + (+l[1] || 0), 0) + ' mm)'])), ''), '');
            h += MF.row('Alignement sur le tracé', sel("spCxSet('align',0,this.value)", [['gauche', 'face gauche'], ['axe', 'axe'], ['droite', 'face droite']], D.align || 'gauche'), '');
            { const T = D.layers.reduce((a, l) => a + (+l[1] || 0), 0), W = 340, k = (W - 20) / Math.max(T, 1); let x = 10, g = ''; D.layers.forEach(l => { const O = CX_OSS[l[0]], M = WALL_MATS[cxBandMat(l)] || {}, w = Math.max(3, l[1] * k);
                g += `<rect x="${x.toFixed(1)}" y="6" width="${w.toFixed(1)}" height="40" fill="${M.line || '#9ca3af'}" fill-opacity="${M.fill ? '.35' : '0'}" stroke="${(O || M).line || '#9ca3af'}" stroke-width="1.2"/>`;
                if (O) for (let yy = 10; yy < 46; yy += 12) g += `<rect x="${(x + 1).toFixed(1)}" y="${yy}" width="${Math.max(2, w - 2).toFixed(1)}" height="4" fill="${O.line}"/>`; x += w; });
              h += `<svg viewBox="0 0 ${W} 52" width="100%" style="display:block;margin:4px 0 8px">${g}</svg>`; }
            h += MF.sub('Couches, de la face gauche du tracé à la face droite');
            const OPT = MAT.map(m => [m, WALL_MATS[m].name]).concat(Object.keys(CX_OSS).map(m => [m, CX_OSS[m].name]));
            D.layers.forEach((l, i) => { const O = CX_OSS[l[0]], o = l[2] || {};
                h += `<div class="mf-row"><span class="mf-l" style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:18px;border-radius:3px;background:${(O || WALL_MATS[l[0]] || {}).line || '#9ca3af'}"></span>${sel(`spCxSet('mat',${i},this.value)`, OPT, l[0], 'width:200px;max-width:none')}</span><span class="mf-c">${num(`spCxSet('e',${i},this.value)`, l[1])}<span class="mf-u">mm</span><button type="button" class="sp-act" title="Monter" onclick="spCxSet('up',${i})" ${i ? '' : 'disabled'}>↑</button><button type="button" class="sp-act" title="Retirer la couche" onclick="spCxSet('del',${i})" ${D.layers.length < 2 ? 'disabled' : ''}>✕</button></span></div>`;
                if (O) h += `<div style="margin:-2px 0 6px 22px;padding:6px 8px;border-left:2px solid ${O.line};display:grid;gap:4px">` + MF.row('Montants de', num(`spCxSet('ow',${i},this.value)`, o.w || O.w), 'mm') + MF.row('Entraxe (un tous les…)', num(`spCxSet('osp',${i},this.value)`, o.sp || 600), 'mm')
                    + MF.row('Entre les montants', sel(`spCxSet('ofill',${i},this.value)`, [['air', 'vide'], ['isolant', WALL_MATS.isolant.name], ['pse', WALL_MATS.pse.name]], o.fill || 'air', 'width:170px;max-width:none'), '') + '</div>'; });
            h += MF.acts([['＋ Couche', "spCxSet('add')", 'Ajoute une couche sur la face droite']]);
            return h + MF.hint('L\'ossature est une couche : choisissez « Ossature métal » ou « Ossature bois » comme matériau. Chaque changement refait la paroi sur le même tracé : hauteur, étage, portes et fenêtres sont gardés.'); }
        function spCxSet(k, i, v) { const one = selectedShapes.find(x => x.wallCx); if (!one) return; const gid = one.groupId, R = wallCxRecover(gid); if (!R) return; const D = R.def, num = (x) => Math.max(0, parseFloat(String(x).replace(',', '.')) || 0);
            if (k === 'preset') { const d = wallCxAll()[+v]; if (!d || v === '') return; const N0 = cxNorm(d); D.name = N0.name; D.layers = N0.layers; }
            else if (k === 'align') D.align = v; else if (k === 'mat') D.layers[i] = cxLayerMat(D.layers[i], v); else if (k === 'ow' || k === 'osp' || k === 'ofill') cxLayerOss(D.layers[i], k, v);
            else if (k === 'e') D.layers[i][1] = Math.max(1, num(v)); else if (k === 'add') D.layers.push(['placo', 13]);
            else if (k === 'del' && D.layers.length > 1) D.layers.splice(i, 1);
            else if (k === 'up' && i > 0) { const t = D.layers[i - 1]; D.layers[i - 1] = D.layers[i]; D.layers[i] = t; }
            if (k !== 'preset' && k !== 'align') D.name = /\(modifié\)$/.test(D.name) ? D.name : D.name + ' (modifié)';
            const N = wallCxRebuild(gid, D); if (!N) return; clearTimeout(spLiveT); selectedShapes = N; invalidateCache(); saveState(); draw(); refresh3D(); spLiveCommit(); openSelectionParamModal(); }
        function spFigMount() {
            const one = selectedShapes.length === 1 ? selectedShapes[0] : null;
            document.querySelectorAll('#selparam-modal details.sp-ch').forEach(d => { const k = d.dataset.k, F = SP_FIG[k]; if (!F || d.querySelector('.sp-dia')) return; const slots = F.slots.filter(([id]) => { const e = document.getElementById(id); return e && d.contains(e) && e.offsetParent !== null || (e && d.contains(e) && !e.closest('.hidden')); }); if (!slots.length) return;
                const body = d.querySelector('.sp-chb'); if (!body) return; const dia = document.createElement('div'); dia.className = 'tal-dia sp-dia'; dia.innerHTML = `<svg viewBox="0 0 360 160" width="100%" preserveAspectRatio="xMidYMid meet"><defs><pattern id="spBeton" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#374151"/><circle cx="2" cy="2" r=".8" fill="#9ca3af"/><circle cx="6" cy="5" r=".6" fill="#9ca3af"/></pattern></defs><g class="sp-dia-g"></g></svg>`;
                body.insertBefore(dia, body.firstChild); dia._F = F; dia._one = one;
                slots.forEach(([id, x, y, w, lab, col]) => { const e = document.getElementById(id), row = e.closest('.mf-row'); e.classList.add('tal-in'); e.style.cssText += `;left:${x}%;top:${y}%;width:${w}px;position:absolute` + (col ? `;border-color:${col}` : ''); const l = document.createElement('span'); l.className = 'tal-lb'; l.textContent = lab; if (col) l.style.color = col; l.style.left = x + '%'; l.style.top = 'calc(' + y + '% - 16px)'; dia.appendChild(l); dia.appendChild(e); if (row && row !== dia && !row.contains(dia)) row.style.display = 'none'; });
                d.addEventListener('input', () => spFigRedraw()); }); spFigRedraw(); spThumb(); }
        function spFigRedraw() { document.querySelectorAll('#selparam-modal .sp-dia').forEach(dia => { const g = dia.querySelector('.sp-dia-g'); if (g && dia._F) g.innerHTML = dia._F.draw(dia._one); }); spThumb(); }
        // vignette de la sélection, vue de dessus, aux couleurs des calques
        function spThumb() { const sc = document.querySelector('#selparam-modal .overflow-y-auto'); if (!sc) return; let el = document.getElementById('sp-thumb'); if (!el) { el = document.createElement('div'); el.id = 'sp-thumb'; sc.insertBefore(el, sc.firstChild); }
            const S = selectedShapes.slice(0, 400), bb = getShapesBoundingBox(S); if (!bb || !(bb.maxX - bb.minX + bb.maxY - bb.minY > 0)) { el.innerHTML = ''; return; } const W = 360, H = 86, w = bb.maxX - bb.minX || 1, h = bb.maxY - bb.minY || 1, k = Math.min((W - 30) / w, (H - 20) / h), ox = (W - w * k) / 2, oy = (H - h * k) / 2, X = (x) => ox + (x - bb.minX) * k, Y = (y) => oy + (y - bb.minY) * k;
            const col = (s) => (layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).color || '#e5e7eb'; let p = '';
            S.forEach(s => { const c = /^#f{3}(f{3})?$/i.test(col(s)) ? '#e5e7eb' : col(s);
                if (s.points && s.points.length) { const cl = s.type === 'hatch' || (s.type === 'poly' && !s.open && s.points.length >= 3); p += `<path d="M${s.points.map(q => X(q.x).toFixed(1) + ' ' + Y(q.y).toFixed(1)).join('L')}${cl ? 'Z' : ''}" fill="${cl && (s.bld || s.batEx || s.solid || isPlateforme(s)) ? c + '33' : 'none'}" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/>`; }
                else if (Array.isArray(s.loops)) s.loops.forEach(L => { const Q = Array.isArray(L) ? L : (L && L.points) || []; if (Q.length) p += `<path d="M${Q.map(q => X(q.x).toFixed(1) + ' ' + Y(q.y).toFixed(1)).join('L')}Z" fill="${s.wallMat ? '#64748b' : c + '33'}" stroke="${c}" stroke-width="1.2"/>`; });
                else if (s.type === 'line') p += `<path d="M${X(s.x1)} ${Y(s.y1)}L${X(s.x2)} ${Y(s.y2)}" stroke="${c}" stroke-width="${s.wallMat ? 4 : 1.4}"/>`;
                else if (s.type === 'circle') p += `<circle cx="${X(s.x)}" cy="${Y(s.y)}" r="${Math.max(1, s.r * k)}" fill="none" stroke="${c}" stroke-width="1.4"/>`;
                else if (s.type === 'point') p += `<path d="M${X(s.x) - 4} ${Y(s.y) - 4}l8 8m0-8l-8 8" stroke="${c}" stroke-width="1.6"/>`; });
            const mw = worldToMm(w) / 1000, mh = worldToMm(h) / 1000;
            el.innerHTML = `<div style="position:relative;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:8px"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet">${p}</svg>${mw + mh > 0.001 ? `<span style="position:absolute;right:8px;bottom:4px;font:11px sans-serif;color:#94a3b8">${nfr(mw, 2)} × ${nfr(mh, 2)} m</span>` : ''}<span style="position:absolute;left:8px;top:4px;font:11px sans-serif;color:#94a3b8">vue de dessus</span></div>`; }
        function openSelectionParamModal() {
            if (selectedShapes.length === 0) return;
            /* l'eau d'un bassin paysagé suit son bassin : Y ouvre le bassin (profondeur, niveau d'eau) */
            if (selectedShapes.length === 1 && selectedShapes[0].payOf) { const B = shapes.find(x => x.pay && x.pay.id === selectedShapes[0].payOf); if (B) { selectedShapes = [B]; draw(); } }
            { const m0 = document.getElementById('selparam-modal'), sig0 = selectedShapes.map(x => shapes.indexOf(x)).join(','); if (m0.classList.contains('hidden') || !spLive || spLive.sig !== sig0) { if (spLive && !m0.classList.contains('hidden')) spLiveCommit(); spLive = { h0: historyStep, sig: sig0 }; } }
            // une toiture sélectionnée (tout son bloc) : directement sa fenêtre complète, avec la coupe cotée
            { const g = selectedShapes[0].groupId; if (g && selectedShapes.every(x => x.groupId === g) && shapes.some(x => x.groupId === g && x.roofDef)) { roofEdit(g); return; } }
            document.getElementById('selparam-count').textContent = selectedShapes.length;
            const sel = document.getElementById('selparam-layer');
            sel.innerHTML = '';
            const lids = [...new Set(selectedShapes.map(x => x.layerId || 'layer-0'))];
            if (lids.length > 1) { const o = document.createElement('option'); o.value = ''; o.textContent = 'Calques différents (' + lids.length + ') — inchangés'; sel.appendChild(o); }   // sélection mêlée : chacun garde son calque
            layers.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; sel.appendChild(o); });
            sel.value = lids.length > 1 ? '' : lids[0]; sel.dataset.orig = sel.value;
            const lay = layers.find(l => l.id === sel.value);
            const K = selKind(); document.getElementById('selparam-kind').textContent = K.k === 'section' ? 'dessin dynamique, cotes réglables' : K.t; if (K.k === 'section') window.spTab = 'cut3d';
            { const o1 = selectedShapes.length === 1 ? selectedShapes[0] : null, tt = document.getElementById('selparam-title');   // titre : le nom de l'objet (et son niveau pour une plateforme)
                if (tt) tt.textContent = o1 && (o1.name || isPlateforme(o1)) ? (isPlateforme(o1) ? platName(o1) : o1.name) + (isPlateforme(o1) ? ' — ' + (platSurf(o1).flat ? 'à ' + nfr(platZ(o1) / 1000, 2) + ' m' : 'inclinée') : '') : K.k === 'section' ? K.t : selectedShapes.length > 1 ? selectedShapes.length + ' objets' : K.t; }
            document.getElementById('selparam-laysum').textContent = lay ? lay.name : (lids.length > 1 ? 'calques différents' : '');
            const zb = document.getElementById('selparam-z'), one = selectedShapes.length === 1 ? selectedShapes[0] : null; structEdit = null; sweepEdit = null; trEdit = null;
            if (one && one.type === 'poly' && !one.open && !one.curve && one.points.length > 3) {   // sommet en double (ancien double-clic de fin) : retiré
                const e = mmToWorld(5), out = []; one.points.forEach(q => { const l = out[out.length - 1]; if (!l || Math.hypot(q.x - l.x, q.y - l.y) > e) out.push(q); });
                while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= e) out.pop();
                if (out.length !== one.points.length && out.length >= 3) { one.points = out; invalidateCache(); saveState(); draw(); }
            }
            const zv = (z) => hasZ(z) ? fmtZ(z) : '';
            const zrow = (id, label, val, ph) => MF.row(label, MF.num(id, val, ph), 'm');
            const nameRow = (o) => MF.row('Nom', MF.txt('sp-pfname', o.pfName || '', isPlateforme(o) ? platName(o) : 'ex. Parking'), '');
            let h = '';
            const allPts = selectedShapes.every(x => x.type === 'point');
            if (K.k === 'wall') {   // mur posé : niveaux bas / haut -> mur 3D
                const w0 = selectedShapes.find(x => x.wz) || {}, wz = w0.wz || {};
                const hInfo = hasZ(wz.b) && hasZ(wz.t) ? lenTxt(wz.t - wz.b) : '';
                h += spChapter('wall3d', '▦', 'Mur en 3D', zrow('sp-wzb', 'Niveau bas (N down)', zv(wz.b), 'ex. 0,00') + zrow('sp-wzt', 'Niveau haut (N top)', zv(wz.t), 'ex. 2,50')
                    + MF.row('ou hauteur', MF.num('sp-wzhh', hInfo, '—', 'oninput="spWallH()"'), LUN())
                    + MF.hint('Les deux niveaux remplis : le mur est extrudé dans la vue 3D. Champs vidés : mur 2D seulement.'), true, hasZ(wz.t) ? zv(wz.b) + ' → ' + zv(wz.t) + ' m' : '2D');
                { const L = []; selectedShapes.forEach(x => (x.openings || []).forEach((o, j) => L.push([(o.kind === 'porte' ? '🚪 Porte ' : o.kind === 'garage' ? '🚘 Porte de garage ' : o.kind === 'baie' ? '⛩ Baie libre ' : '🪟 Fenêtre ') + nfr(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) * mOf(1), 2) + ' × ' + nfr((o.h || 0) / 1000, 2) + ' m', 'spOpenEdit(' + shapes.indexOf(x) + ',' + j + ')', 'Modifier, décaler ou supprimer cette ouverture'])));
                  if (L.length) h += spChapter('wallops', '▯', 'Portes et fenêtres', MF.acts(L) + MF.hint('Un clic sur une ouverture, dans le plan, l\'ouvre aussi. Elles suivent le mur quand on le déplace, le tourne ou le copie.'), true, L.length + ''); }
                { const gids = new Set(selectedShapes.map(x => x.groupId)), R = gids.size === 1 && selectedShapes.every(x => x.wallCx) ? wallCxRecover([...gids][0]) : null; if (R) h += spChapter('wallcx', '▤', 'Complexe', spCxHTML(R.def), true, R.def.layers.reduce((a, l) => a + (+l[1] || 0), 0) + ' mm'); }
                h += spChapter('wallact', '⚙', 'Actions', MF.acts([['Éclater le mur', 'closeSelectionParamModal();explodeOrUngroup()', 'Défait le bloc : tronçons et hachures redeviennent indépendants (pour recouper les angles)'], ['Vue 3D', 'closeSelectionParamModal();open3D()']]), false);
            } else if (one && ['dim', 'dimr', 'dim-angle'].includes(one.type)) {   // cotes : texte personnalisé
                const v = one.type === 'dim' ? (() => { const g = dimGeom(one); return g ? calculateRealDistance(g.dist) : ''; })() : one.type === 'dimr' ? (() => { const g = t2DimRGeom(one); return g ? t2DimRText(one, g.r) : ''; })() : '';
                h += spChapter('dimtxt', 'T', 'Texte de la cote', MF.row('Texte', MF.txt('sp-dimtxt', one.txt || '', v ? v + ' (automatique)' : 'automatique'), '')
                    + MF.hint('Vide = la valeur mesurée. <b>&lt;&gt;</b> la remplace dans ton texte : « &lt;&gt; (à vérifier) », « L = &lt;&gt; », « ≈ &lt;&gt; ». Sans &lt;&gt;, ton texte remplace la valeur.'), true, one.txt ? '« ' + MF.esc(one.txt) + ' »' : 'automatique');
            } else if (one && one.water) {   // niveau d'eau naturel
                const m = waterMask(one);
                h += spChapter('water', '≈', 'Niveau d\'eau naturel', MF.row('Nom', MF.txt('sp-wname', one.water.name || '', 'ex. Étang'), '') + zrow('sp-wz', 'Altitude de l\'eau', fmtZ(one.water.z), 'ex. 98,50')
                    + MF.hint('Zone en eau : <b class="text-white">' + nfr(m.wetA, 1) + ' m²</b> sur ' + nfr(m.A, 1) + ' m² de contour' + (getTIN() ? ' (là où le terrain est sous le niveau).' : ' (sans terrain, tout le contour).') + ' En 3D, un plan d\'eau bleu à cette cote.'), true, '≈ ' + fmtZ(one.water.z) + ' m');
            } else if (one && one.trench) {   // tranchée : profil type, sommets FE / T, quantités
                trEdit = trClone(one.trench); trEditFrom = 'shape'; trSync(one);
                h += spChapter('trench', '⊔', 'Tranchée', `<div id="tr-box" data-ctx="shape">${trEditorHTML('shape')}</div>`, true, trM(one.trench.W) + ' × ' + trM(one.trench.H) + ' ' + LUN());
                h += spChapter('trnodes', '⌖', 'Sommets : FE et T', trNodesHTML(one), false, one.points.length + ' sommets');
                h += spChapter('trqty', 'Σ', 'Quantités', trQtyHTML(one), false);
            } else if (one && one.type === 'point') {
                h += spChapter('alt', '⌖', 'Altitude et matricule', MF.row('Matricule', MF.txt('sp-mat', one.mat || '', ''), '') + zrow('sp-z', 'Altitude Z', zv(one.z)), true, zv(one.z) ? 'Z ' + zv(one.z) : '');
                h += spChapter('ptstyle', '◎', 'Apparence (réglée par calque)', MF.acts([['Symbole et étiquettes du calque…', "openPtStyle(document.getElementById('selparam-layer').value, this)"]]), false);
            } else if (allPts) {
                h += spChapter('alt', '⌖', 'Altitude', zrow('sp-z', 'Altitude Z (tous)', '', 'inchangée'), true);
            } else if (one && one.type === 'line' && one.wall) {
                wallEdit = JSON.parse(JSON.stringify(one.wall));
                h += spChapter('oldwall', '▦', 'Couches de la paroi', `<div id="wall-edit" class="flex flex-col gap-1.5">${wallEditorHTML()}</div>`, true);
            } else if (one && one.sweep) {   // balayage 3D : profil, position, altitude ; Z du tracé à part
                sweepEdit = JSON.parse(JSON.stringify(one.sweep));
                h += spChapter('sweep', '⟿', 'Balayage 3D', '<div id="sw-box" class="flex flex-col gap-1.5">' + sweepRows() + '</div>', true, sweepSum(one));
                if (one.type === 'line') h += spChapter('alt', '↕', one.sweep.perp ? 'Altitudes de l\'axe' : 'Altitudes du tracé', zrow('sp-z1', 'Z départ', zv(one.z1)) + zrow('sp-z2', 'Z arrivée', zv(one.z2)), !!one.sweep.perp, hasZ(one.z1) || hasZ(one.z2) ? zv(one.z1) + ' → ' + zv(one.z2) : '');
                else if (one.type === 'poly') { const zs = one.points.map(q => q.z); h += spChapter('alt', '↕', 'Altitudes du tracé', zrow('sp-zall', 'Z de tous les sommets', zs.every(z => hasZ(z) && z === zs[0]) ? fmtZ(zs[0]) : '', 'inchangé') + MF.hint('Pour un tracé en pente, donnez un Z à chaque sommet (polyligne 3D) ou prenez l\'altitude « sur le terrain ».') + (isPlateforme(one) ? '' : MF.acts([['En faire une ligne de rupture', 'closeSelectionParamModal();brkFromSel()', 'Z de chaque sommet repris des points cotés posés sur la ligne, interpolé entre eux ; un sommet par mètre']])), false); }
                else h += spChapter('alt', '↕', 'Altitude du tracé', zrow('sp-z', 'Altitude Z', zv(one.z)), false);
                h += spChapter('act', '⚙', 'Actions', MF.acts([['Retirer le balayage', "sweepRemove()", 'Le tracé redevient un simple trait'], ['Vue 3D', 'closeSelectionParamModal();open3D()']]), false);
            } else if (one && one.type === 'line') {
                h += spChapter('alt', '↕', 'Altitudes (ligne 3D)', zrow('sp-z1', 'Z départ', zv(one.z1)) + zrow('sp-z2', 'Z arrivée', zv(one.z2)), true, hasZ(one.z1) || hasZ(one.z2) ? zv(one.z1) + ' → ' + zv(one.z2) : '');
            } else if (one && one.type === 'arc') {
                h += spChapter('alt', '↕', 'Altitude', zrow('sp-z', 'Altitude Z', zv(one.z)), true);
            } else if (one && one.type === 'circle') {
                if (one.solid) { h += spChapter('solz', '↕', 'Altitudes du volume', zrow('sp-z', 'Dessous (base)', zv(one.z)) + spTopRow(one, one.z), true, spZSum(one, one.z)); h += spChapter('solid', '◆', 'Volume 3D', solidRows(one), true); }
                else { h += spChapter('plat', '▭', 'Plateforme ronde', nameRow(one) + zrow('sp-z', 'Altitude Z', zv(one.z)) + MF.hint('Un Z sur un cercle en fait une plateforme ronde à cette cote.'), true, zv(one.z) ? 'à ' + zv(one.z) + ' m' : 'sans Z');
                    h += spChapter('talus', '◢', 'Talus', talusRows(one), isPlateforme(one), isPlateforme(one) ? talusSum(one) : '');
                    structEdit = JSON.parse(JSON.stringify(structOf(one) || { layers: [], ff: true })); h += spChapter('struct', '▤', 'Structure', '<div id="st-box" class="flex flex-col gap-1.5">' + structRows() + '</div>', false, structSum(one));
                    h += spChapter('act', '⚙', 'Actions', MF.acts([['Extruder en volume', 'closeSelectionParamModal();startExtrude()']].concat(isPlateforme(one) ? [['Cubature…', 'closeSelectionParamModal();openCubatureDialog()']] : [])), false); }
            } else if (one && one.type === 'poly') {
                const zs = one.points.map(q => q.z), flatRow = zrow('sp-zall', 'Z de tous les sommets', zs.every(z => hasZ(z) && z === zs[0]) ? fmtZ(zs[0]) : '', 'inchangé');
                                if (one.batEx) { h += spChapter('bat', '🏠', 'Bâtiment existant', MF.row('Haut du bâtiment (Z)', MF.num('sp-battop', fmtZ(one.points[0].z + (one.solid ? one.solid.H : 0))), 'm') + zrow('sp-zall', 'Pied (terrain)', zv(one.points[0].z)) + MF.hint('Les cotes relevées dedans (toit, faîtage, égout…) ne font pas le terrain : il passe dessous à partir des points autour. En 3D, un bloc du pied jusqu\'au haut (par défaut la cote la plus haute relevée dedans).'), true, 'haut ' + fmtZ(one.points[0].z + (one.solid ? one.solid.H : 0)) + ' m');
                    h += spChapter('act', '⚙', 'Actions', MF.acts([['Recaler sur le terrain et les cotes', 'batRefresh()', 'Après un changement des points topo : pied et haut recalculés'], ['Ce n\'est pas un bâtiment', 'batUnset()', 'Ses cotes refont le terrain'], ['Vue 3D', 'closeSelectionParamModal();open3D()']]), false); }
                else if (one.solid) { h += spChapter('solz', '↕', 'Altitudes du volume', zrow('sp-zall', 'Dessous (base)', zv(one.points[0].z)) + spTopRow(one, one.points[0].z), true, spZSum(one, one.points[0].z)); h += spChapter('solid', '◆', 'Volume 3D', solidRows(one), true); }
                else if (one.rdAx) { const R = one.rdAx; h += spChapter('road', '🛣', 'Route — profils en travers', rdYHTML(one), true, rdGeo(one).pr.length + ' profils'); }
                else if (one.ctop) { ctEdit = one; h += spChapter('ctop', one.ctop.k === 'bar' ? '🍸' : '🍳', one.ctop.k === 'bar' ? 'Bar' : 'Plan de travail', ctFormHTML(one.ctop) + MF.hint(ctMsg(one)), true, nfr(one.ctop.w / 10, 0) + ' × ' + nfr(one.ctop.h / 10, 0) + ' cm'); }
                else if ((one.open || one.points.length < 3) && !one.stair2) h += spChapter('alt', '↕', 'Altitudes', flatRow, true);
                else if (one.bld) {   // contour de bâtiment : ses étages
                    h += spChapter('bldlv', '🏢', 'Étages — ' + MF.esc(one.bld.nm || 'Bâtiment'), bldPanelHTML(one.bld.id), true, 'RDC ' + nfr((one.bld.lvls.find(x => x.id === 'rdc') || { z: 0 }).z / 1000, 2) + ' m');
                    h += spChapter('act', '⚙', 'Actions', MF.acts([['Ne plus en faire un bâtiment', "bldUnmake('" + one.bld.id + "')", 'Le contour redevient une polyligne ; les objets gardent leurs altitudes']]), false);
                }
                else if (one.stair2) { st2Edit = one; const G = st2Geo(one); h += spChapter('stair2', '🪜', 'Escalier', st2FormHTML(one.stair2, G) + (G ? MF.hint(G.n + ' marches de ' + nfr(G.h / 10, 1) + ' cm, de ' + nfr(G.z0 / 1000, 2) + ' à ' + nfr(G.z1 / 1000, 2) + ' m ; ' + G.nl + ' palier(s) ; foulée ' + nfr(G.need, 2) + ' m pour ' + nfr(G.have, 2) + ' m tracés' + (G.short > 0.005 ? ' : il manque ' + nfr(G.short, 2) + ' m.' : '.')) : ''), true, G ? G.n + ' × ' + nfr(G.h / 10, 1) + ' cm' : ''); }
                else if (one.stair && one.stair.b) { const S = one.stair, B = blondel(S.h, S.g); h += spChapter('stair', '🪜', 'Escalier', MF.row('Marches', '<b>' + S.n + '</b> × ' + nfr(S.h / 10, 1) + ' cm', '') + MF.row('Giron / nez', nfr(S.g / 10, 1) + ' / ' + nfr((S.nez || 0) / 10, 1), 'cm') + MF.row('Blondel', nfr(B.b / 10, 1) + (B.ok ? ' ✓' : ' ⚠'), 'cm') + `<div class="mf-row"><button type="button" class="mf-btn" onclick="stairPanel(selectedShapes.find(x=>x.stair))">Hauteur, giron, nez…</button></div>`, true); }
                else if (one.maille) { const M = one.maille, T = mailTops(M); h += spChapter('maille', '🧱', 'Maille — ' + mailEsc(M.set), M.cs.map((c, i) => MF.row(mailEsc(mailNm(M.k, c)), i < T.length - 1 ? nfr(T[i][0] / 1000, 2) + ' → ' + nfr(T[i][1] / 1000, 2) : 'dès ' + nfr(T[i][0] / 1000, 2), 'm')).join('') + `<div class="mf-row"><button type="button" class="mf-btn" onclick="mailPanel(selectedShapes.find(x=>x.maille))">Couches (réglage graphique)…</button></div>`, true); }
                else if (one.bassin) { const C = bassinCalc(one); const B = one.bassin; h += spChapter('bassin', '🛢', 'Bassin de rétention', (B.t === 'buse' ? MF.row('Diamètre des buses', MF.num('sp-bsD', nfr(B.D, 0)), 'mm') : MF.row(B.t === 'beton' ? 'Hauteur d\'eau utile' : 'Hauteur du stockage', MF.num('sp-bsH', nfr(B.H / 1000, 2)), 'm')) + MF.row('Couverture (remblai au-dessus)', MF.num('sp-bscov', nfr(B.cover / 1000, 2)), 'm') + (C ? MF.row('Volume utile', '<b>' + nfr(C.Vut, 1) + '</b>', 'm³') + MF.row('Déblai / remblai', nfr(C.Vf, 1) + ' / ' + nfr(C.Vrem, 1), 'm³') : '') + `<div class="mf-row"><button type="button" class="mf-btn" onclick="bassinPanel(selectedShapes.find(x=>x.bassin))">Type, dimensions et fouille…</button></div>`, true); }
                else if (one.bois) { h += spChapter('bois', '🌳', 'Végétation', MF.row('Sorte', MF.seg('sp-boiskind', Object.keys(VEG_K).map(k => [k, VEG_K[k][0]]), one.bois.kind || 'arbre', 'boisSetKind(this.value)'), '') + MF.row('Hauteur', MF.num('sp-boish', nfr(one.bois.h || 12, 1), '12', 'onchange="boisSetH(this.value)"'), 'm') + MF.row('Couleur en 3D', MF.seg('sp-boistex', [['photo', '📷 Photo du fond'], ['vert', '🌳 Verts']], one.bois.tex === 'vert' ? 'vert' : 'photo', 'boisSetTex(this.value)'), '') + MF.hint('En plan, des houppiers dans la zone ; en 3D, une canopée d\'arbres posée sur le sol fini, de la couleur vue sur la photo du fond (ou en verts). Modifiez le contour comme une polyligne (poignées) : le bois suit.'), true, nfr(one.bois.h || 12, 1) + ' m');
                    h += spChapter('act', '⚙', 'Actions', MF.acts([['Ce n\'est plus une zone boisée', 'boisUnset()', 'Le contour redevient une simple polyligne'], ['Vue 3D', 'closeSelectionParamModal();open3D()']]), false); }
                else {   // polyligne fermée : plateforme horizontale ou inclinée (rampe), et ses talus
                    const incl = !!one.plat && !zs.every(z => hasZ(z) && Math.abs(z - zs[0]) < 1);
                    const vopt = one.points.map((q, i) => [i, 'sommet ' + (i + 1)]);
                    const plat = nameRow(one) + MF.seg('sp-pmode', [['flat', 'Horizontale'], ['incl', 'Inclinée / rampe']], incl ? 'incl' : 'flat', 'spPlatMode()')
                        + `<div id="sp-flatbox" class="${incl ? 'hidden' : ''}">${flatRow}</div>
                        <div id="sp-inclbox" class="${incl ? '' : 'hidden'} flex flex-col gap-1.5">
                            ${MF.sub('Z de chaque sommet (numéros affichés sur le plan)')}
                            <div class="mf-vz">${one.points.map((q, i) => `<label><span>${i + 1}</span><input id="sp-vz-${i}" type="text" inputmode="decimal" value="${zv(q.z)}" class="mf-in" oninput="spPlanInfo()"><span class="mf-u">m</span></label>`).join('')}</div>
                            ${MF.sub('Ou remplir par une pente')}
                            ${MF.row('Cote de départ', MF.num('sp-z0', zv(one.points[0].z)), 'm')}
                            ${MF.row('au', MF.sel('sp-v0', vopt, 0), '')}
                            ${MF.row('Pente', MF.num('sp-pct', '2'), '%')}
                            ${MF.row('Direction de la descente <button type="button" class="mf-link" onclick="spPickDir()" title="Cliquez un point haut puis un point bas sur le plan">2 clics</button>', MF.num('sp-ang', '0', '', 'title="0° = vers X+ (est), 90° = vers Y+ (nord)"'), '°')}
                            <div class="mf-row"><button type="button" class="mf-btn" onclick="spFillSlope()">Remplir les Z</button><span id="sp-planinfo" class="mf-hint" style="text-align:right;"></span></div>
                        </div>`;
                    const isP = isPlateforme(one);
                    h += spChapter('plat', '▭', 'Plateforme', plat, true, isP ? (incl ? 'inclinée' : 'à ' + fmtZ(zs[0]) + ' m') : 'sans Z');
                    h += spChapter('talus', '◢', 'Talus', talusRows(one), isP, isP ? talusSum(one) : '');
                    structEdit = JSON.parse(JSON.stringify(structOf(one) || { layers: [], ff: true })); h += spChapter('struct', '▤', 'Structure', '<div id="st-box" class="flex flex-col gap-1.5">' + structRows() + '</div>', false, structSum(one));
                    h += spChapter('act', '⚙', 'Actions', MF.acts([['Extruder en volume', 'closeSelectionParamModal();startExtrude()'], ['🌳 En faire une zone boisée', 'boisMake()', 'Hachure d\'arbres en plan, canopée d\'arbres en 3D']].concat(isP ? [['Cubature…', 'closeSelectionParamModal();openCubatureDialog()']] : [], one.points.length > 2 ? [['🏢 Contour de bâtiment (étages)…', 'closeSelectionParamModal();bldMakeAsk()', 'Ce contour porte les niveaux d\'un bâtiment : RDC et étages ; ce qu\'on dessine dedans prend ses niveaux'], ['🏠 C\'est un bâtiment existant', 'closeSelectionParamModal();batFromSel()', 'Ses cotes (toit, faîtage…) sortent du terrain ; bloc 3D posé sur le terrain']] : [], [['Éclater en droites', 'closeSelectionParamModal();explodeOrUngroup()']])), false);
                }
            } else if (K.k === 'block') {
                { const rp = selectedShapes.find(x => x.roofDef); if (rp) { const d = rp.roofDef.o;
                    h += spChapter('roofdef', '⌂', 'Toiture', MF.hint(d.pans === 0 ? 'Toit terrasse · dessus de dalle ' + nfr(d.he, 2) + ' m · dalle ' + nfr(d.te, 2) + ' m' + (d.tc ? ' · casquette ' + rfDebTxt(d, 'tc') : '') + (d.ah ? ' · acrotère ' + nfr(d.ah, 2) + ' m' : '') + (d.fp ? ' · forme de pente ' + nfr(d.fp, 1) + ' %' : '') : (d.pans === 4 ? 'Pans multiples' + (d.gab && d.gab.some(Boolean) ? ' (' + d.gab.filter(Boolean).length + ' pignon(s))' : ' (croupes)') : d.pans + ' pan(s)') + ' · égout ' + nfr(d.he, 2) + ' m · faîtage ' + nfr(d.hf, 2) + ' m · débord ' + rfDebTxt(d, 'db') + (d.fill ? ' · pignons comblés' : '')) + MF.acts([['Modifier la toiture…', 'closeSelectionParamModal();roofEdit(\'' + rp.groupId + '\')', 'Débords côté par côté, hauteurs, pentes, textures de la couverture et de la sous-face']]), true, Array.isArray(d.dbE) ? 'débords variables' : 'débord ' + nfr(d.db || 0, 2) + ' m'); } }
                h += spChapter('act', '⚙', 'Actions', MF.acts([['Éclater le bloc', 'closeSelectionParamModal();explodeOrUngroup()']]), true);
            }
            if (one && one.type === 'pdfvec') h += spChapter('pdfvec', '✂', 'Tracés du plan PDF', MF.hint((one.n || 0).toLocaleString('fr-FR') + ' trait(s) en un seul objet : léger à afficher, déplacer, annuler ; l\'accrochage marche sur ses sommets.') + MF.acts([['Décomposer en polylignes…', 'closeSelectionParamModal();vecExplodeUI()', 'Chaque trait devient une polyligne modifiable (lourd sur un gros plan)']]), true);
            { const nC = selectedShapes.reduce((a, x) => a + ((x.cuts || []).length), 0); if (nC) h += spChapter('cuts', '✂', 'Recoupes', MF.hint(nC + ' recoupe(s) : ce qui dépasse du trait de coupe est caché, en plan et en 3D.') + MF.acts([['Retirer les recoupes', 'rcpClear(' + (one && one.groupId ? "'" + one.groupId + "'" : 'null') + ')', 'L\'objet retrouve sa forme entière']]), true, nC + ''); }
            if (one && one.pay) h += spChapter('pay', '🌿', 'Bassin paysagé', MF.row('Cote du bord (terrain)', MF.num('sp-pyzg', nfr(one.pay.zg / 1000, 2)), 'm') + MF.row('Profondeur', MF.num('sp-pyprof', nfr(one.pay.prof / 1000, 2)), 'm') + MF.row('Hauteur d\'eau permanente', MF.num('sp-pyperm', nfr(one.pay.perm / 1000, 2)), 'm') + MF.row('soit la cote de l\'eau', MF.num('sp-pyzw', nfr((one.pay.zg - one.pay.prof + one.pay.perm) / 1000, 2), '', 'data-o="' + nfr((one.pay.zg - one.pay.prof + one.pay.perm) / 1000, 2) + '"'), 'm') + `<button type="button" class="mf-btn" onclick="closeSelectionParamModal();payPanel(shapes[${shapes.indexOf(one)}])">Berges, revanche et volumes…</button>`, true);
            if (one && one.type === 'bgimage') h += spChapter('pdftopo', '📍', 'Lire le plan PDF', MF.hint(one.pdfTopo ? (one.pdfTopo.t.length + ' cote(s) d\'altitude lue(s) dans le PDF' + (one.pdfTalus && one.pdfTalus.length ? ', ' + one.pdfTalus.length + ' ligne(s) de talus reconnue(s)' : '') + '.') : (one.pdfPage ? 'Le texte du PDF n\'a pas été gardé : il sera relu depuis le fichier.' : 'Pour un plan PDF : lit les cotes d\'altitude du document.')) + MF.acts([['Importer points, talus, tracés…', 'closeSelectionParamModal();pdfTopoDialog()', 'Points topo, lignes de rupture des talus et traits du plan, à leur place après calage']].concat(one.pdfGrid && pdfGridFit(one.pdfGrid, (detectCRS() || {}).code || bmSettings.crs) ? [['Caler sur le carroyage', 'closeSelectionParamModal();bgGridApplyUI()', 'Position, rotation et échelle d\'après les coordonnées écrites sur le plan']] : [], [['🧭 Caler sur 2 croix…', 'closeSelectionParamModal();gcalStart()', 'Cliquez 2 croix du quadrillage et tapez leurs coordonnées']])), true);
            if (K.k !== 'oldwall') wallEdit = (one && one.type === 'line' && one.wall) ? wallEdit : null;
            if (one && !one.wall && effectiveDash(one) === 'text' && ['line', 'poly', 'circle', 'arc'].includes(one.type))
                h += spChapter('ltt', '≈', 'Texte de la ligne', MF.row('Texte', MF.txt('sp-ltt', one.ltText || '', ltTextOf({ layerId: one.layerId }) + ' (calque)'), ''), false);
            { const CL = cutLineOf(selectedShapes); if (CL) h += spChapter('cut3d', '✂', 'Coupe ' + (CL.cutDef.name || '') + '-' + (CL.cutDef.name || ''), MF.hint('La 3D tronquée à ce trait de coupe, regardée dans son sens : ce qui est coupé montre sa tranche, derrière la maison reste en vraie perspective (fenêtres en biais, toitures continues).') + MF.acts([['Voir la coupe en perspective (3D)', 'closeSelectionParamModal();sec3D(cutLineOf(selectedShapes))', 'Ouvre la vue 3D tronquée au trait de coupe']]) + secOptHTML(CL), true); }
            zb.innerHTML = h; zb.classList.toggle('hidden', !h); if (document.getElementById('sp-planinfo')) setTimeout(spPlanInfo, 0); if (document.getElementById('bld-lv')) bldPanelDraw();
            zb.dataset.orig = JSON.stringify(['sp-mat', 'sp-z', 'sp-z1', 'sp-z2', 'sp-zall', 'sp-wzb', 'sp-wzt'].map(id => { const el = document.getElementById(id); return el ? el.value : null; }));
            document.getElementById('selparam-modal').classList.remove('hidden'); spTabify(); try { spFigMount(); } catch (e) { console.warn('schéma', e); } spSelSig = selectedShapes.map(x => shapes.indexOf(x)).join(',');
            const first = zb.querySelector('details[open] #sp-h') || zb.querySelector('details[open] #sp-wzb, details[open] #sp-z, details[open] #sp-z1, details[open] #sp-zall') || zb.querySelector('details[open] input[type=text]'); if (first) setTimeout(() => { first.focus(); first.select(); }, 30);
        }
        // ---- STRUCTURE d'une plateforme : couches (matériau, épaisseur) → quantités en place, foisonnées, tonnage ----
        // coef = foisonnement (volume à approvisionner / volume en place compacté) ; d = densité en place (t/m³) ; unit 'm2' = produit compté en surface
        // ---- Catalogue produits (⛯ Paramètres › Produits, enregistré sur le poste et dans le gabarit) ----
        // {code, name, d: densité en place t/m³, coef: foisonnement, prix, pu: 'm3' | 'm3f' | 't' | 'm2', surf: sans épaisseur (m²)}
        const MAT_PU = [['m3', '€/m³ en place'], ['m3f', '€/m³ foisonné'], ['t', '€/t'], ['m2', '€/m²'], ['ml', '€/ml (tube)']];
        // tubes et gaines des tranchées : prix au mètre linéaire, dn = diamètre extérieur (mm)
        const TUBE_DEFAULTS = [['PVC_CR8_160', 'Tube PVC CR8 Ø160', 160], ['PVC_CR8_200', 'Tube PVC CR8 Ø200', 200], ['PVC_CR8_250', 'Tube PVC CR8 Ø250', 250], ['PVC_CR8_315', 'Tube PVC CR8 Ø315', 315], ['PVC_CR8_400', 'Tube PVC CR8 Ø400', 400],
            ['PEHD_EAU_63', 'Tube PEHD eau potable Ø63', 63], ['PEHD_EAU_110', 'Tube PEHD eau potable Ø110', 110], ['FONTE_150', 'Tuyau fonte DN150', 170], ['TPC_40', 'Gaine TPC Ø40', 40], ['TPC_63', 'Gaine TPC Ø63', 63], ['TPC_90', 'Gaine TPC Ø90', 90], ['TPC_110', 'Gaine TPC Ø110', 110], ['TPC_160', 'Gaine TPC Ø160', 160]]
            .map(([code, name, dn]) => ({ code, name, d: 0, coef: 1, prix: 0, pu: 'ml', surf: false, dn }));
        const MAT_DEFAULTS = [
            ['__DEB', 'Terrassement en déblai', 1.80, 1.25, 'm3'], ['__REM', 'Terrassement en remblai', 1.80, 1.00, 'm3'],
            ['BBSG', 'Béton bitumineux semi-grenu', 2.40, 1, 't'], ['GNT_0_315', 'Grave non traitée 0/31,5', 2.10, 1.25, 't'], ['GNT_0_80', 'Grave non traitée 0/80', 2.05, 1.30, 't'],
            ['GNT_0_100', 'Grave non traitée 0/100', 2.05, 1.30, 't'], ['ACCROCHAGE', "Couche d'accrochage", 0, 1, 'm2', 1], ['BAC', 'Béton armé continu', 2.45, 1, 'm3'],
            ['BALLAST', 'Ballast', 1.70, 1.15, 't'], ['BB', 'Béton bitumineux', 2.35, 1, 't'], ['BBDR', 'Béton bitumineux drainant', 2.00, 1, 't'], ['BBM', 'Béton bitumineux mince', 2.35, 1, 't'],
            ['BBME', 'Béton bitumineux à module élevé', 2.40, 1, 't'], ['BBTM', 'Béton bitumineux très mince', 2.30, 1, 't'], ['BC2', 'Béton de ciment de classe 2', 2.40, 1, 'm3'],
            ['BC5', 'Béton de ciment de classe 5', 2.40, 1, 'm3'], ['BC5G', 'Béton de ciment de classe 5 goujonné', 2.40, 1, 'm3'], ['BETON', 'Béton', 2.40, 1, 'm3'],
            ['BETON_DE_PROPRETE', 'Béton de propreté', 2.30, 1, 'm3'], ['CONCASSE', 'Concassé', 2.00, 1.30, 't'], ['CV', 'Cendres volantes', 1.40, 1.20, 't'],
            ['EME', 'Enrobé à module élevé', 2.45, 1, 't'], ['EME2', 'Enrobé à module élevé de classe 2', 2.45, 1, 't'], ['GB2', 'Grave-bitume de classe 2', 2.40, 1, 't'],
            ['GB3', 'Grave-bitume de classe 3', 2.40, 1, 't'], ['GC3', 'Grave-ciment de classe 3', 2.25, 1.05, 't'], ['GC4', 'Grave-ciment de classe 4', 2.25, 1.05, 't'],
            ['GCH', 'Grave-cendres hydraulique', 2.10, 1.10, 't'], ['GCV', 'Grave-cendres volantes silico-alumineuses chaux', 2.00, 1.10, 't'], ['GEOTEXTILE', 'Géotextile', 0, 1.10, 'm2', 1],
            ['GH', 'Grave traitée aux liants hydrauliques', 2.20, 1.05, 't'], ['GLG', 'Grave-laitier granulé', 2.10, 1.10, 't'], ['GLP', 'Grave-laitier prébroyé', 2.10, 1.10, 't'],
            ['GLR', 'Grave traitée aux liants routiers', 2.10, 1.10, 't'], ['GNT_0_20', 'Grave non traitée 0/20', 2.10, 1.25, 't'], ['GNT_0_40', 'Grave non traitée 0/40', 2.10, 1.25, 't'],
            ['GNT_0_60', 'Grave non traitée 0/60', 2.05, 1.28, 't'], ['IMPREGNATION', "Couche d'imprégnation", 0, 1, 'm2', 1], ['LTCC', 'Limon traité à la chaux-ciment', 1.90, 1.15, 't'],
            ['MTLH', 'Matériaux traités aux liants hydrauliques', 2.20, 1.05, 't'], ['PAVE', 'Pavage', 2.30, 1, 'm2'], ['SABLE', 'Sable', 1.70, 1.20, 't'],
            ['SC2', 'Sable traité au ciment de classe 2', 2.00, 1.10, 't'], ['SC3', 'Sable traité au ciment de classe 3', 2.00, 1.10, 't'], ['SH', 'Sable traité aux liants hydrauliques', 2.00, 1.10, 't'],
            ['SL2', 'Sable traité au laitier (prébroyé) de classe 2', 2.00, 1.10, 't'], ['SL3', 'Sable traité au laitier (prébroyé) de classe 3', 2.00, 1.10, 't'],
            ['STABILISE', 'Stabilisé', 1.95, 1.25, 't'], ['TERRE VEGETALE', 'Terre végétale', 1.50, 1.25, 'm3'], ['TOUT_VENANT', 'Matériaux tout-venant', 2.00, 1.30, 't'],
            ['EMPIERREMENT_40_70', 'Empierrement 40/70', 1.60, 1.15, 't'], ['SAUL', 'Structure alvéolaire ultra-légère', 0.05, 1, 'm3'], ['GEOMEMBRANE', 'Géomembrane', 0, 1.10, 'm2', 1]]
            .map(([code, name, d, coef, pu, surf]) => ({ code, name, d, coef, prix: 0, pu, surf: !!surf })).concat(TUBE_DEFAULTS);
        let matCatalog = (() => { try { const v = JSON.parse(localStorage.getItem('momocad-mats')); if (Array.isArray(v) && v.length) return v; } catch (e) {} return JSON.parse(JSON.stringify(MAT_DEFAULTS)); })();
        function matCatalogFix(list) {   // déblai / remblai toujours en tête
            list = (list || []).filter(m => m && m.code);
            if (!list.some(m => m.pu === 'ml')) list = list.concat(JSON.parse(JSON.stringify(TUBE_DEFAULTS)));   // anciens catalogues : les tubes des tranchées
            ['__REM', '__DEB'].forEach(c => { if (!list.some(m => m.code === c)) list.unshift(JSON.parse(JSON.stringify(MAT_DEFAULTS.find(m => m.code === c)))); });
            return list.filter(m => m.code.startsWith('__')).sort((a, b) => a.code === '__DEB' ? -1 : b.code === '__DEB' ? 1 : 0).concat(list.filter(m => !m.code.startsWith('__')));
        }
        matCatalog = matCatalogFix(matCatalog);
        function matSave() { try { localStorage.setItem('momocad-mats', JSON.stringify(matCatalog)); } catch (e) {} }
        // anciennes clés de la première version de l'onglet Structure
        const MAT_OLD = { enrobe: 'BB', gb: 'GB3', beton: 'BETON', gc: 'GC3', gnt20: 'GNT_0_20', gnt315: 'GNT_0_315', grave060: 'GNT_0_60', tv080: 'GNT_0_80', tv0150: 'TOUT_VENANT', emp4070: 'EMPIERREMENT_40_70', emp0100: 'GNT_0_100', sable: 'SABLE', grav: 'CONCASSE', tvg: 'TERRE VEGETALE', geotex: 'GEOTEXTILE' };
        const structMat = (k) => { k = MAT_OLD[k] || k; return matCatalog.find(m => m.code === k) || MAT_DEFAULTS.find(m => m.code === k) || { code: k || '?', name: k || 'Matériau inconnu', d: 2, coef: 1.25, prix: 0, pu: 't', surf: false }; };
        const matLabel = (m) => m.name && m.name !== m.code ? m.name : m.code;
        function matCost(m, q) {   // q : {A, v, vf, t} -> quantité dans l'unité du prix et montant
            const qp = m.pu === 'ml' ? (+q.ml || 0) : m.pu === 't' ? q.t : m.pu === 'm3f' ? q.vf : m.pu === 'm2' ? (m.surf ? q.vf : q.A) : q.v;
            return { qp, cout: (+m.prix || 0) * qp, pu: m.pu };
        }
        const PU_UNIT = { m3: 'm³', m3f: 'm³ fois.', t: 't', m2: 'm²', ml: 'ml', u: 'u' };
        function structOf(s) { return s && s.struct && Array.isArray(s.struct.layers) ? s.struct : null; }
        function structThick(st) { return st ? st.layers.reduce((a, l) => a + (structMat(l.mat).surf ? 0 : (+l.e || 0)), 0) : 0; }   // cm
        // quantités (et prix du catalogue) pour une surface A (m²)
        function structQty(st, A) {
            return st.layers.map(l => { const m = structMat(l.mat), surf = m.surf, coef = l.coef > 0 ? l.coef : m.coef, d = l.d >= 0 ? l.d : m.d, e = +l.e || 0;
                const v = surf ? 0 : A * e / 100, q = { name: matLabel(m), code: m.code, mat: m.code, e, surf, A, v, vf: surf ? A * coef : v * coef, t: surf ? 0 : v * d, coef, d };
                return Object.assign(q, matCost(m, q), { prix: +m.prix || 0 }); });
        }
        // terrassement : déblai / remblai valorisés avec les deux premières lignes du catalogue
        function terrQty(D, Rm) { return [['__DEB', D], ['__REM', Rm]].map(([c, v]) => { const m = structMat(c), q = { name: m.name, code: c, v, vf: v * m.coef, t: v * m.d, A: 0, coef: m.coef, d: m.d }; return Object.assign(q, matCost(m, q), { prix: +m.prix || 0 }); }); }
        let structEdit = null;
        function structRows() {
            const st = structEdit, opts = (v) => { const cur = structMat(v), L = matCatalog.filter(m => !m.code.startsWith('__') && m.pu !== 'ml'); return (L.includes(cur) ? '' : `<option value="${MF.esc(cur.code)}" selected>${MF.esc(matLabel(cur))}</option>`) + L.map(m => `<option value="${MF.esc(m.code)}"${m === cur ? ' selected' : ''} title="${MF.esc(m.code)}">${MF.esc(matLabel(m))}</option>`).join(''); };
            const one = selectedShapes[0], A = one ? Math.abs(polyArea(empriseOf(one) || [])) * Math.pow(mOf(1), 2) : 0;
            const Q = structQty(st, A);
            return `<div class="mf-sub">Couches, du haut vers le bas</div>
                <div class="st-grid st-head"><span>Matériau</span><span>Ép. cm</span><span title="Foisonnement : volume à commander / volume en place">Fois.</span><span title="Densité en place (t/m³)">t/m³</span><span></span></div>
                ${st.layers.map((l, i) => { const m = structMat(l.mat), surf = m.surf;
                    return `<div class="st-grid"><select class="mf-in mf-sel" style="width:100%;" onchange="structSet(${i},'mat',this.value)">${opts(l.mat)}</select>
                    <input class="mf-in" ${surf ? 'disabled style="opacity:.35"' : ''} value="${surf ? '' : String(l.e).replace('.', ',')}" oninput="structSet(${i},'e',this.value,true)">
                    <input class="mf-in" value="${String(l.coef > 0 ? l.coef : m.coef).replace('.', ',')}" oninput="structSet(${i},'coef',this.value,true)">
                    <input class="mf-in" ${surf ? 'disabled style="opacity:.35"' : ''} value="${surf ? '' : String(l.d >= 0 ? l.d : m.d).replace('.', ',')}" oninput="structSet(${i},'d',this.value,true)">
                    <button type="button" class="st-x" title="Retirer la couche" onclick="structDel(${i})">✕</button></div>`; }).join('')}
                <div class="mf-row"><button type="button" class="mf-link" style="margin:0;" onclick="structAdd()">+ Ajouter une couche</button><span class="mf-hint">Épaisseur totale <b id="st-tot" class="text-white">${nfr(structThick(st), 1)} cm</b></span></div>
                <div class="mf-sub" style="margin-top:6px">Ligne de référence : la cote Z de la plateforme (réglée dans Talus) est…</div>
                ${MF.seg('st-ref', [['fini', 'la cote finie (dessus de la structure)'], ['terr', 'la cote du talus (avant structure)']], st.ff !== false ? 'fini' : 'terr', "structEdit.ff=this.value==='fini';structRefresh()")}
                <div id="st-svg">${structSVG(st)}</div>
                <div id="st-qty">${structQtyHTML(Q, A)}</div>`;
        }
        function structQtyHTML(Q, A) {
            if (!Q.length) return '<div class="mf-hint">Ajoutez des couches (le foisonnement et la densité se remplissent selon le matériau).</div>';
            const P = Q.some(q => q.prix > 0), tot = Q.reduce((a, q) => a + q.cout, 0);
            return `<table class="st-q"><tr><th>Couche</th><th>en place</th><th>foisonné</th><th>tonnes</th>${P ? '<th>montant</th>' : ''}</tr>${Q.map(q => `<tr><td>${MF.esc(q.name)}${q.surf ? '' : ' <span class="text-gray-500">' + nfr(q.e, 0) + ' cm</span>'}</td><td>${q.surf ? nfr(q.A, 1) + ' m²' : nfr(q.v, 2) + ' m³'}</td><td>${q.surf ? nfr(q.vf, 1) + ' m²' : nfr(q.vf, 2) + ' m³'}</td><td>${q.surf ? '—' : nfr(q.t, 1)}</td>${P ? '<td title="' + nfr(q.qp, 2) + ' ' + PU_UNIT[q.pu] + ' × ' + nfr(q.prix, 2) + ' €">' + (q.prix > 0 ? nfr(q.cout, 0) + ' €' : '—') + '</td>' : ''}</tr>`).join('')}${P ? `<tr><td><b>Total</b></td><td></td><td></td><td></td><td><b>${nfr(tot, 0)} €</b></td></tr>` : ''}</table>
                <div class="mf-hint">Sur ${nfr(A, 2)} m² (surface de la plateforme en plan). ${P ? 'Prix HT du ' : 'Prix à saisir dans le '}<button type="button" class="mf-link" style="margin:0;" onclick="closeSelectionParamModal();openCartoucheModal();psTab('mat')">catalogue produits</button>. Totaux dans Σ Métré.</div>`;
        }
        // ---- coupe de la structure : couches à l'échelle (épaisseur), dessus fini, fond de forme, ligne de référence (cote Z de la plateforme) et départ du talus ----
        function structStyle(m) { const c = String(m.code || '');
            if (m.surf) return { f: 'none', s: '#e5e7eb', dash: '4 3' };
            if (/^(BB|EME|GB|BBSG|BBTM|BBM|BBDR|BBME)/.test(c)) return { f: '#3f3f46', s: '#18181b', p: 'dot', pc: '#a1a1aa' };
            if (/^(BETON|BC|BAC)/.test(c)) return { f: '#9ca3af', s: '#4b5563', p: 'tri', pc: '#4b5563' };
            if (/^PAVE/.test(c)) return { f: '#b45f4a', s: '#7f1d1d', p: 'brick', pc: '#7f1d1d' };
            if (/^(SABLE|SC|SL|SH)/.test(c)) return { f: '#e9d58a', s: '#a16207', p: 'dot', pc: '#a16207' };
            if (/^TERRE/.test(c)) return { f: '#6b4f33', s: '#3b2a1a', p: 'dot', pc: '#a3825f' };
            if (/^(GC|GH|MTLH|GL|GCV|GCH|LTCC|CV)/.test(c)) return { f: '#c7c2a5', s: '#78716c', p: 'dot', pc: '#78716c' };
            return { f: '#d2b48c', s: '#8a6a3d', p: 'grav', pc: '#8a6a3d' }; }   // graves, concassés, tout-venant…
        function structSVG(st) {
            const one = selectedShapes[0], zp = one && isPlateforme(one) ? platZ(one) : null, E = structThick(st), ref = st.ff !== false ? 'fini' : 'terr';
            const L = st.layers.map(l => ({ l, m: structMat(l.mat) })); if (!L.length) return '';
            const W = 440, x0 = 132, x1 = 300, top = 30, k = Math.min(2.4, 120 / Math.max(E, 1));   // px par cm (les couches minces gardent 17 px, pour leur nom)
            let y = top; const R = L.map(o => { const h = o.m.surf ? 0 : Math.max(17, (+o.l.e || 0) * k), r = { o, y, h }; y += h; return r; }), yb = y, H = yb + 40;
            const pat = `<defs><pattern id="stp-dot" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="currentColor"/><circle cx="5" cy="5" r="0.7" fill="currentColor"/></pattern>
                <pattern id="stp-grav" width="9" height="7" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.6" fill="none" stroke="currentColor" stroke-width="0.8"/><circle cx="7" cy="5.5" r="1.1" fill="currentColor"/></pattern>
                <pattern id="stp-tri" width="10" height="8" patternUnits="userSpaceOnUse"><path d="M2 6 L4 2 L6 6 Z" fill="none" stroke="currentColor" stroke-width="0.7"/><circle cx="8" cy="3" r="0.7" fill="currentColor"/></pattern>
                <pattern id="stp-brick" width="14" height="7" patternUnits="userSpaceOnUse"><path d="M0 0 H14 M0 3.5 H14 M4 0 V3.5 M11 3.5 V7" stroke="currentColor" stroke-width="0.7" fill="none"/></pattern>
                <pattern id="stp-sol" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 V8" stroke="#6b5a45" stroke-width="1"/></pattern></defs>`;
            const zF = zp === null ? null : (ref === 'fini' ? zp : zp + E * 10), zB = zF === null ? null : zF - E * 10, fz = (z) => z === null ? '' : ' ' + fmtZ(z) + ' m';
            let g = '';
            // terrain en place sous le fond de forme, et talus de terrassement qui part du fond de forme (bord droit)
            g += `<path d="M${x0 - 70} ${yb} H${x1} L${x1 + 64} ${yb - 64 < 8 ? 8 : yb - 64} H${W} V${H} H${x0 - 70} Z" fill="url(#stp-sol)" opacity="0.55"/>`;
            g += `<path d="M${x1} ${yb} L${x1 + 64} ${Math.max(8, yb - 64)}" stroke="#f59e0b" stroke-width="2" fill="none"/><text x="${x1 + 40}" y="${Math.max(8, yb - 64) + 26}" fill="#f59e0b" font-size="10.5" transform="rotate(-45 ${x1 + 40} ${Math.max(8, yb - 64) + 26})">talus</text>`;
            R.forEach(({ o, y, h }) => { const S = structStyle(o.m), nm = matLabel(o.m) + (o.m.surf ? '' : ' · ' + nfr(+o.l.e || 0, 0) + ' cm');
                if (o.m.surf) { g += `<line x1="${x0 - 4}" y1="${y}" x2="${x1 + 4}" y2="${y}" stroke="#ffffff" stroke-width="2.4" stroke-dasharray="${S.dash}"/><text x="${x1 + 8}" y="${y + 3.5}" fill="#ffffff" font-size="10.5" font-weight="600">${MF.esc(nm)}</text>`; return; }
                g += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="${S.f}" stroke="${S.s}" stroke-width="1"/>` + (S.p ? `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="url(#stp-${S.p})" style="color:${S.pc}"/>` : '');
                g += h >= 15 ? `<text x="${(x0 + x1) / 2}" y="${y + h / 2 + 3.5}" text-anchor="middle" fill="${/^#(3f|6b|b4)/.test(S.f) ? '#f9fafb' : '#111827'}" font-size="10.5" font-weight="600">${MF.esc(nm)}</text>` : `<text x="${x1 + 6}" y="${y + h / 2 + 3}" fill="#e5e7eb" font-size="10">${MF.esc(nm)}</text>`; });
            // niveaux à gauche : dessus fini et fond de forme
            const lev = (yy, lb, col, dy) => `<text x="${x0 - 11}" y="${yy + (dy || 3.5)}" text-anchor="end" fill="${col}" font-size="10.5">${lb}</text>`;
            g += lev(top, 'fini' + fz(zF), '#e5e7eb', ref === 'fini' ? 9 : 3.5) + lev(yb, 'fond de forme' + fz(zB), '#e5e7eb', ref === 'fini' ? 3.5 : -4);
            // ligne de référence : la cote Z saisie pour la plateforme
            const yr = ref === 'fini' ? top : yb; g += `<line x1="${x0 - 70}" y1="${yr}" x2="${W - 4}" y2="${yr}" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="9 3 2 3"/>
                <text x="${x0 - 11}" y="${yr + (ref === 'fini' ? -6 : 15)}" text-anchor="end" fill="#f87171" font-size="10.5" font-weight="700">Réf. Z${fz(zp)}</text>`;
            g += `<text x="${(x0 + x1) / 2}" y="${yb + 16}" text-anchor="middle" fill="#e5e7eb" font-size="10.5">épaisseur totale ${nfr(E, 0)} cm</text>`;
            const note = ref === 'fini' ? 'Terrassement au fond de forme (Z − ' + nfr(E, 0) + ' cm) : le talus part du fond de forme.' : 'Terrassement à la cote Z : la structure est posée dessus, le dessus fini est à Z + ' + nfr(E, 0) + ' cm.';
            return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:6px 0 2px;background:#0b1220;border:1px solid #374151;border-radius:6px">${pat}${g}</svg><div class="mf-hint">${note}</div>`;
        }
        function structRefresh() { const sv = document.getElementById('st-svg'); if (sv && structEdit) sv.innerHTML = structSVG(structEdit); const one = selectedShapes[0], A = one ? Math.abs(polyArea(empriseOf(one) || [])) * Math.pow(mOf(1), 2) : 0, q = document.getElementById('st-qty'), t = document.getElementById('st-tot');
            if (q) q.innerHTML = structQtyHTML(structQty(structEdit, A), A); if (t) t.textContent = nfr(structThick(structEdit), 1) + ' cm'; }
        function structRerender() { const b = document.getElementById('st-box'); if (b) b.innerHTML = structRows(); }
        function structSet(i, k, v, soft) { const l = structEdit.layers[i]; if (!l) return;
            if (k === 'mat') { l.mat = v; delete l.coef; delete l.d; delete l.name; if (structMat(v).surf) l.e = 0; else if (!(+l.e > 0)) l.e = 20; structRerender(); return; }
            const n = parseFloat(String(v).replace(',', '.')); if (isFinite(n) && n >= 0) l[k] = n; if (soft) structRefresh(); }
        function structAdd() { const last = structEdit.layers[structEdit.layers.length - 1]; structEdit.layers.push({ mat: last ? 'GNT_0_80' : 'GNT_0_315', e: last ? 30 : 20 }); structRerender(); }
        function structDel(i) { structEdit.layers.splice(i, 1); structRerender(); }
        function structSum(o) { const st = structOf(o); return st && st.layers.length ? st.layers.length + ' couche' + (st.layers.length > 1 ? 's' : '') + ' · ' + nfr(structThick(st), 0) + ' cm' : 'aucune'; }
