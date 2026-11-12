// MAUSOLEUM — the world: the tomb of Mausolus above the harbour of Halicarnassus, the floor of six-sided slabs,
// stones, effects and move animations.
import * as THREE from 'three';
import { layout, createState, PIT } from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { paveMaps, canvasTexture } from '../textures.js';
import { materials } from '../models.js';
import { makeStone } from '../pyramid/scene.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -1.4;   // the terrace; the slabs (top at y = 0) lie on a dark floor half a unit below
const SLAB = 0.5;

export const cellPos = (L, i, out = new THREE.Vector3()) => out.set(L.x[i], 0, L.z[i]);
// half-width of the longest row (a) and of the end rows (b), and the half-depth (hz)
function extents(L) {
    let a = 0, b = 0, hz = 0;
    for (let i = 0; i < L.N; i++) { a = Math.max(a, Math.abs(L.x[i])); hz = Math.max(hz, Math.abs(L.z[i])); }
    for (let i = 0; i < L.N; i++) if (Math.abs(Math.abs(L.z[i]) - hz) < 0.01) b = Math.max(b, Math.abs(L.x[i]));
    return { a, b, hz };
}
// a six-sided slab of the given outline, standing on y
function hexSlab(a, b, hz, h, mat, y) {
    const s = new THREE.Shape();
    [[-a, 0], [-b, -hz], [b, -hz], [a, 0], [b, hz], [-b, hz]].forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    g.rotateX(Math.PI / 2); // the shape's y runs along z; the slab hangs down from its top face
    const m = new THREE.Mesh(g, mat); m.position.y = y + h;
    return m;
}

// ---------------------------------------------------------------- the tomb
// The Mausoleum: a high podium banded with friezes, thirty-six columns, a pyramid of steps, the four-horse chariot.
function buildTomb(mini) {
    const m = materials(), g = new THREE.Group();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const marble = m.marble.clone(); marble.color.set(0xf2ede2); marble.roughness = 0.5;
    const blue = std({ color: 0x5f7f9c, roughness: 0.6 }), band = std({ color: 0xb9743c, roughness: 0.7 });
    g.add(box(9.2, 0.35, 10.6, marble, 0, 0, 0), box(8.4, 0.35, 9.8, marble, 0, 0.35, 0));
    g.add(box(7.4, 4.0, 8.8, marble, 0, 0.7, 0));
    g.add(box(7.46, 0.34, 8.86, band, 0, 2.3, 0), box(7.46, 0.34, 8.86, blue, 0, 4.2, 0), box(7.8, 0.2, 9.2, marble, 0, 4.7, 0));
    const cols = [], y0 = 4.9, ch = 2.5;
    for (let i = 0; i < 9; i++) for (const z of [-4.1, 4.1]) cols.push([-3.4 + i * 0.85, z]);
    for (let j = 1; j < 10; j++) for (const x of [-3.4, 3.4]) cols.push([x, -4.1 + j * 0.82]);
    const cm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.18, ch, mini ? 6 : 10), marble, cols.length), d = new THREE.Object3D();
    cols.forEach(([x, z], i) => { d.position.set(x, y0 + ch / 2, z); d.updateMatrix(); cm.setMatrixAt(i, d.matrix); });
    cm.castShadow = cm.receiveShadow = true; cm.userData.keep = true; g.add(cm);
    g.add(box(5.4, ch, 6.8, marble, 0, y0, 0), box(7.7, 0.45, 9.1, marble, 0, y0 + ch, 0), box(7.76, 0.14, 9.16, blue, 0, y0 + ch + 0.16, 0));
    let y = y0 + ch + 0.45;
    for (let i = 0; i < 8; i++) { const k = i / 8; g.add(box(7.5 - k * 5.6, 0.36, 8.9 - k * 6.4, marble, 0, y, 0)); y += 0.36; }
    g.add(box(1.5, 0.4, 2.2, marble, 0, y, 0)); y += 0.4;
    // the quadriga, in bronze
    g.add(box(0.5, 0.36, 0.5, m.bronze, 0, y + 0.1, -0.6), cyl(0.09, 0.11, 0.7, m.bronze, 0, y + 0.4, -0.6, 6));
    for (const x of [-0.45, -0.15, 0.15, 0.45]) {
        const horse = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), m.bronze); horse.scale.set(0.8, 1.1, 2.3); horse.position.set(x, y + 0.42, 0.25); g.add(horse);
        const neck = cyl(0.06, 0.09, 0.4, m.bronze, x, y + 0.48, 0.55, 5); neck.rotation.x = 0.5; g.add(neck);
        for (const z of [0.0, 0.5]) g.add(cyl(0.03, 0.03, 0.34, m.bronze, x, y, z, 4));
    }
    // lions keeping watch on the podium's foot
    if (!mini) for (const x of [-3, -1, 1, 3]) { const lion = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), marble); lion.scale.set(0.8, 0.9, 1.7); lion.position.set(x, 0.92, 4.6); g.add(lion); const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), marble); head.position.set(x, 1.12, 4.95); g.add(head); }
    return g;
}

