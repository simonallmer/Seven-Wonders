/**
 * Library 3D Visualization
 * Three.js rendering for the Dominoverse (Cascading Walls) logic engine.
 * PS5-quality lighting and aesthetics inspired by the Library of Baghdad (House of Wisdom).
 */

const game = window.libraryGameInstance;

// --- DOM Elements ---
const canvasContainer = document.getElementById('canvas3d');
const btnLay = document.getElementById('btn-action-lay');
const btnMove = document.getElementById('btn-action-move');
const btnPush = document.getElementById('btn-action-push');
const btnTopple = document.getElementById('btn-action-topple');
const statusText = document.getElementById('status-text');
const playerColorBox = document.getElementById('player-color');

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1512); // Deep night sky
scene.fog = new THREE.FogExp2(0x1a1512, 0.015);

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
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
controls.minDistance = 10;
controls.maxDistance = 50;

// --- Lighting (PS5 Quality Vibes) ---
const ambientLight = new THREE.AmbientLight(0xfff0e6, 0.3); // Warm ambient
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x99badd, 1.2);
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

// Add warm torch/lantern lights in the study rooms
const addTorch = (x, z) => {
    const light = new THREE.PointLight(0xffaa55, 1.5, 20);
    light.position.set(x, 3, z);
    light.castShadow = true;
    scene.add(light);
    
    // Tiny mesh for visual
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa55 })
    );
    mesh.position.set(x, 3, z);
    scene.add(mesh);
};

// --- Materials ---
const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xebd9c8,
    roughness: 0.3,
    metalness: 0.1,
});

const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3d352b,
    roughness: 0.8,
    metalness: 0.2,
});

const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c4033,
    roughness: 0.9,
});

const plateMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5dc,
    roughness: 0.4,
    metalness: 0.1,
});

const activeCellMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.3,
});

// --- Environment Construction (Courtyard & Rooms) ---
const courtyardGroup = new THREE.Group();
scene.add(courtyardGroup);

// Floor
const floorGeo = new THREE.PlaneGeometry(40, 40);
const floor = new THREE.Mesh(floorGeo, darkStoneMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
courtyardGroup.add(floor);

// Generate 4 Study Rooms (North, South, East, West)
const createStudyRoom = (x, z, rot) => {
    const roomGroup = new THREE.Group();
    roomGroup.position.set(x, 0, z);
    roomGroup.rotation.y = rot;

    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), marbleMat);
    base.position.y = 0.25;
    base.receiveShadow = true;
    roomGroup.add(base);

    // Archway
    const archGeo = new THREE.TorusGeometry(3, 0.5, 16, 32, Math.PI);
    const arch = new THREE.Mesh(archGeo, marbleMat);
    arch.position.set(0, 4, 3);
    arch.castShadow = true;
    roomGroup.add(arch);
    
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    const p1 = new THREE.Mesh(pillarGeo, marbleMat);
    p1.position.set(-3, 2, 3);
    p1.castShadow = true;
    roomGroup.add(p1);
    
    const p2 = p1.clone();
    p2.position.set(3, 2, 3);
    roomGroup.add(p2);

    addTorch(x, z);

    return roomGroup;
};

// Rooms
courtyardGroup.add(createStudyRoom(0, -12, 0)); // North (Player 2)
courtyardGroup.add(createStudyRoom(0, 12, Math.PI)); // South (Player 1)
courtyardGroup.add(createStudyRoom(12, 0, -Math.PI/2)); // East (Player 3)
courtyardGroup.add(createStudyRoom(-12, 0, Math.PI/2)); // West (Player 4)

// --- Game Board Render Data ---
const TILE_SIZE = 1.6;
const GAP_SIZE = 0.4;
const BOARD_OFFSET = (BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * GAP_SIZE) / 2;

// Maps to hold mesh references
const cellMeshes = []; // The interactive grid floor 
const plateMeshes = {}; // The physical plates laid down
const hWallTriggers = [];
const vWallTriggers = [];
const hWallMeshes = {}; // Placed hWalls
const vWallMeshes = {}; // Placed vWalls
const playerMeshes = {}; // Player figures

