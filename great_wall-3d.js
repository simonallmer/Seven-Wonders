// ============================================
// GREAT WALL GAME 3D VIEW
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;
let clockT = 0;

// Groups
const groupEnvironment = new THREE.Group();
const groupWall = new THREE.Group();
const groupSlabs = new THREE.Group();
const groupPieces = new THREE.Group();
const groupReserves = new THREE.Group();
const groupHighlights = new THREE.Group();
const groupFacing = new THREE.Group(); // in-world facing arrows (click targets)
const groupFX = new THREE.Group();
const groupBirds = new THREE.Group();

// Maps
const warriorMeshes = new Map(); // id -> THREE.Group
const slabMeshes = new Map();    // "r,c" -> mesh
let flames = [];                 // brazier flames for flicker
let flags = [];                  // banner planes for wind sway

// Layout
const CELL = 24;
const WALL_TOP = 100;
function cellTo3D(r, c) {
    return { x: (c - (GW_COLS - 1) / 2) * CELL, y: WALL_TOP, z: (r - (GW_ROWS - 1) / 2) * CELL };
}

// Materials — golden-hour stone, two armies: jade limestone vs vermilion basalt
const matBrick = new THREE.MeshStandardMaterial({ color: 0xcc3b22, roughness: 0.85, metalness: 0.03 });
const matBrickDark = new THREE.MeshStandardMaterial({ color: 0x992d1a, roughness: 0.85, metalness: 0.03 });
const matSlab = new THREE.MeshStandardMaterial({ color: 0xcfc2a4, roughness: 0.85, metalness: 0.05 });
const matSlabDark = new THREE.MeshStandardMaterial({ color: 0xc2b393, roughness: 0.85, metalness: 0.05 });
const matRock = new THREE.MeshStandardMaterial({ color: 0x6e6052, roughness: 1.0 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x46603a, roughness: 1.0 });
const matPine = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 0.95 });
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
const matMountain = new THREE.MeshStandardMaterial({ color: 0x7a8694, roughness: 1.0 });
const matMountainFar = new THREE.MeshStandardMaterial({ color: 0x97a2b0, roughness: 1.0 });
const matGoldTrim = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.3, metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.15 });
const matFlame = new THREE.MeshBasicMaterial({ color: 0xff9d3c });
const matEmber = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 });

const matWhiteBody = new THREE.MeshStandardMaterial({ color: 0xe9e1cd, roughness: 0.8, metalness: 0.05 });
const matWhiteAccent = new THREE.MeshStandardMaterial({ color: 0x2fa088, roughness: 0.5, metalness: 0.2, emissive: 0x0a2e26, emissiveIntensity: 0.25 });
const matBlackBody = new THREE.MeshStandardMaterial({ color: 0x3a332b, roughness: 0.8, metalness: 0.08 });
const matBlackAccent = new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.5, metalness: 0.2, emissive: 0x2e0a06, emissiveIntensity: 0.25 });

// depthTest stays ON so the wall/towers correctly occlude highlights behind them
// (no seeing through the building). Rings float just above the slab and are annuli
// around the cell, so they read clearly without depthTest disabled.
const matHLPlace = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, depthWrite: false });
const matHLMove = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, depthWrite: false });
const matHLSelect = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75, depthWrite: false });
const matHLChain = new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0.55, depthWrite: false });
const matArcShield = new THREE.MeshBasicMaterial({ color: 0x2a6db0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const matArcVuln = new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const matArrow = new THREE.MeshBasicMaterial({ color: 0xff5533 });
const matFacingArrow = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
// Transparent (not invisible) so it stays an easy raycast click target — visible:false meshes are skipped by the raycaster.
const matFacingHit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const matDebrisLight = new THREE.MeshStandardMaterial({ color: 0xd9d0b8, roughness: 0.9 });
const matDebrisDark = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.9 });

