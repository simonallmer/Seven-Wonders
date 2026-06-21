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
let handFullWarningShown = false; // Track if "Hand Full" warning has been shown
let isVsComputer = true; // AI opponent flag

// Track AI behavior to prevent loops and freezes
let aiLastMovedStone = null; // {area, row, col}
let aiConsecutiveMoveCount = 0;
let aiActionTimeout = null; // Track setTimeout for execution
let isAiThinking = false;
let currentTurnId = 0; // Increment on every turn change

// ============================================
// DOM ELEMENTS
// ============================================

const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const whiteCountElement = document.getElementById('white-count');
const blackCountElement = document.getElementById('black-count');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const opponentButton = document.getElementById('opponent-btn');
const cancelButton = document.getElementById('cancel-button');
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');

// ============================================
// INITIALIZATION
// ============================================

function initializeGame() {
    // Clear any pending AI actions
    if (aiActionTimeout) {
        clearTimeout(aiActionTimeout);
        aiActionTimeout = null;
    }
    isAiThinking = false;
    currentTurnId++;

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
    handFullWarningShown = false;
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
    // STRICT LOCK: If it's the AI's turn, do not allow any human clicks to interfere
    if (isVsComputer && currentPlayer === 'black' && turnPhase !== 'GAME_OVER') {
        return;
    }

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

    // Validation: Must be own stack (for playing fields) OR contain own stones (for gardens)
    if (area === 'garden') {
        const myStones = stack.filter(s => s === currentPlayer);
        if (myStones.length === 0) return; // No stones of own color

        // RULE: Gardens are final once stones reach Goal. Stones cannot be moved OUT of Goal Gardens.
        if (isTargetHighGarden(area, row)) {
            showMessage("Stones in your Goal Garden are permanent!");
            return;
        }
    } else {
        // Playing fields: Must own the top of the stack UNLESS blocked (Emergency Lift Rule)
        if (!stack || stack.length === 0) return;

        const blocked = isPlayerBlocked(currentPlayer);
        if (blocked) {
            // Emergency Lift: Can select any stack containing own stones
            if (!stack.includes(currentPlayer)) return;
            showMessage("EMERGENCY LIFT: Buried stones moved to top!");
        } else {
            // NORMAL RULE: You MUST control the top of the stack to move it.
            if (getTopColor(stack) !== currentPlayer) {
                showMessage("You can only move stacks that you control (top stone)!");
                return;
            }
        }
    }

    // Logic for Playing Fields: ALWAYS pick up the entire stack
    if (area === 'top' || area === 'bottom') {
        selectedSource = { area, row, col };

        const blocked = isPlayerBlocked(currentPlayer);
        if (blocked) {
            // EMERGENCY LIFT MECHANIC: Pull all own stones to top
            // 1. Extract own stones
            const myStones = stack.filter(s => s === currentPlayer);
            const otherStones = stack.filter(s => s !== currentPlayer);
            // 2. Rebuild stack: others at bottom, mine at top
            stack.length = 0;
            stack.push(...otherStones, ...myStones);
        }

        const count = stack.length;
        // Copy the actual stones from the stack (preserving colors)
        hand = stack.slice();

        turnPhase = 'SELECT'; // Ready to move immediately
        cancelButton.classList.remove('hidden');

        updateStatus(`Picked up ${count} stones. Click a neighbor to move.`);
        drawBoard();
        return;
    }

    // Logic for Gardens: Cycle 1-5 stones (Separated by Color)
    // In Gardens, you can only select YOUR OWN stones, even if mixed.
    const myStones = stack.filter(s => s === currentPlayer);

    if (myStones.length === 0) return; // No stones of own color

    // If clicking the same stack again, cycle count
    if (selectedSource && selectedSource.area === area && selectedSource.row === row && selectedSource.col === col) {
        // Cycle 1-5, but max is available stones of own color
        const maxSelect = Math.min(myStones.length, 5);
        let currentCount = hand.length;

        // Check for "Hand Full" warning condition
        // AI Skip: Computer skips the warning to avoid selection loops
        const isAI = isVsComputer && currentPlayer === 'black';
        if (currentCount === 5 && !handFullWarningShown && !isAI) {
            handFullWarningShown = true;
            updateStatus(`Hand Full! Click again to reset to 1.`);
            return;
        }

        // Reset warning flag if we are moving past it (or if we weren't at 5)
        handFullWarningShown = false;

        let newCount = (currentCount % maxSelect) + 1;

        // Update hand with N stones of own color
        hand = Array(newCount).fill(currentPlayer);

        updateStatus(`Selected ${newCount} stones. Click again to change count, or click a neighbor to move.`);
        drawBoard();
        return;
    }

    // New selection in Garden
    const maxSelect = Math.min(myStones.length, 5);
    selectedSource = { area, row, col };
    // Start with 1 stone
    hand = [currentPlayer];
    handFullWarningShown = false;

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
        if (selectedSource && area === selectedSource.area && row === selectedSource.row && selectedSource.col === col) {
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
    // Gardens are exempt from max height check
    if (targetArea !== 'garden' && targetStack.length >= BOARD_CONFIG.maxStackHeight) {
        return false; // Full tower
    }

    // 4. Stacking Rules (Self-stacking restrictions)
    // "Stacking is only possible in your Home Garden and in the opposite High Garden with stones of your own color."
    // This implies: On playing fields, you cannot add to a stack that is ALREADY yours.
    // You CAN add to empty (create stack) or opponent (capture).

    const isHome = isHomeGarden(targetArea, targetRow);
    const isTargetHigh = isTargetHighGarden(targetArea, targetRow);
    const isPlayingField = targetArea === 'top' || targetArea === 'bottom';

    // GARDEN ENTRY PROTECTION
    if (targetArea === 'garden') {
        // 1. Never enter the opponent's GOAL garden.
        const oppGoal = currentPlayer === 'white' ? G_TOP_RIGHT : G_TOP_LEFT; // Corrected: White's opp goal is Black's goal, Black's opp goal is White's goal
        if (targetRow === oppGoal) return false;

        // 2. Only enter gardens that are your Home or your target Goal.
        // Or the opponent's home garden (dumping rule)
        const isOppositeHome = (currentPlayer === 'white' && targetRow === G_BOT_RIGHT) ||
            (currentPlayer === 'black' && targetRow === G_BOT_LEFT);

        if (!isHome && !isTargetHigh && !isOppositeHome) {
            return false;
        }
    }

    if (isPlayingField && targetStack.length > 0 && isOwner(targetStack, currentPlayer)) {
        // return false; // REMOVED: Allow stacking on own color in playing field
    }

    // 5. Safe Zone Check (Capturing restrictions)
    // "In all Home Gardens and High Gardens, stones are safe from being captured by the opponent."
    // EXCEPTION: You CAN enter the OPPOSITE Home Garden (to dump stones).
    // White can enter Black Home (G_BOT_RIGHT). Black can enter White Home (G_BOT_LEFT).

    const isOppositeHome = (currentPlayer === 'white' && targetArea === 'garden' && targetRow === G_BOT_RIGHT) ||
        (currentPlayer === 'black' && targetArea === 'garden' && targetRow === G_BOT_LEFT);

    // Allow entering if:
    // 1. It's empty
    // 2. We own the top stone
    // 3. It's our Home Garden (we can always stack there)
    // 4. It's our High Garden (we can always stack there)
    // 5. It's the Opposite Home Garden (dumping rule)

    if (targetArea === 'garden') {
        if (targetStack.length > 0 &&
            !isOwner(targetStack, currentPlayer) &&
            !isHome &&
            !isTargetHigh &&
            !isOppositeHome) {
            return false;
        }
    } else {
        // Playing fields
        // Allow stacking on anyone's tower as long as height < 5 (checked earlier)
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
    // G0 (Top) connects to Top-Left. G1 (Bot) connects to Bot-Left.
    // So path: Bot-Left -> G1 -> ??? -> G0 -> Top-Left?
    // No, G1 is Home. You start there. You move out to Bottom Field.
    // You need to get to Top Field.
    // How?
    // Maybe the fields are connected?
    // "separated by a wall".
    // Usually in board games, walls block.
    // Are the gardens the only way?
    // G1 (Bot) -> Bottom Field -> ... -> G2 (Bot)? No.
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
        // Wall separates them. No direct crossing.
        return false;
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
        const sourceStack = getStack(selectedSource.area, selectedSource.row, selectedSource.col);

        if (selectedSource.area === 'garden') {
            // Remove specific colored stones (Separated by Color logic)
            // We need to remove hand.length stones of currentPlayer color
            // We remove the top-most instances of that color to minimize visual disruption

            const toRemove = hand.length;
            const colorToRemove = currentPlayer;

            const newStack = [];
            let found = 0;
            // Iterate backwards to find top-most
            for (let i = sourceStack.length - 1; i >= 0; i--) {
                if (sourceStack[i] === colorToRemove && found < toRemove) {
                    found++;
                    // Remove this stone
                } else {
                    newStack.unshift(sourceStack[i]);
                }
            }

            // Update stack content in place
            sourceStack.length = 0;
            sourceStack.push(...newStack);

        } else {
            // Normal pop for playing fields (Top of stack)
            // Remove 'hand.length' stones from source stack
            for (let i = 0; i < hand.length; i++) sourceStack.pop();
        }

        // Track AI consecutive moves with the same stone (across turns)
        if (currentPlayer === 'black') {
            if (aiLastMovedStone &&
                aiLastMovedStone.area === selectedSource.area &&
                aiLastMovedStone.row === selectedSource.row &&
                aiLastMovedStone.col === selectedSource.col) {
                aiConsecutiveMoveCount++;
            } else {
                aiConsecutiveMoveCount = 1;
            }
        } else {
            aiLastMovedStone = null;
            aiConsecutiveMoveCount = 0;
        }

        turnPhase = 'MOVING';
    }

    // 2. Drop stone(s) from hand to target
    const targetStack = getStack(area, row, col);

    // Special Rule: If entering a Garden (specifically opposite home?), drop ALL stones.
    // User said: "when stones enter the Garden... all remaining stones are dropped there"
    // Let's apply this to ANY Garden entry for now, as it seems to be the "dumping" mechanic.
    if (area === 'garden') {
        // Drop ALL stones
        while (hand.length > 0) {
            targetStack.push(hand.shift());
        }
    } else {
        // Normal drop (1 stone)
        // Use shift() to take from the BOTTOM of the hand (FIFO)
        const stone = hand.shift();
        targetStack.push(stone);
    }

    // Update AI's last moved location to where the stone ENDED
    if (currentPlayer === 'black' && hand.length === 0) {
        aiLastMovedStone = { area, row, col };
    }

    // 3. Record history
    moveHistory.push({ area, row, col });

    // 4. Check if hand empty
    if (hand.length === 0) {
        // Trigger 3D Animation hook if exists
        if (typeof animate3DMove === 'function') {
            animate3DMove(moveHistory, () => {
                endTurn();
            });
        } else {
            endTurn();
        }
    } else {
        // Continue moving
        updateStatus(`Dropped stone. ${hand.length} left. Select next field.`);
        drawBoard();
    }
}

function endTurn() {
    if (turnPhase === 'GAME_OVER') return;

    // 1. Staircase Logic
    processStaircases();

    // 2. Win Check
    if (checkWin()) return;

    // 3. Switch Player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    currentTurnId++;
    resetTurnState();

    // 4. Check for No Valid Moves (Special Rule)
    if (!hasValidMoves(currentPlayer)) {
        showMessage(`${currentPlayer.toUpperCase()} has no valid moves! Select a tower to restack.`);
        // If it's the AI and it's stuck, we must force it to end its turn or it will hang
        if (isVsComputer && currentPlayer === 'black') {
            setTimeout(() => {
                if (currentPlayer === 'black') endTurn();
            }, 2000);
        }
    }

    drawBoard();
    updateStatus();
    updateCounts();

    if (turnPhase !== 'GAME_OVER' && isVsComputer && currentPlayer === 'black') {
        if (aiActionTimeout) clearTimeout(aiActionTimeout);
        aiActionTimeout = setTimeout(makeAIMove, 600);

        // WATCHDOG: If AI is stuck for 5 seconds, force a random move
        setTimeout(() => {
            if (isVsComputer && currentPlayer === 'black' && turnPhase !== 'GAME_OVER' && isAiThinking) {
                console.warn("AI Watchdog triggered! Forcing random move.");
                forceRandomMove();
            }
        }, 5000);
    }
}

function forceRandomMove() {
    if (currentPlayer !== 'black' || turnPhase === 'GAME_OVER') return;

    // Clear thinking flag so we don't block the next turn
    isAiThinking = false;

    // Find ANY legal move
    const possible = [];
    // Just try gardens first for simplicity
    board.gardens.forEach((g, row) => {
        if (g.includes('black')) possible.push({ area: 'garden', row, col: 0 });
    });
    // Fields
    [board.topField, board.bottomField].forEach((f, fIdx) => {
        const area = fIdx === 0 ? 'top' : 'bottom';
        f.forEach((r, row) => {
            r.forEach((s, col) => {
                if (getTopColor(s) === 'black') possible.push({ area, row, col });
            });
        });
    });

    if (possible.length > 0) {
        const src = possible[Math.floor(Math.random() * possible.length)];
        handleSelectPhase(src.area, src.row, src.col);

        // Find ANY valid target
        const targets = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 5; c++) {
                if (isValidMove('top', r, c)) targets.push({ area: 'top', row: r, col: c });
                if (isValidMove('bottom', r, c)) targets.push({ area: 'bottom', row: r, col: c });
            }
        }
        for (let g = 0; g < 4; g++) {
            if (isValidMove('garden', g, 0)) targets.push({ area: 'garden', row: g, col: 0 });
        }

        if (targets.length > 0) {
            const tgt = targets[Math.floor(Math.random() * targets.length)];
            handleMovePhase(tgt.area, tgt.row, tgt.col);
            return;
        }
    }

    // If no moves found, just end the turn
    endTurn();
}

