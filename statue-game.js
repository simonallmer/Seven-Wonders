// STATUE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS / BOARD CONFIG
// ============================================
// 2-player: a single 11x11 board.
// 4-player: two 11x11 boards stacked into one 11-wide x 22-tall arena (board A = rows 0-10,
// board B = rows 11-21). Each board keeps its throne + four 2x2 feet, so the open "+" cross
// shows up twice and a contested 6x11 band (rows 8-13) emerges naturally between the thrones.
let numPlayers = 2;
let BOARD_ROWS = 11;
let BOARD_COLS = 11;
let BOARD_SIZE = 11; // legacy alias (== BOARD_COLS); kept for older references

// Throne footprint of one 11x11 board: four 2x2 feet around the open central cross.
const THRONE_HOLES_A = [
    '3,3', '3,4', '4,3', '4,4',
    '3,6', '3,7', '4,6', '4,7',
    '6,3', '6,4', '7,3', '7,4',
    '6,6', '6,7', '7,6', '7,7'
];
let removedSquares = new Set(THRONE_HOLES_A);
window.removedSquares = removedSquares;

// Canonical Seven Wonders colours. Player ids stay 1=white, 2=black so all existing 2-player
// 3D code (stoneColors, reserve plates, clouds) keeps working; red=3, blue=4 are added for
// 4-player. Clockwise turn order matches Pyramid/Colossus/Temple: white -> red -> black -> blue.
const COLOR_OF = { 1: 'white', 2: 'black', 3: 'red', 4: 'blue' };
let turnOrder = [1, 2];
let turnIndex = 0;
let eliminated = {};      // playerId -> true once they drop below 4 dice (4-player)
let forcedPlayer = null;  // playerId the diminisher called out for a forced value-1 move (4p)

window.COLOR_OF = COLOR_OF;

// Recompute board geometry + turn order for the current player count.
function rebuildBoardConfig() {
    if (numPlayers === 4) {
        // Two 11x11 boards overlapped by their shared seam row (row 10), giving a 21-row arena.
        // Board A = rows 0-10, board B = rows 10-20; row 10 is the central divider. The throne-to-
        // throne gap is then rows 8-12 (5 rows) centred on the inaccessible divider row 10.
        BOARD_ROWS = 21;
        BOARD_COLS = 11;
        const holes = [];
        THRONE_HOLES_A.forEach(k => {
            const [r, c] = k.split(',').map(Number);
            holes.push(`${r},${c}`);        // board A
            holes.push(`${r + 10},${c}`);   // board B (shares row 10 with board A)
        });
        removedSquares = new Set(holes);
        turnOrder = [1, 3, 2, 4]; // white, red, black, blue (clockwise)
    } else {
        BOARD_ROWS = 11;
        BOARD_COLS = 11;
        removedSquares = new Set(THRONE_HOLES_A);
        turnOrder = [1, 2];
    }
    BOARD_SIZE = BOARD_COLS;
    window.removedSquares = removedSquares;
    window.BOARD_ROWS = BOARD_ROWS;
    window.BOARD_COLS = BOARD_COLS;
    window.numPlayers = numPlayers;
}

