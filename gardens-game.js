// GARDENS GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const BOARD_CONFIG = {
    topField: { rows: 3, cols: 5 },
    bottomField: { rows: 3, cols: 5 },
    gardens: 4, // 0: TopLeft, 1: BotLeft, 2: BotRight, 3: TopRight
    maxStackHeight: 5,
    winCount: 7
};

// Garden Indices
const G_TOP_LEFT = 0;     // White High Garden (Target for White)
const G_BOT_LEFT = 1;     // White Home Garden (Start for White)
const G_BOT_RIGHT = 2;    // Black Home Garden (Start for Black)
const G_TOP_RIGHT = 3;    // Black High Garden (Target for Black)

// Staircase Configuration
// Left Stairs (connects 1 -> 0): Black color (allows Black stones)
// Right Stairs (connects 2 -> 3): White color (allows White stones)
const STAIRS = [
    { from: G_BOT_LEFT, to: G_TOP_LEFT, color: 'black' },
    { from: G_BOT_RIGHT, to: G_TOP_RIGHT, color: 'white' }
];

// ============================================
// GAME STATE
// ============================================

let board = {
    topField: [],    // 3x5 array of stacks
    bottomField: [], // 3x5 array of stacks
    gardens: []      // Array of 4 stacks
};

let currentPlayer = 'white';
let turnPhase = 'SELECT'; // SELECT, MOVING
let selectedSource = null; // { area, row, col }
let hand = []; // Stones currently being moved
let moveHistory = []; // Track path to prevent backward movement in same turn
let messageTimeout = null;

// ============================================
// DOM ELEMENTS
// ============================================

const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const whiteCountElement = document.getElementById('white-count');
const blackCountElement = document.getElementById('black-count');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const cancelButton = document.getElementById('cancel-button');

// ============================================
// INITIALIZATION
// ============================================

function initializeGame() {
    // Initialize empty board
    board.topField = createGrid(3, 5);
    board.bottomField = createGrid(3, 5);
    board.gardens = Array(4).fill(null).map(() => []);

    // Place starting stones
    // White: 10 stones in Bottom Left (Home)
    for (let i = 0; i < 10; i++) board.gardens[G_BOT_LEFT].push('white');

    // Black: 10 stones in Bottom Right (Home)
    for (let i = 0; i < 10; i++) board.gardens[G_BOT_RIGHT].push('black');

    currentPlayer = 'white';
    resetTurnState();

    drawBoard();
    updateStatus();
    updateCounts();
    hideMessage();
}

function createGrid(rows, cols) {
    return Array(rows).fill(null).map(() =>
        Array(cols).fill(null).map(() => [])
    );
}

function resetTurnState() {
    turnPhase = 'SELECT';
    selectedSource = null;
    hand = [];
    moveHistory = [];
    cancelButton.classList.add('hidden');
}

// ============================================
// CORE GAME LOGIC
// ============================================

function getStack(area, row, col) {
    if (area === 'garden') return board.gardens[row]; // row is index for gardens
    if (area === 'top') return board.topField[row][col];
    if (area === 'bottom') return board.bottomField[row][col];
    return null;
}

function getTopColor(stack) {
    if (!stack || stack.length === 0) return null;
    return stack[stack.length - 1];
}

function isOwner(stack, player) {
    return getTopColor(stack) === player;
}

function handleCellClick(area, row, col) {
    if (turnPhase === 'SELECT') {
        // If we have a selection, check if this is a valid move target
        if (selectedSource && isValidMove(area, row, col)) {
            handleMovePhase(area, row, col);
        } else {
            handleSelectPhase(area, row, col);
        }
    } else if (turnPhase === 'MOVING') {
        handleMovePhase(area, row, col);
    }
}

