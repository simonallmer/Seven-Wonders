// ============================================
// PHAROS GAME 3D VIEW
// Lighthouse of Alexandria and the 9x9 Board
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let needsRender = true;
window.is3DView = false;

// Groups
const groupEnvironment = new THREE.Group();
const groupIsland = new THREE.Group();
const groupBoard = new THREE.Group();
const groupTiles = new THREE.Group();
const groupPieces = new THREE.Group();
const groupHighlights = new THREE.Group();
const groupBeacons = new THREE.Group();

// Maps
const stoneMeshes = new Map();
const fieldMeshes = new Map();
const beaconMeshes = new Map(); // Key: "r,c", Value: { group, lamp, light }

// Constants
const TILE_SIZE = 25;
const BOARD_SIZE_3D = 9;
const BOARD_OFFSET = (BOARD_SIZE_3D - 1) * TILE_SIZE / 2;

// Materials
const matStone = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 0.8, metalness: 0.1 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xb4af94, roughness: 0.7, metalness: 0.2 });
const matWater = new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.8 });
const matWhiteStone = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.3 });
const matBlackStone = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.1, metalness: 0.3 }); // Red for Skyscraper theme
const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1, metalness: 0.9, emissive: 0xffd700, emissiveIntensity: 0.2 });
const matHighlight = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }); // Target highlight
const matSelection = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }); // Selection highlight
const matLightSource = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5 }); // Light source

function init3D() {
    const container = document.getElementById('canvas3d');
    if (!container) return;

    // Scene setup - Dramatic Night
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510); // Night sky
    scene.fog = new THREE.FogExp2(0x050510, 0.001);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 300, 450); // Closer start

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
    controls.enablePan = false; // Pan disabled
    controls.minDistance = 100;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);

    // Lighting - Night mood with Moonlight
    const hemiLight = new THREE.HemisphereLight(0x223366, 0x111122, 0.5);
    scene.add(hemiLight);
    
    // Moon-like Directional Light - Brighter for detail
    const dirLight = new THREE.DirectionalLight(0x8899cc, 1.0);
    dirLight.position.set(500, 1000, 200);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 1000;
    dirLight.shadow.camera.bottom = -1000;
    dirLight.shadow.camera.left = -1000;
    dirLight.shadow.camera.right = 1000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Groups setup
    scene.add(groupEnvironment);
    groupEnvironment.add(groupIsland);
    
    scene.add(groupBoard);
    groupBoard.position.y = 10; // Raised to avoid flickering with island
    groupBoard.add(groupTiles);
    groupBoard.add(groupPieces);
    groupBoard.add(groupHighlights);
    groupBoard.add(groupBeacons);

    buildEnvironment();
    build3DBoard();

    window.addEventListener('resize', onWindowResize);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    renderer.setAnimationLoop(animate3D);
    
    if (typeof board !== 'undefined') sync3D();

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (typeof toggleMenu === 'function') toggleMenu();
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    needsRender = true;
}

function buildEnvironment() {
    // Water
    const waterGeom = new THREE.CircleGeometry(5000, 32);
    const water = new THREE.Mesh(waterGeom, matWater);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -20;
    water.receiveShadow = true;
    groupEnvironment.add(water);

    // Island
    const islandBase = new THREE.Mesh(
        new THREE.CylinderGeometry(400, 450, 40, 32),
        new THREE.MeshStandardMaterial({ color: 0x4a453a, roughness: 0.9 })
    );
    islandBase.position.y = -20;
    islandBase.receiveShadow = true;
    groupIsland.add(islandBase);

    // Decorative rocks
    for (let i = 0; i < 12; i++) {
        const rock = new THREE.Mesh(
            new THREE.IcosahedronGeometry(20 + Math.random() * 40, 0),
            new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0 })
        );
        const angle = (i / 12) * Math.PI * 2;
        const dist = 380 + Math.random() * 50;
        rock.position.set(Math.cos(angle) * dist, -15, Math.sin(angle) * dist);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        groupIsland.add(rock);
    }

    // Stars
    const starGeom = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 2000; i++) {
        starPositions.push((Math.random() * 2 - 1) * 3000);
        starPositions.push(Math.random() * 1000 + 200);
        starPositions.push((Math.random() * 2 - 1) * 3000);
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);
}

