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
scene.background = new THREE.Color(0xf3d9a4);
scene.fog = new THREE.FogExp2(0xf3d9a4, 0.01);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 32, 34);

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
const ambientLight = new THREE.AmbientLight(0xfff2da, 0.55);
scene.add(ambientLight);

const skyFill = new THREE.HemisphereLight(0xbfe3ff, 0xcaa96a, 0.55);
scene.add(skyFill);

const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.25);
sunLight.position.set(24, 42, 18);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -24;
sunLight.shadow.camera.right = 24;
sunLight.shadow.camera.top = 24;
sunLight.shadow.camera.bottom = -24;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const addLamp = (x, z) => {
    const light = new THREE.PointLight(0xffcc88, 0.5, 10);
    light.position.set(x, 3.2, z);
    scene.add(light);
    const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.6, metalness: 0.4 })
    );
    post.position.set(x, 1.6, z);
    post.castShadow = true;
    scene.add(post);
    const lantern = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffaa33, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.6 })
    );
    lantern.position.set(x, 3.05, z);
    scene.add(lantern);
};

// --- Materials ---
const floorTileMat1 = new THREE.MeshStandardMaterial({ color: 0xc3a878, roughness: 0.85, metalness: 0.05 });
const floorTileMat2 = new THREE.MeshStandardMaterial({ color: 0xb39764, roughness: 0.85, metalness: 0.05 });
const cellMat = new THREE.MeshStandardMaterial({ color: 0xa38a5c, roughness: 0.9 });
const activeCellMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.3 });
const directionMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, transparent: true, opacity: 0.3 });
const wallSelectedMat = new THREE.MeshStandardMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
const tileTrimMat = new THREE.MeshStandardMaterial({ color: 0x2f7a8c, roughness: 0.4, metalness: 0.15 });
const domeMat = new THREE.MeshStandardMaterial({ color: 0x2f7a8c, roughness: 0.3, metalness: 0.2 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.35, metalness: 0.75 });
const wallBrickMat = new THREE.MeshStandardMaterial({ color: 0xc9ac7c, roughness: 0.88 });
const plinthMat = new THREE.MeshStandardMaterial({ color: 0xa38a5c, roughness: 0.9 });
const archDarkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });

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

const createLibraryPavilion = (x, z, rot) => {
    const roomGroup = new THREE.Group();
    roomGroup.position.set(x, 0, z);
    roomGroup.rotation.y = rot;

    // Raised plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, 6.4), plinthMat);
    plinth.position.y = 0.25;
    plinth.receiveShadow = true;
    roomGroup.add(plinth);

    // Main sandstone hall
    const hall = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.4, 5.4), wallBrickMat);
    hall.position.y = 0.5 + 1.7;
    hall.castShadow = true;
    hall.receiveShadow = true;
    roomGroup.add(hall);

    // Teal tile trim band just below the roofline (kept clear of the hall's top face to avoid z-fighting)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.3, 5.5), tileTrimMat);
    trim.position.y = 0.5 + 3.15;
    roomGroup.add(trim);

    // Crenellations (merlons) along the front and back roof edges
    for (let side = -1; side <= 1; side += 2) {
        for (let i = -2; i <= 2; i++) {
            const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), wallBrickMat);
            merlon.position.set(i * 1.3, 0.5 + 3.65, side * 2.6);
            merlon.castShadow = true;
            roomGroup.add(merlon);
        }
    }

    // Central drum + onion dome facing the courtyard
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.1, 16), wallBrickMat);
    drum.position.set(0, 0.5 + 3.95, 0);
    drum.castShadow = true;
    roomGroup.add(drum);

    const domeRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.1, 8, 24), brassMat);
    domeRing.rotation.x = Math.PI / 2;
    domeRing.position.set(0, 0.5 + 4.5, 0);
    roomGroup.add(domeRing);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), domeMat);
    dome.position.set(0, 0.5 + 4.5, 0);
    dome.castShadow = true;
    roomGroup.add(dome);

    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), brassMat);
    finial.position.set(0, 0.5 + 6.05, 0);
    roomGroup.add(finial);

    // Small corner turrets with matching mini-domes
    [[-3.2, -2.2], [3.2, -2.2], [-3.2, 2.2], [3.2, 2.2]].forEach(([tx, tz]) => {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 3.6, 10), wallBrickMat);
        turret.position.set(tx, 0.5 + 1.8, tz);
        turret.castShadow = true;
        roomGroup.add(turret);
        const turretDome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), domeMat);
        turretDome.position.set(tx, 0.5 + 3.7, tz);
        turretDome.castShadow = true;
        roomGroup.add(turretDome);
    });

    // Horseshoe-arch entrance recessed into the courtyard-facing wall
    const archRecess = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.3), archDarkMat);
    archRecess.position.set(0, 0.5 + 1.3, 2.75);
    roomGroup.add(archRecess);

    const archTop = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.28, 8, 16, Math.PI), archDarkMat);
    archTop.position.set(0, 0.5 + 2.6, 2.75);
    roomGroup.add(archTop);

    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 16, Math.PI), brassMat);
    archTrim.position.set(0, 0.5 + 2.6, 2.9);
    roomGroup.add(archTrim);

    [-1.1, 1.1].forEach(offX => {
        const jamb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.6, 10), wallBrickMat);
        jamb.position.set(offX, 0.5 + 1.3, 2.75);
        jamb.castShadow = true;
        roomGroup.add(jamb);
    });

    addLamp(x, z);
    return roomGroup;
};

