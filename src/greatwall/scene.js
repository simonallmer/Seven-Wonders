// GREAT WALL — the world: the wall along the mountain ridges, its walk as the board, warriors with shields,
// arrows, effects and move animations.
import * as THREE from 'three';
import { layout, owner, facing, DIRS } from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { stoneMaterials } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -7;     // the valley floor under the ridge; the walk of the wall is y = 0
export const FACE = 1000;     // pick ids from here on are the eight facings: FACE + direction
const TOP = 0.04;
const BANNER = [0, 0xf1e7d0, 0x1b1714, 0xa3261a, 0x1f3f9a];

export function cellPos(L, i, out = new THREE.Vector3()) {
    return out.set((i % L.cols) - (L.cols - 1) / 2, TOP, Math.floor(i / L.cols) - (L.rows - 1) / 2);
}
const turnOf = (d) => -d * Math.PI / 4; // a warrior modelled looking north, turned to face direction d

// ---------------------------------------------------------------- warriors

const templates = {};
// A warrior in the colour of his stone: robe, head and helmet, a spear held forward, and the great round
// shield on his back. A small bronze dart on the ground before him shows which way he faces.
function makeWarrior(color, low = false) {
    if (!templates[color]) {
        const m = materials(), body = stoneMaterials()[color], g = new THREE.Group(), seg = 12;
        const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.5, seg), body); robe.position.y = 0.25; g.add(robe);
        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, seg, 8), body); chest.position.y = 0.55; chest.scale.set(1, 0.9, 0.85); g.add(chest);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, seg, 8), body); head.position.y = 0.8; g.add(head);
        const helm = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.16, seg), m.bronze); helm.position.y = 0.94; g.add(helm);
        g.add(cyl(0.012, 0.012, 0.1, m.bronze, 0, 1.0, 0, 5));
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 18), m.bronze); shield.rotation.x = Math.PI / 2; shield.position.set(0, 0.5, 0.2); g.add(shield);
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), m.bronze); boss.position.set(0, 0.5, 0.24); boss.scale.z = 0.6; g.add(boss);
        const spear = cyl(0.014, 0.014, 0.95, m.bronze, 0, 0, 0, 5); spear.rotation.x = -1.15; spear.position.set(0.17, 0.52, -0.2); g.add(spear);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), m.bronze); tip.rotation.x = -1.15 - Math.PI * 0; tip.position.set(0.17, 0.74, -0.68); tip.rotation.x = -1.15; g.add(tip);
        const dart = new THREE.Shape(); dart.moveTo(0, -0.47); dart.lineTo(0.1, -0.33); dart.lineTo(-0.1, -0.33); dart.closePath();
        const dg = new THREE.ShapeGeometry(dart); dg.rotateX(Math.PI / 2); // points to -z, lying flat
        const dm = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0xffd070, side: THREE.DoubleSide })); dm.position.y = 0.012; dm.userData.keep = true; g.add(dm);
        shadowed(g); dm.castShadow = false;
        mergeByMaterial(g, (o) => o.userData.keep);
        templates[color] = g;
    }
    const w = templates[color].clone();
    w.userData.color = color;
    if (low) w.traverse((o) => { o.receiveShadow = false; });
    return w;
}

// ---------------------------------------------------------------- the wall

// a watchtower: battered block, gate, battlements, and a small hall with a tiled roof on top
function buildTower(mats, color) {
    const { brick, dark, roof, red } = mats, g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 4.2 - GROUND, 4), brick); b.rotation.y = Math.PI / 4; b.position.y = (4.2 + GROUND) / 2; b.scale.set(1, 1, 1.5); g.add(b);
    g.add(box(1.1, 1.5, 0.3, dark, 0, 0, 0), box(4.0, 0.3, 5.6, brick, 0, 4.2, 0));
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { g.add(box(0.36, 0.4, 0.3, brick, s * 1.82, 4.5, -2.4 + i * 0.8)); if (i < 5) g.add(box(0.3, 0.4, 0.36, brick, -1.4 + i * 0.7, 4.5, s * 2.62)); }
    g.add(box(2.2, 1.3, 3.4, red, 0, 4.5, 0));
    const hip = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 4), roof); hip.rotation.y = Math.PI / 4; hip.position.y = 6.35; hip.scale.set(1, 1, 1.45); g.add(hip);
    g.add(box(3.3, 0.12, 4.7, roof, 0, 5.8, 0));
    // the banner of the army whose Legendary Field lies below
    g.add(cyl(0.04, 0.05, 2.6, dark, 1.2, 4.5, 1.9, 6));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7, 6, 1), new THREE.MeshStandardMaterial({ color: BANNER[color], roughness: 0.9, side: THREE.DoubleSide }));
    flag.position.set(1.84, 6.7, 1.9); flag.userData.keep = true; flag.userData.flag = true; g.add(flag);
    return g;
}

