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
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');

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
    updateStoneCounts();
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

                // Add clickable arrow if in gravity selection mode
                // Appended AFTER stone to ensure it's on top in DOM order
                if (gameState === 'SELECT_GRAVITY_ORDER' &&
                    cellData.directionField &&
                    pendingGravityDirections.includes(cellData.directionField)) {
                    console.log('Creating overlay for:', cellData.directionField); // Debug log
                    const arrow = document.createElement('div');
                    arrow.classList.add('gravity-arrow-overlay', `arrow-${cellData.directionField}`);
                    arrow.addEventListener('click', (e) => {
                        e.stopPropagation();
                        console.log('Arrow clicked:', cellData.directionField); // Debug log
                        handleGravityChoice(cellData.directionField);
                    });
                    cell.appendChild(arrow);
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
    // Check win condition
    if (whiteCount < 4) {
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

async function handleCellClick(row, col) {
    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.");
        return;
    }

    if (gameState === 'ANIMATING') return;

    const cellData = board[row][col];

    // Handle Gravity Selection (Fallback if overlay click is missed)
    if (gameState === 'SELECT_GRAVITY_ORDER') {
        if (cellData.directionField && pendingGravityDirections.includes(cellData.directionField)) {
            await handleGravityChoice(cellData.directionField);
        }
        return;
    }

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
            await executeMove(move);
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

async function executeMove(move) {
    gameState = 'ANIMATING';
    let newlyActivatedDir = null;

    if (move.type === 'run') {
        // Animate the run movement
        const runAnimation = [{
            from: { row: selectedStone.row, col: selectedStone.col },
            to: { row: move.row, col: move.col }
        }];

        await animateMoves(runAnimation);

        // Apply run movement to board
        board[move.row][move.col].piece = board[selectedStone.row][selectedStone.col].piece;
        board[selectedStone.row][selectedStone.col].piece = null;
        lastPushedStone = null;

        // Redraw to snap stone to grid
        drawBoard();

        // Check if landed on direction field
        if (board[move.row][move.col].directionField) {
            newlyActivatedDir = board[move.row][move.col].directionField;
        }
    } else if (move.type === 'push') {
        // Animate both the pushed stone and the pushing stone
        const pushedPiece = board[move.row][move.col].piece;

        const pushAnimations = [
            {
                from: { row: move.row, col: move.col },
                to: { row: move.pushTo.row, col: move.pushTo.col }
            },
            {
                from: { row: selectedStone.row, col: selectedStone.col },
                to: { row: move.row, col: move.col }
            }
        ];

        await animateMoves(pushAnimations);

        // Apply push movement to board
        board[move.pushTo.row][move.pushTo.col].piece = pushedPiece;
        board[move.row][move.col].piece = board[selectedStone.row][selectedStone.col].piece;
        board[selectedStone.row][selectedStone.col].piece = null;

        // Redraw to snap stones to grid
        drawBoard();

        // Record pushed stone to prevent immediate push-back
        lastPushedStone = { row: move.pushTo.row, col: move.pushTo.col };

        // Check if pushed stone landed on direction field
        if (board[move.pushTo.row][move.pushTo.col].directionField) {
            newlyActivatedDir = board[move.pushTo.row][move.pushTo.col].directionField;
        }
    }

    // Resolve Gravity after movement
    await resolveGravity(newlyActivatedDir);
}

async function resolveGravity(prioritizedDir = null) {
    // 1. Identify active directions
    const activeDirections = [];
    DIRECTION_FIELDS.forEach(({ row, col, dir }) => {
        if (board[row][col].piece) {
            activeDirections.push(dir);
        }
    });

    if (activeDirections.length === 0) {
        checkAndRemoveHades();
        endTurn();
        return;
    }

    // 2. Handle Opposing Directions (Cancellation)
    const hasUp = activeDirections.includes('up');
    const hasDown = activeDirections.includes('down');
    const hasLeft = activeDirections.includes('left');
    const hasRight = activeDirections.includes('right');

    let effectiveDirections = [...new Set(activeDirections)];

    if (hasUp && hasDown) {
        effectiveDirections = effectiveDirections.filter(d => d !== 'up' && d !== 'down');
        showMessage("Opposing gravity (Up/Down) neutralizes!");
    }
    if (hasLeft && hasRight) {
        effectiveDirections = effectiveDirections.filter(d => d !== 'left' && d !== 'right');
        showMessage("Opposing gravity (Left/Right) neutralizes!");
    }

    if (effectiveDirections.length === 0) {
        checkAndRemoveHades();
        endTurn();
        return;
    }

    // 3. Apply prioritized direction first if it exists
    if (prioritizedDir && effectiveDirections.includes(prioritizedDir)) {
        await tiltBoard(prioritizedDir);
        effectiveDirections = effectiveDirections.filter(d => d !== prioritizedDir);

        if (effectiveDirections.length === 0) {
            checkAndRemoveHades();
            endTurn();
            return;
        }
    }

    // 4. Handle remaining directions
    if (effectiveDirections.length === 1) {
        await tiltBoard(effectiveDirections[0]);
        checkAndRemoveHades();
        endTurn();
    } else if (effectiveDirections.length > 1) {
        // Multiple non-opposing directions (e.g., Up + Left)
        // Player must choose order
        gameState = 'SELECT_GRAVITY_ORDER';
        pendingGravityDirections = effectiveDirections;
        updateStatus(`Gravity Conflict! Click a directional field to choose which direction applies first.`);
        drawBoard(); // Redraw to show arrows
    }
}

let pendingGravityDirections = [];

// Removed - arrows now shown on board via drawBoard

async function handleGravityChoice(firstDirection) {
    if (gameState !== 'SELECT_GRAVITY_ORDER') return;

    hideMessage(); // Hide any previous messages

    // Apply first direction
    await tiltBoard(firstDirection);

    // Apply remaining directions
    const remainingDirections = pendingGravityDirections.filter(d => d !== firstDirection);
    for (const dir of remainingDirections) {
        await tiltBoard(dir);
    }

    checkAndRemoveHades();
    endTurn();
}

async function tiltBoard(direction) {
    const previousState = gameState;
    gameState = 'ANIMATING';

    // 1. Calculate moves without modifying board
    const moves = simulateTilt(direction);

    // 2. Animate moves
    if (moves.length > 0) {
        await animateMoves(moves);

        // 3. Apply moves to logical board
        // Capture moving pieces first to avoid overwriting issues
        const updates = moves.map(move => ({
            to: move.to,
            piece: board[move.from.row][move.from.col].piece
        }));

        // Clear source positions
        moves.forEach(move => {
            board[move.from.row][move.from.col].piece = null;
        });

        // Set destination positions
        updates.forEach(update => {
            board[update.to.row][update.to.col].piece = update.piece;
        });
    }

    // 4. Redraw to snap everything to grid and remove transforms
    drawBoard();

    // Restore state if we are not ending turn immediately (though resolveGravity usually ends turn)
    // But resolveGravity might call tiltBoard multiple times.
    // We should leave it as ANIMATING if we are in a sequence?
    // Actually, resolveGravity controls the flow. 
    // If we return here, we are still in resolveGravity.
    // We can set it back to previousState, but resolveGravity might change it again.
    // Let's just set it back to previousState if it wasn't ANIMATING?
    // Actually, it's safer to let the caller handle state, but here we set ANIMATING.
    // Let's just leave it as ANIMATING and let endTurn() reset it to SELECT_STONE.
    // But if we are in SELECT_GRAVITY_ORDER, we might need to stay there?
    // No, handleGravityChoice calls tiltBoard then endTurn.
    // The only case is multiple tilts in resolveGravity.
    // So leaving it as ANIMATING is fine, as long as endTurn resets it.
}

function simulateTilt(direction) {
    // Create a simulation board with IDs to track pieces
    const simBoard = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(null));
    const pieces = [];
    let nextId = 1;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece) {
                const id = nextId++;
                simBoard[r][c] = { id, piece: board[r][c].piece };
                pieces.push({ id, startR: r, startC: c, currentR: r, currentC: c });
            }
        }
    }

    let dr = 0, dc = 0;
    if (direction === 'up') dr = -1;
    if (direction === 'down') dr = 1;
    if (direction === 'left') dc = -1;
    if (direction === 'right') dc = 1;

    let moved = true;
    let iterations = 0;

    while (moved && iterations < BOARD_SIZE * 2) {
        moved = false;
        iterations++;

        const startR = dr > 0 ? BOARD_SIZE - 1 : 0;
        const endR = dr > 0 ? -1 : BOARD_SIZE;
        const stepR = dr > 0 ? -1 : 1;

        const startC = dc > 0 ? BOARD_SIZE - 1 : 0;
        const endC = dc > 0 ? -1 : BOARD_SIZE;
        const stepC = dc > 0 ? -1 : 1;

        for (let r = startR; r !== endR; r += stepR) {
            for (let c = startC; c !== endC; c += stepC) {
                if (simBoard[r][c]) {
                    const newR = r + dr;
                    const newC = c + dc;

                    if (isInBounds(newR, newC) && !simBoard[newR][newC]) {
                        simBoard[newR][newC] = simBoard[r][c];
                        simBoard[r][c] = null;

                        const p = pieces.find(p => p.id === simBoard[newR][newC].id);
                        p.currentR = newR;
                        p.currentC = newC;

                        moved = true;
                    }
                }
            }
        }
    }

    return pieces.filter(p => p.startR !== p.currentR || p.startC !== p.currentC)
        .map(p => ({
            from: { row: p.startR, col: p.startC },
            to: { row: p.currentR, col: p.currentC }
        }));
}

