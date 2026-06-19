// ============================================
// PALACE — "The Span"  (Crystal Palace, Hyde Park 1851)
// ============================================
// THE RACE (soul of the game):
//   Both players race a stone from their home end of the nave to the OPPOSITE
//   end. Black starts west (x=0) and must reach x=14; White starts east and
//   must reach x=0. First stone across wins. Mirror-equal — never asymmetric.
//
//   The TRANSEPT is a tall glass wall straight across the middle. No lane gets
//   over it (jump is only +1). The ONLY way through is to SHATTER the glass —
//   and that opening is permanent AND shared: the hole you break to advance is
//   the same hole your opponent can pour through. Every break is a gift.
//
// MOVES:
//   RUN     — roll in a straight line; fall down ledges (Pyramid). Land on an
//             enemy from above = capture. Walls and same-level stones block.
//   JUMP    — hop up exactly one level at an edge (never two: a 2-step is a trap).
//   SHATTER — break one glass block (a wall cube at your level, or the block
//             under your feet -> you drop one level). Permanent. Shared.
//
//   You can never END a turn enclosed inside the building — only pass through.
// ============================================

const PAL_W = 15;          // length (x), the nave
const PAL_D = 5;           // depth  (y)
const PAL_TRANSEPT = 7;    // centre column
const PAL_ROW_LEVEL = [1, 2, 3, 2, 1];
const PAL_TRANSEPT_LEVEL = 5;   // tall central wall — blocks every lane
const PAL_MAXK = 5;
const PAL_POOL_START = 24;

function palLevel(x, y) {
    if (x === PAL_TRANSEPT) return PAL_TRANSEPT_LEVEL;
    return PAL_ROW_LEVEL[y];
}
function palIsRidge(x, y) { return palLevel(x, y) >= 3; }
function palIsPortal(x, y) {
    return (y === 2 && (x === 0 || x === PAL_W - 1)) ||
           (x === PAL_TRANSEPT && (y === 0 || y === PAL_D - 1));
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

// ---- contested space (setup capture only) ----
function palSpaceOf(f) {
    if (f.face === 'top') return f.x + ',' + f.y + ',' + (f.k + 1);
    const s = PAL_SIDES.find(function (q) { return q.face === f.face; });
    return (f.x + s.dx) + ',' + (f.y + s.dz) + ',' + f.k;
}
function palOccupantOfSpace(spaceKey, exceptId) {
    for (const id in palBoard) { if (id === exceptId) continue; if (palSpaceOf(palParseField(id)) === spaceKey) return { id: id, color: palBoard[id].color }; }
    return null;
}
function palPlaceInfo(id) {
    if (palBoard[id]) return 'stone';
    const occ = palOccupantOfSpace(palSpaceOf(palParseField(id)), null);
    if (!occ) return 'empty';
    return occ.color === palColor ? 'blocked' : 'capture';
}
function palCapture(id) {
    const c = palBoard[id]; if (!c) return;
    palPool[c.color] = Math.min(PAL_POOL_START, palPool[c.color] + 1);
    delete palBoard[id];
    if (window.palaceAnimRemove) window.palaceAnimRemove(id);
}

// ---- state ----
let palBoard = {};
let palColor = 'W';
let palPool = { W: PAL_POOL_START, B: PAL_POOL_START };
let palHeld = null;
let palMode3D = false;

let palPhase = 'setup';
let palShattered = {};
let palPlay = [];
let palTurn = 'W';
let palSel = null;
let palPlayMode = 'move';
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
        const blocker = cur ? { id: id, color: cur.color } : palOccupantOfSpace(palSpaceOf(palParseField(id)), palHeld);
        if (blocker) { if (blocker.color === heldColor) { flashPal('That space is held by your own stone'); return; } palCapture(blocker.id); }
        palBoard[id] = palBoard[palHeld]; delete palBoard[palHeld];
        const from = palHeld; palHeld = null;
        if (window.palaceAnimMove) window.palaceAnimMove(from, id);
        refreshPal(); return;
    }
    if (cur) { palHeld = id; refreshPal(); return; }
    const blocker = palOccupantOfSpace(palSpaceOf(palParseField(id)), null);
    if (blocker && blocker.color === palColor) { flashPal('That space is held by your own stone'); return; }
    if (palPool[palColor] <= 0) { flashPal((palColor === 'W' ? 'White' : 'Black') + ' pool is empty'); return; }
    if (blocker) palCapture(blocker.id);
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

