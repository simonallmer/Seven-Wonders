/**
 * Gardens 3D - The Hanging Gardens of Babylon
 * 3D View Implementation using Three.js
 */

let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let objects = []; // Clickable objects
let cellMeshes = {}; // Map of area_row_col to mesh
let gardenMeshes = {}; // Map of index to mesh
let stoneMeshes = []; // Array of active stone meshes
let waterfalls = []; // Particle systems for the arches
let torches = []; // Light references for flickering

// Constants for layout
const CELL_SIZE = 40;
const CELL_GAP = 5;
const LEVEL_HEIGHT = 60;
const GARDEN_WIDTH = 100;
const STAIR_STEPS = 5;

// Colors & Materials
const COLORS = {
    monolith: 0x4a6d48, // Architectural Green for the main block
    limestone: 0xdcd0b4, // Bright limestone for gardens and stairs
    reliefBlue: 0x1e3a5f, // Babylonian Blue Glazed Brick
    gold: 0xd4af37, // Royal Gold
    wood: 0x5d4037, // Rich Dark Wood
    whiteStone: 0xffffff,
    blackStone: 0x111111,
    selectionGlow: 0xd4af37, // Gold selection
    validMove: 0x10b981 // Keep green for target highlights
};

function init3D() {
    console.log("Initializing Gardens 3D (Clean Build)...");
    const canvasContainer = document.getElementById('canvas3d');
    if (!canvasContainer) return;

    // Scene Setup
    scene = new THREE.Scene();
    
    // 1. ATMospheric Effects: Fog for depth and a misty ancient morning feel
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015);
    
    // 2. SKY: Cinematic gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1e3a5f'); // Deep blue top
    gradient.addColorStop(0.5, '#4a90e2'); // Lighter blue mid
    gradient.addColorStop(1, '#ffc0cb'); // Soft pink horizon
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 512);
    const skyTex = new THREE.CanvasTexture(canvas);
    scene.background = skyTex;

    // Camera Setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(350, 450, 550);

    // Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasContainer.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false; // Forbid panning as requested
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 200;
    controls.maxDistance = 1500;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ee, 0.7); 
    dirLight.position.set(200, 500, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Build World
    createEnvironment();
    createBoardGeometry();

    // Trigger initial state sync
    if (typeof sync3D === 'function') sync3D();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onDocumentClick);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);

    animate();
}

