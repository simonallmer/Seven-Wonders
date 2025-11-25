// PHAROS GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
const BOARD_SIZE = 9;

// ============================================
// GAME STATE
// ============================================
let board = [];
let currentPlayer = 'white';
// States: SELECT_MOVE_STONE, SELECT_LIGHT_SOURCE, SELECT_TARGET_CELL, GAME_OVER
let gameState = 'SELECT_MOVE_STONE';

// The piece currently being moved {r, c}
let moveSource = null;
// The original location of the piece at the start of the turn
let startMoveSource = null;

// Array to track the moves made this turn
let moveHistory = [];

// Potential move options based on the current step in the move chain
let potentialLightSources = [];
let potentialMoveTargets = [];

// Tracks cumulative light uses for each position during the current turn
let lightSourceUsage = {};
// Tracks lit beacon ownership: Key: "r,c", Value: 'white' or 'black'
let litBeacons = {};

// ============================================
// DOM ELEMENTS
// ============================================
const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const endTurnButton = document.getElementById('end-turn-button');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if a cell is one of the designated beacon fields.
 */
function isBeaconField(r, c) {
    // Center Beacon (4, 4)
    if (r === 4 && c === 4) return true;

    // Corner Beacons (0, 0), (0, 8), (8, 0), (8, 8)
    const isCorner = (r === 0 || r === BOARD_SIZE - 1) && (c === 0 || c === BOARD_SIZE - 1);
    if (isCorner) return true;

    return false;
}

/**
 * Determines the maximum number of times a position (r, c) can be used as a light source this turn.
 */
function getMaxLightUsesForPosition(r, c, playerColor) {
    const key = `${r},${c}`;
    const pieceColor = board[r][c].piece;
    const isBeacon = isBeaconField(r, c);
    const isLitByPlayer = litBeacons[key] === playerColor;

    if (pieceColor === playerColor) {
        if (isBeacon && isLitByPlayer) {
            return 2; // Piece light (1) + Beacon light (1)
        } else {
            return 1; // Piece light only
        }
    } else if (pieceColor === null && isBeacon && isLitByPlayer) {
        return 1; // Empty, but friendly lit beacon light only
    }

    return 0; // Not a friendly light source
}

/**
 * Checks if a specific position (r,c) still has available light tokens for the current turn.
 */
function hasAvailableLight(r, c, playerColor) {
    const key = `${r},${c}`;
    const maxUses = getMaxLightUsesForPosition(r, c, playerColor);
    const currentUses = lightSourceUsage[key] || 0;
    return currentUses < maxUses;
}

// ============================================
// GAME FLOW & SETUP
// ============================================

function initializeBoard() {
    board = Array(BOARD_SIZE).fill(0).map((_, r) =>
        Array(BOARD_SIZE).fill(0).map((_, c) => ({ piece: null, r, c }))
    );

    const START_INDEX = 2;
    const END_INDEX = 6;

    // White stones (Row 0 and 8)
    for (let c = START_INDEX; c <= END_INDEX; c++) {
        board[0][c].piece = 'white';
    }
    for (let c = START_INDEX; c <= END_INDEX; c++) {
        board[BOARD_SIZE - 1][c].piece = 'white';
    }

    // Black stones (Col 0 and 8)
    for (let r = START_INDEX; r <= END_INDEX; r++) {
        board[r][0].piece = 'black';
    }
    for (let r = START_INDEX; r <= END_INDEX; r++) {
        board[r][BOARD_SIZE - 1].piece = 'black';
    }

    currentPlayer = 'white';
    lightSourceUsage = {};
    litBeacons = {};

    // Check for game start condition
    if (!canMove('white')) {
        gameState = 'GAME_OVER';
        showMessage(`Game Over! White has no legal moves. Black wins!`, true);
    } else {
        resetMoveState(true);
    }

    drawBoard();
    updateUI();
    hideMessage();
}

/**
 * Resets the move state.
 */
