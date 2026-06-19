// ============================================
// TOWER GAME 3D VIEW — Porcelain Tower of Nanjing
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;
let clockT = 0;

const groupEnv = new THREE.Group();
const groupTower = new THREE.Group();
const groupSlots = new THREE.Group();   // clickable slot pads
const groupTiles = new THREE.Group();   // prism tiles
const groupHi = new THREE.Group();      // highlights
const groupHover = new THREE.Group();   // hover indicator
const groupFX = new THREE.Group();
const groupBirds = new THREE.Group();
let hoverKey = null;

const tileMeshes = new Map();   // "l,s" -> group
const slotPads = new Map();     // "l,s" -> mesh

// Layout
const LEVEL_H = 62;
const R_SLOT = 47;
const R_FLOOR = 60;
const R_WALL = 30;
const R_EAVES = 76;
const BASE_TOP = 0;             // y of level-0 floor top
function levelY(l) { return BASE_TOP + l * LEVEL_H; }
function slotAngle(s) { return s * (Math.PI * 2 / window.TOWER_SLOTS); }
function slotPos(l, s) {
    const a = slotAngle(s);
    return { x: Math.sin(a) * R_SLOT, y: levelY(l) + 1.5, z: Math.cos(a) * R_SLOT, angle: a };
}

// Materials
const matStone = new THREE.MeshStandardMaterial({ color: 0xb8a98c, roughness: 0.95 });
const matBaseStone = new THREE.MeshStandardMaterial({ color: 0xcbbfa4, roughness: 0.9 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.7 });
const matFloor = new THREE.MeshStandardMaterial({ color: 0xe7dec8, roughness: 0.8 });
const matEaves = new THREE.MeshStandardMaterial({ color: 0x2f7d5b, roughness: 0.6, metalness: 0.15 }); // green glaze
const matEavesTrim = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.3, metalness: 0.7 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xE7C24A, roughness: 0.25, metalness: 0.85, emissive: 0x3a2a00, emissiveIntensity: 0.2 });
const matPost = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.7 });   // matchstick post (prototype homage)
const matPostTip = new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.5 }); // red tip
const matPad = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.85 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x52673f, roughness: 1.0 });
const matMountain = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 1.0 });
const matPine = new THREE.MeshStandardMaterial({ color: 0x32503a, roughness: 0.95 });
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });

const matTileBody = new THREE.MeshStandardMaterial({ color: 0xeae3d2, roughness: 0.6 });
const matCapW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const matCapB = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.4 });
const matBar = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5, emissive: 0x3a0000, emissiveIntensity: 0.25 });

const matHiPlace = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.55, depthWrite: false });
const matHiMove = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, depthWrite: false });
const matHiSel = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.8, depthWrite: false });
const matHiWin = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.7, depthWrite: false });
const matHiNo = new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.6, depthWrite: false });
const matHiBonus = new THREE.MeshBasicMaterial({ color: 0xb98bff, transparent: true, opacity: 0.7, depthWrite: false });
const matHover = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.9, depthWrite: false });

// Prism geometry: flat number-face toward +Z (outward), apex toward -Z (center)
const TILE_W = 5.2, TILE_DEPTH = 9, TILE_H = 17;
function makePrismGeo() {
    const shape = new THREE.Shape();
    shape.moveTo(-TILE_W, TILE_DEPTH * 0.5);
    shape.lineTo(TILE_W, TILE_DEPTH * 0.5);
    shape.lineTo(0, -TILE_DEPTH * 0.5);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: TILE_H, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);      // extrude axis -> vertical
    geo.translate(0, TILE_H, 0);   // sit on the floor (0..TILE_H)
    return geo;
}
const PRISM_GEO = makePrismGeo();
function makeCapGeo() {
    const shape = new THREE.Shape();
    shape.moveTo(-TILE_W, TILE_DEPTH * 0.5);
    shape.lineTo(TILE_W, TILE_DEPTH * 0.5);
    shape.lineTo(0, -TILE_DEPTH * 0.5);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
}
const CAP_GEO = makeCapGeo();

// ============================================
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfde0ad);
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.0006);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(0, 250, 430);

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
    controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.enablePan = false;
    controls.target.set(0, 110, 0);
    controls.update();
    controls.addEventListener('change', () => { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x4a5d23, 0.66));
    const dir = new THREE.DirectionalLight(0xffd9a0, 1.3);
    dir.position.set(220, 360, 300);
    dir.castShadow = true;
    dir.shadow.camera.top = 360; dir.shadow.camera.bottom = -120;
    dir.shadow.camera.left = -360; dir.shadow.camera.right = 360;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 2000;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    scene.add(dir);

    scene.add(groupEnv, groupTower, groupSlots, groupTiles, groupHi, groupHover, groupFX, groupBirds);

    buildEnvironment();
    buildTower();

    window.addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', clearHover);
    renderer.setAnimationLoop(animate);

    towerRebuild();
}
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

