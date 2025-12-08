// ISLAND GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Easter Island (Rapa Nui) with Figure Crafting System

// Board: 9x9 Grid

const INITIAL_INVENTORY = {
    legs: { 1: 6, 2: 3, 3: 2 },
    body: { 1: 6, 2: 3, 3: 2 }
};

let gameState = {
    currentPlayer: 'white',
    inventory: {
        white: JSON.parse(JSON.stringify(INITIAL_INVENTORY)),
        black: JSON.parse(JSON.stringify(INITIAL_INVENTORY))
    },
    board: {}, // Stores cell data. cellId -> { figures: [] }
    selectedCell: null,
    selectedFigureIndex: null, // If multiple figures, which one is moving? (Simplification: Move top/all? Let's assume move INDIVIDUAL)
    mode: 'IDLE', // IDLE, CRAFTING, MOVING
    craftingTarget: null, // {r, c}
    craftSelection: { legs: null, body: null },
    validMoves: [] // Store valid move coordinates {r, c}
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const playerIndicator = document.getElementById('current-player-color');
const whiteBox = document.getElementById('white-box');
const blackBox = document.getElementById('black-box');

// Modal Elements
const craftingModal = document.getElementById('crafting-modal');
const legsOptions = document.getElementById('legs-options');
const bodyOptions = document.getElementById('body-options');
const confirmCraftBtn = document.getElementById('confirm-craft-btn');
const cancelCraftBtn = document.getElementById('cancel-craft-btn');

function initializeGame() {
    gameState.currentPlayer = 'white';
    gameState.inventory = {
        white: JSON.parse(JSON.stringify(INITIAL_INVENTORY)),
        black: JSON.parse(JSON.stringify(INITIAL_INVENTORY))
    };
    gameState.board = {};
    gameState.selectedCell = null;
    gameState.mode = 'IDLE';
    gameState.validMoves = [];

    renderBoard();
    updateInventoryDisplay();
    updateStatus();
    updatePlayerIndicator();
}

function renderBoard() {
    gameBoard.innerHTML = '';

    // Create a Set of valid move IDs for fast lookup
    const validMoveSet = new Set(gameState.validMoves.map(m => `${m.r}-${m.c}`));

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cellId = `${r}-${c}`;
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.id = cellId;
            // Pass event object to stop propagation
            cell.onclick = (e) => handleCellClick(r, c, e);

            // Highlight Valid Moves
            if (validMoveSet.has(cellId)) {
                cell.classList.add('valid-move');
            }

            // Render Figures
            const cellData = gameState.board[cellId];
            if (cellData && cellData.figures.length > 0) {
                cellData.figures.forEach((fig, index) => {
                    const figDiv = document.createElement('div');
                    figDiv.className = `figure ${fig.color}`;
                    // Display Stats: L/B
                    figDiv.innerHTML = `<div class="figure-stats">L${fig.legs}<br>B${fig.body}</div>`;

                    // Highlight selected
                    if (gameState.selectedCell && gameState.selectedCell.r === r && gameState.selectedCell.c === c && gameState.selectedFigureIndex === index) {
                        figDiv.style.border = '2px solid yellow';
                        figDiv.style.boxShadow = '0 0 10px yellow';
                    }

                    cell.appendChild(figDiv);
                });
            }

            gameBoard.appendChild(cell);
        }
    }
}

function updateInventoryDisplay() {
    // Render inventory grids into the boxes
    ['white', 'black'].forEach(color => {
        const box = document.querySelector(`.${color}-box .box-content`);
        // Remove old content
        box.innerHTML = '';
        box.style.display = 'block'; // Override flex center for grid
        box.style.borderRadius = '8px'; // Change shape to fit grid
        box.className = 'box-content'; // Reset

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        // Legs
        [1, 2, 3].forEach(lvl => {
            const item = document.createElement('div');
            item.className = 'inv-item';
            item.innerHTML = `<span class="inv-label">L${lvl}</span><span class="inv-count">${gameState.inventory[color].legs[lvl]}</span>`;
            grid.appendChild(item);
        });

        // Body
        [1, 2, 3].forEach(lvl => {
            const item = document.createElement('div');
            item.className = 'inv-item';
            item.innerHTML = `<span class="inv-label">B${lvl}</span><span class="inv-count">${gameState.inventory[color].body[lvl]}</span>`;
            grid.appendChild(item);
        });

        box.appendChild(grid);
    });
}

