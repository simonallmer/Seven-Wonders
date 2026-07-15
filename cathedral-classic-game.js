// ============================================
// CATHEDRAL — "The Pilgrimage"
// ============================================
// + cross board (9×9 bounding box, arms 3 wide). Each player has 2 stones
// opposite each other. Win by landing both stones on the other color's
// (current) home cells.
//
// MOVE: a single stone takes up to two independent orthogonal steps —
// they don't have to be the same direction, so the path can bend.
// After step 1, tap the stone's own cell again to STOP there (a single
// uncracked step) — or tap an adjacent cell to take step 2, which cracks
// the cell you're leaving behind (destroying it on the second crack, a
// permanent hole nothing can ever enter or cross again). Once you commit
// to step 1 you must either stop or complete step 2 before the turn passes.
//
// COLLAPSE: each arm is 3 cells wide — 3 independent parallel lanes.
// Whenever a hole opens up in one, central gravity pulls: everything
// farther out IN THAT LANE ONLY falls one step closer to the middle (any
// stone caught out there is carried along), permanently losing its
// outermost cell. The other two lanes of the same arm are untouched, so
// the board doesn't stay a clean + — it erodes unevenly, rugged and
// jagged. Nothing heals. The center lane carries the arm's home cell and,
// like every lane, always keeps at least the cell touching the center.
//
// VAULT over any adjacent stone to the cell beyond — untouched by cracks.
// Or click any empty cell to RALLY — all your stones step one cell
// toward it (no cracking; the balance against the 2-step move).
//
// STACKING: landing directly on an adjacent lone stone (any color) hops
// you on top of it in a single, uncracked step — a 2-high stack (no
// triple stacks). Moving the BOTTOM stone carries the rider along
// wherever it goes. The RIDER's own turn instead lets it dismount alone
// to an adjacent empty, unbroken cell.
// ============================================

const CATH_W = 9, CATH_H = 9;
const CATH_MAX_CRACK = 2; // 2 = destroyed / hole
const CATH_ARM_MIN = 1;   // a lane always keeps at least its innermost cell

let cathCrackMap = {};
let cathStones = { B: [], W: [] };
let cathTurn = 'W';
let cathWinner = null;
let cathMidMove = null; // { col, stoneIdx } once step 1 is taken, until step 2 (or stop)
// surviving length per lane, center-out. Each arm has 3 parallel lanes
// (the perpendicular coordinate, 3/4/5); lane 4 is the center lane that
// carries the arm's home cell.
let cathLaneMax = {
    N: { 3: 3, 4: 3, 5: 3 }, S: { 3: 3, 4: 3, 5: 3 },
    W: { 3: 3, 4: 3, 5: 3 }, E: { 3: 3, 4: 3, 5: 3 }
};

function cKey(x, y) { return x + ',' + y; }

// which arm/lane a cell belongs to and its distance from the center block
// (1 = touching the center, higher = farther out). null = center block,
// undefined = outside the cross shape entirely.
function armOf(x, y) {
    if (x >= 3 && x <= 5 && y >= 3 && y <= 5) return null;
    if (x >= 3 && x <= 5 && y < 3) return { arm: 'N', lane: x, d: 3 - y };
    if (x >= 3 && x <= 5 && y > 5) return { arm: 'S', lane: x, d: y - 5 };
    if (y >= 3 && y <= 5 && x < 3) return { arm: 'W', lane: y, d: 3 - x };
    if (y >= 3 && y <= 5 && x > 5) return { arm: 'E', lane: y, d: x - 5 };
    return undefined;
}

function cIn(x, y) {
    if (x < 0 || x >= CATH_W || y < 0 || y >= CATH_H) return false;
    var a = armOf(x, y);
    if (a === undefined) return false;
    if (a === null) return true; // center block
    return a.d <= cathLaneMax[a.arm][a.lane];
}

// the current (possibly shrunk) home cell for a given arm — always its center lane
function homeCell(arm) {
    var d = cathLaneMax[arm][4];
    if (arm === 'N') return { x: 4, y: 3 - d };
    if (arm === 'S') return { x: 4, y: 5 + d };
    if (arm === 'W') return { x: 3 - d, y: 4 };
    return { x: 5 + d, y: 4 };
}
function cIsStart(x, y) {
    return ['N', 'S', 'E', 'W'].some(function (arm) {
        var h = homeCell(arm); return h.x === x && h.y === y;
    });
}
var CATH_CENTER = { x: 4, y: 4 };
function cIsCenter(x, y) { return x === CATH_CENTER.x && y === CATH_CENTER.y; }
function cCrackable(x, y) { return cIn(x, y) && !cIsStart(x, y) && !cIsCenter(x, y); }
function cCrackAt(x, y) { return cCrackable(x, y) ? (cathCrackMap[cKey(x, y)] || 0) : 0; }
function cIsHole(x, y) { return cCrackAt(x, y) >= CATH_MAX_CRACK; }

