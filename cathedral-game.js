// ============================================
// CATHEDRAL — "The Pilgrimage"
// ============================================
// + cross board (9×9 bounding box, arms 3 wide, 45 playable cells).
// Each player has 2 stones opposite each other. Win by landing both
// stones on the other color's starting cells.
//
// Move orthogonally or VAULT over any stone to the cell beyond.
// Or click any empty cell to RALLY — all your stones step one cell
// toward it (efficient, risks stranding on sunken terrain).
//
// LEVELS: step to a cell whose terrain is <= your level; fall to match.
// Stairs reset your level. Terrain drifts toward 0 when you leave.
// ============================================

const CATH_W = 9, CATH_H = 9;
const CATH_STAIRS = [
    { x: -1, y: 4, side: 'L', adjs: [{ x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }] },
    { x: 9, y: 4, side: 'R', adjs: [{ x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }] },
    { x: 4, y: -1, side: 'N', adjs: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }] },
    { x: 4, y: 9, side: 'S', adjs: [{ x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }] }
];
const CATH_LEVELS = [-1, 0, 1];

// initial positions: each player has one stone on the vertical arm
// and one on the horizontal arm (in front of the side stairs)
const CATH_STARTS = {
    B: [{ x: 4, y: 0, level: 0, onStair: null }, { x: 4, y: 8, level: 0, onStair: null }],
    W: [{ x: 0, y: 4, level: 0, onStair: null }, { x: 8, y: 4, level: 0, onStair: null }]
};

let cathHmap = {};
let cathStones = { B: [], W: [] };
let cathTurn = 'W';
let cathWinner = null;

function cKey(x, y) { return x + ',' + y; }
function cIn(x, y) {
    return x >= 0 && x < CATH_W && y >= 0 && y < CATH_H
        && (x >= 3 && x <= 5 || y >= 3 && y <= 5);
}
function cIsStart(x, y) {
    return CATH_STARTS.B.concat(CATH_STARTS.W).some(function (s) { return s.x === x && s.y === y; });
}
function cLiftable(x, y) { return cIn(x, y) && !cIsStart(x, y); }
function cHeight(x, y) { return cLiftable(x, y) ? (cathHmap[cKey(x, y)] || 0) : 0; }
function cStairAt(x, y) { return CATH_STAIRS.find(function (s) { return s.x === x && s.y === y; }) || null; }
function cStairFromAdj(x, y) { return CATH_STAIRS.find(function (s) { return s.adjs.some(function (a) { return a.x === x && a.y === y; }); }) || null; }

function allStones() {
    var out = [];
    ['B', 'W'].forEach(function (c) { cathStones[c].forEach(function (s) { out.push(s); }); });
    return out;
}
function cPilAt(x, y) {
    return allStones().find(function (s) { return s.x === x && s.y === y; }) || null;
}
function cathReset() {
    cathHmap = {};
    cathStones = {
        B: CATH_STARTS.B.map(function (s, i) { return { x: s.x, y: s.y, level: 0, onStair: null, col: 'B', idx: i }; }),
        W: CATH_STARTS.W.map(function (s, i) { return { x: s.x, y: s.y, level: 0, onStair: null, col: 'W', idx: i }; })
    };
    cathTurn = 'W'; cathWinner = null;
    if (window.cathRebuild) window.cathRebuild();
    refreshCath();
}

function terrainDelta(h) { return h >= 0 ? -1 : 1; }

function applyTerrain(x, y) {
    if (!cLiftable(x, y)) return;
    var k = cKey(x, y);
    var h = cathHmap[k] || 0;
    cathHmap[k] = h + terrainDelta(h);
    if (window.cathAnimLift) window.cathAnimLift(x, y, cathHmap[k]);
}

