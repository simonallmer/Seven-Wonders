// ============================================
// CATHEDRAL 3D VIEW — "The Conversion"
// Greek-cross node mesh (Temple lattice), stones that change allegiance
// ============================================

window.is3DView = false;
let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupPillars = new THREE.Group();  // columns + their torches — retract after the first move
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

// --- basilica interior materials ---
const matStone = new THREE.MeshStandardMaterial({ color: 0xbcac8c, roughness: 0.9 });
const matStoneWarm = new THREE.MeshStandardMaterial({ color: 0xc9b994, roughness: 0.85 });
const matStoneDark = new THREE.MeshStandardMaterial({ color: 0x8f8064, roughness: 0.9 });
const matIron = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6, metalness: 0.5 });
const matWood = new THREE.MeshStandardMaterial({ color: 0x5b3d27, roughness: 0.8 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xcaa24a, roughness: 0.3, metalness: 0.85, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matFlame = new THREE.MeshBasicMaterial({ color: 0xffb24d });      // unlit — always reads as "lit"
const matFlameCore = new THREE.MeshBasicMaterial({ color: 0xfff2c4 });

// The pillars (and their torches) own a private set of materials so they can
// fade out on their own after the first move without touching the walls,
// altar or pews, which share the plain names above.
const matPCol = new THREE.MeshStandardMaterial({ color: 0xbcac8c, roughness: 0.9 });
const matPWarm = new THREE.MeshStandardMaterial({ color: 0xc9b994, roughness: 0.85 });
const matPDark = new THREE.MeshStandardMaterial({ color: 0x8f8064, roughness: 0.9 });
const matPIron = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6, metalness: 0.5 });
const matPFlame = new THREE.MeshBasicMaterial({ color: 0xffb24d });
const matPCore = new THREE.MeshBasicMaterial({ color: 0xfff2c4 });
const pillarMats = [matPCol, matPWarm, matPDark, matPIron, matPFlame, matPCore];
let firstMoveDone = false;

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

    scene.add(groupEnv, groupPillars, groupBoard, groupStones, groupTargets, groupFX);
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

    // Four dome-piers, pulled out to the diagonal corners so they frame the
    // crossing rather than crowd the foreground.
    [[150, 150], [-150, 150], [150, -150], [-150, -150]].forEach(function (p) {
        makeColumn(p[0], p[1], 250, 12, true);
        makeTorch(p[0] - Math.sign(p[0]) * 16, 152, p[1] - Math.sign(p[1]) * 16, true, 1);
    });

    // Colonnades lining the four arms — the long naves of the basilica.
    addColonnade(-95, -70, -95, -200, 4, 200, 8);
    addColonnade(95, -70, 95, -200, 4, 200, 8);
    addColonnade(-95, 70, -95, 200, 4, 200, 8);
    addColonnade(95, 70, 95, 200, 4, 200, 8);
    addColonnade(-70, -95, -200, -95, 4, 200, 8);
    addColonnade(-70, 95, -200, 95, 4, 200, 8);
    addColonnade(70, -95, 200, -95, 4, 200, 8);
    addColonnade(70, 95, 200, 95, 4, 200, 8);
    // Extend the far nave down toward the sanctuary.
    addColonnade(-95, -210, -95, -320, 3, 200, 8);
    addColonnade(95, -210, 95, -320, 3, 200, 8);

    buildPerimeter();       // enclosing arcaded walls make it an interior
    buildAltar();           // the baldachin vista straight down the far nave
    buildCornerSeating();   // congregation seats in every corner — these stay
}

// Retract (or restore) the pillars by fading their shared materials. Once
// faded out the group is hidden, so its torch lights stop contributing too.
function setPillars(show) {
    groupPillars.visible = true;
    pillarMats.forEach(function (m) { m.transparent = true; });
    const o = { v: show ? 0 : 1 };
    new TWEEN.Tween(o).to({ v: show ? 1 : 0 }, 800).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(function () { pillarMats.forEach(function (m) { m.opacity = o.v; }); needsRender = true; })
        .onComplete(function () {
            if (!show) { groupPillars.visible = false; }
            else { pillarMats.forEach(function (m) { m.transparent = false; m.opacity = 1; }); }
            needsRender = true;
        }).start();
    needsRender = true;
}

