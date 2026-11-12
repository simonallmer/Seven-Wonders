// TEMPLE — the world: the Artemision at Ephesus, its marble floor as the board, stones, effects and move animations.
import * as THREE from 'three';
import { layout, createState, DIRS } from './rules.js';
import { Tweens, Particles, Lift, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { paveMaps, canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { makeStone } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -0.9;   // the temple court; the floor of the temple (y = 0) stands three steps above it
export const FAITH = 200;     // pick ids from here on are Leaps of Faith: FAITH + direction
const COL_H = 3.3;

export function cellPos(L, i, out = new THREE.Vector3()) {
    const c = L.cells[i];
    return out.set(c.col - (L.W - 1) / 2, 0, c.row - (L.H - 1) / 2);
}
// where a stone lands after a Leap of Faith: one field past the stone it leapt over
function offPos(L, over, dir, out = new THREE.Vector3()) {
    cellPos(L, over, out);
    out.x += DIRS[dir][1]; out.z += DIRS[dir][0];
    return out;
}

// the plan of the temple for a board: where the colonnades stand
function plan(L) {
    const two = L.nPlayers === 2;
    return two ? { cx: 3.3, zn: -6.0, zs: 5.2, hx: 4.0, zf: 6.3, zb: -6.9, gap: 0, statueZ: -5.45 }
        : { cx: 6.5, zn: -6.5, zs: 6.5, hx: 7.3, zf: 7.3, zb: -7.6, gap: 1.5, statueZ: -6.6 };
}

// ---------------------------------------------------------------- materials and textures

let TM = null;
function templeMaterials() {
    if (TM) return TM;
    const m = materials();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const marble = m.marble.clone(); marble.color.set(0xf4efe4); marble.roughness = 0.45;
    const warm = m.marble.clone(); warm.color.set(0xe6dcc6); warm.roughness = 0.6;
    TM = {
        marble, warm,
        blue: std({ color: 0x2a4f8f, roughness: 0.6 }), red: std({ color: 0x9a2f24, roughness: 0.6 }),
        cedar: std({ color: 0x4a3222, roughness: 0.7 }), cypress: std({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    };
    return TM;
}

// The floor: veined marble, a meander border, the paths inlaid in bronze and a field at every crossing.
function floorTexture(L) {
    const px = L.nPlayers === 2 ? 128 : 100, m = 0.9;
    const W = Math.round((L.W - 1 + 2 * m) * px), H = Math.round((L.H - 1 + 2 * m) * px);
    const tex = canvasTexture(W, H, (x) => {
        x.fillStyle = '#ece5d6'; x.fillRect(0, 0, W, H);
        let s = 11;
        const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < 90; i++) { // veins
            x.strokeStyle = `rgba(${120 + r() * 40},${115 + r() * 30},${110 + r() * 30},${0.05 + r() * 0.1})`; x.lineWidth = 1 + r() * 3;
            let vx = r() * W, vy = r() * H; x.beginPath(); x.moveTo(vx, vy);
            for (let k = 0; k < 6; k++) { vx += (r() - 0.3) * 160; vy += (r() - 0.5) * 120; x.lineTo(vx, vy); }
            x.stroke();
        }
        const X = (i) => (L.cells[i].col + m) * px, Y = (i) => (L.cells[i].row + m) * px;
        // meander band around the edge
        x.strokeStyle = '#7f6338'; x.lineWidth = 3;
        const b = px * 0.2; x.strokeRect(b, b, W - 2 * b, H - 2 * b); x.strokeRect(b + 14, b + 14, W - 2 * b - 28, H - 2 * b - 28);
        x.lineWidth = 2;
        for (let t = b + 7; t < W - b - 7; t += 14) for (const yy of [b, H - b - 14]) { x.strokeRect(t - 3, yy + 4, 6, 6); }
        for (let t = b + 7; t < H - b - 7; t += 14) for (const xx of [b, W - b - 14]) { x.strokeRect(xx + 4, t - 3, 6, 6); }
        // paths
        x.strokeStyle = '#8a6a3a'; x.lineWidth = px * 0.045; x.lineCap = 'round';
        for (let i = 0; i < L.N; i++) for (let d = 1; d <= 4; d++) {
            const j = L.step[i * 8 + d]; if (j < 0) continue;
            x.beginPath(); x.moveTo(X(i), Y(i)); x.lineTo(X(j), Y(j)); x.stroke();
        }
        // fields
        const tips = Object.values(L.tip);
        for (let i = 0; i < L.N; i++) {
            const tip = tips.includes(i), R = px * (tip ? 0.4 : 0.3);
            x.fillStyle = tip ? '#d9ae4e' : '#f6f1e6'; x.beginPath(); x.arc(X(i), Y(i), R, 0, 7); x.fill();
            x.strokeStyle = tip ? '#7a5a1e' : '#8a6a3a'; x.lineWidth = px * 0.03; x.stroke();
            if (tip) { // Artemis: the crescent moon
                x.fillStyle = '#fbf3da'; x.beginPath(); x.arc(X(i), Y(i), R * 0.62, 0, 7); x.fill();
                x.fillStyle = '#d9ae4e'; x.beginPath(); x.arc(X(i) + R * 0.22, Y(i) - R * 0.12, R * 0.52, 0, 7); x.fill();
            } else if ((L.cells[i].row + L.cells[i].col) % 2 === 0) { x.fillStyle = 'rgba(138,106,58,0.5)'; x.beginPath(); x.arc(X(i), Y(i), px * 0.05, 0, 7); x.fill(); }
        }
    });
    return { tex, w: L.W - 1 + 2 * m, h: L.H - 1 + 2 * m };
}

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

// Artemis of Ephesus: a stiff, tapering figure with outstretched forearms and a tall crown
function buildArtemis() {
    const m = materials(), g = new THREE.Group();
    g.add(box(1.0, 0.5, 1.0, templeMaterials().warm, 0, 0, 0));
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0.2, 0], [0.24, 0.08], [0.2, 0.2], [0.24, 0.9], [0.3, 1.25], [0.27, 1.5], [0.13, 1.62]].map(([r, y]) => new THREE.Vector2(r, y)), 14), m.gold);
    body.position.y = 0.5; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), m.bronze); head.position.y = 2.25; g.add(head);
    g.add(cyl(0.16, 0.13, 0.26, m.gold, 0, 2.36, 0, 12));
    for (const sx of [-1, 1]) { const arm = box(0.09, 0.09, 0.42, m.bronze, sx * 0.3, 1.72, 0.2); arm.rotation.x = -0.25; g.add(arm); }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), m.gold); halo.position.set(0, 2.28, -0.1); g.add(halo);
    return g;
}

