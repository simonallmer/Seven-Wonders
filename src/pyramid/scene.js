// PYRAMID — the world: Giza plateau, the stepped board, stones, effects and move animations.
import * as THREE from 'three';
import { heightAt, isVictoryCell, apexHeight, createState } from './rules.js';
import { Tweens, Particles, ease, box, cyl, shadowed } from '../fx.js';
import { sandMaps, paveMaps, limestoneMaps, fbm } from '../textures.js';
import { materials, buildSphinx, buildObelisk, buildPalm } from '../models.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const STEP = 0.42;     // height of one step
const GAP = 0.035;            // joint between blocks

export const cellX = (B, i) => (i % B) - (B - 1) / 2;
export const cellZ = (B, i) => Math.floor(i / B) - (B - 1) / 2;
export const cellTop = (B, i) => (heightAt(B, Math.floor(i / B), i % B) + 1) * STEP;
const cellPos = (B, i, out = new THREE.Vector3()) => out.set(cellX(B, i), cellTop(B, i), cellZ(B, i));

// ---------------------------------------------------------------- stones

let stoneGeo = null, stoneGeoLow = null;
function stoneGeometry(low) {
    const pts = [[0, 0], [0.3, 0], [0.355, 0.05], [0.37, 0.13], [0.34, 0.23], [0.26, 0.32], [0.14, 0.375], [0, 0.39]]
        .map(([x, y]) => new THREE.Vector2(x, y));
    if (low) return stoneGeoLow || (stoneGeoLow = new THREE.LatheGeometry(pts, 12));
    if (!stoneGeo) {
        const curve = new THREE.SplineCurve(pts);
        stoneGeo = new THREE.LatheGeometry(curve.getPoints(18), 40);
    }
    return stoneGeo;
}

let stoneMats = null;
export function stoneMaterials() {
    if (stoneMats) return stoneMats;
    const P = (o) => new THREE.MeshPhysicalMaterial({ clearcoat: 0.8, clearcoatRoughness: 0.2, ...o });
    stoneMats = [null,
        P({ color: 0xefe2c6, roughness: 0.42, clearcoat: 0.35 }),              // alabaster
        P({ color: 0x14110e, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }), // obsidian
        P({ color: 0xa3261a, roughness: 0.22 }),                           // carnelian
        P({ color: 0x1d3e9c, roughness: 0.26, metalness: 0.15 }),          // lapis lazuli
    ];
    return stoneMats;
}
export const STONE_CSS = ['', '#f3ead6', '#1c1815', '#b23324', '#2a50b8'];

export function makeStone(color, low = false) {
    const m = new THREE.Mesh(stoneGeometry(low), stoneMaterials()[color]);
    m.castShadow = true; m.receiveShadow = !low;
    m.userData.color = color;
    return m;
}

// ---------------------------------------------------------------- the board

// box whose texture runs at a constant scale on every face, with a random offset
function blockGeometry(w, h, d, rnd) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, S = 0.42;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const ou = rnd(), ov = rnd();
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, uv.getX(i) * dims[f][0] * S + ou + f * 0.37, uv.getY(i) * dims[f][1] * S + ov);
    }
    return g;
}

