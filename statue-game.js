// STATUE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
const BOARD_SIZE = 11;

// Removed squares (center 4x4 grid areas)
const removedSquares = new Set([
    '3,3', '3,4', '3,6', '3,7',
    '4,3', '4,4', '4,6', '4,7',
    '6,3', '6,4', '6,6', '6,7',
    '7,3', '7,4', '7,6', '7,7',
]);

// Movement vectors (N, E, S, W)
const HV_VECTORS = [
    { dr: -1, dc: 0 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 }
];

// ============================================
// GAME STATE
// ============================================
let currentDieId = 0;
let onBoardDice = [];
let reserveDice = { 1: 8, 2: 8 };
let currentPlayer = 1; // 1 (White) or 2 (Black)
let gamePhase = 'ACTION_SELECT'; // 'ACTION_SELECT', 'PLACE', 'STRIDE_MOVE', 'DIMINISH_SELECT', 'FORCED_MOVE_SELECT'
let forcedTurnActive = false;
let selectedDie = null;

// ============================================
// DOM ELEMENTS
// ============================================
const boardContainer = document.getElementById('board-container');
const messageBox = document.getElementById('message-box');
const turnInfo = document.getElementById('turn-info');
const p1ReserveDisplay = document.getElementById('p1-reserve');
const p2ReserveDisplay = document.getElementById('p2-reserve');
const p1BoardCountDisplay = document.getElementById('p1-board-count');
const p2BoardCountDisplay = document.getElementById('p2-board-count');

const btnPlace = document.getElementById('action-place');
const btnDiminish = document.getElementById('action-diminish');
const btnCancel = document.getElementById('action-cancel');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if a coordinate is within bounds and playable
 */
function isWithinBounds(r, c) {
    const isBoardBound = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    const isRemovedSquare = removedSquares.has(`${r},${c}`);
    return isBoardBound && !isRemovedSquare;
}

/**
 * Calculates valid adjacent targets for movement
 * Prevents targeting opponent's '1' die (indestructible rule)
 */
