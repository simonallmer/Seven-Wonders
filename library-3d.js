const game = window.libraryGameInstance;

const canvasContainer = document.getElementById('canvas3d');
const statusText = document.getElementById('status-text');
const playerColorBox = document.getElementById('player-color');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1512);
scene.fog = new THREE.FogExp2(0x1a1512, 0.012);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 22);

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

const ambientLight = new THREE.AmbientLight(0xfff0e6, 0.25);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x99badd, 1.0);
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

const goldLight = new THREE.DirectionalLight(0xffd700, 0.4);
goldLight.position.set(-15, 30, 15);
scene.add(goldLight);

const lanternFlickers = [];

function createLantern(x, z, h) {
    const group = new THREE.Group();
    group.position.set(x, h, z);

    const light = new THREE.PointLight(0xffaa55, 2.0, 18);
    light.position.set(0, 0, 0);
    light.castShadow = true;
    group.add(light);

    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xffcc66,
        emissive: 0xff8800,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
        metalness: 0.1
    });

    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), glassMat);
    body.position.y = 0;
    body.scale.set(1, 1.4, 1);
    group.add(body);

    const capMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.7, metalness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.15, 8), capMat);
    cap.position.y = 0.6;
    group.add(cap);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6, metalness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 12), ringMat);
    ring.position.y = 0.75;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const chainMat = new THREE.LineBasicMaterial({ color: 0x8b7355 });
    const chainPoints = [
        new THREE.Vector3(0, 0.75, 0),
        new THREE.Vector3(0, 3.5, 0)
    ];
    const chain = new THREE.Line(new THREE.BufferGeometry().setFromPoints(chainPoints), chainMat);
    chain.position.y = 0;
    group.add(chain);

    scene.add(group);

    const flicker = new THREE.PointLight(0xff8800, 0.6, 12);
    flicker.position.set(x, h + 0.2, z);
    scene.add(flicker);
    lanternFlickers.push({ light: flicker, phase: Math.random() * Math.PI * 2 });
}

const lanternFlickers = [];

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
    color: 0xf5e6c8,
    roughness: 0.5,
    metalness: 0.05,
});

const bookCoverMat = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.7,
    metalness: 0.1,
});

const bookPageMat = new THREE.MeshStandardMaterial({
    color: 0xf5e6c8,
    roughness: 0.6,
    metalness: 0.05,
});

const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xd4a843,
    roughness: 0.3,
    metalness: 0.6,
});

const activeCellMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.3,
});

const wallPushMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.35,
});

const wallToppleMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.35,
});

const courtyardGroup = new THREE.Group();
scene.add(courtyardGroup);

const floorGeo = new THREE.PlaneGeometry(44, 44);
const floor = new THREE.Mesh(floorGeo, darkStoneMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
courtyardGroup.add(floor);

function createGeometricPattern() {
    const patternMat = new THREE.MeshStandardMaterial({
        color: 0x4a3f35,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.5
    });

    const centerStar = new THREE.Mesh(new THREE.OctahedronGeometry(2.5, 0), patternMat);
    centerStar.rotation.x = Math.PI / 4;
    centerStar.rotation.z = Math.PI / 4;
    centerStar.position.y = 0.02;
    centerStar.scale.set(1, 0.05, 1);
    courtyardGroup.add(centerStar);

    const ringMat2 = new THREE.MeshStandardMaterial({
        color: 0x5a4f45,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.3
    });

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.02, 6),
            ringMat2
        );
        line.position.set(Math.sin(angle) * 3.5, 0.02, Math.cos(angle) * 3.5);
        line.rotation.y = -angle;
        courtyardGroup.add(line);
    }
}
createGeometricPattern();

