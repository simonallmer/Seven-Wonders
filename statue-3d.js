// ============================================
// STATUE GAME 3D VIEW
// Cloud-held stones with throne and legs in holes
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse, groundPlane, clickPlane;
let boardOffsetX = 0, boardOffsetZ = 0;
window.is3DView = true;

// Groups
const groupEnvironment = new THREE.Group();
const groupBoard = new THREE.Group();
const groupPieces = new THREE.Group();
const groupReserve = new THREE.Group();
const groupClouds = new THREE.Group();
const groupThrone = new THREE.Group();
const groupPlacementHints = new THREE.Group();
let needsRender = true;

// Maps
const dieMeshes = new Map();
const fieldMeshes = new Map();
const cloudGroups = { 1: null, 2: null };

const tileSize = 25;

// Hole centers in tile coordinates
const holePositions = [
    { r: 3.5, c: 3.5, player: 1 },  // Top-left hole
    { r: 3.5, c: 6.5, player: 1 },  // Top-right hole
    { r: 6.5, c: 3.5, player: 2 },  // Bottom-left hole
    { r: 6.5, c: 6.5, player: 2 }   // Bottom-right hole
];

function tileTo3D(r, c) {
    return { x: (c - 5) * tileSize, z: (r - 5) * tileSize };
}

// Materials
const matMarble = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.8, metalness: 0.1 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.2, metalness: 0.9 });
const matPlaceHighlight = new THREE.MeshBasicMaterial({ color: 0xD4AF37, transparent: true, opacity: 0.7 });

const stoneColors = { 1: 0xf8f8f8, 2: 0x2a2a2a };

let selectedPlayer = null;
let selectedStoneMesh = null;

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) {
        console.error('Canvas container not found!');
        return;
    }

    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e3a5f);

        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, 180, 400);
        camera.lookAt(0, 30, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100vw';
        renderer.domElement.style.height = '100vh';
        renderer.domElement.style.zIndex = '5';
        renderer.domElement.style.pointerEvents = 'auto';
        renderer.domElement.style.cursor = 'default';
        container.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false; // Disable panning
        controls.minDistance = 100;
        controls.maxDistance = 800;
        controls.addEventListener('change', () => { needsRender = true; });
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.target.set(0, 30, 0);
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // Bright ambient for low-poly look
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        
        // Main sun light
        const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.8);
        sunLight.position.set(200, 400, 100);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -500;
        sunLight.shadow.camera.right = 500;
        sunLight.shadow.camera.top = 500;
        sunLight.shadow.camera.bottom = -500;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        scene.add(sunLight);

        // Soft blue fill from opposite side
        const fillLight = new THREE.DirectionalLight(0x8ab4f8, 0.5);
        fillLight.position.set(-150, 80, -100);
        scene.add(fillLight);
        
        // Rim light from behind
        const rimLight = new THREE.DirectionalLight(0xddeeff, 0.4);
        rimLight.position.set(0, 100, -300);
        scene.add(rimLight);

        scene.add(groupEnvironment);
        scene.add(groupBoard);
        scene.add(groupPieces);
        scene.add(groupReserve);
        scene.add(groupThrone);
        scene.add(groupPlacementHints);

        buildEnvironment();
        buildBoard();
        cacheBoardMeshes();
        buildThrone();
        buildReserveStones();

        window.addEventListener('resize', onWindowResize);
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Add click listener to canvas (single registration only — avoid duplicate fire)
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', onMouseDown);
        canvas.addEventListener('pointerup', onCanvasClick);
        canvas.addEventListener('pointermove', onCanvasMouseMove);

        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelSelection(); });
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const cm = document.getElementById('context-menu');
            if (cm) cm.classList.toggle('active');
        });

        renderer.setAnimationLoop(animate);
        syncBoard3D();
    } catch (e) {
        console.error('3D init error:', e);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function buildEnvironment() {
    // Deep blue gradient sky
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1800, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x1e3a5f, side: THREE.BackSide })
    );
    groupEnvironment.add(sky);

    // Fog for atmosphere
    scene.fog = new THREE.FogExp2(0x4a6fa5, 0.0015);

    // Low-poly floating rock platform (main island)
    buildFloatingIsland(0, -30, 0, 250, 180);
    
    // Background floating islands with temples
    buildFloatingIsland(-350, -80, -200, 120, 80);
    buildFloatingIsland(400, -60, -250, 100, 70);
    buildFloatingIsland(-200, -100, 300, 80, 60);
    buildFloatingIsland(300, -90, 200, 90, 65);
    
    // Background temples on islands
    buildTemple(400, -20, -250);
    buildTemple(-350, -30, -200);
    
    // Distant mountains (low-poly style)
    buildMountain(-400, -50, -400, 200);
    buildMountain(0, -50, -500, 250);
    buildMountain(400, -50, -450, 180);
    buildMountain(-500, -50, -350, 150);
    buildMountain(600, -50, -400, 170);
    
    // Greek columns around the board
    buildColumn(-200, 0, -150);
    buildColumn(-180, 0, 150);
    buildColumn(200, 0, -150);
    buildColumn(180, 0, 150);
    
    // White fluffy clouds
    buildCloudCluster(-150, 80, -300, 3);
    buildCloudCluster(200, 100, -350, 4);
    buildCloudCluster(-300, 120, -200, 2);
    buildCloudCluster(350, 90, -250, 3);
    buildCloudCluster(0, 130, -400, 4);
    buildCloudCluster(-250, 70, 200, 3);
    buildCloudCluster(280, 85, 250, 2);
}

function buildFloatingIsland(x, y, z, width, depth) {
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0xc4b896,
        roughness: 0.9,
        metalness: 0.05
    });
    
    // Main flat top
    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.5, width * 0.45, 15, 8),
        rockMat
    );
    top.position.set(x, y, z);
    top.castShadow = true;
    top.receiveShadow = true;
    groupEnvironment.add(top);
    
    // Rocky bottom
    const bottom = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.4, depth, 6),
        rockMat
    );
    bottom.position.set(x, y - depth / 2 - 8, z);
    bottom.castShadow = true;
    groupEnvironment.add(bottom);
}

function buildMountain(x, y, z, height) {
    const mountainMat = new THREE.MeshStandardMaterial({
        color: 0x8a9baa,
        roughness: 0.85
    });
    
    const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(height * 0.8, height, 5),
        mountainMat
    );
    mountain.position.set(x, y + height / 2, z);
    mountain.castShadow = true;
    groupEnvironment.add(mountain);
    
    // Snow cap
    const snowMat = new THREE.MeshStandardMaterial({
        color: 0xf0f5ff,
        roughness: 0.7
    });
    const snowCap = new THREE.Mesh(
        new THREE.ConeGeometry(height * 0.25, height * 0.25, 5),
        snowMat
    );
    snowCap.position.set(x, y + height * 0.85, z);
    groupEnvironment.add(snowCap);
}

