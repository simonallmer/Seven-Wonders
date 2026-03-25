// ============================================
// MAUSOLEUM GAME 3D VIEW
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;

// Groups
const groupMausoleum = new THREE.Group();
const groupBoard = new THREE.Group();
const groupPieces = new THREE.Group();
const groupConnectors = new THREE.Group();
const groupHighlights = new THREE.Group();
const groupEnvironment = new THREE.Group();
const groupTown = new THREE.Group();
const groupShips = new THREE.Group();

// Maps for easy access
const stoneMeshes = new Map();
const fieldMeshes = new Map();

// Materials
const matMarbleBase = new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.8, metalness: 0.1 });
const matPillar = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.7, metalness: 0.1 });
const matField = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 0.6, metalness: 0.2 });
const matWhitePiece = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const matBlackPiece = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.3 });
const matHighlight = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5, depthTest: false });
const matSelection = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6, depthTest: false });
const matBevel = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.2, metalness: 0.8, emissive: 0x332200, emissiveIntensity: 0.1 });
const matRoof = new THREE.MeshStandardMaterial({ color: 0xd1c9bc, roughness: 0.9, metalness: 0.05 });
const matSea = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.85 });
const matGrass = new THREE.MeshStandardMaterial({ color: 0x4a5d23, roughness: 0.9 });
const matHouseWall = new THREE.MeshStandardMaterial({ color: 0xfffcf5, roughness: 0.8 });
const matHouseRoof = new THREE.MeshStandardMaterial({ color: 0xa85d32, roughness: 0.9 }); 
const matWood = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });

// Initialize 3D Engine
function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfde0ad); // Warm sunrise/sunset
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.0006);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 350, 480); 

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 2000;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enablePan = false; // PANNING REMOVED
    
    // CENTER CAMERA ON BOARD
    buildMausoleumEnvironment();
    
    if (window.boardPlatformY) {
        controls.target.set(0, window.boardPlatformY, 0);
        camera.position.set(0, 300, -450); 
        controls.update();
    }
    
    controls.addEventListener('change', () => { needsRender = true; });

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff2e0, 0x4a5d23, 0.7);
    hemiLight.position.set(0, 500, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffdfa0, 1.3);
    dirLight.position.set(600, 600, 400);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 1500;
    dirLight.shadow.camera.bottom = -1500;
    dirLight.shadow.camera.left = -1500;
    dirLight.shadow.camera.right = 1500;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 4000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Resize handler
    window.addEventListener('resize', onWindowResize);

    // Raycaster for interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Animation loop
    renderer.setAnimationLoop(animate3D);

    // Build the fields from the game data
    build3DBoard();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

function createHouse(x, z, rotate = 0) {
    const group = new THREE.Group();
    const w = 12 + Math.random() * 8;
    const h = 10 + Math.random() * 10;
    const d = 12 + Math.random() * 8;
    
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matHouseWall);
    wall.position.y = h / 2;
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);
    
    const roofH = 6;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, w * 0.8, roofH, 4), matHouseRoof);
    roof.position.y = h + roofH / 2 - 1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    
    group.position.set(x, 0, z);
    group.rotation.y = rotate;
    return group;
}

function createSailboat() {
    const group = new THREE.Group();
    
    const hullParams = { w: 10, h: 4, l: 24 };
    const hull = new THREE.Mesh(new THREE.BoxGeometry(hullParams.w, hullParams.h, hullParams.l), matWood);
    hull.position.y = 1;
    hull.castShadow = true;
    group.add(hull);
    
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20, 8), matWood);
    mast.position.y = 10;
    group.add(mast);
    
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(12, 16), new THREE.MeshStandardMaterial({color: 0xfafafa, side: THREE.DoubleSide}));
    sail.position.set(0, 12, 4);
    sail.rotation.y = 0.2;
    group.add(sail);
    
    group.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 1000 + Math.random() * 1000,
        speed: 0.0003 + Math.random() * 0.0006
    };
    
    return group;
}

