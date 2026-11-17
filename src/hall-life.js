// Life in the Exhibition hall, after the 1851 lithographs and the hand-coloured photographs of the Crystal Palace:
// galleries with red lattice balustrades and court signs, carpets hung over the rails, tapestries and cases in the
// side aisles, marble and bronze statues, running water, a lily canal, the great elm, and visitors strolling.
// Everything static is merged by material; the visitors are instanced, so the hall stays cheap to draw.
import * as THREE from 'three';
import { Particles, box, cyl, shadowed, mergeByMaterial } from './fx.js';
import { canvasTexture } from './textures.js';
import { materials } from './models.js';

const rand = (() => { let s = 1851; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = (a) => a[Math.floor(rand() * a.length)];

// the walking lanes keep clear of the table, where the browsing camera circles (|x| < 10.5, |z| < 4.5)
const FOUNTAIN_X = 19, CANAL = { x0: 25, x1: 32, w: 2.4 }, ELM_X = 34.6, RIDER_X = -26;

export function buildHallLife(scene, { HALL, iron }) {
    const { len, half, bay } = HALL;
    const [blue, cream, red, yellow] = iron;
    const m = materials();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const st = new THREE.Group(); // everything that never moves
    const nBays = Math.round(len / bay);
    const bayX = (i) => -len / 2 + i * bay;

    // ---------------------------------------------------------------- galleries
    const lattice = canvasTexture(128, 128, (x, w, h) => {
        x.clearRect(0, 0, w, h);
        x.strokeStyle = '#a33a2c'; x.lineWidth = 7;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
        x.fillStyle = '#a33a2c'; x.fillRect(0, 0, w, 12); x.fillRect(0, h - 12, w, 12);
        x.fillStyle = '#d9b650'; x.fillRect(0, 12, w, 3); x.fillRect(0, h - 15, w, 3);
    });
    lattice.wrapS = THREE.RepeatWrapping; lattice.repeat.set(len / 1.1, 1);
    const rail = std({ map: lattice, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
    const G1 = 5.2, G2 = 7.7; // deck heights of the two gallery floors
    for (const s of [-1, 1]) {
        const e1 = 8.4, e2 = 9.4; // inner edges of the decks
        st.add(box(len, 0.2, half - e1, cream, 0, G1, s * (e1 + half) / 2));
        st.add(box(len, 0.42, 0.08, blue, 0, G1 - 0.36, s * e1));
        st.add(box(len, 0.18, half - e2, cream, 0, G2, s * (e2 + half) / 2));
        st.add(box(len, 0.32, 0.07, blue, 0, G2 - 0.28, s * e2));
        for (const [e, y] of [[e1, G1 + 0.2], [e2, G2 + 0.18]]) {
            const r = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.92), rail);
            r.position.set(0, y + 0.46, s * (e + 0.02)); st.add(r);
            st.add(box(len, 0.05, 0.1, yellow, 0, y + 0.92, s * (e + 0.02)));
        }
        for (let i = 0; i <= nBays; i += 2) {
            const x = bayX(i);
            st.add(cyl(0.07, 0.08, G1, blue, x, 0, s * e1, 8));
            st.add(box(0.2, 0.14, 0.2, yellow, x, G1 - 0.5, s * e1));
            st.add(cyl(0.06, 0.07, G2 - G1 - 0.2, blue, x, G1 + 0.2, s * e2, 8));
        }
    }

    // court signs on the gallery fascia, and carpets hung over the balustrade in the other bays
    const COURTS = ['EGYPT', 'GREECE', 'BABYLON', 'RHODES', 'ALEXANDRIA', 'PERSIA', 'INDIA', 'CHINA', 'SILKS', 'FINE ARTS', 'MACHINERY', 'ROME', 'TURKEY', 'ITALY', 'JEWELLERY', 'GLASS'];
    const signMat = (t) => std({ roughness: 0.6, map: canvasTexture(512, 96, (x, w, h) => {
        x.fillStyle = '#a33a2c'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#e8c96a'; x.lineWidth = 5; x.strokeRect(9, 9, w - 18, h - 18);
        x.fillStyle = '#f3e3b0'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(t, w / 2, h / 2 + 3, w - 60);
    }) });
    const carpets = [0, 1, 2, 3].map((k) => carpetMat(k));
    let court = 0;
    for (const s of [-1, 1]) for (let i = 0; i < nBays; i++) {
        const x = bayX(i) + bay / 2;
        if ((i + (s > 0 ? 2 : 0)) % 4 !== 1) {
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.43), signMat(COURTS[court++ % COURTS.length]));
            sign.position.set(x, G1 - 0.15, s * 8.33); sign.rotation.y = s > 0 ? Math.PI : 0; st.add(sign);
        } else {
            const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), carpets[(i + court) % 4]);
            rug.position.set(x, G1 + 1.1 - 1.15, s * 8.31); rug.rotation.y = s > 0 ? Math.PI : 0; st.add(rug);
        }
    }

    // ---------------------------------------------------------------- the side aisles: tapestries, curtains, cases, statues
    const curtain = std({ roughness: 0.9, side: THREE.DoubleSide, map: canvasTexture(128, 4, (x, w, h) => {
        for (let px = 0; px < w; px++) { const v = 0.55 + 0.45 * Math.sin(px / w * Math.PI * 10); x.fillStyle = `rgb(${70 + v * 62 | 0},${16 + v * 16 | 0},${18 + v * 12 | 0})`; x.fillRect(px, 0, 1, h); }
    }) });
    const plinthRed = std({ color: 0x5e2420, roughness: 0.7 });
    const darkWood = std({ color: 0x3a1f10, roughness: 0.55 });
    const sevres = std({ color: 0x24448e, roughness: 0.25, metalness: 0.1 });
    for (const s of [-1, 1]) for (let i = 0; i < nBays; i++) {
        const x = bayX(i) + bay / 2, kind = (i * 3 + (s > 0 ? 1 : 0)) % 3;
        if ((i + (s > 0 ? 1 : 0)) % 2 === 0) {
            const tap = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), carpets[(i + (s > 0 ? 2 : 0)) % 4]);
            tap.position.set(x, 2.3, s * (half - 0.12)); tap.rotation.y = s > 0 ? Math.PI : 0; st.add(tap);
            for (const dx of [-1.45, 1.45]) {
                const c = new THREE.Mesh(new THREE.PlaneGeometry(0.55, G1 - 0.1), curtain);
                c.position.set(x + dx, (G1 - 0.1) / 2, s * (half - 0.3)); c.rotation.y = s > 0 ? Math.PI : 0; st.add(c);
            }
        }
        const z = s * 9.75;
        if (kind === 0) st.add(statue(m.marble, plinthRed, x, z, i));
        else if (kind === 1) { // a glass case on a dark stand, with a gilt cup inside
            st.add(box(1.5, 0.75, 0.75, darkWood, x, 0, z));
            st.add(box(1.4, 0.62, 0.66, m.glass, x, 0.75, z));
            st.add(cyl(0.06, 0.1, 0.24, m.gold, x - 0.3, 0.75, z, 12), cyl(0.12, 0.05, 0.12, m.gold, x - 0.3, 0.99, z, 12));
            st.add(box(0.4, 0.06, 0.3, m.brass, x + 0.3, 0.75, z));
        } else { // a great Sèvres vase on a plinth
            st.add(box(0.7, 0.9, 0.7, plinthRed, x, 0, z));
            st.add(lathe([[0, 0], [0.16, 0], [0.12, 0.08], [0.24, 0.35], [0.26, 0.55], [0.14, 0.82], [0.11, 0.95], [0.2, 1.05], [0, 1.05]], sevres, x, 0.9, z));
            st.add(cyl(0.255, 0.255, 0.05, m.gold, x, 1.36, z, 18));
        }
    }

    const cypress = std({ color: 0x2f4f2c, roughness: 0.85, flatShading: true });
    // ---------------------------------------------------------------- the nave: palms are set by the hall; here conifers in Versailles boxes
    for (let i = 2; i < nBays; i += 2) for (const s of [-1, 1]) {
        const x = bayX(i), z = s * 7.6, g = new THREE.Group();
        g.add(box(0.8, 0.75, 0.8, cream), box(0.86, 0.06, 0.86, blue, 0, 0.72, 0));
        g.add(cyl(0.05, 0.06, 0.6, m.wood, 0, 0.75, 0, 6));
        const h = 2.3 + (i % 3) * 0.35;
        for (let k = 0; k < 3; k++) g.add(cone(0.46 - k * 0.1, h * (0.55 - k * 0.1), k % 2 ? cypress : m.darkleaf, 0, 1.0 + k * h * 0.27, 0));
        g.position.set(x, 0, z); st.add(g);
    }

    // marble figures at the corners of both fountains
    for (const fx of [-FOUNTAIN_X, FOUNTAIN_X]) for (const [dx, dz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) st.add(statue(m.marble, m.marble, fx + dx, dz, dx * 3 + dz));

    // ---------------------------------------------------------------- east: the lily canal, its round basin, and the elm
    const pool = new THREE.MeshPhysicalMaterial({ color: 0x2b5c5a, roughness: 0.05, metalness: 0.1, clearcoat: 1 });
    const { x0, x1, w } = CANAL, cx = (x0 + x1) / 2, L = x1 - x0;
    st.add(box(L, 0.08, w, darkWood, cx, 0, 0));
    st.add(box(L, 0.02, w - 0.1, pool, cx, 0.16, 0));
    for (const s of [-1, 1]) st.add(box(L + 0.3, 0.26, 0.15, m.marble, cx, 0, s * (w / 2 + 0.07)));
    st.add(box(0.15, 0.26, w + 0.3, m.marble, x1 + 0.07, 0, 0));
    st.add(cyl(1.4, 1.45, 0.26, m.marble, x0, 0, 0, 32), cyl(1.28, 1.28, 0.02, pool, x0, 0.18, 0, 32));
    st.add(cyl(0.35, 0.45, 0.4, m.marble, x0, 0.1, 0, 16), cyl(0.12, 0.16, 0.35, m.marble, x0, 0.5, 0, 12), cyl(0.5, 0.2, 0.1, m.marble, x0, 0.85, 0, 18));
    const pad = std({ color: 0x4f8a3a, roughness: 0.7 }), padDark = std({ color: 0x3b6e2e, roughness: 0.7 });
    const bloomPink = std({ color: 0xf2a6c0, roughness: 0.6 }), bloomWhite = std({ color: 0xf6f0e4, roughness: 0.6 });
    for (let k = 0; k < 80; k++) {
        const px = x0 + 1.0 + rand() * (L - 1.2), pz = (rand() - 0.5) * (w - 0.5), r = 0.1 + rand() * 0.14;
        st.add(cyl(r, r, 0.012, k % 3 ? pad : padDark, px, 0.18, pz, 10));
        if (k % 7 === 0) st.add(sphere(0.045, k % 2 ? bloomPink : bloomWhite, px, 0.21, pz));
    }
    const flowerMats = [0xc8323a, 0xe9a0b4, 0xf3eedb, 0xe8c044, 0x9a5ac0].map((c) => std({ color: c, roughness: 0.7 }));
    const urn = (x, z, flowers) => {
        st.add(lathe([[0, 0], [0.22, 0], [0.16, 0.08], [0.18, 0.3], [0.32, 0.5], [0, 0.5]], m.marble, x, 0, z));
        if (flowers) for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 0.08 + (k % 4) * 0.06; st.add(sphere(0.06, flowerMats[(k + Math.round(x)) % 5], x + Math.cos(a) * r, 0.55 + (k % 3) * 0.04, z + Math.sin(a) * r)); }
        else st.add(fern(x, 0.48, z));
    };
    for (let x = x0 + 1.6, k = 0; x < x1; x += 1.6, k++) for (const s of [-1, 1]) urn(x, s * (w / 2 + 0.5), k % 2 === 0);

    // the great elm, which the builders roofed over instead of felling
    const bark = std({ color: 0x5a4636, roughness: 0.95 });
    st.add(cyl(0.38, 0.6, 5.2, bark, ELM_X, 0, 0, 10));
    const leaves = [0x587d44, 0x46703a, 0x3b5f33].map((c) => std({ color: c, roughness: 0.95 }));
    for (let k = 0; k < 80; k++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()), y = 6.8 + (rand() - 0.3) * 4.2;
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + rand() * 0.75, 1), leaves[k % 3]);
        blob.position.set(ELM_X + Math.cos(a) * r * 2.9, y, Math.sin(a) * r * 5.2); blob.rotation.set(rand() * 3, rand() * 3, 0);
        st.add(blob);
    }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; st.add(fern(ELM_X + Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3)); }

    // ---------------------------------------------------------------- west: the bronze rider and a gilded pavilion
    const bronze = std({ color: 0x8c6a32, roughness: 0.35, metalness: 0.85 });
    st.add(box(2.6, 1.3, 1.1, plinthRed, RIDER_X, 0, 0), box(2.8, 0.1, 1.3, m.marble, RIDER_X, 1.3, 0), box(2.8, 0.12, 1.3, m.marble, RIDER_X, 0, 0));
    st.add(rider(bronze, RIDER_X, 1.4, 0));
    const px = -34.4;
    st.add(cyl(1.9, 2.0, 0.25, m.marble, px, 0, 0, 8));
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; st.add(cyl(0.07, 0.07, 3.1, m.gold, px + Math.cos(a) * 1.6, 0.25, Math.sin(a) * 1.6, 8)); }
    st.add(cyl(1.85, 1.85, 0.3, m.gold, px, 3.35, 0, 8));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.position.set(px, 3.65, 0); dome.scale.y = 0.9; st.add(dome);
    st.add(cyl(0.02, 0.12, 0.7, m.gold, px, 5.2, 0, 8));
    st.add(box(0.8, 1.0, 0.8, plinthRed, px, 0.25, 0), box(0.5, 0.5, 0.5, m.glass, px, 1.25, 0), sphere(0.11, m.glass, px, 1.5, 0));

    shadowed(st, true, false);
    mergeByMaterial(st);
    st.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    scene.add(st);

    // ---------------------------------------------------------------- running water
    const spray = new Particles(1100, { color: 0xe4f2ff, fog: true });
    spray.gravity = 7; spray.material.uniforms.uOpacity.value = 0.65;
    scene.add(spray.points);
    // [x, y, rim radius, outward speed, upward speed, per second, life]
    const jets = [];
    for (const fx of [-FOUNTAIN_X, FOUNTAIN_X]) jets.push(
        [fx, 5.42, 0.02, 0.32, 2.1, 160, 0.8],      // the crowning jet
        [fx, 3.62, 0.7, 0.5, 0.2, 60, 0.3],          // and splashes where the falling sheets land
        [fx, 2.22, 1.06, 0.5, 0.2, 80, 0.3],
        [fx, 0.52, 1.5, 0.6, 0.3, 120, 0.32]);
    jets.push([CANAL.x0, 0.96, 0.02, 0.22, 2.4, 50, 0.7], [CANAL.x0, 0.96, 0.5, 0.2, 0.05, 50, 0.38]);
    for (const x of [27.6, 30.2]) jets.push([x, 0.2, 0.01, 0.12, 2.2, 22, 0.62]);
    const owed = jets.map(() => 0);
    const streaks = canvasTexture(64, 128, (x, w, h) => {
        x.clearRect(0, 0, w, h);
        for (let i = 0; i < 46; i++) { const px = (i * 37) % w, a = 0.25 + ((i * 13) % 7) / 10; x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(px, (i * 53) % h, 1 + (i % 2), 18 + (i * 7) % 40); }
    });
    streaks.wrapS = streaks.wrapT = THREE.RepeatWrapping; streaks.repeat.set(5, 1);
    const sheet = new THREE.MeshBasicMaterial({ color: 0xd8ecf8, map: streaks, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const sheets = new THREE.Group();
    const fall = (x, y, r, h) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, h, 28, 1, true), sheet); c.position.set(x, y - h / 2, 0); sheets.add(c); };
    for (const fx of [-FOUNTAIN_X, FOUNTAIN_X]) { fall(fx, 4.7, 0.37, 1.08); fall(fx, 3.62, 0.69, 1.4); fall(fx, 2.22, 1.05, 1.7); }
    fall(CANAL.x0, 0.95, 0.5, 0.75);
    scene.add(sheets);

    // ---------------------------------------------------------------- visitors
    const crowd = new Crowd(scene);
    for (let k = 0; k < 46; k++) { // up and down the two promenades
        const s = k % 2 ? 1 : -1;
        crowd.add({ kind: 'line', z: s * (5.3 + rand() * 1.5), x: -33 + rand() * 66, xa: -33, xb: 33, dir: rand() < 0.5 ? 1 : -1 });
    }
    for (let k = 0; k < 16; k++) crowd.add({ kind: 'ring', cx: k % 2 ? FOUNTAIN_X : -FOUNTAIN_X, r: 3.2 + rand() * 0.6, a: rand() * 6.3, dir: rand() < 0.5 ? 1 : -1 });
    for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1; crowd.add({ kind: 'line', z: s * (1.9 + rand() * 0.8), x: 24 + rand() * 8, xa: 24, xb: 32, dir: rand() < 0.5 ? 1 : -1 }); }
    for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1; crowd.add({ kind: 'line', z: s * (1.7 + rand() * 1.2), x: -32 + rand() * 9, xa: -32, xb: -23, dir: rand() < 0.5 ? 1 : -1 }); }
    for (let k = 0; k < 6; k++) crowd.add({ kind: 'stand', x: (k % 3 - 1) * 1.2 + (k < 3 ? -27.5 : -24.5), z: (k % 2 ? 1 : -1) * 1.15, face: k < 3 ? Math.PI / 2 : -Math.PI / 2 }); // looking up at the rider
    for (let k = 0; k < 28; k++) { // leaning on the gallery rails
        const s = k % 2 ? 1 : -1, up = k % 4 === 3;
        crowd.add({ kind: 'stand', x: -34 + rand() * 68, y: up ? G2 + 0.18 : G1 + 0.2, z: s * (up ? 9.75 : 8.75), face: s > 0 ? Math.PI : 0 });
    }
    crowd.finish();

    return {
        update(dt, time) {
            for (let j = 0; j < jets.length; j++) {
                const [x, y, r, out, up, rate, life] = jets[j];
                owed[j] += rate * dt;
                for (; owed[j] >= 1; owed[j]--) {
                    const a = rand() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), v = out * (0.7 + rand() * 0.6);
                    spray.emit(x + c * r, y, s * r, c * v, up * (0.85 + rand() * 0.3), s * v, life * (0.9 + rand() * 0.2), 0.06 + rand() * 0.05, 0.8);
                }
            }
            spray.update(dt);
            streaks.offset.y = (streaks.offset.y + dt * 1.1) % 1;
            crowd.update(dt, time);
        },
    };
}

