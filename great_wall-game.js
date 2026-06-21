// GREAT WALL GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Rule logic ported from the V1 playtest prototype.

// ============================================
// CONSTANTS
// ============================================
var GW_ROWS = 5;
var GW_COLS = 15;

// 8 directions, clockwise from North. On the board: row 0 = North edge, col 0 = West (Black) end.
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
// A warrior's shield guards its three rear directions: opposite of facing ±45°.
function back3(facing) {
    var o = oppDir(facing);
    return new Set([(o + 7) % 8, o, (o + 1) % 8]);
}

// Legendary supply fields: centre cell of each short edge.
var LEG_LEFT  = { r: 2, c: 0 };            // Black's supply anchor
var LEG_RIGHT = { r: 2, c: GW_COLS - 1 };  // White's supply anchor
function isLegendary(r, c) {
    return (r === LEG_LEFT.r && c === LEG_LEFT.c) || (r === LEG_RIGHT.r && c === LEG_RIGHT.c);
}
function supplyOf(color) { return color === 'W' ? LEG_RIGHT : LEG_LEFT; }

window.GW_ROWS = GW_ROWS;
window.GW_COLS = GW_COLS;
window.DIRS = DIRS;
window.isLegendary = isLegendary;
window.supplyOf = supplyOf;
window.back3 = back3;

// ============================================
// GAME STATE
// ============================================
var warriors = [];          // { id, color:'W'|'B', r, c, facing }
var reserve = { W: 10, B: 10 };
var turn = 'W';
var mode = 'place';         // 'place' | 'move' | 'shoot' | 'spin'
var nextId = 1;
var selectedWarrior = null;
var previewWarriorId = null; // shield-arc preview (informational)
var busy = false;
var gameOver = false;
var isVsComputer = true;
var hiddenFacing = false;
var _validPlaceCache = null;
var lastChain = [];          // supply-chain nodes of current player (for 3D glow)
// In-world facing selection: { r, c, cb, cancellable, ghostColor } — arrows shown on the
// 8 surrounding fields; clicking one sets the facing.
var facingSelect = null;

window.getGWState = function () {
    return { warriors: warriors, reserve: reserve, turn: turn, mode: mode,
             selectedWarrior: selectedWarrior, previewWarriorId: previewWarriorId,
             busy: busy, gameOver: gameOver, hiddenFacing: hiddenFacing, lastChain: lastChain,
             facingSelect: facingSelect };
};

// ============================================
// DOM ELEMENTS
// ============================================
var statusIndicator = document.getElementById('player-indicator');
var statusName = document.getElementById('player-name');
var wBoardHud = document.getElementById('w-board-hud');
var bBoardHud = document.getElementById('b-board-hud');
var wResHud = document.getElementById('w-res-hud');
var bResHud = document.getElementById('b-res-hud');
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

function inBounds(r, c) { return r >= 0 && r < GW_ROWS && c >= 0 && c < GW_COLS; }
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
            if (!inBounds(ir, ic)) continue;
            if (cheb(ir, ic, tr, tc) !== 1) continue;
            var w = warriorAt(ir, ic);
            if (!w || w.color === color) return true;
        }
    }
    return false;
}

// Supply-chain BFS. Returns Set of "r,c" cells where `color` may place.
// Chain roots at the Legendary Field unless an enemy stands on it (supply cut).
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
            for (var r = 0; r < GW_ROWS; r++) {
                for (var c = 0; c < GW_COLS; c++) {
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

// Movement: distance-2 needs at least one fully empty shared stepping-stone.
function movePathClear(fr, fc, tr, tc) {
    if (cheb(fr, fc, tr, tc) === 1) return true;
    for (var ir = fr - 1; ir <= fr + 1; ir++) {
        for (var ic = fc - 1; ic <= fc + 1; ic++) {
            if (ir === fr && ic === fc) continue;
            if (!inBounds(ir, ic)) continue;
            if (cheb(ir, ic, tr, tc) !== 1) continue;
            if (!warriorAt(ir, ic)) return true;
        }
    }
    return false;
}

function validMoves(w) {
    var moves = [];
    for (var r = 0; r < GW_ROWS; r++) {
        for (var c = 0; c < GW_COLS; c++) {
            if (warriorAt(r, c)) continue;
            var d = cheb(w.r, w.c, r, c);
            if (d >= 1 && d <= 2 && movePathClear(w.r, w.c, r, c)) moves.push({ r: r, c: c });
        }
    }
    return moves;
}
window.validMoves = validMoves;

// Pick the 90° deflection that carries the arrow furthest onward.
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

// Arrow resolution. Returns { path, kills, marks } where marks = [{idx, type}]
// types: 'reflect' | 'deflect' | 'kill' | 'out' | 'spent'
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
        if (!inBounds(r, c)) { path.push({ r: r, c: c, out: true }); marks.push({ idx: path.length - 1, type: 'out' }); break; }
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
                v = w.facing; // chain-fire in the victim's facing
                seen.clear(); // board changed — old states no longer imply a loop
            }
        }
    }
    return { path: path, kills: kills, marks: marks };
}

