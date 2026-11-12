// GARDENS — the world: Babylon on the Euphrates, the terraced board, stones, effects and move animations.
import * as THREE from 'three';
import {
    FIELDS, UPPER, COLS, NODES, WHITE, BLACK, G_WHITE_HIGH, G_WHITE_HOME, G_BLACK_HOME, G_BLACK_HIGH,
    isGarden, towerStones, towerHeight, towerTop, gardenCount, createState, cloneState, partial, currentColor,
} from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { sandMaps, paveMaps, canvasTexture } from '../textures.js';
import { materials, buildPalm } from '../models.js';
import { stoneMaterials } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -2.4;          // the plain; the lower field lies on the third terrace above it
const Y0 = 0.5, Y1 = 1.7;            // top of the lower and of the upper terrace
const TILE = 0.07, PAD = 0.08;       // thickness of a field tile and of a garden lawn
const GX = 3.5;                      // |x| of the four gardens
export const STONE_H = 0.17;

// where the first stone on a node rests
export function nodePos(n, out = new THREE.Vector3()) {
    if (n < FIELDS) {
        const upper = n >= UPPER, j = upper ? n - UPPER : n;
        return out.set((j % COLS) - 2, (upper ? Y1 : Y0) + TILE, (upper ? -3.1 : 1.1) + Math.floor(j / COLS));
    }
    const left = n === G_WHITE_HIGH || n === G_WHITE_HOME, high = n === G_WHITE_HIGH || n === G_BLACK_HIGH;
    return out.set(left ? -GX : GX, (high ? Y1 : Y0) + PAD, high ? -2.1 : 2.1);
}
// gardens hold loose stones: four little piles for each colour, white along one side, black along the other
export function gardenSlot(g, color, j, out = new THREE.Vector3()) {
    nodePos(g, out);
    out.x += color === WHITE ? -0.36 : 0.36;
    out.z += ((j % 4) - 1.5) * 0.7;
    out.y += Math.floor(j / 4) * STONE_H;
    return out;
}

// ---------------------------------------------------------------- stones

let discGeo = null, discGeoLow = null;
function discGeometry(low) {
    const pts = [[0, 0], [0.265, 0], [0.305, 0.028], [0.32, 0.085], [0.305, 0.142], [0.265, 0.17], [0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y));
    if (low) return discGeoLow || (discGeoLow = new THREE.LatheGeometry(pts, 12));
    return discGeo || (discGeo = new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(14), 36));
}
function makeStone(color, low = false) {
    const m = new THREE.Mesh(discGeometry(low), stoneMaterials()[color]);
    m.castShadow = true; m.receiveShadow = !low;
    return m;
}

// ---------------------------------------------------------------- materials and textures

let GM = null;
function gardenMaterials() {
    if (GM) return GM;
    const m = materials();
    const tint = (hex, rough = 0.9) => { const x = m.sandstone.clone(); x.color.set(hex); x.roughness = rough; return x; };
    const rosette = (x, cx, cy, r, petals, a, b) => {
        for (let i = 0; i < petals; i++) {
            const t = (i / petals) * Math.PI * 2;
            x.fillStyle = i % 2 ? a : b;
            x.beginPath(); x.ellipse(cx + Math.cos(t) * r * 0.55, cy + Math.sin(t) * r * 0.55, r * 0.45, r * 0.2, t, 0, 7); x.fill();
        }
        x.fillStyle = '#e8b84a'; x.beginPath(); x.arc(cx, cy, r * 0.2, 0, 7); x.fill();
    };
    // glazed brick frieze, after the Ishtar Gate: lapis blue, a band of daisies between yellow lines
    const frieze = canvasTexture(512, 64, (x, W, H) => {
        x.fillStyle = '#1b4a98'; x.fillRect(0, 0, W, H);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 17; c++) {
            const k = ((c * 37 + r * 91) % 9) / 9;
            x.fillStyle = `rgba(${20 + k * 30},${60 + k * 40},${140 + k * 60},0.55)`;
            x.fillRect(c * 32 - (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
        }
        x.fillStyle = '#e2b548'; x.fillRect(0, 3, W, 5); x.fillRect(0, H - 8, W, 5);
        for (let i = 0; i < 8; i++) rosette(x, 32 + i * 64, H / 2, 17, 12, '#f4ead0', '#f0d98c');
    });
    frieze.wrapS = THREE.RepeatWrapping;
    const tile = (edge) => canvasTexture(256, 256, (x, W) => {
        x.fillStyle = '#c69c62'; x.fillRect(0, 0, W, W);
        for (let i = 0; i < 1400; i++) {
            const k = (i * 7919) % 256, l = (i * 104729) % 256, a = ((i * 31) % 10) / 100;
            x.fillStyle = i % 2 ? `rgba(90,60,25,${a})` : `rgba(255,232,180,${a})`; x.fillRect(k, l, 3 + (i % 5), 2 + (i % 3));
        }
        x.strokeStyle = edge; x.lineWidth = 12; x.strokeRect(17, 17, W - 34, W - 34);
        x.strokeStyle = 'rgba(232,184,74,0.9)'; x.lineWidth = 3; x.strokeRect(27, 27, W - 54, W - 54);
        x.globalAlpha = 0.5; rosette(x, W / 2, W / 2, 30, 8, '#f1e2bd', edge); x.globalAlpha = 1;
    });
    const lawn = canvasTexture(256, 512, (x, W, H) => {
        x.fillStyle = '#4f7d36'; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 2600; i++) {
            const px = (i * 7919) % W, py = (i * 15485863) % H, k = (i * 31) % 10;
            x.fillStyle = k < 5 ? 'rgba(30,70,25,0.35)' : 'rgba(150,190,80,0.3)'; x.fillRect(px, py, 2, 4 + (i % 4));
        }
        for (let i = 0; i < 70; i++) {
            const px = (i * 104729) % W, py = (i * 1299709) % H;
            x.fillStyle = ['#f6f0e0', '#f0c0d0', '#f2d35a', '#d8544a'][i % 4]; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill();
        }
    });
    const streaks = canvasTexture(64, 256, (x, W, H) => {
        x.clearRect(0, 0, W, H);
        for (let i = 0; i < 46; i++) {
            const px = (i * 7919) % W, py = (i * 104729) % H, len = 40 + (i * 37) % 120;
            const g = x.createLinearGradient(0, py, 0, py + len);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(235,248,255,${0.35 + (i % 5) * 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g; x.fillRect(px, py, 2 + (i % 3), len); x.fillRect(px, py - H, 2 + (i % 3), len);
        }
    });
    streaks.wrapS = streaks.wrapT = THREE.RepeatWrapping;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    GM = {
        brick: tint(0xd8ac72), brickDark: tint(0xba8e5c), brickLight: tint(0xecd0a0, 0.8),
        frieze: new THREE.MeshPhysicalMaterial({ map: frieze, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
        tileLow: std({ map: tile('#1f4f9c'), roughness: 0.6 }), tileHigh: std({ map: tile('#167f86'), roughness: 0.6 }),
        lawn: std({ map: lawn, roughness: 1, emissive: 0x9fd060, emissiveIntensity: 0 }),
        alabaster: new THREE.MeshPhysicalMaterial({ color: 0xf2e8d2, roughness: 0.4, clearcoat: 0.3 }),
        basalt: new THREE.MeshPhysicalMaterial({ color: 0x1d1a18, roughness: 0.35, clearcoat: 0.5 }),
        niche: std({ color: 0x3a2a1c, roughness: 1 }),
        vine: std({ color: 0xffffff, roughness: 0.9 }), bush: std({ color: 0xffffff, roughness: 0.9, flatShading: true }),
        fall: new THREE.MeshBasicMaterial({ map: streaks, color: 0xdff2ff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
        streaks,
    };
    return GM;
}

// box standing on y, with the texture at one scale on every face
function tbox(w, h, d, mat, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, S = 0.3;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, uv.getX(i) * dims[f][0] * S + f * 0.37 + x * 0.11, uv.getY(i) * dims[f][1] * S + z * 0.07);
    }
    const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z);
    return m;
}

// a strip of the glazed frieze; the daisies keep their size whatever the length
function friezeBand(w, h, d, x, y, z) {
    const band = box(w, h, d, gardenMaterials().frieze, x, y, z), uv = band.geometry.attributes.uv, k = Math.max(w, d) / 2.1;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
    return band;
}

const dummy = new THREE.Object3D();
function instanced(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z); dummy.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1); dummy.rotation.set(o.rx ?? 0, o.ry ?? 0, 0);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        if (o.color) im.setColorAt(i, o.color);
    });
    im.castShadow = im.receiveShadow = true;
    return im;
}

