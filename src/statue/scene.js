// STATUE — the world: the sanctuary of Olympia, the floor beneath the throne of Zeus, dice, effects and move animations.
import * as THREE from 'three';
import { layout, owner, pips, turnOrder, DICE, WHITE, BLACK, RED, BLUE } from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { paveMaps, canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -0.9;      // the sacred grove; the floor (y = 0) lies three steps above it
const TILE = 0.06, HALF = 0.31;  // top of a tile; half the edge of a die
const DIE_Y = TILE + HALF;

export function cellPos(L, i, out = new THREE.Vector3()) {
    return out.set((i % L.cols) - (L.cols - 1) / 2, DIE_Y, Math.floor(i / L.cols) - (L.rows - 1) / 2);
}
// reserve dice wait in two rows of four at their owner's edge of the platform
export function reservePos(L, color, k, out = new THREE.Vector3()) {
    const near = color === WHITE || color === BLUE, two = L.nPlayers === 2;
    const cx = two ? 0 : (color === WHITE || color === RED ? -3 : 3);
    const z = L.rows / 2 + 0.75 + Math.floor(k / 4) * 0.82;
    return out.set(cx + ((k % 4) - 1.5) * 0.82, DIE_Y - TILE + 0.02, near ? z : -z);
}
const thrones = (L) => (L.nPlayers === 2 ? [0] : [-5, 5]); // z of every throne

// ---------------------------------------------------------------- dice

const FACE = ['', '#f1e7d0', '#1b1714', '#a3261a', '#1f3f9a'], PIP = ['', '#2a1c10', '#f4f0e6', '#f6ecd8', '#f6ecd8'];
const SPOTS = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
// Real dice: every face carries its own number, opposite faces add up to seven.
// Box faces come in the order +x, -x, +y, -y, +z, -z.
const ON_FACE = [2, 5, 1, 6, 3, 4];
const dieMats = {};
function dieMaterials(color) {
    if (dieMats[color]) return dieMats[color];
    return (dieMats[color] = ON_FACE.map((n) => {
        const tex = canvasTexture(128, 128, (x) => {
            x.fillStyle = FACE[color]; x.fillRect(0, 0, 128, 128);
            x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 5; x.strokeRect(2, 2, 124, 124);
            x.fillStyle = PIP[color];
            for (const [px, py] of SPOTS[n]) { x.beginPath(); x.arc(64 + px * 31, 64 + py * 31, n === 1 ? 17 : 12.5, 0, 7); x.fill(); }
        });
        return new THREE.MeshPhysicalMaterial({ map: tex, roughness: color === BLACK ? 0.2 : 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, });
    }));
}
// how a die must be turned for the number n to lie on top
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const TURN = [null, [X, 0], [Z, Math.PI / 2], [X, -Math.PI / 2], [X, Math.PI / 2], [Z, -Math.PI / 2], [X, Math.PI]];
function topUp(n, yaw, out = new THREE.Quaternion()) {
    out.setFromAxisAngle(Y, yaw * Math.PI / 2);
    return out.multiply(new THREE.Quaternion().setFromAxisAngle(TURN[n][0], TURN[n][1]));
}
let dieGeo = null;
function makeDie(color, n) {
    const m = new THREE.Mesh(dieGeo || (dieGeo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), dieMaterials(color));
    m.castShadow = m.receiveShadow = true; m.userData.color = color;
    m.userData.yaw = Math.floor(Math.random() * 4);
    topUp(n, m.userData.yaw, m.quaternion);
    return m;
}
// where the defeated dice of a colour lie: in two of the 2 x 2 hollows the plinth of the statue covers
export function trayPos(L, color, k, out = new THREE.Vector3()) {
    const two = L.nPlayers === 2;
    const base = two ? 0 : color === WHITE || color === BLUE ? 0 : 10;         // which floor
    const rows = (two ? color === WHITE : color === WHITE || color === RED) ? [3, 4] : [6, 7]; // far or near pair of hollows
    const cols = [3, 4, 6, 7], r = base + rows[(k >> 2) % 2], c = cols[k % 4];
    return out.set(c - (L.cols - 1) / 2, HALF + 0.005, r - (L.rows - 1) / 2);
}

// ---------------------------------------------------------------- Zeus

// Zeus after the printed figure: all in gold, bearded, bare-chested with the robe over one shoulder and his lap,
// enthroned on a high-backed seat that stands on a plinth as wide as the middle five fields. Built facing +z.
function buildZeus(gold) {
    const g = new THREE.Group();
    const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), gold); s.position.set(x, y, z); s.scale.set(sx, sy, sz); g.add(s); return s; };
    const limb = (r, len, x, y, z, rx = 0, rz = 0) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), gold); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); g.add(c); return c; };
    // the plinth: foot, die, cornice
    g.add(box(4.96, 0.3, 4.96, gold, 0, 0, 0), box(4.7, 0.16, 4.7, gold, 0, 0.3, 0), box(4.4, 1.9, 4.4, gold, 0, 0.46, 0), box(4.7, 0.14, 4.7, gold, 0, 2.36, 0), box(4.9, 0.2, 4.9, gold, 0, 2.5, 0));
    const P = 2.7;
    // the throne: a block of a seat, arms, a tall back with a rounded head
    g.add(box(2.7, 1.5, 2.5, gold, 0, P, 0.1), box(2.9, 0.14, 2.7, gold, 0, P + 1.5, 0.1));
    g.add(box(3.1, 5.3, 0.42, gold, 0, P, -1.25));
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.42, 20, 1, false, 0, Math.PI), gold); crest.rotation.set(Math.PI / 2, Math.PI / 2, 0); crest.position.set(0, P + 5.3, -1.25); crest.scale.y = 1; g.add(crest);
    for (const sx of [-1, 1]) g.add(box(0.36, 0.95, 2.3, gold, sx * 1.37, P + 1.64, 0.0), box(0.46, 0.12, 2.4, gold, sx * 1.37, P + 2.59, 0.0));
    const S = P + 1.64; // top of the seat
    // lap and legs under the robe, the left knee a little forward
    limb(0.36, 1.0, -0.42, S + 0.36, 0.55, Math.PI / 2); limb(0.36, 1.0, 0.42, S + 0.36, 0.45, Math.PI / 2);
    g.add(box(1.75, 0.5, 1.5, gold, 0, S + 0.05, 0.5));
    limb(0.25, 1.15, -0.42, S - 0.72, 1.42, 0.08); limb(0.25, 1.15, 0.42, S - 0.72, 1.28, 0.02);
    const fall = box(1.5, 1.5, 0.3, gold, 0.05, S - 1.25, 1.15); fall.rotation.x = -0.1; g.add(fall);    // the robe hanging between the knees
    g.add(box(0.4, 0.2, 0.75, gold, -0.42, P + 0.02, 1.6), box(0.4, 0.2, 0.75, gold, 0.42, P + 0.02, 1.48)); // feet
    g.add(box(1.7, 0.2, 0.9, gold, 0, P - 0.0, 1.75).translateY(-0.02));                                      // footrest
    // the body: belly, a broad chest, shoulders
    limb(0.62, 0.7, 0, S + 1.15, -0.35);
    ball(0.8, 0, S + 2.0, -0.3, 1.12, 0.82, 0.78);
    ball(0.36, -0.3, S + 2.08, 0.18, 1, 0.8, 0.7); ball(0.36, 0.3, S + 2.08, 0.18, 1, 0.8, 0.7);         // the chest
    ball(0.42, -0.98, S + 2.3, -0.3); ball(0.42, 0.98, S + 2.3, -0.3);
    const drape = box(0.85, 2.3, 0.34, gold, 0.5, S + 0.8, 0.12); drape.rotation.z = 0.52; g.add(drape);     // the robe over his left shoulder
    ball(0.5, 0.95, S + 2.42, -0.25, 1, 0.75, 1.05);
    // arms: the right forearm rests along the arm of the throne, the left hand on his knee
    limb(0.25, 0.8, -1.12, S + 1.62, -0.25, 0.25); limb(0.21, 0.95, -1.22, S + 1.2, 0.5, Math.PI / 2); ball(0.24, -1.22, S + 1.2, 1.12);
    limb(0.25, 0.8, 1.12, S + 1.62, -0.2, 0.3); limb(0.21, 0.8, 0.9, S + 1.02, 0.55, Math.PI / 2 - 0.35, 0); ball(0.24, 0.72, S + 0.82, 1.0);
    // neck, head, the long hair and the great beard
    limb(0.3, 0.3, 0, S + 2.85, -0.3);
    ball(0.56, 0, S + 3.55, -0.25, 0.95, 1.08, 1);
    ball(0.6, 0, S + 3.6, -0.48, 1.05, 1.05, 0.9); ball(0.34, -0.5, S + 3.0, -0.4, 0.8, 1.5, 0.9); ball(0.34, 0.5, S + 3.0, -0.4, 0.8, 1.5, 0.9);
    ball(0.42, 0, S + 3.12, 0.12, 0.95, 1.25, 0.75); ball(0.2, 0, S + 3.42, 0.3, 1.5, 0.5, 0.6);              // beard and moustache
    ball(0.09, 0, S + 3.58, 0.3, 0.9, 1.5, 1); g.add(box(0.5, 0.08, 0.14, gold, 0, S + 3.72, 0.2));        // nose and brow
    return g;
}