// A classical column: stepped base, faintly tapered shaft, blocky capital.
function makeColumn(x, z, height, radius, cast) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.4, height * 0.05, radius * 3.4), matPDark);
    base.position.y = height * 0.025; g.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, height * 0.84, 20), matPCol);
    shaft.position.y = height * 0.49; g.add(shaft);
    const echinus = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.5, radius * 0.85, height * 0.045, 20), matPWarm);
    echinus.position.y = height * 0.895; g.add(echinus);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.3, height * 0.035, radius * 2.3), matPDark);
    cap.position.y = height * 0.935; g.add(cap);
    g.position.set(x, FLOOR_Y, z);
    if (cast) g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    groupPillars.add(g);
    return g;
}

// A wall torch — an iron cup and an unlit flame that always reads as burning.
// addLight adds a warm point light (used sparingly to keep the render cheap).
function makeTorch(x, y, z, addLight, scale, pillar) {
    scale = scale || 1;
    if (pillar === undefined) pillar = true;   // most torches ride the columns
    const grp = pillar ? groupPillars : groupEnv;
    const mIron = pillar ? matPIron : matIron;
    const mFlame = pillar ? matPFlame : matFlame;
    const mCore = pillar ? matPCore : matFlameCore;
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * scale, 1.2 * scale, 4 * scale, 8), mIron);
    g.add(cup);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2.3 * scale, 8 * scale, 8), mFlame);
    flame.position.y = 5 * scale; g.add(flame);
    const core = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 4.6 * scale, 8), mCore);
    core.position.y = 4.5 * scale; g.add(core);
    g.position.set(x, y, z); grp.add(g);
    if (addLight) {
        const pl = new THREE.PointLight(0xffb160, 0.55, 240, 2);
        pl.position.set(x, y + 6, z); grp.add(pl);   // rides with the pillars, so it dims out too
    }
    return g;
}

// A row of columns along a segment; every other one carries a torch turned
// toward the crossing.
function addColonnade(x0, z0, x1, z1, count, h, r) {
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        makeColumn(x, z, h, r, true);
        if (i % 2 === 0) {
            const d = Math.hypot(x, z) || 1;
            makeTorch(x - (x / d) * (r + 4), h * 0.62, z - (z / d) * (r + 4), false, 1);
        }
    }
}

// A carved pew. The backrest sits on the pew's local +z, so the seated
// congregation looks toward local -z; yaw aims that gaze (0 = toward the altar).
function makePew(x, z, width, yaw) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 3, 8), matWood);
    seat.position.y = 8; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, 10, 2), matWood);
    back.position.set(0, 13, 4); back.castShadow = true; g.add(back);
    g.position.set(x, FLOOR_Y, z); g.rotation.y = yaw || 0; groupEnv.add(g);
}

// Blocks of pews tucked into each diagonal corner, angled to face the crossing.
function buildCornerSeating() {
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) {
        const yaw = Math.atan2(s[0], s[1]);   // local +z (backrest) points out to the corner
        for (let r = 0; r < 3; r++) {
            const d = 116 + r * 22;
            makePew(s[0] * d * 0.707, s[1] * d * 0.707, 58, yaw);
        }
    });
}