function handleCellClick(r, c, e) {
    if (e) e.stopPropagation(); // Prevent global click-outside listener from firing

    const cellId = `${r}-${c}`;
    const cellData = gameState.board[cellId] || { figures: [] };

    // Common: Check if clicking OWN unit to Select/Switch
    // (Available in both IDLE and MOVING)
    const myFigures = cellData.figures.filter((f, i) => f.color === gameState.currentPlayer);
    if (myFigures.length > 0) {
        // If already selected this cell, maybe toggle? For now just re-select/switch is fine.
        // Unless we are trying to Move TO a cell with our own unit (e.g. reinforcement?)
        // Rules say: "If the 2 strong also has a 1 strong friendly figure on the same field, the strength is equal".
        // This implies friendly units can stack?
        // "Attack system... When figure enters field...".
        // If moving to friendly field, it's a valid move (Stacking).

        // So: If I am MOVING, and click a cell with MY units...
        // Is it a Target or a Switch Selection?
        // Usually clicking *another* unit switches selection.
        // Unless I want to move onto it.
        // Let's assume standard behavior: Click OWN unit = Select (Switch).
        // (If we want to Stack, we might need a special UI or "Confirm Move" if target is friendly).
        // Implementation Choice: Clicking friendly always switches selection.
        // To move onto friendly, maybe right click? Or "Move Here" button?
        // Let's stick to "Switch Selection" for now as it's safer UI.

        const realIndex = cellData.figures.findIndex(f => f.color === gameState.currentPlayer);
        const fig = cellData.figures[realIndex];

        // If clicking the ALREADY selected unit -> maybe deselect?
        if (gameState.mode === 'MOVING' && gameState.selectedCell.r === r && gameState.selectedCell.c === c) {
            // Deselect?
            gameState.mode = 'IDLE';
            gameState.selectedCell = null;
            clearValidMoves();
            renderBoard();
            updateStatus("Deselected.");
            return;
        }

        gameState.selectedCell = { r, c };
        gameState.selectedFigureIndex = realIndex;
        gameState.mode = 'MOVING';

        // Initialize Movement State for Iterative Moving
        gameState.remainingMoves = fig.legs;
        gameState.hasMoved = false;

        highlightValidMoves(r, c, 1); // Start with adjacent moves
        renderBoard();
        updateStatus(`Unit Selected. Legs: ${fig.legs}, Body: ${fig.body}. Click adjacent tile to move.`, true);
        return;
    }

    if (gameState.mode === 'IDLE') {
        // 2. If clicking empty cell -> Craft
        if (cellData.figures.length === 0) {
            openCraftingModal(r, c);
            return;
        }

        // 3. If clicking enemy -> Info?
        if (cellData.figures.length > 0) {
            updateStatus("Enemy unit.");
        }

    } else if (gameState.mode === 'MOVING') {
        // Target selected (Friendly selection handled above)
        // Check if valid move
        const moveEl = document.querySelector(`.cell[data-id="${r}-${c}"]`);
        if (moveEl && moveEl.classList.contains('valid-move')) {
            executeMove(r, c);
        } else {
            // Invalid move target. Do nothing.
            // User must click outside to deselect.
            updateStatus("Invalid Move. Click outside to deselect.");
        }
    }
}

// =====================
// CRAFTING LOGIC
// =====================

function openCraftingModal(r, c) {
    gameState.craftingTarget = { r, c };
    gameState.craftSelection = { legs: null, body: null };
    gameState.mode = 'CRAFTING';

    craftingModal.classList.remove('hidden');
    updateCraftingUI();

    updateStatus("Crafting Mode: Select Legs and Body.");
}

