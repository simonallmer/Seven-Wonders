// COLOSSUS — the world: the harbour of Rhodes under the bronze Helios, a deck that tilts, stones, effects and move animations.
import * as THREE from 'three';
import { layout, createState, STEP } from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { sandMaps, canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { makeStone } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -17;    // the sea, far below: the deck (tiles at y = 0) lies in the hands of the Colossus
const TOP = 0.05;             // top of a tile
const LEAN = 0.1;             // how far the deck tips, in radians

export function cellPos(L, i, out = new THREE.Vector3()) {
    const mid = (L.S - 1) / 2;
    return out.set((i % L.S) - mid, TOP, Math.floor(i / L.S) - mid);
}

// Helios in bronze, astride the harbour mouth, a foot on each mole, holding the board out before him in both hands.
// Built around the board: his hands meet under its centre, his head rises behind its far edge.
function buildHelios(mid, mini) {
    const m = materials(), g = new THREE.Group(), b = m.bronze;
    const limb = (ax, ay, az, bx, by, bz, r0, r1 = r0) => {
        const a = new THREE.Vector3(ax, ay, az), d = new THREE.Vector3(bx, by, bz).sub(a), len = d.length();
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, mini ? 8 : 14), b);
        c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c);
    };
    const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, mini ? 8 : 14, mini ? 6 : 10), b); s.position.set(x, y, z); s.scale.set(sx, sy, sz); g.add(s); };
    const Z = -(mid + 3.4), hip = -6.6, sh = -1.3;            // where he stands; height of hips and shoulders
    for (const s of [-1, 1]) {
        limb(s * 1.3, hip, Z, s * 3.6, hip - 5.4, Z, 1.25, 0.95); ball(1.0, s * 3.6, hip - 5.4, Z);       // thigh, knee
        limb(s * 3.6, hip - 5.4, Z, s * 5.6, GROUND + 1.9, Z, 0.9, 0.62);                                 // shin
        g.add(box(1.5, 0.7, 3.0, b, s * 5.6, GROUND + 1.2, Z + 0.5));                                     // foot
        ball(1.05, s * 3.0, sh, Z);                                                                       // shoulder
        limb(s * 3.0, sh, Z, s * 3.3, -2.6, Z + 3.6, 0.72, 0.6); ball(0.62, s * 3.3, -2.6, Z + 3.6);       // upper arm, elbow
        limb(s * 3.3, -2.6, Z + 3.6, s * 1.5, -1.25, -1.2, 0.56, 0.42);                                   // forearm, reaching under the board
        ball(0.55, s * 1.5, -1.1, -1.0, 1.2, 0.6, 1.4);                                                   // hand
    }
    ball(1.9, 0, hip, Z, 1.15, 0.85, 0.9);                                                                // hips
    limb(0, hip, Z, 0, sh - 0.3, Z, 1.7, 2.3); ball(2.3, 0, sh - 0.9, Z, 1.25, 0.8, 0.82);                // waist and chest
    g.add(box(3.0, 2.6, 0.35, b, 0, hip - 2.4, Z + 1.0));                                                 // a fold of cloth at the hips
    limb(0, sh, Z, 0, sh + 1.5, Z + 0.2, 0.75, 0.62);                                                     // neck
    ball(1.15, 0, sh + 2.6, Z + 0.35, 0.95, 1.1, 1);                                                      // head, bent a little toward the board
    ball(1.2, 0, sh + 2.9, Z + 0.05, 1, 0.95, 0.95);                                                      // hair
    for (let i = 0; i < 9; i++) {                                                                         // the rays of the sun
        const a = (i / 8 - 0.5) * 2.5, ray = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.5, 5), m.gold);
        ray.position.set(Math.sin(a) * 1.75, sh + 2.9 + Math.cos(a) * 1.75, Z - 0.1); ray.rotation.z = -a; g.add(ray);
    }
    return g;
}

