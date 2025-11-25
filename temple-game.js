// TEMPLE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const SVG_NS = "http://www.w3.org/2000/svg";

// Board structure with proper equal spacing
const BOARD_STRUCTURE = [
    { row: 0, count: 1, y: 5 },     // Top Artemis
    { row: 1, count: 2, y: 18 },
    { row: 2, count: 3, y: 31 },
    { row: 3, count: 5, y: 44 },
    { row: 4, count: 5, y: 57 },
    { row: 5, count: 5, y: 70 },
    { row: 6, count: 5, y: 83 },
    { row: 7, count: 5, y: 96 },
    { row: 8, count: 3, y: 109 },
    { row: 9, count: 1, y: 135 }    // Bottom Artemis
];

// ============================================
// GAME STATE
// ============================================
let board = new Map();
let connections = new Map();
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let isInLeapChain = false;
let leapChainStart = null;

// ============================================
// DOM ELEMENTS
// ============================================
const svg = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const playerColorElement = document.getElementById('current-player-color');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const cancelButton = document.getElementById('cancel-button');

// ============================================
// BOARD INITIALIZATION
// ============================================

function initializeBoard() {
    board.clear();
    connections.clear();

    // Create nodes with equal spacing
    BOARD_STRUCTURE.forEach(({ row, count, y }) => {
        for (let col = 0; col < count; col++) {
            // Calculate x position for equal spacing
            let x;
            if (count === 1) {
                x = 50; // Center
            } else if (count === 2) {
                x = 33.33 + (col * 33.33); // 33.33, 66.66
            } else if (count === 3) {
                x = 25 + (col * 25); // 25, 50, 75
            } else if (count === 5) {
                x = 16.67 + (col * 16.67); // Equal spacing for 5 nodes
            }

            const key = `${row},${col}`;
            const isArtemis = (row === 0 || row === 9);

            board.set(key, {
                row,
                col,
                x,
                y,
                piece: null,
                isArtemis
            });
        }
    });

    buildConnections();
    placeStartingPieces();

    currentPlayer = 'white';
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    isInLeapChain = false;
    leapChainStart = null;

    drawBoard();
    updateStatus();
    hideMessage();
}

