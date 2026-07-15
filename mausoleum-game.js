// MAUSOLEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
var PLAYER_1 = 1; // white
var PLAYER_2 = 2; // black
var EMPTY = 0;
var HOLE = 3; // Collapsed field: a permanent pit. Blocks movement; acts as a neutral wall for encirclement.
var PLAYER_3 = 4; // red  (4-player) — note: 3 is taken by HOLE, so red/blue use 4/5
var PLAYER_4 = 5; // blue (4-player)

// Board shapes per mode.
//  - 2 players: the classic diamond/hexagon.
//  - 4 players: an elongated "Long Barrow" hexagon (wide & shallow). Four corner wedges hold
//    the armies (white BL, red TL, black TR, blue BR); the middle row and the two pointed
//    left/right tips are neutral collapse-funnels.
var ROW_LENGTHS_2P = [4, 5, 6, 7, 8, 7, 6, 5, 4];
var ROW_LENGTHS_4P = [8, 9, 10, 11, 10, 9, 8];
var ROW_LENGTHS = ROW_LENGTHS_2P;
var TOTAL_ROWS = ROW_LENGTHS.length;

// Canonical Seven Wonders colours + clockwise turn order white -> red -> black -> blue.
var COLOR_OF = { 1: 'white', 2: 'black', 4: 'red', 5: 'blue' };
var TURN_ORDER_2P = [PLAYER_1, PLAYER_2];
var TURN_ORDER_4P = [PLAYER_1, PLAYER_3, PLAYER_2, PLAYER_4];
var turnOrder = TURN_ORDER_2P;
var eliminated = {}; // playerId -> true once below 4 stones / entombed (4-player)

function isPlayerVal(v) { return v === PLAYER_1 || v === PLAYER_2 || v === PLAYER_3 || v === PLAYER_4; }
function activePlayers() { return turnOrder.filter(function (p) { return !eliminated[p]; }); }
function colorName(p) { var c = COLOR_OF[p] || 'white'; return c.charAt(0).toUpperCase() + c.slice(1); }

// Apply the board shape + turn order for the current player count.
function configureBoard() {
    if (playerCount === 4) {
        ROW_LENGTHS = ROW_LENGTHS_4P;
        turnOrder = TURN_ORDER_4P;
    } else {
        ROW_LENGTHS = ROW_LENGTHS_2P;
        turnOrder = TURN_ORDER_2P;
    }
    TOTAL_ROWS = ROW_LENGTHS.length;
    window.ROW_LENGTHS = ROW_LENGTHS;
    window.TOTAL_ROWS = TOTAL_ROWS;
    window.playerCount = playerCount;
}

window.PLAYER_1 = PLAYER_1;
window.PLAYER_2 = PLAYER_2;
window.PLAYER_3 = PLAYER_3;
window.PLAYER_4 = PLAYER_4;
window.EMPTY = EMPTY;
window.HOLE = HOLE;
window.COLOR_OF = COLOR_OF;
window.isPlayerVal = isPlayerVal;
window.ROW_LENGTHS = ROW_LENGTHS;
window.TOTAL_ROWS = TOTAL_ROWS;

// ============================================
// GAME STATE
// ============================================
var board = [];
var currentPlayer = PLAYER_1;
var selectedStone = null; // { r, c }
var validMoves = [];
var gameOver = false;
var isVsComputer = true;
var playerCount = 2;

window.board = board;
window.currentPlayer = currentPlayer;
window.selectedStone = selectedStone;
window.validMoves = validMoves;
window.gameOver = gameOver;

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {r, c}
let aiConsecutiveMoveCount = 0;

// Prevents a pushed stone from being immediately shoved straight back next turn.
let lastPushedStone = null; // {r, c}

// Game data maps
let fieldElements = new Map(); // "r,c" -> { spot, hitbox }
let neighborMap = new Map(); // "r,c" -> [{r,c}, ...]
let directionMap = new Map(); // "r,c" -> [[{r,c}, ...], ...] (6 directions)

