// ============================================
// GREAT WALL — CROSSING (4 Player) 3D VIEW
// Two walls meet at a mountain saddle. The crossing is a fortress: four gate
// towers cap the arms, four bastions fill the re-entrant crooks, and both
// walkways run seamlessly through a central plaza.
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;
let clockT = 0;

const groupEnvironment = new THREE.Group();
const groupWall = new THREE.Group();
const groupSlabs = new THREE.Group();
const groupPieces = new THREE.Group();
const groupReserves = new THREE.Group();
const groupHighlights = new THREE.Group();
const groupFacing = new THREE.Group();
const groupFX = new THREE.Group();
const groupBirds = new THREE.Group();

const warriorMeshes = new Map();
const slabMeshes = new Map();
let flames = [];
let flags = [];

// ---- Layout ---------------------------------------------------------------
const CELL = 24;
const WALL_TOP = 100;
const N = 25;                       // lattice is 25x25 (10 + 5 + 10)
const HALF = (N / 2) * CELL;        // 300 — half the full board span
const BANDHALF = 2.5 * CELL;       // 60  — half the walkable band width (arms stay 5 wide)
const WALL_DEPTH = 2 * BANDHALF + 38; // 158 — cross-section of an arm
const WALL_LEN = 2 * HALF + 36;    // 636 — arm-to-arm length of a wall
const PARAPET = WALL_DEPTH / 2 - 6; // 73  — parapet offset from centre line
const TOWER_D = HALF + 66;         // 366 — gate tower distance from centre
const ARM_INNER = BANDHALF;        // 60  — where a parapet run begins
const ARM_OUTER = HALF + 10;       // 310 — where it ends at the tower

function cellTo3D(r, c) {
    return { x: (c - (N - 1) / 2) * CELL, y: WALL_TOP, z: (r - (N - 1) / 2) * CELL };
}

// ---- Materials — weathered Badaling stone ---------------------------------
const matBrick = new THREE.MeshStandardMaterial({ color: 0x958b7c, roughness: 0.9, metalness: 0.02 });
const matBrickDark = new THREE.MeshStandardMaterial({ color: 0x726a5e, roughness: 0.9, metalness: 0.02 });
const matBrickWarm = new THREE.MeshStandardMaterial({ color: 0xa1927f, roughness: 0.88, metalness: 0.02 });
const matSlab = new THREE.MeshStandardMaterial({ color: 0xcfc2a4, roughness: 0.85, metalness: 0.05 });
const matSlabDark = new THREE.MeshStandardMaterial({ color: 0xc2b393, roughness: 0.85, metalness: 0.05 });
const matRock = new THREE.MeshStandardMaterial({ color: 0x6e6052, roughness: 1.0 });
const matRockDark = new THREE.MeshStandardMaterial({ color: 0x5a4d40, roughness: 1.0 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x46603a, roughness: 1.0 });
const matPine = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 0.95 });
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
const matMountain = new THREE.MeshStandardMaterial({ color: 0x7a8694, roughness: 1.0 });
const matMountainFar = new THREE.MeshStandardMaterial({ color: 0x97a2b0, roughness: 1.0 });
const matGoldTrim = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.3, metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.15 });
const matFlame = new THREE.MeshBasicMaterial({ color: 0xff9d3c });
const matRoof = new THREE.MeshStandardMaterial({ color: 0x6e4a36, roughness: 0.9 });

// Four armies. Body = identity colour; accent drives the banner & trim.
const PCOL = { W: 0xe9e1cd, R: 0xa83a30, B: 0x3a332b, U: 0x3f68b0 };
const PACC = { W: 0xcaa24a, R: 0xf0cf87, B: 0xc23b22, U: 0xd6e4f5 };
const PBANNER = { W: 0xefe7d3, R: 0xc94a3b, B: 0x2a2a2a, U: 0x4d7ec8 };
const bodyMats = {}, accMats = {};
(window.PLAYERS || ['W', 'R', 'B', 'U']).forEach(function (c) {
    bodyMats[c] = new THREE.MeshStandardMaterial({ color: PCOL[c], roughness: 0.8, metalness: 0.06 });
    accMats[c] = new THREE.MeshStandardMaterial({ color: PACC[c], roughness: 0.5, metalness: 0.2, emissive: 0x1a1206, emissiveIntensity: 0.2 });
});

const matHLPlace = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, depthWrite: false });
const matHLMove = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, depthWrite: false });
const matHLSelect = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75, depthWrite: false });
const matHLChain = new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0.55, depthWrite: false });
const matArcShield = new THREE.MeshBasicMaterial({ color: 0x2a6db0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const matArcVuln = new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const matArrow = new THREE.MeshBasicMaterial({ color: 0xff5533 });
const matFacingArrow = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
const matFacingHit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const matDebrisLight = new THREE.MeshStandardMaterial({ color: 0xd9d0b8, roughness: 0.9 });
const matDebrisDark = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.9 });

function onBoard3(r, c) {
    return typeof window.onBoard === 'function' ? window.onBoard(r, c) : true;
}