// ============================================
// AI LOGIC
// ============================================

// Helper to evaluate board state
const evaluateBoardState = () => {
    let score = 0;
    // 1. Stones in High Garden (Win Condition)
    // Correct Full Loop:
    // White starts G1(BL) -> G2(BR) Launchpad -> G3(TR) Upstairs -> G0(TL) WIN
    // Black starts G2(BR) -> G1(BL) Launchpad -> G0(TL) Upstairs -> G3(TR) WIN
    score += board.gardens[G_TOP_RIGHT].filter(s => s === 'black').length * 50000;
    score -= board.gardens[G_TOP_LEFT].filter(s => s === 'white').length * 50000;

    // 2. Launchpad/Staircase Progress
    // Black MUST enter G_BOT_LEFT (1) to reach G_TOP_LEFT (0)
    const blackInLaunchpad = board.gardens[G_BOT_LEFT].filter(s => s === 'black').length;
    score += blackInLaunchpad * 1500;

    // 3. Home Garden Management
    const myBlackHome = board.gardens[G_BOT_RIGHT];
    const myBlackAtHome = myBlackHome.filter(s => s === 'black').length;
    // Minor reward for having stones at home, but heavily outweighed by progression
    score += myBlackAtHome * 20;

    // 3. Control of Field (Top of stacks)
    const evaluateField = (field, area) => {
        field.forEach((r, rIdx) => {
            r.forEach((stack, cIdx) => {
                const topColor = getTopColor(stack);
                const length = stack.length;
                if (topColor === 'black') {
                    // Exponential Stacking Reward
                    score += length * length * 8;

                    // Capture Bonus
                    if (length > 1) {
                        const hasOpponent = stack.some(s => s === 'white');
                        if (hasOpponent) score += 150;
                    }

                    // PROGRESSION REWARD:
                    if (area === 'bottom') {
                        // Bottom Field: Black moves Right to Left (towards G1)
                        score += (4 - cIdx) * 60;
                    } else if (area === 'top') {
                        // Top Field: Black moves Left to Right (towards G3)
                        score += 1000; // Bonus for being in Top Field
                        score += cIdx * 60;
                    }
                } else if (topColor === 'white') {
                    score -= 50;
                }
            });
        });
    };
    evaluateField(board.topField, 'top');
    evaluateField(board.bottomField, 'bottom');

    // 4. Opponent Control: Penalize White's progress
    const whiteInLaunchpad = board.gardens[G_BOT_RIGHT].filter(s => s === 'white').length;
    score -= whiteInLaunchpad * 500; // Very bad if white enters our home to ascend

    return score;
};

