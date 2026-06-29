// ============================================
// TEMPLE GAME 3D VIEW
// ============================================

let scene, camera, renderer, controls;
let raycaster, mouse;
window.is3DView = false;

// Groups
const groupTemple = new THREE.Group();
const groupBoard = new THREE.Group();
const groupPieces = new THREE.Group();
const groupConnections = new THREE.Group();
const groupHighlights = new THREE.Group();

// Maps for easy access
const stoneMeshes = new Map();
const fieldMeshes = new Map();

// Materials
const matMarbleBase = new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.8, metalness: 0.1 });
const matPillar = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.7, metalness: 0.1 });
const matField = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 0.6, metalness: 0.2 });
const matArtemis = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.4, metalness: 0.2, emissive: 0x4c1d95, emissiveIntensity: 0.5 });
const matWhitePiece = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const matBlackPiece = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.3 });
const matRedPiece = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3, metalness: 0.2 });
const matBluePiece = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.3, metalness: 0.2 });
const PIECE_MATS = { white: matWhitePiece, black: matBlackPiece, red: matRedPiece, blue: matBluePiece };
const matHighlight = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5, depthTest: false });
const matSelection = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6, depthTest: false });

// Initialize 3D Engine
function init3D() {
    const container = document.getElementById('canvas3d');

    // Scene setup
    scene = new THREE.Scene();
    // Sky color inspired by majestic atmosphere
    scene.background = new THREE.Color(0xfde0ad); // Warm sunrise/sunset
    scene.fog = new THREE.FogExp2(0xfde0ad, 0.002);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    // Position camera to look at the temple from an angle
    camera.position.set(0, 180, 250);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 600;
    controls.enablePan = false; // Disable panning to keep view centered
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff2e0, 0x4a5d23, 0.4);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffdfa0, 1.2);
    dirLight.position.set(150, 80, -100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 1000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-100, 150, -100);
    scene.add(backLight);

    // Construct Temple Environment
    buildTempleEnvironment();

    // Resize handler
    window.addEventListener('resize', onWindowResize);

    // Raycaster for interaction (use window to capture clicks correctly)
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    let __pointerDownPos_templedjs = { x: 0, y: 0 };
    window.addEventListener('pointerdown', (e) => {
        __pointerDownPos_templedjs.x = e.clientX;
        __pointerDownPos_templedjs.y = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
        const dx = e.clientX - __pointerDownPos_templedjs.x;
        const dy = e.clientY - __pointerDownPos_templedjs.y;
        if (Math.sqrt(dx*dx + dy*dy) < 5) {
            onPointerDown(e);
        }
    });


    // Animation loop
    renderer.setAnimationLoop(animate3D);

    // Build the fields from the 2D board data
    build3DBoard();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Convert 2D SVG coords to 3D coords
function get3DCoord(svgX, svgY) {
    // 4-player Greek cross: centred at (70,70), full size (temple is widened to fit).
    if (typeof numPlayers !== 'undefined' && numPlayers === 4) {
        const scale = 1.5;
        return { x: (svgX - 70) * scale, z: (svgY - 70) * scale };
    }
    // 2-player: SVG X 24-76 (centre 50), Y 5-109 (centre 57)
    const scale = 1.8;
    return { x: (svgX - 50) * scale, z: (svgY - 57) * scale };
}