function calculateAdjacentTargets(r, c, player) {
    const targets = [];
    HV_VECTORS.forEach(vector => {
        const nextR = r + vector.dr;
        const nextC = c + vector.dc;

        if (isWithinBounds(nextR, nextC)) {
            const pieceAt = onBoardDice.find(d => d.r === nextR && d.c === nextC);

            if (!pieceAt) {
                targets.push({ r: nextR, c: nextC, attack: false });
            } else if (pieceAt.player !== player && pieceAt.value > 1) {
                targets.push({ r: nextR, c: nextC, attack: true });
            }
        }
    });
    return targets;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Updates status display and checks for game end
 */
function updateStatusDisplay() {
    const p1Color = currentPlayer === 1 ? 'color: #3b82f6;' : '';
    const p2Color = currentPlayer === 2 ? 'color: #ef4444;' : '';
    const playerColor = currentPlayer === 1 ? p1Color : p2Color;

    let phaseDisplay = gamePhase.replace('_', ' ');
    if (gamePhase === 'STRIDE_MOVE' && selectedDie && selectedDie.movesLeft !== undefined) {
        const moveType = selectedDie.isForcedMove ? 'FORCED Move' : 'Moving';
        phaseDisplay = `${moveType} (${selectedDie.movesLeft} left)`;
    } else if (gamePhase === 'FORCED_MOVE_SELECT') {
        phaseDisplay = 'FORCED MOVE SELECTION';
    }

    turnInfo.innerHTML = `Player ${currentPlayer} (${currentPlayer === 1 ? 'White' : 'Black'}) - <span style="${playerColor}">${phaseDisplay}</span>`;

    p1ReserveDisplay.textContent = reserveDice[1];
    p2ReserveDisplay.textContent = reserveDice[2];

    const p1BoardCount = onBoardDice.filter(d => d.player === 1).length;
    const p2BoardCount = onBoardDice.filter(d => d.player === 2).length;
    p1BoardCountDisplay.textContent = p1BoardCount;
    p2BoardCountDisplay.textContent = p2BoardCount;

    // Check for game end: fewer than 3 total dice
    const p1TotalDice = p1BoardCount + reserveDice[1];
    const p2TotalDice = p2BoardCount + reserveDice[2];

    if (p1TotalDice < 3 || p2TotalDice < 3) {
        const loser = p1TotalDice < 3 ? 1 : 2;
        const winner = 3 - loser;
        const losingDiceCount = p1TotalDice < 3 ? p1TotalDice : p2TotalDice;
        gamePhase = 'GAME_OVER';

        messageBox.textContent = `GAME OVER! Player ${winner} wins! Player ${loser} has fewer than three dice left (Total: ${losingDiceCount}).`;
        toggleActionButtons(false, false);
    }
}

/**
 * Toggles action button states
 */
function toggleActionButtons(enableActions, showCancel) {
    if (gamePhase === 'GAME_OVER') {
        btnPlace.disabled = true;
        btnDiminish.disabled = true;
        btnCancel.style.display = 'none';
        return;
    }

    const isForcedTurn = gamePhase === 'FORCED_MOVE_SELECT' || selectedDie?.isForcedMove;

    btnPlace.disabled = isForcedTurn || !enableActions || reserveDice[currentPlayer] === 0;
    btnDiminish.disabled = isForcedTurn || !enableActions;
    btnCancel.style.display = (showCancel && !isForcedTurn) ? 'inline-block' : 'none';

    if (gamePhase === 'ACTION_SELECT') {
        btnPlace.disabled = reserveDice[currentPlayer] === 0;
        btnDiminish.disabled = false;
    }
}

/**
 * Renders the game board
 */
function renderBoard(highlightSquares = [], highlightType = 'move-target') {
    boardContainer.innerHTML = '';
    selectedDie = onBoardDice.find(d => selectedDie && d.id === selectedDie.id) || null;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'board-square';
            cell.dataset.r = r;
            cell.dataset.c = c;

            const coordKey = `${r},${c}`;
            const isRemoved = removedSquares.has(coordKey);

            if (isRemoved) {
                cell.classList.add('removed');
            }

            const isTargetSquare = highlightSquares.some(m => m.r === r && m.c === c);

            if (isTargetSquare && gamePhase !== 'FORCED_MOVE_SELECT') {
                cell.classList.add(highlightType);
                if (gamePhase === 'PLACE') {
                    cell.addEventListener('click', handlePlaceClick);
                } else if (gamePhase === 'STRIDE_MOVE') {
                    cell.addEventListener('click', handleMoveClick);
                }
            }

            const die = onBoardDice.find(d => d.r === r && d.c === c);

            if (die) {
                const dieElement = document.createElement('div');
                dieElement.textContent = die.value;
                dieElement.id = `die-${die.id}`;
                dieElement.className = `die die-p${die.player}`;

                if (selectedDie && selectedDie.id === die.id) {
                    dieElement.classList.add('selected');
                }

                if (die.player === currentPlayer) {
                    if (gamePhase === 'ACTION_SELECT') {
                        dieElement.style.cursor = 'pointer';
                        dieElement.addEventListener('click', handleDieSelectForStartMove);
                    } else if (gamePhase === 'FORCED_MOVE_SELECT' && die.value === 1) {
                        if (isTargetSquare) {
                            dieElement.classList.add('forced-select-target');
                            dieElement.style.cursor = 'pointer';
                            dieElement.addEventListener('click', handleDieSelectForStartMove);
                        }
                    } else if (gamePhase === 'DIMINISH_SELECT' && die.value > 1) {
                        dieElement.classList.add('diminish-target');
                        dieElement.addEventListener('click', handleDieSelectForDiminish);
                    }
                }

                dieElement.dataset.dieId = die.id;
                cell.appendChild(dieElement);
            }

            boardContainer.appendChild(cell);
        }
    }

    toggleActionButtons(gamePhase === 'ACTION_SELECT', gamePhase !== 'ACTION_SELECT');
    updateStatusDisplay();
}

// ============================================
// TURN MANAGEMENT
// ============================================

/**
 * Switches to the next player's turn
 */
function switchTurn() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;

    if (forcedTurnActive) {
        gamePhase = 'FORCED_MOVE_SELECT';
        forcedTurnActive = false;

        messageBox.textContent = `FORCED MOVE: Player ${currentPlayer}, you must select and move one of your value 1 dice.`;
        toggleActionButtons(false, true);

        const movableOnes = onBoardDice.filter(d =>
            d.player === currentPlayer &&
            d.value === 1 &&
            calculateAdjacentTargets(d.r, d.c, d.player).length > 0
        );

        const movableDieCoords = movableOnes.map(d => ({ r: d.r, c: d.c }));
        renderBoard(movableDieCoords);
    } else {
        gamePhase = 'ACTION_SELECT';
        selectedDie = null;
        messageBox.textContent = `Player ${currentPlayer}'s turn. Click a die to move, or choose an action.`;
        toggleActionButtons(true, false);
        renderBoard();
    }
}

