// ============================================
// PALACE 3D VIEW — "The Carom" (Crystal Palace, fragile glass)
// Stepped glass building, cracked panes, holes, pools on the plinth
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupBuild = new THREE.Group();   // glass voxels + frames + caps
const groupCracks = new THREE.Group();  // crack overlays (rebuilt on sync)
const groupStones = new THREE.Group();
const groupPool = new THREE.Group();    // reserve stones + artifact gems on the plinth
const groupTargets = new THREE.Group();
const groupControls = new THREE.Group(); // band raise/lower handles on the building's edge
const groupFX = new THREE.Group();
const bandHandles = [];         // [{band, up, down, post}]
const edgeLips = [];            // [{group, band}] — low curbs on the two entrance (pool-side) edges

const voxelMeshes = new Map();  // "x,y,k" -> [meshes]
const capMeshes = new Map();    // "x,y"   -> cap mesh (per-pane material)
const stoneMeshes = new Map();  // 'p'+id  -> stone group
const holeFloors = new Map();   // "x,y"   -> pit floor mesh
const crackLines = new Map();   // "x,y"   -> crack line group
const baseLevels = new Map();   // "x,y"   -> built base height
const grownCubes = new Map();   // "x,y"   -> [[meshes]] dynamic cubes grown by quads

// ---- layout ----
const CELL = 30;
const STEP = 26;
const W = 8, D = 10;
function worldX(x) { return (x - (W - 1) / 2) * CELL; }
function worldZ(y) { return (y - (D - 1) / 2) * CELL; }
function levelTop(l) { return l * STEP; }
function standPos(x, y, k) { return new THREE.Vector3(worldX(x), k * STEP + 1.6, worldZ(y)); }
// Each reserve is locked to a column: sphere `col` waits off-board directly
// in front of entry pane (col, entranceRow).
function poolPos(color, col) {
    const z = color === 'W' ? worldZ(0) - CELL * 1.6 : worldZ(D - 1) + CELL * 1.6;
    return new THREE.Vector3(worldX(col), 1.6, z);
}

// ---- materials ----
const GLASS = [null,
    { color: 0x8fb6d6, op: 0.6 },   // L1
    { color: 0x7aa6cf, op: 0.64 },  // L2
    { color: 0xdcc06a, op: 0.72 },  // L3 ridge
    { color: 0xd2af50, op: 0.78 }]; // L4 crown transept
const matFrame = new THREE.LineBasicMaterial({ color: 0xC5A059, transparent: true, opacity: 0.9 });
const matFrameRidge = new THREE.LineBasicMaterial({ color: 0xE7C24A, transparent: true, opacity: 1.0 });
const CAP_COLOR = [null, 0xc6dcec, 0xbcd2e6, 0xeed99a, 0xe6c873];
const matBevel = new THREE.MeshStandardMaterial({ color: 0xE7C24A, roughness: 0.3, metalness: 0.8, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xC5A059, roughness: 0.35, metalness: 0.75 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 1.0 });
const matPit = new THREE.MeshStandardMaterial({ color: 0x14100a, roughness: 1.0 });
const matCrack = new THREE.LineBasicMaterial({ color: 0xfbfdff, transparent: true, opacity: 0.95 });

const matStep = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const matShatter = new THREE.MeshBasicMaterial({ color: 0xe24a3b, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const matFall = new THREE.MeshBasicMaterial({ color: 0x7a1d14, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const matPush = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
const matPlace = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matDrop = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
const matCrown = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const matSelStone = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });

const PCOL = { W: { stone: 0xf3efe6, artif: 0xffd88a, emissive: 0xffb84d }, B: { stone: 0x232323, artif: 0xffd88a, emissive: 0xffb84d } };

// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3cf91);
    scene.fog = new THREE.FogExp2(0xf3cf91, 0.0006);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(80, 280, 440);

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
    controls.target.set(0, 48, 0); controls.update();
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

    scene.add(groupEnv, groupBuild, groupCracks, groupStones, groupPool, groupTargets, groupControls, groupFX);

    buildPlinth();
    buildHydePark();
    buildStructure();
    buildEdgeLips();
    buildBandControls();

    window.addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    let __downPos = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
        __downPos.x = e.clientX; __downPos.y = e.clientY;
    });
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
    const ground = new THREE.Mesh(new THREE.CircleGeometry(5000, 48), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.receiveShadow = true;
    groupEnv.add(ground);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * CELL + 60, 8, D * CELL + 140),
        new THREE.MeshStandardMaterial({ color: 0xcabf9f, roughness: 0.9 }));
    plinth.position.y = -4; plinth.receiveShadow = true; groupEnv.add(plinth);
}

