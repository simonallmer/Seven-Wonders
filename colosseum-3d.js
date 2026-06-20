// ============================================
// COLOSSEUM GAME 3D VIEW — round tiered amphitheater
// Outer ring is the highest (elevated safe ring); the arena sinks to the centre.
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse, needsRender = true, clockT = 0;

const groupEnv = new THREE.Group();
const groupArena = new THREE.Group();
const groupPads = new THREE.Group();
const groupStones = new THREE.Group();
const groupHi = new THREE.Group();
const groupHover = new THREE.Group();
const groupFX = new THREE.Group();
const groupBirds = new THREE.Group();

const padMeshes = new Map();   // cell -> mesh
const stoneMeshes = new Map(); // id -> group
let hoverCell = null;

// Geometry: radii + tier heights per ring (outer ring highest)
const RIN = [0, 26, 56, 92, 134];
const ROUT = [26, 56, 92, 134, 182];
const H = [0, 7, 15, 24, 44];     // tier top height — ring 4 (outer) elevated
const WALL_R = 202, WALL_TOP = 88;
const COUNTS = [1, 8, 16, 32, 32];
const BASE_PAD = 0x000000;

// Materials
const matSand = new THREE.MeshStandardMaterial({ color: 0xdcc9a0, roughness: 0.97 });
const matSeat = new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.9 });
const matSeatDark = new THREE.MeshStandardMaterial({ color: 0xb6a784, roughness: 0.92 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xd2c3a0, roughness: 0.85 });
const matWallShade = new THREE.MeshStandardMaterial({ color: 0x6b5e44, roughness: 1.0 });
const matPier = new THREE.MeshStandardMaterial({ color: 0xdfd2b2, roughness: 0.8 });
const matCornice = new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 0.8 });
const matBowl = new THREE.MeshStandardMaterial({ color: 0xdbcfae, roughness: 0.88, side: THREE.DoubleSide });
const matGroove = new THREE.MeshStandardMaterial({ color: 0x5a4d36, roughness: 1.0 });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.25, metalness: 0.8, emissive: 0x332200, emissiveIntensity: 0.12 });
const matGround = new THREE.MeshStandardMaterial({ color: 0x6e7a44, roughness: 1.0 });
const matCyp = new THREE.MeshStandardMaterial({ color: 0x2f4030, roughness: 0.95 });
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
const matHill = new THREE.MeshStandardMaterial({ color: 0x9aa07e, roughness: 1.0 });
const matSelRing = new THREE.MeshBasicMaterial({ color: 0xf0c040, transparent: true, opacity: 0.85, depthWrite: false });
const matHover = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.85, depthWrite: false });

// ============================================
function cellAngle(cell) {
    const r = colRing(cell), s = colSector(cell), count = COUNTS[r];
    const step = Math.PI * 2 / count;
    return -Math.PI / 2 + (s + 0.5) * step;
}
function cellPos(cell) {
    const r = colRing(cell);
    if (cell === 0) return { x: 0, y: H[0], z: 0 };
    const a = cellAngle(cell), radius = (RIN[r] + ROUT[r]) / 2;
    return { x: radius * Math.cos(a), y: H[r], z: -radius * Math.sin(a) };
}
function wedgeGeo(rIn, rOut, a0, a1, segs) {
    segs = segs || 6;
    const sh = new THREE.Shape();
    sh.moveTo(rIn * Math.cos(a0), rIn * Math.sin(a0));
    sh.lineTo(rOut * Math.cos(a0), rOut * Math.sin(a0));
    for (let k = 1; k <= segs; k++) { const a = a0 + (a1 - a0) * k / segs; sh.lineTo(rOut * Math.cos(a), rOut * Math.sin(a)); }
    for (let k = segs; k >= 0; k--) { const a = a0 + (a1 - a0) * k / segs; sh.lineTo(rIn * Math.cos(a), rIn * Math.sin(a)); }
    sh.closePath();
    const geo = new THREE.ShapeGeometry(sh);
    geo.rotateX(-Math.PI / 2);
    return geo;
}