function createEnvironment() {
    // Large base plane (Water)
    const groundGeo = new THREE.CircleGeometry(2000, 32);
    const groundMat = new THREE.MeshPhongMaterial({ 
        color: 0x1a3a4a, // Darker deep water
        transparent: true,
        opacity: 0.9
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -100;
    ground.receiveShadow = true;
    scene.add(ground);

    // Island base
    const islandGeo = new THREE.CylinderGeometry(600, 700, 40, 32);
    const islandMat = new THREE.MeshPhongMaterial({ color: 0x2a201a });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, -90, 0); 
    island.receiveShadow = true;
    scene.add(island);

    // RIVER EUPHRATES - Large shimmering water surface at the base
    const riverGeo = new THREE.CircleGeometry(4000, 32);
    const riverMat = new THREE.MeshPhongMaterial({ 
        color: 0x1e3a5f, 
        transparent: true, 
        opacity: 0.6,
        shininess: 80,
        specular: 0x444444
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = -105; // Slightly below island base
    river.receiveShadow = true;
    scene.add(river);

    // DISTANT CITY SILHOUETTES
    createDistantCity(scene);
}

function createDistantCity(parent) {
    const cityGroup = new THREE.Group();
    const cityMat = new THREE.MeshPhongMaterial({ color: 0x2a3a4a, transparent: true, opacity: 0.8 });
    
    // Tower of Babel (Ziggurat style) in the far distance
    const towerSteps = 8;
    for (let i = 0; i < towerSteps; i++) {
        const h = 40 + i * 15;
        const w = 200 - i * 20;
        const geo = new THREE.BoxGeometry(w, h, w);
        const mesh = new THREE.Mesh(geo, cityMat);
        mesh.position.set(0, h / 2, 0);
        cityGroup.add(mesh);
    }
    
    cityGroup.position.set(-1500, -100, -2000);
    cityGroup.scale.set(4, 4, 4);
    parent.add(cityGroup);

    // Other scattered buildings
    for (let i = 0; i < 15; i++) {
        const bw = 50 + Math.random() * 100;
        const bh = 40 + Math.random() * 150;
        const bGeo = new THREE.BoxGeometry(bw, bh, bw);
        const bMesh = new THREE.Mesh(bGeo, cityMat);
        const angle = Math.random() * Math.PI * 2;
        const dist = 2500 + Math.random() * 1000;
        bMesh.position.set(Math.cos(angle) * dist, -100 + bh / 2, Math.sin(angle) * dist);
        parent.add(bMesh);
    }
}

function createBoardGeometry() {
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // 1. THE MONOLITH BASE
    const baseWidth = GARDEN_WIDTH * 2 + (CELL_SIZE + CELL_GAP) * 6;
    const baseDepth = 400; 
    const baseHeight = 110; // Extended down to reach the ground
    const baseTopY = 10;

    const baseGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const baseMat = new THREE.MeshPhongMaterial({ color: COLORS.monolith });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, baseTopY - baseHeight / 2, 0); 
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    boardGroup.add(baseMesh);

    // 2. THE UPPER TIER - Split into parts to allow carving out the staircases
    const upperTopY = 50;
    const upperTierHeight = 150; // Extended down to reach the ground
    const upperTierDepth = baseDepth / 2;
    const sideMargin = 10;
    const notchDepth = 50; 

    // Central monolith (between gardens)
    const centerWidth = baseWidth - 2 * (GARDEN_WIDTH + sideMargin);
    const centerGeo = new THREE.BoxGeometry(centerWidth, upperTierHeight, upperTierDepth);
    const centerMesh = new THREE.Mesh(centerGeo, baseMat); // Use monolith material
    centerMesh.position.set(0, upperTopY - upperTierHeight / 2, -baseDepth / 4);
    centerMesh.receiveShadow = true;
    centerMesh.castShadow = true;
    boardGroup.add(centerMesh);

    // Outer margin walls
    const marginGeo = new THREE.BoxGeometry(sideMargin, upperTierHeight, upperTierDepth);
    
    // Left Margin
    const leftMarginMesh = new THREE.Mesh(marginGeo, baseMat);
    leftMarginMesh.position.set(-baseWidth / 2 + sideMargin / 2, upperTopY - upperTierHeight / 2, -baseDepth / 4);
    leftMarginMesh.receiveShadow = true;
    leftMarginMesh.castShadow = true;
    boardGroup.add(leftMarginMesh);

    // Right Margin
    const rightMarginMesh = new THREE.Mesh(marginGeo, baseMat);
    rightMarginMesh.position.set(baseWidth / 2 - sideMargin / 2, upperTopY - upperTierHeight / 2, -baseDepth / 4);
    rightMarginMesh.receiveShadow = true;
    rightMarginMesh.castShadow = true;
    boardGroup.add(rightMarginMesh);

    // Back walls (behind stairs, supporting the gardens)
    const backDepth = upperTierDepth - notchDepth;
    const backGeo = new THREE.BoxGeometry(GARDEN_WIDTH, upperTierHeight, backDepth);
    
    // Left Back
    const leftBackMesh = new THREE.Mesh(backGeo, baseMat);
    leftBackMesh.position.set(-baseWidth / 2 + sideMargin + GARDEN_WIDTH / 2, upperTopY - upperTierHeight / 2, -baseDepth / 4 - notchDepth / 2);
    leftBackMesh.receiveShadow = true;
    leftBackMesh.castShadow = true;
    boardGroup.add(leftBackMesh);

    // Right Back
    const rightBackMesh = new THREE.Mesh(backGeo, baseMat);
    rightBackMesh.position.set(baseWidth / 2 - sideMargin - GARDEN_WIDTH / 2, upperTopY - upperTierHeight / 2, -baseDepth / 4 - notchDepth / 2);
    rightBackMesh.receiveShadow = true;
    rightBackMesh.castShadow = true;
    boardGroup.add(rightBackMesh);

    // 3. STAIRS
    // Black Staircase (Left): Black ascends through White's Home Garden (G1 -> G0)
    createIntegratedStairs(-baseWidth / 2 + GARDEN_WIDTH / 2 + 10, 0, 'black', boardGroup);
    // White Staircase (Right): White ascends through Black's Home Garden (G2 -> G3)
    createIntegratedStairs(baseWidth / 2 - GARDEN_WIDTH / 2 - 10, 0, 'white', boardGroup);

    // 4. CELLS - Lower Level
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            const x = (c - 2) * (CELL_SIZE + CELL_GAP);
            const z = (r - 1) * (CELL_SIZE + CELL_GAP) + 100;
            createCellMesh('bottom', r, c, x, 10, z, boardGroup);
        }
    }

    // 5. CELLS - Upper Level
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            const x = (c - 2) * (CELL_SIZE + CELL_GAP);
            const z = (r - 1) * (CELL_SIZE + CELL_GAP) - 100;
            createCellMesh('top', r, c, x, LEVEL_HEIGHT - 10, z, boardGroup);
        }
    }

    // 6. GARDENS - Lower Level (Home Gardens)
    // Slightsly increased depth (206) and center (101) to create a subtle lip overhang (2-4 units) at front and back
    createGardenMesh(1, -baseWidth / 2 + GARDEN_WIDTH / 2 + 10, 10, 101, 206, boardGroup); 
    createGardenMesh(2, baseWidth / 2 - GARDEN_WIDTH / 2 - 10, 10, 101, 206, boardGroup);

    // 7. GARDENS - Upper Level
    // (depth 152, center -126 -> range [-202, -50] to overhang back edge by 2 units)
    createGardenMesh(0, -baseWidth / 2 + GARDEN_WIDTH / 2 + 10, 50, -126, 152, boardGroup); 
    createGardenMesh(3, baseWidth / 2 - GARDEN_WIDTH / 2 - 10, 50, -126, 152, boardGroup);

    // 8. PALM TREES - Reward for reaching the High Gardens
    const sideX = baseWidth / 2 - GARDEN_WIDTH / 2 - 10;
    createPalmTree(-sideX, 50, -175, 'white', boardGroup); // White goal
    createPalmTree(sideX, 50, -175, 'black', boardGroup);  // Black goal

    // 9. ARCHITECTURAL DETAILS - Columns, relief bands, and patterns
    // 9. ARCHITECTURAL DETAILS - Columns, relief bands, and patterns
    createMonolithDetails(boardGroup);

    // 10. VEGETATION & LIFE - Hanging vines, bushes, and torches
    // sideX is already defined above
    
    // Add vines to the terrace edges
    createHangingVines(-sideX, 50, -50, GARDEN_WIDTH, 10, boardGroup);
    createHangingVines(sideX, 50, -50, GARDEN_WIDTH, 10, boardGroup);
    createHangingVines(0, 50, 0, baseWidth - 2 * GARDEN_WIDTH, 10, boardGroup); // Center block front

    // Add bushes to gardens
    createBushes(-sideX, 10, 150, boardGroup);
    createBushes(sideX, 10, 150, boardGroup);
    createBushes(sideX, 50, -150, boardGroup);
    createBushes(-sideX, 50, -150, boardGroup);

    // Add torches for cinematic lighting
    createTorch(-baseWidth/2 + 5, 10, 195, boardGroup);
    createTorch(baseWidth/2 - 5, 10, 195, boardGroup);
    createTorch(0, 50, -5, boardGroup);
}

