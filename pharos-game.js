// PHAROS GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
const BOARD_SIZE_2 = 9;
const BOARD_SIZE_4 = 11;
let BOARD_SIZE = BOARD_SIZE_2;

// Clockwise seating: white(bottom) -> red(left) -> black(top) -> blue(right)
const PLAYERS_4 = ['white', 'red', 'black', 'blue'];
// Opposite edges are allies: white+black (colorless), red+blue (colored).
// Allies can spend light on each other but only one player ultimately wins.
const PARTNER = { white: 'black', black: 'white', red: 'blue', blue: 'red' };

function isAlly(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    // The white/black vs red/blue alliance pairing only applies in 4-player mode;
    // in 2-player mode white and black are the only colors and are always enemies.
    return playerCount === 4 && PARTNER[a] === b;
}

function isEnemy(a, b) {
    return !!a && !!b && !isAlly(a, b);
}

// ============================================
// GAME STATE
// ============================================
let board = [];
let playerCount = 2;
let currentPlayer = 'white';
let eliminatedPlayers = new Set();
// States: SELECT_MOVE_STONE, SELECT_LIGHT_SOURCE, SELECT_TARGET_CELL, GAME_OVER
let gameState = 'SELECT_MOVE_STONE';
// "Computer" is currently the only opponent option, so it is always active.
// The human always plays White; every other color is computer-controlled.
let isVsComputer = true;
const HUMAN_PLAYER = 'white';
let aiIsActing = false;
// True while a move's 3D tween is in flight (board state not yet applied).
// Prevents the AI (and stray clicks) from acting on stale board state.
let boardAnimating = false;

function isComputerPlayer(color) {
    return isVsComputer && color !== HUMAN_PLAYER;
}

// The piece currently being moved {r, c}
let moveSource = null;
// The original location of the piece at the start of the turn
let startMoveSource = null;

// Array to track the moves made this turn
let moveHistory = [];

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {r, c}
let aiConsecutiveMoveCount = 0;

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
const opponentButton = document.getElementById('opponent-btn');
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalResetBtn = document.getElementById('modal-reset-btn');