// The four enclosing walls, each with a cornice and an inner blind arcade
// of pilasters and round arches.
function buildPerimeter() {
    const R = 470, H = 320, T = 18, L = 1080;
    [{ axis: 'z', sign: -1 }, { axis: 'z', sign: 1 }, { axis: 'x', sign: -1 }, { axis: 'x', sign: 1 }].forEach(function (s) {
        const rotY = s.axis === 'z' ? 0 : Math.PI / 2;
        const place = function (mesh, u, y, depth) {
            if (s.axis === 'z') mesh.position.set(u, y, s.sign * depth);
            else { mesh.position.set(s.sign * depth, y, u); mesh.rotation.y = Math.PI / 2; }
        };
        const wall = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), matStoneWarm);
        place(wall, 0, H / 2, R); wall.rotation.y = rotY; wall.receiveShadow = true; groupEnv.add(wall);
        const cor = new THREE.Mesh(new THREE.BoxGeometry(L, 18, T + 10), matStoneDark);
        place(cor, 0, H - 26, R); cor.rotation.y = rotY; groupEnv.add(cor);

        const n = 9, span = L * 0.86, inner = R - T / 2 - 3;
        for (let i = 0; i < n; i++) {
            const u = -span / 2 + span * (i / (n - 1));
            const pil = new THREE.Mesh(new THREE.BoxGeometry(14, H * 0.82, 6), matStone);
            place(pil, u, H * 0.41, inner); groupEnv.add(pil);
        }
        const arcR = (span / (n - 1)) / 2 * 0.9;
        for (let i = 0; i < n - 1; i++) {
            const u = -span / 2 + span * ((i + 0.5) / (n - 1));
            const arch = new THREE.Mesh(new THREE.TorusGeometry(arcR, 3, 6, 16, Math.PI), matStone);
            place(arch, u, H * 0.58, inner); groupEnv.add(arch);
        }
    });
}

// A raised sanctuary at the head of the far nave: stepped dais, altar block,
// a gilded four-column baldachin crowned with a cross, candles and pews.
function buildAltar() {
    const zc = -330;
    for (let i = 0; i < 3; i++) {
        const w = 150 - i * 34;
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 10, w * 0.6), matStone);
        step.position.set(0, 5 + i * 10, zc + 10); step.receiveShadow = true; step.castShadow = true; groupEnv.add(step);
    }
    const altar = new THREE.Mesh(new THREE.BoxGeometry(46, 26, 24), matStoneWarm);
    altar.position.set(0, 43, zc); altar.castShadow = true; groupEnv.add(altar);

    const bh = 150;
    [[-30, -18], [30, -18], [-30, 18], [30, 18]].forEach(function (o) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, bh, 12), matGold);
        col.position.set(o[0], 40 + bh / 2, zc + o[1]); col.castShadow = true; groupEnv.add(col);
    });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(80, 12, 56), matGold);
    canopy.position.set(0, 40 + bh + 6, zc); canopy.castShadow = true; groupEnv.add(canopy);
    [[-38, -26], [38, -26], [-38, 26], [38, 26]].forEach(function (o) {
        const fin = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10), matGold);
        fin.position.set(o[0], 40 + bh + 14, zc + o[1]); groupEnv.add(fin);
    });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(4, 22, 4), matGold); crossV.position.set(0, 40 + bh + 26, zc); groupEnv.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 4), matGold); crossH.position.set(0, 40 + bh + 24, zc); groupEnv.add(crossH);

    [-30, 30].forEach(function (x) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 20, 8), matGold);
        stick.position.set(x, 50, zc + 6); groupEnv.add(stick);
        makeTorch(x, 62, zc + 6, false, 0.5, false);   // permanent altar candle, not a pillar torch
    });
    const glow = new THREE.PointLight(0xffcb87, 0.85, 480, 2); glow.position.set(0, 120, zc + 20); groupEnv.add(glow);

    for (let i = 0; i < 4; i++) {
        const z = -215 - i * 26;
        makePew(-38, z, 60);
        makePew(38, z, 60);
    }
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
    // new game — bring the pillars back for the opening tableau
    firstMoveDone = false;
    groupPillars.visible = true;
    pillarMats.forEach(function (m) { m.transparent = false; m.opacity = 1; });
    buildBoard(); cathSync3D();
}

function cathAnimMove(from, to) {
    if (!firstMoveDone) { firstMoveDone = true; setPillars(false); }   // the pillars retract once play begins
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