function resetMoveState(fullReset = false) {
    if (fullReset) {
        lightSourceUsage = {};
        moveHistory = [];
        startMoveSource = null;
    }
    moveSource = null;
    potentialLightSources = [];
    potentialMoveTargets = [];
    gameState = 'SELECT_MOVE_STONE';
    drawBoard();
    updateStatus();
    updateUI();
}

function drawBoard() {
    boardElement.innerHTML = '';

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cellData = board[r][c];
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            const key = `${r},${c}`;

            // Add beacon visual indicators
            if (isBeaconField(r, c)) {
                if (litBeacons[key]) {
                    const litIndicator = document.createElement('div');
                    litIndicator.classList.add('beacon-lit-indicator', `beacon-lit-${litBeacons[key]}`);
                    cell.appendChild(litIndicator);
                } else {
                    const unlitIndicator = document.createElement('div');
                    unlitIndicator.classList.add('unlit-beacon-indicator');
                    cell.appendChild(unlitIndicator);
                }
            }

            if (cellData.piece) {
                const piece = document.createElement('div');
                piece.classList.add('piece', cellData.piece);
                cell.appendChild(piece);

                const isMoveSource = moveSource && moveSource.r === r && moveSource.c === c;
                const isStartSource = startMoveSource && startMoveSource.r === r && startMoveSource.c === c;
                const isLightSourceAvailable = potentialLightSources.some(p => p.r === r && p.c === c);

                // Check for piece being fully darkened
                const maxUsesForPiece = getMaxLightUsesForPosition(r, c, currentPlayer);
                const currentUses = lightSourceUsage[key] || 0;
                const isFullyDarkened = (cellData.piece === currentPlayer) && (maxUsesForPiece > 0 && currentUses >= maxUsesForPiece);

                if (isFullyDarkened) {
                    piece.classList.add('darkened');
                }

                if (isMoveSource) {
                    piece.classList.add('selected-piece');
                } else if (isStartSource) {
                    piece.classList.add('start-piece');
                }

                if (gameState === 'SELECT_LIGHT_SOURCE' && isLightSourceAvailable) {
                    cell.classList.add('available-light-source');
                    if (cellData.piece) {
                        piece.classList.add('available-light-source');
                    }
                }
            }

            // Highlight potential move targets
            if (gameState === 'SELECT_TARGET_CELL' && potentialMoveTargets.some(p => p.r === r && p.c === c)) {
                cell.classList.add('highlight-move-target');
            }

            cell.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cell);
        }
    }
}

