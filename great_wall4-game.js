// GREAT WALL — CROSSING (4 Player) - Seven Wonders Series
// Game Design: Simon Allmer
// Four armies meet where two walls cross. Rule logic ported from the 2-player
// Great Wall, generalised to a plus-shaped board and four supply lines.

// ============================================
// CONSTANTS
// ============================================
// The board is a 25x25 lattice, but only the plus is walkable: a horizontal band
// of 5 rows crossing a vertical band of 5 cols. The central 5x5 is the crossing,
// and each of the four arms is a 10x5 field — long enough that the armies don't
// crash together in the middle too soon.
var GW_N = 25;
var GW_ARM_LO = 10;  // first index of the central band
var GW_ARM_HI = 14;  // last index of the central band
// Legacy aliases some shared helpers still reference.
var GW_ROWS = GW_N;
var GW_COLS = GW_N;

// 8 directions, clockwise from North. row 0 = North edge, col 0 = West edge.
var DIRS = [
    { n: 'N',  dr: -1, dc:  0 },
    { n: 'NE', dr: -1, dc:  1 },
    { n: 'E',  dr:  0, dc:  1 },
    { n: 'SE', dr:  1, dc:  1 },
    { n: 'S',  dr:  1, dc:  0 },
    { n: 'SW', dr:  1, dc: -1 },
    { n: 'W',  dr:  0, dc: -1 },
    { n: 'NW', dr: -1, dc: -1 },
];
var DIR_GLYPH = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

function oppDir(i) { return (i + 4) % 8; }
function back3(facing) {
    var o = oppDir(facing);
    return new Set([(o + 7) % 8, o, (o + 1) % 8]);
}

// A cell is on the board only if it lies in the horizontal band OR the vertical band.
function onBoard(r, c) {
    if (r < 0 || r >= GW_N || c < 0 || c >= GW_N) return false;
    var inH = (r >= GW_ARM_LO && r <= GW_ARM_HI);
    var inV = (c >= GW_ARM_LO && c <= GW_ARM_HI);
    return inH || inV;
}

// ---- Players --------------------------------------------------------------
// Seating matches Temple / Cathedral: White south, Red west, Black north, Blue east.
var PLAYERS = ['W', 'R', 'B', 'U'];
var PNAME = { W: 'White', R: 'Red', B: 'Black', U: 'Blue' };
var GW_CENTER = (GW_N - 1) / 2; // (12,12) is the heart of the crossing

// Each army's Legendary supply field sits at the tip of its arm.
var SUPPLY = {
    W: { r: GW_N - 1, c: GW_CENTER },   // south tip
    B: { r: 0,        c: GW_CENTER },   // north tip
    R: { r: GW_CENTER, c: 0 },          // west tip
    U: { r: GW_CENTER, c: GW_N - 1 },   // east tip
};
function supplyOf(color) { return SUPPLY[color]; }
function isLegendary(r, c) {
    for (var k in SUPPLY) { if (SUPPLY[k].r === r && SUPPLY[k].c === c) return true; }
    return false;
}
function legendaryOwner(r, c) {
    for (var k in SUPPLY) { if (SUPPLY[k].r === r && SUPPLY[k].c === c) return k; }
    return null;
}

window.GW_N = GW_N;
window.GW_ROWS = GW_N;
window.GW_COLS = GW_N;
window.GW_ARM_LO = GW_ARM_LO;
window.GW_ARM_HI = GW_ARM_HI;
window.GW_CENTER = GW_CENTER;
window.DIRS = DIRS;
window.PLAYERS = PLAYERS;
window.PNAME = PNAME;
window.onBoard = onBoard;
window.isLegendary = isLegendary;
window.legendaryOwner = legendaryOwner;
window.supplyOf = supplyOf;
window.back3 = back3;