courtyardGroup.add(createLibraryPavilion(0, -12, 0));
courtyardGroup.add(createLibraryPavilion(0, 12, Math.PI));
courtyardGroup.add(createLibraryPavilion(12, 0, -Math.PI/2));
courtyardGroup.add(createLibraryPavilion(-12, 0, Math.PI/2));

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

// --- Sphere move targets (lit destination tiles instead of direction arrows) ---
const sphereMoveMat = new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const sphereMoveMarkers = [];
function createSphereMoveMarker() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(TILE_SIZE * 0.3, TILE_SIZE * 0.44, 28), sphereMoveMat.clone());
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(TILE_SIZE * 0.14, 20), sphereMoveMat.clone());
    dot.rotation.x = -Math.PI / 2;
    group.add(dot);
    group.visible = false;
    boardGroup.add(group);
    return group;
}
for (let i = 0; i < 4; i++) sphereMoveMarkers.push(createSphereMoveMarker());

// Read-only replay of doPushSphere's slide rules — used to find where the sphere would land.
function simulateSpherePush(dirR, dirC) {
    let r = game.sharedSphere.r;
    let c = game.sharedSphere.c;
    while (true) {
        const nr = r + dirR, nc = c + dirC;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (dirR !== 0) {
            if (game.hWalls[Math.min(r, nr)][c] !== null) break;
        } else {
            if (game.vWalls[r][Math.min(c, nc)] !== null) break;
        }
        if (game.fields[nr][nc] === null) break;
        r = nr; c = nc;
    }
    if (r === game.sharedSphere.r && c === game.sharedSphere.c) return null;
    if (game._lastPushTurn >= 0) {
        const nextPlayer = (game._lastPushTurn + 1) % game.numPlayers;
        if (game.currentPlayer === nextPlayer && r === game._prevSpherePos.r && c === game._prevSpherePos.c) return null;
    }
    return { r, c };
}

let sphereMoveOptions = [];
function getSphereMoveOptions() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const options = [];
    dirs.forEach(([dirR, dirC]) => {
        const landing = simulateSpherePush(dirR, dirC);
        if (landing) options.push({ dirR, dirC, r: landing.r, c: landing.c });
    });
    return options;
}

