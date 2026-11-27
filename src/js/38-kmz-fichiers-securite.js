        // ---- KMZ / KML (Google Earth, Géoportail…) : points, lignes et polygones, un calque par dossier, projetés en Lambert 93 (ou la zone CC du plan).
        //      Posés sur le plan, ou convertis tout de suite en DXF (coordonnées réelles). Le KMZ est une archive zip : lue sans bibliothèque.
        async function zipEntries(buf) { const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
            for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; } if (e < 0) throw new Error('archive KMZ illisible');
            const n = dv.getUint16(e + 10, true), out = []; let p = dv.getUint32(e + 16, true);
            for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) { const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
                out.push({ name: new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), meth: dv.getUint16(p + 10, true), csz: dv.getUint32(p + 20, true), lo: dv.getUint32(p + 42, true) }); p += 46 + nl + xl + cl; }
            const read = async (x) => { const nl = dv.getUint16(x.lo + 26, true), xl = dv.getUint16(x.lo + 28, true), d = u8.slice(x.lo + 30 + nl + xl, x.lo + 30 + nl + xl + x.csz);
                if (x.meth === 0) return new TextDecoder().decode(d); if (x.meth !== 8) throw new Error('compression non gérée');
                return await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
            return { list: out, read }; }
        const kmlCol = (t) => { const h = String(t || '').trim().replace('#', ''); return h.length === 8 ? '#' + h.slice(6, 8) + h.slice(4, 6) + h.slice(2, 4) : null; };
        const kmlXY = (t) => String(t || '').trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(a => a.length >= 2 && isFinite(a[0]) && isFinite(a[1]));
        const kmlKid = (el, tag) => [...el.children].find(c => c.localName === tag);
        function kmlParse(txt) { const doc = new DOMParser().parseFromString(txt, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('KML illisible');
            const tags = (el, t) => [...el.getElementsByTagNameNS('*', t)], txt1 = (el, t) => { const x = el && tags(el, t)[0]; return x ? x.textContent.trim() : ''; }, sty = {};
            tags(doc, 'Style').forEach(st => { const id = st.getAttribute('id'); const c = txt1(tags(st, 'LineStyle')[0], 'color') || txt1(tags(st, 'PolyStyle')[0], 'color') || txt1(tags(st, 'IconStyle')[0], 'color'); if (id && c) sty['#' + id] = kmlCol(c); });
            tags(doc, 'StyleMap').forEach(sm => { const id = sm.getAttribute('id'), pr = tags(sm, 'Pair').find(p => txt1(p, 'key') === 'normal'); if (id && pr) sty['#' + id] = sty[txt1(pr, 'styleUrl')] || null; });
            const F = [];
            tags(doc, 'Placemark').forEach(pm => { const name = (kmlKid(pm, 'name') || {}).textContent || ''; let fo = '', a = pm.parentElement; while (a) { if (a.localName === 'Folder' || a.localName === 'Document') { const nm = kmlKid(a, 'name'); if (nm && nm.textContent.trim()) { fo = nm.textContent.trim(); break; } } a = a.parentElement; }
                const inl = tags(pm, 'Style')[0], col = (inl && (kmlCol(txt1(tags(inl, 'LineStyle')[0], 'color')) || kmlCol(txt1(tags(inl, 'PolyStyle')[0], 'color')))) || sty[txt1(pm, 'styleUrl')] || null, base = { name: name.trim(), fo, col };
                tags(pm, 'Point').forEach(g => { const c = kmlXY(txt1(g, 'coordinates'))[0]; if (c) F.push(Object.assign({ k: 'pt', c: [c] }, base)); });
                tags(pm, 'LineString').forEach(g => { const c = kmlXY(txt1(g, 'coordinates')); if (c.length > 1) F.push(Object.assign({ k: 'ln', c }, base)); });
                tags(pm, 'Polygon').forEach(g => { const ob = tags(g, 'outerBoundaryIs')[0], c = kmlXY(txt1(ob, 'coordinates')); if (c.length > 2) F.push(Object.assign({ k: 'pg', c }, base));
                    tags(g, 'innerBoundaryIs').forEach(ib => { const h = kmlXY(txt1(ib, 'coordinates')); if (h.length > 2) F.push(Object.assign({ k: 'pg', c: h, hole: true }, base)); }); }); });
            return F; }
        // projection : celle du plan s'il est géoréférencé ; sinon Lambert 93 (Paramètres › Fond de plan) et l'origine se cale sur le fichier
        function kmlProj(F, setOrigin) { let la0 = 0, n0 = 0; F.forEach(f => f.c.forEach(c => { la0 += c[1]; n0++; })); let P = detectCRS() || crsPrefP(n0 ? la0 / n0 : NaN);
            if (setOrigin && !geoOrigin.x && !geoOrigin.y) { let la = 0, lo = 0, n = 0; F.forEach(f => f.c.forEach(c => { lo += c[0]; la += c[1]; n++; })); const q = lccFwd(P, la / n, lo / n), had = shapes.some(x => !isBg(x)), c = screenToWorld(canvas.width / 2, canvas.height / 2);
                geoOrigin = had ? { x: q.x * 1000 - worldToMm(c.x), y: q.y * 1000 + worldToMm(c.y) } : { x: Math.floor(q.x / 1000) * 1e6, y: Math.floor(q.y / 1000) * 1e6 }; }
            return P; }
        const KML_PAL = ['#f59e0b', '#22d3ee', '#a3e635', '#f472b6', '#c084fc', '#fb7185', '#34d399', '#facc15'];
        function kmlShapes(F, base) { const P = kmlProj(F, true), W = (c) => worldOfLL(P, c[1], c[0]), out = [], lay = {};
            const L = (f) => { const nm = 'KMZ · ' + (f.fo || base); if (!lay[nm]) lay[nm] = ensureLayer(nm, f.col || KML_PAL[Object.keys(lay).length % KML_PAL.length]); return lay[nm]; };
            const Z = (c) => c.length > 2 && c[2] ? Math.round(c[2] * 1000) : undefined;
            F.forEach(f => { const layerId = L(f), pts = f.c.map(c => { const q = W(c), z = Z(c); return z !== undefined ? { x: q.x, y: q.y, z } : { x: q.x, y: q.y }; });
                if (f.k === 'pt') { const s = Object.assign({ type: 'point', layerId, x: pts[0].x, y: pts[0].y }, pts[0].z !== undefined ? { z: pts[0].z, zk: 1 } : {}); if (f.name) { s.mat = f.name; s.name = f.name; } out.push(s); return; }
                let Q = pts; if (f.k === 'pg' && Q.length > 3 && Math.hypot(Q[0].x - Q[Q.length - 1].x, Q[0].y - Q[Q.length - 1].y) < 1e-9) Q = Q.slice(0, -1);
                const s = { type: 'poly', layerId, points: Q, open: f.k === 'ln', hatch: false }; if (f.name) s.name = f.name; out.push(s); });
            return { out, P }; }
        async function kmzRead(f) { const nm = f.name || ''; if (/\.kml$/i.test(nm)) return kmlParse(await f.text());
            const Z = await zipEntries(await f.arrayBuffer()), K = Z.list.filter(e => /\.kml$/i.test(e.name)); if (!K.length) throw new Error('aucun fichier KML dans l\'archive');
            let F = []; for (const e of K) F = F.concat(kmlParse(await Z.read(e))); return F; }
        async function kmzOpen(f) { const nm = f.name || 'fichier.kmz', base = nm.replace(/\.km[lz]$/i, ''); let F;
            try { F = await kmzRead(f); } catch (e) { updateCommandMessageText('KMZ : ' + e.message + '.'); return; }
            if (!F.length) { updateCommandMessageText('KMZ : aucun point, ligne ni polygone dans « ' + nm + ' ».'); return; }
            const cnt = (k) => F.filter(x => x.k === k).length, fos = [...new Set(F.map(x => x.fo || base))], P = detectCRS() || crsPrefP(F.length && F[0].c.length ? F[0].c[0][1] : NaN);
            openTopoModal('🌍 ' + nm, `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#e5e7eb;max-width:440px">
                <div><b>${cnt('pt')}</b> point(s), <b>${cnt('ln')}</b> ligne(s), <b>${cnt('pg')}</b> polygone(s), en <b>${fos.length}</b> calque(s) : ${fos.slice(0, 6).map(x => '« ' + MF.esc(x) + ' »').join(', ')}${fos.length > 6 ? '…' : ''}</div>
                <div class="mf-hint" style="margin:0">Projeté en ${crsName(P.code)}${geoOrigin.x || geoOrigin.y ? ', aux coordonnées du plan' : ''}. Les altitudes du fichier sont gardées quand il y en a.</div></div>`,
                [['Annuler', () => closeTopoModal(), false], ['Convertir en DXF', () => { closeTopoModal(); kmzToDXF(F, base); }, false], ['Poser sur le plan', () => { closeTopoModal(); kmzPlace(F, base, nm); }, true]]); }
        function kmzPlace(F, base, nm) { if (mode === 'print' || mode === 'preview') setMode('select-box'); const { out, P } = kmlShapes(F, base);
            shapes = shapes.concat(out); selectedShapes = out; invalidateCache(); saveState(); updateLayerUI(); zoomToFitShapes(out); try { updatePropertiesPopup(); } catch (e) {} draw();
            updateCommandMessageText('KMZ : ' + nm + ' — ' + out.length + ' objet(s) posé(s) en ' + crsName(P.code) + ', calques « KMZ · … ». Fichier › Enregistrer en DXF pour le convertir.'); return out; }
        function kmzToDXF(F, base) { const keep = { shapes, layers: layers.slice(), go: Object.assign({}, geoOrigin), sel: selectedShapes }; let dxf;
            try { shapes = []; geoOrigin = { x: 0, y: 0 }; const { out } = kmlShapes(F, base); shapes = out; invalidateCache(); dxf = exportDXF(); }
            finally { shapes = keep.shapes; layers = keep.layers; geoOrigin = keep.go; selectedShapes = keep.sel; invalidateCache(); updateLayerUI(); draw(); }
            const blob = new Blob([encodeCp1252(dxf.replace(/\r?\n/g, '\r\n'))], { type: 'application/dxf' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = base + '.dxf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
            updateCommandMessageText('KMZ → DXF : « ' + base + '.dxf » téléchargé (' + F.length + ' objet(s), coordonnées ' + crsName((detectCRS() || crsPrefP(F.length && F[0].c.length ? F[0].c[0][1] : NaN)).code) + ').'); return dxf; }
        function importKMZFile(ev) { const f = ev.target.files[0]; ev.target.value = ''; if (f) kmzOpen(f); }
        function importDXFFile(event) { const file = event.target.files[0]; event.target.value = ''; if (!file) return; dxfOverlayAsk(file, file.name, true); }
        async function dxfText(f) { const buf = new Uint8Array(await f.arrayBuffer()); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { return new TextDecoder('windows-1252').decode(buf); } }
        // DXF déposé sur un plan qui a déjà un dessin : l'ouvrir à la place, ou le superposer (mêmes coordonnées)
        function dxfOverlayAsk(f, name, fromMenu) { const base = String(name || 'DXF').replace(/\.dxf$/i, '');
            openTopoModal('📐 ' + name, `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:#e5e7eb;max-width:420px">
                <div>${fromMenu ? 'Ce DXF va être posé <b>par-dessus</b> le plan en cours, à ses coordonnées.' : 'Le plan en cours a déjà un dessin. Ce DXF : à la place, ou <b>par-dessus</b> (superposé, à ses coordonnées) ?'}</div>
                <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="dxo-pre" checked style="margin-top:3px"><span><b>Ranger ses calques sous « ${MF.esc(base)} »</b><br><span class="mf-hint" style="margin:0">« ${MF.esc(base)} · Murs »… : séparés des vôtres, et un seul œil pour afficher ou masquer tout ce DXF dans la liste des calques. Décoché : ses calques se mêlent aux vôtres de même nom.</span></span></label></div>`,
                [['Annuler', () => closeTopoModal(), false]].concat(fromMenu ? [] : [['Ouvrir à la place', async () => { closeTopoModal(); if (isDirty() && !confirm('Le plan en cours a des modifications non enregistrées. Les abandonner ?')) return; const ok = await loadFileObject(f, name, true); if (ok) fileHandle = null; }, false]],
                [['Superposer', async () => { const pre = document.getElementById('dxo-pre').checked; closeTopoModal(); dxfOverlay(await dxfText(f), name, pre ? base : null); }, true]])); }
        function dxfOverlay(txt, name, prefix) { if (mode === 'print' || mode === 'preview') setMode('select-box'); const L0 = layers.length; let res;
            dxfLayerPrefix = prefix || null; try { res = importDXF(txt); } catch (err) { console.error(err); layers.length = L0; updateCommandMessageText('DXF illisible : ' + err.message); return 0; } finally { dxfLayerPrefix = null; }
            if (!res.shapes.length) { layers.length = L0; updateCommandMessageText('Aucune entité compatible trouvée dans ' + name + '.'); return 0; }
            shapes = shapes.concat(res.shapes); selectedShapes = res.shapes; invalidateCache(); saveState(); updateLayerUI(); zoomToFitShapes(shapes.filter(x => !isBg(x))); try { updatePropertiesPopup(); } catch (e) {} draw();
            updateCommandMessageText('SUPERPOSÉ : ' + name + ' — ' + res.shapes.length + ' entité(s)' + dxfExtraMsg(res) + (prefix ? ', calques sous « ' + prefix + ' »' : '') + (res.ignored ? ', ' + res.ignored + ' non gérée(s) ignorée(s)' : '') + '. Ils restent sélectionnés (déplacer, supprimer…) ; Ctrl+Z pour annuler.' + dxfXrefMsg(res)); return res.shapes.length; }

        // =====================================================================
        // FICHIER : Ouvrir / Enregistrer / Enregistrer sous
        //  - .mmc : plan MomoCAD complet (JSON) ; .momocad / .json : anciens noms, toujours lisibles
        //  - .dxf : format AutoCAD (géométrie, calques, hachures ; sans fonds de carte ni cartouche)
        // Chrome / Edge : vrai fichier sur le disque (API File System Access), « Enregistrer » réécrit le même fichier.
        // Autres navigateurs : Enregistrer = téléchargement, Ouvrir = sélecteur de fichier classique.
        // =====================================================================
        let fileHandle = null, fileName = '', savedRef = null;
        const MMC_TYPE = { description: 'Plan MomoCAD (.mmc)', accept: { 'application/json': ['.mmc'] } };
        const DXF_TYPE = { description: 'Plan DXF (.dxf)', accept: { 'application/dxf': ['.dxf'] } };
        const OPEN_TYPES = [{ description: 'Plans MomoCAD, DXF, KMZ / KML', accept: { 'application/json': ['.mmc', '.momocad', '.json'], 'application/dxf': ['.dxf'], 'application/x-momocad-gabarit': ['.gbt'], 'application/vnd.google-earth.kmz': ['.kmz'], 'application/vnd.google-earth.kml+xml': ['.kml'] } }];
        const isDxfName = (n) => /\.dxf$/i.test(n || '');
        function projectData() { const ps = lpPaperShapes(); return withModel(() => _projectData(ps)); }
        function _projectData(paperList) {
            const basemaps = {}; shapes.forEach(sh => { if (!isBg(sh)) return; Object.keys(basemapStore).forEach(k => { if (k === sh.mapId || (sh.type === 'basemap' && k.startsWith(sh.mapId + '_'))) basemaps[k] = basemapStore[k]; }); });
            const meshes = {}; shapes.forEach(sh => { if (sh.type === 'mesh' && meshStore[sh.meshId]) meshes[sh.meshId] = f32ToB64(meshStore[sh.meshId]); });
            const vecs = {}; shapes.forEach(sh => { if (sh.type === 'pdfvec' && vecStore[sh.vecId] && !vecs[sh.vecId]) vecs[sh.vecId] = vecPack(vecStore[sh.vecId]); });
            const c = screenToWorld(canvas.width / 2, canvas.height / 2);
            return { app: 'MomoCAD', version: '1.3', format: MMC_FORMAT, scale: { value: unitsPerSquare, unit: currentUnit }, layers, activeLayerId, snapSettings, shapes,
                     cartouche: cartoucheData, basemaps, meshes, vecs, gridMm, geoOrigin, view: { cx: c.x, cy: c.y, zoom: camera.zoom },
                     // réglages d'affichage et d'impression du plan
                     settings: { unit: printSettings.unit, decimals: printSettings.decimals, dimText: dimTextAligned ? 'aligned' : 'horizontal', dimStyle: Object.assign({}, dimStyle),
                                 paper: printSettings.paper, output: printSettings.output, cartouche: !!printSettings.cartouche, orientation: printOrientation },
                     talus: { on: cubState.talus, kR: cubState.kR, kD: cubState.kD }, pluvio: pluvioNote ? Object.assign({}, pluvioNote, { S: undefined }) : undefined, pin3d: v3PinSave(), sol: solNote || undefined, maill: mailNote || undefined, levels: bldActId ? lvlsGlobal : lvls, layout: Object.assign({}, layoutData, { paperShapes: paperList || lpPaperShapes() }),
                     layouts: lpSync().map(L => L === layoutData ? { $cur: 1 } : L), layoutIdx, studio: studio.views.length || studio.fmt !== '16:9' || studio.f !== 35 ? studio : undefined };
        }
        function fileBytes(name) {
            if (isDxfName(name)) return encodeCp1252(exportDXF().replace(/\r?\n/g, '\r\n'));
            return new TextEncoder().encode(JSON.stringify(projectData()));
        }
        // la mise en page compte aussi : fenêtres, feuille, textes de la feuille
        function lpSig() { try { const L = layoutData || {}; return JSON.stringify([(typeof layouts !== 'undefined' ? layouts : []).map(Q => [Q.name, Q.paper, Q.orient, Q.cartouche, Q.cartType, Q.margin, Q.folds, (Q.vps || []).length, JSON.stringify(Q.cart || {})]), L.paper, L.orient, L.cartouche, L.margin, L.folds, (L.vps || []).map(v => [v.x, v.y, v.w, v.h, v.scale, v.cx, v.cy, v.cz, v.a, v.e, v.title, v.plat, v.locked, v.noFrame, v.round, v.kind, v.v3 ? [v.v3.az, v.v3.el, v.v3.dist, v.v3.tx, v.v3.ty] : 0, v.src ? v.src.length : 0]), (lpPaperShapes() || []).length, lpSpace === 'paper' ? historyStep : (lpPaperHist ? lpPaperHist.step : 0), JSON.stringify(cartoucheData).length]); } catch (e) { return ''; } }
        let savedLp = '';
        function isDirty() { return shapesHistory[historyStep] !== savedRef || lpSig() !== savedLp || JSON.stringify(v3PinSave()) !== savedPin; }   /* drapeau 3D déplacé : à enregistrer aussi */
        let savedPin = 'null'; function markSaved() { savedRef = shapesHistory[historyStep]; savedLp = lpSig(); savedPin = JSON.stringify(v3PinSave()); updateTitle(); if (window.__asReady) asClean(); }
        // =====================================================================
        // ENREGISTREMENT AUTOMATIQUE : toutes les 2 minutes (et quand l'onglet passe en arrière-plan) si le plan a changé,
        // le plan complet part dans le navigateur (IndexedDB) ; on garde les 10 dernières sauvegardes.
        // Au démarrage, si la dernière session s'est arrêtée sur des modifications non enregistrées, on propose de les récupérer.
        // =====================================================================
        const AS_MAX = 10, AS_EVERY = 120000;
        // ---- FILET DE SÉCURITÉ : une erreur inattendue ne fait rien perdre. Le plan part aussitôt en sauvegarde automatique, un message discret le dit,
        //      et un petit journal des incidents (20 derniers, dans ce navigateur) peut être copié pour signaler le problème.
        const MC_INC = { t: 0, toast: 0, seen: new Set() };
        function mcIncident(err, where) { try { const msg = String((err && (err.message || err)) || 'erreur inconnue'), st = String((err && err.stack) || '').split('\n').slice(0, 4).map(x => x.trim()).join(' | ');
                if (/ResizeObserver loop|^Script error\.?$/i.test(msg)) return; const key = msg + '|' + (where || ''); const first = !MC_INC.seen.has(key); MC_INC.seen.add(key);
                if (first) { let L = []; try { L = JSON.parse(localStorage.getItem('momocad-incidents') || '[]'); } catch (e) {} L.unshift({ t: Date.now(), v: (document.title.match(/version du [^)]+/) || [''])[0] || mcStamp(), where: where || '', msg: msg.slice(0, 300), st: st.slice(0, 600) }); try { localStorage.setItem('momocad-incidents', JSON.stringify(L.slice(0, 20))); } catch (e) {} }
                const now = Date.now(); if (now - MC_INC.t > 30000 && typeof shapes !== 'undefined' && shapes.length) { MC_INC.t = now; autosaveNow(true); }
                if (first && now - MC_INC.toast > 60000) { MC_INC.toast = now; mcToast('⚠️ Petit incident (' + (where || 'calcul') + ') : ton plan est en sécurité, il vient d\'être sauvegardé automatiquement. Tu peux continuer.', [['Copier le rapport', 'mcIncidentCopy()']]); }
            } catch (e) {} }
        const mcStamp = () => { const m = document.body && document.body.innerHTML.match(/version du \d\d\/\d\d · \d\dh\d\d/); return m ? m[0] : ''; };
        function mcIncidentCopy() { let L = []; try { L = JSON.parse(localStorage.getItem('momocad-incidents') || '[]'); } catch (e) {} const txt = 'MomoCAD — journal des incidents\n' + L.map(x => new Date(x.t).toLocaleString('fr-FR') + ' · ' + x.v + ' · ' + x.where + '\n  ' + x.msg + '\n  ' + x.st).join('\n');
            try { navigator.clipboard.writeText(txt).then(() => updateCommandMessageText('RAPPORT D\'INCIDENT copié : colle-le dans ton message.'), () => updateCommandMessageText('RAPPORT : copie impossible ici.')); } catch (e) {} }
        // message discret en bas de l'écran (remplace les fenêtres du navigateur) ; boutons [texte, code]
        function mcToast(msg, btns, ms) { let el = document.getElementById('mc-toast'); if (el) el.remove(); el = document.createElement('div'); el.id = 'mc-toast'; el.setAttribute('role', 'status');
            el.innerHTML = `<span>${MF.esc(msg)}</span>` + (btns || []).map(([l, js]) => `<button type="button" onclick="${js};this.parentNode.remove()">${MF.esc(l)}</button>`).join('') + `<button type="button" class="mt-x" title="Fermer" onclick="this.parentNode.remove()">✕</button>`;
            document.body.appendChild(el); clearTimeout(mcToast.t); mcToast.t = setTimeout(() => { if (el.parentNode) el.remove(); }, ms || 12000); return el; }
        window.addEventListener('error', (e) => { if (e && e.target && e.target !== window && !(e.error)) return; mcIncident(e.error || e.message, 'programme'); });
        window.addEventListener('unhandledrejection', (e) => { mcIncident(e.reason, 'tâche de fond'); });
        function asDB(fn) { return new Promise((res) => { try { const rq = indexedDB.open('momocad', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
            rq.onsuccess = () => { try { fn(rq.result.transaction('kv', 'readwrite').objectStore('kv'), res); } catch (e) { res(null); } }; rq.onerror = () => res(null); } catch (e) { res(null); } }); }
        // chaque sauvegarde est rangée à part (« as:<date> ») avec un petit sommaire (« autosave-idx ») : un gros plan n'oblige plus à réécrire toutes les versions à chaque fois
        const asGet = (k) => asDB((st, res) => { const r = st.get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
        const asSet = (k, v) => asDB((st, res) => { const r = st.put(v, k); r.onsuccess = () => res(true); r.onerror = () => res(false); });
        const asDel = (k) => asDB((st, res) => { const r = st.delete(k); r.onsuccess = () => res(true); r.onerror = () => res(false); });
        async function asList() { let idx = await asGet('autosave-idx'); if (idx === null) return null;
            if (!Array.isArray(idx)) { idx = []; const old = await asGet('autosave');   // ancien format : toute la liste, données comprises, sous une seule clé
                if (Array.isArray(old)) { for (const e of old) { const k = 'as:' + e.t; await asSet(k, e.data); idx.push({ t: e.t, name: e.name, n: e.n, unsaved: e.unsaved, k, len: (e.data || '').length }); } await asDel('autosave'); }
                await asSet('autosave-idx', idx); }
            return idx; }
        function asClean() { try { localStorage.setItem('momocad-as-clean', String(Date.now())); } catch (e) {} }
        let asBusy = false, asLastSig = '';
        async function autosaveNow(force) {
            if (asBusy || typeof shapes === 'undefined') return false;
            if (!force && (!isDirty() || !shapes.length)) return false;
            const sig = historyStep + ':' + shapes.length + ':' + (fileName || '') + ':' + lpSig(); if (!force && sig === asLastSig) return false;   // rien de neuf : on ne refait pas le gros texte du plan
            asBusy = true;
            try {
                const list = await asList(); if (list === null) return false;
                const data = JSON.stringify(projectData()), t = Date.now(), k = 'as:' + t, e = { t, name: fileName || 'Plan sans nom', n: shapes.filter(x => !isBg(x)).length, unsaved: isDirty(), k, len: data.length };
                if (!(await asSet(k, data))) return false; list.unshift(e);
                // les gros plans (fonds de carte, tracés PDF) : on en garde moins pour ne pas remplir le navigateur
                const keep = data.length > 20e6 ? 3 : AS_MAX, gone = list.splice(keep); for (const g of gone) await asDel(g.k);
                await asSet('autosave-idx', list); asLastSig = sig; return true;
            } catch (err) { return false; } finally { asBusy = false; }
        }
        const asWhen = (t) => { const d = new Date(t), z = (n) => String(n).padStart(2, '0'); return z(d.getDate()) + '/' + z(d.getMonth() + 1) + ' à ' + d.getHours() + 'h' + z(d.getMinutes()); };
        async function asRestore(e) {
            if (!e) return; const data = e.data || await asGet(e.k); if (!data || !loadProjectText(data, e.name)) return;
            fileName = e.name === 'Plan sans nom' ? '' : e.name; fileHandle = null; savedRef = null; updateTitle(); asClean();   // rouvert depuis le navigateur : à réenregistrer
            updateCommandMessageText('PLAN RÉCUPÉRÉ : sauvegarde automatique du ' + asWhen(e.t) + '. Pensez à l\'enregistrer (Ctrl+S).');
        }
        function asBanner(e) {
            const old = document.getElementById('as-banner'); if (old) old.remove();
            const b = document.createElement('div'); b.id = 'as-banner';
            b.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:90;background:#1e3a5f;border:1px solid #3b82f6;color:#e5e7eb;border-radius:10px;padding:10px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px #000a;font-size:13.5px;max-width:92vw';
            b.innerHTML = `<span>💾 Un plan non enregistré a été retrouvé : <b>${MF.esc(e.name)}</b>, ${e.n} objet(s), sauvegardé automatiquement le ${asWhen(e.t)}.</span>`
                + `<button type="button" id="as-yes" style="background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer">Récupérer</button>`
                + `<button type="button" id="as-no" style="background:#4b5563;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Ignorer</button>`;
            document.body.appendChild(b);
            b.querySelector('#as-yes').onclick = () => { b.remove(); asRestore(e); };
            b.querySelector('#as-no').onclick = () => { b.remove(); asClean(); };
        }
        async function autosaveInit() {
            const list = await asList(); let clean = 0; try { clean = +localStorage.getItem('momocad-as-clean') || 0; } catch (e) {}
            const e = list && list[0];
            if (e && e.unsaved && e.t > clean && !shapes.some(x => !isBg(x))) asBanner(e);
            window.__asReady = true;
            setInterval(() => autosaveNow(false), AS_EVERY);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosaveNow(false); });
            window.addEventListener('pagehide', () => autosaveNow(false));
        }
        // Fichier › Sauvegardes automatiques : la liste, et rouvrir l'une d'elles
        async function openAutosaves() {
            await autosaveNow(false); const list = await asList() || [];
            const rows = list.length ? list.map((e, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #374151;border-radius:8px;margin-bottom:6px;background:#111827">
                <div style="flex:1"><div style="color:#fff;font-weight:600">${MF.esc(e.name)}</div><div style="color:#9ca3af;font-size:12px">${asWhen(e.t)} · ${e.n} objet(s)${e.unsaved ? ' · <span style="color:#fbbf24">non enregistré</span>' : ''}</div></div>
                <button type="button" onclick="asOpenAt(${i})" style="background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Rouvrir</button></div>`).join('')
                : '<p style="color:#9ca3af">Aucune sauvegarde automatique pour l\'instant : elles se font toutes les 2 minutes dès que le plan change.</p>';
            openTopoModal('💾 Sauvegardes automatiques', `<p style="color:#9ca3af;font-size:12.5px;margin:0 0 10px">MomoCAD garde ici, dans ce navigateur, les ${AS_MAX} dernières versions de votre travail (toutes les 2 minutes). Elles ne remplacent pas l'enregistrement de votre fichier.</p>` + rows, [['Fermer', () => closeTopoModal()]]);
        }
        async function asOpenAt(i) { const list = await asList() || [], e = list[i]; if (!e) return;
            if (isDirty() && shapes.length && !confirm('Le plan en cours a des modifications non enregistrées. Le remplacer par la sauvegarde du ' + asWhen(e.t) + ' ?')) return;
            closeTopoModal(); asRestore(e); }
        let _lastTitle = '';
        function updateTitle() {
            const name = fileName || 'Sans titre', dirty = isDirty();
            const t = (dirty ? '• ' : '') + name + ' — MomoCAD';
            if (t === _lastTitle) return; _lastTitle = t;
            document.title = t;
            const el = document.getElementById('file-name-label');
            if (el) { el.textContent = name.replace(/\.(mmc|momocad|json)$/i, '') + (dirty ? ' •' : ''); el.title = name + (dirty ? ' (modifications non enregistrées)' : ' (enregistré)'); el.classList.toggle('text-amber-300', dirty); el.classList.toggle('text-gray-400', !dirty); }
        }
        function ensureExt(n) { n = (n || 'plan').trim().replace(/[\\/:*?"<>|]/g, '_'); return /\.(mmc|dxf)$/i.test(n) ? n : n.replace(/\.(momocad|json)$/i, '') + '.mmc'; }
        const baseName = (n) => (n || 'plan').replace(/\.(mmc|momocad|json|dxf)$/i, '');
        function savedMsg(name, how) {
            let m = how + ' : ' + name;
            if (isDxfName(name)) {
                const lost = [];
                if (shapes.some(isBg)) lost.push('fonds de carte / fonds perso');
                if (shapes.some(sh => sh.type === 'dim-angle')) lost.push('cotes d\'angle');
                m += ' (format DXF' + (lost.length ? ' — non inclus : ' + lost.join(', ') : '') + ' ; « Enregistrer sous » .mmc pour tout garder)';
            }
            return m;
        }
        async function saveProject(saveAs) {
            if (mode === 'print' || mode === 'preview') setMode('select-box');
            if (window.showSaveFilePicker) {
                try {
                    if (!fileHandle || saveAs) {
                        // .mmc proposé en premier ; garder DXF en premier si le plan en cours est un DXF
                        const types = isDxfName(fileName) ? [DXF_TYPE, MMC_TYPE] : [MMC_TYPE, DXF_TYPE];
                        fileHandle = await window.showSaveFilePicker({ suggestedName: isDxfName(fileName) ? baseName(fileName) + '.dxf' : ensureExt(baseName(fileName)), types });
                    }
                    const w = await fileHandle.createWritable(); await w.write(fileBytes(fileHandle.name)); await w.close();
                    fileName = fileHandle.name; markSaved();
                    updateCommandMessageText(savedMsg(fileName, 'Enregistré')); return true;
                } catch (e) {
                    if (e && e.name === 'AbortError') return false;
                    console.error(e);
                    if (!confirm("Impossible d'écrire le fichier (" + (e.message || e) + ").\nLe télécharger à la place ?")) return false;
                }
            }
            // Repli : téléchargement (taper un nom finissant par .dxf pour AutoCAD)
            let name = fileName;
            if (!name || saveAs) { name = prompt('Nom du fichier (ajoutez .dxf pour un fichier DXF, sinon .mmc) :', baseName(fileName) + (isDxfName(fileName) ? '.dxf' : '')); if (!name) return false; }
            name = ensureExt(name);
            const url = URL.createObjectURL(new Blob([fileBytes(name)], { type: isDxfName(name) ? 'application/dxf' : 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            fileName = name; markSaved();
            updateCommandMessageText(savedMsg(name, 'Enregistré (téléchargé)')); return true;
        }
        async function openProject() {
            if (isDirty() && !confirm("Le plan en cours a des modifications non enregistrées.\nLes abandonner et ouvrir un autre plan ?")) return;
            if (window.showOpenFilePicker) {
                try {
                    const [h] = await window.showOpenFilePicker({ types: OPEN_TYPES, multiple: false });
                    const f = await h.getFile();
                    if (await loadFileObject(f, h.name)) fileHandle = h;
                } catch (e) { if (!e || e.name !== 'AbortError') { console.error(e); alert("Impossible d'ouvrir le fichier : " + (e.message || e)); } }
                return;
            }
            document.getElementById('project-input').click();
        }
        // ---- glisser-déposer un fichier sur la fenêtre : image ou PDF = fond perso ; .mmc, .dxf, .gbt = ouverture ----
        (function () {
            let ov = null, n = 0;
            const show = (on) => { if (!ov) { ov = document.createElement('div'); ov.id = 'drop-ov'; ov.style.cssText = 'position:fixed;inset:12px;z-index:9000;border:3px dashed #38bdf8;border-radius:16px;background:rgba(14,116,144,.18);display:none;align-items:center;justify-content:center;pointer-events:none;font:700 20px system-ui;color:#e0f2fe;text-shadow:0 2px 8px #000;text-align:center'; ov.innerHTML = 'Dépose ton fichier ici<br><span style="font-size:14px;font-weight:500">image ou PDF → fond perso · .mmc, .dxf, .gbt → ouverture</span>'; document.body.appendChild(ov); } ov.style.display = on ? 'flex' : 'none'; };
            const hasFile = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
            window.addEventListener('dragenter', e => { if (!hasFile(e)) return; e.preventDefault(); n++; show(true); });
            window.addEventListener('dragover', e => { if (!hasFile(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
            window.addEventListener('dragleave', e => { if (!hasFile(e)) return; n = Math.max(0, n - 1); if (!n) show(false); });
            window.addEventListener('drop', async e => {
                if (!hasFile(e)) return; e.preventDefault(); n = 0; show(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
                const nm = f.name || '';
                if (/\.(pdf|png|jpe?g|webp|gif|bmp)$/i.test(nm) || /^image\//.test(f.type) || f.type === 'application/pdf') { if (is3DOpen()) close3D(); loadBgFile({ files: [f], value: '' }); return; }
                if (/\.dwg$/i.test(nm)) { alert('Le format DWG est fermé : MomoCAD ne sait pas le lire directement. Enregistre-le en DXF depuis ton logiciel (ou un convertisseur DWG → DXF gratuit), puis dépose le DXF ici.'); return; }
                if (/\.(kmz|kml)$/i.test(nm)) { kmzOpen(f); return; }
                if (/\.dxf$/i.test(nm) && shapes.some(x => !isBg(x))) { dxfOverlayAsk(f, nm, false); return; }
                if (/\.stl$/i.test(nm)) { updateCommandMessageText('Les fichiers STL ne sont plus pris en charge.'); return; }
                if (/\.(mmc|momocad|json|dxf|gbt)$/i.test(nm)) {
                    if (!/\.gbt$/i.test(nm) && isDirty() && shapes.length && !confirm('Le plan en cours a des modifications non enregistrées. Ouvrir « ' + nm + ' » quand même ?')) return;
                    const ok = await loadFileObject(f, nm); if (ok && !/\.gbt$/i.test(nm)) fileHandle = null; return;
                }
                updateCommandMessageText('Fichier non reconnu : ' + nm + ' (images, PDF, .mmc, .dxf, .gbt, .kmz, .kml).');
            });
        })();
        function openProjectFromInput(event) {
            const file = event.target.files[0]; if (!file) return;
            loadFileObject(file, file.name).then(ok => { if (ok) fileHandle = null; event.target.value = ''; });
        }
        async function loadFileObject(f, name) {
            if (/\.km[lz]$/i.test(name || '')) { await kmzOpen(f); return false; }
            if (/\.gbt$/i.test(name || '')) { let g; try { g = JSON.parse(await f.text()); } catch (e) { alert('Gabarit illisible.'); return false; } const ok = applyGabarit(g, name); if (ok) saveState(); return ok; }   // maillage 3D inséré dans le plan en cours
            if (!isDxfName(name)) return loadProjectText(await f.text(), name);
            // DXF ouvert comme un nouveau plan (Ctrl+S le réenregistre en DXF)
            const buf = new Uint8Array(await f.arrayBuffer());
            let txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { txt = new TextDecoder('windows-1252').decode(buf); }
            if (mode === 'print' || mode === 'preview') setMode('select-box');
            const keepLayers = layers, keepShapes = shapes, keepOrigin = geoOrigin;
            layers = JSON.parse(JSON.stringify(INITIAL_LAYERS)); activeLayerId = layers[0].id;
            shapes = []; geoOrigin = { x: 0, y: 0 };   // nouveau plan : l'origine se cale sur le DXF
            let res;
            const restore = () => { layers = keepLayers; shapes = keepShapes; geoOrigin = keepOrigin; };
            try { res = importDXF(txt); } catch (err) { restore(); alert('Erreur de lecture du DXF : ' + err.message); return false; }
            if (!res.shapes.length) { restore(); alert('Aucune entité compatible trouvée dans ce DXF.'); return false; }
            if (layoutOn) toggleLayout(false); lpResetAll(); dxfPresApply(res.pres);
            shapes = res.shapes; selectedShapes = []; shapesHistory = []; historyStep = -1;
            invalidateCache(); saveState(); updateLayerUI(); zoomToFitShapes(shapes);
            fileName = name; markSaved(); draw();
            updateCommandMessageText('Ouvert : ' + name + ' — ' + res.shapes.length + ' entité(s)' + dxfExtraMsg(res) + (res.ignored ? ', ' + res.ignored + ' non gérée(s) ignorée(s)' : '') + (res.unit ? ' — unités : ' + unitName(res.unit.uf) + ' (' + res.unit.src + ')' : '') + '.' + dxfXrefMsg(res));
            return true;
        }
        // ---- FICHIERS .mmc : numéro de format, mise à niveau des anciens fichiers, contrôle à l'ouverture (objets illisibles écartés, calques manquants recréés),
        //      ouverture « tout ou rien » : si quelque chose casse en cours de route, le plan précédent est remis tel quel.
        const MMC_FORMAT = 2, MMC_LOAD_FIX = { walls: 0, bld: 0, wz: 0 };
        const MMC_MIGR = { 1: (d) => d };   // format 1 (fichiers sans numéro) → 2 : même contenu, le numéro apparaît
        const MMC_NEED = { line: ['x1', 'y1', 'x2', 'y2'], dim: ['x1', 'y1', 'x2', 'y2'], circle: ['x', 'y', 'r'], arc: ['x', 'y', 'r'], text: ['x', 'y'], point: ['x', 'y'], basemap: ['x', 'y', 'r'], mesh: ['x', 'y'] };
        const MMC_OBJ = ['solid', 'wz', 'roofDef', 'bois', 'brush', 'sweep', 'cutDef', 'sonde', 'trench', 'talus', 'bld', 'vr', 'shut', 'tf'], MMC_ARR = ['openings', 'fte', 'cuts', 'carve', 'loops'];
        function mmcPrepare(d) { const rep = { dropped: 0, fixed: 0, newer: false, from: +d.format || 1 }; if (rep.from > MMC_FORMAT) rep.newer = true;
            for (let f = rep.from; f < MMC_FORMAT; f++) if (MMC_MIGR[f]) d = MMC_MIGR[f](d) || d; d.format = MMC_FORMAT;
            const num = (v) => typeof v === 'number' && isFinite(v), XY = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'w', 'h'];
            d.shapes = d.shapes.filter(sh => { if (!sh || typeof sh !== 'object' || typeof sh.type !== 'string') { rep.dropped++; return false; }
                if (XY.some(k => sh[k] !== undefined && sh[k] !== null && !num(sh[k]))) { rep.dropped++; return false; }
                if (sh.points !== undefined) { if (!Array.isArray(sh.points)) { rep.dropped++; return false; } const n0 = sh.points.length; sh.points = sh.points.filter(q => q && num(q.x) && num(q.y)); if (sh.points.length !== n0) rep.fixed++; if (!sh.points.length) { rep.dropped++; return false; } }
                /* géométrie indispensable selon le type (un fichier abîmé ne doit pas casser le plan ni la 3D) */
                const need = MMC_NEED[sh.type]; if (need && need.some(k => !num(sh[k]))) { rep.dropped++; return false; }
                if ((sh.type === 'poly' || sh.type === 'pline' || sh.type === 'spline') && !Array.isArray(sh.points)) { rep.dropped++; return false; }
                if (sh.type === 'hatch') { if (!Array.isArray(sh.loops)) { rep.dropped++; return false; } const L0 = JSON.stringify(sh.loops.map(l => Array.isArray(l) ? l.length : -1)); sh.loops = sh.loops.filter(Array.isArray).map(l => l.filter(q => q && num(q.x) && num(q.y))).filter(l => l.length >= 3);
                    if (JSON.stringify(sh.loops.map(l => l.length)) !== L0) rep.fixed++; if (!sh.loops.length) { rep.dropped++; return false; } }
                // champs structurés de mauvais type (un objet attendu, une liste attendue) : retirés, l'objet reste
                MMC_OBJ.forEach(k => { if (sh[k] !== undefined && (sh[k] === null || typeof sh[k] !== 'object' || Array.isArray(sh[k]))) { delete sh[k]; rep.fixed++; } });
                MMC_ARR.forEach(k => { if (sh[k] !== undefined && !Array.isArray(sh[k])) { delete sh[k]; rep.fixed++; } });
                if (sh.wz && !(num(sh.wz.b) && num(sh.wz.t))) { delete sh.wz; rep.fixed++; }
                if (Array.isArray(sh.openings)) { const n0 = sh.openings.length; sh.openings = sh.openings.filter(o => o && typeof o === 'object' && o.a && o.b && num(o.a.x) && num(o.a.y) && num(o.b.x) && num(o.b.y) && Array.isArray(o.pts) && o.pts.length === 4 && o.pts.every(q => q && num(q.x) && num(q.y))); if (sh.openings.length !== n0) rep.fixed++; }
                if (sh.solid && typeof sh.solid.kind !== 'string') { delete sh.solid; rep.fixed++; }
                if (sh.z !== undefined && sh.z !== null && !num(sh.z)) { delete sh.z; rep.fixed++; }
                if (Array.isArray(sh.points)) sh.points.forEach(q => { if (q.z !== undefined && q.z !== null && !num(q.z)) { delete q.z; rep.fixed++; } });
                return true; });
            if (!Array.isArray(d.layers)) d.layers = []; d.layers = d.layers.filter(l => l && typeof l === 'object' && l.id);
            const ids = new Set(d.layers.map(l => l.id)), lost = d.shapes.filter(sh => sh.layerId && !ids.has(sh.layerId) && sh.layerId !== 'layer-0');
            if (lost.length) { const id = 'layer-recup'; if (!ids.has(id)) d.layers.push({ id, name: 'Récupéré', visible: true, color: '#fbbf24', dash: 'solid', width: 1 }); lost.forEach(sh => { sh.layerId = id; }); rep.fixed += lost.length; }
            if (d.layers.length && !ids.has('layer-0') && d.shapes.some(sh => !sh.layerId || sh.layerId === 'layer-0')) d.layers.unshift({ id: 'layer-0', name: 'Calque 0', visible: true, color: '#ffffff', dash: 'solid', width: 1 });
            return rep; }
        function loadProjectText(text, name) {
            let data;
            try { data = JSON.parse(text); } catch (err) { mcToast('Ce fichier n\'est pas un plan MomoCAD lisible (' + err.message + ').'); return false; }
            if (!data || !Array.isArray(data.shapes)) { mcToast('Ce fichier n\'est pas un plan MomoCAD.'); return false; }
            const rep = mmcPrepare(data); MMC_LOAD_FIX.walls = 0; MMC_LOAD_FIX.bld = 0; MMC_LOAD_FIX.wz = 0; MMC_LOAD_FIX.bsol = 0; MMC_LOAD_FIX.ops = 0; let prev = null; try { prev = typeof shapes !== 'undefined' && shapes.length ? JSON.stringify(projectData()) : null; } catch (e) {} const prevName = fileName;
            try { if (!loadProjectData(data, name)) return false; }
            catch (e) { mcIncident(e, 'ouverture du fichier'); if (prev) { try { loadProjectData(JSON.parse(prev), prevName); } catch (e2) {} } mcToast('Ce fichier n\'a pas pu être ouvert entièrement : le plan précédent est conservé.'); return false; }
            const notes = []; if (rep.newer) notes.push('créé par une version plus récente de MomoCAD : mets MomoCAD à jour (Ctrl+Shift+R) pour tout retrouver'); if (rep.dropped) notes.push(rep.dropped + ' objet(s) illisible(s) écarté(s)'); if (rep.fixed) notes.push(rep.fixed + ' objet(s) réparé(s)'); if (MMC_LOAD_FIX.walls) notes.push(MMC_LOAD_FIX.walls + ' bordure(s) de paroi manquante(s) refaite(s)'); if (MMC_LOAD_FIX.bld) notes.push(MMC_LOAD_FIX.bld + ' contour(s) de bâtiment refermé(s)'); if (MMC_LOAD_FIX.ops) notes.push(MMC_LOAD_FIX.ops + ' porte(s) ou fenêtre(s) restée(s) hors de leur mur : remise(s) dans le mur'); if (MMC_LOAD_FIX.bsol) notes.push(MMC_LOAD_FIX.bsol + ' contour(s) de bâtiment devenu(s) dalle : la dalle est maintenant un objet à part, sous le plancher du RDC'); if (MMC_LOAD_FIX.wz) notes.push(MMC_LOAD_FIX.wz + ' morceau(x) de paroi sans hauteur remis à la hauteur de leur étage (visibles en 3D)');
            if (notes.length) mcToast('Fichier ouvert — ' + notes.join(' ; ') + '.', null, 15000); return true; }
        function loadProjectData(data, name) {
            if (mode === 'print' || mode === 'preview') setMode('select-box');
            /* l'unité d'affichage suit le réglage ⛯, pas le fichier (le dessin est toujours stocké en mm) */
            if (data.cartouche) { cartoucheData = data.cartouche; saveCartoucheData(); getLogoImg(); }
            if (data.basemaps) Object.assign(basemapStore, data.basemaps);
            if (typeof toggleLayout === 'function' && layoutOn) toggleLayout(false);
            lpResetAll((data.layout && Array.isArray(data.layout.vps)) ? Object.assign(lpNew(), data.layout) : lpNew());
            if (Array.isArray(data.layouts) && data.layouts.length > 1) { layouts = data.layouts.map(x => x && x.$cur ? layoutData : Object.assign(lpNew(), x)); if (!layouts.includes(layoutData)) layouts.unshift(layoutData); layoutIdx = layouts.indexOf(layoutData); }
            studio = Object.assign(studioNew(), data.studio || {});
            if (data.meshes) Object.keys(data.meshes).forEach(k => { try { meshStore[k] = b64ToF32(data.meshes[k]); delete meshPathCache[k]; } catch (e) {} });
            if (data.vecs) Object.keys(data.vecs).forEach(k => { try { vecStore[k] = vecUnpack(data.vecs[k]); delete vecCache[k]; } catch (e) {} });
            if (data.layers && data.layers.length) {
                layers = data.layers; stripLayerNums(layers); cartoGroupAll(); activeLayerId = data.activeLayerId || layers[0].id;
                // Compléter les champs de style manquants (anciens fichiers)
                layers.forEach(l => {
                    if (!l.color) l.color = '#ffffff';
                    if (!l.dash) l.dash = 'solid';
                    if (l.width === undefined || l.width === null) l.width = 1;
                });
            }
            if (data.snapSettings) { snapSettings = Object.assign({}, SNAP_DEFAULTS, data.snapSettings); refreshSnapButtons(); try { localStorage.setItem('momocad-snap', JSON.stringify(snapSettings)); } catch (e) {} ['end:endpoint', 'mid:midpoint', 'inter:intersection', 'perp:perpendicular', 'center:center', 'tan:tangent', 'near:nearest'].forEach(p => { const [id, k] = p.split(':'); const el = document.getElementById('snap-' + id); if (el) el.checked = !!snapSettings[k]; }); }
            if (data.settings) {
                const st = data.settings;
                printSettings.unit = UNIT_MM[st.unit] ? st.unit : 'm';   // l'unité du dessin fait partie du plan
                if (st.decimals !== undefined) printSettings.decimals = st.decimals;
                if (st.paper) printSettings.paper = st.paper;
                if (st.output) printSettings.output = st.output;
                if (st.cartouche !== undefined) printSettings.cartouche = !!st.cartouche;
                if (st.orientation === 'portrait' || st.orientation === 'landscape') { printOrientation = st.orientation; printSettings.orientation = st.orientation; }
                if (st.dimText) dimTextAligned = st.dimText === 'aligned';
                if (st.dimStyle) dimStyleSet(st.dimStyle);
                applyUnitSettings(); refreshDimTextButton();
                try { localStorage.setItem('momocad-print', JSON.stringify(printSettings)); localStorage.setItem('momocad-dim-text', dimTextAligned ? 'aligned' : 'horizontal'); } catch (e) {}
            }
            if (data.gridMm > 0) { gridMm = data.gridMm; try { localStorage.setItem('momocad-grid-mm', String(gridMm)); } catch (e) {} }
            refreshGridField(); updateCursorCoords();
            geoOrigin = (data.geoOrigin && isFinite(data.geoOrigin.x)) ? data.geoOrigin : { x: 0, y: 0 };
            lvls = Array.isArray(data.levels) && data.levels.length ? data.levels : null; lvlsGlobal = null; bldActId = null; lvlAct = 'rdc'; if (lvlOn) lvlToggle(false);
            if (data.talus) { cubState.talus = data.talus.on !== false; cubState.kR = data.talus.kR || '3/2'; cubState.kD = data.talus.kD || '1/1'; }
            pluvioNote = data.pluvio || null; solNote = data.sol || null; PIN3D = data.pin3d && isFinite(data.pin3d.x) && isFinite(data.pin3d.y) && isFinite(data.pin3d.z) ? { x: +data.pin3d.x, y: +data.pin3d.y, z: +data.pin3d.z } : null; if (typeof V3 !== 'undefined' && V3) { V3.pin = null; V3.pinRoot = null; } solStop(true); mailNote = data.maill || null;
            shapes = data.shapes; wallFteMigrate(shapes); lvlMarkAll(); if (lvls) lvlChain(); markZKnown(); lightenTalusLimits(shapes); MMC_LOAD_FIX.walls = wallBordersRepair(); MMC_LOAD_FIX.bm = bmLayerRepair(); MMC_LOAD_FIX.ops = wallOpRepair(); MMC_LOAD_FIX.bld = bldRepair(); if (shapes.some(x => x.stair2)) try { loadPolyClip().then(() => { invalidateCache(); draw(); }, () => {}); } catch (e) {} MMC_LOAD_FIX.bsol = bldSolidRepair(); MMC_LOAD_FIX.wz = wallWzRepair(); wallBidRepair(); lvlStartRdc(); selectedShapes = []; shapesHistory = []; historyStep = -1;
            invalidateCache(); saveState(); updateLayerUI();
            if (data.view && data.view.zoom > 0) {
                camera.zoom = data.view.zoom;
                camera.x = canvas.width / 2 - data.view.cx * camera.zoom; camera.y = canvas.height / 2 - data.view.cy * camera.zoom;
            } else if (shapes.length) zoomToFitShapes(shapes);
            // anciens fichiers .momocad / .json : le prochain Enregistrer garde le même fichier, Enregistrer sous propose .mmc
            fileName = name || ''; markSaved(); draw();
            updateCommandMessageText('Ouvert : ' + (fileName || 'plan'));
            return true;
        }
        window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

        function getPrintRect() {
            // Zone image = surface intérieure du cadre (feuille moins 5 mm de marge), aux proportions du format.
            // 700 px de large au plus, réduite si besoin pour que la feuille tienne dans la fenêtre.
            const { drawW, drawH } = pageDims();
            const ratio = drawW / drawH;
            let w = Math.min(700, canvas.width * 0.86, (canvas.height - 100) * 0.86 * ratio);
            w = Math.max(200, w);
            return { w, h: w / ratio };
        }
        // Recalcule le zoom de l'échelle d'impression courante (après changement de format ou d'orientation),
        // en gardant fixe le point du dessin sous (ax, ay).
        function applyPrintScale(ax, ay) {
            const wp = screenToWorld(ax, ay);
            currentPrintScale = PRINT_SCALES[printScaleIndex].label;
            camera.zoom = printBaseZoom() * PRINT_SCALES[printScaleIndex].factor;
            camera.x = ax - wp.x * camera.zoom; camera.y = ay - wp.y * camera.zoom;
        }

        // Image du plan telle qu'elle sera imprimée (fond blanc, couleurs d'impression).
        // Utilisée par l'aperçu (SS = 1 ou 2), le PDF et les images (SS calculé pour ~200 dpi).
        // winX / winY : coin haut-gauche de la zone image, en coordonnées écran.
        // Tailles physiques identiques sur tous les formats de feuille :
        //  - textes « variables » : REF_MM_PER_PX = taille sur papier d'un pixel écran de référence (A4 paysage : 287 mm / 700 px) ;
        //  - traits : épaisseur 1 du calque = 0,25 mm sur papier (même règle que l'export DXF),
        //    avec un minimum d'environ 1 pixel dans l'aperçu à l'écran pour rester visible.
        const REF_MM_PER_PX = 287 / 700;
        function renderPrintCanvas(winX, winY, SS) {
            const rect = getPrintRect();
            const offw = Math.round(rect.w * SS), offh = Math.round(rect.h * SS);
            const offCanvas = document.createElement('canvas');
            offCanvas.width = offw; offCanvas.height = offh;
            const offCtx = offCanvas.getContext('2d');
            offCtx.fillStyle = '#ffffff'; offCtx.fillRect(0, 0, offw, offh);
            const pxPerMm = offw / pageDims().drawW;              // pixels image par mm de papier
            const f = REF_MM_PER_PX * pxPerMm;                    // textes : pixels image par pixel écran de référence
            const fl = Math.max(0.25 * pxPerMm, SS <= 2 ? 0.8 : 0); // traits : épaisseur 1 -> 0,25 mm sur le papier
            const offZoom = camera.zoom * SS;                     // monde -> pixels image
            offCtx.save();
            offCtx.translate((camera.x - winX) * SS, (camera.y - winY) * SS);
            offCtx.scale(offZoom, offZoom);
            dimensionTextsToDraw = []; screenTextsToDraw = []; ptLabelGrid = new Set(); dimMmW = pxPerMm / offZoom;
            try { for (let s of shapesInDrawOrder()) {
                let layer = layers.find(l => l.id === (s.layerId || 'layer-0'));
                if (layer && !layer.visible) continue; if (lvlOff2D(s)) continue;
                drawSingleShape(offCtx, s, true, false, 0, 0, offZoom / fl);
            } } finally { dimMmW = null; }
            offCtx.restore();
            const W2S = (wx, wy) => ({ x: (wx * camera.zoom + camera.x - winX) * SS, y: (wy * camera.zoom + camera.y - winY) * SS });
            drawAnnotations(offCtx, W2S, f, offZoom, true);
            if (printSettings.bw) canvasToBW(offCanvas);   // noir et blanc (⛯ › Impression)
            return offCanvas;
        }

