// COLOSSUS GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const BOARD_SIZE = 11; // 11x11 grid for cross shape
const CORE_SIZE = 9; // 9x9 core area

// Direction field positions (row, col, direction)
// Arrows point in the direction stones will slide
const DIRECTION_FIELDS = [
    { row: 0, col: 5, dir: 'up' },      // Top - arrow points up
    { row: 10, col: 5, dir: 'down' },   // Bottom - arrow points down
    { row: 5, col: 0, dir: 'left' },    // Left - arrow points left
    { row: 5, col: 10, dir: 'right' }   // Right - arrow points right
];

// ============================================
// GAME STATE
// ============================================
let board = [];
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let lastPushedStone = null; // Prevents immediate push-back

// ============================================
// DOM ELEMENTS
// ============================================
const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const whiteCountElement = document.getElementById('white-count');
const blackCountElement = document.getElementById('black-count');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const cancelButton = document.getElementById('cancel-button');

// ============================================
// BOARD INITIALIZATION
// ============================================

function initializeBoard() {
    board = Array(BOARD_SIZE).fill(0).map(() =>
        Array(BOARD_SIZE).fill(0).map(() => ({ piece: null, isActive: false, directionField: null }))
    );

    // Mark active cells (cross shape)
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Center 9x9 core is always active
            if (r >= 1 && r <= 9 && c >= 1 && c <= 9) {
                board[r][c].isActive = true;
            }
            // Top extension (row 0, cols 4-6) - only 1 field on each side of direction field
            if (r === 0 && c >= 4 && c <= 6) {
                board[r][c].isActive = true;
            }
            // Bottom extension (row 10, cols 4-6)
            if (r === 10 && c >= 4 && c <= 6) {
                board[r][c].isActive = true;
            }
            // Left extension (col 0, rows 4-6)
            if (c === 0 && r >= 4 && r <= 6) {
                board[r][c].isActive = true;
            }
            // Right extension (col 10, rows 4-6)
            if (c === 10 && r >= 4 && r <= 6) {
                board[r][c].isActive = true;
            }
        }
    }

    // Set direction fields
    DIRECTION_FIELDS.forEach(({ row, col, dir }) => {
        board[row][col].directionField = dir;
    });

    // Place starting stones
    placeStartingStones();

    currentPlayer = 'white';
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    lastPushedStone = null;

    drawBoard();
    updateStatus();
    updateStoneCounts();
    hideMessage();
}

function placeStartingStones() {
    // Black stones (top-left)
    board[1][1].piece = 'black';
    board[1][2].piece = 'black';
    board[1][3].piece = 'black';
    board[2][1].piece = 'black';
    board[2][2].piece = 'black';
    board[3][1].piece = 'black';

    // White stones (top-right)
    board[1][7].piece = 'white';
    board[1][8].piece = 'white';
    board[1][9].piece = 'white';
    board[2][8].piece = 'white';
    board[2][9].piece = 'white';
    board[3][9].piece = 'white';

    // White stones (bottom-left)
    board[7][1].piece = 'white';
    board[8][1].piece = 'white';
    board[8][2].piece = 'white';
    board[9][1].piece = 'white';
    board[9][2].piece = 'white';
    board[9][3].piece = 'white';

    // Black stones (bottom-right)
    board[7][9].piece = 'black';
    board[8][8].piece = 'black';
    board[8][9].piece = 'black';
    board[9][7].piece = 'black';
    board[9][8].piece = 'black';
    board[9][9].piece = 'black';
}

// ============================================
// RENDERING
// ============================================

function drawBoard() {
    boardElement.innerHTML = '';

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            const cellData = board[r][c];

            if (!cellData.isActive) {
                cell.classList.add('inactive');
            } else {
                if (cellData.directionField) {
                    cell.classList.add('direction-field', `direction-${cellData.directionField}`);
                }

                if (validMoves.some(m => m.row === r && m.col === c)) {
                    cell.classList.add('valid-move');
                }

                if (cellData.piece) {
                    const stone = document.createElement('div');
                    stone.classList.add('stone', cellData.piece);

                    if (selectedStone && selectedStone.row === r && selectedStone.col === c) {
                        stone.classList.add('selected');
                    }

                    cell.appendChild(stone);
                }

                cell.addEventListener('click', () => handleCellClick(r, c));
            }

            boardElement.appendChild(cell);
        }
    }
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