// ============================================
// GAME STATE
// ============================================
var warriors = [];          // { id, color, r, c, facing }
var reserve = { W: 10, R: 10, B: 10, U: 10 };
var alive = { W: true, R: true, B: true, U: true };
var turn = 'W';
var mode = 'place';         // 'place' | 'move' | 'shoot' | 'spin'
var nextId = 1;
var selectedWarrior = null;
var previewWarriorId = null;
var busy = false;
var gameOver = false;
var isVsComputer = true;
var HUMAN = 'W';
var hiddenFacing = false;
var _validPlaceCache = null;
var lastChain = [];
var facingSelect = null;
var MIN_FORCE = 4;

window.getGWState = function () {
    return { warriors: warriors, reserve: reserve, alive: alive, players: PLAYERS,
             turn: turn, mode: mode,
             selectedWarrior: selectedWarrior, previewWarriorId: previewWarriorId,
             busy: busy, gameOver: gameOver, hiddenFacing: hiddenFacing, lastChain: lastChain,
             facingSelect: facingSelect };
};

// ============================================
// DOM ELEMENTS
// ============================================
var statusIndicator = document.getElementById('player-indicator');
var statusName = document.getElementById('player-name');
var resetButton = document.getElementById('reset-button');
var opponentButton = document.getElementById('opponent-btn');
var facingButton = document.getElementById('facing-btn');
var messageBox = document.getElementById('message-box');
var messageTitle = document.getElementById('message-title');
var messageText = document.getElementById('message-text');
var gameMessage = document.getElementById('game-message');
var actionPrompt = document.getElementById('action-prompt');

function showMessage(text, duration) {
    if (!gameMessage) return;
    duration = duration || 2600;
    gameMessage.textContent = text;
    gameMessage.classList.remove('hidden');
    clearTimeout(window.msgTimeout);
    window.msgTimeout = setTimeout(function () { gameMessage.classList.add('hidden'); }, duration);
}

function setPrompt(text) { if (actionPrompt) actionPrompt.textContent = ''; }

// ============================================
// RULE HELPERS
// ============================================
function warriorAt(r, c) {
    for (var i = 0; i < warriors.length; i++) if (warriors[i].r === r && warriors[i].c === c) return warriors[i];
    return null;
}
window.warriorAt = warriorAt;

function cheb(r1, c1, r2, c2) { return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)); }

// Clear stepping-stone between two cells 2 apart: a shared neighbour not held by an enemy.
function pathClear(fr, fc, tr, tc, color) {
    var d = cheb(fr, fc, tr, tc);
    if (d === 0) return false;
    if (d === 1) return true;
    if (d !== 2) return false;
    for (var ir = fr - 1; ir <= fr + 1; ir++) {
        for (var ic = fc - 1; ic <= fc + 1; ic++) {
            if (ir === fr && ic === fc) continue;
            if (!onBoard(ir, ic)) continue;
            if (cheb(ir, ic, tr, tc) !== 1) continue;
            var w = warriorAt(ir, ic);
            if (!w || w.color === color) return true;
        }
    }
    return false;
}

// Supply-chain BFS. Returns Set of "r,c" cells where `color` may place.
function validPlacements(color) {
    if (_validPlaceCache && _validPlaceCache.color === color) return _validPlaceCache.set;
    var result = new Set();
    lastChain = [];
    if (reserve[color] > 0) {
        var sup = supplyOf(color);
        var supStone = warriorAt(sup.r, sup.c);
        var myStones = warriors.filter(function (w) { return w.color === color; });

        var chain = [];
        var inChain = new Set();
        function addNode(r, c) {
            var k = r + ',' + c;
            if (inChain.has(k)) return;
            inChain.add(k);
            chain.push({ r: r, c: c });
        }
        if (!supStone || supStone.color === color) addNode(sup.r, sup.c);

        for (var i = 0; i < chain.length; i++) {
            var node = chain[i];
            for (var s = 0; s < myStones.length; s++) {
                var st = myStones[s];
                if (inChain.has(st.r + ',' + st.c)) continue;
                var d = cheb(st.r, st.c, node.r, node.c);
                if (d >= 1 && d <= 2 && pathClear(node.r, node.c, st.r, st.c, color)) addNode(st.r, st.c);
            }
        }
        chain.forEach(function (node) {
            for (var r = 0; r < GW_N; r++) {
                for (var c = 0; c < GW_N; c++) {
                    if (!onBoard(r, c)) continue;
                    if (warriorAt(r, c)) continue;
                    var d = cheb(r, c, node.r, node.c);
                    if (d >= 1 && d <= 2 && pathClear(node.r, node.c, r, c, color)) result.add(r + ',' + c);
                }
            }
        });
        lastChain = chain;
    }
    _validPlaceCache = { color: color, set: result };
    return result;
}
window.validPlacements = validPlacements;

