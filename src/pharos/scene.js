// PHAROS — the world: the harbour of Alexandria under its lighthouse, a board of marble with five beacons,
// stones that move by light, effects and move animations.
import * as THREE from 'three';
import { layout, createState, isBeaconLight, beaconOf } from './rules.js';
import { Tweens, Particles, Lift, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { sandMaps } from '../textures.js';
import { materials, buildObelisk } from '../models.js';
import { makeStone, stoneMaterials } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -2.6;   // the sea; the board (tiles at y = 0) is the court of the fortress on Pharos island
const TOP = 0.05;
// the light of each colour: White burns pale gold, Black violet, Red and Blue in their own colours
export const LIGHT = [0, 0xfff0c0, 0x9d6bff, 0xff5a34, 0x4aa8ff];

export function cellPos(L, i, out = new THREE.Vector3()) {
    const mid = (L.S - 1) / 2;
    return out.set((i % L.S) - mid, TOP, Math.floor(i / L.S) - mid);
}
const BOWL_Y = 1.75;

// The lighthouse: a tall square stage with battered walls, an eight-sided stage, a round lantern for the fire,
// and Poseidon on the roof. It stands on four piers over the middle field, so a stone can pass beneath.
function buildTower(mat, gold, lamp) {
    const g = new THREE.Group();
    const stage = (r0, r1, h, y, sides, turn = 0) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, sides), mat); c.position.y = y + h / 2; c.rotation.y = turn; g.add(c); return c; };
    const y0 = BOWL_Y + 0.35;
    g.add(box(1.5, 0.3, 1.5, mat, 0, y0, 0));
    stage(1.02, 0.78, 5.2, y0 + 0.3, 4, Math.PI / 4);                       // the square stage
    g.add(box(1.5, 0.22, 1.5, mat, 0, y0 + 5.5, 0));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(box(0.2, 0.36, 0.2, mat, sx * 0.64, y0 + 5.72, sz * 0.64)); // tritons at the corners, in outline
    stage(0.52, 0.44, 2.3, y0 + 5.72, 8, Math.PI / 8);                      // the eight-sided stage
    g.add(cyl(0.6, 0.6, 0.14, mat, 0, y0 + 8.02, 0, 8));
    stage(0.3, 0.28, 0.5, y0 + 8.16, 12);                                   // the lantern: a drum, eight posts, the fire, a cone of a roof
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(cyl(0.03, 0.03, 0.62, mat, Math.cos(a) * 0.26, y0 + 8.66, Math.sin(a) * 0.26, 5)); }
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), lamp); fire.position.y = y0 + 8.95; fire.scale.y = 1.4; fire.userData.keep = true; g.add(fire);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.5, 12), mat); roof.position.y = y0 + 9.53; g.add(roof);
    g.add(cyl(0.035, 0.05, 0.5, gold, 0, y0 + 9.78, 0, 6));
    // narrow window slits up the square stage
    return { tower: g, fire };
}