// ---------------------------------------------------------------- small builders
function cone(r, h, mat, x, y, z) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat); c.position.set(x, y + h / 2, z); return c; }
function sphere(r, mat, x, y, z) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat); s.position.set(x, y, z); return s; }
function lathe(pts, mat, x, y, z) {
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 16);
    const l = new THREE.Mesh(g, mat); l.position.set(x, y, z); return l;
}
function fern(x, y, z) {
    const m = materials(), g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 4, 1), i % 2 ? m.foliage : m.darkleaf);
        f.geometry.translate(0, 0.35, 0); f.scale.z = 0.16;
        const p = new THREE.Group(); p.rotation.y = i / 9 * Math.PI * 2 + x; f.rotation.z = -0.9 - (i % 3) * 0.2;
        p.add(f); g.add(p);
    }
    g.position.set(x, y, z); return g;
}
// a draped marble figure on its plinth, varied by a seed
function statue(stone, base, x, z, seed) {
    const g = new THREE.Group(), v = Math.abs(Math.round(seed * 7)) % 4;
    g.add(box(0.7, 1.0, 0.7, base), box(0.8, 0.08, 0.8, stone, 0, 1.0, 0));
    g.add(lathe([[0, 0], [0.24, 0], [0.22, 0.2], [0.16, 0.7], [0.18, 1.0], [0.12, 1.15], [0, 1.18]], stone, 0, 1.08, 0));
    g.add(sphere(0.1, stone, 0, 2.36, 0.01));
    const arm = cyl(0.04, 0.05, 0.62, stone, 0, 0, 0, 6);
    arm.geometry.translate(0, -0.31, 0); arm.position.set(0.2, 2.15, 0);
    arm.rotation.z = [2.6, 0.3, 2.2, 0.5][v]; arm.rotation.x = [0, 0.5, -0.4, 0][v]; g.add(arm);
    const arm2 = arm.clone(); arm2.position.x = -0.2; arm2.rotation.z = -[0.25, 0.4, 0.3, 2.7][v]; g.add(arm2);
    if (v === 1) g.add(box(0.5, 0.08, 0.3, stone, 0.25, 1.95, 0.2)); // a tablet, or a fold of drapery
    g.position.set(x, 0, z); g.rotation.y = z > 0 ? Math.PI : 0;
    return g;
}
// a bronze rider on a standing horse, facing +x
function rider(mat, x, y, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 4, 10), mat); body.rotation.z = Math.PI / 2; body.position.y = 1.25; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.8, 8), mat); neck.position.set(0.82, 1.62, 0); neck.rotation.z = -0.6; g.add(neck);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.5, 8), mat); head.position.set(1.12, 1.86, 0); head.rotation.z = -2.1; g.add(head);
    for (const s of [-1, 1]) { const ear = cone(0.03, 0.12, mat, 0, 0, 0); ear.position.set(1.0, 2.0, s * 0.05); g.add(ear); }
    for (const [lx, lz, t] of [[0.48, 0.16, 0.0], [0.48, -0.16, -0.5], [-0.5, 0.16, 0.12], [-0.5, -0.16, 0]]) {
        const leg = cyl(0.06, 0.08, 1.12, mat, 0, 0, 0, 6); leg.geometry.translate(0, -0.56, 0);
        leg.position.set(lx, 1.12, lz); leg.rotation.z = t; g.add(leg);
    }
    const tail = cone(0.08, 0.7, mat, 0, 0, 0); tail.position.set(-0.85, 0.75, 0); tail.rotation.z = -0.3; g.add(tail);
    g.add(cyl(0.14, 0.17, 0.6, mat, 0.05, 1.5, 0, 8));
    g.add(sphere(0.11, mat, 0.08, 2.22, 0), cyl(0.13, 0.13, 0.03, mat, 0.08, 2.3, 0, 10), cyl(0.08, 0.09, 0.14, mat, 0.08, 2.32, 0, 10));
    for (const s of [-1, 1]) { const l = cyl(0.06, 0.07, 0.6, mat, 0, 0, 0, 6); l.geometry.translate(0, -0.3, 0); l.position.set(0.08, 1.58, s * 0.3); l.rotation.x = -s * 0.18; g.add(l); }
    const arm = cyl(0.045, 0.05, 0.6, mat, 0, 0, 0, 6); arm.geometry.translate(0, 0.3, 0); arm.position.set(0.1, 1.98, 0.17); arm.rotation.z = -2.2; g.add(arm);
    g.position.set(x, y, z); g.scale.setScalar(1.25);
    return g;
}
function carpetMat(k) {
    const pal = [['#5c1c1e', '#1c2440', '#a88a4c', '#cbbd9c'], ['#1e3048', '#5e2420', '#a8904e', '#cfc2a2'], ['#2a3e2a', '#5c1c1e', '#a88a4c', '#c4b494'], ['#48263c', '#1c2440', '#a8844a', '#cdbc9e']][k];
    const t = canvasTexture(256, 320, (x, w, h) => {
        x.fillStyle = pal[1]; x.fillRect(0, 0, w, h);
        x.fillStyle = pal[0]; x.fillRect(18, 18, w - 36, h - 36);
        x.strokeStyle = pal[2]; x.lineWidth = 4; x.strokeRect(12, 12, w - 24, h - 24); x.strokeRect(24, 24, w - 48, h - 48);
        for (let i = 0; i < 18; i++) { x.fillStyle = pal[i % 2 ? 2 : 3]; x.fillRect(6 + i * 14, 2, 6, 6); x.fillRect(6 + i * 14, h - 8, 6, 6); }
        x.save(); x.translate(w / 2, h / 2);
        for (const [s, c] of [[86, pal[2]], [66, pal[1]], [44, pal[3]], [22, pal[0]]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, -s * 1.3); x.lineTo(s, 0); x.lineTo(0, s * 1.3); x.lineTo(-s, 0); x.closePath(); x.fill(); }
        x.restore();
        x.fillStyle = pal[2];
        for (const [cx, cy] of [[48, 52], [w - 48, 52], [48, h - 52], [w - 48, h - 52]]) { x.beginPath(); x.arc(cx, cy, 13, 0, Math.PI * 2); x.fill(); }
        for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + (i % 5) * 0.01})`; x.fillRect((i * 73) % w, (i * 151) % h, 3, 3); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- the crowd
// Ladies in crinolines and bonnets, gentlemen in frock coats and top hats. Each part is one instanced mesh.
const DRESS = [0x6e2a28, 0x3a4c6c, 0x4a5e44, 0xa88a88, 0x6e6484, 0xcfc4ac, 0x5e5e66, 0x8e7444, 0x2c3c54, 0x5e3448];
const SHAWL = [0x2a2420, 0x6a2a24, 0x3a3a48, 0x8a6a4a, 0xdcd0b8, 0x2f4a3a];
const COAT = [0x1f1c1a, 0x26324a, 0x3a2a20, 0x2f3a2a, 0x4a4440, 0x1a1a22];
const TROUSER = [0x5a5650, 0x2a2826, 0x8a7a60, 0x46423c];
const SKIN = [0xe8c4a8, 0xdcb494, 0xc79a78, 0xf0d0b8];
const BONNET = [0xdcd0b4, 0xc8b080, 0x3a2a24, 0xe8e0d0];
const HAT = [0x141210, 0x1e1c1a, 0x3a342c];

function crowdGeometries() {
    const t = (g, x, y, z) => { g.translate(x, y, z); return g; };
    const skirt = new THREE.LatheGeometry([[0, 0], [0.38, 0], [0.37, 0.12], [0.3, 0.5], [0.18, 0.86], [0.11, 0.92], [0, 0.92]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
    const bodice = t(new THREE.CylinderGeometry(0.11, 0.15, 0.42, 8), 0, 1.12, 0);
    const shoulders = t(new THREE.SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.24, 0);
    const wTop = merge([bodice, shoulders]);
    const wHead = t(new THREE.SphereGeometry(0.1, 8, 6), 0, 1.47, 0);
    const bonnet = t(new THREE.SphereGeometry(0.125, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, 1.49, -0.025);
    const coat = t(new THREE.CylinderGeometry(0.16, 0.2, 0.68, 8), 0, 1.2, 0);
    const tails = t(new THREE.BoxGeometry(0.3, 0.3, 0.06), 0, 0.78, -0.13);
    const mCoat = merge([coat, tails, t(new THREE.SphereGeometry(0.19, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.5, 0)]);
    const mHead = t(new THREE.SphereGeometry(0.1, 8, 6), 0, 1.68, 0);
    const hat = merge([t(new THREE.CylinderGeometry(0.085, 0.08, 0.2, 10), 0, 1.84, 0), t(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), 0, 1.75, 0)]);
    const leg = t(new THREE.CylinderGeometry(0.06, 0.055, 0.88, 6), 0, -0.44, 0); // hangs from the hip
    return { skirt, wTop, wHead, bonnet, mCoat, mHead, hat, leg };
}
function merge(list) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
        const total = parts.reduce((n, g) => n + g.attributes.position.count, 0), arr = new Float32Array(total * 3);
        let at = 0; for (const g of parts) { arr.set(g.attributes[name].array, at); at += g.attributes.position.count * 3; }
        out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    return out;
}

class Crowd {
    constructor(scene) { this.scene = scene; this.people = []; }
    add(p) {
        p.lady = rand() < 0.52; p.v = 0.75 + rand() * 0.45; p.phase = rand() * 6.3; p.scale = 0.92 + rand() * 0.14;
        p.y = p.y || 0; p.yaw = p.face ?? 0;
        p.colors = p.lady ? [pick(DRESS), pick(SHAWL), pick(SKIN), pick(BONNET)] : [pick(COAT), pick(SKIN), pick(HAT), pick(TROUSER)];
        if (p.kind === 'stand') p.v = 0;
        this.people.push(p);
    }
    finish() {
        const G = crowdGeometries();
        const ladies = this.people.filter((p) => p.lady), gents = this.people.filter((p) => !p.lady);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
        const make = (geo, n) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.count = n; im.frustumCulled = false; im.castShadow = true; this.scene.add(im); return im; };
        this.L = { list: ladies, skirt: make(G.skirt, ladies.length), top: make(G.wTop, ladies.length), head: make(G.wHead, ladies.length), bonnet: make(G.bonnet, ladies.length) };
        this.M = { list: gents, coat: make(G.mCoat, gents.length), head: make(G.mHead, gents.length), hat: make(G.hat, gents.length), legL: make(G.leg, gents.length), legR: make(G.leg, gents.length) };
        const c = new THREE.Color();
        ladies.forEach((p, i) => { ['skirt', 'top', 'head', 'bonnet'].forEach((k, j) => this.L[k].setColorAt(i, c.setHex(p.colors[j]))); });
        gents.forEach((p, i) => { ['coat', 'head', 'hat', 'legL'].forEach((k, j) => this.M[k].setColorAt(i, c.setHex(p.colors[j]))); this.M.legR.setColorAt(i, c.setHex(p.colors[3])); });
        this.m = new THREE.Matrix4(); this.leg = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
        this.pos = new THREE.Vector3(); this.sc = new THREE.Vector3();
        this.update(0, 0);
    }
    step(p, dt) {
        let dx = 0, dz = 0;
        if (p.kind === 'line') {
            p.x += p.dir * p.v * dt;
            if (p.x > p.xb) { p.x = p.xb; p.dir = -1; } else if (p.x < p.xa) { p.x = p.xa; p.dir = 1; }
            dx = p.dir; p.px = p.x; p.pz = p.z;
        } else if (p.kind === 'ring') {
            p.a += p.dir * p.v / p.r * dt;
            p.px = p.cx + Math.cos(p.a) * p.r; p.pz = Math.sin(p.a) * p.r;
            dx = -Math.sin(p.a) * p.dir; dz = Math.cos(p.a) * p.dir;
        } else { p.px = p.x; p.pz = p.z; }
        if (p.v > 0) {
            const goal = Math.atan2(dx, dz);
            let d = goal - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
            p.yaw += d * Math.min(1, dt * 5);
            p.phase += p.v * dt * 5.6;
        }
    }
    update(dt, time) {
        const { m, leg, q, e, pos, sc } = this;
        const place = (p) => {
            this.step(p, dt);
            const bob = p.v > 0 ? Math.abs(Math.sin(p.phase)) * 0.025 : 0;
            pos.set(p.px, p.y + bob, p.pz); sc.setScalar(p.scale);
            q.setFromEuler(e.set(0, p.yaw + (p.v ? 0 : Math.sin(time * 0.3 + p.phase) * 0.25), p.lady ? Math.sin(p.phase) * 0.02 : 0));
            return m.compose(pos, q, sc);
        };
        this.L.list.forEach((p, i) => { const M = place(p); for (const k of ['skirt', 'top', 'head', 'bonnet']) this.L[k].setMatrixAt(i, M); });
        this.M.list.forEach((p, i) => {
            const M = place(p);
            for (const k of ['coat', 'head', 'hat']) this.M[k].setMatrixAt(i, M);
            const sw = p.v > 0 ? Math.sin(p.phase) * 0.38 : 0;
            for (const [k, s] of [['legL', 1], ['legR', -1]]) {
                leg.makeRotationX(sw * s).setPosition(s * 0.08, 0.88, 0);
                this.M[k].setMatrixAt(i, leg.premultiply(M));
            }
        });
        for (const g of [this.L, this.M]) for (const k in g) if (g[k].isInstancedMesh) g[k].instanceMatrix.needsUpdate = true;
    }
}