function updateStatus(message = null) {
    playerColorElement.className = `current-player-indicator`;
    playerColorElement.style.backgroundColor = currentPlayer === 'white' ? '#ffffff' : '#1a1a1a';
    playerColorElement.style.borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffffff';

    if (gameState === 'GAME_OVER') return;

    if (message) {
        statusElement.textContent = message;
    } else {
        let statusText = ``;
        if (gameState === 'SELECT_MOVE_STONE') {
            statusText = `to move. Select a stone to start the move.`;
        } else if (gameState === 'SELECT_LIGHT_SOURCE') {
            statusText = `to move. Select the Light Source (pulsing blue) to enable the move.`;
        } else if (gameState === 'SELECT_TARGET_CELL') {
            statusText = `to move. Select the Target Cell (green highlight) or click the moving stone/End Turn.`;
        }
        statusElement.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} ${statusText}`;
    }
}

function updateUI() {
    if (moveSource) {
        endTurnButton.classList.remove('hidden');
        endTurnButton.disabled = false;
    } else {
        endTurnButton.classList.add('hidden');
    }
}

function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.classList.remove('hidden');
    clearTimeout(window.messageTimeout);
    window.messageTimeout = setTimeout(hideMessage, 4000);
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

/**
 * Returns possible adjacent moves for a piece at (r, c).
 */
function getPossibleMoves(r, c) {
    const moves = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

        if (board[nr][nc].piece !== board[r][c].piece) {
            moves.push({ r: nr, c: nc });
        }
    }
    return moves;
}

/**
 * Finds all valid light sources for a piece at (r, c) for a given player.
 */
function findAvailableLightSources(r, c, playerColor) {
    const sources = new Map();
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const opponent = playerColor === 'white' ? 'black' : 'white';
    const isMovingPiece = moveSource && moveSource.r === r && moveSource.c === c;

    const key = `${r},${c}`;
    const maxUses = getMaxLightUsesForPosition(r, c, playerColor);
    const currentUses = lightSourceUsage[key] || 0;
    const isInitialMove = moveHistory.length === 0;

    // Check the Moving Piece Itself as a Light Source
    if (isMovingPiece) {
        if (isInitialMove) {
            if (maxUses > currentUses) {
                sources.set(key, { r, c });
            }
        } else {
            if (maxUses === 2 && currentUses === 1) {
                sources.set(key, { r, c });
            }
        }
    }

    // Check External Light Sources (Through line-of-sight)
    for (const [dr, dc] of directions) {
        let nr = r + dr;
        let nc = c + dc;

        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            const cell = board[nr][nc];
            const pos = { r: nr, c: nc };
            const currentKey = `${nr},${nc}`;

            // Check for blocker (opponent's piece)
            if (cell.piece === opponent) {
                break;
            }

            // Skip the moving piece's current position
            if (isMovingPiece && nr === r && nc === c) {
                nr += dr;
                nc += dc;
                continue;
            }

            // Check if this position has available light tokens
            if (hasAvailableLight(nr, nc, playerColor)) {
                sources.set(currentKey, pos);
            }

            nr += dr;
            nc += dc;
        }
    }

    return Array.from(sources.values());
}

/**
 * Undoes the last light usage for a specific position.
 */
function undoLightUsage(r, c) {
    const key = `${r},${c}`;
    if (lightSourceUsage[key] > 0) {
        lightSourceUsage[key] -= 1;
        if (lightSourceUsage[key] === 0) {
            delete lightSourceUsage[key];
        }
        return true;
    }
    return false;
}

// ============================================
// EVENT HANDLERS & GAME LOGIC
// ============================================

function handleCellClick(r, c) {
    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.", true);
        return;
    }

    const cellData = board[r][c];
    const pieceColor = cellData.piece;
    const pos = { r, c };
    const key = `${r},${c}`;

    // DESELECTION / END TURN LOGIC
    const isCurrentMoveSource = moveSource && moveSource.r === r && moveSource.c === c;

    if (isCurrentMoveSource) {
        if (moveHistory.length === 1 && moveHistory[0].target === null) {
            const lightUsed = moveHistory[0].lightUsed;
            if (lightUsed) {
                undoLightUsage(lightUsed.r, lightUsed.c);
            }

            showMessage("Initial stone selection cancelled. Select a different stone.");
            resetMoveState(true);
        } else if (moveHistory.length > 0 && moveHistory[moveHistory.length - 1].target !== null) {
            showMessage(`Movement chain finished by clicking the moving stone.`);
            endTurn();
        } else if (moveHistory.length > 0 && moveHistory[moveHistory.length - 1].target === null) {
            showMessage(`Movement chain stopped during light selection. Ending turn.`);
            endTurn();
        }
        return;
    }

    // Clicked a light source that was just used
    if (gameState === 'SELECT_LIGHT_SOURCE') {
        const currentMoveStep = moveHistory[moveHistory.length - 1];

        if (currentMoveStep.lightUsed && currentMoveStep.lightUsed.r === r && currentMoveStep.lightUsed.c === c) {
            if (undoLightUsage(r, c)) {
                currentMoveStep.lightUsed = null;

                potentialMoveTargets = getPossibleMoves(moveSource.r, moveSource.c);
                potentialLightSources = findAvailableLightSources(moveSource.r, moveSource.c, currentPlayer);

                showMessage(`Light source selection cancelled. Please select a valid light source again.`);
                drawBoard();
                updateStatus();
                return;
            }
        }
    }

    // MOVE SELECTION LOGIC

    // 1. SELECT_MOVE_STONE State
    if (gameState === 'SELECT_MOVE_STONE') {
        const isPieceFullyDarkened = (pieceColor === currentPlayer) && !hasAvailableLight(r, c, currentPlayer);

        if (pieceColor === currentPlayer && !isPieceFullyDarkened) {
            potentialMoveTargets = getPossibleMoves(r, c);
            if (potentialMoveTargets.length === 0) {
                showMessage(`Stone at (${r},${c}) has no legal move targets. Select another stone.`, true);
                return;
            }

            potentialLightSources = findAvailableLightSources(r, c, currentPlayer);

            if (potentialLightSources.length > 0) {
                moveSource = pos;
                startMoveSource = pos;

                moveHistory.push({ source: pos, target: null, lightUsed: null, capture: false });

                // AUTOMATIC LIGHT SELECTION
                if (potentialLightSources.length === 1) {
                    const singleSource = potentialLightSources[0];
                    const singleSourceKey = `${singleSource.r},${singleSource.c}`;

                    lightSourceUsage[singleSourceKey] = (lightSourceUsage[singleSourceKey] || 0) + 1;
                    moveHistory[moveHistory.length - 1].lightUsed = singleSource;

                    potentialLightSources = [];
                    gameState = 'SELECT_TARGET_CELL';
                    drawBoard();
                    updateStatus('Single light source automatically used. Select a move target (green highlight) or End Turn.');
                } else {
                    gameState = 'SELECT_LIGHT_SOURCE';
                    drawBoard();
                    updateStatus();
                }
            } else {
                showMessage(`Stone at (${r},${c}) cannot move: no available light source found. Select another stone.`, true);
            }
        } else if (pieceColor === currentPlayer) {
            showMessage(`This stone is fully darkened and cannot be used this turn. Select another stone.`, true);
        } else if (pieceColor !== null) {
            showMessage(`It is ${currentPlayer}'s turn. Select a ${currentPlayer} stone.`, true);
        }
        return;
    }

    // 2. SELECT_LIGHT_SOURCE State
    if (gameState === 'SELECT_LIGHT_SOURCE') {
        const isLightSource = potentialLightSources.some(p => p.r === r && p.c === c);

        if (isLightSource) {
            lightSourceUsage[key] = (lightSourceUsage[key] || 0) + 1;
            moveHistory[moveHistory.length - 1].lightUsed = pos;

            potentialLightSources = [];
            gameState = 'SELECT_TARGET_CELL';
            drawBoard();
            updateStatus();
            return;
        }

        showMessage('Invalid selection. You must select an available light source (pulsing blue).', true);
        return;
    }

    // 3. SELECT_TARGET_CELL State
    if (gameState === 'SELECT_TARGET_CELL') {
        const targetPos = { r, c };
        const isTarget = potentialMoveTargets.some(p => p.r === r && p.c === c);

        if (isTarget) {
            executeMove(targetPos);
            return;
        } else {
            showMessage('Invalid target cell. Select one of the highlighted adjacent fields, or click the moving stone/End Turn.', true);
            return;
        }
    }
}

