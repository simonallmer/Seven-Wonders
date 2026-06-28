// COLOSSUS GAME - Seven Wonders Series

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

// Board size depends on player count:
//  - 2 players: 9x9 core inside an 11x11 cross (classic).
//  - 4 players: 11x11 core inside a 13x13 cross (expanded).
let BOARD_SIZE = 11; // full grid incl. the cross extensions
let CORE_SIZE = 9;   // playable core (excl. gravitational fields)

// Direction (gravity) fields — recomputed by configureBoard() for the current size.
let DIRECTION_FIELDS = [];

// ---- PLAYERS ----
// Clockwise order copied from Pyramid: white, red, black, blue (white/black opposite, red/blue opposite).
const PLAYERS_4 = ['white', 'red', 'black', 'blue'];
let numPlayers = 2;
let turnIndex = 0;
let eliminated = {}; // color -> true once it drops below 4 stones (4-player)

function activeColors() {
    return numPlayers === 4 ? PLAYERS_4 : ['white', 'black'];
}

// Set board dimensions + gravity-field positions for the current player count.
function configureBoard() {
    if (numPlayers === 4) { BOARD_SIZE = 13; CORE_SIZE = 11; }
    else { BOARD_SIZE = 11; CORE_SIZE = 9; }
    const mid = Math.floor(BOARD_SIZE / 2);
    const last = BOARD_SIZE - 1;
    DIRECTION_FIELDS = [
        { row: 0, col: mid, dir: 'up' },
        { row: last, col: mid, dir: 'down' },
        { row: mid, col: 0, dir: 'left' },
        { row: mid, col: last, dir: 'right' }
    ];
}

// ============================================
// GAME STATE
// ============================================
let board = [];
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let lastPushedStone = null; // Prevents immediate push-back
let isVsComputer = true;

// Per-stone "no push-back": a stone pushed in a direction can't be pushed back the
// opposite way until it next moves (or a gravity tilt reshuffles the board).
let pushDir = {}; // `${r},${c}` -> direction the stone there was last pushed
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
function dirName(dr, dc) {
    if (dr === -1) return 'up';
    if (dr === 1) return 'down';
    if (dc === -1) return 'left';
    if (dc === 1) return 'right';
    return null;
}

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {r, c}
let aiConsecutiveMoveCount = 0;
let aiRecentMoves = []; // signatures of recent AI moves, to detect ping-pong loops
let lastMovedStonePos = null; // {row, col}
let gravityOptions = []; // [{row, col, dir}]

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
const opponentButton = document.getElementById('opponent-btn');
const gameOverModal = document.getElementById('game-over-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalWinnerIcon = document.getElementById('modal-winner-icon');
const newGameBtnModal = document.getElementById('new-game-btn');
const menuBtnModal = document.getElementById('menu-btn-modal');

// ============================================
// BOARD INITIALIZATION
// ============================================

function initializeBoard() {
    configureBoard();
    const mid = Math.floor(BOARD_SIZE / 2);
    const last = BOARD_SIZE - 1;

    board = Array(BOARD_SIZE).fill(0).map(() =>
        Array(BOARD_SIZE).fill(0).map(() => ({ piece: null, isActive: false, directionField: null }))
    );

    // Mark active cells (cross shape)
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Central core (excludes the outer cross extensions)
            if (r >= 1 && r <= last - 1 && c >= 1 && c <= last - 1) board[r][c].isActive = true;
            // Cross extensions: one field on each side of each gravity field
            if (r === 0 && c >= mid - 1 && c <= mid + 1) board[r][c].isActive = true;
            if (r === last && c >= mid - 1 && c <= mid + 1) board[r][c].isActive = true;
            if (c === 0 && r >= mid - 1 && r <= mid + 1) board[r][c].isActive = true;
            if (c === last && r >= mid - 1 && r <= mid + 1) board[r][c].isActive = true;
        }
    }

    // Set direction fields
    DIRECTION_FIELDS.forEach(({ row, col, dir }) => {
        board[row][col].directionField = dir;
    });

    // Place starting stones
    placeStartingStones();

    turnIndex = 0;
    eliminated = {};
    currentPlayer = activeColors()[0]; // white
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    lastPushedStone = null;
    lastMovedStonePos = null;
    gravityOptions = [];
    pushDir = {};
    aiRecentMoves = [];
    aiLastMovedStone = null;
    aiConsecutiveMoveCount = 0;

    drawBoard();
    updateStatus();
    updateStoneCounts();
    updateStoneCounts();
    hideMessage();
    hideGameOverModal();

    // 3D Sync
    if (window.is3DView && typeof sync3D === 'function') {
        sync3D();
    }
}

