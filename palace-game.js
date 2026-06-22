// ============================================
// PALACE — "The Span"  (Crystal Palace, Hyde Park 1851)
// ============================================
// THE RACE:
//   Both players race a stone from their home end of the nave to the OPPOSITE
//   end. Black starts west (x=0) and must reach x=6; White starts east and
//   must reach x=0. First stone across wins.
//
// MOVES:
//   RUN — roll in a straight line; land on an enemy = capture.
//
//   The Crystal Palace structure is a visual backdrop — stones move on the
//   ground level through the open nave.
// ============================================

const PAL_W = 7;
const PAL_D = 5;
const PAL_ROW_LEVEL = [1, 2, 3, 2, 1];
const PAL_MAXK = 3;
const PAL_POOL_START = 10;

function palLevel(x, y) {
    return PAL_ROW_LEVEL[y];
}
function palIsRidge(x, y) { return palLevel(x, y) >= 3; }
function palIsPortal(x, y) {
    return (y === 2 && (x === 0 || x === PAL_W - 1));
}
function palInBounds(x, y) { return x >= 0 && x < PAL_W && y >= 0 && y < PAL_D; }
function palLevelSafe(x, y) { return palInBounds(x, y) ? palLevel(x, y) : 0; }

const PAL_SIDES = [
    { face: 'px', dx: 1, dz: 0 }, { face: 'nx', dx: -1, dz: 0 },
    { face: 'pz', dx: 0, dz: 1 }, { face: 'nz', dx: 0, dz: -1 }
];
const PAL_DIRS = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];

function palFieldId(face, x, y, k) { return face + ':' + x + ',' + y + ',' + k; }
function palParseField(id) { const a = id.split(':'), p = a[1].split(','); return { face: a[0], x: +p[0], y: +p[1], k: +p[2] }; }

function palFields() {
    const out = [];
    for (let x = 0; x < PAL_W; x++) for (let y = 0; y < PAL_D; y++) {
        const L = palLevel(x, y);
        out.push({ face: 'top', x: x, y: y, k: L - 1, id: palFieldId('top', x, y, L - 1) });
        if (palMode3D) {
            for (let k = 0; k < L; k++) PAL_SIDES.forEach(function (s) {
                if (palLevelSafe(x + s.dx, y + s.dz) <= k) out.push({ face: s.face, x: x, y: y, k: k, id: palFieldId(s.face, x, y, k) });
            });
        }
    }
    return out;
}

// ---- voxel (kept for 3D rendering — not used for gameplay) ----
function palSolidAt(x, y, k) { return palInBounds(x, y) && k >= 0 && k < palLevel(x, y); }

function palPlaceInfo(id) {
    if (palBoard[id]) return 'stone';
    return 'empty';
}

// ---- state ----
let palBoard = {};
let palColor = 'W';
let palPool = { W: PAL_POOL_START, B: PAL_POOL_START };
let palHeld = null;
let palMode3D = false;

let palPhase = 'setup';
let palPlay = [];
let palTurn = 'W';
let palSel = null;
let palWinner = null;
let palNextId = 1;

// ---- SETUP ----
function palSetColor(c) { if (c === 'W' || c === 'B') { palColor = c; refreshPal(); } }
function palToggleColor() { palSetColor(palColor === 'W' ? 'B' : 'W'); }
function palSetMode3D(on) { if (palPhase !== 'setup') return; palMode3D = !!on; palHeld = null; if (window.palaceRebuildPads) window.palaceRebuildPads(); refreshPal(); }
function palToggleMode() { palSetMode3D(!palMode3D); }

function palTapField(id) {
    if (!id || palPhase !== 'setup') return;
    const cur = palBoard[id];
    if (palHeld) {
        if (id === palHeld) { palHeld = null; refreshPal(); return; }
        const heldColor = palBoard[palHeld].color;
        if (cur) { flashPal('That space is occupied'); return; }
        palBoard[id] = palBoard[palHeld]; delete palBoard[palHeld];
        const from = palHeld; palHeld = null;
        if (window.palaceAnimMove) window.palaceAnimMove(from, id);
        refreshPal(); return;
    }
    if (cur) { palHeld = id; refreshPal(); return; }
    if (palPool[palColor] <= 0) { flashPal((palColor === 'W' ? 'White' : 'Black') + ' pool is empty'); return; }
    palBoard[id] = { color: palColor }; palPool[palColor]--;
    if (window.palaceAnimPlace) window.palaceAnimPlace(id);
    refreshPal();
}
function palTap(x, y) { if (palInBounds(x, y)) palTapField(palFieldId('top', x, y, palLevel(x, y) - 1)); }
function palClear() {
    if (palPhase === 'play') { palEndPlay(); return; }
    palBoard = {}; palHeld = null; palPool = { W: PAL_POOL_START, B: PAL_POOL_START };
    if (window.palaceRebuild) window.palaceRebuild();
    refreshPal();
}

