// ============================================
// PALACE 3D VIEW — "Twin Palaces" (4-player)
// Two stepped glass palaces joined along their long edge; each palace keeps its
// own five elevator bands, controlled from its own outer edge.
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupBuild = new THREE.Group();
const groupCracks = new THREE.Group();
const groupStones = new THREE.Group();
const groupPool = new THREE.Group();
const groupTargets = new THREE.Group();
const groupControls = new THREE.Group();
const groupFX = new THREE.Group();
const bandHandles = [];         // [{palace, band, up, down, post, plate, x, z}]
const edgeLips = [];            // [{group, palace, band}]

const voxelMeshes = new Map();
const capMeshes = new Map();
const stoneMeshes = new Map();
const baseLevels = new Map();
const grownCubes = new Map();

// ---- layout ----
const CELL = 30;
const STEP = 26;
const W = 16, D = 10, HALF = 8;
const SEAM = 3;                  // slim visual gap — the two palaces read as one rollable surface
function worldX(x) {
    // centre the 16-wide board, then push the two halves apart by SEAM
    const base = (x - (W - 1) / 2) * CELL;
    return base + (x < HALF ? -SEAM : SEAM);
}
function worldZ(y) { return (y - (D - 1) / 2) * CELL; }
function levelTop(l) { return l * STEP; }
function standPos(x, y, k) { return new THREE.Vector3(worldX(x), k * STEP + 1.6, worldZ(y)); }
// each reserve is locked to a column, waiting off-board in front of its entry pane
function poolPos(color, off) {
    const seat = window.PAL_SEAT[color];
    const x = window.palColToX(color, off);
    const z = seat.end === 'S' ? worldZ(0) - CELL * 1.6 : worldZ(D - 1) + CELL * 1.6;
    return new THREE.Vector3(worldX(x), 1.6, z);
}
// invert worldX for click-picking
function pickX(px) {
    // undo the seam offset by testing both halves
    const leftX = Math.round((px + SEAM) / CELL + (W - 1) / 2);
    if (leftX < HALF) return leftX;
    const rightX = Math.round((px - SEAM) / CELL + (W - 1) / 2);
    return rightX;
}
function pickY(pz) { return Math.round(pz / CELL + (D - 1) / 2); }

// ---- materials ----
const GLASS = [null,
    { color: 0x8fb6d6, op: 0.6 },
    { color: 0x7aa6cf, op: 0.64 },
    { color: 0xdcc06a, op: 0.72 },
    { color: 0xd2af50, op: 0.78 }];
const matFrame = new THREE.LineBasicMaterial({ color: 0xC5A059, transparent: true, opacity: 0.9 });
const matFrameRidge = new THREE.LineBasicMaterial({ color: 0xE7C24A, transparent: true, opacity: 1.0 });
const CAP_COLOR = [null, 0xc6dcec, 0xbcd2e6, 0xeed99a, 0xe6c873];
const matBevel = new THREE.MeshStandardMaterial({ color: 0xE7C24A, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.35, metalness: 0.75 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 1.0 });

const matStep = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const matShatter = new THREE.MeshBasicMaterial({ color: 0xe24a3b, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const matPlace = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matSelStone = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });

const PCOL = {
    W: { stone: 0xf3efe6, dark: false },
    B: { stone: 0x232323, dark: true },
    R: { stone: 0xc14a3d, dark: true },
    U: { stone: 0x4d7ec8, dark: true }
};

// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3cf91);
    scene.fog = new THREE.FogExp2(0xf3cf91, 0.0005);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(90, 340, 560);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 140; controls.maxDistance = 1100;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 48, 0); controls.update();
    controls.addEventListener('change', function () { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a6240, 0.95));
    const dir = new THREE.DirectionalLight(0xffe6bc, 1.4);
    dir.position.set(320, 500, 300); dir.castShadow = true;
    dir.shadow.camera.top = 380; dir.shadow.camera.bottom = -240;
    dir.shadow.camera.left = -520; dir.shadow.camera.right = 520;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 2400;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    dir.shadow.normalBias = 0.0; dir.shadow.bias = -0.001;
    scene.add(dir);

    scene.add(groupEnv, groupBuild, groupCracks, groupStones, groupPool, groupTargets, groupControls, groupFX);

    buildPlinth();
    buildStructure();
    buildSeam();
    buildEdgeLips();
    buildBandControls();

    window.addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    let __downPos = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => { __downPos.x = e.clientX; __downPos.y = e.clientY; });
    renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __downPos.x, dy = e.clientY - __downPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) onPointerDown(e);
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
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6000, 48), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.receiveShadow = true;
    groupEnv.add(ground);
    // one plinth under each palace
    ['A', 'B'].forEach(function (p) {
        const cx = p === 'A' ? worldX(HALF / 2 - 0.5) : worldX(HALF + HALF / 2 - 0.5);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(HALF * CELL + 40, 8, D * CELL + 140),
            new THREE.MeshStandardMaterial({ color: 0xcabf9f, roughness: 0.9 }));
        plinth.position.set(cx, -4, 0); plinth.receiveShadow = true; groupEnv.add(plinth);
    });
}

// a gilded party wall standing in the seam between the two palaces
function buildSeam() {
    const x = (worldX(HALF - 1) + worldX(HALF)) / 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(3, 10, D * CELL + 40),
        new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.4, metalness: 0.6 }));
    post.position.set(x, 1, 0); groupEnv.add(post);
}

// one glass cube per voxel — palLevel returns the right palace's band height
function buildStructure() {
    while (groupBuild.children.length) groupBuild.remove(groupBuild.children[0]);
    voxelMeshes.clear(); capMeshes.clear();
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < D; y++) {
            const L = window.palLevel(x, y);
            const cx = worldX(x), cz = worldZ(y);
            const g = GLASS[L] || GLASS[4];
            for (let k = 0; k < L; k++) {
                const list = [];
                const geo = new THREE.BoxGeometry(CELL - 1.5, STEP - 0.5, CELL - 1.5);
                const glass = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                    color: (GLASS[Math.min(k + 1, 4)] || g).color, roughness: 0.12, metalness: 0.0,
                    transparent: true, opacity: g.op, depthWrite: false
                }));
                glass.renderOrder = 1;
                glass.position.set(cx, (k + 0.5) * STEP, cz);
                glass.castShadow = true; glass.receiveShadow = true;
                groupBuild.add(glass); list.push(glass);

                const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), L >= 3 ? matFrameRidge : matFrame);
                edges.position.copy(glass.position);
                groupBuild.add(edges); list.push(edges);

                if (k === L - 1) {
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(CELL - 2, 1.6, CELL - 2),
                        new THREE.MeshStandardMaterial({ color: CAP_COLOR[L], roughness: 0.25, metalness: 0.08 }));
                    cap.position.set(cx, levelTop(L) + 0.4, cz); cap.receiveShadow = true;
                    groupBuild.add(cap); list.push(cap);
                    capMeshes.set(x + ',' + y, cap);
                }
                voxelMeshes.set(x + ',' + y + ',' + k, list);
            }
            baseLevels.set(x + ',' + y, L);
        }
    }
}