function buildConnections() {
    // Build all connections including diagonals across the board

    // Manual connection definition for accurate board structure
    const connectionPairs = [
        // Row 0 to Row 1
        ['0,0', '1,0'], ['0,0', '1,1'],

        // Row 1 to Row 2
        ['1,0', '2,0'], ['1,0', '2,1'],
        ['1,1', '2,1'], ['1,1', '2,2'],

        // Row 1 horizontal
        ['1,0', '1,1'],

        // Row 2 to Row 3
        ['2,0', '3,0'], ['2,0', '3,1'],
        ['2,1', '3,2'],
        ['2,2', '3,3'], ['2,2', '3,4'],
        // ADDED: Outer fields of row 2 to middle field of row 3
        ['2,0', '3,2'], ['2,2', '3,2'],

        // Row 2 horizontal
        ['2,0', '2,1'], ['2,1', '2,2'],

        // Row 3 to Row 4 (vertical)
        ['3,0', '4,0'], ['3,1', '4,1'], ['3,2', '4,2'], ['3,3', '4,3'], ['3,4', '4,4'],

        // Row 3 horizontal
        ['3,0', '3,1'], ['3,1', '3,2'], ['3,2', '3,3'], ['3,3', '3,4'],

        // Row 3 diagonals (left to right across board)
        ['3,0', '4,1'], ['3,1', '4,2'], ['3,2', '4,3'], ['3,3', '4,4'],

        // Row 3 diagonals (right to left across board)
        ['3,1', '4,0'], ['3,2', '4,1'], ['3,3', '4,2'], ['3,4', '4,3'],

        // Row 4 to Row 5 (vertical)
        ['4,0', '5,0'], ['4,1', '5,1'], ['4,2', '5,2'], ['4,3', '5,3'], ['4,4', '5,4'],

        // Row 4 horizontal
        ['4,0', '4,1'], ['4,1', '4,2'], ['4,2', '4,3'], ['4,3', '4,4'],

        // Row 4 diagonals
        ['4,0', '5,1'], ['4,1', '5,2'], ['4,2', '5,3'], ['4,3', '5,4'],
        ['4,1', '5,0'], ['4,2', '5,1'], ['4,3', '5,2'], ['4,4', '5,3'],

        // Row 5 to Row 6 (vertical)
        ['5,0', '6,0'], ['5,1', '6,1'], ['5,2', '6,2'], ['5,3', '6,3'], ['5,4', '6,4'],

        // Row 5 horizontal
        ['5,0', '5,1'], ['5,1', '5,2'], ['5,2', '5,3'], ['5,3', '5,4'],

        // Row 5 diagonals
        ['5,0', '6,1'], ['5,1', '6,2'], ['5,2', '6,3'], ['5,3', '6,4'],
        ['5,1', '6,0'], ['5,2', '6,1'], ['5,3', '6,2'], ['5,4', '6,3'],

        // Row 6 to Row 7 (vertical)
        ['6,0', '7,0'], ['6,1', '7,1'], ['6,2', '7,2'], ['6,3', '7,3'], ['6,4', '7,4'],

        // Row 6 horizontal
        ['6,0', '6,1'], ['6,1', '6,2'], ['6,2', '6,3'], ['6,3', '6,4'],

        // Row 6 diagonals
        ['6,0', '7,1'], ['6,1', '7,2'], ['6,2', '7,3'], ['6,3', '7,4'],
        ['6,1', '7,0'], ['6,2', '7,1'], ['6,3', '7,2'], ['6,4', '7,3'],

        // Row 7 to Row 8
        ['7,0', '8,0'], ['7,1', '8,0'],
        ['7,2', '8,1'],
        ['7,3', '8,2'], ['7,4', '8,2'],


        // Row 7 horizontal
        ['7,0', '7,1'], ['7,1', '7,2'], ['7,2', '7,3'], ['7,3', '7,4'],

        // Row 8 to Row 9
        ['8,0', '9,0'], ['8,1', '9,0'], ['8,2', '9,0'],

        // Row 8 horizontal
        ['8,0', '8,1'], ['8,1', '8,2']
    ];

    // Initialize connection map
    board.forEach((node, key) => {
        connections.set(key, []);
    });

    // Add bidirectional connections
    connectionPairs.forEach(([key1, key2]) => {
        if (board.has(key1) && board.has(key2)) {
            const node1 = board.get(key1);
            const node2 = board.get(key2);

            connections.get(key1).push({ row: node2.row, col: node2.col });
            connections.get(key2).push({ row: node1.row, col: node1.col });
        }
    });
}

function placeStartingPieces() {
    // White starts at bottom (rows 7, 8, 9)
    // Row 7: 3 middle stones (cols 1, 2, 3)
    board.get('7,1').piece = 'white';
    board.get('7,2').piece = 'white';
    board.get('7,3').piece = 'white';

    // Row 8: all 3 stones
    board.get('8,0').piece = 'white';
    board.get('8,1').piece = 'white';
    board.get('8,2').piece = 'white';

    // Row 9: bottom Artemis (1 stone)
    board.get('9,0').piece = 'white';

    // Black starts at top (rows 0, 1, 2)
    // Row 0: top Artemis (1 stone)
    board.get('0,0').piece = 'black';

    // Row 1: both stones
    board.get('1,0').piece = 'black';
    board.get('1,1').piece = 'black';

    // Row 2: all 3 stones
    board.get('2,0').piece = 'black';
    board.get('2,1').piece = 'black';
    board.get('2,2').piece = 'black';
}

// ============================================
// RENDERING
// ============================================

