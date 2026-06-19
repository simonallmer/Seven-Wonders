// ============================================
// CATHEDRAL 3D VIEW — chessboard, heights, side stairs (level reset)
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupCells = new THREE.Group();
const groupDeco = new THREE.Group();   // start bands + side stairs
const groupStones = new THREE.Group();
const groupTargets = new THREE.Group();
const groupFX = new THREE.Group();

const cellMeshes = new Map();
const pilMeshes = {};

const CELL = 40, W = 7, H = 7;
const LIFT = 22, BASE = -34;
function wX(x) { return (x - (W - 1) / 2) * CELL; }
function wZ(y) { return (y - (H - 1) / 2) * CELL; }
function topY(h) { return h * LIFT; }
function lvlY(L) { return L * LIFT; }

const matFieldW = new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 0.9 });
const matFieldB = new THREE.MeshStandardMaterial({ color: 0x4a4334, roughness: 0.9 });
const matFieldWdn = new THREE.MeshStandardMaterial({ color: 0xbcb195, roughness: 0.95 });
const matFieldBdn = new THREE.MeshStandardMaterial({ color: 0x3f3a2e, roughness: 0.95 });
const matStart = new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.6, metalness: 0.4 });
const matStair = new THREE.MeshStandardMaterial({ color: 0xB89048, roughness: 0.5, metalness: 0.5 });
const matSide = new THREE.MeshStandardMaterial({ color: 0xa99a78, roughness: 0.9 });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xE7C24A, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matGrass = new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 1.0 });
const matHomeW = new THREE.MeshBasicMaterial({ color: 0xf3efe6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const matHomeB = new THREE.MeshBasicMaterial({ color: 0x242424, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
const matMove = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matRaise = new THREE.MeshBasicMaterial({ color: 0xf2b441, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const matLower = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const matStairRing = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matExit = { '-1': new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
                  '0': new THREE.MeshBasicMaterial({ color: 0xe7dcc0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
                  '1': new THREE.MeshBasicMaterial({ color: 0xf2b441, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }) };

const PCOL = { W: { stone: 0xf3efe6 }, B: { stone: 0x232323 } };

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3cf91);
    scene.fog = new THREE.FogExp2(0xf3cf91, 0.0009);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 8000);
    camera.position.set(0, 360, 320);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 180; controls.maxDistance = 760;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0, 0); controls.update();
    controls.addEventListener('change', function () { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a6240, 0.95));
    const dir = new THREE.DirectionalLight(0xffe6bc, 1.4);
    dir.position.set(180, 380, 200); dir.castShadow = true;
    dir.shadow.camera.top = 280; dir.shadow.camera.bottom = -280;
    dir.shadow.camera.left = -300; dir.shadow.camera.right = 300;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 1400;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    dir.shadow.normalBias = 1.0; dir.shadow.bias = -0.0004;
    scene.add(dir);

    scene.add(groupEnv, groupCells, groupDeco, groupStones, groupTargets, groupFX);
    buildEnvironment();
    buildBoard();

    window.addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.setAnimationLoop(animate);

    if (window.cathReset) window.cathReset();
}
function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); needsRender = true; }

function buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 48), matGrass);
    ground.rotation.x = -Math.PI / 2; ground.position.y = BASE - 2; ground.receiveShadow = true; groupEnv.add(ground);
}

