        // ---- STUDIO PHOTO : cadrer une photo de la maquette (format, focale, vues enregistrées), la photo 360° et ses réglages, puis le RENDU :
        //      scène affinée (terrain lissé et plus fin, arbres détaillés, herbe en 3D aux couleurs de la photo du fond), ombres portées douces
        //      et lumière du ciel, calculées passe après passe (chaque passe décale un peu la caméra, le soleil et le ciel ; la moyenne lisse tout).
        const ST_FMT = { '16:9': [16, 9], '3:2': [3, 2], '4:3': [4, 3], 'A3': [1.4142, 1], '1:1': [1, 1] };
        const ST_RES = { hd: [1280, 'HD'], fhd: [1920, 'Full HD'], k2: [2560, '2K'], k4: [3840, '4K'] };
        const RD_Q = {
            rapide: { n: 'Rapide', d: 'aperçu', spp: 6, sh: 2048, soft: 0.004, sky: 0, grass: 0, tree: 1, terr: 1 },
            standard: { n: 'Standard', d: 'ombres douces', spp: 24, sh: 4096, soft: 0.008, sky: 0, grass: 150000, tree: 2, terr: 1.5 },
            haute: { n: 'Haute', d: '+ lumière du ciel', spp: 96, sh: 4096, soft: 0.01, sky: 1, grass: 350000, tree: 2, terr: 2 },
            ultra: { n: 'Ultra', d: 'très long', spp: 256, sh: 8192, soft: 0.01, sky: 1, grass: 800000, tree: 3, terr: 2.5 },
            extreme: { n: 'Extrême', d: 'des heures', spp: 1024, sh: 8192, soft: 0.01, sky: 1, grass: 1400000, tree: 3, terr: 3 } };
        // matières en relief : herbe (hauteur, densité) et terre (granulométrie, densité)
        const ST_GRAN = { sable: ['Sable', 0.002, 0.008], grav: ['Graviers', 0.008, 0.035], caill: ['Cailloux', 0.03, 0.09], blocs: ['Blocs', 0.1, 0.35] };
        const ST_DENS = { faible: ['Clair', 0.5], normale: ['Normal', 1], dense: ['Dense', 1.8] };
        /* profondeur de champ : ouverture discrète (quelques cm) ; le point visé reste net, le lointain et le tout-près s'adoucissent sans dédoubler l'image */
        function dofAperture(dF, f) { return Math.min(0.12, Math.max(0.005, dF * 0.0035 * 35 / Math.max(18, f || 35))); }
        function studioNew() { return { fmt: '16:9', f: 35, res: 'fhd', q: 'standard', sh: true, grass: true, tree: true, fin: true, thirds: true, views: [], grassH: 12, grassN: 250, earth: true, granS: 38, earthP: 50, earthCol: null, riv: true, wave: true, realHD: true, bed: true, dof: false, haze: false }; }
        let studio = studioNew();
        let stPano = { on: false, h: 1.6, d: 400, rot: 0 }; try { Object.assign(stPano, JSON.parse(localStorage.getItem('momocad-stpano') || '{}')); } catch (e) {} stPano.on = false;   /* la photo d'horizon se règle dans Décor */
        function stPanoSave() { try { localStorage.setItem('momocad-stpano', JSON.stringify(stPano)); } catch (e) {} }
        const stOn = () => { const p = document.getElementById('t2-panel'); return !!(p && p.style.display !== 'none' && p.dataset.kind === 'studio' && is3DOpen()); };
        // cadre de la photo dans la vue 3D (px, repère de la vue) : la plus grande zone au format choisi, à gauche du volet
        function stFrame() { const v = document.getElementById('view3d'), r = v.getBoundingClientRect(), p = document.getElementById('t2-panel'), pr = p && p.style.display !== 'none' ? p.getBoundingClientRect() : null;
            const [aw, ah] = ST_FMT[studio.fmt] || ST_FMT['16:9'], pl = pr ? window.innerWidth - p.offsetWidth : Infinity, right = pl > r.left + 240 ? Math.min(r.right, pl) : r.right, x0 = 20, y0 = 60, x1 = right - r.left - 20, y1 = r.height - 40;
            const W = Math.max(40, x1 - x0), H = Math.max(40, y1 - y0), k = Math.min(W / aw, H / ah), w = aw * k, h = ah * k;
            return { x: x0 + (W - w) / 2, y: y0 + (H - h) / 2, w, h, cw: Math.max(1, r.width), ch: Math.max(1, r.height), asp: aw / ah }; }
        // focale (équivalent 24×36, mesurée sur la largeur) → angle vertical de la photo
        const stVFov = (f, asp) => 2 * Math.atan(Math.tan(Math.atan(18 / f)) / asp);
        // la caméra de la vue : même angle que la photo dans le cadre, centre de la perspective au centre du cadre
        function stCamApply(cam) { const on = stOn(); if (!on) { if (cam.view && cam.view.enabled) cam.clearViewOffset(); if (cam.fov !== 45) cam.fov = 45; stFrameShow(null); return; }
            const F = stFrame(), vf = stVFov(studio.f, F.asp), vc = 2 * Math.atan(Math.tan(vf / 2) * F.ch / F.h), dx = F.x + F.w / 2 - F.cw / 2, dy = F.y + F.h / 2 - F.ch / 2;
            cam.fov = vc * 180 / Math.PI; cam.aspect = F.cw / F.ch; cam.setViewOffset(F.cw, F.ch, -dx, -dy, F.cw, F.ch); stFrameShow(F); }
        function stFrameShow(F) { let el = document.getElementById('v3-frame'); if (!F) { if (el) el.style.display = 'none'; return; }
            if (!el) { el = document.createElement('div'); el.id = 'v3-frame'; document.getElementById('view3d').appendChild(el); }
            const [w, h] = stResWH(); Object.assign(el.style, { display: 'block', left: F.x + 'px', top: F.y + 'px', width: F.w + 'px', height: F.h + 'px' }); el.classList.toggle('st-thirds', !!studio.thirds);
            el.dataset.l = studio.fmt + ' · ' + studio.f + ' mm · ' + w + ' × ' + h + ' px'; }
        function stResWH() { const [aw, ah] = ST_FMT[studio.fmt] || ST_FMT['16:9'], W = (ST_RES[studio.res] || ST_RES.fhd)[0]; return [W, Math.round(W * ah / aw)]; }
        // vues enregistrées : en coordonnées réelles (m, altitudes vraies), elles survivent aux changements du dessin
        function stViewNow() { const c = V3.center || { x: 0, y: 0 }, ex = V3.exag || 1, z0 = V3.zmin || 0; let T, az = V3.az, el = V3.el, dist = V3.dist;
            if (V3.fps) { const F = V3.fps, cp = Math.cos(F.pitch), d = 12; T = new THREE.Vector3(F.pos.x + Math.sin(F.yaw) * cp * d, F.pos.y + Math.cos(F.yaw) * cp * d, F.pos.z + Math.sin(F.pitch) * d); az = F.yaw + Math.PI; el = -F.pitch; dist = d; }
            else T = V3.target;
            return { x: T.x + c.x, y: T.y + c.y, z: T.z / ex + z0, az, el, dist, f: studio.f, fmt: studio.fmt, hour: v3Hour }; }
        function stViewGo(i) { const v = studio.views[i]; if (!v || !V3) return; if (V3.fps) fpsStop(); const c = V3.center || { x: 0, y: 0 };
            V3.target.set(v.x - c.x, v.y - c.y, (v.z - (V3.zmin || 0)) * (V3.exag || 1)); V3.az = v.az; V3.el = v.el; V3.dist = v.dist; V3.anim = null;
            if (v.f) studio.f = v.f; if (v.fmt) studio.fmt = v.fmt; if (isFinite(v.hour) && v.hour !== v3Hour) v3SetHour(v.hour); studioPanel(); render3D(); }
        function stViewAdd() { const n = studio.views.length + 1; studio.views.push(Object.assign({ n: 'Vue ' + n }, stViewNow())); saveState(); studioPanel(); updateCommandMessageText('STUDIO PHOTO : vue enregistrée (« Vue ' + n + ' »).'); }
        function stViewDel(i) { studio.views.splice(i, 1); saveState(); studioPanel(); }
        function stViewName(i, v) { if (studio.views[i]) { studio.views[i].n = String(v).trim() || studio.views[i].n; saveState(); } }
        function stSet(k, v) { studio[k] = v; studioPanel(); render3D(); }
        function stOrbit(k, v) { if (!V3) return; v = +v; if (V3.fps) fpsStop(); if (k === 'az') V3.az = v * Math.PI / 180; else if (k === 'el') V3.el = v * Math.PI / 180; else if (k === 'dist') V3.dist = Math.max(V3.R * 0.01, Math.pow(10, v)); V3.anim = null; render3D();
            const o = document.getElementById('st-' + k + '-v'); if (o) o.textContent = k === 'dist' ? nfr(V3.dist, V3.dist < 10 ? 1 : 0) + ' m' : Math.round(v) + '°'; }
        function stPanoSet(k, v) { stPano[k] = k === 'on' ? !!v : +v; stPanoSave(); if (k === 'on' && stPano.on && !v3PanoTex) { v3Sky(); } v3Sky(); render3D();
            const o = document.getElementById('st-p' + k + '-v'); if (o) o.textContent = k === 'h' ? nfr(+v, 1) + ' m' : k === 'd' ? nfr(+v, 0) + ' m' : Math.round(+v) + '°'; if (k === 'on') studioPanel(); }
        async function studioOpen() { if (!is3DOpen()) await open3D(); if (!V3) return; if (brushTool) brushStop(true); setMode('select-box'); v3Tab = 'studio'; studioPanel(); v3Sky(); render3D(); fpsStudioHold(); }
        /* studio photo ouvert pendant la balade : la vue se fige, le pointeur est rendu, plus de voile ni de bulles devant le volet ; clic droit = reprendre la balade */
        function fpsStudioHold() { const F = V3 && V3.fps; if (!F) return; F.paused = true; F.keys = {}; F.locked = false; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
            const b = document.getElementById('fps-bub'); if (b) b.remove(); updateCommandMessageText('VUE MOMO figée pour le studio photo : règle la photo dans le volet ; clic droit dans la vue pour reprendre la balade.'); }
        function studioClose() { v3PanelClose(); }
        function studioPanel() { if (!V3) return; v3Tab = 'studio'; const az = ((V3.az * 180 / Math.PI) % 360 + 360) % 360, el = V3.el * 180 / Math.PI, Q = RD_Q[studio.q] || RD_Q.standard, [w, h] = stResWH();
            const sl = (id, min, max, step, val, js, txt) => `<div class="st-sl"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="${js}"><b id="${id}-v">${txt}</b></div>`;
            const ck = (k, l, t) => `<label class="st-ck" title="${t || ''}"><input type="checkbox" class="bm-switch" ${studio[k] ? 'checked' : ''} onchange="studio['${k}']=this.checked;studioPanel();render3D()"> ${l}</label>`;
            const vl = studio.views.map((v, i) => `<div class="st-view"><button type="button" class="st-go" onclick="stViewGo(${i})" title="Revenir à cette vue">▶</button><input class="mf-in" value="${mailEsc(v.n)}" onchange="stViewName(${i}, this.value)"><span>${v.f || 35} mm · ${v.fmt || '16:9'}</span><button type="button" class="vx" onclick="stViewDel(${i})" title="Supprimer cette vue">×</button></div>`).join('');
            const pano = stPano.on ? `<div class="st-row"><span>Photo</span><button type="button" class="vbtn" onclick="v3PanoPick()">${v3PanoTex ? 'Changer…' : 'Choisir…'}</button></div>`
                + `<div class="st-row"><span>Hauteur</span>${sl('st-ph', -20, 200, 0.5, stPano.h, "stPanoSet('h', this.value)", nfr(stPano.h, 1) + ' m')}</div>`
                + `<div class="st-row"><span>Distance</span>${sl('st-pd', 20, 3000, 10, stPano.d, "stPanoSet('d', this.value)", nfr(stPano.d, 0) + ' m')}</div>`
                + `<div class="st-row"><span>Orientation</span>${sl('st-prot', 0, 359, 1, stPano.rot, "stPanoSet('rot', this.value)", Math.round(stPano.rot) + '°')}</div>` : '';
            /* sections rétractables (état gardé), choix en mosaïque d'aperçus à cocher, réglages en réglettes */
            const sec = (k, t, body) => `<details class="st-sec" data-k="${k}"${stSecOpen(k) ? ' open' : ''} ontoggle="stSecSave(this)"><summary><h4>${t}</h4></summary>${body}</details>`;
            const tile = (k, l, on, js) => `<button type="button" class="st-tile${on ? ' on' : ''}" onclick="${js}" title="${l}"><img src="${stThumb(k)}" alt=""><span>${l}</span></button>`;
            const tg = (k, l) => tile(k, l, studio[k], `studio['${k}']=!studio['${k}'];studioPanel();render3D()`);
            const live = (k, l) => `<button type="button" class="st-tile st-wide${studio[k] ? ' on' : ''}" onclick="studio['${k}']=!studio['${k}'];studioPanel();render3D()" title="${l}"><canvas id="st-pv-${k}" width="720" height="190"></canvas><span>${l}</span></button>`;   // aperçu en direct, sur toute la largeur
            const pc = (id, val, js, txt) => sl(id, 0, 100, 1, val, js, txt);
            const EC = [[null, 'Naturelle'], ['#6b4f3a', 'Brune'], ['#8a6a45', 'Ocre'], ['#7d7468', 'Grise'], ['#8e4a32', 'Rouge'], ['#3e3328', 'Humus']];
            const html = sec('cad', 'Cadrage', `<div class="st-lab">Format</div>${vSeg(Object.keys(ST_FMT).map(k => [k, k]), studio.fmt, "stSet('fmt', '$')")}
                <div class="st-lab">Focale</div>${vSeg([[18, '18 mm'], [24, '24 mm'], [35, '35 mm'], [50, '50 mm'], [85, '85 mm']], studio.f, "stSet('f', $)")}
                <div class="st-row"><span>Tourner</span>${sl('st-az', 0, 359, 1, az.toFixed(0), "stOrbit('az', this.value)", Math.round(az) + '°')}</div>
                <div class="st-row"><span>Plongée</span>${sl('st-el', -10, 89, 1, el.toFixed(0), "stOrbit('el', this.value)", Math.round(el) + '°')}</div>
                <div class="st-row"><span>Distance</span>${sl('st-dist', -0.5, Math.log10(Math.max(10, V3.R * 50)).toFixed(2), 0.01, Math.log10(Math.max(0.4, V3.dist)).toFixed(2), "stOrbit('dist', this.value)", nfr(V3.dist, V3.dist < 10 ? 1 : 0) + ' m')}</div>
                <div class="st-row"><span>Heure</span>${sl('st-hour', 0, 24, 0.25, v3Hour, 'v3SetHour(this.value);document.getElementById(\'st-hour-v\').textContent=stHourTxt(this.value)', stHourTxt(v3Hour))}</div>
                <div class="st-mos">${tg('thirds', 'Grille des tiers')}</div>`)
                + sec('vues', 'Vues enregistrées', `${vl || '<div class="mf-hint">Aucune vue : cadre la photo, puis enregistre-la.</div>'}<button type="button" class="vbtn" style="margin-top:6px" onclick="stViewAdd()">＋ Enregistrer cette vue</button>`)
                + sec('herbe', 'Herbe', `<div class="st-mos">${live('grass', 'Herbe en brins')}</div>${studio.grass ? `<div class="st-row"><span>Hauteur</span>${sl('st-gh', 3, 40, 1, studio.grassH, "studio.grassH=+this.value;document.getElementById('st-gh-v').textContent=this.value+' cm';stPreview('grass')", studio.grassH + ' cm')}</div>
                    <div class="st-row"><span>Densité</span>${pc('st-gn', stGrassP(), "stGrassSet(this.value);stPreview('grass')", stDensTxt(stGrassP()))}</div>` : ''}`)
                + sec('terre', 'Terre', `<div class="st-mos">${live('earth', 'Terre en grains')}</div>${studio.earth ? `<div class="st-row"><span>Grains</span>${pc('st-gr', studio.granS, "studio.granS=+this.value;document.getElementById('st-gr-v').textContent=stGranTxt(this.value);stPreview('earth')", stGranTxt(studio.granS))}</div>
                    <div class="st-row"><span>Densité</span>${pc('st-ed', studio.earthP, "studio.earthP=+this.value;document.getElementById('st-ed-v').textContent=stDensTxt(this.value);stPreview('earth')", stDensTxt(studio.earthP))}</div>` : ''}
                    <div class="st-lab">Couleur de la terre</div><div class="st-sw">${EC.map(([c, l]) => `<button type="button" class="${(studio.earthCol || null) === c ? 'on' : ''}" title="${l}" style="background:${c || stEarthNat()}" onclick="stEarthCol(${c ? `'${c}'` : 'null'})"></button>`).join('')}<label title="Autre couleur"><input type="color" value="${studio.earthCol || stEarthNat()}" onchange="stEarthCol(this.value)">＋</label></div>`)
                + sec('eau', 'Eau et rives', `<div class="st-mos">${tg('wave', 'Vaguelettes')}${tg('riv', 'Rochers et roseaux')}${tg('bed', 'Fond : rochers, algues, poissons')}</div>`)
                + sec('rendu', 'Rendu', `<div class="st-lab">Qualité</div><div class="st-mos st-mos5">${Object.keys(RD_Q).map(k => tile('q-' + k, RD_Q[k].n, studio.q === k, `stSet('q', '${k}')`)).join('')}</div>
                <div class="st-lab">Taille</div>${vSeg(Object.keys(ST_RES).map(k => [k, ST_RES[k][1]]), studio.res, "stSet('res', '$')")}
                <div class="st-mos" style="margin-top:8px">${tg('sh', 'Ombres portées')}${tg('tree', 'Arbres détaillés')}${realOn() ? tg('realHD', 'Relief réel HD') : ''}${tg('fin', 'Finition photo')}${tg('dof', 'Profondeur de champ')}${tg('haze', 'Brume du lointain')}</div>
                <div class="mf-hint">${Q.n} : ${Q.d} · ${Q.spp} passes · ${w} × ${h} px</div>`);
            v3PanelShow('studio', html); stPreview('grass'); stPreview('earth'); }
        const stGrassTxt = (v) => +v >= 700 ? 'moquette' : Math.round(+v) + ' /m²';
        const stCm = (m) => m < 0.01 ? nfr(m * 1000, 0) + ' mm' : nfr(m * 100, 0) + ' cm';
        const stSecOpen = (k) => { try { const v = JSON.parse(localStorage.getItem('momocad-stsec') || '{}'); return v[k] !== undefined ? v[k] : k === 'cad' || k === 'rendu'; } catch (e) { return true; } };
        function stSecSave(d) { try { const v = JSON.parse(localStorage.getItem('momocad-stsec') || '{}'); v[d.dataset.k] = d.open; localStorage.setItem('momocad-stsec', JSON.stringify(v)); } catch (e) {} }
        // réglettes : densités de l'herbe et des grains sur la même échelle (50 % = normal), taille des grains du sable aux blocs
        const stDensTxt = (p) => +p >= 85 ? 'moquette' : +p <= 15 ? 'très clair' : Math.round(+p) + ' %';
        const stGrassP = () => Math.round(Math.max(0, Math.min(100, 50 + 50 * Math.log(Math.max(1, studio.grassN || 250) / 250) / Math.log(4))));
        function stGrassSet(p) { studio.grassN = Math.round(250 * Math.pow(4, (+p - 50) / 50)); const e = document.getElementById('st-gn-v'); if (e) e.textContent = stDensTxt(p); }
        const stEarthMul = () => Math.pow(4, ((studio.earthP === undefined ? 50 : +studio.earthP) - 50) / 50);
        const stGranD = (sv) => 0.002 * Math.pow(175, (sv === undefined ? +studio.granS : +sv) / 100);   // diamètre médian : 2 mm à 35 cm
        const stGranName = (d) => d < 0.006 ? 'sable' : d < 0.03 ? 'graviers' : d < 0.1 ? 'cailloux' : 'blocs';
        const stGranTxt = (sv) => { const d = stGranD(sv); return stGranName(d) + ' ' + stCm(d); };
        const stEarthNat = () => { const a = texAvg('terre'); return '#' + a.toString(16).padStart(6, '0'); };
        function stEarthCol(c) { studio.earthCol = c || null; try { build3DScene(); } catch (e) {} studioPanel(); render3D(); }
        // aperçus des choix (dessinés une fois)
        /* aperçus en direct de l'herbe et de la terre : une bande de 60 cm vue de face, redessinée à chaque mouvement de réglette */
        function stPreview(k) { const c = document.getElementById('st-pv-' + k); if (!c) return; const x = c.getContext('2d'), W = c.width, H = c.height, px = W / 0.6; let sd = 11; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
            if (k === 'grass') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9cc3e8'); g.addColorStop(1, '#dbe9f5'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#4a3b2a'; x.fillRect(0, H - 14, W, 14);
                const h = (studio.grassH || 12) / 100 * px, n = Math.round(Math.min(5000, (studio.grassN || 250) * 2.4));
                for (let i = 0; i < n; i++) { const bx = R() * W, hh = h * (0.55 + R() * 0.6), lean = (R() - 0.5) * hh * 0.5, by = H - 10 - R() * 6; x.strokeStyle = `hsl(${82 + R() * 32},${40 + R() * 30}%,${18 + R() * 30}%)`; x.lineWidth = 1 + R() * 1.6;
                    x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + lean * 0.2, by - hh * 0.6, bx + lean, by - hh); x.stroke(); }
                x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '600 20px Arial'; x.fillText('60 cm', 10, 26); }
            else { const base = new THREE.Color(studio.earthCol || stEarthNat()); x.fillStyle = '#' + base.clone().multiplyScalar(0.55).getHexString(); x.fillRect(0, 0, W, H);
                const dm = stGranD(), cov = Math.min(1.6, 0.55 * stEarthMul()), A = W * H, area = Math.PI * Math.pow(dm * px / 2, 2), n = Math.round(Math.min(9000, Math.max(3, cov * A / Math.max(0.6, area))));
                const cc = new THREE.Color(), grey = new THREE.Color(0x8a8378);
                for (let i = 0; i < n; i++) { const d = dm * (0.45 + R() * 1.15) * px, r = Math.max(0.6, d / 2), gx = R() * W, gy = R() * H; cc.copy(base).lerp(grey, R() * 0.6).offsetHSL(0, (R() - 0.5) * 0.1, (R() - 0.5) * 0.18);
                    if (r > 3) { x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(gx + r * 0.18, gy + r * 0.22, r, r * 0.8, 0, 0, 7); x.fill(); }
                    x.fillStyle = '#' + cc.getHexString(); x.beginPath(); x.ellipse(gx, gy, r, r * (0.65 + R() * 0.3), R() * 3, 0, 7); x.fill();
                    if (r > 3) { x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(gx - r * 0.3, gy - r * 0.3, r * 0.45, r * 0.3, 0, 0, 7); x.fill(); } }
                x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(10, H - 16, px * 0.1, 4); x.font = '600 18px Arial'; x.fillText('10 cm', 10, H - 22); } }
        const ST_THUMB = {};
        function stThumb(k) { if (ST_THUMB[k]) return ST_THUMB[k]; const W = 120, H = 72, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); let sd = 7; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
            const sky = (a, b) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a || '#7fb3e6'); g.addColorStop(1, b || '#dbeafe'); x.fillStyle = g; x.fillRect(0, 0, W, H); };
            const ground = (y, col) => { x.fillStyle = col; x.fillRect(0, y, W, H - y); };
            if (k === 'thirds') { sky(); ground(44, '#4d7c2f'); x.fillStyle = '#e7e2d8'; x.fillRect(64, 26, 30, 20); x.fillStyle = '#9a3412'; x.beginPath(); x.moveTo(60, 27); x.lineTo(79, 14); x.lineTo(98, 27); x.fill(); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1; [40, 80].forEach(v => { x.beginPath(); x.moveTo(v + .5, 0); x.lineTo(v + .5, H); x.stroke(); }); [24, 48].forEach(v => { x.beginPath(); x.moveTo(0, v + .5); x.lineTo(W, v + .5); x.stroke(); }); }
            else if (k === 'pano') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#93c5fd'); g.addColorStop(1, '#e0f2fe'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#64748b'; x.beginPath(); x.moveTo(0, 46); for (let i = 0; i <= 12; i++) x.lineTo(i * 10, 30 + (i % 3) * 7 + R() * 6); x.lineTo(W, H); x.lineTo(0, H); x.fill(); x.fillStyle = '#4d7c2f'; x.fillRect(0, 52, W, 20); x.strokeStyle = '#fff'; x.setLineDash([3, 3]); x.strokeRect(4.5, 6.5, W - 9, H - 13); }
            else if (k === 'grass') { ground(0, '#2f4f1d'); for (let i = 0; i < 420; i++) { const gx = R() * W, gy = 10 + R() * (H - 8), h = 6 + R() * 14 * (gy / H); x.strokeStyle = `hsl(${85 + R() * 30},${45 + R() * 25}%,${22 + R() * 25}%)`; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (R() - .5) * 4, gy - h / 2, gx + (R() - .5) * 6, gy - h); x.stroke(); } }
            else if (k === 'earth') { ground(0, '#5c4632'); for (let i = 0; i < 260; i++) { const r = 1 + R() * 4.5; x.fillStyle = `hsl(${25 + R() * 15},${15 + R() * 20}%,${25 + R() * 30}%)`; x.beginPath(); x.ellipse(R() * W, R() * H, r, r * (.6 + R() * .4), R() * 3, 0, 7); x.fill(); } }
            else if (k === 'wave') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e3a5f'); g.addColorStop(1, '#2f6f8f'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2; for (let j = 0; j < 9; j++) { x.beginPath(); for (let i = 0; i <= W; i += 4) { const y = 6 + j * 8 + Math.sin(i / 7 + j) * 2; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); } }
            else if (k === 'riv') { x.fillStyle = '#2f6f8f'; x.fillRect(0, 0, W, H); x.fillStyle = '#4d7c2f'; x.fillRect(0, 50, W, 22); for (let i = 0; i < 9; i++) { x.fillStyle = `hsl(30,6%,${40 + R() * 25}%)`; x.beginPath(); x.ellipse(8 + i * 13, 50, 6 + R() * 4, 4 + R() * 3, 0, 0, 7); x.fill(); } x.strokeStyle = '#a3a35a'; x.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const rx = 70 + R() * 48; x.beginPath(); x.moveTo(rx, 60); x.lineTo(rx + (R() - .5) * 6, 26 + R() * 16); x.stroke(); } }
            else if (k === 'sh') { ground(0, '#9ca86e'); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.moveTo(50, 50); x.lineTo(98, 58); x.lineTo(112, 44); x.lineTo(70, 38); x.fill(); x.fillStyle = '#e5e1d8'; x.fillRect(30, 22, 34, 28); x.fillStyle = '#b8b2a6'; x.fillRect(64, 22, 10, 28); }
            else if (k === 'tree') { sky(); ground(54, '#4d7c2f'); x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(66, 58, 22, 4, 0, 0, 7); x.fill(); x.fillStyle = '#5b3a1e'; x.fillRect(57, 34, 6, 24); [[60, 24, 18], [48, 30, 12], [72, 30, 12], [60, 14, 12]].forEach(([cx, cy, r]) => { x.fillStyle = `hsl(${100 + R() * 20},45%,${26 + R() * 12}%)`; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }); }
            else if (k === 'realHD') { sky(); x.fillStyle = '#6b7f5a'; x.beginPath(); x.moveTo(0, 60); for (let i = 0; i <= 24; i++) x.lineTo(i * 5, 24 + Math.abs(Math.sin(i * .55)) * 18 + R() * 4); x.lineTo(W, H); x.lineTo(0, H); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) { const px = R() * W, py = 36 + R() * 30; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 3, py + 1); x.stroke(); } }
            else if (k === 'fin') { sky('#f59e0b', '#fde68a'); ground(48, '#55702f'); const g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
            else if (k === 'bed') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5aa7c4'); g.addColorStop(1, '#1f4f63'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#6b6a58'; x.fillRect(0, 58, W, 14);
                for (let i = 0; i < 9; i++) { x.fillStyle = `hsl(40,8%,${32 + R() * 22}%)`; x.beginPath(); x.ellipse(6 + i * 14, 60, 5 + R() * 5, 3 + R() * 3, 0, 0, 7); x.fill(); }
                x.strokeStyle = '#3f8f3a'; x.lineWidth = 2; for (let i = 0; i < 7; i++) { const bx = 10 + R() * 100; x.beginPath(); x.moveTo(bx, 60); x.bezierCurveTo(bx - 5, 48, bx + 5, 40, bx - 2, 28 + R() * 10); x.stroke(); }
                [[40, 30, '#f59e0b'], [78, 22, '#e5e7eb'], [92, 40, '#fb923c']].forEach(([fx, fy, col]) => { x.fillStyle = col; x.beginPath(); x.ellipse(fx, fy, 7, 3, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(fx - 6, fy); x.lineTo(fx - 11, fy - 4); x.lineTo(fx - 11, fy + 4); x.fill(); }); }
            else if (k === 'dof') { sky(); ground(44, '#4d7c2f'); x.filter = 'blur(2.5px)'; x.fillStyle = '#9a3412'; x.fillRect(6, 30, 26, 16); x.fillStyle = '#4d7c2f'; x.beginPath(); x.arc(104, 26, 12, 0, 7); x.fill(); x.filter = 'none'; x.fillStyle = '#e7e2d8'; x.fillRect(48, 26, 30, 22); x.fillStyle = '#9a3412'; x.beginPath(); x.moveTo(45, 27); x.lineTo(63, 15); x.lineTo(81, 27); x.fill(); }
            else if (k === 'haze') { sky('#cbd5e1', '#e5e7eb'); for (let j = 0; j < 4; j++) { x.fillStyle = `rgba(${90 + j * 30},${110 + j * 28},${120 + j * 26},1)`; x.beginPath(); x.moveTo(0, 30 + j * 8); for (let i = 0; i <= 12; i++) x.lineTo(i * 10, 26 + j * 9 + Math.sin(i * 0.9 + j) * 5); x.lineTo(W, H); x.lineTo(0, H); x.fill(); } x.fillStyle = '#4d7c2f'; x.fillRect(0, 58, W, 14); }
            else if (k.startsWith('m-')) { const t = k.slice(2); sky(); ground(40, t === 'nat' ? '#4d7c2f' : '#6b8e4e');
                if (t === 'surf') { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 17, 40); x.lineTo(i * 17 + 30, H); x.moveTo(i * 17 + 30, 40); x.lineTo(i * 17, H); x.stroke(); } }
                else if (t === 'tal') { x.fillStyle = '#c2a878'; x.beginPath(); x.moveTo(20, 50); x.lineTo(100, 50); x.lineTo(110, 66); x.lineTo(10, 66); x.fill(); x.fillStyle = '#8b7355'; x.beginPath(); x.moveTo(10, 66); x.lineTo(110, 66); x.lineTo(118, 72); x.lineTo(2, 72); x.fill(); }
                else if (t === 'rp') { x.fillStyle = '#8b6a45'; x.fillRect(30, 46, 60, 26); x.fillStyle = '#b45309'; x.fillRect(18, 52, 12, 20); x.fillRect(90, 52, 12, 20); x.fillStyle = '#e7e2d8'; x.fillRect(42, 30, 36, 20); }
                else if (t === 'bg') { x.fillStyle = '#5b6b3a'; x.fillRect(0, 40, W, 32); x.fillStyle = '#7a8a55'; for (let i = 0; i < 18; i++) x.fillRect(R() * W, 40 + R() * 30, 8 + R() * 14, 4 + R() * 6); x.fillStyle = '#d6d3d1'; x.fillRect(0, 56, W, 4); }
                else if (t === 'lab') { x.fillStyle = '#fbbf24'; x.font = 'bold 10px Arial'; [[14, 54, '812,4'], [60, 62, '813,1'], [88, 48, '814,0']].forEach(([px, py, tt]) => { x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); x.fillText(tt, px + 4, py - 3); }); }
                else if (t === 'lines') { x.strokeStyle = '#f472b6'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(6, 66); x.lineTo(50, 46); x.lineTo(114, 58); x.stroke(); x.strokeStyle = '#fb923c'; x.strokeRect(70, 44, 26, 14); }
                else if (t === 'nat') { for (let i = 0; i < 260; i++) { x.strokeStyle = `hsl(${85 + R() * 30},50%,${24 + R() * 20}%)`; const gx = R() * W, gy = 42 + R() * 30; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (R() - .5) * 3, gy - 4 - R() * 5); x.stroke(); } x.fillStyle = '#8b7355'; x.fillRect(64, 50, 40, 10); } }
            else if (k.startsWith('q-')) { const lv = Object.keys(RD_Q).indexOf(k.slice(2)); sky(); ground(44, '#4d7c2f'); x.fillStyle = '#e7e2d8'; x.fillRect(42, 22, 36, 24); x.fillStyle = 'rgba(0,0,0,' + (0.1 + lv * 0.06) + ')'; x.beginPath(); x.moveTo(78, 46); x.lineTo(104, 52); x.lineTo(104, 40); x.lineTo(78, 22); x.fill();
                const im = x.getImageData(0, 0, W, H), d = im.data, nz = [70, 40, 18, 8, 2][lv] || 0; for (let i = 0; i < d.length; i += 4) { const v = (R() - .5) * nz; d[i] += v; d[i + 1] += v; d[i + 2] += v; } x.putImageData(im, 0, 0); }
            return (ST_THUMB[k] = c.toDataURL('image/png')); }
        // ---- VOLET DE LA VUE 3D (Espace dans la vue 3D) : onglets Affichage, Ciel et paysage, Outils, Studio photo — remplace le bandeau
        let v3Tab = 'aff'; try { v3Tab = localStorage.getItem('momocad-v3tab') || 'aff'; } catch (e) {} if (!['aff', 'ciel', 'studio'].includes(v3Tab)) v3Tab = 'aff';
        const V3_TABS = [['aff', '👁', 'Affichage'], ['outils', '🛠', 'Outils'], ['ciel', '⛰', 'Décor'], ['studio', '📷', 'Studio']];
        const v3PanelOpen = () => { const p = document.getElementById('t2-panel'); return !!(p && p.style.display !== 'none' && (p.dataset.kind === 'v3' || p.dataset.kind === 'studio')); };
        function v3Panel(tab) { if (!V3 || !is3DOpen()) return; if (tab) { v3Tab = V3_TABS.some(t => t[0] === tab) ? tab : 'aff'; try { localStorage.setItem('momocad-v3tab', tab); } catch (e) {} }
            if (v3Tab === 'studio') { studioPanel(); return; } v3PanelShow(v3Tab, v3TabHTML(v3Tab)); }
        function v3PanelRefresh() { if (v3PanelOpen()) v3Panel(); }
        function v3PanelClose() { const p = document.getElementById('t2-panel'); if (p && (p.dataset.kind === 'v3' || p.dataset.kind === 'studio')) t2PanelClose(); if (V3) { v3Sky(); render3D(); } }
        function v3PanelShow(tab, html) { const rail = `<div class="v3v-rail">` + V3_TABS.map(([k, ic, l]) => `<button type="button" class="${k === tab ? 'on' : ''}" onclick="v3Panel('${k}')"><span>${ic}</span>${l}</button>`).join('') + `</div>`;
            t2Panel('Vue 3D — ' + V3_TABS.find(t => t[0] === tab)[2], `<div class="v3v">${rail}<div class="v3v-c">${html}</div></div>`, tab === 'studio' ? [['Fermer', 'v3PanelClose()'], ['📸 Lancer le rendu', 'studioRender()', true]] : [['Fermer', 'v3PanelClose()']], 'v3PanelClose()');
            const p = document.getElementById('t2-panel'); p.dataset.kind = tab === 'studio' ? 'studio' : 'v3'; p.classList.add('v3v-p'); document.body.classList.add('v3pan'); if (V3) { v3Sky(); render3D(); } }
        const v3Chk = (id) => !!(document.getElementById(id) || {}).checked;
        function v3SetChk(id, on) { const c = document.getElementById(id); if (!c || c.checked === !!on) return; const b = document.querySelector('#v3-band [data-for="' + id + '"]'); if (b) v3Tog(b); else { c.checked = !!on; c.dispatchEvent(new Event('change')); } v3PanelRefresh(); }
        function v3TabHTML(tab) { const sw = (id, l, t) => `<label class="st-ck" title="${t || ''}"><input type="checkbox" class="bm-switch" ${v3Chk(id) ? 'checked' : ''} onchange="v3SetChk('${id}', this.checked)"> ${l}</label>`;
            if (tab === 'aff') { const mt = (id, k, l, t) => `<button type="button" class="st-tile${v3Chk(id) ? ' on' : ''}" onclick="v3SetChk('${id}', ${!v3Chk(id)})" title="${t || l}"><img src="${stThumb(k)}" alt=""><span>${l}</span></button>`;   /* mosaïque d'aperçus à cocher, comme le studio */
                return `<div class="st-sec"><h4>Montrer</h4><div class="st-mos">${mt('v3-surf', 'm-surf', 'Terrain', 'Surface du terrain triangulée entre les points cotés')}${mt('v3-tal', 'm-tal', 'Plateformes et talus')}${mt('v3-rp', 'm-rp', 'Remblai périphérique', 'Referme les talus de déblai jusqu\'au niveau fini')}${mt('v3-bg', 'm-bg', 'Fonds de carte')}${mt('v3-lab', 'm-lab', 'Points cotés')}${mt('v3-lines', 'm-lines', 'Traits du plan')}${mt('v3-nat', 'm-nat', 'Rendu naturel', 'Herbe, terre, grave ; sinon nivellement en couleurs (remblai bleu, déblai rouge)')}</div></div>`; }
            if (tab === 'outils') { const tb = (ic, l, js, t, on) => `<button type="button" class="v3v-card${on ? ' on' : ''}" onclick="${js}" title="${t}"><span style="font-size:20px">${ic}</span><b>${l}</b></button>`;
                return `<div class="st-sec"><h4>Outils de la vue 3D</h4><div class="v3v-cards">${tb('📏', 'Mesurer', "v3PanelClose();setMode(mode === 'measure' ? 'select-box' : 'measure')", 'Mesurer en 3D : deux points accrochés sur les objets', mode === 'measure')}${tb('⚠', 'Collisions', 'v3PanelClose();d3Collisions()', 'Contrôle des collisions : les volumes qui se traversent, volume commun en rouge')}${tb('🖌', 'Peindre', "v3PanelClose();paintMode('trait')", 'Pinceau et textures dans la vue 3D')}</div></div>`; }
            if (tab === 'ciel') { const card = (k, n, ic, sub) => `<button type="button" class="v3v-card${v3HzKind === k ? ' on' : ''}" onclick="v3HzType('${k}');v3PanelRefresh()">${ic}<b>${n}</b>${sub ? '<small>' + sub + '</small>' : ''}</button>`;
                const S0 = realSite(); return `<div class="st-sec"><h4>Relief réel alentour</h4><div class="st-cks"><label class="st-ck"><input type="checkbox" class="bm-switch" ${realOn() ? 'checked' : ''} ${S0 ? '' : 'disabled'} onchange="realSet(this.checked)"> Le vrai relief jusqu'à 25 km, en photo aérienne</label></div><div class="mf-hint" style="margin-top:6px">${!S0 ? 'Il faut un fond de carte : le projet doit être situé.' : REAL_LOAD ? 'Téléchargement…' : REAL ? 'Chargé (gardé sur ce poste) ; se fond dans la brume au loin.' : 'Téléchargé une fois (altitudes de l\'IGN, photo aérienne), puis gardé sur ce poste.'}</div></div>
                    <div class="st-sec"><h4>Ciel et lumière</h4><div class="st-cks">${sw('v3-hz', 'Ciel')}</div><div class="st-row"><span>Heure</span><div class="st-sl"><input type="range" min="0" max="24" step="0.25" value="${v3Hour}" oninput="v3SetHour(this.value);this.nextElementSibling.textContent=stHourTxt(this.value)"><b>${stHourTxt(v3Hour)}</b></div></div></div>
                    <div class="st-sec"><h4>Panorama importé</h4><div class="mf-hint">Une photo d'horizon (prés, haies, montagnes au loin…) posée tout autour sur l'horizon, en miroir sans raccord ; le haut se fond dans le ciel.</div><div class="v3v-tools"><button type="button" class="vbtn${v3HzKind === 'img' ? ' pri' : ''}" onclick="${HZ_IMG ? "v3HzType('img');v3PanelRefresh()" : 'hzImgPick()'}">${HZ_IMG ? 'Utiliser ma photo' : 'Choisir une photo…'}</button>${HZ_IMG ? '<button type="button" class="vbtn" onclick="hzImgPick()">Changer…</button>' : ''}</div>${HZ_IMG ? `<div class="st-row"><span>Horizon</span><div class="st-sl"><input type="range" min="0.3" max="0.98" step="0.01" value="${hzImgSet.line}" oninput="hzImgLine(this.value);this.nextElementSibling.textContent=Math.round(this.value*100)+' %'"><b>${Math.round(hzImgSet.line * 100)} %</b></div></div>` : ''}</div>`; }
            return ''; }
        function v3Exag(v) { const sel = document.getElementById('v3-exag'); if (!sel) return; sel.value = v; sel.dispatchEvent(new Event('change')); v3PanelRefresh(); }
        // Espace dans la vue 3D : ouvrir / fermer le volet (hors balade, hors saisie)
        window.addEventListener('keydown', (e) => { if (e.code !== 'Space' || !V3 || !is3DOpen() || V3.fps || (typeof lp3D !== 'undefined' && lp3D.live) || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#t2-panel'))) return;
            if (mode !== 'select-box' && mode !== 'measure') return; e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return; if (v3PanelOpen()) v3PanelClose(); else v3Panel(); }, true);
        const stHourTxt = (v) => String(Math.floor(+v) % 24).padStart(2, '0') + ' h ' + String(Math.round((+v % 1) * 60)).padStart(2, '0');

        // ---- RENDU ----
        let RD = null, RD_LAST = null;
        const rdWait = () => new Promise(r => setTimeout(r, 0));
        function rdUI(mode) { let ov = document.getElementById('rd-ov'); if (!ov) { ov = document.createElement('div'); ov.id = 'rd-ov'; document.getElementById('view3d').appendChild(ov); }
            if (mode === 'off') { ov.style.display = 'none'; return; }
            ov.style.display = 'flex'; const run = mode === 'run';
            ov.innerHTML = `<div class="rd-card"><div class="vh"><h3>${run ? '📸 Rendu en cours' : '📸 Rendu terminé'}</h3>${run ? '' : '<button type="button" class="vx" onclick="rdUI(\'off\')" title="Fermer">×</button>'}</div>
                <div class="rd-img"><canvas id="rd-cv"></canvas></div>
                <div class="rd-bar"><i id="rd-fill"></i></div><div class="rd-info"><span id="rd-step"></span><span id="rd-time"></span></div>
                <div class="vf">${run ? '<button type="button" class="vbtn" onclick="if (RD) RD.stop = true">Arrêter (garder l\'image)</button>'
                    : '<button type="button" class="vbtn" onclick="rdUI(\'off\')">Fermer</button><button type="button" class="vbtn" onclick="rdUI(\'off\');studioRender()">↻ Relancer</button><button type="button" class="vbtn pri" onclick="rdSave()">💾 Enregistrer (PNG)</button>'}</div></div>`;
            const cv = document.getElementById('rd-cv'), src = run ? RD && RD.prev : RD_LAST && RD_LAST.cv; if (src) { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); } }
        function rdStep(t, f) { const s = document.getElementById('rd-step'), b = document.getElementById('rd-fill'), tm = document.getElementById('rd-time'); if (s) s.textContent = t; if (b && f !== undefined) b.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%';
            if (tm && RD) { const el = (performance.now() - RD.t0) / 1000, rest = RD.n > 1 && RD.tS ? (performance.now() - RD.tS) / 1000 / RD.n * (RD.N - RD.n) : null; tm.textContent = rdSec(el) + (rest !== null ? ' · reste ≈ ' + rdSec(rest) : ''); } }
        const rdSec = (s) => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0');
        function rdSave() { if (!RD_LAST) return; RD_LAST.cv.toBlob(b => { if (!b) return; const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = RD_LAST.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png'); }
        // ombres : soleil (et lumière du ciel) avec carte d'ombre calée sur la zone vue
        function rdShadowFit(L, C, rr, size) { L.castShadow = true; if (L.shadow.mapSize.x !== size) { L.shadow.mapSize.set(size, size); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } }
            const sc = L.shadow.camera; sc.left = -rr; sc.right = rr; sc.top = rr; sc.bottom = -rr; sc.near = 0.05; sc.far = rr * 6; sc.updateProjectionMatrix(); L.shadow.bias = -0.0004; L.shadow.normalBias = rr / size * 1.2; L.target.position.copy(C); }
        function rdLightAt(L, C, d, rr) { L.position.set(C.x + d.x * rr * 2.5, C.y + d.y * rr * 2.5, C.z + d.z * rr * 2.5); L.target.updateMatrixWorld(); }
        function rdShadowsOff() { [V3.sun, V3.rdSky].forEach(L => { if (!L) return; L.castShadow = false; if (L.shadow && L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } });
            if (V3.rdSky) { V3.scene.remove(V3.rdSky); V3.scene.remove(V3.rdSky.target); V3.rdSky = null; } if (V3.sun.target.parent) V3.sun.target.parent.remove(V3.sun.target); V3.sun.target.position.set(0, 0, 0); V3.sun.target.updateMatrixWorld(); }
        async function studioRender() {
            if (!V3 || !V3.root || RD) return; const Q = RD_Q[studio.q] || RD_Q.standard, [aw, ah] = ST_FMT[studio.fmt] || ST_FMT['16:9'];
            let [W, H] = stResWH(); const mx = Math.min(8192, V3.renderer.capabilities.maxTextureSize || 4096); if (W > mx || H > mx) { const k = mx / Math.max(W, H); W = Math.round(W * k); H = Math.round(H * k); }
            if (V3.rdSize) { W = V3.rdSize[0]; H = V3.rdSize[1]; }   // (tests) petite image
            const N = V3.rdSpp || Q.spp; RD = { stop: false, t0: performance.now(), n: 0, N, W, H }; RD.prev = document.createElement('canvas'); RD.prev.width = Math.min(W, 960); RD.prev.height = Math.round(RD.prev.width * H / W);
            V3.noPin = true; if (V3.pinMesh) V3.pinMesh.visible = false;   /* le drapeau est un repère de travail : jamais dans l'image (ni pendant sa préparation) */
            rdUI('run'); rdStep('Affinage de la scène…', 0); await rdWait(); await rdWait();
            if (studio.realHD && realOn() && REAL) {   /* relief réel HD : téléchargé une fois (puis gardé), avancement affiché, 2 min au plus ; « Arrêter » pendant ce temps : rendu avec le relief normal */
                let last = 'Relief réel en haute définition (téléchargé une seule fois)…', lf = 0; rdStep(last, 0); const tick = setInterval(() => rdStep(last, lf), 1000);
                try { const r = await Promise.race([realLoadHD((f, t) => { last = 'Relief réel HD : ' + t; lf = f; rdStep(last, f); }, () => !!(RD && RD.stop)), new Promise(res => setTimeout(() => res('lent'), 120000)), new Promise(res => { const k = setInterval(() => { if (!RD || RD.stop) { clearInterval(k); res('stop'); } }, 200); })]);
                    if (r !== 'stop' && (r === 'lent' || !r)) updateCommandMessageText('RENDU : relief réel HD ' + (r === 'lent' ? 'trop long à venir (il continue en arrière-plan pour la prochaine fois)' : 'indisponible') + ' : rendu avec le relief réel normal.'); } catch (e) {} finally { clearInterval(tick); }
                if (RD && RD.stop) RD.stop = false; }
            const cam = V3.camera, rc = cam.clone(); rc.clearViewOffset(); rc.fov = stVFov(studio.f, aw / ah) * 180 / Math.PI; rc.aspect = W / H; rc.near = cam.near; rc.far = cam.far; rc.updateProjectionMatrix(); rc.updateMatrixWorld(true);
            let R = null, out = null;
            try {
                V3.hq = { tree: studio.tree ? Q.tree : 1, terr: Q.terr, grass: studio.grass ? Q.grass : 0, earth: !!studio.earth, riv: !!studio.riv, wave: !!studio.wave, bed: !!studio.bed, realHD: !!studio.realHD, rc };
                try { build3DScene(); } finally { V3.hq = null; }
                rdStep('Préparation de la lumière…', 0); await rdWait();
                R = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(W, H, false); R.setClearColor(V3.renderer.getClearColor(new THREE.Color()), 1); if ('outputColorSpace' in R) R.outputColorSpace = V3.renderer.outputColorSpace; else R.outputEncoding = V3.renderer.outputEncoding; R.clippingPlanes = v3CutPlanes();
                const sh = !!studio.sh; R.shadowMap.enabled = sh; R.shadowMap.type = THREE.PCFSoftShadowMap;
                V3.root.updateMatrixWorld(true); V3.root.traverse(o => { if (!o.isMesh) return; const tr = o.material && o.material.transparent; o.castShadow = sh && !o.userData.grass && !o.userData.water && !(o.userData.grain && stGranD() < 0.03) && !o.userData.drape && !(tr && o.material.opacity < 0.7); o.receiveShadow = sh; });
                // zone des ombres : autour du point visé, à la taille de ce qu'on voit (pas tout un fond IGN de 2 km)
                const C = V3.fps ? V3.fps.pos.clone().add(new THREE.Vector3(Math.sin(V3.fps.yaw) * 20, Math.cos(V3.fps.yaw) * 20, 0)) : V3.target.clone(), rr = Math.max(25, Math.min(V3.R * 1.4, (V3.fps ? 40 : V3.dist * 1.3) + 10));
                const S0 = V3.sun.position.clone().normalize(), amb0 = V3.amb.intensity, sun0 = V3.sun.intensity; V3.scene.add(V3.sun.target);
                if (sh) rdShadowFit(V3.sun, C, rr, Math.min(Q.sh, mx));
                let sky = null; if (sh && Q.sky) { sky = new THREE.DirectionalLight(V3.amb.color.clone().lerp(new THREE.Color(0xcfe0ff), 0.6), amb0 * 0.75); V3.rdSky = sky; V3.scene.add(sky); V3.scene.add(sky.target); rdShadowFit(sky, C, rr, Math.min(Q.sh / 2, mx)); V3.amb.intensity = amb0 * 0.55; }
                // reflets : le ciel, les berges et les arbres vus depuis l'eau (au milieu de l'eau visible), capturés une fois
                { const Wm = []; V3.root.traverse(o => { if (o.userData.water && o.material && o.material.isMeshPhongMaterial) Wm.push(o); }); if (Wm.length) { const bb = new THREE.Box3(); Wm.forEach(o => bb.expandByObject(o)); const cp = bb.getCenter(new THREE.Vector3()); cp.x = Math.max(bb.min.x, Math.min(bb.max.x, C.x)); cp.y = Math.max(bb.min.y, Math.min(bb.max.y, C.y)); cp.z = bb.max.z + 0.3;
                    const crt = new THREE.WebGLCubeRenderTarget(Math.min(512, mx)), cc = new THREE.CubeCamera(0.3, rc.far, crt); cc.position.copy(cp); V3.scene.add(cc); Wm.forEach(o => { o.visible = false; }); rdLightAt(V3.sun, C, S0, rr); v3EnvPlace({ position: cp, far: rc.far }); cc.update(R, V3.scene); Wm.forEach(o => { o.visible = true; }); V3.scene.remove(cc);
                    Wm[0].material.envMap = crt.texture; Wm[0].material.needsUpdate = true; RD.crt = crt;
                    const U = Wm[0].material.userData.refl; if (U) {   // plan du miroir : l'eau la plus proche du point visé
                        let best = null; Wm.forEach(o => { const b = new THREE.Box3().setFromObject(o), d = b.distanceToPoint(C); if (!best || d < best.d) best = { d, z: (b.min.z + b.max.z) / 2 }; });
                        RD.refl = { U, z: best.z, W: Wm, cam: new THREE.PerspectiveCamera(), rt: new THREE.WebGLRenderTarget(Math.max(64, Math.round(W / 2)), Math.max(64, Math.round(H / 2))) }; } } }
                const gl = R.getContext(), buf = new Uint8Array(W * H * 4), acc = new Float32Array(W * H * 3), px = RD.prev.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d');
                const hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
                const perp = (d) => { const a = Math.abs(d.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), u = new THREE.Vector3().crossVectors(d, a).normalize(), v = new THREE.Vector3().crossVectors(d, u); return [u, v]; };
                const [su, sv] = perp(S0); let lastPrev = 0; RD.tS = performance.now();
                /* profondeur de champ : l'objectif se déplace un peu à chaque passe autour de sa place, toujours tourné vers le point visé (net), le reste se floute doucement ;
                   brume du lointain : le décor se fond dans la couleur du ciel avec la distance */
                const P0 = rc.position.clone(), F0 = V3.fps ? null : V3.target.clone(), dF = F0 ? P0.distanceTo(F0) : 0, ap = studio.dof && F0 ? dofAperture(dF, studio.f) : 0, cr = new THREE.Vector3(), cu = new THREE.Vector3();
                if (ap) { rc.updateMatrixWorld(true); cr.setFromMatrixColumn(rc.matrixWorld, 0).normalize(); cu.setFromMatrixColumn(rc.matrixWorld, 1).normalize(); }
                const fog0 = V3.scene.fog; if (studio.haze) { const fc = R.getClearColor(new THREE.Color()), d0 = Math.max(20, (V3.fps ? 40 : V3.dist) * 1.1); V3.scene.fog = new THREE.Fog(fc, d0, Math.max(d0 * 6, d0 + Math.min(rc.far * 0.6, Math.max(400, V3.R * 4)))); RD.fog0 = fog0; RD.fogSet = true; }
                for (let s = 0; s < N && !RD.stop; s++) {
                    rc.setViewOffset(W, H, hal(s + 1, 2) - 0.5, hal(s + 1, 3) - 0.5, W, H);
                    if (ap) { const a = hal(s + 1, 5) * Math.PI * 2, r = Math.sqrt(hal(s + 1, 7)) * ap; rc.position.copy(P0).addScaledVector(cr, Math.cos(a) * r).addScaledVector(cu, Math.sin(a) * r); rc.lookAt(F0); rc.updateMatrixWorld(true); }
                    if (sh) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Q.soft * 3, d = S0.clone().addScaledVector(su, Math.cos(a) * r).addScaledVector(sv, Math.sin(a) * r).normalize(); rdLightAt(V3.sun, C, d, rr); }
                    if (sky) { const u = Math.random(), a = Math.random() * Math.PI * 2, z = Math.sqrt(u), q = Math.sqrt(1 - u); rdLightAt(sky, C, new THREE.Vector3(Math.cos(a) * q, Math.sin(a) * q, Math.max(0.08, z)), rr); }
                    if (RD.refl) rdReflUpdate(R, RD.refl, rc); v3EnvPlace(rc); R.render(V3.scene, rc); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
                    for (let y = 0; y < H; y++) { const sr = (H - 1 - y) * W * 4, dr = y * W * 3; for (let x = 0; x < W; x++) { const i = sr + x * 4, j = dr + x * 3; acc[j] += buf[i]; acc[j + 1] += buf[i + 1]; acc[j + 2] += buf[i + 2]; } }
                    RD.n = s + 1;
                    if (performance.now() - lastPrev > 450 || RD.n === N) { lastPrev = performance.now(); rdCompose(acc, RD.n, W, H, tx, false); px.drawImage(tmp, 0, 0, RD.prev.width, RD.prev.height); const cv = document.getElementById('rd-cv'); if (cv) { if (cv.width !== RD.prev.width) { cv.width = RD.prev.width; cv.height = RD.prev.height; } cv.getContext('2d').drawImage(RD.prev, 0, 0); } }
                    rdStep('Passe ' + RD.n + ' / ' + N + (sh ? ' · ombres' : '') + (sky ? ' · ciel' : ''), RD.n / N); await rdWait(); }
                if (RD.n) { rdCompose(acc, RD.n, W, H, tx, !!studio.fin); out = tmp; }
                V3.amb.intensity = amb0; V3.sun.intensity = sun0; V3.sun.position.copy(S0);
            } catch (e) { console.error(e); updateCommandMessageText('RENDU : interrompu (' + (e && e.message || e) + ').'); }
            finally {
                V3.noPin = false; try { v3PinMark(); } catch (e) {} try { rdShadowsOff(); } catch (e) {} if (RD && RD.fogSet) V3.scene.fog = RD.fog0 || null; if (RD && RD.crt) RD.crt.dispose(); if (RD && RD.refl) RD.refl.rt.dispose(); if (R) { try { R.dispose(); R.forceContextLoss(); } catch (e) {} }
                const n = RD ? RD.n : 0; RD = null; V3.hq = null; try { build3DScene(); v3Sky(); render3D(); } catch (e) { console.error(e); }
                if (out) { const v = studio.views.find(x => x.az === V3.az && x.dist === V3.dist), d = new Date(); RD_LAST = { cv: out, n, name: 'rendu' + (v ? '-' + v.n.replace(/[^\w-]+/g, '_') : '') + '-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.png' };
                    rdUI('done'); rdStep(n + ' passe(s) · ' + out.width + ' × ' + out.height + ' px', 1); updateCommandMessageText('RENDU : terminé (' + n + ' passes). 💾 pour l\'enregistrer en PNG.'); }
                else rdUI('off'); }
        }
        // moyenne des passes → image ; finition : contraste doux, couleurs un peu relevées, coins assombris
        function rdCompose(acc, n, W, H, tx, fin) { const im = tx.createImageData(W, H), d = im.data, k = 1 / n, cx = W / 2, cy = H / 2, R2 = cx * cx + cy * cy;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 3, i = (y * W + x) * 4; let r = acc[j] * k, g = acc[j + 1] * k, b = acc[j + 2] * k;
                if (fin) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * 1.1; g = l + (g - l) * 1.1; b = l + (b - l) * 1.1; const S = (v) => { v /= 255; v = v + 0.35 * v * (1 - v) * (v - 0.5) * 2; return v * 255; }; r = S(r); g = S(g); b = S(b);
                    const dx = x - cx, dy = y - cy, vg = 1 - 0.22 * Math.pow((dx * dx + dy * dy) / R2, 1.4); r *= vg; g *= vg; b *= vg; }
                d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
            tx.putImageData(im, 0, 0); }

        // ---- scène affinée pour le rendu ----
        // normales lissées (terrain) : les faces voisines presque dans le même plan partagent leur normale ; les arêtes vives (crête de talus) restent nettes
        function v3SmoothNormals(G, deg) { const p = G.attributes.position.array, n = p.length / 9 | 0, fn = new Float32Array(n * 3), cs = Math.cos(deg * Math.PI / 180), M = new Map(), key = (i) => Math.round(p[i] * 200) + ',' + Math.round(p[i + 1] * 200) + ',' + Math.round(p[i + 2] * 200);
            for (let t = 0; t < n; t++) { const a = t * 9, ux = p[a + 3] - p[a], uy = p[a + 4] - p[a + 1], uz = p[a + 5] - p[a + 2], vx = p[a + 6] - p[a], vy = p[a + 7] - p[a + 1], vz = p[a + 8] - p[a + 2];
                const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; fn[t * 3] = x; fn[t * 3 + 1] = y; fn[t * 3 + 2] = z;
                for (let v = 0; v < 3; v++) { const k = key(a + v * 3); let L = M.get(k); if (!L) M.set(k, L = []); L.push(t); } }
            const nm = new Float32Array(p.length), u = (t) => { const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
            for (let t = 0; t < n; t++) { const f = u(t); for (let v = 0; v < 3; v++) { const a = t * 9 + v * 3; let x = 0, y = 0, z = 0; for (const o of M.get(key(a))) { const g = u(o); if (f[0] * g[0] + f[1] * g[1] + f[2] * g[2] >= cs) { x += fn[o * 3]; y += fn[o * 3 + 1]; z += fn[o * 3 + 2]; } }
                const l = Math.hypot(x, y, z) || 1; nm[a] = x / l; nm[a + 1] = y / l; nm[a + 2] = z / l; } }
            G.setAttribute('normal', new THREE.BufferAttribute(nm, 3)); return G; }
        // pixel de la photo du fond sous un point du plan (null hors photo)
        function bgPixAt(x, y, bgs) { for (const b of bgs) { const L = bgLocal(b, x, y), W = b.type === 'basemap' ? 2 * b.r : b.w, H = b.type === 'basemap' ? 2 * b.r : b.h; if (b.type === 'basemap' ? Math.hypot(L.x, L.y) > b.r : Math.abs(L.x) > W / 2 || Math.abs(L.y) > H / 2) continue;
                const X = bmPixels(b); if (!X) continue; const px = Math.floor((L.x / W + 0.5) * X.w), py = Math.floor((L.y / H + 0.5) * X.h); if (px < 0 || py < 0 || px >= X.w || py >= X.h) continue; const k = (py * X.w + px) * 4; if (X.d[k + 3] < 128) continue; return [X.d[k], X.d[k + 1], X.d[k + 2]]; } return null; }
        // vert moyen de la végétation sur les photos du fond (pixels verts seulement) : la pelouse neuve prend cette teinte là où la photo montrait autre chose
        function bgGreenAvg(bgs) { let r = 0, g = 0, b = 0, n = 0; bgs.forEach(B => { const X = bmPixels(B); if (!X) return; const st = Math.max(4, Math.floor(X.d.length / 4 / 40000)) * 4; for (let k = 0; k < X.d.length; k += st) { const R = X.d[k], G = X.d[k + 1], Bl = X.d[k + 2]; if (X.d[k + 3] > 128 && G >= R * 0.98 && G >= Bl * 1.02) { r += R; g += G; b += Bl; n++; } } }); return n > 50 ? [r / n, g / n, b / n] : null; }
        const isGreenPx = (q) => q[1] >= q[0] * 0.98 && q[1] >= q[2] * 1.02;
        /* teinte de végétation sur la photo : verts, mais aussi herbe sèche jaune-brun, olive, et ombres portées sombres (arbres) ; pas les gris (enrobé, béton) ni les rouges (tuiles) */
        function isGrassyPx(q) { const r = q[0], g = q[1], b = q[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0; if (mx < 60) return g > b * 1.03 && r < g * 1.35;
            if (sat < 0.12) return false; let h = 0; const d = mx - mn || 1; if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); if (h < 0) h += 360; return h >= 35 && h <= 170; }
        // herbe calée sur la photo du fond : chaque sommet de la pelouse prend la teinte de la photo à sa place (le motif de la texture reste) ; sans photo : le vert de la texture
        function v3GrassTint(G, bgs) { if (!bgs || !bgs.length) return false; const gA = bgGreenAvg(bgs); if (!gA) return false; const p = G.attributes.position.array, n = p.length / 3, col = new Float32Array(n * 3), avg = texAvg('pelouse'), ar = ((avg >> 16) & 255) || 1, ag = ((avg >> 8) & 255) || 1, ab = (avg & 255) || 1, c = V3.center || { x: 0, y: 0 };
            for (let i = 0; i < n; i++) { const wx = mmToWorld(p[i * 3] * 1000), wy = mmToWorld(-p[i * 3 + 1] * 1000); let q = bgPixAt(wx, wy, bgs); const cl = (v) => Math.max(0.35, Math.min(1.8, v)); q = q && isGreenPx(q) ? [(q[0] + gA[0]) / 2, (q[1] + gA[1]) / 2, (q[2] + gA[2]) / 2] : gA;
                if (q) { col[i * 3] = cl(q[0] / ar); col[i * 3 + 1] = cl(q[1] / ag); col[i * 3 + 2] = cl(q[2] / ab); } else col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; }
            G.setAttribute('color', new THREE.BufferAttribute(col, 3)); return true; }
        // herbe en 3D : des touffes de brins semées sur la pelouse, serrées près de la caméra, plus rares au loin, seulement dans le champ ; couleur de la photo du fond (si elle est verte là), sinon verts
        // là où ni herbe ni grains ne poussent : marches d'escalier, zones repeintes (pinceau, zone peinte au sol) ; test en coordonnées du plan
        function v3NoSow() { const L = []; shapes.forEach(s => { if (s.stair && s.stair.a && s.stair.b) { const a = s.stair.a, b = s.stair.b, l = Math.hypot(b.x - a.x, b.y - a.y) || 1, hw = mmToWorld((s.stair.w || 1200) / 2 + 150), ux = (b.x - a.x) / l, uy = (b.y - a.y) / l;
                    L.push({ x0: Math.min(a.x, b.x) - hw, x1: Math.max(a.x, b.x) + hw, y0: Math.min(a.y, b.y) - hw, y1: Math.max(a.y, b.y) + hw, f: (x, y) => { const t = (x - a.x) * ux + (y - a.y) * uy, n = Math.abs(-(x - a.x) * uy + (y - a.y) * ux); return t > -mmToWorld(200) && t < l + mmToWorld(200) && n < hw; } }); }
                else if (s.brush && s.brush.top !== false && s.points && s.points.length) { const P = s.points, xs = P.map(q => q.x), ys = P.map(q => q.y), r = mmToWorld((s.brush.d || 300) / 2), closed = !s.open || s.brush.poly;
                    L.push({ x0: Math.min(...xs) - r, x1: Math.max(...xs) + r, y0: Math.min(...ys) - r, y1: Math.max(...ys) + r, f: closed && P.length > 2 ? (x, y) => pointInPolygon(x, y, P) : (x, y) => P.length === 1 ? Math.hypot(x - P[0].x, y - P[0].y) < r : P.some((q, i) => i + 1 < P.length && t2SegDist({ x, y }, q, P[i + 1]) < r) }); } });
            return L.length ? (x, y) => L.some(o => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1 && o.f(x, y)) : null; }
        function v3Grass3D(root, arr, bgs, nat, drape) { const H = V3.hq; if (!H || !H.grass || !arr.length) return; const rc = H.rc, c = V3.center || { x: 0, y: 0 }, off = new THREE.Vector3(-c.x, -c.y, 0), C = rc.position.clone().sub(off);
            const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(rc.projectionMatrix, rc.matrixWorldInverse)), sp = new THREE.Sphere(), nT = arr.length / 9 | 0, E = new Float32Array(nT), Dd = new Float32Array(nT), GN = 12; let tot = 0, totN = 0, totF = 0;   // près (< 12 m) : touffes fines ; au loin : touffes simples, plus larges
            for (let t = 0; t < nT; t++) { const a = t * 9, gx = (arr[a] + arr[a + 3] + arr[a + 6]) / 3, gy = (arr[a + 1] + arr[a + 4] + arr[a + 7]) / 3, gz = (arr[a + 2] + arr[a + 5] + arr[a + 8]) / 3;
                const rad = Math.max(Math.hypot(arr[a] - gx, arr[a + 1] - gy), Math.hypot(arr[a + 3] - gx, arr[a + 4] - gy), Math.hypot(arr[a + 6] - gx, arr[a + 7] - gy)); sp.center.set(gx + off.x, gy + off.y, gz); sp.radius = rad + 0.5; if (!fr.intersectsSphere(sp)) continue;
                const ux = arr[a + 3] - arr[a], uy = arr[a + 4] - arr[a + 1], uz = arr[a + 5] - arr[a + 2], vx = arr[a + 6] - arr[a], vy = arr[a + 7] - arr[a + 1], vz = arr[a + 8] - arr[a + 2], A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
                const d = Math.max(0.5, Math.hypot(gx - C.x, gy - C.y, gz - C.z) - rad), e = A * Math.max(5, +studio.grassN || 200) * Math.min(1, Math.pow(10 / d, 1.2)); E[t] = e; Dd[t] = d; if (d < GN) totN += e; else totF += e; tot += e; }
            if (tot < 1) return; const kN = Math.min(1, H.grass / Math.max(1, totN)), kF = Math.min(1, H.grass * 5 / Math.max(1, totF)), cnt = new Uint32Array(nT); let N = 0, NN = 0; for (let t = 0; t < nT; t++) { if (!E[t]) continue; const e = E[t] * (Dd[t] < GN ? kN : kF); cnt[t] = Math.floor(e) + (Math.random() < e % 1 ? 1 : 0); N += cnt[t]; if (Dd[t] < GN) NN += cnt[t]; } if (!N) return;
            // touffe : 12 vrais brins (lames effilées en 3 tronçons, courbées vers l'extérieur, 5 à 9 mm de large) ; base sombre, pointe claire ;
            //      normales surtout vers le ciel (la touffe s'éclaire comme le sol) avec un peu de la face du brin (reflets d'un brin à l'autre)
            const tuft = (NB, S, wk) => { const bp = [], bc = [], bn = []; for (let b = 0; b < NB; b++) { const a = b / NB * Math.PI * 2 + Math.random() * 0.5, r = 0.02 + Math.random() * 0.07, x0 = Math.cos(a) * r, y0 = Math.sin(a) * r, w = 0.018 + Math.random() * 0.012, h = 0.6 + Math.random() * 0.5, lean = 0.18 + Math.random() * 0.4, tw = (Math.random() - 0.5) * 0.8;
                const dx = Math.cos(a + tw), dy = Math.sin(a + tw), px = -dy, py = dx, pt = (f) => { const k = f * f * lean; return [x0 + dx * k, y0 + dy * k, h * f * (1 - 0.18 * f * lean)]; }, wd = (f) => w * wk * (1 - f) * (f < 0.15 && S > 1 ? 0.7 + 2 * f : 1);
                const nx = px * 0.35, ny = py * 0.35, nl = Math.hypot(nx, ny, 0.94), sh = (f) => 0.62 + 0.5 * f;
                for (let k = 0; k < S; k++) { const f0 = k / S, f1 = (k + 1) / S, A = pt(f0), B = pt(f1), w0 = wd(f0), w1 = wd(f1);
                    const L0 = [A[0] - px * w0, A[1] - py * w0, A[2]], R0 = [A[0] + px * w0, A[1] + py * w0, A[2]], L1 = [B[0] - px * w1, B[1] - py * w1, B[2]], R1 = [B[0] + px * w1, B[1] + py * w1, B[2]];
                    bp.push(...L0, ...R0, ...R1, ...L0, ...R1, ...L1); [f0, f0, f1, f0, f1, f1].forEach(f => { const c = sh(f); bc.push(c, c, c); bn.push(nx / nl, ny / nl, 0.94 / nl); }); } }
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3)); return g; };
            const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), imN = new THREE.InstancedMesh(tuft(10, 2, 1), mat, Math.max(1, NN)), imF = new THREE.InstancedMesh(tuft(6, 1, 1.6), mat, Math.max(1, N - NN)), im = imN, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color(), Z = new THREE.Vector3(0, 0, 1);
            const NS = v3NoSow();
            const WT = shapes.filter(w => (w.river || w.water) && w.points && w.points.length > 2).map(w => { const xs = w.points.map(q => q.x), ys = w.points.map(q => q.y); return { P: w.points, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; }), wet = (x, y) => WT.some(w => x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1 && pointInPolygon(x, y, w.P));   // pas d'herbe sous l'eau
            const avg = texAvg('pelouse'), g0 = new THREE.Color(((avg >> 16) & 255) / 255, ((avg >> 8) & 255) / 255, (avg & 255) / 255), gA = bgs && bgs.length ? bgGreenAvg(bgs) : null; if (gA) g0.setRGB(gA[0] / 255, gA[1] / 255, gA[2] / 255); let iN = 0, iF = 0;
            for (let t = 0; t < nT; t++) for (let m = 0; m < cnt[t]; m++) { const a = t * 9, near = Dd[t] < GN, wd = near ? 1 : Math.min(2.5, Math.sqrt(Dd[t] / GN)), im = near ? imN : imF, i = near ? iN : iF; if (i >= im.instanceMatrix.count) continue; let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v;
                const x = arr[a] * w + arr[a + 3] * u + arr[a + 6] * v, y = arr[a + 1] * w + arr[a + 4] * u + arr[a + 7] * v, z = arr[a + 2] * w + arr[a + 5] * u + arr[a + 8] * v;
                if (WT.length && wet(mmToWorld(x * 1000), mmToWorld(-y * 1000))) continue; if (NS && NS(mmToWorld(x * 1000), mmToWorld(-y * 1000))) continue; let col = null; if (bgs && bgs.length) { const pq = bgPixAt(mmToWorld(x * 1000), mmToWorld(-y * 1000), bgs); if (pq) { if (isGreenPx(pq)) col = cc.setRGB(pq[0] / 255, pq[1] / 255, pq[2] / 255).multiplyScalar(1.08); else if (isGrassyPx(pq)) col = cc.setRGB((pq[0] / 255 + g0.r) / 2, (pq[1] / 255 + g0.g) / 2, (pq[2] / 255 + g0.b) / 2); else if (drape && nat && nat[t]) continue; } }   /* herbe sèche, ombre d'arbre : l'herbe pousse, teinte mêlée */   // terrain naturel sous la photo drapée : pas d'herbe sur ce qui n'est pas vert (allée, toit…)
                if (!col) col = cc.copy(g0).offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.12);
                const s = (0.6 + Math.random() * 0.8) * Math.max(0.02, (+studio.grassH || 12) / 100) / 0.85; q.setFromAxisAngle(Z, Math.random() * Math.PI * 2); sc.set(s * wd, s * wd, s); ps.set(x, y, z - 0.01); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); if (im.setColorAt) im.setColorAt(i, col); if (near) iN++; else iF++; }
            [[imN, iN], [imF, iF]].forEach(([im, n]) => { im.count = n; if (!n) return; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.grass = true; root.add(im); }); }
        // terre en relief : grains, graviers, cailloux ou blocs posés sur la terre (talus, déblais, remblais) ; taille selon la granulométrie,
        //      serrés près de la caméra, plus rares au loin (et pas plus loin que ce que l'œil distingue pour cette taille), couleurs de la terre
        function v3Earth3D(root, arr) { const Hq = V3.hq; if (!Hq || !Hq.earth || !arr.length) return; const dm = stGranD(), d0 = dm * 0.45, d1 = dm * 1.6, cov = 0.22 * stEarthMul();
            const rc = Hq.rc, c = V3.center || { x: 0, y: 0 }, off = new THREE.Vector3(-c.x, -c.y, 0), C = rc.position.clone().sub(off), R0 = Math.max(1.5, Math.min(25, dm * 180)), perM2 = cov / (Math.PI * dm * dm / 4);
            const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(rc.projectionMatrix, rc.matrixWorldInverse)), sp = new THREE.Sphere(), nT = arr.length / 9 | 0, E = new Float32Array(nT); let tot = 0;
            for (let t = 0; t < nT; t++) { const a = t * 9, gx = (arr[a] + arr[a + 3] + arr[a + 6]) / 3, gy = (arr[a + 1] + arr[a + 4] + arr[a + 7]) / 3, gz = (arr[a + 2] + arr[a + 5] + arr[a + 8]) / 3, rad = Math.max(Math.hypot(arr[a] - gx, arr[a + 1] - gy, arr[a + 2] - gz), Math.hypot(arr[a + 3] - gx, arr[a + 4] - gy, arr[a + 5] - gz), Math.hypot(arr[a + 6] - gx, arr[a + 7] - gy, arr[a + 8] - gz));
                sp.center.set(gx + off.x, gy + off.y, gz); sp.radius = rad + 0.3; if (!fr.intersectsSphere(sp)) continue;
                const ux = arr[a + 3] - arr[a], uy = arr[a + 4] - arr[a + 1], uz = arr[a + 5] - arr[a + 2], vx = arr[a + 6] - arr[a], vy = arr[a + 7] - arr[a + 1], vz = arr[a + 8] - arr[a + 2], A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
                const d = Math.max(0.3, Math.hypot(gx - C.x, gy - C.y, gz - C.z) - rad); if (d > R0 * 6) continue; const e = A * perM2 * Math.min(1, Math.pow(R0 / d, 2)); E[t] = e; tot += e; }
            if (tot < 1) return; const k = Math.min(1, Hq.grass / tot), avg = texAvg('terre'), base = studio.earthCol ? new THREE.Color(studio.earthCol) : new THREE.Color(((avg >> 16) & 255) / 255, ((avg >> 8) & 255) / 255, (avg & 255) / 255), grey = new THREE.Color(0x8a8378);
            // trois formes de pierres (icosaèdres cabossés, aplatis), facettes nettes
            const shapes3 = [0, 1, 2].map(v => { const g = new THREE.IcosahedronGeometry(1, stGranD() >= 0.1 ? 1 : 0), p = g.attributes.position, J = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!J.has(key)) J.set(key, 0.72 + Math.random() * 0.5); const f = J.get(key); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f * 0.62); } g.computeVertexNormals(); return g; });
            const per = [[], [], []]; for (let t = 0; t < nT; t++) { if (!E[t]) continue; const e = E[t] * k, n = Math.floor(e) + (Math.random() < e % 1 ? 1 : 0); for (let m = 0; m < n; m++) per[(Math.random() * 3) | 0].push(t); }
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color(), NS = v3NoSow();
            per.forEach((L, v) => { if (!L.length) return; const im = new THREE.InstancedMesh(shapes3[v], new THREE.MeshLambertMaterial({ flatShading: true }), L.length);
                L.forEach((t, i) => { const a = t * 9; let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; } const z0 = 1 - u - w, D = d0 + Math.pow(Math.random(), 1.8) * (d1 - d0), r = NS && NS(mmToWorld((arr[a] * z0 + arr[a + 3] * u + arr[a + 6] * w) * 1000), mmToWorld(-(arr[a + 1] * z0 + arr[a + 4] * u + arr[a + 7] * w) * 1000)) ? 0 : D / 2;
                    ps.set(arr[a] * z0 + arr[a + 3] * u + arr[a + 6] * w, arr[a + 1] * z0 + arr[a + 4] * u + arr[a + 7] * w, arr[a + 2] * z0 + arr[a + 5] * u + arr[a + 8] * w - r * 0.25);
                    eu.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, Math.random() * 6.283); q.setFromEuler(eu); sc.set(r * (0.8 + Math.random() * 0.5), r * (0.8 + Math.random() * 0.5), r); m4.compose(ps, q, sc); im.setMatrixAt(i, m4);
                    cc.copy(base).lerp(grey, Math.random() * 0.6).offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.18); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.grain = true; root.add(im); }); }
        // ---- eau et rives du rendu : vaguelettes (carte de relief de petites ondes croisées), reflets du ciel et des berges (capturés autour de l'eau),
        //      rochers posés le long du bord de l'eau (plus gros pour une grande rivière), touffes de roseaux par îlots
        let WAVE_TEX = null;
        function waveTex() { if (WAVE_TEX) return WAVE_TEX; const N = 256, h = new Float32Array(N * N), c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N); let S = 11; const R = () => (S = (S * 16807) % 2147483647) / 2147483647;
            const W = Array.from({ length: 14 }, () => { const a = R() * Math.PI * 2, k = 1 + Math.floor(R() * 7); return { kx: Math.round(Math.cos(a) * k), ky: Math.round(Math.sin(a) * k), p: R() * 6.283, a: 1 / (1 + k * 0.6) }; });
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; W.forEach(w => { v += w.a * Math.sin((w.kx * i + w.ky * j) / N * Math.PI * 2 + w.p); }); h[j * N + i] = v; }
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const dx = h[j * N + (i + 1) % N] - h[j * N + (i + N - 1) % N], dy = h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i], l = Math.hypot(dx, dy, 0.5), k = (j * N + i) * 4;
                im.data[k] = (0.5 - dx / l * 0.5) * 255; im.data[k + 1] = (0.5 - dy / l * 0.5) * 255; im.data[k + 2] = (0.5 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
            x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return (WAVE_TEX = t); }
        function v3WaterMat() { if (!V3.hq || !V3.hq.wave) return null; if (V3.hq.waterMat) return V3.hq.waterMat;
            const m = new THREE.MeshPhongMaterial({ color: 0x24525e, specular: 0xbfd8e8, shininess: 90, normalMap: waveTex(), normalScale: new THREE.Vector2(0.2, 0.2), transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false, combine: THREE.MixOperation, reflectivity: 0.55 });
            /* reflet en miroir (rendu) : la scène vue depuis le dessous du plan d'eau, recalculée à chaque passe : maisons, arbres, berges et personnes proches s'y reflètent à leur place, troublés par les vaguelettes */
            const U = { reflTex: { value: null }, reflMat: { value: new THREE.Matrix4() }, reflOn: { value: 0 } }; m.userData.refl = U;
            m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
                sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform mat4 reflMat; varying vec4 vRefl;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n vRefl = reflMat * modelMatrix * vec4(transformed, 1.0);');
                sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D reflTex; uniform float reflOn; varying vec4 vRefl;\nvoid main() {').replace('#include <envmap_fragment>', `#include <envmap_fragment>
                    if (reflOn > 0.5) { vec2 ruv = vRefl.xy / vRefl.w + normal.xy * 0.035; vec3 rcol = texture2D(reflTex, clamp(ruv, 0.001, 0.999)).rgb; float cosv = abs(dot(normalize(vViewPosition), normal)); float fr = 0.3 + 0.6 * pow(1.0 - cosv, 2.5); outgoingLight = mix(outgoingLight, rcol, fr); }`); };
            m.customProgramCacheKey = () => 'waterRefl'; return (V3.hq.waterMat = m); }
        // miroir de l'eau pour une passe de rendu : caméra symétrique sous le plan z = P.z, rendu dans P.rt (sans l'eau, coupé sous le plan)
        function rdReflUpdate(R, P, cam) { cam.updateMatrixWorld(); const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld), dir = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld), up = new THREE.Vector3(0, 1, 0).transformDirection(cam.matrixWorld), z = P.z;
            const mc = P.cam; mc.position.set(cp.x, cp.y, 2 * z - cp.z); mc.up.set(up.x, up.y, -up.z); mc.lookAt(cp.x + dir.x, cp.y + dir.y, 2 * z - (cp.z + dir.z)); mc.near = cam.near; mc.far = cam.far; mc.projectionMatrix.copy(cam.projectionMatrix); mc.projectionMatrixInverse.copy(cam.projectionMatrixInverse); mc.updateMatrixWorld();
            mc.matrixWorldInverse.copy(mc.matrixWorld).invert(); P.U.reflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
            const cl = R.clippingPlanes; R.clippingPlanes = (cl || []).concat([new THREE.Plane(new THREE.Vector3(0, 0, 1), -z + 0.005)]); P.W.forEach(o => { o.visible = false; }); P.U.reflOn.value = 0;
            v3EnvPlace(mc); R.setRenderTarget(P.rt); R.clear(); R.render(V3.scene, mc); R.setRenderTarget(null); P.W.forEach(o => { o.visible = true; }); R.clippingPlanes = cl; P.U.reflTex.value = P.rt.texture; P.U.reflOn.value = 1; }
        // E : bords de l'eau (listes de [x, y, z] de la scène) ; w : largeur de la rivière (m)
        /* fond de l'eau (rendu studio, « Fond : rochers, algues, poissons ») : des galets et blocs posés sur le fond, des algues qui montent sans crever la surface,
           quelques poissons entre deux eaux ; seulement là où l'eau a au moins 15 cm. pts = contour (plan), wz(x, y) = niveau de l'eau (mm) */
        function v3WaterBed(root, pts, wz, P, Zm) { if (!pts || pts.length < 3) return; const xs = pts.map(q => q.x), ys = pts.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), st = mmToWorld(700), rnd = Math.random;
            if ((x1 - x0) / st * (y1 - y0) / st > 400000) return; const rocks = [], algae = [], fish = [];
            for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) { const px = x + (rnd() - 0.5) * st, py = y + (rnd() - 0.5) * st; if (!pointInPolygon(px, py, pts)) continue;
                const gz = groundZAt(px, py, false), w = wz(px, py); if (!hasZ(gz) || !isFinite(w)) continue; const dep = w - gz; if (dep < 150) continue; const p = P(px, py), zb = Zm(gz), zw = Zm(w), zs = (zw - zb) / dep;   /* m de scène par mm */
                if (rnd() < 0.3) rocks.push([p.x, p.y, zb, (0.06 + Math.pow(rnd(), 2) * 0.32), zs]);
                if (rnd() < 0.35) algae.push([p.x, p.y, zb, Math.min(dep * 0.8, 300 + rnd() * 1100) * zs]);
                if (dep > 400 && rnd() < 0.025) fish.push([p.x, p.y, zb + (0.25 + rnd() * 0.5) * (zw - zb), Math.min((zw - zb) * 0.3, 0.12 + rnd() * 0.25)]); }
            if (rocks.length > 6000) rocks.length = 6000; if (algae.length > 8000) algae.length = 8000; if (fish.length > 300) fish.length = 300;
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color();
            if (rocks.length) { const g = new THREE.IcosahedronGeometry(1, 1), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const f = 0.78 + ((Math.sin(pa.getX(i) * 12.9 + pa.getY(i) * 78.2 + pa.getZ(i) * 37.7) * 43758.5) % 1 + 1) % 1 * 0.4; pa.setXYZ(i, pa.getX(i) * f, pa.getY(i) * f, pa.getZ(i) * f * 0.6); } g.computeVertexNormals();
                const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ flatShading: true }), rocks.length), c0 = new THREE.Color(0x7a7b6c), c1 = new THREE.Color(0x4f5a48);
                rocks.forEach(([x, y, z, r], i) => { ps.set(x, y, z + r * 0.15); eu.set((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, rnd() * 6.283); q.setFromEuler(eu); sc.set(r * (0.8 + rnd() * 0.7), r * (0.8 + rnd() * 0.5), r); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); cc.copy(c0).lerp(c1, rnd()); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.bed = true; root.add(im); }
            if (algae.length) { const bp = [];   /* une algue : ruban ondulé de 6 tronçons, de hauteur 1 (mise à l'échelle par instance) */
                for (let k = 0; k < 6; k++) { const f0 = k / 6, f1 = (k + 1) / 6, o0 = Math.sin(f0 * 7) * 0.08 * f0, o1 = Math.sin(f1 * 7) * 0.08 * f1, w0 = 0.035 * (1 - f0 * 0.7), w1 = 0.035 * (1 - f1 * 0.7);
                    bp.push(o0 - w0, 0, f0, o0 + w0, 0, f0, o1 + w1, 0, f1, o0 - w0, 0, f0, o1 + w1, 0, f1, o1 - w1, 0, f1); }
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.computeVertexNormals();
                const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), algae.length), c0 = new THREE.Color(0x2f6b2a), c1 = new THREE.Color(0x6b8f2a);
                algae.forEach(([x, y, z, h], i) => { ps.set(x, y, z); eu.set((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25, rnd() * 6.283); q.setFromEuler(eu); const s2 = 0.6 + rnd() * 0.9; sc.set(s2, s2, h); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); cc.copy(c0).lerp(c1, rnd()); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.bed = true; root.add(im); }
            if (fish.length) { const body = new THREE.SphereGeometry(1, 10, 6); body.scale(1, 0.32, 0.42); const bp = Array.from(body.toNonIndexed().attributes.position.array); bp.push(-0.85, 0, 0, -1.5, 0, 0.45, -1.5, 0, -0.45, -0.85, 0, 0, -1.5, 0, -0.45, -1.5, 0, 0.45);   /* corps + queue */
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.computeVertexNormals();
                const im = new THREE.InstancedMesh(g, new THREE.MeshPhongMaterial({ shininess: 60, side: THREE.DoubleSide }), fish.length), C = [0xc0c7cf, 0xd97706, 0x9ca3af, 0x8a9a5b, 0xf59e0b];
                fish.forEach(([x, y, z, L], i) => { ps.set(x, y, z); eu.set((rnd() - 0.5) * 0.2, 0, rnd() * 6.283); q.setFromEuler(eu); sc.set(L, L, L); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); cc.set(C[Math.floor(rnd() * C.length)]); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.bed = true; im.userData.fish = true; root.add(im); } }
        function v3RiverBanks(root, E, w) { const k = Math.max(0.6, Math.min(3, Math.sqrt(w) / 2)), rocks = [], reeds = [], rnd = Math.random;
            E.forEach(L => { for (let i = 0; i + 1 < L.length; i++) { const a = L[i], b = L[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-6) continue; const nx = -dy / l, ny = dx / l;
                    const nR = Math.round(l * 1.4 * (0.5 + rnd())); for (let m = 0; m < nR; m++) { const f = rnd(), o = (rnd() - 0.45) * 1.2 * k; rocks.push([a[0] + dx * f + nx * o, a[1] + dy * f + ny * o, a[2] + (b[2] - a[2]) * f, (0.12 + Math.pow(rnd(), 2.2) * 0.5) * k]); }
                    if (rnd() < 0.3 * l / 3) { const f = rnd(), cx = a[0] + dx * f, cy = a[1] + dy * f, cz = a[2] + (b[2] - a[2]) * f, sd = rnd() < 0.5 ? 1 : -1, nn = 8 + Math.floor(rnd() * 22);
                        for (let m = 0; m < nn; m++) { const u = (rnd() - 0.5) * 2.4, v = sd * (0.2 + rnd() * 1.1); reeds.push([cx + dx / l * u + nx * v, cy + dy / l * u + ny * v, cz]); } } } });
            const mx = Math.max(1, (V3.hq && V3.hq.grass ? V3.hq.grass : 60000) / 4); if (rocks.length > mx) rocks.length = mx; if (reeds.length > mx / 3) reeds.length = Math.floor(mx / 3);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color();
            if (rocks.length) { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, J = new Map(); for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!J.has(key)) J.set(key, 0.75 + rnd() * 0.45); const f = J.get(key); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f * 0.7); } g.computeVertexNormals();
                const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ flatShading: true }), rocks.length), c0 = new THREE.Color(0x8d8a82), c1 = new THREE.Color(0x6b6155);
                rocks.forEach(([x, y, z, r], i) => { ps.set(x, y, z - r * 0.35); eu.set((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, rnd() * 6.283); q.setFromEuler(eu); sc.set(r * (0.8 + rnd() * 0.6), r * (0.8 + rnd() * 0.5), r); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); cc.copy(c0).lerp(c1, rnd()).offsetHSL(0, 0, (rnd() - 0.5) * 0.15); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.rock = true; root.add(im); }
            if (reeds.length) { const bp = [], bc = [], bn = []; for (let b = 0; b < 5; b++) { const a = rnd() * 6.283, h = 0.75 + rnd() * 0.5, lean = 0.05 + rnd() * 0.12, w = 0.012 + rnd() * 0.006, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, x0 = (rnd() - 0.5) * 0.08, y0 = (rnd() - 0.5) * 0.08;
                    for (let k2 = 0; k2 < 4; k2++) { const f0 = k2 / 4, f1 = (k2 + 1) / 4, P0 = [x0 + dx * f0 * f0 * lean, y0 + dy * f0 * f0 * lean, h * f0], P1 = [x0 + dx * f1 * f1 * lean, y0 + dy * f1 * f1 * lean, h * f1], w0 = w * (1 - f0 * 0.85), w1 = w * (1 - f1 * 0.85);
                        bp.push(P0[0] - px * w0, P0[1] - py * w0, P0[2], P0[0] + px * w0, P0[1] + py * w0, P0[2], P1[0] + px * w1, P1[1] + py * w1, P1[2], P0[0] - px * w0, P0[1] - py * w0, P0[2], P1[0] + px * w1, P1[1] + py * w1, P1[2], P1[0] - px * w1, P1[1] - py * w1, P1[2]);
                        [f0, f0, f1, f0, f1, f1].forEach(f => { const v = 0.55 + 0.6 * f; bc.push(v, v, v); bn.push(px * 0.4, py * 0.4, 0.92); }); }
                    if (rnd() < 0.6) { const T = [x0 + dx * lean, y0 + dy * lean, h * 0.82]; for (let k2 = 0; k2 < 6; k2++) { const a2 = k2 / 6 * 6.283, r = 0.022; bp.push(T[0], T[1], T[2] - 0.09, T[0] + Math.cos(a2) * r, T[1] + Math.sin(a2) * r, T[2], T[0] + Math.cos(a2 + 1.05) * r, T[1] + Math.sin(a2 + 1.05) * r, T[2]); bc.push(0.42, 0.28, 0.16, 0.42, 0.28, 0.16, 0.42, 0.28, 0.16); bn.push(0, 0, 1, 0, 0, 1, 0, 0, 1); } } }   // massette brune en tête
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
                const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), reeds.length), c0 = new THREE.Color(0x6f8a3c), c1 = new THREE.Color(0x9c9a52);
                reeds.forEach(([x, y, z], i) => { const s = 0.8 + rnd() * 0.6; ps.set(x, y, z - 0.15); q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd() * 6.283); sc.set(s, s, s); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); cc.copy(c0).lerp(c1, rnd() * 0.7); if (im.setColorAt) im.setColorAt(i, cc); });
                im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.reed = true; root.add(im); } }
        // houppier détaillé : plusieurs boules bosselées fondues ensemble, ombrées par en dessous ; niveau 1 = le houppier simple de la vue
        function boisCrownGeo(lv) { if (lv <= 1) return null; const det = lv >= 3 ? 3 : 2, L = lv >= 3 ? [[0, 0, 0, 0.78], [0.42, 0.1, 0.05, 0.55], [-0.38, 0.22, 0.1, 0.55], [0.05, -0.42, 0.08, 0.55], [0.1, 0.15, 0.42, 0.5], [-0.22, -0.2, -0.28, 0.5], [0.3, -0.2, -0.25, 0.5]] : [[0, 0, 0, 0.8], [0.38, 0.12, 0.05, 0.55], [-0.32, 0.25, 0.12, 0.55], [0.02, -0.4, 0.1, 0.55]];
            const P = [], N = [], Cl = []; L.forEach(([ox, oy, oz, r], li) => { const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), n = 1 + 0.09 * Math.sin(x * 7.3 + li) * Math.cos(y * 6.1 + z * 5.7) + 0.05 * Math.sin(z * 13 + x * 9 + li * 2);
                    const X = ox + x * r * n, Y = oy + y * r * n, Zz = oz + z * r * n; P.push(X, Y, Zz); const l = Math.hypot(x, y, z) || 1; N.push(x / l, y / l, z / l); const sh = 0.62 + 0.38 * Math.max(0, Math.min(1, (Zz + 1) / 2)); Cl.push(sh, sh, sh); } g.dispose(); });
            const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); G.setAttribute('color', new THREE.Float32BufferAttribute(Cl, 3)); G.scale(0.85, 0.85, 0.85); return G; }
        async function open3D() { const ownL = !mcLoad.on; if (ownL) await mcLoad.open('Vue 3D', ['Vue 3D']); else mcLoad.ready();
            try { await open3D_(); } finally { if (ownL) mcLoad.close(); } }
        async function open3D_() { { const ex = document.getElementById('v3-exag'); if (ex && ex.value !== '1') ex.value = '1'; }   /* relief à ses vraies proportions (l'exagération n'est plus proposée) */
 mcLoad.set(mcLoad.names.length - 1, null, 'Ouverture de la vue 3D…');
            try { await loadPolyClip(); } catch (e) {}   // emprise des parois (voiles épais, angles)
            if (layoutOn) toggleLayout(false);
            const el = document.getElementById('view3d'), r3 = document.getElementById('v3-rose');
            if (r3) { r3.innerHTML = roseSVG(-45, 0.6 * 180 / Math.PI, '3d'); r3.dataset.k = ''; }   // dessinée tout de suite (pas de rosace vide pendant le chargement)
            el.style.display = 'block'; place3D(); refresh3DButton(); v3Band(false); setTimeout(() => v3Band(true), 80);   // le bandeau d'affichage se déplie du haut
            try { await loadThree(); }
            catch (err) { document.getElementById('v3-info').textContent = 'Impossible d\'ouvrir la vue 3D : ' + err.message; return; }
            if (!V3) init3D();
            mcLoad.say(mcLoad.funT ? mcLoad.txt : 'Construction de la scène 3D…'); await mcLoad.ready();
            V3.keepCenter = false; place3D(); build3DScene(); v3Sky(); fit3D(); v3PinRestore(); render3D(); V3.keepCenter = true;
            if (realOn() && !REAL && realSite()) realLoad();
            updateCommandMessageText('VUE 3D : Espace ou l\'onglet « Volet 3D » au bord droit = volet de la vue 3D (affichage, outils : mesurer, collisions, peindre ; décor, studio photo) · glisser = tourner · clic droit = déplacer · molette = zoom · Échap = retour au plan.');
            if (brushTool && brushTool.view !== '3d') { brushTool.view = '3d'; brushPanel(); brushMsg(); }
        }
        // Y dans la vue 3D : réglages de l'objet cliqué (altitudes, épaisseurs…) ; une menuiserie cliquée ouvre la fenêtre Ouverture
        function v3ParamSel() { if (V3 && V3.pickOp && selectedShapes.length === 1 && selectedShapes[0] === V3.pickOp.host) { openingDialog(V3.pickOp.host, V3.pickOp.o, false); return; }
            if (!selectedShapes.length) { updateCommandMessageText('VUE 3D : cliquez d\'abord un objet (mur, dalle, plateforme, menuiserie…), puis Y pour ses réglages.'); return; } openSelectionParamModal(); }
        function close3D() { if (lp3D.live) { lp3DLeave(); return; } { const sp = document.getElementById('t2-panel'); if (sp && sp.dataset.kind === 'studio') t2PanelClose(); } if (V3 && V3.fps) { V3.fps = null; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} const h = document.getElementById('v3-fps'); if (h) h.style.display = 'none'; document.body.classList.remove('v3fps'); } if (brushTool && !brushSwitching) brushStop(true); document.getElementById('view3d').style.display = 'none'; if (V3) V3.anim = null; refresh3DButton(); if (D3_MODES.has(mode) && mode !== 'select-box' && typeof d3Reset === 'function') { d3Reset(); setMode('select-box'); } try { draw(); } catch (e) {} }
        function toggle3D() { if (is3DOpen()) close3D(); else open3D(); }
        const EYE_ON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z"/><circle cx="12" cy="12" r="6.3" fill="currentColor" fill-opacity=".22"/><text x="12" y="15" text-anchor="middle" font-size="8.6" font-weight="700" fill="currentColor" stroke="none" font-family="Arial,sans-serif">3D</text></svg>', EYE_OFF = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 13c2.5 3 5.8 4.5 9.5 4.5s7-1.5 9.5-4.5"/><path d="M5 15.6l-1.4 2M9 17.2l-.6 2.2M15 17.2l.6 2.2M19 15.6l1.4 2"/><text x="12" y="11" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="Arial,sans-serif">3D</text></svg>';
        function refresh3DButton() { document.body.classList.toggle('v3on', is3DOpen()); try { setTimeout(lvlPlace, 0); } catch (e) {} const b = document.getElementById('btn-view3d'); if (!b) return; const on = is3DOpen(); b.classList.toggle('active', on); b.innerHTML = on ? EYE_ON : EYE_OFF; }
        const is3DOpen = () => document.getElementById('view3d').style.display === 'block';
        function init3D() {
            const host = document.getElementById('v3-host');
            const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x111827);
            host.appendChild(renderer.domElement);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1e6); camera.up.set(0, 0, 1);
            const amb = new THREE.AmbientLight(0xffffff, 0.65); scene.add(amb);
            const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-0.5, -0.8, 1.2); scene.add(sun);
            V3 = { renderer, scene, camera, sun, amb, root: null, target: new THREE.Vector3(), az: Math.PI * 1.25, el: 0.6, dist: 100, anim: null, labels: [], R: 50 };
            // souris : gauche = orbite, droit / molette enfoncée = déplacer, molette = zoom
            const cv = renderer.domElement; let drag = null;
            cv.addEventListener('contextmenu', e => e.preventDefault());
            cv.addEventListener('pointerdown', e => { if (V3.fps) { if (e.button === 2) { if (texPaint) { fpsPaintStop(); return; } fpsPause(e); return; } if (V3.fps.paused) { if (texPaint && e.button === 0) drag = { b: 'fpaint', x0: e.clientX, y0: e.clientY }; return; } if (document.pointerLockElement === cv) { fpsDoor(); return; } drag = { b: 'fps', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; try { { const pl = cv.requestPointerLock(); if (pl && pl.catch) pl.catch(() => {}); } } catch (er) {} return; } const br = brushTool && e.button === 0 && !e.shiftKey && !e.altKey; drag = { b: br ? 'brush' : e.button, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} V3.anim = null; if (br) brushDown(e); });
            cv.addEventListener('pointermove', e => {
                if (V3.fps) { if (document.pointerLockElement === cv) fpsLook(e.movementX || 0, e.movementY || 0); else if (drag) { fpsLook(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; } return; }
                if (brushTool && (!drag || drag.b === 'brush')) { const dn = !!drag; V3.brEv = { clientX: e.clientX, clientY: e.clientY }; if (!V3.brRaf) V3.brRaf = requestAnimationFrame(() => { V3.brRaf = 0; const ev = V3.brEv; if (!brushTool || !ev) return; if (dn) brushMove(ev); else v3BrushCursor(v3BrushHit(ev)); }); return; }
                if (!drag || (drag.b === 0 && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4)) { if (!lp3D.live) d3Hover(e); if (!drag) return; }
                if (drag.b === 0 && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
                if (drag.b === 0) { V3.az -= dx * 0.008; V3.el = Math.max(-0.2, Math.min(Math.PI / 2 - 0.002, V3.el + dy * 0.008)); }
                else {
                    const k = V3.dist * 0.0018, right = new THREE.Vector3(), up = new THREE.Vector3();
                    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
                    if (V3.pin) { if (!V3.pinWarn) { V3.pinWarn = 1; updateCommandMessageText('VUE 3D : point d\'ancrage posé, la vue reste centrée sur lui (drapeau de la rosace pour le retirer).'); } } else
                    V3.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
                }
                render3DSoon(true);
            });
            cv.addEventListener('pointerup', (e) => { const d = drag; drag = null; v3FullRes(); if (V3.fps) { if (d && d.b === 'fpaint' && texPaint && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) { pick3D(e); return; } if (d && d.b === 'fps' && document.pointerLockElement !== cv && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) fpsDoor(); return; } if (d && d.b === 'brush') { brushUp(); return; } if (d && d.b === 1 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4 && d3ColCycle(e)) return;   /* clic molette sur une zone de collision */ if (d && d.b === 0 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4 && !lp3D.live) { if (V3.pinPick) { v3PinAt(e); return; } if (d3Active()) d3Click(e); else pick3D(e); } });
            cv.addEventListener('dblclick', (e) => { if (lp3D.live || V3.fps) return; if (mode === 'pline' && d3Active()) { d3Finish(); return; } if (brushTool || d3Active()) return; const r = cv.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V3.camera);
                const h = ray.intersectObjects(V3.root.children, true).find(x => x.object.userData && (x.object.userData.opening || x.object.userData.shape)); if (!h) return;
                if (h.object.userData.opening) { const o = h.object.userData.opening, host = shapes.find(x => (x.openings || []).includes(o)); if (host) openingDialog(host, o, false); } else { selectedShapes = [h.object.userData.shape]; openSelectionParamModal(); } });
            cv.addEventListener('pointerleave', () => d3Mark(null));
            cv.addEventListener('wheel', e => { e.preventDefault(); if (V3.fps) return; V3.dist *= e.deltaY < 0 ? 0.88 : 1.14; V3.dist = Math.max(V3.R * 0.01, Math.min(V3.R * 50, V3.dist)); render3DSoon(true); }, { passive: false });
            window.addEventListener('resize', () => { if (lp3D.live) { lp3D.pk = ''; draw(); } else if (is3DOpen()) place3D(); });
        }