function updateVisuals() {
    cellMeshes.forEach(m => { m.userData.highlight.visible = false; });
    hWallTriggers.forEach(m => m.userData.highlight.visible = false);
    vWallTriggers.forEach(m => m.userData.highlight.visible = false);
    directionArrows.forEach(a => a.visible = false);
    sphereMoveMarkers.forEach(m => m.visible = false);
    sphereMoveOptions = [];

    if (game.winner) return;

    if (game.interactionState === 'SPHERE_SELECTED') {
        sphereMoveOptions = getSphereMoveOptions();
        sphereMoveOptions.forEach((opt, i) => {
            const marker = sphereMoveMarkers[i];
            if (!marker) return;
            const { x, z } = getPos(opt.r, opt.c);
            marker.position.set(x, 0.4, z);
            marker.visible = true;
        });
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
            isValid = sphereMoveOptions.some(opt => opt.r === u.r && opt.c === u.c);
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

    // SPHERE_SELECTED state: click a lit destination tile to push the sphere there
    if (game.interactionState === 'SPHERE_SELECTED') {
        const sphere = game.sharedSphere;
        if (u.type === 'cell') {
            if (u.r === sphere.r && u.c === sphere.c) {
                game.interactionState = 'IDLE';
                game.trigger('onSphereDeselected', {});
            } else {
                const opt = sphereMoveOptions.find(o => o.r === u.r && o.c === u.c);
                if (opt) {
                    game.doPushSphere(opt.dirR, opt.dirC);
                } else {
                    game.interactionState = 'IDLE';
                    game.trigger('onSphereDeselected', {});
                    game.log('Click a lit tile to move the sphere there.');
                }
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

// --- Fountain (courtyard center cell) ---
const fountainDroplets = [];
function createFountain(r, c) {
    const { x, z } = getPos(r, c);
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(TILE_SIZE / 2 - 0.05, TILE_SIZE / 2, 0.28, 8),
        plinthMat
    );
    basin.position.y = 0.14;
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(TILE_SIZE / 2 - 0.05, 0.06, 8, 8), tileTrimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.28;
    group.add(rim);

    const water = new THREE.Mesh(
        new THREE.CylinderGeometry(TILE_SIZE / 2 - 0.18, TILE_SIZE / 2 - 0.18, 0.05, 20),
        new THREE.MeshStandardMaterial({ color: 0x4fb0d8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 })
    );
    water.position.y = 0.26;
    group.add(water);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 10), tileTrimMat);
    pedestal.position.y = 0.28 + 0.25;
    group.add(pedestal);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.14, 12), brassMat);
    bowl.position.y = 0.28 + 0.55;
    group.add(bowl);

    const spoutTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), brassMat);
    spoutTip.position.y = 0.28 + 0.68;
    group.add(spoutTip);

    boardGroup.add(group);
    plateMeshes[`${r}_${c}`] = group;

    // Spray droplets — small emissive spheres bobbing up out of the spout, animated per-frame
    const dropletMat = new THREE.MeshStandardMaterial({ color: 0xbfe8f7, emissive: 0x2a8fb8, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
        const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), dropletMat);
        const angle = (i / 6) * Math.PI * 2;
        group.add(droplet);
        fountainDroplets.push({ mesh: droplet, angle, phase: Math.random() * Math.PI * 2, baseY: 0.28 + 0.68 });
    }

    group.scale.set(0.1, 0.1, 0.1);
    new TWEEN.Tween(group.scale)
        .to({ x: 1, y: 1, z: 1 }, 400)
        .easing(TWEEN.Easing.Back.Out)
        .start();
}

// --- Visual Helpers ---
function createPlate(r, c, owner) {
    if (owner === FOUNTAIN) { createFountain(r, c); return; }
    const { x, z } = getPos(r, c);
    const bookGroup = new THREE.Group();
    bookGroup.position.set(x, 0, z);

    const ownerColors = [0xf8f8f8, 0x2a2a2a, 0xcc3333, 0x3366cc];
    const col = ownerColors[owner % ownerColors.length];

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

// --- Shared Sphere (an armillary knowledge-orb — the ring pattern makes rolling visible) ---
let sharedSphereMesh = null;
const SPHERE_RADIUS = 0.55;

function createSharedSphere() {
    if (sharedSphereMesh) scene.remove(sharedSphereMesh);

    const group = new THREE.Group();

    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.15,
        metalness: 0.2,
        emissive: 0x4488ff,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.75,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_RADIUS * 0.82, 20, 20), coreMat);
    core.castShadow = true;
    group.add(core);

    // Three perpendicular brass meridian rings, like an astrolabe
    const ringGeo = new THREE.TorusGeometry(SPHERE_RADIUS, 0.05, 8, 28);
    const ringA = new THREE.Mesh(ringGeo, brassMat);
    group.add(ringA);
    const ringB = new THREE.Mesh(ringGeo, brassMat);
    ringB.rotation.x = Math.PI / 2;
    group.add(ringB);
    const ringC = new THREE.Mesh(ringGeo, brassMat);
    ringC.rotation.y = Math.PI / 2;
    group.add(ringC);

    group.castShadow = true;
    const { x, z } = getPos(CENTER, CENTER);
    group.position.set(x, SPHERE_RADIUS, z);
    scene.add(group);
    sharedSphereMesh = group;
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

