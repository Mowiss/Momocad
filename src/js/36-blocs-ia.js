        // =====================================================================
        // IMPORTER UN BLOC : la sélection devient un bloc du catalogue, rangé dans un dossier (existant ou nouveau)
        // =====================================================================
        let blkPending = null;
        try { const ct = JSON.parse(localStorage.getItem('momocad-blk-tabs') || '[]'); if (Array.isArray(ct)) ct.forEach(t => { if (t && t.id && !BLK_TABS.some(x => x.id === t.id)) BLK_TABS.splice(BLK_TABS.length - 1, 0, t); }); } catch (e) {}
        function blkSaveTabs() { try { localStorage.setItem('momocad-blk-tabs', JSON.stringify(BLK_TABS.filter(t => t.user))); } catch (e) {} }
        function startBlockImport() {
            closeFileMenus();
            const sel = selectedShapes.filter(x => ['line', 'poly', 'circle', 'arc'].includes(x.type) && !x.solid);
            if (!sel.length) { setMode('select-box'); updateCommandMessageText('IMPORTER UN BLOC : sélectionnez d\'abord le dessin (droites, polylignes, cercles, arcs), puis recliquez ce bouton.'); return; }
            const tabs = BLK_TABS.filter(t => t.id !== 'paroi'), esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const inp = 'background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:6px 9px;outline:none;';
            openTopoModal('📥 Importer un bloc', `<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:#e5e7eb;min-width:340px">
                <div style="color:#9ca3af">${sel.length} objet(s) sélectionné(s) vont devenir un bloc du catalogue, réutilisable dans tous vos plans (et gardé dans le gabarit).</div>
                <label style="display:flex;flex-direction:column;gap:4px">Nom du bloc<input id="bi-name" type="text" placeholder="ex. Regard 1000, Candélabre, Banc…" style="${inp}"></label>
                <label style="display:flex;flex-direction:column;gap:4px">Dossier de classement<select id="bi-tab" style="${inp}" onchange="document.getElementById('bi-new').style.display=this.value==='__new'?'flex':'none'">${tabs.map(t => `<option value="${t.id}" ${t.id === blkTab ? 'selected' : ''}>${t.ico} ${esc(t.name)}</option>`).join('')}<option value="__new">＋ Nouveau dossier…</option></select></label>
                <div id="bi-new" style="display:none;gap:8px"><input id="bi-ico" type="text" value="📁" maxlength="4" title="Icône (un emoji)" style="${inp}width:56px;text-align:center"><input id="bi-tname" type="text" placeholder="Nom du dossier (ex. Réseaux, VRD…)" style="${inp}flex:1"></div>
                <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input id="bi-rep" type="checkbox" checked> Remplacer la sélection par le bloc (verrouillé)</label>
                <div style="color:#9ca3af;font-size:12px">Ensuite, cliquez le <b>point d'insertion</b> : c'est le point qui suivra la souris quand vous poserez le bloc (un coin, un centre…).</div></div>`,
                [['Annuler', closeTopoModal, false], ['Choisir le point d\'insertion', () => {
                    const name = document.getElementById('bi-name').value.trim(); let tab = document.getElementById('bi-tab').value;
                    if (!name) { document.getElementById('bi-name').focus(); return; }
                    if (tab === '__new') { const tn = document.getElementById('bi-tname').value.trim(); if (!tn) { document.getElementById('bi-tname').focus(); return; }
                        const t = { id: 'ut' + Date.now().toString(36), ico: (document.getElementById('bi-ico').value.trim() || '📁'), name: tn, user: 1 }; BLK_TABS.splice(BLK_TABS.length - 1, 0, t); blkSaveTabs(); tab = t.id; }
                    blkPending = { name, tab, sel, rep: document.getElementById('bi-rep').checked }; closeTopoModal(); setMode('blkbase'); selectedShapes = sel; draw();
                }, true]]);
            setTimeout(() => { const n = document.getElementById('bi-name'); if (n) n.focus(); }, 40);
        }
        function blkBaseClick(w) {
            const P = blkPending; if (!P) return; const p = t2Pt(w.x, w.y), D = 180 / Math.PI, L = (wx, wy) => [Math.round(worldToMm(wx - p.x) * 10) / 10, Math.round(-worldToMm(wy - p.y) * 10) / 10];
            const el = P.sel.map(x => x.type === 'line' ? ['L', ...L(x.x1, x.y1), ...L(x.x2, x.y2)] : x.type === 'poly' ? ['P', x.points.map(q => L(q.x, q.y)), x.open ? 0 : 1]
                : x.type === 'circle' ? ['C', ...L(x.x, x.y), worldToMm(x.r)] : (() => { const s0 = x.anticlockwise ? x.endAngle : x.startAngle, s1 = x.anticlockwise ? x.startAngle : x.endAngle; return ['A', ...L(x.x, x.y), worldToMm(x.r), -s1 * D, -s0 * D]; })());
            const b = { id: 'u' + Date.now().toString(36), tab: P.tab, name: P.name, el, user: 1 };
            userBlocks.push(b); try { localStorage.setItem('momocad-blocks', JSON.stringify(userBlocks)); } catch (err) { alert('Bloc ajouté pour cette session, mais trop gros pour être mémorisé sur ce poste.'); }
            if (P.rep) { const gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), out = blockShapes(b, p.x, p.y, 1, 0), lid = blockLayerId(b); out.forEach(sh => { sh.groupId = gid; sh.block = b.name; sh.layerId = lid; }); shapes = shapes.filter(x => !P.sel.includes(x)).concat(out); saveState(); selectedShapes = out; }
            blkTab = P.tab; try { localStorage.setItem('momocad-blk-tab', P.tab); } catch (e) {}
            const tn = (BLK_TABS.find(t => t.id === P.tab) || {}).name || ''; blkPending = null; setMode('select-box'); draw();
            updateCommandMessageText('IMPORTER UN BLOC : « ' + b.name + ' » est rangé dans le dossier « ' + tn + ' » du catalogue' + (P.rep ? ' et la sélection est devenue ce bloc' : '') + '. Enregistrez le gabarit pour le partager.');
        }
        // ---- tutos : gabarit « fantôme » du dessin à reproduire (pointillés) ; ses points s'accrochent ----
        var tutoGhost = null;   // { items: [{ t:'line'|'poly'|'circle'|'arc'|'pt'|'arrow', …, cur, label, lp }], pts: [{x,y}] }
        function drawTutoGhost(c) {
            const Gh = tutoGhost; if (!Gh || !Gh.items) return; const z = camera.zoom;
            c.save();
            Gh.items.forEach(it => {
                c.globalAlpha = it.cur ? 0.95 : 0.35; c.strokeStyle = it.cur ? '#fbbf24' : '#4ade80'; c.lineWidth = (it.cur ? 2.2 : 1.4) / z; c.setLineDash(it.cur ? [7 / z, 5 / z] : [3 / z, 4 / z]);
                c.beginPath();
                if (it.t === 'line' || it.t === 'arrow') { c.moveTo(it.a.x, it.a.y); c.lineTo(it.b.x, it.b.y); }
                else if (it.t === 'poly') { it.pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); if (it.closed) c.closePath(); }
                else if (it.t === 'circle') c.arc(it.c.x, it.c.y, it.r, 0, 2 * Math.PI);
                else if (it.t === 'arc') c.arc(it.c.x, it.c.y, it.r, it.a0, it.a1, false);
                c.stroke();
                if (it.t === 'arrow') { const an = Math.atan2(it.b.y - it.a.y, it.b.x - it.a.x), h = 10 / z; c.setLineDash([]); c.beginPath(); c.moveTo(it.b.x - h * Math.cos(an - 0.4), it.b.y - h * Math.sin(an - 0.4)); c.lineTo(it.b.x, it.b.y); c.lineTo(it.b.x - h * Math.cos(an + 0.4), it.b.y - h * Math.sin(an + 0.4)); c.stroke(); }
                if (it.cur) { c.setLineDash([]); c.fillStyle = '#fbbf24'; (it.snap || []).forEach(q => { c.beginPath(); c.arc(q.x, q.y, 3.5 / z, 0, 2 * Math.PI); c.fill(); }); }
            });
            c.restore();
            Gh.items.forEach(it => { if (it.cur && it.label && it.lp) t2Label(c, it.lp.x, it.lp.y, it.label, '#fde68a'); });
        }
        try { refreshPolarBtn(); } catch (e) {}
        // =====================================================================
        // MOMO, AIDE DE CHANTIER : un chat avec une IA (Gemini ou Claude) directement dans MomoCAD.
        // La clé API reste sur ce poste (localStorage), jamais dans le .mmc ni le gabarit.
        // À chaque question, MomoCAD envoie au fournisseur : le guide (pour l'usage du logiciel) et un résumé du plan en cours.
        // =====================================================================
        const IA_MODELS = {
            gemini: [['gemini-flash-latest', 'Gemini Flash (dernier, offre gratuite possible)'], ['gemini-3.5-flash', 'Gemini 3.5 Flash'], ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite (très rapide)'], ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro (aperçu)']],
            claude: [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (conseillé)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (rapide, économique)'], ['claude-opus-5-5', 'Claude Opus 5.5 (le plus fort)']],
        };
        let iaCfg = { on: false, provider: 'gemini', model: 'gemini-flash-latest', key: '' };
        try { Object.assign(iaCfg, JSON.parse(localStorage.getItem('momocad-ia') || '{}')); } catch (e) {}
        if (!IA_MODELS[iaCfg.provider]) iaCfg.provider = 'gemini';
        // chaque fournisseur garde sa clé et son modèle : on peut basculer de l'un à l'autre sans tout ressaisir
        iaCfg.store = iaCfg.store || {}; iaCfg.store[iaCfg.provider] = { key: iaCfg.key || '', model: iaCfg.model };
        const IA_PROV = {
            gemini: { name: 'Gemini', who: 'Google', ph: 'AIza…', link: 'https://aistudio.google.com/app/api-keys', site: 'Google AI Studio', def: 'gemini-flash-latest',
                need: 'une <b>clé Gemini</b> : clique sur le bouton ci-dessous, crée ta clé (gratuite pour commencer), copie-la et colle-la ici.',
                note: 'Ta question et un résumé du plan partent chez Google ; avec une clé gratuite, Google peut s\'en servir pour améliorer ses services : rien de confidentiel.' },
            claude: { name: 'Claude', who: 'Anthropic', ph: 'sk-ant-…', link: 'https://console.anthropic.com/settings/keys', site: 'la console Anthropic', def: 'claude-sonnet-5-5',
                need: 'une <b>clé Claude</b> : clique sur le bouton ci-dessous, crée ta clé dans la console Anthropic, copie-la et colle-la ici. Claude est payant à l\'usage : il faut un peu de crédit sur ton compte (quelques centimes par question).',
                note: 'Ta question et un résumé du plan partent chez Anthropic, qui facture chaque question sur ton crédit. Rien de confidentiel quand même.' },
        };
        function iaSetProvider(p) {
            if (!IA_PROV[p] || p === iaCfg.provider) return;
            iaCfg.store[iaCfg.provider] = { key: iaCfg.key || '', model: iaCfg.model };
            const o = iaCfg.store[p] || {}; iaCfg.provider = p; iaCfg.key = o.key || ''; iaCfg.model = o.model || IA_PROV[p].def;
            try { mcHist = []; } catch (e) {}   // l'historique d'un fournisseur ne se relit pas chez l'autre
            iaSave(true); try { iaFormRender(); } catch (e) {} try { psIaRender(); } catch (e) {}
        }
        const iaProvSwitch = () => `<div class="ia-seg">${Object.keys(IA_PROV).map(p => `<button type="button" class="${iaCfg.provider === p ? 'on' : ''}" onclick="iaSetProvider('${p}')">${p === 'gemini' ? '✦ ' : '✳ '}${IA_PROV[p].name}</button>`).join('')}</div>`;
        function iaSave(quiet) { try { iaCfg.store = iaCfg.store || {}; iaCfg.store[iaCfg.provider] = { key: iaCfg.key || '', model: iaCfg.model }; localStorage.setItem('momocad-ia', JSON.stringify(iaCfg)); } catch (e) {} if (!quiet) mcRefresh(); }
        const iaEsc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

        // ---------- onglet Assistant des Paramètres ----------
        // réglages de Momo IA, dans sa bulle (bouton ⚙, ou d'office tant qu'il n'a pas de clé)
        function iaFormRender() {
            const box = document.getElementById('mc-set'); if (!box) return;
            const M = IA_MODELS[iaCfg.provider] || [], known = M.some(m => m[0] === iaCfg.model);
            const PV = IA_PROV[iaCfg.provider];
            box.innerHTML = `<div class="mc-m mc-a" style="max-width:100%"><p>${iaCfg.key ? 'Ma clé n\'est pas acceptée : vérifie-la ou colles-en une autre, puis <b>Tester</b>.' : 'Pour réfléchir, il me faut ' + PV.need}</p></div>
                <div class="grid gap-3" style="grid-template-columns:5.5rem 1fr;align-items:center;font-size:13px">
                    <span>Mon cerveau</span><div>${iaProvSwitch()}</div>
                    <span>Modèle</span>
                    <select id="ia-model" class="ps-input" style="min-width:0" onchange="iaCfg.model=this.value;iaSave(true)">${M.map(m => `<option value="${m[0]}" ${m[0] === iaCfg.model ? 'selected' : ''}>${iaEsc(m[1])}</option>`).join('')}${known ? '' : `<option value="${iaEsc(iaCfg.model)}" selected>${iaEsc(iaCfg.model)}</option>`}</select>
                    <span>Clé API</span>
                    <div class="flex gap-2"><input id="ia-key" type="password" autocomplete="off" spellcheck="false" class="ps-input flex-1 font-mono" placeholder="${PV.ph}" value="${iaEsc(iaCfg.key)}" oninput="iaCfg.key=this.value.trim();iaSave(true)">
                        <button type="button" class="ps-btn" title="Afficher / masquer la clé" onclick="const k=document.getElementById('ia-key');k.type=k.type==='password'?'text':'password'">👁</button>
                        <button type="button" class="ps-btn" onclick="iaTest()">Tester</button></div>
                </div>
                <div id="ia-test" class="ps-sub mt-2" style="min-height:1.2em"></div>
                <a href="${PV.link}" target="_blank" rel="noopener" class="ps-btn inline-flex items-center gap-2 mt-1" style="text-decoration:none">🔑 Obtenir ma clé sur ${PV.site} ↗</a>
                <p class="mt-3" style="font-size:12px;color:#9ca3af;line-height:1.5">La clé reste <b>sur ce poste</b>. ${PV.note} Tu pourras changer de cerveau plus tard dans ⛯ Paramètres › Momo IA. Momo peut se tromper : ses conseils techniques se vérifient.</p>`;
        }
        function psIaRender() {
            const box = document.getElementById('ps-ia-box'); if (!box) return;
            const M = IA_MODELS[iaCfg.provider] || [], known = M.some(m => m[0] === iaCfg.model), k = iaCfg.key || '', PV = IA_PROV[iaCfg.provider];
            const rb = (v, t, d) => `<label class="flex items-start gap-3 cursor-pointer py-1"><input type="radio" name="ia-perm" value="${v}" ${iaCfg.perm === v ? 'checked' : ''} onchange="iaCfg.perm=this.value;agAllowSession=false;iaSave(true)" style="margin-top:4px"><span><b class="text-white">${t}</b><br><span class="ps-sub">${d}</span></span></label>`;
            box.innerHTML = `<div class="grid gap-3" style="grid-template-columns:9rem 1fr;align-items:center">
                    <span>Fournisseur</span><div>${iaProvSwitch()}<div class="ps-sub mt-1">${iaCfg.provider === 'claude' ? 'Claude (Anthropic) : payant à l\'usage, sur ton crédit.' : 'Gemini (Google) : offre gratuite possible.'} Chaque fournisseur garde sa propre clé.</div></div>
                    <span>Clé API ${PV.name}</span>
                    <div class="flex gap-2 items-center"><input id="ps-ia-key" type="password" autocomplete="off" spellcheck="false" class="ps-input flex-1 font-mono" placeholder="Aucune clé : colle-la ici" value="${iaEsc(k)}" oninput="iaCfg.key=this.value.trim();iaSave(true)">
                        <button type="button" class="ps-btn" title="Afficher / masquer la clé" onclick="const e=document.getElementById('ps-ia-key');e.type=e.type==='password'?'text':'password'">👁</button>
                        <button type="button" class="ps-btn" onclick="iaTest('ps-ia-test')">Tester</button>
                        <button type="button" class="ps-btn" style="color:#fca5a5" onclick="if(confirm('Effacer la clé de Momo IA sur ce poste ?')){iaCfg.key='';iaSave();psIaRender();}">Effacer</button></div>
                    <span>Modèle</span>
                    <select class="ps-input" onchange="iaCfg.model=this.value;iaSave(true)">${M.map(m => `<option value="${m[0]}" ${m[0] === iaCfg.model ? 'selected' : ''}>${iaEsc(m[1])}</option>`).join('')}${known ? '' : `<option selected>${iaEsc(iaCfg.model)}</option>`}</select>
                </div>
                <div id="ps-ia-test" class="ps-sub mt-2" style="min-height:1.2em">${k ? 'Clé enregistrée sur ce poste : …' + iaEsc(k.slice(-4)) : 'Aucune clé enregistrée.'}</div>
                <a href="${PV.link}" target="_blank" rel="noopener" class="ps-btn inline-flex items-center gap-2 mt-1" style="text-decoration:none">🔑 Gérer mes clés sur ${PV.site} ↗</a>
                <div class="ps-h mt-6">Ce que Momo peut faire sur ton plan</div>
                <div class="mt-2">${rb('off', 'Lecture seule', 'Il lit ton plan et te conseille, mais ne touche à rien.')}${rb('ask', 'Il demande avant chaque modification (conseillé)', 'Il te propose chaque action (tracer, déplacer, supprimer…) avec Autoriser / Refuser.')}${rb('auto', 'Il modifie sans demander', 'Il agit directement. Chaque action reste annulable avec Ctrl+Z.')}</div>
                <p class="ps-sub mt-4">La clé reste sur ce poste : elle ne part ni dans le .mmc ni dans le gabarit.</p>`;
        }
        async function iaTest(outId) {
            const out = document.getElementById(outId || 'ia-test'); if (!out) return;
            if (!iaCfg.key) { out.innerHTML = '<span style="color:#fca5a5">Colle d\'abord ta clé API.</span>'; return; }
            out.textContent = 'Test en cours…';
            try { const t0 = performance.now(); const t = await iaCall([{ role: 'user', text: 'Réponds juste « OK chantier ! »' }], 'Tu es un test de connexion.', null, 400); out.innerHTML = '<span style="color:#86efac">✓ Connexion réussie en ' + ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s : « ' + iaEsc(t.trim().slice(0, 60)) + ' »</span>' + ((performance.now() - t0) > 8000 ? '<br><span style="color:#fbbf24">Le service répond lentement avec ce modèle (serveurs chargés ou offre gratuite limitée) : essaie un autre modèle, le plus rapide est Flash-Lite.</span>' : ''); if (!outId) setTimeout(() => mcSettings(false), 1400); }
            catch (e) { out.innerHTML = '<span style="color:#fca5a5">✗ ' + iaEsc(e.message) + '</span>'; }
        }

        // ---------- appel du fournisseur (réponse affichée au fil de l'eau) ----------
        async function iaReadSSE(res, pick) {
            const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', out = '';
            for (;;) {
                const { value, done } = await rd.read(); if (done) break;
                buf += dec.decode(value, { stream: true });
                let i; while ((i = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
                    if (!line.startsWith('data:')) continue; const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue;
                    let j; try { j = JSON.parse(d); } catch (e) { continue; }
                    const t = pick(j); if (t) { out += t; if (iaCall.onDelta) iaCall.onDelta(out); }
                }
            }
            return out;
        }
        function iaErr(status, body) {
            const m = (body && (body.error && (body.error.message || body.error.type))) || '';
            if (status === 400 && /api key|API_KEY/i.test(m)) return 'Clé API refusée : vérifie-la dans la bulle de Momo IA.';
            if (iaCfg.provider === 'claude' && /credit balance/i.test(m)) return 'Crédit Claude épuisé : ajoute du crédit sur ton compte Anthropic (console), puis réessaie.';
            if (status === 401 || status === 403) return 'Clé API refusée ou sans droit sur ce modèle (' + status + ').';
            if (status === 404) return 'Modèle introuvable : choisis-en un autre dans la bulle de Momo IA.';
            if (status === 429) return 'Quota dépassé (trop de questions d\'un coup, ou limite gratuite atteinte). Réessaie dans un moment.';
            if (status >= 500) return 'Le service du fournisseur ne répond pas (' + status + '). Réessaie plus tard.';
            return 'Erreur ' + status + (m ? ' : ' + m : '');
        }
        async function iaCall(msgs, system, onDelta, maxTok) {
            iaCall.onDelta = onDelta || null;
            if (!iaCfg.key) throw new Error('Aucune clé API : colle-la dans la bulle de Momo IA.');
            let res;
            try {
                if (iaCfg.provider === 'claude') {
                    const sys = Array.isArray(system) ? system : [{ type: 'text', text: system }];
                    res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': iaCfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                        body: JSON.stringify({ model: iaCfg.model, max_tokens: maxTok || 1500, stream: true, system: sys, messages: msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })) }) });
                } else {
                    const sysTxt = Array.isArray(system) ? system.map(b => b.text).join('\n\n') : system;
                    res = await iaGemFetch({ systemInstruction: { parts: [{ text: sysTxt }] }, contents: msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })), generationConfig: iaThink({ maxOutputTokens: maxTok || 1500 }) });
                }
            } catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Pas de connexion au service (Internet coupé, ou réseau qui bloque l\'accès).'); }
            if (!res.ok) { let b = null; try { b = await res.json(); } catch (e) {} throw new Error(iaErr(res.status, b)); }
            const txt = iaCfg.provider === 'claude'
                ? await iaReadSSE(res, j => j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' ? j.delta.text : '')
                : await iaReadSSE(res, j => ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join(''));
            if (!txt.trim()) throw new Error('Réponse vide du fournisseur.');
            return txt;
        }

        // ---------- ce que Momo sait : le guide, les boutons, et un résumé du plan ----------
        let iaGuideCache = null;
        function iaGuide() {
            if (iaGuideCache) return iaGuideCache;
            const hb = document.getElementById('help-body'); let t = '';
            if (hb) { const c = hb.cloneNode(true); c.querySelectorAll('svg, figure, .hg-palshot').forEach(x => x.remove()); c.querySelectorAll('h2, h3, li, p').forEach(x => x.insertAdjacentText('beforebegin', '\n')); t = c.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim(); }
            const btns = [...document.querySelectorAll('button[id^="btn-"]')].filter(b => (b.title || b.textContent).trim()).map(b => b.id + ' = ' + (b.title || b.textContent).replace(/\s+/g, ' ').trim().slice(0, 70));
            iaGuideCache = { guide: t.slice(0, 60000), btns: btns.join('\n') };
            return iaGuideCache;
        }
        function iaSystem() {
            const G = iaGuide();
            return `Tu es Momo, l'aide de chantier intégrée à MomoCAD, un logiciel de dessin dans le navigateur pour les travaux publics (VRD, voirie, réseaux, topographie, terrassement, métrés, maquettes 3D). Tu portes un casque de chantier.
Ton style : français, tutoiement, chaleureux et direct, phrases courtes, comme un collègue expérimenté sur le chantier. Réponses brèves (5 à 10 lignes en général), listes à puces si c'est une marche à suivre. Pas de titres. Mets en **gras** les noms d'outils et les chiffres clés.
Règles :
- Pour l'utilisation de MomoCAD, appuie-toi UNIQUEMENT sur le GUIDE ci-dessous. N'invente jamais un outil, un menu ou un raccourci. Si le guide ne dit rien, dis-le simplement.
- Ne parle d'aucun autre logiciel de dessin ou de CAO.
- Pour montrer un bouton de l'interface, écris son identifiant entre doubles crochets, par exemple [[btn-circle]] : MomoCAD l'affichera comme un bouton cliquable qui s'allume à l'écran. N'utilise que des identifiants de la LISTE DES BOUTONS.
- Pour les questions sur le plan en cours, sers-toi du RÉSUMÉ DU PLAN (fourni à chaque question). Cite les chiffres avec leur unité. S'il manque une info, dis ce qu'il faudrait dessiner ou régler pour l'obtenir.
- Pour les conseils métier (pentes, structures, talus, réseaux, normes), donne des ordres de grandeur prudents et rappelle qu'ils se vérifient (étude géotechnique, CCTP, guides techniques).
${iaCfg.perm === 'off' ? '- Tu ne peux pas modifier le plan toi-même : tu expliques les gestes à faire.' : `- Tu peux MODIFIER LE PLAN avec les fonctions fournies (tracer, écrire, créer un calque, sélectionner, déplacer, changer de calque, supprimer, plateforme). Coordonnées en mètres dans le repère du plan (X vers la droite, Y vers le haut), les mêmes que celles affichées en bas de l'écran : appuie-toi sur l'EMPRISE DU DESSIN du résumé pour placer les objets. ${iaCfg.perm === 'ask' ? 'L\'utilisateur valide chaque modification ; s\'il refuse, n\'insiste pas. ' : ''}Annonce en une phrase ce que tu vas faire, agis, puis résume ce qui a été fait. Ne supprime rien sans demande explicite. Si la demande est floue (taille, position), pose d'abord la question.\n- Tu PEUX VOIR les images de fond du plan (photos, scans, PDF importés) : appelle regarder_image. Pour décalquer une forme (silhouette, contour, bâtiment, voirie…), regarde l'image puis appelle tracer_sur_image avec des points en pixels de l'image reçue, assez nombreux pour suivre fidèlement la forme (30 à 120 par contour). Plusieurs contours = plusieurs appels. Pour une forme complexe, travaille EN PLUSIEURS FOIS : décalque morceau par morceau (une partie de la crête, puis la suivante…), puis rappelle regarder_image : ce que tu as déjà tracé y apparaît EN ROUGE par-dessus l'image. Compare et complète ou corrige (au besoin, sélectionne et supprime un tracé raté, puis retrace-le) jusqu'à ce que ce soit fidèle ; deux ou trois vérifications suffisent. Ne dis jamais que tu ne peux pas voir une image de fond.`}
- Quand tu expliques un geste, une action par ligne, dans l'ordre : d'abord « Sélectionne … » si un objet doit être choisi, puis « Clique sur l'outil … », puis « Tape … au clavier, puis Espace », puis « Clique sur … ». Rappelle que Espace valide en gardant l'outil et qu'Entrée valide et quitte l'outil.

=== LISTE DES BOUTONS (identifiant = rôle) ===
${G.btns}

=== GUIDE DE MOMOCAD ===
${G.guide}`;
        }
        function iaPlan() {
            const f2 = (v) => nfr(v, 2), out = [];
            try {
                out.push('Fichier : ' + (fileName || 'sans titre') + ' · ' + shapes.length + ' objet(s) · unité d\'affichage : ' + currentUnit + ' · calque actif : ' + ((layers.find(l => l.id === activeLayerId) || {}).name || '?'));
                const vis = shapes.filter(s => !isBg(s) && !s.gen); const bb = vis.length ? getShapesBoundingBox(vis) : null;
                if (bb) out.push('Emprise du dessin (m, repère du plan) : X de ' + agR(W2M(bb.minX)) + ' à ' + agR(W2M(bb.maxX)) + ', Y de ' + agR(W2M(bb.maxY, 'y')) + ' à ' + agR(W2M(bb.minY, 'y')));
                else out.push('Le plan est vide. Origine du repère : (' + agR(geoOrigin.x / 1000) + ' ; ' + agR(geoOrigin.y / 1000) + ').');
                out.push('Calques : ' + layers.map(l => l.name + (l.id === activeLayerId ? ' (actif)' : '')).join(', '));
                const M = metreData(false);
                if (M.length) { out.push('Calques (métré) :'); M.forEach(r => out.push('- ' + r.name + ' : ' + r.obj + ' objet(s)' + (r.lin ? ', longueurs ' + f2(r.lin) + ' m' : '') + (r.ferm ? ', surfaces fermées ' + f2(r.ferm) + ' m²' : '') + (r.hach ? ', hachures ' + f2(r.hach) + ' m²' : '') + (r.pts ? ', ' + r.pts + ' point(s)' : '') + (r.vol ? ', volumes 3D ' + f2(r.vol) + ' m³' : ''))); }
                const blk = {}; shapes.forEach(s => { if (s.block) blk[s.block] = (blk[s.block] || 0) + 1; });
                const bk = Object.keys(blk); if (bk.length) out.push('Blocs posés (éléments de dessin) : ' + bk.map(k => k + ' ×' + blk[k]).join(', '));
                const P = shapes.filter(isPlateforme);
                if (P.length) {
                    out.push('Plateformes :');
                    P.forEach(p => { const t = platTalus(p), z = p.type === 'circle' ? p.z : p.points[0].z; out.push('- ' + (platName(p) || 'plateforme') + ' : Z ' + fmtZ(z) + ' m, surface ' + f2(shapeAreaM2(p)) + ' m², talus ' + (t.on ? 'remblai ' + t.kR + ' / déblai ' + t.kD : 'aucun') + (p.struct && p.struct.layers.length ? ', structure : ' + p.struct.layers.map(l => (structMat(l.mat).name || l.mat) + ' ' + l.e + ' cm').join(' + ') : '')); });
                    const Q = metreQuant();
                    if (Q && !Q.err) { out.push('Terrassement et matériaux (cubatures) :'); Q.rows.forEach(r => { const v = metreQRowVals(r); out.push('- ' + v.join(' | ')); }); if (Q.priced) out.push('Total HT : ' + f2(Q.total) + ' €'); }
                }
                const pts = shapes.filter(s => s.type === 'point' && hasZ(s.z)); if (pts.length) { const Z = pts.map(s => s.z); out.push('Terrain : ' + pts.length + ' points cotés, Z de ' + fmtZ(Math.min(...Z)) + ' à ' + fmtZ(Math.max(...Z)) + ' m'); }
                const tx = shapes.filter(s => (s.type === 'text' || s.type === 'detail') && s.content).slice(0, 25).map(s => String(s.content).replace(/\s+/g, ' ').slice(0, 40));
                if (tx.length) out.push('Textes du plan : ' + tx.join(' · '));
                if (selectedShapes.length) {
                    out.push('Sélection : ' + selectedShapes.length + ' objet(s)');
                    selectedShapes.slice(0, 5).forEach(s => { const L = (layers.find(l => l.id === (s.layerId || 'layer-0')) || {}).name || '';
                        let d = '- ' + (s.solid ? SOLID_NAMES[s.solid.kind] || 'volume' : s.type) + ' sur « ' + L + ' »';
                        try { const l = shapeLengthM(s), a = shapeAreaM2(s); if (l) d += ', longueur ' + f2(l) + ' m'; if (a) d += ', surface ' + f2(a) + ' m²'; if (s.type === 'circle') d += ', rayon ' + f2(mOf(s.r)) + ' m'; if (s.solid) d += ', volume ' + f2(solidVolume(s)) + ' m³'; } catch (e) {}
                        out.push(d); });
                }
                const IM = agImgs(); if (IM.length) out.push('Images de fond (tu peux les regarder avec regarder_image, et les décalquer avec tracer_sur_image) : ' + IM.map((im, k) => (k + 1) + '. « ' + (im.name || 'image') + ' »').join(', '));
                out.push('Outil en cours : ' + mode);
            } catch (e) { out.push('(résumé partiel : ' + e.message + ')'); }
            return out.join('\n').slice(0, 9000);
        }

        // ---------- l'interface : Momo au casque, et sa bulle de discussion ----------
        const MC_SVG = `<svg viewBox="0 0 100 122" xmlns="http://www.w3.org/2000/svg" aria-label="Momo, aide de chantier">
            <defs><linearGradient id="mcHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#eab308"/></linearGradient></defs>
            <path d="M18 38 Q18 8 50 8 Q82 8 82 38 Z" fill="url(#mcHat)" stroke="#a16207" stroke-width="1.6"/>
            <path d="M43 9.5 Q50 7.5 57 9.5 L58 38 L42 38 Z" fill="#facc15" stroke="#a16207" stroke-width="1.2"/>
            <rect x="8" y="36" width="84" height="8" rx="4" fill="#eab308" stroke="#a16207" stroke-width="1.6"/>
            <circle class="mc-eye" cx="32" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
            <circle class="mc-eye" cx="68" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
            <path class="mc-mouth" d="M36 116 L36 88 L50 104 L64 88 L64 116" fill="none" stroke="#a1a1aa" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
        let mcMsgs = [], mcBusy = false, mcOpen = false, mcNews = false;
        // pastille de Momo IA réduit : … au repos, ⚙️ qui tourne pendant qu'il réfléchit, ! rouge quand une réponse (ou une autorisation) l'attend
        function mcHint() {
            const h = document.getElementById('mc-hint'); if (!h) return;
            if (mcOpen) mcNews = false;
            const wait = mcMsgs.some(m => (m.acts || []).some(a => a.answer));
            const st = !mcOpen && (mcNews || wait) ? 'news' : (mcBusy ? 'busy' : '');
            if (h.dataset.st === st) return; h.dataset.st = st;
            h.className = st; h.innerHTML = st === 'busy' ? '<i>⚙️</i>' : st === 'news' ? '!' : '…';
            h.title = st === 'busy' ? 'Momo réfléchit…' : st === 'news' ? 'Momo a répondu : clique pour lire' : '';
        }
        function mcEl() { return document.getElementById('mc-root'); }
        function mcRefresh() {
            let r = mcEl();
            const tuto = false;
            if (!momoOn || momoMode !== 'ia') { if (r) r.style.display = 'none'; return; }
            if (!r) {
                r = document.createElement('div'); r.id = 'mc-root';
                r.innerHTML = `<div id="mc-panel"><div class="mc-h"><span>👷 Momo IA · aide de chantier</span><span style="display:flex;align-items:center"><button type="button" title="Retour au choix : tuto ou question" onclick="momoGoHome()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg></button><button type="button" id="mc-pin" title="Épingler : la bulle reste figée par-dessus tous les menus" onclick="mcPin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg></button><button type="button" title="Réduire la bulle" onclick="mcToggle(false)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 18h14"/></svg></button></span></div>
                    <div id="mc-set"></div><div id="mc-log"></div>
                    <div id="mc-sugg"></div>
                    <div class="mc-in"><textarea id="mc-q" rows="2" placeholder="Pose ta question… (Entrée pour envoyer)"></textarea><button type="button" id="mc-send" title="Envoyer" onclick="mcSendBtn()">➤</button></div></div>
                    <div id="mc-momo" title="Momo, aide de chantier : clique pour lui parler">${MC_SVG}<span id="mc-hint">…</span></div><div id="mc-mini" title="Clique pour voir ce que fait Momo"></div>`;
                (document.getElementById('canvas-container') || document.body).appendChild(r);
                r.querySelector('#mc-momo').addEventListener('click', () => mcToggle());
                r.querySelector('#mc-mini').addEventListener('click', () => mcToggle(true));
                const q = r.querySelector('#mc-q');
                ['keydown', 'keyup', 'keypress'].forEach(ev => r.addEventListener(ev, e => e.stopPropagation()));
                q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight + 2, 130) + 'px'; });
                q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mcSend(); } if (e.key === 'Escape') { e.preventDefault(); mcToggle(false); } });
                r.addEventListener('mousedown', e => e.stopPropagation());
                r.addEventListener('wheel', e => e.stopPropagation());
                r.querySelector('#mc-log').addEventListener('click', e => { const g = e.target.closest('[data-ag]'); if (g) { const [mi, k, v] = g.dataset.ag.split(':'); const act = ((mcMsgs[+mi] || {}).acts || [])[+k]; if (act && act.answer) { const f = act.answer; act.answer = null; act.state = 'wait'; f(v); mcRenderLog(); } return; } const b = e.target.closest('[data-mcbtn]'); if (b) mcShowBtn(b.dataset.mcbtn); });
                r.querySelector('#mc-sugg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { document.getElementById('mc-q').value = b.textContent; mcSend(); } });
                mcRenderLog();
            }
            r.style.display = ''; r.classList.toggle('open', mcOpen); r.classList.toggle('pinned', mcPinned); r.classList.toggle('next', tuto);
            if (!iaCfg.key) mcSet = true; const showSet = mcSet; r.classList.toggle('set', showSet); const sb = document.getElementById('mc-set'); if (sb && showSet && !sb.dataset.on) { sb.dataset.on = '1'; iaFormRender(); } if (sb && !showSet) delete sb.dataset.on;
        }
        let mcPinned = false, mcSet = false;
        function mcSettings(v) { mcSet = v === undefined ? !mcSet : !!v; mcRefresh(); }
        function mcPin() { mcPinned = !mcPinned; const b = document.getElementById('mc-pin'); if (b) b.title = mcPinned ? 'Désépingler' : 'Épingler : la bulle reste par-dessus tous les menus'; mcRefresh(); }
        function mcToggle(v) { mcOpen = v === undefined ? !mcOpen : !!v;  mcRefresh(); mcHint(); if (mcOpen) setTimeout(() => { const q = document.getElementById('mc-q'); if (q) q.focus(); }, 30); }
        function mcClear() { if (mcBusy) return; mcMsgs = []; mcHist = []; agAllowSession = false; mcRenderLog(); }
        // texte de l'IA -> HTML sûr : gras, listes, [[btn-…]] en bouton cliquable
        function mcMd(t) {
            let h = iaEsc(t);
            h = h.replace(/\[\[(btn-[\w-]+)\]\]/g, (m, id) => { const b = document.getElementById(id); if (!b) return ''; const lab = iaEsc((b.title || b.textContent || id).split(/\n|<br>|\(| : |,/)[0].trim().slice(0, 40)); return `<button type="button" class="mc-btn" data-mcbtn="${id}" title="Montrer ce bouton">${b.innerHTML.includes('<svg') ? b.innerHTML.match(/<svg[\s\S]*?<\/svg>/)[0] : ''}<span>${lab}</span></button>`; });
            h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<kbd>$1</kbd>');
            const L = h.split('\n'), o = []; let ul = false;
            L.forEach(l => { const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/); if (m) { if (!ul) { o.push('<ul>'); ul = true; } o.push('<li>' + m[1] + '</li>'); } else { if (ul) { o.push('</ul>'); ul = false; } if (l.trim()) o.push('<p>' + l + '</p>'); } });
            if (ul) o.push('</ul>');
            return o.join('');
        }
        function mcRenderLog() {
            setTimeout(mcHint, 0);
            const log = document.getElementById('mc-log'), sg = document.getElementById('mc-sugg'); if (!log) return;
            if (!mcMsgs.length) log.innerHTML = `<div class="mc-m mc-a"><p>Salut ! C'est Momo, version chantier 👷. Pose-moi une question sur MomoCAD ou sur ton plan : je vois tes calques, tes quantités et tes cubatures.</p></div>`;
            else log.innerHTML = mcMsgs.map((m, mi) => `<div class="mc-m ${m.role === 'user' ? 'mc-u' : 'mc-a'}${m.err ? ' mc-err' : ''}">${m.role === 'user' ? '<p>' + iaEsc(m.text).replace(/\n/g, '<br>') + '</p>' : (m.text || !(m.acts && m.acts.length) ? (m.text ? mcMd(m.text) : (mcBusy && mi === mcMsgs.length - 1 ? '' : mcMd('…'))) : '') + mcActs(m, mi) + (mcBusy && m.role !== 'user' && mi === mcMsgs.length - 1 ? `<p class="mc-status"><i>⚙️</i> <span id="mc-st">${iaEsc(mcSt.txt)}</span> <span id="mc-st-t" class="mc-st-t">${Math.round((Date.now() - mcSt.t0) / 1000)} s</span></p>` : '')}</div>`).join('');
            log.scrollTop = log.scrollHeight;
            if (sg) sg.innerHTML = mcMsgs.length ? '' : ['Résume mon métré', 'Comment je coterais un regard ?', 'Vérifie mon plan avant impression', 'Quelle pente de talus en remblai ?'].map(t => `<button type="button">${t}</button>`).join('');
        }
        // les modifications proposées par Momo : à autoriser, faites, refusées
        function mcActs(m, mi) {
            if (!m.acts || !m.acts.length) return '';
            const ic = { wait: '⏳', ask: '✋', ok: '✓', no: '✗', err: '⚠️' };
            return '<div class="mc-acts">' + m.acts.map((x, k) => `<div class="mc-act mc-${x.state}"><span>${ic[x.state] || ''}</span><span>${iaEsc(x.desc)}${x.state === 'no' ? ' — refusé' : ''}</span></div>` +
                (x.state === 'ask' ? `<div class="mc-ask"><button type="button" data-ag="${mi}:${k}:yes">Autoriser</button><button type="button" data-ag="${mi}:${k}:session" title="Autoriser toutes ses modifications jusqu'à la fin de cette discussion">Toujours (cette discussion)</button><button type="button" data-ag="${mi}:${k}:no">Refuser</button></div>` : '')).join('')
                + (m.acts.some(x => x.state === 'ok') ? '<div class="mc-undo">Une modification ne te plaît pas ? ' + '<kbd>Ctrl</kbd>+<kbd>Z</kbd> l\'annule.</div>' : '') + '</div>';
        }
        function mcShowBtn(id) {
            const b = document.getElementById(id); if (!b) return;
            if (!b.offsetParent) { const pal = b.closest('.pal'); if (pal && pal.classList.contains('closed')) togglePal(pal.dataset.pal); }
            b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); if (!r.width) return;
            const ring = document.createElement('div'); ring.className = 'mc-ring'; Object.assign(ring.style, { left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
            document.body.appendChild(ring); setTimeout(() => ring.remove(), 2600);
        }
        let mcHist = [];   // historique au format Gemini (texte, appels de fonctions et leurs résultats)
        function mcHistTrim() { const u = []; mcHist.forEach((c, k) => { if (c.role === 'user' && c.parts.some(p => p.text)) u.push(k); }); if (u.length > 10) mcHist = mcHist.slice(u[u.length - 10]); }
        // pendant qu'il travaille, le bouton d'envoi devient un carré ■ : un clic arrête tout (requête en cours, autorisations en attente)
        let mcAbort = null;
        // ce que Momo est en train de faire, affiché tant qu'il n'a rien écrit ; + chien de garde : 90 s sans rien recevoir = on arrête
        const mcSt = { txt: '', t0: 0, last: 0, timer: null, timedOut: false, paused: 0 };
        function mcStatus(t) { mcSt.txt = t; mcSt.last = Date.now(); const e = document.getElementById('mc-st'); if (e) e.textContent = t; mcMini(); }
        function mcMini() {
            const r = mcEl(); if (r) r.classList.toggle('busy', !!mcBusy);
            const m = document.getElementById('mc-mini'); if (m) m.textContent = '⚙️ ' + (mcSt.txt || 'Je réfléchis…') + ' ' + Math.round((Date.now() - mcSt.t0) / 1000) + ' s';
        }
        function mcStTick() {
            const sec = Math.round((Date.now() - mcSt.t0) / 1000);
            const e = document.getElementById('mc-st-t'); if (e) e.textContent = sec + ' s'; mcMini();
            const asking = mcMsgs.some(m => (m.acts || []).some(x => x.answer));
            if (mcBusy && !asking && Date.now() - mcSt.last > 150000) { mcSt.timedOut = 'silence'; mcStop(); }
            else if (mcBusy && !asking && Date.now() - mcSt.t0 - mcSt.paused > 300000) { mcSt.timedOut = 'long'; mcStop(); }
        }
        function mcSendBtn() { if (mcBusy) mcStop(); else mcSend(); }
        function mcStop() {
            if (!mcBusy) return; mcStopped = true; try { if (mcAbort) mcAbort.abort(); } catch (e) {}
            mcMsgs.forEach(m => (m.acts || []).forEach(x => { if (x.answer) { const f = x.answer; x.answer = null; f('no'); } }));
        }
        let mcStopped = false;
        function mcBtnUpd() { const b = document.getElementById('mc-send'); if (!b) return; b.classList.toggle('stop', mcBusy); b.innerHTML = mcBusy ? '■' : '➤'; b.title = mcBusy ? 'Arrêter Momo' : 'Envoyer'; }
        async function mcSend() {
            const q = document.getElementById('mc-q'); if (!q || mcBusy) return; const text = q.value.trim(); if (!text) return;
            if (!iaCfg.key) { mcSettings(true); return; }
            if (isOffline()) { mcMsgs.push({ role: 'assistant', text: netWarn('Momo IA'), acts: [] }); mcRenderLog(); return; }
            q.value = ''; q.style.height = ''; mcMsgs.push({ role: 'user', text }); const a = { role: 'assistant', text: '', acts: [] }; mcMsgs.push(a); mcBusy = true; mcRenderLog(); mcHint();
            const momo = document.getElementById('mc-momo'); if (momo) momo.classList.add('think');
            mcHist.forEach(c => { if (c.parts.some(p => p.inlineData)) c.parts = c.parts.map(p => p.inlineData ? { text: '[image déjà regardée plus haut : la regarder à nouveau si besoin]' } : p); });
            mcHist.push({ role: 'user', parts: [{ text }] }); mcHistTrim();
            const h0 = mcHist.length - 1; mcStopped = false; mcAbort = new AbortController(); mcBtnUpd();
            mcSt.t0 = Date.now(); mcSt.paused = 0; mcSt.timedOut = false; mcStatus('J\'envoie ta question…'); clearInterval(mcSt.timer); mcSt.timer = setInterval(mcStTick, 1000);
            try {
                let before = '';
                for (let round = 0; round < 20; round++) {   // plusieurs tours : il peut tracer en plusieurs morceaux, regarder le résultat et corriger
                    const sys = iaSystem() + '\n\n=== RÉSUMÉ DU PLAN EN COURS ===\n' + iaPlan(); if (round) mcStatus('Je réfléchis… (étape ' + (round + 1) + ')');
                    const r = await (iaCfg.provider === 'claude' ? iaClaude : iaGemini)(mcHist, sys, iaCfg.perm === 'off' ? (agImgs().length ? AG_TOOLS.filter(t => t.name === 'regarder_image') : null) : AG_TOOLS, (t) => { a.text = before + t; mcRenderLog(); });
                    mcHist.push({ role: 'model', parts: r.parts });
                    before = a.text ? a.text + '\n' : '';
                    if (!r.calls.length) break;
                    const resp = [];
                    if (mcStopped) throw new Error('__stop');
                    agImgQueue = []; for (const c of r.calls) { const fr = { name: c.name, response: await agExec(c, a) }; if (c.id) fr.id = c.id; resp.push({ functionResponse: fr }); }
                    agImgQueue.forEach(im => { const ip = agImgPart(im); if (ip) { resp.push({ text: 'Voici l\'image « ' + (im.name || 'image') + ' » (' + agImgSize(im).w + ' × ' + agImgSize(im).h + ' px).' }); resp.push(ip); } }); agImgQueue = [];
                    mcHist.push({ role: 'user', parts: resp });
                }
                if (!a.text.trim() && !a.acts.length) a.text = '…';
            } catch (e) {
              if (mcStopped || e.name === 'AbortError' || e.message === '__stop') { a.text = (a.text ? a.text + '\n' : '') + (mcSt.timedOut === 'silence' ? '⏱ Pas de réponse depuis 2 min 30 : le service est peut-être saturé, ou ton quota est atteint. Réessaie dans un moment, ou change de modèle dans ⛯ Paramètres › Momo IA.' : mcSt.timedOut === 'long' ? '⏱ J\'ai travaillé 5 minutes sans finir : je m\'arrête là. Ce qui est tracé reste sur le plan. Demande-moi la suite en plus petits morceaux (par exemple « continue le décalque à droite »).' : '⏹ Arrêté.') + (a.acts.some(x => x.state === 'ok') ? ' Ce qui a déjà été fait reste sur le plan (Ctrl+Z pour l\'annuler).' : ''); mcHist = mcHist.slice(0, h0); }
              else { a.text = (a.text ? a.text + '\n' : '') + '⚠️ ' + e.message; a.err = true; mcHist = mcHist.filter(c => !(c.role === 'user' && c.parts.some(p => p.text === text))); if (/Clé API refusée|Aucune clé/.test(e.message)) setTimeout(() => mcSettings(true), 1600); } }
            clearInterval(mcSt.timer); mcBusy = false; mcMini(); mcAbort = null; mcBtnUpd(); if (momo) momo.classList.remove('think'); if (!mcOpen) mcNews = true; mcRenderLog(); mcHint();
        }

        // =====================================================================
        // MOMO IA AGIT SUR LE PLAN : fonctions proposées à Gemini (appel de fonctions), avec ta permission.
        // Permission (Paramètres ⛯ › Momo IA) : 'off' = lecture seule · 'ask' = il demande avant chaque modification · 'auto' = il modifie sans demander.
        // Chaque modification passe par l'historique : Ctrl+Z l'annule.
        // =====================================================================
        if (!iaCfg.perm) iaCfg.perm = 'ask';
        const M2W = (m, axis) => axis === 'y' ? -mmToWorld(m * 1000 - geoOrigin.y) : mmToWorld(m * 1000 - geoOrigin.x);   // mètres du plan -> monde
        const W2M = (w, axis) => axis === 'y' ? realY(w) / 1000 : realX(w) / 1000;
        const agNum = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; if (!isFinite(n)) throw new Error('valeur numérique attendue'); return n; };
        const agR = (v) => Math.round(v * 100) / 100;
        function agLayer(name, color) {
            if (!name) return activeLayerId;
            let l = layers.find(x => (x.name || '').toLowerCase() === String(name).toLowerCase());
            if (!l) { l = { id: generateId(), name: String(name), visible: true, color: color || '#ffffff', dash: 'solid', width: 1 }; layers.push(l); updateLayerUI(); }
            return l.id;
        }
        const P = (t, d, req) => ({ type: 'OBJECT', properties: t, required: req || [] }), NUM = (d) => ({ type: 'NUMBER', description: d }), STR = (d) => ({ type: 'STRING', description: d });
        const CAL = STR('nom du calque (créé s\'il n\'existe pas) ; par défaut le calque actif');
        const AG_TOOLS = [
            { name: 'creer_calque', description: 'Crée un calque (ou le retrouve s\'il existe) et en fait le calque actif.', parameters: P({ nom: STR('nom du calque'), couleur: STR('couleur hexadécimale, ex. #f59e0b') }, '', ['nom']) },
            { name: 'tracer_ligne', description: 'Trace une droite entre deux points (mètres, repère du plan).', parameters: P({ x1: NUM('X départ (m)'), y1: NUM('Y départ (m)'), x2: NUM('X arrivée (m)'), y2: NUM('Y arrivée (m)'), calque: CAL }, '', ['x1', 'y1', 'x2', 'y2']) },
            { name: 'tracer_polyligne', description: 'Trace une polyligne passant par des points, ouverte ou fermée.', parameters: P({ points: { type: 'ARRAY', description: 'liste de points', items: P({ x: NUM('X (m)'), y: NUM('Y (m)') }, '', ['x', 'y']) }, fermee: { type: 'BOOLEAN', description: 'true pour un contour fermé' }, calque: CAL }, '', ['points']) },
            { name: 'tracer_rectangle', description: 'Trace un rectangle à partir de son coin en bas à gauche.', parameters: P({ x: NUM('X du coin bas gauche (m)'), y: NUM('Y du coin bas gauche (m)'), largeur: NUM('largeur selon X (m)'), hauteur: NUM('hauteur selon Y (m)'), calque: CAL }, '', ['x', 'y', 'largeur', 'hauteur']) },
            { name: 'tracer_cercle', description: 'Trace un cercle.', parameters: P({ cx: NUM('X du centre (m)'), cy: NUM('Y du centre (m)'), rayon: NUM('rayon (m)'), calque: CAL }, '', ['cx', 'cy', 'rayon']) },
            { name: 'ecrire_texte', description: 'Écrit un texte sur le plan.', parameters: P({ x: NUM('X (m)'), y: NUM('Y (m)'), texte: STR('le texte'), calque: CAL }, '', ['x', 'y', 'texte']) },
            { name: 'selectionner', description: 'Sélectionne des objets par calque et/ou par type (line, poly, circle, arc, text, point, hatch…). Sans critère : tout le plan.', parameters: P({ calque: STR('nom du calque'), type: STR('type d\'objet') }) },
            { name: 'deplacer_selection', description: 'Déplace les objets sélectionnés.', parameters: P({ dx: NUM('déplacement en X (m)'), dy: NUM('déplacement en Y (m)') }, '', ['dx', 'dy']) },
            { name: 'changer_calque_selection', description: 'Met les objets sélectionnés sur un autre calque.', parameters: P({ calque: STR('nom du calque') }, '', ['calque']) },
            { name: 'supprimer_selection', description: 'Supprime les objets sélectionnés. Seulement si l\'utilisateur l\'a demandé.', parameters: P({}) },
            { name: 'regarder_image', description: 'Regarde une image de fond posée sur le plan (photo, scan, PDF importé) : tu la reçois juste après, avec sa taille en pixels. À appeler avant de décalquer ou de décrire une image.', parameters: P({ image: NUM('numéro de l\'image (1 = la première de la liste du résumé)') }) },
            { name: 'tracer_sur_image', description: 'Décalque : trace une polyligne sur une image de fond, avec des coordonnées en PIXELS de l\'image que tu as regardée (origine en haut à gauche, X vers la droite, Y vers le bas). MomoCAD les convertit en mètres sur le plan. Pour une silhouette ou un contour, mets 30 à 120 points qui suivent fidèlement la forme.', parameters: P({ image: NUM('numéro de l\'image'), points: { type: 'ARRAY', description: 'points en pixels de l\'image regardée', items: P({ x: NUM('X en pixels'), y: NUM('Y en pixels') }, '', ['x', 'y']) }, fermee: { type: 'BOOLEAN', description: 'true pour un contour fermé' }, calque: CAL }, '', ['points']) },
            { name: 'plateforme', description: 'Donne une altitude (Z, en m) aux contours fermés sélectionnés : ils deviennent des plateformes (talus et cubatures).', parameters: P({ z: NUM('altitude en m'), nom: STR('nom de la plateforme') }, '', ['z']) },
        ];
        // ce qu'on montre à l'utilisateur avant d'agir
        function agDescr(n, a) {
            const L = a.calque ? ' sur le calque « ' + a.calque + ' »' : '', f = (v) => nfr(agNum(v), 2);
            switch (n) {
                case 'creer_calque': return 'Créer le calque « ' + a.nom + ' » et l\'activer';
                case 'tracer_ligne': return 'Tracer une droite de (' + f(a.x1) + ' ; ' + f(a.y1) + ') à (' + f(a.x2) + ' ; ' + f(a.y2) + ')' + L;
                case 'tracer_polyligne': return 'Tracer une polyligne ' + (a.fermee ? 'fermée ' : '') + 'de ' + (a.points || []).length + ' points' + L;
                case 'tracer_rectangle': return 'Tracer un rectangle de ' + f(a.largeur) + ' × ' + f(a.hauteur) + ' m depuis (' + f(a.x) + ' ; ' + f(a.y) + ')' + L;
                case 'tracer_cercle': return 'Tracer un cercle de rayon ' + f(a.rayon) + ' m en (' + f(a.cx) + ' ; ' + f(a.cy) + ')' + L;
                case 'ecrire_texte': return 'Écrire « ' + a.texte + ' » en (' + f(a.x) + ' ; ' + f(a.y) + ')' + L;
                case 'selectionner': return 'Sélectionner ' + (a.type ? 'les « ' + a.type + ' » ' : 'les objets ') + (a.calque ? 'du calque « ' + a.calque + ' »' : 'de tout le plan');
                case 'deplacer_selection': return 'Déplacer la sélection de ' + f(a.dx) + ' m en X et ' + f(a.dy) + ' m en Y';
                case 'changer_calque_selection': return 'Mettre la sélection sur le calque « ' + a.calque + ' »';
                case 'supprimer_selection': return 'Supprimer les ' + selectedShapes.length + ' objet(s) sélectionné(s)';
                case 'regarder_image': return 'Regarder l\'image ' + (agNum(a.image) || 1) + (agImgs()[(agNum(a.image) || 1) - 1] ? ' « ' + (agImgs()[(agNum(a.image) || 1) - 1].name || 'image') + ' »' : '');
                case 'tracer_sur_image': return 'Décalquer sur l\'image ' + (agNum(a.image) || 1) + ' : une polyligne ' + (a.fermee ? 'fermée ' : '') + 'de ' + (a.points || []).length + ' points' + L;
                case 'plateforme': return 'Mettre les contours sélectionnés à Z ' + f(a.z) + ' m' + (a.nom ? ' (« ' + a.nom + ' »)' : '');
            }
            return n;
        }
        // exécution (une action = un pas d'historique)
        function agRun(n, a) {
            const add = (sh) => { shapes.push(sh); saveState(); selectedShapes = []; invalidateCache(); draw(); };
            switch (n) {
                case 'creer_calque': { activeLayerId = agLayer(a.nom, a.couleur); updateLayerUI(); saveState(); return { ok: true, calque: a.nom }; }
                case 'tracer_ligne': { add({ type: 'line', layerId: agLayer(a.calque), x1: M2W(agNum(a.x1)), y1: M2W(agNum(a.y1), 'y'), x2: M2W(agNum(a.x2)), y2: M2W(agNum(a.y2), 'y') }); return { ok: true }; }
                case 'tracer_polyligne': { const pts = (a.points || []).map(q => ({ x: M2W(agNum(q.x)), y: M2W(agNum(q.y), 'y') })); if (pts.length < 2) throw new Error('il faut au moins 2 points');
                    const sh = { type: 'poly', layerId: agLayer(a.calque), points: pts }; if (!a.fermee) sh.open = true; add(sh); return { ok: true, points: pts.length }; }
                case 'tracer_rectangle': { const x = agNum(a.x), y = agNum(a.y), w = agNum(a.largeur), h = agNum(a.hauteur);
                    add({ type: 'poly', layerId: agLayer(a.calque), points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(q => ({ x: M2W(q[0]), y: M2W(q[1], 'y') })) }); return { ok: true, surface_m2: agR(Math.abs(w * h)) }; }
                case 'tracer_cercle': { add({ type: 'circle', layerId: agLayer(a.calque), x: M2W(agNum(a.cx)), y: M2W(agNum(a.cy), 'y'), r: mmToWorld(agNum(a.rayon) * 1000) }); return { ok: true }; }
                case 'ecrire_texte': { add({ type: 'text', layerId: a.calque ? agLayer(a.calque) : TEXT_LAYER_ID, x: M2W(agNum(a.x)), y: M2W(agNum(a.y), 'y'), content: String(a.texte), size: TEXT_WORLD_SIZE }); return { ok: true }; }
                case 'selectionner': { const lid = a.calque ? (layers.find(l => (l.name || '').toLowerCase() === String(a.calque).toLowerCase()) || {}).id : null;
                    if (a.calque && !lid) return { ok: false, erreur: 'calque introuvable' };
                    selectedShapes = shapes.filter(s => !isBg(s) && !s.gen && (!lid || (s.layerId || 'layer-0') === lid) && (!a.type || s.type === a.type)); draw(); updatePropertiesPopup(); return { ok: true, nombre: selectedShapes.length }; }
                case 'deplacer_selection': { if (!selectedShapes.length) return { ok: false, erreur: 'rien de sélectionné' }; const dx = mmToWorld(agNum(a.dx) * 1000), dy = -mmToWorld(agNum(a.dy) * 1000);
                    const n0 = selectedShapes.length; selectedShapes.forEach(s => translateShape(s, dx, dy)); saveState(); selectedShapes = []; draw(); return { ok: true, deplaces: n0 }; }
                case 'changer_calque_selection': { if (!selectedShapes.length) return { ok: false, erreur: 'rien de sélectionné' }; const lid = agLayer(a.calque), n0 = selectedShapes.length;
                    selectedShapes.forEach(s => { s.layerId = lid; }); saveState(); selectedShapes = []; invalidateCache(); draw(); return { ok: true, modifies: n0 }; }
                case 'supprimer_selection': { const n0 = selectedShapes.length; if (!n0) return { ok: false, erreur: 'rien de sélectionné' }; shapes = shapes.filter(s => !selectedShapes.includes(s)); selectedShapes = []; saveState(); draw(); return { ok: true, supprimes: n0 }; }
                case 'regarder_image': { const im = agImgs()[(agNum(a.image) || 1) - 1]; if (!im) return { ok: false, erreur: 'aucune image de fond n°' + (agNum(a.image) || 1) + ' sur le plan' };
                    const d = agImgSize(im); if (!d) return { ok: false, erreur: 'image pas encore chargée, réessaie' };
                    agImgQueue.push(im); const c = bgCorners(im).map(q => '(' + agR(W2M(q.x)) + ' ; ' + agR(W2M(q.y, 'y')) + ')');
                    return { ok: true, image: (agNum(a.image) || 1), nom: im.name || '', largeur_px: d.w, hauteur_px: d.h, largeur_m: agR(W2M(im.x + im.w) - W2M(im.x)), coins_m: 'haut-gauche ' + c[0] + ', haut-droit ' + c[1] + ', bas-droit ' + c[2] + ', bas-gauche ' + c[3], note: 'l\'image arrive dans le message suivant (tes tracés déjà faits y sont en rouge) ; pour décalquer, utilise tracer_sur_image en pixels de cette image' }; }
                case 'tracer_sur_image': { const im = agImgs()[(agNum(a.image) || 1) - 1]; if (!im) return { ok: false, erreur: 'image introuvable' }; const d = agImgSize(im); if (!d) return { ok: false, erreur: 'image pas encore chargée' };
                    const c = Math.cos(im.rot || 0), sn = Math.sin(im.rot || 0);
                    const pts = (a.points || []).map(q => { const u = (agNum(q.x) / d.w - 0.5) * im.w, v = (agNum(q.y) / d.h - 0.5) * im.h; return { x: im.x + u * c - v * sn, y: im.y + u * sn + v * c }; });
                    if (pts.length < 2) throw new Error('il faut au moins 2 points');
                    const sh = { type: 'poly', layerId: agLayer(a.calque), points: pts }; if (!a.fermee) sh.open = true; add(sh); return { ok: true, points: pts.length }; }
                case 'plateforme': { const ok = selectedShapes.filter(s => s.type === 'poly' && !s.open && !s.solid && s.points.length >= 3); if (!ok.length) return { ok: false, erreur: 'sélectionne d\'abord un contour fermé' };
                    const z = agNum(a.z) * 1000; ok.forEach(s => { s.points.forEach(q => { q.z = z; }); s.zk = 1; if (a.nom) s.pfName = String(a.nom); }); saveState(); selectedShapes = []; invalidateCache(); draw(); refresh3D(); return { ok: true, plateformes: ok.length }; }
            }
            return { ok: false, erreur: 'fonction inconnue' };
        }
        let agAllowSession = false;
        // les images de fond que Momo peut regarder : réduites à 1024 px max (même échelle pour regarder et pour décalquer)
        const agImgs = () => shapes.filter(s => s.type === 'bgimage' && basemapStore[s.mapId]);
        let agImgQueue = [];
        function agImgSize(im) { const i = bmImg(im.mapId); if (!i) return null; const k = Math.min(1, 1024 / Math.max(i.naturalWidth, i.naturalHeight)); return { w: Math.round(i.naturalWidth * k), h: Math.round(i.naturalHeight * k), img: i }; }
        function agImgPart(im) { const d = agImgSize(im); if (!d) return null; const cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, d.w, d.h); c.drawImage(d.img, 0, 0, d.w, d.h);
            // ce qui est déjà dessiné par-dessus, en rouge : Momo compare et corrige
            const P = (q) => { const l = bgLocal(im, q.x, q.y); return [(l.x / im.w + 0.5) * d.w, (l.y / im.h + 0.5) * d.h]; };
            c.strokeStyle = '#ff1744'; c.lineWidth = Math.max(2, d.w / 400); c.lineJoin = 'round';
            shapes.forEach(s => { if (s.gen || isBg(s)) return; let L = null;
                if (s.type === 'poly' && s.points.length > 1) L = s.points.concat(s.open ? [] : [s.points[0]]); else if (s.type === 'line') L = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
                if (!L) return; c.beginPath(); L.forEach((q, k) => { const [x, y] = P(q); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); });
            return { inlineData: { mimeType: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.85).split(',')[1] } }; }
        async function agExec(call, msg) {
            const n = call.name, a = call.args || {};
            let desc; try { desc = agDescr(n, a); } catch (e) { desc = n; }
            msg.acts = msg.acts || [];
            const act = { desc, state: 'wait' }; msg.acts.push(act); mcRenderLog(); mcStatus(n === 'regarder_image' ? 'Je regarde l\'image…' : 'Je travaille sur ton plan…');
            const needAsk = iaCfg.perm === 'ask' && !agAllowSession && !['selectionner', 'regarder_image'].includes(n);
            if (needAsk) {
                act.state = 'ask'; mcRenderLog(); const tw = Date.now();
                const v = await new Promise(res => { act.answer = res; }); mcSt.paused += Date.now() - tw; mcSt.last = Date.now();
                if (v === 'session') agAllowSession = true;
                if (v === 'no') { act.state = 'no'; mcRenderLog(); return { ok: false, refuse: 'L\'utilisateur a refusé cette modification.' }; }
            }
            try { const r = agRun(n, a); act.state = r.ok === false ? 'err' : 'ok'; if (r.ok === false) act.desc += ' — ' + (r.erreur || 'impossible'); mcRenderLog(); return r; }
            catch (e) { act.state = 'err'; act.desc += ' — ' + e.message; mcRenderLog(); return { ok: false, erreur: e.message }; }
        }

        // un tour de Gemini : texte au fil de l'eau + appels de fonctions (les « parts » sont renvoyées telles quelles au tour suivant)
        // réflexion du modèle : par défaut les modèles « flash » réfléchissent longuement, en silence, avant chaque réponse et avant chaque étape de travail sur le plan.
        // On la limite (réponses nettement plus rapides) ; si le modèle refuse ce réglage, on le retire et on s'en souvient.
        const iaThinkKO = {};
        function iaThink(gc) { const m = String(iaCfg.model || ''); if (iaThinkKO[m] || !/gemini|flash|pro/i.test(m)) return gc;
            return Object.assign({}, gc, { thinkingConfig: /gemini-[3-9]|latest/i.test(m) ? { thinkingLevel: 'low' } : { thinkingBudget: /pro/i.test(m) ? 512 : 256 } }); }
        async function iaGemFetch(body) {
            const go = (b) => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(iaCfg.model) + ':streamGenerateContent?alt=sse', { method: 'POST', signal: mcAbort ? mcAbort.signal : undefined, headers: { 'content-type': 'application/json', 'x-goog-api-key': iaCfg.key }, body: JSON.stringify(b) });
            let res = await go(body);
            if (res.status === 400 && body.generationConfig && body.generationConfig.thinkingConfig) { let t = ''; try { t = await res.clone().text(); } catch (e) {}
                if (/think/i.test(t)) { iaThinkKO[iaCfg.model] = true; const b2 = JSON.parse(JSON.stringify(body)); delete b2.generationConfig.thinkingConfig; res = await go(b2); } }
            return res; }
        async function iaGemini(contents, sysTxt, tools, onDelta) {
            if (!iaCfg.key) throw new Error('Aucune clé API : colle-la dans la bulle de Momo IA.');
            const body = { systemInstruction: { parts: [{ text: sysTxt }] }, contents, generationConfig: iaThink({ maxOutputTokens: 8192 }) };
            if (tools) body.tools = [{ functionDeclarations: tools }];
            let res;
            try { res = await iaGemFetch(body); }
            catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Pas de connexion au service (Internet coupé, ou réseau qui bloque l\'accès).'); }
            if (!res.ok) { let b = null; try { b = await res.json(); } catch (e) {} throw new Error(iaErr(res.status, b)); }
            if (!/étape/.test(mcSt.txt)) mcStatus('Je réfléchis…'); else mcSt.last = Date.now();
            const parts = [], calls = []; let text = '';
            const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
            for (;;) {
                const { value, done } = await rd.read(); if (done) break;
                buf += dec.decode(value, { stream: true }); let i; mcSt.last = Date.now();
                while ((i = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
                    if (!line.startsWith('data:')) continue; let j; try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
                    const ps = ((((j.candidates || [])[0] || {}).content || {}).parts) || [];
                    ps.forEach(pt => { parts.push(pt); if (pt.functionCall) calls.push(pt.functionCall); else if (pt.text && !pt.thought) { text += pt.text; if (onDelta) onDelta(text); } });
                }
            }
            if (!parts.length) throw new Error('Réponse vide du fournisseur.');
            return { text, calls, parts };
        }

        // un tour de Claude : même entrée et même sortie que iaGemini (l'historique reste au format Gemini, converti à l'envoi)
        function iaSchema(o) {   // schémas Gemini (OBJECT, NUMBER…) → JSON Schema
            if (Array.isArray(o)) return o.map(iaSchema); if (!o || typeof o !== 'object') return o;
            const r = {}; for (const k in o) r[k] = k === 'type' && typeof o[k] === 'string' ? o[k].toLowerCase() : iaSchema(o[k]); return r;
        }
        async function iaClaude(contents, sysTxt, tools, onDelta) {
            if (!iaCfg.key) throw new Error('Aucune clé API : colle-la dans la bulle de Momo IA.');
            const messages = [];
            contents.forEach(c => {
                const role = c.role === 'model' ? 'assistant' : 'user', content = [];
                (c.parts || []).forEach(p => {
                    if (p.functionCall) content.push({ type: 'tool_use', id: p.functionCall.id, name: p.functionCall.name, input: p.functionCall.args || {} });
                    else if (p.functionResponse) content.push({ type: 'tool_result', tool_use_id: p.functionResponse.id, content: JSON.stringify(p.functionResponse.response) });
                    else if (p.inlineData) content.push({ type: 'image', source: { type: 'base64', media_type: p.inlineData.mimeType, data: p.inlineData.data } });
                    else if (p.text) content.push({ type: 'text', text: p.text });
                });
                if (!content.length) return;
                const last = messages[messages.length - 1];
                if (last && last.role === role) last.content.push(...content); else messages.push({ role, content });
            });
            const body = { model: iaCfg.model, max_tokens: 8000, stream: true, system: sysTxt, messages };
            if (tools) body.tools = tools.map(t => ({ name: t.name, description: t.description, input_schema: iaSchema(t.parameters) }));
            let res;
            try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: mcAbort ? mcAbort.signal : undefined, headers: { 'content-type': 'application/json', 'x-api-key': iaCfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) }); }
            catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Pas de connexion au service (Internet coupé, ou réseau qui bloque l\'accès).'); }
            if (!res.ok) { let b = null; try { b = await res.json(); } catch (e) {} throw new Error(iaErr(res.status, b)); }
            if (!/étape/.test(mcSt.txt)) mcStatus('Je réfléchis…'); else mcSt.last = Date.now();
            const blocks = []; let text = '';
            const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
            for (;;) {
                const { value, done } = await rd.read(); if (done) break;
                buf += dec.decode(value, { stream: true }); let i; mcSt.last = Date.now();
                while ((i = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
                    if (!line.startsWith('data:')) continue; let j; try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
                    if (j.type === 'content_block_start' && j.content_block && j.content_block.type === 'tool_use') mcStatus(/tracer/.test(j.content_block.name) ? 'Je prépare un tracé…' : 'Je prépare une action…');
                    if (j.type === 'content_block_start') blocks[j.index] = Object.assign({ json: '' }, j.content_block);
                    else if (j.type === 'content_block_delta') { const b = blocks[j.index]; if (!b) continue;
                        if (j.delta.type === 'text_delta') { b.text = (b.text || '') + j.delta.text; text += j.delta.text; if (onDelta) onDelta(text); }
                        else if (j.delta.type === 'input_json_delta') { b.json += j.delta.partial_json; if (/tracer/.test(b.name || '')) { const n = (b.json.match(/"x"/g) || []).length; if (n) mcStatus('Je prépare un tracé… ' + n + ' points'); } } }
                    else if (j.type === 'error') throw new Error('Erreur du service : ' + ((j.error && j.error.message) || 'inconnue'));
                }
            }
            const parts = [], calls = [];
            blocks.forEach(b => { if (!b) return;
                if (b.type === 'text' && b.text) parts.push({ text: b.text });
                else if (b.type === 'tool_use') { let args = b.input || {}; if (b.json) { try { args = JSON.parse(b.json); } catch (e) {} } const fc = { id: b.id, name: b.name, args }; parts.push({ functionCall: fc }); calls.push(fc); } });
            if (!parts.length) throw new Error('Réponse vide du fournisseur.');
            return { text, calls, parts };
        }