function createHangingVines(x, y, z, width, depth, parent) {
    const vineGroup = new THREE.Group();
    const vineMat = new THREE.MeshPhongMaterial({ color: 0x2d4c1e, transparent: true, opacity: 0.85 });
    
    for (let i = 0; i < 25; i++) {
        const vx = (Math.random() - 0.5) * width;
        const vz = (Math.random() - 0.5) * depth;
        const vh = 15 + Math.random() * 45;
        const vGeo = new THREE.CylinderGeometry(0.5, 0.8, vh, 4);
        const vine = new THREE.Mesh(vGeo, vineMat);
        vine.position.set(vx, -vh / 2, vz);
        vine.rotation.z = (Math.random() - 0.5) * 0.2;
        vineGroup.add(vine);
    }
    vineGroup.position.set(x, y, z);
    parent.add(vineGroup);
}

function createBushes(x, y, z, parent) {
    const bushGroup = new THREE.Group();
    const bushMat = new THREE.MeshPhongMaterial({ color: 0x3a5c3f, shininess: 5 });
    for (let i = 0; i < 8; i++) {
        const size = 4 + Math.random() * 10;
        const bGeo = new THREE.SphereGeometry(size, 8, 8);
        const bush = new THREE.Mesh(bGeo, bushMat);
        bush.position.set((Math.random() - 0.5) * 60, size * 0.4, (Math.random() - 0.5) * 40);
        bush.scale.y = 0.7;
        bush.castShadow = true;
        bushGroup.add(bush);
    }
    bushGroup.position.set(x, y, z);
    parent.add(bushGroup);
}