/**
 * Ends the current turn
 */
function endTurn(message) {
    messageBox.textContent = message || `Turn complete. Passing to Player ${currentPlayer === 1 ? 2 : 1}.`;
    setTimeout(switchTurn, 1000);
}

// ============================================
// ACTION HANDLERS
// ============================================

/**
 * Cancels the current action
 */
function handleCancel() {
    if (gamePhase === 'FORCED_MOVE_SELECT' || selectedDie?.isForcedMove) return;

    gamePhase = 'ACTION_SELECT';
    selectedDie = null;
    messageBox.textContent = "Action cancelled. Choose a new action: Place, Diminish, or click a die to move.";
    renderBoard();
}

/**
 * Handles Place Die action
 */
function handlePlaceAction() {
    if (gamePhase !== 'ACTION_SELECT' || reserveDice[currentPlayer] === 0) return;

    gamePhase = 'PLACE';
    toggleActionButtons(false, true);

    const emptySquares = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isWithinBounds(r, c) && !onBoardDice.some(d => d.r === r && d.c === c)) {
                emptySquares.push({ r, c });
            }
        }
    }

    if (emptySquares.length === 0) {
        messageBox.textContent = "No empty playable squares to place a die. Choose Move or Diminish.";
        gamePhase = 'ACTION_SELECT';
        toggleActionButtons(true, false);
        return;
    }

    messageBox.textContent = "Click an empty square to place a new die (value 1). Click Cancel if you change your mind.";
    renderBoard(emptySquares, 'place-target');
}

/**
 * Handles Diminish action
 */
function handleDiminishAction() {
    if (gamePhase !== 'ACTION_SELECT' || onBoardDice.filter(d => d.player === currentPlayer && d.value > 1).length === 0) {
        messageBox.textContent = "You must have a die with value > 1 to Diminish (Value 1 dice are indestructible).";
        return;
    }

    gamePhase = 'DIMINISH_SELECT';
    toggleActionButtons(false, true);
    messageBox.textContent = "Click one of your dice with value > 1 to reduce its value by 1. Click Cancel if you change your mind.";
    renderBoard();
}

/**
 * Handles placing a die on the board
 */
function handlePlaceClick(event) {
    const r = parseInt(event.currentTarget.dataset.r, 10);
    const c = parseInt(event.currentTarget.dataset.c, 10);

    if (!isWithinBounds(r, c) || onBoardDice.some(d => d.r === r && d.c === c)) {
        return;
    }

    currentDieId++;
    onBoardDice.push({
        id: currentDieId,
        value: 1,
        r: r,
        c: c,
        player: currentPlayer
    });
    reserveDice[currentPlayer]--;

    renderBoard();
    endTurn(`Player ${currentPlayer} placed a new die (Value 1) at ${String.fromCharCode(97 + c).toUpperCase()}${BOARD_SIZE - r}.`);
}

/**
 * Handles selecting a die to start movement
 */
function handleDieSelectForStartMove(event) {
    const dieId = parseInt(event.currentTarget.dataset.dieId, 10);
    selectedDie = onBoardDice.find(d => d.id === dieId);

    if (!selectedDie) return;

    const wasForcedSelection = gamePhase === 'FORCED_MOVE_SELECT';
    if (wasForcedSelection && selectedDie.value !== 1) {
        messageBox.textContent = "You are under a FORCED MOVE, you must select a die with value 1.";
        selectedDie = null;
        renderBoard();
        return;
    }

    selectedDie.movesLeft = selectedDie.value;
    const adjacentTargets = calculateAdjacentTargets(selectedDie.r, selectedDie.c, selectedDie.player);

    if (adjacentTargets.length === 0) {
        messageBox.textContent = `Die ${selectedDie.id} (Value: ${selectedDie.value}) has no legal adjacent moves. Please select a different die.`;
        selectedDie = null;
        renderBoard();
        return;
    }

    gamePhase = 'STRIDE_MOVE';
    toggleActionButtons(false, true);
    selectedDie.isForcedMove = wasForcedSelection;

    const moveType = wasForcedSelection ? "FORCED move" : "stride move";
    messageBox.textContent = `Die ${selectedDie.id} selected for ${moveType}. Value: ${selectedDie.value}. Moves left: ${selectedDie.movesLeft}. Click an adjacent square to start.`;

    if (wasForcedSelection) {
        btnCancel.style.display = 'none';
    }

    renderBoard(adjacentTargets);
}