// Deep copy helper for simulation
const cloneBoard = (b) => {
    return {
        topField: b.topField.map(r => r.map(stack => [...stack])),
        bottomField: b.bottomField.map(r => r.map(stack => [...stack])),
        gardens: b.gardens.map(g => [...g])
    };
};

const getSimStack = (b, area, row, col) => {
    if (area === 'garden') return b.gardens[row];
    if (area === 'top') return b.topField[row][col];
    if (area === 'bottom') return b.bottomField[row][col];
    return null;
};

// Simulate a full path
const simulateMove = (pickup, path) => {
    const simBoard = cloneBoard(board);
    const sourceStack = getSimStack(simBoard, pickup.area, pickup.row, pickup.col);
    let simHand = [];

    if (pickup.area === 'garden') {
        // Block selection from actual Goal Gardens in simulation
        if (isTargetHighGarden('garden', pickup.row)) return null;

        const newStack = [];
        let extracted = 0;
        for (let i = sourceStack.length - 1; i >= 0; i--) {
            if (sourceStack[i] === 'black' && extracted < pickup.count) {
                extracted++;
            } else {
                newStack.unshift(sourceStack[i]);
            }
        }
        simBoard.gardens[pickup.row] = newStack;
        simHand = Array(pickup.count).fill('black');
    } else {
        // Check for Emergency Lift (AI only takes its own color if blocked)
        if (pickup.isEmergency) {
            const myStones = sourceStack.filter(s => s === 'black');
            const others = sourceStack.filter(s => s !== 'black');
            // Simulating the lift: mine at top, others at bottom
            sourceStack.length = 0;
            sourceStack.push(...others, ...myStones);
        }
        simHand = sourceStack.splice(sourceStack.length - pickup.count, pickup.count);
    }

    // Apply drops
    for (const step of path) {
        if (simHand.length === 0) break; // Defensive: shouldn't happen but prevents errors
        const targetStack = getSimStack(simBoard, step.area, step.row, step.col);
        if (step.area === 'garden') {
            while (simHand.length > 0) targetStack.push(simHand.shift());
        } else {
            targetStack.push(simHand.shift());
        }
    }
    return simBoard;
};

