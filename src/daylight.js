// Time of day, taken from the player's own clock, shared by the Crystal Palace and every game.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const LATITUDE = 30 * DEG; // Giza. Close enough for every wonder on the table.

// Light presets cycle: null = live clock, otherwise a fixed hour.
export const LIGHT_PRESETS = [
    { id: 'live', label: 'Live', hour: null },
    { id: 'dawn', label: 'Dawn', hour: 6.4 },
    { id: 'noon', label: 'Noon', hour: 12.5 },
    { id: 'dusk', label: 'Dusk', hour: 17.9 },
    { id: 'night', label: 'Night', hour: 23 },
];

// keyframes over the sun's elevation in degrees
const KEYS = [
    { e: -18, top: 0x060b1c, hor: 0x121c40, sun: 0xa9c0f0, power: 1.0, amb: 0.55, exp: 1.25, stars: 1 },
    { e: -8, top: 0x0a1230, hor: 0x2b2f58, sun: 0xa9c0f0, power: 0.85, amb: 0.5, exp: 1.25, stars: 0.8 },
    { e: -3, top: 0x1c2a5c, hor: 0xc07a62, sun: 0xffb38a, power: 0.9, amb: 0.5, exp: 1.15, stars: 0.25 },
    { e: 2, top: 0x33529a, hor: 0xf0a878, sun: 0xffa868, power: 2.2, amb: 0.48, exp: 1.0, stars: 0 },
    { e: 10, top: 0x3a6cb8, hor: 0xffd3a0, sun: 0xffc488, power: 3.0, amb: 0.5, exp: 0.98, stars: 0 },
    { e: 28, top: 0x2f72c8, hor: 0xcfe2f0, sun: 0xfff0d8, power: 3.6, amb: 0.6, exp: 0.92, stars: 0 },
    { e: 90, top: 0x2468c4, hor: 0xc4dcf0, sun: 0xfffaf0, power: 3.9, amb: 0.65, exp: 0.9, stars: 0 },
];

const cA = new THREE.Color(), cB = new THREE.Color();
function lerpHex(a, b, t, out) { return out.copy(cA.setHex(a)).lerp(cB.setHex(b), t); }

export function localHour(date = new Date()) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function computeDaylight(hour, date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const day = Math.floor((date - start) / 86400000);
    const decl = -23.44 * DEG * Math.cos((2 * Math.PI * (day + 10)) / 365);
    const H = (hour - 12) * 15 * DEG;
    const sinEl = Math.sin(LATITUDE) * Math.sin(decl) + Math.cos(LATITUDE) * Math.cos(decl) * Math.cos(H);
    const el = Math.asin(sinEl);
    // azimuth measured from south, positive toward west
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LATITUDE) - Math.tan(decl) * Math.cos(LATITUDE));
    // scene axes: +x east, +z south, +y up — rotated a little so shadows never run square to the boards
    const yaw = az + 0.55;
    const sunDir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).normalize();

    const eDeg = el / DEG;
    let i = 0;
    while (i < KEYS.length - 2 && eDeg > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = THREE.MathUtils.clamp((eDeg - a.e) / (b.e - a.e), 0, 1);
    const L = (k) => a[k] + (b[k] - a[k]) * t;

    const night = eDeg < -4;
    // the moon rides opposite the sun, never too low, so nights stay readable
    const moonDir = new THREE.Vector3(-sunDir.x, 0, -sunDir.z);
    if (moonDir.lengthSq() < 1e-4) moonDir.set(0.4, 0, 0.6);
    moonDir.normalize().multiplyScalar(Math.cos(42 * DEG)).setY(Math.sin(42 * DEG));

    const phase = eDeg < -4 ? 'night' : eDeg < 12 ? (hour < 12 ? 'dawn' : 'dusk') : 'day';
    return {
        hour, elevation: eDeg, phase, night,
        sunDir, moonDir,
        keyDir: night ? moonDir : sunDir.clone().setY(Math.max(sunDir.y, 0.06)).normalize(),
        keyColor: lerpHex(a.sun, b.sun, t, new THREE.Color()),
        keyPower: L('power'),
        ambient: L('amb'),
        exposure: L('exp'),
        stars: L('stars'),
        skyTop: lerpHex(a.top, b.top, t, new THREE.Color()),
        skyHorizon: lerpHex(a.hor, b.hor, t, new THREE.Color()),
        lamps: THREE.MathUtils.clamp((6 - eDeg) / 8, 0, 1), // 0 by day, 1 once it is dark
        low: THREE.MathUtils.clamp((12 - eDeg) / 14, 0, 1),   // 1 around sunrise and sunset and through the night
    };
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 0.0);
    gl_Position = projectionMatrix * vec4(p.xyz, 1.0);
    gl_Position.z = gl_Position.w;
}`;

const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uMoonDir;
uniform vec3 uSunColor; uniform float uStars; uniform float uTime; uniform float uNight; uniform float uHaze;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main() {
    vec3 d = normalize(vDir);
    float y = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uTop, pow(y, 0.45));
    // ground haze below the horizon
    col = mix(col, uHorizon * 0.75, smoothstep(0.0, -0.25, d.y));
    // sun: glow, halo, disc
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    float day = 1.0 - uNight;
    col += uSunColor * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5) * (0.35 + 0.65 * day) * step(-0.12, uSunDir.y);
    col += uSunColor * smoothstep(0.9994, 0.9998, sd) * 30.0 * step(-0.02, d.y);
    // moon
    float md = max(dot(d, normalize(uMoonDir)), 0.0);
    col += vec3(0.75, 0.85, 1.0) * (smoothstep(0.9993, 0.9996, md) * 3.5 + pow(md, 90.0) * 0.25) * uNight;
    // stars
    if (uStars > 0.01 && d.y > 0.0) {
        vec3 sp = d * 190.0, g = floor(sp);
        float h = hash3(g);
        float tw = 0.7 + 0.3 * sin(uTime * 2.0 + h * 90.0);
        col += vec3(0.9, 0.95, 1.0) * step(0.9968, h) * smoothstep(0.3, 0.05, length(fract(sp) - 0.5)) * 2.5 * tw * uStars * smoothstep(0.0, 0.25, d.y) * 1.6;
    }
    // high clouds
    if (d.y > 0.02) {
        vec2 uv = d.xz / (d.y + 0.18) * 1.1 + vec2(uTime * 0.006, uTime * 0.002);
        float c = smoothstep(0.52, 0.86, fbm(uv));
        vec3 lit = mix(uHorizon * 1.15 + uSunColor * 0.25 * day, vec3(1.0), 0.35 * day);
        col = mix(col, lit * (0.25 + 0.75 * day) + col * 0.2, c * 0.55 * smoothstep(0.02, 0.3, d.y));
    }
    col = mix(col, uHorizon, uHaze * (1.0 - 0.6 * y));
    gl_FragColor = vec4(col, 1.0);
}`;

// One set of uniforms drives the sky of every scene.
export const skyUniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 },
    uNight: { value: 0 }, uHaze: { value: 0 },
};

export function makeSkyDome() {
    const mat = new THREE.ShaderMaterial({
        uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, toneMapped: true,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
}

export function applySky(d) {
    skyUniforms.uTop.value.copy(d.skyTop);
    skyUniforms.uHorizon.value.copy(d.skyHorizon);
    skyUniforms.uSunDir.value.copy(d.sunDir);
    skyUniforms.uMoonDir.value.copy(d.moonDir);
    skyUniforms.uSunColor.value.copy(d.keyColor);
    skyUniforms.uStars.value = d.stars;
    skyUniforms.uNight.value = d.night ? 1 : 0;
}
