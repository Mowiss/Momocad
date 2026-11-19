        // ---- TOITURE complète : 1 ou 2 pans à partir d'un contour, hauteurs d'égout et de faîtage, pignons comblés ----
        let roofLast = { pans: 2, rel: 2.5, rise: 2.5, e: 0.2, ge: 0.2, fill: true, dir: 'long', db: 0.3, tex: '', texu: '' };
        try { Object.assign(roofLast, JSON.parse(localStorage.getItem('momocad-roof') || '{}')); } catch (e) {}
        function roofDialog(base, fresh, edit) {
            const R0 = edit ? Object.assign({}, roofLast, edit.o, edit.o.pans === 0 ? { trel: edit.o.he - (hasZ(base.points[0].z) ? base.points[0].z : 0) / 1000 } : { rel: edit.o.he - (hasZ(base.points[0].z) ? base.points[0].z : 0) / 1000, rise: edit.o.hf - edit.o.he }) : roofLast;
            const P = base.points, n = P.length, quad = n === 4, z0 = hasZ(P[0].z) ? P[0].z : 0, L = (i) => Math.hypot(P[(i + 1) % n].x - P[i].x, P[(i + 1) % n].y - P[i].y) * mOf(1);
            let longest = 0; for (let i = 1; i < n; i++) if (L(i) > L(longest)) longest = i;
            const bz = (() => { if (edit) return null; const Zb = base.bld ? base : (() => { const q = bldRep(base); return q && bldZones().length ? bldZoneAt(q.x, q.y) : null; })(); return Zb ? bldEgout(Zb) : null; })();   /* toit d'un bâtiment : l'égout part du haut de l'étage de toiture (ou du dernier étage) */
            const he = hasZ(bz) ? bz / 1000 : z0 / 1000 + R0.rel, hf = he + R0.rise, f2 = (v) => nfr(v, 2), inp = (id, v) => `<input id="${id}" type="text" inputmode="decimal" value="${v}" style="width:90px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;text-align:right;outline:none;">`;
            const row = (lab, h, sub) => `<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><span>${lab}${sub ? `<br><span style="color:#9ca3af;font-size:12px">${sub}</span>` : ''}</span><span style="white-space:nowrap">${h}</span></label>`;
            const texSel = (id, cur, ids) => `<select id="${id}" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 6px"><option value="">aucune (couleur du calque)</option>${ids.map(t => { const T = TEX_LIB.find(x => x.id === t); return T ? `<option value="${t}" ${cur === t ? 'selected' : ''}>${T.name}</option>` : ''; }).join('')}</select>`;
            const pans = R0.pans === 0 ? 0 : R0.pans === 4 ? 4 : quad ? R0.pans : R0.pans === 2 ? 4 : 1, sw = (v) => `rfSw(${v})`, gab0 = R0.pans === 4 && Array.isArray(R0.gab) && R0.gab.length === n ? R0.gab : P.map(() => false);
            // côté en clair : longueur et orientation (vers où il regarde, depuis l'intérieur)
            const ar0 = P.reduce((a, q, i) => { const r = P[(i + 1) % n]; return a + q.x * r.y - r.x * q.y; }, 0), side = (i) => { const a = P[i], b = P[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; let nx = (b.y - a.y) / l, ny = -(b.x - a.x) / l; if (ar0 < 0) { nx = -nx; ny = -ny; }
                const ang = Math.atan2(-ny, nx) * 180 / Math.PI, C = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est']; return C[((Math.round(ang / 45) % 8) + 8) % 8]; };
            const T0 = { ht: z0 / 1000 + (R0.trel !== undefined ? R0.trel : 3), te: R0.te || 0.25, tc: R0.tc || 0, ah: R0.ah !== undefined ? R0.ah : 0.6, at: R0.at || 0.2, fp: R0.fp !== undefined ? R0.fp : 2, fe: R0.fe || 0.05, ttex: R0.ttex !== undefined ? R0.ttex : 'gravier', tg: R0.tg !== undefined ? R0.tg : longest };
            const ri = (id, v, w, x, y, tip) => `<input id="${id}" type="text" inputmode="decimal" value="${v}" title="${MF.esc(tip)}" class="tal-in" style="left:${x}%;top:${y}%;width:${w}px;">`, rl = (t, x, y) => `<span class="tal-lb" style="left:${x}%;top:${y}%;">${t}</span>`;
            const card = (v, lab, svg, dis) => `<label class="rf-card${pans === v ? ' on' : ''}" style="${dis ? 'opacity:.4;pointer-events:none' : ''}"><input type="radio" name="rf-p" value="${v}" ${pans === v ? 'checked' : ''} ${dis ? 'disabled' : ''} onchange="${sw(v)}" style="display:none"><svg width="74" height="44" viewBox="0 0 74 44" fill="none" stroke="#e5e7eb" stroke-width="1.4" stroke-linejoin="round">${svg}</svg><span>${lab}</span></label>`;
            const icT = '<rect x="12" y="20" width="50" height="22" fill="#374151"/><path d="M6 20h62" stroke-width="3"/><path d="M8 20v-7h4v7M62 20v-7h4v7" fill="#9ca3af"/><path d="M14 17l44 -2" stroke="#60a5fa"/>';
            const ic1 = '<rect x="12" y="22" width="50" height="20" fill="#374151"/><path d="M6 24L68 8" stroke="#f97316" stroke-width="3"/><path d="M62 9.5V22" />';
            const ic2 = '<rect x="12" y="24" width="50" height="18" fill="#374151"/><path d="M5 27L37 6L69 27" stroke="#f97316" stroke-width="3"/><path d="M12 22.5L37 6L62 22.5z" fill="#4b5563" stroke="none"/>';
            const ic4 = '<path d="M6 40H68V30H40V14H6Z" fill="#374151" stroke="#9ca3af"/><path d="M6 40L14 32H60L68 40M6 14L14 22V32M40 14L32 22V30M14 22H32M14 32L32 22M60 32L68 30" stroke="#f97316" stroke-width="1.6"/>';
            openTopoModal('🏠 Toiture', `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:#e5e7eb;max-width:440px">
                <div style="color:#9ca3af">Le contour (${n} côtés) est celui des murs : le toit le couvre, avec son débord tout autour, et les pignons s'alignent sur les murs. Les altitudes sont celles du plan : si le terrain est à 0, ce sont directement des hauteurs.</div>
                ${spChapter('rf-type', '⌂', 'Type de toit', `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px">${card(0, 'Toit terrasse', icT)}${card(1, '1 pan (appentis)', ic1)}${card(2, '2 pans', ic2, !quad)}${card(4, 'Pans multiples', ic4)}</div>` + (quad ? '' : '<div style="color:#fbbf24;font-size:12px;margin-top:6px">2 pans : contour à 4 côtés. Pour ce contour, prenez <b>Pans multiples</b> (un pan par côté, pignons au choix).</div>'), true)}
                <div id="rf-o0" style="display:${pans === 0 ? 'flex' : 'none'};flex-direction:column;gap:0">
                    ${spChapter('rf-tdim', '▭', 'Dimensions', `<div class="tal-dia"><svg viewBox="0 0 360 210" width="100%"><defs><pattern id="rfdh" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#52525b" stroke-width="1"/></pattern></defs>
                        <rect x="72" y="128" width="16" height="80" fill="#1f2937" stroke="#9ca3af"/><text x="92" y="200" fill="#9ca3af" font-size="9" font-family="Arial">mur</text>
                        <rect x="30" y="110" width="310" height="18" fill="url(#rfdh)" stroke="#d4d4d8" stroke-width="1.2"/>
                        <rect x="72" y="56" width="16" height="54" fill="url(#rfdh)" stroke="#d4d4d8" stroke-width="1.2"/>
                        <path d="M88 92 L340 104 L340 110 L88 110 Z" fill="#a8a29e" fill-opacity=".5" stroke="#d6d3d1"/><path d="M250 92l40 2M284 90l7 4-7 3" stroke="#60a5fa" stroke-width="1.6" fill="none"/><text x="236" y="86" fill="#93c5fd" font-size="9" font-family="Arial">vers l'évacuation</text>
                        <g stroke="#f59e0b" fill="none"><path d="M62 56V110M58 60l8-8M58 114l8-8"/><path d="M72 46H88M68 50l8-8M84 50l8-8"/><path d="M30 140H72M26 144l8-8M68 144l8-8"/><path d="M350 110V128M346 114l8-8M346 132l8-8"/></g>
                        <path d="M160 110l-5-8h10z" fill="#f59e0b"/><path d="M160 110V140" stroke="#f59e0b" stroke-dasharray="2 2"/></svg>
                        ${ri('rf-ah', f2(T0.ah), 48, 2, 30, 'Hauteur de l\'acrotère au-dessus de la dalle (m) ; 0 = pas d\'acrotère')}${rl('acrotère', 24, 4)}
                        ${ri('rf-at', f2(T0.at), 44, 26, 13, 'Épaisseur de l\'acrotère (m)')}
                        ${ri('rf-tc', f2(T0.tc), 48, 3, 72, 'Casquette : la dalle dépasse des murs (et de l\'acrotère) de cette distance (m) ; 0 = pas de casquette')}${rl('casquette', 4, 84)}
                        ${ri('rf-te', f2(T0.te), 48, 83, 66, 'Épaisseur de la dalle (m)')}${rl('dalle', 86, 77)}
                        ${ri('rf-ht', f2(T0.ht), 56, 38, 70, 'Altitude du dessus de la dalle (m), posée sur le haut des murs')}${rl('altitude dessus de dalle', 30, 81)}
                        ${ri('rf-fp', f2(T0.fp), 44, 52, 26, 'Pente de la forme de pente (%) : seule cette couche est inclinée, la dalle reste plane ; 0 = pas de forme')}${rl('pente %', 48, 17)}
                        ${ri('rf-fe', f2(T0.fe), 44, 83, 34, 'Épaisseur mini de la forme de pente, au point bas (m)')}${rl('mini', 86, 25)}</div>`
                        + row('Hauteur du toit', `<input id="rf-thr" type="text" inputmode="decimal" value="${f2(T0.ht - z0 / 1000)}" oninput="{ const v = parseFloat(this.value.replace(',', '.')); if (isFinite(v)) document.getElementById('rf-ht').value = nfr(${z0 / 1000} + v, 2).replace(/\s/g, ''); }" style="width:90px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;text-align:right;outline:none"> m`, 'du pied des murs au dessus de la dalle (le dessus de dalle sur le schéma suit)'), true)}
                    ${spChapter('rf-tcx', '≣', 'Épaisseur — complexe sur la dalle', rfCxHtml('t', R0.cxT || RF_CX_DEF.t), false)}
                    ${spChapter('rf-tev', '💧', 'Eaux pluviales', row('Évacuation des eaux (point bas)', `<select id="rf-tg" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 6px">${P.map((q, i) => `<option value="${i}" ${i === T0.tg ? 'selected' : ''}>côté ${i + 1}-${(i + 1) % n + 1} (${f2(L(i))} m)</option>`).join('')}</select>`, 'les eaux pluviales s\'écoulent vers ce côté'), false)}
                </div>
                <div id="rf-pitch" style="display:${pans === 0 ? 'none' : 'flex'};flex-direction:column;gap:0">
                    ${spChapter('rf-pdim', '△', 'Dimensions', `<div class="tal-dia"><svg id="rf-svg" viewBox="0 0 360 210" width="100%"></svg>
                        ${ri('rf-he', f2(he), 56, 1, 54, 'Altitude de l\'égout : le bas du toit, posé sur le haut des murs (m)')}${rl('égout', 2, 45)}
                        ${ri('rf-hf', f2(hf), 56, 80, 6, 'Altitude du faîtage : le point le plus haut du toit (m)')}${rl('faîtage', 82, 0)}
                        <input id="rf-e" type="text" readonly value="${f2(R0.e)}" title="Épaisseur du toit : somme des couches. Cliquez pour ouvrir l'onglet Épaisseur et régler chaque couche." onclick="window.tmTab='rf-pcx';tmTabify()" class="tal-in" style="left:18%;top:20%;width:46px;cursor:pointer;border-color:#f59e0b">${rl('épaisseur', 17, 11)}
                        ${ri('rf-db', f2(R0.db || 0), 46, 4, 78, 'Débord : le toit dépasse du contour des murs de cette distance, tout autour (m)')}${rl('débord', 5, 89)}</div>`, true)}
                    ${spChapter('rf-pcx', '≣', 'Épaisseur — complexe de toiture', rfCxHtml('p', R0.cxP || RF_CX_DEF.p), false)}
                    ${spChapter('rf-popt', '⚙', 'Faîtage et pignons', `
                <div id="rf-o2" style="display:${pans === 2 ? 'flex' : 'none'};flex-direction:column;gap:6px">${row('Faîtage parallèle', `<select id="rf-dir" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 6px"><option value="long" ${R0.dir !== 'short' ? 'selected' : ''}>au grand côté</option><option value="short" ${R0.dir === 'short' ? 'selected' : ''}>au petit côté</option></select>`, 'les égouts sont sur les deux côtés parallèles au faîtage')}</div>
                <div id="rf-o4" style="display:${pans === 4 ? 'flex' : 'none'};flex-direction:column;gap:4px"><div style="color:#9ca3af;font-size:12px">Chaque côté du contour porte un pan (croupe), à la même pente ; un côté en <b>pignon</b> reste vertical (mur pignon, le faîtage vient jusqu'à lui). Le faîtage est le point le plus haut.</div>
                    ${P.map((q, i) => row(`Côté ${i + 1}-${(i + 1) % n + 1} <span style="color:#9ca3af">(${f2(L(i))} m, ${side(i)})</span>`, `<select id="rf-gb-${i}" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:4px 6px"><option value="0" ${gab0[i] ? '' : 'selected'}>pan (croupe)</option><option value="1" ${gab0[i] ? 'selected' : ''}>pignon</option></select>`)).join('')}</div>
                <div id="rf-o1" style="display:${pans === 1 ? 'flex' : 'none'};flex-direction:column;gap:6px">${row('Égout (côté bas)', `<select id="rf-eg" style="background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 6px">${P.map((q, i) => `<option value="${i}" ${i === (edit && edit.o && edit.o.eg >= 0 && edit.o.eg < n ? edit.o.eg : longest) ? 'selected' : ''}>côté ${i + 1}-${(i + 1) % n + 1} (${f2(L(i))} m)</option>`).join('')}</select>`, 'le pan monte depuis ce côté')}</div>
                <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;border-top:1px solid #374151;padding-top:8px"><input type="checkbox" id="rf-fill" ${R0.fill ? 'checked' : ''} style="margin-top:3px"><span>Combler les pignons<br><span style="color:#9ca3af;font-size:12px">les vides en V (ou en biseau) entre le haut des murs et le dessous du toit sont remplis par des murs pignons</span></span></label>
                ${row('Épaisseur des pignons', inp('rf-ge', f2(R0.ge)) + ' m', 'comptée vers l\'intérieur du contour')}`, false)}
            </div></div>`, [['Annuler', () => { closeTopoModal(); setMode('select-box'); draw(); }, false], [edit ? 'Mettre à jour le toit' : 'Créer le toit', () => roofBuildFromDialog(base, fresh, edit), true]]);
            setTimeout(() => { rfDia(pans); rfCxDraw('p'); rfCxDraw('t'); tmTabify(); const ht = document.getElementById('rf-ht'), hr = document.getElementById('rf-thr'); if (ht && hr) ht.addEventListener('input', () => { const v = parseFloat(ht.value.replace(',', '.')); if (isFinite(v)) hr.value = nfr(v - z0 / 1000, 2).replace(/\s/g, ''); }); }, 0);
        }
        // ---- complexe de toiture : couches du haut vers le bas ; l'épaisseur du toit en découle ----
        const RF_CX_TYPES = { couverture: ['Couverture', '#b5553a'], liteaux: ['Liteaux', '#c08a52', 1], contrelatte: ['Contre-liteaux', '#c9955e', 1], ecran: ['Écran sous-toiture', '#60a5fa'], chevrons: ['Chevrons', '#a16207', 1], solivage: ['Solivage', '#92400e', 1], chevetre: ['Chevêtre', '#7c2d12', 1], isolation: ['Isolation', '#facc15'], parevapeur: ['Pare-vapeur', '#38bdf8'], plaque: ['Plaque de plâtre', '#e5e7eb'], protection: ['Protection (gravillons…)', '#a8a29e'], etancheite: ['Étanchéité', '#1f2937'], isolant: ['Isolant de toiture terrasse', '#fde047'], dalle: ['Dalle béton', '#9ca3af'], autre: ['Autre', '#6b7280'] };
        const RF_CX_DEF = { p: [{ t: 'couverture', e: 3 }, { t: 'liteaux', e: 2.7, ent: 32 }, { t: 'contrelatte', e: 2.7, ent: 60 }, { t: 'ecran', e: 0.1 }, { t: 'chevrons', e: 8, ent: 60 }, { t: 'isolation', e: 20 }, { t: 'parevapeur', e: 0.1 }, { t: 'plaque', e: 1.3 }],
            t: [{ t: 'protection', e: 5 }, { t: 'etancheite', e: 1 }, { t: 'isolant', e: 12 }, { t: 'parevapeur', e: 0.1 }] };
        let rfCx = { p: null, t: null };
        function rfCxHtml(k, L) { rfCx[k] = JSON.parse(JSON.stringify(L)); return `<div id="rf-cx-${k}"></div>`; }
        function rfCxSum(k) { return (rfCx[k] || []).reduce((a, l) => a + (+l.e || 0), 0) / 100; }   // m
        function rfCxDraw(k) {
            const box = document.getElementById('rf-cx-' + k); if (!box) return; const L = rfCx[k] || [], sel = (i, v) => `<select onchange="rfCx['${k}'][${i}].t=this.value;rfCxDraw('${k}')" class="mf-in" style="width:9.5rem;text-align:left">${Object.entries(RF_CX_TYPES).map(([id, d]) => `<option value="${id}" ${id === v ? 'selected' : ''}>${d[0]}</option>`).join('')}</select>`;
            const num = (i, f, v, ph) => `<input type="text" inputmode="decimal" value="${v === undefined || v === '' ? '' : String(v).replace('.', ',')}" placeholder="${ph || ''}" onchange="rfCx['${k}'][${i}].${f}=parseFloat(String(this.value).replace(',', '.'))||0;rfCxDraw('${k}')" class="mf-in" style="width:3.6rem">`;
            // coupe du complexe : une bande par couche (hauteur selon l'épaisseur), pièces de bois dessinées à leur entraxe
            const tot = L.reduce((a, l) => a + (+l.e || 0), 0) || 1, H = Math.max(60, Math.min(170, 8 * L.length + tot * 3)); let y = 6, svg = '';
            L.forEach(l => { const d = RF_CX_TYPES[l.t] || RF_CX_TYPES.autre, h = Math.max(6, (+l.e || 0) / tot * (H - 12 - 6 * L.length) + 6);
                if (d[2]) { const ent = Math.max(8, (+l.ent || 60) / 2); for (let x = 70; x < 330; x += ent) svg += `<rect x="${x}" y="${y}" width="${Math.min(10, ent * 0.4)}" height="${h - 1}" fill="${d[1]}"/>`; svg += `<rect x="70" y="${y}" width="260" height="${h - 1}" fill="none" stroke="#4b5563" stroke-dasharray="2 2"/>`; }
                else svg += `<rect x="70" y="${y}" width="260" height="${h - 1}" fill="${d[1]}" fill-opacity="${l.t === 'isolation' || l.t === 'isolant' ? .55 : .8}" stroke="#4b5563"/>`;
                svg += `<text x="66" y="${y + h / 2 + 3}" text-anchor="end" fill="#d1d5db" font-size="9" font-family="Arial">${MF.esc(d[0])}</text><text x="334" y="${y + h / 2 + 3}" fill="#f59e0b" font-size="9" font-family="Arial">${nfr(+l.e || 0, 1)} cm${d[2] && l.ent ? ' / ' + l.ent : ''}</text>`; y += h; });
            box.innerHTML = `<div class="tal-dia"><svg viewBox="-40 0 440 ${y + 6}" width="100%">${svg}</svg></div>
                <div class="mf-hint" style="margin:6px 0">Du haut vers le bas. Épaisseur en cm ; pour les bois (liteaux, chevrons, solivage, chevêtre), l'<b>entraxe</b> en cm.</div>
                ${L.map((l, i) => `<div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">${sel(i, l.t)}${num(i, 'e', l.e, 'cm')}${(RF_CX_TYPES[l.t] || [])[2] ? num(i, 'ent', l.ent, 'entraxe') : '<span style="width:3.6rem"></span>'}
                    <button type="button" onclick="rfCxMove('${k}',${i},-1)" title="Monter" class="mf-in" style="width:24px;padding:0">↑</button><button type="button" onclick="rfCx['${k}'].splice(${i},1);rfCxDraw('${k}')" title="Retirer" class="mf-in" style="width:24px;padding:0;color:#fca5a5">×</button></div>`).join('')}
                <button type="button" onclick="rfCx['${k}'].push({t:'autre',e:1});rfCxDraw('${k}')" class="mf-in" style="width:auto;padding:2px 10px;margin-top:2px">+ Ajouter une couche</button>
                <div style="margin-top:6px;color:#e5e7eb">Épaisseur du complexe : <b style="color:#f59e0b">${nfr(rfCxSum(k), 3)} m</b></div>`;
            if (k === 'p') { const e = document.getElementById('rf-e'); if (e) e.value = nfr(rfCxSum('p'), 2); }
        }
        function rfCxMove(k, i, d) { const L = rfCx[k], j = i + d; if (!L || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; rfCxDraw(k); }
        // fenêtres de réglage à chapitres : une barre d'icônes à gauche, un chapitre à la fois (comme le volet Y)
        function tmTabify() {
            const panel = document.querySelector('#topo-modal > div'), body = document.getElementById('tm-body'); if (!panel || !body) return; let strip = panel.querySelector('#tm-strip');
            const D = [...body.querySelectorAll('details.sp-ch')].filter(d => d.offsetParent !== null || d.classList.contains('sp-off'));
            const vis = D.filter(d => { let e = d.parentElement; while (e && e !== body) { if (e.style && e.style.display === 'none') return false; e = e.parentElement; } return true; });
            if (vis.length < 2) { if (strip) strip.remove(); panel.classList.remove('sp-has-strip'); body.classList.remove('sp-tabbed'); D.forEach(d => d.classList.remove('sp-off')); return; }
            if (!strip) { strip = document.createElement('div'); strip.id = 'tm-strip'; panel.appendChild(strip); } panel.classList.add('sp-has-strip'); body.classList.add('sp-tabbed');
            const key = (d) => d.dataset.k, keys = vis.map(key); let cur = window.tmTab && keys.includes(window.tmTab) ? window.tmTab : keys[0];
            strip.innerHTML = vis.map(d => { const ic = (d.querySelector('.sp-ic') || {}).textContent || '•', t = (d.querySelector('.sp-t') || {}).textContent || '', sh = t.split(/\s+[—–-]\s+|\s+/)[0]; return `<button type="button" class="${key(d) === cur ? 'on' : ''}" title="${MF.esc(t)}" onclick="window.tmTab='${MF.esc(key(d))}';tmTabify()"><span>${MF.esc(ic)}</span><small>${MF.esc(sh)}</small></button>`; }).join('');
            D.forEach(d => { d.open = true; d.classList.toggle('sp-off', key(d) !== cur); });
        }
        function rfSw(v) { const d = (id, on) => { const e = document.getElementById(id); if (e) e.style.display = on ? 'flex' : 'none'; }; d('rf-o0', v === 0); d('rf-pitch', v !== 0); d('rf-o1', v === 1); d('rf-o2', v === 2); d('rf-o4', v === 4);
            document.querySelectorAll('.rf-card').forEach(c => c.classList.toggle('on', !!(c.querySelector('input') || {}).checked)); rfDia(v); tmTabify(); }
        // coupe schématique du toit à pans : murs, pente, égout, faîtage, épaisseur et débord cotés
        function rfDia(v) { const sv = document.getElementById('rf-svg'); if (!sv || !v) return; const D = '#f59e0b', g = 196, wT = 118, wl = 78, wr = 282, ex = 26;
            let t = `<defs><pattern id="rfph" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#52525b" stroke-width="1"/></pattern></defs><path d="M10 ${g}H350" stroke="#a1a1aa" stroke-width="1.4"/>
                <rect x="${wl}" y="${wT}" width="12" height="${g - wT}" fill="url(#rfph)" stroke="#d4d4d8"/><rect x="${wr - 12}" y="${wT}" width="12" height="${g - wT}" fill="url(#rfph)" stroke="#d4d4d8"/>`;
            const rf = (pts) => { const P2 = pts.map(([x, y]) => [x, y + 9]); t += `<path d="M${pts.map(q => q.join(' ')).join('L')}L${P2.slice().reverse().map(q => q.join(' ')).join('L')}Z" fill="#b5553a" fill-opacity=".55" stroke="#f97316" stroke-width="1.5"/>`; };
            const slope = (wT - 40) / (wr - wl) * 2, yE = wT + (wl - ex - wl) * 0;
            if (v === 2 || v === 4) { const xm = (wl + wr) / 2, yr = 40, k = (wT - yr) / (xm - wl); rf([[ex, wT + (wl - ex) * k], [xm, yr], [360 - ex, wT + (wl - ex) * k]]); t += `<path d="M${wl + 12} ${wT}L${xm} ${yr + 12}L${wr - 12} ${wT}Z" fill="url(#rfph)" stroke="#9ca3af" stroke-dasharray="3 2"/><text x="${xm - 16}" y="${wT - 10}" fill="#9ca3af" font-size="9" font-family="Arial">pignon</text>`; }
            else { const yr = 40, k = (wT - yr) / (wr - wl); rf([[ex, wT + (wl - ex) * k], [360 - ex, yr - (360 - ex - wr) * k]]); t += `<path d="M${wl + 12} ${wT}L${wr - 12} ${yr + 12 + 12 * k}L${wr - 12} ${wT}Z" fill="url(#rfph)" stroke="#9ca3af" stroke-dasharray="3 2"/>`; }
            const A = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${D}"/>`, tk = (x, y) => `<path d="M${x - 4} ${y + 4}l8-8" stroke="${D}"/>`;
            t += A(14, wT, 14, g) + tk(14, wT) + tk(14, g) + A(14, wT, wl, wT);
            t += A(346, 40, 346, g) + tk(346, 40) + tk(346, g) + A(v === 2 || v === 4 ? 180 : 300, 40, 346, 40);
            t += A(ex, 176, wl, 176) + tk(ex, 176) + tk(wl, 176) + A(ex, wT + 20, ex, 180);
            sv.innerHTML = t; }
        function roofEdit(gid) {
            const rp = shapes.find(x => x.groupId === gid && x.roofDef); if (!rp) return;
            const d = rp.roofDef, base = { type: 'poly', layerId: rp.layerId, color: rp.color, dash: rp.dash, width: rp.width, points: d.base.map(q => ({ x: q.x, y: q.y, z: q.z })) };
            // le toit a été déplacé, tourné, retourné (miroir) ou mis à l'échelle avec le bâtiment : le contour d'origine suit le même mouvement
            const A0 = rp.roofP0, A1 = rp.points; if (A0 && A1 && A0.length === A1.length && A0.length >= 3) { let M = null;
                for (let i = 1; i < A0.length && !M; i++) for (let j = i + 1; j < A0.length && !M; j++) { const sx1 = A0[i].x - A0[0].x, sy1 = A0[i].y - A0[0].y, sx2 = A0[j].x - A0[0].x, sy2 = A0[j].y - A0[0].y, det = sx1 * sy2 - sx2 * sy1; if (Math.abs(det) < 1e-9 * (sx1 * sx1 + sy1 * sy1 + sx2 * sx2 + sy2 * sy2)) continue;
                    const dx1 = A1[i].x - A1[0].x, dy1 = A1[i].y - A1[0].y, dx2 = A1[j].x - A1[0].x, dy2 = A1[j].y - A1[0].y, a = (dx1 * sy2 - dx2 * sy1) / det, b = (dx2 * sx1 - dx1 * sx2) / det, c = (dy1 * sy2 - dy2 * sy1) / det, e = (dy2 * sx1 - dy1 * sx2) / det;
                    M = { a, b, c, e, tx: A1[0].x - a * A0[0].x - b * A0[0].y, ty: A1[0].y - c * A0[0].x - e * A0[0].y }; }
                if (M) base.points.forEach(q => { const x = q.x, y = q.y; q.x = M.a * x + M.b * y + M.tx; q.y = M.c * x + M.e * y + M.ty; }); }
            const o = Object.assign({}, d.o); const T = shapes.find(x => x.groupId === gid && x.solid && x.solid.kind === 'roof'); if (T) { if (T.tex !== undefined) o.tex = T.tex || ''; if (T.texU !== undefined) o.texu = T.texU || ''; }
            if (d.o.pans === 0) { const F = shapes.find(x => x.groupId === gid && x.name === 'Forme de pente'), Sl = shapes.find(x => x.groupId === gid && x.name === 'Dalle de toit'); o.ttex = F ? F.tex || '' : ''; o.texu = Sl ? Sl.tex || '' : ''; }
            roofDialog(base, false, { gid, o });
        }
        function roofBuildFromDialog(base, fresh, edit) {
            const nv = (id) => t2Num((document.getElementById(id) || {}).value), sv = (id) => (document.getElementById(id) || {}).value || '';
            const pansV = +((document.querySelector('input[name=rf-p]:checked') || {}).value || 1);
            if (pansV === 0) { const z0t = hasZ(base.points[0].z) ? base.points[0].z : 0;
                const o = { pans: 0, he: nv('rf-ht'), te: nv('rf-te'), tc: Math.max(0, nv('rf-tc') || 0), ah: Math.max(0, nv('rf-ah') || 0), at: nv('rf-at'), fp: Math.max(0, nv('rf-fp') || 0), fe: nv('rf-fe'), tg: +sv('rf-tg') || 0, ttex: edit ? edit.o.ttex || '' : '', texu: edit ? edit.o.texu || '' : '', cxT: JSON.parse(JSON.stringify(rfCx.t || [])), ct: rfCxSum('t') };   // textures : seulement à la main (outil Peindre), gardées à la modification
                if (!isFinite(o.he)) { alert('Donnez l\'altitude du dessus de la dalle.'); return; } if (!(o.te > 0)) o.te = 0.25; if (!(o.at > 0)) o.at = 0.2; if (!(o.fe >= 0)) o.fe = 0.05;
                roofLast = Object.assign(roofLast, { pans: 0, trel: o.he - z0t / 1000, te: o.te, tc: o.tc, ah: o.ah, at: o.at, fp: o.fp, fe: o.fe, tg: o.tg, cxT: o.cxT }); try { localStorage.setItem('momocad-roof', JSON.stringify(roofLast)); } catch (e) {}
                closeTopoModal(); const out = buildTerrace(base, o); if (!out) return;
                if (edit) shapes = shapes.filter(x => x.groupId !== edit.gid);
                shapes = shapes.filter(x => x !== base).concat(out); saveState(); setMode('select-box'); selectedShapes = out; draw(); if (is3DOpen()) { build3DScene(); render3D(); }
                updateCommandMessageText('TOIT TERRASSE : dalle de ' + nfr(o.te, 2) + ' m, dessus à ' + nfr(o.he, 2) + ' m' + (o.tc ? ', casquette ' + nfr(o.tc, 2) + ' m' : '') + (o.ah ? ', acrotère ' + nfr(o.ah, 2) + ' m' : '') + (o.fp ? ', forme de pente ' + nfr(o.fp, 1) + ' %' : '') + '. Il forme un bloc : Y dessus pour le modifier.');
                return; }
            const o = { pans: pansV, he: nv('rf-he'), hf: nv('rf-hf'), e: nv('rf-e'), ge: nv('rf-ge'), fill: document.getElementById('rf-fill').checked, dir: (document.getElementById('rf-dir') || {}).value || 'long', gab: pansV === 4 ? base.points.map((q, i) => sv('rf-gb-' + i) === '1') : undefined, eg: +((document.getElementById('rf-eg') || {}).value || 0), db: Math.max(0, nv('rf-db') || 0), cxP: JSON.parse(JSON.stringify(rfCx.p || [])), tex: edit ? edit.o.tex || '' : '', texu: edit ? edit.o.texu || '' : '' };
            if (!isFinite(o.he) || !isFinite(o.hf) || o.hf <= o.he + 0.001) { alert('Le faîtage doit être plus haut que l\'égout.'); return; }
            if (o.gab && o.gab.every(Boolean)) { alert('Pans multiples : gardez au moins un côté en pan.'); return; }
            if (rfCxSum('p') > 0) o.e = rfCxSum('p'); if (!(o.e > 0)) o.e = 0.2; if (!(o.ge > 0)) o.ge = 0.2;   // épaisseur = somme des couches du complexe
            const z0 = hasZ(base.points[0].z) ? base.points[0].z : 0;
            roofLast = Object.assign(roofLast, { pans: o.pans, rel: o.he - z0 / 1000, rise: o.hf - o.he, e: o.e, ge: o.ge, fill: o.fill, dir: o.dir, db: o.db, cxP: o.cxP }); delete roofLast.gab; try { localStorage.setItem('momocad-roof', JSON.stringify(roofLast)); } catch (e) {}
            closeTopoModal(); const out = buildRoof(base, o); if (!out) return;
            if (edit) shapes = shapes.filter(x => x.groupId !== edit.gid);
            shapes = shapes.filter(x => x !== base).concat(out); saveState(); setMode('select-box'); selectedShapes = out; draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            const nP = out.filter(x => x.solid && x.solid.kind === 'roof').length;
            updateCommandMessageText('TOITURE : ' + nP + ' pan(s)' + (o.pans === 4 ? ' (pente ' + nfr(out.find(x => x.solid && x.solid.kind === 'roof').solid.p, 0) + ' %)' : '') + ', égout ' + nfr(o.he, 2) + ' m, faîtage ' + nfr(o.hf, 2) + ' m, débord ' + nfr(o.db, 2) + ' m' + (o.fill ? ', pignons comblés' : '') + '. Elle forme un bloc : Y dessus pour la modifier (débord, hauteurs, textures). Vue 3D : bouton œil.');
        }
        // décalage d'un contour : d > 0 vers l'extérieur, d < 0 vers l'intérieur (monde) ; sommets en onglet
        function ringOffset(P, d) { const n = P.length, len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y), ar = P.reduce((a, q, i) => { const r = P[(i + 1) % n]; return a + q.x * r.y - r.x * q.y; }, 0), sgn = ar > 0 ? -1 : 1;
            const lines = P.map((a, i) => { const b = P[(i + 1) % n], L = len(a, b) || 1, nx = -(b.y - a.y) / L * sgn, ny = (b.x - a.x) / L * sgn; return { a: { x: a.x + nx * d, y: a.y + ny * d }, d: { x: (b.x - a.x) / L, y: (b.y - a.y) / L } }; });
            return P.map((q, i) => { const l1 = lines[(i - 1 + n) % n], l2 = lines[i], den = l1.d.x * l2.d.y - l1.d.y * l2.d.x; if (Math.abs(den) < 1e-12) return l2.a; const t = ((l2.a.x - l1.a.x) * l2.d.y - (l2.a.y - l1.a.y) * l2.d.x) / den; return { x: l1.a.x + l1.d.x * t, y: l1.a.y + l1.d.y * t }; }); }
        // TOIT TERRASSE : dalle plane (avec casquette), acrotère tout autour, forme de pente vers le côté d'évacuation, flèche de pente cotée en plan
        function roofLayerId() { return ensureLayer('Toiture', '#c2410c'); }
        function buildTerrace(base, o) { base = Object.assign({}, base, { layerId: roofLayerId() });   // la toiture sur son calque
            const P = base.points.map(q => ({ x: q.x, y: q.y })), n = P.length, gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), Zt = o.he * 1000, out = [];
            const sty = { layerId: base.layerId, color: base.color, dash: base.dash, width: base.width, hatch: false, zk: 1, groupId: gid };
            const Pd = o.tc > 0 ? ringOffset(P, mmToWorld(o.tc * 1000)) : P;
            const def = { base: base.points.map(q => ({ x: q.x, y: q.y, z: q.z })), o: JSON.parse(JSON.stringify(o)) };
            const slab = Object.assign({ type: 'poly', points: Pd.map(q => ({ x: q.x, y: q.y, z: Zt - o.te * 1000 })), solid: { kind: 'box', H: o.te * 1000 }, name: 'Dalle de toit', roofDef: def }, sty); slab.roofP0 = slab.points.map(q => ({ x: q.x, y: q.y })); if (o.texu) slab.tex = o.texu; out.push(slab);
            // acrotère dans l'alignement des murs (sur leur contour, épaisseur vers l'intérieur) ; la casquette dépasse au-delà
            const inner = o.ah > 0 ? ringOffset(P, -mmToWorld(o.at * 1000)) : P;
            if (o.ah > 0) out.push(Object.assign({ type: 'poly', points: P.map(q => ({ x: q.x, y: q.y, z: Zt })), solid: { kind: 'box', H: o.ah * 1000, holes: [inner.map(q => ({ x: q.x, y: q.y, z: Zt }))] }, name: 'Acrotère' }, sty));
            if (o.fp > 0) {   // forme de pente : coin posé sur la dalle, épaisseur mini côté évacuation, plus épais en s'éloignant
                const eg = Math.max(0, Math.min(n - 1, o.tg || 0)), a = inner[eg], b = inner[(eg + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, c = polyCentroid(inner);
                let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L; if ((c.x - a.x) * nx + (c.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
                const zT = (q) => Zt + o.fe * 1000 + (o.ct || 0) * 1000 + Math.max(0, worldToMm((q.x - a.x) * nx + (q.y - a.y) * ny)) * o.fp / 100, M = (q, z) => [worldToMm(q.x), -worldToMm(q.y), z], t = [];
                earClip(inner).forEach(([i, j, k]) => { const A = inner[i], B = inner[j], C = inner[k]; t.push(...M(A, zT(A)), ...M(B, zT(B)), ...M(C, zT(C)), ...M(A, Zt), ...M(C, Zt), ...M(B, Zt)); });
                for (let i = 0; i < n; i++) { const A = inner[i], B = inner[(i + 1) % n]; t.push(...M(A, Zt), ...M(B, Zt), ...M(B, zT(B)), ...M(A, Zt), ...M(B, zT(B)), ...M(A, zT(A))); }
                const g = meshFromTris(t, { layerId: base.layerId, color: base.color }); g.name = 'Forme de pente'; g.groupId = gid; g.roofPart = 1; if (o.ttex) g.tex = o.ttex; out.push(g);
                // flèche de pente en plan : du point haut vers le côté d'évacuation, avec la pente en %
                let far = inner[0], fd = -1; inner.forEach(q => { const dd = (q.x - a.x) * nx + (q.y - a.y) * ny; if (dd > fd) { fd = dd; far = q; } });
                const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, k2 = 0.75, hi = { x: m.x + nx * fd * k2, y: m.y + ny * fd * k2 }, lo = { x: m.x + nx * fd * 0.15, y: m.y + ny * fd * 0.15 };
                out.push({ type: 'slope', layerId: DIM_LAYER_ID, x1: hi.x, y1: hi.y, x2: lo.x, y2: lo.y, z1: zT(hi), z2: zT(lo), zk: 1, groupId: gid });
            } else if ((o.ct || 0) > 0) { const c2 = Object.assign({ type: 'poly', points: inner.map(q => ({ x: q.x, y: q.y, z: Zt })), solid: { kind: 'box', H: o.ct * 1000 }, name: 'Complexe d\'étanchéité' }, sty); if (o.ttex) c2.tex = o.ttex; out.push(c2); }
            else if (o.ttex) slab.tex = o.ttex;
            return out;
        }
        // squelette droit pondéré (toit à pans multiples) : chaque côté du contour monte à la même pente (poids 1) ou reste vertical (poids 0 : pignon)
        // renvoie { faces: [pour chaque côté i : polygone (monde) qui commence par ses deux sommets, ou null], T: hauteur maxi (distance monde) }
        function roofSkeleton(P0, W) {
            const n = P0.length; if (n < 3) return null;
            const ar = P0.reduce((a, q, i) => { const r = P0[(i + 1) % n]; return a + q.x * r.y - r.x * q.y; }, 0), ccw = ar > 0;
            // travail en sens trigo : index interne k → côté d'origine
            const P = ccw ? P0.slice() : P0.slice().reverse(), orig = (k) => ccw ? k : (2 * n - 2 - k) % n;   // côté k (P[k]→P[k+1]) = côté d'origine
            const E = P.map((a, k) => { const b = P[(k + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, d = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; return { a, d, nx: -d.y, ny: d.x, w: W ? (W[orig(k)] ? 1 : 0) : 1 }; });
            const ext = Math.max(...P.map(q => Math.abs(q.x)), ...P.map(q => Math.abs(q.y)), 1), eps = ext * 1e-9;
            const nodes = [], arcs = [];
            const node = (x, y, t) => { for (const N of nodes) if (Math.abs(N.x - x) < ext * 1e-7 && Math.abs(N.y - y) < ext * 1e-7) return N.id; nodes.push({ id: nodes.length, x, y, t }); return nodes.length - 1; };
            P.forEach(q => nodes.push({ id: nodes.length, x: q.x, y: q.y, t: 0 }));
            const vel = (ei, eo) => { const A = E[ei], B = E[eo], det = A.nx * B.ny - A.ny * B.nx;
                if (Math.abs(det) < 1e-9) { const w = (A.w + B.w) / 2; return { x: A.nx * w, y: A.ny * w }; }
                return { x: (A.w * B.ny - B.w * A.ny) / det, y: (A.nx * B.w - B.nx * A.w) / det }; };
            const mk = (x, y, ei, eo, nd) => { const v = vel(ei, eo); return { x, y, ei, eo, nd, vx: v.x, vy: v.y }; };
            let lavs = [P.map((q, k) => mk(q.x, q.y, (k - 1 + n) % n, k, k))], T = 0;
            const arc = (a, b, e1, e2) => { if (a !== b) arcs.push({ a, b, e: [e1, e2] }); };
            const reflex = (V) => { const A = E[V.ei].d, B = E[V.eo].d; return A.x * B.y - A.y * B.x < -1e-12; };
            const close = (L, X, Y) => { const nd = node(X, Y, T); L.forEach(V => arc(V.nd, nd, V.ei, V.eo)); };
            for (let guard = 0; guard < 20 * n + 50 && lavs.length; guard++) {
                // nettoyage : listes de moins de 3 sommets
                lavs = lavs.filter(L => { if (L.length >= 3) return true; if (L.length === 2) { const [a, b] = L, na = node(a.x, a.y, T), nb = node(b.x, b.y, T); arc(a.nd, na, a.ei, a.eo); arc(b.nd, nb, b.ei, b.eo); arc(na, nb, a.ei, a.eo); } return false; });
                if (!lavs.length) break;
                let best = null;
                lavs.forEach((L, li) => { const m = L.length;
                    for (let i = 0; i < m; i++) { const u = L[i], v = L[(i + 1) % m], d = E[u.eo].d, L0 = (v.x - u.x) * d.x + (v.y - u.y) * d.y, rate = (v.vx - u.vx) * d.x + (v.vy - u.vy) * d.y;
                        if (rate < -1e-12) { const dt = Math.max(0, -L0 / rate); if (!best || dt < best.dt - eps) best = { dt, kind: 'edge', li, i }; } }
                    for (let i = 0; i < m; i++) { const v = L[i]; if (!reflex(v)) continue;
                        for (let j = 0; j < m; j++) { const p = L[j], q = L[(j + 1) % m]; if (p === v || q === v) continue; const e = E[p.eo];
                            const c0 = (v.x - e.a.x) * e.nx + (v.y - e.a.y) * e.ny - e.w * T, den = v.vx * e.nx + v.vy * e.ny - e.w; if (den > -1e-12) continue; const dt = -c0 / den; if (dt < -eps) continue;
                            const hx = v.x + v.vx * dt, hy = v.y + v.vy * dt, px = p.x + p.vx * dt, py = p.y + p.vy * dt, qx = q.x + q.vx * dt, qy = q.y + q.vy * dt, sl = (qx - px) * e.d.x + (qy - py) * e.d.y, s = ((hx - px) * e.d.x + (hy - py) * e.d.y) / (sl || 1e-30);
                            if (!(sl > eps) || s < -1e-7 || s > 1 + 1e-7) continue;
                            if (!best || dt < best.dt - eps) best = { dt: Math.max(0, dt), kind: 'split', li, i, j }; } } });
                if (!best) { lavs.forEach(L => { const c = L.reduce((a, V) => ({ x: a.x + V.x / L.length, y: a.y + V.y / L.length }), { x: 0, y: 0 }); close(L, c.x, c.y); }); break; }
                lavs.forEach(L => L.forEach(V => { V.x += V.vx * best.dt; V.y += V.vy * best.dt; })); T += best.dt;
                const L = lavs[best.li], m = L.length;
                if (best.kind === 'edge') { const u = L[best.i], v = L[(best.i + 1) % m], X = (u.x + v.x) / 2, Y = (u.y + v.y) / 2, nd = node(X, Y, T);
                    arc(u.nd, nd, u.ei, u.eo); arc(v.nd, nd, v.ei, v.eo); const w = mk(X, Y, u.ei, v.eo, nd);
                    if (m === 3) { const z = L[(best.i + 2) % m]; const nz = node(z.x, z.y, T); arc(z.nd, nz, z.ei, z.eo); if (nz !== nd) arc(nz, nd, z.ei, z.eo); lavs.splice(best.li, 1); continue; }
                    const R = L.filter(V => V !== u && V !== v), k = best.i + 1 < m ? best.i : 0; L.splice(0, m, ...(best.i + 1 < m ? L.slice(0, best.i).concat([w], L.slice(best.i + 2)) : [w].concat(L.slice(1, m - 1))));
                } else { const v = L[best.i], p = L[best.j], q = L[(best.j + 1) % m], nd = node(v.x, v.y, T); arc(v.nd, nd, v.ei, v.eo);
                    const v1 = mk(v.x, v.y, v.ei, p.eo, nd), v2 = mk(v.x, v.y, p.eo, v.eo, nd), at = (x) => L.indexOf(x), A = [], B = [];
                    // L1 : v1, q … précédent de v ; L2 : v2, suivant de v … p
                    for (let k = at(q); L[k] !== v; k = (k + 1) % m) A.push(L[k]); for (let k = (at(v) + 1) % m; ; k = (k + 1) % m) { B.push(L[k]); if (L[k] === p) break; }
                    lavs.splice(best.li, 1, [v1].concat(A), [v2].concat(B)); }
            }
            // faces : pour chaque côté, chemin de son sommet de fin à son sommet de début par les arcs qui le bordent
            const faces = P0.map(() => null); let Tm = 0; nodes.forEach(N => { Tm = Math.max(Tm, N.t); });
            for (let k = 0; k < n; k++) { if (!E[k].w) continue; const adj = new Map(), add = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); };
                arcs.forEach(A => { if (A.e[0] === k || A.e[1] === k) { add(A.a, A.b); add(A.b, A.a); } });
                const s = (k + 1) % n, goal = k, path = [goal, s]; let cur = s, prev = goal, ok = false;
                for (let g = 0; g < 4 * nodes.length; g++) { const nx = (adj.get(cur) || []).filter(x => x !== prev); if (!nx.length) break; const nb = nx.includes(goal) && path.length > 2 ? goal : nx[0]; if (nb === goal) { ok = true; break; } if (path.includes(nb)) break; path.push(nb); prev = cur; cur = nb; }
                if (!ok) continue; const poly = path.map(id => ({ x: nodes[id].x, y: nodes[id].y }));
                faces[orig(k)] = ccw ? poly : [poly[1], poly[0]].concat(poly.slice(2).reverse()); }
            return { faces, T: Tm };
        }
        function buildRoof(base, o) { base = Object.assign({}, base, { layerId: roofLayerId() });   // la toiture sur son calque
            const P = base.points.map(q => ({ x: q.x, y: q.y })), n = P.length, Hf = o.hf * 1000, gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
            let He = o.he * 1000;
            const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            const pan = (poly, eg) => {
                const a = poly[eg], b = poly[(eg + 1) % poly.length], L = len(a, b) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
                const depth = Math.max(...poly.map(q => Math.abs((q.x - a.x) * nx + (q.y - a.y) * ny)));
                return { type: 'poly', layerId: base.layerId, points: poly.map(q => ({ x: q.x, y: q.y, z: He })), color: base.color, dash: base.dash, width: base.width, hatch: false, zk: 1, groupId: gid, solid: { kind: 'roof', H: 0, p: (Hf - He) / worldToMm(depth) * 100, e: o.e * 1000, eg } };
            };
            // 2 pans sur un quadrilatère quelconque : même pente des deux côtés, le faîtage passe là où les deux pans sont à égale distance
            // de leur égout (bissectrice) ; sur un rectangle c'est la ligne médiane, sur un trapèze le faîtage monte là où le toit s'élargit
            const ridgeOn = (a, b, E1, E2) => { const dl = (q, A, B) => { const L = len(A, B) || 1; return Math.abs((q.x - A.x) * (B.y - A.y) - (q.y - A.y) * (B.x - A.x)) / L; };
                const f0 = dl(a, E1[0], E1[1]) - dl(a, E2[0], E2[1]), f1 = dl(b, E1[0], E1[1]) - dl(b, E2[0], E2[1]), t = Math.abs(f0 - f1) < 1e-12 ? 0.5 : Math.max(0.02, Math.min(0.98, f0 / (f0 - f1)));
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
            const twoPans = (Q, along0) => { const R = along0 ? Q : [Q[1], Q[2], Q[3], Q[0]], E1 = [R[0], R[1]], E2 = [R[2], R[3]];
                const M1 = ridgeOn(R[3], R[0], E1, E2), M2 = ridgeOn(R[1], R[2], E1, E2); return [pan([R[0], R[1], M2, M1], 0), pan([M1, M2, R[2], R[3]], 2)]; };
            // pans multiples : un pan par côté (croupes), ou pignon sur les côtés choisis ; même pente partout, le faîtage au point le plus haut
            const panP = (poly, p) => ({ type: 'poly', layerId: base.layerId, points: poly.map(q => ({ x: q.x, y: q.y, z: He })), color: base.color, dash: base.dash, width: base.width, hatch: false, zk: 1, groupId: gid, solid: { kind: 'roof', H: 0, p, e: o.e * 1000, eg: 0 } });
            const multi = (Q) => { const S = roofSkeleton(Q, Q.map((q, i) => !(o.gab || [])[i])); if (!S || S.faces.some((F, i) => !F && !(o.gab || [])[i])) return null; return S; };
            let pans, pM = 0;
            if (o.pans === 4) { const S = multi(P); if (!S || !(S.T > 0)) { alert('Ce contour ne donne pas de toit à pans : vérifiez qu\'il ne se recoupe pas et qu\'il reste au moins un côté en pan.'); return null; }
                pM = (Hf - He) / worldToMm(S.T) * 100; pans = S.faces.map(F => F && panP(F, pM)).filter(Boolean); }
            else if (o.pans === 2 && n === 4) {
                const l0 = len(P[0], P[1]) + len(P[2], P[3]), l1 = len(P[1], P[2]) + len(P[3], P[0]), along0 = o.dir === 'short' ? l0 < l1 : l0 >= l1;
                pans = twoPans(P, along0);
            } else pans = [pan(P, Math.max(0, Math.min(n - 1, o.eg || 0)))];
            // débord : le toit est reconstruit sur le contour agrandi, même pente, égout plus bas ; les pignons restent sur le contour des murs
            let outPans = pans;
            if (o.db > 0) {
                const dW = mmToWorld(o.db * 1000), ar = P.reduce((a, q, i) => { const r = P[(i + 1) % n]; return a + q.x * r.y - r.x * q.y; }, 0), sgn = ar > 0 ? -1 : 1;
                const lines = P.map((a, i) => { const b = P[(i + 1) % n], L = len(a, b) || 1, nx = -(b.y - a.y) / L * sgn, ny = (b.x - a.x) / L * sgn; return { a: { x: a.x + nx * dW, y: a.y + ny * dW }, d: { x: (b.x - a.x) / L, y: (b.y - a.y) / L } }; });
                const P2 = P.map((q, i) => { const l1 = lines[(i - 1 + n) % n], l2 = lines[i], den = l1.d.x * l2.d.y - l1.d.y * l2.d.x; if (Math.abs(den) < 1e-12) return l2.a; const t = ((l2.a.x - l1.a.x) * l2.d.y - (l2.a.y - l1.a.y) * l2.d.x) / den; return { x: l1.a.x + l1.d.x * t, y: l1.a.y + l1.d.y * t }; });
                const slope = (pans[0].solid.p || 0) / 100, He0 = He; He = He0 - o.db * 1000 * slope;
                if (o.pans === 4) { const S2 = multi(P2); outPans = S2 ? S2.faces.map(F => F && panP(F, pM)).filter(Boolean) : pans; }
                else if (o.pans === 2 && n === 4) { const l0 = len(P[0], P[1]) + len(P[2], P[3]), l1 = len(P[1], P[2]) + len(P[3], P[0]), along0 = o.dir === 'short' ? l0 < l1 : l0 >= l1;
                    outPans = twoPans(P2, along0); }
                else outPans = [pan(P2, Math.max(0, Math.min(n - 1, o.eg || 0)))];
                He = He0;
            }
            const def = { base: base.points.map(q => ({ x: q.x, y: q.y, z: q.z })), o: JSON.parse(JSON.stringify(o)) };
            outPans.forEach(pn => { pn.roofDef = def; pn.roofP0 = pn.points.map(q => ({ x: q.x, y: q.y })); if (o.tex) pn.tex = o.tex; if (o.texu) pn.texU = o.texu; });
            const out = outPans.slice();
            if (o.fill) {
                // pignons : sous chaque côté qui n'est ni l'égout ni le faîtage, du haut des murs (égout) au dessous du pan
                const C = polyCentroid(P), t = [], thick = mmToWorld(o.ge * 1000), M = (q, z) => [worldToMm(q.x), -worldToMm(q.y), z];
                const prism = (F, d) => {
                    const B = F.map(v => [v[0] + d[0], v[1] + d[1], v[2]]), k = F.length, cx = [0, 1, 2].map(j => (F.reduce((s, v) => s + v[j], 0) + B.reduce((s, v) => s + v[j], 0)) / (2 * k));
                    const tri = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], g = [(a[0] + b[0] + c[0]) / 3 - cx[0], (a[1] + b[1] + c[1]) / 3 - cx[1], (a[2] + b[2] + c[2]) / 3 - cx[2]];
                        if (nn[0] * g[0] + nn[1] * g[1] + nn[2] * g[2] < 0) t.push(...a, ...c, ...b); else t.push(...a, ...b, ...c); };
                    for (let i = 1; i < k - 1; i++) { tri(F[0], F[i], F[i + 1]); tri(B[0], B[i], B[i + 1]); }
                    for (let i = 0; i < k; i++) { const j = (i + 1) % k; tri(F[i], F[j], B[j]); tri(F[i], B[j], B[i]); }
                };
                pans.forEach(pn => {
                    const Q = pn.points, m = Q.length, eg = pn.solid.eg, rise = roofRise(pn);
                    for (let i = 0; i < m; i++) {
                        if (i === eg) continue; const j = (i + 1) % m, ra = rise[i], rb = rise[j]; if (ra < 1 && rb < 1) continue;
                        const a = Q[i], b = Q[j], onOuter = P.some((q, k2) => { const q2 = P[(k2 + 1) % n], l = len(q, q2) || 1; return t2SegDist(a, q, q2) < l * 1e-6 + 1e-6 && t2SegDist(b, q, q2) < l * 1e-6 + 1e-6; });
                        if (!onOuter) continue;   // côté intérieur (faîtage entre deux pans)
                        const L = len(a, b) || 1; let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L; if ((C.x - a.x) * nx + (C.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
                        const F = [M(a, He), M(b, He)]; if (rb >= 1) F.push(M(b, He + rb)); if (ra >= 1) F.push(M(a, He + ra));
                        prism(F, [worldToMm(nx * thick), -worldToMm(ny * thick)]);
                    }
                });
                if (t.length) { const g = meshFromTris(t, { layerId: base.layerId, color: base.color }); g.name = 'Pignons'; g.groupId = gid; g.roofPart = 1; out.push(g); }
            }
            return out;
        }
        // ---- Pans de toiture : solide 'roof' sur un contour ; égout = côté bas (index), pente p (%), épaisseur e (mm) ----
        function roofEave(s) { const P = s.points, n = P.length; let i = s.solid.eg; if (!(i >= 0 && i < n)) { let best = 0, bl = -1; for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y); if (l > bl) { bl = l; best = k; } } i = best; } return i; }
        // hauteur de la sous-face au-dessus de l'égout, pour chaque sommet (mm)
        function roofRise(s) {
            const P = s.points, n = P.length, i = roofEave(s), a = P[i], b = P[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
            const c = polyCentroid(P), sg = Math.sign((c.x - a.x) * nx + (c.y - a.y) * ny) || 1, p = (s.solid.p || 0) / 100;
            return P.map(q => Math.max(0, worldToMm(((q.x - a.x) * nx + (q.y - a.y) * ny) * sg)) * p);
        }
        function roofMesh(so, P, z0, exag) {
            const B = so.points.map(q => P(q.x, q.y)), n = B.length, rise = roofRise(so), e = (so.solid.e || 200) / 1000 * exag, pos = [];
            const lo = rise.map(r => z0 + r / 1000 * exag), hi = lo.map(z => z + e);
            const tri = (a, za, b, zb, c, zc) => pos.push(a.x, a.y, za, b.x, b.y, zb, c.x, c.y, zc);
            const ccw = B.reduce((acc, q, i) => { const r = B[(i + 1) % n]; return acc + q.x * r.y - r.x * q.y; }, 0) > 0;
            const f = THREE.ShapeUtils.triangulateShape(B.map(q => new THREE.Vector2(q.x, q.y)), []);
            // dessus (couverture) d'abord, puis dessous et rives (sous-face de l'avancée) : deux groupes, deux textures possibles
            f.forEach(([a, b, c]) => { if (ccw) tri(B[a], hi[a], B[b], hi[b], B[c], hi[c]); else tri(B[c], hi[c], B[b], hi[b], B[a], hi[a]); });
            const nTop = pos.length / 3;
            f.forEach(([a, b, c]) => { if (ccw) tri(B[c], lo[c], B[b], lo[b], B[a], lo[a]); else tri(B[a], lo[a], B[b], lo[b], B[c], lo[c]); });
            for (let i = 0; i < n; i++) { const j = (i + 1) % n, [a, b] = ccw ? [i, j] : [j, i]; tri(B[a], lo[a], B[b], lo[b], B[b], hi[b]); tri(B[a], lo[a], B[b], hi[b], B[a], hi[a]); }
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
            g.addGroup(0, nTop, 0); g.addGroup(nTop, pos.length / 3 - nTop, 1); return g;
        }
        function drawRoof2D(ctx, s, col, dx, dy, ls) {
            const P = s.points, n = P.length, i = roofEave(s), a = P[i], b = P[(i + 1) % n];
            ctx.save(); ctx.strokeStyle = col; ctx.setLineDash([]); ctx.lineWidth = 3 / ls; ctx.beginPath(); ctx.moveTo(a.x + dx, a.y + dy); ctx.lineTo(b.x + dx, b.y + dy); ctx.stroke();
            const rise = roofRise(s), top = rise.indexOf(Math.max(...rise)), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const c = polyCentroid(P); let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L; if ((c.x - a.x) * nx + (c.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
            const len = Math.min(L * 0.4, Math.abs((P[top].x - a.x) * nx + (P[top].y - a.y) * ny) * 0.8), h = 8 / ls, tip = { x: m.x + nx * len * 0.15, y: m.y + ny * len * 0.15 }, tail = { x: m.x + nx * len, y: m.y + ny * len };
            ctx.lineWidth = 1.2 / ls; ctx.beginPath(); ctx.moveTo(tail.x + dx, tail.y + dy); ctx.lineTo(tip.x + dx, tip.y + dy); ctx.moveTo(tip.x + dx + (nx * h + ny * h * 0.6), tip.y + dy + (ny * h - nx * h * 0.6)); ctx.lineTo(tip.x + dx, tip.y + dy); ctx.lineTo(tip.x + dx + (nx * h - ny * h * 0.6), tip.y + dy + (ny * h + nx * h * 0.6)); ctx.stroke();
            ctx.fillStyle = col; ctx.font = (11 / ls) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(nfr(s.solid.p || 0, 0) + ' %', tail.x + dx + nx * 10 / ls, tail.y + dy + ny * 10 / ls);
            ctx.restore();
        }
        // =====================================================================
        // MANIPULATION 3D : Élever (ΔZ), Poser sur (empiler), Incliner (autour de X / Y)
        // =====================================================================
        // décale en hauteur un objet (mm) ; renvoie true s'il a une altitude
        function shiftZ(s, dz) {
            let ok = false; const zz = (o, k) => { if (hasZ(o[k])) { o[k] += dz; ok = true; } };
            if (s.sweep) { s.sweep.dz = (+s.sweep.dz || 0) + dz; return true; }   // balayage : décalage du profil, le tracé garde ses Z
            if (s.type === 'mesh') { s.z0 = (+s.z0 || 0) + dz; return true; }
            if (s.wallMat && s.wz) { zz(s.wz, 'b'); zz(s.wz, 't'); return ok; }
            if (s.type === 'point' || s.type === 'circle' || s.type === 'arc') zz(s, 'z');
            else if (s.type === 'line') { zz(s, 'z1'); zz(s, 'z2'); }
            else if (s.type === 'poly') s.points.forEach(q => zz(q, 'z'));
            if (ok) delete s.elev;
            return ok;
        }
        // hauteur propre d'un solide (mm)
        function solidHeight(s) { const so = s.solid, k = so.kind, r = s.type === 'circle' ? worldToMm(s.r) : 0;
            return k === 'roof' ? Math.max(...roofRise(s)) + (so.e || 200) : k === 'sphere' ? 2 * r : k === 'torus' ? 2 * (so.a || 0) : k === 'rev' ? Math.max(...(so.prof || [[0, 0]]).map(q => q[1])) : (so.H || 0); }
        function objMinZ(s) {
            if (s.solid) return solidBaseZ(s);
            if (s.sweep) { const G = sweepGeomCached(s); return G ? arrMin([].concat(...G.rings.map(R => R[0].map(q => q.Z)))) : undefined; }
            if (s.type === 'mesh') return s.z0; if (s.wallMat && s.wz) return s.wz.b;
            const z = shapeVertices(s).map(v => v.get()).filter(hasZ); return z.length ? arrMin(z) : undefined;
        }
        function objTopZ(s) {
            if (s.solid) return solidBaseZ(s) + solidHeight(s);
            if (s.sweep) { const G = sweepGeomCached(s); return G ? arrMax([].concat(...G.rings.map(R => R[0].map(q => q.Z)))) : undefined; }
            if (s.type === 'mesh') return s.z0 + (s.bb ? s.bb.h * (s.sc || 1) : 0); if (s.wallMat && s.wz) return s.wz.t;
            const z = shapeVertices(s).map(v => v.get()).filter(hasZ); return z.length ? arrMax(z) : undefined;
        }
        // ---- Élever ----
        function openElevate() {
            const S = selectedShapes.filter(x => !isBg(x)); if (!S.length) { setMode('elevate'); return; }
            openTopoModal('↕ Élever', `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb">
                <div class="mf-fig"><svg width="96" height="70" viewBox="0 0 96 70"><rect x="10" y="40" width="40" height="22" fill="none" stroke="#6b7280" stroke-dasharray="3 2"/><rect x="10" y="10" width="40" height="22" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/><path d="M72 58V14M66 21l6-8 6 8" fill="none" stroke="#fbbf24" stroke-width="2"/><text x="80" y="40" font-size="11" fill="#fbbf24" font-family="sans-serif">ΔZ</text></svg>
                    <div class="mf-hint" style="margin:0"><b>${S.length}</b> objet(s) sélectionné(s). Déplacement vertical : positif vers le haut, négatif vers le bas.</div></div>
                ${MF.row('Déplacement ΔZ <span class="mf-hint">(ex. 0,50 ou -1,20)</span>', MF.num('el-dz', '', '0,00'), 'm')}
                ${MF.hint('Volumes, balayages, maillages, murs 3D, points et traits cotés montent ou descendent ensemble. Les objets sans altitude (2D) ne bougent pas.')}</div>`,
                [['Annuler', closeTopoModal, false], ['Élever', applyElevate, true]]);
            const i = document.getElementById('el-dz'); setTimeout(() => i.focus(), 30); i.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyElevate(); } e.stopPropagation(); });
        }
        function applyElevate() {
            const v = parseFloat(String((document.getElementById('el-dz') || {}).value || '').replace(/\s/g, '').replace(',', '.'));
            if (!isFinite(v) || !v) { closeTopoModal(); return; }
            let n = 0, k = 0; selectedShapes.filter(x => !isBg(x)).forEach(s => { k++; if (shiftZ(s, v * 1000)) n++; });
            closeTopoModal(); if (n) { invalidateCache(); saveState(); } selectedShapes = []; if (is3DOpen()) { build3DScene(); render3D(); } else setMode('select-box'); draw(); updatePropertiesPopup();
            updateCommandMessageText('ÉLEVER : ' + n + ' objet(s) ' + (v > 0 ? 'montés' : 'descendus') + ' de ' + nfr(Math.abs(v), 3) + ' m' + (k > n ? ' (' + (k - n) + ' sans altitude, inchangés)' : '') + '.');
        }
        // ---- Poser sur ----
        let stackObjs = null;
        function startStack() { setMode('stack'); stackObjs = selectedShapes.filter(x => !isBg(x)); if (!stackObjs.length) stackObjs = null; updateCommandMessage(); draw(); }
        function stackClick(w) {
            if (!stackObjs) { const t = findShapeAt(w.x, w.y) || closedAt(w, x => !!x.solid); if (!t || isBg(t)) { updateCommandMessageText('POSER SUR : cliquez l\'objet à poser.'); return; } stackObjs = [t]; selectedShapes = [t]; updateCommandMessage(); draw(); return; }
            const sup = closedAt(w, x => !!x.solid && !stackObjs.includes(x)) || (() => { const t = findShapeAt(w.x, w.y); return t && !stackObjs.includes(t) && !isBg(t) ? t : null; })();
            let top = sup ? objTopZ(sup) : undefined, what = sup ? (sup.solid ? SOLID_NAMES[sup.solid.kind] : isPlateforme(sup) ? 'plateforme' : 'objet') : '';
            if (!hasZ(top)) { const t = getTIN(), z = t ? tinZ(w.x, w.y, t) : undefined; if (hasZ(z)) { top = z; what = 'terrain'; } }
            if (!hasZ(top)) { updateCommandMessageText('POSER SUR : rien d\'altitude connue ici — cliquez un volume, une plateforme ou le terrain.'); return; }
            let n = 0; stackObjs.forEach(s => { const z0 = objMinZ(s); if (hasZ(z0) && shiftZ(s, top - z0)) n++; });
            if (n) { invalidateCache(); saveState(); } const done = stackObjs; stackObjs = null; setMode('select-box'); selectedShapes = done; draw(); updatePropertiesPopup();
            updateCommandMessageText('POSER SUR : ' + n + ' objet(s) posé(s) sur ' + what + ' à ' + fmtZ(top) + ' m.');
        }
        // ---- Incliner (solides) : rotation autour de l'axe X (est-ouest) et Y (nord-sud), pivot au centre de la base ----
        function startTilt() { const S = selectedShapes.filter(x => x.solid); if (S.length === 1) { selectedShapes = S; openSelectionParamModal(); setTimeout(() => { const e = document.getElementById('sp-tx'); if (e) { e.focus(); e.select(); } }, 60); return; } setMode('tilt'); }
        function tiltClick(w) { const t = closedAt(w, x => !!x.solid) || (() => { const f = findShapeAt(w.x, w.y); return f && f.solid ? f : null; })(); if (!t) { updateCommandMessageText('INCLINER : cliquez un volume.'); return; } setMode('select-box'); selectedShapes = [t]; draw(); setTimeout(() => { openSelectionParamModal(); const e = document.getElementById('sp-tx'); if (e) { e.focus(); e.select(); } }, 30); }
        const tiltOf = (s) => (s.solid && s.solid.tilt && (s.solid.tilt.x || s.solid.tilt.y)) ? s.solid.tilt : null;
        // rotation d'un point (mm, repère plan) autour du pivot
        function tiltPt(q, pv, t) {
            const ax = (t.x || 0) * Math.PI / 180, ay = (t.y || 0) * Math.PI / 180;
            let x = q.X - pv.X, y = q.Y - pv.Y, z = q.Z - pv.Z;
            let y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax); y = y1; z = z1;
            let x1 = x * Math.cos(ay) + z * Math.sin(ay); z1 = -x * Math.sin(ay) + z * Math.cos(ay); x = x1; z = z1;
            return { X: x + pv.X, Y: y + pv.Y, Z: z + pv.Z };
        }
        function solidPivot(s) { const c = s.type === 'circle' ? { x: s.x, y: s.y } : polyCentroid(s.points); return { X: worldToMm(c.x), Y: -worldToMm(c.y), Z: solidBaseZ(s) || 0 }; }
        // points caractéristiques d'un solide (mm) pour son emprise inclinée en plan
        function solidSamples(s) {
            const so = s.solid, k = so.kind, z0 = solidBaseZ(s) || 0, H = solidHeight(s), out = [];
            if (s.type === 'poly') { const P = s.points.map(q => ({ X: worldToMm(q.x), Y: -worldToMm(q.y) })), c = polyCentroid(s.points), C = { X: worldToMm(c.x), Y: -worldToMm(c.y) }, t = k === 'pyr' ? Math.max(0, Math.min(1, so.k || 0)) : 1;
                P.forEach(q => { out.push({ X: q.X, Y: q.Y, Z: z0 }); out.push({ X: C.X + (q.X - C.X) * t, Y: C.Y + (q.Y - C.Y) * t, Z: z0 + H }); }); return out; }
            const cx = worldToMm(s.x), cy = -worldToMm(s.y), r = worldToMm(s.r), ring = (rr, z) => { for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24; out.push({ X: cx + rr * Math.cos(a), Y: cy + rr * Math.sin(a), Z: z }); } };
            if (k === 'sphere') { for (let j = 0; j <= 6; j++) { const ph = Math.PI * j / 6; ring(r * Math.sin(ph), z0 + r - r * Math.cos(ph)); } }
            else if (k === 'torus') { const a = so.a || 0; ring(r + a, z0 + a); ring(Math.max(0, r - a), z0 + a); ring(r, z0); ring(r, z0 + 2 * a); }
            else if (k === 'cone') { ring(r, z0); out.push({ X: cx, Y: cy, Z: z0 + H }); }
            else if (k === 'tcone') { ring(r, z0); ring(Math.min(r, so.r2 || 0), z0 + H); }
            else if (k === 'rev') { (so.prof || []).forEach(q => ring(q[0], z0 + q[1])); }
            else { ring(r, z0); ring(r, z0 + H); }
            return out;
        }
        function hull2(pts) {
            const P = pts.slice().sort((a, b) => a.X - b.X || a.Y - b.Y); if (P.length < 3) return P;
            const cr = (o, a, b) => (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X), lo = [], up = [];
            for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
            for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
            up.pop(); lo.pop(); return lo.concat(up);
        }
        // emprise en plan d'un solide incliné (contour de sa projection)
        function tiltFootprint(s) { const t = tiltOf(s); if (!t) return null; const pv = solidPivot(s); return hull2(solidSamples(s).map(q => tiltPt(q, pv, t))).map(q => ({ x: mmToWorld(q.X), y: -mmToWorld(q.Y) })); }
        function drawTilt2D(ctx, s, col, dx, dy, ls) {
            const F = tiltFootprint(s); if (!F || F.length < 3) return;
            ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.2 / ls; ctx.setLineDash([6 / ls, 3 / ls, 1.5 / ls, 3 / ls]); ctx.beginPath();
            F.forEach((q, i) => i ? ctx.lineTo(q.x + dx, q.y + dy) : ctx.moveTo(q.x + dx, q.y + dy)); ctx.closePath(); ctx.stroke(); ctx.restore();
        }
        // 3D : rotation du maillage autour du pivot (en mètres, repère de la scène)
        function tiltGeom3D(g, s, P, Zm) {
            const t = tiltOf(s); if (!t) return; const pv = solidPivot(s), c = P(mmToWorld(pv.X), -mmToWorld(pv.Y)), z = Zm(pv.Z);
            g.translate(-c.x, -c.y, -z); if (t.x) g.rotateX(t.x * Math.PI / 180); if (t.y) g.rotateY(t.y * Math.PI / 180); g.translate(c.x, c.y, z);
        }
        // ---- sélection dans la vue 3D : clic sur un objet ----
        function pick3D(e) {
            if (!V3 || !V3.root) return; const cv = V3.renderer.domElement, r = cv.getBoundingClientRect();
            const ray = new THREE.Raycaster(), m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(m, V3.camera);
            const hits = ray.intersectObjects(V3.root.children, true), hit = hits.find(h => h.object.userData && (h.object.userData.shape || h.object.userData.opening));
            const op = hit && hit.object.userData.opening ? hit.object.userData.opening : null, opHost = op ? shapes.find(x => (x.openings || []).includes(op)) : null;
            const s = op ? opHost : hit ? hit.object.userData.shape : null; V3.pickOp = op && opHost ? { host: opHost, o: op } : null;
            if (texPaint) { const hp = hits.find(h => h.object.userData && (h.object.userData.shape || h.object.userData.paroiOf));
                if (hp && hp.object.userData.paroiOf) { paroiPaint(hp.object.userData.paroiOf); return; }
                if (texPaint.kind === 'paint') { const H = v3BrushHit(e), zp = H && H.n.z > 0.6 ? brushZoneAt(H.q.x, H.q.y) : null; if (zp && (!s || isPlateforme(s))) { brushZoneRepaint(zp, texPaint.tex); return; } }
                if (s) texApply(s); return; }
            if (e.shiftKey && s) selectedShapes = selectedShapes.includes(s) ? selectedShapes.filter(x => x !== s) : selectedShapes.concat([s]);
            else selectedShapes = s ? [s] : [];
            build3DScene(); render3D(); updatePropertiesPopup(); updateCommandMessage();
            if (s) updateCommandMessageText('VUE 3D : ' + selKind().t + ' sélectionné — Y pour le régler, ou choisissez Élever, Poser sur, Incliner.');
        }