function createBeaconTower(r, c, isCenter = false) {
    const group = new THREE.Group();
    const height = isCenter ? 120 : 60;
    const baseSize = isCenter ? 30 : 20;

    // Arched Base (4 Pillars)
    const pillarW = baseSize * 0.15;
    const pillarH = height * 0.25;
    const pillarPositions = [
        { x: -baseSize/2 + pillarW/2, z: -baseSize/2 + pillarW/2 },
        { x: baseSize/2 - pillarW/2, z: -baseSize/2 + pillarW/2 },
        { x: -baseSize/2 + pillarW/2, z: baseSize/2 - pillarW/2 },
        { x: baseSize/2 - pillarW/2, z: baseSize/2 - pillarW/2 }
    ];

    pillarPositions.forEach(p => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarW), matStone);
        pillar.position.set(p.x, pillarH/2, p.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        group.add(pillar);
    });

    // Upper part of base (on top of pillars)
    const basePlatform = new THREE.Mesh(new THREE.BoxGeometry(baseSize, height * 0.1, baseSize), matStone);
    basePlatform.position.y = pillarH + (height * 0.05);
    basePlatform.castShadow = true;
    basePlatform.receiveShadow = true;
    group.add(basePlatform);

    // Second Tier (Octagonal)
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(baseSize * 0.4, baseSize * 0.5, height * 0.3, 8), matStone);
    tier2.position.y = height * 0.55;
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    group.add(tier2);

    // Top Platform
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(baseSize * 0.45, baseSize * 0.4, 4, 8), matStone);
    platform.position.y = height * 0.7;
    group.add(platform);

    // Visible Glow Lamp (Primary sphere)
    const lampGeom = new THREE.SphereGeometry(baseSize * 0.35, 24, 24);
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0x000000,
        emissiveIntensity: 0
    });
    const lamp = new THREE.Mesh(lampGeom, lampMat);
    lamp.position.y = height * 0.78;
    group.add(lamp);

    // Halo Shell (Secondary glow)
    const shellGeom = new THREE.SphereGeometry(baseSize * 0.45, 24, 24);
    const shellMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide
    });
    const shell = new THREE.Mesh(shellGeom, shellMat);
    shell.position.y = height * 0.78;
    group.add(shell);

    // Point Light (initially off)
    const light = new THREE.PointLight(0xffffff, 0, 300);
    light.position.y = height * 0.78;
    group.add(light);

    const x = (c * TILE_SIZE) - BOARD_OFFSET;
    const z = (r * TILE_SIZE) - BOARD_OFFSET;
    group.position.set(x, 0, z);

    return { group, lamp, light, shell };
}

function build3DBoard() {
    fieldMeshes.clear();
    beaconMeshes.clear();
    while (groupTiles.children.length > 0) groupTiles.remove(groupTiles.children[0]);
    while (groupBeacons.children.length > 0) groupBeacons.remove(groupBeacons.children[0]);

    for (let r = 0; r < BOARD_SIZE_3D; r++) {
        for (let c = 0; c < BOARD_SIZE_3D; c++) {
            const x = (c * TILE_SIZE) - BOARD_OFFSET;
            const z = (r * TILE_SIZE) - BOARD_OFFSET;

            const isWall = (r === 0 || r === BOARD_SIZE_3D - 1 || c === 0 || c === BOARD_SIZE_3D - 1);
            const isBeacon = isBeaconField(r, c);

            // Tile/Field
            let tileHeight = isWall ? 12 : 4;
            let sizeScale = isWall ? 1.1 : 1.0;
            
            const tileGeom = new THREE.BoxGeometry(TILE_SIZE * sizeScale - 1, tileHeight, TILE_SIZE * sizeScale - 1);
            const tileMat = isWall ? matWall.clone() : matStone.clone();
            
            // Checkerboard pattern for central area
            if (!isWall && (r + c) % 2 === 0) {
                tileMat.color.multiplyScalar(0.9);
            }

            const tile = new THREE.Mesh(tileGeom, tileMat);
            tile.position.set(x, tileHeight / 2 - 4, z); // Lowered by 4.1 to sit on rock surface
            tile.receiveShadow = true;
            tile.userData = { r, c, isField: true };
            groupTiles.add(tile);
            fieldMeshes.set(`${r},${c}`, tile);

            // Beacon Tower
            if (isBeacon) {
                const isCenter = (r === 4 && c === 4);
                const beacon = createBeaconTower(r, c, isCenter);
                const surfaceY = isWall ? 8 : 0;
                beacon.group.position.y = surfaceY;
                groupBeacons.add(beacon.group);
                beaconMeshes.set(`${r},${c}`, beacon);
            }
        }
    }
}

