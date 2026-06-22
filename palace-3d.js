// ============================================
// PALACE 3D VIEW — "The Span" (Crystal Palace, glass & cast iron)
// Two phases:
//   setup — field pads + oriented placement stones
//   play  — standing stones, Run targets
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupBuild = new THREE.Group();   // per-voxel glass + frames + caps
const groupPads = new THREE.Group();    // setup: clickable fields
const groupStones = new THREE.Group();
const groupSel = new THREE.Group();     // setup held-ring
const groupTargets = new THREE.Group(); // play: run/climb/shatter rings
const groupHover = new THREE.Group();
const groupFX = new THREE.Group();

const voxelMeshes = new Map();  // "x,y,k" -> [meshes]
const padMeshes = new Map();    // fieldId -> pad
const stoneMeshes = new Map();  // key -> stone group ('p'+id in play, fieldId in setup)
let hoverKey = null;

// ---- layout ----
const CELL = 30;
const STEP = 26;
const W = 7, D = 5;
function worldX(x) { return (x - (W - 1) / 2) * CELL; }
function worldZ(y) { return (y - (D - 1) / 2) * CELL; }
function levelTop(l) { return l * STEP; }
function standPos(x, y, k) { return new THREE.Vector3(worldX(x), k * STEP + 0.2, worldZ(y)); }

// ---- field geometry (setup) ----
const UP = new THREE.Vector3(0, 1, 0);
const ZAX = new THREE.Vector3(0, 0, 1);
function fieldNormal(face) {
    switch (face) {
        case 'top': return new THREE.Vector3(0, 1, 0);
        case 'px': return new THREE.Vector3(1, 0, 0);
        case 'nx': return new THREE.Vector3(-1, 0, 0);
        case 'pz': return new THREE.Vector3(0, 0, 1);
        case 'nz': return new THREE.Vector3(0, 0, -1);
    }
    return new THREE.Vector3(0, 1, 0);
}
function fieldQuat(face) { return new THREE.Quaternion().setFromUnitVectors(UP, fieldNormal(face)); }
function ringQuat(face) { return new THREE.Quaternion().setFromUnitVectors(ZAX, fieldNormal(face)); }
function ringQuatN(n) { return new THREE.Quaternion().setFromUnitVectors(ZAX, n); }
function fieldCenter(f) {
    const cx = worldX(f.x), cz = worldZ(f.y);
    if (f.face === 'top') return new THREE.Vector3(cx, f.k * STEP + 0.2, cz);
    const n = fieldNormal(f.face), vy = (f.k + 0.5) * STEP;
    return new THREE.Vector3(cx + n.x * (CELL / 2), vy, cz + n.z * (CELL / 2));
}
function stoneFieldPos(f) {
    const c = fieldCenter(f);
    if (f.face !== 'top') c.add(fieldNormal(f.face).multiplyScalar(0.5));
    return c;
}

// ---- materials ----
const GLASS = [null,
    { color: 0x8fb6d6, op: 0.6 },   // L1
    { color: 0x7aa6cf, op: 0.64 },  // L2
    { color: 0xdcc06a, op: 0.72 },  // L3 ridge
    { color: 0xd8b85e, op: 0.74 },  // L4 transept
    { color: 0xd2af50, op: 0.78 }]; // L5 transept top
const matFrame = new THREE.LineBasicMaterial({ color: 0xC5A059, transparent: true, opacity: 0.9 });
const matFrameRidge = new THREE.LineBasicMaterial({ color: 0xE7C24A, transparent: true, opacity: 1.0 });
const matCap = [null,
    new THREE.MeshStandardMaterial({ color: 0xc6dcec, roughness: 0.25, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0xbcd2e6, roughness: 0.25, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0xeed99a, roughness: 0.25, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0xeacf86, roughness: 0.25, metalness: 0.12 }),
    new THREE.MeshStandardMaterial({ color: 0xe6c873, roughness: 0.25, metalness: 0.14 })];