// 7 white stones on row 0 (south), 7 black stones on row 4 (north), one per field
function palSeedRace() {
    palBoard = {};
    palPool = { W: PAL_POOL_START, B: PAL_POOL_START };
    for (let x = 0; x < PAL_W; x++) {
        palBoard[palFieldId('top', x, 0, 0)] = { color: 'W' };
        palPool.W--;
        palBoard[palFieldId('top', x, PAL_D - 1, 0)] = { color: 'B' };
        palPool.B--;
    }
}

// ---- stone helpers (flat board — k for 3D rendering only) ----
function palStoneAt(x, y) { return palPlay.find(function (s) { return s.x === x && s.y === y; }) || null; }

// RUN: roll in a straight line on the flat board; land on enemy = capture.
function palRunTargets(s) {
    const out = [];
    PAL_DIRS.forEach(function (d) {
        let cx = s.x, cy = s.y;
        for (let step = 0; step < 40; step++) {
            const nx = cx + d.dx, ny = cy + d.dz;
            if (!palInBounds(nx, ny)) break;
            const occ = palStoneAt(nx, ny);
            if (occ) {
                if (occ.color !== s.color) out.push({ x: nx, y: ny, k: palLevel(nx, ny), type: 'run', capture: occ.id });
                break;
            }
            out.push({ x: nx, y: ny, k: palLevel(nx, ny), type: 'run' });
            cx = nx; cy = ny;
        }
    });
    return out;
}

function palLegalForSelected() {
    const s = palPlay.find(function (p) { return p.id === palSel; });
    if (!s) return [];
    return palRunTargets(s);
}

function palStartPlay() {
    palPlay = []; palNextId = 1; palWinner = null;
    Object.keys(palBoard).forEach(function (id) {
        const f = palParseField(id);
        const st = { color: palBoard[id].color, x: f.x, y: f.y, k: palLevel(f.x, f.y), id: palNextId++ };
        palPlay.push(st);
    });
    palPhase = 'play'; palTurn = 'W'; palSel = null;
    if (window.palaceEnterPlay) window.palaceEnterPlay();
    refreshPal();
}
function palEndPlay() { palPhase = 'setup'; palSel = null; palPlay = []; palWinner = null; if (window.palaceEnterSetup) window.palaceEnterSetup(); refreshPal(); }
function palTogglePhase() { if (palPhase === 'setup') { if (!Object.keys(palBoard).length) { flashPal('Place some stones first'); return; } palStartPlay(); } else palEndPlay(); }

function palCheckWin(s) {
    return null; // win condition removed for now
}

function palPlayTapStone(id) {
    if (palWinner) return;
    const s = palPlay.find(function (p) { return p.id === id; }); if (!s) return;
    if (s.color !== palTurn) { flashPal((palTurn === 'W' ? 'White' : 'Black') + ' to move'); return; }
    palSel = (palSel === id) ? null : id;
    refreshPal();
}
function palPlayTapTarget(t) {
    if (palWinner) return;
    const s = palPlay.find(function (p) { return p.id === palSel; }); if (!s) return;
    if (t.capture != null) {
        const ci = palPlay.findIndex(function (p) { return p.id === t.capture; });
        if (ci >= 0) palPlay.splice(ci, 1);
        if (window.palaceAnimCapture) window.palaceAnimCapture(t.capture);
    }
    const from = { x: s.x, y: s.y, k: s.k };
    s.x = t.x; s.y = t.y; s.k = palLevel(t.x, t.y);
    if (window.palaceAnimStoneMove) window.palaceAnimStoneMove(s.id, from, { x: t.x, y: t.y, k: s.k }, 'run');
    const w = palCheckWin(s);
    if (w) { palWinner = w; palSel = null; refreshPal(); if (window.palaceWin) window.palaceWin(w); }
    else palAfterMove();
}
function palAfterMove() { palSel = null; palTurn = palTurn === 'W' ? 'B' : 'W'; refreshPal(); }

