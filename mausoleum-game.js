// MAUSOLEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
var PLAYER_1 = 1;
var PLAYER_2 = 2;
var EMPTY = 0;
var ROW_LENGTHS = [4, 5, 6, 7, 8, 7, 6, 5, 4];
var TOTAL_ROWS = 9;

window.PLAYER_1 = PLAYER_1;
window.PLAYER_2 = PLAYER_2;
window.EMPTY = EMPTY;
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
var isVsComputer = false;
var playerCount = 2;

window.board = board;
window.currentPlayer = currentPlayer;
window.selectedStone = selectedStone;
window.validMoves = validMoves;
window.gameOver = gameOver;

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {r, c}
let aiConsecutiveMoveCount = 0;

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
    const stoneCounts = { [PLAYER_1]: 0, [PLAYER_2]: 0 };

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const stoneValue = board[r][c];
            if (stoneValue !== EMPTY) {
                stoneCounts[stoneValue]++;
            }
        }
    }

    // Update HUD
    if (p1CountHud) p1CountHud.textContent = stoneCounts[PLAYER_1];
    if (p2CountHud) p2CountHud.textContent = stoneCounts[PLAYER_2];
    
    if (statusName) {
        statusName.textContent = (currentPlayer === PLAYER_1 ? "White's" : "Black's") + " Turn";
    }
    if (statusIndicator) {
        statusIndicator.style.backgroundColor = currentPlayer === PLAYER_1 ? '#ffffff' : '#1a1a1a';
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
    if (isTrapped(r, c)) return;
    const paths = directionMap.get(`${r},${c}`);
    if (!paths) return;

    for (const path of paths) {
        let lastEmpty = null;
        for (const pos of path) {
            if (board[pos.r][pos.c] === EMPTY) {
                lastEmpty = pos;
            } else {
                break; // Blocked
            }
        }
        if (lastEmpty) validMoves.push(lastEmpty);
    }
}

function isTrapped(r, c) {
    const neighbors = getNeighbors(r, c);
    let emptyCount = neighbors.filter(n => board[n.r][n.c] === EMPTY).length;
    return emptyCount <= 1; // Trapped if only 1 or 0 directions to move
}

function onCellClick(r, c) {
    if (gameOver) return;
    const val = board[r][c];

    // 1. Execute move
    if (selectedStone && validMoves.some(m => m.r === r && m.c === c)) {
        moveStone(selectedStone.r, selectedStone.c, r, c);
        return;
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

    selectedStone = null;
    validMoves = [];

    resolveEncirclements();

    if (checkWinCondition()) {
        drawBoard();
        return;
    }

    currentPlayer = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    drawBoard();

    if (!gameOver && isVsComputer && currentPlayer === PLAYER_2) {
        setTimeout(makeAIMove, 600);
    }
}

function resolveEncirclements() {
    let captured = false;
    const toRemove = [];

    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            const val = board[r][c];
            if (val === EMPTY) continue;

            const neighbors = getNeighbors(r, c);
            const occupied = neighbors.filter(n => board[n.r][n.c] !== EMPTY);
            
            if (occupied.length === neighbors.length) { // Fully encircled
                const opponent = val === PLAYER_1 ? PLAYER_2 : PLAYER_1;
                const friendlies = neighbors.filter(n => board[n.r][n.c] === val).length;
                const enemies = neighbors.filter(n => board[n.r][n.c] === opponent).length;
                
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

    toRemove.forEach(p => { board[p.r][p.c] = EMPTY; });
    if (captured) resolveEncirclements(); // Recursive check for chain reactions
}

function checkWinCondition() {
    const counts = { [PLAYER_1]: 0, [PLAYER_2]: 0 };
    board.forEach(row => row.forEach(val => { if(val !== EMPTY) counts[val]++; }));

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

function showEndGameMessage(title, text) {
    gameOver = true;
    if (messageTitle) messageTitle.textContent = title;
    if (messageText) messageText.textContent = text;
    if (messageBox) messageBox.classList.add('visible');
}

function initGame() {
    createBoard();
    buildNeighborMaps();
    currentPlayer = PLAYER_1;
    selectedStone = null;
    validMoves = [];
    gameOver = false;
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
    showMessage("3 & 4 Player Mode: Coming Soon");
});

// ============================================
// AI LOGIC (FOLLOWS THE RULES)
// ============================================

function makeAIMove() {
    if (gameOver || currentPlayer !== PLAYER_2) return;
    
    let possibleActions = [];

    // Find all valid moves for all black stones
    for (let r = 0; r < TOTAL_ROWS; r++) {
        for (let c = 0; c < ROW_LENGTHS[r]; c++) {
            if (board[r][c] === PLAYER_2) {
                calculateValidMoves(r, c);
                validMoves.forEach(move => {
                    possibleActions.push({ from: {r, c}, to: move });
                });
            }
        }
    }
    
    if (possibleActions.length === 0) return;

    // Simple evaluation: try to capture or just move randomly
    shuffle(possibleActions);
    
    // Choose the selected move
    const bestAction = possibleActions[0]; 
    onCellClick(bestAction.from.r, bestAction.from.c); // Select
    setTimeout(() => onCellClick(bestAction.to.r, bestAction.to.c), 400); // Move
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', initGame);
