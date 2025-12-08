// CHURCH GAME - Seven Wonders Series
// Game Design: Simon Allmer

// Board Config: 13x13 Grid
// "Plus" Shape with 3x3 Center and 3x5 Arms:
// Center: Rows 5-7, Cols 5-7 (3x3)
// Top Arm: Rows 0-4, Cols 5-7 (5x3 - length 5, width 3)
// Bottom Arm: Rows 8-12, Cols 5-7 (5x3)
// Left Arm: Rows 5-7, Cols 0-4 (3x5)
// Right Arm: Rows 5-7, Cols 8-12 (3x5)

let gameState = {
    selectedStoneColor: null,
    board: {}
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const whiteBox = document.querySelector('.white-box .box-content');
const blackBox = document.querySelector('.black-box .box-content');
const statusElement = document.getElementById('game-status');

function initializeGame() {
    gameBoard.innerHTML = '';
    gameState.board = {};
    gameState.selectedStoneColor = null;
    clearStoneSelection();

    // Create 13x13 Grid
    for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
            const cell = document.createElement('div');
            const cellId = `${r}-${c}`;
            cell.dataset.id = cellId;
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Determine if valid part of Cross or Hallway
            let isValid = false;
            let isCenter = false;

            // 1. Center & Arms (The Cross)
            // Vertical Spine (Cols 5-7, full height 0-12)
            if (c >= 5 && c <= 7 && r >= 0 && r <= 12) {
                isValid = true;
                // Mark center specifically
                if (r >= 5 && r <= 7) isCenter = true;
            }

            // Horizontal Spine (Rows 5-7, full width 0-12)
            if (r >= 5 && r <= 7 && c >= 0 && c <= 12) {
                isValid = true;
                if (c >= 5 && c <= 7) isCenter = true;
            }

            // 2. Hallway Square (Rows/Cols 2 and 10, bounded by 2-10)
            // Top Side of Square
            if (r === 2 && c >= 2 && c <= 10) isValid = true;
            // Bottom Side of Square
            if (r === 10 && c >= 2 && c <= 10) isValid = true;
            // Left Side of Square
            if (c === 2 && r >= 2 && r <= 10) isValid = true;
            // Right Side of Square
            if (c === 10 && r >= 2 && r <= 10) isValid = true;

            if (isValid) {
                cell.className = 'cell';
                if (isCenter) cell.classList.add('center-field');

                gameState.board[cellId] = { occupied: false, color: null };
                cell.addEventListener('click', () => handleCellClick(r, c));
            } else {
                cell.className = 'cell empty-space';
                // Empty spacer
            }

            gameBoard.appendChild(cell);
        }
    }

    updateStatus('Select a stone from a bag to place it.');
}

function handleCellClick(r, c) {
    const cellId = `${r}-${c}`;
    const cellData = gameState.board[cellId];

    // If holding a stone, try to place it
    if (gameState.selectedStoneColor) {
        if (!cellData.occupied) {
            placeStone(r, c, gameState.selectedStoneColor);
            clearStoneSelection();
            updateStatus('Stone placed. Select another stone.');
        } else {
            updateStatus('That spot is occupied!');
        }
    } else {
        updateStatus('Select a stone from a bag first.');
    }
}

function placeStone(r, c, color) {
    const cellId = `${r}-${c}`;
    const cell = document.querySelector(`.cell[data-id="${cellId}"]`);

    // Logic update
    gameState.board[cellId].occupied = true;
    gameState.board[cellId].color = color;

    // Visual update
    const stone = document.createElement('div');
    stone.className = `stone ${color}`;
    cell.appendChild(stone);
}

// Stone Box Selection
function handleBoxClick(color) {
    if (gameState.selectedStoneColor === color) {
        clearStoneSelection();
        updateStatus('Selection cancelled.');
    } else {
        gameState.selectedStoneColor = color;
        highlightBox(color);
        updateStatus(`Selected ${color} stone. Place it on the floor.`);
    }
}

function highlightBox(color) {
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');
    if (color === 'white') whiteBox.classList.add('selected');
    if (color === 'black') blackBox.classList.add('selected');
}

function clearStoneSelection() {
    gameState.selectedStoneColor = null;
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');
}

function updateStatus(msg) {
    statusElement.textContent = msg;
}

// Event Listeners
whiteBox.addEventListener('click', () => handleBoxClick('white'));
blackBox.addEventListener('click', () => handleBoxClick('black'));
document.getElementById('reset-button').addEventListener('click', initializeGame);

// Init
document.addEventListener('DOMContentLoaded', initializeGame);
