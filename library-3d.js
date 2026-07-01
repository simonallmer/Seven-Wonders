/**
 * Library 3D Visualization
 * Shared Sphere mode only — push the sphere to your study room entrance.
 */

const game = window.libraryGameInstance;

// --- DOM Elements ---
const canvasContainer = document.getElementById('canvas3d');
const statusText = document.getElementById('status-text');
const playerColorBox = document.getElementById('player-color');

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1f14);
scene.fog = new THREE.FogExp2(0x2a1f14, 0.012);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
canvasContainer.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 10;
controls.maxDistance = 50;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffeedd, 0.25);
scene.add(ambientLight);

const fillLight = new THREE.DirectionalLight(0xffcc88, 0.4);
fillLight.position.set(-10, 20, 10);
scene.add(fillLight);

const moonLight = new THREE.DirectionalLight(0xffeecc, 1.0);
moonLight.position.set(20, 40, -20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 100;
moonLight.shadow.camera.left = -20;
moonLight.shadow.camera.right = 20;
moonLight.shadow.camera.top = 20;
moonLight.shadow.camera.bottom = -20;
moonLight.shadow.bias = -0.0005;
scene.add(moonLight);

const addTorch = (x, z) => {
    const light = new THREE.PointLight(0xffaa55, 1.5, 20);
    light.position.set(x, 3, z);
    light.castShadow = true;
    scene.add(light);
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa55 })
    );
    mesh.position.set(x, 3, z);
    scene.add(mesh);
};

// --- Materials ---
const floorTileMat1 = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.85, metalness: 0.05 });
const floorTileMat2 = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.85, metalness: 0.05 });
const cellMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 });
const roomMat = new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.8 });
const activeCellMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.3 });
const directionMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, transparent: true, opacity: 0.3 });
const wallSelectedMat = new THREE.MeshStandardMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });

// --- Environment ---
const courtyardGroup = new THREE.Group();
scene.add(courtyardGroup);

const floorGroup = new THREE.Group();
courtyardGroup.add(floorGroup);
const TILE_COUNT = 8;
const FLOOR_SIZE = 40;
const tileDim = FLOOR_SIZE / TILE_COUNT;
for (let tr = 0; tr < TILE_COUNT; tr++) {
    for (let tc = 0; tc < TILE_COUNT; tc++) {
        const mat = (tr + tc) % 2 === 0 ? floorTileMat1 : floorTileMat2;
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(tileDim - 0.1, tileDim - 0.1), mat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(-FLOOR_SIZE / 2 + tileDim / 2 + tc * tileDim, 0, -FLOOR_SIZE / 2 + tileDim / 2 + tr * tileDim);
        tile.receiveShadow = true;
        floorGroup.add(tile);
    }
}

const createStudyRoom = (x, z, rot) => {
    const roomGroup = new THREE.Group();
    roomGroup.position.set(x, 0, z);
    roomGroup.rotation.y = rot;
    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), roomMat);
    base.position.y = 0.25;
    base.receiveShadow = true;
    roomGroup.add(base);
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 4, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.7 });
    [-3, 3].forEach(offX => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(offX, 2.2, 2.8);
        pillar.castShadow = true;
        roomGroup.add(pillar);
    });
    addTorch(x, z);
    return roomGroup;
};

courtyardGroup.add(createStudyRoom(0, -12, 0));
courtyardGroup.add(createStudyRoom(0, 12, Math.PI));
courtyardGroup.add(createStudyRoom(12, 0, -Math.PI/2));
courtyardGroup.add(createStudyRoom(-12, 0, Math.PI/2));

// --- Board ---
const TILE_SIZE = 1.6;
const GAP_SIZE = 0.4;
const BOARD_OFFSET = (BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * GAP_SIZE) / 2;

const cellMeshes = [];
const plateMeshes = {};
const hWallTriggers = [];
const vWallTriggers = [];
const hWallMeshes = {};
const vWallMeshes = {};
const goalMarkers = {};

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const getPos = (r, c) => {
    const x = c * (TILE_SIZE + GAP_SIZE) - BOARD_OFFSET + TILE_SIZE / 2;
    const z = r * (TILE_SIZE + GAP_SIZE) - BOARD_OFFSET + TILE_SIZE / 2;
    return { x, z };
};