function targetsForStone(s) {
    var out = [];
    // on stair → exit targets
    if (s.onStair) {
        var stair = CATH_STAIRS.find(function (q) { return q.side === s.onStair; });
        stair.adjs.forEach(function (a) {
            if (!cPilAt(a.x, a.y)) out.push({ x: a.x, y: a.y, kind: 'exit', stoneIdx: s.idx, level: cHeight(a.x, a.y) });
        });
        return out;
    }
    // regular moves
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = s.x + d[0], ny = s.y + d[1];
        if (cIn(nx, ny) && !cPilAt(nx, ny) && cHeight(nx, ny) <= s.level)
            out.push({ x: nx, y: ny, kind: 'move', stoneIdx: s.idx });
    });
    // enter stair from adjacent cell
    var stair = cStairFromAdj(s.x, s.y);
    if (stair && !cPilAt(stair.x, stair.y))
        out.push({ x: stair.x, y: stair.y, kind: 'stair', stoneIdx: s.idx, side: stair.side });
    // vault over an adjacent stone
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var mx = s.x + d[0], my = s.y + d[1];
        var jumped = cPilAt(mx, my);
        if (!jumped) return;
        var nx = mx + d[0], ny = my + d[1];
        if (cIn(nx, ny) && !cPilAt(nx, ny))
            out.push({ x: nx, y: ny, kind: 'vault', stoneIdx: s.idx, overX: mx, overY: my });
    });
    // struggle: when completely trapped, jump in place to shift terrain
    if (out.length === 0 && !s.onStair && !cPilAt(s.x, s.y))
        out.push({ x: s.x, y: s.y, kind: 'struggle', stoneIdx: s.idx });
    return out;
}

function cathAllTargets(color) {
    if (cathWinner) return [];
    var out = [];
    cathStones[color].forEach(function (s) {
        targetsForStone(s).forEach(function (t) { out.push(t); });
    });
    return out;
}

// --- Rally (group move) ---
// Each of the player's stones takes one orthogonal step toward (tx,ty).
// Elegant rule: if already in line-of-sight (same row or column) march straight in;
// otherwise step in the axis with the larger gap (reduces distance faster).
function dirToward(sx, sy, tx, ty) {
    var dx = tx - sx, dy = ty - sy;
    if (dx === 0) return [0, dy > 0 ? 1 : -1];
    if (dy === 0) return [dx > 0 ? 1 : -1, 0];
    if (Math.abs(dx) >= Math.abs(dy)) return [dx > 0 ? 1 : -1, 0];
    return [0, dy > 0 ? 1 : -1];
}

function cathTryRally(tx, ty) {
    if (cathWinner || !cIn(tx, ty)) return false;
    var stones = cathStones[cathTurn];
    var moves = [];
    var used = {};
    // compute all target positions first (simultaneous)
    stones.forEach(function (s) {
        if (s.onStair) return;
        var d = dirToward(s.x, s.y, tx, ty);
        var nx = s.x + d[0], ny = s.y + d[1];
        var k = nx + ',' + ny;
        if (!cIn(nx, ny) || cPilAt(nx, ny) || used[k] || cHeight(nx, ny) > s.level) return;
        used[k] = true;
        moves.push({ stoneIdx: s.idx, x: nx, y: ny });
    });
    if (moves.length === 0) return false;
    moves.forEach(function (t) {
        var s = stones[t.stoneIdx];
        var from = { x: s.x, y: s.y, level: s.level, onStair: s.onStair };
        s.x = t.x; s.y = t.y; s.level = cHeight(t.x, t.y);
        applyTerrain(from.x, from.y);
        if (window.cathAnimMove) window.cathAnimMove(s.col, s.idx, from, { x: s.x, y: s.y, level: s.level, onStair: s.onStair });
    });
    cathAfter();
    return true;
}

// --- Win condition ---
// Each colour wins by occupying the OTHER colour's starting cells.
function cathCheckWin() {
    var bw = [[4, 0], [4, 8]], wb = [[0, 4], [8, 4]];
    if (wb.every(function (t) { return cathStones.B.some(function (s) { return s.x === t[0] && s.y === t[1]; }); })) return 'B';
    if (bw.every(function (t) { return cathStones.W.some(function (s) { return s.x === t[0] && s.y === t[1]; }); })) return 'W';
    return null;
}