function showGameOverModal(title, text, winner = null) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    
    if (winner && modalWinnerIcon) {
        modalWinnerIcon.className = `winner-icon ${winner}`;
    }
    
    gameOverModal.classList.remove('hidden');
    // Trigger reflow to enable transition
    void gameOverModal.offsetWidth;
    gameOverModal.classList.add('visible');
    
    // In game over, ensure we sync 3D one last time
    if (window.is3DView && typeof sync3D === 'function') sync3D();
}

function hideGameOverModal() {
    gameOverModal.classList.remove('visible');
    setTimeout(() => {
        gameOverModal.classList.add('hidden');
    }, 300);
}

function placeStartingStones() {
    if (numPlayers === 4) { placeStartingStones4(); return; }
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

// 4-player: 10 stones per player in a triangular cluster in each corner of the 11x11 core.
// Clockwise (matching Pyramid): white TL, red TR, black BR, blue BL.
function placeStartingStones4() {
    const lo = 1;               // inner core edge
    const hi = BOARD_SIZE - 2;   // outer core edge (11 on a 13-grid)
    // Place a 4+3+2+1 triangle anchored at a corner, growing inward by drSign/dcSign.
    const placeCorner = (color, cornerR, cornerC, drSign, dcSign) => {
        for (let i = 0; i < 4; i++) {            // row away from corner
            for (let j = 0; j < 4 - i; j++) {     // shrinking width
                board[cornerR + i * drSign][cornerC + j * dcSign].piece = color;
            }
        }
    };
    placeCorner('white', lo, lo, +1, +1); // top-left
    placeCorner('red', lo, hi, +1, -1);   // top-right
    placeCorner('black', hi, hi, -1, -1); // bottom-right
    placeCorner('blue', hi, lo, -1, +1);  // bottom-left
}

// ============================================
// RENDERING
// ============================================

function drawBoard() {
    boardElement.innerHTML = '';

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = `cell ${(r + c) % 2 === 0 ? 'cell-light' : 'cell-dark'}`;
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

    // 3D View Update
    if (window.is3DView && typeof update3DViews === 'function') {
        update3DViews();
    }
}

function updateStatus(message = null) {
    const COLOR_HEX = { white: '#ffffff', black: '#1a1a1a', red: '#c0392b', blue: '#2a6fdb' };
    playerColorElement.style.backgroundColor = COLOR_HEX[currentPlayer] || '#1a1a1a';
    playerColorElement.style.borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffffff';

    if (gameState === 'GAME_OVER') return;

    if (message) {
        statusElement.textContent = message;
        // Also show in floating message box if 3D
        if (window.is3DView) showMessage(message);
    } else {
        const playerName = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
        const statusText = gameState === 'SELECT_STONE' 
            ? `${playerName} to move. Select a stone to move.`
            : `${playerName} selected. Choose where to move (green highlights).`;
            
        statusElement.textContent = statusText;
        
        // Update Side Menu
        const menuPlayerName = document.getElementById('player-name');
        const menuPlayerIndicator = document.getElementById('player-indicator');
        if (menuPlayerName) menuPlayerName.textContent = `${playerName}'s Turn`;
        if (menuPlayerIndicator) {
            menuPlayerIndicator.className = `count-stone ${currentPlayer}`;
        }
    }
}

function countStones() {
    const counts = { white: 0, black: 0, red: 0, blue: 0 };
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c].piece;
            if (p) counts[p]++;
        }
    }
    return counts;
}