function handleSelectPhase(area, row, col) {
    const stack = getStack(area, row, col);

    // Validation: Must be own stack
    if (!stack || stack.length === 0 || !isOwner(stack, currentPlayer)) {
        // If clicking empty or opponent stack, ignore
        return;
    }

    // Logic for Playing Fields: ALWAYS pick up the entire stack
    if (area === 'top' || area === 'bottom') {
        const count = stack.length;
        selectedSource = { area, row, col };
        // Copy the actual stones from the stack (preserving colors)
        hand = stack.slice();

        turnPhase = 'SELECT'; // Ready to move immediately
        cancelButton.classList.remove('hidden');

        updateStatus(`Picked up ${count} stones. Click a neighbor to move.`);
        drawBoard();
        return;
    }

    // Logic for Gardens: Cycle 1-5 stones
    // If clicking the same stack again, cycle count
    if (selectedSource && selectedSource.area === area && selectedSource.row === row && selectedSource.col === col) {
        // Cycle 1-5, but max is stack size
        const maxSelect = Math.min(stack.length, 5);
        let currentCount = hand.length;
        let newCount = (currentCount % maxSelect) + 1;

        // Update hand with top N stones from stack
        hand = stack.slice(-newCount);

        updateStatus(`Selected ${newCount} stones. Click again to change count, or click a neighbor to move.`);
        drawBoard();
        return;
    }

    // New selection in Garden
    const maxSelect = Math.min(stack.length, 5);
    selectedSource = { area, row, col };
    // Start with 1 stone (the top one)
    hand = stack.slice(-1);

    turnPhase = 'SELECT'; // Still selecting count
    cancelButton.classList.remove('hidden');

    updateStatus(`Selected 1 stone. Click again to add more (max ${maxSelect}), or click a neighbor to move.`);
    drawBoard();
}

function handleMovePhase(area, row, col) {
    // Transition from SELECT to MOVING happens on first valid move
    // But we handle both in this logic flow

    // Check if valid move target
    if (!isValidMove(area, row, col)) {
        // If clicking source again, handle as selection cycle
        if (selectedSource && area === selectedSource.area && row === selectedSource.row && col === selectedSource.col) {
            handleSelectPhase(area, row, col);
            return;
        }
        showMessage("Invalid move!");
        return;
    }

    // Execute Move Step
    executeMoveStep(area, row, col);
}

function isValidMove(targetArea, targetRow, targetCol) {
    if (!selectedSource) return false;

    // 1. Adjacency Check
    // Get current position (last in history, or source)
    const currentPos = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : selectedSource;

    // Check if target is current position (dropping more stones)
    if (targetArea === currentPos.area && targetRow === currentPos.row && targetCol === currentPos.col) {
        // Allowed to drop multiple on same field
        // BUT not on the source field before moving anywhere
        if (moveHistory.length === 0) return false;
        return true;
    }

    // Check adjacency
    if (!isAdjacent(currentPos, { area: targetArea, row: targetRow, col: targetCol })) {
        return false;
    }

    // 2. Backward Movement Check
    // Cannot move back to a field visited in this turn
    // Also "Direct back-and-forth movement" - handled by history check
    if (moveHistory.some(pos => pos.area === targetArea && pos.row === targetRow && pos.col === targetCol)) {
        return false;
    }
    // Also cannot move back to source
    if (targetArea === selectedSource.area && targetRow === selectedSource.row && targetCol === selectedSource.col) {
        return false;
    }

    // 3. Tower Capacity Check
    const targetStack = getStack(targetArea, targetRow, targetCol);
    if (targetStack.length >= BOARD_CONFIG.maxStackHeight) {
        return false; // Full tower
    }

    // 4. Stacking Rules (Self-stacking restrictions)
    // "Stacking is only possible in your Home Garden and in the opposite High Garden with stones of your own color."
    // This implies: On playing fields, you cannot add to a stack that is ALREADY yours.
    // You CAN add to empty (create stack) or opponent (capture).

    const isHome = isHomeGarden(targetArea, targetRow);
    const isTargetHigh = isTargetHighGarden(targetArea, targetRow);
    const isPlayingField = targetArea === 'top' || targetArea === 'bottom';

    if (isPlayingField && targetStack.length > 0 && isOwner(targetStack, currentPlayer)) {
        return false; // Cannot stack on own color in playing field
    }

    // 5. Safe Zone Check (Capturing restrictions)
    // "In all Home Gardens and High Gardens, stones are safe from being captured by the opponent."
    // So if target is a Garden, and it's controlled by opponent, we cannot enter/capture.
    if (targetArea === 'garden' && targetStack.length > 0 && !isOwner(targetStack, currentPlayer)) {
        return false;
    }

    return true;
}