function buildMausoleumEnvironment() {
    scene.add(groupEnvironment);
    groupEnvironment.add(groupMausoleum);
    groupMausoleum.add(groupBoard);
    scene.add(groupPieces);
    scene.add(groupConnectors);
    scene.add(groupHighlights);
    scene.add(groupTown);
    scene.add(groupShips);

    // 1. ENDLESS CIRCULAR LAND & SEA (Rounded Shoreline)
    const landRadius = 6000;
    const land = new THREE.Mesh(new THREE.CircleGeometry(landRadius, 64), matGrass);
    land.rotation.x = -Math.PI / 2;
    land.position.set(-1500, -0.5, 0); // Shift further left to expose sea
    land.receiveShadow = true;
    groupEnvironment.add(land);

    const seaRadius = 12000;
    const sea = new THREE.Mesh(new THREE.CircleGeometry(seaRadius, 32), matSea);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(500, -5, 0); // Bring sea closer into view
    groupEnvironment.add(sea);

    // 2. Massive Podium (Base of Mausoleum)
    const podiumSize = 280;
    const podiumHeight = 100;
    const geomPodium = new THREE.BoxGeometry(podiumSize, podiumHeight, podiumSize);
    const meshPodium = new THREE.Mesh(geomPodium, matMarbleBase);
    meshPodium.position.y = podiumHeight / 2; 
    meshPodium.receiveShadow = true;
    meshPodium.castShadow = true;
    groupMausoleum.add(meshPodium);

    const friezeHeight = 8;
    const geomFrieze = new THREE.BoxGeometry(podiumSize + 2, friezeHeight, podiumSize + 2);
    const meshFriezeTop = new THREE.Mesh(geomFrieze, matMarbleBase);
    meshFriezeTop.position.y = podiumHeight + friezeHeight / 2;
    groupMausoleum.add(meshFriezeTop);

    // 3. Colonnade SYMMETRICAL REBUILD
    const pillarRadius = 4.5;
    const pillarHeight = 70;
    const cellaSize = 180;
    const colBaseY = podiumHeight + friezeHeight;
    const colOffset = 120;
    const numPillarsPerSide = 9; // Guaranteed corner and even spacing
    const spacing = (colOffset * 2) / (numPillarsPerSide - 1);
    
    const geomCella = new THREE.BoxGeometry(cellaSize, pillarHeight, cellaSize);
    const meshCella = new THREE.Mesh(geomCella, matMarbleBase);
    meshCella.position.y = colBaseY + pillarHeight / 2;
    meshCella.receiveShadow = true;
    groupMausoleum.add(meshCella);

    function createColumn(x, z) {
        const group = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(pillarRadius * 0.9, pillarRadius, pillarHeight, 16), matPillar);
        shaft.position.y = pillarHeight / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(pillarRadius * 1.4, pillarRadius * 1.4, 4, 16), matPillar);
        base.position.y = 2; 
        group.add(base);

        const capital = new THREE.Mesh(new THREE.BoxGeometry(pillarRadius * 3.5, 4, pillarRadius * 3.5), matPillar);
        capital.position.y = pillarHeight;
        group.add(capital);

        group.position.set(x, colBaseY, z);
        groupMausoleum.add(group);
    }

    for (let i = 0; i < numPillarsPerSide; i++) {
        const offset = -colOffset + i * spacing;
        createColumn(offset, colOffset);      // Front
        createColumn(offset, -colOffset);     // Back
        if (i > 0 && i < numPillarsPerSide - 1) {
            createColumn(colOffset, offset);  // Right
            createColumn(-colOffset, offset); // Left
        }
    }

    // 4. LOW STEPPED ROOF (4 Steps)
    const roofBaseY = colBaseY + pillarHeight;
    const roofStepHeight = 5;
    const roofStepCount = 4; 
    const roofStartSize = 250;
    const roofReduction = 14; 

    for (let i = 0; i < roofStepCount; i++) {
        const s = roofStartSize - (i * roofReduction * 2);
        const geomStep = new THREE.BoxGeometry(s, roofStepHeight, s);
        const meshStep = new THREE.Mesh(geomStep, matRoof);
        meshStep.position.y = roofBaseY + (i * roofStepHeight) + roofStepHeight / 2;
        meshStep.receiveShadow = true;
        meshStep.castShadow = true;
        groupMausoleum.add(meshStep);
        
        if (i === roofStepCount - 1) {
            window.boardPlatformY = meshStep.position.y + roofStepHeight / 2;
            window.boardPlatformSize = { w: s - 10, l: s - 10 };
        }
    }

    // 5. GREEK TOWN (Halicarnassus)
    for (let i = 0; i < 100; i++) {
        const x = -400 - Math.random() * 1200; 
        const z = (Math.random() - 0.5) * 2000;
        if (Math.abs(z) > 1500) continue;
        groupTown.add(createHouse(x, z, Math.random() * Math.PI));
    }

    // 6. SAILBOATS
    for (let i = 0; i < 15; i++) {
        const boat = createSailboat();
        groupShips.add(boat);
    }

    // 7. Distant Mountains
    for (let i = 0; i < 15; i++) {
        const angle = Math.PI * 0.6 + (i / 15) * Math.PI * 0.8; 
        const dist = 3500 + Math.random() * 1500;
        const h = 600 + Math.random() * 1000;
        const mountain = new THREE.Mesh(new THREE.ConeGeometry(800, h, 8), new THREE.MeshStandardMaterial({color: 0x5a626e}));
        mountain.position.set(Math.cos(angle) * dist, -50 + h/2, Math.sin(angle) * dist);
        scene.add(mountain);
    }
}