function buildTempleEnvironment() {
    // Group hierarchy
    scene.add(groupTemple);
    groupTemple.add(groupBoard);
    scene.add(groupPieces);
    scene.add(groupConnections);
    scene.add(groupHighlights);

    // Parameters
    const is4 = (typeof numPlayers !== 'undefined' && numPlayers === 4);
    const baseWidth = 110;
    const baseLength = 202;
    const stepCount = 3;
    const stepHeight = 4;
    const stepDepth = 6;

    // 4-player Greek-cross footprint: two crossing bars (a +). 2-player: single rectangle.
    const CROSS_HALF_W = 56;   // half-width of each bar
    const CROSS_HALF_L = 100;  // half-length of each bar (arm reach)

    const addBox = (w, h, l, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), matMarbleBase);
        m.position.y = y;
        m.receiveShadow = true; m.castShadow = true;
        groupTemple.add(m);
    };

    if (is4) {
        // + floor (two crossing slabs) + + steps
        for (let i = 0; i < stepCount; i++) {
            const grow = (stepCount - i) * stepDepth * 2;
            const y = -(stepCount - i) * stepHeight + stepHeight / 2;
            addBox(CROSS_HALF_W * 2 + grow, stepHeight, CROSS_HALF_L * 2 + grow, y); // vertical bar
            addBox(CROSS_HALF_L * 2 + grow, stepHeight, CROSS_HALF_W * 2 + grow, y); // horizontal bar
        }
        addBox(CROSS_HALF_W * 2, 4, CROSS_HALF_L * 2, 2); // floor — vertical bar
        addBox(CROSS_HALF_L * 2, 4, CROSS_HALF_W * 2, 2); // floor — horizontal bar
    } else {
        // Stairs/Base (rectangular)
        for (let i = 0; i < stepCount; i++) {
            const w = baseWidth + (stepCount - i) * stepDepth * 2;
            const l = baseLength + (stepCount - i) * stepDepth * 2;
            addBox(w, stepHeight, l, -(stepCount - i) * stepHeight + stepHeight / 2);
        }
        addBox(baseWidth, 4, baseLength, 2); // top floor
    }

    // Detailed Ionic Order pillar dimensions
    const pRadius = 5.5;
    const pHeight = 80;
    
    function createIonicPillar(x, y, z) {
        const group = new THREE.Group();
        
        // Shaft (fluted appearance with 16 segments, slightly tapered)
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(pRadius * 0.85, pRadius, pHeight, 16), matPillar);
        shaft.position.y = pHeight / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);

        // Base (Torus moldings)
        const base1 = new THREE.Mesh(new THREE.TorusGeometry(pRadius * 1.3, 1, 16, 24), matPillar);
        base1.rotation.x = Math.PI / 2;
        base1.position.y = 1;
        base1.castShadow = true;
        group.add(base1);

        const base2 = new THREE.Mesh(new THREE.TorusGeometry(pRadius * 1.1, 0.8, 16, 24), matPillar);
        base2.rotation.x = Math.PI / 2;
        base2.position.y = 2.5;
        base2.castShadow = true;
        group.add(base2);

        const squareBase = new THREE.Mesh(new THREE.BoxGeometry(pRadius * 3, 1, pRadius * 3), matPillar);
        squareBase.position.y = 0.5;
        squareBase.castShadow = true;
        group.add(squareBase);

        // Capital (Echinus and Volutes)
        // Echinus (cushion)
        const echinus = new THREE.Mesh(new THREE.CylinderGeometry(pRadius * 1.1, pRadius * 0.85, 1.0, 16), matPillar);
        echinus.position.y = pHeight + 0.5; // (80 to 81)
        echinus.castShadow = true;
        group.add(echinus);

        // Two Volutes (Scrolls on left and right edges facing front/back)
        const voluteRadius = 1.8;
        const voluteGeom = new THREE.CylinderGeometry(voluteRadius, voluteRadius, pRadius * 2.7, 16);
        
        // Left Roll
        const volute1 = new THREE.Mesh(voluteGeom, matPillar);
        volute1.rotation.x = Math.PI / 2; // Lie along Z axis
        volute1.position.set(-pRadius * 1.1, pHeight + 2, 0); // Center at 82, Top 83.8
        volute1.castShadow = true;
        group.add(volute1);

        // Right Roll
        const volute2 = new THREE.Mesh(voluteGeom, matPillar);
        volute2.rotation.x = Math.PI / 2;
        volute2.position.set(pRadius * 1.1, pHeight + 2, 0);
        volute2.castShadow = true;
        group.add(volute2);

        // Inner recessed scroll details
        const vInMat = new THREE.MeshStandardMaterial({color: 0xc4bbaa, roughness: 0.9});
        const vInGeom = new THREE.CylinderGeometry(voluteRadius * 0.6, voluteRadius * 0.6, pRadius * 2.8, 16);
        
        const vIn1 = new THREE.Mesh(vInGeom, vInMat);
        vIn1.rotation.x = Math.PI / 2;
        vIn1.position.copy(volute1.position);
        group.add(vIn1);

        const vIn2 = new THREE.Mesh(vInGeom, vInMat);
        vIn2.rotation.x = Math.PI / 2;
        vIn2.position.copy(volute2.position);
        group.add(vIn2);

        // Bolster (Artificial filling between the volutes)
        const bolsterGeom = new THREE.BoxGeometry(pRadius * 2.2, voluteRadius * 2, pRadius * 2.6);
        const bolster = new THREE.Mesh(bolsterGeom, matPillar);
        bolster.position.y = pHeight + 2; 
        bolster.castShadow = true;
        group.add(bolster);

        // Abacus (flat plate resting on the rolls at top)
        const abacusWidth = pRadius * 3.4;
        const abacusDepth = pRadius * 2.7;
        const abacus = new THREE.Mesh(new THREE.BoxGeometry(abacusWidth, 1.0, abacusDepth), matPillar);
        abacus.position.y = pHeight + 4.3; // (Top of rolls is 83.8, Abacus center 84.3 -> bottom 83.8)
        abacus.castShadow = true;
        group.add(abacus);

        group.position.set(x, y, z);
        return group;
    }

    // Pillars: 2-player has 4 at the rectangle corners; 4-player has 8 at the
    // convex corners of the + (two at the end of each of the four arms).
    const W = CROSS_HALF_W, L = CROSS_HALF_L;
    const positions = is4 ? [
        [-W, -L], [W, -L], [-W, L], [W, L],   // vertical bar (top & bottom arm ends)
        [-L, -W], [-L, W], [L, -W], [L, W]    // horizontal bar (left & right arm ends)
    ] : [
        [-46.8, -93.6], [46.8, -93.6], [-46.8, 93.6], [46.8, 93.6]
    ];

    positions.forEach(([x, z]) => {
        const p = createIonicPillar(x, 4, z); // floor at y=4
        groupTemple.add(p);
    });

    // Horizon Stones & Epic Courtyard Terraces
    const tMat = new THREE.MeshStandardMaterial({ color: 0xcdc0b0, roughness: 0.9, metalness: 0.1 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.7 });
    const terraces = [
        {w: 800, h: 2, l: 1000, y: -13, z: 0, mat: baseMat}, // Lowered courtyard to expose 3 stairs
        {w: 900, h: 20, l: 1100, y: -24, z: 0, mat: tMat},
        {w: 1200, h: 40, l: 1500, y: -54, z: 0, mat: tMat}
    ];
    terraces.forEach(t => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.l), t.mat);
        mesh.position.set(0, t.y, t.z);
        mesh.receiveShadow = true;
        groupTemple.add(mesh);
    });

    // Massive Disappearing Roof
    const roofGroup = new THREE.Group();
    window.templeRoof = roofGroup;

    const architraveMat = matPillar.clone();
    architraveMat.transparent = true; architraveMat.opacity = 0;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2b, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0 });
    const roofBaseY = 94.8;
    const roofHeight = 16;

    // Build one gable roof: width = span across which the roof pitches (x), length = ridge run (z).
    function makeGable(width, length) {
        const g = new THREE.Group();
        const add = (geo, y, mat) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
        add(new THREE.BoxGeometry(width - 2, 4, length - 2), 86.8, architraveMat);     // architrave
        add(new THREE.BoxGeometry(width - 4, 4, length - 4), 90.8, architraveMat);     // frieze
        add(new THREE.BoxGeometry(width, 2, length), 93.8, architraveMat);            // cornice
        // Tympana at both gable ends
        const tympHalf = width / 2 - 5;
        const tympShape = new THREE.Shape();
        tympShape.moveTo(-tympHalf, 0); tympShape.lineTo(0, roofHeight - 1); tympShape.lineTo(tympHalf, 0); tympShape.lineTo(-tympHalf, 0);
        const tymThick = 6;
        [length / 2 - tymThick, -length / 2].forEach(zPos => {
            const tm = new THREE.Mesh(new THREE.ExtrudeGeometry(tympShape, { depth: tymThick, bevelEnabled: false }), architraveMat);
            tm.position.set(0, roofBaseY, zPos);
            tm.castShadow = true; g.add(tm);
        });
        // Pitched panels
        const panelWidth = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(roofHeight, 2));
        const panelAngle = Math.atan2(roofHeight, width / 2);
        const panelGeom = new THREE.BoxGeometry(panelWidth, 2, length);
        const lp = new THREE.Mesh(panelGeom, roofMat);
        lp.position.set(-width / 4, roofBaseY + roofHeight / 2, 0); lp.rotation.z = panelAngle; lp.castShadow = true; g.add(lp);
        const rp = new THREE.Mesh(panelGeom, roofMat);
        rp.position.set(width / 4, roofBaseY + roofHeight / 2, 0); rp.rotation.z = -panelAngle; rp.castShadow = true; g.add(rp);
        return g;
    }

    if (is4) {
        // Two intertwining gable roofs forming a + (one per bar of the cross)
        const gw = CROSS_HALF_W * 2 + 12; // 124
        const gl = CROSS_HALF_L * 2 + 12; // 212
        roofGroup.add(makeGable(gw, gl));               // ridge along z (vertical bar)
        const gx = makeGable(gw, gl); gx.rotation.y = Math.PI / 2; // ridge along x (horizontal bar)
        roofGroup.add(gx);
    } else {
        roofGroup.add(makeGable(114, 208));
    }

    groupTemple.add(roofGroup);
}

