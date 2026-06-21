// TOWER GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Inspiration: the Porcelain Tower of Nanjing.

// ============================================
// CONSTANTS
// ============================================
var LEVELS = 4;   // octagonal tiers, 0 = bottom .. 3 = top
var SLOTS = 8;    // slots per ring (octagon), a closed loop
var POOL_START = 12;

window.TOWER_LEVELS = LEVELS;
window.TOWER_SLOTS = SLOTS;

// ============================================
// GAME STATE
// ============================================
// board[level][slot] = null | { owner:'W'|'B', num:1|2|3 }
var board = [];
var pool = { W: POOL_START, B: POOL_START };
var turn = 'W';
var mode = 'place';        // 'place' | 'move' | 'levelup' | 'attack' | 'bonus'
var selected = null;       // { level, slot } — move source / attacker / bonus source
var attackTargets = [];    // [{ tiles:[{level,slot}], yourSum, enemySum, win }]
var bonusActive = false;   // true while resolving the 3->1 bonus move
var busy = false;
var gameOver = false;
var isVsComputer = true;

window.getTowerState = function () {
    return {
        board: board, pool: pool, turn: turn, mode: mode, selected: selected,
        attackTargets: attackTargets, bonusActive: bonusActive, busy: busy, gameOver: gameOver
    };
};

// ============================================
// DOM
// ============================================
var statusIndicator = document.getElementById('player-indicator');
var statusName = document.getElementById('player-name');
var wBoardHud = document.getElementById('w-board-hud');
var bBoardHud = document.getElementById('b-board-hud');
var wResHud = document.getElementById('w-res-hud');
var bResHud = document.getElementById('b-res-hud');
var resetButton = document.getElementById('reset-button');
var opponentButton = document.getElementById('opponent-btn');
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
function setPrompt(t) { if (actionPrompt) actionPrompt.textContent = t || ''; }
function colorName(c) { return c === 'W' ? 'White' : 'Black'; }
function opp(c) { return c === 'W' ? 'B' : 'W'; }

// ============================================
// BOARD HELPERS
// ============================================
function tileAt(l, s) { return board[l] ? board[l][s] : null; }
window.towerTileAt = tileAt;

function inLevel(l) { return l >= 0 && l < LEVELS; }

// up to 4 neighbours: ring ±1 (wraps), level ±1 (across tiers)
function neighbors(l, s) {
    var n = [
        { level: l, slot: (s + 1) % SLOTS },
        { level: l, slot: (s + SLOTS - 1) % SLOTS }
    ];
    if (inLevel(l + 1)) n.push({ level: l + 1, slot: s });
    if (inLevel(l - 1)) n.push({ level: l - 1, slot: s });
    return n;
}
function isAdjacent(a, b) {
    return neighbors(a.level, a.slot).some(function (n) { return n.level === b.level && n.slot === b.slot; });
}
window.towerNeighbors = neighbors;

// ============================================
// CHAINS / ATTACK
// ============================================
// Contiguous run of `color` along the ring of level L that includes slot S (wrapping).
function ringChain(L, S, color) {
    var t = tileAt(L, S);
    if (!t || t.owner !== color) return [];
    var set = [{ level: L, slot: S }];
    // extend forward
    var k = (S + 1) % SLOTS, guard = 0;
    while (k !== S && guard++ < SLOTS) {
        var tt = tileAt(L, k);
        if (tt && tt.owner === color) { set.push({ level: L, slot: k }); k = (k + 1) % SLOTS; } else break;
    }
    // extend backward
    k = (S + SLOTS - 1) % SLOTS; guard = 0;
    while (k !== S && guard++ < SLOTS) {
        var tt2 = tileAt(L, k);
        if (tt2 && tt2.owner === color && !set.some(function (p) { return p.slot === k; })) {
            set.push({ level: L, slot: k }); k = (k + SLOTS - 1) % SLOTS;
        } else break;
    }
    return set;
}
// Contiguous run of `color` along column S that includes level L.
function colChain(L, S, color) {
    var t = tileAt(L, S);
    if (!t || t.owner !== color) return [];
    var set = [{ level: L, slot: S }];
    for (var u = L + 1; u < LEVELS; u++) { var tu = tileAt(u, S); if (tu && tu.owner === color) set.push({ level: u, slot: S }); else break; }
    for (var d = L - 1; d >= 0; d--) { var td = tileAt(d, S); if (td && td.owner === color) set.push({ level: d, slot: S }); else break; }
    return set;
}
function sumOf(set) { return set.reduce(function (a, p) { var t = tileAt(p.level, p.slot); return a + (t ? t.num : 0); }, 0); }