// seed the race start position (Black west, White east; two L1 lanes + the ridge)
function palSeedRace() {
    palBoard = {};
    [['B', 0, 0], ['B', 0, 4], ['B', 0, 2], ['W', 14, 0], ['W', 14, 4], ['W', 14, 2]].forEach(function (e) {
        palBoard[palFieldId('top', e[1], e[2], palLevel(e[1], e[2]) - 1)] = { color: e[0] };
    });
}

// ---- voxel / engine ----
function palSolidAt(x, y, k) { return palInBounds(x, y) && k >= 0 && k < palLevel(x, y) && !palShattered[x + ',' + y + ',' + k]; }
function palSupport(x, y, k) { return k === 0 || palSolidAt(x, y, k - 1); }
function palAirAt(x, y, k) { return palInBounds(x, y) && k >= 0 && !palSolidAt(x, y, k); }
function palStoneAt(x, y, k) { return palPlay.find(function (s) { return s.x === x && s.y === y && s.k === k; }) || null; }
function palStoneById(id) { return palPlay.find(function (s) { return s.id === id; }) || null; }
function palOpenAbove(x, y, k) { for (let kk = k + 1; kk <= PAL_MAXK; kk++) if (palSolidAt(x, y, kk)) return false; return true; }
function palResting(x, y, k) { return palAirAt(x, y, k) && palSupport(x, y, k) && palOpenAbove(x, y, k) && !palStoneAt(x, y, k); }

function palSettleField(id, color) {
    const f = palParseField(id);
    let tx, ty, ks;
    if (f.face === 'top') { tx = f.x; ty = f.y; ks = palLevel(f.x, f.y); }
    else { const s = PAL_SIDES.find(function (q) { return q.face === f.face; }); tx = f.x + s.dx; ty = f.y + s.dz; ks = f.k; if (!palInBounds(tx, ty)) { tx = f.x; ty = f.y; ks = palLevel(f.x, f.y); } }
    let kk = ks; while (kk > 0 && !palSolidAt(tx, ty, kk - 1)) kk--;
    return { color: color, x: tx, y: ty, k: kk };
}
function palStartPlay() {
    palShattered = {}; palPlay = []; palNextId = 1; palWinner = null;
    Object.keys(palBoard).forEach(function (id) {
        const st = palSettleField(id, palBoard[id].color);
        while (palStoneAt(st.x, st.y, st.k)) st.k++;
        st.id = palNextId++; palPlay.push(st);
    });
    palPhase = 'play'; palTurn = 'W'; palSel = null; palPlayMode = 'move';
    if (window.palaceEnterPlay) window.palaceEnterPlay();
    refreshPal();
}
function palEndPlay() { palPhase = 'setup'; palSel = null; palShattered = {}; palPlay = []; palWinner = null; if (window.palaceEnterSetup) window.palaceEnterSetup(); refreshPal(); }
function palTogglePhase() { if (palPhase === 'setup') { if (!Object.keys(palBoard).length) { flashPal('Place some stones first'); return; } palStartPlay(); } else palEndPlay(); }

