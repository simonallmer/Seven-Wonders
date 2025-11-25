// PYRAMID GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & PYRAMID STRUCTURE
// ============================================

const LEVELS = [
    { level: 0, size: 7, playableRim: true },  // Level 1: 7x7, only outer rim playable
    { level: 1, size: 5, playableRim: true },  // Level 2: 5x5, only outer rim playable
    { level: 2, size: 3, playableRim: true },  // Level 3: 3x3, only outer rim playable
    { level: 3, size: 1, playableRim: false }  // Level 4: 1x1, victory field
];

// ============================================
// GAME STATE
// ============================================
let pyramid = []; // 4 levels, each is a 2D array
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let lastPushedStone = null;

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

// ============================================
// INITIALIZATION
// ============================================

function initializePyramid() {
    pyramid = [];

    LEVELS.forEach(({ level, size }) => {
        const grid = Array(size).fill(0).map(() =>
            Array(size).fill(0).map(() => ({ piece: null, playable: false, victory: false }))
        );

        // Mark playable cells (outer rim only for levels 0-2, all for level 3)
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (level === 3) {
                    // Top level (1x1): regular playable field
                    grid[r][c].playable = true;
                } else if (level === 2) {
                    // Level 3 (3x3): outer rim is playable, 4 corner fields are victory fields
                    if (r === 0 || r === size - 1 || c === 0 || c === size - 1) {
                        grid[r][c].playable = true;
                        // Mark the 4 corner fields as victory fields
                        if ((r === 0 && c === 0) || (r === 0 && c === 2) ||
                            (r === 2 && c === 0) || (r === 2 && c === 2)) {
                            grid[r][c].victory = true;
                        }
                    }
                } else {
                    // Levels 1 and 2: only outer rim is playable
                    if (r === 0 || r === size - 1 || c === 0 || c === size - 1) {
                        grid[r][c].playable = true;
                    }
                }
            }
        }

        pyramid[level] = grid;
    });

    // Place starting stones
    placeStartingStones();

    currentPlayer = 'white';
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    lastPushedStone = null;

    drawPyramid();
    updateStatus();
    updateCounts();
    hideMessage();
}

function placeStartingStones() {
    // White: bottom row of level 0 (row 6, cols 0-6)
    for (let c = 0; c < 7; c++) {
        pyramid[0][6][c].piece = 'white';
    }

    // Black: top row of level 0 (row 0, cols 0-6)
    for (let c = 0; c < 7; c++) {
        pyramid[0][0][c].piece = 'black';
    }
}

// ============================================
// RENDERING
// ============================================

function drawPyramid() {
    const pyramidBoard = document.getElementById('pyramid-board');
    pyramidBoard.innerHTML = '';

    LEVELS.forEach(({ level, size }) => {
        const levelElement = document.createElement('div');
        levelElement.className = 'pyramid-level';
        levelElement.dataset.level = level;
        levelElement.dataset.size = size;

        const grid = pyramid[level];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.level = level;
                cell.dataset.row = r;
                cell.dataset.col = c;

                const cellData = grid[r][c];

                if (!cellData.playable) {
                    cell.classList.add('inactive');
                } else {
                    if (cellData.victory) {
                        cell.classList.add('victory-field');
                    }

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

                levelElement.appendChild(cell);
            }
        }

        pyramidBoard.appendChild(levelElement);
    });
}

function updateStatus(message = null) {
    playerColorElement.style.backgroundColor = currentPlayer === 'white' ? '#ffffff' : '#1a1a1a';
    playerColorElement.style.borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffffff';

    if (gameState === 'GAME_OVER') return;

    if (message) {
        statusElement.textContent = message;
    } else {
        const playerName = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
        if (gameState === 'SELECT_STONE') {
            statusElement.textContent = `${playerName} to move. Select a stone to move.`;
        } else if (gameState === 'SELECT_MOVE') {
            statusElement.textContent = `${playerName} selected. Choose where to move (green highlights).`;
        }
    }
}

