// CITADELL GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & CITADELL STRUCTURE
// ============================================

const LEVELS = [
    { level: 0, rows: 9, cols: 7 }, // Base (was 7, now 9 to accommodate top expansion)
    { level: 1, rows: 7, cols: 7 }, // (was 5, now 7)
    { level: 2, rows: 5, cols: 7 }, // (was 3, now 5)
    { level: 3, rows: 3, cols: 7 }  // Top (was 1, now 3)
];

// ============================================
// GAME STATE
// ============================================
let citadell = []; // 4 levels
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let lastPush = null; // reused for history/undo logic if needed

// ============================================
// DOM ELEMENTS
// ============================================
const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const whiteCountElement = document.getElementById('white-count');
const blackCountElement = document.getElementById('black-count');
const topCountElement = document.getElementById('top-count');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const cancelButton = document.getElementById('cancel-button');
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');

// ============================================
// INITIALIZATION
// ============================================

function initializeCitadell() {
    citadell = [];

    LEVELS.forEach(({ level, rows, cols }) => {
        const grid = Array(rows).fill(0).map(() =>
            Array(cols).fill(0).map(() => ({ piece: null, playable: false, victory: false }))
        );

        // Mark playable cells (Exposed Steps)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Top Level is fully playable
                if (level === 3) {
                    grid[r][c].playable = true;
                    grid[r][c].victory = true; // All top fields are victory fields
                }
                // Lower Levels: Only Top (0) and Bottom (rows-1) rows are exposed
                else {
                    if (r === 0 || r === rows - 1) {
                        grid[r][c].playable = true;
                    }
                }
            }
        }

        citadell[level] = grid;
    });

    placeStartingStones();

    currentPlayer = 'white';
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';

    drawCitadell();
    updateStatus();
    updateCounts();
    hideMessage();
    hideGameOverModal();
}

function placeStartingStones() {
    // White: Level 0, Bottom Row (Row 8)
    // Black: Level 0, Top Row (Row 0)
    for (let c = 0; c < 7; c++) {
        citadell[0][8][c].piece = 'white';
        citadell[0][0][c].piece = 'black';
    }
}

// ============================================
// HELPERS: COORDINATE MAPPING
// ============================================

const MAX_ROWS = 9;

function getGlobalRow(level, localRow) {
    const rows = LEVELS[level].rows;
    const offset = (MAX_ROWS - rows) / 2;
    return localRow + offset;
}

function getLocalRow(level, globalRow) {
    const rows = LEVELS[level].rows;
    const offset = (MAX_ROWS - rows) / 2;
    return globalRow - offset;
}

function isValidPosition(level, r, c) {
    if (level < 0 || level >= LEVELS.length) return false;
    const rows = LEVELS[level].rows;
    const cols = LEVELS[level].cols;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    return citadell[level][r][c].playable;
}

// ============================================
// MOVEMENT LOGIC
// ============================================

function calculateMoves(level, row, col) {
    const moves = [];
    const myPiece = citadell[level][row][col].piece;
    const globalRow = getGlobalRow(level, row);

    // 1. Run Left/Right (Same Level)
    const sideDirs = [{ dc: -1 }, { dc: 1 }];
    sideDirs.forEach(({ dc }) => {
        let c = col;
        while (true) {
            let nextC = c + dc;
            if (!isValidPosition(level, row, nextC)) break;

            if (!citadell[level][row][nextC].piece) {
                moves.push({ level, row, col: nextC, type: 'run' });
                c = nextC; // Continue running
            } else {
                // Blocked by piece
                break;
            }
        }
    });

    // 2. Step Up (Level + 1)
    if (level < 3) {
        let targetGlobalRow;
        // Determine direction towards center (Row 4)
        if (globalRow < 4) targetGlobalRow = globalRow + 1;
        else if (globalRow > 4) targetGlobalRow = globalRow - 1;
        else targetGlobalRow = 4; // Should not happen if strictly stepping up from lower levels which are outside 3-5 range?
        // Wait, L2 covers 2-6. L3 covers 3-5.
        // If on L2 G3 (inside L3?), wait.
        // L2 (5 rows) is G2..G6.
        // L3 (3 rows) is G3..G5.
        // Exposed L2 are G2 and G6.
        // From G2 ( < 4 ) -> Step Up -> G3.
        // From G6 ( > 4 ) -> Step Up -> G5.
        // G3 and G5 are valid spots on L3.
        // So logic `globalRow < 4` works.

        const nextLevel = level + 1;
        const nextLocalRow = getLocalRow(nextLevel, targetGlobalRow);

        // Same column
        if (isValidPosition(nextLevel, nextLocalRow, col)) {
            if (!citadell[nextLevel][nextLocalRow][col].piece) {
                moves.push({ level: nextLevel, row: nextLocalRow, col, type: 'step-up' });
            }
        }
    }

    // 3. Step Down (Level - 1)
    if (level > 0) {
        let targetGlobalRow;
        // Determine direction away from center
        // Center is 4.
        // Top Level L3 is G3, G4, G5.
        // From G3 -> Step Down -> G2.
        // From G5 -> Step Down -> G6.
        // From G4 -> Cannot step down (middle of platform).

        if (globalRow === 4) {
            // Center of top platform. Cannot step down directly to sides?
            // Unless "sides" implies G3/G5? No that's Run.
            // So from G4, no Step Down.
            // Implicitly handled: target would be 3 or 5?
            // No, standard logic:
            targetGlobalRow = null;
        } else if (globalRow < 4) {
            targetGlobalRow = globalRow - 1;
        } else { // globalRow > 4
            targetGlobalRow = globalRow + 1;
        }

        if (targetGlobalRow !== null && targetGlobalRow !== undefined) {
            const nextLevel = level - 1;
            const nextLocalRow = getLocalRow(nextLevel, targetGlobalRow);

            if (isValidPosition(nextLevel, nextLocalRow, col)) {
                if (!citadell[nextLevel][nextLocalRow][col].piece) {
                    moves.push({ level: nextLevel, row: nextLocalRow, col, type: 'step-down' });
                } else {
                    // Smash/Capture on step down
                    moves.push({ level: nextLevel, row: nextLocalRow, col, type: 'smash' });
                }
            }
        }
    }

    return moves;
}

