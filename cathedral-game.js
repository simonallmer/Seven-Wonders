// ============================================
// CATHEDRAL — "The Pilgrimage" (prototype, win TBD)
// ============================================
// Chessboard 7x7. Two pilgrims start at opposite mid-edges (top/bottom).
// Terrain: every field except the two starts can be RAISED (+1) / LOWERED (-1),
// but only your OWN colour, and never the field a pilgrim stands on.
//
// LEVELS: a pilgrim stands on a plane -1, 0 or +1. On the board you may step to
// an adjacent cell whose terrain is <= your level (never climb above your level).
//
// STAIRS: two landings ATTACHED to the middle of the free (left/right) sides,
// off the board. Step onto a stair, then choose DOWN / NORMAL / UP to come back
// onto the board at that level. The stair is your level reset / elevator.
//
// (Win condition deliberately not implemented yet.)
// ============================================

const CATH_W = 7, CATH_H = 7;
const CATH_HOME = { B: { x: 3, y: 0 }, W: { x: 3, y: 6 } };
// off-board stair landings at the middle of all four sides
const CATH_STAIRS = [
    { x: -1, y: 3, side: 'L', adj: { x: 0, y: 3 } },
    { x: 7, y: 3, side: 'R', adj: { x: 6, y: 3 } },
    { x: 3, y: -1, side: 'N', adj: { x: 3, y: 0 } },
    { x: 3, y: 7, side: 'S', adj: { x: 3, y: 6 } }
];
const CATH_LEVELS = [-1, 0, 1];

let cathHmap = {};
let cathPil = { W: { x: 3, y: 6, level: 0, onStair: null }, B: { x: 3, y: 0, level: 0, onStair: null } };
let cathTurn = 'W';
let cathMode = 'move';
let cathWinner = null;

function cKey(x, y) { return x + ',' + y; }
function cIn(x, y) { return x >= 0 && x < CATH_W && y >= 0 && y < CATH_H; }
function cIsStart(x, y) { return (x === 3 && y === 0) || (x === 3 && y === 6); }
function cColor(x, y) { return ((x + y) % 2 === 0) ? 'W' : 'B'; }
function cLiftable(x, y) { return cIn(x, y) && !cIsStart(x, y); }
function cHeight(x, y) { return cLiftable(x, y) ? (cathHmap[cKey(x, y)] || 0) : 0; }
function cPilAt(x, y) {
    if (cathPil.W.x === x && cathPil.W.y === y) return 'W';
    if (cathPil.B.x === x && cathPil.B.y === y) return 'B';
    return null;
}
function cStairAt(x, y) { return CATH_STAIRS.find(function (s) { return s.x === x && s.y === y; }) || null; }
function cStairFromAdj(x, y) { return CATH_STAIRS.find(function (s) { return s.adj.x === x && s.adj.y === y; }) || null; }

function cathReset() {
    cathHmap = {};
    cathPil = { W: { x: 3, y: 6, level: 0, onStair: null }, B: { x: 3, y: 0, level: 0, onStair: null } };
    cathTurn = 'W'; cathMode = 'move'; cathWinner = null;
    const box = document.getElementById('message-box'); if (box) box.classList.remove('visible');
    if (window.cathRebuild) window.cathRebuild();
    refreshCath();
}

function cathMoveTargets(color) {
    const p = cathPil[color], out = [];
    if (p.onStair) {   // choose an exit level back onto the board
        const s = CATH_STAIRS.find(function (q) { return q.side === p.onStair; });
        CATH_LEVELS.forEach(function (L) { out.push({ x: s.adj.x, y: s.adj.y, kind: 'exit', level: L }); });
        return out;
    }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = p.x + d[0], ny = p.y + d[1];
        if (cIn(nx, ny)) {
            if (!cPilAt(nx, ny) && cHeight(nx, ny) <= p.level) out.push({ x: nx, y: ny, kind: 'move' });
        }
    });
    const s = cStairFromAdj(p.x, p.y);   // step off the edge onto the stair
    if (s && !cPilAt(s.x, s.y)) out.push({ x: s.x, y: s.y, kind: 'stair', side: s.side });
    return out;
}
function cathLiftTargets(dir) {
    const out = [];
    for (let x = 0; x < CATH_W; x++) for (let y = 0; y < CATH_H; y++) {
        if (!cLiftable(x, y) || cColor(x, y) !== cathTurn || cPilAt(x, y)) continue;
        const h = cHeight(x, y);
        if (dir > 0 && h < 1) out.push({ x: x, y: y, h: h });
        if (dir < 0 && h > -1) out.push({ x: x, y: y, h: h });
    }
    return out;
}

function cathSetMode(m) { if (cathWinner) return; cathMode = m; refreshCath(); }

