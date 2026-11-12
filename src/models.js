// Models built from code: the fourteen table miniatures and the props shared with the game worlds.
import * as THREE from 'three';
import { box, cyl } from './fx.js';
import { limestoneMaps, marbleMaps } from './textures.js';

let M = null;
export function materials() {
    if (M) return M;
    const lime = limestoneMaps(), marb = marbleMaps();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    M = {
        sandstone: std({ color: 0xe2c28e, map: lime.map, normalMap: lime.normalMap, roughness: 0.9 }),
        limestone: std({ color: 0xffffff, map: lime.map, normalMap: lime.normalMap, roughness: 0.85 }),
        darkstone: std({ color: 0x8a7a66, map: lime.map, normalMap: lime.normalMap, roughness: 0.9 }),
        marble: std({ color: 0xffffff, map: marb.map, roughness: 0.35 }),
        brick: std({ color: 0xa8553a, map: lime.map, normalMap: lime.normalMap, roughness: 0.9 }),
        terracotta: std({ color: 0xb5633c, roughness: 0.8 }),
        bronze: std({ color: 0x9a6a3a, roughness: 0.38, metalness: 0.85 }),
        verdigris: std({ color: 0x5f9d8c, roughness: 0.55, metalness: 0.5 }),
        gold: std({ color: 0xe8b64c, roughness: 0.25, metalness: 1.0 }),
        brass: std({ color: 0xc9a253, roughness: 0.32, metalness: 0.95 }),
        iron: std({ color: 0x2a2c30, roughness: 0.5, metalness: 0.7 }),
        ivory: std({ color: 0xf1e7d0, roughness: 0.4 }),
        foliage: std({ color: 0x3f7a35, roughness: 0.85, flatShading: true }),
        darkleaf: std({ color: 0x2c5a2a, roughness: 0.85, flatShading: true }),
        grass: std({ color: 0x6f8a45, roughness: 0.95 }),
        water: new THREE.MeshPhysicalMaterial({ color: 0x2f7fa0, roughness: 0.08, metalness: 0.1, clearcoat: 1 }),
        glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe0ee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1 }),
        slate: std({ color: 0x4a5560, roughness: 0.6 }),
        steel: std({ color: 0x9fb0c0, roughness: 0.25, metalness: 0.9 }),
        window: std({ color: 0x1c2733, roughness: 0.15, metalness: 0.6 }),
        lamp: std({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 2.5 }),
        wood: std({ color: 0x6b4426, roughness: 0.7 }),
        ink: std({ color: 0x1a1a1a, roughness: 0.6 }),
        porcelain: new THREE.MeshPhysicalMaterial({ color: 0xf6f3ea, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }),
        glaze: new THREE.MeshPhysicalMaterial({ color: 0x2f8a5c, roughness: 0.25, clearcoat: 1 }),
        tile: std({ color: 0x1f7f86, roughness: 0.35 }),
        mosaic: new THREE.MeshPhysicalMaterial({ color: 0x1f8a8f, roughness: 0.3, clearcoat: 0.6, metalness: 0.2 }),
        redbrick: std({ color: 0xb04a36, map: lime.map, normalMap: lime.normalMap, roughness: 0.9 }),
        crystal: new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1, emissive: 0x6688cc, emissiveIntensity: 0.5 }),
    };
    return M;
}

const G = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };
function prism(w, h, d, mat, x = 0, y = 0, z = 0) { // gabled roof along z
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }), mat);
    m.position.set(x, y, z - d / 2);
    return m;
}
function colonnade(g, mat, w, d, y, h, nx, nz, r) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
        g.add(cyl(r * 0.85, r, h, mat, -w / 2 + (i / (nx - 1)) * w, y, -d / 2 + (j / (nz - 1)) * d, 8));
    }
}
function blob(r, mat, x, y, z, sy = 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    m.position.set(x, y, z); m.scale.y = sy; m.rotation.set(x * 9, y * 7, z * 5);
    return m;
}

// ---------------------------------------------------------------- props