// ---------------------------------------------------------------- the temple
// Builds the temple with its floor. Returns { group, picks[] } — picks[i].userData.cell = field.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), P = plan(L), m = materials(), tm = templeMaterials();
    const group = new THREE.Group(), picks = [];
    const add = (o) => { group.add(o); return o; };
    const zc = (P.zf + P.zb) / 2, len = P.zf - P.zb;

    // the stepped platform
    for (let i = 0; i < 3; i++) add(box((P.hx + i * 0.42) * 2, 0.3, len + i * 0.84, i ? tm.warm : tm.marble, 0, -0.3 * (i + 1), zc));
    const fl = floorTexture(L);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fl.w, fl.h), new THREE.MeshStandardMaterial({ map: fl.tex, roughness: 0.38, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; floor.userData.keep = true; group.add(floor);

    // Ionic colonnades down both sides and across the far end; the near end stands open
    const cols = [];
    for (let z = P.zn; z <= P.zs + 0.01; z += (P.zs - P.zn) / Math.round((P.zs - P.zn) / 1.4)) if (Math.abs(z) >= P.gap) for (const sx of [-1, 1]) cols.push([sx * P.cx, z, 0]);
    const nx = Math.round(P.cx * 2 / 1.32);
    for (let i = 1; i < nx; i++) { const x = -P.cx + (i / nx) * P.cx * 2; if (Math.abs(x) > Math.max(P.gap, 1.2)) cols.push([x, P.zn, 1]); }
    const seg = mini ? 8 : 14;
    add(instanced(new THREE.CylinderGeometry(0.17, 0.2, COL_H - 0.3, seg), tm.marble, cols.map(([x, z]) => ({ x, y: 0.12 + (COL_H - 0.3) / 2, z }))));
    add(instanced(new THREE.CylinderGeometry(0.22, 0.27, 0.12, seg), tm.marble, cols.map(([x, z]) => ({ x, y: 0.06, z }))));
    add(instanced(new THREE.BoxGeometry(0.56, 0.1, 0.5), tm.marble, cols.map(([x, z, end]) => ({ x, y: COL_H - 0.08, z, ry: end ? 0 : Math.PI / 2 }))));
    const volutes = [];
    for (const [x, z, end] of cols) for (const s of [-1, 1]) volutes.push({ x: x + (end ? s * 0.25 : 0), y: COL_H - 0.16, z: z + (end ? 0 : s * 0.25), rx: Math.PI / 2, rz: end ? 0 : Math.PI / 2 });
    add(instanced(new THREE.CylinderGeometry(0.085, 0.085, 0.46, 10), tm.marble, volutes));
    // entablature: architrave, a painted frieze, cornice
    const beam = (w, d, x, z) => { add(box(w, 0.3, d, tm.marble, x, COL_H, z)); add(box(w + 0.02, 0.16, d + 0.02, tm.blue, x, COL_H + 0.3, z)); add(box(w + 0.14, 0.1, d + 0.14, tm.marble, x, COL_H + 0.46, z)); };
    const sideBeams = P.gap ? [[P.zn, -P.gap], [P.gap, P.zs]] : [[P.zn, P.zs]];
    for (const sx of [-1, 1]) for (const [a, b] of sideBeams) beam(0.56, b - a + 0.56, sx * P.cx, (a + b) / 2);
    beam(P.cx * 2 + 0.56, 0.56, 0, P.zn);
    // the pediment over the far end, with its gilded acroteria
    const tri = new THREE.Shape(); tri.moveTo(-P.cx - 0.35, 0); tri.lineTo(P.cx + 0.35, 0); tri.lineTo(0, P.cx * 0.36); tri.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }), tm.marble); ped.position.set(0, COL_H + 0.56, P.zn - 0.25); add(ped);
    const tymp = new THREE.Shape(); tymp.moveTo(-P.cx * 0.82, 0.12); tymp.lineTo(P.cx * 0.82, 0.12); tymp.lineTo(0, P.cx * 0.3); tymp.closePath();
    const ty = new THREE.Mesh(new THREE.ShapeGeometry(tymp), tm.red); ty.position.set(0, COL_H + 0.56, P.zn + 0.26); add(ty);
    add(cyl(0, 0.14, 0.4, m.gold, 0, COL_H + 0.56 + P.cx * 0.36, P.zn, 4));
    for (const sx of [-1, 1]) add(cyl(0, 0.11, 0.3, m.gold, sx * (P.cx + 0.2), COL_H + 0.56, P.zn, 4));

    const artemis = buildArtemis(); artemis.position.set(0, 0, P.statueZ); add(artemis);
    // the way up: a broad flight at the open end
    for (let i = 0; i < 3; i++) add(box(P.hx * 1.1, 0.3 * (3 - i) - 0.15, 0.42, tm.warm, 0, GROUND, P.zf + 1.26 + 0.2 + i * 0.4 - 0.4));

    shadowed(group);
    ty.castShadow = false;
    mergeByMaterial(group, (o) => o.userData.keep);

    // unseen discs over the fields, for the pointer
    const disc = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 10), ghost = new THREE.MeshBasicMaterial({ visible: false });
    for (let i = 0; i < L.N; i++) { const p = new THREE.Mesh(disc, ghost); cellPos(L, i, p.position); p.userData.cell = i; group.add(p); picks.push(p); }

    if (mini) { // table miniature: the stones in their starting places
        const st = createState(nPlayers);
        for (let i = 0; i < L.N; i++) if (st.grid[i]) { const s = makeStone(st.grid[i], true); cellPos(L, i, s.position); group.add(s); }
    }
    // The roof, and the columns and gable of the near end that carry it: the temple is whole while the visitor
    // arrives, and this part is lifted away for the game. Its materials are its own, so that it can fade.
    const rm = { marble: tm.marble.clone(), tile: m.terracotta.clone(), red: tm.red.clone(), gold: m.gold.clone(), blue: tm.blue.clone() };
    rm.tile.color.set(0xc9a27c);
    const roof = new THREE.Group(), rh = P.cx * 0.36, ry = COL_H + 0.56, zs = P.zs;
    const slope = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: zs - P.zn + 0.2, bevelEnabled: false }), rm.tile); slope.position.set(0, ry + 0.02, P.zn + 0.26); roof.add(slope);
    for (let i = 0; i <= nx; i++) { // the columns of the front
        const x = -P.cx + (i / nx) * P.cx * 2;
        if (i > 0 && i < nx) roof.add(cyl(0.17, 0.2, COL_H - 0.3, rm.marble, x, 0.12, zs, seg), cyl(0.22, 0.27, 0.12, rm.marble, x, 0, zs, seg));
        if (i > 0 && i < nx) roof.add(box(0.56, 0.1, 0.5, rm.marble, x, COL_H - 0.13, zs));
    }
    roof.add(box(P.cx * 2 + 0.56, 0.3, 0.56, rm.marble, 0, COL_H, zs), box(P.cx * 2 + 0.58, 0.16, 0.58, rm.blue, 0, COL_H + 0.3, zs), box(P.cx * 2 + 0.7, 0.1, 0.7, rm.marble, 0, COL_H + 0.46, zs));
    if (P.gap) for (const sx of [-1, 1]) roof.add(box(0.56, 0.3, P.gap * 2, rm.marble, sx * P.cx, COL_H, 0), box(0.58, 0.16, P.gap * 2, rm.blue, sx * P.cx, COL_H + 0.3, 0));
    const fped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }), rm.marble); fped.position.set(0, ry, zs - 0.25); roof.add(fped);
    const fty = new THREE.Mesh(new THREE.ShapeGeometry(tymp), rm.red); fty.position.set(0, ry, zs + 0.26); roof.add(fty);
    roof.add(cyl(0, 0.14, 0.4, rm.gold, 0, ry + rh, zs, 4));
    for (const sx of [-1, 1]) roof.add(cyl(0, 0.11, 0.3, rm.gold, sx * (P.cx + 0.2), ry, zs, 4));
    shadowed(roof); fty.castShadow = false;
    mergeByMaterial(roof);
    group.add(roof);
    const lift = new Lift(roof, Object.values(rm), 3);
    return { group, picks, plan: P, L, lift };
}