// All enemy chains a given attacker can strike (both axes, both ends).
function computeAttackTargets(L, S) {
    var me = turn, foe = opp(turn);
    var targets = [];

    // ---- Horizontal (ring) ----
    var hChain = ringChain(L, S, me);
    if (hChain.length > 0 && hChain.length < SLOTS) {
        // ends: slots just beyond the arc on each side
        var slotsInChain = hChain.map(function (p) { return p.slot; });
        // forward end
        [1, -1].forEach(function (dir) {
            // find the boundary slot of the arc in this direction
            var edge = S;
            // walk along chain in `dir` to the last chain slot
            var step = ((dir % SLOTS) + SLOTS) % SLOTS;
            var k = S, guard = 0;
            while (slotsInChain.indexOf((k + dir + SLOTS) % SLOTS) !== -1 && guard++ < SLOTS) k = (k + dir + SLOTS) % SLOTS;
            var beyond = (k + dir + SLOTS) % SLOTS;
            var bt = tileAt(L, beyond);
            if (bt && bt.owner === foe) {
                var enemy = ringChain(L, beyond, foe);
                addTarget(targets, hChain, enemy);
            }
        });
    }

    // ---- Vertical (column) ----
    var vChain = colChain(L, S, me);
    if (vChain.length > 0) {
        var levelsInChain = vChain.map(function (p) { return p.level; });
        var topL = Math.max.apply(null, levelsInChain);
        var botL = Math.min.apply(null, levelsInChain);
        [{ l: topL + 1 }, { l: botL - 1 }].forEach(function (e) {
            if (!inLevel(e.l)) return;
            var bt = tileAt(e.l, S);
            if (bt && bt.owner === foe) {
                var enemy = colChain(e.l, S, foe);
                addTarget(targets, vChain, enemy);
            }
        });
    }
    return targets;
}
function addTarget(targets, mine, enemy) {
    if (!enemy.length) return;
    var key = enemy.map(function (p) { return p.level + ',' + p.slot; }).sort().join('|');
    if (targets.some(function (t) { return t.key === key; })) return;
    var ys = sumOf(mine), es = sumOf(enemy);
    targets.push({ key: key, tiles: enemy, yourSum: ys, enemySum: es, win: ys > es });
}

// ============================================
// WIN
// ============================================
function fullLevel(color, L) {
    for (var s = 0; s < SLOTS; s++) { var t = tileAt(L, s); if (!t || t.owner !== color) return false; }
    return true;
}
function fullColumn(color, S) {
    for (var l = 0; l < LEVELS; l++) { var t = tileAt(l, S); if (!t || t.owner !== color) return false; }
    return true;
}
function winInfo(color) {
    for (var L = 0; L < LEVELS; L++) if (fullLevel(color, L)) return 'a full ring on level ' + (L + 1);
    var cols = 0;
    for (var S = 0; S < SLOTS; S++) if (fullColumn(color, S)) cols++;
    if (cols >= 2) return 'two full columns, top to bottom';
    return null;
}

