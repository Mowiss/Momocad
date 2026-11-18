        // =====================================================================
        // TERRAIN NATUREL IGN : grille de points cotés (service altimétrique de la Géoplateforme IGN, RGE ALTI)
        // =====================================================================
        const TN_API = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
        let tnBusy = false;
        async function tnFetch(b, pas) {
            if (tnBusy) { updateCommandMessageText('TERRAIN IGN : un téléchargement est déjà en cours.'); return; }
            pas = Math.max(0.5, +pas || 5);
            const R = worldToMm(b.r) / 1000; let nb = Math.PI * (R / pas) ** 2;
            while (nb > TIN_MAX) { pas *= 1.25; nb = Math.PI * (R / pas) ** 2; } pas = Math.round(pas * 10) / 10;   // au-delà, le terrain ne pourrait pas tout trianguler : pas élargi d'office
            const P = b.geo ? lccParams(b.geo) : null, cosL = Math.cos(b.lat * Math.PI / 180), rot = b.rot || 0;
            const llOf = (wx, wy) => { if (P) return llOfWorld(P, wx, wy);   // plan géoréférencé : vraie projection
                const ex = worldToMm(wx - b.x) / 1000, ny = -worldToMm(wy - b.y) / 1000, e = ex * Math.cos(rot) - ny * Math.sin(rot), n = ex * Math.sin(rot) + ny * Math.cos(rot);
                return { lat: b.lat + n / 111320, lon: b.lon + e / (111320 * cosL) }; };
            const step = mmToWorld(pas * 1000), pts = [];
            for (let gx = -R; gx <= R + 1e-9; gx += pas) for (let gy = -R; gy <= R + 1e-9; gy += pas) { if (gx * gx + gy * gy > R * R) continue;
                const wx = b.x + mmToWorld(gx * 1000), wy = b.y - mmToWorld(gy * 1000); pts.push({ wx, wy, ll: llOf(wx, wy) }); }
            if (!pts.length) return;
            tnBusy = true; const lay = cartoGroup(ensureLayer('TN IGN', '#86efac')), got = []; updateLayerUI();
            try {
                const N = 180;
                for (let i = 0; i < pts.length; i += N) {
                    const chunk = pts.slice(i, i + N);
                    if (mcLoad.has('Terrain IGN')) mcLoad.set('Terrain IGN', i / pts.length, 'Terrain IGN : altitudes… ' + Math.round(i / pts.length * 100) + ' %'); updateCommandMessageText('TERRAIN IGN : téléchargement des altitudes… ' + Math.round(i / pts.length * 100) + ' % (' + pts.length.toLocaleString('fr-FR') + ' points, pas ' + nfr(pas, 0) + ' m)');
                    const url = TN_API + '?resource=ign_rge_alti_wld&delimiter=|&zonly=false&indent=false&measures=false&lon=' + chunk.map(q => q.ll.lon.toFixed(7)).join('|') + '&lat=' + chunk.map(q => q.ll.lat.toFixed(7)).join('|');
                    let js = null;
                    for (let k = 0; k < 3 && !js; k++) { try { const r = await fetch(url); if (r.ok) js = await r.json(); else await new Promise(res => setTimeout(res, 600)); } catch (e) { await new Promise(res => setTimeout(res, 600)); } }
                    if (!js || !js.elevations) throw new Error('service altimétrique de l\'IGN injoignable');
                    js.elevations.forEach((e, k) => { const z = +e.z; if (isFinite(z) && z > -1000) got.push({ q: chunk[k], z }); });
                    await new Promise(res => setTimeout(res, 220));   // le service accepte 5 requêtes par seconde
                }
                // les anciens points IGN de ce cercle sont remplacés
                const r2 = b.r * b.r * 1.0001;
                shapes = shapes.filter(x => !(x.type === 'point' && x.code === 'TN_IGN' && (x.x - b.x) ** 2 + (x.y - b.y) ** 2 <= r2));
                got.forEach((g, k) => shapes.push({ type: 'point', layerId: lay, x: g.q.wx, y: g.q.wy, z: Math.round(g.z * 1000), zk: 1, code: 'TN_IGN', mat: 'IGN' + (k + 1) }));
                b.tnPas = pas; selectedShapes = selectedShapes.filter(x => shapes.includes(x));
                invalidateCache(); saveState(); updateLayerUI(); draw(); updatePropertiesPopup();
                const zs = got.map(g => g.z);
                updateCommandMessageText(got.length ? 'TERRAIN IGN : ' + got.length.toLocaleString('fr-FR') + ' points cotés (pas ' + nfr(pas, 0) + ' m, de ' + nfr(arrMin(zs), 2) + ' à ' + nfr(arrMax(zs), 2) + ' m) sur le calque « TN IGN ». Modèle de terrain : à confirmer par un levé pour l\'exécution.' : 'TERRAIN IGN : aucune altitude reçue ici (hors France ?).');
            } catch (e) { updateCommandMessageText('TERRAIN IGN : ' + e.message + ' — réessayez depuis les propriétés du fond.'); }
            finally { tnBusy = false; }
        }
        // =====================================================================
        // CADASTRE VECTORISÉ : parcelles du Parcellaire Express (IGN / DGFiP) sur le cercle du fond, en polylignes fermées + numéros, sur des calques « Cadastre »
        // (et le bâti, BD TOPO, s'il répond). Le fond de plan peut être de n'importe quelle carte (OSM, satellite…).
        // =====================================================================
        const CAD_WFS = 'https://data.geopf.fr/wfs/ows';
        let cadBusy = false;
        // projection lat / lon → monde pour ce fond (plan géoréférencé : vraie projection ; sinon repère local du fond, nord tourné de rot)
        function bmWorldOfLL(b) { const P = b.geo ? lccParams(b.geo) : null, cosL = Math.cos(b.lat * Math.PI / 180), rot = b.rot || 0;
            return (lat, lon) => { if (P) return worldOfLL(P, lat, lon); const n = (lat - b.lat) * 111320, e = (lon - b.lon) * 111320 * cosL, ex = e * Math.cos(rot) + n * Math.sin(rot), ny = -e * Math.sin(rot) + n * Math.cos(rot);
                return { x: b.x + mmToWorld(ex * 1000), y: b.y - mmToWorld(ny * 1000) }; }; }
        // lecture JSON d'un service : 3 essais ; une réponse qui n'est pas du JSON (erreur du service) est signalée avec son début
        async function cadGet(url) { let last = null; for (let k = 0; k < 3; k++) { try { const r = await fetch(url); const t = await r.text(); if (r.ok) { try { return JSON.parse(t); } catch (e) { last = new Error('réponse illisible : ' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)); } } else last = new Error('réponse ' + r.status + ' ' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)); } catch (e) { last = new Error(e && e.message ? e.message : 'réseau'); } await new Promise(res => setTimeout(res, 600)); } throw last || new Error('injoignable'); }
        async function cadWfs(type, E, n) { const q = '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=' + type + '&OUTPUTFORMAT=application/json&COUNT=' + (n || 1000) + '&BBOX=' + [E.s, E.w, E.n, E.e].map(v => v.toFixed(7)).join(',') + ',urn:ogc:def:crs:EPSG::4326';
            try { return await cadGet(CAD_WFS + q); } catch (e) { return await cadGet('https://data.geopf.fr/wfs' + q); } }
        // parcelles : API Carto cadastre (IGN, faite pour les applications web), sinon le WFS de la Géoplateforme ; par pages de 1 000
        async function cadParcels(E) { const errs = [], ring = [[E.w, E.s], [E.e, E.s], [E.e, E.n], [E.w, E.n], [E.w, E.s]], geom = encodeURIComponent(JSON.stringify({ type: 'Polygon', coordinates: [ring] }));
            try { let all = []; for (let st = 0; st < 20000; st += 1000) { const js = await cadGet('https://apicarto.ign.fr/api/cadastre/parcelle?geom=' + geom + '&_limit=1000&_start=' + st); const f = (js && js.features) || []; all = all.concat(f); if (f.length < 1000) break; } if (all.length) return all; errs.push('API Carto : aucune parcelle'); } catch (e) { errs.push('API Carto : ' + e.message); }
            try { const js = await cadWfs('CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle', E); const f = (js && js.features) || []; if (f.length) return f; errs.push('WFS : aucune parcelle'); } catch (e) { errs.push('WFS : ' + e.message); }
            try { const f = await cadEtalab(E, 'parcelles'); if (f.length) return f; errs.push('cadastre.data.gouv.fr : aucune parcelle'); } catch (e) { errs.push('cadastre.data.gouv.fr : ' + e.message); }
            const er = new Error(errs.join(' · ')); er.cad = true; throw er; }
        // 3e source : les fichiers du cadastre Etalab (cadastre.data.gouv.fr), commune par commune (codes donnés par geo.api.gouv.fr), gardés sur l'emprise
        async function cadEtalab(E, kind) {
            const pts = [[(E.s + E.n) / 2, (E.w + E.e) / 2], [E.s, E.w], [E.s, E.e], [E.n, E.w], [E.n, E.e]], codes = new Set();
            for (const [la, lo] of pts) { try { const js = await cadGet('https://geo.api.gouv.fr/communes?lat=' + la.toFixed(6) + '&lon=' + lo.toFixed(6) + '&fields=code&format=json'); (js || []).forEach(c => c && c.code && codes.add(c.code)); } catch (e) {} }
            if (!codes.size) throw new Error('commune introuvable');
            const inE = (f) => { const g = f.geometry; if (!g) return false; const P = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return P.some(poly => poly.some(r => r.some(([x, y]) => (x >= E.w && x <= E.e && y >= E.s && y <= E.n) || (y >= E.w && y <= E.e && x >= E.s && x <= E.n)))); };
            let out = [];
            for (const c of codes) { const dep = /^97/.test(c) ? c.slice(0, 3) : c.slice(0, 2); let js = null;
                try { const r = await fetch('https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/' + dep + '/' + c + '/cadastre-' + c + '-' + kind + '.json.gz'); if (!r.ok) throw new Error('réponse ' + r.status);
                    const raw = r.headers.get('content-type') || ''; let txt;
                    if (/json/.test(raw)) txt = await r.text(); else { const ds = new Response(r.body.pipeThrough(new DecompressionStream('gzip'))); txt = await ds.text(); }
                    js = JSON.parse(txt); } catch (e) { try { js = await cadGet('https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/' + c + '/geojson/' + kind); } catch (e2) { continue; } }
                out = out.concat(((js && js.features) || []).filter(inE).map(f => { const pr = f.properties || {}; return { type: 'Feature', geometry: f.geometry, properties: Object.assign({}, pr, { idu: pr.idu || pr.id, code_insee: pr.code_insee || pr.commune, section: pr.section, numero: pr.numero, contenance: pr.contenance }) }; })); }
            return out; }
        // anneaux d'une géométrie GeoJSON (Polygon / MultiPolygon), en [lon, lat] ; l'ordre des axes est vérifié sur le centre du fond
        function cadRings(g, b) { if (!g) return []; const P = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; const out = [];
            P.forEach(poly => poly.forEach((ring, k) => { if (ring.length < 4) return; const swap = Math.abs(ring[0][0] - b.lat) < Math.abs(ring[0][0] - b.lon) && Math.abs(ring[0][1] - b.lon) < Math.abs(ring[0][1] - b.lat); out.push({ hole: k > 0, pts: ring.slice(0, -1).map(c => swap ? [c[1], c[0]] : [c[0], c[1]]) }); })); return out; }
        async function cadFetch(b, want) { want = want || { parc: true, bati: true };
            if (cadBusy) { updateCommandMessageText('CADASTRE : un téléchargement est déjà en cours.'); return; } if (isOffline()) { netWarn('Le cadastre vectorisé'); return; }
            const R = worldToMm(b.r) / 1000, dLat = R / 111320 * 1.05, dLon = R / (111320 * Math.cos(b.lat * Math.PI / 180)) * 1.05, E = { s: b.lat - dLat, n: b.lat + dLat, w: b.lon - dLon, e: b.lon + dLon };
            const W = bmWorldOfLL(b), inC = (q) => (q.x - b.x) ** 2 + (q.y - b.y) ** 2 <= b.r * b.r * 1.0001, tag = b.mapId || 'bm';
            cadBusy = true; updateCommandMessageText('CADASTRE : téléchargement des parcelles (IGN / DGFiP)…');
            try {
                const F = want.parc ? await cadParcels(E) : [];
                let bat = []; if (want.bati) try { updateCommandMessageText('CADASTRE : téléchargement du bâti…'); const jb = await cadWfs('BDTOPO_V3:batiment', E); bat = (jb && jb.features) || []; } catch (e) {}
                if (want.bati && !bat.length) { try { bat = await cadEtalab(E, 'batiments'); } catch (e) {} }   // bâti du cadastre Etalab si la BD TOPO ne répond pas
                // les objets cadastre de ce fond sont remplacés
                shapes = shapes.filter(x => x.cadOf !== tag || (x.cadBati ? !want.bati : !want.parc));   // seule la partie demandée (cadastre, bâti) est remplacée
                const lP = cartoGroup(ensureLayer('Cadastre — parcelles', '#f472b6')), lN = cartoGroup(ensureLayer('Cadastre — numéros', '#f9a8d4')), lB = cartoGroup(ensureLayer('Cadastre — bâti', '#fb923c')); updateLayerUI();
                const mk = (o) => Object.assign(o, { cadOf: tag, zk: 1, lvs: 1 }); let nP = 0, nB = 0;
                F.forEach(f => { const pr = f.properties || {}; cadRings(f.geometry, b).forEach(r => { const pts = r.pts.map(c => W(c[1], c[0])); if (pts.length < 3 || !pts.some(inC)) return;
                    shapes.push(mk({ type: 'poly', layerId: lP, points: pts.map(q => ({ x: q.x, y: q.y })), hatch: false, name: 'Parcelle ' + [pr.section, pr.numero].filter(Boolean).join(' '), cad: { idu: pr.idu, section: pr.section, numero: pr.numero, insee: pr.code_insee || ((pr.code_dep || '') + (pr.code_com || '')), m2: pr.contenance } }));
                    if (!r.hole) { nP++; const c = polyCentroid(pts); if (pr.numero && inC(c)) shapes.push(mk({ type: 'text', layerId: lN, x: c.x, y: c.y, content: (pr.section ? pr.section + ' ' : '') + String(pr.numero).replace(/^0+/, ''), size: TEXT_WORLD_SIZE * 0.8, align: 'center' })); } }); });
                bat.forEach(f => cadRings(f.geometry, b).forEach(r => { const pts = r.pts.map(c => W(c[1], c[0])); if (pts.length < 3 || !pts.some(inC)) return; nB++; shapes.push(mk({ type: 'poly', layerId: lB, points: pts.map(q => ({ x: q.x, y: q.y })), hatch: false, name: 'Bâti (BD TOPO)', cadBati: 1 })); }));
                b.cadVec = { n: nP, b: nB }; if (nP && b.ovl && b.ovl.cad) { b.ovl.cad = false; b.cadastre = false; }   // les traits remplacent le cadastre imprimé sur le fond (rallumable dans ses calques)
                invalidateCache(); saveState(); updateLayerUI(); draw(); updatePropertiesPopup();
                updateCommandMessageText(nP ? 'CADASTRE : ' + nP + ' parcelle(s) avec leurs numéros' + (nB ? ' et ' + nB + ' bâtiment(s), montés en volumes dans la vue 3D (TN + 6 m, toit automatique de la couleur vue sur le fond)' : '') + ' sur les calques « Cadastre — … », rangés dans le groupe « Données carto » (polylignes, accrochables). Source : Parcellaire Express IGN / DGFiP — document non opposable, à confirmer par un géomètre pour les limites.' : 'CADASTRE : aucune parcelle reçue ici (hors France ?).');
            } catch (e) { updateCommandMessageText('CADASTRE : rien reçu des services de l\'IGN (' + e.message + '). Vérifiez la connexion, puis réessayez : propriétés du fond › 🗺 Cadastre vectorisé.'); try { flashUntil = Date.now() + 10000; } catch (e2) {} }
            finally { cadBusy = false; }
        }
        // ---- DONNÉES CARTO À L'IMPORT D'UN FOND : terrain IGN, cadastre (et bâti 3D), zones boisées, routes « TN propre » — dans cet ordre, l'une après l'autre
        function bmImportSteps(b, ovl) { const D = bmSettings.data || {}, S = [];
            if (bmSettings.tn && bmSettings.tn.on) S.push(['Terrain IGN', () => tnFetch(b, bmSettings.tn.pas), 3]); { const pc = !!(ovl && ovl.cad), bt = !!D.bati; if (pc || bt) S.push([pc && bt ? 'Cadastre et bâti' : pc ? 'Cadastre' : 'Bâti', () => cadFetch(b, { parc: pc, bati: bt }), 1]); } if (D.bois) S.push(['Zones boisées', () => boisFetch(b), 1]);
            if (D.routes) S.push(['Routes', () => routesFetch(b), 2]); if (D.eau) S.push(['Hydrographie', () => hydroFetch(b), 2]); return S; }
        async function bmImportData(b, ovl) { const S = bmImportSteps(b, ovl); if (!S.length) { if (mcLoad.has('Fond de carte')) mcLoad.close(); return; }
            if (!mcLoad.has(S[0][0])) await mcLoad.open('Import du fond de carte', S.map(x => x[0])); const keep3D = is3DOpen() && typeof V3 !== 'undefined' && V3; if (keep3D) V3.holdBuild = true;   // la 3D ne se reconstruit qu'une fois, à la fin
            try { for (const [n, f] of S) { mcLoad.set(n, null, n + '…'); await mcBreath(); try { await f(); } catch (e) { console.error(e); } mcLoad.set(n, 1); }
                mcLoad.say('Terrain et dessin…'); await mcLoad.ready(); tinCache = null; invalidateCache(); draw(); }
            finally { if (keep3D) { V3.holdBuild = false; mcLoad.say('Vue 3D…'); await mcLoad.ready(); try { build3DScene(); render3D(); } catch (e) { console.error(e); } } mcLoad.close(); } }
        const bmEmprise = (b) => { const R = worldToMm(b.r) / 1000, dLat = R / 111320 * 1.05, dLon = R / (111320 * Math.cos(b.lat * Math.PI / 180)) * 1.05; return { s: b.lat - dLat, n: b.lat + dLat, w: b.lon - dLon, e: b.lon + dLon }; };
        // ZONES BOISÉES : bois, forêts, haies de la BD TOPO (IGN), découpés sur le cercle du fond, en polylignes « zone boisée » (calque « Zones boisées »)
        const BOIS_H = (nat) => /haie/i.test(nat) ? 4 : /verger/i.test(nat) ? 5 : /peupleraie/i.test(nat) ? 18 : /lande/i.test(nat) ? 0 : /vigne/i.test(nat) ? 0 : /for[eê]t|bois/i.test(nat) ? 14 : 10;
        async function boisFetch(b) { if (isOffline()) { netWarn('Les zones boisées'); return; } const E = bmEmprise(b), W = bmWorldOfLL(b), tag = (b.mapId || 'bm') + '-bois';
            updateCommandMessageText('ZONES BOISÉES : téléchargement des bois et haies (IGN)…'); let F = [];
            try { const js = await cadWfs('BDTOPO_V3:zone_de_vegetation', E, 2000); F = (js && js.features) || []; } catch (e) { updateCommandMessageText('ZONES BOISÉES : rien reçu de l\'IGN (' + e.message + ').'); return; }
            await loadPolyClip().catch(() => {}); const M = mmToWorld(1000), circ = []; for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2; circ.push([b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r]); } circ.push(circ[0]);
            shapes = shapes.filter(x => x.boisOf !== tag); const lay = cartoGroup(ensureLayer('Zones boisées', '#4ade80')); let n = 0;
            F.forEach(f => { const pr = f.properties || {}, lande = /lande|broussaill|fourr/i.test(pr.nature || ''), h = lande ? 0.9 : BOIS_H(pr.nature || ''); if (!h) return;
                cadRings(f.geometry, b).filter(r => !r.hole).forEach(r => { let ring = r.pts.map(c => { const q = W(c[1], c[0]); return [q.x, q.y]; }); if (ring.length < 3) return; ring.push(ring[0]);
                    let parts = [[ring]]; if (window.polygonClipping) { try { parts = polygonClipping.intersection([ring], [circ]); } catch (e) { return; } } else if (!ring.some(([x, y]) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r)) return;
                    parts.forEach(poly => { const out = poly[0].slice(0, -1).map(([x, y]) => ({ x, y })), pts = rdpSimplify(out, 0.4 * M); if (pts.length < 3) return;
                        const A = Math.abs(pts.reduce((a, q, i) => { const r2 = pts[(i + 1) % pts.length]; return a + q.x * r2.y - r2.x * q.y; }, 0) / 2) / (M * M); if (A < 25) return;
                        n++; shapes.push({ type: 'poly', layerId: lay, points: pts, hatch: false, bois: lande ? { h, kind: 'brous' } : { h }, boisOf: tag, name: 'Zone boisée' + (pr.nature ? ' (' + pr.nature + ')' : ''), lvs: 1 }); }); }); });
            invalidateCache(); saveState(); updateLayerUI(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText(n ? 'ZONES BOISÉES : ' + n + ' zone(s) (bois, haies…) sur le calque « Zones boisées » : arbres en plan, canopée en 3D ; hauteur réglable dans Y, contour modifiable.' : 'ZONES BOISÉES : aucun bois ni haie connu de l\'IGN sur ce cercle.'); }
        // ROUTES « TN PROPRE » : axes de la BD TOPO ; profil en long lissé sur le terrain, chaussée plate ; ses deux bords deviennent des lignes de rupture
        // du terrain naturel (calque « Routes — bords (TN) ») et les points IGN tombés dans la chaussée sont retirés : le TN avant projet a des routes nettes.
        const ROUTE_W = (pr) => { const w = +pr.largeur_de_chaussee; if (w > 1.5 && w < 30) return w; const n = String(pr.nature || ''); return /rond-point/i.test(n) ? 7 : /2 chauss/i.test(n) ? 9 : /chemin|empierr/i.test(n) ? 3.5 : 5; };
        async function routesFetch(b) { if (isOffline()) { netWarn('Les routes'); return; } const tin0 = getTIN(); if (!tin0) { updateCommandMessageText('ROUTES : il faut d\'abord le terrain (Terrain IGN : points cotés) pour caler les routes.'); return; }
            const E = bmEmprise(b), W = bmWorldOfLL(b), tag = (b.mapId || 'bm') + '-rt', M = mmToWorld(1000), inC = (q) => (q.x - b.x) ** 2 + (q.y - b.y) ** 2 <= b.r * b.r;
            updateCommandMessageText('ROUTES : téléchargement des tronçons (IGN)…'); let F = [];
            try { const js = await cadWfs('BDTOPO_V3:troncon_de_route', E, 2000); F = (js && js.features) || []; } catch (e) { updateCommandMessageText('ROUTES : rien reçu de l\'IGN (' + e.message + ').'); return; }
            const lines = []; F.forEach(f => { const pr = f.properties || {}, nat = String(pr.nature || ''); if (/sentier|escalier|bac|piste cyclable/i.test(nat)) return; const g = f.geometry; if (!g) return;
                const L = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; const w = ROUTE_W(pr);
                L.forEach(cs => { const swap = cs.length && Math.abs(cs[0][0] - b.lat) < Math.abs(cs[0][0] - b.lon), Q = cs.map(c => swap ? W(c[0], c[1]) : W(c[1], c[0])), Dn = []; let cur = [];
                    for (let i = 0; i < Q.length; i++) { if (i) { const a2 = Q[i - 1], c2 = Q[i], m = Math.max(1, Math.ceil(Math.hypot(c2.x - a2.x, c2.y - a2.y) / (2 * M))); for (let k = 1; k < m; k++) Dn.push({ x: a2.x + (c2.x - a2.x) * k / m, y: a2.y + (c2.y - a2.y) * k / m }); } Dn.push(Q[i]); }   // densifié : coupé net sur le cercle
                    Dn.forEach(q => { if (inC(q)) cur.push(q); else { if (cur.length > 1) lines.push({ P: cur, w }); cur = []; } }); if (cur.length > 1) lines.push({ P: cur, w }); }); });
            // axe tous les 2 m, altitude du terrain lissée le long de l'axe (± 12 m), puis raccords aux carrefours (même altitude aux extrémités communes)
            const step = 2 * M; lines.forEach(L => { const D = []; for (let i = 0; i + 1 < L.P.length; i++) { const a = L.P[i], c = L.P[i + 1], l = Math.hypot(c.x - a.x, c.y - a.y), m = Math.max(1, Math.ceil(l / step)); for (let k = 0; k < m; k++) D.push({ x: a.x + (c.x - a.x) * k / m, y: a.y + (c.y - a.y) * k / m }); } D.push(L.P[L.P.length - 1]);
                let s = 0; D.forEach((q, i) => { if (i) s += Math.hypot(q.x - D[i - 1].x, q.y - D[i - 1].y) / M; q.s = s; q.z0 = tinZ(q.x, q.y, tin0); });
                smooth6(D, 'z');
                L.D = D; });
            const key = (q) => Math.round(q.x / M) + ',' + Math.round(q.y / M), nodes = new Map(); lines.forEach(L => { if (!L.D) return; [L.D[0], L.D[L.D.length - 1]].forEach(q => { if (!hasZ(q.z)) return; const k = key(q); const n = nodes.get(k) || { s: 0, c: 0 }; n.s += q.z; n.c++; nodes.set(k, n); }); });
            lines.forEach(L => { const D = L.D; if (!D || D.length < 2) return; const n0 = nodes.get(key(D[0])), n1 = nodes.get(key(D[D.length - 1])), d0 = n0 && hasZ(D[0].z) ? n0.s / n0.c - D[0].z : 0, d1 = n1 && hasZ(D[D.length - 1].z) ? n1.s / n1.c - D[D.length - 1].z : 0, S = D[D.length - 1].s || 1;
                D.forEach(q => { if (hasZ(q.z)) q.z += d0 * (1 - q.s / S) + d1 * (q.s / S); }); });
            // bords de chaussée (tous les ~3 m) à l'altitude de l'axe : chaussée plate en travers
            shapes = shapes.filter(x => x.rtOf !== tag); const lay = cartoGroup(ensureLayer('Routes — bords (TN)', '#a8a29e')); let nR = 0, lenT = 0; const bands = [];
            lines.forEach(L => { const D = (L.D || []).filter(q => hasZ(q.z)); if (D.length < 2) return; const h = L.w / 2 * M, edge = (sg) => { const out = []; D.forEach((q, i) => { const a = D[Math.max(0, i - 1)], c = D[Math.min(D.length - 1, i + 1)], l = Math.hypot(c.x - a.x, c.y - a.y) || 1; out.push({ x: q.x - (c.y - a.y) / l * h * sg, y: q.y + (c.x - a.x) / l * h * sg, z: Math.round(q.z) }); });
                    return out.filter((q, i) => i === 0 || i === out.length - 1 || i % 2 === 0).filter(inC); };
                const rid = tag + '-' + nR; [1, -1].forEach(sg => { const P = edge(sg); if (P.length > 1) shapes.push({ type: 'poly', open: true, layerId: lay, points: P, hatch: false, rtOf: tag, road: { w: L.w, rid }, name: 'Bord de chaussée' }); });
                nR++; lenT += D[D.length - 1].s; bands.push({ D, h: h + 0.8 * M }); });
            // points IGN dans la chaussée : retirés (ils feraient des bosses sur la route)
            const before = shapes.length, inB = bandTest(bands); shapes = shapes.filter(x => !(x.type === 'point' && x.code === 'TN_IGN' && inB(x.x, x.y))); const rm = before - shapes.length;
            tinCache = null; invalidateCache(); saveState(); updateLayerUI(); draw(); if (is3DOpen()) { build3DScene(); render3D(); }
            updateCommandMessageText(nR ? 'ROUTES : ' + nR + ' tronçon(s), ' + nfr(lenT, 0) + ' m : chaussées plates au profil lissé, leurs bords en lignes de rupture du terrain (calque « Routes — bords (TN) », groupe « Données carto ») ; ' + rm + ' point(s) IGN de chaussée retiré(s).' : 'ROUTES : aucune route connue de l\'IGN sur ce cercle.'); }
        // COURS D'EAU : tronçons et surfaces hydrographiques de la BD TOPO (IGN). Chaque cours d'eau taille son lit dans le terrain naturel avec des
        //      lignes de rupture (haut de berge au terrain, bord de l'eau, fond du lit), le niveau de l'eau ne remonte jamais vers l'aval ; l'eau y est posée
        //      (plan d'eau qui suit la pente, calque « Cours d'eau — eau »). Étangs et larges rivières (surfaces) : bord de l'eau en ligne de rupture, fond 1 m plus bas,
        //      plan d'eau au niveau. Les points IGN tombés dans le lit sont retirés.
        // points tombés dans une bande (axe + demi-largeur) : grille de cases, pour des milliers de points et des kilomètres de bandes sans figer
        function bandTest(bands) { const C = mmToWorld(10000), G = new Map(), key = (i, j) => i * 1000003 + j;
            bands.forEach(B => { if (B.poly) { const xs = B.poly.map(q => q.x), ys = B.poly.map(q => q.y); for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) { const k = key(i, j); let c = G.get(k); if (!c) G.set(k, c = []); c.push({ poly: B.poly }); } return; }
                for (let n = 0; n + 1 < B.D.length; n++) { const a = B.D[n], b = B.D[n + 1]; for (let i = Math.floor((Math.min(a.x, b.x) - B.h) / C); i <= Math.floor((Math.max(a.x, b.x) + B.h) / C); i++) for (let j = Math.floor((Math.min(a.y, b.y) - B.h) / C); j <= Math.floor((Math.max(a.y, b.y) + B.h) / C); j++) { const k = key(i, j); let c = G.get(k); if (!c) G.set(k, c = []); c.push({ a, b, h: B.h }); } } });
            return (x, y) => (G.get(key(Math.floor(x / C), Math.floor(y / C))) || []).some(e => e.poly ? pointInPolygon(x, y, e.poly) : t2SegDist({ x, y }, e.a, e.b) < e.h); }
        // barre de progression des imports (fond de carte et ses données) : étape, avancement ; l'appli respire entre deux étapes