// Spin: strike all 8 adjacent cells; a neighbour survives if its shield covers the side struck.
function computeSpin(att) {
    var kills = [];
    for (var d = 0; d < 8; d++) {
        var r = att.r + DIRS[d].dr, c = att.c + DIRS[d].dc;
        if (!inBounds(r, c)) continue;
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

function colorName(c) { return c === 'W' ? 'White' : 'Black'; }

// ============================================
// HUD / RENDERING
// ============================================
function drawBoard() {
    if (wBoardHud) wBoardHud.textContent = warriors.filter(function (w) { return w.color === 'W'; }).length;
    if (bBoardHud) bBoardHud.textContent = warriors.filter(function (w) { return w.color === 'B'; }).length;
    if (wResHud) wResHud.textContent = reserve.W;
    if (bResHud) bResHud.textContent = reserve.B;

    if (statusName) statusName.textContent = colorName(turn) + "'s Turn";
    if (statusIndicator) statusIndicator.style.backgroundColor = turn === 'W' ? '#ffffff' : '#1a1a1a';

    // Action chip states
    var hasPlace = !gameOver && reserve[turn] > 0 && validPlacements(turn).size > 0;
    var hasOwn = !gameOver && warriors.some(function (w) { return w.color === turn; });
    setChip('act-place', hasPlace);
    setChip('act-move', hasOwn);
    setChip('act-shoot', hasOwn);
    setChip('act-spin', hasOwn);

    if (window.is3DView && typeof window.sync3D === 'function') window.sync3D();
    if (window.is3DView && typeof window.update3DViews === 'function') window.update3DViews();
}

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
        if (!facingSelect.cancellable) return; // a committed action still needs its facing
        facingSelect = null;
    }
    mode = m;
    selectedWarrior = null;
    previewWarriorId = null;
    if (m === 'place') setPrompt(reserve[turn] > 0 ? 'Click a glowing field to deploy a warrior from your reserve.' : 'No warriors left in reserve.');
    if (m === 'move') setPrompt('Select a warrior, then a blue field (up to 2 steps) — or itself to rotate in place.');
    if (m === 'shoot') setPrompt('Click one of your warriors to fire its arrow along its facing.');
    if (m === 'spin') setPrompt('Click one of your warriors to swing its blade at all 8 neighbours.');
    drawBoard();
}

function onCellClick(r, c) {
    if (busy || gameOver) return;
    if (facingSelect) { handleFacingClick(r, c); return; }
    var w = warriorAt(r, c);
    if (w) { onWarriorClick(w); return; }

    if (mode === 'place' && reserve[turn] > 0) {
        if (!validPlacements(turn).has(r + ',' + c)) {
            showMessage('Out of supply reach — must be within 2 clear steps of your chain.');
            return;
        }
        startFacingSelect(r, c, function (facing) {
            performPlace(r, c, facing);
        }, { ghostColor: turn, prompt: 'Click a surrounding field to choose where the warrior looks.' });
        return;
    }
    if (mode === 'move' && selectedWarrior) {
        var mv = validMoves(selectedWarrior);
        var ok = mv.some(function (m) { return m.r === r && m.c === c; });
        if (!ok) { showMessage('Must move up to 2 steps through open ground.'); return; }
        var sw = selectedWarrior;
        startFacingSelect(r, c, function (facing) {
            performMove(sw, r, c, facing);
        }, { ghostColor: sw.color, prompt: 'Click a surrounding field to choose the facing after the march.' });
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
            }, { prompt: 'Click a surrounding field to turn the warrior that way.' });
            return;
        }
        selectedWarrior = w;
        setPrompt('Blue = destination. Click the warrior again to rotate in place.');
        drawBoard();
    } else if (mode === 'shoot') {
        if (w.color !== turn) { showMessage('That is not your warrior.'); return; }
        doShoot(w);
    } else if (mode === 'spin') {
        if (w.color !== turn) { showMessage('That is not your warrior.'); return; }
        doSpin(w, null);
    } else {
        // place mode: clicking a warrior previews its shield arc
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

// facingChooser: null = ask via picker (human); number = AI-chosen facing
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
            }, { cancellable: false, prompt: 'After the spin — click a surrounding field to set the new facing.' });
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
    if (warriors.some(function (w) { return w.color === color; })) return true; // can always rotate
    return reserve[color] > 0 && validPlacements(color).size > 0;
}