function build3DBoard() {
    // Clear existing
    while(groupBoard.children.length > 0) groupBoard.remove(groupBoard.children[0]);
    while(groupConnections.children.length > 0) groupConnections.remove(groupConnections.children[0]);
    fieldMeshes.clear();

    const fieldHeight = 4; // pushed out of ground
    const surfaceY = 4; // Top of floor

    // Draw fields
    board.forEach((node, key) => {
        const { x, z } = get3DCoord(node.x, node.y);
        
        // Pedestal (truncated cone for "pushed out")
        const geomPedestal = new THREE.CylinderGeometry(5, 7, fieldHeight, 16);
        const material = node.isArtemis ? matArtemis : matField;
        const mesh = new THREE.Mesh(geomPedestal, material);
        mesh.position.set(x, surfaceY + fieldHeight/2, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        
        // Add user data for raycasting
        mesh.userData = { isField: true, row: node.row, col: node.col, key: key };
        
        groupBoard.add(mesh);
        fieldMeshes.set(key, mesh);
    });

    // Draw Connection bridges
    // We will draw bridges between pedestals slightly above the floor
    const drawnLines = new Set();
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.7 });

    connections.forEach((nodeConnections, key) => {
        const node = board.get(key);
        const { x: x1, z: z1 } = get3DCoord(node.x, node.y);

        nodeConnections.forEach(conn => {
            const connKey = `${conn.row},${conn.col}`;
            const lineId = [key, connKey].sort().join('|');

            if (!drawnLines.has(lineId)) {
                const connNode = board.get(connKey);
                const { x: x2, z: z2 } = get3DCoord(connNode.x, connNode.y);

                const dx = x2 - x1;
                const dz = z2 - z1;
                const distance = Math.sqrt(dx*dx + dz*dz);
                const angle = Math.atan2(dx, dz);

                // Use BoxGeometry for bridges
                const bridgeGeom = new THREE.BoxGeometry(2.5, 1.5, distance - 8);
                const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
                
                bridge.position.set(x1 + dx/2, surfaceY + 2, z1 + dz/2);
                bridge.rotation.y = angle;
                bridge.receiveShadow = true;
                bridge.castShadow = true;

                groupConnections.add(bridge);
                drawnLines.add(lineId);
            }
        });
    });
    
    sync3DPieces();
}