// ============================================
// INIT
// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfde0ad);
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.00030);

    // Near plane kept well out (nothing is closer than the min orbit distance) so
    // the depth buffer has plenty of precision — this is what stops z-fighting.
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 12, 11000);
    camera.position.set(560, 740, 880);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 240;
    controls.maxDistance = 2800;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enablePan = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.target.set(0, WALL_TOP, 0);
    controls.update();
    controls.addEventListener('change', () => { needsRender = true; });

    const hemiLight = new THREE.HemisphereLight(0xfff2e0, 0x4a5d23, 0.62);
    hemiLight.position.set(0, 500, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffd9a0, 1.3);
    dirLight.position.set(360, 400, 240);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 1100;
    dirLight.shadow.camera.bottom = -1100;
    dirLight.shadow.camera.left = -1100;
    dirLight.shadow.camera.right = 1100;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 3600;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    scene.add(groupEnvironment);
    scene.add(groupWall);
    scene.add(groupSlabs);
    scene.add(groupPieces);
    scene.add(groupReserves);
    scene.add(groupHighlights);
    scene.add(groupFacing);
    scene.add(groupFX);
    scene.add(groupBirds);

    buildEnvironment();
    buildWall();
    build3DBoard();

    window.addEventListener('resize', onWindowResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    let downPos = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => { downPos.x = e.clientX; downPos.y = e.clientY; });
    renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) onPointerDown(e);
    });

    renderer.setAnimationLoop(animate3D);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

// ============================================
// ENVIRONMENT — a mountain saddle where two ridgelines cross
// ============================================
function addRidgeArm(alongX) {
    // A rock spine running under one wall, with sloped skirts on both flanks so
    // the arm reads as riding a natural ridgeline rather than a floating beam.
    const spineLen = 2 * HALF + 620;
    const spineW = 2 * BANDHALF + 96;
    const spine = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(spineLen, 200, spineW) : new THREE.BoxGeometry(spineW, 200, spineLen),
        matRock);
    spine.position.y = -100;
    spine.receiveShadow = true;
    groupEnvironment.add(spine);

    for (let side = -1; side <= 1; side += 2) {
        const skirt = new THREE.Mesh(
            alongX ? new THREE.BoxGeometry(spineLen, 190, 200) : new THREE.BoxGeometry(200, 190, spineLen),
            matRockDark);
        if (alongX) { skirt.position.set(0, -118, side * (spineW / 2 + 78)); skirt.rotation.x = side * 0.52; }
        else { skirt.position.set(side * (spineW / 2 + 78), -118, 0); skirt.rotation.z = -side * 0.52; }
        skirt.receiveShadow = true;
        groupEnvironment.add(skirt);
    }
}

function buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(8000, 48), matGround);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -180;
    ground.receiveShadow = true;
    groupEnvironment.add(ground);

    // Two crossing ridgelines + the summit mound they meet on.
    addRidgeArm(true);
    addRidgeArm(false);
    const summit = new THREE.Mesh(new THREE.BoxGeometry(2 * BANDHALF + 150, 230, 2 * BANDHALF + 150), matRock);
    summit.position.y = -100;
    summit.receiveShadow = true;
    groupEnvironment.add(summit);

    // Rocky outcrops rising into the four crooks — each carries a corner bastion,
    // and their broken faces hide the seam where the two ridges meet.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const knuckle = new THREE.Mesh(new THREE.BoxGeometry(150, 260, 150), matRockDark);
        knuckle.position.set(sx * 120, -70, sz * 120);
        knuckle.rotation.y = (sx * sz) * 0.4;
        knuckle.receiveShadow = true;
        knuckle.castShadow = true;
        groupEnvironment.add(knuckle);
        // a few boulders tumbling down the crook
        for (let i = 0; i < 5; i++) {
            const b = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + Math.random() * 9), matRock);
            b.position.set(sx * (95 + Math.random() * 90), -150 + Math.random() * 40, sz * (95 + Math.random() * 90));
            b.rotation.set(Math.random(), Math.random(), Math.random());
            b.castShadow = true;
            groupEnvironment.add(b);
        }
    }

    // Distant peaks
    for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.2;
        const dist = 2600 + Math.random() * 2000;
        const h = 520 + Math.random() * 1000;
        const m = new THREE.Mesh(new THREE.ConeGeometry(620 + Math.random() * 520, h, 7), i % 2 ? matMountain : matMountainFar);
        m.position.set(Math.cos(angle) * dist, -180 + h / 2, Math.sin(angle) * dist);
        groupEnvironment.add(m);
    }
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1150 + Math.random() * 1000;
        const h = 260 + Math.random() * 380;
        const m = new THREE.Mesh(new THREE.ConeGeometry(400 + Math.random() * 280, h, 6),
            new THREE.MeshStandardMaterial({ color: 0x3e5544, roughness: 1.0 }));
        m.position.set(Math.cos(angle) * dist, -180 + h / 2, Math.sin(angle) * dist);
        groupEnvironment.add(m);
    }

    // Pines — thickest in the crooks so the geometry never reads as bare beams.
    for (let i = 0; i < 120; i++) {
        // bias toward the four crook valleys
        let x, z;
        if (i % 2 === 0) {
            const sx = Math.random() < 0.5 ? -1 : 1, sz = Math.random() < 0.5 ? -1 : 1;
            x = sx * (110 + Math.random() * 520);
            z = sz * (110 + Math.random() * 520);
        } else {
            x = (Math.random() - 0.5) * 1900;
            z = (Math.random() - 0.5) * 1900;
        }
        // keep trees off the walkways
        if (Math.abs(x) < 90 && Math.abs(z) < HALF + 60) continue;
        if (Math.abs(z) < 90 && Math.abs(x) < HALF + 60) continue;
        const s = 0.7 + Math.random() * 1.0;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 12, 5), matTrunk);
        trunk.position.y = 6; tree.add(trunk);
        for (let t = 0; t < 3; t++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(10 - t * 2.4, 14, 7), matPine);
            cone.position.y = 14 + t * 8; cone.castShadow = true; tree.add(cone);
        }
        tree.scale.set(s, s, s);
        tree.position.set(x, -176 + Math.random() * 20, z);
        groupEnvironment.add(tree);
    }

    // Circling kestrels
    for (let i = 0; i < 5; i++) {
        const bird = new THREE.Group();
        const wingL = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ color: 0x4a3f33, side: THREE.DoubleSide }));
        wingL.position.x = -4; wingL.rotation.z = 0.25;
        const wingR = wingL.clone(); wingR.position.x = 4; wingR.rotation.z = -0.25;
        bird.add(wingL); bird.add(wingR);
        bird.userData = { angle: Math.random() * Math.PI * 2, radius: 460 + Math.random() * 460, height: 280 + Math.random() * 180, speed: 0.0016 + Math.random() * 0.0014 };
        groupBirds.add(bird);
    }
}