// ============================================
// INIT
// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfde0ad); // series golden hour
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.00052);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(0, 430, 600);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 180;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enablePan = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.target.set(0, WALL_TOP, 0);
    controls.update();
    controls.addEventListener('change', () => { needsRender = true; });

    // Lighting — low warm sun raking ACROSS the wall so warriors throw long shadows
    const hemiLight = new THREE.HemisphereLight(0xfff2e0, 0x4a5d23, 0.62);
    hemiLight.position.set(0, 500, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffd9a0, 1.3);
    dirLight.position.set(260, 320, 520);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 700;
    dirLight.shadow.camera.bottom = -700;
    dirLight.shadow.camera.left = -700;
    dirLight.shadow.camera.right = 700;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 3000;
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
    
    let __pointerDownPos_greatwalldjs = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
        __pointerDownPos_greatwalldjs.x = e.clientX;
        __pointerDownPos_greatwalldjs.y = e.clientY;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __pointerDownPos_greatwalldjs.x;
        const dy = e.clientY - __pointerDownPos_greatwalldjs.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            onPointerDown(e);
        }
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
// ENVIRONMENT — misty peaks, pines, the endless wall
// ============================================
function buildEnvironment() {
    // Valley floor
    const ground = new THREE.Mesh(new THREE.CircleGeometry(7000, 48), matGround);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -170;
    ground.receiveShadow = true;
    groupEnvironment.add(ground);

    // The ridge the wall rides on — wide enough to carry the towers and the wall's
    // continuation blocks so nothing floats over the valley.
    const RIDGE_W = 1750;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(RIDGE_W, 180, 230), matRock);
    ridge.position.set(0, -90, 0);
    ridge.receiveShadow = true;
    groupEnvironment.add(ridge);
    const ridgeSlopeN = new THREE.Mesh(new THREE.BoxGeometry(RIDGE_W, 180, 160), matRock);
    ridgeSlopeN.position.set(0, -110, -160);
    ridgeSlopeN.rotation.x = 0.5;
    groupEnvironment.add(ridgeSlopeN);
    const ridgeSlopeS = new THREE.Mesh(new THREE.BoxGeometry(RIDGE_W, 180, 160), matRock);
    ridgeSlopeS.position.set(0, -110, 160);
    ridgeSlopeS.rotation.x = -0.5;
    groupEnvironment.add(ridgeSlopeS);

    // Layered mountains
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 2400 + Math.random() * 1800;
        const h = 500 + Math.random() * 900;
        const m = new THREE.Mesh(new THREE.ConeGeometry(600 + Math.random() * 500, h, 7), i % 2 ? matMountain : matMountainFar);
        m.position.set(Math.cos(angle) * dist, -170 + h / 2, Math.sin(angle) * dist);
        groupEnvironment.add(m);
    }
    // Nearer green ridges
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1000 + Math.random() * 900;
        const h = 250 + Math.random() * 350;
        const m = new THREE.Mesh(new THREE.ConeGeometry(380 + Math.random() * 250, h, 6),
            new THREE.MeshStandardMaterial({ color: 0x3e5544, roughness: 1.0 }));
        m.position.set(Math.cos(angle) * dist, -170 + h / 2, Math.sin(angle) * dist);
        groupEnvironment.add(m);
    }

    // Pine clusters on the slopes
    for (let i = 0; i < 60; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = (Math.random() - 0.5) * 1500;
        const z = side * (220 + Math.random() * 600);
        const s = 0.7 + Math.random() * 0.9;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 12, 5), matTrunk);
        trunk.position.y = 6;
        tree.add(trunk);
        for (let t = 0; t < 3; t++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(10 - t * 2.4, 14, 7), matPine);
            cone.position.y = 14 + t * 8;
            cone.castShadow = true;
            tree.add(cone);
        }
        tree.scale.set(s, s, s);
        tree.position.set(x, -168, z);
        groupEnvironment.add(tree);
    }

    // Circling kestrels
    for (let i = 0; i < 4; i++) {
        const bird = new THREE.Group();
        const wingL = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ color: 0x4a3f33, side: THREE.DoubleSide }));
        wingL.position.x = -4; wingL.rotation.z = 0.25;
        const wingR = wingL.clone(); wingR.position.x = 4; wingR.rotation.z = -0.25;
        bird.add(wingL); bird.add(wingR);
        bird.userData = {
            angle: Math.random() * Math.PI * 2,
            radius: 420 + Math.random() * 420,
            height: 260 + Math.random() * 160,
            speed: 0.0018 + Math.random() * 0.0014
        };
        groupBirds.add(bird);
    }
}