// ---------------------------------------------------------------- the world

export class TempleWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'coast';
        this.veil = 0xf0e8d8;
        this.nPlayers = 0;
        this.stones = new Map();
        this.indicators = [];
        const m = materials(), tm = templeMaterials();

        scene.fog = new THREE.FogExp2(0xd4dde0, 0.0042);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 90, left: -11, right: 11, top: 11, bottom: -11 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0xa8a070, 0.6); scene.add(this.hemi);

        // the plain of the Cayster: meadow and marsh
        const meadow = canvasTexture(512, 512, (x, W, H) => {
            x.fillStyle = '#8f9a5c'; x.fillRect(0, 0, W, H);
            let s = 5;
            const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
            for (let i = 0; i < 900; i++) {
                x.fillStyle = ['rgba(110,130,70,0.35)', 'rgba(160,160,100,0.3)', 'rgba(90,115,65,0.3)', 'rgba(175,165,115,0.25)'][i % 4];
                x.beginPath(); x.ellipse(r() * W, r() * H, 8 + r() * 40, 5 + r() * 22, r() * 3, 0, 7); x.fill();
            }
        });
        meadow.wrapS = meadow.wrapT = THREE.RepeatWrapping; meadow.repeat.set(14, 14);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: meadow, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; scene.add(ground);
        const pave = paveMaps(), pm = pave.map.clone(), pn = pave.normalMap.clone();
        pm.repeat.set(9, 12); pn.repeat.set(9, 12); pm.needsUpdate = pn.needsUpdate = true;
        const paveMat = new THREE.MeshStandardMaterial({ map: pm, normalMap: pn, roughness: 0.85, color: 0xf2ead8 });
        const court = box(36, 0.08, 48, paveMat, 0, GROUND, 5); court.receiveShadow = true; scene.add(court);

        // the great altar before the temple, the sacred way, votive columns
        const sacred = new THREE.Group(); scene.add(sacred);
        sacred.add(box(7, 0.5, 3.4, tm.warm, 0, GROUND, 20), box(6, 1.1, 0.5, tm.marble, 0, GROUND + 0.5, 21.4), box(0.5, 1.1, 2.6, tm.marble, -2.75, GROUND + 0.5, 20.1), box(0.5, 1.1, 2.6, tm.marble, 2.75, GROUND + 0.5, 20.1));
        sacred.add(box(1.6, 0.5, 1.0, tm.marble, 0, GROUND + 0.5, 20.2));
        sacred.add(box(5, 0.05, 60, paveMat, 0, GROUND + 0.02, 58));
        for (const [x, z, h] of [[-9, 12, 4], [9, 12, 4], [-11, 2, 3.2], [11, 2, 3.2]]) {
            sacred.add(cyl(0.3, 0.36, h, tm.marble, x, GROUND, z, 12), box(0.9, 0.16, 0.9, tm.marble, x, GROUND + h, z));
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), m.gold); orb.position.set(x, GROUND + h + 0.46, z); sacred.add(orb);
        }
        mergeByMaterial(shadowed(sacred));
        this.altar = new THREE.Vector3(0, GROUND + 1.05, 20.2);

        // the sea to the west, with the harbour road; hills to the east and north; Ephesus on its slope
        this.seaMat = new THREE.MeshPhysicalMaterial({ color: 0x2f6f8f, roughness: 0.14, metalness: 0.1, clearcoat: 1 });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 1400), this.seaMat);
        sea.rotation.x = -Math.PI / 2; sea.position.set(-520, GROUND + 0.05, 0); scene.add(sea);
        let hs = 31;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const hills = [], sRGB = THREE.SRGBColorSpace;
        for (let i = 0; i < 26; i++) {
            const a = -1.1 + (i / 25) * 3.6, d = 170 + hr() * 150, h = 26 + hr() * 60;
            hills.push({ x: Math.sin(a) * d + 30, y: GROUND - 2, z: -Math.cos(a) * d, sx: 55 + hr() * 60, sy: h, sz: 55 + hr() * 60, ry: hr() * 6, color: new THREE.Color().setHSL(0.2 + hr() * 0.07, 0.25, 0.4 + hr() * 0.12, sRGB) });
        }
        hills.push({ x: 120, y: GROUND - 2, z: 70, sx: 70, sy: 46, sz: 90, ry: 1, color: new THREE.Color().setHSL(0.19, 0.26, 0.46, sRGB) });
        const hm = instanced(new THREE.IcosahedronGeometry(1, 1), tm.cypress, hills); hm.castShadow = hm.receiveShadow = false; scene.add(hm);
        const houses = [], roofs = [];
        for (let i = 0; i < 150; i++) {
            const u = hr(), v = hr(), x = 62 + u * 80, z = 30 + v * 90, y = GROUND + Math.max(0, 30 - Math.hypot(x - 120, (z - 70) * 0.8) * 0.48) * 0.9;
            const w = 3 + hr() * 5, h = 2.5 + hr() * 3, dd = 3 + hr() * 5;
            houses.push({ x, y: y + h / 2, z, sx: w, sy: h, sz: dd, color: new THREE.Color().setHSL(0.1, 0.2, 0.78 + hr() * 0.12, sRGB) });
            roofs.push({ x, y: y + h + 0.25, z, sx: w + 0.5, sy: 0.5, sz: dd + 0.5 });
        }
        const unit = new THREE.BoxGeometry(1, 1, 1);
        const hmesh = instanced(unit, new THREE.MeshStandardMaterial({ roughness: 1 }), houses); hmesh.castShadow = hmesh.receiveShadow = false; scene.add(hmesh);
        const rmesh = instanced(unit, m.terracotta, roofs); rmesh.castShadow = rmesh.receiveShadow = false; scene.add(rmesh);
        // cypresses around the sanctuary, olive groves on the plain
        const cyp = [], olive = [], trunks = [];
        for (let i = 0; i < 46; i++) {
            const side = i % 2 ? 1 : -1, z = -22 + (i >> 1) * 2.6 + hr(), x = side * (20.5 + (i % 3) * 1.6), h = 5 + hr() * 3.5;
            cyp.push({ x, y: GROUND + h / 2, z, sx: 0.8 + hr() * 0.3, sy: h, sz: 0.8 + hr() * 0.3, color: new THREE.Color().setHSL(0.33, 0.35, 0.14 + hr() * 0.06, sRGB) });
        }
        for (let i = 0; i < 14; i++) { const x = -17 + i * 2.6, h = 5.5 + hr() * 3; cyp.push({ x, y: GROUND + h / 2, z: -24 - hr() * 2, sx: 0.9, sy: h, sz: 0.9, color: new THREE.Color().setHSL(0.33, 0.35, 0.15 + hr() * 0.05, sRGB) }); }
        for (let i = 0; i < 110; i++) {
            const a = hr() * 6.28, d = 34 + hr() * 110, x = Math.sin(a) * d, z = Math.cos(a) * d;
            if (x < -75 || (Math.abs(x) < 6 && z > 0)) continue;
            const s = 1.4 + hr() * 1.2;
            trunks.push({ x, y: GROUND + 0.7, z, sx: 0.16, sy: 1.4, sz: 0.16 });
            olive.push({ x, y: GROUND + 1.5 + s * 0.5, z, sx: s, sy: s * 0.7, sz: s, ry: hr() * 6, color: new THREE.Color().setHSL(0.24 + hr() * 0.05, 0.22, 0.34 + hr() * 0.1, sRGB) });
        }
        const cm = instanced(new THREE.ConeGeometry(1, 1, 7), tm.cypress, cyp); cm.receiveShadow = false; scene.add(cm);
        const om = instanced(new THREE.IcosahedronGeometry(1, 0), tm.cypress, olive); om.receiveShadow = false; scene.add(om);
        const tk = instanced(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks); tk.castShadow = tk.receiveShadow = false; scene.add(tk);

        // ships standing in to the harbour
        this.ships = [];
        const hull = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 }), sail = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1, side: THREE.DoubleSide });
        for (let i = 0; i < 3; i++) {
            const b = new THREE.Group();
            const h = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), hull); h.scale.set(1.3, 0.6, 5.5); b.add(h);
            b.add(cyl(0.08, 0.1, 5, hull, 0, 0.3, 0, 6));
            const sl = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3), sail); sl.position.set(0, 3.6, 0.1); b.add(sl);
            b.userData = { x: -110 - i * 34, z: -60 + i * 85, sp: 0.5 + i * 0.15 };
            scene.add(b); this.ships.push(b);
        }

        // swallows around the columns
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.55, 0, -0.12], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0x20242c, side: THREE.DoubleSide });
        for (let i = 0; i < 10; i++) {
            const b = new THREE.Group();
            const wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 8 + Math.random() * 12, h: 6 + Math.random() * 5, sp: (0.25 + Math.random() * 0.15) * (i % 2 ? 1 : -1), ph: Math.random() * 9, cx: (Math.random() - 0.5) * 8, cz: (Math.random() - 0.5) * 8 };
            b.scale.setScalar(0.5 + Math.random() * 0.2);
            scene.add(b); this.birds.push(b);
        }
        this.nextCall = 8;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.props = new THREE.Group(); scene.add(this.props);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        this.flames = [];

        this.puffs = new Particles(200, { color: 0xf2ece0 }); this.puffs.drag = 1.8; this.puffs.gravity = 0.2;
        this.sparks = new Particles(260, { color: 0xfff0c0, additive: true }); this.sparks.drag = 1.0; this.sparks.gravity = -0.5;
        this.smoke = new Particles(70, { color: 0xc8c4bc }); this.smoke.drag = 0.3; this.smoke.gravity = -0.25;
        scene.add(this.puffs.points, this.sparks.points, this.smoke.points);
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear(); this.props.clear(); this.flames.length = 0;
            const { group, picks, plan: P, L, lift } = buildBoard(state.nPlayers);
            this.lift = lift;
            this.L = L; this.P = P; this.picks = picks; this.boardGroup.add(group);
            // bronze tripods: two at the open end, two beside the goddess
            for (const [x, z, lit] of [[-P.hx + 0.6, P.zf - 0.6, 1], [P.hx - 0.6, P.zf - 0.6, 1], [-1.5, P.statueZ + 0.2, 0], [1.5, P.statueZ + 0.2, 1]]) this.addTripod(x, z, lit);
            const r = Math.max(P.hx, P.zf) + 4;
            Object.assign(this.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); this.key.shadow.camera.updateProjectionMatrix();
        }
        this.syncStones(state);
        this.clearIndicators();
    }

    addTripod(x, z, lit) {
        const m = materials(), g = new THREE.Group();
        for (let i = 0; i < 3; i++) { const leg = cyl(0.025, 0.035, 1.0, m.bronze, 0, 0, 0, 5); leg.position.set(Math.cos(i * 2.094) * 0.14, 0.5, Math.sin(i * 2.094) * 0.14); leg.rotation.set(Math.sin(i * 2.094) * 0.22, 0, -Math.cos(i * 2.094) * 0.22); g.add(leg); }
        g.add(cyl(0.3, 0.12, 0.16, m.bronze, 0, 0.98, 0, 12));
        shadowed(g, true, false);
        const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
        const flame = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), fm(0xff6a18, 0.75)); outer.scale.set(1, 1.9, 1); outer.position.y = 0.22;
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fm(0xffe08a, 0.95)); inner.scale.set(1, 1.7, 1); inner.position.y = 0.15;
        flame.add(outer, inner); flame.position.y = 1.14; g.add(flame);
        let light = null;
        if (lit) { light = new THREE.PointLight(0xff9a4c, 0, 16, 1.8); light.position.y = 1.6; g.add(light); }
        g.position.set(x, 0, z); this.props.add(g);
        this.flames.push({ flame, light, ph: Math.random() * 10 });
    }

    // The roof covers the temple while the visitor arrives, and is lifted away for the game.
    reveal(on, animated = true) { if (this.lift) this.lift.reveal(this.tweens, on, animated); }

    homeView(n = this.nPlayers) {
        const k = n === 2 ? 1 : 1.42;
        return { pos: new THREE.Vector3(-2.3 * k, 9.6 * k, 11.2 * k), target: new THREE.Vector3(0, 0, 0.25 * k) };
    }
    cameraLimits() { const k = this.nPlayers === 2 ? 1 : 1.42; return { min: 6 * k, max: 32 * k }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(45);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.92;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0xa8a070).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.35;
        const haze = new THREE.Color(0xd4dde0).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(d.night ? 0x05060a : 0x20242c);
        for (const b of this.birds) b.visible = !d.night;
        this.seaMat.color.copy(d.skyTop).lerp(new THREE.Color(0x2f6f8f), 0.5).multiplyScalar(d.night ? 0.5 : 1);
        const dim = d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2);
        this.smoke.material.uniforms.uColor.value.set(0xc8c4bc).multiplyScalar(dim);
        this.puffs.material.uniforms.uColor.value.set(0xf2ece0).multiplyScalar(dim);
    }

    // ------------------------------------------------------------ stones & indicators

    syncStones(state) {
        for (const [, mesh] of this.stones) this.stoneGroup.remove(mesh);
        this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) {
            if (!state.grid[i]) continue;
            const s = makeStone(state.grid[i]);
            cellPos(this.L, i, s.position); s.userData.cell = i;
            this.stoneGroup.add(s); this.stones.set(i, s);
        }
    }

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = 0; this.selected = null; }
    }

    // cell: the stone in hand; steps: what it may do next; canStop: a chain of leaps may end here
    showSelection(cell, steps, canStop = false) {
        this.clearIndicators();
        const L = this.L, stone = this.stones.get(cell);
        if (stone) this.selected = stone;
        const ring = (r0, r1, color) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; mesh.position.y = 0.02;
            return mesh;
        };
        const put = (o) => { this.indicatorGroup.add(o); this.indicators.push(o); return o; };
        const sel = put(ring(0.4, 0.47, canStop ? 0xfff3c0 : 0xffd070)); cellPos(L, cell, sel.position).y = 0.02; sel.userData.sel = !canStop; sel.userData.ph = 0;
        for (const st of steps) {
            const faith = st.type === 'faith';
            const o = put(ring(0.16, 0.27, faith ? 0xff4a2a : st.type === 'leap' ? (st.capture ? 0xff7a3a : 0x7fd8ff) : 0xffd070));
            if (faith) {
                offPos(L, st.over, st.dir, o.position).y = 0.35;
                // something for the pointer to hit, out past the edge of the floor
                const pad = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
                pad.position.copy(o.position); pad.userData.cell = FAITH + st.dir; pad.userData.pad = true; put(pad);
            } else cellPos(L, st.to, o.position).y = 0.02;
            o.userData.ph = Math.random() * 3;
            if (st.capture) { const x = put(ring(0.4, 0.47, 0xff4a2a)); cellPos(L, st.over, x.position).y = 0.02; x.userData.ph = o.userData.ph; }
        }
    }

    // what is under the pointer: a field, FAITH + direction, or -1
    pick(raycaster) {
        const pads = this.indicators.filter((o) => o.userData.pad);
        const hits = raycaster.intersectObjects([...pads, ...this.stoneGroup.children, ...this.picks], false);
        return hits.length ? hits[0].object.userData.cell : -1;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state, travel = true) {
        this.clearIndicators();
        if (travel) for (const ev of events) await this.playStep(ev);
        this.syncStones(state);
    }

    playStep(ev) {
        const L = this.L, stone = this.stones.get(ev.from);
        if (!stone) return Promise.resolve();
        if (this.selected === stone) this.selected = null;
        const a = cellPos(L, ev.from), faith = ev.type === 'faith';
        const b = faith ? offPos(L, ev.over, ev.dir) : cellPos(L, ev.to);
        const victim = ev.capture ? this.stones.get(ev.over) : null;
        this.stones.delete(ev.from);
        if (victim) this.stones.delete(ev.over);
        if (!faith) { this.stones.set(ev.to, stone); stone.userData.cell = ev.to; }
        const dist = Math.hypot(b.x - a.x, b.z - a.z);
        if (ev.type === 'walk') {
            sfx('slide', dist);
            return this.tweens.run(0.24 + dist * 0.08, (k) => { stone.position.lerpVectors(a, b, ease.inOut(k)); });
        }
        sfx('jump');
        let taken = false;
        const run = this.tweens.run(faith ? 0.62 : 0.46, (k) => {
            const e = faith ? k : ease.inOut(k);
            stone.position.lerpVectors(a, b, e);
            stone.position.y = Math.sin(Math.PI * Math.min(1, e)) * (faith ? 1.1 : 0.75);
            if (victim && !taken && k > 0.5) { taken = true; this.take(victim); }
            if (k === 1 && !faith) stone.position.copy(b);
        });
        if (!faith) return run;
        // the Leap of Faith: out over the edge of the floor and down among the steps
        return run.then(() => {
            sfx('fall');
            const out = b.clone().sub(a).setY(0).normalize();
            return this.tweens.run(0.7, (k) => {
                stone.position.set(b.x + out.x * k * 2.2, -k * k * 2.4, b.z + out.z * k * 2.2);
                stone.rotation.x = out.z * k * 5; stone.rotation.z = -out.x * k * 5;
                if (k === 1) { this.stoneGroup.remove(stone); this.puffs.burst(stone.position, 10, { speed: 0.8, up: 0.5, size: 0.7, alpha: 0.4 }); }
            });
        });
    }

    // a captured stone sinks away with a breath of marble dust
    take(stone) {
        sfx('take');
        const p = stone.position.clone();
        this.puffs.burst(p, 8, { speed: 0.5, up: 0.35, size: 0.5, alpha: 0.35, life: 0.9, spread: 0.3 });
        this.sparks.burst(new THREE.Vector3(p.x, 0.25, p.z), 5, { speed: 0.3, up: 0.5, size: 0.2, alpha: 0.7, life: 0.8 });
        this.tweens.run(0.4, (k) => { stone.scale.setScalar(Math.max(0.001, 1 - ease.in(k))); if (k === 1) this.stoneGroup.remove(stone); });
    }

    celebrate(cell) {
        const p = cellPos(this.L, cell); p.y = 0.5;
        for (let i = 0; i < 6; i++) this.tweens.run(0.1, () => {}, i * 0.32).then(() => this.sparks.burst(p, 18, { speed: 0.9, up: 2.2, size: 0.5, alpha: 1, life: 1.8 }));
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
            if (o.userData.sel || o.userData.pad) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.scale.set(1 + w * 0.1, 1 + w * 0.1, 1); o.material.opacity = 0.65 + w * 0.3;
        }

        for (const b of this.ships) {
            const u = b.userData;
            u.z += u.sp * dt; if (u.z > 300) u.z = -300;
            b.position.set(u.x, GROUND + 0.3 + Math.sin(t * 0.7 + u.x) * 0.08, u.z);
            b.rotation.z = Math.sin(t * 0.6 + u.x) * 0.04;
        }
        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 3.1) * 1.2, u.cz + Math.sin(a * 1.3) * u.r);
            b.rotation.y = Math.atan2(-Math.sin(a) * u.sp, Math.cos(a * 1.3) * 1.3 * u.sp) + Math.PI / 2;
            const flap = Math.sin(t * 14 + u.ph * 9) * 0.6;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : Math.random() < 0.5 ? 'cicada' : 'songbird'); this.nextCall = 6 + Math.random() * 12; }
        }
        // smoke rises from the altar
        if (Math.random() < dt * 5) this.smoke.emit(this.altar.x + (Math.random() - 0.5) * 0.5, this.altar.y, this.altar.z, 0.25 + Math.random() * 0.2, 0.5, (Math.random() - 0.5) * 0.15, 7, 1.6 + Math.random() * 1.6, 0.22);
        this.smoke.update(dt); this.puffs.update(dt); this.sparks.update(dt);

        const lamps = this.day ? this.day.lamps : 0;
        for (const f of this.flames) {
            const fl = 0.8 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.flame.visible = lamps > 0.05;
            f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
            if (f.light) f.light.intensity = lamps * 11 * fl;
        }
    }
}
