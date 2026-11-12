// Procedural textures — everything is generated at start-up, there are no image files to load.
import * as THREE from 'three';

function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// tileable value noise: `period` lattice cells per tile
function vnoise(x, y, period, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const w = (v) => ((v % period) + period) % period;
    const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
    const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(u, v, base = 4, oct = 5, seed = 1) {
    let s = 0, a = 0.5, p = base;
    for (let i = 0; i < oct; i++) { s += a * vnoise(u * p, v * p, p, seed + i * 17); a *= 0.5; p *= 2; }
    return s;
}

// height(u,v) in 0..1 and color(u,v,h) -> [r,g,b] 0..255 ; returns { map, normalMap }
export function buildMaps(size, height, color, { strength = 2, repeat = 1, anisotropy = 8 } = {}) {
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = height(x / size, y / size);
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
    const cc = mk(), cn = mk();
    const xc = cc.getContext('2d'), xn = cn.getContext('2d');
    const ic = xc.createImageData(size, size), inn = xn.createImageData(size, size);
    const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4, h = H[y * size + x];
            const col = color(x / size, y / size, h);
            ic.data[i] = col[0]; ic.data[i + 1] = col[1]; ic.data[i + 2] = col[2]; ic.data[i + 3] = col[3] ?? 255;
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength * size / 64;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength * size / 64;
            const l = Math.hypot(dx, dy, 1);
            inn.data[i] = (-dx / l * 0.5 + 0.5) * 255;
            inn.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
            inn.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
            inn.data[i + 3] = 255;
        }
    }
    xc.putImageData(ic, 0, 0); xn.putImageData(inn, 0, 0);
    const map = new THREE.CanvasTexture(cc), normalMap = new THREE.CanvasTexture(cn);
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat, repeat);
        t.anisotropy = anisotropy;
    }
    return { map, normalMap };
}

const mix = (a, b, t) => a + (b - a) * t;
const shade = (rgb, k) => [rgb[0] * k, rgb[1] * k, rgb[2] * k];

let cache = {};
const once = (key, fn) => cache[key] || (cache[key] = fn());

// wind-rippled sand
export const sandMaps = () => once('sand', () => buildMaps(512,
    (u, v) => {
        const warp = fbm(u, v, 3, 3, 5) * 0.9;
        const ripple = 0.5 + 0.5 * Math.sin((v * 46 + warp * 9 + u * 4) * Math.PI);
        return ripple * 0.55 + fbm(u, v, 24, 3, 9) * 0.45;
    },
    (u, v, h) => {
        const g = fbm(u, v, 64, 2, 3);
        const k = 0.86 + h * 0.16 + (g - 0.5) * 0.12;
        return shade([226, 188, 132], k);
    }, { strength: 1.6, repeat: 28 }));

// weathered limestone: pitted, with faint strata
export const limestoneMaps = () => once('lime', () => buildMaps(512,
    (u, v) => {
        const n = fbm(u, v, 6, 6, 21);
        const pits = Math.pow(fbm(u, v, 40, 2, 4), 3) * 1.4;
        const strata = 0.5 + 0.5 * Math.sin(v * Math.PI * 20 + n * 14);
        return n * 0.6 + strata * 0.12 - pits * 0.5 + 0.2;
    },
    (u, v, h) => {
        const tone = fbm(u, v, 3, 4, 77);
        const k = 0.72 + h * 0.36;
        return [mix(205, 232, tone) * k, mix(176, 205, tone) * k, mix(128, 160, tone) * k];
    }, { strength: 2.4 }));

// paving / plaster
export const paveMaps = () => once('pave', () => buildMaps(512,
    (u, v) => {
        const gx = Math.abs(((u * 8) % 1) - 0.5), gy = Math.abs((((v * 8) + (Math.floor(u * 8) % 2) * 0.5) % 1) - 0.5);
        const joint = Math.min(1, (0.5 - Math.max(gx, gy)) * 22);
        return joint * 0.7 + fbm(u, v, 16, 4, 31) * 0.3;
    },
    (u, v, h) => {
        const t = fbm(u, v, 5, 3, 12);
        const k = 0.55 + h * 0.5;
        return [mix(196, 214, t) * k, mix(170, 186, t) * k, mix(128, 146, t) * k];
    }, { strength: 2.2, repeat: 6 }));