// Hyde Park, 1851 — a formal Victorian setting around the Crystal Palace:
// gravel avenues, parterre gardens with fountains, tree rows and brick water
// towers. Purely decorative backdrop; kept clear of the plinth and the near
// camera so it never occludes the play field.
function buildHydePark() {
    const park = new THREE.Group();
    const M = function (c, r, m) { return new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.95 : r, metalness: m || 0 }); };
    const hedgeMat = M(0x46683a), pathMat = M(0xcbbd93, 1), trunkMat = M(0x6b4a2f, 0.9);
    const leafMats = [M(0x3f6b37), M(0x4c7a41), M(0x33603a)];
    const brickMat = M(0x9c4535, 0.85), stoneMat = M(0xc9c0a8, 0.85), capMat = M(0xd8cfb4, 0.8), roofMat = M(0x7a4638, 0.8);
    const winMat = M(0x2a2a30, 0.5);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x6fa9c9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 });
    const flowerMats = [M(0xc4514e), M(0xd9a441), M(0xb96fa0), M(0xdd6f52)];
    const rand = function (a, b) { return a + Math.random() * (b - a); };
    const pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };

    function tree(x, z) {
        const s = rand(0.85, 1.35), g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2 * s, 3 * s, 13 * s, 6), trunkMat);
        trunk.position.y = 6.5 * s; trunk.castShadow = true; g.add(trunk);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(10 * s, 8, 6), pick(leafMats));
        canopy.position.y = 18 * s; canopy.scale.y = 1.25; canopy.castShadow = true; g.add(canopy);
        g.position.set(x, 0, z); g.rotation.y = rand(0, 6.28); park.add(g);
    }
    function fountain(x, z, s) {
        s = s || 1; const g = new THREE.Group();
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(30 * s, 34 * s, 8, 22), stoneMat);
        basin.position.y = 4; basin.castShadow = basin.receiveShadow = true; g.add(basin);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(26 * s, 26 * s, 1.5, 22), waterMat);
        water.position.y = 7.4; g.add(water);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 16, 10), stoneMat); ped.position.y = 12; ped.castShadow = true; g.add(ped);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(11 * s, 2.5, 4, 14), stoneMat); bowl.position.y = 21; g.add(bowl);
        const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 15, 6), waterMat); jet.position.y = 29; g.add(jet);
        const drop = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), waterMat); drop.position.y = 37; g.add(drop);
        g.position.set(x, 0, z); park.add(g);
    }
    function bed(x, z, size) {
        const g = new THREE.Group(), t = 3.5, h = 6;
        [[0, size / 2], [0, -size / 2]].forEach(function (p) { const m = new THREE.Mesh(new THREE.BoxGeometry(size, h, t), hedgeMat); m.position.set(p[0], h / 2, p[1]); m.castShadow = m.receiveShadow = true; g.add(m); });
        [[size / 2, 0], [-size / 2, 0]].forEach(function (p) { const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, size), hedgeMat); m.position.set(p[0], h / 2, p[1]); m.castShadow = m.receiveShadow = true; g.add(m); });
        const flower = new THREE.Mesh(new THREE.BoxGeometry(size - 2 * t, 3, size - 2 * t), pick(flowerMats));
        flower.position.y = 2; flower.receiveShadow = true; g.add(flower);
        g.position.set(x, 0, z); park.add(g);
    }
    function parterre(cx, cz) {
        const step = 62, sz = 50;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) { bed(cx + q[0] * step / 2, cz + q[1] * step / 2, sz); });
        fountain(cx, cz, 0.8);
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) { tree(cx + q[0] * step, cz + q[1] * step); });
    }
    function path(x, z, w, d) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), pathMat);
        m.position.set(x, -0.5, z); m.receiveShadow = true; park.add(m);
    }
    function tower(x, z, h) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(30, h, 30), brickMat); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
        [h * 0.34, h * 0.67].forEach(function (cy) { const s = new THREE.Mesh(new THREE.BoxGeometry(33, 4, 33), capMat); s.position.y = cy; g.add(s); });
        const cap = new THREE.Mesh(new THREE.BoxGeometry(36, 8, 36), capMat); cap.position.y = h + 4; cap.castShadow = true; g.add(cap);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(27, 26, 4), roofMat); roof.position.y = h + 21; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
        for (let ty = 1; ty <= 3; ty++) {
            [[0, 15.2], [0, -15.2], [15.2, 0], [-15.2, 0]].forEach(function (w) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(w[1] === 0 ? 2 : 8, 12, w[1] === 0 ? 8 : 2), winMat);
                win.position.set(w[0], h * ty / 4 + 4, w[1]); g.add(win);
            });
        }
        g.position.set(x, 0, z); park.add(g);
    }

    // ---- layout (plinth spans x +-150, z +-220; camera sits out front at +z) ----
    const RING = 430;
    path(0, RING, RING * 2, 22); path(0, -RING, RING * 2, 22);           // perimeter gravel ring
    path(RING, 0, 22, RING * 2); path(-RING, 0, 22, RING * 2);
    path(0, 325, 22, 210); path(0, -325, 22, 210);                       // axial avenues out of the plinth
    path(285, 0, 270, 22); path(-285, 0, 270, 22);
    parterre(285, 300); parterre(-285, 300);                             // four parterre gardens + fountains
    parterre(285, -300); parterre(-285, -300);
    for (let i = -3; i <= 3; i++) {                                      // tree avenues (back + sides; front left open)
        const t = i * 120;
        tree(t, -(RING - 26));
        if (Math.abs(t) <= 240) { tree(RING - 26, t); tree(-(RING - 26), t); }
    }
    tower(RING - 20, -(RING - 20), 152); tower(-(RING - 20), -(RING - 20), 152);  // brick water towers, back corners
    tower(RING + 5, 40, 132); tower(-(RING + 5), 40, 132);                        // flanking towers to the sides

    groupEnv.add(park);
}