function buildBoard() {
    while (groupCells.children.length) groupCells.remove(groupCells.children[0]);
    while (groupDeco.children.length) groupDeco.remove(groupDeco.children[0]);
    cellMeshes.clear();
    const st = window.getCathState();
    st.cells.forEach(function (c) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(CELL - 1.5, 1, CELL - 1.5), [matSide, matSide, matFieldW, matSide, matSide, matSide]);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.x = wX(c.x); mesh.position.z = wZ(c.y);
        mesh.userData = { x: c.x, y: c.y };
        applyCellHeight(mesh, c);
        groupCells.add(mesh); cellMeshes.set(c.x + ',' + c.y, mesh);
        if (c.start) {
            const col = (c.y === 6) ? matHomeW : matHomeB;
            const band = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 8, CELL - 8), col);
            band.rotation.x = -Math.PI / 2; band.position.set(wX(c.x), topY(0) + 1.4, wZ(c.y)); groupDeco.add(band);
        }
    });
    // side stairs (off-board, attached at the middle of the left/right sides)
    st.stairs.forEach(function (s) { buildStair(s); });
}
function buildStair(s) {
    const cx = wX(s.x), cz = wZ(s.y);
    const isNS = s.side === 'N' || s.side === 'S';
    // spine offset direction (toward the outer edge, away from board)
    let sx = 0, sz = 0;
    if (s.side === 'L') { sx = -1; }
    else if (s.side === 'R') { sx = 1; }
    else if (s.side === 'N') { sz = -1; }
    else { sz = 1; } // S
    // spine — rotated 90° for N/S stairs so steps face the board
    const spine = new THREE.Mesh(
        new THREE.BoxGeometry(isNS ? CELL - 10 : 8, 3 * LIFT + 8, isNS ? 8 : CELL - 10),
        matStair
    );
    spine.position.set(cx + sx * CELL * 0.32, 0, cz + sz * CELL * 0.32);
    spine.castShadow = true; groupDeco.add(spine);
    // three landings: down / normal / up
    [-1, 0, 1].forEach(function (L) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL - 12, 4, CELL - 12), matStair);
        pad.position.set(cx, lvlY(L), cz);
        pad.castShadow = true; pad.receiveShadow = true;
        pad.userData = { stairSide: s.side }; groupDeco.add(pad);
        // post at the outer corner of each pad
        let px = 0, pz = 0;
        if (s.side === 'L' || s.side === 'N') { px = -1; } else { px = 1; }
        if (s.side === 'L' || s.side === 'R' || s.side === 'N') { pz = -1; } else { pz = 1; }
        const post = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, LIFT, 8), matStart);
        post.position.set(cx + px * CELL * 0.28, lvlY(L) - LIFT / 2, cz + pz * CELL * 0.3);
        groupDeco.add(post);
    });
}

function cellTopMat(c) {
    const col = (c.color || (((c.x + c.y) % 2 === 0) ? 'W' : 'B'));
    if (col === 'W') return c.h < 0 ? matFieldWdn : matFieldW;
    return c.h < 0 ? matFieldBdn : matFieldB;
}
function applyCellHeight(mesh, c) {
    const top = topY(c.h), boxH = top - BASE;
    mesh.scale.y = boxH; mesh.position.y = BASE + boxH / 2;
    if (Array.isArray(mesh.material)) mesh.material[2] = cellTopMat(c);
}

function createStone(colorHex, dark) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: dark ? 0.45 : 0.25, metalness: 0.12 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 6, 22), mat); body.position.y = 3; body.castShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(4.4, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); top.position.y = 6; top.castShadow = true; g.add(top);
    const bevel = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 8, 22), matBevel); bevel.rotation.x = Math.PI / 2; bevel.position.y = 6; g.add(bevel);
    g.scale.set(2.0, 2.0, 2.0);
    return g;
}
function pilY(p) { return (p.onStair ? lvlY(0) : lvlY(p.level)) + 4; }

function cathSync3D() {
    const st = window.getCathState();
    const byKey = {}; st.cells.forEach(function (c) { byKey[c.x + ',' + c.y] = c; });
    cellMeshes.forEach(function (mesh, key) { const c = byKey[key]; if (c && !mesh.userData.animating) applyCellHeight(mesh, c); });

    ['W', 'B'].forEach(function (col) {
        const p = st.pilgrims[col];
        let m = pilMeshes[col];
        if (!m) { m = createStone(PCOL[col].stone, col !== 'W'); pilMeshes[col] = m; groupStones.add(m); }
        if (!m.userData.animating) m.position.set(wX(p.x), pilY(p), wZ(p.y));
    });

    const lvl = st.pilgrims[st.turn].level;
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    st.moveTargets.forEach(function (t) {
        let mat = matMove, y = lvlY(lvl) + 1.6;
        if (t.kind === 'stair') { mat = matStairRing; y = lvlY(0) + 5; }
        else if (t.kind === 'exit') { mat = matExit[String(t.level)]; y = lvlY(t.level) + 5; }
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.26, CELL * 0.4, 26), mat);
        ring.rotation.x = -Math.PI / 2; ring.position.set(wX(t.x), y, wZ(t.y));
        ring.userData = { target: t }; groupTargets.add(ring);
    });
    needsRender = true;
}

function cathRebuild() {
    while (groupStones.children.length) groupStones.remove(groupStones.children[0]);
    for (const k in pilMeshes) delete pilMeshes[k];
    buildBoard(); cathSync3D();
}

function cathAnimMove(color, from, to) {
    const m = pilMeshes[color]; if (!m) return;
    const yF = (from.onStair ? lvlY(0) : lvlY(from.level || 0)) + 4;
    const yT = (to.onStair ? lvlY(0) : lvlY(to.level || 0)) + 4;
    const start = new THREE.Vector3(wX(from.x), yF, wZ(from.y));
    const end = new THREE.Vector3(wX(to.x), yT, wZ(to.y));
    m.position.copy(start); m.userData.animating = true;
    const o = { t: 0 }, hop = Math.abs(yT - yF) > 1 ? 5 : 7;
    new TWEEN.Tween(o).to({ t: 1 }, 320).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { m.position.lerpVectors(start, end, o.t); m.position.y += Math.sin(Math.PI * o.t) * hop; needsRender = true; })
        .onComplete(function () { m.position.copy(end); m.userData.animating = false; needsRender = true; }).start();
    needsRender = true;
}