function updateCounts() {
    let whiteCount = 0, blackCount = 0, victoryStones = 0;

    pyramid.forEach((grid, level) => {
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.piece === 'white') {
                    whiteCount++;
                    if (cell.victory) victoryStones++;
                }
                if (cell.piece === 'black') {
                    blackCount++;
                    if (cell.victory) victoryStones++;
                }
            });
        });
    });

    whiteCountElement.textContent = whiteCount;
    blackCountElement.textContent = blackCount;
    topCountElement.textContent = `${victoryStones}/4`;

    // Check win/draw conditions
    if (victoryStones >= 4) {
        // Find which player has stones on victory fields
        let whiteVictory = 0, blackVictory = 0;
        pyramid[2].forEach(row => {
            row.forEach(cell => {
                if (cell.victory && cell.piece === 'white') whiteVictory++;
                if (cell.victory && cell.piece === 'black') blackVictory++;
            });
        });
        const winner = whiteVictory >= 4 ? 'White' : 'Black';
        gameState = 'GAME_OVER';
        showMessage(`${winner} wins by reaching 4 stones on the victory fields!`);
        updateStatus(`Game Over! ${winner} wins!`);
    } else if (whiteCount < 4 && blackCount < 4) {
        gameState = 'GAME_OVER';
        showMessage('Draw! Both players have fewer than 4 stones.');
        updateStatus('Game Over! Draw!');
    } else if (whiteCount < 4) {
        gameState = 'GAME_OVER';
        showMessage('Black wins! White has fewer than 4 stones.');
        updateStatus('Game Over! Black wins!');
    } else if (blackCount < 4) {
        gameState = 'GAME_OVER';
        showMessage('White wins! Black has fewer than 4 stones.');
        updateStatus('Game Over! White wins!');
    }
}

