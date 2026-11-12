// The Crystal Palace, 1851 — the menu. A long table under the glass vault carries all fourteen wonders.
import * as THREE from 'three';
import { Particles, box, cyl, shadowed } from './fx.js';
import { woodMaps, floorMaps, clothMaps, glazingTexture, canvasTexture, papyrusBase } from './textures.js';
import { materials, MINIATURES, buildSphinx, buildObelisk, buildPalm } from './models.js';
import { buildBoard } from './pyramid/scene.js';
import { buildBoard as buildGardens, GROUND as GARDENS_GROUND } from './gardens/scene.js';
import { buildBoard as buildTemple, GROUND as TEMPLE_GROUND } from './temple/scene.js';
import { buildBoard as buildStatue, GROUND as STATUE_GROUND } from './statue/scene.js';
import { buildBoard as buildMausoleum, GROUND as MAUSOLEUM_GROUND } from './mausoleum/scene.js';
import { buildBoard as buildColossus, GROUND as COLOSSUS_GROUND } from './colossus/scene.js';
import { buildBoard as buildPharos, GROUND as PHAROS_GROUND } from './pharos/scene.js';
import { buildBoard as buildGreatWall, GROUND as GREATWALL_GROUND } from './greatwall/scene.js';
import { buildBoard as buildSkyscraper, GROUND as SKYSCRAPER_GROUND } from './skyscraper/scene.js';
import { makeSkyDome } from './daylight.js';
import { WONDERS } from './wonders.js';

const HALL = { len: 76, half: 11, wall: 10, bay: 4.75 };
const TABLE = { y: 1.0, straight: 6, r: 2.35 };
const ROW = 1.15;        // distance of the wonders from the table's centre line
const ARC = 5;           // path length given to each end of the table
const LOOP = 24 + 2 * ARC;

// A point on the stadium-shaped loop around the table, at distance r from its centre line.
export function loopPoint(s, r, out = new THREE.Vector3()) {
    s = ((s % LOOP) + LOOP) % LOOP;
    if (s < 12) return out.set(-6 + s, 0, r);
    if (s < 12 + ARC) { const a = (s - 12) / ARC * Math.PI; return out.set(6 + r * Math.sin(a), 0, r * Math.cos(a)); }
    if (s < 24 + ARC) return out.set(6 - (s - 12 - ARC), 0, -r);
    const a = (s - 24 - ARC) / ARC * Math.PI; return out.set(-6 - r * Math.sin(a), 0, -r * Math.cos(a));
}
export const wonderS = (i) => (i < 7 ? i * 2 : 12 + ARC + (i - 7) * 2);
export { LOOP };

function stadium(straight, r) {
    const s = new THREE.Shape();
    s.moveTo(-straight, -r); s.lineTo(straight, -r);
    s.absarc(straight, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-straight, r);
    s.absarc(-straight, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return s;
}
function slab(shape, h, mat, y) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 28 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.y = y;
    return m;
}

export class PalaceWorld {
    constructor() {
        const scene = this.scene = new THREE.Scene();
        this.time = 0;
        this.pickables = [];
        this.sky = makeSkyDome(); scene.add(this.sky);
        scene.fog = new THREE.FogExp2(0x9fb4c8, 0.008);

        this.key = new THREE.DirectionalLight(0xffffff, 3);
        this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
        Object.assign(this.key.shadow.camera, { near: 5, far: 130, left: -13, right: 13, top: 9, bottom: -9 });
        this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.02;
        scene.add(this.key, this.key.target);
        this.hemi = new THREE.HemisphereLight(0xdbe8ff, 0x8a6a48, 0.7); scene.add(this.hemi);
        // a museum spot that follows the wonder you are looking at
        this.spot = new THREE.SpotLight(0xffe2b0, 0, 12, 0.36, 0.7, 1.4);
        scene.add(this.spot, this.spot.target);

        this.buildHall();
        this.buildTable();
        this.buildWonders();
        this.buildMemorabilia();

        this.motes = new Particles(420, { color: 0xfff1d0, additive: true, fog: false });
        for (let i = 0; i < this.motes.n; i++) {
            this.motes.pos.set([(Math.random() - 0.5) * 26, 0.6 + Math.random() * 7, (Math.random() - 0.5) * 14], i * 3);
            this.motes.size[i] = 0.02 + Math.random() * 0.05; this.motes.alpha[i] = Math.random();
        }
        scene.add(this.motes.points);
    }

