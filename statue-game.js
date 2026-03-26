// STATUE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS
// ============================================
const BOARD_SIZE = 11;

// Removed squares (4 holes - 2x2 each at corners of center area)
// 9x9 inner board with holes, plus outer ring
// 11x11 inner board with holes, plus outer ring
// UPDATED: Throne footprint (3x3 at center) and the 4 feet (2x2 holes)
// Throne feet at corners of center area
const removedSquares = new Set([
    '3,3', '3,4', '4,3', '4,4',
    '3,6', '3,7', '4,6', '4,7',
    '6,3', '6,4', '7,3', '7,4',
    '6,6', '6,7', '7,6', '7,7'
]);
window.removedSquares = removedSquares;

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
let gamePhase = 'ACTION_SELECT'; // 'ACTION_SELECT', 'PLACE', 'STRIDE_MOVE', 'DIMINISH_SELECT', 'FORCED_MOVE_SELECT', 'GAME_OVER'
let isAIGame = false; // Start in 2-player human mode

// Track AI behavior to prevent loops
let aiLastMovedStoneId = null;
let aiConsecutiveMoveCount = 0;

let forcedTurnActive = false;
let selectedDie = null;

// Expose to window for 3D access
window.gamePhase = () => gamePhase;
window.getSelectedDie = () => selectedDie;
window.getCurrentPlayer = () => currentPlayer;
window.getReserveDice = () => reserveDice;
window.getOnBoardDice = () => onBoardDice;

// ============================================
// DOM ELEMENTS
// ============================================
const boardContainer = document.getElementById('board-container');
const messageBox = document.getElementById('game-message');
const turnInfo = document.getElementById('turn-info');
const p1ReserveDisplay = document.getElementById('p1-reserve');
const p2ReserveDisplay = document.getElementById('p2-reserve');
const p1BoardCountDisplay = document.getElementById('p1-board-count');
const p2BoardCountDisplay = document.getElementById('p2-board-count');

const btnPlace = document.getElementById('action-place');
const btnCancel = document.getElementById('action-cancel');
const resetBtnMain = document.getElementById('reset-button-main');
const opponentButton = document.getElementById('opponent-btn');
const gameOverModal = document.getElementById('game-over-modal');
const modalText = document.getElementById('modal-text');
const newGameBtn = document.getElementById('new-game-btn');

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
window.isWithinBounds = isWithinBounds;

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
    const playerIndicator = document.getElementById('player-indicator');
    if (playerIndicator) {
        playerIndicator.className = 'player-indicator ' + (currentPlayer === 1 ? 'white' : 'black');
    }

    let phaseDisplay = gamePhase.replace('_', ' ');
    if (gamePhase === 'STRIDE_MOVE' && selectedDie && selectedDie.movesLeft !== undefined) {
        const moveType = selectedDie.isForcedMove ? 'FORCED Move' : 'Moving';
        phaseDisplay = `${moveType} (${selectedDie.movesLeft} left)`;
    } else if (gamePhase === 'FORCED_MOVE_SELECT') {
        phaseDisplay = 'FORCED MOVE SELECTION';
    }

    // In-game text removed as requested. Turn status is visible in the side menu.

    if (document.getElementById('player-name')) {
        document.getElementById('player-name').textContent = (currentPlayer === 1 ? "White's" : "Black's") + " Turn";
    }
    
    // Status message for 3D bar
    if (messageBox) {
        if (gamePhase === 'ACTION_SELECT') {
            messageBox.textContent = `Player ${currentPlayer}'s turn. Click empty field to place, or stone to move.`;
            messageBox.classList.remove('hidden');
        } else if (gamePhase === 'PLACE') {
            messageBox.textContent = `Placing stone... Select an empty field on the board.`;
            messageBox.classList.remove('hidden');
        } else if (gamePhase === 'STRIDE_MOVE' && selectedDie) {
            const rem = selectedDie.value - selectedDie.stepsTaken;
            messageBox.textContent = `Move this stone ${rem} more field(s).`;
            messageBox.classList.remove('hidden');
        }
    }

    if (p1ReserveDisplay) p1ReserveDisplay.textContent = reserveDice[1];
    if (p2ReserveDisplay) p2ReserveDisplay.textContent = reserveDice[2];
    if (p1BoardCountDisplay) p1BoardCountDisplay.textContent = onBoardDice.filter(d => d.player === 1).length;
    if (p2BoardCountDisplay) p2BoardCountDisplay.textContent = onBoardDice.filter(d => d.player === 2).length;
    
    if (window.updateBoardReserve3D) window.updateBoardReserve3D();
    
    // Check for game end: less than 1 die? 
    // AI KNOWLEDGE: "DIMINISH" is a strategic move where a player reduces the value of one of their stones (value > 1) by 1.
    // This action is only allowed if the opponent has at least one movable stone of value 1.
    // Diminishing ends the turn and triggers a "FORCED MOVE" for the opponent: they MUST move a value-1 stone next.
    // This is useful for clearing paths or forcing opponents to move critical low-value stones.
    
    const p1BoardCount = onBoardDice.filter(d => d.player === 1).length;
    const p2BoardCount = onBoardDice.filter(d => d.player === 2).length;
    
    // Total dice available to player
    const p1TotalDice = p1BoardCount + reserveDice[1];
    const p2TotalDice = p2BoardCount + reserveDice[2];

    if (p1TotalDice < 4 || p2TotalDice < 4) {
        const loser = p1TotalDice < 4 ? 1 : 2;
        const winner = 3 - loser;
        const losingDiceCount = p1TotalDice < 4 ? p1TotalDice : p2TotalDice;
        gamePhase = 'GAME_OVER';

        if (messageBox) messageBox.textContent = `GAME OVER! Player ${winner} wins!`;
        toggleActionButtons(false, false);
        showGameOverModal(
            `Player ${winner} Wins!`,
            `Player ${winner} wins! Player ${loser} has fewer than four dice left (Total: ${losingDiceCount}).`
        );
    }

    // Sync 3D if available
    if (window.syncBoard3D) {
        window.syncBoard3D();
    }
}