function cathTapTarget(t) {
    if (cathWinner) return;
    var stones = cathStones[cathTurn];
    var s = stones[t.stoneIdx];
    if (!s) return;
    var legal = targetsForStone(s).some(function (q) {
        return q.x === t.x && q.y === t.y && q.kind === t.kind
            && (t.kind !== 'exit' || q.level === t.level)
            && (t.kind !== 'vault' || (q.overX === t.overX && q.overY === t.overY));
    });
    if (!legal) return;
    var from = { x: s.x, y: s.y, level: s.level, onStair: s.onStair };

    if (t.kind === 'stair') { s.onStair = t.side; s.x = t.x; s.y = t.y; }
    else if (t.kind === 'exit') { s.onStair = null; s.x = t.x; s.y = t.y; s.level = t.level; }
    else if (t.kind === 'vault') {
        s.x = t.x; s.y = t.y; s.level = cHeight(t.x, t.y);
        applyTerrain(t.overX, t.overY);
    }
    else if (t.kind === 'struggle') {
        s.level = cHeight(s.x, s.y);
        applyTerrain(s.x, s.y);
        s.level = cHeight(s.x, s.y);
    }
    else { s.x = t.x; s.y = t.y; s.level = cHeight(t.x, t.y); }

    if (t.kind !== 'struggle') applyTerrain(from.x, from.y);
    cathAnim(s, from);
    cathAfter();
}

function cathAnim(s, from) {
    if (window.cathAnimMove)
        window.cathAnimMove(s.col, s.idx, from, { x: s.x, y: s.y, level: s.level, onStair: s.onStair });
}

function cathAfter() {
    cathWinner = cathCheckWin();
    if (cathWinner) { refreshCath(); return; }
    cathTurn = (cathTurn === 'W') ? 'B' : 'W';
    refreshCath();
}

function getCathState() {
    var cells = [];
    for (var x = 0; x < CATH_W; x++) for (var y = 0; y < CATH_H; y++) {
        cells.push({ x: x, y: y, h: cHeight(x, y), start: cIsStart(x, y) });
    }
    var pilgrims = {};
    ['B', 'W'].forEach(function (c) {
        pilgrims[c] = cathStones[c].map(function (s) { return { x: s.x, y: s.y, level: s.level, onStair: s.onStair, idx: s.idx, col: s.col }; });
    });
    return {
        turn: cathTurn, winner: cathWinner, pilgrims: pilgrims,
        stairs: CATH_STAIRS, cells: cells,
        targets: cathAllTargets(cathTurn),
        W: CATH_W, H: CATH_H
    };
}

function refreshCath() {
    if (window.cathSync3D) window.cathSync3D();
    var ind = document.getElementById('player-indicator');
    var nm = document.getElementById('player-name');
    var prompt = document.getElementById('action-prompt');
    var msg = document.getElementById('game-message');
    if (cathWinner) {
        var name = cathWinner === 'W' ? 'White' : 'Black';
        if (ind) ind.className = 'player-indicator ' + name.toLowerCase();
        if (nm) nm.textContent = name + ' claims the cathedral!';
        if (prompt) prompt.textContent = 'Both stones reached the other side — pilgrimage complete';
        if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
        return;
    }
    var who = cathTurn === 'W' ? 'White' : 'Black';
    if (ind) ind.className = 'player-indicator ' + (cathTurn === 'W' ? 'white' : 'black');
    if (nm) nm.textContent = who + ' — ' + cathStones[cathTurn].length + ' stones';
    if (prompt) prompt.textContent = who + ', tap a stone, a ring, or any cell to rally';
    if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
}

window.getCathState = getCathState;
window.cathReset = cathReset;
window.cathTapTarget = cathTapTarget;
window.cathTryRally = cathTryRally;
window.refreshCath = refreshCath;
