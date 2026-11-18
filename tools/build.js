#!/usr/bin/env node
// Assemble MomoCAD en un seul fichier index.html à partir des sources rangées dans src/ :
//   src/page/0*.html  : en-tête, styles, ouverture, interface, guide (dans l'ordre des noms)
//   src/js/NN-*.js    : le programme, module par module (dans l'ordre des numéros), réunis dans un seul <script>
//   src/page/9*.html  : fin de page
// Usage : node tools/build.js           → écrit index.html
//         node tools/build.js --check   → vérifie que index.html correspond aux sources (échoue sinon)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'index.html');
const list = (dir, re) => fs.readdirSync(path.join(SRC, dir)).filter(f => re.test(f)).sort().map(f => path.join(SRC, dir, f));
function build() {
    const head = list('page', /^0\d-.*\.html$/).map(f => fs.readFileSync(f, 'utf8')).join('');
    const js = list('js', /^\d\d-.*\.js$/).map(f => fs.readFileSync(f, 'utf8')).join('');
    const tail = list('page', /^9\d-.*\.html$/).map(f => fs.readFileSync(f, 'utf8')).join('');
    return head + '    <script>\n' + js + '    </script>\n' + tail;
}
const out = build();
if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== out) { console.error('index.html ne correspond pas aux sources de src/ : lancer « node tools/build.js ».'); process.exit(1); }
    console.log('index.html à jour (' + list('js', /^\d\d-.*\.js$/).length + ' modules).');
} else { fs.writeFileSync(OUT, out); console.log('index.html assemblé : ' + (out.length / 1e6).toFixed(2) + ' Mo, ' + list('js', /^\d\d-.*\.js$/).length + ' modules.'); }