function movePathClear(fr, fc, tr, tc) {
    if (cheb(fr, fc, tr, tc) === 1) return true;
    for (var ir = fr - 1; ir <= fr + 1; ir++) {
        for (var ic = fc - 1; ic <= fc + 1; ic++) {
            if (ir === fr && ic === fc) continue;
            if (!onBoard(ir, ic)) continue;
            if (cheb(ir, ic, tr, tc) !== 1) continue;
            if (!warriorAt(ir, ic)) return true;
        }
    }
    return false;
}

function validMoves(w) {
    var moves = [];
    for (var r = 0; r < GW_N; r++) {
        for (var c = 0; c < GW_N; c++) {
            if (!onBoard(r, c)) continue;
            if (warriorAt(r, c)) continue;
            var d = cheb(w.r, w.c, r, c);
            if (d >= 1 && d <= 2 && movePathClear(w.r, w.c, r, c)) moves.push({ r: r, c: c });
        }
    }
    return moves;
}
window.validMoves = validMoves;

function deflect(v, f) {
    var cand = [(f + 2) % 8, (f + 6) % 8];
    var best = cand[0], bd = -9;
    for (var i = 0; i < cand.length; i++) {
        var d = cand[i];
        var dot = DIRS[d].dr * DIRS[v].dr + DIRS[d].dc * DIRS[v].dc;
        if (dot > bd) { bd = dot; best = d; }
    }
    return best;
}

// Arrow resolution. Returns { path, kills, marks }.
function computeArrow(sr, sc, dir) {
    var removed = new Set();
    var path = [{ r: sr, c: sc }];
    var kills = [];
    var marks = [];
    var r = sr, c = sc, v = dir, steps = 0;
    var seen = new Set();
    while (steps++ < 400) {
        var stateKey = r + ',' + c + ',' + v;
        if (seen.has(stateKey)) { marks.push({ idx: path.length - 1, type: 'spent' }); break; }
        seen.add(stateKey);
        r += DIRS[v].dr; c += DIRS[v].dc;
        if (!onBoard(r, c)) { path.push({ r: r, c: c, out: true }); marks.push({ idx: path.length - 1, type: 'out' }); break; }
        path.push({ r: r, c: c });
        var w = warriorAt(r, c);
        if (w && !removed.has(w.id)) {
            var side = oppDir(v);
            var front = oppDir(w.facing);
            var guard = back3(w.facing);
            if (side === front) {
                marks.push({ idx: path.length - 1, type: 'reflect' });
                v = oppDir(v);
            } else if (guard.has(side)) {
                marks.push({ idx: path.length - 1, type: 'deflect' });
                v = deflect(v, w.facing);
            } else {
                kills.push(w.id);
                removed.add(w.id);
                marks.push({ idx: path.length - 1, type: 'kill', id: w.id });
                v = w.facing;
                seen.clear();
            }
        }
    }
    return { path: path, kills: kills, marks: marks };
}