function updateStoneCounts() {
    const counts = countStones();

    if (whiteCountElement) whiteCountElement.textContent = counts.white;
    if (blackCountElement) blackCountElement.textContent = counts.black;
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('white-count-menu', counts.white);
    setText('black-count-menu', counts.black);
    setText('red-count', counts.red);
    setText('blue-count', counts.blue);
    setText('red-count-menu', counts.red);
    setText('blue-count-menu', counts.blue);

    if (numPlayers === 4) {
        // A player is eliminated below 4 stones; last standing wins.
        PLAYERS_4.forEach(c => { if (counts[c] < 4) eliminated[c] = true; });
        const alive = PLAYERS_4.filter(c => !eliminated[c]);
        if (alive.length <= 1 && gameState !== 'GAME_OVER') {
            gameState = 'GAME_OVER';
            if (alive.length === 1) {
                const name = alive[0].charAt(0).toUpperCase() + alive[0].slice(1);
                updateStatus(`Game Over! ${name} wins!`);
                showGameOverModal(`${name} Wins!`, `${name} is the last player with 4+ stones.`, alive[0]);
            } else {
                updateStatus('Game Over! Draw.');
                showGameOverModal('Draw!', 'No player has 4 or more stones left.', null);
            }
        }
        return;
    }

    // 2-player win condition
    if (counts.white < 4) {
        gameState = 'GAME_OVER';
        updateStatus('Game Over! Black wins!');
        showGameOverModal('Black Wins!', 'Black wins! White has fewer than 4 stones.', 'black');
    } else if (counts.black < 4) {
        gameState = 'GAME_OVER';
        updateStatus('Game Over! White wins!');
        showGameOverModal('White Wins!', 'White wins! Black has fewer than 4 stones.', 'white');
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
        const cancelMenu = document.getElementById('cancel-button-menu');
        if (cancelMenu) cancelMenu.classList.remove('hidden');
    } else {
        cancelButton.classList.add('hidden');
        const cancelMenu = document.getElementById('cancel-button-menu');
        if (cancelMenu) cancelMenu.classList.add('hidden');
    }
}

function handleCancelMove() {
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    drawBoard();
    updateStatus();
    updateUI();
}

function toggleOpponent() {
    isVsComputer = !isVsComputer;
    const text = `Opponent: ${isVsComputer ? 'CPU' : 'Human'}`;
    opponentButton.textContent = text;
    const opponentMenu = document.getElementById('opponent-btn-menu');
    if (opponentMenu) opponentMenu.textContent = text;

    if (isAITurn() && gameState === 'SELECT_STONE') {
        setTimeout(makeAIMove, 500);
    }
}

// Switch player count (2 or 4): reconfigure board + restart, and rebuild the 3D scene.
function setNumPlayers(n) {
    if (n !== 2 && n !== 4) return;
    numPlayers = n;
    initializeBoard();
    if (window.is3DView && typeof rebuild3DBoard === 'function') rebuild3DBoard();
    if (isAITurn() && gameState === 'SELECT_STONE') setTimeout(makeAIMove, 500);
}
window.setNumPlayers = setNumPlayers;