// ============================================
function init3D() {
    const c = document.getElementById('canvas3d');
    if (!c) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfde0ad);
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.00055);

    camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 12000);
    camera.position.set(0, 330, 470);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    c.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 220; controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.enablePan = false;
    controls.target.set(0, 18, 0); controls.update();
    controls.addEventListener('change', () => { needsRender = true; });

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x7a6e42, 1.05));
    const dir = new THREE.DirectionalLight(0xffe6bc, 1.45);
    dir.position.set(150, 560, 130); dir.castShadow = true; // high overhead so light reaches into the bowl
    dir.shadow.camera.top = 320; dir.shadow.camera.bottom = -320;
    dir.shadow.camera.left = -320; dir.shadow.camera.right = 320;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 2200;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.normalBias = 1.5;   // kills self-shadow "net" acne on the big flat tiers
    dir.shadow.bias = -0.0004;
    scene.add(dir);

    scene.add(groupEnv, groupArena, groupPads, groupStones, groupHi, groupHover, groupFX, groupBirds);

    buildEnvironment();
    buildAmphitheater();
    buildPads();

    addEventListener('resize', onResize);
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    
    let __pointerDownPos_colosseumdjs = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => {
        __pointerDownPos_colosseumdjs.x = e.clientX;
        __pointerDownPos_colosseumdjs.y = e.clientY;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __pointerDownPos_colosseumdjs.x;
        const dy = e.clientY - __pointerDownPos_colosseumdjs.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            onPointerDown(e);
        }
    });

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', clearHover);
    renderer.setAnimationLoop(animate);
}
function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); needsRender = true; }

// ============================================
// ENVIRONMENT
// ============================================
function buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6000, 48), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2; ground.receiveShadow = true;
    groupEnv.add(ground);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, dist = 1900 + Math.random() * 1500, h = 300 + Math.random() * 520;
        const m = new THREE.Mesh(new THREE.ConeGeometry(500 + Math.random() * 360, h, 6), matHill);
        m.position.set(Math.cos(a) * dist, -2 + h / 2, Math.sin(a) * dist);
        groupEnv.add(m);
    }
    // cypresses ringing the arena
    for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, dist = 270 + Math.random() * 500;
        const t = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 8, 5), matTrunk); trunk.position.y = 4; t.add(trunk);
        const body = new THREE.Mesh(new THREE.ConeGeometry(5, 30, 7), matCyp); body.position.y = 22; body.castShadow = true; t.add(body);
        const sc = 0.7 + Math.random() * 0.8; t.scale.set(sc, sc, sc);
        t.position.set(Math.cos(a) * dist, -2, Math.sin(a) * dist);
        groupEnv.add(t);
    }
    for (let i = 0; i < 5; i++) {
        const b = new THREE.Group();
        const w = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), new THREE.MeshBasicMaterial({ color: 0x4a3f33, side: THREE.DoubleSide }));
        const w2 = w.clone(); w.position.x = -4; w.rotation.z = .25; w2.position.x = 4; w2.rotation.z = -.25; b.add(w, w2);
        b.userData = { angle: Math.random() * 6.28, radius: 280 + Math.random() * 260, height: 220 + Math.random() * 140, speed: 0.0016 + Math.random() * 0.0012 };
        groupBirds.add(b);
    }
}