function createOgeeArch(width, height, depth) {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hh = height;

    shape.moveTo(-hw, 0);
    shape.quadraticCurveTo(-hw * 0.6, hh * 0.5, -hw * 0.8, hh * 0.7);
    shape.quadraticCurveTo(-hw * 0.3, hh * 0.85, 0, hh);
    shape.quadraticCurveTo(hw * 0.3, hh * 0.85, hw * 0.8, hh * 0.7);
    shape.quadraticCurveTo(hw * 0.6, hh * 0.5, hw, 0);
    shape.lineTo(hw - 0.4, 0);
    shape.quadraticCurveTo(hw * 0.5, hh * 0.4, hw * 0.6, hh * 0.6);
    shape.quadraticCurveTo(hw * 0.2, hh * 0.7, 0, hh - 0.3);
    shape.quadraticCurveTo(-hw * 0.2, hh * 0.7, -hw * 0.6, hh * 0.6);
    shape.quadraticCurveTo(-hw * 0.5, hh * 0.4, -hw + 0.4, 0);
    shape.closePath();

    const extrudeSettings = { depth: depth, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 4 };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

const createStudyRoom = (x, z, rot) => {
    const roomGroup = new THREE.Group();
    roomGroup.position.set(x, 0, z);
    roomGroup.rotation.y = rot;

    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), marbleMat);
    base.position.y = 0.25;
    base.receiveShadow = true;
    roomGroup.add(base);

    const archGeo = createOgeeArch(5, 3.5, 0.6);
    const arch = new THREE.Mesh(archGeo, marbleMat);
    arch.position.set(0, 3.5, 3);
    arch.castShadow = true;
    roomGroup.add(arch);

    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 4, 12);
    const pMat = new THREE.MeshStandardMaterial({ color: 0xebd9c8, roughness: 0.3, metalness: 0.1 });

    const p1 = new THREE.Mesh(pillarGeo, pMat);
    p1.position.set(-2.8, 2, 3);
    p1.castShadow = true;
    roomGroup.add(p1);

    const p2 = p1.clone();
    p2.position.set(2.8, 2, 3);
    roomGroup.add(p2);

    const carpetMat = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        roughness: 0.8,
        metalness: 0.0
    });
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.26, -0.5);
    roomGroup.add(carpet);

    return roomGroup;
};

courtyardGroup.add(createStudyRoom(0, -12, 0));
courtyardGroup.add(createStudyRoom(0, 12, Math.PI));
courtyardGroup.add(createStudyRoom(12, 0, -Math.PI / 2));
courtyardGroup.add(createStudyRoom(-12, 0, Math.PI / 2));

createLantern(0, -9, 5);
createLantern(0, 9, 5);
createLantern(9, 0, 5);
createLantern(-9, 0, 5);

const TILE_SIZE = 1.6;
const GAP_SIZE = 0.4;
const BOARD_OFFSET = (BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * GAP_SIZE) / 2;

const cellMeshes = [];
const plateMeshes = {};
const hWallTriggers = [];
const vWallTriggers = [];
const hWallMeshes = {};
const vWallMeshes = {};
const playerMeshes = {};

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

        const cellBase = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.1, TILE_SIZE),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
        );
        cellBase.position.set(x, 0.05, z);
        cellBase.receiveShadow = true;
        boardGroup.add(cellBase);

        const trigger = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        trigger.position.set(x, 0.25, z);
        trigger.userData = { type: 'cell', r, c };
        cellMeshes.push(trigger);
        boardGroup.add(trigger);

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