export function buildSphinx(mat, gold) {
    const g = new THREE.Group();
    g.add(box(0.5, 0.07, 1.25, mat, 0, 0, 0));                       // plinth
    g.add(box(0.36, 0.26, 0.8, mat, 0, 0.07, -0.12));                // body
    const haunch = blob(0.2, mat, 0, 0.24, -0.42, 0.9); haunch.scale.z = 1.3; g.add(haunch);
    g.add(box(0.1, 0.09, 0.42, mat, -0.13, 0.07, 0.42));             // paws
    g.add(box(0.1, 0.09, 0.42, mat, 0.13, 0.07, 0.42));
    g.add(box(0.22, 0.2, 0.2, mat, 0, 0.3, 0.2));                    // chest / neck
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), mat);
    head.position.set(0, 0.58, 0.24); head.scale.set(0.95, 1.1, 1); g.add(head);
    // nemes headdress: flared wedge behind and beside the face
    const nemes = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.26, 4, 1), gold || mat);
    nemes.position.set(0, 0.56, 0.19); nemes.rotation.y = Math.PI / 4; nemes.scale.z = 0.7; g.add(nemes);
    g.add(box(0.035, 0.07, 0.04, mat, 0, 0.42, 0.33));               // beard
    return g;
}

export function buildObelisk(mat, gold, h = 1) {
    const g = new THREE.Group();
    g.add(box(0.26, 0.1, 0.26, mat));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.1, h, 4), mat);
    shaft.position.y = 0.1 + h / 2; shaft.rotation.y = Math.PI / 4; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.066, 0.13, 4), gold);
    tip.position.y = 0.1 + h + 0.065; tip.rotation.y = Math.PI / 4; g.add(tip);
    return g;
}

export function buildPalm(h = 1, lean = 0.2) {
    const m = materials(), g = new THREE.Group();
    const seg = 7;
    let x = 0, y = 0;
    for (let i = 0; i < seg; i++) {
        const k = i / seg, a = lean * k * 1.6;
        const s = cyl(0.045 - k * 0.015, 0.055 - k * 0.015, h / seg * 1.08, m.wood, x, y, 0, 7);
        s.rotation.z = -a; g.add(s);
        x += Math.sin(a) * h / seg; y += Math.cos(a) * h / seg;
    }
    for (let i = 0; i < 9; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 4, 1), i % 2 ? m.foliage : m.darkleaf);
        frond.scale.z = 0.18;
        frond.geometry.translate(0, 0.31, 0);
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0); pivot.rotation.y = (i / 9) * Math.PI * 2 + i;
        frond.rotation.z = -1.15 - (i % 3) * 0.22;
        pivot.add(frond); g.add(pivot);
    }
    return g;
}

// ---------------------------------------------------------------- the fourteen wonders
// Every builder returns a group standing on y = 0 that fits a 1.1 wide footprint.

function gardens() {
    const m = materials(), g = new THREE.Group();
    const tiers = [[1.0, 0.16], [0.74, 0.16], [0.48, 0.16], [0.24, 0.14]];
    let y = 0;
    tiers.forEach(([w, h], i) => {
        g.add(box(w, h, w * 0.86, m.sandstone, 0, y, 0));
        const n = 9 - i * 2;
        for (let k = 0; k < n; k++) { // arcade recesses + hanging green on every terrace edge
            const t = (k + 0.5) / n - 0.5;
            g.add(box(w / n * 0.5, h * 0.62, 0.02, m.darkstone, t * w, y, w * 0.43 + 0.003));
            g.add(blob(0.05 + (k % 3) * 0.012, k % 2 ? m.foliage : m.darkleaf, t * w, y + h + 0.02, w * 0.43 - 0.05, 0.8));
            g.add(blob(0.045, m.foliage, w / 2 - 0.05, y + h + 0.02, t * w * 0.8, 0.8));
            g.add(blob(0.045, m.darkleaf, -w / 2 + 0.05, y + h + 0.02, t * w * 0.8, 0.8));
        }
        y += h;
    });
    const p1 = buildPalm(0.3, 0.3); p1.position.set(0.02, y, 0); p1.scale.setScalar(0.8); g.add(p1);
    const fall = box(0.07, 0.48, 0.012, m.water, 0.28, 0, 0.433); g.add(fall);
    g.add(box(0.3, 0.012, 0.16, m.water, 0.28, 0, 0.52));
    return g;
}