// ============================================
// THE AMPHITHEATER
// ============================================
function ringMesh(rIn, rOut, mat, y) {
    const g = new THREE.RingGeometry(rIn, rOut, 72);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.y = y; m.receiveShadow = true;
    return m;
}
function buildAmphitheater() {
    // ONE solid stepped bowl + outer wall, revolved from a cross-section profile —
    // gives real thickness and fully-connected tiers (no paper-thin floating rings).
    const P = [
        [0.5, H[0]], [RIN[1], H[0]],          // arena floor
        [RIN[1], H[1]], [ROUT[1], H[1]],      // riser 1 + ledge 1
        [RIN[2], H[2]], [ROUT[2], H[2]],      // riser 2 + ledge 2
        [RIN[3], H[3]], [ROUT[3], H[3]],      // riser 3 + ledge 3
        [RIN[4], H[4]], [ROUT[4], H[4]],      // riser 4 + ledge 4 (elevated)
        [ROUT[4] + 2, H[4]],                  // step out to wall foot
        [ROUT[4] + 2, WALL_TOP],              // inner wall up
        [WALL_R, WALL_TOP],                   // top rim across
        [WALL_R, 0]                           // exterior face down to ground
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(P, 96), matBowl);
    bowl.castShadow = true; bowl.receiveShadow = true;
    groupArena.add(bowl);

    // arena sand floor (color overlay)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(RIN[1] - 1, 48), matSand);
    floor.rotation.x = -Math.PI / 2; floor.position.y = H[0] + 0.15; floor.receiveShadow = true;
    groupArena.add(floor);

    // field grooves — radial dividers between sectors on every seating ring
    buildGrooves();

    // cornices (arcade levels) + top rim trim
    [24, 48, 70].forEach(y => {
        const cor = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R + 3, WALL_R + 3, 3.5, 96, 1, true), matCornice);
        cor.position.y = y; groupArena.add(cor);
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R + 3, WALL_R + 3, 4, 96, 1, true), matCornice);
    rim.position.y = WALL_TOP; groupArena.add(rim);

    // arcade piers (vertical divisions of the exterior)
    const bays = 40;
    for (let i = 0; i < bays; i++) {
        const a = (i / bays) * Math.PI * 2;
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4, WALL_TOP - 4, 7), matPier);
        pier.position.set(Math.cos(a) * (WALL_R + 1), (WALL_TOP - 4) / 2, Math.sin(a) * (WALL_R + 1));
        pier.rotation.y = -a;
        pier.castShadow = true;
        groupArena.add(pier);
    }
}

// Radial grooves so each cell is visually distinct (the steps already divide the rings).
function buildGrooves() {
    for (let r = 1; r <= 4; r++) {
        const count = COUNTS[r], step = Math.PI * 2 / count;
        const len = ROUT[r] - RIN[r] + 2, midR = (RIN[r] + ROUT[r]) / 2;
        for (let i = 0; i < count; i++) {
            const a = -Math.PI / 2 + i * step;          // sector boundary
            const dirX = Math.cos(a), dirZ = -Math.sin(a);
            const groove = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, len), matGroove);
            groove.position.set(midR * dirX, H[r] + 0.5, midR * dirZ);
            groove.rotation.y = Math.atan2(dirX, dirZ);
            groupArena.add(groove);
        }
        // a thin lip line along the ledge's outer edge for extra readability
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(ROUT[r] - 0.5, ROUT[r] - 0.5, 1.4, 96, 1, true), matGroove);
        lip.position.y = H[r] + 0.4; groupArena.add(lip);
    }
}

