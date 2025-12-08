document.addEventListener('DOMContentLoaded', () => {
    initGame();
});

// Game State
let selectedStoneColor = null; // 'white' or 'black' from bag
let selectedStone = null; // Cell object for moving
let board = []; // Will store cell objects

// Board Configuration
const SIDES = 4;
const SIDE_ROWS = 12;
const SIDE_COLS = 4;
const ROOF_SIZE = 4;

function initGame() {
    const boardContainer = document.getElementById('game-board');
    boardContainer.innerHTML = '';
    board = [];

    // Create 4 Sides
    for (let s = 0; s < SIDES; s++) {
        const sideGrid = document.createElement('div');
        sideGrid.className = 'grid-section side-grid';
        sideGrid.id = `side-${s}`;

        for (let r = 0; r < SIDE_ROWS; r++) {
            for (let c = 0; c < SIDE_COLS; c++) {
                const cell = createCell(s, r, c, 'side');
                sideGrid.appendChild(cell.element);
                board.push(cell);
            }
        }
        boardContainer.appendChild(sideGrid);
    }

    // Create Roof
    const roofGrid = document.createElement('div');
    roofGrid.className = 'grid-section roof-grid';
    roofGrid.id = 'roof';

    for (let r = 0; r < ROOF_SIZE; r++) {
        for (let c = 0; c < ROOF_SIZE; c++) {
            const cell = createCell(4, r, c, 'roof'); // Side 4 represents roof
            roofGrid.appendChild(cell.element);
            board.push(cell);
        }
    }
    boardContainer.appendChild(roofGrid);

    // Initialize Stone Bags
    document.getElementById('white-box').addEventListener('click', () => handleBoxClick('white'));
    document.getElementById('black-box').addEventListener('click', () => handleBoxClick('black'));

    updateStatus('Select a stone from a bag to place it.');
}

function createCell(side, row, col, type) {
    const element = document.createElement('div');
    element.className = 'cell';
    element.dataset.side = side;
    element.dataset.row = row;
    element.dataset.col = col;
    element.dataset.type = type;

    const cell = {
        side,
        row,
        col,
        type,
        element,
        stone: null
    };

    element.addEventListener('click', () => handleCellClick(cell));

    return cell;
}

function handleBoxClick(color) {
    if (selectedStoneColor === color) {
        // Deselect
        selectedStoneColor = null;
        updateStatus('Stone deselected.');
    } else {
        selectedStoneColor = color;
        selectedStone = null; // Deselect board stone if any
        clearHighlights();
        updateStatus(`Selected ${color} stone from bag. Click an empty cell to place it.`);
    }
    updateBoxSelection();
}

function updateBoxSelection() {
    document.querySelector('.white-box .box-content').classList.toggle('selected', selectedStoneColor === 'white');
    document.querySelector('.black-box .box-content').classList.toggle('selected', selectedStoneColor === 'black');
}

function handleCellClick(cell) {
    // 1. Placing a stone from bag
    if (selectedStoneColor) {
        if (!cell.stone) {
            placeStone(cell, selectedStoneColor);
            // Optional: Deselect after placement or keep selected for multiple placements?
            // User said "bags where I can take out... place stones". Usually one at a time.
            // Let's keep it selected for easier prototyping as requested "experimenting".
            updateStatus(`Placed ${selectedStoneColor} stone.`);
        } else {
            updateStatus('Cell is already occupied.');
        }
        return;
    }

    // 2. Moving a stone on board
    if (selectedStone) {
        // Try to move
        if (cell === selectedStone) {
            // Deselect
            selectedStone = null;
            clearHighlights();
            updateStatus('Deselected stone.');
        } else if (!cell.stone && isNeighbor(selectedStone, cell)) {
            moveStone(selectedStone, cell);
            selectedStone = null;
            clearHighlights();
            updateStatus('Moved stone.');
        } else if (cell.stone) {
            // Select new stone
            selectedStone = cell;
            highlightValidMoves(cell);
            updateStatus('Selected new stone to move.');
        } else {
            updateStatus('Invalid move. Can only move 1 field.');
        }
    } else {
        // Select a stone
        if (cell.stone) {
            selectedStone = cell;
            highlightValidMoves(cell);
            updateStatus('Selected stone. Click adjacent empty cell to move.');
        }
    }
}