for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const { x, z } = getPos(r, c);
        const cellBase = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.1, TILE_SIZE), cellMat);
        cellBase.position.set(x, 0.05, z);
        cellBase.receiveShadow = true;
        boardGroup.add(cellBase);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE), new THREE.MeshBasicMaterial({ visible: false }));
        trigger.position.set(x, 0.25, z);
        trigger.userData = { type: 'cell', r, c };
        cellMeshes.push(trigger);
        boardGroup.add(trigger);

        const highlight = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE), activeCellMat);
        highlight.position.set(x, 0.2, z);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

for (let r = 0; r < BOARD_SIZE - 1; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const { x, z } = getPos(r, c);
        const zOff = z + TILE_SIZE/2 + GAP_SIZE/2;
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 1, GAP_SIZE), new THREE.MeshBasicMaterial({ visible: false }));
        trigger.position.set(x, 0.5, zOff);
        trigger.userData = { type: 'hWall', r, c };
        hWallTriggers.push(trigger);
        boardGroup.add(trigger);

        const highlight = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.2, GAP_SIZE), activeCellMat);
        highlight.position.set(x, 0.2, zOff);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
        const { x, z } = getPos(r, c);
        const xOff = x + TILE_SIZE/2 + GAP_SIZE/2;
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(GAP_SIZE, 1, TILE_SIZE), new THREE.MeshBasicMaterial({ visible: false }));
        trigger.position.set(xOff, 0.5, z);
        trigger.userData = { type: 'vWall', r, c };
        vWallTriggers.push(trigger);
        boardGroup.add(trigger);

        const highlight = new THREE.Mesh(new THREE.BoxGeometry(GAP_SIZE, 0.2, TILE_SIZE), activeCellMat);
        highlight.position.set(xOff, 0.2, z);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

// Direction indicator meshes for wall actions
const directionArrows = [];
function createDirectionArrow() {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7 })
    );
    shaft.position.x = 0.3;
    group.add(shaft);
    const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.2, 6),
        new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7 })
    );
    head.position.x = 0.65;
    head.rotation.z = -Math.PI / 2;
    group.add(head);
    group.visible = false;
    return group;
}

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function updateVisuals() {
    cellMeshes.forEach(m => { m.userData.highlight.visible = false; });
    hWallTriggers.forEach(m => m.userData.highlight.visible = false);
    vWallTriggers.forEach(m => m.userData.highlight.visible = false);
    directionArrows.forEach(a => a.visible = false);

    if (game.winner) return;

    if (game.interactionState === 'SPHERE_SELECTED') {
        const { x, z } = getPos(game.sharedSphere.r, game.sharedSphere.c);
        showArrow(x - TILE_SIZE/2 - GAP_SIZE/2, 0.3, z, 0, Math.PI, 0);
        showArrow(x + TILE_SIZE/2 + GAP_SIZE/2, 0.3, z, 0, 0, 0);
        showArrow(x, 0.3, z - TILE_SIZE/2 - GAP_SIZE/2, Math.PI/2, 0, 0);
        showArrow(x, 0.3, z + TILE_SIZE/2 + GAP_SIZE/2, -Math.PI/2, 0, 0);
        return;
    }

    if (game.interactionState === 'WALL_SELECTED' && game.selectedWall) {
        const sw = game.selectedWall;
        const { x, z } = getPos(sw.r, sw.c);
        if (sw.type === 'h') {
            const cz = z + TILE_SIZE/2 + GAP_SIZE/2;
            showArrow(x - TILE_SIZE/2 - GAP_SIZE/2, 0.3, cz, 0, 0, 0);
            showArrow(x + TILE_SIZE/2 + GAP_SIZE/2, 0.3, cz, Math.PI, 0, 0);
            showArrow(x, 0.3, z, Math.PI/2, 0, 0);
            showArrow(x, 0.3, z + TILE_SIZE + GAP_SIZE, -Math.PI/2, 0, 0);
        } else {
            const cx = x + TILE_SIZE/2 + GAP_SIZE/2;
            showArrow(cx, 0.3, z - TILE_SIZE/2 - GAP_SIZE/2, 0, 0, 0);
            showArrow(cx, 0.3, z + TILE_SIZE/2 + GAP_SIZE/2, 0, 0, Math.PI);
            showArrow(x, 0.3, z, 0, 0, -Math.PI/2);
            showArrow(x + TILE_SIZE + GAP_SIZE, 0.3, z, 0, 0, Math.PI/2);
        }
        return;
    }
}