    buildHall() {
        const { len, half, wall, bay } = HALL, scene = this.scene;
        const std = (o) => new THREE.MeshStandardMaterial(o);
        // Owen Jones painted the ironwork pale blue, with yellow and red picked out
        const blue = std({ color: 0x86a6c8, roughness: 0.55, metalness: 0.3 });
        const cream = std({ color: 0xe9e2cf, roughness: 0.6, metalness: 0.2 });
        const red = std({ color: 0xa33a2c, roughness: 0.6 });
        const yellow = std({ color: 0xd9b650, roughness: 0.5, metalness: 0.3 });
        this.iron = [blue, cream, red, yellow];

        const fl = floorMaps();
        fl.map.repeat.set(len / 5, half * 2 / 5); fl.normalMap.repeat.copy(fl.map.repeat);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, half * 2), std({ map: fl.map, normalMap: fl.normalMap, roughness: 0.42, metalness: 0.05 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        const carpet = box(21, 0.02, 9, std({ color: 0x5c1a20, roughness: 0.95 })); carpet.receiveShadow = true; scene.add(carpet);
        const border = box(21.5, 0.012, 9.5, yellow); border.receiveShadow = true; scene.add(border);
        // ground outside, seen through the glass
        const park = new THREE.Mesh(new THREE.CircleGeometry(300, 24), std({ color: 0x5f7a48, roughness: 1 }));
        park.rotation.x = -Math.PI / 2; park.position.y = -0.05; scene.add(park);

        const frame = new THREE.Group(); scene.add(frame);
        const n = Math.round(len / bay);
        const ribGeo = new THREE.TorusGeometry(half, 0.11, 6, 40, Math.PI);
        const colGeo = new THREE.CylinderGeometry(0.11, 0.13, wall, 8);
        const capGeo = new THREE.BoxGeometry(0.42, 0.22, 0.42);
        for (let i = 0; i <= n; i++) {
            const x = -len / 2 + i * bay;
            const rib = new THREE.Mesh(ribGeo, i % 2 ? cream : blue);
            rib.position.set(x, wall, 0); rib.rotation.y = Math.PI / 2; frame.add(rib);
            for (const z of [-half, half]) {
                const c = new THREE.Mesh(colGeo, blue); c.position.set(x, wall / 2, z); frame.add(c);
                for (const y of [0.11, wall / 2, wall - 0.11]) { const cap = new THREE.Mesh(capGeo, y === wall / 2 ? red : yellow); cap.position.set(x, y, z); frame.add(cap); }
            }
        }
        // girders and purlins running the length of the nave
        for (const z of [-half, half]) for (const y of [wall / 2, wall]) frame.add(box(len, 0.3, 0.14, y === wall ? cream : blue, 0, y - 0.15, z));
        for (let k = 1; k < 8; k++) {
            const a = (k / 8) * Math.PI;
            frame.add(box(len, 0.09, 0.09, k === 4 ? red : cream, 0, wall + Math.sin(a) * half - 0.05, Math.cos(a) * half));
        }
        frame.traverse((o) => { if (o.isMesh) o.castShadow = true; });

        // glass: clear panes with thin bars, drawn from a texture
        const glass = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
        const vt = glazingTexture(6, 2, 0.03); vt.repeat.set(8, len / bay);
        const vault = new THREE.Mesh(new THREE.CylinderGeometry(half + 0.05, half + 0.05, len, 48, 1, true, 0, Math.PI), glass(vt));
        vault.rotation.z = Math.PI / 2; vault.position.y = wall;
        scene.add(vault);
        const wt = glazingTexture(4, 4, 0.03); wt.repeat.set(len / bay, 2);
        for (const z of [-half, half]) {
            const w = new THREE.Mesh(new THREE.PlaneGeometry(len, wall), glass(wt));
            w.position.set(0, wall / 2, z); scene.add(w);
        }
        const et = glazingTexture(4, 4, 0.03); et.repeat.set(1 / 4.4, 1 / 4.4);
        const endShape = new THREE.Shape();
        endShape.moveTo(-half, 0); endShape.lineTo(half, 0); endShape.lineTo(half, wall);
        endShape.absarc(0, wall, half, 0, Math.PI, false); endShape.lineTo(-half, 0);
        for (const x of [-len / 2, len / 2]) {
            const e = new THREE.Mesh(new THREE.ShapeGeometry(endShape, 32), glass(et));
            e.rotation.y = Math.PI / 2; e.position.x = x; scene.add(e);
        }

        // potted palms down both sides, as in the old photographs
        const m = materials();
        for (let i = 1; i < n; i += 2) for (const z of [-half + 2.2, half - 2.2]) {
            const g = new THREE.Group();
            g.add(cyl(0.5, 0.36, 0.7, m.terracotta, 0, 0, 0, 12));
            const p = buildPalm(1, 0.1 + (i % 3) * 0.08); p.scale.setScalar(3.2 + (i % 4) * 0.5); p.position.y = 0.6; p.rotation.y = i; g.add(p);
            g.position.set(-len / 2 + i * bay, 0, z); shadowed(g, true, false); scene.add(g);
        }
        // the crystal fountain that stood at the crossing
        const fountain = new THREE.Group();
        fountain.add(cyl(2.4, 2.6, 0.5, m.marble, 0, 0, 0, 32));
        fountain.add(cyl(2.2, 2.2, 0.06, m.water, 0, 0.46, 0, 32));
        let fy = 0.5;
        for (const [r, h] of [[0.55, 1.6], [1.3, 0.12], [0.36, 1.3], [0.85, 0.1], [0.2, 1.0], [0.45, 0.08], [0.05, 0.7]]) { fountain.add(cyl(r * 0.8, r, h, m.glass, 0, fy, 0, 20)); fy += h; }
        fountain.position.set(19, 0, 0); scene.add(fountain);
        const f2 = fountain.clone(); f2.position.x = -19; scene.add(f2);

        // gas chandeliers over the table — lit when the daylight goes
        this.lamps = [];
        for (const x of [-5, 0, 5]) {
            const g = new THREE.Group();
            g.add(cyl(0.02, 0.02, 14, m.brass, 0, 0, 0, 6));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 32), m.brass); ring.rotation.x = Math.PI / 2; g.add(ring);
            const globeMat = new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.3 });
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2;
                const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), globeMat); globe.position.set(Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7); g.add(globe);
            }
            const light = new THREE.PointLight(0xffb060, 0, 18, 1.7); light.position.y = -0.1; g.add(light);
            g.position.set(x, 5.2, 0); scene.add(g);
            this.lamps.push({ light, globeMat });
        }
    }

    buildTable() {
        const m = materials(), scene = this.scene, t = TABLE;
        const wm = woodMaps();
        const wood = new THREE.MeshPhysicalMaterial({ map: wm.map, normalMap: wm.normalMap, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.5 });
        const top = slab(stadium(t.straight + 1.2, t.r), 0.09, wood, t.y - 0.1);
        wm.map.repeat.set(0.25, 0.25); wm.normalMap.repeat.set(0.25, 0.25);
        const apron = slab(stadium(t.straight + 1.2, t.r - 0.22), 0.2, dark, t.y - 0.3);
        const cm = clothMaps();
        cm.map.repeat.set(1.5, 1.5); cm.normalMap.repeat.set(1.5, 1.5);
        const trim = slab(stadium(t.straight + 1.2, t.r - 0.2), 0.004, m.brass, t.y - 0.004);
        const cloth = slab(stadium(t.straight + 1.2, t.r - 0.235), 0.006, new THREE.MeshStandardMaterial({ map: cm.map, normalMap: cm.normalMap, roughness: 1 }), t.y - 0.004);
        const g = new THREE.Group(); g.add(top, apron, trim, cloth);
        for (const x of [-7, -3.5, 0, 3.5, 7]) for (const z of [-1.5, 1.5]) {
            g.add(cyl(0.11, 0.07, 0.72, dark, x, 0, z, 12));
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), dark); bulb.position.set(x, 0.58, z); bulb.scale.y = 0.8; g.add(bulb);
        }
        shadowed(g); scene.add(g);
        cloth.castShadow = trim.castShadow = false;
        this.clothY = t.y + 0.003;
    }

    buildWonders() {
        const m = materials();
        this.wonders = [];
        const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.25, metalness: 0.2 });
        WONDERS.forEach((w, i) => {
            const p = loopPoint(wonderS(i), ROW);
            const out = i < 7 ? 1 : -1; // direction toward the visitor
            const g = new THREE.Group(); g.position.set(p.x, this.clothY, p.z);
            g.add(cyl(0.64, 0.66, 0.05, plinthMat, 0, 0, 0, 40));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.012, 6, 48), m.brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
            const holder = new THREE.Group(); holder.position.y = 0.05; holder.rotation.y = out > 0 ? 0 : Math.PI; g.add(holder);
            if (!['pyramid', 'gardens', 'temple', 'statue', 'mausoleum', 'colossus', 'pharos', 'greatWall', 'skyscraper'].includes(w.id)) holder.add(MINIATURES[w.id]());
            // engraved brass nameplate, tilted toward the visitor
            const tex = canvasTexture(512, 128, (x, W, H) => {
                const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e2c377'); gr.addColorStop(0.5, '#b8934a'); gr.addColorStop(1, '#d8b869');
                x.fillStyle = gr; x.fillRect(0, 0, W, H);
                x.strokeStyle = 'rgba(60,40,10,.7)'; x.lineWidth = 4; x.strokeRect(10, 10, W - 20, H - 20);
                x.fillStyle = '#2a1c08'; x.textAlign = 'center'; x.textBaseline = 'middle';
                x.font = '600 58px "Ancient Tulip", Georgia, serif'; x.fillText(w.name.toUpperCase(), W / 2, H / 2 + 4);
            });
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.012), [m.brass, m.brass, m.brass, m.brass, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.8 }), m.brass]);
            plate.position.set(0, 0.06, out * 0.86); plate.rotation.y = out > 0 ? 0 : Math.PI; plate.rotateX(-0.9); g.add(plate);
            shadowed(g);
            this.scene.add(g);
            // generous invisible target for the pointer
            const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
            hit.position.set(p.x, this.clothY + 0.7, p.z); hit.userData.pick = { type: 'wonder', index: i };
            this.scene.add(hit); this.pickables.push(hit);
            this.wonders.push({ group: g, holder, out, pos: new THREE.Vector3(p.x, this.clothY + 0.05, p.z), plateTex: tex });
        });
        this.setPyramidBoard(7);
        this.setGardensBoard();
        this.setTempleBoard(2);
        this.setStatueBoard(2);
        this.setMausoleumBoard(2);
        this.setColossusBoard(2);
        this.setPharosBoard(2);
        this.setGreatWallBoard(2);
        this.setSkyscraperBoard(2);
        // nameplates were drawn before the display font finished loading: redraw once it has
        document.fonts && document.fonts.ready.then(() => this.wonders.forEach((w) => { w.plateTex.image && this.redrawPlate(w); }));
    }

    redrawPlate(w) {
        const i = this.wonders.indexOf(w), c = w.plateTex.image, x = c.getContext('2d'), W = c.width, H = c.height;
        const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e2c377'); gr.addColorStop(0.5, '#b8934a'); gr.addColorStop(1, '#d8b869');
        x.fillStyle = gr; x.fillRect(0, 0, W, H);
        x.strokeStyle = 'rgba(60,40,10,.7)'; x.lineWidth = 4; x.strokeRect(10, 10, W - 20, H - 20);
        x.fillStyle = '#2a1c08'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = '58px "Ancient Tulip", Georgia, serif'; x.fillText(WONDERS[i].name.toUpperCase(), W / 2, H / 2 + 4);
        w.plateTex.needsUpdate = true;
    }

    // The pyramid miniature is the real board at table scale, so the dive into it lines up exactly.
    setPyramidBoard(B) {
        const w = this.wonders[0];
        if (this.miniB === B) return;
        this.miniB = B;
        w.holder.clear();
        const { group } = buildBoard(B, { mini: true });
        const k = 0.86 / B;
        group.scale.setScalar(k);
        const sandDisc = cyl(0.6, 0.6, 0.012, materials().sandstone, 0, 0, 0, 40);
        group.position.y = 0.012;
        w.holder.add(sandDisc, group);
        shadowed(w.holder);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // the wonders whose board changes with the number of players
    setPlayers(n) {
        this.setPyramidBoard(n === 2 ? 7 : 9);
        this.setTempleBoard(n === 2 ? 2 : 4);
        this.setStatueBoard(n === 2 ? 2 : 4);
        this.setMausoleumBoard(n === 2 ? 2 : 4);
        this.setColossusBoard(n === 2 ? 2 : 4);
        this.setPharosBoard(n === 2 ? 2 : 4);
        this.setGreatWallBoard(n === 2 ? 2 : 4);
        this.setSkyscraperBoard(n === 2 ? 2 : 4);
    }

    // The Skyscraper miniature is the real tower in steel, crown and needle on top.
    setSkyscraperBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'skyscraper')];
        if (this.miniSky === n) return;
        this.miniSky = n;
        w.holder.clear();
        const { group } = buildSkyscraper(n, { mini: true });
        const k = 0.024;
        group.scale.setScalar(k);
        group.position.set(0, -SKYSCRAPER_GROUND * k, 0);
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Great Wall miniature is the real stretch of wall between its watchtowers (two walls crossing for four players).
    setGreatWallBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'greatWall')];
        if (this.miniWall === n) return;
        this.miniWall = n;
        w.holder.clear();
        const { group, reach } = buildGreatWall(n, { mini: true });
        const k = 0.62 / reach;
        group.scale.setScalar(k);
        group.position.set(0, -GREATWALL_GROUND * k, 0);
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Pharos miniature is the real fortress, its court the board, the lighthouse rising from the middle.
    setPharosBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'pharos')];
        if (this.miniPharos === n) return;
        this.miniPharos = n;
        w.holder.clear();
        const { group, depth } = buildPharos(n, { mini: true });
        const [front, back] = depth, k = 1.24 / Math.hypot(front - back, front - back);
        group.scale.setScalar(k);
        group.position.set(0, -(PHAROS_GROUND - 0.4) * k, -((front + back) / 2) * k); // quay and rock stand on the plinth; no sea on the table
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Colossus miniature is the real thing: Helios astride the two moles, the board in his hands.
    setColossusBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'colossus')];
        if (this.miniColossus === n) return;
        this.miniColossus = n;
        w.holder.clear();
        const { fixed, deck, R } = buildColossus(n, { mini: true });
        const group = new THREE.Group(); group.add(fixed, deck);
        const k = 0.6 / R;
        group.scale.setScalar(k);
        group.position.set(0, -(COLOSSUS_GROUND - 1.4) * k, 4.5 * k); // the moles stand on the plinth; there is no sea on the table // the mole stands on the plinth; there is no sea on the table
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Mausoleum miniature is the real floor of slabs with the tomb standing behind it.
    setMausoleumBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'mausoleum')];
        if (this.miniMausoleum === n) return;
        this.miniMausoleum = n;
        w.holder.clear();
        const { group, ext, tombZ } = buildMausoleum(n, { mini: true });
        // floor and tomb together run from the front step to the back of the podium: centre that on the plinth
        const front = ext.hz + 1.75, back = tombZ - 5.3, k = 1.2 / Math.hypot(front - back, (ext.a + 2.1) * 1.4);
        group.scale.setScalar(k);
        group.position.set(0, -MAUSOLEUM_GROUND * k, -((front + back) / 2) * k);
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Statue miniature is the real floor with Zeus enthroned over it; with four players, two thrones face each other.
    setStatueBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'statue')];
        if (this.miniStatue === n) return;
        this.miniStatue = n;
        w.holder.clear();
        const { group } = buildStatue(n, { mini: true });
        const k = n === 2 ? 0.052 : 0.039;
        group.scale.setScalar(k);
        group.position.set(0, -STATUE_GROUND * k, 0);
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Temple miniature is the real temple with its floor: a long hall for two, a square one for four.
    setTempleBoard(n) {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'temple')];
        if (this.miniTemple === n) return;
        this.miniTemple = n;
        w.holder.clear();
        const { group } = buildTemple(n, { mini: true });
        const k = n === 2 ? 0.072 : 0.056;
        group.scale.setScalar(k);
        group.position.set(0, -TEMPLE_GROUND * k, n === 2 ? 0.03 : 0);
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // The Gardens miniature is the real garden building too, standing on its own ground line.
    setGardensBoard() {
        const w = this.wonders[WONDERS.findIndex((x) => x.id === 'gardens')];
        const { group } = buildGardens({ mini: true });
        const k = 0.068;
        group.scale.setScalar(k);
        group.position.set(0, -GARDENS_GROUND * k, -0.7 * k); // centred on the plinth, the plain at its top
        w.holder.add(group);
        w.mini = { scale: k, origin: w.pos.clone().add(group.position) };
    }

    // where the hall camera must end so the miniature fills the view exactly like the real board
    diveView(index, home) {
        const { scale, origin } = this.wonders[index].mini, turn = this.wonders[index].out < 0 ? -1 : 1;
        const place = (v) => v.clone().multiplyScalar(scale).multiply(new THREE.Vector3(turn, 1, turn)).add(origin);
        return { pos: place(home.pos), target: place(home.target) };
    }

    buildMemorabilia() {
        const m = materials(), scene = this.scene, y = this.clothY;
        const P = this.wonders[0].pos;
        const add = (o, x, z, ry = 0, s = 1) => { o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); shadowed(o); scene.add(o); return o; };
        // Pyramid: a sandstone sphinx, an obelisk, a lapis scarab and the papyrus with the rules
        add(buildSphinx(m.sandstone, m.gold), P.x - 0.95, P.z + 0.42, 0.5, 0.42);
        add(buildObelisk(m.sandstone, m.gold, 1), P.x + 0.95, P.z - 0.45, 0.3, 0.42);
        const scarab = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0x1d3e9c, roughness: 0.2, clearcoat: 1 }));
        scarab.scale.set(0.8, 0.45, 1.1); add(scarab, P.x - 0.42, P.z + 0.8, 0.6, 0.7); scarab.position.y += 0.02;

        const tex = canvasTexture(768, 512, (x, W, H) => {
            papyrusBase(x, W, H);
            x.fillStyle = '#3a2410'; x.textAlign = 'center';
            x.font = '82px "Ancient Tulip", Georgia, serif'; x.fillText('PYRAMID', W / 2, 120);
            x.font = 'italic 34px Georgia, serif'; x.fillText('the rules of the game', W / 2, 172);
            x.strokeStyle = 'rgba(58,36,16,.75)'; x.lineWidth = 3;
            for (let r = 0; r < 6; r++) { // lines of handwriting
                x.beginPath();
                let px = 90; const py = 235 + r * 42;
                x.moveTo(px, py);
                while (px < W - 90 - (r === 5 ? 260 : 0)) { const wlen = 20 + ((px * 7 + r * 13) % 60); x.lineTo(px + wlen, py + ((px + r) % 5) - 2); px += wlen + 14; x.moveTo(px, py); }
                x.stroke();
            }
        });
        this.rulesTex = tex;
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.41), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffe2a8, emissiveMap: tex, emissiveIntensity: 0 }));
        sheet.rotation.x = -Math.PI / 2;
        const scroll = new THREE.Group(); scroll.add(sheet);
        sheet.position.y = 0.006;
        const roll = new THREE.MeshStandardMaterial({ color: 0xcdb078, roughness: 0.9 });
        for (const sx of [-0.31, 0.31]) { const r = cyl(0.022, 0.022, 0.43, roll, 0, 0, 0, 10); r.rotation.x = Math.PI / 2; r.position.set(sx, 0.022, 0); scroll.add(r); }
        // propped on a little brass rest so it faces the visitor
        scroll.rotation.x = 0.8; scroll.position.y = 0.16;
        const rest = new THREE.Group(); rest.add(scroll);
        const leg = box(0.4, 0.22, 0.02, m.brass, 0, 0, -0.13); leg.rotation.x = -0.35; rest.add(leg);
        add(rest, P.x + 1.0, P.z + 0.5, -0.3, 0.72);
        sheet.userData.pick = { type: 'rules', index: 0 }; this.pickables.push(sheet);
        this.rulesSheets = [sheet];
        document.fonts && document.fonts.ready.then(() => { // repaint the title in the display font
            const c = tex.image, x = c.getContext('2d');
            x.save(); x.beginPath(); x.rect(120, 40, 528, 100); x.clip(); papyrusBase(x, c.width, c.height); x.restore();
            x.fillStyle = '#3a2410'; x.textAlign = 'center'; x.font = '82px "Ancient Tulip", Georgia, serif'; x.fillText('PYRAMID', c.width / 2, 120);
            tex.needsUpdate = true;
        });

        this.buildGardensMemorabilia(add);
        this.buildTempleMemorabilia(add);
        this.buildStatueMemorabilia(add);
        this.buildMausoleumMemorabilia(add);
        this.buildColossusMemorabilia(add);
        this.buildPharosMemorabilia(add);
        this.buildGreatWallMemorabilia(add);
        this.buildSkyscraperMemorabilia(add);

        // the two ends of the table: a globe, books and a spyglass; a map and a compass
        const globe = new THREE.Group();
        globe.add(cyl(0.2, 0.24, 0.04, m.wood, 0, 0, 0, 20), cyl(0.025, 0.035, 0.26, m.brass, 0, 0.04, 0, 10));
        const earthTex = canvasTexture(512, 256, (x, W, H) => {
            x.fillStyle = '#31546b'; x.fillRect(0, 0, W, H);
            x.fillStyle = '#c7b07a';
            for (let i = 0; i < 26; i++) { const cx = (i * 97) % W, cy = 40 + (i * 53) % 170; x.beginPath(); x.ellipse(cx, cy, 30 + (i * 31) % 50, 16 + (i * 17) % 30, i, 0, 7); x.fill(); }
            x.strokeStyle = 'rgba(240,225,180,.35)'; x.lineWidth = 1;
            for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(i * W / 12, 0); x.lineTo(i * W / 12, H); x.stroke(); }
            for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * H / 6); x.lineTo(W, i * H / 6); x.stroke(); }
        });
        const earth = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), new THREE.MeshPhysicalMaterial({ map: earthTex, roughness: 0.35, clearcoat: 0.5 }));
        earth.position.y = 0.6; earth.rotation.z = 0.41; globe.add(earth); this.earth = earth;
        const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 6, 40), m.brass); meridian.position.y = 0.6; meridian.rotation.z = 0.41; globe.add(meridian);
        add(globe, 8.3, 0);
        const books = new THREE.Group();
        [[0x5a1f1f, 0.5, 0.07, 0.36, 0], [0x1f3a2c, 0.46, 0.06, 0.33, 0.3], [0x26304f, 0.42, 0.05, 0.3, -0.2]].forEach(([c, w, h, d, r], i) => {
            const b = box(w, h, d, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), 0, i * 0.07, 0); b.rotation.y = r; books.add(b);
            const pages = box(w - 0.03, h - 0.02, d - 0.02, m.ivory, 0.02, i * 0.07 + 0.01, 0); pages.rotation.y = r; books.add(pages);
        });
        add(books, -8.2, -0.6, 0.4);
        const scope = new THREE.Group();
        scope.add(cyl(0.035, 0.045, 0.34, m.brass, 0, 0, 0, 14), cyl(0.028, 0.034, 0.26, m.brass, 0, 0.32, 0, 14), cyl(0.02, 0.026, 0.2, m.brass, 0, 0.56, 0, 14));
        scope.rotation.z = Math.PI / 2; const sg = new THREE.Group(); sg.add(scope); scope.position.set(0.35, 0.05, 0);
        add(sg, -8.1, 0.55, 0.9);
        const mapTex = canvasTexture(512, 360, (x, W, H) => {
            papyrusBase(x, W, H, 9);
            x.strokeStyle = 'rgba(70,45,20,.7)'; x.lineWidth = 2; x.beginPath();
            x.moveTo(40, 200); x.bezierCurveTo(140, 120, 220, 260, 300, 170); x.bezierCurveTo(360, 110, 430, 190, 480, 130); x.stroke();
            x.setLineDash([6, 8]); x.beginPath(); x.moveTo(80, 300); x.bezierCurveTo(200, 240, 300, 320, 440, 250); x.stroke(); x.setLineDash([]);
            x.fillStyle = '#7a1a12';
            for (const [px, py] of [[110, 170], [200, 215], [270, 190], [330, 150], [400, 170], [450, 145], [160, 280]]) { x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); }
            x.fillStyle = 'rgba(58,36,16,.8)'; x.font = 'italic 26px Georgia, serif'; x.fillText('Mare Internum', 190, 300);
        });
        const map = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.95 }));
        map.rotation.x = -Math.PI / 2; const mg = new THREE.Group(); mg.add(map); map.position.y = 0.004;
        add(mg, 0, 0, 0.12); map.castShadow = false;
        const compass = new THREE.Group();
        compass.add(cyl(0.09, 0.09, 0.03, m.brass, 0, 0, 0, 24), cyl(0.078, 0.078, 0.005, m.ivory, 0, 0.03, 0, 24));
        const needle = box(0.012, 0.004, 0.13, new THREE.MeshStandardMaterial({ color: 0x8a1c14 }), 0, 0.036, 0); compass.add(needle);
        add(compass, 0.62, 0.22, 0.7);
    }

    // Skyscraper: the rules on a blueprint, a length of riveted steel, a yellow cab
    buildSkyscraperMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'skyscraper'), P = this.wonders[index].pos, out = this.wonders[index].out;
        const side = (dx, dz, ry, s = 1) => [P.x - out * dx, P.z + out * dz, (out > 0 ? 0 : Math.PI) + ry, s];
        const draw = (x, W, H) => {
            x.fillStyle = '#1f4f8c'; x.fillRect(0, 0, W, H);
            x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1;
            for (let i = 0; i < W; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
            for (let i = 0; i < H; i += 24) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
            x.strokeStyle = '#e8f0fa'; x.fillStyle = '#e8f0fa'; x.lineWidth = 3; x.strokeRect(18, 18, W - 36, H - 36);
            x.textAlign = 'center'; x.font = '60px "Ancient Tulip", Georgia, serif'; x.fillText('SKYSCRAPER', W / 2, 108);
            x.font = 'italic 28px Georgia, serif'; x.fillText('the rules of the game', W / 2, 150);
            // an elevation of the tower
            x.lineWidth = 2; x.strokeRect(84, 250, 130, 190); for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(84 + i * 26, 250); x.lineTo(84 + i * 26, 440); x.moveTo(84, 250 + i * 38); x.lineTo(214, 250 + i * 38); x.stroke(); }
            for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(149, 250, 60 - i * 11, Math.PI, 0); x.stroke(); }
            x.beginPath(); x.moveTo(149, 196); x.lineTo(149, 176); x.stroke();
            for (let r = 0; r < 7; r++) { x.beginPath(); let px = 250; const py = 240 + r * 32; x.moveTo(px, py); while (px < W - 60 - (r === 6 ? 110 : 0)) { const wl = 16 + ((px * 5 + r * 17) % 50); x.lineTo(px + wl, py); px += wl + 12; x.moveTo(px, py); } x.stroke(); }
        };
        const tex = canvasTexture(640, 512, draw);
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.45), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xcfe0ff, emissiveMap: tex, emissiveIntensity: 0 }));
        sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.006;
        const plan = new THREE.Group(); plan.add(sheet);
        const roll = new THREE.MeshStandardMaterial({ color: 0x1f4f8c, roughness: 0.9 });
        const r1 = cyl(0.02, 0.02, 0.47, roll, 0, 0, 0, 10); r1.rotation.x = Math.PI / 2; r1.position.set(0.28, 0.02, 0); plan.add(r1);
        plan.rotation.x = 0.8; plan.position.y = 0.17;
        const rest = new THREE.Group(); rest.add(plan);
        const leg = box(0.4, 0.24, 0.02, m.steel, 0, 0, -0.14); leg.rotation.x = -0.35; rest.add(leg);
        add(rest, ...side(-1.0, 0.5, -0.3, 0.72));
        sheet.userData.pick = { type: 'rules', index }; this.pickables.push(sheet);
        this.rulesSheets.push(sheet);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; draw(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // a length of steel beam with its rivets
        const beam = new THREE.Group();
        beam.add(box(0.34, 0.016, 0.1, m.steel, 0, 0, 0), box(0.34, 0.016, 0.1, m.steel, 0, 0.1, 0), box(0.34, 0.085, 0.016, m.steel, 0, 0.016, 0));
        for (let i = 0; i < 6; i++) for (const z of [-0.032, 0.032]) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), m.iron); rv.position.set(-0.14 + i * 0.056, 0.118, z); beam.add(rv); }
        add(beam, ...side(-0.98, -0.46, 0.5));

        // a yellow cab
        const cab = new THREE.Group(), yellow = new THREE.MeshPhysicalMaterial({ color: 0xe8b21c, roughness: 0.3, clearcoat: 0.8 });
        cab.add(box(0.2, 0.045, 0.085, yellow, 0, 0.02, 0), box(0.1, 0.045, 0.078, yellow, -0.01, 0.065, 0), box(0.09, 0.03, 0.08, m.window, -0.01, 0.07, 0));
        for (const [x, z] of [[-0.06, 0.045], [0.06, 0.045], [-0.06, -0.045], [0.06, -0.045]]) { const wh = cyl(0.02, 0.02, 0.014, m.ink, 0, 0, 0, 12); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.02, z); cab.add(wh); }
        add(cab, ...side(-0.7, 0.86, 0.9));
    }

    // Great Wall: the rules on a hanging scroll, a bronze helmet, a quiver of arrows, a jade disc
    buildGreatWallMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'greatWall'), P = this.wonders[index].pos, out = this.wonders[index].out;
        const side = (dx, dz, ry, s = 1) => [P.x - out * dx, P.z + out * dz, (out > 0 ? 0 : Math.PI) + ry, s];
        const paint = (x, W, H) => {
            x.fillStyle = '#e9dfc4'; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(120,100,60,${0.02 + (i % 7) / 160})`; x.fillRect((i * 7919) % W, (i * 104729) % H, 2 + (i % 14), 1 + (i % 3)); }
            x.fillStyle = '#8a2a1e'; x.fillRect(0, 0, W, 34); x.fillRect(0, H - 34, W, 34);
            x.fillStyle = '#2a2018'; x.textAlign = 'center';
            x.font = '56px "Ancient Tulip", Georgia, serif'; x.fillText('GREAT WALL', W / 2, 124);
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 164);
            x.strokeStyle = 'rgba(42,32,24,.8)'; x.lineWidth = 4; x.lineCap = 'round'; // brushed columns of signs
            for (let c = 0; c < 9; c++) for (let r = 0; r < 7; r++) {
                if (c === 8 && r > 3) break;
                const px = W - 76 - c * 45, py = 214 + r * 46, k = (c * 7 + r * 13) % 5;
                x.beginPath(); x.moveTo(px - 12, py - 10 + k); x.lineTo(px + 12, py - 12 + k * 2); x.moveTo(px, py - 16); x.lineTo(px - 2 + k, py + 14); x.moveTo(px - 12, py + 6); x.lineTo(px + 11, py + 2 + k); x.stroke();
            }
            x.fillStyle = '#a3261a'; x.fillRect(60, H - 110, 46, 46); // a seal
        };
        const tex = canvasTexture(512, 640, paint);
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.45), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffe8c0, emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide }));
        sheet.position.y = 0.3;
        const stand = new THREE.Group(); stand.add(sheet);
        const rod = (y) => { const r = cyl(0.012, 0.012, 0.42, m.wood, 0, 0, 0, 8); r.rotation.z = Math.PI / 2; r.position.set(0, y, 0); return r; };
        stand.add(rod(0.53), rod(0.07), cyl(0.008, 0.008, 0.56, m.wood, -0.2, 0, -0.01, 6), cyl(0.008, 0.008, 0.56, m.wood, 0.2, 0, -0.01, 6), box(0.46, 0.02, 0.1, m.wood, 0, 0, 0));
        stand.rotation.x = -0.12;
        const sg = new THREE.Group(); sg.add(stand);
        add(sg, ...side(-1.0, 0.5, -0.3, 0.85));
        sheet.userData.pick = { type: 'rules', index }; this.pickables.push(sheet);
        this.rulesSheets.push(sheet);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; paint(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // a bronze helmet
        const helm = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.bronze); dome.position.y = 0.02; helm.add(dome);
        helm.add(cyl(0.1, 0.1, 0.02, m.bronze, 0, 0, 0, 16), cyl(0.006, 0.012, 0.07, m.bronze, 0, 0.1, 0, 6));
        const plume = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: 0xa3261a, roughness: 0.9 })); plume.scale.set(1, 1.8, 1); plume.position.y = 0.19; helm.add(plume);
        add(helm, ...side(-0.98, -0.46, 0.4));

        // a quiver with its arrows
        const quiver = new THREE.Group();
        const tube = cyl(0.035, 0.03, 0.26, new THREE.MeshStandardMaterial({ color: 0x5a2f1c, roughness: 0.7 }), 0, 0, 0, 10); quiver.add(tube);
        for (let i = 0; i < 5; i++) { const a = cyl(0.004, 0.004, 0.34, m.wood, Math.cos(i * 1.3) * 0.016, 0.02, Math.sin(i * 1.3) * 0.016, 4); quiver.add(a); const f = box(0.02, 0.05, 0.002, m.ivory, Math.cos(i * 1.3) * 0.016, 0.31, Math.sin(i * 1.3) * 0.016); f.rotation.y = i; quiver.add(f); }
        quiver.rotation.z = Math.PI / 2 - 0.1; quiver.position.y = 0.04;
        const qg = new THREE.Group(); qg.add(quiver); add(qg, ...side(-0.7, 0.86, 0.5));

        // a jade disc
        const bi = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 8, 28), new THREE.MeshPhysicalMaterial({ color: 0x6fae8a, roughness: 0.25, clearcoat: 0.8 }));
        bi.rotation.x = Math.PI / 2; bi.scale.z = 0.35; bi.position.y = 0.008;
        const bg = new THREE.Group(); bg.add(bi); add(bg, ...side(-0.78, 0.1, 0));
    }

    // Pharos: the rules on a papyrus roll from the Library, a bronze mirror, an oil lamp
    buildPharosMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'pharos'), P = this.wonders[index].pos, out = this.wonders[index].out;
        const side = (dx, dz, ry, s = 1) => [P.x - out * dx, P.z + out * dz, (out > 0 ? 0 : Math.PI) + ry, s];
        const write = (x, W, H) => {
            papyrusBase(x, W, H, 17);
            x.fillStyle = '#3a2410'; x.textAlign = 'center';
            x.font = '82px "Ancient Tulip", Georgia, serif'; x.fillText('PHAROS', W / 2, 120);
            x.font = 'italic 34px Georgia, serif'; x.fillText('the rules of the game', W / 2, 172);
            x.strokeStyle = 'rgba(58,36,16,.75)'; x.lineWidth = 3;
            for (let r = 0; r < 6; r++) {
                x.beginPath();
                let px = 90; const py = 235 + r * 42;
                x.moveTo(px, py);
                while (px < W - 90 - (r === 5 ? 300 : 0)) { const wl = 18 + ((px * 5 + r * 17) % 64); x.lineTo(px + wl, py + ((px + r * 3) % 5) - 2); px += wl + 14; x.moveTo(px, py); }
                x.stroke();
            }
        };
        const tex = canvasTexture(768, 512, write);
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.41), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffe2a8, emissiveMap: tex, emissiveIntensity: 0 }));
        sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.006;
        const scroll = new THREE.Group(); scroll.add(sheet);
        const roll = new THREE.MeshStandardMaterial({ color: 0xcdb078, roughness: 0.9 });
        for (const sx of [-0.31, 0.31]) { const r = cyl(0.022, 0.022, 0.43, roll, 0, 0, 0, 10); r.rotation.x = Math.PI / 2; r.position.set(sx, 0.022, 0); scroll.add(r); }
        scroll.rotation.x = 0.8; scroll.position.y = 0.16;
        const rest = new THREE.Group(); rest.add(scroll);
        const leg = box(0.4, 0.22, 0.02, m.brass, 0, 0, -0.13); leg.rotation.x = -0.35; rest.add(leg);
        add(rest, ...side(-1.0, 0.5, -0.3, 0.72));
        sheet.userData.pick = { type: 'rules', index }; this.pickables.push(sheet);
        this.rulesSheets.push(sheet);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; write(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // the mirror that threw the fire's light out to sea
        const mirror = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 28), new THREE.MeshStandardMaterial({ color: 0xe8c880, roughness: 0.08, metalness: 1 }));
        disc.rotation.x = Math.PI / 2 - 0.25; disc.position.y = 0.2; mirror.add(disc);
        mirror.add(cyl(0.012, 0.016, 0.1, m.bronze, 0, 0, 0, 8), cyl(0.06, 0.07, 0.02, m.bronze, 0, 0, 0, 14));
        add(mirror, ...side(-0.98, -0.46, 0.5));

        // an oil lamp, its wick alight
        const lamp = new THREE.Group();
        const bodyL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), m.terracotta); bodyL.scale.set(1.3, 0.5, 1); bodyL.position.y = 0.03; lamp.add(bodyL);
        const spout = cyl(0.014, 0.024, 0.07, m.terracotta, 0.085, 0.025, 0, 8); spout.rotation.z = -1.1; lamp.add(spout);
        const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 5, 10), m.terracotta); hnd.position.set(-0.085, 0.04, 0); lamp.add(hnd);
        const wick = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), m.lamp); wick.scale.y = 1.8; wick.position.set(0.125, 0.07, 0); lamp.add(wick);
        add(lamp, ...side(-0.72, 0.84, 0.6));
    }

    // Colossus: the rules on a bronze ship's plate, a Rhodian amphora, an anchor, coins with the head of Helios
    buildColossusMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'colossus'), P = this.wonders[index].pos;
        const out = this.wonders[index].out; // this side of the table faces the other way
        const engrave = (x, W, H) => {
            const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#a8763c'); g.addColorStop(0.5, '#c79a52'); g.addColorStop(1, '#8f6230');
            x.fillStyle = g; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 800; i++) { x.fillStyle = i % 2 ? `rgba(60,34,10,${0.04 + (i % 7) / 100})` : `rgba(255,226,160,${0.03 + (i % 5) / 90})`; x.fillRect((i * 7919) % W, (i * 104729) % H, 3 + (i % 9), 2 + (i % 4)); }
            x.strokeStyle = 'rgba(60,34,10,.7)'; x.lineWidth = 4; x.strokeRect(16, 16, W - 32, H - 32);
            x.fillStyle = '#3a2208'; x.textAlign = 'center';
            x.font = '64px "Ancient Tulip", Georgia, serif'; x.fillText('COLOSSUS', W / 2, 124);
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 166);
            x.font = '28px Georgia, serif';
            const glyphs = 'ΗΛΙΟΣΡΟΔΟΣΧΑΡΗΣΛΙΜΗΝΚΟΛΟΣΣΟΣΑΙΔΗΣΚΛΙΣΙΣ';
            for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { if (r === 7 && c > 4) break; x.fillText(glyphs[(r * 5 + c * 3) % glyphs.length], 72 + c * 33.5, 232 + r * 40); }
            // a rayed sun in the corner
            x.strokeStyle = '#3a2208'; x.lineWidth = 3;
            for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; x.beginPath(); x.moveTo(W - 70 + Math.cos(a) * 16, H - 70 + Math.sin(a) * 16); x.lineTo(W - 70 + Math.cos(a) * 30, H - 70 + Math.sin(a) * 30); x.stroke(); }
            x.beginPath(); x.arc(W - 70, H - 70, 11, 0, 7); x.fill();
        };
        const tex = canvasTexture(512, 580, engrave);
        const bronze = new THREE.MeshStandardMaterial({ color: 0xb08040, roughness: 0.4, metalness: 0.8 });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.41, 0.014),
            [bronze, bronze, bronze, bronze, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.6, emissive: 0xffe0a0, emissiveMap: tex, emissiveIntensity: 0 }), bronze]);
        plate.rotation.x = -0.5; plate.position.set(0, 0.2, 0);
        const rest = new THREE.Group(); rest.add(plate);
        const leg = box(0.26, 0.22, 0.02, m.wood, 0, 0, -0.13); leg.rotation.x = 0.28; rest.add(leg);
        rest.add(box(0.4, 0.025, 0.09, m.wood, 0, 0, 0.09));
        const side = (dx, dz, ry, s = 1) => [P.x - out * dx, P.z + out * dz, (out > 0 ? 0 : Math.PI) + ry, s];
        add(rest, ...side(-1.0, 0.5, -0.3, 0.8));
        plate.userData.pick = { type: 'rules', index }; plate.userData.glow = 4; this.pickables.push(plate);
        this.rulesSheets.push(plate);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; engrave(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // a wine amphora of Rhodes, lying on its side
        const amph = new THREE.Group();
        const body = new THREE.Mesh(new THREE.LatheGeometry([[0.004, 0], [0.03, 0.04], [0.075, 0.16], [0.07, 0.25], [0.035, 0.31], [0.03, 0.39], [0.042, 0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 18), m.terracotta);
        amph.add(body);
        for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 5, 10, Math.PI), m.terracotta); h.position.set(s * 0.045, 0.34, 0); h.rotation.z = s * -Math.PI / 2; amph.add(h); }
        amph.rotation.z = Math.PI / 2 - 0.12; amph.position.y = 0.075;
        const ag = new THREE.Group(); ag.add(amph); add(ag, ...side(-0.98, -0.46, 0.7));

        // a small bronze anchor
        const anchor = new THREE.Group();
        anchor.add(cyl(0.008, 0.008, 0.2, m.bronze, 0, 0, 0, 6));
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 5, 14, Math.PI), m.bronze); arc.rotation.z = Math.PI; arc.position.y = 0.07; anchor.add(arc);
        anchor.add(box(0.11, 0.012, 0.012, m.bronze, 0, 0.17, 0));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 5, 12), m.bronze); ring.position.y = 0.215; anchor.add(ring);
        anchor.rotation.x = Math.PI / 2; anchor.position.y = 0.01;
        const ng = new THREE.Group(); ng.add(anchor); add(ng, ...side(-0.8, 0.12, 0.5));

        // drachms of Rhodes: Helios on one side
        const coinTex = canvasTexture(128, 128, (x) => {
            x.fillStyle = '#c9a253'; x.fillRect(0, 0, 128, 128);
            x.strokeStyle = '#6a4a14'; x.lineWidth = 3;
            for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; x.beginPath(); x.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); x.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); x.stroke(); }
            x.fillStyle = '#6a4a14'; x.beginPath(); x.arc(64, 64, 26, 0, 7); x.fill();
            x.fillStyle = '#c9a253'; x.beginPath(); x.arc(64, 64, 20, 0, 7); x.fill();
        });
        const coinM = [m.brass, new THREE.MeshStandardMaterial({ map: coinTex, roughness: 0.35, metalness: 0.9 }), m.brass];
        for (const [dx, dz, lift] of [[-0.66, 0.86, 0], [-0.74, 0.8, 0.004], [-0.6, 0.78, 0]]) {
            const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.007, 22), coinM); coin.position.y = 0.0035 + lift;
            const cg = new THREE.Group(); cg.add(coin); add(cg, ...side(dx, dz, dx * 9));
        }
    }

    // Mausoleum: the rules on a slab of the frieze, a marble lion, an alabaster jar, a gold wreath
    buildMausoleumMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'mausoleum'), P = this.wonders[index].pos;
        const relief = (x, W, H) => {
            x.fillStyle = '#dcd6c8'; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 700; i++) { x.fillStyle = i % 2 ? `rgba(90,86,78,${0.03 + (i % 7) / 110})` : `rgba(255,252,240,${0.04 + (i % 5) / 90})`; x.fillRect((i * 7919) % W, (i * 104729) % H, 3 + (i % 9), 2 + (i % 4)); }
            x.fillStyle = '#5f7f9c'; x.fillRect(0, 0, W, 26); x.fillRect(0, H - 26, W, 26);
            x.fillStyle = '#b9743c'; x.fillRect(0, 26, W, 8); x.fillRect(0, H - 34, W, 8);
            x.fillStyle = '#3f3a32'; x.textAlign = 'center';
            x.font = '58px "Ancient Tulip", Georgia, serif'; x.fillText('MAUSOLEUM', W / 2, 118);
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 158);
            x.font = '28px Georgia, serif';
            const glyphs = 'ΜΑΥΣΩΛΟΣΑΡΤΕΜΙΣΙΑΚΑΡΙΑΤΑΦΟΣΛΙΘΟΣΚΥΚΛΟΣ';
            for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { if (r === 7 && c > 7) break; x.fillText(glyphs[(r * 5 + c * 7) % glyphs.length], 72 + c * 33.5, 222 + r * 40); }
        };
        const tex = canvasTexture(512, 580, relief);
        const stone = new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.6 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.41, 0.045),
            [stone, stone, stone, stone, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xfff0d0, emissiveMap: tex, emissiveIntensity: 0 }), stone]);
        slab.position.y = 0.23; slab.rotation.x = -0.14;
        const g = new THREE.Group(); g.add(slab, box(0.42, 0.04, 0.15, stone, 0, 0, 0));
        add(g, P.x + 1.0, P.z + 0.5, -0.3, 0.85);
        slab.userData.pick = { type: 'rules', index }; slab.userData.glow = 4; this.pickables.push(slab);
        this.rulesSheets.push(slab);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; relief(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // one of the lions that stood around the tomb
        const lion = new THREE.Group();
        lion.add(box(0.3, 0.03, 0.13, m.marble, 0, 0, 0));
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), m.marble); body.scale.set(2.2, 1, 0.95); body.position.y = 0.13; lion.add(body);
        for (const [lx, lz] of [[-0.07, -0.03], [-0.07, 0.03], [0.07, -0.03], [0.07, 0.03]]) lion.add(cyl(0.013, 0.015, 0.1, m.marble, lx, 0.03, lz, 6));
        const mane = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), m.marble); mane.position.set(0.11, 0.17, 0); lion.add(mane);
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), m.marble); snout.position.set(0.16, 0.16, 0); lion.add(snout);
        const tail = cyl(0.006, 0.008, 0.11, m.marble, -0.12, 0.12, 0, 5); tail.rotation.z = 0.9; lion.add(tail);
        add(lion, P.x + 0.98, P.z - 0.46, 0.5, 1.15);

        // an alabaster jar, such as was found in the burial chamber
        const jar = new THREE.Mesh(new THREE.LatheGeometry([[0.022, 0], [0.04, 0.02], [0.05, 0.1], [0.04, 0.17], [0.022, 0.2], [0.03, 0.215]].map(([r, y]) => new THREE.Vector2(r, y)), 18), m.ivory);
        const jg = new THREE.Group(); jg.add(jar); add(jg, P.x + 0.8, P.z + 0.1, 0);

        // a wreath of gold leaves
        const wreath = new THREE.Group();
        for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), m.gold);
            leaf.scale.set(1.7, 0.2, 0.6); leaf.position.set(Math.cos(a) * 0.1, 0.008 + (i % 3) * 0.003, Math.sin(a) * 0.1); leaf.rotation.y = -a + (i % 2 ? 0.9 : -0.9); wreath.add(leaf);
        }
        add(wreath, P.x + 0.68, P.z + 0.86, 0.2);
    }

    // Statue: the rules engraved on a bronze tablet, an olive wreath, a pair of ivory dice, a little golden Nike
    buildStatueMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'statue'), P = this.wonders[index].pos;
        const engrave = (x, W, H) => {
            const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6f8f7c'); g.addColorStop(0.5, '#8a7a4a'); g.addColorStop(1, '#5f8474');
            x.fillStyle = g; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 900; i++) { x.fillStyle = i % 2 ? `rgba(30,60,50,${0.04 + (i % 7) / 90})` : `rgba(220,200,130,${0.03 + (i % 5) / 90})`; x.fillRect((i * 7919) % W, (i * 104729) % H, 3 + (i % 9), 2 + (i % 4)); }
            x.strokeStyle = 'rgba(30,40,30,.6)'; x.lineWidth = 4; x.strokeRect(16, 16, W - 32, H - 32);
            x.fillStyle = '#20281e'; x.textAlign = 'center';
            x.font = '72px "Ancient Tulip", Georgia, serif'; x.fillText('STATUE', W / 2, 130);
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 172);
            x.font = '28px Georgia, serif';
            const glyphs = 'ΖΕΥΣΟΛΥΜΠΙΟΣΦΕΙΔΙΑΣΚΥΒΟΣΝΙΚΗΘΡΟΝΟΣΑΛΤΙΣ';
            for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { if (r === 7 && c > 5) break; x.fillText(glyphs[(r * 7 + c * 3) % glyphs.length], 72 + c * 33.5, 236 + r * 40); }
            for (const [px, py] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) { x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); }
        };
        const tex = canvasTexture(512, 580, engrave);
        const bronze = new THREE.MeshStandardMaterial({ color: 0x6f8470, roughness: 0.5, metalness: 0.7 });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.41, 0.014),
            [bronze, bronze, bronze, bronze, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.55, emissive: 0xfff0c0, emissiveMap: tex, emissiveIntensity: 0 }), bronze]);
        plate.rotation.x = -0.5; plate.position.set(0, 0.2, 0);
        const rest = new THREE.Group(); rest.add(plate);
        const leg = box(0.26, 0.22, 0.02, m.wood, 0, 0, -0.13); leg.rotation.x = 0.28; rest.add(leg);
        rest.add(box(0.4, 0.025, 0.09, m.wood, 0, 0, 0.09));
        add(rest, P.x + 1.0, P.z + 0.5, -0.3, 0.8);
        plate.userData.pick = { type: 'rules', index }; plate.userData.glow = 4; this.pickables.push(plate);
        this.rulesSheets.push(plate);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; engrave(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // the victor's crown of wild olive
        const wreath = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 5, 28), m.wood); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; wreath.add(ring);
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), i % 2 ? m.foliage : m.darkleaf);
            leaf.scale.set(1.6, 0.25, 0.6); leaf.position.set(Math.cos(a) * 0.12, 0.016 + (i % 3) * 0.004, Math.sin(a) * 0.12); leaf.rotation.y = -a + (i % 2 ? 0.9 : -0.9); wreath.add(leaf);
        }
        add(wreath, P.x + 1.05, P.z - 0.42, 0.3);

        // two ivory dice
        const pipTex = (n) => canvasTexture(64, 64, (x) => {
            x.fillStyle = '#f1e7d0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a1c10';
            for (const [px, py] of [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]][n]) { x.beginPath(); x.arc(32 + px * 16, 32 + py * 16, 6, 0, 7); x.fill(); }
        });
        const faces = [1, 6, 3, 4, 2, 5].map((n) => new THREE.MeshPhysicalMaterial({ map: pipTex(n), roughness: 0.3, clearcoat: 0.6 }));
        const dieG = new THREE.BoxGeometry(0.07, 0.07, 0.07);
        const d1 = new THREE.Mesh(dieG, faces); d1.position.y = 0.035; const g1 = new THREE.Group(); g1.add(d1); add(g1, P.x + 0.64, P.z + 0.88, 0.5);
        const d2 = new THREE.Mesh(dieG, [faces[2], faces[3], faces[4], faces[5], faces[0], faces[1]]); d2.position.y = 0.035; const g2 = new THREE.Group(); g2.add(d2); add(g2, P.x + 0.76, P.z + 0.8, 1.3);

        // Nike, as she stood on the god's right hand
        const nike = new THREE.Group();
        nike.add(cyl(0.05, 0.06, 0.03, m.marble, 0, 0, 0, 12), cyl(0.012, 0.04, 0.16, m.gold, 0, 0.03, 0, 10));
        const nh = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m.gold); nh.position.y = 0.205; nike.add(nh);
        for (const s of [-1, 1]) { const wing = box(0.075, 0.1, 0.008, m.gold, s * 0.04, 0.1, -0.012); wing.rotation.z = s * -0.5; nike.add(wing); }
        add(nike, P.x + 0.82, P.z + 0.12, -0.3, 1.1);
    }

    // Temple: the rules cut into a marble stele, an Ionic capital, a silver coin with the bee of Ephesus, a bronze stag
    buildTempleMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'temple'), P = this.wonders[index].pos;
        const carve = (x, W, H) => {
            x.fillStyle = '#e9e4d8'; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 60; i++) {
                x.strokeStyle = `rgba(120,118,112,${0.05 + ((i * 31) % 10) / 120})`; x.lineWidth = 1 + (i % 3);
                let vx = (i * 7919) % W, vy = (i * 104729) % H; x.beginPath(); x.moveTo(vx, vy);
                for (let k = 0; k < 5; k++) { vx += ((i * 37 + k * 91) % 140) - 50; vy += ((i * 53 + k * 29) % 110) - 55; x.lineTo(vx, vy); }
                x.stroke();
            }
            x.fillStyle = '#4a4338'; x.textAlign = 'center';
            x.font = '70px "Ancient Tulip", Georgia, serif'; x.fillText('TEMPLE', W / 2, 150);
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 192);
            x.font = '30px Georgia, serif'; // an inscription in capitals, letters aligned in a grid as the Greeks cut them
            const glyphs = 'ΑΡΤΕΜΙΣΕΦΕΣΙΑΝΙΚΗΛΙΘΟΣΔΡΟΜΟΣΠΗΔΗΜΑΘΕΑΣ';
            for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) { if (r === 8 && c > 6) break; x.fillText(glyphs[(r * 5 + c * 3) % glyphs.length], 72 + c * 33.5, 250 + r * 40); }
        };
        const tex = canvasTexture(512, 640, carve);
        const stone = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 });
        const stele = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.05),
            [stone, stone, stone, stone, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xfff0d0, emissiveMap: tex, emissiveIntensity: 0 }), stone]);
        stele.position.y = 0.26; stele.rotation.x = -0.12;
        const g = new THREE.Group(); g.add(stele);
        const gable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.2, 0.1, 4), stone); gable.rotation.y = Math.PI / 4; gable.scale.z = 0.2; gable.position.set(0, 0.53, -0.03); g.add(gable);
        g.add(box(0.42, 0.045, 0.16, stone, 0, 0, 0));
        add(g, P.x + 1.0, P.z + 0.5, -0.3, 0.85);
        stele.userData.pick = { type: 'rules', index }; stele.userData.glow = 4; this.pickables.push(stele);
        this.rulesSheets.push(stele);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; carve(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; });

        // an Ionic capital, fallen from its column
        const cap = new THREE.Group();
        cap.add(cyl(0.085, 0.075, 0.07, m.marble, 0, 0, 0, 16), box(0.26, 0.035, 0.2, m.marble, 0, 0.1, 0));
        for (const sx of [-1, 1]) { const v = cyl(0.05, 0.05, 0.2, m.marble, 0, 0, 0, 14); v.rotation.x = Math.PI / 2; v.position.set(sx * 0.115, 0.075, 0); cap.add(v); }
        add(cap, P.x + 0.98, P.z - 0.48, 0.5, 1.1);

        // a tetradrachm of Ephesus: the bee of Artemis
        const coinTex = canvasTexture(128, 128, (x) => {
            x.fillStyle = '#b9bcc0'; x.fillRect(0, 0, 128, 128);
            x.strokeStyle = '#6a6e74'; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.stroke();
            x.fillStyle = '#6a6e74'; x.beginPath(); x.ellipse(64, 74, 12, 24, 0, 0, 7); x.fill(); x.beginPath(); x.arc(64, 42, 10, 0, 7); x.fill();
            for (const s of [-1, 1]) { x.beginPath(); x.ellipse(64 + s * 26, 60, 20, 9, s * 0.5, 0, 7); x.fill(); }
            x.font = 'bold 22px Georgia, serif'; x.fillText('Ε', 22, 40); x.fillText('Φ', 92, 40);
        });
        const silver = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.35, metalness: 0.9 });
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 24), [silver, new THREE.MeshStandardMaterial({ map: coinTex, roughness: 0.4, metalness: 0.85 }), silver]);
        coin.position.y = 0.004; const cg = new THREE.Group(); cg.add(coin);
        add(cg, P.x + 0.66, P.z + 0.86, 0.4);
        const c2 = cg.clone(); add(c2, P.x + 0.74, P.z + 0.8, 1.9); c2.position.y += 0.004; c2.rotation.z = 0.12;

        // a small bronze stag, the animal of the goddess
        const stag = new THREE.Group();
        stag.add(box(0.2, 0.02, 0.09, m.wood, 0, 0, 0));
        const bodyS = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), m.bronze); bodyS.scale.set(1.9, 1, 0.9); bodyS.position.y = 0.13; stag.add(bodyS);
        for (const [lx, lz] of [[-0.05, -0.02], [-0.05, 0.02], [0.05, -0.02], [0.05, 0.02]]) stag.add(cyl(0.007, 0.006, 0.1, m.bronze, lx, 0.02, lz, 5));
        const neck = cyl(0.014, 0.02, 0.08, m.bronze, 0.07, 0.14, 0, 6); neck.rotation.z = -0.5; stag.add(neck);
        const headS = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m.bronze); headS.scale.set(1.5, 1, 0.9); headS.position.set(0.105, 0.225, 0); stag.add(headS);
        for (const s of [-1, 1]) { const ant = cyl(0.003, 0.004, 0.07, m.gold, 0.095, 0.235, s * 0.012, 4); ant.rotation.x = s * 0.5; stag.add(ant); }
        add(stag, P.x + 0.8, P.z + 0.1, -0.5, 1.2);
    }

    // Gardens: the rules pressed into a clay tablet, a glazed brick from the Ishtar Gate, a water jar and a cylinder seal
    buildGardensMemorabilia(add) {
        const m = materials(), index = WONDERS.findIndex((x) => x.id === 'gardens'), P = this.wonders[index].pos;
        const clay = (x, W, H, title) => {
            x.fillStyle = '#b98a5c'; x.fillRect(0, 0, W, H);
            for (let i = 0; i < 1600; i++) {
                const px = (i * 7919) % W, py = (i * 104729) % H, a = 0.03 + ((i * 31) % 10) / 150;
                x.fillStyle = i % 2 ? `rgba(70,40,15,${a})` : `rgba(255,220,170,${a})`; x.fillRect(px, py, 2 + (i % 4), 2 + (i % 3));
            }
            const g = x.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.8);
            g.addColorStop(0, 'rgba(60,30,5,0)'); g.addColorStop(1, 'rgba(60,30,5,0.4)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
            x.fillStyle = '#4a2c12'; x.textAlign = 'center';
            x.font = '64px "Ancient Tulip", Georgia, serif'; x.fillText('GARDENS', W / 2, 92);
            if (!title) return;
            x.font = 'italic 26px Georgia, serif'; x.fillText('the rules of the game', W / 2, 132);
            // cuneiform: rows of wedges pressed into the clay
            x.strokeStyle = 'rgba(60,34,12,.85)'; x.fillStyle = 'rgba(60,34,12,.8)';
            for (let r = 0; r < 8; r++) {
                const py = 190 + r * 48;
                x.lineWidth = 1.5; x.beginPath(); x.moveTo(50, py + 16); x.lineTo(W - 50, py + 16); x.globalAlpha = 0.35; x.stroke(); x.globalAlpha = 1;
                for (let px = 62; px < W - 70 - (r === 7 ? 150 : 0); px += 15 + ((px * 7 + r * 13) % 12)) {
                    const kind = (px * 3 + r * 5) % 4;
                    x.beginPath();
                    if (kind === 0) { x.moveTo(px, py - 12); x.lineTo(px + 8, py - 12); x.lineTo(px + 4, py + 12); }
                    else if (kind === 1) { x.moveTo(px, py - 7); x.lineTo(px, py + 5); x.lineTo(px + 14, py - 1); }
                    else if (kind === 2) { x.moveTo(px, py - 12); x.lineTo(px + 6, py - 12); x.lineTo(px + 3, py); x.moveTo(px + 6, py); x.lineTo(px + 12, py); x.lineTo(px + 9, py + 12); }
                    else { x.moveTo(px, py + 4); x.lineTo(px + 10, py - 8); x.lineTo(px + 12, py + 2); }
                    x.fill();
                }
            }
        };
        const tex = canvasTexture(512, 640, (x, W, H) => clay(x, W, H, true));
        const clayMat = new THREE.MeshStandardMaterial({ color: 0xb98a5c, roughness: 0.95 });
        const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.035),
            [clayMat, clayMat, clayMat, clayMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffd9a0, emissiveMap: tex, emissiveIntensity: 0 }), clayMat]);
        tablet.rotation.x = -0.5; tablet.position.set(0, 0.215, 0);
        const rest = new THREE.Group(); rest.add(tablet);
        const leg = box(0.26, 0.24, 0.02, m.wood, 0, 0, -0.14); leg.rotation.x = 0.28; rest.add(leg);
        rest.add(box(0.4, 0.025, 0.09, m.wood, 0, 0, 0.1));
        add(rest, P.x + 1.0, P.z + 0.5, -0.3, 0.8);
        tablet.userData.pick = { type: 'rules', index }; tablet.userData.glow = 4; this.pickables.push(tablet);
        this.rulesSheets.push(tablet);
        document.fonts && document.fonts.ready.then(() => { const c = tex.image; clay(c.getContext('2d'), c.width, c.height, true); tex.needsUpdate = true; });

        // a glazed brick: lapis ground, a daisy between yellow bands
        const glaze = canvasTexture(256, 256, (x, W) => {
            x.fillStyle = '#1b4a98'; x.fillRect(0, 0, W, W);
            for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { const k = ((c * 37 + r * 91) % 9) / 9; x.fillStyle = `rgba(${20 + k * 30},${60 + k * 40},${140 + k * 60},0.5)`; x.fillRect(c * 64 - (r % 2) * 32 + 1, r * 32 + 1, 62, 30); }
            x.fillStyle = '#e2b548'; x.fillRect(0, 14, W, 12); x.fillRect(0, W - 26, W, 12);
            for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; x.fillStyle = i % 2 ? '#f4ead0' : '#f0d98c'; x.beginPath(); x.ellipse(128 + Math.cos(t) * 42, 128 + Math.sin(t) * 42, 34, 12, t, 0, 7); x.fill(); }
            x.fillStyle = '#e8b84a'; x.beginPath(); x.arc(128, 128, 17, 0, 7); x.fill();
        });
        const brickMat = new THREE.MeshStandardMaterial({ color: 0xb5895a, roughness: 0.9 });
        const brick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.07), [brickMat, brickMat, brickMat, brickMat, new THREE.MeshPhysicalMaterial({ map: glaze, roughness: 0.25, clearcoat: 0.8 }), brickMat]);
        brick.rotation.x = -0.22; brick.position.y = 0.15;
        const bg = new THREE.Group(); bg.add(brick, box(0.34, 0.02, 0.12, m.wood, 0, 0, 0.01));
        add(bg, P.x + 0.98, P.z - 0.5, 0.35, 0.95);

        // a water jar with a sprig of date palm
        const jar = new THREE.Group();
        const body = new THREE.Mesh(new THREE.LatheGeometry([[0.03, 0], [0.07, 0.03], [0.1, 0.12], [0.085, 0.21], [0.045, 0.26], [0.04, 0.3], [0.055, 0.32]].map(([r, y]) => new THREE.Vector2(r, y)), 20), m.terracotta);
        jar.add(body);
        const sprig = buildPalm(0.5, 0.3); sprig.position.y = 0.22; sprig.scale.setScalar(0.3); jar.add(sprig);
        add(jar, P.x + 0.82, P.z + 0.02, 0.4);

        // a lapis cylinder seal, rolled out across a strip of clay
        const seal = new THREE.Group();
        seal.add(box(0.26, 0.012, 0.085, clayMat, 0, 0, 0));
        const roll = cyl(0.026, 0.026, 0.075, new THREE.MeshPhysicalMaterial({ color: 0x1d3e9c, roughness: 0.25, clearcoat: 1 }), 0, 0, 0, 14);
        roll.rotation.x = Math.PI / 2; roll.position.set(0.09, 0.038, 0); seal.add(roll);
        add(seal, P.x + 0.62, P.z + 0.86, 0.25);
    }

    applyDaylight(d) {
        this.day = d;
        this.key.position.copy(d.keyDir).multiplyScalar(60);
        this.key.color.copy(d.keyColor);
        // sunlight is softened by the glass; at night the moon barely reaches the floor
        this.key.intensity = d.keyPower * (d.night ? 0.5 : 0.85);
        this.hemi.color.copy(d.skyTop).lerp(d.skyHorizon, 0.6 - d.low * 0.3).multiplyScalar(1 + d.low * 1.0);
        this.hemi.groundColor.set(0x8a6a48).multiplyScalar(0.3 + d.ambient);
        this.hemi.intensity = d.ambient * 1.9;
        this.scene.fog.color.copy(d.skyHorizon).multiplyScalar(d.night ? 0.5 : 0.85);
        for (const l of this.lamps) { l.light.intensity = d.lamps * 26; l.globeMat.emissiveIntensity = d.lamps * 3; }
        this.spot.intensity = 5 + d.lamps * 12;
        this.motes.material.uniforms.uColor.value.copy(d.keyColor);
        this.motes.material.uniforms.uOpacity.value = d.night ? 0.25 : 0.7;
    }

    setFocus(i) {
        const w = this.wonders[i];
        this.spotGoal = w.pos;
    }

    pick(raycaster) {
        const hits = raycaster.intersectObjects(this.pickables, false);
        return hits.length ? hits[0].object.userData.pick : null;
    }

    update(dt, camera, hoverRules) {
        this.time += dt;
        this.sky.position.copy(camera.position);
        this.key.target.position.set(0, 1, 0);
        if (this.spotGoal) {
            this.spot.target.position.lerp(this.spotGoal, Math.min(1, dt * 4));
            this.spot.position.set(this.spot.target.position.x, 5.4, this.spot.target.position.z * 1.9);
        }
        this.earth.rotation.y += dt * 0.08;
        for (const sheet of this.rulesSheets) { // the rules glow faintly, and brighter under the pointer
            const mat = sheet.userData.glow ? sheet.material[sheet.userData.glow] : sheet.material;
            const goal = hoverRules === sheet.userData.pick.index ? 0.5 : 0.08 + Math.sin(this.time * 2.2) * 0.06;
            mat.emissiveIntensity += (goal - mat.emissiveIntensity) * Math.min(1, dt * 8);
        }
        const mo = this.motes;
        for (let i = 0; i < mo.n; i++) {
            const j = i * 3;
            mo.pos[j] += Math.sin(this.time * 0.2 + i) * dt * 0.05;
            mo.pos[j + 1] += Math.cos(this.time * 0.15 + i * 1.7) * dt * 0.04 - dt * 0.012;
            if (mo.pos[j + 1] < 0.4) mo.pos[j + 1] = 7.5;
        }
        mo.points.geometry.attributes.position.needsUpdate = true;
    }
}