const matGoalW = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
const matGoalB = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xE7C24A, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.35, metalness: 0.75 });
const matPortal = new THREE.MeshStandardMaterial({ color: 0x2a2417, roughness: 0.9 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 1.0 });
const matPad = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const matHover = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
const matHoverCapture = new THREE.MeshBasicMaterial({ color: 0xe24a3b, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const matHoverBlocked = new THREE.MeshBasicMaterial({ color: 0x7a7f86, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
const matHoverStone = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matSel = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matRun = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const matClimb = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matShatter = new THREE.MeshBasicMaterial({ color: 0xe24a3b, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const matSelStone = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const PAD_GEO = new THREE.BoxGeometry(CELL - 3, 1.4, CELL - 3);

const PCOL = { W: { stone: 0xf3efe6 }, B: { stone: 0x232323 } };

// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3cf91);
    scene.fog = new THREE.FogExp2(0xf3cf91, 0.0006);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(60, 240, 340);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 120; controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 36, 0); controls.update();
    controls.addEventListener('change', function () { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a6240, 0.95));
    const dir = new THREE.DirectionalLight(0xffe6bc, 1.4);
    dir.position.set(260, 460, 240); dir.castShadow = true;
    dir.shadow.camera.top = 320; dir.shadow.camera.bottom = -200;
    dir.shadow.camera.left = -380; dir.shadow.camera.right = 380;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 2000;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    dir.shadow.normalBias = 0.0; dir.shadow.bias = -0.001;
    scene.add(dir);

    scene.add(groupEnv, groupBuild, groupPads, groupStones, groupSel, groupTargets, groupHover, groupFX);

    buildPlinth();
    buildStructure();
    buildPads();

    window.addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    let __pointerDownPos_palacedjs = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
        __pointerDownPos_palacedjs.x = e.clientX;
        __pointerDownPos_palacedjs.y = e.clientY;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __pointerDownPos_palacedjs.x;
        const dy = e.clientY - __pointerDownPos_palacedjs.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            onPointerDown(e);
        }
    });

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', clearHover);
    renderer.setAnimationLoop(animate);
}
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

// ============================================
function buildPlinth() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(5000, 48), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.receiveShadow = true;
    groupEnv.add(ground);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * CELL + 60, 8, D * CELL + 60),
        new THREE.MeshStandardMaterial({ color: 0xcabf9f, roughness: 0.9 }));
    plinth.position.y = -4; plinth.receiveShadow = true; groupEnv.add(plinth);
}

// one glass cube per voxel so they can break individually
function buildStructure() {
    while (groupBuild.children.length) groupBuild.remove(groupBuild.children[0]);
    voxelMeshes.clear();
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < D; y++) {
            const L = window.palLevel(x, y), g = GLASS[L];
            const cx = worldX(x), cz = worldZ(y);
            for (let k = 0; k < L; k++) {
                const list = [];
                const geo = new THREE.BoxGeometry(CELL - 1.5, STEP - 0.5, CELL - 1.5);
                const glass = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                    color: g.color, roughness: 0.12, metalness: 0.0, transparent: true, opacity: g.op,
                    depthWrite: false
                }));
                glass.renderOrder = 1;
                glass.position.set(cx, (k + 0.5) * STEP, cz);
                glass.castShadow = true; glass.receiveShadow = true;
                groupBuild.add(glass); list.push(glass);

                const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), L >= 3 ? matFrameRidge : matFrame);
                edges.position.copy(glass.position);
                groupBuild.add(edges); list.push(edges);

                if (k === L - 1) {
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(CELL - 2, 1.6, CELL - 2), matCap[L]);
                    cap.position.set(cx, levelTop(L) + 0.4, cz); cap.receiveShadow = true;
                    groupBuild.add(cap); list.push(cap);
                }
                voxelMeshes.set(x + ',' + y + ',' + k, list);
            }
            if (window.palIsPortal(x, y)) buildPortal(x, y, cx, cz, levelTop(L));
        }
    }
    // goal bands: the end a player must REACH (Black scores at x=6, White at x=0)
    for (let y = 0; y < D; y++) {
        addGoal(0, y, matGoalW);          // White wins by reaching x=0
        addGoal(W - 1, y, matGoalB);      // Black wins by reaching x=14
    }
}
function addGoal(x, y, mat) {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 4, CELL - 4), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(worldX(x), levelTop(window.palLevel(x, y)) + 1.2, worldZ(y));
    groupBuild.add(disc);
}
function buildPortal(x, y, cx, cz, h) {
    let nx = 0, nz = 0;
    if (y === 2 && x === 0) nx = -1; else if (y === 2 && x === W - 1) nx = 1;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.3, 1.6, 8, 18, Math.PI), matGold);
    arch.position.set(cx + nx * (CELL / 2 - 0.5), h * 0.55, cz + nz * (CELL / 2 - 0.5));
    if (nx) arch.rotation.y = Math.PI / 2;
    arch.userData.portal = true;
    groupBuild.add(arch);
}
function applyShattered(keys) {
    // no-op — shatter removed; keep for API compatibility
}