function buildTemple(x, y, z) {
    const templeMat = new THREE.MeshStandardMaterial({
        color: 0xe8dcc8,
        roughness: 0.7
    });
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        roughness: 0.3,
        metalness: 0.8
    });
    
    // Base platform
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(60, 8, 40),
        templeMat
    );
    base.position.set(x, y + 4, z);
    base.castShadow = true;
    base.receiveShadow = true;
    groupEnvironment.add(base);
    
    // Steps
    for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(50 - i * 8, 4, 8),
            templeMat
        );
        step.position.set(x, y + 8 + i * 4, z + 18 - i * 3);
        groupEnvironment.add(step);
    }
    
    // Columns
    const colPositions = [[-20, 15], [-10, 15], [0, 15], [10, 15], [20, 15], [-20, -10], [20, -10]];
    colPositions.forEach(([cx, cz]) => {
        const col = new THREE.Mesh(
            new THREE.CylinderGeometry(2, 2.5, 35, 6),
            templeMat
        );
        col.position.set(x + cx, y + 25, z + cz);
        col.castShadow = true;
        groupEnvironment.add(col);
    });
    
    // Roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(65, 5, 45),
        templeMat
    );
    roof.position.set(x, y + 45, z);
    roof.castShadow = true;
    groupEnvironment.add(roof);
    
    // Triangular pediment
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-32, 0);
    pedimentShape.lineTo(32, 0);
    pedimentShape.lineTo(0, 20);
    pedimentShape.closePath();
    
    const pedimentGeom = new THREE.ExtrudeGeometry(pedimentShape, { depth: 3, bevelEnabled: false });
    const pediment = new THREE.Mesh(pedimentGeom, templeMat);
    pediment.position.set(x, y + 47, z + 21);
    groupEnvironment.add(pediment);
    
    // Golden roof
    const goldenRoof = new THREE.Mesh(
        new THREE.BoxGeometry(55, 3, 35),
        goldMat
    );
    goldenRoof.position.set(x, y + 48, z);
    groupEnvironment.add(goldenRoof);
}

function buildColumn(x, y, z) {
    const colMat = new THREE.MeshStandardMaterial({
        color: 0xe0d8c8,
        roughness: 0.6
    });
    
    // Base
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(12, 6, 12),
        colMat
    );
    base.position.set(x, y + 3, z);
    base.castShadow = true;
    groupEnvironment.add(base);
    
    // Column shaft
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5, 50, 8),
        colMat
    );
    shaft.position.set(x, y + 31, z);
    shaft.castShadow = true;
    groupEnvironment.add(shaft);
    
    // Capital
    const capital = new THREE.Mesh(
        new THREE.BoxGeometry(14, 8, 14),
        colMat
    );
    capital.position.set(x, y + 57, z);
    groupEnvironment.add(capital);
}

function buildCloudCluster(x, y, z, count) {
    const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        transparent: true,
        opacity: 0.95
    });
    
    for (let i = 0; i < count; i++) {
        const size = 25 + Math.random() * 30;
        const cloud = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            cloudMat
        );
        cloud.position.set(
            x + (Math.random() - 0.5) * 60,
            y + (Math.random() - 0.5) * 20,
            z + (Math.random() - 0.5) * 40
        );
        cloud.scale.set(1.2, 0.6, 1);
        cloud.userData.baseY = cloud.position.y;
        groupEnvironment.add(cloud);
        groupClouds.add(cloud);
    }
}

function buildBoard() {
    const boardWidth = 11 * tileSize;
    const tileHeight = 8;
    
    // 11x11 tiles with 4 holes (2x2 each) in corners of center
    for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
            const key = `${r},${c}`;
            if (removedSquares.has(key)) continue;

            const tileMat = new THREE.MeshStandardMaterial({
                color: 0xf5f0e8,
                roughness: 0.8,
                metalness: 0.1,
                emissive: 0x000000,
                emissiveIntensity: 0
            });
            const tile = new THREE.Mesh(
                new THREE.BoxGeometry(tileSize - 1, tileHeight, tileSize - 1),
                tileMat
            );
            tile.position.set((c - 5) * tileSize, -tileHeight/2, (r - 5) * tileSize);
            tile.receiveShadow = true;
            tile.castShadow = true;
            tile.userData = { isField: true, r, c };
            groupBoard.add(tile);
            fieldMeshes.set(key, tile);
        }
    }

    // Transparent click plane for easier raycasting
    const clickPlaneMat = new THREE.MeshBasicMaterial({ 
        visible: false, 
        side: THREE.DoubleSide 
    });
    clickPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(boardWidth + 20, boardWidth + 20),
        clickPlaneMat
    );
    clickPlane.rotation.x = -Math.PI / 2;
    clickPlane.position.y = 1;
    clickPlane.userData.isClickPlane = true;
    groupBoard.add(clickPlane);

    // Pedestal base
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth + 40, 20, boardWidth + 40),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5 })
    );
    base.position.y = -tileHeight - 10;
    groupBoard.add(base);

    const trim = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth + 5, 8, boardWidth + 5),
        matGold
    );
    trim.position.y = -tileHeight/2 - 4;
    groupBoard.add(trim);
}

let zeusStaff = null;
let zeusStaffLight = null;