function computeSpin(att) {
    var kills = [];
    for (var d = 0; d < 8; d++) {
        var r = att.r + DIRS[d].dr, c = att.c + DIRS[d].dc;
        if (!onBoard(r, c)) continue;
        var w = warriorAt(r, c);
        if (w && w.id !== att.id) {
            var side = oppDir(d);
            if (!back3(w.facing).has(side)) kills.push(w.id);
        }
    }
    return kills;
}

function totalForce(color) {
    return warriors.filter(function (w) { return w.color === color; }).length + reserve[color];
}

function colorName(c) { return PNAME[c] || c; }

// ============================================
// HUD / RENDERING
// ============================================
function boardCount(color) { return warriors.filter(function (w) { return w.color === color; }).length; }

function drawBoard() {
    PLAYERS.forEach(function (c) {
        var bc = document.getElementById('hud-' + c + '-count');
        var rc = document.getElementById('hud-' + c + '-res');
        if (bc) bc.textContent = boardCount(c);
        if (rc) rc.textContent = reserve[c];
        var item = document.getElementById('hud-item-' + c);
        if (item) {
            item.classList.toggle('dead', !alive[c]);
            item.classList.toggle('active-turn', c === turn && !gameOver);
        }
    });

    if (statusName) statusName.textContent = colorName(turn) + "'s Turn";
    if (statusIndicator) statusIndicator.style.background = TURN_CSS[turn] || '#fff';

    var hasPlace = !gameOver && reserve[turn] > 0 && validPlacements(turn).size > 0;
    var hasOwn = !gameOver && warriors.some(function (w) { return w.color === turn; });
    setChip('act-place', hasPlace);
    setChip('act-move', hasOwn);
    setChip('act-shoot', hasOwn);
    setChip('act-spin', hasOwn);

    if (window.is3DView && typeof window.sync3D === 'function') window.sync3D();
    if (window.is3DView && typeof window.update3DViews === 'function') window.update3DViews();
}
var TURN_CSS = { W: '#efe7d3', R: '#c14a3d', B: '#1a1a1a', U: '#4d7ec8' };

function setChip(id, enabled) {
    var el = document.getElementById(id);
    if (!el) return;
    el.disabled = !enabled || busy;
    el.classList.toggle('active', id === 'act-' + mode && !gameOver);
}

// ============================================
// INTERACTION
// ============================================
function setMode(m) {
    if (busy || gameOver) return;
    if (facingSelect) {
        if (!facingSelect.cancellable) return;
        facingSelect = null;
    }
    mode = m;
    selectedWarrior = null;
    previewWarriorId = null;
    drawBoard();
}

function onCellClick(r, c) {
    if (busy || gameOver) return;
    if (facingSelect) { handleFacingClick(r, c); return; }
    if (!onBoard(r, c)) return;
    var w = warriorAt(r, c);
    if (w) { onWarriorClick(w); return; }

    if (mode === 'place' && reserve[turn] > 0) {
        if (!validPlacements(turn).has(r + ',' + c)) {
            showMessage('Out of supply reach — must be within 2 clear steps of your chain.');
            return;
        }
        startFacingSelect(r, c, function (facing) {
            performPlace(r, c, facing);
        }, { ghostColor: turn });
        return;
    }
    if (mode === 'move' && selectedWarrior) {
        var mv = validMoves(selectedWarrior);
        var ok = mv.some(function (m) { return m.r === r && m.c === c; });
        if (!ok) { showMessage('Must move up to 2 steps through open ground.'); return; }
        var sw = selectedWarrior;
        startFacingSelect(r, c, function (facing) {
            performMove(sw, r, c, facing);
        }, { ghostColor: sw.color });
    }
}
window.onCellClick = onCellClick;