function handleCellClick(level, row, col) {
    if (gameState === 'GAME_OVER') return;

    const cellData = citadell[level][row][col];

    if (gameState === 'SELECT_STONE') {
        if (cellData.piece === currentPlayer) {
            selectedStone = { level, row, col };
            validMoves = calculateMoves(level, row, col);

            if (validMoves.length === 0) {
                showMessage("No valid moves.");
                selectedStone = null;
                return;
            }

            gameState = 'SELECT_MOVE';
            drawCitadell();
            updateStatus();
            updateUI();
        }
    } else if (gameState === 'SELECT_MOVE') {
        const move = validMoves.find(m => m.level === level && m.row === row && m.col === col);
        if (move) {
            executeMove(move);
        } else if (cellData.piece === currentPlayer) {
            // Reselect
            selectedStone = { level, row, col };
            validMoves = calculateMoves(level, row, col);
            gameState = 'SELECT_MOVE';
            drawCitadell();
            updateStatus();
            updateUI();
        } else {
            // Cancel
            cancelMove();
        }
    }
}

function executeMove(move) {
    const fromPiece = citadell[selectedStone.level][selectedStone.row][selectedStone.col].piece;
    const targetCell = citadell[move.level][move.row][move.col];

    // Clear origin
    citadell[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;

    // Handle smash
    if (targetCell.piece) {
        showMessage(`${fromPiece} smashed ${targetCell.piece}!`);
    }

    // Place piece
    targetCell.piece = fromPiece;

    endTurn();
}

// ============================================
// RENDERING & UI
// ============================================

function drawCitadell() {
    const board = document.getElementById('citadell-board');
    board.innerHTML = '';

    LEVELS.forEach(({ level, rows, cols }) => {
        const levelEl = document.createElement('div');
        levelEl.className = 'citadell-level';
        levelEl.dataset.level = level;

        // CSS Grid setup is in CSS, but we need to populate cells
        const grid = citadell[level];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellData = grid[r][c];

                if (!cellData.playable) {
                    cell.classList.add('inactive');
                } else {
                    if (cellData.victory) cell.classList.add('victory-field');

                    if (validMoves.some(m => m.level === level && m.row === r && m.col === c)) {
                        cell.classList.add('valid-move');
                    }

                    if (cellData.piece) {
                        const stone = document.createElement('div');
                        stone.classList.add('stone', cellData.piece);
                        if (selectedStone && selectedStone.level === level &&
                            selectedStone.row === r && selectedStone.col === c) {
                            stone.classList.add('selected');
                        }
                        cell.appendChild(stone);
                    }

                    cell.addEventListener('click', () => handleCellClick(level, r, c));
                }
                levelEl.appendChild(cell);
            }
        }
        board.appendChild(levelEl);
    });
}

function updateStatus(msg) {
    if (msg) statusElement.textContent = msg;
    else {
        const player = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
        statusElement.textContent = `${player} to move.`;
    }
    playerColorElement.style.backgroundColor = currentPlayer === 'white' ? '#fff' : '#1a1a1a';
}

function updateCounts() {
    let white = 0, black = 0, whiteTop = 0, blackTop = 0;

    // Count all stones and top stones
    citadell.forEach((grid, lvl) => {
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.piece === 'white') {
                    white++;
                    if (cell.victory) whiteTop++;
                }
                if (cell.piece === 'black') {
                    black++;
                    if (cell.victory) blackTop++;
                }
            });
        });
    });

    whiteCountElement.textContent = white;
    blackCountElement.textContent = black;
    topCountElement.textContent = `${whiteTop + blackTop}/7`;

    // Victory Check: First to 4 on top?
    if (whiteTop >= 4) gameOver('White Wins!', 'White occupies the majority of the Citadell!');
    else if (blackTop >= 4) gameOver('Black Wins!', 'Black occupies the majority of the Citadell!');
    else if (white === 0) gameOver('Black Wins!', 'White has no stones left.');
    else if (black === 0) gameOver('White Wins!', 'Black has no stones left.');
}

function gameOver(title, text) {
    gameState = 'GAME_OVER';
    updateStatus('Game Over');
    modalTitle.textContent = title;
    modalText.textContent = text;
    gameOverModal.classList.remove('hidden');
}

function hideGameOverModal() { gameOverModal.classList.add('hidden'); }
function showMessage(text) {
    messageBox.textContent = text;
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 3000);
}

function cancelMove() {
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    drawCitadell();
    updateStatus();
    updateUI();
}

function endTurn() {
    selectedStone = null;
    validMoves = [];
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gameState = 'SELECT_STONE';
    drawCitadell();
    updateCounts();
    updateStatus();
    updateUI();
}

function updateUI() {
    cancelButton.classList.toggle('hidden', !selectedStone);
}

resetButton.addEventListener('click', initializeCitadell);
cancelButton.addEventListener('click', cancelMove);

document.addEventListener('DOMContentLoaded', initializeCitadell);