function showMessage(text) {
    messageBox.textContent = text;
    messageBox.classList.remove('hidden');
    clearTimeout(window.messageTimeout);
    window.messageTimeout = setTimeout(hideMessage, 4000);
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

function updateUI() {
    cancelButton.classList.toggle('hidden', !selectedStone);
}

// ============================================
// GAME LOGIC
// ============================================

function isPlayable(level, row, col) {
    if (level < 0 || level >= pyramid.length) return false;
    const grid = pyramid[level];
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return false;
    return grid[row][col].playable;
}

function calculateRunMoves(level, row, col) {
    const moves = [];
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    directions.forEach(({ dr, dc }) => {
        let r = row + dr;
        let c = col + dc;

        // Run on same level only (cannot run to higher levels)
        while (isPlayable(level, r, c) && !pyramid[level][r][c].piece) {
            moves.push({ level, row: r, col: c, type: 'run' });
            r += dr;
            c += dc;
        }
    });

    // Run down to ALL lower levels (can run down through the entire pyramid)
    for (let lowerLevel = level - 1; lowerLevel >= 0; lowerLevel--) {
        // Calculate the offset between current level and lower level
        const offset = (LEVELS[lowerLevel].size - LEVELS[level].size) / 2;
        const targetR = row + offset;
        const targetC = col + offset;

        if (isPlayable(lowerLevel, targetR, targetC)) {
            if (pyramid[lowerLevel][targetR][targetC].piece) {
                // Can smash any stone on any lower level
                moves.push({ level: lowerLevel, row: targetR, col: targetC, type: 'smash' });
            } else {
                // Can also land on empty fields on lower levels
                moves.push({ level: lowerLevel, row: targetR, col: targetC, type: 'run' });
            }
        }
    }

    return moves;
}

function calculateJumpMoves(level, row, col) {
    const moves = [];

    if (level >= 3) return moves; // Can't jump from top level

    const upperLevel = level + 1;
    const upperSize = LEVELS[upperLevel].size;
    const currentSize = LEVELS[level].size;
    const offset = (currentSize - upperSize) / 2;

    // Check all 4 adjacent directions on the same level
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    directions.forEach(({ dr, dc }) => {
        const adjR = row + dr;
        const adjC = col + dc;

        // Calculate corresponding position on upper level
        const upperR = adjR - offset;
        const upperC = adjC - offset;

        // Check if the adjacent position exists on the upper level and is empty
        if (isPlayable(upperLevel, upperR, upperC) && !pyramid[upperLevel][upperR][upperC].piece) {
            moves.push({ level: upperLevel, row: upperR, col: upperC, type: 'jump' });
        }
    });

    return moves;
}

function calculatePushMoves(level, row, col) {
    const moves = [];
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    directions.forEach(({ dr, dc }) => {
        const adjR = row + dr;
        const adjC = col + dc;

        if (isPlayable(level, adjR, adjC) && pyramid[level][adjR][adjC].piece) {
            const pushR = adjR + dr;
            const pushC = adjC + dc;

            // Check if can push on same level
            if (isPlayable(level, pushR, pushC) && !pyramid[level][pushR][pushC].piece) {
                if (!lastPushedStone || lastPushedStone.level !== adjR ||
                    lastPushedStone.row !== adjR || lastPushedStone.col !== adjC) {
                    moves.push({
                        level, row: adjR, col: adjC, type: 'push',
                        pushTo: { level, row: pushR, col: pushC }
                    });
                }
            }

            // Check if pushed stone falls off corner (level 0 only)
            if (level === 0 && !isPlayable(level, pushR, pushC)) {
                moves.push({
                    level, row: adjR, col: adjC, type: 'push-fall',
                    pushTo: null
                });
            }
        }
    });

    return moves;
}

function handleCellClick(level, row, col) {
    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.");
        return;
    }

    const cellData = pyramid[level][row][col];

    if (gameState === 'SELECT_STONE') {
        if (cellData.piece === currentPlayer) {
            selectedStone = { level, row, col };
            const runMoves = calculateRunMoves(level, row, col);
            const jumpMoves = calculateJumpMoves(level, row, col);
            const pushMoves = calculatePushMoves(level, row, col);
            validMoves = [...runMoves, ...jumpMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves.");
                selectedStone = null;
                return;
            }

            gameState = 'SELECT_MOVE';
            drawPyramid();
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
            const runMoves = calculateRunMoves(level, row, col);
            const jumpMoves = calculateJumpMoves(level, row, col);
            const pushMoves = calculatePushMoves(level, row, col);
            validMoves = [...runMoves, ...jumpMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves.");
                selectedStone = null;
                gameState = 'SELECT_STONE';
            }

            drawPyramid();
            updateStatus();
        }
    }
}

function executeMove(move) {
    const fromPiece = pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece;

    if (move.type === 'run' || move.type === 'jump') {
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        lastPushedStone = null;
    } else if (move.type === 'smash') {
        const smashedPiece = pyramid[move.level][move.row][move.col].piece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        showMessage(`${fromPiece} smashed ${smashedPiece}!`);
        lastPushedStone = null;
    } else if (move.type === 'push') {
        const pushedPiece = pyramid[move.level][move.row][move.col].piece;
        pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece = pushedPiece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        lastPushedStone = { level: move.pushTo.level, row: move.pushTo.row, col: move.pushTo.col };
    } else if (move.type === 'push-fall') {
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        showMessage(`Stone pushed off the pyramid!`);
        lastPushedStone = null;
    }

    // Check for Osiris
    checkAndRemoveOsiris();

    endTurn();
}

function checkAndRemoveOsiris() {
    // Check each level for Osiris (surrounded stones in a line)
    pyramid.forEach((grid, level) => {
        // Check horizontal and vertical lines
        // This is simplified - full implementation would check all line patterns
    });
}

function cancelMove() {
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    drawPyramid();
    updateStatus();
    updateUI();
}

function endTurn() {
    selectedStone = null;
    validMoves = [];
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gameState = 'SELECT_STONE';
    drawPyramid();
    updateStatus();
    updateCounts();
    updateUI();
}

// ============================================
// EVENT LISTENERS
// ============================================

resetButton.addEventListener('click', initializePyramid);
cancelButton.addEventListener('click', cancelMove);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', initializePyramid);
