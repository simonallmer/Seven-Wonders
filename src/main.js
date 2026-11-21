// SEVEN WONDERS — Version 2. One canvas, two worlds: the Crystal Palace and the wonder you step into.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './render.js';
import { computeDaylight, localHour, applySky, skyUniforms, makeSkyDome, LIGHT_PRESETS } from './daylight.js';
import { PalaceWorld, loopPoint, wonderS, LOOP } from './palace.js';
import { PyramidWorld, STONE_CSS } from './pyramid/scene.js';
import { PyramidGame } from './pyramid/game.js';
import { COLOR_NAMES } from './pyramid/rules.js';
import { KEYWORDS } from './keywords.js';
import { GardensWorld } from './gardens/scene.js';
import { GardensGame } from './gardens/game.js';
import { TempleWorld } from './temple/scene.js';
import { TempleGame } from './temple/game.js';
import { StatueWorld } from './statue/scene.js';
import { StatueGame } from './statue/game.js';
import { MausoleumWorld } from './mausoleum/scene.js';
import { MausoleumGame } from './mausoleum/game.js';
import { ColossusWorld } from './colossus/scene.js';
import { ColossusGame } from './colossus/game.js';
import { PharosWorld } from './pharos/scene.js';
import { PharosGame } from './pharos/game.js';
import { GreatWallWorld } from './greatwall/scene.js';
import { GreatWallGame } from './greatwall/game.js';
import { SkyscraperWorld } from './skyscraper/scene.js';
import { SkyscraperGame } from './skyscraper/game.js';
import { CathedralWorld } from './cathedral/scene.js';
import { CathedralGame } from './cathedral/game.js';
import { WONDERS, ROMAN } from './wonders.js';
import { DEMO } from './edition.js';
import { initAudio, sfx, setAmbience, setMuted, isMuted } from './audio.js';
import { Tweens, ease } from './fx.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const smooth = (k, a, b) => THREE.MathUtils.smoothstep(k, a, b);

// ------------------------------------------------------------------ settings
const SEAT_TYPES = DEMO ? ['human', 'easy'] : ['human', 'easy', 'medium', 'hard'];
const SEAT_LABEL = { human: 'Human', easy: 'CPU · Easy', medium: 'CPU · Medium', hard: 'CPU · Hard' };
const settings = Object.assign(
    { players: 2, seats: [{ type: 'human' }, { type: 'medium' }, { type: 'medium' }, { type: 'medium' }], light: 'live', focus: 0 },
    JSON.parse(localStorage.getItem('sw.v2') || '{}'));
const save = () => localStorage.setItem('sw.v2', JSON.stringify(settings));
if (DEMO) { // the demo: two players, and the computer plays at its easy level
    settings.players = 2;
    settings.seats.forEach((seat, i) => { if (seat.type !== 'easy' && !(i === 0 && seat.type === 'human')) seat.type = i ? 'easy' : 'human'; });
}