function makeAIMove() {
    if (turnPhase === 'GAME_OVER' || currentPlayer !== 'black' || isAiThinking) return;

    isAiThinking = true;
    updateStatus("AI is thinking...");

    const oldSource = selectedSource;
    const oldHand = [...hand];
    const oldPhase = turnPhase;
    const oldHistory = [...moveHistory];

    const possibleSources = [];

    // 1. Collect Garden Sources
    board.gardens.forEach((g, row) => {
        const myStones = g.filter(s => s === 'black').length;
        if (myStones > 0) {
            // Gardens can cycle 1-5 stones
            for (let count = 1; count <= Math.min(myStones, 5); count++) {
                possibleSources.push({ area: 'garden', row, col: 0, count });
            }
        }
    });

    // 2. Collect Field Sources (Top and Bottom)
    const addFieldSources = (area, fieldGrid) => {
        fieldGrid.forEach((r, row) => {
            r.forEach((stack, col) => {
                if (stack && stack.length > 0 && getTopColor(stack) === 'black') {
                    possibleSources.push({ area, row, col, count: stack.length });
                }
            });
        });
    };
    addFieldSources('top', board.topField);
    addFieldSources('bottom', board.bottomField);

    // 3. Collect Emergency Buried Sources if completely blocked
    if (possibleSources.length === 0) {
        const addBuriedSources = (area, fieldGrid) => {
            fieldGrid.forEach((r, row) => {
                r.forEach((stack, col) => {
                    if (stack && stack.includes('black')) {
                        possibleSources.push({ area, row, col, count: stack.length, isEmergency: true });
                    }
                });
            });
        };
        addBuriedSources('top', board.topField);
        addBuriedSources('bottom', board.bottomField);
    }

    const allMoveCandidates = [];

    // 4. Generate Adjacencies for each Source
    possibleSources.forEach(src => {
        const sweepSource = selectedSource;
        const sweepHand = [...hand];
        const sweepPhase = turnPhase;
        const sweepHistory = [...moveHistory];

        selectedSource = { area: src.area, row: src.row, col: src.col };
        hand = Array(src.count).fill('black');
        turnPhase = 'SELECT';
        moveHistory = [];

        const tryAddTarget = (tgtArea, tgtRow, tgtCol) => {
            if (isValidMove(tgtArea, tgtRow, tgtCol)) {
                // Option A: Drop all here (Slam Dunk)
                allMoveCandidates.push({
                    src: { ...src },
                    path: Array(src.count).fill({ area: tgtArea, row: tgtRow, col: tgtCol })
                });

                // Option B: Stride! (Move one-by-one)
                // We generate a forward-moving stride path if possible
                if (src.count > 1) {
                    const stridePath = generateAdvancedStride(src, { area: tgtArea, row: tgtRow, col: tgtCol });
                    if (stridePath && stridePath.length > 1) {
                        allMoveCandidates.push({ src: { ...src }, path: stridePath });
                    }
                }
            }
        };

        // Sweep all fields and gardens for neighbors
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 5; c++) {
                tryAddTarget('top', r, c);
                tryAddTarget('bottom', r, c);
            }
        }
        for (let g = 0; g < 4; g++) {
            tryAddTarget('garden', g, 0);
        }

        selectedSource = sweepSource;
        hand = sweepHand;
        turnPhase = sweepPhase;
        moveHistory = sweepHistory;
    });

    console.log("AI thinking started. Candidates: " + allMoveCandidates.length);

    let bestMove = null;
    let bestScore = -Infinity;
    let currentIndex = 0;
    const batchSize = 60; // Slightly larger batches for efficiency

    const processBatch = () => {
        if (!isAiThinking || currentPlayer !== 'black') return;

        const end = Math.min(currentIndex + batchSize, allMoveCandidates.length);
        for (; currentIndex < end; currentIndex++) {
            const move = allMoveCandidates[currentIndex];
            const simBoard = simulateMove(move.src, move.path);
            if (!simBoard) continue;

            const realBoard = board;
            board = simBoard;
            const score = evaluateBoardState() + (Math.random() * 5);
            board = realBoard;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        if (currentIndex < allMoveCandidates.length) {
            updateStatus(`AI is thinking... (${Math.round(currentIndex / allMoveCandidates.length * 100)}%)`);
            aiActionTimeout = setTimeout(processBatch, 0);
        } else {
            console.log("AI thinking completed. Best Move Score: " + bestScore);
            finalizeAIMove(bestMove, oldSource, oldHand, oldPhase, oldHistory);
        }
    };

    if (allMoveCandidates.length === 0) {
        console.warn("AI found NO move candidates.");
        finalizeAIMove(null, oldSource, oldHand, oldPhase, oldHistory);
    } else {
        processBatch();
    }
}