// A low stone curb along the two ENTRANCE (pool-side) edges — the visual cue that
// a sphere rolled toward its own baseline stops here instead of falling. Rides at
// the top of its entrance band so it stays flush as the band raises or lowers.
function buildEdgeLips() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8cfb4, roughness: 0.7, metalness: 0.1 });
    const spanX = W * CELL + 4;
    const defs = [
        { band: 0, z: worldZ(0) - CELL / 2 },
        { band: window.PAL_BANDS - 1, z: worldZ(D - 1) + CELL / 2 }
    ];
    defs.forEach(function (dfn) {
        const g = new THREE.Group();
        const curb = new THREE.Mesh(new THREE.BoxGeometry(spanX, 6, 5), mat);
        curb.position.y = 3; curb.castShadow = true; curb.receiveShadow = true; g.add(curb);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(spanX, 1.6, 6), matGold);
        cap.position.y = 6.6; g.add(cap);
        g.position.set(0, 0, dfn.z);
        groupEnv.add(g);
        edgeLips.push({ group: g, band: dfn.band });
    });
    updateEdgeLips();
}
function updateEdgeLips() {
    edgeLips.forEach(function (l) {
        const h = window.palBandHeight ? window.palBandHeight(l.band) : 1;
        l.group.position.y = h * STEP;          // sit on top of the entrance band's pane
    });
}