// setup field pads
function buildPads() {
    while (groupPads.children.length) groupPads.remove(groupPads.children[0]);
    padMeshes.clear();
    window.palFields().forEach(function (f) {
        const pad = new THREE.Mesh(PAD_GEO, matPad);
        pad.quaternion.copy(fieldQuat(f.face));
        pad.position.copy(fieldCenter(f)).add(fieldNormal(f.face).multiplyScalar(0.3));
        pad.userData = { id: f.id, face: f.face };
        groupPads.add(pad);
        padMeshes.set(f.id, pad);
    });
    needsRender = true;
}

// ============================================
// STONES
// ============================================
function createStone(colorHex, dark) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: dark ? 0.45 : 0.25, metalness: 0.12 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 6, 22), mat); body.position.y = 3; body.castShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(4.4, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); top.position.y = 6; top.castShadow = true; g.add(top);
    const bevel = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 8, 22), matBevel.clone()); bevel.rotation.x = Math.PI / 2; bevel.position.y = 6; g.add(bevel);
    g.scale.set(1.9, 1.9, 1.9);
    g.userData.mainMat = mat; g.userData.bevelMat = bevel.material; g.userData.baseColor = colorHex;
    return g;
}
function setStoneHeld(mesh, held) {
    const mat = mesh.userData.mainMat, bev = mesh.userData.bevelMat;
    if (held) { mat.color.setHex(0x9aa0a6); mat.transparent = true; mat.opacity = 0.5; bev.color.setHex(0x9aa0a6); bev.emissiveIntensity = 0; }
    else { mat.color.setHex(mesh.userData.baseColor); mat.transparent = false; mat.opacity = 1; bev.color.setHex(0xE7C24A); bev.emissiveIntensity = 0.2; }
}

function palaceSync3D() {
    const st = window.getPalState();
    if (st.phase === 'play') syncPlay(st); else syncSetup(st);
}

function syncSetup(st) {
    const live = new Set();
    st.stones.forEach(function (s) {
        live.add(s.id);
        let mesh = stoneMeshes.get(s.id);
        if (!mesh) { mesh = createStone(PCOL[s.color].stone, s.color !== 'W'); mesh.userData.id = s.id; groupStones.add(mesh); stoneMeshes.set(s.id, mesh); }
        if (!mesh.userData.animating) { const f = window.palParseField(s.id); mesh.position.copy(stoneFieldPos(f)); mesh.quaternion.copy(fieldQuat(f.face)); }
    });
    stoneMeshes.forEach(function (m, id) { if (!live.has(id) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(id); } });
    const heldId = st.held;
    stoneMeshes.forEach(function (m, id) { setStoneHeld(m, id === heldId); });
    while (groupSel.children.length) groupSel.remove(groupSel.children[0]);
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    if (st.held) {
        const f = window.palParseField(st.held);
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.32, CELL * 0.42, 28), matSel);
        ring.quaternion.copy(ringQuat(f.face));
        ring.position.copy(stoneFieldPos(f)).add(fieldNormal(f.face).multiplyScalar(0.6));
        groupSel.add(ring);
    }
    applyShattered([]);
    needsRender = true;
}

function syncPlay(st) {
    applyShattered(st.shattered);
    const live = new Set();
    st.stones.forEach(function (s) {
        const key = 'p' + s.id; live.add(key);
        let mesh = stoneMeshes.get(key);
        if (!mesh) { mesh = createStone(PCOL[s.color].stone, s.color !== 'W'); mesh.userData.id = s.id; groupStones.add(mesh); stoneMeshes.set(key, mesh); }
        mesh.quaternion.identity();
        if (!mesh.userData.animating) mesh.position.copy(standPos(s.x, s.y, s.k));
    });
    stoneMeshes.forEach(function (m, key) { if (!live.has(key) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(key); } });
    while (groupSel.children.length) groupSel.remove(groupSel.children[0]);
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);

    // selected stone ring
    if (st.selected != null) {
        const sm = stoneMeshes.get('p' + st.selected);
        if (sm) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(11, 14, 30), matSelStone);
            ring.rotation.x = -Math.PI / 2; ring.position.copy(sm.position).setY(sm.position.y + 0.6);
            groupTargets.add(ring);
        }
    }
    // target rings
    st.targets.forEach(function (t) {
        const mat = t.capture != null ? matShatter : matRun;
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.28, CELL * 0.4, 26), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(worldX(t.x), t.k * STEP + 1.2, worldZ(t.y));
        ring.userData.target = t;
        groupTargets.add(ring);
    });
    needsRender = true;
}
// ============================================
// PHASE SWITCH
// ============================================
function palaceClearStones() {
    while (groupStones.children.length) groupStones.remove(groupStones.children[0]);
    stoneMeshes.clear();
}
function palaceEnterPlay() {
    palaceClearStones();
    while (groupPads.children.length) groupPads.remove(groupPads.children[0]);
    padMeshes.clear();
    clearHover();
    palaceSync3D();
}
function palaceEnterSetup() {
    palaceClearStones();
    applyShattered([]);
    buildPads();
    clearHover();
    palaceSync3D();
}