function updateCraftingUI() {
    const inv = gameState.inventory[gameState.currentPlayer];

    // Update Legs Buttons
    const legsBtns = legsOptions.querySelectorAll('.craft-btn');
    legsBtns.forEach(btn => {
        const val = parseInt(btn.dataset.val);
        btn.disabled = inv.legs[val] <= 0;
        btn.classList.toggle('selected', gameState.craftSelection.legs === val);
        btn.onclick = () => {
            if (inv.legs[val] > 0) {
                gameState.craftSelection.legs = val;
                updateCraftingUI();
            }
        };
    });

    // Update Body Buttons
    const bodyBtns = bodyOptions.querySelectorAll('.craft-btn');
    bodyBtns.forEach(btn => {
        const val = parseInt(btn.dataset.val);
        btn.disabled = inv.body[val] <= 0;
        btn.classList.toggle('selected', gameState.craftSelection.body === val);
        btn.onclick = () => {
            if (inv.body[val] > 0) {
                gameState.craftSelection.body = val;
                updateCraftingUI();
            }
        };
    });
}

function confirmCraft() {
    const { legs, body } = gameState.craftSelection;
    if (!legs || !body) {
        alert("Must select both Legs and Body!");
        return;
    }

    // Deduct Inventory
    gameState.inventory[gameState.currentPlayer].legs[legs]--;
    gameState.inventory[gameState.currentPlayer].body[body]--;

    // Place Figure
    const { r, c } = gameState.craftingTarget;
    const cellId = `${r}-${c}`;
    if (!gameState.board[cellId]) gameState.board[cellId] = { figures: [] };

    gameState.board[cellId].figures.push({
        color: gameState.currentPlayer,
        legs: legs,
        body: body
    });

    closeCraftingModal();
    endTurn();
}

function closeCraftingModal() {
    craftingModal.classList.add('hidden');
    gameState.mode = 'IDLE';
    gameState.craftingTarget = null;
    renderBoard();
}

// =====================
// MOVEMENT & COMBAT
// =====================

const endMoveBtn = document.getElementById('end-move-btn');
endMoveBtn.onclick = () => finishTurn();

function highlightValidMoves(startR, startC, range) {
    gameState.validMoves = [];
    // Iterative Movement: Always highlight adjacent (radius 1) if range >= 1
    // Range passed here should be 1 if we are doing step-by-step.
    // The `remainingMoves` tracks total.

    // Check all adjacent cells (including diagonals)
    // Radius 1 Chebyshev
    for (let r = Math.max(0, startR - 1); r <= Math.min(8, startR + 1); r++) {
        for (let c = Math.max(0, startC - 1); c <= Math.min(8, startC + 1); c++) {
            if (r === startR && c === startC) continue; // Skip self
            gameState.validMoves.push({ r, c });
        }
    }
}

function clearValidMoves() {
    gameState.validMoves = [];
}