function classicalTemple(m, { w = 0.62, d = 1.0, colH = 0.36, nx = 6, nz = 10, mat = null } = {}) {
    const g = new THREE.Group(), stone = mat || m.marble;
    g.add(box(w + 0.2, 0.04, d + 0.2, stone, 0, 0, 0));
    g.add(box(w + 0.13, 0.04, d + 0.13, stone, 0, 0.04, 0));
    g.add(box(w + 0.06, 0.04, d + 0.06, stone, 0, 0.08, 0));
    colonnade(g, stone, w, d, 0.12, colH, nx, nz, 0.026);
    g.add(box(w * 0.66, colH, d * 0.74, stone, 0, 0.12, 0));       // cella
    g.add(box(w + 0.07, 0.05, d + 0.07, stone, 0, 0.12 + colH, 0)); // entablature
    g.add(prism(w + 0.09, 0.14, d + 0.07, stone, 0, 0.17 + colH, 0));
    return g;
}

function temple() {
    const m = materials(), g = classicalTemple(m, {});
    g.add(box(0.5, 0.012, 0.9, m.terracotta, 0, 0.67, 0));
    const a = cyl(0.02, 0.03, 0.14, m.gold, 0, 0.12, 0.62, 8); g.add(a); // the Artemis field marker
    return g;
}

function statue() {
    const m = materials(), g = new THREE.Group();
    g.add(box(0.8, 0.07, 0.8, m.marble));
    g.add(box(0.62, 0.07, 0.62, m.darkstone, 0, 0.07, 0));
    g.add(box(0.4, 0.26, 0.36, m.gold, 0, 0.14, -0.04));              // throne seat
    g.add(box(0.4, 0.5, 0.07, m.gold, 0, 0.4, -0.2));                 // throne back
    g.add(box(0.26, 0.3, 0.2, m.ivory, 0, 0.4, -0.04));               // torso
    g.add(box(0.3, 0.1, 0.3, m.gold, 0, 0.36, 0.06));                 // lap, robe
    g.add(box(0.09, 0.26, 0.09, m.gold, -0.08, 0.14, 0.19));          // legs
    g.add(box(0.09, 0.26, 0.09, m.gold, 0.08, 0.14, 0.19));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), m.ivory); head.position.set(0, 0.79, -0.02); g.add(head);
    g.add(blob(0.075, m.gold, 0, 0.74, 0.04, 0.9));                    // beard
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 16), m.gold); wreath.position.set(0, 0.84, -0.02); wreath.rotation.x = Math.PI / 2; g.add(wreath);
    g.add(cyl(0.012, 0.012, 0.86, m.gold, -0.22, 0.14, 0.1, 6));      // sceptre
    g.add(blob(0.03, m.gold, -0.22, 1.02, 0.1));
    g.add(box(0.2, 0.05, 0.06, m.ivory, 0.2, 0.52, 0.06));             // right arm, holding Nike
    g.add(cyl(0.0, 0.03, 0.12, m.gold, 0.3, 0.57, 0.06, 6));
    return g;
}

function mausoleum() {
    const m = materials(), g = new THREE.Group();
    g.add(box(0.86, 0.06, 0.74, m.marble));
    g.add(box(0.7, 0.34, 0.58, m.marble, 0, 0.06, 0));
    colonnade(g, m.marble, 0.6, 0.48, 0.4, 0.24, 7, 6, 0.024);
    g.add(box(0.46, 0.24, 0.34, m.marble, 0, 0.4, 0));
    g.add(box(0.68, 0.04, 0.56, m.marble, 0, 0.64, 0));
    for (let i = 0; i < 7; i++) g.add(box(0.64 - i * 0.075, 0.035, 0.52 - i * 0.062, m.marble, 0, 0.68 + i * 0.035, 0));
    g.add(box(0.12, 0.05, 0.1, m.marble, 0, 0.925, 0));
    g.add(box(0.1, 0.06, 0.04, m.bronze, 0, 0.975, 0.02));             // quadriga
    g.add(box(0.03, 0.09, 0.03, m.bronze, 0, 0.975, -0.03));
    return g;
}