// setup helpers reused by game
function palaceRebuild() { palaceClearStones(); applyShattered([]); palaceSync3D(); }
function palaceRebuildPads() { buildPads(); clearHover(); palaceSync3D(); }

// ============================================
// SETUP animations
// ============================================
function palaceAnimPlace(id) {
    palaceSync3D();
    const mesh = stoneMeshes.get(id); if (!mesh) return;
    const f = window.palParseField(id);
    const end = stoneFieldPos(f), n = fieldNormal(f.face);
    mesh.userData.animating = true;
    mesh.position.copy(end).add(n.clone().multiplyScalar(40)); mesh.scale.set(1, 1, 1);
    new TWEEN.Tween(mesh.position).to({ x: end.x, y: end.y, z: end.z }, 320).easing(TWEEN.Easing.Quadratic.In).start();
    new TWEEN.Tween(mesh.scale).to({ x: 1.9, y: 1.9, z: 1.9 }, 320).easing(TWEEN.Easing.Back.Out)
        .onComplete(function () { mesh.userData.animating = false; needsRender = true; }).start();
    needsRender = true;
}
function palaceAnimRemove(id) {
    const mesh = stoneMeshes.get(id); if (!mesh) return;
    mesh.userData.animating = true; stoneMeshes.delete(id);
    new TWEEN.Tween(mesh.scale).to({ x: 0.01, y: 0.01, z: 0.01 }, 240).easing(TWEEN.Easing.Quadratic.In)
        .onComplete(function () { groupStones.remove(mesh); needsRender = true; }).start();
    needsRender = true;
}
function palaceAnimMove(fromId, toId) {
    const mesh = stoneMeshes.get(fromId); if (!mesh) { palaceSync3D(); return; }
    stoneMeshes.delete(fromId); stoneMeshes.set(toId, mesh); mesh.userData.id = toId; setStoneHeld(mesh, false);
    const tf = window.palParseField(toId);
    const start = mesh.position.clone(), startQ = mesh.quaternion.clone();
    const end = stoneFieldPos(tf), endQ = fieldQuat(tf.face);
    mesh.userData.animating = true;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 460).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { mesh.position.lerpVectors(start, end, o.t); mesh.position.y += Math.sin(Math.PI * o.t) * 26; mesh.quaternion.copy(startQ).slerp(endQ, o.t); needsRender = true; })
        .onComplete(function () { mesh.position.copy(end); mesh.quaternion.copy(endQ); mesh.userData.animating = false; needsRender = true; }).start();
    needsRender = true;
}

// ============================================
// PLAY animations
// ============================================
function palaceAnimStoneMove(id, from, to, type) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    const start = standPos(from.x, from.y, from.k), end = standPos(to.x, to.y, to.k);
    mesh.position.copy(start); mesh.userData.animating = true;
    const arc = type === 'jump' ? 14 : 0;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 380).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { mesh.position.lerpVectors(start, end, o.t); mesh.position.y += Math.sin(Math.PI * o.t) * arc; needsRender = true; })
        .onComplete(function () { mesh.position.copy(end); mesh.userData.animating = false; needsRender = true; }).start();
    needsRender = true;
}
function palaceAnimShatter(brokenKeys, drops) {
    // no-op — shatter removed; keep for API compatibility
}
function palaceAnimCapture(id) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    stoneMeshes.delete('p' + id);
    glassDust(mesh.position.x, mesh.position.y + 8, mesh.position.z);
    new TWEEN.Tween(mesh.scale).to({ x: 0.01, y: 0.01, z: 0.01 }, 260).easing(TWEEN.Easing.Quadratic.In)
        .onComplete(function () { groupStones.remove(mesh); needsRender = true; }).start();
    needsRender = true;
}
function palaceWin(color) {
    const box = document.getElementById('message-box');
    const title = document.getElementById('message-title');
    const text = document.getElementById('message-text');
    if (title) title.textContent = (color === 'W' ? 'White' : 'Black') + ' Wins';
    if (text) text.textContent = (color === 'W' ? 'White' : 'Black') + ' raced a stone clear across the Span.';
    if (box) box.classList.add('visible');
    needsRender = true;
}
function glassDust(x, y, z) {
    for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(new THREE.TetrahedronGeometry(1.6),
            new THREE.MeshBasicMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.9 }));
        s.position.set(x, y, z); groupFX.add(s);
        const tx = x + (Math.random() - 0.5) * 26, tz = z + (Math.random() - 0.5) * 26, ty = y - 10 - Math.random() * 14;
        new TWEEN.Tween(s.position).to({ x: tx, y: ty, z: tz }, 460).easing(TWEEN.Easing.Quadratic.In).start();
        new TWEEN.Tween(s.material).to({ opacity: 0 }, 460).onComplete(function () { groupFX.remove(s); needsRender = true; }).start();
    }
    needsRender = true;
}