// Home zones (4-player only): you may PLACE only inside your own quadrant, but you may MOVE
// and capture anywhere (Gardens-style "run over to the other board").
// Seats run CLOCKWISE white -> red -> black -> blue with white on the near board (where the
// camera opens), so the corners read bottom-left -> top-left -> top-right -> bottom-right:
//   White(1): board B (rows 11-20), left  (cols 0-4)   near-left  -> starts here, camera faces it
//   Red(3):   board A (rows 0-9),   left  (cols 0-4)   far-left
//   Black(2): board A (rows 0-9),   right (cols 6-10)  far-right
//   Blue(4):  board B (rows 11-20), right (cols 6-10)  near-right
// White & black sit diagonally opposite (as do red & blue), preserving the classic axis.
// Column 5 (throne cross), row 10 (central divider) and removed squares are unplaceable.
function isHomeCell(player, r, c) {
    if (numPlayers !== 4) return true;
    if (r === 10) return false;          // central divider: traversable but no placement
    const boardA = r < 10;               // far board, rows 0-9
    const boardB = r > 10;               // near board, rows 11-20
    const left = c <= 4;
    const right = c >= 6;
    switch (player) {
        case 1: return boardB && left;   // white (near-left)
        case 3: return boardA && left;   // red   (far-left)
        case 2: return boardA && right;  // black (far-right)
        case 4: return boardB && right;  // blue  (near-right)
    }
    return false;
}
window.isHomeCell = isHomeCell;

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
let reserveDice = { 1: 8, 2: 8, 3: 8, 4: 8 };
let currentPlayer = 1; // player id (1=white, 2=black, 3=red, 4=blue)
let gamePhase = 'ACTION_SELECT'; // 'ACTION_SELECT', 'PLACE', 'STRIDE_MOVE', 'DIMINISH_SELECT', 'FORCED_MOVE_SELECT', 'GAME_OVER'
let isAIGame = true; // Start with AI enabled

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
window.isAIGame = () => isAIGame;

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
    const isBoardBound = r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS;
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
        playerIndicator.className = 'player-indicator ' + (COLOR_OF[currentPlayer] || 'white');
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
        document.getElementById('player-name').textContent = colorName(currentPlayer) + "'s Turn";
    }
    
    // Status message for 3D bar
    if (messageBox) {
        if (gamePhase === 'ACTION_SELECT' || gamePhase === 'PLACE') {
            messageBox.classList.add('hidden');
        } else if (gamePhase === 'STRIDE_MOVE' && selectedDie) {
            // Keep HUD clean as requested. Turn status is in side menu.
            messageBox.classList.add('hidden');
        }
    }

    if (p1ReserveDisplay) p1ReserveDisplay.textContent = reserveDice[1];
    if (p2ReserveDisplay) p2ReserveDisplay.textContent = reserveDice[2];
    if (p1BoardCountDisplay) p1BoardCountDisplay.textContent = onBoardDice.filter(d => d.player === 1).length;
    if (p2BoardCountDisplay) p2BoardCountDisplay.textContent = onBoardDice.filter(d => d.player === 2).length;

    // 4-player extra reserve counters (red/blue), shown only in 4-player mode.
    const p3r = document.getElementById('p3-reserve');
    const p4r = document.getElementById('p4-reserve');
    if (p3r) p3r.textContent = reserveDice[3];
    if (p4r) p4r.textContent = reserveDice[4];
    
    if (window.updateBoardReserve3D) window.updateBoardReserve3D();
    
    // Check for game end: less than 1 die? 
    // AI KNOWLEDGE: "DIMINISH" is a strategic move where a player reduces the value of one of their stones (value > 1) by 1.
    // This action is only allowed if the opponent has at least one movable stone of value 1.
    // Diminishing ends the turn and triggers a "FORCED MOVE" for the opponent: they MUST move a value-1 stone next.
    // This is useful for clearing paths or forcing opponents to move critical low-value stones.
    
    if (numPlayers === 4) {
        checkElimination4();
    } else {
        const p1TotalDice = onBoardDice.filter(d => d.player === 1).length + reserveDice[1];
        const p2TotalDice = onBoardDice.filter(d => d.player === 2).length + reserveDice[2];

        if (p1TotalDice < 4 || p2TotalDice < 4) {
            const loser = p1TotalDice < 4 ? 1 : 2;
            const winner = 3 - loser;
            gamePhase = 'GAME_OVER';

            if (messageBox) messageBox.textContent = `GAME OVER! Player ${winner} wins!`;
            toggleActionButtons(false, false);
            showGameOverModal(
                `Player ${winner} Wins!`,
                `Player ${winner} wins! Player ${loser} has fewer than four dice left!`,
                winner
            );
        }
    }

    // Sync 3D if available
    if (window.syncBoard3D) {
        window.syncBoard3D();
    }
}