// ============================================
// RENDER / HUD
// ============================================
function countOnBoard(color) {
    var n = 0;
    for (var l = 0; l < LEVELS; l++) for (var s = 0; s < SLOTS; s++) { var t = tileAt(l, s); if (t && t.owner === color) n++; }
    return n;
}
function drawBoard() {
    if (wBoardHud) wBoardHud.textContent = countOnBoard('W');
    if (bBoardHud) bBoardHud.textContent = countOnBoard('B');
    if (wResHud) wResHud.textContent = pool.W;
    if (bResHud) bResHud.textContent = pool.B;
    if (statusName) statusName.textContent = colorName(turn) + "'s Turn";
    if (statusIndicator) statusIndicator.style.backgroundColor = turn === 'W' ? '#ffffff' : '#1a1a1a';

    var hasOwn = !gameOver && countOnBoard(turn) > 0;
    var canPlace = !gameOver && pool[turn] > 0 && hasEmptySlot();
    setChip('act-place', canPlace);
    setChip('act-move', hasOwn);
    setChip('act-levelup', hasOwn);

    if (window.is3DView && window.towerSync3D) window.towerSync3D();
    if (window.is3DView && window.towerUpdateViews) window.towerUpdateViews();
}
function setChip(id, enabled) {
    var el = document.getElementById(id);
    if (!el) return;
    el.disabled = !enabled || busy;
    el.classList.toggle('active', id === 'act-' + (mode === 'bonus' ? 'levelup' : mode) && !gameOver);
}
function hasEmptySlot() {
    for (var l = 0; l < LEVELS; l++) for (var s = 0; s < SLOTS; s++) if (!tileAt(l, s)) return true;
    return false;
}

// ============================================
// MODES / INTERACTION
// ============================================
function setMode(m) {
    if (busy || gameOver || bonusActive) return;
    mode = m;
    selected = null;
    attackTargets = [];
    if (m === 'place') setPrompt(pool[turn] > 0 ? '' : '');
    if (m === 'move') setPrompt('');
    if (m === 'levelup') setPrompt('');
    drawBoard();
}

// Select one of your tiles as mover/attacker, and light up its reachable enemy chains.
function selectMover(l, s) {
    selected = { level: l, slot: s };
    attackTargets = computeAttackTargets(l, s);
    setPrompt('');
    drawBoard();
}

// Entry point from the 3D view: a slot (level,slot) was tapped.
function onSlotTap(l, s) {
    if (busy || gameOver) return;
    var t = tileAt(l, s);

    if (bonusActive) { handleBonus(l, s, t); return; }

    if (mode === 'place') {
        if (t) { showMessage('That slot is taken.'); return; }
        if (pool[turn] <= 0) { showMessage('Your pool is empty.'); return; }
        doPlace(l, s);
        return;
    }
    if (mode === 'move') {
        if (selected) {
            if (selected.level === l && selected.slot === s) { selected = null; attackTargets = []; drawBoard(); return; }
            // tapping an enemy chain = attack
            var tgt = attackTargets.find(function (g) { return g.tiles.some(function (p) { return p.level === l && p.slot === s; }); });
            if (tgt) { doAttack(tgt); return; }
            // empty adjacent = move
            if (!t && isAdjacent(selected, { level: l, slot: s })) { doMove(selected, { level: l, slot: s }, false); return; }
            // another of your tiles = re-aim
            if (t && t.owner === turn) { selectMover(l, s); return; }
            showMessage('Tap an empty adjacent slot to move, or a highlighted enemy chain to attack.'); return;
        }
        if (t && t.owner === turn) { selectMover(l, s); }
        else if (t) showMessage('That is not your tile.');
        return;
    }
    if (mode === 'levelup') {
        if (t && t.owner === turn) { doLevelUp(l, s); }
        else if (t) showMessage('That is not your tile.');
        return;
    }
}
window.onTowerSlotTap = onSlotTap;

