// Small shared helpers: tweens, soft particles, easing.
import * as THREE from 'three';

export const ease = {
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    smooth: (k) => k * k * (3 - 2 * k),
};

export class Tweens {
    constructor() { this.list = []; }
    // fn(k) with k in 0..1; resolves when finished
    run(dur, fn, delay = 0) {
        return new Promise((res) => this.list.push({ t: -delay, dur, fn, res }));
    }
    wait(dur) { return this.run(dur, () => {}); }
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const a = this.list[i];
            a.t += dt;
            if (a.t < 0) continue;
            const k = Math.min(1, a.t / a.dur);
            a.fn(k);
            if (k >= 1) { this.list.splice(i, 1); a.res(); }
        }
    }
    clear() { for (const a of this.list) a.res(); this.list.length = 0; }
}

const PT_VERT = /* glsl */`
attribute float aSize; attribute float aAlpha;
varying float vAlpha;
uniform float uScale;
#include <fog_pars_vertex>
void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
    #include <fog_vertex>
}`;
const PT_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
    #include <fog_fragment>
}`;

// A pool of soft round sprites. Each particle has position, velocity, life, size, alpha.
export class Particles {
    constructor(count, { color = 0xd8b98a, additive = false, fog = true } = {}) {
        this.n = count;
        this.pos = new Float32Array(count * 3);
        this.vel = new Float32Array(count * 3);
        this.life = new Float32Array(count);
        this.max = new Float32Array(count).fill(1);
        this.size = new Float32Array(count);
        this.alpha = new Float32Array(count);
        this.base = new Float32Array(count);
        this.cursor = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
        this.material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
                uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uScale: { value: 600 },
            }]),
            vertexShader: PT_VERT, fragmentShader: PT_FRAG,
            transparent: true, depthWrite: false, fog,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.material);
        this.points.frustumCulled = false;
        this.gravity = 0; this.drag = 0;
    }
    emit(x, y, z, vx, vy, vz, life, size, alpha = 1) {
        const i = this.cursor; this.cursor = (i + 1) % this.n;
        this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
        this.life[i] = this.max[i] = life; this.size[i] = size; this.base[i] = alpha;
    }
    burst(p, n, { speed = 1, up = 0.6, life = 1.2, size = 0.5, alpha = 0.5, spread = 0.2 } = {}) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
            this.emit(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * spread * 0.5, p.z + (Math.random() - 0.5) * spread,
                Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s,
                life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), alpha);
        }
    }
    update(dt) {
        const { pos, vel, life, max, alpha, base } = this;
        const k = Math.max(0, 1 - this.drag * dt);
        for (let i = 0; i < this.n; i++) {
            if (life[i] <= 0) { alpha[i] = 0; continue; }
            life[i] -= dt;
            const j = i * 3;
            vel[j] *= k; vel[j + 1] = vel[j + 1] * k - this.gravity * dt; vel[j + 2] *= k;
            pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
            const f = Math.max(0, life[i] / max[i]);
            alpha[i] = base[i] * Math.min(1, f * 2) * Math.min(1, (1 - f) * 8);
        }
        const g = this.points.geometry;
        g.attributes.position.needsUpdate = true;
        g.attributes.aAlpha.needsUpdate = true;
        g.attributes.aSize.needsUpdate = true;
    }
}

// quick mesh helpers used by the model builders
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    return m;
}
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y + h / 2, z);
    return m;
}
export function shadowed(obj, cast = true, receive = true) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
    return obj;
}

// Bakes the static meshes under `root` into one mesh per material, to keep draw calls down.
// Instanced meshes, multi-material meshes, meshes that cast no shadow and anything `skip` names stay as they are.
export function mergeByMaterial(root, skip = () => false) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4();
    const bins = new Map(), gone = [];
    const blocked = (o) => { for (let p = o; p && p !== root; p = p.parent) if (skip(p)) return true; return false; };
    root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.castShadow || blocked(o)) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
        if (!bins.has(o.material)) bins.set(o.material, []);
        bins.get(o.material).push(g); gone.push(o);
    });
    for (const o of gone) o.parent.remove(o);
    for (const [mat, list] of bins) {
        const g = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
            const size = name === 'uv' ? 2 : 3, total = list.reduce((n, x) => n + x.attributes.position.count, 0);
            const arr = new Float32Array(total * size);
            let at = 0;
            for (const x of list) { arr.set(x.attributes[name].array, at); at += x.attributes.position.count * size; }
            g.setAttribute(name, new THREE.BufferAttribute(arr, size));
        }
        const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true;
        root.add(m);
    }
    return root;
}

// Something tall that stands over a board while the visitor arrives and is lifted out of the way for the game
// (the lighthouse tower, the temple roof). `materials` must belong to this group alone: they are faded.
export class Lift {
    constructor(group, materials, rise = 1.5) { this.group = group; this.materials = materials; this.rise = rise; this.shown = true; }
    set(k) {
        for (const m of this.materials) { m.transparent = k < 1; m.opacity = k; m.depthWrite = k > 0.5; }
        this.group.visible = k > 0.01; this.group.position.y = (1 - k) * this.rise;
        this.group.traverse((o) => { if (o.isMesh) o.castShadow = k > 0.5; });
    }
    reveal(tweens, on, animated = true) {
        if (this.shown === on) return;
        this.shown = on;
        if (!animated) { this.set(on ? 1 : 0); return; }
        tweens.run(1.5, (k) => { if (this.shown === on) this.set(on ? ease.inOut(k) : 1 - ease.inOut(k)); }, on ? 0 : 0.5);
    }
}