// Builds the stepped pyramid. Returns { group, blocks[] } — blocks[i].userData.cell = i.
export function buildBoard(B, { mini = false } = {}) {
    const m = materials();
    const group = new THREE.Group(), blocks = [];
    let seed = B * 7919;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const top = apexHeight(B);
    const tints = [0.86, 0.92, 0.97, 1.03, 1.08].map((k) => {
        const mat = m.limestone.clone(); mat.color.setRGB(0.95 * k, 0.86 * k, 0.7 * k); return mat;
    });
    const petalGeo = new THREE.TorusGeometry(0.105, 0.022, 6, mini ? 14 : 28);
    const casing = m.limestone.clone(); casing.color.setRGB(1.05, 1.0, 0.9); casing.roughness = 0.55;
    for (let i = 0; i < B * B; i++) {
        const h = heightAt(B, Math.floor(i / B), i % B);
        const H = (h + 1) * STEP;
        const mat = h === top ? casing : tints[Math.min(4, Math.max(0, Math.floor(rnd() * 3) + Math.round(h * 2 / top)))];
        const blk = new THREE.Mesh(blockGeometry(1 - GAP, H, 1 - GAP, rnd), mat);
        blk.position.set(cellX(B, i), H / 2 - rnd() * 0.012, cellZ(B, i));
        blk.rotation.y = (rnd() - 0.5) * 0.012;
        blk.castShadow = blk.receiveShadow = true;
        blk.userData.cell = i;
        group.add(blk); blocks.push(blk);
        if (isVictoryCell(B, i)) { // victory field: a four-petalled flower, one petal for each way a stone can move
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const petal = new THREE.Mesh(petalGeo, m.gold);
                petal.rotation.x = -Math.PI / 2;
                petal.scale.set(dx ? 1.55 : 1, dz ? 1.55 : 1, 1);
                petal.position.set(blk.position.x + dx * 0.2, H + 0.006, blk.position.z + dz * 0.2);
                petal.receiveShadow = true; group.add(petal);
            }
        }
    }
    // dark core so the joints read as shadow, never as sky
    const core = box(B - 0.3, 0.3, B - 0.3, m.ink, 0, 0, 0); group.add(core);
    for (let l = 1; l <= top; l++) group.add(box(B - 2 * l - 0.3, STEP, B - 2 * l - 0.3, m.ink, 0, l * STEP - 0.2, 0));
    // gold trim around the summit field
    const s = 0.5 + 0.02, ty = (top + 1) * STEP;
    for (const [w, d, x, z] of [[2 * s, 0.05, 0, -s], [2 * s, 0.05, 0, s], [0.05, 2 * s, -s, 0], [0.05, 2 * s, s, 0]]) {
        group.add(box(w - (w > 0.1 ? 0.14 : 0), 0.02, d - (d > 0.1 ? 0.14 : 0), m.gold, x * 0.86, ty - 0.004, z * 0.86));
    }
    if (mini) { // table miniature: stones in their starting places, cheaper geometry
        const st = createState(B === 7 ? 2 : 4);
        for (let i = 0; i < st.grid.length; i++) if (st.grid[i]) {
            const stone = makeStone(st.grid[i], true);
            cellPos(B, i, stone.position); group.add(stone);
        }
    }
    return { group, blocks };
}

// ---------------------------------------------------------------- the world

function duneHeight(x, z) {
    const d = Math.hypot(x, z);
    const far = THREE.MathUtils.smoothstep(d, 15, 70);
    const u = x / 600 + 0.5, v = z / 600 + 0.5;
    const big = fbm(u, v, 5, 3, 91) - 0.42;
    const ridges = Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2.2) * 0.5 + 0.5;
    return far * (big * 34 + ridges * ridges * 7) + (fbm(u, v, 60, 2, 5) - 0.5) * 0.25 * THREE.MathUtils.smoothstep(d, 11, 16);
}

