// Vitesse sur un gros projet fabriqué (terrain de 900 points, 300 bâtiments, plateformes à talus, bois, routes) :
// ouverture, déplacement de la vue, redessin après une modification, ouverture de la 3D. Chaque mesure a un temps limite :
// si une modification fait ramer MomoCAD, ce contrôle échoue. Les limites sont larges (machines de test lentes, sans carte graphique).
module.exports = { name: 'vitesse', run: async (H, t) => {
    const { ev } = H;
    await H.blank(14);
    const R = await ev(async () => { const m = mmToWorld(1000), rnd = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
        shapes = []; const TN = ensureLayer('Terrain naturel', '#bef264'), BAT = ensureLayer('Bâti', '#fb923c'), BOIS = ensureLayer('Zones boisées', '#65a30d');
        for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) { const x = i * 15, y = j * 15; shapes.push({ type: 'point', layerId: TN, x: x * m, y: -y * m, z: Math.round((100 + 8 * Math.sin(x / 90) + 5 * Math.cos(y / 70) + rnd() * 0.3) * 1000), zk: 1 }); }
        for (let k = 0; k < 300; k++) { const x = 20 + rnd() * 400, y = 20 + rnd() * 400, w = 6 + rnd() * 10, h = 6 + rnd() * 10; shapes.push({ type: 'poly', layerId: BAT, hatch: false, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => ({ x: a * m, y: -b * m })) }); }
        for (let k = 0; k < 8; k++) { const x = 40 + k * 45, y = 150 + (k % 2) * 80, z = Math.round((100 + 8 * Math.sin((x + 10) / 90) + 5 * Math.cos((y + 8) / 70)) * 1000); shapes.push({ type: 'poly', layerId: 'layer-0', zk: 1, points: [[x, y], [x + 22, y], [x + 22, y + 16], [x, y + 16]].map(([a, b]) => ({ x: a * m, y: -b * m, z })), talus: { on: true, kD: '3/2', kR: '3/2' } }); }
        for (let k = 0; k < 3; k++) { const cx = 80 + k * 130, cy = 360, P = []; for (let a = 0; a < 24; a++) { const r = 35 + rnd() * 10, an = a / 24 * Math.PI * 2; P.push({ x: (cx + Math.cos(an) * r) * m, y: -(cy + Math.sin(an) * r) * m }); } shapes.push({ type: 'poly', layerId: BOIS, points: P, bois: { h: 12 }, hatch: false }); }
        const txt = JSON.stringify(projectData()); shapes = []; invalidateCache(); draw();
        const T = {}; let t0 = performance.now(); loadProjectText(txt, 'gros.mmc'); T.ouverture = performance.now() - t0;
        zoomExtents(); draw(); NAV.ms = 0; t0 = performance.now(); for (let i = 0; i < 10; i++) { camera.x += 5; draw(); } T.vue = (performance.now() - t0) / 10;
        t0 = performance.now(); for (let i = 0; i < 5; i++) { invalidateCache(); draw(); } T.modif = (performance.now() - t0) / 5;
        t0 = performance.now(); await open3D(); T.vue3d = performance.now() - t0; close3D(); return T; });

    const L = { ouverture: 2500, vue: 80, modif: 150, vue3d: 8000 };   // environ 8 × les temps de la machine de développement (250, 12, 17, 1000 ms)
    t.ok('gros projet : ouverture en moins de ' + L.ouverture / 1000 + ' s', R.ouverture < L.ouverture, Math.round(R.ouverture) + ' ms');
    t.ok('gros projet : déplacer la vue, moins de ' + L.vue + ' ms par image', R.vue < L.vue, Math.round(R.vue) + ' ms');
    t.ok('gros projet : redessin après une modification, moins de ' + L.modif + ' ms', R.modif < L.modif, Math.round(R.modif) + ' ms');
    t.ok('gros projet : ouverture de la vue 3D en moins de ' + L.vue3d / 1000 + ' s', R.vue3d < L.vue3d, Math.round(R.vue3d) + ' ms');
    // traits de construction (droites infinies en tirets) : tracés seulement sur la partie visible — une droite de 20 000 km en tirets faisait ramer le plan
    const cl = await ev(() => { shapes = []; const m = mmToWorld(1000); for (let i = 0; i < 25; i++) { const an = i * 0.37; shapes.push(clMake(i * m, -i * m, Math.cos(an), Math.sin(an))); } invalidateCache(); camera.zoom = 40;
        const P = CanvasRenderingContext2D.prototype, lt = P.lineTo; let mx = 0; P.lineTo = function (x, y) { const T = this.getTransform(), X = T.a * x + T.c * y + T.e, Y = T.b * x + T.d * y + T.f; mx = Math.max(mx, Math.abs(X), Math.abs(Y)); return lt.call(this, x, y); };
        try { draw(); } finally { P.lineTo = lt; } shapes = []; invalidateCache(); draw(); return mx; });
    t.ok('traits de construction : tracés sur la partie visible seulement', cl < 20000, Math.round(cl) + ' px');
    require('fs').mkdirSync(require('path').join(__dirname, '..', 'out'), { recursive: true }); require('fs').writeFileSync(require('path').join(__dirname, '..', 'out', 'vitesse.json'), JSON.stringify(R, null, 1));
} };