// Builds the floor and the tomb behind it. Returns { group, tiles, L }.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), m = materials(), group = new THREE.Group();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const { a, b, hz } = extents(L);
    const marble = m.marble.clone(); marble.color.set(0xe9e3d6); marble.roughness = 0.55;
    const dark = std({ color: 0x131214, roughness: 0.9 });
    // the dark floor the slabs rest on, and two marble steps down to the terrace
    group.add(hexSlab(a + 1.25, b + 0.75, hz + 1.0, 0.06, dark, -SLAB - 0.06));
    group.add(hexSlab(a + 1.6, b + 0.95, hz + 1.3, 0.42, marble, -SLAB - 0.48), hexSlab(a + 2.1, b + 1.25, hz + 1.75, -GROUND - SLAB - 0.48, marble, GROUND));
    const tomb = buildTomb(mini), tz = -(hz + 1.75 + 5.7);
    tomb.position.set(0, GROUND, tz); group.add(tomb);
    group.add(box(3.4, 0.16, 1.4, marble, 0, GROUND, -(hz + 1.75) - 0.5)); // the way between floor and tomb
    shadowed(group);
    mergeByMaterial(group, (o) => o.userData.keep);

    // the slabs: every field is one, and can fall
    const tiles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.555, 0.555, SLAB, 6), std({ roughness: 0.5, metalness: 0.03 }), L.N);
    const d = new THREE.Object3D(), tone = [0xd9d2c2, 0xbfb8aa, 0xcbc2ae];
    for (let i = 0; i < L.N; i++) {
        d.position.set(L.x[i], -SLAB / 2, L.z[i]); d.updateMatrix(); tiles.setMatrixAt(i, d.matrix);
        tiles.setColorAt(i, new THREE.Color(tone[(Math.round(L.x[i] * 2) + L.rowOf[i] * 3 + 60) % 3]));
    }
    tiles.castShadow = tiles.receiveShadow = true; group.add(tiles);

    if (mini) {
        const st = createState(nPlayers);
        for (let i = 0; i < L.N; i++) if (st.grid[i]) { const s = makeStone(st.grid[i], true); cellPos(L, i, s.position); group.add(s); }
    }
    return { group, tiles, L, ext: { a, b, hz }, tombZ: tz };
}

// ---------------------------------------------------------------- the world