// one glass cube per voxel — the whole footprint is the building
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
    // one crown ornament centred over the 2x2 transept block
    let ax = 0, az = 0, an = 0, ah = 0;
    for (let x = 0; x < W; x++) for (let y = 0; y < D; y++) {
        if (window.palIsApex(x, y)) { ax += worldX(x); az += worldZ(y); ah = levelTop(window.palLevel(x, y)); an++; }
    }
    if (an) buildCrown(ax / an, az / an, ah);
}

// clickable raise/lower handles on the west edge of each 8x2 band
function bandCenterZ(b) { return worldZ(b * 2) / 2 + worldZ(b * 2 + 1) / 2; }
function buildBandControls() {
    while (groupControls.children.length) groupControls.remove(groupControls.children[0]);
    bandHandles.length = 0;
    const nBands = window.PAL_BANDS || 5;
    const edgeX = worldX(0) - CELL * 0.5 - 14;      // just outside the west wall
    for (let b = 0; b < nBands; b++) {
        const cz = bandCenterZ(b);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 8, 12), matGold);
        post.position.set(edgeX, 0, cz);
        groupControls.add(post);

        const up = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), matGold.clone());
        up.userData.tierHandle = { band: b, delta: 1 };
        groupControls.add(up);

        const down = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), matGold.clone());
        down.rotation.x = Math.PI;
        down.userData.tierHandle = { band: b, delta: -1 };
        groupControls.add(down);

        // a subtle disc plate behind the arrows so they read as a control
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.5, 20),
            new THREE.MeshStandardMaterial({ color: 0x2a2417, roughness: 0.7, metalness: 0.4 }));
        plate.rotation.z = Math.PI / 2;
        plate.position.set(edgeX - 3, 0, cz);
        groupControls.add(plate);

        bandHandles.push({ band: b, up: up, down: down, post: post, plate: plate, x: edgeX, z: cz });
    }
    updateBandControls();
}

// keep each handle riding at its band's live height, arrows greyed at limits
function updateBandControls() {
    const lo = window.PAL_TIER_MIN || 1, hi = window.PAL_TIER_MAX || 3;
    bandHandles.forEach(function (h) {
        const lv = window.palBandHeight(h.band);
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

// the crown socket over the 2x2 centre — rides its band's height
let crownGroup = null;
function buildCrown(cx, cz, h) {
    crownGroup = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 1.4, 10, 34), matGold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.8, 0);
    crownGroup.add(ring);
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 8), matGold);
        spike.position.set(Math.cos(a) * 20, 5, Math.sin(a) * 20);
        crownGroup.add(spike);
    }
    crownGroup.position.set(cx, h, cz);
    groupBuild.add(crownGroup);
}

// ---- grown glass (quad raises) ----
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

// grow or shrink columns so the built height matches the live palLevel.
// Above the built base: dynamic cubes are added/removed. Below the base:
// static cubes are hidden/shown. Caps ride the live surface; holes stay
// holes at whatever height their band currently has.
function ensureHeights() {
    baseLevels.forEach(function (base, key) {
        const parts = key.split(',');
        const x = +parts[0], y = +parts[1];
        const cur = window.palLevel(x, y);
        let arr = grownCubes.get(key) || [];
        while (base + arr.length < cur) {                 // grow above base
            const k = base + arr.length;
            const list = makeGlassCube(x, y, k);
            voxelMeshes.set(key + ',' + k, list);
            arr.push(list);
            needsRender = true;
        }
        while (arr.length && base + arr.length > cur) {   // shrink dynamic
            const k = base + arr.length - 1;
            const list = arr.pop();
            list.forEach(function (m) { groupBuild.remove(m); });
            voxelMeshes.delete(key + ',' + k);
            needsRender = true;
        }
        grownCubes.set(key, arr);
        for (let k = 0; k < base; k++) {                  // static visibility below base
            const list = voxelMeshes.get(key + ',' + k);
            if (!list) continue;
            const vis = k < cur;
            if (list[0].visible !== vis) {
                list[0].visible = vis;                    // glass
                if (list[1]) list[1].visible = vis;       // frame edges
                needsRender = true;
            }
        }
        const cap = capMeshes.get(key);
        if (cap) cap.position.y = levelTop(cur) + 0.4;
    });
}