// ============================================
// ACTIONS
// ============================================
function doPlace(l, s) {
    busy = true;
    board[l][s] = { owner: turn, num: 1 };
    pool[turn]--;
    var done = function () { busy = false; showMessage(colorName(turn) + ' raises a tile.'); endTurn(); };
    if (window.towerAnimPlace) window.towerAnimPlace(l, s, done); else done();
}
function doMove(from, to, isBonus) {
    busy = true;
    var t = board[from.level][from.slot];
    board[to.level][to.slot] = t;
    board[from.level][from.slot] = null;
    selected = null;
    attackTargets = [];
    var done = function () {
        busy = false;
        if (isBonus) { bonusActive = false; endTurn(); }
        else endTurn();
    };
    if (window.towerAnimMove) window.towerAnimMove(from, to, done); else done();
}
function doLevelUp(l, s) {
    var t = board[l][s];
    var was = t.num;
    t.num = was === 3 ? 1 : was + 1;
    busy = true;
    var cycled = (was === 3);
    var done = function () {
        busy = false;
        if (cycled) {
            bonusActive = true;
            mode = 'bonus';
            selected = null;
            setPrompt('');
            drawBoard();
        } else {
            showMessage('Tile leveled to ' + t.num + '.');
            endTurn();
        }
    };
    if (window.towerAnimLevelUp) window.towerAnimLevelUp(l, s, done); else done();
}
function handleBonus(l, s, t) {
    if (!selected) {
        if (t) { selected = { level: l, slot: s }; setPrompt(''); drawBoard(); }
        return;
    }
    if (selected.level === l && selected.slot === s) { selected = null; drawBoard(); return; }
    if (!t && isAdjacent(selected, { level: l, slot: s })) { doMove(selected, { level: l, slot: s }, true); return; }
    if (t) { selected = { level: l, slot: s }; drawBoard(); return; }
    showMessage('Must move to an adjacent empty slot.');
}
function doAttack(tgt) {
    if (!tgt.win) { showMessage('Your chain (' + tgt.yourSum + ') is not strong enough vs ' + tgt.enemySum + '.'); return; }
    busy = true;
    var captured = tgt.tiles.slice();
    var done = function () {
        captured.forEach(function (p) { var t = board[p.level][p.slot]; if (t) { t.owner = turn; t.num = 1; } });
        selected = null; attackTargets = [];
        busy = false;
        showMessage('Captured ' + captured.length + ' tile' + (captured.length > 1 ? 's' : '') + '!');
        endTurn();
    };
    if (window.towerAnimAttack) window.towerAnimAttack(selected, captured, done); else done();
}

// ============================================
// TURN FLOW
// ============================================
function endTurn() {
    selected = null; attackTargets = []; bonusActive = false;

    var w = winInfo(turn);
    if (w) { return endGame(colorName(turn) + ' Wins!', colorName(turn) + ' controls ' + w + '.'); }
    var ow = winInfo(opp(turn));
    if (ow) { return endGame(colorName(opp(turn)) + ' Wins!', colorName(opp(turn)) + ' controls ' + ow + '.'); }

    turn = opp(turn);
    // sensible default mode for the new player
    mode = (pool[turn] > 0 && hasEmptySlot()) ? 'place' : 'move';
    setMode(mode);

    if (!gameOver && isVsComputer && turn === 'B') setTimeout(makeAIMove, 750);
}
function endGame(title, text) {
    gameOver = true;
    drawBoard();
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    if (messageBox) messageBox.classList.add('visible');
    if (window.towerVictory) window.towerVictory(title.indexOf('White') === 0 ? 'W' : 'B');
}

function initGame() {
    board = [];
    for (var l = 0; l < LEVELS; l++) { var row = []; for (var s = 0; s < SLOTS; s++) row.push(null); board.push(row); }
    pool = { W: POOL_START, B: POOL_START };
    turn = 'W'; selected = null; attackTargets = []; bonusActive = false; busy = false; gameOver = false;
    if (messageBox) messageBox.classList.remove('visible');
    if (window.is3DView && window.towerRebuild) window.towerRebuild();
    setMode('place');
}