// the terraces, bottom to top: [half width, z front, z back, y of the floor below, y of its top]
const TIERS = [[7.0, 6.6, -5.2, GROUND, -1.4], [5.7, 5.2, -4.5, -1.4, -0.45], [4.4, 3.9, -3.9, -0.45, Y0]];

// ---------------------------------------------------------------- the board
// Builds the whole garden building. Returns { group, cells[] } — cells[i].userData.cell = node.
export function buildBoard({ mini = false } = {}) {
    const m = materials(), gm = gardenMaterials();
    const group = new THREE.Group(), cells = [];
    let seed = 20261110;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const add = (o) => { group.add(o); return o; };

    // three terraces of baked brick, each crowned with a glazed frieze
    const merlons = [], buttress = [], niches = [], vines = [], bushes = [], flowers = [];
    const green = () => new THREE.Color().setHSL(0.26 + rnd() * 0.08, 0.45 + rnd() * 0.15, 0.2 + rnd() * 0.12, THREE.SRGBColorSpace);
    TIERS.forEach(([hw, zf, zb, y0, y1], t) => {
        const h = y1 - y0, zc = (zf + zb) / 2, d = zf - zb;
        add(tbox(hw * 2, h, d, t === 0 ? gm.brickDark : gm.brick, 0, y0, zc));
        const fz = 0.2, fy = y1 - fz - 0.04;
        for (const [w, dd, x, z] of [[hw * 2 + 0.05, 0.03, 0, zf], [hw * 2 + 0.05, 0.03, 0, zb], [0.03, d + 0.05, hw, zc], [0.03, d + 0.05, -hw, zc]]) {
            add(friezeBand(w, fz, dd, x, fy, z));
        }
        // crenellations along the edge, pilasters and shadowed niches on the faces
        const stair = (x, z) => Math.abs(x) < 1.35 && z > 0;
        const mh = t === 2 ? 0.15 : 0.2;
        for (let x = -hw + 0.14; x <= hw - 0.13; x += 0.4) for (const z of [zf - 0.1, zb + 0.1]) if (!stair(x, z)) merlons.push({ x, y: y1 + mh / 2, z, sy: mh / 0.2 });
        for (let z = zb + 0.5; z <= zf - 0.45; z += 0.4) for (const x of [-hw + 0.1, hw - 0.1]) merlons.push({ x, y: y1 + mh / 2, z, sy: mh / 0.2 });
        const ph = h - 0.34;
        for (let x = -hw + 0.5; x <= hw - 0.45; x += 1.3) for (const z of [zf, zb]) {
            if (stair(x, z)) continue;
            buttress.push({ x, y: y0 + ph / 2, z: z + Math.sign(z) * 0.04, sy: ph });
            if (x + 0.65 < hw - 0.3 && !stair(x + 0.65, z)) niches.push({ x: x + 0.65, y: y0 + ph * 0.45, z: z + Math.sign(z) * 0.012, sy: ph * 0.62 });
        }
        for (let z = zb + 0.5; z <= zf - 0.45; z += 1.3) for (const x of [-hw, hw]) {
            buttress.push({ x: x + Math.sign(x) * 0.04, y: y0 + ph / 2, z, sy: ph, ry: Math.PI / 2 });
            if (z + 0.65 < zf - 0.3) niches.push({ x: x + Math.sign(x) * 0.012, y: y0 + ph * 0.45, z: z + 0.65, sy: ph * 0.62, ry: Math.PI / 2 });
        }
        // greenery spilling over the edge of the terrace above
        if (t > 0) {
            const [bw, bf, bb] = TIERS[t - 1];
            const n = mini ? 26 : 70;
            for (let i = 0; i < n; i++) {
                const side = i % 4, u = rnd();
                let x, z;
                if (side === 0) { x = (u - 0.5) * 2 * hw; z = zf + 0.28 + rnd() * (bf - zf - 0.75); if (Math.abs(x) < 1.5) continue; }
                else if (side === 1) { x = (u - 0.5) * 2 * hw; z = zb - 0.2 - rnd() * (zb - bb - 0.5); }
                else { x = (side === 2 ? 1 : -1) * (hw + 0.28 + rnd() * (bw - hw - 0.75)); z = zb + u * d; }
                const s = 0.15 + rnd() * 0.15;
                bushes.push({ x, y: y0 + s * 0.6, z, sx: s, sy: s * (0.8 + rnd() * 0.5), sz: s, ry: rnd() * 6, color: green() });
                if (!mini && rnd() < 0.5) flowers.push({ x: x + (rnd() - 0.5) * s, y: y0 + s * 1.25, z: z + (rnd() - 0.5) * s, color: new THREE.Color([0xf6f0e0, 0xf0a8c0, 0xf2d35a, 0xd8544a][i % 4]) });
            }
            const nv = mini ? 20 : 54;
            for (let i = 0; i < nv; i++) {
                const side = i % 3, len = 0.25 + rnd() * rnd() * (h - 0.3), u = rnd();
                const x = side === 0 ? (u - 0.5) * 2 * hw : (side === 1 ? 1 : -1) * (hw + 0.02), z = side === 0 ? zf + 0.02 : zb + u * d;
                if (side === 0 && Math.abs(x) < 1.4) continue;
                vines.push({ x, y: y1 - 0.02 - len / 2, z, sy: len, ry: side === 0 ? 0 : Math.PI / 2, color: green() });
            }
        }
    });

    // the upper terrace: a centre block and two wings, with the staircases let in between wing and lower garden
    add(tbox(5.2, Y1 - Y0, 3.9, gm.brick, 0, Y0, -1.95));
    for (const sx of [-1, 1]) {
        add(tbox(1.8, Y1 - Y0, 3.3, gm.brick, sx * GX, Y0, -2.25));
        const stairMat = sx < 0 ? gm.basalt : gm.alabaster; // the left stairs carry black, the right stairs white
        for (let i = 0; i < 6; i++) add(box(1.3, (i + 1) * 0.2, 0.2, stairMat, sx * GX, Y0, 0.5 - i * 0.2));
        for (const cx of [2.725, 4.275]) add(tbox(0.25, 0.95, 1.2, gm.brickLight, sx * cx, Y0, 0));
        for (const cx of [2.725, 4.275]) add(box(0.25, 0.06, 1.24, gm.frieze, sx * cx, Y0 + 0.95, 0));
    }
    add(friezeBand(5.2, 0.22, 0.03, 0, Y1 - 0.26, 0.012));
    for (let i = 0; i < 6; i++) { const x = -2.2 + i * 0.88; if (i !== 2 && i !== 3) niches.push({ x: x, y: Y0 + 0.42, z: 0.012, sy: 0.7 }); }
    for (let i = 0; i < (mini ? 8 : 22); i++) { const len = 0.2 + rnd() * 0.6, x = (rnd() - 0.5) * 5; if (Math.abs(x) > 0.5) vines.push({ x, y: Y1 - 0.02 - len / 2, z: 0.03, sy: len, color: green() }); }
    for (let x = -4.26; x <= 4.3; x += 0.4) merlons.push({ x, y: Y1 + 0.09, z: -3.8, sy: 0.9 });
    for (let z = -3.4; z <= -0.7; z += 0.4) for (const x of [-4.3, 4.3]) merlons.push({ x, y: Y1 + 0.09, z, sy: 0.9 });

    // the water: a spout in the wall feeds a channel along its foot
    add(box(5.1, 0.03, 0.5, m.water, 0, Y0, 0.29)).userData.flat = true;
    add(box(5.2, 0.09, 0.07, gm.brickLight, 0, Y0, 0.565));
    add(box(0.34, 0.2, 0.12, m.gold, 0, Y1 - 0.5, 0.05));
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.3, Y1 - Y0 - 0.42), gm.fall);
    fall.position.set(0, (Y1 + Y0) / 2 - 0.2, 0.1); group.add(fall);

    // the grand stair up the front, three flights
    TIERS.forEach(([, zf, , y0, y1]) => {
        const n = 5, rise = (y1 - y0) / n, run = 0.27;
        for (let i = 0; i < n; i++) add(tbox(2.3, (n - i) * rise, run, gm.brickLight, 0, y0, zf + (i + 0.5) * run));
        for (const sx of [-1, 1]) add(tbox(0.24, y1 - y0 + 0.16, n * run, gm.brick, sx * 1.27, y0, zf + n * run / 2));
    });

    // the two fields
    const tileGeo = new THREE.BoxGeometry(0.94, TILE, 0.94);
    for (let n = 0; n < FIELDS; n++) {
        const t = new THREE.Mesh(tileGeo, n >= UPPER ? gm.tileHigh : gm.tileLow);
        nodePos(n, t.position).y -= TILE / 2;
        t.userData.cell = n; group.add(t); cells.push(t);
    }
    // the four gardens: a lawn inside a kerb of the owner's stone
    const lawnGeo = new THREE.BoxGeometry(1.5, PAD, 2.96);
    for (let g = FIELDS; g < NODES; g++) {
        const lawn = new THREE.Mesh(lawnGeo, gm.lawn.clone());
        nodePos(g, lawn.position).y -= PAD / 2;
        lawn.userData.cell = g; group.add(lawn); cells.push(lawn);
        const kerb = g === G_WHITE_HIGH || g === G_WHITE_HOME ? gm.alabaster : gm.basalt, p = lawn.position, y = p.y - PAD / 2;
        add(box(1.64, 0.13, 0.07, kerb, p.x, y, p.z - 1.515)); add(box(1.64, 0.13, 0.07, kerb, p.x, y, p.z + 1.515));
        add(box(0.07, 0.13, 2.96, kerb, p.x - 0.785, y, p.z)); add(box(0.07, 0.13, 2.96, kerb, p.x + 0.785, y, p.z));
    }

    add(instanced(new THREE.BoxGeometry(0.2, 0.2, 0.13), gm.brickLight, merlons));
    add(instanced(new THREE.BoxGeometry(0.34, 1, 0.1), gm.brickLight, buttress));
    add(instanced(new THREE.BoxGeometry(0.46, 1, 0.02), gm.niche, niches)).userData.flat = true;
    add(instanced(new THREE.BoxGeometry(0.1, 1, 0.035), gm.vine, vines)).userData.flat = true;
    add(instanced(new THREE.IcosahedronGeometry(1, 1), gm.bush, bushes));
    if (flowers.length) add(instanced(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowers)).userData.flat = true;

    // palms on the terraces; the tallest crown the High Gardens
    const spots = mini ? [[-5, -0.45, 4.4, 1.7], [5, -0.45, 4.4, 1.9], [-GX, Y1, -3.72, 1.6], [GX, Y1, -3.72, 1.6]]
        : [[-5, -0.45, 4.4, 1.7], [5, -0.45, 4.4, 1.9], [-6.3, -1.4, 5.9, 2.2], [6.3, -1.4, 5.8, 2.0], [-5.05, -0.45, -1.2, 1.8], [5.05, -0.45, 0.4, 1.6],
            [-6.35, -1.4, 0.6, 2.1], [6.35, -1.4, -2.6, 2.3], [-GX, Y1, -3.72, 1.6], [GX, Y1, -3.72, 1.6], [-3, -1.4, 6.05, 1.5], [3.2, -1.4, 6.0, 1.7]];
    spots.forEach(([x, y, z, s], i) => {
        const p = buildPalm(1, 0.1 + (i % 3) * 0.1); p.scale.setScalar(s); p.position.set(x, y, z); p.rotation.y = i * 2.1;
        group.add(p);
    });
    shadowed(group);
    fall.castShadow = fall.receiveShadow = false;
    group.traverse((o) => { if (o.userData.flat) o.castShadow = false; });
    // everything static is baked into one mesh per material; the tiles stay behind, unseen, as targets for the pointer
    for (const c of cells) if (isGarden(c.userData.cell)) c.userData.keep = true;
    mergeByMaterial(group, (o) => o.userData.keep);
    for (const c of cells) if (!isGarden(c.userData.cell)) { c.visible = false; group.add(c); }

    if (mini) { // table miniature: the stones in their Home Gardens
        const st = createState();
        for (const [g, c] of [[G_WHITE_HOME, WHITE], [G_BLACK_HOME, BLACK]]) for (let j = 0; j < gardenCount(st, g, c); j++) {
            const s = makeStone(c, true); gardenSlot(g, c, j, s.position); group.add(s);
        }
    }
    return { group, cells, fall };
}