/**
 * Handles moving a die
 */
function handleMoveClick(event) {
    if (gamePhase !== 'STRIDE_MOVE' || !selectedDie || selectedDie.movesLeft === 0) return;

    const targetR = parseInt(event.currentTarget.dataset.r, 10);
    const targetC = parseInt(event.currentTarget.dataset.c, 10);

    const isAdjacent = Math.abs(selectedDie.r - targetR) <= 1 &&
        Math.abs(selectedDie.c - targetC) <= 1 &&
        (Math.abs(selectedDie.r - targetR) + Math.abs(selectedDie.c - targetC) === 1);

    if (!isAdjacent) {
        messageBox.textContent = "You must move to an adjacent, highlighted square.";
        return;
    }

    const potentialTarget = calculateAdjacentTargets(selectedDie.r, selectedDie.c, selectedDie.player)
        .find(t => t.r === targetR && t.c === targetC);

    if (!potentialTarget) {
        messageBox.textContent = "Invalid target or blocked path. Choose a highlighted square.";
        return;
    }

    let captureMessage = '';
    if (potentialTarget.attack) {
        const capturedIndex = onBoardDice.findIndex(d => d.r === targetR && d.c === targetC);
        if (capturedIndex !== -1) {
            const capturedDie = onBoardDice.splice(capturedIndex, 1)[0];
            captureMessage = `Die ${selectedDie.id} captured Player ${capturedDie.player}'s die at ${String.fromCharCode(97 + targetC).toUpperCase()}${BOARD_SIZE - targetR}. `;
        }
    }

    selectedDie.r = targetR;
    selectedDie.c = targetC;
    selectedDie.movesLeft--;

    if (selectedDie.movesLeft > 0) {
        const nextTargets = calculateAdjacentTargets(selectedDie.r, selectedDie.c, selectedDie.player);

        if (nextTargets.length === 0) {
            selectedDie.movesLeft = 0;
            messageBox.textContent = `${captureMessage}Movement blocked at ${String.fromCharCode(97 + targetC).toUpperCase()}${BOARD_SIZE - targetR}. Turn will end after die rotation.`;
        } else {
            messageBox.textContent = `${captureMessage}Moved to ${String.fromCharCode(97 + targetC).toUpperCase()}${BOARD_SIZE - targetR}. Moves left: ${selectedDie.movesLeft}. Click an adjacent square for the next step.`;
        }

        if (selectedDie.movesLeft > 0) {
            renderBoard(nextTargets);
            return;
        }
    }

    selectedDie.value = selectedDie.value % 6 + 1;
    messageBox.textContent = `${captureMessage}Move finished. New value: ${selectedDie.value}.`;

    delete selectedDie.movesLeft;
    delete selectedDie.isForcedMove;

    renderBoard();
    endTurn();
}

/**
 * Handles selecting a die for diminish
 */
function handleDieSelectForDiminish(event) {
    const dieId = parseInt(event.currentTarget.dataset.dieId, 10);
    selectedDie = onBoardDice.find(d => d.id === dieId);

    if (selectedDie && selectedDie.value > 1) {
        const opponent = 3 - currentPlayer;

        const opponentMovableOnes = onBoardDice.filter(d =>
            d.player === opponent &&
            d.value === 1 &&
            calculateAdjacentTargets(d.r, d.c, d.player).length > 0
        );

        if (opponentMovableOnes.length === 0) {
            messageBox.textContent = `Diminish is not possible. Player ${opponent} has no movable value 1 dice for a forced move. Select another action.`;
            handleCancel();
            return;
        }

        selectedDie.value -= 1;
        messageBox.textContent = `Die ${selectedDie.id} value reduced to ${selectedDie.value}. Turn complete. Player ${opponent} is now forced to move a value 1 die.`;

        forcedTurnActive = true;
        renderBoard();
        setTimeout(switchTurn, 1500);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
btnPlace.addEventListener('click', handlePlaceAction);
btnDiminish.addEventListener('click', handleDiminishAction);
btnCancel.addEventListener('click', handleCancel);

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', () => {
    toggleActionButtons(true, false);
    renderBoard();
});
