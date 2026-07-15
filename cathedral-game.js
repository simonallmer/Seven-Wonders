// ============================================
// CATHEDRAL — "The Conversion"
// ============================================
// Greek cross of five 5x5 fields (15x15 bounding box, arms 5 wide).
// The field mesh is shared with Temple: orthogonal lines everywhere,
// diagonal lines only through even-parity nodes (x+y even) — strong
// nodes see 8 directions, weak nodes 4.
//
// SETUP: each player fills the outer 3 rows of their arm (15 stones).
// 2 players: White (south) vs Black (north). 4 players: + Blue (west)
// and Red (east). Turn order runs clockwise: W → U → B → R.
//
// MOVE (Procession): a stone may travel UP TO as many empty fields in a
// straight line as the longest unbroken run of friendly stones standing
// directly adjacent to it in a single line direction (minimum 1 — a lone
// pilgrim always walks). Long processions are fast — and convert whole.
// CONVERT (never mandatory):
//   APPROACH — step toward an enemy line: the unbroken run of stones
//     directly ahead converts to your color.
//   WITHDRAW — step away from an enemy line: the unbroken run of stones
//     directly behind your starting node converts to your color.
//   A run is contiguous stones of ONE color — conversion stops where the
//   color changes, at an empty node, at your own stone, or at the edge.
//   If a step is both approach and withdrawal, choose one.
// CHAIN: after converting, the same stone may keep converting — never
//   re-entering a node it has touched this turn. Stop whenever you wish.
// WIN: reduce every enemy below 4 stones of their color — a congregation
//   of fewer than four falls silent (its stones stay on as witnesses).
// ============================================

const CATH_N = 15;                 // bounding box
const CATH_ARM_LO = 5, CATH_ARM_HI = 9; // the central 5-wide band

const CATH_D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const CATH_NAMES = { W: 'White', B: 'Black', U: 'Blue', R: 'Red' };

// PASSAGE (the ambulatory): exterior walkways around each corner of the
// crossing, joining the flank midpoints of neighboring arms. A doorway,
// not a line — crossing is always a single step and never converts.
const CATH_PASSAGES = [
    [[5, 2], [2, 5]],    // north-west
    [[9, 2], [12, 5]],   // north-east
    [[12, 9], [9, 12]],  // south-east
    [[2, 9], [5, 12]]    // south-west
];
function cPassageFrom(x, y) {
    for (var i = 0; i < CATH_PASSAGES.length; i++) {
        var p = CATH_PASSAGES[i];
        if (p[0][0] === x && p[0][1] === y) return { x: p[1][0], y: p[1][1] };
        if (p[1][0] === x && p[1][1] === y) return { x: p[0][0], y: p[0][1] };
    }
    return null;
}

let cathBoard = {};        // "x,y" -> 'W' | 'B' | 'U' | 'R'
let cathPlayers = ['W', 'B'];
let cathTurn = 'W';
let cathWinner = null;
let cathSelected = null;   // {x,y} of the stone whose targets are shown
let cathChain = null;      // { x, y, visited: {key:true} } after a conversion

function cKey(x, y) { return x + ',' + y; }
function cIn(x, y) {
    if (x < 0 || x >= CATH_N || y < 0 || y >= CATH_N) return false;
    return (x >= CATH_ARM_LO && x <= CATH_ARM_HI) || (y >= CATH_ARM_LO && y <= CATH_ARM_HI);
}
// Field position: which parity carries the diagonals.
// Middle 4 (parity 1, default): the center node is weak — the crossing is
// entered on 4 lines only, and the passage mouths become strong nodes.
// Middle 8 (parity 0): the center node is strong with all 8 lines.
var cathParity = 1;
function cStrong(x, y) { return (x + y) % 2 === cathParity; }
function cathSetField(mode) { // 'middle4' | 'middle8'
    cathParity = (mode === 'middle8') ? 0 : 1;
    cathReset();
}
function cDirs(x, y) { return cStrong(x, y) ? CATH_D8 : CATH_D8.slice(0, 4); }
function cStoneAt(x, y) { return cathBoard[cKey(x, y)] || null; }