// ---------------------------------------------------------------- the floor and the throne
// Returns { group, statue, statueMats, L }. `statue` holds everything of Zeus above the feet of the throne.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), m = materials(), group = new THREE.Group();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // the board as it was printed: one golden slab, the fields scored into it, a meander running round its edge
    const gold = std({ color: 0xd8b55c, roughness: 0.5, metalness: 0.45 });
    const marble = m.marble.clone(); marble.color.set(0xefe9dc); marble.roughness = 0.5;
    const hw = L.cols / 2 + 1.1, hd = L.rows / 2 + 2.9;
    for (let i = 1; i < 3; i++) group.add(box((hw + i * 0.42) * 2, 0.3, (hd + i * 0.42) * 2, marble, 0, -0.3 * (i + 1), 0));
    const key = canvasTexture(256, 64, (x) => {
        x.fillStyle = '#b08a3a'; x.fillRect(0, 0, 256, 64);
        x.strokeStyle = '#f0d488'; x.lineWidth = 5; x.lineJoin = 'miter';
        for (let i = 0; i < 4; i++) { const o = i * 64; x.beginPath(); x.moveTo(o, 54); x.lineTo(o, 10); x.lineTo(o + 52, 10); x.lineTo(o + 52, 44); x.lineTo(o + 20, 44); x.lineTo(o + 20, 26); x.lineTo(o + 36, 26); x.stroke(); x.beginPath(); x.moveTo(o, 54); x.lineTo(o + 64, 54); x.stroke(); }
    });
    key.wrapS = THREE.RepeatWrapping;
    const keyMat = std({ map: key, roughness: 0.5, metalness: 0.4 });
    group.add(box(hw * 2, 0.3, hd * 2, gold, 0, -0.3, 0));
    for (const [w, dd, x, z] of [[hw * 2 + 0.02, 0.02, 0, hd], [hw * 2 + 0.02, 0.02, 0, -hd], [0.02, hd * 2 + 0.02, hw, 0], [0.02, hd * 2 + 0.02, -hw, 0]]) {
        const band = box(w, 0.26, dd, keyMat, x, -0.28, z), uv = band.geometry.attributes.uv, k = Math.max(w, dd) / 1.04;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
        band.userData.keep = true; group.add(band);
    }
    group.add(box(L.cols + 0.3, 0.03, L.rows + 0.3, std({ color: 0x5a4416, roughness: 0.7, metalness: 0.4 }), 0, 0, 0)); // the scored lines between the fields

    // the fields; with four players every quarter carries a hint of its colour
    const tiles = [], tint = [0, 0xf4efe2, 0x2c2a2a, 0xb8483a, 0x3d5fb8];
    for (let i = 0; i < L.N; i++) {
        if (L.hole[i]) continue;
        const r = Math.floor(i / L.cols), c = i % L.cols;
        const col = new THREE.Color((r + c) % 2 === 0 ? 0xe2c06a : 0xd4b05a);
        if (nPlayers === 4) {
            if (r === 10) col.set(0x8f6f2c);
            else for (let p = 1; p <= 4; p++) if (L.home[p][i]) col.lerp(new THREE.Color(tint[p]), 0.2);
        }
        tiles.push({ x: c - (L.cols - 1) / 2, y: TILE / 2, z: r - (L.rows - 1) / 2, color: col });
    }
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, TILE, 0.95), std({ roughness: 0.55, metalness: 0.35 }), tiles.length);
    const d = new THREE.Object3D();
    tiles.forEach((t, i) => { d.position.set(t.x, t.y, t.z); d.updateMatrix(); tm.setMatrixAt(i, d.matrix); tm.setColorAt(i, t.color); });
    tm.receiveShadow = true; tm.userData.keep = true; group.add(tm);

    // Under the plinth of the statue the floor has four hollows, 2 x 2 fields each, lined with dark cloth:
    // once Zeus is lifted away the defeated dice are laid in them.
    const cloth = std({ color: 0x16131c, roughness: 1 });
    const sm = { gold: std({ color: 0xd6b052, roughness: 0.42, metalness: 0.7 }) };
    const statue = new THREE.Group();
    for (const z of thrones(L)) {
        for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) { const tray = box(1.95, 0.02, 1.95, cloth, sx, 0.005, z + sz); tray.userData.keep = true; tray.receiveShadow = true; group.add(tray); }
        const zeus = buildZeus(sm.gold); zeus.position.set(0, TILE, z); statue.add(zeus);
    }
    shadowed(group); shadowed(statue);
    mergeByMaterial(group, (o) => o.userData.keep);
    mergeByMaterial(statue);
    group.add(statue);

    if (mini) { // table miniature: all dice still in reserve
        const plain = [0, 1, 2, 3, 4].map((c) => (c ? std({ color: FACE[c], roughness: 0.4 }) : null)), geo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2);
        for (const c of turnOrder(nPlayers)) for (let k = 0; k < DICE; k++) { const s = new THREE.Mesh(geo, plain[c]); reservePos(L, c, k, s.position); s.position.y += HALF; s.castShadow = true; group.add(s); }
    }
    return { group, statue, statueMats: Object.values(sm), L };
}

