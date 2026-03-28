// ============================================
// COLOSSUS GAME 3D VIEW
// Giant Colossus of Rhodes holding the board
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;
window.is3DView = false;

// Groups
const groupEnvironment = new THREE.Group();
const groupColossus = new THREE.Group();
const groupBoard = new THREE.Group(); // This group will tilt for gravity
const groupTiles = new THREE.Group();
const groupPieces = new THREE.Group();
const groupHighlights = new THREE.Group();

// Maps
const stoneMeshes = new Map();
const fieldMeshes = new Map();

// Constants
const TILE_SIZE = 20;
const BOARD_DIM = 11;
const BOARD_OFFSET = (BOARD_DIM - 1) * TILE_SIZE / 2;

// Materials
const matBronze = new THREE.MeshStandardMaterial({ 
    color: 0xcd7f32, 
    roughness: 0.1, 
    metalness: 0.9,
    envMapIntensity: 1.5
});
const matMarble = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.8, metalness: 0.1 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.2, metalness: 0.9 });
const matWhiteStone = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const matBlackStone = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.3 });
const matHighlight = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5, depthTest: false });
const matSelection = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6, depthTest: false });

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2a3a); // Slightly lighter night sky
    scene.fog = new THREE.FogExp2(0x1a2a3a, 0.0006);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(0, 800, 1500);

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
    controls.enablePan = false;
    controls.minDistance = 200;
    controls.maxDistance = 1500;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.target.set(0, 1530, 0); // Focus on the centered torch bowl

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x4488ff, 0x222244, 1.0); // Brighter
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffaa88, 1.5); // Warm sunset/dawn light
    dirLight.position.set(1000, 800, 1000);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2000;
    dirLight.shadow.camera.bottom = -2000;
    dirLight.shadow.camera.left = -2000;
    dirLight.shadow.camera.right = 2000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Added a fill light from the other side
    const fillLight = new THREE.DirectionalLight(0x4466aa, 0.5);
    fillLight.position.set(-1000, 200, -500);
    scene.add(fillLight);

    // Groups setup
    scene.add(groupEnvironment);
    groupEnvironment.add(groupColossus);
    
    // The board group is what tilts
    scene.add(groupBoard);
    groupBoard.position.set(0, 1530, 0); // Lowered to connect with hands
    
    // Vertical Spacing (To avoid Z-Fighting/Flickering)
    groupTiles.position.y = 25; 
    groupPieces.position.y = 25; 
    groupHighlights.position.y = 26; 
    
    groupBoard.add(groupTiles);
    groupBoard.add(groupPieces);
    groupBoard.add(groupHighlights);

    buildEnvironment();
    buildColossus();
    build3DBoard();

    window.addEventListener('resize', onWindowResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Warm Light from Torch
    const torchLight = new THREE.PointLight(0xffaa44, 1.5, 1000);
    torchLight.position.set(0, 30, 0); // Inside the bowl
    torchLight.castShadow = true;
    groupBoard.add(torchLight);
    window.torchLight = torchLight;

    renderer.setAnimationLoop(animate3D);
    
    if (typeof board !== 'undefined') sync3D();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

function buildEnvironment() {
    // Sea
    const seaGeom = new THREE.CircleGeometry(10000, 64);
    const seaMat = new THREE.MeshStandardMaterial({ 
        color: 0x0a1a2a, 
        roughness: 0.05, 
        metalness: 0.6,
        transparent: true,
        opacity: 0.9
    });
    const sea = new THREE.Mesh(seaGeom, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -200; // Lower sea level
    sea.receiveShadow = true;
    groupEnvironment.add(sea);

    // Harbour Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
    const wallGeom = new THREE.TorusGeometry(800, 40, 16, 100, Math.PI * 1.5);
    const wall = new THREE.Mesh(wallGeom, wallMat);
    wall.rotation.x = Math.PI / 2;
    wall.position.y = -200;
    groupEnvironment.add(wall);

    // Pier/Docks
    const pierGeom = new THREE.BoxGeometry(200, 20, 1200);
    const pier = new THREE.Mesh(pierGeom, wallMat);
    pier.position.set(1000, -190, 0);
    groupEnvironment.add(pier);

    // Foot Plinths (Massive square piers like the image)
    const plinthGeom = new THREE.BoxGeometry(400, 300, 400); 
    const plinthL = new THREE.Mesh(plinthGeom, wallMat);
    plinthL.position.set(-800, -250, 0);
    groupEnvironment.add(plinthL);

    const plinthR = new THREE.Mesh(plinthGeom, wallMat);
    plinthR.position.set(100, -250, 0); 
    groupEnvironment.add(plinthR);

    // Distant City Skyline
    const cityGroup = new THREE.Group();
    for (let i = 0; i < 50; i++) {
        const h = 50 + Math.random() * 200;
        const w = 30 + Math.random() * 50;
        const building = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, w),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 })
        );
        const angle = Math.PI + (Math.random() * Math.PI * 0.5);
        const dist = 3000 + Math.random() * 500;
        building.position.set(Math.cos(angle) * dist, -200 + h/2, Math.sin(angle) * dist);
        cityGroup.add(building);
    }
    groupEnvironment.add(cityGroup);

    // Ships in harbour
    for (let i = 0; i < 8; i++) {
        const boat = createBoatMesh();
        const angle = (i / 8) * Math.PI * 1.2;
        const dist = 400 + Math.random() * 300;
        boat.position.set(Math.cos(angle) * dist, -200, Math.sin(angle) * dist);
        boat.rotation.y = Math.random() * Math.PI * 2;
        groupEnvironment.add(boat);
    }
}

