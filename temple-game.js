// TEMPLE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const SVG_NS = "http://www.w3.org/2000/svg";

// Board structure with proper equal spacing
// Board structure with logical column offsets (0-4 grid)
const BOARD_STRUCTURE = [
    { row: 0, count: 1, offset: 2, y: 5 },      // Top Artemis (Col 2)
    { row: 1, count: 3, offset: 1, y: 18 },     // (Cols 1-3)
    { row: 2, count: 5, offset: 0, y: 31 },     // (Cols 0-4)
    { row: 3, count: 5, offset: 0, y: 44 },
    { row: 4, count: 5, offset: 0, y: 57 },
    { row: 5, count: 5, offset: 0, y: 70 },
    { row: 6, count: 5, offset: 0, y: 83 },
    { row: 7, count: 3, offset: 1, y: 96 },     // (Cols 1-3)
    { row: 8, count: 1, offset: 2, y: 109 }     // Bottom Artemis (Col 2)
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
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');

// ============================================
// BOARD INITIALIZATION
// ============================================

function initializeBoard() {
    board.clear();
    connections.clear();

    // Create nodes with equal spacing
    // Create nodes with logical column alignment
    // Generate alphanumeric labels: A1, B1, B2, B3, C1, C2, C3, C4, C5, etc.
    const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

    BOARD_STRUCTURE.forEach(({ row, count, offset, y }) => {
        for (let i = 0; i < count; i++) {
            const col = offset + i; // Logical column (0-4)

            // Calculate x position: 5 columns, centered around 50
            // Spacing should match Y spacing (13 units) to make it a square grid
            // Col 2 is center (50). Col 0 is 50 - 2*13, Col 4 is 50 + 2*13
            const x = 50 + ((col - 2) * 13);

            const key = `${row},${col}`;
            const isArtemis = (row === 0 || row === 8);
            const label = `${rowLabels[row]}${i + 1}`;

            board.set(key, {
                row,
                col,
                x,
                y,
                piece: null,
                isArtemis,
                label
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
    updateStatus();
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

function buildConnections() {
    const connectionPairs = [];
    // TEMPORARILY DISABLED - Will rebuild based on user specification
    // const add = (r1, c1, r2, c2) => connectionPairs.push([`${r1},${c1}`, `${r2},${c2}`]);

    // Initialize connection map
    board.forEach((node, key) => {
        connections.set(key, []);
    });

    /*
    // Iterate through all nodes and find valid neighbors
    board.forEach((node) => {
        const { row, col } = node;
    
        // 1. Horizontal Right: (row, col + 1)
        if (board.has(`${row},${col + 1}`)) {
            add(row, col, row, col + 1);
        }
    
        // 2. Vertical Down: (row + 1, col)
        if (board.has(`${row + 1},${col}`)) {
            add(row, col, row + 1, col);
        }
    
        // 3. Diagonal Down-Left: (row + 1, col - 1)
        if (board.has(`${row + 1},${col - 1}`)) {
            // Remove crossing diagonals at transitions between 3-node and 5-node rows
            // Top: Row 1 (3 nodes, cols 1-3) -> Row 2 (5 nodes, cols 0-4)
            // Remove: 1,2->2,1, 1,3->2,2
            // Bottom: Row 6 (5 nodes, cols 0-4) -> Row 7 (3 nodes, cols 1-3)  
            // Remove: 6,1->7,0, 6,2->7,1, 6,3->7,2, 6,4->7,3
    
            const skipConnections = [
                // Top transition
                [1, 2, 2, 1], [1, 3, 2, 2],
                // Bottom transition  
                [6, 1, 7, 0], [6, 2, 7, 1], [6, 3, 7, 2], [6, 4, 7, 3]
            ];
    
            const shouldSkip = skipConnections.some(([r1, c1, r2, c2]) =>
                row === r1 && col === c1 && row + 1 === r2 && col - 1 === c2
            );
    
            if (!shouldSkip) {
                add(row, col, row + 1, col - 1);
            }
        }
    
        // 4. Diagonal Down-Right: (row + 1, col + 1)
        if (board.has(`${row + 1},${col + 1}`)) {
            // Remove crossing diagonals at transitions between 3-node and 5-node rows
            // Top: Row 1 (3 nodes, cols 1-3) -> Row 2 (5 nodes, cols 0-4)
            // Remove: 1,1->2,2, 1,2->2,3
            // Bottom: Row 6 (5 nodes, cols 0-4) -> Row 7 (3 nodes, cols 1-3)
            // Remove: 6,0->7,1, 6,1->7,2, 6,2->7,3
    
            const skipConnections = [
                // Top transition
                [1, 1, 2, 2], [1, 2, 2, 3],
                // Bottom transition
                [6, 0, 7, 1], [6, 1, 7, 2], [6, 2, 7, 3]
            ];
    
            const shouldSkip = skipConnections.some(([r1, c1, r2, c2]) =>
                row === r1 && col === c1 && row + 1 === r2 && col + 1 === c2
            );
    
            if (!shouldSkip) {
                add(row, col, row + 1, col + 1);
            }
        }
    });
    
    
    // Add bidirectional connections
    connectionPairs.forEach(([key1, key2]) => {
        if (board.has(key1) && board.has(key2)) {
            const node1 = board.get(key1);
            const node2 = board.get(key2);
    
            // Avoid duplicates
            const c1 = connections.get(key1);
            if (!c1.some(c => c.row === node2.row && c.col === node2.col)) {
                c1.push({ row: node2.row, col: node2.col });
            }
    
            const c2 = connections.get(key2);
            if (!c2.some(c => c.row === node1.row && c.col === node1.col)) {
                c2.push({ row: node1.row, col: node1.col });
            }
        }
    });
        */

    // User-specified connections
    const add = (r1, c1, r2, c2) => connectionPairs.push([`${r1},${c1}`, `${r2},${c2}`]);

    // Add all horizontal and vertical connections
    board.forEach((node) => {
        const { row, col } = node;

        // Horizontal Right: connect to adjacent node in same row
        if (board.has(`${row},${col + 1}`)) {
            add(row, col, row, col + 1);
        }

        // Vertical Down: connect to node directly below
        if (board.has(`${row + 1},${col}`)) {
            add(row, col, row + 1, col);
        }
    });

    // Add diagonal connections - broken into segments
    // A1 to C1 and C5
    // A1 to C1 path (A1 -> B1 -> C1)
    add(0, 2, 1, 1);  // A1 to B1
    add(1, 1, 2, 0);  // B1 to C1

    // A1 to C5 path (A1 -> B3 -> C5)
    add(0, 2, 1, 3);  // A1 to B3
    add(1, 3, 2, 4);  // B3 to C5

    // Left edge (C1 to G1) - broken into segments
    add(2, 0, 3, 0);  // C1 to D1
    add(3, 0, 4, 0);  // D1 to E1
    add(4, 0, 5, 0);  // E1 to F1
    add(5, 0, 6, 0);  // F1 to G1

    // Right edge (C5 to G5) - broken into segments
    add(2, 4, 3, 4);  // C5 to D5
    add(3, 4, 4, 4);  // D5 to E5
    add(4, 4, 5, 4);  // E5 to F5
    add(5, 4, 6, 4);  // F5 to G5

    // Bottom left (G1 to I1)
    add(6, 0, 7, 1);  // G1 to H1
    add(7, 1, 8, 2);  // H1 to I1

    // Bottom right (G5 to I1)
    add(6, 4, 7, 3);  // G5 to H3
    add(7, 3, 8, 2);  // H3 to I1


    // B1 to E5 diagonal - broken into segments
    add(1, 1, 2, 2);  // B1 to C3
    add(2, 2, 3, 3);  // C3 to D4
    add(3, 3, 4, 4);  // D4 to E5

    // E1 to B3 diagonal - broken into segments
    add(4, 0, 3, 1);  // E1 to D2
    add(3, 1, 2, 2);  // D2 to C3
    add(2, 2, 1, 3);  // C3 to B3

    // H1 to E5 diagonal - broken into segments
    add(7, 1, 6, 2);  // H1 to G3
    add(6, 2, 5, 3);  // G3 to F4
    add(5, 3, 4, 4);  // F4 to E5

    // H3 to E1 diagonal - broken into segments
    add(7, 3, 6, 2);  // H3 to G3
    add(6, 2, 5, 1);  // G3 to F2
    add(5, 1, 4, 0);  // F2 to E1

    // C1 to G5 diagonal - broken into segments
    add(2, 0, 3, 1);  // C1 to D2
    add(3, 1, 4, 2);  // D2 to E3
    add(4, 2, 5, 3);  // E3 to F4
    add(5, 3, 6, 4);  // F4 to G5

    // C5 to G1 diagonal - broken into segments
    add(2, 4, 3, 3);  // C5 to D4
    add(3, 3, 4, 2);  // D4 to E3
    add(4, 2, 5, 1);  // E3 to F2
    add(5, 1, 6, 0);  // F2 to G1

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
    // White starts at bottom (Rows 6, 7, 8)
    // Row 6 (5 stones)
    for (let c = 0; c < 5; c++) board.get(`6,${c}`).piece = 'white';

    // Row 7 (3 stones)
    for (let c = 1; c <= 3; c++) board.get(`7,${c}`).piece = 'white';

    // Row 8 (1 stone)
    board.get('8,2').piece = 'white';

    // Black starts at top (Rows 0, 1, 2)
    // Row 0 (1 stone)
    board.get('0,2').piece = 'black';

    // Row 1 (3 stones)
    for (let c = 1; c <= 3; c++) board.get(`1,${c}`).piece = 'black';

    // Row 2 (5 stones)
    for (let c = 0; c < 5; c++) board.get(`2,${c}`).piece = 'black';
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
        if (validMoves.some(m => m.row === node.row && m.col === node.col && !m.offBoard)) {
            spot.classList.add('valid-move');
        }

        spot.addEventListener('click', () => handleNodeClick(node.row, node.col));
        nodesGroup.appendChild(spot);

        // Labels removed for cleaner appearance
        /*
        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', node.x);
        label.setAttribute('y', node.y + 0.8);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '2');
        label.setAttribute('fill', '#333');
        label.setAttribute('font-weight', 'bold');
        label.textContent = node.label;
        nodesGroup.appendChild(label);
        */

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

    // Draw Leap of Faith spots (contextual red fields)
    validMoves.forEach(move => {
        if (move.offBoard) {
            // Calculate position for off-board spot
            const overNode = board.get(`${move.over.row},${move.over.col}`);
            if (overNode) {
                // Position it beyond the node being leaped over
                const dx = move.col - move.over.col;
                const dy = move.row - move.over.row;
                const x = overNode.x + (dx * 13);
                const y = overNode.y + (dy * 13);

                const leapSpot = document.createElementNS(SVG_NS, 'circle');
                leapSpot.setAttribute('cx', x);
                leapSpot.setAttribute('cy', y);
                leapSpot.setAttribute('r', 3);
                leapSpot.classList.add('leap-of-faith-spot');
                leapSpot.addEventListener('click', () => handleLeapOfFaith(move));
                nodesGroup.appendChild(leapSpot);
            }
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
                statusElement.textContent = `${playerName} leap in progress. Select next target or click Stop.`;
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
        // Change button text based on leap chain state
        if (isInLeapChain) {
            cancelButton.textContent = 'Stop Move';
        } else {
            cancelButton.textContent = 'Cancel Move';
        }
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

function calculateLeapMoves(row, col, isChaining = false, previousDirection = null) {
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
                    // If chaining, check direction constraint (max 45-degree turn)
                    if (isChaining && previousDirection) {
                        const angle = calculateAngleBetweenDirections(previousDirection, { dx: dx1, dy: dy1 });
                        // Block turns > 45 degrees (allow same line or first diagonal)
                        if (angle > 60) {
                            return; // Skip this move
                        }
                    }

                    // Landing spot must be empty AND forward/sideways
                    if (beyondNode && !beyondNode.piece && isForwardOrSideways(row, beyond.row, player)) {
                        const captureOpponent = adjacentNode.piece !== player;
                        moves.push({
                            row: beyond.row,
                            col: beyond.col,
                            type: 'leap',
                            over: { row: conn.row, col: conn.col },
                            capture: captureOpponent,
                            direction: { dx: dx1, dy: dy1 }
                        });
                    }
                }
            });

            // Leap of Faith: Check if we can leap off the board
            // If there's no field at all in this direction, it's a Leap of Faith
            const hasFieldBeyond = beyondConnections.some(beyond => {
                const dx2 = beyond.col - conn.col;
                const dy2 = beyond.row - conn.row;
                const dx1 = conn.col - col;
                const dy1 = conn.row - row;

                // Check if there's a field in the same direction (regardless of whether it's empty or occupied)
                if (dx1 === dx2 && dy1 === dy2) {
                    const beyondNode = board.get(`${beyond.row},${beyond.col}`);
                    return beyondNode !== undefined; // Field exists (empty or occupied)
                }
                return false;
            });
            if (adjacentNode.piece !== player && !hasFieldBeyond) {
                const dx = conn.col - col;
                const dy = conn.row - row;

                // If chaining, check direction constraint
                if (isChaining && previousDirection) {
                    const angle = calculateAngleBetweenDirections(previousDirection, { dx, dy });
                    // Block turns > 45 degrees
                    if (angle > 60) {
                        return; // Skip this move
                    }
                }

                // Calculate the "off-board" position for visualization
                const offBoardRow = conn.row + dy;
                const offBoardCol = conn.col + dx;

                // Must be forward or sideways movement
                if (!isForwardOrSideways(row, conn.row, player)) {
                    return; // Skip backward Leap of Faith
                }

                moves.push({
                    row: offBoardRow,
                    col: offBoardCol,
                    type: 'leap_of_faith',
                    over: { row: conn.row, col: conn.col },
                    capture: true,
                    offBoard: true,
                    direction: { dx, dy }
                });
            }
        }
    });

    return moves;
}

// Helper function to calculate angle between two directions
function calculateAngleBetweenDirections(dir1, dir2) {
    // Normalize directions
    const normalize = (dx, dy) => {
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return { dx: 0, dy: 0 };
        return { dx: dx / len, dy: dy / len };
    };

    const n1 = normalize(dir1.dx, dir1.dy);
    const n2 = normalize(dir2.dx, dir2.dy);

    // Calculate dot product
    const dot = n1.dx * n2.dx + n1.dy * n2.dy;

    // Calculate angle in degrees
    // Clamp dot product to [-1, 1] to avoid NaN from acos
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    const angleDeg = angleRad * (180 / Math.PI);

    return Math.round(angleDeg); // Round to avoid floating point issues
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

function handleLeapOfFaith(move) {
    if (gameState !== 'SELECT_MOVE') return;

    // Execute the Leap of Faith
    const fromKey = `${selectedStone.row},${selectedStone.col}`;
    const overKey = `${move.over.row},${move.over.col}`;
    const fromNode = board.get(fromKey);
    const overNode = board.get(overKey);

    // Remove both stones (the leaping stone and the captured stone)
    const leapingPlayer = fromNode.piece;
    const capturedPlayer = overNode.piece;
    fromNode.piece = null;
    overNode.piece = null;

    showMessage(`${leapingPlayer} performed a Leap of Faith, capturing ${capturedPlayer} stone but sacrificing their own!`);

    // End turn
    endTurn();
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
        gameState = 'GAME_OVER';
        const winTitle = `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`;
        const winText = `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by reaching the Artemis field!`;

        updateStatus(`Game Over! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
        showGameOverModal(winTitle, winText);

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
        // Pass the direction of this leap to constrain next leaps
        const nextLeaps = calculateLeapMoves(move.row, move.col, true, move.direction);

        if (nextLeaps.length > 0) {
            validMoves = nextLeaps;
            message += 'Leap successful! Continue leaping or click Stop to end turn.';
            showMessage(message);
            drawBoard();
            updateStatus();
            updateUI();
            return;
        } else {
            // No more leaps available - auto-end turn
            message += 'Leap successful! No more leaps available.';
            showMessage(message);
            // Reset leap chain state before ending turn
            isInLeapChain = false;
            leapChainStart = null;
            endTurn();
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
```