// 4-player: eliminate any player who has dropped below 4 total dice (board + reserve),
// removing their remaining stones from the board. Last player standing wins.
function checkElimination4() {
    turnOrder.forEach(p => {
        if (eliminated[p]) return;
        const total = onBoardDice.filter(d => d.player === p).length + reserveDice[p];
        if (total < 4) {
            eliminated[p] = true;
            reserveDice[p] = 0;
            onBoardDice = onBoardDice.filter(d => d.player !== p);
        }
    });

    const alive = turnOrder.filter(p => !eliminated[p]);
    if (alive.length <= 1 && gamePhase !== 'GAME_OVER') {
        const winner = alive[0] || currentPlayer;
        gamePhase = 'GAME_OVER';
        const winName = colorName(winner);
        if (messageBox) messageBox.textContent = `GAME OVER! ${winName} wins!`;
        toggleActionButtons(false, false);
        showGameOverModal(`${winName} Wins!`, `${winName} is the last player standing!`, winner);
    }
}

function colorName(player) {
    const c = COLOR_OF[player] || 'white';
    return c.charAt(0).toUpperCase() + c.slice(1);
}

function showGameOverModal(title, text, winner) {
    const winnerIcon = document.getElementById('modal-winner-icon');
    if (winnerIcon) {
        winnerIcon.classList.remove('white', 'black', 'red', 'blue');
        winnerIcon.classList.add(COLOR_OF[winner] || 'white');
    }
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && title) modalTitle.textContent = title;
    modalText.textContent = text;
    gameOverModal.classList.remove('hidden');
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

// A single opponent has a value-1 stone that can move (so a forced move would be legal).
function opponentHasMovableOne(opponent) {
    if (eliminated[opponent]) return false;
    return onBoardDice.some(d =>
        d.player === opponent &&
        d.value === 1 &&
        calculateStrideTargets(d.r, d.c, 1, opponent).length > 0
    );
}

// All opponents who could legally be forced to move a value-1 stone (4-player diminish picker).
function eligibleForcedTargets() {
    return turnOrder.filter(p => p !== currentPlayer && opponentHasMovableOne(p));
}

