// ============================================
// CATHEDRAL 3D VIEW — + cross board, terrain height, wide stairs at tips
// ============================================

window.is3DView = false;
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

const CELL = 40, W = 9, H = 9;
const LIFT = 22, BASE = -34;
function wX(x) { return (x - (W - 1) / 2) * CELL; }
function wZ(y) { return (y - (H - 1) / 2) * CELL; }
function topY(h) { return h * LIFT; }
function lvlY(L) { return L * LIFT; }

const matField = new THREE.MeshStandardMaterial({ color: 0xb8ab92, roughness: 0.85 });
const matFieldLo = new THREE.MeshStandardMaterial({ color: 0x9a8d78, roughness: 0.9 });
const matStart = new THREE.MeshStandardMaterial({ color: 0xb09060, roughness: 0.6, metalness: 0.3 });
const matStair = new THREE.MeshStandardMaterial({ color: 0x9a8558, roughness: 0.6, metalness: 0.3 });
const matSide = new THREE.MeshStandardMaterial({ color: 0x887d68, roughness: 0.9 });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.15 });
const matFloor = new THREE.MeshStandardMaterial({ color: 0x5a5042, roughness: 1.0 });
const matHomeW = new THREE.MeshBasicMaterial({ color: 0xf3efe6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
const matHomeB = new THREE.MeshBasicMaterial({ color: 0x242424, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
const matMove = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matVault = new THREE.MeshBasicMaterial({ color: 0xf0c040, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matStruggle = new THREE.MeshBasicMaterial({ color: 0xe05050, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matStairRing = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matExit = { '-1': new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
                  '0': new THREE.MeshBasicMaterial({ color: 0xe7dcc0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
                  '1': new THREE.MeshBasicMaterial({ color: 0xf2b441, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }) };

const PCOL = { W: { stone: 0xf3efe6 }, B: { stone: 0x232323 } };

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7a6e5a);
    scene.fog = new THREE.FogExp2(0x7a6e5a, 0.0012);

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
    const dir = new THREE.DirectionalLight(0xffe6bc, 0.9);
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

    window.is3DView = true;
    if (window.cathReset) window.cathReset();
}
function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); needsRender = true; }

function buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 48), matFloor);
    ground.rotation.x = -Math.PI / 2; ground.position.y = BASE - 2; ground.receiveShadow = true; groupEnv.add(ground);
    // dim the hemisphere light for interior feel
    scene.children.forEach(function (c) { if (c.isHemisphereLight) { c.intensity = 0.55; c.color.setHex(0xceb88a); c.groundColor.setHex(0x4a3f30); } });
}

function cCross(x, y) { return (x >= 3 && x <= 5 || y >= 3 && y <= 5); }

function buildBoard() {
    while (groupCells.children.length) groupCells.remove(groupCells.children[0]);
    while (groupDeco.children.length) groupDeco.remove(groupDeco.children[0]);
    cellMeshes.clear();
    const st = window.getCathState();
    st.cells.forEach(function (c) {
        if (!cCross(c.x, c.y)) return;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(CELL - 1.5, 1, CELL - 1.5), [matSide, matSide, matField, matSide, matSide, matSide]);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.x = wX(c.x); mesh.position.z = wZ(c.y);
        mesh.userData = { x: c.x, y: c.y };
        applyCellHeight(mesh, c);
        groupCells.add(mesh); cellMeshes.set(c.x + ',' + c.y, mesh);
        if (c.start) {
            // B = (4,0) & (4,8), W = (0,4) & (8,4)
            const isW = c.y === 4;
            const col = isW ? matHomeW : matHomeB;
            const band = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 8, CELL - 8), col);
            band.rotation.x = -Math.PI / 2; band.position.set(wX(c.x), topY(0) + 1.4, wZ(c.y)); groupDeco.add(band);
        }
    });
    // side stairs (off-board, attached at the middle of all four sides)
    st.stairs.forEach(function (s) { buildStair(s); });
}
function buildStair(s) {
    if (!s.adjs) return;
    // span covers the adj cells' width; platform sits at the off-board stair position
    let loX = Infinity, loY = Infinity, hiX = -Infinity, hiY = -Infinity;
    s.adjs.forEach(function (a) { if (a.x < loX) loX = a.x; if (a.x > hiX) hiX = a.x; if (a.y < loY) loY = a.y; if (a.y > hiY) hiY = a.y; });
    const isNS = s.side === 'N' || s.side === 'S';
    const wide = (isNS ? (hiX - loX + 1) : (hiY - loY + 1)) * CELL - 4;
    const narrow = CELL - 4;
    const pw = isNS ? wide : narrow;
    const pd = isNS ? narrow : wide;
    const cx = wX(s.x), cz = wZ(s.y);
    [-1, 0, 1].forEach(function (L) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(pw, 4, pd), matStair);
        pad.position.set(cx, lvlY(L), cz);
        pad.castShadow = true; pad.receiveShadow = true;
        pad.userData = { stairSide: s.side }; groupDeco.add(pad);
    });
}