function createBoatMesh() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4b2d1f, roughness: 0.8 });
    
    const hull = new THREE.Mesh(new THREE.BoxGeometry(60, 20, 30), woodMat);
    hull.position.y = 10;
    group.add(hull);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 80), woodMat);
    mast.position.y = 50;
    group.add(mast);

    const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 60),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide })
    );
    sail.position.set(10, 55, 0);
    sail.rotation.y = 0.2;
    group.add(sail);

    return group;
}

function buildColossus() {
    const bronzeMat = matBronze;

    // Pelvis / Hips (2x Scale)
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(100, 110, 120, 24), bronzeMat);
    pelvis.position.y = 360;
    groupColossus.add(pelvis);

    // Legs (Properly Separated nested hierarchy)
    function createLeg(side) {
        const hipJoint = new THREE.Group();
        hipJoint.position.set(side * 70, 0, 0); // Positioned on sides of pelvis
        pelvis.add(hipJoint);
        hipJoint.rotation.z = side * -0.7; // Wider stance
        
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(70, 50, 400, 16), bronzeMat);
        thigh.position.y = -200;
        hipJoint.add(thigh);

        const kneeJoint = new THREE.Group();
        kneeJoint.position.set(0, -400, 0);
        hipJoint.add(kneeJoint);
        kneeJoint.add(new THREE.Mesh(new THREE.SphereGeometry(55, 16, 16), bronzeMat));

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(50, 40, 420, 16), bronzeMat);
        shin.position.y = -210;
        kneeJoint.add(shin);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(100, 50, 200), bronzeMat);
        foot.position.y = -440;
        kneeJoint.add(foot);
    }
    createLeg(-1);
    createLeg(1);

    // Torso (2x Scale)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(110, 120, 400, 16), bronzeMat);
    torso.position.y = 200; // Relative to pelvis top
    pelvis.add(torso);

    // Arm Function (Nested Hierarchy)
    function createArm(side) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 160, 200, 0); 
        torso.add(shoulder);
        shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(65, 24, 24), bronzeMat));

        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(48, 42, 220, 24), bronzeMat);
        const rotB = side * -0.4; 
        bicep.rotation.z = rotB;
        const bX = Math.sin(-rotB) * 110;
        const bY = Math.cos(-rotB) * 110;
        bicep.position.set(bX, bY, 0); 
        shoulder.add(bicep);

        const elbow = new THREE.Group();
        elbow.position.set(bX * 2, bY * 2, 0);
        shoulder.add(elbow);
        elbow.add(new THREE.Mesh(new THREE.SphereGeometry(45, 16, 16), bronzeMat));

        const fLen = 350;
        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(38, 42, fLen, 24), bronzeMat);
        const rotF = side * 1.1; // Balanced inward bend to meet support seat
        forearm.rotation.z = rotF;
        const fX = Math.sin(-rotF) * (fLen / 2);
        const fY = Math.cos(-rotF) * (fLen / 2);
        forearm.position.set(fX, fY, 0);
        elbow.add(forearm);
    }

    createArm(-1); // Mirrored left arm
    createArm(1);  // Mirrored right arm

    // Head
    const headPivot = new THREE.Group();
    headPivot.position.y = 200; // At top of torso
    torso.add(headPivot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(35, 45, 100), bronzeMat);
    neck.position.y = 50;
    headPivot.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(75, 24, 24), bronzeMat);
    head.position.y = 120;
    headPivot.add(head);

    // Radiant Crown (7 rays)
    for (let i = 0; i < 7; i++) {
        const ray = new THREE.Mesh(new THREE.ConeGeometry(12, 140, 8), bronzeMat);
        const angle = (i / 6) * Math.PI - Math.PI/2;
        ray.position.set(Math.cos(angle) * 75, 120 + Math.sin(angle) * 75, 0);
        ray.rotation.z = angle - Math.PI/2;
        headPivot.add(ray);
    }

    // Hand/Platform (Central Support held by both hands)
    const hand = new THREE.Mesh(new THREE.CylinderGeometry(200, 150, 60, 32), bronzeMat);
    hand.position.set(0, -30, 0); 
    groupBoard.add(hand);

    // Align Colossus
    groupColossus.position.y = 380; 
    groupColossus.position.x = 0; 
}