// RUN: roll in a direction, falling down ledges; land-on-enemy-from-above captures.
function palRunTargets(s) {
    const out = [];
    PAL_DIRS.forEach(function (d) {
        let cx = s.x, cy = s.y, ck = s.k;
        for (let step = 0; step < 40; step++) {
            const nx = cx + d.dx, ny = cy + d.dz;
            if (!palInBounds(nx, ny)) break;
            if (palSolidAt(nx, ny, ck)) break;                 // wall at this level — can't run up
            let lk = ck; while (lk > 0 && !palSolidAt(nx, ny, lk - 1)) lk--;  // fall to floor
            const occ = palStoneAt(nx, ny, lk);
            if (occ) {
                if (lk < ck && occ.color !== s.color) out.push({ x: nx, y: ny, k: lk, type: 'run', capture: occ.id }); // crash down onto enemy
                break;                                          // either captured-stop or blocked
            }
            if (palResting(nx, ny, lk)) out.push({ x: nx, y: ny, k: lk, type: 'run' });
            cx = nx; cy = ny; ck = lk;                          // keep rolling
        }
    });
    return out;
}
// JUMP: up exactly one level onto an adjacent block (run handles all descent).
function palJumpTargets(s) {
    const out = [];
    PAL_DIRS.forEach(function (d) {
        const nx = s.x + d.dx, ny = s.y + d.dz;
        if (palInBounds(nx, ny) && palSolidAt(nx, ny, s.k) && palResting(nx, ny, s.k + 1)) out.push({ x: nx, y: ny, k: s.k + 1, type: 'jump' });
    });
    return out;
}
function palShatterTargets(s) {
    const out = [];
    if (s.k > 0 && palSolidAt(s.x, s.y, s.k - 1)) out.push({ type: 'shatter', self: true, x: s.x, y: s.y, k: s.k - 1 });
    PAL_DIRS.forEach(function (d) {
        const nx = s.x + d.dx, ny = s.y + d.dz;
        if (palSolidAt(nx, ny, s.k)) out.push({ type: 'shatter', self: false, x: nx, y: ny, k: s.k, dx: d.dx, dz: d.dz });
    });
    return out;
}
function palLegalForSelected() {
    const s = palStoneById(palSel); if (!s) return [];
    if (palPlayMode === 'shatter') return palShatterTargets(s);
    return [].concat(palRunTargets(s), palJumpTargets(s));
}
function palSettleAll() {
    const drops = [];
    palPlay.forEach(function (s) {
        const from = { x: s.x, y: s.y, k: s.k };
        while (s.k > 0 && !palSolidAt(s.x, s.y, s.k - 1)) s.k--;
        while (palPlay.some(function (o) { return o !== s && o.x === s.x && o.y === s.y && o.k === s.k; })) s.k++;
        if (from.k !== s.k) drops.push({ id: s.id, from: from, to: { x: s.x, y: s.y, k: s.k } });
    });
    return drops;
}

function palCheckWin(s) {
    if (s.color === 'B' && s.x === PAL_W - 1) return 'B';
    if (s.color === 'W' && s.x === 0) return 'W';
    return null;
}
function palPlayTapStone(id) {
    if (palWinner) return;
    const s = palStoneById(id); if (!s) return;
    if (s.color !== palTurn) { flashPal((palTurn === 'W' ? 'White' : 'Black') + ' to move'); return; }
    palSel = (palSel === id) ? null : id; palPlayMode = 'move';
    refreshPal();
}
function palToggleShatterMode() {
    if (palPhase !== 'play' || palWinner) return;
    if (palSel == null) { flashPal('Select a stone first'); return; }
    palPlayMode = (palPlayMode === 'shatter') ? 'move' : 'shatter';
    refreshPal();
}
function palPlayTapTarget(t) {
    if (palWinner) return;
    const s = palStoneById(palSel); if (!s) return;
    if (t.type === 'run' || t.type === 'jump') {
        if (t.capture != null) {
            const ci = palPlay.findIndex(function (p) { return p.id === t.capture; });
            if (ci >= 0) palPlay.splice(ci, 1);
            if (window.palaceAnimCapture) window.palaceAnimCapture(t.capture);
        }
        const from = { x: s.x, y: s.y, k: s.k };
        s.x = t.x; s.y = t.y; s.k = t.k;
        if (window.palaceAnimStoneMove) window.palaceAnimStoneMove(s.id, from, { x: t.x, y: t.y, k: t.k }, t.type);
        const w = palCheckWin(s);
        if (w) { palWinner = w; palSel = null; palPlayMode = 'move'; refreshPal(); if (window.palaceWin) window.palaceWin(w); }
        else palAfterMove();
    } else if (t.type === 'shatter') {
        palDoShatter(s, t);
    }
}
function palDoShatter(s, t) {
    const broken = [];
    const key = t.x + ',' + t.y + ',' + t.k;
    if (palSolidAt(t.x, t.y, t.k)) { palShattered[key] = true; broken.push(key); }
    const drops = palSettleAll();
    if (window.palaceAnimShatter) window.palaceAnimShatter(broken, drops);
    // a fall from a self-shatter could carry you off the edge — check win on the actor
    const w = palCheckWin(s);
    if (w) { palWinner = w; palSel = null; palPlayMode = 'move'; refreshPal(); if (window.palaceWin) window.palaceWin(w); }
    else palAfterMove();
}
function palAfterMove() { palSel = null; palPlayMode = 'move'; palTurn = palTurn === 'W' ? 'B' : 'W'; refreshPal(); }

