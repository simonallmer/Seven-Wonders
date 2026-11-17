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

    for (const s of [-1, 1]) for (let i = 0; i < nBays; i++) {
        const x = bayX(i) + bay / 2;
        for (const [y, z, n] of [[G1 + 0.2, half - 0.45, 2], [G2 + 0.18, half - 0.4, 1]]) for (let j = 0; j < n; j++) {
            const t = galleryTable(m, i * 5 + j * 3 + (s > 0 ? 2 : 0) + (y > 7 ? 1 : 0), i + j);
            t.position.set(x + (n === 2 ? (j ? 1.1 : -1.1) : 0), y, s * z); t.rotation.y = s > 0 ? Math.PI : 0; st.add(t);
        }
    }

    // court signs on the gallery fascia, and carpets hung over the balustrade in the other bays
    const COURTS = ['EGYPT', 'GREECE', 'BABYLON', 'RHODES', 'ALEXANDRIA', 'PERSIA', 'INDIA', 'CHINA', 'SILKS', 'FINE ARTS', 'MACHINERY', 'ROME', 'THE AMERICAS', 'CHILE', 'JEWELLERY', 'GLASS'];
    const signMat = (t) => std({ roughness: 0.6, map: canvasTexture(512, 96, (x, w, h) => {
        x.fillStyle = '#a33a2c'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#e8c96a'; x.lineWidth = 5; x.strokeRect(9, 9, w - 18, h - 18);
        x.fillStyle = '#f3e3b0'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(t, w / 2, h / 2 + 3, w - 60);
    }) });
    const carpets = Array.from({ length: HANGINGS }, (_, k) => carpetMat(k));
    let court = 0;
    for (const s of [-1, 1]) for (let i = 0; i < nBays; i++) {
        const x = bayX(i) + bay / 2;
        if ((i + (s > 0 ? 2 : 0)) % 4 !== 1) {
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.43), signMat(COURTS[court++ % COURTS.length]));
            sign.position.set(x, G1 - 0.15, s * 8.33); sign.rotation.y = s > 0 ? Math.PI : 0; st.add(sign);
        } else {
            const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), carpets[(i * 3 + court) % 8]);
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
    // the bays nearest the table hold the famous exhibits, so they show behind the wonders
    const EXHIBITS = { '-1:6': () => velocipede(m), '-1:7': () => fireEngine(m), '-1:8': () => prognosticator(m), '1:6': () => telegraph(m), '1:7': () => americas(m), '1:8': () => goldLump(m, plinthRed) };
    for (const s of [-1, 1]) for (let i = 0; i < nBays; i++) {
        const x = bayX(i) + bay / 2, kind = (i * 3 + (s > 0 ? 1 : 0)) % 3;
        if ((i + (s > 0 ? 1 : 0)) % 2 === 0) {
            const k = (i * 7 + (s > 0 ? 5 : 0)) % HANGINGS, art = k >= 8;
            const tap = new THREE.Mesh(new THREE.PlaneGeometry(art ? 1.9 : 2.3, art ? 2.3 : 2.9), carpets[k]);
            tap.position.set(x, art ? 2.6 : 2.3, s * (half - 0.12)); tap.rotation.y = s > 0 ? Math.PI : 0; st.add(tap);
            for (const dx of [-1.45, 1.45]) {
                const c = new THREE.Mesh(new THREE.PlaneGeometry(0.55, G1 - 0.1), curtain);
                c.position.set(x + dx, (G1 - 0.1) / 2, s * (half - 0.3)); c.rotation.y = s > 0 ? Math.PI : 0; st.add(c);
            }
        }
        const z = s * 9.75, special = EXHIBITS[s + ':' + i];
        if (special) { const e = special(); e.position.set(x, 0, z); e.rotation.y = s > 0 ? Math.PI : 0; st.add(e); }
        else if (kind === 0) st.add(statue(m.marble, plinthRed, x, z, i));
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
    const gem = kohinoor(m, plinthRed); gem.position.x = px; st.add(gem);

    buildPark(scene);

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
        showVisitors(on) { crowd.show(on); },
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
// a draped marble figure on a moulded pedestal, varied by a seed: a modest goddess, an orator, an urn-bearer, a spear-bearer, a figure raising a wreath
const UP = new THREE.Vector3(0, 1, 0);
const stdm = (o) => new THREE.MeshStandardMaterial(o);
function bone(g, a, b, r, mat) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L), 3, 8), mat);
    c.position.copy(A).add(B).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(c); return c;
}
const ARMS = [
    [[0.2, 1.4, 0], [0.24, 1.12, 0.04], [0.24, 0.86, 0.08], [-0.2, 1.4, 0], [-0.22, 1.14, 0.1], [0.02, 1.1, 0.17]],
    [[0.2, 1.4, 0], [0.38, 1.6, 0.12], [0.5, 1.82, 0.22], [-0.2, 1.4, 0], [-0.24, 1.12, 0.02], [-0.22, 0.88, 0.1]],
    [[0.2, 1.4, 0], [0.32, 1.62, -0.02], [0.2, 1.78, -0.02], [-0.2, 1.4, 0], [-0.24, 1.12, 0.06], [-0.18, 0.9, 0.16]],
    [[0.2, 1.4, 0], [0.34, 1.52, 0.04], [0.36, 1.78, 0.06], [-0.2, 1.4, 0], [-0.32, 1.16, -0.02], [-0.16, 1.0, 0.02]],
    [[0.2, 1.4, 0], [0.3, 1.66, 0.04], [0.12, 1.9, 0.06], [-0.2, 1.4, 0], [-0.3, 1.66, 0.04], [-0.12, 1.9, 0.06]],
];
function statue(stone, base, x, z, seed) {
    const g = new THREE.Group(), v = Math.abs(Math.round(seed * 7)) % 5;
    g.add(box(0.82, 0.14, 0.82, stone), box(0.72, 0.06, 0.72, stone, 0, 0.14, 0), box(0.6, 0.72, 0.6, base, 0, 0.2, 0), box(0.7, 0.06, 0.7, stone, 0, 0.92, 0), box(0.8, 0.08, 0.8, stone, 0, 0.98, 0));
    const f = new THREE.Group(); f.position.y = 1.06; g.add(f);
    const gown = v !== 1 && v !== 3;
    if (gown) {
        f.add(lathe([[0, 0], [0.25, 0], [0.26, 0.04], [0.21, 0.3], [0.18, 0.62], [0.16, 0.9], [0.13, 1.0], [0, 1.02]], stone, 0, 0, 0));
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.3; bone(f, [Math.cos(a) * 0.235, 0.06, Math.sin(a) * 0.235], [Math.cos(a) * 0.16, 0.72, Math.sin(a) * 0.16], 0.026, stone); }
        bone(f, [0.05, 0.56, 0.11], [0.07, 0.08, 0.18], 0.06, stone); // a knee bent under the drapery
    } else {
        bone(f, [0.09, 0.92, 0], [0.1, 0.5, 0.02], 0.075, stone); bone(f, [0.1, 0.5, 0.02], [0.1, 0.08, 0], 0.058, stone);
        bone(f, [-0.09, 0.92, 0], [-0.13, 0.5, 0.08], 0.075, stone); bone(f, [-0.13, 0.5, 0.08], [-0.17, 0.08, 0.04], 0.058, stone);
        f.add(box(0.1, 0.06, 0.22, stone, 0.1, 0, 0.04), box(0.1, 0.06, 0.22, stone, -0.17, 0, 0.08));
        f.add(lathe([[0, 0.66], [0.21, 0.66], [0.2, 0.8], [0.17, 1.0], [0, 1.02]], stone, 0, 0, 0));
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.26, 3, 10), stone); torso.position.y = 1.2; torso.scale.set(1.25, 1, 0.78); torso.rotation.z = 0.06; f.add(torso);
    bone(f, [-0.17, 1.4, 0], [0.17, 1.42, 0], 0.06, stone);
    bone(f, [0.18, 1.42, 0.06], [-0.14, 0.98, 0.09], 0.05, stone); // the cloak slung across the chest
    bone(f, [0, 1.44, 0], [0.01, 1.53, 0.01], 0.045, stone);
    const head = sphere(0.095, stone, 0.01, 1.63, 0.02); head.scale.set(0.9, 1.12, 1); f.add(head);
    f.add(sphere(0.1, stone, 0.01, 1.665, -0.015));
    if (gown) f.add(sphere(0.05, stone, 0.01, 1.69, -0.1));
    const A = ARMS[v];
    for (const o of [0, 3]) { bone(f, A[o], A[o + 1], 0.045, stone); bone(f, A[o + 1], A[o + 2], 0.038, stone); f.add(sphere(0.042, stone, ...A[o + 2])); }
    if (v === 2) f.add(lathe([[0, 0], [0.06, 0], [0.1, 0.1], [0.07, 0.2], [0.05, 0.22], [0.08, 0.26], [0, 0.26]], stone, 0.22, 1.64, -0.03));
    if (v === 3) bone(f, [0.36, 0.0, 0.06], [0.36, 2.3, 0.06], 0.016, stone);
    if (v === 4) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 16), stone); w.position.set(0, 1.95, 0.06); f.add(w); }
    g.position.set(x, 0, z); g.rotation.y = z > 0 ? Math.PI : 0;
    return g;
}