// The fortress with its court as the board: walls, a bastion at every corner, the four corner beacons, and in the
// middle the lighthouse over the fifth. Returns { group, lift (the tower, to be raised for the game), L, fire, depth }.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), m = materials(), S = L.S, half = S / 2;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const group = new THREE.Group();
    const stone = m.limestone.clone(); stone.color.set(0xe8dfc8);
    const rock = m.darkstone.clone(); rock.color.set(0x9a8c74);
    const w = half + 0.75;                                   // middle line of the walls
    // the island: a low rock, the fortress terrace on it
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.9, w * 2.05, -GROUND - 0.2, 11), rock); isle.position.set(0.6, GROUND + (-GROUND - 0.2) / 2 - 0.5, 0.4); isle.scale.z = 0.86; group.add(isle);
    group.add(box(w * 2 + 1.4, 0.7, w * 2 + 1.4, stone, 0, -0.7, 0));
    group.add(box(S + 0.3, 0.03, S + 0.3, std({ color: 0x2a3640, roughness: 0.7 }), 0, 0, 0));
    // curtain walls, lower toward the visitor, with a gate in the near one; square bastions outside the corners
    const merlons = [];
    for (const [dx, dz, h] of [[0, -1, 1.25], [-1, 0, 1.0], [1, 0, 1.0], [0, 1, 0.6]]) {
        const len = w * 2 - 1.2, x = dx * w, z = dz * w;
        if (dz === 1) { for (const s of [-1, 1]) group.add(box(len / 2 - 0.7, h, 0.5, stone, s * (len / 4 + 0.35), 0, z)); }
        else group.add(box(dx ? 0.5 : len, h, dx ? len : 0.5, stone, x, 0, z));
        for (let k = -len / 2 + 0.3; k <= len / 2 - 0.2; k += 0.52) { if (dz === 1 && Math.abs(k) < 0.8) continue; merlons.push({ x: dx ? x : k, y: h + 0.1, z: dx ? k : z }); }
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const h = sz < 0 ? 1.9 : 1.35;
        group.add(box(1.5, h, 1.5, stone, sx * (w + 0.25), 0, sz * (w + 0.25)), box(1.7, 0.16, 1.7, stone, sx * (w + 0.25), h, sz * (w + 0.25)));
    }
    // the five beacons: four stone posts over the field carry a frame with the fire basket, open on every side
    for (const i of L.beacons) {
        const p = cellPos(L, i);
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) group.add(box(0.13, BOWL_Y, 0.13, stone, p.x + sx * 0.41, TOP, p.z + sz * 0.41));
        for (const [bw, bd, bx, bz] of [[0.95, 0.13, 0, 0.41], [0.95, 0.13, 0, -0.41], [0.13, 0.95, 0.41, 0], [0.13, 0.95, -0.41, 0]]) group.add(box(bw, 0.14, bd, stone, p.x + bx, BOWL_Y + TOP, p.z + bz));
        for (const r of [0, Math.PI / 2]) { const bar = box(0.95, 0.05, 0.05, m.bronze, p.x, BOWL_Y + 0.02, p.z); bar.rotation.y = r + Math.PI / 4; group.add(bar); }
        group.add(cyl(0.26, 0.12, 0.16, m.bronze, p.x, BOWL_Y + 0.04, p.z, 10));
    }
    shadowed(group);
    mergeByMaterial(group);
    const mm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.2, 0.5), stone, merlons.length), o = new THREE.Object3D();
    merlons.forEach((q, i) => { o.position.set(q.x, q.y, q.z); o.updateMatrix(); mm.setMatrixAt(i, o.matrix); });
    mm.castShadow = mm.receiveShadow = true; group.add(mm);

    const pale = new THREE.Color(0xe6e2d6), sea = new THREE.Color(0xa9c0cc), gold = new THREE.Color(0xdcb45a);
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), std({ roughness: 0.4, metalness: 0.05 }), L.N);
    for (let i = 0; i < L.N; i++) {
        cellPos(L, i, o.position).y = TOP - 0.05; o.updateMatrix(); tm.setMatrixAt(i, o.matrix);
        tm.setColorAt(i, L.beaconAt[i] >= 0 ? gold : (Math.floor(i / S) + i % S) % 2 ? sea : pale);
    }
    tm.receiveShadow = true; group.add(tm);

    // the lighthouse over the middle beacon: its own materials, so that it can be faded and lifted away
    const tmat = stone.clone(), tgold = m.gold.clone(), tlamp = m.lamp.clone();
    const { tower, fire } = buildTower(tmat, tgold, tlamp);
    shadowed(tower); fire.castShadow = false;
    mergeByMaterial(tower, (x) => x.userData.keep);
    group.add(tower);
    const lift = new Lift(tower, [tmat, tgold, tlamp], 2.5);

    if (mini) {
        const st = createState(nPlayers);
        for (let i = 0; i < L.N; i++) if (st.grid[i]) { const s = makeStone(st.grid[i], true); cellPos(L, i, s.position); group.add(s); }
    }
    return { group, L, fire, lift, depth: [w + 1.6, -(w + 1.6)] };
}

// ---------------------------------------------------------------- the world