// ------------------------------------------------------------------ worlds
const R = createRenderer($('#view'));
const { renderer } = R;
let palace, envRT = null, day = null;
// Every playable wonder: its world, its match and what the panel offers for it.
const GAMES = {
    pyramid: { World: PyramidWorld, Game: PyramidGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/pyramid-symbol.svg' },
    gardens: { World: GardensWorld, Game: GardensGame, players: [2], order: () => [1, 2], sigil: 'assets/gardens-symbol.svg' },
    temple: { World: TempleWorld, Game: TempleGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/temple-symbol.svg' },
    statue: { World: StatueWorld, Game: StatueGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/statue-symbol.svg' },
    mausoleum: { World: MausoleumWorld, Game: MausoleumGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/mausoleum-symbol.svg' },
    colossus: { World: ColossusWorld, Game: ColossusGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/colossus-symbol.svg' },
    pharos: { World: PharosWorld, Game: PharosGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/pharos-symbol.svg' },
    greatWall: { World: GreatWallWorld, Game: GreatWallGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/greatwall-symbol.svg' },
    cathedral: { World: CathedralWorld, Game: CathedralGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/cathedral-symbol.svg' },
    skyscraper: { World: SkyscraperWorld, Game: SkyscraperGame, players: [2, 4], order: (n) => (n === 2 ? [1, 2] : [1, 3, 2, 4]), sigil: 'assets/skyscraper-symbol.svg' },
};
if (DEMO) WONDERS.forEach((w, i) => { if (i >= 7) { w.locked = true; w.playable = false; delete GAMES[w.id]; } }); // the New Wonders belong to Arcade
const live = {};   // id -> { id, def, world, game, controls }, built the first time a wonder is needed
let cur = null;    // the wonder whose world is behind the cross-fade
const playersFor = (def) => (def.players.includes(settings.players) ? settings.players : def.players[0]);
const focusId = () => WONDERS[settings.focus].id;
const panelDef = () => GAMES[focusId()] && state !== 'game' && state !== 'travel' ? GAMES[focusId()] : cur.def;
const tweens = new Tweens();
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(makeSkyDome());

let state = 'intro';
function setState(s) {
    document.body.classList.remove('state-' + state);
    state = s;
    document.body.classList.add('state-' + state);
}

function updateDaylight() {
    const preset = LIGHT_PRESETS.find((p) => p.id === settings.light) || LIGHT_PRESETS[0];
    const hour = preset.hour ?? (params.has('hour') ? parseFloat(params.get('hour')) : localHour());
    day = computeDaylight(hour);
    applySky(day);
    palace.applyDaylight(day);
    for (const L of Object.values(live)) L.world.applyDaylight(day);
    renderer.toneMappingExposure = day.exposure;
    R.bloom.strength = day.night ? 0.4 : 0.3;
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
    palace.scene.environment = envRT.texture;
    for (const L of Object.values(live)) L.world.scene.environment = envRT.texture;
    $('#btn-light').textContent = preset.id === 'live' ? `Live · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}` : preset.label;
}

// ------------------------------------------------------------------ HUD
const hud = {
    update(info) {
        hud.info = info;
        document.querySelectorAll('#seats li').forEach((li, i) => {
            const c = info.order[i];
            li.classList.toggle('turn', info.turn === i);
            li.classList.toggle('out', !!info.out[c]);
            li.querySelector('.seat-score').innerHTML = info.score[c];
            li.querySelector('.seat-name').classList.toggle('thinking', info.turn === i && info.thinking);
        });
        // the whole field as one bar: every player's share, the leader first, and the mark that wins
        const bar = $('#share');
        if (bar) {
            bar.hidden = !info.bar;
            if (info.bar) {
                const { total, need, parts } = info.bar;
                bar.innerHTML = parts.map((p) => `<i style="width:${(p.n / total) * 100}%;background:${p.color}"></i>`).join('') + `<s style="left:${(need / total) * 100}%"></s>`;
                bar.title = parts.map((p) => `${p.name} ${p.n}`).join(' · ') + ` · ${need} of ${total} win`;
            }
        }
    },
    status(text) { $('#status').textContent = text; },
    // one extra thing the player may do right now (Statue's Diminish), or null to take the button away
    // (one label and a function, or a list of { label, fn } for several)
    action(label, fn) {
        const box = $('#actions'), list = !label ? [] : Array.isArray(label) ? label : [{ label, fn }];
        box.hidden = !list.length; box.innerHTML = '';
        for (const a of list) { const b = document.createElement('button'); b.textContent = a.label; b.onclick = () => { initAudio(); a.fn(); }; box.append(b); }
    },
    toast(text, cls = '') {
        const t = $('#toast');
        t.className = cls + (text.length > 10 ? ' small' : '');
        t.textContent = text;
        void t.offsetWidth;
        t.classList.add('show');
    },
    gameOver(title, text) {
        $('#over-title').textContent = title; $('#over-text').textContent = text;
        setTimeout(() => { if (state === 'game' && cur.game.over) $('#gameover').hidden = false; }, 1700);
    },
};
// each match talks to the HUD through this, and is only heard while its wonder is the current one
const hudFor = (id) => Object.fromEntries(['update', 'status', 'toast', 'gameOver', 'action'].map((k) => [k, (...a) => { if (cur && cur.id === id) hud[k](...a); }]));

function ensure(id) {
    if (live[id]) return live[id];
    const def = GAMES[id], world = new def.World();
    world.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1400);
    const controls = new OrbitControls(world.camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: true, screenSpacePanning: true, panSpeed: 0.8, maxPolarAngle: Math.PI * 0.47, enabled: false, rotateSpeed: 0.7 });
    // one finger / left drag turns the view; two fingers (or right drag) pan — the recenter button brings it home
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    const L = live[id] = { id, def, world, controls, game: new def.Game(world, hudFor(id)) };
    L.game.newGame(settings);
    fitGameCamera(L);
    const home = world.homeView();
    world.camera.position.copy(home.pos); controls.target.copy(home.target); world.camera.lookAt(home.target);
    if (day) { world.applyDaylight(day); world.scene.environment = envRT.texture; }
    renderer.compile(world.scene, world.camera);
    return L;
}
// make a wonder the one behind the cross-fade (only while the hall fills the screen)
function setCurrent(id) {
    if (cur && cur.id === id) return cur;
    cur = ensure(id);
    R.worlds.b = cur.world;
    R.worlds.veil.set(cur.world.veil || 0xe2c79a);
    return cur;
}

function renderPanel() {
    const def = panelDef(), n = playersFor(def);
    document.querySelectorAll('#players-seg button').forEach((b) => {
        b.classList.toggle('on', +b.dataset.players === n);
        b.disabled = !def.players.includes(+b.dataset.players);
        b.title = b.disabled ? 'This wonder is a game for two' : '';
        if (DEMO && +b.dataset.players === 4) { b.disabled = false; b.classList.add('arcade'); b.title = 'Four players: unlocked with Arcade'; }
    });
    const order = def.order(n);
    $('#seats').innerHTML = order.map((c, i) => `
        <li><span class="dot" style="background:${STONE_CSS[c]}"></span><span class="seat-name">${COLOR_NAMES[c]}</span>
        <span class="seat-score"></span><button class="seat-type" data-seat="${i}" title="Change who plays ${COLOR_NAMES[c]}">${SEAT_LABEL[settings.seats[i].type]}</button></li>`).join('');
    $('#btn-sound').classList.toggle('off', isMuted());
    if (cur && cur.def === def && cur.game.state && cur.game.state.nPlayers === n) cur.game.refresh();
}

function renderCard() {
    const i = settings.focus, w = WONDERS[i];
    $('#card-side').textContent = `${i < 7 ? 'The Old Wonders' : 'The New Wonders'} · ${ROMAN[i % 7]} of VII`;
    $('#card-name').textContent = w.name;
    $('#card-place').textContent = w.place;
    $('#card-line').textContent = w.line;
    const btn = $('#card-play');
    const g = live[w.id] && live[w.id].game;
    const resume = w.playable && g && g.state && !g.over && g.state.ply > 0 && g.state.nPlayers === playersFor(GAMES[w.id]);
    if (w.locked) $('#card-line').textContent = 'One of the New Seven Wonders. Unlocked with Arcade.';
    btn.textContent = w.locked ? 'Unlock with Arcade' : w.playable ? (resume ? 'Resume' : 'Play') : 'Still in its crate';
    btn.classList.toggle('locked', !w.playable && !w.locked);
}

// ------------------------------------------------------------------ rules papyrus
const RULES = { pyramid: [
    ['h', 'General'],
    ['GOAL', 'Be the first to occupy the four victory fields at the corners of the top step.'],
    ['SETUP', 'Line up your seven stones along one edge of the bottom step, facing your opponent’s. White begins.'],
    ['h', 'Movement'],
    ['', 'Move one of your stones. Stones never move diagonally and never share a field.'],
    ['RUN', 'Move straight across any number of empty fields, along your step or down over its edge, never upward.'],
    ['JUMP', 'Climb onto an empty adjacent field one step up.'],
    ['PUSH', 'Take the place of an adjacent stone on your step, pushing it one field on. The field behind must be empty, so you can never push two stones. A pushed stone cannot push back next turn.'],
    ['h', 'Attacks'],
    ['SMASH', 'Landing on an occupied field through a Run or Push smashes that stone: it is removed and the landing stone takes its place.'],
    ['FALL', 'A stone pushed off the bottom step falls and is removed.'],
    ['OSIRIS', 'Whenever stones are enclosed in a straight line on one step by two opposing stones, with no gap, they are removed.'],
    ['h', 'The End'],
    ['VICTORY', 'The first player with stones on all four victory fields wins. You also win as soon as every rival is down to fewer than four stones.'],
    ['DRAW', 'The game is drawn when no player has four stones left.'],
], cathedral: [
    ['h', 'General'],
    ['GOAL', 'Bring every other congregation below four stones. A congregation of fewer than four falls silent: its stones stay where they are, but it has lost.'],
    ['THE FLOOR', 'A cross of five fields. Stones stand on the crossings and travel along the engraved lines: straight lines everywhere, diagonals only through the strong crossings marked with a rosette.'],
    ['SETUP', 'Each player’s fifteen stones fill the three outer rows of their arm. White begins.'],
    ['h', 'Movement'],
    ['PROCESSION', 'Move one stone along a line over empty fields. It may go as many fields as the longest unbroken line of your own stones standing directly beside it is long. A lone stone always moves one field.'],
    ['PASSAGE', 'A walkway outside each corner of the crossing joins the flanks of two neighbouring arms. Crossing it is a single step, and nothing is converted through it.'],
    ['h', 'Conversion'],
    ['APPROACH', 'End your move directly in front of a rival’s unbroken line that runs on in your direction of travel, and the whole line takes your colour. The line ends where its colour changes or at an empty field. You are never forced to convert.'],
    ['CHAIN', 'After a conversion the same stone may move again, but only to convert again, and never onto a field it has touched this turn. Click your stone to rest.'],
    ['h', 'The End'],
    ['VICTORY', 'The last congregation with four stones or more claims the cathedral.'],
    ['PASS', 'A player who cannot move is passed over. If nobody can move, the largest congregation wins.'],
    ['DRAW', 'The game is drawn when the same position comes a third time.'],
    ['FOUR PLAYERS', 'Red fills the west arm and Blue the east. Play runs White, Red, Black, Blue. Converted stones fight on under their new colour.'],
], skyscraper: [
    ['h', 'General'],
    ['GOAL', 'Light more than your share of the windows: more than half with two players, more than a quarter with four.'],
    ['THE TOWER', 'The board is the outside of the tower, five windows wide on every side, and its roof. Every block is one piece: a corner block has a window on two sides and counts twice, and a block on the edge of the roof shows on the roof and on its side as well. With two players only the five upper floors and the roof are in play; with four, all ten.'],
    ['SETUP', 'Each player starts with one lit window in the middle of their side, on the lowest floor in play. White begins.'],
    ['h', 'Your Turn'],
    ['LIGHT', 'Light one dark window. It must be in line with one of your own lit windows: on the same floor along the same side, straight above or below, or straight through the tower to the opposite side.'],
    ['SHADOW', 'A rival’s window between the two blocks the line. The inside of the tower does not.'],
    ['ELEVATOR', 'You cannot light higher than the elevator has come. It starts one floor above the lowest and rises a floor every round, until the roof is open. The gilt band shows where it stands. When it reaches the roof, the crown of the tower is lifted away.'],
    ['h', 'Captures'],
    ['ROW', 'When a row of five is fully lit — five along one side on one floor, five across the roof, or the five floors of one column — whoever has the most windows in it takes the whole row. A tie leaves it as it is.'],
    ['SPLIT', 'A window may complete several rows at once. Each is judged on its own, and the window that completed them stays yours if you won at least one of them.'],
    ['h', 'The End'],
    ['VICTORY', 'The game ends as soon as a player holds more than their share, or when nobody can light a window; then the player with the most wins.'],
    ['PASS', 'A player who cannot light a window is passed over.'],
], greatWall: [
    ['h', 'General'],
    ['GOAL', 'Bring the rival army below four warriors. The fallen never return.'],
    ['SETUP', 'The walk of the wall is empty. Each army has ten warriors in reserve and a Legendary Field at its end of the wall: White’s in the east, Black’s in the west. White begins.'],
    ['WARRIORS', 'A warrior faces one of eight directions; the dart at his feet shows which. His shield covers his back and both rear flanks.'],
    ['h', 'Your Turn'],
    ['', 'Do one of four things.'],
    ['PLACE', 'Set a warrior from reserve on a field of your supply, facing as you choose.'],
    ['MOVE', 'Walk one warrior up to two fields in any direction, then choose his facing. A walk of two needs an empty field between. He may also stand still and only turn.'],
    ['SHOOT', 'One warrior looses an arrow the way he faces. It flies until it meets a warrior.'],
    ['SPIN', 'One warrior strikes all eight fields around him at once, then chooses a new facing.'],
    ['h', 'Supply'],
    ['CHAIN', 'Your supply chain begins on your Legendary Field and runs on through your warriors, each within two fields of the last, a gap of two needing a field between that no rival holds. You may place on any empty field within such a step of the chain.'],
    ['CUT', 'While a rival stands on your Legendary Field your supply is cut and you cannot place.'],
    ['h', 'Attacks'],
    ['ARROWS', 'An arrow that strikes a warrior anywhere his shield does not cover fells him, and flies on in the direction he was facing. Struck square on the back of a shield it flies straight back; on a rear flank it glances off by a quarter turn.'],
    ['', 'Arrows do not know friend from foe. A warrior shot from the front sends the arrow back at the archer.'],
    ['BLADE', 'A spin fells every neighbour, friend or foe, whose shield does not cover that side.'],
    ['h', 'The End'],
    ['VICTORY', 'An army with fewer than four warriors, on the wall and in reserve together, is beaten. So is an army that can do nothing on its turn.'],
    ['DRAW', 'The game is drawn when the same position comes a third time.'],
    ['FOUR PLAYERS', 'Two walls cross. White holds the south arm, Red the west, Black the north, Blue the east, each with a Legendary Field at its tip. Play runs White, Red, Black, Blue. A beaten army leaves the wall; the last one standing wins.'],
], pharos: [
    ['h', 'General'],
    ['GOAL', 'Leave your rival unable to move a single stone.'],
    ['SETUP', 'White’s ten stones stand in the two end rows, Black’s in the two side columns. The centre and the four corners are beacons, unlit at first. White begins.'],
    ['h', 'Light'],
    ['', 'Stones cannot move by themselves. A stone moves when another stone of its colour, in the same row or column, sends it light.'],
    ['SIGHT', 'Light passes over empty fields and over your own stones. A rival’s stone between the two cuts it off.'],
    ['SPENT', 'Every stone has one light each turn. Once it has sent it, the stone is dark until your next turn.'],
    ['h', 'Movement'],
    ['STEP', 'On your turn, move one stone one field along a row or column for every light it is given. It may take several steps, each paid for by a different light, and may stop after any of them. It must take at least one.'],
    ['ATTACK', 'Step onto a rival’s stone to remove it. A stone may strike several times in one turn. Your own stones block the way.'],
    ['h', 'Beacons'],
    ['KINDLE', 'A stone that steps under a beacon lights it in its colour. It burns in that colour until a rival’s stone steps under it.'],
    ['BEACON LIGHT', 'A lit beacon gives one more light each turn to any stone of its colour in its row or column. No stone can cut this light off. It cannot light the stone standing under it.'],
    ['h', 'The End'],
    ['VICTORY', 'A player who cannot move any stone on their turn has lost.'],
    ['DRAW', 'The game is drawn when the same position comes a third time.'],
    ['FOUR PLAYERS', 'The board is larger and each player holds one edge with seven stones. Play runs White, Red, Black, Blue. Opposite edges are allies: they give each other light and do not strike each other. A player who cannot move is out and their stones are removed. When only two allies are left the alliance ends. One player wins.'],
], colossus: [
    ['h', 'General'],
    ['GOAL', 'Reduce your rival to fewer than four stones by enclosing them: a Hades.'],
    ['SETUP', 'The board is a square with a short arm on each side. Each player’s twelve stones stand in two opposite corners. White begins.'],
    ['h', 'Movement'],
    ['', 'Move one of your stones along a row or column.'],
    ['RUN', 'Go straight over free fields, as far as you like. A stone never passes another.'],
    ['PUSH', 'Take the place of a neighbouring stone, yours or a rival’s, and shove it one field on. The field behind it must be free. A stone that was just pushed is left alone for a turn, and no stone is shoved straight back the way it came.'],
    ['h', 'The Tilt'],
    ['DIRECTION', 'The middle field of each arm, marked with an arrow, is a direction field. As long as a stone stands on one, the board stays tilted that way: after every move, whoever makes it, all stones slide toward that side until the edge or another stone stops them.'],
    ['BALANCE', 'Two opposite direction fields held at once cancel each other: the board is level. With two neighbouring ones held, a field just stepped onto tilts the board first, then the other one once. Two neighbouring fields held from before tilt it diagonally, toward the corner between them.'],
    ['', 'A stone that slides onto a direction field tilts the board again at once.'],
    ['h', 'Attacks'],
    ['HADES', 'Stones of one colour that touch along rows and columns form a group. A group with no free field beside it is removed, whoever it belongs to. The edge of the board closes a group in as well as stones do.'],
    ['', 'A Hades may form by a move or by a slide. Once it has, nothing slides further in that turn.'],
    ['h', 'The End'],
    ['VICTORY', 'A player with fewer than four stones has lost.'],
    ['DRAW', 'The game is drawn when the same position comes a third time.'],
    ['FOUR PLAYERS', 'The board is larger and each player holds one corner with ten stones. Play runs White, Red, Black, Blue. A player below four stones is out; their stones stay where they are. The last one remaining wins.'],
], mausoleum: [
    ['h', 'General'],
    ['GOAL', 'Reduce your rival to fewer than four stones, or leave them no move.'],
    ['SETUP', 'The floor is a network of six-sided slabs. Each player’s nine stones fill the two rows nearest to them. White begins.'],
    ['h', 'Movement'],
    ['', 'Move one of your stones. From every slab, lines run in six directions.'],
    ['GLIDE', 'Slide in a straight line until a stone, a pit or the edge stops you. A gliding stone always goes as far as it can.'],
    ['PUSH', 'Instead, step onto the slab of a neighbouring stone, yours or a rival’s, and shove it one slab on along the same line. The slab behind it must be free. A stone that was just pushed cannot be pushed again on the next turn, and nothing is pushed over the edge.'],
    ['TRAPPED', 'A stone with only one free slab beside it, or none, cannot move at all.'],
    ['h', 'Attacks'],
    ['ENCIRCLE', 'A stone with no free slab beside it falls when more rival stones than friendly ones stand around it. The edge and the pits help to close the ring.'],
    ['COLLAPSE', 'A fallen stone takes its slab with it. The pit stays for the rest of the game: nothing crosses it, and it walls in whoever stands beside it. One collapse may bring down the next.'],
    ['THE PIT', 'A stone pushed into a pit is lost.'],
    ['h', 'The End'],
    ['VICTORY', 'A player with fewer than four stones has lost. So has a player who cannot move on their turn: they are entombed.'],
    ['DRAW', 'The game is drawn when the same position comes a third time.'],
    ['FOUR PLAYERS', 'The floor stretches into a long barrow and each player holds a corner with eight stones. Play runs White, Red, Black, Blue. Every other colour is a rival, so two players can close a ring together. Whoever drops below four stones or is entombed is out, and their stones collapse into pits. The last one standing wins.'],
], statue: [
    ['h', 'General'],
    ['GOAL', 'Reduce your rival to fewer than four dice.'],
    ['SETUP', 'The stones are dice. Each player has eight, all in reserve beside the floor. White begins. The four feet of the throne are not part of the floor.'],
    ['h', 'Your Turn'],
    ['', 'Do one of three things.'],
    ['PLACE', 'Set a die from your reserve on any empty field. It shows 1.'],
    ['STRIDE', 'Move one of your dice as many single steps as it shows, along rows and columns, turning as you like. It must take all its steps unless it can no longer move. Then it grows by one. A 6 that has moved becomes a 1 again.'],
    ['DIMINISH', 'Lower one of your dice above 1 by one pip. Your rival must then spend their turn striding with a die that shows 1. You may only do this if they have such a die and it can move.'],
    ['h', 'Attacks'],
    ['STRIKE', 'A die that steps onto a rival’s die removes it from the game and walks on. Your own dice block your way.'],
    ['ONES', 'A die showing 1 cannot be struck, and no one can step onto it.'],
    ['h', 'The End'],
    ['VICTORY', 'A player left with fewer than four dice, on the floor and in reserve together, has lost.'],
    ['FOUR PLAYERS', 'Two floors are joined, a throne on each, and every player holds a quarter. Play runs White, Red, Black, Blue. You place dice only in your own quarter and never on the joining row, but you stride and strike anywhere. A player below four dice is out and their dice leave the floor; the last one remaining wins. When you diminish, you choose which rival must move.'],
], temple: [
    ['h', 'General'],
    ['GOAL', 'Bring one of your stones to the Artemis field on the far side of the temple floor.'],
    ['SETUP', 'Each player’s nine stones stand in three lines around their own Artemis field. White begins. With four players the floor is a cross with a tip for each, and play runs White, Red, Black, Blue.'],
    ['h', 'Movement'],
    ['', 'Move one stone, following the paths inlaid in the floor. A stone goes forwards or sideways, never back.'],
    ['WALK', 'Step along a path to an empty neighbouring field.'],
    ['LEAP', 'Leap over a neighbouring stone onto the empty field straight behind it. A rival’s stone you leap over is removed; a stone of your own stays. You cannot leap over two stones standing one behind the other.'],
    ['CHAIN', 'After a leap the same stone may leap again, and again, turning by no more than 45° each time. You may stop after any leap.'],
    ['LEAP OF FAITH', 'Where the floor ends behind a rival’s stone, you may leap over it and out of the temple. Both stones are removed.'],
    ['h', 'The End'],
    ['VICTORY', 'The first player with a stone on the opposite Artemis field wins. So does the last player with stones on the floor.'],
    ['PASS', 'A player who cannot move is passed over.'],
    ['DRAW', 'The game is drawn when the same position comes a third time, or when no one can move.'],
], gardens: [
    ['h', 'General'],
    ['GOAL', 'Be the first to bring seven of your stones into your High Garden.'],
    ['SETUP', 'Each player begins with ten stones in a Home Garden, beside the lower field. White begins.'],
    ['THE WAY', 'Your stones cross the lower field into your rival’s Home Garden, are carried up the staircase there, and cross the upper field into your own High Garden, above the garden you started from.'],
    ['h', 'Movement'],
    ['', 'Take one to five of your stones from a garden, or a whole tower with your stone on top, and walk with them.'],
    ['STRIDE', 'Step from field to adjacent field, never diagonally and never back onto a field you have left in this move. On every field you enter you set down the lowest stone in your hand. You may stay where you are and set down more stones there.'],
    ['TOWERS', 'The stone on top commands a tower and takes every stone beneath it along. No tower holds more than five stones, and a full tower closes its field to everyone.'],
    ['CAPTURE', 'Set your stone on a rival’s stone or tower and it is yours. Captured stones stay in the tower until it is moved or taken back.'],
    ['h', 'The Gardens'],
    ['GARDENS', 'Entering a garden ends your move: everything left in your hand is set down there. A garden holds any number of stones, and no stone in a garden can be captured.'],
    ['', 'You may enter both Home Gardens and your own High Garden. Your rival’s High Garden is reached by the staircase alone, and stones that have come home to their High Garden stay there.'],
    ['STAIRS', 'After every turn, stones that outnumber the defenders of a Home Garden climb its staircase to the garden above: the dark stairs carry Black out of White’s garden, the pale stairs carry White out of Black’s. Only the surplus climbs. Four against two send two; when the defenders leave, the rest follow.'],
    ['LIFT', 'If you cannot move at all, choose a tower that holds your stones and lift them to the top. That is your turn.'],
    ['h', 'The End'],
    ['VICTORY', 'The first player with seven stones in their High Garden wins.'],
] };
function openRules(id = state === 'game' ? cur.id : focusId()) {
    if (!$('#rules').hidden || !RULES[id]) return;
    closeKeywords(false);
    sfx('paper');
    $('#rules-title').textContent = WONDERS.find((w) => w.id === id).name;
    $('#rules-sigil').src = GAMES[id].sigil;
    const box = $('#rules-text'); box.innerHTML = '';
    for (const [label, text] of RULES[id]) {
        if (label === 'h') { const h = document.createElement('h3'); h.textContent = text; box.append(h); continue; }
        const p = document.createElement('p');
        if (label) { const b = document.createElement('b'); b.textContent = label; p.append(b, ' '); }
        p.append(text); box.append(p);
    }
    if ($('#rules-keywords')) $('#rules-keywords').onclick = () => { closeRules(false); openKeywords(id); };
    $('#rules').hidden = false;
    $('#rules article').scrollTop = 0; paperBar($('#rules article'));
}
function closeRules(sound = true) { if (!$('#rules').hidden) { $('#rules').hidden = true; if (sound) sfx('paper'); } }

// the papers draw their own thin scroll line instead of the computer's scrollbar
function paperBar(art) {
    let bar = art.querySelector(':scope > .bar');
    if (!bar) { bar = document.createElement('i'); bar.className = 'bar'; art.append(bar); art.addEventListener('scroll', () => paperBar(art), { passive: true }); }
    const { scrollTop: t, scrollHeight: H, clientHeight: h } = art;
    if (H <= h + 1) { bar.style.opacity = 0; return; }
    const len = Math.max(30, h * h / H) - 16;
    bar.style.opacity = 1; bar.style.height = len + 'px';
    bar.style.top = t + 8 + (h - 16 - len) * (t / (H - h)) + 'px';
}
addEventListener('resize', () => document.querySelectorAll('.papyrus').forEach((a) => a.offsetParent && paperBar(a)));

// the register of keywords across the series; those of the wonder in front of you (or the one you play) are marked
const gameName = (g) => (WONDERS.find((w) => w.id === g) || { name: g }).name;
function openKeywords(id = state === 'game' ? cur.id : focusId()) {
    const box = $('#keywords'); if (!box || !box.hidden) return;
    closeRules(false);
    sfx('paper');
    const name = gameName(id);
    $('#keywords-note').innerHTML = '';
    $('#keywords-note').append('Many keywords carry across the series. Those of the ', Object.assign(document.createElement('b'), { textContent: name }), ' are marked.');
    const list = $('#keywords-list'); list.innerHTML = '';
    for (const [section, rows] of KEYWORDS) {
        const h = document.createElement('h3'); h.textContent = section; list.append(h);
        for (const [kw, desc, games] of rows) {
            const row = document.createElement('div'); row.className = 'kw' + (games.includes(id) ? ' mine' : '');
            const b = document.createElement('b'); b.textContent = kw;
            const p = document.createElement('p'); p.textContent = desc;
            const g = document.createElement('small');
            games.forEach((x, i) => { if (i) g.append(' · '); const e = document.createElement(x === id ? 'strong' : 'span'); e.textContent = gameName(x); g.append(e); });
            row.append(b, p, g); list.append(row);
        }
    }
    box.hidden = false;
    $('#keywords article').scrollTop = 0; paperBar($('#keywords article'));
}
function closeKeywords(sound = true) { const box = $('#keywords'); if (box && !box.hidden) { box.hidden = true; if (sound) sfx('paper'); } }

// ------------------------------------------------------------------ the walk around the table
const CAM_R = 1.15 + 3.3, CAM_Y = 1.66, LOOK_Y = 1.5;
let sCam = wonderS(settings.focus), introK = params.has('skip') ? 1 : 0, travelling = false;
const look = new THREE.Vector3(), tmp = new THREE.Vector3(), pointer = new THREE.Vector2(), pointerSoft = new THREE.Vector2();

function browsePose(s, pos, lookAt) {
    loopPoint(s, CAM_R, pos).y = CAM_Y;
    loopPoint(s, 1.15, lookAt).y = LOOK_Y;
}

function setFocus(i, sound = true) {
    settings.focus = (i + WONDERS.length) % WONDERS.length;
    palace.setFocus(settings.focus);
    renderCard(); renderPanel(); save();
    if (sound) sfx('browse');
    // have the wonder's world ready by the time the visitor decides to step in
    const id = focusId();
    clearTimeout(warm);
    if (GAMES[id] && !live[id]) warm = setTimeout(() => { if (state === 'menu' && focusId() === id) { ensure(id); renderCard(); } }, 900);
}
let warm = 0;

function activate() {
    const w = WONDERS[settings.focus];
    if (state !== 'menu') return;
    if (w.locked) { openArcade(); return; }
    if (!w.playable) { sfx('deny'); return; }
    enterGame();
}

function fitGameCamera(L = cur) {
    const lim = L.world.cameraLimits();
    L.controls.minDistance = lim.min; L.controls.maxDistance = lim.max;
}

async function enterGame() {
    const { world, game, controls, def } = setCurrent(focusId());
    setState('travel'); travelling = true;
    sfx('enter');
    if (!game.state || game.over || game.state.nPlayers !== playersFor(def)) game.newGame(settings);
    renderPanel(); game.refresh();
    fitGameCamera();
    const home = world.homeView();
    world.camera.position.copy(home.pos); controls.target.copy(home.target); world.camera.lookAt(home.target);
    const dive = palace.diveView(settings.focus, home);
    const p0 = palace.camera.position.clone(), l0 = look.clone(), fov0 = palace.camera.fov;
    await tweens.run(3.6, (k) => {
        const e = ease.inOut(k);
        palace.camera.position.lerpVectors(p0, dive.pos, e);
        // a slight rise on the way in, like a crane shot
        palace.camera.position.y += Math.sin(Math.PI * e) * 0.25;
        look.lerpVectors(l0, dive.target, ease.out(k));
        palace.camera.fov = fov0 + (world.camera.fov - fov0) * e; palace.camera.updateProjectionMatrix();
        palace.camera.lookAt(look);
        R.worlds.mix = smooth(k, 0.52, 0.98);
    });
    palace.camera.fov = fov0; palace.camera.updateProjectionMatrix();
    R.worlds.mix = 1;
    setState('game');
    controls.enabled = true;
    game.setActive(true);
}

async function leaveGame() {
    if (state !== 'game') return;
    const { world, game, controls, id } = cur, index = WONDERS.findIndex((w) => w.id === id);
    setState('travel');
    game.setActive(false); controls.enabled = false;
    $('#gameover').hidden = true; closeRules(); closeKeywords();
    sfx('leave');
    const home = world.homeView(), g0 = world.camera.position.clone(), t0 = controls.target.clone();
    await tweens.run(0.8, (k) => {
        const e = ease.inOut(k);
        world.camera.position.lerpVectors(g0, home.pos, e);
        world.camera.lookAt(tmp.lerpVectors(t0, home.target, e));
    });
    controls.target.copy(home.target);
    const dive = palace.diveView(index, home), bp = new THREE.Vector3(), bl = new THREE.Vector3();
    setFocus(index, false); sCam = wonderS(index);
    browsePose(sCam, bp, bl);
    const fov0 = palace.camera.fov;
    await tweens.run(2.8, (k) => {
        const e = ease.inOut(k);
        palace.camera.position.lerpVectors(dive.pos, bp, e);
        look.lerpVectors(dive.target, bl, ease.in(k));
        palace.camera.fov = world.camera.fov + (fov0 - world.camera.fov) * e; palace.camera.updateProjectionMatrix();
        palace.camera.lookAt(look);
        R.worlds.mix = 1 - smooth(k, 0.02, 0.45);
    });
    R.worlds.mix = 0; travelling = false;
    setState('menu');
    renderCard(); renderPanel();
}

// ------------------------------------------------------------------ input
function bindUI() {
    $('#players-seg').onclick = (e) => {
        if (DEMO && +e.target.dataset.players === 4) { openArcade(); return; }
        const n = +e.target.dataset.players; if (!n || n === settings.players || e.target.disabled) return;
        settings.players = n; save(); sfx('select');
        palace.setPlayers(n);
        renderPanel(); renderCard();
        if (state === 'game' && cur.game.state.nPlayers !== playersFor(cur.def)) restart();
    };
    $('#seats').onclick = (e) => {
        const i = e.target.dataset.seat; if (i === undefined) return;
        const seat = settings.seats[i];
        seat.type = SEAT_TYPES[(SEAT_TYPES.indexOf(seat.type) + 1) % SEAT_TYPES.length];
        e.target.textContent = SEAT_LABEL[seat.type];
        save(); sfx('tick');
        if (cur.game.state) cur.game.seatsChanged();
    };
    $('#btn-sound').onclick = toggleSound;
    $('#btn-light').onclick = cycleLight;
    $('#btn-rules').onclick = () => openRules();
    $('#btn-restart').onclick = restart;
    $('#btn-leave').onclick = leaveGame;
    // (a browser may still hold last week's page, without the three lines)
    if ($('#btn-menu')) { $('#btn-menu').onclick = () => toggleMenu(); toggleMenu(!settings.menuClosed, false); }
    $('#over-leave').onclick = leaveGame;
    $('#over-again').onclick = restart;
    $('#rules-close').onclick = closeRules;
    $('#rules').onclick = (e) => { if (e.target.id === 'rules') closeRules(); };
    if ($('#keywords')) {
        $('#btn-keywords').onclick = () => openKeywords();
        $('#keywords-close').onclick = () => closeKeywords();
        $('#keywords').onclick = (e) => { if (e.target.id === 'keywords') closeKeywords(); };
    }
    $('#nav-prev').onclick = () => setFocus(settings.focus - 1);
    $('#nav-next').onclick = () => setFocus(settings.focus + 1);
    if ($('#btn-recenter')) $('#btn-recenter').onclick = recenter;
    $('#card-play').onclick = activate;
    $('#intro-enter').onclick = begin;
    if ($('#arcade')) { $('#arcade-close').onclick = closeArcade; $('#arcade').onclick = (e) => { if (e.target.id === 'arcade') closeArcade(); }; }
    if (DEMO) { document.body.classList.add('demo'); document.title = 'Seven Wonders · Demo'; }

    addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key;
        if (state === 'intro') { if ((k === 'Enter' || k === ' ') && !$('#intro-enter').disabled) begin(); return; }
        if (k === 'Escape' && $('#arcade') && !$('#arcade').hidden) { closeArcade(); return; }
        if (k === 'Escape') { if (!$('#rules').hidden) closeRules(); else if ($('#keywords') && !$('#keywords').hidden) closeKeywords(); else if (state === 'game') leaveGame(); return; }
        if (k === 'Tab' && (state === 'game' || state === 'menu')) { e.preventDefault(); return toggleMenu(); }
        if (k === 'm' || k === 'M') return toggleSound();
        if (k === 'l' || k === 'L') return cycleLight();
        if ((k === 'r' || k === 'R') && (state === 'game' || (state === 'menu' && RULES[focusId()]))) return $('#rules').hidden ? openRules() : closeRules();
        if ((k === 'k' || k === 'K') && $('#keywords') && (state === 'game' || state === 'menu')) return $('#keywords').hidden ? openKeywords() : closeKeywords();
        if (state !== 'menu' || !$('#rules').hidden || ($('#keywords') && !$('#keywords').hidden)) return;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') setFocus(settings.focus + 1);
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') setFocus(settings.focus - 1);
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); activate(); }
    });

    const canvas = renderer.domElement, ray = new THREE.Raycaster();
    let down = null, hover = null, hoverAt = 0;
    const cast = (e) => {
        pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        ray.setFromCamera(pointer, state === 'game' ? cur.world.camera : palace.camera);
        return ray;
    };
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; initAudio(); });
    canvas.addEventListener('pointermove', (e) => {
        pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        if (performance.now() - hoverAt < 60 || e.buttons) return;
        hoverAt = performance.now();
        let hot = false;
        if (state === 'menu') { hover = palace.pick(cast(e)); hot = !!hover; }
        else if (state === 'game') hot = cur.game.hot(cur.world.pick(cast(e)));
        canvas.style.cursor = hot ? 'pointer' : state === 'game' ? 'grab' : 'default';
        hoverRules = state === 'menu' && hover && hover.type === 'rules' ? hover.index : -1;
    });
    canvas.addEventListener('pointerup', (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { down = null; return; }
        down = null;
        if (state === 'menu') {
            const hit = palace.pick(cast(e));
            if (!hit) return;
            if (hit.type === 'rules') { if (settings.focus !== hit.index) setFocus(hit.index); openRules(WONDERS[hit.index].id); }
            else if (hit.index === settings.focus) activate();
            else setFocus(hit.index);
        } else if (state === 'game') cur.game.click(cur.world.pick(cast(e)));
    });
    addEventListener('resize', onResize);
}
let hoverRules = -1;