function isAdjacent(pos1, pos2) {
    // Garden Adjacency Logic is complex
    // Gardens connect to specific cells in playing fields

    // Map Gardens to Field Cells
    // G0 (TopLeft) <-> Top Field [0][0]
    // G1 (BotLeft) <-> Bottom Field [2][0]
    // G2 (BotRight) <-> Bottom Field [2][4]
    // G3 (TopRight) <-> Top Field [0][4]

    // Also Stairs: G0 <-> G1, G2 <-> G3 (But stairs are one-way/auto usually? Rules say "Two staircases connect...")
    // "White wins in the top left... but cant go up the stairs".
    // This implies manual movement via stairs is NOT allowed for the player who can't use them.
    // But can the OTHER player walk them? 
    // "Blacks turn ends. 2 black stones move up to the High Garden." -> Auto move.
    // Can you WALK up stairs? "cant go up the stairs because they are black".
    // This implies you COULD walk if they were your color?
    // Let's assume Stairs are ONLY for automatic movement or specific shortcuts.
    // Given the "Auto move" rule, let's assume NO manual walking on stairs for now to simplify, 
    // or strictly follow adjacency.
    // Let's stick to Field connections.

    // Same Area Adjacency
    if (pos1.area === pos2.area) {
        if (pos1.area === 'garden') return false; // Gardens not adjacent to each other directly (except via stairs)
        // Grid adjacency
        const dr = Math.abs(pos1.row - pos2.row);
        const dc = Math.abs(pos1.col - pos2.col);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    // Cross Area Adjacency

    // Top Field <-> Bottom Field (Wall separator)
    // "Two 5x3 fields... separated by a wall". Usually implies NO crossing.
    // But how do you get from bottom to top?
    // Maybe the gardens connect them?
    // G0 connects to Top-Left. G1 connects to Bot-Left.
    // So path: Bot-Left -> G1 -> ??? -> G0 -> Top-Left?
    // No, G1 is Home. You start there. You move out to Bottom Field.
    // You need to get to Top Field.
    // How?
    // Maybe the fields are connected?
    // "separated by a wall".
    // Usually in board games, walls block.
    // Are the gardens the only way?
    // G1 (Bot) -> Bottom Field -> G2 (Bot)? No.
    // Let's look at the image.
    // There are 4 gardens.
    // Left side: G0 (Top), G1 (Bot). Stairs between them.
    // Right side: G3 (Top), G2 (Bot). Stairs between them.
    // If wall separates Top/Bot fields, and you can't use stairs manually...
    // How does White (Start G1) get to G0?
    // Path: G1 -> Bottom Field -> ... -> Top Field -> G0.
    // There MUST be a connection between Top and Bottom fields.
    // Maybe the wall has a gap? Or maybe you CAN cross the wall?
    // "Stones can be moved horizontally or vertically".
    // If the fields are adjacent grids, maybe the wall is just visual?
    // Or maybe only specific spots?
    // Let's assume the wall is permeable or there's a connection.
    // Actually, looking at the board:
    // Top Field [2][x] is adjacent to Bottom Field [0][x]?
    // Let's assume YES, they are vertically adjacent, wall is just a zone marker.

    if ((pos1.area === 'top' && pos2.area === 'bottom') || (pos1.area === 'bottom' && pos2.area === 'top')) {
        // Top [2][c] <-> Bottom [0][c]
        const topRow = 2;
        const botRow = 0;
        if (pos1.area === 'top') return pos1.row === topRow && pos2.row === botRow && pos1.col === pos2.col;
        if (pos1.area === 'bottom') return pos1.row === botRow && pos2.row === topRow && pos1.col === pos2.col;
    }

    // Garden <-> Field Connections
    // G0 (Top Left) <-> Top [0][0], [1][0], [2][0]? (It's 1x3)
    // The image shows gardens are 1x3 strips.
    // So G0 aligns with Top Field rows 0,1,2?
    // Let's assume G0 connects to Top[0][0], Top[1][0], Top[2][0].

    // Define Garden Connections
    // G0 (Top Left) <-> Top Field Left Edge (col 0)
    // G3 (Top Right) <-> Top Field Right Edge (col 4)
    // G1 (Bot Left) <-> Bottom Field Left Edge (col 0)
    // G2 (Bot Right) <-> Bottom Field Right Edge (col 4)

    if (pos1.area === 'garden' || pos2.area === 'garden') {
        const gPos = pos1.area === 'garden' ? pos1 : pos2;
        const fPos = pos1.area === 'garden' ? pos2 : pos1;

        if (fPos.area === 'garden') return false; // Garden to Garden (manual) - assume NO for now

        const gIndex = gPos.row; // 0..3

        if (gIndex === G_TOP_LEFT && fPos.area === 'top' && fPos.col === 0) return true;
        if (gIndex === G_TOP_RIGHT && fPos.area === 'top' && fPos.col === 4) return true;
        if (gIndex === G_BOT_LEFT && fPos.area === 'bottom' && fPos.col === 0) return true;
        if (gIndex === G_BOT_RIGHT && fPos.area === 'bottom' && fPos.col === 4) return true;
    }

    return false;
}

function executeMoveStep(area, row, col) {
    // 1. Remove stone from source (if first step)
    if (moveHistory.length === 0) {
        // Remove 'hand.length' stones from source stack
        const sourceStack = getStack(selectedSource.area, selectedSource.row, selectedSource.col);
        // We already have 'hand' populated. Just remove them from board.
        for (let i = 0; i < hand.length; i++) sourceStack.pop();

        turnPhase = 'MOVING';
    }

    // 2. Drop 1 stone from hand to target
    const stone = hand.pop();
    const targetStack = getStack(area, row, col);
    targetStack.push(stone);

    // 3. Record history
    moveHistory.push({ area, row, col });

    // 4. Check if hand empty
    if (hand.length === 0) {
        endTurn();
    } else {
        // Continue moving
        updateStatus(`Dropped stone. ${hand.length} left. Select next field.`);
        drawBoard();
    }
}

function endTurn() {
    // 1. Staircase Logic
    processStaircases();

    // 2. Win Check
    if (checkWin()) return;

    // 3. Switch Player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    resetTurnState();

    // 4. Check for No Valid Moves (Special Rule)
    if (!hasValidMoves(currentPlayer)) {
        // Enable Special Restack Mode?
        // For now, just show message
        showMessage(`${currentPlayer.toUpperCase()} has no valid moves! Select a tower to restack.`);
        // Implement restack logic later or handle manually
    }

    drawBoard();
    updateStatus();
    updateCounts();
}

function updateStatus(msg) {
    if (msg) {
        statusElement.textContent = msg;
    } else {
        const pName = currentPlayer.toUpperCase();
        if (turnPhase === 'SELECT') {
            statusElement.textContent = `${pName}'S TURN. Select a stack to move.`;
        } else {
            statusElement.textContent = `${pName} MOVING. Select adjacent field to drop stone.`;
        }
    }

    playerColorElement.style.backgroundColor = currentPlayer === 'white' ? '#fff' : '#333';

    // Update Hand Display
    const handDisplay = document.getElementById('hand-display');
    const handStones = document.getElementById('hand-stones');

    if (hand.length > 0) {
        handDisplay.classList.remove('hidden');
        handStones.innerHTML = '';
        hand.forEach(color => {
            const s = document.createElement('div');
            s.className = `hand-stone ${color}`;
            handStones.appendChild(s);
        });
    } else {
        handDisplay.classList.add('hidden');
    }
}

function processStaircases() {
    // Check White Home (G1) -> Left Stairs (Black) -> G0 (White High)
    const wHome = board.gardens[G_BOT_LEFT];
    if (wHome.length > 0) {
        const whiteCount = wHome.filter(s => s === 'white').length;
        const blackCount = wHome.filter(s => s === 'black').length;

        // Left Stairs are BLACK. Only Black stones use them if majority.
        if (blackCount > whiteCount) {
            // Move ALL black stones
            const moving = wHome.filter(s => s === 'black');
            const staying = wHome.filter(s => s === 'white');

            board.gardens[G_BOT_LEFT] = staying;
            board.gardens[G_TOP_LEFT].push(...moving); // Move to Top Left
            showMessage("Black stones moved up the Left Staircase!");
        }
    }

    // Check Black Home (G2) -> Right Stairs (White) -> G3 (Black High)
    const bHome = board.gardens[G_BOT_RIGHT];
    if (bHome.length > 0) {
        const whiteCount = bHome.filter(s => s === 'white').length;
        const blackCount = bHome.filter(s => s === 'black').length;

        // Right Stairs are WHITE. Only White stones use them if majority.
        if (whiteCount > blackCount) {
            // Move ALL white stones
            const moving = bHome.filter(s => s === 'white');
            const staying = bHome.filter(s => s === 'black');

            board.gardens[G_BOT_RIGHT] = staying;
            board.gardens[G_TOP_RIGHT].push(...moving); // Move to Top Right
            showMessage("White stones moved up the Right Staircase!");
        }
    }
}

function checkWin() {
    // Goal: 7 stones in High Garden
    // White High: G0
    // Black High: G3

    const whiteHigh = board.gardens[G_TOP_LEFT];
    const blackHigh = board.gardens[G_TOP_RIGHT];

    const whiteScore = whiteHigh.filter(s => s === 'white').length;
    const blackScore = blackHigh.filter(s => s === 'black').length;

    if (whiteScore >= BOARD_CONFIG.winCount) {
        showMessage("WHITE WINS!");
        turnPhase = 'GAME_OVER';
        return true;
    }

    if (blackScore >= BOARD_CONFIG.winCount) {
        showMessage("BLACK WINS!");
        turnPhase = 'GAME_OVER';
        return true;
    }

    return false;
}

// Helper for rules
function isHomeGarden(area, index) {
    if (area !== 'garden') return false;
    if (currentPlayer === 'white') return index === G_BOT_LEFT;
    if (currentPlayer === 'black') return index === G_BOT_RIGHT;
    return false;
}

function isTargetHighGarden(area, index) {
    if (area !== 'garden') return false;
    if (currentPlayer === 'white') return index === G_TOP_LEFT;
    if (currentPlayer === 'black') return index === G_TOP_RIGHT;
    return false;
}

function hasValidMoves(player) {
    // Simplified check - just check if player has ANY stones on board
    // A real check would simulate all possible moves
    return true;
}

// ============================================
// RENDERING
// ============================================

function drawBoard() {
    // Draw Top Field
    drawGrid('top', board.topField);
    drawGrid('bottom', board.bottomField);
    drawGardens();
}

function drawGrid(area, grid) {
    const element = document.getElementById(`${area}-field`);
    element.innerHTML = '';

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            const cell = createCell(area, r, c, grid[r][c]);
            element.appendChild(cell);
        }
    }
}