// ============================================
// DOM ELEMENTS
// ============================================
const statusIndicator = document.getElementById('player-indicator');
const statusName = document.getElementById('player-name');
const p1CountHud = document.getElementById('p1-count-hud');
const p2CountHud = document.getElementById('p2-count-hud');
const resetButton = document.getElementById('reset-button');
const opponentButton = document.getElementById('opponent-btn');
const playerCountBtn = document.getElementById('player-count-btn');
const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const gameMessage = document.getElementById('game-message');

// ============================================
// BOARD INITIALIZATION
// ============================================

function createBoard() {
    if (playerCount === 4) { createBoard4(); return; }
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
        const rowLen = ROW_LENGTHS[r];
        const row = Array(rowLen).fill(EMPTY);

        // Setup Player 1 (White): Rows 0 and 1
        if (r === 0 || r === 1) {
            row.fill(PLAYER_1);
        }
        // Setup Player 2 (Black): Bottom two rows (Rows 7 and 8)
        if (r === TOTAL_ROWS - 2 || r === TOTAL_ROWS - 1) {
            row.fill(PLAYER_2);
        }
        board.push(row);
    }
    // Shared reference to window.board
    window.board = board;
}

// 4-player "Long Barrow": four corner wedges. Each row's outer ~third on the left and right
// is a home band; the middle row and the two pointed tips stay empty (neutral funnels).
//   top half -> left = RED, right = BLACK ;  bottom half -> left = WHITE, right = BLUE
function createBoard4() {
    board = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
        board.push(Array(ROW_LENGTHS[r]).fill(EMPTY));
    }
    const mid = Math.floor(TOTAL_ROWS / 2);
    for (let r = 0; r < TOTAL_ROWS; r++) {
        if (r === mid) continue; // neutral spine
        const len = ROW_LENGTHS[r];
        const band = Math.floor(len / 3);
        const top = r < mid;
        for (let c = 0; c < band; c++) {
            board[r][c] = top ? PLAYER_3 : PLAYER_1;            // left wedge: red(top)/white(bottom)
        }
        for (let c = len - band; c < len; c++) {
            board[r][c] = top ? PLAYER_2 : PLAYER_4;            // right wedge: black(top)/blue(bottom)
        }
    }
    window.board = board;
}

// ============================================
// COORDINATE & RENDERING
// ============================================

function getCoords(r, c) {
    const maxLen = ROW_LENGTHS[Math.floor(TOTAL_ROWS / 2)];
    const rowLen = ROW_LENGTHS[r];

    const H_PADDING = 5;
    const V_PADDING = 5;

    const offsetX = (maxLen - rowLen) * (100 - 2 * H_PADDING) / (maxLen - 1) / 2;

    const x = H_PADDING + offsetX + c * (100 - 2 * H_PADDING) / (maxLen - 1);
    const y = V_PADDING + r * (100 - 2 * V_PADDING) / (TOTAL_ROWS - 1);

    return { x, y };
}

function drawBoard() {
    const stoneCounts = { [PLAYER_1]: 0, [PLAYER_2]: 0, [PLAYER_3]: 0, [PLAYER_4]: 0 };

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const stoneValue = board[r][c];
            if (isPlayerVal(stoneValue)) {
                stoneCounts[stoneValue]++;
            }
        }
    }

    // Update HUD (red/blue counters only shown in 4-player mode)
    if (p1CountHud) p1CountHud.textContent = stoneCounts[PLAYER_1];
    if (p2CountHud) p2CountHud.textContent = stoneCounts[PLAYER_2];
    const p3Hud = document.getElementById('p3-count-hud');
    const p4Hud = document.getElementById('p4-count-hud');
    if (p3Hud) p3Hud.textContent = stoneCounts[PLAYER_3];
    if (p4Hud) p4Hud.textContent = stoneCounts[PLAYER_4];

    const COLOR_HEX = { 1: '#ffffff', 2: '#1a1a1a', 4: '#c0392b', 5: '#2e6fb0' };
    if (statusName) {
        statusName.textContent = colorName(currentPlayer) + "'s Turn";
    }
    if (statusIndicator) {
        statusIndicator.style.backgroundColor = COLOR_HEX[currentPlayer] || '#ffffff';
    }

    // Sync 3D pieces
    if (window.is3DView && typeof window.sync3D === 'function') {
        window.sync3D();
    }
    
    // Update 3D highlights
    if (window.is3DView && typeof window.update3DViews === 'function') {
        window.update3DViews();
    }
}