// ---------------------------------------------------------------- the inventions and treasures of 1851
const cylX = (r, l, mat, x, y, z, seg = 16) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), mat); c.rotation.z = Math.PI / 2; c.position.set(x, y, z); return c; };
const cylZ = (r, l, mat, x, y, z, seg = 8) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), mat); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); return c; };
function wheel(r, rim, spokes, n = 12) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 6, 28), rim));
    g.add(cylZ(0.05, 0.1, spokes, 0, 0, 0, 10));
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, r, 5), spokes); s.geometry.translate(0, r / 2, 0); s.rotation.z = k / n * Math.PI * 2; g.add(s); }
    return g;
}
const MAHOGANY = stdm({ color: 0x4a2414, roughness: 0.4 }), IRON = stdm({ color: 0x1a1614, roughness: 0.55, metalness: 0.4 });
const ENGINE_RED = stdm({ color: 0x9a1f18, roughness: 0.4, metalness: 0.1 }), VELVET = stdm({ color: 0x6a1420, roughness: 1 });

// a manual fire engine: the crew pumped the long brakes on either side
function fireEngine(m, s) {
    const g = new THREE.Group();
    g.add(box(1.9, 0.62, 0.78, ENGINE_RED, 0, 0.5, 0), box(1.96, 0.05, 0.84, m.gold, 0, 1.12, 0), box(1.96, 0.05, 0.84, m.gold, 0, 0.47, 0));
    g.add(cyl(0.13, 0.14, 0.55, m.brass, 0, 1.15, 0, 14), sphere(0.13, m.brass, 0, 1.7, 0), cyl(0.02, 0.03, 0.2, m.brass, 0, 1.8, 0, 6));
    for (const [wx, r] of [[-0.66, 0.46], [0.68, 0.38]]) for (const wz of [-0.5, 0.5]) { const w = wheel(r, IRON, ENGINE_RED, 12); w.position.set(wx, r, wz); g.add(w); }
    for (const wz of [-0.64, 0.64]) { g.add(box(3.0, 0.06, 0.06, m.wood, 0, 1.3, wz), box(0.05, 0.22, 0.05, IRON, 0, 1.1, wz)); }
    for (const wx of [-1.5, 1.5]) g.add(box(0.06, 0.06, 1.34, m.wood, wx, 1.3, 0));
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 18), IRON); hose.rotation.x = Math.PI / 2; hose.position.set(-0.62, 1.2, 0); g.add(hose);
    g.add(box(0.36, 0.22, 0.62, ENGINE_RED, 0.72, 1.17, 0), box(1.3, 0.05, 0.05, m.wood, 1.55, 0.5, 0));
    g.add(cylX(0.025, 0.5, m.brass, -1.15, 0.9, 0.3, 8));
    return g;
}
// a treadle carriage on four spoked wheels, after the velocipedes of the 1850s
function velocipede(m) {
    const g = new THREE.Group(), green = stdm({ color: 0x2c4a34, roughness: 0.45 }), leather = stdm({ color: 0x3a2216, roughness: 0.7 });
    g.add(box(1.9, 0.1, 1.2, MAHOGANY, 0, 0, 0));
    const y = 0.1;
    for (const [wx, r, wz] of [[-0.45, 0.42, 0.37], [-0.45, 0.42, -0.37], [0.55, 0.28, 0.3], [0.55, 0.28, -0.3]]) { const w = wheel(r, IRON, green, 12); w.position.set(wx, y + r, wz); g.add(w); }
    g.add(cylZ(0.016, 0.76, IRON, -0.45, y + 0.42, 0), cylZ(0.016, 0.62, IRON, 0.55, y + 0.28, 0));
    g.add(box(1.05, 0.05, 0.08, green, 0.05, y + 0.4, 0), box(0.05, 0.28, 0.05, green, -0.28, y + 0.45, 0));
    g.add(box(0.34, 0.06, 0.3, leather, -0.28, y + 0.72, 0), box(0.05, 0.26, 0.3, leather, -0.46, y + 0.76, 0));
    g.add(box(0.04, 0.5, 0.04, green, 0.5, y + 0.32, 0), box(0.04, 0.04, 0.36, IRON, 0.5, y + 0.82, 0));
    for (const wz of [-0.13, 0.13]) g.add(box(0.5, 0.03, 0.07, m.wood, 0.12, y + 0.24, wz));
    return g;
}
// Merryweather's Tempest Prognosticator: twelve leeches in twelve bottles, each able to ring the bell when a storm draws near
function prognosticator(m) {
    const g = new THREE.Group(), water = stdm({ color: 0x8aa6a0, roughness: 0.2, transparent: true, opacity: 0.7 });
    g.add(box(0.7, 0.7, 0.7, MAHOGANY), cyl(0.44, 0.46, 0.08, MAHOGANY, 0, 0.7, 0, 24));
    for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        g.add(cyl(0.045, 0.05, 0.24, m.glass, c * 0.32, 0.78, s * 0.32, 10), cyl(0.02, 0.03, 0.06, m.glass, c * 0.32, 1.02, s * 0.32, 8), cyl(0.04, 0.04, 0.12, water, c * 0.32, 0.79, s * 0.32, 8));
        bone(g, [c * 0.32, 1.08, s * 0.32], [c * 0.07, 1.44, s * 0.07], 0.006, m.brass);
        const p = (k % 2) ? 0.41 : 0.43;
        if (k % 2 === 0) g.add(cyl(0.012, 0.012, 0.74, m.gold, Math.cos(a + 0.26) * p, 0.78, Math.sin(a + 0.26) * p, 5));
    }
    g.add(lathe([[0, 0], [0.07, 0], [0.05, 0.08], [0.04, 0.3], [0.06, 0.34], [0.03, 0.4], [0.03, 0.62], [0, 0.62]], MAHOGANY, 0, 0.78, 0));
    g.add(lathe([[0, 0], [0.09, 0], [0.085, 0.02], [0.065, 0.09], [0.045, 0.15], [0, 0.16]], m.gold, 0, 1.4, 0));
    g.add(lathe([[0, 0], [0.46, 0], [0.4, 0.1], [0.26, 0.24], [0.1, 0.32], [0.03, 0.44], [0, 0.46]], m.gold, 0, 1.52, 0));
    return g;
}
// Bakewell's copying telegraph: a stylus traces a drawing on one turning drum while a twin drum far away writes it again
function telegraph(m) {
    const g = new THREE.Group(), paper = stdm({ color: 0xeee4c8, roughness: 0.9 }), copper = stdm({ color: 0xb06a3a, roughness: 0.4, metalness: 0.7 });
    g.add(box(1.5, 0.05, 0.7, MAHOGANY, 0, 0.78, 0));
    for (const [lx, lz] of [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]]) g.add(cyl(0.03, 0.025, 0.78, MAHOGANY, lx, 0, lz, 8));
    for (const sx of [-0.4, 0.4]) {
        g.add(box(0.04, 0.26, 0.04, m.brass, sx - 0.2, 0.83, 0.05), box(0.04, 0.26, 0.04, m.brass, sx + 0.2, 0.83, 0.05));
        g.add(cylX(0.075, 0.42, m.brass, sx, 1.06, 0.05), cylX(0.078, 0.28, paper, sx, 1.06, 0.05));
        g.add(box(0.2, 0.2, 0.18, MAHOGANY, sx, 0.83, -0.22));
        bone(g, [sx, 1.0, -0.33], [sx + 0.03, 0.66, -0.33], 0.006, m.brass); g.add(sphere(0.03, m.brass, sx + 0.03, 0.66, -0.33));
        bone(g, [sx - 0.2, 1.24, 0.16], [sx + 0.12, 1.15, 0.1], 0.008, m.brass);
    }
    bone(g, [-0.4, 0.86, -0.32], [0.4, 0.86, -0.32], 0.006, copper);
    return g;
}
// the great lump of Chilean gold, on velvet under a glass bell
function goldLump(m, base) {
    const g = new THREE.Group(), geo = new THREE.IcosahedronGeometry(0.085, 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.3 * Math.sin(x * 61 + 1) * Math.sin(y * 53 + 2) * Math.cos(z * 47); p.setXYZ(i, x * k * 1.4, y * k * 0.8, z * k * 1.1); }
    geo.computeVertexNormals();
    const nugget = new THREE.Mesh(geo, m.gold); nugget.position.y = 1.07; nugget.rotation.y = 0.6;
    g.add(box(0.6, 0.92, 0.6, base), box(0.68, 0.04, 0.68, m.gold, 0, 0.92, 0), box(0.34, 0.06, 0.34, VELVET, 0, 0.96, 0), nugget);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.glass); bell.position.y = 0.96; bell.scale.y = 1.2; g.add(bell);
    return g;
}
// featherwork and jewellery from the Americas, in a tall case
function americas(m) {
    const g = new THREE.Group(), cloth = stdm({ color: 0x2a2420, roughness: 1 });
    g.add(box(1.7, 0.8, 0.55, MAHOGANY), box(1.6, 1.3, 0.5, m.glass, 0, 0.8, 0), box(1.72, 0.1, 0.57, MAHOGANY, 0, 2.1, 0), box(1.6, 1.3, 0.02, cloth, 0, 0.8, -0.24));
    const plumes = [0xc8282a, 0xe8b830, 0x2a5ab0, 0x3a9a4a].map((c) => stdm({ color: c, roughness: 0.8 }));
    for (const [fx, n, len] of [[-0.5, 9, 0.32], [0, 15, 0.46], [0.5, 9, 0.32]]) for (let k = 0; k < n; k++) {
        const a = -1.2 + k / (n - 1) * 2.4, f = sphere(0.035, plumes[k % 4], 0, 0, 0);
        f.scale.set(1, len / 0.07, 0.25); f.position.set(fx + Math.sin(a) * len * 0.55, 1.42 + Math.cos(a) * len * 0.55, -0.2); f.rotation.z = -a; g.add(f);
    }
    const beads = [stdm({ color: 0x2fa3a0, roughness: 0.3 }), stdm({ color: 0xc8463a, roughness: 0.3 }), m.steel];
    for (const [bx, k] of [[-0.5, 0], [0, 1], [0.48, 2]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 5, 18), beads[k]); t.rotation.x = Math.PI / 2; t.position.set(bx, 0.83, 0.08); g.add(t); }
    g.add(cyl(0.1, 0.07, 0.13, stdm({ color: 0xb8904a, roughness: 0.9 }), 0.25, 0.8, -0.05, 12));
    return g;
}
// the Koh-i-Noor, in the gilded cage it was shown in
function kohinoor(m, base) {
    const g = new THREE.Group(), stone = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, clearcoat: 1, emissive: 0x9fb4d0, emissiveIntensity: 0.7 });
    g.add(box(0.8, 1.0, 0.8, base, 0, 0.25, 0), box(0.9, 0.06, 0.9, m.gold, 0, 1.25, 0));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.add(cyl(0.008, 0.008, 0.6, m.gold, Math.cos(a) * 0.3, 1.31, Math.sin(a) * 0.3, 4)); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 28), m.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 1.91; g.add(ring);
    g.add(lathe([[0, 0], [0.3, 0], [0.22, 0.12], [0.06, 0.2], [0.02, 0.32], [0, 0.32]], m.gold, 0, 1.91, 0));
    g.add(cyl(0.03, 0.06, 0.22, m.gold, 0, 1.31, 0, 10));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), stone); gem.position.y = 1.6; gem.scale.y = 0.75; g.add(gem);
    return g;
}