// ============================================
// ENVIRONMENT
// ============================================
function buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6000, 48), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -36; ground.receiveShadow = true;
    groupEnv.add(ground);

    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, dist = 1800 + Math.random() * 1500, h = 420 + Math.random() * 760;
        const m = new THREE.Mesh(new THREE.ConeGeometry(520 + Math.random() * 420, h, 7), matMountain);
        m.position.set(Math.cos(a) * dist, -36 + h / 2, Math.sin(a) * dist);
        groupEnv.add(m);
    }
    for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, dist = 150 + Math.random() * 700;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 12, 5), matTrunk);
        trunk.position.y = 6; tree.add(trunk);
        for (let t = 0; t < 3; t++) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(10 - t * 2.4, 14, 7), matPine);
            c.position.y = 14 + t * 8; c.castShadow = true; tree.add(c);
        }
        const sc = 0.7 + Math.random();
        tree.scale.set(sc, sc, sc);
        tree.position.set(Math.cos(a) * dist, -36, Math.sin(a) * dist);
        groupEnv.add(tree);
    }
    for (let i = 0; i < 4; i++) {
        const b = new THREE.Group();
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ color: 0x4a3f33, side: THREE.DoubleSide }));
        const w2 = wing.clone(); wing.position.x = -4; wing.rotation.z = 0.25; w2.position.x = 4; w2.rotation.z = -0.25;
        b.add(wing, w2);
        b.userData = { angle: Math.random() * 6.28, radius: 340 + Math.random() * 320, height: 230 + Math.random() * 150, speed: 0.0018 + Math.random() * 0.0012 };
        groupBirds.add(b);
    }
}

// ============================================
// THE TOWER
// ============================================
function octGeo(radius, height) { return new THREE.CylinderGeometry(radius, radius, height, 8); }

function buildTower() {
    // Stepped base plinth
    for (let i = 0; i < 3; i++) {
        const r = R_EAVES + 26 - i * 12;
        const step = new THREE.Mesh(octGeo(r, 10), matBaseStone);
        step.position.y = -5 - (2 - i) * 10;
        step.rotation.y = Math.PI / 8;
        step.receiveShadow = true; step.castShadow = true;
        groupTower.add(step);
    }
    // central white wall drum running the whole height
    const drum = new THREE.Mesh(octGeo(R_WALL, LEVEL_H * LEVELSnum()), matWall);
    drum.position.y = (LEVEL_H * LEVELSnum()) / 2;
    drum.rotation.y = Math.PI / 8;
    drum.castShadow = true; drum.receiveShadow = true;
    groupTower.add(drum);

    for (let l = 0; l < LEVELSnum(); l++) buildLevel(l);

    // Spire
    buildSpire(levelY(LEVELSnum() - 1) + 46);
}
function LEVELSnum() { return window.TOWER_LEVELS; }

function buildLevel(l) {
    const baseY = levelY(l);
    // floor balcony plate
    const floor = new THREE.Mesh(octGeo(R_FLOOR, 4), matFloor);
    floor.position.y = baseY - 1; floor.rotation.y = Math.PI / 8;
    floor.receiveShadow = true; floor.castShadow = true;
    groupTower.add(floor);

    // red-tipped corner posts (prototype homage) at octagon vertices
    for (let v = 0; v < 8; v++) {
        const a = v * Math.PI / 4 + Math.PI / 8;
        const px = Math.sin(a) * (R_FLOOR - 4), pz = Math.cos(a) * (R_FLOOR - 4);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 42, 7), matPost);
        post.position.set(px, baseY + 21, pz); post.castShadow = true;
        groupTower.add(post);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), matPostTip);
        tip.position.set(px, baseY + 42, pz);
        groupTower.add(tip);
    }

    // green upturned eaves above this level's tiles
    const eaveY = baseY + 44;
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(R_EAVES, R_EAVES - 10, 6, 8), matEaves);
    eave.position.y = eaveY; eave.rotation.y = Math.PI / 8;
    eave.castShadow = true; eave.receiveShadow = true;
    groupTower.add(eave);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(R_EAVES + 4, R_EAVES, 2.4, 8), matEavesTrim);
    lip.position.y = eaveY - 4; lip.rotation.y = Math.PI / 8;
    groupTower.add(lip);
    // upturned corner finials on the eaves
    for (let v = 0; v < 8; v++) {
        const a = v * Math.PI / 4;
        const fx = Math.sin(a) * (R_EAVES + 2), fz = Math.cos(a) * (R_EAVES + 2);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 5), matEavesTrim);
        fin.position.set(fx, eaveY + 4, fz);
        fin.rotation.z = -Math.sin(a) * 0.5; fin.rotation.x = Math.cos(a) * 0.5;
        groupTower.add(fin);
    }

    // slot pads + (rebuilt) tiles handled in towerRebuild/sync
    for (let s = 0; s < window.TOWER_SLOTS; s++) {
        const p = slotPos(l, s);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1.4, 16), matPad);
        pad.position.set(p.x, baseY + 0.8, p.z);
        pad.receiveShadow = true;
        pad.userData = { level: l, slot: s };
        groupSlots.add(pad);
        slotPads.set(l + ',' + s, pad);
    }
}