function showArrow(x, y, z, rx, ry, rz) {
    const arrow = directionArrows.find(a => !a.visible);
    if (!arrow) return;
    arrow.position.set(x, y, z);
    arrow.rotation.set(rx, ry, rz);
    arrow.visible = true;
}

// --- Pointer Move (Hover) ---
function onPointerMove(event) {
    if (game.winner || isAiTurn) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    cellMeshes.forEach(m => m.userData.highlight.visible = false);
    hWallTriggers.forEach(m => m.userData.highlight.visible = false);
    vWallTriggers.forEach(m => m.userData.highlight.visible = false);

    raycaster.setFromCamera(mouse, camera);

    let interactables = [];
    if (game.interactionState === 'WALL_SELECTED' || game.interactionState === 'SPHERE_SELECTED') {
        interactables = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    } else {
        interactables = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    }

    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length === 0) return;

    const obj = intersects[0].object;
    const u = obj.userData;

    let isValid = false;

    if (game.interactionState === 'IDLE') {
        if (u.type === 'cell' && !game.fields[u.r][u.c]) isValid = true;
        if (u.type === 'cell' && u.r === game.sharedSphere.r && u.c === game.sharedSphere.c) isValid = true;
        if (u.type === 'hWall' && !game.hWalls[u.r][u.c]) isValid = true;
        if (u.type === 'vWall' && !game.vWalls[u.r][u.c]) isValid = true;
        if (u.type === 'hWall' && game.hWalls[u.r][u.c] === game.currentPlayer) isValid = true;
        if (u.type === 'vWall' && game.vWalls[u.r][u.c] === game.currentPlayer) isValid = true;
    } else if (game.interactionState === 'WALL_SELECTED') {
        if (u.type === 'cell' || u.type === 'hWall' || u.type === 'vWall') isValid = true;
    } else if (game.interactionState === 'SPHERE_SELECTED') {
        if (u.type === 'cell') {
            const dr = u.r - game.sharedSphere.r;
            const dc = u.c - game.sharedSphere.c;
            if ((dr === 0 && Math.abs(dc) === 1) || (dc === 0 && Math.abs(dr) === 1)) isValid = true;
        }
    }

    if (isValid && u.highlight) {
        u.highlight.visible = true;
    }
}

// --- Pointer Click ---
let pointerDownPos = { x: 0, y: 0 };
window.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
});

window.addEventListener('pointerup', (e) => {
    if (isAiTurn) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.sqrt(dx*dx + dy*dy) < 5) {
        onPointerClick(e);
    }
});