// ---- cracks & holes ----
function seededRand(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function drawCrack(key) {
    if (crackLines.has(key)) return;
    const parts = key.split(',');
    const x = +parts[0], y = +parts[1];
    const L = window.palLevel(x, y);
    const cx = worldX(x), cz = worldZ(y), h = levelTop(L) + 0.9;
    const rnd = seededRand(key);
    const g = new THREE.Group();
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const r0 = 2 + rnd() * 4, r1 = 8 + rnd() * 6;
        const midA = a + (rnd() - 0.5) * 0.7;
        const pts = [
            new THREE.Vector3(cx + Math.cos(a) * r0, h, cz + Math.sin(a) * r0),
            new THREE.Vector3(cx + Math.cos(midA) * (r0 + r1) / 2, h, cz + Math.sin(midA) * (r0 + r1) / 2),
            new THREE.Vector3(cx + Math.cos(a) * r1, h, cz + Math.sin(a) * r1)
        ];
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matCrack));
    }
    g.userData.h0 = h;
    groupCracks.add(g);
    crackLines.set(key, g);
    const cap = capMeshes.get(key);
    if (cap) { cap.material.color.setHex(CAP_COLOR[L]).lerp(new THREE.Color(0xffffff), 0.32); cap.material.roughness = 0.5; }
}
function clearCrack(key) {
    const g = crackLines.get(key);
    if (g) { groupCracks.remove(g); crackLines.delete(key); }
    const parts = key.split(',');
    const cap = capMeshes.get(key);
    if (cap) { cap.material.color.setHex(CAP_COLOR[window.palLevel(+parts[0], +parts[1])]); cap.material.roughness = 0.25; }
}
function clearHole(key) {
    // visibility is restored by ensureHeights once the hole is gone from state
    const floor = holeFloors.get(key);
    if (floor) { groupBuild.remove(floor); holeFloors.delete(key); }
    const cap = capMeshes.get(key);
    if (cap) cap.visible = true;
}
function applyHole(key) {
    // pane visibility is handled by ensureHeights — here we keep the pit floor
    const parts = key.split(',');
    const x = +parts[0], y = +parts[1];
    clearCrack(key);
    if (!holeFloors.has(key)) {
        const L = window.palLevel(x, y);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(CELL - 3, 1, CELL - 3), matPit);
        floor.position.set(worldX(x), Math.max(0, (L - 1) * STEP) + 0.5, worldZ(y));
        groupBuild.add(floor);
        holeFloors.set(key, floor);
    }
}

// ============================================
// STONES & POOL
// ============================================
function createStone(colorHex, dark) {
    // a glass sphere — the pieces roll, they do not climb
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: dark ? 0.3 : 0.15, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(9, 26, 18), mat);
    body.position.y = 9; body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.1, 0.5, 8, 26), matBevel.clone());
    ring.rotation.x = Math.PI / 2; ring.position.y = 9; g.add(ring);
    g.userData.mainMat = mat;
    return g;
}
function createCarryGem(colorHex, emissiveHex) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex, emissive: emissiveHex, emissiveIntensity: 1.4,
        roughness: 0.1, metalness: 0.6
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(3.0), mat);
    gem.position.y = 7.5;
    g.add(gem);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(5.0, 12, 8),
        new THREE.MeshBasicMaterial({ color: emissiveHex, transparent: true, opacity: 0.35 }));
    glow.position.y = 7.5;
    g.add(glow);
    return g;
}
function createPoolArtifact(colorHex, emissiveHex) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex, emissive: emissiveHex, emissiveIntensity: 1.4,
        roughness: 0.1, metalness: 0.6
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(5.2), mat);
    gem.position.y = 7;
    g.add(gem);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(8.5, 14, 10),
        new THREE.MeshBasicMaterial({ color: emissiveHex, transparent: true, opacity: 0.4 }));
    glow.position.y = 7;
    g.add(glow);
    return g;
}