// ============================================
// THE WALL — body, parapets, towers, fields
// ============================================
function buildWall() {
    const playLen = GW_COLS * CELL;          // 360
    const wallLen = playLen + 36;
    const wallDepth = GW_ROWS * CELL + 38;   // walkway + parapet ledges

    // Wall body
    const body = new THREE.Mesh(new THREE.BoxGeometry(wallLen, WALL_TOP, wallDepth), matBrick);
    body.position.y = WALL_TOP / 2;
    body.receiveShadow = true;
    body.castShadow = true;
    groupWall.add(body);

    // Brick striping (subtle horizontal bands)
    for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(wallLen + 1.5, 2.2, wallDepth + 1.5), matBrickDark);
        band.position.y = 18 + i * 22;
        groupWall.add(band);
    }

    // Walkway surface (offset up 0.5 to avoid z-fighting with wall body top)
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 2, wallDepth), matBrickDark);
    walkway.position.y = WALL_TOP + 0.5;
    walkway.receiveShadow = true;
    groupWall.add(walkway);

    // Parapets with crenellations on BOTH sides (the real Wall's signature)
    const parapetZ = wallDepth / 2 - 6;
    for (let side = -1; side <= 1; side += 2) {
        const low = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 7, 5), matBrick);
        low.position.set(0, WALL_TOP + 3.6, side * parapetZ);
        low.castShadow = true;
        groupWall.add(low);
        const merlonCount = Math.floor(wallLen / 17);
        for (let i = 0; i < merlonCount; i++) {
            const mx = -wallLen / 2 + 8 + i * 17;
            const merlon = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 5), matBrick);
            merlon.position.set(mx, WALL_TOP + 11, side * parapetZ);
            merlon.castShadow = true;
            groupWall.add(merlon);
        }
    }

    // Watchtowers at each end
    buildTower(-(wallLen / 2 + 52), 'B');
    buildTower(wallLen / 2 + 52, 'W');

    // Wall fades onward beyond the towers
    for (let side = -1; side <= 1; side += 2) {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(420, WALL_TOP * 0.92, wallDepth * 0.8), matBrickDark);
        cont.position.set(side * (wallLen / 2 + 100 + 260), WALL_TOP * 0.40, -30);
        cont.rotation.y = side * 0.16;
        groupWall.add(cont);
    }
}

function buildTower(x, color) {
    const tower = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(104, 165, 168), matBrick);
    base.position.y = 82.5;
    base.castShadow = true;
    base.receiveShadow = true;
    tower.add(base);

    // Gate arch facing the walkway (dark recess)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(8, 34, 26),
        new THREE.MeshBasicMaterial({ color: 0x140e08 }));
    gate.position.set(x > 0 ? -50 : 50, WALL_TOP + 16, 0);
    tower.add(gate);

    // Tower top platform + parapet
    const top = new THREE.Mesh(new THREE.BoxGeometry(112, 6, 176), matBrickDark);
    top.position.y = 168;
    top.castShadow = true;
    tower.add(top);
    for (let side = -1; side <= 1; side += 2) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(112, 7, 4), matBrick);
        rail.position.set(0, 174, side * 84);
        tower.add(rail);
        const railX = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 168), matBrick);
        railX.position.set(side * 54, 174, 0);
        tower.add(railX);
    }

    // Pagoda roof over a small cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(64, 30, 110), matBrick);
    cabin.position.y = 186;
    cabin.castShadow = true;
    tower.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(74, 30, 4), new THREE.MeshStandardMaterial({ color: 0x6e4a36, roughness: 0.9 }));
    roof.position.y = 216;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 1.45;
    roof.castShadow = true;
    tower.add(roof);

    tower.position.x = x;
    groupWall.add(tower);
}