function highlightSelection() {
    // Update 3D highlights if in 3D view
    if (window.is3DView && typeof window.update3DViews === 'function') {
        window.update3DViews();
    }
}

function showMessage(text, duration = 2000) {
    if (!gameMessage) return;
    gameMessage.textContent = text;
    gameMessage.classList.remove('hidden');
    clearTimeout(window.msgTimeout);
    window.msgTimeout = setTimeout(() => {
        gameMessage.classList.add('hidden');
    }, duration);
}

// ============================================
// NEIGHBOR & DIRECTION LOGIC
// ============================================

function buildNeighborMaps() {
    neighborMap.clear();
    directionMap.clear();

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const key = `${r},${c}`;
            const neighbors = [];

            // Dir 0: W
            if (c > 0) neighbors.push({ r, c: c - 1 });
            // Dir 1: E
            if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r, c: c + 1 });

            // Rows above
            if (r > 0) {
                if (ROW_LENGTHS[r] < ROW_LENGTHS[r - 1]) {
                    neighbors.push({ r: r - 1, c: c });
                    neighbors.push({ r: r - 1, c: c + 1 });
                } else {
                    if (c > 0) neighbors.push({ r: r - 1, c: c - 1 });
                    if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r: r - 1, c: c });
                }
            }

            // Rows below
            if (r < TOTAL_ROWS - 1) {
                if (ROW_LENGTHS[r] < ROW_LENGTHS[r + 1]) {
                    neighbors.push({ r: r + 1, c: c });
                    neighbors.push({ r: r + 1, c: c + 1 });
                } else {
                    if (c > 0) neighbors.push({ r: r + 1, c: c - 1 });
                    if (c < ROW_LENGTHS[r] - 1) neighbors.push({ r: r + 1, c: c });
                }
            }
            neighborMap.set(key, neighbors);
        }
    }

    // Build direction paths
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const key = `${r},${c}`;
            const paths = [];
            const startNeighbors = getNeighbors(r, c);

            for (const n1 of startNeighbors) {
                const path = [n1];
                let prev = { r, c };
                let curr = n1;
                while (true) {
                    const next = getNextOnLine(prev, curr);
                    if (!next || !isInBounds(next.r, next.c)) break;
                    path.push(next);
                    prev = curr;
                    curr = next;
                }
                paths.push(path);
            }
            directionMap.set(key, paths);
        }
    }
}

function getNextOnLine(prev, curr) {
    const neighbors = getNeighbors(curr.r, curr.c);
    const prev_pos = getCoords(prev.r, prev.c);
    const curr_pos = getCoords(curr.r, curr.c);

    const EPSILON = 0.01;
    const dx = curr_pos.x - prev_pos.x;
    const dy = curr_pos.y - prev_pos.y;

    for (const n of neighbors) {
        if (n.r === prev.r && n.c === prev.c) continue;
        const n_pos = getCoords(n.r, n.c);
        const ndx = n_pos.x - curr_pos.x;
        const ndy = n_pos.y - curr_pos.y;
        if (Math.abs(ndx - dx) < EPSILON && Math.abs(ndy - dy) < EPSILON) {
            return n;
        }
    }
    return null;
}

function getNeighbors(r, c) {
    return neighborMap.get(`${r},${c}`) || [];
}

function isInBounds(r, c) {
    return r >= 0 && r < TOTAL_ROWS && c >= 0 && c < ROW_LENGTHS[r];
}

// ============================================
// GAME LOGIC
// ============================================

function calculateValidMoves(r, c) {
    validMoves = [];

    // A stone with one liberty or fewer is Trapped: it can neither glide NOR push.
    // This keeps encirclement achievable — a near-surrounded stone cannot fight its
    // way out or thin the ring with a last-ditch shove.
    if (isTrapped(r, c)) return;

    const paths = directionMap.get(`${r},${c}`);
    if (!paths) return;

    // GLIDE: slide along each line until blocked, landing on the last empty field.
    for (const path of paths) {
        let lastEmpty = null;
        for (const pos of path) {
            if (board[pos.r][pos.c] === EMPTY) {
                lastEmpty = pos;
            } else {
                break; // Blocked by a stone or a pit
            }
        }
        if (lastEmpty) validMoves.push({ r: lastEmpty.r, c: lastEmpty.c, type: 'glide' });
    }

    // PUSH: shove an adjacent stone one field along the line.
    for (const push of calculatePushMoves(r, c)) {
        validMoves.push(push);
    }
}