function createStoneMesh(color) {
    const group = new THREE.Group();
    const material = (color === 'white' ? matWhiteStone : matBlackStone).clone();
    
    // Body (Temple Style)
    const bodyGeo = new THREE.CylinderGeometry(8, 9, 11, 24);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 5.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Top Sphere (Temple Style)
    const topGeo = new THREE.SphereGeometry(8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const top = new THREE.Mesh(topGeo, material);
    top.position.y = 11;
    top.castShadow = true;
    group.add(top);

    // Bevel/Gold Ring (Temple Style)
    const bevelGeo = new THREE.TorusGeometry(8, 0.6, 12, 32);
    const bevel = new THREE.Mesh(bevelGeo, matGold);
    bevel.rotation.x = Math.PI / 2;
    bevel.position.y = 11;
    bevel.castShadow = true;
    group.add(bevel);

    return group;
}

function sync3D() {
    if (typeof board === 'undefined') return;

    const currentKeys = new Set();
    for (let r = 0; r < BOARD_SIZE_3D; r++) {
        for (let c = 0; c < BOARD_SIZE_3D; c++) {
            if (board[r][c].piece) {
                const key = `${r},${c}`;
                currentKeys.add(key);
                const color = board[r][c].piece;

                if (!stoneMeshes.has(key)) {
                    const stone = createStoneMesh(color);
                    const x = (c * TILE_SIZE) - BOARD_OFFSET;
                    const z = (r * TILE_SIZE) - BOARD_OFFSET;
                    
                    const isWall = (r === 0 || r === BOARD_SIZE_3D - 1 || c === 0 || c === BOARD_SIZE_3D - 1);
                    stone.position.set(x, (isWall ? 8 : 0) + 0.1, z);
                    
                    stone.userData = { r, c, color };
                    groupPieces.add(stone);
                    stoneMeshes.set(key, stone);
                }

                // Update visual state (darkened/opacity)
                const mesh = stoneMeshes.get(key);
                
                // NEW: Darken stones that have given light this turn
                const hasGivenLight = lightSourceUsage && lightSourceUsage[key] > 0;
                
                // Fully darkened check (cannot move/be selected)
                const isFullyDarkened = !hasAvailableLight(r, c, currentPlayer);
                
                const origColorHex = mesh.userData.color === 'white' ? 0xffffff : 0x8b0000;
                const greyColorHex = mesh.userData.color === 'white' ? 0x888888 : 0x440000;
                
                // Apply visual states to the body and top
                [mesh.children[0], mesh.children[1]].forEach(part => {
                    if (hasGivenLight) {
                        part.material.color.setHex(greyColorHex);
                    } else {
                        part.material.color.setHex(origColorHex);
                    }
                    
                    // Opacity for fully darkened
                    part.material.opacity = isFullyDarkened && board[r][c].piece === currentPlayer ? 0.4 : 1.0;
                    part.material.transparent = isFullyDarkened;
                });
            }
        }
    }

    // Remove stones that are no longer on board
    stoneMeshes.forEach((mesh, key) => {
        if (!currentKeys.has(key)) {
            groupPieces.remove(mesh);
            stoneMeshes.delete(key);
        }
    });

    // Update Beacon Lights
    beaconMeshes.forEach((beacon, key) => {
        const [r, c] = key.split(',').map(Number);
        const owner = litBeacons[key];
        const isCenter = (r === 4 && c === 4);
        const brightnessFactor = isCenter ? 0.8 : 1.0;

        if (owner) {
            const lightColor = owner === 'white' ? 0xffffff : 0xff0000; // Red light
            beacon.light.color.set(lightColor);
            beacon.light.intensity = 3.5 * brightnessFactor;
            beacon.lamp.material.emissive.set(lightColor);
            beacon.lamp.material.emissiveIntensity = 2.0 * brightnessFactor;

            if (beacon.shell) {
                beacon.shell.material.color.set(lightColor);
                beacon.shell.material.opacity = 0.35 * brightnessFactor;
            }
        } else {
            beacon.light.intensity = 0;
            beacon.lamp.material.emissive.set(0x000000);
            beacon.lamp.material.emissiveIntensity = 0;
            if (beacon.shell) {
                beacon.shell.material.opacity = 0;
            }
        }
    });

    update3DViews();
    needsRender = true;
}

async function animate3DMove(fromR, fromC, toR, toC) {
    const key = `${fromR},${fromC}`;
    const mesh = stoneMeshes.get(key);
    if (!mesh) return;

    const toKey = `${toR},${toC}`;
    const targetMesh = stoneMeshes.get(toKey);
    // If there is an opponent stone at the target position, it will be captured/displaced
    if (targetMesh) {
        groupPieces.remove(targetMesh);
        stoneMeshes.delete(toKey);
    }

    const tx = (toC * TILE_SIZE) - BOARD_OFFSET;
    const tz = (toR * TILE_SIZE) - BOARD_OFFSET;

    const isToWall = (toR === 0 || toR === BOARD_SIZE_3D - 1 || toC === 0 || toC === BOARD_SIZE_3D - 1);
    const ty = (isToWall ? 8 : 0) + 0.1;

    return new Promise(resolve => {
        new TWEEN.Tween(mesh.position)
            .to({ x: tx, y: ty, z: tz }, 600)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => {
                stoneMeshes.delete(key);
                stoneMeshes.set(`${toR},${toC}`, mesh);
                mesh.userData.r = toR;
                mesh.userData.c = toC;
                resolve();
            })
            .start();
    });
}

