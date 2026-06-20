// COLOSSEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Concentric-ring arena. Armies start on the elevated safe outer ring and
// descend to fight in the arena: majority takes a cell, ties stand off (lock),
// claimed cells become territory you can redeploy to. Last army standing wins.
// Tilt mechanic: the stone controlling the centre tilts the arena, flipping
// the direction of the single-step JUMP (inward vs outward).

// ============================================
// BOARD MODEL — 5 rings, 89 cells
//   ring 0: centre (id 0)
//   ring 1: 8   (ids 1..8)
//   ring 2: 16  (ids 9..24)
//   ring 3: 32  (ids 25..56)   — arena
//   ring 4: 32  (ids 57..88)   — elevated SAFE ring
// ============================================
var COL_COUNTS = [1, 8, 16, 32, 32];

function colRing(c) { return c === 0 ? 0 : c <= 8 ? 1 : c <= 24 ? 2 : c <= 56 ? 3 : 4; }
function colSector(c) { return c === 0 ? 0 : c <= 8 ? c - 1 : c <= 24 ? c - 9 : c <= 56 ? c - 25 : c - 57; }
function colId(ring, sec) { return ring === 0 ? 0 : ring === 1 ? 1 + sec : ring === 2 ? 9 + sec : ring === 3 ? 25 + sec : 57 + sec; }

// centre-high target heights for each tilt state
var COL_TILT_H = {
    flat: [0, 7, 15, 24, 44],
    up:   [50, 38, 26, 12, 0],
    down: [0, 12, 26, 38, 50]
};

// ============================================
// COLORS / SETUP
// ============================================
var COL_COLORS = {
    W: { name: 'White', stone: 0xf4efe4, terr: 0xc8ddb8, hi: 0x90c880 },
    B: { name: 'Black', stone: 0x1d1d1d, terr: 0x4a4a4a, hi: 0x666666 },
    Bl: { name: 'Blue', stone: 0x2a5db0, terr: 0xa8c4e0, hi: 0x68a0d0 },
    R: { name: 'Red', stone: 0xc02828, terr: 0xe0a8a8, hi: 0xd06060 }
};
var COL_SETUP = {
    2: [{ color: 'B', start: 0 }, { color: 'W', start: 16 }],
    3: [{ color: 'B', start: 0 }, { color: 'Bl', start: 8 }, { color: 'W', start: 16 }],
    4: [{ color: 'B', start: 0 }, { color: 'Bl', start: 8 }, { color: 'W', start: 16 }, { color: 'R', start: 24 }]
};

// ============================================
// STATE
// ============================================
var colStones = [];        // { id, color, cell }
var colSelected = null;    // id
var colTurn = 'W';
var colNextId = 1;
var colTerritory = {};     // cell -> color
var colPlayers = ['B', 'W'];
var colPlayerCount = 2;
var colBusy = false;
var colGameOver = false;
var colIsComputer = {};    // color -> bool

var colTilt = 'flat';                // 'flat' | 'up' | 'down'
var colTiltStone = null;             // id of the stone currently controlling the tilt
var colTiltPending = null;           // 'up' | 'down' | 'flat' when choosing

window.getColState = function () {
    var sel = colSelected !== null ? colStones.find(function (s) { return s.id === colSelected; }) : null;
    return {
        stones: colStones, selected: colSelected, selStone: sel, turn: colTurn,
        territory: colTerritory, players: colPlayers, busy: colBusy, gameOver: colGameOver,
        validCells: sel ? colMoveOptions(sel) : [],
        tilt: colTilt, tiltStone: colTiltStone, tiltPending: colTiltPending
    };
};
window.colInfo = { ringOf: colRing, sectorOf: colSector, idOf: colId, counts: COL_COUNTS, colors: COL_COLORS };
window.colIsStandoff = isStandoff;
window.colMoveOptionsFor = colMoveOptions;

function colSetTilt(t) {
    if (colTiltPending === null) return;
    colTilt = t;
    colTiltPending = null;
    hideTiltArrows();
    if (window.colAnimateTilt) window.colAnimateTilt(colTilt);
    if (window.colUpdateViews) window.colUpdateViews();
}
function showTiltArrows() {
    var el = document.getElementById('tilt-arrows');
    if (el) el.classList.add('visible');
}
function hideTiltArrows() {
    var el = document.getElementById('tilt-arrows');
    if (el) el.classList.remove('visible');
}
window.colSetTilt = colSetTilt;

