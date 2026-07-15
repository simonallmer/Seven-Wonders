// ============================================
// CATHEDRAL 3D VIEW — "The Conversion"
// Greek-cross node mesh (Temple lattice), stones that change allegiance
// ============================================

window.is3DView = false;
let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupBoard = new THREE.Group();   // slabs, lines, node pads
const groupStones = new THREE.Group();
const groupTargets = new THREE.Group();
const groupFX = new THREE.Group();

const nodeMeshes = new Map();   // "x,y" -> clickable node pad
const stoneMeshes = new Map();  // "x,y" -> stone group

const CELL = 26, N = 15;
function wX(x) { return (x - (N - 1) / 2) * CELL; }
function wZ(y) { return (y - (N - 1) / 2) * CELL; }
const FLOOR_Y = 0;

const matFloor = new THREE.MeshStandardMaterial({ color: 0x5a5042, roughness: 1.0 });
const matSlab = new THREE.MeshStandardMaterial({ color: 0xb8ab92, roughness: 0.85 });
const matSlabSide = new THREE.MeshStandardMaterial({ color: 0x887d68, roughness: 0.9 });
const matLine = new THREE.MeshStandardMaterial({ color: 0x8d7f66, roughness: 0.75 });
const matNode = new THREE.MeshStandardMaterial({ color: 0x9c8d72, roughness: 0.65 });
const matNodeStrong = new THREE.MeshStandardMaterial({ color: 0xa89372, roughness: 0.55, metalness: 0.15 });
const matWalk = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matApproach = new THREE.MeshBasicMaterial({ color: 0xf0a050, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matWithdraw = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const matStop = new THREE.MeshBasicMaterial({ color: 0x9ea3ad, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const matSelect = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });

const PCOL = { W: 0xf3efe6, B: 0x232323, U: 0x3d6bb5, R: 0xa8362e };
const stoneMats = {};
Object.keys(PCOL).forEach(function (c) {
    stoneMats[c] = new THREE.MeshStandardMaterial({ color: PCOL[c], roughness: c === 'W' ? 0.25 : 0.42, metalness: 0.12 });
});
const matBevel = new THREE.MeshStandardMaterial({ color: 0xccaa44, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.15 });

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a4236);
    scene.fog = new THREE.FogExp2(0x4a4236, 0.0011);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 8000);
    camera.position.set(0, 420, 330);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 200; controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0, 0); controls.update();
    controls.addEventListener('change', function () { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xceb88a, 0x4a3f30, 0.6));
    const dir = new THREE.DirectionalLight(0xffe6bc, 0.95);
    dir.position.set(200, 420, 220); dir.castShadow = true;
    dir.shadow.camera.top = 320; dir.shadow.camera.bottom = -320;
    dir.shadow.camera.left = -340; dir.shadow.camera.right = 340;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 1500;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    dir.shadow.normalBias = 1.0; dir.shadow.bias = -0.0004;
    scene.add(dir);

    scene.add(groupEnv, groupBoard, groupStones, groupTargets, groupFX);
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
    ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR_Y - 8; ground.receiveShadow = true; groupEnv.add(ground);
    // four columns at the inner corners of the crossing
    const matCol = new THREE.MeshStandardMaterial({ color: 0x9a8c72, roughness: 0.8 });
    [[4.1, 4.1], [4.1, 9.9], [9.9, 4.1], [9.9, 9.9]].forEach(function (p) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 170, 14), matCol);
        col.position.set(wX(p[0]), FLOOR_Y + 85, wZ(p[1]));
        col.castShadow = true; groupEnv.add(col);
        const base = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 24), matCol);
        base.position.set(wX(p[0]), FLOOR_Y + 4, wZ(p[1])); base.castShadow = true; groupEnv.add(base);
    });
}