// A stone may push the adjacent stone (own or enemy) one field further along any of the
// 6 directions, provided the field beyond is empty (reposition) or a pit (the pushed
// stone falls in and dies). Mirrors the Push mechanic of Pyramid and Colossus.
function calculatePushMoves(r, c) {
    const pushes = [];
    const paths = directionMap.get(`${r},${c}`);
    if (!paths) return pushes;

    for (const path of paths) {
        if (path.length < 2) continue;            // need an adjacent stone AND a field beyond it
        const adj = path[0];
        const beyond = path[1];
        const adjVal = board[adj.r][adj.c];
        if (!isPlayerVal(adjVal)) continue; // must be a stone to push

        // Don't allow shoving the just-pushed stone straight back.
        if (lastPushedStone && lastPushedStone.r === adj.r && lastPushedStone.c === adj.c) continue;

        const beyondVal = board[beyond.r][beyond.c];
        if (beyondVal === EMPTY) {
            pushes.push({ r: adj.r, c: adj.c, type: 'push', kill: false, pushTo: { r: beyond.r, c: beyond.c } });
        } else if (beyondVal === HOLE) {
            pushes.push({ r: adj.r, c: adj.c, type: 'push', kill: true, pushTo: { r: beyond.r, c: beyond.c } });
        }
        // beyond is another stone -> blocked, no push that way
    }
    return pushes;
}

function isTrapped(r, c) {
    const neighbors = getNeighbors(r, c);
    let emptyCount = neighbors.filter(n => board[n.r][n.c] === EMPTY).length;
    return emptyCount <= 1; // Trapped if only 1 or 0 directions to move
}

window.getCurrentPlayer = function () { return currentPlayer; };
function onCellClick(r, c) {
    if (gameOver) return;
    const val = board[r][c];

    // 1. Execute move (glide or push)
    if (selectedStone) {
        const chosen = validMoves.find(m => m.r === r && m.c === c);
        if (chosen) {
            if (chosen.type === 'push') {
                pushStone(selectedStone, chosen);
            } else {
                moveStone(selectedStone.r, selectedStone.c, r, c);
            }
            return;
        }
    }

    // 2. Select stone
    if (val === currentPlayer) {
        selectedStone = { r, c };
        calculateValidMoves(r, c);
        highlightSelection();
    } else {
        selectedStone = null;
        validMoves = [];
        highlightSelection();
    }
}

function moveStone(r1, c1, r2, c2) {
    if (window.is3DView && typeof window.animate3DMove === 'function') {
        window.animate3DMove(r1, c1, r2, c2, () => {
            performMoveLogic(r1, c1, r2, c2);
        });
    } else {
        performMoveLogic(r1, c1, r2, c2);
    }
}

function performMoveLogic(r1, c1, r2, c2) {
    board[r2][c2] = board[r1][c1];
    board[r1][c1] = EMPTY;
    lastPushedStone = null; // a glide clears the push-back lock
    finishTurn();
}

// PUSH: the pusher advances into the adjacent cell; the pushed stone moves one field
// further — into an empty field, or into a pit where it falls to its death.
function pushStone(from, mv) {
    if (window.is3DView && typeof window.animate3DPush === 'function') {
        window.animate3DPush(from.r, from.c, mv.r, mv.c, mv.pushTo.r, mv.pushTo.c, mv.kill, () => {
            performPushLogic(from, mv);
        });
    } else {
        performPushLogic(from, mv);
    }
}

function performPushLogic(from, mv) {
    const pusher = board[from.r][from.c];

    if (mv.kill) {
        // The pushed stone falls into the pit and is gone; the pit remains.
        board[mv.pushTo.r][mv.pushTo.c] = HOLE;
        lastPushedStone = null;
    } else {
        board[mv.pushTo.r][mv.pushTo.c] = board[mv.r][mv.c];
        lastPushedStone = { r: mv.pushTo.r, c: mv.pushTo.c };
    }
    board[mv.r][mv.c] = pusher;     // pusher advances into the vacated field
    board[from.r][from.c] = EMPTY;

    finishTurn();
}