// ============================================
// DOM
// ============================================
var statusIndicator = document.getElementById('player-indicator');
var statusName = document.getElementById('player-name');
var countsEl = document.getElementById('col-counts');
var resetButton = document.getElementById('reset-button');
var messageBox = document.getElementById('message-box');
var messageTitle = document.getElementById('message-title');
var messageText = document.getElementById('message-text');
var gameMessage = document.getElementById('game-message');
var actionPrompt = document.getElementById('action-prompt');

function showMessage(t, d) {
    if (!gameMessage) return;
    gameMessage.textContent = t; gameMessage.classList.remove('hidden');
    clearTimeout(window.msgTimeout);
    window.msgTimeout = setTimeout(function () { gameMessage.classList.add('hidden'); }, d || 2400);
}
function setPrompt(t) { if (actionPrompt) actionPrompt.textContent = t || ''; }

// ============================================
// RULES
// ============================================
function stonesAt(cell) { return colStones.filter(function (s) { return s.cell === cell; }); }

function isStandoff(cell) {
    if (colRing(cell) === 4) return false;
    var on = stonesAt(cell);
    var colors = [...new Set(on.map(function (s) { return s.color; }))];
    if (colors.length < 2) return false;
    var counts = {};
    on.forEach(function (s) { counts[s.color] = (counts[s.color] || 0) + 1; });
    var vals = Object.values(counts);
    return vals.every(function (v) { return v === vals[0]; });
}

function colJumpInward(r, s, color) {
    if (r === 0) return [];
    var cell;
    if (r === 4) cell = colId(3, s);
    else if (r === 3) cell = colId(2, Math.floor(s / 2));
    else if (r === 2) cell = colId(1, Math.floor(s / 2));
    else cell = 0;
    // jump can land on empty or enemy (fight/standoff)
    return [cell];
}
function colJumpOutward(r, s, color) {
    var cells = [];
    if (r === 0) { for (var i = 0; i < 8; i++) cells.push(colId(1, i)); }
    else if (r === 1) { cells.push(colId(2, s * 2), colId(2, s * 2 + 1)); }
    else if (r === 2) { cells.push(colId(3, s * 2), colId(3, s * 2 + 1)); }
    else if (r === 3) { var c = colId(4, s); if (!colStones.some(function (x) { return x.cell === c; })) cells.push(c); }
    return cells;
}