function buildThrone() {
    const throneMat = matGold.clone();
    const legHeight = 50;
    
    // Solid gold material for chair
    const goldChairMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        roughness: 0.3,
        metalness: 0.8
    });
    
    // Chair legs - gold
    holePositions.forEach(hole => {
        const { x, z } = tileTo3D(hole.r, hole.c);
        
        // Main leg - gold
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(5, 7, legHeight, 12),
            goldChairMat
        );
        leg.position.set(x, legHeight / 2, z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        groupThrone.add(leg);
        
        // Gold ring at top
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(6, 1.5, 8, 16),
            throneMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, legHeight, z);
        groupThrone.add(ring);
    });
    
    // Seat platform - gold
    const seatWidth = tileSize * 3.2;
    const seatDepth = tileSize * 3.2;
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(seatWidth, 8, seatDepth),
        goldChairMat
    );
    seat.position.y = legHeight + 4;
    seat.castShadow = true;
    seat.receiveShadow = true;
    groupThrone.add(seat);

    // Decorative seat trim
    const trimFront = new THREE.Mesh(
        new THREE.BoxGeometry(seatWidth + 4, 3, 4),
        throneMat
    );
    trimFront.position.set(0, legHeight, seatDepth / 2 + 2);
    groupThrone.add(trimFront);
    
    const trimLeft = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, seatDepth + 4),
        throneMat
    );
    trimLeft.position.set(-seatWidth / 2 - 2, legHeight, 0);
    groupThrone.add(trimLeft);
    
    const trimRight = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, seatDepth + 4),
        throneMat
    );
    trimRight.position.set(seatWidth / 2 + 2, legHeight, 0);
    groupThrone.add(trimRight);

    // Throne back - gold
    const backHeight = 60;
    const back = new THREE.Mesh(
        new THREE.BoxGeometry(seatWidth, backHeight, 6),
        goldChairMat
    );
    back.position.set(0, legHeight + 4 + backHeight / 2, -seatDepth / 2 - 3);
    back.castShadow = true;
    groupThrone.add(back);

    // Armrests - gold
    const armrestGeom = new THREE.BoxGeometry(6, 4, seatDepth * 0.7);
    const armrestLeft = new THREE.Mesh(armrestGeom, goldChairMat);
    armrestLeft.position.set(-seatWidth / 2 - 3, legHeight + 15, -seatDepth * 0.15);
    groupThrone.add(armrestLeft);
    
    const armrestRight = new THREE.Mesh(armrestGeom, goldChairMat);
    armrestRight.position.set(seatWidth / 2 + 3, legHeight + 15, -seatDepth * 0.15);
    groupThrone.add(armrestRight);

    // Zeus figure on the seat - gold
    const zeusGoldMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        roughness: 0.3,
        metalness: 0.8
    });
    const zeusGroup = new THREE.Group();
    zeusGroup.position.y = legHeight + 8;
    
    // Body - muscular torso - gold
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 14, 35, 8),
        zeusGoldMat
    );
    torso.position.y = 20;
    zeusGroup.add(torso);
    
    // Shoulders - gold
    const shoulderGeom = new THREE.SphereGeometry(6, 12, 12);
    const leftShoulder = new THREE.Mesh(shoulderGeom, zeusGoldMat);
    leftShoulder.position.set(-10, 35, 0);
    zeusGroup.add(leftShoulder);
    
    const rightShoulder = new THREE.Mesh(shoulderGeom, zeusGoldMat);
    rightShoulder.position.set(10, 35, 0);
    zeusGroup.add(rightShoulder);
    
    // Head - gold
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(10, 16, 16),
        zeusGoldMat
    );
    head.position.y = 48;
    head.scale.set(1, 1.1, 1);
    head.userData.isZeusHead = true; // Keepable tag
    zeusGroup.add(head);
    
    // Angry/intense eyes indication (small spheres) - glass
    const eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x333333,
        transmission: 0.7,
        transparent: true,
        opacity: 0.6
    });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), eyeMat);
    leftEye.position.set(-4, 50, 8);
    leftEye.userData.isZeusHead = true;
    zeusGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), eyeMat);
    rightEye.position.set(4, 50, 8);
    rightEye.userData.isZeusHead = true;
    zeusGroup.add(rightEye);
    
    // Majestic beard - long and curly
    const beard = new THREE.Mesh(
        new THREE.ConeGeometry(8, 18, 12),
        matGold
    );
    beard.position.set(0, 32, 6);
    beard.rotation.x = -Math.PI / 3;
    beard.userData.isZeusHead = true;
    zeusGroup.add(beard);
    
    // Curly hair strands - flowing Greek god style
    for (let i = 0; i < 8; i++) {
        const curl = new THREE.Mesh(
            new THREE.TorusGeometry(3, 1.2, 6, 8, Math.PI),
            matGold
        );
        curl.position.set(-9 + i * 2.5, 54, -3);
        curl.rotation.z = (i - 3.5) * 0.15;
        curl.rotation.y = Math.PI;
        curl.userData.isZeusHead = true;
        zeusGroup.add(curl);
    }
    
    // Flowing hair at sides - wavy strands
    const hairStrandMat = matGold.clone();
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
            const strand = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 0.5, 25 + i * 5, 6),
                hairStrandMat
            );
            strand.position.set(side * 12, 35 - i * 3, -5 + i);
            strand.rotation.z = side * (0.2 + i * 0.1);
            strand.rotation.x = 0.3;
            zeusGroup.add(strand);
        }
    }
    
    // Laurel wreath crown
    const laurelMat = matGold.clone();
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 5; i++) {
            const leaf = new THREE.Mesh(
                new THREE.SphereGeometry(3, 6, 4),
                laurelMat
            );
            leaf.scale.set(1, 1.5, 0.3);
            leaf.position.set(side * (8 + i * 1.5), 60 - i * 2, 2);
            leaf.rotation.z = side * (Math.PI / 3);
            leaf.rotation.y = side * 0.3;
            zeusGroup.add(leaf);
        }
    }
    
    // Robe/Base - flowing
    const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(16, 24, 25, 8),
        matGold
    );
    robe.position.y = 2;
    zeusGroup.add(robe);
    
    // Lightning bolt crown
    const crown = new THREE.Mesh(
        new THREE.TorusGeometry(8, 1.5, 8, 16),
        matGold
    );
    crown.position.y = 58;
    crown.userData.isZeusHead = true;
    zeusGroup.add(crown);
    
    // Lightning bolts on sides of crown
    const boltGeom = new THREE.ConeGeometry(2, 10, 4);
    const leftBolt = new THREE.Mesh(boltGeom, new THREE.MeshStandardMaterial({ color: 0xFFFF88, emissive: 0xFFFF44, emissiveIntensity: 0.5 }));
    leftBolt.position.set(-8, 62, 0);
    leftBolt.rotation.z = Math.PI / 4;
    leftBolt.userData.isZeusHead = true;
    zeusGroup.add(leftBolt);
    
    const rightBolt = new THREE.Mesh(boltGeom, new THREE.MeshStandardMaterial({ color: 0xFFFF88, emissive: 0xFFFF44, emissiveIntensity: 0.5 }));
    rightBolt.position.set(8, 62, 0);
    rightBolt.rotation.z = -Math.PI / 4;
    rightBolt.userData.isZeusHead = true;
    zeusGroup.add(rightBolt);

    // THE STAFF - Zeus's lightning bolt
    zeusStaff = new THREE.Group();
    
    // Staff shaft
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 60, 8),
        matGold
    );
    zeusStaff.add(shaft);
    
    // Lightning crystal at top
    const crystalMat = new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        emissive: 0x444444, 
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });
    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(6, 0),
        crystalMat
    );
    crystal.position.y = 35;
    crystal.rotation.y = Math.PI / 4;
    zeusStaff.add(crystal);
    
    // Inner glow sphere
    const glowMat = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(4, 16, 16),
        glowMat
    );
    glow.position.y = 35;
    zeusStaff.add(glow);
    
    // Point the staff diagonally
    zeusStaff.position.set(15, 15, 5);
    zeusStaff.rotation.z = -0.4;
    zeusStaff.rotation.x = 0.2;
    zeusStaff.userData.crystal = crystal;
    zeusStaff.userData.glow = glow;
    zeusStaff.userData.shaft = shaft;
    
    zeusGroup.add(zeusStaff);
    
    // Point light emanating from crystal
    zeusStaffLight = new THREE.PointLight(0xFFFFFF, 0.5, 100);
    zeusStaffLight.position.set(15, 50, 5);
    zeusGroup.add(zeusStaffLight);

    groupThrone.add(zeusGroup);
     
    // Scale Zeus up to be more prominent
    zeusGroup.scale.set(1.4, 1.4, 1.4);
    zeusGroup.position.y = legHeight + 5;
    
    scene.add(groupThrone);
    
    // Initial update
    updateZeusStaffColor();
}