// clickable + colorable cell pads
function buildPads() {
    padMeshes.clear();
    while (groupPads.children.length) groupPads.remove(groupPads.children[0]);
    for (let cell = 0; cell < 89; cell++) {
        const r = colRing(cell);
        let geo;
        if (cell === 0) { geo = new THREE.CircleGeometry(RIN[1] - 3, 32); geo.rotateX(-Math.PI / 2); }
        else {
            const s = colSector(cell), count = COUNTS[r], step = Math.PI * 2 / count;
            const a0 = -Math.PI / 2 + s * step + 0.012, a1 = a0 + step - 0.024;
            geo = wedgeGeo(RIN[r] + 2, ROUT[r] - 2, a0, a1);
        }
        const mat = new THREE.MeshStandardMaterial({ color: BASE_PAD, transparent: true, opacity: 0, roughness: 0.7, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = H[r] + 0.6;
        mesh.userData.cell = cell;
        groupPads.add(mesh);
        padMeshes.set(cell, mesh);
    }
}

// ============================================
// STONES (series dome + gold bevel)
// ============================================
function createStone(colorHex, dark) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: dark ? 0.45 : 0.25, metalness: 0.12 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 6, 22), mat); body.position.y = 3; body.castShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(4.4, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); top.position.y = 6; top.castShadow = true; g.add(top);
    const bevel = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 8, 22), matBevel); bevel.rotation.x = Math.PI / 2; bevel.position.y = 6; g.add(bevel);
    g.scale.set(0.95, 0.95, 0.95);
    return g;
}
function colSync3D() {
    const st = window.getColState();
    const byCell = {};
    st.stones.forEach(s => { (byCell[s.cell] || (byCell[s.cell] = [])).push(s); });
    const live = new Set();
    Object.entries(byCell).forEach(([cell, arr]) => {
        const base = cellPos(Number(cell));
        arr.forEach((s, i) => {
            live.add(s.id);
            let mesh = stoneMeshes.get(s.id);
            if (!mesh) {
                mesh = createStone(COL_COLORS[s.color].stone, s.color !== 'W');
                mesh.userData.id = s.id; mesh.userData.color = s.color;
                groupStones.add(mesh); stoneMeshes.set(s.id, mesh);
            }
            mesh.userData.cell = s.cell;
            if (!mesh.userData.animating) {
                let ox = 0, oz = 0;
                if (arr.length > 1) { const a = (i / arr.length) * Math.PI * 2, sp = colRing(Number(cell)) >= 3 ? 6 : 8; ox = Math.cos(a) * sp; oz = Math.sin(a) * sp; }
                mesh.position.set(base.x + ox, base.y + 1, base.z + oz);
            }
        });
    });
    stoneMeshes.forEach((m, id) => { if (!live.has(id) && !m.userData.animating) { groupStones.remove(m); stoneMeshes.delete(id); } });
    needsRender = true;
}

// ============================================
// HIGHLIGHTS
// ============================================
function colUpdateViews() {
    while (groupHi.children.length) groupHi.remove(groupHi.children[0]);
    const st = window.getColState();
    padMeshes.forEach((mesh, cell) => {
        let col = BASE_PAD, op = 0;
        if (!st.gameOver) {
            if (st.selStone && st.selStone.cell === cell) { col = 0xf0d060; op = 0.65; }
            else if (st.validCells.indexOf(cell) !== -1) { col = COL_COLORS[st.turn].hi; op = 0.6; }
            else if (cell === 0 || colRing(cell) === 4) { col = 0x888888; op = 0.3; }
            else if (st.territory[cell]) { col = COL_COLORS[st.territory[cell]].terr; op = 0.5; }
        }
        mesh.material.color.setHex(col);
        mesh.material.opacity = op;
    });
    if (st.selStone) {
        const m = stoneMeshes.get(st.selStone.id);
        if (m) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.8, 22), matSelRing);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(m.position.x, cellPos(st.selStone.cell).y + 0.9, m.position.z);
            groupHi.add(ring);
        }
    }
    needsRender = true;
}