// Board Group
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const getPos = (r, c) => {
    const x = c * (TILE_SIZE + GAP_SIZE) - BOARD_OFFSET + TILE_SIZE / 2;
    const z = r * (TILE_SIZE + GAP_SIZE) - BOARD_OFFSET + TILE_SIZE / 2;
    return { x, z };
};

// 1. Grid Cells
for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const { x, z } = getPos(r, c);
        
        // Base grid visual (darker indentation)
        const cellBase = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.1, TILE_SIZE),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
        );
        cellBase.position.set(x, 0.05, z);
        cellBase.receiveShadow = true;
        boardGroup.add(cellBase);

        // Interactive trigger box (invisible)
        const trigger = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        trigger.position.set(x, 0.25, z);
        trigger.userData = { type: 'cell', r, c };
        cellMeshes.push(trigger);
        boardGroup.add(trigger);
        
        // Hover highlight
        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE),
            activeCellMat
        );
        highlight.position.set(x, 0.2, z);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

// 2. Horizontal Wall Triggers (Gaps between rows)
for (let r = 0; r < BOARD_SIZE - 1; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const { x, z } = getPos(r, c);
        const zOff = z + TILE_SIZE/2 + GAP_SIZE/2;
        
        const trigger = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 1, GAP_SIZE),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        trigger.position.set(x, 0.5, zOff);
        trigger.userData = { type: 'hWall', r, c };
        hWallTriggers.push(trigger);
        boardGroup.add(trigger);

        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.2, GAP_SIZE),
            activeCellMat
        );
        highlight.position.set(x, 0.2, zOff);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

// 3. Vertical Wall Triggers (Gaps between columns)
for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
        const { x, z } = getPos(r, c);
        const xOff = x + TILE_SIZE/2 + GAP_SIZE/2;
        
        const trigger = new THREE.Mesh(
            new THREE.BoxGeometry(GAP_SIZE, 1, TILE_SIZE),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        trigger.position.set(xOff, 0.5, z);
        trigger.userData = { type: 'vWall', r, c };
        vWallTriggers.push(trigger);
        boardGroup.add(trigger);

        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(GAP_SIZE, 0.2, TILE_SIZE),
            activeCellMat
        );
        highlight.position.set(xOff, 0.2, z);
        highlight.visible = false;
        trigger.userData.highlight = highlight;
        boardGroup.add(highlight);
    }
}

