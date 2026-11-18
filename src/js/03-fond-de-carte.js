        // =====================================================================
        // FOND DE CARTE (OpenStreetMap)
        // Un fond de carte est un objet { type:'basemap', x, y, r, rot, mapId } : image ronde à l'échelle
        // (1 m sur le terrain = 1000 mm dans le dessin). L'image (JPEG) est rangée à part dans basemapStore
        // pour que l'historique (annuler) reste léger.
        // =====================================================================
        let basemapStore = {};
        const basemapImgCache = {};
        let bmMap = null, bmMarker = null, bmCircle = null, bmCenter = null, bmLabel = '', bmBusy = false, bmLayer = null;
        // Fond de plan : une carte de fond (opaque) + des calques superposés (PNG transparents, Géoplateforme IGN).
        // Réglés dans ⛯ Paramètres › Fond de plan ; chaque fond posé garde ses calques, activables un par un dans ses propriétés.
        const GPF = (layer, style, fmt, tms) => { const T = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=' + layer + '&STYLE=' + style + '&TILEMATRIXSET=' + (tms || 'PM') + '&FORMAT=' + fmt;
            return { url: (z, x, y) => T + '&TILEMATRIX=' + z + '&TILEROW=' + y + '&TILECOL=' + x, leaflet: T + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}' }; };
        const ESRI = (svc) => { const T = 'https://server.arcgisonline.com/ArcGIS/rest/services/' + svc + '/MapServer/tile/'; return { url: (z, x, y) => T + z + '/' + y + '/' + x, leaflet: T + '{z}/{y}/{x}' }; };
        const BM_BASES = {
            sat: Object.assign(ESRI('World_Imagery'), { name: 'Satellite', sub: 'Esri, monde entier', maxZoom: 19, attrib: 'imagerie © Esri, Maxar' }),
            ortho: Object.assign(GPF('ORTHOIMAGERY.ORTHOPHOTOS', 'normal', 'image/jpeg'), { name: 'Photo IGN', sub: 'orthophoto IGN, France', maxZoom: 19, attrib: 'photographie aérienne © IGN' }),
            plan: Object.assign(ESRI('World_Street_Map'), { name: 'Plan', sub: 'plan de rues Esri / OSM', maxZoom: 19, attrib: 'plan © Esri, HERE, Garmin, OpenStreetMap' }),
            planign: Object.assign(GPF('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'normal', 'image/png'), { name: 'Plan IGN', sub: 'carte IGN, France', maxZoom: 19, attrib: 'Plan IGN © IGN' })
        };
        const BM_OVLS = {
            cad: Object.assign(GPF('CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'PCI%20vecteur', 'image/png'), { name: 'Cadastre', sub: 'parcelles et bâti (Parcellaire Express)', maxZoom: 19, attrib: 'cadastre © IGN / DGFiP' }),
            communes: Object.assign(GPF('ADMINEXPRESS-COG-CARTO.LATEST', 'normal', 'image/png', 'PM_6_16'), { name: 'Limites de communes', sub: 'communes, départements (Admin Express)', minZoom: 6, maxZoom: 16, attrib: 'limites © IGN' }),
            pentes: Object.assign(GPF('GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN', 'normal', 'image/png'), { name: 'Pentes', sub: 'classes de pente (relief, montagne)', maxZoom: 17, attrib: 'pentes © IGN' }),
            courbes: Object.assign(GPF('ELEVATION.CONTOUR.LINE', 'normal', 'image/png'), { name: 'Courbes de niveau', sub: 'altimétrie IGN', maxZoom: 18, attrib: 'courbes © IGN' }),
            hydro: Object.assign(GPF('HYDROGRAPHY.HYDROGRAPHY', 'normal', 'image/png'), { name: 'Hydrographie', sub: 'cours d\'eau, plans d\'eau', maxZoom: 18, attrib: 'hydrographie © IGN' }),
            routes: Object.assign(GPF('TRANSPORTNETWORKS.ROADS', 'normal', 'image/png'), { name: 'Routes', sub: 'réseau routier', maxZoom: 18, attrib: 'routes © IGN' })
        };
        const BM_OVL_LIST = ['cad'];        // calques image proposés (les autres restent lisibles sur les anciens fonds)
        const BM_PHOTO = ['sat', 'ortho'];           // l'invité d'import ne propose que les fonds photo
        const BM_OVL_ORDER = ['pentes', 'hydro', 'courbes', 'routes', 'communes', 'cad'];      // ordre de dessin (bas → haut)
        const BM_SAT = BM_BASES.sat, BM_CAD = BM_OVLS.cad;
        let bmSettings = { base: 'sat', hd: 'hd', ov: {}, tn: { on: false, pas: 5 }, data: { bois: true, routes: true, eau: true }, crs: 'auto', crs2: 1 };
        try { const v = JSON.parse(localStorage.getItem('momocad-bm') || 'null');
            if (v) bmSettings = { base: BM_PHOTO.includes(v.base) ? v.base : 'sat', hd: BM_HD[v.hd] ? v.hd : 'hd', ov: { cad: !!(v.ov && v.ov.cad) }, tn: Object.assign({ on: false, pas: 5 }, v.tn), data: Object.assign({ bois: true, routes: true, eau: true, bati: !!(v.ov && v.ov.cad) }, v.data), crs: v.crs2 ? (v.crs || 'auto') : 'auto', crs2: 1 };
            else bmSettings.ov.cad = localStorage.getItem('momocad-basemap-cadastre') === '1'; } catch (e) {}
        function bmSaveSettings() { try { localStorage.setItem('momocad-bm', JSON.stringify(bmSettings)); } catch (e) {} }
        const bmBase = () => BM_BASES[bmSettings.base] || BM_BASES.sat;
        const bmOvlOn = (s, k) => s.ovl ? !!s.ovl[k] : (k === 'cad' && !!s.cadastre);
        // fenêtre de recherche (Leaflet) : carte et calques choisis
        let bmLLayers = {};
        function bmApplyLayers(map, cache, set) {
            if (!map) return;
            const want = ['b:' + set.base].concat(BM_OVL_ORDER.filter(k => set.ov[k]).map(k => 'o:' + k));
            Object.keys(cache).forEach(key => { if (!want.includes(key) && map.hasLayer(cache[key])) map.removeLayer(cache[key]); });
            want.forEach((key, i) => {
                const src = key[0] === 'b' ? BM_BASES[key.slice(2)] : BM_OVLS[key.slice(2)]; if (!src) return;
                if (!cache[key]) cache[key] = L.tileLayer(src.leaflet, { maxZoom: 20, maxNativeZoom: src.maxZoom, minNativeZoom: src.minZoom || 0, attribution: src.attrib, crossOrigin: true });
                if (!map.hasLayer(cache[key])) cache[key].addTo(map); cache[key].setZIndex(i + 1);
            });
        }
        function bmRefreshLeaflet() { bmApplyLayers(bmMap, bmLLayers, bmSettings); }
        // Aperçu dans ⛯ Paramètres › Fond de plan : suit les choix en cours (avant Valider), centré sur le plan s'il est géoréférencé
        let psBmMap = null, psBmLayers = {};
        function psBmForm() { const set = { base: document.getElementById('ps-bmbase').value, ov: {} }; BM_OVL_LIST.forEach(k => { set.ov[k] = document.getElementById('ps-ov-' + k).checked; }); return set; }
        function psBmCenter() {
            const P = detectCRS(); if (P) { const c = screenToWorld(canvas.width / 2, canvas.height / 2), ll = llOfWorld(P, c.x, c.y); return { lat: ll.lat, lng: ll.lon, z: 17, src: 'centre du plan (' + P.code + ')' }; }
            const b = shapes.find(x => x.type === 'basemap'); if (b) return { lat: b.lat, lng: b.lon, z: 17, src: 'fond de carte du plan' };
            let v = null; try { v = JSON.parse(localStorage.getItem('momocad-basemap-view') || 'null'); } catch (e) {}
            if (v) return { lat: v.lat, lng: v.lng, z: Math.max(v.z, 15), src: 'dernier lieu recherché' };
            return { lat: 44.5594, lng: 6.0786, z: 15, src: 'Gap (plan non géoréférencé)' };
        }
        async function psBmPreview(recenter) {
            const box = document.getElementById('ps-bm-prev'); if (!box) return;
            try { await loadLeaflet(); } catch (e) { document.getElementById('ps-bm-prev-info').textContent = 'Aperçu indisponible : ' + e.message; return; }
            const C = psBmCenter();
            if (!psBmMap) { psBmMap = L.map(box, { zoomControl: true, attributionControl: true }).setView([C.lat, C.lng], C.z); recenter = false; }
            else if (recenter) psBmMap.setView([C.lat, C.lng], C.z);
            bmApplyLayers(psBmMap, psBmLayers, psBmForm());
            setTimeout(() => psBmMap.invalidateSize(), 30);
            const f = psBmForm(), ov = BM_OVL_LIST.filter(k => f.ov[k]).map(k => BM_OVLS[k].name);
            document.getElementById('ps-bm-prev-info').textContent = (BM_BASES[f.base] || BM_SAT).name + (ov.length ? ' + ' + ov.join(', ') : '') + ' — ' + C.src;
        }
        function bmSetCadastre(on) { bmSettings.ov.cad = !!on; bmSaveSettings(); bmRefreshLeaflet(); }
        function bmSetData(k, v) { bmSettings.data = bmSettings.data || {}; bmSettings.tn = bmSettings.tn || { on: false, pas: 5 };
            if (k === 'tn') bmSettings.tn.on = !!v; else if (k === 'pas') bmSettings.tn.pas = +v || 5; else bmSettings.data[k] = !!v; bmSaveSettings(); bmDataUI(); }
        function bmDataUI() { const D = bmSettings.data || {}, T = bmSettings.tn || {}, g = (id) => document.getElementById(id); if (!g('bm-tn')) return;
            g('bm-cadastre').checked = !!bmSettings.ov.cad; g('bm-bati').checked = !!D.bati; g('bm-tn').checked = !!T.on; g('bm-tn-pas').value = String(T.pas || 5); g('bm-tn-pas').disabled = !T.on; g('bm-bois').checked = !!D.bois; g('bm-routes').checked = !!D.routes; g('bm-eau').checked = !!D.eau; g('bm-eau').closest('label').style.opacity = T.on ? 1 : 0.5;
            g('bm-routes').closest('label').style.opacity = T.on ? 1 : 0.5; g('bm-routes').closest('label').title = T.on ? 'Routes (IGN) : chaussées plates au profil lissé, bords en lignes de rupture du terrain naturel' : 'Routes : il faut aussi le terrain IGN pour les caler'; g('bm-eau').closest('label').title = T.on ? 'Hydrographie : cours d\'eau et plans d\'eau (IGN), lit taillé dans le terrain naturel, eau posée' : 'Hydrographie : il faut aussi le terrain IGN'; }
        function bmSetBaseModal(v) { if (!BM_BASES[v]) return; bmSettings.base = v; bmSaveSettings(); bmRefreshLeaflet(); }
        // capture : fond + calques demandés autour d'un centre (le cadastre est toujours pris, pour pouvoir l'activer ensuite)
        async function bmCapture(lat, lon, R, baseKey) {
            const keys = BM_OVL_LIST.filter(k => k === 'cad' || bmSettings.ov[k]);
            const res = await Promise.all([buildBasemapLayer(BM_BASES[baseKey] || BM_SAT, lat, lon, R, true)].concat(keys.map(k => buildBasemapLayer(BM_OVLS[k], lat, lon, R, false))));
            const ov = {}; keys.forEach((k, i) => { if (res[i + 1]) ov[k] = res[i + 1]; });
            return { base: res[0], ov };
        }
        function bmStoreCapture(id, cap) {
            basemapStore[id] = cap.base.cv.toDataURL('image/jpeg', 0.88); bmImg(id);
            const ovl = {};
            for (const k in cap.ov) { basemapStore[id + '_' + k] = cap.ov[k].cv.toDataURL('image/png'); bmImg(id + '_' + k); ovl[k] = !!bmSettings.ov[k]; }
            return ovl;
        }
        // Propriétés d'un fond posé : calque activé / masqué ; s'il n'a pas été téléchargé, il l'est à la demande
        async function toggleBasemapOverlay(k, on) {
            const bs = selectedShapes.filter(x => x.type === 'basemap'); if (!bs.length || !BM_OVLS[k]) return;
            let miss = 0;
            for (const b of bs) {
                if (!b.ovl) b.ovl = { cad: !!b.cadastre };
                if (on && !basemapStore[b.mapId + '_' + k]) {
                    updateCommandMessageText('FOND DE CARTE : téléchargement du calque ' + BM_OVLS[k].name + '…');
                    const L1 = await buildBasemapLayer(BM_OVLS[k], b.lat, b.lon, b.radiusM, false);
                    if (!L1) { miss++; continue; }
                    basemapStore[b.mapId + '_' + k] = L1.cv.toDataURL('image/png'); bmImg(b.mapId + '_' + k);
                }
                b.ovl[k] = !!on; if (k === 'cad') b.cadastre = !!on;
            }
            // cadastre allumé : on récupère aussi ses parcelles en traits, sur un calque (une fois par fond)
            if (k === 'cad' && on) { const b0 = bs.find(b => !b.cadVec || !b.cadVec.n); if (b0) { saveState(); draw(); updatePropertiesPopup(); cadFetch(b0); return; } }
            saveState(); draw(); updatePropertiesPopup();
            updateCommandMessageText(miss ? 'FOND DE CARTE : calque ' + BM_OVLS[k].name + ' indisponible ici (aucune tuile reçue).' : 'FOND DE CARTE : ' + BM_OVLS[k].name + (on ? ' affiché.' + (k === 'cad' ? ' Pour le récupérer en traits (polylignes accrochables, sur un calque) : bouton « 🗺 Cadastre vectorisé » dans les propriétés du fond.' : '') : ' masqué.'));
        }
        function toggleBasemapCadastre(on) { return toggleBasemapOverlay('cad', on); }
        // Propriétés : changer la carte de fond d'un fond déjà posé (nouveau téléchargement, même centre et rayon)
        async function changeBasemapBase(v) {
            const bs = selectedShapes.filter(x => x.type === 'basemap'); if (!bs.length || !BM_BASES[v]) return;
            updateCommandMessageText('FOND DE CARTE : téléchargement de « ' + BM_BASES[v].name + ' »…');
            let miss = 0;
            for (const b of bs) {
                const im = await buildBasemapLayer(BM_BASES[v], b.lat, b.lon, b.radiusM, true);
                if (!im) { miss++; continue; }
                basemapStore[b.mapId] = im.cv.toDataURL('image/jpeg', 0.88); bmImg(b.mapId); b.base = v;
            }
            saveState(); draw(); updatePropertiesPopup();
            updateCommandMessageText(miss ? 'FOND DE CARTE : « ' + BM_BASES[v].name + ' » indisponible ici (aucune tuile reçue).' : 'FOND DE CARTE : carte « ' + BM_BASES[v].name + ' » appliquée.');
        }
        // Propriétés : retélécharger le fond posé (et ses calques) à la netteté choisie, même carte, même cercle
        async function bmSharpen(hd) { const bs = selectedShapes.filter(x => x.type === 'basemap'); if (!bs.length) return; if (hd && BM_HD[hd]) { bmSettings.hd = hd; bmSaveSettings(); }
            updateCommandMessageText('FOND DE CARTE : téléchargement en netteté « ' + ({ std: 'standard', hd: 'haute', uhd: 'très haute' })[bmSettings.hd] + ' »…'); let miss = 0;
            for (const b of bs) { const im = await buildBasemapLayer(BM_BASES[b.base] || BM_SAT, b.lat, b.lon, b.radiusM, true); if (!im) { miss++; continue; }
                basemapStore[b.mapId] = im.cv.toDataURL('image/jpeg', 0.88); bmImg(b.mapId); b.hd = bmSettings.hd;
                for (const k of BM_OVL_LIST) { if (!basemapStore[b.mapId + '_' + k]) continue; const o = await buildBasemapLayer(BM_OVLS[k], b.lat, b.lon, b.radiusM, false); if (o) { basemapStore[b.mapId + '_' + k] = o.cv.toDataURL('image/png'); bmImg(b.mapId + '_' + k); } } }
            saveState(); draw(); updatePropertiesPopup(); updateCommandMessageText(miss ? 'FOND DE CARTE : rien reçu, réessayez.' : 'FOND DE CARTE : retéléchargé, ' + nfr(bmHdPx(), 0) + ' px de diamètre (au mieux 25 cm par pixel).'); }
        // ---- Projections françaises : Lambert 93 et coniques conformes CC42…CC50 (GRS80 ≈ WGS84) ----
        function lccParams(code) {
            const D = Math.PI / 180;
            const p = code === 'L93' ? { l0: 3, p0: 46.5, p1: 44, p2: 49, x0: 700000, y0: 6600000 }
                : { l0: 3, p0: +code.slice(2), p1: +code.slice(2) - 0.75, p2: +code.slice(2) + 0.75, x0: 1700000, y0: (+code.slice(2) - 41) * 1e6 + 200000 };
            const a = 6378137, e = 0.0818191910428158, m = (f) => Math.cos(f) / Math.sqrt(1 - e * e * Math.sin(f) ** 2);
            const t = (f) => Math.tan(Math.PI / 4 - f / 2) / Math.pow((1 - e * Math.sin(f)) / (1 + e * Math.sin(f)), e / 2);
            const f0 = p.p0 * D, f1 = p.p1 * D, f2 = p.p2 * D, n = (Math.log(m(f1)) - Math.log(m(f2))) / (Math.log(t(f1)) - Math.log(t(f2)));
            const F = m(f1) / (n * Math.pow(t(f1), n)), r0 = a * F * Math.pow(t(f0), n);
            return { a, e, n, F, r0, l0: p.l0 * D, x0: p.x0, y0: p.y0, t, code };
        }
        function lccFwd(P, lat, lon) { const D = Math.PI / 180, r = P.a * P.F * Math.pow(P.t(lat * D), P.n), th = P.n * (lon * D - P.l0); return { x: P.x0 + r * Math.sin(th), y: P.y0 + P.r0 - r * Math.cos(th) }; }
        function lccInv(P, x, y) {
            const dx = x - P.x0, dy = P.r0 - (y - P.y0), r = Math.sign(P.n) * Math.hypot(dx, dy), t = Math.pow(r / (P.a * P.F), 1 / P.n), th = Math.atan2(dx, dy);
            let f = Math.PI / 2 - 2 * Math.atan(t); for (let i = 0; i < 8; i++) { const es = P.e * Math.sin(f); f = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - es) / (1 + es), P.e / 2)); }
            return { lat: f * 180 / Math.PI, lon: (th / P.n + P.l0) * 180 / Math.PI };
        }
        // Système du plan déduit des coordonnées réelles (m) : Lambert 93, ou CC zone selon le Y ; null si le plan n'est pas géoréférencé
        function detectCRS() {
            const c = screenToWorld(canvas.width / 2, canvas.height / 2), X = realX(c.x) / 1000, Y = realY(c.y) / 1000;
            if (X > 50000 && X < 1300000 && Y > 6000000 && Y < 7200000) return lccParams('L93');
            if (X > 1000000 && X < 2400000 && Y > 1000000 && Y < 9400000) { const z = Math.max(42, Math.min(50, Math.round((Y - 200000) / 1e6) + 41)); return lccParams('CC' + z); }
            return null;
        }
        const crsName = (c) => c === 'L93' ? 'Lambert 93' : c;
        // système d'un plan neuf : « Auto » (par défaut) = la zone CC du lieu (CC42 à CC50 selon la latitude) ; sinon celui choisi dans Paramètres
        const crsAutoCode = (lat) => 'CC' + Math.max(42, Math.min(50, Math.round(lat)));
        const crsPrefP = (lat) => lccParams(bmSettings.crs && bmSettings.crs !== 'auto' ? bmSettings.crs : isFinite(lat) ? crsAutoCode(lat) : 'L93');
        // CHANGER DE SYSTÈME : tout le plan passe d'un système à l'autre (Lambert 93 ↔ CC42…CC50). Sur l'emprise d'un chantier, le passage
        // est une similitude (rotation de la convergence des méridiens + facteur d'échelle + translation), calée au centre du dessin
        function crsConvertAsk(to) { const From = detectCRS(); if (!From) { alert('Le plan n\'est pas encore géoréférencé : le système choisi servira au premier fond de carte.'); return; }
            if (to === 'auto') { const c = screenToWorld(canvas.width / 2, canvas.height / 2); to = crsAutoCode(llOfWorld(From, c.x, c.y).lat); }
            if (From.code === to) { alert('Le plan est déjà en ' + crsName(to) + '.'); return; }
            if (!confirm('Convertir tout le plan de ' + crsName(From.code) + ' vers ' + crsName(to) + ' ?\n\nLe dessin garde sa place sur le fond de carte ; ses coordonnées changent. Ctrl+Z pour revenir.')) return; crsConvert(to); }
        function crsConvert(to) {
            const From = detectCRS(), To = lccParams(to); if (!From) return false; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            shapes.forEach(s => { (s.points || [s.x1 !== undefined ? { x: s.x1, y: s.y1 } : s]).forEach(q => { if (q && isFinite(q.x) && isFinite(q.y)) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } }); });
            const c = isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : screenToWorld(canvas.width / 2, canvas.height / 2);
            const R0 = { x: realX(c.x) / 1000, y: realY(c.y) / 1000 }, fw = (x, y) => { const ll = lccInv(From, x, y); return lccFwd(To, ll.lat, ll.lon); }, A = fw(R0.x, R0.y), E = fw(R0.x + 100, R0.y);
            const th = Math.atan2(E.y - A.y, E.x - A.x), k = Math.hypot(E.x - A.x, E.y - A.y) / 100;
            shapes.forEach(s => { applyRotationToShape(s, c.x, c.y, -th); if (Math.abs(k - 1) > 1e-7) applyScaleToShape(s, c.x, c.y, k); if (s.type === 'basemap' && s.geo) s.geo = to; });
            geoOrigin = { x: A.x * 1000 - worldToMm(c.x), y: A.y * 1000 + worldToMm(c.y) };
            invalidateCache(); try { tinCache = null; } catch (e) {} saveState(); draw(); if (typeof is3DOpen === 'function' && is3DOpen()) build3DScene();
            updateCommandMessageText('COORDONNÉES : plan converti de ' + crsName(From.code) + ' en ' + crsName(to) + ' (rotation ' + nfr(th * 180 / Math.PI, 4) + '°, échelle ' + nfr(k, 6) + '). Ctrl+Z pour revenir.'); return true;
        }
        const worldOfLL = (P, lat, lon) => { const q = lccFwd(P, lat, lon); return { x: mmToWorld(q.x * 1000 - geoOrigin.x), y: -mmToWorld(q.y * 1000 - geoOrigin.y) }; };
        const llOfWorld = (P, wx, wy) => lccInv(P, realX(wx) / 1000, realY(wy) / 1000);
        // ---- Implantation d'un fond de carte sur un plan géoréférencé : toute la vue en satellite, un cercle clair à placer ----
        let bmPlace = null;   // { P, tiles:[{im,z,tx,ty}], z, ext, R (m), loading, timer }
        // fonctions qui ont besoin d'Internet : un message clair quand le poste est hors ligne
        function netWarn(what) { const msg = '🌐 ' + what + ' a besoin d\'Internet, et ce poste semble hors ligne. Le reste de MomoCAD fonctionne normalement.'; updateCommandMessageText(msg); try { flashUntil = Date.now() + 8000; } catch (e) {} return msg; }
        const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
        function startBmPlace() {
            if (isOffline()) netWarn('Le fond de carte');
            const P = detectCRS();
            openBasemapModal(P); return;   // la fenêtre de configuration s'ouvre à chaque import (lieu, fond, rayon, données à importer)
        }
        function bmViewLL(P) {   // étendue de la vue en lat / lon (+ marge)
            const pts = [[0, 0], [canvas.width, 0], [0, canvas.height], [canvas.width, canvas.height]].map(([x, y]) => { const w = screenToWorld(x, y); return llOfWorld(P, w.x, w.y); });
            const la = pts.map(q => q.lat), lo = pts.map(q => q.lon), mla = (arrMax(la) - arrMin(la)) * 0.15, mlo = (arrMax(lo) - arrMin(lo)) * 0.15;
            return { s: arrMin(la) - mla, n: arrMax(la) + mla, w: arrMin(lo) - mlo, e: arrMax(lo) + mlo };
        }
        const tileX = (lon, n) => (lon + 180) / 360 * n, tileY = (lat, n) => { const sl = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * n; };
        const lonOfTX = (x, n) => x / n * 360 - 180, latOfTY = (y, n) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
        function bmPlaceLoad() {
            const B = bmPlace; if (!B || mode !== 'bmplace') return;
            const E = bmViewLL(B.P);
            let z = bmBase().maxZoom; for (; z > 3; z--) { const n = 2 ** z, nx = Math.floor(tileX(E.e, n)) - Math.floor(tileX(E.w, n)) + 1, ny = Math.floor(tileY(E.s, n)) - Math.floor(tileY(E.n, n)) + 1; if (nx * ny <= 120) break; }
            if (B.ext && B.z === z && B.base === bmSettings.base && E.w >= B.ext.w && E.e <= B.ext.e && E.s >= B.ext.s && E.n <= B.ext.n) return;   // déjà couvert
            const src = bmBase(); B.base = bmSettings.base; const n = 2 ** z, gen = ++B.gen, x0 = Math.floor(tileX(E.w, n)), x1 = Math.floor(tileX(E.e, n)), y0 = Math.floor(tileY(E.n, n)), y1 = Math.floor(tileY(E.s, n));
            B.loading = true; updateCommandMessage();
            const jobs = [];
            for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) jobs.push(new Promise(res => {
                const im = new Image(); im.crossOrigin = 'anonymous'; const to = setTimeout(() => res(null), 15000);
                im.onload = () => { clearTimeout(to); res({ im, z, tx, ty }); }; im.onerror = () => { clearTimeout(to); res(null); }; im.src = src.url(z, tx, ty);
            }));
            Promise.all(jobs).then(t => { if (!bmPlace || bmPlace.gen !== gen) return; B.tiles = t.filter(Boolean); B.z = z; B.ext = E; B.loading = false; B.missing = t.length - B.tiles.length; updateCommandMessage(); if (t.length && !B.tiles.length) netWarn('Le fond de carte (aucune image reçue)'); draw(); });
        }
        function bmPlaceSchedule() { const B = bmPlace; if (!B) return; clearTimeout(B.timer); B.timer = setTimeout(bmPlaceLoad, 350); }
        // aperçu : tuiles reprojetées (par affinité, tuile par tuile), voile sombre et cercle clair sous le curseur
        function drawBmPlace(c) {
            const B = bmPlace; if (!B || mode !== 'bmplace') return;
            for (const t of B.tiles) {
                const n = 2 ** t.z, ll = (x, y) => worldOfLL(B.P, latOfTY(y, n), lonOfTX(x, n));
                const A = ll(t.tx, t.ty), Bx = ll(t.tx + 1, t.ty), C = ll(t.tx, t.ty + 1);
                c.save(); c.transform((Bx.x - A.x) / 256, (Bx.y - A.y) / 256, (C.x - A.x) / 256, (C.y - A.y) / 256, A.x, A.y); c.drawImage(t.im, 0, 0, 256.6, 256.6); c.restore();
            }
            const r = mmToWorld(B.R * 1000), w0 = screenToWorld(0, 0), w1 = screenToWorld(canvas.width, canvas.height);
            c.save(); c.fillStyle = 'rgba(10,14,22,0.62)'; c.beginPath(); c.rect(w0.x, w0.y, w1.x - w0.x, w1.y - w0.y); c.moveTo(currentX + r, currentY); c.arc(currentX, currentY, r, 0, 2 * Math.PI, true); c.fill('evenodd');
            c.strokeStyle = '#34d399'; c.lineWidth = 2 / camera.zoom; c.setLineDash([]); c.beginPath(); c.arc(currentX, currentY, r, 0, 2 * Math.PI); c.stroke();
            c.restore();
            bmPlaceSchedule();
        }
        async function placeBasemapAt(wx, wy) {
            const B = bmPlace; if (!B || B.busy) return; B.busy = true; updateCommandMessageText('FOND DE CARTE : téléchargement de l\'image en haute définition…');
            await mcLoad.open('Fond de carte', ['Fond de carte'].concat(bmImportSteps({}, { cad: !!(bmSettings.ov && bmSettings.ov.cad) }).map(x => x[0]))); mcLoad.set(0, null, 'Fond de carte : image en haute définition…');
            try {
                const ll = llOfWorld(B.P, wx, wy), R = B.R;
                const baseKey = bmSettings.base, cap = await bmCapture(ll.lat, ll.lon, R, baseKey), sat = cap.base;
                if (!sat) throw new Error('impossible de télécharger la carte « ' + bmBase().name + ' »');
                const id = 'bm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const ovl = bmStoreCapture(id, cap);
                // nord géographique dans la grille Lambert (convergence des méridiens)
                const nn = worldOfLL(B.P, ll.lat + 0.001, ll.lon), cc = worldOfLL(B.P, ll.lat, ll.lon), rot = Math.atan2(nn.x - cc.x, -(nn.y - cc.y));
                const shp = { type: 'basemap', hd: bmSettings.hd, layerId: activeLayerId, x: cc.x, y: cc.y, r: mmToWorld(R * 1000), rot, mapId: id, lat: ll.lat, lon: ll.lon, radiusM: R, label: B.P.code, base: baseKey, ovl, cadastre: !!ovl.cad, geo: B.P.code };
                shapes.unshift(shp); saveState();
                setMode('select-box'); selectedShapes = [shp]; draw();
                mcLoad.set(0, 1); setTimeout(() => bmImportData(shp, ovl), 50);   // terrain, cadastre en traits, bois, routes : selon l'invité d'import
                updateCommandMessageText('FOND DE CARTE : rayon ' + R.toLocaleString('fr-FR') + ' m implanté à sa place (' + B.P.code + ', nord tourné de ' + (rot * 180 / Math.PI).toFixed(2).replace('.', ',') + '°)' + (sat.missing ? ' — ' + sat.missing + ' tuile(s) manquante(s)' : '') + bmMissingOv(cap) + '. Tapez 50% pour l\'éclaircir.');
            } catch (err) { mcLoad.close(); updateCommandMessageText('FOND DE CARTE : erreur — ' + err.message); }
            finally { if (bmPlace) bmPlace.busy = false; }
        }