function showGameOverModal(title, text) {
    // Title is removed from modal, only text is shown
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
 * Toggles action button states
 */
function toggleActionButtons(enableActions, showCancel) {
    const isForcedTurn = gamePhase === 'FORCED_MOVE_SELECT' || (selectedDie && selectedDie.isForcedMove);

    // Update Floating Diminish Button state
    if (window.updateDiminishButtonAlias) {
        // Diminish button should pop up ONLY when a specific stone is selected for movement (STRIDE_MOVE phase)
        // and only if that stone hasn't started moving yet.
        const canDiminish = !isForcedTurn && (gamePhase === 'STRIDE_MOVE');
        window.updateDiminishButtonAlias(canDiminish);
    }

    // Toggle other action buttons
    if (window.is3DView) {
        if (btnPlace) btnPlace.style.display = 'none';
    } else {
        if (btnPlace) {
            btnPlace.style.display = 'inline-block';
            btnPlace.disabled = isForcedTurn || !enableActions || reserveDice[currentPlayer] === 0;
        }
    }
    
    if (btnCancel) btnCancel.style.display = (showCancel && !isForcedTurn) ? 'inline-block' : 'none';

    if (gamePhase === 'ACTION_SELECT') {
        if (!window.is3DView && btnPlace) btnPlace.disabled = reserveDice[currentPlayer] === 0;
    } 
}

function canAnyOwnStoneDiminish() {
    return onBoardDice.some(d => d.player === currentPlayer && d.value > 1) && canAnyMovableOpponentOne();
}

function canAnyMovableOpponentOne() {
    const opponent = 3 - currentPlayer;
    const opponentOneStones = onBoardDice.filter(d => d.player === opponent && d.value === 1);
    const movable = opponentOneStones.filter(stone => {
        const tgts = calculateStrideTargets(stone.r, stone.c, 1, opponent);
        return tgts.length > 0;
    });
    const movableCandidates = movable.map(d => `${d.r},${d.c}`);
    console.log(`Diminish Rule Check: Opponent ${opponent} has ${opponentOneStones.length} value-1 stones. Movable: [${movableCandidates.join(' | ')}] Result: ${movable.length > 0}`);
    return movable.length > 0;
}

/**
 * Renders the game board
 */
function renderBoard(highlightSquares = [], highlightType = 'move-target') {
    if (!boardContainer) {
        // Fallback or debug removed as requested.
        return;
    }
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
    
    // Sync 3D Highlights
    if (gamePhase === 'STRIDE_MOVE' && selectedDie) {
        if (window.showStrideTargets3D) {
            window.showStrideTargets3D(highlightSquares);
        }
        if (window.updateDiminishButtonAlias) {
            window.updateDiminishButtonAlias(true);
        }
    }
}

/**
 * Checks if a die can be picked up from the reserve
 */
window.canPickDie = function(player) {
    return gamePhase === 'ACTION_SELECT' && player === currentPlayer && reserveDice[currentPlayer] > 0;
};

window.handleDiePickup = function(player) {
    if (!window.canPickDie(player)) return false;

    // Enter placement mode - reserve will be decremented when actually placing
    gamePhase = 'PLACE';
    messageBox.textContent = `Select stone. Click an empty square to place.`;
    
    return true;
};

/**
 * Handles clicks from the 3D scene
 * RULES:
 * - Place: Click empty field → places stone (reserve - 1)
 * - Move: Click own stone → shows 1-field targets
 * - Each click = 1 field moved
 * - After moving [value] fields: turn ends, value increases by 1 (6→1)
 * - Can change direction between clicks
 * - Stones with value 1 are indestructible (cannot be captured)
 */
window.handle3DClick = function(r, c) {
    try {
    if (gamePhase === 'GAME_OVER') return;
    if (!isWithinBounds(r, c)) return;
    
    const die = onBoardDice.find(d => d.r === r && d.c === c);

    if (gamePhase === 'ACTION_SELECT') {
        // Place stone on empty field
        if (!die && reserveDice[currentPlayer] > 0) {
            reserveDice[currentPlayer]--;
            currentDieId++;
            const newDie = {
                id: currentDieId,
                value: 1,
                r: r,
                c: c,
                player: currentPlayer
            };
            onBoardDice.push(newDie);

            if (window.syncBoard3D) window.syncBoard3D();
            renderBoard();
            endTurn(`Player ${currentPlayer} placed a stone.`);
            return;
        }
        
        // Click on own stone - select for movement
        if (die && die.player === currentPlayer) {
            // If clicking same stone - cancel selection
            if (selectedDie && selectedDie.id === die.id) {
                selectedDie = null;
                gamePhase = 'ACTION_SELECT';
                if (window.clearStrideTargets3D) window.clearStrideTargets3D();
                if (window.hideDiminishButton) window.hideDiminishButton();
                if (window.syncBoard3D) window.syncBoard3D();
                renderBoard();
                messageBox.textContent = `Player ${currentPlayer}'s turn. Click empty field to place, or stone to move.`;
                return;
            }
            
            // Check if this stone has any legal moves
            const validTargets = calculateStrideTargets(die.r, die.c, 1, currentPlayer);
            if (validTargets.length === 0) {
                messageBox.textContent = `Stone at that position has no legal moves. Pick a different stone.`;
                return;
            }
            
            // Select this stone for movement
            selectedDie = die;
            selectedDie.stepsTaken = 0;
            selectedDie.strideStartR = die.r;
            selectedDie.strideStartC = die.c;
            gamePhase = 'STRIDE_MOVE';
            
            const remaining = die.value;
            messageBox.textContent = `Move ${remaining} step(s) — select one highlighted field at a time (or click DIMINISH)`;
            messageBox.classList.remove('hidden');
            
            // Unified call to renderBoard which handles both 2D and 3D highlights
            renderBoard(validTargets);
            return;
        }
    } else if (gamePhase === 'STRIDE_MOVE') {
        if (!selectedDie) {
            gamePhase = 'ACTION_SELECT';
            if (window.clearStrideTargets3D) window.clearStrideTargets3D();
            return;
        }
        
        // Click on the same (already selected & moving) stone
        if (die && die.id === selectedDie.id) {
            if (selectedDie.stepsTaken === 0) {
                // No steps taken yet — cancel the selection, go back to ACTION_SELECT
                selectedDie = null;
                gamePhase = 'ACTION_SELECT';
                if (window.clearStrideTargets3D) window.clearStrideTargets3D();
                if (window.hideDiminishButton) window.hideDiminishButton();
                if (window.syncBoard3D) window.syncBoard3D();
                renderBoard();
                messageBox.textContent = `Player ${currentPlayer}'s turn. Click empty field to place, or stone to move.`;
            } else {
                // Already moving — re-clicking the stone is not allowed mid-move
                messageBox.textContent = `You must complete the move: ${selectedDie.value - selectedDie.stepsTaken} step(s) remaining.`;
            }
            return;
        }
        
        // Click on a different own stone — only allowed if no steps have been taken yet
        if (die && die.player === currentPlayer) {
            if (selectedDie.stepsTaken > 0) {
                // Mid-move: cannot switch stones
                messageBox.textContent = `Cannot switch stone mid-move. Complete the current move: ${selectedDie.value - selectedDie.stepsTaken} step(s) remaining.`;
                return;
            }
            // Switch selection (no steps taken yet)
            selectedDie = die;
            selectedDie.stepsTaken = 0;
            selectedDie.strideStartR = die.r;
            selectedDie.strideStartC = die.c;
            
            const canDimThisOne = die.value > 1 && canAnyMovableOpponentOne();
            if (window.updateDiminishButton) {
                window.updateDiminishButton(canDimThisOne, die.id);
            }
            
            const validTargets = calculateStrideTargets(die.r, die.c, 1, currentPlayer);
            if (window.showStrideTargets3D) {
                window.showStrideTargets3D(validTargets);
            }
            
            const remaining = die.value - die.stepsTaken;
            messageBox.textContent = `Move ${remaining} more field(s) (1 field per click)`;
            renderBoard();
            return;
        }
        
        // Check if clicked on a valid 1-field target
        const validTargets = calculateStrideTargets(selectedDie.r, selectedDie.c, 1, currentPlayer);
        const isValidTarget = validTargets.some(t => t.r === r && t.c === c);
        
        if (isValidTarget) {
            // Move to target (1 field only)
            const targetDie = onBoardDice.find(d => d.r === r && d.c === c);
            
            // Capture opponent's stone (not value 1) - STONE IS REMOVED, NOT RETURNED
            if (targetDie && targetDie.player !== currentPlayer && targetDie.value > 1) {
                const capturedIdx = onBoardDice.indexOf(targetDie);
                if (capturedIdx > -1) {
                    onBoardDice.splice(capturedIdx, 1);
                }
            }
            
            // Move the stone 1 field
            selectedDie.r = r;
            selectedDie.c = c;
            selectedDie.stepsTaken++;
            
            console.log('STRIDE: moved to', r, c, 'steps taken:', selectedDie.stepsTaken, 'total value:', selectedDie.value);
            
            if (window.syncBoard3D) window.syncBoard3D();
            renderBoard();
            
            // Check if STRIDE is complete
            if (selectedDie.stepsTaken >= selectedDie.value) {
                // STRIDE complete — end turn, increase value
                const completedVal = selectedDie.value;
                selectedDie.value = completedVal >= 6 ? 1 : completedVal + 1;
                selectedDie.stepsTaken = 0;
                selectedDie = null;
                gamePhase = 'ACTION_SELECT';
                if (window.clearStrideTargets3D) window.clearStrideTargets3D();
                if (window.hideDiminishButton) window.hideDiminishButton();
                if (window.syncBoard3D) window.syncBoard3D();
                endTurn(`Player ${currentPlayer} completed move (${completedVal} step(s)). Value now ${completedVal >= 6 ? 1 : completedVal + 1}.`);
                return;
            } else {
                // Continue STRIDE — show next 1-field targets
                const remainingTargets = calculateStrideTargets(selectedDie.r, selectedDie.c, 1, currentPlayer);
                if (remainingTargets.length === 0) {
                    // Blocked mid-move — end turn, value still increases
                    const completedVal = selectedDie.value;
                    selectedDie.value = completedVal >= 6 ? 1 : completedVal + 1;
                    selectedDie.stepsTaken = 0;
                    selectedDie = null;
                    gamePhase = 'ACTION_SELECT';
                    if (window.clearStrideTargets3D) window.clearStrideTargets3D();
                    if (window.hideDiminishButton) window.hideDiminishButton();
                    if (window.syncBoard3D) window.syncBoard3D();
                    endTurn(`Movement blocked. Value increased to ${completedVal >= 6 ? 1 : completedVal + 1}.`);
                    return;
                }
                if (window.showStrideTargets3D) {
                    window.showStrideTargets3D(remainingTargets);
                }
                const remaining = selectedDie.value - selectedDie.stepsTaken;
                messageBox.textContent = `Move ${remaining} more field(s) (1 field per click)`;

                // Hide diminish button once movement has started
                if (window.hideDiminishButton) window.hideDiminishButton();
            }
            return;
        }
    } else if (gamePhase === 'FORCED_MOVE_SELECT') {
        console.log('handle3DClick: FORCED_MOVE_SELECT phase!');
        // Must move a value-1 stone
        if (die && die.player === currentPlayer && die.value === 1) {
            // Clear grey stones when selecting valid stone
            if (window.clearGreyStones3D) window.clearGreyStones3D();
            
            // Start STRIDE with value 1 (1 field only)
            selectedDie = die;
            selectedDie.stepsTaken = 0;
            gamePhase = 'STRIDE_MOVE';
            
            const validTargets = calculateStrideTargets(die.r, die.c, 1, currentPlayer);
            
            if (window.showStrideTargets3D) {
                window.showStrideTargets3D(validTargets);
            }
            
            messageBox.textContent = `FORCED: Move this value-1 stone 1 field (then value becomes 2)`;
            renderBoard(validTargets);
            return;
        } else if (die && die.player === currentPlayer) {
            console.log('handle3DClick: clicked non-value-1 stone, showing error');
            messageBox.textContent = `FORCED: You MUST select a value-1 stone!`;
        }
    }
    } catch(e) { console.error('handle3DClick error:', e); }
};

// Cancel current action
window.cancelAction3D = function() {
    if (gamePhase === 'FORCED_MOVE_SELECT') return;
    
    if (window.clearStrideTargets3D) window.clearStrideTargets3D();
    if (window.hideDiminishButton) window.hideDiminishButton();
    
    selectedDie = null;
    gamePhase = 'ACTION_SELECT';
    messageBox.textContent = `Player ${currentPlayer}'s turn. Click empty field to place, or stone to move.`;
    renderBoard();
};

/**
 * Calculate valid STRIDE movement targets
 * Returns array of {r, c} positions reachable in straight lines (horizontal/vertical)
 * Up to maxSteps fields away
 */
function calculateStrideTargets(stoneR, stoneC, maxSteps, player) {
    const targets = [];
    const directions = [
        { dr: -1, dc: 0 },  // North
        { dr: 1, dc: 0 },   // South
        { dr: 0, dc: -1 },  // West
        { dr: 0, dc: 1 }    // East
    ];
    
    for (const dir of directions) {
        for (let step = 1; step <= maxSteps; step++) {
            const targetR = stoneR + dir.dr * step;
            const targetC = stoneC + dir.dc * step;
            
            if (!isWithinBounds(targetR, targetC)) break;
            
            const targetDie = onBoardDice.find(d => d.r === targetR && d.c === targetC);
            
            // Empty field - valid target
            if (!targetDie) {
                targets.push({ r: targetR, c: targetC });
            }
            // Own stone - can't move past
            else if (targetDie.player === player) {
                break;
            }
            // Opponent's stone - can capture if value > 1
            else if (targetDie.value > 1) {
                targets.push({ r: targetR, c: targetC });
                break; // Can't move past captured stone
            }
            // Opponent's value 1 - can't capture
            else {
                break;
            }
        }
    }
    
    return targets;
};
window.calculateStrideTargets = calculateStrideTargets;

// ============================================
// TURN MANAGEMENT
// ============================================

/**
 * Switches to the next player's turn
 */
function switchTurn() {
    console.log('switchTurn: START, currentPlayer=', currentPlayer, 'forcedTurnActive=', forcedTurnActive);
    
    // Clear any STRIDE targets when switching turns
    if (window.clearStrideTargets3D) {
        window.clearStrideTargets3D();
    }
    // Track AI consecutive moves to prevent loops
    if (currentPlayer === 2 && selectedDie) {
        if (aiLastMovedStoneId === selectedDie.id) {
            aiConsecutiveMoveCount++;
        } else {
            aiLastMovedStoneId = selectedDie.id;
            aiConsecutiveMoveCount = 1;
        }
    } else if (currentPlayer === 1) {
        aiLastMovedStoneId = null;
        aiConsecutiveMoveCount = 0;
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    console.log('switchTurn: after switch, currentPlayer=', currentPlayer, 'forcedTurnActive=', forcedTurnActive);

    if (forcedTurnActive) {
        gamePhase = 'FORCED_MOVE_SELECT';
        console.log('switchTurn: SET FORCED_MOVE_SELECT!');
        forcedTurnActive = false;

        if (messageBox) {
            if (!messageBox.innerHTML.includes("Diminished")) {
                messageBox.textContent = `FORCED MOVE: Player ${currentPlayer}, you must select and move one of your value 1 dice.`;
            } else {
                // Prepend forced move message to existing Diminished message
                messageBox.textContent = `FORCED: Player ${currentPlayer} - Choose a value 1 die.`;
            }
            messageBox.classList.remove('hidden');
        }
        toggleActionButtons(false, true);

        const movableOnes = onBoardDice.filter(d =>
            d.player === currentPlayer &&
            d.value === 1 &&
            calculateStrideTargets(d.r, d.c, 1, d.player).length > 0
        );

        // Sync 3D view so it sees the FORCED_MOVE_SELECT phase and shows orange markers
        if (window.syncBoard3D) window.syncBoard3D();

        const movableDieCoords = movableOnes.map(d => ({ r: d.r, c: d.c }));
        renderBoard(movableDieCoords);
        
        // Grey out non-movable stones in 3D (must happen after syncBoard3D as meshes are recreated)
        const allPlayerStones = onBoardDice.filter(d => d.player === currentPlayer);
        const movableIds = new Set(movableOnes.map(d => d.id));
        const greyedIds = allPlayerStones.filter(d => !movableIds.has(d.id)).map(d => d.id);
        if (window.greyOutStones3D) window.greyOutStones3D(greyedIds);
    } else {
        gamePhase = 'ACTION_SELECT';
        selectedDie = null;
    if (messageBox) {
        messageBox.textContent = `Player ${currentPlayer}'s turn. Select a stone to move, or an empty square to place.`;
        messageBox.classList.remove('hidden');
    }
        toggleActionButtons(true, false);
        renderBoard();

        // Clear any grey stones from previous forced turn
        if (window.clearGreyStones3D) window.clearGreyStones3D();

        /*
        if (isAIGame && currentPlayer === 2 && gamePhase !== 'GAME_OVER') {
            setTimeout(makeAIMove, 800);
        }
        */
    }
    
    // Update visual indicators
    updateStatusDisplay();
    if (window.updateTurnIndicator3D) {
        window.updateTurnIndicator3D(currentPlayer);
    }
    
    // Hide diminish button and sync 3D on turn change
    if (window.hideDiminishButton) window.hideDiminishButton();
    if (window.syncBoard3D) window.syncBoard3D();
}

/**
 * Ends the current turn
 */
function endTurn(message) {
    switchTurn();
}

// ============================================
// ACTION HANDLERS
// ============================================



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

    if (window.animateMove3D && window.is3DView) {
        window.animateMove3D(selectedDie.id, targetR, targetC, () => {
            selectedDie.r = targetR;
            selectedDie.c = targetC;
            selectedDie.movesLeft--;
            
            // Hide diminish button once movement has started
            if (window.hideDiminishButton) window.hideDiminishButton();
            
            finishMove(captureMessage, targetR, targetC);
        });
    } else {
        selectedDie.r = targetR;
        selectedDie.c = targetC;
        selectedDie.movesLeft--;
        
        // Hide diminish button once movement has started
        if (window.hideDiminishButton) window.hideDiminishButton();
        
        finishMove(captureMessage, targetR, targetC);
    }
}

function finishMove(captureMessage, targetR, targetC) {
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

    // Update stone strength display in 3D
    if (window.updateStoneStrength3D) {
        window.updateStoneStrength3D(selectedDie.id, selectedDie.value);
    }

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
        
        // Update stone strength display in 3D
        if (window.updateStoneStrength3D) {
            window.updateStoneStrength3D(selectedDie.id, selectedDie.value);
        }

        forcedTurnActive = true;
        renderBoard();
        setTimeout(switchTurn, 1500);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
if (btnPlace) btnPlace.addEventListener('click', () => {
    if (window.handleDiePickup) window.handleDiePickup(currentPlayer);
});

if (btnCancel) btnCancel.addEventListener('click', () => {
    if (window.cancelAction3D) window.cancelAction3D();
});

let _opponentBtnTimeout = null;
/*
if (opponentButton) opponentButton.addEventListener('click', () => {
    isAIGame = !isAIGame;
    opponentButton.textContent = isAIGame ? 'Opponent: Computer' : 'Opponent: Human';
    
    // If it's black's turn and we just switched to computer, start AI immediately
    if (isAIGame && currentPlayer === 2 && gamePhase !== 'GAME_OVER') {
        setTimeout(makeAIMove, 600);
    }
});
*/


// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    if (gamePhase === 'GAME_OVER' || currentPlayer !== 2) return;

    // FORCED MOVE HANDLING FOR AI
    if (gamePhase === 'FORCED_MOVE_SELECT') {
        const movableOnes = onBoardDice.filter(d => d.player === 2 && d.value === 1 && calculateStrideTargets(d.r, d.c, 1, 2).length > 0);
        if (movableOnes.length > 0) {
            const die = movableOnes[Math.floor(Math.random() * movableOnes.length)];
            const tgts = calculateStrideTargets(die.r, die.c, 1, 2);
            const target = tgts[Math.floor(Math.random() * tgts.length)];
            
            executeMove(die, target.r, target.c);
            return;
        } else {
            // Should not happen if Diminish rules are obeyed, but safety fallback:
            endTurn("Opponent had no forced move available.");
            return;
        }
    }

    // AI will evaluate three types of actions:

    let bestAction = null;
    let bestScore = -Infinity;

    // Helper: evaluate board state from black's perspective
    const evaluateState = () => {
        let score = 0;
        const wCount = onBoardDice.filter(d => d.player === 1).length;
        const bCount = onBoardDice.filter(d => d.player === 2).length;

        // Win/Loss heavily weighted
        if (wCount + reserveDice[1] < 4) return 10000; // Black wins
        if (bCount + reserveDice[2] < 4) return -10000; // White wins

        // Dice advantage
        score += (bCount - wCount) * 50;

        // Value advantage (higher dice are more powerful)
        onBoardDice.forEach(d => {
            if (d.player === 2) score += d.value * 2;
            else score -= d.value * 2;
        });

        // Board presence (center control)
        onBoardDice.forEach(d => {
            // Rough distance to center (5,5)
            const dist = Math.abs(5 - d.r) + Math.abs(5 - d.c);
            if (d.player === 2) {
                score += (10 - dist);
            }
        });

        return score;
    };

    // Evaluate PLACE
    if (reserveDice[2] > 0) {
        // Collect empty squares
        const emptySquares = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (isWithinBounds(r, c) && !onBoardDice.some(d => d.r === r && d.c === c)) {
                    emptySquares.push({ r, c });
                }
            }
        }

        // Try placing in safe/strategic spots (simplified to a random empty spot score)
        if (emptySquares.length > 0) {
            // Simulate place
            reserveDice[2]--;
            const newDie = { id: 999, value: 1, r: -1, c: -1, player: 2 }; // temp
            onBoardDice.push(newDie);

            // Sample a few empty spots to evaluate
            for (let i = 0; i < Math.min(3, emptySquares.length); i++) {
                const sq = emptySquares[i];
                newDie.r = sq.r; newDie.c = sq.c;

                let score = evaluateState();
                // Add slight bonus for placing
                score += 15;
                if (score > bestScore) {
                    bestScore = score;
                    bestAction = { type: 'PLACE', target: sq };
                }
            }
            // Revert
            onBoardDice.pop();
            reserveDice[2]++;
        }
    }

    // Evaluate DIMINISH (Not fully implemented in the simple greedy AI to keep it "Medium" and avoid complex forced moves generation)
    // For simplicity, Medium AI focuses on placing and striding.

    // Evaluate STRIDE MOVES
    // This requires recursively finding all stride paths. For a simple greedy bot, we just find the BEST immediate capture 
    // or a single step that improves position.

    // Simplification for Medium AI:
    // AI finds all dice it can move. For each die, it looks at reachable squares.
    // If it can capture a white die, BIG BONUS.
    // If it can move closer to the center, SMALL BONUS.

    // We need to bypass the UI click handlers and directly compute reachability.
    // However, since Stride can be multiple steps, computing full reachability recursively is complex.
    // We will just do a BFS to find all reachable endpoints within `value` steps.
    const getReachable = (startR, startC, maxSteps) => {
        let queue = [{ r: startR, c: startC, steps: 0, path: [] }];
        const visited = new Set([`${startR},${startC}`]);
        const endpoints = [];

        while (queue.length > 0) {
            const current = queue.shift();

            // If we've reached max steps, or we hit an enemy (capture ends turn), it's an endpoint
            if (current.steps === maxSteps) {
                endpoints.push(current);
                continue;
            }

            let moved = false;
            HV_VECTORS.forEach(v => {
                const nr = current.r + v.dr;
                const nc = current.c + v.dc;
                if (isWithinBounds(nr, nc)) {
                    const occupant = onBoardDice.find(d => d.r === nr && d.c === nc);
                    // Can only move to empty or opponent's die > 1
                    if (!occupant || (occupant.player === 1 && occupant.value > 1)) {
                        const key = `${nr},${nc}`;
                        if (!visited.has(key)) {
                            visited.add(key);
                            moved = true;
                            const nextState = { r: nr, c: nc, steps: current.steps + 1, path: [...current.path, { r: nr, c: nc }] };
                            // If it's a capture, it *must* stop the chain (stride rule: land on opponent = removed, continue remaining. Ah wait.
                            // Rule: "moving die may continue its remaining movement". 
                            // Meaning we CAN pass through enemies. This is complex BFS. Let's just treat every valid step as part of the tree.
                            queue.push(nextState);

                            // Every node is theoretically a valid ending position if we decide to stop? NO, Stride forces exactly `value` steps.
                            // Wait, rules say "Move horizontally/vertically a number of spaces EQUAL to its face value".
                            // So we MUST move `value` steps.
                            if (nextState.steps === maxSteps) {
                                endpoints.push(nextState);
                            }
                        }
                    }
                }
            });
            // If blocked before max steps, the rules say "Movement blocked... Turn ends". 
            // So if `!moved` and `steps < maxSteps`, it is a valid endpoint (premature end).
            if (!moved && current.steps > 0 && current.steps < maxSteps) {
                endpoints.push(current);
            }
        }
        return endpoints;
    };

    const myDice = onBoardDice.filter(d => d.player === 2);

    // If forced turn, AI MUST move a 1-value die.
    if (gamePhase === 'FORCED_MOVE_SELECT') {
        const forcedDice = myDice.filter(d => d.value === 1 && calculateStrideTargets(d.r, d.c, 1, d.player).length > 0);
        if (forcedDice.length > 0) {
            // Pick a random forced die
            const dieToMove = forcedDice[Math.floor(Math.random() * forcedDice.length)];
            const tgts = calculateStrideTargets(dieToMove.r, dieToMove.c, 1, 2);
            bestAction = { type: 'STRIDE', die: dieToMove, path: [tgts[0]] }; // Just take first valid
        }
    } else {
        myDice.forEach(die => {
            const endpoints = getReachable(die.r, die.c, die.value);
            endpoints.forEach(ep => {
                // Heuristic score for this endpoint
                let score = 0;
                // Count captures in path
                let captures = 0;
                ep.path.forEach(step => {
                    const occ = onBoardDice.find(d => d.r === step.r && d.c === step.c);
                    if (occ && occ.player === 1) captures++;
                });

                score += captures * 200;

                // Position bonus
                const dist = Math.abs(5 - ep.r) + Math.abs(5 - ep.c);
                score += (10 - dist) * 2;

                // Loop Prevention: Penalize moving the same stone too many times in a row
                if (gamePhase !== 'FORCED_MOVE_SELECT' &&
                    aiLastMovedStoneId === die.id) {
                    if (aiConsecutiveMoveCount >= 2) score -= 300;
                    else if (aiConsecutiveMoveCount >= 1) score -= 50;
                }

                // Add random tiebreaker
                score += Math.random() * 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestAction = { type: 'STRIDE', die: die, path: ep.path, steps: ep.steps };
                }
            });
        });
    }

    if (!bestAction && bestScore === -Infinity) {
        // Fallback: Just place randomly or diminish randomly if stuck
        handlePlaceAction();
        // Since place involves UI clicks, AI needs to simulate it.
        // The evaluate PLACE block above should catch this usually.
        // If really nothing, end turn.
        endTurn("Black passes.");
        return;
    }

    // Execution
    if (bestAction.type === 'PLACE') {
        // AI directly uses 3D click point for placement
        console.log('AI Action: PLACE at', bestAction.target.r, bestAction.target.c);
        window.handle3DClick(bestAction.target.r, bestAction.target.c);
    } else if (bestAction.type === 'STRIDE') {
        // AI uses 3D click point for selection and execution
        console.log('AI Action: STRIDE with stone ID', bestAction.die.id, 'path len', bestAction.path.length);
        
        // 1. Select the die
        window.handle3DClick(bestAction.die.r, bestAction.die.c);

        // 2. Execute path steps sequentially
        let pathIdx = 0;
        const execStep = () => {
            // Confirm we are in STRIDE_MOVE before proceeding
            if (pathIdx < bestAction.path.length && (gamePhase === 'STRIDE_MOVE' || gamePhase === 'ACTION_SELECT')) {
                const step = bestAction.path[pathIdx];
                window.handle3DClick(step.r, step.c);
                pathIdx++;
                if (pathIdx < bestAction.path.length) {
                    setTimeout(execStep, 450); 
                }
            }
        };
        setTimeout(execStep, 450);
    }
}