function updateZeusStaffColor() {
    if (!zeusStaff) return;
    
    const p1OnBoard = onBoardDice.filter(d => d.player === 1).length;
    const p2OnBoard = onBoardDice.filter(d => d.player === 2).length;
    const p1Total = p1OnBoard + (window.reserveDice ? window.reserveDice[1] : 0);
    const p2Total = p2OnBoard + (window.reserveDice ? window.reserveDice[2] : 0);
    
    let color, emissiveColor, lightColor;
    
    if (p1Total > p2Total) {
        color = 0xFFFFFF;
        emissiveColor = 0xFFFFFF;
        lightColor = 0xFFFFFF;
    } else if (p2Total > p1Total) {
        color = 0x222222;
        emissiveColor = 0x444444;
        lightColor = 0x666666;
    } else {
        // Equal - Grey
        color = 0x888888;
        emissiveColor = 0x444444;
        lightColor = 0xAAAAAA;
    }
    
    const crystal = zeusStaff.userData.crystal;
    const glow = zeusStaff.userData.glow;
    
    crystal.material.color.setHex(color);
    crystal.material.emissive.setHex(emissiveColor);
    crystal.material.emissiveIntensity = p1Total === p2Total ? 0.3 : 0.8;
    
    glow.material.color.setHex(lightColor);
    
    if (zeusStaffLight) {
        zeusStaffLight.color.setHex(lightColor);
        zeusStaffLight.intensity = (p1Total === p2Total) ? 0.3 : 1.2;
    }
}

window.updateTurnIndicator3D = function(player) {
    // Scepter lighting now reflects OVERALL advantage (stones on board + reserve)
    // instead of current turn, as requested.
    updateZeusStaffColor();
    
    updateCloudHighlight(player);
};

function createCloud(color, player) {
    const cloudGroup = new THREE.Group();
    cloudGroup.userData = { player, baseY: 0, time: Math.random() * Math.PI * 2, isCloud: true };
    
    const cloudMat = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        roughness: 1
    });
    
    // Fluffy cloud shape
    const spheres = [
        { x: 0, y: 0, z: 0, r: 45 },
        { x: -35, y: -8, z: 0, r: 32 },
        { x: 35, y: -8, z: 0, r: 32 },
        { x: 0, y: 12, z: 0, r: 28 },
        { x: -20, y: 6, z: -12, r: 24 },
        { x: 20, y: 6, z: -12, r: 24 },
    ];
    
    spheres.forEach(s => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(s.r, 16, 12),
            cloudMat
        );
        sphere.position.set(s.x, s.y, s.z);
        sphere.userData.isCloudPart = true;
        cloudGroup.add(sphere);
    });
    
    return cloudGroup;
}

function buildClouds() {
    // White cloud (left)
    cloudGroups[1] = createCloud(0xffffff, 1);
    cloudGroups[1].position.set(-280, 40, 0);
    cloudGroups[1].userData.baseY = 40;
    groupClouds.add(cloudGroups[1]);
    
    // Black cloud (right)
    cloudGroups[2] = createCloud(0x2a2a2a, 2);
    cloudGroups[2].position.set(280, 40, 0);
    cloudGroups[2].userData.baseY = 40;
    groupClouds.add(cloudGroups[2]);
    
    // Big clickable areas for each cloud
    const cloud1Click = new THREE.Mesh(
        new THREE.BoxGeometry(120, 80, 100),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    cloud1Click.position.set(-280, 40, 0);
    cloud1Click.userData = { isCloudArea: true, player: 1 };
    groupCloudClickables.add(cloud1Click);
    
    const cloud2Click = new THREE.Mesh(
        new THREE.BoxGeometry(120, 80, 100),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    cloud2Click.position.set(280, 40, 0);
    cloud2Click.userData = { isCloudArea: true, player: 2 };
    groupCloudClickables.add(cloud2Click);
    
    scene.add(groupClouds);
    scene.add(groupCloudClickables);
    
    // Initial turn indicator
    updateCloudHighlight(1);
}

function updateCloudHighlight(player) {
    [1, 2].forEach(p => {
        const cloud = cloudGroups[p];
        if (!cloud) return;
        
        cloud.children.forEach(child => {
            if (child.material) {
                if (p === player) {
                    cloud.children[0].material.emissive.setHex(p === 1 ? 0xCCCCCC : 0x444444);
                    cloud.children[0].material.emissiveIntensity = 0.3;
                } else {
                    cloud.children[0].material.emissive.setHex(0x000000);
                    cloud.children[0].material.emissiveIntensity = 0;
                }
            }
        });
        
        // Move active cloud up
        cloud.userData.baseY = p === player ? 50 : 40;
    });
}

function createStoneMesh(player, strength) {
    const group = new THREE.Group();
    group.userData.strength = strength;
    group.userData.player = player;
    group.userData.isReserveStone = true;
    
    const stoneColor = stoneColors[player];
    
    const bodyMat = new THREE.MeshStandardMaterial({
        color: stoneColor,
        roughness: 0.25,
        metalness: 0.3
    });
    
    // Large invisible hitbox for easy clicking
    const hitbox = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 14, 22, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData = group.userData;
    group.add(hitbox);
    
    // Body cylinder
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 11, 12, 24),
        bodyMat
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Dome top
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(10, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        bodyMat
    );
    dome.position.y = 6;
    group.add(dome);
    
    // Gold ring
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(10, 1.5, 12, 32),
        matGold
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5.5;
    group.add(ring);
    
    // Number sprite
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(strength.toString(), 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(14, 14, 1);
    sprite.position.y = 18;
    group.add(sprite);
    
    group.userData.sprite = sprite;
    group.userData.canvas = canvas;
    group.userData.ctx = ctx;
    
    return group;
}

function updateStoneStrength(stoneMesh, strength) {
    if (!stoneMesh) return;
    stoneMesh.userData.strength = strength;
    
    const ctx = stoneMesh.userData.ctx;
    if (!ctx) return; // Safety check - ctx might not be set up
    
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(strength.toString(), 32, 32);
    
    if (stoneMesh.userData.sprite && stoneMesh.userData.sprite.material) {
        stoneMesh.userData.sprite.material.map.needsUpdate = true;
    }
}

function buildReserveStones() {
    // Clear existing reserve stones
    while (groupReserve.children.length > 0) {
        groupReserve.remove(groupReserve.children[0]);
    }
    
    // Build golden plates first
    buildReservePlates();
    
    // White stones on LEFT side - centered vertically relative to board
    const leftX = -155;
    const centerZ = 0; // Center of board
    const spacing = 28;
    const startZ = centerZ - (reserveDice[1] - 1) * spacing / 2;
    
    for (let i = 0; i < reserveDice[1]; i++) {
        const mesh = createStoneMesh(1, 1);
        mesh.position.set(leftX, 8, startZ + i * spacing);
        mesh.scale.set(0.85, 0.85, 0.85);
        mesh.userData.isReserveStone = true;
        mesh.userData.player = 1;
        groupReserve.add(mesh);
    }
    
    // Black stones on RIGHT side - centered vertically relative to board
    const rightX = 155;
    const startZ2 = centerZ - (reserveDice[2] - 1) * spacing / 2;
    
    for (let i = 0; i < reserveDice[2]; i++) {
        const mesh = createStoneMesh(2, 1);
        mesh.position.set(rightX, 8, startZ2 + i * spacing);
        mesh.scale.set(0.85, 0.85, 0.85);
        mesh.userData.isReserveStone = true;
        mesh.userData.player = 2;
        groupReserve.add(mesh);
    }
}

function buildReservePlates() {
    // Match the board tile height (tiles are at y = -4, so top is at y = 0)
    const plateY = 0;
    
    // Golden material for plates
    const plateMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        roughness: 0.3,
        metalness: 0.8
    });
    
    // Create rounded rectangle shape
    function createRoundedPlate(width, height, depth, radius) {
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -depth / 2;
        
        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + depth - radius);
        shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
        shape.lineTo(x + radius, y + depth);
        shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);
        
        const extrudeSettings = {
            depth: height,
            bevelEnabled: true,
            bevelThickness: 1,
            bevelSize: 1,
            bevelSegments: 3
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(-Math.PI / 2);
        return geometry;
    }
    
    const plateWidth = 25;
    const plateDepth = 250;
    const plateHeight = 6;
    const radius = 4;
    
    // Left plate
    const leftGeom = createRoundedPlate(plateWidth, plateHeight, plateDepth, radius);
    const leftPlate = new THREE.Mesh(leftGeom, plateMat);
    leftPlate.position.set(-155, plateY, 0);
    leftPlate.castShadow = true;
    leftPlate.receiveShadow = true;
    leftPlate.userData = { isReservePlate: true, player: 1 };
    groupReserve.add(leftPlate);
    
    // Right plate
    const rightGeom = createRoundedPlate(plateWidth, plateHeight, plateDepth, radius);
    const rightPlate = new THREE.Mesh(rightGeom, plateMat);
    rightPlate.position.set(155, plateY, 0);
    rightPlate.castShadow = true;
    rightPlate.receiveShadow = true;
    rightPlate.userData = { isReservePlate: true, player: 2 };
    groupReserve.add(rightPlate);
    
    // Add large invisible click planes for easier reserve selection
    const clickPlaneMat = new THREE.MeshBasicMaterial({ visible: false });
    
    // Left click plane
    const leftClickPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 280),
        clickPlaneMat
    );
    leftClickPlane.rotation.x = -Math.PI / 2;
    leftClickPlane.position.set(-155, 5, 0);
    leftClickPlane.userData = { isReserveClickPlane: true, player: 1 };
    groupReserve.add(leftClickPlane);
    
    // Right click plane
    const rightClickPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 280),
        clickPlaneMat
    );
    rightClickPlane.rotation.x = -Math.PI / 2;
    rightClickPlane.position.set(155, 5, 0);
    rightClickPlane.userData = { isReserveClickPlane: true, player: 2 };
    groupReserve.add(rightClickPlane);
}

