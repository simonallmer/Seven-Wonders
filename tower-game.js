// TOWER GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Inspiration: the Porcelain Tower of Nanjing.
//
// Supports 2 or 4 players on the same octagonal tower. In the 4-player game the
// four builders (White, Red, Blue, Black) share the eight-slot rings and fight
// for control; a chain strikes ANY adjacent enemy colour. Reduce a rival to no
// tiles at all (board + pool) and they are out; the last builder standing wins,
// or take the classic control victory (a full ring, or two full columns).

// ============================================
// CONSTANTS
// ============================================
var LEVELS = 4;   // octagonal tiers, 0 = bottom .. 3 = top
var SLOTS = 8;    // slots per ring (octagon), a closed loop
var POOL_START = 12;

window.TOWER_LEVELS = LEVELS;
window.TOWER_SLOTS = SLOTS;

// seats — turn order runs W, R, U, B around the ring
var TOWER_COLORS = {
    W: { name: 'White', hex: 0xffffff },
    R: { name: 'Red', hex: 0xc0392b },
    U: { name: 'Blue', hex: 0x2a5db0 },
    B: { name: 'Black', hex: 0x1a1a1a }
};
var TURN_ORDER = { 2: ['W', 'B'], 4: ['W', 'R', 'U', 'B'] };

// ============================================
// GAME STATE
// ============================================
// board[level][slot] = null | { owner:'W'|'R'|'U'|'B', num:1|2|3 }
var board = [];
var playerCount = 2;
var PLAYERS = TURN_ORDER[2].slice();
var pool = {};
var turn = 'W';
var mode = 'place';        // 'place' | 'move' | 'levelup' | 'attack' | 'bonus'
var selected = null;       // { level, slot }
var attackTargets = [];    // [{ tiles:[{level,slot}], yourSum, enemySum, win }]
var bonusActive = false;
var busy = false;
var gameOver = false;
var isVsComputer = true;   // 2-player: is Black a computer? (4-player: every non-White seat is)

window.getTowerState = function () {
    return {
        board: board, pool: pool, turn: turn, mode: mode, selected: selected,
        attackTargets: attackTargets, bonusActive: bonusActive, busy: busy, gameOver: gameOver,
        players: PLAYERS.slice(), playerCount: playerCount, colors: TOWER_COLORS
    };
};

// ============================================
// DOM
// ============================================
var statusIndicator = document.getElementById('player-indicator');
var statusName = document.getElementById('player-name');
var resetButton = document.getElementById('reset-button');
var opponentButton = document.getElementById('opponent-btn');
var playersButton = document.getElementById('players-btn');
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
function colorName(c) { return TOWER_COLORS[c] ? TOWER_COLORS[c].name : c; }

// ============================================
// PLAYERS / SEATS
// ============================================
function isComputer(c) {
    if (c === 'W') return false;                 // the human always plays White
    if (playerCount === 2) return isVsComputer;  // Black is optionally a computer
    return true;                                 // 4-player: Red/Blue/Black are computers
}
function isOut(c) { return countOnBoard(c) === 0 && pool[c] === 0; }
function hasAction(c) {
    if (countOnBoard(c) > 0) return true;        // a tile can always level up
    return pool[c] > 0 && placeableSlots(c).length > 0;
}
function nextTurn(from) {
    var i = PLAYERS.indexOf(from);
    for (var k = 1; k <= PLAYERS.length; k++) {
        var c = PLAYERS[(i + k) % PLAYERS.length];
        if (!isOut(c) && hasAction(c)) return c;
    }
    for (var j = 1; j <= PLAYERS.length; j++) {  // fallback: any seat still in the game
        var c2 = PLAYERS[(i + j) % PLAYERS.length];
        if (!isOut(c2)) return c2;
    }
    return from;
}

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
function ringChain(L, S, color) {
    var t = tileAt(L, S);
    if (!t || t.owner !== color) return [];
    var set = [{ level: L, slot: S }];
    var k = (S + 1) % SLOTS, guard = 0;
    while (k !== S && guard++ < SLOTS) {
        var tt = tileAt(L, k);
        if (tt && tt.owner === color) { set.push({ level: L, slot: k }); k = (k + 1) % SLOTS; } else break;
    }
    k = (S + SLOTS - 1) % SLOTS; guard = 0;
    while (k !== S && guard++ < SLOTS) {
        var tt2 = tileAt(L, k);
        if (tt2 && tt2.owner === color && !set.some(function (p) { return p.slot === k; })) {
            set.push({ level: L, slot: k }); k = (k + SLOTS - 1) % SLOTS;
        } else break;
    }
    return set;
}
function colChain(L, S, color) {
    var t = tileAt(L, S);
    if (!t || t.owner !== color) return [];
    var set = [{ level: L, slot: S }];
    for (var u = L + 1; u < LEVELS; u++) { var tu = tileAt(u, S); if (tu && tu.owner === color) set.push({ level: u, slot: S }); else break; }
    for (var d = L - 1; d >= 0; d--) { var td = tileAt(d, S); if (td && td.owner === color) set.push({ level: d, slot: S }); else break; }
    return set;
}
function sumOf(set) { return set.reduce(function (a, p) { var t = tileAt(p.level, p.slot); return a + (t ? t.num : 0); }, 0); }

