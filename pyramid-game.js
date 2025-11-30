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
let lastPush = null;

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
    lastPush = null;

    drawPyramid();
    updateStatus();
    updateCounts();
    updateCounts();
    hideMessage();
    hideGameOverModal();
}

function showGameOverModal(title, text) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    gameOverModal.classList.remove('hidden');
    // Trigger reflow to enable transition
    void gameOverModal.offsetWidth;
    gameOverModal.classList.add('visible');
}

function hideGameOverModal() {
    gameOverModal.classList.remove('visible');
    setTimeout(() => {
        gameOverModal.classList.add('hidden');
    }, 300);
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
    // Check win/draw conditions

    // Find which player has stones on victory fields
    let whiteVictory = 0, blackVictory = 0;
    pyramid[2].forEach(row => {
        row.forEach(cell => {
            if (cell.victory && cell.piece === 'white') whiteVictory++;
            if (cell.victory && cell.piece === 'black') blackVictory++;
        });
    });

    if (whiteVictory >= 4) {
        gameState = 'GAME_OVER';
        updateStatus(`Game Over! White wins!`);
        showGameOverModal('White Wins!', 'White wins by occupying all 4 victory fields!');
    } else if (blackVictory >= 4) {
        gameState = 'GAME_OVER';
        updateStatus(`Game Over! Black wins!`);
        showGameOverModal('Black Wins!', 'Black wins by occupying all 4 victory fields!');
    } else if (whiteCount < 4 && blackCount < 4) {
        gameState = 'GAME_OVER';
        updateStatus('Game Over! Draw!');
        showGameOverModal('Draw!', 'Both players have fewer than 4 stones.');
    } else if (whiteCount < 4) {
        gameState = 'GAME_OVER';
        updateStatus('Game Over! Black wins!');
        showGameOverModal('Black Wins!', 'Black wins! White has fewer than 4 stones.');
    } else if (blackCount < 4) {
        gameState = 'GAME_OVER';
        updateStatus('Game Over! White wins!');
        showGameOverModal('White Wins!', 'White wins! Black has fewer than 4 stones.');
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
        let currentLevel = level;
        let r = row;
        let c = col;

        while (true) {
            // Calculate next position in current direction
            let nextR = r + dr;
            let nextC = c + dc;
            let nextLevel = currentLevel;

            // Check if next position is off the current level
            if (!isPlayable(currentLevel, nextR, nextC)) {
                // Try to step down
                if (currentLevel > 0) {
                    nextLevel = currentLevel - 1;
                    // Let's use this robust mapping.
                    const currentOffset = (7 - LEVELS[currentLevel].size) / 2;
                    const nextOffset = (7 - LEVELS[nextLevel].size) / 2;

                    const globalR = r + currentOffset;
                    const globalC = c + currentOffset;
                    const targetGlobalR = globalR + dr;
                    const targetGlobalC = globalC + dc;

                    nextR = targetGlobalR - nextOffset;
                    nextC = targetGlobalC - nextOffset;
                } else {
                    // Cannot go lower than level 0
                    break;
                }
            }

            // Check if the new position is valid and playable
            if (isPlayable(nextLevel, nextR, nextC)) {
                if (pyramid[nextLevel][nextR][nextC].piece) {
                    // Smash!
                    // Only allow smash if we dropped a level. If same level, it's a blocker.
                    if (nextLevel < currentLevel) {
                        moves.push({ level: nextLevel, row: nextR, col: nextC, type: 'smash' });
                    }
                    break; // Stop after smash or block
                } else {
                    // Empty space, continue run
                    moves.push({ level: nextLevel, row: nextR, col: nextC, type: 'run' });
                    // Update current position for next iteration
                    currentLevel = nextLevel;
                    r = nextR;
                    c = nextC;
                }
            } else {
                // Not playable (e.g. corner of level 2 which is not playable, or off board of level 0)
                break;
            }
        }
    });

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

        // Check if there is a stone to push at (adjR, adjC)
        if (isPlayable(level, adjR, adjC) && pyramid[level][adjR][adjC].piece) {
            const pushR = adjR + dr;
            const pushC = adjC + dc;

            // 1. Try to push on the SAME level
            if (isPlayable(level, pushR, pushC)) {
                if (!pyramid[level][pushR][pushC].piece) {
                    // Prevent pushing back:
                    // If I am the stone that was just pushed (lastPush.pushed)
                    // AND I am trying to push the stone that pushed me (lastPush.pusher)
                    // THEN forbid.
                    let isPushBack = false;
                    if (lastPush) {
                        const amIThePushedOne = (level === lastPush.pushed.level && row === lastPush.pushed.row && col === lastPush.pushed.col);
                        const isTargetThePusher = (level === lastPush.pusher.level && adjR === lastPush.pusher.row && adjC === lastPush.pusher.col);
                        if (amIThePushedOne && isTargetThePusher) {
                            isPushBack = true;
                        }
                    }

                    if (!isPushBack) {
                        moves.push({
                            level, row: adjR, col: adjC, type: 'push',
                            pushTo: { level, row: pushR, col: pushC }
                        });
                    }
                }
            }
            // 2. If not playable on same level, check if it's a push to a LOWER level (or fall off Level 0)
            else {
                if (level > 0) {
                    // Push down to lower level
                    const lowerLevel = level - 1;
                    const offset = (LEVELS[lowerLevel].size - LEVELS[level].size) / 2;
                    const lowerPushR = pushR + offset;
                    const lowerPushC = pushC + offset;

                    // Only allow push if the target on lower level is playable
                    if (isPlayable(lowerLevel, lowerPushR, lowerPushC)) {
                        moves.push({
                            level, row: adjR, col: adjC, type: 'push',
                            pushTo: { level: lowerLevel, row: lowerPushR, col: lowerPushC }
                        });
                    }
                } else {
                    // Level 0: Push off the board (FALL)
                    moves.push({
                        level, row: adjR, col: adjC, type: 'push-fall',
                        pushTo: null
                    });
                }
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
        lastPush = null;
    } else if (move.type === 'smash') {
        const smashedPiece = pyramid[move.level][move.row][move.col].piece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        showMessage(`${fromPiece} smashed ${smashedPiece}!`);
        lastPush = null;
    } else if (move.type === 'push') {
        const pushedPiece = pyramid[move.level][move.row][move.col].piece;

        // Check if destination has a piece (Smash)
        const targetPiece = pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece;

        pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece = pushedPiece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;

        // Track the push event
        lastPush = {
            pusher: { level: move.level, row: move.row, col: move.col }, // Where the pusher ended up
            pushed: { level: move.pushTo.level, row: move.pushTo.row, col: move.pushTo.col } // Where the pushed stone ended up
        };

        if (move.pushTo.level < move.level) {
            if (targetPiece) {
                showMessage(`DROP and SMASH! Stone dropped to level ${move.pushTo.level} and smashed ${targetPiece}!`);
            } else {
                showMessage(`DROP! Stone dropped to level ${move.pushTo.level}.`);
            }
        }
    } else if (move.type === 'push-fall') {
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        showMessage(`FALL! Stone pushed off the pyramid!`);
        lastPush = null;
    }

    // Check for Osiris
    checkAndRemoveOsiris();

    endTurn();
}