// ============================================
// INITIALIZATION
// ============================================

function startNewGame() {
    currentDieId = 0;
    onBoardDice = [];
    reserveDice = { 1: 8, 2: 8 };
    currentPlayer = 1;
    gamePhase = 'ACTION_SELECT';
    forcedTurnActive = false;
    selectedDie = null;

    toggleActionButtons(true, false);
    renderBoard();
    hideGameOverModal();
    messageBox.classList.remove('hidden');
    messageBox.textContent = "Player 1's turn. Select a stone to move, or an empty square to place.";
    
    if (window.syncBoard3D) {
        window.syncBoard3D();
    }
    if (window.clearGreyStones3D) {
        window.clearGreyStones3D();
    }
    if (window.updateDiminishButton) {
        window.updateDiminishButton(false);
    }
}

newGameBtn.addEventListener('click', startNewGame);
if (resetBtnMain) resetBtnMain.addEventListener('click', startNewGame);

const menuBtnModal = document.getElementById('menu-btn-modal');
if (menuBtnModal) {
    menuBtnModal.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Spacebar to toggle side menu
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input, textarea, button')) {
        e.preventDefault();
        const sm = document.getElementById('side-menu');
        const mt = document.getElementById('menu-toggle');
        if (sm) sm.classList.toggle('open');
        if (mt) mt.classList.toggle('active');
    }
});