// low stone curbs on the four ENTRANCE (pool-side) edges — each half rides its
// own palace's entrance band so it stays flush as that band raises or lowers.
function buildEdgeLips() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8cfb4, roughness: 0.7, metalness: 0.1 });
    const spanX = HALF * CELL + 4;
    const defs = [
        { palace: 'A', band: 0, x0: 0, z: worldZ(0) - CELL / 2 },
        { palace: 'B', band: 0, x0: HALF, z: worldZ(0) - CELL / 2 },
        { palace: 'A', band: PAL_BANDS_N() - 1, x0: 0, z: worldZ(D - 1) + CELL / 2 },
        { palace: 'B', band: PAL_BANDS_N() - 1, x0: HALF, z: worldZ(D - 1) + CELL / 2 }
    ];
    defs.forEach(function (dfn) {
        const g = new THREE.Group();
        const curb = new THREE.Mesh(new THREE.BoxGeometry(spanX, 6, 5), mat);
        curb.position.y = 3; curb.castShadow = true; curb.receiveShadow = true; g.add(curb);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(spanX, 1.6, 6), matGold);
        cap.position.y = 6.6; g.add(cap);
        const cx = (worldX(dfn.x0) + worldX(dfn.x0 + HALF - 1)) / 2;
        g.position.set(cx, 0, dfn.z);
        groupEnv.add(g);
        edgeLips.push({ group: g, palace: dfn.palace, band: dfn.band });
    });
    updateEdgeLips();
}
function PAL_BANDS_N() { return window.PAL_BANDS || 5; }
function updateEdgeLips() {
    edgeLips.forEach(function (l) {
        const h = window.palBandHeight ? window.palBandHeight(l.palace, l.band) : 1;
        l.group.position.y = h * STEP;
    });
}

// raise/lower handles on the OUTER edge of each palace (A on the west, B on the east)
function bandCenterZ(b) { return worldZ(b * 2) / 2 + worldZ(b * 2 + 1) / 2; }
function buildBandControls() {
    while (groupControls.children.length) groupControls.remove(groupControls.children[0]);
    bandHandles.length = 0;
    const nBands = PAL_BANDS_N();
    const defs = [
        { palace: 'A', x: worldX(0) - CELL * 0.5 - 16 },
        { palace: 'B', x: worldX(W - 1) + CELL * 0.5 + 16 }
    ];
    defs.forEach(function (dfn) {
        for (let b = 0; b < nBands; b++) {
            const cz = bandCenterZ(b);
            const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 8, 12), matGold);
            post.position.set(dfn.x, 0, cz);
            groupControls.add(post);

            const up = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), matGold.clone());
            up.userData.tierHandle = { palace: dfn.palace, band: b, delta: 1 };
            groupControls.add(up);

            const down = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), matGold.clone());
            down.rotation.x = Math.PI;
            down.userData.tierHandle = { palace: dfn.palace, band: b, delta: -1 };
            groupControls.add(down);

            const plate = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.5, 20),
                new THREE.MeshStandardMaterial({ color: 0x2a2417, roughness: 0.7, metalness: 0.4 }));
            plate.rotation.z = Math.PI / 2;
            plate.position.set(dfn.x + (dfn.palace === 'A' ? -3 : 3), 0, cz);
            groupControls.add(plate);

            bandHandles.push({ palace: dfn.palace, band: b, up: up, down: down, post: post, plate: plate, x: dfn.x, z: cz });
        }
    });
    updateBandControls();
}

function updateBandControls() {
    const lo = window.PAL_TIER_MIN || 1, hi = window.PAL_TIER_MAX || 3;
    bandHandles.forEach(function (h) {
        const lv = window.palBandHeight(h.palace, h.band);
        const top = levelTop(lv);
        h.post.scale.y = Math.max(0.4, top / 8);
        h.post.position.y = top / 2;
        h.plate.position.y = top + 20;
        h.up.position.set(h.x, top + 30, h.z);
        h.down.position.set(h.x, top + 10, h.z);
        h.up.material.opacity = lv >= hi ? 0.25 : 1;
        h.up.material.transparent = lv >= hi;
        h.down.material.opacity = lv <= lo ? 0.25 : 1;
        h.down.material.transparent = lv <= lo;
    });
    needsRender = true;
}