function generateAdvancedStride(src, firstStep) {
    const path = [firstStep];
    const visited = [
        { area: src.area, row: src.row, col: src.col },
        { area: firstStep.area, row: firstStep.row, col: firstStep.col }
    ];

    let currentPos = firstStep;

    // Greedy forward momentum search
    for (let i = 1; i < src.count; i++) {
        const neighbors = [];

        // Find potential next steps
        const sweepNeighbors = (area, rows, cols) => {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (isAdjacent(currentPos, { area, row: r, col: c })) {
                        neighbors.push({ area, row: r, col: c });
                    }
                }
            }
        };
        sweepNeighbors('top', 3, 5);
        sweepNeighbors('bottom', 3, 5);
        for (let g = 0; g < 4; g++) {
            if (isAdjacent(currentPos, { area: 'garden', row: g, col: 0 })) {
                neighbors.push({ area: 'garden', row: g, col: 0 });
            }
        }

        // Filter valid neighbors (no repeats, check rules)
        // Temporarily modify state to check isValidMove
        const sweepSource = selectedSource;
        const sweepHand = [...hand];
        const sweepPhase = turnPhase;
        const sweepHistory = [...moveHistory];

        selectedSource = { area: src.area, row: src.row, col: src.col };
        hand = Array(src.count - i).fill('black'); // remaining stones
        turnPhase = 'MOVING';
        moveHistory = [...visited];

        const validNeighbors = neighbors.filter(n => {
            // Internal check to avoid repeats (isValidMove does this but we want to be safe)
            if (visited.some(v => v.area === n.area && v.row === n.row && v.col === n.col)) return false;
            return isValidMove(n.area, n.row, n.col);
        }).sort((a, b) => {
            // Heuristic for "Forward"
            const scorePos = (pos) => {
                if (pos.area === 'garden') {
                    if (pos.row === G_TOP_RIGHT) return 5000; // WIN TARGET
                    if (pos.row === G_BOT_LEFT) return 1000; // Ascend target
                    return 0;
                }
                if (pos.area === 'bottom') return (4 - pos.col) * 100;
                if (pos.area === 'top') return 2000 + pos.col * 100;
                return 0;
            };
            return scorePos(b) - scorePos(a);
        });

        // Restore state
        selectedSource = sweepSource;
        hand = sweepHand;
        turnPhase = sweepPhase;
        moveHistory = sweepHistory;

        if (validNeighbors.length > 0) {
            const next = validNeighbors[0]; // Take best forward neighbor
            path.push(next);
            visited.push(next);
            currentPos = next;
        } else {
            // Stuck? Drop remaining here
            path.push(currentPos);
        }
    }
    return path;
}