for (let r = 0; r < BOARD_SIZE - 1; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const { x, z } = getPos(r, c);
        const zOff = z + TILE_SIZE / 2 + GAP_SIZE / 2;

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

for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
        const { x, z } = getPos(r, c);
        const xOff = x + TILE_SIZE / 2 + GAP_SIZE / 2;

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

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function contextualHover(intersects) {
    function getWallSide(obj) {
        const u = obj.userData;
        if (u.type !== 'hWall' && u.type !== 'vWall') return null;
        const p = intersects[0].point;
        const { x, z } = getPos(u.r, u.c);
        let cx, cz;
        if (u.type === 'hWall') {
            cx = x;
            cz = z + TILE_SIZE / 2 + GAP_SIZE / 2;
        } else {
            cx = x + TILE_SIZE / 2 + GAP_SIZE / 2;
            cz = z;
        }
        return { offsetX: p.x - cx, offsetZ: p.z - cz, obj, u };
    }

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const u = obj.userData;
        const cp = game.players[game.currentPlayer];

        if (u.type === 'cell') {
            const hl = obj.userData.highlight;
            const { x, z } = getPos(u.r, u.c);
            hl.visible = true;
            hl.scale.set(1, 1, 1);
            hl.position.set(x, 0.2, z);
            hl.material = activeCellMat;

            if (cp.row === u.r && cp.col === u.c) {
                hl.visible = false;
            }
        } else if (u.type === 'hWall') {
            const hl = obj.userData.highlight;
            const { x, z } = getPos(u.r, u.c);
            const cx = x;
            const cz = z + TILE_SIZE / 2 + GAP_SIZE / 2;
            const p = intersects[0].point;

            if (!game.hWalls[u.r][u.c]) {
                hl.visible = true;
                hl.scale.set(1, 1, 1);
                hl.position.set(cx, 0.2, cz);
                hl.material = activeCellMat;
            } else {
                const ox = p.x - cx, oz = p.z - cz;
                hl.visible = true;
                hl.material = Math.abs(ox) > Math.abs(oz) ? wallPushMat : wallToppleMat;
                if (Math.abs(ox) > Math.abs(oz)) {
                    hl.scale.set(0.4, 10, 1);
                    hl.position.set(cx + (ox < 0 ? -0.4 : 0.4), 1, cz);
                } else {
                    hl.scale.set(1, 10, 0.4);
                    hl.position.set(cx, 1, cz + (oz < 0 ? -0.2 : 0.2));
                }
            }
        } else if (u.type === 'vWall') {
            const hl = obj.userData.highlight;
            const { x, z } = getPos(u.r, u.c);
            const cx = x + TILE_SIZE / 2 + GAP_SIZE / 2;
            const cz = z;
            const p = intersects[0].point;

            if (!game.vWalls[u.r][u.c]) {
                hl.visible = true;
                hl.scale.set(1, 1, 1);
                hl.position.set(cx, 0.2, cz);
                hl.material = activeCellMat;
            } else {
                const ox = p.x - cx, oz = p.z - cz;
                hl.visible = true;
                hl.material = Math.abs(oz) > Math.abs(ox) ? wallPushMat : wallToppleMat;
                if (Math.abs(oz) > Math.abs(ox)) {
                    hl.scale.set(1, 10, 0.4);
                    hl.position.set(cx, 1, cz + (oz < 0 ? -0.4 : 0.4));
                } else {
                    hl.scale.set(0.4, 10, 1);
                    hl.position.set(cx + (ox < 0 ? -0.2 : 0.2), 1, cz);
                }
            }
        }
    }
}