// ============================================
// INTERACTION
// ============================================
function castObjects(arr) {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(arr, true);
}
function setMouse(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}
function bubbleTo(obj, prop) { while (obj && obj.userData[prop] === undefined && obj.parent) obj = obj.parent; return (obj && obj.userData[prop] !== undefined) ? obj : null; }

function onPointerDown(event) {
    if (!window.is3DView) return;
    setMouse(event);
    const st = window.getPalState();
    if (st.phase === 'play') {
        if (st.winner) return;
        const hits = castObjects([].concat(groupTargets.children, groupStones.children, groupBuild.children));
        if (!hits.length) return;
        // prefer a target ring if one was hit
        for (let i = 0; i < hits.length; i++) {
            const t = bubbleTo(hits[i].object, 'target');
            if (t) { window.palPlayTapTarget(t.userData.target); return; }
        }
        // building surface click — find matching target by grid cell
        for (let i = 0; i < hits.length; i++) {
            const p = hits[i].object.position;
            if (!p) continue;
            if (bubbleTo(hits[i].object, 'id')) continue; // skip stone meshes
            const gx = Math.round(p.x / CELL + (W - 1) / 2);
            const gy = Math.round(p.z / CELL + (D - 1) / 2);
            const t = st.targets.find(function (t) { return t.x === gx && t.y === gy; });
            if (t) { window.palPlayTapTarget(t); return; }
        }
        const so = bubbleTo(hits[0].object, 'id');
        if (so) window.palPlayTapStone(so.userData.id);
        return;
    }
    const hits = castObjects([].concat(groupStones.children, groupPads.children));
    if (!hits.length) return;
    const o = bubbleTo(hits[0].object, 'id');
    if (o) window.palTapField(o.userData.id);
}

function clearHover() {
    if (hoverKey === null) return;
    hoverKey = null;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    if (renderer) renderer.domElement.style.cursor = 'default';
    needsRender = true;
}
function onPointerMove(event) {
    if (!window.is3DView) return;
    setMouse(event);
    const st = window.getPalState();
    if (st.phase === 'play') {
        const hits = castObjects([].concat(groupTargets.children, groupStones.children, groupBuild.children));
        renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
        return;
    }
    const hits = castObjects([].concat(groupStones.children, groupPads.children));
    const o = hits.length ? bubbleTo(hits[0].object, 'id') : null;
    const key = o ? o.userData.id : null;
    if (key === hoverKey) return;
    hoverKey = key;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    renderer.domElement.style.cursor = key ? 'pointer' : 'default';
    if (o) {
        const f = window.palParseField(key);
        const info = window.palPlaceInfo(key);
        const mat = info === 'stone' ? matHoverStone : info === 'capture' ? matHoverCapture : info === 'blocked' ? matHoverBlocked : matHover;
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.34, CELL * 0.44, 28), mat);
        ring.quaternion.copy(ringQuat(f.face));
        ring.position.copy(fieldCenter(f)).add(fieldNormal(f.face).multiplyScalar(0.5));
        groupHover.add(ring);
    }
    needsRender = true;
}

function animate(time) {
    TWEEN.update(time);
    const cu = controls.update();
    if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; }
}

// ============================================
window.palaceSync3D = palaceSync3D;
window.palaceRebuild = palaceRebuild;
window.palaceRebuildPads = palaceRebuildPads;
window.palaceEnterPlay = palaceEnterPlay;
window.palaceEnterSetup = palaceEnterSetup;
window.palaceAnimPlace = palaceAnimPlace;
window.palaceAnimRemove = palaceAnimRemove;
window.palaceAnimMove = palaceAnimMove;
window.palaceAnimStoneMove = palaceAnimStoneMove;
window.palaceAnimShatter = palaceAnimShatter;
window.palaceAnimCapture = palaceAnimCapture;
window.palaceWin = palaceWin;

document.addEventListener('DOMContentLoaded', function () {
    init3D();
    if (window.palStartPlay) window.palStartPlay();   // jump straight into the race demo
});