function buildSpire(y0) {
    for (let i = 0; i < 7; i++) {
        const r = 12 - i * 1.4;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 1.4, 5, 12), matGold);
        ring.position.y = y0 + i * 6;
        ring.castShadow = true;
        groupTower.add(ring);
    }
    const finial = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 10), matGold);
    finial.position.y = y0 + 7 * 6 + 2;
    groupTower.add(finial);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 10), matGold);
    tip.position.y = y0 + 7 * 6 + 12;
    groupTower.add(tip);
}

// ============================================
// TILES
// ============================================
function makeTile(owner, num) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(PRISM_GEO, matTileBody.clone());
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const cap = new THREE.Mesh(CAP_GEO, owner === 'W' ? matCapW : matCapB);
    cap.position.y = TILE_H + 0.2;
    g.add(cap);
    g.userData = { owner: owner, num: num, bars: [] };
    buildBars(g, num);
    return g;
}
function buildBars(g, num) {
    g.userData.bars.forEach(b => g.remove(b));
    g.userData.bars = [];
    const z = TILE_DEPTH * 0.5 + 0.5;
    const gap = 2.4;
    const startX = -(num - 1) * gap / 2;
    for (let i = 0; i < num; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 7, 0.8), matBar);
        bar.position.set(startX + i * gap, TILE_H * 0.5 + 1, z);
        g.add(bar);
        g.userData.bars.push(bar);
    }
    g.userData.num = num;
}

function towerSync3D() {
    const st = window.getTowerState ? window.getTowerState() : null;
    if (!st) return;
    const live = new Set();
    for (let l = 0; l < window.TOWER_LEVELS; l++) {
        for (let s = 0; s < window.TOWER_SLOTS; s++) {
            const t = st.board[l][s];
            const key = l + ',' + s;
            if (t) live.add(key);
            let mesh = tileMeshes.get(key);
            if (t && !mesh) {
                mesh = makeTile(t.owner, t.num);
                mesh.userData.level = l; mesh.userData.slot = s; // so the whole tile is clickable
                const p = slotPos(l, s);
                mesh.position.set(p.x, levelY(l), p.z);
                mesh.rotation.y = p.angle;
                groupTiles.add(mesh);
                tileMeshes.set(key, mesh);
            } else if (t && mesh && !mesh.userData.animating) {
                mesh.userData.level = l; mesh.userData.slot = s;
                // reconcile owner/num
                if (mesh.userData.owner !== t.owner) {
                    mesh.userData.owner = t.owner;
                    mesh.children.forEach(c => { if (c.geometry === CAP_GEO) c.material = t.owner === 'W' ? matCapW : matCapB; });
                }
                if (mesh.userData.num !== t.num) buildBars(mesh, t.num);
                const p = slotPos(l, s);
                mesh.position.set(p.x, levelY(l), p.z);
                mesh.rotation.y = p.angle;
            }
        }
    }
    tileMeshes.forEach((mesh, key) => {
        if (!live.has(key) && !mesh.userData.animating) { groupTiles.remove(mesh); tileMeshes.delete(key); }
    });
    needsRender = true;
}