function buildBoard() {
    while (groupBoard.children.length) groupBoard.remove(groupBoard.children[0]);
    nodeMeshes.clear();
    const st = window.getCathState();

    // five 5x5 slabs — the cross itself
    const armSpan = 5 * CELL + 10;
    [[7, 7], [7, 2], [7, 12], [2, 7], [12, 7]].forEach(function (c) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(armSpan, 6, armSpan),
            [matSlabSide, matSlabSide, matSlab, matSlabSide, matSlabSide, matSlabSide]);
        slab.position.set(wX(c[0]), FLOOR_Y - 3, wZ(c[1]));
        slab.receiveShadow = true; groupBoard.add(slab);
    });

    // engraved lines of the Temple mesh
    st.edges.forEach(function (e) {
        const ax = wX(e.x1), az = wZ(e.y1), bx = wX(e.x2), bz = wZ(e.y2);
        const len = Math.hypot(bx - ax, bz - az);
        const line = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 1.6), matLine);
        line.position.set((ax + bx) / 2, FLOOR_Y + 0.5, (az + bz) / 2);
        line.rotation.y = -Math.atan2(bz - az, bx - ax);
        groupBoard.add(line);
    });

    // the ambulatory — exterior walkways arcing around each corner column
    const matPassage = new THREE.MeshStandardMaterial({ color: 0x8d7a58, roughness: 0.6, metalness: 0.2 });
    (st.passages || []).forEach(function (p) {
        const ax = wX(p[0][0]), az = wZ(p[0][1]);
        const bx = wX(p[1][0]), bz = wZ(p[1][1]);
        // bulge outward, away from the board center, past the column
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const len = Math.hypot(mx, mz) || 1;
        const ctrl = new THREE.Vector3(mx + (mx / len) * CELL * 2.6, 2, mz + (mz / len) * CELL * 2.6);
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(ax, 2, az), ctrl, new THREE.Vector3(bx, 2, bz));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 1.4, 8), matPassage);
        tube.castShadow = true;
        groupBoard.add(tube);
        // door rings at both mouths
        [[ax, az], [bx, bz]].forEach(function (m) {
            const door = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.19, 0.9, 8, 20), matPassage);
            door.rotation.x = -Math.PI / 2;
            door.position.set(m[0], 2.2, m[1]);
            groupBoard.add(door);
        });
    });

    // node pads — strong nodes slightly larger
    st.nodes.forEach(function (n) {
        const r = n.strong ? CELL * 0.17 : CELL * 0.13;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.2, 18), n.strong ? matNodeStrong : matNode);
        pad.position.set(wX(n.x), FLOOR_Y + 1.1, wZ(n.y));
        pad.receiveShadow = true;
        pad.userData = { x: n.x, y: n.y };
        groupBoard.add(pad); nodeMeshes.set(n.x + ',' + n.y, pad);
    });
}

function createStone(col) {
    const g = new THREE.Group();
    const mat = stoneMats[col];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 6, 22), mat); body.position.y = 3; body.castShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(4.4, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); top.position.y = 6; top.castShadow = true; g.add(top);
    const bevel = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 8, 22), matBevel); bevel.rotation.x = Math.PI / 2; bevel.position.y = 6; g.add(bevel);
    g.scale.set(1.35, 1.35, 1.35);
    g.userData.col = col;
    return g;
}
function paintStone(m, col) {
    m.userData.col = col;
    m.children.forEach(function (ch) { if (ch.material !== matBevel) ch.material = stoneMats[col]; });
}

