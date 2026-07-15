// ============================================
// CATHEDRAL 3D VIEW — + cross board, crumbling terrain
// ============================================

window.is3DView = false;
let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupCells = new THREE.Group();
const groupDeco = new THREE.Group();   // start bands
const groupStones = new THREE.Group();
const groupTargets = new THREE.Group();
const groupFX = new THREE.Group();

const cellMeshes = new Map();
const pilMeshes = {};

const CELL = 40, W = 9, H = 9;
const LIFT = 22, BASE = -34, STACK_LIFT = 15, HOLE_DEPTH = -2;
function wX(x) { return (x - (W - 1) / 2) * CELL; }
function wZ(y) { return (y - (H - 1) / 2) * CELL; }
function topY(h) { return h * LIFT; }
function lvlY(L) { return L * LIFT; }

const matField = new THREE.MeshStandardMaterial({ color: 0xb8ab92, roughness: 0.85 });
const matCracked = new THREE.MeshStandardMaterial({ color: 0xb5673a, roughness: 0.9 });
const matHole = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 1.0 });
const matSide = new THREE.MeshStandardMaterial({ color: 0x887d68, roughness: 0.9 });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.15 });
const matFloor = new THREE.MeshStandardMaterial({ color: 0x5a5042, roughness: 1.0 });
const matHomeW = new THREE.MeshBasicMaterial({ color: 0xf3efe6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
const matHomeB = new THREE.MeshBasicMaterial({ color: 0x242424, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
const matMove = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matStep1 = new THREE.MeshBasicMaterial({ color: 0xf0a050, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matHop = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matVault = new THREE.MeshBasicMaterial({ color: 0xf0c040, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matStuck = new THREE.MeshBasicMaterial({ color: 0xe05050, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matDismount = new THREE.MeshBasicMaterial({ color: 0xc080f0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matStop = new THREE.MeshBasicMaterial({ color: 0x9ea3ad, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matCenter = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

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

function buildBoard() {
    while (groupCells.children.length) groupCells.remove(groupCells.children[0]);
    while (groupDeco.children.length) groupDeco.remove(groupDeco.children[0]);
    cellMeshes.clear();
    const st = window.getCathState();
    st.cells.forEach(function (c) {
        if (!c.inPlay) return;
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
        if (c.center) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.15, CELL * 0.42, 24), matCenter);
            ring.rotation.x = -Math.PI / 2; ring.position.set(wX(c.x), topY(0) + 1.4, wZ(c.y)); groupDeco.add(ring);
        }
    });
}

function cellRenderH(c) { return c.crack >= 2 ? HOLE_DEPTH : 0; }
function cellTopMat(c) {
    if (c.crack >= 2) return matHole;
    if (c.crack === 1) return matCracked;
    return matField;
}
function applyCellHeight(mesh, c) {
    const top = topY(cellRenderH(c)), boxH = top - BASE;
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
function pilY(p) { return 4 + (p.riding ? STACK_LIFT : 0); }

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

    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    (st.targets || []).forEach(function (t) {
        let mat = matMove; // step2
        if (t.kind === 'vault') mat = matVault;
        else if (t.kind === 'stuck') mat = matStuck;
        else if (t.kind === 'dismount') mat = matDismount;
        else if (t.kind === 'step1') mat = matStep1;
        else if (t.kind === 'hop') mat = matHop;
        else if (t.kind === 'stop') mat = matStop;
        const y = topY(0) + (t.kind === 'stuck' ? 7 : t.kind === 'dismount' ? 1.6 + STACK_LIFT : 1.6);
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
    const yF = 4 + (from.riding ? STACK_LIFT : 0);
    const yT = 4 + (to.riding ? STACK_LIFT : 0);
    const start = new THREE.Vector3(wX(from.x), yF, wZ(from.y));
    const end = new THREE.Vector3(wX(to.x), yT, wZ(to.y));
    m.position.copy(start); m.userData.animating = true;
    const o = { t: 0 }, hop = Math.abs(yT - yF) > 1 ? 5 : 7;
    new TWEEN.Tween(o).to({ t: 1 }, 320).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { m.position.lerpVectors(start, end, o.t); m.position.y += Math.sin(Math.PI * o.t) * hop; needsRender = true; })
        .onComplete(function () { m.position.copy(end); m.userData.animating = false; needsRender = true; }).start();
    needsRender = true;
}

// crackLevel: 1 = cracked (cosmetic), 2 = destroyed (sinks into a pit)
function cathAnimCrack(x, y, crackLevel) {
    const mesh = cellMeshes.get(x + ',' + y); if (!mesh) return;
    mesh.userData.animating = true;
    const newH = crackLevel >= 2 ? HOLE_DEPTH : 0;
    const top = topY(newH), boxH = top - BASE;
    const fS = mesh.scale.y, fP = mesh.position.y, tS = boxH, tP = BASE + boxH / 2;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 300).easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(function () { mesh.scale.y = fS + (tS - fS) * o.t; mesh.position.y = fP + (tP - fP) * o.t; needsRender = true; })
        .onComplete(function () { mesh.userData.animating = false; needsRender = true; }).start();
    mesh.material[2] = cellTopMat({ crack: crackLevel });
    dust(wX(x), top, wZ(y)); needsRender = true;
}
// central gravity: a hole permanently shortens its own lane by one cell —
// the other two lanes of the arm stay put, so the edge goes ragged, not
// flat. The doomed outer cell crumbles away, any stranded stone slides in
// to the new tip, and the board is rebuilt slightly smaller once the dust settles.
function cathAnimCollapse(arm, lane, oldMax, newMax, moved) {
    for (let d = newMax + 1; d <= oldMax; d++) {
        let cx, cy;
        if (arm === 'N') { cx = lane; cy = 3 - d; }
        else if (arm === 'S') { cx = lane; cy = 5 + d; }
        else if (arm === 'W') { cx = 3 - d; cy = lane; }
        else { cx = 5 + d; cy = lane; }
        const key = cx + ',' + cy;
        const mesh = cellMeshes.get(key); if (!mesh) continue;
        mesh.userData.animating = true;
        const startY = mesh.position.y, startSx = mesh.scale.x, startSz = mesh.scale.z;
        const o = { t: 0 };
        new TWEEN.Tween(o).to({ t: 1 }, 420).easing(TWEEN.Easing.Quadratic.In)
            .onUpdate(function () {
                mesh.position.y = startY - 44 * o.t;
                const sc = 1 - 0.7 * o.t;
                mesh.scale.set(startSx * sc, mesh.scale.y, startSz * sc);
                needsRender = true;
            })
            .onComplete(function () { groupCells.remove(mesh); cellMeshes.delete(key); needsRender = true; }).start();
        dust(wX(cx), startY, wZ(cy));
    }
    (moved || []).forEach(function (m) {
        cathAnimMove(m.col, m.idx, { x: m.from.x, y: m.from.y, riding: false }, { x: m.to.x, y: m.to.y, riding: false });
    });
    setTimeout(function () { if (window.cathRebuild) window.cathRebuild(); }, 460);
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
    const cellsByKey = {}; st.cells.forEach(function (c) { cellsByKey[c.x + ',' + c.y] = c; });

    // 1 — cell hits → individual target or rally
    let rallyCell = null;
    for (let i = 0; i < hits.length; i++) {
        const c = bubble(hits[i].object, 'x'); if (!c) continue;
        const cell = cellsByKey[c.userData.x + ',' + c.userData.y];
        if (!rallyCell && (!cell || cell.crack < 2)) rallyCell = { x: c.userData.x, y: c.userData.y };
        const t = targets.find(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'vault'; });
        if (t) { window.cathTapTarget(t); return; }
    }

    // 2 — vault / any remaining target ring
    for (let i = 0; i < hits.length; i++) { const o = bubble(hits[i].object, 'target'); if (o) { window.cathTapTarget(o.userData.target); return; } }

    // 3 — rally toward the clicked cell
    if (rallyCell && window.cathTryRally) window.cathTryRally(rallyCell.x, rallyCell.y);
}
function onPointerMove(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    if (st.winner) { renderer.domElement.style.cursor = 'default'; return; }
    const hits = raycaster.intersectObjects([].concat(groupTargets.children, groupCells.children, groupDeco.children), true);
    const targets = st.targets || [];
    const cellsByKey = {}; st.cells.forEach(function (c) { cellsByKey[c.x + ',' + c.y] = c; });
    let over = false;
    for (let i = 0; i < hits.length && !over; i++) {
        const o = bubble(hits[i].object, 'target'); if (o) { over = true; break; }
        const c = bubble(hits[i].object, 'x');
        if (c) {
            if (targets.some(function (q) { return q.x === c.userData.x && q.y === c.userData.y && q.kind !== 'vault'; })) over = true;
            else {
                const cell = cellsByKey[c.userData.x + ',' + c.userData.y];
                if ((!cell || cell.crack < 2) && cInView(c.userData.x, c.userData.y)) over = true; // rally-eligible
            }
        }
    }
    renderer.domElement.style.cursor = over ? 'pointer' : 'default';
}
function cInView(x, y) { return cellMeshes.has(x + ',' + y); }

function animate(t) { TWEEN.update(t); const cu = controls.update(); if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; } }

window.cathSync3D = cathSync3D;
window.cathRebuild = cathRebuild;
window.cathAnimMove = cathAnimMove;
window.cathAnimCrack = cathAnimCrack;
window.cathAnimCollapse = cathAnimCollapse;

document.addEventListener('DOMContentLoaded', function () { init3D(); });