// Raycaster setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerMove(event) {
    if (game.winner) return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Reset highlights
    cellMeshes.forEach(m => m.userData.highlight.visible = false);
    hWallTriggers.forEach(m => m.userData.highlight.visible = false);
    vWallTriggers.forEach(m => m.userData.highlight.visible = false);

    raycaster.setFromCamera(mouse, camera);
    
    let interactables = [];
    if (game.selectedAction === 'LAY') {
        interactables = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    } else if (game.selectedAction === 'MOVE') {
        interactables = cellMeshes;
    } else if (game.selectedAction === 'PUSH' || game.selectedAction === 'TOPPLE') {
        interactables = [...hWallTriggers, ...vWallTriggers];
    }

    const intersects = raycaster.intersectObjects(interactables);
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const u = obj.userData;
        
        // Validation logic for hover
        let isValid = false;
        if (game.selectedAction === 'LAY') {
            if (u.type === 'cell' && !game.fields[u.r][u.c]) isValid = true;
            if (u.type === 'hWall' && !game.hWalls[u.r][u.c]) isValid = true;
            if (u.type === 'vWall' && !game.vWalls[u.r][u.c]) isValid = true;
        } else if (game.selectedAction === 'MOVE') {
            if (u.type === 'cell' && game.isValidMoveTarget(game.players[game.currentPlayer], u.r, u.c)) isValid = true;
        } else if (game.selectedAction === 'PUSH' || game.selectedAction === 'TOPPLE') {
            if (u.type === 'hWall' && game.hWalls[u.r][u.c]) isValid = true;
            if (u.type === 'vWall' && game.vWalls[u.r][u.c]) isValid = true;
        }

        if (isValid) {
            const hl = obj.userData.highlight;
            hl.visible = true;
            
            // Default reset scale/pos
            const { x, z } = getPos(u.r, u.c);
            if (u.type === 'cell') {
                hl.scale.set(1, 1, 1);
                hl.position.set(x, 0.2, z);
            } else if (u.type === 'hWall') {
                const cx = x;
                const cz = z + TILE_SIZE/2 + GAP_SIZE/2;
                hl.scale.set(1, 1, 1);
                hl.position.set(cx, 0.2, cz);
                
                if (game.selectedAction === 'PUSH') {
                    // highlight half of the wall vertically/horizontally
                    hl.scale.set(0.5, 10, 1); // 10 * 0.2 = 2 (height of wall)
                    if (intersects[0].point.x < cx) {
                        hl.position.set(cx - TILE_SIZE/4, 1, cz);
                    } else {
                        hl.position.set(cx + TILE_SIZE/4, 1, cz);
                    }
                } else if (game.selectedAction === 'TOPPLE') {
                    hl.scale.set(1, 10, 0.5);
                    if (intersects[0].point.z < cz) {
                        hl.position.set(cx, 1, cz - GAP_SIZE/4);
                    } else {
                        hl.position.set(cx, 1, cz + GAP_SIZE/4);
                    }
                } else {
                    hl.scale.set(1, 1, 1);
                    hl.position.set(cx, 0.2, cz);
                }
            } else if (u.type === 'vWall') {
                const cx = x + TILE_SIZE/2 + GAP_SIZE/2;
                const cz = z;
                
                if (game.selectedAction === 'PUSH') {
                    hl.scale.set(1, 10, 0.5);
                    if (intersects[0].point.z < cz) {
                        hl.position.set(cx, 1, cz - TILE_SIZE/4);
                    } else {
                        hl.position.set(cx, 1, cz + TILE_SIZE/4);
                    }
                } else if (game.selectedAction === 'TOPPLE') {
                    hl.scale.set(0.5, 10, 1);
                    if (intersects[0].point.x < cx) {
                        hl.position.set(cx - GAP_SIZE/4, 1, cz);
                    } else {
                        hl.position.set(cx + GAP_SIZE/4, 1, cz);
                    }
                } else {
                    hl.scale.set(1, 1, 1);
                    hl.position.set(cx, 0.2, cz);
                }
            }
        }
    }
}

let pointerDownPos = { x: 0, y: 0 };
window.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
});

window.addEventListener('pointerup', (e) => {
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
    
    let interactables = [];
    if (game.selectedAction === 'MOVE') interactables = cellMeshes;
    else if (game.selectedAction === 'PUSH' || game.selectedAction === 'TOPPLE') interactables = [...hWallTriggers, ...vWallTriggers];
    else interactables = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0) {
        const u = intersects[0].object.userData;
        
        if (u.type === 'cell') {
            game.handleCellClick(u.r, u.c);
        } else if (u.type === 'hWall') {
            if (game.selectedAction === 'PUSH' || game.selectedAction === 'TOPPLE') {
                const wallInfo = game.handleWallClick('h', u.r, u.c);
                if (wallInfo) {
                    const { x, z } = getPos(u.r, u.c);
                    const cx = x;
                    const cz = z + TILE_SIZE/2 + GAP_SIZE/2;
                    const clickX = intersects[0].point.x;
                    const clickZ = intersects[0].point.z;
                    if (game.selectedAction === 'PUSH') {
                        if (clickX < cx) game.executePush('right');
                        else game.executePush('left');
                    } else { // TOPPLE
                        if (clickZ < cz) game.executeTopple('down');
                        else game.executeTopple('up');
                    }
                }
            } else {
                game.handleWallClick('h', u.r, u.c);
            }
        } else if (u.type === 'vWall') {
            if (game.selectedAction === 'PUSH' || game.selectedAction === 'TOPPLE') {
                const wallInfo = game.handleWallClick('v', u.r, u.c);
                if (wallInfo) {
                    const { x, z } = getPos(u.r, u.c);
                    const cx = x + TILE_SIZE/2 + GAP_SIZE/2;
                    const cz = z;
                    const clickX = intersects[0].point.x;
                    const clickZ = intersects[0].point.z;
                    if (game.selectedAction === 'PUSH') {
                        if (clickZ < cz) game.executePush('down');
                        else game.executePush('up');
                    } else { // TOPPLE
                        if (clickX < cx) game.executeTopple('right');
                        else game.executeTopple('left');
                    }
                }
            } else {
                game.handleWallClick('v', u.r, u.c);
            }
        }
    }
}