function cathReset(nPlayers) {
    if (nPlayers === 2 || nPlayers === 4)
        cathPlayers = nPlayers === 2 ? ['W', 'B'] : ['W', 'U', 'B', 'R'];
    cathBoard = {};
    var four = cathPlayers.length === 4;
    for (var i = CATH_ARM_LO; i <= CATH_ARM_HI; i++) {
        for (var d = 0; d < 3; d++) {
            cathBoard[cKey(i, CATH_N - 1 - d)] = 'W';           // south
            cathBoard[cKey(i, d)] = 'B';                        // north
            if (four) {
                cathBoard[cKey(d, i)] = 'U';                    // west
                cathBoard[cKey(CATH_N - 1 - d, i)] = 'R';       // east
            }
        }
    }
    cathTurn = 'W'; cathWinner = null; cathSelected = null; cathChain = null;
    if (typeof cathAiTimer !== 'undefined') clearTimeout(cathAiTimer);
    if (typeof cathWinRevealTimer !== 'undefined') clearTimeout(cathWinRevealTimer);
    var modal = document.getElementById('game-over-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('visible'); }
    if (window.cathRebuild) window.cathRebuild();
    refreshCath();
}

// the unbroken run of a single enemy color starting at (qx,qy), along (dx,dy)
function cRun(color, qx, qy, dx, dy) {
    var e = cStoneAt(qx, qy);
    if (!e || e === color) return null;
    var run = [];
    var x = qx, y = qy;
    while (cIn(x, y) && cStoneAt(x, y) === e) {
        run.push({ x: x, y: y });
        x += dx; y += dy;
    }
    return { color: e, nodes: run };
}

// Procession reach: the longest unbroken run of friendly stones directly
// adjacent in one line direction (minimum 1, the mover not counted)
function cReach(color, sx, sy) {
    var best = 1;
    cDirs(sx, sy).forEach(function (d) {
        var n = 0, x = sx + d[0], y = sy + d[1];
        while (cIn(x, y) && cStoneAt(x, y) === color) { n++; x += d[0]; y += d[1]; }
        if (n > best) best = n;
    });
    return best;
}

// all legal targets for the stone at (sx,sy) belonging to `color`.
// During a chain only further conversions (and stopping) are legal.
function cathTargetsFor(color, sx, sy) {
    var out = [];
    if (cStoneAt(sx, sy) !== color) return out;
    var chaining = cathChain && cathChain.x === sx && cathChain.y === sy;
    if (cathChain && !chaining) return out; // mid-chain: only the pilgrim itself may act

    var reach = cReach(color, sx, sy);
    cDirs(sx, sy).forEach(function (d) {
        // withdrawal reads the line touching the START — same for every landing
        var wdr = cRun(color, sx - d[0], sy - d[1], -d[0], -d[1]);
        for (var k = 1; k <= reach; k++) {
            var nx = sx + d[0] * k, ny = sy + d[1] * k;
            if (!cIn(nx, ny) || cStoneAt(nx, ny)) break;                 // no jumping
            if (chaining && cathChain.visited[cKey(nx, ny)]) break;      // never retrace your path

            var app = cRun(color, nx + d[0], ny + d[1], d[0], d[1]);
            if (app) out.push({ x: nx, y: ny, kind: 'approach', sx: sx, sy: sy, dx: d[0], dy: d[1] });
            if (wdr) out.push({ x: nx, y: ny, kind: 'withdraw', sx: sx, sy: sy, dx: d[0], dy: d[1] });
            if (!app && !wdr && !chaining)
                out.push({ x: nx, y: ny, kind: 'walk', sx: sx, sy: sy, dx: d[0], dy: d[1] });
        }
    });
    // the ambulatory door — a plain step, never part of a chain
    if (!chaining) {
        var pas = cPassageFrom(sx, sy);
        if (pas && !cStoneAt(pas.x, pas.y))
            out.push({ x: pas.x, y: pas.y, kind: 'walk', passage: true, sx: sx, sy: sy, dx: 0, dy: 0 });
    }
    if (chaining) out.push({ x: sx, y: sy, kind: 'stop', sx: sx, sy: sy });
    return out;
}

function cathHasAnyMove(color) {
    for (var k in cathBoard) {
        if (cathBoard[k] !== color) continue;
        var p = k.split(',');
        if (cathTargetsFor(color, +p[0], +p[1]).length) return true;
    }
    return false;
}

function cathCount(color) {
    var n = 0;
    for (var k in cathBoard) if (cathBoard[k] === color) n++;
    return n;
}

// a color needs at least 4 stones to keep its voice — below that it has
// lost, its remaining stones staying on the board as silent witnesses.
const CATH_MIN_STONES = 4;
function cathAlive(color) { return cathCount(color) >= CATH_MIN_STONES; }
function cathCheckWin() {
    var active = cathPlayers.filter(cathAlive);
    if (active.length === 1) return active[0];
    return null;
}

// tap a stone to select it (shows its targets); tap elsewhere to clear
function cathSelect(x, y) {
    if (cathWinner) return;
    if (cathIsComputer(cathTurn) && !cathAiActing) return; // the computer is playing
    if (cathChain) return; // selection is locked to the chaining stone
    cathSelected = (cStoneAt(x, y) === cathTurn) ? { x: x, y: y } : null;
    refreshCath();
}

function cathTapTarget(t) {
    if (cathWinner) return;
    if (cathIsComputer(cathTurn) && !cathAiActing) return; // the computer is playing
    var legal = cathTargetsFor(cathTurn, t.sx, t.sy).some(function (q) {
        return q.x === t.x && q.y === t.y && q.kind === t.kind;
    });
    if (!legal) return;

    if (t.kind === 'stop') { cathEndTurn(); return; }

    // step along the line
    delete cathBoard[cKey(t.sx, t.sy)];
    cathBoard[cKey(t.x, t.y)] = cathTurn;
    if (window.cathAnimMove) window.cathAnimMove({ x: t.sx, y: t.sy }, { x: t.x, y: t.y });

    if (t.kind === 'walk') { cathEndTurn(); return; }

    // conversion — approach reads the line ahead of the landing node,
    // withdrawal the line behind the starting node
    var run = (t.kind === 'approach')
        ? cRun(cathTurn, t.x + t.dx, t.y + t.dy, t.dx, t.dy)
        : cRun(cathTurn, t.sx - t.dx, t.sy - t.dy, -t.dx, -t.dy);
    if (run) {
        run.nodes.forEach(function (n) { cathBoard[cKey(n.x, n.y)] = cathTurn; });
        if (window.cathAnimConvert) window.cathAnimConvert(run.nodes, cathTurn);
    }

    cathWinner = cathCheckWin();
    if (cathWinner) { cathSelected = null; cathChain = null; refreshCath(); return; }

    // open (or extend) the chain — the pilgrim may keep converting
    if (!cathChain) cathChain = { visited: {} };
    cathChain.visited[cKey(t.sx, t.sy)] = true;
    cathChain.visited[cKey(t.x, t.y)] = true;
    cathChain.x = t.x; cathChain.y = t.y;
    cathSelected = { x: t.x, y: t.y };

    var more = cathTargetsFor(cathTurn, t.x, t.y).some(function (q) { return q.kind !== 'stop'; });
    if (!more) { cathEndTurn(); return; }
    refreshCath();
}

function cathEndTurn() {
    cathChain = null; cathSelected = null;
    cathWinner = cathCheckWin();
    if (cathWinner) { refreshCath(); return; }
    var i = cathPlayers.indexOf(cathTurn);
    for (var step = 1; step <= cathPlayers.length; step++) {
        var c = cathPlayers[(i + step) % cathPlayers.length];
        if (!cathAlive(c)) continue;              // below 4 stones — fallen silent
        if (!cathHasAnyMove(c)) continue;         // walled in — the turn passes over
        cathTurn = c;
        refreshCath();
        return;
    }
    // nobody can move at all — the largest congregation takes the cathedral
    var best = null;
    cathPlayers.forEach(function (c) {
        if (best === null || cathCount(c) > cathCount(best)) best = c;
    });
    cathWinner = best;
    refreshCath();
}

function getCathState() {
    var nodes = [], stones = [];
    for (var x = 0; x < CATH_N; x++) for (var y = 0; y < CATH_N; y++) {
        if (!cIn(x, y)) continue;
        nodes.push({ x: x, y: y, strong: cStrong(x, y) });
        var c = cStoneAt(x, y);
        if (c) stones.push({ x: x, y: y, col: c });
    }
    // each line segment once: E, S, and the two down-diagonals from strong nodes
    var edges = [];
    nodes.forEach(function (n) {
        [[1, 0], [0, 1], [1, 1], [1, -1]].forEach(function (d) {
            if ((d[0] && d[1]) && !n.strong) return;
            if (cIn(n.x + d[0], n.y + d[1])) edges.push({ x1: n.x, y1: n.y, x2: n.x + d[0], y2: n.y + d[1] });
        });
    });
    var sel = cathChain ? { x: cathChain.x, y: cathChain.y } : cathSelected;
    var counts = {};
    cathPlayers.forEach(function (c) { counts[c] = cathCount(c); });
    return {
        turn: cathTurn, winner: cathWinner, players: cathPlayers, counts: counts,
        nodes: nodes, edges: edges, stones: stones, passages: CATH_PASSAGES,
        selected: sel, chaining: !!cathChain,
        targets: sel ? cathTargetsFor(cathTurn, sel.x, sel.y) : [],
        N: CATH_N
    };
}

function refreshCath() {
    if (window.cathSync3D) window.cathSync3D();
    var ind = document.getElementById('player-indicator');
    var nm = document.getElementById('player-name');
    var prompt = document.getElementById('action-prompt');
    if (cathWinner) {
        if (ind) ind.className = 'player-indicator ' + CATH_NAMES[cathWinner].toLowerCase();
        if (nm) nm.textContent = CATH_NAMES[cathWinner] + ' claims the cathedral!';
        if (prompt) prompt.textContent = 'Every rival congregation has fallen below four stones';
        cathShowGameOver();
        return;
    }
    var who = CATH_NAMES[cathTurn];
    if (ind) ind.className = 'player-indicator ' + who.toLowerCase();
    if (nm) nm.textContent = cathPlayers.map(function (c) {
        return CATH_NAMES[c] + ' ' + cathCount(c);
    }).join(' · ');
    if (prompt) prompt.textContent = cathIsComputer(cathTurn)
        ? who + ' is deliberating…'
        : cathChain
            ? who + ', keep converting — or tap your stone to rest'
            : who + ', tap a stone — approach or withdraw to convert';
    if (cathIsComputer(cathTurn)) {
        clearTimeout(cathAiTimer);
        cathAiTimer = setTimeout(cathAiMove, 800);
    }
}

var cathWinRevealTimer = null;
function cathShowGameOver() {
    var modal = document.getElementById('game-over-modal');
    if (!modal) return;
    var title = document.getElementById('modal-title');
    var text = document.getElementById('modal-text');
    if (title) title.textContent = CATH_NAMES[cathWinner] + ' claims the cathedral!';
    if (text) text.textContent = 'Every rival congregation has fallen below four stones — the conversion is complete.';
    // let the final conversion play out before covering the board
    clearTimeout(cathWinRevealTimer);
    cathWinRevealTimer = setTimeout(function () {
        if (!cathWinner) return; // a new game started meanwhile
        modal.classList.remove('hidden');
        modal.classList.add('visible');
    }, 1300);
}

// ============================================
// COMPUTER OPPONENT
// The human always plays White; every other color is computer-controlled.
// Greedy with one look ahead: convert as much as possible, avoid offering
// the next player a long line of ours, and drift toward the unconverted.
// ============================================
var cathVsComputer = true;
var CATH_HUMAN = 'W';
var cathAiActing = false;
var cathAiTimer = null;

function cathIsComputer(color) { return cathVsComputer && color !== CATH_HUMAN; }

function cathSetOpponent(isComputer) {
    cathVsComputer = isComputer;
    refreshCath();
}

// apply a target to the real board for evaluation, returning an undo record
function cathSimApply(t, color) {
    var rec = { fromK: cKey(t.sx, t.sy), toK: cKey(t.x, t.y), conv: [] };
    delete cathBoard[rec.fromK];
    cathBoard[rec.toK] = color;
    if (t.kind === 'approach' || t.kind === 'withdraw') {
        var run = (t.kind === 'approach')
            ? cRun(color, t.x + t.dx, t.y + t.dy, t.dx, t.dy)
            : cRun(color, t.sx - t.dx, t.sy - t.dy, -t.dx, -t.dy);
        if (run) run.nodes.forEach(function (n) {
            var k = cKey(n.x, n.y);
            rec.conv.push({ k: k, old: cathBoard[k] });
            cathBoard[k] = color;
        });
    }
    return rec;
}
function cathSimUndo(rec, color) {
    rec.conv.forEach(function (c) { cathBoard[c.k] = c.old; });
    delete cathBoard[rec.toK];
    cathBoard[rec.fromK] = color;
}

function cathRunLengthOf(t, color, victim) {
    var run = (t.kind === 'approach')
        ? cRun(color, t.x + t.dx, t.y + t.dy, t.dx, t.dy)
        : cRun(color, t.sx - t.dx, t.sy - t.dy, -t.dx, -t.dy);
    if (!run) return 0;
    return (victim && run.color !== victim) ? 0 : run.nodes.length;
}

function cathNextActive(color) {
    var i = cathPlayers.indexOf(color);
    for (var s = 1; s < cathPlayers.length; s++) {
        var c = cathPlayers[(i + s) % cathPlayers.length];
        if (cathAlive(c)) return c;
    }
    return null;
}

// the largest conversion `color` could make on the current board
function cathBestConversion(color) {
    var best = 0;
    for (var k in cathBoard) {
        if (cathBoard[k] !== color) continue;
        var p = k.split(',');
        cathTargetsFor(color, +p[0], +p[1]).forEach(function (q) {
            if (q.kind !== 'approach' && q.kind !== 'withdraw') return;
            var len = cathRunLengthOf(q, color, null);
            if (len > best) best = len;
        });
    }
    return best;
}

function cathScoreMove(t, color) {
    if (t.kind === 'stop') return 0.1; // rest only when nothing converts
    var gain = (t.kind === 'walk') ? 0 : cathRunLengthOf(t, color, null);
    var rec = cathSimApply(t, color);
    var savedChain = cathChain; cathChain = null;

    var dmin = 99, weakest = 99;
    for (var k2 in cathBoard) {
        if (cathBoard[k2] === color) continue;
        var q2 = k2.split(',');
        var d = Math.max(Math.abs(t.x - q2[0]), Math.abs(t.y - q2[1]));
        if (d < dmin) dmin = d;
    }
    var enemiesAlive = 0;
    cathPlayers.forEach(function (c) {
        if (c === color) return;
        var n = cathCount(c);
        if (n >= CATH_MIN_STONES) { enemiesAlive++; if (n < weakest) weakest = n; }
    });
    if (enemiesAlive === 0) { // every rival silenced — nothing outranks this
        cathChain = savedChain;
        cathSimUndo(rec, color);
        return 9999;
    }

    // how hard can the next player hit our stones after this?
    var risk = 0;
    var nxt = cathNextActive(color);
    if (nxt && nxt !== color) {
        for (var k in cathBoard) {
            if (cathBoard[k] !== nxt) continue;
            var p = k.split(',');
            cathTargetsFor(nxt, +p[0], +p[1]).forEach(function (q) {
                if (q.kind !== 'approach' && q.kind !== 'withdraw') return;
                var len = cathRunLengthOf(q, nxt, color);
                if (len > risk) risk = len;
            });
        }
    }

    // what this position sets up for us — lets the hunt clear its own lanes
    var setup = cathBestConversion(color);

    cathChain = savedChain;
    cathSimUndo(rec, color);
    if (weakest <= CATH_MIN_STONES + 2) // a rival is near the threshold — press relentlessly
        return gain * 10 + setup * 3 - risk * 0.5 - dmin * 0.6 + Math.random() * 0.1;
    return gain * 3 + setup * 0.6 - risk * 2 - dmin * 0.25 + Math.random() * 0.15;
}

function cathAiMove() {
    if (cathWinner || !cathIsComputer(cathTurn)) return;
    var color = cathTurn;
    var cands = [];
    if (cathChain) {
        cands = cathTargetsFor(color, cathChain.x, cathChain.y);
    } else {
        for (var k in cathBoard) {
            if (cathBoard[k] !== color) continue;
            var p = k.split(',');
            cands = cands.concat(cathTargetsFor(color, +p[0], +p[1]));
        }
    }
    if (!cands.length) { cathEndTurn(); return; }
    var best = null, bestScore = -Infinity;
    cands.forEach(function (t) {
        var s = cathScoreMove(t, color);
        if (s > bestScore) { bestScore = s; best = t; }
    });
    cathAiActing = true;
    cathTapTarget(best);
    cathAiActing = false;
}

window.getCathState = getCathState;
window.cathReset = cathReset;
window.cathSelect = cathSelect;
window.cathTapTarget = cathTapTarget;
window.refreshCath = refreshCath;
window.cathSetOpponent = cathSetOpponent;
window.cathSetField = cathSetField;