// ============================================
// THE WALLS — a plus of stone, crenellated all round
// ============================================
function addArmBody(alongX) {
    const body = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(WALL_LEN, WALL_TOP, WALL_DEPTH) : new THREE.BoxGeometry(WALL_DEPTH, WALL_TOP, WALL_LEN),
        matBrick);
    body.position.y = WALL_TOP / 2;
    body.castShadow = true; body.receiveShadow = true;
    groupWall.add(body);

    for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(
            alongX ? new THREE.BoxGeometry(WALL_LEN + 1.5, 2.2, WALL_DEPTH + 1.5) : new THREE.BoxGeometry(WALL_DEPTH + 1.5, 2.2, WALL_LEN + 1.5),
            matBrickDark);
        band.position.y = 18 + i * 22;
        groupWall.add(band);
    }

    const walk = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(WALL_LEN, 2, WALL_DEPTH) : new THREE.BoxGeometry(WALL_DEPTH, 2, WALL_LEN),
        matBrickDark);
    // Sit the walkway well below the field slabs (slab top ~101.6) so their top
    // faces are never near-coplanar, and drop the vertical walkway a touch more so
    // the two walkways don't fight where they cross.
    walk.position.y = WALL_TOP - 0.3 - (alongX ? 0 : 0.4);
    walk.receiveShadow = true;
    groupWall.add(walk);
}

// A low parapet with crenellations running between two points along one axis.
function parapetRun(axis, fixed, from, to, faceSign) {
    const len = Math.abs(to - from);
    const mid = (from + to) / 2;
    const low = new THREE.Mesh(
        axis === 'x' ? new THREE.BoxGeometry(len, 7, 5) : new THREE.BoxGeometry(5, 7, len), matBrick);
    if (axis === 'x') low.position.set(mid, WALL_TOP + 3.6, fixed);
    else low.position.set(fixed, WALL_TOP + 3.6, mid);
    low.castShadow = true;
    groupWall.add(low);

    const count = Math.max(1, Math.floor(len / 17));
    for (let i = 0; i <= count; i++) {
        const t = from + (to - from) * (i / count);
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 9 : 5, 8, axis === 'x' ? 5 : 9), matBrick);
        if (axis === 'x') merlon.position.set(t, WALL_TOP + 11, fixed);
        else merlon.position.set(fixed, WALL_TOP + 11, t);
        merlon.castShadow = true;
        groupWall.add(merlon);
    }
}

// A round bastion filling a re-entrant crook, tying the two arms together.
function buildBastion(sx, sz) {
    const cx = sx * (BANDHALF + 24), cz = sz * (BANDHALF + 24);
    const g = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, WALL_TOP + 150, 16), matBrickWarm);
    drum.position.y = (WALL_TOP + 150) / 2 - 150;
    drum.castShadow = true; drum.receiveShadow = true;
    g.add(drum);
    // stone courses
    for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(30.6, 30.6, 2.2, 16), matBrickDark);
        ring.position.y = 8 + i * 20;
        g.add(ring);
    }
    // crenellated crown
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 8, 16), matBrick);
    crown.position.y = WALL_TOP + 6;
    g.add(crown);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 5), matBrick);
        m.position.set(Math.cos(a) * 31, WALL_TOP + 13, Math.sin(a) * 31);
        m.rotation.y = -a;
        g.add(m);
    }
    // conical cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(24, 26, 12), matRoof);
    cap.position.y = WALL_TOP + 30;
    cap.castShadow = true;
    g.add(cap);
    g.position.set(cx, 0, cz);
    groupWall.add(g);
}