function onWarriorClick(w) {
    if (busy || gameOver) return;
    if (facingSelect) { handleFacingClick(w.r, w.c); return; }
    if (mode === 'move') {
        if (w.color !== turn) { showMessage('That is not your warrior.'); return; }
        if (selectedWarrior && selectedWarrior.id === w.id) {
            var sw = selectedWarrior;
            startFacingSelect(sw.r, sw.c, function (facing) {
                performRotate(sw, facing);
            }, {});
            return;
        }
        selectedWarrior = w;
        drawBoard();
    } else if (mode === 'shoot') {
        if (w.color !== turn) { showMessage('That is not your warrior.'); return; }
        doShoot(w);
    } else if (mode === 'spin') {
        if (w.color !== turn) { showMessage('That is not your warrior.'); return; }
        doSpin(w, null);
    } else {
        previewWarriorId = (previewWarriorId === w.id) ? null : w.id;
        drawBoard();
    }
}
window.onWarriorClick = onWarriorClick;

// ============================================
// ACTIONS
// ============================================
function performPlace(r, c, facing) {
    var w = { id: nextId++, color: turn, r: r, c: c, facing: facing };
    warriors.push(w);
    reserve[turn]--;
    _validPlaceCache = null;
    busy = true;
    var done = function () {
        busy = false;
        showMessage(colorName(w.color) + ' deploys a warrior facing ' + DIRS[facing].n + '.');
        endTurn();
    };
    if (window.animate3DPlace) window.animate3DPlace(w, done); else done();
}

function performMove(w, r, c, facing) {
    selectedWarrior = null;
    var fromR = w.r, fromC = w.c;
    w.r = r; w.c = c; w.facing = facing;
    _validPlaceCache = null;
    busy = true;
    var done = function () { busy = false; endTurn(); };
    if (window.animate3DWalk) window.animate3DWalk(w, fromR, fromC, done); else done();
}

function performRotate(w, facing) {
    selectedWarrior = null;
    w.facing = facing;
    busy = true;
    var done = function () {
        busy = false;
        showMessage('The warrior turns to face ' + DIRS[facing].n + '.');
        endTurn();
    };
    if (window.animate3DRotate) window.animate3DRotate(w, done); else done();
}

function describeShot(res) {
    var killCount = res.kills.length;
    var hasReflect = res.marks.some(function (m) { return m.type === 'reflect'; });
    var hasDeflect = res.marks.some(function (m) { return m.type === 'deflect'; });
    if (killCount > 1) return killCount + ' warriors fall to the chain of arrows!';
    if (killCount === 1) return 'A warrior is struck down!';
    if (hasReflect) return 'Blocked head-on — the arrow reflects back!';
    if (hasDeflect) return 'The shield turns the arrow aside.';
    return 'The arrow flies off the wall — no effect.';
}

function doShoot(w) {
    busy = true;
    selectedWarrior = null;
    drawBoard();
    var res = computeArrow(w.r, w.c, w.facing);
    var finish = function () {
        var fallen = warriors.filter(function (x) { return res.kills.indexOf(x.id) !== -1; });
        var applyKills = function () {
            warriors = warriors.filter(function (x) { return res.kills.indexOf(x.id) === -1; });
            _validPlaceCache = null;
            busy = false;
            showMessage(describeShot(res));
            endTurn();
        };
        if (fallen.length && window.animate3DKills) window.animate3DKills(fallen, applyKills);
        else applyKills();
    };
    if (window.animate3DArrow) window.animate3DArrow(res.path, res.marks, finish); else finish();
}