export class PharosWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'coast';
        this.veil = 0xdce8ee;
        this.nPlayers = 0;
        this.stones = new Map();
        this.indicators = [];
        this.flames = [];
        const m = materials();
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xd2e2ea, 0.0036);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 130, left: -18, right: 18, top: 20, bottom: -14 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x7f98a8, 0.6); scene.add(this.hemi);

        const wn = sandMaps().normalMap.clone(); wn.repeat.set(26, 26); wn.needsUpdate = true;
        this.seaMap = wn;
        this.seaMat = new THREE.MeshPhysicalMaterial({ color: 0x2a7896, roughness: 0.16, metalness: 0.1, clearcoat: 1, normalMap: wn, normalScale: new THREE.Vector2(0.14, 0.14) });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.seaMat);
        sea.rotation.x = -Math.PI / 2; sea.position.y = GROUND; sea.receiveShadow = true; scene.add(sea);

        // Alexandria on the low shore to the south: the long mole to the island, the Mouseion, the needles, palms
        let hs = 41;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, flat = std({ roughness: 1, flatShading: true });
        const land = new THREE.Group(); scene.add(land);
        const sand = std({ color: 0xcdb98a, roughness: 1 }), lime = m.sandstone.clone(); lime.color.set(0xe6dcc6);
        land.add(box(900, 3.2, 300, sand, 0, GROUND - 1.6, 250));
        land.add(box(7, 1.4, 86, lime, 26, GROUND - 0.6, 58));                                   // the Heptastadion
        land.add(box(180, 1.2, 6, lime, -116, GROUND - 0.6, 4), box(6, 1.2, 60, lime, -206, GROUND - 0.6, 32)); // the rest of Pharos island and its mole
        const mus = new THREE.Group();                                                           // the Mouseion and its library
        mus.add(box(54, 2, 22, lime, 0, 0, 0), box(46, 9, 15, lime, 0, 2, 0), box(52, 1.6, 20, lime, 0, 11, 0));
        const gable = new THREE.Shape(); gable.moveTo(-26, 0); gable.lineTo(26, 0); gable.lineTo(0, 5); gable.closePath();
        const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 20, bevelEnabled: false }), m.terracotta); rf.position.set(0, 12.6, -10); mus.add(rf);
        for (let i = 0; i < 12; i++) mus.add(cyl(0.9, 1, 9, lime, -24.2 + i * 4.4, 2, -9.4, 8));
        mus.position.set(-40, GROUND + 1.6, 150); mus.rotation.y = Math.PI; land.add(mus);
        mergeByMaterial(shadowed(land, false, true));
        for (const x of [14, 40]) { const ob = buildObelisk(lime, m.gold, 1); ob.scale.setScalar(16); ob.position.set(x, GROUND + 1.6, 112); scene.add(ob); }
        const inst = (geo, mat, list) => {
            const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
            list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(0, t.ry || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (t.color) im.setColorAt(i, t.color); });
            scene.add(im);
        };
        const houses = [], trunks = [], crowns = [];
        for (let i = 0; i < 260; i++) {
            const x = -260 + hr() * 520, z = 108 + hr() * 170;
            if (Math.abs(x + 40) < 34 && Math.abs(z - 150) < 18) continue;
            const w = 4 + hr() * 7, h = 2.6 + hr() * 5, dd = 4 + hr() * 7;
            houses.push({ x: Math.round(x / 9) * 9, y: GROUND + 1.6 + h / 2, z: Math.round(z / 9) * 9, sx: w, sy: h, sz: dd, color: new THREE.Color().setHSL(0.1, 0.2, 0.8 + hr() * 0.14, sRGB) });
        }
        for (let i = 0; i < 70; i++) {
            const x = -230 + hr() * 460, z = 102 + hr() * 10 + (i % 3) * 30, h = 5 + hr() * 4;
            trunks.push({ x, y: GROUND + 1.6 + h / 2, z, sx: 0.24, sy: h, sz: 0.24 });
            crowns.push({ x, y: GROUND + 1.8 + h, z, sx: 2.2 + hr(), sy: 0.9, sz: 2.2 + hr(), ry: hr() * 6, color: new THREE.Color().setHSL(0.27 + hr() * 0.05, 0.45, 0.2 + hr() * 0.1, sRGB) });
        }
        inst(new THREE.BoxGeometry(1, 1, 1), std({ roughness: 1 }), houses);
        inst(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks);
        inst(new THREE.IcosahedronGeometry(1, 0), flat, crowns);

        // grain ships and galleys making for the harbour mouth
        this.ships = [];
        const hull = std({ color: 0x4a3524, roughness: 0.9 }), sail = std({ color: 0xe9dcc0, roughness: 1, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
            const b = new THREE.Group(), h = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), hull); h.scale.set(6, 0.8, 1.5); b.add(h);
            b.add(cyl(0.08, 0.1, 5.6, hull, 0, 0.3, 0, 6));
            const sl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), sail); sl.rotation.y = Math.PI / 2; sl.position.set(0.1, 3.9, 0); b.add(sl);
            b.userData = { x: -260 + i * 110, z: -70 - (i % 3) * 46 + (i > 2 ? 150 : 0), sp: (0.9 + i * 0.22) * (i % 2 ? 1 : -1) };
            scene.add(b); this.ships.push(b);
        }
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.7, 0, -0.06], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0xf0eee8, side: THREE.DoubleSide });
        for (let i = 0; i < 11; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 10 + Math.random() * 18, h: 10 + Math.random() * 12, sp: (0.13 + Math.random() * 0.08) * (i % 2 ? 1 : -1), ph: Math.random() * 9, cz: -10 + Math.random() * 10 };
            b.scale.setScalar(0.8 + Math.random() * 0.4); scene.add(b); this.birds.push(b);
        }
        this.nextCall = 6;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.flameGroup = new THREE.Group(); scene.add(this.flameGroup);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        this.beamGroup = new THREE.Group(); scene.add(this.beamGroup);
        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.sheet.rotation.x = -Math.PI / 2; this.sheet.position.y = TOP; scene.add(this.sheet);
        // the great fire: a light over the harbour by night, and a beam that sweeps the sea
        this.fireLight = new THREE.PointLight(0xffb060, 0, 90, 1.5); scene.add(this.fireLight);
        const sweepGeo = new THREE.CylinderGeometry(0.4, 9, 120, 16, 1, true); sweepGeo.translate(0, -60, 0); sweepGeo.rotateZ(Math.PI / 2);
        this.sweep = new THREE.Mesh(sweepGeo, new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        scene.add(this.sweep);
        // spent stones are shown dulled
        this.dull = stoneMaterials().map((mat) => { if (!mat) return null; const d = mat.clone(); d.color.multiplyScalar(0.42).lerp(new THREE.Color(0x444448), 0.35); d.clearcoat = 0; d.roughness = 0.9; return d; });

        this.sparks = new Particles(260, { color: 0xfff0c0, additive: true }); this.sparks.drag = 1.0; this.sparks.gravity = -0.5;
        this.spray = new Particles(140, { color: 0xeef6fa }); this.spray.drag = 1.4; this.spray.gravity = 1.2;
        scene.add(this.sparks.points, this.spray.points);
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear(); this.flameGroup.clear(); this.flames.length = 0;
            const { group, L, fire, lift } = buildBoard(state.nPlayers);
            this.L = L; this.fire = fire; this.lift = lift; this.boardGroup.add(group);
            this.sheet.scale.set(L.S, L.S, 1);
            this.quay = L.S / 2 + 2.6;
            if (fire) { fire.getWorldPosition(this.fireLight.position); this.sweep.position.copy(this.fireLight.position); }
            const fm = (o) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
            for (const i of L.beacons) {
                const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fm(0.7)), inner = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fm(0.95));
                outer.scale.set(1, 1.9, 1); outer.position.y = 0.26; inner.scale.set(1, 1.7, 1); inner.position.y = 0.18;
                g.add(outer, inner); cellPos(L, i, g.position).y = BOWL_Y + 0.14; g.visible = false;
                this.flameGroup.add(g); this.flames.push({ g, outer, inner, ph: Math.random() * 9, color: 0 });
            }
        }
        this.tweens.clear();
        this.sync(state);
        this.clearIndicators();
    }

    // The lighthouse stands over the board while the visitor arrives, and is lifted away for the game.
    reveal(on, animated = true) {
        if (!this.lift) return;
        this.lift.reveal(this.tweens, on, animated);
        this.sweep.visible = on; this.towerUp = on;
        this.applyFire();
    }
    applyFire() { const d = this.day; if (d) this.fireLight.intensity = d.lamps * (this.towerUp === false ? 40 : 320); }

    homeView(n = this.nPlayers) {
        const k = n === 2 ? 1 : 1.2;
        return { pos: new THREE.Vector3(-3.6 * k, 11 * k, 12 * k), target: new THREE.Vector3(0, 0.4, -0.8 * k) };
    }
    cameraLimits() { const k = this.nPlayers === 2 ? 1 : 1.2; return { min: 6 * k, max: 42 * k }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(60);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.95;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x7f98a8).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.4;
        const haze = new THREE.Color(0xd2e2ea).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(0xf0eee8).multiplyScalar(d.night ? 0.05 : 0.55 + d.keyPower * 0.1);
        for (const b of this.birds) b.visible = !d.night;
        this.seaMat.color.copy(d.skyTop).lerp(new THREE.Color(0x2a7896), 0.55).multiplyScalar(d.night ? 0.45 : 1);
        this.spray.material.uniforms.uColor.value.set(0xeef6fa).multiplyScalar(d.night ? 0.15 : Math.min(1, 0.4 + d.keyPower * 0.2));
        this.applyFire();
        this.sweep.material.opacity = d.lamps * 0.07;
    }

    // ------------------------------------------------------------ stones, beacons & indicators

    sync(state) {
        this.stoneGroup.clear(); this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) {
            if (!state.grid[i]) continue;
            const s = makeStone(state.grid[i]); cellPos(this.L, i, s.position); s.userData.cell = i;
            this.stoneGroup.add(s); this.stones.set(i, s);
        }
        this.setBeacons(state.lit);
    }

    setBeacons(lit) {
        this.flames.forEach((f, b) => {
            f.color = lit[b]; f.g.visible = lit[b] > 0;
            if (lit[b]) { f.outer.material.color.set(LIGHT[lit[b]]).multiplyScalar(0.8); f.inner.material.color.set(LIGHT[lit[b]]).lerp(new THREE.Color(0xffffff), 0.5); }
        });
    }

    // stones that have given their light this turn are shown dull
    setSpent(lights = []) {
        const spent = new Set(lights.filter((id) => !isBeaconLight(id)));
        for (const [cell, s] of this.stones) s.material = spent.has(cell) ? this.dull[s.userData.color] : stoneMaterials()[s.userData.color];
    }

    clearIndicators() {
        this.indicatorGroup.clear();
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = TOP; this.selected = null; }
    }

    // cell: the stone in hand; steps: where it may go next; lights: what can light it there; canStop: it has moved already
    showSelection(cell, steps, lights = [], canStop = false) {
        this.clearIndicators();
        const L = this.L, stone = this.stones.get(cell);
        if (stone) this.selected = stone;
        const ring = (r0, r1, color, at, y = 0.02) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; cellPos(L, at, mesh.position).y = TOP + y; mesh.userData.ph = Math.random() * 3;
            this.indicatorGroup.add(mesh); this.indicators.push(mesh);
            return mesh;
        };
        ring(0.4, 0.47, canStop ? 0xfff3c0 : 0xffd070, cell).userData.still = !canStop;
        for (const st of steps) { if (st.capture) ring(0.4, 0.47, 0xff5a30, st.to); else ring(0.14, 0.24, 0xfff3c0, st.to); }
        // the lights that can reach it: a small halo on each
        for (const id of lights) { const at = isBeaconLight(id) ? L.beacons[beaconOf(id)] : id; ring(0.3, 0.35, 0x8fd8ff, at, isBeaconLight(id) ? BOWL_Y + 0.1 : 0.42).userData.halo = true; }
    }

    // what is under the pointer: a field or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, this.sheet], false);
        if (!hits.length) return -1;
        if (hits[0].object !== this.sheet) return hits[0].object.userData.cell ?? -1;
        const L = this.L, p = hits[0].point, mid = (L.S - 1) / 2, c = Math.round(p.x + mid), r = Math.round(p.z + mid);
        return c < 0 || r < 0 || c >= L.S || r >= L.S ? -1 : r * L.S + c;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state, travel = true) {
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'step') { if (travel) await this.playStep(ev); }
            else if (ev.type === 'out') await this.animOut(ev);
        }
        this.sync(state);
    }

    // a ray of light from the stone or beacon that gives it, and the lit stone slides one field on
    async playStep(ev) {
        const L = this.L, stone = this.stones.get(ev.from);
        if (!stone) return;
        if (this.selected === stone) this.selected = null;
        const a = cellPos(L, ev.from), b = cellPos(L, ev.to), beacon = isBeaconLight(ev.light);
        const src = cellPos(L, beacon ? L.beacons[beaconOf(ev.light)] : ev.light); src.y = beacon ? BOWL_Y + 0.3 : 0.3;
        const dst = a.clone(); dst.y = 0.3;
        const len = src.distanceTo(dst), color = LIGHT[beacon ? this.flames[beaconOf(ev.light)].color || ev.color : ev.color];
        const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        ray.position.lerpVectors(src, dst, 0.5); ray.scale.set(1, len, 1); ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dst.clone().sub(src).normalize());
        this.beamGroup.add(ray);
        const giver = beacon ? null : this.stones.get(ev.light);
        sfx('beam');
        const victim = ev.capture ? this.stones.get(ev.to) : null;
        this.stones.delete(ev.from); this.stones.set(ev.to, stone); stone.userData.cell = ev.to;
        let hit = false;
        await this.tweens.run(0.5, (k) => {
            const flash = Math.sin(Math.PI * Math.min(1, k * 1.6));
            ray.material.opacity = flash * 0.85; ray.scale.x = ray.scale.z = 1 + flash * 1.2;
            if (k > 0.25) {
                const e = ease.inOut((k - 0.25) / 0.75);
                stone.position.lerpVectors(a, b, e);
                if (victim && !hit && e > 0.55) { hit = true; this.take(victim); }
            }
            if (k === 1) { stone.position.copy(b); this.beamGroup.remove(ray); if (giver) giver.material = this.dull[giver.userData.color]; }
        });
        if (ev.lit >= 0) { // the stone has stepped under a beacon: it takes fire in its colour
            const f = this.flames[ev.lit];
            f.color = ev.color; f.g.visible = true;
            f.outer.material.color.set(LIGHT[ev.color]).multiplyScalar(0.8); f.inner.material.color.set(LIGHT[ev.color]).lerp(new THREE.Color(0xffffff), 0.5);
            sfx('kindle');
            this.sparks.material.uniforms.uColor.value.set(LIGHT[ev.color]);
            this.sparks.burst(f.g.position, 14, { speed: 0.6, up: 1.3, size: 0.3, alpha: 0.9, life: 1.1 });
        }
    }

    // a taken stone goes out like a lamp
    take(stone) {
        sfx('take');
        const p = stone.position.clone(); p.y = 0.25;
        this.sparks.material.uniforms.uColor.value.set(0xfff0c0);
        this.sparks.burst(p, 8, { speed: 0.5, up: 0.7, size: 0.22, alpha: 0.8, life: 0.8 });
        this.tweens.run(0.4, (k) => { stone.scale.setScalar(Math.max(0.001, 1 - ease.in(k))); if (k === 1) this.stoneGroup.remove(stone); });
    }

    animOut(ev) {
        const list = ev.cells.map((c) => this.stones.get(c)).filter(Boolean);
        for (const c of ev.cells) this.stones.delete(c);
        if (!list.length) return Promise.resolve();
        sfx('defeat');
        return this.tweens.run(0.9, (k) => { for (const s of list) s.scale.setScalar(Math.max(0.001, 1 - k)); });
    }

    celebrate(color) {
        this.sparks.material.uniforms.uColor.value.set(LIGHT[color]);
        for (const s of this.stones.values()) {
            if (s.userData.color !== color) continue;
            const q = s.position.clone(); q.y = 0.3;
            this.tweens.run(0.1, () => {}, Math.random() * 1.6).then(() => this.sparks.burst(q, 10, { speed: 0.7, up: 1.8, size: 0.4, alpha: 1, life: 1.5 }));
        }
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, -4);

        if (this.selected) this.selected.position.y = TOP + 0.1 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.still) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.material.opacity = o.userData.halo ? 0.45 + w * 0.25 : 0.65 + w * 0.3;
            if (!o.userData.halo) o.scale.set(1 + w * 0.1, 1 + w * 0.1, 1);
        }
        for (const f of this.flames) {
            if (!f.g.visible) continue;
            const fl = 0.85 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.g.scale.set(fl, 0.8 + fl * 0.5, fl);
        }
        this.seaMap.offset.x = (t * 0.006) % 1; this.seaMap.offset.y = (t * 0.004) % 1;
        this.sweep.rotation.y = t * 0.22;
        if (this.fire) this.fire.scale.setScalar(1 + Math.sin(t * 11) * 0.1 + Math.sin(t * 27) * 0.06);
        for (const b of this.ships) {
            const u = b.userData;
            u.x += u.sp * dt; if (u.x > 360) u.x = -360; if (u.x < -360) u.x = 360;
            b.position.set(u.x, GROUND + 0.3 + Math.sin(t * 0.7 + u.z) * 0.1, u.z);
            b.rotation.x = Math.sin(t * 0.6 + u.z) * 0.05; b.rotation.y = u.sp < 0 ? Math.PI : 0;
        }
        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.2, u.cz + Math.sin(a) * u.r);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const flap = Math.sin(t * 5 + u.ph * 9) * 0.45;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (this.quay && Math.random() < dt * 5) { const s = this.quay + 0.6, u = (Math.random() - 0.5) * 2 * s, side = Math.random() < 0.5; this.spray.emit(side ? u : (Math.random() < 0.5 ? -s : s), GROUND + 0.1, side ? s : u, 0, 1.2 + Math.random(), 0.2, 1.1, 0.5 + Math.random() * 0.5, 0.35); }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : 'gull'); this.nextCall = 6 + Math.random() * 12; }
        }
        this.sparks.update(dt); this.spray.update(dt);
    }
}