// the demo's one sign: what Arcade unlocks, and where to find it
function openArcade() { if (!$('#arcade')) return; $('#arcade').hidden = false; sfx('paper'); }
function closeArcade() { $('#arcade').hidden = true; sfx('tick'); }
// in a game and in the Exhibition the panel can be folded away behind the three lines
function toggleMenu(open = document.body.classList.contains('menu-closed'), remember = true) {
    if (!$('#btn-menu')) return;
    document.body.classList.toggle('menu-closed', !open);
    $('#btn-menu').setAttribute('aria-expanded', String(open));
    if (remember) { settings.menuClosed = !open; save(); sfx('tick'); }
}
function toggleSound() { initAudio(); setMuted(!isMuted()); $('#btn-sound').classList.toggle('off', isMuted()); }
function cycleLight() {
    const i = LIGHT_PRESETS.findIndex((p) => p.id === settings.light);
    settings.light = LIGHT_PRESETS[(i + 1) % LIGHT_PRESETS.length].id;
    save(); sfx('tick'); updateDaylight();
}
function restart() {
    const { world, game, controls } = cur;
    $('#gameover').hidden = true;
    game.newGame(settings);
    fitGameCamera();
    const home = world.homeView(), g0 = world.camera.position.clone(), t0 = controls.target.clone();
    tweens.run(0.9, (k) => {
        world.camera.position.lerpVectors(g0, home.pos, ease.inOut(k));
        controls.target.lerpVectors(t0, home.target, ease.inOut(k));
    });
    sfx('select');
}