// ============================================
function palaceSync3D() {
    syncPlay(window.getPalState());
}

function syncPlay(st) {
    ensureHeights();
    updateBandControls();
    updateEdgeLips();

    // spheres on the building
    const live = new Set();
    st.stones.forEach(function (s) {
        const key = 'p' + s.id; live.add(key);
        let mesh = stoneMeshes.get(key);
        if (!mesh) { mesh = createStone(PCOL[s.color].stone, s.color !== 'W'); mesh.userData.id = s.id; groupStones.add(mesh); stoneMeshes.set(key, mesh); }
        mesh.quaternion.identity();
        if (!mesh.userData.animating) mesh.position.copy(standPos(s.x, s.y, s.k));
    });
    stoneMeshes.forEach(function (m, key) { if (!live.has(key) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(key); } });

    // pool on the plinth
    while (groupPool.children.length) groupPool.remove(groupPool.children[0]);
    ['W', 'B'].forEach(function (c) {
        st.pool[c].forEach(function (has, col) {
            if (!has) return;
            const m = createStone(PCOL[c].stone, c !== 'W');
            m.position.copy(poolPos(c, col));
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
        st.pool[st.turn].forEach(function (has, col) {
            if (!has) return;
            const p = poolPos(st.turn, col);
            const ring = new THREE.Mesh(new THREE.RingGeometry(11, 14, 30), matSelStone);
            ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.8, p.z);
            groupTargets.add(ring);
        });
    }
    st.targets.forEach(function (t) {
        let mat = matStep;                          // plain roll (blue)
        if (t.type === 'smash' || t.type === 'fall' || t.type === 'carom') mat = matShatter;  // a sphere dies (red)
        else if (t.type === 'hop') mat = matPlace;  // hop up a level (green)
        else if (t.type === 'place') mat = matPlace;
        const lv = window.palLevel(t.x, t.y);
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.28, CELL * 0.4, 26), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(worldX(t.x), lv * STEP + 1.6, worldZ(t.y));
        ring.userData.target = t;
        groupTargets.add(ring);
        // invisible full-cell disc so a tap ANYWHERE inside the ring counts as the move,
        // not just the thin ring band itself.
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
function palaceAnimStoneMove(id, from, to, type) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    const start = standPos(from.x, from.y, from.k), end = standPos(to.x, to.y, to.k);
    mesh.position.copy(start); mesh.userData.animating = true;
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 380).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { mesh.position.lerpVectors(start, end, o.t); mesh.position.y += Math.sin(Math.PI * o.t) * 10; needsRender = true; })
        .onComplete(function () { mesh.position.copy(end); mesh.userData.animating = false; if (window.palaceSync3D) window.palaceSync3D(); }).start();
    needsRender = true;
}

// a smashed sphere shatters and is gone
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

// the stone drops INTO the palace and is returned to the pool
function palaceAnimFall(id, at, from, withShards) {
    const mesh = stoneMeshes.get('p' + id); if (!mesh) return;
    stoneMeshes.delete('p' + id);
    mesh.userData.animating = true;
    const start = standPos(from.x, from.y, from.k);
    const over = standPos(at.x, at.y, at.k);
    mesh.position.copy(start);
    if (withShards) glassShards(over.x, over.y + 2, over.z);
    const o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 300).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { mesh.position.lerpVectors(start, over, o.t); needsRender = true; })
        .onComplete(function () {
            const d = { y: over.y };
            new TWEEN.Tween(d).to({ y: 4 }, 520).easing(TWEEN.Easing.Quadratic.In)
                .onUpdate(function () { mesh.position.y = d.y; mesh.rotation.x += 0.08; needsRender = true; })
                .onComplete(function () {
                    new TWEEN.Tween(mesh.scale).to({ x: 0.01, y: 0.01, z: 0.01 }, 260)
                        .onComplete(function () { groupStones.remove(mesh); if (window.palaceSync3D) window.palaceSync3D(); needsRender = true; }).start();
                }).start();
        }).start();
    needsRender = true;
}

