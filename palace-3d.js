// ============================================
// PALACE 3D VIEW — "The Span" (Crystal Palace, glass & cast iron)
// Standing stones, Run targets, Artifact gems
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

const groupEnv = new THREE.Group();
const groupBuild = new THREE.Group();   // per-voxel glass + frames + caps
const groupStones = new THREE.Group();
const groupTargets = new THREE.Group(); // play: run/climb/shatter rings
const groupArtifacts = new THREE.Group();
const groupFX = new THREE.Group();
const groupArtifactPool = new THREE.Group(); // persistent — artifacts survive sync clears

const voxelMeshes = new Map();  // "x,y,k" -> [meshes]
const stoneMeshes = new Map();  // 'p'+id -> stone group
const _artifactMeshes = new Map();  // "x,y" -> mesh (persistent pool lookup)


// ---- layout ----
const CELL = 30;
const STEP = 26;
const W = 9, D = 7;
function worldX(x) { return (x - (W - 1) / 2) * CELL; }
function worldZ(y) { return (y - (D - 1) / 2) * CELL; }
function levelTop(l) { return l * STEP; }
function standPos(x, y, k) { return new THREE.Vector3(worldX(x), k * STEP + 1.6, worldZ(y)); }

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

const matRun = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const matShatter = new THREE.MeshBasicMaterial({ color: 0xe24a3b, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
const matSelStone = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const matPortalTarget = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
const matStealTarget = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const matLaserTarget = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
const ARTIFACT_GEO = new THREE.OctahedronGeometry(4.5);

const PCOL = { W: { stone: 0xf3efe6, artif: 0xffffff, emissive: 0xffffff, tint: 0xe8e8f0 }, B: { stone: 0x232323, artif: 0x000000, emissive: 0x333333, tint: 0x1a1a22 } };

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

    scene.add(groupEnv, groupBuild, groupStones, groupTargets, groupArtifacts, groupFX, groupArtifactPool);

    buildPlinth();
    buildStructure();

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
    const matRing = new THREE.MeshStandardMaterial({ color: 0xbabf9f, roughness: 0.9 });
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < D; y++) {
            if (x === 0 || x === W - 1 || y === 0 || y === D - 1) {
                const cx = worldX(x), cz = worldZ(y);
                const ringPad = new THREE.Mesh(new THREE.BoxGeometry(CELL - 2, 1.6, CELL - 2), matRing);
                ringPad.position.set(cx, 0.8, cz);
                ringPad.receiveShadow = true;
                groupBuild.add(ringPad);
                continue;
            }
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
    // goal bands: the end a player must REACH (Black scores at x=W-1, White at x=0)
    for (let y = 0; y < D; y++) {
        addGoal(0, y, matGoalW);          // White wins by reaching x=0
        addGoal(W - 1, y, matGoalB);      // Black wins by reaching x=W-1
    }
}
function addGoal(x, y, mat) {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 4, CELL - 4), mat);
    disc.rotation.x = -Math.PI / 2;
    const h = (x === 0 || x === W - 1 || y === 0 || y === D - 1) ? 1.2 : levelTop(window.palLevel(x, y)) + 1.2;
    disc.position.set(worldX(x), h, worldZ(y));
    groupBuild.add(disc);
}
function buildPortal(x, y, cx, cz, h) {
    let nx = 0, nz = 0;
    if (x === 1) nx = -1; else if (x === W - 2) nx = 1;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.3, 1.6, 8, 18, Math.PI), matGold);
    arch.position.set(cx + nx * (CELL / 2 - 0.5), h * 0.55, cz + nz * (CELL / 2 - 0.5));
    if (nx) arch.rotation.y = Math.PI / 2;
    arch.userData.portal = true;
    groupBuild.add(arch);
}
function applyShattered(keys) {
    // no-op — shatter removed; keep for API compatibility
}

function createArtifact(colorHex, emissiveHex) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex, emissive: emissiveHex, emissiveIntensity: 1.4,
        roughness: 0.1, metalness: 0.6
    });
    const body = new THREE.Mesh(ARTIFACT_GEO, mat);
    body.scale.set(1.6, 1.0, 1.6);
    g.add(body);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(8.0, 16, 12),
        new THREE.MeshBasicMaterial({ color: emissiveHex, transparent: true, opacity: 0.5 }));
    g.add(glow);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
    g.userData.mat = mat;
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
function tintGlassColumn(x, y, colorHex) {
    const L = window.palLevel(x, y);
    const k = L - 1; // only tint the topmost glass block
    const list = voxelMeshes.get(x + ',' + y + ',' + k);
    if (!list) return;
    const glass = list[0];
    if (!glass.userData._origColor) {
        glass.userData._origColor = glass.material.color.getHex();
        glass.userData._origOpacity = glass.material.opacity;
    }
    glass.material.color.setHex(colorHex);
    glass.material.opacity = Math.min(1, glass.userData._origOpacity + 0.18);
}