// ---------------------------------------------------------------- the world

export class GardensWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'garden';
        this.veil = 0xcfe0b0;
        this.indicators = [];
        this.towerMeshes = []; this.gardenMeshes = [];
        const m = materials(), gm = gardenMaterials();

        scene.fog = new THREE.FogExp2(0xcfd8c0, 0.0045);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 90, left: -11, right: 11, top: 11, bottom: -11 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x9a9a60, 0.6); scene.add(this.hemi);

        // the plain: fields and irrigation ditches between the city and the river
        const plain = canvasTexture(1024, 1024, (x, W, H) => {
            x.fillStyle = '#a79a62'; x.fillRect(0, 0, W, H);
            let s = 7;
            const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
            for (let i = 0; i < 520; i++) {
                const px = Math.floor(r() * 32) * 32, py = Math.floor(r() * 32) * 32, w = (1 + Math.floor(r() * 3)) * 32, h = (1 + Math.floor(r() * 2)) * 32;
                x.fillStyle = ['#7f9a4c', '#6d8c44', '#93a257', '#b3a467', '#88964e', '#a8b060'][Math.floor(r() * 6)];
                x.globalAlpha = 0.5 + r() * 0.4; x.fillRect(px + 1, py + 1, w - 2, h - 2);
            }
            x.globalAlpha = 0.5; x.strokeStyle = '#4f7f8a'; x.lineWidth = 2;
            for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, i * 128 + 40); x.lineTo(W, i * 128 + 40 + (i % 3) * 20); x.stroke(); }
            x.globalAlpha = 1;
        });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: plain, roughness: 1 }));
        plain.wrapS = plain.wrapT = THREE.RepeatWrapping; plain.repeat.set(3, 3);
        ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; scene.add(ground);
        const pave = paveMaps(), pm = pave.map.clone(), pn = pave.normalMap.clone();
        pm.repeat.set(5, 6); pn.repeat.set(5, 6); pm.needsUpdate = pn.needsUpdate = true;
        const paveMat = new THREE.MeshStandardMaterial({ map: pm, normalMap: pn, roughness: 0.9, color: 0xe8d2a8 });
        const court = box(20, 0.1, 22, paveMat, 0, GROUND, 2.5); court.receiveShadow = true; scene.add(court);
        const way = box(4.4, 0.06, 70, paveMat, 0, GROUND, 48); way.receiveShadow = true; scene.add(way); // the Processional Way

        // the Euphrates
        const wn = sandMaps().normalMap.clone(); wn.repeat.set(5, 60); wn.needsUpdate = true;
        this.riverMap = wn;
        this.riverMat = new THREE.MeshPhysicalMaterial({ color: 0x3f7f8c, roughness: 0.12, metalness: 0.1, clearcoat: 1, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35) });
        const river = new THREE.Mesh(new THREE.PlaneGeometry(46, 1400), this.riverMat);
        river.rotation.x = -Math.PI / 2; river.position.set(48, GROUND + 0.04, 0); scene.add(river);
        const bankMat = new THREE.MeshStandardMaterial({ color: 0x9a8858, roughness: 1 });
        for (const x of [24.6, 71.4]) scene.add(box(1.2, 0.3, 1400, bankMat, x, GROUND - 0.1, 0));
        this.river = { x0: 28, x1: 68 };

        // Babylon: the double wall with its towers and a blue gate, Etemenanki behind, flat roofs to the horizon
        const far = new THREE.MeshStandardMaterial({ color: 0xcaa878, roughness: 1 }), farDark = new THREE.MeshStandardMaterial({ color: 0xb08c5e, roughness: 1 });
        const blue = new THREE.MeshStandardMaterial({ color: 0x2456a8, roughness: 0.5 });
        const city = new THREE.Group(); scene.add(city);
        const wallZ = -70, towers = [];
        city.add(box(420, 9, 5, far, -60, GROUND, wallZ));
        for (let x = -260; x <= 150; x += 14) if (Math.abs(x + 6) > 9) towers.push({ x, y: GROUND + 6, z: wallZ + 0.5, sx: 4.5, sy: 12, sz: 7 });
        city.add(box(7, 15, 8, blue, -13, GROUND, wallZ), box(7, 15, 8, blue, 1, GROUND, wallZ), box(9, 4, 6, blue, -6, GROUND + 9, wallZ));
        city.add(box(6, 9.2, 5.4, new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 }), -6, GROUND, wallZ));
        city.add(box(21, 0.5, 8.2, m.gold, -6, GROUND + 15, wallZ));
        let zy = GROUND;
        [[64, 12], [52, 10], [41, 9], [31, 8], [22, 7], [14, 6]].forEach(([w, h], i) => { city.add(box(w, h, w, i % 2 ? far : farDark, -95, zy, -190)); zy += h; });
        city.add(box(9, 7, 9, blue, -95, zy, -190));
        const houses = [];
        let hs = 99;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        for (let i = 0; i < 230; i++) {
            const x = -300 + hr() * 320, z = wallZ - 12 - hr() * 210;
            if (Math.hypot(x + 95, z + 190) < 50) continue;
            const w = 5 + hr() * 9, h = 3 + hr() * 6;
            houses.push({ x, y: GROUND + h / 2, z, sx: w, sy: h, sz: 5 + hr() * 9, color: new THREE.Color().setHSL(0.09 + hr() * 0.03, 0.35, 0.56 + hr() * 0.16, THREE.SRGBColorSpace) });
        }
        for (let i = 0; i < 90; i++) { // the quarter across the river
            const x = 80 + hr() * 220, z = -260 + hr() * 420, w = 5 + hr() * 9, h = 3 + hr() * 5;
            houses.push({ x, y: GROUND + h / 2, z, sx: w, sy: h, sz: 5 + hr() * 9, color: new THREE.Color().setHSL(0.09 + hr() * 0.03, 0.35, 0.56 + hr() * 0.16, THREE.SRGBColorSpace) });
        }
        mergeByMaterial(shadowed(city, true, false)).children.forEach((o) => { o.castShadow = o.receiveShadow = false; });
        const unit = new THREE.BoxGeometry(1, 1, 1);
        const hm = instanced(unit, new THREE.MeshStandardMaterial({ roughness: 1 }), houses); hm.castShadow = hm.receiveShadow = false; city.add(hm);
        const tm = instanced(unit, farDark, towers); tm.castShadow = tm.receiveShadow = false; city.add(tm);
        // date palms along the banks and the ditches
        const trunks = [], crowns = [];
        for (let i = 0; i < 150; i++) {
            const bank = i % 3;
            const x = bank === 0 ? 20 + hr() * 4 : bank === 1 ? 73 + hr() * 6 : (hr() < 0.5 ? -1 : 1) * (14 + hr() * 90) - 20;
            const z = bank === 2 ? -55 + hr() * 190 : -200 + hr() * 420, h = 4.5 + hr() * 3.5;
            if (bank === 2 && x > 18) continue;
            trunks.push({ x, y: GROUND + h / 2, z, sx: 0.22, sy: h, sz: 0.22 });
            crowns.push({ x, y: GROUND + h + 0.2, z, sx: 2 + hr(), sy: 0.9, sz: 2 + hr(), ry: hr() * 6, color: new THREE.Color().setHSL(0.26 + hr() * 0.06, 0.45, 0.2 + hr() * 0.1, THREE.SRGBColorSpace) });
        }
        const tr = instanced(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks); tr.receiveShadow = false; scene.add(tr);
        const cr = instanced(new THREE.IcosahedronGeometry(1, 0), gm.bush, crowns); cr.receiveShadow = false; scene.add(cr);

        // boats on the river: reed hulls under a square sail
        this.boats = [];
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x6f5230, roughness: 0.9 }), sailMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 1, side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Group();
            const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hullMat); hull.scale.set(0.9, 0.45, 3.2); hull.position.y = 0.1; b.add(hull);
            b.add(cyl(0.05, 0.07, 3.4, hullMat, 0, 0.3, 0.2, 6));
            const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), sailMat); sail.position.set(0, 2.5, 0.25); b.add(sail);
            b.userData = { x: 34 + i * 9, sp: (0.5 + (i % 3) * 0.22) * (i % 2 ? 1 : -1), z: -120 + i * 70 };
            b.rotation.y = i % 2 ? 0 : Math.PI;
            mergeByMaterial(shadowed(b, true, false)).children.forEach((o) => { o.castShadow = o.receiveShadow = false; });
            scene.add(b); this.boats.push(b);
        }

        // doves over the gardens
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.14, 0, 0, -0.12, 0.6, 0, -0.04], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6, side: THREE.DoubleSide });
        for (let i = 0; i < 12; i++) {
            const b = new THREE.Group();
            const wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            const flock = i % 3;
            b.userData = { wl, wr, r: 9 + flock * 7 + Math.random() * 3, h: 7 + flock * 4 + Math.random() * 2, sp: (0.16 + flock * 0.03) * (flock === 1 ? -1 : 1), ph: flock * 2 + (i / 3) * 0.22, cx: flock * 6 - 6, cz: -4 };
            b.scale.setScalar(0.55 + Math.random() * 0.2);
            scene.add(b); this.birds.push(b);
        }
        this.nextSong = 6;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.handGroup = new THREE.Group(); this.handInner = new THREE.Group(); this.handGroup.add(this.handInner); scene.add(this.handGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);

        // torches on the corners of the garden terrace
        this.flames = [];
        const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
        [[-4.15, Y0, 3.65, 1], [4.15, Y0, 3.65, 1], [-4.15, Y1, -3.65, 0], [4.15, Y1, -3.65, 0], [-1.6, -1.4, 6.3, 0], [1.6, -1.4, 6.3, 0]].forEach(([x, y, z, lit]) => {
            const g = new THREE.Group();
            g.add(cyl(0.05, 0.08, 0.7, m.bronze, 0, 0, 0, 6), cyl(0.15, 0.07, 0.12, m.bronze, 0, 0.7, 0, 8));
            const flame = new THREE.Group();
            const outer = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fm(0xff6a18, 0.75)); outer.scale.set(1, 1.9, 1); outer.position.y = 0.14;
            const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fm(0xffe08a, 0.95)); inner.scale.set(1, 1.7, 1); inner.position.y = 0.1;
            flame.add(outer, inner); flame.position.y = 0.84; g.add(flame);
            let light = null;
            if (lit) { light = new THREE.PointLight(0xff9a4c, 0, 14, 1.8); light.position.y = 1.2; g.add(light); }
            g.position.set(x, y, z); scene.add(g);
            this.flames.push({ flame, light, ph: Math.random() * 10 });
        });

        // particles: sparks for the effects; petals and pollen by day, fireflies by night
        this.sparks = new Particles(260, { color: 0xffe2a0, additive: true }); this.sparks.drag = 1.2; this.sparks.gravity = -0.4;
        this.motes = new Particles(160, { color: 0xfff4d8, additive: true });
        scene.add(this.sparks.points, this.motes.points);
        for (let i = 0; i < this.motes.n; i++) {
            this.motes.pos.set([(Math.random() - 0.5) * 16, Y0 + Math.random() * 5, (Math.random() - 0.5) * 14], i * 3);
            this.motes.size[i] = 0.05 + Math.random() * 0.07; this.motes.alpha[i] = Math.random();
        }
    }

    setBoard(state) {
        if (!this.cells) {
            const { group, cells, fall } = buildBoard();
            this.cells = cells; this.fall = fall; this.boardGroup.add(group);
            this.lawns = cells.filter((c) => isGarden(c.userData.cell));
        }
        this.clearIndicators();
        this.sync(state);
    }

    homeView() { return { pos: new THREE.Vector3(-4.8, 9.2, 12.6), target: new THREE.Vector3(0, 0.5, -0.1) }; }
    cameraLimits() { return { min: 6, max: 32 }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(45);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x9a9a60).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.5;
        const haze = new THREE.Color(0xcfd8c0).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(0xf2efe6).multiplyScalar(d.night ? 0.05 : 0.55 + d.keyPower * 0.1);
        for (const b of this.birds) b.visible = !d.night;
        const dim = d.night ? 0.22 : Math.min(1, 0.4 + d.keyPower * 0.18);
        if (this.fall) this.fall.material.color.set(0xdff2ff).multiplyScalar(dim);
        this.riverMat.color.copy(d.skyTop).lerp(new THREE.Color(0x3f7f8c), 0.55).multiplyScalar(d.night ? 0.5 : 1);
        this.motes.material.uniforms.uColor.value.set(d.night ? 0xd8ff7a : 0xfff4d8);
        this.motes.material.uniforms.uOpacity.value = d.night ? 0.9 : 0.35;
    }

    // ------------------------------------------------------------ stones

    hover(state, at, out = new THREE.Vector3()) {
        nodePos(at, out);
        out.y += isGarden(at) ? 0.72 : towerHeight(state.towers[at]) * STONE_H + 0.4;
        return out;
    }

    // show a position; `hand` are the stones being carried (lowest first), floating above node `at`
    sync(state, hand = null, at = -1) {
        this.state = state;
        this.stoneGroup.clear(); this.handInner.clear();
        this.towerMeshes = []; this.gardenMeshes = [];
        const put = (c, cell) => { const s = makeStone(c); s.userData.cell = cell; this.stoneGroup.add(s); return s; };
        for (let i = 0; i < FIELDS; i++) {
            this.towerMeshes.push(towerStones(state.towers[i]).map((c, k) => { const s = put(c, i); nodePos(i, s.position).y += k * STONE_H; return s; }));
        }
        for (let g = FIELDS; g < NODES; g++) {
            const per = [null, [], []];
            for (const c of [WHITE, BLACK]) for (let j = 0; j < gardenCount(state, g, c); j++) { const s = put(c, g); gardenSlot(g, c, j, s.position); per[c].push(s); }
            this.gardenMeshes[g] = per;
        }
        if (hand && hand.length) {
            hand.forEach((c, k) => { const s = makeStone(c); s.position.y = k * STONE_H; this.handInner.add(s); });
            this.hover(state, at, this.handGroup.position);
        }
    }

    // One step of a move: the hand travels to `at` and sets down `dropped` (colours, lowest first) there.
    // With dropped = null the hand has just been picked up and rises from its source.
    stepTo(state, hand, at, dropped = null) {
        const carrying = this.handInner.children.length > 0;
        const from = this.handGroup.position.clone();
        const before = this.state, mover = currentColor(state);
        this.sync(state, hand, at);
        if (!dropped || !carrying) {
            const to = this.handGroup.position.clone(), start = to.clone(); start.y -= isGarden(at) ? 0.6 : 0.36;
            sfx('pickup');
            return this.tweens.run(0.24, (k) => this.handGroup.position.lerpVectors(start, to, ease.out(k)));
        }
        const to = this.hover(state, at);
        // the stones that were just set down are already in place: fetch them back into the hand for the flight
        let D;
        if (isGarden(at)) {
            const need = [0, 0, 0]; for (const c of dropped) need[c]++;
            const per = this.gardenMeshes[at], taken = [0, 0, 0];
            D = dropped.map((c) => per[c][per[c].length - need[c] + taken[c]++]);
        } else D = [this.towerMeshes[at].at(-1)];
        const finals = D.map((s) => s.position.clone());
        const capture = !isGarden(at) && before && towerTop(before.towers[at]) === 3 - mover && dropped[0] === mover;
        const dist = Math.hypot(to.x - from.x, to.z - from.z), n = D.length, p = new THREE.Vector3();
        const place = (k) => {
            D.forEach((s, i) => s.position.set(p.x, p.y + i * STONE_H, p.z));
            this.handGroup.position.set(p.x, p.y + n * STONE_H, p.z);
        };
        return this.tweens.run(dist < 0.05 ? 0.06 : 0.2 + dist * 0.07, (k) => {
            p.lerpVectors(from, to, ease.inOut(k)); p.y += Math.sin(Math.PI * k) * Math.min(0.5, dist * 0.22);
            place();
        }).then(() => this.tweens.run(0.17, (k) => {
            const e = ease.in(k);
            D.forEach((s, i) => { p.copy(to).y += i * STONE_H; s.position.lerpVectors(p, finals[i], e); });
            this.handGroup.position.set(to.x, to.y + n * STONE_H * (1 - e), to.z);
            if (k === 1) {
                sfx(isGarden(at) ? 'rustle' : 'place', n);
                if (capture) { sfx('capture'); this.sparks.burst(finals[0], 7, { speed: 0.5, up: 0.5, size: 0.22, alpha: 0.7, life: 0.8, spread: 0.3 }); }
            }
        }));
    }

    // ------------------------------------------------------------ indicators

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        for (const l of this.lawns || []) l.material.emissiveIntensity = 0;
    }

    // targets: [{ node, kind }] with kind 'empty' | 'own' | 'capture' | 'stay' | 'garden'
    showTargets(state, targets) {
        this.clearIndicators();
        const ring = (geo, color) => {
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5;
            return mesh;
        };
        const COL = { empty: 0xfff3c0, own: 0x9fe8ff, capture: 0xff5a30, stay: 0xfff3c0, garden: 0xfff0b0 };
        for (const t of targets) {
            let o;
            if (t.kind === 'garden') {
                o = ring(new THREE.RingGeometry(0.93, 1.0, 4, 1, Math.PI / 4), COL.garden);
                nodePos(t.node, o.position).y += 0.03; o.scale.set(1.06, 2.05, 1); o.userData.garden = true;
                const lawn = this.lawns.find((l) => l.userData.cell === t.node); lawn.material.emissiveIntensity = 0.16;
            } else {
                const h = towerHeight(state.towers[t.node]);
                o = ring(h ? new THREE.RingGeometry(0.39, 0.455, 40) : new THREE.RingGeometry(0.15, 0.25, 32), COL[t.kind]);
                nodePos(t.node, o.position).y += h ? 0.012 : 0.02;
                // the whole tile lights up, so a target reads from any angle
                const wash = ring(new THREE.PlaneGeometry(0.88, 0.88), COL[t.kind]);
                nodePos(t.node, wash.position).y += 0.006; wash.userData.wash = true; wash.userData.ph = 0;
                this.indicatorGroup.add(wash); this.indicators.push(wash);
                if (t.kind === 'stay') { const o2 = ring(new THREE.RingGeometry(0.1, 0.16, 24), COL.stay); o2.position.copy(o.position).y += h * STONE_H + 0.01; o2.userData.ph = 1; this.indicatorGroup.add(o2); this.indicators.push(o2); }
            }
            o.userData.ph = Math.random() * 3;
            this.indicatorGroup.add(o); this.indicators.push(o);
        }
    }

    // what is under the pointer: a node index or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, ...this.cells], false);
        return hits.length ? hits[0].object.userData.cell : -1;
    }

    // ------------------------------------------------------------ move playback

    // prev: the position before the move, state: after it. travel = false when the steps were already shown.
    async play(move, events, prev, state, travel = true) {
        this.clearIndicators();
        if (move.type === 'move' && travel) {
            let p = partial(prev, move.from, move.count, []);
            await this.stepTo(p.state, p.hand, move.from);
            for (let k = 0; k < move.path.length; k++) {
                const at = move.path[k], dropped = isGarden(at) ? p.hand.slice() : [p.hand[0]];
                p = partial(prev, move.from, move.count, move.path.slice(0, k + 1));
                await this.stepTo(p.state, p.hand, at, dropped);
            }
        }
        // the position before the staircases carried anything up
        const pre = cloneState(state);
        for (const ev of events) if (ev.type === 'stairs') {
            pre.gardens[(ev.from - FIELDS) * 2 + ev.color - 1] += ev.count; pre.gardens[(ev.to - FIELDS) * 2 + ev.color - 1] -= ev.count;
        }
        for (const ev of events) {
            if (ev.type === 'lift') await this.animLift(ev, pre);
            else if (ev.type === 'stairs') { this.sync(pre); await this.animStairs(ev, pre); }
        }
        this.sync(state);
    }

    animLift(ev, after) {
        sfx('lift');
        const meshes = this.towerMeshes[ev.at], base = nodePos(ev.at);
        return this.tweens.run(0.5, (k) => {
            meshes.forEach((s, i) => { s.position.y = base.y + i * STONE_H + Math.sin(Math.PI * k) * (0.12 + i * 0.1); });
            if (k === 1) { this.sync(after); this.sparks.burst(this.hover(after, ev.at), 6, { speed: 0.4, up: 0.4, size: 0.2, alpha: 0.6, life: 0.7 }); }
        });
    }

    // stones walk up the staircase one after the other and settle in the High Garden
    animStairs(ev, pre) {
        const sx = ev.from === G_WHITE_HOME ? -1 : 1;
        const have = this.gardenMeshes[ev.from][ev.color], n = ev.count, there = gardenCount(pre, ev.to, ev.color);
        const movers = have.slice(have.length - n).reverse();
        const foot = new THREE.Vector3(sx * GX, Y0 + 0.1, 0.72), head = new THREE.Vector3(sx * GX, Y1 + 0.1, -0.72);
        sfx('stairs', n);
        const p = new THREE.Vector3();
        return Promise.all(movers.map((s, i) => {
            const a = s.position.clone(), b = gardenSlot(ev.to, ev.color, there + i);
            return this.tweens.run(1.25, (k) => {
                if (k < 0.25) { p.lerpVectors(a, foot, ease.inOut(k / 0.25)); p.y += Math.sin(Math.PI * k / 0.25) * 0.2; }
                else if (k < 0.7) {
                    const q = (k - 0.25) / 0.45; p.lerpVectors(foot, head, q);
                    p.y = Math.max(p.y, foot.y + Math.ceil(q * 6) * 0.2 - 0.1) + Math.abs(Math.sin(q * 6 * Math.PI)) * 0.07; // step by step
                } else { const q = (k - 0.7) / 0.3; p.lerpVectors(head, b, ease.inOut(q)); p.y += Math.sin(Math.PI * q) * 0.25; }
                s.position.copy(p);
                if (k === 1 && i === n - 1) this.sparks.burst(b, 5, { speed: 0.3, up: 0.5, size: 0.2, alpha: 0.6, life: 0.8 });
            }, i * 0.16);
        }));
    }

    celebrate(garden) {
        const p = nodePos(garden); p.y += 0.5;
        for (let i = 0; i < 7; i++) this.tweens.run(0.1, () => {}, i * 0.3).then(() => this.sparks.burst(p, 18, { speed: 0.9, up: 2.0, size: 0.4, alpha: 1, life: 1.8, spread: 1.2 }));
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, 0);

        this.handInner.position.y = Math.sin(t * 3.2) * 0.03;
        for (const o of this.indicators) {
            const w = Math.sin(t * 5 + o.userData.ph);
            o.material.opacity = o.userData.wash ? 0.26 + w * 0.1 : 0.7 + w * 0.3;
            if (!o.userData.garden && !o.userData.wash) o.scale.set(1 + w * 0.08, 1 + w * 0.08, 1);
        }

        // water: the fall runs, the river drifts
        if (this.fall) this.fall.material.map.offset.y = (t * 0.9) % 1;
        this.riverMap.offset.y = (t * 0.012) % 1; this.riverMap.offset.x = Math.sin(t * 0.05) * 0.05;
        for (const b of this.boats) {
            const u = b.userData;
            u.z += u.sp * dt; if (u.z > 260) u.z = -260; if (u.z < -260) u.z = 260;
            b.position.set(u.x + Math.sin(u.z * 0.02) * 2, GROUND + 0.1 + Math.sin(t * 0.8 + u.x) * 0.03, u.z);
            b.rotation.z = Math.sin(t * 0.7 + u.x) * 0.03;
        }

        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 0.8, u.cz + Math.sin(a) * u.r * 0.8);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const flap = Math.sin(t * 11 + u.ph * 9) * 0.7;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day) {
            this.nextSong -= dt;
            if (this.nextSong < 0) { sfx(this.day.night ? 'cricket' : 'songbird'); this.nextSong = this.day.night ? 5 + Math.random() * 7 : 7 + Math.random() * 14; }
        }

        const mo = this.motes;
        for (let i = 0; i < mo.n; i++) {
            const j = i * 3;
            mo.pos[j] += Math.sin(t * 0.3 + i) * dt * 0.25;
            mo.pos[j + 1] += Math.cos(t * 0.4 + i * 1.7) * dt * 0.12;
            mo.pos[j + 2] += Math.cos(t * 0.25 + i * 0.6) * dt * 0.25;
            mo.alpha[i] = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1);
        }
        mo.points.geometry.attributes.position.needsUpdate = true;
        mo.points.geometry.attributes.aAlpha.needsUpdate = true;
        this.sparks.update(dt);

        const lamps = this.day ? this.day.lamps : 0;
        for (const f of this.flames) {
            const fl = 0.8 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.flame.visible = lamps > 0.05;
            f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
            if (f.light) f.light.intensity = lamps * 9 * fl;
        }
    }
}