// pushed clean off the building's edge
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
        const box = document.getElementById('message-box');
        const title = document.getElementById('message-title');
        const text = document.getElementById('message-text');
        const loser = (color === 'W' ? 'Black' : 'White');
        const reason = (window.getPalState && window.getPalState().winReason) || 'smash';
        if (title) title.textContent = (color === 'W' ? 'White' : 'Black') + ' Wins';
        if (text) text.textContent = reason === 'stuck'
            ? loser + ' has no legal move left!'
            : loser + ' is smashed below four spheres!';
        if (box) box.classList.add('visible');
        needsRender = true;
    }, 1100);
}

// quad raise — the glass grows with a burst of dust at each pane
function palaceAnimRaise(cells, newTop) {
    cells.forEach(function (c) {
        glassShards(worldX(c.x), levelTop(newTop) + 2, worldZ(c.y));
    });
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
    // band controls are always live, checked first
    const ctrlHits = castObjects(groupControls.children);
    for (let i = 0; i < ctrlHits.length; i++) {
        const h = bubbleTo(ctrlHits[i].object, 'tierHandle');
        if (h) { window.palSetTier(h.userData.tierHandle.band, h.userData.tierHandle.delta); return; }
    }
    const hits = castObjects([].concat(groupTargets.children, groupPool.children, groupStones.children, groupBuild.children));
    if (!hits.length) return;
    // nearest sphere under the cursor (skipping rings / panes in front)
    let firstStoneId = null;
    for (let i = 0; i < hits.length; i++) {
        const so = bubbleTo(hits[i].object, 'id');
        if (so) { firstStoneId = so.userData.id; break; }
    }
    // 1) clicking your OWN selected sphere always cancels — this must win even over
    //    a self-fall target (ring + tap-pad) that sits on the sphere's own pane.
    if (st.selected && st.selected.kind === 'stone' && firstStoneId === st.selected.id) {
        window.palPlayTapStone(firstStoneId); return;
    }
    // 2) an explicit target — the ring or its full-cell tap-pad
    for (let i = 0; i < hits.length; i++) {
        const t = bubbleTo(hits[i].object, 'target');
        if (t) { window.palPlayTapTarget(t.userData.target); return; }
    }
    // 3) movement intent overrides selection: a click on a legal target CELL runs
    //    the move even when a sphere (a carom / smash victim) stands on that cell
    //    and its ball hides the flat ring. The selected sphere's own pane is
    //    excluded here — that click is the cancel handled above.
    if (st.selected && st.selected.kind === 'stone') {
        const sel = st.stones.find(function (s) { return s.id === st.selected.id; });
        for (let i = 0; i < hits.length; i++) {
            const p = hits[i].object.position;
            if (!p) continue;
            const gx = Math.round(p.x / CELL + (W - 1) / 2);
            const gy = Math.round(p.z / CELL + (D - 1) / 2);
            if (sel && gx === sel.x && gy === sel.y) continue;
            const t = st.targets.find(function (q) { return q.x === gx && q.y === gy; });
            if (t) { window.palPlayTapTarget(t); return; }
        }
    }
    // 4) a reserve sphere in the pool
    for (let i = 0; i < hits.length; i++) {
        const pc = bubbleTo(hits[i].object, 'poolColor');
        if (pc) { window.palTapPool(pc.userData.poolColor); return; }
    }
    // 5) select (or cancel) a sphere on the board
    const so = bubbleTo(hits[0].object, 'id');
    if (so) { window.palPlayTapStone(so.userData.id); return; }
}

function clearHover() {
    if (renderer) renderer.domElement.style.cursor = 'default';
}
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