function onPointerDown(event) {
    if (!window.is3DView || typeof gameState === 'undefined' || gameState === 'GAME_OVER') return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const clickables = [...groupPieces.children, ...groupTiles.children];
    const intersects = raycaster.intersectObjects(clickables, true);

    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && obj.userData.r === undefined && obj.parent) obj = obj.parent;
        
        if (obj && obj.userData.r !== undefined) {
            const r = obj.userData.r;
            const c = obj.userData.c;
            if (typeof handleCellClick === 'function') handleCellClick(r, c);
        }
    }
}

let hoveredField = null;
function onPointerMove(event) {
    if (!window.is3DView) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    updateHoverEffect();
}

function updateHoverEffect() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(groupTiles.children);
    
    if (hoveredField) {
        hoveredField.material.emissive.setHex(0x000000);
        hoveredField = null;
    }
    
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.isField) {
            hoveredField = obj;
            hoveredField.material.emissive.setHex(0x333333);
            renderer.domElement.style.cursor = 'pointer';
        } else {
            renderer.domElement.style.cursor = 'default';
        }
    } else {
        renderer.domElement.style.cursor = 'default';
    }
}

function update3DViews() {
    while (groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);

    // Draw Light Beam if a source is active
    let currentStep = typeof moveHistory !== 'undefined' ? moveHistory[moveHistory.length - 1] : null;
    if (gameState === 'SELECT_TARGET_CELL' && currentStep && currentStep.lightUsed && moveSource) {
        drawConnectionBeam(currentStep.lightUsed, moveSource, currentPlayer);
    }

    // Highlight selected piece
    if (moveSource) {
        const x = (moveSource.c * TILE_SIZE) - BOARD_OFFSET;
        const z = (moveSource.r * TILE_SIZE) - BOARD_OFFSET;
        const isWall = (moveSource.r === 0 || moveSource.r === BOARD_SIZE_3D - 1 || moveSource.c === 0 || moveSource.c === BOARD_SIZE_3D - 1);
        const tileScale = isWall ? 1.1 : 1.0;
        const elevation = isWall ? 8.2 : 0.2; // Adjusted for groupBoard.y = 10, relative to parent
        
        // Selection Square (Floor indicator)
        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE * tileScale - 0.5, 0.5, TILE_SIZE * tileScale - 0.5),
            matSelection
        );
        marker.position.set(x, elevation, z);
        groupHighlights.add(marker);
        
        // Ring around the stone
        const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.2, 8, 32), matSelection);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, elevation + 12, z); 
        groupHighlights.add(ring);
    }

    // Highlight light sources
    if (gameState === 'SELECT_LIGHT_SOURCE' && potentialLightSources) {
        potentialLightSources.forEach(s => {
            const x = (s.c * TILE_SIZE) - BOARD_OFFSET;
            const z = (s.r * TILE_SIZE) - BOARD_OFFSET;
            const isWall = (s.r === 0 || s.r === BOARD_SIZE_3D - 1 || s.c === 0 || s.c === BOARD_SIZE_3D - 1);
            const tileScale = isWall ? 1.1 : 1.0;
            const elevation = isWall ? 8.3 : 0.3;
            
            // Light source plate
            const plate = new THREE.Mesh(
                new THREE.BoxGeometry(TILE_SIZE * tileScale - 1, 0.5, TILE_SIZE * tileScale - 1),
                matLightSource
            );
            plate.position.set(x, elevation, z);
            groupHighlights.add(plate);

            // Check if source is a beacon tower for highlight height
            const isBeaconAtSource = isBeaconField(s.r, s.c);
            let ringHeight = elevation + 12.5;
            if (isBeaconAtSource) {
                const towerHeight = (s.r === 4 && s.c === 4 ? 120 : 60);
                ringHeight = towerHeight * 0.8;
            }

            const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.2, 8, 32), matLightSource);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(x, ringHeight, z);
            groupHighlights.add(ring);
        });
    }

    // Highlight move targets
    if (gameState === 'SELECT_TARGET_CELL' && potentialMoveTargets) {
        potentialMoveTargets.forEach(t => {
            const x = (t.c * TILE_SIZE) - BOARD_OFFSET;
            const z = (t.r * TILE_SIZE) - BOARD_OFFSET;
            const isWall = (t.r === 0 || t.r === BOARD_SIZE_3D - 1 || t.c === 0 || t.c === BOARD_SIZE_3D - 1);
            const tileScale = isWall ? 1.1 : 1.0;
            const elevation = isWall ? 8.1 : 0.1;
            
            // Target square plate
            const marker = new THREE.Mesh(
                new THREE.BoxGeometry(TILE_SIZE * tileScale - 1, 0.5, TILE_SIZE * tileScale - 1),
                matHighlight
            );
            marker.position.set(x, elevation, z);
            groupHighlights.add(marker);
        });
    }
}