// The deck with its tiles (everything that tilts) and, around it, the Colossus on the two moles (which do not).
// Returns { fixed, deck, L, R } — R is how far the whole reaches from the middle of the board.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), m = materials(), S = L.S, mid = (S - 1) / 2;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const fixed = new THREE.Group(), deck = new THREE.Group();
    const R = mid + 7.6;
    const stone = m.sandstone.clone(); stone.color.set(0xd9cdb4);
    // the two moles of the harbour mouth, the channel open between them
    for (const s of [-1, 1]) fixed.add(box(4.2, 2.6, 17, stone, s * 5.6, GROUND - 1.4, -(mid + 3.4) + 2), box(4.8, 0.3, 17.6, stone, s * 5.6, GROUND + 1.0, -(mid + 3.4) + 2));
    fixed.add(buildHelios(mid, mini));
    shadowed(fixed);
    mergeByMaterial(fixed);

    // the deck: a bronze-bound cross of cedar, tiled in Rhodian blue and white
    const cedar = std({ color: 0x4a3222, roughness: 0.6 });
    const core = S - 2;
    deck.add(box(core + 0.5, 0.36, core + 0.5, cedar, 0, -0.4, 0), box(core + 0.7, 0.12, core + 0.7, m.bronze, 0, -0.28, 0));
    deck.add(cyl(2.6, 1.7, 0.5, m.bronze, 0, -0.9, 0, 24)); // the bronze dish under it, resting in his hands
    for (let d = 0; d < 4; d++) {
        const [dr, dc] = STEP[d], w = dc ? 1.25 : 3.5, dd = dc ? 3.5 : 1.25, x = dc * (mid - 0.1), z = dr * (mid - 0.1);
        deck.add(box(w, 0.36, dd, cedar, x, -0.4, z), box(w + 0.2, 0.12, dd + 0.2, m.bronze, x, -0.28, z));
    }
    shadowed(deck); mergeByMaterial(deck);
    const tiles = [], blue = new THREE.Color(0x3f6f9c), white = new THREE.Color(0xe9e4d6), gold = new THREE.Color(0xe0b04a);
    for (let i = 0; i < L.N; i++) if (L.active[i]) tiles.push(i);
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.2, 0.94), std({ roughness: 0.4, metalness: 0.05 }), tiles.length), o = new THREE.Object3D();
    tiles.forEach((i, k) => {
        cellPos(L, i, o.position).y = TOP - 0.1; o.updateMatrix(); tm.setMatrixAt(k, o.matrix);
        tm.setColorAt(k, L.field.includes(i) ? gold : (Math.floor(i / S) + i % S) % 2 ? blue : white);
    });
    tm.receiveShadow = true; deck.add(tm);
    // the four direction fields: a bronze arrow pointing the way the board will lean
    const arrow = new THREE.Shape(); arrow.moveTo(0, 0.34); arrow.lineTo(0.3, -0.06); arrow.lineTo(0.11, -0.06); arrow.lineTo(0.11, -0.32); arrow.lineTo(-0.11, -0.32); arrow.lineTo(-0.11, -0.06); arrow.lineTo(-0.3, -0.06); arrow.closePath();
    const ag = new THREE.ShapeGeometry(arrow); ag.rotateX(-Math.PI / 2); // tip toward -z
    L.field.forEach((i, d) => { const a = new THREE.Mesh(ag, std({ color: 0x5a3a18, roughness: 0.5, metalness: 0.6 })); cellPos(L, i, a.position).y = TOP + 0.004; a.rotation.y = -d * Math.PI / 2; deck.add(a); });

    if (mini) {
        const st = createState(nPlayers);
        for (let i = 0; i < L.N; i++) if (st.grid[i]) { const s = makeStone(st.grid[i], true); cellPos(L, i, s.position); deck.add(s); }
    }
    return { fixed, deck, L, R };
}

// ---------------------------------------------------------------- the world