function colMoveOptions(stone) {
    var r = colRing(stone.cell), s = colSector(stone.cell), color = stone.color;
    var dests = new Set();

    // Jump direction depends on tilt:
    //   flat / down → jump OUTWARD (toward the edge), run INWARD (multi-step)
    //   up          → jump INWARD (toward centre),  run OUTWARD (multi-step)
    var jumpIn = colTilt === 'up';
    var jumpOut = !jumpIn;

    // — multi-step run INWARD (always available; downhill when tilt=down)
    if (r > 0) {
        var cr = r, cs = s;
        while (cr > 0) {
            var nextCell;
            if (cr === 4)      { nextCell = colId(3, cs); cr = 3; }
            else if (cr === 3) { var ps = Math.floor(cs / 2); nextCell = colId(2, ps); cr = 2; cs = ps; }
            else if (cr === 2) { var ps = Math.floor(cs / 2); nextCell = colId(1, ps); cr = 1; cs = ps; }
            else               { nextCell = 0; cr = 0; }

            var occ = stonesAt(nextCell);
            var hasEnemy = occ.some(function (x) { return x.color !== color; });
            if (occ.length === 0) { dests.add(nextCell); }
            else if (hasEnemy)    { dests.add(nextCell); break; }
            /* own stones only — may run past them */
        }
    }

    // — multi-step run OUTWARD when tilt=up (downhill toward the lower edge)
    if (colTilt === 'up') {
        var cr = r, cs = s;
        while (cr < 4) {
            var outCells = [];
            if (cr === 0) { for (var i = 0; i < 8; i++) outCells.push({ r: 1, s: i }); }
            else if (cr === 1) { outCells.push({ r: 2, s: cs * 2 }, { r: 2, s: cs * 2 + 1 }); }
            else if (cr === 2) { outCells.push({ r: 3, s: cs * 2 }, { r: 3, s: cs * 2 + 1 }); }
            else if (cr === 3) { outCells.push({ r: 4, s: cs }); }

            var blocked = true;
            outCells.forEach(function (oc) {
                var cell = colId(oc.r, oc.s);
                if (oc.r === 4 && colStones.some(function (x) { return x.cell === cell; })) return;
                var occ = stonesAt(cell);
                var hasEnemy = occ.some(function (x) { return x.color !== color; });
                if (occ.length === 0) { dests.add(cell); blocked = false; }
                else if (hasEnemy)    { dests.add(cell); }
                else                  { blocked = false; } // own stones — keep going
            });
            if (blocked) break;
            // advance along first unblocked branch
            var next = null;
            for (var i = 0; i < outCells.length; i++) {
                var c = colId(outCells[i].r, outCells[i].s);
                var o = stonesAt(c);
                var e = o.some(function (x) { return x.color !== color; });
                if (o.length === 0 || (o.length > 0 && !e)) { next = outCells[i]; break; }
            }
            if (!next) break;
            cr = next.r; cs = next.s;
        }
    }

    // — circle run (always available)
    if (COL_COUNTS[r] > 1) {
        [1, -1].forEach(function (dir) {
            for (var k = 1; k < COL_COUNTS[r]; k++) {
                var nc = colId(r, (s + dir * k + COL_COUNTS[r]) % COL_COUNTS[r]);
                var occ = stonesAt(nc);
                var hasEnemy = occ.some(function (x) { return x.color !== color; });
                if (occ.length === 0) { dests.add(nc); }
                else if (hasEnemy)    { dests.add(nc); break; }
                /* own stones — past them */
            }
        });
    }

    // — single-step jump
    var jumpCells = jumpIn ? colJumpInward(r, s, color) : colJumpOutward(r, s, color);
    jumpCells.forEach(function (c) { dests.add(c); });

    // — territory redeploy (rings 1–3)
    Object.entries(colTerritory).forEach(function (e) {
        var c = Number(e[0]);
        if (e[1] === color && c !== stone.cell && colRing(c) !== 4) dests.add(c);
    });

    return [...dests];
}

function resolveConflicts() {
    var byCell = {};
    colStones.forEach(function (s) { (byCell[s.cell] || (byCell[s.cell] = [])).push(s); });
    var removed = [];
    Object.entries(byCell).forEach(function (e) {
        var cell = Number(e[0]), stones = e[1];
        if (colRing(cell) === 4) return;
        var colors = [...new Set(stones.map(function (s) { return s.color; }))];
        if (colors.length <= 1) return;
        var counts = {};
        stones.forEach(function (s) { counts[s.color] = (counts[s.color] || 0) + 1; });
        var maxCount = Math.max.apply(null, Object.values(counts));
        stones.forEach(function (s) { if (counts[s.color] !== maxCount) removed.push(s); });
    });
    if (removed.length) {
        var ids = new Set(removed.map(function (s) { return s.id; }));
        colStones = colStones.filter(function (s) { return !ids.has(s.id); });
    }
    return removed;
}

// ============================================
// INTERACTION
// ============================================
function colTap(cell) {
    if (colBusy || colGameOver) return;
    if (colSelected !== null) {
        var s = colStones.find(function (x) { return x.id === colSelected; });
        if (s && colMoveOptions(s).indexOf(cell) !== -1) { doMove(s, cell); return; }
        // re-select own stone on another cell
        var mine = stonesAt(cell).filter(function (x) { return x.color === colTurn; });
        if (mine.length && !isStandoff(cell) && mine[0].id !== colSelected) { colSelected = mine[0].id; refresh(); return; }
        colSelected = null; refresh();
        return;
    }
    var here = stonesAt(cell).filter(function (x) { return x.color === colTurn; });
    if (here.length && !isStandoff(cell)) { colSelected = here[0].id; refresh(); }
    else if (here.length) showMessage('Those stones are locked in a standoff.');
}
window.colTap = colTap;