function doSpin(att, facingChooser) {
    busy = true;
    selectedWarrior = null;
    drawBoard();
    var kills = computeSpin(att);
    var afterKills = function () {
        warriors = warriors.filter(function (x) { return kills.indexOf(x.id) === -1; });
        _validPlaceCache = null;
        busy = false;
        showMessage(kills.length ? kills.length + ' cut down by the spinning blade!' : 'The blade meets only air.');
        if (facingChooser === null || facingChooser === undefined) {
            startFacingSelect(att.r, att.c, function (facing) {
                att.facing = facing;
                busy = true;
                var done = function () { busy = false; endTurn(); };
                if (window.animate3DRotate) window.animate3DRotate(att, done); else done();
            }, { cancellable: false });
        } else {
            att.facing = facingChooser;
            busy = true;
            var done = function () { busy = false; endTurn(); };
            if (window.animate3DRotate) window.animate3DRotate(att, done); else done();
        }
    };
    var run = function () {
        var fallen = warriors.filter(function (x) { return kills.indexOf(x.id) !== -1; });
        if (fallen.length && window.animate3DKills) window.animate3DKills(fallen, afterKills);
        else afterKills();
    };
    if (window.animate3DSpin) window.animate3DSpin(att, run); else run();
}

// ============================================
// TURN FLOW & WIN CONDITION
// ============================================
function hasAnyAction(color) {
    if (warriors.some(function (w) { return w.color === color; })) return true;
    return reserve[color] > 0 && validPlacements(color).size > 0;
}

// Any army below the minimum force is routed: its remaining warriors scatter.
function resolveEliminations() {
    var routed = [];
    PLAYERS.forEach(function (c) {
        if (alive[c] && totalForce(c) < MIN_FORCE) {
            alive[c] = false;
            reserve[c] = 0;
            warriors.filter(function (w) { return w.color === c; }).forEach(function (w) { routed.push(w); });
            showMessage(colorName(c) + "'s army is routed from the wall.");
        }
    });
    if (routed.length) {
        var ids = routed.map(function (w) { return w.id; });
        warriors = warriors.filter(function (w) { return ids.indexOf(w.id) === -1; });
        _validPlaceCache = null;
    }
    return routed;
}

function aliveList() { return PLAYERS.filter(function (c) { return alive[c]; }); }

function nextAlive(from) {
    var i = PLAYERS.indexOf(from);
    for (var s = 1; s <= PLAYERS.length; s++) {
        var c = PLAYERS[(i + s) % PLAYERS.length];
        if (alive[c]) return c;
    }
    return from;
}

function endTurn() {
    selectedWarrior = null;
    previewWarriorId = null;
    _validPlaceCache = null;

    resolveEliminations();

    var living = aliveList();
    if (living.length <= 1) {
        var winner = living[0] || turn;
        showEndGameMessage(colorName(winner) + ' Holds the Crossing!', 'Every rival army has been driven from the wall.');
        drawBoard();
        return;
    }

    // Advance to the next living army that actually has a move; pass over the stuck.
    var guard = 0;
    var next = turn;
    do {
        next = nextAlive(next);
        guard++;
    } while (!hasAnyAction(next) && guard <= PLAYERS.length);

    if (!hasAnyAction(next)) {
        // No living army can act — settle by remaining force.
        var best = living[0];
        living.forEach(function (c) { if (totalForce(c) > totalForce(best)) best = c; });
        showEndGameMessage(colorName(best) + ' Holds the Crossing!', 'The wall falls silent — the strongest army stands.');
        drawBoard();
        return;
    }

    turn = next;
    _validPlaceCache = null;

    var canPlace = reserve[turn] > 0 && validPlacements(turn).size > 0;
    mode = canPlace ? 'place' : 'move';
    setMode(mode);

    if (!gameOver && isVsComputer && turn !== HUMAN) {
        setTimeout(makeAIMove, 700);
    }
}

var winRevealTimer = null;
function showEndGameMessage(title, text) {
    gameOver = true;
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    var wcolor = null;
    for (var k in PNAME) { if (title.indexOf(PNAME[k]) === 0) wcolor = k; }
    if (window.trigger3DVictory && wcolor) window.trigger3DVictory(wcolor);
    clearTimeout(winRevealTimer);
    winRevealTimer = setTimeout(function () {
        if (messageBox) messageBox.classList.add('visible');
    }, 1100);
}