// clamp a cell to its lane's current tip if collapse just swept it out of bounds
function clampArm(x, y) {
    var a = armOf(x, y);
    if (!a || a.d <= cathLaneMax[a.arm][a.lane]) return { x: x, y: y };
    var d = cathLaneMax[a.arm][a.lane];
    if (a.arm === 'N') return { x: x, y: 3 - d };
    if (a.arm === 'S') return { x: x, y: 5 + d };
    if (a.arm === 'W') return { x: 3 - d, y: y };
    return { x: 5 + d, y: y };
}

function allStones() {
    var out = [];
    ['B', 'W'].forEach(function (c) { cathStones[c].forEach(function (s) { out.push(s); }); });
    return out;
}
function cPilAt(x, y) {
    return allStones().find(function (s) { return s.x === x && s.y === y; }) || null;
}
function stonesAt(x, y) {
    return allStones().filter(function (s) { return s.x === x && s.y === y; });
}
// the stone (if any) currently riding piggyback on top of s
function riderOf(s) {
    return allStones().find(function (r) { return r.riding && r.riding.col === s.col && r.riding.idx === s.idx; }) || null;
}
function cathReset() {
    cathCrackMap = {};
    cathLaneMax = {
        N: { 3: 3, 4: 3, 5: 3 }, S: { 3: 3, 4: 3, 5: 3 },
        W: { 3: 3, 4: 3, 5: 3 }, E: { 3: 3, 4: 3, 5: 3 }
    };
    var bN = homeCell('N'), bS = homeCell('S'), wW = homeCell('W'), wE = homeCell('E');
    cathStones = {
        B: [{ x: bN.x, y: bN.y, riding: null, col: 'B', idx: 0 }, { x: bS.x, y: bS.y, riding: null, col: 'B', idx: 1 }],
        W: [{ x: wW.x, y: wW.y, riding: null, col: 'W', idx: 0 }, { x: wE.x, y: wE.y, riding: null, col: 'W', idx: 1 }]
    };
    cathTurn = 'W'; cathWinner = null; cathMidMove = null;
    if (window.cathRebuild) window.cathRebuild();
    refreshCath();
}

// central gravity: a hole permanently shortens its own lane by one cell —
// the other two lanes of the arm are untouched, so the edge goes ragged.
// Everything beyond the new tip in that lane falls in — any stranded
// stone is carried along — and if this is the center lane, the arm's
// home cell moves inward with it.
function cathCollapse(x, y) {
    var a = armOf(x, y);
    if (!a || cathLaneMax[a.arm][a.lane] <= CATH_ARM_MIN) return;
    var oldMax = cathLaneMax[a.arm][a.lane];
    cathLaneMax[a.arm][a.lane] = oldMax - 1;
    var newMax = cathLaneMax[a.arm][a.lane];

    Object.keys(cathCrackMap).forEach(function (k) {
        var p = k.split(','), ca = armOf(+p[0], +p[1]);
        if (ca && ca.arm === a.arm && ca.lane === a.lane) delete cathCrackMap[k];
    });

    var moved = [];
    allStones().forEach(function (s) {
        var sa = armOf(s.x, s.y);
        if (sa && sa.arm === a.arm && sa.lane === a.lane && sa.d > newMax) {
            var from = { x: s.x, y: s.y };
            var clamped = clampArm(s.x, s.y);
            s.x = clamped.x; s.y = clamped.y;
            moved.push({ col: s.col, idx: s.idx, from: from, to: { x: s.x, y: s.y } });
        }
    });

    if (window.cathAnimCollapse) window.cathAnimCollapse(a.arm, a.lane, oldMax, newMax, moved);
}

function crackCell(x, y) {
    if (!cCrackable(x, y)) return;
    var k = cKey(x, y);
    var prev = cathCrackMap[k] || 0;
    var lvl = Math.min(CATH_MAX_CRACK, prev + 1);
    cathCrackMap[k] = lvl;
    if (window.cathAnimCrack) window.cathAnimCrack(x, y, lvl);
    if (lvl === CATH_MAX_CRACK && prev < CATH_MAX_CRACK) cathCollapse(x, y);
}