function syncBoard3D() {
    while (groupPieces.children.length > 0) {
        groupPieces.remove(groupPieces.children[0]);
    }
    dieMeshes.clear();

    onBoardDice.forEach(die => {
        const mesh = createStoneMesh(die.player, die.value);
        const { x, z } = tileTo3D(die.r, die.c);
        mesh.position.set(x, 4, z);
        mesh.scale.set(0.85, 0.85, 0.85);
        mesh.userData = { id: die.id, r: die.r, c: die.c, player: die.player, dieId: die.id };
        mesh.userData.isReserveStone = false;
        groupPieces.add(mesh);
        dieMeshes.set(die.id, mesh);
    });

    // Only clear selection hints if NOT in STRIDE mode (preserve STRIDE target markers)
    const currentPhase = window.gamePhase ? window.gamePhase() : 'ACTION_SELECT';
    if (currentPhase !== 'STRIDE_MOVE') {
        cancelSelection();
    }
    needsRender = true;
    
    // Show markers for FORCED_MOVE_SELECT phase
    if (currentPhase === 'FORCED_MOVE_SELECT') {
        showForcedMoveMarkers();
    }
    
    buildReserveStones();
    updateZeusStaffColor();
}

function cancelSelection() {
    if (selectedStoneMesh) {
        selectedStoneMesh.visible = true;
        selectedStoneMesh = null;
    }
    selectedPlayer = null;
    clearPlacementHints();
}

window.clearHeldDie = cancelSelection;
window.clearPlacementHints3D = clearPlacementHints;
window.syncBoard3D = syncBoard3D;
window.updateBoardReserve3D = buildReserveStones;

function clearPlacementHints() {
    while (groupPlacementHints.children.length > 0) {
        groupPlacementHints.remove(groupPlacementHints.children[0]);
    }
}

let hoveredField = null;
let hoveredFieldMesh = null;

let lastHoverTime = 0;
const HOVER_THROTTLE = 16;
let hoveredObject = null;
let originalEmissive = null;
let hoveredStone = null;
let hoveredStoneOriginalColors = [];