function colossus() {
    const m = materials(), g = new THREE.Group(), b = m.bronze;
    g.add(box(0.5, 0.2, 0.5, m.marble));
    g.add(box(0.4, 0.05, 0.4, m.marble, 0, 0.2, 0));
    const limb = (x, y, z, len, r, rz = 0, rx = 0) => {
        const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), b);
        c.position.set(x, y, z); c.rotation.set(rx, 0, rz); g.add(c); return c;
    };
    limb(-0.07, 0.45, 0, 0.3, 0.045, 0.06); limb(0.07, 0.45, 0, 0.3, 0.045, -0.06);  // legs
    limb(0, 0.8, 0, 0.2, 0.085);                                                       // torso
    limb(-0.15, 0.82, 0, 0.2, 0.033, 0.25);                                            // left arm down
    limb(0.17, 1.03, 0, 0.22, 0.033, -0.5);                                            // right arm raised
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), b); head.position.set(0, 1.07, 0); g.add(head);
    for (let i = 0; i < 9; i++) { // sun crown of Helios
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.08, 5), m.gold);
        const a = (i / 8 - 0.5) * 2.4;
        ray.position.set(Math.sin(a) * 0.085, 1.09 + Math.cos(a) * 0.085, 0); ray.rotation.z = -a; g.add(ray);
    }
    g.add(cyl(0.035, 0.012, 0.09, m.gold, 0.25, 1.17, 0, 8));
    const flame = blob(0.035, m.lamp, 0.25, 1.29, 0, 1.4); flame.userData.glow = true; g.add(flame);
    return g;
}

function pharos() {
    const m = materials(), g = new THREE.Group();
    g.add(box(0.9, 0.08, 0.9, m.darkstone));
    g.add(box(0.66, 0.06, 0.66, m.limestone, 0, 0.08, 0));
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.56, 4), m.limestone); t1.position.y = 0.42; t1.rotation.y = Math.PI / 4; g.add(t1);
    g.add(box(0.34, 0.03, 0.34, m.limestone, 0, 0.7, 0));
    g.add(cyl(0.11, 0.14, 0.3, m.limestone, 0, 0.73, 0, 8));
    g.add(cyl(0.15, 0.15, 0.025, m.limestone, 0, 1.03, 0, 8));
    g.add(cyl(0.07, 0.085, 0.14, m.limestone, 0, 1.055, 0, 12));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(cyl(0.01, 0.01, 0.1, m.limestone, Math.cos(a) * 0.065, 1.195, Math.sin(a) * 0.065, 5)); }
    const fire = blob(0.04, m.lamp, 0, 1.245, 0); fire.userData.glow = true; g.add(fire);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.08, 12), m.limestone); cap.position.y = 1.335; g.add(cap);
    g.add(cyl(0.008, 0.012, 0.09, m.bronze, 0, 1.37, 0, 6));
    return g;
}

function colosseum() {
    const m = materials(), g = new THREE.Group();
    const ring = (rOut, rIn, h, y, mat, phi = Math.PI * 2, start = 0) => {
        const pts = [[rIn, 0], [rOut, 0], [rOut, h], [rIn, h], [rIn, 0]].map(([x, yy]) => new THREE.Vector2(x, yy));
        const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 48, start, phi), mat);
        mesh.position.y = y; mesh.scale.z = 0.8; return mesh;
    };
    g.add(ring(0.56, 0, 0.03, 0, m.sandstone));
    g.add(ring(0.52, 0.42, 0.42, 0.03, m.limestone));
    g.add(ring(0.525, 0.46, 0.2, 0.45, m.limestone, Math.PI * 1.15, 2.2)); // the surviving outer wall
    g.add(ring(0.42, 0.33, 0.28, 0.03, m.sandstone));
    g.add(ring(0.33, 0.25, 0.14, 0.03, m.sandstone));
    g.add(ring(0.25, 0, 0.012, 0.03, m.sandstone));
    for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 40; i++) { // arcades
        const a = (i / 40) * Math.PI * 2;
        const arch = box(0.035, 0.085, 0.012, m.ink, 0, 0, 0);
        arch.position.set(Math.cos(a) * 0.522, 0.09 + tier * 0.13, Math.sin(a) * 0.522 * 0.8);
        arch.rotation.y = -a + Math.PI / 2; g.add(arch);
    }
    return g;
}