// ============================================
// BOARD FIELDS
// ============================================
function build3DBoard() {
    slabMeshes.clear();
    while (groupSlabs.children.length > 0) groupSlabs.remove(groupSlabs.children[0]);
    flames = [];

    for (let r = 0; r < GW_ROWS; r++) {
        for (let c = 0; c < GW_COLS; c++) {
            const { x, y, z } = cellTo3D(r, c);
            const key = r + ',' + c;
            const legendary = isLegendary(r, c);

            const slab = new THREE.Mesh(
                new THREE.BoxGeometry(CELL - 2.5, 1.6, CELL - 2.5),
                legendary ? matGoldTrim : ((r + c) % 2 ? matSlab : matSlabDark)
            );
            slab.position.set(x, y + 0.8, z);
            slab.receiveShadow = true;
            slab.userData = { cell: { r: r, c: c } };
            groupSlabs.add(slab);
            slabMeshes.set(key, slab);

            if (legendary) {
                // Carved emblem disc + brazier flame
                const emblem = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.8, 24), matGoldTrim);
                emblem.position.set(x, y + 1.9, z);
                groupSlabs.add(emblem);

                const brazierZ = z + (r === 2 ? (CELL * 1.9) : 0); // braziers stand off the playfield
                const stand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 7, 8), matBrickDark);
                stand.position.set(x + (c === 0 ? -14 : 14), y + 3.5, brazierZ - CELL * 1.9 + (CELL * GW_ROWS) / 2 + 8);
                // place brazier just behind the parapet at this end
                stand.position.z = 0;
                stand.position.x = x + (c === 0 ? -16 : 16);
                groupSlabs.add(stand);
                const flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 7), matFlame);
                flame.position.set(stand.position.x, y + 11, stand.position.z);
                flame.userData = { owner: c === 0 ? 'B' : 'W', baseY: y + 11 };
                groupSlabs.add(flame);
                flames.push(flame);
            }
        }
    }
    sync3DPieces();
}

// ============================================
// WARRIORS — the Stone Garrison
// ============================================
function createWarriorMesh(color) {
    const group = new THREE.Group();
    const body = color === 'W' ? matWhiteBody : matBlackBody;
    const accent = color === 'W' ? matWhiteAccent : matBlackAccent;

    // Armored stone body
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 5.2, 10, 10), body);
    torso.position.y = 5;
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    // Head with topknot
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.9, 10, 8), body);
    head.position.set(0, 12, 0.6);
    head.castShadow = true;
    group.add(head);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 6), accent);
    knot.position.set(0, 14.6, 0.3);
    group.add(knot);

    // Broad shield strapped across the BACK — the shield arc made visible
    const shield = new THREE.Mesh(new THREE.BoxGeometry(9.4, 9.6, 1.4), accent);
    shield.position.set(0, 7, -5.0);
    shield.castShadow = true;
    shield.userData.isFacingPart = true;
    group.add(shield);

    // Spear held forward
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 13, 6), matTrunk);
    spear.rotation.x = Math.PI / 2;
    spear.position.set(2.6, 7.5, 4.5);
    spear.userData.isFacingPart = true;
    group.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), accent);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(2.6, 7.5, 11.6);
    tip.userData.isFacingPart = true;
    group.add(tip);

    // Back-banner: pole + flag, the long-range facing read
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 14, 5), matTrunk);
    pole.position.set(-2.8, 14, -3.6);
    pole.userData.isFacingPart = true;
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.6),
        new THREE.MeshStandardMaterial({ color: accent.color.getHex(), side: THREE.DoubleSide, roughness: 0.7 }));
    flag.rotation.y = Math.PI / 2;
    flag.position.set(-2.8, 18.4, -6.8);
    flag.userData.isFacingPart = true;
    flag.userData.isFlag = true;
    group.add(flag);
    flags.push(flag);

    return group;
}