// ---- state out ----
function getPalState() {
    if (palPhase === 'play') {
        const sel = palPlay.find(function (p) { return p.id === palSel; });
        return {
            phase: 'play', turn: palTurn, selected: palSel, winner: palWinner,
            stones: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
            targets: (sel && !palWinner) ? palLegalForSelected() : [],
            goalW: 0, goalB: PAL_W - 1, W: PAL_W, D: PAL_D
        };
    }
    const setupStones = Object.keys(palBoard).map(function (id) { const f = palParseField(id); return { id: id, face: f.face, x: f.x, y: f.y, k: f.k, color: palBoard[id].color }; });
    return { phase: 'setup', stones: setupStones, color: palColor, held: palHeld, mode3D: palMode3D, pool: { W: palPool.W, B: palPool.B }, goalW: 0, goalB: PAL_W - 1, W: PAL_W, D: PAL_D };
}

function refreshPal() {
    if (window.palaceSync3D) window.palaceSync3D();
    const setupChips = document.getElementById('setup-chips'); if (setupChips) setupChips.style.display = palPhase === 'setup' ? '' : 'none';
    const phaseChip = document.getElementById('chip-phase'); if (phaseChip) phaseChip.textContent = palPhase === 'setup' ? '▶ Play' : '◀ Setup';
    const wp = document.getElementById('w-pool'); if (wp) wp.textContent = palPool.W;
    const bp = document.getElementById('b-pool'); if (bp) bp.textContent = palPool.B;
    document.querySelectorAll('.action-chip[data-color]').forEach(function (ch) { ch.classList.toggle('active', ch.dataset.color === palColor); });
    const modeChip = document.getElementById('chip-mode'); if (modeChip) { modeChip.textContent = 'Walls: ' + (palMode3D ? 'On' : 'Off'); modeChip.classList.toggle('active', palMode3D); }
    const playChips = document.getElementById('play-chips');
    if (playChips) playChips.style.display = palPhase === 'play' ? '' : 'none';

    const ind = document.getElementById('player-indicator');
    const nm = document.getElementById('player-name');
    const prompt = document.getElementById('action-prompt');
    if (palPhase === 'play') {
        if (palWinner) {
            if (ind) ind.className = 'player-indicator ' + (palWinner === 'W' ? 'white' : 'black');
            if (nm) nm.textContent = (palWinner === 'W' ? 'White' : 'Black') + ' wins!';
            if (prompt) prompt.textContent = (palWinner === 'W' ? 'White' : 'Black') + ' reached the far end. Reset to race again.';
        } else {
            if (ind) ind.className = 'player-indicator ' + (palTurn === 'W' ? 'white' : 'black');
            if (nm) nm.textContent = (palTurn === 'W' ? 'White' : 'Black') + " to move";
            if (prompt) prompt.textContent = !palSel
                ? (palTurn === 'W' ? 'White' : 'Black') + ' — tap one of your stones (race to the far end)'
                : 'Blue circles — run to move (capture enemy stones by landing on them)';
        }
    } else {
        if (ind) ind.className = 'player-indicator ' + (palColor === 'W' ? 'white' : 'black');
        if (nm) nm.textContent = 'Placing ' + (palColor === 'W' ? 'White' : 'Black');
        if (prompt) prompt.textContent = palHeld ? 'Holding a stone — tap a field to place it (tap again to cancel)'
            : '▶ Play to race · or arrange stones — tap a field to set a ' + (palColor === 'W' ? 'white' : 'black') + ' stone';
    }
}
function flashPal(msg) {
    const el = document.getElementById('game-message'); if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(window._palMsgT); window._palMsgT = setTimeout(function () { el.classList.add('hidden'); }, 1700);
}

palSeedRace();

window.palPlaceInfo = palPlaceInfo;
window.getPalState = getPalState;
window.palTap = palTap;
window.palTapField = palTapField;
window.palFields = palFields;
window.palParseField = palParseField;
window.palFieldId = palFieldId;
window.palLevel = palLevel;
window.palIsRidge = palIsRidge;
window.palIsPortal = palIsPortal;
window.palSolidAt = palSolidAt;
window.palSetColor = palSetColor;
window.palToggleColor = palToggleColor;
window.palSetMode3D = palSetMode3D;
window.palToggleMode = palToggleMode;
window.palClear = palClear;
window.palTogglePhase = palTogglePhase;
window.palStartPlay = palStartPlay;
window.palEndPlay = palEndPlay;
window.palPlayTapStone = palPlayTapStone;
window.palPlayTapTarget = palPlayTapTarget;
window.refreshPal = refreshPal;
