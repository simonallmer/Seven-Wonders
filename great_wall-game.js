// GREAT WALL GAME - Seven Wonders Series
// Game Design: Simon Allmer

const BOARD_CONFIG = {
    leftTower: { rows: 6, cols: 6 },
    bridge: { rows: 4, cols: 12 },
    rightTower: { rows: 6, cols: 6 }
};

let gameState = {
    selectedStoneColor: null,
    board: {} // will hold cell data by ID string "section-r-c"
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const whiteBox = document.querySelector('.white-box .box-content');
const blackBox = document.querySelector('.black-box .box-content');
const statusElement = document.getElementById('game-status');

// Helper to create Cell ID
function getCellId(section, r, c) {
    return `${section}-${r}-${c}`;
}

function initializeGame() {
    gameBoard.innerHTML = '';
    gameState.board = {};
    gameState.selectedStoneColor = null;
    clearStoneSelection();

    // 1. Create Left Tower (6x6)
    createSection('left-tower', BOARD_CONFIG.leftTower.rows, BOARD_CONFIG.leftTower.cols, 'section-tower');

    // 2. Create Bridge (4x12)
    createSection('bridge', BOARD_CONFIG.bridge.rows, BOARD_CONFIG.bridge.cols, 'section-bridge');

    // 3. Create Right Tower (6x6)
    createSection('right-tower', BOARD_CONFIG.rightTower.rows, BOARD_CONFIG.rightTower.cols, 'section-tower');

    updateStatus('Select a stone from a bag to place it.');
}

function createSection(name, rows, cols, cssClass) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = `wall-section ${cssClass}`;
    sectionDiv.id = name;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const cellId = getCellId(name, r, c);
            cell.dataset.id = cellId;
            cell.dataset.section = name;
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Store empty state
            gameState.board[cellId] = { occupied: false, color: null };

            cell.addEventListener('click', () => handleCellClick(name, r, c));
            sectionDiv.appendChild(cell);
        }
    }
    gameBoard.appendChild(sectionDiv);
}

function handleCellClick(section, r, c) {
    const cellId = getCellId(section, r, c);
    const cellData = gameState.board[cellId];

    // If holding a stone, try to place it
    if (gameState.selectedStoneColor) {
        if (!cellData.occupied) {
            placeStone(section, r, c, gameState.selectedStoneColor);
            clearStoneSelection();
            updateStatus('Stone placed. Select another stone.');
        } else {
            updateStatus('That spot is occupied!');
        }
    } else {
        // Just clicking around logic (if we add movement later)
        updateStatus('Select a stone from a bag first.');
    }
}

function placeStone(section, r, c, color) {
    const cellId = getCellId(section, r, c);
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
        updateStatus(`Selected ${color} stone. Place it on the wall.`);
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