function cathSync3D() {
    const st = window.getCathState();

    // stones — keyed by node; moves/conversions are animated separately
    const want = new Map();
    st.stones.forEach(function (s) { want.set(s.x + ',' + s.y, s); });
    Array.from(stoneMeshes.keys()).forEach(function (key) {
        if (!want.has(key)) { groupStones.remove(stoneMeshes.get(key)); stoneMeshes.delete(key); }
    });
    want.forEach(function (s, key) {
        let m = stoneMeshes.get(key);
        if (!m) { m = createStone(s.col); stoneMeshes.set(key, m); groupStones.add(m); m.position.set(wX(s.x), FLOOR_Y + 2, wZ(s.y)); }
        if (!m.userData.animating) {
            m.position.set(wX(s.x), FLOOR_Y + 2, wZ(s.y));
            if (m.userData.col !== s.col) paintStone(m, s.col);
        }
    });

    // target rings + selection halo
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    if (st.selected && !st.winner) {
        const halo = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.3, CELL * 0.42, 26), matSelect);
        halo.rotation.x = -Math.PI / 2;
        halo.position.set(wX(st.selected.x), FLOOR_Y + 2.0, wZ(st.selected.y));
        groupTargets.add(halo);
    }
    (st.targets || []).forEach(function (t) {
        let mat = matWalk, inner = CELL * 0.24, outer = CELL * 0.38;
        if (t.kind === 'approach') { mat = matApproach; inner = CELL * 0.28; outer = CELL * 0.42; }
        else if (t.kind === 'withdraw') { mat = matWithdraw; inner = CELL * 0.10; outer = CELL * 0.24; }
        else if (t.kind === 'stop') { mat = matStop; inner = CELL * 0.46; outer = CELL * 0.56; }
        const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 26), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(wX(t.x), FLOOR_Y + 2.4, wZ(t.y));
        ring.userData = { target: t };
        groupTargets.add(ring);
    });
    needsRender = true;
}

function cathRebuild() {
    while (groupStones.children.length) groupStones.remove(groupStones.children[0]);
    stoneMeshes.clear();
    buildBoard(); cathSync3D();
}

function cathAnimMove(from, to) {
    const fromKey = from.x + ',' + from.y, toKey = to.x + ',' + to.y;
    const m = stoneMeshes.get(fromKey); if (!m) return;
    stoneMeshes.delete(fromKey); stoneMeshes.set(toKey, m);
    const start = new THREE.Vector3(wX(from.x), FLOOR_Y + 2, wZ(from.y));
    const end = new THREE.Vector3(wX(to.x), FLOOR_Y + 2, wZ(to.y));
    m.position.copy(start); m.userData.animating = true;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 300).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { m.position.lerpVectors(start, end, o.t); m.position.y += Math.sin(Math.PI * o.t) * 8; needsRender = true; })
        .onComplete(function () { m.position.copy(end); m.userData.animating = false; cathSync3D(); }).start();
    needsRender = true;
}

// stones changing allegiance — a rising pulse, repainted at the apex,
// rippling outward from the converter
function cathAnimConvert(nodes, color) {
    nodes.forEach(function (n, i) {
        const m = stoneMeshes.get(n.x + ',' + n.y); if (!m) return;
        m.userData.animating = true;
        const baseY = FLOOR_Y + 2;
        const o = { t: 0 };
        let painted = false;
        new TWEEN.Tween(o).to({ t: 1 }, 380).delay(i * 90).easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function () {
                m.position.y = baseY + Math.sin(Math.PI * o.t) * 14;
                m.rotation.y = Math.PI * 2 * o.t;
                if (!painted && o.t >= 0.5) { paintStone(m, color); shimmer(m.position.x, m.position.y + 8, m.position.z); painted = true; }
                needsRender = true;
            })
            .onComplete(function () {
                m.position.y = baseY; m.rotation.y = 0;
                if (!painted) paintStone(m, color);
                m.userData.animating = false; cathSync3D();
            }).start();
    });
    needsRender = true;
}

function shimmer(x, y, z) {
    for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.TetrahedronGeometry(1.3), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
        s.position.set(x, y, z); groupFX.add(s);
        new TWEEN.Tween(s.position).to({ x: x + (Math.random() - 0.5) * 20, y: y + 4 + Math.random() * 12, z: z + (Math.random() - 0.5) * 20 }, 420).start();
        new TWEEN.Tween(s.material).to({ opacity: 0 }, 420).onComplete(function () { groupFX.remove(s); needsRender = true; }).start();
    }
    needsRender = true;
}