// Map logic
function get3DCoord(r, c) {
    if (typeof getCoords !== 'function') return { x: 0, z: 0, y: 0 };
    const svgCoords = getCoords(r, c);
    const scaleX = window.boardPlatformSize.w / 110;
    const scaleZ = window.boardPlatformSize.l / 110;
    const x3d = (svgCoords.x - 50) * scaleX;
    const z3d = (svgCoords.y - 50) * scaleZ;
    return { x: x3d, z: z3d, y: window.boardPlatformY };
}

function build3DBoard() {
    fieldMeshes.clear();
    while(groupBoard.children.length > 0) groupBoard.remove(groupBoard.children[0]);
    while(groupConnectors.children.length > 0) groupConnectors.remove(groupConnectors.children[0]);

    if (typeof board === 'undefined') return;

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const { x, z, y } = get3DCoord(r, c);
            const key = `${r},${c}`;

            const geomField = new THREE.CylinderGeometry(6, 6, 1.5, 16);
            const mesh = new THREE.Mesh(geomField, matField);
            mesh.position.set(x, y + 0.75, z);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            mesh.userData = { isField: true, r, c, key };
            
            groupBoard.add(mesh);
            fieldMeshes.set(key, mesh);

            const neighbors = getNeighbors(r, c);
            neighbors.forEach(n => {
                if (n.r > r || (n.r === r && n.c > c)) {
                    const { x: x2, z: z2 } = get3DCoord(n.r, n.c);
                    const dx = x2 - x, dz = z2 - z;
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    const angle = Math.atan2(dx, dz);

                    const geomConn = new THREE.BoxGeometry(2, 0.4, dist);
                    const meshConn = new THREE.Mesh(geomConn, matField);
                    meshConn.position.set(x + dx/2, y + 0.2, z + dz/2);
                    meshConn.rotation.y = angle;
                    groupConnectors.add(meshConn);
                }
            });
        }
    }
    sync3DPieces();
}

function sync3DPieces(animate = false) {
    if (typeof board === 'undefined' || !board.length) return;

    const currentKeys = new Set();
    board.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val !== EMPTY) currentKeys.add(`${r},${c}`);
        });
    });

    stoneMeshes.forEach((mesh, key) => {
        if (!currentKeys.has(key)) {
            if (!mesh.userData.animatingRemoval) {
                groupPieces.remove(mesh);
                stoneMeshes.delete(key);
            }
        }
    });

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const val = board[r][c];
            if (val === EMPTY) continue;
            const key = `${r},${c}`;
            const { x, z, y } = get3DCoord(r, c);

            if (!stoneMeshes.has(key)) {
                const stone = createStoneMesh(val === PLAYER_1 ? 'white' : 'black');
                stone.position.set(x, y + 1.5, z); 
                stone.userData = { r, c, key, color: val };
                groupPieces.add(stone);
                stoneMeshes.set(key, stone);

                if (animate) {
                    stone.scale.set(0,0,0);
                    new TWEEN.Tween(stone.scale).to({x:1,y:1,z:1}, 400).easing(TWEEN.Easing.Elastic.Out).start();
                }
            } else {
                const stone = stoneMeshes.get(key);
                if (!stone.userData.animatingRemoval) {
                    stone.position.set(x, y + 1.5, z);
                }
            }
        }
    }
    needsRender = true;
}