// ---------------------------------------------------------------- Hyde Park, 1851, seen through the glass
// The building stood on the south side of the park between Rotten Row and South Carriage Drive, near the Serpentine,
// with Knightsbridge beyond the drive. The hall runs east–west along x; north is -z.
function buildPark(scene) {
    const g = new THREE.Group();
    const sand = stdm({ color: 0xbfa77c, roughness: 1 }), gravel = stdm({ color: 0xa89c86, roughness: 1 });
    const flat = (w, d, mat, x, y, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); g.add(p); };
    flat(96, 36, gravel, 0, -0.04, 0);       // the gravel apron round the building
    flat(560, 7, sand, 0, -0.035, -24);      // Rotten Row, the riding track
    flat(560, 9, gravel, 0, -0.035, 19);     // South Carriage Drive
    const lake = new THREE.Shape(), cx = 60, cz = -92, ang = -0.28;
    for (let i = 0; i <= 48; i++) {
        const t = i / 48 * Math.PI * 2, lx = Math.cos(t) * 120, lz = Math.sin(t) * (20 + 6 * Math.sin(t * 3));
        const X = cx + lx * Math.cos(ang) - lz * Math.sin(ang), Z = cz + lx * Math.sin(ang) + lz * Math.cos(ang);
        i ? lake.lineTo(X, -Z) : lake.moveTo(X, -Z);
    }
    const water = new THREE.Mesh(new THREE.ShapeGeometry(lake, 1), new THREE.MeshPhysicalMaterial({ color: 0x5a7a90, roughness: 0.08, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.02; g.add(water);
    const inLake = (x, z) => { const dx = x - cx, dz = z - cz, u = dx * Math.cos(ang) + dz * Math.sin(ang), w = -dx * Math.sin(ang) + dz * Math.cos(ang); return (u / 128) ** 2 + (w / 32) ** 2 < 1; };
    const bark = stdm({ color: 0x4e3e30, roughness: 1 }), leaves = [0x5a7c44, 0x4a6e3a, 0x3e6034, 0x627f4a].map((c) => stdm({ color: c, roughness: 1 }));
    let placed = 0;
    while (placed < 150) {
        const x = (rand() - 0.5) * 420, z = -130 + rand() * 172;
        if ((Math.abs(x) < 46 && Math.abs(z) < 16) || Math.abs(z + 24) < 6 || Math.abs(z - 19) < 7 || inLake(x, z)) continue;
        const h = 9 + rand() * 8;
        g.add(cyl(0.3, 0.5, h * 0.55, bark, x, 0, z, 6));
        for (let k = 0; k < 5; k++) {
            const b = new THREE.Mesh(new THREE.IcosahedronGeometry(h * (0.2 + rand() * 0.1), 1), leaves[(placed + k) % 4]);
            b.position.set(x + (rand() - 0.5) * h * 0.4, h * (0.62 + rand() * 0.2), z + (rand() - 0.5) * h * 0.4); g.add(b);
        }
        placed++;
    }
    // Knightsbridge: stuccoed terraces with slate roofs beyond the drive
    const fronts = canvasTexture(128, 160, (x, w, h) => {
        x.clearRect(0, 0, w, h);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = 'rgba(40,44,52,0.85)'; x.fillRect(12 + c * 29, 16 + r * 36, 16, r === 0 ? 20 : 26); }
        x.fillStyle = 'rgba(60,50,40,0.7)'; x.fillRect(0, h - 10, w, 10);
    });
    const glazing = stdm({ map: fronts, transparent: true, alphaTest: 0.3, roughness: 0.6 });
    const stucco = [0xe6dcc6, 0xd8ccb2, 0xb88c6a].map((c) => stdm({ color: c, roughness: 0.9 })), slate = stdm({ color: 0x4a4e56, roughness: 0.8 });
    for (let x = -230, k = 0; x < 230; x += 12, k++) {
        const h = 13 + (k * 7 % 5);
        g.add(box(11.6, h, 12, stucco[k % 3], x, 0, 66), box(11.6, 1.8, 11, slate, x, h, 66));
        g.add(box(0.9, 1.8, 0.9, stucco[2], x - 3.5, h + 1.8, 66), box(0.9, 1.8, 0.9, stucco[2], x + 3.5, h + 1.8, 66));
        const f = new THREE.Mesh(new THREE.PlaneGeometry(11.2, h - 1), glazing); f.position.set(x, (h - 1) / 2 + 0.5, 59.95); f.rotation.y = Math.PI; g.add(f);
    }
    shadowed(g, true, false); mergeByMaterial(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    scene.add(g);
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
// Ten hangings, so no two neighbours repeat: carpets from Persia, Turkey and India, a kilim, a tree of life,
// a trellis, Chinese silk, a Gobelin landscape, and two oil paintings in gilt frames.
const HANGINGS = 10;
function carpetMat(k) {
    const P = [
        ['#5c1c1e', '#1c2440', '#a88a4c', '#cbbd9c'], ['#1e3048', '#5e2420', '#a8904e', '#cfc2a2'], ['#7a3a1e', '#2a2a3a', '#c8a050', '#e0d2b0'],
        ['#2a3e2a', '#5c1c1e', '#a88a4c', '#c4b494'], ['#48263c', '#1c2440', '#a8844a', '#cdbc9e'], ['#c8b88a', '#7a2a24', '#2a4a6a', '#3a5a3a'],
    ];
    const pal = P[k % P.length];
    const frameBorder = (x, w, h) => {
        x.fillStyle = pal[1]; x.fillRect(0, 0, w, h);
        x.strokeStyle = pal[2]; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20); x.strokeRect(22, 22, w - 44, h - 44);
        x.fillStyle = pal[0]; x.fillRect(26, 26, w - 52, h - 52);
    };
    const dot = (x, cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
    const draw = [
        (x, w, h) => { // the diamond medallion
            frameBorder(x, w, h);
            x.save(); x.translate(w / 2, h / 2);
            for (const [s, c] of [[80, pal[2]], [60, pal[1]], [40, pal[3]], [20, pal[0]]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, -s * 1.3); x.lineTo(s, 0); x.lineTo(0, s * 1.3); x.lineTo(-s, 0); x.closePath(); x.fill(); }
            x.restore();
            for (const [cx, cy] of [[50, 54], [w - 50, 54], [50, h - 54], [w - 50, h - 54]]) dot(x, cx, cy, 12, pal[2]);
        },
        (x, w, h) => { // a round Persian medallion with petals and quarter corners
            frameBorder(x, w, h);
            const cx = w / 2, cy = h / 2;
            for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; dot(x, cx + Math.cos(a) * 62, cy + Math.sin(a) * 62, 14, i % 2 ? pal[2] : pal[3]); }
            dot(x, cx, cy, 58, pal[1]); dot(x, cx, cy, 40, pal[2]); dot(x, cx, cy, 18, pal[0]);
            for (const [qx, qy] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) { x.save(); x.beginPath(); x.rect(26, 26, w - 52, h - 52); x.clip(); dot(x, qx, qy, 46, pal[1]); dot(x, qx, qy, 30, pal[2]); x.restore(); }
            for (let i = 0; i < 40; i++) dot(x, 40 + (i * 53) % (w - 80), 40 + (i * 97) % (h - 80), 3, pal[3]);
        },
        (x, w, h) => { // a kilim: bands of stepped triangles
            const bands = [pal[0], pal[3], pal[1], pal[2], pal[0], pal[1], pal[3], pal[2]];
            const bh = h / bands.length;
            bands.forEach((c, i) => {
                x.fillStyle = c; x.fillRect(0, i * bh, w, bh);
                x.fillStyle = bands[(i + 3) % bands.length];
                for (let t = 0; t < w; t += 32) { x.beginPath(); x.moveTo(t, (i + 1) * bh - 4); x.lineTo(t + 16, i * bh + 8); x.lineTo(t + 32, (i + 1) * bh - 4); x.closePath(); x.fill(); }
            });
            for (let i = 0; i < 12; i++) { x.fillStyle = pal[3]; x.fillRect(i * 22 + 4, h - 6, 4, 6); x.fillRect(i * 22 + 4, 0, 4, 6); }
        },
        (x, w, h) => { // a tree of life with birds
            frameBorder(x, w, h);
            x.strokeStyle = pal[2]; x.lineWidth = 9; x.beginPath(); x.moveTo(w / 2, h - 40); x.lineTo(w / 2, 70); x.stroke();
            x.lineWidth = 5;
            for (let i = 0; i < 6; i++) { const y = h - 80 - i * 34, s = i % 2 ? 1 : -1; x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w / 2 + s * 50, y - 10, w / 2 + s * 80, y - 34); x.stroke(); dot(x, w / 2 + s * 80, y - 34, 10, pal[3]); dot(x, w / 2 - s * 40, y - 18, 7, pal[3]); }
            for (const [bx, by] of [[70, 110], [w - 70, 150], [80, 220]]) { dot(x, bx, by, 9, pal[3]); x.fillStyle = pal[3]; x.beginPath(); x.moveTo(bx + 8, by); x.lineTo(bx + 20, by - 6); x.lineTo(bx + 8, by + 4); x.fill(); }
            x.fillStyle = pal[1]; x.fillRect(w / 2 - 40, h - 46, 80, 14);
        },
        (x, w, h) => { // a trellis with a flower in every lozenge
            frameBorder(x, w, h);
            x.save(); x.beginPath(); x.rect(26, 26, w - 52, h - 52); x.clip();
            x.strokeStyle = pal[2]; x.lineWidth = 3;
            for (let t = -h; t < w + h; t += 36) { x.beginPath(); x.moveTo(t, 0); x.lineTo(t + h, h); x.stroke(); x.beginPath(); x.moveTo(t, h); x.lineTo(t + h, 0); x.stroke(); }
            for (let gy = 26; gy < h; gy += 36) for (let gx = 26 + ((gy / 36) % 2) * 18; gx < w; gx += 36) { dot(x, gx, gy + 18, 6, pal[3]); dot(x, gx, gy + 18, 2.5, pal[1]); }
            x.restore();
        },
        (x, w, h) => { // Chinese silk: roundels and drifting clouds on a plain field
            x.fillStyle = pal[3]; x.fillRect(0, 0, w, h);
            x.strokeStyle = pal[1]; x.lineWidth = 5; x.strokeRect(8, 8, w - 16, h - 16);
            for (const [cx, cy] of [[72, 80], [184, 140], [80, 220], [176, 280]]) { dot(x, cx, cy, 30, pal[1]); x.strokeStyle = pal[2]; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 22, 0, Math.PI * 2); x.stroke(); dot(x, cx, cy, 8, pal[2]); }
            x.strokeStyle = pal[0]; x.lineWidth = 3;
            for (const [cx, cy] of [[180, 60], [60, 150], [190, 220], [70, 296]]) for (let r = 0; r < 3; r++) { x.beginPath(); x.arc(cx + r * 12, cy, 7, Math.PI, 0); x.stroke(); }
        },
        (x, w, h) => { // a Gobelin tapestry: a classical landscape inside a border of flowers
            x.fillStyle = '#5a4630'; x.fillRect(0, 0, w, h);
            const sky = x.createLinearGradient(0, 24, 0, h * 0.6); sky.addColorStop(0, '#8aa0a8'); sky.addColorStop(1, '#d8c8a0'); x.fillStyle = sky; x.fillRect(22, 22, w - 44, h - 44);
            x.fillStyle = '#6a7a50'; x.beginPath(); x.moveTo(22, h * 0.62); x.quadraticCurveTo(w * 0.4, h * 0.48, w - 22, h * 0.6); x.lineTo(w - 22, h - 22); x.lineTo(22, h - 22); x.fill();
            x.fillStyle = '#4a5a3a'; x.beginPath(); x.moveTo(22, h * 0.75); x.quadraticCurveTo(w * 0.6, h * 0.66, w - 22, h * 0.78); x.lineTo(w - 22, h - 22); x.lineTo(22, h - 22); x.fill();
            x.fillStyle = '#d8ccb0'; x.fillRect(w * 0.56, h * 0.42, 60, 34); x.beginPath(); x.moveTo(w * 0.56 - 4, h * 0.42); x.lineTo(w * 0.56 + 30, h * 0.36); x.lineTo(w * 0.56 + 64, h * 0.42); x.fill();
            x.fillStyle = '#a89c80'; for (let c = 0; c < 5; c++) x.fillRect(w * 0.56 + 4 + c * 12, h * 0.43, 4, 30);
            for (const [tx, ty, r] of [[60, h * 0.5, 30], [90, h * 0.58, 22], [w - 50, h * 0.56, 26]]) { x.fillStyle = '#3a4a2a'; x.fillRect(tx - 3, ty, 6, 50); dot(x, tx, ty, r, '#3e5230'); }
            for (let i = 0; i < 44; i++) { const t = i / 44, side = i % 4; const px = side < 2 ? t * w * 4 % w : (side === 2 ? 11 : w - 11), py = side < 2 ? (side ? h - 11 : 11) : t * h * 4 % h; dot(x, px, py, 5, ['#b84a3a', '#d8b860', '#e8d8c0'][i % 3]); }
        },
        (x, w, h) => { // an Indian hanging: a row of pointed arches, each with a flowering vase
            frameBorder(x, w, h);
            for (let a = 0; a < 3; a++) {
                const ax = 44 + a * 64, top = 70, bot = h - 46;
                x.fillStyle = pal[1]; x.beginPath(); x.moveTo(ax, bot); x.lineTo(ax, top + 40); x.quadraticCurveTo(ax, top, ax + 24, top - 16); x.quadraticCurveTo(ax + 48, top, ax + 48, top + 40); x.lineTo(ax + 48, bot); x.fill();
                x.fillStyle = pal[2]; x.beginPath(); x.ellipse(ax + 24, bot - 34, 12, 18, 0, 0, Math.PI * 2); x.fill();
                for (let f = 0; f < 5; f++) dot(x, ax + 24 + Math.cos(f * 1.25 - 2.8) * 18, bot - 70 + Math.sin(f * 1.25 - 2.8) * 18, 6, pal[3]);
            }
        },
        (x, w, h) => { // an oil painting: a ship at sea, in a gilt frame
            x.fillStyle = '#b08a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a5a20'; x.fillRect(14, 14, w - 28, h - 28);
            const sky = x.createLinearGradient(0, 22, 0, h * 0.6); sky.addColorStop(0, '#6a7a8a'); sky.addColorStop(1, '#e8c890'); x.fillStyle = sky; x.fillRect(22, 22, w - 44, h - 44);
            x.fillStyle = '#3a4a5a'; x.fillRect(22, h * 0.62, w - 44, h * 0.38 - 22);
            x.fillStyle = '#2a2018'; x.beginPath(); x.moveTo(80, h * 0.62); x.lineTo(180, h * 0.62); x.lineTo(166, h * 0.67); x.lineTo(92, h * 0.67); x.fill();
            x.fillRect(128, h * 0.3, 3, h * 0.32); x.fillStyle = '#e8e0cc'; x.beginPath(); x.moveTo(132, h * 0.32); x.lineTo(170, h * 0.56); x.lineTo(132, h * 0.56); x.fill(); x.beginPath(); x.moveTo(126, h * 0.36); x.lineTo(96, h * 0.56); x.lineTo(126, h * 0.56); x.fill();
            x.strokeStyle = '#d8c070'; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, h - 12);
        },
        (x, w, h) => { // an oil portrait in a gilt frame
            x.fillStyle = '#b08a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a5a20'; x.fillRect(14, 14, w - 28, h - 28);
            const bg = x.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.4, 160); bg.addColorStop(0, '#5a4a38'); bg.addColorStop(1, '#1e1810'); x.fillStyle = bg; x.fillRect(22, 22, w - 44, h - 44);
            x.fillStyle = '#1a1a22'; x.beginPath(); x.moveTo(60, h - 22); x.quadraticCurveTo(w / 2, h * 0.5, w - 60, h - 22); x.fill();
            x.fillStyle = '#e8e0d0'; x.beginPath(); x.moveTo(w / 2 - 14, h * 0.6); x.lineTo(w / 2, h * 0.72); x.lineTo(w / 2 + 14, h * 0.6); x.fill();
            x.fillStyle = '#d8b090'; x.beginPath(); x.ellipse(w / 2, h * 0.42, 34, 44, 0, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#3a2a1a'; x.beginPath(); x.ellipse(w / 2, h * 0.34, 38, 24, 0, Math.PI, 0); x.fill();
            x.strokeStyle = '#d8c070'; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, h - 12);
        },
    ][k % HANGINGS];
    const t = canvasTexture(256, 320, (x, w, h) => {
        draw(x, w, h);
        for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.03 + (i % 5) * 0.01})`; x.fillRect((i * 73) % w, (i * 151) % h, 3, 3); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: k >= 8 ? 0.5 : 0.95, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- the galleries' own displays
// Small tables against the back of each gallery, leaving the front free for visitors at the rail.
function galleryTable(m, kind, seed) {
    const g = new THREE.Group(), cloth = [VELVET, stdm({ color: 0x1e2c48, roughness: 1 }), stdm({ color: 0x2a3a26, roughness: 1 })][seed % 3];
    g.add(box(1.1, 0.04, 0.5, MAHOGANY, 0, 0.74, 0), box(1.14, 0.02, 0.54, cloth, 0, 0.78, 0));
    for (const [lx, lz] of [[-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2]]) g.add(cyl(0.025, 0.018, 0.74, MAHOGANY, lx, 0, lz, 6));
    const y = 0.8;
    const items = [
        () => { g.add(cyl(0.05, 0.08, 0.06, m.gold, -0.3, y, 0, 10), lathe([[0, 0], [0.07, 0], [0.11, 0.1], [0.08, 0.2], [0.05, 0.24], [0.08, 0.28], [0, 0.28]], m.marble, 0.25, y, 0)); const globe = sphere(0.11, stdm({ color: 0x6a8aa8, roughness: 0.5 }), -0.3, y + 0.17, 0); g.add(globe); },
        () => { g.add(box(0.14, 0.06, 0.12, m.marble, 0, y, 0), box(0.12, 0.18, 0.1, m.marble, 0, y + 0.06, 0)); g.add(sphere(0.07, m.marble, 0, y + 0.31, 0)); g.add(box(0.22, 0.24, 0.1, MAHOGANY, -0.35, y, 0), cyl(0.06, 0.06, 0.02, m.gold, -0.35, y + 0.14, 0.05, 14)); },
        () => { for (const dx of [-0.32, 0, 0.32]) g.add(lathe([[0, 0], [0.05, 0], [0.04, 0.04], [0.08, 0.12], [0.06, 0.2], [0.035, 0.24], [0.05, 0.26], [0, 0.26]], [stdm({ color: 0x24448e, roughness: 0.25 }), m.gold, stdm({ color: 0xe8e2d4, roughness: 0.25 })][(seed + Math.round(dx * 10)) % 3 < 0 ? 0 : (seed + Math.round(dx * 10) + 3) % 3], dx, y, 0)); },
        () => { g.add(box(0.7, 0.03, 0.12, MAHOGANY, 0, y, 0)); g.add(box(0.4, 0.08, 0.08, MAHOGANY, 0, y + 0.03, 0)); g.add(cyl(0.006, 0.006, 0.5, m.wood, -0.05, y + 0.11, 0, 4), cyl(0.006, 0.006, 0.36, m.wood, 0.12, y + 0.11, 0, 4)); g.add(box(0.2, 0.18, 0.005, stdm({ color: 0xece4cc, roughness: 1 }), -0.05, y + 0.25, 0.01)); },
        () => { g.add(box(0.8, 0.26, 0.36, m.glass, 0, y, 0), box(0.82, 0.02, 0.38, m.brass, 0, y + 0.26, 0)); for (let i = 0; i < 5; i++) g.add(sphere(0.025, [m.gold, m.steel, stdm({ color: 0xc8463a, roughness: 0.3 })][i % 3], -0.28 + i * 0.14, y + 0.04, 0)); },
        () => { g.add(cyl(0.06, 0.09, 0.04, m.brass, 0, y, 0, 10), cyl(0.012, 0.012, 0.36, m.brass, 0, y + 0.04, 0, 6)); for (const a of [0, 2.1, 4.2]) g.add(cyl(0.012, 0.016, 0.1, stdm({ color: 0xf2ead8, roughness: 0.6 }), Math.cos(a) * 0.12, y + 0.4, Math.sin(a) * 0.12, 6)); g.add(box(0.3, 0.2, 0.24, MAHOGANY, 0.34, y, 0), box(0.04, 0.12, 0.2, m.gold, 0.34, y + 0.2, 0)); },
    ];
    items[kind % items.length]();
    return g;
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
    show(on) { for (const g of [this.L, this.M]) for (const k in g) if (g[k].isInstancedMesh) g[k].visible = on; }
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