function updateHoverEffect() {
    if (!window.is3DView || !scene || !camera) return;
    
    const now = performance.now();
    if (now - lastHoverTime < HOVER_THROTTLE) return;
    lastHoverTime = now;
    
    // Reset previous field hover
    if (hoveredObject && originalEmissive !== null) {
        if (hoveredObject.material) {
            hoveredObject.material.emissive.setHex(originalEmissive);
        }
        hoveredObject = null;
        originalEmissive = null;
    }
    
    // Reset previous stone hover
    if (hoveredStone) {
        hoveredStone.forEach(child => {
            if (child.material && child.originalEmissive !== undefined) {
                child.material.emissive.setHex(child.originalEmissive);
            }
        });
        hoveredStone = null;
    }
    
    // Reset markers to their colors
    groupPlacementHints.children.forEach(hint => {
        if (hint.userData.isStrideTarget && hint.material) {
            if (hint.userData.isForcedMoveMarker) {
                hint.material.color.setHex(0xFF6600); // Orange for forced move
            } else {
                hint.material.color.setHex(0x00FF00); // Green for stride
            }
        }
    });
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check for statue head hover to give feedback it's clickable (only if not already triggered to hide)
    if (!window.statuePermanentlyHidden) {
        const headIntersects = raycaster.intersectObjects([groupThrone], true);
        if (headIntersects.length > 0) {
            let headCheck = headIntersects[0].object;
            while (headCheck) {
                if (headCheck.userData && headCheck.userData.isZeusHead) {
                    document.body.style.cursor = 'pointer';
                    return;
                }
                headCheck = headCheck.parent;
            }
        }
    }
    
    // Use click plane for field detection (most reliable)
    let r = null, c = null;
    if (clickPlane) {
        const planeIntersects = raycaster.intersectObject(clickPlane);
        if (planeIntersects.length > 0) {
            const point = planeIntersects[0].point;
            c = Math.round(point.x / tileSize + 5);
            r = Math.round(point.z / tileSize + 5);
        }
    }
    
    // Also check for stone/marker hits
    const stoneTargets = [...groupPieces.children, ...groupPlacementHints.children];
    const stoneIntersects = raycaster.intersectObjects(stoneTargets, true);
    
    // Check if hit a STRIDE or FORCED_MOVE target marker
    if (stoneIntersects.length > 0) {
        let hitObj = stoneIntersects[0].object;
        if (hitObj.userData && hitObj.userData.isStrideTarget) {
            if (hitObj.material) {
                hitObj.material.color.setHex(0xFFFF00);
            }
            document.body.style.cursor = 'pointer';
            return;
        }
    }
    
    // Get grid position from click plane
    if (r !== null && c !== null && r >= 0 && r < 11 && c >= 0 && c < 11) {
        const key = `${r},${c}`;
        
        if (removedSquares.has(key)) {
            document.body.style.cursor = 'default';
            return;
        }
        
        // Check game state
        const diceOnBoard = window.getOnBoardDice ? window.getOnBoardDice() : onBoardDice;
        const die = diceOnBoard.find(d => d.r === r && d.c === c);
        const currentPhase = window.gamePhase ? window.gamePhase() : 'ACTION_SELECT';
        const player = window.getCurrentPlayer ? window.getCurrentPlayer() : 1;
        const reserves = window.getReserveDice ? window.getReserveDice() : { 1: 0, 2: 0 };
        
        let canInteract = false;
        
        if (currentPhase === 'ACTION_SELECT') {
            // Can place on empty field with reserve
            if (!die && reserves[player] > 0) {
                canInteract = true;
                // Darken the field to show it's selectable
                const field = cachedFieldMeshes.get(key);
                if (field && field.material) {
                    hoveredField = field;
                    field.material.emissive.setHex(0x444444);
                    field.material.emissiveIntensity = 0.5;
                }
            }
            // Can click on own stone to move it
            else if (die && die.player === player) {
                canInteract = true;
            }
        } else if (currentPhase === 'STRIDE_MOVE') {
            // Check if this is a valid 1-field STRIDE target
            const selectedDie = window.getSelectedDie ? window.getSelectedDie() : null;
            if (selectedDie) {
                // Only 1 field at a time
                const directions = [
                    { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
                    { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
                ];
                
                for (const dir of directions) {
                    const checkR = selectedDie.r + dir.dr;
                    const checkC = selectedDie.c + dir.dc;
                    
                    if (checkR === r && checkC === c) {
                        const targetDie = diceOnBoard.find(d => d.r === r && d.c === c);
                        // Can move if empty or capturable opponent (value > 1)
                        if (!targetDie || (targetDie.player !== player && targetDie.value > 1)) {
                            canInteract = true;
                        }
                        break;
                    }
                }
            }
            
            // Also allow clicking on own stones to change selection
            if (die && die.player === player) {
                canInteract = true;
            }
        } else if (currentPhase === 'FORCED_MOVE_SELECT') {
            // Can only click on own value-1 stones that can move
            if (die && die.player === player && die.value === 1) {
                // Check if this stone can move (has adjacent empty space or capturable opponent)
                const directions = [
                    { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
                    { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
                ];
                for (const dir of directions) {
                    const checkR = die.r + dir.dr;
                    const checkC = die.c + dir.dc;
                    if (typeof window.isWithinBounds === 'function' ? window.isWithinBounds(checkR, checkC) : (checkR >= 0 && checkR < 11 && checkC >= 0 && checkC < 11)) {
                        const occupant = diceOnBoard.find(d => d.r === checkR && d.c === checkC);
                        if (!occupant || (occupant.player !== player && occupant.value > 1)) {
                            canInteract = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (canInteract) {
            // Highlight the stone if there is one
            if (die) {
                const stoneMesh = dieMeshes.get(die.id);
                if (stoneMesh) {
                    hoveredStone = [];
                    stoneMesh.children.forEach(child => {
                        if (child.material && child.material.emissive && !child.material.transparent) {
                            // Store original emissive
                            child.originalEmissive = child.material.emissive.getHex();
                            hoveredStone.push(child);
                            // Add subtle glow
                            child.material.emissive.setHex(0x888888);
                            child.material.emissiveIntensity = 0.3;
                        }
                    });
                }
            } else {
                // Highlight empty field
                const field = fieldMeshes.get(key);
                if (field && field.material) {
                    hoveredObject = field;
                    originalEmissive = field.material.emissive.getHex();
                    field.material.emissive.setHex(0x888888);
                }
            }
            
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'not-allowed';
        }
        
        hoveredField = { r, c };
    } else {
        hoveredField = null;
        document.body.style.cursor = 'default';
    }
}

let cachedBoardMeshes = [];
let cachedFieldMeshes = new Map();

function cacheBoardMeshes() {
    cachedBoardMeshes = [];
    cachedFieldMeshes = new Map();
    groupBoard.traverse(child => {
        if (child.isMesh && child.userData && child.userData.isField) {
            cachedBoardMeshes.push(child);
            const key = `${child.userData.r},${child.userData.c}`;
            cachedFieldMeshes.set(key, child);
        }
    });
    console.log('Cached', cachedBoardMeshes.length, 'board tiles');
}

// Drag detection — compare mousedown position vs click position at the moment the click fires.
// Using stateless distance check avoids isDragging being set incorrectly by hover mousemove events.
let mouseDownX = 0;
let mouseDownY = 0;
let cameraStartAzimuth = 0;
let cameraStartPolar = 0;
let cameraStartDistance = 0;
const DRAG_THRESHOLD_PX = 40; // Increased for better mobile tolerance
let isTouch = false;

function onMouseDown(event) {
    isTouch = event.pointerType === 'touch';
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    // Store camera state to detect if it was rotated/zoomed
    if (controls) {
        cameraStartAzimuth = controls.getAzimuthalAngle();
        cameraStartPolar = controls.getPolarAngle();
        cameraStartDistance = camera.position.distanceTo(controls.target);
    }
}
function onCanvasClick(event) {
    // If it's AI's turn, block human input
    if (window.isAIGame && window.isAIGame() && window.getCurrentPlayer && window.getCurrentPlayer() === 2) {
        console.log('Interaction blocked: Computer is thinking...');
        return;
    }
    
    console.log('onCanvasClick fired', event.clientX, event.clientY);
    if (!window.is3DView || !scene || !camera || !renderer) return;
    if (event.target !== renderer.domElement) return;

    // Drag detection check
    const dx = event.clientX - mouseDownX;
    const dy = event.clientY - mouseDownY;
    const distSq = dx * dx + dy * dy;
    const threshold = isTouch ? DRAG_THRESHOLD_PX * 1.5 : DRAG_THRESHOLD_PX;
    const isDrag = distSq > (threshold * threshold);
    
    // Also check if camera moved significantly to prevent accidental clicks
    let cameraMoved = false;
    if (controls) {
        const deltaAzimuth = Math.abs(controls.getAzimuthalAngle() - cameraStartAzimuth);
        const deltaPolar = Math.abs(controls.getPolarAngle() - cameraStartPolar);
        if (deltaAzimuth > 0.05 || deltaPolar > 0.05) cameraMoved = true;
    }

    if (isDrag || cameraMoved) {
        // Only log if it was a significant move to avoid spam
        if (distSq > 100) console.log('Interaction ignored: drag or camera move detected');
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    // Get all board tiles for click detection
    // Get all board tiles for click detection, plus throne for accessibility (if not hidden)
    const allBoardTargets = [...cachedBoardMeshes, ...groupPieces.children];
    const allTargets = window.statuePermanentlyHidden ? allBoardTargets : [...allBoardTargets, groupThrone];
    
    console.log('Click targets:', cachedBoardMeshes.length, 'tiles,', groupPieces.children.length, 'pieces');
    const intersects = raycaster.intersectObjects(allTargets, true);
    console.log('Intersects found:', intersects.length);
    
    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        
        // Check if we clicked on Zeus's head for the secret fade-out (only if not already hidden)
        if (!window.statuePermanentlyHidden) {
            let headCheck = hitObj;
            while (headCheck) {
                if (headCheck.userData && headCheck.userData.isZeusHead) {
                    console.log("Zeus head clicked! Fading out statue...");
                    triggerStatueFadeOut();
                    return; // Consume the click
                }
                headCheck = headCheck.parent;
            }
        }
        
        // Walk up to find userData with r and c
        while (hitObj && hitObj.userData && hitObj.userData.r === undefined) {
            hitObj = hitObj.parent;
        }
        
        if (hitObj && hitObj.userData && hitObj.userData.r !== undefined) {
            const r = hitObj.userData.r;
            const c = hitObj.userData.c;
            const key = `${r},${c}`;
            
            if (r >= 0 && r < 11 && c >= 0 && c < 11 && !removedSquares.has(key)) {
                if (typeof window.handle3DClick === 'function') {
                    window.handle3DClick(r, c);
                }
            }
        }
    }
}

function onCanvasMouseMove(event) {
    if (!window.is3DView) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    updateHoverEffect();
}

window.animateMove3D = animateMove3D;

window.testPlaceStone = function(r, c) {
    console.log('Test: placing stone at', r, c);
    if (typeof window.handle3DClick === 'function') {
        window.handle3DClick(r, c);
    }
};

window.updateStoneStrength3D = function(dieId, strength) {
    const mesh = dieMeshes.get(dieId);
    if (mesh) updateStoneStrength(mesh, strength);
};

function animateMove3D(dieId, targetR, targetC, onComplete) {
    const mesh = dieMeshes.get(dieId);
    if (!mesh) { if (onComplete) onComplete(); return; }

    const { x, z } = tileTo3D(targetR, targetC);

    new TWEEN.Tween(mesh.position)
        .to({ x, z, y: 20 }, 300)
        .easing(TWEEN.Easing.Quadratic.Out)
        .chain(
            new TWEEN.Tween(mesh.position)
                .to({ y: 4 }, 200)
                .easing(TWEEN.Easing.Quadratic.In)
                .onComplete(() => { if (onComplete) onComplete(); })
        )
        .start();
}

let cloudTime = 0;
let frameCount = 0;

// Test function - call from console: window.testClick(4, 4)
window.testClick = function(r, c) {
    console.log('Test click at:', r, c);
    handleBoardClick(r, c);
};

// Debug function
window.debugState = function() {
    const dice = window.getOnBoardDice ? window.getOnBoardDice() : [];
    const player = window.getCurrentPlayer ? window.getCurrentPlayer() : 1;
    const phase = window.gamePhase ? window.gamePhase() : 'unknown';
    const reserves = window.getReserveDice ? window.getReserveDice() : { 1: 0, 2: 0 };
    console.log('State:', { dice: dice.length, player, phase, reserves });
    console.log('Stones on board:', dice);
    console.log('Group pieces children:', groupPieces.children.length);
};

// Show STRIDE movement targets
window.showStrideTargets3D = function(targets) {
    clearStrideTargets3D();
    
    // Hidden console log for performance
    
    targets.forEach(target => {
        const { x, z } = tileTo3D(target.r, target.c);
        
        // Create a flat square marker ON the floor
        const markerGeom = new THREE.BoxGeometry(20, 3, 20);
        const markerMat = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.9
        });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.set(x, 4, z); // On the floor
        marker.userData.isStrideTarget = true;
        groupPlacementHints.add(marker);
        
        // Add glowing border/edge effect using thin boxes
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 1.0
        });
        
        // Top edge
        const topEdge = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 2), edgeMat);
        topEdge.position.set(x, 5.5, z - 10);
        topEdge.userData.isStrideTarget = true;
        groupPlacementHints.add(topEdge);
        
        // Bottom edge
        const bottomEdge = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 2), edgeMat);
        bottomEdge.position.set(x, 5.5, z + 10);
        bottomEdge.userData.isStrideTarget = true;
        groupPlacementHints.add(bottomEdge);
        
        // Left edge
        const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 20), edgeMat);
        leftEdge.position.set(x - 10, 5.5, z);
        leftEdge.userData.isStrideTarget = true;
        groupPlacementHints.add(leftEdge);
        
        // Right edge
        const rightEdge = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 20), edgeMat);
        rightEdge.position.set(x + 10, 5.5, z);
        rightEdge.userData.isStrideTarget = true;
        groupPlacementHints.add(rightEdge);
    });
    needsRender = true;
    
    needsRender = true;
};