// ---- interaction ----
function setMouse(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1; }
function bubble(o, prop) { while (o && o.userData[prop] === undefined && o.parent) o = o.parent; return (o && o.userData[prop] !== undefined) ? o : null; }

// snap any world-space hit point to the nearest board node
function nodeFromPoint(p) {
    const x = Math.round(p.x / CELL + (N - 1) / 2);
    const y = Math.round(p.z / CELL + (N - 1) / 2);
    if (!nodeMeshes.has(x + ',' + y)) return null;
    return { x: x, y: y, r: Math.hypot(p.x - wX(x), p.z - wZ(y)) };
}
function nodeOfStoneMesh(s) {
    let out = null;
    stoneMeshes.forEach(function (m, key) { if (m === s) { const p = key.split(','); out = { x: +p[0], y: +p[1], r: 0 }; } });
    return out;
}
function targetsAt(st, x, y) {
    return (st.targets || []).filter(function (q) { return q.x === x && q.y === y; });
}

function onPointerDown(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    if (st.winner) return;

    // 1 — exact ring hits keep priority (precise choice when rings share a node)
    let hits = raycaster.intersectObjects(groupTargets.children, true);
    for (let i = 0; i < hits.length; i++) {
        const o = bubble(hits[i].object, 'target');
        if (o) { window.cathTapTarget(o.userData.target); return; }
    }
    // 2 — anything else: snap the hit to its nearest node, whole node is clickable
    hits = raycaster.intersectObjects([].concat(groupStones.children, groupBoard.children), true);
    for (let i = 0; i < hits.length; i++) {
        const s = bubble(hits[i].object, 'col');
        const n = s ? nodeOfStoneMesh(s) : nodeFromPoint(hits[i].point);
        if (!n) continue;
        const tl = targetsAt(st, n.x, n.y);
        if (tl.length === 1) { window.cathTapTarget(tl[0]); return; }
        if (tl.length > 1) {
            // approach (outer ring) vs withdraw (inner disc) — decide by click radius
            const wdr = tl.find(function (q) { return q.kind === 'withdraw'; });
            const app = tl.find(function (q) { return q.kind === 'approach'; });
            window.cathTapTarget((n.r <= CELL * 0.26 && wdr) ? wdr : (app || tl[0]));
            return;
        }
        window.cathSelect(n.x, n.y);
        return;
    }
    window.cathSelect(-1, -1); // clicked emptiness — clear selection
}

function onPointerMove(e) {
    if (!window.is3DView) return;
    setMouse(e); raycaster.setFromCamera(mouse, camera);
    const st = window.getCathState();
    if (st.winner) { renderer.domElement.style.cursor = 'default'; return; }
    let over = false;
    let hits = raycaster.intersectObjects(groupTargets.children, true);
    if (hits.length) over = true;
    if (!over) {
        hits = raycaster.intersectObjects([].concat(groupStones.children, groupBoard.children), true);
        for (let i = 0; i < hits.length && !over; i++) {
            const s = bubble(hits[i].object, 'col');
            const n = s ? nodeOfStoneMesh(s) : nodeFromPoint(hits[i].point);
            if (!n) continue;
            if (targetsAt(st, n.x, n.y).length) over = true;
            else if (s && s.userData.col === st.turn && !st.chaining) over = true;
            break;
        }
    }
    renderer.domElement.style.cursor = over ? 'pointer' : 'default';
}

function animate(t) { TWEEN.update(t); const cu = controls.update(); if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; } }

window.cathSync3D = cathSync3D;
window.cathRebuild = cathRebuild;
window.cathAnimMove = cathAnimMove;
window.cathAnimConvert = cathAnimConvert;

document.addEventListener('DOMContentLoaded', function () { init3D(); });