window.addEventListener('pointermove', onPointerMove);
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Visual Helpers ---

function createPlate(r, c) {
    const { x, z } = getPos(r, c);
    const plate = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.1, 0.2, TILE_SIZE - 0.1),
        plateMat
    );
    plate.position.set(x, 0.1, z);
    plate.castShadow = true;
    plate.receiveShadow = true;
    boardGroup.add(plate);
    plateMeshes[`${r}_${c}`] = plate;
    
    // Animate in
    plate.scale.set(0.1, 0.1, 0.1);
    new TWEEN.Tween(plate.scale)
        .to({ x: 1, y: 1, z: 1 }, 400)
        .easing(TWEEN.Easing.Back.Out)
        .start();
}

function createWall(type, r, c) {
    const { x, z } = getPos(r, c);
    
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

    const wall = new THREE.Mesh(geo, woodMat);
    wall.position.set(meshX, 1, meshZ);
    wall.castShadow = true;
    wall.receiveShadow = true;
    boardGroup.add(wall);
    
    if (type === 'h') hWallMeshes[`${r}_${c}`] = wall;
    else vWallMeshes[`${r}_${c}`] = wall;

    // Animate in
    wall.position.y = 5;
    new TWEEN.Tween(wall.position)
        .to({ y: 1 }, 500)
        .easing(TWEEN.Easing.Bounce.Out)
        .start();
}

function createPlayerFigure(player) {
    const group = new THREE.Group();
    
    // Small scholar figure abstraction
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16);
    const bodyGeo = new THREE.CylinderGeometry(0.1, 0.3, 1.2, 16);
    const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
    
    const mat = new THREE.MeshStandardMaterial({ color: player.colorHex, roughness: 0.2, metalness: 0.8 });
    
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.1;
    base.castShadow = true;
    
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.8;
    body.castShadow = true;
    
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.6;
    head.castShadow = true;
    
    group.add(base, body, head);
    
    // Position in study room based on ID
    if (player.id === 0) group.position.set(0, 0, 12);
    else if (player.id === 1) group.position.set(0, 0, -12);
    else if (player.id === 2) group.position.set(-12, 0, 0);
    else if (player.id === 3) group.position.set(12, 0, 0);
    
    scene.add(group);
    playerMeshes[player.id] = group;
}

// --- UI Interaction ---

function setUIAction(action) {
    game.setAction(action);
}

btnLay.onclick = () => setUIAction('LAY');
btnMove.onclick = () => setUIAction('MOVE');
btnPush.onclick = () => setUIAction('PUSH');
btnTopple.onclick = () => setUIAction('TOPPLE');

// HUD logic
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
    
    // Clear old meshes
    Object.values(plateMeshes).forEach(m => boardGroup.remove(m));
    Object.values(hWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(vWallMeshes).forEach(m => boardGroup.remove(m));
    Object.values(playerMeshes).forEach(m => scene.remove(m));
    
    // Reset keys
    for (let key in plateMeshes) delete plateMeshes[key];
    for (let key in hWallMeshes) delete hWallMeshes[key];
    for (let key in vWallMeshes) delete vWallMeshes[key];
    for (let key in playerMeshes) delete playerMeshes[key];

    game.initGame(pCount);
}

// --- Game Logic Listeners ---

game.on('onInit', (data) => {
    data.players.forEach(p => {
        createPlayerFigure(p);
        if (p.row !== null) {
            const { x, z } = getPos(p.row, p.col);
            playerMeshes[p.id].position.set(x, 1, z);
        }
    });
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (data.fields[r][c]) createPlate(r, c);
        }
    }
    setUIAction('LAY');
});