function doMove(s, cell) {
    colBusy = true;
    var from = s.cell;
    var apply = function () {
        s.cell = cell;
        if (cell !== 0 && colRing(cell) !== 4) colTerritory[cell] = s.color;
        colSelected = null;

        // tilt control — entering centre shows arrow picker
        if (cell === 0) {
            if (colTiltStone === null) {
                colTiltPending = 'flat';
                colTiltStone = s.id;
                showTiltArrows();
            }
        }
        // if the tilt-controlling stone moved away from centre, reset
        if (colTiltStone !== null && colTiltStone === s.id && cell !== 0) {
            colTilt = 'flat';
            colTiltStone = null;
            colTiltPending = null;
            hideTiltArrows();
            if (window.colAnimateTilt) window.colAnimateTilt('flat');
        }

        var removed = resolveConflicts();

        // if the tilt-controlling stone was removed in combat, reset
        if (colTiltStone !== null && !colStones.some(function (x) { return x.id === colTiltStone; })) {
            colTilt = 'flat';
            colTiltStone = null;
            colTiltPending = null;
            hideTiltArrows();
            if (window.colAnimateTilt) window.colAnimateTilt('flat');
        }

        // Eliminate commanders reduced below 4 stones
        var elimMsgs = [];
        colPlayers.forEach(function (p) {
            var cnt = colStones.filter(function (x) { return x.color === p; }).length;
            if (cnt < 4 && cnt > 0) {
                elimMsgs.push(COL_COLORS[p].name);
                colStones.filter(function (x) { return x.color === p; }).forEach(function (x) { removed.push(x); });
                colStones = colStones.filter(function (x) { return x.color !== p; });
            }
        });

        // if tilt-controlling stone was eliminated, reset
        if (colTiltStone !== null && !colStones.some(function (x) { return x.id === colTiltStone; })) {
            colTilt = 'flat'; colTiltStone = null; colTiltPending = null; hideTiltArrows();
            if (window.colAnimateTilt) window.colAnimateTilt('flat');
        }

        var finish = function () {
            colBusy = false;
            if (elimMsgs.length) showMessage(elimMsgs.join(', ') + ' eliminated from the arena!');
            else if (removed.length) showMessage(removed.length + ' outnumbered stone' + (removed.length > 1 ? 's' : '') + ' cleared from the sand.');
            nextTurn();
        };
        if (removed.length && window.colAnimRemove) window.colAnimRemove(removed, finish); else finish();
    };
    if (window.colAnimMove) window.colAnimMove(s, from, cell, apply); else apply();
}

function nextTurn() {
    var alive = colPlayers.filter(function (p) { return colStones.some(function (s) { return s.color === p; }); });
    if (alive.length <= 1) { endGame(alive[0] || null); return; }
    var idx = (colPlayers.indexOf(colTurn) + 1) % colPlayers.length, tries = 0;
    while (!colStones.some(function (s) { return s.color === colPlayers[idx]; }) && tries < colPlayers.length) { idx = (idx + 1) % colPlayers.length; tries++; }
    colTurn = colPlayers[idx];
    if (colTiltPending !== null) { colSetTilt('flat'); }
    refresh();
    if (!colGameOver && colIsComputer[colTurn]) setTimeout(colAI, 800);
}

function endGame(winner) {
    colGameOver = true;
    refresh();
    var title = winner ? COL_COLORS[winner].name + ' Wins!' : 'Draw';
    var text = winner ? COL_COLORS[winner].name + ' is the last commander standing in the arena!' : 'No commanders remain.';
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    if (messageBox) messageBox.classList.add('visible');
    if (window.colVictory) window.colVictory(winner);
}

// ============================================
// HUD / REFRESH
// ============================================
function refresh() {
    if (statusName) statusName.textContent = COL_COLORS[colTurn].name + "'s Turn";
    if (statusIndicator) statusIndicator.style.backgroundColor = '#' + COL_COLORS[colTurn].stone.toString(16).padStart(6, '0');
    if (countsEl) {
        countsEl.innerHTML = colPlayers.map(function (p) {
            var n = colStones.filter(function (s) { return s.color === p; }).length;
            var dead = n === 0 ? ' style="opacity:.35;text-decoration:line-through"' : '';
            return '<span class="col-count"' + dead + '><span class="col-dot" style="background:#' + COL_COLORS[p].stone.toString(16).padStart(6, '0') + '"></span>' + n + '</span>';
        }).join('');
    }
    var st = window.getColState();
    setPrompt(st.gameOver ? '' : (st.selStone
        ? 'Tap a highlighted cell to move (or your territory to redeploy) — tap the stone again to deselect.'
        : COL_COLORS[colTurn].name + ': tap one of your stones. Outer ring is safe; equal forces stand off.'));
    if (window.is3DView && window.colSync3D) window.colSync3D();
    if (window.is3DView && window.colUpdateViews) window.colUpdateViews();
}