// dark polished mahogany
export const woodMaps = () => once('wood', () => buildMaps(512,
    (u, v) => {
        const warp = fbm(u, v, 3, 4, 8);
        return 0.5 + 0.5 * Math.sin((u * 26 + warp * 10) * Math.PI);
    },
    (u, v, h) => {
        const f = fbm(u * 1, v, 90, 2, 2);
        const k = 0.62 + h * 0.34 + (f - 0.5) * 0.18;
        return [96 * k, 44 * k, 24 * k];
    }, { strength: 0.25, repeat: 2 }));

// exhibition floor boards
export const floorMaps = () => once('floor', () => buildMaps(512,
    (u, v) => {
        const plank = Math.min(1, (0.5 - Math.abs(((u * 10) % 1) - 0.5)) * 30);
        const end = Math.min(1, (0.5 - Math.abs((((v * 2) + Math.floor(u * 10) * 0.37) % 1) - 0.5)) * 120);
        return Math.min(plank, end) * 0.8 + fbm(u, v * 0.2, 60, 2, 6) * 0.2;
    },
    (u, v, h) => {
        const id = hash(Math.floor(u * 10), Math.floor(v * 2 + Math.floor(u * 10) * 0.37), 5);
        const g = fbm(u * 4, v * 0.25, 48, 3, 14);
        const k = (0.58 + id * 0.22 + (g - 0.5) * 0.3) * (0.5 + h * 0.5);
        return [150 * k, 108 * k, 66 * k];
    }, { strength: 1.2, repeat: 6 }));

// red baize for the table runner
export const clothMaps = () => once('cloth', () => buildMaps(256,
    (u, v) => 0.5 + 0.25 * Math.sin(u * 256 * Math.PI) * Math.sin(v * 256 * Math.PI) + fbm(u, v, 32, 2, 3) * 0.3,
    (u, v, h) => shade([104, 22, 26], 0.8 + h * 0.3), { strength: 1.4, repeat: 10 }));

// marble for plinths and classical miniatures
export const marbleMaps = () => once('marble', () => buildMaps(512,
    (u, v) => fbm(u, v, 8, 4, 40) * 0.3,
    (u, v) => {
        const n = fbm(u, v, 3, 6, 50);
        const vein = Math.pow(1 - Math.abs(Math.sin((u * 5 + n * 7) * Math.PI)), 14);
        const k = 0.9 + fbm(u, v, 20, 2, 60) * 0.12 - vein * 0.32;
        return [238 * k, 233 * k, 224 * k];
    }, { strength: 0.3 }));

// glazing bars: opaque iron lines on clear glass (alpha in the map)
export function glazingTexture(cols = 4, rows = 4, bar = 0.035) {
    const size = 256;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.clearRect(0, 0, size, size);
    x.fillStyle = 'rgba(190,215,230,0.10)';
    x.fillRect(0, 0, size, size);
    x.fillStyle = 'rgba(214,224,232,1)';
    const bw = bar * size;
    for (let i = 0; i <= cols; i++) x.fillRect((i / cols) * size - bw / 2, 0, bw, size);
    for (let j = 0; j <= rows; j++) x.fillRect(0, (j / rows) * size - bw / 2, size, bw);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

// free-form canvas helper (labels, papyrus, maps)
export function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

export function papyrusBase(x, w, h, seed = 3) {
    x.fillStyle = '#d9bf8a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
        const horiz = i % 2 === 0;
        const a = 0.03 + hash(i, 1, seed) * 0.07;
        x.fillStyle = hash(i, 2, seed) > 0.5 ? `rgba(120,84,40,${a})` : `rgba(255,236,190,${a})`;
        const p = hash(i, 3, seed);
        if (horiz) x.fillRect(0, p * h, w, 1 + hash(i, 4, seed) * 3);
        else x.fillRect(p * w, 0, 1 + hash(i, 4, seed) * 3, h);
    }
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(90,50,10,0)'); g.addColorStop(1, 'rgba(90,50,10,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
}