function greatWall() { // the wall alone: ramparts, battlements and watchtowers
    const m = materials(), g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.56, 0, 0.26), new THREE.Vector3(-0.24, 0.07, 0.02), new THREE.Vector3(0.1, 0.12, 0.1),
        new THREE.Vector3(0.34, 0.05, -0.1), new THREE.Vector3(0.56, 0, -0.28)]);
    const N = 44, W = 0.1, base = 0.15;
    for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N, p = curve.getPoint(t), tan = curve.getTangent(t);
        const yaw = -Math.atan2(tan.z, tan.x), top = base + p.y;
        const nx = -tan.z, nz = tan.x, nl = Math.hypot(nx, nz) || 1;
        const seg = box(0.034, top, W, m.redbrick, p.x, 0, p.z); seg.rotation.y = yaw; g.add(seg);
        const walk = box(0.034, 0.012, W - 0.03, m.darkstone, p.x, top - 0.006, p.z); walk.rotation.y = yaw; g.add(walk);
        for (const side of [-1, 1]) { // parapet with merlons
            const ox = nx / nl * side * (W / 2 - 0.01), oz = nz / nl * side * (W / 2 - 0.01);
            const par = box(0.034, i % 2 ? 0.03 : 0.052, 0.02, m.redbrick, p.x + ox, top, p.z + oz); par.rotation.y = yaw; g.add(par);
        }
    }
    for (const t of [0.07, 0.5, 0.93]) {
        const p = curve.getPoint(t), tan = curve.getTangent(t), yaw = -Math.atan2(tan.z, tan.x), h = base + p.y + 0.09;
        const tw = new THREE.Group(); tw.position.set(p.x, 0, p.z); tw.rotation.y = yaw;
        tw.add(box(0.15, h, 0.15, m.redbrick));
        tw.add(box(0.175, 0.02, 0.175, m.redbrick, 0, h, 0));
        for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { // battlements round the tower top
            tw.add(box(0.022, 0.03, 0.016, m.redbrick, -0.066 + k * 0.044, h + 0.02, s * 0.08));
            tw.add(box(0.016, 0.03, 0.022, m.redbrick, s * 0.08, h + 0.02, -0.066 + k * 0.044));
        }
        tw.add(box(0.09, 0.07, 0.09, m.redbrick, 0, h + 0.02, 0));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.06, 4), m.slate); roof.position.y = h + 0.12; roof.rotation.y = Math.PI / 4; tw.add(roof);
        for (const s of [-1, 1]) tw.add(box(0.012, 0.07, 0.045, m.ink, s * 0.076, h - 0.075, 0));  // gateways onto the wall walk
        tw.add(box(0.04, 0.035, 0.012, m.ink, 0, h + 0.045, 0.046));
        g.add(tw);
    }
    return g;
}

function library() { // the House of Wisdom, Baghdad: four domed halls around a courtyard and its fountain
    const m = materials(), g = new THREE.Group();
    g.add(box(1.1, 0.035, 1.1, m.tile));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) g.add(box(0.1, 0.004, 0.1, m.marble, -0.45 + i * 0.18, 0.035, -0.45 + j * 0.18));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * 0.33, z = sz * 0.33, p = new THREE.Group(); p.position.set(x, 0.035, z);
        p.add(box(0.36, 0.03, 0.36, m.marble));
        p.add(box(0.32, 0.25, 0.32, m.marble, 0, 0.03, 0));
        p.add(box(0.335, 0.022, 0.335, m.mosaic, 0, 0.255, 0));                 // tiled frieze
        for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {                   // crenellated roof line
            p.add(box(0.04, 0.03, 0.02, m.marble, -0.12 + k * 0.08, 0.28, s * 0.15));
            p.add(box(0.02, 0.03, 0.04, m.marble, s * 0.15, 0.28, -0.12 + k * 0.08));
        }
        p.add(cyl(0.105, 0.11, 0.045, m.marble, 0, 0.28, 0, 16));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), m.mosaic);
        dome.position.y = 0.335; dome.scale.y = 1.12; p.add(dome);
        p.add(cyl(0.004, 0.01, 0.05, m.gold, 0, 0.455, 0, 6));
        for (const a of [-1, 1]) for (const b of [-1, 1]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), m.mosaic); d.position.set(a * 0.135, 0.3, b * 0.135); p.add(d); }
        // pointed-arch doors of gilded wood, opening onto the courtyard
        const doorX = box(0.012, 0.15, 0.085, m.brass, -sx * 0.162, 0.03, 0), doorZ = box(0.085, 0.15, 0.012, m.brass, 0, 0.03, -sz * 0.162);
        const frameX = box(0.008, 0.19, 0.125, m.mosaic, -sx * 0.161, 0.03, 0), frameZ = box(0.125, 0.19, 0.008, m.mosaic, 0, 0.03, -sz * 0.161);
        p.add(frameX, frameZ, doorX, doorZ);
        for (const s of [-1, 1]) { p.add(box(0.012, 0.07, 0.04, m.ink, sx * 0.162, 0.1, s * 0.08)); p.add(box(0.04, 0.07, 0.012, m.ink, s * 0.08, 0.1, sz * 0.162)); }
        g.add(p);
    }
    // the fountain with the sphere that the game is played with
    g.add(box(0.3, 0.03, 0.3, m.darkstone, 0, 0.035, 0));
    g.add(box(0.24, 0.035, 0.24, m.darkstone, 0, 0.065, 0));
    g.add(box(0.19, 0.006, 0.19, m.water, 0, 0.097, 0));
    g.add(cyl(0.012, 0.02, 0.06, m.brass, 0, 0.1, 0, 8));
    g.add(cyl(0.05, 0.015, 0.025, m.brass, 0, 0.16, 0, 14));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), m.crystal); orb.position.y = 0.225; g.add(orb);
    return g;
}