function cellTopMat(c) {
    return c.h < 0 ? matFieldLo : matField;
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

    // render all 4 stones
    ['W', 'B'].forEach(function (col) {
        const arr = st.pilgrims[col];
        if (!arr) return;
        arr.forEach(function (p) {
            const key = col + p.idx;
            let m = pilMeshes[key];
            if (!m) { m = createStone(PCOL[col].stone, col !== 'W'); pilMeshes[key] = m; groupStones.add(m); }
            if (!m.userData.animating) m.position.set(wX(p.x), pilY(p), wZ(p.y));
        });
    });

    const cellsByKey = {}; st.cells.forEach(function (c) { cellsByKey[c.x + ',' + c.y] = c; });
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    (st.targets || []).forEach(function (t) {
        let mat = matMove, targetLevel = 0;
        if (t.kind === 'stair') { mat = matStairRing; targetLevel = 0; }
        else if (t.kind === 'exit') { mat = matExit[String(t.level)]; targetLevel = t.level; }
        else if (t.kind === 'vault') { mat = matVault; targetLevel = (cellsByKey[t.x + ',' + t.y] || {}).h || 0; }
        else if (t.kind === 'struggle') { mat = matStruggle; targetLevel = (cellsByKey[t.x + ',' + t.y] || {}).h || 0; }
        else {
            const cell = cellsByKey[t.x + ',' + t.y];
            targetLevel = cell ? cell.h : 0;
        }
        const y = lvlY(targetLevel) + (t.kind === 'stair' ? 5 : t.kind === 'struggle' ? 7 : 1.6);
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

function cathAnimMove(color, idx, from, to) {
    const key = color + idx;
    const m = pilMeshes[key]; if (!m) return;
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
    if (st.winner) return;
    const hits = raycaster.intersectObjects([].concat(groupTargets.children, groupCells.children, groupDeco.children), true);
    const targets = st.targets || [];

    // 1 — exit target rings
    for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'target'); if (o && o.userData.target.kind === 'exit') { window.cathTapTarget(o.userData.target); return; } }

    // 2 — cell hits → individual target or rally
    let rallyCell = null;
    for (let i = 0; i < hits.length; i++) {
        const c = bubble(hits[i].object, 'x'); if (!c) continue;
        rallyCell = rallyCell || { x: c.userData.x, y: c.userData.y };
        const t = targets.find(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'exit' && q.kind !== 'vault'; });
        if (t) { window.cathTapTarget(t); return; }
    }

    // 3 — stair sides
    for (let i = 0; i < hits.length; i++) {
        const s = bubble(hits[i].object, 'stairSide'); if (!s) continue;
        const t = targets.find(function (q) { return q.kind === 'stair' && q.side === s.userData.stairSide; });
        if (t) { window.cathTapTarget(t); return; }
    }

    // 4 — vault / any remaining target ring
    for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'target'); if (o) { window.cathTapTarget(o.userData.target); return; } }

    // 5 — rally toward the clicked cell
    if (rallyCell && window.cathTryRally) window.cathTryRally(rallyCell.x, rallyCell.y);
}
function onPointerMove(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    if (st.winner) { renderer.domElement.style.cursor = 'default'; return; }
    const hits = raycaster.intersectObjects([].concat(groupTargets.children, groupCells.children, groupDeco.children), true);
    const targets = st.targets || [];
    let over = false;
    for (let i = 0; i < hits.length && !over; i++) {
        const o = bubble(hits[i].object, 'target'); if (o) { over = true; break; }
        const c = bubble(hits[i].object, 'x');
        if (c) {
            if (targets.some(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'exit' && q.kind !== 'vault'; })) over = true;
            else if (cInView(c.userData.x, c.userData.y)) over = true; // rally-eligible
        }
        const s = bubble(hits[i].object, 'stairSide'); if (s && targets.some(function (q) { return q.kind === 'stair' && q.side === s.userData.stairSide; })) over = true;
    }
    renderer.domElement.style.cursor = over ? 'pointer' : 'default';
}
function cInView(x, y) { return x >= 0 && x < 9 && y >= 0 && y < 9 && (x >= 3 && x <= 5 || y >= 3 && y <= 5); }

function animate(t) { TWEEN.update(t); const cu = controls.update(); if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; } }

window.cathSync3D = cathSync3D;
window.cathRebuild = cathRebuild;
window.cathAnimMove = cathAnimMove;
window.cathAnimLift = cathAnimLift;

document.addEventListener('DOMContentLoaded', function () { init3D(); });