// ============================================
// HIGHLIGHTS
// ============================================
function ringAt(l, s, mat, inner, outer) {
    const p = slotPos(l, s);
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner || 7.5, outer || 9.5, 20), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, levelY(l) + 2.4, p.z);
    groupHi.add(ring);
}
function towerUpdateViews() {
    while (groupHi.children.length) groupHi.remove(groupHi.children[0]);
    const st = window.getTowerState ? window.getTowerState() : null;
    if (!st || st.gameOver) { needsRender = true; return; }
    const empty = (l, s) => !st.board[l][s];

    if (st.bonusActive) {
        if (!st.selected) {
            for (let l = 0; l < window.TOWER_LEVELS; l++) for (let s = 0; s < window.TOWER_SLOTS; s++) if (!empty(l, s)) ringAt(l, s, matHiBonus, 7.5, 9.2);
        } else {
            ringAt(st.selected.level, st.selected.slot, matHiSel, 8, 10);
            window.towerNeighbors(st.selected.level, st.selected.slot).forEach(n => { if (empty(n.level, n.slot)) ringAt(n.level, n.slot, matHiBonus); });
        }
        needsRender = true; return;
    }
    if (st.mode === 'place') {
        if (st.pool[st.turn] > 0) for (let l = 0; l < window.TOWER_LEVELS; l++) for (let s = 0; s < window.TOWER_SLOTS; s++) if (empty(l, s)) ringAt(l, s, matHiPlace);
    } else if (st.mode === 'move') {
        if (st.selected) {
            ringAt(st.selected.level, st.selected.slot, matHiSel, 8, 10);
            window.towerNeighbors(st.selected.level, st.selected.slot).forEach(n => { if (empty(n.level, n.slot)) ringAt(n.level, n.slot, matHiMove); });
            // attack targets are reachable from the same selection
            st.attackTargets.forEach(g => { g.tiles.forEach(p => ringAt(p.level, p.slot, g.win ? matHiWin : matHiNo, 7.5, 10)); });
        } else {
            for (let l = 0; l < window.TOWER_LEVELS; l++) for (let s = 0; s < window.TOWER_SLOTS; s++) { const t = st.board[l][s]; if (t && t.owner === st.turn) ringAt(l, s, matHiSel, 8, 9.5); }
        }
    } else if (st.mode === 'levelup') {
        for (let l = 0; l < window.TOWER_LEVELS; l++) for (let s = 0; s < window.TOWER_SLOTS; s++) { const t = st.board[l][s]; if (t && t.owner === st.turn) ringAt(l, s, matHiSel, 8, 9.5); }
    }
    needsRender = true;
}

// ============================================
// ANIMATIONS
// ============================================
function towerAnimPlace(l, s, done) {
    towerSync3D();
    const mesh = tileMeshes.get(l + ',' + s);
    if (!mesh) { done && done(); return; }
    mesh.userData.animating = true;
    const targetY = levelY(l);
    mesh.position.y = targetY + 40;
    mesh.scale.set(0.6, 0.6, 0.6);
    new TWEEN.Tween(mesh.position).to({ y: targetY }, 380).easing(TWEEN.Easing.Quadratic.In).start();
    new TWEEN.Tween(mesh.scale).to({ x: 1, y: 1, z: 1 }, 380).easing(TWEEN.Easing.Back.Out)
        .onComplete(() => { mesh.userData.animating = false; done && done(); needsRender = true; }).start();
    needsRender = true;
}
function towerAnimMove(from, to, done) {
    const mesh = tileMeshes.get(from.level + ',' + from.slot);
    if (!mesh) { done && done(); return; }
    mesh.userData.animating = true;
    tileMeshes.delete(from.level + ',' + from.slot);
    tileMeshes.set(to.level + ',' + to.slot, mesh);
    const p = slotPos(to.level, to.slot);
    const midY = Math.max(levelY(from.level), levelY(to.level)) + 22;
    new TWEEN.Tween(mesh.position).to({ y: midY }, 200).easing(TWEEN.Easing.Quadratic.Out)
        .chain(new TWEEN.Tween(mesh.position).to({ x: p.x, y: levelY(to.level), z: p.z }, 320).easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => { mesh.rotation.y = p.angle; mesh.userData.animating = false; done && done(); needsRender = true; })).start();
    new TWEEN.Tween(mesh.rotation).to({ y: p.angle }, 520).start();
    needsRender = true;
}
function towerAnimLevelUp(l, s, done) {
    const mesh = tileMeshes.get(l + ',' + s);
    if (!mesh) { done && done(); return; }
    mesh.userData.animating = true;
    const from = mesh.rotation.y;
    new TWEEN.Tween({ t: 0 }).to({ t: 1 }, 360).easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(o => { mesh.rotation.y = from - o.t * (Math.PI * 2 / 3); needsRender = true; })
        .onComplete(() => { mesh.rotation.y = from; mesh.userData.animating = false; done && done(); needsRender = true; }).start();
    needsRender = true;
}
function towerAnimAttack(attacker, captured, done) {
    // pulse the attacker, zap each captured tile
    let remaining = captured.length;
    captured.forEach((p, i) => {
        const mesh = tileMeshes.get(p.level + ',' + p.slot);
        if (!mesh) { if (--remaining <= 0) done && done(); return; }
        const sp = slotPos(p.level, p.slot);
        spark(sp.x, levelY(p.level) + TILE_H * 0.6, sp.z);
        new TWEEN.Tween(mesh.scale).to({ x: 1.25, y: 0.7, z: 1.25 }, 150).yoyo(true).repeat(1).easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => { if (--remaining <= 0) { done && done(); } needsRender = true; }).start();
    });
    if (!captured.length) done && done();
    needsRender = true;
}
function spark(x, y, z) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.7, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    ring.position.set(x, y, z); ring.rotation.x = Math.PI / 2;
    groupFX.add(ring);
    new TWEEN.Tween(ring.scale).to({ x: 3, y: 3, z: 3 }, 320).easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { groupFX.remove(ring); needsRender = true; }).start();
}
function towerVictory(color) {
    // flare the spire
    needsRender = true;
}

