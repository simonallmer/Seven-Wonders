// CATHEDRAL — the world: St Peter's Basilica on its square, the engraved floor as the board, stones,
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

    // St Peter's: travertine walls in a giant order of pilasters, attic and cornice, apses on three arms,
    // Maderno's front at the near end, Michelangelo's dome on its drum of paired columns over the crossing.
    // All of it stands while the visitor arrives and is lifted away for the game. Its materials are its own.
    const rm = { stone: new THREE.MeshStandardMaterial({ color: 0xe6d9bf, roughness: 0.85 }), slate: new THREE.MeshStandardMaterial({ color: 0x8a96a0, roughness: 0.55, metalness: 0.35 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 0.85 }), glass: new THREE.MeshBasicMaterial({ color: 0xffffff }), gold: m.gold.clone(),
        pale: new THREE.MeshStandardMaterial({ color: 0xf2e9d6, roughness: 0.8 }) };
    const up = new THREE.Group(), pil = [], panes = [], heads = [], recess = [], cols = [], figs = [];
    const ORDER = WALL_H - 0.9, ATTIC = WALL_H + 0.5;            // top of the pilasters; top of the attic
    const arch = new THREE.Shape(); arch.moveTo(-0.5, 0); arch.lineTo(0.5, 0); arch.lineTo(0.5, 0.62); arch.absarc(0, 0.62, 0.5, 0, Math.PI, false); arch.closePath();
    const archGeo = new THREE.ShapeGeometry(arch, 8); archGeo.translate(0, -0.56, 0);
    const amber = new THREE.Color(0xe8cf98);
    // one wall run in the giant order: pilasters, windows with pediments, entablature, attic
    const order = (x0, z0, len, ux, uz, nx, nz, door) => {
        const ry = Math.atan2(nx, nz), bays = Math.max(2, Math.round(len / 1.25));
        for (let k = 0; k <= bays; k++) {
            const t = k / bays * len, px = x0 + ux * t + nx * 0.24, pz = z0 + uz * t + nz * 0.24;
            pil.push({ x: px, y: 0.3 + (ORDER - 0.3) / 2, z: pz, ry, sx: 0.34, sy: ORDER - 0.3, sz: 0.1 });
            pil.push({ x: px, y: ORDER + 0.64 + (ATTIC - ORDER - 0.64) / 2, z: pz, ry, sx: 0.3, sy: ATTIC - ORDER - 0.64, sz: 0.06 }); // the attic pilasters
        }
        for (let k = 0; k < bays; k++) {
            const t = (k + 0.5) / bays * len, wx = x0 + ux * t + nx * 0.215, wz = z0 + uz * t + nz * 0.215;
            if (door && Math.abs(t - (DOOR - WALL)) < 0.7) continue;
            panes.push({ x: wx, y: 3.4, z: wz, ry, sx: 0.62, sy: 1.9, color: amber });
            heads.push({ x: wx + nx * 0.04, y: 4.55, z: wz + nz * 0.04, ry, sx: 0.9, sy: 0.12, sz: 0.1 });       // pediment over it
            panes.push({ x: wx, y: 5.55, z: wz, ry, sx: 0.5, sy: 0.6, color: amber });
            recess.push({ x: wx + nx * 0.02, y: ORDER + 0.93, z: wz + nz * 0.02, ry, sx: 0.36, sy: 0.24, sz: 0.04 }); // attic window
        }
        const cx = x0 + ux * len / 2, cz = z0 + uz * len / 2, along = Math.abs(ux) > 0.5, L2 = len + 0.7;
        up.add(box(along ? L2 : 0.62, 0.5, along ? 0.62 : L2, rm.stone, cx, ORDER, cz));            // entablature
        up.add(box(along ? L2 + 0.2 : 0.78, 0.14, along ? 0.78 : L2 + 0.2, rm.pale, cx, ORDER + 0.5, cz)); // cornice
        up.add(box(along ? L2 : 0.46, ATTIC - ORDER - 0.64, along ? 0.46 : L2, rm.stone, cx, ORDER + 0.64, cz)); // attic
        up.add(box(along ? L2 + 0.1 : 0.56, 0.1, along ? 0.56 : L2 + 0.1, rm.pale, cx, ATTIC, cz));
    };
    for (const [x0, z0, x1, z1, door] of runs) {
        const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, alongX = Math.abs(ux) > 0.5;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        up.add(box(alongX ? len + 0.4 : 0.4, ORDER - 0.3, alongX ? 0.4 : len + 0.4, rm.stone, cx, 0.3, cz));
        const nx = alongX ? 0 : Math.sign(cx), nz = alongX ? Math.sign(cz) : 0;
        if (!door && cz > 0 && alongX) continue; // the front wall hides behind Maderno's facade
        order(x0, z0, len, ux, uz, nx, nz, door);
        if (door) up.add(box(alongX ? 0.9 : 0.44, 2.1, alongX ? 0.44 : 0.9, rm.dark, x0 + ux * (DOOR - WALL), 0.3, z0 + uz * (DOOR - WALL)));
    }
    // low roofs of lead over the arms, half hidden behind the attics
    const tri = new THREE.Shape(); tri.moveTo(-3.0, 0); tri.lineTo(3.0, 0); tri.lineTo(0, 1.1); tri.closePath();
    const gable = (rot) => { const r = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 15.5, bevelEnabled: false }), rm.slate); r.position.set(rot ? -7.75 : 0, ATTIC - 0.4, rot ? 0 : -7.75); r.rotation.y = rot ? Math.PI / 2 : 0; return r; };
    up.add(gable(false), gable(true));
    // the apses that close three arms: half drums in the same order, with half domes of lead
    for (const [ax, az] of [[0, -1], [-1, 0], [1, 0]]) {
        const ox = ax * END, oz = az * END, base = Math.atan2(ax, az), R = 2.95, H = ORDER - GROUND;
        const half = (r, h, mat, y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, false, base - Math.PI / 2, Math.PI), mat); c.position.set(ox, y + h / 2, oz); up.add(c); };
        half(R, H, rm.stone, GROUND); half(R + 0.18, 0.5, rm.stone, ORDER); half(R + 0.26, 0.14, rm.pale, ORDER + 0.5); half(R - 0.05, ATTIC - ORDER - 0.64, rm.stone, ORDER + 0.64);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(R - 0.1, 20, 8, base - Math.PI / 2, Math.PI, 0, Math.PI / 2), rm.slate); cap.scale.y = 0.24; cap.position.set(ox, ATTIC, oz); up.add(cap);
        for (let k = 0; k <= 6; k++) {
            const a = base - Math.PI / 2 + k / 6 * Math.PI, px = ox + Math.sin(a) * (R + 0.06), pz = oz + Math.cos(a) * (R + 0.06);
            pil.push({ x: px, y: GROUND + H / 2, z: pz, ry: a, sx: 0.34, sy: H, sz: 0.12 });
            if (k < 6) {
                const b = a + Math.PI / 12, wx = ox + Math.sin(b) * (R + 0.01), wz = oz + Math.cos(b) * (R + 0.01);
                panes.push({ x: wx, y: 3.4, z: wz, ry: b, sx: 0.6, sy: 1.9, color: amber }, { x: wx, y: 5.55, z: wz, ry: b, sx: 0.48, sy: 0.6, color: amber });
                heads.push({ x: ox + Math.sin(b) * (R + 0.05), y: 4.55, z: oz + Math.cos(b) * (R + 0.05), ry: b, sx: 0.84, sy: 0.12, sz: 0.1 });
            }
        }
    }
    // Michelangelo's dome: podium, drum ringed by paired columns, attic, the raised dome with its ribs, the lantern
    let y = ATTIC - 0.1;
    up.add(cyl(3.0, 3.0, 0.7, rm.stone, 0, y, 0, 32)); y += 0.7;
    const DR = 2.55, DH = 2.3;
    up.add(cyl(DR, DR, DH, rm.stone, 0, y, 0, 32));
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), t = [-s, c];
        for (const off of [-0.2, 0.2]) cols.push({ x: c * (DR + 0.32) + t[0] * off, y: y + DH / 2, z: s * (DR + 0.32) + t[1] * off, sx: 0.11, sy: DH, sz: 0.11 });
        pil.push({ x: c * (DR + 0.12), y: y + DH / 2, z: s * (DR + 0.12), ry: Math.PI / 2 - a, sx: 0.62, sy: DH, sz: 0.24 }); // the buttress behind the pair
        const b = a + Math.PI / 16, wx = Math.cos(b) * (DR + 0.01), wz = Math.sin(b) * (DR + 0.01);
        panes.push({ x: wx, y: y + DH * 0.48, z: wz, ry: Math.PI / 2 - b, sx: 0.46, sy: 1.25, color: amber });
        heads.push({ x: Math.cos(b) * (DR + 0.05), y: y + DH * 0.48 + 0.78, z: Math.sin(b) * (DR + 0.05), ry: Math.PI / 2 - b, sx: 0.62, sy: 0.1, sz: 0.1 });
    }
    y += DH;
    up.add(cyl(DR + 0.5, DR + 0.5, 0.3, rm.stone, 0, y, 0, 32), cyl(DR + 0.56, DR + 0.56, 0.1, rm.pale, 0, y + 0.3, 0, 32)); y += 0.4;
    up.add(cyl(DR + 0.05, DR + 0.15, 0.55, rm.stone, 0, y, 0, 32)); y += 0.55;
    const DOME_R = DR + 0.05, DOME_H = 3.5, prof = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.5, DOME_R * Math.cos(t)), DOME_H * Math.sin(t))); }
    const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), rm.slate); dome.position.y = y; up.add(dome);
    for (let k = 0; k < 16; k++) { // the ribs, in pale stone
        const a = k / 16 * Math.PI * 2, pts = prof.slice(0, 16).map((p) => new THREE.Vector3(Math.cos(a) * (p.x + 0.05), y + p.y + 0.02, Math.sin(a) * (p.x + 0.05)));
        up.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07, 4), rm.pale));
    }
    for (let row = 0; row < 3; row++) for (let k = 0; k < 16; k++) { // three rows of small lucarnes between the ribs
        const t = (0.22 + row * 0.22) * Math.PI / 2, a = (k + 0.5) / 16 * Math.PI * 2, r = DOME_R * Math.cos(t) + 0.03;
        heads.push({ x: Math.cos(a) * r, y: y + DOME_H * Math.sin(t), z: Math.sin(a) * r, ry: Math.PI / 2 - a, sx: 0.2 - row * 0.04, sy: 0.16 - row * 0.03, sz: 0.08 });
    }
    y += DOME_H - 0.05;
    up.add(cyl(0.62, 0.62, 0.14, rm.pale, 0, y, 0, 16)); y += 0.14;
    up.add(cyl(0.48, 0.48, 1.0, rm.stone, 0, y, 0, 16));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cols.push({ x: Math.cos(a) * 0.58, y: y + 0.5, z: Math.sin(a) * 0.58, sx: 0.08, sy: 1.0, sz: 0.08 }); }
    y += 1.0;
    up.add(cyl(0.66, 0.66, 0.12, rm.pale, 0, y, 0, 16)); y += 0.12;
    const lantern = new THREE.Mesh(new THREE.LatheGeometry([[0.55, 0], [0.5, 0.2], [0.3, 0.5], [0.1, 0.72], [0.06, 0.8]].map(([a, b]) => new THREE.Vector2(a, b)), 16), rm.slate); lantern.position.y = y; up.add(lantern);
    y += 0.8;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), rm.gold); ball.position.y = y + 0.15; up.add(ball);
    up.add(box(0.06, 0.62, 0.06, rm.gold, 0, y + 0.3, 0), box(0.34, 0.06, 0.06, rm.gold, 0, y + 0.7, 0));
    // the two minor cupolas that flank the dome, over the side arms
    for (const sx of [-1, 1]) {
        const cx = sx * 5.1; let cy = ATTIC - 0.2;
        up.add(cyl(0.85, 0.85, 0.75, rm.stone, cx, cy, 0, 16)); cy += 0.75;
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cols.push({ x: cx + Math.cos(a) * 0.92, y: cy - 0.37, z: Math.sin(a) * 0.92, sx: 0.07, sy: 0.75, sz: 0.07 }); }
        up.add(cyl(0.98, 0.98, 0.1, rm.pale, cx, cy, 0, 16)); cy += 0.1;
        const p2 = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI / 2; p2.push(new THREE.Vector2(Math.max(0.16, 0.86 * Math.cos(t)), 1.15 * Math.sin(t))); }
        const d2 = new THREE.Mesh(new THREE.LatheGeometry(p2, 20), rm.slate); d2.position.set(cx, cy, 0); up.add(d2);
        up.add(cyl(0.16, 0.18, 0.36, rm.stone, cx, cy + 1.1, 0, 10), cyl(0.02, 0.1, 0.3, rm.slate, cx, cy + 1.46, 0, 8), box(0.03, 0.22, 0.03, rm.gold, cx, cy + 1.74, 0));
    }
    // Maderno's front at the near end: giant columns, five doors, the loggia of the blessings, a pediment,
    // the attic with Christ and the apostles, the clocks at either end, and the steps
    const FZ = END + 0.2, FW = 9.4, FH = ORDER - GROUND;
    up.add(box(FW, FH, 1.0, rm.stone, 0, GROUND, FZ + 0.1));
    for (let i = 0; i < 3; i++) up.add(box(FW + 0.8 - i * 0.3, 0.14, 1.9 - i * 0.35, rm.pale, 0, GROUND + i * 0.14, FZ + 1.05 - i * 0.12));
    const colX = [-4.25, -3.15, -1.9, -0.65, 0.65, 1.9, 3.15, 4.25];
    for (const cx of colX) {
        const big = Math.abs(cx) < 2.5;
        if (big) cols.push({ x: cx, y: GROUND + 0.42 + (FH - 0.42) / 2, z: FZ + 0.82, sx: 0.36, sy: FH - 0.42, sz: 0.36 });
        else pil.push({ x: cx, y: GROUND + 0.42 + (FH - 0.42) / 2, z: FZ + 0.66, ry: 0, sx: 0.38, sy: FH - 0.42, sz: 0.12 });
        heads.push({ x: cx, y: ORDER - 0.12, z: FZ + 0.8, ry: 0, sx: 0.5, sy: 0.18, sz: 0.5 }); // capitals
    }
    for (let k = 0; k < colX.length - 1; k++) {
        const bx = (colX[k] + colX[k + 1]) / 2, w = (colX[k + 1] - colX[k]) * 0.5, mid = k === 3;
        recess.push({ x: bx, y: GROUND + 1.25 + (mid ? 0.1 : 0), z: FZ + 0.62, ry: 0, sx: w, sy: 1.6 + (mid ? 0.2 : 0), sz: 0.06 });   // the doors
        panes.push({ x: bx, y: 3.35, z: FZ + 0.61, ry: 0, sx: w * 0.82, sy: mid ? 1.5 : 1.1, color: amber });                       // the loggia windows
        heads.push({ x: bx, y: mid ? 4.25 : 4.05, z: FZ + 0.66, ry: 0, sx: w * 1.2, sy: 0.12, sz: 0.1 });
        panes.push({ x: bx, y: 5.5, z: FZ + 0.61, ry: 0, sx: w * 0.6, sy: 0.55, color: amber });
    }
    up.add(box(1.0, 0.12, 0.5, rm.pale, 0, 2.55, FZ + 0.75)); // the balcony of the blessings
    up.add(box(FW + 0.3, 0.55, 1.35, rm.stone, 0, ORDER, FZ + 0.25), box(FW + 0.5, 0.16, 1.5, rm.pale, 0, ORDER + 0.55, FZ + 0.25));
    const ped = new THREE.Shape(); ped.moveTo(-1.85, 0); ped.lineTo(1.85, 0); ped.lineTo(0, 0.85); ped.closePath();
    const pedM = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.3, bevelEnabled: false }), rm.pale); pedM.position.set(0, ORDER + 0.7, FZ + 0.7); up.add(pedM);
    up.add(box(FW, ATTIC - ORDER - 0.71, 0.8, rm.stone, 0, ORDER + 0.71, FZ + 0.1), box(FW + 0.15, 0.1, 0.9, rm.pale, 0, ATTIC, FZ + 0.1));
    for (let k = 0; k < 13; k++) figs.push({ x: -3.6 + k * 0.6, y: ATTIC + 0.4, z: FZ + 0.3, sx: 0.11, sy: 0.26, sz: 0.11 }); // Christ, John the Baptist and the apostles
    for (const sx of [-1, 1]) { // the clocks
        up.add(box(1.0, 1.1, 0.9, rm.stone, sx * 4.25, ATTIC, FZ + 0.1));
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), rm.pale); face.position.set(sx * 4.25, ATTIC + 0.58, FZ + 0.56); up.add(face);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 20), rm.gold); ring.position.set(sx * 4.25, ATTIC + 0.58, FZ + 0.57); up.add(ring);
        up.add(cyl(0.18, 0.3, 0.45, rm.slate, sx * 4.25, ATTIC + 1.1, FZ + 0.1, 10));
    }
    const glass = instanced(archGeo, rm.glass, panes); glass.castShadow = glass.receiveShadow = false; up.add(glass);
    up.add(instanced(new THREE.BoxGeometry(1, 1, 1), rm.stone, pil), instanced(new THREE.BoxGeometry(1, 1, 1), rm.pale, heads), instanced(new THREE.BoxGeometry(1, 1, 1), rm.dark, recess));
    up.add(instanced(new THREE.CylinderGeometry(0.5, 0.56, 1, 10), rm.pale, cols), instanced(new THREE.CapsuleGeometry(0.5, 1.2, 2, 6), rm.pale, figs));
    shadowed(up);
    mergeByMaterial(up, (o) => o.isInstancedMesh);
    group.add(up);
    const lift = new Lift(up, Object.values(rm), 4);
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

    // The basilica stands while the visitor arrives, and is lifted away for the game.
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