function facingToRotation(f) {
    return Math.atan2(DIRS[f].dc, DIRS[f].dr);
}

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
            mesh.children.forEach(ch => {
                if (ch.userData.isFacingPart) ch.visible = !hideFacing;
            });
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

// Kneeling reserves on the tower tops
function syncReserves(st) {
    while (groupReserves.children.length > 0) {
        removeFlagsOf(groupReserves.children[0]);
        groupReserves.remove(groupReserves.children[0]);
    }
    const playLen = GW_COLS * CELL;
    [['B', -(playLen / 2 + 36 + 52)], ['W', playLen / 2 + 36 + 52]].forEach(([color, tx]) => {
        const n = st.reserve[color];
        for (let i = 0; i < n; i++) {
            const k = createWarriorMesh(color);
            const row = Math.floor(i / 5), col = i % 5;
            k.scale.set(0.72, 0.5, 0.72);
            k.position.set(tx - 30 + col * 15, 171, -52 + row * 28 + 60);
            k.rotation.y = color === 'B' ? Math.PI / 2 : -Math.PI / 2; // face along the wall
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
        if (r < 0 || r >= GW_ROWS || c < 0 || c >= GW_COLS) continue;
        const { x, y, z } = cellTo3D(r, c);
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 5, CELL - 5),
            guard.has(d) ? matArcShield : matArcVuln);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, y + 2.2, z);
        groupHighlights.add(tile);
    }
}

// Flat chevron pointing local -Z (north before rotation)
function makeFacingArrowMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 4.2);      // tip
    shape.lineTo(-3.0, -1.6);
    shape.lineTo(-1.1, -1.6);
    shape.lineTo(-1.1, -4.0);
    shape.lineTo(1.1, -4.0);
    shape.lineTo(1.1, -1.6);
    shape.lineTo(3.0, -1.6);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), matFacingArrow);
    mesh.rotation.x = -Math.PI / 2; // lie flat; shape +Y now points world -Z
    return mesh;
}

function buildFacingArrows(st) {
    const fs = st.facingSelect;
    const center = cellTo3D(fs.r, fs.c);

    for (let d = 0; d < 8; d++) {
        const holder = new THREE.Group();
        const arrow = makeFacingArrowMesh();
        arrow.position.y = 2.6;
        holder.add(arrow);
        // generous invisible click pad
        const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL - 6, 6, CELL - 6), matFacingHit);
        pad.position.y = 3;
        holder.add(pad);

        holder.position.set(center.x + DIRS[d].dc * CELL, center.y, center.z + DIRS[d].dr * CELL);
        // rotate so the chevron points outward in direction d
        holder.rotation.y = Math.atan2(-DIRS[d].dc, -DIRS[d].dr);
        holder.userData = { facingDir: d };
        groupFacing.add(holder);
    }

    // Ghost preview of the warrior on the chosen field
    if (fs.ghostColor) {
        const ghost = createWarriorMesh(fs.ghostColor);
        removeFlagsOf(ghost); // ghost banners don't join the wind system
        ghost.traverse(o => {
            if (o.isMesh) {
                o.material = o.material.clone();
                o.material.transparent = true;
                o.material.opacity = 0.42;
                o.castShadow = false;
            }
        });
        ghost.position.set(center.x, center.y + 1.6, center.z);
        ghost.rotation.y = facingToRotation(st.turn === 'W' ? 6 : 2); // glance toward the foe until chosen
        groupFacing.add(ghost);
    }
}