// Shared end-of-turn resolution for both glide and push.
function finishTurn() {
    selectedStone = null;
    validMoves = [];

    resolveEncirclements();

    if (checkWinCondition()) {
        drawBoard();
        return;
    }

    advanceToNextPlayer();
    if (gameOver) {
        drawBoard();
        return;
    }

    drawBoard();

    if (!gameOver && isAITurn()) {
        setTimeout(makeAIMove, 600);
    }
}

// White is always the human; everyone else is AI when the computer opponent is enabled.
function isAITurn() {
    if (!isVsComputer || gameOver) return false;
    return playerCount === 4 ? currentPlayer !== PLAYER_1 : currentPlayer === PLAYER_2;
}
window.isAITurn = isAITurn;

// Advance clockwise to the next player who can move. In 4-player, a player sealed in (no
// legal move) is eliminated — their stones collapse into pits — and we keep searching.
function advanceToNextPlayer() {
    const idx = turnOrder.indexOf(currentPlayer);
    let next = idx;
    for (let guard = 0; guard < turnOrder.length + 1; guard++) {
        do { next = (next + 1) % turnOrder.length; } while (eliminated[turnOrder[next]] && next !== idx);
        currentPlayer = turnOrder[next];

        if (playerHasAnyMove(currentPlayer)) return;

        // Entombed.
        if (playerCount === 4) {
            eliminatePlayer(currentPlayer);
            if (checkWinCondition()) return;
            // loop on to the following player
        } else {
            checkStalemate(currentPlayer); // 2-player: a sealed-in player loses outright
            return;
        }
    }
}

// 4-player: remove a player from the game; their remaining stones collapse into pits.
function eliminatePlayer(p) {
    if (eliminated[p]) return;
    eliminated[p] = true;
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] === p) board[r][c] = HOLE;
        }
    }
}

function resolveEncirclements() {
    let captured = false;
    const toRemove = [];

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const val = board[r][c];
            if (!isPlayerVal(val)) continue;

            const neighbors = getNeighbors(r, c);
            // A cell counts as "surrounding" if it is occupied by a stone OR is a pit (deadly wall).
            const occupied = neighbors.filter(n => board[n.r][n.c] !== EMPTY);

            if (occupied.length === neighbors.length) { // Fully encircled (stones and/or pits on every side)
                // Any other colour counts as an enemy, so 4-player coalitions can jointly encircle.
                const friendlies = neighbors.filter(n => board[n.r][n.c] === val).length;
                const enemies = neighbors.filter(n => { const v = board[n.r][n.c]; return isPlayerVal(v) && v !== val; }).length;

                if (enemies > friendlies) {
                    toRemove.push({ r, c });
                    captured = true;
                    // Trigger lightning effect for 3D
                    if (window.is3DView && typeof window.trigger3DCapture === 'function') {
                        window.trigger3DCapture(r, c);
                    }
                }
            }
        }
    }

    // The stone falls to its death and the field collapses into a permanent pit.
    toRemove.forEach(p => { board[p.r][p.c] = HOLE; });
    if (captured) resolveEncirclements(); // Recursive check for chain reactions (collapse cascades)
}

function checkWinCondition() {
    const counts = { [PLAYER_1]: 0, [PLAYER_2]: 0, [PLAYER_3]: 0, [PLAYER_4]: 0 };
    board.forEach(row => row.forEach(val => { if (isPlayerVal(val)) counts[val]++; }));

    if (playerCount === 4) {
        // Any active player below 4 stones is eliminated (their stones collapse into pits).
        activePlayers().forEach(p => { if (counts[p] < 4) eliminatePlayer(p); });
        const alive = activePlayers();
        if (alive.length <= 1) {
            const winner = alive[0] || currentPlayer;
            showEndGameMessage(colorName(winner) + " Wins!", colorName(winner) + " is the last tomb-builder standing.");
            return true;
        }
        return false;
    }

    if (counts[PLAYER_1] < 4) {
        showEndGameMessage("Black Wins!", "White has fewer than four stones.");
        return true;
    }
    if (counts[PLAYER_2] < 4) {
        showEndGameMessage("White Wins!", "Black has fewer than four stones.");
        return true;
    }
    return false;
}