function updateStoneCounts() {
    let whiteCount = 0;
    let blackCount = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece === 'white') whiteCount++;
            if (board[r][c].piece === 'black') blackCount++;
        }
    }

    whiteCountElement.textContent = whiteCount;
    blackCountElement.textContent = blackCount;

    // Check win condition
    if (whiteCount < 4) {
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
    if (selectedStone) {
        cancelButton.classList.remove('hidden');
    } else {
        cancelButton.classList.add('hidden');
    }
}

// ============================================
// GAME LOGIC
// ============================================

function isInBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c].isActive;
}

function getForwardDirection(player) {
    // White moves upward (decreasing row), Black moves downward (increasing row)
    return player === 'white' ? -1 : 1;
}

function calculateRunMoves(row, col) {
    const moves = [];

    // Can run in all 4 directions
    const directions = [
        { dr: -1, dc: 0 },  // Up
        { dr: 1, dc: 0 },   // Down
        { dr: 0, dc: -1 },  // Left
        { dr: 0, dc: 1 }    // Right
    ];

    directions.forEach(({ dr, dc }) => {
        let r = row + dr;
        let c = col + dc;

        while (isInBounds(r, c) && !board[r][c].piece) {
            moves.push({ row: r, col: c, type: 'run' });
            r += dr;
            c += dc;
        }
    });

    return moves;
}

function calculatePushMoves(row, col) {
    const moves = [];

    // Check all 4 adjacent cells
    const directions = [
        { dr: -1, dc: 0 },  // Up
        { dr: 1, dc: 0 },   // Down
        { dr: 0, dc: -1 },  // Left
        { dr: 0, dc: 1 }    // Right
    ];

    directions.forEach(({ dr, dc }) => {
        const adjR = row + dr;
        const adjC = col + dc;

        // Must have a stone to push
        if (isInBounds(adjR, adjC) && board[adjR][adjC].piece) {
            // Check if we can push it (space beyond must be empty)
            const pushR = adjR + dr;
            const pushC = adjC + dc;

            if (isInBounds(pushR, pushC) && !board[pushR][pushC].piece) {
                // Check if this stone was just pushed (prevent immediate push-back)
                if (!lastPushedStone || lastPushedStone.row !== adjR || lastPushedStone.col !== adjC) {
                    moves.push({
                        row: adjR,
                        col: adjC,
                        type: 'push',
                        pushTo: { row: pushR, col: pushC }
                    });
                }
            }
        }
    });

    return moves;
}

function handleCellClick(row, col) {
    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.");
        return;
    }

    const cellData = board[row][col];

    if (gameState === 'SELECT_STONE') {
        if (cellData.piece === currentPlayer) {
            selectedStone = { row, col };
            const runMoves = calculateRunMoves(row, col);
            const pushMoves = calculatePushMoves(row, col);
            validMoves = [...runMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves. Select another stone.");
                selectedStone = null;
                return;
            }

            gameState = 'SELECT_MOVE';
            drawBoard();
            updateStatus();
            updateUI();
        }
    } else if (gameState === 'SELECT_MOVE') {
        const move = validMoves.find(m => m.row === row && m.col === col);

        if (move) {
            executeMove(move);
        } else if (cellData.piece === currentPlayer) {
            // Reselect different stone
            selectedStone = { row, col };
            const runMoves = calculateRunMoves(row, col);
            const pushMoves = calculatePushMoves(row, col);
            validMoves = [...runMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves. Select another stone.");
                selectedStone = null;
                gameState = 'SELECT_STONE';
            }

            drawBoard();
            updateStatus();
        }
    }
}

function executeMove(move) {
    if (move.type === 'run') {
        // Simple run movement
        board[move.row][move.col].piece = board[selectedStone.row][selectedStone.col].piece;
        board[selectedStone.row][selectedStone.col].piece = null;
        lastPushedStone = null;

        // Check for direction field activation
        if (board[move.row][move.col].directionField) {
            handleTilt(board[move.row][move.col].directionField);
        }
    } else if (move.type === 'push') {
        // Push movement
        const pushedPiece = board[move.row][move.col].piece;

        // Move pushed stone
        board[move.pushTo.row][move.pushTo.col].piece = pushedPiece;

        // Move pushing stone
        board[move.row][move.col].piece = board[selectedStone.row][selectedStone.col].piece;
        board[selectedStone.row][selectedStone.col].piece = null;

        // Record pushed stone to prevent immediate push-back
        lastPushedStone = { row: move.pushTo.row, col: move.pushTo.col };

        // Check for direction field activation on pushed stone
        if (board[move.pushTo.row][move.pushTo.col].directionField) {
            handleTilt(board[move.pushTo.row][move.pushTo.col].directionField);
        }
    }

    // Check for Hades after movement
    checkAndRemoveHades();

    // End turn
    endTurn();
}