function build3DBoard() {
    fieldMeshes.clear();
    while (groupTiles.children.length > 0) groupTiles.remove(groupTiles.children[0]);

    for (let r = 0; r < BOARD_DIM; r++) {
        for (let c = 0; c < BOARD_DIM; c++) {
            // Check if cell is active based on 2D board structure logic
            let isActive = false;
            if (r >= 1 && r <= 9 && c >= 1 && c <= 9) isActive = true;
            if (r === 0 && c >= 4 && c <= 6) isActive = true;
            if (r === 10 && c >= 4 && c <= 6) isActive = true;
            if (c === 0 && r >= 4 && r <= 6) isActive = true;
            if (c === 10 && r >= 4 && r <= 6) isActive = true;

            if (!isActive) continue;

            const x = (c * TILE_SIZE) - BOARD_OFFSET;
            const z = (r * TILE_SIZE) - BOARD_OFFSET;

            // Tile
            const tileGeom = new THREE.BoxGeometry(TILE_SIZE - 1, 4, TILE_SIZE - 1);
            const tileMat = matMarble.clone();
            
            // Highlight direction fields
            let isDirField = false;
            if ((r === 0 && c === 5) || (r === 10 && c === 5) || (r === 5 && c === 0) || (r === 5 && c === 10)) {
                tileMat.color.set(0xef4444);
                isDirField = true;
            } else if ((r + c) % 2 !== 0) {
                // Subtle grey checkering for diagonals
                tileMat.color.multiplyScalar(0.75);
            }

            const tile = new THREE.Mesh(tileGeom, tileMat);
            tile.position.set(x, 1, z); // Moved up to y=1 (top at y=3)
            tile.receiveShadow = true;
            tile.userData = { r, c, isField: true };
            groupTiles.add(tile);
            fieldMeshes.set(`${r},${c}`, tile);
        }
    }

    // Board Bowl (The Torch Head)
    const bowlGeom = new THREE.CylinderGeometry(BOARD_DIM * TILE_SIZE / 2 + 40, BOARD_DIM * TILE_SIZE / 2 - 20, 80, 32);
    const bowl = new THREE.Mesh(bowlGeom, matBronze);
    bowl.position.y = -45;
    groupTiles.add(bowl);

    const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(BOARD_DIM * TILE_SIZE / 2 + 40, 5, 16, 32), matBronze);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.y = -5;
    groupTiles.add(bowlRim);

    // Fire "Embers" (Glowing base for tiles)
    const emberGeom = new THREE.CircleGeometry(BOARD_DIM * TILE_SIZE / 2 + 35, 32);
    const emberMat = new THREE.MeshStandardMaterial({ 
        color: 0xff4400, 
        emissive: 0xff2200, 
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.8
    });
    const embers = new THREE.Mesh(emberGeom, emberMat);
    embers.rotation.x = -Math.PI / 2;
    embers.position.y = -15; // Increased depth to avoid Z-Fighting
    groupTiles.add(embers);

    // Fire Particles
    const fireGroup = new THREE.Group();
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 20; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), fireMat);
        p.position.set(
            (Math.random() - 0.5) * 150,
            Math.random() * 50,
            (Math.random() - 0.5) * 150
        );
        p.userData = { speed: 0.5 + Math.random(), phase: Math.random() * Math.PI * 2 };
        fireGroup.add(p);
    }
    groupBoard.add(fireGroup);
    window.fireParticles = fireGroup;
}