// ============================================
// EVENTS
// ============================================
if (resetButton) resetButton.addEventListener('click', function () { initGame(); showMessage('The tower is cleared.'); });
if (opponentButton) opponentButton.addEventListener('click', function () {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = 'Opponent: ' + (isVsComputer ? 'Computer' : 'Human');
    initGame();
    showMessage(isVsComputer ? 'VS Computer' : 'VS Human');
});
['place', 'move', 'levelup'].forEach(function (m) {
    var el = document.getElementById('act-' + m);
    if (el) el.addEventListener('click', function () { setMode(m); });
});

// ============================================
// BASIC AI (Black) — follows the rules, plays for control
// ============================================
function allTiles(color) {
    var out = [];
    for (var l = 0; l < LEVELS; l++) for (var s = 0; s < SLOTS; s++) { var t = tileAt(l, s); if (t && t.owner === color) out.push({ level: l, slot: s }); }
    return out;
}
function emptySlots() {
    var out = [];
    for (var l = 0; l < LEVELS; l++) for (var s = 0; s < SLOTS; s++) if (!tileAt(l, s)) out.push({ level: l, slot: s });
    return out;
}
function makeAIMove() {
    if (gameOver || turn !== 'B' || busy) return;

    // 1. Best capturing attack
    var best = null;
    allTiles('B').forEach(function (p) {
        computeAttackTargets(p.level, p.slot).forEach(function (g) {
            if (g.win && (!best || g.tiles.length > best.tgt.tiles.length)) best = { from: p, tgt: g };
        });
    });
    if (best) {
        mode = 'move'; selected = best.from; attackTargets = computeAttackTargets(best.from.level, best.from.slot);
        drawBoard();
        setTimeout(function () { doAttack(best.tgt); }, 350);
        return;
    }

    // 2. Place toward the level/column where Black is strongest
    if (pool.B > 0) {
        var empties = emptySlots();
        if (empties.length) {
            empties.sort(function (a, b) { return blackAffinity(b) - blackAffinity(a); });
            var pick = empties[Math.floor(Math.random() * Math.min(3, empties.length))];
            mode = 'place'; drawBoard();
            setTimeout(function () { doPlace(pick.level, pick.slot); }, 300);
            return;
        }
    }

    // 3. Level up a tile that helps a future attack (prefer reaching 3, or ringing the bonus bell)
    var mine = allTiles('B');
    if (mine.length) {
        mine.sort(function (a, b) { return (tileAt(b.level, b.slot).num) - (tileAt(a.level, a.slot).num); });
        var lu = mine[0];
        mode = 'levelup'; drawBoard();
        setTimeout(function () {
            doLevelUp(lu.level, lu.slot);
            // If a bonus move opened up, make a simple one then it resolves the turn.
            if (bonusActive) setTimeout(aiBonusMove, 300);
        }, 300);
        return;
    }
    endTurn();
}
function blackAffinity(slot) {
    // how many Black tiles already share this slot's level + column
    var n = 0;
    for (var s = 0; s < SLOTS; s++) { var t = tileAt(slot.level, s); if (t && t.owner === 'B') n++; }
    for (var l = 0; l < LEVELS; l++) { var t2 = tileAt(l, slot.slot); if (t2 && t2.owner === 'B') n++; }
    return n;
}
function aiBonusMove() {
    if (!bonusActive) return;
    // Move one of Black's tiles toward a fuller line, else any legal move.
    var movers = allTiles('B');
    for (var i = 0; i < movers.length; i++) {
        var p = movers[i];
        var nbrs = neighbors(p.level, p.slot).filter(function (n) { return !tileAt(n.level, n.slot); });
        if (nbrs.length) { doMove(p, nbrs[Math.floor(Math.random() * nbrs.length)], true); return; }
    }
    // nothing movable — just end via a no-op move of the leveled tile's neighbour search failing
    bonusActive = false; endTurn();
}

document.addEventListener('DOMContentLoaded', initGame);