export class MausoleumWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'coast';
        this.veil = 0xe6e4dc;
        this.nPlayers = 0;
        this.stones = new Map();
        this.indicators = [];
        const m = materials();
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xd0dbe2, 0.004);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 110, left: -18, right: 18, top: 18, bottom: -18 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0xa09870, 0.6); scene.add(this.hemi);

        // the terrace above the town, dry Carian earth around it, the bay to the south
        const earth = canvasTexture(512, 512, (x, W, H) => {
            x.fillStyle = '#a89868'; x.fillRect(0, 0, W, H);
            let s = 13;
            const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
            for (let i = 0; i < 900; i++) {
                x.fillStyle = ['rgba(120,130,70,0.3)', 'rgba(190,170,120,0.3)', 'rgba(100,110,60,0.25)', 'rgba(150,130,90,0.3)'][i % 4];
                x.beginPath(); x.ellipse(r() * W, r() * H, 6 + r() * 36, 4 + r() * 18, r() * 3, 0, 7); x.fill();
            }
        });
        earth.wrapS = earth.wrapT = THREE.RepeatWrapping; earth.repeat.set(14, 14);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), std({ map: earth, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND - 0.02; ground.receiveShadow = true; scene.add(ground);
        const pave = paveMaps(), pm = pave.map.clone(), pn = pave.normalMap.clone();
        pm.repeat.set(10, 12); pn.repeat.set(10, 12); pm.needsUpdate = pn.needsUpdate = true;
        const court = box(40, 0.08, 46, std({ map: pm, normalMap: pn, roughness: 0.9, color: 0xece2cc }), 0, GROUND - 0.06, -6); court.receiveShadow = true; scene.add(court);
        const wall = new THREE.Group(); scene.add(wall); // the terrace wall, with its gate toward the harbour
        const lime = m.sandstone.clone(); lime.color.set(0xe2d8c2);
        for (const [w, dd, x, z] of [[40.8, 0.8, 0, -29.4], [0.8, 46, -20.4, -6], [0.8, 46, 20.4, -6], [16, 0.8, -12.4, 17.4], [16, 0.8, 12.4, 17.4]]) wall.add(box(w, 1.5, dd, lime, x, GROUND, z));
        for (const x of [-4.2, 4.2]) wall.add(box(1.4, 3.4, 1.4, lime, x, GROUND, 17.4));
        wall.add(box(9.8, 0.5, 1.6, lime, 0, GROUND + 3.4, 17.4));
        mergeByMaterial(shadowed(wall));

        this.seaMat = new THREE.MeshPhysicalMaterial({ color: 0x2f6f8f, roughness: 0.14, metalness: 0.1, clearcoat: 1 });
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), this.seaMat);
        sea.rotation.x = -Math.PI / 2; sea.position.set(0, GROUND - 3.2, 400); scene.add(sea);
        const shore = box(1400, 3.4, 30, std({ color: 0x9c8c62, roughness: 1 }), 0, GROUND - 3.42, 50); scene.add(shore);

        let hs = 77;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, flat = std({ roughness: 1, flatShading: true });
        const inst = (geo, mat, list, cast) => {
            const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
            list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(0, t.ry || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (t.color) im.setColorAt(i, t.color); });
            im.castShadow = cast; scene.add(im);
        };
        // the hills that close the bay like a theatre, the town on their slopes
        const hills = [], houses = [], roofs = [];
        for (let i = 0; i < 24; i++) {
            const a = -1.9 + (i / 23) * 3.8, dist = 130 + hr() * 150, h = 30 + hr() * 60;
            hills.push({ x: Math.sin(a) * dist, y: GROUND - 3, z: -Math.cos(a) * dist + 20, sx: 55 + hr() * 60, sy: h, sz: 55 + hr() * 60, ry: hr() * 6, color: new THREE.Color().setHSL(0.17 + hr() * 0.08, 0.26, 0.42 + hr() * 0.12, sRGB) });
        }
        for (let i = 0; i < 190; i++) {
            const a = -1.7 + hr() * 3.4, dist = 44 + hr() * 70, x = Math.sin(a) * dist, z = -Math.cos(a) * dist + 12;
            if (Math.abs(x) < 24 && z > -34 && z < 22) continue;
            const y = GROUND + Math.max(0, dist - 46) * 0.32, w = 3 + hr() * 4, h = 2.4 + hr() * 2.6, dd = 3 + hr() * 4;
            houses.push({ x, y: y + h / 2, z, sx: w, sy: h + (dist - 44) * 0.1, sz: dd, ry: a, color: new THREE.Color().setHSL(0.1, 0.2, 0.8 + hr() * 0.12, sRGB) });
            roofs.push({ x, y: y + h + 0.2 + (dist - 44) * 0.05, z, sx: w + 0.4, sy: 0.4, sz: dd + 0.4, ry: a });
        }
        const unit = new THREE.BoxGeometry(1, 1, 1);
        inst(new THREE.IcosahedronGeometry(1, 1), flat, hills, false);
        inst(unit, std({ roughness: 1 }), houses, false);
        inst(unit, m.terracotta, roofs, false);
        // the theatre cut into the hill, and cypresses along the terrace
        const theatre = new THREE.Group();
        for (let i = 0; i < 7; i++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(16 + i * 2.6, 16 + i * 2.6, 1.3, 28, 1, true, Math.PI * 0.5, Math.PI), lime); ring.position.y = i * 1.3; theatre.add(ring); }
        theatre.rotation.y = Math.PI; theatre.position.set(-62, GROUND + 14, -78); theatre.traverse((o) => { if (o.isMesh) o.material.side = THREE.DoubleSide; }); scene.add(theatre);
        const cyp = [], trunks = [], olive = [];
        for (let i = 0; i < 40; i++) {
            const side = i % 2 ? 1 : -1, z = -34 + (i >> 1) * 2.7, h = 5 + hr() * 3.5;
            cyp.push({ x: side * (22.5 + (i % 3) * 1.5), y: GROUND + h / 2, z, sx: 0.85, sy: h, sz: 0.85, color: new THREE.Color().setHSL(0.33, 0.35, 0.14 + hr() * 0.06, sRGB) });
        }
        for (let i = 0; i < 70; i++) {
            const a = -2 + hr() * 4, dist = 30 + hr() * 60, x = Math.sin(a) * dist, z = -Math.cos(a) * dist + 6, s = 1.4 + hr() * 1.2;
            if (Math.abs(x) < 24 && z > -34 && z < 22) continue;
            trunks.push({ x, y: GROUND + 0.7, z, sx: 0.16, sy: 1.4, sz: 0.16 });
            olive.push({ x, y: GROUND + 1.5 + s * 0.5, z, sx: s, sy: s * 0.7, sz: s, ry: hr() * 6, color: new THREE.Color().setHSL(0.24 + hr() * 0.05, 0.22, 0.34 + hr() * 0.1, sRGB) });
        }
        inst(new THREE.ConeGeometry(1, 1, 7), flat, cyp, true);
        inst(new THREE.IcosahedronGeometry(1, 0), flat, olive, true);
        inst(new THREE.CylinderGeometry(0.7, 1, 1, 5), m.wood, trunks, false);

        // galleys in the bay
        this.ships = [];
        const hull = std({ color: 0x4a3524, roughness: 0.9 }), sail = std({ color: 0xe8dcc4, roughness: 1, side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Group(), h = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), hull); h.scale.set(5.5, 0.6, 1.3); b.add(h);
            b.add(cyl(0.08, 0.1, 5, hull, 0, 0.3, 0, 6));
            const sl = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.2), sail); sl.rotation.y = Math.PI / 2; sl.position.set(0.1, 3.6, 0); b.add(sl);
            b.userData = { z: 95 + i * 38, x: -160 + i * 90, sp: (0.6 + i * 0.15) * (i % 2 ? 1 : -1) };
            scene.add(b); this.ships.push(b);
        }
        // gulls over the water
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.7, 0, -0.06], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0xf0eee8, side: THREE.DoubleSide });
        for (let i = 0; i < 9; i++) {
            const b = new THREE.Group(), wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 10 + Math.random() * 16, h: 9 + Math.random() * 7, sp: (0.14 + Math.random() * 0.08) * (i % 2 ? 1 : -1), ph: Math.random() * 9, cz: 14 + Math.random() * 14 };
            b.scale.setScalar(0.8 + Math.random() * 0.3); scene.add(b); this.birds.push(b);
        }
        this.nextCall = 9;

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.props = new THREE.Group(); scene.add(this.props);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);
        this.flames = [];
        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.sheet.rotation.x = -Math.PI / 2; scene.add(this.sheet);

        this.puffs = new Particles(260, { color: 0xe6e0d2 }); this.puffs.drag = 1.6; this.puffs.gravity = 0.25;
        this.sparks = new Particles(220, { color: 0xfff0c0, additive: true }); this.sparks.drag = 1.0; this.sparks.gravity = -0.5;
        scene.add(this.puffs.points, this.sparks.points);
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear(); this.props.clear(); this.flames.length = 0;
            const { group, tiles, L, ext } = buildBoard(state.nPlayers);
            this.L = L; this.tiles = tiles; this.ext = ext; this.boardGroup.add(group);
            this.sheet.scale.set(ext.a * 2 + 2, ext.hz * 2 + 2, 1);
            for (const [x, z, lit] of [[-ext.a - 1.2, 0, 1], [ext.a + 1.2, 0, 1], [-2.6, -ext.hz - 1.6, 0], [2.6, -ext.hz - 1.6, 1]]) this.addTripod(x, z, lit);
        }
        this.tweens.clear();
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
        g.position.set(x, -SLAB, z); this.props.add(g);
        this.flames.push({ flame, light, ph: Math.random() * 10 });
    }

    homeView(n = this.nPlayers) {
        return n === 2 ? { pos: new THREE.Vector3(-3.4, 10.4, 11.4), target: new THREE.Vector3(0, 0.3, -1.0) }
            : { pos: new THREE.Vector3(-4.2, 12.6, 12.8), target: new THREE.Vector3(0, 0.3, -1.2) };
    }
    cameraLimits() { return this.nPlayers === 2 ? { min: 6, max: 36 } : { min: 7, max: 42 }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(55);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower * 0.92;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0xa09870).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.35;
        const haze = new THREE.Color(0xd0dbe2).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.35 * (1 - d.low * 0.6));
        this.birdMat.color.set(0xf0eee8).multiplyScalar(d.night ? 0.05 : 0.55 + d.keyPower * 0.1);
        for (const b of this.birds) b.visible = !d.night;
        this.seaMat.color.copy(d.skyTop).lerp(new THREE.Color(0x2f6f8f), 0.5).multiplyScalar(d.night ? 0.5 : 1);
        this.puffs.material.uniforms.uColor.value.set(0xe6e0d2).multiplyScalar(d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2));
    }

    // ------------------------------------------------------------ stones, slabs & indicators

    setTile(i, y, scale = 1, tilt = 0) {
        const o = this.tmp || (this.tmp = new THREE.Object3D());
        o.position.set(this.L.x[i], -SLAB / 2 + y, this.L.z[i]); o.scale.setScalar(scale); o.rotation.set(tilt, 0, tilt * 0.6); o.updateMatrix();
        this.tiles.setMatrixAt(i, o.matrix); this.tiles.instanceMatrix.needsUpdate = true;
    }

    sync(state) {
        for (const [, mesh] of this.stones) this.stoneGroup.remove(mesh);
        this.stoneGroup.clear(); this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) {
            const v = state.grid[i];
            this.setTile(i, 0, v === PIT ? 0.0001 : 1);
            if (!v || v === PIT) continue;
            const s = makeStone(v); cellPos(this.L, i, s.position); s.userData.cell = i;
            this.stoneGroup.add(s); this.stones.set(i, s);
        }
    }

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = 0; this.selected = null; }
    }

    showSelection(cell, moves) {
        this.clearIndicators();
        const L = this.L, stone = this.stones.get(cell);
        if (stone) this.selected = stone;
        const ring = (r0, r1, color, at, y = 0.02) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; cellPos(L, at, mesh.position).y = y; mesh.userData.ph = Math.random() * 3;
            this.indicatorGroup.add(mesh); this.indicators.push(mesh);
            return mesh;
        };
        ring(0.4, 0.47, 0xffd070, cell).userData.still = true;
        for (const mv of moves) {
            if (mv.type === 'glide') ring(0.15, 0.25, 0xffe08a, mv.to);
            else { ring(0.4, 0.47, mv.kill ? 0xff4a2a : 0xffa030, mv.to); ring(0.1, 0.17, mv.kill ? 0xff4a2a : 0xffa030, mv.pushTo, mv.kill ? -SLAB + 0.03 : 0.02); }
        }
    }

    // what is under the pointer: a field or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, this.sheet], false);
        if (!hits.length) return -1;
        if (hits[0].object !== this.sheet) return hits[0].object.userData.cell ?? -1;
        const L = this.L, p = hits[0].point;
        let best = -1, bd = 0.36;
        for (let i = 0; i < L.N; i++) { const dd = (L.x[i] - p.x) ** 2 + (L.z[i] - p.z) ** 2; if (dd < bd) { bd = dd; best = i; } }
        return best;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state) {
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'glide') await this.slide(ev.from, ev.to);
            else if (ev.type === 'push') await this.animPush(ev);
            else if (ev.type === 'collapse' || ev.type === 'out') await this.animCollapse(ev.cells);
        }
        this.sync(state);
    }

    slide(from, to, quiet = false) {
        const L = this.L, stone = this.stones.get(from);
        if (!stone) return Promise.resolve();
        const a = cellPos(L, from), b = cellPos(L, to), dist = a.distanceTo(b);
        this.stones.delete(from); this.stones.set(to, stone); stone.userData.cell = to;
        if (!quiet) sfx('slide', dist);
        return this.tweens.run(0.2 + dist * 0.075, (k) => {
            stone.position.lerpVectors(a, b, ease.inOut(k));
            if (k === 1 && dist > 1.5) this.puffs.burst(b, 4, { speed: 0.4, up: 0.12, size: 0.35, alpha: 0.22, life: 0.7 });
        });
    }

    animPush(ev) {
        sfx('push');
        if (!ev.kill) return Promise.all([this.slide(ev.to, ev.pushTo, true), this.slide(ev.from, ev.to, true)]);
        // into the pit: the pushed stone tips over the edge and is gone
        const L = this.L, victim = this.stones.get(ev.to), a = cellPos(L, ev.to), b = cellPos(L, ev.pushTo);
        this.stones.delete(ev.to);
        const fall = victim ? this.tweens.run(0.75, (k) => {
            const e = Math.min(1, k * 1.8);
            victim.position.lerpVectors(a, b, ease.out(e)); victim.position.y = -(Math.max(0, k - 0.4) ** 2) * 9;
            victim.rotation.x = (b.z - a.z) * k * 3; victim.rotation.z = -(b.x - a.x) * k * 3;
            if (k === 1) { this.stoneGroup.remove(victim); sfx('fall'); }
        }) : Promise.resolve();
        return Promise.all([fall, this.slide(ev.from, ev.to, true)]);
    }

    // encircled stones fall with their slabs; the fields are pits from now on
    animCollapse(cells) {
        sfx('collapse');
        this.shake = 0.18;
        return Promise.all(cells.map((c, n) => {
            const stone = this.stones.get(c.at), p = cellPos(this.L, c.at);
            this.stones.delete(c.at);
            return this.tweens.run(0.9, (k) => {
                const y = -(k * k) * 5;
                this.setTile(c.at, y, 1 - k * 0.3, k * 0.5);
                if (stone) { stone.position.y = y; stone.rotation.x = k * 0.5; }
                if (k === 1) { this.setTile(c.at, 0, 0.0001); if (stone) this.stoneGroup.remove(stone); }
            }, n * 0.12).then(() => this.puffs.burst(new THREE.Vector3(p.x, -0.3, p.z), 12, { speed: 0.6, up: 0.9, size: 0.7, alpha: 0.4, life: 1.3, spread: 0.5 }));
        }));
    }

    celebrate(color) {
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

        if (this.selected) this.selected.position.y = 0.1 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.still) continue;
            const w = Math.sin(t * 5 + o.userData.ph);
            o.scale.set(1 + w * 0.1, 1 + w * 0.1, 1); o.material.opacity = 0.65 + w * 0.3;
        }
        for (const b of this.ships) {
            const u = b.userData;
            u.x += u.sp * dt; if (u.x > 320) u.x = -320; if (u.x < -320) u.x = 320;
            b.position.set(u.x, GROUND - 3 + Math.sin(t * 0.7 + u.z) * 0.08, u.z);
            b.rotation.x = Math.sin(t * 0.6 + u.z) * 0.04;
        }
        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.2, u.cz + Math.sin(a) * u.r);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const flap = Math.sin(t * 5 + u.ph * 9) * 0.45;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day) {
            this.nextCall -= dt;
            if (this.nextCall < 0) { sfx(this.day.night ? 'cricket' : Math.random() < 0.55 ? 'gull' : 'cicada'); this.nextCall = 7 + Math.random() * 13; }
        }
        this.puffs.update(dt); this.sparks.update(dt);

        const lamps = this.day ? this.day.lamps : 0;
        for (const f of this.flames) {
            const fl = 0.8 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.flame.visible = lamps > 0.05;
            f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
            if (f.light) f.light.intensity = lamps * 12 * fl;
        }
    }
}