function createStoneMesh(color) {
    const group = new THREE.Group();
    const material = color === 'white' ? matWhiteStone : matBlackStone;
    
    const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 8, 24), material);
    body.position.y = 4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
    top.position.y = 8;
    top.castShadow = true;
    group.add(top);

    const bevel = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.5, 8, 24), matGold);
    bevel.rotation.x = Math.PI / 2;
    bevel.position.y = 8;
    group.add(bevel);

    return group;
}

function sync3D() {
    if (typeof board === 'undefined') return;

    const currentBoardKeys = new Set();
    for (let r = 0; r < BOARD_DIM; r++) {
        for (let c = 0; c < BOARD_DIM; c++) {
            if (board[r][c].piece) {
                const key = `${r},${c}`;
                currentBoardKeys.add(key);
                const color = board[r][c].piece;

                let mesh = stoneMeshes.get(key);
                if (mesh) {
                    // Update and Reconcile: If color changed or mesh disconnected from scene, fix it
                    if (mesh.userData.color !== color || !groupPieces.children.includes(mesh)) {
                        groupPieces.remove(mesh);
                        mesh = createStoneMesh(color);
                        mesh.userData = { r, c, color };
                        groupPieces.add(mesh);
                        stoneMeshes.set(key, mesh);
                    }
                    // Ensure physical position matches logical position
                    const tx = (c * TILE_SIZE) - BOARD_OFFSET;
                    const tz = (r * TILE_SIZE) - BOARD_OFFSET;
                    mesh.position.set(tx, 0, tz);
                } else {
                    // Missing Mesh: Create it
                    const stone = createStoneMesh(color);
                    const tx = (c * TILE_SIZE) - BOARD_OFFSET;
                    const tz = (r * TILE_SIZE) - BOARD_OFFSET;
                    stone.position.set(tx, 0, tz);
                    stone.userData = { r, c, color };
                    groupPieces.add(stone);
                    stoneMeshes.set(key, stone);
                }
            }
        }
    }

    // Remove meshes from map that are no longer on the logical board
    stoneMeshes.forEach((mesh, key) => {
        if (!currentBoardKeys.has(key)) {
            groupPieces.remove(mesh);
            stoneMeshes.delete(key);
        }
    });

    // FINAL SCENE CLEANUP: Ensure NO ghost pieces exist in the 3D scene that aren't logically tracked
    const trackedMeshes = new Set(stoneMeshes.values());
    for (let i = groupPieces.children.length - 1; i >= 0; i--) {
        const child = groupPieces.children[i];
        // If it's a stone but not one we're tracking, it's a ghost - burn it
        if (child.userData && child.userData.color && !trackedMeshes.has(child)) {
            groupPieces.remove(child);
        }
    }

    update3DViews();
    syncBoardTilt();
    needsRender = true;
}