const overlay = document.getElementById('overlay');
if (overlay) overlay.addEventListener('click', () => {
    if (sideMenuEl) sideMenuEl.classList.remove('open');
    if (menuToggleEl) menuToggleEl.classList.remove('active');
});



function showRules() {
    alert("STATUE RULES:\n1. Each player has 8 dice in reserve (forming the throne legs).\n2. On your turn, either PLACE a die on any empty square, MOVE one of your dice, or DIMINISH one of your dice.\n3. MOVE: Step adjacent, then rotate to increase value (1-6). If value is 1, you MUST move.\n4. DIMINISH: Decrease a die's value by 1 (cannot go below 1).\n5. CAPTURE: Land on or skip over an opponent's die of lower value to capture it (send back to reserve).");
}

// Test function to manually place a stone
window.testPlaceStone = function(r, c) {
    if (r === undefined) r = 5;
    if (c === undefined) c = 5;
    console.log('Test place at', r, c);
    if (window.handle3DClick) {
        window.handle3DClick(r, c);
    }
};

// Diminish Button Functions
window.showDiminishButton = function() {};
window.hideDiminishButton = function() {
    if (window.updateDiminishButton) window.updateDiminishButton(false);
};
window.updateDiminishButtonAlias = function(enabled) {
    if (window.updateDiminishButton) {
        // Diminish logic: Stone must have value > 1 AND opponent must have at least one movable value-1 stone
        const targetDie = (window.getSelectedDie ? window.getSelectedDie() : selectedDie) || null;
        
        // Disable diminish if the stone has already taken any steps in its current move
        const hasMoved = targetDie && (targetDie.stepsTaken > 0);
        const canDimThisOne = targetDie && targetDie.value > 1 && canAnyMovableOpponentOne();
        
        const finalEnabled = enabled && !hasMoved && canDimThisOne;
        
        console.log(`%c STATUS: PHASE=${gamePhase} | SELECTED=${targetDie?.id} | VALUE=${targetDie?.value} | CAN_DIM=${canDimThisOne} `, "background: #800; color: #fff; font-weight: bold;");

        if (finalEnabled && targetDie) {
            window.updateDiminishButton(true, targetDie.id);
        } else {
            window.updateDiminishButton(false, null);
        }
    }
};