function checkWin() {
    var other = turn === 'W' ? 'B' : 'W';
    if (totalForce(other) < 4) {
        showEndGameMessage(colorName(turn) + ' Wins!', colorName(other) + "'s army has fallen below four warriors.");
        return true;
    }
    if (totalForce(turn) < 4) {
        showEndGameMessage(colorName(other) + ' Wins!', colorName(turn) + "'s own army has fallen below four warriors.");
        return true;
    }
    return false;
}

function endTurn() {
    selectedWarrior = null;
    previewWarriorId = null;
    _validPlaceCache = null;

    if (checkWin()) { drawBoard(); return; }

    turn = turn === 'W' ? 'B' : 'W';
    _validPlaceCache = null;

    if (!hasAnyAction(turn)) {
        var other = turn === 'W' ? 'B' : 'W';
        showEndGameMessage(colorName(other) + ' Wins!', colorName(turn) + ' is cut off — no action remains.');
        drawBoard();
        return;
    }

    // Default to a sensible mode for the new player
    var canPlace = reserve[turn] > 0 && validPlacements(turn).size > 0;
    mode = canPlace ? 'place' : 'move';
    setMode(mode);

    if (!gameOver && isVsComputer && turn === 'B') {
        setTimeout(makeAIMove, 800);
    }
}

function showEndGameMessage(title, text) {
    gameOver = true;
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    if (messageBox) messageBox.classList.add('visible');
    if (window.trigger3DVictory) window.trigger3DVictory(title.indexOf('White') === 0 ? 'W' : 'B');
}

function initGame() {
    warriors = [];
    reserve = { W: 10, B: 10 };
    turn = 'W';
    nextId = 1;
    selectedWarrior = null;
    previewWarriorId = null;
    facingSelect = null;
    busy = false;
    gameOver = false;
    _validPlaceCache = null;
    if (messageBox) messageBox.classList.remove('visible');
    if (window.is3DView && typeof window.rebuild3DBoard === 'function') window.rebuild3DBoard();
    setMode('place');
}

// ============================================
// IN-WORLD FACING SELECTION
// Subtle arrows appear on the 8 fields around the target; clicking one of them
// (or pressing numpad 1-9) sets the facing. The click only directs — it never moves.
// ============================================
function startFacingSelect(r, c, cb, opts) {
    opts = opts || {};
    facingSelect = {
        r: r, c: c, cb: cb,
        cancellable: opts.cancellable !== false,
        ghostColor: opts.ghostColor || null
    };
    setPrompt(opts.prompt || 'Click a surrounding field to set the facing.');
    drawBoard();
}

function chooseFacingDir(d) {
    if (!facingSelect) return;
    var cb = facingSelect.cb;
    facingSelect = null;
    setPrompt('');
    if (cb) cb(d);
}
window.chooseFacingDir = chooseFacingDir;

function cancelFacingSelect() {
    if (!facingSelect || !facingSelect.cancellable) return;
    facingSelect = null;
    selectedWarrior = null;
    setMode(mode);
}

// A click lands while facing selection is active: adjacent field = pick that direction,
// anything else = cancel (when allowed).
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

// Numpad facing (compass layout) while selecting
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
    showMessage('The wall stands ready.');
});