function checkAndRemoveOsiris() {
    const opponent = currentPlayer === 'white' ? 'black' : 'white';
    let stonesToRemove = [];

    // Iterate through each level independently
    LEVELS.forEach(({ level, size }) => {
        const grid = pyramid[level];
        const gridMap = [];

        // Create a map for the current level
        for (let r = 0; r < size; r++) {
            const rowMap = [];
            for (let c = 0; c < size; c++) {
                if (grid[r][c].piece) {
                    rowMap.push({ level, row: r, col: c });
                } else {
                    rowMap.push(null);
                }
            }
            gridMap.push(rowMap);
        }

        // Check Rows
        for (let r = 0; r < size; r++) {
            const rowPieces = grid[r].map(cell => cell.piece);
            // Active Capture
            stonesToRemove.push(...checkLine(rowPieces, gridMap[r], currentPlayer, opponent));
            // Passive Capture
            stonesToRemove.push(...checkLine(rowPieces, gridMap[r], opponent, currentPlayer));
        }

        // Check Cols
        for (let c = 0; c < size; c++) {
            const colPieces = [];
            const colMap = [];
            for (let r = 0; r < size; r++) {
                colPieces.push(grid[r][c].piece);
                colMap.push(gridMap[r][c]);
            }
            // Active Capture
            stonesToRemove.push(...checkLine(colPieces, colMap, currentPlayer, opponent));
            // Passive Capture
            stonesToRemove.push(...checkLine(colPieces, colMap, opponent, currentPlayer));
        }
    });

    if (stonesToRemove.length > 0) {
        // Remove duplicates (in case a stone is captured both horizontally and vertically)
        const uniqueStones = [];
        const seen = new Set();
        stonesToRemove.forEach(s => {
            const key = `${s.level},${s.row},${s.col}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueStones.push(s);
            }
        });

        uniqueStones.forEach(({ level, row, col }) => {
            const piece = pyramid[level][row][col].piece;
            pyramid[level][row][col].piece = null;
            // Optional: Visual effect or message
        });

        showMessage(`Osiris! ${uniqueStones.length} stones captured!`);
    }
}

function checkLine(line, map, player, opponent) {
    const captured = [];
    // Pattern: Player - Opponent(s) - Player
    // Find all indices of Player
    const playerIndices = [];
    line.forEach((p, i) => {
        if (p === player) playerIndices.push(i);
    });

    for (let i = 0; i < playerIndices.length - 1; i++) {
        const start = playerIndices[i];
        const end = playerIndices[i + 1];

        // Check if everything between start and end is Opponent
        if (end > start + 1) { // Must have at least one stone in between
            let allOpponent = true;
            for (let k = start + 1; k < end; k++) {
                if (line[k] !== opponent) {
                    allOpponent = false;
                    break;
                }
            }

            if (allOpponent) {
                for (let k = start + 1; k < end; k++) {
                    captured.push(map[k]);
                }
            }
        }
    }
    return captured;
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