// The stretch of wall that is the board, with a watchtower at every Legendary Field.
// Returns { group, L, flags[], reach } — reach is how far the whole extends from the middle.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), m = materials(), two = nPlayers === 2;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const group = new THREE.Group();
    const brick = m.limestone.clone(); brick.color.set(0x9a958a);
    const dark = std({ color: 0x2c2620, roughness: 0.9 }), roof = std({ color: 0x4a5258, roughness: 0.7 }), red = std({ color: 0x8a2a1e, roughness: 0.8 });
    const hx = (L.cols - 1) / 2, hz = (L.rows - 1) / 2;
    // the body of the wall, leaning in a little toward the top
    const body = (w, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, -GROUND, d), brick); b.position.y = GROUND / 2 - 0.01; group.add(b); group.add(box(w + 0.5, 0.5, d + 0.5, brick, 0, GROUND, 0)); };
    if (two) body(L.cols + 0.2, L.rows + 1.5); else { body(L.cols + 0.2, 6.5); body(6.5, L.rows + 0.2); }
    // parapets wherever the walk ends in thin air: taller on the far side, low toward the visitor
    const merlons = [];
    for (let i = 0; i < L.N; i++) {
        if (!L.on[i]) continue;
        const r = Math.floor(i / L.cols), c = i % L.cols, p = cellPos(L, i);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const rr = r + dr, cc = c + dc, inside = rr >= 0 && cc >= 0 && rr < L.rows && cc < L.cols;
            if (inside && L.on[rr * L.cols + cc]) continue;
            if (two ? dc !== 0 : !inside) continue; // the ends of the wall run into the towers
            const h = dr > 0 || dc !== 0 ? 0.32 : 0.62;
            group.add(box(dc ? 0.3 : 1, h, dc ? 1 : 0.3, brick, p.x + dc * 0.62, 0, p.z + dr * 0.62));
            if (dr < 0) for (const k of [-0.28, 0.28]) merlons.push({ x: p.x + k, y: h + 0.14, z: p.z - 0.62 });
        }
    }
    const flags = [];
    for (const color of [1, 2, 3, 4]) {
        const i = L.supply[color]; if (i < 0) continue;
        const p = cellPos(L, i), ox = Math.sign(p.x) * (two || Math.abs(p.x) > 1 ? 1 : 0), oz = two ? 0 : Math.sign(p.z) * (Math.abs(p.z) > 1 ? 1 : 0);
        const tw = buildTower({ brick, dark, roof, red }, color);
        tw.scale.setScalar(0.8); tw.position.set(p.x + ox * 2.75, 0, p.z + oz * 2.75); tw.rotation.y = oz ? Math.PI / 2 : 0;
        group.add(tw);
        tw.traverse((o) => { if (o.userData.flag) flags.push(o); });
    }
    shadowed(group);
    mergeByMaterial(group, (o) => o.userData.keep);
    for (const f of flags) group.attach(f);
    const mm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.28, 0.3), brick, Math.max(1, merlons.length)), o = new THREE.Object3D();
    merlons.forEach((q, i) => { o.position.set(q.x, q.y, q.z); o.updateMatrix(); mm.setMatrixAt(i, o.matrix); });
    mm.castShadow = true; group.add(mm);

    // the paving of the walk; a Legendary Field is marked with a star
    const star = canvasTexture(128, 128, (x) => {
        x.fillStyle = '#c9a44e'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#5a3c10'; x.beginPath();
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, rad = k % 2 ? 18 : 46; x.lineTo(64 + Math.sin(a) * rad, 64 - Math.cos(a) * rad); }
        x.closePath(); x.fill();
    });
    const cells = [];
    for (let i = 0; i < L.N; i++) if (L.on[i] && !L.supply.includes(i)) cells.push(i);
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), std({ roughness: 0.95 }), cells.length);
    cells.forEach((i, k) => {
        cellPos(L, i, o.position).y = TOP - 0.04; o.updateMatrix(); tm.setMatrixAt(k, o.matrix);
        const v = 0.3 + (((i * 7919) % 13) / 13) * 0.07;
        tm.setColorAt(k, new THREE.Color(v * 1.12, v, v * 0.84));
    });
    tm.receiveShadow = true; group.add(tm);
    for (const i of L.supply) if (i >= 0) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), std({ map: star, roughness: 0.5, metalness: 0.4 })); cellPos(L, i, t.position).y = TOP - 0.04; t.receiveShadow = true; group.add(t); }
    return { group, L, flags, reach: Math.max(hx, hz) + 5.6 };
}