function executeMove(targetPos) {
    const { r: sourceR, c: sourceC } = moveSource;
    const { r: targetR, c: targetC } = targetPos;

    const movingPiece = board[sourceR][sourceC].piece;
    let message = '';
    let captureOccurred = false;

    // 1. Capture (if applicable)
    if (board[targetR][targetC].piece && board[targetR][targetC].piece !== movingPiece) {
        message += `${movingPiece.charAt(0).toUpperCase() + movingPiece.slice(1)} captured a ${board[targetR][targetC].piece} stone! `;
        captureOccurred = true;
    }

    // 2. Perform the board state update
    board[targetR][targetC].piece = movingPiece;
    board[sourceR][sourceC].piece = null;

    // 3. Update the move history entry
    moveHistory[moveHistory.length - 1].target = targetPos;
    moveHistory[moveHistory.length - 1].capture = captureOccurred;

    // 4. Update Beacon state
    if (isBeaconField(targetR, targetC)) {
        const key = `${targetR},${targetC}`;
        const oldBeaconOwner = litBeacons[key];

        litBeacons[key] = movingPiece;

        if (oldBeaconOwner !== movingPiece) {
            message += `Beacon at (${targetR},${targetC}) is now lit by ${movingPiece}! `;
        }
    }

    // 5. Check for Chaining Opportunity
    const newMoveSource = { r: targetR, c: targetC };

    potentialMoveTargets = getPossibleMoves(newMoveSource.r, newMoveSource.c);

    if (potentialMoveTargets.length === 0) {
        showMessage(`${message}Stone at (${targetR},${targetC}) has no adjacent target cells. Turn ends.`, false);
        endTurn();
        return;
    }

    potentialLightSources = findAvailableLightSources(newMoveSource.r, newMoveSource.c, movingPiece);

    if (potentialLightSources.length > 0) {
        moveSource = newMoveSource;
        showMessage(message + `Move complete. Stone is at (${targetR},${targetC}). Prepare for chain move.`);

        moveHistory.push({ source: newMoveSource, target: null, lightUsed: null, capture: false });

        if (potentialLightSources.length === 1) {
            const singleSource = potentialLightSources[0];
            const singleSourceKey = `${singleSource.r},${singleSource.c}`;

            lightSourceUsage[singleSourceKey] = (lightSourceUsage[singleSourceKey] || 0) + 1;
            moveHistory[moveHistory.length - 1].lightUsed = singleSource;

            potentialLightSources = [];
            gameState = 'SELECT_TARGET_CELL';
            drawBoard();
            updateStatus(`Move continued: Single light source automatically used. Select next move target (green).`);
        } else {
            gameState = 'SELECT_LIGHT_SOURCE';
            drawBoard();
            updateStatus(`Move continued: Select next Light Source (pulsing blue).`);
        }
    } else {
        showMessage(`${message}No more available light sources for the stone at (${targetR},${targetC}). Turn ends.`, false);
        endTurn();
    }
}