function cathTapTarget(t) {
    if (cathWinner || cathMode !== 'move') return;
    const p = cathPil[cathTurn];
    const legal = cathMoveTargets(cathTurn).some(function (q) { return q.x === t.x && q.y === t.y && q.kind === t.kind && (t.kind !== 'exit' || q.level === t.level); });
    if (!legal) return;
    const from = { x: p.x, y: p.y, level: p.level, onStair: p.onStair };
    if (t.kind === 'stair') { p.onStair = t.side; p.x = t.x; p.y = t.y; }
    else if (t.kind === 'exit') { p.onStair = null; p.x = t.x; p.y = t.y; p.level = t.level; }
    else { p.x = t.x; p.y = t.y; }
    if (window.cathAnimMove) window.cathAnimMove(cathTurn, from, { x: p.x, y: p.y, level: p.level, onStair: p.onStair });
    cathAfter();
}
function cathTapLift(x, y) {
    if (cathWinner || cathMode === 'move') return;
    if (!cLiftable(x, y)) { flashCath('That field is fixed'); return; }
    if (cColor(x, y) !== cathTurn) { flashCath((cathTurn === 'W' ? 'White' : 'Black') + ' may only lift ' + (cathTurn === 'W' ? 'white' : 'black') + ' fields'); return; }
    if (cPilAt(x, y)) { flashCath('You cannot reshape a field a pilgrim stands on'); return; }
    const k = cKey(x, y), h = cathHmap[k] || 0;
    if (cathMode === 'raise') { if (h >= 1) { flashCath('Already at the top'); return; } cathHmap[k] = h + 1; }
    else { if (h <= -1) { flashCath('Already at the bottom'); return; } cathHmap[k] = h - 1; }
    if (window.cathAnimLift) window.cathAnimLift(x, y, cathHmap[k]);
    cathAfter();
}
function cathAfter() { cathTurn = (cathTurn === 'W') ? 'B' : 'W'; cathMode = 'move'; refreshCath(); }

function getCathState() {
    const cells = [];
    for (let x = 0; x < CATH_W; x++) for (let y = 0; y < CATH_H; y++) {
        cells.push({ x: x, y: y, h: cHeight(x, y), color: cColor(x, y), lift: cLiftable(x, y), start: cIsStart(x, y) });
    }
    return {
        turn: cathTurn, mode: cathMode, winner: cathWinner,
        pilgrims: {
            W: { x: cathPil.W.x, y: cathPil.W.y, level: cathPil.W.level, onStair: cathPil.W.onStair },
            B: { x: cathPil.B.x, y: cathPil.B.y, level: cathPil.B.level, onStair: cathPil.B.onStair }
        },
        homes: CATH_HOME, stairs: CATH_STAIRS, cells: cells,
        moveTargets: (cathWinner || cathMode !== 'move') ? [] : cathMoveTargets(cathTurn),
        liftTargets: cathWinner ? [] : (cathMode === 'raise' ? cathLiftTargets(1) : cathMode === 'lower' ? cathLiftTargets(-1) : []),
        W: CATH_W, H: CATH_H
    };
}

function refreshCath() {
    if (window.cathSync3D) window.cathSync3D();
    const rc = document.getElementById('chip-raise'); if (rc) rc.classList.toggle('active', cathMode === 'raise');
    const lc = document.getElementById('chip-lower'); if (lc) lc.classList.toggle('active', cathMode === 'lower');
    const ind = document.getElementById('player-indicator');
    const nm = document.getElementById('player-name');
    const prompt = document.getElementById('action-prompt');
    const who = cathTurn === 'W' ? 'White' : 'Black';
    const p = cathPil[cathTurn];
    if (ind) ind.className = 'player-indicator ' + (cathTurn === 'W' ? 'white' : 'black');
    if (nm) nm.textContent = who + (p.onStair ? ' — on the stair (pick a level)' : ' — level ' + p.level);
    if (prompt) prompt.textContent = cathMode === 'raise'
        ? 'Raise mode — lift one of your ' + (cathTurn === 'W' ? 'white' : 'black') + ' fields +1'
        : cathMode === 'lower'
            ? 'Lower mode — sink one of your ' + (cathTurn === 'W' ? 'white' : 'black') + ' fields −1'
            : p.onStair ? 'On the stair — tap Down / Normal / Up to step back on at that level'
                : 'Tap a glowing cell to step · reach a side stair to change level · Raise / Lower to reshape';
}

function flashCath(msg) {
    const el = document.getElementById('game-message'); if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(window._cathMsgT); window._cathMsgT = setTimeout(function () { el.classList.add('hidden'); }, 1700);
}

window.getCathState = getCathState;
window.cathReset = cathReset;
window.cathTapTarget = cathTapTarget;
window.cathTapLift = cathTapLift;
window.cathSetMode = cathSetMode;
window.refreshCath = refreshCath;