function handleTilt(direction) {
    const activatedFields = [direction];
    processTilts(activatedFields);
}

function processTilts(activatedDirections) {
    // Check for opposite directions (they cancel out)
    const hasUp = activatedDirections.includes('up');
    const hasDown = activatedDirections.includes('down');
    const hasLeft = activatedDirections.includes('left');
    const hasRight = activatedDirections.includes('right');

    if ((hasUp && hasDown) || (hasLeft && hasRight)) {
        showMessage("Opposite direction fields activated - no tilt occurs!");
        return;
    }

    // Process each unique direction
    const uniqueDirections = [...new Set(activatedDirections)];

    uniqueDirections.forEach(dir => {
        tiltBoard(dir);
        checkAndRemoveHades();
    });
}

function tiltBoard(direction) {
    const newActivations = [];

    // Determine slide direction - stones slide in the direction the arrow points
    let dr = 0, dc = 0;
    if (direction === 'up') dr = -1;      // Arrow points up - slide upward
    if (direction === 'down') dr = 1;     // Arrow points down - slide downward
    if (direction === 'left') dc = -1;    // Arrow points left - slide left
    if (direction === 'right') dc = 1;    // Arrow points right - slide right

    // Slide all stones in the direction
    let moved = true;
    while (moved) {
        moved = false;

        // Iterate in the direction of gravity
        const startR = dr < 0 ? 0 : (dr > 0 ? BOARD_SIZE - 1 : 0);
        const endR = dr < 0 ? BOARD_SIZE : (dr > 0 ? -1 : BOARD_SIZE);
        const stepR = dr < 0 ? 1 : (dr > 0 ? -1 : 1);

        const startC = dc < 0 ? 0 : (dc > 0 ? BOARD_SIZE - 1 : 0);
        const endC = dc < 0 ? BOARD_SIZE : (dc > 0 ? -1 : BOARD_SIZE);
        const stepC = dc < 0 ? 1 : (dc > 0 ? -1 : 1);

        for (let r = startR; r !== endR; r += stepR) {
            for (let c = startC; c !== endC; c += stepC) {
                if (board[r][c].piece) {
                    const newR = r + dr;
                    const newC = c + dc;

                    if (isInBounds(newR, newC) && !board[newR][newC].piece) {
                        board[newR][newC].piece = board[r][c].piece;
                        board[r][c].piece = null;
                        moved = true;

                        // Check if landed on direction field
                        if (board[newR][newC].directionField) {
                            newActivations.push(board[newR][newC].directionField);
                        }
                    }
                }
            }
        }
    }

    // Process cascading tilts
    if (newActivations.length > 0) {
        processTilts(newActivations);
    }
}

function checkAndRemoveHades() {
    const toRemove = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece && isEncircled(r, c)) {
                toRemove.push({ row: r, col: c });
            }
        }
    }

    if (toRemove.length > 0) {
        toRemove.forEach(({ row, col }) => {
            board[row][col].piece = null;
        });
        showMessage(`Hades formed! ${toRemove.length} stone(s) removed.`);
        updateStoneCounts();
    }
}

function isEncircled(row, col) {
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    for (const { dr, dc } of directions) {
        const adjR = row + dr;
        const adjC = col + dc;

        // If adjacent cell is out of bounds or inactive, not encircled
        if (!isInBounds(adjR, adjC)) {
            return false;
        }

        // If adjacent cell is empty, not encircled
        if (!board[adjR][adjC].piece) {
            return false;
        }
    }

    return true;
}

function cancelMove() {
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    drawBoard();
    updateStatus();
    updateUI();
}

function endTurn() {
    selectedStone = null;
    validMoves = [];
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gameState = 'SELECT_STONE';
    drawBoard();
    updateStatus();
    updateStoneCounts();
    updateUI();
}

// ============================================
// EVENT LISTENERS
// ============================================

resetButton.addEventListener('click', initializeBoard);
cancelButton.addEventListener('click', cancelMove);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', initializeBoard);