export class ColossusWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'coast';
        this.veil = 0xd8e6ee;
        this.nPlayers = 0;
        this.stones = new Map();
        this.indicators = [];
        const m = materials();
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xcfe0ea, 0.0036);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 120, left: -16, right: 16, top: 16, bottom: -16 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x6f90a0, 0.6); scene.add(this.hemi);

        // the sea
        const wn = sandMaps().normalMap.clone(); wn.repeat.set(26, 26); wn.needsUpdate = true;
        this.seaMap = wn;
        this.seaMat = new THREE.MeshPhysicalMaterial({ color: 0x2a6f95, roughness: 0.16, metalness: 0.1, clearcoat: 1, normalMap: wn, normalScale: new THREE.Vector2(0.14, 0.14) });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.seaMat);
        sea.rotation.x = -Math.PI / 2; sea.position.y = GROUND; sea.receiveShadow = true; scene.add(sea);

        // the island: the town of Rhodes behind its harbour wall, the acropolis above it
        let hs = 21;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, flat = std({ roughness: 1, flatShading: true });
        const land = new THREE.Group(); scene.add(land);
        const earth = std({ color: 0xb9a878, roughness: 1 }), lime = m.sandstone.clone(); lime.color.set(0xdfd4bc);
        land.add(box(520, 3.6, 260, earth, -40, GROUND - 1.2, 185));           // the shore to the south
        land.add(box(170, 4.4, 7, lime, -20, GROUND - 1, 56));                // harbour wall
        for (let i = 0; i < 9; i++) land.add(box(6, 8, 8, lime, -100 + i * 20, GROUND - 1, 56));
        land.add(box(9, 1.3, 46, lime, 0, GROUND - 0.6, 32));                 // the causeway out to the mole
        land.add(box(240, 1.6, 8, lime, 150, GROUND - 0.8, 4), box(8, 1.6, 60, lime, 266, GROUND - 0.8, 30)); // the outer breakwater
        const temple = new THREE.Group();                                     // the temple on the acropolis
        temple.add(box(26, 2, 14, lime, 0, 0, 0), box(22, 7, 10, lime, 0, 2, 0), box(25, 1.4, 13, lime, 0, 9, 0));
        const gable = new THREE.Shape(); gable.moveTo(-12.5, 0); gable.lineTo(12.5, 0); gable.lineTo(0, 3.6); gable.closePath();
        const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 13, bevelEnabled: false }), m.terracotta); rf.position.set(0, 10.4, -6.5); temple.add(rf);
        temple.position.set(-70, GROUND + 30, 150); land.add(temple);
        mergeByMaterial(shadowed(land, false, true));
        const inst = (geo, mat, list) => {
            const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
            list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(0, t.ry || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (t.color) im.setColorAt(i, t.color); });
            scene.add(im);
        };
        const hills = [], houses = [], roofs = [], trees = [];
        hills.push({ x: -70, y: GROUND - 4, z: 160, sx: 90, sy: 36, sz: 60, color: new THREE.Color().setHSL(0.16, 0.3, 0.5, sRGB) });
        for (let i = 0; i < 14; i++) hills.push({ x: -300 + i * 44 + hr() * 20, y: GROUND - 4, z: 230 + hr() * 60, sx: 60 + hr() * 50, sy: 26 + hr() * 44, sz: 60 + hr() * 40, ry: hr() * 6, color: new THREE.Color().setHSL(0.17 + hr() * 0.08, 0.28, 0.42 + hr() * 0.12, sRGB) });
        for (let i = 0; i < 6; i++) hills.push({ x: -420 + hr() * 60, y: GROUND - 5, z: -260 + i * 70, sx: 70, sy: 20 + hr() * 20, sz: 70, color: new THREE.Color().setHSL(0.58, 0.18, 0.62, sRGB) }); // the coast of Asia, far off
        for (let i = 0; i < 210; i++) {
            const x = -140 + hr() * 250, z = 64 + hr() * 70, y = GROUND + 2.4 + Math.max(0, z - 80) * 0.22 + Math.max(0, 40 - Math.abs(x + 70)) * Math.max(0, z - 100) * 0.008;
            const w = 3 + hr() * 5, h = 2.6 + hr() * 3.4, dd = 3 + hr() * 5;
            houses.push({ x, y: y + h / 2, z, sx: w, sy: h, sz: dd, color: new THREE.Color().setHSL(0.1, 0.18, 0.82 + hr() * 0.12, sRGB) });
            roofs.push({ x, y: y + h + 0.2, z, sx: w + 0.4, sy: 0.4, sz: dd + 0.4 });
            if (i % 3 === 0) { const s = 1.6 + hr() * 1.6; trees.push({ x: x + 4, y: y + s * 1.6, z: z + 3, sx: s * 0.5, sy: s * 2.4, sz: s * 0.5, color: new THREE.Color().setHSL(0.33, 0.35, 0.16 + hr() * 0.06, sRGB) }); }
        }
        const unit = new THREE.BoxGeometry(1, 1, 1);
        inst(new THREE.IcosahedronGeometry(1, 1), flat, hills);
        inst(unit, std({ roughness: 1 }), houses);
        inst(unit, m.terracotta, roofs);
        inst(new THREE.ConeGeometry(1, 1, 7), flat, trees);

        // ships: merchantmen at anchor, a trireme under way
        this.ships = [];
        const hull = std({ color: 0x4a3524, roughness: 0.9 }), sail = std({ color: 0xe9dcc0, roughness: 1, side: THREE.DoubleSide }), red = std({ color: 0xa33a2c, roughness: 1, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
            const b = new THREE.Group(), h = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), hull); h.scale.set(5.5, 0.7, 1.4); b.add(h);
            b.add(cyl(0.08, 0.1, 5.4, hull, 0, 0.3, 0, 6));
            const sl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), i % 3 ? sail : red); sl.rotation.y = Math.PI / 2; sl.position.set(0.1, 3.8, 0); b.add(sl);
            const moving = i < 3;
            b.userData = moving ? { x: -200 + i * 150, z: -46 - i * 34, sp: (1.1 + i * 0.3) * (i % 2 ? 1 : -1) } : { x: 60 + (i - 3) * 24, z: 28 + (i - 3) * 6, sp: 0 };
            scene.add(b); this.ships.push(b);
        }
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.7, 0, -0.06], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0xf0eee8, side: THREE.DoubleSide });
        for (let i = 0; i < 11; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 11 + Math.random() * 18, h: 9 + Math.random() * 10, sp: (0.13 + Math.random() * 0.08) * (i % 2 ? 1 : -1), ph: Math.random() * 9, cz: -4 + Math.random() * 10 };
            b.scale.setScalar(0.8 + Math.random() * 0.4); scene.add(b); this.birds.push(b);
        }
        this.nextCall = 6;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        // everything that tips with the deck
        this.tiltGroup = new THREE.Group(); scene.add(this.tiltGroup);
        this.deckGroup = new THREE.Group(); this.stoneGroup = new THREE.Group(); this.indicatorGroup = new THREE.Group();
        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.sheet.rotation.x = -Math.PI / 2; this.sheet.position.y = TOP;
        this.tiltGroup.add(this.deckGroup, this.stoneGroup, this.indicatorGroup, this.sheet);
        this.torchLight = new THREE.PointLight(0xffc890, 0, 40, 1.6); // a little warmth on the board by night scene.add(this.torchLight);

        this.embers = new Particles(240, { color: 0xff7a3a, additive: true }); this.embers.drag = 1.2; this.embers.gravity = -0.5;
        this.spray = new Particles(160, { color: 0xeef6fa }); this.spray.drag = 1.4; this.spray.gravity = 1.2;
        scene.add(this.embers.points, this.spray.points);
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear(); this.deckGroup.clear();
            const { fixed, deck, L, R } = buildBoard(state.nPlayers);
            this.L = L; this.R = R; this.boardGroup.add(fixed); this.deckGroup.add(deck);
            this.sheet.scale.set(L.S, L.S, 1);
            this.torchLight.position.set(0, 3, -(L.S / 2 + 1));
        }
        this.tweens.clear();
        this.tiltGroup.rotation.set(0, 0, 0);
        this.sync(state);
        this.clearIndicators();
    }

    homeView(n = this.nPlayers) {
        const k = n === 2 ? 1 : 1.17;
        return { pos: new THREE.Vector3(-4.4 * k, 12.6 * k, 13.8 * k), target: new THREE.Vector3(0, 0.4, -0.9 * k) };
    }
    cameraLimits() { const k = this.nPlayers === 2 ? 1 : 1.17; return { min: 7 * k, max: 40 * k }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(60);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.95;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x6f90a0).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.4;
        const haze = new THREE.Color(0xcfe0ea).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(0xf0eee8).multiplyScalar(d.night ? 0.05 : 0.55 + d.keyPower * 0.1);
        for (const b of this.birds) b.visible = !d.night;
        this.seaMat.color.copy(d.skyTop).lerp(new THREE.Color(0x2a6f95), 0.55).multiplyScalar(d.night ? 0.45 : 1);
        this.spray.material.uniforms.uColor.value.set(0xeef6fa).multiplyScalar(d.night ? 0.15 : Math.min(1, 0.4 + d.keyPower * 0.2));
        this.torchLight.intensity = d.lamps * 60;
    }

    // ------------------------------------------------------------ stones & indicators

    sync(state) {
        this.stoneGroup.clear(); this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) {
            if (!state.grid[i]) continue;
            const s = makeStone(state.grid[i]); cellPos(this.L, i, s.position); s.userData.cell = i;
            this.stoneGroup.add(s); this.stones.set(i, s);
        }
    }

    clearIndicators() {
        this.indicatorGroup.clear();
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = TOP; this.selected = null; }
    }

    showSelection(cell, moves) {
        this.clearIndicators();
        const L = this.L, stone = this.stones.get(cell);
        if (stone) this.selected = stone;
        const ring = (r0, r1, color, at) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; cellPos(L, at, mesh.position).y = TOP + 0.02; mesh.userData.ph = Math.random() * 3;
            this.indicatorGroup.add(mesh); this.indicators.push(mesh);
            return mesh;
        };
        ring(0.4, 0.47, 0xffd070, cell).userData.still = true;
        for (const mv of moves) {
            if (mv.type === 'run') { if (L.field.includes(mv.to)) ring(0.3, 0.42, 0xfff0a0, mv.to); else ring(0.12, 0.2, 0xfff3c0, mv.to); }
            else { ring(0.4, 0.47, 0xffa030, mv.to); ring(0.1, 0.17, 0xffa030, mv.pushTo); }
        }
    }

    // what is under the pointer: a field or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, this.sheet], false);
        if (!hits.length) return -1;
        if (hits[0].object !== this.sheet) return hits[0].object.userData.cell ?? -1;
        const L = this.L, p = this.tiltGroup.worldToLocal(hits[0].point.clone()), mid = (L.S - 1) / 2;
        const c = Math.round(p.x + mid), r = Math.round(p.z + mid);
        if (c < 0 || r < 0 || c >= L.S || r >= L.S || !L.active[r * L.S + c]) return -1;
        return r * L.S + c;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state) {
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'run') await this.slide(ev.from, ev.to);
            else if (ev.type === 'push') { sfx('push'); await Promise.all([this.slide(ev.to, ev.pushTo, true), this.slide(ev.from, ev.to, true)]); }
            else if (ev.type === 'tilt') await this.animTilt(ev);
            else if (ev.type === 'hades') await this.animHades(ev.cells);
        }
        this.tiltGroup.rotation.set(0, 0, 0);
        this.sync(state);
    }

    slide(from, to, quiet = false, dur = 0) {
        const L = this.L, stone = this.stones.get(from);
        if (!stone) return Promise.resolve();
        const a = cellPos(L, from), b = cellPos(L, to), dist = a.distanceTo(b);
        this.stones.delete(from); this.stones.set(to, stone); stone.userData.cell = to;
        if (!quiet) sfx('slide', dist);
        return this.tweens.run(dur || 0.2 + dist * 0.075, (k) => { stone.position.lerpVectors(a, b, dur ? ease.in(k) * (2 - ease.in(k)) : ease.inOut(k)); });
    }

    // the deck tips, every loose stone slides to the low side, the deck comes level again
    async animTilt(ev) {
        const [dr, dc] = STEP[ev.dir], g = this.tiltGroup, x0 = g.rotation.x, z0 = g.rotation.z;
        sfx('tilt');
        await this.tweens.run(0.42, (k) => { const e = ease.inOut(k); g.rotation.x = x0 + (LEAN * dr - x0) * e; g.rotation.z = z0 + (-LEAN * dc - z0) * e; });
        const far = Math.max(...ev.moves.map((mv) => Math.abs(mv.to - mv.from) / (dr ? this.L.S : 1)));
        // apply all slides at once: take every moving stone off the map first, so none overwrites another
        const moving = ev.moves.map((mv) => ({ mv, stone: this.stones.get(mv.from) }));
        for (const { mv } of moving) this.stones.delete(mv.from);
        const L = this.L;
        await Promise.all(moving.map(({ mv, stone }) => {
            if (!stone) return null;
            const a = cellPos(L, mv.from), b = cellPos(L, mv.to), dist = a.distanceTo(b);
            this.stones.set(mv.to, stone); stone.userData.cell = mv.to;
            return this.tweens.run(0.18 + dist * 0.08, (k) => { stone.position.lerpVectors(a, b, k * k); if (k === 1) sfx('place'); });
        }));
        if (far > 3) this.shake = 0.1;
        await this.tweens.run(0.4, (k) => { const e = ease.inOut(k); g.rotation.x = LEAN * dr * (1 - e); g.rotation.z = -LEAN * dc * (1 - e); });
    }

    // Hades takes the enclosed: they sink through the deck in a breath of embers
    animHades(cells) {
        sfx('hades');
        const p = new THREE.Vector3();
        return Promise.all(cells.map((c, n) => {
            const stone = this.stones.get(c.at);
            this.stones.delete(c.at);
            if (!stone) return null;
            return this.tweens.run(0.7, (k) => {
                stone.position.y = TOP - ease.in(k) * 0.5; stone.scale.setScalar(Math.max(0.001, 1 - ease.in(k) * 0.9));
                if (Math.random() < 0.3) { stone.getWorldPosition(p); this.embers.emit(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.2, p.z + (Math.random() - 0.5) * 0.4, 0, 0.5 + Math.random() * 0.5, 0, 0.9, 0.22, 0.8); }
                if (k === 1) this.stoneGroup.remove(stone);
            }, n * 0.06);
        }));
    }

    celebrate(color) {
        const p = new THREE.Vector3();
        for (const s of this.stones.values()) {
            if (s.userData.color !== color) continue;
            s.getWorldPosition(p); const q = p.clone(); q.y += 0.3;
            this.tweens.run(0.1, () => {}, Math.random() * 1.6).then(() => this.embers.burst(q, 10, { speed: 0.7, up: 1.8, size: 0.4, alpha: 1, life: 1.5 }));
        }
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, -3);

        if (this.selected) this.selected.position.y = TOP + 0.1 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.still) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.scale.set(1 + w * 0.1, 1 + w * 0.1, 1); o.material.opacity = 0.65 + w * 0.3;
        }
        this.seaMap.offset.x = (t * 0.006) % 1; this.seaMap.offset.y = (t * 0.004) % 1;
        for (const b of this.ships) {
            const u = b.userData;
            u.x += u.sp * dt; if (u.x > 340) u.x = -340; if (u.x < -340) u.x = 340;
            b.position.set(u.x, GROUND + 0.25 + Math.sin(t * 0.7 + u.z) * 0.1, u.z);
            b.rotation.x = Math.sin(t * 0.6 + u.z) * 0.05; b.rotation.y = u.sp < 0 ? Math.PI : 0;
        }
        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.2, u.cz + Math.sin(a) * u.r);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const flap = Math.sin(t * 5 + u.ph * 9) * 0.45;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        // the swell breaks on the moles under his feet
        if (Math.random() < dt * 6) { const s = Math.random() < 0.5 ? -1 : 1; this.spray.emit(s * (3.4 + Math.random() * 0.2), GROUND + 0.1, -18 + Math.random() * 26, -s * 0.3, 1.4 + Math.random(), 0, 1.2, 0.8 + Math.random() * 0.8, 0.35); }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : 'gull'); this.nextCall = 6 + Math.random() * 12; }
        }
        this.embers.update(dt); this.spray.update(dt);
    }
}