function finalizeAIMove(bestMove, oldSource, oldHand, oldPhase, oldHistory) {
    selectedSource = oldSource;
    hand = [...oldHand];
    turnPhase = oldPhase;
    moveHistory = [...oldHistory];
    isAiThinking = false;

    if (!bestMove) {
        showMessage("Black has no moves.");
        endTurn();
        return;
    }

    const executionTurnId = currentTurnId;
    const executionTurnPlayer = currentPlayer;

    // Execute visuals
    selectedSource = null;
    if (bestMove.src.area === 'garden') {
        for (let i = 0; i < bestMove.src.count; i++) {
            if (currentTurnId !== executionTurnId) return;
            handleSelectPhase(bestMove.src.area, bestMove.src.row, bestMove.src.col);
        }
    } else {
        if (currentTurnId !== executionTurnId) return;
        handleSelectPhase(bestMove.src.area, bestMove.src.row, bestMove.src.col);
    }

    let i = 0;
    const executeNextDrop = () => {
        if (turnPhase === 'GAME_OVER' || currentPlayer !== executionTurnPlayer || currentTurnId !== executionTurnId) return;
        if (i < bestMove.path.length) {
            handleMovePhase(bestMove.path[i].area, bestMove.path[i].row, bestMove.path[i].col);
            i++;
            aiActionTimeout = setTimeout(executeNextDrop, 400);
        }
    };
    aiActionTimeout = setTimeout(executeNextDrop, 400);
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
    
    // Sync with Side Menu
    if (document.getElementById('player-name')) {
        document.getElementById('player-name').innerText = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
    }
    const indicator = document.getElementById('player-indicator');
    if (indicator) {
        indicator.className = `count-stone ${currentPlayer}`;
    }

    // Update Hand Display (Legacy 2D)
    const handDisplay = document.getElementById('hand-display');
    const handStones = document.getElementById('hand-stones');

    if (hand.length > 0) {
        if (handDisplay) handDisplay.classList.add('visible');
        if (handStones) {
            handStones.innerHTML = '';
            hand.forEach(color => {
                const s = document.createElement('div');
                s.className = `hand-stone ${color}`;
                handStones.appendChild(s);
            });
        }
    } else {
        if (handDisplay) handDisplay.classList.remove('visible');
    }

    // Update Hand Display (3D)
    const handDisplay3D = document.getElementById('hand-display-3d');
    const handCount3D = document.getElementById('hand-count');
    const handStones3D = document.getElementById('hand-stones-3d');

    if (handDisplay3D && hand.length > 0) {
        handDisplay3D.classList.remove('hidden');
        if (handCount3D) handCount3D.innerText = hand.length;
        if (handStones3D) {
            handStones3D.innerHTML = '';
            hand.forEach(color => {
                const s = document.createElement('div');
                s.className = `hand-stone-3d ${color}`;
                handStones3D.appendChild(s);
            });
        }
    } else if (handDisplay3D) {
        handDisplay3D.classList.add('hidden');
    }

    // Trigger 3D Sync
    if (typeof sync3D === 'function') sync3D();
}