function initGame() {
    warriors = [];
    reserve = { W: 10, R: 10, B: 10, U: 10 };
    alive = { W: true, R: true, B: true, U: true };
    turn = 'W';
    nextId = 1;
    selectedWarrior = null;
    previewWarriorId = null;
    facingSelect = null;
    busy = false;
    gameOver = false;
    _validPlaceCache = null;
    clearTimeout(winRevealTimer);
    if (messageBox) messageBox.classList.remove('visible');
    if (window.is3DView && typeof window.rebuild3DBoard === 'function') window.rebuild3DBoard();
    setMode('place');
}

// ============================================
// IN-WORLD FACING SELECTION
// ============================================
function startFacingSelect(r, c, cb, opts) {
    opts = opts || {};
    facingSelect = {
        r: r, c: c, cb: cb,
        cancellable: opts.cancellable !== false,
        ghostColor: opts.ghostColor || null
    };
    drawBoard();
}

function chooseFacingDir(d) {
    if (!facingSelect) return;
    var cb = facingSelect.cb;
    facingSelect = null;
    if (cb) cb(d);
}
window.chooseFacingDir = chooseFacingDir;

function cancelFacingSelect() {
    if (!facingSelect || !facingSelect.cancellable) return;
    facingSelect = null;
    selectedWarrior = null;
    setMode(mode);
}

function handleFacingClick(r, c) {
    var fs = facingSelect;
    var dr = r - fs.r, dc = c - fs.c;
    if (Math.max(Math.abs(dr), Math.abs(dc)) === 1) {
        for (var d = 0; d < 8; d++) {
            if (DIRS[d].dr === Math.sign(dr) && DIRS[d].dc === Math.sign(dc)) { chooseFacingDir(d); return; }
        }
    }
    cancelFacingSelect();
}

window.dirPickerOpen = function () { return facingSelect !== null; };

var NUMPAD_DIR = { '8': 0, '9': 1, '6': 2, '3': 3, '2': 4, '1': 5, '4': 6, '7': 7 };
document.addEventListener('keydown', function (e) {
    if (facingSelect && NUMPAD_DIR[e.key] !== undefined) {
        e.preventDefault();
        chooseFacingDir(NUMPAD_DIR[e.key]);
    }
});

// ============================================
// EVENT LISTENERS
// ============================================
if (resetButton) resetButton.addEventListener('click', function () {
    initGame();
    showMessage('The crossing stands ready.');
});

if (opponentButton) opponentButton.addEventListener('click', function () {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = 'Opponents: ' + (isVsComputer ? 'Computer' : 'Human');
    initGame();
    showMessage(isVsComputer ? 'You (White) vs 3 Computer armies' : 'Four human armies');
});

if (facingButton) facingButton.addEventListener('click', function () {
    hiddenFacing = !hiddenFacing;
    facingButton.textContent = 'Enemy Facing: ' + (hiddenFacing ? 'Hidden' : 'Visible');
    showMessage(hiddenFacing ? 'Enemy banners are furled — facings hidden.' : 'Enemy facings revealed.');
    drawBoard();
});

['place', 'move', 'shoot', 'spin'].forEach(function (m) {
    var el = document.getElementById('act-' + m);
    if (el) el.addEventListener('click', function () { setMode(m); });
});

// ============================================
// AI — each computer army pushes toward the crossing and strikes the nearest foe.
// ============================================
function colorOfId(id) {
    var w = warriors.find(function (x) { return x.id === id; });
    return w ? w.color : null;
}

function nearestEnemyDir(w) {
    var best = null, bd = 1e9;
    warriors.forEach(function (e) {
        if (e.color === w.color) return;
        var d = cheb(w.r, w.c, e.r, e.c);
        if (d < bd) { bd = d; best = e; }
    });
    var tr, tc;
    if (best) { tr = best.r; tc = best.c; }
    else { tr = GW_CENTER; tc = GW_CENTER; } // no foe in sight — press the crossing
    var dr = Math.sign(tr - w.r), dc = Math.sign(tc - w.c);
    if (dr === 0 && dc === 0) return w.facing;
    for (var i = 0; i < 8; i++) if (DIRS[i].dr === dr && DIRS[i].dc === dc) return i;
    return w.facing;
}