// Clear STRIDE movement targets
window.clearStrideTargets3D = function() {
    while (groupPlacementHints.children.length > 0) {
        const child = groupPlacementHints.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
        }
        groupPlacementHints.remove(child);
    }
    needsRender = true;
    
    // Reset all stone highlights
    dieMeshes.forEach((mesh) => {
        mesh.children.forEach(child => {
            if (child.material && child.material.emissive) {
                child.material.emissive.setHex(0x000000);
                child.material.emissiveIntensity = 0;
            }
            if (child.material && child.material.color) {
                child.material.color.copy(child.userData.originalColor || child.material.color);
            }
        });
    });
};

// Grey out specific stones (for FORCED_MOVE_SELECT phase)
window.greyOutStones3D = function(greyedIds) {
    dieMeshes.forEach((mesh, dieId) => {
        if (greyedIds.includes(dieId)) {
            mesh.traverse(child => {
                if (child.material && child.material.color) {
                    if (!child.userData.originalColor) {
                        child.userData.originalColor = child.material.color.clone();
                    }
                    child.material.color.setHex(0x555555);
                }
            });
        }
    });
};

// Clear all greyness
window.clearGreyStones3D = function() {
    dieMeshes.forEach((mesh) => {
        mesh.traverse(child => {
            if (child.material && child.material.color && child.userData.originalColor) {
                child.material.color.copy(child.userData.originalColor);
            }
        });
    });
};