function drawBoard() {
    svg.innerHTML = '';

    const linesGroup = document.createElementNS(SVG_NS, 'g');
    const nodesGroup = document.createElementNS(SVG_NS, 'g');
    const stonesGroup = document.createElementNS(SVG_NS, 'g');

    // Draw connection lines
    const drawnLines = new Set();
    connections.forEach((nodeConnections, key) => {
        const node = board.get(key);
        nodeConnections.forEach(conn => {
            const connKey = `${conn.row},${conn.col}`;
            const lineId = [key, connKey].sort().join('|');

            if (!drawnLines.has(lineId)) {
                const connNode = board.get(connKey);
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', node.x);
                line.setAttribute('y1', node.y);
                line.setAttribute('x2', connNode.x);
                line.setAttribute('y2', connNode.y);
                line.classList.add('connection-line');
                linesGroup.appendChild(line);
                drawnLines.add(lineId);
            }
        });
    });

    // Draw nodes and stones
    board.forEach((node, key) => {
        // Draw node spot
        const spot = document.createElementNS(SVG_NS, 'circle');
        spot.setAttribute('cx', node.x);
        spot.setAttribute('cy', node.y);
        spot.setAttribute('r', 3);
        spot.classList.add('node-spot');

        if (node.isArtemis) {
            spot.classList.add('artemis');
        }

        // Highlight valid moves
        if (validMoves.some(m => m.row === node.row && m.col === node.col)) {
            spot.classList.add('valid-move');
        }

        spot.addEventListener('click', () => handleNodeClick(node.row, node.col));
        nodesGroup.appendChild(spot);

        // Draw stone if present
        if (node.piece) {
            const stone = document.createElementNS(SVG_NS, 'circle');
            stone.setAttribute('cx', node.x);
            stone.setAttribute('cy', node.y);
            stone.setAttribute('r', 2.5);
            stone.classList.add('stone', node.piece);

            if (selectedStone && selectedStone.row === node.row && selectedStone.col === node.col) {
                stone.classList.add('selected');
            }

            if (isInLeapChain && leapChainStart && leapChainStart.row === node.row && leapChainStart.col === node.col) {
                stone.classList.add('in-leap-chain');
            }

            stone.addEventListener('click', () => handleNodeClick(node.row, node.col));
            stonesGroup.appendChild(stone);
        }
    });

    svg.appendChild(linesGroup);
    svg.appendChild(nodesGroup);
    svg.appendChild(stonesGroup);
}

function updateStatus(message = null) {
    playerColorElement.style.backgroundColor = currentPlayer === 'white' ? '#ffffff' : '#1a1a1a';
    playerColorElement.style.borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffffff';

    if (gameState === 'GAME_OVER') return;

    if (message) {
        statusElement.textContent = message;
    } else {
        const playerName = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
        if (gameState === 'SELECT_STONE') {
            statusElement.textContent = `${playerName} to move. Select a stone to move.`;
        } else if (gameState === 'SELECT_MOVE') {
            if (isInLeapChain) {
                statusElement.textContent = `${playerName} leap in progress. Select next target or click Cancel.`;
            } else {
                statusElement.textContent = `${playerName} selected. Choose where to move (green highlights).`;
            }
        }
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
    } else {
        cancelButton.classList.add('hidden');
    }
}

// ============================================
// GAME LOGIC
// ============================================

function getConnections(row, col) {
    const key = `${row},${col}`;
    return connections.get(key) || [];
}

function isForwardOrSideways(fromRow, toRow, player) {
    // White moves upward (decreasing row numbers)
    // Black moves downward (increasing row numbers)
    if (player === 'white') {
        return toRow <= fromRow; // Can move up or sideways
    } else {
        return toRow >= fromRow; // Can move down or sideways
    }
}

function calculateWalkMoves(row, col) {
    const moves = [];
    const nodeConnections = getConnections(row, col);
    const node = board.get(`${row},${col}`);

    if (!node || !node.piece) return moves;

    const player = node.piece;

    nodeConnections.forEach(conn => {
        const targetKey = `${conn.row},${conn.col}`;
        const targetNode = board.get(targetKey);

        // Must be empty and forward/sideways
        if (targetNode && !targetNode.piece && isForwardOrSideways(row, conn.row, player)) {
            moves.push({ row: conn.row, col: conn.col, type: 'walk' });
        }
    });

    return moves;
}