function getTargetTilt() {
    let targetX = 0;
    let targetZ = 0;
    const tiltAngle = 0.2;

    if (typeof board === 'undefined') return { x: 0, z: 0 };

    const activeDirs = new Set();
    const DIRECTION_FIELDS = [
        { r: 0, c: 5, d: 'up' },
        { r: 10, c: 5, d: 'down' },
        { r: 5, c: 0, d: 'left' },
        { r: 5, c: 10, d: 'right' }
    ];

    DIRECTION_FIELDS.forEach(({ r, c, d }) => {
        if (board[r][c].piece) activeDirs.add(d);
    });

    const hasUp = activeDirs.has('up');
    const hasDown = activeDirs.has('down');
    const hasLeft = activeDirs.has('left');
    const hasRight = activeDirs.has('right');

    if (hasUp && !hasDown) targetX = -tiltAngle;
    if (hasDown && !hasUp) targetX = tiltAngle;
    if (hasLeft && !hasRight) targetZ = tiltAngle;
    if (hasRight && !hasLeft) targetZ = -tiltAngle;

    return { x: targetX, z: targetZ };
}

function syncBoardTilt(instant = false) {
    const target = getTargetTilt();
    if (instant) {
        groupBoard.rotation.x = target.x;
        groupBoard.rotation.z = target.z;
    } else {
        new TWEEN.Tween(groupBoard.rotation)
            .to({ x: target.x, z: target.z }, 600)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();
    }
}

async function animate3DMove(fromR, fromCol, toR, toCol) {
    const key = `${fromR},${fromCol}`;
    const mesh = stoneMeshes.get(key);
    if (!mesh) return;

    const tx = (toCol * TILE_SIZE) - BOARD_OFFSET;
    const tz = (toR * TILE_SIZE) - BOARD_OFFSET;

    return new Promise(resolve => {
        new TWEEN.Tween(mesh.position)
            .to({ x: tx, z: tz }, 400)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => {
                stoneMeshes.delete(key);
                
                // Cleanup any ghost mesh already at the target
                const targetKey = `${toR},${toCol}`;
                const oldMesh = stoneMeshes.get(targetKey);
                if (oldMesh && oldMesh !== mesh) {
                    groupPieces.remove(oldMesh);
                }
                
                stoneMeshes.set(targetKey, mesh);
                mesh.userData.r = toR;
                mesh.userData.c = toCol;
                resolve();
            })
            .start();
    });
}

async function animateGravityShift(direction, stonesMoving) {
    // 1. Sync Tilt (Diagonal support, semi-permanent)
    syncBoardTilt();

    // 2. Slide Stones
    const slideAnimations = stonesMoving.map(move => {
        const mesh = stoneMeshes.get(`${move.from.row},${move.from.col}`);
        if (!mesh) return Promise.resolve();
        
        const tx = (move.to.col * TILE_SIZE) - BOARD_OFFSET;
        const tz = (move.to.row * TILE_SIZE) - BOARD_OFFSET;
        
        return new Promise(resolve => {
            new TWEEN.Tween(mesh.position)
                .to({ x: tx, z: tz }, 800)
                .delay(100)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onComplete(() => {
                    stoneMeshes.delete(`${move.from.row},${move.from.col}`);
                    
                    // Cleanup any ghost mesh already at the target
                    const targetKey = `${move.to.row},${move.to.col}`;
                    const oldMesh = stoneMeshes.get(targetKey);
                    if (oldMesh && oldMesh !== mesh) {
                        groupPieces.remove(oldMesh);
                    }
                    
                    stoneMeshes.set(targetKey, mesh);
                    mesh.userData.r = move.to.row;
                    mesh.userData.c = move.to.col;
                    resolve();
                })
                .start();
        });
    });

    await Promise.all(slideAnimations);
    
    // 3. Update Tilt again after slide (stones might have moved to/from direction fields)
    syncBoardTilt();
    
    return new Promise(resolve => setTimeout(resolve, 300));
}

