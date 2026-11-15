// CATHEDRAL — the world: a Gothic cathedral on its market square, the engraved floor as the board, stones,
// effects and move animations.
import * as THREE from 'three';
import { L, createState, SIZE, PASSAGES } from './rules.js';
import { Tweens, Particles, Lift, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { paveMaps, canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { makeStone } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -0.6;   // the square; the floor of the cathedral (y = 0) stands two steps above it
const MID = (SIZE - 1) / 2, WALL = 2.75, END = 7.75, WALL_H = 7, DOOR = 5;
const GLASS = [0x2f55c8, 0xb8252c, 0xd9a521, 0x2c8a4a, 0x7a2fa8, 0x1d8f9a];
const SPARK = [0, 0xfff0c8, 0xb89cff, 0xff7a5a, 0x7ab8ff];

export function cellPos(i, out = new THREE.Vector3()) {
    const c = L.cells[i];
    return out.set(c.x - MID, 0, c.y - MID);
}
// the corner of the crossing a passage walks round, if these two fields are joined by one
function passageCorner(a, b) {
    const A = L.cells[a], B = L.cells[b];
    if (L.passage[a] !== b) return null;
    return { x: (A.x < MID ? -2 : 2), z: (A.y < MID ? -2 : 2) };
}
// a point on the walkway from a to b: a quarter circle round the corner, outside the walls
function passagePoint(from, to, k, out = new THREE.Vector3()) {
    const c = passageCorner(from, to), pa = cellPos(from), pb = cellPos(to);
    const a0 = Math.atan2(pa.z - c.z, pa.x - c.x);
    let a1 = Math.atan2(pb.z - c.z, pb.x - c.x);
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    const a = a0 + (a1 - a0) * k;
    return out.set(c.x + Math.cos(a) * 3, 0, c.z + Math.sin(a) * 3);
}

// The floor: pale stone in the shape of the cross, the lines of the game engraved and filled with dark mastic,
// a rosette on every strong crossing, the four walkways outside the corners of the crossing.
function floorTexture() {
    const px = 80, M = 1.2, W = Math.round((SIZE - 1 + 2 * M) * px);
    const X = (x) => (x + M) * px, tex = canvasTexture(W, W, (x) => {
        x.clearRect(0, 0, W, W);
        let s = 23;
        const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        const lo = X(5) - px * 0.62, hi = X(9) + px * 0.62, a = X(0) - px * 0.62, b = X(14) + px * 0.62;
        // the walkways first, so that the cross lies over their ends
        x.lineCap = 'butt';
        for (const [[ax, ay]] of PASSAGES) {
            const cx = X(ax < MID ? 5 : 9), cy = X(ay < MID ? 5 : 9), sx = ax < MID ? -1 : 1, sz = ay < MID ? -1 : 1;
            const aB = sx > 0 ? 0 : Math.PI, aA = sx > 0 ? sz * Math.PI / 2 : Math.PI - sz * Math.PI / 2;
            const arc = (w, style, dash) => { x.strokeStyle = style; x.lineWidth = w; x.setLineDash(dash || []); x.beginPath(); for (let i = 0; i <= 24; i++) { const t = aB + (aA - aB) * (i / 24); x.lineTo(cx + Math.cos(t) * 3 * px, cy + Math.sin(t) * 3 * px); } x.stroke(); x.setLineDash([]); };
            arc(px * 0.95, '#b9ad98'); arc(px * 0.8, '#d6ccb8'); arc(px * 0.07, '#5a4a38', [px * 0.16, px * 0.12]);
        }
        x.fillStyle = '#e6dfd0';
        x.fillRect(lo, a, hi - lo, b - a); x.fillRect(a, lo, b - a, hi - lo);
        // flagstones: a faint chequer and some wear
        for (let cy = 0; cy < SIZE; cy++) for (let cx = 0; cx < SIZE; cx++) if (L.find(cx, cy) >= 0) {
            x.fillStyle = (cx + cy) % 2 ? 'rgba(120,105,85,0.10)' : 'rgba(255,255,255,0.10)';
            x.fillRect(X(cx) - px / 2, X(cy) - px / 2, px, px);
        }
        x.save(); x.beginPath(); x.rect(lo, a, hi - lo, b - a); x.rect(a, lo, b - a, hi - lo); x.clip(); // wear, kept to the floor
        for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(90,80,65,${0.02 + r() * 0.05})`; x.beginPath(); x.ellipse(a + r() * (b - a), a + r() * (b - a), 3 + r() * 16, 2 + r() * 9, r() * 3, 0, 7); x.fill(); }
        x.restore();
        // the lines
        x.strokeStyle = '#4a3c2e'; x.lineWidth = px * 0.05; x.lineCap = 'round';
        L.cells.forEach((c, i) => { for (const d of [0, 2, 4, 5]) { const j = L.step[i * 8 + d]; if (j < 0) continue; const e = L.cells[j]; x.beginPath(); x.moveTo(X(c.x), X(c.y)); x.lineTo(X(e.x), X(e.y)); x.stroke(); } });
        // the crossings
        for (const c of L.cells) {
            const R = px * (c.strong ? 0.2 : 0.12);
            x.fillStyle = c.strong ? '#c9a45a' : '#efe9dc'; x.beginPath(); x.arc(X(c.x), X(c.y), R, 0, 7); x.fill();
            x.strokeStyle = '#4a3c2e'; x.lineWidth = px * 0.035; x.stroke();
            if (c.strong) { x.fillStyle = '#4a3c2e'; x.beginPath(); x.arc(X(c.x), X(c.y), R * 0.32, 0, 7); x.fill(); }
        }
    });
    return { tex, size: SIZE - 1 + 2 * M };
}

let STONE = null, DARK = null;
const dummy = new THREE.Object3D();
function instanced(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z); dummy.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1); dummy.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        if (o.color) im.setColorAt(i, o.color);
    });
    im.castShadow = im.receiveShadow = true;
    return im;
}

// the outline of the cross as wall runs: [x0, z0, x1, z1, door] — a flank wall has a doorway where the passage leaves
function wallRuns() {
    const out = [];
    for (const [ax, az] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { // the four arms, by the direction they point in
        const px = az, pz = ax; // the arm's side-to-side direction
        for (const s of [-1, 1]) out.push([ax * WALL + px * s * WALL, az * WALL + pz * s * WALL, ax * END + px * s * WALL, az * END + pz * s * WALL, true]);
        out.push([ax * END - px * WALL, az * END - pz * WALL, ax * END + px * WALL, az * END + pz * WALL, false]);
    }
    return out;
}

// ---------------------------------------------------------------- the cathedral
// Builds the cathedral with its floor. Returns { group, picks[], lift } — picks[i].userData.cell = field.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const m = materials(), group = new THREE.Group(), picks = [];
    const add = (o) => { group.add(o); return o; };
    const stone = STONE || (STONE = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.88 }));
    const dark = DARK || (DARK = new THREE.MeshStandardMaterial({ color: 0xa39d92, roughness: 0.92 }));

    // the platform under the floor: the cross and the four walkways, two steps above the square
    for (let i = 0; i < 2; i++) { const g = i * 0.5, h = -GROUND * (i ? 0.5 : 1); add(box(15.9 + g, h, 5.9 + g, i ? dark : stone, 0, GROUND, 0)); add(box(5.9 + g, h, 15.9 + g, i ? dark : stone, 0, GROUND, 0)); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const sh = new THREE.Shape(), a0 = Math.atan2(-sz, 0), a1 = Math.atan2(0, sx);
        let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
        sh.absarc(0, 0, 3.5, a0, a0 + d, d < 0); sh.absarc(0, 0, 2.5, a0 + d, a0, d > 0); sh.closePath();
        const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: -GROUND - 0.01, bevelEnabled: false, curveSegments: 10 }), stone);
        slab.rotation.x = -Math.PI / 2; slab.position.set(sx * 2, GROUND, sz * 2); add(slab);
    }
    const fl = floorTexture();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fl.size, fl.size), new THREE.MeshStandardMaterial({ map: fl.tex, roughness: 0.5, alphaTest: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.006; floor.receiveShadow = true; floor.userData.keep = true; group.add(floor);

    // what stays for the game: a low course of the walls, broken by the doorways, and the stumps of the crossing piers
    const runs = wallRuns();
    for (const [x0, z0, x1, z1, door] of runs) {
        const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, alongX = Math.abs(ux) > 0.5;
        const piece = (a, b) => { const c = (a + b) / 2, w = b - a; add(box(alongX ? w : 0.4, 0.3, alongX ? 0.4 : w, stone, x0 + ux * c, 0, z0 + uz * c)); };
        if (door) { const at = DOOR - WALL; piece(-0.2, at - 0.55); piece(at + 0.55, len + 0.2); } else piece(-0.2, len + 0.2);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(cyl(0.34, 0.4, 0.5, stone, sx * WALL, 0, sz * WALL, 8));
    shadowed(group);
    mergeByMaterial(group, (o) => o.userData.keep);

    // unseen discs over the fields, for the pointer
    const disc = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 10), ghost = new THREE.MeshBasicMaterial({ visible: false });
    for (let i = 0; i < L.N; i++) { const p = new THREE.Mesh(disc, ghost); cellPos(i, p.position); p.userData.cell = i; group.add(p); picks.push(p); }

    if (mini) { // table miniature: the stones in their starting places
        const st = createState(nPlayers);
        for (let i = 0; i < L.N; i++) if (st.grid[i]) { const s = makeStone(st.grid[i], true); cellPos(i, s.position); group.add(s); }
    }

    // Walls, windows, vaults, roofs, the two towers and the flèche: the cathedral is whole while the visitor
    // arrives, and all of this is lifted away for the game. Its materials are its own, so that it can fade.
    const rm = { stone: stone.clone(), slate: m.slate.clone(), dark: new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.8 }),
        glass: new THREE.MeshBasicMaterial({ color: 0xffffff }), gold: m.gold.clone() };
    const up = new THREE.Group(), panes = [], butt = [];
    let gi = 0;
    for (const [x0, z0, x1, z1, door] of runs) {
        const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, alongX = Math.abs(ux) > 0.5;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        up.add(box(alongX ? len + 0.4 : 0.4, WALL_H - 0.3, alongX ? 0.4 : len + 0.4, rm.stone, cx, 0.3, cz));
        // outward normal: away from the middle of the arm
        const nx = alongX ? 0 : Math.sign(cx), nz = alongX ? Math.sign(cz) : 0, n = door ? 4 : 3;
        for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n * len, wx = x0 + ux * t, wz = z0 + uz * t;
            const color = new THREE.Color(GLASS[gi++ % GLASS.length]);
            for (const side of [1, -1]) panes.push({ x: wx + nx * 0.21 * side, y: 3.7, z: wz + nz * 0.21 * side, ry: Math.atan2(nx * side, nz * side), sx: door ? 0.62 : 0.8, sy: 3.6, color });
            if (k) butt.push({ x: x0 + ux * (k / n) * len + nx * 0.55, y: 3.1, z: z0 + uz * (k / n) * len + nz * 0.55, sx: alongX ? 0.3 : 0.9, sy: 6.2, sz: alongX ? 0.9 : 0.3 });
        }
        if (door) up.add(box(alongX ? 1.0 : 0.44, 2.0, alongX ? 0.44 : 1.0, rm.dark, x0 + ux * (DOOR - WALL), 0.3, z0 + uz * (DOOR - WALL)));
    }
    const lancet = new THREE.Shape(); lancet.moveTo(-0.5, 0); lancet.lineTo(0.5, 0); lancet.lineTo(0.5, 0.72); lancet.quadraticCurveTo(0.42, 0.93, 0, 1); lancet.quadraticCurveTo(-0.42, 0.93, -0.5, 0.72); lancet.closePath();
    const lg = new THREE.ShapeGeometry(lancet, 6); lg.translate(0, -0.5, 0);
    const glass = instanced(lg, rm.glass, panes); glass.castShadow = glass.receiveShadow = false; up.add(glass);
    up.add(instanced(new THREE.BoxGeometry(1, 1, 1), rm.stone, butt));
    // roofs: two steep gables that cross, the flèche over the crossing
    const tri = new THREE.Shape(); tri.moveTo(-3.15, 0); tri.lineTo(3.15, 0); tri.lineTo(0, 3.3); tri.closePath();
    const gable = (rot) => { const r = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 15.9, bevelEnabled: false }), rm.slate); r.position.set(rot ? -7.95 : 0, WALL_H, rot ? 0 : -7.95); r.rotation.y = rot ? Math.PI / 2 : 0; return r; };
    up.add(gable(false), gable(true));
    up.add(cyl(0.02, 0.5, 5.2, rm.slate, 0, WALL_H + 3.1, 0, 8), cyl(0.06, 0.06, 0.5, rm.gold, 0, WALL_H + 8.3, 0, 6));
    // the west front, here at the near end: two towers with their spires, the rose between them, the portal
    for (const sx of [-1, 1]) {
        up.add(box(2.5, 11.5, 2.5, rm.stone, sx * 1.9, GROUND, 9.2));
        const sp = new THREE.Mesh(new THREE.ConeGeometry(1.7, 5.6, 4), rm.slate); sp.position.set(sx * 1.9, GROUND + 11.5 + 2.8, 9.2); sp.rotation.y = Math.PI / 4; up.add(sp);
        for (const y of [5.2, 8.4]) up.add(box(0.5, 1.7, 0.06, rm.dark, sx * 1.9, y, 10.46));
    }
    up.add(box(1.3, 6.4, 0.5, rm.stone, 0, GROUND, 10.1), box(1.1, 2.4, 0.08, rm.dark, 0, GROUND, 10.4));
    const rose = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), new THREE.MeshBasicMaterial({ color: 0x6f86c8 })); rose.position.set(0, 4.6, 10.36); up.add(rose);
    shadowed(up); rose.castShadow = false;
    mergeByMaterial(up, (o) => o.isInstancedMesh);
    group.add(up);
    const lift = new Lift(up, [...Object.values(rm), rose.material], 4);
    return { group, picks, lift, glass: rm.glass };
}

// ---------------------------------------------------------------- the world

export class CathedralWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'grove';
        this.veil = 0xe6e2da;
        this.nPlayers = 0;
        this.stones = new Map();
        this.indicators = [];
        const m = materials(), std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xcfd6dc, 0.0048);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 110, left: -15, right: 15, top: 15, bottom: -15 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x8f8a7c, 0.6); scene.add(this.hemi);

        // the market square, cobbled, and the town around it
        const pave = paveMaps(), pm = pave.map.clone(), pn = pave.normalMap.clone();
        for (const t of [pm, pn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 260); t.needsUpdate = true; }
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std({ map: pm, normalMap: pn, roughness: 0.9, color: 0x9c9a96 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; scene.add(ground);
        let hs = 41;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, walls = [], roofs = [], trees = [], trunks = [];
        for (let i = 0; i < 420; i++) {
            const a = hr() * 6.283, d = 26 + hr() * hr() * 190, x = Math.cos(a) * d, z = Math.sin(a) * d;
            if (Math.abs(x) < 4 && z > 0) continue; // the street that leads to the west front
            const w = 4 + hr() * 4, dd = 5 + hr() * 5, h = 4 + hr() * 5, ry = Math.round(hr() * 3) * 0.5 + (hr() - 0.5) * 0.2;
            walls.push({ x, y: GROUND + h / 2, z, sx: w, sy: h, sz: dd, ry, color: new THREE.Color().setHSL(0.08 + hr() * 0.05, 0.18 + hr() * 0.2, 0.62 + hr() * 0.2, sRGB) });
            roofs.push({ x, y: GROUND + h, z, sx: w * 0.74, sy: 2.4 + hr() * 2.2, sz: dd * 0.74, ry: ry + Math.PI / 4, color: new THREE.Color().setHSL(0.03 + hr() * 0.04, 0.4 + hr() * 0.2, 0.26 + hr() * 0.12, sRGB) });
        }
        for (let i = 0; i < 26; i++) { // limes round the square
            const a = (i / 26) * 6.283, x = Math.cos(a) * 21, z = Math.sin(a) * 21, s = 1.6 + hr() * 0.8;
            if (Math.abs(x) < 4 && z > 0) continue;
            trunks.push({ x, y: GROUND + 1.1, z, sx: 0.2, sy: 2.2, sz: 0.2 });
            trees.push({ x, y: GROUND + 2.4 + s * 0.6, z, sx: s, sy: s * 1.1, sz: s, ry: hr() * 6, color: new THREE.Color().setHSL(0.25 + hr() * 0.06, 0.4, 0.26 + hr() * 0.1, sRGB) });
        }
        const unit = new THREE.BoxGeometry(1, 1, 1), noShadow = (o) => { o.castShadow = o.receiveShadow = false; return o; };
        scene.add(noShadow(instanced(unit, std({ roughness: 1 }), walls)));
        const roofGeo = new THREE.ConeGeometry(1, 1, 4); roofGeo.translate(0, 0.5, 0);
        scene.add(noShadow(instanced(roofGeo, std({ roughness: 0.9, flatShading: true }), roofs)));
        scene.add(instanced(new THREE.IcosahedronGeometry(1, 0), std({ roughness: 1, flatShading: true }), trees), noShadow(instanced(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks)));
        // low hills beyond the roofs
        const hills = [];
        for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.283 + hr() * 0.2, d = 260 + hr() * 90; hills.push({ x: Math.cos(a) * d, y: GROUND - 4, z: Math.sin(a) * d, sx: 70 + hr() * 60, sy: 22 + hr() * 30, sz: 70 + hr() * 60, ry: hr() * 6, color: new THREE.Color().setHSL(0.24 + hr() * 0.06, 0.28, 0.36 + hr() * 0.1, sRGB) }); }
        scene.add(noShadow(instanced(new THREE.IcosahedronGeometry(1, 1), std({ roughness: 1, flatShading: true }), hills)));

        // pigeons wheeling over the square
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.55, 0, -0.12], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0x5a5f68, side: THREE.DoubleSide });
        for (let i = 0; i < 12; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 12 + Math.random() * 6, h: 9 + Math.random() * 4, ph: i * 0.35 + Math.random() * 0.3, sp: 0.32 };
            b.scale.setScalar(0.55); scene.add(b); this.birds.push(b);
        }

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        // light falling through the windows that are not there any more: pools of colour drifting over the floor
        this.pools = [];
        const soft = canvasTexture(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
        for (let i = 0; i < 6; i++) {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4), new THREE.MeshBasicMaterial({ map: soft, color: GLASS[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
            p.rotation.x = -Math.PI / 2; p.position.y = 0.02; p.renderOrder = 2;
            const arm = [[0, -4.6], [0, 4.6], [-4.6, 0], [4.6, 0], [0, 0], [0, -1.5]][i]; p.userData = { x: arm[0], z: arm[1], ph: i * 1.7 };
            scene.add(p); this.pools.push(p);
        }

        this.puffs = new Particles(160, { color: 0xf2ece0 }); this.puffs.drag = 1.8; this.puffs.gravity = 0.2;
        this.sparks = new Particles(260, { color: 0xfff0c0, additive: true }); this.sparks.drag = 1.0; this.sparks.gravity = -0.5;
        scene.add(this.puffs.points, this.sparks.points);
        this.nextCall = 10;
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (!this.nPlayers) {
            const { group, picks, lift, glass } = buildBoard(state.nPlayers);
            this.lift = lift; this.glass = glass; this.picks = picks; this.boardGroup.add(group);
        }
        this.nPlayers = state.nPlayers;
        this.syncStones(state);
        this.clearIndicators();
    }

    // Walls, vaults and towers stand while the visitor arrives, and are lifted away for the game.
    reveal(on, animated = true) {
        if (!this.lift) return;
        if (animated) this.lift.reveal(this.tweens, on, true); else { this.lift.shown = on; this.lift.set(on ? 1 : 0); }
    }

    homeView() { return { pos: new THREE.Vector3(-3.0, 14.2, 13.6), target: new THREE.Vector3(0, 0, 0.5) }; }
    cameraLimits() { return { min: 8, max: 48 }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(55);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.92;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x8f8a7c).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.35;
        const haze = new THREE.Color(0xcfd6dc).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(d.night ? 0x05060a : 0x5a5f68);
        for (const b of this.birds) b.visible = !d.night;
        if (this.glass) this.glass.color.setScalar(0.5 + d.lamps * 1.3); // the windows glow from within after dark
        this.poolPower = d.night ? 0.05 : 0.12 + Math.min(1, d.keyPower / 3) * 0.16;
        this.puffs.material.uniforms.uColor.value.set(0xf2ece0).multiplyScalar(d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2));
    }

    // ------------------------------------------------------------ stones & indicators

    syncStones(state) {
        for (const [, mesh] of this.stones) this.stoneGroup.remove(mesh);
        this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) if (state.grid[i]) this.putStone(i, state.grid[i]);
    }
    putStone(i, color) {
        const s = makeStone(color);
        cellPos(i, s.position); s.userData.cell = i;
        this.stoneGroup.add(s); this.stones.set(i, s);
        return s;
    }

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = 0; this.selected = null; }
    }

    // cell: the stone in hand; steps: what it may do next; canStop: a chain of conversions may end here
    showSelection(cell, steps, canStop = false) {
        this.clearIndicators();
        const stone = this.stones.get(cell);
        if (stone) this.selected = stone;
        const ring = (r0, r1, color) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 36),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; mesh.position.y = 0.03;
            return mesh;
        };
        const put = (o) => { this.indicatorGroup.add(o); this.indicators.push(o); return o; };
        const sel = put(ring(0.4, 0.47, canStop ? 0xfff3c0 : 0xffd070)); cellPos(cell, sel.position).y = 0.03; sel.userData.sel = !canStop; sel.userData.ph = 0;
        const marked = new Set();
        for (const st of steps) {
            const o = put(ring(0.15, 0.26, st.type === 'convert' ? 0xff7a3a : st.type === 'passage' ? 0x7fd8ff : 0xffd070));
            cellPos(st.to, o.position).y = 0.03; o.userData.ph = Math.random() * 3;
            if (st.run) for (const i of st.run) if (!marked.has(i)) { marked.add(i); const x = put(ring(0.41, 0.46, 0xff4a2a)); cellPos(i, x.position).y = 0.03; x.userData.ph = o.userData.ph; }
        }
    }

    // what is under the pointer: a field or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, ...this.picks], false);
        return hits.length ? (hits[0].object.userData.cell ?? -1) : -1;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state, travel = true) {
        this.clearIndicators();
        if (travel) for (const ev of events) await this.playStep(ev);
        this.syncStones(state);
    }

    // a stone walks its line (or round the corner through a passage); the line it stops before changes colour
    async playStep(ev) {
        const stone = this.stones.get(ev.from);
        if (!stone) return;
        if (this.selected === stone) this.selected = null;
        const a = cellPos(ev.from), b = cellPos(ev.to), dist = Math.hypot(b.x - a.x, b.z - a.z);
        this.stones.delete(ev.from); this.stones.set(ev.to, stone); stone.userData.cell = ev.to;
        sfx('slide', dist);
        if (ev.type === 'passage') await this.tweens.run(0.55, (k) => { passagePoint(ev.from, ev.to, ease.inOut(k), stone.position); });
        else await this.tweens.run(0.2 + dist * 0.07, (k) => { stone.position.lerpVectors(a, b, ease.inOut(k)); });
        stone.position.copy(b);
        if (ev.run) await this.convert(ev.run, ev.color);
    }

    // conversion runs down the line like a peal: each stone rises, turns to the new colour and settles
    convert(run, color) {
        sfx('bell');
        this.sparks.material.uniforms.uColor.value.set(SPARK[color]);
        return Promise.all(run.map((cell, n) => {
            const old = this.stones.get(cell);
            if (!old) return null;
            let swapped = false, cur = old;
            return this.tweens.run(0.34, (k) => {
                if (!swapped && k >= 0.5) {
                    swapped = true;
                    this.stoneGroup.remove(old);
                    cur = this.putStone(cell, color);
                    this.sparks.burst(new THREE.Vector3(cur.position.x, 0.3, cur.position.z), 5, { speed: 0.4, up: 0.7, size: 0.2, alpha: 0.8, life: 0.7 });
                }
                const w = Math.sin(Math.PI * k);
                cur.position.y = w * 0.32; cur.scale.set(1 - w * 0.25, 1 + w * 0.2, 1 - w * 0.25);
                if (k === 1) { cur.position.y = 0; cur.scale.setScalar(1); }
            }, n * 0.08);
        }));
    }

    celebrate(color) {
        this.sparks.material.uniforms.uColor.value.set(SPARK[color]);
        for (const [, s] of this.stones) {
            if (s.userData.color !== color) continue;
            const p = s.position.clone(); p.y = 0.4;
            this.tweens.run(0.1, () => {}, Math.random() * 1.8).then(() => this.sparks.burst(p, 8, { speed: 0.7, up: 1.9, size: 0.4, alpha: 1, life: 1.6 }));
        }
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, 0);

        if (this.selected) this.selected.position.y = 0.1 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.sel) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.scale.set(1 + w * 0.1, 1 + w * 0.1, 1); o.material.opacity = 0.65 + w * 0.3;
        }
        // the pools of coloured light show only where the windows are gone
        const open = this.lift && !this.lift.shown ? 1 : 0;
        for (const p of this.pools) {
            const u = p.userData;
            p.position.x = u.x + Math.sin(t * 0.11 + u.ph) * 0.7; p.position.z = u.z + Math.cos(t * 0.09 + u.ph) * 0.7;
            p.rotation.z = 0.5 + Math.sin(t * 0.05 + u.ph) * 0.2;
            p.material.opacity += ((this.poolPower || 0) * open * (0.8 + Math.sin(t * 0.7 + u.ph) * 0.2) - p.material.opacity) * Math.min(1, dt * 2);
        }
        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.5, Math.sin(a) * u.r * 0.8 + 3);
            b.rotation.y = -a;
            const flap = Math.sin(t * 13 + u.ph * 9) * 0.6;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : 'songbird'); this.nextCall = 9 + Math.random() * 14; }
        }
        this.puffs.update(dt); this.sparks.update(dt);
    }
}