function buildWall() {
    addArmBody(true);
    addArmBody(false);

    // Central plaza where the walls meet. The crossing cells render as this one
    // solid slab, and the compass sits in separated, polygon-offset layers so
    // nothing z-fights as the camera moves.
    const matPlaza = new THREE.MeshStandardMaterial({ color: 0x9c8f79, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const matPlazaDisc = new THREE.MeshStandardMaterial({ color: 0xb0a184, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const matCompass = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.3, metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });

    const plaza = new THREE.Mesh(new THREE.BoxGeometry(2 * BANDHALF, 2.8, 2 * BANDHALF), matPlaza);
    plaza.position.y = WALL_TOP + 0.5;   // top ~101.9, clear of the walkway below
    plaza.receiveShadow = true;
    groupWall.add(plaza);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 0.8, 40), matPlazaDisc);
    disc.position.y = WALL_TOP + 1.7;    // top ~102.1
    disc.receiveShadow = true;
    groupWall.add(disc);

    const ring = new THREE.Mesh(new THREE.RingGeometry(29, 33, 48), matCompass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = WALL_TOP + 2.2;
    groupWall.add(ring);
    for (let d = 0; d < 8; d++) {
        const a = (d / 8) * Math.PI * 2;
        // Spokes stop short of the ring's inner radius (29) so no two gold pieces overlap.
        const len = (d % 2) ? 11 : 20;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, len), matCompass);
        spoke.position.set(Math.sin(a) * (len / 2 + 3), WALL_TOP + 2.2, Math.cos(a) * (len / 2 + 3));
        spoke.rotation.y = a;
        groupWall.add(spoke);
    }

    // Crenellations along the eight arm flanks (gaps left for the crossing & gates).
    parapetRun('x', -PARAPET, ARM_INNER, ARM_OUTER, -1);   // east arm, north flank
    parapetRun('x', PARAPET, ARM_INNER, ARM_OUTER, 1);     // east arm, south flank
    parapetRun('x', -PARAPET, -ARM_OUTER, -ARM_INNER, -1); // west arm, north flank
    parapetRun('x', PARAPET, -ARM_OUTER, -ARM_INNER, 1);   // west arm, south flank
    parapetRun('z', PARAPET, ARM_INNER, ARM_OUTER, 1);     // south arm, east flank
    parapetRun('z', -PARAPET, ARM_INNER, ARM_OUTER, -1);   // south arm, west flank
    parapetRun('z', PARAPET, -ARM_OUTER, -ARM_INNER, 1);   // north arm, east flank
    parapetRun('z', -PARAPET, -ARM_OUTER, -ARM_INNER, -1); // north arm, west flank

    buildBastion(1, 1);
    buildBastion(1, -1);
    buildBastion(-1, 1);
    buildBastion(-1, -1);

    // Gate towers cap the four arms, each flying its army's banner.
    buildGateTower('U', 'E');
    buildGateTower('R', 'W');
    buildGateTower('W', 'S');
    buildGateTower('B', 'N');

    // Walls fade onward past each gate.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cont = new THREE.Mesh(
            dx ? new THREE.BoxGeometry(420, WALL_TOP * 0.92, WALL_DEPTH * 0.8) : new THREE.BoxGeometry(WALL_DEPTH * 0.8, WALL_TOP * 0.92, 420),
            matBrickDark);
        cont.position.set(dx * (TOWER_D + 250), WALL_TOP * 0.40, dz * (TOWER_D + 250));
        cont.rotation.y = (dx ? dx : dz) * 0.14;
        groupWall.add(cont);
    }
}

// Built in a local frame facing -x (toward centre), then placed & rotated per arm.
function buildGateTower(color, arm) {
    const tower = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(104, 165, 168), matBrick);
    base.position.y = 82.5; base.castShadow = true; base.receiveShadow = true;
    tower.add(base);

    const gate = new THREE.Mesh(new THREE.BoxGeometry(8, 34, 26), new THREE.MeshBasicMaterial({ color: 0x140e08 }));
    gate.position.set(-50, WALL_TOP + 16, 0);
    tower.add(gate);

    const top = new THREE.Mesh(new THREE.BoxGeometry(112, 6, 176), matBrickDark);
    top.position.y = 168; top.castShadow = true;
    tower.add(top);
    for (let side = -1; side <= 1; side += 2) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(112, 7, 4), matBrick);
        rail.position.set(0, 174, side * 84); tower.add(rail);
        const railX = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 168), matBrick);
        railX.position.set(side * 54, 174, 0); tower.add(railX);
    }

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(64, 30, 110), matBrick);
    cabin.position.y = 186; cabin.castShadow = true;
    tower.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(74, 30, 4), matRoof);
    roof.position.y = 216; roof.rotation.y = Math.PI / 4; roof.scale.z = 1.45; roof.castShadow = true;
    tower.add(roof);

    // Army banner on a pole atop the cabin.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 6), matTrunk);
    pole.position.set(0, 250, 40);
    tower.add(pole);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(30, 20),
        new THREE.MeshStandardMaterial({ color: PBANNER[color], side: THREE.DoubleSide, roughness: 0.7 }));
    banner.position.set(0, 260, 55);
    banner.userData.isFlag = true;
    tower.add(banner);
    flags.push(banner);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), matGoldTrim);
    finial.position.set(0, 281, 40);
    tower.add(finial);

    const place = gateTowerTransform(arm);
    tower.position.set(place.x, 0, place.z);
    tower.rotation.y = place.rot;
    tower.userData.arm = arm;
    groupWall.add(tower);
}

function gateTowerTransform(arm) {
    if (arm === 'E') return { x: TOWER_D, z: 0, rot: 0 };
    if (arm === 'W') return { x: -TOWER_D, z: 0, rot: Math.PI };
    if (arm === 'S') return { x: 0, z: TOWER_D, rot: -Math.PI / 2 };
    return { x: 0, z: -TOWER_D, rot: Math.PI / 2 }; // N
}