function update3DViews() {
    while (groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);
    while (groupFacing.children.length > 0) groupFacing.remove(groupFacing.children[0]);
    if (typeof window.getGWState !== 'function') { needsRender = true; return; }
    const st = window.getGWState();
    if (st.gameOver || st.busy) { needsRender = true; return; }

    // Facing selection replaces all other affordances: just the arrows, the ghost,
    // and a soft marker on the chosen field.
    if (st.facingSelect) {
        ringAt(st.facingSelect.r, st.facingSelect.c, matHLSelect, 8, 10);
        buildFacingArrows(st);
        needsRender = true;
        return;
    }

    if (st.mode === 'place') {
        window.validPlacements(st.turn).forEach(key => {
            const p = key.split(',');
            ringAt(Number(p[0]), Number(p[1]), matHLPlace);
        });
        // Supply chain glow
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
// ANIMATIONS (called by the game engine)
// ============================================
function animate3DPlace(w, onComplete) {
    sync3DPieces(); // creates the mesh at its cell
    const mesh = warriorMeshes.get(w.id);
    if (!mesh) { if (onComplete) onComplete(); return; }
    mesh.userData.animating = true;
    const { x, y, z } = cellTo3D(w.r, w.c);
    mesh.position.set(x, y + 60, z);
    mesh.rotation.y = facingToRotation(w.facing);
    new TWEEN.Tween(mesh.position)
        .to({ y: y + 1.6 }, 420)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
            dustBurst(x, y + 2, z, 6, w.color === 'W' ? matDebrisLight : matDebrisDark);
            mesh.userData.animating = false;
            if (onComplete) onComplete();
            needsRender = true;
        })
        .start();
    needsRender = true;
}

function animate3DWalk(w, fromR, fromC, onComplete) {
    const mesh = warriorMeshes.get(w.id);
    if (!mesh) { if (onComplete) onComplete(); return; }
    mesh.userData.animating = true;
    const from = cellTo3D(fromR, fromC);
    const to = cellTo3D(w.r, w.c);
    mesh.position.set(from.x, from.y + 1.6, from.z);
    new TWEEN.Tween(mesh.position)
        .to({ x: to.x, z: to.z }, 480)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            rotateMeshTo(mesh, facingToRotation(w.facing), 220, () => {
                mesh.userData.animating = false;
                if (onComplete) onComplete();
            });
        })
        .start();
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
    let from = mesh.rotation.y;
    let delta = target - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    new TWEEN.Tween({ t: 0 })
        .to({ t: 1 }, ms)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(o => { mesh.rotation.y = from + delta * o.t; needsRender = true; })
        .onComplete(() => { if (cb) cb(); needsRender = true; })
        .start();
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
        const p = path[i];
        const to = cellTo3D(p.r, p.c);
        const from = arrow.position.clone();
        const dx = to.x - from.x, dz = to.z - from.z;
        arrow.rotation.z = 0;
        arrow.rotation.y = Math.atan2(dx, dz);
        new TWEEN.Tween(arrow.position)
            .to({ x: to.x, z: to.z }, 72)
            .onComplete(() => {
                const mark = markByIdx.get(i);
                if (mark) {
                    if (mark.type === 'reflect' || mark.type === 'deflect') {
                        flashRing(to.x, start.y + 6, to.z, 0x6fb7ff);
                    } else if (mark.type === 'kill') {
                        flashRing(to.x, start.y + 6, to.z, 0xff4433);
                    }
                }
                i++;
                step();
            })
            .start();
        needsRender = true;
    }
    function finish() {
        groupFX.remove(arrow);
        needsRender = true;
        if (onComplete) onComplete();
    }
    step();
}

function animate3DSpin(att, onComplete) {
    const mesh = warriorMeshes.get(att.id);
    const { x, y, z } = cellTo3D(att.r, att.c);
    // expanding blade ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 1.0, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 7, z);
    groupFX.add(ring);
    new TWEEN.Tween(ring.scale)
        .to({ x: 4.2, y: 4.2, z: 4.2 }, 420)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { groupFX.remove(ring); needsRender = true; })
        .start();
    if (mesh) {
        mesh.userData.animating = true;
        new TWEEN.Tween({ t: 0 })
            .to({ t: 1 }, 440)
            .onUpdate(o => { mesh.rotation.y += 0.32; needsRender = true; })
            .onComplete(() => {
                mesh.userData.animating = false;
                if (onComplete) onComplete();
            })
            .start();
    } else {
        setTimeout(onComplete, 440);
    }
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
        dustBurst(x, y + 4, z, 9, w.color === 'W' ? matDebrisLight : matDebrisDark);
        new TWEEN.Tween(mesh.scale)
            .to({ x: 0.06, y: 0.06, z: 0.06 }, 520)
            .easing(TWEEN.Easing.Quadratic.In)
            .onComplete(() => {
                removeFlagsOf(mesh);
                groupPieces.remove(mesh);
                warriorMeshes.delete(w.id);
                needsRender = true;
                if (--remaining === 0 && onComplete) onComplete();
            })
            .start();
        new TWEEN.Tween(mesh.rotation).to({ z: 1.2 }, 520).start();
    });
    needsRender = true;
}