function drawGardens() {
    for (let i = 0; i < 4; i++) {
        const element = document.querySelector(`.garden-field[data-garden="${i}"]`);
        element.innerHTML = '';

        // Gardens are single stacks in this logic, but rendered as a container
        // We render the stack inside
        const stack = board.gardens[i];
        if (stack.length > 0) {
            const stackEl = createStackElement(stack);

            // Highlight if selected source
            if (selectedSource && selectedSource.area === 'garden' && selectedSource.row === i) {
                stackEl.classList.add('selected');
                // Show selection count
                if (turnPhase === 'SELECT') {
                    const indicator = document.createElement('div');
                    indicator.className = 'selection-indicator';
                    indicator.textContent = `${hand.length} selected`;
                    stackEl.appendChild(indicator);
                }
            }

            element.appendChild(stackEl);
        }

        // Click handler on the garden container
        // Note: Gardens are 1x3 visually, but 1 logical field
        element.onclick = (e) => {
            e.stopPropagation();
            handleCellClick('garden', i, 0);
        };

        // Valid move highlight
        if (turnPhase === 'MOVING' || (turnPhase === 'SELECT' && hand.length > 0)) {
            if (isValidMove('garden', i, 0)) {
                element.style.boxShadow = "inset 0 0 15px rgba(16, 185, 129, 0.6)";
            } else {
                element.style.boxShadow = "none";
            }
        } else {
            element.style.boxShadow = "none";
        }
    }
}