function distToCenter(r, c) { return cheb(r, c, GW_CENTER, GW_CENTER); }

function makeAIMove() {
    if (gameOver || busy || turn === HUMAN || !alive[turn]) return;
    var me = turn;
    var mine = warriors.filter(function (w) { return w.color === me; });
    var best = null;

    // 1. Shots that net enemy kills
    mine.forEach(function (w) {
        var res = computeArrow(w.r, w.c, w.facing);
        var eK = res.kills.filter(function (id) { return colorOfId(id) !== me; }).length;
        var oK = res.kills.length - eK;
        var net = eK - oK;
        if (net > 0 && (!best || net > best.net)) best = { type: 'shoot', w: w, net: net };
    });
    // 2. Spins that net enemy kills
    mine.forEach(function (w) {
        var kills = computeSpin(w);
        var eK = kills.filter(function (id) { return colorOfId(id) !== me; }).length;
        var oK = kills.length - eK;
        var net = eK - oK;
        if (net > 0 && (!best || net > best.net)) best = { type: 'spin', w: w, net: net };
    });

    if (best) {
        mode = best.type;
        drawBoard();
        if (best.type === 'shoot') doShoot(best.w);
        else doSpin(best.w, nearestEnemyDir(best.w));
        return;
    }

    // 3. Deploy toward the crossing
    var places = Array.from(validPlacements(me));
    if (reserve[me] > 0 && places.length && (mine.length === 0 || Math.random() < 0.6)) {
        places.sort(function (a, b) {
            var pa = a.split(','), pb = b.split(',');
            return distToCenter(+pa[0], +pa[1]) - distToCenter(+pb[0], +pb[1]);
        });
        var pickFrom = places.slice(0, Math.min(4, places.length));
        var pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        var parts = pick.split(',');
        var pr = Number(parts[0]), pc = Number(parts[1]);
        mode = 'place';
        drawBoard();
        var nw = { id: nextId++, color: me, r: pr, c: pc, facing: 0 };
        nw.facing = nearestEnemyDir(nw);
        warriors.push(nw);
        reserve[me]--;
        _validPlaceCache = null;
        busy = true;
        var done = function () { busy = false; showMessage(colorName(me) + ' deploys a warrior.'); endTurn(); };
        if (window.animate3DPlace) window.animate3DPlace(nw, done); else done();
        return;
    }

    // 4. March a warrior toward the crossing
    if (mine.length) {
        var shuffled = mine.slice().sort(function () { return Math.random() - 0.5; });
        for (var i = 0; i < shuffled.length; i++) {
            var w2 = shuffled[i];
            var mv = validMoves(w2);
            if (!mv.length) continue;
            mv.sort(function (a, b) { return distToCenter(a.r, a.c) - distToCenter(b.r, b.c); });
            var target = mv[Math.floor(Math.random() * Math.min(2, mv.length))];
            mode = 'move';
            drawBoard();
            var fromR = w2.r, fromC = w2.c;
            w2.r = target.r; w2.c = target.c;
            w2.facing = nearestEnemyDir(w2);
            _validPlaceCache = null;
            busy = true;
            var done2 = function () { busy = false; endTurn(); };
            if (window.animate3DWalk) window.animate3DWalk(w2, fromR, fromC, done2); else done2();
            return;
        }
        var w3 = shuffled[0];
        w3.facing = nearestEnemyDir(w3);
        busy = true;
        var done3 = function () { busy = false; endTurn(); };
        if (window.animate3DRotate) window.animate3DRotate(w3, done3); else done3();
        return;
    }

    endTurn();
}

document.addEventListener('DOMContentLoaded', initGame);
