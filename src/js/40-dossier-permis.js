        // ============ CONTRÔLE DU DOSSIER (permis de construire, déclaration préalable) : les 8 pièces, leurs échelles, le nord, les cotes, les altitudes ============
        /* Chaque pièce est retrouvée par son code au début du nom de sa présentation (PCMI1…, DP1…). Les contrôles lisent ce que montrent ses fenêtres :
           situation (carte, doigt, nord, échelle), plan de masse (construction, cotes, altitudes NGF, nord, échelle), coupe, façades, notice, insertion, photos.
           ✓ fait · ⚠ à vérifier · ✗ manquant — les symboles portent le sens, pas seulement la couleur. */
        const DOS_KIND = { pc: ['sit', 'masse', 'coupe', 'notice', 'facade', 'insertion', 'photo', 'photo'], dp: ['sit', 'masse', 'coupe', 'facade', 'aspect', 'insertion', 'photo', 'photo'] };
        // rectangle du plan (monde) vu par une fenêtre de plan
        function dosVpRect(v) { if (!v || !isFinite(v.scale) || v.scale <= 0) return null; const hw = mmToWorld(v.w / 2 * v.scale), hh = mmToWorld(v.h / 2 * v.scale), R = Math.hypot(hw, hh), rot = Math.abs((((v.a || 0) % 360) + 360) % 360) > 1e-6;
            return rot ? { x0: v.cx - R, x1: v.cx + R, y0: v.cy - R, y1: v.cy + R } : { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh }; }
        function dosIn(r, s) { try { const b = getShapesBoundingBox([s]); return !!b && b.maxX >= r.x0 && b.minX <= r.x1 && b.maxY >= r.y0 && b.minY <= r.y1; } catch (e) { return false; } }
        const dosPlanVps = (L) => (L.vps || []).filter(v => !lpFlat(v) && !v.v3);
        // contrôle d'une pièce : liste de { st: 'ok' | 'warn' | 'bad', t }
        function dosCheckPiece(L, kind, M) { const out = [], ok = (t) => out.push({ st: 'ok', t }), warn = (t) => out.push({ st: 'warn', t }), bad = (t) => out.push({ st: 'bad', t });
            const P = dosPlanVps(L), paperTxt = (L.paperShapes || []).filter(x => x.type === 'text' && !x.lpNeed && String(x.content || '').trim().length > 2);
            const seen = (pred) => P.some(v => { const r = dosVpRect(v); return r && M.some(s => pred(s) && dosIn(r, s)); });
            if (kind === 'sit') { const S = (L.vps || []).filter(v => v.kind === 'sit'); if (!S.length) { bad('pas de plan de situation : palette Présentation › Plan de situation'); return out; }
                const o = sitOpt(S[0]); if (!isFinite(o.lat)) bad('lieu inconnu : bouton ⌖ › adresse'); else ok('carte du lieu');
                o.pin ? ok('doigt sur le terrain') : warn('pas de doigt sur le terrain (double-clic dans la carte, clic sur le terrain)');
                o.cmp.on ? ok('nord') : bad('pas de nord (bouton ⌖ › Nord)'); o.bar.on ? ok('échelle graphique') : warn('pas d\'échelle graphique (bouton ⌖)');
                (o.S >= 5000 && o.S <= 25000) ? ok('échelle 1/' + nfr(o.S, 0)) : warn('échelle 1/' + nfr(o.S, 0) + ' (d\'habitude entre 1/5 000 et 1/25 000)'); return out; }
            if (kind === 'masse') { if (!P.length) { bad('pas de fenêtre de plan'); return out; } const sc = Math.max(...P.map(v => v.scale || 0));
                sc <= 500 ? ok('échelle 1:' + nfr(sc, 0)) : warn('échelle 1:' + nfr(sc, 0) + ' (d\'habitude 1:100 à 1:500)');
                seen(s => is3DObj(s) || isWallHatch(s) || s.bld) ? ok('construction dans la fenêtre') : bad('la construction n\'est pas dans la fenêtre');
                seen(s => s.type === 'dim') ? ok('cotes') : warn('pas de cote : distances aux limites, dimensions');
                seen(s => (s.type === 'text' && /\d{3}[,.]\d{2}/.test(String(s.content || ''))) || (s.type === 'point' && hasZ(s.z) && s.lvl) || s.lvKey) ? ok('altitudes (NGF)') : warn('pas d\'altitude NGF lisible (cotes de niveau, points cotés)');
                P.some(v => v.north) ? ok('nord') : bad('pas de nord : bouton N au-dessus de la fenêtre'); return out; }
            if (kind === 'coupe') { const C = M.filter(s => s.cutDef && s.type === 'line' && !s.cutDef.fac).map(s => s.cutDef.id);
                if (!C.length) { bad('aucune coupe dessinée (outil Trait de coupe)'); return out; }
                const shown = C.filter(id => seen(s => s.secOf === id)); if (!shown.length) { bad('aucune coupe dans les fenêtres de cette pièce'); return out; } ok(shown.length + ' coupe' + (shown.length > 1 ? 's' : '') + ' montrée' + (shown.length > 1 ? 's' : ''));
                seen(s => s.secOf && shown.includes(s.secOf) && s.type === 'text' && /^TN /.test(String(s.content || ''))) ? ok('terrain naturel coté') : warn('terrain naturel non coté (avant travaux)');
                const stale = M.filter(s => s.cutDef && s.type === 'line' && shown.includes(s.cutDef.id) && secStale(s)); stale.length ? warn(stale.length + ' coupe(s) à rafraîchir (pastille orange)') : ok('à jour'); return out; }
            if (kind === 'facade') { const F = M.filter(s => s.cutDef && s.type === 'line' && s.cutDef.fac); if (!F.length) { bad('aucune façade dessinée (outil Vue de façade)'); return out; }
                const shown = F.filter(s => seen(x => x.secOf === s.cutDef.id)); if (!shown.length) { bad('aucune façade dans les fenêtres de cette pièce'); return out; }
                ok(shown.map(s => secLab(s.cutDef)).join(', ')); if (F.length < 4) warn(F.length + ' façade' + (F.length > 1 ? 's' : '') + ' dessinée' + (F.length > 1 ? 's' : '') + ' (en général toutes : 4)');
                const stale = shown.filter(s => secStale(s)); if (stale.length) warn(stale.length + ' façade(s) à rafraîchir (pastille orange)'); return out; }
            if (kind === 'notice') { paperTxt.length ? ok('texte de la notice') : bad('notice à rédiger (texte sur la feuille)'); return out; }
            const im = (L.vps || []).some(v => v.kind === 'img' || v.v3); im ? ok(kind === 'photo' ? 'photo posée' : 'image posée') : bad(kind === 'photo' ? 'pas de photo (palette Présentation › Image)' : 'pas d\'image ni de vue 3D');
            if (kind === 'photo') warn('angle de prise de vue à repérer sur le plan de situation et le plan de masse'); return out; }
        // le dossier : ses pièces, trouvées ou manquantes, et leurs contrôles
        function dosCheck() { const M = typeof lpModelShapes === 'function' && layoutOn ? lpModelShapes() : shapes, res = [];
            Object.keys(LP_SETS).forEach(k => { const K = LP_SETS[k], idx = K.P.map(p => layouts.findIndex(L => new RegExp('^' + p[0] + '(\\b|\\s|$)').test(String(L.name || '')))); if (idx.every(i => i < 0)) return;
                K.P.forEach((p, n) => { const i = idx[n], L = layouts[i], items = L ? dosCheckPiece(L, DOS_KIND[k][n], M) : [{ st: 'bad', t: 'présentation manquante' }];
                    if (L) { (L.cartouche && L.cart && L.cart.planName) ? items.push({ st: 'ok', t: 'cartouche' }) : items.push({ st: 'warn', t: 'cartouche vide ou absent' }); if ((L.paperShapes || []).some(x => x.lpNeed)) items.push({ st: 'warn', t: 'bloc « À FOURNIR » encore sur la feuille (à effacer une fois la pièce faite)' }); }
                    const st = items.some(x => x.st === 'bad') ? 'bad' : items.some(x => x.st === 'warn') ? 'warn' : 'ok'; res.push({ set: k, code: p[0], title: p[1], i, st, items }); }); });
            return res; }
        const DOS_SYM = { ok: ['✓', '#bbf7d0', '#14532d'], warn: ['⚠', '#fde68a', '#713f12'], bad: ['✗', '#fecaca', '#7f1d1d'] };
        function dosPanel() { lpSync(); const R = dosCheck(), esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            if (!R.length) { mcToast('Aucun dossier PC ou DP dans les présentations : menu des présentations › + Nouveau PC ou + Nouvelle DP.'); return; }
            const n = { ok: 0, warn: 0, bad: 0 }; R.forEach(r => n[r.st]++);
            const rows = R.map(r => { const [sy, fg, bg] = DOS_SYM[r.st]; return `<div style="border:1px solid #374151;border-left:5px solid ${fg};background:${bg}33;border-radius:6px;padding:6px 8px;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px"><span style="font-weight:bold;color:${fg};font-size:15px;width:16px">${sy}</span><b>${r.code}</b> <span style="color:#d1d5db;flex:1">${esc(r.title)}</span>${r.i >= 0 ? `<button type="button" class="mf-btn" style="font-size:11.5px" onclick="dosGo(${r.i})">Aller à la pièce</button>` : ''}</div>
                <div style="margin:4px 0 0 24px;display:flex;flex-direction:column;gap:1px">${r.items.filter(x => x.st !== 'ok' || r.st === 'ok').slice(0, 7).map(x => `<span style="color:${DOS_SYM[x.st][1]}">${DOS_SYM[x.st][0]} ${esc(x.t)}</span>`).join('')}</div></div>`; }).join('');
            openTopoModal('✔ Contrôle du dossier', `<div style="font-size:13px;color:#e5e7eb;min-width:360px;max-width:560px"><div style="margin-bottom:8px">${n.ok} pièce${n.ok > 1 ? 's' : ''} ✓ prête${n.ok > 1 ? 's' : ''} · ${n.warn} ⚠ à vérifier · ${n.bad} ✗ incomplète${n.bad > 1 ? 's' : ''}</div><div style="max-height:62vh;overflow:auto">${rows}</div>
                <div style="color:#9ca3af;font-size:12px;margin-top:6px">Contrôle indicatif : il lit ce que montrent les fenêtres de chaque présentation (code PCMI… / DP… au début de son nom). Le service instructeur reste juge des pièces demandées.</div></div>`, [['Fermer', () => closeTopoModal(), true]]); }
        function dosGo(i) { closeTopoModal(); try { lpMenuClose(); } catch (e) {} if (!layoutOn) toggleLayout(true); lpSwitch(i); }