function targetsForStone(s) {
    // a sibling stone is mid-move this turn — nothing else may act
    if (cathMidMove && cathMidMove.col === s.col && cathMidMove.stoneIdx !== s.idx) return [];

    var out = [];

    // RIDER: piggybacking on another stone this turn only lets it dismount
    // alone, to an adjacent empty and unbroken cell.
    if (s.riding) {
        var carrier = cathStones[s.riding.col][s.riding.idx];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var nx = carrier.x + d[0], ny = carrier.y + d[1];
            if (cIn(nx, ny) && !cIsHole(nx, ny) && stonesAt(nx, ny).length === 0)
                out.push({ x: nx, y: ny, kind: 'dismount', stoneIdx: s.idx });
        });
        return out;
    }

    // a stone already carrying a rider can only move the pair onto empty
    // ground (landing on another lone stone would make a triple stack)
    var maxOcc = riderOf(s) ? 0 : 1;

    // STEP 2: this stone already took step 1 this turn — either stop here
    // (tap the current cell, no crack) or finish the move (any direction,
    // including back home) — leaving this cell cracks it behind you.
    if (cathMidMove && cathMidMove.col === s.col && cathMidMove.stoneIdx === s.idx) {
        out.push({ x: s.x, y: s.y, kind: 'stop', stoneIdx: s.idx });
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var nx = s.x + d[0], ny = s.y + d[1];
            if (!cIn(nx, ny) || cIsHole(nx, ny)) return;
            var occ = stonesAt(nx, ny).filter(function (o) { return o !== s; });
            if (occ.length > maxOcc) return;
            var t = { x: nx, y: ny, kind: 'step2', stoneIdx: s.idx };
            if (occ.length === 1) t.hopOn = { col: occ[0].col, idx: occ[0].idx };
            out.push(t);
        });
        return out;
    }

    // STEP 1 — lands on an adjacent, empty, unbroken cell (no crack yet —
    // that only happens if step 2 follows). Landing directly on an
    // adjacent lone stone instead hops on top of it — a complete,
    // single-step action of its own, no crack, no step 2 needed.
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = s.x + d[0], ny = s.y + d[1];
        if (!cIn(nx, ny) || cIsHole(nx, ny)) return;
        var occ = stonesAt(nx, ny);
        if (occ.length === 0) out.push({ x: nx, y: ny, kind: 'step1', stoneIdx: s.idx });
        else if (occ.length === 1 && maxOcc >= 1)
            out.push({ x: nx, y: ny, kind: 'hop', stoneIdx: s.idx, hopOn: { col: occ[0].col, idx: occ[0].idx } });
    });
    // vault over an adjacent stone (or stack) — untouched by cracks, single action
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var mx = s.x + d[0], my = s.y + d[1];
        var jumped = cPilAt(mx, my);
        if (!jumped) return;
        var nx = mx + d[0], ny = my + d[1];
        if (!cIn(nx, ny) || cIsHole(nx, ny)) return;
        var occ = stonesAt(nx, ny);
        if (occ.length <= maxOcc) {
            var t = { x: nx, y: ny, kind: 'vault', stoneIdx: s.idx, overX: mx, overY: my };
            if (occ.length === 1) t.hopOn = { col: occ[0].col, idx: occ[0].idx };
            out.push(t);
        }
    });
    // stuck: no legal move — pass
    if (out.length === 0)
        out.push({ x: s.x, y: s.y, kind: 'stuck', stoneIdx: s.idx });
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
// Rally never cracks ground — that's the tradeoff against the 2-step move.
function dirToward(sx, sy, tx, ty) {
    var dx = tx - sx, dy = ty - sy;
    if (dx === 0) return [0, dy > 0 ? 1 : -1];
    if (dy === 0) return [dx > 0 ? 1 : -1, 0];
    if (Math.abs(dx) >= Math.abs(dy)) return [dx > 0 ? 1 : -1, 0];
    return [0, dy > 0 ? 1 : -1];
}