function canAnyMovableOpponentOne() {
    return eligibleForcedTargets().length > 0;
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

    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
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
    // instruction removed as requested
    messageBox.classList.add('hidden');
    
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
        // Place stone on empty field (4-player: only inside your own home quadrant)
        if (!die && reserveDice[currentPlayer] > 0 && isHomeCell(currentPlayer, r, c)) {
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
                // instruction removed as requested
                return;
            }
            
            // Check if this stone has any legal moves
            const validTargets = calculateStrideTargets(die.r, die.c, 1, currentPlayer);
            if (validTargets.length === 0) {
                // instruction removed as requested
                return;
            }
            
            // Select this stone for movement
            selectedDie = die;
            selectedDie.stepsTaken = 0;
            selectedDie.strideStartR = die.r;
            selectedDie.strideStartC = die.c;
            gamePhase = 'STRIDE_MOVE';
            
            const remaining = die.value;
            messageBox.classList.add('hidden');
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
                // instruction removed as requested
                messageBox.classList.add('hidden');
            }
            return;
        }
        
        // Click on a different own stone — only allowed if no steps have been taken yet
        if (die && die.player === currentPlayer) {
            if (selectedDie.stepsTaken > 0) {
                // instruction removed as requested
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
            messageBox.classList.add('hidden');
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
                messageBox.classList.add('hidden');

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
            
            // instruction removed as requested
            messageBox.classList.add('hidden');
            renderBoard(validTargets);
            return;
        } else if (die && die.player === currentPlayer) {
            // instruction removed as requested
            messageBox.classList.add('hidden');
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
    // messageBox updated removed as requested
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

// White (player 1) is always the human; everyone else is AI-controlled when enabled.
function isAITurn() {
    return numPlayers === 4 ? currentPlayer !== 1 : currentPlayer === 2;
}
window.isAITurn = isAITurn;

// Advance currentPlayer to the next non-eliminated player in clockwise turn order.
function advancePlayer() {
    for (let i = 0; i < turnOrder.length; i++) {
        turnIndex = (turnIndex + 1) % turnOrder.length;
        if (!eliminated[turnOrder[turnIndex]]) break;
    }
    currentPlayer = turnOrder[turnIndex];
}

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
    if (isAITurn() && selectedDie) {
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

    // 4-player diminish calls out a specific opponent for the forced move; otherwise advance
    // normally through the clockwise turn order (skipping eliminated players).
    if (forcedTurnActive && numPlayers === 4 && forcedPlayer && !eliminated[forcedPlayer]) {
        turnIndex = turnOrder.indexOf(forcedPlayer);
        currentPlayer = forcedPlayer;
        forcedPlayer = null;
    } else {
        forcedPlayer = null;
        advancePlayer();
    }
    console.log('switchTurn: after switch, currentPlayer=', currentPlayer, 'forcedTurnActive=', forcedTurnActive);

    if (forcedTurnActive) {
        gamePhase = 'FORCED_MOVE_SELECT';
        console.log('switchTurn: SET FORCED_MOVE_SELECT!');
        forcedTurnActive = false;

        if (messageBox) {
            messageBox.classList.add('hidden');
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

        // Trigger AI move if it's the AI's turn during a forced move
        if (isAIGame && isAITurn() && gamePhase !== 'GAME_OVER') {
            setTimeout(makeAIMove, 800);
        }
    } else {
        gamePhase = 'ACTION_SELECT';
        selectedDie = null;
    if (messageBox) {
        messageBox.classList.add('hidden');
    }
        toggleActionButtons(true, false);
        renderBoard();

        // Clear any grey stones from previous forced turn
        if (window.clearGreyStones3D) window.clearGreyStones3D();

        if (isAIGame && isAITurn() && gamePhase !== 'GAME_OVER') {
            setTimeout(makeAIMove, 800);
        }
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

    if (!isWithinBounds(r, c) || onBoardDice.some(d => d.r === r && d.c === c) || !isHomeCell(currentPlayer, r, c)) {
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
if (opponentButton) opponentButton.addEventListener('click', () => {
    isAIGame = !isAIGame;
    opponentButton.textContent = isAIGame ? 'Opponent: Computer' : 'Opponent: Human';
    
    // If it's an AI player's turn and we just switched to computer, start AI immediately
    if (isAIGame && isAITurn() && gamePhase !== 'GAME_OVER') {
        setTimeout(makeAIMove, 600);
    }
});


// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    if (gamePhase === 'GAME_OVER') return;
    if (numPlayers === 4) { makeAIMove4(); return; }
    if (currentPlayer !== 2) return;

    // FORCED MOVE HANDLING FOR AI
    if (gamePhase === 'FORCED_MOVE_SELECT') {
        const movableOnes = onBoardDice.filter(d => d.player === 2 && d.value === 1 && calculateStrideTargets(d.r, d.c, 1, 2).length > 0);
        if (movableOnes.length > 0) {
            const die = movableOnes[Math.floor(Math.random() * movableOnes.length)];
            const tgts = calculateStrideTargets(die.r, die.c, 1, 2);
            const target = tgts[Math.floor(Math.random() * tgts.length)];
            
            // Execute move using click sequence for consistent 3D behavior
            window.handle3DClick(die.r, die.c); // Select the die
            setTimeout(() => {
                if (window.handle3DClick) window.handle3DClick(target.r, target.c); // Move the die
            }, 600);
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
    let actions = [];

    // 1. EVALUATE PLACEMENT OPTIONS
    if (reserveDice[2] > 0) {
        const emptySquares = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (isWithinBounds(r, c) && !onBoardDice.some(d => d.r === r && d.c === c)) {
                    emptySquares.push({ r, c });
                }
            }
        }

        if (emptySquares.length > 0) {
            // SHUFFLE or pick MANY random spots to avoid "top-left" bias
            const sampleCount = Math.min(12, emptySquares.length);
            const sampled = [];
            const tempSquares = [...emptySquares];
            for (let i = 0; i < sampleCount; i++) {
                const idx = Math.floor(Math.random() * tempSquares.length);
                sampled.push(tempSquares.splice(idx, 1)[0]);
            }

            sampled.forEach(sq => {
                // Heuristic for placement
                let score = 0;
                
                // Bonus for placing near opponent stones (aggression)
                onBoardDice.forEach(d => {
                    if (d.player === 1) {
                        const dist = Math.abs(d.r - sq.r) + Math.abs(d.c - sq.c);
                        if (dist <= 3) score += (4 - dist) * 15;
                    }
                });
                
                // Penalty if placed where opponent can capture it easily (approximate)
                const isVulnerable = onBoardDice.some(d => {
                    if (d.player === 1) {
                        // If square is in line with opponent stone and within their strength (very rough)
                        return (d.r === sq.r || d.c === sq.c) && Math.abs(d.r - sq.r) + Math.abs(d.c - sq.c) <= d.value;
                    }
                    return false;
                });
                if (isVulnerable) score -= 40;

                // Center control
                const distToCenter = Math.abs(5 - sq.r) + Math.abs(5 - sq.c);
                score += (10 - distToCenter) * 5;

                // Random jitter for unpredictable behavior
                score += Math.random() * 20;

                // Weighting adjustment: AI prefers placing if it has many reserves
                score += reserveDice[2] * 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestAction = { type: 'PLACE', target: sq, score: score };
                }
                actions.push({ type: 'PLACE', target: sq, score: score });
            });
        }
    }

    // 2. EVALUATE STRIDE MOVES
    const getReachable = (startR, startC, maxSteps) => {
        let queue = [{ r: startR, c: startC, steps: 0, path: [] }];
        const visited = new Map(); // Store min steps to reach
        visited.set(`${startR},${startC}`, 0);
        const endpoints = [];

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.steps === maxSteps) {
                endpoints.push(current);
                continue;
            }

            let canMoveFurther = false;
            HV_VECTORS.forEach(v => {
                const nr = current.r + v.dr;
                const nc = current.c + v.dc;
                if (isWithinBounds(nr, nc)) {
                    const occupant = onBoardDice.find(d => d.r === nr && d.c === nc);
                    // Can move to empty OR capture opponent stone (value > 1)
                    if (!occupant || (occupant.player === 1 && occupant.value > 1)) {
                        const nextSteps = current.steps + 1;
                        const key = `${nr},${nc}`;
                        
                        // Rules check: "Land ON an opponent's die... then continue remaining movement"
                        // Actually, in many versions, capture ends movement. But statue rules usually allow passing through.
                        // However, we MUST end exactly at maxSteps.
                        if (!visited.has(key) || visited.get(key) > nextSteps) {
                            visited.set(key, nextSteps);
                            canMoveFurther = true;
                            const nextState = { r: nr, c: nc, steps: nextSteps, path: [...current.path, { r: nr, c: nc }] };
                            queue.push(nextState);
                            
                            if (nextSteps === maxSteps) {
                                endpoints.push(nextState);
                            }
                        }
                    }
                }
            });
            
            // If blocked before max steps, count as endpoint (premature stop)
            if (!canMoveFurther && current.steps > 0) {
                endpoints.push(current);
            }
        }
        return endpoints;
    };

    const myDice = onBoardDice.filter(d => d.player === 2);
    myDice.forEach(die => {
        const endpoints = getReachable(die.r, die.c, die.value);
        endpoints.forEach(ep => {
            let score = 0;
            let captures = 0;
            ep.path.forEach(step => {
                const occ = onBoardDice.find(d => d.r === step.r && d.c === step.c);
                if (occ && occ.player === 1) captures++;
            });

            // HIGHEST OBJECTIVE: Capture opponent stones
            score += captures * 250;

            // STRATEGIC POSITIONING
            const dist = Math.abs(5 - ep.r) + Math.abs(5 - ep.c);
            score += (10 - dist) * 8;

            // VULNERABILITY CHECK (Defensive)
            // Penalty if white can capture black at this landing spot on their next turn
            const isAtRisk = onBoardDice.some(w => {
                if (w.player === 1) {
                    // Approximate reach: if in same row/col and within current value/avg value
                    return (w.r === ep.r || w.c === ep.c) && (Math.abs(w.r - ep.r) + Math.abs(w.c - ep.c)) <= w.value;
                }
                return false;
            });
            if (isAtRisk) score -= 100;

            // Loop Prevention
            if (aiLastMovedStoneId === die.id) {
                score -= (aiConsecutiveMoveCount * 80);
            }

            // Prefer moving if fewer captures are available elsewhere? 
            // Just add some random variance
            score += Math.random() * 50;

            if (score > bestScore) {
                bestScore = score;
                bestAction = { type: 'STRIDE', die: die, path: ep.path, score: score };
            }
            actions.push({ type: 'STRIDE', die: die, path: ep.path, score: score });
        });
    });

    // 3. SELECTION (Randomized among top candidates for unpredictability)
    if (actions.length > 0) {
        // Find all actions within 15% of the best score, but at least 150 points difference max
        actions.sort((a, b) => b.score - a.score);
        const topScore = actions[0].score;
        const candidates = actions.filter(a => a.score >= topScore - 60); // Actions nearly as good as best
        bestAction = candidates[Math.floor(Math.random() * candidates.length)];
        console.log(`AI Choice: ${bestAction.type} (Score: ${bestAction.score.toFixed(1)} vs Top: ${topScore.toFixed(1)}, Candidates: ${candidates.length})`);
    }

    if (!bestAction || bestScore === -Infinity) {
        // Fallback: Pick a random stone and move it if possible, or place randomly
        console.log("AI: Using fallback random action");
        const movable = myDice.filter(d => calculateStrideTargets(d.r, d.c, 1, 2).length > 0);
        if (movable.length > 0) {
            const die = movable[Math.floor(Math.random() * movable.length)];
            const tgts = calculateStrideTargets(die.r, die.c, 1, 2);
            bestAction = { type: 'STRIDE', die: die, path: [tgts[Math.floor(Math.random() * tgts.length)]] };
        } else if (reserveDice[2] > 0) {
            const empty = [];
            for (let r=0; r<BOARD_SIZE; r++) for (let c=0; c<BOARD_SIZE; c++) if (isWithinBounds(r,c) && !onBoardDice.some(d => d.r===r && d.c===c)) empty.push({r,c});
            if (empty.length > 0) {
                bestAction = { type: 'PLACE', target: empty[Math.floor(Math.random() * empty.length)] };
            }
        }
        
        if (!bestAction) {
            endTurn("Black passes (no moves).");
            return;
        }
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
             // Confirm we haven't finished the turn yet
            if (pathIdx < bestAction.path.length) {
                const step = bestAction.path[pathIdx];
                console.log(`AI Step: ${pathIdx+1}/${bestAction.path.length}`, step);
                window.handle3DClick(step.r, step.c);
                pathIdx++;
                
                // Continue if turn hasn't switched (e.g. still in movement phase)
                if (pathIdx < bestAction.path.length && currentPlayer === 2) {
                    setTimeout(execStep, 400); 
                }
            }
        };
        setTimeout(execStep, 600);
    }
}

// ---- 4-PLAYER AI ----------------------------------------------------------
// Controls every non-white player. Reuses the same click-driven execution as the
// 2-player AI but is player-relative (any other player counts as an opponent).
function makeAIMove4() {
    const me = currentPlayer;
    if (gamePhase === 'GAME_OVER' || me === 1 || eliminated[me]) return;

    // Forced value-1 move (called out by a diminish).
    if (gamePhase === 'FORCED_MOVE_SELECT') {
        const ones = onBoardDice.filter(d => d.player === me && d.value === 1 && calculateStrideTargets(d.r, d.c, 1, me).length > 0);
        if (ones.length > 0) {
            const die = ones[Math.floor(Math.random() * ones.length)];
            const tgts = calculateStrideTargets(die.r, die.c, 1, me);
            const target = tgts[Math.floor(Math.random() * tgts.length)];
            window.handle3DClick(die.r, die.c);
            setTimeout(() => { if (window.handle3DClick) window.handle3DClick(target.r, target.c); }, 600);
        } else {
            endTurn();
        }
        return;
    }

    const seamRow = 10; // contested central divider: pull stones toward it
    const colCenter = 5;
    const actions = [];

    // PLACE candidates (own home quadrant only)
    if (reserveDice[me] > 0) {
        const empties = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (isWithinBounds(r, c) && isHomeCell(me, r, c) && !onBoardDice.some(d => d.r === r && d.c === c)) {
                    empties.push({ r, c });
                }
            }
        }
        const sample = empties.sort(() => Math.random() - 0.5).slice(0, 12);
        sample.forEach(sq => {
            let score = 20 + reserveDice[me] * 6;
            score += (6 - Math.abs(seamRow - sq.r)) * 2;           // push toward the front line
            score -= Math.abs(colCenter - sq.c);                    // keep off the very edge a bit
            score += Math.random() * 20;
            actions.push({ type: 'PLACE', target: sq, score });
        });
    }

    // STRIDE candidates: BFS exactly `value` steps, capturing opponents (value>1) en route.
    const reachable = (sr, sc, maxSteps) => {
        const queue = [{ r: sr, c: sc, steps: 0, path: [] }];
        const visited = new Map([[`${sr},${sc}`, 0]]);
        const ends = [];
        while (queue.length) {
            const cur = queue.shift();
            if (cur.steps === maxSteps) { ends.push(cur); continue; }
            let advanced = false;
            HV_VECTORS.forEach(v => {
                const nr = cur.r + v.dr, nc = cur.c + v.dc;
                if (!isWithinBounds(nr, nc)) return;
                const occ = onBoardDice.find(d => d.r === nr && d.c === nc);
                if (occ && !(occ.player !== me && occ.value > 1)) return; // own stone or indestructible 1
                const key = `${nr},${nc}`, ns = cur.steps + 1;
                if (!visited.has(key) || visited.get(key) > ns) {
                    visited.set(key, ns);
                    advanced = true;
                    const next = { r: nr, c: nc, steps: ns, path: [...cur.path, { r: nr, c: nc }] };
                    queue.push(next);
                    if (ns === maxSteps) ends.push(next);
                }
            });
            if (!advanced && cur.steps > 0) ends.push(cur);
        }
        return ends;
    };

    onBoardDice.filter(d => d.player === me).forEach(die => {
        reachable(die.r, die.c, die.value).forEach(ep => {
            let captures = 0;
            ep.path.forEach(s => {
                const occ = onBoardDice.find(d => d.r === s.r && d.c === s.c);
                if (occ && occ.player !== me) captures++;
            });
            let score = captures * 250;
            score += (6 - Math.abs(seamRow - ep.r)) * 4;
            if (aiLastMovedStoneId === die.id) score -= aiConsecutiveMoveCount * 80;
            score += Math.random() * 50;
            actions.push({ type: 'STRIDE', die, path: ep.path, score });
        });
    });

    if (actions.length === 0) { endTurn(); return; }

    actions.sort((a, b) => b.score - a.score);
    const top = actions[0].score;
    const pool = actions.filter(a => a.score >= top - 60);
    const choice = pool[Math.floor(Math.random() * pool.length)];

    if (choice.type === 'PLACE') {
        window.handle3DClick(choice.target.r, choice.target.c);
    } else {
        window.handle3DClick(choice.die.r, choice.die.c);
        let idx = 0;
        const step = () => {
            if (idx < choice.path.length) {
                window.handle3DClick(choice.path[idx].r, choice.path[idx].c);
                idx++;
                if (idx < choice.path.length && currentPlayer === me) setTimeout(step, 400);
            }
        };
        setTimeout(step, 600);
    }
}


