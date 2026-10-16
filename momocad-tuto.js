/* MomoCAD — module d'apprentissage (🎓 Apprendre)
   Fichier compagnon de MomoCAD : à placer dans le même dossier que index.html.
   Il n'est chargé qu'au clic sur le bouton 🎓 Apprendre. Il pilote une mascotte qui guide
   l'utilisateur pas à pas dans les outils de base (Dessin et Modif) et vérifie chaque action. */
(function () {
    'use strict';
    if (window.MomoTuto) return;

    // ---------- accès à l'état de MomoCAD (variables globales du script principal) ----------
    const G = {
        mode: () => { try { return mode; } catch (e) { return ''; } },
        shapes: () => { try { return shapes; } catch (e) { return []; } },
        sel: () => { try { return selectedShapes; } catch (e) { return []; } },
        hist: () => { try { return historyStep; } catch (e) { return 0; } },
    };
    let changes = 0;   // nombre d'actions enregistrées (chaque modification du plan passe par saveState)
    if (typeof window.saveState === 'function' && !window.saveState.__tuto) {
        const orig = window.saveState;
        window.saveState = function () { const r = orig.apply(this, arguments); changes++; return r; };
        window.saveState.__tuto = true;
    }
    const count = (type) => G.shapes().filter(s => !type || s.type === type).length;

    // ---------- les étapes ----------
    // target : bouton à montrer ; tip : texte de l'infobulle à côté du bouton ; say : texte de la mascotte
    // wait : fonction (ctx) -> true quand l'étape est réussie ; ctx garde l'état au début de l'étape
    const K = (t) => `<kbd>${t}</kbd>`;
    const BASE = [
        { title: 'Bonjour !', say: `Je suis <b>Momo</b>, je vais vous apprendre les outils de base de MomoCAD, en pratiquant directement sur le plan.<br><br>Chaque étape vous montre un bouton. Faites l'action : je passe à la suite dès que c'est réussi. ${K('Passer')} saute une étape, ✕ arrête la visite.<br><br>Astuce : travaillez sur un plan vierge, tout ce qu'on dessine pourra être effacé à la fin.`, manual: 'C\'est parti' },
        { title: 'Se déplacer', say: `Avant de dessiner, la souris :<br>• <b>molette</b> = zoomer / dézoomer, centré sur le curseur ;<br>• <b>clic molette maintenu</b> = faire glisser le plan ;<br>• <b>double-clic molette</b> = tout voir.<br><br>Essayez, puis cliquez « Suivant ».`, manual: 'Suivant' },
        // ----- DESSIN -----
        { title: 'Droite', target: 'btn-line', tip: 'Outil Droite<br><small>ou tapez DR puis Entrée</small>', say: `Choisissez l'outil <b>Droite</b> (palette Dessin).`, wait: () => G.mode() === 'line' },
        { title: 'Droite', target: 'btn-line', say: `Cliquez un premier point sur le plan, puis tapez ${K('5')} et ${K('Entrée')} : une droite de <b>5 m</b> part dans la direction de la souris.<br><small>Maintenez ${K('Maj')} pour la garder horizontale ou verticale.</small>`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Rectangle', target: 'btn-rect', tip: 'Outil Rectangle<br><small>ou QR + Entrée</small>', say: `Outil <b>Rectangle</b> maintenant.`, wait: () => G.mode() === 'rect' },
        { title: 'Rectangle', target: 'btn-rect', say: `Cliquez un premier coin, puis tapez la largeur ${K('8')} ${K('Espace')} et la hauteur ${K('5')} ${K('Entrée')} : rectangle de 8 × 5 m.<br><small>On peut aussi cliquer simplement le coin opposé.</small>`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Cercle', target: 'btn-circle', tip: 'Outil Cercle<br><small>ou RO + Entrée</small>', say: `Outil <b>Cercle</b> : cliquez le centre, puis tapez le rayon ${K('2')} ${K('Entrée')}.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Arc', target: 'btn-arc', tip: 'Outil Arc<br><small>ou AR + Entrée</small>', say: `Outil <b>Arc</b> : cliquez le <b>centre</b>, puis le <b>point de départ</b> (il donne le rayon), puis le <b>point de fin</b>. L'arc tourne du côté où va la souris.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Polygone', target: 'btn-poly', tip: 'Outil Polygone<br><small>ou PL + Entrée</small>', say: `Outil <b>Polygone</b> : cliquez 4 ou 5 sommets, puis recliquez le <b>premier</b> sommet (ou double-clic) pour fermer le contour.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Polyligne', target: 'btn-pline', tip: 'Outil Polyligne<br><small>ou PLI + Entrée</small>', say: `La <b>polyligne</b> est un tracé ouvert, pour une bordure ou un réseau : cliquez plusieurs points, puis ${K('Entrée')} ou double-clic pour terminer.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Hachure', target: 'btn-hatch', tip: 'Outil Hachure<br><small>ou HA + Entrée</small>', say: `Outil <b>Hachure</b> : cliquez <b>à l'intérieur</b> du rectangle. La zone est hachurée et sa surface s'affiche en bas.`, wait: (c) => count('hatch') > c.h, init: (c) => { c.h = count('hatch'); } },
        // ----- MODIF -----
        { title: 'Sélection', target: 'btn-select-box', tip: 'Sélection<br><small>ou Échap</small>', say: `Place aux modifications. Appuyez sur ${K('Échap')} (outil <b>Sélection</b>), puis <b>cliquez sur le cercle</b>. Il se colore et montre ses <b>poignées</b> bleues.<br><small>Maj + clic ajoute ou retire un objet ; une fenêtre tracée à la souris sélectionne plusieurs objets.</small>`, wait: () => G.mode() === 'select-box' && G.sel().length > 0 },
        { title: 'Poignées', say: `Tirez une <b>poignée</b> : celle du centre déplace l'objet, celles du tour changent le rayon. Sur un rectangle, la poignée au milieu d'un côté pousse ce côté.<br><br>Faites un essai.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; }, manual: 'Suivant' },
        { title: 'Déplacer', target: 'btn-move', tip: 'Déplacer<br><small>ou D + Entrée</small>', say: `Déplacement précis au clavier : sélectionnez un objet, puis tapez ${K('3')} ${K('Espace')} ${K('0')} ${K('Entrée')} : il se décale de 3 m vers la droite.<br><small>Avec l'outil Déplacer, on clique aussi un point de base puis la destination.</small>`, wait: (c) => changes > c.k && G.sel().length > 0, init: (c) => { c.k = changes; } },
        { title: 'Rotation', target: 'btn-rotate', tip: 'Rotation<br><small>ou R + Entrée</small>', say: `Sélectionnez le <b>rectangle</b>, puis l'outil <b>Rotation</b> : cliquez le centre de rotation, tapez ${K('30')} ${K('Entrée')}.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'rotate') c.seen = true; } },
        { title: 'Copier / coller', say: `Sélectionnez un objet, ${K('Ctrl')}+${K('C')} puis ${K('Ctrl')}+${K('V')}, et cliquez où poser la copie.`, wait: (c) => G.shapes().length > c.n, init: (c) => { c.n = G.shapes().length; } },
        { title: 'Décaler', target: 'btn-offset', tip: 'Décaler<br><small>ou DE + Entrée</small>', say: `Outil <b>Décaler</b> : tapez ${K('1')} ${K('Entrée')} (distance 1 m), cliquez le rectangle, puis cliquez <b>à l'extérieur</b> : une copie parallèle apparaît, 1 m plus loin.`, wait: (c) => G.shapes().length > c.n && c.seen, init: (c) => { c.n = G.shapes().length; }, tick: (c) => { if (G.mode() === 'offset') c.seen = true; } },
        { title: 'Préparer la coupe', target: 'btn-line', tip: 'Droite', say: `Pour l'outil suivant, tracez une <b>droite qui traverse</b> le rectangle de part en part.`, wait: (c) => count('line') > c.lines, init: (c) => { c.lines = count('line'); } },
        { title: 'Couper', target: 'btn-trim', tip: 'Couper / ajuster<br><small>ou C + Entrée</small>', say: `Outil <b>Couper</b> : cliquez le <b>bout de la droite qui dépasse</b> du rectangle. Le morceau est supprimé jusqu'au croisement.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'trim') c.seen = true; } },
        { title: 'Prolonger', target: 'btn-extend', tip: 'Prolonger<br><small>ou P + Entrée</small>', say: `L'inverse : outil <b>Prolonger</b>, cliquez près du bout coupé de la droite : elle s'allonge jusqu'au trait suivant.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'extend') c.seen = true; } },
        { title: 'Agrandir', target: 'btn-scale-up', tip: 'Agrandir<br><small>Réduire juste à côté</small>', say: `Sélectionnez le cercle, outil <b>Agrandir</b>, tapez ${K('2')} ${K('Entrée')} : il double de taille. <b>Réduire</b> fait l'inverse.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'scale-up' || G.mode() === 'scale-down') c.seen = true; } },
        { title: 'Étirer', target: 'btn-stretch', tip: 'Étirer<br><small>ou ET + Entrée</small>', say: `Outil <b>Étirer</b> : tracez une fenêtre (2 coins) autour d'<b>un seul côté</b> du rectangle, cliquez un point de base puis la destination : le rectangle s'allonge, l'autre côté ne bouge pas.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'stretch') c.seen = true; } },
        { title: 'Copie miroir', target: 'btn-mirror', tip: 'Copie miroir<br><small>ou MI + Entrée</small>', say: `Sélectionnez un objet, outil <b>Copie miroir</b>, cliquez 2 points pour l'axe, puis ${K('Entrée')} : le reflet est créé, l'original reste.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'mirror') c.seen = true; } },
        { title: 'Arrondir', target: 'btn-fillet', tip: 'Arrondir<br><small>ou RA + Entrée</small>', say: `Tracez deux droites qui forment un angle, puis outil <b>Arrondir</b> : cliquez la 1<sup>re</sup> droite, la 2<sup>e</sup>, tapez le rayon ${K('1')} ${K('Entrée')}. Les droites sont raccordées par un arc.`, wait: (c) => changes > c.k && c.seen, init: (c) => { c.k = changes; }, tick: (c) => { if (G.mode() === 'fillet') c.seen = true; } },
        { title: 'Verrouiller', target: 'btn-group', tip: 'Verrouiller (bloc)', say: `Sélectionnez plusieurs objets (fenêtre à la souris), puis <b>Verrouiller</b> : ils forment un <b>bloc</b> qu'un seul clic sélectionne. <b>Éclater</b>, juste à côté, le défait.`, wait: (c) => changes > c.k, init: (c) => { c.k = changes; } },
        { title: 'Annuler', target: 'btn-undo', tip: 'Annuler<br><small>Ctrl+Z</small>', say: `Une erreur ? ${K('Ctrl')}+${K('Z')} annule la dernière action, ${K('Ctrl')}+${K('Y')} la rétablit. Essayez ${K('Ctrl')}+${K('Z')}.`, wait: (c) => G.hist() < c.h, init: (c) => { c.h = G.hist(); } },
        { title: 'Supprimer', say: `Pour effacer : sélectionnez puis ${K('Suppr')}. Une fenêtre tracée autour de tout le dessin, puis ${K('Suppr')}, nettoie l'exercice.`, manual: 'Suivant' },
        { title: 'Bravo !', say: `Vous connaissez les outils de base de <b>Dessin</b> et de <b>Modif</b>.<br><br>Pour aller plus loin :<br>• <b>Y</b> sur un objet sélectionné règle ses paramètres (calque, altitudes, plateforme…) ;<br>• le <b>guide</b> (bouton ⓘ en haut à droite) décrit chaque fonction, avec une recherche ; les autres tutos sont dans son dernier onglet, <b>🎓 Apprendre avec Momo</b> ;<br>• tapez les lettres d'une commande puis ${K('Entrée')} (DR, QR, RO…) pour aller plus vite.`, manual: 'Terminer', last: true },
    ];

    // ---------- interface ----------
    const CSS = `
    #mt-root { position:absolute; right:16px; bottom:52px; z-index:45; display:flex; align-items:flex-end; gap:10px; pointer-events:none; transition:right .25s; font-family: system-ui, 'Segoe UI', sans-serif; }
    #mt-bubble { pointer-events:auto; position:relative; width:330px; max-width:calc(100vw - 260px); background:#111827f2; color:#e5e7eb; border:1px solid #7c3aed; border-radius:14px; padding:12px 14px 10px; font-size:13.5px; line-height:1.45; box-shadow:0 12px 32px #0009; backdrop-filter: blur(4px); }
    #mt-bubble:after { content:''; position:absolute; right:-9px; bottom:34px; border:8px solid transparent; border-left-color:#7c3aed; border-right:0; }
    #mt-bubble .mt-h { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
    #mt-bubble .mt-t { font-weight:700; color:#fff; font-size:14.5px; }
    #mt-bubble .mt-n { color:#a78bfa; font-size:11px; font-weight:600; white-space:nowrap; }
    #mt-bubble .mt-x { color:#9ca3af; font-size:16px; line-height:1; padding:0 2px; background:none; border:0; cursor:pointer; }
    #mt-bubble .mt-x:hover { color:#fff; }
    #mt-bubble kbd { display:inline-block; min-width:18px; text-align:center; padding:0 5px; margin:0 1px; border:1px solid #6b7280; border-bottom-width:2px; border-radius:4px; background:#1f2937; color:#fde68a; font-family:ui-monospace,monospace; font-size:12px; }
    #mt-bubble small { color:#9ca3af; }
    #mt-bar { height:3px; background:#374151; border-radius:2px; margin:9px 0 8px; overflow:hidden; }
    #mt-bar i { display:block; height:100%; background:linear-gradient(90deg,#7c3aed,#f59e0b); transition:width .35s; }
    #mt-acts { display:flex; gap:6px; justify-content:flex-end; }
    #mt-acts button { border:0; border-radius:6px; padding:5px 10px; font-size:12.5px; font-weight:600; cursor:pointer; }
    .mt-sec { background:#374151; color:#e5e7eb; } .mt-sec:hover { background:#4b5563; }
    .mt-pri { background:#7c3aed; color:#fff; } .mt-pri:hover { background:#8b5cf6; }
    #mt-ok { color:#86efac; font-weight:700; }
    #mt-momo { pointer-events:auto; width:92px; height:112px; cursor:pointer; filter: drop-shadow(0 6px 10px #0008); animation: mt-float 3.2s ease-in-out infinite; }
    #mt-momo.jump { animation: mt-jump .6s ease-out; }
    #mt-momo .mt-eye { transform-box: fill-box; transform-origin:center; animation: mt-blink 4.6s infinite; }
    #mt-momo .mt-mouth { transform-box: fill-box; transform-origin:center top; }
    #mt-momo.talk .mt-mouth { animation: mt-talk .18s 6 alternate; }
    #mt-momo .mt-tassel { transform-box: view-box; transform-origin: 66px 22px; animation: mt-swing 2.4s ease-in-out infinite; }
    @keyframes mt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mt-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-22px) scale(1.06, .96); } 60% { transform: translateY(0) scale(.96, 1.05); } 100% { transform: translateY(0) scale(1); } }
    @keyframes mt-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
    @keyframes mt-talk { from { transform: scaleY(1); } to { transform: scaleY(.55); } }
    @keyframes mt-swing { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(7deg); } }
    #mt-ring { position:fixed; z-index:60; pointer-events:none; border:2px solid #f59e0b; border-radius:8px; box-shadow:0 0 0 4px #f59e0b44, 0 0 18px #f59e0b88; animation: mt-pulse 1.1s ease-in-out infinite; transition: all .25s; }
    @keyframes mt-pulse { 0%,100% { box-shadow:0 0 0 3px #f59e0b44, 0 0 10px #f59e0b66; } 50% { box-shadow:0 0 0 8px #f59e0b22, 0 0 22px #f59e0baa; } }
    #mt-tip { position:fixed; z-index:61; pointer-events:none; background:#f59e0b; color:#111827; font-weight:700; font-size:12.5px; line-height:1.3; padding:6px 10px; border-radius:8px; box-shadow:0 6px 16px #0008; white-space:nowrap; transition: top .25s, left .25s; }
    #mt-tip small { font-weight:500; color:#3b2a06; }
    #mt-tip:before { content:''; position:absolute; left:-7px; top:50%; margin-top:-7px; border:7px solid transparent; border-right-color:#f59e0b; border-left:0; }
    @media (prefers-reduced-motion: reduce) { #mt-momo, #mt-momo .mt-eye, #mt-momo .mt-tassel, #mt-ring { animation:none !important; } }`;

    // Momo : la toque de diplômé posée sur le visage O O / M du logo
    const MOMO_SVG = `<svg id="mt-momo" viewBox="0 0 100 122" xmlns="http://www.w3.org/2000/svg" aria-label="Momo, la mascotte">
        <defs><linearGradient id="mtCapTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5bc4"/><stop offset="1" stop-color="#3f2f86"/></linearGradient>
        <linearGradient id="mtCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c78"/><stop offset="1" stop-color="#271c55"/></linearGradient></defs>
        <path d="M27 24 Q50 32 73 24 L71 40 Q50 47 29 40 Z" fill="url(#mtCap)"/>
        <path d="M50 4 L94 20 L50 34 L6 20 Z" fill="url(#mtCapTop)" stroke="#2a1f5c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M6 20 L50 34 L94 20 L94 22.5 L50 36.5 L6 22.5 Z" fill="#2a1f5c"/>
        <circle cx="50" cy="19" r="2.6" fill="#f59e0b"/>
        <g class="mt-tassel"><path d="M50 19 Q60 21 66 22 L66 44" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M63 43 L69 43 L70 52 L62 52 Z" fill="#f59e0b"/><circle cx="66" cy="54" r="4.2" fill="#fb923c"/></g>
        <circle class="mt-eye" cx="32" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <circle class="mt-eye" cx="68" cy="64" r="11" fill="none" stroke="#a1a1aa" stroke-width="6.5"/>
        <path class="mt-mouth" d="M36 116 L36 88 L50 104 L64 88 L64 116" fill="none" stroke="#a1a1aa" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;

    // catalogue des tutos (affiché dans le guide, onglet « Apprendre avec Momo ») : ajouter les suivants ici
    const TUTOS = [
        { id: 'base', title: 'Les outils de base', desc: 'Dessin et Modif : droite, rectangle, cercle, arc, hachure, puis sélection, déplacer, rotation, couper, décaler…', minutes: 15, steps: BASE },
    ];
    let STEPS = BASE;
    let root, bubble, ring, tip, momo, idx = 0, ctx = {}, timer = null, okUntil = 0;

    function build() {
        if (!document.getElementById('mt-css')) { const st = document.createElement('style'); st.id = 'mt-css'; st.textContent = CSS; document.head.appendChild(st); }
        const host = document.getElementById('canvas-container') || document.body;
        root = document.createElement('div'); root.id = 'mt-root';
        root.innerHTML = `<div id="mt-bubble"></div>${MOMO_SVG}`;
        host.appendChild(root);
        bubble = root.querySelector('#mt-bubble'); momo = root.querySelector('#mt-momo');
        momo.addEventListener('click', () => { momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); });
        ring = document.createElement('div'); ring.id = 'mt-ring'; document.body.appendChild(ring);
        tip = document.createElement('div'); tip.id = 'mt-tip'; document.body.appendChild(tip);
        bubble.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); act(b.dataset.a); });
        bubble.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    function act(a) {
        if (a === 'x') return stop();
        if (a === 'prev') return go(Math.max(0, idx - 1));
        if (a === 'next') { if (STEPS[idx].last) return stop(true); return go(idx + 1); }
    }
    function render(okMsg) {
        const s = STEPS[idx], n = STEPS.length;
        const btns = [];
        if (idx > 0) btns.push(`<button class="mt-sec" data-a="prev" title="Étape précédente">◀</button>`);
        if (s.manual) btns.push(`<button class="mt-pri" data-a="next">${s.manual}</button>`);
        else btns.push(`<button class="mt-sec" data-a="next" title="Passer cette étape">Passer ▶</button>`);
        bubble.innerHTML = `<div class="mt-h"><span class="mt-t">${s.title}</span><span style="display:flex;align-items:center;gap:8px;"><span class="mt-n">${idx + 1} / ${n}</span><button class="mt-x" data-a="x" title="Arrêter la visite">✕</button></span></div>
            <div>${okMsg ? `<div id="mt-ok">✓ ${okMsg}</div>` : s.say}</div>
            <div id="mt-bar"><i style="width:${Math.round((idx + (okMsg ? 1 : 0)) / (n - 1) * 100)}%"></i></div><div id="mt-acts">${btns.join('')}</div>`;
        momo.classList.remove('talk'); void momo.getBoundingClientRect(); momo.classList.add('talk');
        place();
    }
    function targetEl() { const s = STEPS[idx]; return s && s.target ? document.getElementById(s.target) : null; }
    function place() {
        // à côté du panneau des propriétés (en bas à droite) quand il est ouvert
        const pp = document.getElementById('properties-popup');
        root.style.right = (pp && !pp.classList.contains('hidden') && pp.offsetWidth ? pp.offsetWidth + 40 : 16) + 'px';
        const t = targetEl(), s = STEPS[idx];
        if (!t) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        if (!t.offsetParent) { const pal = t.closest('.pal'); if (pal && pal.dataset.pal && typeof togglePal === 'function' && pal.classList.contains('closed')) togglePal(pal.dataset.pal); }
        const r = t.getBoundingClientRect();
        if (!r.width) { ring.style.display = 'none'; tip.style.display = 'none'; return; }
        const aside = t.closest('aside'); if (aside) { const ar = aside.getBoundingClientRect(); if (r.top < ar.top || r.bottom > ar.bottom) t.scrollIntoView({ block: 'nearest' }); }
        Object.assign(ring.style, { display: 'block', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
        if (s.tip) { tip.innerHTML = s.tip; tip.style.display = 'block'; const th = tip.offsetHeight; tip.style.left = (r.right + 14) + 'px'; tip.style.top = Math.max(6, r.top + r.height / 2 - th / 2) + 'px'; }
        else tip.style.display = 'none';
    }
    function go(i) {
        idx = Math.min(i, STEPS.length - 1); ctx = {}; okUntil = 0;
        const s = STEPS[idx]; if (s.init) s.init(ctx);
        render();
    }
    const BRAVO = ['Bravo !', 'Parfait !', 'Bien joué !', 'Exactement !', 'Super !', 'C\'est ça !'];
    function tick() {
        if (!root || !root.isConnected) return stop();
        place();
        if (okUntil) { if (Date.now() > okUntil) go(idx + 1); return; }
        const s = STEPS[idx];
        if (s.tick) s.tick(ctx);
        if (s.wait && !s.manual) {
            let ok = false; try { ok = s.wait(ctx); } catch (e) {}
            if (ok) { okUntil = Date.now() + 1100; render(BRAVO[idx % BRAVO.length]); momo.classList.remove('jump'); void momo.getBoundingClientRect(); momo.classList.add('jump'); }
        }
    }
    function start(id) {
        const T = TUTOS.find(t => t.id === id) || TUTOS[0]; STEPS = T.steps;
        if (root && root.isConnected) { go(0); return; }
        build(); go(0);
        clearInterval(timer); timer = setInterval(tick, 250);
        window.addEventListener('resize', place);
    }
    function stop() {
        clearInterval(timer); timer = null;
        [root, ring, tip].forEach(e => e && e.remove()); root = null;
        window.removeEventListener('resize', place);
    }
    window.MomoTuto = { start, stop, list: TUTOS };
})();