// ============================================
// AI
// ============================================
function colAI() {
    if (colGameOver || colBusy) return;
    // if a tilt choice is pending, pick randomly
    if (colTiltPending !== null) {
        var choices = ['up', 'down', 'flat'];
        colSetTilt(choices[Math.floor(Math.random() * 3)]);
        return;
    }
    var myStones = colStones.filter(function (s) { return s.color === colTurn; });
    if (!myStones.length) return;
    var bestMove = null, bestScore = -Infinity;
    myStones.forEach(function (s) {
        colMoveOptions(s).forEach(function (c) {
            var score = Math.random();
            var at = stonesAt(c);
            var myCount = at.filter(function (x) { return x.color === s.color; }).length + 1;
            var opps = {};
            at.forEach(function (x) { if (x.color !== s.color) opps[x.color] = (opps[x.color] || 0) + 1; });
            Object.keys(opps).forEach(function (oc) { if (myCount > opps[oc]) score += 100; });
            if (colRing(c) >= 1 && colRing(c) <= 3 && colTerritory[c] !== s.color) score += 10;
            if (colRing(c) === 4) score += 5;
            if (score > bestScore) { bestScore = score; bestMove = { stone: s, cell: c }; }
        });
    });
    if (bestMove) doMove(bestMove.stone, bestMove.cell);
}

function toggleColOpponent() {
    var opp = colPlayers.find(function (x) { return x !== 'W'; });
    if (!opp) return;
    colIsComputer[opp] = !colIsComputer[opp];
    var ob = document.getElementById('col-opponent-btn');
    if (ob) ob.textContent = 'Opponent: ' + (colIsComputer[opp] ? 'Computer' : 'Human');
    showMessage(colIsComputer[opp] ? 'Computer opponent' : 'Human opponent');
}
window.toggleColOpponent = toggleColOpponent;

// ============================================
// SETUP
// ============================================
function newColosseum() {
    colStones = []; colSelected = null; colTerritory = {}; colNextId = 1;
    colBusy = false; colGameOver = false;
    colTilt = 'flat'; colTiltStone = null; colTiltPending = null; hideTiltArrows();
    if (messageBox) messageBox.classList.remove('visible');
    colPlayers = COL_SETUP[colPlayerCount].map(function (p) { return p.color; });
    // Set AI defaults
    colPlayers.forEach(function (p) {
        if (p === 'W') colIsComputer[p] = false;
        else colIsComputer[p] = colPlayerCount > 2 || !!colIsComputer[p];
    });
    var ob = document.getElementById('col-opponent-btn');
    if (ob) {
        if (colPlayerCount > 2) ob.style.display = 'none';
        else { ob.style.display = ''; ob.textContent = 'Opponent: ' + (colIsComputer[colPlayers.find(function (x) { return x !== 'W'; })] ? 'Computer' : 'Human'); }
    }
    COL_SETUP[colPlayerCount].forEach(function (setup) {
        for (var i = 0; i < 8; i++) {
            var cell = colId(4, (setup.start + i) % 32);
            colStones.push({ id: colNextId++, color: setup.color, cell: cell });
        }
    });
    colTurn = 'W';
    if (window.is3DView && window.colRebuild) window.colRebuild();
    refresh();
}
window.newColosseum = newColosseum;

function setColPlayerCount(n) {
    colPlayerCount = n;
    [2, 3, 4].forEach(function (k) {
        var b = document.getElementById('col-btn-' + k + 'p');
        if (b) b.classList.toggle('active', k === n);
    });
    newColosseum();
    showMessage(n + '-player arena');
}
window.setColPlayerCount = setColPlayerCount;

if (resetButton) resetButton.addEventListener('click', function () { newColosseum(); showMessage('The arena is reset.'); });

document.addEventListener('DOMContentLoaded', function () {
    // default 2 players
    var b2 = document.getElementById('col-btn-2p'); if (b2) b2.classList.add('active');
    newColosseum();
});
