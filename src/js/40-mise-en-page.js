        // =====================================================================
        // MISE EN PAGE (PRÉSENTATIONS) : des feuilles (onglets ; format, cartouche… dans le menu ⚙ de chacune) sur lesquelles on trace des fenêtres.
        // Chaque fenêtre montre le plan à une échelle normalisée (1:S), vue de dessus ou une vue de la rosace.
        // Fenêtre active (double-clic, ou clic avec un outil de dessin) : on y dessine normalement, molette = échelle.
        // Papier en mm, origine en haut à gauche ; à l'écran : lpCam (px par mm, décalage).
        // =====================================================================
        const LP_SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
        let lpDefaults = { paper: 'A1', orient: 'landscape', cartouche: true, margin: 10 };
        try { Object.assign(lpDefaults, JSON.parse(localStorage.getItem('momocad-lp') || '{}')); } catch (e) {}
        const lpNew = () => ({ id: 'lp' + Math.random().toString(36).slice(2, 9), name: '', paper: lpDefaults.paper, orient: lpDefaults.orient, cartouche: lpDefaults.cartouche, cartType: lpDefaults.cartType || undefined, margin: lpDefaults.margin, folds: !!lpDefaults.folds, cart: {}, vps: [], paperShapes: [] });
        let layoutData = lpNew();
        let lpNoFill = false;
        let layoutOn = false, lpCam = { x: 0, y: 0, k: 1 }, lpActiveId = null, lpSelId = null, lpSaved = null, lpInner = false, lpInkFlag = false, lpTyped = '', lpDrag = null, lpVpStart = null;
        const lpVp = (id) => layoutData.vps.find(v => v.id === id) || null;

        // icônes des boutons de volets (traits nets, lisibles à toutes les tailles, à la place des émojis)
        const ICO_P = { trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', height: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' };
        const ICO = (k, n) => `<svg width="${n || 16}" height="${n || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${ICO_P[k] || ''}</svg>`;
        // ---- PLUSIEURS PRÉSENTATIONS : onglets sur la zone de dessin ; layoutData = la présentation ouverte ----
        let layouts = [layoutData], layoutIdx = 0; const lpHistById = {};
        function lpSync() {   // garde layoutData dans la liste (même s'il a été remplacé), donne un id et un nom à chacune
            if (!layouts.includes(layoutData)) { if (layouts[layoutIdx]) layouts[layoutIdx] = layoutData; else { layouts.push(layoutData); layoutIdx = layouts.length - 1; } }
            layoutIdx = layouts.indexOf(layoutData);
            layouts.forEach(L => { if (!L.id) L.id = 'lp' + Math.random().toString(36).slice(2, 9); if (!L.cart) L.cart = {}; if (!Array.isArray(L.vps)) L.vps = []; });
            return layouts; }
        const lpName = (L, i) => (L && L.name) || (i === 0 ? 'Plan de masse' : 'Présentation ' + (i + 1));
        function lpResetAll(L) { layoutData = L || lpNew(); layouts = [layoutData]; layoutIdx = 0; Object.keys(lpHistById).forEach(k => delete lpHistById[k]); lpPaperHist = { hist: [], step: -1 }; }
        function lpSwitch(i) {
            lpSync(); if (!layouts[i]) return; if (i === layoutIdx) { lpTabsRender(); return; }
            if (lp3D.id) lp3DLeave(); if (lpActiveId) lpLeaveVp(); lpEndCartEdit(true);
            const paper = lpSpace === 'paper'; if (paper) lpUseModel();
            lpHistById[layoutData.id] = lpPaperHist;
            layoutIdx = i; layoutData = layouts[i]; lpPaperHist = lpHistById[layoutData.id] || { hist: [], step: -1 };
            lpSelId = null; lpDrag = null; lpVpStart = null; selectedShapes = [];
            if (paper) lpUsePaper(); if (layoutOn) { lpFit(); lpApplyPaperCam(); }
            lpTabsRender(); if (lpMenuShown()) lpMenuRender();
            updateCommandMessageText('PRÉSENTATION ' + (i + 1) + ' : « ' + lpName(layoutData, i) + ' » — ' + layoutData.paper + ' ' + (layoutData.orient === 'landscape' ? 'paysage' : 'portrait') + ', ' + layoutData.vps.length + ' fenêtre(s).');
            draw(); }
        function lpAdd(copyOf) {
            lpSync(); const src = copyOf || layoutData; let L;
            if (copyOf) { L = JSON.parse(JSON.stringify(Object.assign({}, copyOf, { paperShapes: copyOf === layoutData ? lpPaperShapes() : (copyOf.paperShapes || []) }))); L.name = lpName(copyOf, layouts.indexOf(copyOf)) + ' (copie)'; }
            else { L = lpNew(); ['paper', 'orient', 'cartouche', 'cartType', 'margin', 'folds'].forEach(k => { L[k] = src[k]; }); L.name = 'Présentation ' + (layouts.length + 1); }
            L.id = 'lp' + Math.random().toString(36).slice(2, 9);
            const at = copyOf ? layouts.indexOf(copyOf) + 1 : layouts.length; layouts.splice(at, 0, L); layoutIdx = layouts.indexOf(layoutData);
            lpSwitch(at); return L; }
        // dossiers d'urbanisme : une présentation par pièce graphique, cartouche prérempli (titre de la pièce, phase, indice A), fenêtre du plan à l'échelle usuelle
        const LP_SETS = { pc: { ph: 'PC', nm: 'Permis de construire', P: [['PCMI1', 'Plan de situation du terrain', 'A3', 'landscape', 2000], ['PCMI2', 'Plan de masse', 'A3', 'landscape', 200], ['PCMI3', 'Plan en coupe du terrain et de la construction', 'A3', 'landscape', 100], ['PCMI4', 'Notice décrivant le terrain et le projet', 'A3', 'landscape', 0], ['PCMI5', 'Plan des façades et des toitures', 'A3', 'landscape', 100], ['PCMI6', 'Document graphique d\'insertion', 'A3', 'landscape', 0], ['PCMI7', 'Photographie de l\'environnement proche', 'A3', 'landscape', 0], ['PCMI8', 'Photographie de l\'environnement lointain', 'A3', 'landscape', 0]] },
            dp: { ph: 'DP', nm: 'Déclaration préalable', P: [['DP1', 'Plan de situation du terrain', 'A3', 'landscape', 2000], ['DP2', 'Plan de masse coté dans les 3 dimensions', 'A3', 'landscape', 200], ['DP3', 'Plan en coupe', 'A3', 'landscape', 100], ['DP4', 'Plan des façades et des toitures', 'A3', 'landscape', 100], ['DP5', 'Représentation de l\'aspect extérieur', 'A3', 'landscape', 0], ['DP6', 'Document graphique d\'insertion', 'A3', 'landscape', 0], ['DP7', 'Photographie de l\'environnement proche', 'A3', 'landscape', 0], ['DP8', 'Photographie du paysage lointain', 'A3', 'landscape', 0]] } };
        // ce que la pièce doit montrer (bloc de texte posé sur la feuille, à garder, modifier ou effacer)
        const LP_NEED = {
            PCMI1: 'Situer le terrain dans la commune.\n• Échelle de 1/5 000 à 1/25 000 environ\n• Nord, voies d\'accès, repères (mairie, église, carrefour…)\n• Angles de prise de vue des photos PCMI7 et PCMI8',
            PCMI2: 'Plan de masse coté dans les 3 dimensions.\n• Limites du terrain, cotes du terrain\n• Construction projetée et bâtiments existants (à garder, démolir)\n• Distances aux limites et aux autres constructions\n• Hauteurs, niveaux (altitudes)\n• Nord, échelle\n• Accès, stationnement\n• Raccordements aux réseaux (eau, électricité, eaux usées, eaux pluviales) ou assainissement individuel\n• Arbres gardés, abattus ou plantés\n• Points de vue des photos PCMI7, PCMI8 et du PCMI6',
            PCMI3: 'Coupe du terrain et de la construction.\n• Profil du terrain avant travaux (terrain naturel)\n• Profil après travaux (terrain fini, déblais et remblais)\n• Implantation de la construction sur ce profil\n• Hauteurs et niveaux (altitudes)\n• Repère de la coupe sur le plan de masse',
            PCMI4: 'Notice décrivant le terrain et le projet.\n1. État initial : terrain, construction, végétation, abords\n2. Le projet :\n• aménagement du terrain (ce qui est modifié ou supprimé)\n• implantation, organisation, composition et volume des constructions\n• traitement des constructions, clôtures, végétation et abords\n• matériaux et couleurs\n• traitement des espaces libres, plantations\n• accès au terrain, stationnement',
            PCMI5: 'Toutes les façades et les toitures.\n• Chaque façade, avec son orientation\n• Ouvertures, menuiseries, garde-corps\n• Matériaux et couleurs\n• Hauteurs (égout, faîtage) par rapport au terrain\n• État existant et état projeté si l\'on modifie une construction',
            PCMI6: 'Insertion du projet dans son environnement.\n• Vue du projet (photomontage ou perspective) avec les constructions voisines et le paysage\n• Aspect du terrain et des abords après travaux\n• Point de vue repéré sur le plan de masse',
            PCMI7: 'Photographie de l\'environnement proche.\n• Le terrain et ses abords immédiats (rue, constructions voisines)\n• Angle de prise de vue repéré sur le plan de situation et le plan de masse',
            PCMI8: 'Photographie de l\'environnement lointain.\n• Le terrain dans le paysage\n• Angle de prise de vue repéré sur le plan de situation et le plan de masse',
            DP1: 'Situer le terrain dans la commune.\n• Échelle de 1/5 000 à 1/25 000 environ\n• Nord, voies d\'accès, repères\n• Angles de prise de vue des photos DP7 et DP8',
            DP2: 'Plan de masse coté dans les 3 dimensions.\n• Limites du terrain\n• Construction projetée et constructions existantes\n• Distances aux limites, dimensions, hauteur\n• Nord, échelle\n• Raccordements aux réseaux si besoin\n• Points de vue des photos DP7, DP8 et du DP6',
            DP3: 'Coupe du terrain et de la construction (si le projet modifie le profil du terrain).\n• Profil du terrain avant et après travaux\n• Implantation de la construction sur ce profil\n• Hauteurs et niveaux',
            DP4: 'Façades et toitures (si le projet les crée ou les modifie).\n• État existant et état projeté\n• Ouvertures, menuiseries\n• Matériaux et couleurs\n• Hauteurs',
            DP5: 'Aspect extérieur de la construction après travaux.\n• Les modifications visibles (façades, toiture, clôture…)\n• Matériaux et couleurs',
            DP6: 'Insertion du projet dans son environnement (si le projet est visible depuis l\'espace public).\n• Photomontage ou perspective avec les constructions voisines\n• Point de vue repéré sur le plan de masse',
            DP7: 'Photographie de l\'environnement proche.\n• Le terrain et ses abords immédiats\n• Angle de prise de vue repéré sur le plan de situation et le plan de masse',
            DP8: 'Photographie du paysage lointain.\n• Le terrain dans le paysage\n• Angle de prise de vue repéré sur le plan de situation et le plan de masse' };
        const lpWrap = (t, n) => t.split('\n').flatMap(l => { const out = [], ind = /^(•|\d\.) /.test(l) ? '   ' : ''; let cur = ''; l.split(' ').forEach(w => { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = ind + w; } else cur = cur ? cur + ' ' + w : w; }); out.push(cur); return out; }).join('\n');
        function lpNeedShapes(code, x, y, w, lid) { const t = LP_NEED[code]; if (!t) return []; const fs = 3.5, n = Math.floor((w - 6) / (fs * 0.5)), body = code + ' — À FOURNIR\n\n' + lpWrap(t, n), h = body.split('\n').length * fs * 1.25 + 6, M = mmToWorld(1);
            return [{ type: 'poly', layerId: lid, points: [{ x: x * M, y: y * M }, { x: (x + w) * M, y: y * M }, { x: (x + w) * M, y: (y + h) * M }, { x: x * M, y: (y + h) * M }], closed: true, hatch: false, dash: 'dashed', lpNeed: code },
                { type: 'text', layerId: lid, x: (x + 3) * M, y: (y + 3 + fs) * M, content: body, lpNeed: code }]; }
        function lpAddSet(kind) { const K = LP_SETS[kind]; if (!K) return; lpSync(); const bb = getShapesBoundingBox(lpModelShapes().filter(s => !isBg(s))), first = layouts.length; let last = null;
            const lid = ensureLayer('Pièces à fournir', '#ffffff'), NL = layers.find(l => l.id === lid); if (NL && !(parseFloat(NL.textH) > 0)) NL.textH = '3.5'; const NW = 95;   /* textes de 3,5 mm sur la feuille */
            K.P.forEach(([code, title, paper, orient, sc]) => { const L = lpNew(); Object.assign(L, { paper, orient, cartouche: true, cartType: 'mini', margin: 10, folds: false, name: code + ' ' + title, cart: { planName: code + ' — ' + title, phase: K.ph, indice: 'A' } });
                const sz = PAPER_SIZES[paper], W = orient === 'landscape' ? sz[1] : sz[0], H = orient === 'landscape' ? sz[0] : sz[1], m = 10; L.paperShapes = lpNeedShapes(code, sc ? W - m - 5 - NW : m + 5, m + 5, sc ? NW : Math.min(160, W - 2 * m - 10), lid);   /* ce que la pièce doit montrer */
                if (sc) {
                    L.vps.push({ id: 'vp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), x: m + 5, y: m + 5, w: W - 2 * m - 15 - NW, h: H - 2 * m - 10 - (CART_H + 5), cx: bb ? bb.centerX : 0, cy: bb ? bb.centerY : 0, scale: LP_SCALES.find(t => t >= sc * 0.999) || sc, a: 0, e: 90, round: false }); }
                layouts.push(L); last = L; });
            layoutIdx = layouts.indexOf(layoutData); if (!layoutOn) toggleLayout(true); lpSwitch(first); if (lpMenuShown()) lpMenuRender();
            updateCommandMessageText(K.nm.toUpperCase() + ' : ' + K.P.length + ' présentations ajoutées (' + K.P[0][0] + ' à ' + K.P[K.P.length - 1][0] + '), cartouche rempli ; plans cadrés au 1:' + K.P.filter(x => x[4]).map(x => x[4]).join(', 1:') + '.'); return last; }
        function lpRemove(i) {
            lpSync(); const L = layouts[i]; if (!L) return; if (layouts.length < 2) { updateCommandMessageText('PRÉSENTATIONS : il en faut au moins une.'); return; }
            if (L === layoutData) lpSwitch(i > 0 ? i - 1 : 1);
            layouts.splice(layouts.indexOf(L), 1); delete lpHistById[L.id]; layoutIdx = layouts.indexOf(layoutData);
            lpTabsRender(); if (lpMenuShown()) lpMenuRender(); updateCommandMessageText('PRÉSENTATION « ' + lpName(L, i) + ' » supprimée.'); draw(); }
        function lpMove(i, d) { lpSync(); const j = i + d; if (j < 0 || j >= layouts.length) return; const t = layouts[i]; layouts[i] = layouts[j]; layouts[j] = t; layoutIdx = layouts.indexOf(layoutData); lpTabsRender(); if (lpMenuShown()) lpMenuRender(); }
        function lpTabsRender() {
            const el = document.getElementById('lp-tabs'); if (!el) return;
            if (!layoutOn) { el.style.display = 'none'; return; }
            lpSync(); el.style.display = 'flex'; const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            el.innerHTML = layouts.map((L, i) => '<button type="button" class="lp-tab' + (i === layoutIdx ? ' on' : '') + '" data-i="' + i + '" title="' + (i === layoutIdx ? 'Présentation ouverte — double-clic : renommer · clic droit : réglages' : 'Ouvrir cette présentation (double-clic : renommer)') + '">' + (i + 1) + '. ' + esc(lpName(L, i)) + '</button>').join('')
                + '<button type="button" class="lp-tab-add" title="Configurateur des présentations : en ajouter, régler format, orientation, cartouche, marge, pliage">+</button>'; }
        function lpRename(i, sx, sy) { lpSync(); const L = layouts[i]; if (!L) return;
            askText('Nom de la présentation (onglet ; c\'est aussi le titre du cartouche tant qu\'il n\'en a pas d\'autre)', lpName(L, i), sx, sy, (t) => { L.name = t.trim(); lpTabsRender(); if (lpMenuShown()) lpMenuRender(); draw(); }); }
        document.addEventListener('click', (e) => {
            const t = e.target.closest && e.target.closest('#lp-tabs button'); if (!t) return; e.preventDefault();
            if (t.classList.contains('lp-tab-add')) { lpMenuOpen(); return; }
            lpSwitch(+t.dataset.i); });
        document.addEventListener('dblclick', (e) => { const t = e.target.closest && e.target.closest('#lp-tabs .lp-tab'); if (!t) return; e.preventDefault(); const r = t.getBoundingClientRect(), h = canvas.getBoundingClientRect(); lpRename(+t.dataset.i, r.left - h.left, r.bottom - h.top + 6); });
        document.addEventListener('contextmenu', (e) => { const t = e.target.closest && e.target.closest('#lp-tabs .lp-tab'); if (!t) return; e.preventDefault(); lpSwitch(+t.dataset.i); lpMenuOpen(); });
        // ---- menu ⚙ des présentations : format, orientation, cartouche, marge, pliage de chacune ----
        let piDelAsk = -1;
        const lpMenuShown = () => { const o = document.getElementById('lp-menu'); return !!o && o.style.display === 'flex'; };
        function lpCartVal(L) { return L.cartouche ? ((L.cartType || cartoucheData.type) === 'a4' ? 'a4' : 'mini') : 'none'; }
        function lpThumb(L) { const sz = PAPER_SIZES[L.paper] || PAPER_SIZES.A1, land = L.orient === 'landscape', W = land ? sz[1] : sz[0], H = land ? sz[0] : sz[1], k = Math.min(46 / W, 30 / H), w = W * k, h = H * k, x = (50 - w) / 2, y = (32 - h) / 2, m = (+L.margin || 10) * k;
            let t = '<svg width="50" height="32" viewBox="0 0 50 32"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff" rx="1"/><rect x="' + (x + m) + '" y="' + (y + m) + '" width="' + Math.max(0, w - 2 * m) + '" height="' + Math.max(0, h - 2 * m) + '" fill="none" stroke="#6b7280" stroke-width=".5"/>';
            (L.vps || []).forEach(v => { t += '<rect x="' + (x + v.x * k) + '" y="' + (y + v.y * k) + '" width="' + v.w * k + '" height="' + v.h * k + '" fill="#bfdbfe" stroke="#2563eb" stroke-width=".4"/>'; });
            if (L.cartouche) { const cd = cartDims(W, H, L.margin, L.cartType); t += '<rect x="' + (x + w - m - cd.w * k) + '" y="' + (y + h - m - cd.h * k) + '" width="' + cd.w * k + '" height="' + cd.h * k + '" fill="#fde68a" stroke="#111" stroke-width=".4"/>'; }
            return t + '</svg>'; }
        function lpMenuRender() {
            const o = document.getElementById('lp-menu'); if (!o) return; lpSync(); const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            const opt = (v, cur, lab) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + lab + '</option>';
            let h = '<div class="lpm-card"><div class="lpm-head"><h3>⚙ Présentations</h3><button type="button" class="lpm-x" data-a="close" title="Fermer (Échap)">✕</button></div><div class="lpm-body"><div class="lpm-grid">'
                + ['', '', 'Nom (onglet)', 'Format', 'Orientation', 'Cartouche', 'Marge', 'Pliage', ''].map(t => '<div class="lpm-th">' + t + '</div>').join('');
            layouts.forEach((L, i) => { const cur = i === layoutIdx ? ' lpm-cur' : '', sz = PAPER_SIZES[L.paper] || PAPER_SIZES.A1, big = Math.min(sz[0], sz[1]) >= 419;
                h += '<div class="lpm-n' + cur + '" data-i="' + i + '"><span class="lpm-n">' + (i + 1) + '</span></div>'
                  + '<div class="' + cur + '" title="' + (L.vps || []).length + ' fenêtre(s)">' + lpThumb(L) + '</div>'
                  + '<div class="' + cur + '"><input type="text" data-i="' + i + '" data-f="name" value="' + esc(lpName(L, i)) + '"></div>'
                  + '<div><select data-i="' + i + '" data-f="paper">' + Object.keys(PAPER_SIZES).map(p => opt(p, L.paper, p)).join('') + '</select></div>'
                  + '<div><select data-i="' + i + '" data-f="orient">' + opt('portrait', L.orient, 'Portrait') + opt('landscape', L.orient, 'Paysage') + '</select></div>'
                  + '<div><select data-i="' + i + '" data-f="cart">' + opt('none', lpCartVal(L), 'Sans cartouche') + opt('mini', lpCartVal(L), 'Minimaliste 70 × 20') + opt('a4', lpCartVal(L), 'A4 grands plans' + (big ? '' : ' (A2 et +)')) + '</select></div>'
                  + '<div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" max="50" step="1" data-i="' + i + '" data-f="margin" value="' + (+L.margin || 10) + '" style="width:48px"><span class="lpm-sub">mm</span></div>'
                  + '<div><label class="lpm-ck" title="Traits de pliage au format A4 (feuilles A2 et plus)"><input type="checkbox" data-i="' + i + '" data-f="folds"' + (L.folds ? ' checked' : '') + '>' + (big ? 'oui' : '<span class="lpm-sub">A2 et +</span>') + '</label></div>'
                  + '<div class="lpm-act" data-row="' + i + '">' + (piDelAsk === i ? '<span class="lpm-ask">Supprimer ?</span><button type="button" class="lpm-txt lpm-yes" data-a="delok" data-i="' + i + '">Oui</button><button type="button" class="lpm-txt" data-a="delno" data-i="' + i + '">Non</button>'
                  : (i === layoutIdx ? '<span class="lpm-cur-b" title="Présentation affichée">ouverte</span>' : '<button type="button" class="lpm-txt" data-a="open" data-i="' + i + '" title="Ouvrir cette présentation">' + ICO('open', 15) + '</button>')
                  + '<button type="button" data-a="up" data-i="' + i + '" title="Monter (ordre des onglets)"' + (i ? '' : ' disabled') + '>' + ICO('up') + '</button><button type="button" data-a="down" data-i="' + i + '" title="Descendre"' + (i < layouts.length - 1 ? '' : ' disabled') + '>' + ICO('down') + '</button>'
                  + '<button type="button" data-a="dup" data-i="' + i + '" title="Dupliquer (fenêtres, textes de la feuille, cartouche)">' + ICO('copy') + '</button><button type="button" class="lpm-danger" data-a="del" data-i="' + i + '" title="Supprimer cette présentation"' + (layouts.length > 1 ? '' : ' disabled') + '>' + ICO('trash') + '</button>') + '</div>'; });
            h += '</div></div><div class="lpm-foot"><div style="display:flex;flex-direction:column;gap:6px"><label class="lpm-ck" title="Traits et textes nets à toutes les échelles, épaisseurs exactes en mm. Décoché : la feuille en image (plus léger sur un plan très chargé)."><input type="checkbox" data-f="lpvec"' + (printSettings.lpVec !== false ? ' checked' : '') + '> PDF vectoriel (toutes les présentations)</label>'
                + '<span class="lpm-sub">Le cartouche se remplit sur la feuille : un clic sur une case. Le titre suit le nom de l\'onglet tant qu\'on ne l\'a pas écrit.</span></div>'
                + '<div style="display:flex;gap:8px"><button type="button" class="lpm-btn" data-a="add" style="background:#065f46;border-color:#10b981">+ Nouvelle présentation</button><button type="button" class="lpm-btn" data-a="addpc" style="background:#1e3a8a;border-color:#3b82f6" title="Permis de construire (maison individuelle) : une présentation par pièce, PCMI1 à PCMI8, cartouche rempli">+ Nouveau PC</button><button type="button" class="lpm-btn" data-a="adddp" style="background:#4c1d95;border-color:#8b5cf6" title="Déclaration préalable : une présentation par pièce, DP1 à DP8, cartouche rempli">+ Nouvelle DP</button><button type="button" class="lpm-btn pri" data-a="close">Fermer</button></div></div></div>';
            o.innerHTML = h; }
        function lpMenuSet(i, f, el) {
            if (f === 'lpvec') { printSettings.lpVec = !!el.checked; try { localStorage.setItem('momocad-print', JSON.stringify(printSettings)); } catch (e) {} return; }
            const L = layouts[i]; if (!L) return;
            if (f === 'name') L.name = el.value.trim();
            else if (f === 'paper' || f === 'orient') L[f] = el.value;
            else if (f === 'margin') L.margin = Math.max(0, Math.min(50, parseFloat(String(el.value).replace(',', '.')) || 0));
            else if (f === 'folds') L.folds = !!el.checked;
            else if (f === 'cart') { if (el.value === 'none') L.cartouche = false; else { L.cartouche = true; L.cartType = el.value; } }
            if (L === layoutData) { lpDefaults = { paper: L.paper, orient: L.orient, cartouche: L.cartouche, cartType: L.cartType, margin: L.margin, folds: L.folds }; try { localStorage.setItem('momocad-lp', JSON.stringify(lpDefaults)); } catch (e) {}
                if (layoutOn && f !== 'name') { lpFit(); if (!lpActiveId) lpApplyPaperCam(); else { const A = lpVp(lpActiveId); if (A) lpApplyCam(A); } } }
            lpTabsRender(); if (f !== 'name') lpMenuRender(); draw(); }
        function lpMenuOpen() {
            lpSync(); piDelAsk = -1; let o = document.getElementById('lp-menu');
            if (!o) { o = document.createElement('div'); o.id = 'lp-menu'; document.body.appendChild(o);
                o.addEventListener('mousedown', (e) => { if (e.target === o) lpMenuClose(); });
                o.addEventListener('change', (e) => { const el = e.target; if (el && el.dataset && el.dataset.f) lpMenuSet(+el.dataset.i, el.dataset.f, el); });
                o.addEventListener('keydown', (e) => { const el = e.target; if (e.key === 'Enter' && el && el.dataset && el.dataset.f === 'name') { e.preventDefault(); el.blur(); } });
                o.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a, i = +b.dataset.i;
                    if (a === 'close') lpMenuClose(); else if (a === 'open') { if (!layoutOn) toggleLayout(true); lpSwitch(i); } else if (a === 'up') lpMove(i, -1); else if (a === 'down') lpMove(i, 1);
                    else if (a === 'dup') { lpSync(); lpAdd(layouts[i]); } else if (a === 'add') lpAdd(); else if (a === 'addpc') lpAddSet('pc'); else if (a === 'adddp') lpAddSet('dp');
                    else if (a === 'del') { piDelAsk = i; lpMenuRender(); } else if (a === 'delno') { piDelAsk = -1; lpMenuRender(); } else if (a === 'delok') { piDelAsk = -1; lpRemove(i); } }); }
            lpMenuRender(); o.style.display = 'flex'; }
        function lpMenuClose() { const o = document.getElementById('lp-menu'); if (!o) return; const ae = document.activeElement; if (ae && o.contains(ae)) ae.blur(); o.style.display = 'none'; draw(); }
        window.addEventListener('keydown', (e) => { if (!lpMenuShown()) return; if (e.key === 'Escape') { e.preventDefault(); lpMenuClose(); } e.stopPropagation(); }, true);   // menu ouvert : le clavier ne part pas au dessin
        // ---- CARTOUCHE À CASES : un clic sur une case de la feuille pour l'écrire ----
        // titre, indice, phase, tableau des indices : propres à la présentation ; logo, chantier, maîtres d'ouvrage / d'œuvre, conducteur, dessinateur : communs au projet
        const LP_CART_OWN = ['planName', 'indice', 'phase'];
        function lpCartSrc(L) { L = L || layoutData; const c = L.cart || {}, D = Object.assign({}, cartoucheData);
            D.planName = (c.planName != null && c.planName !== '') ? c.planName : (L.name || cartoucheData.planName || lpName(L, Math.max(0, layouts.indexOf(L))));
            if (c.indice != null) D.indice = c.indice; if (c.phase != null) D.phase = c.phase; if (Array.isArray(c.revisions)) D.revisions = c.revisions; return D; }
        function lpCartCells() {
            if (!layoutData.cartouche) return []; const P = lpPage(), cd = cartDims(P.W, P.H, P.m, layoutData.cartType), out = [];
            if (cd.a4) { const s = cd.w / CART_A4_W, X = P.W - P.m - cd.w, Y = P.H - P.m - cd.h, HH = cd.h / s;
                const C = (key, x, y, w, h, lab, multi) => out.push({ key, x: X + x * s, y: Y + y * s, w: w * s, h: h * s, lab, multi: !!multi });
                C('logo', 3, 4, 92, 74, 'Logo — cliquer pour choisir une image'); C('site', 98, 5, 107, 72, 'Chantier — adresse', 1); C('planName', 5, 82, 200, 36, 'Titre du plan', 1);
                C('moa', 5, 121, 100, 47, 'Maître d\'ouvrage', 1); C('moe', 105, 121, 100, 47, 'Maître d\'œuvre', 1);
                C('conducteur', 5, 170, 108, 7.5, 'Conducteur de travaux'); C('draftsmanName', 5, 177.5, 108, 7.5, 'Dessinateur'); C('indice', 113, 177.5, 45, 7.5, 'Indice'); C('phase', 158, 177.5, 47, 7.5, 'Phase (EXE, PRO, DCE…)');
                const t0 = 188, hh = 6, rh = (HH - 4 - t0 - hh) / (CART_REV_ROWS + 1), cx1 = 20, cx2 = 42;
                for (let i = 0; i < CART_REV_ROWS; i++) { const y = t0 + hh + rh * i; C('rev.' + i + '.ind', 5, y, cx1 - 5, rh, 'Indice, ligne ' + (i + 1)); C('rev.' + i + '.date', cx1, y, cx2 - cx1, rh, 'Date, ligne ' + (i + 1)); C('rev.' + i + '.txt', cx2, y, 205 - cx2, rh, 'Modifications, ligne ' + (i + 1)); }
            } else { const X = P.W - P.m - CART_W, Y = P.H - P.m - CART_H, r = CART_H / 4, Lg = CART_LOGO;
                const C = (key, x, y, w, h, lab) => out.push({ key, x: X + x, y: Y + y, w, h, lab, multi: false });
                C('logo', 0, 0, Lg, CART_H, 'Logo — cliquer pour choisir une image'); C('planName', Lg, 0, CART_W - Lg - 12, r, 'Nom du plan'); C('indice', CART_W - 12, 0, 12, r, 'Indice');
                C('clientName', Lg, r, CART_W - Lg, r, 'Client'); C('draftsmanName', Lg, 2 * r, CART_W - Lg, r, 'Dessinateur'); }
            return out; }
        function lpCartCellAt(sx, sy) { if (!layoutOn || lpActiveId) return null; const p = lpToMm(sx, sy); return lpCartCells().find(c => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) || null; }
        function lpCartGet(key) { const D = lpCartSrc();
            if (key.startsWith('rev.')) { const [, i, f] = key.split('.'); return ((D.revisions || [])[+i] || {})[f] || ''; }
            if (key === 'moa') return D.moa || D.clientName || ''; return D[key] || ''; }
        function lpCartSet(key, val) {
            val = String(val || '').split(/\r?\n/).map(x => x.replace(/\s+$/, '')).join('\n').trim();
            if (key.startsWith('rev.')) { const [, i, f] = key.split('.'); const L = layoutData; L.cart = L.cart || {}; const R = JSON.parse(JSON.stringify(lpCartSrc().revisions || []));
                while (R.length <= +i) R.push({}); R[+i][f] = val; while (R.length && !(R[R.length - 1].ind || R[R.length - 1].date || R[R.length - 1].txt)) R.pop(); L.cart.revisions = R; }
            else if (LP_CART_OWN.includes(key)) { layoutData.cart = layoutData.cart || {}; layoutData.cart[key] = val; }
            else { cartoucheData[key] = val; saveCartoucheData(); } }
        let lpCartEd = null;
        function lpEndCartEdit(ok) { const E = lpCartEd; if (!E) return; lpCartEd = null; if (ok && E.ta.value !== E.v0) { lpCartSet(E.cell.key, E.ta.value); updateCommandMessageText('CARTOUCHE : ' + E.cell.lab.replace(/ —.*$/, '') + (E.ta.value.trim() ? ' mis à jour.' : ' vidé.')); } E.ta.remove(); E.lab.remove(); draw(); }
        function lpCartEdit(cell) {
            lpEndCartEdit(true); if (cell.key === 'logo') { lpLogoPick(); return; }
            const host = canvas.parentElement, k = lpCam.k, ta = document.createElement('textarea'), lab = document.createElement('div'), v0 = lpCartGet(cell.key);
            const w = Math.max(cell.multi ? 220 : 150, cell.w * k), h = Math.max(cell.multi ? 74 : 28, cell.h * k), x = Math.max(4, Math.min(host.clientWidth - w - 4, lpCam.x + cell.x * k)), y = Math.max(22, Math.min(host.clientHeight - h - 40, lpCam.y + cell.y * k));
            ta.id = 'lp-cart-ed'; ta.value = v0; ta.placeholder = cell.lab; ta.spellcheck = false; ta.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (cell.multi ? '' : 'white-space:nowrap;overflow:hidden;');
            lab.id = 'lp-cart-lab'; lab.textContent = cell.lab + (cell.multi ? ' · Maj+Entrée : à la ligne' : '') + ' · Entrée : valider · Échap : annuler'; lab.style.left = x + 'px'; lab.style.top = (y - 19) + 'px';
            host.appendChild(lab); host.appendChild(ta); lab.style.left = Math.max(4, Math.min(x, host.clientWidth - lab.offsetWidth - 6)) + 'px'; lpCartEd = { cell, ta, lab, v0 };
            ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); lpEndCartEdit(false); } else if (e.key === 'Enter' && !(cell.multi && e.shiftKey)) { e.preventDefault(); lpEndCartEdit(true); }
                else if (e.key === 'Tab') { e.preventDefault(); const L = lpCartCells().filter(c => c.key !== 'logo'), j = L.findIndex(c => c.key === cell.key), n = L[(j + (e.shiftKey ? L.length - 1 : 1)) % L.length]; lpEndCartEdit(true); if (n) lpCartEdit(n); } });
            ta.addEventListener('blur', () => setTimeout(() => { if (lpCartEd && lpCartEd.ta === ta) lpEndCartEdit(true); }, 0));
            setTimeout(() => { ta.focus(); ta.select(); }, 0); draw(); }
        function lpLogoPick() {
            let inp = document.getElementById('lp-logo-input');
            if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'lp-logo-input'; inp.style.display = 'none'; document.body.appendChild(inp);
                inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (!f) return; const fr = new FileReader();
                    fr.onload = () => { const im = new Image(); im.onload = () => { const M = 600, r = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * r)); cv.height = Math.max(1, Math.round(im.naturalHeight * r));
                        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); lpSetLogo(cv.toDataURL('image/png')); updateCommandMessageText('CARTOUCHE : logo « ' + f.name + ' » posé (commun à toutes les présentations).'); };
                        im.src = fr.result; }; fr.readAsDataURL(f); inp.value = ''; }); }
            inp.click(); }
        function lpSetLogo(url) { cartoucheData.logo = url; saveCartoucheData(); logoImg = new Image(); logoImg.onload = () => draw(); logoImg.src = url; draw(); }
        // ---- poignées des fenêtres : 4 coins + 4 bords (rectangle), le pourtour (ronde) ; prises même un peu en dehors du cadre ----
        let lpHov = null;
        function lpHandlePts(v) { const r = lpRect(v); if (v.round) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2; return [[cx, cy - R, 8], [cx + R, cy, 8], [cx, cy + R, 8], [cx - R, cy, 8]]; }
            return [[r.x, r.y, 0], [r.x + r.w, r.y, 1], [r.x + r.w, r.y + r.h, 2], [r.x, r.y + r.h, 3], [r.x + r.w / 2, r.y, 4], [r.x + r.w, r.y + r.h / 2, 5], [r.x + r.w / 2, r.y + r.h, 6], [r.x, r.y + r.h / 2, 7]]; }
        function lpHandleAt(sx, sy) {
            if (!layoutOn) return null; const sel = lpVp(lpSelId), list = layoutData.vps.slice().reverse(); if (sel) { list.splice(list.indexOf(sel), 1); list.unshift(sel); }
            for (const v of list) { if (v.locked || v.id === lpActiveId || v.id === lp3D.id) continue; const r = lpRect(v), T = v.id === lpSelId ? 13 : 10;
                if (v.round) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2, d = Math.hypot(sx - cx, sy - cy); if (Math.abs(d - r.w / 2) <= T * 0.75) return { v, c: 8 }; continue; }
                const ci = lpHandlePts(v).slice(0, 4).find(([x, y]) => Math.hypot(sx - x, sy - y) <= T); if (ci) return { v, c: ci[2] };
                const E = T * 0.6, inX = sx > r.x && sx < r.x + r.w, inY = sy > r.y && sy < r.y + r.h;
                if (inX && Math.abs(sy - r.y) <= E) return { v, c: 4 }; if (inY && Math.abs(sx - (r.x + r.w)) <= E) return { v, c: 5 };
                if (inX && Math.abs(sy - (r.y + r.h)) <= E) return { v, c: 6 }; if (inY && Math.abs(sx - r.x) <= E) return { v, c: 7 }; }
            return null; }
        function lpHandleCursor(h, sx, sy) { if (!h) return ''; if (h.c === 8) { const r = lpRect(h.v), a = Math.atan2(sy - (r.y + r.h / 2), sx - (r.x + r.w / 2)) * 180 / Math.PI, q = ((Math.round(a / 45) % 4) + 4) % 4; return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][q]; }
            return ['nwse-resize', 'nesw-resize', 'nwse-resize', 'nesw-resize', 'ns-resize', 'ew-resize', 'ns-resize', 'ew-resize'][h.c]; }
        function lpDrawHandles(c, v, sel, hot) {
            c.save(); c.setLineDash([]); const s = sel ? 11 : 9;
            for (const [x, y, ci] of lpHandlePts(v)) { const on = hot === ci && (!v.round || hot === 8); c.fillStyle = on ? '#f59e0b' : sel ? '#1d74f5' : '#ffffff'; c.strokeStyle = on ? '#92400e' : '#1d4ed8'; c.lineWidth = 1.5;
                if (ci >= 4 && ci < 8) { c.beginPath(); c.arc(x, y, s / 2, 0, 7); c.fill(); c.stroke(); } else { c.fillRect(x - s / 2, y - s / 2, s, s); c.strokeRect(x - s / 2, y - s / 2, s, s); } }
            c.restore(); }
        // survol : poignée (curseur de redimensionnement) ou case du cartouche (curseur texte)
        function lpHover(sx, sy) {
            if (!layoutOn || lpActiveId || mode !== 'select-box' || isDrawing || lpDrag || lp3D.id) { if (lpHov) { lpHov = null; } return; }
            const h = lpHandleAt(sx, sy), cc = h ? null : lpCartCellAt(sx, sy), k0 = lpHov ? (lpHov.v ? lpHov.v.id + lpHov.c : lpHov.cell ? lpHov.cell.key : '') : '';
            lpHov = h ? { v: h.v, c: h.c } : cc ? { cell: cc } : null; canvas.style.cursor = h ? lpHandleCursor(h, sx, sy) : cc ? (cc.key === 'logo' ? 'pointer' : 'text') : 'default';
            const k1 = lpHov ? (lpHov.v ? lpHov.v.id + lpHov.c : lpHov.cell.key) : ''; return k0 !== k1; }
        // Deux espaces : le PLAN (modèle) et la FEUILLE (papier, 1 unité = 1 mm de feuille). En mise en page hors fenêtre active,
        // les outils dessinent sur la feuille : on échange le dessin, son historique (Ctrl+Z) et l'unité (mm).
        let lpSpace = 'model', lpModelStore = null, lpPaperHist = { hist: [], step: -1 }, lpVpTin = null, lpTopoClosed = false;
        function lpUsePaper() {
            if (lpSpace === 'paper') return;
            if (!Array.isArray(layoutData.paperShapes)) layoutData.paperShapes = [];
            lpModelStore = { shapes, hist: shapesHistory, step: historyStep, unit: printSettings.unit };
            shapes = layoutData.paperShapes; shapesHistory = lpPaperHist.hist; historyStep = lpPaperHist.step;
            if (historyStep < 0) { shapesHistory = [histEntry(JSON.stringify(shapes), JSON.stringify(layers), activeLayerId)]; historyStep = 0; }
            printSettings.unit = 'mm'; applyUnitSettings(); selectedShapes = []; lpSpace = 'paper'; lpVpTin = null; invalidateCache();
            lpModelStore.layer = activeLayerId; activeLayerId = ensureLayer('Mise en page', '#ffffff'); updateLayerUI();   // tracés de la feuille : calque « Mise en page »
        }
        function lpUseModel() {
            if (lpSpace !== 'paper') return;
            layoutData.paperShapes = shapes; lpPaperHist = { hist: shapesHistory, step: historyStep };
            shapes = lpModelStore.shapes; shapesHistory = lpModelStore.hist; historyStep = lpModelStore.step; printSettings.unit = lpModelStore.unit; applyUnitSettings();
            if (lpModelStore.layer && layers.some(l => l.id === lpModelStore.layer)) activeLayerId = lpModelStore.layer; updateLayerUI();
            lpModelStore = null; selectedShapes = []; lpSpace = 'model'; invalidateCache();
        }
        const lpModelShapes = () => lpSpace === 'paper' ? lpModelStore.shapes : shapes;
        const lpPaperShapes = () => lpSpace === 'paper' ? shapes : (layoutData.paperShapes || []);
        // exécute fn sur le PLAN (enregistrement, DXF, métré) même si l'on dessine sur la feuille
        function withModel(fn) {
            if (lpSpace !== 'paper') return fn();
            const ps = shapes, pu = printSettings.unit; shapes = lpModelStore.shapes; printSettings.unit = lpModelStore.unit; applyUnitSettings();
            try { return fn(); } finally { lpModelStore.shapes = shapes; shapes = ps; printSettings.unit = pu; applyUnitSettings(); }
        }
        function lpApplyPaperCam() { camera.zoom = lpCam.k / mmToWorld(1); camera.x = lpCam.x; camera.y = lpCam.y; }
        function lpFitView() { if (!layoutOn) return; lpFit(); const A = lpVp(lpActiveId); if (A) lpApplyCam(A); else lpApplyPaperCam(); draw(); }
        function lpTitlePt() { const P = lpPage(); return Math.round(10 * Math.max(1, Math.pow(Math.max(P.W, P.H) / 297, 0.8))); }   // 10 pt en A4 … ≈ 23 pt en A1
        function lpPage() { const sz = PAPER_SIZES[layoutData.paper] || PAPER_SIZES.A1, land = layoutData.orient === 'landscape'; return { W: land ? sz[1] : sz[0], H: land ? sz[0] : sz[1], m: +layoutData.margin || 10 }; }
        function lpFit() { const P = lpPage(), k = Math.min((canvas.width - 60) / P.W, (canvas.height - 100) / P.H); lpCam = { k, x: (canvas.width - P.W * k) / 2, y: (canvas.height - P.H * k) / 2 + 14 }; }
        const lpToMm = (sx, sy) => ({ x: (sx - lpCam.x) / lpCam.k, y: (sy - lpCam.y) / lpCam.k });
        const lpRect = (v) => ({ x: lpCam.x + v.x * lpCam.k, y: lpCam.y + v.y * lpCam.k, w: v.w * lpCam.k, h: v.h * lpCam.k });
        const lpIsOrtho = (v) => Math.abs((v.e === undefined ? 90 : v.e) - 90) > 1e-6 || Math.abs((((v.a || 0) % 360) + 360) % 360) > 1e-6;
        const lpIn = (r, sx, sy) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
        const lpInV = (v, sx, sy) => { const r = lpRect(v); if (v.round) return Math.hypot(sx - (r.x + r.w / 2), sy - (r.y + r.h / 2)) <= r.w / 2; return lpIn(r, sx, sy); };
        const lpIsImg = (v) => v && v.kind === 'img';
        function lpVpAt(sx, sy) { for (let i = layoutData.vps.length - 1; i >= 0; i--) { const v = layoutData.vps[i]; if (lpInV(v, sx, sy)) return v; } return null; }
        // contour d'une fenêtre (rectangle ou cercle) comme chemin
        function lpPath(c, v, rx, ry, rw, rh) { c.beginPath(); if (v.round) c.arc(rx + rw / 2, ry + rh / 2, rw / 2, 0, 2 * Math.PI); else c.rect(rx, ry, rw, rh); }
        // texte le long d'un cercle (centré en haut, lisible de gauche à droite)
        function lpArcText(c, txt, cx, cy, R) {
            const W = c.measureText(txt).width, span = W / R; let a = -Math.PI / 2 - span / 2;
            c.save(); c.textAlign = 'center';
            for (const ch of txt) { const w = c.measureText(ch).width, am = a + w / 2 / R; c.save(); c.translate(cx + R * Math.cos(am), cy + R * Math.sin(am)); c.rotate(am + Math.PI / 2); c.fillText(ch, 0, 0); c.restore(); a += w / R; }
            c.restore();
        }
        const lpImgCache = {};
        function lpImg(v) { let im = lpImgCache[v.id]; if (!im || im._src !== v.src) { im = new Image(); im.onload = () => draw(); im.src = v.src; im._src = v.src; lpImgCache[v.id] = im; } return im.complete && im.naturalWidth ? im : null; }
        const lpScaleTxt = (S) => S >= 1 ? '1:' + (+S.toFixed(2)).toLocaleString('fr-FR') : (1 / S).toFixed(0) + ':1';
        // caméra du plan pour une fenêtre : k = px par mm de papier ; 1:S → zoom = k / (5 × S)
        function lpCamFor(v, k, rx, ry, rw, rh) {
            const z = k / (mmToWorld(1) * v.scale), cxs = rx + rw / 2, cys = ry + rh / 2;
            if (!lpIsOrtho(v)) return { zoom: z, x: cxs - v.cx * z, y: cys - v.cy * z };
            const su = mmToWorld(1) * z, pp = projUV(worldToMm(v.cx), -worldToMm(v.cy), v.cz || 0, v.a || 0, v.e === undefined ? 90 : v.e);
            return { zoom: z, x: cxs - pp.u * su + (v.ou || 0) * k, y: cys + pp.v * su + (v.ov || 0) * k };
        }
        function lpApplyCam(v) { const r = lpRect(v), c = lpCamFor(v, lpCam.k, r.x, r.y, r.w, r.h); camera.x = c.x; camera.y = c.y; camera.zoom = c.zoom; }
        function lpSyncFromCam(v) {   // panoramique fait dans la fenêtre active → centre de la fenêtre (sauf verrouillée)
            if (v.locked) return;
            const r = lpRect(v), c = lpCamFor(v, lpCam.k, r.x, r.y, r.w, r.h);
            if (Math.abs(camera.zoom - c.zoom) > 1e-9 * c.zoom) return;
            if (!lpIsOrtho(v)) { v.cx -= (camera.x - c.x) / c.zoom; v.cy -= (camera.y - c.y) / c.zoom; }
            else { v.ou = (v.ou || 0) + (camera.x - c.x) / lpCam.k; v.ov = (v.ov || 0) + (camera.y - c.y) / lpCam.k; }
        }
        // rendu « impression » d'une fenêtre (couleurs papier, épaisseur 1 = 0,25 mm)
        // point le plus « au milieu » d'un contour (le plus loin de ses bords) : la place de l'étiquette, même pour une forme en L ou en U
        function polyCentroidW(R) { const xs = R.map(p => p.x), ys = R.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), N = 24; let best = null, bd = -1;
            const dE = (x, y) => { let d = Infinity; for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0; d = Math.min(d, Math.hypot(a.x + t * dx - x, a.y + t * dy - y)); } return d; };
            for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const x = x0 + (x1 - x0) * (i + 0.5) / (N + 1), y = y0 + (y1 - y0) * (j + 0.5) / (N + 1); if (!pointInPolygon(x, y, R)) continue; const d = dE(x, y); if (d > bd) { bd = d; best = { x, y }; } }
            return best || { x: xs.reduce((t, v) => t + v, 0) / R.length, y: ys.reduce((t, v) => t + v, 0) / R.length }; }
        // calques propres à une fenêtre de mise en page : v.lv = { idCalque: visible } (les autres suivent le plan)
        function lpVpVis(v, l) { return v && v.lv && Object.prototype.hasOwnProperty.call(v.lv, l.id) ? !!v.lv[l.id] : l.visible !== false; }
        function lpVpLayers(v) { const L = lpSpace === 'paper' && lpModelStore && lpModelStore.layers ? lpModelStore.layers : layers, esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            const rows = L.map(l => `<label style="display:flex;align-items:center;gap:8px;padding:2px 0;cursor:pointer"><input type="checkbox" class="lpv-cb" data-id="${l.id}" ${lpVpVis(v, l) ? 'checked' : ''}><span style="width:12px;height:12px;border-radius:3px;background:${l.color || '#fff'};display:inline-block"></span><span>${esc((layGroupOf(l) ? layGroupOf(l) + ' › ' : '') + l.name)}</span>${l.visible === false ? '<span style="color:#6b7280;font-size:11px">(masqué dans le plan)</span>' : ''}</label>`).join('');
            openTopoModal('☰ Calques de la fenêtre' + (v.title ? ' « ' + esc(v.title) + ' »' : ''), `<div style="font-size:13px;color:#e5e7eb;min-width:320px;max-width:420px"><div style="color:#9ca3af;font-size:12px;margin-bottom:8px">Cochés : affichés dans cette fenêtre seulement. Les autres fenêtres et le plan ne changent pas.</div>
                <div style="display:flex;gap:6px;margin-bottom:6px"><button type="button" class="mf-btn" onclick="document.querySelectorAll('.lpv-cb').forEach(c=>c.checked=true)">Tout cocher</button><button type="button" class="mf-btn" onclick="document.querySelectorAll('.lpv-cb').forEach(c=>c.checked=false)">Tout décocher</button></div>
                <div style="max-height:52vh;overflow-y:auto">${rows}</div></div>`,
                [['Comme le plan', () => { delete v.lv; closeTopoModal(); saveState(); draw(); updateCommandMessageText('FENÊTRE : calques comme dans le plan.'); }, false], ['Annuler', () => closeTopoModal(), false],
                 ['Valider', () => { const lv = {}; document.querySelectorAll('.lpv-cb').forEach(c => { const l = L.find(x => x.id === c.dataset.id); if (l && c.checked !== (l.visible !== false)) lv[l.id] = c.checked; }); if (Object.keys(lv).length) v.lv = lv; else delete v.lv; closeTopoModal(); saveState(); draw();
                    updateCommandMessageText('FENÊTRE : ' + (v.lv ? Object.keys(v.lv).length + ' calque(s) réglé(s) pour cette fenêtre.' : 'calques comme dans le plan.')); }, true]]); }
        function lpRenderVp(tctx, v, k, rx, ry, rw, rh) {
            if (v && v.lv && !v._lvOn) { const L = lpSpace === 'paper' && lpModelStore && lpModelStore.layers ? lpModelStore.layers : layers, keepV = L.map(l => l.visible); v._lvOn = true;
                try { L.forEach(l => { l.visible = lpVpVis(v, l); }); return lpRenderVp(tctx, v, k, rx, ry, rw, rh); } finally { L.forEach((l, i) => { l.visible = keepV[i]; }); delete v._lvOn; } }
            const keep = { x: camera.x, y: camera.y, zoom: camera.zoom }, c = lpCamFor(v, k, rx, ry, rw, rh);
            camera.x = c.x; camera.y = c.y; camera.zoom = c.zoom;
            if (v.v3) { camera.x = keep.x; camera.y = keep.y; camera.zoom = keep.zoom; const im = lp3DImg(v); tctx.save(); lpPath(tctx, v, rx, ry, rw, rh); tctx.clip(); tctx.fillStyle = '#fff'; tctx.fillRect(rx, ry, rw, rh);
                if (im && im.complete && im.naturalWidth) { const r = Math.max(rw / im.naturalWidth, rh / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; tctx.drawImage(im, rx + (rw - w) / 2, ry + (rh - h) / 2, w, h); }
                tctx.restore(); return; }
            if (lpIsImg(v)) { camera.x = keep.x; camera.y = keep.y; camera.zoom = keep.zoom; const im = lpImg(v); if (im) { const r = Math.min(rw / im.naturalWidth, rh / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; tctx.drawImage(im, rx + (rw - w) / 2, ry + (rh - h) / 2, w, h); } return; }
            const kS = shapes, kT = tinCache; if (lpSpace === 'paper') { shapes = lpModelStore.shapes; tinCache = lpVpTin; }
            tctx.save(); lpPath(tctx, v, rx, ry, rw, rh); tctx.clip();
            try {
                if (lpIsOrtho(v)) { const kv = view2d, ks = selectedShapes; view2d = { a: v.a || 0, e: v.e }; selectedShapes = []; lpInkFlag = true; try { drawOrthoView(tctx); } finally { view2d = kv; selectedShapes = ks; lpInkFlag = false; } }
                else {
                    const fl = Math.max(0.25 * k, 0.8), f = REF_MM_PER_PX * k;
                    dimensionTextsToDraw = []; screenTextsToDraw = []; ptLabelGrid = new Set();
                    tctx.save(); tctx.translate(camera.x, camera.y); tctx.scale(camera.zoom, camera.zoom); dimMmW = k / camera.zoom;
                    // réglage « plateformes » : les points cotés sous une plateforme sont masqués, la cote de la plateforme est écrite en son milieu
                    const PF = v.plat ? shapes.filter(q => isPlateforme(q) && !q.gen && ((layers.find(x => x.id === (q.layerId || 'layer-0')) || {}).visible !== false)).map(q => { const R = platRing(q), xs = R.map(p => p.x), ys = R.map(p => p.y); return { q, R, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; }) : null;
                    const under = (x, y) => PF.some(P => x >= P.b[0] && x <= P.b[2] && y >= P.b[1] && y <= P.b[3] && pointInPolygon(x, y, P.R));
                    try { for (const s of shapesInDrawOrder()) { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue; if (PF && s.type === 'point' && under(s.x, s.y)) continue; drawSingleShape(tctx, s, true, false, 0, 0, camera.zoom / fl); }
                        if (PF) PF.forEach(P => { const S = platSurf(P.q), c = polyCentroidW(P.R); dimensionTextsToDraw.push({ worldX: c.x, worldY: c.y, text: platName(P.q) + ' · ' + (S.flat || Math.abs(S.zmax - S.zmin) < 1 ? fmtZ(S.zp) + ' m' : fmtZ(S.zmin) + ' à ' + fmtZ(S.zmax) + ' m'), layerId: P.q.layerId, color: (c => /^#f{3,6}$/i.test(c) ? '#000000' : c)(effectiveColor(P.q, true) || '#000000') }); });
                    } finally { dimMmW = null; }
                    tctx.restore();
                    drawAnnotations(tctx, worldToScreen, f, camera.zoom, true);
                }
            } finally { tctx.restore(); camera.x = keep.x; camera.y = keep.y; camera.zoom = keep.zoom; if (lpSpace === 'paper') { lpVpTin = tinCache; shapes = kS; tinCache = kT; } }
        }
        // dessin de la feuille (textes, traits hors fenêtres) en rendu impression, à l'échelle 1 (1 mm = 1 mm de feuille)
        function lpRenderPaper(tctx, ox, oy, k) {
            const list = lpPaperShapes(); if (!list.length) return;
            const keep = { x: camera.x, y: camera.y, zoom: camera.zoom }, kS = shapes, fl = Math.max(0.25 * k, 0.8), f = REF_MM_PER_PX * k;
            camera.zoom = k / mmToWorld(1); camera.x = ox; camera.y = oy; shapes = list;
            try {
                dimensionTextsToDraw = []; screenTextsToDraw = []; ptLabelGrid = new Set();
                tctx.save(); tctx.translate(camera.x, camera.y); tctx.scale(camera.zoom, camera.zoom); dimMmW = k / camera.zoom;
                try { for (const s of shapesInDrawOrder()) { const l = layers.find(x => x.id === (s.layerId || 'layer-0')); if (l && !l.visible) continue; drawSingleShape(tctx, s, true, false, 0, 0, camera.zoom / fl); } } finally { dimMmW = null; }
                tctx.restore(); drawAnnotations(tctx, worldToScreen, f, camera.zoom, true);
            } finally { shapes = kS; camera.x = keep.x; camera.y = keep.y; camera.zoom = keep.zoom; }
        }
        // cartouche (mêmes dimensions que l'impression rapide)
        function lpCartouche(tctx, cX, cY, k, D) { D = D || cartoucheData;
            const pt = (v) => v * 0.3528 * k, cW = CART_W * k, cH = CART_H * k, logoW = CART_LOGO * k, rowH = cH / 4;
            tctx.save(); tctx.setLineDash([]); tctx.fillStyle = '#fff'; tctx.fillRect(cX, cY, cW, cH); tctx.strokeStyle = '#000';
            tctx.lineWidth = Math.max(1, 0.35 * k); tctx.strokeRect(cX, cY, cW, cH);
            tctx.lineWidth = Math.max(0.5, 0.2 * k); tctx.beginPath(); tctx.moveTo(cX + logoW, cY); tctx.lineTo(cX + logoW, cY + cH);
            for (let i = 1; i <= 3; i++) { tctx.moveTo(cX + logoW, cY + rowH * i); tctx.lineTo(cX + cW, cY + rowH * i); } tctx.stroke();
            tctx.fillStyle = '#000'; tctx.font = pt(CART_FONT) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'left'; tctx.textBaseline = 'alphabetic';
            const ind = cartoucheIndice(D.indice || ''), indW = ind ? 11 * k : 0;
            const rows = [D.planName ? 'Plan : ' + D.planName : 'Plan :', 'Client : ' + (D.clientName || ''), 'Dessin : ' + (D.draftsmanName || ''), 'Échelle : ' + (layoutData.vps.some(v => !lpIsImg(v) && !v.v3) ? [...new Set(layoutData.vps.filter(v => !v.v3).filter(v => !lpIsImg(v)).map(v => lpScaleTxt(v.scale)))].join(', ') : '—')];
            rows.forEach((t, i) => tctx.fillText(t, cX + logoW + 1.2 * k, cY + rowH * i + rowH * 0.68, cW - logoW - 2.4 * k - (i === 0 ? indW : 0)));
            if (ind) { tctx.font = 'bold ' + pt(CART_FONT) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'right'; tctx.fillText(ind, cX + cW - 1.2 * k, cY + rowH * 0.68); }
            tctx.fillStyle = 'rgb(80,80,80)'; tctx.font = pt(CART_FONT - 1) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'right';
            tctx.fillText(new Date().toLocaleDateString('fr-FR'), cX + cW - 1.2 * k, cY + rowH * 3 + rowH * 0.68);
            const logo = getLogoImg();
            if (logo) { const lb = logoBox((CART_LOGO - 2) * k, logo); tctx.drawImage(logo, cX + k + lb.x, cY + k + lb.y, lb.w, lb.h); }
            tctx.restore();
        }
        // contenu de la feuille (cadre, fenêtres, échelles, cartouche) ; printing = rendu du fichier (toutes les fenêtres)
        function lpDrawSheet(tctx, ox, oy, k, printing) { lpSheetStart(tctx, ox, oy, k); for (const v of layoutData.vps) lpSheetVp(tctx, v, ox, oy, k, printing); lpSheetEnd(tctx, ox, oy, k, printing); }
        function lpSheetStart(tctx, ox, oy, k) { const P = lpPage();
            tctx.save(); tctx.setLineDash([]); tctx.strokeStyle = '#000'; tctx.lineWidth = Math.max(1, 0.5 * k);
            tctx.strokeRect(ox + P.m * k, oy + P.m * k, (P.W - 2 * P.m) * k, (P.H - 2 * P.m) * k); tctx.restore(); }
        function lpSheetVp(tctx, v, ox, oy, k, printing) { const pt = (q) => q * 0.3528 * k; {
                const rx = ox + v.x * k, ry = oy + v.y * k, rw = v.w * k, rh = v.h * k;
                if (printing || v.id !== lpActiveId) lpRenderVp(tctx, v, k, rx, ry, rw, rh);
                tctx.save(); tctx.setLineDash([]); tctx.strokeStyle = '#000'; tctx.lineWidth = Math.max(0.8, 0.25 * k);
                if (!v.noFrame) { lpPath(tctx, v, rx, ry, rw, rh); tctx.stroke(); }
                else if (!printing) { tctx.strokeStyle = 'rgba(37,99,235,.35)'; tctx.lineWidth = 1; tctx.setLineDash([4, 4]); lpPath(tctx, v, rx, ry, rw, rh); tctx.stroke(); tctx.setLineDash([]); }
                tctx.fillStyle = '#111'; tctx.font = 'bold ' + pt(lpTitlePt()) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'left'; tctx.textBaseline = 'alphabetic';
                const lab = lpIsImg(v) ? (v.title || '') : v.v3 ? (v.title ? v.title + ' — ' : '') + 'Vue 3D' : (v.title ? v.title + ' — ' : '') + 'Éch. ' + lpScaleTxt(v.scale) + (lpIsOrtho(v) ? ' — ' + viewName(v.a || 0, v.e) : '');
                if (lab) { if (v.round) lpArcText(tctx, lab, rx + rw / 2, ry + rh / 2, rw / 2 + 2 * k); else tctx.fillText(lab, rx, ry - 2 * k); }
                tctx.restore();
            } }
        function lpSheetEnd(tctx, ox, oy, k, printing) { const P = lpPage(), pt = (q) => q * 0.3528 * k;
            if (layoutData.cartouche) { const D = lpCartSrc(), cd = cartDims(P.W, P.H, P.m, layoutData.cartType), sv = layoutData.vps.filter(v => !lpIsImg(v) && !v.v3), sc = sv.length ? [...new Set(sv.map(v => lpScaleTxt(v.scale)))].join(', ') : '';
                if (cd.a4) drawCartA4(tctx, ox + (P.W - P.m - cd.w) * k, oy + (P.H - P.m - cd.h) * k, k, cartInfo(sc, layoutData.paper, D), cd.w, cd.h);
                else lpCartouche(tctx, ox + (P.W - P.m - CART_W) * k, oy + (P.H - P.m - CART_H) * k, k, D); }
            if (printing || lpSpace !== 'paper') lpRenderPaper(tctx, ox, oy, k);
            if (layoutData.folds && Math.min(P.W, P.H) >= 419) lpFoldMarks(tctx, ox, oy, k, P);
            const credit = layoutData.vps.length ? basemapCredit() : '';
            if (credit) { tctx.save(); tctx.fillStyle = 'rgb(110,110,110)'; tctx.font = pt(6) + 'px Helvetica, Arial, sans-serif'; tctx.textAlign = 'left'; tctx.fillText(credit, ox + (P.m + 2) * k, oy + (P.H - P.m - 2) * k); tctx.restore(); }
        }
        // traits de pliage (format A4 final, cartouche dessus) : plis verticaux à 210 mm du bord droit puis tous les 190 mm,
        // plis horizontaux tous les 297 mm depuis le bas ; repères de 8 mm sur les bords de la feuille
        // plis normalisés : 1er volet de 210 × 297 au coin bas-droite (là où est le cartouche A4), puis tous les 190 mm vers la gauche, tous les 297 mm vers le haut
        function lpFolds(P) { const xs = [], ys = []; for (let x = P.W - 210; x > 20; x -= 190) xs.push(x); for (let y = P.H - 297; y > 20; y -= 297) ys.push(y); return { xs, ys }; }
        function lpFoldMarks(c, ox, oy, k, P) {
            const { xs, ys } = lpFolds(P);
            c.save(); c.strokeStyle = '#000'; c.lineWidth = Math.max(0.8, 0.25 * k); c.setLineDash([]); c.beginPath();
            const L = 8;
            xs.forEach(x => { c.moveTo(ox + x * k, oy); c.lineTo(ox + x * k, oy + L * k); c.moveTo(ox + x * k, oy + P.H * k); c.lineTo(ox + x * k, oy + (P.H - L) * k); });
            ys.forEach(y => { c.moveTo(ox, oy + y * k); c.lineTo(ox + L * k, oy + y * k); c.moveTo(ox + P.W * k, oy + y * k); c.lineTo(ox + (P.W - L) * k, oy + y * k); });
            c.stroke(); c.restore();
        }
        function drawLayout() {
            const P = lpPage(), c = ctx, k = lpCam.k;
            c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#2b3038'; c.fillRect(0, 0, canvas.width, canvas.height);
            c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 18; c.shadowOffsetY = 4; c.fillStyle = '#fff'; c.fillRect(lpCam.x, lpCam.y, P.W * k, P.H * k); c.restore();
            lpDrawSheet(c, lpCam.x, lpCam.y, k, false);
            const A = lpVp(lpActiveId);
            if (!A && lpSpace === 'paper') {   // dessin sur la feuille : outils, accroches, poignées, aperçus
                lpApplyPaperCam();
                const pc = document.getElementById('prop-color'), keepPC = pc.value; if (/^#f{3}(f{3})?$/i.test(keepPC)) pc.value = '#000000';
                lpInner = true; lpInkFlag = true; lpNoFill = true;
                try { draw(); } finally { lpInner = false; lpInkFlag = false; lpNoFill = false; pc.value = keepPC; }
            }
            if (A) {   // fenêtre active : le plan est dessiné « en vrai » (outils, accroches, aperçus), sur papier blanc
                lpSyncFromCam(A); lpApplyCam(A);
                const r = lpRect(A);
                c.save(); lpPath(c, A, r.x, r.y, r.w, r.h); c.clip();
                if (lpIsOrtho(A)) { c.fillStyle = '#fff'; c.fillRect(r.x, r.y, r.w, r.h); c.restore(); lpRenderVp(c, A, k, r.x, r.y, r.w, r.h); c.save(); }
                else {
                    const pc = document.getElementById('prop-color'), keepPC = pc.value; if (/^#f{3}(f{3})?$/i.test(keepPC)) pc.value = '#000000';
                    lpInner = true; lpInkFlag = true;
                    try { draw(); } finally { lpInner = false; lpInkFlag = false; pc.value = keepPC; }
                }
                c.restore();
                c.save(); c.strokeStyle = A.locked ? '#f59e0b' : '#2563eb'; c.lineWidth = 2.5; c.setLineDash([]); if (A.round) { c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 + 1, 0, 7); c.stroke(); } else c.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); c.restore();
            }
            const Sv = lpVp(lpSelId);
            if (Sv && Sv !== A) { const r = lpRect(Sv); c.save(); c.strokeStyle = Sv.locked ? '#f59e0b' : '#ec4899'; c.lineWidth = 2; c.setLineDash([6, 4]); lpPath(c, Sv, r.x, r.y, r.w, r.h); c.stroke(); c.restore();
                if (!Sv.locked && Sv.id !== lp3D.id) lpDrawHandles(c, Sv, true, lpHov && lpHov.v === Sv ? lpHov.c : -1); }
            { const Hv = lpHov && lpHov.v; if (Hv && Hv !== Sv && Hv !== A) { const r = lpRect(Hv); c.save(); c.strokeStyle = 'rgba(29,116,245,.6)'; c.lineWidth = 1.5; lpPath(c, Hv, r.x, r.y, r.w, r.h); c.stroke(); c.restore(); lpDrawHandles(c, Hv, false, lpHov.c); } }
            { const Hc = (lpCartEd && lpCartEd.cell) || (lpHov && lpHov.cell); if (Hc && !A) { const x = lpCam.x + Hc.x * k, y = lpCam.y + Hc.y * k, w = Hc.w * k, h = Hc.h * k; c.save(); c.fillStyle = 'rgba(37,99,235,.12)'; c.fillRect(x, y, w, h); c.strokeStyle = '#2563eb'; c.lineWidth = 1.5; c.setLineDash([]); c.strokeRect(x, y, w, h);
                if (!lpCartEd) { const t = Hc.lab + (Hc.key === 'logo' ? '' : ' — clic pour écrire'); c.font = '12px sans-serif'; const tw = c.measureText(t).width; c.fillStyle = 'rgba(17,24,39,.92)'; c.fillRect(x, y - 22, tw + 12, 19); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(t, x + 6, y - 12.5); } c.restore(); } }
            if ((mode === 'lpvp' || mode === 'lpimg') && lpVpStart) { const a = { x: lpCam.x + lpVpStart.x * k, y: lpCam.y + lpVpStart.y * k }; c.save(); c.strokeStyle = '#2563eb'; c.lineWidth = 1.5; c.setLineDash([6, 4]); c.strokeRect(a.x, a.y, currentX_screen - a.x, currentY_screen - a.y); c.restore(); }
            if (mode === 'lpvpc' && lpVpStart) { const a = { x: lpCam.x + lpVpStart.x * k, y: lpCam.y + lpVpStart.y * k }; c.save(); c.strokeStyle = '#2563eb'; c.lineWidth = 1.5; c.setLineDash([6, 4]); c.beginPath(); c.arc(a.x, a.y, Math.hypot(currentX_screen - a.x, currentY_screen - a.y), 0, 7); c.stroke(); c.restore(); }
            lpDrawButtons(c);
            // rosace : vue de la fenêtre active / sélectionnée
            const tv = A || Sv, svg = document.getElementById('rose-svg');
            if (svg) { const a = tv ? (tv.a || 0) : 0, e = tv ? (tv.e === undefined ? 90 : tv.e) : 90, kk = 'lp|' + a + '|' + e; if (svg.dataset.k !== kk) { svg.dataset.k = kk; svg.innerHTML = roseSVG(a, e, '2d'); } }
            updateCursorCoords();
        }
        function toggleLayout(on) {
            on = on === undefined ? !layoutOn : !!on; if (on === layoutOn) return;
            if (on) {
                if (typeof is3DOpen === 'function' && is3DOpen()) close3D();
                if (isOrthoView()) { view2d = { a: 0, e: 90 }; view2dAnim = null; orthoCenterCamera(); }
                if (mode !== 'select-box') setMode('select-box');
                lpSaved = { x: camera.x, y: camera.y, zoom: camera.zoom }; layoutOn = true; lpActiveId = null; lpSelId = null; lpVpStart = null; selectedShapes = []; lpFit();
                lpUsePaper(); lpApplyPaperCam();
                const tp = document.querySelector('.pal[data-pal="topo"]'); if (tp) { lpTopoClosed = tp.classList.contains('closed'); tp.classList.add('closed', 'pal-locked'); }
                updateCommandMessageText(layoutData.vps.length ? 'MISE EN PAGE : dessinez et écrivez sur la feuille (1 mm = 1 mm) ; double-clic dans une fenêtre pour y travailler sur le plan (molette = échelle).' : 'MISE EN PAGE : tracez une fenêtre (palette Présentation ou FE + Espace), 2 coins sur la feuille ; elle se met à l\'échelle de ce que vous regardiez. Les outils dessinent sur la feuille, à l\'échelle 1.');
            } else {
                if (mode !== 'select-box') setMode('select-box'); isDrawing = false;
                lp3D.id = null; lp3D.drag = null; lpUseModel(); layoutOn = false; lpActiveId = null; lpSelId = null; lpVpStart = null; lpDrag = null;
                const tp = document.querySelector('.pal[data-pal="topo"]'); if (tp) { tp.classList.remove('pal-locked'); tp.classList.toggle('closed', lpTopoClosed); }
                if (lpSaved) { camera.x = lpSaved.x; camera.y = lpSaved.y; camera.zoom = lpSaved.zoom; }
                const svg = document.getElementById('rose-svg'); if (svg) svg.dataset.k = ''; updateRose();
                updateCommandMessageText('Retour au plan.');
            }
            document.getElementById('btn-layout').classList.toggle('lp-on', layoutOn); document.getElementById('pal-pres').classList.toggle('hidden', !layoutOn);
            if (!layoutOn) { lpEndCartEdit(true); lpHov = null; if (lpMenuShown()) lpMenuClose(); } lpTabsRender();
            draw();
        }
        // 3 boutons flottants par fenêtre (écran seulement) : nommer, verrouiller, cadre visible
        const LP_BTNS = [['lay', '☰', 'Calques de cette fenêtre : choisir ceux qu\'elle affiche (sans toucher aux autres fenêtres ni au plan)'], ['plat', 'Z', 'Plateformes : masque les points cotés sous les plateformes et écrit la cote de chaque plateforme'], ['v3d', '3D', 'Vue 3D / plan 2D : la fenêtre part du point de vue de la vue 3D ; double-clic dedans pour la piloter (tourner, déplacer, zoomer)'], ['name', '✎', 'Nommer la fenêtre (titre écrit avant l\'échelle)'], ['lock', '🔒', 'Verrouiller / déverrouiller (ni déplacement, ni taille, ni échelle, ni cadrage)'], ['frame', '▢', 'Afficher / masquer le cadre (à l\'impression)']];
        function lpBtnRects(v) { if (lpIsImg(v)) return lpBtnRects0(v).filter(b => b.id !== 'v3d' && b.id !== 'plat' && b.id !== 'lay'); if (v.v3) return lpBtnRects0(v).filter(b => b.id !== 'plat' && b.id !== 'lay'); return lpBtnRects0(v); }
        function lpBtnRects0(v) { const r = lpRect(v), s = 20, g = 3, x0 = r.x + r.w - LP_BTNS.length * s - (LP_BTNS.length - 1) * g, y0 = r.y - s - 4 - (v.round ? 0 : 0); return LP_BTNS.map((b, i) => ({ id: b[0], ico: b[1], tip: b[2], x: x0 + i * (s + g), y: y0, s })); }
        function lpDrawButtons(c) {
            if (lpInner) return;
            for (const v of layoutData.vps) {
                if (v.id === lp3D.id) { lpPlace3D(v); const r = lpRect(v); c.save(); c.strokeStyle = '#22d3ee'; c.lineWidth = 2.5; c.setLineDash([]); c.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);   // fenêtre 3D pilotée
                    const t = 'Vue 3D active : glisser = tourner · clic droit ou molette enfoncée = déplacer · molette = zoom · Échap = figer'; c.font = '12px sans-serif'; const tw = c.measureText(t).width; c.fillStyle = 'rgba(8,145,178,.92)'; c.fillRect(r.x, r.y + r.h + 4, tw + 12, 20); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(t, r.x + 6, r.y + r.h + 14); c.restore(); }
                lpBtnRects(v).forEach(b => {
                    const on = (b.id === 'lay' && v.lv && Object.keys(v.lv).length > 0) || (b.id === 'lock' && v.locked) || (b.id === 'frame' && !v.noFrame) || (b.id === 'name' && v.title) || (b.id === 'v3d' && v.v3) || (b.id === 'plat' && v.plat);
                    c.save(); c.fillStyle = on ? (b.id === 'lock' ? '#b45309' : '#1d4ed8') : 'rgba(31,41,55,.88)'; c.strokeStyle = '#6b7280'; c.lineWidth = 1;
                    c.beginPath(); c.roundRect ? c.roundRect(b.x, b.y, b.s, b.s, 4) : c.rect(b.x, b.y, b.s, b.s); c.fill(); c.stroke();
                    c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
                    if (b.id === 'lock') { c.strokeStyle = '#fff'; c.lineWidth = 1.4; const x = b.x + b.s / 2, y = b.y + b.s / 2; c.strokeRect(x - 4.5, y - 1, 9, 6.5); c.beginPath(); c.arc(x, y - 2, 3, Math.PI, v.locked ? 2 * Math.PI : 1.75 * Math.PI); c.stroke(); }
                    else if (b.id === 'frame') { c.strokeStyle = '#fff'; c.lineWidth = 1.4; c.setLineDash(v.noFrame ? [2, 2] : []); c.strokeRect(b.x + 5, b.y + 5, b.s - 10, b.s - 10); }
                    else c.fillText(b.ico, b.x + b.s / 2, b.y + b.s / 2 + 1);
                    c.restore();
                });
            }
        }
        function lpButtonAt(sx, sy) { for (const v of layoutData.vps) for (const b of lpBtnRects(v)) if (sx >= b.x && sx <= b.x + b.s && sy >= b.y && sy <= b.y + b.s) return { v, b }; return null; }
        // petit champ de saisie flottant (remplace prompt(), bloqué dans certains navigateurs / aperçus)
        function askText(label, value, sx, sy, cb) {
            const old = document.getElementById('ask-pop'); if (old) old.remove();
            const host = canvas.parentElement, d = document.createElement('div'); d.id = 'ask-pop';
            d.style.cssText = 'position:absolute;z-index:60;left:' + Math.max(4, Math.min(sx, host.clientWidth - 290)) + 'px;top:' + Math.max(4, Math.min(sy, host.clientHeight - 90)) + 'px;background:#1f2937;border:1px solid #4b5563;border-radius:8px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);width:280px;font-family:inherit';
            d.innerHTML = '<div style="font-size:12px;color:#d1d5db;margin-bottom:6px">' + label + '</div><input type="text" style="width:100%;background:#111827;color:#fff;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;outline:none;font-size:14px"><div style="font-size:11px;color:#9ca3af;margin-top:5px">Entrée = valider · Échap = annuler</div>';
            host.appendChild(d); const inp = d.querySelector('input'); inp.value = value || ''; inp.focus(); inp.select(); let done = false;
            const end = (ok) => { if (done) return; done = true; d.remove(); if (ok) cb(inp.value); draw(); };
            inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); end(true); } if (e.key === 'Escape') { e.preventDefault(); end(false); } });
            inp.addEventListener('blur', () => setTimeout(() => end(true), 0));
        }
        // fenêtre en vue 3D : instantané de la vue 3D (dernier point de vue regardé, sinon vue de départ), au format de la fenêtre, fond blanc
        const LP3D_IMG = {};
        function lp3DImg(v) { if (!v.v3 || !v.v3.img) return null; let im = LP3D_IMG[v.id]; if (!im || im._src !== v.v3.img) { im = new Image(); im.onload = () => draw(); im.src = v.v3.img; im._src = v.v3.img; LP3D_IMG[v.id] = im; } return im; }
        // la scène 3D est construite une fois par séance de navigation (lp3D.ready), puis chaque image n'est qu'un rendu
        let lp3D = { id: null, ready: false, drag: null, raf: 0, quick: false, live: false, pk: '' };
        async function lp3DPrep(fresh) {
            await loadThree(); place3D(); const first = !V3; if (!V3) init3D();
            if (fresh || !lp3D.ready || first) { withModel(() => build3DScene()); lp3D.ready = true; } if (first || !V3.dist) { fit3D(); V3.dist *= 1.3; }
        }
        // rend la fenêtre depuis SON point de vue (v.v3 : az, el, dist, cible) ; W = largeur de l'image (petite pendant le geste, grande au lâcher)
        function lp3DRender(v, W) { const el = document.getElementById('view3d'), was = el.style.display; el.style.visibility = 'hidden'; el.style.display = 'block';
            try { const H = Math.max(120, Math.round(W * v.h / Math.max(1, v.w))), R = V3.renderer, cam = V3.camera, keep = { a: cam.aspect, pr: R.getPixelRatio() }, P = v.v3;
                R.setPixelRatio(1); R.setSize(W, H, false); cam.aspect = W / H; R.setClearColor(0xffffff);
                const ce = Math.cos(P.el), t = new THREE.Vector3(P.tx, P.ty, P.tz); cam.position.set(t.x + P.dist * ce * Math.sin(P.az), t.y + P.dist * ce * Math.cos(P.az), t.z + P.dist * Math.sin(P.el)); cam.near = P.dist / 1000; cam.far = P.dist * 100 + V3.R * 10; cam.updateProjectionMatrix(); cam.lookAt(t);
                const kc = V3.cut; V3.cut = P.cut || null; v3CutCaps(); R.clippingPlanes = v3CutPlanes(); R.render(V3.scene, cam); V3.cut = kc; v3CutCaps(); R.clippingPlanes = v3CutPlanes(); P.img = R.domElement.toDataURL(W > 1000 ? 'image/jpeg' : 'image/png', 0.9); R.setClearColor(0x111827); R.setPixelRatio(keep.pr); cam.aspect = keep.a; cam.updateProjectionMatrix();
            } finally { el.style.display = was || 'none'; el.style.visibility = ''; } }
        async function lp3DSnap(v, fromView) {
            updateCommandMessageText('FENÊTRE 3D : calcul de la vue…');
            try { await lp3DPrep(true); } catch (e) { updateCommandMessageText('Vue 3D indisponible : ' + e.message); return; }
            try { if (!v.v3 || fromView || !(v.v3.dist > 0)) v.v3 = { az: V3.az, el: V3.el, dist: V3.dist, tx: V3.target.x, ty: V3.target.y, tz: V3.target.z, cut: V3.cut ? JSON.parse(JSON.stringify(V3.cut)) : undefined };   // départ : le point de vue de la vue 3D
                lp3DRender(v, 1800); } catch (e) { console.error(e); updateCommandMessageText('FENÊTRE 3D : échec (' + e.message + ').'); }
            if (v.v3 && v.v3.img) updateCommandMessageText('FENÊTRE en VUE 3D : double-clic dedans pour la piloter (mêmes gestes qu\'en vue 3D, avec son bandeau d\'affichage). Bouton 3D = retour au plan 2D.');
            draw();
        }
        // piloter la vue d'une fenêtre 3D, directement sur la feuille
        // fenêtre 3D pilotée : la vraie vue 3D (rendu continu, bandeau d'affichage, mêmes gestes de caméra) se pose exactement dans le cadre de la fenêtre
        async function lp3DEnter(v) { try { await lp3DPrep(true); } catch (e) { updateCommandMessageText('Vue 3D indisponible : ' + e.message); return; }
            if (!v.v3 || !(v.v3.dist > 0)) v.v3 = Object.assign(v.v3 || {}, { az: V3.az, el: V3.el, dist: V3.dist, tx: V3.target.x, ty: V3.target.y, tz: V3.target.z });
            const P = v.v3; lp3D.keep = { az: V3.az, el: V3.el, dist: V3.dist, t: V3.target.clone(), cut: V3.cut };
            V3.az = P.az; V3.el = P.el; V3.dist = P.dist; V3.target.set(P.tx, P.ty, P.tz); V3.cut = P.cut || null; V3.anim = null; try { v3CutCaps(); } catch (e) {}
            lp3D.id = v.id; lp3D.live = true; lp3D.pk = ''; lpSelId = v.id;
            const el = document.getElementById('view3d'); el.classList.add('v3-lp'); el.style.display = 'block'; const bd = document.getElementById('v3-band'); bd.classList.add('v3-band-lp'); document.body.appendChild(bd); try { v3Sky(); } catch (e) {} lpPlace3D(v); v3Band(true); draw();
            updateCommandMessageText('FENÊTRE 3D ACTIVE : mêmes gestes qu\'en vue 3D (glisser = tourner, clic droit ou molette enfoncée = déplacer, molette = zoom) et bandeau d\'affichage sous l\'en-tête, comme dans la vue 3D. Échap ou clic hors de la fenêtre pour la figer.'); }
        // recale la vue 3D sur le cadre de la fenêtre (feuille déplacée, zoomée, fenêtre redimensionnée)
        function lpPlace3D(v) { if (!lp3D.live || !V3 || !v) return; const r = lpRect(v), cr = canvas.getBoundingClientRect(), x = Math.round(cr.left + r.x), y = Math.round(cr.top + r.y), w = Math.max(40, Math.round(r.w)), h = Math.max(40, Math.round(r.h)), k = [x, y, w, h].join(',');
            if (k === lp3D.pk) return; const el = document.getElementById('view3d'), sz = lp3D.pk.split(',').slice(2).join(',') !== w + ',' + h; lp3D.pk = k;
            Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
            const v3r = document.getElementById('v3-rose'); if (v3r) Object.assign(v3r.style, { left: 'auto', right: '6px', top: '4px' });
            if (sz) { V3.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); V3.renderer.setSize(w, h); V3.camera.aspect = w / h; V3.camera.updateProjectionMatrix(); }
            // le bandeau d'affichage se pose sous l'en-tête général, sur toute la largeur, exactement comme dans la vue 3D : la fenêtre garde toute sa vue
            const bd = document.getElementById('v3-band'); if (bd && bd.classList.contains('v3-band-lp')) Object.assign(bd.style, { left: cr.left + 'px', top: cr.top + 'px', width: cr.width + 'px' });
            render3D(); }
        function lp3DLeave() { if (!lp3D.id) return; const v = lpVp(lp3D.id), live = lp3D.live; lp3D.id = null; lp3D.drag = null; lp3D.live = false;
            if (live && V3) { if (v && v.v3) Object.assign(v.v3, { az: V3.az, el: V3.el, dist: V3.dist, tx: V3.target.x, ty: V3.target.y, tz: V3.target.z });
                const K = lp3D.keep; if (K) { V3.az = K.az; V3.el = K.el; V3.dist = K.dist; V3.target.copy(K.t); V3.cut = K.cut; } V3.anim = null; try { v3CutCaps(); } catch (e) {}
                const el = document.getElementById('view3d'), bd = document.getElementById('v3-band'); if (bd && bd.classList.contains('v3-band-lp')) { bd.classList.remove('v3-band-lp'); ['width', 'left', 'top'].forEach(k => { bd.style[k] = ''; }); const lab = document.getElementById('v3-labels'); el.insertBefore(bd, lab ? lab.nextSibling : el.firstChild); } el.style.display = 'none'; el.classList.remove('v3-lp'); const v3r = document.getElementById('v3-rose'); if (v3r) v3r.style.right = '14px'; }
            if (v && v.v3) { lp3DRender(v, 1800); } updateCommandMessageText('FENÊTRE 3D figée à ce point de vue.'); draw(); }
        function lp3DSchedule(v, W) { if (lp3D.raf) return; lp3D.raf = requestAnimationFrame(() => { lp3D.raf = 0; try { lp3DRender(v, W); } catch (e) { console.error(e); } draw(); }); }
        function lp3DDown(e, sx, sy) { const v = lpVp(lp3D.id); if (!v || !lpInV(v, sx, sy)) return false; e.preventDefault(); lp3D.drag = { pan: e.shiftKey || e.button === 1, x: sx, y: sy }; canvas.style.cursor = 'grabbing'; return true; }
        function lp3DMove(sx, sy) { const D = lp3D.drag, v = lpVp(lp3D.id); if (!D || !v) return false; const dx = sx - D.x, dy = sy - D.y, P = v.v3; D.x = sx; D.y = sy;
            if (D.pan) { const r = lpRect(v), k = P.dist * 1.1 / Math.max(60, r.h), ca = Math.cos(P.az), sa = Math.sin(P.az), se = Math.sin(P.el);   // déplacement dans le plan de l'écran
                P.tx += (dx * ca - dy * sa * se) * k; P.ty += (-dx * sa - dy * ca * se) * k; P.tz += dy * Math.cos(P.el) * k; }
            else { P.az -= dx * 0.008; P.el = Math.max(-1.55, Math.min(1.55, P.el + dy * 0.008)); }
            lp3DSchedule(v, 700); return true; }
        function lp3DUp() { if (!lp3D.drag) return false; lp3D.drag = null; canvas.style.cursor = ''; const v = lpVp(lp3D.id); if (v) { if (lp3D.raf) { cancelAnimationFrame(lp3D.raf); lp3D.raf = 0; } lp3DRender(v, 1800); draw(); } return true; }
        function lp3DWheel(e, sx, sy) { const v = lpVp(lp3D.id); if (!v || !lpInV(v, sx, sy)) return false; v.v3.dist = Math.max(V3.R * 0.01, Math.min(V3.R * 50, v.v3.dist * (e.deltaY < 0 ? 0.88 : 1.14)));
            lp3DSchedule(v, 900); clearTimeout(lp3D.wt); lp3D.wt = setTimeout(() => { if (lpVp(lp3D.id) === v) { lp3DRender(v, 1800); draw(); } }, 250); return true; }
        function lpButtonAction(v, id, bx, by) {
            if (id === 'name') { askText('Nom de la ' + (lpIsImg(v) ? 'image' : 'fenêtre') + ' (écrit avant l\'échelle ; vide = aucun)', v.title || '', (bx || 100) - 260, (by || 100) + 24, (t) => { v.title = t.trim(); updateCommandMessageText(v.title ? 'Nom : « ' + v.title + ' ».' : 'Nom retiré.'); }); lpSelId = v.id; draw(); return; }
            else if (id === 'lay') { lpVpLayers(v); return; }
            else if (id === 'plat') { v.plat = !v.plat; updateCommandMessageText(v.plat ? 'FENÊTRE : plateformes — points cotés sous les plateformes masqués, cote de chaque plateforme écrite.' : 'FENÊTRE : tous les points cotés affichés.'); }
            else if (id === 'v3d') { if (v.v3) { delete v.v3; updateCommandMessageText('FENÊTRE : retour au plan 2D, à l\'échelle ' + lpScaleTxt(v.scale) + '.'); } else lp3DSnap(v); }
            else if (id === 'lock') { v.locked = !v.locked; updateCommandMessageText((lpIsImg(v) ? 'IMAGE ' : 'FENÊTRE ') + (v.locked ? 'verrouillée : ni déplacement, ni taille, ni échelle, ni cadrage.' : 'déverrouillée.')); }
            else if (id === 'frame') { v.noFrame = !v.noFrame; updateCommandMessageText('Cadre ' + (v.noFrame ? 'masqué (pointillé bleu à l\'écran, rien à l\'impression).' : 'affiché.')); }
            lpSelId = v.id; draw();
        }
        // image brute : cadre tracé puis fichier ; l'image s'ajuste dedans sans déformation
        let lpImgFrame = null;
        function lpImgLoad(input) {
            const f = input.files && input.files[0]; input.value = ''; const fr = lpImgFrame; lpImgFrame = null; if (!f || !fr) return;
            const rd = new FileReader(); rd.onload = () => {
                const im = new Image(); im.onload = () => {
                    let src = rd.result; const M = 2400, sc = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight));
                    if (sc < 1 || f.size > 1.5e6) { const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc); const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height); src = cv.toDataURL('image/jpeg', 0.9); }
                    const v = { id: 'im' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'img', x: fr.x, y: fr.y, w: fr.w, h: fr.h, src, title: '', noFrame: true };
                    layoutData.vps.push(v); lpSelId = v.id; updateCommandMessageText('IMAGE : ' + f.name + ' posée (' + Math.round(fr.w) + ' × ' + Math.round(fr.h) + ' mm). Glissez pour la déplacer, coins = taille ; boutons au-dessus : nommer, verrouiller, cadre.'); draw();
                }; im.src = rd.result;
            }; rd.readAsDataURL(f);
        }
        // nouvelle fenêtre : cadre tracé, à l'échelle normalisée qui fait tenir ce qu'on regardait sur le plan
        function lpCreateVp(a, b, round) {
            let x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
            if (round) { const R = Math.hypot(b.x - a.x, b.y - a.y); x = a.x - R; y = a.y - R; w = h = 2 * R; }
            if (w < 10 || h < 10) { updateCommandMessageText('FENÊTRE : trop petite (10 mm minimum).'); return; }
            let cx, cy, wMm, hMm; const sv = lpSaved || camera;
            const bb = getShapesBoundingBox(lpModelShapes().filter(s => !isBg(s)));
            if (sv && sv.zoom > 0) { cx = (canvas.width / 2 - sv.x) / sv.zoom; cy = (canvas.height / 2 - sv.y) / sv.zoom; wMm = worldToMm(canvas.width / sv.zoom); hMm = worldToMm(canvas.height / sv.zoom); }
            else if (bb) { cx = bb.centerX; cy = bb.centerY; wMm = worldToMm(bb.maxX - bb.minX) * 1.1; hMm = worldToMm(bb.maxY - bb.minY) * 1.1; }
            else { cx = 0; cy = 0; wMm = w * 100; hMm = h * 100; }
            const need = Math.max(wMm / w, hMm / h), S = LP_SCALES.find(t => t >= need * 0.999) || LP_SCALES[LP_SCALES.length - 1];
            const v = { id: 'vp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), x, y, w, h, cx, cy, scale: S, a: 0, e: 90, round: !!round };
            layoutData.vps.push(v); lpSelId = v.id; lpActiveId = null;
            updateCommandMessageText('FENÊTRE : ' + Math.round(w) + ' × ' + Math.round(h) + ' mm, échelle ' + lpScaleTxt(S) + '. Double-clic dedans pour la régler (molette = échelle, clic molette = cadrer) ; tapez 200 + Entrée pour 1:200 ; Suppr la retire.');
        }
        function lpSetScale(v, S) { if (!(S > 0) || !v || lpIsImg(v)) return; if (v.locked) { updateCommandMessageText('FENÊTRE verrouillée : déverrouillez-la (bouton cadenas) pour changer l\'échelle.'); return; } v.scale = S; if (v.id === lpActiveId) lpApplyCam(v); updateCommandMessageText('FENÊTRE : échelle ' + lpScaleTxt(S) + '.'); draw(); }
        function lpAskScale() { const v = lpVp(lpActiveId) || lpVp(lpSelId); if (v && (lpIsImg(v) || v.locked)) { lpSetScale(v, 1); return; } if (!v) { updateCommandMessageText('MISE EN PAGE : sélectionnez d\'abord une fenêtre (clic dessus).'); return; }
            const r = lpRect(v); askText('Échelle de la fenêtre : 1 / …', String(v.scale), r.x + 10, Math.max(10, r.y + 10), (t) => { const S = parseFloat(String(t).replace(',', '.').replace(/^1\s*[:/]\s*/, '')); if (S > 0) lpSetScale(v, S); }); }
        // molette : dans la fenêtre active = échelle suivante (le point sous la souris reste en place) ; ailleurs = zoom de la feuille
        function lpWheel(e, sx, sy) {
            const A = lpVp(lpActiveId);
            if (A && lpInV(A, sx, sy) && A.locked) { updateCommandMessageText('FENÊTRE verrouillée : échelle et cadrage figés.'); return; }
            if (A && lpInV(A, sx, sy)) {
                lpSyncFromCam(A); lpApplyCam(A);
                const wp = screenToWorld(sx, sy); let i = LP_SCALES.findIndex(t => t >= A.scale - 1e-9); if (i < 0) i = LP_SCALES.length - 1;
                if (LP_SCALES[i] !== A.scale && e.deltaY > 0) i--;   // échelle libre : on rejoint la plus proche
                i = Math.max(0, Math.min(LP_SCALES.length - 1, i + (e.deltaY < 0 ? -1 : 1)));
                const S = LP_SCALES[i];
                if (!lpIsOrtho(A)) { const r = lpRect(A), z = lpCam.k / (mmToWorld(1) * S); A.cx = (r.x + r.w / 2 - sx) / z + wp.x; A.cy = (r.y + r.h / 2 - sy) / z + wp.y; }
                lpSetScale(A, S); return;
            }
            const p = lpToMm(sx, sy), f = e.deltaY < 0 ? 1.15 : 1 / 1.15; lpCam.k = Math.max(0.05, Math.min(80, lpCam.k * f)); lpCam.x = sx - p.x * lpCam.k; lpCam.y = sy - p.y * lpCam.k;
            if (A) lpApplyCam(A); else lpApplyPaperCam(); draw();
        }
        // clic gauche sur la feuille ; renvoie true si le clic est consommé par la mise en page
        function lpMouseDown(e, sx, sy) {
            if (!isDrawing && !lpVpStart) { const hb = lpButtonAt(sx, sy); if (hb) { e.preventDefault(); lpButtonAction(hb.v, hb.b.id, hb.b.x + hb.b.s, hb.b.y); return true; } }
            if (mode === 'lpvpc') { const pm = lpToMm(sx, sy); if (!lpVpStart) { lpVpStart = pm; updateCommandMessageText('FENÊTRE RONDE : cliquez pour le rayon.'); } else { lpCreateVp(lpVpStart, pm, true); lpVpStart = null; setMode('select-box'); } draw(); return true; }
            if (mode === 'lpimg') { const pm = lpToMm(sx, sy); if (!lpVpStart) { lpVpStart = pm; updateCommandMessageText('IMAGE : cliquez le coin opposé du cadre.'); } else {
                    const a = lpVpStart; lpVpStart = null; setMode('select-box'); const w = Math.abs(pm.x - a.x), h = Math.abs(pm.y - a.y);
                    if (w < 5 || h < 5) updateCommandMessageText('IMAGE : cadre trop petit.'); else { lpImgFrame = { x: Math.min(a.x, pm.x), y: Math.min(a.y, pm.y), w, h }; updateCommandMessageText('IMAGE : choisissez le fichier…'); document.getElementById('lp-img-input').click(); } }
                draw(); return true; }
            if (mode === 'lpvp') { const pm = lpToMm(sx, sy); if (!lpVpStart) { lpVpStart = pm; updateCommandMessageText('FENÊTRE : cliquez le coin opposé.'); } else { lpCreateVp(lpVpStart, pm); lpVpStart = null; setMode('select-box'); } draw(); return true; }
            const A = lpVp(lpActiveId);
            if (A) {
                if (lpInV(A, sx, sy)) { if (lpIsOrtho(A)) { if (mode !== 'select-box') updateCommandMessageText('FENÊTRE en vue ' + viewName(A.a || 0, A.e) + ' : consultation seulement (rosace : Dessus pour y dessiner).'); return true; } return false; }
                if (isDrawing || mode !== 'select-box') return true;   // en cours de tracé : on ne quitte pas la fenêtre
                lpLeaveVp();
            }
            if (mode !== 'select-box') return false;   // les outils dessinent sur la feuille
            if (isDrawing) return false;
            const hd = gripAt(sx, sy) ? null : lpHandleAt(sx, sy);
            if (hd) { const v = hd.v; e.preventDefault(); lpSelId = v.id; selectedShapes = []; lpDrag = { id: v.id, kind: 'size', c: hd.c, s: lpToMm(sx, sy), o: { x: v.x, y: v.y, w: v.w, h: v.h } };
                updateCommandMessageText((lpIsImg(v) ? 'IMAGE' : 'FENÊTRE') + ' : glissez pour la redimensionner' + (v.round ? ' (le rayon).' : hd.c >= 4 ? ' (ce bord seulement).' : ' (ce coin).')); draw(); return true; }
            const wp = screenToWorld(sx, sy), hit = findShapeAt(wp.x, wp.y), cc = hit ? null : lpCartCellAt(sx, sy);
            if (cc) { e.preventDefault(); lpSelId = null; selectedShapes = []; lpCartEdit(cc); return true; }
            const v = lpVpAt(sx, sy);
            if (hit || !v || gripAt(sx, sy)) { if (lpSelId) { lpSelId = null; } return false; }   // objets de la feuille : sélection normale
            lpSelId = v.id; selectedShapes = []; const ci = -1;
            if (v.locked) { updateCommandMessageText((lpIsImg(v) ? 'IMAGE' : 'FENÊTRE') + ' verrouillée (cadenas au-dessus pour la libérer)' + (lpIsImg(v) ? '.' : ' ; double-clic pour dessiner dedans.')); draw(); return true; }
            lpDrag = { id: v.id, kind: ci >= 0 ? 'size' : 'move', c: ci, s: lpToMm(sx, sy), o: { x: v.x, y: v.y, w: v.w, h: v.h } };
            updateCommandMessageText(lpIsImg(v) ? 'IMAGE : glissez pour la déplacer (coins = taille), Suppr pour la retirer ; boutons au-dessus : nommer, verrouiller, cadre.' : 'FENÊTRE ' + lpScaleTxt(v.scale) + ' : glissez pour la déplacer (coins = taille), double-clic pour y travailler, tapez 200 + Entrée pour 1:200, Suppr pour la retirer.');
            draw(); return true;
        }
        function lpEnterVp(v) { lpUseModel(); lpActiveId = v.id; lpSelId = null; selectedShapes = []; lpApplyCam(v); }
        function lpLeaveVp() { lpActiveId = null; lpUsePaper(); lpApplyPaperCam(); }
        function lpMouseMoveDrag(sx, sy) {
            const D = lpDrag, v = lpVp(D.id); if (!v) return; const pm = lpToMm(sx, sy), dx = pm.x - D.s.x, dy = pm.y - D.s.y, o = D.o;
            if (D.kind === 'move') { v.x = o.x + dx; v.y = o.y + dy; }
            else if (v.round || D.c === 8) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2, d = Math.max(10, 2 * Math.hypot(pm.x - cx, pm.y - cy)); v.w = v.h = d; v.x = cx - d / 2; v.y = cy - d / 2; }
            else { const c = D.c; let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
                if (c === 0 || c === 3 || c === 7) x0 += dx; if (c === 1 || c === 2 || c === 5) x1 += dx; if (c === 0 || c === 1 || c === 4) y0 += dy; if (c === 2 || c === 3 || c === 6) y1 += dy;
                v.x = Math.min(x0, x1); v.y = Math.min(y0, y1); v.w = Math.max(10, Math.abs(x1 - x0)); v.h = Math.max(10, Math.abs(y1 - y0)); }
        }
        function lpDblClick(sx, sy) {   // true si consommé
            const A = lpVp(lpActiveId);
            if (A && lpInV(A, sx, sy)) return false;
            if (mode !== 'select-box' || isDrawing) return !!A;   // double-clic d'un outil de la feuille (polyligne…) : on le laisse finir
            let v = lpVpAt(sx, sy); if (lpIsImg(v)) v = null;
            if (lp3D.id && !(v && v.id === lp3D.id)) { lp3DLeave(); return true; }
            if (v && v.v3) { if (lp3D.id !== v.id) lp3DEnter(v); return true; }
            if (!v && !A) return false;
            if (v) { lpEnterVp(v);
                updateCommandMessageText('FENÊTRE ACTIVE (' + lpScaleTxt(v.scale) + ') : dessinez et modifiez normalement ; molette = échelle normalisée, clic molette = cadrer, rosace = vue ; double-clic sur la feuille ou Échap pour en sortir.'); }
            else { lpLeaveVp(); updateCommandMessageText('MISE EN PAGE : feuille (1 mm = 1 mm).'); }
            draw(); return true;
        }
        // PDF de la feuille : rendu raster haute définition (≈ 160 dpi, 110 dpi en A1/A0)
        // ---- PDF VECTORIEL : un faux « contexte de dessin » qui écrit directement dans le PDF (traits, textes, images) au lieu de pixels ;
        // les mêmes fonctions de dessin servent à l'écran et au PDF. Unités du dessin : px de la feuille (k par mm) → mm du PDF.
        function pdfColor(css) { const s = String(css || '').trim().toLowerCase(); let m;
            if (!s || s === 'transparent' || s === 'none') return { r: 0, g: 0, b: 0, a: 0 };
            const N = { white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000', gray: '#808080', grey: '#808080', yellow: '#ffff00', orange: '#ffa500' }; const t = N[s] || s;
            if ((m = /^#([0-9a-f]{3,8})$/.exec(t))) { let h = m[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; }
            if ((m = /^rgba?\(([^)]+)\)$/.exec(t))) { const v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return { r: v[0] || 0, g: v[1] || 0, b: v[2] || 0, a: v.length > 3 ? (String(m[1]).includes('%') && v[3] > 1 ? v[3] / 100 : v[3]) : 1 }; }
            if ((m = /^hsla?\(([^)]+)\)$/.exec(t))) { const v = m[1].split(/[\s,\/%]+/).filter(Boolean).map(parseFloat), h = (v[0] % 360) / 360, sa = v[1] / 100, l = v[2] / 100, q = l < .5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q, f = (x) => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < .5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; }; return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a: v.length > 3 ? v[3] : 1 }; }
            return { r: 0, g: 0, b: 0, a: 1 }; }
        class PdfCtx {
            constructor(doc, k, bw) { this.doc = doc; this.k = k; this.bw = !!bw; this.__pdf = true; this.canvas = { width: 1e6, height: 1e6 }; this._st = []; this._p = []; this._gs = {};
                this.s = { m: [1, 0, 0, 1, 0, 0], lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', globalAlpha: 1, dash: [], dashOffset: 0, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter' };
                this._mc = document.createElement('canvas').getContext('2d'); }
            // état
            get lineWidth() { return this.s.lineWidth; } set lineWidth(v) { if (v > 0) this.s.lineWidth = +v; }
            get strokeStyle() { return this.s.strokeStyle; } set strokeStyle(v) { this.s.strokeStyle = v; }
            get fillStyle() { return this.s.fillStyle; } set fillStyle(v) { this.s.fillStyle = v; }
            get globalAlpha() { return this.s.globalAlpha; } set globalAlpha(v) { this.s.globalAlpha = Math.max(0, Math.min(1, +v)); }
            get font() { return this.s.font; } set font(v) { this.s.font = v; }
            get textAlign() { return this.s.textAlign; } set textAlign(v) { this.s.textAlign = v; }
            get textBaseline() { return this.s.textBaseline; } set textBaseline(v) { this.s.textBaseline = v; }
            get lineCap() { return this.s.lineCap; } set lineCap(v) { this.s.lineCap = v; }
            get lineJoin() { return this.s.lineJoin; } set lineJoin(v) { this.s.lineJoin = v; }
            get lineDashOffset() { return this.s.dashOffset; } set lineDashOffset(v) { this.s.dashOffset = +v || 0; }
            set globalCompositeOperation(v) {} get globalCompositeOperation() { return 'source-over'; }
            set shadowColor(v) {} set shadowBlur(v) {} set shadowOffsetX(v) {} set shadowOffsetY(v) {} set imageSmoothingEnabled(v) {} set miterLimit(v) {} set filter(v) {}
            setLineDash(a) { this.s.dash = (a || []).map(Number); } getLineDash() { return this.s.dash.slice(); }
            save() { this._st.push(Object.assign({}, this.s, { m: this.s.m.slice(), dash: this.s.dash.slice() })); this.doc.saveGraphicsState(); }
            restore() { if (!this._st.length) return; this.s = this._st.pop(); this.doc.restoreGraphicsState(); }
            // transformations
            _mul(n) { const [a, b, c, d, e, f] = this.s.m; this.s.m = [a * n[0] + c * n[1], b * n[0] + d * n[1], a * n[2] + c * n[3], b * n[2] + d * n[3], a * n[4] + c * n[5] + e, b * n[4] + d * n[5] + f]; }
            transform(a, b, c, d, e, f) { this._mul([a, b, c, d, e, f]); } setTransform(a, b, c, d, e, f) { if (typeof a === 'object' && a) { this.s.m = [a.a, a.b, a.c, a.d, a.e, a.f]; return; } this.s.m = [a, b, c, d, e, f]; } resetTransform() { this.s.m = [1, 0, 0, 1, 0, 0]; }
            translate(x, y) { this._mul([1, 0, 0, 1, x, y]); } scale(x, y) { this._mul([x, 0, 0, y, 0, 0]); } rotate(r) { const c = Math.cos(r), s = Math.sin(r); this._mul([c, s, -s, c, 0, 0]); }
            getTransform() { const [a, b, c, d, e, f] = this.s.m; return new DOMMatrix([a, b, c, d, e, f]); }
            _t(x, y) { const m = this.s.m; return [(m[0] * x + m[2] * y + m[4]) / this.k, (m[1] * x + m[3] * y + m[5]) / this.k]; }
            _sc() { const m = this.s.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) / this.k; }
            // chemin (gardé en mm de la feuille, transformation appliquée au fil de l'eau comme le fait un vrai canvas)
            beginPath() { this._p = []; } closePath() { this._p.push(['z']); }
            moveTo(x, y) { this._p.push(['m', ...this._t(x, y)]); this._cur = [x, y]; this._start = [x, y]; } lineTo(x, y) { if (!this._p.length) return this.moveTo(x, y); this._p.push(['l', ...this._t(x, y)]); this._cur = [x, y]; }
            bezierCurveTo(a, b, c, d, x, y) { if (!this._p.length) this.moveTo(a, b); this._p.push(['c', ...this._t(a, b), ...this._t(c, d), ...this._t(x, y)]); this._cur = [x, y]; }
            quadraticCurveTo(qx, qy, x, y) { const [x0, y0] = this._cur || [qx, qy]; this.bezierCurveTo(x0 + 2 / 3 * (qx - x0), y0 + 2 / 3 * (qy - y0), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y); }
            ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) { let sw = a1 - a0; if (!ccw && sw < 0) sw = sw % (2 * Math.PI) + 2 * Math.PI; if (ccw && sw > 0) sw = sw % (2 * Math.PI) - 2 * Math.PI; if (!ccw && a1 - a0 >= 2 * Math.PI) sw = 2 * Math.PI; if (ccw && a0 - a1 >= 2 * Math.PI) sw = -2 * Math.PI;
                const n = Math.max(1, Math.ceil(Math.abs(sw) / (Math.PI / 2))), d = sw / n, cr = Math.cos(rot || 0), sr = Math.sin(rot || 0), P = (t) => { const x = rx * Math.cos(t), y = ry * Math.sin(t); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; }, D = (t) => { const x = -rx * Math.sin(t), y = ry * Math.cos(t); return [x * cr - y * sr, x * sr + y * cr]; };
                const p0 = P(a0); if (this._p.length) this.lineTo(p0[0], p0[1]); else this.moveTo(p0[0], p0[1]); const al = 4 / 3 * Math.tan(d / 4);
                for (let i = 0; i < n; i++) { const t0 = a0 + i * d, t1 = t0 + d, q0 = P(t0), q1 = P(t1), d0 = D(t0), d1 = D(t1); this.bezierCurveTo(q0[0] + al * d0[0], q0[1] + al * d0[1], q1[0] - al * d1[0], q1[1] - al * d1[1], q1[0], q1[1]); } }
            arc(cx, cy, r, a0, a1, ccw) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
            arcTo(x1, y1, x2, y2, r) { const [x0, y0] = this._cur || [x1, y1], v1 = [x0 - x1, y0 - y1], v2 = [x2 - x1, y2 - y1], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2); if (!r || !l1 || !l2) return this.lineTo(x1, y1);
                const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2], th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))), t = r / Math.tan(th / 2); if (!isFinite(t)) return this.lineTo(x1, y1);
                const p1 = [x1 + u1[0] * t, y1 + u1[1] * t], p2 = [x1 + u2[0] * t, y1 + u2[1] * t], bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(...bis), dc = r / Math.sin(th / 2), c = [x1 + bis[0] / bl * dc, y1 + bis[1] / bl * dc];
                const a0 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a1 = Math.atan2(p2[1] - c[1], p2[0] - c[0]), cross = u1[0] * u2[1] - u1[1] * u2[0]; this.lineTo(p1[0], p1[1]); this.arc(c[0], c[1], r, a0, a1, cross > 0); }
            rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
            roundRect(x, y, w, h, r) { r = Math.min(Array.isArray(r) ? r[0] || 0 : r || 0, Math.abs(w) / 2, Math.abs(h) / 2); if (!r) return this.rect(x, y, w, h); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); }
            _emit(P) { const d = this.doc; let any = false; for (const o of P) { if (o[0] === 'm') { d.moveTo(o[1], o[2]); any = true; } else if (o[0] === 'l') d.lineTo(o[1], o[2]); else if (o[0] === 'c') d.curveTo(o[1], o[2], o[3], o[4], o[5], o[6]); else if (o[0] === 'z') d.close(); } return any; }
            _gray(c, line) { if (!this.bw) return c; const v = line ? Math.min(c.r, c.g, c.b) : 0.3 * c.r + 0.59 * c.g + 0.11 * c.b, g = line && v > 235 ? 255 : line ? Math.round(v * 0.25) : Math.round(v); return { r: g, g: g, b: g, a: c.a }; }
            _alpha(a) { a = Math.round(a * 100) / 100; if (a >= 1) a = 1; const key = String(a); if (!this._gs[key]) this._gs[key] = new this.doc.GState({ opacity: a, 'stroke-opacity': a }); this.doc.setGState(this._gs[key]); }
            _style(st) { if (st && typeof st === 'object') return st.__c ? pdfColor(st.__c) : { r: 200, g: 200, b: 200, a: 1 }; return pdfColor(st); }
            _pathOf(p) { if (p && p.__ops) { const keep = this._p; this._p = []; p.__ops(this); const r = this._p; this._p = keep; return r; } return p ? [] : this._p; }
            stroke(p) { const P = this._pathOf(p); if (!P.length) return; const c = this._gray(this._style(this.s.strokeStyle), true), a = c.a * this.s.globalAlpha; if (a <= 0.003) return; const d = this.doc, sc = this._sc();
                d.setDrawColor(Math.round(c.r), Math.round(c.g), Math.round(c.b)); d.setLineWidth(Math.max(0.02, this.s.lineWidth * sc)); this._alpha(a);
                d.setLineDashPattern(this.s.dash.length ? this.s.dash.map(v => Math.max(0.01, v * sc)) : [], (this.s.dashOffset || 0) * sc);
                try { d.setLineCap(this.s.lineCap === 'round' ? 'round' : this.s.lineCap === 'square' ? 'square' : 'butt'); d.setLineJoin(this.s.lineJoin === 'round' ? 'round' : this.s.lineJoin === 'bevel' ? 'bevel' : 'miter'); } catch (e) {}
                if (this._emit(P)) d.stroke(); }
            fill(p, rule) { if (typeof p === 'string') { rule = p; p = null; } const P = this._pathOf(p); if (!P.length) return; const c = this._gray(this._style(this.s.fillStyle), false), a = c.a * this.s.globalAlpha; if (a <= 0.003) return; const d = this.doc;
                d.setFillColor(Math.round(c.r), Math.round(c.g), Math.round(c.b)); this._alpha(a); if (this._emit(P)) { if (rule === 'evenodd' && d.fillEvenOdd) d.fillEvenOdd(); else d.fill(); } }
            clip(p, rule) { if (typeof p === 'string') { rule = p; p = null; } const P = this._pathOf(p); if (!P.length) return; const d = this.doc;
                // boîte de la découpe (mm de feuille) : une image n'est écrite que sur cette partie
                let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; P.forEach(e => { for (let i = 1; i + 1 < e.length; i += 2) { const x = e[i], y = e[i + 1]; if (typeof x !== 'number' || typeof y !== 'number') continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
                if (x1 >= x0) { const c = this.s.cb; this.s.cb = c ? [Math.max(c[0], x0), Math.max(c[1], y0), Math.min(c[2], x1), Math.min(c[3], y1)] : [x0, y0, x1, y1]; } if (this._emit(P)) { if (rule === 'evenodd' && d.clipEvenOdd) d.clipEvenOdd(); else d.clip(); d.discardPath(); } }
            fillRect(x, y, w, h) { const keep = this._p; this._p = []; this.rect(x, y, w, h); this.fill(); this._p = keep; }
            strokeRect(x, y, w, h) { const keep = this._p; this._p = []; this.rect(x, y, w, h); this.stroke(); this._p = keep; }
            clearRect(x, y, w, h) { const f = this.s.fillStyle, a = this.s.globalAlpha; this.s.fillStyle = '#fff'; this.s.globalAlpha = 1; this.fillRect(x, y, w, h); this.s.fillStyle = f; this.s.globalAlpha = a; }
            isPointInPath() { return false; } isPointInStroke() { return false; }
            createLinearGradient() { const g = { __c: null, addColorStop(o, c) { if (g.__c === null) g.__c = c; } }; return g; } createRadialGradient() { return this.createLinearGradient(); } createPattern() { return { __c: '#c8c8c8' }; }
            getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; } putImageData() {}
            // textes
            measureText(t) { this._mc.font = this.s.font; return this._mc.measureText(t); }
            _fontPx() { const m = /([\d.]+)px/.exec(this.s.font || ''); return m ? +m[1] : 10; }
            fillText(t, x, y, maxW) { t = String(t == null ? '' : t); if (!t.trim()) return; const d = this.doc, c = this._gray(this._style(this.s.fillStyle), true), a = c.a * this.s.globalAlpha; if (a <= 0.003) return;
                const txt = t.replace(/[→⟶]/g, '->').replace(/[←]/g, '<-').replace(/[≈]/g, '~').replace(/[✓✔]/g, 'v').replace(/[^\x20-\x7e -ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™′″²³]/g, '');
                if (!txt.trim()) return; const m = this.s.m, sx = Math.hypot(m[0], m[1]), px = this._fontPx(); let mm = px * sx / this.k; const bold = /bold|[6-9]00/.test(this.s.font || ''), it = /italic|oblique/.test(this.s.font || '');
                let w = this.measureText(t).width; if (maxW > 0 && w > maxW) { mm *= maxW / w; w = maxW; }
                d.setFont('helvetica', bold && it ? 'bolditalic' : bold ? 'bold' : it ? 'italic' : 'normal'); d.setFontSize(mm / 0.3528); d.setTextColor(Math.round(c.r), Math.round(c.g), Math.round(c.b)); this._alpha(a);
                const al = this.s.textAlign, dx = al === 'center' ? -w / 2 : al === 'right' || al === 'end' ? -w : 0, bl = this.s.textBaseline, dy = bl === 'middle' ? px * 0.35 : bl === 'top' || bl === 'hanging' ? px * 0.78 : bl === 'bottom' || bl === 'ideographic' ? -px * 0.22 : 0;
                const [X, Y] = this._t(x + dx, y + dy), ang = -Math.atan2(m[1], m[0]) * 180 / Math.PI, ww = w * sx / this.k, tw = d.getTextWidth(txt), hs = tw > 0 ? Math.min(100, Math.max(50, 100 * ww / tw)) : 100;
                d.text(txt, X, Y, { angle: Math.abs(ang) > 0.01 ? ang : 0, horizontalScale: Math.abs(hs - 100) > 3 ? hs / 100 : undefined }); }
            strokeText() {}
            // images (fonds de plan, vues 3D, logos) : une image nette au bon endroit, tournée si besoin
            drawImage(img, ...a) { let sx = 0, sy = 0, sw, sh, dx, dy, dw, dh; const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height; if (!iw || !ih) return;
                if (a.length === 2) { [dx, dy] = a; dw = iw; dh = ih; sw = iw; sh = ih; } else if (a.length === 4) { [dx, dy, dw, dh] = a; sw = iw; sh = ih; } else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
                let c0 = this._t(dx, dy), c1 = this._t(dx + dw, dy), c3 = this._t(dx, dy + dh), wmm = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), hmm = Math.hypot(c3[0] - c0[0], c3[1] - c0[1]); if (wmm < 0.05 || hmm < 0.05) return;
                // image droite : seule la partie dans la découpe (une fenêtre de mise en page) est gardée — un fond de plan entier pesait des dizaines de Mo
                const cb = this.s.cb, straight = Math.abs(c1[1] - c0[1]) < 1e-6 && Math.abs(c3[0] - c0[0]) < 1e-6 && c1[0] > c0[0] && c3[1] > c0[1];
                if (cb) {   // coins de la découpe ramenés dans l'image (droite ou tournée) : on n'en garde que la partie utile
                    const ex = [c1[0] - c0[0], c1[1] - c0[1]], ey = [c3[0] - c0[0], c3[1] - c0[1]], det = ex[0] * ey[1] - ex[1] * ey[0]; if (Math.abs(det) < 1e-12) return;
                    let fa0 = 1, fa1 = 0, fb0 = 1, fb1 = 0; [[cb[0], cb[1]], [cb[2], cb[1]], [cb[2], cb[3]], [cb[0], cb[3]]].forEach(([X, Y]) => { const px = X - c0[0], py = Y - c0[1], u = (px * ey[1] - py * ey[0]) / det, v = (ex[0] * py - ex[1] * px) / det; fa0 = Math.min(fa0, u); fa1 = Math.max(fa1, u); fb0 = Math.min(fb0, v); fb1 = Math.max(fb1, v); });
                    fa0 = Math.max(0, fa0); fb0 = Math.max(0, fb0); fa1 = Math.min(1, fa1); fb1 = Math.min(1, fb1); if (fa1 - fa0 <= 1e-6 || fb1 - fb0 <= 1e-6) return;
                    if (fa0 > 0 || fb0 > 0 || fa1 < 1 || fb1 < 1) { sx += sw * fa0; sy += sh * fb0; sw *= fa1 - fa0; sh *= fb1 - fb0; const P0 = [c0[0] + ex[0] * fa0 + ey[0] * fb0, c0[1] + ex[1] * fa0 + ey[1] * fb0];
                        c1 = [P0[0] + ex[0] * (fa1 - fa0), P0[1] + ex[1] * (fa1 - fa0)]; c3 = [P0[0] + ey[0] * (fb1 - fb0), P0[1] + ey[1] * (fb1 - fb0)]; c0 = P0; wmm = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]); hmm = Math.hypot(c3[0] - c0[0], c3[1] - c0[1]);
                        dx = 0; dy = 0; dw = 1; dh = 1; } }
                const res = Math.min(12, this.k * 1.3, Math.max(3, Math.sqrt(4e7 / (wmm * hmm)))), cw = Math.max(1, Math.min(Math.round(wmm * res), sw * 2)), ch = Math.max(1, Math.min(Math.round(hmm * res), sh * 2)), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
                const g = cv.getContext('2d'); try { g.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch); } catch (e) { return; }
                if (this.bw) { const D = g.getImageData(0, 0, cw, ch), q = D.data; for (let i = 0; i < q.length; i += 4) { const v = 0.3 * q[i] + 0.59 * q[i + 1] + 0.11 * q[i + 2]; q[i] = q[i + 1] = q[i + 2] = v; } g.putImageData(D, 0, 0); }
                let alpha = false; try { const D = g.getImageData(0, 0, Math.min(cw, 64), Math.min(ch, 64)).data; for (let i = 3; i < D.length; i += 4) if (D[i] < 250) { alpha = true; break; } } catch (e) {}
                const ang = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]) * 180 / Math.PI; this._alpha(this.s.globalAlpha);
                if (alpha && straight) { const w2 = document.createElement('canvas'); w2.width = cw; w2.height = ch; const g3 = w2.getContext('2d'); g3.fillStyle = '#fff'; g3.fillRect(0, 0, cw, ch); g3.drawImage(cv, 0, 0); g.clearRect(0, 0, cw, ch); g.drawImage(w2, 0, 0); alpha = false; }   // sur fond blanc : JPEG, bien plus léger
                const data = alpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88), fmt = alpha ? 'PNG' : 'JPEG';
                if (Math.abs(ang) < 0.01) this.doc.addImage(data, fmt, c0[0], c0[1], wmm, hmm, undefined, 'FAST');
                else { const c2 = [c1[0] + c3[0] - c0[0], c1[1] + c3[1] - c0[1]], X = [c0[0], c1[0], c2[0], c3[0]], Y = [c0[1], c1[1], c2[1], c3[1]], bx = Math.min(...X), by = Math.min(...Y), bw = Math.max(...X) - bx, bh = Math.max(...Y) - by, rs = Math.min(12, this.k * 1.3, Math.max(3, Math.sqrt(4e7 / (bw * bh)))), cv2 = document.createElement('canvas');   // tournée : remise dans un cadre droit (coins transparents)
                    cv2.width = Math.max(1, Math.round(bw * rs)); cv2.height = Math.max(1, Math.round(bh * rs)); const g2 = cv2.getContext('2d'); g2.setTransform((c1[0] - c0[0]) / cw * rs, (c1[1] - c0[1]) / cw * rs, (c3[0] - c0[0]) / ch * rs, (c3[1] - c0[1]) / ch * rs, (c0[0] - bx) * rs, (c0[1] - by) * rs); g2.drawImage(cv, 0, 0);
                    if (cb) { const w3 = document.createElement('canvas'); w3.width = cv2.width; w3.height = cv2.height; const g4 = w3.getContext('2d'); g4.fillStyle = '#fff'; g4.fillRect(0, 0, w3.width, w3.height); g4.drawImage(cv2, 0, 0); this.doc.addImage(w3.toDataURL('image/jpeg', 0.88), 'JPEG', bx, by, bw, bh, undefined, 'FAST'); }   // dans une fenêtre : sur fond blanc, en JPEG
                    else this.doc.addImage(cv2.toDataURL('image/png'), 'PNG', bx, by, bw, bh, undefined, 'FAST'); } }
        }
        const lpDpi = () => { const P = lpPage(); return P.W * P.H > 420 * 600 ? 110 : 160; };
        // le PDF de la feuille : vectoriel (traits et textes nets à toutes les échelles, épaisseurs exactes en mm) ou image ; couleur ou noir et blanc
        function lpBuildPDF(opt) { opt = Object.assign({ vec: printSettings.lpVec !== false, bw: !!printSettings.bw }, opt || {});
            const P = lpPage(), dpi = lpDpi(), k = dpi / 25.4, { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: layoutData.orient === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: layoutData.paper.toLowerCase(), compress: opt.compress !== false });
            const keepCam = { x: camera.x, y: camera.y, zoom: camera.zoom }, keepX = vecExact;
            if (opt.vec) { const c = new PdfCtx(doc, k, opt.bw); try { vecExact = true; lpDrawSheet(c, 0, 0, k, true); } finally { vecExact = keepX; camera.x = keepCam.x; camera.y = keepCam.y; camera.zoom = keepCam.zoom; } return doc; }
            const cv = document.createElement('canvas'); cv.width = Math.round(P.W * k); cv.height = Math.round(P.H * k);
            const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
            try { lpDrawSheet(c, 0, 0, k, true); } finally { camera.x = keepCam.x; camera.y = keepCam.y; camera.zoom = keepCam.zoom; }
            if (opt.bw) canvasToBW(cv);
            doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, P.W, P.H, undefined, 'FAST'); return doc; }
        // noir et blanc : les traits et textes de couleur deviennent noirs (la couleur la plus sombre du pixel), les aplats clairs restent clairs
        function canvasToBW(cv) { const g = cv.getContext('2d'), D = g.getImageData(0, 0, cv.width, cv.height), q = D.data; for (let i = 0; i < q.length; i += 4) { const m = Math.min(q[i], q[i + 1], q[i + 2]), l = 0.3 * q[i] + 0.59 * q[i + 1] + 0.11 * q[i + 2], v = Math.min(l, m < 200 ? m * 0.5 : m); q[i] = q[i + 1] = q[i + 2] = v; } g.putImageData(D, 0, 0); }
        // même PDF que lpBuildPDF, fenêtre par fenêtre avec la barre de progression (une mise en page chargée peut demander du temps)
        async function lpBuildPDFAsync(opt) { opt = Object.assign({ vec: printSettings.lpVec !== false, bw: !!printSettings.bw }, opt || {});
            const P = lpPage(), dpi = lpDpi(), k = dpi / 25.4, { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: layoutData.orient === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: layoutData.paper.toLowerCase(), compress: opt.compress !== false });
            const keepCam = { x: camera.x, y: camera.y, zoom: camera.zoom }, keepX = vecExact, V = layoutData.vps, N = V.length + 3; let c, cv = null;
            const nm = (v) => v.title || (lpIsImg(v) ? 'image' : v.v3 ? 'vue 3D' : 'plan au ' + lpScaleTxt(v.scale));
            try { await busyStep('Impression : préparation de la feuille', 1, N);
                if (opt.vec) { c = new PdfCtx(doc, k, opt.bw); vecExact = true; } else { cv = document.createElement('canvas'); cv.width = Math.round(P.W * k); cv.height = Math.round(P.H * k); c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); }
                lpSheetStart(c, 0, 0, k);
                for (let i = 0; i < V.length; i++) { await busyStep('Impression : fenêtre ' + (i + 1) + ' sur ' + V.length + ' (' + nm(V[i]) + ')', i + 2, N); lpSheetVp(c, V[i], 0, 0, k, true); }
                await busyStep('Impression : cartouche, textes de la feuille', N - 1, N); lpSheetEnd(c, 0, 0, k, true);
                if (cv) { await busyStep('Impression : image de la feuille', N, N); if (opt.bw) canvasToBW(cv); doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, P.W, P.H, undefined, 'FAST'); }
                else await busyStep('Impression : écriture du PDF', N, N);
            } finally { vecExact = keepX; camera.x = keepCam.x; camera.y = keepCam.y; camera.zoom = keepCam.zoom; }
            return doc; }
        async function lpPrintPDF() {
            if (!window.jspdf) { alert('jsPDF indisponible (connexion ?).'); return; }
            if (!layoutData.vps.length && !confirm('La feuille n\'a aucune fenêtre. Produire quand même le PDF ?')) return;
            let doc; try { doc = await lpBuildPDFAsync(); } catch (e) { console.error(e); busyEnd(); updateCommandMessageText('MISE EN PAGE : le PDF n\'a pas pu être produit (' + (e && e.message || e) + ').'); alert('Le PDF de la mise en page n\'a pas pu être produit :\n' + (e && e.message || e)); draw(); return; }
            try { await busyStep('Impression : enregistrement du fichier', 1, 1); } catch (e) {} const base = (fileName ? baseName(fileName) : 'plan') + '_' + (lpName(layoutData, layoutIdx).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'presentation'), vec = printSettings.lpVec !== false;
            try { doc.save(base + '.pdf'); } finally { busyEnd(); } updateCommandMessageText('MISE EN PAGE : ' + base + '.pdf produit (' + layoutData.paper + ' ' + (layoutData.orient === 'landscape' ? 'paysage' : 'portrait') + ', ' + layoutData.vps.length + ' fenêtre(s), ' + (vec ? 'vectoriel' : lpDpi() + ' dpi') + (printSettings.bw ? ', noir et blanc' : '') + ').');
            draw();
        }
        /* mémo d'image : pendant un même dessin, la géométrie ne bouge pas : le modèle fini et les arbres des bois sont calculés une fois au lieu de 15 */
        let FRAME_MEMO = null;
        function draw() { const top = !FRAME_MEMO; if (top) FRAME_MEMO = new Map(); const t0 = performance.now(); clearTimeout(NAV.t); NAV.snap = null;
            try { return drawFrame(); } finally { if (top) { FRAME_MEMO = null; const dt = performance.now() - t0; NAV.ms = NAV.ms ? NAV.ms * 0.6 + dt * 0.4 : dt; NAV.full = true; } } }
        /* navigation fluide (glisser la vue, molette) : si un dessin complet est lent, l'image du dernier dessin est déplacée / agrandie à la volée,
           et le plan est redessiné net dès que la vue s'arrête */
        const NAV = { snap: null, full: false, ms: 0, t: 0 };
        function navDraw() { if (layoutOn || NAV.ms < 14 || !(NAV.snap || NAV.full)) { draw(); return; }
            if (!NAV.snap) return draw();
            const S = NAV.snap, k = camera.zoom / S.z; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = true;
            ctx.drawImage(S.c, camera.x - S.x * k, camera.y - S.y * k, S.c.width * k, S.c.height * k); NAV.full = false;
            clearTimeout(NAV.t); NAV.t = setTimeout(() => draw(), 160); }
        function navBegin() { if (layoutOn || NAV.snap || !NAV.full || NAV.ms < 14) return; const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); NAV.snap = { c, x: camera.x, y: camera.y, z: camera.zoom }; }
        function drawFrame() {
            try { cl2Chip(); } catch (e) {}
            if (layoutOn && !lpInner) { drawLayout(); return; }
            if (lpInner) { if (!lpNoFill) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } } else
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const vrose = document.getElementById('view-rose'); if (vrose) vrose.style.display = (mode === 'print' || mode === 'preview') ? 'none' : '';
            if (typeof isOrthoView === 'function' && isOrthoView()) { updateRose(); drawOrthoView(ctx); return; }
            drawFullPlan(ctx, true);
            if (mode !== 'print' && mode !== 'preview' && !layoutOn) drawOriginIcon();
            if (batDraw) batDrawCand(ctx);
            if (EC) ecDraw2D(ctx);
            if (mode === 'preview') { const c0 = previewPin || { x: currentX_screen, y: currentY_screen }; drawPreviewSheet(c0.x, c0.y); }
            updateCursorCoords();

            if (mode === 'print') {
                const rect = getPrintRect();
                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(canvas.width, 0); ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.closePath();
                ctx.rect(currentX_screen + rect.w/2, currentY_screen - rect.h/2, -rect.w, rect.h);
                ctx.fill("evenodd");
                ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
                ctx.strokeRect(currentX_screen - rect.w/2, currentY_screen - rect.h/2, rect.w, rect.h);
                const m = 10; ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
                ctx.strokeRect(currentX_screen - rect.w/2 + m, currentY_screen - rect.h/2 + m, rect.w - 2*m, rect.h - 2*m);
                ctx.setLineDash([]);
                // Silhouette du cartouche (coin bas-droite) pour visualiser la zone réservée
                const P0 = pageDims(), pxPerMm = rect.w / P0.drawW;
                if (printSettings.cartouche) {
                    const cdm = cartDims(P0.pageW, P0.pageH, P0.margin), cWpx = cdm.w * pxPerMm, cHpx = cdm.h * pxPerMm;
                    const innerRight = currentX_screen + rect.w/2, innerBottom = currentY_screen + rect.h/2;
                    ctx.strokeStyle = "rgba(255,200,0,0.7)"; ctx.lineWidth = 1.5;
                    ctx.strokeRect(innerRight - cWpx, innerBottom - cHpx, cWpx, cHpx);
                    ctx.fillStyle = "rgba(255,200,0,0.08)";
                    ctx.fillRect(innerRight - cWpx, innerBottom - cHpx, cWpx, cHpx);
                }
                ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "bold 14px sans-serif";
                ctx.fillText(`${printSettings.paper} ${P0.land ? 'paysage' : 'portrait'} — ${currentPrintScale} → ${printSettings.output === 'pdf' ? 'PDF' : printSettings.output.toUpperCase()}`, currentX_screen, currentY_screen - rect.h/2 - 10);
            }

            if (mode === 'rotate' && rotateCenter && !isPanning) {
                let curA = Math.atan2(currentY - rotateCenter.y, currentX - rotateCenter.x), diff = curA - rotateStartAngle;
                if (typedInput.length > 0) diff = -(parseFloat(typedInput)*Math.PI/180);
                let full = "A= " + (-diff*180/Math.PI).toFixed(1) + "°";   // affiché en sens trigonométrique
                let cs = worldToScreen(rotateCenter.x, rotateCenter.y), ms = worldToScreen(currentX, currentY);
                ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cs.x, cs.y); ctx.lineTo(ms.x, ms.y); ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.arc(cs.x, cs.y, 5, 0, Math.PI*2); ctx.fill();
                ctx.font = "bold 12px Arial"; let meas = ctx.measureText(full);
                ctx.fillStyle = "rgba(30,30,30,0.9)"; ctx.fillRect(ms.x+15, ms.y+15, meas.width+10, 22);
                ctx.fillStyle = '#ffffff'; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(full, ms.x+20, ms.y+26);
            }

            if (isScaleMode() && scaleCenter && !isPanning) {
                let d2 = Math.hypot(currentX - scaleCenter.x, currentY - scaleCenter.y);
                let f = (scaleRefDist > 0.0001) ? d2 / scaleRefDist : 1;
                let full = "×" + f.toFixed(2);
                let cs = worldToScreen(scaleCenter.x, scaleCenter.y), ms = worldToScreen(currentX, currentY);
                ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cs.x, cs.y); ctx.lineTo(ms.x, ms.y); ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(cs.x, cs.y, 5, 0, Math.PI*2); ctx.fill();
                ctx.font = "bold 12px Arial"; let meas = ctx.measureText(full);
                ctx.fillStyle = "rgba(30,30,30,0.9)"; ctx.fillRect(ms.x+15, ms.y+15, meas.width+10, 22);
                ctx.fillStyle = '#ffffff'; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(full, ms.x+20, ms.y+26);
            }

            // paroi en cours : longueur du tronçon (comme pour les droites)
            if (mode === 'wall' && wallTool && wallStart && !isPanning) {
                const cur = wallTarget(currentX, currentY, shiftHeld), dist = Math.hypot(cur.x - wallStart.x, cur.y - wallStart.y);
                const full = 'L=' + (typedInput.length > 0 ? typedInput + '_ ' + currentUnit : calculateRealDistance(dist)) + '  (' + wallThick(wallTool) + ' mm)';
                const p = worldToScreen(currentX, currentY); ctx.font = "bold 12px Arial"; const meas = ctx.measureText(full);
                ctx.fillStyle = "rgba(30,30,30,0.9)"; ctx.fillRect(p.x + 15, p.y + 15, meas.width + 10, 22); ctx.fillStyle = '#ffffff'; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(full, p.x + 20, p.y + 26);
            }
            if (isDrawing && !isPanning && (mode === 'line' || mode === 'rect' || mode === 'circle' || isPolyMode() || mode === 'arc')) {
                let full = "";
                if (mode === 'arc') {
                    if (arcStep === 1) { let dist = Math.hypot(currentX - arcCenter.x, currentY - arcCenter.y); full = "R= " + (typedInput.length > 0 ? typedInput + "_ " + currentUnit : calculateRealDistance(dist)); }
                    else if (arcStep === 2) { let diffA = (arcLastA === null ? 0 : arcAcc) * 180 / Math.PI; if (typedInput.length > 0) diffA = parseFloat(typedInput); full = "A= " + diffA.toFixed(1) + "°"; }
                } else if (mode === 'rect') {
                    // Aide dédiée rectangle : largeur ⬌ × hauteur ⬍
                    let wWorld, hWorld;
                    if (rectDimStep === 1) {
                        wWorld = rectWidthVal;
                        hWorld = (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) ? (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE : Math.abs(currentY - startY);
                    } else {
                        wWorld = (typedInput.length > 0 && !isNaN(parseFloat(typedInput))) ? (parseFloat(typedInput)/unitsPerSquare)*GRID_SIZE : Math.abs(currentX - startX);
                        hWorld = Math.abs(currentY - startY);
                    }
                    full = "⬌ " + calculateRealDistance(wWorld) + "  ⬍ " + calculateRealDistance(hWorld);
                } else {
                    let lp = isPolyMode() && currentPolygon.length > 0 ? currentPolygon[currentPolygon.length-1] : {x:startX, y:startY};
                    let dist = Math.hypot(currentX-lp.x, currentY-lp.y);
                    if (typedInput.length > 0) full = (mode === 'circle' ? "R=" : "L=") + typedInput + "_ " + currentUnit;
                    else full = (mode === 'circle' ? "R=" : "L=") + calculateRealDistance(dist);
                }
                if (full !== "") { let p = worldToScreen(currentX, currentY); ctx.font = "bold 12px Arial"; let meas = ctx.measureText(full); ctx.fillStyle = "rgba(30,30,30,0.9)"; ctx.fillRect(p.x+15, p.y+15, meas.width+10, 22); ctx.fillStyle = '#ffffff'; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(full, p.x+20, p.y+26); }
            }

            try { mailLegendDraw(ctx); } catch (e) {}
            updatePropertiesPopup();
            updateCommandMessage();
            updateGroupButtons(); updateTitle();
        }

        function updateCommandMessage() {
            let msg = "Prêt.";
            if (mode === 'select-box' && selectedShapes.length > 0 && moveTypedX !== null) msg = "DÉPLACER : ΔX = " + fmtLen(moveTypedX) + "  →  ΔY = " + (typedInput || "…") + " " + currentUnit + " puis [Espace].";
            else if (mode === 'select-box' && selectedShapes.length > 0 && typedInput.length > 0) msg = "DÉPLACER : ΔX = " + typedInput + " " + currentUnit + " puis [Espace] pour ΔY (ou [Entrée] = horizontal seul)" + (selectedShapes.some(isBg) ? " — ou [%] : opacité " + typedInput + " %." : ".");
            else if (mode === 'select-box' && selectedShapes.length > 0) msg = `${selectedShapes.length} objet(s) sélectionné(s). — Déplacer : tapez ΔX [Espace] ΔY [Espace] (${currentUnit})` + (selectedShapes.some(isBg) ? " | Opacité : XX%" : "") + " | Paramétrer ? [Y/N]";
            else if (mode === 'select-box') msg = selectedShapes.length > 0 ? `${selectedShapes.length} objet(s) sélectionné(s). — Paramétrer la sélection ? [Y/N]` : "SÉLECTION : chaque clic ajoute un objet, recliquer le retire — clic, clic dans le vide = fenêtre — bouton maintenu en glissant = lasso — Échap vide la sélection.";
            else if (mode === 'line') msg = isDrawing ? "LIGNE : Spécifiez le point suivant (distance + Espace)." : "LIGNE : Spécifiez le premier point.";
            else if (mode === 'rect') {
                if (!isDrawing) msg = "RECTANGLE : Spécifiez le premier coin.";
                else if (rectDimStep === 0) msg = "RECTANGLE : coin opposé, ou ⬌ largeur" + (typedInput ? " = " + typedInput + " " + currentUnit : "") + " puis [Espace].";
                else msg = "RECTANGLE : ⬌ " + calculateRealDistance(rectWidthVal) + "  →  ⬍ hauteur" + (typedInput ? " = " + typedInput + " " + currentUnit : "") + " puis [Espace].";
            }
            else if (mode === 'circle') msg = isDrawing ? "CERCLE : Spécifiez le rayon (valeur + Espace)." : "CERCLE : Spécifiez le centre.";
            else if (mode === 'arc') { if (arcStep === 0) msg = "ARC : Spécifiez le centre."; else if (arcStep === 1) msg = "ARC : Spécifiez le rayon et le point de départ."; else msg = "ARC : Spécifiez l'angle de fin (valeur + Espace)."; }
            else if (mode === 'pline' && trenchDraw) msg = 'TRANCHÉE « ' + (trenchDraw.name || 'nouvelle') + ' » (' + trM(trenchDraw.W) + ' × ' + trM(trenchDraw.H) + ' ' + LUN() + ') : ' + (isDrawing ? 'sommet suivant, vers l\'aval (ou longueur + Espace) — Espace / double-clic = terminer, Entrée = terminer et quitter.' : 'cliquez le premier sommet, à l\'amont.');
            else if (mode === 'pline' && batDraw) msg = 'BÂTIMENT EXISTANT : ' + (isDrawing ? 'coin suivant — Espace / double-clic = terminer (le contour se ferme tout seul).' : 'cliquez dans un bâtiment (contour fermé du dessin, bâtiment ou zone hachurée du plan PDF), ou cliquez son premier coin pour le tracer.');
            else if (mode === 'recoupe') msg = rcpMsg();
            else if (mode === 'pline' && ctDraw) msg = (ctDraw === 'bar' ? 'BAR' : 'PLAN DE TRAVAIL') + ' : ' + (isDrawing ? 'angle suivant — Espace / double-clic = terminer.' : 'cliquez le début, le long du mur (tracé = ' + ({ gauche: 'face gauche', axe: 'axe', droite: 'face droite' }[ctOpt[ctDraw].just]) + ').');
            else if (mode === 'pline' && stair2Draw) msg = 'ESCALIER D\'ÉTAGE : ' + (isDrawing ? 'sommet suivant (un palier à chaque angle) — Espace / double-clic = terminer.' : 'cliquez le pied de l\'escalier, puis tracez vers le haut (par ' + (st2Opt.just === 'axe' ? 'l\'axe' : 'la ' + st2Opt.just) + ').');
            else if (mode === 'pline' && brkDraw) msg = 'LIGNE DE RUPTURE : ' + (isDrawing ? 'sommet suivant, de préférence sur un point coté — Espace / double-clic = terminer.' : 'cliquez le premier sommet (accroché sur un point coté).');
            else if (mode === 'pline') msg = 'POLYLIGNE : ' + (isDrawing ? 'point suivant (ou longueur + Espace) — Espace / Échap / double-clic = terminer, clic sur le 1er point = fermer.' : 'cliquez le premier point.');
            else if (mode === 'pen') msg = 'PLUME : ' + (penPts.length ? 'clic = point anguleux, cliquer-glisser = point courbe — Espace / Échap / double-clic = terminer, clic sur le 1er point = fermer.' : 'cliquez (ou cliquez-glissez) le premier point.');
            else if (mode === 'lpvp') msg = 'FENÊTRE : ' + (lpVpStart ? 'cliquez le coin opposé.' : 'cliquez le 1er coin sur la feuille.');
            else if (mode === 'lpvpc') msg = 'FENÊTRE RONDE : ' + (lpVpStart ? 'cliquez pour le rayon.' : 'cliquez le centre sur la feuille.');
            else if (mode === 'lpimg') msg = 'IMAGE : ' + (lpVpStart ? 'cliquez le coin opposé du cadre.' : 'cliquez le 1er coin du cadre, puis choisissez l\'image.');
            else if (mode === 'mirror') msg = 'COPIE MIROIR (' + selectedShapes.length + ' objet(s)) : ' + (!mirrorA ? 'cliquez le 1er point de l\'axe.' : !mirrorB ? 'cliquez le 2e point de l\'axe (Maj / ortho = axe H ou V).' : 'Espace = copie miroir (garde l\'original) · Suppr = miroir sans l\'original · Échap = annuler.');
            else if (mode === 'paintzone' && brushTool) msg = 'PEINDRE — zone : cliquez dans un contour fermé pour le peindre, ou dans une zone peinte pour la repeindre ; Échap pour finir.';
            else if (isPolyMode() && brushPolyDraw && brushTool) msg = 'PINCEAU — polygone : ' + (isDrawing ? 'sommet suivant — recliquez le 1er point ou double-clic pour peindre la zone ; Échap annule.' : 'cliquez le 1er sommet de la zone à peindre ; Échap pour finir.');
            else if (isPolyMode() && boisDraw) msg = 'ZONE BOISÉE : ' + (isDrawing ? 'point suivant du contour — clic sur le 1er point ou double-clic pour fermer.' : 'cliquez le premier point du contour du bois.');
            else if (isPolyMode() && waterDraw) msg = 'NIVEAU D\'EAU : ' + (isDrawing ? 'point suivant du contour — clic sur le 1er point ou double-clic pour fermer.' : 'cliquez le premier point du contour de la zone d\'eau.');
            else if (isPolyMode()) msg = 'POLYGONE : ' + (isDrawing ? "Spécifiez le point suivant (clic sur le 1er point ou double-clic pour fermer)." : "Spécifiez le point de départ du contour.");
            else if (mode === 'stamp' && stamp) msg = 'BLOC ' + stamp.b.name + ' : ×' + nfr(stamp.sc, 2) + ' · ' + (((Math.round(stamp.rot * 180 / Math.PI) % 360) + 360) % 360) + '° — clic = poser · Maj+molette = taille · Ctrl+molette = rotation (15°) · Échap pour finir.';
            else if (mode === 'wall' && wallTool) msg = 'PAROI ' + wallTool.name + ' ' + wallThick(wallTool) + ' mm, tracé = ' + ({ gauche: 'face gauche', axe: 'axe', droite: 'face droite' }[wallTool.align] || 'face gauche') + ' : ' + (!wallStart ? (typedInput ? 'épaisseur = ' + typedInput + ' mm + Espace' : 'cliquez le début — ou tapez une épaisseur (mm) + Espace ; Tab inverse le côté.') : 'cliquez la fin, ou tapez la longueur' + (typedInput ? ' = ' + typedInput + ' ' + currentUnit : '') + ' + Espace — les parois s\'enchaînent, Échap pour finir.');
            else if (mode === 'stretch') msg = !stretchWin ? (!stretchA ? 'ÉTIRER : cliquez le 1er coin de la fenêtre (entourez les sommets à déplacer).' : 'ÉTIRER : cliquez le 2e coin de la fenêtre.') : !stretchBase ? 'ÉTIRER : ' + selectedShapes.length + ' objet(s) touché(s). Cliquez le point de base.' : 'ÉTIRER : cliquez la destination, ou tapez une distance' + (typedInput ? ' = ' + typedInput + ' ' + currentUnit : '') + ' puis Entrée (Maj = ortho).';
            else if (mode === 'fillet') msg = !filletA ? 'ARRONDIR : cliquez la 1re droite (côté à garder).' : !filletB ? 'ARRONDIR : cliquez la 2e droite (côté à garder).' : 'ARRONDIR : R = ' + (typedInput || '…') + ' ' + currentUnit + ' puis [Espace]' + (filletR !== null && !typedInput ? ' (Espace seul : ' + String(filletR).replace('.', ',') + ')' : '') + ' — 0 = angle vif.';
            else if (mode === 'opening') msg = !openA ? 'OUVERTURE : cliquez sur le mur le début de l\'ouverture (les accroches aident : angle, milieu, extrémité…).' : 'OUVERTURE : tapez la largeur' + (typedInput ? ' = ' + typedInput.replace('.', ',') + ' ' + currentUnit : ' (dernière : ' + String(openLast.w).replace('.', ',') + ' m)') + ' + Espace — la souris choisit le côté — ou cliquez la fin le long du mur.';
            else if (mode === 'bool') msg = BOOL_NAMES[boolKind] + ' : ' + (!boolA ? 'cliquez le 1er volume' + (boolKind === 'sub' ? ' (celui que l\'on garde)' : '') + '.' : 'cliquez le 2e volume' + (boolKind === 'sub' ? ' (celui que l\'on retire)' : '') + '.') + ' Échap pour annuler.';
            else if (mode === 'elevate') msg = 'ÉLEVER : cliquez l\'objet à monter ou descendre (ou sélectionnez-les avant de lancer l\'outil).';
            else if (mode === 'stack') msg = !stackObjs ? 'POSER SUR : cliquez l\'objet à poser (ou sélectionnez-les avant).' : 'POSER SUR (' + stackObjs.length + ' objet(s)) : cliquez le support — un volume, une plateforme, un objet coté, ou le terrain.';
            else if (mode === 'tilt') msg = 'INCLINER : cliquez le volume à incliner (angles autour de X et Y dans la fenêtre Y).';
            else if (mode === 'revolve') msg = !revProf ? 'RÉVOLUTION : cliquez le profil (forme fermée : demi-coupe en vraie grandeur, hauteur vers le haut du plan).' : !revAxis ? 'RÉVOLUTION : cliquez un point de l\'axe de rotation (verticale de la coupe, à gauche ou à droite du profil).' : 'RÉVOLUTION : cliquez où poser le volume sur le plan (centre).';
            else if (mode === 'sweep') msg = 'BALAYAGE : cliquez le tracé (droite, polyligne, arc, cercle) — profil ' + sweepPreset(lastSweepPreset)[1] + ', modifiable ensuite avec Y.';
            else if (mode === 'sweeppick') msg = 'BALAYAGE : cliquez la forme fermée qui sert de profil (section dessinée en vraie grandeur). Échap pour annuler.';
            else if (mode === 'extrude') msg = 'EXTRUDER : cliquez un rectangle, une polyligne fermée ou un cercle (ou sélectionnez-les avant).';
            else if (mode === 'pierce') msg = !pierceTarget ? 'PERCER : cliquez le volume à percer (pavé, extrusion, cylindre, volume soudé, maillage).' : 'PERCER : cliquez la forme fermée à évider de part en part (elle devient un trou). Échap pour finir.';
            else if (mode === 'bmplace' && bmPlace) msg = 'FOND DE CARTE (' + bmPlace.P.code + ') : ' + (bmPlace.loading ? 'chargement de la carte… ' : '') + 'rayon ' + (typedInput ? typedInput + ' m [Espace]' : bmPlace.R.toLocaleString('fr-FR') + ' m (tapez une valeur + Espace)') + ' — déplacez le cercle clair et cliquez pour l\'implanter. Échap pour quitter.';
            else if (mode === 'cubpick') msg = "CUBATURES : cliquez dans la forme qui deviendra une plateforme (polyligne fermée, hachure ou cercle), puis donnez sa cote. Échap pour annuler.";
            else if (mode === 'profile') msg = profileAxis.length ? "PROFIL EN LONG : point suivant de l'axe — [Espace] ou double-clic pour calculer (" + profileAxis.length + " point(s))." : "PROFIL EN LONG : 1er point de l'axe.";
            else if (mode === 'slope') msg = slopeP1 ? "PENTE : 2e point (la flèche indique le sens de la descente)." : "PENTE : 1er point (sur un point coté, un trait 3D ou la surface du terrain).";
            else if (mode === 'topo') {
                if (typedInput) msg = "POINT TOPO : altitude = " + typedInput + " m puis [Espace].";
                else if (lastTopo && shapes.includes(lastTopo)) msg = "POINT TOPO : posé" + (hasZ(lastTopo.z) ? " à Z " + fmtZ(lastTopo.z) + " m" : " sans altitude") + " — tapez l'altitude + [Espace] pour la changer, ou cliquez le point suivant.";
                else msg = "POINT TOPO : cliquez pour poser un point (Z repris du point accroché), puis tapez son altitude + [Espace].";
            }
            else if (mode === 'gridcal') msg = !gcal || !gcal.s ? 'CALER SUR 2 CROIX : cliquez sur le fond (plan PDF ou image) à caler.' : 'CALER SUR 2 CROIX : cliquez la ' + (gcal.P.length ? '2e croix, loin de la 1re (à l\'autre bout du plan)' : '1re croix du quadrillage') + ' — les croix lues dans le PDF sont entourées en vert et aimantent le clic. Échap pour arrêter.';
            else if (mode === 'calibrate') {
                if (!calTarget) msg = "CALIBRER : cliquez sur le fond perso à mettre à l'échelle.";
                else if (!calP1) msg = "CALIBRER : 1er point d'une longueur connue sur l'image (ex. une cote, un bord de bâtiment).";
                else if (!calP2) msg = "CALIBRER : 2e point de la longueur connue.";
                else msg = "CALIBRER : distance réelle entre les 2 points = " + (typedInput || "…") + " " + currentUnit + " puis [Espace].";
            }
            else if (isDimMode()) {
                const nm = (mode === 'dim-ortho' ? 'COTE ORTHO' : 'COTE LIBRE') + ' [' + DIM_CHAIN_LABEL[dimChain] + ']';
                if (dimStep === 0) msg = typedInput ? nm + " : type " + typedInput + " (" + ({ '0': 'simple', '1': 'cumulée', '2': 'successive' }[typedInput] || '?') + ") — VALIDEZ avec [Espace] pour appliquer ce mode."
                                                    : nm + " : 1er point — ou changez de mode : tapez 1 = cumulée, 2 = successive, 0 = simple, puis VALIDEZ avec [Espace].";
                else if (dimStep === 1) msg = nm + " : 2e point.";
                else if (dimStep === 2) msg = nm + " : position de la ligne de cote.";
                else msg = nm + " : point suivant (" + (dimChain === 'cumul' ? "depuis le 1er point" : "depuis le dernier point") + ") — [Espace] ou [Échap] pour terminer.";
            }
            else if (mode === 'dim-angle') { if (dimAngleStep === 0) msg = "ANGLE : Cliquez sur la 1ère droite (D1)."; else if (dimAngleStep === 1) msg = "ANGLE : Cliquez sur la 2ème droite (D2)."; else msg = "ANGLE : Cliquez pour poser l'arc de cotation."; }
            else if (mode === 'move') {
                if (selectedShapes.length === 0) msg = "DÉPLACER : Cliquez sur un objet.";
                else if (moveTypedX !== null) msg = "DÉPLACER : ΔX = " + fmtLen(moveTypedX) + "  →  ΔY = " + (typedInput || "…") + " " + currentUnit + " puis [Espace].";
                else if (typedInput.length > 0) msg = "DÉPLACER : ΔX = " + typedInput + " " + currentUnit + " puis [Espace] pour ΔY.";
                else if (!moveBasePoint) msg = "DÉPLACER : Point de base, ou tapez ΔX [Espace] ΔY [Espace] (" + currentUnit + ").";
                else msg = "DÉPLACER : Point de destination.";
            }
            else if (mode === 'rotate') { if (selectedShapes.length === 0) msg = "ROTATION : Cliquez sur un objet."; else if (!rotateCenter) msg = "ROTATION : Point de base (centre de rotation)."; else msg = "ROTATION : Angle de rotation (valeur + Espace)."; }
            else if (isScaleMode()) {
                const lbl = mode === 'scale-up' ? "AGRANDIR" : "RÉDUIRE", op = mode === 'scale-up' ? "×" : "÷";
                if (selectedShapes.length === 0) msg = lbl + " : Sélectionnez des éléments (ou cliquez un objet).";
                else if (!scaleCenter) msg = lbl + " : tapez le facteur (" + op + (typedInput || "n") + ") + Espace, ou cliquez le point de base.";
                else msg = lbl + " : 2e point pour définir le facteur (ou " + op + "n + Espace).";
            }
            else if (mode === 'trim') msg = "AJUSTER : Cliquez sur la portion à supprimer.";
            else if (mode === 'extend') msg = "PROLONGER : Cliquez près de l'extrémité à étendre.";
            else if (mode === 'offset') { if (!typedInput || isNaN(parseFloat(typedInput))) msg = "DÉCALER : Distance de décalage (valeur + Espace)."; else if (!offsetTarget) msg = `DÉCALER (${typedInput} ${currentUnit}) : Sélectionnez l'objet.`; else msg = `DÉCALER (${typedInput} ${currentUnit}) : Cliquez du côté voulu.`; }
            else if (mode === 'paste') msg = "COLLER : Spécifiez le point d'insertion.";
            else if (mode === 'text') msg = "TEXTE : Spécifiez le point d'insertion.";
            else if (mode === 'detail') msg = detailStep === 0 ? "DÉTAIL : Cliquez le point à désigner." : "DÉTAIL : Cliquez pour placer l'étiquette.";
            else if (mode === 'hatch') msg = "HACHURES : Cliquez à l'intérieur d'une zone fermée par des traits (re-cliquez dans une hachure pour la retirer).";
            else if (mode === 'print') msg = "IMPRESSION " + printSettings.paper + " → " + (printSettings.output === 'pdf' ? 'PDF' : printSettings.output.toUpperCase()) + " : ESPACE (pivoter) | MOLETTE (échelle) | CLIC (générer) | réglages : bouton ⛯.";
            else if (mode === 'preview') msg = "APERÇU " + (previewPin ? "(page figée)" : "(la page suit la souris)") + " : MOLETTE (échelle) | ESPACE (pivoter) | CLIC (" + (previewPin ? "libérer" : "figer") + " la page) | ENTRÉE (imprimer) | ÉCHAP (quitter).";
            msg = t2Message(msg);
            if (flashMsg && Date.now() < flashUntil) msg = flashMsg;
            if (cmdBuffer) { const a = CMD_ALIASES[cmdBuffer]; msg = 'COMMANDE : ' + cmdBuffer + '  →  ' + (a ? a[1] + ' — [Espace] pour lancer' : Object.keys(CMD_ALIASES).filter(x => x.startsWith(cmdBuffer)).map(x => x + ' = ' + CMD_ALIASES[x][1]).join(' · ') || 'inconnue'); }
            const el = document.getElementById('command-text');
            if (solidTool === 'box' && solidDalle && mode === 'poly') msg = 'DALLE : ' + (isDrawing ? 'sommet suivant (' + currentPolygon.length + ' posé' + (currentPolygon.length > 1 ? 's' : '') + ') ; recliquez le 1er point (ou double-clic) pour fermer le contour.' : 'cliquez le 1er angle du contour, puis les suivants : forme libre (ou sélectionnez d\'abord un contour fermé).') + ' Épaisseur 20 cm, réglable avec Y.';
            else if (solidTool === 'roof' && mode === 'poly') msg = 'TOITURE : ' + (isDrawing ? 'sommet ' + (currentPolygon.length + 1) + ' — autant de sommets que le bâtiment en a ; recliquez le 1er point pour refermer. Accroche aux angles et aux faces des murs.' : 'cliquez le 1er angle du contour (forme libre, autant de côtés qu\'il faut), ou sélectionnez d\'abord le contour du bâtiment.') + ' Ensuite : terrasse, 1 pan, 2 pans ou pans multiples.';
            else if (solidTool && (mode === 'rect' || mode === 'circle' || mode === 'line')) msg = msg.replace(/^(RECTANGLE|CERCLE|LIGNE)/, SOLID_NAMES[solidTool].toUpperCase()) + (solidTool === 'sphere' ? '' : solidTool === 'roof' ? ' — ensuite : 1 ou 2 pans, égout et faîtage.' : ' — la hauteur se tape ensuite.');
            if (el) el.textContent = msg;
        }

        function updatePropertiesPopup() {
            const popup = document.getElementById('properties-popup'), content = document.getElementById('prop-popup-content'), title = document.getElementById('prop-popup-title');
            if (!popup || !content || !title) return; // garde-fou : ne jamais casser draw()
            spFollowSel();
            if (selectedShapes.length === 0) { popup.classList.add('hidden'); return; }
            popup.classList.remove('hidden');
            title.textContent = selectedShapes.length === 1 ? 'Propriétés de l\'objet' : `Sélection multiple (${selectedShapes.length})`;
            let totalLength = 0, totalArea = 0, radius = 0;
            const distFactor = unitsPerSquare / GRID_SIZE, areaFactor = distFactor * distFactor;
            selectedShapes.forEach(s => {
                if (s.type === 'line') { totalLength += Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * distFactor; }
                else if (s.type === 'dim') { const g = dimGeom(s); if (g) totalLength += g.dist * distFactor; }
                else if (s.type === 'circle') { let r = s.r * distFactor; radius = r; totalLength += 2 * Math.PI * r; totalArea += Math.PI * r * r; }
                else if (s.type === 'arc') { let r = s.r * distFactor; radius = r; let dAngle = s.endAngle - s.startAngle; if (dAngle < 0) dAngle += 2 * Math.PI; totalLength += r * dAngle; }
                else if (s.type === 'hatch') { totalArea += hatchArea(s) * areaFactor; }
                else if (s.type === 'poly') { let pLen = 0; for (let i = 0; i < polyEdges(s); i++) { const q = s.points[(i + 1) % s.points.length]; pLen += Math.hypot(q.x - s.points[i].x, q.y - s.points[i].y); } totalLength += pLen * distFactor; if (!s.open && s.points.length > 2) { let area = 0; for (let i = 0; i < s.points.length; i++) { let j = (i + 1) % s.points.length; area += s.points[i].x * s.points[j].y; area -= s.points[j].x * s.points[i].y; } totalArea += Math.abs(area / 2) * areaFactor; } }
            });
            let html = '';
            const fmt = (val) => fmtLen(val);
            const fmtArea = (val) => fmtSurface(val);
            if (selectedShapes.length === 1 && (selectedShapes[0].type === 'circle' || selectedShapes[0].type === 'arc')) html += `<div class="flex justify-between items-center"><span>Rayon:</span> <span class="font-mono text-cyan-300 ml-4 font-bold">${fmt(radius)}</span></div>`;
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'dim-angle') {
                const s = selectedShapes[0];
                const a1 = Math.atan2(s.p1.y - s.vertex.y, s.p1.x - s.vertex.x);
                const a2 = Math.atan2(s.p2.y - s.vertex.y, s.p2.x - s.vertex.x);
                let diff = Math.abs(a2 - a1); if (diff > Math.PI) diff = 2*Math.PI - diff;
                html += `<div class="flex justify-between items-center"><span>Angle:</span> <span class="font-mono text-orange-300 ml-4 font-bold">${(diff*180/Math.PI).toFixed(2)}°</span></div>`;
            }
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'dimr') { const g = t2DimRGeom(selectedShapes[0]); if (g) html += `<div class="flex justify-between items-center"><span>${selectedShapes[0].dia ? 'Diamètre' : 'Rayon'}:</span> <span class="font-mono text-amber-300 ml-4 font-bold">${fmtLen((selectedShapes[0].dia ? 2 : 1) * g.r * distFactor)}</span></div>`; }
            if (totalLength > 0) { let lbl = (selectedShapes.length === 1 && (selectedShapes[0].type === 'circle' || (selectedShapes[0].type === 'poly' && !selectedShapes[0].open))) ? 'Périmètre:' : 'Longueur:'; if (selectedShapes.length > 1) lbl = 'Long. totale:'; html += `<div class="flex justify-between items-center"><span>${lbl}</span> <span class="font-mono text-blue-300 ml-4 font-bold">${fmt(totalLength)}</span></div>`; }
            if (totalArea > 0) { let lbl = selectedShapes.length > 1 ? 'Aire totale:' : 'Aire:'; html += `<div class="flex justify-between items-center"><span>${lbl}</span> <span class="font-mono text-green-400 ml-4 font-bold">${fmtArea(totalArea)}</span></div>`; }
            if (selectedShapes.length === 1 && ['line', 'poly', 'circle', 'arc', 'point'].includes(selectedShapes[0].type)) {
                const b = selectedShapes[0], esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const zin = (what, z, label) => `<div class="flex justify-between items-center"><span>${label}</span> <span class="font-mono text-lime-300 ml-4">${hasZ(z) ? fmtZ(z) + ' m' : '—'}</span></div>`;
                html += `<div class="border-t border-gray-600 mt-1 pt-1"></div>`;
                if (b.type === 'line') {
                    html += zin('z1', b.z1, 'Z départ:') + zin('z2', b.z2, 'Z arrivée:');
                    if (hasZ(b.z1) && hasZ(b.z2)) {
                        const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * distFactor * (UNIT_MM[currentUnit] || 1), dz = b.z2 - b.z1;
                        html += `<div class="flex justify-between items-center"><span>Dénivelée:</span> <span class="font-mono text-lime-300 ml-4">${dz >= 0 ? '+' : ''}${fmtZ(dz)} m</span></div>`;
                        if (L > 0) html += `<div class="flex justify-between items-center"><span>Pente:</span> <span class="font-mono text-lime-300 ml-4 font-bold">${(dz / L * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</span></div>`;
                        html += `<div class="flex justify-between items-center"><span>Longueur 3D:</span> <span class="font-mono text-lime-300 ml-4">${fmtLen(Math.hypot(L, dz) / (UNIT_MM[currentUnit] || 1))}</span></div>`;
                    }
                } else if (b.type === 'poly') {
                    const zs = b.points.map(p => p.z).filter(hasZ);
                    html += `<div class="flex justify-between items-center"><span>Z sommets:</span> <span class="font-mono text-lime-300 ml-4">${zs.length ? fmtZ(arrMin(zs)) + (arrMax(zs) !== arrMin(zs) ? ' → ' + fmtZ(arrMax(zs)) : '') + ' m (' + zs.length + '/' + b.points.length + ')' : '—'}</span></div>`;
                    html += zin('all', zs.length && zs.every(z => z === zs[0]) && zs.length === b.points.length ? zs[0] : undefined, 'Z de tous:');
                    if (isPlateforme(b)) { const t = platTalus(b); html += `<div class="flex justify-between items-center"><span>Plateforme:</span> <span class="font-mono text-lime-300 ml-4">${talusInfo(b, true)}</span></div>`; }
                } else if (b.type === 'point') {
                    html += `<div class="flex justify-between items-center"><span>Point topo:</span> <span class="font-mono text-lime-300 ml-4">X ${fmtNum(realX(b.x) / (UNIT_MM[currentUnit] || 1))}  Y ${fmtNum(realY(b.y) / (UNIT_MM[currentUnit] || 1))}</span></div>`;
                    html += zin('z', b.z, 'Altitude Z:');
                    html += `<div class="flex justify-between items-center"><span>Matricule:</span> <span class="ml-4 text-gray-200">${esc(b.mat || '—')}</span></div>`;
                    if (b.code) html += `<div class="flex justify-between items-center"><span>Code:</span> <span class="ml-4 text-gray-300">${esc(b.code)}</span></div>`;
                } else { html += zin('z', b.z, 'Altitude Z:'); if (isPlateforme(b)) { const t = platTalus(b); html += `<div class="flex justify-between items-center"><span>Plateforme ronde:</span> <span class="font-mono text-lime-300 ml-4">${talusInfo(b, true)}</span></div>`; } }
                html += `<div class="text-gray-500 text-xs mt-1">Modifier le Z${b.type === 'point' ? ' / matricule' : ''} : tapez <b>Y</b></div>`;
            }
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'mesh') {
                const m = selectedShapes[0], k = m.sc || 1, esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                html += `<div class="flex justify-between items-center"><span>Maillage 3D:</span> <span class="text-violet-300 ml-4 truncate max-w-[10rem]" title="${esc(m.name || '')}">${esc(m.name || 'maillage')}</span></div>`;
                html += `<div class="flex justify-between items-center"><span>Triangles:</span> <span class="font-mono text-violet-300 ml-4">${(m.ntri || 0).toLocaleString('fr-FR')}</span></div>`;
                html += `<div class="flex justify-between items-center"><span>Taille:</span> <span class="font-mono text-violet-300 ml-4">${nfr((m.bb.x1 - m.bb.x0) * k / 1000, 2)} × ${nfr((m.bb.y1 - m.bb.y0) * k / 1000, 2)} × ${nfr(m.bb.h * k / 1000, 2)} m</span></div>`;
                html += `<div class="flex justify-between items-center"><span>Z bas → haut:</span> <span class="font-mono text-lime-300 ml-4">${fmtZ(m.z0)} → ${fmtZ(m.z0 + m.bb.h * k)} m</span></div>`;
            }
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'bgimage') {
                const b = selectedShapes[0], esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                html += `<div class="flex justify-between items-center"><span>Fond perso:</span> <span class="text-sky-300 ml-4 truncate max-w-[10rem]" title="${esc(b.name || '')}">${esc(b.name || 'image')}</span></div>`;
                html += `<div class="flex justify-between items-center"><span>Taille:</span> <span class="font-mono text-sky-300 ml-4">${fmtLen(b.w * distFactor)} × ${fmtLen(b.h * distFactor)}</span></div>`;
                html += `<div class="flex justify-between items-center"><span>Opacité:</span> <span class="font-mono text-sky-300 ml-4">${Math.round((b.opacity === undefined ? 1 : b.opacity) * 100)} %</span></div>`;
                html += `<button class="mt-2 w-full px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs" onclick="startCalibrate()">📏 Calibrer l'échelle (2 clics + distance)</button>`;
                html += `<button class="mt-1 w-full px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs" onclick="gcalStart()">🧭 Caler sur 2 croix du carroyage</button>`;
            }
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'basemap') {
                const b = selectedShapes[0], esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                const realR = worldToMm(b.r) / 1000;
                html += `<div class="flex justify-between items-center"><span>Fond de carte:</span> <span class="font-mono text-emerald-300 ml-4">R ${realR.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m</span></div>`;
                if (Math.abs(realR - b.radiusM) > 1e-6 * b.radiusM) html += `<div class="text-yellow-300 text-xs">Agrandi/réduit : n'est plus à l'échelle (d'origine ${b.radiusM.toLocaleString('fr-FR')} m)</div>`;
                html += `<div class="text-gray-400 text-xs">${b.label ? esc(b.label) + ' — ' : ''}${b.lat.toFixed(5)}, ${b.lon.toFixed(5)}</div>`;
                html += `<div class="flex justify-between items-center"><span>Opacité:</span> <span class="font-mono text-emerald-300 ml-4">${Math.round((b.opacity === undefined ? 1 : b.opacity) * 100)} %</span></div>`;
                html += `<label class="flex justify-between items-center mt-1"><span>Carte:</span> <select class="ml-4 bg-gray-700 text-emerald-300 border border-gray-600 rounded px-1 py-0.5 text-xs outline-none" title="Changer la carte de fond (nouveau téléchargement)" onchange="changeBasemapBase(this.value)">${Object.keys(BM_BASES).filter(k => BM_PHOTO.includes(k) || k === (b.base || 'sat')).map(k => `<option value="${k}" ${(b.base || 'sat') === k ? 'selected' : ''}>${BM_BASES[k].name}</option>`).join('')}</select></label>`;
                html += `<label class="flex justify-between items-center mt-1"><span>Netteté:</span> <select class="ml-4 bg-gray-700 text-emerald-300 border border-gray-600 rounded px-1 py-0.5 text-xs outline-none" title="Retélécharger ce fond plus net (même carte, même cercle)" onchange="bmSharpen(this.value)">${[['std', 'Standard'], ['hd', 'Haute'], ['uhd', 'Très haute']].map(([k, l]) => `<option value="${k}" ${(b.hd || 'std') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
                html += `<button type="button" class="mt-1.5 w-full text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded px-2 py-1 text-green-300" title="Grille de points cotés sur le cercle du fond (calque TN IGN), pas réglé dans ⛯ Paramètres › Fond de plan" onclick="tnFetchSelected()">⛰ Terrain IGN : points cotés${b.tnPas ? ' (pas ' + b.tnPas + ' m ✓)' : ''}</button>`;
                html += `<button type="button" class="mt-1 w-full text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded px-2 py-1 text-pink-300" title="Parcelles (et bâti) de la zone, en polylignes sur des calques « Cadastre » : on peut s'y accrocher, les coter, les modifier" onclick="cadFetchSelected()">🗺 Cadastre vectorisé sur un calque${b.cadVec ? ' (' + b.cadVec.n + ' parcelles ✓)' : ''}</button>`;
                html += `<div class="text-gray-400 text-xs mt-1.5 mb-0.5">Calques</div>`;
                BM_OVL_LIST.forEach(k => { const has = !!basemapStore[b.mapId + '_' + k];
                    html += `<label class="flex justify-between items-center cursor-pointer select-none py-px" title="${has ? 'Afficher / masquer : ' + BM_OVLS[k].sub : 'Pas encore téléchargé : cochez pour le télécharger (' + BM_OVLS[k].sub + ')'}"><span>${BM_OVLS[k].name}${has ? '' : ' <span class="text-gray-500">⇣</span>'}</span> <input type="checkbox" class="bm-switch ml-4" data-ovl="${k}" ${bmOvlOn(b, k) ? 'checked' : ''} onchange="toggleBasemapOverlay('${k}', this.checked)"></label>`; });
            }
            if (html === '') html = '<div class="text-gray-500 italic">Aucune géométrie calculable</div>';
            if (selectedShapes.length === 1 && selectedShapes[0].solid) { const V = solidVolume(selectedShapes[0]); if (V > 0) html += `<div class="border-t border-gray-600 mt-1 pt-1"></div><div class="flex justify-between items-center"><span>${SOLID_NAMES[selectedShapes[0].solid.kind] || 'Volume'}:</span> <span class="font-mono text-violet-300 ml-4 font-bold">${nfr(V, 3)} m³</span></div>`; }
            if (selectedShapes.length === 1 && selectedShapes[0].type === 'mesh' && selectedShapes[0].csg) html += `<div class="border-t border-gray-600 mt-1 pt-1"></div><div class="flex justify-between items-center"><span>${selectedShapes[0].name || 'Volume'}:</span> <span class="font-mono text-violet-300 ml-4 font-bold">${nfr(meshVolume(selectedShapes[0]), 3)} m³</span></div>`;
            if (selectedShapes.length === 1 && selectedShapes[0].sweep) { const I = sweepInfo(selectedShapes[0]); if (I) html += `<div class="border-t border-gray-600 mt-1 pt-1"></div><div class="flex justify-between items-center"><span>Balayage:</span> <span class="font-mono text-violet-300 ml-4">${sweepPreset(selectedShapes[0].sweep.p)[0]}</span></div><div class="flex justify-between items-center"><span>Section:</span> <span class="font-mono text-violet-300 ml-4">${nfr(I.A, 4)} m²</span></div><div class="flex justify-between items-center"><span>Volume:</span> <span class="font-mono text-violet-300 ml-4 font-bold">${nfr(I.vol, 3)} m³</span></div>`; }
            content.innerHTML = html;
        }

        // =====================================================================
        // EVENTS