function calculateLeapMoves(row, col, isChaining = false) {
    const moves = [];
    const nodeConnections = getConnections(row, col);
    const node = board.get(`${row},${col}`);

    if (!node || !node.piece) return moves;

    const player = node.piece;

    nodeConnections.forEach(conn => {
        const adjacentKey = `${conn.row},${conn.col}`;
        const adjacentNode = board.get(adjacentKey);

        // Must have a stone to leap over
        if (adjacentNode && adjacentNode.piece) {
            // Get connections from the adjacent node
            const beyondConnections = getConnections(conn.row, conn.col);

            beyondConnections.forEach(beyond => {
                const beyondKey = `${beyond.row},${beyond.col}`;
                const beyondNode = board.get(beyondKey);

                // Check if this is in the same direction (straight leap)
                const dx1 = conn.col - col;
                const dy1 = conn.row - row;
                const dx2 = beyond.col - conn.col;
                const dy2 = beyond.row - conn.row;

                // Must be same direction
                if (dx1 === dx2 && dy1 === dy2) {
                    // Landing spot must be empty
                    if (beyondNode && !beyondNode.piece) {
                        const captureOpponent = adjacentNode.piece !== player;
                        moves.push({
                            row: beyond.row,
                            col: beyond.col,
                            type: 'leap',
                            over: { row: conn.row, col: conn.col },
                            capture: captureOpponent
                        });
                    }
                }
            });

            // Leap of Faith (off the board)
            // This would remove the stone - we can add this as a special move
        }
    });

    return moves;
}

function handleNodeClick(row, col) {
    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.");
        return;
    }

    const key = `${row},${col}`;
    const node = board.get(key);

    if (gameState === 'SELECT_STONE') {
        if (node.piece === currentPlayer) {
            selectedStone = { row, col };
            const walkMoves = calculateWalkMoves(row, col);
            const leapMoves = calculateLeapMoves(row, col);
            validMoves = [...walkMoves, ...leapMoves];

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
            executeMove(move);
        } else if (node.piece === currentPlayer && !isInLeapChain) {
            // Reselect different stone
            selectedStone = { row, col };
            const walkMoves = calculateWalkMoves(row, col);
            const leapMoves = calculateLeapMoves(row, col);
            validMoves = [...walkMoves, ...leapMoves];

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

function executeMove(move) {
    const fromKey = `${selectedStone.row},${selectedStone.col}`;
    const toKey = `${move.row},${move.col}`;
    const fromNode = board.get(fromKey);
    const toNode = board.get(toKey);

    // Move the stone
    toNode.piece = fromNode.piece;
    fromNode.piece = null;

    let message = '';

    // Handle capture
    if (move.type === 'leap' && move.capture) {
        const overKey = `${move.over.row},${move.over.col}`;
        const overNode = board.get(overKey);
        message = `${currentPlayer} captured ${overNode.piece} stone! `;
        overNode.piece = null;
    }

    // Check for win
    if (toNode.isArtemis) {
        const winner = currentPlayer;
        gameState = 'GAME_OVER';
        message += `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by reaching the Artemis field!`;
        showMessage(message);
        updateStatus(`Game Over! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
        selectedStone = null;
        validMoves = [];
        drawBoard();
        updateUI();
        return;
    }

    // Check for leap chaining
    if (move.type === 'leap') {
        if (!isInLeapChain) {
            isInLeapChain = true;
            leapChainStart = { row: selectedStone.row, col: selectedStone.col };
        }

        selectedStone = { row: move.row, col: move.col };
        const nextLeaps = calculateLeapMoves(move.row, move.col, true);

        if (nextLeaps.length > 0) {
            validMoves = nextLeaps;
            message += 'Leap successful! Continue leaping or click Cancel to end turn.';
            showMessage(message);
            drawBoard();
            updateStatus();
            updateUI();
            return;
        }
    }

    // End turn
    if (message) showMessage(message);
    endTurn();
}

function cancelMove() {
    // If in a leap chain, end the turn instead of just canceling
    if (isInLeapChain) {
        endTurn();
    } else {
        // Normal cancel: just deselect
        selectedStone = null;
        validMoves = [];
        gameState = 'SELECT_STONE';
        drawBoard();
        updateStatus();
        updateUI();
    }
}

function endTurn() {
    selectedStone = null;
    validMoves = [];
    isInLeapChain = false;
    leapChainStart = null;
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gameState = 'SELECT_STONE';
    drawBoard();
    updateStatus();
    updateUI();
}

// ============================================
// EVENT LISTENERS
// ============================================

resetButton.addEventListener('click', initializeBoard);
cancelButton.addEventListener('click', cancelMove);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', initializeBoard);