// Export for menu
window.handleCancelMove = handleCancelMove;
window.toggleOpponent = toggleOpponent;
window.initializeBoard = initializeBoard;

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
                // 1) Can't immediately re-push the very stone you just pushed.
                const isJustPushed = lastPushedStone && lastPushedStone.row === adjR && lastPushedStone.col === adjC;
                // 2) Can't push a stone back the opposite way it was last pushed (anti ping-pong).
                const prevDir = pushDir[`${adjR},${adjC}`];
                const wouldPushBack = prevDir && OPPOSITE[prevDir] === dirName(dr, dc);

                if (!isJustPushed && !wouldPushBack) {
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
        // A voluntary run clears any push-direction memory for this stone
        delete pushDir[`${selectedStone.row},${selectedStone.col}`];
        delete pushDir[`${move.row},${move.col}`];

        // Redraw to snap stone to grid
        drawBoard();

        // Check if landed on direction field
        if (board[move.row][move.col].directionField) {
            newlyActivatedDir = board[move.row][move.col].directionField;
        }

        lastMovedStonePos = { row: move.row, col: move.col };

        // 3D Animation
        if (window.is3DView && typeof animate3DMove === 'function') {
            await animate3DMove(selectedStone.row, selectedStone.col, move.row, move.col);
        }
    } else if (move.type === 'push') {
        // Animate both the pushed stone and the pushing stone
        const pushedPiece = board[move.row][move.col].piece;

        // 3D Animation (Push)
        if (window.is3DView && typeof animate3DMove === 'function') {
            // Simultaneous push in 3D is handled by calling two animations if we want,
            // or we just call them sequentially. animateGravityShift handles multiple.
            // For a single push, let's just do them.
            await Promise.all([
                animate3DMove(move.row, move.col, move.pushTo.row, move.pushTo.col),
                animate3DMove(selectedStone.row, selectedStone.col, move.row, move.col)
            ]);
        } else {
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
        }

        // Apply push movement to board
        board[move.pushTo.row][move.pushTo.col].piece = pushedPiece;
        board[move.row][move.col].piece = board[selectedStone.row][selectedStone.col].piece;
        board[selectedStone.row][selectedStone.col].piece = null;

        // Record the direction the victim was pushed, so it can't be shoved straight back.
        const pd = dirName(move.pushTo.row - move.row, move.pushTo.col - move.col);
        delete pushDir[`${selectedStone.row},${selectedStone.col}`];
        delete pushDir[`${move.row},${move.col}`]; // pushing stone moved here voluntarily
        if (pd) pushDir[`${move.pushTo.row},${move.pushTo.col}`] = pd;

        // Redraw to snap stones to grid
        drawBoard();

        // Record pushed stone to prevent immediate push-back
        lastPushedStone = { row: move.pushTo.row, col: move.pushTo.col };

        // Check if either stone landed on a direction field to set prioritizing
        if (board[move.pushTo.row][move.pushTo.col].directionField) {
            newlyActivatedDir = board[move.pushTo.row][move.pushTo.col].directionField;
        } else if (board[move.row][move.col].directionField) {
            newlyActivatedDir = board[move.row][move.col].directionField;
        }

        lastMovedStonePos = { row: move.row, col: move.col };
    }

    // Track AI consecutive moves with the same stone (across turns)
    if (isAITurn()) {
        if (aiLastMovedStone &&
            aiLastMovedStone.row === selectedStone.row &&
            aiLastMovedStone.col === selectedStone.col) {
            aiConsecutiveMoveCount++;
        } else {
            aiConsecutiveMoveCount = 1;
        }
        // Update to the NEW position for the next turn's check
        aiLastMovedStone = { row: move.row, col: move.col };
    } else {
        aiLastMovedStone = null;
        aiConsecutiveMoveCount = 0;
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

    // 3. Priority: If we just activated a field, it goes first, then others follow automatically
    if (prioritizedDir && effectiveDirections.includes(prioritizedDir)) {
        // Tilt the prioritized field first
        await tiltBoard(prioritizedDir);
        
        // Tilt any remaining active fields sequentially
        const remaining = effectiveDirections.filter(d => d !== prioritizedDir);
        for (const dir of remaining) {
            await tiltBoard(dir);
        }
        
        checkAndRemoveHades();
        endTurn();
        return;
    }

    // 4. Handle remaining cases (No prioritized field activated)
    if (effectiveDirections.length === 1) {
        await tiltBoard(effectiveDirections[0]);
        checkAndRemoveHades();
        endTurn();
    } else if (effectiveDirections.length === 2) {
        // DIAGONAL SLIDE
        // Perpendicular directions (e.g., Up + Right) combine into a diagonal move
        const combo = effectiveDirections.join('_');
        await tiltBoard(combo);
        checkAndRemoveHades();
        endTurn();
    } else {
        checkAndRemoveHades();
        endTurn();
    }
}