// Does the given player have at least one legal move? (No move = entombed = loss.)
function playerHasAnyMove(player) {
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] !== player) continue;
            calculateValidMoves(r, c);
            if (validMoves.length > 0) {
                validMoves = [];
                return true;
            }
        }
    }
    validMoves = [];
    return false;
}

// Returns true if the game ended because `player` has no legal move (entombed).
function checkStalemate(player) {
    if (playerHasAnyMove(player)) return false;
    if (player === PLAYER_1) {
        showEndGameMessage("Black Wins!", "White is entombed — no possible moves remain.");
    } else {
        showEndGameMessage("White Wins!", "Black is entombed — no possible moves remain.");
    }
    return true;
}

var winRevealTimer = null;
function showEndGameMessage(title, text) {
    gameOver = true;
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    // let the final move play out before covering the board
    clearTimeout(winRevealTimer);
    winRevealTimer = setTimeout(() => {
        if (messageBox) messageBox.classList.add('visible');
    }, 1100);
}

function initGame() {
    configureBoard();
    eliminated = {};
    createBoard();
    buildNeighborMaps();
    currentPlayer = turnOrder[0];
    selectedStone = null;
    validMoves = [];
    gameOver = false;
    lastPushedStone = null;
    // Rebuild the 3D fields (and, for 4-player, the elongated architecture).
    if (window.is3DView && typeof window.rebuild3DScene === 'function') {
        window.rebuild3DScene();
    } else if (window.is3DView && typeof window.rebuild3DBoard === 'function') {
        window.rebuild3DBoard();
    }
    drawBoard();
}

// ============================================
// EVENT LISTENERS
// ============================================

if (resetButton) resetButton.addEventListener('click', () => {
    initGame();
    showMessage("Game Reset");
});

if (opponentButton) opponentButton.addEventListener('click', () => {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = "Opponent: " + (isVsComputer ? "Computer" : "Human");
    initGame(); // Reset game when toggling opponent as requested
    showMessage(isVsComputer ? "VS Computer Mode" : "VS Human Mode");
});

if (playerCountBtn) playerCountBtn.addEventListener('click', () => {
    playerCount = (playerCount === 2) ? 4 : 2;
    playerCountBtn.textContent = "Players: " + playerCount;
    const show = playerCount === 4 ? 'flex' : 'none';
    const p3 = document.getElementById('p3-count-item');
    const p4 = document.getElementById('p4-count-item');
    if (p3) p3.style.display = show;
    if (p4) p4.style.display = show;
    initGame();
    showMessage(playerCount + "-Player Mode");
});

// ============================================
// AI LOGIC (FOLLOWS THE RULES)
// ============================================

function makeAIMove() {
    if (!isAITurn()) return;
    const me = currentPlayer;

    let possibleActions = [];

    // Find all valid moves for the current AI player's stones
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] === me) {
                calculateValidMoves(r, c);
                validMoves.forEach(move => {
                    possibleActions.push({ from: {r, c}, to: move });
                });
            }
        }
    }
    
    if (possibleActions.length === 0) return;

    // Randomise, then prefer shoving an enemy stone into a pit when the chance arises.
    shuffle(possibleActions);
    possibleActions.sort((a, b) => killScore(b) - killScore(a));

    const bestAction = possibleActions[0];
    onCellClick(bestAction.from.r, bestAction.from.c); // Select
    setTimeout(() => onCellClick(bestAction.to.r, bestAction.to.c), 400); // Execute
}

// Rates an action for the AI: shoving an enemy into a pit is best; never volunteer your own.
function killScore(action) {
    const mv = action.to;
    if (mv.type === 'push' && mv.kill) {
        const victim = board[mv.r][mv.c];
        if (victim === currentPlayer) return -1;       // self in = avoid
        if (isPlayerVal(victim)) return 2;             // any enemy in = great
    }
    return 0;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', initGame);