function placeStone(cell, color) {
    const stone = document.createElement('div');
    stone.className = `stone ${color}`;
    cell.element.appendChild(stone);
    cell.stone = color;
}

function moveStone(fromCell, toCell) {
    const color = fromCell.stone;

    // Remove from old
    fromCell.element.innerHTML = '';
    fromCell.stone = null;

    // Add to new
    placeStone(toCell, color);
}

function highlightValidMoves(cell) {
    clearHighlights();
    cell.element.classList.add('selected');

    const neighbors = getNeighbors(cell);
    neighbors.forEach(neighbor => {
        if (!neighbor.stone) {
            neighbor.element.classList.add('valid-move');
        }
    });
}

function clearHighlights() {
    board.forEach(c => {
        c.element.classList.remove('selected');
        c.element.classList.remove('valid-move');
    });
}

function isNeighbor(cell1, cell2) {
    const neighbors = getNeighbors(cell1);
    return neighbors.includes(cell2);
}

function getNeighbors(cell) {
    const neighbors = [];
    const { side, row, col, type } = cell;

    // Standard grid neighbors (Up, Down, Left, Right)
    const potentialMoves = [
        { r: row - 1, c: col }, // Up
        { r: row + 1, c: col }, // Down
        { r: row, c: col - 1 }, // Left
        { r: row, c: col + 1 }  // Right
    ];

    potentialMoves.forEach(move => {
        let targetSide = side;
        let targetRow = move.r;
        let targetCol = move.c;
        let targetType = type;

        // Handle Side Wrapping and Roof Connections
        if (type === 'side') {
            // Left Edge Wrapping
            if (targetCol < 0) {
                targetSide = (side - 1 + SIDES) % SIDES;
                targetCol = SIDE_COLS - 1;
            }
            // Right Edge Wrapping
            else if (targetCol >= SIDE_COLS) {
                targetSide = (side + 1) % SIDES;
                targetCol = 0;
            }
            // Top Edge -> Roof Connection
            else if (targetRow < 0) {
                targetType = 'roof';
                targetSide = 4; // Roof

                // Side 2 is "Front" (visually under Roof)
                if (side === 2) {
                    targetRow = ROOF_SIZE - 1; // Transitions to Bottom of Roof
                    targetCol = col;           // Column matches
                }
                // Side 1 is "Left"
                else if (side === 1) {
                    targetRow = col; // Col 0->Row 0, Col 3->Row 3 (Left edge traversal)
                    targetCol = 0;   // Transitions to Left edge of Roof
                }
                // Side 3 is "Right"
                else if (side === 3) {
                    targetRow = (ROOF_SIZE - 1) - col; // Col 0 -> Row 3, Col 3 -> Row 0
                    targetCol = ROOF_SIZE - 1;         // Transitions to Right edge of Roof
                }
                // Side 0 is "Back"
                else if (side === 0) {
                    targetRow = 0;                     // Transitions to Top of Roof
                    targetCol = (ROOF_SIZE - 1) - col; // 180 flip
                }
            }
            // Bottom Edge (Ground) - No connection
            else if (targetRow >= SIDE_ROWS) {
                return; // Invalid
            }
        } else if (type === 'roof') {
            // Roof -> Side Connections
            if (targetRow >= ROOF_SIZE) { // Bottom Edge -> Side 2 (Front)
                targetType = 'side';
                targetSide = 2;
                targetRow = 0; // Top of side 2
                targetCol = col;
            } else if (targetCol < 0) { // Left Edge -> Side 1 (Left)
                targetType = 'side';
                targetSide = 1;
                targetRow = 0;
                targetCol = row;
            } else if (targetCol >= ROOF_SIZE) { // Right Edge -> Side 3 (Right)
                targetType = 'side';
                targetSide = 3;
                targetRow = 0;
                targetCol = (ROOF_SIZE - 1) - row;
            } else if (targetRow < 0) { // Top Edge -> Side 0 (Back)
                targetType = 'side';
                targetSide = 0;
                targetRow = 0;
                targetCol = (ROOF_SIZE - 1) - col;
            }
        }

        // Find cell in board array
        const targetCell = board.find(c =>
            c.side === targetSide &&
            c.row === targetRow &&
            c.col === targetCol &&
            c.type === targetType
        );

        if (targetCell) {
            neighbors.push(targetCell);
        }
    });

    return neighbors;
}

function updateStatus(message) {
    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.textContent = message;
    }
}