function onPointerMove(event) {
    if (game.winner) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    cellMeshes.forEach(m => m.userData.highlight.visible = false);
    hWallTriggers.forEach(m => m.userData.highlight.visible = false);
    vWallTriggers.forEach(m => m.userData.highlight.visible = false);

    raycaster.setFromCamera(mouse, camera);

    const cp = game.players[game.currentPlayer];
    let targets = [];

    targets = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];

    const intersects = raycaster.intersectObjects(targets);
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const u = obj.userData;

        if (u.type === 'cell') {
            if (cp.row !== u.r || cp.col !== u.c) {
                const hl = obj.userData.highlight;
                const { x, z } = getPos(u.r, u.c);

                if (game.fields[u.r][u.c] && game.isValidMoveTarget(cp, u.r, u.c)) {
                    hl.visible = true;
                    hl.scale.set(1, 1, 1);
                    hl.position.set(x, 0.2, z);
                    hl.material = activeCellMat;
                } else if (!game.fields[u.r][u.c]) {
                    hl.visible = true;
                    hl.scale.set(1, 1, 1);
                    hl.position.set(x, 0.2, z);
                    hl.material = activeCellMat;
                }
            }
        } else if (u.type === 'hWall') {
            const { x, z } = getPos(u.r, u.c);
            const cx = x;
            const cz = z + TILE_SIZE / 2 + GAP_SIZE / 2;
            const p = intersects[0].point;

            if (!game.hWalls[u.r][u.c]) {
                const hl = obj.userData.highlight;
                hl.visible = true;
                hl.scale.set(1, 1, 1);
                hl.position.set(cx, 0.2, cz);
                hl.material = activeCellMat;
            } else {
                const hl = obj.userData.highlight;
                const ox = p.x - cx, oz = p.z - cz;
                hl.visible = true;
                hl.material = Math.abs(ox) > Math.abs(oz) ? wallPushMat : wallToppleMat;
                if (Math.abs(ox) > Math.abs(oz)) {
                    hl.scale.set(0.4, 10, 1);
                    hl.position.set(cx + (ox < 0 ? -0.4 : 0.4), 1, cz);
                } else {
                    hl.scale.set(1, 10, 0.4);
                    hl.position.set(cx, 1, cz + (oz < 0 ? -0.2 : 0.2));
                }
            }
        } else if (u.type === 'vWall') {
            const { x, z } = getPos(u.r, u.c);
            const cx = x + TILE_SIZE / 2 + GAP_SIZE / 2;
            const cz = z;
            const p = intersects[0].point;

            if (!game.vWalls[u.r][u.c]) {
                const hl = obj.userData.highlight;
                hl.visible = true;
                hl.scale.set(1, 1, 1);
                hl.position.set(cx, 0.2, cz);
                hl.material = activeCellMat;
            } else {
                const hl = obj.userData.highlight;
                const ox = p.x - cx, oz = p.z - cz;
                hl.visible = true;
                hl.material = Math.abs(oz) > Math.abs(ox) ? wallPushMat : wallToppleMat;
                if (Math.abs(oz) > Math.abs(ox)) {
                    hl.scale.set(1, 10, 0.4);
                    hl.position.set(cx, 1, cz + (oz < 0 ? -0.4 : 0.4));
                } else {
                    hl.scale.set(0.4, 10, 1);
                    hl.position.set(cx + (ox < 0 ? -0.2 : 0.2), 1, cz);
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
    if (Math.sqrt(dx * dx + dy * dy) < 5) {
        onPointerClick(e);
    }
});

function onPointerClick(event) {
    if (event.target !== renderer.domElement) return;
    if (game.winner) return;

    raycaster.setFromCamera(mouse, camera);

    const targets = [...cellMeshes, ...hWallTriggers, ...vWallTriggers];
    const intersects = raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
        const u = intersects[0].object.userData;

        if (u.type === 'cell') {
            game.handleCellClick(u.r, u.c);
        } else if (u.type === 'hWall') {
            const p = intersects[0].point;
            const { x, z } = getPos(u.r, u.c);
            const cx = x;
            const cz = z + TILE_SIZE / 2 + GAP_SIZE / 2;
            game.handleWallClick('h', u.r, u.c, p.x - cx, p.z - cz);
        } else if (u.type === 'vWall') {
            const p = intersects[0].point;
            const { x, z } = getPos(u.r, u.c);
            const cx = x + TILE_SIZE / 2 + GAP_SIZE / 2;
            const cz = z;
            game.handleWallClick('v', u.r, u.c, p.x - cx, p.z - cz);
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

function createPlate(r, c) {
    const { x, z } = getPos(r, c);
    const group = new THREE.Group();

    const cover = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.2, 0.12, TILE_SIZE - 0.2),
        bookCoverMat
    );
    cover.position.set(0, 0.06, 0);
    cover.castShadow = true;
    cover.receiveShadow = true;
    group.add(cover);

    const pageMat = new THREE.MeshStandardMaterial({
        color: 0xf5e6c8,
        roughness: 0.6,
        metalness: 0.05
    });
    const page = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE - 0.35, 0.06, TILE_SIZE - 0.35),
        pageMat
    );
    page.position.set(0, 0.15, 0);
    group.add(page);

    const spine = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.2, TILE_SIZE - 0.35),
        goldTrimMat
    );
    spine.position.set(0, 0.1, 0);
    group.add(spine);

    const cornerMat = new THREE.MeshStandardMaterial({
        color: 0xd4a843,
        roughness: 0.3,
        metalness: 0.6
    });
    const corner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), cornerMat);
    corner.position.set(TILE_SIZE / 2 - 0.15, 0.06, TILE_SIZE / 2 - 0.15);
    group.add(corner);
    const c2 = corner.clone();
    c2.position.set(-TILE_SIZE / 2 + 0.15, 0.06, -TILE_SIZE / 2 + 0.15);
    group.add(c2);
    const c3 = corner.clone();
    c3.position.set(TILE_SIZE / 2 - 0.15, 0.06, -TILE_SIZE / 2 + 0.15);
    group.add(c3);
    const c4 = corner.clone();
    c4.position.set(-TILE_SIZE / 2 + 0.15, 0.06, TILE_SIZE / 2 - 0.15);
    group.add(c4);

    group.position.set(x, 0, z);
    boardGroup.add(group);
    plateMeshes[`${r}_${c}`] = group;

    group.scale.set(0.1, 0.1, 0.1);
    new TWEEN.Tween(group.scale)
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
        meshZ = z + TILE_SIZE / 2 + GAP_SIZE / 2;
    } else {
        geo = new THREE.BoxGeometry(GAP_SIZE - 0.1, 2, TILE_SIZE);
        meshX = x + TILE_SIZE / 2 + GAP_SIZE / 2;
        meshZ = z;
    }

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        roughness: 0.9,
        metalness: 0.0
    });

    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(meshX, 1, meshZ);
    wall.castShadow = true;
    wall.receiveShadow = true;
    boardGroup.add(wall);

    const trimMat = new THREE.MeshStandardMaterial({
        color: 0xd4a843,
        roughness: 0.4,
        metalness: 0.5
    });
    const topTrim = new THREE.Mesh(
        new THREE.BoxGeometry(
            type === 'h' ? TILE_SIZE + 0.1 : GAP_SIZE + 0.1,
            0.05,
            type === 'h' ? GAP_SIZE + 0.1 : TILE_SIZE + 0.1
        ),
        trimMat
    );
    topTrim.position.set(meshX, 2.02, meshZ);
    boardGroup.add(topTrim);

    if (type === 'h') hWallMeshes[`${r}_${c}`] = wall;
    else vWallMeshes[`${r}_${c}`] = wall;

    wall.position.y = 5;
    new TWEEN.Tween(wall.position)
        .to({ y: 1 }, 500)
        .easing(TWEEN.Easing.Bounce.Out)
        .start();
}

