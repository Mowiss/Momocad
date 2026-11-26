        // =====================================================================
        // 3D TOPO : chaque point peut porter une altitude Z (en mm dans le modèle, affichée en m NGF).
        //  - line : z1, z2 ; poly : points[i].z ; circle / arc : z ; point topo : { type:'point', x, y, z, mat, code }
        //  - geoOrigin : coordonnées réelles (Lambert…) = coordonnées locales + geoOrigin (mm, Y vers le haut),
        //    pour garder une bonne précision d'affichage avec des coordonnées de plusieurs millions de mètres.
        // =====================================================================
        let geoOrigin = { x: 0, y: 0 };
        let zCourant = null;            // altitude (mm) donnée aux nouveaux points sans Z, ou null
        let lastTopo = null;            // dernier point topo posé (pour corriger son Z au clavier)
        // formats de nombres français réutilisés (créer un format à chaque nombre coûtait cher : des milliers de cotes par image)
        const NF_CACHE = new Map(), nfFmt = (d, g) => { const k = d * 2 + (g ? 1 : 0); let f = NF_CACHE.get(k); if (!f) { f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: g }); NF_CACHE.set(k, f); } return f; };
        const fmtZ = (zmm) => nfFmt(2, false).format(zmm / 1000);   // altitudes sans séparateur de milliers (1136,50) : relues telles quelles dans les champs
        const hasZ = (v) => typeof v === 'number' && isFinite(v);
        const realX = (wx) => worldToMm(wx) + geoOrigin.x, realY = (wy) => -worldToMm(wy) + geoOrigin.y;
        // Altitudes connues au point (x, y) : sommets, points topo, et Z interpolé le long des traits 3D
        function zAt(x, y, tol, exclude) {
            const out = [];
            const add = (z) => { if (hasZ(z) && !out.some(q => Math.abs(q - z) < 0.5)) out.push(z); };
            const onSeg = (ax, ay, az, bx, by, bz) => {
                const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
                if (l2 === 0) { if (Math.hypot(x - ax, y - ay) <= tol) add(hasZ(az) ? az : bz); return; }
                const t = ((x - ax) * dx + (y - ay) * dy) / l2; if (t < -1e-9 || t > 1 + 1e-9) return;
                if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) > tol) return;
                if (hasZ(az) && hasZ(bz)) add(az + (bz - az) * Math.max(0, Math.min(1, t)));
                else if (hasZ(az) && t < 1e-6) add(az); else if (hasZ(bz) && t > 1 - 1e-6) add(bz);
                else if (hasZ(az) && Math.hypot(x - ax, y - ay) <= tol) add(az); else if (hasZ(bz) && Math.hypot(x - bx, y - by) <= tol) add(bz);
            };
            for (const s of shapes) {
                if (s === exclude) continue;
                const layer = layers.find(l => l.id === (s.layerId || 'layer-0')); if (layer && !layer.visible) continue;
                if (s.type === 'point') { if (Math.hypot(x - s.x, y - s.y) <= tol) add(s.z); }
                else if (s.type === 'line') onSeg(s.x1, s.y1, s.z1, s.x2, s.y2, s.z2);
                else if (s.type === 'poly') for (let i = 0; i < polyEdges(s); i++) { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; onSeg(a.x, a.y, a.z, b.x, b.y, b.z); }
                else if ((s.type === 'circle' || s.type === 'arc') && hasZ(s.z)) { const d = Math.hypot(x - s.x, y - s.y); if (d <= tol || Math.abs(d - s.r) <= tol) add(s.z); }
            }
            return out;
        }
        // Nouveaux objets : chaque sommet sans Z reprend l'altitude du point sur lequel il s'accroche, sinon le « Z courant »
        function shapeVertices(s) {
            if (s.type === 'line') return [{ get: () => s.z1, set: (z) => s.z1 = z, x: s.x1, y: s.y1 }, { get: () => s.z2, set: (z) => s.z2 = z, x: s.x2, y: s.y2 }];
            if (s.type === 'poly') return (Array.isArray(s.points) ? s.points : []).map(p => ({ get: () => p.z, set: (z) => p.z = z, x: p.x, y: p.y }));
            if (s.type === 'circle' || s.type === 'arc' || s.type === 'point') return [{ get: () => s.z, set: (z) => s.z = z, x: s.x, y: s.y }];
            return [];
        }
        function fillNewZ() {
            const tol = 0.5;
            for (const s of shapes) {
                if (s.zk) continue; s.zk = 1;
                /* dessiné dans un contour de bâtiment (cloison, trait de repère…) : c'est du bâtiment, pas du terrain ; il ne reçoit pas d'altitude au passage */
                if (s.type !== 'point' && !s.bld && (s.bid || s.lvl || ((lvlOn || bldZones().length) && (() => { const p = bldRep(s); return p && bldZoneAt(p.x, p.y); })()))) continue;
                shapeVertices(s).forEach(v => {
                    if (hasZ(v.get())) return;
                    const zs = zAt(v.x, v.y, tol, s);
                    if (zs.length) { v.set(zs[0]); if (s.type === 'circle') s.elev = true; }   // cercle calé sur un point coté : pas une plateforme
                    else if (hasZ(zCourant)) v.set(zCourant);
                });
            }
        }
        function markZKnown(list) { (list || shapes).forEach(s => { s.zk = 1; }); }
        function setZCourant(v) {
            const t = String(v).trim().replace(',', '.');
            zCourant = t === '' || isNaN(parseFloat(t)) ? null : parseFloat(t) * 1000;
            const inp = document.getElementById('z-courant'); if (inp) inp.value = hasZ(zCourant) ? fmtZ(zCourant) : '';
        }
        // Modification d'un Z depuis les propriétés (valeur en m, vide = pas d'altitude)
        function editZ(what, value) {
            const s = selectedShapes[0]; if (!s) return;
            const t = String(value).trim().replace(',', '.'), z = t === '' || isNaN(parseFloat(t)) ? undefined : parseFloat(t) * 1000;
            const set = (o, k) => { if (z === undefined) delete o[k]; else o[k] = z; };
            if (what === 'z1' || what === 'z2' || what === 'z') set(s, what);
            else if (what === 'all' && s.type === 'poly') s.points.forEach(p => set(p, 'z'));
            else if (what === 'mat') { s.mat = String(value).trim(); }
            saveState(); draw();
        }
        // =====================================================================
        // VUE 3D (three.js, chargé à la demande) : orbite autour du plan, boussole façon AutoCAD avec vues animées
        // Repère 3D en mètres : x = Est, y = Nord, z = altitude (exagérée), origine au centre du dessin.
        // =====================================================================
        const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js';
        /* moteur 3D r159 réglé comme avant (r128) : pas de gestion des couleurs, sortie linéaire, lumières à l'ancienne intensité ; même rendu, moteur à jour */
        function threeCompat(T) { if (!T || T.__mc) return T; T.__mc = true; if (T.ColorManagement) T.ColorManagement.enabled = false;
            const RW = T.WebGLRenderer; if ('outputColorSpace' in RW.prototype || +T.REVISION >= 152) { const W = function (o) { const r = new RW(o); if ('outputColorSpace' in r) r.outputColorSpace = T.LinearSRGBColorSpace; if ('useLegacyLights' in r) { const w0 = console.warn; console.warn = () => {}; try { r.useLegacyLights = true; } finally { console.warn = w0; } } return r; }; W.prototype = RW.prototype; T.WebGLRenderer = W; }
            return T; }
        let threePromise = null, V3 = null;
        function loadThree() {
            if (window.THREE) return Promise.resolve(threeCompat(window.THREE));
            if (!threePromise) threePromise = new Promise((res, rej) => {
                loadJSFirst([MC_LIB + 'three.min.js?r159', THREE_URL, 'https://unpkg.com/three@0.159.0/build/three.min.js']).then(() => res(threeCompat(window.THREE)), () => { threePromise = null; rej(new Error('moteur 3D indisponible (connexion ?)')); });
            });
            return threePromise;
        }
        function place3D() {
            const el = document.getElementById('view3d'), r = canvas.getBoundingClientRect(), cb = document.getElementById('command-bar');
            const h = Math.max(50, (cb ? cb.getBoundingClientRect().top : r.bottom) - r.top);   // la bande de commande (coordonnées, œil 3D) reste visible
            Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: h + 'px' });
            // la rosace 3D se pose exactement à la place de la rosace du plan : rien ne saute à l'ouverture / fermeture
            const r2 = document.getElementById('rose-svg').getBoundingClientRect(), v3r = document.getElementById('v3-rose');
            if (v3r && r2.width) Object.assign(v3r.style, { right: 'auto', left: (r2.left - r.left) + 'px', top: (r2.top - r.top) + 'px' });
            if (V3) { V3.renderer.setSize(r.width, h); V3.camera.aspect = r.width / Math.max(1, h); V3.camera.updateProjectionMatrix(); render3D(); }
        }
        var v3Flat = false;   // construction pour les vues de façade du plan : couleurs unies, aucune texture (les textures sont réservées au rendu)
        const v3Nat = () => { if (v3Flat) return false; const e = document.getElementById('v3-nat'); return !!(e && e.checked); };
        // ciel : voûte dessinée par la carte graphique (dégradé selon l'heure, soleil, nuages) ; le soleil de la scène suit l'heure choisie
        let v3Hour = 15; try { const h = parseFloat(localStorage.getItem('momocad-v3h')); if (h >= 0 && h <= 24) v3Hour = h; } catch (e) {}
        let v3HzSeed = 1; try { v3HzSeed = +localStorage.getItem('momocad-v3hz') || 1; } catch (e) {}
        // position du soleil à Gap (44,56° N) pour la date du jour, heure solaire : direction x est, y nord, z haut
        function v3SunDir(hour) {
            const r = Math.PI / 180, lat = 44.56 * r, d = new Date(), N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
            // heure de la montre → heure solaire : fuseau, longitude (6,08° E) et équation du temps
            const B = 2 * Math.PI * (N - 81) / 364, eot = (9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)) / 60, tz = -d.getTimezoneOffset() / 60;
            const sol = hour - tz + 6.08 / 15 + eot;
            const dec = 23.44 * r * Math.sin(2 * Math.PI * (284 + N) / 365), H = (sol - 12) * 15 * r;
            const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
            const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) + Math.PI;   // depuis le nord, sens horaire
            return { el, x: Math.cos(el) * Math.sin(az), y: Math.cos(el) * Math.cos(az), z: Math.sin(el) };
        }
        const V3_SKY_VS = 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
        const V3_SKY_FS = `varying vec3 vD; uniform vec3 sun; uniform float day; uniform float dusk; uniform float seed; uniform vec3 ptop; uniform vec3 pbot; uniform float pk;
            float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
            float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ v += a * nz(p); p *= 2.03; a *= 0.5; } return v; }
            void main(){ vec3 d = normalize(vD); float h = d.z;
                vec3 zen = mix(vec3(0.02, 0.03, 0.08), vec3(0.20, 0.45, 0.80), day), hor = mix(vec3(0.06, 0.08, 0.15), vec3(0.78, 0.87, 0.95), day);
                hor = mix(hor, vec3(0.98, 0.62, 0.36), dusk * 0.85); zen = mix(zen, vec3(0.18, 0.22, 0.45), dusk * 0.5);
                vec3 c = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.45));
                if (h < 0.0) c = mix(hor * 0.85, vec3(0.30, 0.32, 0.30) * (0.25 + 0.75 * day), clamp(-h * 4.0, 0.0, 1.0));
                float s = max(dot(d, normalize(sun)), 0.0); vec3 sc = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.97, 0.88), day);
                c += sc * (pow(s, 900.0) * 4.0 + pow(s, 12.0) * (0.18 + dusk * 0.5)) * step(-0.05, sun.z);
                if (h > 0.0) { vec2 q = d.xy / (h + 0.12) * 1.4 + vec2(seed * 7.0, seed * 3.0); float n = fbm(q) * 0.75 + fbm(q * 3.1) * 0.25;
                    float cl = smoothstep(0.44, 0.74, n) * smoothstep(0.0, 0.12, h);
                    vec3 cc = mix(vec3(0.42, 0.45, 0.52), vec3(1.0), 0.35 + 0.65 * smoothstep(0.4, 0.9, n)) * (0.15 + 0.85 * day) + sc * dusk * 0.35 * (1.0 - n);
                    c = mix(c, cc, cl * 0.9 * (1.0 - pk * 0.7)); }
                if (pk > 0.5) { vec3 ct = mix(ptop, ptop * vec3(0.78, 0.87, 1.05), smoothstep(0.3, 0.95, h)); if (h < 0.0) ct = pbot; c = mix(c, ct, 0.88); }
                gl_FragColor = vec4(c, 1.0); }`;
        // horizon HD : quatre paysages tirés au hasard (montagne, ville, plaine, village), dessinés tout autour (bord gauche raccordé au bord droit)
        // renvoie l'image du paysage et, pour la nuit, celle des fenêtres éclairées
        const V3_HZ_KINDS = { montagne: { n: 'Montagne', ang: 12 }, ville: { n: 'Ville', ang: 5 }, plaine: { n: 'Plaine', ang: 3.6 }, village: { n: 'Village', ang: 4.5 } };
        let v3HzKind = 'montagne'; try { const k = localStorage.getItem('momocad-v3hzk'); if (V3_HZ_KINDS[k] || k === 'img') v3HzKind = k; } catch (e) {}
        // photo panoramique 360° (image équirectangulaire 2:1) : remplace ciel et horizon ; gardée dans ce navigateur
        let v3PanoTex = null, v3PanoLoading = false;