function sync3DPieces(animate = false) {
    // Determine target state
    const currentBoard = new Map();
    board.forEach((node, key) => {
        if (node.piece) {
            currentBoard.set(key, node.piece);
        }
    });

    // Remove logic
    const toRemove = [];
    stoneMeshes.forEach((mesh, pieceKey) => {
        // pieceKey might just be a unique ID, or we can use row_col as key
        // We actually track meshes by current board position key
        if (!currentBoard.has(pieceKey) || currentBoard.get(pieceKey) !== mesh.userData.color) {
            toRemove.push(pieceKey);
        }
    });

    toRemove.forEach(key => {
        const m = stoneMeshes.get(key);
        // Animate out if leap of faith or capture
        if (animate) {
            new TWEEN.Tween(m.scale)
                .to({ x:0, y:0, z:0 }, 300)
                .easing(TWEEN.Easing.Back.In)
                .onComplete(() => {
                    groupPieces.remove(m);
                })
                .start();
        } else {
            groupPieces.remove(m);
        }
        stoneMeshes.delete(key);
    });

    // Add or Update logic
    currentBoard.forEach((color, key) => {
        const node = board.get(key);
        const { x, z } = get3DCoord(node.x, node.y);
        const surfaceY = 4 + 4; // floor + fieldHeight

        if (!stoneMeshes.has(key)) {
            const group = new THREE.Group();
            
            // Replicate Pyramid Game's stone geometry exactly at roughly 10x scale
            const bodyGeo = new THREE.CylinderGeometry(3.2, 3.6, 4.5, 24);
            const originalMat = PIECE_MATS[color] || matBlackPiece;
            const bodyMat = originalMat.clone(); // Clone to prevent global emissive leaks
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);
            
            const topGeo = new THREE.SphereGeometry(3.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const top = new THREE.Mesh(topGeo, bodyMat);
            top.position.y = 2.25;
            top.castShadow = true;
            group.add(top);

            const bevelGeo = new THREE.TorusGeometry(3.2, 0.25, 12, 32);
            const bevelMat = new THREE.MeshStandardMaterial({
                color: 0xD4AF37,
                roughness: 0.2,
                metalness: 0.8,
                emissive: 0x332200,
                emissiveIntensity: 0.1
            });
            const bevel = new THREE.Mesh(bevelGeo, bevelMat);
            bevel.rotation.x = Math.PI / 2;
            bevel.position.y = 2.2;
            bevel.castShadow = true;
            group.add(bevel);
            
            group.position.set(x, surfaceY + 2.25, z);
            group.userData = { isStone: true, color: color, row: node.row, col: node.col, key: key };
            
            // Add user data to children to catch raycasts and store their original emissive
            [body, top, bevel].forEach(m => {
                m.userData = group.userData;
                m.userData.originalEmissive = m.material.emissive.getHex();
            });

            groupPieces.add(group);
            stoneMeshes.set(key, group);

            if (animate) {
                group.scale.set(0,0,0);
                new TWEEN.Tween(group.scale)
                    .to({x:1, y:1, z:1}, 400)
                    .easing(TWEEN.Easing.Elastic.Out)
                    .start();
            }
        } else {
            // Ensure position is correct
            const mesh = stoneMeshes.get(key);
            mesh.userData.row = node.row;
            mesh.userData.col = node.col;
            if (!animate) {
                mesh.position.set(x, surfaceY + 2.25, z);
            }
        }
    });
}