function createStoneMesh(color) {
    const group = new THREE.Group();
    const material = color === 'white' ? matWhitePiece : matBlackPiece;
    
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 6, 24), material);
    body.position.y = 3;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 16, 0, Math.PI*2, 0, Math.PI/2), material);
    top.position.y = 6;
    top.castShadow = true;
    group.add(top);

    const bevel = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.4, 8, 24), matBevel);
    bevel.rotation.x = Math.PI / 2;
    bevel.position.y = 6;
    group.add(bevel);

    return group;
}

function animateMove3D(r1, c1, r2, c2, onComplete) {
    const key1 = `${r1},${c1}`;
    const key2 = `${r2},${c2}`;
    const mesh = stoneMeshes.get(key1);
    if (!mesh) { if(onComplete) onComplete(); return; }

    const { x: tx, z: tz, y: ty } = get3DCoord(r2, c2);
    stoneMeshes.delete(key1);
    stoneMeshes.set(key2, mesh);
    mesh.userData.r = r2;
    mesh.userData.c = c2;
    mesh.userData.key = key2;

    new TWEEN.Tween(mesh.position)
        .to({ x: tx, z: tz }, 600)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => { 
            if(onComplete) onComplete(); 
            needsRender = true;
        })
        .start();
}

function triggerTrapdoorCapture(r, c) {
    const key = `${r},${c}`;
    const stone = stoneMeshes.get(key);
    const field = fieldMeshes.get(key);
    
    if (!stone || !field) return;
    stone.userData.animatingRemoval = true;

    new TWEEN.Tween(field.rotation)
        .to({ x: Math.PI / 2 }, 400)
        .easing(TWEEN.Easing.Back.In)
        .start();

    new TWEEN.Tween(stone.position)
        .to({ y: stone.position.y - 150 }, 800)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
            groupPieces.remove(stone);
            stoneMeshes.delete(key);
        })
        .start();

    setTimeout(() => {
        new TWEEN.Tween(field.rotation).to({ x: 0 }, 400).easing(TWEEN.Easing.Quadratic.Out).start();
    }, 1000);
        
    needsRender = true;
}

function onPointerDown(event) {
    if (!window.is3DView || gameOver) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...groupPieces.children, ...groupBoard.children], true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while(obj && obj.userData.r === undefined && obj.parent) obj = obj.parent;
        if (obj && obj.userData.r !== undefined) {
            if (typeof onCellClick === 'function') onCellClick(obj.userData.r, obj.userData.c);
        }
    }
}

function update3DViews() {
    while(groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);
    if (selectedStone) {
        const key = `${selectedStone.r},${selectedStone.c}`;
        const mesh = stoneMeshes.get(key);
        if (mesh) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(7, 8, 24), matSelection);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(mesh.position.x, mesh.position.y - 1.4, mesh.position.z);
            groupHighlights.add(ring);
        }
    }
    validMoves.forEach(move => {
        const { x, z, y } = get3DCoord(move.r, move.c);
        const ring = new THREE.Mesh(new THREE.RingGeometry(6, 7, 24), matHighlight);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, y + 1.1, z);
        groupHighlights.add(ring);
    });
    needsRender = true;
}

function animate3D(time) {
    const isTweening = TWEEN.update(time);
    const controlsUpdated = controls.update();
    
    groupShips.children.forEach(ship => {
        ship.userData.angle += ship.userData.speed;
        const x = 500 + Math.cos(ship.userData.angle) * ship.userData.radius;
        const z = Math.sin(ship.userData.angle) * ship.userData.radius;
        ship.position.set(x, -5, z);
        ship.rotation.y = -ship.userData.angle + Math.PI / 2;
    });

    if (isTweening || controlsUpdated || needsRender || groupShips.children.length > 0) {
        renderer.render(scene, camera);
        needsRender = false;
    }
}

window.init3DSystem = init3D;
window.rebuild3DBoard = build3DBoard;
window.sync3D = sync3DPieces;
window.animate3DMove = animateMove3D;
window.update3DViews = update3DViews;
window.trigger3DCapture = triggerTrapdoorCapture;

document.addEventListener('DOMContentLoaded', () => init3D());