function cathTryRally(tx, ty) {
    if (cathWinner || cathMidMove || !cIn(tx, ty)) return false;
    var stones = cathStones[cathTurn];
    var moves = [];
    var used = {};
    // compute all target positions first (simultaneous)
    stones.forEach(function (s) {
        if (s.riding) return;
        var maxOcc = riderOf(s) ? 0 : 1;
        var d = dirToward(s.x, s.y, tx, ty);
        var nx = s.x + d[0], ny = s.y + d[1];
        var k = nx + ',' + ny;
        if (!cIn(nx, ny) || used[k] || cIsHole(nx, ny)) return;
        var occ = stonesAt(nx, ny);
        if (occ.length > maxOcc) return;
        used[k] = true;
        moves.push({ stoneIdx: s.idx, x: nx, y: ny, hopOn: occ.length === 1 ? { col: occ[0].col, idx: occ[0].idx } : null });
    });
    if (moves.length === 0) return false;
    moves.forEach(function (t) {
        var s = stones[t.stoneIdx];
        var from = { x: s.x, y: s.y, riding: false };
        var rider = riderOf(s);
        s.x = t.x; s.y = t.y;
        if (t.hopOn) s.riding = { col: t.hopOn.col, idx: t.hopOn.idx };
        if (rider) { rider.x = s.x; rider.y = s.y; }
        if (window.cathAnimMove) window.cathAnimMove(s.col, s.idx, from, { x: s.x, y: s.y, riding: !!s.riding });
        if (rider && window.cathAnimMove) window.cathAnimMove(rider.col, rider.idx, from, { x: rider.x, y: rider.y, riding: true });
    });
    cathAfter();
    return true;
}

// --- Win condition ---
// Each colour wins by occupying the OTHER colour's (current) home cells.
function cathCheckWin() {
    var wHome = [homeCell('W'), homeCell('E')], bHome = [homeCell('N'), homeCell('S')];
    if (wHome.every(function (t) { return cathStones.B.some(function (s) { return s.x === t.x && s.y === t.y; }); })) return 'B';
    if (bHome.every(function (t) { return cathStones.W.some(function (s) { return s.x === t.x && s.y === t.y; }); })) return 'W';
    return null;
}

function cathTapTarget(t) {
    if (cathWinner) return;
    var stones = cathStones[cathTurn];
    var s = stones[t.stoneIdx];
    if (!s) return;
    var legal = targetsForStone(s).some(function (q) {
        return q.x === t.x && q.y === t.y && q.kind === t.kind
            && (t.kind !== 'vault' || (q.overX === t.overX && q.overY === t.overY));
    });
    if (!legal) return;

    if (t.kind === 'stop') { cathMidMove = null; cathAfter(); return; }

    var from = { x: s.x, y: s.y, riding: !!s.riding };

    if (t.kind === 'dismount') {
        s.riding = null;
        s.x = t.x; s.y = t.y;
        cathAnim(s, from);
        cathAfter();
        return;
    }
    if (t.kind === 'stuck') { cathAfter(); return; }

    var tx = t.x, ty = t.y;
    if (t.kind === 'step2') {
        crackCell(s.x, s.y); // leaving this cell cracks it behind you
        var clamped = clampArm(tx, ty); // collapse may have just swept the destination in
        tx = clamped.x; ty = clamped.y;
    }

    var rider = riderOf(s);
    s.x = tx; s.y = ty;
    if (t.hopOn) s.riding = { col: t.hopOn.col, idx: t.hopOn.idx };
    if (rider) { rider.x = s.x; rider.y = s.y; }
    cathAnim(s, from);
    if (rider) cathAnim(rider, from);

    if (t.kind === 'step1') {
        cathMidMove = { col: cathTurn, stoneIdx: s.idx };
        refreshCath(); // update board/prompt, turn does not pass yet
        return;
    }

    cathMidMove = null; // step2, vault
    cathAfter();
}

function cathAnim(s, from) {
    if (window.cathAnimMove)
        window.cathAnimMove(s.col, s.idx, from, { x: s.x, y: s.y, riding: !!s.riding });
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
        cells.push({ x: x, y: y, crack: cCrackAt(x, y), start: cIsStart(x, y), center: cIsCenter(x, y), inPlay: cIn(x, y) });
    }
    var pilgrims = {};
    ['B', 'W'].forEach(function (c) {
        pilgrims[c] = cathStones[c].map(function (s) { return { x: s.x, y: s.y, riding: s.riding, idx: s.idx, col: s.col }; });
    });
    return {
        turn: cathTurn, winner: cathWinner, pilgrims: pilgrims,
        cells: cells,
        targets: cathAllTargets(cathTurn),
        midMove: cathMidMove,
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
    if (prompt) prompt.textContent = cathMidMove
        ? who + ', tap your stone to stop, or a ring to finish the move (step 2 of 2)'
        : who + ', tap a stone, a ring, or any cell to rally';
    if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
}

window.getCathState = getCathState;
window.cathReset = cathReset;
window.cathTapTarget = cathTapTarget;
window.cathTryRally = cathTryRally;
window.refreshCath = refreshCath;