function animateMove3D(fromRow, fromCol, toRow, toCol, onCompleteCallback) {
    const fromKey = `${fromRow},${fromCol}`;
    const toKey = `${toRow},${toCol}`;
    const mesh = stoneMeshes.get(fromKey);

    if (mesh) {
        // Find target coords
        const toNode = board.get(toKey) || { 
            // Handle leap of faith off-board calc if needed, though usually we just scale down
            x: board.get(fromKey).x + (toCol - fromCol)*13, 
            y: board.get(fromKey).y + (toRow - fromRow)*13 
        };
        const { x, z } = get3DCoord(toNode.x, toNode.y);
        const targetY = 4 + 4 + 2.25;

        // Move mesh in map early to prevent sync3DPieces from recreating
        stoneMeshes.delete(fromKey);
        stoneMeshes.set(toKey, mesh);
        mesh.userData.row = toRow;
        mesh.userData.col = toCol;
        mesh.userData.key = toKey;

        // Jump animation
        const midX = (mesh.position.x + x) / 2;
        const midZ = (mesh.position.z + z) / 2;
        const midY = targetY + 15; // Arc height

        const tX = new TWEEN.Tween(mesh.position).to({ x: x, z: z }, 400).easing(TWEEN.Easing.Quadratic.InOut);
        
        // Arc
        const yUp = new TWEEN.Tween(mesh.position).to({ y: midY }, 200).easing(TWEEN.Easing.Quadratic.Out);
        const yDown = new TWEEN.Tween(mesh.position).to({ y: targetY }, 200).easing(TWEEN.Easing.Quadratic.In);
        yUp.chain(yDown);

        tX.onComplete(() => {
            if (onCompleteCallback) onCompleteCallback();
        });
        
        tX.start();
        yUp.start();
    } else {
        if (onCompleteCallback) onCompleteCallback();
    }
}

