// SKYSCRAPER — the world: Manhattan around 1930, the tower in steel, its windows as the board, effects and animations.
import * as THREE from 'three';
import { layout, elevator, ROOF } from './rules.js';
import { Tweens, Particles, Lift, ease, box, cyl, shadowed, mergeByMaterial } from '../fx.js';
import { canvasTexture } from '../textures.js';
import { makeSkyDome } from '../daylight.js';
import { sfx } from '../audio.js';

export const GROUND = -32;    // the foot of the tower as it stands on the table; the roof of the board is y = 0
const STREET = -84;
// the light of each colour: White burns warm, Black violet, Red and Blue in their own colours
export const LIGHT = [0, 0xffe9b0, 0x9d6bff, 0xff5236, 0x49a6ff];
const DARK = new THREE.Color(0x0d1319), SHUT = new THREE.Color(0x05070a);

// where a window sits: the middle of that face of its block
const FACE = [[0, 0, -1, Math.PI], [1, 0, 0, Math.PI / 2], [0, 0, 1, 0], [-1, 0, 0, -Math.PI / 2]];
function windowPose(b, face, o) {
    const x = b.u - 2, y = b.w - ROOF - 0.5, z = b.v - 2;
    if (face === 4) { o.position.set(x, 0.012, z); o.rotation.set(-Math.PI / 2, 0, 0); return; }
    const [nx, , nz, ry] = FACE[face];
    o.position.set(x + nx * 0.512, y, z + nz * 0.512); o.rotation.set(0, ry, 0);
}

// The crown of the Chrysler Building: seven tiers of arches with their fans of triangular windows, the needle,
// and the eagles looking out from the corners below it.
function buildCrown(steel, glass) {
    const g = new THREE.Group();
    g.add(box(5.3, 0.35, 5.3, steel, 0, 0, 0));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { // the eagles: steel heads thrust out over the corners
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 4), steel);
        e.rotation.set(Math.PI / 2, 0, 0); const h = new THREE.Group(); h.add(e);
        h.position.set(sx * 2.95, 0.2, sz * 2.95); h.rotation.y = Math.atan2(sx, sz); g.add(h);
    }
    const half = (r) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI, false); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false, curveSegments: 18 }); };
    const tooth = new THREE.Shape(); tooth.moveTo(-0.5, 0); tooth.lineTo(0.5, 0); tooth.lineTo(0, 1); tooth.closePath();
    const toothGeo = new THREE.ShapeGeometry(tooth);
    let y = 0.35;
    for (let i = 0; i < 7; i++) {
        const w = 4.7 - i * 0.6, r = w / 2, h = r * 0.62;
        g.add(box(w * 0.8, h, w * 0.8, steel, 0, y, 0));
        for (let f = 0; f < 4; f++) {
            const [nx, , nz, ry] = FACE[f], holder = new THREE.Group();
            holder.position.set(nx * w * 0.4, y, nz * w * 0.4); holder.rotation.y = ry; g.add(holder);
            holder.add(new THREE.Mesh(half(r), steel));
            const n = i < 5 ? 5 : 3;
            for (let k = 0; k < n; k++) { // the triangular windows, fanned along the arch
                const a = (k + 1) / (n + 1) * Math.PI, tri = new THREE.Mesh(toothGeo, glass);
                tri.scale.set(r * 0.2, r * 0.3, 1); tri.position.set(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, 0.17); tri.rotation.z = a - Math.PI / 2;
                holder.add(tri);
            }
        }
        y += h;
    }
    g.add(cyl(0.12, 0.42, 1.6, steel, 0, y, 0, 8), cyl(0.015, 0.12, 6.4, steel, 0, y + 1.6, 0, 6));
    return g;
}