// ============================================
// INITIALIZATION
// ============================================

function startNewGame() {
    rebuildBoardConfig();
    currentDieId = 0;
    onBoardDice = [];
    reserveDice = { 1: 8, 2: 8, 3: 8, 4: 8 };
    eliminated = {};
    turnIndex = 0;
    forcedPlayer = null;
    currentPlayer = turnOrder[0];
    gamePhase = 'ACTION_SELECT';
    forcedTurnActive = false;
    selectedDie = null;

    toggleActionButtons(true, false);
    if (opponentButton) {
        opponentButton.textContent = isAIGame ? 'Opponent: Computer' : 'Opponent: Human';
    }
    renderBoard();
    hideGameOverModal();
    messageBox.classList.add('hidden');
    
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

// Switch player count (2 or 4): reconfigure board + restart, then rebuild the 3D scene.
function setNumPlayers(n) {
    if (n !== 2 && n !== 4) return;
    numPlayers = n;
    startNewGame();
    if (window.rebuild3DBoard) window.rebuild3DBoard();
    if (window.syncBoard3D) window.syncBoard3D();
    if (isAIGame && isAITurn() && gamePhase !== 'GAME_OVER') setTimeout(makeAIMove, 600);
}
window.setNumPlayers = setNumPlayers;
window.getNumPlayers = () => numPlayers;

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
        const ov = document.getElementById('overlay');
        if (sm) sm.classList.toggle('open');
        if (mt) mt.classList.toggle('active');
        if (ov) ov.classList.toggle('active');
    }
});