function onPointerClick(event) {
    if (event.target !== renderer.domElement) return;
    if (game.winner) return;

    raycaster.setFromCamera(mouse, camera);

    let allInteractables = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    const intersects = raycaster.intersectObjects(allInteractables);

    if (intersects.length === 0) {
        if (game.interactionState === 'WALL_SELECTED') {
            game.interactionState = 'IDLE';
            game.selectedWall = null;
            game.trigger('onWallDeselected', {});
            updateVisuals();
        } else if (game.interactionState === 'SPHERE_SELECTED') {
            game.interactionState = 'IDLE';
            game.trigger('onSphereDeselected', {});
            updateVisuals();
        }
        return;
    }

    const u = intersects[0].object.userData;

    if (game.interactionState === 'WALL_SELECTED' && game.selectedWall) {
        const sw = game.selectedWall;

        if (u.type === 'cell') {
            let direction = null;
            if (sw.type === 'h') {
                if (u.r === sw.r && u.c === sw.c) direction = 'up';
                else if (u.r === sw.r + 1 && u.c === sw.c) direction = 'down';
            } else {
                if (u.r === sw.r && u.c === sw.c) direction = 'left';
                else if (u.r === sw.r && u.c === sw.c + 1) direction = 'right';
            }
            if (direction) {
                game.handleWallDirection(direction);
            } else {
                game.log('Click a cell adjacent to the wall to topple it.');
            }
            updateVisuals();
            return;
        }

        if ((u.type === 'hWall' || u.type === 'vWall') && !(u.r === sw.r && u.c === sw.c && ((u.type === 'hWall' && sw.type === 'h') || (u.type === 'vWall' && sw.type === 'v')))) {
            const wt = u.type === 'hWall' ? 'h' : 'v';
            let direction = null;
            if (sw.type === 'h' && wt === 'h' && sw.r === u.r) {
                if (u.c === sw.c - 1) direction = 'left';
                else if (u.c === sw.c + 1) direction = 'right';
            } else if (sw.type === 'v' && wt === 'v' && sw.c === u.c) {
                if (u.r === sw.r - 1) direction = 'up';
                else if (u.r === sw.r + 1) direction = 'down';
            }
            if (direction) {
                game.handleWallDirection(direction);
            } else {
                game.log('Click an adjacent gap to push the wall.');
            }
            updateVisuals();
            return;
        }

        if ((u.type === 'hWall' && u.r === sw.r && u.c === sw.c && sw.type === 'h') ||
            (u.type === 'vWall' && u.r === sw.r && u.c === sw.c && sw.type === 'v')) {
            const { x, z } = getPos(u.r, u.c);
            let cx, cz;
            if (u.type === 'hWall') {
                cx = x;
                cz = z + TILE_SIZE/2 + GAP_SIZE/2;
            } else {
                cx = x + TILE_SIZE/2 + GAP_SIZE/2;
                cz = z;
            }
            const clickX = intersects[0].point.x;
            const clickZ = intersects[0].point.z;

            let direction;
            if (u.type === 'hWall') {
                if (Math.abs(clickX - cx) > Math.abs(clickZ - cz)) {
                    direction = clickX < cx ? 'left' : 'right';
                } else {
                    direction = clickZ < cz ? 'up' : 'down';
                }
            } else {
                if (Math.abs(clickZ - cz) > Math.abs(clickX - cx)) {
                    direction = clickZ < cz ? 'up' : 'down';
                } else {
                    direction = clickX < cx ? 'left' : 'right';
                }
            }
            game.handleWallDirection(direction);
            updateVisuals();
            return;
        }

        game.interactionState = 'IDLE';
        game.selectedWall = null;
        game.trigger('onWallDeselected', {});
        updateVisuals();
        return;
    }

    // SPHERE_SELECTED state: click adjacent cell to push
    if (game.interactionState === 'SPHERE_SELECTED') {
        const sphere = game.sharedSphere;
        if (u.type === 'cell') {
            const dr = u.r - sphere.r;
            const dc = u.c - sphere.c;
            if ((dr === 0 && Math.abs(dc) === 1) || (dc === 0 && Math.abs(dr) === 1)) {
                game.doPushSphere(Math.sign(dr), Math.sign(dc));
            } else {
                game.interactionState = 'IDLE';
                game.trigger('onSphereDeselected', {});
                game.log('Click a cell adjacent to the sphere to push it.');
            }
        } else {
            game.interactionState = 'IDLE';
            game.trigger('onSphereDeselected', {});
        }
        updateVisuals();
        return;
    }

    // Normal dispatch
    if (game.controlScheme === 'classic') {
        classicHandleClick(u);
        updateVisuals();
        return;
    }

    if (u.type === 'cell') {
        game.handleCellClick(u.r, u.c);
    } else if (u.type === 'hWall') {
        game.handleWallClick('h', u.r, u.c);
    } else if (u.type === 'vWall') {
        game.handleWallClick('v', u.r, u.c);
    }
    updateVisuals();
}

window.addEventListener('pointermove', onPointerMove);
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Visual Helpers ---
function createPlate(r, c, owner) {
    const { x, z } = getPos(r, c);
    const bookGroup = new THREE.Group();
    bookGroup.position.set(x, 0, z);

    const ownerColors = [0xf8f8f8, 0x2a2a2a, 0xcc3333, 0x3366cc];
    const col = owner === FOUNTAIN ? 0x4488ff : ownerColors[owner % ownerColors.length];

    const cover = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.15, 0.08, TILE_SIZE - 0.1),
        new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 })
    );
    cover.position.y = 0.04;
    cover.castShadow = true;
    cover.receiveShadow = true;
    bookGroup.add(cover);

    const pages = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.3, 0.12, TILE_SIZE - 0.2),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
    );
    pages.position.y = 0.14;
    pages.castShadow = true;
    bookGroup.add(pages);

    const spine = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.18, TILE_SIZE - 0.2),
        new THREE.MeshStandardMaterial({ color: 0x3d2010, roughness: 0.9 })
    );
    spine.position.set(-(TILE_SIZE / 2 - 0.15), 0.15, 0);
    bookGroup.add(spine);

    boardGroup.add(bookGroup);
    plateMeshes[`${r}_${c}`] = bookGroup;

    bookGroup.scale.set(0.1, 0.1, 0.1);
    new TWEEN.Tween(bookGroup.scale)
        .to({ x: 1, y: 1, z: 1 }, 400)
        .easing(TWEEN.Easing.Back.Out)
        .start();
}