if (modalResetBtn) {
    modalResetBtn.addEventListener('click', () => {
        hideGameOverModal();
        initializeBoard();
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if a cell is one of the designated beacon fields.
 */
function isBeaconField(r, c) {
    // Center Beacon
    const center = Math.floor(BOARD_SIZE / 2);
    if (r === center && c === center) return true;

    // Corner Beacons
    const isCorner = (r === 0 || r === BOARD_SIZE - 1) && (c === 0 || c === BOARD_SIZE - 1);
    if (isCorner) return true;

    return false;
}

/**
 * Determines the maximum number of times a position (r, c) can be used as a light source this turn.
 * Allied colors (opposite edges) may spend each other's light, so "friendly" here means own or ally.
 */
function getMaxLightUsesForPosition(r, c, playerColor) {
    const key = `${r},${c}`;
    const pieceColor = board[r][c].piece;
    const isBeacon = isBeaconField(r, c);
    const isLitByAlly = isAlly(litBeacons[key], playerColor);

    if (isAlly(pieceColor, playerColor)) {
        if (isBeacon && isLitByAlly) {
            return 2; // Piece light (1) + Beacon light (1)
        } else {
            return 1; // Piece light only
        }
    } else if (pieceColor === null && isBeacon && isLitByAlly) {
        return 1; // Empty, but allied lit beacon light only
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
    BOARD_SIZE = playerCount === 4 ? BOARD_SIZE_4 : BOARD_SIZE_2;

    board = Array(BOARD_SIZE).fill(0).map((_, r) =>
        Array(BOARD_SIZE).fill(0).map((_, c) => ({ piece: null, r, c }))
    );

    const START_INDEX = 2;
    const END_INDEX = BOARD_SIZE - 3;

    if (playerCount === 4) {
        // White (bottom) + Black (top) are allies; Red (left) + Blue (right) are allies.
        for (let c = START_INDEX; c <= END_INDEX; c++) {
            board[BOARD_SIZE - 1][c].piece = 'white';
            board[0][c].piece = 'black';
        }
        for (let r = START_INDEX; r <= END_INDEX; r++) {
            board[r][0].piece = 'red';
            board[r][BOARD_SIZE - 1].piece = 'blue';
        }
    } else {
        // White stones (Row 0 and 8)
        for (let c = START_INDEX; c <= END_INDEX; c++) {
            board[0][c].piece = 'white';
        }
        for (let c = START_INDEX; c <= END_INDEX; c++) {
            board[BOARD_SIZE - 1][c].piece = 'white';
        }

        // Red stones (Col 0 and 8)
        for (let r = START_INDEX; r <= END_INDEX; r++) {
            board[r][0].piece = 'black';
        }
        for (let r = START_INDEX; r <= END_INDEX; r++) {
            board[r][BOARD_SIZE - 1].piece = 'black';
        }
    }

    lightSourceUsage = {};
    litBeacons = {};
    eliminatedPlayers = new Set();

    if (playerCount === 4) {
        if (!advanceTurn4p(0)) {
            // Game already ended (only possible if 3 of 4 starting positions are somehow stuck)
        } else {
            resetMoveState(true);
        }
    } else {
        currentPlayer = 'white';
        // Check for game start condition
        if (!canMove('white')) {
            gameState = 'GAME_OVER';
            showMessage(`Game Over! White has no legal moves. Red wins!`, true);
        } else {
            resetMoveState(true);
        }
    }

    drawBoard();
    updateUI();

    // Ensure the status panel is hidden initially
    const statusElPanel = document.getElementById('game-status')?.closest('.status-panel');
    if (statusElPanel) statusElPanel.classList.remove('visible');

    hideMessage();
    hideGameOverModal();

    if (window.is3DView && typeof rebuild3DBoard === 'function') rebuild3DBoard();
    else if (window.is3DView && typeof sync3D === 'function') sync3D();

    triggerAIIfNeeded();
}

/**
 * Finds the next player (starting at PLAYERS_4[startIdx], searching forward) who still
 * has a legal move, eliminating any stuck players found along the way. Returns true and
 * sets currentPlayer if someone can move; returns false if the game just ended.
 */
function advanceTurn4p(startIdx) {
    for (let attempts = 0, idx = startIdx; attempts < PLAYERS_4.length; attempts++, idx++) {
        const candidate = PLAYERS_4[((idx % PLAYERS_4.length) + PLAYERS_4.length) % PLAYERS_4.length];
        if (eliminatedPlayers.has(candidate)) continue;

        if (canMove(candidate)) {
            currentPlayer = candidate;
            return true;
        }

        eliminatePlayer(candidate);
        const survivors = PLAYERS_4.filter(p => !eliminatedPlayers.has(p));
        if (survivors.length <= 1) {
            declareFourPlayerWinner(survivors[0]);
            return false;
        }
    }
    return false;
}

function eliminatePlayer(color) {
    eliminatedPlayers.add(color);
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece === color) board[r][c].piece = null;
        }
    }
    Object.keys(litBeacons).forEach(key => {
        if (litBeacons[key] === color) delete litBeacons[key];
    });
    showMessage(`${color.charAt(0).toUpperCase() + color.slice(1)} has no legal moves and is eliminated!`, true);
}

function declareFourPlayerWinner(winner) {
    currentPlayer = winner || currentPlayer;
    gameState = 'GAME_OVER';
    const name = winner ? winner.charAt(0).toUpperCase() + winner.slice(1) : 'Nobody';
    showGameOverModal(`${name} Wins!`, winner ? `All other players are eliminated!` : `All players eliminated.`);
    updateStatus(`Game Over! ${name} Wins!`);
    drawBoard();

    if (typeof toggleMenu === 'function') {
        setTimeout(() => toggleMenu(), 1000);
    }
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
    
    // Update indicator color based on current player
    const indicator = document.getElementById('player-indicator');
    if (indicator) {
        indicator.className = 'count-stone ' + currentPlayer;
        indicator.style.backgroundColor = getPlayerColorHex(currentPlayer);
    }
    if (window.is3DView && typeof sync3D === 'function') sync3D();
}

/**
 * Maps a player color to its swatch. In 2-player mode 'black' is displayed as red
 * (thematic White vs Red); in 4-player mode all four colors are true to their name.
 */
function getPlayerColorHex(color) {
    if (playerCount === 4) {
        const map = { white: '#ffffff', black: '#1a1a1a', red: '#ff4d4d', blue: '#3b82f6' };
        return map[color] || '#ffffff';
    }
    return color === 'black' ? '#8b0000' : '#ffffff';
}

function drawBoard() {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.width = `calc(var(--cell-size) * ${BOARD_SIZE})`;
    boardElement.style.height = `calc(var(--cell-size) * ${BOARD_SIZE})`;
    boardElement.classList.toggle('four-player', playerCount === 4);

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
                    const displayColorClass = (playerCount === 2 && litBeacons[key] === 'black') ? 'red' : litBeacons[key];
                    const litIndicator = document.createElement('div');
                    litIndicator.classList.add('beacon-lit-indicator', `beacon-lit-${displayColorClass}`);
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
                const isFullyDarkened = isAlly(cellData.piece, currentPlayer) && (maxUsesForPiece > 0 && currentUses >= maxUsesForPiece);

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
    if (window.is3DView && typeof update3DViews === 'function') update3DViews();
}

function updateStatus(message = null) {
    const statusEl = document.getElementById('game-status');
    const playerEl = document.getElementById('player-name');
    const playerColorEl = document.getElementById('current-player-color');
    const playerIndicatorEl = document.getElementById('player-indicator');
    
    let displayColor, activeColor, borderColor;
    if (playerCount === 4) {
        const names = { white: 'White', black: 'Black', red: 'Red', blue: 'Blue' };
        const borders = { white: '#1a1a1a', black: '#e5e5e5', red: '#1a1a1a', blue: '#1a1a1a' };
        displayColor = names[currentPlayer] || currentPlayer;
        activeColor = getPlayerColorHex(currentPlayer);
        borderColor = borders[currentPlayer] || '#1a1a1a';
    } else {
        displayColor = currentPlayer === 'white' ? 'White' : 'Red';
        activeColor = currentPlayer === 'white' ? '#ffffff' : '#ff4d4d'; // Match Skyscraper/3D Red
        borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffd700';
    }

    if (gameState === 'GAME_OVER') {
        if (playerEl) playerEl.textContent = `${displayColor} Wins!`;
        if (statusEl) statusEl.textContent = "Game Over! Select New Game to restart.";
        if (playerColorEl) {
            playerColorEl.style.backgroundColor = activeColor;
            playerColorEl.style.borderColor = borderColor;
        }
        if (playerIndicatorEl) {
            playerIndicatorEl.style.backgroundColor = activeColor;
            playerIndicatorEl.style.borderColor = borderColor;
        }
        return;
    }

    if (playerEl) playerEl.textContent = `${displayColor}'s Turn`;
    
    if (playerColorEl) {
        playerColorEl.style.backgroundColor = activeColor;
        playerColorEl.style.borderColor = borderColor;
    }
    if (playerIndicatorEl) {
        playerIndicatorEl.style.backgroundColor = activeColor;
        playerIndicatorEl.style.borderColor = borderColor;
    }

    if (message) {
        if (statusEl) statusEl.textContent = message;
    } else {
        let statusText = ``;
        if (gameState === 'SELECT_MOVE_STONE') {
            statusText = `to move. Select a stone to start the move.`;
        } else if (gameState === 'SELECT_LIGHT_SOURCE') {
            statusText = `to move. Select the Light Source (pulsing blue).`;
        } else if (gameState === 'SELECT_TARGET_CELL') {
            statusText = `to move. Select the Target Cell (green) or click the moving stone.`;
        }
        if (statusEl) {
            statusEl.textContent = `${displayColor} ${statusText}`;
            
            // Add visible class with a tiny delay to ensure a clean fade-in
            setTimeout(() => {
                const panel = statusEl.closest('.status-panel');
                if (panel) panel.classList.add('visible');
            }, 100);
        }
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
    const ownerColor = board[r][c].piece;
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

        const targetPiece = board[nr][nc].piece;
        // A stone may step onto an empty field or capture an enemy; allies block the way.
        if (targetPiece === null || isEnemy(targetPiece, ownerColor)) {
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

            // Check for blocker (an enemy piece)
            if (cell.piece && isEnemy(cell.piece, playerColor)) {
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

    if (isComputerPlayer(currentPlayer) && !aiIsActing) {
        return; // Block manual clicks during the computer's turn.
    }

    if (boardAnimating) {
        return; // A move's tween is still in flight; ignore clicks until it lands.
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
                if (window.is3DView && typeof sync3D === 'function') sync3D();
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
            if (window.is3DView && typeof sync3D === 'function') sync3D();
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
    boardAnimating = true;
    if (window.is3DView && typeof animate3DMove === 'function') {
        animate3DMove(moveSource.r, moveSource.c, targetPos.r, targetPos.c).then(() => {
            finalizeMove(targetPos);
        });
    } else {
        finalizeMove(targetPos);
    }
}

function finalizeMove(targetPos) {
    boardAnimating = false;
    const { r: sourceR, c: sourceC } = moveSource;
    const { r: targetR, c: targetC } = targetPos;

    const movingPiece = board[sourceR][sourceC].piece;

    // Track AI consecutive moves with the same stone (across turns)
    if (movingPiece === 'black' && moveHistory.length === 0) {
        // Only record the FIRST stone moved in a chain for loop tracking
        if (aiLastMovedStone &&
            aiLastMovedStone.r === sourceR &&
            aiLastMovedStone.c === sourceC) {
            aiConsecutiveMoveCount++;
        } else {
            aiConsecutiveMoveCount = 1;
        }
        // Update to the NEW position for the next turn's check
        aiLastMovedStone = { r: targetR, c: targetC };
    } else if (movingPiece === 'white') {
        aiLastMovedStone = null;
        aiConsecutiveMoveCount = 0;
    }
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
    
    if (window.is3DView && typeof sync3D === 'function') sync3D();
}

function endTurn() {
    if (playerCount === 4) {
        const finishedPlayer = currentPlayer;
        resetMoveState(true);

        if (!advanceTurn4p(PLAYERS_4.indexOf(finishedPlayer) + 1)) {
            return; // Game already ended inside advanceTurn4p
        }

        gameState = 'SELECT_MOVE_STONE';
        drawBoard();
        updateStatus();
        triggerAIIfNeeded();
        return;
    }

    const winningPlayer = currentPlayer;
    const losingPlayer = currentPlayer === 'white' ? 'black' : 'white';

    resetMoveState(true);

    if (!canMove(losingPlayer)) {
        gameState = 'GAME_OVER';
        const winTitle = winningPlayer === 'white' ? "White Wins!" : "Red Wins!";
        const winnerName = winningPlayer === 'white' ? "White" : "Red";
        const loserName = winningPlayer === 'white' ? "Red" : "White";
        const winText = `${winnerName} wins because ${loserName} has no legal moves!`;
        
        showGameOverModal(winTitle, winText);
        updateStatus(`Game Over! ${winTitle}`);
        drawBoard();
        
        // Open the side menu automatically to show results and buttons
        if (typeof toggleMenu === 'function') {
            setTimeout(() => toggleMenu(), 1000);
        }
        return;
    }

    currentPlayer = losingPlayer;
    drawBoard();
    updateStatus();

    gameState = 'SELECT_MOVE_STONE';
    triggerAIIfNeeded();
}

/**
 * Schedules the AI's move if the current player is computer-controlled.
 */
function triggerAIIfNeeded() {
    if (gameState === 'GAME_OVER') return;
    if (isComputerPlayer(currentPlayer)) {
        setTimeout(makeAIMove, 600);
    }
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

// Switch player count (2 or 4) and restart with the matching board.
function setPlayerCount(n) {
    if (n !== 2 && n !== 4) return;
    playerCount = n;
    initializeBoard();
}
window.setPlayerCount = setPlayerCount;

resetButton.addEventListener('click', initializeBoard);
endTurnButton.addEventListener('click', () => {
    showMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} chose to end their movement chain using the End Turn button.`);
    endTurn();
});
// Toggles between a computer-controlled opponent (every non-White seat) and
// full human hotseat play, updating both the menu and action-bar buttons.
function toggleOpponentMode() {
    isVsComputer = !isVsComputer;

    const label = `Opponent: ${isVsComputer ? 'Computer' : 'Human'}`;
    if (opponentButton) opponentButton.textContent = label;
    const opponentBtnMenu = document.getElementById('opponent-btn-menu');
    if (opponentBtnMenu) opponentBtnMenu.textContent = label;

    showMessage(isVsComputer ? "Computer opponent enabled." : "Human opponent enabled. Pass and play on the same device.");

    // Kick off the AI immediately if it's now a computer-controlled player's turn.
    triggerAIIfNeeded();
}
window.toggleOpponentMode = toggleOpponentMode;

opponentButton.addEventListener('click', toggleOpponentMode);


// ============================================
// AI LOGIC
// ============================================

function countOpponentMoves(player) {
    const opponent = player === 'white' ? 'black' : 'white';
    let moveCount = 0;
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece === opponent) {
                const targets = getPossibleMoves(r, c);
                const lights = findAvailableLightSources(r, c, opponent);
                if (targets.length > 0 && lights.length > 0) {
                    moveCount += targets.length;
                }
            }
        }
    }
    return moveCount;
}

function evaluateMove(stone, target, light, player) {
    let score = 0;
    const targetColor = board[target.r][target.c].piece;

    // PRIORITY 1: Kill enemy stones (ATTACK)
    if (targetColor && isEnemy(targetColor, player)) {
        score += 1000;

        // Check if this capture also controls a beacon
        if (isBeaconField(target.r, target.c)) {
            score += 200;
        }
    }

    // PRIORITY 2: Control beacons (limit enemy movement)
    if (isBeaconField(target.r, target.c)) {
        score += 300;

        // If we can light a beacon, that's very valuable
        if (targetColor === null) {
            score += 150;
        }
    }

    // PRIORITY 3: Block enemy lines of sight
    // Check if this move blocks enemy light sources
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of directions) {
        let nr = target.r + dr;
        let nc = target.c + dc;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            const cell = board[nr][nc];
            if (cell.piece && isEnemy(cell.piece, player)) {
                // Moving here might block this enemy stone's light path
                score += 50;
                break;
            }
            if (cell.piece === player) {
                break; // Blocked by own piece
            }
            nr += dr;
            nc += dc;
        }
    }

    // PRIORITY 4: Advance towards the center (strategic positioning, works
    // symmetrically for every starting edge in both 2p and 4p layouts)
    const center = (BOARD_SIZE - 1) / 2;
    const distBefore = Math.abs(stone.r - center) + Math.abs(stone.c - center);
    const distAfter = Math.abs(target.r - center) + Math.abs(target.c - center);
    score += (distBefore - distAfter) * 10;

    // PRIORITY 5: Prefer moves that keep options open (more adjacent moves)
    const futureTargets = getPossibleMoves(target.r, target.c);
    score += futureTargets.length * 5;
    
    // Loop prevention
    if (aiLastMovedStone &&
        aiLastMovedStone.r === stone.r &&
        aiLastMovedStone.c === stone.c) {
        if (aiConsecutiveMoveCount >= 2) score -= 500;
        else if (aiConsecutiveMoveCount >= 1) score -= 100;
    }
    
    // Random factor for variety
    score += Math.random() * 20;
    
    return score;
}

// Executes a click as part of the AI's own turn (bypasses the human-input guard).
function aiClick(r, c) {
    aiIsActing = true;
    handleCellClick(r, c);
    aiIsActing = false;
}

function makeAIMove() {
    if (!isComputerPlayer(currentPlayer)) return;
    if (gameState === 'GAME_OVER') return;

    // A move animation from the previous step hasn't landed on the board yet
    // (the tween runs longer than the AI's step delay) — wait for it instead
    // of re-evaluating stale board state, which would double-process the move.
    if (boardAnimating) {
        setTimeout(makeAIMove, 100);
        return;
    }

    const aiColor = currentPlayer;

    if (gameState === 'SELECT_MOVE_STONE') {
        // AI: Find all legal moves for all of its own stones
        let validFirstMoves = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c].piece === aiColor) {
                    moveSource = { r, c };
                    const targets = getPossibleMoves(r, c);
                    const lights = findAvailableLightSources(r, c, aiColor);
                    moveSource = null;

                    if (targets.length > 0 && lights.length > 0) {
                        for (let t of targets) {
                            for (let l of lights) {
                                validFirstMoves.push({ stone: { r, c }, target: t, light: l });
                            }
                        }
                    }
                }
            }
        }

        if (validFirstMoves.length === 0) {
            endTurn();
            return;
        }

        // Evaluate moves with priority: attack > beacon control > blocking > position
        let bestScore = -Infinity;
        let bestMove = validFirstMoves[0];

        validFirstMoves.forEach(m => {
            const score = evaluateMove(m.stone, m.target, m.light, aiColor);
            if (score > bestScore) {
                bestScore = score;
                bestMove = m;
            }
        });

        // Execute first click
        aiClick(bestMove.stone.r, bestMove.stone.c);
        setTimeout(makeAIMove, 400);
        return;
    }

    if (gameState === 'SELECT_LIGHT_SOURCE') {
        // AI picks best available light source
        if (potentialLightSources.length > 0) {
            let bestScore = -Infinity;
            let bestSource = potentialLightSources[0];

            potentialLightSources.forEach(ls => {
                let score = 0;
                // Prefer light sources that are closer to the target
                const dist = Math.abs(ls.r - moveSource.r) + Math.abs(ls.c - moveSource.c);
                score -= dist * 10;
                score += Math.random() * 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestSource = ls;
                }
            });

            aiClick(bestSource.r, bestSource.c);
            setTimeout(makeAIMove, 400);
        } else {
            endTurn();
        }
        return;
    }

    if (gameState === 'SELECT_TARGET_CELL') {
        if (potentialMoveTargets.length > 0) {
            let bestScore = -Infinity;
            let bestTarget = potentialMoveTargets[0];

            potentialMoveTargets.forEach(tgt => {
                let score = 0;
                const targetColor = board[tgt.r][tgt.c].piece;

                // Attack is most important
                if (targetColor && isEnemy(targetColor, aiColor)) score += 500;

                // Beacon control
                if (isBeaconField(tgt.r, tgt.c)) score += 150;

                // Strategic position: prefer moves that head towards the board center
                const center = (BOARD_SIZE - 1) / 2;
                const dist = Math.abs(tgt.r - center) + Math.abs(tgt.c - center);
                score -= dist * 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = tgt;
                }
            });
            aiClick(bestTarget.r, bestTarget.c);
            setTimeout(makeAIMove, 400);
        } else {
            endTurn();
        }
        return;
    }
}

document.addEventListener('DOMContentLoaded', initializeBoard);