// ---------------------------------------------------------------- the world

export class GreatWallWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'grove';
        this.veil = 0xdfe6e2;
        this.nPlayers = 0;
        this.warriors = new Map();
        this.indicators = [];
        this.flags = [];
        const m = materials();
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xcdd8d6, 0.0075);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 130, left: -16, right: 16, top: 16, bottom: -16 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x8a9a70, 0.6); scene.add(this.hemi);

        // the ridge the wall rides on, the valleys either side, range behind range in the haze
        let hs = 61;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, flat = std({ roughness: 1, flatShading: true });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std({ color: 0x66784a, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = GROUND - 30; scene.add(floor);
        const inst = (geo, mat, list, cast = false) => {
            const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
            list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (t.color) im.setColorAt(i, t.color); });
            im.castShadow = cast; im.receiveShadow = cast; scene.add(im);
            return im;
        };
        const hills = [], trees = [], segs = [], towers = [];
        // the ridge itself: a chain of humps under the wall, running east and west
        for (let i = -9; i <= 9; i++) hills.push({ x: i * 16 + hr() * 6, y: GROUND - 22, z: hr() * 6 - 3, sx: 16 + hr() * 6, sy: 24 + hr() * 3, sz: 20 + hr() * 8, ry: hr() * 6, color: new THREE.Color().setHSL(0.24 + hr() * 0.05, 0.3, 0.3 + hr() * 0.07, sRGB) });
        for (let i = 0; i < 70; i++) {
            const a = hr() * 6.28, d = 70 + hr() * 330, h = 22 + hr() * 70;
            hills.push({ x: Math.sin(a) * d, y: GROUND - 34, z: Math.cos(a) * d, sx: 34 + hr() * 60, sy: h, sz: 34 + hr() * 60, ry: hr() * 6, color: new THREE.Color().setHSL(0.26 + hr() * 0.1, 0.24, 0.3 + hr() * 0.16, sRGB) });
        }
        for (let i = 0; i < 220; i++) {
            const x = -150 + hr() * 300, z = (hr() < 0.5 ? -1 : 1) * (7 + hr() * 26), s = 1 + hr() * 1.6;
            trees.push({ x, y: GROUND - 3 - Math.abs(z) * 0.55 + s * 1.3, z, sx: s, sy: s * 2.8, sz: s, color: new THREE.Color().setHSL(0.3 + hr() * 0.06, 0.4, 0.17 + hr() * 0.08, sRGB) });
        }
        // the wall going on over the mountains in both directions, a tower on every crest
        const wallMat = m.limestone.clone(); wallMat.color.set(0x9a958a);
        for (const s of [-1, 1]) {
            let x = s * 14, y = -1.5, z = 0, dir = 0;
            for (let k = 0; k < 46; k++) {
                const len = 7, nd = dir + (hr() - 0.5) * 0.5, ny = y + Math.sin(k * 0.55 + s) * 2.6 - 0.25;
                const nx = x + s * Math.cos(nd) * len, nz = z + Math.sin(nd) * len;
                segs.push({ x: (x + nx) / 2, y: (y + ny) / 2 - 2, z: (z + nz) / 2, sx: Math.hypot(nx - x, nz - z, ny - y) + 0.4, sy: 5, sz: 2.4, ry: -Math.atan2(nz - z, nx - x), rz: Math.atan2(ny - y, Math.hypot(nx - x, nz - z)) });
                if (k % 6 === 5) towers.push({ x: nx, y: ny + 0.5, z: nz, sx: 4, sy: 8, sz: 4, ry: -nd });
                x = nx; y = ny; z = nz; dir = nd * 0.8;
            }
        }
        inst(new THREE.IcosahedronGeometry(1, 1), flat, hills);
        inst(new THREE.ConeGeometry(1, 1, 6), flat, trees);
        const unit = new THREE.BoxGeometry(1, 1, 1);
        inst(unit, wallMat, segs); inst(unit, wallMat, towers);

        // wild geese crossing in a skein
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.14, 0, 0, -0.12, 0.8, 0, -0.1], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, side: THREE.DoubleSide });
        for (let i = 0; i < 9; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
            b.userData = { wl, wr, ox: -Math.abs(k) * 1.6, oz: k * 1.3, ph: i };
            b.scale.setScalar(0.9); b.rotation.y = -Math.PI / 2; scene.add(b); this.birds.push(b);
        }
        this.nextCall = 9;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.warriorGroup = new THREE.Group(); scene.add(this.warriorGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        this.fxGroup = new THREE.Group(); scene.add(this.fxGroup);
        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.sheet.rotation.x = -Math.PI / 2; this.sheet.position.y = TOP; scene.add(this.sheet);
        this.lanterns = [new THREE.PointLight(0xff8a50, 0, 22, 1.7), new THREE.PointLight(0xff8a50, 0, 22, 1.7)];
        scene.add(...this.lanterns);

        this.puffs = new Particles(200, { color: 0xd8d2c4 }); this.puffs.drag = 1.8; this.puffs.gravity = 0.2;
        this.sparks = new Particles(220, { color: 0xffe2a0, additive: true }); this.sparks.drag = 1.2; this.sparks.gravity = 1.5;
        this.mist = new Particles(160, { color: 0xe6ecec });
        scene.add(this.puffs.points, this.sparks.points, this.mist.points);
        for (let i = 0; i < this.mist.n; i++) {
            this.mist.pos.set([(Math.random() - 0.5) * 120, GROUND - 6 + Math.random() * 6, (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 30)], i * 3);
            this.mist.size[i] = 8 + Math.random() * 12; this.mist.alpha[i] = 0.1 + Math.random() * 0.14;
        }
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear();
            const { group, L, flags } = buildBoard(state.nPlayers);
            this.L = L; this.flags = flags; this.boardGroup.add(group);
            this.sheet.scale.set(L.cols, L.rows, 1);
            [L.supply[1], L.supply[2]].forEach((i, k) => { cellPos(L, i, this.lanterns[k].position).y = 3; });
            const r = Math.max(L.cols, L.rows) / 2 + 6;
            Object.assign(this.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); this.key.shadow.camera.updateProjectionMatrix();
        }
        this.tweens.clear();
        this.fxGroup.clear();
        this.sync(state);
        this.clearIndicators();
    }

    homeView(n = this.nPlayers) {
        return n === 2 ? { pos: new THREE.Vector3(-2.4, 13.5, 14.5), target: new THREE.Vector3(0, 0.3, 0.6) }
            : { pos: new THREE.Vector3(-17, 24, 19), target: new THREE.Vector3(0, 0.3, 0.5) };
    }
    cameraLimits() { return this.nPlayers === 2 ? { min: 6, max: 40 } : { min: 9, max: 70 }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(60);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.95;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x8a9a70).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.4;
        const haze = new THREE.Color(0xcdd8d6).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.5 * (1 - d.low * 0.6));
        this.birdMat.color.set(d.night ? 0x05060a : 0x2a2620);
        for (const b of this.birds) b.visible = !d.night;
        for (const l of this.lanterns) l.intensity = d.lamps * 40;
        this.mist.material.uniforms.uColor.value.copy(this.scene.fog.color).multiplyScalar(1.1);
        this.puffs.material.uniforms.uColor.value.set(0xd8d2c4).multiplyScalar(d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2));
    }

    // ------------------------------------------------------------ warriors & indicators

    sync(state) {
        this.warriorGroup.clear(); this.warriors.clear();
        for (let i = 0; i < state.grid.length; i++) {
            const v = state.grid[i]; if (!v) continue;
            const w = makeWarrior(owner(v)); cellPos(this.L, i, w.position); w.rotation.y = turnOf(facing(v));
            w.traverse((o) => { o.userData.cell = i; });
            this.warriorGroup.add(w); this.warriors.set(i, w);
        }
    }

    clearIndicators() {
        this.indicatorGroup.clear();
        this.indicators.length = 0;
        if (this.ghost) { this.warriorGroup.remove(this.ghost); this.ghost = null; }
    }

    mark(geo, color, at, y = 0.02, opacity = 0.9) {
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5;
        if (at >= 0) cellPos(this.L, at, mesh.position).y = TOP + y;
        mesh.userData.ph = Math.random() * 3; mesh.userData.base = opacity;
        this.indicatorGroup.add(mesh); this.indicators.push(mesh);
        return mesh;
    }

    // nothing in hand: the fields a warrior may be placed on are dotted
    showPlacements(fields) {
        this.clearIndicators();
        for (const f of fields) this.mark(new THREE.RingGeometry(0.1, 0.17, 20), 0xffd070, f, 0.02, 0.8);
    }

    // a warrior in hand: where he may walk, and the flight his arrow would take
    showSelection(cell, moves, shot) {
        this.clearIndicators();
        this.mark(new THREE.RingGeometry(0.42, 0.48, 32), 0xffd070, cell).userData.still = true;
        for (const to of moves) this.mark(new THREE.RingGeometry(0.13, 0.21, 24), 0xfff3c0, to);
        if (shot) {
            const pts = shot.pts.map(([r, c]) => new THREE.Vector3(c - (this.L.cols - 1) / 2, 0.55, r - (this.L.rows - 1) / 2));
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: shot.kills.length ? 0xff5a30 : 0xfff0c0, transparent: true, opacity: 0.7, fog: false }));
            line.userData.still = true; line.material.userData = {};
            this.indicatorGroup.add(line);
            for (const k of shot.kills) this.mark(new THREE.RingGeometry(0.42, 0.5, 32), 0xff3a20, k);
        }
    }
    showStrike(cells) { for (const k of cells) this.mark(new THREE.RingGeometry(0.42, 0.5, 32), 0xff3a20, k); }

    // choosing a facing for the warrior on `cell` (a pale figure stands in if the field is still empty)
    showFacing(cell, color, standIn) {
        this.clearIndicators();
        const p = cellPos(this.L, cell);
        if (standIn) { this.ghost = makeWarrior(color); this.ghost.position.copy(p); this.ghost.scale.setScalar(0.94); this.warriorGroup.add(this.ghost); }
        this.mark(new THREE.RingGeometry(0.42, 0.48, 32), 0xffd070, cell).userData.still = true;
        const arrow = new THREE.Shape(); arrow.moveTo(0, 0.2); arrow.lineTo(0.17, -0.1); arrow.lineTo(0, -0.03); arrow.lineTo(-0.17, -0.1); arrow.closePath();
        for (let d = 0; d < 8; d++) {
            const a = this.mark(new THREE.ShapeGeometry(arrow), 0x9fe8ff, -1), k = d % 2 ? 0.72 : 0.84;
            a.position.set(p.x + DIRS[d][1] * k, 0.9, p.z + DIRS[d][0] * k); a.rotation.z = turnOf(d);
            const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
            pad.position.copy(a.position); pad.userData.cell = FACE + d; pad.userData.pad = true;
            this.indicatorGroup.add(pad);
        }
    }
    // turn the stand-in (or the warrior himself) to look the way the pointer suggests
    previewFacing(cell, d) {
        const w = this.ghost || this.warriors.get(cell);
        if (w) w.rotation.y = turnOf(d);
    }

    // what is under the pointer: a field, FACE + direction, or -1
    pick(raycaster) {
        const pads = this.indicatorGroup.children.filter((o) => o.userData.pad);
        const hits = raycaster.intersectObjects([...pads, ...this.warriorGroup.children, this.sheet], true);
        for (const h of hits) {
            if (h.object === this.sheet) {
                const L = this.L, c = Math.round(h.point.x + (L.cols - 1) / 2), r = Math.round(h.point.z + (L.rows - 1) / 2);
                return c < 0 || r < 0 || c >= L.cols || r >= L.rows || !L.on[r * L.cols + c] ? -1 : r * L.cols + c;
            }
            if (h.object.userData.cell !== undefined) return h.object.userData.cell;
        }
        return -1;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state) {
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'place') await this.animPlace(ev);
            else if (ev.type === 'move') await this.animMove(ev);
            else if (ev.type === 'shoot') await this.animShoot(ev);
            else if (ev.type === 'spin') await this.animSpin(ev);
            else if (ev.type === 'out') await this.fall(ev.cells.map((c) => c.at));
        }
        this.sync(state);
    }

    animPlace(ev) {
        const w = makeWarrior(ev.color), p = cellPos(this.L, ev.to);
        w.position.copy(p); w.rotation.y = turnOf(ev.facing); this.warriorGroup.add(w); this.warriors.set(ev.to, w);
        sfx('pickup');
        return this.tweens.run(0.4, (k) => {
            w.position.y = p.y + (1 - ease.out(k)) * 2.2; w.scale.setScalar(0.6 + 0.4 * ease.out(k));
            if (k === 1) { sfx('place'); this.puffs.burst(p, 5, { speed: 0.5, up: 0.15, size: 0.4, alpha: 0.25, life: 0.7 }); }
        });
    }

    turn(w, d, dur = 0.22) {
        const a = w.rotation.y; let b = turnOf(d);
        while (b - a > Math.PI) b -= Math.PI * 2; while (b - a < -Math.PI) b += Math.PI * 2;
        if (Math.abs(b - a) < 0.01) return Promise.resolve();
        return this.tweens.run(dur, (k) => { w.rotation.y = a + (b - a) * ease.inOut(k); if (k === 1) w.rotation.y = turnOf(d); });
    }

    async animMove(ev) {
        const w = this.warriors.get(ev.from);
        if (!w) return;
        if (ev.to !== ev.from) {
            const a = cellPos(this.L, ev.from), b = cellPos(this.L, ev.to), dist = a.distanceTo(b);
            this.warriors.delete(ev.from); this.warriors.set(ev.to, w);
            sfx('slide', dist);
            await this.tweens.run(0.22 + dist * 0.12, (k) => { w.position.lerpVectors(a, b, ease.inOut(k)); w.position.y = a.y + Math.abs(Math.sin(k * Math.PI * dist * 1.5)) * 0.07; if (k === 1) w.position.copy(b); });
        }
        await this.turn(w, ev.facing);
    }

    // warriors struck down: they topple and are gone
    fall(cells) {
        const list = cells.map((c) => this.warriors.get(c)).filter(Boolean);
        for (const c of cells) this.warriors.delete(c);
        if (!list.length) return Promise.resolve();
        sfx('take');
        for (const w of list) this.puffs.burst(w.position, 5, { speed: 0.5, up: 0.2, size: 0.45, alpha: 0.25, life: 0.8 });
        return this.tweens.run(0.5, (k) => { for (const w of list) { w.rotation.x = ease.in(k) * 1.4; w.position.y = TOP - ease.in(k) * 0.2; if (k > 0.6) w.scale.setScalar(Math.max(0.001, 1 - (k - 0.6) / 0.4)); if (k === 1) this.warriorGroup.remove(w); } });
    }

    // the arrow flies its whole course; shields ring, the struck fall as it passes
    async animShoot(ev) {
        const L = this.L, m = materials();
        const pts = ev.pts.map(([r, c]) => new THREE.Vector3(c - (L.cols - 1) / 2, 0.55, r - (L.rows - 1) / 2));
        const shaft = new THREE.Group(), rod = cyl(0.014, 0.014, 0.6, m.wood, 0, 0, 0, 5), head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), m.bronze);
        rod.rotation.x = Math.PI / 2; rod.position.set(0, 0, 0); head.rotation.x = -Math.PI / 2; head.position.z = -0.34; shaft.add(rod, head);
        this.fxGroup.add(shaft);
        sfx('bow');
        const marks = new Map(ev.marks.map((mk) => [mk.i, mk])), done = new Set(), segs = pts.length - 1, falling = [];
        await this.tweens.run(Math.min(2.6, 0.12 + segs * 0.075), (k) => {
            const f = k * segs, i = Math.min(segs - 1, Math.floor(f)), a = pts[i], b = pts[i + 1];
            shaft.position.lerpVectors(a, b, f - i); shaft.lookAt(b.x + (b.x - a.x), b.y, b.z + (b.z - a.z));
            for (let j = 1; j <= i + (f - i > 0.6 ? 1 : 0); j++) {
                const mk = marks.get(j); if (!mk || done.has(j)) continue;
                done.add(j);
                if (mk.type === 'reflect' || mk.type === 'deflect') { sfx('clang'); this.sparks.burst(pts[j], 8, { speed: 1.2, up: 0.8, size: 0.2, alpha: 1, life: 0.5 }); }
                else if (mk.type === 'kill') falling.push(this.fall([mk.at]));
            }
        });
        this.fxGroup.remove(shaft);
        await Promise.all(falling);
    }

    // the blade goes round once; then he faces where he chose
    async animSpin(ev) {
        const w = this.warriors.get(ev.at);
        if (!w) return;
        const p = cellPos(this.L, ev.at), a = w.rotation.y;
        const arc = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.35, 40), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
        arc.rotation.x = -Math.PI / 2; arc.position.set(p.x, 0.5, p.z); this.fxGroup.add(arc);
        sfx('whoosh');
        let struck = null;
        await this.tweens.run(0.45, (k) => {
            w.rotation.y = a - ease.inOut(k) * Math.PI * 2; arc.material.opacity = Math.sin(Math.PI * k) * 0.55; arc.scale.setScalar(0.7 + k * 0.4);
            if (!struck && k > 0.45) struck = this.fall(ev.kills.map((c) => c.at));
            if (k === 1) { w.rotation.y = a; this.fxGroup.remove(arc); }
        });
        await struck;
        await this.turn(w, ev.facing);
    }

    celebrate(color) {
        for (const w of this.warriors.values()) {
            if (w.userData.color !== color) continue;
            const q = w.position.clone(); q.y = 0.9;
            this.tweens.run(0.1, () => {}, Math.random() * 1.6).then(() => this.sparks.burst(q, 10, { speed: 0.9, up: 2.4, size: 0.3, alpha: 1, life: 1.2 }));
        }
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, 0);

        for (const o of this.indicators) {
            if (o.userData.still) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.material.opacity = o.userData.base * (0.75 + w * 0.25);
        }
        // banners in the wind
        for (const f of this.flags) {
            const pos = f.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + 0.6; pos.setZ(i, Math.sin(t * 4 - x * 4 + f.position.x) * 0.09 * x); }
            pos.needsUpdate = true;
        }
        for (const b of this.birds) {
            const u = b.userData, x = ((t * 3.2 + 70) % 260) - 130;
            b.position.set(x + u.ox, 13 + Math.sin(t * 0.4 + u.ph) * 0.4, -26 + u.oz);
            const flap = Math.sin(t * 6 + u.ph) * 0.5;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        const mi = this.mist;
        for (let i = 0; i < mi.n; i++) { mi.pos[i * 3] += dt * (0.5 + (i % 5) * 0.12); if (mi.pos[i * 3] > 60) mi.pos[i * 3] -= 120; }
        mi.points.geometry.attributes.position.needsUpdate = true;
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : Math.random() < 0.5 ? 'songbird' : 'falcon'); this.nextCall = 8 + Math.random() * 14; }
        }
        this.puffs.update(dt); this.sparks.update(dt);
    }
}