game.on('onTurnStart', (data) => {
    statusText.innerText = `${data.player.name} to move`;
    playerColorBox.style.backgroundColor = '#' + data.player.colorHex.toString(16).padStart(6, '0');
});

game.on('onPlateLaid', (data) => {
    createPlate(data.r, data.c);
});

game.on('onWallLaid', (data) => {
    createWall(data.type, data.r, data.c);
});

game.on('onActionChanged', (action) => {
    document.querySelectorAll('.action-btn-custom').forEach(b => b.classList.remove('active'));
    
    if (action === 'LAY') btnLay.classList.add('active');
    else if (action === 'MOVE') btnMove.classList.add('active');
    else if (action === 'PUSH') btnPush.classList.add('active');
    else if (action === 'TOPPLE') btnTopple.classList.add('active');
});

game.on('onFigureMoved', (data) => {
    const mesh = playerMeshes[data.player.id];
    const { x, z } = getPos(data.r, data.c);
    
    // Jump animation
    new TWEEN.Tween(mesh.position)
        .to({ x: x, z: z }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
        
    new TWEEN.Tween(mesh.position)
        .to({ y: 1 }, 250)
        .easing(TWEEN.Easing.Quadratic.Out)
        .yoyo(true)
        .repeat(1)
        .start();
});

game.on('onFigureCrushed', (data) => {
    const mesh = playerMeshes[data.player.id];
    
    // Send back to study room
    let targetX, targetZ;
    if (data.player.id === 0) { targetX = 0; targetZ = 12; }
    else if (data.player.id === 1) { targetX = 0; targetZ = -12; }
    else if (data.player.id === 2) { targetX = -12; targetZ = 0; }
    else if (data.player.id === 3) { targetX = 12; targetZ = 0; }
    
    new TWEEN.Tween(mesh.position)
        .to({ x: targetX, y: 0, z: targetZ }, 1000)
        .easing(TWEEN.Easing.Bounce.Out)
        .start();
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
    
    // Topple animation then remove
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
    document.getElementById('modal-text').innerText = `${data.winner.name} reached the goal!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
});

game.on('onMessage', (msg) => {
    // Messages suppressed for clean UI
});

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    
    // Slow camera auto-rotation if no interaction
    if (!controls.state && !game.winner) {
        // scene.rotation.y += 0.0005; 
    }
    
    renderer.render(scene, camera);
}

// --- Keyboard Movement ---
window.addEventListener('keydown', (e) => {
    if (game.winner) return;
    
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Numpad8', 'Numpad4', 'Numpad2', 'Numpad6'];
    if (!keys.includes(e.code)) return;
    
    let dirX = 0, dirZ = 0;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Numpad8') dirZ = -1;
    if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Numpad2') dirZ = 1;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'Numpad4') dirX = -1;
    if (e.code === 'KeyD' || e.code === 'ArrowRight' || e.code === 'Numpad6') dirX = 1;
    
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    
    const moveVec = new THREE.Vector3();
    moveVec.addScaledVector(right, dirX);
    moveVec.addScaledVector(forward, -dirZ);
    
    let targetR = 0, targetC = 0;
    if (Math.abs(moveVec.x) > Math.abs(moveVec.z)) {
        targetC = moveVec.x > 0 ? 1 : -1;
    } else {
        targetR = moveVec.z > 0 ? 1 : -1;
    }
    
    const cp = game.players[game.currentPlayer];
    if (cp.row === null) return;
    
    const newR = cp.row + targetR;
    const newC = cp.col + targetC;
    
    if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE) {
        const oldAction = game.selectedAction;
        game.setAction('MOVE');
        
        if (game.isValidMoveTarget(cp, newR, newC)) {
            game.handleCellClick(newR, newC);
        } else {
            game.setAction(oldAction);
            game.log("Invalid move in that direction.");
        }
    }
});

// Start immediately
game.initGame(2);
animate();