// ============================================
// BOARD FIELDS
// ============================================
function build3DBoard() {
    slabMeshes.clear();
    while (groupSlabs.children.length > 0) groupSlabs.remove(groupSlabs.children[0]);
    // Brazier flames live only on the field slabs — rebuild them fresh. Tower
    // banners live in `flags` and persist (buildWall runs once, never rebuilt).
    flames = [];

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (!onBoard3(r, c)) continue;
            const { x, y, z } = cellTo3D(r, c);
            const key = r + ',' + c;
            const legendary = window.isLegendary ? window.isLegendary(r, c) : false;
            // Crossing cells are covered by the solid plaza, so their slab is an
            // invisible click-target only — no visible surface to fight the plaza.
            const lo = window.GW_ARM_LO, hi = window.GW_ARM_HI;
            const isCenter = (r >= lo && r <= hi && c >= lo && c <= hi);

            const slab = new THREE.Mesh(
                new THREE.BoxGeometry(CELL - 2.5, 1.6, CELL - 2.5),
                legendary ? matGoldTrim : isCenter ? matFacingHit : ((r + c) % 2 ? matSlab : matSlabDark));
            slab.position.set(x, y + 0.8, z);
            slab.receiveShadow = !isCenter;
            slab.userData = { cell: { r: r, c: c } };
            groupSlabs.add(slab);
            slabMeshes.set(key, slab);

            if (legendary) {
                const owner = window.legendaryOwner ? window.legendaryOwner(r, c) : null;
                const emblem = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.8, 24), matGoldTrim);
                emblem.position.set(x, y + 1.9, z);
                groupSlabs.add(emblem);

                // brazier just outside the supply field, toward the gate
                const outX = Math.sign(x) * (Math.abs(x) > Math.abs(z) ? 16 : 0);
                const outZ = Math.sign(z) * (Math.abs(z) >= Math.abs(x) ? 16 : 0);
                const stand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 7, 8), matBrickDark);
                stand.position.set(x + outX + (outZ ? 14 : 0), y + 3.5, z + outZ + (outX ? 14 : 0));
                groupSlabs.add(stand);
                const flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 7), matFlame);
                flame.position.set(stand.position.x, y + 11, stand.position.z);
                flame.userData = { owner: owner, baseY: y + 11 };
                groupSlabs.add(flame);
                flames.push(flame);
            }
        }
    }
    sync3DPieces();
}

// ============================================
// WARRIORS
// ============================================
function createWarriorMesh(color) {
    const group = new THREE.Group();
    const body = bodyMats[color] || bodyMats.W;
    const accent = accMats[color] || accMats.W;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 5.2, 10, 10), body);
    torso.position.y = 5; torso.castShadow = true; torso.receiveShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(2.9, 10, 8), body);
    head.position.set(0, 12, 0.6); head.castShadow = true;
    group.add(head);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 6), accent);
    knot.position.set(0, 14.6, 0.3);
    group.add(knot);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(9.4, 9.6, 1.4), accent);
    shield.position.set(0, 7, -5.0); shield.castShadow = true;
    shield.userData.isFacingPart = true;
    group.add(shield);

    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 13, 6), matTrunk);
    spear.rotation.x = Math.PI / 2; spear.position.set(2.6, 7.5, 4.5);
    spear.userData.isFacingPart = true;
    group.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), accent);
    tip.rotation.x = Math.PI / 2; tip.position.set(2.6, 7.5, 11.6);
    tip.userData.isFacingPart = true;
    group.add(tip);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 14, 5), matTrunk);
    pole.position.set(-2.8, 14, -3.6);
    pole.userData.isFacingPart = true;
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.6),
        new THREE.MeshStandardMaterial({ color: PBANNER[color], side: THREE.DoubleSide, roughness: 0.7 }));
    flag.rotation.y = Math.PI / 2; flag.position.set(-2.8, 18.4, -6.8);
    flag.userData.isFacingPart = true; flag.userData.isFlag = true;
    group.add(flag);
    flags.push(flag);

    return group;
}

function facingToRotation(f) { return Math.atan2(DIRS[f].dc, DIRS[f].dr); }

function sync3DPieces() {
    if (typeof window.getGWState !== 'function') return;
    const st = window.getGWState();
    const liveIds = new Set(st.warriors.map(w => w.id));

    warriorMeshes.forEach((mesh, id) => {
        if (!liveIds.has(id) && !mesh.userData.animatingRemoval) {
            removeFlagsOf(mesh);
            groupPieces.remove(mesh);
            warriorMeshes.delete(id);
        }
    });

    st.warriors.forEach(w => {
        let mesh = warriorMeshes.get(w.id);
        if (!mesh) {
            mesh = createWarriorMesh(w.color);
            mesh.userData.warriorId = w.id;
            mesh.userData.color = w.color;
            groupPieces.add(mesh);
            warriorMeshes.set(w.id, mesh);
        }
        if (!mesh.userData.animating && !mesh.userData.animatingRemoval) {
            const { x, y, z } = cellTo3D(w.r, w.c);
            mesh.position.set(x, y + 1.6, z);
            const hideFacing = st.hiddenFacing && w.color !== st.turn && !st.gameOver;
            mesh.rotation.y = hideFacing ? Math.PI : facingToRotation(w.facing);
            mesh.children.forEach(ch => { if (ch.userData.isFacingPart) ch.visible = !hideFacing; });
        }
    });

    syncReserves(st);
    needsRender = true;
}