function dustBurst(x, y, z, count, mat) {
    for (let i = 0; i < count; i++) {
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.6 + Math.random() * 1.6, 1.3 + Math.random(), 1.6 + Math.random() * 1.6), mat);
        chunk.position.set(x, y, z);
        groupFX.add(chunk);
        const ang = Math.random() * Math.PI * 2;
        const dist = 6 + Math.random() * 9;
        new TWEEN.Tween(chunk.position)
            .to({ x: x + Math.cos(ang) * dist, y: y + 3 + Math.random() * 5, z: z + Math.sin(ang) * dist }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .chain(new TWEEN.Tween(chunk.position)
                .to({ y: y - 1 }, 260)
                .easing(TWEEN.Easing.Quadratic.In)
                .onComplete(() => { groupFX.remove(chunk); needsRender = true; }))
            .start();
    }
}

function flashRing(x, y, z, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.8, 6, 20), new THREE.MeshBasicMaterial({ color: color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    groupFX.add(ring);
    new TWEEN.Tween(ring.scale)
        .to({ x: 2.6, y: 2.6, z: 2.6 }, 280)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { groupFX.remove(ring); needsRender = true; })
        .start();
}

function trigger3DVictory(color) {
    flames.forEach(f => {
        if (f.userData.owner === color) {
            new TWEEN.Tween(f.scale).to({ x: 2.6, y: 3.4, z: 2.6 }, 900).easing(TWEEN.Easing.Elastic.Out).start();
        } else {
            new TWEEN.Tween(f.scale).to({ x: 0.05, y: 0.05, z: 0.05 }, 700).start();
        }
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

    // Facing arrows take priority while a facing is being chosen (they also cover
    // off-board directions on the parapet, which have no field to click).
    if (st.facingSelect) {
        const arrowHits = raycaster.intersectObjects(groupFacing.children, true);
        if (arrowHits.length) {
            let a = arrowHits[0].object;
            while (a && a.userData.facingDir === undefined && a.parent) a = a.parent;
            if (a && a.userData.facingDir !== undefined) {
                window.chooseFacingDir(a.userData.facingDir);
                return;
            }
        }
        // fall through: clicks on fields/warriors are resolved by the game
        // (adjacent = direction, elsewhere = cancel)
    }

    const intersects = raycaster.intersectObjects([...groupPieces.children, ...groupSlabs.children], true);
    if (!intersects.length) {
        if (st.facingSelect && typeof window.onCellClick === 'function') window.onCellClick(-9, -9); // off-world click = cancel
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
    const isTweening = TWEEN.update(time);
    const controlsUpdated = controls.update();

    // Brazier flicker
    flames.forEach((f, i) => {
        f.position.y = f.userData.baseY + Math.sin(clockT * 11 + i * 2.4) * 0.7;
        const s = 1 + Math.sin(clockT * 13 + i) * 0.12;
        if (!f.userData.victoryLocked) { f.scale.x = s; f.scale.z = s; }
    });
    // Banner sway — one global wind
    const wind = Math.sin(clockT * 2.2) * 0.18;
    flags.forEach((fl, i) => { fl.rotation.x = wind + Math.sin(clockT * 3 + i) * 0.06; });
    // Facing arrows breathe softly while a direction is being chosen
    if (groupFacing.children.length) {
        matFacingArrow.opacity = 0.7 + Math.sin(clockT * 4.5) * 0.25;
    }
    // Kestrels
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
    flames.forEach(f => { f.scale.set(1, 1, 1); f.userData.victoryLocked = false; });
    sync3DPieces();
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