// ---- grown glass (band raises) ----
function makeGlassCube(x, y, k) {
    const list = [];
    const g = GLASS[Math.min(k + 1, 4)];
    const geo = new THREE.BoxGeometry(CELL - 1.5, STEP - 0.5, CELL - 1.5);
    const glass = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: g.color, roughness: 0.12, metalness: 0.0, transparent: true, opacity: g.op, depthWrite: false
    }));
    glass.renderOrder = 1;
    glass.position.set(worldX(x), (k + 0.5) * STEP, worldZ(y));
    glass.castShadow = true; glass.receiveShadow = true;
    groupBuild.add(glass); list.push(glass);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), (k + 1) >= 3 ? matFrameRidge : matFrame);
    edges.position.copy(glass.position);
    groupBuild.add(edges); list.push(edges);
    return list;
}

function ensureHeights() {
    baseLevels.forEach(function (base, key) {
        const parts = key.split(',');
        const x = +parts[0], y = +parts[1];
        const cur = window.palLevel(x, y);
        let arr = grownCubes.get(key) || [];
        while (base + arr.length < cur) {
            const k = base + arr.length;
            const list = makeGlassCube(x, y, k);
            voxelMeshes.set(key + ',' + k, list);
            arr.push(list);
            needsRender = true;
        }
        while (arr.length && base + arr.length > cur) {
            const k = base + arr.length - 1;
            const list = arr.pop();
            list.forEach(function (m) { groupBuild.remove(m); });
            voxelMeshes.delete(key + ',' + k);
            needsRender = true;
        }
        grownCubes.set(key, arr);
        for (let k = 0; k < base; k++) {
            const list = voxelMeshes.get(key + ',' + k);
            if (!list) continue;
            const vis = k < cur;
            if (list[0].visible !== vis) {
                list[0].visible = vis;
                if (list[1]) list[1].visible = vis;
                needsRender = true;
            }
        }
        const cap = capMeshes.get(key);
        if (cap) cap.position.y = levelTop(cur) + 0.4;
    });
}

// ============================================
// STONES & POOL
// ============================================
function createStone(colorHex, dark) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: dark ? 0.3 : 0.15, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(9, 26, 18), mat);
    body.position.y = 9; body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.1, 0.5, 8, 26), matBevel.clone());
    ring.rotation.x = Math.PI / 2; ring.position.y = 9; g.add(ring);
    g.userData.mainMat = mat;
    return g;
}

// ============================================
function palaceSync3D() { syncPlay(window.getPalState()); }

function syncPlay(st) {
    ensureHeights();
    updateBandControls();
    updateEdgeLips();

    const live = new Set();
    st.stones.forEach(function (s) {
        const key = 'p' + s.id; live.add(key);
        let mesh = stoneMeshes.get(key);
        if (!mesh) { mesh = createStone(PCOL[s.color].stone, PCOL[s.color].dark); mesh.userData.id = s.id; groupStones.add(mesh); stoneMeshes.set(key, mesh); }
        mesh.quaternion.identity();
        if (!mesh.userData.animating) mesh.position.copy(standPos(s.x, s.y, s.k));
    });
    stoneMeshes.forEach(function (m, key) { if (!live.has(key) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(key); } });

    // pools on the plinths
    while (groupPool.children.length) groupPool.remove(groupPool.children[0]);
    st.players.forEach(function (c) {
        st.pool[c].forEach(function (has, off) {
            if (!has) return;
            const m = createStone(PCOL[c].stone, PCOL[c].dark);
            m.position.copy(poolPos(c, off));
            m.userData.poolColor = c;
            groupPool.add(m);
        });
    });

    // targets & selection
    while (groupTargets.children.length) groupTargets.remove(groupTargets.children[0]);
    if (st.selected && st.selected.kind === 'stone') {
        const sm = stoneMeshes.get('p' + st.selected.id);
        if (sm) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(11, 14, 30), matSelStone);
            ring.rotation.x = -Math.PI / 2; ring.position.copy(sm.position).setY(sm.position.y + 0.6);
            groupTargets.add(ring);
        }
    }
    if (st.selected && st.selected.kind === 'pool') {
        st.pool[st.turn].forEach(function (has, off) {
            if (!has) return;
            const p = poolPos(st.turn, off);
            const ring = new THREE.Mesh(new THREE.RingGeometry(11, 14, 30), matSelStone);
            ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.8, p.z);
            groupTargets.add(ring);
        });
    }
    st.targets.forEach(function (t) {
        let mat = matStep;
        if (t.type === 'smash' || t.type === 'fall' || t.type === 'carom') mat = matShatter;
        else if (t.type === 'hop' || t.type === 'place') mat = matPlace;
        const lv = window.palLevel(t.x, t.y);
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.28, CELL * 0.4, 26), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(worldX(t.x), lv * STEP + 1.6, worldZ(t.y));
        ring.userData.target = t;
        groupTargets.add(ring);
        const pad = new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.46, 20),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(worldX(t.x), lv * STEP + 1.5, worldZ(t.y));
        pad.userData.target = t;
        groupTargets.add(pad);
    });
    needsRender = true;
}