function drawConnectionBeam(source, target, player) {
    const x1 = (source.c * TILE_SIZE) - BOARD_OFFSET;
    const z1 = (source.r * TILE_SIZE) - BOARD_OFFSET;
    const isWall1 = (source.r === 0 || source.r === BOARD_SIZE_3D - 1 || source.c === 0 || source.c === BOARD_SIZE_3D - 1);
    
    // Check if source is a beacon tower for height adjustment
    const isBeaconAtSource = isBeaconField(source.r, source.c);
    const surfaceY1 = isWall1 ? 8 : 0;
    const height1 = isBeaconAtSource ? surfaceY1 + (source.r === 4 && source.c === 4 ? 120 : 60) * 0.78 : (isWall1 ? 19 : 11);

    const x2 = (target.c * TILE_SIZE) - BOARD_OFFSET;
    const z2 = (target.r * TILE_SIZE) - BOARD_OFFSET;
    const isWall2 = (target.r === 0 || target.r === BOARD_SIZE_3D - 1 || target.c === 0 || target.c === BOARD_SIZE_3D - 1);
    const height2 = isWall2 ? 19 : 11;

    const v1 = new THREE.Vector3(x1, height1, z1);
    const v2 = new THREE.Vector3(x2, height2, z2);
    
    const distance = v1.distanceTo(v2);
    const geometry = new THREE.CylinderGeometry(2, 2, distance, 8);
    const lightColor = player === 'white' ? 0xffffff : 0xff0000;
    
    const material = new THREE.MeshBasicMaterial({
        color: lightColor,
        transparent: true,
        opacity: 0.6
    });
    
    const beam = new THREE.Mesh(geometry, material);
    
    // Position and rotate cylinder to connect points
    beam.position.copy(v1.clone().add(v2).multiplyScalar(0.5));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
    
    groupHighlights.add(beam);
}

function animate3D(time) {
    TWEEN.update(time);
    controls.update();
    renderer.render(scene, camera);
}

// Global hooks
window.init3D = init3D;
window.sync3D = sync3D;
window.animate3DMove = animate3DMove;
window.update3DViews = update3DViews;
