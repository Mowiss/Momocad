// CONSOLIDATION : plans tirés au hasard (graines fixes, rejouables) — plateformes qui se recouvrent, talus par arête (parois, escaliers,
// refoulements, reculs), fondations sous dalle ; on enchaîne déplacements, cotes, sommets ajoutés / retirés, Ctrl+Z / Ctrl+Y, façonnage et son Défaire.
// À chaque pas : rien ne plante, aucun talus ne disparaît, terrain fini sans trou, Ctrl+Z puis Ctrl+Y rend le même plan, façonnage sans échec, cubatures finies.
// Graines retenues : celles qui ont fait tomber une erreur pendant la passe de consolidation du 17/11.
module.exports = { name: 'consolidation', timeout: 900000, run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    await ev(async () => { await loadPolyClip(); window.__light = 1; window.__nOps = 9; });
    for (const seed of [2, 9, 14, 106, 115, 203, 211]) {
        const r = await ev(SCEN, seed);
        t.eq('plan aléatoire n° ' + seed + ' (' + r.ops.join(', ') + ')', r.issues, []);
    }
} };
const SCEN = async (seed) => { let S = seed * 9301 + 49297; const R = () => (S = (S * 16807) % 2147483647) / 2147483647, pick = (a) => a[Math.floor(R() * a.length)];
      const out = { seed, ops: [], issues: [] }, m = mmToWorld(1000); shapes = []; shapesHistory = []; historyStep = -1; invalidateCache(); tinCache = null;
      const TN = ensureLayer('Terrain naturel', '#bef264'), sl = (R() - 0.5) * 300, bump = R() * 1500;
      for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) shapes.push({ type: 'point', layerId: TN, x: (i * 5 - 40) * m, y: -(j * 5 - 40) * m, z: Math.round(100000 + i * sl + bump * Math.sin(i / 3) * Math.cos(j / 4)), zk: 1 });
      const tnZ = (x, y) => { const t = getTIN(); return t ? tinZ(x, y, t) : null; };
      const K = ['1/1', '3/2', '2/1', '1/2'], mkPlat = () => { const cx = (R() - 0.5) * 40, cy = (R() - 0.5) * 40, n = 3 + Math.floor(R() * 5), rx = 4 + R() * 10, ry = 4 + R() * 10, a0 = R() * 6.28;
          const pts = Array.from({ length: n }, (_, k) => { const a = a0 + k / n * 6.283 + (R() - 0.5) * 0.4; return { x: (cx + Math.cos(a) * rx) * m, y: -(cy + Math.sin(a) * ry) * m }; });
          const zt = tnZ(cx * m, -cy * m) || 100000, z = Math.round(zt + (R() - 0.5) * 4000); pts.forEach(q => q.z = z);
          const pl = { type: 'poly', layerId: 'layer-0', zk: 1, points: pts, talus: { on: R() < 0.9, kR: pick(K), kD: pick(K) } };
          if (R() < 0.5) { pl.talus.cx = true; pl.talus.edges = pts.map(() => { const r = R(); return r < 0.15 ? { off: true } : r < 0.25 ? { st: { h: 160, g: 300 }, kD: '0,3/0,16', kR: '0,3/0,16' } : r < 0.45 ? { kR: pick(K), kD: pick(K) } : r < 0.55 ? { kD: '1/1', R: 1000 } : null; }); if (R() < 0.4) pl.talus.corn = { [Math.floor(R() * n)]: Math.round(R() * 180) }; }
          return pl; };
      const plats = () => shapes.filter(isPlateforme);
      const check = (tag) => { const P = plats(); let FM; try { FM = finishedModel(); } catch (e) { out.issues.push(tag + ' FM throw ' + e.message); return; }
        P.forEach((pl, i) => { const t = platTalus(pl); if (!t.on) return; let g; try { g = talusGeom(pl); } catch (e) { out.issues.push(tag + ' talusGeom throw ' + e.message); return; }
          if (!g) { const dz = Math.max(...pl.points.map(q => Math.abs((tnZ(q.x, q.y) || q.z) - q.z))); const inside = P.some(o => o !== pl && pl.points.every(q => pointInPolygon(q.x, q.y, o.points))); if (dz > 300 && !inside) out.issues.push(tag + ' talus null (dz ' + Math.round(dz) + ') plat ' + i); } });
        for (let k = 0; k < 60; k++) { const x = (R() - 0.5) * 80 * m, y = (R() - 0.5) * 80 * m; let q; try { q = FM.at(x, y); } catch (e) { out.issues.push(tag + ' at throw ' + e.message); break; } if (q && !isFinite(q.z)) { out.issues.push(tag + ' at NaN'); break; } }
        try { draw(); } catch (e) { out.issues.push(tag + ' draw throw ' + e.message); }
        if (!window.__light || tag === 'init' || tag === 'final') try { cubCC = null; const C = cubCompute(); if (!C.err && !(isFinite(C.D) && isFinite(C.Rm) && C.D >= -1e-6 && C.Rm >= -1e-6)) out.issues.push(tag + ' cub bad ' + C.D + '/' + C.Rm); } catch (e) { out.issues.push(tag + ' cub throw ' + e.message); } };
      const np = 2 + Math.floor(R() * 4); for (let k = 0; k < np; k++) shapes.push(mkPlat()); saveState(); check('init');
      let gid = null;
      for (let op = 0; op < (window.__nOps || 14); op++) { const P = plats(), pl = P.length ? pick(P) : null, o = Math.floor(R() * 12); let nm = '';
        try {
          if (o === 0 && pl) { nm = 'move'; const dx = (R() - 0.5) * 8 * m, dy = (R() - 0.5) * 8 * m; pl.points.forEach(q => { q.x += dx; q.y += dy; }); saveState(); }
          else if (o === 1 && pl) { nm = 'z'; const dz = Math.round((R() - 0.5) * 2000); pl.points.forEach(q => q.z += dz); saveState(); }
          else if (o === 2 && pl) { nm = 'edge'; const t = pl.talus || (pl.talus = { on: true, kR: '3/2', kD: '1/1' }); t.cx = true; t.edges = t.edges || []; const i = Math.floor(R() * pl.points.length), r = R(); t.edges[i] = r < 0.3 ? { off: true } : r < 0.6 ? { st: { h: 170, g: 290 }, kD: '0,29/0,17', kR: '0,29/0,17' } : { kR: pick(K), kD: pick(K) }; saveState(); }
          else if (o === 3 && pl && pl.points.length > 3) { nm = 'delvtx'; const i = Math.floor(R() * pl.points.length); pl.points.splice(i, 1); if (pl.talus && pl.talus.edges) pl.talus.edges.splice(i, 1); saveState(); }
          else if (o === 4 && pl) { nm = 'addvtx'; const i = Math.floor(R() * pl.points.length), a = pl.points[i], c = pl.points[(i + 1) % pl.points.length]; pl.points.splice(i + 1, 0, { x: (a.x + c.x) / 2 + (R() - 0.5) * m, y: (a.y + c.y) / 2 + (R() - 0.5) * m, z: a.z }); if (pl.talus && pl.talus.edges) pl.talus.edges.splice(i + 1, 0, pl.talus.edges[i] ? Object.assign({}, pl.talus.edges[i]) : null); saveState(); }
          else if (o === 5) { nm = 'undo'; const before = JSON.stringify(shapes); undo(); check('after-undo'); redo(); if (JSON.stringify(shapes) !== before) { const A = JSON.parse(before), B = shapes; const k = A.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(B[i])); out.issues.push('undo/redo not identical #' + k + ' ' + (A.length !== B.length ? 'len ' + A.length + '/' + B.length : JSON.stringify(A[k]).slice(0, 400) + ' VS ' + JSON.stringify(B[k]).slice(0, 400))); } }
          else if (o === 6) { nm = 'undo-only'; undo(); }
          else if (o === 7 && P.length >= 2) { nm = 'facon'; const before = JSON.stringify(shapes.filter(isPlateforme).map(s => s.points)); const had = shapes.some(x => x.facon); window.__fw = 0; if (!window.__cw) { window.__cw = console.warn; console.warn = (...a) => { if (/façonner/.test(String(a[0]))) window.__fw = 1; window.__cw(...a); }; } gid = await faconner(P); if (window.__fw) out.issues.push('façonnage en échec'); if (gid && !had && R() < 0.5) { faconUndo(gid); nm = 'facon+undo'; const after = JSON.stringify(shapes.filter(isPlateforme).map(s => s.points)); if (after !== before) out.issues.push('faconUndo not restoring'); gid = null; } }
          else if (o === 8) { nm = 'newplat'; shapes.push(mkPlat()); saveState(); }
          else if (o === 9 && pl) { nm = 'corn'; const t = pl.talus || (pl.talus = { on: true, kR: '3/2', kD: '1/1' }); t.corn = Object.assign({}, t.corn, { [Math.floor(R() * pl.points.length)]: R() < 0.3 ? null : Math.round(R() * 180) }); saveState(); }
          else if (o === 10) { nm = 'fond'; const cx = (R() - 0.5) * 30, cy = (R() - 0.5) * 30, zt = tnZ(cx * m, -cy * m) || 100000; const d = { type: 'poly', layerId: 'layer-0', zk: 1, name: 'Dalle', solid: { kind: 'box', H: 200 }, points: [[0, 0], [8, 0], [8, 6], [0, 6]].map(([x, y]) => ({ x: (cx + x) * m, y: -(cy + y) * m, z: Math.round(zt) })) }; shapes.push(d); saveState();
              fondSet('filante'); fondGo(); shapes.push({ type: 'poly', open: true, layerId: activeLayerId, points: d.points.slice(0, 3).map(q => ({ x: q.x, y: q.y })) }); saveState(); setMode('select-box'); const f = shapes[shapes.length - 1]; if (f.fond && !f.points.every(q => Math.abs(q.z - f.points[0].z) < 1)) out.issues.push('fond not flat'); const Ds = fondDalles().filter(D => f.points.some(q => pointInPolygon(q.x, q.y, D.points) || distToPoly(q.x, q.y, D.points) < mmToWorld(800))), zx = Ds.length ? Math.min(...Ds.map(solidBaseZ)) - 400 : null; if (f.fond && zx !== null && Math.abs(f.points[0].z - zx) > 1) out.issues.push('fond not under dalle ' + (f.points[0].z - zx)); }
          else if (o === 11 && pl) { nm = 'talus-off/on'; pl.talus = Object.assign({}, pl.talus || {}, { on: !(pl.talus && pl.talus.on) }); saveState(); }
          else nm = 'noop';
        } catch (e) { out.issues.push('op ' + nm + ' throw ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
        out.ops.push(nm); check(op + ':' + nm); }
      check('final');
      try { if (!window.__v3o) { await open3D(); window.__v3o = 1; } build3DScene(); } catch (e) { out.issues.push('3D throw ' + e.message); }
      return out; };