function createWall(type, r, c, owner) {
    const { x, z } = getPos(r, c);
    const ownerColors = [0xf8f8f8, 0x2a2a2a, 0xcc3333, 0x3366cc];
    const col = ownerColors[(owner || 0) % ownerColors.length];

    let geo, meshX, meshZ;
    if (type === 'h') {
        geo = new THREE.BoxGeometry(TILE_SIZE, 2, GAP_SIZE - 0.1);
        meshX = x;
        meshZ = z + TILE_SIZE/2 + GAP_SIZE/2;
    } else {
        geo = new THREE.BoxGeometry(GAP_SIZE - 0.1, 2, TILE_SIZE);
        meshX = x + TILE_SIZE/2 + GAP_SIZE/2;
        meshZ = z;
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.1 });
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(meshX, 1, meshZ);
    wall.castShadow = true;
    wall.receiveShadow = true;
    boardGroup.add(wall);

    if (type === 'h') hWallMeshes[`${r}_${c}`] = wall;
    else vWallMeshes[`${r}_${c}`] = wall;

    wall.position.y = 5;
    new TWEEN.Tween(wall.position)
        .to({ y: 1 }, 500)
        .easing(TWEEN.Easing.Bounce.Out)
        .start();
}

// --- Shared Sphere ---
let sharedSphereMesh = null;

function createSharedSphere() {
    if (sharedSphereMesh) scene.remove(sharedSphereMesh);

    const mat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.1,
        metalness: 0.4,
        emissive: 0x4488ff,
        emissiveIntensity: 0.15,
    });
    const geo = new THREE.SphereGeometry(0.55, 24, 24);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const { x, z } = getPos(CENTER, CENTER);
    mesh.position.set(x, 0.55, z);
    scene.add(mesh);
    sharedSphereMesh = mesh;
}

function createEntranceMarkers() {
    Object.values(goalMarkers).forEach(m => boardGroup.remove(m));
    for (let key in goalMarkers) delete goalMarkers[key];

    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
    });
    const ringGeo = new THREE.RingGeometry(0.3, 0.6, 24);

    game.players.forEach(p => {
        const e = p.entrance;
        const key = `${e.r}_${e.c}`;
        if (goalMarkers[key]) return;
        const { x, z } = getPos(e.r, e.c);
        const marker = new THREE.Mesh(ringGeo, ringMat.clone());
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(x, 0.15, z);
        boardGroup.add(marker);
        goalMarkers[key] = marker;
    });
}

document.getElementById('btn-p2').onclick = (e) => startNewGame(2, e.target);
document.getElementById('btn-p3').onclick = (e) => startNewGame(3, e.target);
document.getElementById('btn-p4').onclick = (e) => startNewGame(4, e.target);
document.getElementById('reset-button').onclick = () => startNewGame(game.numPlayers, null);
document.getElementById('modal-new-game').onclick = () => startNewGame(game.numPlayers, null);