function clearGlassTint(x, y) {
    const L = window.palLevel(x, y);
    const k = L - 1;
    const list = voxelMeshes.get(x + ',' + y + ',' + k);
    if (!list) return;
    const glass = list[0];
    if (glass.userData._origColor != null) {
        glass.material.color.setHex(glass.userData._origColor);
        glass.material.opacity = glass.userData._origOpacity;
    }
}

function palaceSync3D() {
    syncPlay(window.getPalState());
}

function syncPlay(st) {
    applyShattered(st.shattered);
    while (groupArtifacts.children.length) groupArtifacts.remove(groupArtifacts.children[0]);

    // Artifacts — persistent pool with drop animation into glass
    const currentArtKeys = new Set();
    if (st.artifacts) {
        st.artifacts.forEach(function (a) {
            const key = a.x + ',' + a.y;
            currentArtKeys.add(key);
            if (_artifactMeshes.has(key)) {
                const mesh = _artifactMeshes.get(key);
                const col = PCOL[a.color];
                mesh.userData.mat.color.setHex(col.artif);
                mesh.userData.mat.emissive.setHex(col.emissive);
                return;
            }
            const col = PCOL[a.color];
            const mesh = createArtifact(col.artif, col.emissive);
            const L = window.palLevel(a.x, a.y);
            const restY = (L - 0.5) * STEP;
            const startY = L * STEP + 40;
            const cx = worldX(a.x), cz = worldZ(a.y);
            mesh.position.set(cx, startY, cz);
            groupArtifactPool.add(mesh);
            _artifactMeshes.set(key, mesh);
            // Drop animation into the glass interior
            const o = { t: 0 };
            new TWEEN.Tween(o).to({ t: 1 }, 700).easing(TWEEN.Easing.Quadratic.In)
                .onUpdate(function () {
                    const frac = o.t;
                    mesh.position.y = startY + (restY - startY) * frac;
                    const s = 0.3 + 0.7 * (1 - frac);
                    mesh.scale.set(s, s, s);
                    needsRender = true;
                })
                .onComplete(function () {
                    mesh.scale.set(1, 1, 1);
                    mesh.position.y = restY;
                    needsRender = true;
                }).start();
        });
    }
    _artifactMeshes.forEach(function (mesh, key) {
        if (!currentArtKeys.has(key)) {
            groupArtifactPool.remove(mesh);
            _artifactMeshes.delete(key);
        }
    });

    // Tint glass columns by territory
    const tintedCells = new Set();
    if (st.artifacts) {
        st.artifacts.forEach(function (a) {
            const key = a.x + ',' + a.y;
            tintedCells.add(key);
            tintGlassColumn(a.x, a.y, PCOL[a.color].tint);
        });
    }
    for (let x = 1; x <= W - 2; x++) {
        for (let y = 1; y <= D - 2; y++) {
            if (!tintedCells.has(x + ',' + y)) clearGlassTint(x, y);
        }
    }

    // Stones + carrying gems
    const live = new Set();
    st.stones.forEach(function (s) {
        const key = 'p' + s.id; live.add(key);
        let mesh = stoneMeshes.get(key);
        if (!mesh) { mesh = createStone(PCOL[s.color].stone, s.color !== 'W'); mesh.userData.id = s.id; groupStones.add(mesh); stoneMeshes.set(key, mesh); }
        mesh.quaternion.identity();
        if (!mesh.userData.animating) mesh.position.copy(standPos(s.x, s.y, s.k));
        // Carrying indicator
        mesh.userData.carryGem && mesh.remove(mesh.userData.carryGem);
        mesh.userData.carryGem = null;
        if (s.carrying) {
            const col = PCOL[s.color];
            const gem = createCarryGem(col.artif, col.emissive);
            mesh.add(gem);
            mesh.userData.carryGem = gem;
        }
    });
    stoneMeshes.forEach(function (m, key) { if (!live.has(key) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(key); } });
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
        let mat = matRun;
        if (t.type === 'portal') mat = matPortalTarget;
        else if (t.type === 'laser') mat = matLaserTarget;
        else if (t.type === 'run' && t.steal) mat = matStealTarget;
        else if (t.capture != null) mat = matShatter;
        const ring = new THREE.Mesh(new THREE.RingGeometry(t.type === 'laser' ? CELL * 0.18 : CELL * 0.28, t.type === 'laser' ? CELL * 0.25 : CELL * 0.4, 26), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(worldX(t.x), t.k * STEP + 1.6, worldZ(t.y));
        ring.userData.target = t;
        groupTargets.add(ring);
    });
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
function palaceAnimLaserHit(sx, sy, tx, ty, hitType) {
    var pk = window.palLevel || function () { return 0; };
    var start = standPos(sx, sy, pk(sx, sy));
    var end = standPos(tx, ty, pk(tx, ty));
    var sy2 = start.y + 4, ey2 = end.y + 4;
    var dx = (end.x - start.x) / 30, dy = (ey2 - sy2) / 30, dz = (end.z - start.z) / 30;
    var allPoints = [];
    for (var i = 0; i <= 30; i++) {
        allPoints.push(new THREE.Vector3(start.x + dx * i, sy2 + dy * i, start.z + dz * i));
    }
    var positions = new Float32Array(allPoints.length * 3);
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);
    var beam = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 1 }));
    groupFX.add(beam);
    var tip = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6060, transparent: true, opacity: 1 })
    );
    var glow = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.4 })
    );
    groupFX.add(tip); groupFX.add(glow);
    var flash = new THREE.Mesh(
        new THREE.SphereGeometry(5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6060, transparent: true, opacity: 0 })
    );
    flash.position.set(end.x, ey2, end.z);
    groupFX.add(flash);
    needsRender = true;
    function ee(t) {
        if (t < 0.2) return 0.02 * Math.pow(t / 0.2, 4);
        return 0.02 + 0.98 * Math.pow((t - 0.2) / 0.8, 1.7);
    }
    var o = { t: 0 };
    new TWEEN.Tween(o).to({ t: 1 }, 480).easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(function () {
            var p = ee(o.t);
            var count = Math.min(allPoints.length, Math.max(1, Math.floor(p * allPoints.length)));
            for (var i = 0; i < count && i < allPoints.length; i++) {
                positions[i * 3] = allPoints[i].x;
                positions[i * 3 + 1] = allPoints[i].y;
                positions[i * 3 + 2] = allPoints[i].z;
            }
            geom.setDrawRange(0, count);
            geom.attributes.position.needsUpdate = true;
            var tipPt = allPoints[Math.min(count, allPoints.length - 1)];
            tip.position.copy(tipPt);
            glow.position.copy(tipPt);
            tip.scale.set(1 + p * 1.5, 1 + p * 1.5, 1 + p * 1.5);
            needsRender = true;
        })
        .onComplete(function () {
            tip.material.opacity = 0;
            glow.material.opacity = 0;
            flash.material.opacity = 1;
            flash.scale.set(1, 1, 1);
            var f = { o: 1 };
            new TWEEN.Tween(f).to({ o: 0 }, 280).easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(function () {
                    beam.material.opacity = f.o;
                    flash.material.opacity = f.o;
                    var fs = 1 + (1 - f.o) * 3;
                    flash.scale.set(fs, fs, fs);
                    needsRender = true;
                })
                .onComplete(function () {
                    groupFX.remove(beam);
                    groupFX.remove(tip);
                    groupFX.remove(glow);
                    groupFX.remove(flash);
                    beam.geometry.dispose();
                    needsRender = true;
                }).start();
        }).start();
}
function palaceWin(color) {
    const box = document.getElementById('message-box');
    const title = document.getElementById('message-title');
    const text = document.getElementById('message-text');
    if (title) title.textContent = (color === 'W' ? 'White' : 'Black') + ' Wins';
    if (text) text.textContent = (color === 'W' ? 'White' : 'Black') + ' reaches 20 points first!';
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
    if (st.winner) return;
    const hits = castObjects([].concat(groupTargets.children, groupStones.children, groupBuild.children));
    if (!hits.length) return;
    for (let i = 0; i < hits.length; i++) {
        const t = bubbleTo(hits[i].object, 'target');
        if (t) { window.palPlayTapTarget(t.userData.target); return; }
    }
    for (let i = 0; i < hits.length; i++) {
        const p = hits[i].object.position;
        if (!p) continue;
        if (bubbleTo(hits[i].object, 'id')) continue;
        const gx = Math.round(p.x / CELL + (W - 1) / 2);
        const gy = Math.round(p.z / CELL + (D - 1) / 2);
        const t = st.targets.find(function (t) { return t.x === gx && t.y === gy; });
        if (t) { window.palPlayTapTarget(t); return; }
    }
    const so = bubbleTo(hits[0].object, 'id');
    if (so) window.palPlayTapStone(so.userData.id);
}

function clearHover() {
    if (renderer) renderer.domElement.style.cursor = 'default';
}
function onPointerMove(event) {
    if (!window.is3DView) return;
    setMouse(event);
    const hits = castObjects([].concat(groupTargets.children, groupStones.children, groupBuild.children));
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
window.palaceAnimShatter = palaceAnimShatter;
window.palaceAnimCapture = palaceAnimCapture;
window.palaceAnimLaserHit = palaceAnimLaserHit;
window.palaceWin = palaceWin;

document.addEventListener('DOMContentLoaded', function () {
    init3D();
    if (window.palStartPlay) window.palStartPlay();
});