// Interactions
function onPointerDown(event) {
    if (!window.is3DView || typeof gameState === 'undefined' || gameState === 'GAME_OVER' || isAnimating) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 1. Layered Click Strategy:
    // First, check for special interaction targets (move circles/off-board targets)
    const intersectsHighlights = raycaster.intersectObjects(groupHighlights.children, true);
    if (intersectsHighlights.length > 0) {
        const obj = intersectsHighlights[0].object;
        if (obj.userData && (obj.userData.isMoveTarget || obj.userData.isLeapOfFaith)) {
            const row = obj.userData.move ? obj.userData.move.row : obj.userData.row;
            const col = obj.userData.move ? obj.userData.move.col : obj.userData.col;
            if (window.handleNodeClick) window.handleNodeClick(row, col);
            return;
        }
    }

    // Second, check for standard pieces (recursive since they are groups)
    const intersectsPieces = raycaster.intersectObjects(groupPieces.children, true);
    if (intersectsPieces.length > 0) {
        let group = intersectsPieces[0].object;
        while (group && !group.userData.node) group = group.parent;
        if (group && group.userData.node) {
            if (window.handleNodeClick) window.handleNodeClick(group.userData.node.row, group.userData.node.col);
            return;
        }
    }

    // Third, check for fields (pedestals)
    const intersectsFields = raycaster.intersectObjects(groupBoard.children);
    if (intersectsFields.length > 0) {
        const obj = intersectsFields[0].object;
        if (obj.userData && obj.userData.isField) {
            if (window.handleNodeClick) window.handleNodeClick(obj.userData.row, obj.userData.col);
            return;
        }
    }
}

function update3DHighlights() {
    // Clear old highlights
    while(groupHighlights.children.length > 0) groupHighlights.remove(groupHighlights.children[0]);
    
    // Reset selections on stones
    stoneMeshes.forEach(mesh => {
        mesh.children.forEach(c => {
            if (c.material && c.material.emissive && c.userData.originalEmissive !== undefined) {
                c.material.emissive.setHex(c.userData.originalEmissive);
            }
        });
    });
    fieldMeshes.forEach(mesh => {
        mesh.material.emissive.setHex(mesh.userData.key.includes("0,2") || mesh.userData.key.includes("8,2") ? 0x4c1d95 : 0x000000);
    });

    if (selectedStone) {
        const key = `${selectedStone.row},${selectedStone.col}`;
        const mesh = stoneMeshes.get(key);
        if (mesh) {
            mesh.children.forEach(c => {
                if (c.material && c.material.emissive) c.material.emissive.setHex(0xf59e0b); // Selection glow
            });
        }
    }

    if (isInLeapChain && leapChainStart) {
        const key = `${leapChainStart.row},${leapChainStart.col}`;
        const mesh = stoneMeshes.get(key);
        if (mesh) {
            mesh.children.forEach(c => {
                if (c.material && c.material.emissive) c.material.emissive.setHex(0xa855f7); // Leap chain glow
            });
        }
    }

    // Add field highlights
    validMoves.forEach(move => {
        let tx, tz;

        if (!move.offBoard) {
            const key = `${move.row},${move.col}`;
            const fMesh = fieldMeshes.get(key);
            if (!fMesh) return;
            tx = fMesh.position.x;
            tz = fMesh.position.z;
        } else {
            const overNode = board.get(`${move.over.row},${move.over.col}`);
            const fromNode = board.get(`${selectedStone.row},${selectedStone.col}`);
            if (!overNode || !fromNode) return;

            // Symmetry fix: Exactly one board-unit (13 SVG units) beyond the victim
            const dx = move.col - move.over.col;
            const dy = move.row - move.over.row;
            
            const targetSvgX = overNode.x + (dx * 13);
            const targetSvgY = overNode.y + (dy * 13);
            
            const coord = get3DCoord(targetSvgX, targetSvgY);
            tx = coord.x;
            tz = coord.z;
        }

        // 1. Visible Halo Ring
        const haloGeom = new THREE.RingGeometry(move.offBoard ? 3 : 4.5, move.offBoard ? 5 : 6, 16);
        const redHighlight = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const halo = new THREE.Mesh(haloGeom, move.offBoard ? redHighlight : matHighlight);
        halo.rotation.x = -Math.PI / 2;
        // Pedestal height: 4 (floor) + 4 (pedestal) = 8. Surface at 8.
        // Off-board floor height: 4.
        const elevation = move.offBoard ? 4.1 : 8.1;
        halo.position.set(tx, elevation, tz);
        halo.userData = move.offBoard ? { isLeapOfFaith: true, move: move } : {};
        groupHighlights.add(halo);

        // 2. Invisible Hit Disk (makes clicking much easier)
        const hitGeom = new THREE.CircleGeometry(move.offBoard ? 5 : 6.5, 8);
        const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.rotation.x = -Math.PI / 2;
        hitMesh.position.copy(halo.position);
        hitMesh.userData = { isMoveTarget: true, row: move.row, col: move.col, move: move };
        groupHighlights.add(hitMesh);
    });
}