// executeMove now handles a SINGLE STEP
function executeMove(targetR, targetC) {
    const startCellId = `${gameState.selectedCell.r}-${gameState.selectedCell.c}`;
    const targetCellId = `${targetR}-${targetC}`;

    // Get moving figure
    const startData = gameState.board[startCellId];
    const mover = startData.figures[gameState.selectedFigureIndex];

    // Remove from Origin
    startData.figures.splice(gameState.selectedFigureIndex, 1);

    // Add to Target (Move In)
    const targetData = gameState.board[targetCellId] || { figures: [] };
    targetData.figures.push(mover);
    if (!gameState.board[targetCellId]) gameState.board[targetCellId] = targetData;

    // Update Selection Tracking Immediately to new pos
    const newMoverIndex = targetData.figures.length - 1; // It's at the end

    // Combat / Interaction Logic
    // Check against ENEMIES in the target cell
    const enemyFigures = targetData.figures.filter(f => f.color !== gameState.currentPlayer);

    let combatMsg = "";

    if (enemyFigures.length > 0) {
        // Sum of Defender Bodies
        const defenseStrength = enemyFigures.reduce((sum, f) => sum + f.body, 0);

        if (mover.body > defenseStrength) {
            // VICTORY: Capture ALL enemies
            enemyFigures.forEach(enemy => {
                gameState.inventory[gameState.currentPlayer].legs[enemy.legs]++;
                gameState.inventory[gameState.currentPlayer].body[enemy.body]++;
            });

            // Remove enemies from board
            targetData.figures = targetData.figures.filter(f => f.color === gameState.currentPlayer);

            // Check where mover ended up (index might change if enemies were removed before it?)
            // We filtered `targetData.figures`. Mover has same color as current player, so it stays.
            combatMsg = ` > Battle Won! Captured ${enemyFigures.length} units.`;

        } else {
            // COEXIST: Nothing happens to units.
            combatMsg = ` > Shared Field (Str ${mover.body} vs ${defenseStrength}).`;
        }
    } else {
        combatMsg = "";
    }

    // Update State for Next Step
    gameState.remainingMoves--;
    gameState.hasMoved = true;

    // Update Selection to new coordinates
    gameState.selectedCell = { r: targetR, c: targetC };
    // Find mover again to be safe (it's the last one of our color usually, or specifically the object)
    // Since we filtered enemies, and appended mover, mover is at end of `targetData.figures`?
    // Wait, if we had other friendly units there, order matters.
    // `mover` object reference is still valid.
    gameState.selectedFigureIndex = targetData.figures.indexOf(mover);

    renderBoard();
    updateInventoryDisplay(); // In case of capture

    if (gameState.remainingMoves > 0) {
        // Continue Movement
        endMoveBtn.classList.remove('hidden');
        highlightValidMoves(targetR, targetC, 1);
        renderBoard(); // Re-render to show highlights
        updateStatus(`Moved. Steps left: ${gameState.remainingMoves}.${combatMsg} Click adjacent to move or End.`, true);
    } else {
        // No moves left
        finishTurn();
    }
}

function finishTurn() {
    gameState.mode = 'IDLE';
    gameState.selectedCell = null;
    gameState.validMoves = [];
    gameState.remainingMoves = 0;
    gameState.hasMoved = false;

    endMoveBtn.classList.add('hidden');
    clearValidMoves();
    renderBoard();

    // Switch Player
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
    updateInfo();
}

function endTurn() {
    // This function is now primarily for actions that immediately end the turn (like crafting)
    // For movement, `finishTurn` handles the turn end logic.
    gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
    updateInfo();
}

function updateInfo() {
    updateInventoryDisplay();
    updatePlayerIndicator();
    updateStatus();
}

function updateStatus(msg, keep = false) {
    if (msg) {
        statusElement.textContent = msg;
    } else {
        const player = gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1);
        statusElement.textContent = `${player}'s Turn. Click empty to craft or unit to move.`;
    }

    // Reset status after delay if temporary? No, keep steady context.
}

function updatePlayerIndicator() {
    const player = gameState.currentPlayer;
    // playerIndicator style color update
    playerIndicator.style.backgroundColor = player === 'white' ? '#fff' : '#1a1a1a';
}

// Event Listeners
confirmCraftBtn.onclick = confirmCraft;
cancelCraftBtn.onclick = closeCraftingModal;
document.getElementById('reset-button').onclick = initializeGame;

// Global Click for Deselection
document.addEventListener('click', (e) => {
    // If clicking outside game board and NOT on a UI element that matters
    const isBoard = e.target.closest('.island-board');
    const isModal = e.target.closest('.crafting-modal');
    const isControl = e.target.closest('.action-buttons') || e.target.closest('.stone-box'); // Inventory clicks shouldn't deselect? Maybe they should?
    // Actually inventory is display only.

    if (!isBoard && !isModal && !isControl) {
        if (gameState.mode === 'MOVING') {
            if (gameState.hasMoved) {
                // If has moved partially, do not deselect. Force End Move or Continue.
                updateStatus(`Cannot deselect mid-move. Click 'End Movement' to finish turn.`);
            } else {
                gameState.mode = 'IDLE';
                gameState.selectedCell = null;
                clearValidMoves();
                renderBoard();
                updateStatus("Selection cleared.");
            }
        }
    }
});

// Init
document.addEventListener('DOMContentLoaded', initializeGame);