// ---------------------------------------------------------------- the world

export class StatueWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0; this.flash = 0;
        this.ambience = 'grove';
        this.veil = 0xe9e2c8;
        this.nPlayers = 0;
        this.dice = new Map();          // field -> mesh
        this.reserve = [null, [], [], [], []];
        this.lost = [0, 0, 0, 0, 0];
        this.indicators = [];
        const m = materials();
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xcfd8cc, 0.004);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 110, left: -14, right: 14, top: 14, bottom: -14 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x90a060, 0.6); scene.add(this.hemi);

        // the Altis: grass between the Alpheios and the hill of Kronos
        const grass = canvasTexture(512, 512, (x, W, H) => {
            x.fillStyle = '#7f9552'; x.fillRect(0, 0, W, H);
            let s = 9;
            const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
            for (let i = 0; i < 1000; i++) {
                x.fillStyle = ['rgba(95,125,60,0.35)', 'rgba(150,160,90,0.3)', 'rgba(80,110,55,0.3)', 'rgba(170,165,105,0.22)'][i % 4];
                x.beginPath(); x.ellipse(r() * W, r() * H, 6 + r() * 34, 4 + r() * 18, r() * 3, 0, 7); x.fill();
            }
        });
        grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(16, 16);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), std({ map: grass, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; scene.add(ground);
        const pave = paveMaps(), pm = pave.map.clone(), pn = pave.normalMap.clone();
        pm.repeat.set(8, 12); pn.repeat.set(8, 12); pm.needsUpdate = pn.needsUpdate = true;
        const paveMat = std({ map: pm, normalMap: pn, roughness: 0.9, color: 0xe6dcc4 });
        const court = box(30, 0.08, 44, paveMat, 0, GROUND, 0); court.receiveShadow = true; scene.add(court);

        // the temple of Zeus behind the throne: Doric, heavy, its gable hung with golden shields
        const sanct = new THREE.Group(); scene.add(sanct);
        const lime = m.sandstone.clone(); lime.color.set(0xe4dcc8);
        const roof = m.terracotta, tz = -38;
        for (let i = 0; i < 3; i++) sanct.add(box(19 + i * 1.2, 0.5, 34 + i * 1.2, lime, 0, GROUND + (2 - i) * 0.5, tz));
        const base = GROUND + 1.5, colH = 7;
        sanct.add(box(12, colH, 24, lime, 0, base, tz - 1));
        sanct.add(box(18.4, 1.3, 33.4, lime, 0, base + colH, tz), box(18.6, 0.35, 33.6, std({ color: 0x2a4f8f, roughness: 0.6 }), 0, base + colH + 0.85, tz));
        const gable = new THREE.Shape(); gable.moveTo(-9.6, 0); gable.lineTo(9.6, 0); gable.lineTo(0, 3.4); gable.closePath();
        const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 34, bevelEnabled: false }), roof); rf.position.set(0, base + colH + 1.3, tz - 17); sanct.add(rf);
        const face = new THREE.Mesh(new THREE.ShapeGeometry(gable), lime); face.scale.set(0.96, 0.9, 1); face.position.set(0, base + colH + 1.32, tz + 17.02); sanct.add(face);
        for (let i = -2; i <= 2; i++) { const sh = cyl(0.55, 0.55, 0.1, m.gold, i * 2.6, base + colH + 0.35, tz + 16.9, 14); sh.rotation.x = Math.PI / 2; sh.position.y = base + colH + 0.65; sanct.add(sh); }
        const dcols = [];
        for (let i = 0; i < 6; i++) for (const z of [tz + 16, tz - 16]) dcols.push({ x: -8.2 + i * 3.28, y: base + colH / 2, z });
        for (let j = 1; j < 12; j++) for (const x of [-8.2, 8.2]) dcols.push({ x, y: base + colH / 2, z: tz - 16 + j * 2.667 });
        const dc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.72, 0.95, colH, 12), lime, dcols.length), dd = new THREE.Object3D();
        dcols.forEach((c, i) => { dd.position.set(c.x, c.y, c.z); dd.updateMatrix(); dc.setMatrixAt(i, dd.matrix); });
        dc.castShadow = dc.receiveShadow = true; scene.add(dc);
        // the ash altar, statues of the victors along the way, the row of treasuries under the hill
        sanct.add(cyl(1.2, 3.4, 3.2, std({ color: 0x8d8880, roughness: 1 }), 15, GROUND, -14, 14), cyl(4, 4.2, 0.6, lime, 15, GROUND, -14, 18));
        this.altar = new THREE.Vector3(15, GROUND + 3.9, -14);
        for (let i = 0; i < 8; i++) {
            const x = (i % 2 ? 1 : -1) * 11.5, z = 22 - (i >> 1) * 7.5;
            sanct.add(box(1.1, 1.3, 1.1, lime, x, GROUND, z), cyl(0.2, 0.3, 1.5, m.bronze, x, GROUND + 1.3, z, 8));
            const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), m.bronze); hd.position.set(x, GROUND + 3.0, z); sanct.add(hd);
        }
        for (let i = 0; i < 9; i++) {
            const x = 26 + i * 6.2, z = -52;
            sanct.add(box(4.6, 3.6, 6, lime, x, GROUND + 1.4, z), box(5, 0.5, 6.4, roof, x, GROUND + 5, z), box(5.2, 1.4, 7, lime, x, GROUND, z));
        }
        // the stadium: a long track between banked earth
        const earth = std({ color: 0xb6a070, roughness: 1 }), bank = std({ color: 0x86995a, roughness: 1 });
        sanct.add(box(18, 0.1, 110, earth, 62, GROUND, 6));
        for (const sx of [-1, 1]) { const b = box(9, 3, 116, bank, 62 + sx * 13, GROUND, 6); b.rotation.z = sx * 0.2; sanct.add(b); }
        mergeByMaterial(shadowed(sanct));
        // hill of Kronos and the far ridges; olives and pines in the grove
        let hs = 53;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, flat = std({ roughness: 1, flatShading: true });
        const hills = [{ x: -10, y: GROUND - 4, z: -120, sx: 70, sy: 46, sz: 55, color: new THREE.Color().setHSL(0.27, 0.32, 0.3, sRGB) }];
        for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.28, dist = 240 + hr() * 120; hills.push({ x: Math.sin(a) * dist, y: GROUND - 3, z: Math.cos(a) * dist, sx: 60 + hr() * 70, sy: 22 + hr() * 50, sz: 60 + hr() * 70, ry: hr() * 6, color: new THREE.Color().setHSL(0.22 + hr() * 0.08, 0.25, 0.38 + hr() * 0.12, sRGB) }); }
        const trees = [], trunks = [];
        for (let i = 0; i < 150; i++) {
            const a = hr() * 6.28, dist = 20 + hr() * 110, x = Math.sin(a) * dist, z = Math.cos(a) * dist;
            if (Math.abs(x) < 15 && Math.abs(z) < 24) continue;
            if (Math.abs(x) < 12 && z < -18 && z > -58) continue;
            if (x > 48 && x < 80 && Math.abs(z - 6) < 62) continue;
            const pine = i % 4 === 0, s = pine ? 1.5 + hr() : 1.7 + hr() * 1.4;
            trunks.push({ x, y: GROUND + 0.9, z, sx: 0.18, sy: 1.8, sz: 0.18 });
            trees.push({ x, y: GROUND + 1.8 + s * (pine ? 1.4 : 0.5), z, sx: s, sy: s * (pine ? 2.8 : 0.75), sz: s, ry: hr() * 6, color: new THREE.Color().setHSL(pine ? 0.33 : 0.24 + hr() * 0.05, pine ? 0.4 : 0.24, pine ? 0.16 + hr() * 0.05 : 0.33 + hr() * 0.1, sRGB) });
        }
        const inst = (geo, mat, list, cast) => {
            const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
            list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(0, t.ry || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (t.color) im.setColorAt(i, t.color); });
            im.castShadow = cast; scene.add(im);
        };
        inst(new THREE.IcosahedronGeometry(1, 1), flat, hills, false);
        inst(new THREE.IcosahedronGeometry(1, 0), flat, trees, true);
        inst(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks, false);
        const river = new THREE.Mesh(new THREE.PlaneGeometry(1400, 34), this.riverMat = new THREE.MeshPhysicalMaterial({ color: 0x3f7f8c, roughness: 0.15, clearcoat: 1 }));
        river.rotation.x = -Math.PI / 2; river.position.set(0, GROUND + 0.04, 150); scene.add(river);

        // the eagles of Zeus, high over the grove
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, 0, 0, -0.26, 1.3, 0, -0.05], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0x241a12, side: THREE.DoubleSide });
        for (let i = 0; i < 3; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 18 + i * 9, h: 22 + i * 5, sp: (0.09 + i * 0.02) * (i % 2 ? 1 : -1), ph: i * 2.1 };
            b.scale.setScalar(1.6); scene.add(b); this.birds.push(b);
        }
        this.nextCall = 10;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.props = new THREE.Group(); scene.add(this.props);
        this.diceGroup = new THREE.Group(); scene.add(this.diceGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        this.flames = [];
        // an unseen sheet over the floor catches the pointer between the dice
        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.sheet.rotation.x = -Math.PI / 2; this.sheet.position.y = TILE; scene.add(this.sheet);

        this.puffs = new Particles(160, { color: 0xe8e2d4 }); this.puffs.drag = 1.8; this.puffs.gravity = 0.2;
        this.sparks = new Particles(260, { color: 0xdfe8ff, additive: true }); this.sparks.drag = 1.0; this.sparks.gravity = -0.4;
        this.smoke = new Particles(60, { color: 0xbdb8b0 }); this.smoke.drag = 0.3; this.smoke.gravity = -0.25;
        scene.add(this.puffs.points, this.sparks.points, this.smoke.points);
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear(); this.props.clear(); this.flames.length = 0;
            const { group, statue, statueMats, L } = buildBoard(state.nPlayers);
            this.L = L; this.statue = statue; this.statueMats = statueMats; this.boardGroup.add(group);
            this.sheet.scale.set(L.cols, L.rows, 1);
            const hw = L.cols / 2 + 0.6, hd = L.rows / 2 + 2.4;
            [[-hw, hd, 1], [hw, hd, 1], [-hw, -hd, 0], [hw, -hd, 1]].forEach(([x, z, lit]) => this.addTripod(x, z, lit));
            const r = hd + 5;
            Object.assign(this.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); this.key.shadow.camera.updateProjectionMatrix();
            this.shown = true;
        }
        this.sync(state);
        this.clearIndicators();
    }

    addTripod(x, z, lit) {
        const m = materials(), g = new THREE.Group();
        g.add(cyl(0.05, 0.16, 1.0, m.bronze, 0, 0, 0, 6), cyl(0.3, 0.1, 0.16, m.bronze, 0, 1.0, 0, 12));
        shadowed(g, true, false);
        const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
        const flame = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), fm(0xff6a18, 0.75)); outer.scale.set(1, 1.9, 1); outer.position.y = 0.22;
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fm(0xffe08a, 0.95)); inner.scale.set(1, 1.7, 1); inner.position.y = 0.15;
        flame.add(outer, inner); flame.position.y = 1.16; g.add(flame);
        let light = null;
        if (lit) { light = new THREE.PointLight(0xff9a4c, 0, 18, 1.8); light.position.y = 1.7; g.add(light); }
        g.position.set(x, 0, z); this.props.add(g);
        this.flames.push({ flame, light, ph: Math.random() * 10 });
    }

    // Zeus sits over the floor while the visitor arrives, and is lifted out of the way for the game.
    reveal(on, animated = true) {
        if (!this.statue || this.shown === on) return;
        this.shown = on;
        const set = (k) => {
            for (const mat of this.statueMats) { mat.transparent = k < 1; mat.opacity = k; mat.depthWrite = k > 0.5; }
            this.statue.visible = k > 0.01; this.statue.position.y = (1 - k) * 1.2;
            this.statue.traverse((o) => { if (o.isMesh) o.castShadow = k > 0.5; });
        };
        if (!animated) { set(on ? 1 : 0); return; }
        this.tweens.run(1.5, (k) => { if (this.shown === on) set(on ? ease.inOut(k) : 1 - ease.inOut(k)); }, on ? 0 : 0.5);
    }

    homeView(n = this.nPlayers) {
        return n === 2 ? { pos: new THREE.Vector3(-4.6, 12.2, 14.4), target: new THREE.Vector3(0, 0.6, 0.9) }
            : { pos: new THREE.Vector3(-8.4, 21, 22.5), target: new THREE.Vector3(0, 0.6, 1.6) };
    }
    cameraLimits() { const k = this.nPlayers === 2 ? 1 : 1.6; return { min: 7 * k, max: 40 * k }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(55);
        this.key.color.copy(d.keyColor); this.keyPower = d.keyPower * 0.95; this.key.intensity = this.keyPower;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x90a060).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemiPower = d.ambient * 1.4; this.hemi.intensity = this.hemiPower;
        const haze = new THREE.Color(0xcfd8cc).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(d.night ? 0x05060a : 0x241a12);
        for (const b of this.birds) b.visible = !d.night;
        this.riverMat.color.copy(d.skyTop).lerp(new THREE.Color(0x3f7f8c), 0.5).multiplyScalar(d.night ? 0.5 : 1);
        const dim = d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2);
        this.smoke.material.uniforms.uColor.value.set(0xbdb8b0).multiplyScalar(dim);
        this.puffs.material.uniforms.uColor.value.set(0xe8e2d4).multiplyScalar(dim);
    }

    // ------------------------------------------------------------ dice & indicators

    sync(state) {
        this.diceGroup.clear(); this.dice.clear();
        const L = this.L;
        for (let i = 0; i < state.grid.length; i++) {
            const v = state.grid[i]; if (!v) continue;
            const s = makeDie(owner(v), pips(v)); cellPos(L, i, s.position); s.userData.cell = i;
            this.diceGroup.add(s); this.dice.set(i, s);
        }
        for (const c of turnOrder(state.nPlayers)) {
            // the dice a colour has lost lie in its hollows (a colour that is out of a four-player game has lost them all)
            const lost = DICE - state.reserve[c] - [...this.dice.values()].filter((d) => d.userData.color === c).length;
            this.lost[c] = lost;
            for (let k = 0; k < lost; k++) { const s = makeDie(c, 1 + (k * 5 + c) % 6); trayPos(L, c, k, s.position); this.diceGroup.add(s); }
            this.reserve[c] = [];
            for (let k = 0; k < state.reserve[c]; k++) { const s = makeDie(c, 1); reservePos(L, c, k, s.position); s.position.y += HALF; this.diceGroup.add(s); this.reserve[c].push(s); }
        }
    }

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        if (this.lifted) { this.lifted.position.y = DIE_Y; this.lifted = null; }
    }

    mark(geo, color, cell, y = 0.012) {
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5;
        cellPos(this.L, cell, mesh.position).y = TILE + y; mesh.userData.ph = Math.random() * 3;
        this.indicatorGroup.add(mesh); this.indicators.push(mesh);
        return mesh;
    }

    // the die in hand and the fields it may step to next
    showSelection(cell, steps) {
        this.clearIndicators();
        const die = this.dice.get(cell);
        if (die) this.lifted = die;
        this.mark(new THREE.RingGeometry(0.47, 0.53, 4, 1, Math.PI / 4), 0xffd070, cell).userData.still = true;
        for (const st of steps) {
            const color = st.capture ? 0xff5a30 : 0xfff3c0;
            this.mark(new THREE.PlaneGeometry(0.9, 0.9), color, st.to, 0.006).userData.wash = true;
            if (!st.capture) this.mark(new THREE.RingGeometry(0.14, 0.23, 28), color, st.to);
        }
    }

    // dice the player has to choose among (a forced move, or whom to force)
    showChoices(cells, color = 0xffb040) {
        this.clearIndicators();
        for (const c of cells) this.mark(new THREE.RingGeometry(0.47, 0.55, 4, 1, Math.PI / 4), color, c);
    }

    // what is under the pointer: a field or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.dice.values(), this.sheet], false);
        if (!hits.length) return -1;
        const o = hits[0].object;
        if (o !== this.sheet) return o.userData.cell;
        const L = this.L, p = hits[0].point, c = Math.round(p.x + (L.cols - 1) / 2), r = Math.round(p.z + (L.rows - 1) / 2);
        if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
        return L.hole[r * L.cols + c] ? -1 : r * L.cols + c;
    }

    // ------------------------------------------------------------ move playback

    // travel = false when the steps of a stride were already shown one by one
    async play(events, state, travel = true) {
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'step') { if (travel) await this.playStep(ev); }
            else if (ev.type === 'place') await this.playPlace(ev);
            else if (ev.type === 'value') await this.playValue(ev);
            else if (ev.type === 'out') await this.playOut(ev);
        }
        this.sync(state);
    }

    // a die glides one field on with a small hop; whatever it lands on is struck from the floor
    playStep(ev) {
        const L = this.L, die = this.dice.get(ev.from);
        if (!die) return Promise.resolve();
        if (this.lifted === die) this.lifted = null;
        const a = cellPos(L, ev.from), b = cellPos(L, ev.to);
        const victim = ev.capture ? this.dice.get(ev.to) : null;
        this.dice.delete(ev.from); this.dice.set(ev.to, die); die.userData.cell = ev.to;
        let hit = false;
        sfx('roll');
        return this.tweens.run(0.26, (k) => {
            die.position.lerpVectors(a, b, ease.inOut(k)); die.position.y = DIE_Y + Math.sin(Math.PI * k) * 0.14;
            if (victim && !hit && k > 0.5) { hit = true; this.take(victim); }
            if (k === 1) die.position.copy(b);
        });
    }

    // a defeated die is struck by a pale flash and carried to the hollow where its colour's losses lie
    take(die) {
        sfx('strike');
        const c = die.userData.color, a = die.position.clone(), b = trayPos(this.L, c, this.lost[c]++);
        this.flash = 1;
        this.sparks.burst(a, 9, { speed: 0.7, up: 0.9, size: 0.26, alpha: 0.9, life: 0.7, spread: 0.3 });
        this.puffs.burst(a, 6, { speed: 0.5, up: 0.3, size: 0.5, alpha: 0.3, life: 0.9, spread: 0.3 });
        delete die.userData.cell;
        const dist = a.distanceTo(b);
        this.tweens.run(0.5 + dist * 0.03, (k) => {
            die.position.lerpVectors(a, b, ease.inOut(k)); die.position.y += Math.sin(Math.PI * k) * (1 + dist * 0.1);
        }, 0.12);
    }

    playPlace(ev) {
        const L = this.L, die = this.reserve[ev.color].pop() || makeDie(ev.color, 1);
        if (!die.parent) this.diceGroup.add(die);
        const a = die.position.clone(), b = cellPos(L, ev.to), dist = a.distanceTo(b);
        this.dice.set(ev.to, die); die.userData.cell = ev.to;
        sfx('pickup');
        return this.tweens.run(0.42 + dist * 0.03, (k) => {
            die.position.lerpVectors(a, b, ease.inOut(k)); die.position.y += Math.sin(Math.PI * k) * (1.2 + dist * 0.12);
            if (k === 1) sfx('place');
        });
    }

    // Zeus changes the die: it rises in a crackle of pale light, spins too fast to follow, and comes down
    // showing its new number. Diminished, it dips instead and the light is dimmer.
    playValue(ev) {
        const die = this.dice.get(ev.at);
        if (!die) return Promise.resolve();
        sfx(ev.diminish ? 'diminish' : 'charge');
        const yaw = die.userData.yaw = (die.userData.yaw + 1) % 4, goal = topUp(ev.pips, yaw), spin = new THREE.Quaternion();
        const axis = new THREE.Vector3(0.5 + Math.random() * 0.5, 1, 0.4 + Math.random() * 0.5).normalize(), p = new THREE.Vector3();
        const halo = this.halo || (this.halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10),
            new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
        this.scene.add(halo);
        if (!ev.diminish) this.flash = Math.max(this.flash, 0.35);
        return this.tweens.run(ev.diminish ? 0.55 : 0.6, (k) => {
            const w = Math.sin(Math.PI * k), left = 1 - ease.out(k);
            die.position.y = DIE_Y + w * (ev.diminish ? -0.0 : 0.42) + (ev.diminish ? 0 : 0);
            die.scale.setScalar(ev.diminish ? 1 - w * 0.2 : 1);
            die.quaternion.copy(goal).multiply(spin.setFromAxisAngle(axis, left * Math.PI * (ev.diminish ? 4 : 8)));
            halo.position.copy(die.position); halo.material.opacity = w * (ev.diminish ? 0.18 : 0.42); halo.scale.setScalar(0.8 + w * 0.35);
            if (!ev.diminish && k < 0.75 && Math.random() < 0.6) { p.copy(die.position); this.sparks.emit(p.x + (Math.random() - 0.5) * 0.5, p.y + (Math.random() - 0.5) * 0.4, p.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2, 0.35, 0.16, 0.9); }
            if (k === 1) { die.quaternion.copy(goal); die.position.y = DIE_Y; die.scale.setScalar(1); this.scene.remove(halo); }
        });
    }

    playOut(ev) {
        const list = ev.cells.map((c) => this.dice.get(c)).filter(Boolean).concat(this.reserve[ev.color]);
        for (const c of ev.cells) this.dice.delete(c);
        this.reserve[ev.color] = [];
        sfx('defeat');
        return this.tweens.run(0.9, (k) => { for (const d of list) { d.scale.setScalar(Math.max(0.001, 1 - k)); d.position.y -= 0.004; } });
    }

    celebrate(color) {
        for (const die of this.dice.values()) {
            if (die.userData.color !== color) continue;
            const q = die.position.clone();
            this.tweens.run(0.1, () => {}, Math.random() * 1.6).then(() => this.sparks.burst(q, 10, { speed: 0.7, up: 1.8, size: 0.4, alpha: 1, life: 1.5 }));
        }
        this.flash = 1.4; sfx('strike');
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, 0);

        if (this.lifted) this.lifted.position.y = DIE_Y + 0.12 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.still) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.material.opacity = o.userData.wash ? 0.26 + w * 0.1 : 0.7 + w * 0.3;
        }
        // the flash of a capture: Zeus is watching
        if (this.flash > 0.01) {
            this.flash *= Math.exp(-dt * 7);
            this.hemi.intensity = (this.hemiPower || 0.8) + this.flash * 1.6;
        } else if (this.flash) { this.flash = 0; this.hemi.intensity = this.hemiPower || 0.8; }

        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.5, -8 + Math.sin(a) * u.r);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const flap = Math.sin(t * 2.2 + u.ph) > 0.6 ? Math.sin(t * 6) * 0.5 : 0.1;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : Math.random() < 0.6 ? 'cicada' : 'falcon'); this.nextCall = 7 + Math.random() * 13; }
        }
        if (Math.random() < dt * 4) this.smoke.emit(this.altar.x + (Math.random() - 0.5) * 0.6, this.altar.y, this.altar.z, 0.3 + Math.random() * 0.2, 0.6, (Math.random() - 0.5) * 0.15, 8, 2 + Math.random() * 2, 0.22);
        this.smoke.update(dt); this.puffs.update(dt); this.sparks.update(dt);

        const lamps = this.day ? this.day.lamps : 0;
        for (const f of this.flames) {
            const fl = 0.8 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.flame.visible = lamps > 0.05;
            f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
            if (f.light) f.light.intensity = lamps * 12 * fl;
        }
    }
}