function removeFlagsOf(mesh) {
    mesh.children.forEach(ch => {
        if (ch.userData.isFlag) {
            const i = flags.indexOf(ch);
            if (i >= 0) flags.splice(i, 1);
        }
    });
}

// Kneeling reserves wait on each army's gate tower.
function syncReserves(st) {
    while (groupReserves.children.length > 0) {
        removeFlagsOf(groupReserves.children[0]);
        groupReserves.remove(groupReserves.children[0]);
    }
    const seat = { W: 'S', R: 'W', B: 'N', U: 'E' };
    (st.players || ['W', 'R', 'B', 'U']).forEach(color => {
        const t = gateTowerTransform(seat[color]);
        const n = st.reserve[color];
        // inward unit vector (toward centre)
        const inward = { x: -Math.sign(t.x), z: -Math.sign(t.z) };
        // lateral axis
        const lat = t.x !== 0 ? { x: 0, z: 1 } : { x: 1, z: 0 };
        for (let i = 0; i < n; i++) {
            const k = createWarriorMesh(color);
            const row = Math.floor(i / 5), col = (i % 5) - 2;
            k.scale.set(0.72, 0.5, 0.72);
            const bx = t.x + inward.x * (-22 + row * 26) + lat.x * col * 15;
            const bz = t.z + inward.z * (-22 + row * 26) + lat.z * col * 15;
            k.position.set(bx, 171, bz);
            k.rotation.y = Math.atan2(inward.x, inward.z);
            groupReserves.add(k);
        }
    });
}

// ============================================
// HIGHLIGHTS
// ============================================
function ringAt(r, c, mat, inner, outer) {
    const { x, y, z } = cellTo3D(r, c);
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner || 7, outer || 9, 24), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 2.3, z);
    groupHighlights.add(ring);
}

function arcOverlay(w) {
    const guard = back3(w.facing);
    for (let d = 0; d < 8; d++) {
        const r = w.r + DIRS[d].dr, c = w.c + DIRS[d].dc;
        if (!onBoard3(r, c)) continue;
        const { x, y, z } = cellTo3D(r, c);
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 5, CELL - 5), guard.has(d) ? matArcShield : matArcVuln);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, y + 2.2, z);
        groupHighlights.add(tile);
    }
}

function makeFacingArrowMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 4.2);
    shape.lineTo(-3.0, -1.6); shape.lineTo(-1.1, -1.6); shape.lineTo(-1.1, -4.0);
    shape.lineTo(1.1, -4.0); shape.lineTo(1.1, -1.6); shape.lineTo(3.0, -1.6);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), matFacingArrow);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

function buildFacingArrows(st) {
    const fs = st.facingSelect;
    const center = cellTo3D(fs.r, fs.c);
    for (let d = 0; d < 8; d++) {
        const holder = new THREE.Group();
        const arrow = makeFacingArrowMesh();
        arrow.position.y = 2.6; holder.add(arrow);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL - 6, 6, CELL - 6), matFacingHit);
        pad.position.y = 3; holder.add(pad);
        holder.position.set(center.x + DIRS[d].dc * CELL, center.y, center.z + DIRS[d].dr * CELL);
        holder.rotation.y = Math.atan2(-DIRS[d].dc, -DIRS[d].dr);
        holder.userData = { facingDir: d };
        groupFacing.add(holder);
    }
    if (fs.ghostColor) {
        const ghost = createWarriorMesh(fs.ghostColor);
        removeFlagsOf(ghost);
        ghost.traverse(o => {
            if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.castShadow = false; }
        });
        ghost.position.set(center.x, center.y + 1.6, center.z);
        ghost.rotation.y = facingToRotation(0);
        groupFacing.add(ghost);
    }
}

function update3DViews() {
    while (groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);
    while (groupFacing.children.length > 0) groupFacing.remove(groupFacing.children[0]);
    if (typeof window.getGWState !== 'function') { needsRender = true; return; }
    const st = window.getGWState();
    if (st.gameOver || st.busy) { needsRender = true; return; }

    if (st.facingSelect) {
        ringAt(st.facingSelect.r, st.facingSelect.c, matHLSelect, 8, 10);
        buildFacingArrows(st);
        needsRender = true;
        return;
    }

    if (st.mode === 'place') {
        window.validPlacements(st.turn).forEach(key => {
            const p = key.split(','); ringAt(Number(p[0]), Number(p[1]), matHLPlace);
        });
        st.lastChain.forEach(node => {
            const w = window.warriorAt(node.r, node.c);
            if (w) ringAt(node.r, node.c, matHLChain, 8.5, 10);
        });
    }
    if (st.mode === 'move') {
        if (st.selectedWarrior) {
            ringAt(st.selectedWarrior.r, st.selectedWarrior.c, matHLSelect, 8, 10);
            window.validMoves(st.selectedWarrior).forEach(m => ringAt(m.r, m.c, matHLMove));
            arcOverlay(st.selectedWarrior);
        } else {
            st.warriors.forEach(w => { if (w.color === st.turn) ringAt(w.r, w.c, matHLSelect, 8, 9.5); });
        }
    }
    if (st.mode === 'shoot' || st.mode === 'spin') {
        st.warriors.forEach(w => { if (w.color === st.turn) ringAt(w.r, w.c, matHLSelect, 8, 9.5); });
    }
    if (st.previewWarriorId) {
        const w = st.warriors.find(x => x.id === st.previewWarriorId);
        if (w) arcOverlay(w);
    }
    needsRender = true;
}

