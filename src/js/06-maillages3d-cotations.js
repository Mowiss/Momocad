        // =====================================================================
        // MAILLAGES 3D (plans anciens) : objet { type:'mesh', x, y (centre), rot, sc, z0 (mm), meshId, name, ntri, bb } ;
        // les triangles (mm, relatifs au centre, base à 0) sont rangés à part dans meshStore (Float32Array, 9 valeurs par triangle)
        // =====================================================================
        function meshWorld(s, lx, ly) { const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0), k = s.sc || 1; return { x: s.x + mmToWorld(k * (lx * c + ly * sn)), y: s.y + mmToWorld(k * (lx * sn - ly * c)) }; }
        function meshCorners(s) { const b = s.bb; return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => meshWorld(s, x, y)); }
        function meshLocal(s, wx, wy) { const dx = worldToMm(wx - s.x) / (s.sc || 1), dy = worldToMm(wy - s.y) / (s.sc || 1), c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0); return { x: dx * c + dy * sn, y: dx * sn - dy * c }; }
        function meshPath(id) {
            if (meshPathCache[id]) return meshPathCache[id]; const v = meshStore[id]; if (!v) return null;
            const p = new Path2D(), n = v.length / 9, step = Math.max(1, Math.ceil(n / 60000));
            for (let t = 0; t < n; t += step) { const o = t * 9; p.moveTo(v[o], -v[o + 1]); p.lineTo(v[o + 3], -v[o + 4]); p.lineTo(v[o + 6], -v[o + 7]); p.closePath(); }
            return (meshPathCache[id] = p);
        }
        function drawMesh2D(ctx, s, col, sel, dx, dy, ls) {
            // pignons et forme de pente d'une toiture : rien en plan (le toit se lit par ses pans)
            if (s.roofPart || (s.groupId && (s.name === 'Pignons' || s.name === 'Forme de pente'))) return;   // même sélectionnés : le toit sélectionné se lit par ses pans en rose
            const p = meshPath(s.meshId), k = mmToWorld(1) * (s.sc || 1);
            ctx.save(); ctx.translate(s.x + dx, s.y + dy); ctx.rotate(s.rot || 0); ctx.scale(k, k); ctx.setLineDash([]);
            if (p) { ctx.globalAlpha *= 0.45; ctx.strokeStyle = col; ctx.lineWidth = 0.6 / (ls * k); ctx.stroke(p); ctx.globalAlpha /= 0.45; }
            const b = s.bb; ctx.strokeStyle = sel ? '#ec4899' : col; ctx.lineWidth = (sel ? 2 : 1) / (ls * k); ctx.setLineDash(sel ? [6 / (ls * k), 4 / (ls * k)] : []);
            ctx.strokeRect(b.x0, -b.y1, b.x1 - b.x0, b.y1 - b.y0); ctx.restore();
        }
        function f32ToB64(a) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s2 = ''; for (let i = 0; i < u.length; i += 0x8000) s2 += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s2); }
        function b64ToF32(b) { const s2 = atob(b), u = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) u[i] = s2.charCodeAt(i); return new Float32Array(u.buffer); }
        let meshStore = {}; const meshPathCache = {};
        function bmImg(id) {
            const src = basemapStore[id]; if (!src) return null;
            let im = basemapImgCache[id];
            if (!im || im._src !== src) { im = new Image(); im.onload = () => { renderEpoch++; draw(); }; im.src = src; im._src = src; basemapImgCache[id] = im; }   /* comparer la chaîne gardée, pas im.src (recopie de plusieurs Mo à chaque appel) */
            return (im.complete && im.naturalWidth) ? im : null;
        }
        function loadLeaflet() {
            if (window.L && window.L.map) return Promise.resolve();
            return new Promise((res, rej) => {
                const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MC_LIB + 'leaflet.css';
                css.onerror = () => { css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.onerror = null; }; document.head.appendChild(css);
                loadJSFirst([MC_LIB + 'leaflet.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js']).then(() => res(), () => rej(new Error('Leaflet indisponible (connexion ?)')));
            });
        }
        function bmRadius() { const v = parseFloat(String(document.getElementById('bm-radius').value).replace(',', '.')); return (v > 0) ? Math.min(v, 50000) : 0; }
        function bmInfo(t) { document.getElementById('bm-info').textContent = t || ''; }
        function bmSetCenter(ll) {
            bmCenter = ll;
            if (!bmMarker) bmMarker = L.circleMarker(ll, { radius: 5, color: '#ec4899', fillColor: '#ec4899', fillOpacity: 1 }).addTo(bmMap); else bmMarker.setLatLng(ll);
            bmUpdateCircle();
        }
        function bmUpdateCircle() {
            if (!bmMap || !bmCenter) return;
            const r = bmRadius();
            if (!bmCircle) bmCircle = L.circle(bmCenter, { radius: r || 1, color: '#2563eb', weight: 2, fillOpacity: 0.08 }).addTo(bmMap);
            else { bmCircle.setLatLng(bmCenter); bmCircle.setRadius(r || 1); }
            bmInfo((bmLabel ? bmLabel + ' — ' : '') + bmCenter.lat.toFixed(5) + ', ' + bmCenter.lng.toFixed(5));
        }
        async function openBasemapModal(Pplan) {
            if (isOffline()) netWarn('Le fond de carte');
            closeLayerModal(); closeSnapModal(); closeCartoucheModal();
            const m = document.getElementById('basemap-modal'); m.style.display = 'flex';
            try { await loadLeaflet(); }
            catch (err) { bmInfo('Impossible de charger la carte : ' + err.message); return; }
            if (!bmMap) {
                let v = null; try { v = JSON.parse(localStorage.getItem('momocad-basemap-view') || 'null'); } catch (e) {}
                bmMap = L.map('bm-map').setView(v ? [v.lat, v.lng] : [46.6, 2.4], v ? v.z : 6);
                bmRefreshLeaflet();
                bmMap.on('click', (e) => { bmLabel = ''; bmSetCenter(e.latlng); });
                bmMap.on('moveend', () => { const c = bmMap.getCenter(); try { localStorage.setItem('momocad-basemap-view', JSON.stringify({ lat: c.lat, lng: c.lng, z: bmMap.getZoom() })); } catch (e) {} });
                document.getElementById('bm-radius').addEventListener('input', bmUpdateCircle);
                document.getElementById('bm-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bmSearch(); } });
            }
            bmDataUI(); document.getElementById('bm-base').value = BM_PHOTO.includes(bmSettings.base) ? bmSettings.base : 'sat'; bmRefreshLeaflet();
            if (Pplan) { try { const w = screenToWorld(canvas.width / 2, canvas.height / 2), ll = llOfWorld(Pplan, w.x, w.y); bmMap.setView([ll.lat, ll.lon], Math.max(bmMap.getZoom(), 16)); } catch (e) {} }   // plan déjà situé : la carte s'ouvre sur l'endroit affiché
            setTimeout(() => bmMap.invalidateSize(), 50);
            if (!bmCenter) bmInfo('Cliquez sur la carte pour choisir le centre du fond de carte.');
        }
        function closeBasemapModal() { document.getElementById('basemap-modal').style.display = 'none'; }
        async function bmSearch() {
            const q = document.getElementById('bm-search').value.trim(); if (!q || !bmMap) return;
            bmInfo('Recherche…');
            try {
                let hit = null;
                try {
                    const c = bmMap.getCenter();
                    const r = await fetch('https://photon.komoot.io/api/?limit=1&lang=fr&lat=' + c.lat.toFixed(4) + '&lon=' + c.lng.toFixed(4) + '&q=' + encodeURIComponent(q));
                    if (r.ok) { const f = (await r.json()).features || [];
                        if (f.length) { const pr = f[0].properties || {}; hit = { lat: f[0].geometry.coordinates[1], lon: f[0].geometry.coordinates[0],
                            label: [pr.name, pr.street && pr.housenumber ? pr.housenumber + ' ' + pr.street : pr.street, pr.city, pr.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(', ') }; } }
                } catch (e) {}
                if (!hit) {
                    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=fr&q=' + encodeURIComponent(q));
                    const j = r.ok ? await r.json() : [];
                    if (j.length) hit = { lat: +j[0].lat, lon: +j[0].lon, label: (j[0].display_name || q).split(',').slice(0, 2).join(',') };
                }
                if (!hit) { bmInfo('Lieu introuvable.'); return; }
                const ll = L.latLng(hit.lat, hit.lon);
                bmLabel = hit.label || q;
                bmMap.setView(ll, 17); bmSetCenter(ll);
                const rr = bmRadius(); if (rr) bmMap.fitBounds(bmCircle.getBounds(), { padding: [30, 30], maxZoom: 18 });
            } catch (err) { bmInfo('Recherche impossible : ' + err.message); }
        }
        // Assemble les tuiles d'un fournisseur autour du centre : image carrée (diamètre = 2 × rayon).
        // Satellite en JPEG ; cadastre en PNG transparent, posé par-dessus au dessin.
        // netteté du fond : diamètre visé de l'image (px). Haute = 2 560, Très haute = 4 096 (16 fois plus de détail qu'avant à rayon égal), limitée par la carte (zoom 19 ≈ 25 cm/px)
        const BM_HD = { std: 1280, hd: 2560, uhd: 4096 };
        const bmHdPx = () => BM_HD[bmSettings.hd] || BM_HD.hd;
        // tuiles chargées 12 à la fois (le délai ne compte pas l'attente dans la file)
        function bmLoadTiles(urls) { let i = 0; const out = new Array(urls.length);
            const one = () => { if (i >= urls.length) return Promise.resolve(); const k = i++, u = urls[k]; return new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; const t = setTimeout(() => { out[k] = null; res(); }, 25000);
                im.onload = () => { clearTimeout(t); out[k] = im; res(); }; im.onerror = () => { clearTimeout(t); out[k] = null; res(); }; im.src = u; }).then(one); };
            return Promise.all(Array.from({ length: Math.min(12, urls.length) }, one)).then(() => out); }
        async function buildBasemapLayer(src, lat, lon, R, opaque, px) {
            const cosl = Math.cos(lat * Math.PI / 180), M0 = 156543.03392 * cosl;  // m/px au zoom 0
            let z = Math.round(Math.log2(M0 * (px || bmHdPx()) / (2 * R)));
            if (M0 / Math.pow(2, z) > 0 && 2 * R / (M0 / Math.pow(2, z)) > 6000) z--;   // pas d'image de plus de 6 000 px
            z = Math.max(src.minZoom || 0, Math.min(src.maxZoom, z));
            const n = Math.pow(2, z), mpp = M0 / n, D = 2 * R / mpp;               // diamètre en pixels de tuile
            const k = Math.max(1, 512 / D), S = Math.round(D * k);                  // agrandit les très petits rayons
            const cx = (lon + 180) / 360 * 256 * n;
            const sl = Math.sin(lat * Math.PI / 180);
            const cy = (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * 256 * n;
            const x0 = cx - D / 2, y0 = cy - D / 2;
            const T = [];
            for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + D) / 256); tx++)
                for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + D) / 256); ty++) { if (ty < 0 || ty >= n) continue; T.push({ tx, ty, u: src.url(z, ((tx % n) + n) % n, ty) }); }
            const ims = await bmLoadTiles(T.map(t => t.u)), tiles = T.map((t, i) => ims[i] ? { im: ims[i], tx: t.tx, ty: t.ty } : null);
            const ok = tiles.filter(Boolean);
            if (!ok.length) return null;
            const cv = document.createElement('canvas'); cv.width = cv.height = S;
            const c = cv.getContext('2d');
            if (opaque) { c.fillStyle = '#1f2937'; c.fillRect(0, 0, S, S); }
            c.imageSmoothingQuality = 'high';
            c.save(); c.scale(k, k);
            for (const t of ok) c.drawImage(t.im, t.tx * 256 - x0, t.ty * 256 - y0, 256, 256);
            c.restore();
            return { cv, S, missing: tiles.length - ok.length };
        }
        // calques demandés mais vides (hors couverture, service indisponible)
        function bmMissingOv(cap) { const m = BM_OVL_LIST.filter(k => bmSettings.ov[k] && !cap.ov[k]).map(k => BM_OVLS[k].name); return m.length ? ' — sans : ' + m.join(', ') : ''; }
        function bmStamp(cv, txt) {
            const c = cv.getContext('2d'), S = cv.width, fs = Math.max(9, Math.round(S * 0.026));
            c.font = fs + 'px Arial'; const tw = c.measureText(txt).width;
            c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(S / 2 - tw / 2 - fs * 0.3, S * 0.9 - fs, tw + fs * 0.6, fs * 1.3);
            c.fillStyle = '#333'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(txt, S / 2, S * 0.9);
        }
        async function validateBasemap() {
            if (bmBusy || !bmMap) return;
            const R = bmRadius(); if (!R) { bmInfo('Indiquez un rayon en mètres.'); return; }
            const ll = bmCenter || bmMap.getCenter();
            const btn = document.getElementById('bm-ok'); bmBusy = true; btn.textContent = 'Chargement…'; btn.style.opacity = '0.6';
            await mcLoad.open('Fond de carte', ['Fond de carte'].concat(bmImportSteps({}, { cad: !!(bmSettings.ov && bmSettings.ov.cad) }).map(x => x[0]))); mcLoad.set(0, null, 'Fond de carte : image en haute définition…');
            try {
                const baseKey = bmSettings.base, cap = await bmCapture(ll.lat, ll.lng, R, baseKey), sat = cap.base;
                if (!sat) throw new Error('impossible de télécharger la carte « ' + bmBase().name + ' »');
                const res = { missing: sat.missing };
                const id = 'bm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const ovl = bmStoreCapture(id, cap);
                const r = mmToWorld(R * 1000);
                let c = screenToWorld(canvas.width / 2, canvas.height / 2);
                const hadDrawing = shapes.some(x => x.type !== 'basemap');
                // géoréférencement : le disque est posé à ses vraies coordonnées (Lambert 93, ou la zone CC du plan).
                // Plan vierge : l'origine se cale au km près ; plan déjà dessiné mais non géoréférencé : le dessin garde
                // sa place à l'écran et reçoit les coordonnées réelles du centre du disque.
                const Pg = detectCRS() || ((geoOrigin.x || geoOrigin.y) ? null : crsPrefP(ll.lat));   // plan pas encore géoréférencé : le système choisi dans Paramètres › Fond de plan
                let geoCode = '', rot = 0;
                if (Pg) {
                    const q = lccFwd(Pg, ll.lat, ll.lng);
                    if (!geoOrigin.x && !geoOrigin.y) geoOrigin = hadDrawing ? { x: q.x * 1000 - worldToMm(c.x), y: q.y * 1000 + worldToMm(c.y) } : { x: Math.floor(q.x / 1000) * 1e6, y: Math.floor(q.y / 1000) * 1e6 };
                    c = worldOfLL(Pg, ll.lat, ll.lng);
                    const nn = worldOfLL(Pg, ll.lat + 0.001, ll.lng); rot = Math.atan2(nn.x - c.x, -(nn.y - c.y)); geoCode = Pg.code;
                }
                const shp = { type: 'basemap', hd: bmSettings.hd, layerId: activeLayerId, x: c.x, y: c.y, r, rot, mapId: id, lat: ll.lat, lon: ll.lng, radiusM: R, label: bmLabel || geoCode, base: baseKey, ovl, cadastre: !!ovl.cad };
                if (geoCode) shp.geo = geoCode;
                shapes.unshift(shp);   // tout en dessous : le dessin existant reste au-dessus, rien n'est effacé
                mcLoad.set(0, 1); setTimeout(() => bmImportData(shp, ovl), 400);   // terrain, cadastre en traits, bois, routes : selon l'invité d'import
                // Plan vierge : on cadre le fond de carte. Plan déjà dessiné : on garde la vue, sinon le dessin
                // (souvent quelques mètres) deviendrait minuscule face à une carte de plusieurs centaines de mètres.
                if (!hadDrawing) {
                    camera.zoom = Math.min(canvas.width, canvas.height) * 0.8 / (2 * r);
                    camera.x = canvas.width / 2 - c.x * camera.zoom; camera.y = canvas.height / 2 - c.y * camera.zoom;
                } else { const sc = worldToScreen(c.x, c.y); if (sc.x < 0 || sc.y < 0 || sc.x > canvas.width || sc.y > canvas.height) { camera.x = canvas.width / 2 - c.x * camera.zoom; camera.y = canvas.height / 2 - c.y * camera.zoom; } }
                selectedShapes = [shp]; saveState(); closeBasemapModal();
                draw();
                updateCommandMessageText('FOND DE CARTE : rayon ' + R.toLocaleString('fr-FR') + ' m inséré à l\'échelle, sous le dessin' + (geoCode ? ', géoréférencé (' + geoCode + ' : les coordonnées du plan sont maintenant réelles)' : '') + (res.missing ? ' (' + res.missing + ' tuile(s) manquante(s))' : '') + bmMissingOv(cap) + (hadDrawing ? ' — vue conservée : dézoomez pour voir toute la carte ; tapez 50% pour l\'éclaircir.' : '.'));
            } catch (err) { mcLoad.close(); bmInfo('Erreur : ' + err.message); }
            finally { bmBusy = false; btn.textContent = 'Valider'; btn.style.opacity = ''; }
        }
        // =====================================================================
        // COTATIONS : géométrie commune (cote libre = alignée, cote ortho = horizontale 'h' ou verticale 'v')
        // =====================================================================
        const isDimMode = () => mode === 'dim' || mode === 'dim-ortho';
        function orthoOrient(p1, p2, p3) {
            const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x), minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
            const ex = p3.x < minX ? minX - p3.x : (p3.x > maxX ? p3.x - maxX : 0);
            const ey = p3.y < minY ? minY - p3.y : (p3.y > maxY ? p3.y - maxY : 0);
            if (ey > 0 && ex === 0) return 'h';
            if (ex > 0 && ey === 0) return 'v';
            if (ex === 0 && ey === 0) return (maxX - minX) >= (maxY - minY) ? 'h' : 'v';
            return ey >= ex ? 'h' : 'v';
        }
        // Renvoie les points utiles d'une cote : c1/c2 (extrémités de la ligne de cote), dist, direction u, angle
        function dimGeom(s, dx, dy) {
            dx = dx || 0; dy = dy || 0;
            const p1 = { x: s.x1 + dx, y: s.y1 + dy }, p2 = { x: s.x2 + dx, y: s.y2 + dy }, po = { x: s.ox + dx, y: s.oy + dy };
            let c1, c2, dist;
            if (s.orient === 'h') { c1 = { x: p1.x, y: po.y }; c2 = { x: p2.x, y: po.y }; dist = Math.abs(p2.x - p1.x); }
            else if (s.orient === 'v') { c1 = { x: po.x, y: p1.y }; c2 = { x: po.x, y: p2.y }; dist = Math.abs(p2.y - p1.y); }
            else {
                dist = Math.hypot(p2.x - p1.x, p2.y - p1.y); if (dist < 1e-9) return null;
                const ux = (p2.x - p1.x) / dist, uy = (p2.y - p1.y) / dist, nx = -uy, ny = ux;
                const off = (po.x - p1.x) * nx + (po.y - p1.y) * ny;
                c1 = { x: p1.x + nx * off, y: p1.y + ny * off }; c2 = { x: p2.x + nx * off, y: p2.y + ny * off };
            }
            const L = Math.hypot(c2.x - c1.x, c2.y - c1.y); if (L < 1e-9) return null;
            const ux = (c2.x - c1.x) / L, uy = (c2.y - c1.y) / L;
            return { p1, p2, c1, c2, dist, ux, uy, mid: { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }, ang: Math.atan2(uy, ux) };
        }
        // Parties d'une cote selon le style : traits d'accroche, ligne de cote, extrémités. k = unités monde par mm papier.
        function dimParts(g, st, k) {
            const nx = -g.uy, ny = g.ux, ext = [];
            const side = (p, c) => {
                let vx = c.x - p.x, vy = c.y - p.y; const L = Math.hypot(vx, vy);
                if (L < 1e-9) { vx = nx; vy = ny; } else { vx /= L; vy /= L; }
                const end = { x: c.x + vx * st.extOver * k, y: c.y + vy * st.extOver * k };
                if (st.extMode === 'fix') { const l = Math.max(st.extLen, st.extOver) * k; return [{ x: end.x - vx * l, y: end.y - vy * l }, end]; }
                const gp = Math.min(st.extGap * k, L); return [{ x: p.x + vx * gp, y: p.y + vy * gp }, end];
            };
            if (st.extOn) ext.push(side(g.p1, g.c1), side(g.p2, g.c2));
            const e = st.lineExt * k, ln = [{ x: g.c1.x - g.ux * e, y: g.c1.y - g.uy * e }, { x: g.c2.x + g.ux * e, y: g.c2.y + g.uy * e }];
            const T = [], z = st.termSz * k;
            [[g.c1, 1], [g.c2, -1]].forEach(([c, d]) => {   // d : vers l'intérieur de la cote
                const bx = g.ux * d, by = g.uy * d;
                if (st.term === 'tick') { const h = z / 2 / Math.SQRT2; T.push({ t: 'seg', a: { x: c.x - (g.ux + nx) * h, y: c.y - (g.uy + ny) * h }, b: { x: c.x + (g.ux + nx) * h, y: c.y + (g.uy + ny) * h } }); }
                else if (st.term === 'arrow' || st.term === 'arrowo') { const w = z * 0.22, q = { x: c.x + bx * z, y: c.y + by * z };
                    T.push({ t: st.term === 'arrow' ? 'tri' : 'open', pts: [{ x: q.x + nx * w, y: q.y + ny * w }, { x: c.x, y: c.y }, { x: q.x - nx * w, y: q.y - ny * w }] }); }
                else if (st.term === 'dot') T.push({ t: 'dot', c, r: z * 0.2 });
            });
            return { ext, ln, T };
        }
        // Dessin d'une cote (traits d'accroche, ligne de cote, extrémités) + texte empilé pour le rendu écran
        function drawDimShape(targetCtx, s, col, dx, dy, lineScale) {
            const g = dimGeom(s, dx, dy); if (!g) return;
            const st = dimStyle, k = dimMmW || DIM_PXMM / lineScale, P = dimParts(g, st, k), c = targetCtx;
            const dash = (n) => { c.setLineDash((DIM_DASH[n] || []).map(v => v * k)); c.lineCap = n === 'dotted' ? 'round' : 'butt'; };
            c.save();
            if (P.ext.length) { dash(st.ext); c.globalAlpha = 0.6; c.beginPath(); P.ext.forEach(([a, b]) => { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }); c.stroke(); }
            c.globalAlpha = 1; dash(st.line); c.beginPath(); c.moveTo(P.ln[0].x, P.ln[0].y); c.lineTo(P.ln[1].x, P.ln[1].y); c.stroke();
            c.setLineDash([]); c.lineCap = 'butt'; c.fillStyle = c.strokeStyle;
            P.T.forEach(t => { c.beginPath();
                if (t.t === 'seg') { c.moveTo(t.a.x, t.a.y); c.lineTo(t.b.x, t.b.y); c.stroke(); }
                else if (t.t === 'dot') { c.arc(t.c.x, t.c.y, t.r, 0, 2 * Math.PI); c.fill(); }
                else { t.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); if (t.t === 'tri') { c.closePath(); c.fill(); } else c.stroke(); } });
            c.restore();
            dimensionTextsToDraw.push({ text: dimTxt(s, calculateRealDistance(g.dist)), worldX: g.mid.x, worldY: g.mid.y, color: col, layerId: s.layerId || DIM_LAYER_ID, angle: g.ang, dpos: st.txtPos, dgap: st.txtGap, dbg: st.txtBg });
        }
        // Construit une cote à partir de 2 points et d'une position de ligne (point p3), en mode libre ou ortho
        function makeDim(p1, p2, p3, orient) {
            const d = { type: 'dim', layerId: DIM_LAYER_ID, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ox: p3.x, oy: p3.y };
            if (orient) d.orient = orient;
            return d;
        }
        // Cote suivante d'une chaîne (cumulée ou successive) vers le point pn
        function nextChainDim(pn) {
            const ci = dimChainInfo; if (!ci) return null;
            const from = ci.type === 'cumul' ? ci.base : ci.last;
            const k = ci.count;                     // nombre de cotes déjà posées
            if (ci.orient === 'h') {
                const y = ci.type === 'cumul' ? ci.base.y + ci.step * (k + 1) : ci.lineY;
                return makeDim(from, pn, { x: (from.x + pn.x) / 2, y }, 'h');
            }
            if (ci.orient === 'v') {
                const x = ci.type === 'cumul' ? ci.base.x + ci.step * (k + 1) : ci.lineX;
                return makeDim(from, pn, { x, y: (from.y + pn.y) / 2 }, 'v');
            }
            // libre : décalage le long de la normale, du même côté que la 1re cote
            const L = Math.hypot(pn.x - from.x, pn.y - from.y); if (L < 1e-9) return null;
            let nx = -(pn.y - from.y) / L, ny = (pn.x - from.x) / L;
            if (nx * ci.n.x + ny * ci.n.y < 0) { nx = -nx; ny = -ny; }
            const off = ci.type === 'cumul' ? ci.step * (k + 1) : ci.step;
            return makeDim(from, pn, { x: from.x + nx * off, y: from.y + ny * off }, null);
        }
        function startDimChain(first) {
            if (dimChain === 'single') return;
            const g = dimGeom(first); if (!g) return;
            const ci = { type: dimChain, orient: first.orient || null, base: dimP1, last: dimP2, count: 1 };
            if (ci.orient === 'h') { ci.step = first.oy - dimP1.y; ci.lineY = first.oy; }
            else if (ci.orient === 'v') { ci.step = first.ox - dimP1.x; ci.lineX = first.ox; }
            else {
                const L = Math.hypot(dimP2.x - dimP1.x, dimP2.y - dimP1.y), nx = -(dimP2.y - dimP1.y) / L, ny = (dimP2.x - dimP1.x) / L;
                const off = (first.ox - dimP1.x) * nx + (first.oy - dimP1.y) * ny;
                ci.n = off >= 0 ? { x: nx, y: ny } : { x: -nx, y: -ny }; ci.step = Math.abs(off);
            }
            dimChainInfo = ci; dimStep = 3; isDrawing = true;
        }
        function endDimChain() { dimChainInfo = null; dimStep = 0; isDrawing = false; typedInput = ""; }
        const DIM_CHAIN_LABEL = { single: 'simple', cumul: 'cumulée', succ: 'successive' };
        function toggleDimTextAligned() {
            dimTextAligned = !dimTextAligned;
            try { localStorage.setItem('momocad-dim-text', dimTextAligned ? 'aligned' : 'horizontal'); } catch (e) {}
            refreshDimTextButton(); invalidateCache(); draw();
            updateCommandMessageText('TEXTE DES COTES : ' + (dimTextAligned ? 'aligné sur la ligne de cote.' : 'toujours horizontal.'));
        }
        function refreshDimTextButton() {
            const ic = document.getElementById('dim-text-icon'); if (!ic) return;
            // ligne de cote verticale ; la valeur est soit horizontale (lisible), soit tournée le long de la ligne
            const tick = '<line x1="12" y1="2" x2="12" y2="7"></line><line x1="12" y1="17" x2="12" y2="22"></line><line x1="9.5" y1="2" x2="14.5" y2="2"></line><line x1="9.5" y1="22" x2="14.5" y2="22"></line>';
            const tickA = '<line x1="12" y1="1" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="23"></line><line x1="9.5" y1="1" x2="14.5" y2="1"></line><line x1="9.5" y1="23" x2="14.5" y2="23"></line>';
            ic.innerHTML = dimTextAligned
                ? tickA + '<text x="12" y="12" font-size="7.5" font-family="Arial" font-weight="bold" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 12 12)" textLength="14" lengthAdjust="spacingAndGlyphs">1.23</text>'
                : tick + '<text x="12" y="12" font-size="7.5" font-family="Arial" font-weight="bold" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central">1.23</text>';
            const b = document.getElementById('btn-dim-text'); if (b) b.title = 'Texte des cotes : ' + (dimTextAligned ? 'ALIGNÉ sur la ligne de cote' : 'toujours HORIZONTAL') + ' (clic pour basculer)';
        }