// ============================================
// Animations
// ============================================
function palaceAnimStoneMove(id, from, to) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    const start = standPos(from.x, from.y, from.k), end = standPos(to.x, to.y, to.k);
    mesh.position.copy(start); mesh.userData.animating = true;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 380).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { mesh.position.lerpVectors(start, end, o.t); mesh.position.y += Math.sin(Math.PI * o.t) * 10; needsRender = true; })
        .onComplete(function () { mesh.position.copy(end); mesh.userData.animating = false; if (window.palaceSync3D) window.palaceSync3D(); }).start();
    needsRender = true;
}

function palaceAnimSmash(id, x, y, k) {
    glassShards(worldX(x), k * STEP + 10, worldZ(y));
    const mesh = stoneMeshes.get('p' + id);
    if (!mesh) return;
    stoneMeshes.delete('p' + id);
    mesh.userData.animating = true;
    new TWEEN.Tween(mesh.scale).to({ x: 0.01, y: 0.01, z: 0.01 }, 240).easing(TWEEN.Easing.Quadratic.In)
        .onComplete(function () { groupStones.remove(mesh); needsRender = true; }).start();
    needsRender = true;
}

function palaceAnimFallOff(id, from, dx, dy) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    stoneMeshes.delete('p' + id);
    mesh.userData.animating = true;
    const start = standPos(from.x, from.y, from.k);
    mesh.position.copy(start);
    const end = new THREE.Vector3(start.x + dx * CELL * 1.4, 3, start.z + dy * CELL * 1.4);
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 620).easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(function () {
            mesh.position.x = start.x + (end.x - start.x) * o.t;
            mesh.position.z = start.z + (end.z - start.z) * o.t;
            mesh.position.y = start.y + (end.y - start.y) * (o.t * o.t) + Math.sin(Math.PI * o.t) * 8;
            mesh.rotation.z += 0.1;
            needsRender = true;
        })
        .onComplete(function () {
            new TWEEN.Tween(mesh.scale).to({ x: 0.01, y: 0.01, z: 0.01 }, 240)
                .onComplete(function () { groupStones.remove(mesh); if (window.palaceSync3D) window.palaceSync3D(); needsRender = true; }).start();
        }).start();
    needsRender = true;
}

function palaceAnimPlace(id, x, y) {
    const mesh = stoneMeshes.get('p' + id);
    if (!mesh) return;
    const end = standPos(x, y, window.palLevel(x, y));
    mesh.position.set(end.x, end.y + 46, end.z);
    mesh.userData.animating = true;
    new TWEEN.Tween(mesh.position).to({ y: end.y }, 420).easing(TWEEN.Easing.Quadratic.In)
        .onComplete(function () { mesh.userData.animating = false; if (window.palaceSync3D) window.palaceSync3D(); }).start();
    needsRender = true;
}

function palaceWin(color) {
    setTimeout(function () {
        const st = window.getPalState();
        const seat = st.seat[color];
        const box = document.getElementById('message-box');
        const title = document.getElementById('message-title');
        const text = document.getElementById('message-text');
        if (title) title.textContent = (seat ? seat.name : color) + ' Wins';
        if (text) text.textContent = st.winReason === 'stuck'
            ? 'No legal moves remain — ' + (seat ? seat.name : color) + ' holds the most spheres!'
            : (seat ? seat.name : color) + ' is the last palace standing!';
        if (box) box.classList.add('visible');
        needsRender = true;
    }, 1100);
}

