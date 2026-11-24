/* Batterie de contrôle de fichiers .mmc réels — les fichiers ne sont jamais versionnés, on les passe en argument :
     node tools/controle-mmc.js chemin/fichier1.mmc chemin/fichier2.mmc …
   Pour chaque fichier : erreurs de la page, enregistrer → rouvrir identique, ouvertures (hors de leur paroi, minuscules, en double, sans menuiserie en 3D),
   faces peintes orphelines, textures inconnues, niveaux inconnus, plan, vue 3D, collisions, coupes du fichier, coupe neuve (temps, cotes, enregistrement). */
const { launch, openPage } = require('../tests/lib/harness'); const fs = require('fs'), path = require('path');
(async () => { const b = await launch();
  for (const f of process.argv.slice(2)) { const { p } = await openPage(b); const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    const t0 = Date.now(); let r;
    try { r = await p.evaluate(async (t) => { const R = {}; const T = (k, fn) => { try { return fn(); } catch (e) { R.err = (R.err || []).concat(k + ': ' + e.message); } };
      loadProjectText(t, 'x.mmc'); await new Promise(r => setTimeout(r, 1500)); R.fix = JSON.stringify(window.MMC_LOAD_FIX || {});
      const s1 = JSON.stringify(projectData()); loadProjectText(s1, 'y.mmc'); await new Promise(r => setTimeout(r, 1200)); const s2 = JSON.stringify(projectData()); R.stable = s1 === s2; R.size = s1.length;
      const m = mmToWorld(1000), H = shapes.filter(x => isWallHatch(x) && x.loops && x.loops[0]); R.shapes = shapes.length; R.walls = H.length;
      const ops = []; shapes.forEach(h => (h.openings || []).forEach(o => ops.push([h, o]))); R.ops = ops.length;
      R.opOut = ops.filter(([h, o]) => { const c = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 }; return !pointInPolygon(c.x, c.y, h.loops[0]) && distToPoly(c.x, c.y, h.loops[0]) > mmToWorld(5); }).map(([h, o]) => o.kind + ' ' + (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) / m).toFixed(2) + 'm');
      R.opTiny = ops.filter(([h, o]) => Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) / m < 0.4).map(([h, o]) => o.kind + ' ' + (Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) / m).toFixed(2) + 'm');
      R.opDup = ops.filter(([h, o], i) => ops.some(([h2, o2], j) => j < i && Math.hypot(o.a.x - o2.a.x, o.a.y - o2.a.y) < mmToWorld(20) && Math.hypot(o.b.x - o2.b.x, o.b.y - o2.b.y) < mmToWorld(20))).length;
      const FS = shapes.filter(x => x.fte && x.fte.length); R.faces = FS.reduce((n, x) => n + x.fte.length, 0); R.faceOrphan = FS.reduce((n, x) => { const L = faceLoop(x); return n + x.fte.filter(e => !L.some((c, i) => wallFteMatch(e, c, L[(i + 1) % L.length]))).length; }, 0);
      R.ftexOld = shapes.filter(x => x.ftex && Object.keys(x.ftex).some(k => /^f\d/.test(k))).length;
      R.texUnknown = [...new Set(shapes.flatMap(x => [x.tex, x.texU, ...(x.fte || []).map(e => e.t), ...Object.values(x.ftex || {})]).filter(t => t && !TEX_LIB.some(L => L.id === t)))];
      R.lvlUnknown = shapes.filter(x => x.lvl && typeof lvlSorted === 'function' && lvls && !lvlSorted().some(l => l.id === x.lvl)).length;
      T('plan', () => { zoomToFitShapes(shapes); draw(); });
      await T('3d', async () => {}); try { await open3D(); await new Promise(r => setTimeout(r, 1500)); let n = 0, jn = 0; V3.root.traverse(o => { if (o.isMesh) n++; if (o.userData && o.userData.opening) jn++; }); R.meshes = n; R.joinery = jn;
        const withJ = new Set(); V3.root.traverse(o => { if (o.userData && o.userData.opening) withJ.add(o.userData.opening); }); R.opNo3D = ops.filter(([h, o]) => !withJ.has(o) && !opHidden(o)).map(([h, o]) => o.kind + '@' + (h.lvl || '?'));
        try { await d3Collisions(); R.collisions = d3Col.length; d3ColClear(); } catch (e) { R.err = (R.err || []).concat('collisions: ' + e.message); }
        close3D(); } catch (e) { R.err = (R.err || []).concat('3d: ' + e.message); }
      R.sections = shapes.filter(x => x.secTitle).length;
      /* coupes : celles du fichier se rafraîchissent ; une coupe neuve en travers du bâtiment (sinon du modèle 3D) se construit, se cote, survit à l'enregistrement */
      try { await loadThree(); const t1 = performance.now(); shapes.filter(x => x.cutDef).forEach(L => secRefresh(L, null)); R.secOld = Math.round(performance.now() - t1) + 'ms';
        const B = shapes.filter(x => isWallHatch(x) && x.loops).flatMap(x => x.loops[0]), Q = B.length ? B : shapes.filter(is3DObj).flatMap(x => x.points || []);
        if (Q.length) { const x0 = Math.min(...Q.map(q => q.x)), x1 = Math.max(...Q.map(q => q.x)), y0 = Math.min(...Q.map(q => q.y)), y1 = Math.max(...Q.map(q => q.y)), cy = (y0 + y1) / 2, pad = (x1 - x0) * 0.15 + m;
          const n0 = shapes.filter(x => x.cutDef).length, t2 = performance.now(); sectionPlace(sectionData({ x: x0 - pad, y: cy }, { x: x1 + pad, y: cy }, 1), { x: (x0 + x1) / 2, y: y1 + (y1 - y0) + 10 * m }); const L = shapes.filter(x => x.cutDef)[n0];
          if (!L) R.secNew = 'non créée'; else { const d = L.cutDef, S = () => shapes.filter(x => x.secOf === d.id); R.secNew = { ms: Math.round(performance.now() - t2), items: S().length, title: S().some(x => x.secTitle), dims: S().filter(x => x.lvKey).length, layers: !!(d.lay && layers.some(l => l.id === d.lay.d)) };
            const t3 = performance.now(); secRefresh(L, secModelSig()); R.secNew.again = Math.round(performance.now() - t3) + 'ms';
            const j = JSON.stringify(projectData()); loadProjectText(j, 'z.mmc'); await new Promise(r => setTimeout(r, 1200)); const L2 = shapes.find(x => x.cutDef && x.cutDef.id === d.id); R.secNew.saved = !!L2 && shapes.filter(x => x.secOf === d.id).length === R.secNew.items; } } }
      catch (e) { R.err = (R.err || []).concat('coupe: ' + e.message); }
      return R; }, fs.readFileSync(f, 'utf8')); } catch (e) { r = { crash: e.message.slice(0, 200) }; }
    r.secs = ((Date.now() - t0) / 1000).toFixed(0); r.pageErrors = [...new Set(errs)].slice(0, 6); console.log(path.basename(f), JSON.stringify(r, null, 1).replace(/\n\s*/g, ' ')); await p.close(); }
  await b.close(); })();