function startNewGame(pCount, btnElem) {
    document.getElementById('game-over-modal').classList.add('hidden');
    if (btnElem) {
        document.querySelectorAll('#players-menu button').forEach(b => b.classList.remove('active'));
        btnElem.classList.add('active');
        document.getElementById('players-btn').innerText = `${pCount} Players`;
    }

    Object.values(plateMeshes).forEach(m => boardGroup.remove(m));
    Object.values(hWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(vWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(goalMarkers).forEach(m => boardGroup.remove(m));
    if (sharedSphereMesh) { scene.remove(sharedSphereMesh); sharedSphereMesh = null; }

    for (let key in plateMeshes) delete plateMeshes[key];
    for (let key in hWallMeshes) delete hWallMeshes[key];
    for (let key in vWallMeshes) delete vWallMeshes[key];
    for (let key in goalMarkers) delete goalMarkers[key];

    game.initGame(pCount);
}

// --- Game Event Listeners ---
game.on('onInit', (data) => {
    createSharedSphere();
    createEntranceMarkers();

    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            if (data.fields[r][c] !== null) createPlate(r, c, data.fields[r][c]);

    const modeLabel = document.getElementById('mode-label');
    if (modeLabel) modeLabel.textContent = 'Shared Sphere';
    updateVisuals();

    const panel = document.getElementById('action-panel');
    if (panel) {
        panel.style.display = game.controlScheme === 'classic' ? 'flex' : 'none';
    }
    const schemeBtn = document.getElementById('scheme-btn');
    if (schemeBtn) {
        schemeBtn.textContent = 'Controls: ' + (game.controlScheme === 'adaptive' ? 'Adaptive' : 'Classic');
    }
    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
    const actionMap = { LAY: 'btn-action-lay', MOVE: 'btn-action-move', PUSH: 'btn-action-push', TOPPLE: 'btn-action-topple', PUSH_SPHERE: 'btn-action-push-sphere' };
    const actionEl = document.getElementById(actionMap[game.selectedAction]);
    if (actionEl) actionEl.classList.add('active');
});

game.on('onTurnStart', (data) => {
    statusText.innerText = `${data.player.name} to move`;
    playerColorBox.style.backgroundColor = '#' + data.player.colorHex.toString(16).padStart(6, '0');

    directionArrows.forEach(a => { a.visible = false; a.userData = {}; });
    updateVisuals();
});

game.on('onWallSelected', () => {
    updateVisuals();
});

game.on('onWallDeselected', () => {
    directionArrows.forEach(a => { a.visible = false; a.userData = {}; });
    updateVisuals();
});

game.on('onSphereSelected', () => {
    updateVisuals();
});

game.on('onSphereDeselected', () => {
    directionArrows.forEach(a => { a.visible = false; a.userData = {}; });
    updateVisuals();
});

game.on('onSphereMoved', (data) => {
    if (sharedSphereMesh) {
        const { x, z } = getPos(data.r, data.c);
        sharedSphereMesh.position.set(x, 0.55, z);
    }
});

game.on('onControlSchemeChanged', (scheme) => {
    const panel = document.getElementById('action-panel');
    if (panel) {
        panel.style.display = scheme === 'classic' ? 'flex' : 'none';
    }
    const schemeBtn = document.getElementById('scheme-btn');
    if (schemeBtn) {
        schemeBtn.textContent = 'Controls: ' + (scheme === 'adaptive' ? 'Adaptive' : 'Classic');
    }
    game.interactionState = 'IDLE';
    game.selectedWall = null;
    directionArrows.forEach(a => a.visible = false);
    updateVisuals();
});

game.on('onActionChanged', (action) => {
    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
    const map = { LAY: 'btn-action-lay', MOVE: 'btn-action-move', PUSH: 'btn-action-push', TOPPLE: 'btn-action-topple', PUSH_SPHERE: 'btn-action-push-sphere' };
    const el = document.getElementById(map[action]);
    if (el) el.classList.add('active');
    game.interactionState = 'IDLE';
    game.selectedWall = null;
    directionArrows.forEach(a => a.visible = false);
    updateVisuals();
});

game.on('onPlateLaid', (data) => {
    const key = `${data.r}_${data.c}`;
    const existing = plateMeshes[key];
    if (existing) {
        boardGroup.remove(existing);
        delete plateMeshes[key];
    }
    createPlate(data.r, data.c, data.owner);
});

game.on('onWallLaid', (data) => {
    createWall(data.type, data.r, data.c, data.owner);
});

game.on('onWallMoved', (data) => {
    const keyOld = data.type === 'h' ? `${data.r}_${data.oldC}` : `${data.oldR}_${data.c}`;
    const keyNew = data.type === 'h' ? `${data.r}_${data.newC}` : `${data.newR}_${data.c}`;

    let mesh;
    if (data.type === 'h') {
        mesh = hWallMeshes[keyOld];
        delete hWallMeshes[keyOld];
        hWallMeshes[keyNew] = mesh;
    } else {
        mesh = vWallMeshes[keyOld];
        delete vWallMeshes[keyOld];
        vWallMeshes[keyNew] = mesh;
    }

    const { x, z } = getPos(data.type === 'h' ? data.r : data.newR, data.type === 'h' ? data.newC : data.c);
    let targetX = data.type === 'h' ? x : x + TILE_SIZE/2 + GAP_SIZE/2;
    let targetZ = data.type === 'h' ? z + TILE_SIZE/2 + GAP_SIZE/2 : z;

    new TWEEN.Tween(mesh.position)
        .to({ x: targetX, z: targetZ }, 300)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
});

game.on('onWallToppled', (data) => {
    const key = `${data.r}_${data.c}`;
    let mesh = data.type === 'h' ? hWallMeshes[key] : vWallMeshes[key];
    if (!mesh) return;

    if (data.type === 'h') delete hWallMeshes[key];
    else delete vWallMeshes[key];

    let rotAxis = data.type === 'h' ? 'x' : 'z';
    let rotDir = (data.dir === 'up' || data.dir === 'right') ? -1 : 1;

    new TWEEN.Tween(mesh.rotation)
        .to({ [rotAxis]: (Math.PI / 2) * rotDir }, 400)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => boardGroup.remove(mesh))
        .start();
});

game.on('onGameOver', (data) => {
    document.getElementById('modal-title').innerText = "Game Over!";
    document.getElementById('modal-text').innerText = `${data.winner.name} guided the sphere to their study room!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
});

game.on('onMessage', (msg) => {
    // Suppressed for clean UI
});

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    renderer.render(scene, camera);
}

// --- Classic Mode ---
function classicHandleClick(u) {
    const action = game.selectedAction;

    if (u.type === 'cell') {
        if (action === 'LAY') {
            if (game.fields[u.r][u.c] === null) {
                game.doPlace(u.r, u.c);
            } else {
                game.log("Can't place a plate there.");
            }
            return;
        }

        if (action === 'MOVE') {
            game.log("There are no figures to move in Shared Sphere mode.");
            return;
        }

        if (action === 'PUSH_SPHERE') {
            if (u.r === game.sharedSphere.r && u.c === game.sharedSphere.c) {
                game.interactionState = 'SPHERE_SELECTED';
                game.trigger('onSphereSelected', {});
                game.log('Sphere selected. Click a direction to push it.');
            } else {
                game.log("That's not the sphere.");
            }
            return;
        }

        game.log("Select a wall for this action.");
        return;
    }

    if (u.type === 'hWall' || u.type === 'vWall') {
        const type = u.type === 'hWall' ? 'h' : 'v';
        const wall = (type === 'h') ? game.hWalls[u.r][u.c] : game.vWalls[u.r][u.c];

        if (action === 'LAY') {
            if (wall === null) {
                game.doLayWall(type, u.r, u.c);
            } else {
                game.log("Can't place a wall there.");
            }
            return;
        }

        if (action === 'MOVE' || action === 'PUSH_SPHERE') {
            game.log("Select a figure for this action.");
            return;
        }

        classicWallClick(u, type, wall);
        return;
    }
}

function classicWallClick(u, type, wall) {
    if (wall !== game.currentPlayer) {
        game.log("That's not your wall.");
        return;
    }

    game.interactionState = 'WALL_SELECTED';
    game.selectedWall = { type, r: u.r, c: u.c };
    game.trigger('onWallSelected', { type, r: u.r, c: u.c, player: game.players[game.currentPlayer] });
}

// --- AI Opponent ---
let opponentType = 'computer';
let isAiTurn = false;
let ai = null;
let aiTimeout = null;

function setOpponentType(type) {
    opponentType = type;
    document.getElementById('opponent-btn').innerText = `Opponent: ${type === 'computer' ? 'Computer' : 'Human'}`;

    document.querySelectorAll('#opponent-menu button').forEach(b => b.classList.remove('active'));
    const target = document.querySelector(`#opponent-menu button[data-opp="${type}"]`);
    if (target) target.classList.add('active');

    startNewGame(game.numPlayers, null);
}

document.querySelectorAll('#opponent-menu button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opp = btn.dataset.opp;
        if (opp) setOpponentType(opp);
    });
});