function createTorch(x, y, z, parent) {
    const torchGroup = new THREE.Group();
    const stickGeo = new THREE.CylinderGeometry(1, 1.5, 20, 8);
    const stickMat = new THREE.MeshPhongMaterial({ color: 0x332211 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 10;
    torchGroup.add(stick);

    const fireGeo = new THREE.SphereGeometry(3, 8, 8);
    const fireMat = new THREE.MeshPhongMaterial({ color: 0xffaa00, emissive: 0xff4400 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.y = 20;
    torchGroup.add(fire);

    const light = new THREE.PointLight(0xff6600, 1, 300);
    light.position.y = 20;
    light.castShadow = true;
    torchGroup.add(light);
    torches.push({ light, fire, baseIntensity: 1 });

    torchGroup.position.set(x, y, z);
    parent.add(torchGroup);
}

function createMonolithDetails(parent) {
    const detailGroup = new THREE.Group();
    const woodMat = new THREE.MeshPhongMaterial({ color: COLORS.wood, shininess: 20 });
    const blueMat = new THREE.MeshPhongMaterial({ color: COLORS.reliefBlue, shininess: 50 });
    const goldMat = new THREE.MeshPhongMaterial({ color: COLORS.gold, shininess: 80 });

    // 1. MAIN RELIEF BANDS (Blue Glazed Brick style)
    const bandHeight = 25;
    const bw = 478; 
    const bd = 408;
    const bandGeo = new THREE.BoxGeometry(bw, bandHeight, bd); 
    const mainBand = new THREE.Mesh(bandGeo, blueMat);
    mainBand.position.y = -50; 
    mainBand.receiveShadow = true;
    detailGroup.add(mainBand);

    // Gold motifs (Rings) around the entire perimeter correctly
    const motifGeo = new THREE.TorusGeometry(6, 1.5, 8, 16);
    
    // Front & Back Faces
    for (let i = -7; i <= 7; i++) {
        const mFront = new THREE.Mesh(motifGeo, goldMat);
        mFront.position.set(i * 32, -50, bd/2 + 1);
        detailGroup.add(mFront);
        
        const mBack = new THREE.Mesh(motifGeo, goldMat);
        mBack.position.set(i * 32, -50, -bd/2 - 1);
        mBack.rotation.y = Math.PI;
        detailGroup.add(mBack);
    }
    // Left & Right Faces
    for (let i = -5; i <= 5; i++) {
        const mLeft = new THREE.Mesh(motifGeo, goldMat);
        mLeft.position.set(-bw/2 - 1, -50, i * 36);
        mLeft.rotation.y = -Math.PI / 2;
        detailGroup.add(mLeft);
        
        const mRight = new THREE.Mesh(motifGeo, goldMat);
        mRight.position.set(bw/2 + 1, -50, i * 36);
        mRight.rotation.y = Math.PI / 2;
        detailGroup.add(mRight);
    }

    // 2. COLUMNS - Using Wood for a natural feel
    const colHeight = 110;
    const colGeo = new THREE.CylinderGeometry(8, 10, colHeight, 12);
    
    // Front columns on the lower tier
    for (let i = -1; i <= 1; i++) {
        if (i === 0) continue; 
        const col = new THREE.Mesh(colGeo, woodMat);
        col.position.set(i * 120, -35, 205);
        col.castShadow = true;
        col.receiveShadow = true;
        detailGroup.add(col);
    }

    // Level 2 face details
    const upperColGeo = new THREE.CylinderGeometry(4, 6, 40, 8);
    for (let i = -2; i <= 2; i++) {
        const uCol = new THREE.Mesh(upperColGeo, woodMat);
        uCol.position.set(i * 35, 30, -50); 
        uCol.castShadow = true;
        detailGroup.add(uCol);
    }
    
    parent.add(detailGroup);
}

function createPalmTree(x, y, z, color, parent) {
    const treeGroup = new THREE.Group();
    const leafColorValue = color === 'white' ? 0xffffff : 0x222222;
    
    // Trunk - Much taller and more substantial
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5d4037, shininess: 5 });
    const trunkHeight = 90; // Significantly taller
    const trunkSegs = 5;
    for (let i = 0; i < trunkSegs; i++) {
        const rTop = 5.5 - (i * 0.7); // Wider trunk
        const rBot = 7.0 - (i * 0.7);
        const segGeo = new THREE.CylinderGeometry(rTop, rBot, trunkHeight / trunkSegs, 12);
        const seg = new THREE.Mesh(segGeo, trunkMat);
        seg.position.y = (i + 0.5) * (trunkHeight / trunkSegs);
        seg.rotation.x = Math.sin(i * 0.4) * 0.08;
        seg.rotation.z = Math.cos(i * 0.4) * 0.08;
        seg.castShadow = true;
        seg.receiveShadow = true;
        treeGroup.add(seg);
    }
    
    // Crown of leaves - Larger and more dramatic
    const leafCount = 12;
    const leafMat = new THREE.MeshPhongMaterial({ 
        color: leafColorValue, 
        shininess: 40,
        specular: 0x444444
    });

    for (let i = 0; i < leafCount; i++) {
        const leafGeo = new THREE.SphereGeometry(1, 16, 12);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.scale.set(30, 0.8, 8); // Significantly larger fronds
        
        const leafPivot = new THREE.Group();
        leafPivot.position.y = trunkHeight;
        leafPivot.rotation.y = (i / leafCount) * Math.PI * 2;
        
        leaf.position.set(16, -5, 0); 
        leaf.rotation.z = -0.45; // More pronounced droop
        
        leafPivot.add(leaf);
        leaf.castShadow = true;
        treeGroup.add(leafPivot);
    }
    
    treeGroup.position.set(x, y, z);
    parent.add(treeGroup);
}

function createIntegratedStairs(x, zCenter, color, parent) {
    const stairWidth = GARDEN_WIDTH; // Match garden width for seamless transition
    const stairSteps = 6;
    const stepHeight = LEVEL_HEIGHT / (stairSteps - 1);
    const stepDepth = 20;
    
    // Now all stairs are limestone colored
    const stairMat = new THREE.MeshPhongMaterial({ color: COLORS.limestone, shininess: 10 });

    for (let i = 0; i < stairSteps; i++) {
        const h = i * stepHeight;
        const z = zCenter + (stairSteps / 2 - i) * stepDepth;
        
        // Step block
        const stepGeo = new THREE.BoxGeometry(stairWidth, h + 2, stepDepth);
        const step = new THREE.Mesh(stepGeo, stairMat);
        
        // h/2 - 10 centers it on the floor level
        step.position.set(x, h / 2 - 10, z);
        step.receiveShadow = true;
        step.castShadow = true;
        parent.add(step);
    }

    // Add a stylish arch at the front edge of the staircase notch
    createStairArch(x, 0, parent);

    // Add falling water in the color of the stones that can pass here
    // Falls from the arch (y=100) down to the lower level (y=10)
    createWaterfall(x, -6, color, 100, 10, parent);
}

function createWaterfall(x, z, color, topY, bottomY, parent) {
    const particleCount = 1200; 
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const innerR = 46.5; // Slightly less than 47 to avoid edge clipping
    
    const waterColor = color === 'white' ? 0xffffff : 0x222222;
    
    for (let i = 0; i < particleCount; i++) {
        // Correctly constrain initial positions under the arch curve
        const localX = (Math.random() - 0.5) * innerR * 2;
        const currentCeilY = 50 + Math.sqrt(Math.max(0, innerR*innerR - localX*localX));
        
        positions[i * 3] = x + localX;
        positions[i * 3 + 1] = bottomY + Math.random() * (currentCeilY - bottomY);
        positions[i * 3 + 2] = z - 2 + Math.random() * 4;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: waterColor,
        size: 1.8,
        transparent: true,
        opacity: color === 'white' ? 0.4 : 0.8,
        blending: color === 'white' ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    
    if (color === 'black') {
        material.opacity = 0.9;
        material.size = 2.0;
    }

    const points = new THREE.Points(geometry, material);
    parent.add(points);
    
    waterfalls.push({
        points,
        xBase: x,
        zBase: z,
        innerR: innerR,
        archBaseY: topY === 100 ? 50 + 35 : topY, // Offset for dynamic curved arch
        topY, 
        bottomY,
        speed: 0.5 + Math.random() * 0.3
    });
}

function updateWaterfalls() {
    const time = Date.now() * 0.001;
    waterfalls.forEach(wf => {
        const positions = wf.points.geometry.attributes.position.array;
        for (let i = 0; i < positions.length / 3; i++) {
            // Slow falling speed
            positions[i * 3 + 1] -= wf.speed * (1 + Math.sin(i + time) * 0.05);
            
            // Subtle wavy motion
            positions[i * 3] += Math.sin(positions[i * 3 + 1] * 0.05 + time + i) * 0.15;

            // Splash/Reset check 
            if (positions[i * 3 + 1] < wf.bottomY) { 
                // Randomly pick a new X position within the arch bounds
                const localX = (Math.random() - 0.5) * wf.innerR * 2;
                positions[i * 3] = wf.xBase + localX;
                
                // Calculate the CURVED ceiling at this X offset
                // y = arcBaseY + sqrt(R^2 - x^2)
                const baseY = wf.archBaseY || 50;
                const ceilY = baseY + Math.sqrt(Math.max(0, wf.innerR * wf.innerR - localX * localX));
                positions[i * 3 + 1] = ceilY;
            }
        }
        wf.points.geometry.attributes.position.needsUpdate = true;
    });
}

function createStairArch(x, z, parent) {
    const archWidth = 118; // Spans across the side walls
    const archThickness = 12;
    const legHeight = 35; // Significantly taller vertical legs
    const woodMat = new THREE.MeshPhongMaterial({ color: COLORS.wood, shininess: 20 });
    
    // Radii for arc
    const outerRadius = archWidth / 2;
    const innerRadius = outerRadius - archThickness;
    
    // Create arch shape with legs
    const shape = new THREE.Shape();
    // Start at bottom of right leg (inner corner)
    shape.moveTo(innerRadius, -legHeight);
    shape.lineTo(innerRadius, 0); // Up to arc start
    shape.absarc(0, 0, innerRadius, 0, Math.PI, false); // Top inner curve
    shape.lineTo(-innerRadius, -legHeight); // Down left leg inner
    shape.lineTo(-outerRadius, -legHeight); // Across left leg bottom
    shape.lineTo(-outerRadius, 0); // Up left leg outer
    shape.absarc(0, 0, outerRadius, Math.PI, 2 * Math.PI, true); // Top outer curve (clockwise)
    shape.lineTo(outerRadius, -legHeight); // Down right leg outer
    shape.lineTo(innerRadius, -legHeight); // Across right leg bottom to close
    
    const extrudeSettings = { 
        depth: archThickness, 
        bevelEnabled: true, 
        bevelThickness: 1.5, 
        bevelSize: 1.5,
        curveSegments: 32
    };
    
    const arcGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const arcMesh = new THREE.Mesh(arcGeo, woodMat);
    
    // Position it at the edge, but recessed by 2 units so it doesn't hang over the front face
    // The curve starts at 50 + legHeight. So peak is at 50 + legHeight + innerR.
    arcMesh.position.set(x, 50 + legHeight, z - archThickness - 2);
    arcMesh.castShadow = true;
    arcMesh.receiveShadow = true;
    parent.add(arcMesh);

    // Save legHeight for waterfall calculations if not already stored
    arcMesh.userData.legHeight = legHeight;
}

function createCellMesh(area, r, c, x, y, z, parent) {
    const geo = new THREE.CylinderGeometry(CELL_SIZE / 2, CELL_SIZE / 2.2, 4, 32);
    const mat = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData = { type: 'cell', area, r, c };
    cellMeshes[`${area}_${r}_${c}`] = mesh;
    objects.push(mesh);
    parent.add(mesh);
}

function createGardenMesh(index, x, y, z, depth, parent) {
    const geo = new THREE.BoxGeometry(GARDEN_WIDTH, 4, depth);
    const mat = new THREE.MeshPhongMaterial({ 
        color: COLORS.limestone, 
        shininess: 40,
        specular: 0x333333
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData = { type: 'garden', index };
    gardenMeshes[index] = mesh;
    objects.push(mesh);
    parent.add(mesh);
}

function sync3D() {
    if (!scene) return;
    stoneMeshes.forEach(s => scene.remove(s));
    stoneMeshes = [];
    if (typeof board === 'undefined') return;

    const drawStack = (stack, mesh, area, r, c) => {
        if (!stack || !mesh) return;
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        const isSelectedSource = (selectedSource && selectedSource.area === area && selectedSource.row === r && selectedSource.col === c);

        stack.forEach((color, i) => {
            const stoneGeo = new THREE.CylinderGeometry(14, 16, 7, 32); 
            const stoneMat = new THREE.MeshPhongMaterial({ 
                color: color === 'white' ? COLORS.whiteStone : COLORS.blackStone,
                shininess: 30,
                specular: 0x444444
            });
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            stone.position.set(worldPos.x, worldPos.y + 6 + i * 8, worldPos.z);
            stone.castShadow = true;
            stone.receiveShadow = true;
            if (isSelectedSource && turnPhase === 'SELECT') {
                stone.scale.set(1.2, 1.2, 1.2);
                new TWEEN.Tween(stone.scale).to({ x: 1.1, y: 1.1, z: 1.1 }, 500).easing(TWEEN.Easing.Quadratic.InOut).repeat(Infinity).yoyo(true).start();
            }
            scene.add(stone);
            stoneMeshes.push(stone);
        });
    };

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            drawStack(board.topField[r][c], cellMeshes[`top_${r}_${c}`], 'top', r, c);
            drawStack(board.bottomField[r][c], cellMeshes[`bottom_${r}_${c}`], 'bottom', r, c);
        }
    }

    for (let i = 0; i < 4; i++) {
        const gardenMesh = gardenMeshes[i];
        const stack = board.gardens[i];
        const worldPos = new THREE.Vector3();
        gardenMesh.getWorldPosition(worldPos);
        let selectedCountInGarden = 0;
        if (selectedSource && selectedSource.area === 'garden' && selectedSource.row === i) {
            selectedCountInGarden = hand.length;
        }

        const totalRows = Math.ceil(stack.length / 2);
        stack.forEach((color, idx) => {
            const isSelected = (color === currentPlayer && idx >= stack.length - selectedCountInGarden);
            const stoneGeo = new THREE.CylinderGeometry(11, 12, 6, 32);
            const stoneMat = new THREE.MeshPhongMaterial({ 
                color: color === 'white' ? COLORS.whiteStone : COLORS.blackStone,
                transparent: isSelected,
                opacity: isSelected ? 0.3 : 1.0,
                shininess: 30
            });
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            const colIdx = idx % 2;
            const rowIdx = Math.floor(idx / 2);
            const gx = (colIdx - 0.5) * 32;
            const gz = (rowIdx - (totalRows - 1) / 2) * 32;
            stone.position.set(worldPos.x + gx, worldPos.y + 6, worldPos.z + gz);
            stone.castShadow = true;
            scene.add(stone);
            stoneMeshes.push(stone);
        });
    }
    updateHighlights();
}

function updateHighlights() {
    objects.forEach(obj => {
        const data = obj.userData;
        if (data.type === 'cell') obj.material.color.set(0x333333);
        else if (data.type === 'garden') obj.material.color.set(COLORS.limestone);
        if (typeof isValidMove === 'function') {
            let isValid = false;
            if (data.type === 'cell') isValid = isValidMove(data.area, data.r, data.c);
            if (data.type === 'garden') isValid = isValidMove('garden', data.index, 0);
            if (isValid) obj.material.color.set(COLORS.validMove);
        }
    });
}

function animate3DMove(path, callback) { setTimeout(callback, 300); }

function onDocumentClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        const data = intersects[0].object.userData;
        if (typeof handleCellClick === 'function') {
            if (data.type === 'cell') handleCellClick(data.area, data.r, data.c);
            if (data.type === 'garden') handleCellClick('garden', data.index, 0);
        }
    }
}

function onDocumentMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    TWEEN.update();
    updateWaterfalls();
    
    // Animate torches
    const time = Date.now() * 0.005;
    torches.forEach(t => {
        t.light.intensity = t.baseIntensity + Math.sin(time * 2) * 0.2 + Math.random() * 0.1;
        t.fire.scale.setScalar(1 + Math.sin(time * 5) * 0.1);
    });

    renderer.render(scene, camera);
}