function animateMoves(moves) {
    if (moves.length === 0) return Promise.resolve();

    const animations = moves.map(move => {
        const cell = document.querySelector(`.cell[data-row="${move.from.row}"][data-col="${move.from.col}"]`);
        if (!cell) return null;
        const stone = cell.querySelector('.stone');
        if (!stone) return null;

        const destCell = document.querySelector(`.cell[data-row="${move.to.row}"][data-col="${move.to.col}"]`);
        if (!destCell) return null;

        const startRect = cell.getBoundingClientRect();
        const endRect = destCell.getBoundingClientRect();

        const deltaX = endRect.left - startRect.left;
        const deltaY = endRect.top - startRect.top;

        stone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        return new Promise(resolve => {
            const handler = () => {
                stone.removeEventListener('transitionend', handler);
                resolve();
            };
            stone.addEventListener('transitionend', handler);
            // Fallback
            setTimeout(handler, 350);
        });
    });

    return Promise.all(animations);
}

function checkAndRemoveHades() {
    const visited = new Set();
    const toRemove = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const key = `${r},${c}`;
            if (board[r][c].piece && !visited.has(key)) {
                const { group, liberties } = getGroupAndLiberties(r, c, board[r][c].piece);

                // Mark group as visited
                group.forEach(stone => visited.add(`${stone.row},${stone.col}`));

                // If no liberties, the entire group is captured
                if (liberties === 0) {
                    toRemove.push(...group);
                }
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

function getGroupAndLiberties(startR, startC, color) {
    const group = [];
    let liberties = 0;
    const queue = [{ row: startR, col: startC }];
    const visited = new Set();
    const visitedLiberties = new Set(); // To avoid counting the same liberty multiple times

    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
        const { row, col } = queue.shift();
        group.push({ row, col });

        const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

        for (const { dr, dc } of directions) {
            const adjR = row + dr;
            const adjC = col + dc;
            const adjKey = `${adjR},${adjC}`;

            if (isInBounds(adjR, adjC)) {
                const neighborPiece = board[adjR][adjC].piece;

                if (!neighborPiece) {
                    // Empty spot = Liberty
                    if (!visitedLiberties.has(adjKey)) {
                        liberties++;
                        visitedLiberties.add(adjKey);
                    }
                } else if (neighborPiece === color && !visited.has(adjKey)) {
                    // Friendly stone = Part of group
                    visited.add(adjKey);
                    queue.push({ row: adjR, col: adjC });
                }
            }
            // Out of bounds / Inactive = Wall (No liberty)
        }
    }

    return { group, liberties };
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