function processStaircases() {
    // Check White Home (G1) -> Left Stairs (Black) -> G0 (White High)
    const wHome = board.gardens[G_BOT_LEFT];
    if (wHome.length > 0) {
        const whiteCount = wHome.filter(s => s === 'white').length;
        const blackCount = wHome.filter(s => s === 'black').length;

        // Left Stairs are BLACK. Only Black stones use them if majority.
        // Rule: "only if the stones of the color that can wander up... is higher than the stones of the other color"
        // Move ONLY the difference (Majority - Minority)
        if (blackCount > whiteCount) {
            const diff = blackCount - whiteCount;

            // Move 'diff' black stones
            // We need to remove 'diff' black stones from wHome and add to G_TOP_LEFT
            let movedCount = 0;
            // Filter out the stones to move (take from top or bottom? usually top is easier to pop)
            // But we need to keep the stack structure for the rest?
            // Actually, gardens are just piles in this logic?
            // "The turn ends and... stones 'wander' up automatically"
            // Let's remove the first 'diff' black stones we find? Or last?
            // Let's assume we take them out.

            const newStack = [];
            const moving = [];

            // Iterate and extract
            for (const stone of wHome) {
                if (stone === 'black' && movedCount < diff) {
                    moving.push(stone);
                    movedCount++;
                } else {
                    newStack.push(stone);
                }
            }

            board.gardens[G_BOT_LEFT] = newStack;
            board.gardens[G_TOP_LEFT].push(...moving); // Move to Top Left
            showMessage(`${diff} Black stones moved up the Left Staircase!`);
        }
    }

    // Check Black Home (G2) -> Right Stairs (White) -> G3 (Black High)
    const bHome = board.gardens[G_BOT_RIGHT];
    if (bHome.length > 0) {
        const whiteCount = bHome.filter(s => s === 'white').length;
        const blackCount = bHome.filter(s => s === 'black').length;

        // Right Stairs are WHITE. Only White stones use them if majority.
        if (whiteCount > blackCount) {
            const diff = whiteCount - blackCount;

            let movedCount = 0;
            const newStack = [];
            const moving = [];

            for (const stone of bHome) {
                if (stone === 'white' && movedCount < diff) {
                    moving.push(stone);
                    movedCount++;
                } else {
                    newStack.push(stone);
                }
            }

            board.gardens[G_BOT_RIGHT] = newStack;
            board.gardens[G_TOP_RIGHT].push(...moving); // Move to Top Right
            showMessage(`${diff} White stones moved up the Right Staircase!`);
        }
    }
}