// bring the view back over the board after panning away (the bottom-left center button, handy on a phone)
function recenter() {
    if (state !== 'game') return;
    const { world, controls } = cur;
    fitGameCamera();
    const home = world.homeView(), p0 = world.camera.position.clone(), t0 = controls.target.clone();
    tweens.run(0.7, (k) => {
        const e = ease.inOut(k);
        world.camera.position.lerpVectors(p0, home.pos, e);
        controls.target.lerpVectors(t0, home.target, e);
    });
    sfx('tick');
}

function begin() {
    if (state !== 'intro') return;
    initAudio();
    setState('menu');
    sfx('enter');
    tweens.run(4.2, (k) => { introK = ease.inOut(k); });
}

function onResize() {
    R.resize();
    for (const c of [palace.camera, ...Object.values(live).map((L) => L.world.camera)]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ frame
let last = performance.now(), ambAt = 0;
const perf = { sum: 0, n: 0, level: 0 };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), high = new THREE.Vector3(), shakeOff = new THREE.Vector3();

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt, now);
}

function tick(dt, now) {
    tweens.update(dt);
    const mix = R.worlds.mix, { world, controls } = cur;

    if (!travelling) {
        // glide along the loop toward the wonder in focus, the short way round
        const goal = wonderS(settings.focus);
        const d = ((goal - sCam + LOOP * 1.5) % LOOP) - LOOP / 2;
        sCam += d * (1 - Math.exp(-dt * 3.4));
        browsePose(sCam, camPos, camLook);
        pointerSoft.lerp(pointer, Math.min(1, dt * 3));
        const side = camPos.z >= 0 ? 1 : -1;
        camPos.x += pointerSoft.x * 0.22 * side; camPos.y += pointerSoft.y * 0.1 + Math.sin(now / 2300) * 0.012;
        if (introK < 1) { // opening shot: high under the vault, drifting down to the table
            const a = now / 9000;
            high.set(-13 + Math.sin(a) * 3, 8.5, 12);
            camPos.lerpVectors(high, camPos, introK);
            camLook.lerpVectors(tmp.set(2, 1.5, 0), camLook, introK);
        }
        palace.camera.position.copy(camPos); look.copy(camLook); palace.camera.lookAt(look);
    }
    if (mix < 0.999) palace.update(dt, palace.camera, hoverRules);
    if (mix > 0.001) {
        if (state === 'game') controls.update();
        world.update(dt, world.camera, state === 'game');
    }
    skyUniforms.uTime.value += dt;
    skyUniforms.uHaze.value = world.storm * 0.7 * mix;
    if (now - ambAt > 250) { ambAt = now; setAmbience(mix, world.storm, world.ambience); }

    // impacts jolt the camera for a moment
    const sh = world.shake || 0;
    if (sh > 0.002) {
        shakeOff.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh * 0.5);
        world.camera.position.add(shakeOff); world.shake = sh * Math.exp(-dt * 9);
    } else shakeOff.set(0, 0, 0);

    // slow machine: step the resolution down (only when frames arrive steadily, not in a throttled tab)
    perf.sum += dt; perf.n++;
    if (perf.n >= 120) {
        const avg = perf.sum / perf.n; perf.sum = perf.n = 0;
        if (avg > 0.024 && avg < 0.045 && perf.level < 2 && !document.hidden) {
            perf.level++;
            renderer.setPixelRatio(Math.min(devicePixelRatio || 1, perf.level === 1 ? 1.25 : 1));
            if (perf.level === 2) R.bloom.enabled = false;
            R.resize();
        }
    }
    R.grade.uniforms.uTime.value = now / 1000;
    R.grade.uniforms.uVignette.value = 1.15 - mix * 0.35;
    R.composer.render(dt);
    world.camera.position.sub(shakeOff);
}