function towerRebuild() {
    while (groupTiles.children.length) groupTiles.remove(groupTiles.children[0]);
    tileMeshes.clear();
    while (groupHi.children.length) groupHi.remove(groupHi.children[0]);
    while (groupFX.children.length) groupFX.remove(groupFX.children[0]);
    clearHover();
    towerSync3D();
    towerUpdateViews();
}

// ============================================
// INTERACTION
// ============================================
function onPointerDown(event) {
    if (!window.is3DView) return;
    const st = window.getTowerState ? window.getTowerState() : null;
    if (!st || st.busy || st.gameOver) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...groupTiles.children, ...groupSlots.children], true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && obj.userData.level === undefined && obj.parent) obj = obj.parent;
    if (obj && obj.userData.level !== undefined && window.onTowerSlotTap) {
        window.onTowerSlotTap(obj.userData.level, obj.userData.slot);
    }
}

function pickSlot(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...groupTiles.children, ...groupSlots.children], true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && obj.userData.level === undefined && obj.parent) obj = obj.parent;
    return (obj && obj.userData.level !== undefined) ? { level: obj.userData.level, slot: obj.userData.slot } : null;
}

function clearHover() {
    if (hoverKey === null) return;
    hoverKey = null;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    if (renderer) renderer.domElement.style.cursor = 'default';
    needsRender = true;
}

// Hover: show which slot/tile would be selected, and switch the cursor.
function onPointerMove(event) {
    if (!window.is3DView) return;
    const st = window.getTowerState ? window.getTowerState() : null;
    const hit = (st && !st.busy && !st.gameOver) ? pickSlot(event) : null;
    const key = hit ? hit.level + ',' + hit.slot : null;
    if (key === hoverKey) return;
    hoverKey = key;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    renderer.domElement.style.cursor = key ? 'pointer' : 'default';
    if (hit) {
        const p = slotPos(hit.level, hit.slot);
        const ring = new THREE.Mesh(new THREE.RingGeometry(9, 11.2, 28), matHover);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, levelY(hit.level) + 2.7, p.z);
        groupHover.add(ring);
        // gentle bob to read as "interactive"
        ring.userData.bob = true;
    }
    needsRender = true;
}

function animate(time) {
    clockT = time * 0.001;
    TWEEN.update(time);
    const cu = controls.update();
    groupBirds.children.forEach(b => {
        b.userData.angle += b.userData.speed;
        b.position.set(Math.cos(b.userData.angle) * b.userData.radius, b.userData.height, Math.sin(b.userData.angle) * b.userData.radius);
        b.rotation.y = -b.userData.angle;
    });
    if (cu || needsRender || groupBirds.children.length) { renderer.render(scene, camera); needsRender = false; }
}

// ============================================
// EXPORTS
// ============================================
window.towerSync3D = towerSync3D;
window.towerUpdateViews = towerUpdateViews;
window.towerRebuild = towerRebuild;
window.towerAnimPlace = towerAnimPlace;
window.towerAnimMove = towerAnimMove;
window.towerAnimLevelUp = towerAnimLevelUp;
window.towerAnimAttack = towerAnimAttack;
window.towerVictory = towerVictory;

document.addEventListener('DOMContentLoaded', () => init3D());