function checkWin() {
    // Goal: 7 stones in High Garden
    // Journey: Start Garden -> Field -> Launchpad -> Upstairs -> Field -> Win Garden

    // WIN LOCATIONS:
    // White targets G0 (Top Left)
    // Black targets G3 (Top Right)

    const whiteHigh = board.gardens[G_TOP_LEFT];
    const blackHigh = board.gardens[G_TOP_RIGHT];

    const whiteScore = whiteHigh.filter(s => s === 'white').length;
    const blackScore = blackHigh.filter(s => s === 'black').length;

    if (whiteScore >= BOARD_CONFIG.winCount) {
        turnPhase = 'GAME_OVER';
        showGameOverModal('White Wins!', 'White wins by gathering 7 stones in the Top-Left High Garden!');
        return true;
    }

    if (blackScore >= BOARD_CONFIG.winCount) {
        turnPhase = 'GAME_OVER';
        showGameOverModal('Black Wins!', 'Black wins by gathering 7 stones in the Top-Right High Garden!');
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
    // White Win: G0 (Top Left)
    // Black Win: G3 (Top Right)
    if (currentPlayer === 'white') return index === G_TOP_LEFT;
    if (currentPlayer === 'black') return index === G_TOP_RIGHT;
    return false;
}

function isPlayerBlocked(player) {
    // 1. Check gardens (except the Goal Garden)
    const targetGoal = player === 'white' ? G_TOP_LEFT : G_TOP_RIGHT;
    for (let i = 0; i < 4; i++) {
        if (i === targetGoal) continue; // Goal stones are permanent/unmovable
        if (board.gardens[i].includes(player)) return false;
    }

    // 2. Check field tops
    const checkField = (field) => {
        for (const row of field) {
            for (const stack of row) {
                if (getTopColor(stack) === player) return true;
            }
        }
        return false;
    };
    if (checkField(board.topField) || checkField(board.bottomField)) return false;

    // A player is truly blocked only if they HAVE stones buried.
    // Otherwise they just have no stones on board (they lost or it's a game state error).
    const hasAnyStones = (field) => {
        for (const row of field) {
            for (const stack of row) {
                if (stack.includes(player)) return true;
            }
        }
        return false;
    };
    return hasAnyStones(board.topField) || hasAnyStones(board.bottomField);
}

function hasValidMoves(player) {
    if (!isPlayerBlocked(player)) return true;

    // If blocked, they HAVE valid moves IF they have buried stones (Emergency Lift)
    // The check in isPlayerBlocked already covers "has buried stones" as the last check.
    return isPlayerBlocked(player);
}

// ============================================
// RENDERING
// ============================================

function drawBoard() {
    // Draw Top Field
    drawGrid('top', board.topField);
    drawGrid('bottom', board.bottomField);
    drawGardens();

    // Trigger 3D Sync
    if (typeof sync3D === 'function') sync3D();
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

        // Gardens are now rendered as a grid of stones
        const stack = board.gardens[i];

        // Determine how many stones of current player are "selected" (in hand)
        // and should be visually hidden/ghosted in the garden
        let selectedCount = 0;
        if (selectedSource && selectedSource.area === 'garden' && selectedSource.row === i) {
            selectedCount = hand.length;
        }

        // Render stones
        // We need to render ALL stones in the stack.
        // But we need to identify which ones are "selected".
        // The logic removes from the "top" (end of array) of that color.
        // So we count backwards for that color.

        // Helper to track how many of current player's color we've seen from the end
        let seenPlayerColor = 0;

        // Render in reverse order? Or just map?
        // Grid fills top-left to bottom-right usually.
        // Let's render them in order.

        stack.forEach((color, index) => {
            const stone = document.createElement('div');
            stone.className = `garden-stone ${color}`;

            // Check if this stone is one of the selected ones
            // We need to know if this is one of the LAST 'selectedCount' stones of that color
            // This is tricky in a forEach loop.
            // Let's pre-calculate indices to ghost.

            element.appendChild(stone);
        });

        // Post-process to ghost the correct stones
        if (selectedCount > 0) {
            const stones = Array.from(element.children);
            let ghosted = 0;
            // Iterate backwards
            for (let j = stones.length - 1; j >= 0; j--) {
                const stoneEl = stones[j];
                if (stoneEl.classList.contains(currentPlayer)) {
                    if (ghosted < selectedCount) {
                        stoneEl.classList.add('selected-ghost');
                        ghosted++;
                    }
                }
            }
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
    const wScore = board.gardens[G_TOP_LEFT].filter(s => s === 'white').length;
    const bScore = board.gardens[G_TOP_RIGHT].filter(s => s === 'black').length;

    const wEl = document.getElementById('white-count');
    const bEl = document.getElementById('black-count');
    if (wEl) wEl.textContent = `${wScore}/${BOARD_CONFIG.winCount}`;
    if (bEl) bEl.textContent = `${bScore}/${BOARD_CONFIG.winCount}`;

    // Sync with side menu - clear the existing content to avoid 0/7/7
    const wMenu = document.getElementById('white-count-menu');
    const bMenu = document.getElementById('black-count-menu');
    if (wMenu) wMenu.textContent = `${wScore}`;
    if (bMenu) bMenu.textContent = `${bScore}`;
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
    if (turnPhase === 'SELECT') {
        resetTurnState();
        drawBoard();
        updateStatus();
    }
});
opponentButton.addEventListener('click', () => {
    isVsComputer = !isVsComputer;
    opponentButton.textContent = isVsComputer ? 'Opponent: Computer' : 'Opponent: Human';
    if (isVsComputer && currentPlayer === 'black' && turnPhase !== 'GAME_OVER') {
        setTimeout(makeAIMove, 600);
    }
});

// Start Game
initializeGame();
