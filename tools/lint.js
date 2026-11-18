#!/usr/bin/env node
// Contrôle des sources de MomoCAD (src/js) :
//   1. chaque module se lit sans erreur de syntaxe ;
//   2. aucun nom déclaré deux fois au premier niveau (une 2e « function x » remplacerait la 1re sans prévenir) ;
//   3. aucune variable créée par accident (affectation à un nom jamais déclaré) ;
//   4. carte des modules (src/CARTE.md) : ce que chacun déclare, pour s'y retrouver.
// Usage : node tools/lint.js [--carte]   (acorn et acorn-walk : npm install --no-save acorn acorn-walk)
const fs = require('fs'), path = require('path');
let acorn, walk; try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) { console.error('Il manque acorn : npm install --no-save acorn acorn-walk'); process.exit(2); }
const SRC = path.join(__dirname, '..', 'src', 'js'), files = fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const errs = [], decl = new Map(), carte = [];
const opts = { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, locations: true };
// navigateur, bibliothèques chargées par la page, et noms créés exprès sur window ailleurs (HTML, onclick…)
const KNOWN = new Set(Object.getOwnPropertyNames(globalThis).concat(['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'requestAnimationFrame', 'cancelAnimationFrame',
    'performance', 'fetch', 'Image', 'Blob', 'File', 'FileReader', 'URL', 'Response', 'Request', 'Headers', 'TextEncoder', 'TextDecoder', 'alert', 'confirm', 'prompt', 'getComputedStyle', 'matchMedia', 'history', 'screen',
    'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'CustomEvent', 'DOMParser', 'XMLSerializer', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Path2D', 'DOMMatrix',
    'ImageData', 'OffscreenCanvas', 'createImageBitmap', 'CanvasRenderingContext2D', 'WebGLRenderingContext', 'Worker', 'caches', 'crypto', 'open', 'close', 'print', 'scrollTo', 'innerWidth', 'innerHeight', 'devicePixelRatio',
    'THREE', 'L', 'polygonClipping', 'jspdf', 'pdfjsLib', 'JSZip', 'MomoTuto', 'tailwind', 'opener', 'parent', 'top', 'self', 'frames', 'name', 'event', 'onload', 'onresize', 'speechSynthesis', 'SpeechSynthesisUtterance',
    'ClipboardItem', 'AbortController', 'BroadcastChannel', 'Notification', 'launchQueue', 'showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker', 'structuredClone', 'queueMicrotask', 'atob', 'btoa', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'requestIdleCallback', 'cancelIdleCallback', 'console', 'CSS', 'FontFace', 'Option', 'Audio', 'MediaRecorder', 'webkitURL']));