function tower() { // the Porcelain Tower of Nanjing: nine octagonal storeys of white porcelain under green-glazed eaves
    const m = materials(), g = new THREE.Group();
    g.add(cyl(0.44, 0.47, 0.035, m.marble, 0, 0, 0, 8));
    g.add(cyl(0.36, 0.38, 0.03, m.marble, 0, 0.035, 0, 8));
    let y = 0.065, r = 0.25;
    for (let i = 0; i < 9; i++) {
        const h = 0.092 - i * 0.003;
        g.add(cyl(r * 0.94, r, h, m.porcelain, 0, y, 0, 8));
        const rr = r * 0.97 * Math.cos(Math.PI / 8);
        for (let k = 0; k < 8; k++) { // an arched opening in every face
            const a = (k + 0.5) / 8 * Math.PI * 2;
            const win = box(r * 0.26, h * 0.6, 0.01, k % 2 ? m.ink : m.glaze); win.position.set(Math.sin(a) * rr, y + h * 0.36, Math.cos(a) * rr); win.rotation.y = a; g.add(win);
        }
        y += h;
        const eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r + 0.085, 0.03, 8), m.glaze); eave.position.y = y + 0.015; g.add(eave);
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.09, r + 0.085, 0.008, 8), m.gold); lip.position.y = y + 0.002; g.add(lip);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const bell = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), m.gold); bell.position.set(Math.sin(a) * (r + 0.088), y - 0.012, Math.cos(a) * (r + 0.088)); g.add(bell); }
        y += 0.03; r -= 0.017;
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r + 0.03, 0.09, 8), m.glaze); cap.position.y = y + 0.045; g.add(cap);
    g.add(cyl(0.006, 0.01, 0.17, m.gold, 0, y + 0.08, 0, 6));
    for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.SphereGeometry(0.022 - i * 0.004, 10, 8), m.gold); ring.position.y = y + 0.11 + i * 0.035; ring.scale.y = 0.6; g.add(ring); }
    return g;
}