// All enemy chains a given attacker can strike (both axes, both ends). In the
// 4-player game "enemy" is any colour that is not the mover's — the beyond tile's
// own colour defines the chain that would be captured.
function computeAttackTargets(L, S) {
    var me = turn;
    var targets = [];

    // ---- Horizontal (ring) ----
    var hChain = ringChain(L, S, me);
    if (hChain.length > 0 && hChain.length < SLOTS) {
        var slotsInChain = hChain.map(function (p) { return p.slot; });
        [1, -1].forEach(function (dir) {
            var k = S, guard = 0;
            while (slotsInChain.indexOf((k + dir + SLOTS) % SLOTS) !== -1 && guard++ < SLOTS) k = (k + dir + SLOTS) % SLOTS;
            var beyond = (k + dir + SLOTS) % SLOTS;
            var bt = tileAt(L, beyond);
            if (bt && bt.owner !== me) {
                addTarget(targets, hChain, ringChain(L, beyond, bt.owner));
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
            if (bt && bt.owner !== me) {
                addTarget(targets, vChain, colChain(e.l, S, bt.owner));
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
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

function drawBoard() {
    // per-seat counts (top HUD + menu) and turn-state styling
    ['W', 'R', 'U', 'B'].forEach(function (c) {
        var inGame = PLAYERS.indexOf(c) !== -1;
        setText('hud-' + c, countOnBoard(c));
        setText('res-' + c, pool[c] != null ? pool[c] : 0);
        var item = document.getElementById('hud-item-' + c);
        if (item) {
            item.style.display = inGame ? '' : 'none';
            item.classList.toggle('active-turn', !gameOver && turn === c);
            item.classList.toggle('dead', inGame && isOut(c));
        }
    });

    if (statusName) statusName.textContent = colorName(turn) + "'s Turn";
    if (statusIndicator) statusIndicator.style.backgroundColor = '#' + TOWER_COLORS[turn].hex.toString(16).padStart(6, '0');

    var hasOwn = !gameOver && countOnBoard(turn) > 0;
    var canPlace = !gameOver && pool[turn] > 0 && placeableSlots(turn).length > 0;
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
function playerLevels(color) {
    var levels = [];
    for (var L = 0; L < LEVELS; L++) {
        for (var s = 0; s < SLOTS; s++) { var t = tileAt(L, s); if (t && t.owner === color) { levels.push(L); break; } }
    }
    return levels;
}
function canPlaceOn(color, L) {
    if (L === 0) return true;
    return playerLevels(color).indexOf(L - 1) !== -1;   // climb from the level below
}
window.towerCanPlaceOn = canPlaceOn;
function placeableSlots(color) {
    var out = [];
    for (var l = 0; l < LEVELS; l++) {
        if (!canPlaceOn(color, l)) continue;
        for (var s = 0; s < SLOTS; s++) { if (!tileAt(l, s)) out.push({ level: l, slot: s }); }
    }
    return out;
}
function canMoveTo(from, to) {
    if (to.slot === from.slot && to.level < from.level) {
        for (var l = from.level - 1; l > to.level; l--) if (tileAt(l, to.slot)) return false;
        return true;
    }
    return isAdjacent(from, to);
}

// ============================================
// MODES / INTERACTION
// ============================================
function setMode(m) {
    if (busy || gameOver || bonusActive) return;
    mode = m;
    selected = null;
    attackTargets = [];
    setPrompt('');
    drawBoard();
}
function selectMover(l, s) {
    selected = { level: l, slot: s };
    attackTargets = computeAttackTargets(l, s);
    setPrompt('');
    drawBoard();
}
function onSlotTap(l, s) {
    if (busy || gameOver) return;
    if (isComputer(turn)) return;                // ignore taps on a computer's turn
    var t = tileAt(l, s);

    if (bonusActive) { handleBonus(l, s, t); return; }

    if (mode === 'place') {
        if (t) { showMessage('That slot is taken.'); return; }
        if (pool[turn] <= 0) { showMessage('Your pool is empty.'); return; }
        if (!canPlaceOn(turn, l)) { showMessage('Must place on level 0, or on a level directly above your presence.'); return; }
        doPlace(l, s);
        return;
    }
    if (mode === 'move') {
        if (selected) {
            if (selected.level === l && selected.slot === s) { selected = null; attackTargets = []; drawBoard(); return; }
            var tgt = attackTargets.find(function (g) { return g.tiles.some(function (p) { return p.level === l && p.slot === s; }); });
            if (tgt) { doAttack(tgt); return; }
            if (s === selected.slot && l < selected.level) {
                if (canMoveTo(selected, { level: l, slot: s })) {
                    if (t) {
                        if (t.owner !== turn) { doGravityAttack(selected, { level: l, slot: s }); return; }
                        showMessage('Cannot fall onto your own tile.'); return;
                    }
                    doMove(selected, { level: l, slot: s }, false); return;
                }
                showMessage('Path is blocked by another tile.'); return;
            }
            if (!t && canMoveTo(selected, { level: l, slot: s })) { doMove(selected, { level: l, slot: s }, false); return; }
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
    if (!t && canMoveTo(selected, { level: l, slot: s })) { doMove(selected, { level: l, slot: s }, true); return; }
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
function doGravityAttack(from, to) {
    var attacker = board[from.level][from.slot];
    var defender = board[to.level][to.slot];
    if (!attacker || !defender) { showMessage('Invalid attack.'); return; }
    var atkNum = attacker.num, defNum = defender.num;
    if (atkNum < defNum) {
        showMessage('Your tile (' + atkNum + ') is not strong enough to crush the enemy tile (' + defNum + ').');
        return;
    }
    busy = true;
    pool[defender.owner] += defNum;              // defender's spent pips return to its owner
    board[to.level][to.slot] = attacker;
    board[from.level][from.slot] = null;
    selected = null;
    attackTargets = [];
    var done = function () {
        busy = false;
        showMessage('Gravity crush! ' + colorName(defender.owner) + '\'s tile (' + defNum + ') eliminated.');
        endTurn();
    };
    if (window.towerAnimMove) window.towerAnimMove(from, to, done); else done();
}

// ============================================
// TURN FLOW
// ============================================
function endTurn() {
    selected = null; attackTargets = []; bonusActive = false;

    // classic control victory for whoever just acted
    var w = winInfo(turn);
    if (w) return endGame(colorName(turn) + ' Wins!', colorName(turn) + ' controls ' + w + '.', turn);

    // elimination: last builder with any tiles (board or pool) standing
    var living = PLAYERS.filter(function (c) { return !isOut(c); });
    if (living.length === 1) {
        return endGame(colorName(living[0]) + ' Wins!', colorName(living[0]) + ' is the last builder standing on the tower.', living[0]);
    }
    if (living.length === 0) return endGame('Draw', 'The tower stands empty.', null);

    // if nobody can act, settle on who holds the most tiles
    if (!living.some(hasAction)) {
        var best = living.slice().sort(function (a, b) { return countOnBoard(b) - countOnBoard(a); })[0];
        return endGame(colorName(best) + ' Wins!', colorName(best) + ' holds the most of the tower — no moves remain.', best);
    }

    turn = nextTurn(turn);
    mode = (pool[turn] > 0 && placeableSlots(turn).length > 0) ? 'place' : 'move';
    setMode(mode);

    if (!gameOver && isComputer(turn)) setTimeout(makeAIMove, 700);
}
var winRevealTimer = null;
function endGame(title, text, winColor) {
    gameOver = true;
    drawBoard();
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    if (window.towerVictory) window.towerVictory(winColor);
    clearTimeout(winRevealTimer);
    winRevealTimer = setTimeout(function () {
        if (messageBox) messageBox.classList.add('visible');
    }, 1100);
}

function initGame() {
    PLAYERS = TURN_ORDER[playerCount].slice();
    board = [];
    for (var l = 0; l < LEVELS; l++) { var row = []; for (var s = 0; s < SLOTS; s++) row.push(null); board.push(row); }
    pool = {};
    PLAYERS.forEach(function (c) { pool[c] = POOL_START; });
    turn = 'W'; selected = null; attackTargets = []; bonusActive = false; busy = false; gameOver = false;
    clearTimeout(winRevealTimer);
    if (messageBox) messageBox.classList.remove('visible');
    if (window.is3DView && window.towerRebuild) window.towerRebuild();
    setMode('place');
}
window.towerInit = initGame;

function setPlayerCount(n) {
    playerCount = (n === 4) ? 4 : 2;
    if (playersButton) playersButton.textContent = 'Players: ' + playerCount;
    if (opponentButton) opponentButton.style.display = playerCount === 2 ? '' : 'none';
    initGame();
    showMessage(playerCount + '-player tower');
}
window.towerSetPlayers = setPlayerCount;

// ============================================
// EVENTS
// ============================================
if (resetButton) resetButton.addEventListener('click', function () { initGame(); showMessage('The tower is cleared.'); });
if (opponentButton) opponentButton.addEventListener('click', function () {
    if (playerCount !== 2) return;
    isVsComputer = !isVsComputer;
    opponentButton.textContent = 'Opponent: ' + (isVsComputer ? 'Computer' : 'Human');
    initGame();
    showMessage(isVsComputer ? 'VS Computer' : 'VS Human');
});
if (playersButton) playersButton.addEventListener('click', function () {
    setPlayerCount(playerCount === 2 ? 4 : 2);
});
['place', 'move', 'levelup'].forEach(function (m) {
    var el = document.getElementById('act-' + m);
    if (el) el.addEventListener('click', function () { setMode(m); });
});

// ============================================
// COMPUTER PLAYERS — each non-human seat plays for control
// ============================================
function allTiles(color) {
    var out = [];
    for (var l = 0; l < LEVELS; l++) for (var s = 0; s < SLOTS; s++) { var t = tileAt(l, s); if (t && t.owner === color) out.push({ level: l, slot: s }); }
    return out;
}
function affinity(slot, me) {
    var n = 0;
    for (var s = 0; s < SLOTS; s++) { var t = tileAt(slot.level, s); if (t && t.owner === me) n++; }
    for (var l = 0; l < LEVELS; l++) { var t2 = tileAt(l, slot.slot); if (t2 && t2.owner === me) n++; }
    return n;
}
function makeAIMove() {
    if (gameOver || busy || !isComputer(turn)) return;
    var me = turn;

    // 1. Best capturing chain attack
    var best = null;
    allTiles(me).forEach(function (p) {
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

    // 1b. Gravity attack — drop onto an enemy directly below
    var gravBest = null;
    allTiles(me).forEach(function (p) {
        var pt = tileAt(p.level, p.slot);
        for (var gl = p.level - 1; gl >= 0; gl--) {
            var gd = tileAt(gl, p.slot);
            if (gd) {
                if (gd.owner !== me && pt.num >= gd.num) {
                    var blocked = false;
                    for (var ck = p.level - 1; ck > gl; ck--) if (tileAt(ck, p.slot)) { blocked = true; break; }
                    if (!blocked && (!gravBest || gd.num > tileAt(gravBest.to.level, gravBest.to.slot).num)) {
                        gravBest = { from: p, to: { level: gl, slot: p.slot } };
                    }
                }
                break;
            }
        }
    });
    if (gravBest) {
        mode = 'move'; drawBoard();
        setTimeout(function () { doGravityAttack(gravBest.from, gravBest.to); }, 300);
        return;
    }

    // 2. Place toward the level/column where this seat is strongest
    if (pool[me] > 0) {
        var empties = placeableSlots(me);
        if (empties.length) {
            empties.sort(function (a, b) { return affinity(b, me) - affinity(a, me); });
            var pick = empties[Math.floor(Math.random() * Math.min(3, empties.length))];
            mode = 'place'; drawBoard();
            setTimeout(function () { doPlace(pick.level, pick.slot); }, 300);
            return;
        }
    }

    // 3. Level up the strongest tile (may ring the bonus bell)
    var mine = allTiles(me);
    if (mine.length) {
        mine.sort(function (a, b) { return (tileAt(b.level, b.slot).num) - (tileAt(a.level, a.slot).num); });
        var lu = mine[0];
        mode = 'levelup'; drawBoard();
        setTimeout(function () {
            doLevelUp(lu.level, lu.slot);
            if (bonusActive) setTimeout(aiBonusMove, 300);
        }, 300);
        return;
    }
    endTurn();
}
function aiBonusMove() {
    if (!bonusActive) return;
    var me = turn;
    var movers = allTiles(me);
    for (var i = 0; i < movers.length; i++) {
        var p = movers[i];
        var pt = tileAt(p.level, p.slot);
        var targets = [];
        neighbors(p.level, p.slot).filter(function (n) { return !tileAt(n.level, n.slot); }).forEach(function (n) { targets.push(n); });
        for (var l = p.level - 1; l >= 0; l--) { if (!tileAt(l, p.slot)) targets.push({ level: l, slot: p.slot }); }
        for (var gl = p.level - 1; gl >= 0; gl--) {
            var gd = tileAt(gl, p.slot);
            if (gd && gd.owner !== me && pt.num >= gd.num) {
                var blocked = false;
                for (var ck = p.level - 1; ck > gl; ck--) if (tileAt(ck, p.slot)) { blocked = true; break; }
                if (!blocked) targets.push({ level: gl, slot: p.slot, isGravityAttack: true });
                break;
            }
        }
        if (targets.length) {
            var pick = targets[Math.floor(Math.random() * targets.length)];
            if (pick.isGravityAttack) doGravityAttack(p, pick);
            else doMove(p, pick, true);
            return;
        }
    }
    bonusActive = false; endTurn();
}

document.addEventListener('DOMContentLoaded', initGame);