const src = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8'));
// 1. syntaxe de chaque module (un module seul peut couper une expression : on contrôle surtout le tout)
let whole; try { whole = acorn.parse(src.join(''), opts); } catch (e) { errs.push('Syntaxe (programme assemblé) : ' + e.message); }
// lignes → module
const starts = []; { let n = 1; src.forEach((s, i) => { starts.push([n, files[i]]); n += s.split('\n').length - 1; }); }
const where = (line) => { let m = starts[0]; for (const s of starts) if (s[0] <= line) m = s; return m[1] + ':' + (line - m[0] + 1); };
if (whole) {
    // 2. déclarations du premier niveau
    const top = new Map(); const add = (nm, node, kind) => { const w = where(node.loc.start.line); if (top.has(nm) && !(kind === 'var' && top.get(nm).kind === 'var')) errs.push('Déclaré deux fois : « ' + nm + ' » (' + top.get(nm).w + ' et ' + w + ')'); else top.set(nm, { w, kind }); };
    whole.body.forEach(st => {
        if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') add(st.id.name, st, st.type === 'FunctionDeclaration' ? 'function' : 'class');
        else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => { const names = []; const grab = (p) => { if (!p) return; if (p.type === 'Identifier') names.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => grab(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(grab); else if (p.type === 'AssignmentPattern') grab(p.left); else if (p.type === 'RestElement') grab(p.argument); }; grab(d.id); names.forEach(nm => add(nm, d, st.kind)); });
    });
    // 3. noms affectés sans être déclarés dans une portée qui les voit (fonctions englobantes ou premier niveau)
    const pat = (p, out) => { if (!p) return; if (p.type === 'Identifier') out.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument, out)); else if (p.type === 'ArrayPattern') p.elements.forEach(q => pat(q, out)); else if (p.type === 'AssignmentPattern') pat(p.left, out); else if (p.type === 'RestElement') pat(p.argument, out); };
    const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
    const localOf = new Map();   // fonction → noms déclarés directement dedans (sans les fonctions imbriquées)
    const scan = (root, out) => { (function rec(n) { if (!n || typeof n.type !== 'string') return; if (n !== root && isFn(n)) { if (n.type === 'FunctionDeclaration' && n.id) out.add(n.id.name); return; }
        if (n.type === 'VariableDeclarator') pat(n.id, out); if (n.type === 'ClassDeclaration' && n.id) out.add(n.id.name); if (n.type === 'CatchClause' && n.param) pat(n.param, out);
        for (const k in n) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && rec(x)); else if (v && typeof v.type === 'string') rec(v); } })(root); };
    const topNames = new Set(top.keys()); scan(whole, topNames);
    const seen = new Set();
    walk.fullAncestor(whole, (n, st, anc) => { if (n.type !== 'AssignmentExpression' && n.type !== 'UpdateExpression' && n.type !== 'ForInStatement' && n.type !== 'ForOfStatement') return;
        const t = n.type === 'AssignmentExpression' || n.type === 'ForInStatement' || n.type === 'ForOfStatement' ? n.left : n.argument; if (!t || t.type !== 'Identifier') return; const nm = t.name;
        if (topNames.has(nm) || KNOWN.has(nm) || seen.has(nm)) return;
        for (const a of anc) if (isFn(a)) { let L = localOf.get(a); if (!L) { L = new Set(); a.params.forEach(p => pat(p, L)); if (a.id && a.type !== 'FunctionDeclaration') L.add(a.id.name); scan(a, L); localOf.set(a, L); } if (L.has(nm)) return; }
        seen.add(nm); errs.push('Variable créée par accident : « ' + nm + ' » (' + where(n.loc.start.line) + ') — à déclarer (let / const) ou à écrire window.' + nm); });
    // 4. carte
    if (process.argv.includes('--carte')) { const by = new Map(); top.forEach((v, k) => { const f = v.w.split(':')[0]; if (!by.has(f)) by.set(f, { fn: [], v: [] }); (v.kind === 'function' ? by.get(f).fn : by.get(f).v).push(k); });
        let md = '# Carte des modules de MomoCAD\n\nGénérée par `node tools/lint.js --carte`. Pour chaque module : ses fonctions et ses variables de premier niveau (partagées avec les autres modules).\n';
        files.forEach((f, i) => { const B = by.get(f) || { fn: [], v: [] }, head = (src[i].split('\n').find(l => /\/\/ \S/.test(l)) || '').replace(/^\s*\/\/\s*(-+|=+)?\s*/, '').slice(0, 160);
            md += `\n## ${f}\n${head ? '_' + head + '_\n' : ''}\n- **${src[i].split('\n').length - 1} lignes**, ${B.fn.length} fonctions, ${B.v.length} variables partagées\n- Variables : ${B.v.length ? B.v.map(x => '`' + x + '`').join(', ') : '—'}\n- Fonctions : ${B.fn.length ? B.fn.map(x => '`' + x + '`').join(', ') : '—'}\n`; });
        fs.writeFileSync(path.join(__dirname, '..', 'src', 'CARTE.md'), md); console.log('src/CARTE.md écrite.'); }
}
if (errs.length) { console.error(errs.length + ' problème(s) :\n  ' + errs.join('\n  ')); process.exit(1); }
console.log('Sources propres : ' + files.length + ' modules, aucun nom en double, aucune variable créée par accident.');