function cathAnimLift(x, y, newH) {
    const mesh = cellMeshes.get(x + ',' + y); if (!mesh) return;
    mesh.userData.animating = true;
    const top = topY(newH), boxH = top - BASE;
    const fS = mesh.scale.y, fP = mesh.position.y, tS = boxH, tP = BASE + boxH / 2;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 300).easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(function () { mesh.scale.y = fS + (tS - fS) * o.t; mesh.position.y = fP + (tP - fP) * o.t; needsRender = true; })
        .onComplete(function () { mesh.userData.animating = false; needsRender = true; }).start();
    mesh.material[2] = cellTopMat({ x: x, y: y, h: newH, color: ((x + y) % 2 === 0) ? 'W' : 'B' });
    dust(wX(x), top, wZ(y)); needsRender = true;
}
function dust(x, y, z) {
    for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.TetrahedronGeometry(1.4), new THREE.MeshBasicMaterial({ color: 0xddcba6, transparent: true, opacity: 0.9 }));
        s.position.set(x, y, z); groupFX.add(s);
        new TWEEN.Tween(s.position).to({ x: x + (Math.random() - 0.5) * 22, y: y + 6 - Math.random() * 14, z: z + (Math.random() - 0.5) * 22 }, 420).start();
        new TWEEN.Tween(s.material).to({ opacity: 0 }, 420).onComplete(function () { groupFX.remove(s); needsRender = true; }).start();
    }
    needsRender = true;
}

// ---- interaction ----
function setMouse(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1; }
function bubble(o, prop) { while (o && o.userData[prop] === undefined && o.parent) o = o.parent; return (o && o.userData[prop] !== undefined) ? o : null; }
function onPointerDown(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    if (st.mode === 'move') {
        const hits = raycaster.intersectObjects([].concat(groupTargets.children, groupCells.children, groupDeco.children), true);
        const targets = st.moveTargets;
        // 1) a stacked exit ring needs a precise hit (three at one cell)
        for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'target'); if (o && o.userData.target.kind === 'exit') { window.cathTapTarget(o.userData.target); return; } }
        // 2) clicking anywhere on a target FIELD moves there
        for (let i = 0; i < hits.length; i++) {
            const c = bubble(hits[i].object, 'x'); if (!c) continue;
            const t = targets.find(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'exit'; });
            if (t) { window.cathTapTarget(t); return; }
        }
        // 3) clicking the side-stair structure enters it
        for (let i = 0; i < hits.length; i++) {
            const s = bubble(hits[i].object, 'stairSide'); if (!s) continue;
            const t = targets.find(function (q) { return q.kind === 'stair' && q.side === s.userData.stairSide; });
            if (t) { window.cathTapTarget(t); return; }
        }
        // 4) fall back to any target ring
        for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'target'); if (o) { window.cathTapTarget(o.userData.target); return; } }
    } else {
        const hits = raycaster.intersectObjects(groupCells.children, true);
        for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'x'); if (o) { window.cathTapLift(o.userData.x, o.userData.y); return; } }
    }
}
function onPointerMove(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    let over = false;
    if (st.mode === 'move') {
        const hits = raycaster.intersectObjects([].concat(groupTargets.children, groupCells.children, groupDeco.children), true);
        const targets = st.moveTargets;
        for (let i = 0; i < hits.length && !over; i++) {
            const o = bubble(hits[i].object, 'target'); if (o) { over = true; break; }
            const c = bubble(hits[i].object, 'x'); if (c && targets.some(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'exit'; })) over = true;
            const s = bubble(hits[i].object, 'stairSide'); if (s && targets.some(function (q) { return q.kind === 'stair' && q.side === s.userData.stairSide; })) over = true;
        }
    } else {
        over = raycaster.intersectObjects(groupCells.children, true).length > 0;
    }
    renderer.domElement.style.cursor = over ? 'pointer' : 'default';
}

function animate(t) { TWEEN.update(t); const cu = controls.update(); if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; } }

window.cathSync3D = cathSync3D;
window.cathRebuild = cathRebuild;
window.cathAnimMove = cathAnimMove;
window.cathAnimLift = cathAnimLift;

document.addEventListener('DOMContentLoaded', function () { init3D(); });