// ============================================
// ANIMATIONS
// ============================================
function animate3DPlace(w, onComplete) {
    sync3DPieces();
    const mesh = warriorMeshes.get(w.id);
    if (!mesh) { if (onComplete) onComplete(); return; }
    mesh.userData.animating = true;
    const { x, y, z } = cellTo3D(w.r, w.c);
    mesh.position.set(x, y + 60, z);
    mesh.rotation.y = facingToRotation(w.facing);
    new TWEEN.Tween(mesh.position).to({ y: y + 1.6 }, 420).easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
            dustBurst(x, y + 2, z, 6, matDebrisLight);
            mesh.userData.animating = false;
            if (onComplete) onComplete();
            needsRender = true;
        }).start();
    needsRender = true;
}

function animate3DWalk(w, fromR, fromC, onComplete) {
    const mesh = warriorMeshes.get(w.id);
    if (!mesh) { if (onComplete) onComplete(); return; }
    mesh.userData.animating = true;
    const from = cellTo3D(fromR, fromC), to = cellTo3D(w.r, w.c);
    mesh.position.set(from.x, from.y + 1.6, from.z);
    new TWEEN.Tween(mesh.position).to({ x: to.x, z: to.z }, 480).easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            rotateMeshTo(mesh, facingToRotation(w.facing), 220, () => {
                mesh.userData.animating = false;
                if (onComplete) onComplete();
            });
        }).start();
    needsRender = true;
}

function animate3DRotate(w, onComplete) {
    const mesh = warriorMeshes.get(w.id);
    if (!mesh) { if (onComplete) onComplete(); return; }
    mesh.userData.animating = true;
    rotateMeshTo(mesh, facingToRotation(w.facing), 260, () => {
        mesh.userData.animating = false;
        if (onComplete) onComplete();
    });
}

function rotateMeshTo(mesh, target, ms, cb) {
    let from = mesh.rotation.y, delta = target - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    new TWEEN.Tween({ t: 0 }).to({ t: 1 }, ms).easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(o => { mesh.rotation.y = from + delta * o.t; needsRender = true; })
        .onComplete(() => { if (cb) cb(); needsRender = true; }).start();
}

function animate3DArrow(path, marks, onComplete) {
    if (!path || path.length < 2) { if (onComplete) onComplete(); return; }
    const markByIdx = new Map();
    (marks || []).forEach(m => markByIdx.set(m.idx, m));
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 6), matArrow);
    arrow.rotation.x = Math.PI / 2;
    const start = cellTo3D(path[0].r, path[0].c);
    arrow.position.set(start.x, start.y + 9, start.z);
    groupFX.add(arrow);
    let i = 1;
    function step() {
        if (i >= path.length) { finish(); return; }
        const p = path[i], to = cellTo3D(p.r, p.c), from = arrow.position.clone();
        arrow.rotation.z = 0; arrow.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        new TWEEN.Tween(arrow.position).to({ x: to.x, z: to.z }, 72).onComplete(() => {
            const mark = markByIdx.get(i);
            if (mark) {
                if (mark.type === 'reflect' || mark.type === 'deflect') flashRing(to.x, start.y + 6, to.z, 0x6fb7ff);
                else if (mark.type === 'kill') flashRing(to.x, start.y + 6, to.z, 0xff4433);
            }
            i++; step();
        }).start();
        needsRender = true;
    }
    function finish() { groupFX.remove(arrow); needsRender = true; if (onComplete) onComplete(); }
    step();
}

function animate3DSpin(att, onComplete) {
    const mesh = warriorMeshes.get(att.id);
    const { x, y, z } = cellTo3D(att.r, att.c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 1.0, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 7, z);
    groupFX.add(ring);
    new TWEEN.Tween(ring.scale).to({ x: 4.2, y: 4.2, z: 4.2 }, 420).easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { groupFX.remove(ring); needsRender = true; }).start();
    if (mesh) {
        mesh.userData.animating = true;
        new TWEEN.Tween({ t: 0 }).to({ t: 1 }, 440)
            .onUpdate(() => { mesh.rotation.y += 0.32; needsRender = true; })
            .onComplete(() => { mesh.userData.animating = false; if (onComplete) onComplete(); }).start();
    } else setTimeout(onComplete, 440);
    needsRender = true;
}

function animate3DKills(fallen, onComplete) {
    let remaining = fallen.length;
    if (!remaining) { if (onComplete) onComplete(); return; }
    fallen.forEach(w => {
        const mesh = warriorMeshes.get(w.id);
        if (!mesh) { if (--remaining === 0 && onComplete) onComplete(); return; }
        mesh.userData.animatingRemoval = true;
        const { x, y, z } = cellTo3D(w.r, w.c);
        dustBurst(x, y + 4, z, 9, matDebrisDark);
        new TWEEN.Tween(mesh.scale).to({ x: 0.06, y: 0.06, z: 0.06 }, 520).easing(TWEEN.Easing.Quadratic.In)
            .onComplete(() => {
                removeFlagsOf(mesh); groupPieces.remove(mesh); warriorMeshes.delete(w.id);
                needsRender = true;
                if (--remaining === 0 && onComplete) onComplete();
            }).start();
        new TWEEN.Tween(mesh.rotation).to({ z: 1.2 }, 520).start();
    });
    needsRender = true;
}