function toggleOpenEndsMode() {
    game.setOpenEnds(!game.openEnds);
    const btn = document.getElementById('variant-btn');
    if (btn) btn.textContent = game.openEnds ? 'Field: Open Ends' : 'Field: Safe Ends';
    startNewGame(game.numPlayers, null);
}

// Players: a single button toggling 2 <-> 4 (four houses), matching the other games' menus.
document.getElementById('players-btn').onclick = () => {
    startNewGame(game.numPlayers === 2 ? 4 : 2, null);
};
document.getElementById('reset-button').onclick = () => startNewGame(game.numPlayers, null);
document.getElementById('modal-new-game').onclick = () => startNewGame(game.numPlayers, null);

function startNewGame(pCount, btnElem) {
    clearTimeout(winRevealTimer);
    document.getElementById('game-over-modal').classList.add('hidden');
    const pb = document.getElementById('players-btn');
    if (pb) pb.innerText = `Players: ${pCount}`;

    Object.values(plateMeshes).forEach(m => boardGroup.remove(m));
    Object.values(hWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(vWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(goalMarkers).forEach(m => boardGroup.remove(m));
    if (sharedSphereMesh) { scene.remove(sharedSphereMesh); sharedSphereMesh = null; }
    fountainDroplets.length = 0;

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
    const hex = '#' + data.player.colorHex.toString(16).padStart(6, '0');
    statusText.innerText = `${data.player.name} to move`;
    playerColorBox.style.backgroundColor = hex;
    // keep the standard menu turn indicator in sync too
    const menuName = document.getElementById('player-name');
    const menuDot = document.getElementById('player-indicator');
    if (menuName) menuName.innerText = `${data.player.name} to move`;
    if (menuDot) menuDot.style.backgroundColor = hex;

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
    if (!sharedSphereMesh) return;
    const start = sharedSphereMesh.position.clone();
    const { x, z } = getPos(data.r, data.c);
    const end = new THREE.Vector3(x, SPHERE_RADIUS, z);
    const delta = new THREE.Vector3().subVectors(end, start);
    const dist = delta.length();

    if (dist < 0.001) {
        sharedSphereMesh.position.copy(end);
        return;
    }

    const dir = delta.clone().normalize();
    const rollAxis = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular to travel direction
    const totalAngle = dist / SPHERE_RADIUS;
    const baseQuat = sharedSphereMesh.quaternion.clone();
    const duration = Math.min(1200, Math.max(280, dist * 220));

    const o = { t: 0 };
    new TWEEN.Tween(o)
        .to({ t: 1 }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            sharedSphereMesh.position.lerpVectors(start, end, o.t);
            const rollQuat = new THREE.Quaternion().setFromAxisAngle(rollAxis, o.t * totalAngle);
            sharedSphereMesh.quaternion.copy(rollQuat).multiply(baseQuat);
        })
        .onComplete(() => {
            sharedSphereMesh.position.copy(end);
        })
        .start();
});