function createPlayerFigure(player) {
    const group = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.15, 16);
    const bodyGeo = new THREE.CylinderGeometry(0.08, 0.25, 1.0, 12);
    const headGeo = new THREE.SphereGeometry(0.22, 12, 12);

    const mat = new THREE.MeshStandardMaterial({
        color: player.colorHex,
        roughness: 0.2,
        metalness: 0.7
    });

    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.075;
    base.castShadow = true;
    group.add(base);

    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    const turbanMat = new THREE.MeshStandardMaterial({
        color: 0xf5f1e8,
        roughness: 0.8,
        metalness: 0.0
    });
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), turbanMat);
    turban.position.set(0, 1.55, 0.1);
    turban.scale.set(1, 0.6, 1);
    group.add(turban);

    if (player.id === 0) group.position.set(0, 0, 12);
    else if (player.id === 1) group.position.set(0, 0, -12);
    else if (player.id === 2) group.position.set(-12, 0, 0);
    else if (player.id === 3) group.position.set(12, 0, 0);

    scene.add(group);
    playerMeshes[player.id] = group;
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
    Object.values(playerMeshes).forEach(m => scene.remove(m));

    for (let key in plateMeshes) delete plateMeshes[key];
    for (let key in hWallMeshes) delete hWallMeshes[key];
    for (let key in vWallMeshes) delete vWallMeshes[key];
    for (let key in playerMeshes) delete playerMeshes[key];

    game.initGame(pCount);
}

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

game.on('onFigureMoved', (data) => {
    const mesh = playerMeshes[data.player.id];
    const { x, z } = getPos(data.r, data.c);

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
    let targetX = data.type === 'h' ? x : x + TILE_SIZE / 2 + GAP_SIZE / 2;
    let targetZ = data.type === 'h' ? z + TILE_SIZE / 2 + GAP_SIZE / 2 : z;

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
    document.getElementById('modal-title').innerText = 'Game Over!';
    document.getElementById('modal-text').innerText = `${data.winner.name} reached the goal!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
});

game.on('onMessage', (msg) => {
});

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();

    const time = Date.now() * 0.001;
    lanternFlickers.forEach((l, i) => {
        const flicker = 0.5 + Math.sin(time * 2.5 + l.phase) * 0.25 + Math.sin(time * 4.7 + l.phase * 1.3) * 0.15;
        l.light.intensity = Math.max(0.1, flicker);
    });

    renderer.render(scene, camera);
}

game.initGame(2);
animate();