// ------------------------------------------------------------------ boot
async function boot() {
    try { await document.fonts.load('58px "Ancient Tulip"'); } catch (e) { /* fall back to Georgia */ }
    await new Promise((r) => setTimeout(r, 30)); // let the title screen paint first
    palace = new PalaceWorld();
    palace.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 900);
    await new Promise((r) => setTimeout(r, 0));
    // ?play steps straight into Pyramid, ?play=gardens into another wonder
    const want = WONDERS.findIndex((w) => w.id === params.get('play'));
    if (params.has('play')) settings.focus = want >= 0 && GAMES[params.get('play')] ? want : 0;
    R.worlds.a = palace;
    palace.setPlayers(settings.players);
    setCurrent(GAMES[focusId()] ? focusId() : 'pyramid');
    updateDaylight();
    setInterval(() => { if (settings.light === 'live' && !params.has('hour')) updateDaylight(); }, 60000);

    bindUI(); renderPanel(); setFocus(settings.focus, false); onResize();
    renderer.compile(palace.scene, palace.camera);
    requestAnimationFrame(frame);

    const btn = $('#intro-enter'); btn.disabled = false; btn.textContent = 'Enter the Exhibition';
    // handle for the console and for automated checks: advance(seconds) steps the simulation at 30 fps
    window.sevenWonders = { settings, palace, live, get world() { return cur.world; }, get game() { return cur.game; }, enterGame, leaveGame, setFocus, openRules, closeRules, openKeywords, closeKeywords, R,
        advance(sec) { for (let i = 0; i < sec * 30; i++) tick(1 / 30, performance.now()); } };
    if (params.has('skip')) { setState('menu'); if (params.has('play')) enterGame(); }
}

boot().catch((err) => {
    console.error(err);
    const btn = $('#intro-enter'); btn.textContent = 'This browser cannot open the hall (WebGL 2 is needed)';
});