game.on('onSphereFell', (data) => {
    if (!sharedSphereMesh) return;

    const start = sharedSphereMesh.position.clone();
    const lastPlate = getPos(data.fromR, data.fromC);
    const step = TILE_SIZE + GAP_SIZE;
    // Roll past the last plate and out over the open end, then drop.
    const edge = new THREE.Vector3(
        lastPlate.x + data.dirC * step,
        SPHERE_RADIUS,
        lastPlate.z + data.dirR * step
    );
    const fountain = getPos(CENTER, CENTER);

    const delta = new THREE.Vector3().subVectors(edge, start);
    const dist = delta.length();
    const dir = dist > 0.001 ? delta.clone().normalize() : new THREE.Vector3(data.dirC, 0, data.dirR);
    const rollAxis = new THREE.Vector3(-dir.z, 0, dir.x);
    const totalAngle = dist / SPHERE_RADIUS;
    const baseQuat = sharedSphereMesh.quaternion.clone();
    const rollDuration = Math.min(1200, Math.max(280, dist * 220));

    const o = { t: 0 };
    new TWEEN.Tween(o)
        .to({ t: 1 }, rollDuration)
        .easing(TWEEN.Easing.Quadratic.In)
        .onUpdate(() => {
            sharedSphereMesh.position.lerpVectors(start, edge, o.t);
            const rollQuat = new THREE.Quaternion().setFromAxisAngle(rollAxis, o.t * totalAngle);
            sharedSphereMesh.quaternion.copy(rollQuat).multiply(baseQuat);
        })
        .onComplete(() => {
            // Fall off the open end, then respawn above the fountain.
            new TWEEN.Tween(sharedSphereMesh.position)
                .to({ y: -3 }, 380)
                .easing(TWEEN.Easing.Quadratic.In)
                .onComplete(() => {
                    sharedSphereMesh.position.set(fountain.x, 4, fountain.z);
                    new TWEEN.Tween(sharedSphereMesh.position)
                        .to({ y: SPHERE_RADIUS }, 450)
                        .easing(TWEEN.Easing.Bounce.Out)
                        .start();
                })
                .start();
        })
        .start();
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

let winRevealTimer = null;
game.on('onGameOver', (data) => {
    document.getElementById('modal-title').innerText = "Game Over!";
    document.getElementById('modal-text').innerText = `${data.winner.name} guided the sphere to their study room!`;
    // let the sphere's final roll play out before covering the board
    clearTimeout(winRevealTimer);
    winRevealTimer = setTimeout(() => {
        document.getElementById('game-over-modal').classList.remove('hidden');
    }, 1100);
});

game.on('onMessage', (msg) => {
    // Suppressed for clean UI
});

// --- Render Loop ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();

    const t = clock.getElapsedTime();
    fountainDroplets.forEach(d => {
        const rise = (t * 1.4 + d.phase) % 1; // 0 = at spout, 1 = fallen back
        const arc = Math.sin(rise * Math.PI);
        d.mesh.position.set(Math.cos(d.angle) * 0.08 * rise, d.baseY + arc * 0.5, Math.sin(d.angle) * 0.08 * rise);
        d.mesh.material.opacity = 0.85 * (1 - rise * 0.6);
    });

    if (game.interactionState === 'SPHERE_SELECTED') {
        const pulse = 1 + Math.sin(t * 4) * 0.12;
        sphereMoveMarkers.forEach(m => { if (m.visible) m.scale.set(pulse, 1, pulse); });
    }

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
                game.log('Sphere selected. Click a lit tile to roll it there.');
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
    startNewGame(game.numPlayers, null);
}

// Opponent: a single toggle button (Computer <-> Human). Only meaningful in
// 2-player games; with 3+ players every rival is human-controlled hot-seat.
document.getElementById('opponent-btn').addEventListener('click', () => {
    if (game.numPlayers > 2) return;   // no computer opponent in multiplayer
    setOpponentType(opponentType === 'computer' ? 'human' : 'computer');
});

const _origStartNewGame = startNewGame;
startNewGame = function(pCount, btnElem) {
    if (aiTimeout) clearTimeout(aiTimeout);
    isAiTurn = false;
    // In multiplayer every rival is computer-controlled by default, so the
    // 2-player Opponent toggle is only shown for a 2-player game.
    const oppBtn = document.getElementById('opponent-btn');
    if (oppBtn) oppBtn.style.display = pCount > 2 ? 'none' : '';
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
            if (this.game.openEnds) {
                const res = this.game.simulateSphereRoll(dirR, dirC);
                if (res.fell) continue;
            }
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

// Player 1 (id 0) is the human. In 2-player the single rival follows the Opponent
// toggle; in 4-player every rival is a computer by default.
function isComputerPlayer(id) {
    if (id === 0) return false;
    if (game.numPlayers > 2) return true;
    return opponentType === 'computer';
}

game.on('onTurnStart', (data) => {
    if (!game.winner && isComputerPlayer(data.player.id)) {
        ai = new LibraryAI(game, data.player.id);
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