// Cancel current action
window.cancelAction3D = function() {
    if (gamePhase === 'FORCED_MOVE_SELECT') return;
    
    if (window.clearStrideTargets3D) window.clearStrideTargets3D();
    if (window.hideDiminishButton) window.hideDiminishButton();
    
    selectedDie = null;
    gamePhase = 'ACTION_SELECT';
    messageBox.textContent = `Player ${currentPlayer}'s turn. Select a stone to move, or an empty square to place.`;
    renderBoard();
};

window.diminishSelectedStone = function() {
    console.log('DIMINISH: Function called. SelectedDie:', selectedDie ? selectedDie.id : 'null');
    
    if (!selectedDie) {
        // Find if user has a stone that COULD be diminished
        const candidates = onBoardDice.filter(d => d.player === currentPlayer && d.value > 1 && canAnyMovableOpponentOne());
        if (candidates.length === 1) {
            selectedDie = candidates[0];
            console.log('DIMINISH: auto-selecting stone', selectedDie.id);
        } else if (candidates.length > 1) {
            if (messageBox) {
                messageBox.textContent = "SELECT: Click one of your stones (> 1) first to diminish it.";
                messageBox.classList.remove('hidden');
            }
            return;
        } else {
            if (messageBox) {
                messageBox.textContent = "Cannot diminish: No eligible stones or opponent has no movable 1-dice.";
            }
            console.log('DIMINISH: Rule failure - no candidates');
            return;
        }
    }
    
    if (selectedDie.value <= 1) {
        console.log('DIMINISH: Rule failure - value is 1');
        messageBox.textContent = "Cannot diminish: Stone value must be > 1.";
        return;
    }

    const opponent = 3 - currentPlayer;
    if (!canAnyMovableOpponentOne()) {
        console.log('DIMINISH: Rule failure - opponent has no movable 1-dice');
        messageBox.textContent = `Diminish failed: Player ${opponent} has no movable value-1 dice.`;
        return;
    }
    
    console.log('DIMINISH: SUCCESS, reducing value for stone', selectedDie.id);
    selectedDie.value -= 1;
    
    forcedTurnActive = true;
    const diminishingId = selectedDie.id;
    selectedDie = null; 
    gamePhase = 'ACTION_SELECT';
    
    if (window.clearStrideTargets3D) window.clearStrideTargets3D();
    if (window.hideDiminishButton) window.hideDiminishButton();
    if (window.syncBoard3D) window.syncBoard3D();
    
    endTurn();
};

function toggleView() {
    const body = document.body;
    const is3D = body.classList.toggle('view-3d');
    window.is3DView = is3D;
    
    const canvas = document.getElementById('canvas3d');
    const board2d = document.getElementById('board-container');
    
    if (is3D) {
        if (canvas) canvas.style.display = 'block';
        if (board2d) board2d.style.display = 'none';
        if (window.init3D && !window._3DInitialized) {
            window.init3D();
            window._3DInitialized = true;
        }
        if (window.syncBoard3D) window.syncBoard3D();
    } else {
        if (canvas) canvas.style.display = 'none';
        if (board2d) board2d.style.display = 'grid';
        renderBoard();
    }
}

window.addEventListener('load', function() {
    startNewGame();
    // Initialize diminish button as visible but disabled
    if (window.updateDiminishButton) {
        window.updateDiminishButton(false);
    }
});