function animate3D(time) {
    TWEEN.update(time);
    controls.update();

    // Pulse leap of faith highlights
    groupHighlights.children.forEach(mesh => {
        if (mesh.userData.isLeapOfFaith) {
            mesh.scale.setScalar(1 + Math.sin(time * 0.005) * 0.2);
        }
    });

    // Roof Visibility Logic (fades out as camera approaches)
    if (window.templeRoof) {
        // Calculate distance from camera to the center of the temple board (y roughly 40 for average view)
        const dist = camera.position.distanceTo(new THREE.Vector3(0, 40, 0));
        
        // Start fading at dist=350, completely invisible at dist=250
        let targetOpacity = (dist - 250) / 100;
        targetOpacity = Math.max(0, Math.min(1, targetOpacity));

        window.templeRoof.traverse(mesh => {
            if (mesh.material) {
                // If opacity is very close to 0, completely hide it to save rendering performance
                mesh.visible = targetOpacity > 0.02;
                mesh.material.opacity = targetOpacity;

                // Keep shadows sharp only when the roof is fully materialized
                mesh.castShadow = targetOpacity > 0.8;
            }
        });
    }

    renderer.render(scene, camera);
}

// Rebuild the temple architecture (footprint depends on player count) + the board.
function rebuildTempleAndBoard() {
    if (typeof groupTemple === 'undefined' || !groupTemple) { build3DBoard(); return; }
    // Remove all architecture (everything in groupTemple except the board group)
    for (let i = groupTemple.children.length - 1; i >= 0; i--) {
        if (groupTemple.children[i] !== groupBoard) groupTemple.remove(groupTemple.children[i]);
    }
    buildTempleEnvironment(); // re-adds groups (idempotent) + rebuilds architecture at the new size
    build3DBoard();
}

// Hook functions to expose to temple-game.js
window.init3DSystem = init3D;
window.rebuild3DBoard = rebuildTempleAndBoard;
window.sync3D = sync3DPieces;
window.animate3DMove = animateMove3D;
window.update3DViews = update3DHighlights;

// Setup View Toggle listeners
document.addEventListener('DOMContentLoaded', () => {
    const viewButtons = document.querySelectorAll('#view-menu button');
    const viewBtnText = document.getElementById('view-btn');
    const viewMenu = document.getElementById('view-menu');
    
    if (viewBtnText && viewMenu) {
        viewBtnText.addEventListener('click', () => {
            viewMenu.classList.toggle('show-menu');
        });
    }

    // Ensure 3D Mode is active if body class is present
    if (document.body.classList.contains('view-3d')) {
        if (viewBtnText) viewBtnText.textContent = 'View: 3D';
        window.is3DView = true;
        init3D();
    }

    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (viewMenu) viewMenu.classList.remove('show-menu');
            const view = e.target.getAttribute('data-view');
            if (view === '3d') {
                document.body.classList.add('view-3d');
                viewBtnText.textContent = 'View: 3D';
                window.is3DView = true;
                
                // Initialize if not already
                if (!renderer) {
                    init3D();
                } else {
                    onWindowResize(); // Ensure canvas is correct size
                }
            } else {
                document.body.classList.remove('view-3d');
                viewBtnText.textContent = 'View: 2D';
                window.is3DView = false;
            }
        });
    });
});