if (opponentButton) opponentButton.addEventListener('click', function () {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = 'Opponent: ' + (isVsComputer ? 'Computer' : 'Human');
    initGame();
    showMessage(isVsComputer ? 'VS Computer Mode' : 'VS Human Mode');
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
// AI (follows the rules; prefers clean kills)
// ============================================
function colorOfId(id) {
    var w = warriors.find(function (x) { return x.id === id; });
    return w ? w.color : null;
}

function nearestEnemyFacing(w) {
    var best = null, bd = 1e9;
    warriors.forEach(function (e) {
        if (e.color === w.color) return;
        var d = cheb(w.r, w.c, e.r, e.c);
        if (d < bd) { bd = d; best = e; }
    });
    if (!best) return 2; // face East toward White's end
    var dr = Math.sign(best.r - w.r), dc = Math.sign(best.c - w.c);
    for (var i = 0; i < 8; i++) if (DIRS[i].dr === dr && DIRS[i].dc === dc) return i;
    return 2;
}

function makeAIMove() {
    if (gameOver || turn !== 'B' || busy) return;

    var mine = warriors.filter(function (w) { return w.color === 'B'; });
    var best = null;

    // 1. Shots with positive net kills
    mine.forEach(function (w) {
        var res = computeArrow(w.r, w.c, w.facing);
        var eK = res.kills.filter(function (id) { return colorOfId(id) === 'W'; }).length;
        var oK = res.kills.length - eK;
        var net = eK - oK;
        if (net > 0 && (!best || net > best.net)) best = { type: 'shoot', w: w, net: net };
    });
    // 2. Spins with positive net kills
    mine.forEach(function (w) {
        var kills = computeSpin(w);
        var eK = kills.filter(function (id) { return colorOfId(id) === 'W'; }).length;
        var oK = kills.length - eK;
        var net = eK - oK;
        if (net > 0 && (!best || net > best.net)) best = { type: 'spin', w: w, net: net };
    });

    if (best) {
        mode = best.type;
        drawBoard();
        if (best.type === 'shoot') doShoot(best.w);
        else doSpin(best.w, nearestEnemyFacing(best.w));
        return;
    }

    // 3. Place toward the enemy end (eastward)
    var places = Array.from(validPlacements('B'));
    if (reserve.B > 0 && places.length && (mine.length === 0 || Math.random() < 0.65)) {
        places.sort(function (a, b) { return Number(b.split(',')[1]) - Number(a.split(',')[1]); });
        var pickFrom = places.slice(0, Math.min(4, places.length));
        var pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        var parts = pick.split(',');
        mode = 'place';
        drawBoard();
        var pr = Number(parts[0]), pc = Number(parts[1]);
        var w = { id: nextId++, color: 'B', r: pr, c: pc, facing: 2 };
        warriors.push(w);
        reserve.B--;
        _validPlaceCache = null;
        busy = true;
        var done = function () { busy = false; showMessage('Black deploys a warrior.'); endTurn(); };
        if (window.animate3DPlace) window.animate3DPlace(w, done); else done();
        return;
    }

    // 4. March a random warrior eastward-ish
    if (mine.length) {
        var shuffled = mine.slice().sort(function () { return Math.random() - 0.5; });
        for (var i = 0; i < shuffled.length; i++) {
            var w2 = shuffled[i];
            var mv = validMoves(w2);
            if (!mv.length) continue;
            mv.sort(function (a, b) { return b.c - a.c; });
            var target = mv[Math.floor(Math.random() * Math.min(3, mv.length))];
            mode = 'move';
            drawBoard();
            var fromR = w2.r, fromC = w2.c;
            w2.r = target.r; w2.c = target.c;
            w2.facing = nearestEnemyFacing(w2);
            _validPlaceCache = null;
            busy = true;
            var done2 = function () { busy = false; endTurn(); };
            if (window.animate3DWalk) window.animate3DWalk(w2, fromR, fromC, done2); else done2();
            return;
        }
        // Nothing to do but rotate
        var w3 = shuffled[0];
        w3.facing = nearestEnemyFacing(w3);
        busy = true;
        var done3 = function () { busy = false; endTurn(); };
        if (window.animate3DRotate) window.animate3DRotate(w3, done3); else done3();
        return;
    }

    endTurn(); // no action possible — endTurn's guard will resolve the loss
}

document.addEventListener('DOMContentLoaded', initGame);