function endTurn() {
    const winningPlayer = currentPlayer;
    const losingPlayer = currentPlayer === 'white' ? 'black' : 'white';

    resetMoveState(true);

    if (!canMove(losingPlayer)) {
        updateStatus(`Game Over! ${winningPlayer.charAt(0).toUpperCase() + winningPlayer.slice(1)} wins!`);
        showMessage(`Game Over! ${winningPlayer.charAt(0).toUpperCase() + winningPlayer.slice(1)} wins, as ${losingPlayer} has no legal moves to start their turn.`, true);
        gameState = 'GAME_OVER';
        drawBoard();
        return;
    }

    currentPlayer = losingPlayer;
    drawBoard();
    updateStatus();
}

/**
 * Checks if the given player has any legal move left at the start of their turn.
 */
function canMove(player) {
    const originalLightSourceUsage = { ...lightSourceUsage };
    lightSourceUsage = {};

    let possible = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = board[r][c];

            if (cell.piece === player) {
                const possibleTargets = getPossibleMoves(r, c);
                if (possibleTargets.length === 0) continue;

                const availableLightSources = findAvailableLightSources(r, c, player);
                if (availableLightSources.length > 0) {
                    possible = true;
                    break;
                }
            }
        }
        if (possible) break;
    }

    lightSourceUsage = originalLightSourceUsage;
    return possible;
}

// ============================================
// INITIALIZATION
// ============================================

resetButton.addEventListener('click', initializeBoard);
endTurnButton.addEventListener('click', () => {
    showMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} chose to end their movement chain using the End Turn button.`);
    endTurn();
});

document.addEventListener('DOMContentLoaded', initializeBoard);