// Helper to simulate tilt for just one stone (to show destination)
function simulateSingleStoneTilt(row, col, direction) {
    let dr = 0, dc = 0;
    if (direction === 'up') dr = -1;
    if (direction === 'down') dr = 1;
    if (direction === 'left') dc = -1;
    if (direction === 'right') dc = 1;

    const moves = [];
    let r = row;
    let c = col;
    
    // We need to account for other stones! 
    // This is a simplified simulation for visual hint.
    while (true) {
        let nextR = r + dr;
        let nextC = c + dc;
        if (isInBounds(nextR, nextC) && !board[nextR][nextC].piece) {
            moves.push({ from: {row: r, col: c}, to: {row: nextR, col: nextC} });
            r = nextR;
            c = nextC;
        } else {
            break;
        }
    }
    return moves;
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

        // Gravity reshuffles the board — clear push-direction memory
        pushDir = {};

        // 3D Animation
        if (window.is3DView && typeof animateGravityShift === 'function') {
            await animateGravityShift(direction, moves);
        } else {
            await animateMoves(moves);
        }
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
    if (direction.includes('up')) dr = -1;
    if (direction.includes('down')) dr = 1;
    if (direction.includes('left')) dc = -1;
    if (direction.includes('right')) dc = 1;

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
        
        // 3D Sync for removed stones
        if (window.is3DView && typeof sync3D === 'function') {
            sync3D();
        }
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

function isAITurn() {
    if (!isVsComputer || gameState === 'GAME_OVER') return false;
    return numPlayers === 4 ? currentPlayer !== 'white' : currentPlayer === 'black';
}

function advancePlayer() {
    const order = activeColors();
    if (numPlayers === 4) {
        // Next non-eliminated player, clockwise
        for (let i = 0; i < order.length; i++) {
            turnIndex = (turnIndex + 1) % order.length;
            if (!eliminated[order[turnIndex]]) break;
        }
        currentPlayer = order[turnIndex];
    } else {
        currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    }
}

function endTurn() {
    if (gameState === 'GAME_OVER') return;
    selectedStone = null;
    validMoves = [];
    advancePlayer();
    gameState = 'SELECT_STONE';
    drawBoard();
    updateStatus();
    updateStoneCounts();
    updateUI();

    // Final 3D sync for turn
    if (window.is3DView && typeof sync3D === 'function') {
        sync3D();
    }

    if (isAITurn()) {
        setTimeout(makeAIMove, 600);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

resetButton.addEventListener('click', initializeBoard);
cancelButton.addEventListener('click', cancelMove);
opponentButton.addEventListener('click', () => {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = isVsComputer ? 'Opponent: Computer' : 'Opponent: Human';
    if (isAITurn() && gameState === 'SELECT_STONE') {
        setTimeout(makeAIMove, 600);
    }
});

// Modal Actions
if (newGameBtnModal) newGameBtnModal.addEventListener('click', initializeBoard);
if (menuBtnModal) menuBtnModal.addEventListener('click', () => window.location.href = 'index.html');
if (modalOverlay) modalOverlay.addEventListener('click', hideGameOverModal);


// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    if (gameState !== 'SELECT_STONE' || !isAITurn()) return;

    const me = currentPlayer;
    const mid = Math.floor(BOARD_SIZE / 2);

    // Colossus AI (Medium heuristic)
    // 1. Gather all possible moves for all of the current player's stones
    let allMoves = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].piece === me) {
                const runs = calculateRunMoves(r, c);
                const pushes = calculatePushMoves(r, c);

                runs.forEach(m => allMoves.push({ stone: { r, c }, move: m }));
                pushes.forEach(m => allMoves.push({ stone: { r, c }, move: m }));
            }
        }
    }

    if (allMoves.length === 0) {
        // No moves? End turn (Colossus rules may not cover passing, but fallback)
        endTurn();
        return;
    }

    let bestAction = null;
    let bestScore = -Infinity;

    // Helper: evaluate based on immediate targets without deep Hades simulation
    allMoves.forEach(action => {
        let score = 0;
        const mr = action.move.row; const mc = action.move.col;

        if (action.move.type === 'push') {
            const pushedType = board[mr][mc].piece;
            if (pushedType && pushedType !== me) score += 50; // good to push an opponent
            else score -= 10; // try not to push own stones unnecessarily

            const targetR = action.move.pushTo.row;
            const targetC = action.move.pushTo.col;
            if (board[targetR][targetC].directionField) {
                // pushing onto a direction field triggers tilt
                score += 30;
            }
        }

        if (board[mr][mc].directionField) {
            // landing on direction field triggers tilt
            score += 25;
        }

        // prefer central positions (away from edges)
        const distFromCenter = Math.abs(mr - mid) + Math.abs(mc - mid);
        score += (8 - distFromCenter) * 2;

        // Loop Prevention: Penalize moving the same stone too many times in a row
        if (aiLastMovedStone &&
            aiLastMovedStone.row === action.stone.r &&
            aiLastMovedStone.col === action.stone.c) {
            if (aiConsecutiveMoveCount >= 2) score -= 300;
            else if (aiConsecutiveMoveCount >= 1) score -= 50;
        }

        // Add random variation
        score += Math.random() * 12;

        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }
    });

    const sigOf = a => `${a.stone.r},${a.stone.c}->${a.move.row},${a.move.col}`;

    // Stuck/ping-pong breaker: if the best move repeats a recent one, pick a random move instead.
    if (bestAction && aiRecentMoves.includes(sigOf(bestAction)) && allMoves.length > 1) {
        const alternatives = allMoves.filter(a => !aiRecentMoves.includes(sigOf(a)));
        const pool = alternatives.length > 0 ? alternatives : allMoves;
        bestAction = pool[Math.floor(Math.random() * pool.length)];
    }

    if (bestAction) {
        aiRecentMoves.push(sigOf(bestAction));
        if (aiRecentMoves.length > 8) aiRecentMoves.shift();

        handleCellClick(bestAction.stone.r, bestAction.stone.c).then(() => {
            setTimeout(() => {
                handleCellClick(bestAction.move.row, bestAction.move.col);
            }, 300);
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', initializeBoard);