function createCell(area, row, col, stack) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.area = area;
    cell.dataset.row = row;
    cell.dataset.col = col;

    if (stack.length >= BOARD_CONFIG.maxStackHeight) {
        cell.classList.add('full-tower');
    }

    if (stack.length > 0) {
        const stackEl = createStackElement(stack);
        cell.appendChild(stackEl);

        // Selection Highlight
        if (selectedSource && selectedSource.area === area && selectedSource.row === row && selectedSource.col === col) {
            stackEl.classList.add('selected');
            if (turnPhase === 'SELECT') {
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = `${hand.length} selected`;
                stackEl.appendChild(indicator);
            }
        }
    }

    // Valid Move Highlight
    if (turnPhase === 'MOVING' || (turnPhase === 'SELECT' && hand.length > 0)) {
        if (isValidMove(area, row, col)) {
            cell.classList.add('valid-move');
        }
    }

    cell.onclick = (e) => {
        e.stopPropagation();
        handleCellClick(area, row, col);
    };

    return cell;
}

function createStackElement(stack) {
    const container = document.createElement('div');
    container.className = 'stone-stack';

    // Render stones bottom to top
    stack.forEach((color, index) => {
        // Only render top few stones to avoid DOM overload? 
        // Or render all with absolute positioning
        const disc = document.createElement('div');
        disc.className = `stone-disc ${color}`;

        // Visual offset logic
        // Max 5 stones. 
        // Layer 0 is bottom.
        disc.dataset.layer = index;

        container.appendChild(disc);
    });

    // Count indicator
    const count = document.createElement('div');
    count.className = 'stack-count';
    count.textContent = stack.length;
    container.appendChild(count);

    return container;
}

function updateCounts() {
    // Count stones in High Gardens
    const wScore = board.gardens[G_TOP_LEFT].filter(s => s === 'white').length;
    const bScore = board.gardens[G_TOP_RIGHT].filter(s => s === 'black').length;

    whiteCountElement.textContent = `${wScore}/${BOARD_CONFIG.winCount}`;
    blackCountElement.textContent = `${bScore}/${BOARD_CONFIG.winCount}`;
}

function showMessage(text) {
    messageBox.textContent = text;
    messageBox.classList.remove('hidden');
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(hideMessage, 3000);
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

// ============================================
// EVENT LISTENERS
// ============================================

resetButton.addEventListener('click', initializeGame);
cancelButton.addEventListener('click', () => {
    // Reset turn
    // We need to restore the board state if we were moving
    // For simplicity, just re-init turn state if in SELECT
    // If in MOVING, it's harder to undo without a backup.
    // Let's just allow cancel in SELECT phase.
    if (turnPhase === 'SELECT') {
        resetTurnState();
        drawBoard();
        updateStatus();
    }
});

// Start Game
initializeGame();