// The tower: the block of ten floors that is the board, its shaft and setbacks below, the crown above.
// Returns { group, windows (instanced), owner[] (window -> block), lift (the crown), L }.
export function buildBoard(nPlayers, { mini = false } = {}) {
    const L = layout(nPlayers), group = new THREE.Group();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // brushed steel with the grid of the floors drawn into it
    const grid = canvasTexture(128, 128, (x) => {
        x.fillStyle = '#9aa4ae'; x.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) / 120})`; x.fillRect(0, (i * 53) % 128, 128, 1); }
        x.strokeStyle = '#59626c'; x.lineWidth = 8; x.strokeRect(0, 0, 128, 128);
    });
    grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
    const steel = std({ color: 0xc4ccd4, roughness: 0.3, metalness: 0.85 });
    const skin = (rx, ry) => { const m = std({ map: grid.clone(), color: 0xb9c2cb, roughness: 0.35, metalness: 0.8 }); m.map.repeat.set(rx, ry); m.map.needsUpdate = true; return m; };
    const glass = std({ color: 0x141a22, roughness: 0.2, metalness: 0.6 });
    const core = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 5), skin(5, 10)); core.position.y = -5; core.userData.body = true; group.add(core);
    // below the board: a shaft with dark window bands, two setbacks, the base
    const tall = canvasTexture(64, 128, (x) => { x.fillStyle = '#8f99a3'; x.fillRect(0, 0, 64, 128); x.fillStyle = '#1a2028'; for (let i = 0; i < 3; i++) x.fillRect(8 + i * 18, 6, 10, 116); });
    tall.wrapS = tall.wrapT = THREE.RepeatWrapping;
    const band = (rx, ry) => { const m = std({ map: tall.clone(), roughness: 0.4, metalness: 0.7 }); m.map.repeat.set(rx, ry); m.map.needsUpdate = true; return m; };
    group.add(box(5.5, 12, 5.5, band(3, 3), 0, -22, 0), box(5.9, 0.3, 5.9, steel, 0, -10.3, 0));
    group.add(box(7.2, 6, 7.2, band(4, 2), 0, -28, 0), box(7.6, 0.3, 7.6, steel, 0, -22.3, 0));
    group.add(box(9.6, 4, 9.6, band(5, 1), 0, GROUND, 0), box(10, 0.3, 10, steel, 0, -28.3, 0));
    shadowed(group);

    // the windows: one for every outward face of every block in play, all in one instanced mesh
    const owner = [], o = new THREE.Object3D();
    L.blocks.forEach((b, i) => { for (const f of b.faces) owner.push({ block: i, face: f }); });
    const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.76, 0.76), new THREE.MeshBasicMaterial({ color: 0xffffff }), owner.length);
    owner.forEach(({ block, face }, k) => { windowPose(L.blocks[block], face, o); o.updateMatrix(); windows.setMatrixAt(k, o.matrix); windows.setColorAt(k, DARK); });
    group.add(windows);
    if (L.low > 0) { // the floors below the game: shuttered windows, so the tower reads as one
        const list = [];
        for (let w = 0; w < L.low; w++) for (let v = 0; v < 5; v++) for (let u = 0; u < 5; u++) {
            const b = { u, v, w };
            if (v === 0) list.push([b, 0]); if (u === 4) list.push([b, 1]); if (v === 4) list.push([b, 2]); if (u === 0) list.push([b, 3]);
        }
        const shut = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.76, 0.76), new THREE.MeshBasicMaterial({ color: SHUT }), list.length);
        list.forEach(([b, f], k) => { windowPose(b, f, o); o.updateMatrix(); shut.setMatrixAt(k, o.matrix); });
        group.add(shut);
    }
    // the crown, with materials of its own so that it can be faded and lifted away
    const cs = steel.clone(), cg = glass.clone();
    const crown = buildCrown(cs, cg);
    shadowed(crown); mergeByMaterial(crown);
    group.add(crown);
    return { group, windows, owner, L, lift: new Lift(crown, [cs, cg], 4), core };
}

// ---------------------------------------------------------------- the world

export class SkyscraperWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.tweens = new Tweens();
        this.time = 0; this.storm = 0; this.shake = 0;
        this.ambience = 'grove';
        this.veil = 0xdfe3ea;
        this.nPlayers = 0;
        this.valid = [];
        const std = (o) => new THREE.MeshStandardMaterial(o);

        scene.fog = new THREE.FogExp2(0xc6cfdb, 0.0042);
        this.sky = makeSkyDome(); scene.add(this.sky);
        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 160, left: -24, right: 24, top: 30, bottom: -40 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.04;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x777f8a, 0.6); scene.add(this.hemi);

        // the island: streets far below, block after block of towers, the two rivers
        const street = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std({ color: 0x2c3036, roughness: 0.95 }));
        street.rotation.x = -Math.PI / 2; street.position.y = STREET; scene.add(street);
        this.riverMat = new THREE.MeshPhysicalMaterial({ color: 0x3b5f78, roughness: 0.2, clearcoat: 1 });
        for (const x of [-250, 250]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(140, 1600), this.riverMat); r.rotation.x = -Math.PI / 2; r.position.set(x, STREET + 0.3, 0); scene.add(r); }
        const lit = canvasTexture(64, 128, (x) => {
            x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128);
            for (let r = 0; r < 16; r++) for (let c = 0; c < 6; c++) if ((r * 7 + c * 13 + r * c) % 5 < 2) { x.fillStyle = ['#ffd890', '#ffe9c0', '#fff2d8'][(r + c) % 3]; x.fillRect(5 + c * 10, 4 + r * 8, 5, 4); }
        });
        const face = canvasTexture(64, 128, (x) => {
            x.fillStyle = '#8a8f96'; x.fillRect(0, 0, 64, 128); x.fillStyle = '#3a4048';
            for (let r = 0; r < 16; r++) for (let c = 0; c < 6; c++) x.fillRect(5 + c * 10, 4 + r * 8, 5, 4);
        });
        this.cityMat = std({ map: face, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 });
        let hs = 29;
        const hr = () => { hs = (hs * 16807) % 2147483647; return hs / 2147483647; };
        const sRGB = THREE.SRGBColorSpace, list = [];
        for (let gx = -9; gx <= 9; gx++) for (let gz = -16; gz <= 16; gz++) {
            if (Math.abs(gx) <= 0 && Math.abs(gz) <= 0) continue;
            for (let k = 0; k < 2; k++) {
                const w = 7 + hr() * 7, d = 7 + hr() * 7, near = Math.hypot(gx, gz * 0.6), h = 8 + hr() * hr() * (near < 5 ? 62 : 34);
                list.push({ x: gx * 22 + (k ? 5.5 : -5.5) + hr() * 2, y: STREET + h / 2, z: gz * 26 + (hr() - 0.5) * 8, sx: w, sy: h, sz: d, color: new THREE.Color().setHSL(0.06 + hr() * 0.06, 0.12 + hr() * 0.12, 0.4 + hr() * 0.25, sRGB) });
            }
        }
        const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cityMat, list.length), o = new THREE.Object3D();
        list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.updateMatrix(); city.setMatrixAt(i, o.matrix); city.setColorAt(i, t.color); });
        scene.add(city);
        // the building the tower stands on, down to the street
        const pod = std({ map: face.clone(), roughness: 0.7, color: 0xb4b9c0 }); pod.map.wrapS = pod.map.wrapT = THREE.RepeatWrapping; pod.map.repeat.set(3, 3); pod.map.needsUpdate = true;
        const podium = new THREE.Group();
        podium.add(box(12.5, 22, 12.5, pod, 0, GROUND - 22, 0), box(17, STREET - GROUND + 22 < 0 ? -(STREET - GROUND + 22) : 30, 17, pod, 0, STREET, 0));
        shadowed(podium, false, true); scene.add(podium);

        // an airship making its slow round of the tower
        const hull = std({ color: 0xc9d0d8, roughness: 0.35, metalness: 0.7 });
        this.airship = new THREE.Group();
        const bag = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), hull); bag.scale.set(1.6, 1.6, 7.5); this.airship.add(bag);
        this.airship.add(box(0.7, 0.5, 2.2, hull, 0, -2.2, 0.6), box(0.1, 2.6, 1.6, hull, 0, -1.3, -6.4), box(2.6, 0.1, 1.6, hull, 0, -0.05, -6.4));
        scene.add(this.airship);

        this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
        // the elevator: a gilt band round the tower at the highest floor that can be lit
        const gilt = new THREE.MeshStandardMaterial({ color: 0xe8b64c, roughness: 0.25, metalness: 1, emissive: 0x6a4a10, emissiveIntensity: 0.5 });
        this.band = new THREE.Group();
        for (const [w, d, x, z] of [[5.36, 0.1, 0, 2.63], [5.36, 0.1, 0, -2.63], [0.1, 5.36, 2.63, 0], [0.1, 5.36, -2.63, 0]]) this.band.add(box(w, 0.1, d, gilt, x, -0.05, z));
        scene.add(this.band);
        this.beacon = new THREE.PointLight(0xfff0d0, 0, 60, 1.6); this.beacon.position.set(0, 6, 0); scene.add(this.beacon);

        this.sparks = new Particles(200, { color: 0xfff0c0, additive: true }); this.sparks.drag = 1.2; this.sparks.gravity = 0.6;
        this.cloud = new Particles(120, { color: 0xeef2f6 });
        scene.add(this.sparks.points, this.cloud.points);
        for (let i = 0; i < this.cloud.n; i++) {
            this.cloud.pos.set([(Math.random() - 0.5) * 300, -40 - Math.random() * 14, (Math.random() - 0.5) * 300], i * 3);
            this.cloud.size[i] = 22 + Math.random() * 30; this.cloud.alpha[i] = 0.08 + Math.random() * 0.1;
        }
    }

    // (re)build everything that depends on the number of players
    setBoard(state) {
        if (state.nPlayers !== this.nPlayers) {
            this.nPlayers = state.nPlayers;
            this.boardGroup.clear();
            const { group, windows, owner, L, lift, core } = buildBoard(state.nPlayers);
            this.L = L; this.windows = windows; this.owner = owner; this.lift = lift; this.core = core; this.boardGroup.add(group);
            this.ofBlock = L.blocks.map(() => []);
            owner.forEach(({ block }, k) => this.ofBlock[block].push(k));
        }
        this.tweens.clear();
        this.valid = [];
        this.band.position.y = elevator(state) - ROOF;
        this.sync(state);
    }

    // The crown sits on the tower while the visitor arrives, and is lifted away for the game.
    reveal(on, animated = true) { if (this.lift) this.lift.reveal(this.tweens, on, animated); }

    homeView(n = this.nPlayers) {
        return n === 2 ? { pos: new THREE.Vector3(-7.5, 5.2, 12.5), target: new THREE.Vector3(0, -2.6, 0) }
            : { pos: new THREE.Vector3(-11, 4.5, 18.5), target: new THREE.Vector3(0, -5, 0) };
    }
    cameraLimits() { return this.nPlayers === 2 ? { min: 7, max: 60 } : { min: 9, max: 70 }; }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(70);
        this.key.color.copy(d.keyColor); this.key.intensity = d.keyPower;
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.5 - d.low * 0.3).multiplyScalar(1 + d.low * 1.2);
        this.hemi.groundColor.set(0x777f8a).multiply(d.keyColor).lerp(this.hemi.color, d.low * 0.6);
        this.hemi.intensity = d.ambient * 1.4;
        const haze = new THREE.Color(0xc6cfdb).multiplyScalar(d.night ? 0.1 : Math.min(1, 0.35 + d.keyPower * 0.2));
        this.scene.fog.color.copy(d.skyHorizon).lerp(d.skyTop, d.low * 0.6).lerp(haze, 0.4 * (1 - d.low * 0.6));
        this.cityMat.emissiveIntensity = d.lamps * 1.6;
        this.riverMat.color.copy(d.skyTop).lerp(new THREE.Color(0x3b5f78), 0.5).multiplyScalar(d.night ? 0.5 : 1);
        this.cloud.material.uniforms.uColor.value.copy(this.scene.fog.color).multiplyScalar(1.15);
        this.beacon.intensity = d.lamps * 30;
        this.glow = 1.5 + d.lamps * 1.3; // lit windows burn brighter against the dark
        if (this.state) this.sync(this.state);
    }

    // ------------------------------------------------------------ windows

    colorOf(c, out = new THREE.Color()) { return c ? out.set(LIGHT[c]).multiplyScalar(this.glow || 1.5) : out.copy(DARK); }

    sync(state) {
        this.state = state;
        const top = elevator(state), col = new THREE.Color();
        this.owner.forEach(({ block }, k) => {
            const c = state.grid[block];
            this.windows.setColorAt(k, c ? this.colorOf(c, col) : this.L.blocks[block].w > top ? SHUT : DARK);
        });
        this.windows.instanceColor.needsUpdate = true;
    }

    // the blocks the player in hand may light: their windows breathe in that player's colour
    showMoves(blocks, color) { this.valid = blocks; this.validColor = color; if (!blocks.length && this.state) this.sync(this.state); }
    clearIndicators() { this.showMoves([], 0); }

    // what is under the pointer: a block or -1
    pick(raycaster) {
        const hits = raycaster.intersectObjects([this.windows, this.core], false);
        return hits.length && hits[0].object === this.windows ? this.owner[hits[0].instanceId].block : -1;
    }

    // ------------------------------------------------------------ move playback

    async play(events, state) {
        this.valid = [];
        const col = new THREE.Color(), set = (block, c, k = 1) => { for (const w of this.ofBlock[block]) this.windows.setColorAt(w, this.colorOf(c, col).multiplyScalar(k)); this.windows.instanceColor.needsUpdate = true; };
        for (const ev of events) {
            if (ev.type === 'light') {
                sfx('switch');
                await this.tweens.run(0.4, (k) => set(ev.at, ev.color, k < 0.3 ? (Math.floor(k * 30) % 2 ? 0.2 : 1.6) : 1 + (1 - k) * 0.8));
                const b = this.L.blocks[ev.at];
                this.sparks.material.uniforms.uColor.value.set(LIGHT[ev.color]);
                this.sparks.burst(new THREE.Vector3(b.u - 2, b.w - ROOF - 0.5, b.v - 2).multiplyScalar(1.12), 6, { speed: 0.6, up: 0.4, size: 0.2, alpha: 0.8, life: 0.6 });
            } else if (ev.type === 'capture') {
                sfx('surge');
                await Promise.all(ev.changed.map((c, n) => this.tweens.run(0.5, (k) => set(c.at, k < 0.5 ? (Math.floor(k * 20) % 2 ? c.was : c.color) : c.color, k < 0.5 ? 1 : 1 + (1 - k) * 1.2), n * 0.09)));
            }
        }
        this.sync(state);
        const y0 = this.band.position.y, y1 = elevator(state) - ROOF;
        if (Math.abs(y1 - y0) > 0.01) { sfx('lift'); await this.tweens.run(0.6, (k) => { this.band.position.y = y0 + (y1 - y0) * ease.inOut(k); }); }
    }

    celebrate(color) {
        this.sparks.material.uniforms.uColor.value.set(LIGHT[color]);
        for (let i = 0; i < 8; i++) this.tweens.run(0.1, () => {}, i * 0.25).then(() => this.sparks.burst(new THREE.Vector3((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4), 16, { speed: 1.2, up: 2.6, size: 0.4, alpha: 1, life: 1.6 }));
    }

    // ------------------------------------------------------------ per-frame

    update(dt, camera) {
        this.time += dt;
        const t = this.time;
        this.tweens.update(dt);
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, -10, 0);
        if (this.valid.length && this.windows) {
            const col = new THREE.Color(), base = new THREE.Color(LIGHT[this.validColor] || 0xffffff), w = 0.16 + (Math.sin(t * 3.4) * 0.5 + 0.5) * 0.3;
            for (const b of this.valid) for (const k of this.ofBlock[b]) this.windows.setColorAt(k, col.copy(DARK).lerp(base, w));
            this.windows.instanceColor.needsUpdate = true;
        }
        const a = t * 0.05;
        this.airship.position.set(Math.cos(a) * 46, 3 + Math.sin(t * 0.2) * 1.5, Math.sin(a) * 46); this.airship.rotation.y = -a;
        const cl = this.cloud;
        for (let i = 0; i < cl.n; i++) { cl.pos[i * 3] += dt * (1 + (i % 5) * 0.3); if (cl.pos[i * 3] > 150) cl.pos[i * 3] -= 300; }
        cl.points.geometry.attributes.position.needsUpdate = true;
        this.sparks.update(dt);
    }
}