export class PyramidWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.B = 0;
        this.stones = new Map();     // cell index -> mesh
        this.indicators = [];
        this.time = 0;
        this.storm = 0; this.stormTarget = 0; this.nextGust = 40 + Math.random() * 40;
        this.ambience = 'desert'; this.veil = 0xe2c79a;
        const m = materials();

        scene.fog = new THREE.FogExp2(0xd8b98a, 0.006);
        this.sky = makeSkyDome(); scene.add(this.sky);

        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 90, left: -15, right: 15, top: 15, bottom: -15 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.03;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0xc9a070, 0.6); scene.add(this.hemi);

        // sand
        const sand = sandMaps();
        const tg = new THREE.PlaneGeometry(600, 600, 180, 180); tg.rotateX(-Math.PI / 2);
        const p = tg.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, duneHeight(p.getX(i), p.getZ(i)));
        tg.computeVertexNormals();
        this.sandMat = new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(0.45, 0.45) });
        const ground = new THREE.Mesh(tg, this.sandMat); ground.receiveShadow = true; scene.add(ground);
        this.ground = ground;

        // paved court around the pyramid
        const pave = paveMaps();
        this.court = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1),
            new THREE.MeshStandardMaterial({ map: pave.map, normalMap: pave.normalMap, roughness: 0.9, color: 0xf0dcb8 }));
        this.court.receiveShadow = true; scene.add(this.court);

        // the great pyramids on the horizon
        const far = m.sandstone.clone(); far.map = null; far.normalMap = null; far.color.set(0xd9b784); far.flatShading = true;
        for (const [x, z, h] of [[-150, -210, 62], [-40, -250, 70], [95, -230, 48], [150, -200, 14], [172, -206, 12]]) {
            const py = new THREE.Mesh(new THREE.ConeGeometry(h * 0.78, h, 4), far);
            py.position.set(x, h / 2 + duneHeight(x, z) - 3, z); py.rotation.y = Math.PI / 4; scene.add(py);
        }

        this.props = new THREE.Group(); scene.add(this.props);
        this.flames = [];
        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        this.stoneGroup = new THREE.Group(); scene.add(this.stoneGroup);
        this.indicatorGroup = new THREE.Group(); scene.add(this.indicatorGroup);

        // particles: puffs of sand, the drifting haze and the storm
        this.puffs = new Particles(500, { color: 0xdcc096 }); this.puffs.drag = 1.6; this.puffs.gravity = 0.3;
        this.sparks = new Particles(300, { color: 0xffd98a, additive: true }); this.sparks.drag = 0.8; this.sparks.gravity = -0.6;
        this.haze = new Particles(1400, { color: 0xe6c898 });
        scene.add(this.puffs.points, this.sparks.points, this.haze.points);
        for (let i = 0; i < this.haze.n; i++) {
            this.haze.pos.set([(Math.random() - 0.5) * 90, Math.random() * 14, (Math.random() - 0.5) * 90], i * 3);
            this.haze.size[i] = 0.25 + Math.random() * 1.6; this.haze.alpha[i] = 0.2 + Math.random() * 0.5;
        }

        // falcons circling high above
        this.birds = [];
        const wingGeo = new THREE.BufferGeometry();
        wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, 0, 0, -0.14, 0.75, 0, -0.05], 3));
        this.birdMat = new THREE.MeshBasicMaterial({ color: 0x1d1712, side: THREE.DoubleSide });
        for (let i = 0; i < 9; i++) {
            const b = new THREE.Group();
            const wl = new THREE.Mesh(wingGeo, this.birdMat), wr = new THREE.Mesh(wingGeo, this.birdMat);
            wr.scale.x = -1; b.add(wl, wr);
            b.userData = { wl, wr, r: 22 + Math.random() * 30, h: 20 + Math.random() * 16, sp: (0.07 + Math.random() * 0.05) * (i % 3 ? 1 : -1), ph: Math.random() * 9, cx: (Math.random() - 0.5) * 40, cz: -20 + (Math.random() - 0.5) * 40 };
            b.scale.setScalar(1.3 + Math.random());
            scene.add(b); this.birds.push(b);
        }
        this.nextCry = 12;
    }

    // (re)build everything that depends on the board size
    setBoard(state) {
        const B = state.B;
        if (B !== this.B) {
            this.B = B;
            const m = materials();
            this.boardGroup.clear(); this.props.clear(); this.flames.length = 0;
            const { group, blocks } = buildBoard(B);
            this.blocks = blocks; this.boardGroup.add(group);
            const half = B / 2 + 3.2;
            this.court.scale.set(half * 2, 1, half * 2); this.court.position.y = -0.07;
            this.court.material.map.repeat.setScalar(half / 2.2); this.court.material.normalMap.repeat.setScalar(half / 2.2);
            // obelisks at the corners of the court, braziers between them
            for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const ob = buildObelisk(m.sandstone, m.gold, 1); ob.scale.setScalar(4.6);
                ob.position.set(sx * (half - 0.9), 0, sz * (half - 0.9)); this.props.add(ob);
            }
            for (const [x, z] of [[half - 0.9, 0], [-half + 0.9, 0], [0, -half + 0.9]]) this.addBrazier(x, z);
            const sphinx = buildSphinx(m.sandstone); sphinx.scale.setScalar(7);
            sphinx.position.set(-half - 9, -0.1, -4); sphinx.rotation.y = Math.PI / 2 + 0.25; this.props.add(sphinx);
            for (let i = 0; i < 7; i++) {
                const palm = buildPalm(1, 0.15 + (i % 3) * 0.12); palm.scale.setScalar(4.4 + (i % 4) * 0.8);
                palm.position.set(half + 9 + (i % 3) * 3.1, 0, -6 + i * 2.3 - (i % 2) * 3); palm.rotation.y = i * 1.7; this.props.add(palm);
            }
            const pond = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), m.water);
            pond.rotation.x = -Math.PI / 2; pond.position.set(half + 11.5, 0.03, 0.5); pond.scale.set(0.7, 1, 1); this.props.add(pond);
            shadowed(this.props);
            pond.castShadow = false;
            this.key.shadow.camera.left = this.key.shadow.camera.bottom = -half - 2;
            this.key.shadow.camera.right = this.key.shadow.camera.top = half + 2;
            this.key.shadow.camera.updateProjectionMatrix();
        }
        this.syncStones(state);
        this.clearIndicators();
    }

    addBrazier(x, z) {
        const m = materials(), g = new THREE.Group();
        g.add(cyl(0.16, 0.3, 0.9, m.darkstone, 0, 0, 0, 8));
        g.add(cyl(0.38, 0.2, 0.22, m.bronze, 0, 0.9, 0, 12));
        const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
        const flame = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), fm(0xff6a18, 0.75)); outer.scale.set(1, 1.9, 1); outer.position.y = 0.3;
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fm(0xffe08a, 0.95)); inner.scale.set(1, 1.7, 1); inner.position.y = 0.2;
        flame.add(outer, inner);
        flame.position.y = 1.12; g.add(flame);
        const light = new THREE.PointLight(0xff8a3c, 0, 16, 1.8); light.position.y = 1.6; g.add(light);
        g.position.set(x, 0, z); this.props.add(g);
        this.flames.push({ flame, light, ph: Math.random() * 10 });
    }

    homeView(B = this.B) {
        const k = B / 7;
        return { pos: new THREE.Vector3(3.2 * k, 6.6 * k, 11.4 * k), target: new THREE.Vector3(0, 1.5 * k, -1.4 * k) };
    }

    cameraLimits() { const k = this.B / 7; return { min: 5.5 * k, max: 30 * k }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(45);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0xc9a070).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.5;
        this.sandMat.normalScale.setScalar(0.45 - d.low * 0.3); // long ripple shadows turn to stripes under a low light
        this.birdMat.color.set(d.night ? 0x05060a : 0x1d1712);
        for (const b of this.birds) b.visible = !d.night;
        this.updateFog();
    }

    updateFog() {
        const d = this.day; if (!d) return;
        const sand = new THREE.Color(0xd8b98a).multiplyScalar(d.night ? 0.12 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(sand, (0.45 + this.storm * 0.5) * (1 - d.low * 0.6));
        this.scene.fog.density = 0.0055 + this.storm * 0.03;
        this.haze.material.uniforms.uColor.value.copy(this.scene.fog.color).multiplyScalar(1.15);
        this.puffs.material.uniforms.uColor.value.copy(sand).lerp(d.skyHorizon, 0.2);
    }

    // ------------------------------------------------------------ stones & indicators

    syncStones(state) {
        const B = state.B;
        for (const [, mesh] of this.stones) this.stoneGroup.remove(mesh);
        this.stones.clear();
        for (let i = 0; i < state.grid.length; i++) {
            if (!state.grid[i]) continue;
            const s = makeStone(state.grid[i]);
            cellPos(B, i, s.position); s.userData.cell = i;
            this.stoneGroup.add(s); this.stones.set(i, s);
        }
    }

    clearIndicators() {
        for (const o of this.indicators) this.indicatorGroup.remove(o);
        this.indicators.length = 0;
        if (this.selected) { this.selected.position.y = cellTop(this.B, this.selected.userData.cell); this.selected = null; }
    }

    showSelection(cell, moves) {
        this.clearIndicators();
        const B = this.B;
        const stone = this.stones.get(cell);
        if (stone) { this.selected = stone; }
        const ring = (r0, r1, color) => {
            const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5;
            return mesh;
        };
        const sel = ring(0.39, 0.46, 0xffd070); cellPos(B, cell, sel.position).y += 0.025; sel.userData.sel = true;
        this.indicatorGroup.add(sel); this.indicators.push(sel);
        for (const mv of moves) {
            const attack = mv.type === 'smash' || mv.type === 'pushfall' || mv.type === 'pushdrop';
            const push = mv.type === 'push';
            const occupied = attack || push;
            const o = occupied ? ring(0.4, 0.47, attack ? 0xff4a2a : 0xffa030) : ring(0.13, 0.22, mv.type === 'jump' ? 0x9fe8ff : 0xffe08a);
            cellPos(B, mv.to, o.position).y += 0.03;
            o.userData.cell = mv.to; o.userData.ph = Math.random() * 3;
            this.indicatorGroup.add(o); this.indicators.push(o);
        }
    }

    // what is under the pointer: a cell index or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([...this.stoneGroup.children, ...this.blocks], false);
        return hits.length ? hits[0].object.userData.cell : -1;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state) {
        const B = this.B;
        this.clearIndicators();
        for (const ev of events) {
            if (ev.type === 'move') await this.animMove(ev.from, ev.to, ev.style, ev.smash);
            else if (ev.type === 'push') {
                sfx('push');
                await this.animMove(ev.from, ev.to, ev.drop ? 'drop' : 'shove', ev.smash, true);
            } else if (ev.type === 'fall') await this.animFall(ev);
            else if (ev.type === 'osiris') await this.animOsiris(ev);
        }
        // reconcile with the rules state, whatever happened above
        this.syncStones(state);
    }

    animMove(from, to, style, smash, quiet = false) {
        const B = this.B, stone = this.stones.get(from);
        if (!stone) return Promise.resolve();
        const a = cellPos(B, from), b = cellPos(B, to);
        const dist = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
        const dy = b.y - a.y;
        const jump = style === 'jump', down = dy < -0.01;
        const dur = jump ? 0.46 : style === 'shove' ? 0.26 : 0.2 + dist * 0.085 + (down ? 0.1 : 0);
        const arc = jump ? 0.55 : down ? 0.28 : 0;
        if (!quiet) sfx(jump ? 'jump' : 'slide', dist);
        const victim = smash ? this.stones.get(to) : null;
        this.stones.delete(from);
        if (victim) this.stones.delete(to);
        this.stones.set(to, stone); stone.userData.cell = to;
        let hit = false;
        return this.tweens.run(dur, (k) => {
            const e = jump ? ease.inOut(k) : down ? k * k * (1.6 - 0.6 * k) : ease.inOut(k);
            stone.position.lerpVectors(a, b, e);
            // going down, stay above the staircase line until past the edge
            if (down) stone.position.y = Math.max(stone.position.y, b.y + (a.y - b.y) * Math.max(0, 1 - e * 1.25));
            stone.position.y += Math.sin(Math.PI * k) * arc;
            if (victim && !hit && k > 0.82) { hit = true; this.shatter(victim); }
            if (k === 1) {
                stone.position.copy(b);
                if (!jump && dist > 1.5) this.puffs.burst(b, 5, { speed: 0.5, up: 0.15, size: 0.4, alpha: 0.25, life: 0.8 });
            }
        });
    }

    shatter(stone) {
        sfx('smash');
        this.stoneGroup.remove(stone);
        const p = stone.position.clone(); p.y += 0.15;
        this.puffs.burst(p, 26, { speed: 1.8, up: 1.2, size: 0.9, alpha: 0.5, life: 1.4 });
        this.shake = 0.35;
        const geo = new THREE.TetrahedronGeometry(0.12);
        for (let i = 0; i < 14; i++) {
            const s = new THREE.Mesh(geo, stone.material);
            s.castShadow = true; s.scale.set(0.5 + Math.random(), 0.4 + Math.random() * 0.8, 0.5 + Math.random());
            const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3, vy = 2 + Math.random() * 3;
            const rot = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
            this.stoneGroup.add(s);
            this.tweens.run(1.1 + Math.random() * 0.5, (k) => {
                const t = k * 1.3;
                s.position.set(p.x + Math.cos(a) * sp * t * 0.6, Math.max(0.05, p.y + vy * t - 6.5 * t * t), p.z + Math.sin(a) * sp * t * 0.6);
                s.rotation.set(rot.x * t, rot.y * t, rot.z * t);
                s.scale.multiplyScalar(k > 0.7 ? 0.9 : 1);
                if (k === 1) this.stoneGroup.remove(s);
            });
        }
    }

    animFall(ev) {
        const B = this.B, stone = this.stones.get(ev.from);
        if (!stone) return Promise.resolve();
        this.stones.delete(ev.from);
        const dc = Math.abs(ev.dir) === 1 ? ev.dir : 0, dr = dc ? 0 : Math.sign(ev.dir);
        const a = stone.position.clone();
        sfx('push'); sfx('fall');
        return this.tweens.run(0.95, (k) => {
            const out = Math.min(1, k * 2.2) * 0.9 + k * 0.7;
            stone.position.set(a.x + dc * out, Math.max(0.02, a.y - Math.max(0, k - 0.3) ** 2 * 5), a.z + dr * out);
            stone.rotation.x = dr * k * 5; stone.rotation.z = -dc * k * 5;
            if (k === 1) {
                this.puffs.burst(stone.position, 22, { speed: 1.4, up: 0.9, size: 1.0, alpha: 0.5 });
                this.shake = 0.2;
                this.tweens.run(0.7, (q) => { stone.position.y = 0.02 - q * 0.5; if (q === 1) this.stoneGroup.remove(stone); });
            }
        });
    }

    // Both enclosing stones send a force at once; the two run through the line and each stone they reach is unmade.
    animOsiris(ev) {
        const B = this.B;
        sfx('osiris');
        const stoneAt = new Map();
        for (const c of ev.captured) { const s = this.stones.get(c.at); if (s) stoneAt.set(c.at, s); this.stones.delete(c.at); }
        const runs = (ev.lines || []).map(({ a, b }) => {
            const step = a % B === b % B ? B : 1, n = (b - a) / step;
            const orbs = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10),
                new THREE.MeshBasicMaterial({ color: 0xc8ffd8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
            const from = cellPos(B, a), to = cellPos(B, b); from.y += 0.24; to.y += 0.24;
            this.scene.add(...orbs);
            const victims = [];
            for (let i = 1; i < n; i++) { const s = stoneAt.get(a + i * step); if (s) victims.push({ s, at: Math.min(i, n - i) / n }); } // reached first by the nearer force
            return { orbs, from, to, victims };
        });
        const p = new THREE.Vector3();
        return this.tweens.run(0.5 + 0.22 * Math.max(2, ...runs.map((r) => r.victims.length + 1)), (k) => {
            const e = ease.inOut(k);
            for (const r of runs) {
                r.orbs.forEach((orb, side) => {
                    p.lerpVectors(r.from, r.to, side ? 1 - e : e);
                    orb.position.copy(p);
                    orb.scale.setScalar((0.8 + Math.sin(k * 40) * 0.2) * Math.sin(Math.PI * Math.min(1, k * 1.02)) * 1.6 + 0.01);
                    this.sparks.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3, 0.6, 0.22 + Math.random() * 0.15, 0.8);
                });
                for (const v of r.victims) {
                    const q = THREE.MathUtils.clamp((e - v.at + 0.05) * 5, 0, 1);
                    if (q > 0 && !v.gone) {
                        v.s.scale.setScalar(Math.max(0.001, 1 - q)); v.s.position.y += 0.006;
                        if (q >= 1) { v.gone = true; this.stoneGroup.remove(v.s); this.sparks.burst(v.s.position, 6, { speed: 0.35, up: 0.7, size: 0.3, alpha: 0.8, life: 0.9 }); }
                    }
                }
            }
            if (k === 1) {
                for (const r of runs) { this.scene.remove(...r.orbs); for (const v of r.victims) this.stoneGroup.remove(v.s); }
                for (const s of stoneAt.values()) this.stoneGroup.remove(s);
            }
        });
    }

    celebrate(cells) {
        for (const c of cells) {
            const p = cellPos(this.B, c); p.y += 0.3;
            for (let i = 0; i < 5; i++) this.tweens.run(0.1, () => {}, i * 0.35).then(() => this.sparks.burst(p, 16, { speed: 0.9, up: 2.2, size: 0.55, alpha: 1, life: 1.8 }));
        }
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera, active) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 0, 0);

        // selection: the chosen stone floats, targets pulse
        if (this.selected) this.selected.position.y = cellTop(this.B, this.selected.userData.cell) + 0.1 + Math.sin(t * 4) * 0.025;
        for (const o of this.indicators) {
            if (o.userData.sel) continue;
            const s = 1 + Math.sin(t * 5 + o.userData.ph) * 0.1;
            o.scale.set(s, s, 1); o.material.opacity = 0.65 + Math.sin(t * 5 + o.userData.ph) * 0.3;
        }

        // gusts: every so often the wind gets up and the horizon disappears
        if (active) {
            this.nextGust -= dt;
            if (this.nextGust < 0) {
                if (this.stormTarget === 0) { this.stormTarget = 0.55 + Math.random() * 0.45; this.nextGust = 14 + Math.random() * 12; sfx('gust'); }
                else { this.stormTarget = 0; this.nextGust = 55 + Math.random() * 70; }
            }
        }
        const prev = this.storm;
        this.storm += (this.stormTarget - this.storm) * Math.min(1, dt * 0.25);
        if (Math.abs(prev - this.storm) > 1e-4) this.updateFog();

        // haze drifts with the wind, wrapped around the camera
        const hz = this.haze, wind = 1.2 + this.storm * 16;
        hz.material.uniforms.uOpacity.value = 0.1 + this.storm * 0.5;
        for (let i = 0; i < hz.n; i++) {
            const j = i * 3;
            hz.pos[j] += wind * dt * (0.6 + (i % 7) * 0.1);
            hz.pos[j + 1] += Math.sin(t * 0.7 + i) * dt * 0.25;
            hz.pos[j + 2] += wind * dt * 0.25;
            if (hz.pos[j] - camera.position.x > 45) hz.pos[j] -= 90;
            if (hz.pos[j + 2] - camera.position.z > 45) hz.pos[j + 2] -= 90;
            if (hz.pos[j + 2] - camera.position.z < -45) hz.pos[j + 2] += 90;
        }
        hz.points.geometry.attributes.position.needsUpdate = true;
        this.puffs.update(dt); this.sparks.update(dt);

        for (const b of this.birds) {
            const u = b.userData, a = t * u.sp + u.ph;
            b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 1.5, u.cz + Math.sin(a) * u.r);
            b.rotation.y = -a - (u.sp > 0 ? Math.PI : 0);
            const glide = Math.sin(t * 0.35 + u.ph) > 0.2 ? 0.12 : 0.6;
            const flap = Math.sin(t * 7 + u.ph) * glide;
            u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        }
        if (active && this.day && !this.day.night) {
            this.nextCry -= dt;
            if (this.nextCry < 0) { sfx('falcon'); this.nextCry = 18 + Math.random() * 30; }
        }

        const lamps = this.day ? this.day.lamps : 0;
        for (const f of this.flames) {
            const fl = 0.8 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 31 + f.ph * 2) * 0.08;
            f.flame.visible = lamps > 0.05;
            f.flame.scale.set(fl, 0.8 + fl * 0.5, fl);
            f.light.intensity = lamps * 13 * fl;
        }
    }
}