// Show markers for FORCED_MOVE_SELECT phase (movable value-1 stones)
function showForcedMoveMarkers() {
    const player = window.getCurrentPlayer ? window.getCurrentPlayer() : 1;
    const diceOnBoard = window.getOnBoardDice ? window.getOnBoardDice() : [];
    
    // Find movable value-1 stones
    const movableOnes = diceOnBoard.filter(d => {
        if (d.player !== player || d.value !== 1) return false;
        // Check if can move (has adjacent empty space or capturable opponent)
        const directions = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
            { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
        ];
        for (const dir of directions) {
            const checkR = d.r + dir.dr;
            const checkC = d.c + dir.dc;
            if (typeof window.isWithinBounds === 'function' ? window.isWithinBounds(checkR, checkC) : (checkR >= 0 && checkR < 11 && checkC >= 0 && checkC < 11)) {
                const occupant = diceOnBoard.find(occ => occ.r === checkR && occ.c === checkC);
                if (!occupant || (occupant.player !== player && occupant.value > 1)) return true;
            }
        }
        return false;
    });
    
    // Hidden console log for performance
    
    movableOnes.forEach(die => {
        const { x, z } = tileTo3D(die.r, die.c);
        const markerGeom = new THREE.BoxGeometry(26, 4, 26);
        const markerMat = new THREE.MeshBasicMaterial({
            color: 0xFF6600,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.set(x, 5, z);
        marker.userData.isForcedMoveMarker = true;
        marker.userData.isStrideTarget = true; // Reuse hover behavior
        groupPlacementHints.add(marker);
    });
}

// Update selected stone highlight in animation loop
let lastSelectedDieId = null;
function updateSelectedStoneHighlight() {
    const selectedDie = window.getSelectedDie ? window.getSelectedDie() : null;
    const currentPhase = window.gamePhase ? window.gamePhase() : 'ACTION_SELECT';
    
    // Only highlight in STRIDE_MOVE mode
    if (currentPhase !== 'STRIDE_MOVE' || !selectedDie) {
        lastSelectedDieId = null;
        return;
    }
    
    // Only update if selection changed
    if (selectedDie.id === lastSelectedDieId) return;
    lastSelectedDieId = selectedDie.id;
    
    // Reset all stone highlights
    dieMeshes.forEach((mesh) => {
        mesh.children.forEach(child => {
            if (child.material && child.material.emissive) {
                child.material.emissive.setHex(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    });
    
    // Highlight selected stone
    const mesh = dieMeshes.get(selectedDie.id);
    if (mesh) {
        mesh.children.forEach(child => {
            if (child.material && child.material.emissive) {
                child.material.emissive.setHex(0xFFD700);
                child.material.emissiveIntensity = 0.5;
            }
        });
    }
}

function animate(time) {
    const isTweening = TWEEN.update(time);
    const controlsUpdated = controls.update();
    
    frameCount++;
    
    // Check if we actually need to render this frame
    if (isTweening || controlsUpdated || needsRender || frameCount % 3 === 0) {
        // Update selected stone highlight
        updateSelectedStoneHighlight();
        
        // Update Floating Diminish Button Position
        updateFloatingButtonPosition();
        
        // Fade Statue on zoom
        updateStatueFade();
        
        if (frameCount % 3 === 0) {
            cloudTime += 0.015;
            groupClouds.children.forEach(cloud => {
                if (cloud.userData.baseY !== undefined) {
                    cloud.position.y = cloud.userData.baseY + Math.sin(cloudTime) * 5;
                    cloud.rotation.z = Math.sin(cloudTime * 0.7) * 0.03;
                }
            });
            
            // Subtle pulse animation for STRIDE targets
            groupPlacementHints.children.forEach(hint => {
                if (hint.userData.isStrideTarget) {
                    const pulse = 0.7 + Math.sin(time * 0.005) * 0.3;
                    if (hint.material) {
                        hint.material.opacity = pulse * 0.9;
                    }
                }
            });
            
            groupEnvironment.children.forEach(c => {
                if (c.userData.speed) {
                    c.position.x += c.userData.speed;
                    if (c.position.x > 800) c.position.x = -800;
                }
            });
        }

        renderer.render(scene, camera);
        needsRender = false;
    }
}

window.statueClickFade = 1.0;
window.statuePermanentlyHidden = false;

function triggerStatueFadeOut() {
    if (window.statuePermanentlyHidden) return;
    window.statuePermanentlyHidden = true;
    
    new TWEEN.Tween({ opacity: 1.0 })
        .to({ opacity: 0.0 }, 1500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate((obj) => {
            window.statueClickFade = obj.opacity;
            needsRender = true;
        })
        .start();
}

/**
 * Fades out the Statue of Zeus as the camera zooms in for better board clarity.
 */
function updateStatueFade() {
    if (!controls || !camera || !groupThrone) return;
    
    // Calculate distance from camera to the board center
    const distance = camera.position.distanceTo(controls.target);
    
    // Settings for the fade range:
    // Fully opaque at 450+, fully transparent at 220-
    const fadeStart = 450; 
    const fadeEnd = 220;   
    
    let opacity = (distance - fadeEnd) / (fadeStart - fadeEnd);
    opacity = Math.max(0, Math.min(1, opacity));
    
    // Apply permanent click-to-fade multiplier
    if (window.statueClickFade !== undefined) {
        opacity *= window.statueClickFade;
    }
    
    groupThrone.traverse(child => {
        // Handle Lights fading
        if (child.isLight) {
            if (child.userData.baseIntensity === undefined) {
                child.userData.baseIntensity = child.intensity || 0.5;
            }
            child.intensity = opacity * child.userData.baseIntensity;
            child.visible = child.intensity > 0.01;
            return;
        }

        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(mat => {
                // To prevent shared materials (like matGold on board trim) from fading,
                // we isolate/clone them once the first time we start fading.
                if (mat.userData.isIsolated === undefined) {
                    if (mat === matGold || mat === matMarble) {
                        child.material = mat.clone();
                        // re-fetch it if it was an array... simplified for now
                        const newMat = Array.isArray(child.material) ? child.material[0] : child.material;
                        newMat.userData.isIsolated = true;
                        newMat.userData.baseOpacity = (newMat.opacity !== undefined) ? newMat.opacity : 1.0;
                        newMat.transparent = true;
                    } else {
                        mat.userData.isIsolated = true;
                        mat.userData.baseOpacity = (mat.opacity !== undefined) ? mat.opacity : 1.0;
                        mat.transparent = true;
                    }
                }
                
                const m = Array.isArray(child.material) ? child.material[materials.indexOf(mat)] : child.material;
                m.opacity = opacity * (m.userData.baseOpacity || 1.0);
                
                // Optimization: hide entirely if transparent
                child.visible = m.opacity > 0.005;
            });
        }
    });
}

function updateFloatingButtonPosition() {
    const btn = document.getElementById('floating-diminish-btn');
    if (!btn || btn.classList.contains('hidden') || !window.selectedStoneId) return;
    
    const mesh = dieMeshes.get(window.selectedStoneId);
    if (!mesh) {
        btn.classList.add('hidden');
        return;
    }
    
    // Project 3D position to screen
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    pos.y += 25; // Rise above the stone
    pos.project(camera);
    
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
    
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
}

window.updateDiminishButton = function(enabled, dieId) {
    const btn = document.getElementById('floating-diminish-btn');
    if (!btn) return;
    
    if (!enabled) {
        btn.classList.add('hidden');
        window.selectedStoneId = null;
        return;
    }
    
    window.selectedStoneId = dieId;
    btn.classList.remove('hidden');
    // Force immediate position update
    updateFloatingButtonPosition();
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.body.classList.contains('view-3d') && !window.renderer) {
            init3D();
        }
    }, 100);
});

// Also try on load event
window.addEventListener('load', () => {
    setTimeout(() => {
        if (document.body.classList.contains('view-3d') && !window.renderer) {
            init3D();
        }
    }, 200);
});