function cathedral() {
    const m = materials(), g = new THREE.Group(), s = m.limestone;
    g.add(box(0.5, 0.03, 1.0, m.darkstone));
    g.add(box(0.26, 0.42, 0.74, s, 0, 0.03, -0.08));                 // nave
    g.add(prism(0.28, 0.16, 0.74, m.slate, 0, 0.45, -0.08));
    g.add(box(0.68, 0.36, 0.2, s, 0, 0.03, -0.14));                  // transept — the cross
    const tr = prism(0.22, 0.13, 0.68, m.slate, 0, 0.39, 0); tr.rotation.y = Math.PI / 2; tr.position.set(-0.34, 0.39, -0.14); g.add(tr);
    for (const x of [-0.13, 0.13]) {                                  // west towers
        g.add(box(0.15, 0.66, 0.15, s, x, 0.03, 0.34));
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.36, 4), m.slate); sp.position.set(x, 0.87, 0.34); sp.rotation.y = Math.PI / 4; g.add(sp);
        g.add(box(0.04, 0.16, 0.01, m.ink, x, 0.44, 0.416));
    }
    const rose = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), new THREE.MeshStandardMaterial({ color: 0x3355aa, emissive: 0x2a3f9a, emissiveIntensity: 0.6, roughness: 0.2 }));
    rose.position.set(0, 0.36, 0.292); g.add(rose);
    g.add(box(0.07, 0.14, 0.012, m.ink, 0, 0.03, 0.29));
    const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 6), m.slate); fleche.position.set(0, 0.74, -0.14); g.add(fleche);
    for (let i = 0; i < 5; i++) for (const x of [-0.19, 0.19]) {      // flying buttresses
        const b = box(0.02, 0.26, 0.04, s, x, 0.03, -0.38 + i * 0.13 + (i > 1 ? 0.12 : 0)); g.add(b);
        const arm = box(0.1, 0.02, 0.025, s, x * 0.8, 0.27, b.position.z); arm.rotation.z = x > 0 ? -0.5 : 0.5; g.add(arm);
    }
    return g;
}

function palace() { // the Crystal Palace itself: the hall you are standing in
    const m = materials(), g = new THREE.Group();
    g.add(box(1.1, 0.03, 0.6, m.darkstone));
    const frame = m.steel;
    const hall = (w, h, d, x, y, z) => {
        g.add(box(w, h, d, m.glass, x, y, z));
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: 0xdfe8ee }));
        e.position.set(x, y + h / 2, z); g.add(e);
        const nx = Math.round(w / 0.07);
        for (let i = 1; i < nx; i++) g.add(box(0.006, h, d + 0.004, frame, x - w / 2 + (i / nx) * w, y, z));
    };
    hall(1.04, 0.14, 0.5, 0, 0.03, 0);
    hall(1.04, 0.12, 0.34, 0, 0.17, 0);
    hall(1.04, 0.1, 0.18, 0, 0.29, 0);
    const vault = (len, r, x, y, z, ry) => {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, false, 0, Math.PI), m.glass);
        v.rotation.set(0, ry, Math.PI / 2); v.position.set(x, y, z); g.add(v);
        for (let i = 0; i <= 8; i++) {
            const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 4, 20, Math.PI), frame);
            const t = (i / 8 - 0.5) * len;
            rib.position.set(x + (ry ? 0 : t), y, z + (ry ? t : 0)); rib.rotation.y = ry ? 0 : Math.PI / 2; g.add(rib);
        }
    };
    vault(0.56, 0.11, 0, 0.39, 0, Math.PI / 2);                        // the great transept
    g.add(box(0.22, 0.36, 0.56, m.glass, 0, 0.03, 0));
    vault(1.04, 0.05, 0, 0.39, 0, 0);
    return g;
}

function skyscraper() {
    const m = materials(), g = new THREE.Group();
    g.add(box(0.7, 0.03, 0.7, m.darkstone));
    const tiers = [[0.46, 0.2, 0.36], [0.34, 0.5, 0.28], [0.26, 0.26, 0.22], [0.18, 0.12, 0.16], [0.11, 0.08, 0.11]];
    let y = 0.03;
    for (const [w, h, d] of tiers) {
        g.add(box(w, h, d, m.limestone, 0, y, 0));
        const n = Math.max(2, Math.round(w / 0.05));
        for (let i = 0; i < n; i++) {
            const x = -w / 2 + (i + 0.5) / n * w;
            g.add(box(w / n * 0.45, h * 0.92, d + 0.006, m.window, x, y + h * 0.04, 0));
        }
        const nz = Math.max(2, Math.round(d / 0.05));
        for (let i = 0; i < nz; i++) g.add(box(w + 0.006, h * 0.92, d / nz * 0.45, m.window, 0, y + h * 0.04, -d / 2 + (i + 0.5) / nz * d));
        y += h;
    }
    g.add(cyl(0.02, 0.045, 0.1, m.steel, 0, y, 0, 8));
    g.add(cyl(0.004, 0.012, 0.16, m.steel, 0, y + 0.1, 0, 6));
    return g;
}

export const MINIATURES = { gardens, temple, statue, mausoleum, colossus, pharos, colosseum, greatWall, library, tower, cathedral, palace, skyscraper };