// Note: Overlay click and menu buttons are handled in statue.html toggleSideMenu()




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

    const targets = eligibleForcedTargets();
    if (targets.length === 0) {
        console.log('DIMINISH: Rule failure - no opponent has movable 1-dice');
        messageBox.textContent = `Diminish failed: no opponent has a movable value-1 die.`;
        return;
    }

    console.log('DIMINISH: SUCCESS, reducing value for stone', selectedDie.id);
    selectedDie.value -= 1;
    if (window.updateStoneStrength3D) window.updateStoneStrength3D(selectedDie.id, selectedDie.value);

    // 4-player: the diminisher decides which opponent owes the forced move.
    if (numPlayers === 4 && targets.length > 1) {
        gamePhase = 'DIMINISH_PICK';
        if (window.clearStrideTargets3D) window.clearStrideTargets3D();
        if (window.hideDiminishButton) window.hideDiminishButton();
        if (window.syncBoard3D) window.syncBoard3D();
        showForcedTargetPicker(targets);
        return;
    }

    commitDiminish(targets[0]);
};

// Finalise a diminish: flag the forced move (and, in 4-player, who owes it) and end the turn.
function commitDiminish(targetPlayer) {
    forcedPlayer = (numPlayers === 4) ? targetPlayer : null;
    forcedTurnActive = true;
    selectedDie = null;
    gamePhase = 'ACTION_SELECT';

    if (window.clearStrideTargets3D) window.clearStrideTargets3D();
    if (window.hideDiminishButton) window.hideDiminishButton();
    if (window.syncBoard3D) window.syncBoard3D();

    endTurn();
}

// Lightweight in-game overlay letting the diminisher pick the forced-move target (4-player).
function showForcedTargetPicker(targets) {
    let modal = document.getElementById('diminish-target-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'diminish-target-modal';
        modal.className = 'diminish-target-modal hidden';
        modal.innerHTML = '<div class="diminish-target-panel"><h3>Force which player?</h3>' +
            '<p>They must move a value-1 stone next turn.</p>' +
            '<div id="diminish-target-options" class="diminish-target-options"></div></div>';
        document.body.appendChild(modal);
    }
    const opts = modal.querySelector('#diminish-target-options');
    opts.innerHTML = '';
    targets.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'diminish-target-btn ' + (COLOR_OF[p] || 'white');
        btn.textContent = colorName(p);
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
            commitDiminish(p);
        });
        opts.appendChild(btn);
    });
    modal.classList.remove('hidden');
}

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