function dustBurst(x, y, z, count, mat) {
    for (let i = 0; i < count; i++) {
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.6 + Math.random() * 1.6, 1.3 + Math.random(), 1.6 + Math.random() * 1.6), mat);
        chunk.position.set(x, y, z);
        groupFX.add(chunk);
        const ang = Math.random() * Math.PI * 2, dist = 6 + Math.random() * 9;
        new TWEEN.Tween(chunk.position).to({ x: x + Math.cos(ang) * dist, y: y + 3 + Math.random() * 5, z: z + Math.sin(ang) * dist }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .chain(new TWEEN.Tween(chunk.position).to({ y: y - 1 }, 260).easing(TWEEN.Easing.Quadratic.In)
                .onComplete(() => { groupFX.remove(chunk); needsRender = true; })).start();
    }
}

function flashRing(x, y, z, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.8, 6, 20), new THREE.MeshBasicMaterial({ color: color }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z);
    groupFX.add(ring);
    new TWEEN.Tween(ring.scale).to({ x: 2.6, y: 2.6, z: 2.6 }, 280).easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { groupFX.remove(ring); needsRender = true; }).start();
}

function trigger3DVictory(color) {
    flames.forEach(f => {
        if (f.userData.owner === color) new TWEEN.Tween(f.scale).to({ x: 2.6, y: 3.4, z: 2.6 }, 900).easing(TWEEN.Easing.Elastic.Out).start();
        else new TWEEN.Tween(f.scale).to({ x: 0.05, y: 0.05, z: 0.05 }, 700).start();
    });
    needsRender = true;
}

// ============================================
// INTERACTION
// ============================================
function onPointerDown(event) {
    if (!window.is3DView) return;
    const st = window.getGWState ? window.getGWState() : null;
    if (!st || st.busy || st.gameOver) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (st.facingSelect) {
        const arrowHits = raycaster.intersectObjects(groupFacing.children, true);
        if (arrowHits.length) {
            let a = arrowHits[0].object;
            while (a && a.userData.facingDir === undefined && a.parent) a = a.parent;
            if (a && a.userData.facingDir !== undefined) { window.chooseFacingDir(a.userData.facingDir); return; }
        }
    }

    const intersects = raycaster.intersectObjects([...groupPieces.children, ...groupSlabs.children], true);
    if (!intersects.length) {
        if (st.facingSelect && typeof window.onCellClick === 'function') window.onCellClick(-9, -9);
        return;
    }
    let obj = intersects[0].object;
    while (obj && obj.userData.warriorId === undefined && !obj.userData.cell && obj.parent) obj = obj.parent;
    if (obj && obj.userData.warriorId !== undefined) {
        const w = st.warriors.find(x => x.id === obj.userData.warriorId);
        if (w && typeof window.onWarriorClick === 'function') window.onWarriorClick(w);
    } else if (obj && obj.userData.cell) {
        if (typeof window.onCellClick === 'function') window.onCellClick(obj.userData.cell.r, obj.userData.cell.c);
    }
}

// ============================================
// LOOP
// ============================================
function animate3D(time) {
    clockT = time * 0.001;
    TWEEN.update(time);
    controls.update();

    flames.forEach((f, i) => {
        f.position.y = f.userData.baseY + Math.sin(clockT * 11 + i * 2.4) * 0.7;
        const s = 1 + Math.sin(clockT * 13 + i) * 0.12;
        if (!f.userData.victoryLocked) { f.scale.x = s; f.scale.z = s; }
    });
    const wind = Math.sin(clockT * 2.2) * 0.18;
    flags.forEach((fl, i) => { fl.rotation.x = wind + Math.sin(clockT * 3 + i) * 0.06; });
    if (groupFacing.children.length) matFacingArrow.opacity = 0.7 + Math.sin(clockT * 4.5) * 0.25;
    groupBirds.children.forEach(b => {
        b.userData.angle += b.userData.speed;
        b.position.set(Math.cos(b.userData.angle) * b.userData.radius, b.userData.height, Math.sin(b.userData.angle) * b.userData.radius);
        b.rotation.y = -b.userData.angle;
    });

    renderer.render(scene, camera);
    needsRender = false;
}

// ============================================
// EXPORTS
// ============================================
window.init3DSystem = init3D;
window.rebuild3DBoard = function () {
    while (groupFX.children.length > 0) groupFX.remove(groupFX.children[0]);
    warriorMeshes.forEach(m => { removeFlagsOf(m); groupPieces.remove(m); });
    warriorMeshes.clear();
    // reset brazier flames (rebuilt in build3DBoard)
    build3DBoard();
    update3DViews();
};
window.sync3D = sync3DPieces;
window.update3DViews = update3DViews;
window.animate3DPlace = animate3DPlace;
window.animate3DWalk = animate3DWalk;
window.animate3DRotate = animate3DRotate;
window.animate3DArrow = animate3DArrow;
window.animate3DSpin = animate3DSpin;
window.animate3DKills = animate3DKills;
window.trigger3DVictory = trigger3DVictory;

document.addEventListener('DOMContentLoaded', () => init3D());