// ============================================
// ANIMATIONS
// ============================================
function colAnimMove(stone, fromCell, toCell, done) {
    const mesh = stoneMeshes.get(stone.id);
    if (!mesh) { done && done(); return; }
    mesh.userData.animating = true;
    const a = cellPos(fromCell), b = cellPos(toCell);
    const peak = Math.max(a.y, b.y) + 16;
    new TWEEN.Tween(mesh.position).to({ y: peak }, 180).easing(TWEEN.Easing.Quadratic.Out)
        .chain(new TWEEN.Tween(mesh.position).to({ x: b.x, y: b.y + 1, z: b.z }, 320).easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => { mesh.userData.animating = false; done && done(); needsRender = true; })).start();
    needsRender = true;
}
function colAnimRemove(removed, done) {
    let n = removed.length;
    if (!n) { done && done(); return; }
    removed.forEach(s => {
        const mesh = stoneMeshes.get(s.id);
        if (!mesh) { if (--n <= 0) done && done(); return; }
        mesh.userData.animating = true;
        const p = mesh.position;
        dust(p.x, p.y + 3, p.z);
        new TWEEN.Tween(mesh.scale).to({ x: 0.05, y: 0.05, z: 0.05 }, 420).easing(TWEEN.Easing.Quadratic.In)
            .onComplete(() => { groupStones.remove(mesh); stoneMeshes.delete(s.id); if (--n <= 0) done && done(); needsRender = true; }).start();
        new TWEEN.Tween(mesh.position).to({ y: p.y - 8 }, 420).start();
    });
    needsRender = true;
}
function dust(x, y, z) {
    for (let i = 0; i < 6; i++) {
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), matSand);
        chunk.position.set(x, y, z); groupFX.add(chunk);
        const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 7;
        new TWEEN.Tween(chunk.position).to({ x: x + Math.cos(a) * d, y: y + 4 + Math.random() * 4, z: z + Math.sin(a) * d }, 240)
            .chain(new TWEEN.Tween(chunk.position).to({ y: y - 2 }, 240).onComplete(() => { groupFX.remove(chunk); needsRender = true; })).start();
    }
}
function colVictory(color) { needsRender = true; }

function colRebuild() {
    stoneMeshes.forEach(m => groupStones.remove(m)); stoneMeshes.clear();
    while (groupHi.children.length) groupHi.remove(groupHi.children[0]);
    while (groupFX.children.length) groupFX.remove(groupFX.children[0]);
    clearHover();
    colSync3D(); colUpdateViews();
}

// ============================================
// INTERACTION
// ============================================
function pickCell(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...groupStones.children, ...groupPads.children], true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && o.userData.cell === undefined && o.userData.id === undefined && o.parent) o = o.parent;
    if (o && o.userData.cell !== undefined) return o.userData.cell;
    if (o && o.userData.id !== undefined) {
        const st = window.getColState(); const s = st.stones.find(x => x.id === o.userData.id);
        return s ? s.cell : null;
    }
    return null;
}
function onPointerDown(event) {
    if (!window.is3DView) return;
    const st = window.getColState ? window.getColState() : null;
    if (!st || st.busy || st.gameOver) return;
    const cell = pickCell(event);
    if (cell !== null && window.colTap) window.colTap(cell);
}
function clearHover() {
    if (hoverCell === null) return;
    hoverCell = null;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    if (renderer) renderer.domElement.style.cursor = 'default';
    needsRender = true;
}
function onPointerMove(event) {
    if (!window.is3DView) return;
    const st = window.getColState ? window.getColState() : null;
    const cell = (st && !st.busy && !st.gameOver) ? pickCell(event) : null;
    if (cell === hoverCell) return;
    hoverCell = cell;
    while (groupHover.children.length) groupHover.remove(groupHover.children[0]);
    renderer.domElement.style.cursor = (cell !== null) ? 'pointer' : 'default';
    if (cell !== null) {
        const p = cellPos(cell);
        const ring = new THREE.Mesh(new THREE.RingGeometry(8, 9.6, 24), matHover);
        ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, p.y + 0.9, p.z);
        groupHover.add(ring);
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
window.colSync3D = colSync3D;
window.colUpdateViews = colUpdateViews;
window.colRebuild = colRebuild;
window.colAnimMove = colAnimMove;
window.colAnimRemove = colAnimRemove;
window.colVictory = colVictory;

document.addEventListener('DOMContentLoaded', () => init3D());