const _origStartNewGame = startNewGame;
startNewGame = function(pCount, btnElem) {
    if (aiTimeout) clearTimeout(aiTimeout);
    isAiTurn = false;
    if (pCount > 2 && opponentType === 'computer') {
        opponentType = 'human';
        document.getElementById('opponent-btn').innerText = 'Opponent: Human';
        document.querySelectorAll('#opponent-menu button').forEach(b => b.classList.remove('active'));
        const target = document.querySelector('#opponent-menu button[data-opp="human"]');
        if (target) target.classList.add('active');
    }
    _origStartNewGame(pCount, btnElem);
};

class LibraryAI {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
    }

    takeTurn() {
        if (aiTimeout) clearTimeout(aiTimeout);
        isAiTurn = true;
        aiTimeout = setTimeout(() => this.think(), 600);
    }

    think() {
        isAiTurn = false;
        const player = this.game.players[this.playerId];
        this.thinkSharedSphere(player);
    }

    thinkSharedSphere(player) {
        if (this.tryPushSphereTowardEntrance(player)) return;
        if (this.tryPlaceTowardEntrance(player)) return;
        if (this.tryBlockRolling(player)) return;
        this.layAnywhere(player);
    }

    tryPushSphereTowardEntrance(player) {
        const entrance = player.entrance;
        const sphere = this.game.sharedSphere;

        const dr = entrance.r - sphere.r;
        const dc = entrance.c - sphere.c;

        const candidates = [];
        if (dr !== 0) candidates.push({ dirR: dr > 0 ? 1 : -1, dirC: 0 });
        if (dc !== 0) candidates.push({ dirR: 0, dirC: dc > 0 ? 1 : -1 });

        for (const { dirR, dirC } of candidates) {
            const nr = sphere.r + dirR;
            const nc = sphere.c + dirC;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            if (dirR !== 0) {
                if (this.game.hWalls[Math.min(sphere.r, nr)][sphere.c] !== null) continue;
            } else {
                if (this.game.vWalls[sphere.r][Math.min(sphere.c, nc)] !== null) continue;
            }
            if (this.game.fields[nr][nc] === null) continue;
            this.game.doPushSphere(dirR, dirC);
            return true;
        }
        return false;
    }

    tryPlaceTowardEntrance(player) {
        const entrance = player.entrance;
        const sphere = this.game.sharedSphere;
        const dr = entrance.r - sphere.r;
        const dc = entrance.c - sphere.c;

        const candidates = [];
        if (dr !== 0) candidates.push({ r: sphere.r + (dr > 0 ? 1 : -1), c: sphere.c });
        if (dc !== 0) candidates.push({ r: sphere.r, c: sphere.c + (dc > 0 ? 1 : -1) });

        for (const { r, c } of candidates) {
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.game.fields[r][c] === null) {
                this.game.doPlace(r, c);
                return true;
            }
        }
        return false;
    }

    tryBlockRolling(player) {
        const opponent = this.game.players.find(p => p.id !== player.id);
        if (!opponent || !opponent.entrance) return false;

        const sphere = this.game.sharedSphere;
        const e = opponent.entrance;
        const midR = Math.round((sphere.r + e.r) / 2);
        const midC = Math.round((sphere.c + e.c) / 2);

        if (midR >= 0 && midR < BOARD_SIZE - 1 && midC >= 0 && midC < BOARD_SIZE) {
            if (this.game.hWalls[midR][midC] === null) {
                this.game.doLayWall('h', midR, midC);
                return true;
            }
        }
        if (midR >= 0 && midR < BOARD_SIZE && midC >= 0 && midC < BOARD_SIZE - 1) {
            if (this.game.vWalls[midR][midC] === null) {
                this.game.doLayWall('v', midR, midC);
                return true;
            }
        }
        return false;
    }

    layAnywhere(player) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.game.fields[r][c] === null) {
                    this.game.doPlace(r, c);
                    return;
                }
            }
        }
        for (let r = 0; r < BOARD_SIZE - 1; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.game.hWalls[r][c] === null) {
                    this.game.doLayWall('h', r, c);
                    return;
                }
            }
        }
        this.game.endTurn();
    }
}

game.on('onTurnStart', (data) => {
    if (opponentType === 'computer' && data.player.id === 1 && !game.winner) {
        if (!ai) ai = new LibraryAI(game, 1);
        ai.takeTurn();
    }
});

for (let i = 0; i < 8; i++) {
    const arrow = createDirectionArrow();
    boardGroup.add(arrow);
    directionArrows.push(arrow);
}

game.initGame(2);
animate();