// ---- state out ----
function getPalState() {
    if (palPhase === 'play') {
        const sel = palStoneById(palSel);
        return {
            phase: 'play', turn: palTurn, selected: palSel, playMode: palPlayMode, winner: palWinner,
            stones: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
            shattered: Object.keys(palShattered),
            targets: (sel && !palWinner) ? palLegalForSelected() : [],
            goalW: 0, goalB: PAL_W - 1, W: PAL_W, D: PAL_D
        };
    }
    const stones = Object.keys(palBoard).map(function (id) { const f = palParseField(id); return { id: id, face: f.face, x: f.x, y: f.y, k: f.k, color: palBoard[id].color }; });
    return { phase: 'setup', stones: stones, color: palColor, held: palHeld, mode3D: palMode3D, pool: { W: palPool.W, B: palPool.B }, goalW: 0, goalB: PAL_W - 1, W: PAL_W, D: PAL_D, transept: PAL_TRANSEPT };
}

function refreshPal() {
    if (window.palaceSync3D) window.palaceSync3D();
    const setupChips = document.getElementById('setup-chips'); if (setupChips) setupChips.style.display = palPhase === 'setup' ? '' : 'none';
    const phaseChip = document.getElementById('chip-phase'); if (phaseChip) phaseChip.textContent = palPhase === 'setup' ? '▶ Play' : '◀ Setup';
    const wp = document.getElementById('w-pool'); if (wp) wp.textContent = palPool.W;
    const bp = document.getElementById('b-pool'); if (bp) bp.textContent = palPool.B;
    document.querySelectorAll('.action-chip[data-color]').forEach(function (ch) { ch.classList.toggle('active', ch.dataset.color === palColor); });
    const modeChip = document.getElementById('chip-mode'); if (modeChip) { modeChip.textContent = 'Walls: ' + (palMode3D ? 'On' : 'Off'); modeChip.classList.toggle('active', palMode3D); }
    const shatterChip = document.getElementById('chip-shatter'); const playChips = document.getElementById('play-chips');
    if (playChips) playChips.style.display = palPhase === 'play' ? '' : 'none';
    if (shatterChip) shatterChip.classList.toggle('active', palPlayMode === 'shatter');

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
                : (palPlayMode === 'shatter'
                    ? 'Shatter armed — tap a red block to break it (it opens for both players!)'
                    : 'Blue Run · green Jump · or press Shatter to break through the glass wall');
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

// seed the race so the demo is ready the moment it loads
palSeedRace();

window.getPalState = getPalState;
window.palTap = palTap;
window.palTapField = palTapField;
window.palPlaceInfo = palPlaceInfo;
window.palSpaceOf = palSpaceOf;
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
window.palToggleShatterMode = palToggleShatterMode;
window.refreshPal = refreshPal;