function onPointerDown(event) {
    if (!window.is3DView || typeof gameState === 'undefined' || gameState === 'GAME_OVER') return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // Group everything clickable
    const clickables = [...groupPieces.children, ...groupTiles.children];
    const intersects = raycaster.intersectObjects(clickables, true);

    if (intersects.length > 0) {
        let obj = intersects[0].object;
        // Find parent group with r, c data if clicked on children of stone
        while (obj && obj.userData.r === undefined && obj.parent) obj = obj.parent;
        
        if (obj && obj.userData.r !== undefined) {
            const r = obj.userData.r;
            const c = obj.userData.c;



            if (typeof handleCellClick === 'function') {
                handleCellClick(r, c);
            }
        }
    }
}

function update3DViews() {
    while (groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);

    if (typeof selectedStone !== 'undefined' && selectedStone) {
        const x = (selectedStone.col * TILE_SIZE) - BOARD_OFFSET;
        const z = (selectedStone.row * TILE_SIZE) - BOARD_OFFSET;
        const ring = new THREE.Mesh(new THREE.RingGeometry(TILE_SIZE * 0.4, TILE_SIZE * 0.5, 32), matSelection);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 1, z);
        groupHighlights.add(ring);
    }

    if (typeof validMoves !== 'undefined' && validMoves.length > 0) {
        validMoves.forEach(move => {
            const x = (move.col * TILE_SIZE) - BOARD_OFFSET;
            const z = (move.row * TILE_SIZE) - BOARD_OFFSET;
            const dot = new THREE.Mesh(new THREE.CircleGeometry(TILE_SIZE * 0.2, 16), matHighlight);
            dot.rotation.x = -Math.PI / 2;
            dot.position.set(x, 1, z);
            groupHighlights.add(dot);
        });
    }



    if (typeof lastMovedStonePos !== 'undefined' && lastMovedStonePos) {
        const x = (lastMovedStonePos.col * TILE_SIZE) - BOARD_OFFSET;
        const z = (lastMovedStonePos.row * TILE_SIZE) - BOARD_OFFSET;
        const ring = new THREE.Mesh(new THREE.RingGeometry(TILE_SIZE * 0.45, TILE_SIZE * 0.55, 32), matSelection);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 1.2, z);
        groupHighlights.add(ring);
    }
}

function animate3D(time) {
    TWEEN.update(time);
    controls.update();
    
    // Animate Torch Flicker
    if (window.torchLight) {
        window.torchLight.intensity = 2.0 + Math.random() * 0.8; // Brighter flicker
    }

    // Animate Fire Particles
    if (window.fireParticles) {
        window.fireParticles.children.forEach(p => {
            p.position.y += p.userData.speed;
            p.scale.setScalar(1 - (p.position.y / 100));
            if (p.position.y > 100) {
                p.position.y = 0;
                p.scale.setScalar(1);
            }
            p.position.x += Math.sin(time * 0.005 + p.userData.phase) * 0.5;
            p.position.z += Math.cos(time * 0.005 + p.userData.phase) * 0.5;
        });
    }

    renderer.render(scene, camera);
}

// Global hooks
window.init3D = init3D;
window.sync3D = sync3D;
window.animate3DMove = animate3DMove;
window.animateGravityShift = animateGravityShift;
window.update3DViews = update3DViews;