function glassShards(x, y, z) {
    for (let i = 0; i < 14; i++) {
        const s = new THREE.Mesh(new THREE.TetrahedronGeometry(1.4 + Math.random() * 1.6),
            new THREE.MeshBasicMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.9 }));
        s.position.set(x, y, z); groupFX.add(s);
        const tx = x + (Math.random() - 0.5) * 34, tz = z + (Math.random() - 0.5) * 34, ty = y - 8 - Math.random() * 20;
        new TWEEN.Tween(s.position).to({ x: tx, y: ty, z: tz }, 520).easing(TWEEN.Easing.Quadratic.In).start();
        new TWEEN.Tween(s.material).to({ opacity: 0 }, 520).onComplete(function () { groupFX.remove(s); needsRender = true; }).start();
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
    if (st.winner) return;
    const ctrlHits = castObjects(groupControls.children);
    for (let i = 0; i < ctrlHits.length; i++) {
        const h = bubbleTo(ctrlHits[i].object, 'tierHandle');
        if (h) { const d = h.userData.tierHandle; window.palSetTier(d.palace, d.band, d.delta); return; }
    }
    const hits = castObjects([].concat(groupTargets.children, groupPool.children, groupStones.children, groupBuild.children));
    if (!hits.length) return;
    let firstStoneId = null;
    for (let i = 0; i < hits.length; i++) {
        const so = bubbleTo(hits[i].object, 'id');
        if (so) { firstStoneId = so.userData.id; break; }
    }
    if (st.selected && st.selected.kind === 'stone' && firstStoneId === st.selected.id) {
        window.palPlayTapStone(firstStoneId); return;
    }
    for (let i = 0; i < hits.length; i++) {
        const t = bubbleTo(hits[i].object, 'target');
        if (t) { window.palPlayTapTarget(t.userData.target); return; }
    }
    if (st.selected && st.selected.kind === 'stone') {
        const sel = st.stones.find(function (s) { return s.id === st.selected.id; });
        for (let i = 0; i < hits.length; i++) {
            const p = hits[i].object.position;
            if (!p) continue;
            const gx = pickX(p.x), gy = pickY(p.z);
            if (sel && gx === sel.x && gy === sel.y) continue;
            const t = st.targets.find(function (q) { return q.x === gx && q.y === gy; });
            if (t) { window.palPlayTapTarget(t); return; }
        }
    }
    for (let i = 0; i < hits.length; i++) {
        const pc = bubbleTo(hits[i].object, 'poolColor');
        if (pc) { window.palTapPool(pc.userData.poolColor); return; }
    }
    const so = bubbleTo(hits[0].object, 'id');
    if (so) { window.palPlayTapStone(so.userData.id); return; }
}

function clearHover() { if (renderer) renderer.domElement.style.cursor = 'default'; }
function onPointerMove(event) {
    if (!window.is3DView) return;
    setMouse(event);
    const hits = castObjects([].concat(groupControls.children, groupTargets.children, groupPool.children, groupStones.children));
    renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
}

function animate(time) {
    TWEEN.update(time);
    const cu = controls.update();
    if (cu || needsRender) { renderer.render(scene, camera); needsRender = false; }
}

// ============================================
window.palaceSync3D = palaceSync3D;
window.palaceAnimStoneMove = palaceAnimStoneMove;
window.palaceAnimSmash = palaceAnimSmash;
window.palaceAnimFallOff = palaceAnimFallOff;
window.palaceAnimPlace = palaceAnimPlace;
window.palaceWin = palaceWin;

document.addEventListener('DOMContentLoaded', function () {
    init3D();
    if (window.palStartPlay) window.palStartPlay();
});
